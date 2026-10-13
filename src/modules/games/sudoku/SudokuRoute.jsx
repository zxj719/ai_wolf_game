import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Eraser, Pause, PencilLine, Play, Shuffle, Sparkles } from 'lucide-react';
import GameStage, { DockButton, Segmented } from '../shared/GameStage';
import { haptic } from '../shared/haptics';
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
    case 'naked_single': return 'var(--gs-green)';
    case 'hidden_single': return '#5e5ce6';
    case 'guess': return 'var(--gs-orange)';
    default: return 'var(--gs-ink)';
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
  const [mode, setMode] = useState('input');
  const [grid, setGrid] = useState(emptyGrid);
  const [result, setResult] = useState(null);
  const [notUnique, setNotUnique] = useState(false);
  const [step, setStep] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [lastDifficulty, setLastDifficulty] = useState('medium');

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
    if (busy && mode === 'input') return { text: '生成中…', colorVar: 'var(--gs-orange)' };
    if (mode === 'input') return { text: '就绪', colorVar: 'var(--gs-ink-2)' };
    if (busy) return { text: '求解中…', colorVar: 'var(--gs-orange)' };
    if (!result) return { text: '就绪', colorVar: 'var(--gs-ink-2)' };
    const total = trace.length;
    const atEnd = step === total - 1;
    const lastType = total > 0 ? trace[total - 1].meta.type : null;
    if (!result.success) return { text: result.aborted ? '过于复杂' : '无解', colorVar: 'var(--gs-red)' };
    if (atEnd && lastType === 'solved') return { text: '已求解', colorVar: 'var(--gs-green)' };
    if (playing) return { text: '求解中…', colorVar: 'var(--gs-orange)' };
    if (step === -1) return { text: '可单步演算', colorVar: 'var(--gs-ink-2)' };
    return { text: '已暂停', colorVar: 'var(--gs-orange)' };
  }, [busy, mode, result, step, trace, playing]);

  const cluesCount = useMemo(() => grid.reduce((sum, row) => sum + row.filter((v) => v !== 0).length, 0), [grid]);

  const stats = useMemo(() => {
    if (!result) return null;
    const upto = trace.slice(0, step + 1);
    const count = (t) => upto.filter((s) => s.meta.type === t).length;
    return [
      { label: '唯一余数', value: count('naked_single'), colorVar: 'var(--gs-green)' },
      { label: '隐性唯一', value: count('hidden_single'), colorVar: '#5e5ce6' },
      { label: '试探猜测', value: count('guess'), colorVar: 'var(--gs-orange)' },
      { label: '回溯次数', value: count('backtrack'), colorVar: 'var(--gs-red)' },
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
  const atEnd = step >= trace.length - 1;

  const renderStage = ({ width, height }) => {
    const wide = width >= 860;
    const boardSize = Math.floor(wide
      ? Math.min(height - 40, width - 380 - 24, 720)
      : Math.min(width, Math.max(280, height * 0.7), 560));
    const cell = boardSize / 9;

    return (
      <div className={`sd-layout${wide ? '' : ' is-stacked'}`} style={{ height }}>
        <div className="sd-board-col" style={{ flex: wide ? '1' : 'none' }}>
          <div
            className={`sudoku-board ${mode === 'solved' ? 'is-solve-mode' : ''}`}
            style={{ width: boardSize, height: boardSize, '--cell': `${cell}px` }}
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
                      placeholder=" "
                      aria-label={`第 ${r + 1} 行第 ${c + 1} 列`}
                      value={grid[r][c] ? String(grid[r][c]) : ''}
                      onChange={(e) => { haptic('light'); onCellInput(r, c, e.target.value); }}
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
                    <div key={cands[0]} className="sudoku-cell-value" style={{ color: originColor(origin?.type) }}>
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

          <div className="sd-legend">
            {[
              ['已知数', 'var(--gs-ink)'],
              ['唯一余数', 'var(--gs-green)'],
              ['隐性唯一', '#5e5ce6'],
              ['试探猜测', 'var(--gs-orange)'],
              ['回溯', 'var(--gs-red)'],
            ].map(([label, color]) => (
              <span key={label}><i style={{ background: color }} />{label}</span>
            ))}
          </div>
          {error && <div className="sd-error">{error}</div>}
        </div>

        <div className="sd-panel">
          {mode === 'input' && (
            <div className="sd-card">
              <div className="sd-card-title">怎么玩</div>
              <p>
                {cluesCount > 0
                  ? `已有 ${cluesCount} 个已知数。点「求解」看求解器一步步推理，或继续编辑任意格子。`
                  : '点格子输入 1–9（方向键移动），或在上方选难度生成一道谜题。'}
              </p>
            </div>
          )}

          {mode === 'solved' && reasoning && (
            <div className="sd-card">
              <div className="sd-card-title" style={{ color: reasoning.colorVar }}>
                {reasoning.title || '推理'} <span style={{ float: 'right', fontWeight: 400 }}>{reasoning.dofText}</span>
              </div>
              {reasoning.lines.map((line, i) => (
                <p key={i} dangerouslySetInnerHTML={{ __html: line }} />
              ))}
            </div>
          )}

          {mode === 'solved' && stats && (
            <div className="sd-card">
              <div className="sd-card-title">统计 · 第 {step + 1} / {trace.length} 步</div>
              <div className="sd-stats">
                {stats.map((s) => (
                  <div key={s.label}><b style={{ color: s.colorVar }}>{s.value}</b><span>{s.label}</span></div>
                ))}
              </div>
              <div className="sd-speed" style={{ marginTop: 12 }}>
                <label htmlFor="sudoku-speed">播放速度</label>
                <input id="sudoku-speed" type="range" min={0} max={4} step={1} value={speedIndex}
                  onChange={(e) => setSpeedIndex(Number(e.target.value))} />
                <span className="tnum" style={{ width: 36, textAlign: 'right' }}>{SPEED_LABELS[speedIndex]}</span>
              </div>
            </div>
          )}

          {mode === 'solved' && logLines.length > 0 && (
            <div className="sd-card">
              <div className="sd-card-title">推理日志</div>
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
        </div>
      </div>
    );
  };

  return (
    <GameStage
      title="数独"
      controls={(
        <>
          <Segmented
            value={lastDifficulty}
            onChange={(k) => { setLastDifficulty(k); handleGenerate(k); }}
            options={DIFFICULTIES.map((d) => ({ value: d.key, label: d.label }))}
          />
          <span className="sd-status" style={{ color: statusInfo.colorVar }}>{statusInfo.text}</span>
        </>
      )}
      dock={mode === 'solved' ? (
        <>
          <DockButton icon={PencilLine} label="编辑" onClick={() => goToInputMode(grid)} />
          <DockButton icon={ChevronLeft} label="上一步" disabled={step <= -1} onClick={() => { setPlaying(false); stepBack(); }} />
          <DockButton icon={playing ? Pause : Play} label={playing ? '暂停' : '播放'} on={playing} disabled={atEnd && !playing} onClick={() => setPlaying((p) => !p)} />
          <DockButton icon={ChevronRight} label="下一步" disabled={atEnd} onClick={() => { setPlaying(false); stepForward(); }} />
        </>
      ) : (
        <>
          <DockButton icon={Eraser} label="清空" disabled={generateDisabled} onClick={() => goToInputMode(emptyGrid())} />
          <DockButton icon={Shuffle} label="换一题" disabled={generateDisabled} onClick={() => handleGenerate(lastDifficulty)} />
          <DockButton icon={Sparkles} label="求解" disabled={solveDisabled || cluesCount === 0} onClick={handleSolve} on={!solveDisabled && cluesCount > 0} />
        </>
      )}
    >
      {renderStage}
    </GameStage>
  );
}
