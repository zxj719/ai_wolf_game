import { forwardRef } from 'react';

/**
 * 主题作用域：给子树设置 [data-theme="light|dark"]，CSS 变量自动切换。
 *
 * 配合 src/styles/tokens.css 使用。Router 根据当前模块 descriptor.theme 字段
 * 自动包裹，子树内的 UI 原语（Button/Card/…）令牌类自动适配。
 *
 * 也可在模块内部手动用：需要在某个局部子树切换主题时包一层即可。
 */
export const ThemeScope = forwardRef(function ThemeScope(
  { theme = 'light', className = '', children, ...rest },
  ref
) {
  return (
    <div ref={ref} data-theme={theme} className={className} {...rest}>
      {children}
    </div>
  );
});
