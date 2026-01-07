import React from 'react';
import { Download, RotateCcw, AlertTriangle, Moon, Sun } from 'lucide-react';

export function ActionPanel({
  type,
  phase,
  lastWords,
  userInput,
  setUserInput,
  addLog,
  handleLastWordsEnd,
  handleUserHunterShoot,
  selectedTarget,
  hunterPlayer,
  exportGameLog,
  restartGame,
  userPlayer,
  players,
  nightDecisions,
  mergeNightDecisions,
  proceedNight,
  setPlayers,
  setUserPlayer,
  witchHistory,
  setWitchHistory,
  getPlayer,
  addLogFn,
  seerChecks,
  setSeerChecks,
  dayCount,
  nightStep,
  isUserTurn,
  getCurrentNightRole
}) {
  if (type === 'game_over') {
    return (
      <div className="text-center">
        <h2 className="text-2xl font-black mb-4 uppercase tracking-widest text-amber-400">Game Over</h2>
        <p className="text-sm text-zinc-400 mb-6">查看上方日志了解游戏结果</p>
        <div className="flex gap-4 justify-center">
          <button 
            onClick={exportGameLog}
            className="px-10 py-4 bg-indigo-600 rounded-2xl font-black text-xs uppercase hover:bg-indigo-500 transition-all flex items-center gap-2"
          >
            <Download size={18}/> 导出记录
          </button>
          <button 
            onClick={restartGame}
            className="px-10 py-4 bg-emerald-600 rounded-2xl font-black text-xs uppercase hover:bg-emerald-500 transition-all flex items-center gap-2"
          >
            <RotateCcw size={18}/> 重新开始
          </button>
        </div>
      </div>
    );
  }

  if (type === 'hunter_shoot') {
    const hunterInfo = hunterPlayer ? `[${hunterPlayer.id}号] ${hunterPlayer.name}` : '猎人';
    return (
      <div className="text-center">
        <h2 className="text-lg font-black mb-2 uppercase tracking-widest text-orange-400">🔫 猎人开枪</h2>
        <p className="text-sm text-zinc-400 mb-4">{hunterInfo} 可以选择带走一名玩家</p>
        <p className="text-[10px] text-zinc-500 mb-6">选择一个目标开枪，或直接确认不开枪</p>
        <div className="flex gap-4 justify-center">
          <button 
            onClick={handleUserHunterShoot}
            className={`px-10 py-4 rounded-2xl font-black text-xs uppercase transition-all ${selectedTarget !== null ? 'bg-orange-600 hover:bg-orange-500' : 'bg-zinc-700 hover:bg-zinc-600'}`}
          >
            {selectedTarget !== null ? `开枪 [${selectedTarget}号]` : '不开枪'}
          </button>
        </div>
      </div>
    );
  }

  if (type === 'night_user' && isUserTurn()) {
    return (
      <div className="text-center">
        <h2 className="text-lg font-black mb-2 uppercase tracking-widest text-indigo-400">Night Phase: {userPlayer?.role}</h2>
        <p className="text-[10px] text-zinc-500 mb-2">点击头像选择你的行动目标</p>
        {userPlayer?.role === '守卫' && nightDecisions.lastGuardTarget !== null && (
          <p className="text-[10px] text-amber-400 mb-4">
            <AlertTriangle size={12} className="inline mr-1"/>
            上夜守护了 [{nightDecisions.lastGuardTarget}号]，今晚不能守同一人
          </p>
        )}

        {userPlayer?.role === '狼人' && (
          <div className="mb-4">
            <button 
              onClick={() => {
                const updated = { ...nightDecisions, wolfSkipKill: true, wolfTarget: null };
                mergeNightDecisions({ wolfSkipKill: true, wolfTarget: null });
                proceedNight(updated);
              }}
              className="text-[10px] text-zinc-400 underline hover:text-zinc-300"
            >
              选择空刀（不杀人）
            </button>
          </div>
        )}

        {userPlayer?.role === '女巫' && (
          <div className="mb-4 text-left bg-zinc-800/50 p-4 rounded-xl text-[11px]">
            <p className="text-zinc-400 mb-2">
              今晚被刀：{nightDecisions.wolfTarget !== null ? `[${nightDecisions.wolfTarget}号]` : '无人（狼人空刀）'}
            </p>
            <div className="flex gap-4 justify-center mt-4">
              {userPlayer.hasWitchSave && nightDecisions.wolfTarget !== null && (
                <button 
                  onClick={() => {
                    const newDecisions = { ...nightDecisions, witchSave: true };
                    mergeNightDecisions({ witchSave: true });
                    const updatedPlayers = players.map(x => x.id === 0 ? { ...x, hasWitchSave: false } : x);
                    setPlayers(updatedPlayers);
                    setUserPlayer({ ...userPlayer, hasWitchSave: false });
                    setWitchHistory({ ...witchHistory, savedIds: [...witchHistory.savedIds, nightDecisions.wolfTarget] });
                    proceedNight(newDecisions);
                  }}
                  className="px-6 py-2 bg-emerald-600 rounded-xl text-white font-bold hover:bg-emerald-500"
                >
                  使用解药救人
                </button>
              )}
              <button 
                onClick={() => proceedNight()}
                className="px-6 py-2 bg-zinc-700 rounded-xl font-bold hover:bg-zinc-600"
              >
                不使用药水
              </button>
            </div>
            {userPlayer.hasWitchPoison && (
              <p className="text-amber-400 mt-3 text-center">
                或选择一个目标使用毒药（点击头像后确认）
              </p>
            )}
          </div>
        )}

        {userPlayer?.role !== '女巫' && (
          <button 
            disabled={!selectedTarget || (userPlayer?.role === '守卫' && selectedTarget === nightDecisions.lastGuardTarget)}
            onClick={() => {
              let updatedDecisions = { ...nightDecisions };
              if (nightStep === 0) {
                updatedDecisions.guardTarget = selectedTarget;
                mergeNightDecisions({ guardTarget: selectedTarget });
              }
              if (nightStep === 1) {
                updatedDecisions.wolfTarget = selectedTarget;
                updatedDecisions.wolfSkipKill = false;
                mergeNightDecisions({ wolfTarget: selectedTarget, wolfSkipKill: false });
              }
              if (nightStep === 2) {
                const target = getPlayer(selectedTarget);
                const isWolf = target?.role === '狼人';
                setSeerChecks([...seerChecks, { night: dayCount, targetId: selectedTarget, isWolf, seerId: 0 }]);
                addLogFn(`你查验了 [${selectedTarget}号]，结果是：${isWolf ? '🐺 狼人' : '👤 好人'}`, 'info');
              }
              proceedNight(updatedDecisions);
            }}
            className="px-14 py-4 bg-indigo-600 disabled:bg-zinc-800 disabled:text-zinc-600 rounded-2xl font-black text-xs uppercase hover:bg-indigo-500 transition-all"
          >
            Confirm Action
          </button>
        )}

        {userPlayer?.role === '女巫' && userPlayer.hasWitchPoison && selectedTarget !== null && (
          <button 
            onClick={() => {
              const newDecisions = { ...nightDecisions, witchPoison: selectedTarget };
              mergeNightDecisions({ witchPoison: selectedTarget });
              const updatedPlayers = players.map(x => x.id === 0 ? { ...x, hasWitchPoison: false } : x);
              setPlayers(updatedPlayers);
              setUserPlayer({ ...userPlayer, hasWitchPoison: false });
              setWitchHistory({ ...witchHistory, poisonedIds: [...witchHistory.poisonedIds, selectedTarget] });
              proceedNight(newDecisions);
            }}
            className="px-14 py-4 bg-rose-600 rounded-2xl font-black text-xs uppercase hover:bg-rose-500 transition-all"
          >
            使用毒药毒杀 [{selectedTarget}号]
          </button>
        )}
      </div>
    );
  }

  if (type === 'night_ai') {
    return (
      <div className="py-8 flex flex-col items-center justify-center text-zinc-600">
        <Moon className="mb-2 text-indigo-500" size={32}/>
        <p className="text-sm font-bold text-indigo-400">{getCurrentNightRole()} 行动中...</p>
        <p className="text-[10px] text-zinc-500 mt-1">请等待...</p>
      </div>
    );
  }

  if (type === 'day_announce') {
    return (
      <div className="py-8 flex flex-col items-center justify-center text-zinc-600">
        <Sun className="mb-2 text-amber-500" size={32}/>
        <p className="text-sm font-bold text-amber-400">天亮了...</p>
      </div>
    );
  }

  return null;
}
