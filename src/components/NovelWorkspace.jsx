import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookMarked,
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  Download,
  Edit3,
  FileText,
  FolderOpen,
  Library,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  Save,
  ScrollText,
  Send,
  Sparkles,
  User,
  Wand2,
  X,
} from 'lucide-react';
import { novelService } from '../services/novelService';
import { useAuth } from '../contexts/AuthContext';
import { useShell } from '../shell/ShellContext';

const EMPTY_BOOK = {
  name: '',
  slug: '',
  worldview: '',
  style: '',
  concept: '',
  outline: '',
};

const HIDDEN_MESSAGE_SOURCES = new Set(['system', 'trace']);
const ACTION_MODES = ['next_chapter', 'revise_document', 'plan', 'story_bible'];

const NOVEL_COPY = {
  zh: {
    common: {
      userFallback: '用户',
      loading: '加载中...',
      back: '返回',
      refresh: '刷新',
      shelf: '书架',
      cancel: '取消',
      save: '保存',
      edit: '编辑',
      empty: '空',
      md: 'MD',
    },
    status: {
      idle: '待命',
      completed: '已完成',
      failed: '失败',
      running: '运行中',
    },
    shelf: {
      title: '小说书架',
      newBook: '新建小说',
      addBook: '添加新书',
      books: '本书',
      chapters: '章节',
      latest: '最新',
      manual: '手动工作流',
    },
    newBook: {
      title: '新建小说',
      titleField: '书名',
      slug: '项目标识',
      worldview: '世界观',
      style: '声音与风格',
      concept: '核心创意',
      outline: '故事脉络',
      create: '创建小说',
      createAndGenerate: '创建并生成第一章',
    },
    studio: {
      titleFallback: '小说工作台',
      subtitle: '小说工作台',
      projectMemory: '项目记忆',
      projectMemoryHint: '章节、故事圣经、章节摘要、创作约束',
      activeProject: '当前项目',
      chapters: '章节',
      storyBible: '故事圣经',
      summaries: '章节摘要',
      guidance: '创作指导',
      learnedRules: '学习规则',
      noChapters: '还没有章节。',
      noDocument: '选择一个章节或项目记忆文件。',
      selectProject: '选择项目',
      noProjects: '还没有小说。请先在书架中新建一本。',
    },
    reader: {
      empty: '这个文档还是空的。',
      download: '导出 MD',
    },
    chat: {
      title: 'Codex 对话',
      subtitle: '手动章节工作流',
      ready: '已选好项目后，可以让 Codex 续写、修改当前文档、列计划或只维护故事圣经。',
      running: 'Codex 正在处理。',
      outputHint: '输出会显示在上方。',
      targetProject: '目标项目',
      targetDocument: '当前文档',
      selectProject: '请选择项目',
      noDocument: '未选择文档',
      placeholder: {
        next_chapter: '下一章要推进的情绪、冲突、伏笔或必须避免的问题',
        revise_document: '说明要如何修改当前阅读区里的文档，例如润色、补桥段、改节奏',
        plan: '说明你想让 Codex 规划什么：章节计划、修订步骤、人物线或伏笔回收',
        story_bible: '说明要补充或修正哪些故事圣经信息，不生成正文',
      },
      modes: {
        next_chapter: {
          title: '生成下一章',
          hint: '读取当前小说记忆并写入新章节。',
          button: '生成下一章',
        },
        revise_document: {
          title: '修改当前文档',
          hint: '围绕阅读区正在显示的章节或记忆文件互动修改。',
          button: '修改当前文档',
        },
        plan: {
          title: '计划模式',
          hint: '只列计划，不写入正文或记忆文件。',
          button: '列计划',
        },
        story_bible: {
          title: '只改故事圣经',
          hint: '只维护世界观、人物、时间线、伏笔等项目记忆。',
          button: '更新故事圣经',
        },
      },
      starting: '启动中',
      jobRunning: '运行中',
    },
    message: {
      you: '你',
      codex: 'Codex',
      codexError: 'Codex 错误',
    },
  },
  en: {
    common: {
      userFallback: 'User',
      loading: 'Loading...',
      back: 'Back',
      refresh: 'Refresh',
      shelf: 'Shelf',
      cancel: 'Cancel',
      save: 'Save',
      edit: 'Edit',
      empty: 'Empty',
      md: 'MD',
    },
    status: {
      idle: 'idle',
      completed: 'completed',
      failed: 'failed',
      running: 'running',
    },
    shelf: {
      title: 'Novel shelf',
      newBook: 'New book',
      addBook: 'Add new book',
      books: 'books',
      chapters: 'chapters',
      latest: 'latest',
      manual: 'manual workflow',
    },
    newBook: {
      title: 'New book',
      titleField: 'Title',
      slug: 'Slug',
      worldview: 'Worldview',
      style: 'Voice and style',
      concept: 'Core idea',
      outline: 'Story line',
      create: 'Create book',
      createAndGenerate: 'Create and generate chapter 1',
    },
    studio: {
      titleFallback: 'Novel workspace',
      subtitle: 'Novel workspace',
      projectMemory: 'Project memory',
      projectMemoryHint: 'Chapters, Story Bible, summaries, and creator constraints',
      activeProject: 'Active project',
      chapters: 'Chapters',
      storyBible: 'Story Bible',
      summaries: 'Summaries',
      guidance: 'Guidance',
      learnedRules: 'Learned Rules',
      noChapters: 'No chapters yet.',
      noDocument: 'Select a chapter or project memory file.',
      selectProject: 'Select project',
      noProjects: 'No books yet. Create one from the shelf first.',
    },
    reader: {
      empty: 'Empty document.',
      download: 'Export MD',
    },
    chat: {
      title: 'Codex conversation',
      subtitle: 'manual chapter workflow',
      ready: 'After choosing a project, Codex can continue the book, revise the current document, plan, or maintain only the Story Bible.',
      running: 'Codex is working.',
      outputHint: 'Output appears above.',
      targetProject: 'Target project',
      targetDocument: 'Current document',
      selectProject: 'select a project',
      noDocument: 'No document selected',
      placeholder: {
        next_chapter: 'Next chapter direction, conflict, emotion, foreshadowing, or things to avoid',
        revise_document: 'Describe how to revise the document currently shown in the reader',
        plan: 'Describe the plan you want: chapter plan, revision steps, character arc, or foreshadowing',
        story_bible: 'Describe which Story Bible details to add or fix without drafting prose',
      },
      modes: {
        next_chapter: {
          title: 'Generate next chapter',
          hint: 'Read this book memory and write a new chapter.',
          button: 'Generate next chapter',
        },
        revise_document: {
          title: 'Revise current document',
          hint: 'Interact with the chapter or memory file shown in the reader.',
          button: 'Revise document',
        },
        plan: {
          title: 'Plan mode',
          hint: 'Plan only, without writing prose or memory files.',
          button: 'Make a plan',
        },
        story_bible: {
          title: 'Story Bible only',
          hint: 'Maintain worldbuilding, characters, timeline, and foreshadowing only.',
          button: 'Update Story Bible',
        },
      },
      starting: 'Starting',
      jobRunning: 'Running',
    },
    message: {
      you: 'You',
      codex: 'Codex',
      codexError: 'Codex error',
    },
  },
};

