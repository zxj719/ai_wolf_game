/**
 * gameInvariants.js — 柱四：全局不变量
 *
 * 解决问题：
 *   1. AI 在身份推理表里把"超过剩余狼数"的玩家同时列为"疑似狼"，
 *      产生逻辑不自洽的推理（例如残局剩1狼，却怀疑3个人是狼）
 *   2. 残局（剩余狼 ≤ 1）时 AI 仍按"多狼合谋"模型思考，发言空转
 *
 * 设计思路：
 *   - 纯函数，从 selectors 读派生数据
 *   - 注入点一：buildPublicFacts（给 AI 看的权威事实里声明不变量）
 *   - 注入点二：identityTableSanitizer（对 AI 输出的表做 cap 裁剪）
 */
import {
  selectAliveWolvesCount,
  selectAliveGoodsCount,
  selectIsEndgame,
  selectRemainingWolvesCap,
  selectIsWolfMajority,
} from '../selectors/gameSelectors.js';

/**
 * 返回当前局势的全局不变量快照
 * @param {object} state  游戏状态（players, deathHistory 等齐全）
 * @returns {{
 *   wolfCap: number,
 *   aliveGoods: number,
 *   endgameMode: boolean,
 *   wolfMajority: boolean,
 * }}
 */
export function computeInvariants(state) {
  return {
    wolfCap: selectRemainingWolvesCap(state),
    aliveGoods: selectAliveGoodsCount(state),
    endgameMode: selectIsEndgame(state),
    wolfMajority: selectIsWolfMajority(state),
  };
}

/**
 * 渲染不变量块，拼接进 buildPublicFacts
 * 空返回意味着无需额外提示（例如狼/好比例正常且非残局）
 */
export function renderInvariantFacts(state) {
  const inv = computeInvariants(state);
  const lines = [];

  lines.push(`【剩余狼人上限】最多还有${inv.wolfCap}只狼存活。任何推理、怀疑或身份表中标记"疑似狼"的玩家总数不得超过${inv.wolfCap}。`);

  if (inv.endgameMode) {
    lines.push(`【残局模式】剩余狼人数 ≤ 1。进入残局：`);
    lines.push(`  - 好人阵营：必须当天找出那只狼并投出；不能"观望"或"等跳"。`);
    lines.push(`  - 狼人阵营：独狼自刀/冲锋刀已无意义；优先伪装好神并带票错杀关键好人。`);
    lines.push(`  - 所有人：票型需要极端谨慎，错一票即可能翻盘失败。`);
  }

  if (inv.wolfMajority) {
    lines.push(`【警告】狼人数已 ≥ 好人数。屠边/屠城条件即将触发或已触发，狼队无需再隐藏。`);
  }

  return lines.length > 0 ? lines.join('\n') : '';
}

/**
 * 裁剪 identity_table：把"疑似狼"的条目按 confidence 降序保留前 wolfCap 条，
 * 其余降为 UNKNOWN_ROLE。避免 AI 输出"4个人全是狼"这类逻辑不可能的表。
 *
 * @param {object} identityTable  { "1": { suspect, confidence }, ... }
 * @param {number} wolfCap        当前存活狼上限
 * @returns {{ identityTable: object, changed: boolean }}
 */
export function enforceWolfCapOnTable(identityTable, wolfCap, { candidateIds = null } = {}) {
  if (!identityTable || typeof identityTable !== 'object') {
    return { identityTable, changed: false };
  }
  if (typeof wolfCap !== 'number' || wolfCap < 0) {
    return { identityTable, changed: false };
  }

  const candidateSet = candidateIds ? new Set([...candidateIds].map(String)) : null;

  // 只裁剪仍存活、未确认的候选项；已死亡/已翻牌/狼队友等历史事实不能被改成“未知”。
  const wolfEntries = [];
  Object.entries(identityTable).forEach(([id, value]) => {
    if (candidateSet && !candidateSet.has(String(id))) return;
    const suspect = value?.suspect;
    if (typeof suspect === 'string' && suspect.includes('狼人')) {
      wolfEntries.push({ id, confidence: typeof value.confidence === 'number' ? value.confidence : 0 });
    }
  });

  if (wolfEntries.length <= wolfCap) {
    return { identityTable, changed: false };
  }

  // 按 confidence 降序，保留前 wolfCap 条，其余降为 UNKNOWN_ROLE('未知')
  wolfEntries.sort((a, b) => b.confidence - a.confidence);
  const keepIds = new Set(wolfEntries.slice(0, wolfCap).map(e => e.id));

  const sanitized = {};
  let changed = false;
  Object.entries(identityTable).forEach(([id, value]) => {
    const suspect = value?.suspect;
    if (
      typeof suspect === 'string'
      && suspect.includes('狼人')
      && (!candidateSet || candidateSet.has(String(id)))
      && !keepIds.has(id)
    ) {
      sanitized[id] = { ...value, suspect: '未知' };
      changed = true;
    } else {
      sanitized[id] = value;
    }
  });

  return { identityTable: sanitized, changed };
}
