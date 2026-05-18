// Consolidated Prompt Engineering Service
// This module manages ALL context construction for the AI agents.
// It separates System Prompts (Personality, Global Rules) from User Prompts (Tasks).
// Enhanced with: Role Personas, Chain-of-Thought, Adversarial Reflection (P0 Optimization)
// P1 Enhancement: Progressive Disclosure - Role-specific modules with conditional content

// 导入渐进式披露架构
import {
    detectExistingRoles,
    getRoleModule
} from './rolePrompts';
// 柱三：结构化 claims schema，追加到所有 DAY_SPEECH 提示词末尾
import { CLAIMS_SCHEMA_SUFFIX } from './rolePrompts/baseRules';

// --- CONSTANTS ---
export const PROMPT_ACTIONS = {
    DAY_SPEECH: 'DAY_SPEECH',
    DAY_VOTE: 'DAY_VOTE',
    NIGHT_GUARD: 'NIGHT_GUARD',
    NIGHT_MAGICIAN: 'NIGHT_MAGICIAN',
    NIGHT_WOLF: 'NIGHT_WOLF',
    NIGHT_SEER: 'NIGHT_SEER',
    NIGHT_WITCH: 'NIGHT_WITCH',
    NIGHT_DREAMWEAVER: 'NIGHT_DREAMWEAVER',
    HUNTER_SHOOT: 'HUNTER_SHOOT',
    SUMMARIZE_CONTENT: 'SUMMARIZE_CONTENT'
};

const TERMINOLOGY = `【术语】划水(无内容),踩(怀疑),站边(信某预),金水/查杀(预验好/坏),悍跳(狼称预),银水(女巫救),倒钩(狼站边好人),抗推(好人被投).`;

// ============================================================
// 胜利模式配置
// ============================================================
const VICTORY_MODE_PROMPTS = {
  'edge': {
    name: '屠边模式',
    wolfGoal: '杀光所有村民或所有神职即可胜利',
    goodGoal: '杀光所有狼人才能胜利',
    wolfStrategy: '优先集中攻击一个阵营（村民或神职），速战速决',
    goodStrategy: '保护弱势阵营，避免被屠边'
  },
  'town': {
    name: '屠城模式',
    wolfGoal: '必须杀光所有好人（村民+神职）才能胜利',
    goodGoal: '杀光所有狼人才能胜利',
    wolfStrategy: '需要更长时间，要更加谨慎伪装，逐个击破',
    goodStrategy: '有更多容错空间，即使损失部分神职或村民也能继续'
  }
};

// ============================================================
// 身份推理表系统 (Identity Inference Table)
// AI 通过排除法维护对每个玩家身份的推测
// ============================================================
const IDENTITY_TABLE_PROMPT = `
【身份推理表说明】
你需要维护一个身份推理表，记录你对每个玩家身份的判断。
格式: {"玩家号数字": {"suspect": "角色全名", "confidence": 0-100, "reason": "推理依据"}}
示例: {"0": {"suspect":"狼人","confidence":80,"reason":"..."}}
硬性要求:
1) identity_table 的 key 必须是纯数字字符串（不要写“0号/1号”）
2) identity_table 的 suspect 必须是【本局角色配置】里存在的“角色全名”
3) 不要用“好人/坏人/平民/神职”等泛称来当作角色

推理方法：
1. 排除法：根据已确认的身份排除可能性
2. 行为分析：发言风格、投票倾向、夜间结果
3. 逻辑推断：谁的发言有矛盾？谁在引导错误方向？
4. 阵营判断：先判断好人/狼人，再细分角色

置信度参考：
- 90-100: 基本确定（如自己验过、明确跳身份）
- 70-89: 高度怀疑（多个证据指向）
- 50-69: 中度怀疑（有一定依据）
- 30-49: 轻度怀疑（信息不足）
- 0-29: 基本排除（可能是好人）
`;

// ============================================================
// 局数配置辅助函数
// 用于区分6人局/8人局/12人局等不同规则
// ============================================================

/**
 * 判断是否是小型局（6人局）
 * 6人局特点：无猎人、无守卫、无警徽流
 */
const isMiniGame = (gameSetup) => {
  if (!gameSetup) return false;
  return gameSetup.id === 'mini_6' || gameSetup.TOTAL_PLAYERS === 6;
};

/**
 * 判断是否是标准局（8人局）
 * 8人局特点：有完整神职、无警徽流
 */
const isStandardGame = (gameSetup) => {
  if (!gameSetup) return true; // 默认为标准局
  return gameSetup.id === 'standard_8' || gameSetup.TOTAL_PLAYERS === 8;
};

/**
 * 判断是否是大型局（12人局）
 * 12人局特点：有警徽流
 */
const isLargeGame = (gameSetup) => {
  if (!gameSetup) return false;
  return gameSetup.TOTAL_PLAYERS >= 12;
};

/**
 * 检查游戏是否包含特定角色
 */
const hasRole = (gameSetup, roleName) => {
  if (!gameSetup || !gameSetup.STANDARD_ROLES) return true; // 默认假设有
  return gameSetup.STANDARD_ROLES.includes(roleName);
};

// ============================================================
// P0-1: 角色人格系统 (Role-Specific Persona)
// 基于报告理论：每个角色的思考逻辑由其职能、信息量和生存压力决定
// ============================================================
const ROLE_PERSONAS = {
    '狼人': {
        archetype: '伪装大师',
        speechStyle: '灵活多变，适应场上局势，表演自然',
        coreGoal: '生存至最后，同时抗推好人出局',
        thinkingDimensions: [
            '悍跳逻辑：是否需要跳预言家？给谁发金水/查杀最有利？',
            '深水策略：如何在平民中潜伏，发言中庸不引人注意？',
            '倒钩战术：是否需要出卖队友换取信任？',
            '刀法规划：根据发言抿神职身份，优先级：女巫>预言家>守卫>猎人'
        ],
        priorities: ['生存', '制造混乱', '保护狼队', '抗推好人'],
        taboos: ['暴露狼队信息', '逻辑自相矛盾', '过度划水被怀疑'],
        signalGameTips: '你可以通过给好人发"摸头金"来拉票，或给好人发"查杀"做低其身份'
    },
    '预言家': {
        archetype: '真理守护者',
        speechStyle: '强势果断，逻辑清晰，公信力至上',
        coreGoal: '建立公信力，带领好人找出狼人',
        thinkingDimensions: [
            '查验逻辑：查谁能提供最大信息量？优先查焦点位或定点位',
            '警徽流决策：如果被刀，警徽交给谁能传递最清晰的信号？',
            '防守逻辑：面对悍跳狼的查杀，如何识别其发言中的逻辑漏洞？',
            '心路历程：我的查验选择是否有合理的心路可以解释？'
        ],
        priorities: ['报验人', '建立公信力', '带节奏打狼', '安排警徽流'],
        taboos: ['划水', '模糊表态', '投给自己发的金水', '不报查验结果'],
        signalGameTips: '通过清晰的查验报告和合理的心路历程证明自己是真预言家'
    },
    '女巫': {
        archetype: '资源管控者',
        speechStyle: '审慎稳重，关键时刻果断出手',
        coreGoal: '合理使用双药，最大化阵营收益',
        thinkingDimensions: [
            '解药逻辑：救人的期望收益是否大于保留解药的防御价值？',
            '毒药逻辑：只有当某人逻辑完全崩坏时才考虑开毒',
            '轮次平衡：当前轮次用药是否划算？后续还有几轮？',
            '身份隐藏：在解药使用前，如何伪装成普通平民？'
        ],
        priorities: ['保护关键神职', '精准使用毒药', '隐藏身份', '关键时刻跳身份'],
        taboos: ['首夜不救人', '盲毒好人', '过早暴露身份', '浪费解药救狼'],
        signalGameTips: '女巫救起的人是银水，可作为身份证明；报出毒亡信息证明身份'
    },
    '猎人': {
        archetype: '终极威慑者',
        speechStyle: '坚定有力，关键时刻展示威慑',
        coreGoal: '生存发挥威慑，死亡时带走狼人',
        thinkingDimensions: [
            '威慑逻辑：如何适时展示力量，既不过早暴露也不过晚起跳？',
            '枪口准星：分析投票路径，重点关注关键轮次表现反常的玩家',
            '临终清算：被投出或被刀时，根据全场复盘选择最像狼的目标',
            '配合预言：优先带走被预言家查杀的玩家'
        ],
        priorities: ['带走狼人', '配合预言家', '保护关键信息', '威慑狼人'],
        taboos: ['被毒死（无法开枪）', '带走好人', '过早暴露让狼积怒气'],
        signalGameTips: '猎人的存在使狼人在投票时有所顾忌，可适当展示身份威慑'
    },
    '守卫': {
        archetype: '暗夜守护者',
        speechStyle: '低调谨慎，隐藏身份防止被刀',
        coreGoal: '保护关键神职，打乱狼人刀法',
        thinkingDimensions: [
            '守护次序：首晚空守配合女巫，避免同守同救',
            '博弈思考：狼人会刀谁？我以为狼以为我会守谁？',
            '自守价值：守卫在场即是威慑，是否需要自守保命？',
            '刀法预判：根据场上局势预判狼人目标'
        ],
        priorities: ['守护预言家', '避免同守同救', '隐藏身份', '打乱刀法'],
        taboos: ['连守同一目标', '首夜守人导致同救', '过早暴露身份'],
        signalGameTips: '守卫不宜过早跳身份，成功守护后可作为身份证明'
    },
    '村民': {
        archetype: '逻辑基石',
        speechStyle: '敢于站边，分析行为找狼',
        coreGoal: '通过逻辑分析帮助阵营找出狼人',
        thinkingDimensions: [
            '容错率分析：通过排除法缩小狼坑',
            '视角分析：寻找发言中"视角缺失"导致的不连贯点',
            '表水逻辑：被怀疑时证明自己行为在闭眼视角下是合理的',
            '站边选择：分析两个预言家的发言质量，选择站边'
        ],
        priorities: ['站边真预言家', '分析逻辑', '投票正确', '不被狼人带节奏'],
        taboos: ['反水真预言家', '划水不发言', '被狼人利用', '盲目跟票'],
        signalGameTips: '平民是好人阵营的投票主力，敢于站边和质疑是关键'
    }
};

