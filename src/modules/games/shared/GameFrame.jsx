import { ArrowLeft } from 'lucide-react';
import { useShell } from '../../../shell/ShellContext';
import { ROUTES } from '../../../shell/paths';

/** 小游戏页面外框：与数独页一致的 mac 窗口 + 返回小游戏按钮 */
export default function GameFrame({ eyebrow, title, status, children }) {
  const { navigate } = useShell();
  return (
    <div className="px-4 py-10 md:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mac-window overflow-hidden">
          <div className="mac-toolbar">
            <div className="flex items-center gap-4">
              <div className="mac-window-chrome">
                <span className="mac-window-dot mac-dot-red" />
                <span className="mac-window-dot mac-dot-yellow" />
                <span className="mac-window-dot mac-dot-green" />
              </div>
              <div>
                <div className="mac-eyebrow">{eyebrow}</div>
                <h1 className="text-base font-semibold text-ink">{title}</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {status}
              <button type="button" onClick={() => navigate(ROUTES.GAMES)} className="mac-button mac-button-secondary">
                <ArrowLeft size={15} />
                返回小游戏
              </button>
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
