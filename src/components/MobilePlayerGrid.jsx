import { RefreshCw } from 'lucide-react';
import { PlayerCard } from './PlayerCard';

// 手机端玩家网格：顶部紧凑阶段条 + 2~3 列卡片网格。
// 行动控制不在这里（见 MobileActionDrawer）；本组件只负责展示与选择目标。
export function MobilePlayerGrid({
  players,
  userPlayer,
  selectedTarget,
  speakerIndex,
  aliveList = [],
  gameMode,
  phase,
  modelUsage = null,
  AI_MODELS = [],
  getPlayerActionIcons,
  setSelectedTarget,
  setPreviewPlayer,
  phaseInfo,
  statusLine,
  isThinking,
}) {
  return (
    <div className="w-full">
      {/* 阶段条（phase pill）——替代圆桌中心面板的状态显示 */}
      <div className="sticky top-0 z-20 -mx-2 px-2 pt-1 pb-2 bg-bg/80 backdrop-blur-md">
        <div className={`flex items-center justify-center gap-2 rounded-pill border border-line-strong bg-bg-raised px-3 py-1.5 shadow-lg ${phaseInfo?.color || 'text-ink'}`}>
          {phaseInfo?.icon}
          <span className="text-sm font-black tracking-wide leading-none">{phaseInfo?.text}</span>
          {isThinking && <RefreshCw size={13} className="animate-spin text-ink-faint" />}
        </div>
        {statusLine && (
          <p className="mt-1 text-center text-[11px] text-ink-muted font-medium truncate">{statusLine}</p>
        )}
      </div>

      {/* 玩家卡片网格 */}
      <div className="grid grid-cols-2 min-[360px]:grid-cols-3 gap-2 pt-1">
        {players.map((p) => {
          const isTeammate = userPlayer?.role === '狼人' && p.role === '狼人' && p.id !== userPlayer.id;
          const isSpeaking = aliveList[speakerIndex]?.id === p.id;
          const actionIcons = getPlayerActionIcons ? getPlayerActionIcons(p.id) : [];
          const modelInfo = modelUsage?.playerModels?.[p.id];
          const modelLabel = modelInfo?.modelName
            || modelInfo?.modelId?.split('/')?.pop()
            || AI_MODELS[p.id % AI_MODELS.length]?.id?.split('/')?.pop();

          return (
            <PlayerCard
              key={p.id}
              player={p}
              variant="grid"
              selected={selectedTarget === p.id}
              isSpeaking={isSpeaking}
              isTeammate={isTeammate}
              actionIcons={actionIcons}
              modelLabel={modelLabel}
              gameMode={gameMode}
              phase={phase}
              onSelect={setSelectedTarget}
              onAvatarActivate={setPreviewPlayer}
            />
          );
        })}
      </div>
    </div>
  );
}
