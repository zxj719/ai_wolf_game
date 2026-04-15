/**
 * BT 客户端
 *
 * 调用链（三级降级）：
 *   1. 远程 ECS BT Server（VITE_BT_API_URL 配置时）
 *      → 超时 500ms 或网络失败 → 降级
 *   2. 本地行为树（IS_HYBRID=true 时）
 *      → 未启用 hybrid → 降级
 *   3. null（由调用方降级到 LLM 管线）
 *
 * wolf-speech 专用接口返回完整发言结果（BT + LLM 润色在服务端一次完成），
 * 超时设为 15s（比普通 BT 决策长，因为包含 LLM 调用）。
 */

import { decide as localBTDecide, IS_HYBRID } from './decisionEngine/index.js';

const BT_URL = import.meta.env.VITE_BT_API_URL?.replace(/\/$/, ''); // 去掉尾部斜杠

/**
 * 向 BT Server 发 POST 请求，带超时控制
 * @returns {Promise<any|null>} 成功返回解析后的 JSON，失败/超时返回 null
 */
async function btPost(path, body, timeoutMs = 500) {
  if (!BT_URL) return null;
  try {
    const res = await fetch(`${BT_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null; // 超时、网络错误、解析失败 → 静默降级
  }
}

/**
 * 行为树决策（投票、夜间角色行动、猎人开枪）
 *
 * @param {Object} player      - 决策玩家
 * @param {string} actionType  - 'DAY_VOTE' | 'NIGHT_GUARD' | 'NIGHT_SEER' | 'NIGHT_WITCH' | 'HUNTER_SHOOT'
 * @param {Object} gameState   - 游戏状态快照（含 speechHistory）
 * @param {Object} params      - 额外参数（validTargets、cannotGuard 等）
 * @returns {Promise<Object|null>}
 */
export async function btDecide(player, actionType, gameState, params = {}) {
  // 1. 尝试远程 BT Server
  if (BT_URL) {
    const remote = await btPost('/bt/decide', { player, actionType, gameState, params });
    if (remote !== null) return remote;
  }
  // 2. 降级到本地 BT（hybrid 模式下）
  if (IS_HYBRID) {
    return localBTDecide(player, actionType, gameState, params) ?? null;
  }
  // 3. 完全没有 BT
  return null;
}

/**
 * 狼人发言两段式管线（BT 策略 + LLM 润色）
 * 全部在服务端完成，客户端只做一次 HTTP 调用。
 *
 * @param {Object} player     - 狼人玩家
 * @param {Object} gameState  - 含 speechHistory 的完整状态
 * @param {Object} llmParams  - { apiKey?, apiUrl?, model? } 用于润色的 LLM 参数
 * @returns {Promise<Object|null>} 完整发言结果（含 speech、voteIntention、thought）或 null
 */
export async function btWolfSpeech(player, gameState, llmParams = {}) {
  if (!BT_URL) return null; // 没有 BT Server 则直接回到 useAI.js 本地管线
  const result = await btPost(
    '/bt/wolf-speech',
    { player, gameState, ...llmParams },
    15000, // wolf-speech 包含 LLM 调用，给足时间
  );
  // 服务端返回了 502（LLM 失败）时 result 含 _strategyDecision，不是正常发言结果
  if (result && result.speech) return result;
  return null;
}