// 构建角色人格提示词
// P1增强：使用渐进式披露架构，根据游戏配置动态调整内容
export const buildPersonaPrompt = (player, gameState) => {
    const gameSetup = gameState?.gameSetup;
    const existingRoles = detectExistingRoles(gameState?.players || []);

    // 尝试使用新的渐进式披露模块
    const roleModule = getRoleModule(player.role);
    if (roleModule && roleModule.buildPersonaPrompt) {
        return roleModule.buildPersonaPrompt(player, existingRoles, gameSetup);
    }

    // 降级到原有逻辑（向后兼容）
    const persona = ROLE_PERSONAS[player.role] || ROLE_PERSONAS['村民'];
    const personality = player.personality;

    // 动态调整思维维度（根据局数配置过滤）
    let thinkingDimensions = [...persona.thinkingDimensions];
    let priorities = [...persona.priorities];

    // 6人局/8人局：移除警徽流相关内容（警徽流是12人局的概念）
    if (!isLargeGame(gameSetup)) {
        thinkingDimensions = thinkingDimensions.filter(d => !d.includes('警徽'));
        priorities = priorities.filter(p => !p.includes('警徽'));
    }

    // 6人局：移除守卫和猎人相关内容
    if (isMiniGame(gameSetup)) {
        thinkingDimensions = thinkingDimensions.filter(d =>
            !d.includes('守卫') && !d.includes('猎人')
        );
        // 调整狼人刀法优先级描述
        if (player.role === '狼人') {
            thinkingDimensions = thinkingDimensions.map(d =>
                d.includes('刀法规划')
                    ? '刀法规划：根据发言抿神职身份，优先级：女巫>预言家>村民'
                    : d
            );
        }
    }

    const relevantDimensions = thinkingDimensions.slice(0, 3).join('\n  - ');

    return `
【角色原型】${persona.archetype}
【核心目标】${persona.coreGoal}
【话风】${persona.speechStyle} + ${personality?.traits || '普通'}
【思考维度】
  - ${relevantDimensions}
【优先级】${priorities.join(' > ')}
【禁忌】${persona.taboos.join(', ')}
【博弈提示】${persona.signalGameTips}`;
};

// ============================================================
// P0-2: 链式思考模板 (Chain-of-Thought)
// 基于报告理论：强制要求AI在生成回复前进行全场逻辑复盘
// ============================================================
const COT_TEMPLATES = {
    // 白天发言的链式思考
    DAY_SPEECH: `
【思维链要求】在发言前，必须在thought字段完成以下推理：

Step1-信息整合：
- 本轮新信息：谁跳了什么身份？谁被查验？
- 与我相关：有人质疑我吗？有人给我发金水/查杀吗？

Step2-身份推断：
- 逐个分析存活玩家的身份概率（基于发言+投票）
- 标记最可疑的2-3人及理由

Step3-阵营评估：
- 场上狼人数量估计（已死+存活）
- 好人阵营当前优势/劣势

Step4-策略选择：
- 我这轮应该采取什么策略？（踩人/站边/跳身份/划水）
- 这个策略对我的阵营有什么收益？

Step5-决策输出：
- 投票目标：X号
- 发言重点：简述`,

    // 投票的链式思考
    DAY_VOTE: `
【投票思维链】
1. 回顾发言意向，是否有新信息改变判断？
2. 分析票型：如果我投X，能否形成多数？
3. 阵营考量：好人要集中票，狼人可考虑冲票
4. 最终决策：投X号，理由是...`,

    // 夜间行动的链式思考
    NIGHT_ACTION: `
【夜间决策思维链】
1. 场上局势：存活玩家身份分析
2. 历史信息：过往行动和结果
3. 策略评估：本次行动的最优选择
4. 决策输出：目标/行动`
};

export const getCOTTemplate = (actionType) => {
    switch (actionType) {
        case PROMPT_ACTIONS.DAY_SPEECH:
            return COT_TEMPLATES.DAY_SPEECH;
        case PROMPT_ACTIONS.DAY_VOTE:
            return COT_TEMPLATES.DAY_VOTE;
        default:
            return COT_TEMPLATES.NIGHT_ACTION;
    }
};

// ============================================================
// P0-3: 对抗反思提示 (Adversarial Reflection)
// 基于报告理论：要求AI自我质疑，修正推理偏差
// ============================================================
const ADVERSARIAL_REFLECTION = `
【对抗性自检】输出前请快速验证：
1. 反向验证：如果我的推论错了，狼人最可能的布局是？
2. 信息盲区：我是否遗漏了某些关键发言或投票？
3. 被利用风险：我的行动是否可能被狼人利用来带节奏？
4. 一致性检查：我的发言是否与之前立场矛盾？
※ 发现问题请在thought中修正后再输出speech`;

export const getAdversarialReflection = () => ADVERSARIAL_REFLECTION;

// ============================================================
// 原有策略系统（保留兼容性，整合到人格系统中）
// 根据局数配置动态调整策略提示
// ============================================================
const STRATEGIES = {
    '狼人': (isFirstDay, nightNum, player, gameSetup) => {
        if (isMiniGame(gameSetup)) {
            return `【狼人策略】目标:伪装到底、投出好人。可悍跳预言家(发查杀/金水)。刀法优先级:女巫>预言家>村民。被怀疑时反攻而非放弃——永远像被冤枉的好人一样战斗。`;
        }
        return `【狼人策略】目标:伪装到底、投出好人。可悍跳预言家(发查杀/金水)。被怀疑时反攻而非放弃——绝不自爆、绝不主动暴露身份，坚持伪装到最后一刻。`;
    },
    '预言家': (isFirstDay, nightNum, player, gameSetup) => {
        // 只有12人局才有警徽流
        const hasPolice = isLargeGame(gameSetup);
        if (isFirstDay) {
            return `【预言家策略】必跳身份!报验人(金水/查杀)。强势带队，分析心路，打飞查杀。`;
        }
        if (hasPolice) {
            return `【预言家策略】继续报验人。号召全票放逐狼人。安排警徽流。`;
        }
        return `【预言家策略】继续报验人。号召全票放逐狼人。带领好人投票。`;
    },
    '女巫': (isFirstDay, nightNum, player, gameSetup) => {
        const shouldSave = nightNum <= 2 && player.hasWitchSave;
        return `【女巫策略】${shouldSave ? '前期救人了(银水)。' : ''}无药/有人对跳则跳身份报银水/毒亡。`;
    },
    '猎人': (isFirstDay, nightNum, player, gameSetup) => `【猎人策略】好人阵营!开枪优先带走被查杀/悍跳狼/最像狼的人。死亡必开枪!`,
    '守卫': (isFirstDay, nightNum, player, gameSetup) => `【守卫策略】${nightNum === 1 ? '首夜空守防同救。' : ''}防守神职/预言家。低调隐藏身份。`,
    '村民': (isFirstDay, nightNum, player, gameSetup) => `【村民策略】敢于站边。接金水不反水。分析行为逻辑找狼。`
};

// Keep for compatibility during transition, or remove if fully migrated?
// We will export it but usage should be internal mainly.
export const ROLE_STRATEGIES = STRATEGIES;

