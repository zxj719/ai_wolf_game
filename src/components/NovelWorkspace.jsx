import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  FileText,
  Library,
  Loader2,
  MessageSquare,
  PanelRightOpen,
  RefreshCw,
  ScrollText,
  Send,
  Sparkles,
  User,
} from 'lucide-react';
import { novelService } from '../services/novelService';
import { useAuth } from '../contexts/AuthContext';

function compactText(value, fallback = '') {
  return (value || '').trim() || fallback;
}

function previewText(value, limit = 150) {
  const text = (value || '').replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
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

function storyGroupFor(name) {
  const normalized = name.toLowerCase();
  if (normalized.includes('character')) return 'Characters';
  if (normalized.includes('chapter') || normalized.includes('summar')) return 'Summaries';
  if (normalized.includes('timeline')) return 'Timeline';
  if (normalized.includes('foreshadow')) return 'Foreshadowing';
  if (normalized.includes('pacing')) return 'Pacing';
  return 'Core';
}

function groupStorySections(sections) {
  const groups = new Map();
  for (const section of sections) {
    const groupName = storyGroupFor(section.name);
    if (!groups.has(groupName)) groups.set(groupName, []);
    groups.get(groupName).push(section);
  }
  return Array.from(groups.entries()).map(([name, items]) => ({ name, items }));
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
      <div className={`max-w-[86%] rounded-[18px] border px-3.5 py-3 ${
        isUser
          ? 'border-slate-300 bg-slate-950 text-white'
          : isError
            ? 'border-rose-200 bg-rose-50 text-rose-800'
            : 'border-slate-200 bg-white/90 text-slate-700'
      }`}
      >
        <div className={`mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
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

function messageLabel(message) {
  if (message.role === 'user') return 'You';
  if (message.source === 'trace') return 'Codex trace';
  if (message.source === 'stderr') return 'Codex error';
  if (message.source === 'stdout') return 'Codex';
  return message.source || 'Codex';
}

function CodexChat({ guidance, job, project, busy, disabled, onGuidanceChange, onGenerate }) {
  const isRunning = job && ['running', 'queued'].includes(job.status);
  const messages = useMemo(() => {
    if (job?.messages?.length) {
      return job.messages.map((message) => (
        message.source === 'request' ? { ...message, role: 'user' } : { ...message, role: message.role || 'assistant' }
      ));
    }
    if (!job) {
      return [{
        role: 'assistant',
        source: 'system',
        content: '写下这一章要推进的情绪、冲突或伏笔，然后让 Codex 进入 meta_writing 手动工作流。',
      }];
    }
    const fallback = [];
    if (job.guidance) fallback.push({ role: 'user', source: 'request', content: job.guidance });
    if (job.output) fallback.push({ role: 'assistant', source: 'stdout', content: job.output });
    if (job.trace) fallback.push({ role: 'assistant', source: 'trace', content: previewText(job.trace, 1600) });
    if (job.error) fallback.push({ role: 'assistant', source: 'stderr', content: job.error });
    if (!fallback.length) fallback.push({ role: 'assistant', source: 'system', content: `Codex job ${job.status}.` });
    return fallback;
  }, [job]);

  return (
    <div className="mac-panel flex min-h-[430px] flex-col overflow-hidden p-0">
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
        {isRunning && !job?.output && !job?.error && (
          <ChatBubble role="assistant" source="system" label="Codex">
            Codex is starting. Live output will appear here as soon as the process writes stdout or stderr.
          </ChatBubble>
        )}
      </div>

      <div className="border-t border-slate-200/70 bg-white/80 p-3">
        <textarea
          value={guidance}
          onChange={(event) => onGuidanceChange(event.target.value)}
          className="mac-textarea min-h-[104px] resize-none"
          placeholder="这一章要推进的情绪、冲突或伏笔"
        />
        <div className="mt-2 rounded-[14px] border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Target project: <span className="font-semibold text-slate-900">{project?.name || 'select a project'}</span>
          {project?.slug && <span className="ml-2 text-slate-400">/{project.slug}</span>}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 text-xs text-slate-500">
            {isRunning ? <Clock3 size={14} /> : <MessageSquare size={14} />}
            {isRunning ? 'Codex 正在生成，完成后会刷新章节。' : '输出会像聊天记录一样保留在上方。'}
          </div>
          <button
            type="button"
            onClick={onGenerate}
            disabled={disabled || isRunning}
            className={`mac-button shrink-0 ${disabled || isRunning ? 'mac-button-secondary' : 'mac-button-primary'}`}
          >
            <Send size={15} />
            {busy ? '启动中' : isRunning ? '生成中' : '生成下一章'}
          </button>
        </div>
      </div>
    </div>
  );
}

function KnowledgePanel({ project, storySections }) {
  const [activeTab, setActiveTab] = useState('bible');
  const groups = useMemo(() => groupStorySections(storySections), [storySections]);
  const tabs = [
    { id: 'bible', label: 'Story Bible', count: storySections.length },
    { id: 'guidance', label: 'Guidance', count: compactText(project?.creatorGuidance) ? 1 : 0 },
    { id: 'rules', label: 'Rules', count: compactText(project?.learnedRules) ? 1 : 0 },
  ];

  return (
    <div className="mac-panel overflow-hidden p-0">
      <div className="border-b border-slate-200/70 px-4 py-3">
        <div className="mb-3 flex items-center gap-3">
          <span className="mac-icon-tile h-10 w-10 rounded-[16px]">
            <PanelRightOpen size={17} />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Project memory</h3>
            <p className="text-xs text-slate-500">Story Bible, guidance, learned rules</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-[14px] border border-slate-200 bg-slate-100/80 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-[11px] px-2 py-2 text-xs font-semibold transition ${
                activeTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
              <span className="ml-1 text-[10px] text-slate-400">{tab.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="max-h-[440px] overflow-auto p-4">
        {activeTab === 'bible' && (
          <div className="space-y-4">
            {groups.length ? groups.map((group) => (
              <section key={group.name}>
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  <ScrollText size={13} />
                  {group.name}
                </div>
                <div className="space-y-2">
                  {group.items.map((section) => (
                    <details key={section.name} className="rounded-[14px] border border-slate-200 bg-white/85 px-3 py-2">
                      <summary className="cursor-pointer list-none">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-800">{section.name}</div>
                            <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                              {previewText(section.content, 120) || 'Empty file'}
                            </div>
                          </div>
                          <FileText size={15} className="mt-1 shrink-0 text-slate-400" />
                        </div>
                      </summary>
                      <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-[12px] bg-slate-950 p-3 text-xs leading-5 text-slate-100">
                        {section.content}
                      </pre>
                    </details>
                  ))}
                </div>
              </section>
            )) : (
              <div className="rounded-[14px] border border-dashed border-slate-300 bg-white/70 px-4 py-6 text-sm text-slate-500">
                No Story Bible files found.
              </div>
            )}
          </div>
        )}

        {activeTab === 'guidance' && (
          <div className="whitespace-pre-wrap rounded-[14px] border border-slate-200 bg-white/85 p-4 text-sm leading-7 text-slate-700">
            {compactText(project?.creatorGuidance, 'No creator guidance yet.')}
          </div>
        )}

        {activeTab === 'rules' && (
          <div className="whitespace-pre-wrap rounded-[14px] border border-slate-200 bg-white/85 p-4 text-sm leading-7 text-slate-700">
            {compactText(project?.learnedRules, 'No learned rules yet.')}
          </div>
        )}
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
  guidance,
  job,
  busy,
  onBack,
  onSelectProject,
  onSelectChapter,
  onGuidanceChange,
  onGenerate,
  onRefresh,
}) {
  const selectedChapterId = selectedChapter?.id;
  const storySections = project?.storyBible?.sections || [];
  const jobRunning = job && ['running', 'queued'].includes(job.status);

  return (
    <div className="px-4 py-10 md:px-6">
      <div className="mx-auto max-w-[1500px]">
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
                <h1 className="truncate text-base font-semibold text-slate-900">小说工作台</h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <JobPill job={job} />
              <button type="button" onClick={onRefresh} className="mac-button mac-button-secondary !h-10 !w-10 !rounded-[16px] !p-0" title="刷新">
                <RefreshCw size={16} />
              </button>
              <button type="button" onClick={onBack} className="mac-button mac-button-secondary">
                <ChevronLeft size={15} />
                返回
              </button>
            </div>
          </div>

          <main className="grid min-h-[820px] gap-0 border-t border-slate-200/70 xl:grid-cols-[300px_minmax(0,1fr)_430px]">
            <aside className="border-b border-slate-200/70 bg-slate-50/70 p-4 xl:border-b-0 xl:border-r">
              <div className="mb-4 flex items-center gap-3">
                <span className="mac-icon-tile h-10 w-10 rounded-[16px]">
                  <User size={17} />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900">{user?.username || 'User'}</div>
                  <div className="text-xs text-slate-500">Novel workspace</div>
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
                      {item.name} ({item.chapterCount} chapters)
                    </option>
                  ))}
                </select>
                <div className="mt-2 text-xs leading-5 text-slate-500">
                  New chapters will be generated only for this selected project.
                </div>
              </label>

              <div className="space-y-3">
                <div className="mac-eyebrow">Projects</div>
                {projects.map((item) => (
                  <button
                    key={item.slug || item.name}
                    type="button"
                    onClick={() => onSelectProject(item.slug || item.name)}
                    disabled={jobRunning}
                    className={`mac-list-row w-full text-left transition-colors ${
                      selectedProject === (item.slug || item.name) ? 'bg-white shadow-sm' : 'hover:bg-white/90'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="mac-icon-tile h-9 w-9 rounded-[14px]">
                        <Library size={16} />
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">{item.name}</div>
                        <div className="text-xs text-slate-500">{item.chapterCount} chapters</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-6 space-y-3">
                <div className="mac-eyebrow">Chapters</div>
                {(project?.chapters || []).map((chapter) => (
                  <button
                    key={chapter.id}
                    type="button"
                    onClick={() => onSelectChapter(chapter.id)}
                    className={`w-full rounded-[16px] border px-3 py-3 text-left transition-colors ${
                      selectedChapterId === chapter.id
                        ? 'border-slate-300 bg-white shadow-sm'
                        : 'border-transparent hover:border-slate-200 hover:bg-white/80'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <FileText size={15} />
                      <span className="truncate">{chapter.title}</span>
                    </div>
                    <div className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{chapter.excerpt}</div>
                  </button>
                ))}
              </div>
            </aside>

            <section className="min-w-0 bg-white/70 p-5 md:p-7">
              {loading ? (
                <div className="flex min-h-[520px] items-center justify-center gap-2 text-sm text-slate-500">
                  <Loader2 size={16} className="animate-spin" />
                  Loading...
                </div>
              ) : error ? (
                <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
              ) : selectedChapter ? (
                <article className="mx-auto max-w-3xl">
                  <div className="mb-6 flex items-start justify-between gap-4">
                    <div>
                      <div className="mac-eyebrow">{project?.name || selectedProject}</div>
                      <h2 className="mt-2 text-[clamp(2rem,4vw,3.4rem)] font-semibold text-slate-950">{selectedChapter.title}</h2>
                    </div>
                    <span className="mac-icon-tile">
                      <BookOpen size={18} />
                    </span>
                  </div>
                  <div className="whitespace-pre-wrap text-base leading-8 text-slate-700">{selectedChapter.content}</div>
                </article>
              ) : (
                <div className="flex min-h-[520px] items-center justify-center text-sm text-slate-500">Select a chapter</div>
              )}
            </section>

            <aside className="space-y-4 border-t border-slate-200/70 bg-slate-50/80 p-4 xl:border-l xl:border-t-0">
              <CodexChat
                guidance={guidance}
                job={job}
                project={project}
                busy={busy}
                disabled={busy || jobRunning || !project}
                onGuidanceChange={onGuidanceChange}
                onGenerate={onGenerate}
              />
              <KnowledgePanel project={project} storySections={storySections} />
            </aside>
          </main>
        </div>
      </div>
    </div>
  );
}

export function NovelWorkspace({ onBack }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [project, setProject] = useState(null);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [guidance, setGuidance] = useState('');
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const loadRequestRef = useRef(0);

  const refreshProjects = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const response = await novelService.listProjects();
      const nextProjects = response.projects || [];
      setProjects(nextProjects);
      setSelectedProject((current) => current || nextProjects[0]?.slug || nextProjects[0]?.name || '');
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
        setSelectedChapter(chapter.chapter);
      } else {
        setSelectedChapter(null);
      }
    } catch (err) {
      if (requestId !== loadRequestRef.current) return;
      setError(err.message || 'Failed to load project');
    } finally {
      if (requestId === loadRequestRef.current) setLoading(false);
    }
  }, []);

  const selectProject = useCallback((name) => {
    setSelectedProject(name);
    setProject(null);
    setSelectedChapter(null);
    setJob(null);
    setError('');
  }, []);

  const selectChapter = useCallback(async (chapterId) => {
    if (!selectedProject || !chapterId) return;
    setError('');
    try {
      const response = await novelService.getChapter(selectedProject, chapterId);
      setSelectedChapter(response.chapter);
    } catch (err) {
      setError(err.message || 'Failed to load chapter');
    }
  }, [selectedProject]);

  const generate = useCallback(async () => {
    if (!selectedProject || busy || (job && ['running', 'queued'].includes(job.status))) return;
    setBusy(true);
    setError('');
    try {
      const response = await novelService.generateNextChapter(selectedProject, guidance);
      setJob(response.job);
      setGuidance('');
    } catch (err) {
      setError(err.message || 'Failed to start Codex');
    } finally {
      setBusy(false);
    }
  }, [busy, guidance, job, selectedProject]);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  useEffect(() => {
    loadProject(selectedProject);
  }, [loadProject, selectedProject]);

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

  return (
    <NovelWorkspaceView
      user={user}
      loading={loading}
      error={error}
      projects={projects}
      selectedProject={selectedProjectKey}
      project={project}
      selectedChapter={selectedChapter}
      guidance={guidance}
      job={job}
      busy={busy}
      onBack={onBack}
      onSelectProject={selectProject}
      onSelectChapter={selectChapter}
      onGuidanceChange={setGuidance}
      onGenerate={generate}
      onRefresh={() => {
        refreshProjects();
        if (selectedProject) loadProject(selectedProject);
      }}
    />
  );
}
