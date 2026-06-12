/**
 * battleReducer.js — 球级对决状态机（纯函数，spec §1.4）
 *
 * 相位：idle → (BEGIN_RALLY) → serve|cards → pick(隐含在 cards) → minigame → resolve → idle/over
 * 所有随机量（洗牌 rng、对手出招/提示 roll、对手发挥 roll、噪声）经 action 注入。
 * 威力公式：(属性+装备+talent×0.4) × 体力档 × 克制 × 小游戏倍率 × (1+卡牌/发球加成) + 噪声 + 绝技修正
 *
 * twists（C 段离谱对手规则扭曲）在此预留入参，A 段为空对象直通。
 */

import { MOVES, counterMultiplier, ULTIMATES } from './moves';
import { createScore, addPoint, isKeyPoint } from './scoring';
import { createDeckState, startRally, playCard } from './cards';
import { pickOpponentMove, makeTell } from './opponentAI';

export function energyPenalty(energy) {
  if (energy >= 50) return 1.0;     // 平衡补丁：充沛线 60→50
  if (energy >= 20) return 0.85;    // 疲惫 0.8→0.85
  return 0.7;                       // 力竭 0.6→0.7
}

const EXHAUSTED_BELOW = 20;
const HEAVY_COST = 16;

const freshPendingEffects = () => ({
  powerMul: 0,
  windowBonus: 0,
  reveal: false,
  counterNullify: false,
  counterInvert: false,
  minigameFloor: 0,
  hawkeyeCharges: 0,
  counterShieldCharges: 0,
  halfCostRallies: 0,
});

/** 每球重置的瞬态字段（持久充能类保留） */
function resetRallyEffects(fx) {
  return {
    ...fx,
    powerMul: 0,
    windowBonus: 0,
    reveal: false,
    counterNullify: false,
    counterInvert: false,
    minigameFloor: 0,
  };
}

export function createBattle({ player, opponent, deckInstances, rng, ultimate, twists = {}, equip = null, initialEnergy = null }) {
  const ownUltimate = Object.entries(ULTIMATES).find(([, u]) => u.owner === player.name)?.[0] ?? null;
  const energyMax = 100 + (equip?.energyMax ?? 0);
  return {
    phase: 'idle',
    player,
    opponent,
    equip: equip ?? { sta: 0, skill: 0, mind: 0 },
    special: equip?.special ?? {},     // 挂件特效（counterBoost/restBonus/aceBoost/...）
    aceBoostArmed: false,
    twists,
    pEnergyMax: energyMax,
    pEnergy: initialEnergy != null ? Math.min(energyMax, initialEnergy) : energyMax,
    oEnergy: 100,
    pMindBonus: 0,
    deck: createDeckState(deckInstances, rng),
    score: createScore(),
    rallyCount: 0,
    needServe: true,
    serveBonus: 0,
    oppMove: null,
    tell: null,
    pMove: null,
    pMultiplier: 1,
    pendingEffects: freshPendingEffects(),
    ultimateName: ultimate ?? ownUltimate,
    ultimateUsed: false,
    activeUltimate: null,
    lastRally: null,
    rallyLog: [],
    matchStats: { aces: 0, countersWon: 0, clutchWins: 0 },
  };
}

function afterPoint(state, who) {
  const score = addPoint(state.score, who);
  const next = { ...state, score };
  if (score.restEnergy > 0) {
    // restBonus 挂件：玩家局间额外回体
    const pRest = score.restEnergy + (state.special?.restBonus ?? 0);
    next.pEnergy = Math.min(state.pEnergyMax, state.pEnergy + pRest);
    next.oEnergy = Math.min(100, state.oEnergy + score.restEnergy);
    next.needServe = true;     // 新局重新发球
  }
  next.phase = score.matchOver ? 'over' : 'idle';
  return next;
}