// --- HELPER FUNCTIONS ---

export const getWerewolfTerminology = () => TERMINOLOGY;

export const buildRoleStrategy = (player, dayCount, gameSetup = null) => {
  const isFirstDay = dayCount === 1;
  const strategyFn = STRATEGIES[player.role] || STRATEGIES['村民'];
  return strategyFn(isFirstDay, dayCount, player, gameSetup);
};

export const buildPrivateRoleInfo = (player, gameState) => {
    // 注意：所有历史记录（seerChecks, guardHistory, witchHistory）都包含整局游戏的数据
    // 这些记录在整个游戏过程中累积，而不是每天刷新

    // Deconstruct safe properties
    const seerChecks = gameState.seerChecks || [];
    const nightDecisions = gameState.nightDecisions || {};
    const witchHistory = gameState.witchHistory || { savedIds: [], poisonedIds: [] };
    const guardHistory = gameState.guardHistory || [];
    const players = gameState.players || [];

    let info = '';

    switch (player.role) {
        case '预言家':
            const myChecks = seerChecks.filter(c => c.seerId === player.id);
            // 整局查验记录，包含从第一夜到现在的所有查验
            info = myChecks.length > 0
                ? `【整局查验记录】${myChecks.map(c => `N${c.night}:${c.targetId}号是${c.isWolf ? '狼' : '好人'}`).join(';')}`
                : '【整局查验记录】无';
            if (nightDecisions.seerResult?.targetId !== undefined) {
                 // Avoid duplicate if already in history?
                 if (!myChecks.some(c => c.targetId === nightDecisions.seerResult.targetId)) {
                    info += `\n【今晚查验(最新)】: ${nightDecisions.seerResult.targetId}号是${nightDecisions.seerResult.isWolf ? '狼' : '好人'}`;
                 }
            }
            break;
        case '女巫':
            info = `【药】解:${player.hasWitchSave ? '有' : '无'} 毒:${player.hasWitchPoison ? '有' : '无'}`;
            // 整局用药记录
            if (witchHistory.savedIds.length > 0) info += ` 【整局救人】${witchHistory.savedIds.join(',')}号`;
            if (witchHistory.poisonedIds.length > 0) info += ` 【整局毒人】${witchHistory.poisonedIds.join(',')}号`;
            break;
        case '守卫':
            // 整局守护记录
            info = guardHistory.length > 0
                ? `【整局守护记录】${guardHistory.map(g => `N${g.night}:${g.targetId}号`).join(';')}`
                : '【整局守护记录】无';
            if (nightDecisions.lastGuardTarget !== null) info += ` 禁守${nightDecisions.lastGuardTarget}号(连守)`;
            break;
        case '狼人':
            const wolfTeam = players.filter(p => p.role === '狼人').map(p => `${p.id}号${p.isAlive ? '' : '(死)'}`).join(',');
            info = `【狼队】${wolfTeam}`;
            break;
        default:
            info = '';
            break;
    }
    return info;
};

// ============================================================
// 核心规则生成：夜间流程与平安夜逻辑（渐进式披露）
// ============================================================
/**
 * 构建核心游戏规则 - 根据存在的角色动态生成
 * 渐进式披露：没有的角色不会被提及
 * @param {Object} existingRoles - 存在的角色标志
 * @returns {string} 动态生成的规则字符串
 */
const buildCoreGameRules = (existingRoles = {}) => {
  const { hasWitch, hasGuard } = existingRoles;

  // 构建夜间行动顺序 - 只包含存在的角色
  const actionOrder = ['狼人杀人'];
  if (hasWitch) actionOrder.push('女巫得知刀口并决定用药');
  if (hasGuard) actionOrder.push('守卫守护');
  actionOrder.push('预言家查验');

  // 构建平安夜原因列表 - 只包含存在的角色
  const peacefulReasons = [];
  if (hasWitch) peacefulReasons.push('女巫救人了');
  if (hasGuard) peacefulReasons.push('守卫守对了');

  // 女巫相关规则
  const witchRules = hasWitch ? `
2. 女巫在夜间【先于结果宣告前】得知狼人刀的目标，可选择是否使用解药救人
3. 若女巫使用解药救人，次日早上会宣告"平安夜"（无人死亡）
4. 女巫一晚只能使用一瓶药（解药或毒药），不能同时使用` : '';

  // 平安夜分析要点 - 根据存在角色动态生成
  let peacefulNightAnalysis = '';
  if (peacefulReasons.length > 0) {
    const reasonsText = peacefulReasons.map((r, i) => `${String.fromCharCode(9312 + i)}${r}`).join(' 或 ');
    peacefulNightAnalysis = `\n【平安夜分析要点】
- 平安夜出现时，说明：${reasonsText}${peacefulReasons.length > 1 ? ' 或两者皆有' : ''}`;

    if (hasWitch) {
      peacefulNightAnalysis += `\n- 平安夜后，女巫可以考虑跳身份报"银水"（救过的人）`;
    }
    if (hasWitch && hasGuard) {
      peacefulNightAnalysis += `\n- 狼人可能利用平安夜制造混乱，声称"守卫守护成功"来转移注意力`;
    }
  }

  // 平安夜逻辑结论 - 根据存在角色调整
  let peacefulConclusion = '';
  if (hasWitch && hasGuard) {
    peacefulConclusion = '因此，【平安夜是女巫开药或守卫成功守护的直接证据】，而非"女巫不能救人"';
  } else if (hasWitch) {
    peacefulConclusion = '因此，【平安夜是女巫开药救人的直接证据】，而非"女巫不能救人"';
  } else if (hasGuard) {
    peacefulConclusion = '因此，【平安夜是守卫成功守护的直接证据】';
  }

  return `
【核心规则 - 夜间流程】
1. 夜间行动顺序：${actionOrder.join(' → ')}${witchRules}
${peacefulConclusion ? `5. ${peacefulConclusion}` : ''}${peacefulNightAnalysis}`;
};

export const buildGameTheoryRules = (isFirstSpeaker, playerRole, spokenPlayerIds = [], existingRoles = {}, gameSetup = null) => {
  const attackRule = isFirstSpeaker
    ? '- 由于你是首个发言，尚未有人发言。你可以简单点评昨夜情况（如平安夜），或聊聊自己的身份底牌（也可以划水过）。切记：不要凭空捏造他人的发言或行为！因为还没人说话！'
    : (playerRole !== '狼人'
        ? '- 如果你是好人：怀疑1-2名玩家。不要开上帝视角。'
        : '- 如果你是狼人：制造混乱，甚至可以"倒钩"（假装帮好人说话）。');

  // 时序警告
  const temporalWarning = spokenPlayerIds.length > 0
    ? `\n   - 【时序因果】已发言玩家(按顺序): ${spokenPlayerIds.join('号,')}号。只能评价已发言玩家的内容！后发言的玩家不可能"回应"先发言的玩家，注意因果关系！`
    : '';

  // 根据场上角色动态生成规则
  const roleSpecificRules = [];
  if (existingRoles.hasSeer) {
    roleSpecificRules.push('预言家可报金水/查杀');
  }
  if (existingRoles.hasWitch) {
    roleSpecificRules.push('女巫可报银水(救过的人)');
  }
  if (existingRoles.hasGuard) {
    roleSpecificRules.push('守卫可报守护信息');
  }
  if (existingRoles.hasHunter) {
    roleSpecificRules.push('猎人死亡可开枪');
  }
  const rolesInGame = roleSpecificRules.length > 0 ? `\n   - 本局存在的神职: ${roleSpecificRules.join(', ')}` : '';

  // 根据局数生成局数提示
  let gameTypeHint = '';
  if (isMiniGame(gameSetup)) {
    gameTypeHint = '\n【6人局特点】本局无猎人、无守卫。神职只有预言家和女巫，好人容错率低，需要精准找狼。';
  } else if (isStandardGame(gameSetup)) {
    gameTypeHint = '\n【8人局特点】本局有完整神职配置。无警徽流机制。';
  } else if (isLargeGame(gameSetup)) {
    gameTypeHint = '\n【大型局特点】本局有警徽流机制。预言家被刀后可将警徽传给信任的玩家。';
  }

  return `
${buildCoreGameRules(existingRoles)}${gameTypeHint}

【发言必须遵守的规则】
1. 查重检查：首先检查【今日发言】，绝对不能重复别人的观点或问题。
2. 夜间情报：如果有夜间信息(查验/刀口/守护)，必须第一时间报出来。【预言家】若验了好人，必报"X号是金水"，且【投票意向】不能投给金水！
3. 信息时效：如果预言家已死，不要再讨论他的查验（除非回顾逻辑）。
4. 动机分析：怀疑某人时，必须分析其"狼人动机"（收益论）。
5. 有效互动：可点名【存活】玩家解释【历史发言】。严禁评价【未发言】内容。
6. 低信息应对：若信息少，可谈"平安夜"可能或简单站边。
7. 【投票意向】：voteIntention = 你想投票【淘汰/出局】的目标号码（即你认为是狼人、想投死的人）。注意：这不是你"支持/站边"的人！如果你站边某位预言家，应该投他指出的狼人目标，而不是投预言家本人。信息不足无法判断时输出-1表示弃票。
8. 记忆与状态约束：
   - 只能根据【今日发言】和【投票记录】推理。
   - 【严禁幻视】：绝对不要评价【尚未发言】的玩家！${temporalWarning}${rolesInGame}
   ${isFirstSpeaker ? '- 特别警告：你是首个发言，场上除死亡信息外是一张白纸。' : ''}
9. 行为约束：
   - 【严禁自投】：不能投票给自己。
   - 【严禁自杀式逻辑】：好人不要说"如果他是真预，我就是狼"这种话。
   - ${attackRule}
10. 【被指控时的应对】：
   - 好人被冤枉时应该：用逻辑反驳（"我的发言哪里像狼？"）+ 反向质疑指控者（"你为什么针对我？"）
   - 不要慌张、不要沉默、不要说"随便你们投吧"——这些反应只会加深怀疑。
   - 用事实和逻辑自证，而不是情绪化辩解。`;
};

