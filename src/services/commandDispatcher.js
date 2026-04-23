/**
 * commandDispatcher.js — 中央命令分发器（柱二）
 *
 * 所有 AI / 用户 决策在进入 reducer 之前，必须经过此分发器的闸门：
 *   闸1 幂等队列（actionQueue）   —— 拒绝重复 key
 *   闸2 快照新鲜度               —— 拒绝基于过期 snapshot 的命令
 *   闸3 逻辑合法性（validateDecision） —— 拒绝违反规则的命令
 *   闸4 动作者仍存活              —— 拒绝死人还想行动的命令
 *
 * 只有全部闸门通过，才会调用 `commit()` 把命令发到 reducer。
 * reducer 本身的幂等（柱一）是最后一道防线，本层是最前一道。
 *
 * ┌──────────┐    ┌─────────────────┐    ┌─────────┐
 * │ AI/user  │───▶│ commandDispatcher│───▶│ reducer │
 * └──────────┘    └─────────────────┘    └─────────┘
 *     产生意图      验证/去重/新鲜度检查      最终落盘
 */
import { actionQueue } from './actionQueue';
import { isSnapshotFresh, getCurrentVersion } from './snapshotBuilder';
import { validateDecision } from './logicValidator';
import { logger } from '../utils/logger';

/**
 * @typedef {Object} CommandResult
 * @property {boolean} accepted        是否通过所有闸门
 * @property {string}  [rejectedBy]    被拒原因分类：'duplicate'|'stale'|'invalid'|'dead-actor'
 * @property {string}  [reason]        详细文本（供日志/UI 展示）
 */

/**
 * 分发一条命令
 *
 * @param {Object}   params
 * @param {string}   params.actionType    如 'NIGHT_SEER' / 'DAY_VOTE' / 'HUNTER_SHOOT'
 * @param {Object}   params.snapshot      构建时的不可变快照（含 version）
 * @param {Object}   params.decision      决策负载（targetId / speech / ...）
 * @param {number}   params.actorId       执行者玩家 ID
 * @param {string}   params.key           幂等 key（buildActionKey 构造）
 * @param {Function} params.commit        通过验证后调用的 reducer dispatch 函数
 * @param {boolean}  [params.skipFreshness]  某些流程（如投票/发言）不关心 version，可跳过闸2
 * @returns {CommandResult}
 */
export function dispatchCommand({
  actionType,
  snapshot,
  decision,
  actorId,
  key,
  commit,
  skipFreshness = false,
}) {
  // ── 闸1：幂等 ──
  if (key && actionQueue.isDuplicate(key)) {
    logger.warn(`[dispatcher] ${actionType} 重复命令被拦截: ${key}`);
    return { accepted: false, rejectedBy: 'duplicate', reason: `duplicate key: ${key}` };
  }

  // ── 闸2：快照新鲜度 ──
  // 某些顺序动作（发言、投票、猎人开枪）在 FSM 中本就串行，不需要版本闸
  if (!skipFreshness && !isSnapshotFresh(snapshot, getCurrentVersion())) {
    logger.warn(`[dispatcher] ${actionType} 快照过期（snapshot v${snapshot.version}, current v${getCurrentVersion()}）`);
    return { accepted: false, rejectedBy: 'stale', reason: `snapshot v${snapshot.version} < current v${getCurrentVersion()}` };
  }

  // ── 闸3：规则合法性 ──
  const validation = validateDecision(actionType, snapshot, {
    ...decision,
    shooterId: decision.shooterId ?? actorId,
  });
  if (!validation.valid) {
    logger.warn(`[dispatcher] ${actionType} 验证失败: ${validation.reason}`);
    return { accepted: false, rejectedBy: 'invalid', reason: validation.reason };
  }

  // ── 闸4：动作者仍存活 ──
  // 注意：对于猎人开枪，射手可能"刚死"但 canHunterShoot=true，snapshot 里 isAlive 应仍为 true（夜间死亡由 killPlayer 在 shot 之后才写入）
  if (actorId != null) {
    const actor = snapshot.players.find(p => p.id === actorId);
    if (!actor) {
      return { accepted: false, rejectedBy: 'dead-actor', reason: `actor ${actorId} not found` };
    }
    // 猎人开枪例外：canHunterShoot 可能在 snapshot 里为 true 即使 isAlive 为 false（刚被刀/被毒）
    const isHunterShoot = actionType === 'HUNTER_SHOOT';
    if (!actor.isAlive && !(isHunterShoot && actor.canHunterShoot)) {
      logger.warn(`[dispatcher] ${actionType} 被拒：actor ${actorId} 已死亡`);
      return { accepted: false, rejectedBy: 'dead-actor', reason: `actor ${actorId} dead` };
    }
  }

  // 全部闸门通过，标记 key 并提交
  if (key) actionQueue.mark(key);
  try {
    commit();
    if (key) actionQueue.complete(key, { ok: true });
    return { accepted: true };
  } catch (err) {
    if (key) actionQueue.fail(key);
    logger.error(`[dispatcher] ${actionType} commit 异常:`, err);
    throw err;
  }
}
