/**
 * RAG数据结构Schema - P0优化
 *
 * 基于报告理论：结构化存储游戏数据，支持高效检索和分析
 * 包含：发言记录、投票记录、夜间行动记录、逻辑断言提取
 */

// ============================================================
// 数据Schema定义
// ============================================================

/**
 * 逻辑断言类型
 * 用于从发言中提取结构化的逻辑信息
 */
export const LOGIC_NODE_TYPES = {
    CLAIM: 'claim',           // 声称身份: "我是预言家"
    ACCUSE: 'accuse',         // 指控某人: "3号是狼"
    DEFEND: 'defend',         // 为某人辩护: "1号是金水"
    VOTE_INTENT: 'vote_intent', // 投票意向: "我投3号"
    QUESTION: 'question',     // 质疑某人: "2号为什么不说话？"
    SUPPORT: 'support',       // 支持某人: "我站边0号预言家"
    VERIFY: 'verify',         // 验证信息: "0号查验1号是好人"
    DOUBT: 'doubt',           // 表示怀疑: "我觉得有问题"
    INFO: 'info'              // 提供信息: "昨晚平安夜"
};

/**
 * 情感倾向类型
 */
export const SENTIMENT_TYPES = {
    AGGRESSIVE: 'aggressive',   // 攻击性强
    DEFENSIVE: 'defensive',     // 防御姿态
    CONFIDENT: 'confident',     // 自信果断
    HESITANT: 'hesitant',       // 犹豫不决
    NEUTRAL: 'neutral',         // 中立平和
    EMOTIONAL: 'emotional'      // 情绪激动
};

/**
 * 创建发言记录
 * @param {Object} params - 发言参数
 * @returns {Object} 结构化发言记录
 */
export const createSpeechRecord = ({
    playerId,
    day,
    phase,
    content,
    thought = null,
    voteIntention = null,
    summary = null
}) => {
    const id = `speech_d${day}_p${playerId}_${Date.now()}`;

    return {
        id,
        roundId: `D${day}_${phase}`,
        playerId,
        day,
        phase,
        content,
        thought,           // AI的思考过程（如有）
        summary: summary || extractSummary(content),

        // 结构化提取（将在后续填充）
        logicNodes: [],           // 逻辑断言列表
        sentiment: SENTIMENT_TYPES.NEUTRAL,
        claimedRole: null,        // 声称的身份
        mentionedPlayers: extractMentionedPlayers(content),
        voteIntention,

        // 验证字段（游戏结束后可填充）
        truthReference: null,

        // 元数据
        timestamp: Date.now(),
        wordCount: content.length
    };
};

/**
 * 创建投票记录
 * @param {Object} params - 投票参数
 * @returns {Object} 结构化投票记录
 */
export const createVoteRecord = ({
    day,
    votes,
    eliminated,
    eliminatedRole = null
}) => {
    const id = `vote_d${day}_${Date.now()}`;

    // 分析投票模式
    const patterns = analyzeVotePatterns(votes);

    return {
        id,
        day,
        votes: votes.map(v => ({
            from: v.from,
            to: v.to,
            reasoning: v.reasoning || null,
            confidence: v.confidence || 0.5,
            wasConsistent: v.wasConsistent ?? true  // 是否与发言意向一致
        })),
        eliminated,
        eliminatedRole,

        // 投票模式分析
        patterns,

        // 元数据
        timestamp: Date.now(),
        totalVoters: votes.length
    };
};

/**
 * 创建夜间行动记录
 * @param {Object} params - 夜间行动参数
 * @returns {Object} 结构化夜间行动记录
 */
export const createNightActionRecord = ({
    day,
    actions,
    outcome
}) => {
    const id = `night_d${day}_${Date.now()}`;

    return {
        id,
        day,
        actions: actions.map(a => ({
            role: a.role,
            playerId: a.playerId,
            action: a.action,
            target: a.target,
            reasoning: a.reasoning || null,
            success: a.success ?? true
        })),
        outcome: {
            deaths: outcome.deaths || [],
            saved: outcome.saved || false,
            guardMatch: outcome.guardMatch || false,
            poisoned: outcome.poisoned || null,
            seerResult: outcome.seerResult || null
        },

        // 元数据
        timestamp: Date.now()
    };
};

/**
 * 创建逻辑断言节点
 * @param {string} type - 断言类型
 * @param {string} content - 断言内容
 * @param {number|null} target - 目标玩家ID
 * @param {number} confidence - 置信度 0-1
 * @returns {Object} 逻辑断言节点
 */
export const createLogicNode = (type, content, target = null, confidence = 0.8) => {
    return {
        type,
        content,
        target,
        confidence,
        timestamp: Date.now()
    };
};

