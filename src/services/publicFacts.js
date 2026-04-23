/**
 * publicFacts.js — 权威公共事实生成器
 *
 * 解决问题：
 *   AI agent 从 speechHistory 自行总结"谁死了"、"谁查了谁"，
 *   导致幻觉事实（如"昨晚1号死亡"但1号实际存活）。
 *
 * 本模块从 authoritative game state 生成结构化事实块，
 * 注入 prompt 头部并附带"只允许基于这些事实推理"指令。
 * AI 不再需要从发言记录里自行提取公共信息。
 */
import { renderInvariantFacts } from './gameInvariants.js';

/**
 * 构建权威公共事实块
 * @param {object} gameState  完整游戏状态
 * @param {object} player     当前行动的玩家
 * @returns {string}          结构化文本，可直接拼入 prompt
 */
export function buildPublicFacts(gameState, player) {
  const { players, deathHistory, voteHistory, speechHistory, claimHistory, dayCount, phase } = gameState;

  const alive = players.filter(p => p.isAlive);
  const dead = players.filter(p => !p.isAlive);

  const sections = [];

  // ── 1. 存活/死亡名单（最重要的基础事实）──
  sections.push(`【存活玩家】共${alive.length}人: ${alive.map(p => `${p.id}号`).join(', ')}`);
  if (dead.length > 0) {
    const deadInfo = dead.map(id => {
      const record = deathHistory.find(d => d.playerId === id.id);
      return `${id.id}号(${record ? `D${record.day}${record.phase}${record.cause}` : '已出局'})`;
    });
    sections.push(`【已出局玩家】${deadInfo.join(', ')}`);
  } else {
    sections.push(`【已出局玩家】无`);
  }

  // ── 2. 昨晚结果 ──
  const targetNight = phase === 'night' ? dayCount - 1 : dayCount;
  if (targetNight >= 1) {
    const nightDeaths = deathHistory.filter(d => d.day === targetNight && d.phase === '夜');
    if (nightDeaths.length > 0) {
      sections.push(`【昨晚(第${targetNight}夜)结果】死亡: ${nightDeaths.map(d => `${d.playerId}号`).join(', ')}`);
    } else {
      sections.push(`【昨晚(第${targetNight}夜)结果】平安夜，无人死亡`);
    }
  }

  // ── 3. 完整事件时间线 ──
  const timeline = [];
  for (let day = 1; day <= dayCount; day++) {
    const nDeaths = deathHistory.filter(d => d.day === day && d.phase === '夜');
    const dDeaths = deathHistory.filter(d => d.day === day && (d.phase === '投票' || d.phase === '猎人枪'));

    if (nDeaths.length > 0) {
      timeline.push(`N${day}: ${nDeaths.map(d => `${d.playerId}号死亡`).join(', ')}`);
    } else if (day < dayCount || (day === dayCount && phase !== 'night')) {
      timeline.push(`N${day}: 平安夜`);
    }
    if (dDeaths.length > 0) {
      timeline.push(`D${day}: ${dDeaths.map(d => `${d.playerId}号${d.cause}`).join(', ')}`);
    }
  }
  if (timeline.length > 0) {
    sections.push(`【事件时间线】${timeline.join(' → ')}`);
  }

  // ── 4. 投票历史（权威，非自行回忆）──
  if (voteHistory.length > 0) {
    const voteLines = voteHistory.map(v => {
      const voteSummary = v.votes.map(vote =>
        `${vote.from}→${vote.to === -1 ? '弃票' : vote.to}`
      ).join(', ');
      const result = v.eliminated !== -1 ? `${v.eliminated}号出局` : '流票';
      return `D${v.day}: ${voteSummary} => ${result}`;
    });
    sections.push(`【投票记录】\n${voteLines.join('\n')}`);
  }

  // ── 5. 公开声明摘要 ──
  // 柱三：优先读结构化 claimHistory；若为空（旧存档/首局冷启动）降级到正则 NLP
  const claims = (Array.isArray(claimHistory) && claimHistory.length > 0)
    ? formatStructuredClaims(claimHistory)
    : extractPublicClaims(speechHistory, dayCount);
  if (claims.length > 0) {
    sections.push(`【公开声明】${claims.join('; ')}`);
  }

  // ── 6. 角色私有信息 ──
  const privateInfo = buildPrivateInfo(gameState, player);
  if (privateInfo) {
    sections.push(`【你的私有信息】${privateInfo}`);
  }

  // ── 7. 柱四：全局不变量（剩余狼上限、残局模式、狼多警告）──
  const invariantBlock = renderInvariantFacts(gameState);
  if (invariantBlock) {
    sections.push(invariantBlock);
  }

  // ── 组装 + 指令 ──
  return `=== 权威事实（系统生成，你必须以此为准） ===
${sections.join('\n')}
=== 结束 ===
【重要】以上事实由系统从游戏状态直接生成，是唯一可信来源。
禁止引用或编造以上未列出的事实。如果你的记忆与权威事实冲突，以权威事实为准。`;
}

