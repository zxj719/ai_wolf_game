import { describe, expect, it, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  getCodexJob,
  getNovelChapter,
  getNovelProject,
  listNovelProjects,
  resolveProjectDir,
  startCodexGeneration,
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
});
