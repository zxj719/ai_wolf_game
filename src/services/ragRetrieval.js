/**
 * RAG检索服务 - P0优化
 *
 * 基于报告理论：提供结构化数据检索，支持逻辑推理和信任评估
 * 功能：发言检索、投票分析、矛盾检测、身份追踪
 */

import {
    LOGIC_NODE_TYPES,
    extractLogicNodes,
    extractMentionedPlayers,
    analyzeSentiment,
    detectClaimedRole,
    enhanceSpeechRecord,
    analyzeVotePatterns
} from './ragSchema';

// ============================================================
// 发言检索函数
// ============================================================

/**
 * 获取某玩家的所有声明
 * @param {Object[]} speechHistory - 发言历史
 * @param {number} playerId - 玩家ID
 * @param {string} claimType - 声明类型（可选）
 * @returns {Object[]} 声明列表
 */
export const getPlayerClaims = (speechHistory, playerId, claimType = null) => {
    const claims = [];

    speechHistory
        .filter(s => s.playerId === playerId)
        .forEach(speech => {
            const nodes = speech.logicNodes || extractLogicNodes(speech.content, playerId);
            nodes
                .filter(n => n.type === LOGIC_NODE_TYPES.CLAIM)
                .filter(n => !claimType || n.content.includes(claimType))
                .forEach(n => claims.push({
                    ...n,
                    day: speech.day,
                    speechId: speech.id
                }));
        });

    return claims;
};

/**
 * 获取针对某玩家的所有指控
 * @param {Object[]} speechHistory - 发言历史
 * @param {number} targetId - 目标玩家ID
 * @returns {Object[]} 指控列表
 */
export const getAccusationsAgainst = (speechHistory, targetId) => {
    const accusations = [];

    speechHistory.forEach(speech => {
        const nodes = speech.logicNodes || extractLogicNodes(speech.content, speech.playerId);
        nodes
            .filter(n => n.type === LOGIC_NODE_TYPES.ACCUSE && n.target === targetId)
            .forEach(n => accusations.push({
                ...n,
                accuserId: speech.playerId,
                day: speech.day,
                context: speech.content
            }));
    });

    return accusations;
};

/**
 * 获取某玩家获得的金水/查杀记录
 * @param {Object[]} speechHistory - 发言历史
 * @param {number} targetId - 目标玩家ID
 * @returns {Object} { goldWaters: [], kills: [] }
 */
export const getVerificationStatus = (speechHistory, targetId) => {
    const goldWaters = [];
    const kills = [];

    speechHistory.forEach(speech => {
        const nodes = speech.logicNodes || extractLogicNodes(speech.content, speech.playerId);
        nodes
            .filter(n => n.type === LOGIC_NODE_TYPES.VERIFY && n.target === targetId)
            .forEach(n => {
                if (n.content.includes('金水')) {
                    goldWaters.push({
                        seerId: speech.playerId,
                        day: speech.day,
                        content: n.content
                    });
                }
            });

        nodes
            .filter(n => n.type === LOGIC_NODE_TYPES.ACCUSE && n.target === targetId)
            .filter(n => n.content.includes('查杀'))
            .forEach(n => {
                kills.push({
                    seerId: speech.playerId,
                    day: speech.day,
                    content: n.content
                });
            });
    });

    return { goldWaters, kills };
};

/**
 * 获取某玩家的站边记录
 * @param {Object[]} speechHistory - 发言历史
 * @param {number} playerId - 玩家ID
 * @returns {Object[]} 站边记录列表
 */
export const getPlayerStances = (speechHistory, playerId) => {
    const stances = [];

    speechHistory
        .filter(s => s.playerId === playerId)
        .forEach(speech => {
            const nodes = speech.logicNodes || extractLogicNodes(speech.content, playerId);
            nodes
                .filter(n => n.type === LOGIC_NODE_TYPES.SUPPORT)
                .forEach(n => stances.push({
                    supportedPlayer: n.target,
                    day: speech.day,
                    content: n.content
                }));
        });

    return stances;
};

// ============================================================
// 投票分析函数
// ============================================================

/**
 * 获取投票异常模式
 * @param {Object[]} voteHistory - 投票历史
 * @param {number} day - 指定天数（可选）
 * @returns {Object[]} 异常投票列表
 */