// ============================================================
// 辅助函数：信息提取
// ============================================================

/**
 * 从发言内容中提取摘要
 * @param {string} content - 发言内容
 * @param {number} maxLength - 最大长度
 * @returns {string} 摘要
 */
export const extractSummary = (content, maxLength = 50) => {
    if (!content) return '';
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength - 3) + '...';
};

/**
 * 从发言内容中提取提到的玩家ID
 * @param {string} content - 发言内容
 * @returns {number[]} 提到的玩家ID列表
 */
export const extractMentionedPlayers = (content) => {
    if (!content) return [];
    // 匹配 "X号" 模式
    const matches = content.match(/(\d+)号/g);
    if (!matches) return [];
    return [...new Set(matches.map(m => parseInt(m.replace('号', ''))))];
};

/**
 * 从发言中提取逻辑断言
 * @param {string} content - 发言内容
 * @param {number} speakerId - 发言者ID
 * @returns {Object[]} 逻辑断言列表
 */
export const extractLogicNodes = (content, speakerId) => {
    const nodes = [];
    if (!content) return nodes;

    // 身份声称模式
    const claimPatterns = [
        { regex: /我是预言家/g, role: '预言家' },
        { regex: /我是女巫/g, role: '女巫' },
        { regex: /我是猎人/g, role: '猎人' },
        { regex: /我是守卫/g, role: '守卫' },
        { regex: /我是(好人|村民)/g, role: '村民' }
    ];

    for (const pattern of claimPatterns) {
        if (pattern.regex.test(content)) {
            nodes.push(createLogicNode(LOGIC_NODE_TYPES.CLAIM, `声称${pattern.role}`, null, 0.9));
        }
    }

    // 金水/查杀模式
    const goldWaterMatch = content.match(/(\d+)号(是)?金水/g);
    if (goldWaterMatch) {
        goldWaterMatch.forEach(m => {
            const targetId = parseInt(m.match(/\d+/)[0]);
            nodes.push(createLogicNode(LOGIC_NODE_TYPES.VERIFY, `${targetId}号是金水`, targetId, 0.95));
        });
    }

    const killMatch = content.match(/(\d+)号(是)?(查杀|狼)/g);
    if (killMatch) {
        killMatch.forEach(m => {
            const targetId = parseInt(m.match(/\d+/)[0]);
            nodes.push(createLogicNode(LOGIC_NODE_TYPES.ACCUSE, `查杀${targetId}号`, targetId, 0.9));
        });
    }

    // 投票意向模式
    const voteMatch = content.match(/(投|归票|出)(\d+)号/g);
    if (voteMatch) {
        voteMatch.forEach(m => {
            const targetId = parseInt(m.match(/\d+/)[0]);
            nodes.push(createLogicNode(LOGIC_NODE_TYPES.VOTE_INTENT, `投票${targetId}号`, targetId, 0.85));
        });
    }

    // 怀疑/踩人模式
    const suspectMatch = content.match(/(怀疑|觉得|感觉)(\d+)号.*(狼|问题|可疑)/g);
    if (suspectMatch) {
        suspectMatch.forEach(m => {
            const targetId = parseInt(m.match(/\d+/)[0]);
            nodes.push(createLogicNode(LOGIC_NODE_TYPES.DOUBT, `怀疑${targetId}号`, targetId, 0.7));
        });
    }

    // 站边/支持模式
    const supportMatch = content.match(/(站边?|支持|相信)(\d+)号/g);
    if (supportMatch) {
        supportMatch.forEach(m => {
            const targetId = parseInt(m.match(/\d+/)[0]);
            nodes.push(createLogicNode(LOGIC_NODE_TYPES.SUPPORT, `支持${targetId}号`, targetId, 0.8));
        });
    }

    return nodes;
};

/**
 * 分析发言的情感倾向
 * @param {string} content - 发言内容
 * @returns {string} 情感类型
 */
