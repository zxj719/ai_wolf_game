import { describe, expect, it, afterEach } from 'vitest';
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createNovelProject,
  getCodexJob,
  getNovelCodexSession,
  getNovelChapter,
  getNovelProject,
  listNovelProjects,
  resolveProjectDir,
  startCodexGeneration,
  updateNovelChapter,
  updateNovelMemoryFile,
} from '../novelWorkspace.js';

const tempRoots = [];

function makeWorkspace() {
  const root = mkdtempSync(join(tmpdir(), 'novel-workspace-'));
  tempRoots.push(root);
  const project = join(root, 'novels', 'alpha');
  mkdirSync(join(project, 'chapters'), { recursive: true });
  mkdirSync(join(project, 'story_data', 'characters'), { recursive: true });
  mkdirSync(join(project, 'story_data', 'chapter_summaries'), { recursive: true });
  writeFileSync(
    join(project, '.meta-writing-project.json'),
    JSON.stringify({ name: 'alpha', workflow_mode: 'manual' }),
    'utf8',
  );
  writeFileSync(join(project, 'creator_guidance.md'), '# Creator\nKeep it intimate.', 'utf8');
  writeFileSync(join(project, 'learned_rules.md'), '# Rules\n- No fake cliffhangers.', 'utf8');
  writeFileSync(join(project, 'chapters', '001.md'), '# 第一章\n\nA quiet opening.', 'utf8');
  writeFileSync(join(project, 'chapters', '002.md'), '# 第二章\n\nA sharper turn.', 'utf8');
  writeFileSync(join(project, 'story_data', 'story_core.yaml'), 'current_chapter: 2\nhook: test\n', 'utf8');
  writeFileSync(join(project, 'story_data', 'characters', 'Lin.yaml'), 'name: Lin\nstate: wary\n', 'utf8');
  writeFileSync(join(project, 'story_data', 'chapter_summaries', '002.yaml'), 'summary: sharper turn\n', 'utf8');
  return root;
}

afterEach(() => {
  while (tempRoots.length) {
    rmSync(tempRoots.pop(), { recursive: true, force: true });
  }
});

