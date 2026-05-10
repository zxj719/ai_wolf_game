import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';

const PROJECT_NAME_RE = /^[\p{L}\p{N}._-]+$/u;
const CHAPTER_ID_RE = /^[\p{L}\p{N}._-]+$/u;
const MEMORY_FILE_RE = /^[\p{L}\p{N}._\-/ ]+\.(md|txt|ya?ml|json)$/u;
const DEFAULT_CODEX_ARGS = ['exec', '--full-auto', '--skip-git-repo-check'];
const jobs = new Map();
const MAX_JOB_TEXT_LENGTH = 40000;
const MAX_JOB_MESSAGES = 120;
const MAX_VISIBLE_TRACE_LENGTH = 1600;
const CODEX_ACTION_MODES = new Set(['next_chapter', 'revise_document', 'plan', 'story_bible']);
const CODEX_SESSION_STORE = '.codex-sessions.json';

export function resolveNovelWorkspaceRoot(env = process.env, cwd = process.cwd()) {
  return resolve(env.NOVEL_WORKSPACE_DIR || join(cwd, '..', 'novel_generator', 'meta_writing'));
}

function assertInside(parent, child) {
  const rel = relative(parent, child);
  if (rel.startsWith('..') || rel === '..' || rel.includes(`..${sep}`) || rel === '') {
    if (rel === '') return;
    throw new Error('Resolved path escaped workspace');
  }
}

function ensureProjectName(name) {
  const value = String(name || '').trim();
  if (!PROJECT_NAME_RE.test(value) || value.includes('..')) {
    throw new Error('Invalid project name');
  }
  return value;
}

function ensureChapterId(id) {
  const value = String(id || '').trim();
  if (!CHAPTER_ID_RE.test(value) || value.includes('..')) {
    throw new Error('Invalid chapter id');
  }
  return value;
}

function ensureMemoryFilePath(path) {
  const value = String(path || '').trim().replaceAll('\\', '/').replace(/^\/+/, '');
  if (
    !value ||
    value.includes('..') ||
    value.startsWith('/') ||
    !MEMORY_FILE_RE.test(value)
  ) {
    throw new Error('Invalid memory file path');
  }
  return value;
}

function readText(path) {
  if (!existsSync(path)) return '';
  return readFileSync(path, 'utf8');
}

function readJson(path) {
  try {
    return JSON.parse(readText(path));
  } catch {
    return null;
  }
}

function readJsonObject(path, fallback = {}) {
  const value = readJson(path);
  return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
}

function firstHeading(markdown, fallback) {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : fallback;
}