// --- DATA PREPARATION ---

/**
 * 智能截断：保留关键信息
 * 优先保留狼人杀术语和关键词
 */
const smartTruncate = (content, maxLength) => {
    if (!content || content.length <= maxLength) return content;

    // 关键词列表
    const keywords = ['金水', '查杀', '狼人', '预言家', '女巫', '猎人', '守卫', '投', '怀疑', '站边', '悍跳', '银水', '好人'];

    // 尝试找到包含关键词的句子片段
    const sentences = content.split(/[。！？；,，]/);
    let result = '';

    for (const sentence of sentences) {
        if (result.length >= maxLength) break;

        const trimmed = sentence.trim();
        if (!trimmed) continue;

        // 优先选择包含关键词的句子
        const hasKeyword = keywords.some(kw => trimmed.includes(kw));
        if (hasKeyword || result.length === 0) {
            if (result.length + trimmed.length + 1 <= maxLength) {
                result += (result ? ',' : '') + trimmed;
            } else if (result.length === 0) {
                // 第一句太长，截断
                result = trimmed.slice(0, maxLength - 3) + '...';
            }
        }
    }

    // 如果结果太短，补充内容
    if (result.length < maxLength / 3) {
        result = content.slice(0, maxLength - 3) + '...';
    }

    return result;
};

/**
 * 统计场上的身份声明情况（用于身份推理）
 */
const analyzeIdentityClaims = (speechHistory, gameSetup) => {
    const claims = {
        seer: [], // 跳预言家的玩家
        witch: [], // 跳女巫的玩家
        hunter: [], // 跳猎人的玩家
        guard: [], // 跳守卫的玩家
    };

    // 分析所有发言，寻找身份声明
    speechHistory.forEach(speech => {
        const content = speech.content?.toLowerCase() || '';
        const playerId = speech.playerId;

        // 检测预言家声明（关键词：查验、金水、查杀、预言家）
        if (content.includes('查验') || content.includes('金水') || content.includes('查杀') ||
            content.includes('我是预言家') || content.includes('预言家')) {
            if (!claims.seer.includes(playerId)) {
                claims.seer.push(playerId);
            }
        }

        // 检测女巫声明（关键词：解药、毒药、银水、女巫）
        if (content.includes('解药') || content.includes('毒药') || content.includes('银水') ||
            content.includes('我是女巫') || content.includes('女巫')) {
            if (!claims.witch.includes(playerId)) {
                claims.witch.push(playerId);
            }
        }

        // 检测猎人声明（关键词：开枪、带走、猎人）
        if (content.includes('开枪') || content.includes('带走') || content.includes('我是猎人') ||
            content.includes('猎人')) {
            if (!claims.hunter.includes(playerId)) {
                claims.hunter.push(playerId);
            }
        }

        // 检测守卫声明（关键词：守护、守卫）
        if (content.includes('守护') || content.includes('我是守卫') || content.includes('守卫')) {
            if (!claims.guard.includes(playerId)) {
                claims.guard.push(playerId);
            }
        }
    });

    // 根据游戏配置生成推理提示
    const hints = [];
    const gameRoles = gameSetup?.STANDARD_ROLES || [];
    const seerCount = gameRoles.filter(r => r === '预言家').length;
    const witchCount = gameRoles.filter(r => r === '女巫').length;
    const hunterCount = gameRoles.filter(r => r === '猎人').length;
    const guardCount = gameRoles.filter(r => r === '守卫').length;

    // 预言家推理
    if (claims.seer.length > 0) {
        if (claims.seer.length === 1 && seerCount === 1) {
            hints.push(`⚠️ 只有${claims.seer[0]}号跳预言家，大概率是真预言家（本局只有1个预言家）`);
        } else if (claims.seer.length > seerCount) {
            hints.push(`⚠️ ${claims.seer.join(',')}号跳预言家，但本局只有${seerCount}个预言家，必有悍跳狼`);
        }
    }

    // 女巫推理
    if (claims.witch.length > 0) {
        if (claims.witch.length === 1 && witchCount === 1) {
            hints.push(`⚠️ 只有${claims.witch[0]}号跳女巫，大概率是真女巫（本局只有1个女巫）`);
        } else if (claims.witch.length > witchCount) {
            hints.push(`⚠️ ${claims.witch.join(',')}号跳女巫，但本局只有${witchCount}个女巫，必有假跳`);
        }
    }

    // 猎人推理
    if (claims.hunter.length > 0 && hunterCount > 0) {
        if (claims.hunter.length === 1 && hunterCount === 1) {
            hints.push(`⚠️ 只有${claims.hunter[0]}号跳猎人，大概率是真猎人（本局只有1个猎人）`);
        } else if (claims.hunter.length > hunterCount) {
            hints.push(`⚠️ ${claims.hunter.join(',')}号跳猎人，但本局只有${hunterCount}个猎人，必有假跳`);
        }
    }

    // 守卫推理
    if (claims.guard.length > 0 && guardCount > 0) {
        if (claims.guard.length === 1 && guardCount === 1) {
            hints.push(`⚠️ 只有${claims.guard[0]}号跳守卫，大概率是真守卫（本局只有1个守卫）`);
        } else if (claims.guard.length > guardCount) {
            hints.push(`⚠️ ${claims.guard.join(',')}号跳守卫，但本局只有${guardCount}个守卫，必有假跳`);
        }
    }

    return {
        claims,
        hints: hints.length > 0 ? '\n【身份推理】\n' + hints.join('\n') : ''
    };
};

