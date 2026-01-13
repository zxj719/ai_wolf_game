import { useState, useCallback, useRef, useEffect } from 'react';
import { Skull, Eye, Shield, FlaskConical, Target, User, Moon, Sun, RefreshCw, Send, Download, RotateCcw, AlertTriangle, Syringe, Crosshair, Vote, MinusCircle } from 'lucide-react';

// 物理常量 - 调整为更轻盈柔和的泡泡效果
const PHYSICS = {
  CENTER_IDEAL_RADIUS: 31,       // 理想距离中心的半径（%）- 距面板一个卡片宽度
  CENTER_SPRING_K: 0.015,        // 中心弹簧刚度（轻柔拉回）
  CENTER_REPEL_K: 0.025,         // 中心排斥力（轻柔推开）
  CENTER_MIN_RADIUS: 22,         // 最小允许距离中心的半径
  NEIGHBOR_SPRING_K: 0.008,      // 相邻卡片弹簧刚度（更轻柔）
  NEIGHBOR_IDEAL_DIST: 18,       // 相邻卡片理想间距（%）
  CARD_REPEL_K: 0.02,            // 卡片间排斥力（轻柔）
  CARD_MIN_DIST: 14,             // 卡片最小间距（%）
  DAMPING: 0.96,                 // 阻尼系数（更高=更慢衰减=更飘）
  VELOCITY_THRESHOLD: 0.005,     // 速度阈值（更低=动画更长）
  LONG_PRESS_DURATION: 200,      // 长按触发拖拽的时间（ms）
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
  // 玩家卡片位置状态（用于拖拽和物理模拟）
  const [cardPositions, setCardPositions] = useState({});
  const [draggingId, setDraggingId] = useState(null);
  const [longPressTarget, setLongPressTarget] = useState(null); // 长按中的卡片
  const dragStartRef = useRef({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const longPressTimerRef = useRef(null);

  // 物理模拟状态
  const velocitiesRef = useRef({}); // 每个卡片的速度 {id: {vx, vy}}
  const physicsActiveRef = useRef(false);
  const animationFrameRef = useRef(null);

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

  // 计算圆形布局的默认位置
  const getDefaultPosition = (index, total) => {
    const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
    const radius = PHYSICS.CENTER_IDEAL_RADIUS; // 使用物理常量保持一致
    const x = 50 + radius * Math.cos(angle);
    const y = 50 + radius * Math.sin(angle);
    return { x, y };
  };

  // 获取玩家卡片的当前位置（优先使用拖拽位置）
  const getCardPosition = (playerId, index) => {
    if (cardPositions[playerId]) {
      return cardPositions[playerId];
    }
    return getDefaultPosition(index, totalPlayers);
  };

  // 长按开始 - 触发拖拽准备
  const handlePressStart = useCallback((e, playerId) => {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    dragStartRef.current = { x: clientX, y: clientY };
    setLongPressTarget(playerId);

    // 设置长按定时器
    longPressTimerRef.current = setTimeout(() => {
      setDraggingId(playerId);
      setLongPressTarget(null);
      // 添加震动反馈（移动端）
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, PHYSICS.LONG_PRESS_DURATION);
  }, []);

  // 长按取消（用户松开或移动）
  const handlePressCancel = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setLongPressTarget(null);
  }, []);

  // 拖拽移动
  const handleDragMove = useCallback((e) => {
    if (draggingId === null || !containerRef.current) return;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const rect = containerRef.current.getBoundingClientRect();
    const deltaX = ((clientX - dragStartRef.current.x) / rect.width) * 100;
    const deltaY = ((clientY - dragStartRef.current.y) / rect.height) * 100;

    const playerIndex = players.findIndex(p => p.id === draggingId);
    const currentPos = cardPositions[draggingId] || getDefaultPosition(playerIndex, totalPlayers);

    const newX = Math.max(5, Math.min(95, currentPos.x + deltaX));
    const newY = Math.max(5, Math.min(95, currentPos.y + deltaY));

    setCardPositions(prev => ({
      ...prev,
      [draggingId]: { x: newX, y: newY }
    }));

    dragStartRef.current = { x: clientX, y: clientY };
  }, [draggingId, cardPositions, players, totalPlayers]);

  // 物理模拟 - 计算力并更新位置
  const runPhysicsStep = useCallback(() => {
    if (draggingId !== null) {
      // 拖拽中不运行物理模拟
      physicsActiveRef.current = false;
      return;
    }

    setCardPositions(prevPositions => {
      const newPositions = { ...prevPositions };
      let totalKineticEnergy = 0;

      // 遍历所有玩家计算力
      players.forEach((player, index) => {
        const pos = newPositions[player.id] || getDefaultPosition(index, totalPlayers);
        let velocity = velocitiesRef.current[player.id] || { vx: 0, vy: 0 };

        // 计算到中心的距离
        const dx = pos.x - 50;
        const dy = pos.y - 50;
        const distToCenter = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);

        let fx = 0, fy = 0;

        // 1. 中心弹簧力 - 过远拉回，过近推开
        if (distToCenter > PHYSICS.CENTER_IDEAL_RADIUS) {
          // 过远 - 磁铁吸引力
          const overDist = distToCenter - PHYSICS.CENTER_IDEAL_RADIUS;
          const forceMag = overDist * PHYSICS.CENTER_SPRING_K;
          fx -= forceMag * Math.cos(angle);
          fy -= forceMag * Math.sin(angle);
        } else if (distToCenter < PHYSICS.CENTER_MIN_RADIUS) {
          // 过近 - 弹簧推开力
          const underDist = PHYSICS.CENTER_MIN_RADIUS - distToCenter;
          const forceMag = underDist * PHYSICS.CENTER_REPEL_K;
          fx += forceMag * Math.cos(angle);
          fy += forceMag * Math.sin(angle);
        }

        // 2. 相邻卡片弹力绳约束（按编号顺序）
        const prevIndex = (index - 1 + players.length) % players.length;
        const nextIndex = (index + 1) % players.length;

        [prevIndex, nextIndex].forEach(neighborIdx => {
          const neighborPos = newPositions[players[neighborIdx].id] ||
            getDefaultPosition(neighborIdx, totalPlayers);
          const ndx = neighborPos.x - pos.x;
          const ndy = neighborPos.y - pos.y;
          const neighborDist = Math.sqrt(ndx * ndx + ndy * ndy);

          if (neighborDist > 0.1) {
            const idealDist = PHYSICS.NEIGHBOR_IDEAL_DIST;
            const distDiff = neighborDist - idealDist;
            const neighborAngle = Math.atan2(ndy, ndx);
            const springForce = distDiff * PHYSICS.NEIGHBOR_SPRING_K;
            fx += springForce * Math.cos(neighborAngle);
            fy += springForce * Math.sin(neighborAngle);
          }
        });

        // 3. 卡片间排斥力（防止重叠）
        players.forEach((other, otherIdx) => {
          if (other.id === player.id) return;
          const otherPos = newPositions[other.id] || getDefaultPosition(otherIdx, totalPlayers);
          const odx = pos.x - otherPos.x;
          const ody = pos.y - otherPos.y;
          const otherDist = Math.sqrt(odx * odx + ody * ody);

          if (otherDist < PHYSICS.CARD_MIN_DIST && otherDist > 0.1) {
            const repelForce = (PHYSICS.CARD_MIN_DIST - otherDist) * PHYSICS.CARD_REPEL_K;
            const repelAngle = Math.atan2(ody, odx);
            fx += repelForce * Math.cos(repelAngle);
            fy += repelForce * Math.sin(repelAngle);
          }
        });

        // 更新速度和位置
        velocity.vx = (velocity.vx + fx) * PHYSICS.DAMPING;
        velocity.vy = (velocity.vy + fy) * PHYSICS.DAMPING;

        const newX = Math.max(8, Math.min(92, pos.x + velocity.vx));
        const newY = Math.max(8, Math.min(92, pos.y + velocity.vy));

        newPositions[player.id] = { x: newX, y: newY };
        velocitiesRef.current[player.id] = velocity;

        totalKineticEnergy += velocity.vx * velocity.vx + velocity.vy * velocity.vy;
      });

      // 检查是否应该停止模拟
      if (totalKineticEnergy < PHYSICS.VELOCITY_THRESHOLD * players.length) {
        physicsActiveRef.current = false;
      } else {
        // 继续下一帧
        animationFrameRef.current = requestAnimationFrame(runPhysicsStep);
      }

      return newPositions;
    });
  }, [players, totalPlayers, draggingId]);

  // 启动物理模拟
  const startPhysics = useCallback(() => {
    if (physicsActiveRef.current) return;
    physicsActiveRef.current = true;
    animationFrameRef.current = requestAnimationFrame(runPhysicsStep);
  }, [runPhysicsStep]);

  // 拖拽结束
  const handleDragEnd = useCallback(() => {
    // 清除长按定时器
    handlePressCancel();

    if (draggingId !== null) {
      setDraggingId(null);
      // 拖拽结束后启动物理模拟
      setTimeout(() => startPhysics(), 50);
    }
  }, [startPhysics, draggingId, handlePressCancel]);

  // 绑定全局事件（拖拽和长按取消）
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      handleDragEnd();
    };

    const handleGlobalTouchEnd = () => {
      handleDragEnd();
    };

    // 始终监听mouseup和touchend以处理长按取消
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('touchend', handleGlobalTouchEnd);

    // 只有在拖拽中才监听移动事件
    if (draggingId !== null) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('touchmove', handleDragMove, { passive: false });
    }

    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('touchend', handleGlobalTouchEnd);
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('touchmove', handleDragMove);
    };
  }, [draggingId, handleDragMove, handleDragEnd]);

  // 重置所有位置和速度
  const resetPositions = () => {
    // 停止物理模拟
    physicsActiveRef.current = false;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    // 清除速度和位置
    velocitiesRef.current = {};
    setCardPositions({});
  };

  // 组件卸载时清理动画帧
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // 获取游戏阶段显示文字
  const getPhaseText = () => {
    if (phase === 'night') return { icon: <Moon size={28} />, text: `第${dayCount}夜`, color: 'text-indigo-400' };
    if (phase === 'day_discussion') return { icon: <Sun size={28} />, text: `第${dayCount}天 - 讨论`, color: 'text-amber-400' };
    if (phase === 'day_voting') return { icon: <Sun size={28} />, text: `第${dayCount}天 - 投票`, color: 'text-orange-400' };
    if (phase === 'day_announce') return { icon: <Sun size={28} />, text: `第${dayCount}天 - 公告`, color: 'text-yellow-400' };
    if (phase === 'hunter_shoot') return { icon: <Target size={28} />, text: '猎人开枪', color: 'text-red-400' };
    if (phase === 'game_over') return { icon: null, text: '游戏结束', color: 'text-emerald-400' };
    return { icon: null, text: '', color: 'text-zinc-400' };
  };

  const phaseInfo = getPhaseText();

  return (
    <div ref={containerRef} className="relative w-full aspect-square max-w-5xl mx-auto">
      {/* 中央状态区域 - 圆形面板 */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
        <div className="bg-zinc-900/95 border-2 border-zinc-700 rounded-full p-6 md:p-10 shadow-2xl backdrop-blur-lg w-[16rem] h-[16rem] md:w-[20rem] md:h-[20rem] flex items-center justify-center">
          <div className={`flex flex-col items-center gap-2 ${phaseInfo.color} w-full`}>
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-zinc-800 to-zinc-900 border-2 border-zinc-700 flex items-center justify-center shadow-xl">
              {phaseInfo.icon}
            </div>
            <span className="text-base md:text-lg font-black tracking-wide leading-tight text-center">{phaseInfo.text}</span>

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

            {/* 重置位置按钮 */}
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

      {/* 圆形排列的玩家卡片 - 可拖拽 */}
      {players.map((p, index) => {
        const { x, y } = getCardPosition(p.id, index);
        const isTeammate = userPlayer?.role === '狼人' && p.role === '狼人' && p.id !== userPlayer.id;
        const isSpeaking = (aliveList[speakerIndex])?.id === p.id;
        const isDragging = draggingId === p.id;
        const actionIcons = getPlayerActionIcons(p.id);

        return (
          <div
            key={p.id}
            className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all ${isDragging ? 'z-50 scale-105' : 'z-20'}`}
            style={{
              left: `${x}%`,
              top: `${y}%`,
              transition: isDragging ? 'none' : 'all 0.3s ease-out'
            }}
          >
            {/* 玩家卡片 - 长按可拖拽 */}
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                handlePressStart(e, p.id);
              }}
              onTouchStart={(e) => handlePressStart(e, p.id)}
              onMouseUp={() => {
                // 如果不是拖拽中，则是点击选择
                if (draggingId !== p.id && p.isAlive) {
                  handlePressCancel();
                  setSelectedTarget(p.id);
                }
              }}
              onTouchEnd={() => {
                // 如果不是拖拽中，则是点击选择
                if (draggingId !== p.id && p.isAlive && !longPressTarget) {
                  setSelectedTarget(p.id);
                }
              }}
              className={`
                relative p-3 rounded-2xl border-2 transition-all select-none
                w-[6.5rem] min-h-[7.5rem] flex flex-col items-center
                ${selectedTarget === p.id ? 'border-indigo-500 bg-indigo-500/20 ring-4 ring-indigo-500/30 scale-110' : 'bg-zinc-900/95 border-zinc-700'}
                ${!p.isAlive ? 'opacity-40 grayscale cursor-not-allowed' : 'cursor-pointer hover:border-zinc-500 hover:scale-105'}
                ${isSpeaking ? 'ring-2 ring-emerald-500 animate-pulse' : ''}
                ${isDragging ? 'shadow-2xl ring-2 ring-cyan-400/50 scale-110 cursor-grabbing' : 'shadow-xl'}
                ${longPressTarget === p.id ? 'ring-2 ring-cyan-400/30 scale-105' : ''}
                backdrop-blur-sm
              `}
            >

              {/* 玩家编号 */}
              <span className="absolute -top-2 -left-1 text-xs font-black text-zinc-100 bg-zinc-700 px-2 py-0.5 rounded-full border border-zinc-600 leading-none shadow-lg">
                {p.id}
              </span>

              {/* 头像 */}
              <div
                className="w-12 h-12 rounded-full border-2 border-white/20 overflow-hidden relative shadow-lg mt-2"
                style={{backgroundColor: p.avatarColor}}
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
              <span className="text-xs font-bold mt-1.5 truncate w-full text-center leading-tight">{p.name}</span>

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
    </div>
  );
}
