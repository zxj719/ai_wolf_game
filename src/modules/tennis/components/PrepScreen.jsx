import { useMemo, useRef, useState } from 'react';
import { CHAR_QUOTES, FXNAME, PREP, rand } from '../gameData';
import { loadLocalRecords, loadLastPrepStats } from '../localBoard';
import { CHAR_BUILDS, COUNTER_PAIRS, MOVES } from '../battle/moves';

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

  const preMatchQuote = useMemo(() => {
    if (state.prepRound !== PREP.length - 1 || !state.opp) return null;
    const pool = CHAR_QUOTES[state.opp.name]?.victory;
    return pool ? pool[rand(0, pool.length - 1)] : null;
  }, [state.prepRound, state.opp?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  const lastMatchHint = useMemo(() => {
    if (state.prepRound !== 0) return null;
    const recs = loadLocalRecords();
    if (!recs.length) return null;
    const last = recs[recs.length - 1];
    const won = last.sp > last.so;
    return `上次你面对 ${last.of} ${last.o}——${won ? '你赢了 🎉' : '你输了 😤'}`;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const oppStrategyHint = useMemo(() => {
    if (state.prepRound !== 0 || !state.opp) return null;
    const { sta, skill, mind, name, face } = state.opp;
    let dominant, advice;
    if (sta >= skill && sta >= mind) { dominant = '体力'; advice = '技巧或心态'; }
    else if (skill >= mind) { dominant = '技巧'; advice = '体力或心态'; }
    else { dominant = '心态'; advice = '体力或技巧'; }
    return `💡 球探速报：${face}${name} 今天${dominant}见长，备战可侧重强化${advice}`;
  }, [state.prepRound, state.opp]);

  const prepHistoryHint = useMemo(() => {
    if (state.prepRound !== 0 || !state.player || !state.opp) return null;
    const last = loadLastPrepStats(state.player.name, state.opp.name);
    if (!last) return null;
    return `📋 上次备战 ${state.opp.face}${state.opp.name}：体力 ${last.sta} · 技巧 ${last.skill} · 心态 ${last.mind}`;
  }, [state.prepRound, state.player?.name, state.opp?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  const matchupAdviceHint = useMemo(() => {
    if (state.prepRound !== 0 || !state.player || !state.opp) return null;
    const playerMoves = CHAR_BUILDS[state.player.name]?.moves ?? [];
    const oppMoves = CHAR_BUILDS[state.opp.name]?.moves ?? [];
    let counter = null, victim = null;
    for (const [c, v] of COUNTER_PAIRS) {
      if (playerMoves.includes(c) && oppMoves.includes(v)) { counter = c; victim = v; break; }
    }
    if (!counter) return null;
    const statLabel = { sta: '体力 💪', skill: '技巧 🎯', mind: '心态 🧘' };
    const attr = statLabel[MOVES[counter].stat] ?? MOVES[counter].stat;
    return `⚔️ 克制参考：出「${MOVES[counter].name}」可克制 ${state.opp.face}${state.opp.name} 惯用的「${MOVES[victim].name}」——备战重点强化${attr}`;
  }, [state.prepRound, state.player?.name, state.opp?.name]); // eslint-disable-line react-hooks/exhaustive-deps

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
        {lastMatchHint && (
          <p className="last-match-hint">{lastMatchHint}</p>
        )}
        {prepHistoryHint && (
          <p className="prep-history-hint">{prepHistoryHint}</p>
        )}
        {oppStrategyHint && (
          <p className="prep-strategy-hint">{oppStrategyHint}</p>
        )}
        {matchupAdviceHint && (
          <p className="matchup-advice-hint">{matchupAdviceHint}</p>
        )}
        {preMatchQuote && (
          <div className="char-quote-card">
            <span className="char-quote-who">{state.opp.face} {state.opp.name} 赛前嘚瑟：</span>
            <p className="char-quote-text">「{preMatchQuote}」</p>
          </div>
        )}
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
