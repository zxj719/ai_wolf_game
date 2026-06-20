// Consolidated Prompt Engineering Service
// This module manages ALL context construction for the AI agents.
// It separates System Prompts (Personality, Global Rules) from User Prompts (Tasks).
// Enhanced with: Role Personas, Chain-of-Thought, Adversarial Reflection (P0 Optimization)
// P1 Enhancement: Progressive Disclosure - Role-specific modules with conditional content

// 导入渐进式披露架构
import {
    detectExistingRoles,
    getRoleModule,
    getBaseContext
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
    LAST_WORDS: 'LAST_WORDS',
    SHERIFF_RUN: 'SHERIFF_RUN',
    SHERIFF_SPEECH: 'SHERIFF_SPEECH',
    SHERIFF_VOTE: 'SHERIFF_VOTE',
    SHERIFF_BADGE_PASS: 'SHERIFF_BADGE_PASS',
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
        archetype: '博弈者',
        speechStyle: '灵活多变，适应场上局势，表演自然',
        coreGoal: '最大化狼队存活概率——每次发言、投票、夜间行动都服务于这个目标',
        thinkingDimensions: [
            '信息差利用：你知道谁是狼人，好人不知道——利用这个信息差干扰好人判断',
            '行动空间：发言中可以声明任何身份、质疑他人、站边拉票——评估每个行动的收益/风险',
            '信任经济：好人之间的信任是有限资源，你消耗的信任越多好人判断越困难',
            '威胁评估：根据发言分析谁最可能是神职，评估消灭vs欺骗的收益'
        ],
        priorities: ['最大化狼队胜率', '控制信息流', '消耗好人信任', '隐藏身份'],
        taboos: ['暴露狼队信息', '逻辑自相矛盾'],
        signalGameTips: '你的信息优势是最大的武器——好人不知道谁是狼，你可以在信息流中注入干扰'
    },
    '预言家': {
        archetype: '真理守护者',
        speechStyle: '强势果断，逻辑清晰，公信力至上',
        coreGoal: '建立公信力，带领好人找出狼人',
        thinkingDimensions: [
            '查验优先级：① 悍跳响应（验证对跳报告） ② 多路汇聚目标 ③ 投票争议关键位 ④ 信任链延伸 ⑤ 行为异常兜底',
            '警徽流决策：如果被刀，警徽交给谁能传递最清晰的信号？',
            '戳穿悍跳（白天执行三步法）：① 主动公开查验记录建立信息链 ② 找对方报告的矛盾点（金水/查杀是否冲突）③ 用心路历程的有无定胜负——悍跳狼只有结果，没有合理的查验决策逻辑',
            '心路历程：我的查验选择是否有合理的信息链依据可以解释？'
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
            '解药逻辑：救人的期望收益是否大于保留解药的防御价值？（首夜有守卫时需考虑同守同救风险）',
            '毒药逻辑：只有当某人逻辑完全崩坏时才考虑开毒',
            '轮次平衡：当前轮次用药是否划算？后续还有几轮？',
            '身份隐藏：在解药使用前，如何伪装成普通平民？'
        ],
        priorities: ['保护关键神职', '精准使用毒药', '隐藏身份', '关键时刻跳身份'],
        taboos: ['同一晚又救又毒', '盲毒（逻辑不充分时用毒）', '过早暴露身份', '浪费解药救狼'],
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

    // 投票的链式思考（竞技核心：提前算票）
    DAY_VOTE: `
【投票思维链】
1. 回顾发言意向：有新信息改变判断吗？查杀信息是否已验证？
2. 算票（竞技关键）：场上谁已表态投谁？如果我投X，能形成多数吗？好人分票=帮狼人
3. 查杀检查：场上有已验证查杀吗？有→投查杀目标！除非有极强理由不跟
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
        return `【狼人策略】你的核心优势是信息不对称——你知道谁是狼人，好人不知道。利用这个信息差干扰好人的判断。发言、投票、角色声明都是你的工具——在thought中分析每个行动的收益/风险比，选择最优行动。${wolfCount <= 1 ? '独狼局：伪装质量是生存的关键。' : ''}`;
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
    '狼人': (ctx, params) => {
        let wolfTeammatesHint = '';
        if (params.wolfTeammates?.length > 0) {
            const totalWolves = params.wolfTeammates.length + 1;
            const aliveCount = ctx.aliveList ? ctx.aliveList.split(',').length : 0;
            const isLateGame = aliveCount > 0 && aliveCount <= totalWolves * 2 + 1;
            // Wang 2025: role differentiation is the key multi-agent deception mechanism
            const roleDiv = totalWolves === 2
                ? `\n【2狼角色分化（竞技 meta）】先开口的狼担任【主动方】：质疑特定好人、带动话题方向；后开口的担任【低调方】：扮中立分析者，用"我也在观察"语气保留信任度、不主动跳身份。⚠️ 两狼绝不能同时强推同一目标——强推相同目标是协作关系曝光的第一信号`
                : `\n【多狼角色分化（${totalWolves}狼）】激进狼(1名)：直接指控好人、占讨论主动权，让好人精力消耗在争辩上；分析狼(其余)：装好人评委并"对激进狼判断略有保留"——让好人误判为真实分歧而非串供；多狼同时追杀同一目标会同步暴露`;
            const lateHint = isLateGame
                ? `\n【残局(${aliveCount}人/${totalWolves}狼)】重心从角色声明转为票型精算：每票落点不能打到队友；若被质疑无法脱身，抢先指控第三方好人转移焦点`
                : '';
            wolfTeammatesHint = `\n【多狼协作——白天发言规则】存活队友：${params.wolfTeammates.join(',')}号${roleDiv}${lateHint}\n- 立场分散：如果队友已站边某人，你要对那人保持中立或轻度质疑——两狼同步支持同一好人是关系暴露的头号原因\n- 投票错位：在thought中预演票型，避免和队友同时指向同一人（两票同向是好人发现关系链的强信号）\n- 制造分歧感：在某细节上和队友立场有轻微差异，让好人误认为你们不是同阵营`;
        }
        return `${getBaseContext(ctx)}
【狼人专属任务】白天发言 — 最大化狼队胜率
${wolfTeammatesHint}
██ 铁律：thought 和 speech 是两个世界 ██
- thought = 你的完整策略推演（只有你能看到），自由分析局势、推理、规划
- speech = 公开发言（所有人听到），必须100%以好人视角写就：只谈发言分析、怀疑依据、投票逻辑
  · 不暴露你拥有的私有信息（谁是队友、你的夜间行动计划）
  · 不要跳出游戏角色评论游戏本身

【你的信息优势】
你知道谁是狼谁是好人。好人不知道。
好人正在通过发言、投票和角色声明来推断每个人的身份——你可以在这些信息流中制造对狼队有利的干扰。

【游戏机制认知】
- 任何玩家都可以在发言中声明自己是任何角色（这是游戏允许的行为）
- 当多人声明同一角色时，好人必须花时间分辨真假——这个争论过程消耗好人的投票资源
- 投票是好人白天唯一的消灭手段——分散好人的票型就是保护狼队
- 查验结果是好人最核心的信息源——控制或干扰这条信息链的杠杆效应极高
- 好人之间的信任是有限资源——你消耗的信任越多，好人的判断就越困难

【被怀疑时】分析对方质疑的逻辑漏洞，用事实反驳，必要时引导话题到第三方

【思维框架（在 thought 中完成，不要写进 speech）】
Step1 局势评估：存活狼人/好人比？距离胜利条件多远？局势紧迫程度？
Step2 威胁识别：谁对狼队威胁最大？谁掌握了危险的信息？谁在建立公信力？
Step3 行动空间：我这次发言可以做什么？（分析、站边、质疑、声明身份、报告信息……）每种行动的预期收益和暴露风险各是多少？
Step4 最优行动：选择 收益/风险 比最高的行动执行
Step5 投票规划：场上票型分布？我的投票如何既推进狼队目标又不暴露身份？

【identity_table 填写策略（日间公开视角，但 reason 可记录私有战略注记）】
- 对高威胁好人（神职/正在推你队友者）：reason 写"刀口候选：[威胁描述]"，便于夜间决策时延续优先级
- 对已知队友：suspect 填"村民"，confidence 填 40-60，reason 填普通描述（维持公开叙事一致）
- suspect 字段统一用好人视角书写，不能直接填"狼人"（即使你已知）

输出JSON:{"thought":"完整的博弈推理过程（这里可以自由分析狼人策略）","speech":"完全像好人的公开发言(40-100字)","voteIntention":数字或-1,"voteDecided":true或false,"identity_table":{"玩家号":{"suspect":"角色猜测","confidence":0-100,"reason":"推理依据"}}}
voteDecided=true=已决定；false=投票阶段再思考`;
    },

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

        // 对跳局面检测：场上是否有其他玩家自称预言家
        const counterClaimants = params.counterClaimants || [];
        let counterClaimSection = '';
        if (counterClaimants.length > 0) {
            const ccIds = counterClaimants.join(',');
            counterClaimSection = `
⚠️ 【对跳局面专属策略】${ccIds}号已在场自称预言家，当前是双预言家对跳局面，你的首要任务是让好人相信你。使用以下三步框架戳穿悍跳：
Step A - 主动公开查验记录：逐夜清晰报出"N[X]夜我查了[目标号]，结果是[狼人/好人]"——信息越详细越可追溯，越难被伪造
Step B - 找对方报告的矛盾点：若对方报某人是金水而你验过是查杀（或反之），直接指出；若对方查验结果与你完全无交叉，要求对方解释查验心路历程
Step C - 用心路历程收口：解释你"为什么验这个人"（信息链决策逻辑）——悍跳狼只有结果，没有合理的查验心路历程
【语气原则】不要慌乱反复声称"我是真预言家"，要主动进攻——把场面焦点从"互相攻击"转到"谁的查验记录更合理、更自圆其说"。`;
        }

        // 残局策略（存活≤5人，集票战优先于信息战）
        const aliveCount = params.aliveCount || 8;
        let endgameHint = '';
        if (aliveCount <= 5) {
            endgameHint = `
【残局模式（存活≤5人）】信息战让位于集票战：不需要再做长篇心路历程，直接用查验结果推全员集票；若本夜验证了对跳者的报告目标，今天一锤定音公布结果；查杀在场立即强推，不留余地。`;
        }

        return `${getBaseContext(ctx)}
【预言家专属任务】白天发言 - 报验人/带节奏${endgameHint}

【你的查验记录】${checksInfo}
${goldWaters.length > 0 ? `【金水(好人)】${goldWaters.join(',')}号 - 绝不能投他们！` : ''}
${wolves.length > 0 ? `【查杀(狼人)】${wolves.join(',')}号 - 必须推出！` : ''}
${counterClaimSection}
【预言家发言要点（基于博弈论+竞技经验）】
1. 报验时机：8人局通常首轮报验（建立信息锚点），但如果场上已有其他人跳预言家，需要选择更有利的时机
2. 心路历程是核心：第几夜验谁、为什么验他、验出什么。这是区分真假预言家的关键——好的心路历程让好人相信你
3. 有查杀强势带票："X号是狼人，今天必须投他出局"。研究表明公开信息后集中投票是好人最优策略
4. 有金水就保护："Y号是好人，投Y号 = 帮狼人"
5. 对跳预言家：若有对跳局面，执行上方【对跳局面专属策略】三步框架（Step A-B-C）${policeFlowPoint}
${lastPointNumber}. 语气要坚定果断——预言家是好人阵营的信息源，犹豫不决会让好人失去信心

【思维链】
Step1: 我有什么查验信息必须报？（全部报出，不要藏）
Step2: 场上有对跳预言家？→ 有：执行【对跳局面专属策略】Step A-B-C；无：跳过
Step3: 今天必须投谁出局？（查杀 > 对跳悍跳玩家 > 最可疑者）
Step4: 绝不能投金水！voteIntention 必须指向狼人或最可疑的人

【identity_table 填写指导（预言家有确定性知识，应差异化填写）】
- 已查验玩家：confidence 填 95-100，reason 写"N[X]夜查验确认：[狼人/好人角色名]（已公开/待明日报）"——"待报"提醒次日发言优先公开
- 正在质疑你（悍跳嫌疑）的未验证玩家：reason 写"悍跳攻预嫌疑—优先查验候选，当前不能被其带节奏"
- 未查验普通玩家：reason 写"发言分析：[可信/可疑点]，下次查验候选"
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

【identity_table 填写指导（女巫：药水使用历史 + 备选候选记录）】
- 已救活的玩家：confidence 填 85-95，reason 写"N[X]夜银水救活（已知被狼刀目标）；若明夜再被刀：[是否还有银水/决策]"
- 已毒杀的玩家：confidence 填 98-100，reason 写"N[X]夜毒药处决确认出局"
- 高威胁候选（考虑毒）：confidence 填 65-85，reason 写"行为[带节奏/发言矛盾/攻真预]，毒药备选，威胁等级：高/中"
- 疑似关键神职（考虑下轮银水保护）：confidence 填 50-75，reason 写"行为疑似[预言家/守卫]，若明夜被刀且银水在：优先救"
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

【identity_table 填写指导（猎人：跨轮积累开枪优先级）】
- 高威胁候选（开枪首选）：confidence 填 70-90，reason 写"开枪优先：累计[X]次可疑——[发言带节奏/投票矛盾/攻真预]，当前开枪优先级：高"
- 中等嫌疑（备选）：confidence 填 50-70，reason 写"开枪备选：[具体可疑行为]，需再观察1-2轮确认"
- 明确好人（排除出局）：confidence 填 15-35，reason 写"排除开枪对象：[原因，如'金水确认'或'发言持续可信']"
- 开枪前回顾上轮 identity_table：若某人 reason 已记"开枪优先级：高"，优先锁定
  【追加示例】3号 N1 reason="开枪备选：发言可疑" → N2 末尾追加为"开枪备选：发言可疑；N2再攻真预（证实危险）——升为开枪优先"
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

【identity_table 填写指导（守卫：跨轮守护记录 + 神职候选标记）】
- 守护过的玩家：confidence 50-80，reason 在上轮 reason 基础上**追加**本轮新结果，不覆盖历史
  【追加示例】上轮 reason="N1守5号→平安夜存活" → 本轮末尾追加为"N1守5号→平安夜存活；N2换守3号(发言疑预)→3号次日存活，换守正确"
- 疑似关键神职（守护候选）：reason 写"白天行为疑似[预言家/女巫]，守护优先级高；如上轮已记则追加新证据"
- 高度可疑狼人：reason 写"发言[带节奏/攻真预/逻辑矛盾]，不守对象；追加后续矛盾行为"
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

【identity_table 填写指导（村民：跨轮行为模式积累，是你唯一的持久记忆）】
- 可疑玩家：confidence 填 55-80，reason 写"行为积累：N[X][发言带节奏/投好人/回避问题]；N[Y][矛盾行为]——本轮投票对象"
- 信任玩家：confidence 填 15-40，reason 写"信任积累：多轮发言稳定，N[X]投[合理目标]，N[Y]站边正确——好人候选"
- 票型关联（疑似一伙）：confidence 填 60-75，reason 写"N[X]与[Y号]同投[Z号（被认为是好人）]——两人可能一队，同时观察"
- 每轮更新：在上轮 reason 基础上**追加**本轮新观察，不要覆盖历史——模式是多轮积累出来的
  【追加示例】上轮 reason="N1发言带节奏" → 本轮末尾补充变为："N1发言带节奏；N2投好人——证实可疑，本轮投票对象"
输出JSON:{"thought":"分析过程","speech":"有观点有分析的发言(40-100字，必须包含明确的站边或踩人)","voteIntention":数字或-1,"voteDecided":true或false,"identity_table":{"玩家号":{"suspect":"角色","confidence":0-100,"reason":"依据"}}}
voteDecided=true=已决定；false=投票阶段再思考。⚠️ 有查杀信息时尽量填true并投查杀目标。`,

    '骑士': (ctx, params) => getRoleModule('骑士').daySpeech(ctx, params),
    '摄梦人': (ctx, params) => getRoleModule('摄梦人').daySpeech(ctx, params),
    '魔术师': (ctx, params) => getRoleModule('魔术师').daySpeech(ctx, params),
};

export const generateUserPrompt = (actionType, gameState, params = {}) => {
    const ctx = prepareGameContext(gameState);
    const { players } = gameState;

    // 获取当前玩家角色（用于角色路由）
    const currentPlayer = params.currentPlayer || players.find(p => p.id === params.playerId);
    const playerRole = currentPlayer?.role || '村民';

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
                gameSetup: gameState.gameSetup,
                // 多狼协作：存活狼队友列表（用于白天发言立场分散引导）
                wolfTeammates: playerRole === '狼人'
                    ? players.filter(p => p.isAlive && p.role === '狼人' && p.id !== currentPlayer?.id).map(p => p.id)
                    : [],
                // 特殊神职私有状态（骑士/摄梦人/魔术师 DAY_SPEECH 专用）
                hasUsedDuel: currentPlayer?.hasUsedDuel,
                hasRevealed: currentPlayer?.hasRevealed,  // 魔术师是否已跳身份
                dreamHistory: gameState.dreamweaverHistory || { dreamedPlayers: [], lastDreamTarget: null },
                lastDreamTarget: gameState.dreamweaverHistory?.lastDreamTarget ?? null,
                swappedPlayers: gameState.magicianHistory?.swappedPlayers || [],
                lastSwap: gameState.magicianHistory?.lastSwap || null,
                aliveCount: players.filter(p => p.isAlive).length,  // 骑士终局决斗阈值用
                // 对跳检测（预言家白天戳穿悍跳策略专用）
                counterClaimants: playerRole === '预言家'
                    ? (gameState.claimHistory || [])
                        .filter(c => c.type === 'jump_seer' && c.playerId !== currentPlayer?.id)
                        .map(c => c.playerId)
                    : [],
                // 警长身份（影响发言策略：需要在发言结尾给出警长指路/投票方向）
                isSheriff: currentPlayer?.isSheriff || false,
            };

            // 警长身份注入：在角色提示词之后追加"警长指路"任务（避免修改各角色提示词函数）
            const sheriffHint = roleParams.isSheriff
                ? `\n\n【⚖️ 警长任务（本轮额外职责）】你是本局警长，投票权重1.5票。"警长指路"是你最重要的职责——在发言结尾**明确宣告**你本轮的投票方向（一句话：如"综合目前信息，我本轮指向X号"），引导好人集中票型。
${playerRole === '狼人'
  ? '【狼人警长】利用警长权威引导好人打错方向：指向你想放逐的好人，用"根据目前发言逻辑"等分析语气（而非命令语气）；绝不指向狼队友；不要过于强硬——权威滥用是暴露信号。'
  : playerRole === '预言家'
  ? '【预言家警长】你已掌握查验结果，警长指路直接指向查杀目标（如有）或逻辑最可疑者；若有对跳者，指路对象优先指向悍跳者，用查验链为你的指向背书。'
  : '【好人警长】优先指向：已知查杀目标 > 本轮发言逻辑最混乱者 > 历史多轮被投者。明确宣告而非含糊暗示——你的1.5票 + 公开宣告会影响他人跟投。'}`
                : '';

            // 返回角色特定的提示词 + 警长任务（如有）+ 结构化 claims schema（柱三）
            return rolePromptGenerator(ctx, roleParams) + sheriffHint + CLAIMS_SCHEMA_SUFFIX;

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
【identity_table 填写指导（守卫夜间：守护历史跨轮追加，辅助连贯策略）】
- 守护候选/已守护者：confidence 50-80，reason 追加写"N[X]夜守护→[平安夜/成功拦截刀]"——**不覆盖历史**
  【追加示例】上轮 reason="N1守3号→平安夜" → 本轮追加为"N1守3号→平安夜；N2换守5号(疑真预)→[结果待观察]"
- 疑似神职（但未守护过）：reason 写"行为疑似[预言家/守卫]，守护优先级：高/中"
- 明确狼嫌疑：reason 写"发言矛盾/带节奏，不守对象"
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
                suspectedWolves,
                hasRevealed: currentPlayer?.hasRevealed,  // 身份已公开时优先级 C 提升为 A
            });

        case PROMPT_ACTIONS.NIGHT_WOLF:
             const validTargets = players.filter(p => p.isAlive && p.role !== '狼人').map(p => p.id).join(',');
             // P1渐进式披露：根据存在的角色动态生成刀法优先级
             const wolfExistingRoles = detectExistingRoles(players);
             const wolfTeammates = players.filter(p => p.isAlive && p.role === '狼人' && p.id !== currentPlayer?.id).map(p => p.id);
             const multiWolfHint = wolfTeammates.length > 0
               ? `\n【多狼协作】存活队友：${wolfTeammates.join(',')}号
⚡ 你是本晚的刀口决策人——你选定的目标即为全队行动目标，队友将直接执行你的决定。
综合评估：① 目标期望价值（角色威胁 × 存活优势） ② 被守护概率（连守规律） ③ 换人成本（猎人/骑士反杀）
白天各狼须分散发言立场，不同时力挺同一好人（立场高度一致是队友关系暴露的最常见信号）。
白天角色分化（与白天发言策略一致）：先开口的担任【主动方】（质疑好人/带话题方向），后开口的担任【低调方】（装中立评委，"我也在观察"语气，保留信任度）。`
               : '';
             const wolfPriorities = [];
             if (wolfExistingRoles.hasWitch) wolfPriorities.push('女巫(有毒药威胁)');
             if (wolfExistingRoles.hasSeer) wolfPriorities.push('预言家(信息源)');
             if (wolfExistingRoles.hasGuard) wolfPriorities.push('守卫(保护者)');
             if (wolfExistingRoles.hasHunter) wolfPriorities.push('猎人(有枪)');
             wolfPriorities.push('村民');
             const wolfPriorityStr = wolfPriorities.join(' > ');

             // 威胁分析提示
             const wolfThreatHints = [];
             if (wolfExistingRoles.hasSeer) wolfThreatHints.push('预言家每晚获得一条确定性信息——存活越久，狼队暴露概率越高');
             if (wolfExistingRoles.hasWitch) wolfThreatHints.push('女巫有救人和毒杀能力——首夜可能救人');
             if (wolfExistingRoles.hasGuard) wolfThreatHints.push('守卫可能保护关键目标——需要考虑博弈');
             if (wolfExistingRoles.hasHunter) wolfThreatHints.push('猎人死亡时带走一人——需要权衡交换价值');

             return `狼人袭击决策。
【重要规则】每晚必须袭击一名玩家，不能空刀！
【可袭击目标】${validTargets}号
${multiWolfHint}
${nightCot}
【威胁评估参考】${wolfPriorityStr}
${wolfThreatHints.length > 0 ? '【威胁分析】\n' + wolfThreatHints.map(h => `- ${h}`).join('\n') : ''}

【思维链】
1. 根据白天发言，谁最可能是什么角色？
2. 消灭谁对狼队的期望收益最大？（信息链、投票权、技能威胁）
3. 对方可能被保护吗？
【identity_table 战略用途（你已知所有人真实身份）】
- 对高威胁好人（神职/发言锋利/已对队友起疑）：confidence 填 85-95，reason 写"高优先刀口：[具体威胁原因]"，供下轮夜间决策时优先锁定
- 对已知狼队友：suspect 填"村民"，confidence 填 40-60，reason 填中性描述（维持与你公开发言立场的一致性）
- 对低威胁村民：confidence 填 30-50，reason 填"无明显神职特征，刀口优先级低"
输出:{"targetId":数字(必须从可袭击目标中选),"reasoning":"选择理由","thought":"完整刀法推演过程","identity_table":{"玩家号":{"suspect":"角色","confidence":0-100,"reason":"依据"}}}`;

        case PROMPT_ACTIONS.NIGHT_SEER: {
             const { validTargets: seerTargets } = params;
             const isFirstNight = ctx.dayCount === 1;

             // 动态上下文：检测悍跳者（其他玩家声称是预言家）
             const mySeerChecksCount = (gameState.seerChecks || []).filter(c => c.seerId === currentPlayer?.id).length;
             const counterClaimants = (gameState.claimHistory || [])
               .filter(c => c.type === 'jump_seer' && c.playerId !== currentPlayer?.id)
               .map(c => c.playerId);
             const counterClaimText = counterClaimants.length > 0
               ? `⚠️ 【悍跳警报】${counterClaimants.join(',')}号已自称预言家（对跳），优先考虑验证其报告中的某个"金水"或"查杀"——确认对方报假可一次性戳穿悍跳！`
               : '';

             // 残局判断（信息采集 → 精准打击的策略翻转点）
             const aliveCount = players.filter(p => p.isAlive).length;
             const isEndgame = aliveCount <= 5;

             let seerNightStrategy;
             if (isFirstNight) {
               seerNightStrategy = `【首夜策略】第一夜没有发言信息，选择查验策略：
- 边角位策略：查 0号 或最后一号（统计上狼人密度略高）
- 随机策略：随机选一个目标，开局建立信息锚点
- 关键位策略：查中间座位（发言影响力大的位置）
无论选谁，明天发言要说清"心路历程"——为什么查这个人。`;
             } else if (isEndgame) {
               seerNightStrategy = `【残局策略（存活≤5人）】信息采集让位于精准打击：
- 优先查验本轮投票争议的焦点目标——查杀则次日立即带全员集票，错误投票场上已几乎无容错空间
- 若仍有未查验的悍跳玩家（对跳），本夜必须补查以彻底建立公信、切断对跳迷雾
- 残局禁忌：不要再查你已高度确信是好人的玩家，浪费了胜负手级别的机会`;
             } else {
               seerNightStrategy = `【后续夜查验优先级框架（信息增量最大化·信息链策略）】
请按以下优先级决定今晚查验目标（越高优先级信息价值越大）：
① 悍跳响应（最高优先）：若有玩家自称"预言家"（对跳），优先验证其报告中某个"金水"或"查杀"目标——一旦揭穿假报，悍跳立刻戳穿，好人赢得公信权（信息价值：解开全局对跳迷雾）
② 多路汇聚：若 2+ 独立玩家（非同阵营）同时怀疑同一人，优先查验该人——一次查验同时验证了多条独立推理链，信息价值倍增
③ 投票关键位：若明天某玩家将被集中投票但身份仍有争议，今夜提前查验——次日可直接凭查验结果引导集票（消灭争议+带票二合一）
④ 信任链延伸：若已确认 A 是好人，且 A 强烈推荐 B 为好人、B 未经验证——查 B 可沿信任链扩展确定性，效率高于随机猜测
⑤ 行为异常兜底：无以上情形时，选发言中突然转向/沉默/强行带节奏的未验证玩家
【避免】已高度确认是好人的玩家 / 场上影响力最低且无争议的玩家（浪费查验机会）`;
             }

             return `预言家查验决策。
${counterClaimText}
【可查验目标】${seerTargets?.join(',') || '无'}号
【查验历史】本局已查验 ${mySeerChecksCount} 人，当前第 N${ctx.dayCount} 夜
${nightCot}
${seerNightStrategy}
【identity_table 填写指导（夜间查验：记录确认知识与候选优先级）】
- 已查验玩家：confidence 填 95-100，reason 写"N[X]夜查验确认：[狼人/好人角色名]（已公开/待明日报）"——标"待报"提醒自己次日发言必须优先公开
- 今晚查验目标：confidence 填 50-70，reason 写"本轮查验候选：[策略原因，如'对跳验证'/'多路汇聚'/'投票节点']"
- 高度可疑但未查者：confidence 填 60-80，reason 写"行为可疑：[具体原因]，排队查验优先级：[①②③④⑤ 哪级]"
输出:{"targetId":数字,"reasoning":"查验理由","thought":"查验思考过程","identity_table":{"玩家号":{"suspect":"角色","confidence":0-100,"reason":"依据"}}}`;
        }

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
【identity_table 填写指导（女巫夜间：药水决策状态持久化）】
- 本晚被刀目标：confidence 填 70-85，reason 写"N[X]夜被狼刀：[救/未救原因]；解药状态：[当前可用/已用]，若是关键神职则救，否则保留"
- 高威胁毒药候选：confidence 填 65-85，reason 写"毒药优先候选：[发言带节奏/投好人]，本夜[是否用毒]；下轮复查"
- 确认出局玩家（已毒杀）：confidence 填 98-100，reason 写"N[X]夜毒药处决，出局确认"
输出:{"useSave":true/false,"usePoison":数字或null,"reasoning":"决策理由(必须包含你的推断：当前大概还剩X好人Y狼人)","thought":"用药思考过程","identity_table":{"玩家号":{"suspect":"角色","confidence":0-100,"reason":"依据"}}}`;

        case PROMPT_ACTIONS.NIGHT_DREAMWEAVER: {
             const { dreamHistory, lastDreamTarget: dwLastTarget, aliveTargets: dwAliveTargets, hasRevealed: dwHasRevealed } = params;
             const dwExistingRoles = detectExistingRoles(players);

             // 构建入梦历史提示
             const dwHistoryText = dreamHistory?.dreamedPlayers?.length > 0
                 ? `已被你入梦过的玩家：${dreamHistory.dreamedPlayers.join(',')}号`
                 : '无人被入梦过';
             const dwWarning = dwLastTarget !== null
                 ? `\n⚠️【连梦警告】你昨晚入梦了 ${dwLastTarget}号！如果今晚再次入梦TA，TA将直接死亡（无法被救）！`
                 : '';

             // 身份已公开时的警示（R23 item 40：hasRevealed 导致殉情模式跃升最高优先级）
             let dwRevealedAlert = '';
             if (dwHasRevealed) {
                 dwRevealedAlert = `\n⚠️ 【身份已公开 — 殉情模式跃升最高优先】你的摄梦人身份已暴露，狼人极可能今晚将你列为首选刀口！
  ① 殉情：入梦最高嫌疑的狼人（confidence≥50% 即出手）——狼刀你 → 同归于尽；狼改刀 → 威慑生效且保护了队友
  ② 防御：若场上有跳身份的真神职，可切换为保护模式（狼可能改刀神职）
  阈值提醒：身份暴露后高阈值等待代价过高，≥50% 即可果断殉情`;
             }

             // 根据有无特定角色 + 身份暴露状态调整策略优先级
             const dwStrategyHints = [];
             if (dwHasRevealed) {
                 dwStrategyHints.push('- ★ 殉情模式（最高优先）：入梦最高嫌疑的狼人（confidence≥50% 即出手）——狼刀你同归于尽，威慑使狼改刀也保护了队友');
                 if (dwExistingRoles.hasSeer) {
                     dwStrategyHints.push('- 防御模式（次优先）：若场上有跳身份的真神职需要保护，可切换为防御入梦');
                 }
             } else {
                 if (dwExistingRoles.hasSeer) {
                     dwStrategyHints.push('- 防御模式：可入梦真预言家，但绝不能连续两晚入梦同一人');
                 }
                 dwStrategyHints.push('- 进攻模式：对高度怀疑的狼人进行"连梦击杀"（确信度≥75%）');
                 dwStrategyHints.push('- 殉情模式：预感自己会死时，入梦铁狼，同归于尽');
             }
             if (dwExistingRoles.hasWitch) {
                 dwStrategyHints.push('- 避免入梦女巫：你死时会连带女巫出局，损失过大');
             }
             if (dwExistingRoles.hasHunter) {
                 dwStrategyHints.push('- 避免入梦猎人：你死时连带猎人，无法开枪');
             }

             return `摄梦人入梦决策。
${dwWarning}${dwRevealedAlert}
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

输出JSON:{"dreamTarget":数字(必选，不能为null不能为自己),"dreamMode":"defense/offense/sacrifice","dreamReason":"入梦理由(20-40字)","isConsecutiveDream":true/false,"confidence":0-100,"thought":"思考过程","identity_table":{"玩家号":{"suspect":"角色","confidence":0-100,"reason":"依据"}}}`;
        }

        case PROMPT_ACTIONS.DAY_VOTE: {
            const { validTargets: voteTargets, seerConstraint, lastVoteIntention, pkMode } = params;
            const isVoterSheriff = currentPlayer?.isSheriff || false;
            const intentionReminder = lastVoteIntention && lastVoteIntention !== -1
                ? `你刚才在发言中表示想投 ${lastVoteIntention} 号。`
                : (lastVoteIntention === -1 ? '你刚才在发言中表示暂不表态/弃票。' : '');

            // Scene detection based on game progress
            const voteDay = ctx.dayCount;
            const alivePlayers = players.filter(p => p.isAlive);
            const aliveCount = alivePlayers.length;
            const wolfCount = (gameState.gameSetup?.STANDARD_ROLES || []).filter(r => r === '狼人').length || 2;
            const isLateGame = aliveCount <= wolfCount * 2 + 2;

            // 预言家对跳场景：识别场上悍跳者且在本轮投票目标中（PK时 voteTargets 只有2人）
            const seerCounterClaimantsInVote = playerRole === '预言家'
                ? (gameState.claimHistory || [])
                    .filter(c => c.type === 'jump_seer' && c.playerId !== currentPlayer?.id
                           && voteTargets.includes(c.playerId))
                    .map(c => c.playerId)
                : [];

            // Cross-round vote momentum: tally who has been repeatedly targeted in prior rounds
            const prevVoteRounds = (gameState.voteHistory || []).filter(v => v.day < voteDay);
            let voteMomentumHint = '';
            if (prevVoteRounds.length > 0) {
                const tally = {};
                for (const round of prevVoteRounds) {
                    for (const v of (round.votes || [])) {
                        if (v.to !== -1) tally[v.to] = (tally[v.to] || 0) + 1;
                    }
                }
                const hotTargets = Object.entries(tally)
                    .filter(([id]) => alivePlayers.find(p => p.id === Number(id)))
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3);
                if (hotTargets.length > 0) {
                    voteMomentumHint = `\n【跨轮投票热力】历史投票中：${hotTargets.map(([id, cnt]) => `${id}号被投${cnt}次`).join('、')}。热力仅作参考——警惕刷票陷阱：
  ① 热力高但本轮发言逻辑清晰/有实质分析 → 可能是狼刷票的靶子，不要盲跟
  ② 多个狼嫌疑玩家一致力推同一目标 → 高度警惕合谋，热力降权
  ③ 热力高的人总是踩明显狼嫌疑 → 可能是好人在正确分析（非靶子，可跟投）
  决策原则：先独立评估本轮发言质量，再参考热力——热力仅作辅助，切勿"高热力就跟投"。`;
                }
            }

            // Scene-based strategy hint (pkMode takes priority)
            let sceneHint = '';
            if (pkMode) {
                sceneHint = `\n【PK重投】平票后重投！请更坚定地投出最可疑的一方，弃票=维持局面（对好人通常不利）。`;
            } else if (voteDay === 1) {
                sceneHint = `\n【首轮投票】首轮信息有限：优先追随预言家查杀；无查杀时可弃票避免误伤，但弃票意味着本轮无法清除狼人。`;
            } else if (isLateGame) {
                sceneHint = `\n【终局警报】场上仅${aliveCount}人，约${wolfCount}狼。票型错误可能直接触发好狼人数平衡导致失利！必须投有信息支撑的目标（查杀>多轮被投>单轮可疑>弃票）。`;
            }

            // 警长投票权重提醒：警长知道自己的票值1.5，应更审慎避免投错
            const sheriffVoteHint = isVoterSheriff
                ? `\n【🎖️ 警长投票】你的投票权重为1.5票——比普通玩家多出半票。你的票型在接近平票的局面中决定胜负。务必投有信息支撑的目标，切勿弃票（警长弃票=放弃1.5票，好人阵营损失最重）。`
                : '';

            // 预言家投票策略：对跳局面时悍跳者优先于其他目标（悍跳 = 公开谎言 = 已知狼人）
            const seerVoteStrategy = seerCounterClaimantsInVote.length > 0
                ? `2. 【预言家投票策略—对跳优先】${seerCounterClaimantsInVote.join(',')}号是在场悍跳者（自称预言家），你已知其身份虚假，投票优先级等同于已验查杀——${pkMode ? 'PK必须投悍跳者！弃票=放过已知狼人，对好人阵营不可接受' : '率先投悍跳者出局！勿浪费这次信息优势，绝不投金水（已验好人）。'}`
                : `2. 【预言家投票策略】率先投查杀目标！绝不投金水（已验好人）。引领好人集中票型形成多数。`;

            return `投票放逐阶段（第${voteDay}天）。
【存活可投】${voteTargets.join(',')}号(不能投自己)，或选择-1弃票。
${intentionReminder}
${seerConstraint || ''}
${voteMomentumHint}
${sceneHint}${sheriffVoteHint}
${voteCotTemplate}

【投票逻辑推演】
1. 回顾你的发言意向（${lastVoteIntention === -1 ? '弃票' : lastVoteIntention || '无'}），保持言行一致，除非有新信息改变判断。
${playerRole === '狼人'
  ? `2. 【狼人投票博弈】投票本身是身份信号——考虑：投谁最大化狼队利益？这票会暴露你吗？能否影响最终结果形成多数？`
  : playerRole === '预言家'
  ? seerVoteStrategy
  : `2. 【投票策略】有查杀 → 跟投查杀！无查杀 → 投发言逻辑最混乱或历史被投最多的玩家。好人分票=助狼人优势。`}
3. 无有效信息时可弃票(-1)，但有查杀或明确嫌疑时弃票等于放弃好人票权。

⚠️ targetId = 你想投票【淘汰/出局】的人，不是你"支持"的人！
⚠️ 已验证预言家的查杀优先级最高：分票=帮狼人。未验证或有悍跳时综合分析再决定。

输出JSON格式:
{"reasoning":"一句话分析(言行一致投X/听了Y发言改投Y/信息不足弃票)","targetId":数字或-1,"thought":"投票决策思考过程"}`;
        }

        case PROMPT_ACTIONS.HUNTER_SHOOT: {
             const { aliveTargets, hunterContext } = params;
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

             // 临界情况引导：猎人开枪是最后一次主动改变局势的机会
             const hunterAliveCount = (aliveTargets || []).length; // 不含猎人自身
             const hunterCriticalGuidance = `\n\n⚠️【临界局势推理】
你死亡开枪 = 本轮同时出局两人（你 + 你带走的人）。当前存活${hunterAliveCount}人（不含你）。
请自行推断：
1. 结合已知死亡记录和查杀信息，场上大约剩几个狼人？
2. 如果你带走了好人：好人数会减少1，是否触发"好人数 ≤ 狼人数"直接输的条件？
3. 如果你带走了已验狼人：狼人减少1，好人重获优势——这是最优解
4. 无查验信息时：开枪是"凭信心赌"，选发言逻辑崩塌/倒钩明显的，避开沉默/模糊中间型

【决策框架】
- 有查杀信息 → 必须带走查杀目标（即使你不确定，查杀比猜测更可靠）
- 无查杀但有可疑 → 带走最高怀疑度，宁错不弃（弃权会导致平局或直接输）
- 切记：猎人开枪是好人阵营最后一次主动出击机会，"稳"不是选项——带走最可能的狼人`;

             return `你是猎人(好人阵营)，死亡时必须开枪带走一名玩家！
【重要规则】猎人死亡时必须开枪，不能选择不开枪！你必须从下方目标中选择一个带走。
【存活可选】${aliveTargets.join(',')}号
${hunterContext || ''}
【开枪策略——按优先级从高到低】
${hunterStrategies.map((s, i) => `${i + 1}. ${s}`).join('\n')}
${hunterCriticalGuidance}
输出JSON:{"shoot":true,"targetId":必须是数字(从存活可选中选择),"reason":"一句话理由","thought":"开枪决策思考过程（必须包含推断：场上约剩X狼，带错是否直接输）"}`;
        }

        case PROMPT_ACTIONS.SHERIFF_RUN: {
             const srHint = playerRole === '预言家'
                 ? '你是预言家：标准打法是必上警——报出首验结果争取警徽，建立信息权威。除非你判断本局有特殊风险。'
                 : playerRole === '狼人'
                 ? '你是狼人：上警可以悍跳预言家搅乱信息、或冲票分薄好人警徽；不上警则更隐蔽。根据你的发言能力和队伍策略权衡。'
                 : (playerRole === '女巫' || playerRole === '猎人' || playerRole === '守卫')
                 ? `你是${playerRole}：标准打法是不上警隐藏身份（神职暴露会被狼优先刀），除非局势需要你站出来。`
                 : '你是村民：可以上警为好人阵营争取空间（挡狼人冲票），也可以不上警安静听局。';
             return `第1天警长竞选——是否上警？
警长拥有1.5票投票权重，死亡时可移交警徽。上警者需发表竞选发言并接受警下投票。
${srHint}
输出JSON:{"run":true或false,"reason":"一句话理由","thought":"决策思考"}`;
        }

        case PROMPT_ACTIONS.SHERIFF_SPEECH: {
             const { candidateIds } = params || {};
             const hasPoliceFlow = isLargeGame(gameState?.gameSetup);
             const badgeFlowLine = hasPoliceFlow
                 ? '3. 警徽流计划：如果你被刀，打算把警徽传给谁（展示你已为好人利益提前谋划）'
                 : '3. 你的价值主张：你比其他候选人更适合当警长的理由（冷静/有分析/不被带偏）';
             const ssHint = playerRole === '预言家'
                 ? `你是预言家：竞选发言 = 信息资产展示，说清3点即可赢得警徽：
1. 首夜查验结果：X号是金水还是查杀（这是你最核心的竞选筹码）
2. 心路历程：为什么选择查X号（让警下相信你的判断逻辑，而不只是报结论）
3. 后续计划：你准备接着查谁、为什么（证明你的信息链有持续价值）
语气要自信坚定——你是好人最重要的信息源，理所当然该拿警徽。`
                 : playerRole === '狼人'
                 ? `你是狼人：根据你的竞选策略选择发言角度——
① 若悍跳预言家：构造可信的"查验结果"（和你真实知道的身份一致，不能和场上已有信息矛盾），描述流畅的心路历程，给出合理的警徽流计划
② 若以好人身份竞选：展示分析能力，说出你对昨夜局势的判断和票型倾向——暗示你当选后能主导好人找出"狼人"（实际是在控制信息流）`
                 : `你是好人（${playerRole}）：竞选发言 = 分析能力展示，说清3点让警下信服你：
1. 昨夜局势分析：你认为场上最可疑的是谁、最信任谁（展示你已在动脑，而非只求当选）
2. 票型判断：你当选后准备主推什么方向的票（具体到玩家或可疑方向，不要只说"带好人找狼"）
${badgeFlowLine}
自信表达，不要只说"请相信我"——用具体分析证明你值得这个警徽。`;
             return `警长竞选发言。本轮上警候选人：${(candidateIds || []).join(',')}号。
${ssHint}
【核心原则】警长竞选 = 竞争"分析权威"。好的竞选发言展示你已有判断、有计划；差的竞选发言只说口号没有实质内容。
【思维链】Step1: 我有什么信息或分析能说服警下？Step2: 我当选后的行动计划是什么？Step3: 在80字内展示最有说服力的论点。
要求：60-80字，必须包含至少一个具体分析或行动计划，不要只讲大道理或请求信任。
输出JSON:{"speech":"竞选发言（必须有具体内容）","thought":"真实竞选考量（含博弈思路）"}`;
        }

        case PROMPT_ACTIONS.SHERIFF_VOTE: {
            const { validTargets: sheriffCandidates } = params || {};
            const svCandidates = sheriffCandidates || [];
            const svCandidateSet = new Set(svCandidates.map(Number));

            // 从 gameState 提取候选人中已被预言家查验的信息
            const svSeerChecks = gameState.seerChecks || [];
            const svGoldWater = svSeerChecks.filter(c => !c.isWolf && svCandidateSet.has(Number(c.targetId)));
            const svSlaughter = svSeerChecks.filter(c => c.isWolf && svCandidateSet.has(Number(c.targetId)));

            let svCheckHint = '';
            if (svGoldWater.length > 0) {
                svCheckHint += `\n⚡【金水候选人（已验好人）】${svGoldWater.map(c => `${c.targetId}号`).join('、')} → 最优投票对象，好人警长比狼人警长多 1.5 票优势`;
            }
            if (svSlaughter.length > 0) {
                svCheckHint += `\n⛔【查杀候选人（已验狼人）】${svSlaughter.map(c => `${c.targetId}号`).join('、')} → 绝对不能投，狼人当警长等于把1.5票永久送给狼队`;
            }

            const svRoleHint = playerRole === '狼人'
                ? `\n【狼人策略】你掌握真实身份：候选人中有无狼队友？有 → 投队友（1.5票优势是跨越全局的战略资产），但投票不能太明显。无队友候选人 → 投对狼队威胁最低的好人，或弃票。`
                : playerRole === '预言家'
                ? `\n【预言家策略】警徽让你的报验拥有1.5票杠杆。若你是候选人，优先保住警徽留在己方；若退选，把票给你验过的金水好人，或发言逻辑与你查验结果最吻合的人。`
                : playerRole === '女巫' || playerRole === '守卫' || playerRole === '猎人'
                ? `\n【神职策略】你是隐藏神职，警长身份会吸引狼人刀。投票时优先投好人担任警长（金水>发言扎实>无记录），避免神职扎堆暴露。`
                : '';

            return `警长选举投票（首轮特殊机制：警长获1.5票权重）。候选人：${svCandidates.join(',')}号，或-1弃票。${svCheckHint}${svRoleHint}
【判断框架（按权重）】
1. 预言家查验优先：有被验为好人的候选人 → 投他；有查杀的候选人 → 绝不投他。
2. 竞选发言质量：谁给出了具体的警徽流方案、发言逻辑最严密、自证最有说服力？
3. 跳预言家评估：单跳 → 评估查验心路历程的内部一致性（假预言家无法编出完整体系）；双跳 → 对比谁的查验链更能自洽。
4. 无信息时：投发言最清晰的候选人；完全无法判断 → 弃票（-1）也是合理选择，错给狼人比无警长更坏。
输出JSON:{"targetId":数字或-1,"reasoning":"一句话投票理由","thought":"投票博弈推演（含对各候选人分析）","identity_table":{"玩家号":{"suspect":"角色猜测","confidence":0-100,"reason":"推理依据"}}}`;
        }

        case PROMPT_ACTIONS.SHERIFF_BADGE_PASS: {
             const { validTargets: badgeTargets, seerChecks: bpSeerChecks } = params || {};
             const badgeableSet = new Set(badgeTargets || []);

             // 根据预言家查验结果，对候选人分级
             const goldWaterTargets = (bpSeerChecks || [])
                 .filter(c => !c.isWolf && badgeableSet.has(c.targetId));
             const killedTargets = (bpSeerChecks || [])
                 .filter(c => c.isWolf && badgeableSet.has(c.targetId));

             let seerHint = '';
             if (goldWaterTargets.length > 0) {
                 seerHint += `\n⚡【预言家金水（已验好人）】${goldWaterTargets.map(c => `${c.targetId}号`).join('、')} → 优先移交对象`;
             }
             if (killedTargets.length > 0) {
                 seerHint += `\n⛔【预言家查杀（已验狼人）】${killedTargets.map(c => `${c.targetId}号`).join('、')} → 绝对不能移交（传给狼等于送1.5票，直接输）`;
             }

             const bpHint = playerRole === '狼人'
                 ? '你是狼人警长：把警徽传给狼队友能延续1.5票优势；若会暴露关系链，可传给一个好人混淆视听或撕掉。'
                 : '你是好人警长：把警徽传给你最确信的好人（金水>真预言家>发言可信者）。完全无法判断时撕掉警徽（-1）也是合理选择——错传给狼等于送1.5票。';
             return `你（警长）死亡，决定警徽去向。
【可移交对象】${(badgeTargets || []).join(',')}号，或-1撕毁警徽。
${bpHint}${seerHint}
输出JSON:{"targetId":数字或-1,"reason":"一句话理由","thought":"决策思考"}`;
        }

        case PROMPT_ACTIONS.LAST_WORDS: {
             const { cause } = params || {};
             const hasPoliceFlow = isLargeGame(gameState?.gameSetup);
             let lwRoleHint;
             if (playerRole === '狼人') {
                 lwRoleHint = '你是狼人：以普通好人的视角留遗言，基于你之前建立的立场和分析逻辑，给出一个你最"怀疑"的玩家——优先选择对狼队威胁最大的职能好人。发言自然坚定，像一个真心被冤枉的好人在做最后的申辩。';
             } else if (playerRole === '预言家') {
                 const sheriffHint = hasPoliceFlow
                     ? '\n④ 警徽流建议：基于你的查验结果，明确给出警徽应传给哪个玩家（你最确信的金水好人）。'
                     : '';
                 lwRoleHint = `你是预言家：这是全局最有价值的一次发言。必须完整传递：
① 按夜次列出全部查验结果（X号：金水/查杀）
② 基于查验给出存活狼人的最高优先级怀疑排序（最怀疑X号，其次Y号）
③ 若有高嫌疑但尚未查验的玩家，请点名提示${sheriffHint}`;
             } else if (playerRole === '女巫') {
                 const hasSave = currentPlayer?.hasWitchSave ?? true;
                 const hasPoison = currentPlayer?.hasWitchPoison ?? true;
                 const medState = !hasSave && !hasPoison ? '双药已用完'
                     : hasSave && hasPoison ? '解药和毒药均未使用'
                     : !hasSave ? '解药已用，毒药尚存'
                     : '解药尚存，毒药已用';
                 lwRoleHint = `你是女巫：【药品状态】${medState}。告知场上最高嫌疑的狼人；简述你的用药决策逻辑，帮助好人继续追查。`;
             } else if (playerRole === '猎人') {
                 lwRoleHint = '你是猎人：明确宣告你最高度怀疑的狼人目标（即使此刻无法开枪，留下线索能让好人接棒追查）；若你即将触发开枪，直接说明目标和理由。';
             } else if (playerRole === '守卫') {
                 lwRoleHint = '你是守卫：公开你的完整守护记录（每晚守了谁），帮助好人识别可能的谎言（如有人自称被守护但实际没有）；指出你最高度怀疑的狼人。';
             } else if (playerRole === '骑士') {
                 const hasUsedDuel = currentPlayer?.hasUsedDuel ?? false;
                 const duelStatus = hasUsedDuel
                     ? '你的决斗已使用——将你最终观察到的场上身份判断传递出去，让好人接棒'
                     : '你的决斗未使用——告诉好人你最确信的狼人目标，他们可以用投票接替你本应用的决斗机会';
                 lwRoleHint = `你是骑士：${duelStatus}。基于你全程观察的发言和投票，指出你最高度怀疑的狼人（必须说明逻辑依据）。`;
             } else if (playerRole === '摄梦人') {
                 const dwHistory = gameState.dreamweaverHistory || {};
                 const dreamedPlayers = dwHistory.dreamedPlayers || [];
                 const activeTarget = dwHistory.currentDreamTarget ?? dwHistory.lastDreamTarget;
                 const syncWarning = activeTarget != null
                     ? `⚠️【同生共死触发】你当前连接的是${activeTarget}号——你出局后TA也将随之出局！`
                     : '';
                 const historyText = dreamedPlayers.length > 0
                     ? `入梦历史：${dreamedPlayers.join(',')}号`
                     : '无入梦记录';
                 lwRoleHint = `你是摄梦人：${syncWarning} ${historyText}。公开你的完整入梦名单，帮助好人还原死讯逻辑（谁被你保护过、谁是连梦击杀）；指出你最高度怀疑的狼人。`;
             } else if (playerRole === '魔术师') {
                 const magHistory = gameState?.magicianHistory || { swappedPlayers: [], lastSwap: null };
                 const lastSwap = magHistory.lastSwap;
                 const hasSwap = lastSwap?.player1Id != null;
                 const swapText = hasSwap
                     ? `最近一次交换：${lastSwap.player1Id}号↔${lastSwap.player2Id}号（技能目标已重定向：场上所有人以为"预言家验${lastSwap.player1Id}号"，实际查的是${lastSwap.player2Id}号）`
                     : '未完成任何交换，场上逻辑链未被重定向';
                 const allSwapped = magHistory.swappedPlayers?.length > 0
                     ? `整局被交换过的玩家：${magHistory.swappedPlayers.join(',')}号`
                     : '';
                 lwRoleHint = `你是魔术师：${swapText}。${allSwapped ? allSwapped + '。' : ''}公开你的完整交换记录是修正场上逻辑偏差的唯一途径；同时指出你最高度怀疑的狼人。`;
             } else {
                 lwRoleHint = '你是好人：以最高信息密度传递你的分析——谁的发言逻辑最可疑、投票中的阵营线索、你最信任的玩家是谁。帮助场上好人继续追查。';
             }
             return `你已死亡（${cause}），现在是你的遗言时间——这是你最后一次发言，之后不再参与游戏。
${lwRoleHint}
要求：80字以内，信息密度优先，不要煽情告别。
输出JSON:{"speech":"遗言内容","thought":"你的真实想法"}`;
        }

        case PROMPT_ACTIONS.SUMMARIZE_CONTENT:
             const { content, maxLength = 50 } = params;
             return `请将以下内容精简摘要为不超过${maxLength}字的核心要点：
"${content}"
输出JSON:{"summary":"摘要内容"}`;

        default:
            return `任务: ${actionType}`; 
    }
};
