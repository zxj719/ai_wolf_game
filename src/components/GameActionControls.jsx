import { Send, RefreshCw, AlertTriangle, Shuffle, Download, PlayCircle, RotateCcw } from 'lucide-react';
import { validateMagicianSwap } from '../utils/magicianUtils';
import { ROLE_DEFINITIONS } from '../config/roles';

/**
 * 各阶段用户交互控件（发言 / 投票 / 夜间行动 / 骑士决斗 / 猎人开枪 / 游戏结束）。
 * 从 CirclePlayerLayout 中心面板抽出，桌面圆桌与手机端 MobileActionDrawer 共用。
 * 所有按钮 onClick 处理器与禁用逻辑保持原样，仅作容器无关化。
 */
export function GameActionControls({
  phase,
  gameMode,
  userPlayer,
  selectedTarget,
  setSelectedTarget,
  isThinking,
  speakerIndex,
  aliveList = [],
  // 发言
  userInput,
  setUserInput,
  handleUserSpeak,
  // 投票
  handleVote,
  // 夜间行动
  isUserTurn,
  nightDecisions,
  mergeNightDecisions,
  proceedNight,
  players,
  setPlayers,
  setUserPlayer,
  witchHistory,
  setWitchHistory,
  magicianHistory,
  setMagicianHistory,
  magicianSwapSelection,
  setMagicianSwapSelection,
  dreamweaverHistory,
  setDreamweaverHistory,
  getPlayer,
  seerChecks,
  setSeerChecks,
  dayCount,
  addLog,
  // 骑士
  handleUserDuel,
  // 猎人
  hunterShooting,
  handleUserHunterShoot,
  // 游戏结束
  gameOverWinner,
  exportGameLog,
  restartGame,
  onReplay,
}) {
  return (
    <>
      {/* 白天讨论 - 用户发言输入 */}
      {phase === 'day_discussion' && speakerIndex >= 0 && aliveList[speakerIndex]?.isUser && gameMode !== 'ai-only' && (
        <div className="w-full mt-2 space-y-1 max-w-[14rem]">
          <div className="flex items-center gap-1 text-[10px] text-state-speaking justify-center">
            <div className="h-1.5 w-1.5 rounded-full bg-state-speaking animate-pulse" />
            <span className="font-bold">轮到你发言</span>
          </div>
          <div className="flex gap-1">
            <input
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="输入你的分析..."
              className="flex-1 bg-bg-raised border border-line-strong rounded-lg px-2 py-1.5 text-xs outline-none focus:border-accent transition-colors"
              onKeyDown={(e) => e.key === 'Enter' && userInput?.trim() && handleUserSpeak()}
            />
            <button
              onClick={handleUserSpeak}
              disabled={!userInput?.trim()}
              className="px-2 bg-accent rounded-lg hover:bg-accent-hover disabled:opacity-50 disabled:hover:bg-accent transition-all"
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
              <p className="text-[10px] text-ink-muted mb-2">请基于逻辑投出放逐票</p>
              <button
                disabled={selectedTarget === null || isThinking}
                onClick={handleVote}
                className="px-6 py-2 bg-accent disabled:bg-bg-raised disabled:text-ink-faint text-black rounded-lg font-bold text-xs uppercase hover:bg-accent-hover transition-all"
              >
                投票
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-1 text-ink-faint text-xs">
              <RefreshCw className="animate-spin" size={14}/>
              <span>AI正在投票...</span>
            </div>
          )}
        </div>
      )}

      {/* 夜间用户行动 */}
      {phase === 'night' && isUserTurn && isUserTurn() && (
        <div className="w-full mt-2 text-center space-y-2 max-w-[14rem]">
          <p className="text-xs text-phase-night font-bold">{userPlayer?.role} 行动</p>
          <p className="text-[10px] text-ink-faint">点击头像选择目标</p>

          {userPlayer?.role === '守卫' && nightDecisions?.lastGuardTarget !== null && (
            <p className="text-[10px] text-phase-day flex items-center justify-center gap-1">
              <AlertTriangle size={10}/>
              上夜守护{nightDecisions.lastGuardTarget}号
            </p>
          )}

          {/* 狼人必须选择目标，不允许空刀 */}

          {userPlayer?.role === '女巫' ? (
            <div className="text-left bg-bg-raised p-2 rounded-lg text-[10px] space-y-2">
              <p className="text-ink-muted text-center">
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
                    className="px-2 py-1 bg-success rounded text-white font-bold hover:opacity-90"
                  >
                    解药
                  </button>
                )}
                <button
                  onClick={() => proceedNight()}
                  className="px-2 py-1 bg-bg-raised border border-line rounded font-bold hover:bg-bg-sunken"
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
                  className="w-full px-2 py-1 bg-danger rounded font-bold hover:opacity-90"
                >
                  毒{selectedTarget}号
                </button>
              )}
            </div>
          ) : userPlayer?.role === '魔术师' ? (
            <div className="text-left bg-bg-raised p-2 rounded-lg text-[10px] space-y-2">
              <p className="text-ink-muted text-center">选择两个玩家进行交换</p>
              {magicianHistory?.lastSwap && (
                <p className="text-phase-day text-[9px] text-center flex items-center justify-center gap-1">
                  <AlertTriangle size={9}/>
                  上次交换了{magicianHistory.lastSwap.player1Id}和{magicianHistory.lastSwap.player2Id}号
                </p>
              )}
              <div className="flex gap-2 justify-center items-center">
                <div className={`px-2 py-1 rounded ${magicianSwapSelection.player1 !== null ? 'bg-role-magician' : 'bg-bg-raised border border-line'}`}>
                  {magicianSwapSelection.player1 !== null ? `${magicianSwapSelection.player1}号` : '?'}
                </div>
                <Shuffle size={12} className="text-role-magician"/>
                <div className={`px-2 py-1 rounded ${magicianSwapSelection.player2 !== null ? 'bg-role-magician' : 'bg-bg-raised border border-line'}`}>
                  {magicianSwapSelection.player2 !== null ? `${magicianSwapSelection.player2}号` : '?'}
                </div>
              </div>
              <div className="flex gap-1 flex-col">
                {selectedTarget !== null && (
                  <button
                    onClick={() => {
                      if (magicianSwapSelection.player1 === null) {
                        setMagicianSwapSelection({ ...magicianSwapSelection, player1: selectedTarget });
                        setSelectedTarget(null);
                      } else if (magicianSwapSelection.player2 === null && selectedTarget !== magicianSwapSelection.player1) {
                        setMagicianSwapSelection({ ...magicianSwapSelection, player2: selectedTarget });
                        setSelectedTarget(null);
                      }
                    }}
                    disabled={magicianSwapSelection.player1 !== null && magicianSwapSelection.player2 !== null}
                    className="px-2 py-1 bg-role-magician rounded font-bold hover:opacity-90 disabled:bg-bg-raised disabled:border disabled:border-line disabled:text-ink-faint"
                  >
                    {magicianSwapSelection.player1 === null ? `选择${selectedTarget}号为第一个` : `选择${selectedTarget}号为第二个`}
                  </button>
                )}
                {magicianSwapSelection.player1 !== null && magicianSwapSelection.player2 !== null && (
                  <button
                    onClick={() => {
                      const swap = { player1Id: magicianSwapSelection.player1, player2Id: magicianSwapSelection.player2 };
                      const validation = validateMagicianSwap(swap, magicianHistory, players.filter(p => p.isAlive));
                      if (validation.valid) {
                        mergeNightDecisions({ magicianSwap: swap });
                        const newHistory = {
                          swappedPlayers: [...(magicianHistory?.swappedPlayers || []), swap.player1Id, swap.player2Id],
                          lastSwap: swap
                        };
                        setMagicianHistory(newHistory);
                        setMagicianSwapSelection({ player1: null, player2: null });
                        addLog(`你交换了 ${swap.player1Id}号 和 ${swap.player2Id}号`, 'info');
                        proceedNight({ ...nightDecisions, magicianSwap: swap });
                      } else {
                        addLog(`交换无效：${validation.reason}`, 'warning');
                      }
                    }}
                    className="px-2 py-1 bg-accent rounded font-bold hover:bg-accent-hover"
                  >
                    确认交换
                  </button>
                )}
                <div className="flex gap-1">
                  {magicianSwapSelection.player1 !== null && (
                    <button
                      onClick={() => setMagicianSwapSelection({ ...magicianSwapSelection, player1: null })}
                      className="flex-1 px-1 py-1 bg-bg-raised border border-line rounded text-[9px] hover:bg-bg-sunken"
                    >
                      清除第一个
                    </button>
                  )}
                  {magicianSwapSelection.player2 !== null && (
                    <button
                      onClick={() => setMagicianSwapSelection({ ...magicianSwapSelection, player2: null })}
                      className="flex-1 px-1 py-1 bg-bg-raised border border-line rounded text-[9px] hover:bg-bg-sunken"
                    >
                      清除第二个
                    </button>
                  )}
                </div>
                <button
                  onClick={() => {
                    mergeNightDecisions({ magicianSwap: null });
                    setMagicianHistory({ ...magicianHistory, lastSwap: null });
                    setMagicianSwapSelection({ player1: null, player2: null });
                    addLog(`你选择不交换`, 'info');
                    proceedNight({ ...nightDecisions, magicianSwap: null });
                  }}
                  className="px-2 py-1 bg-bg-raised border border-line rounded font-bold hover:bg-bg-sunken"
                >
                  不交换
                </button>
              </div>
            </div>
          ) : userPlayer?.role === ROLE_DEFINITIONS.DREAMWEAVER ? (
            <div className="text-left bg-bg-raised p-2 rounded-lg text-[10px] space-y-2">
              <p className="text-ink-muted text-center">选择一名玩家入梦（每晚必须）</p>
              {dreamweaverHistory?.lastDreamTarget !== null && (
                <p className="text-phase-day text-[9px] text-center flex items-center justify-center gap-1">
                  <AlertTriangle size={9}/>
                  上晚入梦了{dreamweaverHistory.lastDreamTarget}号
                  {selectedTarget === dreamweaverHistory.lastDreamTarget && (
                    <span className="text-state-win-evil font-bold ml-1">连梦将击杀TA!</span>
                  )}
                </p>
              )}
              <button
                disabled={selectedTarget === null || selectedTarget === userPlayer?.id}
                onClick={() => {
                  const updatedDecisions = { ...nightDecisions, dreamTarget: selectedTarget };
                  mergeNightDecisions({ dreamTarget: selectedTarget });
                  const newHistory = {
                    dreamedPlayers: [...(dreamweaverHistory?.dreamedPlayers || []),
                      ...(dreamweaverHistory?.dreamedPlayers?.includes(selectedTarget) ? [] : [selectedTarget])],
                    lastDreamTarget: selectedTarget,
                    currentDreamTarget: selectedTarget
                  };
                  setDreamweaverHistory(newHistory);
                  addLog(`你入梦了 ${selectedTarget}号`, 'info');
                  proceedNight(updatedDecisions);
                }}
                className={`w-full px-2 py-1.5 rounded font-bold hover:opacity-90 transition-all ${
                  selectedTarget !== null && selectedTarget === dreamweaverHistory?.lastDreamTarget
                    ? 'bg-danger text-white'
                    : 'bg-role-dreamweaver text-white'
                } disabled:bg-bg-raised disabled:border disabled:border-line disabled:text-ink-faint`}
              >
                {selectedTarget !== null
                  ? (selectedTarget === dreamweaverHistory?.lastDreamTarget
                    ? `连梦击杀 ${selectedTarget}号`
                    : `入梦 ${selectedTarget}号`)
                  : '请选择目标'}
              </button>
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
                className="px-6 py-1.5 bg-accent disabled:bg-bg-raised disabled:text-ink-faint rounded-lg font-bold text-xs hover:bg-accent-hover transition-all"
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

      {/* 骑士决斗 */}
      {phase === 'day_discussion' &&
       userPlayer?.role === ROLE_DEFINITIONS.KNIGHT &&
       !userPlayer?.hasUsedDuel && (
        <div className="w-full mt-2 text-center space-y-2">
          <p className="text-xs text-phase-day font-bold">⚔️ 骑士决斗</p>
          <p className="text-[10px] text-ink-muted">
            选择一名玩家发动决斗（整局一次）
          </p>
          <p className="text-[9px] text-ink-faint">
            对方是狼人→狼出局；对方是好人→你自刎
          </p>
          <button
            onClick={() => handleUserDuel?.(selectedTarget)}
            disabled={selectedTarget === null}
            className={`px-5 py-1.5 rounded-lg font-bold text-xs uppercase transition-all ${
              selectedTarget !== null
                ? 'bg-accent hover:bg-accent-hover cursor-pointer'
                : 'bg-bg-raised cursor-not-allowed opacity-50'
            }`}
          >
            {selectedTarget !== null ? `决斗 ${selectedTarget}号` : '请选择目标'}
          </button>
        </div>
      )}

      {/* 猎人开枪 */}
      {phase === 'hunter_shoot' && hunterShooting && (
        <div className="w-full mt-2 text-center space-y-2">
          <p className="text-xs text-role-hunter font-bold">猎人开枪</p>
          <p className="text-[10px] text-ink-muted">
            {hunterShooting.id}号 可带走一人
          </p>
          <button
            onClick={() => handleUserHunterShoot(
              hunterShooting?.source,
              hunterShooting?.nightDeads,
              hunterShooting?.flowSource,
              hunterShooting?.chainDepth
            )}
            className={`px-5 py-1.5 rounded-lg font-bold text-xs uppercase transition-all ${selectedTarget !== null ? 'bg-role-hunter hover:opacity-90' : 'bg-bg-raised border border-line hover:bg-bg-sunken'}`}
          >
            {selectedTarget !== null ? `开枪${selectedTarget}号` : '不开枪'}
          </button>
        </div>
      )}

      {/* 游戏结束 */}
      {phase === 'game_over' && (
        <div className="w-full mt-2 text-center space-y-2">
          <p className={`text-sm font-black tracking-wide ${gameOverWinner.color}`}>{gameOverWinner.text}</p>
          <h2 className="text-lg font-black uppercase tracking-widest text-phase-day">Game Over</h2>
          <p className="text-[10px] text-ink-muted">查看历史记录</p>
          <div className="flex gap-2 justify-center flex-wrap">
            <button
              onClick={exportGameLog}
              className="px-4 py-1.5 bg-accent rounded-lg font-bold text-xs uppercase hover:bg-accent-hover transition-all flex items-center gap-1"
            >
              <Download size={12}/> 导出
            </button>
            {onReplay && (
            <button
              onClick={onReplay}
              className="px-4 py-1.5 bg-accent rounded-lg font-bold text-xs uppercase hover:bg-accent-hover transition-all flex items-center gap-1"
            >
              <PlayCircle size={12}/> 回放
            </button>
            )}
            <button
              onClick={restartGame}
              className="px-4 py-1.5 bg-success rounded-lg font-bold text-xs uppercase hover:opacity-90 transition-all flex items-center gap-1"
            >
              <RotateCcw size={12}/> 重开
            </button>
          </div>
        </div>
      )}
    </>
  );
}