/**
 * 柱三：格式化结构化声明事件（从 claimHistory）
 * 每条 claim 形如 { day, playerId, type, payload }
 */
function formatStructuredClaims(claimHistory) {
  const roleNameMap = {
    jump_seer: '预言家',
    jump_witch: '女巫',
    jump_guard: '守卫',
    jump_hunter: '猎人',
    jump_knight: '骑士',
    jump_dreamweaver: '摄梦人',
    jump_magician: '魔术师',
    claim_villager: '村民',
  };
  const lines = [];
  for (const c of claimHistory) {
    const base = `${c.playerId}号(D${c.day})`;
    if (roleNameMap[c.type]) {
      let detail = `声称是${roleNameMap[c.type]}`;
      const p = c.payload || {};
      if (c.type === 'jump_seer' && Array.isArray(p.checks) && p.checks.length > 0) {
        const checksStr = p.checks.map(ck =>
          `N${ck.night}查${ck.targetId}=${ck.isWolf ? '狼' : '好'}`
        ).join(',');
        detail += `【${checksStr}】`;
      } else if (c.type === 'jump_witch') {
        const parts = [];
        if (p.antidoteUsed) parts.push(`救${p.antidoteTarget ?? '?'}`);
        if (p.poisonUsed) parts.push(`毒${p.poisonTarget ?? '?'}`);
        if (parts.length) detail += `【${parts.join(',')}】`;
      } else if (c.type === 'jump_guard' && p.lastGuardTarget != null) {
        detail += `【守${p.lastGuardTarget}】`;
      }
      lines.push(`${base}${detail}`);
    } else if (c.type === 'counter_claim') {
      lines.push(`${base}反指${c.payload?.targetPlayerId}号是${c.payload?.claimedRole || '狼'}`);
    }
  }
  return lines;
}

/**
 * 旧版：从 speechHistory 提取公开声明（跳预言家、跳女巫等）
 * 保留作为降级路径；主路径走 formatStructuredClaims
 */
function extractPublicClaims(speechHistory, dayCount) {
  const claims = [];
  const seerClaims = new Set();
  const witchClaims = new Set();

  for (const s of speechHistory) {
    const content = s.content || '';
    // 检测跳预言家声明
    if (/我是预言家|预言家身份|查验.+号/.test(content) && !seerClaims.has(s.playerId)) {
      seerClaims.add(s.playerId);
      claims.push(`${s.playerId}号(D${s.day})声称是预言家`);
    }
    // 检测跳女巫声明
    if (/我是女巫|女巫身份|用了解药|用了毒药/.test(content) && !witchClaims.has(s.playerId)) {
      witchClaims.add(s.playerId);
      claims.push(`${s.playerId}号(D${s.day})声称是女巫`);
    }
  }

  return claims;
}

/**
 * 构建角色私有信息（只有该玩家知道的事实）
 */
function buildPrivateInfo(gameState, player) {
  const { seerChecks, nightDecisions, guardHistory, witchHistory } = gameState;
  const parts = [];

  if (player.role === '狼人') {
    const teammates = gameState.players.filter(p => p.role === '狼人' && p.id !== player.id);
    if (teammates.length > 0) {
      parts.push(`狼队友: ${teammates.map(t => `${t.id}号${t.isAlive ? '' : '(已死)'}`).join(', ')}`);
    }
  }

  if (player.role === '预言家') {
    const myChecks = (seerChecks || []).filter(c => c.seerId === player.id);
    if (myChecks.length > 0) {
      parts.push(`你的查验结果: ${myChecks.map(c => `N${c.night}查${c.targetId}号=${c.isWolf ? '狼人' : '好人'}`).join(', ')}`);
    }
  }

  if (player.role === '女巫') {
    parts.push(`解药: ${player.hasWitchSave ? '可用' : '已使用'}`);
    parts.push(`毒药: ${player.hasWitchPoison ? '可用' : '已使用'}`);
    if (nightDecisions?.wolfTarget != null) {
      parts.push(`今晚被刀: ${nightDecisions.wolfTarget}号`);
    }
  }

  if (player.role === '守卫') {
    const lastGuard = nightDecisions?.lastGuardTarget;
    parts.push(`上晚守护: ${lastGuard != null ? `${lastGuard}号(今晚不能连守)` : '无'}`);
  }

  return parts.length > 0 ? parts.join('; ') : null;
}