function getNovelCopy(locale = 'zh') {
  return NOVEL_COPY[locale] || NOVEL_COPY.zh;
}

function documentGroupLabel(group, copy) {
  const key = String(group || '').toLowerCase();
  if (key === 'chapters') return copy.studio.chapters;
  if (key === 'story bible') return copy.studio.storyBible;
  if (key === 'summaries') return copy.studio.summaries;
  if (key === 'guidance') return copy.studio.guidance;
  if (key === 'learned rules') return copy.studio.learnedRules;
  return group;
}

function compactText(value, fallback = '') {
  return (value || '').trim() || fallback;
}

function slugifyTitle(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
}

function filenameSafe(value, fallback = 'document') {
  return (String(value || fallback).replace(/[\\/:*?"<>|]+/g, '-').trim() || fallback);
}

function statusMeta(job, copy) {
  if (!job) {
    return {
      label: copy.status.idle,
      icon: MessageSquare,
      className: 'border-slate-200 bg-white/80 text-slate-600',
    };
  }
  if (job.status === 'completed') {
    return {
      label: copy.status.completed,
      icon: CheckCircle2,
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    };
  }
  if (job.status === 'failed') {
    return {
      label: copy.status.failed,
      icon: AlertTriangle,
      className: 'border-rose-200 bg-rose-50 text-rose-700',
    };
  }
  return {
    label: copy.status.running,
    icon: Loader2,
    className: 'border-blue-200 bg-blue-50 text-blue-700',
  };
}

function JobPill({ job, copy }) {
  const meta = statusMeta(job, copy);
  const Icon = meta.icon;
  return (
    <div className={`flex items-center gap-2 rounded-[16px] border px-3 py-2 text-xs font-medium ${meta.className}`}>
      <Icon size={14} className={job?.status === 'running' ? 'animate-spin' : ''} />
      Codex {meta.label}
    </div>
  );
}

function chapterToDocument(chapter, projectName = '') {
  if (!chapter) return null;
  return {
    type: 'chapter',
    id: chapter.id,
    key: `chapter:${chapter.id}`,
    title: chapter.title || `Chapter ${chapter.id}`,
    filename: chapter.filename || `${chapter.id}.md`,
    content: chapter.content || '',
    projectName,
    group: 'Chapters',
    downloadable: true,
    editable: true,
  };
}

function sectionToDocument(section, group) {
  return {
    type: 'memory',
    id: section.name,
    key: `memory:${section.name}`,
    path: section.name,
    title: section.name,
    filename: section.name.split('/').at(-1),
    content: section.content || '',
    group,
    downloadable: section.name.toLowerCase().endsWith('.md'),
    editable: true,
  };
}

function splitProjectMemory(project) {
  const sections = project?.storyBible?.sections || [];
  const storyBible = [];
  const summaries = [];
  for (const section of sections) {
    if (section.name.toLowerCase().startsWith('chapter_summaries/')) {
      summaries.push(sectionToDocument(section, 'Summaries'));
    } else {
      storyBible.push(sectionToDocument(section, 'Story Bible'));
    }
  }

  const guidance = compactText(project?.creatorGuidance)
    ? [{
      type: 'memory',
      key: 'memory:creator_guidance.md',
      path: 'creator_guidance.md',
      title: 'creator_guidance.md',
      filename: 'creator_guidance.md',
      content: project.creatorGuidance,
      group: 'Guidance',
      downloadable: true,
      editable: true,
    }]
    : [];

  const rules = compactText(project?.learnedRules)
    ? [{
      type: 'memory',
      key: 'memory:learned_rules.md',
      path: 'learned_rules.md',
      title: 'learned_rules.md',
      filename: 'learned_rules.md',
      content: project.learnedRules,
      group: 'Learned Rules',
      downloadable: true,
      editable: true,
    }]
    : [];

  return { storyBible, summaries, guidance, rules };
}

function messageLabel(message, copy) {
  if (message.role === 'user' || message.source === 'request') return copy.message.you;
  if (message.source === 'stderr' || message.source === 'error') return copy.message.codexError;
  if (message.source === 'stdout') return copy.message.codex;
  return copy.message.codex;
}

function ChatBubble({ role, label, source, children }) {
  const isUser = role === 'user';
  const isError = source === 'stderr' || source === 'error';
  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <span className={`mac-icon-tile mt-1 h-8 w-8 shrink-0 rounded-[13px] ${isError ? 'text-rose-600' : ''}`}>
          {isError ? <AlertTriangle size={15} /> : <Bot size={15} />}
        </span>
      )}
      <div
        className={`max-w-[86%] rounded-[18px] border px-3.5 py-3 ${
          isUser
            ? 'border-slate-300 bg-slate-950 text-white'
            : isError
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : 'border-slate-200 bg-white/90 text-slate-700'
        }`}
      >
        <div
          className={`mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
            isUser ? 'text-slate-300' : isError ? 'text-rose-500' : 'text-slate-400'
          }`}
        >
          {label}
        </div>
        <div className="whitespace-pre-wrap break-words text-sm leading-6">{children}</div>
      </div>
    </div>
  );
}

