import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  ChevronLeft,
  FileText,
  Library,
  PanelRightOpen,
  RefreshCw,
  Send,
  Sparkles,
  User,
} from 'lucide-react';
import { novelService } from '../services/novelService';
import { useAuth } from '../contexts/AuthContext';

function compactText(value, fallback = '') {
  return (value || '').trim() || fallback;
}

function JobPill({ job }) {
  if (!job) return null;
  const color = job.status === 'completed'
    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
    : job.status === 'failed'
      ? 'text-rose-700 bg-rose-50 border-rose-200'
      : 'text-blue-700 bg-blue-50 border-blue-200';
  return (
    <div className={`rounded-[16px] border px-3 py-2 text-xs font-medium ${color}`}>
      Codex job: {job.status}
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

  return (
    <div className="px-4 py-10 md:px-6">
      <div className="mx-auto max-w-7xl">
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

          <main className="grid min-h-[760px] gap-0 border-t border-slate-200/70 lg:grid-cols-[280px_1fr_360px]">
            <aside className="border-b border-slate-200/70 bg-slate-50/70 p-4 lg:border-b-0 lg:border-r">
              <div className="mb-4 flex items-center gap-3">
                <span className="mac-icon-tile h-10 w-10 rounded-[16px]">
                  <User size={17} />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900">{user?.username || 'User'}</div>
                  <div className="text-xs text-slate-500">Novel workspace</div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="mac-eyebrow">Projects</div>
                {projects.map((item) => (
                  <button
                    key={item.slug || item.name}
                    type="button"
                    onClick={() => onSelectProject(item.slug || item.name)}
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
                <div className="flex min-h-[520px] items-center justify-center text-sm text-slate-500">Loading...</div>
              ) : error ? (
                <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
              ) : selectedChapter ? (
                <article className="mx-auto max-w-3xl">
                  <div className="mb-6 flex items-start justify-between gap-4">
                    <div>
                      <div className="mac-eyebrow">{project?.name || selectedProject}</div>
                      <h2 className="mt-2 text-[clamp(2rem,4vw,3.5rem)] font-semibold text-slate-950">{selectedChapter.title}</h2>
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

            <aside className="space-y-4 border-t border-slate-200/70 bg-slate-50/80 p-4 lg:border-l lg:border-t-0">
              <div className="mac-panel p-4">
                <div className="mb-3 flex items-center gap-3">
                  <span className="mac-icon-tile h-10 w-10 rounded-[16px]">
                    <Sparkles size={17} />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Codex</h3>
                    <p className="text-xs text-slate-500">{project?.workflowMode || 'manual'} mode</p>
                  </div>
                </div>
                <textarea
                  value={guidance}
                  onChange={(event) => onGuidanceChange(event.target.value)}
                  className="mac-textarea min-h-[130px]"
                  placeholder="这一章要推进的情绪、冲突或伏笔"
                />
                <button
                  type="button"
                  onClick={onGenerate}
                  disabled={busy || !project}
                  className={`mac-button mt-3 w-full justify-center ${busy || !project ? 'mac-button-secondary' : 'mac-button-primary'}`}
                >
                  <Send size={15} />
                  {busy ? '生成中' : '生成下一章'}
                </button>
                {job?.output && (
                  <pre className="mt-3 max-h-36 overflow-auto rounded-[14px] bg-slate-950 p-3 text-xs leading-5 text-slate-100">
                    {job.output}
                  </pre>
                )}
                {job?.error && (
                  <pre className="mt-3 max-h-28 overflow-auto rounded-[14px] bg-rose-950 p-3 text-xs leading-5 text-rose-50">
                    {job.error}
                  </pre>
                )}
              </div>

              <div className="mac-panel p-4">
                <div className="mb-3 flex items-center gap-3">
                  <span className="mac-icon-tile h-10 w-10 rounded-[16px]">
                    <PanelRightOpen size={17} />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Story Bible</h3>
                    <p className="text-xs text-slate-500">{storySections.length} files</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {storySections.slice(0, 12).map((section) => (
                    <details key={section.name} className="rounded-[14px] border border-slate-200 bg-white/80 px-3 py-2">
                      <summary className="cursor-pointer text-sm font-medium text-slate-800">{section.name}</summary>
                      <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-500">
                        {section.content}
                      </pre>
                    </details>
                  ))}
                </div>
              </div>

              <div className="mac-panel p-4">
                <div className="mac-eyebrow">Guidance</div>
                <div className="mt-3 max-h-44 overflow-auto whitespace-pre-wrap text-sm leading-6 text-slate-600">
                  {compactText(project?.creatorGuidance, 'No creator guidance yet.')}
                </div>
              </div>

              <div className="mac-panel p-4">
                <div className="mac-eyebrow">Learned Rules</div>
                <div className="mt-3 max-h-44 overflow-auto whitespace-pre-wrap text-sm leading-6 text-slate-600">
                  {compactText(project?.learnedRules, 'No learned rules yet.')}
                </div>
              </div>
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
    setError('');
    setLoading(true);
    try {
      const response = await novelService.getProject(name);
      const nextProject = response.project;
      setProject(nextProject);
      const latest = nextProject.chapters?.at(-1);
      if (latest) {
        const chapter = await novelService.getChapter(name, latest.id);
        setSelectedChapter(chapter.chapter);
      } else {
        setSelectedChapter(null);
      }
    } catch (err) {
      setError(err.message || 'Failed to load project');
    } finally {
      setLoading(false);
    }
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
    if (!selectedProject || busy) return;
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
  }, [busy, guidance, selectedProject]);

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
    }, 4000);
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
      onSelectProject={setSelectedProject}
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
