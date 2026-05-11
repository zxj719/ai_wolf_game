/**
 * 导出游戏日志为 .txt 文件并触发下载
 *
 * 设计目标：让单一 .txt 文件能够支持完整根因分析。
 * 包含：玩家身份、死亡、发言（带思考与意向）、投票、神职行动、AI 思考过程、
 * 推理表、声明事件流、完整事件流（logs）、当前阶段快照、游戏结果。
 */
const ABSTAIN_TARGET = -1;

function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function describeVictory({ gameResult, victoryMode, players }) {
  const aliveWolves = players.filter(p => p.isAlive && p.role === '狼人').length;
  const aliveVillagers = players.filter(p => p.isAlive && p.role === '村民').length;
  const aliveGods = players.filter(p => p.isAlive && p.role !== '狼人' && p.role !== '村民').length;
  const head = `胜利模式: ${victoryMode === 'edge' ? '屠边模式' : '屠城模式'}`;
  const stats = `存活: 狼${aliveWolves} 民${aliveVillagers} 神${aliveGods}`;
  if (gameResult === 'good_win') return `${head}\n${stats}\n游戏结果: 好人阵营胜利！`;
  if (gameResult === 'wolf_win') return `${head}\n${stats}\n游戏结果: 狼人阵营胜利！`;
  // 未结束：明确标注为快照，不再瞎猜赢家
  return `${head}\n${stats}\n游戏结果: 游戏尚未结束（中途导出快照）`;
}

