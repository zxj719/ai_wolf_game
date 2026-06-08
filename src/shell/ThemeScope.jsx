import { forwardRef } from 'react';

/**
 * 主题作用域：给子树设置 [data-theme="light|dark"]，CSS 变量自动切换。
 *
 * 配合 src/styles/tokens.css 使用。Router 根据当前模块 descriptor.theme 字段
 * 自动包裹，子树内的 UI 原语（Button/Card/…）令牌类自动适配。
 *
 * 也可在模块内部手动用：需要在某个局部子树切换主题时包一层即可。
 *
 * 关键：`data-theme` 只切换 CSS 变量，并不会改变继承下来的 `color` 属性。
 * 当模块主题与文档 <html> 主题不一致时（典型：狼人杀模块标 dark，而全局默认
 * light/system→light），子树会拿到深色 surface 变量、却继承了浅色文档 body 的
 * `--mac-ink`（深色），导致未显式设色的文字深色字压深色卡、不可读。因此作用域根
 * 必须在自己的主题里**重新声明前景色**，让继承色随作用域主题解析。
 */
export const ThemeScope = forwardRef(function ThemeScope(
  { theme = 'light', className = '', children, style, ...rest },
  ref
) {
  return (
    <div
      ref={ref}
      data-theme={theme}
      className={className}
      style={{ color: 'var(--mac-ink)', ...style }}
      {...rest}
    >
      {children}
    </div>
  );
});
