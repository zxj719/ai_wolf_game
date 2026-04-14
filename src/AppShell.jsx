import { ShellProvider } from './shell/ShellProvider';
import { Router } from './shell/Router';
import { GlobalOverlays } from './shell/GlobalOverlays';

/**
 * AppShell — 应用根。
 *
 * Phase 3b 起：ShellProvider 汇拢跨模块能力；Router 按 ModuleRegistry 驱动
 * 路由；GlobalOverlays 渲染跨模块浮层（当前仅 LanguageToggle）。所有业务
 * 逻辑都在各自的 modules/<name>/ 内部，AppShell 对任何模块都一无所知。
 */
export default function AppShell() {
  return (
    <ShellProvider>
      <Router />
      <GlobalOverlays />
    </ShellProvider>
  );
}
