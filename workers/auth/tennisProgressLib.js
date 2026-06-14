/**
 * tennisProgressLib.js — 网球永久进度校验（纯逻辑，spec §2.3）
 *
 * 服务端白名单防线：装备/绝技/成就 id 枚举内、金币增量封顶、
 * 通关数单调递增且单次步进 ≤1。绝技/成就为并集语义（只增不减）。
 * 注意：常量与前端 src/modules/tennis 是有意的双份拷贝（Workers 不 import 前端源码）。
 */

const SLOTS = ['racket', 'shoes', 'grip', 'wristband', 'charm'];
const RARITIES = ['common', 'fine', 'epic', 'legendary'];
const CHARM_SPECIALS = ['extraCard', 'counterBoost', 'windowBonus', 'restBonus', 'aceBoost'];
const ULTIMATE_NAMES = ['虎啸正手', '狐步幻影', '兔子急停', '霸王龙重扣', '平底锅神挡', '猫步上网', '天鹅之舞'];
const ACHIEVEMENT_IDS = [
  'firstWin', 'familyKing', 'allUltimates', 'sGrade',
  'perfectChampion', 'adventureClear', 'firstLegendary', 'aceMaster',
  'clutchMaster', 'boxOpener', 'goldRush', 'aviator',
  'consecAce', 'winStreak5', 'proTouch', 'allChars',
];
const CHAR_NAMES = ['诚', 'Elza', '菲比', 'Ross', '铁蛋', '丫', '莹'];
const COIN_GAIN_CAP = 500;
const CARD_IDS = [
  'deepBreath', 'crowdCheer', 'towelTime', 'newBalls', 'coachSign',
  'hawkeye', 'stringTune', 'mindMassage', 'energyGel', 'goldenMoment',
  'tacticalPause', 'adrenaline', 'secondWind', 'fullFocus',
];
const OWNED_CARDS_CAP = 10;

export const DEFAULT_PROGRESS = {
  coins: 0,
  equipment: {},
  unlockedMoves: [],
  achievements: [],
  ownedCards: [],
  championships: 0,
  adventureClears: 0,
  charWins: {},
};

function validOwnedCards(cards) {
  if (!Array.isArray(cards) || cards.length > OWNED_CARDS_CAP) return false;
  return cards.every((c) =>
    c && typeof c === 'object' && CARD_IDS.includes(c.cardId) && typeof c.upgraded === 'boolean');
}

function validEquipment(equipment) {
  if (typeof equipment !== 'object' || equipment === null || Array.isArray(equipment)) return false;
  for (const [slot, item] of Object.entries(equipment)) {
    if (!SLOTS.includes(slot)) return false;
    if (typeof item !== 'object' || item === null) return false;
    if (!RARITIES.includes(item.rarity)) return false;
    if (slot === 'charm' && item.special !== undefined && !CHARM_SPECIALS.includes(item.special)) return false;
  }
  return true;
}

const isSubset = (arr, whitelist) =>
  Array.isArray(arr) && arr.every((x) => whitelist.includes(x));

function monotonicStep(next, prev) {
  return Number.isInteger(next) && next >= prev && next - prev <= 1;
}

function validCharWins(next, prevCharWins) {
  if (next == null) return true;
  if (typeof next !== 'object' || Array.isArray(next)) return false;
  const prev = prevCharWins ?? {};
  for (const [k, v] of Object.entries(next)) {
    if (!CHAR_NAMES.includes(k)) return false;
    if (!Number.isInteger(v) || v < 0) return false;
    if (v - (prev[k] ?? 0) > 1) return false;
  }
  return true;
}

/**
 * @returns {{ok: true, progress} | {ok: false, error}}
 */
export function validateProgressUpdate(body, existing) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid body' };
  const prev = { ...DEFAULT_PROGRESS, ...existing };

  const coins = body.coins;
  if (!Number.isInteger(coins) || coins < 0) return { ok: false, error: 'Invalid coins' };
  if (coins - prev.coins > COIN_GAIN_CAP) return { ok: false, error: 'Coin gain exceeds cap' };

  if (!validEquipment(body.equipment ?? {})) return { ok: false, error: 'Invalid equipment' };
  if (!validOwnedCards(body.ownedCards ?? [])) return { ok: false, error: 'Invalid ownedCards' };
  if (!isSubset(body.unlockedMoves ?? [], ULTIMATE_NAMES)) return { ok: false, error: 'Invalid unlockedMoves' };
  if (!isSubset(body.achievements ?? [], ACHIEVEMENT_IDS)) return { ok: false, error: 'Invalid achievements' };
  if (!validCharWins(body.charWins ?? null, prev.charWins ?? {})) return { ok: false, error: 'Invalid charWins' };

  if (!monotonicStep(body.championships ?? prev.championships, prev.championships)) {
    return { ok: false, error: 'Invalid championships' };
  }
  if (!monotonicStep(body.adventureClears ?? prev.adventureClears, prev.adventureClears)) {
    return { ok: false, error: 'Invalid adventureClears' };
  }

  // 解锁集只增不减：与已有并集
  const unlockedMoves = [...new Set([...prev.unlockedMoves, ...(body.unlockedMoves ?? [])])];
  const achievements = [...new Set([...prev.achievements, ...(body.achievements ?? [])])];

  // charWins：每角色取最大值（单次 PUT 仅 +1，merge 取大防重放问题）
  const prevCW = prev.charWins ?? {};
  const bodyCW = body.charWins ?? {};
  const charWins = { ...prevCW };
  for (const [k, v] of Object.entries(bodyCW)) {
    charWins[k] = Math.max(prevCW[k] ?? 0, v);
  }

  return {
    ok: true,
    progress: {
      coins,
      equipment: body.equipment ?? {},
      unlockedMoves,
      achievements,
      ownedCards: body.ownedCards ?? prev.ownedCards ?? [],
      championships: body.championships ?? prev.championships,
      adventureClears: body.adventureClears ?? prev.adventureClears,
      charWins,
    },
  };
}
