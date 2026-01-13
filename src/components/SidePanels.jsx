import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Brain, Moon, Sun, ChevronDown, ChevronUp, Swords, Eye, Shield, FlaskConical, Activity, MessageSquare } from 'lucide-react';

// 获取行动类型图标
const getActionIcon = (type) => {
  switch(type) {
    case '袭击': return <Swords size={12} className="text-rose-400" />;
    case '查验': return <Eye size={12} className="text-purple-400" />;
    case '守护': return <Shield size={12} className="text-blue-400" />;
    case '解药':
    case '毒药': return <FlaskConical size={12} className="text-emerald-400" />;
    default: return <Moon size={12} className="text-indigo-400" />;
  }
};

// 格式化时间戳
const formatTimestamp = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

// 单条消息组件
function MessageItem({ data, type, playerName, playerId, isNight, showThought = true, timestamp }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const content = type === 'speech' ? data.content : data.description;
  // 根据 showThought 决定是否显示思考内容
  const thought = showThought ? data.thought : null;
  const shouldCollapse = content && content.length > 100;
  const displayContent = shouldCollapse && !isExpanded ? content.slice(0, 80) + '...' : content;

  // 系统消息特殊样式
  const isSystemMessage = playerId === 'system';

  return (
    <div className={`
      p-3 rounded-xl border transition-all
      ${isSystemMessage
        ? 'bg-emerald-950/50 border-emerald-500/30 hover:border-emerald-500/50'
        : type === 'action'
          ? 'bg-indigo-950/50 border-indigo-500/30 hover:border-indigo-500/50'
          : 'bg-amber-950/30 border-amber-500/30 hover:border-amber-500/50'}
    `}>
      {/* 头部：玩家信息 + 类型标签 + 时间戳 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isSystemMessage ? (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-600/50 text-emerald-200">
              📢
            </span>
          ) : (
            <span className={`
              text-xs font-bold px-2 py-0.5 rounded-full
              ${type === 'action' ? 'bg-indigo-600/50 text-indigo-200' : 'bg-amber-600/50 text-amber-200'}
            `}>
              {playerId}号
            </span>
          )}
          <span className="text-[10px] text-zinc-400 truncate max-w-[80px]">{playerName}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* 时间戳 */}
          {timestamp && (
            <span className="text-[8px] text-zinc-500">{formatTimestamp(timestamp)}</span>
          )}
          {type === 'action' ? (
            <div className="flex items-center gap-1">
              {getActionIcon(data.type)}
              <span className="text-[9px] text-zinc-400">{data.type}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <MessageCircle size={10} className="text-amber-400" />
              <span className="text-[9px] text-zinc-400">发言</span>
            </div>
          )}
        </div>
      </div>

      {/* 思考过程 */}
      {thought && (
        <div className="mb-2 pb-2 border-b border-zinc-700/50">
          <div className="flex items-center gap-1 mb-1">
            <Brain size={10} className="text-purple-400" />
            <span className="text-[8px] text-purple-400 font-bold uppercase">思考</span>
          </div>
          <p className="text-[10px] text-zinc-400 italic leading-relaxed">
            {thought.length > 80 && !isExpanded ? thought.slice(0, 80) + '...' : thought}
          </p>
        </div>
      )}

      {/* 主要内容 */}
      <p className="text-[11px] text-zinc-200 leading-relaxed whitespace-pre-wrap">
        {displayContent}
      </p>

      {/* 展开/收起按钮 */}
      {(shouldCollapse || (thought && thought.length > 80)) && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 mt-2 text-[9px] text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          {isExpanded ? (
            <>收起 <ChevronUp size={12} /></>
          ) : (
            <>展开全部 <ChevronDown size={12} /></>
          )}
        </button>
      )}
    </div>
  );
}

