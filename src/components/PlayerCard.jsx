import { memo } from 'react';
import { Skull, Eye, Shield, FlaskConical, Target, User, Shuffle } from 'lucide-react';

// 角色 → 图标（已 token 化）。圆桌与手机网格共用，保证视觉一致。
export function getRoleIcon(role, size = 16) {
  switch (role) {
    case '狼人': return <Skull size={size} className="text-role-wolf" />;
    case '预言家': return <Eye size={size} className="text-role-seer" />;
    case '女巫': return <FlaskConical size={size} className="text-role-witch" />;
    case '猎人': return <Target size={size} className="text-role-hunter" />;
    case '守卫': return <Shield size={size} className="text-role-guard" />;
    case '魔术师': return <Shuffle size={size} className="text-role-magician" />;
    default: return <User size={size} className="text-ink-faint" />;
  }
}

/**
 * 无定位的纯玩家卡片：编号 / 头像 / 名字 / 角色标签 / 行动徽章 / 存活态。
 * 由圆桌（绝对定位外壳 + 指针拖拽）和手机网格（grid 单元 + 点击选择）共用。
 *
 * variant='circle'：使用 CSS 变量尺寸（--card-width / --avatar-size），保留拖拽手感，
 *   渲染结果与重构前逐字一致。
 * variant='grid'：填满网格单元，固定头像尺寸，点击即选中，触控目标 ≥44px。
 *
 * React.memo：圆桌 8 张卡片中通常只有 1-2 张的 props 变化（发言人/选中目标切换），
 * 父组件已保证 actionIcons / pointerHandlers 引用稳定，浅比较即可跳过其余卡片。
 */
export const PlayerCard = memo(function PlayerCard({
  player,
  variant = 'circle',
  selected = false,
  isSpeaking = false,
  isDragging = false,
  isTeammate = false,
  actionIcons = [],
  modelLabel,
  gameMode,
  phase,
  pointerHandlers = {},
  onSelect,
  onAvatarActivate,
}) {
  const p = player;
  const isCircle = variant === 'circle';

  const selectedClass = isCircle
    ? 'border-state-selected bg-state-selected-soft ring-4 ring-state-selected-soft scale-110'
    : 'border-state-selected bg-state-selected-soft ring-4 ring-state-selected-soft';
  const idleClass = 'bg-bg-raised border-line-strong';
  const aliveInteract = isCircle
    ? 'cursor-grab hover:border-line hover:scale-105'
    : 'cursor-pointer hover:border-line active:scale-95';
  const draggingClass = isCircle && isDragging
    ? 'shadow-2xl ring-2 ring-state-selected-soft scale-105 cursor-grabbing'
    : 'shadow-xl';
  const sizeClass = isCircle
    ? 'w-[var(--card-width)] min-h-[var(--card-height)] select-none touch-none'
    : 'w-full min-h-[5.25rem] select-none';
  const avatarClass = isCircle
    ? 'w-[var(--avatar-size)] h-[var(--avatar-size)]'
    : 'w-11 h-11';

  const containerProps = isCircle
    ? pointerHandlers
    : { onClick: () => p.isAlive && onSelect?.(p.id) };

  const avatarProps = isCircle
    ? {
        onPointerDown: (event) => event.stopPropagation(),
        onPointerUp: (event) => { event.stopPropagation(); onAvatarActivate?.(p); },
      }
    : {
        onClick: (event) => { event.stopPropagation(); onAvatarActivate?.(p); },
      };

  return (
    <div
      {...containerProps}
      className={`
        relative p-2 sm:p-3 rounded-2xl border-2 transition-transform flex flex-col items-center
        ${sizeClass}
        ${selected ? selectedClass : idleClass}
        ${!p.isAlive ? 'opacity-40 grayscale cursor-not-allowed' : aliveInteract}
        ${isSpeaking ? 'ring-2 ring-state-speaking animate-pulse' : ''}
        ${draggingClass}
        backdrop-blur-sm
      `}
    >
      {/* 玩家编号 */}
      <span className="absolute -top-2 -left-1 text-[10px] sm:text-xs font-black text-ink bg-bg-raised px-2 py-0.5 rounded-full border border-line-strong leading-none shadow-lg">
        {p.id}
      </span>

      {/* 警长警徽 */}
      {p.isSheriff && (
        <span className="absolute -top-2 -right-1 text-[11px] leading-none" title="警长（1.5票）">
          🎖️
        </span>
      )}

      {/* 头像 */}
      <div
        className={`${avatarClass} rounded-full border-2 border-white/20 overflow-hidden relative shadow-lg mt-2 cursor-zoom-in`}
        style={{ backgroundColor: p.avatarColor }}
        {...avatarProps}
      >
        {p.avatarUrl ? (
          <img
            src={p.avatarUrl}
            alt={p.name}
            className="w-full h-full object-cover"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {p.isUser ? <User size={18} className="text-white/40" /> : <span className="text-white/30 font-black text-sm">{p.id}</span>}
          </div>
        )}
        {!p.isAlive && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
            <Skull size={18} className="text-state-win-evil" />
          </div>
        )}
      </div>

      {/* 名字 */}
      <span className="text-[10px] sm:text-xs font-bold mt-1.5 truncate w-full text-center leading-tight">{p.name}</span>

      {/* AI模型名称 */}
      {!p.isUser && modelLabel && (
        <div className="text-[8px] text-ink-faint mt-0.5 truncate w-full text-center leading-tight px-1">
          {String(modelLabel).slice(0, 18)}
        </div>
      )}

      {/* 身份标签 */}
      <div className="flex flex-wrap gap-0.5 justify-center mt-1">
        {p.isUser && (
          <span className="text-[9px] bg-state-speaking text-white px-1.5 py-0.5 rounded font-black flex items-center gap-0.5 whitespace-nowrap">
            {getRoleIcon(p.role, 10)} {p.role}
          </span>
        )}
        {isTeammate && (
          <span className="text-[9px] bg-role-wolf text-white px-1.5 py-0.5 rounded font-black flex items-center gap-0.5 whitespace-nowrap">
            {getRoleIcon('狼人', 10)} 狼
          </span>
        )}
        {((gameMode === 'ai-only') || (phase === 'game_over')) && !p.isUser && !isTeammate && p.role && (
          <span className="text-[9px] bg-accent text-white px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5 whitespace-nowrap">
            {getRoleIcon(p.role, 10)} {p.role}
          </span>
        )}
      </div>

      {/* 行动历史图标 - 始终显示（玩家模式下只有投票和用户自己的行动） */}
      {actionIcons.length > 0 && (
        <div className="flex flex-wrap gap-0.5 justify-center mt-1.5 max-w-full">
          {actionIcons.slice(0, 4)}
          {actionIcons.length > 4 && (
            <span className="text-[8px] text-ink-faint">+{actionIcons.length - 4}</span>
          )}
        </div>
      )}
    </div>
  );
});
