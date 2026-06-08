import React, { useState } from 'react';
import { Skull, User, Eye, Shield, FlaskConical, Target, ChevronDown, ChevronUp, Brain, Download, Moon, Sun } from 'lucide-react';

export function GameHistoryTable({
  players,
  speechHistory,
  nightActionHistory,
  voteHistory,
  deathHistory,
  seerChecks,
  guardHistory,
  witchHistory,
  dayCount,
  exportFullLog,
  gameMode = 'ai-only',
  userPlayer = null,
  phase = ''
}) {
  const [expandedCells, setExpandedCells] = useState({});

  // 判断是否应该显示某个玩家的角色信息
  const shouldShowRole = (player) => {
    // AI模式或游戏结束：显示所有角色
    if (gameMode === 'ai-only' || phase === 'game_over') return true;
    // 玩家模式：只显示用户自己和狼队友的身份
    if (player.isUser) return true;
    if (userPlayer?.role === '狼人' && player.role === '狼人') return true;
    return false;
  };

  // 判断是否应该显示某个玩家的夜间行动
  const shouldShowNightAction = (playerId) => {
    // AI模式或游戏结束：显示所有行动
    if (gameMode === 'ai-only' || phase === 'game_over') return true;
    // 玩家模式：只显示用户自己的行动
    return userPlayer?.id === playerId;
  };

  // 判断是否应该显示某个玩家的思考内容
  const shouldShowThought = (playerId) => {
    // AI模式或游戏结束：显示所有思考
    if (gameMode === 'ai-only' || phase === 'game_over') return true;
    // 玩家模式：只显示用户自己的思考（用户是人类玩家，通常没有AI思考）
    const player = players.find(p => p.id === playerId);
    return player?.isUser === true;
  };

  const getRoleIcon = (role) => {
    switch(role) {
      case '狼人': return <Skull size={12} className="text-role-wolf"/>;
      case '预言家': return <Eye size={12} className="text-role-seer"/>;
      case '女巫': return <FlaskConical size={12} className="text-role-witch"/>;
      case '猎人': return <Target size={12} className="text-role-hunter"/>;
      case '守卫': return <Shield size={12} className="text-role-guard"/>;
      default: return <User size={12} className="text-ink-muted"/>;
    }
  };

  // 切换单元格展开状态
  const toggleCell = (cellKey) => {
    setExpandedCells(prev => ({
      ...prev,
      [cellKey]: !prev[cellKey]
    }));
  };

  // 获取玩家在某一夜的行动
  const getNightAction = (playerId, night) => {
    const player = players.find(p => p.id === playerId);
    if (!player) return null;

    const actions = [];
    const role = player.role;

    // 优先从nightActionHistory中获取所有行动（包含完整的thought）
    const nightActions = nightActionHistory?.filter(
      a => a.playerId === playerId && a.night === night
    ) || [];
    
    if (nightActions.length > 0) {
      // 如果nightActionHistory中有记录，直接使用
      actions.push(...nightActions);
    } else {
      // 否则从各个专门的历史记录中获取（兼容旧数据）
      if (role === '预言家') {
        const check = seerChecks.find(c => c.seerId === playerId && c.night === night);
        if (check) {
          actions.push({
            type: '查验',
            target: check.targetId,
            result: check.isWolf ? '狼人' : '好人',
            thought: check.thought
          });
        }
      } else if (role === '守卫') {
        const guard = guardHistory.find(g => g.night === night && g.targetId !== undefined);
        if (guard) {
          actions.push({
            type: '守护',
            target: guard.targetId,
            thought: guard.thought
          });
        }
      } else if (role === '女巫') {
        // 检查女巫的解药和毒药使用
        const saved = witchHistory?.savedIds?.find((id, idx) => {
          // 这里需要更复杂的逻辑来确定是哪一夜的，暂时简化处理
          return idx === night - 1;
        });
        const poisoned = witchHistory?.poisonedIds?.find((id, idx) => {
          return idx === night - 1;
        });
        
        if (saved) {
          actions.push({
            type: '解药',
            target: saved,
            thought: witchHistory.thought
          });
        }
        if (poisoned) {
          actions.push({
            type: '毒药',
            target: poisoned,
            thought: witchHistory.thought
          });
        }
      }
    }

    return actions.length > 0 ? actions : null;
  };

  // 获取玩家在某一天的公开行动（如：猎人开枪）
  const getDayActions = (playerId, day) => {
    return nightActionHistory?.filter(
      a => a.playerId === playerId
        && a.day === day
        && (a.night === undefined || a.night === null)
        && a.type === '猎人开枪'
    ) || [];
  };

  // 获取玩家在某一天的发言
  const getDaySpeech = (playerId, day) => {
    return speechHistory.filter(s => s.playerId === playerId && s.day === day);
  };

  // 获取玩家在某一天的投票
  const getDayVote = (playerId, day) => {
    const dayVotes = voteHistory.find(v => v.day === day);
    if (!dayVotes) return null;
    return dayVotes.votes.find(v => v.from === playerId);
  };

  // 渲染思考内容（可展开）
  const renderThought = (thought, cellKey, isExpanded, playerId) => {
    // 检查是否应该显示该玩家的思考内容
    if (!thought || !shouldShowThought(playerId)) return null;

    const thoughtText = typeof thought === 'string'
      ? thought
      : (() => {
          try {
            return JSON.stringify(thought);
          } catch {
            return String(thought);
          }
        })();

    if (!thoughtText) return null;

    const shouldCollapse = thoughtText.length > 50;

    return (
      <div className={`${isExpanded ? '' : 'line-clamp-2'}`}>
        <div className="flex items-center gap-1 mb-0.5">
          <Brain size={8} className="text-state-thinking" />
          <span className="text-[7px] text-state-thinking">思考</span>
        </div>
        <p className="text-[8px] text-ink-muted italic">{thoughtText}</p>
        {shouldCollapse && (
          <button
            onClick={(e) => { e.stopPropagation(); toggleCell(cellKey); }}
            className="flex items-center gap-0.5 mt-1 text-[7px] text-ink-muted hover:text-ink"
          >
            {isExpanded ? <><ChevronUp size={8} /> 收起</> : <><ChevronDown size={8} /> 展开</>}
          </button>
        )}
      </div>
    );
  };

  // 渲染夜间行动内容
  const renderNightAction = (actions, cellKey, isExpanded, playerId) => {
    if (!actions || actions.length === 0) return <span className="text-ink-faint text-[10px]">-</span>;

    return (
      <div className="space-y-1">
        {actions.map((action, idx) => (
          <div key={idx} className="bg-phase-night-soft rounded-lg p-2">
            <div className="flex items-center gap-1 mb-1">
              <span className="text-[9px] font-bold text-phase-night">{action.type}</span>
              {action.target !== undefined && (
                <span className="text-[9px] text-ink-muted">
                  → {action.target}号
                  {action.result && <span className={action.result === '狼人' ? 'text-role-wolf' : 'text-role-witch'}> ({action.result})</span>}
                </span>
              )}
            </div>
            {renderThought(action.thought, `${cellKey}-${idx}`, isExpanded, playerId)}
          </div>
        ))}
      </div>
    );
  };

  // 渲染白天发言内容
  const renderDaySpeech = (playerId, day, cellKey, isExpanded) => {
    const speeches = getDaySpeech(playerId, day);
    const vote = getDayVote(playerId, day);
    const dayActions = getDayActions(playerId, day);
    const death = deathHistory.find(d =>
      d.playerId === playerId
        && d.day === day
        && (d.phase === '投票' || d.phase === '猎人枪')
    );

    if (speeches.length === 0 && dayActions.length === 0 && !vote && !death) {
      return <span className="text-ink-faint text-[10px]">-</span>;
    }

    return (
      <div className="space-y-2">
        {dayActions.map((action, idx) => (
          <div key={`day-action-${idx}`} className="bg-role-hunter-soft rounded-lg p-1.5">
            <span className="text-[8px] text-role-hunter font-bold">{action.type}</span>
            {action.target !== undefined && <span className="text-[8px] text-ink-muted"> → {action.target}号</span>}
            {renderThought(action.thought, `${cellKey}-action-thought-${idx}`, isExpanded, playerId)}
          </div>
        ))}
        {speeches.map((speech, idx) => (
          <div key={idx} className="bg-phase-day-soft rounded-lg p-2">
            {renderThought(speech.thought, `${cellKey}-thought-${idx}`, isExpanded, playerId)}
            <p className={`text-[9px] text-ink ${isExpanded ? '' : 'line-clamp-3'}`}>
              {speech.content}
            </p>
            {(speech.content?.length > 80 || speech.thought?.length > 50) && (
              <button
                onClick={() => toggleCell(cellKey)}
                className="flex items-center gap-0.5 mt-1 text-[7px] text-ink-muted hover:text-ink"
              >
                {isExpanded ? <><ChevronUp size={8} /> 收起</> : <><ChevronDown size={8} /> 展开</>}
              </button>
            )}
          </div>
        ))}
        {vote && (
          <div className="bg-phase-day-bg rounded-lg p-1.5">
            <span className="text-[8px] text-phase-day">投票 → {vote.to}号</span>
          </div>
        )}
        {death && (
          <div className="bg-danger-soft rounded-lg p-1.5">
            <span className="text-[8px] text-danger">💀 {death.cause}</span>
          </div>
        )}
      </div>
    );
  };

  // 生成所有回合的统一表格（每行一个回合：夜+天）
  const renderAllRoundsTable = () => {
    // 生成所有回合（每个回合包含一夜和一天）
    const rounds = [];
    for (let day = 1; day <= dayCount; day++) {
      rounds.push({ day, nightLabel: `第${day - 1}夜`, dayLabel: `第${day}天` });
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-bg-sunken">
              <th className="sticky left-0 z-10 bg-bg-raised p-3 text-left text-[10px] font-black text-ink-muted uppercase border-r border-line min-w-[100px]">
                回合
              </th>
              {players.map((player) => (
                <th
                  key={`header-player-${player.id}`}
                  className="p-3 text-center text-[10px] font-black uppercase border-r border-line min-w-[160px] bg-bg-sunken"
                >
                  <div className="flex items-center justify-center gap-2">
                    <div
                      className="w-6 h-6 rounded-full border border-line overflow-hidden flex-shrink-0"
                      style={{ backgroundColor: player.avatarColor }}
                    >
                      {player.avatarUrl ? (
                        <img src={player.avatarUrl} alt={player.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/30 text-[8px] font-bold">
                          {player.id}
                        </div>
                      )}
                    </div>
                    <div className="text-left">
                      <div className="text-ink">{player.id}号 {player.name}</div>
                      <div className="flex items-center gap-1">
                        {shouldShowRole(player) ? (
                          <>
                            {getRoleIcon(player.role)}
                            <span className="text-[8px] text-ink-muted font-normal">{player.role}</span>
                          </>
                        ) : (
                          <span className="text-[8px] text-ink-faint font-normal">???</span>
                        )}
                        {!player.isAlive && <Skull size={10} className="text-role-wolf" />}
                      </div>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rounds.map((round) => (
              <tr key={`round-${round.day}`} className="border-b border-line">
                {/* 回合标签列 */}
                <td className="sticky left-0 z-10 bg-bg-raised p-2 border-r border-line align-top">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1 text-phase-night">
                      <Moon size={12} />
                      <span className="text-[10px] font-bold">{round.nightLabel}</span>
                    </div>
                    <div className="flex items-center gap-1 text-phase-day">
                      <Sun size={12} />
                      <span className="text-[10px] font-bold">{round.dayLabel}</span>
                    </div>
                  </div>
                </td>
                {/* 每个玩家在该回合的行动和发言 */}
                {players.map((player) => {
                  const nightCellKey = `${player.id}-night-${round.day}`;
                  const dayCellKey = `${player.id}-day-${round.day}`;
                  const isNightExpanded = expandedCells[nightCellKey];
                  const isDayExpanded = expandedCells[dayCellKey];
                  const actions = shouldShowNightAction(player.id) ? getNightAction(player.id, round.day) : null;

                  return (
                    <td key={`cell-${player.id}-${round.day}`} className={`p-2 border-r border-line align-top ${!player.isAlive ? 'opacity-50' : ''}`}>
                      <div className="space-y-2">
                        {/* 夜间行动 */}
                        <div className="bg-phase-night-soft rounded-lg p-2 border border-line">
                          <div className="flex items-center gap-1 mb-1 text-phase-night">
                            <Moon size={10} />
                            <span className="text-[8px] font-bold uppercase">夜间</span>
                          </div>
                          {shouldShowNightAction(player.id) ? (
                            renderNightAction(actions, nightCellKey, isNightExpanded, player.id)
                          ) : (
                            <span className="text-ink-faint text-[10px]">-</span>
                          )}
                        </div>
                        {/* 白天发言 */}
                        <div className="bg-phase-day-soft rounded-lg p-2 border border-line">
                          <div className="flex items-center gap-1 mb-1 text-phase-day">
                            <Sun size={10} />
                            <span className="text-[8px] font-bold uppercase">白天</span>
                          </div>
                          {renderDaySpeech(player.id, round.day, dayCellKey, isDayExpanded)}
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="w-full bg-bg-raised rounded-3xl border border-line overflow-hidden">
      {/* 表格标题 */}
      <div className="flex items-center justify-between p-4 border-b border-line bg-bg-sunken">
        <h3 className="text-sm font-black text-ink uppercase tracking-wider">游戏历史记录</h3>
        {exportFullLog && (
          <button
            onClick={exportFullLog}
            className="flex items-center gap-2 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-[10px] font-bold transition-colors"
          >
            <Download size={12} />
            导出完整记录
          </button>
        )}
      </div>

      {/* 内容区域 */}
      <div className="p-4">
        {/* 所有回合 - 统一表格形式横向扩展 */}
        {renderAllRoundsTable()}
      </div>
    </div>
  );
}
