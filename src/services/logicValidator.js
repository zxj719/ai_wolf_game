/**
 * logicValidator.js — 决策合法性验证层
 *
 * 在 commitDecision 前调用，检查 AI 返回的决策是否符合游戏规则。
 * 所有检查基于 snapshot（不可变快照），保证一致性。
 *
 * 返回值统一格式：
 *   { valid: true }
 *   { valid: false, reason: '描述', detail?: '...额外信息' }
 */

// ── 工具 ─────────────────────────────────────────────────────

function isAlive(snapshot, playerId) {
  return snapshot.aliveIds.includes(playerId);
}

function isWolf(snapshot, playerId) {
  return snapshot.wolves.some(w => w.id === playerId);
}

// ── 各角色验证器 ──────────────────────────────────────────────

/**
 * 守卫：目标必须存活，且不能连续两晚守同一人
 */
export function validateGuard(snapshot, decision) {
  const { targetId } = decision;
  if (targetId == null) return { valid: false, reason: '守卫未指定守护目标' };
  if (!isAlive(snapshot, targetId)) {
    return { valid: false, reason: `守卫目标 ${targetId} 已死亡` };
  }
  if (snapshot.lastGuardTarget === targetId) {
    return { valid: false, reason: '守卫不能连续两晚守同一目标', detail: `上晚已守: ${targetId}` };
  }
  return { valid: true };
}

/**
 * 预言家：目标必须存活，且同一晚不能重复查验
 */
export function validateSeer(snapshot, decision) {
  const { targetId } = decision;
  if (targetId == null) return { valid: false, reason: '预言家未指定查验目标' };
  if (!isAlive(snapshot, targetId)) {
    return { valid: false, reason: `查验目标 ${targetId} 已死亡` };
  }
  // 当前快照里是否已查过（快照已冻结，seerChecks 来自 snapshot 构建时刻）
  const alreadyChecked = (snapshot.seerChecks ?? []).some(
    c => c.night === snapshot.dayCount && c.targetId === targetId
  );
  if (alreadyChecked) {
    return { valid: false, reason: `预言家本晚已查验 ${targetId}，禁止重复查验` };
  }
  return { valid: true };
}

/**
 * 女巫解药：目标必须是本晚狼人刀的对象且仍未出局，且解药未用过
 */
export function validateWitchSave(snapshot, decision) {
  const { targetId } = decision;
  if (targetId == null) return { valid: false, reason: '女巫救人未指定目标' };

  if (snapshot.witchAntidoteUsed) {
    return { valid: false, reason: '女巫解药已用过，不可重复使用' };
  }

  const killedTonight = snapshot.nightDecisions?.wolfKill;
  if (killedTonight == null) {
    return { valid: false, reason: '本晚无人被刀，无需使用解药' };
  }
  if (targetId !== killedTonight) {
    return {
      valid: false,
      reason: `解药目标 ${targetId} 与被刀目标 ${killedTonight} 不符`,
    };
  }
  return { valid: true };
}

/**
 * 女巫毒药：目标必须存活，且毒药未用过，且不能毒本晚被刀的人（同救同毒禁止）
 */
export function validateWitchPoison(snapshot, decision) {
  const { targetId } = decision;
  if (targetId == null) return { valid: false, reason: '女巫毒人未指定目标' };

  if (snapshot.witchPoisonUsed) {
    return { valid: false, reason: '女巫毒药已用过，不可重复使用' };
  }
  if (!isAlive(snapshot, targetId)) {
    return { valid: false, reason: `毒药目标 ${targetId} 已死亡` };
  }
  const killedTonight = snapshot.nightDecisions?.wolfKill;
  if (killedTonight != null && targetId === killedTonight) {
    return { valid: false, reason: '不允许对同晚被刀者使用毒药（同救同毒规则）' };
  }
  return { valid: true };
}

/**
 * 狼人击杀：目标必须存活且不是狼队友
 */
export function validateWolfKill(snapshot, decision) {
  const { targetId } = decision;
  if (targetId == null) return { valid: false, reason: '狼人未指定击杀目标' };
  if (!isAlive(snapshot, targetId)) {
    return { valid: false, reason: `击杀目标 ${targetId} 已死亡` };
  }
  if (isWolf(snapshot, targetId)) {
    return { valid: false, reason: `击杀目标 ${targetId} 是狼队友，禁止自刀（除非策略明确允许）` };
  }
  return { valid: true };
}

/**
 * 投票放逐：目标必须存活
 */
export function validateVote(snapshot, decision) {
  const { targetId } = decision;
  if (targetId == null) return { valid: false, reason: '投票未指定目标' };
  if (!isAlive(snapshot, targetId)) {
    return { valid: false, reason: `投票目标 ${targetId} 已死亡` };
  }
  return { valid: true };
}

/**
 * 猎人开枪：目标必须存活，且不能射自己
 */
