import { useRef, useState } from 'react';
import { FXNAME, PREP } from '../gameData';

function fxTags(fx) {
  return Object.entries(fx).map(([k, v]) => (
    <em key={k} className={v < 0 ? 'neg' : ''}>{FXNAME[k]}{v > 0 ? '+' : ''}{v}</em>
  ));
}

export function StatsPanel({ player }) {
  const bar = (label, val, cls = '') => (
    <div className={`stat ${cls}`}>
      <div className="lab"><span>{label}</span><b>{val}</b></div>
      <div className="bar"><i style={{ width: `${Math.min(100, val)}%` }} /></div>
    </div>
  );
  return (
    <div className="stats-panel">
      {bar(`✨ 天赋（${player.grade}级）`, player.talent, 'talent')}
      {bar('💪 体力', player.sta)}
      {bar('🎯 技巧', player.skill)}
      {bar('🧘 心态', player.mind)}
    </div>
  );
}

/** ③ 备战垃圾话环节（4 回合加点 + 绝技换装） */
export function PrepScreen({ state, dispatch, toast, ultimateOptions = [], equippedUltimate, onUltimateChange }) {
  const round = PREP[state.prepRound];
  const [locked, setLocked] = useState(false);
  const lockTimer = useRef(null);

  const onPick = (i) => {
    if (locked) return;
    setLocked(true);
    if (state.prepRound === PREP.length - 1) {
      toast('备战完毕！裁判已就位 🏟️');
    }
    dispatch({ type: 'PICK_PREP', optIdx: i });
    clearTimeout(lockTimer.current);
    lockTimer.current = setTimeout(() => setLocked(false), 420);
  };

  return (
    <section className="screen">
      <div className="card">
        <span className="round-tag">备战回合 {state.prepRound + 1} / 4</span>
        <h2>{round.title}</h2>
        <p className="hint">{round.desc}</p>
        <div className="opts">
          {round.opts.map((o, i) => (
            <button type="button" className="opt" key={o.t} onClick={() => onPick(i)}>
              <span className="key">{'ABC'[i]}</span>
              <span>{o.t}<span className="fx">{fxTags(o.fx)}</span></span>
            </button>
          ))}
        </div>
      </div>
      <div className="card flat">
        <h2 style={{ fontSize: '1.1rem' }}>📋 当前状态面板</h2>
        <StatsPanel player={state.player} />
        {ultimateOptions.length > 1 && (
          <div className="ult-pick">
            <span className="ult-pick-label">⚡ 出战绝技</span>
            <select
              className="player-select"
              value={equippedUltimate}
              onChange={(e) => onUltimateChange(e.target.value)}
            >
              {ultimateOptions.map((u) => (
                <option key={u.name} value={u.name}>{u.face} {u.name} — {u.desc}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </section>
  );
}
