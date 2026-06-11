/**
 * progressStore.js — 永久进度双写仓（spec §2.3）
 *
 * 登录用户：D1 为准 + localStorage 缓存，PUT 失败置 dirty 标记下次重试；
 * 游客：纯 localStorage。合并策略：解锁集并集、计数取大、金币取大、装备同槽保高。
 */

import { getToken } from '../../../utils/authToken';
import { getTennisProgress, putTennisProgress } from '../../../services/tennisService';
import { RARITIES } from './equipment';

const LOCAL_KEY = 'tennis_v2_progress';
const DIRTY_KEY = 'tennis_v2_progress_dirty';

export const EMPTY_PROGRESS = {
  coins: 0,
  equipment: {},
  unlockedMoves: [],
  achievements: [],
  championships: 0,
  adventureClears: 0,
};

const tier = (r) => RARITIES.indexOf(r);

export function mergeProgress(a, b) {
  if (!a && !b) return { ...EMPTY_PROGRESS };
  if (!a) return { ...EMPTY_PROGRESS, ...b };
  if (!b) return { ...EMPTY_PROGRESS, ...a };
  const equipment = { ...a.equipment };
  for (const [slot, item] of Object.entries(b.equipment ?? {})) {
    if (!equipment[slot] || tier(item.rarity) > tier(equipment[slot].rarity)) {
      equipment[slot] = item;
    }
  }
  return {
    coins: Math.max(a.coins ?? 0, b.coins ?? 0),
    equipment,
    unlockedMoves: [...new Set([...(a.unlockedMoves ?? []), ...(b.unlockedMoves ?? [])])],
    achievements: [...new Set([...(a.achievements ?? []), ...(b.achievements ?? [])])],
    championships: Math.max(a.championships ?? 0, b.championships ?? 0),
    adventureClears: Math.max(a.adventureClears ?? 0, b.adventureClears ?? 0),
  };
}

export function loadLocalProgress() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY)) ?? { ...EMPTY_PROGRESS };
  } catch {
    return { ...EMPTY_PROGRESS };
  }
}

function saveLocal(progress) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(progress));
  } catch { /* 隐私模式等场景静默 */ }
}

/** 进入模块时调用：登录则拉云端合并（并补传 dirty），游客读本地 */
export async function loadProgress() {
  const local = loadLocalProgress();
  if (!getToken()) return local;

  const remote = await getTennisProgress();
  const merged = mergeProgress(local, remote);
  saveLocal(merged);

  // 上次有未同步的变更，或合并后比云端多 → 补传
  let dirty = false;
  try { dirty = localStorage.getItem(DIRTY_KEY) === '1'; } catch { /* noop */ }
  if (dirty || JSON.stringify(merged) !== JSON.stringify(remote ?? EMPTY_PROGRESS)) {
    await persistProgress(merged);
  }
  return merged;
}

/** 变更后调用：本地必写，登录则同步云端（失败置 dirty） */
export async function persistProgress(progress) {
  saveLocal(progress);
  if (!getToken()) return { synced: false };
  const res = await putTennisProgress(progress);
  try {
    localStorage.setItem(DIRTY_KEY, res?.success ? '0' : '1');
  } catch { /* noop */ }
  return { synced: !!res?.success };
}