export const prepareGameContext = (gameState) => {
    const { players, speechHistory, voteHistory, deathHistory, dayCount, phase, gameSetup } = gameState;
    const alivePlayers = players.filter(p => p.isAlive);
    const aliveList = alivePlayers.map(p => `${p.id}号`).join(',');
    const deadList = players.filter(p => !p.isAlive).map(p => `${p.id}号`).join(',') || '无';

    // 分析身份声明情况
    const identityAnalysis = analyzeIdentityClaims(speechHistory, gameSetup);

    // 今日发言 - 添加发言序号以表示时序
    const todaySpeechesList = speechHistory.filter(s => s.day === dayCount);
    const todaySpeeches = todaySpeechesList.map((s, idx) =>
        `[第${idx + 1}位发言] ${s.playerId}号:${s.content}`
    ).join('\n');

    // 记录已发言的玩家ID列表（用于时序感知）
    const spokenPlayerIds = todaySpeechesList.map(s => s.playerId);

    // 历史发言摘要：优先使用已有的summary，没有则使用智能截断
    // 注意：真正的AI压缩在 useAI 中异步处理
    const historySpeechesList = speechHistory.filter(s => s.day < dayCount);
    const historySpeeches = historySpeechesList.map(s => {
        const isYesterday = s.day === dayCount - 1;
        // 优先使用已压缩的摘要
        if (s.summary) {
            return `D${s.day} ${s.playerId}号:${s.summary}`;
        }
        // 昨天的发言保留更多内容，更早的发言截断
        const maxLen = isYesterday ? 60 : 40;
        const content = smartTruncate(s.content, maxLen);
        return `D${s.day} ${s.playerId}号:${content}`;
    }).join('\n');

    const voteInfo = voteHistory.length > 0 ? voteHistory.map(v =>
        `D${v.day}:${v.votes.map(vote => `${vote.from}->${vote.to === -1 ? '弃票' : vote.to}`).join(',')}=>${v.eliminated !== -1 ? v.eliminated + '号出局' : '流票'}`
    ).join(';') : '无';

    const targetNight = phase === 'night' ? dayCount - 1 : dayCount;
    let lastNightInfo;
    if (targetNight < 1) {
        lastNightInfo = `昨晚: 无 (首夜)`;
    } else {
        const lastNightDeaths = deathHistory.filter(d => d.day === targetNight && d.phase === '夜');
        lastNightInfo = lastNightDeaths.length > 0
            ? `昨晚(第${targetNight}夜)死亡: ${lastNightDeaths.map(d => `${d.playerId}号`).join(',')}`
            : `昨晚(第${targetNight}夜): 平安夜(无人死亡)`;
    }

    const priorDeaths = deathHistory.filter(d => d.day < targetNight || (d.day === targetNight && d.phase !== '夜'))
        .map(d => `D${d.day}${d.phase}: ${d.playerId}号${d.cause}`).join(';');

    // 构建完整的游戏时间线（整局游戏的事件记录，而非每天刷新）
    // 这有助于AI理解游戏的完整历史
    const buildFullGameTimeline = () => {
        const timeline = [];
        for (let day = 1; day <= dayCount; day++) {
            // 夜间死亡
            const nightDeaths = deathHistory.filter(d => d.day === day && d.phase === '夜');
            if (nightDeaths.length > 0) {
                timeline.push(`N${day}:${nightDeaths.map(d => `${d.playerId}号死亡`).join(',')}`);
            } else if (day < dayCount || (day === dayCount && phase !== 'night')) {
                timeline.push(`N${day}:平安夜`);
            }

            // 白天投票出局
            const dayDeaths = deathHistory.filter(d => d.day === day && (d.phase === '投票' || d.phase === '猎人枪'));
            if (dayDeaths.length > 0) {
                timeline.push(`D${day}:${dayDeaths.map(d => `${d.playerId}号${d.cause}`).join(',')}`);
            }
        }
        return timeline.join(' → ');
    };
    const fullGameTimeline = buildFullGameTimeline();

    // 检测场上存在的角色（用于动态调整提示词）
    const existingRoles = new Set(players.map(p => p.role));
    const hasGuard = existingRoles.has('守卫');
    const hasWitch = existingRoles.has('女巫');
    const hasHunter = existingRoles.has('猎人');
    const hasSeer = existingRoles.has('预言家');

    // For buildPrivateRoleInfo compatibility
    const gameStateForRole = {
        players,
        seerChecks: gameState.seerChecks,
        nightDecisions: gameState.nightDecisions,
        witchHistory: gameState.witchHistory,
        guardHistory: gameState.guardHistory,
        dayCount
    };

    return {
        aliveList,
        deadList,
        todaySpeeches,
        historySpeeches,
        voteInfo,
        deathInfo: `${lastNightInfo}; 历史死亡:${priorDeaths}`,
        lastNightInfo,
        dayCount,
        phase,
        aliveIdsString: alivePlayers.map(p => p.id).join(','),
        gameStateForRole, // Cached for helper
        // 新增：时序和角色信息
        spokenPlayerIds,
        existingRoles: {
            hasGuard,
            hasWitch,
            hasHunter,
            hasSeer
        },
        // 完整游戏时间线（整局游戏的事件记录）
        fullGameTimeline,
        // 身份推理信息
        identityAnalysis
    };
};

// --- PUBLIC API ---

/**
 * 构建【本局角色配置】提示（用于约束 identity_table，避免输出不存在的角色）
 */
const buildRolePoolConstraintPrompt = (gameSetup) => {
  const roles = gameSetup?.STANDARD_ROLES;
  if (!Array.isArray(roles) || roles.length === 0) return '';

  const roleCounts = roles.reduce((acc, role) => {
    acc[role] = (acc[role] || 0) + 1;
    return acc;
  }, {});

  const roleList = Object.keys(roleCounts);
  const summary = roleList.map(role => `${role}x${roleCounts[role]}`).join('，');

  return `【本局角色配置】${summary}
【硬性约束】identity_table 的 suspect 只能从以下角色中选择：${roleList.join('、')}（不得出现本局不存在的角色名；不得用“好人/坏人/平民/神职”等泛称代替角色）`;
};

/**
 * 生成增强版System Prompt
 * 整合：基础信息 + 角色人格 + 私有信息 + 策略 + 规则 + 对抗反思 + 胜利模式 + 身份推理表
 */
export const generateSystemPrompt = (player, gameState, options = {}) => {
    const { includePersona = true, includeReflection = true, victoryMode = 'edge', previousIdentityTable = null } = options;
    const ctx = prepareGameContext(gameState);
    const roleInfo = buildPrivateRoleInfo(player, ctx.gameStateForRole);
    const gameSetup = gameState?.gameSetup;
    const roleStrategy = buildRoleStrategy(player, ctx.dayCount, gameSetup);

    // Check if first speaker
    const isFirstSpeaker = ctx.dayCount === 1 && (!ctx.todaySpeeches || ctx.todaySpeeches.trim() === '');
    const rules = buildGameTheoryRules(isFirstSpeaker, player.role, ctx.spokenPlayerIds || [], ctx.existingRoles || {}, gameSetup);

    // P0增强：角色人格提示词
    const personaPrompt = includePersona ? buildPersonaPrompt(player, gameState) : '';

    // P0增强：对抗反思提示词
    const reflectionPrompt = includeReflection ? ADVERSARIAL_REFLECTION : '';

    // 胜利模式信息
    const victoryModeInfo = VICTORY_MODE_PROMPTS[victoryMode] || VICTORY_MODE_PROMPTS['edge'];
    const isWolf = player.role === '狼人';
    const victoryPrompt = `【胜利条件 - ${victoryModeInfo.name}】
${isWolf ? `狼人目标: ${victoryModeInfo.wolfGoal}` : `好人目标: ${victoryModeInfo.goodGoal}`}
策略提示: ${isWolf ? victoryModeInfo.wolfStrategy : victoryModeInfo.goodStrategy}`;

    const rolePoolConstraintPrompt = buildRolePoolConstraintPrompt(gameSetup);

    // 身份推理表提示
    const identityTablePrompt = previousIdentityTable
        ? `\n【你之前的身份推理表】\n${JSON.stringify(previousIdentityTable, null, 2)}\n请根据新信息更新推理表。`
        : IDENTITY_TABLE_PROMPT;

    return `你是[${player.id}号] ${player.name}，身份【${player.role}】。
⚠️ 你就是${player.id}号。发言中提到自己时用"我"，不要用"${player.id}号"来称呼自己。
【游戏状态】第${ctx.dayCount}天
【你的状态】存活
【场上存活】${ctx.aliveList}
【已死亡】${ctx.deadList}
${rolePoolConstraintPrompt}
${victoryPrompt}
${roleInfo}
${personaPrompt}
${roleStrategy}
${rules}
${TERMINOLOGY}
${identityTablePrompt}
${reflectionPrompt}
输出JSON（必须包含identity_table字段记录你的身份推理）`;
};

/**
 * 角色特定的白天发言提示词生成器
 * 每个角色根据其身份、信息量和策略目标有不同的发言模板
 */