// 侧边面板组件 - 支持响应式宽度和自动折叠
function SidePanel({ side, messages, phase, title, icon: Icon, accentColor, showThought = true }) {
  const scrollRef = useRef(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // 监听窗口大小变化，小屏幕自动折叠
  useEffect(() => {
    const handleResize = () => {
      // 在小于1280px时自动折叠
      if (window.innerWidth < 1280) {
        setIsCollapsed(true);
      }
    };

    // 初始检查
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 新消息时自动滚动到顶部（因为最新的在最上面）
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [messages.length]);

  // 是否显示展开状态（鼠标悬停时临时展开）
  const showExpanded = !isCollapsed || isHovered;
  const isEmpty = messages.length === 0;

  // 响应式宽度和位置
  const panelStyle = showExpanded
    ? 'w-64 xl:w-72 2xl:w-80'
    : 'w-12';

  // 动态z-index，悬停时提高层级
  const zIndex = isHovered ? 'z-40' : 'z-30';

  return (
    <div
      className={`
        fixed top-20 ${side === 'left' ? 'left-2 xl:left-4' : 'right-2 xl:right-4'}
        ${panelStyle} max-h-[calc(100vh-180px)] ${zIndex}
        bg-zinc-900/95 backdrop-blur-lg
        border border-zinc-700/50 rounded-2xl
        shadow-2xl overflow-hidden
        transition-all duration-300 ease-out
        ${isHovered && isCollapsed ? 'scale-[1.02]' : ''}
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 面板标题 - 可点击折叠 */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`
          w-full px-3 py-2.5 border-b border-zinc-800
          ${accentColor === 'indigo' ? 'bg-indigo-900/30' : 'bg-amber-900/20'}
          hover:bg-zinc-800/50 transition-colors
          flex items-center ${showExpanded ? 'justify-between' : 'justify-center'}
        `}
      >
        <div className="flex items-center gap-2">
          <Icon size={14} className={accentColor === 'indigo' ? 'text-indigo-400' : 'text-amber-400'} />
          {showExpanded && (
            <>
              <span className={`text-xs font-bold ${accentColor === 'indigo' ? 'text-indigo-300' : 'text-amber-300'}`}>
                {title}
              </span>
              <span className="text-[10px] text-zinc-500">({messages.length})</span>
            </>
          )}
        </div>
        {showExpanded && (
          <ChevronDown
            size={14}
            className={`text-zinc-500 transition-transform duration-300 ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}
          />
        )}
      </button>

      {/* 消息列表 - 最新的在最上面 */}
      <div
        ref={scrollRef}
        className={`
          overflow-y-auto custom-scrollbar
          transition-all duration-300 ease-out
          ${showExpanded ? 'p-3 space-y-3 max-h-[calc(100vh-260px)] opacity-100' : 'p-0 max-h-0 opacity-0'}
        `}
      >
        {isEmpty ? (
          <div className="text-center py-8 text-zinc-500 text-[11px]">
            暂无记录
          </div>
        ) : (
          /* 反转数组以实现最新消息在上 */
          [...messages].reverse().map((msg, idx) => (
            <MessageItem
              key={`${msg.playerId}-${messages.length - 1 - idx}`}
              data={msg.data}
              type={msg.type}
              playerName={msg.playerName}
              playerId={msg.playerId}
              isNight={phase === 'night'}
              showThought={showThought}
              timestamp={msg.timestamp}
            />
          ))
        )}
      </div>

      {/* 折叠时显示消息数量徽章 */}
      {!showExpanded && messages.length > 0 && (
        <div className={`
          absolute -top-1 -right-1 w-5 h-5 rounded-full
          flex items-center justify-center text-[10px] font-bold
          ${accentColor === 'indigo' ? 'bg-indigo-500 text-white' : 'bg-amber-500 text-zinc-900'}
          animate-pulse
        `}>
          {messages.length > 9 ? '9+' : messages.length}
        </div>
      )}
    </div>
  );
}

// 主组件：左侧行动面板，右侧发言面板
export function SidePanels({
  players,
  currentPhaseSpeeches,
  currentPhaseActions,
  phase,
  gameMode = 'ai-only',
  userPlayer = null
}) {
  // 获取玩家名称
  const getPlayerName = (playerId) => {
    const player = players.find(p => p.id === playerId);
    return player?.name || `玩家${playerId}`;
  };

  // 判断是否是玩家模式
  const isPlayerMode = gameMode !== 'ai-only';
  // 玩家模式下只在游戏结束时显示AI的思考内容
  const showAIThought = !isPlayerMode || phase === 'game_over';

  // 过滤行动：玩家模式下只显示用户自己的夜间行动，以及公开信息（投票、猎人击杀、平安夜公告）
  const filteredActions = isPlayerMode
    ? currentPhaseActions.filter(action => {
        // 系统公告始终显示（如平安夜公告）
        if (action.playerId === 'system') return true;
        // 用户自己的行动始终显示
        if (action.playerId === userPlayer?.id) return true;
        // 公开信息：投票结果、猎人开枪（这些在白天公开）
        // 夜间其他角色的行动不显示
        return false;
      })
    : currentPhaseActions;

  // 处理行动消息（左侧面板）
  const actionMessages = filteredActions.map(action => ({
    type: 'action',
    playerId: action.playerId,
    playerName: action.playerId === 'system' ? '系统公告' : getPlayerName(action.playerId),
    data: action,
    timestamp: action.timestamp || Date.now()
  }));

  // 处理发言消息（右侧面板）
  const speechMessages = currentPhaseSpeeches.map(speech => ({
    type: 'speech',
    playerId: speech.playerId,
    playerName: getPlayerName(speech.playerId),
    data: speech,
    timestamp: speech.timestamp || Date.now()
  }));

  return (
    <>
      {/* 左侧：行动面板 */}
      <SidePanel
        side="left"
        messages={actionMessages}
        phase={phase}
        title="行动记录"
        icon={Activity}
        accentColor="indigo"
        showThought={showAIThought}
      />
      {/* 右侧：发言面板 */}
      <SidePanel
        side="right"
        messages={speechMessages}
        phase={phase}
        title="玩家发言"
        icon={MessageSquare}
        accentColor="amber"
        showThought={showAIThought}
      />
    </>
  );
}
