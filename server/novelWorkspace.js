import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';

const PROJECT_NAME_RE = /^[\p{L}\p{N}._-]+$/u;
const CHAPTER_ID_RE = /^[\p{L}\p{N}._-]+$/u;
const DEFAULT_CODEX_ARGS = ['exec', '--full-auto', '--skip-git-repo-check'];
const jobs = new Map();

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

function parseCodexArgs(rawArgs) {
  if (!rawArgs || !rawArgs.trim()) return DEFAULT_CODEX_ARGS;
  return rawArgs.match(/"[^"]+"|'[^']+'|\S+/g)?.map((part) => part.replace(/^['"]|['"]$/g, '')) || DEFAULT_CODEX_ARGS;
}

export function startCodexGeneration({ workspaceRoot, projectName, guidance = '', env = process.env }) {
  const projectDir = resolveProjectDir(workspaceRoot, projectName);
  const project = getNovelProject(workspaceRoot, projectName);
  const latestNumber = Math.max(0, ...project.chapters.map((chapter) => Number.parseInt(chapter.id, 10)).filter(Number.isFinite));
  const prompt = buildCodexPrompt({ projectName: project.name, guidance, nextChapter: latestNumber + 1 });
  const jobId = randomUUID();
  const job = {
    id: jobId,
    projectName: project.name,
    status: 'running',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    exitCode: null,
    output: '',
    error: '',
  };
  jobs.set(jobId, job);

  const codexBin = env.CODEX_BIN || 'codex';
  const codexArgs = [...parseCodexArgs(env.NOVEL_CODEX_ARGS), prompt];
  const child = spawn(codexBin, codexArgs, {
    cwd: projectDir,
    env: {
      ...env,
      OPENAI_API_KEY: env.OPENAI_API_KEY || env.CODEX_API_KEY || env.CRS_API_KEY || '',
      CODEX_HOME: env.CODEX_HOME || join(env.HOME || process.cwd(), '.codex'),
    },
    windowsHide: true,
  });

  child.stdout.on('data', (chunk) => {
    job.output = `${job.output}${chunk.toString()}`.slice(-20000);
  });
  child.stderr.on('data', (chunk) => {
    job.error = `${job.error}${chunk.toString()}`.slice(-20000);
  });
  child.on('error', (error) => {
    job.status = 'failed';
    job.finishedAt = new Date().toISOString();
    job.error = `${job.error}\n${error.message}`.trim();
  });
  child.on('close', (code) => {
    job.status = code === 0 ? 'completed' : 'failed';
    job.exitCode = code;
    job.finishedAt = new Date().toISOString();
  });

  return job;
}

export function getCodexJob(jobId) {
  return jobs.get(jobId) || null;
}
