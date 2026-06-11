/**
 * ladderReducer.js — 家族挑战赛程状态机（纯函数，spec §3）
 *
 * 6 站梯度连战：第 i 站对手属性 ∈ [40+8i, 50+8i]，输一场即止步（战利品保留）。
 * 赛间三选一：特训(+8 随机属性) / 按摩(额外 +30 体) / 进店（ShopPanel）。
 * 击败谁解锁谁的绝技；6 连胜 status='won'（球王，由调用方 +championships）。
 */

import { CHARS } from '../gameData';
import { ULTIMATES } from '../battle/moves';

export const STAGE_COUNT = 6;
const STATS = ['sta', 'skill', 'mind'];

function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createLadder({ playerName, rng }) {
  const pool = shuffle(CHARS.filter((c) => c.n !== playerName), rng);
  const opponents = pool.map((c, i) => {
    const lo = 40 + i * 8;
    return {
      name: c.n,
      face: c.f,
      sta: lo + Math.floor(rng() * 11),
      skill: lo + Math.floor(rng() * 11),
      mind: lo + Math.floor(rng() * 11),
    };
  });
  return {
    stage: 0,
    opponents,
    status: 'fighting',      // fighting | between | won | lost
    carryEnergy: 100,
    lastRemainingEnergy: 0,
    massageBonus: 0,
    bonusStats: { sta: 0, skill: 0, mind: 0 },
    drops: [],
    coinsEarned: 0,
    unlockedThisRun: [],
    pendingShop: false,
  };
}

const ultimateOf = (charName) =>
  Object.entries(ULTIMATES).find(([, u]) => u.owner === charName)?.[0] ?? null;

function advanceStage(state) {
  return {
    ...state,
    stage: state.stage + 1,
    status: 'fighting',
    carryEnergy: Math.min(100, state.lastRemainingEnergy + 40 + state.massageBonus),
    massageBonus: 0,
    pendingShop: false,
  };
}

export function ladderReducer(state, action) {
  switch (action.type) {
    case 'MATCH_WON': {
      const beaten = state.opponents[state.stage].name;
      const ult = ultimateOf(beaten);
      const next = {
        ...state,
        lastRemainingEnergy: action.remainingEnergy ?? 0,
        drops: action.drop ? [...state.drops, action.drop] : state.drops,
        coinsEarned: state.coinsEarned + (action.coins ?? 0),
        unlockedThisRun: ult ? [...state.unlockedThisRun, ult] : state.unlockedThisRun,
      };
      next.status = state.stage >= STAGE_COUNT - 1 ? 'won' : 'between';
      return next;
    }

    case 'MATCH_LOST':
      return {
        ...state,
        status: 'lost',
        drops: action.drop ? [...state.drops, action.drop] : state.drops,
        coinsEarned: state.coinsEarned + (action.coins ?? 0),
      };

    case 'INTERMISSION': {
      if (state.status !== 'between') return state;
      if (action.choice === 'train') {
        const stat = STATS[Math.floor(action.statRoll * STATS.length)] ?? 'sta';
        return advanceStage({
          ...state,
          bonusStats: { ...state.bonusStats, [stat]: state.bonusStats[stat] + 8 },
        });
      }
      if (action.choice === 'massage') {
        return advanceStage({ ...state, massageBonus: 30 });
      }
      if (action.choice === 'shop') {
        return { ...state, pendingShop: true };   // 逛完店（SHOP_DONE）再开打
      }
      return state;
    }

    case 'SHOP_DONE':
      if (!state.pendingShop) return state;
      return advanceStage(state);

    default:
      return state;
  }
}
