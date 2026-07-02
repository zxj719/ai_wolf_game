/**
 * BattleScreen.jsx — 对战界面（A 段）
 *
 * 持有 battleReducer，驱动相位循环：
 *   idle --(自动 BEGIN_RALLY)--> serve|cards --PICK--> minigame --(自动 RESOLVE)--> idle/over
 * 随机量在此处掷出后注入 action（reducer 保持纯函数）。
 */

import { useEffect, useReducer, useRef, useState } from 'react';
import { MOVES, ULTIMATES, COUNTER_QUIPS, CHAR_BUILDS, COUNTER_PAIRS } from './moves';
import { CARDS } from './cards';
import { createBattle, battleReducer } from './battleReducer';
import { pointLabel, isKeyPoint } from './scoring';
import { MINIGAME_COMPONENTS, ServeTiming, SURVIVAL_GAMES } from './minigames';

const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

const SYSTEM_ICONS = { power: '🔨', spin: '🌀', net: '🥅', control: '🧠' };

// victim move → its first counter (derived from COUNTER_QUIPS key format 'a>b')
const COUNTER_FOR = {};
Object.keys(COUNTER_QUIPS).forEach(key => {
  const [a, b] = key.split('>');
  if (!COUNTER_FOR[b]) COUNTER_FOR[b] = a;
});

function ScorePanel({ state }) {
  const { score, player, opponent } = state;
  return (
    <div className="bt-scorepanel">
      <div className="bt-side">
        <span className="bt-face">{player.face}</span>
        <span className="bt-name">{player.name}</span>
      </div>
      <div className="bt-mid">
        <div className="bt-sets">{score.sets[0]} <small>SETS</small> {score.sets[1]}</div>
        <div className="bt-games">局 {score.games[0]}–{score.games[1]}</div>
        <div className="bt-points">
          {pointLabel(score, 0)} : {pointLabel(score, 1)}
          {score.goldenPoint && <span className="bt-golden">⚡金球</span>}
          {score.isDeuce && !score.goldenPoint && <span className="bt-deuce">Deuce</span>}
        </div>
      </div>
      <div className="bt-side right">
        <span className="bt-face">{opponent.face}</span>
        <span className="bt-name">{opponent.name}</span>
      </div>
    </div>
  );
}

function EnergyBar({ label, value, max = 100 }) {
  const pct = Math.round((value / max) * 100);
  const tier = value >= 60 ? 'fresh' : value >= 20 ? 'tired' : 'spent';
  return (
    <div className={`bt-energy ${tier}`}>
      <span className="bt-energy-label">{label}</span>
      <div className="bt-energy-bar"><i style={{ width: `${pct}%` }} /></div>
      <span className="bt-energy-num">{Math.round(value)}</span>
    </div>
  );
}

/**
 * 手牌：两步交互（移动端友好）——第一次点选中并展示卡牌说明，
 * 确认「打出」才消耗。title 悬浮提示在触屏上不可见，这是修复。
 */
function HandCards({ deck, onPlay, disabled }) {
  const [selected, setSelected] = useState(null);
  const sel = selected != null ? deck.hand[selected] : null;
  const selDef = sel ? CARDS[sel.cardId] : null;
  const selAffordable = selDef ? selDef.cost <= deck.tacticalPoints : false;

  return (
    <div>
      <div className="bt-hand">
        <span className="bt-tp" title="战术点">⚡{deck.tacticalPoints}</span>
        {deck.hand.length === 0 && <span className="bt-hand-empty">（手牌空）</span>}
        {deck.hand.map((c, i) => {
          const def = CARDS[c.cardId];
          const affordable = def.cost <= deck.tacticalPoints;
          return (
            <button
              key={`${c.cardId}-${i}`}
              type="button"
              className={`bt-card ${affordable && !disabled ? '' : 'dim'} ${selected === i ? 'selected' : ''}`}
              onClick={() => setSelected(selected === i ? null : i)}
            >
              <span className="bt-card-cost">{def.cost}</span>
              <span className="bt-card-icon">{def.icon}</span>
              <span className="bt-card-name">{def.name}{c.upgraded ? '+' : ''}</span>
            </button>
          );
        })}
      </div>
      {sel && (
        <div className="bt-card-detail">
          <span className="bt-card-detail-text">
            {selDef.icon} <b>{selDef.name}{sel.upgraded ? '+' : ''}</b>（{selDef.cost}⚡）— {selDef.desc(sel.upgraded)}
          </span>
          <button
            type="button"
            className={`btn mini ${selAffordable && !disabled ? '' : 'ghost'}`}
            onClick={() => {
              if (selAffordable && !disabled) { onPlay(selected); setSelected(null); }
            }}
          >
            {selAffordable ? '打出' : '战术点不足'}
          </button>
          <button type="button" className="btn ghost mini" onClick={() => setSelected(null)}>收回</button>
        </div>
      )}
    </div>
  );
}