function parseMarkdownBlocks(content) {
  const lines = String(content || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let paragraph = [];
  let list = [];
  let code = null;

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: 'p', text: paragraph.join(' ') });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      blocks.push({ type: 'ul', items: list });
      list = [];
    }
  };

  for (const line of lines) {
    const fence = line.match(/^```(.*)$/);
    if (fence) {
      if (code) {
        blocks.push({ type: 'code', language: code.language, text: code.lines.join('\n') });
        code = null;
      } else {
        flushParagraph();
        flushList();
        code = { language: fence[1].trim(), lines: [] };
      }
      continue;
    }
    if (code) {
      code.lines.push(line);
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2].trim() });
      continue;
    }
    const listItem = line.match(/^[-*]\s+(.+)$/);
    if (listItem) {
      flushParagraph();
      list.push(listItem[1].trim());
      continue;
    }
    const quote = line.match(/^>\s?(.+)$/);
    if (quote) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'quote', text: quote[1].trim() });
      continue;
    }
    if (/^---+$/.test(line.trim())) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'hr' });
      continue;
    }
    paragraph.push(line.trim());
  }
  flushParagraph();
  flushList();
  if (code) blocks.push({ type: 'code', language: code.language, text: code.lines.join('\n') });
  return blocks;
}

function MarkdownView({ content, copy }) {
  const blocks = useMemo(() => parseMarkdownBlocks(content), [content]);
  if (!compactText(content)) {
    return <div className="text-sm text-slate-500">{copy.reader.empty}</div>;
  }
  return (
    <div className="space-y-5">
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          const Heading = `h${Math.min(block.level + 1, 5)}`;
          const size = block.level === 1 ? 'text-3xl' : block.level === 2 ? 'text-2xl' : 'text-xl';
          return (
            <Heading key={index} className={`${size} font-semibold leading-tight text-slate-950`}>
              {block.text}
            </Heading>
          );
        }
        if (block.type === 'ul') {
          return (
            <ul key={index} className="list-disc space-y-2 pl-6 text-base leading-8 text-slate-700">
              {block.items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}
            </ul>
          );
        }
        if (block.type === 'quote') {
          return (
            <blockquote key={index} className="border-l-4 border-slate-300 pl-4 text-base leading-8 text-slate-600">
              {block.text}
            </blockquote>
          );
        }
        if (block.type === 'code') {
          return (
            <pre key={index} className="overflow-auto rounded-[14px] bg-slate-950 p-4 text-sm leading-6 text-slate-100">
              <code>{block.text}</code>
            </pre>
          );
        }
        if (block.type === 'hr') {
          return <hr key={index} className="border-slate-200" />;
        }
        return (
          <p key={index} className="text-base leading-8 text-slate-700">
            {block.text}
          </p>
        );
      })}
    </div>
  );
}

function CodexChat({
  guidance,
  job,
  project,
  selectedDocument,
  actionMode,
  busy,
  disabled,
  copy,
  onGuidanceChange,
  onActionModeChange,
  onGenerate,
}) {
  const isRunning = job && ['running', 'queued'].includes(job.status);
  const modeCopy = copy.chat.modes[actionMode] || copy.chat.modes.next_chapter;
  const modeNeedsDocument = actionMode === 'revise_document';
  const actionDisabled = disabled || isRunning || (modeNeedsDocument && !selectedDocument);
  const messages = useMemo(() => {
    if (job?.messages?.length) {
      return job.messages
        .filter((message) => !HIDDEN_MESSAGE_SOURCES.has(message.source))
        .map((message) => (
          message.source === 'request' ? { ...message, role: 'user' } : { ...message, role: message.role || 'assistant' }
        ));
    }
    if (job?.output || job?.error) {
      return [
        job.output ? { role: 'assistant', source: 'stdout', content: job.output } : null,
        job.error ? { role: 'assistant', source: 'stderr', content: job.error } : null,
      ].filter(Boolean);
    }
    return [{ role: 'assistant', source: 'stdout', content: copy.chat.ready }];
  }, [copy.chat.ready, job]);

  return (
    <div className="mac-panel flex min-h-[620px] flex-col overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="mac-icon-tile h-10 w-10 rounded-[16px]">
            <Sparkles size={17} />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-slate-900">{copy.chat.title}</h3>
            <p className="text-xs text-slate-500">{copy.chat.subtitle}</p>
          </div>
        </div>
        <JobPill job={job} copy={copy} />
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-auto bg-slate-50/70 px-4 py-4">
        {messages.map((message, index) => (
          <ChatBubble
            key={`${message.at || index}-${message.source || 'message'}`}
            role={message.role || 'assistant'}
            source={message.source}
            label={messageLabel(message, copy)}
          >
            {message.content}
          </ChatBubble>
        ))}
        {isRunning && messages.length === 0 && (
          <div className="rounded-[16px] border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
            {copy.chat.running}
          </div>
        )}
      </div>

      <div className="border-t border-slate-200/70 bg-white/80 p-3">
        <div className="mb-3 grid grid-cols-2 gap-2">
          {ACTION_MODES.map((mode) => {
            const item = copy.chat.modes[mode];
            const active = actionMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => onActionModeChange(mode)}
                className={`rounded-[14px] border px-3 py-2 text-left transition ${
                  active
                    ? 'border-slate-300 bg-slate-950 text-white'
                    : 'border-slate-200 bg-white/80 text-slate-700 hover:bg-white'
                }`}
              >
                <div className="text-xs font-semibold">{item.title}</div>
                <div className={`mt-1 line-clamp-2 text-[11px] leading-4 ${active ? 'text-slate-300' : 'text-slate-500'}`}>
                  {item.hint}
                </div>
              </button>
            );
          })}
        </div>
        <textarea
          value={guidance}
          onChange={(event) => onGuidanceChange(event.target.value)}
          className="mac-textarea min-h-[104px] resize-none"
          placeholder={copy.chat.placeholder[actionMode]}
        />
        <div className="mt-2 space-y-1 rounded-[14px] border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <div>
            {copy.chat.targetProject}: <span className="font-semibold text-slate-900">{project?.name || copy.chat.selectProject}</span>
            {project?.slug && <span className="ml-2 text-slate-400">/{project.slug}</span>}
          </div>
          <div>
            {copy.chat.targetDocument}: <span className="font-semibold text-slate-900">{selectedDocument?.title || copy.chat.noDocument}</span>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 text-xs text-slate-500">
            {isRunning ? <Clock3 size={14} /> : <MessageSquare size={14} />}
            {isRunning ? copy.chat.running : copy.chat.outputHint}
          </div>
          <button
            type="button"
            onClick={onGenerate}
            disabled={actionDisabled}
            className={`mac-button shrink-0 ${actionDisabled ? 'mac-button-secondary' : 'mac-button-primary'}`}
          >
            <Send size={15} />
            {busy ? copy.chat.starting : isRunning ? copy.chat.jobRunning : modeCopy.button}
          </button>
        </div>
      </div>
    </div>
  );
}

function DocumentButton({ item, active, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(item)}
      className={`w-full rounded-[14px] border px-3 py-2.5 text-left transition-colors ${
        active ? 'border-slate-300 bg-white shadow-sm' : 'border-transparent hover:border-slate-200 hover:bg-white/80'
      }`}
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <FileText size={15} />
        <span className="truncate">{item.title}</span>
      </div>
      {item.excerpt && <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.excerpt}</div>}
    </button>
  );
}

function ProjectMemoryColumn({
  projects,
  selectedProject,
  project,
  selectedDocument,
  jobRunning,
  copy,
  onSelectProject,
  onSelectChapter,
  onSelectMemoryFile,
}) {
  const memory = useMemo(() => splitProjectMemory(project), [project]);
  const chapterItems = (project?.chapters || []).map((chapter) => ({
    ...chapter,
    key: `chapter:${chapter.id}`,
    title: chapter.title,
    excerpt: chapter.excerpt,
  }));

  const activeKey = selectedDocument?.key;
  const groups = [
    { key: 'storyBible', label: copy.studio.storyBible, items: memory.storyBible },
    { key: 'summaries', label: copy.studio.summaries, items: memory.summaries },
    { key: 'guidance', label: copy.studio.guidance, items: memory.guidance },
    { key: 'rules', label: copy.studio.learnedRules, items: memory.rules },
  ];
  return (
    <aside className="border-b border-slate-200/70 bg-slate-50/70 p-4 xl:max-h-[840px] xl:overflow-auto xl:border-b-0 xl:border-r">
      <div className="mb-4 flex items-center gap-3">
        <span className="mac-icon-tile h-10 w-10 rounded-[16px]">
          <FolderOpen size={17} />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{copy.studio.projectMemory}</h3>
          <p className="text-xs text-slate-500">{copy.studio.projectMemoryHint}</p>
        </div>
      </div>
      <label className="mb-5 block">
        <span className="mac-eyebrow mb-2 block">{copy.studio.activeProject}</span>
        <select
          value={selectedProject}
          onChange={(event) => onSelectProject(event.target.value)}
          disabled={jobRunning}
          className="mac-input h-11 w-full text-sm"
        >
          {!projects.length && <option value="">{copy.studio.noProjects}</option>}
          {projects.map((item) => (
            <option key={item.slug || item.name} value={item.slug || item.name}>
              {item.name} ({item.chapterCount})
            </option>
          ))}
        </select>
      </label>

      <div className="space-y-3">
        <details className="rounded-[16px] border border-slate-200 bg-white/60 p-3" open>
          <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            <BookOpen size={13} />
            {copy.studio.chapters}
            <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] tracking-normal text-slate-500">{chapterItems.length}</span>
          </summary>
          <div className="mt-3 space-y-2">
            {chapterItems.length ? chapterItems.map((chapter) => (
              <DocumentButton
                key={chapter.key}
                item={chapter}
                active={activeKey === chapter.key}
                onClick={() => onSelectChapter(chapter.id)}
              />
            )) : (
              <div className="rounded-[14px] border border-dashed border-slate-300 bg-white/70 px-4 py-5 text-sm text-slate-500">
                {copy.studio.noChapters}
              </div>
            )}
          </div>
        </details>

        {groups.map(({ key, label, items }) => (
          <details
            key={key}
            className="rounded-[16px] border border-slate-200 bg-white/60 p-3"
            open={items.some((item) => item.key === activeKey)}
          >
            <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              <ScrollText size={13} />
              {label}
              <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] tracking-normal text-slate-500">{items.length}</span>
            </summary>
            <div className="mt-3 space-y-2">
              {items.length ? items.map((item) => (
                <DocumentButton
                  key={item.key}
                  item={item}
                  active={activeKey === item.key}
                  onClick={onSelectMemoryFile}
                />
              )) : (
                <div className="rounded-[14px] border border-dashed border-slate-300 bg-white/70 px-3 py-3 text-xs text-slate-500">
                  {copy.common.empty}
                </div>
              )}
            </div>
          </details>
        ))}
      </div>
    </aside>
  );
}

function ReaderPane({
  document,
  draftContent,
  editMode,
  dirty,
  saving,
  copy,
  onChange,
  onEdit,
  onCancel,
  onSave,
}) {
  const content = editMode ? draftContent : document?.content || '';
  const canDownload = document?.downloadable || document?.type === 'chapter';

  const downloadDocument = useCallback(() => {
    if (!document) return;
    const name = document.filename || `${filenameSafe(document.title)}.md`;
    const blob = new Blob([draftContent || document.content || ''], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement('a');
    anchor.href = url;
    anchor.download = name.toLowerCase().endsWith('.md') ? name : `${name}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [document, draftContent]);

  if (!document) {
    return (
      <section className="min-w-0 bg-white/70 p-5 md:p-7">
        <div className="flex min-h-[620px] items-center justify-center text-sm text-slate-500">
          {copy.studio.noDocument}
        </div>
      </section>
    );
  }

  return (
    <section className="min-w-0 bg-white/70 p-5 md:p-7">
      <article className="mx-auto max-w-3xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mac-eyebrow">{documentGroupLabel(document.group || document.type, copy)}</div>
            <h2 className="mt-2 break-words text-[clamp(2rem,4vw,3.2rem)] font-semibold leading-tight text-slate-950">
              {document.title}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {canDownload && (
              <button type="button" onClick={downloadDocument} className="mac-button mac-button-secondary">
                <Download size={15} />
                {copy.common.md}
              </button>
            )}
            {editMode ? (
              <>
                <button type="button" onClick={onCancel} className="mac-button mac-button-secondary">
                  <X size={15} />
                  {copy.common.cancel}
                </button>
                <button type="button" onClick={onSave} disabled={!dirty || saving} className="mac-button mac-button-primary">
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  {copy.common.save}
                </button>
              </>
            ) : (
              <button type="button" onClick={onEdit} className="mac-button mac-button-secondary">
                <Edit3 size={15} />
                {copy.common.edit}
              </button>
            )}
          </div>
        </div>

        {editMode ? (
          <textarea
            value={draftContent}
            onChange={(event) => onChange(event.target.value)}
            className="mac-textarea min-h-[640px] resize-y font-mono text-sm leading-6"
          />
        ) : (
          <div className="rounded-[18px] border border-slate-200 bg-white/75 px-6 py-7 shadow-sm">
            <MarkdownView content={content} copy={copy} />
          </div>
        )}
      </article>
    </section>
  );
}

