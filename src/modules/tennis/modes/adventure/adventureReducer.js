/**
 * adventureReducer.js — 奇幻闯关 run 状态机（纯函数，spec §4）
 *
 * 单局层（本次闯关有效）：runStats 加点 / tempEnergyMax / carryEnergy / 牌库（由 Screen 持有）。
 * 永久层（装备/金币/图鉴）由 Screen 实时入 progress，失败也保留。
 * 战斗失败 → failed；BOSS 胜利 → victory（adventure_clears+1 由 Screen 结算）。
 */

import { generateMap } from './mapGen';

const STATS = ['sta', 'skill', 'mind'];
const REST_AFTER_BATTLE = 35;
const BASE_ENERGY = 100;

export function createAdventure({ rng }) {
  return {
    map: generateMap(rng),
    chapterIdx: 0,
    stepIdx: 0,
    phase: 'pick',        // pick | node | victory | failed
    currentNode: null,
    runStats: { sta: 0, skill: 0, mind: 0 },
    tempEnergyMax: 0,
    carryEnergy: BASE_ENERGY,
    coinsEarned: 0,
    drops: [],
    cardsGained: 0,
    log: [],
    lastMatchStats: null, // { countersWon, counterLost, ... } from most recent battle
  };
}

const energyCap = (s) => BASE_ENERGY + s.tempEnergyMax;

function advance(state, patch = {}) {
  const chapter = state.map.chapters[state.chapterIdx];
  let { chapterIdx, stepIdx } = state;
  stepIdx += 1;
  if (stepIdx >= chapter.steps.length) {
    chapterIdx += 1;
    stepIdx = 0;
  }
  if (chapterIdx >= state.map.chapters.length) {
    return { ...state, ...patch, phase: 'victory', currentNode: null };
  }
  return { ...state, ...patch, chapterIdx, stepIdx, phase: 'pick', currentNode: null };
}

export function adventureReducer(state, action) {
  switch (action.type) {
    case 'CHOOSE_NODE': {
      if (state.phase !== 'pick') return state;
      const step = state.map.chapters[state.chapterIdx].steps[state.stepIdx];
      const node = step[action.optionIdx] ?? step[0];
      return { ...state, currentNode: node, phase: 'node' };
    }

    case 'BATTLE_RESULT': {
      if (state.phase !== 'node') return state;
      const loot = {
        coinsEarned: state.coinsEarned + (action.coins ?? 0),
        drops: action.drop ? [...state.drops, action.drop] : state.drops,
        lastMatchStats: action.matchStats ?? null,
      };
      if (!action.win) {
        return { ...state, ...loot, phase: 'failed' };
      }
      if (state.currentNode?.boss) {
        return { ...state, ...loot, phase: 'victory', currentNode: null };
      }
      return advance(state, {
        ...loot,
        carryEnergy: Math.min(energyCap(state), (action.remainingEnergy ?? 0) + REST_AFTER_BATTLE),
      });
    }

    case 'EVENT_DONE': {
      if (state.phase !== 'node') return state;
      const r = action.reward ?? { kind: 'nothing' };
      const patch = {};
      if (r.kind === 'stat') {
        const stat = r.stat === 'random'
          ? STATS[Math.floor((action.statRoll ?? 0) * STATS.length)]
          : r.stat;
        patch.runStats = { ...state.runStats, [stat]: state.runStats[stat] + r.amount };
      }
      if (r.kind === 'energyMax') {
        patch.tempEnergyMax = state.tempEnergyMax + r.amount;
      }
      if (r.kind === 'heal') {
        patch.carryEnergy = Math.min(energyCap(state), state.carryEnergy + r.amount);
      }
      if (r.kind === 'coins') {
        patch.coinsEarned = state.coinsEarned + r.amount;
      }
      if (r.kind === 'card') {
        patch.cardsGained = state.cardsGained + 1;
      }
      if (r.healDelta) {
        patch.carryEnergy = Math.max(0, Math.min(energyCap(state),
          (patch.carryEnergy ?? state.carryEnergy) + r.healDelta));
      }
      return advance(state, patch);
    }

    case 'REST': {
      if (state.phase !== 'node') return state;
      return advance(state, {
        carryEnergy: Math.min(energyCap(state), state.carryEnergy + 50),
      });
    }

    case 'SHOP_DONE': {
      if (state.phase !== 'node') return state;
      return advance(state);
    }

    default:
      return state;
  }
}