function CounterChart({ onClose }) {
  const pairs = Object.keys(COUNTER_QUIPS).map(k => k.split('>'));
  return (
    <div className="bt-chart">
      <div className="bt-chart-hd">
        <span>📋 克制速查表（1.5× 克中 / 0.7× 被克）</span>
        <button type="button" className="bt-chart-close" onClick={onClose}>✕</button>
      </div>
      <div className="bt-chart-grid">
        {pairs.map(([a, b]) => (
          <div key={`${a}>${b}`} className="bt-chart-row">
            <span className="bt-chart-win">{MOVES[a].name}</span>
            <span className="bt-chart-arr">→克→</span>
            <span className="bt-chart-lose">{MOVES[b].name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MovePicker({ state, onPick, onUltimate }) {
  const moves = state.playerMoves;
  const exhausted = state.pEnergy < 20;
  const ult = state.ultimateName ? ULTIMATES[state.ultimateName] : null;
  const [showChart, setShowChart] = useState(false);
  return (
    <div>
      <div className="bt-moves-bar">
        <button
          type="button"
          className={`bt-chart-btn${showChart ? ' active' : ''}`}
          onClick={() => setShowChart(v => !v)}
        >
          📋 克制表
        </button>
      </div>
      {showChart && <CounterChart onClose={() => setShowChart(false)} />}
      <div className="bt-moves">
        {moves.map((id) => {
          const m = MOVES[id];
          const banned = exhausted && m.energyCost >= 16;
          return (
            <button
              key={id}
              type="button"
              className={`bt-move ${banned ? 'off' : ''}`}
              onClick={() => !banned && onPick(id)}
              title={m.desc}
            >
              <span className="bt-move-sys">{SYSTEM_ICONS[m.system]}</span>
              <span className="bt-move-name">{m.name}</span>
              <span className="bt-move-cost">{m.energyCost > 0 ? `-${m.energyCost}` : `+${-m.energyCost}`}体</span>
            </button>
          );
        })}
        {ult && (
          <button
            type="button"
            className={`bt-move ultimate ${state.ultimateUsed ? 'off' : ''}`}
            onClick={() => !state.ultimateUsed && onUltimate(state.ultimateName)}
          >
            <span className="bt-move-sys">{ult.face}</span>
            <span className="bt-move-name">
              {state.ultimateName}
              <small className="bt-ult-desc">{state.ultimateUsed ? '本场已用（一场限一次）' : ult.desc}</small>
            </span>
            <span className="bt-move-cost">绝技</span>
          </button>
        )}
      </div>
    </div>
  );
}

/** 特效层（D 段）：ACE 金闪 / 效果拔群 / CLUTCH / 被克。reduced-motion 自动隐藏（CSS） */
function FxOverlay({ state }) {
  const [fx, setFx] = useState(null);
  const prevRally = useRef(null);
  const prevAces = useRef(0);

  const prevUlt = useRef(false);
  useEffect(() => {
    if (state.matchStats.aces > prevAces.current) {
      prevAces.current = state.matchStats.aces;
      setFx({ key: Date.now(), type: 'ace', text: 'ACE！🎾', gold: true });
      return;
    }
    // 绝技发动反馈（修复「点了没反应」）
    if (state.ultimateUsed && !prevUlt.current) {
      prevUlt.current = true;
      setFx({ key: Date.now(), type: 'clutch', text: `⚡《${state.ultimateName}》发动！`, gold: true });
      return;
    }
    const r = state.lastRally;
    if (r && r !== prevRally.current) {
      prevRally.current = r;
      if (r.clutch) setFx({ key: Date.now(), type: 'clutch', text: '⚡ CLUTCH！⚡', gold: true });
      else if (r.hawkeyeSaved) setFx({ key: Date.now(), type: 'super', text: '🦅 鹰眼改判！' });
      else if (r.counterMul > 1 && r.win) setFx({ key: Date.now(), type: 'super', text: '效果拔群！' });
      else if (r.counterMul < 1 && !r.win) setFx({ key: Date.now(), type: 'bad', text: '被克制……' });
    }
  }, [state.lastRally, state.matchStats.aces, state.ultimateUsed, state.ultimateName]);

  useEffect(() => {
    if (!fx) return undefined;
    const t = setTimeout(() => setFx(null), 1200);
    return () => clearTimeout(t);
  }, [fx]);

  if (!fx) return null;
  return (
    <>
      {fx.gold && <div className="fx-goldflash" />}
      <div className={`fx-burst ${fx.type}`}>{fx.text}</div>
    </>
  );
}

function RallyLog({ state }) {
  const r = state.lastRally;
  if (!r) return null;
  const quip = COUNTER_QUIPS[`${r.pMove}>${r.oppMove}`];
  const counterForOpp = COUNTER_FOR[r.oppMove];
  return (
    <div className="bt-rallylog">
      <div className="bt-vs">
        <span className={`pill ${r.win ? 'win' : 'lose'}`}>
          {MOVES[r.pMove].name} {Math.round(r.pPower)}
        </span>
        <span>VS</span>
        <span className={`pill ${r.win ? 'lose' : 'win'}`}>
          {MOVES[r.oppMove].name} {Math.round(r.oPower)}
        </span>
      </div>
      <p className={r.win ? 'res-win' : 'res-lose'}>
        {r.hawkeyeSaved ? '🦅 鹰眼挑战成功！这球重打！'
          : r.counterMul > 1 && quip ? `效果拔群！${quip}`
          : r.counterMul < 1 ? '被克制了……节奏完全被打乱。'
          : r.win ? '🎉 这一分是你的！' : '😤 对手拿下此分。'}
        {r.tie ? '（平分，鹰眼回放偏向主队 🦅）' : ''}
      </p>
      {!r.win && counterForOpp && (
        <p className="bt-counter-tip">
          💡 「{MOVES[r.oppMove].name}」被「{MOVES[counterForOpp].name}」克制
        </p>
      )}
    </div>
  );
}

/** 非关键分读招教练：对手已用某招 ≥2 次时低调提示克制招。关键分由 CrisisHint 接管，两者互斥。 */
function OppCoachHint({ matchStats, score, phase }) {
  if (phase !== 'cards' || isKeyPoint(score)) return null;
  const usage = matchStats?.oppMoveUsage ?? {};
  const top = Object.entries(usage).sort((a, b) => b[1] - a[1])[0];
  if (!top || top[1] < 2) return null;
  const [moveId, count] = top;
  const counter = COUNTER_FOR[moveId];
  if (!counter) return null;
  return (
    <div className="bt-coach-hint">
      <span className="bt-coach-icon">🎯</span>
      <span className="bt-coach-text">
        对手惯用「{MOVES[moveId]?.name}」(×{count})，出「{MOVES[counter]?.name}」可克制
      </span>
    </div>
  );
}

/** 关键分读招提示：仅在 isKeyPoint + cards 阶段 + 对手已用某招 ≥2 次时显示 */
function CrisisHint({ matchStats, score, phase }) {
  if (phase !== 'cards' || !isKeyPoint(score)) return null;
  const usage = matchStats?.oppMoveUsage ?? {};
  const top = Object.entries(usage).sort((a, b) => b[1] - a[1])[0];
  if (!top || top[1] < 2) return null;
  const [moveId, count] = top;
  const counter = COUNTER_FOR[moveId];
  return (
    <div className="bt-crisis-hint">
      <span className="bt-crisis-icon">⚡</span>
      <span className="bt-crisis-text">
        关键分！对手惯用「{MOVES[moveId]?.name}」(×{count})
        {counter ? <>，出「{MOVES[counter]?.name}」可克制</> : '，注意读招'}
      </span>
    </div>
  );
}

/** 近球攻防趋势点阵：绿=克中 / 红=被克 / 灰=普通；0 球时不渲染 */
function RallyTrend({ rallyLog }) {
  if (!rallyLog.length) return null;
  const dots = rallyLog.slice(-7);
  return (
    <div className="bt-rally-trend" aria-label="近球攻防趋势">
      {dots.map((r, i) => {
        const type = r.counterMul > 1 && r.win && !r.hawkeyeSaved ? 'won'
          : r.counterMul < 1 && !r.win ? 'lost' : 'neutral';
        return <span key={i} className={`bt-rt-dot ${type}`} title={
          type === 'won' ? '克中' : type === 'lost' ? '被克' : '普通'
        } />;
      })}
    </div>
  );
}

/** 实时攻防压力芯片：克中得分 vs 被克失分，0/0 时隐藏 */
function DefensePressure({ countersWon, counterLost }) {
  if (!countersWon && !counterLost) return null;
  const lostTier = counterLost >= 4 ? 'danger' : counterLost >= 2 ? 'warn' : '';
  return (
    <div className="bt-defense-pressure">
      {counterLost > 0 && (
        <span className={`bt-dp-chip lost ${lostTier}`}>🛡 被克 {counterLost}</span>
      )}
      {countersWon > 0 && (
        <span className="bt-dp-chip won">⚔️ 克中 {countersWon}</span>
      )}
    </div>
  );
}

/** 首局迎新辅助：首次对战某对手时，在第 1 球 cards 阶段提前告知克制招，无需等对手先出 2 次。 */
function FirstMatchHint({ opponent, playerMoves }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  const oppMoves = CHAR_BUILDS[opponent.name]?.moves ?? [];
  let counter = null, victim = null;
  for (const [c, v] of COUNTER_PAIRS) {
    if (playerMoves.includes(c) && oppMoves.includes(v)) { counter = c; victim = v; break; }
  }
  if (!counter) return null;
  const statLabel = { sta: '体力 💪', skill: '技巧 🎯', mind: '心态 🧘' };
  const attr = statLabel[MOVES[counter].stat] ?? MOVES[counter].stat;
  return (
    <div className="bt-first-match-hint">
      <span className="bt-fmh-badge">🆕 初次对战</span>
      <span className="bt-fmh-text">
        出「{MOVES[counter].name}」可克制 {opponent.face}{opponent.name} 惯用的「{MOVES[victim].name}」——{attr}越强克制效果越佳
      </span>
      <button type="button" className="bt-fmh-close" onClick={() => setDismissed(true)} aria-label="关闭">×</button>
    </div>
  );
}

/**
 * @param {{player, opponent, deckInstances, ultimate?, twists?, equip?, playerMoves,
 *          isFirstMatch?: boolean,
 *          onMatchOver: (result: {score, matchStats}) => void}} props
 */
export function BattleScreen({
  player, opponent, deckInstances, ultimate, twists, equip, playerMoves, isFirstMatch, onMatchOver,
}) {
  const [state, dispatch] = useReducer(
    battleReducer,
    { player, opponent, deckInstances, ultimate, twists, equip, rng: Math.random },
    createBattle
  );
  const fullState = { ...state, playerMoves };
  const overReported = useRef(false);
  const startedAt = useRef(Date.now());
  const [reducedMotion] = useState(
    () => typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
  const timeScale = twists?.timeScale ?? 1;
  const windowBonus = state.pendingEffects.windowBonus + (reducedMotion ? 0.3 : 0);

  // idle → 自动开始下一球（留 1.4s 看结算）
  useEffect(() => {
    if (state.phase !== 'idle' || state.score.matchOver) return undefined;
    const t = setTimeout(() => {
      dispatch({
        type: 'BEGIN_RALLY',
        rng: Math.random,
        moveRoll: Math.random(),
        truthRoll: Math.random(),
        fakeRoll: Math.random(),
      });
    }, state.lastRally ? 1400 : 400);
    return () => clearTimeout(t);
  }, [state.phase, state.score.matchOver, state.lastRally]);

  // resolve → 自动结算
  useEffect(() => {
    if (state.phase !== 'resolve') return undefined;
    const t = setTimeout(() => {
      dispatch({
        type: 'RESOLVE',
        oppPerformRoll: rand(1, 20),
        noiseP: rand(-3, 3),
        noiseO: rand(-3, 3),
      });
    }, 250);
    return () => clearTimeout(t);
  }, [state.phase]);

  // over → 上报一次
  useEffect(() => {
    if (state.phase === 'over' && !overReported.current) {
      overReported.current = true;
      onMatchOver({
        score: state.score,
        matchStats: state.matchStats,
        rallyCount: state.rallyCount,
        pEnergy: state.pEnergy,
        durationS: Math.round((Date.now() - startedAt.current) / 1000),
      });
    }
  }, [state.phase, state.score, state.matchStats, state.pEnergy, onMatchOver]);

  // 关键分（盘点/金球）：招式小游戏替换为坚持类挑战——过关顶格 1.5×，失败 0.6×
  const keyPoint = isKeyPoint(state.score);
  const SurvivalGame = keyPoint
    ? SURVIVAL_GAMES[state.rallyCount % 2 === 0 ? 'flappy' : 'dodge']
    : null;
  const Minigame = state.pMove ? MINIGAME_COMPONENTS[MOVES[state.pMove].minigame] : null;
  const showOppMove = state.pendingEffects.reveal && state.oppMove;

  return (
    <div className="bt-screen">
      <ScorePanel state={state} />
      <div className="bt-energies">
        <EnergyBar label={player.face} value={state.pEnergy} max={state.pEnergyMax} />
        <EnergyBar label={opponent.face} value={state.oEnergy} />
      </div>
      <DefensePressure
        countersWon={state.matchStats.countersWon}
        counterLost={state.matchStats.counterLost ?? 0}
      />
      <RallyTrend rallyLog={state.rallyLog} />

      <div className="card flat bt-arena-card">
        {state.tell && state.phase === 'cards' && (
          <div className="bt-tell">
            {opponent.face} {showOppMove
              ? <>
                  出招已被透视：<b>{MOVES[state.oppMove].name}</b>！
                  {COUNTER_FOR[state.oppMove] && (
                    <small className="bt-tell-counter">💡 出「{MOVES[COUNTER_FOR[state.oppMove]].name}」克制！</small>
                  )}
                </>
              : <>
                  {state.tell.text}……
                  {state.tell.hintMove && COUNTER_FOR[state.tell.hintMove] && (
                    <small className="bt-tell-counter">💡 出「{MOVES[COUNTER_FOR[state.tell.hintMove]].name}」可克制</small>
                  )}
                </>}
          </div>
        )}

        {state.phase === 'serve' && (
          <ServeTiming
            onServe={(result) => dispatch({ type: 'SERVE_DONE', result })}
            timeScale={timeScale}
            windowBonus={windowBonus}
          />
        )}

        {state.phase === 'cards' && (
          <>
            {state.activeUltimate && (
              <div className="bt-ult-armed">⚡ 绝技已就绪 —— 本球生效！</div>
            )}
            {isFirstMatch && state.rallyCount === 1 && (
              <FirstMatchHint opponent={opponent} playerMoves={playerMoves} />
            )}
            <OppCoachHint matchStats={state.matchStats} score={state.score} phase={state.phase} />
            <CrisisHint matchStats={state.matchStats} score={state.score} phase={state.phase} />
            <HandCards deck={state.deck} onPlay={(idx) => dispatch({ type: 'PLAY_CARD', idx })} />
            <MovePicker
              state={fullState}
              onPick={(moveId) => dispatch({ type: 'PICK_MOVE', moveId })}
              onUltimate={(name) => dispatch({ type: 'USE_ULTIMATE', name })}
            />
          </>
        )}

        {state.phase === 'minigame' && SurvivalGame && (
          <>
            <div className="set-banner">⚡ 关键分 · 坚持住就是你的！⚡</div>
            <SurvivalGame
              onDone={(m, extra) => dispatch({
                type: 'MINIGAME_DONE',
                multiplier: extra?.passed ? 1.5 : 0.6,
              })}
            />
          </>
        )}
        {state.phase === 'minigame' && !SurvivalGame && Minigame && (
          <Minigame
            onDone={(multiplier) => dispatch({ type: 'MINIGAME_DONE', multiplier })}
            timeScale={timeScale}
            windowBonus={windowBonus}
          />
        )}

        {(state.phase === 'idle' || state.phase === 'resolve' || state.phase === 'over') && (
          <RallyLog state={state} />
        )}
      </div>
      <FxOverlay state={state} />
    </div>
  );
}
