/**
 * @wolfgame/decision-engine — 公共入口
 *
 * 零依赖纯 JS 行为树决策引擎，可在浏览器、Node.js 和 Cloudflare Workers 中运行。
 *
 * 快速使用：
 *   import { decide, isBTHandled } from '@/services/decisionEngine';
 *   const result = decide(player, 'DAY_VOTE', gameState, params);
 *   // result === { targetId, reasoning } 或 { useSave, usePoison, reasoning } 或 null
 *
 * ECS / Node.js 使用：
 *   import { decide } from '@wolfgame/decision-engine';
 *   // 无需 Vite/React 环境，直接传入 gameState 对象即可
 *
 * VITE_AI_MODE / process.env.AI_MODE:
 *   - 'legacy' (默认): 完全走旧 LLM 管线，decide() 永远返回 null
 *   - 'hybrid': 支持的 (role, actionType) 组合走 BT，其他走 LLM
 */

export const VERSION = '1.0.0';

import { BehaviorTree } from './core/BehaviorTree.js';
import { buildBlackboard } from './blackboard/buildBlackboard.js';
import { villagerVoteTree } from './trees/villager/vote.js';
import { guardProtectTree } from './trees/guard/protect.js';
import { seerCheckTree } from './trees/seer/check.js';
import { witchPotionTree } from './trees/witch/potion.js';
import { werewolfVoteTree } from './trees/werewolf/vote.js';
import { werewolfSpeechTree } from './trees/werewolf/speech.js';
import { hunterShootTree } from './trees/hunter/shoot.js';

// ────────────────────────────────────────────────
// Feature flag
// ────────────────────────────────────────────────

// 兼容 Vite (import.meta.env) 和 Node.js (process.env) 两种运行环境
const _envMode =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AI_MODE) ||
  (typeof process !== 'undefined' && process.env?.AI_MODE) ||
  'legacy';
export const AI_MODE = _envMode.toLowerCase();
export const IS_HYBRID = AI_MODE === 'hybrid';

// ────────────────────────────────────────────────
// 行为树路由表
// Key 格式： `${role}::${actionType}`
// ────────────────────────────────────────────────

const TREE_REGISTRY = {
  // 白天投票
  '村民::DAY_VOTE':  villagerVoteTree,
  '狼人::DAY_VOTE':  werewolfVoteTree,
  // 夜间神职
  '守卫::NIGHT_GUARD': guardProtectTree,
  '预言家::NIGHT_SEER': seerCheckTree,
  '女巫::NIGHT_WITCH': witchPotionTree,
  // 猎人开枪（白天/夜间触发均可）
  '猎人::HUNTER_SHOOT': hunterShootTree,
};

/**
 * 查询是否有针对该 (role, actionType) 的 BT
 */
export function isBTHandled(player, actionType) {
  if (!IS_HYBRID) return false;
  return TREE_REGISTRY[`${player.role}::${actionType}`] != null;
}

/**
 * 执行决策。无对应 BT 或未启用 hybrid → 返回 null
 *
 * @param {Object} player      - 当前决策玩家
 * @param {string} actionType  - 如 'DAY_VOTE', 'NIGHT_SEER'
 * @param {Object} gameState   - 游戏状态快照
 * @param {Object} params      - 额外参数（如 validTargets）
 * @returns {{targetId:number, reasoning:string, path:string[]}|null}
 */
export function decide(player, actionType, gameState, params = {}) {
  if (!IS_HYBRID) return null;
  const tree = TREE_REGISTRY[`${player.role}::${actionType}`];
  if (!tree) return null;

  const bb = buildBlackboard(gameState, player, params);
  const decision = new BehaviorTree(tree).run(bb);

  if (decision) {
    const target = decision.targetId ?? decision.strategy ?? '(complex)';
    console.log(
      `%c[决策树] ${player.id}号 ${player.role} → ${target} (${decision.reasoning})`,
      'color: #10b981; font-weight: bold;'
    );
    console.log('%c  路径:', 'color: #6b7280;', bb.trace);
  }

  return decision;
}

/**
 * 狼人发言策略决策（专用入口）
 * 返回 { strategy, suspectTarget, voteTarget, facts[] } 或 null
 *
 * @param {Object} player      - 狼人玩家
 * @param {Object} gameState   - 含 speechHistory 的完整状态
 * @returns {Object|null}
 */
export function decideSpeechStrategy(player, gameState) {
  if (!IS_HYBRID || player.role !== '狼人') return null;
  const bb = buildBlackboard(gameState, player, {});
  const decision = new BehaviorTree(werewolfSpeechTree).run(bb);
  if (decision) {
    console.log(
      `%c[决策树] ${player.id}号狼人发言策略 → ${decision.strategy}`,
      'color: #f59e0b; font-weight: bold;'
    );
    console.log('%c  事实:', 'color: #6b7280;', decision.facts);
  }
  return decision;
}
