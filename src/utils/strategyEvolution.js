/**
 * 策略进化系统
 *
 * 每局结束后提取策略摘要，存入DB。
 * 新局开始前加载近期策略，注入提示词作为"进化知识"。
 * AI通过阅读历史成败来迭代自己的策略选择。
 */

import { buildApiUrl } from '../services/apiBase';

/**
 * 从对局数据中提取策略摘要
 * @param {Object} gameState - 完整的游戏状态
 * @param {string} gameResult - 'wolves_win' | 'villagers_win'
 * @returns {Array} 每个玩家的策略条目
 */
export function extractStrategyJournal(gameState, gameResult) {
  const { players, speechHistory, voteHistory, claimHistory, deathHistory } = gameState;
  if (!players?.length) return [];

  const entries = [];

  for (const player of players) {
    const playerSpeeches = (speechHistory || []).filter(s => s.playerId === player.id);
    const playerClaims = (claimHistory || []).filter(c => c.playerId === player.id);
    const playerVotes = [];
    for (const round of (voteHistory || [])) {
      const vote = (round.votes || []).find(v => v.from === player.id);
      if (vote) playerVotes.push({ day: round.day, target: vote.to });
    }

    const isWolf = player.role === '狼人';
    const outcome = (isWolf && gameResult === 'wolves_win') || (!isWolf && gameResult === 'villagers_win')
      ? 'win' : 'lose';

    const strategiesUsed = [];
    const claimsMade = [];

    for (const claim of playerClaims) {
      claimsMade.push(claim.type || 'unknown');
      if (claim.type === 'jump_seer' && isWolf) {
        strategiesUsed.push('fake_seer_claim');
      } else if (claim.type === 'jump_seer' && !isWolf) {
        strategiesUsed.push('true_seer_reveal');
      } else if (claim.type?.startsWith('jump_')) {
        strategiesUsed.push(isWolf ? `fake_${claim.type}` : claim.type);
      } else if (claim.type === 'counter_claim') {
        strategiesUsed.push('counter_claim');
      }
    }

    if (isWolf && playerClaims.length === 0 && playerSpeeches.length > 0) {
      strategiesUsed.push('stealth_disguise');
    }

    const wasEliminated = (deathHistory || []).some(d => d.playerId === player.id && d.cause === 'vote');
    if (wasEliminated) strategiesUsed.push('eliminated_by_vote');

    const wolfTeammateVoted = isWolf && playerVotes.some(v => {
      const target = players.find(p => p.id === v.target);
      return target?.role === '狼人';
    });
    if (wolfTeammateVoted) strategiesUsed.push('voted_own_teammate');

    const keyMoments = [];
    if (playerClaims.length > 0) {
      keyMoments.push({ type: 'claims', claims: playerClaims.map(c => c.type) });
    }
    const deathRecord = (deathHistory || []).find(d => d.playerId === player.id);
    if (deathRecord) {
      keyMoments.push({ type: 'death', day: deathRecord.day, cause: deathRecord.cause });
    }

    entries.push({
      role: player.role,
      playerId: player.id,
      strategiesUsed,
      claimsMade,
      outcome,
      keyMoments,
    });
  }

  return entries;
}

/**
 * 保存策略日志到后端
 */
export async function saveStrategyJournal(gameId, entries) {
  try {
    await fetch(buildApiUrl('/api/game/strategy-journal'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId, entries }),
    });
  } catch (e) {
    console.warn('[StrategyEvolution] Failed to save journal:', e.message);
  }
}

/**
 * 加载近期策略进化数据并构建提示词上下文
 * @param {string} role - 当前角色 (e.g. '狼人')
 * @returns {string} 可注入系统提示词的进化知识块
 */
export async function loadEvolutionContext(role) {
  try {
    const res = await fetch(buildApiUrl(`/api/game/strategy-evolution?role=${encodeURIComponent(role)}&limit=15`));
    if (!res.ok) return '';
    const { entries } = await res.json();
    if (!entries?.length) return '';

    return buildEvolutionPrompt(entries, role);
  } catch (e) {
    console.warn('[StrategyEvolution] Failed to load evolution context:', e.message);
    return '';
  }
}

/**
 * 从历史条目构建进化知识提示词
 */
function buildEvolutionPrompt(entries, role) {
  const wins = entries.filter(e => e.outcome === 'win');
  const losses = entries.filter(e => e.outcome === 'lose');
  const winRate = entries.length > 0 ? Math.round((wins.length / entries.length) * 100) : 0;

  const strategyStats = {};
  for (const entry of entries) {
    const strategies = safeParseArray(entry.strategies_used);
    for (const s of strategies) {
      if (!strategyStats[s]) strategyStats[s] = { wins: 0, losses: 0 };
      if (entry.outcome === 'win') strategyStats[s].wins++;
      else strategyStats[s].losses++;
    }
  }

  const strategyLines = [];
  for (const [strategy, stats] of Object.entries(strategyStats)) {
    const total = stats.wins + stats.losses;
    if (total < 2) continue;
    const sr = Math.round((stats.wins / total) * 100);
    const label = STRATEGY_LABELS[strategy] || strategy;
    strategyLines.push(`- ${label}: ${total}次使用, 胜率${sr}%`);
  }

  if (strategyLines.length === 0) return '';

  return `
【近期对局进化知识（${role}视角，基于最近${entries.length}局数据）】
总体胜率: ${winRate}%
策略统计:
${strategyLines.join('\n')}
根据历史数据调整你的策略——高胜率策略可以更多使用，低胜率策略需要改进或放弃。`;
}

const STRATEGY_LABELS = {
  'fake_seer_claim': '声明预言家身份（伪装）',
  'true_seer_reveal': '公开预言家身份（真）',
  'stealth_disguise': '潜伏伪装',
  'counter_claim': '反指对方身份',
  'voted_own_teammate': '投票己方队友',
  'eliminated_by_vote': '被投票淘汰',
  'fake_jump_witch': '声明女巫身份（伪装）',
  'fake_jump_guard': '声明守卫身份（伪装）',
  'jump_witch': '公开女巫身份',
  'jump_guard': '公开守卫身份',
  'jump_hunter': '公开猎人身份',
};

function safeParseArray(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return []; }
  }
  return [];
}
