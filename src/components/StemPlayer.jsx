import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Loader2, Pause, Play, Volume2, VolumeX } from 'lucide-react';

const STEM_LABELS = { vocals: '人声', bass: '贝斯', drums: '鼓组', guitar: '吉他', piano: '钢琴', other: '合成/效果' };
const STEM_COLORS = { vocals: '#f59e0b', bass: '#3b82f6', drums: '#ef4444', guitar: '#22c55e', piano: '#a855f7', other: '#6b7280' };
const ENERGY_BG = { low: 'bg-success-soft', medium: 'bg-warning-soft', high: 'bg-danger-soft' };

function fmt(s) {
  const t = Math.max(0, Math.round(s || 0));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

export const StemPlayer = forwardRef(function StemPlayer({ stemUrls, sections, duration }, ref) {
  const audios = useRef({});
  const raf = useRef(null);
  const clipEnd = useRef(null);
  const seekBarRef = useRef(null);
  const dragging = useRef(false);

  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [mix, setMix] = useState({});
  const [loaded, setLoaded] = useState(0);
  const [bufferPct, setBufferPct] = useState(0);

  const total = stemUrls.length;
  const ready = total > 0 && loaded >= total;

  useEffect(() => {
    const m = {};
    stemUrls.forEach(x => { m[x.name] = { vol: 0.8, muted: false }; });
    setMix(m);
    setLoaded(0);
    setBufferPct(0);
    setPlaying(false);
    setTime(0);
    clipEnd.current = null;
  }, [stemUrls]);

  useEffect(() => {
    for (const [n, st] of Object.entries(mix)) {
      const a = audios.current[n];
      if (a) a.volume = st.muted ? 0 : st.vol;
    }
  }, [mix]);

  const seekAll = useCallback(t => {
    const clamped = Math.max(0, Math.min(t, duration || 0));
    Object.values(audios.current).forEach(a => { if (a) a.currentTime = clamped; });
    setTime(clamped);
  }, [duration]);

  const doPlay = useCallback(() => {
    Promise.all(Object.values(audios.current).map(a => a?.play?.())).catch(() => {});
    setPlaying(true);
  }, []);

  const doPause = useCallback(() => {
    Object.values(audios.current).forEach(a => a?.pause());
    setPlaying(false);
    clipEnd.current = null;
  }, []);

  const tick = useCallback(() => {
    const master = audios.current[stemUrls[0]?.name];
    if (master) {
      const t = master.currentTime;
      setTime(t);
      if (clipEnd.current !== null && t >= clipEnd.current) {
        Object.values(audios.current).forEach(a => a?.pause());
        setPlaying(false);
        clipEnd.current = null;
        return;
      }
    }
    raf.current = requestAnimationFrame(tick);
  }, [stemUrls]);

  useEffect(() => {
    if (playing) raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [playing, tick]);

  const updateBuffer = useCallback(() => {
    const master = audios.current[stemUrls[0]?.name];
    if (!master || !duration) return;
    const buf = master.buffered;
    if (buf.length > 0) {
      setBufferPct((buf.end(buf.length - 1) / duration) * 100);
    }
  }, [stemUrls, duration]);

  useImperativeHandle(ref, () => ({
    playSnippet(start, end) {
      seekAll(Math.max(0, start - 1.5));
      clipEnd.current = end + 0.5;
      doPlay();
    },
    seekTo: seekAll,
    pause: doPause,
  }), [seekAll, doPlay, doPause]);

  const seekFromPointer = useCallback((e) => {
    const bar = seekBarRef.current;
    if (!bar || !duration) return;
    const r = bar.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const ratio = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    seekAll(ratio * duration);
  }, [duration, seekAll]);

  const onPointerDown = useCallback((e) => {
    dragging.current = true;
    seekFromPointer(e);
    const onMove = (ev) => { if (dragging.current) seekFromPointer(ev); };
    const onUp = () => { dragging.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); window.removeEventListener('touchmove', onMove); window.removeEventListener('touchend', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onUp);
  }, [seekFromPointer]);

  const pct = duration > 0 ? (time / duration) * 100 : 0;
  const activeSec = sections?.find(s => time >= s.time_start && time < s.time_end);
  const loadPct = total > 0 ? Math.round((loaded / total) * 100) : 0;

  return (
    <div className="mac-panel overflow-hidden p-0">
      {stemUrls.map((s, i) => (
        <audio
          key={s.name}
          ref={el => { if (el) audios.current[s.name] = el; }}
          src={s.url}
          preload="auto"
          onLoadedMetadata={() => setLoaded(c => c + 1)}
          onProgress={i === 0 ? updateBuffer : undefined}
          {...(i === 0 ? { onEnded: () => { doPause(); seekAll(0); } } : {})}
        />
      ))}

      {/* Loading overlay */}
      {!ready && total > 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 py-8">
          <Loader2 size={28} className="animate-spin text-ink-faint" />
          <div className="text-sm font-medium text-ink-muted">加载音轨中…</div>
          <div className="w-full max-w-xs">
            <div className="h-2 overflow-hidden rounded-full bg-bg-sunken">
              <div
                className="h-full rounded-full bg-accent transition-all duration-300"
                style={{ width: `${loadPct}%` }}
              />
            </div>
            <div className="mt-1.5 text-center text-xs tabular-nums text-ink-faint">{loaded} / {total} 轨</div>
          </div>
        </div>
      ) : null}

      {/* Section timeline (scrollable) */}
      {ready && sections?.length > 0 && duration > 0 ? (
        <div className="overflow-x-auto">
          <div className="flex h-7 min-w-full text-[9px] leading-none" style={{ minWidth: `${Math.max(100, sections.length * 72)}px` }}>
            {sections.map((sec, i) => {
              const w = ((sec.time_end - sec.time_start) / duration) * 100;
              const on = activeSec === sec;
              return (
                <button
                  key={i}
                  type="button"
                  className={`relative flex items-center justify-center truncate font-medium ${ENERGY_BG[sec.energy] || 'bg-bg-sunken'} ${on ? 'ring-1 ring-inset ring-accent' : 'opacity-60 hover:opacity-100'} transition-opacity`}
                  style={{ width: `${w}%`, minWidth: '42px' }}
                  onClick={() => seekAll(sec.time_start)}
                  title={`${sec.name} · ${fmt(sec.time_start)}`}
                >
                  <span className="truncate px-0.5 text-ink-muted">{sec.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Transport bar */}
      {ready ? (
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => playing ? doPause() : doPlay()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-white shadow-sm hover:bg-accent-hover active:scale-95"
          >
            {playing ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
          </button>
          <span className="w-10 shrink-0 text-right text-xs tabular-nums text-ink-muted">{fmt(time)}</span>
          <div
            ref={seekBarRef}
            className="relative h-6 flex-1 cursor-pointer"
            onMouseDown={onPointerDown}
            onTouchStart={onPointerDown}
          >
            {/* Track bg */}
            <div className="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-bg-sunken" />
            {/* Buffer bar */}
            <div
              className="absolute left-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-ink-faint transition-[width] duration-500"
              style={{ width: `${bufferPct}%` }}
            />
            {/* Progress bar */}
            <div
              className="absolute left-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-accent transition-[width] duration-75"
              style={{ width: `${pct}%` }}
            />
            {/* Thumb */}
            <div
              className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent bg-bg-raised shadow-sm"
              style={{ left: `${pct}%` }}
            />
          </div>
          <span className="w-10 shrink-0 text-xs tabular-nums text-ink-muted">{fmt(duration)}</span>
        </div>
      ) : null}

      {/* Stem mixer */}
      {ready ? (
        <div className="border-t border-line px-4 py-2.5">
          {stemUrls.map(s => {
            const st = mix[s.name] || { vol: 0.8, muted: false };
            return (
              <div key={s.name} className="flex items-center gap-2.5 py-1">
                <button
                  type="button"
                  onClick={() => setMix(p => ({ ...p, [s.name]: { ...p[s.name], muted: !p[s.name]?.muted } }))}
                  className="text-ink-faint hover:text-ink"
                >
                  {st.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: STEM_COLORS[s.name] || '#94a3b8' }} />
                <span className="w-16 text-xs font-medium text-ink-muted">{STEM_LABELS[s.name] || s.name}</span>
                <input
                  type="range"
                  min={0} max={1} step={0.02}
                  value={st.muted ? 0 : st.vol}
                  onChange={e => setMix(p => ({ ...p, [s.name]: { vol: parseFloat(e.target.value), muted: false } }))}
                  className="h-1.5 w-28 accent-accent"
                />
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
});
