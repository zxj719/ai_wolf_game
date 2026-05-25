import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  FileAudio,
  Library,
  Loader2,
  Music4,
  Play,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
} from 'lucide-react';
import { StemPlayer } from './StemPlayer';
import { createChordsJob, deletePublishedSong, getChordsJob, listChordsJobs } from '../services/chordsService.js';
import { useAuth } from '../contexts/AuthContext';

const IS_DEV = import.meta.env.DEV;
const STEM_ORDER = ['vocals', 'drums', 'bass', 'guitar', 'piano', 'other'];
const MAX_TAGS = 4;

function getCopy(locale) {
  if (locale === 'en') {
    return {
      title: 'Music arrangement lab',
      subtitle: 'Stem separation and arrangement analysis.',
      description: 'Browse pre-analyzed tracks with stem players, arrangement maps, and section-by-section notes.',
      back: 'Back',
      pickFile: 'Pick audio file',
      browse: 'Upload an MP3',
      fileHint: 'MP3 / WAV / M4A, up to 25 MB',
      privacy: 'The file is sent to your local Demucs service for processing.',
      invalidType: 'Please upload an MP3, WAV, or M4A file.',
      invalidSize: 'The file is too large. Keep it under 25 MB.',
      analyze: 'Start local analysis',
      analyzing: 'Running',
      audioTitle: 'Track preview',
      optionsTitle: 'Pipeline options',
      fastMode: 'Fast 4-stem mode',
      fastModeHelp: 'Use the lighter 4-stem Demucs model.',
      resynth: 'Skip resynth',
      resynthHelp: 'Generate the player without resynthesis artifacts.',
      splitVocals: 'Split vocals',
      splitVocalsHelp: 'Optionally separate the vocal stem into harmony parts.',
      statusTitle: 'Local job',
      queueingCopy: 'Queued for local processing.',
      processingCopy: 'Demucs + librosa running locally. This may take a few minutes.',
      duration: 'Duration',
      bpm: 'BPM',
      key: 'Key',
      status: 'Status',
      noSummary: 'No summary available.',
      noCallout: 'Not called out',
      galleryTitle: 'Analyzed tracks',
      gallerySubtitle: 'Select a track to view its full arrangement analysis.',
      galleryEmpty: 'No analyzed tracks yet. Check back later!',
      galleryLoading: 'Loading tracks…',
      selectPrompt: 'Select a track from the list to see its arrangement analysis.',
      confirmDelete: 'Remove this track from the library?',
      deleteSuccess: 'Removed from library',
      jobId: 'Job ID',
      progress: 'Progress',
      hook: 'Hook',
      climax: 'Climax',
      energyOpen: 'open',
      tabOverview: 'Overview',
      tabSections: 'Sections',
      tabListening: 'Listening',
      stemRolesTitle: 'Stem roles',
      role: 'Role',
      timbre: 'Timbre',
      arrMethod: 'Arrangement',
      noListeningFocus: 'No listening prompts available.',
      noMixNotes: 'No mix notes available.',
      noSections: 'No section notes available.',
      focusTitle: 'Listening focus',
      mixTitle: 'Mix highlights',
      songInfoLabel: 'Song info',
      songInfoPlaceholder: 'Artist, song title, album, year — helps enrich the analysis with real data',
    };
  }

  return {
    title: '编曲分析实验室',
    subtitle: '分轨（Stem Separation）与编曲分析',
    description: '浏览已分析的曲目，查看分轨播放器、编曲总览和分段说明。',
    back: '返回',
    pickFile: '选择音频文件',
    browse: '上传音频',
    fileHint: '支持 MP3 / WAV / M4A，最大 25 MB',
    privacy: '文件会发送到本地 Demucs 服务进行处理，不会上传至云端。',
    invalidType: '请上传 MP3、WAV 或 M4A 文件。',
    invalidSize: '文件过大，请控制在 25 MB 以内。',
    analyze: '开始本地分析',
    analyzing: '分析中',
    audioTitle: '音频预览',
    optionsTitle: '分析选项',
    fastMode: '快速 4 轨模式',
    fastModeHelp: '使用更轻量的 4 轨（Stem）Demucs 模型，速度更快。',
    resynth: '跳过重合成（Resynth）',
    resynthHelp: '生成播放器，但不额外生成重合成产物。',
    splitVocals: '人声拆分',
    splitVocalsHelp: '将人声轨继续拆分为多个声部（Harmony Parts）。',
    statusTitle: '本地任务',
    queueingCopy: '已提交到本地处理队列。',
    processingCopy: '正在运行 Demucs 分轨 + librosa 分析，每首歌通常需要几分钟。',
    duration: '时长',
    bpm: 'BPM',
    key: '调性',
    status: '状态',
    noSummary: '暂无摘要。',
    noCallout: '暂无标注',
    galleryTitle: '已分析曲目',
    gallerySubtitle: '选择一首曲目查看完整编曲分析。',
    galleryEmpty: '暂无已分析的曲目，敬请期待！',
    galleryLoading: '加载中…',
    selectPrompt: '从左侧列表选择一首曲目，查看编曲分析。',
    confirmDelete: '确定要从曲库中移除这首曲目吗？',
    deleteSuccess: '已从曲库移除',
    jobId: '任务 ID',
    progress: '进度',
    hook: '记忆点（Hook）',
    climax: '高潮段（Climax）',
    energyOpen: '开放',
    tabOverview: '总览',
    tabSections: '段落',
    tabListening: '聆听',
    stemRolesTitle: '音轨角色',
    role: '角色',
    timbre: '音色',
    arrMethod: '编曲',
    noListeningFocus: '暂无重点聆听建议。',
    noMixNotes: '暂无混音说明。',
    noSections: '暂无分段说明。',
    focusTitle: '重点聆听',
    mixTitle: '混音亮点（Mix Highlights）',
    songInfoLabel: '歌曲信息',
    songInfoPlaceholder: '歌手、曲名、专辑、年份 — 用于检索真实资料以丰富分析',
  };
}