const ROLE_DAY_SPEECH_PROMPTS = {
    '狼人': (ctx, params) => `${getBaseContext(ctx)}
【狼人专属任务】白天发言 - 你是一名伪装中的狼人

██ 铁律：thought 和 speech 是两个世界 ██
- thought 字段 = 你的内心独白（只有你能看到）。在这里自由分析局势、制定策略。
- speech 字段 = 你的公开发言（所有人听到）。这里必须100%像一个好人说话。
- speech 中绝对禁止出现：狼人、队友、刀、狼队、我方阵营、保狼、抗推 等任何狼人视角词汇。
- 如果你的 speech 让任何人读了之后能猜到你是狼，你就失败了。

【伪装原则】
- 你的发言应该和一个聪明的村民/神职完全一样：主动分析、有观点、敢站边。
- 好狼人 = 发言积极的好人。划水、沉默、被动防守才是最容易暴露狼人的行为。
- 不要总说"我再看看""信息不足""等更多人发言"——好人会主动分析并表态。

【当前最佳策略】（在 thought 中分析后选一个执行）
A. 主动踩人：找一个好人的发言破绽，指出逻辑漏洞，引导大家怀疑他。这是最安全也最有效的策略。
B. 站边混入：站边预言家或其他可信玩家，表现得像他的盟友，悄悄把票引向对你无害的方向。
C. 悍跳预言家：风险高但收益大。必须准备好完整的"查验故事"（第几夜验谁、为什么验、结果是什么）。
D. 制造对立：在两个好人之间制造矛盾（"X和Y的说法有冲突，我倾向信X"），消耗好人精力。

【如果你正在被怀疑/被查杀】
- 不要慌张、不要说"被查杀了？"——这是自证弱势。
- 反攻：质疑对方动机（"你为什么针对我？你的逻辑漏洞在哪里？"）
- 转移：立刻把话题引向第三方（"先不说我，X号的发言才更可疑"）
- 表现出好人被冤枉的愤怒，而不是狼人被抓的慌乱。

【思维链（在 thought 中完成，不要写进 speech）】
Step1: 场上谁在怀疑我？我暴露了吗？
Step2: 谁是最大威胁？（预言家/有信息的好人）
Step3: 我选策略A/B/C/D中的哪个？具体怎么执行？
Step4: 我的投票应该投谁？（对好人阵营伤害最大的选择）

输出JSON:{"thought":"狼人视角的完整策略分析（这里可以自由说狼人策略）","speech":"完全伪装为好人的公开发言(40-100字，绝不能有任何狼人视角)","voteIntention":数字或-1,"voteDecided":true或false,"identity_table":{"玩家号":{"suspect":"角色猜测","confidence":0-100,"reason":"推理依据"}}}
注意: voteDecided=true=已决定投谁(投票阶段直接用)；false=还需听完所有人再决定`,

    '预言家': (ctx, params) => {
        const myChecks = params.seerChecks?.filter(c => c.seerId === params.playerId) || [];
        const checksInfo = myChecks.length > 0
            ? myChecks.map(c => `N${c.night}:${c.targetId}号是${c.isWolf ? '【狼人】' : '【好人】'}`).join(', ')
            : '无查验记录';
        const goldWaters = myChecks.filter(c => !c.isWolf).map(c => c.targetId);
        const wolves = myChecks.filter(c => c.isWolf).map(c => c.targetId);

        // 只有12人局才有警徽流
        const hasPoliceFlow = isLargeGame(params.gameSetup);
        const policeFlowPoint = hasPoliceFlow ? '\n4. 安排警徽流（如果你可能被刀）' : '';
        const lastPointNumber = hasPoliceFlow ? '5' : '4';

        return `${getBaseContext(ctx)}
【预言家专属任务】白天发言 - 报验人/带节奏

【你的查验记录】${checksInfo}
${goldWaters.length > 0 ? `【金水(好人)】${goldWaters.join(',')}号 - 绝不能投他们！` : ''}
${wolves.length > 0 ? `【查杀(狼人)】${wolves.join(',')}号 - 必须推出！` : ''}

【预言家发言要点】
1. 第一时间报出所有查验结果——这是你最大的武器，不报等于浪费
2. 说清"心路历程"：第几夜验谁、为什么验他、结果如何。这是你区分真假预言家的核心证据
3. 有查杀就必须强势带票："X号是狼人，今天必须投他出局，否则我今晚大概率被刀"
4. 有金水就保护："Y号是好人，任何投Y号的行为都在帮狼人"
5. 如果有人对跳预言家，直接拆解他的逻辑漏洞${policeFlowPoint}
${lastPointNumber}. 你是好人阵营的指挥官，语气要坚定有力，不要犹豫

【思维链】
Step1: 我有什么查验信息必须报？（全部报出，不要藏）
Step2: 谁在质疑我？我怎么用证据反驳？
Step3: 今天必须投谁出局？（查杀 > 最可疑者）
Step4: 绝不能投金水！voteIntention 必须指向狼人或最可疑的人

输出JSON:{"thought":"预言家视角分析","speech":"报验人+坚定带票(40-100字)","voteIntention":数字(绝不能是金水号码!),"voteDecided":true或false,"identity_table":{"玩家号":{"suspect":"角色","confidence":0-100,"reason":"依据"}}}
注意: voteDecided=true=已决定；false=投票阶段再思考`;
    },

    '女巫': (ctx, params) => {
        const { witchHistory, hasWitchSave, hasWitchPoison } = params;
        const savedInfo = witchHistory?.savedIds?.length > 0 ? `救过:${witchHistory.savedIds.join(',')}号(银水)` : '';
        const poisonedInfo = witchHistory?.poisonedIds?.length > 0 ? `毒过:${witchHistory.poisonedIds.join(',')}号` : '';

        return `${getBaseContext(ctx)}
【女巫专属任务】白天发言 - 隐藏身份/关键时刻跳

【你的药水状态】解药:${hasWitchSave ? '有' : '无'} | 毒药:${hasWitchPoison ? '有' : '无'}
${savedInfo} ${poisonedInfo}

【你的实际行动记录——只有这些是真的，不要编造！】
${savedInfo ? `你确实救过: ${savedInfo}。你可以报银水证明身份。` : '你还没有救过任何人。不要声称你救过谁！'}
${poisonedInfo ? `你确实毒过: ${poisonedInfo}。` : ''}

【女巫发言策略】
1. 未跳身份前：像普通平民一样发言，分析局势，不暴露女巫身份
2. 跳身份时机：当你的银水/毒药信息能关键帮助好人判断时再跳
3. 跳身份必须基于事实：只能报你真正救过的人（见上方记录），绝不编造
4. 配合预言家：银水+金水可以锁定好人阵营

【思维链】
Step1: 我需要跳身份吗？跳身份的收益是什么？
Step2: 如果不跳，我应该像平民一样说什么？
Step3: 我的投票应该投谁？

输出JSON:{"thought":"女巫视角分析...","speech":"发言内容(40-80字)","voteIntention":数字或-1,"voteDecided":true或false,"identity_table":{"玩家号":{"suspect":"角色","confidence":0-100,"reason":"依据"}}}
注意: voteDecided=true表示已决定投谁；false表示需要投票阶段再思考`;
    },

    '猎人': (ctx, params) => `${getBaseContext(ctx)}
【猎人专属任务】白天发言 - 威慑狼人

【猎人发言策略】
1. 核心原则：你是好人阵营的"保险"——死了能带走一匹狼。活着时像村民一样分析。
2. 威慑使用：如果你被多人集火投票，可以暗示"你们确定要投我？"制造压力。不用说"我是猎人"，暗示就够了。
3. 主动分析：不要因为"有身份"就划水。你的分析和投票和村民一样重要。
4. 心中锁定：随时保持一个"如果我死了带走谁"的目标，并在 thought 中更新理由。

【思维链】
Step1: 我现在需要暴露猎人身份吗？（通常不需要，除非被集火）
Step2: 场上局势分析——谁在带节奏？谁的逻辑有漏洞？
Step3: 如果我死了，最应该带走谁？（在 thought 中记录，不要在 speech 中说）
Step4: 投票投谁？像一个有判断力的好人一样投票。

输出JSON:{"thought":"猎人视角分析（含开枪目标锁定）","speech":"像聪明村民的发言(40-100字)","voteIntention":数字或-1,"voteDecided":true或false,"identity_table":{"玩家号":{"suspect":"角色","confidence":0-100,"reason":"依据"}}}
voteDecided=true=已决定；false=投票阶段再思考`,

    '守卫': (ctx, params) => {
        const { guardHistory, lastGuardTarget } = params;
        const guardInfo = guardHistory?.length > 0
            ? guardHistory.map(g => `N${g.night}:守${g.targetId}号`).join(',')
            : '无守护记录';

        return `${getBaseContext(ctx)}
【守卫专属任务】白天发言 - 隐藏身份

【你的守护记录】${guardInfo}
${lastGuardTarget !== null ? `【注意】昨夜守了${lastGuardTarget}号，今晚不能连守` : ''}

【守卫发言策略】
1. 核心原则：你知道自己守了谁，但绝不能说出来。发言时完全像村民。
2. 利用信息：如果你守了某人，那人没死 → 你知道狼可能刀了别处。用这个逻辑推理，但不要暴露"我守了他所以他没死"。
3. 如果被怀疑：像被冤枉的村民一样反驳。不到万不得已不跳守卫。
4. 主动参与：你有守护信息的优势，用它来做更准确的分析，但表达方式像村民。

【思维链】
Step1: 基于我的守护记录，我能推断出什么？（在 thought 中分析，speech 中不提守护）
Step2: 场上局势——谁在攻击真预？谁在划水？
Step3: 我应该站边谁？我的分析是什么？
Step4: 投票投谁？

输出JSON:{"thought":"守卫视角分析...","speech":"像平民的发言(40-80字)","voteIntention":数字或-1,"voteDecided":true或false,"identity_table":{"玩家号":{"suspect":"角色","confidence":0-100,"reason":"依据"}}}
注意: voteDecided=true表示已决定投谁；false表示需要投票阶段再思考`;
    },

    '村民': (ctx, params) => `${getBaseContext(ctx)}
【村民专属任务】白天发言 - 主动分析找狼

【村民发言要求】
- 你是好人阵营的核心票数。你的分析和站边直接决定游戏胜负。
- 不要说"信息不足""先看看""等预言家"——这种发言对好人阵营零贡献，反而像狼人划水。
- 好村民应该：分析已有信息 → 给出自己的判断 → 明确站边或踩人。
- 每次发言必须有一个核心观点（"我认为X号可疑因为..."或"我站边Y号因为..."）。

【分析框架】
1. 预言家验证：场上有谁跳预言家？查验结果对不对得上？
2. 发言分析：谁的发言在制造混乱？谁在回避关键问题？谁在带节奏？
3. 投票一致性：谁的投票和发言矛盾？（说信A但投了B）
4. 动机推理：如果X是狼人，他的行为能解释吗？

【思维链】
Step1: 基于已有信息，我最怀疑谁？证据是什么？
Step2: 我信任谁？为什么？
Step3: 我的发言核心观点是什么？（必须明确）
Step4: 我投谁？（必须和观点一致）

输出JSON:{"thought":"分析过程","speech":"有观点有分析的发言(40-100字，必须包含明确的站边或踩人)","voteIntention":数字或-1,"voteDecided":true或false,"identity_table":{"玩家号":{"suspect":"角色","confidence":0-100,"reason":"依据"}}}
注意: voteDecided=true=已决定；false=投票阶段再思考`
};

