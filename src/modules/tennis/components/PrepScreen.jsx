import { useRef, useState } from 'react';
import { FXNAME, PREP } from '../gameData';

function fxTags(fx) {
  return Object.entries(fx).map(([k, v]) => (
    <em key={k} className={v < 0 ? 'neg' : ''}>{FXNAME[k]}{v > 0 ? '+' : ''}{v}</em>
  ));
}

export function StatsPanel({ player, equipBonus }) {
  const eq = equipBonus || {};
  const bar = (label, val, cls = '', bonusKey = '') => {
    const bv = bonusKey ? (eq[bonusKey] || 0) : 0;
    return (
      <div className={`stat ${cls}`}>
        <div className="lab">
          <span>{label}</span>
          <b>{val}{bv > 0 && <span className="eq-bonus">+{bv}装</span>}</b>
        </div>
        <div className="bar"><i style={{ width: `${Math.min(100, val)}%` }} /></div>
      </div>
    );
  };
  return (
    <div className="stats-panel">
      {bar(`✨ 天赋（${player.grade}级）`, player.talent, 'talent')}
      {bar('💪 体力', player.sta, '', 'sta')}
      {bar('🎯 技巧', player.skill, '', 'skill')}
      {bar('🧘 心态', player.mind, '', 'mind')}
      {(eq.energyMax || 0) > 0 && (
        <div className="stat">
          <div className="lab"><span>👟 能量上限</span><b><span className="eq-bonus">+{eq.energyMax} 装</span></b></div>
        </div>
      )}
    </div>
  );
}

/** ③ 备战垃圾话环节（4 回合加点 + 绝技换装） */
export function PrepScreen({ state, dispatch, toast, ultimateOptions = [], equippedUltimate, onUltimateChange, equipBonus }) {
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
        <StatsPanel player={state.player} equipBonus={equipBonus} />
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
            {(() => { const sel = ultimateOptions.find((u) => u.name === equippedUltimate); return sel ? <p className="ult-pick-desc">⚡ {sel.face} {sel.name}：{sel.desc}</p> : null; })()}
          </div>
        )}
      </div>
    </section>
  );
}
