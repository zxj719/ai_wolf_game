/**
 * BattleScreen.jsx — 对战界面（A 段）
 *
 * 持有 battleReducer，驱动相位循环：
 *   idle --(自动 BEGIN_RALLY)--> serve|cards --PICK--> minigame --(自动 RESOLVE)--> idle/over
 * 随机量在此处掷出后注入 action（reducer 保持纯函数）。
 */

import { useEffect, useReducer, useRef, useState } from 'react';
import { MOVES, ULTIMATES, COUNTER_QUIPS } from './moves';
import { CARDS } from './cards';
import { createBattle, battleReducer } from './battleReducer';
import { pointLabel } from './scoring';
import { MINIGAME_COMPONENTS, ServeTiming } from './minigames';

const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

const SYSTEM_ICONS = { power: '🔨', spin: '🌀', net: '🥅', control: '🧠' };

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

function HandCards({ deck, onPlay, disabled }) {
  return (
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
            className={`bt-card ${affordable && !disabled ? '' : 'off'}`}
            onClick={() => affordable && !disabled && onPlay(i)}
            title={def.desc(c.upgraded)}
          >
            <span className="bt-card-cost">{def.cost}</span>
            <span className="bt-card-icon">{def.icon}</span>
            <span className="bt-card-name">{def.name}{c.upgraded ? '+' : ''}</span>
          </button>
        );
      })}
    </div>
  );
}

function MovePicker({ state, onPick, onUltimate }) {
  const moves = state.playerMoves;
  const exhausted = state.pEnergy < 20;
  const ult = state.ultimateName ? ULTIMATES[state.ultimateName] : null;
  return (
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
          title={ult.desc}
        >
          <span className="bt-move-sys">{ult.face}</span>
          <span className="bt-move-name">{state.ultimateName}</span>
          <span className="bt-move-cost">绝技</span>
        </button>
      )}
    </div>
  );
}

function RallyLog({ state }) {
  const r = state.lastRally;
  if (!r) return null;
  const quip = COUNTER_QUIPS[`${r.pMove}>${r.oppMove}`];
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
    </div>
  );
}

/**
 * @param {{player, opponent, deckInstances, ultimate?, twists?, equip?, playerMoves,
 *          onMatchOver: (result: {score, matchStats}) => void}} props
 */
export function BattleScreen({
  player, opponent, deckInstances, ultimate, twists, equip, playerMoves, onMatchOver,
}) {
  const [state, dispatch] = useReducer(
    battleReducer,
    { player, opponent, deckInstances, ultimate, twists, equip, rng: Math.random },
    createBattle
  );
  const fullState = { ...state, playerMoves };
  const overReported = useRef(false);
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
      onMatchOver({ score: state.score, matchStats: state.matchStats, pEnergy: state.pEnergy });
    }
  }, [state.phase, state.score, state.matchStats, state.pEnergy, onMatchOver]);

  const Minigame = state.pMove ? MINIGAME_COMPONENTS[MOVES[state.pMove].minigame] : null;
  const showOppMove = state.pendingEffects.reveal && state.oppMove;

  return (
    <div className="bt-screen">
      <ScorePanel state={state} />
      <div className="bt-energies">
        <EnergyBar label={player.face} value={state.pEnergy} max={state.pEnergyMax} />
        <EnergyBar label={opponent.face} value={state.oEnergy} />
      </div>

      <div className="card flat bt-arena-card">
        {state.tell && state.phase === 'cards' && (
          <div className="bt-tell">
            {opponent.face} {showOppMove
              ? <>出招已被透视：<b>{MOVES[state.oppMove].name}</b>！</>
              : <>{state.tell.text}……</>}
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
            <HandCards deck={state.deck} onPlay={(idx) => dispatch({ type: 'PLAY_CARD', idx })} />
            <MovePicker
              state={fullState}
              onPick={(moveId) => dispatch({ type: 'PICK_MOVE', moveId })}
              onUltimate={(name) => dispatch({ type: 'USE_ULTIMATE', name })}
            />
          </>
        )}

        {state.phase === 'minigame' && Minigame && (
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
    </div>
  );
}
