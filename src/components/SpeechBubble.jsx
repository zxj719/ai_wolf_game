import React, { useState } from 'react';
import { MessageCircle, Brain, Moon, ChevronDown, ChevronUp } from 'lucide-react';

export function SpeechBubble({
  position = 'right',
  speech,
  action,
  playerName,
  phase
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // 位置样式映射
  const positionStyles = {
    right: {
      container: 'left-full ml-3 top-1/2 -translate-y-1/2',
      tail: 'left-0 top-1/2 -translate-y-1/2 -translate-x-full',
      tailShape: 'border-t-8 border-b-8 border-r-8 border-t-transparent border-b-transparent border-r-bg-raised'
    },
    left: {
      container: 'right-full mr-3 top-1/2 -translate-y-1/2',
      tail: 'right-0 top-1/2 -translate-y-1/2 translate-x-full',
      tailShape: 'border-t-8 border-b-8 border-l-8 border-t-transparent border-b-transparent border-l-bg-raised'
    },
    top: {
      container: 'bottom-full mb-3 left-1/2 -translate-x-1/2',
      tail: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-full',
      tailShape: 'border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-bg-raised'
    },
    bottom: {
      container: 'top-full mt-3 left-1/2 -translate-x-1/2',
      tail: 'top-0 left-1/2 -translate-x-1/2 -translate-y-full',
      tailShape: 'border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-bg-raised'
    }
  };

  const styles = positionStyles[position];
  
  // 判断是白天还是夜晚的内容
  const isNightContent = phase === 'night' || action?.type === 'night';
  
  // 计算内容
  const content = speech?.content || action?.description || '';
  const thought = speech?.thought || action?.thought || '';
  const summary = speech?.summary || action?.summary || '';
  
  // 是否需要折叠（内容超过一定长度）
  const shouldCollapse = content.length > 80;
  const displayContent = shouldCollapse && !isExpanded ? (summary || content.slice(0, 60) + '...') : content;
  
  if (!content && !thought && !action) return null;

  return (
    <div 
      className={`
        absolute z-20 animate-bubble-in
        ${styles.container}
      `}
    >
      {/* 气泡尾巴 */}
      <div className={`absolute w-0 h-0 ${styles.tail} ${styles.tailShape}`} />
      
      {/* 气泡主体 */}
      <div 
        className={`
          relative bg-bg-raised border-2 rounded-2xl p-3 shadow-xl
          min-w-[120px] max-w-[200px]
          ${isNightContent ? 'border-phase-night-soft' : 'border-phase-day-soft'}
          transition-all duration-300 hover:shadow-2xl
        `}
      >
        {/* 阶段图标 */}
        <div className={`
          absolute -top-2 -right-2 p-1 rounded-full
          ${isNightContent ? 'bg-phase-night' : 'bg-phase-day'}
        `}>
          {isNightContent ? <Moon size={12} className="text-white" /> : <MessageCircle size={12} className="text-white" />}
        </div>

        {/* 思考过程（如果有） */}
        {thought && (
          <div className="mb-2 pb-2 border-b border-line-strong">
            <div className="flex items-center gap-1 mb-1">
              <Brain size={10} className="text-role-seer flex-shrink-0" />
              <span className="text-[0.5rem] md:text-[0.625rem] text-role-seer font-bold uppercase">思考</span>
            </div>
            <p className={`text-[0.5rem] md:text-[0.625rem] text-ink-muted italic leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>
              {thought}
            </p>
            {thought.length > 80 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="flex items-center gap-0.5 mt-1 text-[0.5rem] text-ink-faint hover:text-ink-muted transition-colors"
              >
                {isExpanded ? (
                  <>收起 <ChevronUp size={10} /></>
                ) : (
                  <>展开 <ChevronDown size={10} /></>
                )}
              </button>
            )}
          </div>
        )}

        {/* 主要内容 */}
        <div>
          {action && (
            <div className="flex items-center gap-1 mb-1">
              <span className={`text-[8px] font-bold uppercase ${isNightContent ? 'text-phase-night' : 'text-phase-day'}`}>
                {action.actionType || '行动'}
              </span>
            </div>
          )}
          <p className="text-[10px] text-ink leading-relaxed">
            {displayContent}
          </p>
          
          {/* 展开/收起按钮 */}
          {shouldCollapse && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="flex items-center gap-0.5 mt-1 text-[8px] text-ink-faint hover:text-ink-muted transition-colors"
            >
              {isExpanded ? (
                <>收起 <ChevronUp size={10} /></>
              ) : (
                <>展开 <ChevronDown size={10} /></>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
