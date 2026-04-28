import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NovelWorkspaceView } from '../NovelWorkspace.jsx';

describe('NovelWorkspaceView', () => {
  it('renders user context, chapters, selected content, and story bible', () => {
    const html = renderToStaticMarkup(
      <NovelWorkspaceView
        user={{ username: 'xingj' }}
        loading={false}
        error=""
        projects={[
          { name: 'alpha', workflowMode: 'manual', chapterCount: 2, latestChapter: '002' },
        ]}
        selectedProject="alpha"
        project={{
          name: 'alpha',
          workflowMode: 'manual',
          chapters: [
            { id: '001', title: '第一章', excerpt: 'A quiet opening.' },
            { id: '002', title: '第二章', excerpt: 'A sharper turn.' },
          ],
          storyBible: {
            sections: [
              { name: 'story_core.yaml', content: 'current_chapter: 2' },
            ],
          },
          creatorGuidance: 'Keep it intimate.',
          learnedRules: 'No fake cliffhangers.',
        }}
        selectedChapter={{ id: '002', title: '第二章', content: '# 第二章\n\nA sharper turn.' }}
        guidance=""
        job={null}
        busy={false}
        onBack={() => {}}
        onSelectProject={() => {}}
        onSelectChapter={() => {}}
        onGuidanceChange={() => {}}
        onGenerate={() => {}}
        onRefresh={() => {}}
      />,
    );

    expect(html).toContain('xingj');
    expect(html).toContain('alpha');
    expect(html).toContain('第二章');
    expect(html).toContain('A sharper turn.');
    expect(html).toContain('Story Bible');
    expect(html).toContain('story_core.yaml');
    expect(html).toContain('Active project');
    expect(html).toContain('Target project');
    expect(html).toContain('Codex conversation');
  });

  it('hides Codex trace and system messages from the conversation UI', () => {
    const html = renderToStaticMarkup(
      <NovelWorkspaceView
        user={{ username: 'xingj' }}
        loading={false}
        error=""
        projects={[{ name: 'alpha', slug: 'alpha', workflowMode: 'manual', chapterCount: 2 }]}
        selectedProject="alpha"
        project={{
          name: 'alpha',
          slug: 'alpha',
          workflowMode: 'manual',
          chapters: [],
          storyBible: { sections: [] },
          creatorGuidance: '',
          learnedRules: '',
        }}
        selectedChapter={null}
        guidance=""
        job={{
          id: 'job-1',
          projectName: 'alpha',
          projectSlug: 'alpha',
          status: 'running',
          messages: [
            { role: 'assistant', source: 'system', content: 'Starting Codex in project dir' },
            { role: 'assistant', source: 'trace', content: 'model thinking preview' },
            { role: 'assistant', source: 'stdout', content: 'Drafted chapter 3.' },
          ],
        }}
        busy={false}
        onBack={() => {}}
        onSelectProject={() => {}}
        onSelectChapter={() => {}}
        onGuidanceChange={() => {}}
        onGenerate={() => {}}
        onRefresh={() => {}}
      />,
    );

    expect(html).toContain('Drafted chapter 3.');
    expect(html).not.toContain('Codex trace');
    expect(html).not.toContain('model thinking preview');
    expect(html).not.toContain('Starting Codex in project dir');
    expect(html).not.toContain('Codex error');
  });

  it('renders shelf and new-book pages as separate workspace pages', () => {
    const shelf = renderToStaticMarkup(
      <NovelWorkspaceView
        user={{ username: 'xingj' }}
        loading={false}
        error=""
        projects={[{ name: 'alpha', slug: 'alpha', workflowMode: 'manual', chapterCount: 2, latestChapter: '002' }]}
        selectedProject=""
        project={null}
        selectedChapter={null}
        guidance=""
        job={null}
        busy={false}
        view="shelf"
        onBack={() => {}}
        onSelectProject={() => {}}
        onGuidanceChange={() => {}}
        onGenerate={() => {}}
        onRefresh={() => {}}
      />,
    );
    expect(shelf).toContain('Novel shelf');
    expect(shelf).toContain('Add new book');

    const creator = renderToStaticMarkup(
      <NovelWorkspaceView
        user={{ username: 'xingj' }}
        loading={false}
        error=""
        projects={[]}
        selectedProject=""
        project={null}
        selectedChapter={null}
        guidance=""
        job={null}
        busy={false}
        view="new"
        bookDraft={{ name: 'new story', slug: 'new-story', worldview: '', style: '', concept: '', outline: '' }}
        onBack={() => {}}
        onSelectProject={() => {}}
        onGuidanceChange={() => {}}
        onGenerate={() => {}}
        onRefresh={() => {}}
      />,
    );
    expect(creator).toContain('New book');
    expect(creator).toContain('Worldview');
    expect(creator).toContain('Create and generate chapter 1');
  });

  it('renders markdown documents in reading mode with edit and md export actions', () => {
    const html = renderToStaticMarkup(
      <NovelWorkspaceView
        user={{ username: 'xingj' }}
        loading={false}
        error=""
        projects={[{ name: 'alpha', slug: 'alpha', workflowMode: 'manual', chapterCount: 1 }]}
        selectedProject="alpha"
        project={{
          name: 'alpha',
          slug: 'alpha',
          workflowMode: 'manual',
          chapters: [{ id: '001', title: 'Chapter 1', excerpt: 'Opening.' }],
          storyBible: {
            sections: [
              { name: 'story_bible.md', content: '# Bible\n\nWorld.' },
              { name: 'chapter_summaries/001.yaml', content: 'summary: Opening.' },
            ],
          },
          creatorGuidance: '',
          learnedRules: '',
        }}
        selectedDocument={{
          type: 'chapter',
          id: '001',
          key: 'chapter:001',
          title: 'Chapter 1',
          filename: '001.md',
          content: '# Chapter 1\n\nOpening.',
          group: 'Chapters',
          downloadable: true,
          editable: true,
        }}
        draftContent="# Chapter 1\n\nOpening."
        guidance=""
        job={null}
        busy={false}
        onBack={() => {}}
        onSelectProject={() => {}}
        onSelectChapter={() => {}}
        onGuidanceChange={() => {}}
        onGenerate={() => {}}
        onRefresh={() => {}}
      />,
    );

    expect(html).toContain('Story Bible');
    expect(html).toContain('Summaries');
    expect(html).toContain('chapter_summaries/001.yaml');
    expect(html).toContain('Chapter 1');
    expect(html).toContain('Opening.');
    expect(html).toContain('Edit');
    expect(html).toContain('MD');
    expect(html).not.toContain('# Chapter 1');
  });
});