export function battleReducer(state, action) {
  switch (action.type) {
    case 'BEGIN_RALLY': {
      if (state.phase !== 'idle' || state.score.matchOver) return state;
      const deck = startRally(state.deck, action.rng);
      // 配招来源：BOSS 相位轮换 builds → 自定义 build → 家人查表
      const setsPlayed = state.score.sets[0] + state.score.sets[1];
      const build = state.opponent.builds
        ? state.opponent.builds[setsPlayed % state.opponent.builds.length]
        : state.opponent.build;
      const oppMove = pickOpponentMove({
        charName: state.opponent.name,
        build,
        energy: state.oEnergy,
        rngRoll: action.moveRoll,
      });
      const tell = makeTell({
        charName: state.opponent.name,
        build,
        actualMove: oppMove,
        // predictable 扭曲（BOT-3000）：提示永真
        truthRoll: state.twists.predictable ? 0 : action.truthRoll,
        fakeRoll: action.fakeRoll,
      });
      return {
        ...state,
        rallyCount: state.rallyCount + 1,
        deck,
        oppMove,
        tell,
        pMove: null,
        pMultiplier: 1,
        serveBonus: 0,
        activeUltimate: null,
        pendingEffects: resetRallyEffects(state.pendingEffects),
        phase: state.needServe ? 'serve' : 'cards',
      };
    }

    case 'SERVE_DONE': {
      if (state.phase !== 'serve') return state;
      const base = { ...state, needServe: false };
      if (action.result === 'ace') {
        return afterPoint(
          {
            ...base,
            matchStats: { ...state.matchStats, aces: state.matchStats.aces + 1 },
            aceBoostArmed: !!state.special?.aceBoost,   // aceBoost 挂件：下球威力加成
          },
          0
        );
      }
      const serveBonus = action.result === 'good' ? 0.15 : action.result === 'fault' ? -0.10 : 0;
      return { ...base, serveBonus, phase: 'cards' };
    }

    case 'PLAY_CARD': {
      if (state.phase !== 'cards') return state;
      const r = playCard(state.deck, action.idx);
      if (r.error) return state;
      const fx = { ...state.pendingEffects };
      let { pEnergy, pMindBonus } = state;
      const e = r.effect;
      switch (e.type) {
        case 'energy': pEnergy = Math.min(state.pEnergyMax, pEnergy + e.amount); break;
        case 'windowBonus': fx.windowBonus += e.amount; break;
        case 'powerMul': fx.powerMul += e.amount; break;
        case 'reveal': fx.reveal = true; fx.windowBonus += e.windowBonus ?? 0; break;
        case 'hawkeye': fx.hawkeyeCharges += e.charges; break;
        case 'counterNullify': fx.counterNullify = true; break;
        case 'counterInvert': fx.counterInvert = true; break;
        case 'counterShield': fx.counterShieldCharges += e.charges; break;
        case 'halfCost': fx.halfCostRallies = Math.max(fx.halfCostRallies, e.rallies); break;
        case 'minigameFloor': fx.minigameFloor = Math.max(fx.minigameFloor, e.floor); break;
        default: break;
      }
      return { ...state, deck: r.deck, pendingEffects: fx, pEnergy, pMindBonus };
    }

    case 'USE_ULTIMATE': {
      if (state.ultimateUsed || action.name !== state.ultimateName) return state;
      const ult = ULTIMATES[action.name];
      if (!ult) return state;
      const next = { ...state, ultimateUsed: true };
      const e = ult.effect;
      switch (e.type) {
        case 'drainEnergy':
          next.oEnergy = Math.max(0, state.oEnergy - e.amount);
          break;
        case 'stealEnergy':
          next.oEnergy = Math.max(0, state.oEnergy - e.amount);
          next.pEnergy = Math.min(state.pEnergyMax, state.pEnergy + e.amount);
          break;
        case 'fullRestore':
          next.pEnergy = state.pEnergyMax;
          next.pMindBonus = state.pMindBonus + (e.mindBonus ?? 0);
          break;
        case 'reveal':
          next.activeUltimate = e;
          next.pendingEffects = { ...state.pendingEffects, reveal: true };
          break;
        default:
          next.activeUltimate = e;   // autoCounter / freePower / counterImmune
          break;
      }
      return next;
    }

    case 'PICK_MOVE': {
      if (state.phase !== 'cards') return state;
      const move = MOVES[action.moveId];
      if (!move) return state;
      let cost = move.energyCost;
      if (state.activeUltimate?.type === 'freePower' && action.moveId === 'flatDrive') cost = 0;
      if (state.pendingEffects.halfCostRallies > 0 && cost > 0) cost = Math.ceil(cost / 2);
      // 力竭禁重招
      if (state.pEnergy < EXHAUSTED_BELOW && move.energyCost >= HEAVY_COST && cost > 0) return state;
      const pEnergy = Math.max(0, Math.min(state.pEnergyMax, state.pEnergy - cost));
      const fx = state.pendingEffects.halfCostRallies > 0
        ? { ...state.pendingEffects, halfCostRallies: state.pendingEffects.halfCostRallies - 1 }
        : state.pendingEffects;
      return { ...state, pMove: action.moveId, pEnergy, pendingEffects: fx, phase: 'minigame' };
    }

    case 'MINIGAME_DONE': {
      if (state.phase !== 'minigame') return state;
      let m = Math.max(0.5, Math.min(1.5, action.multiplier));
      if (state.pendingEffects.minigameFloor > 0) {
        m = Math.max(m, state.pendingEffects.minigameFloor);
      }
      return { ...state, pMultiplier: m, phase: 'resolve' };
    }

    case 'RESOLVE': {
      if (state.phase !== 'resolve') return state;
      const { pMove, oppMove } = state;
      const fx = state.pendingEffects;
      const ult = state.activeUltimate;

      // 对手付出招代价
      const oEnergy = Math.max(0, Math.min(100, state.oEnergy - MOVES[oppMove].energyCost));

      // 克制
      let pCounter = counterMultiplier(pMove, oppMove);
      let oCounter = counterMultiplier(oppMove, pMove);
      if (ult?.type === 'autoCounter') { pCounter = 1.5; oCounter = 0.7; }
      // counterBoost 挂件：克中时倍率再 +0.1
      if (pCounter > 1 && state.special?.counterBoost) pCounter += state.special.counterBoost;
      if (fx.counterNullify) { pCounter = 1.0; oCounter = 1.0; }
      if (fx.counterInvert) { [pCounter, oCounter] = [oCounter, pCounter]; }
      let shieldCharges = fx.counterShieldCharges;
      if ((ult?.type === 'counterImmune' || shieldCharges > 0) && pCounter === 0.7) {
        if (ult?.type !== 'counterImmune') shieldCharges -= 1;
        pCounter = 1.0; oCounter = 1.0;
      }

      // 玩家威力（twists：渡劫强制比拼心态 / 心理免疫减半；powerFactor：成本买威力）
      const twists = state.twists;
      const mindDuel = twists.forcedMindDuel && state.rallyCount % twists.forcedMindDuel === 0;
      const stat = mindDuel ? 'mind' : MOVES[pMove].stat;
      let pBase = (state.player[stat] + (state.equip[stat] ?? 0)
        + Math.round(state.player.talent * 0.4)
        + (stat === 'mind' ? state.pMindBonus : 0)) * MOVES[pMove].powerFactor;
      if ((twists.mindImmune || twists.mindless) && MOVES[pMove].stat === 'mind' && !mindDuel) {
        pBase *= 0.5;
      }
      // 虎啸正手的 1.5× 即克制倍率本身，不再额外乘
      const ultBonus = ult?.rollBonus ?? 0;
      const aceBonus = state.aceBoostArmed ? (state.special?.aceBoost ?? 0) : 0;
      let pPower = pBase * energyPenalty(state.pEnergy) * pCounter * state.pMultiplier
        * (1 + fx.powerMul + state.serveBonus + aceBonus) + action.noiseP + ultBonus;

      // 借力打力（太极宗师）：力量系招式按概率被反弹
      const reflected = twists.powerReflect
        && MOVES[pMove].system === 'power'
        && (action.reflectRoll ?? 1) < twists.powerReflect;
      if (reflected) pPower *= 0.25;

      // 对手威力（d20 → 0.5–1.35：上限低于玩家满分 1.5，给人类操作留出回报空间）
      const oStat = mindDuel ? 'mind' : MOVES[oppMove].stat;
      const oMultiplier = 0.5 + (action.oppPerformRoll - 1) / 19 * 0.85;
      const oPower = state.opponent[oStat] * MOVES[oppMove].powerFactor
        * energyPenalty(oEnergy) * oCounter * oMultiplier + action.noiseO;

      const win = pPower >= oPower;

      // 鹰眼：失分翻判重打
      if (!win && fx.hawkeyeCharges > 0) {
        const lastRally = {
          pMove, oppMove, pPower, oPower, counterMul: pCounter, win: false,
          hawkeyeSaved: true,
        };
        return {
          ...state,
          oEnergy,
          pendingEffects: { ...resetRallyEffects(fx), hawkeyeCharges: fx.hawkeyeCharges - 1, counterShieldCharges: shieldCharges },
          activeUltimate: null,
          serveBonus: 0,
          lastRally,
          rallyLog: [...state.rallyLog.slice(-9), lastRally],
          phase: 'idle',
        };
      }

      // CLUTCH：关键分上以顶格小游戏表现赢分（坚持类挑战过关）
      const keyPoint = isKeyPoint(state.score);
      const clutch = keyPoint && win && state.pMultiplier >= 1.5;
      const lastRally = {
        pMove, oppMove, pPower, oPower, counterMul: pCounter,
        pMultiplier: state.pMultiplier, oMultiplier, win, hawkeyeSaved: false,
        tie: Math.abs(pPower - oPower) < 1e-9,
        reflected, mindDuel, keyPoint, clutch,
      };
      const matchStats = {
        ...state.matchStats,
        countersWon: state.matchStats.countersWon + (win && pCounter > 1 ? 1 : 0),
        clutchWins: state.matchStats.clutchWins + (clutch ? 1 : 0),
      };
      const settled = {
        ...state,
        oEnergy,
        pendingEffects: { ...resetRallyEffects(fx), counterShieldCharges: shieldCharges },
        activeUltimate: null,
        serveBonus: 0,
        aceBoostArmed: false,
        lastRally,
        rallyLog: [...state.rallyLog.slice(-9), lastRally],
        matchStats,
      };
      return afterPoint(settled, win ? 0 : 1);
    }

    default:
      return state;
  }
}
