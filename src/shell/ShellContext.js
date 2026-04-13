import { createContext, useContext } from 'react';

/**
 * ShellContext — 模块可用的全局能力注入点。
 *
 * 模块组件用 useShell() 拿到：
 *   - locale, setLocale    语言与切换
 *   - user, isGuestMode    认证状态
 *   - navigate(path, opts) 路由跳转
 *   - openTokenManager() / openStats() / closeTokenManager() / closeStats()
 *   - api(backendKey)      获取一个已注入 auth token 的 fetch 客户端
 *   - currentPath          当前归一化路径
 *
 * 默认值 null 用于检测"模块被渲染在 ShellProvider 外"的误用。
 */
export const ShellContext = createContext(null);

export function useShell() {
  const ctx = useContext(ShellContext);
  if (!ctx) {
    throw new Error(
      'useShell() must be called inside <ShellProvider>. Did you render a module component outside AppShell?'
    );
  }
  return ctx;
}