/**
 * 获取基础上下文（所有角色共用）
 * 注意：所有历史记录都包含整局游戏的数据，而非每天刷新
 */
const getBaseContext = (ctx) => `第${ctx.dayCount}天${ctx.phase}。
【整局时间线】${ctx.fullGameTimeline || '游戏刚开始'}
【今日发言(不能重复)】
${ctx.todaySpeeches || '暂无'}

【历史发言摘要(整局)】
${ctx.historySpeeches || '暂无'}

【昨夜情况】${ctx.lastNightInfo}
【投票记录(整局)】${ctx.voteInfo}${ctx.identityAnalysis?.hints || ''}
${(() => {
    if (!ctx.spokenPlayerIds?.length) return '\n【⚠️ 时序提醒】你是第一个发言，不能评价任何人的发言！';
    const aliveIds = ctx.aliveIdsString ? ctx.aliveIdsString.split(',').map(Number) : [];
    const unspoken = aliveIds.filter(id => !ctx.spokenPlayerIds.includes(id));
    return `\n【⚠️ 时序提醒】已发言(${ctx.spokenPlayerIds.length}人): ${ctx.spokenPlayerIds.join('号,')}号。未发言(${unspoken.length}人): ${unspoken.map(id => id + '号').join(',')}。只能评价已发言玩家！`;
  })()}`;

