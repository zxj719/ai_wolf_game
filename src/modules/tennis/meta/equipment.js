/**
 * equipment.js — 装备系统纯数据与逻辑（spec §2.1）
 *
 * 5 槽 × 4 品质；同槽位自动保留更高品质（无背包管理），低/同品质掉落自动折现金币。
 * 这是手残玩家的长线成长通道：输赢都掉落，金币可在商店升品质。
 */

export const EQUIPMENT_SLOTS = ['racket', 'shoes', 'grip', 'wristband', 'charm'];
export const RARITIES = ['common', 'fine', 'epic', 'legendary'];

export const SLOT_META = {
  racket:    { name: '球拍',   icon: '🎾', stat: 'sta' },
  shoes:     { name: '球鞋',   icon: '👟', stat: 'energyMax' },
  grip:      { name: '手胶',   icon: '✋', stat: 'skill' },
  wristband: { name: '护腕',   icon: '💪', stat: 'mind' },
  charm:     { name: '幸运挂件', icon: '🍀', stat: 'special' },
};

export const RARITY_META = {
  common:    { name: '普通', color: '#9aa79f' },
  fine:      { name: '精良', color: '#4f9ee2' },
  epic:      { name: '史诗', color: '#b067e2' },
  legendary: { name: '传说', color: '#e2a14f' },
};

/** 各槽位按品质的数值（charm 走特效不走数值） */
export const SLOT_VALUES = {
  racket:    [2, 4, 7, 12],
  shoes:     [6, 12, 20, 30],
  grip:      [2, 4, 7, 12],
  wristband: [2, 4, 7, 12],
  charm:     [0, 0, 0, 0],
};

/** 挂件特效池（数值随品质放大由 applyEquipment 处理：基础值 × (1 + 品质档/4)） */
export const CHARM_SPECIALS = [
  { key: 'extraCard',    name: '开局多抽 1 张战术卡', base: 1 },
  { key: 'counterBoost', name: '克制倍率 +0.1',       base: 0.1 },
  { key: 'windowBonus',  name: '小游戏窗口 +15%',     base: 0.15 },
  { key: 'restBonus',    name: '局间回体 +5',          base: 5 },
  { key: 'aceBoost',     name: 'ACE 后下球威力 +25%',  base: 0.25 },
];

const UPGRADE_COST = { common: 50, fine: 120, epic: 300, legendary: null };
const SELL_VALUE = { common: 10, fine: 25, epic: 60, legendary: 150 };

export const upgradeCost = (rarity) => UPGRADE_COST[rarity];
export const sellValue = (rarity) => SELL_VALUE[rarity];
export const nextRarity = (rarity) => {
  const i = RARITIES.indexOf(rarity);
  return i >= 0 && i < RARITIES.length - 1 ? RARITIES[i + 1] : null;
};

/** 掉落品质概率（累计区间），胜=高一档概率，败=保底 */
const DROP_TABLES = {
  win:   [['common', 0.35], ['fine', 0.75], ['epic', 0.95], ['legendary', 1.0]],
  loss:  [['common', 0.60], ['fine', 0.90], ['epic', 0.99], ['legendary', 1.0]],
  event: [['common', 0.30], ['fine', 0.70], ['epic', 0.93], ['legendary', 1.0]],
};

/**
 * 掷一件掉落。rng() ∈ [0,1)，依次用于：槽位 → 品质 → 挂件特效。
 */
export function rollDrop(source, rng) {
  const slot = EQUIPMENT_SLOTS[Math.floor(rng() * EQUIPMENT_SLOTS.length)];
  const table = DROP_TABLES[source] ?? DROP_TABLES.event;
  const roll = rng();
  const rarity = table.find(([, p]) => roll < p)[0];
  const drop = { slot, rarity };
  if (slot === 'charm') {
    drop.special = CHARM_SPECIALS[Math.floor(rng() * CHARM_SPECIALS.length)].key;
  }
  return drop;
}

/**
 * 合成全身装备加成。
 * @param {Object} equipped {slot: {rarity, special?}}
 * @returns {{sta, skill, mind, energyMax, special: Object}}
 */
export function applyEquipment(equipped) {
  const out = { sta: 0, skill: 0, mind: 0, energyMax: 0, special: {} };
  for (const slot of EQUIPMENT_SLOTS) {
    const item = equipped?.[slot];
    if (!item) continue;
    const tier = RARITIES.indexOf(item.rarity);
    if (tier < 0) continue;
    if (slot === 'charm') {
      const def = CHARM_SPECIALS.find((s) => s.key === item.special);
      if (def) out.special[def.key] = def.base;   // 特效不随品质缩放（YAGNI，品质决定掉率即可）
    } else {
      const stat = SLOT_META[slot].stat;
      out[stat] += SLOT_VALUES[slot][tier];
    }
  }
  return out;
}

/**
 * 同槽位保高品质：新掉落更高 → 换上并折现旧件；否则折现新件。
 * @returns {{equipped, soldFor}}
 */
export function mergeDrop(equipped, drop) {
  const current = equipped?.[drop.slot];
  const next = { ...equipped };
  if (!current) {
    next[drop.slot] = { rarity: drop.rarity, ...(drop.special ? { special: drop.special } : {}) };
    return { equipped: next, soldFor: 0 };
  }
  const curTier = RARITIES.indexOf(current.rarity);
  const newTier = RARITIES.indexOf(drop.rarity);
  if (newTier > curTier) {
    next[drop.slot] = { rarity: drop.rarity, ...(drop.special ? { special: drop.special } : {}) };
    return { equipped: next, soldFor: sellValue(current.rarity) };
  }
  return { equipped: next, soldFor: sellValue(drop.rarity) };
}
