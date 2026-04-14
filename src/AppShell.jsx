import App from './App.jsx';
import { ShellProvider } from './shell/ShellProvider';

/**
 * AppShell — 新的应用根。
 *
 * Phase 2b（当前）：仅在旧 <App /> 外面包一层 <ShellProvider>，让任何新代码
 * 调用 useShell() 即可拿到 locale/user/navigate/api 等跨模块能力；运行时行为
 * 与包裹前完全一致（Shell 的 currentPath/isGuestMode 暂时是未被读取的影子状态）。
 *
 * Phase 3：这里会改为直接渲染 <Router /> + <GlobalOverlays />，<App /> 与
 * useAppRouter 同期删除，狼人杀状态迁入 modules/werewolf/。
 */
export default function AppShell() {
  return (
    <ShellProvider>
      <App />
    </ShellProvider>
  );
}