export const getVotingAnomalies = (voteHistory, day = null) => {
    const anomalies = [];

    const filteredVotes = day ? voteHistory.filter(v => v.day === day) : voteHistory;

    filteredVotes.forEach(vote => {
        const patterns = vote.patterns || analyzeVotePatterns(vote.votes);
        patterns.unexpectedVotes.forEach(uv => {
            anomalies.push({
                day: vote.day,
                ...uv
            });
        });
    });

    return anomalies;
};

/**
 * 获取某玩家的投票历史
 * @param {Object[]} voteHistory - 投票历史
 * @param {number} playerId - 玩家ID
 * @returns {Object[]} 投票记录列表
 */
export const getPlayerVoteHistory = (voteHistory, playerId) => {
    const history = [];

    voteHistory.forEach(vote => {
        const playerVote = vote.votes.find(v => v.from === playerId);
        if (playerVote) {
            history.push({
                day: vote.day,
                votedFor: playerVote.to,
                reasoning: playerVote.reasoning,
                wasConsistent: playerVote.wasConsistent,
                eliminated: vote.eliminated
            });
        }
    });

    return history;
};

/**
 * 检查某玩家是否投票给过特定目标
 * @param {Object[]} voteHistory - 投票历史
 * @param {number} voterId - 投票者ID
 * @param {number} targetId - 目标ID
 * @returns {Object|null} 投票记录或null
 */
export const hasVotedFor = (voteHistory, voterId, targetId) => {
    for (const vote of voteHistory) {
        const found = vote.votes.find(v => v.from === voterId && v.to === targetId);
        if (found) {
            return { day: vote.day, ...found };
        }
    }
    return null;
};

// ============================================================
// 矛盾检测函数
// ============================================================

/**
 * 检测某玩家发言中的逻辑矛盾
 * @param {Object[]} speechHistory - 发言历史
 * @param {number} playerId - 玩家ID
 * @returns {Object[]} 矛盾列表
 */
export const getLogicContradictions = (speechHistory, playerId) => {
    const contradictions = [];
    const playerSpeeches = speechHistory.filter(s => s.playerId === playerId);

    // 提取所有断言
    const allNodes = [];
    playerSpeeches.forEach(speech => {
        const nodes = speech.logicNodes || extractLogicNodes(speech.content, playerId);
        nodes.forEach(n => allNodes.push({ ...n, day: speech.day }));
    });

    // 检测矛盾
    // 1. 对同一玩家的态度转变（先支持后怀疑，或反之）
    const supportedPlayers = allNodes.filter(n => n.type === LOGIC_NODE_TYPES.SUPPORT);
    const doubtedPlayers = allNodes.filter(n => n.type === LOGIC_NODE_TYPES.DOUBT || n.type === LOGIC_NODE_TYPES.ACCUSE);

    supportedPlayers.forEach(support => {
        const contradiction = doubtedPlayers.find(doubt =>
            doubt.target === support.target && doubt.day > support.day
        );
        if (contradiction) {
            contradictions.push({
                type: 'stance_reversal',
                description: `D${support.day}支持${support.target}号，D${contradiction.day}又怀疑`,
                target: support.target,
                dayRange: [support.day, contradiction.day],
                severity: 0.7
            });
        }
    });

    // 2. 投票意向与实际投票不一致（需要结合voteHistory检查）

    return contradictions;
};

/**
 * 检测投票与发言意向的一致性
 * @param {Object[]} speechHistory - 发言历史
 * @param {Object[]} voteHistory - 投票历史
 * @param {number} playerId - 玩家ID
 * @returns {Object[]} 不一致记录列表
 */
export const getVoteIntentionMismatches = (speechHistory, voteHistory, playerId) => {
    const mismatches = [];

    voteHistory.forEach(vote => {
        const playerVote = vote.votes.find(v => v.from === playerId);
        if (!playerVote) return;

        // 找到该天该玩家的投票意向
        const daySpeeches = speechHistory.filter(s => s.playerId === playerId && s.day === vote.day);
        daySpeeches.forEach(speech => {
            if (speech.voteIntention && speech.voteIntention !== playerVote.to) {
                mismatches.push({
                    day: vote.day,
                    statedIntention: speech.voteIntention,
                    actualVote: playerVote.to,
                    severity: 0.6
                });
            }
        });
    });

    return mismatches;
};

// ============================================================
// 身份追踪函数
// ============================================================

/**
 * 获取所有声称某身份的玩家
 * @param {Object[]} speechHistory - 发言历史
 * @param {string} role - 身份名称
 * @returns {Object[]} 声称该身份的玩家列表
 */
