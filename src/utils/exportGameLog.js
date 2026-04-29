/**
 * 导出游戏日志为 .txt 文件并触发下载
 */
export function exportGameLog({ players, dayCount, deathHistory, speechHistory, voteHistory, seerChecks, guardHistory, witchHistory, victoryMode, nightActionHistory = [] }) {
  const timestamp = new Date().toLocaleString('zh-CN');
  let logContent = `========================================\n`;
  logContent += `狼人杀游戏记录\n`;
  logContent += `导出时间: ${timestamp}\n`;
  logContent += `游戏天数: ${dayCount}\n`;
  logContent += `========================================\n\n`;

  // 玩家身份列表
  logContent += `【玩家身份】\n`;
  logContent += `----------------------------------------\n`;
  players.forEach(p => {
    const status = p.isAlive ? '存活' : '死亡';
    const userMark = p.isUser ? ' (你)' : '';
    logContent += `${p.id}号 ${p.name}${userMark}: ${p.role} [${status}]\n`;
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
        const voteTargetText = vote.to === -1 ? '弃票' : `${vote.to}号(${toPlayer?.role || '?'})`;
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
    });
  }
  logContent += `\n`;

  // 守卫记录
  logContent += `【守卫守护记录】\n`;
  logContent += `----------------------------------------\n`;
  if (guardHistory.length === 0) {
    logContent += `无守护记录\n`;
  } else {
    guardHistory.forEach(g => {
      const target = players.find(p => p.id === g.targetId);
      logContent += `第${g.night}夜: 守护 ${g.targetId}号 ${target?.name || ''}\n`;
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

  // AI 夜间/行动决策思考过程（来自 nightActionHistory，覆盖所有角色每晚的思考）
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
        const head = `[${a.playerId}号 ${name} (${role})] ${a.type || '行动'}`;
        const desc = a.description ? ` · ${a.description}` : (a.target != null ? ` · 目标 ${a.target}号` : '');
        const extra = a.result ? ` · 结果：${a.result}` : '';
        logContent += `${head}${desc}${extra}\n`;
        if (a.thought) {
          logContent += `  💭 思考过程: ${a.thought}\n`;
        }
      });
    });
  }
  logContent += `\n`;

  // AI 身份推理表（最终状态）
  logContent += `【AI 身份推理表】\n`;
  logContent += `----------------------------------------\n`;
  const lastIdentityTables = {};
  speechHistory.forEach(s => {
    if (s.identity_table) {
      lastIdentityTables[s.playerId] = { table: s.identity_table, day: s.day };
    }
  });
  if (Object.keys(lastIdentityTables).length === 0) {
    logContent += `无推理表记录\n`;
  } else {
    Object.entries(lastIdentityTables).forEach(([playerId, data]) => {
      const player = players.find(p => p.id === parseInt(playerId));
      logContent += `\n${playerId}号 ${player?.name || ''} (${player?.role || '未知'}) 的推理表 (第${data.day}天):\n`;
      Object.entries(data.table).forEach(([targetId, info]) => {
        const target = players.find(p => p.id === parseInt(targetId));
        logContent += `  → ${targetId}号 ${target?.name || ''}: ${info.suspect || '未知'} (置信度:${info.confidence || 0}%) - ${info.reason || '无'}\n`;
      });
    });
  }
  logContent += `\n`;

  // 游戏结果
  logContent += `========================================\n`;
  logContent += `胜利模式: ${victoryMode === 'edge' ? '屠边模式' : '屠城模式'}\n`;
  const aliveWolves = players.filter(p => p.isAlive && p.role === '狼人').length;
  if (aliveWolves === 0) {
    logContent += `游戏结果: 好人阵营胜利！\n`;
  } else {
    logContent += `游戏结果: 狼人阵营胜利！\n`;
  }
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
