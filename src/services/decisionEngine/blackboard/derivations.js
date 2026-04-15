/**
 * 派生指标：从原始 state 计算出决策需要的结构化信号
 *
 * - parseSeerClaims: 从发言里抽出"我是预言家 + 查杀/金水"声明
 * - computeSuspicionScores: 每个存活玩家的怀疑分 (0-100)
 * - computeTrustScores: 每个存活玩家的信任分 (0-100)
 */

// ────────────────────────────────────────────────
// 预言家跳身份解析
// ────────────────────────────────────────────────

/**
 * 从发言历史里提取所有跳预言家的声明（含每晚查验结果）
 * 返回形如：[{ playerId, firstClaimDay, kills: [ids], goldWaters: [ids] }, ...]
 */
export function parseSeerClaims(speechHistory) {
  const claimMap = new Map();

  for (const s of speechHistory) {
    const content = (s.content || s.speech || '').toString();
    const claimed = s.claimedRole === '预言家' || /我是预言家|我跳预言家/.test(content);
    if (!claimed) continue;

    if (!claimMap.has(s.playerId)) {
      claimMap.set(s.playerId, {
        playerId: s.playerId,
        firstClaimDay: s.day,
        kills: new Set(),
        goldWaters: new Set(),
      });
    }
    const claim = claimMap.get(s.playerId);

    // 优先用结构化 logicNodes
    if (Array.isArray(s.logicNodes)) {
      for (const node of s.logicNodes) {
        if (node.type === 'accuse' && node.targetId != null && /狼|查杀/.test(node.text || '')) {
          claim.kills.add(node.targetId);
        }
        if (node.type === 'defend' && node.targetId != null && /金水|好人/.test(node.text || '')) {
          claim.goldWaters.add(node.targetId);
        }
      }
    }

    // 回退：简单文本匹配
    const killMatch = content.match(/查杀\s*(\d+)号/g) || content.match(/(\d+)号\s*查杀/g);
    if (killMatch) {
      killMatch.forEach(m => {
        const id = parseInt(m.match(/\d+/)?.[0], 10);
        if (!Number.isNaN(id)) claim.kills.add(id);
      });
    }
    const goldMatch = content.match(/金水\s*(\d+)号/g) || content.match(/(\d+)号\s*金水/g);
    if (goldMatch) {
      goldMatch.forEach(m => {
        const id = parseInt(m.match(/\d+/)?.[0], 10);
        if (!Number.isNaN(id)) claim.goldWaters.add(id);
      });
    }
  }

  return Array.from(claimMap.values()).map(c => ({
    playerId: c.playerId,
    firstClaimDay: c.firstClaimDay,
    kills: Array.from(c.kills),
    goldWaters: Array.from(c.goldWaters),
  }));
}

// ────────────────────────────────────────────────
// 怀疑 / 信任 分
// ────────────────────────────────────────────────

/**
 * 计算每个存活玩家的怀疑分（0-100）
 * 规则（初版，可调）：
 *   - 被预言家查杀：+50
 *   - 被多人指控：每次 +5
 *   - 对立跳预言家（有其他预言家跳时）：+15
 *   - 为被查杀玩家辩护：+8
 */
export function computeSuspicionScores(state) {
  const { alivePlayers, speechHistory, seerClaims, self } = state;
  const scores = new Map(alivePlayers.map(p => [p.id, 0]));

  // 汇总所有跳预言家指出的查杀目标
  const killedIds = new Set();
  for (const claim of seerClaims) {
    claim.kills.forEach(id => killedIds.add(id));
  }

  killedIds.forEach(id => {
    if (scores.has(id)) scores.set(id, scores.get(id) + 50);
  });

  // 多预言家对抗：后跳的预言家嫌疑 +15
  if (seerClaims.length >= 2) {
    const sorted = [...seerClaims].sort((a, b) => a.firstClaimDay - b.firstClaimDay);
    sorted.slice(1).forEach(c => {
      if (scores.has(c.playerId)) {
        scores.set(c.playerId, scores.get(c.playerId) + 15);
      }
    });
  }

  // 遍历发言里的指控/辩护信号
  for (const s of speechHistory) {
    if (s.playerId === self.id) continue;
    if (!Array.isArray(s.logicNodes)) continue;
    for (const node of s.logicNodes) {
      if (node.type === 'accuse' && node.targetId != null && scores.has(s.playerId)) {
        // 指控发出者本身不加分，被指控者 +5
        if (scores.has(node.targetId)) {
          scores.set(node.targetId, scores.get(node.targetId) + 5);
        }
      }
      if (node.type === 'defend' && killedIds.has(node.targetId) && scores.has(s.playerId)) {
        // 为被查杀玩家辩护 → 嫌疑 +8
        scores.set(s.playerId, scores.get(s.playerId) + 8);
      }
    }
  }

  return scores;
}

/**
 * 信任分：被预言家验过金水 +60，多个预言家相互验证 +15
 */
export function computeTrustScores(state) {
  const { alivePlayers, seerClaims } = state;
  const scores = new Map(alivePlayers.map(p => [p.id, 0]));

  for (const claim of seerClaims) {
    claim.goldWaters.forEach(id => {
      if (scores.has(id)) scores.set(id, scores.get(id) + 60);
    });
    // 跳预言家本身算 +20 信任（除非有对立）
    if (scores.has(claim.playerId)) {
      const bonus = seerClaims.length === 1 ? 30 : 10;
      scores.set(claim.playerId, scores.get(claim.playerId) + bonus);
    }
  }

  return scores;
}