export function validateHunterShoot(snapshot, decision) {
  const { targetId, shooterId } = decision;
  if (targetId == null) return { valid: false, reason: '猎人未指定开枪目标' };
  if (!isAlive(snapshot, targetId)) {
    return { valid: false, reason: `开枪目标 ${targetId} 已死亡` };
  }
  if (shooterId != null && targetId === shooterId) {
    return { valid: false, reason: '猎人不能射自己' };
  }
  return { valid: true };
}

/**
 * AI 发言：speech 字段必须存在且非空
 */
export function validateSpeech(snapshot, decision) {
  const { speech } = decision;
  if (!speech || typeof speech !== 'string' || speech.trim().length === 0) {
    return { valid: false, reason: '发言内容为空或格式错误' };
  }
  if (speech.trim().length > 500) {
    return {
      valid: false,
      reason: '发言内容超过 500 字限制',
      detail: `实际长度: ${speech.trim().length}`,
    };
  }
  return { valid: true };
}

// ── 中央分发器 ────────────────────────────────────────────────

/**
 * 根据 actionType 选择对应验证器
 *
 * @param {string}   actionType  动作类型
 * @param {Snapshot} snapshot    buildSnapshot() 的返回值
 * @param {object}   decision    AI 返回的决策对象
 * @returns {{ valid: boolean, reason?: string, detail?: string }}
 */
export function validateDecision(actionType, snapshot, decision) {
  switch (actionType) {
    case 'NIGHT_GUARD':        return validateGuard(snapshot, decision);
    case 'NIGHT_SEER':         return validateSeer(snapshot, decision);
    case 'NIGHT_WITCH_SAVE':   return validateWitchSave(snapshot, decision);
    case 'NIGHT_WITCH_POISON': return validateWitchPoison(snapshot, decision);
    case 'NIGHT_WOLF':         return validateWolfKill(snapshot, decision);
    case 'DAY_VOTE':           return validateVote(snapshot, decision);
    case 'HUNTER_SHOOT':       return validateHunterShoot(snapshot, decision);
    case 'DAY_SPEECH':         return validateSpeech(snapshot, decision);
    default:
      console.warn(`[logicValidator] 未知 actionType: ${actionType}，跳过验证`);
      return { valid: true };
  }
}

// ── 旧版 API 兼容层（供 useAI.js 使用）────────────────────────
// useAI.js 中的验证是对 LLM 原始输出的结构/语义检查（不同于游戏规则验证）
// 这里提供同名 shim，让 build 不再报错，同时保留旧逻辑语义

/**
 * 验证夜间行动结果（LLM 输出结构检查）
 * @param {object} result        LLM 解析后的结果
 * @param {string} actionType    PROMPT_ACTIONS 常量
 * @param {object} ctx           { players, seerChecks, ... }
 * @returns {{ isValid: boolean, violations: string[], suggestions: string[] }}
 */
export function validateNightAction(result, actionType, ctx = {}) {
  const violations = [];
  const suggestions = [];

  if (!result) {
    violations.push('AI 返回空结果');
    suggestions.push('检查 API 连通性');
    return { isValid: false, violations, suggestions };
  }

  const alivePlayers = (ctx.players ?? []).filter(p => p.isAlive);
  const aliveIds = alivePlayers.map(p => p.id);

  // targetId 通用检查
  if (result.targetId !== undefined && result.targetId !== null) {
    if (!aliveIds.includes(result.targetId)) {
      violations.push(`目标玩家 ${result.targetId} 不在存活列表中`);
      suggestions.push(`存活玩家：${aliveIds.join(', ')}`);
    }
  }

  // 女巫专项
  if (actionType === 'NIGHT_WITCH' || actionType === 'witch') {
    if (result.useSave && !ctx.canSave) {
      violations.push('女巫解药已用过，不能再次使用');
      suggestions.push('设置 useSave: false');
    }
    if (result.usePoison !== null && result.usePoison !== undefined) {
      if (!ctx.hasPoison) {
        violations.push('女巫毒药已用过，不能再次使用');
        suggestions.push('设置 usePoison: null');
      }
    }
  }

  return { isValid: violations.length === 0, violations, suggestions };
}

/**
 * 生成修正提示词（供 useAI.js 重试时使用）
 * @param {string[]} violations
 * @param {string[]} suggestions
 * @returns {string}
 */
export function generateCorrectionPrompt(violations, suggestions) {
  const parts = ['【逻辑修正】请严格遵守以下要求重新回答：'];
  violations.forEach((v, i) => parts.push(`${i + 1}. 错误：${v}`));
  if (suggestions.length) {
    parts.push('建议修正：');
    suggestions.forEach(s => parts.push(`  - ${s}`));
  }
  parts.push('请重新输出符合格式要求的 JSON。');
  return parts.join('\n');
}
