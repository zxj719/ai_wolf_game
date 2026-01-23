import { useState, useRef, useEffect } from 'react';
import { Skull, Eye, Shield, FlaskConical, Target, User, Moon, Sun, RefreshCw, Send, Download, RotateCcw, AlertTriangle, Syringe, Crosshair, Vote, MinusCircle } from 'lucide-react';

const clamp = (min, value, max) => Math.min(max, Math.max(min, value));

const LAYOUT = {
  RADIUS_FALLBACK: 31,
  CARD_MIN: 56,
  CARD_MAX: 96,
  CARD_RATIO: 0.18,
  PANEL_MIN: 120,
  PANEL_MAX: 280,
  PANEL_RATIO: 0.38,
  GAP_MIN: 8
};

export function CirclePlayerLayout({
  players,
  userPlayer,
  nightDecisions,
  selectedTarget,
  setSelectedTarget,
  speakerIndex,
  phase,
  gameMode,
  seerChecks,
  dayCount,
  nightStep,
  AI_MODELS = [],
  isThinking,
  getCurrentNightRole,
  speakingOrder,
  setSpeakingOrder,
  // User interaction props
  userInput,
  setUserInput,
  handleUserSpeak,
  // Voting props
  handleVote,
  voteHistory = [],
  // Night action props
  mergeNightDecisions,
  proceedNight,
  setPlayers,
  setUserPlayer,
  witchHistory,
  setWitchHistory,
  guardHistory = [],
  nightActionHistory = [],
  getPlayer,
  addLog,
  setSeerChecks,
  isUserTurn,
  // Hunter props
  hunterShooting,
  handleUserHunterShoot,
  // Game over props
  exportGameLog,
  restartGame
}) {
  const [layout, setLayout] = useState({
    size: 0,
    radius: 0,
    card: 96,
    cardHeight: 112,
    panel: 240,
    avatar: 48,
    icon: 52
  });
  const [cardPositions, setCardPositions] = useState({});
  const [draggingId, setDraggingId] = useState(null);
  const [previewPlayer, setPreviewPlayer] = useState(null);
  const containerRef = useRef(null);
  const dragStateRef = useRef({ pointerId: null, activeId: null, moved: false, startX: 0, startY: 0 });
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const dragTargetRef = useRef(null);
  const dragFrameRef = useRef(null);

  const getRoleIcon = (role, size = 16) => {
    switch(role) {
      case '狼人': return <Skull size={size} className="text-rose-500"/>;
      case '预言家': return <Eye size={size} className="text-purple-500"/>;
      case '女巫': return <FlaskConical size={size} className="text-emerald-500"/>;
      case '猎人': return <Target size={size} className="text-orange-500"/>;
      case '守卫': return <Shield size={size} className="text-blue-500"/>;
      default: return <User size={size} className="text-zinc-500"/>;
    }
  };

  // 获取玩家的行动历史图标
  // 玩家模式下只显示：用户自己的行动 + 所有人的投票 + 猎人击杀
  const getPlayerActionIcons = (playerId) => {
    const icons = [];
    const isPlayerMode = gameMode !== 'ai-only' && phase !== 'game_over';
    const isUserAction = userPlayer?.id === playerId;

    // 夜间行动 - 从 nightActionHistory 获取
    // 玩家模式下只显示用户自己的夜间行动
    if (!isPlayerMode || isUserAction) {
      nightActionHistory.forEach((action, idx) => {
        if (action.playerId === playerId) {
          const night = action.night;
          switch (action.type) {
            case '袭击':
              icons.push(
                <span key={`kill-${idx}`} className="inline-flex items-center gap-0.5 text-rose-400 bg-rose-500/20 px-1.5 py-0.5 rounded" title={`N${night} 袭击 ${action.target}号`}>
                  <Crosshair size={12} /><span className="text-[10px] font-bold">{action.target}</span>
                </span>
              );
              break;
            case '查验':
              icons.push(
                <span key={`check-${idx}`} className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded ${action.result === '狼人' ? 'text-rose-400 bg-rose-500/20' : 'text-emerald-400 bg-emerald-500/20'}`} title={`N${night} 查验 ${action.target}号 = ${action.result}`}>
                  <Eye size={12} /><span className="text-[10px] font-bold">{action.target}</span>
                </span>
              );
              break;
            case '解药':
              icons.push(
                <span key={`save-${idx}`} className="inline-flex items-center gap-0.5 text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded" title={`N${night} 救 ${action.target}号`}>
                  <Syringe size={12} /><span className="text-[10px] font-bold">{action.target}</span>
                </span>
              );
              break;
            case '毒药':
              icons.push(
                <span key={`poison-${idx}`} className="inline-flex items-center gap-0.5 text-purple-400 bg-purple-500/20 px-1.5 py-0.5 rounded" title={`N${night} 毒 ${action.target}号`}>
                  <FlaskConical size={12} /><span className="text-[10px] font-bold">{action.target}</span>
                </span>
              );
              break;
            case '守护':
              icons.push(
                <span key={`guard-${idx}`} className="inline-flex items-center gap-0.5 text-blue-400 bg-blue-500/20 px-1.5 py-0.5 rounded" title={`N${night} 守护 ${action.target}号`}>
                  <Shield size={12} /><span className="text-[10px] font-bold">{action.target}</span>
                </span>
              );
              break;
          }
        }
      });
    }

    // 白天投票 - 始终显示所有玩家的投票（公开信息）
    voteHistory.forEach((dayVote, dayIdx) => {
      const vote = dayVote.votes.find(v => v.from === playerId);
      if (vote) {
        if (vote.to === -1) {
          icons.push(
            <span key={`vote-${dayIdx}`} className="inline-flex items-center gap-0.5 text-zinc-400 bg-zinc-500/20 px-1.5 py-0.5 rounded" title={`D${dayVote.day} 弃票`}>
              <MinusCircle size={12} />
            </span>
          );
        } else {
          icons.push(
            <span key={`vote-${dayIdx}`} className="inline-flex items-center gap-0.5 text-amber-400 bg-amber-500/20 px-1.5 py-0.5 rounded" title={`D${dayVote.day} 投 ${vote.to}号`}>
              <Vote size={12} /><span className="text-[10px] font-bold">{vote.to}</span>
            </span>
          );
        }
      }
    });

    return icons;
  };

  const aliveList = players.filter(x => x.isAlive);
  const totalPlayers = players.length;

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateLayout = () => {
      const rect = element.getBoundingClientRect();
      const size = Math.min(rect.width, rect.height);
      if (!size) return;

      const gap = Math.max(LAYOUT.GAP_MIN, Math.round(size * 0.02));
      const cardTarget = Math.round(size * LAYOUT.CARD_RATIO);
      const cardMaxByContainer = Math.max(24, Math.floor((size - gap * 2) / 3));
      const cardMin = Math.min(LAYOUT.CARD_MIN, cardMaxByContainer);
      const card = clamp(cardMin, Math.min(cardTarget, cardMaxByContainer), LAYOUT.CARD_MAX);
      const panelTarget = clamp(LAYOUT.PANEL_MIN, Math.round(size * LAYOUT.PANEL_RATIO), LAYOUT.PANEL_MAX);
      const panelMax = size - (card * 3) - (gap * 2);
      const panel = Math.max(0, Math.min(panelTarget, panelMax));
      const radius = (panel / 2) + card;
      const cardHeight = Math.round(card * 1.18);
      const avatar = Math.round(card * 0.5);
      const icon = clamp(32, Math.round(panel * 0.28), 64);

      setLayout(prev => {
        if (
          prev.size === size
          && prev.radius === radius
          && prev.card === card
          && prev.cardHeight === cardHeight
          && prev.panel === panel
          && prev.avatar === avatar
          && prev.icon === icon
        ) {
          return prev;
        }
        return { size, radius, card, cardHeight, panel, avatar, icon };
      });
    };

    updateLayout();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateLayout);
      observer.observe(element);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', updateLayout);
    return () => window.removeEventListener('resize', updateLayout);
  }, []);

  // 计算圆形布局的默认位置
  const getDefaultPosition = (index, total) => {
    const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
    const radiusPercent = layout.size
      ? (layout.radius / layout.size) * 100
      : LAYOUT.RADIUS_FALLBACK;
    const x = 50 + radiusPercent * Math.cos(angle);
    const y = 50 + radiusPercent * Math.sin(angle);
    return { x, y };
  };

  const getPointerPercent = (clientX, clientY) => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100
    };
  };

  const scheduleDragUpdate = (id, x, y) => {
    dragTargetRef.current = { id, x, y };
    if (dragFrameRef.current) return;
    dragFrameRef.current = requestAnimationFrame(() => {
      dragFrameRef.current = null;
      const target = dragTargetRef.current;
      if (!target) return;
      setCardPositions(prev => ({
        ...prev,
        [target.id]: { x: target.x, y: target.y }
      }));
    });
  };

  const handlePointerDown = (event, playerId, index, isAlive) => {
    if (!isAlive) return;
    event.preventDefault();
    const pointer = getPointerPercent(event.clientX, event.clientY);
    if (!pointer) return;
    const currentPos = cardPositions[playerId] || getDefaultPosition(index, totalPlayers);
    dragStateRef.current = {
      pointerId: event.pointerId,
      activeId: playerId,
      moved: false,
      startX: pointer.x,
      startY: pointer.y
    };
    dragOffsetRef.current = {
      x: pointer.x - currentPos.x,
      y: pointer.y - currentPos.y
    };
    if (event.currentTarget.setPointerCapture) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };

  const handlePointerMove = (event) => {
    const state = dragStateRef.current;
    if (state.pointerId !== event.pointerId || state.activeId === null) return;
    const pointer = getPointerPercent(event.clientX, event.clientY);
    if (!pointer) return;

    const dx = pointer.x - state.startX;
    const dy = pointer.y - state.startY;
    const distance = Math.hypot(dx, dy);

    if (!state.moved && distance < 0.6) {
      return;
    }

    if (!state.moved) {
      state.moved = true;
      setDraggingId(state.activeId);
    }

    const newX = clamp(5, pointer.x - dragOffsetRef.current.x, 95);
    const newY = clamp(5, pointer.y - dragOffsetRef.current.y, 95);
    scheduleDragUpdate(state.activeId, newX, newY);
  };

  const handlePointerUp = (event, playerId, isAlive) => {
    const state = dragStateRef.current;
    if (state.pointerId !== event.pointerId || state.activeId !== playerId) return;
    if (event.currentTarget.releasePointerCapture) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (state.moved) {
      const target = dragTargetRef.current;
      if (target && target.id === playerId) {
        setCardPositions(prev => ({
          ...prev,
          [playerId]: { x: target.x, y: target.y }
        }));
      }
      setDraggingId(null);
    } else if (isAlive) {
      setSelectedTarget(playerId);
    }

    dragStateRef.current = { pointerId: null, activeId: null, moved: false, startX: 0, startY: 0 };
    dragTargetRef.current = null;
  };

  const resetPositions = () => {
    setCardPositions({});
    setDraggingId(null);
  };

  const phaseIconSize = Math.max(18, Math.round(layout.icon * 0.6));

  // 获取游戏阶段显示文字
  const getPhaseText = () => {
    if (phase === 'night') return { icon: <Moon size={phaseIconSize} />, text: `第${dayCount}夜`, color: 'text-indigo-400' };
    if (phase === 'day_discussion') return { icon: <Sun size={phaseIconSize} />, text: `第${dayCount}天 - 讨论`, color: 'text-amber-400' };
    if (phase === 'day_voting') return { icon: <Sun size={phaseIconSize} />, text: `第${dayCount}天 - 投票`, color: 'text-orange-400' };
    if (phase === 'day_announce') return { icon: <Sun size={phaseIconSize} />, text: `第${dayCount}天 - 公告`, color: 'text-yellow-400' };
    if (phase === 'hunter_shoot') return { icon: <Target size={phaseIconSize} />, text: '猎人开枪', color: 'text-red-400' };
    if (phase === 'game_over') return { icon: null, text: '游戏结束', color: 'text-emerald-400' };
    return { icon: null, text: '', color: 'text-zinc-400' };
  };

  const phaseInfo = getPhaseText();
  const layoutStyle = {
    '--panel-size': `${layout.panel}px`,
    '--card-width': `${layout.card}px`,
    '--card-height': `${layout.cardHeight}px`,
    '--avatar-size': `${layout.avatar}px`,
    '--icon-size': `${layout.icon}px`
  };

  useEffect(() => {
    if (!previewPlayer) return;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setPreviewPlayer(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewPlayer]);

  useEffect(() => {
    return () => {
      if (dragFrameRef.current) {
        cancelAnimationFrame(dragFrameRef.current);
      }
    };
  }, []);

  return (
    <div ref={containerRef} className="relative w-full aspect-square max-w-5xl mx-auto" style={layoutStyle}>
      {/* 中央状态区域 - 圆形面板 */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
        <div className="bg-zinc-900/95 border-2 border-zinc-700 rounded-full p-3 sm:p-4 md:p-6 shadow-2xl backdrop-blur-lg w-[var(--panel-size)] h-[var(--panel-size)] flex items-center justify-center">
          <div className={`flex flex-col items-center gap-2 ${phaseInfo.color} w-full`}>
            <div className="w-[var(--icon-size)] h-[var(--icon-size)] rounded-full bg-gradient-to-br from-zinc-800 to-zinc-900 border-2 border-zinc-700 flex items-center justify-center shadow-xl">
              {phaseInfo.icon}
            </div>
            <span className="text-sm sm:text-base md:text-lg font-black tracking-wide leading-tight text-center">{phaseInfo.text}</span>

            {/* 发言顺序选择 */}
            {phase === 'day_discussion' && speakerIndex >= 0 && setSpeakingOrder && (
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => setSpeakingOrder('left')}
                  className={`text-[10px] px-3 py-1 rounded-lg font-bold transition-all ${speakingOrder === 'left' ? 'bg-indigo-500 text-white' : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'}`}
                >
                  顺时针
                </button>
                <button
                  onClick={() => setSpeakingOrder('right')}
                  className={`text-[10px] px-3 py-1 rounded-lg font-bold transition-all ${speakingOrder === 'right' ? 'bg-indigo-500 text-white' : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'}`}
                >
                  逆时针
                </button>
              </div>
            )}

            {phase === 'night' && getCurrentNightRole && (
              <div className="text-xs text-zinc-400 font-medium">
                {getCurrentNightRole()} 行动中...
              </div>
            )}
            {phase === 'day_discussion' && speakerIndex >= 0 && (
              <div className="text-xs text-zinc-400 font-medium truncate max-w-[12rem] text-center">
                {aliveList[speakerIndex]?.name} 正在发言
              </div>
            )}
            {isThinking && (
              <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                <RefreshCw size={12} className="animate-spin" />
                <span>AI思考中...</span>
              </div>
            )}

            {/* ===== 各阶段交互UI ===== */}

            {/* 白天讨论 - 用户发言输入 */}
            {phase === 'day_discussion' && speakerIndex >= 0 && aliveList[speakerIndex]?.isUser && gameMode !== 'ai-only' && (
              <div className="w-full mt-2 space-y-1 max-w-[14rem]">
                <div className="flex items-center gap-1 text-[10px] text-emerald-400 justify-center">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-bold">轮到你发言</span>
                </div>
                <div className="flex gap-1">
                  <input
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder="输入你的分析..."
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-indigo-500 transition-colors"
                    onKeyDown={(e) => e.key === 'Enter' && userInput?.trim() && handleUserSpeak()}
                  />
                  <button
                    onClick={handleUserSpeak}
                    disabled={!userInput?.trim()}
                    className="px-2 bg-indigo-600 rounded-lg hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-all"
                  >
                    <Send size={14}/>
                  </button>
                </div>
              </div>
            )}

            {/* 白天投票 */}
            {phase === 'day_voting' && (
              <div className="w-full mt-2 text-center">
                {userPlayer?.isAlive ? (
                  <>
                    <p className="text-[10px] text-zinc-400 mb-2">请基于逻辑投出放逐票</p>
                    <button
                      disabled={selectedTarget === null || isThinking}
                      onClick={handleVote}
                      className="px-6 py-2 bg-amber-600 disabled:bg-zinc-800 disabled:text-zinc-600 text-black rounded-lg font-bold text-xs uppercase hover:bg-amber-500 transition-all"
                    >
                      投票
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-1 text-zinc-500 text-xs">
                    <RefreshCw className="animate-spin" size={14}/>
                    <span>AI正在投票...</span>
                  </div>
                )}
              </div>
            )}

            {/* 夜间用户行动 */}
            {phase === 'night' && isUserTurn && isUserTurn() && (
              <div className="w-full mt-2 text-center space-y-2 max-w-[14rem]">
                <p className="text-xs text-indigo-400 font-bold">{userPlayer?.role} 行动</p>
                <p className="text-[10px] text-zinc-500">点击头像选择目标</p>

                {userPlayer?.role === '守卫' && nightDecisions?.lastGuardTarget !== null && (
                  <p className="text-[10px] text-amber-400 flex items-center justify-center gap-1">
                    <AlertTriangle size={10}/>
                    上夜守护{nightDecisions.lastGuardTarget}号
                  </p>
                )}

                {userPlayer?.role === '狼人' && (
                  <button
                    onClick={() => {
                      const updated = { ...nightDecisions, wolfSkipKill: true, wolfTarget: null };
                      mergeNightDecisions({ wolfSkipKill: true, wolfTarget: null });
                      proceedNight(updated);
                    }}
                    className="text-[10px] text-zinc-400 underline hover:text-zinc-300"
                  >
                    选择空刀
                  </button>
                )}

                {userPlayer?.role === '女巫' ? (
                  <div className="text-left bg-zinc-800/50 p-2 rounded-lg text-[10px] space-y-2">
                    <p className="text-zinc-400 text-center">
                      被刀：{nightDecisions?.wolfTarget !== null ? `${nightDecisions.wolfTarget}号` : '无'}
                    </p>
                    <div className="flex gap-1 justify-center flex-wrap">
                      {userPlayer.hasWitchSave && nightDecisions?.wolfTarget !== null && (
                        <button
                          onClick={() => {
                            const newDecisions = { ...nightDecisions, witchSave: true };
                            mergeNightDecisions({ witchSave: true });
                            setPlayers(players.map(x => x.id === 0 ? { ...x, hasWitchSave: false } : x));
                            setUserPlayer({ ...userPlayer, hasWitchSave: false });
                            setWitchHistory({ ...witchHistory, savedIds: [...witchHistory.savedIds, nightDecisions.wolfTarget] });
                            proceedNight(newDecisions);
                          }}
                          className="px-2 py-1 bg-emerald-600 rounded text-white font-bold hover:bg-emerald-500"
                        >
                          解药
                        </button>
                      )}
                      <button
                        onClick={() => proceedNight()}
                        className="px-2 py-1 bg-zinc-700 rounded font-bold hover:bg-zinc-600"
                      >
                        不使用
                      </button>
                    </div>
                    {userPlayer.hasWitchPoison && selectedTarget !== null && (
                      <button
                        onClick={() => {
                          const newDecisions = { ...nightDecisions, witchPoison: selectedTarget };
                          mergeNightDecisions({ witchPoison: selectedTarget });
                          setPlayers(players.map(x => x.id === 0 ? { ...x, hasWitchPoison: false } : x));
                          setUserPlayer({ ...userPlayer, hasWitchPoison: false });
                          setWitchHistory({ ...witchHistory, poisonedIds: [...witchHistory.poisonedIds, selectedTarget] });
                          proceedNight(newDecisions);
                        }}
                        className="w-full px-2 py-1 bg-rose-600 rounded font-bold hover:bg-rose-500"
                      >
                        毒{selectedTarget}号
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    <button
                      disabled={!selectedTarget || (userPlayer?.role === '守卫' && selectedTarget === nightDecisions?.lastGuardTarget)}
                      onClick={() => {
                        let updatedDecisions = { ...nightDecisions };
                        if (userPlayer?.role === '守卫') {
                          updatedDecisions.guardTarget = selectedTarget;
                          mergeNightDecisions({ guardTarget: selectedTarget });
                        }
                        if (userPlayer?.role === '狼人') {
                          updatedDecisions.wolfTarget = selectedTarget;
                          updatedDecisions.wolfSkipKill = false;
                          mergeNightDecisions({ wolfTarget: selectedTarget, wolfSkipKill: false });
                        }
                        if (userPlayer?.role === '预言家') {
                          const target = getPlayer(selectedTarget);
                          const isWolf = target?.role === '狼人';
                          setSeerChecks([...seerChecks, { night: dayCount, targetId: selectedTarget, isWolf, seerId: 0 }]);
                          addLog(`你查验了 [${selectedTarget}号]，结果是：${isWolf ? '🐺 狼人' : '👤 好人'}`, 'info');
                        }
                        proceedNight(updatedDecisions);
                      }}
                      className="px-6 py-1.5 bg-indigo-600 disabled:bg-zinc-800 disabled:text-zinc-600 rounded-lg font-bold text-xs hover:bg-indigo-500 transition-all"
                    >
                      确认行动
                    </button>

                    {(userPlayer?.role === '守卫' || userPlayer?.role === '预言家') && (
                      <button
                        onClick={() => {
                          if (userPlayer?.role === '守卫') {
                            mergeNightDecisions({ guardTarget: null });
                            addLog(`你选择了空守`, 'info');
                          } else {
                            addLog(`你选择了不查验`, 'info');
                          }
                          proceedNight();
                        }}
                        className="text-zinc-400 hover:text-white underline text-xs"
                      >
                        {userPlayer?.role === '守卫' ? '选择空守' : '选择不查验'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 猎人开枪 */}
            {phase === 'hunter_shoot' && hunterShooting && (
              <div className="w-full mt-2 text-center space-y-2">
                <p className="text-xs text-orange-400 font-bold">猎人开枪</p>
                <p className="text-[10px] text-zinc-400">
                  {hunterShooting.id}号 可带走一人
                </p>
                <button
                  onClick={handleUserHunterShoot}
                  className={`px-5 py-1.5 rounded-lg font-bold text-xs uppercase transition-all ${selectedTarget !== null ? 'bg-orange-600 hover:bg-orange-500' : 'bg-zinc-700 hover:bg-zinc-600'}`}
                >
                  {selectedTarget !== null ? `开枪${selectedTarget}号` : '不开枪'}
                </button>
              </div>
            )}

            {/* 游戏结束 */}
            {phase === 'game_over' && (
              <div className="w-full mt-2 text-center space-y-2">
                <h2 className="text-lg font-black uppercase tracking-widest text-amber-400">Game Over</h2>
                <p className="text-[10px] text-zinc-400">查看历史记录</p>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={exportGameLog}
                    className="px-4 py-1.5 bg-indigo-600 rounded-lg font-bold text-xs uppercase hover:bg-indigo-500 transition-all flex items-center gap-1"
                  >
                    <Download size={12}/> 导出
                  </button>
                  <button
                    onClick={restartGame}
                    className="px-4 py-1.5 bg-emerald-600 rounded-lg font-bold text-xs uppercase hover:bg-emerald-500 transition-all flex items-center gap-1"
                  >
                    <RotateCcw size={12}/> 重开
                  </button>
                </div>
              </div>
            )}

            {Object.keys(cardPositions).length > 0 && (
              <button
                onClick={resetPositions}
                className="mt-2 text-[9px] text-zinc-500 hover:text-zinc-300 underline"
              >
                重置卡片位置
              </button>
            )}

          </div>
        </div>
      </div>

      {/* 圆形排列的玩家卡片 */}
      {players.map((p, index) => {
        const { x, y } = cardPositions[p.id] || getDefaultPosition(index, totalPlayers);
        const isTeammate = userPlayer?.role === '狼人' && p.role === '狼人' && p.id !== userPlayer.id;
        const isSpeaking = (aliveList[speakerIndex])?.id === p.id;
        const actionIcons = getPlayerActionIcons(p.id);
        const isDragging = draggingId === p.id;

        return (
          <div
            key={p.id}
            className={`absolute transform -translate-x-1/2 -translate-y-1/2 ${isDragging ? 'z-50' : 'z-20'}`}
            style={{
              left: `${x}%`,
              top: `${y}%`,
              transition: isDragging ? 'none' : 'left 0.2s ease, top 0.2s ease'
            }}
          >
            {/* 玩家卡片 */}
            <div
              onPointerDown={(event) => handlePointerDown(event, p.id, index, p.isAlive)}
              onPointerMove={handlePointerMove}
              onPointerUp={(event) => handlePointerUp(event, p.id, p.isAlive)}
              onPointerCancel={(event) => handlePointerUp(event, p.id, p.isAlive)}
              className={`
                relative p-2 sm:p-3 rounded-2xl border-2 transition-transform select-none touch-none
                w-[var(--card-width)] min-h-[var(--card-height)] flex flex-col items-center
                ${selectedTarget === p.id ? 'border-indigo-500 bg-indigo-500/20 ring-4 ring-indigo-500/30 scale-110' : 'bg-zinc-900/95 border-zinc-700'}
                ${!p.isAlive ? 'opacity-40 grayscale cursor-not-allowed' : 'cursor-grab hover:border-zinc-500 hover:scale-105'}
                ${isSpeaking ? 'ring-2 ring-emerald-500 animate-pulse' : ''}
                ${isDragging ? 'shadow-2xl ring-2 ring-indigo-400/40 scale-105 cursor-grabbing' : 'shadow-xl'}
                backdrop-blur-sm
              `}
            >

              {/* 玩家编号 */}
              <span className="absolute -top-2 -left-1 text-[10px] sm:text-xs font-black text-zinc-100 bg-zinc-700 px-2 py-0.5 rounded-full border border-zinc-600 leading-none shadow-lg">
                {p.id}
              </span>

              {/* 头像 */}
              <div
                className="w-[var(--avatar-size)] h-[var(--avatar-size)] rounded-full border-2 border-white/20 overflow-hidden relative shadow-lg mt-2 cursor-zoom-in"
                style={{backgroundColor: p.avatarColor}}
                onPointerDown={(event) => event.stopPropagation()}
                onPointerUp={(event) => {
                  event.stopPropagation();
                  setPreviewPlayer(p);
                }}
              >
                {p.avatarUrl ? (
                  <img
                    src={p.avatarUrl}
                    alt={p.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    {p.isUser ? <User size={18} className="text-white/40"/> : <span className="text-white/30 font-black text-sm">{p.id}</span>}
                  </div>
                )}
                {!p.isAlive && (
                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                    <Skull size={18} className="text-rose-600" />
                  </div>
                )}
              </div>

              {/* 名字 */}
              <span className="text-[10px] sm:text-xs font-bold mt-1.5 truncate w-full text-center leading-tight">{p.name}</span>

              {/* AI模型名称 */}
              {!p.isUser && AI_MODELS.length > 0 && (
                <div className="text-[8px] text-zinc-500 mt-0.5 truncate w-full text-center leading-tight px-1">
                  {AI_MODELS[p.id % AI_MODELS.length]?.id?.split('/').pop()?.slice(0, 12)}
                </div>
              )}

              {/* 身份标签 */}
              <div className="flex flex-wrap gap-0.5 justify-center mt-1">
                {p.isUser && (
                  <span className="text-[9px] bg-emerald-500 text-white px-1.5 py-0.5 rounded font-black flex items-center gap-0.5 whitespace-nowrap">
                    {getRoleIcon(p.role, 10)} {p.role}
                  </span>
                )}
                {isTeammate && (
                  <span className="text-[9px] bg-rose-500 text-white px-1.5 py-0.5 rounded font-black flex items-center gap-0.5 whitespace-nowrap">
                    {getRoleIcon('狼人', 10)} 狼
                  </span>
                )}
                {((gameMode === 'ai-only') || (phase === 'game_over')) && !p.isUser && !isTeammate && p.role && (
                  <span className="text-[9px] bg-indigo-600 text-white px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5 whitespace-nowrap">
                    {getRoleIcon(p.role, 10)} {p.role}
                  </span>
                )}
              </div>

              {/* 行动历史图标 - 始终显示（玩家模式下只有投票和用户自己的行动） */}
              {actionIcons.length > 0 && (
                <div className="flex flex-wrap gap-0.5 justify-center mt-1.5 max-w-full">
                  {actionIcons.slice(0, 4)}
                  {actionIcons.length > 4 && (
                    <span className="text-[8px] text-zinc-500">+{actionIcons.length - 4}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {previewPlayer && (
        <div
          className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center"
          onClick={() => setPreviewPlayer(null)}
        >
          <div
            className="relative w-[min(90vw,420px)] aspect-square bg-zinc-900/95 border border-zinc-700 rounded-3xl shadow-2xl overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            {previewPlayer.avatarUrl ? (
              <img
                src={previewPlayer.avatarUrl}
                alt={previewPlayer.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-zinc-400"
                style={{ backgroundColor: previewPlayer.avatarColor }}
              >
                <User size={48} className="text-white/60" />
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 px-4 py-3 bg-gradient-to-t from-black/80 to-transparent">
              <div className="text-sm font-bold text-zinc-100">{previewPlayer.name}</div>
              <div className="text-[10px] text-zinc-300">{previewPlayer.role || '身份未知'}</div>
            </div>
            <button
              className="absolute top-3 right-3 text-zinc-300 hover:text-white text-xs bg-zinc-800/80 px-2 py-1 rounded-full"
              onClick={() => setPreviewPlayer(null)}
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
