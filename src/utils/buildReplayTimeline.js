/**
 * 从结构化游戏状态构建回放时间线。
 *
 * 输入：与 exportGameLog 相同的参数（结构化历史数据）。
 * 输出：{ meta, players, timeline } — 可序列化的回放 JSON。
 *
 * timeline 中的事件按真实游戏顺序排列，viewer 按 index 逐步播放。
 */

export function buildReplayTimeline({
  players,
  dayCount,
  deathHistory = [],
  speechHistory = [],
  voteHistory = [],
  seerChecks = [],
  guardHistory = [],
  witchHistory = { savedIds: [], poisonedIds: [] },
  nightActionHistory = [],
  gameResult = null,
  victoryMode = 'edge',
  claimHistory = [],
}) {
  const timeline = [];

  const deathsByPhase = {};
  deathHistory.forEach((d) => {
    const key = `${d.day}_${d.phase}`;
    if (!deathsByPhase[key]) deathsByPhase[key] = [];
    deathsByPhase[key].push(d);
  });

  const nightActionsByNight = {};
  nightActionHistory.forEach((a) => {
    const night = a.night ?? a.day ?? 0;
    if (!nightActionsByNight[night]) nightActionsByNight[night] = [];
    nightActionsByNight[night].push(a);
  });

  const speechesByDay = {};
  speechHistory.forEach((s) => {
    if (!speechesByDay[s.day]) speechesByDay[s.day] = [];
    speechesByDay[s.day].push(s);
  });

  const votesByDay = {};
  voteHistory.forEach((v) => {
    votesByDay[v.day] = v;
  });

  for (let day = 1; day <= dayCount; day++) {
    // ── Night ──
    timeline.push({ type: 'night_start', day });

    const nightActions = nightActionsByNight[day] || [];
    nightActions.forEach((a) => {
      timeline.push({
        type: 'action',
        day,
        phase: 'night',
        playerId: a.playerId,
        action: a.type || '行动',
        target: a.target ?? null,
        result: a.result || null,
        thought: a.thought || null,
        description: a.description || null,
      });
    });

    // Seer checks for this night
    seerChecks.filter((c) => c.night === day).forEach((c) => {
      const alreadyRecorded = nightActions.some(
        (a) => a.playerId === c.seerId && a.type === '查验'
      );
      if (!alreadyRecorded) {
        timeline.push({
          type: 'action',
          day,
          phase: 'night',
          playerId: c.seerId,
          action: '查验',
          target: c.targetId,
          result: c.isWolf ? '狼人' : '好人',
          thought: c.thought || null,
        });
      }
    });

    // Guard actions for this night
    guardHistory.filter((g) => g.night === day).forEach((g) => {
      const alreadyRecorded = nightActions.some(
        (a) => a.playerId !== undefined && a.type === '守护' && a.night === day
      );
      if (!alreadyRecorded) {
        timeline.push({
          type: 'action',
          day,
          phase: 'night',
          playerId: null,
          action: '守护',
          target: g.targetId ?? null,
          thought: g.thought || null,
        });
      }
    });

    // ── Day start — announce deaths ──
    const nightDeaths = (deathsByPhase[`${day}_night`] || [])
      .concat(deathsByPhase[`${day}_夜晚`] || []);
    timeline.push({
      type: 'day_start',
      day,
      deaths: nightDeaths.map((d) => d.playerId),
    });

    // ── Speeches ──
    const daySpeeches = speechesByDay[day] || [];
    daySpeeches.forEach((s) => {
      timeline.push({
        type: 'speech',
        day,
        playerId: s.playerId,
        name: s.name,
        content: s.content,
        thought: s.thought || null,
        voteIntention: s.voteIntention ?? null,
        summary: s.summary || null,
        identityTable: s.identity_table || null,
      });
    });

    // ── Claims ──
    (claimHistory || []).filter((c) => c.day === day).forEach((c) => {
      timeline.push({
        type: 'claim',
        day,
        playerId: c.playerId,
        claimType: c.type,
        payload: c.payload || null,
      });
    });

    // ── Votes ──
    const dayVote = votesByDay[day];
    if (dayVote) {
      timeline.push({
        type: 'vote',
        day,
        votes: (dayVote.votes || []).map((v) => ({
          from: v.from,
          to: v.to,
          reasoning: v.reasoning || null,
          thought: v.thought || null,
        })),
        eliminated: dayVote.eliminated ?? null,
      });

      // Day deaths (elimination)
      const dayDeaths = (deathsByPhase[`${day}_day`] || [])
        .concat(deathsByPhase[`${day}_白天`] || []);
      if (dayDeaths.length > 0) {
        timeline.push({
          type: 'elimination',
          day,
          deaths: dayDeaths.map((d) => d.playerId),
        });
      }
    }
  }

  // ── Game over ──
  if (gameResult) {
    timeline.push({ type: 'game_over', winner: gameResult });
  }

  return {
    meta: {
      dayCount,
      playerCount: players.length,
      winner: gameResult,
      victoryMode,
      exportTime: new Date().toISOString(),
    },
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      personality: p.personality || null,
      finalStatus: p.isAlive ? 'alive' : 'dead',
      isUser: !!p.isUser,
    })),
    timeline,
  };
}
