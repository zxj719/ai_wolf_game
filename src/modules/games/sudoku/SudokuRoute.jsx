import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Eraser, Pause, PencilLine, Play } from 'lucide-react';
import { useShell } from '../../../shell/ShellContext';
import { ROUTES } from '../../../shell/paths';
import {
  countSolutions,
  emptyGrid,
  generatePuzzle,
  getPeers,
  solveWithTrace,
  validateGivens,
} from './sudokuEngine';
import { explainStep } from './explainStep';
import './sudoku.css';

const SPEED_LEVELS = [900, 500, 250, 100, 30];
const SPEED_LABELS = ['慢速', '匀速', '适中', '较快', '瞬间'];
const DIFFICULTIES = [
  { key: 'easy', label: '简单' },
  { key: 'medium', label: '中等' },
  { key: 'hard', label: '困难' },
  { key: 'evil', label: '炼狱' },
];

function boxExtraClass(r, c) {
  let cls = '';
  if (c === 2 || c === 5) cls += ' box-right';
  if (r === 2 || r === 5) cls += ' box-bottom';
  if (c === 8) cls += ' col8';
  if (r === 8) cls += ' row8';
  return cls;
}

function originColor(type) {
  switch (type) {
    case 'naked_single': return 'var(--success)';
    case 'hidden_single': return 'var(--state-thinking)';
    case 'guess': return 'var(--warning)';
    default: return 'var(--ink)';
  }
}

function rcLabel(r, c) {
  return `R${r + 1}C${c + 1}`;
}

function logLineText(meta, grid, notUnique) {
  if (!meta) {
    let clues = 0;
    for (const row of grid) for (const v of row) if (v !== 0) clues++;
    let t = `已加载谜题 — ${clues} 个已知数。`;
    if (notUnique) t += ' 注意：此谜题存在不止一组解，这里只展示其中一组。';
    return t;
  }
  switch (meta.type) {
    case 'naked_single': return `唯一余数 — ${rcLabel(meta.row, meta.col)} = ${meta.value}`;
    case 'hidden_single': return `隐性唯一（${{ row: '行', col: '列', box: '宫' }[meta.unitType] ?? meta.unitType} ${meta.unitIndex + 1}）— ${rcLabel(meta.row, meta.col)} = ${meta.value}`;
    case 'guess': return `试探猜测（深度 ${meta.depth}）— ${rcLabel(meta.row, meta.col)} = ${meta.value} · 共 ${meta.optionsCount} 个候选`;
    case 'backtrack': return `回溯 — 撤销 ${rcLabel(meta.row, meta.col)} = ${meta.value}`;
    case 'contradiction': return `矛盾于 ${rcLabel(meta.row, meta.col)} — 候选值已耗尽`;
    case 'solved': return '已求解。';
    default: return meta.type;
  }
}

