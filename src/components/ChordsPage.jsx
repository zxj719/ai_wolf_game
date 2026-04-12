import { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ExternalLink,
  FileAudio,
  FileJson,
  Loader2,
  Music4,
  Sparkles,
  Upload,
  Wand2,
} from 'lucide-react';
import { createChordsJob, getChordsJob } from '../services/chordsService.js';

const MAX_FILE_SIZE = 25 * 1024 * 1024;

function getCopy(locale) {
  if (locale === 'en') {
    return {
      title: 'Music arrangement lab',
      subtitle: 'Cloud stem separation and arrangement analysis.',
      description:
        'Upload an MP3, run Demucs and the full chords pipeline in the cloud, then review the generated stem player, analysis JSON, and arrangement notes without leaving zhaxiaoji.com.',
      back: 'Back',
      pickFile: 'Pick audio file',
      browse: 'Upload an MP3',
      fileHint: 'MP3 / WAV / M4A, up to 25 MB',
      privacy: 'The upload is sent to the cloud separation service through the site API. Processing may take a few minutes.',
      invalidType: 'Please upload an MP3, WAV, or M4A file.',
      invalidSize: 'The file is too large. Keep it under 25 MB.',
      analyze: 'Start cloud analysis',
      analyzing: 'Running',
      audioTitle: 'Track preview',
      optionsTitle: 'Pipeline options',
      fastMode: 'Fast 4-stem mode',
      fastModeHelp: 'Use the lighter 4-stem Demucs model.',
      resynth: 'Skip resynth',
      resynthHelp: 'Generate the player without resynthesis artifacts.',
      splitVocals: 'Split vocals',
      splitVocalsHelp: 'Optionally separate the vocal stem into harmony parts.',
      statusTitle: 'Cloud job',
      idleTitle: 'Ready for a full cloud run',
      idleCopy: 'Upload an MP3 to generate real stems, a browsable HTML player, and the full arrangement report.',
      queueingCopy: 'Your upload is being handed off to the cloud worker.',
      processingCopy: 'Demucs, librosa, and MiniMax are running on the backend. This can take a few minutes per track.',
      openPlayer: 'Open stem player',
      analysisJson: 'Open analysis JSON',
      artifactsTitle: 'Artifacts',
      stemsTitle: 'Stem files',
      playerTitle: 'Stem player preview',
      summaryTitle: 'Arrangement map',
      focusTitle: 'Listening focus',
      mixTitle: 'Mix highlights',
      sectionsTitle: 'Section notes',
      duration: 'Duration',
      bpm: 'BPM',
      key: 'Key',
      status: 'Status',
      noSummary: 'MiniMax has not returned a summary yet.',
      noListeningFocus: 'No listening prompts returned.',
      noMixNotes: 'No mix notes returned.',
      noSections: 'No section notes returned.',
      noCallout: 'Not called out',
      uploadAnother: 'Choose another file',
    };
  }

  return {
    title: 'Music arrangement lab',
    subtitle: '云端分轨和编曲分析。',
    description:
      '上传 MP3 后，后台会在云端跑 Demucs 和完整 chords 流水线，生成 stem player、分析 JSON 和编曲说明，前端仍然保持在 zhaxiaoji.com 内。',
    back: '返回',
    pickFile: '选择音频文件',
    browse: '上传 MP3',
    fileHint: '支持 MP3 / WAV / M4A，最大 25 MB',
    privacy: '音频会通过站点 API 发往云端分轨服务，完整处理通常需要几分钟。',
    invalidType: '请上传 MP3、WAV 或 M4A 文件。',
    invalidSize: '文件过大，请控制在 25 MB 以内。',
    analyze: '开始云端解析',
    analyzing: '运行中',
    audioTitle: '音频预览',
    optionsTitle: '流水线选项',
    fastMode: '快速 4 轨模式',
    fastModeHelp: '使用更轻量的 4 stem Demucs 模型。',
    resynth: '跳过 resynth',
    resynthHelp: '生成 player，但不额外生成重合成产物。',
    splitVocals: '人声拆分',
    splitVocalsHelp: '可选把 vocal stem 继续拆成 harmony parts。',
    statusTitle: '云端任务',
    idleTitle: '可以开始完整云端分析',
    idleCopy: '上传 MP3 后会生成真实分轨、可浏览的 HTML player 和完整编曲报告。',
    queueingCopy: '上传已经提交到云端任务队列。',
    processingCopy: '后端正在运行 Demucs、librosa 和 MiniMax。每首歌通常需要几分钟。',
    openPlayer: '打开 stem player',
    analysisJson: '打开分析 JSON',
    artifactsTitle: '产物',
    stemsTitle: '音轨文件',
    playerTitle: 'Stem player 预览',
    summaryTitle: '编曲总览',
    focusTitle: '建议重点听',
    mixTitle: '混音亮点',
    sectionsTitle: '分段说明',
    duration: '时长',
    bpm: 'BPM',
    key: '调性',
    status: '状态',
    noSummary: 'MiniMax 暂未返回摘要。',
    noListeningFocus: '暂未返回重点聆听建议。',
    noMixNotes: '暂未返回混音说明。',
    noSections: '暂未返回分段说明。',
    noCallout: '暂无标注',
    uploadAnother: '重新选择文件',
  };
}