export function exportGameLog({
  players,
  dayCount,
  deathHistory,
  speechHistory,
  voteHistory,
  seerChecks,
  guardHistory,
  witchHistory,
  victoryMode,
  nightActionHistory = [],
  gameResult = null,
  logs = [],
  claimHistory = [],
  currentPhaseData = null,
  phase = null,
  nightStep = null,
  nightDecisions = null,
}) {
  const timestamp = new Date().toLocaleString('zh-CN');
  let logContent = `========================================\n`;
  logContent += `狼人杀游戏记录\n`;
  logContent += `导出时间: ${timestamp}\n`;
  logContent += `游戏天数: ${dayCount}\n`;
  if (phase) logContent += `导出时阶段: ${phase}${nightStep != null ? ` (nightStep=${nightStep})` : ''}\n`;
  logContent += `========================================\n\n`;

  // 玩家身份列表
  logContent += `【玩家身份】\n`;
  logContent += `----------------------------------------\n`;
  players.forEach(p => {
    const status = p.isAlive ? '存活' : '死亡';
    const userMark = p.isUser ? ' (你)' : '';
    const flags = [];
    if (p.isPoisoned) flags.push('中毒');
    if (p.role === '女巫') {
      flags.push(p.hasWitchSave ? '解药✓' : '解药✗');
      flags.push(p.hasWitchPoison ? '毒药✓' : '毒药✗');
    }
    if (p.role === '猎人') flags.push(p.canHunterShoot ? '可开枪' : '不可开枪');
    const flagStr = flags.length ? ` [${flags.join('|')}]` : '';
    logContent += `${p.id}号 ${p.name}${userMark}: ${p.role} [${status}]${flagStr}\n`;
  });
  logContent += `\n`;

  // 死亡记录
  logContent += `【死亡记录】\n`;
  logContent += `----------------------------------------\n`;
  if (deathHistory.length === 0) {
    logContent += `无人死亡\n`;
  } else {
    deathHistory.forEach(d => {
      const player = players.find(p => p.id === d.playerId);
      logContent += `第${d.day}天${d.phase}: ${d.playerId}号 ${player?.name || ''} (${player?.role || '未知'}) - ${d.cause}\n`;
    });
  }
  logContent += `\n`;

  // 发言记录（包含AI思考过程）
  logContent += `【发言记录】\n`;
  logContent += `----------------------------------------\n`;
  if (speechHistory.length === 0) {
    logContent += `暂无发言\n`;
  } else {
    let currentDay = 0;
    speechHistory.forEach(s => {
      if (s.day !== currentDay) {
        currentDay = s.day;
        logContent += `\n--- 第${currentDay}天 ---\n`;
      }
      const player = players.find(p => p.id === s.playerId);
      const role = player?.role || '未知';
      logContent += `[${s.playerId}号 ${s.name} (${role})]: ${s.content}\n`;
      if (s.thought) {
        logContent += `  💭 思考过程: ${s.thought}\n`;
      }
      if (s.voteIntention !== undefined && s.voteIntention !== null) {
        logContent += `  🗳️ 投票意向: ${s.voteIntention === -1 ? '弃票' : s.voteIntention + '号'}\n`;
      }
      if (s.summary) logContent += `  📝 自我摘要: ${s.summary}\n`;
    });
  }
  logContent += `\n`;

  // 投票记录
  logContent += `【投票记录】\n`;
  logContent += `----------------------------------------\n`;
  if (voteHistory.length === 0) {
    logContent += `暂无投票\n`;
  } else {
    voteHistory.forEach(v => {
      logContent += `\n第${v.day}天投票:\n`;
      v.votes.forEach(vote => {
        const fromPlayer = players.find(p => p.id === vote.from);
        const toPlayer = players.find(p => p.id === vote.to);
        const voteTargetText = vote.to === ABSTAIN_TARGET ? '弃票' : `${vote.to}号(${toPlayer?.role || '?'})`;
        logContent += `  ${vote.from}号(${fromPlayer?.role || '?'}) -> ${voteTargetText}\n`;
        if (vote.reasoning) {
          logContent += `    📣 公开理由: ${vote.reasoning}\n`;
        }
        if (vote.thought) {
          logContent += `    💭 思考过程: ${vote.thought}\n`;
        }
      });
      if (v.eliminated === null || v.eliminated === undefined || v.eliminated === -1) {
        logContent += `  结果: 无人被放逐\n`;
      } else {
        const eliminated = players.find(p => p.id === v.eliminated);
        logContent += `  结果: ${v.eliminated}号 ${eliminated?.name || ''} (${eliminated?.role || '未知'}) 被放逐\n`;
      }
    });
  }
  logContent += `\n`;

  // 预言家查验记录
  logContent += `【预言家查验记录】\n`;
  logContent += `----------------------------------------\n`;
  if (seerChecks.length === 0) {
    logContent += `无查验记录\n`;
  } else {
    seerChecks.forEach(c => {
      const seer = players.find(p => p.id === c.seerId);
      const target = players.find(p => p.id === c.targetId);
      logContent += `第${c.night}夜: ${c.seerId}号(${seer?.name || ''}) 查验 ${c.targetId}号(${target?.name || ''}) = ${c.isWolf ? '狼人' : '好人'}\n`;
      if (c.thought) logContent += `  💭 思考过程: ${c.thought}\n`;
    });
  }
  logContent += `\n`;

  // 守卫记录
  logContent += `【守卫守护记录】\n`;
  logContent += `----------------------------------------\n`;
  if (!guardHistory || guardHistory.length === 0) {
    logContent += `无守护记录\n`;
  } else {
    guardHistory.forEach(g => {
      if (g.targetId == null) {
        logContent += `第${g.night}夜: 空守${g.reason ? `（${g.reason}）` : ''}\n`;
      } else {
        const target = players.find(p => p.id === g.targetId);
        logContent += `第${g.night}夜: 守护 ${g.targetId}号 ${target?.name || ''}\n`;
      }
      if (g.thought) logContent += `  💭 思考过程: ${g.thought}\n`;
    });
  }
  logContent += `\n`;

  // 女巫用药记录
  logContent += `【女巫用药记录】\n`;
  logContent += `----------------------------------------\n`;
  if (witchHistory.savedIds.length === 0 && witchHistory.poisonedIds.length === 0) {
    logContent += `无用药记录\n`;
  } else {
    if (witchHistory.savedIds.length > 0) {
      logContent += `解药救过: ${witchHistory.savedIds.map(id => {
        const p = players.find(x => x.id === id);
        return `${id}号(${p?.name || ''})`;
      }).join(', ')}\n`;
    }
    if (witchHistory.poisonedIds.length > 0) {
      logContent += `毒药毒过: ${witchHistory.poisonedIds.map(id => {
        const p = players.find(x => x.id === id);
        return `${id}号(${p?.name || ''})`;
      }).join(', ')}\n`;
    }
  }
  logContent += `\n`;

  // 结构化声明事件流（跳身份/对跳/反水等）
  logContent += `【结构化声明事件】\n`;
  logContent += `----------------------------------------\n`;
  if (!claimHistory || claimHistory.length === 0) {
    logContent += `无声明事件\n`;
  } else {
    claimHistory.forEach(c => {
      const player = players.find(p => p.id === c.playerId);
      const role = player?.role || '未知';
      const payloadStr = c.payload && Object.keys(c.payload).length
        ? ` ${JSON.stringify(c.payload)}`
        : '';
      logContent += `第${c.day}天 [${c.playerId}号 ${player?.name || ''} (${role})] ${c.type}${payloadStr}\n`;
    });
  }
  logContent += `\n`;

  // AI 夜间/行动决策思考过程（覆盖所有角色每晚的思考，包括 skip/invalid 分支）
  logContent += `【AI 决策思考过程】\n`;
  logContent += `----------------------------------------\n`;
  if (!nightActionHistory || nightActionHistory.length === 0) {
    logContent += `无决策记录\n`;
  } else {
    // 按 (night || day) 分组，时间轴还原
    const groups = {};
    nightActionHistory.forEach(a => {
      const key = a.night != null
        ? `第${a.night}夜`
        : a.day != null
          ? `第${a.day}天`
          : '未知阶段';
      if (!groups[key]) groups[key] = [];
      groups[key].push(a);
    });
    Object.keys(groups).forEach(phaseKey => {
      logContent += `\n--- ${phaseKey} ---\n`;
      groups[phaseKey].forEach(a => {
        const player = players.find(p => p.id === a.playerId);
        const role = player?.role || '未知';
        const name = player?.name || '';
        const time = a.timestamp ? `[${fmtTime(a.timestamp)}] ` : '';
        const head = `${time}[${a.playerId}号 ${name} (${role})] ${a.type || '行动'}`;
        const desc = a.description ? ` · ${a.description}` : (a.target != null ? ` · 目标 ${a.target}号` : '');
        const extra = a.result ? ` · 结果：${a.result}` : '';
        const src = a.source ? ` · 来源：${a.source}` : '';
        logContent += `${head}${desc}${extra}${src}\n`;
        if (a.thought) {
          logContent += `  💭 思考过程: ${a.thought}\n`;
        }
      });
    });
  }
  logContent += `\n`;

  // AI 身份推理表（每一天每位玩家的最新一份）
  logContent += `【AI 身份推理表（按天）】\n`;
  logContent += `----------------------------------------\n`;
  // 改进：保留每个 (playerId, day) 的推理表，而不是只保留最后一个
  const tablesByDayByPlayer = {};
  speechHistory.forEach(s => {
    if (s.identity_table) {
      const day = s.day;
      if (!tablesByDayByPlayer[day]) tablesByDayByPlayer[day] = {};
      tablesByDayByPlayer[day][s.playerId] = s.identity_table;
    }
  });
  if (Object.keys(tablesByDayByPlayer).length === 0) {
    logContent += `无推理表记录\n`;
  } else {
    Object.keys(tablesByDayByPlayer).sort((a, b) => +a - +b).forEach(day => {
      logContent += `\n=== 第${day}天 ===\n`;
      Object.entries(tablesByDayByPlayer[day]).forEach(([playerId, table]) => {
        const player = players.find(p => p.id === parseInt(playerId));
        logContent += `\n${playerId}号 ${player?.name || ''} (${player?.role || '未知'}):\n`;
        Object.entries(table).forEach(([targetId, info]) => {
          const target = players.find(p => p.id === parseInt(targetId));
          logContent += `  → ${targetId}号 ${target?.name || ''}: ${info.suspect || '未知'} (置信度:${info.confidence || 0}%) - ${info.reason || '无'}\n`;
        });
      });
    });
  }
  logContent += `\n`;

  // 完整事件流（系统/警告/信息 log 全量保留，便于定位异常）
  logContent += `【完整事件流（系统日志）】\n`;
  logContent += `----------------------------------------\n`;
  if (!logs || logs.length === 0) {
    logContent += `无事件\n`;
  } else {
    logs.forEach(l => {
      const time = l.timestamp ? `[${fmtTime(l.timestamp)}] ` : '';
      const tag = l.type ? `[${l.type}]` : '[info]';
      const speaker = l.speaker ? `<${l.speaker}> ` : '';
      logContent += `${time}${tag} ${speaker}${l.text}\n`;
    });
  }
  logContent += `\n`;

  // 当前阶段快照（用于中途导出时定位 AI 卡在哪一步）
  if (currentPhaseData && (currentPhaseData.speeches?.length || currentPhaseData.actions?.length)) {
    logContent += `【当前阶段快照（未结算）】\n`;
    logContent += `----------------------------------------\n`;
    if (currentPhaseData.speeches?.length) {
      logContent += `本阶段发言 (${currentPhaseData.speeches.length} 条):\n`;
      currentPhaseData.speeches.forEach(s => {
        const time = s.timestamp ? `[${fmtTime(s.timestamp)}] ` : '';
        logContent += `  ${time}${s.playerId}号 ${s.name || ''}: ${s.content || ''}\n`;
      });
    }
    if (currentPhaseData.actions?.length) {
      logContent += `本阶段行动 (${currentPhaseData.actions.length} 条):\n`;
      currentPhaseData.actions.forEach(a => {
        const time = a.timestamp ? `[${fmtTime(a.timestamp)}] ` : '';
        logContent += `  ${time}${a.playerId}号 ${a.type}${a.target != null ? ` -> ${a.target}号` : ''}${a.description ? ` (${a.description})` : ''}\n`;
      });
    }
    logContent += `\n`;
  }

  // 未结算的夜间决策（如果导出时仍在夜里）
  if (nightDecisions && phase === 'night') {
    logContent += `【未结算的夜间决策】\n`;
    logContent += `----------------------------------------\n`;
    logContent += JSON.stringify(nightDecisions, null, 2) + '\n\n';
  }

  // 游戏结果
  logContent += `========================================\n`;
  logContent += describeVictory({ gameResult, victoryMode, players }) + '\n';
  logContent += `========================================\n`;

  // 创建下载
  const blob = new Blob([logContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `狼人杀记录_${new Date().toISOString().slice(0,10)}_${Date.now()}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