export const getPlayersClaimingRole = (speechHistory, role) => {
    const claimers = [];
    const seenPlayers = new Set();

    speechHistory.forEach(speech => {
        if (seenPlayers.has(speech.playerId)) return;

        const claimedRole = speech.claimedRole || detectClaimedRole(speech.content);
        if (claimedRole === role) {
            claimers.push({
                playerId: speech.playerId,
                day: speech.day,
                content: speech.content
            });
            seenPlayers.add(speech.playerId);
        }
    });

    return claimers;
};

/**
 * 构建预言家对抗信息
 * @param {Object[]} speechHistory - 发言历史
 * @param {Object[]} seerChecks - 预言家查验记录
 * @returns {Object} 预言家对抗分析
 */
export const buildSeerConflictInfo = (speechHistory, seerChecks) => {
    const claimedSeers = getPlayersClaimingRole(speechHistory, '预言家');

    if (claimedSeers.length <= 1) {
        return {
            hasConflict: false,
            seers: claimedSeers,
            analysis: claimedSeers.length === 1 ? '单预言家，无对跳' : '暂无预言家跳出'
        };
    }

    // 分析每个预言家的查验信息
    const seerAnalysis = claimedSeers.map(seer => {
        const checks = seerChecks.filter(c => c.seerId === seer.playerId);
        const verifications = [];

        speechHistory
            .filter(s => s.playerId === seer.playerId)
            .forEach(speech => {
                const nodes = speech.logicNodes || extractLogicNodes(speech.content, seer.playerId);
                nodes
                    .filter(n => n.type === LOGIC_NODE_TYPES.VERIFY)
                    .forEach(n => verifications.push({ day: speech.day, content: n.content, target: n.target }));
            });

        return {
            playerId: seer.playerId,
            claimDay: seer.day,
            checks,
            verifications
        };
    });

    // 检测金水/查杀冲突
    const conflicts = [];
    for (let i = 0; i < seerAnalysis.length; i++) {
        for (let j = i + 1; j < seerAnalysis.length; j++) {
            const seer1 = seerAnalysis[i];
            const seer2 = seerAnalysis[j];

            // 检查是否互相查杀
            seer1.verifications.forEach(v1 => {
                if (v1.target === seer2.playerId && v1.content.includes('查杀')) {
                    conflicts.push({
                        type: 'mutual_kill',
                        description: `${seer1.playerId}号查杀${seer2.playerId}号`
                    });
                }
            });

            // 检查对同一玩家的查验是否冲突
            seer1.verifications.forEach(v1 => {
                const conflicting = seer2.verifications.find(v2 =>
                    v2.target === v1.target &&
                    ((v1.content.includes('金水') && v2.content.includes('查杀')) ||
                        (v1.content.includes('查杀') && v2.content.includes('金水')))
                );
                if (conflicting) {
                    conflicts.push({
                        type: 'verification_conflict',
                        target: v1.target,
                        description: `对${v1.target}号查验结果冲突`
                    });
                }
            });
        }
    }

    return {
        hasConflict: true,
        seers: seerAnalysis,
        conflicts,
        analysis: `${claimedSeers.length}人对跳预言家，存在${conflicts.length}处冲突`
    };
};

// ============================================================
// 综合查询函数
// ============================================================

/**
 * 获取某玩家的完整画像
 * @param {Object} gameState - 游戏状态
 * @param {number} playerId - 玩家ID
 * @returns {Object} 玩家画像
 */
export const getPlayerProfile = (gameState, playerId) => {
    const { speechHistory, voteHistory, seerChecks, players } = gameState;
    const player = players.find(p => p.id === playerId);

    if (!player) return null;

    const claims = getPlayerClaims(speechHistory, playerId);
    const accusations = getAccusationsAgainst(speechHistory, playerId);
    const verification = getVerificationStatus(speechHistory, playerId);
    const stances = getPlayerStances(speechHistory, playerId);
    const voteHist = getPlayerVoteHistory(voteHistory, playerId);
    const contradictions = getLogicContradictions(speechHistory, playerId);
    const voteMismatches = getVoteIntentionMismatches(speechHistory, voteHistory, playerId);

    // 计算可信度得分
    let trustScore = 0.5; // 基础分
    trustScore += verification.goldWaters.length * 0.15;  // 金水加分
    trustScore -= verification.kills.length * 0.2;         // 查杀减分
    trustScore -= contradictions.length * 0.1;             // 矛盾减分
    trustScore -= voteMismatches.length * 0.08;            // 言行不一减分
    trustScore = Math.max(0, Math.min(1, trustScore));     // 限制在 0-1

    return {
        playerId,
        name: player.name,
        isAlive: player.isAlive,
        claimedRole: claims.length > 0 ? claims[0].content : null,

        // 关系数据
        claims,
        accusations,
        verification,
        stances,
        voteHistory: voteHist,

        // 分析数据
        contradictions,
        voteMismatches,

        // 综合评分
        trustScore,
        suspicionLevel: 1 - trustScore,

        // 摘要
        summary: buildPlayerSummary(player, claims, accusations, verification, trustScore)
    };
};