function formatSeconds(seconds) {
  const total = Math.max(0, Math.round(seconds || 0));
  const minutes = Math.floor(total / 60);
  const remaining = total % 60;
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
}

function formatBytes(bytes) {
  if (!bytes) {
    return '0 MB';
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function TagList({ items }) {
  if (!items.length) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item} className="mac-badge">
          {item}
        </span>
      ))}
    </div>
  );
}

function BulletList({ items, emptyLabel }) {
  if (!items.length) {
    return <div className="text-sm text-slate-400">{emptyLabel}</div>;
  }

  return (
    <div className="grid gap-2">
      {items.map((item) => (
        <div key={item} className="mac-list-row text-sm text-slate-600">
          {item}
        </div>
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
          onChange={(event) => onChange(event.target.checked)}
          className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
        />
      </div>
    </label>
  );
}

export function ChordsPage({ onBack, locale = 'zh' }) {
  const copy = getCopy(locale);
  const [selectedFile, setSelectedFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const [options, setOptions] = useState({
    fourStems: false,
    noResynth: false,
    splitVocals: 0,
  });

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  useEffect(() => {
    if (!job?.id || job.status === 'completed' || job.status === 'failed') {
      return undefined;
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        const nextJob = await getChordsJob(job.id);
        setJob(nextJob);
      } catch (pollError) {
        setError(pollError.message || 'Failed to refresh job status.');
      }
    }, job.status === 'queued' ? 1500 : 4000);

    return () => window.clearTimeout(timeoutId);
  }, [job]);

  const stemArtifacts = useMemo(
    () => (job?.artifacts || []).filter((artifact) => artifact.kind === 'stem'),
    [job],
  );

  const arrangement = job?.arrangement || {
    summary: '',
    style_tags: [],
    mood_tags: [],
    listening_focus: [],
    mix_highlights: [],
    sections: [],
    hook_moment: '',
    climax_moment: '',
  };

  const handleFileChange = (event) => {
    const nextFile = event.target.files?.[0];
    if (!nextFile) {
      return;
    }

    const validType = /\.(mp3|wav|m4a)$/i.test(nextFile.name) || nextFile.type.startsWith('audio/');
    if (!validType) {
      setError(copy.invalidType);
      return;
    }
    if (nextFile.size > MAX_FILE_SIZE) {
      setError(copy.invalidSize);
      return;
    }

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }

    setSelectedFile(nextFile);
    setAudioUrl(URL.createObjectURL(nextFile));
    setJob(null);
    setError('');
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      return;
    }

    try {
      setError('');
      const createdJob = await createChordsJob(selectedFile, options);
      setJob(createdJob);
    } catch (createError) {
      setError(createError.message || 'Failed to start cloud job.');
    }
  };

  const isBusy = job?.status === 'queued' || job?.status === 'processing';
  const summaryStats = job?.analysis || null;

  return (
    <div className="px-4 py-16 md:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mac-window overflow-hidden">
          <div className="mac-toolbar">
            <div className="flex items-center gap-4">
              <div className="mac-window-chrome">
                <span className="mac-window-dot mac-dot-red" />
                <span className="mac-window-dot mac-dot-yellow" />
                <span className="mac-window-dot mac-dot-green" />
              </div>
              <div>
                <div className="mac-eyebrow">Zhaxiaoji Studio</div>
                <h1 className="text-base font-semibold text-slate-900">{copy.title}</h1>
              </div>
            </div>

            <button type="button" onClick={onBack} className="mac-button mac-button-secondary">
              <ChevronLeft size={15} />
              {copy.back}
            </button>
          </div>

          <main className="grid gap-8 px-6 py-8 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
            <section className="space-y-5">
              <div className="space-y-4">
                <div className="mac-eyebrow">{copy.subtitle}</div>
                <h2 className="text-[clamp(2.25rem,5vw,3.6rem)] font-semibold tracking-tight text-slate-950">
                  {copy.title}
                </h2>
                <p className="max-w-2xl text-base leading-7 text-slate-500">{copy.description}</p>
              </div>

              <div className="mac-panel p-5 md:p-6">
                <div className="mb-4 flex items-center gap-3">
                  <span className="mac-icon-tile">
                    <Upload size={18} />
                  </span>
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
                      <div className="text-sm font-semibold text-slate-900">
                        {selectedFile ? selectedFile.name : copy.browse}
                      </div>
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
                        <button
                          type="button"
                          onClick={handleAnalyze}
                          disabled={isBusy}
                          className="mac-button mac-button-primary"
                        >
                          {isBusy ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
                          {isBusy ? copy.analyzing : copy.analyze}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {audioUrl ? (
                    <div className="rounded-[20px] border border-slate-200/70 bg-white/70 p-4">
                      <div className="mb-2 text-sm font-semibold text-slate-900">{copy.audioTitle}</div>
                      <audio controls className="w-full" src={audioUrl}>
                        <track kind="captions" />
                      </audio>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mac-panel p-5">
                <div className="mb-4 flex items-center gap-3">
                  <span className="mac-icon-tile">
                    <Music4 size={18} />
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">{copy.optionsTitle}</h3>
                    <p className="text-sm text-slate-500">{copy.idleCopy}</p>
                  </div>
                </div>

                <div className="grid gap-3">
                  <OptionToggle
                    checked={options.fourStems}
                    onChange={(checked) => setOptions((current) => ({ ...current, fourStems: checked }))}
                    title={copy.fastMode}
                    description={copy.fastModeHelp}
                  />

                  <OptionToggle
                    checked={options.noResynth}
                    onChange={(checked) => setOptions((current) => ({ ...current, noResynth: checked }))}
                    title={copy.resynth}
                    description={copy.resynthHelp}
                  />

                  <label className="rounded-[18px] border border-slate-200/70 bg-white/72 p-4">
                    <div className="text-sm font-semibold text-slate-900">{copy.splitVocals}</div>
                    <div className="mt-1 text-sm leading-6 text-slate-500">{copy.splitVocalsHelp}</div>
                    <select
                      className="mac-select mt-3"
                      value={options.splitVocals}
                      onChange={(event) => {
                        setOptions((current) => ({ ...current, splitVocals: Number(event.target.value) }));
                      }}
                    >
                      <option value={0}>0</option>
                      <option value={2}>2</option>
                      <option value={3}>3</option>
                      <option value={4}>4</option>
                    </select>
                  </label>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              {!job ? (
                <div className="mac-panel p-6">
                  <div className="text-base font-semibold text-slate-900">{copy.idleTitle}</div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{copy.idleCopy}</p>
                </div>
              ) : null}

              {job ? (
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
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Job ID</div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">{job.id}</div>
                    </div>
                    <div className="mac-muted-card">
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Progress</div>
                      <div className="mt-2 text-lg font-semibold text-slate-900">{Math.round(job.progress * 100)}%</div>
                    </div>
                  </div>

                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-all duration-500"
                      style={{ width: `${Math.max(6, Math.round(job.progress * 100))}%` }}
                    />
                  </div>

                  <div className="mt-3 text-sm text-slate-500">{job.step}</div>
                </div>
              ) : null}

              {error ? (
                <div className="rounded-[24px] border border-rose-200 bg-rose-50/90 p-5 text-sm leading-6 text-rose-700">
                  {error}
                </div>
              ) : null}

              {summaryStats ? (
                <div className="mac-panel p-5">
                  <div className="mb-4 flex items-center gap-3">
                    <span className="mac-icon-tile">
                      <Sparkles size={18} />
                    </span>
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">{copy.summaryTitle}</h3>
                      <p className="text-sm text-slate-500">{arrangement.summary || copy.noSummary}</p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="mac-muted-card">
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-400">{copy.duration}</div>
                      <div className="mt-2 text-lg font-semibold text-slate-900">{formatSeconds(summaryStats.duration)}</div>
                    </div>
                    <div className="mac-muted-card">
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-400">{copy.bpm}</div>
                      <div className="mt-2 text-lg font-semibold text-slate-900">{summaryStats.bpm || '-'}</div>
                    </div>
                    <div className="mac-muted-card">
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-400">{copy.key}</div>
                      <div className="mt-2 text-lg font-semibold text-slate-900">
                        {summaryStats.key?.key ? `${summaryStats.key.key} ${summaryStats.key.mode || ''}` : '-'}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4">
                    <TagList items={arrangement.style_tags} />
                    <TagList items={arrangement.mood_tags} />

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="mac-muted-card">
                        <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Hook</div>
                        <div className="mt-2 text-sm leading-6 text-slate-700">
                          {arrangement.hook_moment || copy.noCallout}
                        </div>
                      </div>
                      <div className="mac-muted-card">
                        <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Climax</div>
                        <div className="mt-2 text-sm leading-6 text-slate-700">
                          {arrangement.climax_moment || copy.noCallout}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {job?.status === 'completed' ? (
                <>
                  <div className="mac-panel p-5">
                    <div className="mb-4 flex items-center gap-3">
                      <span className="mac-icon-tile">
                        <FileJson size={18} />
                      </span>
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">{copy.artifactsTitle}</h3>
                        <p className="text-sm text-slate-500">{job.sourceFilename}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      {job.playerUrl ? (
                        <a href={job.playerUrl} target="_blank" rel="noreferrer noopener" className="mac-button mac-button-primary">
                          {copy.openPlayer}
                          <ExternalLink size={15} />
                        </a>
                      ) : null}
                      {job.analysisUrl ? (
                        <a href={job.analysisUrl} target="_blank" rel="noreferrer noopener" className="mac-button mac-button-secondary">
                          {copy.analysisJson}
                          <ExternalLink size={15} />
                        </a>
                      ) : null}
                    </div>

                    {stemArtifacts.length ? (
                      <div className="mt-5">
                        <div className="mb-3 text-sm font-semibold text-slate-900">{copy.stemsTitle}</div>
                        <div className="grid gap-2">
                          {stemArtifacts.map((artifact) => (
                            <a
                              key={artifact.path}
                              href={artifact.url}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="mac-list-row text-sm text-slate-600 transition-colors hover:bg-white/90"
                            >
                              <span>{artifact.name}</span>
                              <span className="text-slate-400">{formatBytes(artifact.sizeBytes)}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="mac-panel p-5">
                      <h3 className="text-base font-semibold text-slate-900">{copy.focusTitle}</h3>
                      <div className="mt-4">
                        <BulletList items={arrangement.listening_focus} emptyLabel={copy.noListeningFocus} />
                      </div>
                    </div>

                    <div className="mac-panel p-5">
                      <h3 className="text-base font-semibold text-slate-900">{copy.mixTitle}</h3>
                      <div className="mt-4">
                        <BulletList items={arrangement.mix_highlights} emptyLabel={copy.noMixNotes} />
                      </div>
                    </div>
                  </div>

                  <div className="mac-panel p-5">
                    <h3 className="text-base font-semibold text-slate-900">{copy.sectionsTitle}</h3>
                    <div className="mt-4 grid gap-3">
                      {arrangement.sections.length ? (
                        arrangement.sections.map((section) => (
                          <div key={`${section.name}-${section.time_start}`} className="rounded-[20px] border border-slate-200/70 bg-white/74 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-sm font-semibold text-slate-900">{section.name}</div>
                              <div className="text-xs uppercase tracking-[0.22em] text-slate-400">
                                {section.energy || 'open'}
                              </div>
                            </div>
                            <div className="mt-2 text-xs text-slate-400">
                              {formatSeconds(section.time_start)} - {formatSeconds(section.time_end)}
                            </div>
                            {section.function ? (
                              <p className="mt-3 text-sm leading-6 text-slate-600">{section.function}</p>
                            ) : null}
                            {section.arrangement_notes.length ? (
                              <div className="mt-3 grid gap-2">
                                {section.arrangement_notes.map((note) => (
                                  <div key={note} className="mac-list-row text-sm text-slate-600">
                                    {note}
                                  </div>
                                ))}
                              </div>
                            ) : null}
                            {section.transition ? (
                              <div className="mt-3 text-sm text-slate-500">{section.transition}</div>
                            ) : null}
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-slate-400">{copy.noSections}</div>
                      )}
                    </div>
                  </div>

                  {job.playerUrl ? (
                    <div className="mac-panel overflow-hidden p-0">
                      <div className="mac-toolbar">
                        <div>
                          <div className="mac-eyebrow">{copy.playerTitle}</div>
                          <h3 className="text-base font-semibold text-slate-900">{job.sourceFilename}</h3>
                        </div>
                        <a href={job.playerUrl} target="_blank" rel="noreferrer noopener" className="mac-button mac-button-secondary">
                          {copy.openPlayer}
                          <ExternalLink size={15} />
                        </a>
                      </div>
                      <iframe
                        src={job.playerUrl}
                        title={`${job.sourceFilename} stem player`}
                        className="h-[860px] w-full border-0 bg-white"
                      />
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