export default function SudokuRoute() {
  const { navigate } = useShell();

  const [mode, setMode] = useState('input');
  const [grid, setGrid] = useState(emptyGrid);
  const [result, setResult] = useState(null);
  const [notUnique, setNotUnique] = useState(false);
  const [step, setStep] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const inputRefs = useRef([]);
  const busyTimeoutRef = useRef(null);
  useEffect(() => () => clearTimeout(busyTimeoutRef.current), []);

  const goToInputMode = useCallback((nextGrid) => {
    setPlaying(false);
    setMode('input');
    setGrid(nextGrid ?? emptyGrid());
    setResult(null);
    setNotUnique(false);
    setStep(-1);
    setError('');
  }, []);

  const handleGenerate = useCallback((difficulty) => {
    setError('');
    setBusy(true);
    clearTimeout(busyTimeoutRef.current);
    busyTimeoutRef.current = setTimeout(() => {
      const { puzzle } = generatePuzzle(difficulty);
      setBusy(false);
      goToInputMode(puzzle);
    }, 30);
  }, [goToInputMode]);

  const handleSolve = useCallback(() => {
    setError('');
    if (!validateGivens(grid)) {
      setError('谜题无效 —— 某一行、列或 3×3 宫内数字重复。');
      return;
    }
    setBusy(true);
    clearTimeout(busyTimeoutRef.current);
    busyTimeoutRef.current = setTimeout(() => {
      const dup = countSolutions(grid, 2) === 2;
      const solveResult = solveWithTrace(grid);
      setBusy(false);
      setResult(solveResult);
      setNotUnique(dup);
      setMode('solved');
      setStep(-1);
      if (!solveResult.success) {
        setError(solveResult.aborted
          ? '这道题过于复杂，无法实时演算 —— 换一道试试。'
          : '按当前输入无解。');
      }
    }, 30);
  }, [grid]);

  const onCellInput = (r, c, raw) => {
    const digit = raw.replace(/[^1-9]/g, '').slice(-1);
    setGrid((prev) => {
      const next = prev.map((row) => [...row]);
      next[r][c] = digit ? parseInt(digit, 10) : 0;
      return next;
    });
    setError('');
  };

  const onCellKeyDown = (r, c, e) => {
    if (e.key === 'Backspace' || e.key === 'Delete') {
      setGrid((prev) => {
        const next = prev.map((row) => [...row]);
        next[r][c] = 0;
        return next;
      });
    }
    const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (moves[e.key]) {
      e.preventDefault();
      const [dr, dc] = moves[e.key];
      const nr = Math.min(8, Math.max(0, r + dr));
      const nc = Math.min(8, Math.max(0, c + dc));
      inputRefs.current[nr * 9 + nc]?.focus();
    }
  };

  const trace = result?.trace ?? [];
  const currentSnapshot = useMemo(() => {
    if (!result) return null;
    return step === -1 ? result.initial : trace[step];
  }, [result, step, trace]);
  const prevSnapshot = useMemo(() => {
    if (!result) return null;
    return step <= 0 ? result.initial : trace[step - 1];
  }, [result, step, trace]);

  const stepForward = useCallback(() => {
    setStep((s) => (result && s < trace.length - 1 ? s + 1 : s));
  }, [result, trace.length]);
  const stepBack = useCallback(() => {
    setStep((s) => (s > -1 ? s - 1 : s));
  }, []);

  // 自动播放：每次 step 变化都重新排一次下一跳，效果等价于原版的递归 scheduleNext。
  useEffect(() => {
    if (!playing || !result?.success) return undefined;
    if (step >= trace.length - 1) { setPlaying(false); return undefined; }
    const timer = setTimeout(() => {
      setStep((s) => Math.min(s + 1, trace.length - 1));
    }, SPEED_LEVELS[speedIndex]);
    return () => clearTimeout(timer);
  }, [playing, step, speedIndex, result, trace.length]);

  useEffect(() => {
    function onKeyDown(e) {
      if (mode !== 'solved') return;
      if (document.activeElement?.tagName === 'INPUT') return;
      if (e.code === 'Space') { e.preventDefault(); setPlaying((p) => !p); }
      else if (e.code === 'ArrowRight') { setPlaying(false); stepForward(); }
      else if (e.code === 'ArrowLeft') { setPlaying(false); stepBack(); }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mode, stepForward, stepBack]);

  const activePeerKeys = useMemo(() => {
    const meta = currentSnapshot?.meta;
    if (!meta || meta.row === undefined || meta.row === null) return new Set();
    return new Set(getPeers(meta.row, meta.col).map((p) => p.row * 9 + p.col));
  }, [currentSnapshot]);

  const statusInfo = useMemo(() => {
    if (busy && mode === 'input') return { text: '生成中…', colorVar: 'var(--warning)' };
    if (mode === 'input') return { text: '就绪', colorVar: 'var(--ink-muted)' };
    if (busy) return { text: '求解中…', colorVar: 'var(--warning)' };
    if (!result) return { text: '就绪', colorVar: 'var(--ink-muted)' };
    const total = trace.length;
    const atEnd = step === total - 1;
    const lastType = total > 0 ? trace[total - 1].meta.type : null;
    if (!result.success) return { text: result.aborted ? '过于复杂' : '无解', colorVar: 'var(--danger)' };
    if (atEnd && lastType === 'solved') return { text: '已求解', colorVar: 'var(--success)' };
    if (playing) return { text: '求解中…', colorVar: 'var(--warning)' };
    if (step === -1) return { text: '可单步演算', colorVar: 'var(--ink-muted)' };
    return { text: '已暂停', colorVar: 'var(--warning)' };
  }, [busy, mode, result, step, trace, playing]);

  const cluesCount = useMemo(() => grid.reduce((sum, row) => sum + row.filter((v) => v !== 0).length, 0), [grid]);

  const stats = useMemo(() => {
    if (!result) return null;
    const upto = trace.slice(0, step + 1);
    const count = (t) => upto.filter((s) => s.meta.type === t).length;
    return [
      { label: '唯一余数', value: count('naked_single'), colorVar: 'var(--success)' },
      { label: '隐性唯一', value: count('hidden_single'), colorVar: 'var(--state-thinking)' },
      { label: '试探猜测', value: count('guess'), colorVar: 'var(--warning)' },
      { label: '回溯次数', value: count('backtrack'), colorVar: 'var(--danger)' },
    ];
  }, [result, trace, step]);

  const logLines = useMemo(() => {
    if (!result) return [];
    const lines = [{ idx: -1, type: 'start', text: logLineText(null, grid, notUnique) }];
    trace.forEach((s, i) => lines.push({ idx: i, type: s.meta.type, text: logLineText(s.meta, grid, notUnique) }));
    return lines.slice(0, step + 2);
  }, [result, trace, step, grid, notUnique]);

  const reasoning = useMemo(() => {
    if (!currentSnapshot || !prevSnapshot) return null;
    return explainStep({ step, currentSnap: currentSnapshot, prevSnap: prevSnapshot, grid });
  }, [step, currentSnapshot, prevSnapshot, grid]);

  const generateDisabled = busy;
  const solveDisabled = busy || mode === 'solved';

  return (
    <div className="px-4 py-16 md:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mac-window overflow-hidden">
          <div className="mac-toolbar">
            <div className="flex items-center gap-4">
              <div className="mac-window-chrome">
                <span className="mac-window-dot mac-dot-red" />
                <span className="mac-window-dot mac-dot-yellow" />
                <span className="mac-window-dot mac-dot-green" />
              </div>
              <div>
                <div className="mac-eyebrow">Sudoku Solver Trace</div>
                <h1 className="text-base font-semibold text-ink">数独求解可视化</h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span
                className="inline-flex items-center rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-wider"
                style={{ color: statusInfo.colorVar, borderColor: statusInfo.colorVar }}
              >
                {statusInfo.text}
              </span>
              <button
                type="button"
                onClick={() => navigate(ROUTES.GAMES)}
                className="mac-button mac-button-secondary"
              >
                <ArrowLeft size={15} />
                返回小游戏
              </button>
            </div>
          </div>

          <main className="grid gap-6 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-8">
            <section className="min-w-0 space-y-4">
              <div className="mac-panel p-4">
                <div
                  className={`sudoku-board ${mode === 'solved' ? 'is-solve-mode' : ''}`}
                >
                  {Array.from({ length: 81 }).map((_, idx) => {
                      const r = Math.floor(idx / 9);
                      const c = idx % 9;
                      const extra = boxExtraClass(r, c);

                      if (mode === 'input') {
                        return (
                          <div key={idx} className={`sudoku-cell${extra}`}>
                            <input
                              ref={(el) => { inputRefs.current[idx] = el; }}
                              className="sudoku-cell-input"
                              inputMode="numeric"
                              maxLength={1}
                              autoComplete="off"
                              aria-label={`第 ${r + 1} 行第 ${c + 1} 列`}
                              value={grid[r][c] ? String(grid[r][c]) : ''}
                              onChange={(e) => onCellInput(r, c, e.target.value)}
                              onKeyDown={(e) => onCellKeyDown(r, c, e)}
                              onFocus={(e) => e.target.select()}
                            />
                          </div>
                        );
                      }

                      const snap = currentSnapshot;
                      const solved = snap?.solved[r][c];
                      const origin = snap?.origins[r][c];
                      const meta = snap?.meta;
                      const isNow = meta && meta.row === r && meta.col === c;
                      const isFail = isNow && (meta.type === 'backtrack' || meta.type === 'contradiction');
                      const isPeer = !isNow && activePeerKeys.has(idx);
                      const cands = snap?.candidates[r][c] ?? [];

                      return (
                        <div
                          key={idx}
                          className={`sudoku-cell${extra}${isFail ? ' active-fail' : isNow ? ' active-now' : isPeer ? ' active-peer' : ''}`}
                        >
                          {solved ? (
                            <div className="sudoku-cell-value" style={{ color: originColor(origin?.type) }}>
                              {cands[0]}
                            </div>
                          ) : (
                            <div className="sudoku-pencil">
                              {Array.from({ length: 9 }).map((___, i) => (
                                <span key={i} className={cands.includes(i + 1) ? '' : 'is-hidden'}>{i + 1}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                  })}
                </div>

                <div className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 font-mono text-[11px] text-ink-muted">
                  {[
                    ['已知数', 'var(--ink)'],
                    ['唯一余数', 'var(--success)'],
                    ['隐性唯一', 'var(--state-thinking)'],
                    ['试探猜测', 'var(--warning)'],
                    ['回溯', 'var(--danger)'],
                  ].map(([label, color]) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                      {label}
                    </div>
                  ))}
                </div>

                {error && <p className="mt-3 text-center text-sm text-danger">{error}</p>}
              </div>

              {mode === 'solved' && reasoning && (
                <div className="mac-panel p-4">
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: reasoning.colorVar }}>
                      {reasoning.title}
                    </span>
                    <span className="font-mono text-[11px] text-ink-faint">{reasoning.dofText}</span>
                  </div>
                  <div className="space-y-2">
                    {reasoning.lines.map((line, i) => (
                      <p key={i} className="text-sm leading-6 text-ink-muted" dangerouslySetInnerHTML={{ __html: line }} />
                    ))}
                  </div>
                </div>
              )}
            </section>

            <aside className="space-y-4">
              <div className="mac-panel p-4">
                <div className="mac-eyebrow mb-3">谜题</div>
                <div className="grid grid-cols-4 gap-2">
                  {DIFFICULTIES.map((d) => (
                    <button
                      key={d.key}
                      type="button"
                      disabled={generateDisabled}
                      onClick={() => handleGenerate(d.key)}
                      className="mac-button mac-button-secondary !px-2 !py-2 text-xs"
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={generateDisabled}
                    onClick={() => goToInputMode(emptyGrid())}
                    className="mac-button mac-button-secondary text-xs"
                  >
                    <Eraser size={14} />
                    清空
                  </button>
                  {mode === 'solved' ? (
                    <button
                      type="button"
                      onClick={() => goToInputMode(grid)}
                      className="mac-button mac-button-secondary text-xs"
                    >
                      <PencilLine size={14} />
                      编辑题目
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={solveDisabled}
                      onClick={handleSolve}
                      className="mac-button mac-button-primary text-xs"
                    >
                      求解 ▶
                    </button>
                  )}
                </div>
                <p className="mt-3 text-xs leading-5 text-ink-faint">
                  {mode === 'input'
                    ? (cluesCount > 0
                      ? `已有 ${cluesCount} 个已知数。点击求解开始观看，或继续编辑任意格子。`
                      : '点击格子输入 1–9，或在上方生成一道谜题。')
                    : null}
                </p>
              </div>

              {mode === 'solved' && (
                <div className="mac-panel p-4">
                  <div className="mac-eyebrow mb-3">回放</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={step <= -1}
                      onClick={() => { setPlaying(false); stepBack(); }}
                      className="mac-button mac-button-secondary text-xs"
                    >
                      <ChevronLeft size={14} />
                      上一步
                    </button>
                    <button
                      type="button"
                      disabled={step >= trace.length - 1}
                      onClick={() => { setPlaying(false); stepForward(); }}
                      className="mac-button mac-button-primary text-xs"
                    >
                      下一步
                      <ChevronRight size={14} />
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={step >= trace.length - 1}
                    onClick={() => setPlaying((p) => !p)}
                    className={`mac-button mt-2 w-full text-xs ${playing ? 'mac-button-primary' : 'mac-button-secondary'}`}
                  >
                    {playing ? <Pause size={14} /> : <Play size={14} />}
                    {playing ? '暂停' : '自动播放'}
                  </button>
                  <div className="mt-3 flex items-center gap-2">
                    <label htmlFor="sudoku-speed" className="text-xs text-ink-muted">速度</label>
                    <input
                      id="sudoku-speed"
                      type="range"
                      min={0}
                      max={4}
                      step={1}
                      value={speedIndex}
                      onChange={(e) => setSpeedIndex(Number(e.target.value))}
                      className="flex-1 accent-[var(--accent)]"
                    />
                    <span className="w-12 text-right font-mono text-[11px] text-ink-muted">{SPEED_LABELS[speedIndex]}</span>
                  </div>
                  <div className="mt-2 text-center font-mono text-[11px] text-ink-faint">
                    第 {step + 1} / {trace.length} 步
                  </div>
                </div>
              )}

              {mode === 'solved' && stats && (
                <div className="mac-panel p-4">
                  <div className="mac-eyebrow mb-3">统计</div>
                  <div className="grid grid-cols-2 gap-3">
                    {stats.map((s) => (
                      <div key={s.label}>
                        <div className="font-mono text-xl font-bold" style={{ color: s.colorVar }}>{s.value}</div>
                        <div className="mt-1 text-[11px] uppercase tracking-wide text-ink-faint">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {mode === 'solved' && logLines.length > 0 && (
                <div className="mac-panel p-4">
                  <div className="mac-eyebrow mb-3">推理日志</div>
                  <div className="sudoku-trace-log">
                    {logLines.map((line) => (
                      <div
                        key={line.idx}
                        onClick={() => { setPlaying(false); setStep(line.idx); }}
                        className={`sudoku-log-line type-${line.type}${line.idx === step ? ' is-current' : ''}`}
                      >
                        {line.text}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </main>
        </div>
      </div>
    </div>
  );
}
