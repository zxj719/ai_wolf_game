import { GameActionControls } from './GameActionControls';
import { ROLE_DEFINITIONS } from '../config/roles';

/**
 * 手机端底部固定行动抽屉。
 * 复用 GameActionControls（与桌面圆桌中心面板同源），仅更换容器为屏幕底部、
 * 拇指可达、带安全区内边距。无可执行行动时不渲染（避免空 bar）。
 */
export function MobileActionDrawer(props) {
  const {
    phase,
    speakerIndex,
    aliveList = [],
    gameMode,
    userPlayer,
    isUserTurn,
    hunterShooting,
  } = props;

  const hasAction =
    (phase === 'day_discussion' && speakerIndex >= 0 && aliveList[speakerIndex]?.isUser && gameMode !== 'ai-only') ||
    (phase === 'day_voting') ||
    (phase === 'night' && typeof isUserTurn === 'function' && isUserTurn()) ||
    (phase === 'day_discussion' && userPlayer?.role === ROLE_DEFINITIONS.KNIGHT && !userPlayer?.hasUsedDuel) ||
    (phase === 'hunter_shoot' && !!hunterShooting) ||
    (phase === 'game_over');

  if (!hasAction) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 border-t border-line-strong bg-bg-raised/95 backdrop-blur-lg shadow-2xl pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto w-full max-w-2xl px-4 py-3 flex flex-col items-center text-center">
        <GameActionControls {...props} />
      </div>
    </div>
  );
}