/**
 * 构建玩家摘要
 */
const buildPlayerSummary = (player, claims, accusations, verification, trustScore) => {
    const parts = [];

    if (claims.length > 0) {
        parts.push(`声称${claims[0].content.replace('声称', '')}`);
    }

    if (verification.goldWaters.length > 0) {
        parts.push(`被${verification.goldWaters.length}人发金水`);
    }

    if (verification.kills.length > 0) {
        parts.push(`被${verification.kills.length}人查杀`);
    }

    if (accusations.length > 0) {
        parts.push(`被${accusations.length}人怀疑`);
    }

    const trustLevel = trustScore > 0.7 ? '可信度高' :
        trustScore > 0.4 ? '可信度中' : '可信度低';
    parts.push(trustLevel);

    return parts.join('，') || '信息不足';
};

/**
 * 生成当前局势摘要
 * @param {Object} gameState - 游戏状态
 * @returns {Object} 局势摘要
 */
export const generateSituationSummary = (gameState) => {
    const { players, speechHistory, voteHistory, deathHistory, seerChecks, dayCount } = gameState;

    const alivePlayers = players.filter(p => p.isAlive);
    const deadPlayers = players.filter(p => !p.isAlive);

    // 预言家对抗情况
    const seerConflict = buildSeerConflictInfo(speechHistory, seerChecks);

    // 金水/查杀统计
    const verificationStats = {};
    alivePlayers.forEach(p => {
        const v = getVerificationStatus(speechHistory, p.id);
        if (v.goldWaters.length > 0 || v.kills.length > 0) {
            verificationStats[p.id] = v;
        }
    });

    // 投票异常
    const recentAnomalies = getVotingAnomalies(voteHistory, dayCount - 1);

    return {
        dayCount,
        aliveCount: alivePlayers.length,
        deadCount: deadPlayers.length,
        alivePlayerIds: alivePlayers.map(p => p.id),
        deadPlayerIds: deadPlayers.map(p => p.id),

        seerConflict,
        verificationStats,
        recentAnomalies,

        // 文字摘要
        textSummary: buildTextSummary(dayCount, alivePlayers, seerConflict, verificationStats)
    };
};

/**
 * 构建文字摘要
 */
const buildTextSummary = (dayCount, alivePlayers, seerConflict, verificationStats) => {
    const parts = [`第${dayCount}天，存活${alivePlayers.length}人`];

    if (seerConflict.hasConflict) {
        parts.push(seerConflict.analysis);
    } else if (seerConflict.seers.length === 1) {
        parts.push(`${seerConflict.seers[0].playerId}号跳预言家`);
    }

    const goldWaterPlayers = Object.entries(verificationStats)
        .filter(([_, v]) => v.goldWaters.length > 0)
        .map(([id]) => `${id}号`);

    if (goldWaterPlayers.length > 0) {
        parts.push(`金水：${goldWaterPlayers.join('、')}`);
    }

    const killedPlayers = Object.entries(verificationStats)
        .filter(([_, v]) => v.kills.length > 0)
        .map(([id]) => `${id}号`);

    if (killedPlayers.length > 0) {
        parts.push(`被查杀：${killedPlayers.join('、')}`);
    }

    return parts.join('。');
};

// ============================================================
// 导出
// ============================================================

export default {
    // 发言检索
    getPlayerClaims,
    getAccusationsAgainst,
    getVerificationStatus,
    getPlayerStances,

    // 投票分析
    getVotingAnomalies,
    getPlayerVoteHistory,
    hasVotedFor,

    // 矛盾检测
    getLogicContradictions,
    getVoteIntentionMismatches,

    // 身份追踪
    getPlayersClaimingRole,
    buildSeerConflictInfo,

    // 综合查询
    getPlayerProfile,
    generateSituationSummary
};