function formatSeconds(seconds) {
  const total = Math.max(0, Math.round(seconds || 0));
  const minutes = Math.floor(total / 60);
  const remaining = total % 60;
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
}

function formatBytes(bytes) {
  if (!bytes) return '0 MB';
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function parseTimestamp(text) {
  let m;
  m = text.match(/at\s+(\d+):(\d{2})/);
  if (m) return parseInt(m[1]) * 60 + parseInt(m[2]);
  m = text.match(/\((\d+):(\d{2})/);
  if (m) return parseInt(m[1]) * 60 + parseInt(m[2]);
  m = text.match(/(\d+):(\d{2})s?\b/);
  if (m) return parseInt(m[1]) * 60 + parseInt(m[2]);
  m = text.match(/(\d+(?:\.\d+)?)s[处时起\s,，]/);
  if (m) return parseFloat(m[1]);
  m = text.match(/at\s+(\d+)s/);
  if (m) return parseInt(m[1]);
  m = text.match(/\((\d+(?:\.\d+)?)s/);
  if (m) return parseFloat(m[1]);
  m = text.match(/(?:^|[\s（(])(\d+(?:\.\d+)?)s(?:\b|$)/);
  if (m) return parseFloat(m[1]);
  return null;
}

function findSnippetEnd(sections, startTime) {
  const sec = sections?.find(s => startTime >= s.time_start && startTime < s.time_end);
  return sec ? sec.time_end : startTime + 15;
}

function deriveStemUrls(song) {
  if (!song) return [];
  const stemArtifacts = (song.artifacts || []).filter(a => a.kind === 'stem');
  if (stemArtifacts.length > 0) {
    return stemArtifacts
      .map(a => {
        const nameMatch = a.name.match(/_([a-z]+)\.(mp3|wav)$/i);
        return { name: nameMatch ? nameMatch[1] : a.name, url: a.url };
      })
      .sort((a, b) => (STEM_ORDER.indexOf(a.name) === -1 ? 99 : STEM_ORDER.indexOf(a.name)) - (STEM_ORDER.indexOf(b.name) === -1 ? 99 : STEM_ORDER.indexOf(b.name)));
  }
  if (song.analysis?.stems && song.id) {
    return Object.keys(song.analysis.stems)
      .sort((a, b) => (STEM_ORDER.indexOf(a) === -1 ? 99 : STEM_ORDER.indexOf(a)) - (STEM_ORDER.indexOf(b) === -1 ? 99 : STEM_ORDER.indexOf(b)))
      .map(name => ({
        name,
        url: `/api/chords/published/${encodeURIComponent(song.id)}/${encodeURIComponent(song.id)}_${name}.mp3`,
      }));
  }
  return [];
}

const ENERGY_BADGE = {
  low: 'bg-sky-50 text-sky-600 ring-sky-200/60',
  medium: 'bg-amber-50 text-amber-600 ring-amber-200/60',
  high: 'bg-rose-50 text-rose-600 ring-rose-200/60',
};

function TagList({ items }) {
  if (!items.length) return null;
  const limited = items.slice(0, MAX_TAGS);
  return (
    <div className="flex flex-wrap gap-1.5">
      {limited.map((item) => (
        <span key={item} className="mac-badge text-[11px]">{item}</span>
      ))}
    </div>
  );
}

function OptionToggle({ checked, onChange, title, description }) {
  return (
    <label className="rounded-[18px] border border-slate-200/70 bg-white/72 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <div className="mt-1 text-sm leading-6 text-slate-500">{description}</div>
        </div>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
        />
      </div>
    </label>
  );
}

function GalleryCard({ song, isActive, onSelect, canDelete, onDelete }) {
  const arr = song.arrangement || {};
  const st = song.analysis || {};
  return (
    <div className={`mac-list-row w-full text-left transition-colors ${isActive ? 'bg-slate-100 ring-1 ring-slate-300' : 'hover:bg-white/90'}`}>
      <button type="button" onClick={() => onSelect(song)} className="flex flex-1 items-center gap-3">
        <span className="mac-icon-tile h-10 w-10 rounded-[16px]">
          <Music4 size={17} />
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-900">{song.sourceFilename || song.id}</div>
          <div className="flex items-center gap-3 text-sm text-slate-500">
            {st?.bpm ? <span>{st.bpm} BPM</span> : null}
            {st?.key?.key ? <span>{st.key.key} {st.key.mode || ''}</span> : null}
            {arr.style_tags?.length ? <span>{arr.style_tags[0]}</span> : null}
          </div>
        </div>
      </button>
      {canDelete ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(song); }}
          className="ml-2 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500"
        >
          <Trash2 size={15} />
        </button>
      ) : null}
    </div>
  );
}

function SectionCard({ section, onPlay, copy }) {
  const [open, setOpen] = useState(false);
  const badge = ENERGY_BADGE[section.energy] || 'bg-slate-50 text-slate-500 ring-slate-200/60';
  return (
    <div className="rounded-[16px] border border-slate-200/70 bg-white/74 transition-colors hover:bg-white/90">
      <div
        role="button"
        tabIndex={0}
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left"
        onClick={() => setOpen(o => !o)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(o => !o); } }}
      >
        <button
          type="button"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white hover:bg-slate-700"
          onClick={(e) => { e.stopPropagation(); onPlay(section.time_start, section.time_end); }}
        >
          <Play size={10} className="ml-px" />
        </button>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">{section.name}</span>
        <span className="text-[11px] tabular-nums text-slate-400">{formatSeconds(section.time_start)} – {formatSeconds(section.time_end)}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${badge}`}>
          {section.energy || copy.energyOpen}
        </span>
        <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>
      {open ? (
        <div className="space-y-2 border-t border-slate-100 px-3 py-3 text-sm leading-6 text-slate-600">
          {section.function ? <p>{section.function}</p> : null}
          {section.arrangement_notes?.length ? (
            <div className="space-y-1">
              {section.arrangement_notes.map((n, i) => (
                <div key={i} className="mac-list-row text-sm text-slate-600">{n}</div>
              ))}
            </div>
          ) : null}
          {section.transition ? (
            <p className="text-slate-500">→ {section.transition}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function FocusItem({ item, onPlay }) {
  const isObj = item && typeof item === 'object';
  const text = isObj ? item.text : String(item || '');
  const ts = isObj && typeof item.time === 'number' ? item.time : parseTimestamp(text);
  return (
    <div className="flex items-start gap-2 rounded-[14px] border border-slate-200/70 bg-white/74 px-3 py-2.5">
      {ts !== null ? (
        <button
          type="button"
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white hover:bg-slate-700 active:scale-95"
          onClick={() => onPlay(ts)}
          title={`${Math.floor(ts / 60)}:${String(Math.round(ts) % 60).padStart(2, '0')}`}
        >
          <Play size={9} className="ml-px" />
        </button>
      ) : (
        <span className="mt-0.5 h-6 w-6 shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <span className="text-sm leading-6 text-slate-600">{text}</span>
        {ts !== null ? (
          <span className="ml-1.5 inline-block rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] tabular-nums text-slate-400">
            {Math.floor(ts / 60)}:{String(Math.round(ts) % 60).padStart(2, '0')}
          </span>
        ) : null}
      </div>
    </div>
  );
}

const TABS = ['tabOverview', 'tabSections', 'tabListening'];

const MAX_FILE_SIZE = 25 * 1024 * 1024;

export function ChordsPage({ onBack, locale = 'zh' }) {
  const { isAdmin } = useAuth();
  const copy = getCopy(locale);
  const canUpload = IS_DEV && isAdmin;

  const playerRef = useRef(null);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState('tabOverview');

  const [selectedFile, setSelectedFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const [songInfo, setSongInfo] = useState('');
  const [options, setOptions] = useState({ fourStems: false, noResynth: false, splitVocals: 0 });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listChordsJobs()
      .then((results) => { if (!cancelled) setSongs(results); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    return () => { if (audioUrl) URL.revokeObjectURL(audioUrl); };
  }, [audioUrl]);

  useEffect(() => {
    if (!job?.id || job.status === 'completed' || job.status === 'failed') return undefined;
    const tid = window.setTimeout(async () => {
      try { setJob(await getChordsJob(job.id)); }
      catch (e) { setError(e.message || 'Poll failed.'); }
    }, job.status === 'queued' ? 1500 : 4000);
    return () => window.clearTimeout(tid);
  }, [job]);

  const activeJob = selected || (job?.status === 'completed' ? job : null);

  const stemUrls = useMemo(() => deriveStemUrls(activeJob), [activeJob]);

  const arrangement = activeJob?.arrangement || {
    summary: '', style_tags: [], mood_tags: [],
    listening_focus: [], mix_highlights: [], sections: [],
    hook_moment: '', climax_moment: '', stem_roles: {},
  };

  const stats = activeJob?.analysis || null;
  const allTags = [...(arrangement.style_tags || []), ...(arrangement.mood_tags || [])];

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/\.(mp3|wav|m4a)$/i.test(f.name) && !f.type.startsWith('audio/')) { setError(copy.invalidType); return; }
    if (f.size > MAX_FILE_SIZE) { setError(copy.invalidSize); return; }
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setSelectedFile(f);
    setAudioUrl(URL.createObjectURL(f));
    setJob(null);
    setSelected(null);
    setError('');
  };

  const handleDelete = async (song) => {
    if (!window.confirm(copy.confirmDelete)) return;
    try {
      await deletePublishedSong(song.id);
      setSongs((prev) => prev.filter((s) => s.id !== song.id));
      if (selected?.id === song.id) setSelected(null);
    } catch (e) { setError(e.message || 'Delete failed.'); }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;
    try {
      setError('');
      setJob(await createChordsJob(selectedFile, { ...options, songInfo }));
    } catch (e) { setError(e.message || 'Failed to start job.'); }
  };

  const handlePlaySnippet = (start, end) => {
    playerRef.current?.playSnippet(start, end);
  };

  const handlePlayTimestamp = (ts) => {
    const end = findSnippetEnd(arrangement.sections, ts);
    playerRef.current?.playSnippet(ts, end);
  };

  const isBusy = job?.status === 'queued' || job?.status === 'processing';

  return (
    <div className="px-4 py-16 md:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mac-window">
          <div className="mac-toolbar rounded-t-[24px]">
            <div className="flex items-center gap-4">
              <div className="mac-window-chrome">
                <span className="mac-window-dot mac-dot-red" />
                <span className="mac-window-dot mac-dot-yellow" />
                <span className="mac-window-dot mac-dot-green" />
              </div>
              <div>
                <div className="mac-eyebrow">炸小鸡工作室</div>
                <h1 className="text-base font-semibold text-slate-900">{copy.title}</h1>
              </div>
            </div>
            <button type="button" onClick={onBack} className="mac-button mac-button-secondary">
              <ChevronLeft size={15} />
              {copy.back}
            </button>
          </div>

          <main className="grid gap-8 px-6 py-8 lg:grid-cols-[0.85fr_1.15fr] lg:px-8">
            {/* ── Left column ── */}
            <section className="space-y-5">
              <div className="space-y-4">
                <div className="mac-eyebrow">{copy.subtitle}</div>
                <h2 className="text-[clamp(2rem,4.5vw,3.2rem)] font-semibold tracking-tight text-slate-950">
                  {copy.title}
                </h2>
                <p className="max-w-2xl text-base leading-7 text-slate-500">{copy.description}</p>
              </div>

              {/* Admin upload — dev only */}
              {canUpload ? (
                <>
                  <div className="mac-panel p-5 md:p-6">
                    <div className="mb-4 flex items-center gap-3">
                      <span className="mac-icon-tile"><Upload size={18} /></span>
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">{copy.pickFile}</h3>
                        <p className="text-sm text-slate-500">{copy.fileHint}</p>
                      </div>
                    </div>
                    <div className="grid gap-4">
                      <label className="flex cursor-pointer items-center justify-center rounded-[22px] border border-dashed border-slate-300 bg-white/72 px-5 py-8 text-center transition-colors hover:border-slate-400 hover:bg-white/84">
                        <input type="file" accept=".mp3,.wav,.m4a,audio/*" className="hidden" onChange={handleFileChange} />
                        <div className="space-y-3">
                          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
                            <FileAudio size={22} />
                          </div>
                          <div className="text-sm font-semibold text-slate-900">{selectedFile ? selectedFile.name : copy.browse}</div>
                          <div className="text-sm text-slate-500">{copy.privacy}</div>
                        </div>
                      </label>

                      {selectedFile ? (
                        <div className="rounded-[20px] border border-slate-200/70 bg-white/70 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-slate-900">{selectedFile.name}</div>
                              <div className="text-sm text-slate-500">{formatBytes(selectedFile.size)}</div>
                            </div>
                            <button type="button" onClick={handleAnalyze} disabled={isBusy} className="mac-button mac-button-primary">
                              {isBusy ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
                              {isBusy ? copy.analyzing : copy.analyze}
                            </button>
                          </div>
                        </div>
                      ) : null}

                      <div className="rounded-[20px] border border-slate-200/70 bg-white/70 p-4">
                        <div className="mb-2 text-sm font-semibold text-slate-900">{copy.songInfoLabel}</div>
                        <textarea
                          rows={2}
                          value={songInfo}
                          onChange={(e) => setSongInfo(e.target.value)}
                          placeholder={copy.songInfoPlaceholder}
                          className="w-full resize-none rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
                        />
                      </div>

                      {audioUrl ? (
                        <div className="rounded-[20px] border border-slate-200/70 bg-white/70 p-4">
                          <div className="mb-2 text-sm font-semibold text-slate-900">{copy.audioTitle}</div>
                          <audio controls className="w-full" src={audioUrl}><track kind="captions" /></audio>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="mac-panel p-5">
                    <div className="mb-4 flex items-center gap-3">
                      <span className="mac-icon-tile"><Music4 size={18} /></span>
                      <h3 className="text-base font-semibold text-slate-900">{copy.optionsTitle}</h3>
                    </div>
                    <div className="grid gap-3">
                      <OptionToggle checked={options.fourStems} onChange={(v) => setOptions((c) => ({ ...c, fourStems: v }))} title={copy.fastMode} description={copy.fastModeHelp} />
                      <OptionToggle checked={options.noResynth} onChange={(v) => setOptions((c) => ({ ...c, noResynth: v }))} title={copy.resynth} description={copy.resynthHelp} />
                      <label className="rounded-[18px] border border-slate-200/70 bg-white/72 p-4">
                        <div className="text-sm font-semibold text-slate-900">{copy.splitVocals}</div>
                        <div className="mt-1 text-sm leading-6 text-slate-500">{copy.splitVocalsHelp}</div>
                        <select className="mac-select mt-3" value={options.splitVocals} onChange={(e) => setOptions((c) => ({ ...c, splitVocals: Number(e.target.value) }))}>
                          <option value={0}>0</option>
                          <option value={2}>2</option>
                          <option value={3}>3</option>
                          <option value={4}>4</option>
                        </select>
                      </label>
                    </div>
                  </div>
                </>
              ) : null}

              {/* Gallery — always visible */}
              <div className="mac-panel p-5">
                <div className="mb-4 flex items-center gap-3">
                  <span className="mac-icon-tile"><Library size={18} /></span>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">{copy.galleryTitle}</h3>
                    <p className="text-sm text-slate-500">{copy.gallerySubtitle}</p>
                  </div>
                </div>
                {loading ? (
                  <div className="flex items-center gap-2 py-6 text-sm text-slate-400">
                    <Loader2 size={15} className="animate-spin" /> {copy.galleryLoading}
                  </div>
                ) : songs.length === 0 ? (
                  <div className="py-6 text-center text-sm text-slate-400">{copy.galleryEmpty}</div>
                ) : (
                  <div className="grid gap-2">
                    {songs.map((s) => (
                      <GalleryCard
                        key={s.id}
                        song={s}
                        isActive={selected?.id === s.id}
                        canDelete={canUpload}
                        onSelect={(sel) => { setSelected(sel); setJob(null); setTab('tabOverview'); }}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* ── Right column ── */}
            <section className="space-y-4">
              {/* Job progress (dev upload only) */}
              {job && !selected ? (
                <div className="mac-panel p-6">
                  <div className="mb-4 flex items-center gap-3">
                    <span className="mac-icon-tile">
                      {isBusy ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                    </span>
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">{copy.statusTitle}</h3>
                      <p className="text-sm text-slate-500">
                        {job.status === 'queued' ? copy.queueingCopy : job.status === 'processing' ? copy.processingCopy : job.step}
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="mac-muted-card">
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-400">{copy.status}</div>
                      <div className="mt-2 text-lg font-semibold capitalize text-slate-900">{job.status}</div>
                    </div>
                    <div className="mac-muted-card">
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-400">{copy.jobId}</div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">{job.id}</div>
                    </div>
                    <div className="mac-muted-card">
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-400">{copy.progress}</div>
                      <div className="mt-2 text-lg font-semibold text-slate-900">{Math.round(job.progress * 100)}%</div>
                    </div>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-all duration-500" style={{ width: `${Math.max(6, Math.round(job.progress * 100))}%` }} />
                  </div>
                  <div className="mt-3 text-sm text-slate-500">{job.step}</div>
                </div>
              ) : null}

              {error ? (
                <div className="rounded-[24px] border border-rose-200 bg-rose-50/90 p-5 text-sm leading-6 text-rose-700">{error}</div>
              ) : null}

              {/* Empty state */}
              {!activeJob && !job ? (
                <div className="mac-panel p-6">
                  <div className="text-base font-semibold text-slate-900">{copy.galleryTitle}</div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{copy.selectPrompt}</p>
                </div>
              ) : null}

              {/* ── Active song detail ── */}
              {activeJob ? (
                <>
                  {/* Integrated stem player */}
                  {stemUrls.length > 0 ? (
                    <StemPlayer
                      ref={playerRef}
                      stemUrls={stemUrls}
                      sections={arrangement.sections}
                      duration={stats?.duration || 0}
                    />
                  ) : null}

                  {/* Tab bar */}
                  <div className="flex gap-1 rounded-[14px] bg-slate-100/80 p-1">
                    {TABS.map(t => (
                      <button
                        key={t}
                        type="button"
                        className={`flex-1 rounded-[10px] px-3 py-1.5 text-sm font-medium transition-colors ${tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        onClick={() => setTab(t)}
                      >
                        {copy[t]}
                      </button>
                    ))}
                  </div>

                  {/* ── Tab: Overview ── */}
                  {tab === 'tabOverview' ? (
                    <div className="space-y-4">
                      {/* Stats + summary */}
                      {stats ? (
                        <div className="mac-panel p-5">
                          <div className="mb-4 flex items-center gap-3">
                            <span className="mac-icon-tile"><Sparkles size={18} /></span>
                            <div className="min-w-0 flex-1">
                              <h3 className="text-base font-semibold text-slate-900">
                                {arrangement.artist
                                  ? `${activeJob.title || activeJob.sourceFilename || activeJob.id} — ${arrangement.artist}`
                                  : (activeJob.title || activeJob.sourceFilename || activeJob.id)}
                              </h3>
                              {arrangement.album && (
                                <p className="text-xs text-slate-400">{arrangement.album}{arrangement.credits ? ` · ${arrangement.credits}` : ''}</p>
                              )}
                              <p className="mt-1 text-sm leading-6 text-slate-500">{arrangement.summary || copy.noSummary}</p>
                            </div>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="mac-muted-card">
                              <div className="text-xs uppercase tracking-[0.22em] text-slate-400">{copy.duration}</div>
                              <div className="mt-2 text-lg font-semibold text-slate-900">{formatSeconds(stats.duration)}</div>
                            </div>
                            <div className="mac-muted-card">
                              <div className="text-xs uppercase tracking-[0.22em] text-slate-400">{copy.bpm}</div>
                              <div className="mt-2 text-lg font-semibold text-slate-900">{stats.bpm || '-'}</div>
                            </div>
                            <div className="mac-muted-card">
                              <div className="text-xs uppercase tracking-[0.22em] text-slate-400">{copy.key}</div>
                              <div className="mt-2 text-lg font-semibold text-slate-900">
                                {stats.key?.key ? `${stats.key.key} ${stats.key.mode || ''}` : '-'}
                              </div>
                            </div>
                          </div>
                          {allTags.length > 0 ? (
                            <div className="mt-4">
                              <TagList items={allTags} />
                            </div>
                          ) : null}
                          <div className="mt-4 grid gap-3 md:grid-cols-2">
                            <div className="mac-muted-card">
                              <div className="text-xs uppercase tracking-[0.22em] text-slate-400">{copy.hook}</div>
                              <div className="mt-2 text-sm leading-6 text-slate-700">{arrangement.hook_moment || copy.noCallout}</div>
                            </div>
                            <div className="mac-muted-card">
                              <div className="text-xs uppercase tracking-[0.22em] text-slate-400">{copy.climax}</div>
                              <div className="mt-2 text-sm leading-6 text-slate-700">{arrangement.climax_moment || copy.noCallout}</div>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {/* Stem roles */}
                      {arrangement.stem_roles && Object.keys(arrangement.stem_roles).length > 0 ? (
                        <div className="mac-panel p-5">
                          <h3 className="mb-3 text-base font-semibold text-slate-900">{copy.stemRolesTitle}</h3>
                          <div className="grid gap-2">
                            {Object.entries(arrangement.stem_roles).map(([name, info]) => (
                              <div key={name} className="rounded-[14px] border border-slate-200/70 bg-white/74 px-3 py-2.5">
                                <div className="text-sm font-semibold text-slate-900">{name}</div>
                                <div className="mt-1 space-y-0.5 text-[12px] leading-5 text-slate-500">
                                  <div><span className="font-medium text-slate-600">{copy.role}:</span> {info.role}</div>
                                  <div><span className="font-medium text-slate-600">{copy.timbre}:</span> {info.timbre}</div>
                                  <div><span className="font-medium text-slate-600">{copy.arrMethod}:</span> {info.arrangement}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {/* ── Tab: Sections ── */}
                  {tab === 'tabSections' ? (
                    <div className="space-y-2">
                      {arrangement.sections.length > 0 ? (
                        arrangement.sections.map((sec, i) => (
                          <SectionCard
                            key={`${sec.name}-${i}`}
                            section={sec}
                            onPlay={handlePlaySnippet}
                            copy={copy}
                          />
                        ))
                      ) : (
                        <div className="mac-panel p-5 text-sm text-slate-400">{copy.noSections}</div>
                      )}
                    </div>
                  ) : null}

                  {/* ── Tab: Listening ── */}
                  {tab === 'tabListening' ? (
                    <div className="space-y-4">
                      <div className="mac-panel p-5">
                        <h3 className="mb-3 text-base font-semibold text-slate-900">{copy.focusTitle}</h3>
                        {arrangement.listening_focus.length > 0 ? (
                          <div className="grid gap-2">
                            {arrangement.listening_focus.map((item, i) => (
                              <FocusItem key={i} item={item} onPlay={handlePlayTimestamp} />
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-slate-400">{copy.noListeningFocus}</div>
                        )}
                      </div>

                      <div className="mac-panel p-5">
                        <h3 className="mb-3 text-base font-semibold text-slate-900">{copy.mixTitle}</h3>
                        {arrangement.mix_highlights.length > 0 ? (
                          <div className="grid gap-2">
                            {arrangement.mix_highlights.map((text, i) => (
                              <div key={i} className="mac-list-row text-sm text-slate-600">{text}</div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-slate-400">{copy.noMixNotes}</div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
