/**
 * cards.js — 战术牌库（炉石/StS 式，spec §1.5）
 *
 * 牌实例：{ cardId, upgraded }。效果对象由 battleReducer 解释执行。
 * 战术点独立于体力：开局 1 点，每球 +1，上限 3。
 * 洗牌随机数经 rng 注入（() => [0,1)），保持纯函数可测。
 */

export const CARDS = {
  deepBreath: {
    id: 'deepBreath', name: '深呼吸', cost: 0, icon: '😮‍💨',
    effect: { type: 'energy', amount: 5 },
    upgradedEffect: { type: 'energy', amount: 10 },
    desc: (u) => `回复 ${u ? 10 : 5} 体力`,
  },
  crowdCheer: {
    id: 'crowdCheer', name: '观众助威', cost: 0, icon: '📣',
    effect: { type: 'windowBonus', amount: 0.3 },
    upgradedEffect: { type: 'windowBonus', amount: 0.5 },
    desc: (u) => `下个小游戏判定窗口 +${u ? 50 : 30}%`,
  },
  towelTime: {
    id: 'towelTime', name: '毛巾时间', cost: 1, icon: '🧻',
    effect: { type: 'energy', amount: 30 },
    upgradedEffect: { type: 'energy', amount: 50 },
    desc: (u) => `回复 ${u ? 50 : 30} 体力`,
  },
  newBalls: {
    id: 'newBalls', name: '换新球', cost: 1, icon: '🎾',
    effect: { type: 'powerMul', amount: 0.2 },
    upgradedEffect: { type: 'powerMul', amount: 0.35 },
    desc: (u) => `下一招威力 +${u ? 35 : 20}%`,
  },
  coachSign: {
    id: 'coachSign', name: '教练手势', cost: 1, icon: '🤙',
    effect: { type: 'reveal', windowBonus: 0 },
    upgradedEffect: { type: 'reveal', windowBonus: 0.15 },
    desc: (u) => `透视对手本球出招${u ? '，且判定窗口 +15%' : ''}`,
  },
  hawkeye: {
    id: 'hawkeye', name: '鹰眼挑战', cost: 2, icon: '🦅',
    effect: { type: 'hawkeye', charges: 1 },
    upgradedEffect: { type: 'hawkeye', charges: 2 },
    desc: (u) => `本球若失分则翻判重打（${u ? 2 : 1} 次）`,
  },
  stringTune: {
    id: 'stringTune', name: '拍线调整', cost: 2, icon: '🪛',
    effect: { type: 'counterNullify' },
    upgradedEffect: { type: 'counterInvert' },
    desc: (u) => (u ? '本球克制关系反转' : '本球克制关系无效'),
  },
  mindMassage: {
    id: 'mindMassage', name: '心理按摩', cost: 2, icon: '💆',
    effect: { type: 'counterShield', charges: 1 },
    upgradedEffect: { type: 'counterShield', charges: 2 },
    desc: (u) => `免疫 ${u ? 2 : 1} 次被克`,
  },
  energyGel: {
    id: 'energyGel', name: '能量胶', cost: 3, icon: '🧃',
    effect: { type: 'halfCost', rallies: 3 },
    upgradedEffect: { type: 'halfCost', rallies: 5 },
    desc: (u) => `${u ? 5 : 3} 球内出招耗体减半`,
  },
  goldenMoment: {
    id: 'goldenMoment', name: '金球时刻', cost: 3, icon: '✨',
    effect: { type: 'minigameFloor', floor: 1.0 },
    upgradedEffect: { type: 'minigameFloor', floor: 1.2 },
    desc: (u) => `本球小游戏倍率下限提至 ${u ? 1.2 : 1.0}`,
  },
  // ===== D2 用户反馈新增：抽卡/回点类（卡池丰富度）=====
  tacticalPause: {
    id: 'tacticalPause', name: '战术暂停', cost: 1, icon: '⏸️',
    effect: { type: 'draw', count: 2 },
    upgradedEffect: { type: 'draw', count: 3 },
    desc: (u) => `立刻抽 ${u ? 3 : 2} 张牌`,
  },
  adrenaline: {
    id: 'adrenaline', name: '肾上腺素', cost: 0, icon: '💉',
    effect: { type: 'tp', amount: 2 },
    upgradedEffect: { type: 'tp', amount: 3 },
    desc: (u) => `战术点 +${u ? 3 : 2}（上限 3）`,
  },
  secondWind: {
    id: 'secondWind', name: '第二口气', cost: 2, icon: '🌬️',
    effect: { type: 'energyDraw', energy: 20, count: 1 },
    upgradedEffect: { type: 'energyDraw', energy: 30, count: 1 },
    desc: (u) => `回 ${u ? 30 : 20} 体力并抽 1 张牌`,
  },
  fullFocus: {
    id: 'fullFocus', name: '全神贯注', cost: 1, icon: '🎯',
    effect: { type: 'focus', windowBonus: 0.5, powerMul: 0.1 },
    upgradedEffect: { type: 'focus', windowBonus: 0.75, powerMul: 0.15 },
    desc: (u) => `本球判定窗口 +${u ? 75 : 50}% 且威力 +${u ? 15 : 10}%`,
  },
};

export const TP_MAX = 3;
export const HAND_MAX = 5;

export function cardEffect(instance) {
  const def = CARDS[instance.cardId];
  return instance.upgraded ? def.upgradedEffect : def.effect;
}

function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** @param {Array<{cardId, upgraded}>} instances */
export function createDeckState(instances, rng) {
  return {
    drawPile: shuffle(instances, rng),
    hand: [],
    discard: [],
    tacticalPoints: 1,
  };
}

function drawOne(state, rng) {
  let { drawPile, hand, discard } = state;
  if (drawPile.length === 0) {
    if (discard.length === 0) return state;     // 真没牌了
    drawPile = shuffle(discard, rng);           // 弃牌堆洗回
    discard = [];
  }
  const [card, ...rest] = drawPile;
  if (hand.length >= HAND_MAX) {
    return { ...state, drawPile: rest, discard: [...discard, card] };  // 爆牌弃置
  }
  return { ...state, drawPile: rest, hand: [...hand, card], discard };
}

/** 每球开始：抽 1 + 战术点 +1（上限 3） */
export function startRally(state, rng) {
  const drawn = drawOne(state, rng);
  return { ...drawn, tacticalPoints: Math.min(TP_MAX, state.tacticalPoints + 1) };
}

/** 抽 n 张（战术暂停/第二口气卡用） */
export function drawCards(state, n, rng) {
  let s = state;
  for (let i = 0; i < n; i++) s = drawOne(s, rng);
  return s;
}

/** 打出手牌第 idx 张。返回 { deck, effect } 或 { error }。 */
export function playCard(state, idx) {
  const instance = state.hand[idx];
  if (!instance) return { error: 'no such card' };
  const cost = CARDS[instance.cardId].cost;
  if (cost > state.tacticalPoints) return { error: 'not enough tactical points' };
  const hand = state.hand.filter((_, i) => i !== idx);
  return {
    deck: {
      ...state,
      hand,
      discard: [...state.discard, instance],
      tacticalPoints: state.tacticalPoints - cost,
    },
    effect: cardEffect(instance),
    instance,
  };
}