export const generateUserPrompt = (actionType, gameState, params = {}) => {
    const ctx = prepareGameContext(gameState);
    const { players } = gameState;

    // 获取当前玩家角色（用于角色路由）
    const currentPlayer = params.currentPlayer || players.find(p => p.id === params.playerId);
    const playerRole = currentPlayer?.role || '村民';

    // Base context block included in most prompts
    const baseContext = `第${ctx.dayCount}天${ctx.phase}。
【今日发言(不能重复)】\n${ctx.todaySpeeches || '暂无'}\n
【历史发言摘要】\n${ctx.historySpeeches || '暂无'}\n
【昨夜情况】${ctx.lastNightInfo}\n
【历史死亡】${ctx.deathInfo.split(';')[1] || '无'}\n
【投票记录】${ctx.voteInfo}\n`;

    // 预先定义各类型的思维链模板，避免switch块作用域问题
    const cotTemplate = getCOTTemplate(PROMPT_ACTIONS.DAY_SPEECH);
    const nightCot = getCOTTemplate('NIGHT_ACTION');
    const voteCotTemplate = getCOTTemplate(PROMPT_ACTIONS.DAY_VOTE);

    switch (actionType) {
        case PROMPT_ACTIONS.DAY_SPEECH:
            // 使用角色特定的提示词生成器
            const rolePromptGenerator = ROLE_DAY_SPEECH_PROMPTS[playerRole] || ROLE_DAY_SPEECH_PROMPTS['村民'];

            // 构建角色特定参数
            const roleParams = {
                ...params,
                playerId: currentPlayer?.id,
                seerChecks: gameState.seerChecks || [],
                witchHistory: gameState.witchHistory || { savedIds: [], poisonedIds: [] },
                hasWitchSave: currentPlayer?.hasWitchSave,
                hasWitchPoison: currentPlayer?.hasWitchPoison,
                guardHistory: gameState.guardHistory || [],
                lastGuardTarget: gameState.nightDecisions?.lastGuardTarget,
                // 传递游戏配置用于区分6人局/8人局/12人局
                gameSetup: gameState.gameSetup
            };

            // 返回角色特定的提示词 + 结构化 claims schema（柱三）
            return rolePromptGenerator(ctx, roleParams) + CLAIMS_SCHEMA_SUFFIX;

        case PROMPT_ACTIONS.NIGHT_GUARD:
            const { cannotGuard } = params;
            const aliveStr = players.filter(p => p.isAlive).map(p => p.id).join(',');
            // P1渐进式披露：根据有无女巫调整首夜策略
            const guardExistingRoles = detectExistingRoles(players);
            let guardHint = '';
            if (ctx.dayCount === 1) {
                if (guardExistingRoles.hasWitch) {
                    guardHint = '【首夜策略】建议空守(null)避免同守同救触发规则。女巫首夜可能救人，你守护同一目标会导致目标死亡！';
                } else {
                    guardHint = '【首夜策略】没有女巫，不存在同守同救风险。可以直接守护你认为最关键的目标。';
                }
            }
            return `守卫守护选择。
${guardHint}
【存活玩家】${aliveStr}
${cannotGuard !== null ? `【禁止连守】不能守${cannotGuard}号(昨夜已守)` : ''}
${nightCot}
【守护策略】
- 优先守护：已跳身份的预言家 > 重要神职 > 高价值好人
- 博弈思考：狼人预判我会守谁？我该反其道还是稳守？
输出:{"targetId":数字或null(空守),"reasoning":"一句话理由","identity_table":{"玩家号":{"suspect":"角色","confidence":0-100,"reason":"依据"}}}`;

        case PROMPT_ACTIONS.NIGHT_MAGICIAN:
            const { validSwapTargets, magicianHistory, seerChecks: magicianSeerChecks } = params;
            const magicianExistingRoles = detectExistingRoles(players);

            // 分析场上已知信息
            const knownGods = [];
            const suspectedWolves = [];

            // 从发言历史和查验结果推断
            if (magicianSeerChecks && magicianSeerChecks.length > 0) {
                magicianSeerChecks.forEach(check => {
                    if (check.isWolf) {
                        suspectedWolves.push(check.targetId);
                    } else {
                        knownGods.push(check.targetId);
                    }
                });
            }

            // 使用角色模块的提示词生成器
            const magicianModule = getRoleModule('魔术师');
            return magicianModule.nightAction({
                validTargets: validSwapTargets,
                swappedPlayers: magicianHistory?.swappedPlayers || [],
                lastSwap: magicianHistory?.lastSwap || null,
                existingRoles: magicianExistingRoles,
                dayCount: ctx.dayCount,
                nightContext: nightCot,
                seerChecks: magicianSeerChecks || [],
                knownGods,
                suspectedWolves
            });

        case PROMPT_ACTIONS.NIGHT_WOLF:
             const validTargets = players.filter(p => p.isAlive && p.role !== '狼人').map(p => p.id).join(',');
             // P1渐进式披露：根据存在的角色动态生成刀法优先级
             const wolfExistingRoles = detectExistingRoles(players);
             const wolfPriorities = [];
             if (wolfExistingRoles.hasWitch) wolfPriorities.push('女巫(有毒药威胁)');
             if (wolfExistingRoles.hasSeer) wolfPriorities.push('预言家(信息源)');
             if (wolfExistingRoles.hasGuard) wolfPriorities.push('守卫(保护者)');
             if (wolfExistingRoles.hasHunter) wolfPriorities.push('猎人(有枪)');
             wolfPriorities.push('村民');
             const wolfPriorityStr = wolfPriorities.join(' > ');

             // 根据存在的角色生成策略提示
             const wolfStrategyHints = ['根据白天发言抿神职：谁像预言家？谁像女巫？谁在保护谁？'];
             if (wolfExistingRoles.hasGuard) {
                 wolfStrategyHints.push('考虑守卫博弈：守卫可能守谁？是否需要声东击西？');
             }

             return `狼人袭击决策。
【可袭击目标】${validTargets}
${nightCot}
【刀法策略】
- 优先级：${wolfPriorityStr}
${wolfStrategyHints.map(h => `- ${h}`).join('\n')}
输出:{"targetId":数字,"reasoning":"选择理由","identity_table":{"玩家号":{"suspect":"角色","confidence":0-100,"reason":"依据"}}}`;

        case PROMPT_ACTIONS.NIGHT_SEER:
             const { validTargets: seerTargets } = params;
             return `预言家查验决策。
【可查验目标】${seerTargets?.join(',') || '无'}
${nightCot}
【查验策略】
- 查验优先级：焦点位(发言模糊/煽动性强) > 定点位(能关联多条逻辑链)
- 信息价值：查谁能提供最大信息增量？
- 避免浪费：不查已有明确身份倾向的玩家
输出:{"targetId":数字,"reasoning":"查验理由"}`;

        case PROMPT_ACTIONS.NIGHT_WITCH:
             const { dyingId, canSave, hasPoison, witchId } = params;
             const witchHint = ctx.dayCount === 1 ? '【首夜策略】通常使用解药救人。⚠️ 重要：第一晚女巫可以自救（如果自己被刀）！' : '';
             const witchInfo = `被刀:${dyingId !== null ? dyingId + '号' : '无人被刀(平安夜)'}。解药:${canSave ? '可用' : '已用/无'}。毒药:${hasPoison ? '可用' : '已用/无'}。`;

             // 构建临界情况引导（不直接告知数量，引导推理）
             const criticalGuidance = `\n\n⚠️【临界情况推理】
请根据以下信息自己推断当前局势：
1. 回顾【整局时间线】和【历史死亡】，推断目前存活的好人和狼人大概各有多少
2. 结合预言家的查验记录（金水/查杀），缩小推断范围
3. 判断：如果${dyingId === witchId ? '你死了' : '不救人'}，明天好人是否还占优势？
4. 判断：如果再死一个好人，是否会导致好人数≤狼人数（直接输）？

【临界决策思维链】
- 如果推断出"再死一个好人就会输"：
  → 第1步：如果你被刀，必须自救！
  → 第2步：如果预感下一晚你会被刀且你有毒药，必须开毒！选择你最怀疑的狼人
- 如果推断出"好人还有优势"：
  → 按照常规策略，谨慎使用毒药`;

             return `女巫用药决策。
${witchHint}
【当前情况】${witchInfo}
【重要规则】不能同时使用两药！${criticalGuidance}
${nightCot}
【用药策略】
- 解药考量：被刀者是否为关键神职？是否可能是自刀狼？救人收益vs保留价值？
- 毒药考量：只有高度确信某人是狼且逻辑完全崩坏时才考虑开毒
- 风险评估：毒错好人会导致阵营崩盘
- 临界决策：在危急时刻，保守会导致失败，必须果断出手
输出:{"useSave":true/false,"usePoison":数字或null,"reasoning":"决策理由(必须包含你的推断：当前大概还剩X好人Y狼人)"}`;

        case PROMPT_ACTIONS.NIGHT_DREAMWEAVER: {
             const { dreamHistory, lastDreamTarget: dwLastTarget, aliveTargets: dwAliveTargets } = params;
             const dwExistingRoles = detectExistingRoles(players);

             // 构建入梦历史提示
             const dwHistoryText = dreamHistory?.dreamedPlayers?.length > 0
                 ? `已被你入梦过的玩家：${dreamHistory.dreamedPlayers.join(',')}号`
                 : '无人被入梦过';
             const dwWarning = dwLastTarget !== null
                 ? `\n⚠️【连梦警告】你昨晚入梦了 ${dwLastTarget}号！如果今晚再次入梦TA，TA将直接死亡（无法被救）！`
                 : '';

             // 根据有无特定角色调整策略提示
             const dwStrategyHints = [];
             if (dwExistingRoles.hasSeer) {
                 dwStrategyHints.push('- 防御模式：可入梦真预言家，但绝不能连续两晚入梦同一人');
             }
             if (dwExistingRoles.hasWitch) {
                 dwStrategyHints.push('- 避免入梦女巫：你死时会连带女巫出局，损失过大');
             }
             if (dwExistingRoles.hasHunter) {
                 dwStrategyHints.push('- 避免入梦猎人：你死时连带猎人，无法开枪');
             }
             dwStrategyHints.push('- 进攻模式：对高度怀疑的狼人进行"连梦击杀"（确信度≥75%）');
             dwStrategyHints.push('- 殉情模式：预感自己会死时，入梦铁狼，同归于尽');

             return `摄梦人入梦决策。
${dwWarning}
【入梦历史】${dwHistoryText}
【上一晚入梦】${dwLastTarget !== null ? `${dwLastTarget}号` : '无'}
【可入梦目标】${dwAliveTargets?.join(',') || '无'}号（不能入梦自己）

【核心机制提醒】
✦ 免疫效果：被入梦者当晚免疫狼刀和毒药
✦ 连梦必死：连续两晚入梦同一人 → 该人直接死亡（无法被救）
✦ 同生共死：你若死亡，被入梦者也一同出局

【策略提示】
${dwStrategyHints.join('\n')}
${nightCot}
【思维链】
Step1: 场上谁是核心好人？谁是狼头？
Step2: 我昨晚梦了谁？今晚是否需要换目标？
Step3: 狼人今晚会刀我吗？我是否暴露？
Step4: 选择决策模式：防御/进攻/殉情
Step5: 确定入梦目标

输出JSON:{"dreamTarget":数字(必选，不能为null不能为自己),"dreamMode":"defense/offense/sacrifice","dreamReason":"入梦理由(20-40字)","isConsecutiveDream":true/false,"confidence":0-100,"thought":"思考过程"}`;
        }

        case PROMPT_ACTIONS.DAY_VOTE:
             const { validTargets: voteTargets, seerConstraint, lastVoteIntention } = params;
             const intentionReminder = lastVoteIntention && lastVoteIntention !== -1
                 ? `你刚才在发言中表示想投 ${lastVoteIntention} 号。`
                 : (lastVoteIntention === -1 ? '你刚才在发言中表示暂不表态/弃票。' : '');

             return `投票放逐阶段。
【存活可投】${voteTargets.join(',')}号(不能投自己)，或选择-1弃票。
${intentionReminder}
${seerConstraint || ''}
${voteCotTemplate}

【投票逻辑推演】
1. 回顾你的发言意向（${lastVoteIntention === -1 ? '弃票' : lastVoteIntention || '无'}），保持言行一致，除非有突发情况。
2. 分析场上局势，如果是好人，确保不分票；如果是狼人，计算冲票收益。
3. 预言家注意：绝不能投给自己验过的金水！
4. 如果信息不足无法判断，可以选择弃票(-1)，但这可能导致流票。

⚠️ targetId = 你想投票【淘汰/出局】的人（即你认为是狼的人或最可疑的人）。不是你"支持"或"站边"的人！

输出JSON格式:
{"reasoning":"一句话分析(如:言行一致投X，或 听了Y发言觉得更像狼改投Y，或 信息不足选择弃票)","targetId":数字或-1,"thought":"投票最终思考"}`;

        case PROMPT_ACTIONS.HUNTER_SHOOT:
             const { aliveTargets, hunterContext } = params;
             // P1渐进式披露：根据存在的角色动态生成开枪策略
             const hunterExistingRoles = detectExistingRoles(players);
             const hunterStrategies = [];
             if (hunterExistingRoles.hasSeer) {
                 hunterStrategies.push('优先带走被预言家"查杀"的玩家');
             }
             hunterStrategies.push('次选悍跳预言家(假预言家)');
             hunterStrategies.push('再选发言最像狼/划水/倒钩的玩家');
             if (hunterExistingRoles.hasSeer) {
                 hunterStrategies.push('绝不带走金水/银水/真预言家');
             } else {
                 hunterStrategies.push('绝不带走确认的好人');
             }

             return `你是猎人(好人阵营)，死亡时必须开枪带走一名玩家！
【重要规则】猎人死亡时必须开枪，不能选择不开枪！你必须从下方目标中选择一个带走。
【存活可选】${aliveTargets.join(',')}号
${hunterContext || ''}
【开枪策略】优先带走最可疑的狼人
${hunterStrategies.map((s, i) => `${i + 1}. ${s}`).join('\n')}
输出JSON:{"shoot":true,"targetId":必须是数字(从存活可选中选择),"reason":"一句话理由"}`;

        case PROMPT_ACTIONS.SUMMARIZE_CONTENT:
             const { content, maxLength = 50 } = params;
             return `请将以下内容精简摘要为不超过${maxLength}字的核心要点：
"${content}"
输出JSON:{"summary":"摘要内容"}`;

        default:
            return `任务: ${actionType}`; 
    }
};
