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

const EMPTY_BOOK = {
  name: '',
  slug: '',
  worldview: '',
  style: '',
  concept: '',
  outline: '',
};

const HIDDEN_MESSAGE_SOURCES = new Set(['system', 'trace']);

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

function statusMeta(job) {
  if (!job) {
    return {
      label: 'idle',
      icon: MessageSquare,
      className: 'border-slate-200 bg-white/80 text-slate-600',
    };
  }
  if (job.status === 'completed') {
    return {
      label: 'completed',
      icon: CheckCircle2,
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    };
  }
  if (job.status === 'failed') {
    return {
      label: 'failed',
      icon: AlertTriangle,
      className: 'border-rose-200 bg-rose-50 text-rose-700',
    };
  }
  return {
    label: 'running',
    icon: Loader2,
    className: 'border-blue-200 bg-blue-50 text-blue-700',
  };
}

function JobPill({ job }) {
  const meta = statusMeta(job);
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

function messageLabel(message) {
  if (message.role === 'user' || message.source === 'request') return 'You';
  if (message.source === 'stderr' || message.source === 'error') return 'Codex error';
  if (message.source === 'stdout') return 'Codex';
  return 'Codex';
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

function MarkdownView({ content }) {
  const blocks = useMemo(() => parseMarkdownBlocks(content), [content]);
  if (!compactText(content)) {
    return <div className="text-sm text-slate-500">Empty document.</div>;
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

function CodexChat({ guidance, job, project, busy, disabled, onGuidanceChange, onGenerate }) {
  const isRunning = job && ['running', 'queued'].includes(job.status);
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
    return [{ role: 'assistant', source: 'stdout', content: 'Ready for the next chapter.' }];
  }, [job]);

  return (
    <div className="mac-panel flex min-h-[620px] flex-col overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="mac-icon-tile h-10 w-10 rounded-[16px]">
            <Sparkles size={17} />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-slate-900">Codex conversation</h3>
            <p className="text-xs text-slate-500">manual chapter workflow</p>
          </div>
        </div>
        <JobPill job={job} />
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-auto bg-slate-50/70 px-4 py-4">
        {messages.map((message, index) => (
          <ChatBubble
            key={`${message.at || index}-${message.source || 'message'}`}
            role={message.role || 'assistant'}
            source={message.source}
            label={messageLabel(message)}
          >
            {message.content}
          </ChatBubble>
        ))}
        {isRunning && messages.length === 0 && (
          <div className="rounded-[16px] border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
            Codex job is running.
          </div>
        )}
      </div>

      <div className="border-t border-slate-200/70 bg-white/80 p-3">
        <textarea
          value={guidance}
          onChange={(event) => onGuidanceChange(event.target.value)}
          className="mac-textarea min-h-[104px] resize-none"
          placeholder="Next chapter direction, conflict, emotion, or foreshadowing"
        />
        <div className="mt-2 rounded-[14px] border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Target project: <span className="font-semibold text-slate-900">{project?.name || 'select a project'}</span>
          {project?.slug && <span className="ml-2 text-slate-400">/{project.slug}</span>}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 text-xs text-slate-500">
            {isRunning ? <Clock3 size={14} /> : <MessageSquare size={14} />}
            {isRunning ? 'Codex is writing.' : 'Output appears above.'}
          </div>
          <button
            type="button"
            onClick={onGenerate}
            disabled={disabled || isRunning}
            className={`mac-button shrink-0 ${disabled || isRunning ? 'mac-button-secondary' : 'mac-button-primary'}`}
          >
            <Send size={15} />
            {busy ? 'Starting' : isRunning ? 'Running' : 'Generate next chapter'}
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
  return (
    <aside className="border-b border-slate-200/70 bg-slate-50/70 p-4 xl:border-b-0 xl:border-r">
      <div className="mb-4 flex items-center gap-3">
        <span className="mac-icon-tile h-10 w-10 rounded-[16px]">
          <FolderOpen size={17} />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Project memory</h3>
          <p className="text-xs text-slate-500">Chapters, bible, summaries, guidance</p>
        </div>
      </div>
      <label className="mb-5 block">
        <span className="mac-eyebrow mb-2 block">Active project</span>
        <select
          value={selectedProject}
          onChange={(event) => onSelectProject(event.target.value)}
          disabled={jobRunning}
          className="mac-input h-11 w-full text-sm"
        >
          {projects.map((item) => (
            <option key={item.slug || item.name} value={item.slug || item.name}>
              {item.name} ({item.chapterCount})
            </option>
          ))}
        </select>
      </label>

      <div className="space-y-5">
        <section>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            <BookOpen size={13} />
            Chapters
          </div>
          <div className="space-y-2">
            {chapterItems.length ? chapterItems.map((chapter) => (
              <DocumentButton
                key={chapter.key}
                item={chapter}
                active={activeKey === chapter.key}
                onClick={() => onSelectChapter(chapter.id)}
              />
            )) : (
              <div className="rounded-[14px] border border-dashed border-slate-300 bg-white/70 px-4 py-5 text-sm text-slate-500">
                No chapters yet.
              </div>
            )}
          </div>
        </section>

        {[
          ['Story Bible', memory.storyBible],
          ['Summaries', memory.summaries],
          ['Guidance', memory.guidance],
          ['Learned Rules', memory.rules],
        ].map(([group, items]) => (
          <section key={group}>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              <ScrollText size={13} />
              {group}
            </div>
            <div className="space-y-2">
              {items.length ? items.map((item) => (
                <DocumentButton
                  key={item.key}
                  item={item}
                  active={activeKey === item.key}
                  onClick={onSelectMemoryFile}
                />
              )) : (
                <div className="rounded-[14px] border border-dashed border-slate-300 bg-white/70 px-3 py-3 text-xs text-slate-500">
                  Empty
                </div>
              )}
            </div>
          </section>
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
          Select a chapter or project memory file.
        </div>
      </section>
    );
  }

  return (
    <section className="min-w-0 bg-white/70 p-5 md:p-7">
      <article className="mx-auto max-w-3xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mac-eyebrow">{document.group || document.type}</div>
            <h2 className="mt-2 break-words text-[clamp(2rem,4vw,3.2rem)] font-semibold leading-tight text-slate-950">
              {document.title}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {canDownload && (
              <button type="button" onClick={downloadDocument} className="mac-button mac-button-secondary">
                <Download size={15} />
                MD
              </button>
            )}
            {editMode ? (
              <>
                <button type="button" onClick={onCancel} className="mac-button mac-button-secondary">
                  <X size={15} />
                  Cancel
                </button>
                <button type="button" onClick={onSave} disabled={!dirty || saving} className="mac-button mac-button-primary">
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  Save
                </button>
              </>
            ) : (
              <button type="button" onClick={onEdit} className="mac-button mac-button-secondary">
                <Edit3 size={15} />
                Edit
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
            <MarkdownView content={content} />
          </div>
        )}
      </article>
    </section>
  );
}

function BookshelfPage({ user, projects, loading, error, onBack, onRefresh, onOpenProject, onNewBook }) {
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
                <h1 className="truncate text-base font-semibold text-slate-900">Novel shelf</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={onNewBook} className="mac-button mac-button-primary">
                <Plus size={15} />
                New book
              </button>
              <button type="button" onClick={onRefresh} className="mac-button mac-button-secondary !h-10 !w-10 !rounded-[16px] !p-0" title="Refresh">
                <RefreshCw size={16} />
              </button>
              <button type="button" onClick={onBack} className="mac-button mac-button-secondary">
                <ChevronLeft size={15} />
                Back
              </button>
            </div>
          </div>

          <main className="border-t border-slate-200/70 bg-slate-50/70 p-6 md:p-8">
            <div className="mb-6 flex items-center gap-3">
              <span className="mac-icon-tile h-11 w-11 rounded-[18px]">
                <User size={18} />
              </span>
              <div>
                <div className="text-sm font-semibold text-slate-900">{user?.username || 'User'}</div>
                <div className="text-xs text-slate-500">{projects.length} books</div>
              </div>
            </div>

            {loading ? (
              <div className="flex min-h-[420px] items-center justify-center gap-2 text-sm text-slate-500">
                <Loader2 size={16} className="animate-spin" />
                Loading...
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
                        {project.workflowMode || 'manual'}
                      </span>
                    </div>
                    <h2 className="line-clamp-2 text-xl font-semibold leading-tight text-slate-950">{project.name}</h2>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-500">
                      <div className="rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="font-semibold text-slate-900">{project.chapterCount}</div>
                        <div>chapters</div>
                      </div>
                      <div className="rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="truncate font-semibold text-slate-900">{project.latestChapter || '-'}</div>
                        <div>latest</div>
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
                  <div className="mt-3 text-sm font-semibold text-slate-800">Add new book</div>
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

function NewBookPage({ draft, busy, error, onBack, onDraftChange, onCreateBook }) {
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
                <h1 className="truncate text-base font-semibold text-slate-900">New book</h1>
              </div>
            </div>
            <button type="button" onClick={onBack} className="mac-button mac-button-secondary">
              <ChevronLeft size={15} />
              Shelf
            </button>
          </div>

          <main className="border-t border-slate-200/70 bg-slate-50/70 p-6 md:p-8">
            {error && <div className="mb-5 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
            <div className="grid gap-5 lg:grid-cols-2">
              <Field label="Title" value={draft.name} onChange={(value) => onDraftChange('name', value)} />
              <Field label="Slug" value={draft.slug} onChange={(value) => onDraftChange('slug', value)} />
              <Field label="Worldview" value={draft.worldview} onChange={(value) => onDraftChange('worldview', value)} textarea />
              <Field label="Voice and style" value={draft.style} onChange={(value) => onDraftChange('style', value)} textarea />
              <Field label="Core idea" value={draft.concept} onChange={(value) => onDraftChange('concept', value)} textarea />
              <Field label="Story line" value={draft.outline} onChange={(value) => onDraftChange('outline', value)} textarea />
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={() => onCreateBook(false)} disabled={busy} className="mac-button mac-button-secondary">
                <FolderOpen size={15} />
                Create book
              </button>
              <button type="button" onClick={() => onCreateBook(true)} disabled={busy} className="mac-button mac-button-primary">
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
                Create and generate chapter 1
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
  busy,
  onBack,
  onShelf,
  onNewBook,
  onSelectProject,
  onSelectChapter,
  onSelectMemoryFile,
  onDocumentChange,
  onEditDocument,
  onCancelEdit,
  onSaveDocument,
  onGuidanceChange,
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
                <h1 className="truncate text-base font-semibold text-slate-900">{project?.name || 'Novel workspace'}</h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <JobPill job={job} />
              <button type="button" onClick={onNewBook} className="mac-button mac-button-secondary">
                <Plus size={15} />
                New
              </button>
              <button type="button" onClick={onRefresh} className="mac-button mac-button-secondary !h-10 !w-10 !rounded-[16px] !p-0" title="Refresh">
                <RefreshCw size={16} />
              </button>
              <button type="button" onClick={onShelf} className="mac-button mac-button-secondary">
                <Library size={15} />
                Shelf
              </button>
              <button type="button" onClick={onBack} className="mac-button mac-button-secondary">
                <ChevronLeft size={15} />
                Back
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[760px] items-center justify-center gap-2 border-t border-slate-200/70 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" />
              Loading...
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
                    <div className="truncate text-sm font-semibold text-slate-900">{user?.username || 'User'}</div>
                    <div className="text-xs text-slate-500">Novel workspace</div>
                  </div>
                </div>
                <CodexChat
                  guidance={guidance}
                  job={job}
                  project={project}
                  busy={busy}
                  disabled={busy || jobRunning || !project}
                  onGuidanceChange={onGuidanceChange}
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
  view = 'studio',
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
  onGenerate,
  onRefresh,
}) {
  const activeDocument = selectedDocument || chapterToDocument(selectedChapter, project?.name || selectedProject);

  if (view === 'shelf') {
    return (
      <BookshelfPage
        user={user}
        projects={projects}
        loading={loading}
        error={error}
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
      busy={busy}
      onBack={onBack}
      onShelf={onShelf}
      onNewBook={onNewBook}
      onSelectProject={onSelectProject}
      onSelectChapter={onSelectChapter}
      onSelectMemoryFile={onSelectMemoryFile}
      onDocumentChange={onDocumentChange}
      onEditDocument={onEditDocument}
      onCancelEdit={onCancelEdit}
      onSaveDocument={onSaveDocument}
      onGuidanceChange={onGuidanceChange}
      onGenerate={onGenerate}
      onRefresh={onRefresh}
    />
  );
}

export function NovelWorkspace({ onBack }) {
  const { user } = useAuth();
  const [view, setView] = useState('shelf');
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [project, setProject] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [draftContent, setDraftContent] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [guidance, setGuidance] = useState('');
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

  const generate = useCallback(async (projectName = selectedProject, guidanceOverride = guidance) => {
    if (!projectName || busy || (job && ['running', 'queued'].includes(job.status))) return null;
    setBusy(true);
    setError('');
    try {
      const response = await novelService.generateNextChapter(projectName, guidanceOverride);
      setJob(response.job);
      setGuidance('');
      return response.job;
    } catch (err) {
      setError(err.message || 'Failed to start Codex');
      return null;
    } finally {
      setBusy(false);
    }
  }, [busy, guidance, job, selectedProject]);

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
      view={view}
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
      onGenerate={() => generate()}
      onRefresh={() => {
        refreshProjects();
        if (selectedProject) loadProject(selectedProject);
      }}
    />
  );
}
