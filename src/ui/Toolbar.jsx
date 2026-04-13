import { forwardRef } from 'react';

/**
 * 浮动工具条：固定在视口右上角，承载语言切换、用户菜单、通知等全局动作。
 * 替代 .mac-floating-toolbar，但允许模块自定义位置（通过 className 覆盖）。
 */
export const Toolbar = forwardRef(function Toolbar(
  { className = '', children, ...rest },
  ref
) {
  return (
    <div
      ref={ref}
      className={`fixed right-4 top-4 z-[70] flex items-center gap-3 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
});
