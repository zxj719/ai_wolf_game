import { useCallback, useEffect, useRef, useState } from 'react';
import { rand } from '../gameData';
import { gradeFromMs } from '../useTennisGame';

const BallSvg = () => (
  <svg viewBox="0 0 100 100" width="96" height="96">
    <circle cx="50" cy="50" r="46" fill="#d9ff3d" stroke="#aacc12" strokeWidth="3" />
    <path d="M14 22 Q50 50 14 78" fill="none" stroke="#fffdf4" strokeWidth="5" strokeLinecap="round" />
    <path d="M86 22 Q50 50 86 78" fill="none" stroke="#fffdf4" strokeWidth="5" strokeLinecap="round" />
  </svg>
);

/**
 * ② 动态反应测试。
 * 内部相位机：idle → counting → waiting → live → done（偷跑回 idle）。
 * 完成后 dispatch SET_REACTION；「进入备战」dispatch TO_PREP。
 */
export function ReactTest({ dispatch, toast }) {
  const [phase, setPhase] = useState('idle');
  const [count, setCount] = useState(3);
  const [ballPos, setBallPos] = useState(null);
  const [result, setResult] = useState(null); // { ms, grade, talent, quip }
  const [flash, setFlash] = useState(false);

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const timersRef = useRef([]);
  const t0Ref = useRef(0);

  const addTimer = (id) => timersRef.current.push(id);
  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  const beginCountdown = useCallback(() => {
    setPhase('counting');
    setCount(3);
    let n = 3;
    const cd = setInterval(() => {
      n -= 1;
      if (n > 0) {
        setCount(n);
      } else {
        clearInterval(cd);
        setPhase('waiting');
        addTimer(setTimeout(() => {
          setBallPos({ left: rand(8, 72), top: rand(10, 62) });
          t0Ref.current = performance.now();
          setPhase('live');
        }, rand(1000, 3000)));
      }
    }, 700);
    addTimer(cd);
  }, []);

  const settle = useCallback(() => {
    const ms = Math.round(performance.now() - t0Ref.current);
    const { grade, talent, quip } = gradeFromMs(ms);
    setBallPos(null);
    setFlash(true);
    addTimer(setTimeout(() => setFlash(false), 520));
    setResult({ ms, grade, talent, quip });
    setPhase('done');
    dispatch({ type: 'SET_REACTION', ms });
  }, [dispatch]);

  const arenaTap = useCallback(() => {
    const p = phaseRef.current;
    if (p === 'idle') {
      beginCountdown();
    } else if (p === 'waiting') {
      // 偷跑！清掉发球计时器，回到起点
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      setPhase('idle');
      toast('⚠️ 偷跑！裁判警告一次，重新来！');
    } else if (p === 'live') {
      settle();
    }
  }, [beginCountdown, settle, toast]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        arenaTap();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [arenaTap]);

  const message = {
    idle: <>点击球场，开始测试<small>（球闪现的瞬间，点击或按空格）</small></>,
    counting: <span className="count">{count}</span>,
    waiting: <>盯紧球网…… 🤫</>,
    live: null,
    done: result ? <>接到了！<small>{result.quip}</small></> : null,
  }[phase];

  return (
    <section className="screen">
      <div className="card">
        <h2>② 动态反应测试 · 决定天赋</h2>
        <p className="hint">网球一闪现，立刻 <b>点击球场</b> 或按 <b>空格键</b>！偷跑（球没出现就点）要被裁判警告重测哦。</p>
        <div
          className={`arena ${flash ? 'flash' : ''}`}
          role="button"
          tabIndex={0}
          aria-label="反应测试区域"
          onPointerDown={arenaTap}
        >
          <div className="net-mesh" />
          <div className="state-msg">{message}</div>
          {ballPos && (
            <button
              type="button"
              className="ball-btn"
              aria-label="网球！快点！"
              style={{ left: `${ballPos.left}%`, top: `${ballPos.top}%` }}
            >
              <BallSvg />
            </button>
          )}
        </div>
        {result && (
          <div className="grade-show">
            <div className="grade-badge">{result.grade}</div>
            <div className="grade-meta">
              反应时间 <b>{result.ms}</b> ms<br />
              初始天赋 <b>{result.talent}</b> 点
            </div>
            <button type="button" className="btn" onClick={() => dispatch({ type: 'TO_PREP' })}>
              进入备战 →
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
