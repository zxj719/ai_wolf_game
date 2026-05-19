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

⚠️ 只填你有分析依据的玩家。对尚未发言且无任何线索的玩家，不要填到推理表里——与其猜"30%村民"不如不写。
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
- 我这轮应该采取什么策略？（踩人/站边/跳身份/反驳/带节奏）
- 这个策略对我的阵营有什么收益？

Step5-投票决策（最重要）：
- ⚠️ 查杀检查：场上有没有已验证的预言家报了查杀？如果有，我必须投查杀目标！
- 如果我想投别人（比如觉得某人"可疑"），问自己：投他比投查杀目标更好吗？几乎不可能。
- 投票目标：X号 | 发言重点：简述`,

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
4. 一致性检查：我的发言/投票是否与之前立场矛盾？（言行不一致是被抓的最大漏洞）
5. 查杀对齐：场上有已验证的预言家查杀吗？我的投票是否和查杀一致？
※ 发现问题请在thought中修正后再输出speech`;

export const getAdversarialReflection = () => ADVERSARIAL_REFLECTION;

// ============================================================
// 原有策略系统（保留兼容性，整合到人格系统中）
// 根据局数配置动态调整策略提示
// ============================================================
const STRATEGIES = {
    '狼人': (isFirstDay, nightNum, player, gameSetup) => {
        const wolfCount = (gameSetup?.STANDARD_ROLES || []).filter(r => r === '狼人').length;
        if (isMiniGame(gameSetup)) {
            return `【狼人策略】伪装为好人，投出关键好人。深水潜伏是默认最优（博弈论证明），也可悍跳预言家。刀法:女巫>预言家>村民。被怀疑时像好人一样反击。`;
        }
        return `【狼人策略】伪装为好人，投出关键好人。深水潜伏是统计最优策略。可悍跳预言家或倒钩（投队友坐高身份）。被怀疑时坚持伪装反击。${wolfCount <= 1 ? '独狼局：伪装比冲票更重要。' : ''}`;
    },
    '预言家': (isFirstDay, nightNum, player, gameSetup) => {
        const hasPolice = isLargeGame(gameSetup);
        if (isFirstDay) {
            return `【预言家策略】8人局通常首轮跳身份报验人（研究表明信息公开对好人有利）。说清心路历程建立公信力。有查杀强势带票。`;
        }
        if (hasPolice) {
            return `【预言家策略】继续报验人。号召全票放逐狼人。安排警徽流。`;
        }
        return `【预言家策略】继续报新验人，维护查验链。号召好人集中投查杀目标。`;
    },
    '女巫': (isFirstDay, nightNum, player, gameSetup) => {
        const shouldSave = nightNum <= 2 && player.hasWitchSave;
        return `【女巫策略】${shouldSave ? '前期已救人(银水可跳身份报)。' : ''}首夜救人是竞技共识（收益>保留）。毒药谨慎用，毒错好人会崩盘。未跳身份前像村民发言。`;
    },
    '猎人': (isFirstDay, nightNum, player, gameSetup) => `【猎人策略】死亡必开枪！优先带走：被查杀的狼>悍跳狼>最可疑者。活着时像村民分析，不轻易暴露。`,
    '守卫': (isFirstDay, nightNum, player, gameSetup) => `【守卫策略】${nightNum === 1 ? '首夜空守（竞技共识：防同守同救医疗事故）。' : '后续夜优先守预言家。'}低调隐藏身份，发言像村民。不要分析平安夜机制。`,
    '村民': (isFirstDay, nightNum, player, gameSetup) => `【村民策略】好人阵营票数主力。敢于站边、分析发言找狼。有查杀时跟投，不弃票。接金水不反水。`
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
    ? '- 你是首个发言，场上还没有人说话。简要点评昨夜结果，然后提出一个分析方向（但不要过度猜测机制原因如"女巫救了谁"）。你的发言会设定后续讨论方向，所以要有实质内容。不要凭空捏造他人的发言！'
    : '- 怀疑1-2名已发言玩家并给出理由。不要开上帝视角，基于发言和行为推理。';

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
1. 查重检查：首先检查【今日发言】，绝对不能重复别人的观点或问题。如果前面所有人都在讨论同一个话题，你必须引入新的分析角度（换一个玩家分析、提出新假设、关注不同的行为）。
2. 夜间情报：如果有夜间信息(查验/刀口/守护)，必须第一时间报出来。【预言家】若验了好人，必报"X号是金水"，且【投票意向】不能投给金水！
3. 信息时效：如果预言家已死，不要再讨论他的查验（除非回顾逻辑）。
4. 动机分析：怀疑某人时，必须分析其"狼人动机"（收益论）。
5. 有效互动：可点名【存活】玩家解释【历史发言】。严禁评价【未发言】内容。
6. 低信息应对：若信息少，可简单站边或分析已有发言。⚠️ 不要分析平安夜的机制原因（"女巫救了""守卫守对了"等）——除非你是女巫/守卫且选择跳身份，否则这种分析暴露你知道夜间机制。
7. 【投票意向】：voteIntention = 你想投票淘汰的人。
   - 场景A：预言家已验证（之前的查杀被投票证实是狼）→ 他新报的查杀是第一优先级，除非有极强证据证明他是悍跳狼，否则必须跟查杀走。好人分票 = 帮狼人。
   - 场景B：预言家未验证（首次查杀或对跳）→ 需要综合分析查杀逻辑、心路历程、其他人的站边。不能盲信，也不能忽视。
   - 场景C：有两个预言家对跳 → 分析谁的查验更合理，选择站边一方。
   - 信息不足且无查杀时可输出-1弃票，但有明确查杀时不要轻易弃票。
8. 【禁止消极等待话术】以下表述及其变体一律禁止：
   - "先不急着站队/表态" "等更多信息" "先听听后面的人" "先观察再判断" "我再看看"
   - 这些表述对好人阵营零贡献。每次发言必须有一个明确观点（支持谁/质疑谁/分析什么）。
   - 如果确实信息少（如首发言），可以说"我倾向认为X号可疑"而不是"我没信息先等等"。
9. 记忆与状态约束：
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
/**
 * 从结构化 claimHistory 分析身份声明（精确版，无误报）
 */
const analyzeStructuredClaims = (claimHistory, gameSetup) => {
    const claimsByType = { seer: [], witch: [], hunter: [], guard: [] };
    const typeMap = {
      jump_seer: 'seer', jump_witch: 'witch', jump_hunter: 'hunter', jump_guard: 'guard'
    };
    claimHistory.forEach(c => {
      const bucket = typeMap[c.type];
      if (bucket && !claimsByType[bucket].includes(c.playerId)) {
        claimsByType[bucket].push(c.playerId);
      }
    });

    const gameRoles = gameSetup?.STANDARD_ROLES || [];
    const hints = [];
    const roleCountMap = { seer: '预言家', witch: '女巫', hunter: '猎人', guard: '守卫' };

    Object.entries(claimsByType).forEach(([key, playerIds]) => {
      if (playerIds.length === 0) return;
      const roleName = roleCountMap[key];
      const count = gameRoles.filter(r => r === roleName).length;
      if (playerIds.length === 1 && count === 1) {
        hints.push(`⚠️ 只有${playerIds[0]}号跳${roleName}，大概率是真${roleName}（本局只有1个）`);
      } else if (playerIds.length > count) {
        hints.push(`⚠️ ${playerIds.join(',')}号跳${roleName}，但本局只有${count}个，必有悍跳`);
      }
    });

    return { hints: hints.length > 0 ? '\n' + hints.join('\n') : '' };
};

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
    const { players, speechHistory, voteHistory, deathHistory, dayCount, phase, gameSetup, claimHistory } = gameState;
    const alivePlayers = players.filter(p => p.isAlive);
    const aliveList = alivePlayers.map(p => `${p.id}号`).join(',');
    const deadList = players.filter(p => !p.isAlive).map(p => `${p.id}号`).join(',') || '无';

    // 分析身份声明：优先使用结构化 claimHistory（精确），降级到关键词匹配（可能误报）
    const identityAnalysis = (Array.isArray(claimHistory) && claimHistory.length > 0)
      ? analyzeStructuredClaims(claimHistory, gameSetup)
      : analyzeIdentityClaims(speechHistory, gameSetup);

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
⚠️ 你就是${player.id}号 ${player.name}。发言中提到自己时用"我"，不要用第三人称称呼自己（如"${player.id}号"或"${player.name}"），也不要在speech里提到"先观察${player.id}号"这种引用自己的话。
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

【伪装原则（基于博弈论研究）】
- 学术研究表明：深水潜伏（像正常村民发言）在统计上优于激进悍跳。但完全沉默也会被怀疑。
- 最优伪装 = 发言量和内容都像一个"普通但认真参与的好人"——不需要最出彩，但要自然。
- 根据局势动态选择策略，不要固守一种打法。

【策略选择】（在 thought 中分析局势后选一个执行）
A. 深水策略（默认推荐）：像普通村民一样分析，跟着场上多数观点走，不引人注意。博弈论证明这是狼人的基础最优策略。
B. 主动踩人：找好人的发言破绽引导怀疑。当你需要"做身份"（让自己看起来像好人）时使用。
C. 站边混入：站边可信玩家（甚至可以站边真预言家），把票引向无害方向。
D. 悍跳预言家：风险最高但收益最大。需要完整"查验故事"。通常在狼人人数不利时使用。
E. 倒钩/出卖队友：如果队友已暴露或即将出局，投他来坐高自己身份。这是高级策略。

【如果你正在被怀疑/被查杀】
- 不要慌张、不要说"被查杀了？"——这是自证弱势。
- 反攻：质疑对方动机（"你为什么针对我？你的逻辑漏洞在哪里？"）
- 转移：立刻把话题引向第三方（"先不说我，X号的发言才更可疑"）
- 表现出好人被冤枉的愤怒，而不是狼人被抓的慌乱。

【思维链（在 thought 中完成，不要写进 speech）】
Step1: 场上局势——存活狼人数 vs 好人数？接近临界点（狼≥好人）吗？
Step2: 谁在怀疑我？我暴露了吗？谁是最大威胁？
Step3: 策略选择：如果远离临界点→深水伪装；如果接近临界点→考虑冲票（博弈论 all-in：狼队集中投同一个好人制造平票或多数）
Step4: 投票：分析票型，选最不暴露的操作。被查杀时可反投预言家也可投其他人制造混乱。

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

【预言家发言要点（基于博弈论+竞技经验）】
1. 报验时机：8人局通常首轮报验（建立信息锚点），但如果场上已有其他人跳预言家，需要选择更有利的时机
2. 心路历程是核心：第几夜验谁、为什么验他、验出什么。这是区分真假预言家的关键——好的心路历程让好人相信你
3. 有查杀强势带票："X号是狼人，今天必须投他出局"。研究表明公开信息后集中投票是好人最优策略
4. 有金水就保护："Y号是好人，投Y号 = 帮狼人"
5. 对跳预言家：拆解对方逻辑漏洞，用你的查验记录建立公信力${policeFlowPoint}
${lastPointNumber}. 语气要坚定果断——预言家是好人阵营的信息源，犹豫不决会让好人失去信心

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
1. 未跳身份前：像普通平民一样发言，不暴露女巫身份
2. ⚠️ 不要过度保护你的银水！如果别人质疑你救过的人，用逻辑反驳而不是"无条件保护"——这种偏袒会暴露你知道某人的身份
3. 跳身份时机：当你的银水信息能关键帮助好人判断时再跳
4. 跳身份必须基于事实：只能报你真正救过的人（见上方记录），绝不编造
5. 配合预言家：银水+金水可以锁定好人阵营

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
2. ⚠️ 不要分析平安夜的机制（"女巫救了""守卫守对了"）——普通村民不会这样说。只说"平安夜，信息有限"就够了。
3. 威慑使用：被集火时暗示"你们确定要投我？"不直接说猎人。
4. 主动分析：不要划水。直接分析已发言玩家的行为逻辑。
5. 心中锁定：保持"如果我死了带走谁"的目标（thought 里记，不在 speech 说）。

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
1. 核心原则：你知道自己守了谁，但绝不能说出来。发言时完全像一个普通村民。
2. ⚠️ 不要分析平安夜的机制原因（"女巫救了""守卫守对了"）——这种分析暴露你对夜间机制的了解，好村民不会这样说。
3. 利用信息但隐藏来源：如果你守了某人且那人没死，你可以推理"可能狼刀了别处"，但不要说"所以是守卫守的"。
4. 如果被怀疑：像普通村民一样反驳。不到万不得已不跳守卫。
5. 简短发言：守卫说太多分析性内容容易暴露。40-60字就够，重点是站边和投票。

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
Step4: 我投谁？（必须和观点一致。如果有查杀信息，投查杀目标！不要弃票——弃票=放弃好人的票权=帮狼人。）

输出JSON:{"thought":"分析过程","speech":"有观点有分析的发言(40-100字，必须包含明确的站边或踩人)","voteIntention":数字或-1,"voteDecided":true或false,"identity_table":{"玩家号":{"suspect":"角色","confidence":0-100,"reason":"依据"}}}
voteDecided=true=已决定；false=投票阶段再思考。⚠️ 有查杀信息时尽量填true并投查杀目标。`
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
  })()}${ctx.currentPlayerTraits ? `\n【你的发言风格】${ctx.currentPlayerTraits} 用这个风格说话，不要和其他人发言风格一样。` : ''}`;

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
            // 注入当前玩家的个性特征到 ctx，用于 getBaseContext 里的发言风格提醒
            ctx.currentPlayerTraits = currentPlayer?.personality?.traits || '';
            ctx.currentPlayerName = currentPlayer?.name || '';
            ctx.currentPlayerId = currentPlayer?.id;

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
            const guardSubsequentHint = ctx.dayCount > 1 && !guardHint
              ? `【后续夜策略（竞技经验）】
- 核心：已跳身份的预言家是最高守护目标。竞技共识：狼人残局必刀预言家断信息链
- 博弈：如果守了预言家且他没死，次日平安夜=双重验证（真预+守对了）
- 昨晚守的人没死？可能狼刀别处，今晚换守或反向博弈
- 昨晚守的人死了？守错了，重新判断谁是狼的首选刀口
- 空守：不确定时空守比守错强（守错可能暴露守卫认知）`
              : '';

            return `守卫守护选择。
${guardHint}${guardSubsequentHint}
【存活玩家】${aliveStr}
${cannotGuard !== null ? `【禁止连守】不能守${cannotGuard}号(昨夜已守)` : ''}
${nightCot}
【守护优先级】已跳身份的预言家 > 重要神职 > 被狼针对的好人
输出:{"targetId":数字或null(空守),"reasoning":"一句话理由","thought":"守护思考过程","identity_table":{"玩家号":{"suspect":"角色","confidence":0-100,"reason":"依据"}}}`;

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

             const isWolfFirstNight = ctx.dayCount === 1;
             const wolfNightGuide = isWolfFirstNight
               ? `【首夜刀法】第一夜没有发言信息。策略：
- 刀神职位：边角座位或中间座位（统计上神职分布较集中）
- 避开队友附近：不要刀队友旁边的人（容易被怀疑"自刀"假象）
- 赌博式刀法：猜测谁像预言家/女巫并直接刀掉`
               : `【后续刀法】根据白天发言分析：
- 刀预言家：如果能确定谁是真预，优先刀掉（断好人信息链）
- 刀女巫：如果女巫还有毒药，刀掉她消除威胁
- 避开猎人：猎人死亡会开枪带走一人，刀他不划算（除非迫不得已）
- 刀投票威胁：谁在投票时对你们阵营威胁最大？`;

             return `狼人袭击决策。
【可袭击目标】${validTargets}号
${nightCot}
【刀法优先级】${wolfPriorityStr}
${wolfNightGuide}
${wolfStrategyHints.map(h => `- ${h}`).join('\n')}
输出:{"targetId":数字(必须从可袭击目标中选),"reasoning":"选择理由","thought":"刀法思考过程","identity_table":{"玩家号":{"suspect":"角色","confidence":0-100,"reason":"依据"}}}`;

        case PROMPT_ACTIONS.NIGHT_SEER:
             const { validTargets: seerTargets } = params;
             const isFirstNight = ctx.dayCount === 1;
             const seerNightStrategy = isFirstNight
               ? `【首夜策略】第一夜没有发言信息，选择查验策略：
- 边角位策略：查 0号 或最后一号（统计上狼人密度略高）
- 随机策略：随机选一个目标，开局建立信息锚点
- 关键位策略：查中间座位（发言影响力大的位置）
无论选谁，明天发言要说清"心路历程"——为什么查这个人。`
               : `【后续夜策略】你已经有了发言信息，根据白天的分析选目标：
- 最可疑优先：白天发言最可疑的未验证玩家
- 排除法：验证你怀疑的人是狼还是好人
- 信息增量：查谁能解开最多的身份链条？`;
             return `预言家查验决策。
【可查验目标】${seerTargets?.join(',') || '无'}号
${nightCot}
${seerNightStrategy}
输出:{"targetId":数字,"reasoning":"查验理由","thought":"查验思考过程"}`;

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
输出:{"useSave":true/false,"usePoison":数字或null,"reasoning":"决策理由(必须包含你的推断：当前大概还剩X好人Y狼人)","thought":"用药思考过程"}`;

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
1. 回顾你的发言意向（${lastVoteIntention === -1 ? '弃票' : lastVoteIntention || '无'}），保持言行一致，除非有新信息改变判断。
${playerRole === '狼人'
  ? `2. 【狼人投票策略】不要直投预言家（暴露敌意）。默认跟着场上多数票方向走来伪装。高级策略：可以投自己的队友（倒钩）来坐高自己身份——如果队友已被查杀或即将出局，投他反而能让你看起来像"正确投了狼的好人"。`
  : playerRole === '预言家'
  ? `2. 【预言家投票策略】投你查杀的狼人！绝不投金水。带领好人集中票型。`
  : `2. 【投票策略】如果预言家已验证且报了查杀，投查杀目标！好人集中票型不分票。`}
3. 如果信息不足无法判断，可以选择弃票(-1)，但这可能导致流票。有查杀时尽量不弃票。

⚠️ targetId = 你想投票【淘汰/出局】的人。不是你"支持"的人！
⚠️ 如果预言家已被验证（之前查杀被证实是狼），投他新报的查杀目标！分票=帮狼人。如果预言家未验证或有对跳，综合分析再决定。

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
【开枪策略——按优先级从高到低】
${hunterStrategies.map((s, i) => `${i + 1}. ${s}`).join('\n')}

⚠️ 带走好人 = 帮狼人。如果上面有【查杀】信息，必须优先带走被查杀的狼人。如果有【金水】信息，绝对不能带走那些人。
输出JSON:{"shoot":true,"targetId":必须是数字(从存活可选中选择),"reason":"一句话理由","thought":"开枪决策思考过程"}`;

        case PROMPT_ACTIONS.SUMMARIZE_CONTENT:
             const { content, maxLength = 50 } = params;
             return `请将以下内容精简摘要为不超过${maxLength}字的核心要点：
"${content}"
输出JSON:{"summary":"摘要内容"}`;

        default:
            return `任务: ${actionType}`; 
    }
};