function excerpt(markdown) {
  return markdown
    .replace(/^#\s+.+$/m, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}

function listMarkdownChapters(chaptersDir) {
  if (!existsSync(chaptersDir)) return [];
  return readdirSync(chaptersDir)
    .filter((name) => name.toLowerCase().endsWith('.md'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((filename) => {
      const id = filename.replace(/\.md$/i, '');
      const content = readText(join(chaptersDir, filename));
      return {
        id,
        filename,
        title: firstHeading(content, `Chapter ${id}`),
        excerpt: excerpt(content),
        size: Buffer.byteLength(content, 'utf8'),
      };
    });
}

function walkStoryData(root, current = root, sections = []) {
  if (!existsSync(current)) return sections;
  for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const fullPath = join(current, entry.name);
    if (entry.isDirectory()) {
      walkStoryData(root, fullPath, sections);
      continue;
    }
    if (!/\.(ya?ml|md|json|txt)$/i.test(entry.name)) continue;
    sections.push({
      name: relative(root, fullPath).replaceAll('\\', '/'),
      content: readText(fullPath),
    });
  }
  return sections;
}

function slugifyProjectName(name) {
  return String(name || 'new-book')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72) || 'new-book';
}

function writeProjectText(path, content = '') {
  writeFileSync(path, String(content || ''), 'utf8');
}

function writeJson(path, data) {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function buildInitialStoryBible({ name, worldview, style, concept, outline }) {
  return [
    `# ${name}`,
    '',
    '## Worldview',
    worldview || '',
    '',
    '## Voice And Style',
    style || '',
    '',
    '## Core Idea',
    concept || '',
    '',
    '## Story Line',
    outline || '',
    '',
  ].join('\n');
}

export function resolveProjectDir(workspaceRoot, projectName) {
  const safeName = ensureProjectName(projectName);
  const root = resolve(workspaceRoot);
  const projectDir = resolve(root, 'novels', safeName);
  assertInside(resolve(root, 'novels'), projectDir);
  if (!existsSync(projectDir) || !statSync(projectDir).isDirectory()) {
    throw new Error(`Project not found: ${safeName}`);
  }
  return projectDir;
}

export function createNovelProject(workspaceRoot, input = {}) {
  const name = String(input.name || '').trim();
  if (!name) {
    throw new Error('Project name is required');
  }

  const safeSlug = ensureProjectName(input.slug || slugifyProjectName(name));
  const root = resolve(workspaceRoot);
  const novelsDir = resolve(root, 'novels');
  const projectDir = resolve(novelsDir, safeSlug);
  assertInside(novelsDir, projectDir);
  if (existsSync(projectDir)) {
    throw new Error(`Project already exists: ${safeSlug}`);
  }

  mkdirSync(resolve(projectDir, 'chapters'), { recursive: true });
  mkdirSync(resolve(projectDir, 'story_data', 'chapter_summaries'), { recursive: true });
  mkdirSync(resolve(projectDir, 'story_data', 'characters'), { recursive: true });

  writeProjectText(
    resolve(projectDir, '.meta-writing-project.json'),
    `${JSON.stringify({ name, workflow_mode: 'manual' }, null, 2)}\n`,
  );
  writeProjectText(
    resolve(projectDir, 'creator_guidance.md'),
    [
      `# ${name} Creator Guidance`,
      '',
      '## Style',
      input.style || '',
      '',
      '## Creative Direction',
      input.concept || '',
      '',
    ].join('\n'),
  );
  writeProjectText(resolve(projectDir, 'learned_rules.md'), '# Learned Rules\n\n');
  writeProjectText(
    resolve(projectDir, 'story_data', 'story_bible.md'),
    buildInitialStoryBible({
      name,
      worldview: input.worldview,
      style: input.style,
      concept: input.concept,
      outline: input.outline,
    }),
  );
  writeProjectText(
    resolve(projectDir, 'story_data', 'story_core.yaml'),
    [
      `title: ${JSON.stringify(name)}`,
      'current_chapter: 0',
      'status: drafting_story_bible',
      '',
    ].join('\n'),
  );

  return getNovelProject(workspaceRoot, safeSlug);
}

export function listNovelProjects(workspaceRoot) {
  const novelsDir = resolve(workspaceRoot, 'novels');
  if (!existsSync(novelsDir)) return [];

  return readdirSync(novelsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const projectDir = join(novelsDir, entry.name);
      const metadata = readJson(join(projectDir, '.meta-writing-project.json')) || {};
      const chapters = listMarkdownChapters(join(projectDir, 'chapters'));
      const latest = chapters.at(-1);
      return {
        name: metadata.name || entry.name,
        slug: entry.name,
        workflowMode: metadata.workflow_mode || 'manual',
        chapterCount: chapters.length,
        latestChapter: latest?.id || null,
        latestTitle: latest?.title || '',
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getNovelProject(workspaceRoot, projectName) {
  const projectDir = resolveProjectDir(workspaceRoot, projectName);
  const metadata = readJson(join(projectDir, '.meta-writing-project.json')) || {};
  return {
    name: metadata.name || basename(projectDir),
    slug: basename(projectDir),
    workflowMode: metadata.workflow_mode || 'manual',
    creatorGuidance: readText(join(projectDir, 'creator_guidance.md')),
    learnedRules: readText(join(projectDir, 'learned_rules.md')),
    chapters: listMarkdownChapters(join(projectDir, 'chapters')),
    storyBible: {
      sections: walkStoryData(join(projectDir, 'story_data')),
    },
  };
}

export function getNovelChapter(workspaceRoot, projectName, chapterId) {
  const safeChapterId = ensureChapterId(chapterId);
  const projectDir = resolveProjectDir(workspaceRoot, projectName);
  const chaptersDir = resolve(projectDir, 'chapters');
  const chapterPath = resolve(chaptersDir, `${safeChapterId}.md`);
  assertInside(chaptersDir, chapterPath);
  if (!existsSync(chapterPath)) {
    throw new Error(`Chapter not found: ${safeChapterId}`);
  }
  const content = readText(chapterPath);
  return {
    id: safeChapterId,
    filename: `${safeChapterId}.md`,
    title: firstHeading(content, `Chapter ${safeChapterId}`),
    content,
  };
}

export function updateNovelChapter(workspaceRoot, projectName, chapterId, content = '') {
  const safeChapterId = ensureChapterId(chapterId);
  const projectDir = resolveProjectDir(workspaceRoot, projectName);
  const chaptersDir = resolve(projectDir, 'chapters');
  const chapterPath = resolve(chaptersDir, `${safeChapterId}.md`);
  assertInside(chaptersDir, chapterPath);
  if (!existsSync(chapterPath)) {
    throw new Error(`Chapter not found: ${safeChapterId}`);
  }
  writeProjectText(chapterPath, content);
  return getNovelChapter(workspaceRoot, projectName, safeChapterId);
}

export function updateNovelMemoryFile(workspaceRoot, projectName, filePath, content = '') {
  const safePath = ensureMemoryFilePath(filePath);
  const projectDir = resolveProjectDir(workspaceRoot, projectName);
  const allowedRoot = resolve(projectDir, 'story_data');
  let targetPath;

  if (safePath === 'creator_guidance.md' || safePath === 'learned_rules.md') {
    targetPath = resolve(projectDir, safePath);
    assertInside(projectDir, targetPath);
  } else {
    const storyPath = safePath.startsWith('story_data/') ? safePath.slice('story_data/'.length) : safePath;
    targetPath = resolve(allowedRoot, storyPath);
    assertInside(allowedRoot, targetPath);
  }

  if (!existsSync(targetPath)) {
    throw new Error(`Memory file not found: ${safePath}`);
  }
  writeProjectText(targetPath, content);
  return {
    path: safePath,
    content: readText(targetPath),
  };
}

export function buildCodexPrompt({ projectName, guidance = '', nextChapter = null }) {
  const target = nextChapter ? `第 ${nextChapter} 章` : '下一章';
  const extra = guidance.trim() ? `\n\n用户补充要求：\n${guidance.trim()}` : '';
  return [
    `你正在维护 meta_writing 小说项目 ${projectName}。`,
    `请按手动工作流生成${target}：读取最近章节、creator_guidance.md、learned_rules.md 和 story_data；写入新的 chapters/<编号>.md；同步更新 chapter_summaries、characters、timeline、pacing 和 foreshadowing 等 Story Bible 文件。`,
    '必须遵守项目 README 的 Manual Chapter Workflow，不要切换 automatic 模式，不要提交 git commit。',
    extra,
  ].join('\n');
}

function normalizeCodexMode(mode) {
  return CODEX_ACTION_MODES.has(mode) ? mode : 'next_chapter';
}

function describeTargetDocument(targetDocument = null) {
  if (!targetDocument) return 'No reader document is selected.';
  return [
    `Document type: ${targetDocument.type || 'unknown'}`,
    targetDocument.id ? `Chapter id: ${targetDocument.id}` : null,
    targetDocument.path ? `Memory path: ${targetDocument.path}` : null,
    targetDocument.title ? `Title: ${targetDocument.title}` : null,
    targetDocument.filename ? `Filename: ${targetDocument.filename}` : null,
  ].filter(Boolean).join('\n');
}

function normalizeTargetDocument(targetDocument = null) {
  if (!targetDocument || typeof targetDocument !== 'object') return null;
  const type = targetDocument.type === 'chapter' ? 'chapter' : targetDocument.type === 'memory' ? 'memory' : null;
  if (!type) return null;
  if (type === 'chapter') {
    return {
      type,
      id: ensureChapterId(targetDocument.id),
      title: typeof targetDocument.title === 'string' ? targetDocument.title.slice(0, 200) : '',
      filename: typeof targetDocument.filename === 'string' ? targetDocument.filename.slice(0, 200) : `${targetDocument.id}.md`,
    };
  }
  return {
    type,
    path: ensureMemoryFilePath(targetDocument.path || targetDocument.id),
    title: typeof targetDocument.title === 'string' ? targetDocument.title.slice(0, 200) : '',
    filename: typeof targetDocument.filename === 'string' ? targetDocument.filename.slice(0, 200) : '',
  };
}

function inferCodexTarget({ mode = 'next_chapter', targetDocument = null, nextChapter = null }) {
  const normalizedMode = normalizeCodexMode(mode);
  const normalizedTarget = normalizeTargetDocument(targetDocument);
  if (normalizedMode === 'next_chapter') {
    const id = String(nextChapter || '').padStart(3, '0');
    return {
      type: 'chapter',
      id,
      title: `Chapter ${id}`,
      filename: `${id}.md`,
    };
  }
  if (normalizedMode === 'revise_document' && normalizedTarget) {
    return normalizedTarget;
  }
  if (normalizedTarget?.type === 'chapter') {
    return normalizedTarget;
  }
  if (normalizedTarget) return normalizedTarget;
  return {
    type: 'project',
    id: normalizedMode,
    title: normalizedMode,
  };
}

function codexSessionKey(target = null) {
  if (!target) return 'project:default';
  if (target.type === 'chapter') return `chapter:${ensureChapterId(target.id)}`;
  if (target.type === 'memory') return `memory:${ensureMemoryFilePath(target.path || target.id)}`;
  return `project:${String(target.id || 'default').replace(/[^a-zA-Z0-9_.:-]/g, '_').slice(0, 120)}`;
}

function codexSessionStorePath(projectDir) {
  return resolve(projectDir, CODEX_SESSION_STORE);
}

function loadCodexSessionStore(projectDir) {
  return readJsonObject(codexSessionStorePath(projectDir), { version: 1, sessions: {} });
}

function saveCodexSessionStore(projectDir, store) {
  writeJson(codexSessionStorePath(projectDir), {
    version: 1,
    sessions: store?.sessions || {},
  });
}

function serializeCodexJob(job) {
  if (!job) return null;
  return {
    id: job.id,
    projectName: job.projectName,
    projectSlug: job.projectSlug,
    status: job.status,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    exitCode: job.exitCode,
    guidance: job.guidance,
    mode: job.mode,
    targetDocument: job.targetDocument,
    targetKey: job.targetKey,
    nextChapter: job.nextChapter,
    runtimeSessionId: job.runtimeSessionId || null,
    messages: job.messages || [],
    output: job.output || '',
    trace: job.trace || '',
    error: job.error || '',
  };
}

function persistCodexJob(projectDir, job) {
  if (!projectDir || !job?.targetKey) return;
  const store = loadCodexSessionStore(projectDir);
  const previous = store.sessions?.[job.targetKey] || {};
  store.sessions = {
    ...(store.sessions || {}),
    [job.targetKey]: {
      ...previous,
      key: job.targetKey,
      target: job.codexTarget || job.targetDocument || null,
      runtimeSessionId: job.runtimeSessionId || previous.runtimeSessionId || null,
      lastJob: serializeCodexJob(job),
      updatedAt: new Date().toISOString(),
    },
  };
  saveCodexSessionStore(projectDir, store);
}

function loadCodexSessionEntry(projectDir, targetKey) {
  const store = loadCodexSessionStore(projectDir);
  return store.sessions?.[targetKey] || null;
}

function hydrateCodexSessionEntry(entry, key) {
  if (!entry) return null;
  const lastJob = entry.lastJob || null;
  if (!lastJob?.id) return { ...entry, key };
  const liveJob = jobs.get(lastJob.id);
  if (liveJob) {
    return {
      ...entry,
      key,
      runtimeSessionId: liveJob.runtimeSessionId || entry.runtimeSessionId || null,
      lastJob: serializeCodexJob(liveJob),
    };
  }
  if (lastJob.status === 'running' || lastJob.status === 'queued') {
    return {
      ...entry,
      key,
      lastJob: {
        ...lastJob,
        status: 'interrupted',
        finishedAt: lastJob.finishedAt || new Date().toISOString(),
        messages: [
          ...(lastJob.messages || []),
          {
            at: new Date().toISOString(),
            role: 'assistant',
            source: 'system',
            content: 'Codex job was interrupted before completion. Start a new request to resume this saved session.',
          },
        ].slice(-MAX_JOB_MESSAGES),
      },
    };
  }
  return { ...entry, key };
}

export function getNovelCodexSession(workspaceRoot, projectName, targetDocument = null) {
  const projectDir = resolveProjectDir(workspaceRoot, projectName);
  const target = inferCodexTarget({ mode: 'revise_document', targetDocument });
  const key = codexSessionKey(target);
  const entry = loadCodexSessionEntry(projectDir, key);
  const hydrated = hydrateCodexSessionEntry(entry, key);
  return hydrated || { key, target, runtimeSessionId: null, lastJob: null };
}

function buildProjectScopedCodexPrompt({
  projectName,
  projectSlug,
  projectDir,
  guidance = '',
  nextChapter = null,
  mode = 'next_chapter',
  targetDocument = null,
}) {
  const target = nextChapter ? `chapter ${nextChapter}` : 'the next chapter';
  const extra = guidance.trim() ? `\n\nUser guidance:\n${guidance.trim()}` : '';
  const normalizedMode = normalizeCodexMode(mode);
  const shared = [
    `You are maintaining the meta_writing novel project "${projectName}".`,
    `Target project slug: ${projectSlug}`,
    `Target project directory: ${projectDir}`,
    'Only read and modify this target project.',
    'Do not use characters, Story Bible files, chapters, or plot requirements from sibling novel projects.',
    'If the user guidance clearly belongs to a different project, stop and say the project selector must be changed before writing.',
    'Do not switch to automatic mode. Do not create a git commit.',
    'When running Python snippets or YAML validation commands, use python3, not python.',
    '',
    'Reader document context:',
    describeTargetDocument(targetDocument),
  ];

  const actionInstructions = {
    next_chapter: [
      `Generate ${target} with the Manual Chapter Workflow.`,
      'Read the latest chapters, creator_guidance.md, learned_rules.md, and story_data.',
      'Write the new chapters/<number>.md file.',
      'Update chapter_summaries, characters, timeline, pacing, foreshadowing, and other Story Bible files as needed.',
    ],
    revise_document: [
      'Revise only the document currently selected in the reader.',
      'If it is a chapter, edit the corresponding chapters/<id>.md file.',
      'If it is a memory file, edit that exact project memory file.',
      'Keep the project scope strict and summarize what changed in the final output.',
    ],
    plan: [
      'Plan mode: do not modify files.',
      'Return a concise but concrete plan for the requested writing work.',
      'Include target files, chapter goals, continuity risks, and a recommended execution order.',
    ],
    story_bible: [
      'Story Bible only mode: do not write or rewrite chapter prose.',
      'Update only project memory files under story_data plus creator_guidance.md or learned_rules.md when needed.',
      'Focus on worldview, characters, timeline, pacing, foreshadowing, continuity, and learned rules.',
    ],
  };

  return [
    ...shared,
    '',
    `Action mode: ${normalizedMode}`,
    ...actionInstructions[normalizedMode],
    extra,
  ].filter(Boolean).join('\n');
}

function parseCodexArgs(rawArgs) {
  if (!rawArgs || !rawArgs.trim()) return DEFAULT_CODEX_ARGS;
  return rawArgs.match(/"[^"]+"|'[^']+'|\S+/g)?.map((part) => part.replace(/^['"]|['"]$/g, '')) || DEFAULT_CODEX_ARGS;
}

function appendJobMessage(job, message) {
  job.messages.push({
    at: new Date().toISOString(),
    ...message,
  });
  if (job.messages.length > MAX_JOB_MESSAGES) {
    job.messages = job.messages.slice(-MAX_JOB_MESSAGES);
  }
}

function stripAnsi(value) {
  return value.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '');
}

function compactStreamText(value, limit = MAX_VISIBLE_TRACE_LENGTH) {
  const text = stripAnsi(String(value || '')).trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, limit).trimEnd()}\n\n[truncated ${text.length - limit} chars from live process output]`;
}

function isErrorLikeStderr(value) {
  return /\b(error|fatal|exception|traceback|panic|failed|permission denied|not found|enoent|eacces)\b/i.test(value);
}

function hasArg(args, name) {
  return args.some((arg) => arg === name || arg.startsWith(`${name}=`));
}

function shouldUseCodexJson(args, env = process.env) {
  if (env.NOVEL_CODEX_JSON === '0' || env.NOVEL_CODEX_JSON === 'false') return false;
  return args[0] === 'exec';
}

function buildCodexArgs({ rawArgs, prompt, runtimeSessionId = null, env = process.env }) {
  const args = parseCodexArgs(rawArgs);
  const useJson = shouldUseCodexJson(args, env);
  if (useJson && !hasArg(args, '--json')) {
    args.push('--json');
  }
  if (runtimeSessionId && args[0] === 'exec') {
    return {
      args: [...args, 'resume', runtimeSessionId, prompt],
      useJson,
      resumed: true,
    };
  }
  return {
    args: [...args, prompt],
    useJson,
    resumed: false,
  };
}

function findRuntimeSessionId(value) {
  if (!value || typeof value !== 'object') return null;
  for (const key of ['session_id', 'sessionId', 'sessionID', 'thread_id', 'threadId', 'conversation_id', 'conversationId']) {
    if (typeof value[key] === 'string' && value[key].trim()) return value[key].trim();
  }
  for (const nested of Object.values(value)) {
    if (nested && typeof nested === 'object') {
      const found = findRuntimeSessionId(nested);
      if (found) return found;
    }
  }
  return null;
}

function extractCodexEventText(event) {
  if (!event || typeof event !== 'object') return '';
  const type = String(event.type || event.event || '');
  const candidates = [
    event.text,
    event.delta,
    event.content,
    event.message,
    event.data?.text,
    event.data?.delta,
    event.data?.content,
    event.data?.message,
    event.item?.text,
    event.item?.content,
    event.msg?.text,
    event.msg?.content,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
  }
  if (Array.isArray(event.content)) {
    return event.content
      .map((item) => (typeof item === 'string' ? item : item?.text || item?.content || ''))
      .filter(Boolean)
      .join('\n');
  }
  if (/error|failed/i.test(type) && typeof event.error === 'string') return event.error;
  return '';
}

function handleCodexJsonLine({ line, job, projectDir }) {
  let event;
  try {
    event = JSON.parse(line);
  } catch {
    job.output = `${job.output}${line}\n`.slice(-MAX_JOB_TEXT_LENGTH);
    appendJobMessage(job, { role: 'assistant', source: 'stdout', content: compactStreamText(line, 2200) });
    persistCodexJob(projectDir, job);
    return;
  }

  const sessionId = findRuntimeSessionId(event);
  if (sessionId && sessionId !== job.runtimeSessionId) {
    job.runtimeSessionId = sessionId;
  }

  const type = String(event.type || event.event || '');
  const text = extractCodexEventText(event);
  if (text) {
    const source = /error|failed/i.test(type) ? 'stderr' : 'stdout';
    if (source === 'stderr') {
      job.error = `${job.error}${text}\n`.slice(-MAX_JOB_TEXT_LENGTH);
    } else {
      job.output = `${job.output}${text}\n`.slice(-MAX_JOB_TEXT_LENGTH);
    }
    appendJobMessage(job, { role: 'assistant', source, content: compactStreamText(text, 2200) });
  } else {
    job.trace = `${job.trace}${line}\n`.slice(-MAX_JOB_TEXT_LENGTH);
    appendJobMessage(job, { role: 'assistant', source: 'trace', content: compactStreamText(line) });
  }
  persistCodexJob(projectDir, job);
}

function handleCodexJsonChunk({ chunk, job, projectDir }) {
  job._jsonBuffer = `${job._jsonBuffer || ''}${chunk}`;
  const lines = job._jsonBuffer.split(/\r?\n/);
  job._jsonBuffer = lines.pop() || '';
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed) handleCodexJsonLine({ line: trimmed, job, projectDir });
  }
}

export function startCodexGeneration({
  workspaceRoot,
  projectName,
  guidance = '',
  mode = 'next_chapter',
  targetDocument = null,
  env = process.env,
}) {
  const projectDir = resolveProjectDir(workspaceRoot, projectName);
  const project = getNovelProject(workspaceRoot, projectName);
  const projectSlug = basename(projectDir);
  const latestNumber = Math.max(0, ...project.chapters.map((chapter) => Number.parseInt(chapter.id, 10)).filter(Number.isFinite));
  const codexTarget = inferCodexTarget({
    mode,
    targetDocument,
    nextChapter: latestNumber + 1,
  });
  const targetKey = codexSessionKey(codexTarget);
  const existingSession = loadCodexSessionEntry(projectDir, targetKey);
  const runtimeSessionId = existingSession?.runtimeSessionId || null;
  const prompt = buildProjectScopedCodexPrompt({
    projectName: project.name,
    projectSlug,
    projectDir,
    guidance,
    nextChapter: latestNumber + 1,
    mode,
    targetDocument: normalizeTargetDocument(targetDocument),
  });
  const jobId = randomUUID();
  const job = {
    id: jobId,
    projectName: project.name,
    projectSlug,
    status: 'running',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    exitCode: null,
    guidance,
    mode: normalizeCodexMode(mode),
    targetDocument: normalizeTargetDocument(targetDocument),
    codexTarget,
    targetKey,
    nextChapter: latestNumber + 1,
    runtimeSessionId,
    resumedFromSessionId: runtimeSessionId,
    messages: [],
    output: '',
    trace: '',
    error: '',
    _projectDir: projectDir,
    _jsonBuffer: '',
  };
  appendJobMessage(job, {
    role: 'user',
    source: 'request',
    content: guidance.trim() || `Generate chapter ${latestNumber + 1}.`,
  });
  appendJobMessage(job, {
    role: 'assistant',
    source: 'system',
    content: runtimeSessionId ? `Resuming Codex session ${runtimeSessionId} in ${projectDir}` : `Starting Codex in ${projectDir}`,
  });
  jobs.set(jobId, job);
  persistCodexJob(projectDir, job);

  const codexBin = env.CODEX_BIN || 'codex';
  const { args: codexArgs, useJson } = buildCodexArgs({
    rawArgs: env.NOVEL_CODEX_ARGS,
    prompt,
    runtimeSessionId,
    env,
  });
  const child = spawn(codexBin, codexArgs, {
    cwd: projectDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...env,
      OPENAI_API_KEY: env.OPENAI_API_KEY || env.CODEX_API_KEY || env.CRS_API_KEY || '',
      CODEX_HOME: env.CODEX_HOME || join(env.HOME || process.cwd(), '.codex'),
    },
    windowsHide: true,
  });

  child.stdout.on('data', (chunk) => {
    const content = chunk.toString();
    if (useJson) {
      handleCodexJsonChunk({ chunk: content, job, projectDir });
      return;
    }
    job.output = `${job.output}${content}`.slice(-MAX_JOB_TEXT_LENGTH);
    appendJobMessage(job, { role: 'assistant', source: 'stdout', content: compactStreamText(content, 2200) });
    persistCodexJob(projectDir, job);
  });
  child.stderr.on('data', (chunk) => {
    const content = chunk.toString();
    if (isErrorLikeStderr(content)) {
      job.error = `${job.error}${content}`.slice(-MAX_JOB_TEXT_LENGTH);
      appendJobMessage(job, { role: 'assistant', source: 'stderr', content: compactStreamText(content, 2200) });
      persistCodexJob(projectDir, job);
      return;
    }
    job.trace = `${job.trace}${content}`.slice(-MAX_JOB_TEXT_LENGTH);
    appendJobMessage(job, { role: 'assistant', source: 'trace', content: compactStreamText(content) });
    persistCodexJob(projectDir, job);
  });
  child.on('error', (error) => {
    job.status = 'failed';
    job.finishedAt = new Date().toISOString();
    job.error = `${job.error}\n${error.message}`.trim();
    appendJobMessage(job, { role: 'assistant', source: 'error', content: error.message });
    persistCodexJob(projectDir, job);
  });
  child.on('close', (code) => {
    if (useJson && job._jsonBuffer?.trim()) {
      handleCodexJsonLine({ line: job._jsonBuffer.trim(), job, projectDir });
    }
    job.status = code === 0 ? 'completed' : 'failed';
    job.exitCode = code;
    job.finishedAt = new Date().toISOString();
    appendJobMessage(job, {
      role: 'assistant',
      source: 'system',
      content: code === 0 ? 'Codex finished successfully.' : `Codex exited with code ${code}.`,
    });
    delete job._jsonBuffer;
    persistCodexJob(projectDir, job);
  });

  return job;
}

export function getCodexJob(jobId) {
  const job = jobs.get(jobId) || null;
  return job ? serializeCodexJob(job) : null;
}