export const analyzeSentiment = (content) => {
    if (!content) return SENTIMENT_TYPES.NEUTRAL;

    // 简单的关键词匹配
    const aggressiveKeywords = ['肯定是狼', '必须出', '绝对', '一定是'];
    const defensiveKeywords = ['我不是', '冤枉', '相信我', '我真的'];
    const hesitantKeywords = ['可能', '也许', '不确定', '感觉'];
    const emotionalKeywords = ['！', '???', '怎么可能', '不会吧'];

    let scores = {
        [SENTIMENT_TYPES.AGGRESSIVE]: 0,
        [SENTIMENT_TYPES.DEFENSIVE]: 0,
        [SENTIMENT_TYPES.HESITANT]: 0,
        [SENTIMENT_TYPES.EMOTIONAL]: 0
    };

    aggressiveKeywords.forEach(kw => { if (content.includes(kw)) scores[SENTIMENT_TYPES.AGGRESSIVE]++; });
    defensiveKeywords.forEach(kw => { if (content.includes(kw)) scores[SENTIMENT_TYPES.DEFENSIVE]++; });
    hesitantKeywords.forEach(kw => { if (content.includes(kw)) scores[SENTIMENT_TYPES.HESITANT]++; });
    emotionalKeywords.forEach(kw => { if (content.includes(kw)) scores[SENTIMENT_TYPES.EMOTIONAL]++; });

    const maxType = Object.entries(scores).reduce((a, b) => a[1] > b[1] ? a : b);
    return maxType[1] > 0 ? maxType[0] : SENTIMENT_TYPES.NEUTRAL;
};

/**
 * 分析投票模式
 * @param {Object[]} votes - 投票列表
 * @returns {Object} 投票模式分析结果
 */
export const analyzeVotePatterns = (votes) => {
    if (!votes || votes.length === 0) return { clusteredVotes: [], unexpectedVotes: [] };

    // 统计每个目标的投票者
    const voteGroups = {};
    votes.forEach(v => {
        if (!voteGroups[v.to]) voteGroups[v.to] = [];
        voteGroups[v.to].push(v.from);
    });

    // 找出投票集群（3人以上投同一目标）
    const clusteredVotes = Object.entries(voteGroups)
        .filter(([_, voters]) => voters.length >= 3)
        .map(([target, voters]) => ({ target: parseInt(target), voters }));

    // 找出异常投票（与大多数人不同）
    const mostVotedTarget = Object.entries(voteGroups)
        .sort((a, b) => b[1].length - a[1].length)[0];

    const unexpectedVotes = mostVotedTarget
        ? votes.filter(v => v.to !== parseInt(mostVotedTarget[0]))
            .map(v => ({ from: v.from, to: v.to, anomalyScore: 0.5 + (0.5 / votes.length) }))
        : [];

    return { clusteredVotes, unexpectedVotes };
};

// ============================================================
// 声称身份检测
// ============================================================

/**
 * 从发言中检测声称的身份
 * @param {string} content - 发言内容
 * @returns {string|null} 声称的身份
 */
export const detectClaimedRole = (content) => {
    if (!content) return null;

    const rolePatterns = {
        '预言家': /我是预言家|我跳预言家|预言家是我/,
        '女巫': /我是女巫|我有(解|毒)药|女巫是我/,
        '猎人': /我是猎人|我有枪|猎人是我/,
        '守卫': /我是守卫|我能守人|守卫是我/,
        '村民': /我是(村民|平民|好人)/
    };

    for (const [role, pattern] of Object.entries(rolePatterns)) {
        if (pattern.test(content)) {
            return role;
        }
    }

    return null;
};

// ============================================================
// 数据增强函数
// ============================================================

/**
 * 增强发言记录，添加结构化信息
 * @param {Object} speechRecord - 原始发言记录
 * @returns {Object} 增强后的发言记录
 */
export const enhanceSpeechRecord = (speechRecord) => {
    const { content, playerId } = speechRecord;

    return {
        ...speechRecord,
        logicNodes: extractLogicNodes(content, playerId),
        sentiment: analyzeSentiment(content),
        claimedRole: detectClaimedRole(content),
        mentionedPlayers: extractMentionedPlayers(content)
    };
};

/**
 * 批量增强发言历史
 * @param {Object[]} speechHistory - 发言历史
 * @returns {Object[]} 增强后的发言历史
 */
export const enhanceSpeechHistory = (speechHistory) => {
    return speechHistory.map(speech => {
        // 如果已经是新格式，只更新缺失字段
        if (speech.logicNodes) return speech;

        // 兼容旧格式
        const record = createSpeechRecord({
            playerId: speech.playerId,
            day: speech.day,
            phase: speech.phase || 'discussion',
            content: speech.content,
            thought: speech.thought,
            voteIntention: speech.voteIntention,
            summary: speech.summary
        });

        return enhanceSpeechRecord(record);
    });
};

// ============================================================
// 导出Schema类型定义（供TypeScript或文档使用）
// ============================================================

export const SCHEMA_VERSION = '1.0.0';

export const SchemaTypes = {
    SpeechRecord: 'SpeechRecord',
    VoteRecord: 'VoteRecord',
    NightActionRecord: 'NightActionRecord',
    LogicNode: 'LogicNode'
};
