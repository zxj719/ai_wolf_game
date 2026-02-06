/**
 * 渐进式披露提示词工厂
 *
 * 核心理念：
 * 1. 只提供与当前游戏配置相关的提示
 * 2. 不存在的角色不会被提及
 * 3. 根据局数配置（6人/8人/12人）调整规则
 */

import {
  ROLE_MODULES,
  getRoleModule,
  detectExistingRoles,
  buildConditionalRules,
  buildVictoryPrompt,
  TERMINOLOGY,
  IDENTITY_TABLE_PROMPT,
  ADVERSARIAL_REFLECTION,
  isMiniGame,
  isLargeGame
} from './rolePrompts';

/**
 * 构建渐进式人格提示词
 * 根据游戏配置动态调整角色人格内容
 *
 * @param {Object} player - 玩家对象
 * @param {Object} gameState - 游戏状态
 * @returns {string} 人格提示词
 */
export const buildProgressivePersonaPrompt = (player, gameState) => {
  const existingRoles = detectExistingRoles(gameState?.players || []);
  const gameSetup = gameState?.gameSetup;
  const roleModule = getRoleModule(player.role);

  // 使用角色模块的人格构建方法
  if (roleModule.buildPersonaPrompt) {
    return roleModule.buildPersonaPrompt(player, existingRoles, gameSetup);
  }

  // 降级到默认村民模块
  return ROLE_MODULES['村民'].buildPersonaPrompt(player, existingRoles, gameSetup);
};

/**
 * 构建渐进式游戏规则提示词
 * 只包含与当前游戏配置相关的规则
 *
 * @param {Object} gameState - 游戏状态
 * @param {Object} options - 额外选项
 * @returns {string} 规则提示词
 */
export const buildProgressiveRulesPrompt = (gameState, options = {}) => {
  const existingRoles = detectExistingRoles(gameState?.players || []);
  const gameSetup = gameState?.gameSetup;

  const parts = [];

  // 添加条件化规则（核心渐进式披露）
  const conditionalRules = buildConditionalRules(existingRoles, gameSetup);
  if (conditionalRules) {
    parts.push(conditionalRules);
  }

  // 添加术语表（所有游戏通用）
  parts.push(TERMINOLOGY);

  return parts.join('\n\n');
};

/**
 * 构建完整的渐进式系统提示词
 *
 * @param {Object} player - 玩家对象
 * @param {Object} gameState - 游戏状态
 * @param {Object} options - 额外选项
 * @returns {string} 系统提示词
 */
export const buildProgressiveSystemPrompt = (player, gameState, options = {}) => {
  const {
    victoryMode = 'edge',
    previousIdentityTable = null,
    includeReflection = true
  } = options;

  const existingRoles = detectExistingRoles(gameState?.players || []);
  const gameSetup = gameState?.gameSetup;
  const ctx = gameState?.context || {};

  const parts = [];

  // 1. 基本身份和状态
  parts.push(`你是[${player.id}号]，身份【${player.role}】。
【游戏状态】第${ctx.dayCount || 1}天
【你的状态】存活
【场上存活】${ctx.aliveList || ''}
【已死亡】${ctx.deadList || ''}`);

  // 2. 胜利条件
  const isWolf = player.role === '狼人';
  parts.push(buildVictoryPrompt(victoryMode, isWolf));

  // 3. 角色私有信息（根据角色类型）
  const privateInfo = buildPrivateRoleInfo(player, gameState, existingRoles);
  if (privateInfo) {
    parts.push(privateInfo);
  }

  // 4. 角色人格（渐进式）
  parts.push(buildProgressivePersonaPrompt(player, gameState));

  // 5. 条件化规则（渐进式核心）
  parts.push(buildProgressiveRulesPrompt(gameState, options));

  // 6. 身份推理表
  const identityTablePrompt = previousIdentityTable
    ? `\n【你之前的身份推理表】\n${JSON.stringify(previousIdentityTable, null, 2)}\n请根据新信息更新推理表。`
    : IDENTITY_TABLE_PROMPT;
  parts.push(identityTablePrompt);

  // 7. 对抗性反思（可选）
  if (includeReflection) {
    parts.push(ADVERSARIAL_REFLECTION);
  }

  // 8. 输出要求
  parts.push('输出JSON（必须包含identity_table字段记录你的身份推理）');

  return parts.join('\n\n');
};

/**
 * 构建角色私有信息
 * 根据角色类型返回不同的私有信息
 */
