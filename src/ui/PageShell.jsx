import { forwardRef } from 'react';

/**
 * 模块根容器：填充 viewport，提供与主题一致的背景色与文字色。
 * 模块渲染时通常包一层 PageShell，再放具体内容；不要在模块内重复写 min-h-screen。
 */
export const PageShell = forwardRef(function PageShell(
  { className = '', children, ...rest },
  ref
) {
  return (
    <div
      ref={ref}
      className={`relative min-h-screen bg-bg text-ink ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
});