function BookshelfPage({ user, projects, loading, error, copy, onBack, onRefresh, onOpenProject, onNewBook }) {
  return (
    <div className="px-4 py-10 md:px-6">
      <div className="mx-auto max-w-[1300px]">
        <div className="mac-window overflow-hidden">
          <div className="mac-toolbar">
            <div className="flex min-w-0 items-center gap-4">
              <div className="mac-window-chrome">
                <span className="mac-window-dot mac-dot-red" />
                <span className="mac-window-dot mac-dot-yellow" />
                <span className="mac-window-dot mac-dot-green" />
              </div>
              <div className="min-w-0">
                <div className="mac-eyebrow">Meta Writing</div>
                <h1 className="truncate text-base font-semibold text-slate-900">{copy.shelf.title}</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={onNewBook} className="mac-button mac-button-primary">
                <Plus size={15} />
                {copy.shelf.newBook}
              </button>
              <button type="button" onClick={onRefresh} className="mac-button mac-button-secondary !h-10 !w-10 !rounded-[16px] !p-0" title={copy.common.refresh}>
                <RefreshCw size={16} />
              </button>
              <button type="button" onClick={onBack} className="mac-button mac-button-secondary">
                <ChevronLeft size={15} />
                {copy.common.back}
              </button>
            </div>
          </div>

          <main className="border-t border-slate-200/70 bg-slate-50/70 p-6 md:p-8">
            <div className="mb-6 flex items-center gap-3">
              <span className="mac-icon-tile h-11 w-11 rounded-[18px]">
                <User size={18} />
              </span>
              <div>
                <div className="text-sm font-semibold text-slate-900">{user?.username || copy.common.userFallback}</div>
                <div className="text-xs text-slate-500">{projects.length} {copy.shelf.books}</div>
              </div>
            </div>

            {loading ? (
              <div className="flex min-h-[420px] items-center justify-center gap-2 text-sm text-slate-500">
                <Loader2 size={16} className="animate-spin" />
                {copy.common.loading}
              </div>
            ) : error ? (
              <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {projects.map((project) => (
                  <button
                    key={project.slug || project.name}
                    type="button"
                    onClick={() => onOpenProject(project.slug || project.name)}
                    className="group min-h-[210px] rounded-[8px] border border-slate-200 bg-white/85 p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                  >
                    <div className="mb-7 flex items-start justify-between gap-3">
                      <span className="mac-icon-tile h-12 w-12 rounded-[18px] text-slate-700">
                        <BookMarked size={19} />
                      </span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">
                        {(project.workflowMode || 'manual') === 'manual' ? copy.shelf.manual : project.workflowMode}
                      </span>
                    </div>
                    <h2 className="line-clamp-2 text-xl font-semibold leading-tight text-slate-950">{project.name}</h2>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-500">
                      <div className="rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="font-semibold text-slate-900">{project.chapterCount}</div>
                        <div>{copy.shelf.chapters}</div>
                      </div>
                      <div className="rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="truncate font-semibold text-slate-900">{project.latestChapter || '-'}</div>
                        <div>{copy.shelf.latest}</div>
                      </div>
                    </div>
                    {project.latestTitle && <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-600">{project.latestTitle}</p>}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={onNewBook}
                  className="flex min-h-[210px] flex-col items-center justify-center rounded-[8px] border border-dashed border-slate-300 bg-white/60 p-5 text-center text-slate-500 transition hover:border-slate-400 hover:bg-white"
                >
                  <Plus size={24} />
                  <div className="mt-3 text-sm font-semibold text-slate-800">{copy.shelf.addBook}</div>
                </button>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, textarea = false, placeholder = '' }) {
  return (
    <label className="block">
      <span className="mac-eyebrow mb-2 block">{label}</span>
      {textarea ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="mac-textarea min-h-[120px] resize-y"
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="mac-input h-11 w-full"
        />
      )}
    </label>
  );
}

function NewBookPage({ draft, busy, error, copy, onBack, onDraftChange, onCreateBook }) {
  return (
    <div className="px-4 py-10 md:px-6">
      <div className="mx-auto max-w-[1100px]">
        <div className="mac-window overflow-hidden">
          <div className="mac-toolbar">
            <div className="flex min-w-0 items-center gap-4">
              <div className="mac-window-chrome">
                <span className="mac-window-dot mac-dot-red" />
                <span className="mac-window-dot mac-dot-yellow" />
                <span className="mac-window-dot mac-dot-green" />
              </div>
              <div className="min-w-0">
                <div className="mac-eyebrow">Meta Writing</div>
                <h1 className="truncate text-base font-semibold text-slate-900">{copy.newBook.title}</h1>
              </div>
            </div>
            <button type="button" onClick={onBack} className="mac-button mac-button-secondary">
              <ChevronLeft size={15} />
              {copy.common.shelf}
            </button>
          </div>

          <main className="border-t border-slate-200/70 bg-slate-50/70 p-6 md:p-8">
            {error && <div className="mb-5 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
            <div className="grid gap-5 lg:grid-cols-2">
              <Field label={copy.newBook.titleField} value={draft.name} onChange={(value) => onDraftChange('name', value)} />
              <Field label={copy.newBook.slug} value={draft.slug} onChange={(value) => onDraftChange('slug', value)} />
              <Field label={copy.newBook.worldview} value={draft.worldview} onChange={(value) => onDraftChange('worldview', value)} textarea />
              <Field label={copy.newBook.style} value={draft.style} onChange={(value) => onDraftChange('style', value)} textarea />
              <Field label={copy.newBook.concept} value={draft.concept} onChange={(value) => onDraftChange('concept', value)} textarea />
              <Field label={copy.newBook.outline} value={draft.outline} onChange={(value) => onDraftChange('outline', value)} textarea />
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={() => onCreateBook(false)} disabled={busy} className="mac-button mac-button-secondary">
                <FolderOpen size={15} />
                {copy.newBook.create}
              </button>
              <button type="button" onClick={() => onCreateBook(true)} disabled={busy} className="mac-button mac-button-primary">
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
                {copy.newBook.createAndGenerate}
              </button>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function StudioPage({
  user,
  loading,
  error,
  projects,
  selectedProject,
  project,
  selectedDocument,
  draftContent,
  editMode,
  dirty,
  saving,
  guidance,
  job,
  actionMode,
  busy,
  copy,
  onBack,
  onShelf,
  onSelectProject,
  onSelectChapter,
  onSelectMemoryFile,
  onDocumentChange,
  onEditDocument,
  onCancelEdit,
  onSaveDocument,
  onGuidanceChange,
  onActionModeChange,
  onGenerate,
  onRefresh,
}) {
  const jobRunning = job && ['running', 'queued'].includes(job.status);

  return (
    <div className="px-4 py-10 md:px-6">
      <div className="mx-auto max-w-[1720px]">
        <div className="mac-window overflow-hidden">
          <div className="mac-toolbar">
            <div className="flex min-w-0 items-center gap-4">
              <div className="mac-window-chrome">
                <span className="mac-window-dot mac-dot-red" />
                <span className="mac-window-dot mac-dot-yellow" />
                <span className="mac-window-dot mac-dot-green" />
              </div>
              <div className="min-w-0">
                <div className="mac-eyebrow">Meta Writing</div>
                <h1 className="truncate text-base font-semibold text-slate-900">{project?.name || copy.studio.titleFallback}</h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <JobPill job={job} copy={copy} />
              <button type="button" onClick={onRefresh} className="mac-button mac-button-secondary !h-10 !w-10 !rounded-[16px] !p-0" title={copy.common.refresh}>
                <RefreshCw size={16} />
              </button>
              <button type="button" onClick={onShelf} className="mac-button mac-button-secondary">
                <Library size={15} />
                {copy.common.shelf}
              </button>
              <button type="button" onClick={onBack} className="mac-button mac-button-secondary">
                <ChevronLeft size={15} />
                {copy.common.back}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[760px] items-center justify-center gap-2 border-t border-slate-200/70 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" />
              {copy.common.loading}
            </div>
          ) : error ? (
            <div className="border-t border-slate-200/70 bg-white/70 p-5">
              <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
            </div>
          ) : (
            <main className="grid min-h-[840px] gap-0 border-t border-slate-200/70 xl:grid-cols-[320px_minmax(0,1fr)_430px]">
              <ProjectMemoryColumn
                projects={projects}
                selectedProject={selectedProject}
                project={project}
                selectedDocument={selectedDocument}
                jobRunning={jobRunning}
                copy={copy}
                onSelectProject={onSelectProject}
                onSelectChapter={onSelectChapter}
                onSelectMemoryFile={onSelectMemoryFile}
              />
              <ReaderPane
                document={selectedDocument}
                draftContent={draftContent}
                editMode={editMode}
                dirty={dirty}
                saving={saving}
                copy={copy}
                onChange={onDocumentChange}
                onEdit={onEditDocument}
                onCancel={onCancelEdit}
                onSave={onSaveDocument}
              />
              <aside className="border-t border-slate-200/70 bg-slate-50/80 p-4 xl:border-l xl:border-t-0">
                <div className="mb-4 flex items-center gap-3">
                  <span className="mac-icon-tile h-10 w-10 rounded-[16px]">
                    <User size={17} />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">{user?.username || copy.common.userFallback}</div>
                    <div className="text-xs text-slate-500">{copy.studio.subtitle}</div>
                  </div>
                </div>
                <CodexChat
                  guidance={guidance}
                  job={job}
                  project={project}
                  selectedDocument={selectedDocument}
                  actionMode={actionMode}
                  busy={busy}
                  copy={copy}
                  disabled={busy || jobRunning || !project}
                  onGuidanceChange={onGuidanceChange}
                  onActionModeChange={onActionModeChange}
                  onGenerate={onGenerate}
                />
              </aside>
            </main>
          )}
        </div>
      </div>
    </div>
  );
}

export function NovelWorkspaceView({
  user,
  loading,
  error,
  projects,
  selectedProject,
  project,
  selectedChapter,
  selectedDocument,
  draftContent = '',
  editMode = false,
  dirty = false,
  saving = false,
  guidance,
  job,
  busy,
  actionMode = 'next_chapter',
  view = 'studio',
  locale = 'zh',
  bookDraft = EMPTY_BOOK,
  createError = '',
  onBack,
  onShelf = () => {},
  onNewBook = () => {},
  onSelectProject,
  onSelectChapter,
  onSelectMemoryFile = () => {},
  onDocumentChange = () => {},
  onEditDocument = () => {},
  onCancelEdit = () => {},
  onSaveDocument = () => {},
  onDraftChange = () => {},
  onCreateBook = () => {},
  onGuidanceChange,
  onActionModeChange = () => {},
  onGenerate,
  onRefresh,
}) {
  const activeDocument = selectedDocument || chapterToDocument(selectedChapter, project?.name || selectedProject);
  const copy = getNovelCopy(locale);

  if (view === 'shelf') {
    return (
      <BookshelfPage
        user={user}
        projects={projects}
        loading={loading}
        error={error}
        copy={copy}
        onBack={onBack}
        onRefresh={onRefresh}
        onOpenProject={onSelectProject}
        onNewBook={onNewBook}
      />
    );
  }

  if (view === 'new') {
    return (
      <NewBookPage
        draft={bookDraft}
        busy={busy}
        error={createError || error}
        copy={copy}
        onBack={onShelf}
        onDraftChange={onDraftChange}
        onCreateBook={onCreateBook}
      />
    );
  }

  return (
    <StudioPage
      user={user}
      loading={loading}
      error={error}
      projects={projects}
      selectedProject={selectedProject}
      project={project}
      selectedDocument={activeDocument}
      draftContent={draftContent || activeDocument?.content || ''}
      editMode={editMode}
      dirty={dirty}
      saving={saving}
      guidance={guidance}
      job={job}
      actionMode={actionMode}
      busy={busy}
      copy={copy}
      onBack={onBack}
      onShelf={onShelf}
      onSelectProject={onSelectProject}
      onSelectChapter={onSelectChapter}
      onSelectMemoryFile={onSelectMemoryFile}
      onDocumentChange={onDocumentChange}
      onEditDocument={onEditDocument}
      onCancelEdit={onCancelEdit}
      onSaveDocument={onSaveDocument}
      onGuidanceChange={onGuidanceChange}
      onActionModeChange={onActionModeChange}
      onGenerate={onGenerate}
      onRefresh={onRefresh}
    />
  );
}

export function NovelWorkspace({ onBack }) {
  const { user } = useAuth();
  const { locale } = useShell();
  const [view, setView] = useState('shelf');
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [project, setProject] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [draftContent, setDraftContent] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [guidance, setGuidance] = useState('');
  const [actionMode, setActionMode] = useState('next_chapter');
  const [job, setJob] = useState(null);
  const [bookDraft, setBookDraft] = useState(EMPTY_BOOK);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const loadRequestRef = useRef(0);

  const openDocument = useCallback((document) => {
    setSelectedDocument(document);
    setDraftContent(document?.content || '');
    setEditMode(false);
  }, []);

  const refreshProjects = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const response = await novelService.listProjects();
      setProjects(response.projects || []);
    } catch (err) {
      setError(err.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadProject = useCallback(async (name) => {
    if (!name) return;
    const requestId = loadRequestRef.current + 1;
    loadRequestRef.current = requestId;
    setError('');
    setLoading(true);
    try {
      const response = await novelService.getProject(name);
      if (requestId !== loadRequestRef.current) return;
      const nextProject = response.project;
      setProject(nextProject);
      const latest = nextProject.chapters?.at(-1);
      if (latest) {
        const chapter = await novelService.getChapter(name, latest.id);
        if (requestId !== loadRequestRef.current) return;
        openDocument(chapterToDocument(chapter.chapter, nextProject.name));
      } else {
        const memory = splitProjectMemory(nextProject);
        openDocument(memory.storyBible[0] || memory.guidance[0] || null);
      }
    } catch (err) {
      if (requestId !== loadRequestRef.current) return;
      setError(err.message || 'Failed to load project');
    } finally {
      if (requestId === loadRequestRef.current) setLoading(false);
    }
  }, [openDocument]);

  const selectProject = useCallback((name) => {
    setSelectedProject(name);
    setProject(null);
    setSelectedDocument(null);
    setDraftContent('');
    setEditMode(false);
    setJob(null);
    setError('');
    setView('studio');
  }, []);

  const selectChapter = useCallback(async (chapterId) => {
    if (!selectedProject || !chapterId) return;
    setError('');
    try {
      const response = await novelService.getChapter(selectedProject, chapterId);
      openDocument(chapterToDocument(response.chapter, project?.name || selectedProject));
    } catch (err) {
      setError(err.message || 'Failed to load chapter');
    }
  }, [openDocument, project?.name, selectedProject]);

  const selectMemoryFile = useCallback((document) => {
    openDocument(document);
  }, [openDocument]);

  const generate = useCallback(async (projectName = selectedProject, guidanceOverride = guidance, modeOverride = actionMode) => {
    if (!projectName || busy || (job && ['running', 'queued'].includes(job.status))) return null;
    setBusy(true);
    setError('');
    try {
      const response = await novelService.generateNextChapter(projectName, {
        guidance: guidanceOverride,
        mode: modeOverride,
        targetDocument: selectedDocument ? {
          type: selectedDocument.type,
          id: selectedDocument.id,
          path: selectedDocument.path,
          title: selectedDocument.title,
          filename: selectedDocument.filename,
        } : null,
      });
      setJob(response.job);
      setGuidance('');
      return response.job;
    } catch (err) {
      setError(err.message || 'Failed to start Codex');
      return null;
    } finally {
      setBusy(false);
    }
  }, [actionMode, busy, guidance, job, selectedDocument, selectedProject]);

  const saveDocument = useCallback(async () => {
    if (!selectedProject || !selectedDocument) return;
    setSaving(true);
    setError('');
    try {
      if (selectedDocument.type === 'chapter') {
        const response = await novelService.saveChapter(selectedProject, selectedDocument.id, draftContent);
        openDocument(chapterToDocument(response.chapter, project?.name || selectedProject));
      } else {
        const response = await novelService.saveMemoryFile(selectedProject, selectedDocument.path, draftContent);
        const nextDocument = { ...selectedDocument, content: response.file.content };
        openDocument(nextDocument);
        setProject((current) => {
          if (!current) return current;
          if (selectedDocument.path === 'creator_guidance.md') {
            return { ...current, creatorGuidance: response.file.content };
          }
          if (selectedDocument.path === 'learned_rules.md') {
            return { ...current, learnedRules: response.file.content };
          }
          return {
            ...current,
            storyBible: {
              sections: (current.storyBible?.sections || []).map((section) => (
                section.name === selectedDocument.path ? { ...section, content: response.file.content } : section
              )),
            },
          };
        });
      }
    } catch (err) {
      setError(err.message || 'Failed to save document');
    } finally {
      setSaving(false);
    }
  }, [draftContent, openDocument, project?.name, selectedDocument, selectedProject]);

  const updateBookDraft = useCallback((field, value) => {
    setBookDraft((current) => {
      const next = { ...current, [field]: value };
      if (field === 'name' && (!current.slug || current.slug === slugifyTitle(current.name))) {
        next.slug = slugifyTitle(value);
      }
      if (field === 'slug') next.slug = slugifyTitle(value);
      return next;
    });
  }, []);

  const createBook = useCallback(async (generateFirstChapter = false) => {
    setBusy(true);
    setError('');
    try {
      const response = await novelService.createProject(bookDraft);
      const created = response.project;
      setProjects((current) => [...current.filter((item) => (item.slug || item.name) !== created.slug), {
        name: created.name,
        slug: created.slug,
        workflowMode: created.workflowMode,
        chapterCount: created.chapters?.length || 0,
        latestChapter: null,
        latestTitle: '',
      }]);
      setProject(created);
      setSelectedProject(created.slug);
      setView('studio');
      const memory = splitProjectMemory(created);
      openDocument(memory.storyBible[0] || null);
      setBookDraft(EMPTY_BOOK);
      if (generateFirstChapter) {
        const storyBible = [
          bookDraft.worldview,
          bookDraft.style,
          bookDraft.concept,
          bookDraft.outline,
        ].filter(Boolean).join('\n\n');
        const responseJob = await novelService.generateNextChapter(created.slug, `Generate chapter 1 from this story bible.\n\n${storyBible}`);
        setJob(responseJob.job);
      }
    } catch (err) {
      setError(err.message || 'Failed to create book');
    } finally {
      setBusy(false);
    }
  }, [bookDraft, openDocument]);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  useEffect(() => {
    if (view === 'studio' && selectedProject) {
      loadProject(selectedProject);
    }
  }, [loadProject, selectedProject, view]);

  useEffect(() => {
    if (!job || !['running', 'queued'].includes(job.status)) return undefined;
    const timer = window.setInterval(async () => {
      try {
        const response = await novelService.getJob(job.id);
        setJob(response.job);
        if (response.job?.status === 'completed') {
          await loadProject(selectedProject);
        }
      } catch (err) {
        setError(err.message || 'Failed to refresh job');
      }
    }, 2500);
    return () => window.clearInterval(timer);
  }, [job, loadProject, selectedProject]);

  const selectedProjectKey = useMemo(() => project?.slug || selectedProject, [project, selectedProject]);
  const dirty = selectedDocument ? draftContent !== selectedDocument.content : false;

  return (
    <NovelWorkspaceView
      user={user}
      loading={loading}
      error={error}
      projects={projects}
      selectedProject={selectedProjectKey}
      project={project}
      selectedDocument={selectedDocument}
      draftContent={draftContent}
      editMode={editMode}
      dirty={dirty}
      saving={saving}
      guidance={guidance}
      job={job}
      busy={busy}
      actionMode={actionMode}
      view={view}
      locale={locale}
      bookDraft={bookDraft}
      onBack={onBack}
      onShelf={() => {
        setView('shelf');
        setSelectedProject('');
        setProject(null);
        setSelectedDocument(null);
        setJob(null);
      }}
      onNewBook={() => {
        setError('');
        setBookDraft(EMPTY_BOOK);
        setView('new');
      }}
      onSelectProject={selectProject}
      onSelectChapter={selectChapter}
      onSelectMemoryFile={selectMemoryFile}
      onDocumentChange={setDraftContent}
      onEditDocument={() => setEditMode(true)}
      onCancelEdit={() => {
        setDraftContent(selectedDocument?.content || '');
        setEditMode(false);
      }}
      onSaveDocument={saveDocument}
      onDraftChange={updateBookDraft}
      onCreateBook={createBook}
      onGuidanceChange={setGuidance}
      onActionModeChange={setActionMode}
      onGenerate={() => generate()}
      onRefresh={() => {
        refreshProjects();
        if (selectedProject) loadProject(selectedProject);
      }}
    />
  );
}