const buildPrivateRoleInfo = (player, gameState, existingRoles) => {
  const role = player.role;

  switch (role) {
    case '狼人': {
      // 狼人知道队友
      const teammates = gameState?.players?.filter(p =>
        p.role === '狼人' && p.id !== player.id && p.isAlive
      ).map(p => p.id) || [];

      if (teammates.length > 0) {
        return `【狼队信息】你的狼队友：${teammates.join(',')}号`;
      }
      return '【狼队信息】你是孤狼（唯一狼人）';
    }

    case '预言家': {
      const seerChecks = gameState?.seerChecks?.filter(c => c.seerId === player.id) || [];
      if (seerChecks.length > 0) {
        const checksInfo = seerChecks.map(c =>
          `N${c.night}:${c.targetId}号${c.isWolf ? '【狼人】' : '【好人】'}`
        ).join(', ');
        return `【查验记录】${checksInfo}`;
      }
      return '';
    }

    case '女巫': {
      const hasPotion = player.hasWitchSave !== false;
      const hasPoison = player.hasWitchPoison !== false;
      const witchHistory = gameState?.witchHistory || { savedIds: [], poisonedIds: [] };

      let info = `【药水状态】解药:${hasPotion ? '有' : '已用'} | 毒药:${hasPoison ? '有' : '已用'}`;
      if (witchHistory.savedIds?.length > 0) {
        info += `\n【已救】${witchHistory.savedIds.join(',')}号(银水)`;
      }
      if (witchHistory.poisonedIds?.length > 0) {
        info += `\n【已毒】${witchHistory.poisonedIds.join(',')}号`;
      }
      return info;
    }

    case '守卫': {
      const guardHistory = gameState?.guardHistory || [];
      const lastGuardTarget = gameState?.nightDecisions?.lastGuardTarget;

      let info = '';
      if (guardHistory.length > 0) {
        info = `【守护记录】${guardHistory.map(g => `N${g.night}:守${g.targetId}号`).join(', ')}`;
      }
      if (lastGuardTarget !== null && lastGuardTarget !== undefined) {
        info += `\n【禁止连守】${lastGuardTarget}号(昨晚守过)`;
      }
      return info;
    }

    case '猎人': {
      return '【猎人技能】死亡时可开枪带走一人（被毒死除外）';
    }

    default:
      return '';
  }
};

/**
 * 获取角色特定的行动提示词
 *
 * @param {string} actionType - 行动类型
 * @param {Object} player - 玩家对象
 * @param {Object} gameState - 游戏状态
 * @param {Object} params - 额外参数
 * @returns {string} 行动提示词
 */
export const getProgressiveActionPrompt = (actionType, player, gameState, params = {}) => {
  const roleModule = getRoleModule(player.role);
  const existingRoles = detectExistingRoles(gameState?.players || []);
  const gameSetup = gameState?.gameSetup;

  // 合并参数
  const enhancedParams = {
    ...params,
    existingRoles,
    gameSetup,
    playerId: player.id
  };

  switch (actionType) {
    case 'DAY_SPEECH':
      if (roleModule.daySpeech) {
        const ctx = gameState?.context || {};
        return roleModule.daySpeech(ctx, enhancedParams);
      }
      break;

    case 'NIGHT_WOLF':
      if (roleModule.nightAction) {
        return roleModule.nightAction(enhancedParams);
      }
      break;

    case 'NIGHT_SEER':
      if (roleModule.nightAction) {
        return roleModule.nightAction(enhancedParams);
      }
      break;

    case 'NIGHT_WITCH':
      if (roleModule.nightAction) {
        return roleModule.nightAction(enhancedParams);
      }
      break;

    case 'NIGHT_GUARD':
      if (roleModule.nightAction) {
        return roleModule.nightAction(enhancedParams);
      }
      break;

    case 'HUNTER_SHOOT':
      if (roleModule.shoot) {
        return roleModule.shoot(enhancedParams);
      }
      break;

    case 'DAY_VOTE':
      if (roleModule.vote) {
        return roleModule.vote(enhancedParams);
      }
      break;
  }

  // 降级到默认提示词
  return null;
};

// 导出所有工厂函数
export default {
  buildProgressivePersonaPrompt,
  buildProgressiveRulesPrompt,
  buildProgressiveSystemPrompt,
  getProgressiveActionPrompt,
  detectExistingRoles,
  getRoleModule
};
