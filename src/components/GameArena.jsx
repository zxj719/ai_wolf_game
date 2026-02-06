import { useRef, useState, useEffect, useCallback } from 'react';
import { CirclePlayerLayout } from './CirclePlayerLayout';
import { GameHistoryTable } from './GameHistoryTable';
import { PhaseActionContainer } from './PhaseActionContainer';
import { SidePanels } from './SidePanels';
import { ChevronUp, ChevronDown, History, ArrowLeft } from 'lucide-react';

export function GameArena({
  // 游戏状态
  players,
  userPlayer,
  phase,
  dayCount,
  nightStep,
  nightDecisions,
  speechHistory,
  nightActionHistory,
  voteHistory,
  deathHistory,
  seerChecks,
  guardHistory,
  witchHistory,
  currentPhaseData,
  gameBackground,
  logs,
  modelUsage,

  // 选择状态
  selectedTarget,
  setSelectedTarget,
  speakerIndex,

  // 控制
  gameMode,
  isThinking,

  // 用户交互
  speakingOrder,
  setSpeakingOrder,
  userInput,
  setUserInput,
  handleUserSpeak,

  // Action handlers (传递给子组件)
  hunterShooting,
  handleUserHunterShoot,
  handleAIHunterShoot,
  handleVote,
  proceedNight,
  mergeNightDecisions,
  setPlayers,
  setUserPlayer,
  witchHistorySetter,
  getPlayer,
  addLog,
  setSeerChecks,
  currentNightSequence,
  ROLE_DEFINITIONS,
  getCurrentNightRole,
  isUserTurn,
  exportGameLog,
  restartGame,
  onExit,
  exitLabel = '返回首页',

  // AI
  AI_MODELS
}) {
  // 页面滚动控制
  const containerRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(0); // 0: 游戏区域, 1: 历史记录
  const isScrollingRef = useRef(false);

  // 获取所有历史发言/行动（累积显示，不再仅显示当前阶段）
  const getAllSpeeches = () => {
    // 合并 speechHistory（持久化）和 currentPhaseData.speeches（实时）
    const historicalSpeeches = speechHistory || [];
    const currentSpeeches = currentPhaseData?.speeches || [];

    // 去重：以 playerId + day + content 为唯一标识
    const seen = new Set();
    const allSpeeches = [];

    // 先添加历史记录
    historicalSpeeches.forEach(s => {
      const key = `${s.playerId}-${s.day}-${s.content?.slice(0, 50)}`;
      if (!seen.has(key)) {
        seen.add(key);
        allSpeeches.push(s);
      }
    });

    // 再添加当前阶段的实时数据（可能尚未写入历史）
    currentSpeeches.forEach(s => {
      const key = `${s.playerId}-${s.day}-${s.content?.slice(0, 50)}`;
      if (!seen.has(key)) {
        seen.add(key);
        allSpeeches.push(s);
      }
    });

    return allSpeeches;
  };

  const getAllActions = () => {
    // 合并 nightActionHistory（持久化）和 currentPhaseData.actions（实时）
    const historicalActions = nightActionHistory || [];
    const currentActions = currentPhaseData?.actions || [];

    // 去重：以 playerId + (night/day) + type + target 为唯一标识
    const seen = new Set();
    const allActions = [];

    // 先添加历史记录
    historicalActions.forEach(a => {
      const phaseKey = a.night !== undefined && a.night !== null ? `N${a.night}` : `D${a.day ?? ''}`;
      const key = `${a.playerId}-${phaseKey}-${a.type}-${a.target ?? ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        allActions.push(a);
      }
    });

    // 再添加当前阶段的实时数据（可能尚未写入历史）
    currentActions.forEach(a => {
      const phaseKey = a.night !== undefined && a.night !== null ? `N${a.night}` : `D${a.day ?? ''}`;
      const key = `${a.playerId}-${phaseKey}-${a.type}-${a.target ?? ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        allActions.push(a);
      }
    });

    // 添加投票历史记录（任务2：行动板持久化）
    if (voteHistory && voteHistory.length > 0) {
      voteHistory.forEach(v => {
        const voteKey = `system-vote-day${v.day}`;
        if (!seen.has(voteKey)) {
          seen.add(voteKey);
          allActions.push({
            playerId: 'system',
            type: '投票结果',
            description: v.eliminated !== null
              ? `第${v.day}天投票: ${v.eliminated}号出局`
              : `第${v.day}天投票: 流票`,
            day: v.day,
            phase: '投票',
            timestamp: Date.now(),
            votes: v.votes
          });
        }
      });
    }

    // 按时间线排序：先按日/夜顺序，再按时间戳
    return allActions.sort((a, b) => {
      // 计算排序权重：夜N对应2N-1，日N对应2N
      const aOrder = a.night !== undefined && a.night !== null
        ? (a.night * 2 - 1)
        : ((a.day ?? 1) * 2);
      const bOrder = b.night !== undefined && b.night !== null
        ? (b.night * 2 - 1)
        : ((b.day ?? 1) * 2);
      if (aOrder !== bOrder) return aOrder - bOrder;
      return (a.timestamp || 0) - (b.timestamp || 0);
    });
  };

  // 获取游戏背景样式
  const getBackgroundStyle = () => {
    if (phase === 'night') {
      return 'bg-gradient-to-b from-indigo-950 via-zinc-950 to-zinc-950';
    }
    return 'bg-gradient-to-b from-amber-950/20 via-zinc-950 to-zinc-950';
  };

  // 滚动到指定页面
  const scrollToPage = useCallback((pageIndex) => {
    if (isScrollingRef.current) return;

    const container = containerRef.current;
    if (!container) return;

    isScrollingRef.current = true;
    setCurrentPage(pageIndex);

    const targetScroll = pageIndex * window.innerHeight;
    container.scrollTo({
      top: targetScroll,
      behavior: 'smooth'
    });

    // 防抖：滚动完成后解锁
    setTimeout(() => {
      isScrollingRef.current = false;
    }, 800);
  }, []);

  // 处理滚轮事件 - 仅允许从历史页面滚动回游戏页面
  const handleWheel = useCallback((e) => {
    // 如果在游戏页面，不处理滚轮翻页
    if (currentPage === 0) return;

    // 检查是否在可滚动的子元素内
    const target = e.target;
    let scrollableParent = target;

    // 查找可滚动的父元素
    while (scrollableParent && scrollableParent !== containerRef.current) {
      const { scrollHeight, clientHeight, scrollTop } = scrollableParent;
      const isScrollable = scrollHeight > clientHeight;

      if (isScrollable) {
        // 如果在可滚动元素内且没有滚动到顶部，不触发翻页
        const isAtTop = scrollTop <= 0;
        if (e.deltaY < 0 && !isAtTop) return;
      }
      scrollableParent = scrollableParent.parentElement;
    }

    // 防止默认滚动
    e.preventDefault();

    if (isScrollingRef.current) return;

    // 仅处理向上滚动（从历史记录返回游戏）
    if (e.deltaY < -30 && currentPage === 1) {
      scrollToPage(0);
    }
  }, [currentPage, scrollToPage]);

  // 绑定滚轮事件
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel]);

  return (
    <div
      ref={containerRef}
      className="h-screen overflow-hidden"
      style={{ scrollBehavior: 'smooth' }}
    >
      {onExit && (
        <div className="fixed top-4 left-4 z-50">
          <button
            onClick={onExit}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 rounded-lg border border-zinc-700 transition-colors"
          >
            <ArrowLeft size={14} />
            {exitLabel}
          </button>
        </div>
      )}
      {/* 第一页：游戏区域 */}
      <section
        className={`h-screen relative ${getBackgroundStyle()} text-zinc-100 overflow-hidden`}
      >
        {/* 动态生成的主题背景图像 */}
        {gameBackground && (
          <div
            className="absolute inset-0 z-0 opacity-30"
            style={{
              backgroundImage: `url(${gameBackground})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }}
          />
        )}
        {/* 左右两侧发言/行动面板 - 仅在游戏主界面显示 */}
        {currentPage === 0 && (
          <SidePanels
            players={players}
            currentPhaseSpeeches={getAllSpeeches()}
            currentPhaseActions={getAllActions()}
            phase={phase}
            gameMode={gameMode}
            userPlayer={userPlayer}
          />
        )}

        {/* 主游戏区域 - 圆形布局 */}
        <div className="h-full flex flex-col items-center justify-center p-4 pb-24 relative">
          {/* 圆形玩家布局 */}
          <div className="w-full max-w-6xl mx-auto">
            <CirclePlayerLayout
              players={players}
              userPlayer={userPlayer}
              nightDecisions={nightDecisions}
              selectedTarget={selectedTarget}
              setSelectedTarget={setSelectedTarget}
              speakerIndex={speakerIndex}
              phase={phase}
              gameMode={gameMode}
              seerChecks={seerChecks}
              dayCount={dayCount}
              nightStep={nightStep}
              AI_MODELS={AI_MODELS}
              isThinking={isThinking}
              getCurrentNightRole={getCurrentNightRole}
              speakingOrder={speakingOrder}
              setSpeakingOrder={setSpeakingOrder}
              userInput={userInput}
              setUserInput={setUserInput}
              handleUserSpeak={handleUserSpeak}
              handleVote={handleVote}
              voteHistory={voteHistory}
              mergeNightDecisions={mergeNightDecisions}
              proceedNight={proceedNight}
              setPlayers={setPlayers}
              setUserPlayer={setUserPlayer}
              witchHistory={witchHistory}
              setWitchHistory={witchHistorySetter}
              guardHistory={guardHistory}
              nightActionHistory={nightActionHistory}
              modelUsage={modelUsage}
              getPlayer={getPlayer}
              addLog={addLog}
              setSeerChecks={setSeerChecks}
              isUserTurn={isUserTurn}
              hunterShooting={hunterShooting}
              handleUserHunterShoot={handleUserHunterShoot}
              exportGameLog={exportGameLog}
              restartGame={restartGame}
            />
          </div>

          {/* 历史记录入口按钮 */}
          <button
            onClick={() => scrollToPage(1)}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 bg-zinc-800/80 hover:bg-zinc-700/90 border border-zinc-700 rounded-full text-xs font-bold text-zinc-300 hover:text-white transition-all backdrop-blur-sm shadow-lg z-30"
          >
            <History size={14} />
            <span>查看历史记录</span>
            <ChevronDown size={14} />
          </button>

          {/* 底部操作面板 */}
          <div className="absolute bottom-20 left-0 right-0 px-4">
            <div className="max-w-2xl mx-auto">
              <PhaseActionContainer
                phase={phase}
                gameMode={gameMode}
                isThinking={isThinking}
                hunterShooting={hunterShooting}
                selectedTarget={selectedTarget}
                handleUserHunterShoot={handleUserHunterShoot}
                handleAIHunterShoot={handleAIHunterShoot}
                speakerIndex={speakerIndex}
                players={players}
                speakingOrder={speakingOrder}
                setSpeakingOrder={setSpeakingOrder}
                userInput={userInput}
                setUserInput={setUserInput}
                handleUserSpeak={handleUserSpeak}
                userPlayer={userPlayer}
                nightDecisions={nightDecisions}
                mergeNightDecisions={mergeNightDecisions}
                proceedNight={proceedNight}
                setPlayers={setPlayers}
                setUserPlayer={setUserPlayer}
                witchHistory={witchHistory}
                setWitchHistory={witchHistorySetter}
                getPlayer={getPlayer}
                addLog={addLog}
                seerChecks={seerChecks}
                setSeerChecks={setSeerChecks}
                dayCount={dayCount}
                nightStep={nightStep}
                currentNightSequence={currentNightSequence}
                ROLE_DEFINITIONS={ROLE_DEFINITIONS}
                getCurrentNightRole={getCurrentNightRole}
                isUserTurn={isUserTurn}
                handleVote={handleVote}
                exportGameLog={exportGameLog}
                restartGame={restartGame}
                setSelectedTarget={setSelectedTarget}
              />
            </div>
          </div>
        </div>

      </section>

      {/* 第二页：历史记录 */}
      <section className="h-screen bg-zinc-950 text-zinc-100 overflow-hidden flex flex-col">
        {/* 顶部翻页提示 */}
        <button
          onClick={() => scrollToPage(0)}
          className="py-3 flex flex-col items-center gap-1 text-zinc-500 hover:text-zinc-300 transition-colors border-b border-zinc-800 bg-zinc-900/50 flex-shrink-0"
        >
          <ChevronUp size={20} />
          <span className="text-[10px] font-medium uppercase tracking-wider">返回游戏</span>
        </button>

        {/* 历史记录表格区域 - 可独立滚动 */}
        <div className="flex-1 overflow-y-auto p-6 pb-16">
          <div className="max-w-7xl mx-auto">
            <GameHistoryTable
              players={players}
              speechHistory={speechHistory}
              nightActionHistory={nightActionHistory}
              voteHistory={voteHistory}
              deathHistory={deathHistory}
              seerChecks={seerChecks}
              guardHistory={guardHistory}
              witchHistory={witchHistory}
              dayCount={dayCount}
              exportFullLog={exportGameLog}
              gameMode={gameMode}
              userPlayer={userPlayer}
              phase={phase}
            />
          </div>
        </div>
      </section>

      {/* 页面指示器 */}
      <div className="fixed right-4 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-2">
        <button
          onClick={() => scrollToPage(0)}
          className={`w-2 h-2 rounded-full transition-all ${
            currentPage === 0 ? 'bg-white scale-125' : 'bg-zinc-600 hover:bg-zinc-400'
          }`}
          title="游戏区域"
        />
        <button
          onClick={() => scrollToPage(1)}
          className={`w-2 h-2 rounded-full transition-all ${
            currentPage === 1 ? 'bg-white scale-125' : 'bg-zinc-600 hover:bg-zinc-400'
          }`}
          title="历史记录"
        />
      </div>
    </div>
  );
}
