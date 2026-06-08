import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Upload,
  Moon,
  Sun,
  MessageSquare,
  Vote,
  Skull,
  Eye,
  Shield,
  Swords,
  Crown,
  Users,
  Zap,
} from 'lucide-react';
import { parseReplayFromLog } from '../utils/parseReplayFromLog';

const SPEEDS = [1, 2, 4];
const AUTO_STEP_MS = { 1: 2000, 2: 1000, 4: 500 };

const ROLE_COLORS = {
  '狼人': 'bg-role-wolf-soft border-line text-role-wolf',
  '预言家': 'bg-role-seer-soft border-line text-role-seer',
  '女巫': 'bg-role-witch-soft border-line text-role-witch',
  '猎人': 'bg-role-hunter-soft border-line text-role-hunter',
  '守卫': 'bg-role-guard-soft border-line text-role-guard',
  '村民': 'bg-role-villager-soft border-line text-role-villager',
  '魔术师': 'bg-role-magician-soft border-line text-role-magician',
  '织梦人': 'bg-role-dreamweaver-soft border-line text-role-dreamweaver',
  '骑士': 'bg-role-knight-soft border-line text-role-knight',
};

const EVENT_ICONS = {
  night_start: Moon,
  day_start: Sun,
  action: Zap,
  speech: MessageSquare,
  vote: Vote,
  elimination: Skull,
  claim: Eye,
  game_over: Crown,
};

function PlayerCircle({ players, activePlayerId, deadIds }) {
  const count = players.length;
  const radius = Math.min(140, 100 + count * 5);

  return (
    <div className="relative mx-auto" style={{ width: radius * 2 + 80, height: radius * 2 + 80 }}>
      {players.map((p, i) => {
        const angle = (2 * Math.PI * i) / count - Math.PI / 2;
        const x = radius * Math.cos(angle) + radius + 40;
        const y = radius * Math.sin(angle) + radius + 40;
        const isDead = deadIds.has(p.id);
        const isActive = p.id === activePlayerId;
        const roleColor = ROLE_COLORS[p.role] || ROLE_COLORS['村民'];

        return (
          <div
            key={p.id}
            className={`absolute flex flex-col items-center transition-all duration-300 ${isActive ? 'scale-110 z-10' : 'scale-100'}`}
            style={{ left: x, top: y, transform: `translate(-50%, -50%) ${isActive ? 'scale(1.1)' : ''}` }}
          >
            <div
              className={`relative h-12 w-12 rounded-full border-2 flex items-center justify-center text-xs font-bold
                ${roleColor} ${isDead ? 'opacity-40 grayscale' : ''} ${isActive ? 'ring-2 ring-accent ring-offset-1 ring-offset-bg' : ''}`}
            >
              <span>{p.id}</span>
              {isDead && <div className="absolute inset-0 flex items-center justify-center text-danger text-lg">✕</div>}
            </div>
            <span className={`mt-1 text-[10px] leading-tight text-center max-w-[60px] truncate ${isDead ? 'text-ink-faint' : 'text-ink-muted'}`}>
              {p.name}
            </span>
            <span className={`text-[9px] ${isDead ? 'text-ink-faint' : 'text-ink-muted'}`}>{p.role}</span>
          </div>
        );
      })}
    </div>
  );
}