describe('novelWorkspace', () => {
  it('lists projects with chapter counts and active metadata', () => {
    const root = makeWorkspace();

    const projects = listNovelProjects(root);

    expect(projects).toEqual([
      expect.objectContaining({
        name: 'alpha',
        workflowMode: 'manual',
        chapterCount: 2,
        latestChapter: '002',
      }),
    ]);
  });

  it('loads a project with ordered chapters and story bible files', () => {
    const root = makeWorkspace();

    const project = getNovelProject(root, 'alpha');

    expect(project.chapters.map((chapter) => chapter.id)).toEqual(['001', '002']);
    expect(project.chapters[1]).toMatchObject({ title: '第二章', excerpt: 'A sharper turn.' });
    expect(project.storyBible.sections.map((section) => section.name)).toContain('story_core.yaml');
    expect(project.storyBible.sections.map((section) => section.name)).toContain('characters/Lin.yaml');
    expect(project.creatorGuidance).toContain('Keep it intimate.');
    expect(project.learnedRules).toContain('No fake cliffhangers.');
  });

  it('loads a chapter without allowing path traversal', () => {
    const root = makeWorkspace();

    expect(getNovelChapter(root, 'alpha', '002')).toMatchObject({
      id: '002',
      title: '第二章',
      content: expect.stringContaining('A sharper turn.'),
    });
    expect(() => resolveProjectDir(root, '../secret')).toThrow(/Invalid project name/);
    expect(() => getNovelChapter(root, 'alpha', '../002')).toThrow(/Invalid chapter id/);
  });

  it('creates new projects with initial story bible files', () => {
    const root = mkdtempSync(join(tmpdir(), 'novel-workspace-'));
    tempRoots.push(root);

    const project = createNovelProject(root, {
      name: 'New Story',
      slug: 'new-story',
      worldview: 'A moonlit city.',
      style: 'Quiet and sharp.',
      concept: 'A rescue that becomes a haunting.',
      outline: 'Chapter one opens with a bargain.',
    });

    expect(project).toMatchObject({
      name: 'New Story',
      slug: 'new-story',
      workflowMode: 'manual',
    });
    expect(project.chapters).toEqual([]);
    expect(project.storyBible.sections.map((section) => section.name)).toContain('story_bible.md');
    expect(project.storyBible.sections.find((section) => section.name === 'story_bible.md')?.content).toContain('A moonlit city.');
    expect(() => createNovelProject(root, { name: 'New Story', slug: 'new-story' })).toThrow(/already exists/);
  });

  it('updates chapter and project memory files without path traversal', () => {
    const root = makeWorkspace();

    const chapter = updateNovelChapter(root, 'alpha', '002', '# Revised\n\nManual edit.');
    expect(chapter).toMatchObject({
      id: '002',
      title: 'Revised',
      content: expect.stringContaining('Manual edit.'),
    });

    const memory = updateNovelMemoryFile(root, 'alpha', 'story_core.yaml', 'current_chapter: 3\n');
    expect(memory).toEqual({ path: 'story_core.yaml', content: 'current_chapter: 3\n' });
    expect(getNovelProject(root, 'alpha').storyBible.sections.find((section) => section.name === 'story_core.yaml')?.content)
      .toContain('current_chapter: 3');

    expect(() => updateNovelMemoryFile(root, 'alpha', '../secret.md', 'nope')).toThrow(/Invalid memory file path/);
  });

  it('starts Codex jobs with stdin closed so exec mode does not hang waiting for input', async () => {
    const root = makeWorkspace();
    const scriptPath = join(root, 'fake-codex.js');
    writeFileSync(
      scriptPath,
      [
        "process.stdin.resume();",
        "process.stdin.on('end', () => {",
        "  console.log('stdin-closed');",
        "});",
      ].join('\n'),
      'utf8',
    );

    const job = startCodexGeneration({
      workspaceRoot: root,
      projectName: 'alpha',
      guidance: 'Keep the next chapter quiet.',
      env: {
        ...process.env,
        CODEX_BIN: process.execPath,
        NOVEL_CODEX_ARGS: `"${scriptPath}"`,
      },
    });

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const current = getCodexJob(job.id);
      if (current?.status !== 'running') break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    const finished = getCodexJob(job.id);
    expect(finished).toMatchObject({ status: 'completed', exitCode: 0 });
    expect(finished.output).toContain('stdin-closed');
    expect(finished.messages.map((message) => message.source)).toContain('stdout');
  });

  it('keeps non-error Codex stderr as trace output and scopes prompts to the selected project', async () => {
    const root = makeWorkspace();
    const scriptPath = join(root, 'fake-codex-trace.js');
    writeFileSync(
      scriptPath,
      [
        "const prompt = process.argv.at(-1);",
        "process.stderr.write('model thinking preview\\n');",
        "console.log(prompt);",
      ].join('\n'),
      'utf8',
    );

    const job = startCodexGeneration({
      workspaceRoot: root,
      projectName: 'alpha',
      guidance: 'Use only this project.',
      env: {
        ...process.env,
        CODEX_BIN: process.execPath,
        NOVEL_CODEX_ARGS: `"${scriptPath}"`,
      },
    });

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const current = getCodexJob(job.id);
      if (current?.status !== 'running') break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    const finished = getCodexJob(job.id);
    expect(finished).toMatchObject({ status: 'completed', exitCode: 0, projectSlug: 'alpha' });
    expect(finished.output).toContain('Target project slug: alpha');
    expect(finished.output).toContain('Action mode: next_chapter');
    expect(finished.output).toContain('sibling novel projects');
    expect(finished.trace).toContain('model thinking preview');
    expect(finished.error).toBe('');
    expect(finished.messages.map((message) => message.source)).toContain('trace');
    expect(finished.messages.map((message) => message.source)).not.toContain('stderr');
  });

  it('supports Codex plan mode without file-write instructions', async () => {
    const root = makeWorkspace();
    const scriptPath = join(root, 'fake-codex-plan.js');
    writeFileSync(
      scriptPath,
      [
        "const prompt = process.argv.at(-1);",
        "console.log(prompt);",
      ].join('\n'),
      'utf8',
    );

    const job = startCodexGeneration({
      workspaceRoot: root,
      projectName: 'alpha',
      guidance: 'Plan the next two chapters.',
      mode: 'plan',
      targetDocument: { type: 'chapter', id: '002', title: '第二章', filename: '002.md' },
      env: {
        ...process.env,
        CODEX_BIN: process.execPath,
        NOVEL_CODEX_ARGS: `"${scriptPath}"`,
      },
    });

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const current = getCodexJob(job.id);
      if (current?.status !== 'running') break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    const finished = getCodexJob(job.id);
    expect(finished).toMatchObject({ status: 'completed', mode: 'plan' });
    expect(finished.output).toContain('Action mode: plan');
    expect(finished.output).toContain('Plan mode: do not modify files.');
    expect(finished.output).toContain('Chapter id: 002');
    expect(finished.output).toContain('Plan the next two chapters.');
  });

  it('persists per-chapter Codex jobs and resumes the saved runtime session', async () => {
    const root = makeWorkspace();
    const scriptPath = join(root, 'fake-codex-json.js');
    const argsPath = join(root, 'codex-args.jsonl');
    writeFileSync(
      scriptPath,
      [
        "#!/usr/bin/env node",
        "const fs = require('node:fs');",
        `fs.appendFileSync(${JSON.stringify(argsPath)}, JSON.stringify(process.argv.slice(2)) + '\\n');`,
        "console.log(JSON.stringify({ type: 'session.created', session_id: 'novel-session-002' }));",
        "console.log(JSON.stringify({ type: 'message', text: 'Edited chapter 2.' }));",
      ].join('\n'),
      'utf8',
    );
    chmodSync(scriptPath, 0o755);

    const first = startCodexGeneration({
      workspaceRoot: root,
      projectName: 'alpha',
      guidance: 'Revise chapter 2.',
      mode: 'revise_document',
      targetDocument: { type: 'chapter', id: '002', title: '第二章', filename: '002.md' },
      env: {
        ...process.env,
        CODEX_BIN: scriptPath,
        NOVEL_CODEX_ARGS: 'exec',
      },
    });

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const current = getCodexJob(first.id);
      if (current?.status !== 'running') break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    const finished = getCodexJob(first.id);
    expect(finished).toMatchObject({
      status: 'completed',
      targetKey: 'chapter:002',
      runtimeSessionId: 'novel-session-002',
    });
    expect(finished.output).toContain('Edited chapter 2.');

    const session = getNovelCodexSession(root, 'alpha', { type: 'chapter', id: '002', title: '第二章', filename: '002.md' });
    expect(session).toMatchObject({
      key: 'chapter:002',
      runtimeSessionId: 'novel-session-002',
      lastJob: expect.objectContaining({ id: first.id, status: 'completed' }),
    });
    expect(existsSync(join(root, 'novels', 'alpha', '.codex-sessions.json'))).toBe(true);

    const second = startCodexGeneration({
      workspaceRoot: root,
      projectName: 'alpha',
      guidance: 'Continue this chapter.',
      mode: 'revise_document',
      targetDocument: { type: 'chapter', id: '002', title: '第二章', filename: '002.md' },
      env: {
        ...process.env,
        CODEX_BIN: scriptPath,
        NOVEL_CODEX_ARGS: 'exec',
      },
    });

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const current = getCodexJob(second.id);
      if (current?.status !== 'running') break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    const invocations = readFileSync(argsPath, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    expect(invocations.at(0)).toContain('--json');
    expect(invocations.at(1)).toEqual(expect.arrayContaining(['--json', 'resume', 'novel-session-002']));
  });

  it('stores next-chapter generation under the new chapter key, not the selected reader chapter', async () => {
    const root = makeWorkspace();
    const scriptPath = join(root, 'fake-codex-next-json.js');
    writeFileSync(
      scriptPath,
      [
        "#!/usr/bin/env node",
        "console.log(JSON.stringify({ type: 'session.created', session_id: 'novel-session-003' }));",
        "console.log(JSON.stringify({ type: 'message', text: 'Drafted chapter 3.' }));",
      ].join('\n'),
      'utf8',
    );
    chmodSync(scriptPath, 0o755);

    const job = startCodexGeneration({
      workspaceRoot: root,
      projectName: 'alpha',
      guidance: 'Generate the next chapter after chapter 2.',
      mode: 'next_chapter',
      targetDocument: { type: 'chapter', id: '002', title: '第二章', filename: '002.md' },
      env: {
        ...process.env,
        CODEX_BIN: scriptPath,
        NOVEL_CODEX_ARGS: 'exec',
      },
    });

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const current = getCodexJob(job.id);
      if (current?.status !== 'running') break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    const finished = getCodexJob(job.id);
    expect(finished).toMatchObject({
      status: 'completed',
      targetKey: 'chapter:003',
      runtimeSessionId: 'novel-session-003',
    });

    const newChapterSession = getNovelCodexSession(root, 'alpha', { type: 'chapter', id: '003', title: 'Chapter 003', filename: '003.md' });
    expect(newChapterSession).toMatchObject({
      key: 'chapter:003',
      runtimeSessionId: 'novel-session-003',
    });
    const previousChapterSession = getNovelCodexSession(root, 'alpha', { type: 'chapter', id: '002', title: '第二章', filename: '002.md' });
    expect(previousChapterSession.lastJob).toBeNull();
  });

  it('marks saved running jobs as interrupted when no live job exists', () => {
    const root = makeWorkspace();
    writeFileSync(
      join(root, 'novels', 'alpha', '.codex-sessions.json'),
      JSON.stringify({
        version: 1,
        sessions: {
          'chapter:002': {
            key: 'chapter:002',
            target: { type: 'chapter', id: '002', title: '第二章', filename: '002.md' },
            runtimeSessionId: 'novel-session-stale',
            lastJob: {
              id: 'stale-job',
              status: 'running',
              messages: [{ role: 'assistant', source: 'stdout', content: 'partial draft' }],
            },
          },
        },
      }),
      'utf8',
    );

    const session = getNovelCodexSession(root, 'alpha', { type: 'chapter', id: '002', title: '第二章', filename: '002.md' });

    expect(session).toMatchObject({
      key: 'chapter:002',
      runtimeSessionId: 'novel-session-stale',
      lastJob: expect.objectContaining({ status: 'interrupted' }),
    });
    expect(session.lastJob.messages.at(-1).content).toContain('interrupted');
  });
});
