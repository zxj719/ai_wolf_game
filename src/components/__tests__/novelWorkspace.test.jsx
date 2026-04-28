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
  });
});