function EventCard({ event, players }) {
  const getPlayerName = (id) => players.find((p) => p.id === id)?.name || `${id}号`;
  const getPlayerRole = (id) => players.find((p) => p.id === id)?.role || '?';
  const Icon = EVENT_ICONS[event.type] || Zap;

  switch (event.type) {
    case 'night_start':
      return (
        <div className="flex items-center gap-3 rounded-xl bg-phase-night-soft border border-line px-4 py-3">
          <Moon size={20} className="text-phase-night shrink-0" />
          <span className="text-phase-night font-medium">第 {event.day} 夜 — 天黑请闭眼</span>
        </div>
      );

    case 'day_start':
      return (
        <div className="flex flex-col gap-2 rounded-xl bg-phase-day-soft border border-line px-4 py-3">
          <div className="flex items-center gap-3">
            <Sun size={20} className="text-phase-day shrink-0" />
            <span className="text-phase-day font-medium">第 {event.day} 天 — 天亮了</span>
          </div>
          {event.deaths?.length > 0 && (
            <div className="ml-8 text-sm text-danger">
              <Skull size={14} className="inline mr-1" />
              昨晚死亡: {event.deaths.map((id) => `${getPlayerName(id)}(${getPlayerRole(id)})`).join('、')}
            </div>
          )}
          {event.deaths?.length === 0 && (
            <div className="ml-8 text-sm text-success">平安夜 — 无人死亡</div>
          )}
        </div>
      );

    case 'action':
      return (
        <div className="rounded-xl bg-bg-raised border border-line px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <Zap size={16} className="text-ink-muted shrink-0" />
            <span className="text-ink font-medium text-sm">
              {event.playerId != null ? `${getPlayerName(event.playerId)}(${getPlayerRole(event.playerId)})` : '角色'}
              {' '}{event.action}
              {event.target != null ? ` → ${getPlayerName(event.target)}` : ''}
            </span>
            {event.result && <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-bg-sunken text-ink-muted">{event.result}</span>}
          </div>
          {event.thought && (
            <div className="ml-6 mt-2 text-xs text-ink-muted bg-bg-sunken rounded-lg px-3 py-2 italic">
              💭 {event.thought}
            </div>
          )}
        </div>
      );

    case 'speech':
      return (
        <div className="rounded-xl bg-bg-raised border border-line px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare size={16} className="text-state-speaking shrink-0" />
            <span className="text-state-speaking font-medium text-sm">
              {getPlayerName(event.playerId)} ({getPlayerRole(event.playerId)})
            </span>
          </div>
          <p className="text-ink text-sm leading-relaxed ml-6">{event.content}</p>
          {event.thought && (
            <div className="ml-6 mt-2 text-xs text-ink-muted bg-bg-sunken rounded-lg px-3 py-2 italic">
              💭 {event.thought}
            </div>
          )}
          {event.voteIntention != null && (
            <div className="ml-6 mt-1 text-xs text-ink-muted">
              🗳️ 投票意向: {event.voteIntention === -1 ? '弃票' : `${event.voteIntention}号`}
            </div>
          )}
        </div>
      );

    case 'vote':
      return (
        <div className="rounded-xl bg-bg-raised border border-line px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <Users size={16} className="text-phase-day shrink-0" />
            <span className="text-phase-day font-medium text-sm">第 {event.day} 天投票</span>
          </div>
          <div className="ml-6 space-y-1">
            {(event.votes || []).map((v, i) => (
              <div key={i} className="text-xs text-ink-muted">
                {getPlayerName(v.from)} → {v.to === -1 ? '弃票' : getPlayerName(v.to)}
                {v.reasoning && <span className="text-ink-faint ml-2">({v.reasoning})</span>}
              </div>
            ))}
          </div>
          {event.eliminated != null && (
            <div className="ml-6 mt-2 text-sm text-danger font-medium">
              <Skull size={14} className="inline mr-1" />
              {getPlayerName(event.eliminated)} 被放逐
            </div>
          )}
          {event.eliminated == null && (
            <div className="ml-6 mt-2 text-sm text-ink-muted">无人被放逐</div>
          )}
        </div>
      );

    case 'game_over':
      return (
        <div className={`rounded-xl border border-line px-6 py-5 text-center ${
          event.winner === 'good_win'
            ? 'bg-success-soft'
            : 'bg-danger-soft'
        }`}>
          <Crown size={32} className={`mx-auto mb-2 ${event.winner === 'good_win' ? 'text-state-win-good' : 'text-state-win-evil'}`} />
          <div className={`text-xl font-bold ${event.winner === 'good_win' ? 'text-state-win-good' : 'text-state-win-evil'}`}>
            {event.winner === 'good_win' ? '好人阵营胜利' : '狼人阵营胜利'}
          </div>
        </div>
      );

    default:
      return (
        <div className="rounded-xl bg-bg-raised border border-line px-4 py-3 text-sm text-ink-muted">
          <Icon size={16} className="inline mr-2" />
          {JSON.stringify(event)}
        </div>
      );
  }
}

export function ReplayViewer({ replayData: initialReplayData, onBack }) {
  const [replay, setReplay] = useState(initialReplayData || null);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const timerRef = useRef(null);
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);

  const timeline = replay?.timeline || [];
  const players = replay?.players || [];
  const total = timeline.length;

  const deadIds = useMemo(() => {
    const ids = new Set();
    for (let i = 0; i <= step && i < timeline.length; i++) {
      const ev = timeline[i];
      if (ev.type === 'day_start' && ev.deaths) ev.deaths.forEach((d) => ids.add(d));
      if (ev.type === 'elimination' && ev.deaths) ev.deaths.forEach((d) => ids.add(d));
    }
    return ids;
  }, [step, timeline]);

  const activePlayerId = useMemo(() => {
    if (step >= timeline.length) return null;
    const ev = timeline[step];
    return ev.playerId ?? null;
  }, [step, timeline]);

  const currentPhase = useMemo(() => {
    for (let i = step; i >= 0; i--) {
      if (timeline[i]?.type === 'night_start') return 'night';
      if (timeline[i]?.type === 'day_start') return 'day';
    }
    return 'day';
  }, [step, timeline]);

  const currentDay = useMemo(() => {
    for (let i = step; i >= 0; i--) {
      if (timeline[i]?.day) return timeline[i].day;
    }
    return 1;
  }, [step, timeline]);

  const goNext = useCallback(() => setStep((s) => Math.min(s + 1, total - 1)), [total]);
  const goPrev = useCallback(() => setStep((s) => Math.max(s - 1, 0)), []);
  const goFirst = useCallback(() => setStep(0), []);
  const goLast = useCallback(() => setStep(total - 1), [total]);
  const togglePlay = useCallback(() => setPlaying((p) => !p), []);
  const cycleSpeed = useCallback(() => setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length]), []);

  useEffect(() => {
    if (playing && step < total - 1) {
      timerRef.current = setTimeout(goNext, AUTO_STEP_MS[speed]);
    } else if (step >= total - 1) {
      setPlaying(false);
    }
    return () => clearTimeout(timerRef.current);
  }, [playing, step, speed, total, goNext]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [step]);

  const handleFileUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target.result;
        const parsed = parseReplayFromLog(text);
        setReplay(parsed);
        setStep(0);
        setPlaying(false);
      } catch (err) {
        console.error('[Replay] Parse error:', err);
      }
    };
    reader.readAsText(file);
  }, []);

  // No replay data — show upload UI
  if (!replay) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6">
        <div className="mac-window max-w-md w-full overflow-hidden">
          <div className="mac-toolbar !px-6 !py-4">
            <div className="flex items-center gap-3">
              <div className="mac-window-chrome">
                <span className="mac-window-dot mac-dot-red" />
                <span className="mac-window-dot mac-dot-yellow" />
                <span className="mac-window-dot mac-dot-green" />
              </div>
              <h2 className="text-sm font-semibold text-ink">游戏回放</h2>
            </div>
            {onBack && (
              <button type="button" onClick={onBack} className="mac-button mac-button-secondary">
                <ChevronLeft size={15} /> 返回
              </button>
            )}
          </div>
          <div className="border-t border-line bg-bg-raised p-8 text-center">
            <Upload size={48} className="mx-auto mb-4 text-ink-faint" />
            <p className="text-ink-muted mb-4">上传游戏记录 .txt 文件进行回放</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-3 bg-accent text-white rounded-xl hover:bg-accent-hover transition font-medium"
            >
              选择文件
            </button>
          </div>
        </div>
      </div>
    );
  }

  const current = timeline[step];
  const progress = total > 1 ? (step / (total - 1)) * 100 : 0;

  return (
    <div className={`min-h-screen ${currentPhase === 'night' ? 'bg-bg' : 'bg-bg-raised'} flex flex-col transition-colors duration-500`}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-line">
        <div className="flex items-center gap-3">
          {onBack && (
            <button type="button" onClick={onBack} className="text-ink-muted hover:text-ink transition">
              <ChevronLeft size={20} />
            </button>
          )}
          <div>
            <h1 className="text-sm font-semibold text-ink">游戏回放</h1>
            <span className="text-xs text-ink-muted">
              第 {currentDay} {currentPhase === 'night' ? '夜' : '天'} · {replay.meta?.playerCount || players.length} 人局
              {replay.meta?.victoryMode === 'edge' ? ' · 屠边' : ' · 屠城'}
            </span>
          </div>
        </div>
        <div className="text-xs text-ink-muted">
          {step + 1} / {total}
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-0 overflow-hidden">
        {/* Player circle */}
        <div className="flex items-center justify-center p-6 overflow-auto">
          <PlayerCircle players={players} activePlayerId={activePlayerId} deadIds={deadIds} />
        </div>

        {/* Event log */}
        <div className="border-l border-line flex flex-col">
          <div className="px-4 py-2 border-b border-line text-xs font-medium text-ink-muted uppercase tracking-wider">
            事件流
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[calc(100vh-220px)]">
            {timeline.slice(0, step + 1).map((ev, i) => (
              <div
                key={i}
                className={`transition-opacity duration-300 ${i === step ? 'opacity-100' : 'opacity-60'}`}
              >
                <EventCard event={ev} players={players} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Controls */}
      <footer className="border-t border-line bg-bg-raised backdrop-blur px-4 py-3">
        {/* Progress bar */}
        <div className="mb-3">
          <input
            type="range"
            min={0}
            max={Math.max(total - 1, 0)}
            value={step}
            onChange={(e) => {
              setStep(parseInt(e.target.value));
              setPlaying(false);
            }}
            className="w-full h-1.5 accent-accent bg-bg-sunken rounded-full appearance-none cursor-pointer"
          />
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-center gap-3">
          <button type="button" onClick={goFirst} className="text-ink-muted hover:text-ink transition p-2" title="回到开头">
            <SkipBack size={18} />
          </button>
          <button type="button" onClick={goPrev} className="text-ink-muted hover:text-ink transition p-2" title="上一步">
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            onClick={togglePlay}
            className="bg-accent hover:bg-accent-hover text-white rounded-full p-3 transition"
            title={playing ? '暂停' : '播放'}
          >
            {playing ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <button type="button" onClick={goNext} className="text-ink-muted hover:text-ink transition p-2" title="下一步">
            <ChevronRight size={20} />
          </button>
          <button type="button" onClick={goLast} className="text-ink-muted hover:text-ink transition p-2" title="跳到结尾">
            <SkipForward size={18} />
          </button>
          <button
            type="button"
            onClick={cycleSpeed}
            className="ml-4 text-xs font-mono bg-bg-sunken text-ink-muted px-3 py-1.5 rounded-lg hover:bg-bg transition"
          >
            {speed}x
          </button>
        </div>
      </footer>
    </div>
  );
}
