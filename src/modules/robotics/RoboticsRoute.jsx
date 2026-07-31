import { useCallback } from 'react';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { useShell } from '../../shell/ShellContext';
import { ROUTES } from '../../shell/paths';

/**
 * 讲义入口。静态文件由 public/robotics/ 提供，Worker 对带扩展名的路径
 * 直接走 env.ASSETS（workers/auth/index.js 的 hasExtension 分支），
 * 因此 /robotics（SPA 路由）和 /robotics/*.html（静态资产）互不冲突。
 */
const TUTORIAL_ENTRY = '/robotics/day0.html';

export default function RoboticsRoute() {
  const { navigate } = useShell();

  const onBack = useCallback(() => navigate(ROUTES.HOME), [navigate]);

  return (
    <div className="flex h-[100dvh] flex-col bg-bg">
      <header className="flex items-center gap-3 border-b border-line px-4 py-2.5">
        <button
          type="button"
          onClick={onBack}
          className="mac-button mac-button-secondary !h-9 !px-3"
        >
          <ArrowLeft size={15} />
          返回主页
        </button>

        <div className="min-w-0">
          <div className="mac-eyebrow">Robotics</div>
          <h1 className="truncate text-sm font-semibold text-ink">机器人学习 · ROS2 入门</h1>
        </div>

        <a
          href={TUTORIAL_ENTRY}
          target="_blank"
          rel="noreferrer"
          className="mac-button mac-button-secondary !h-9 !px-3 ml-auto"
        >
          <ExternalLink size={15} />
          新标签打开
        </a>
      </header>

      {/* 讲义自带明暗主题与侧边栏导航，整页嵌入即可，无需改动原文件 */}
      <iframe
        src={TUTORIAL_ENTRY}
        title="ROS2 入门讲义"
        className="min-h-0 flex-1 w-full border-0"
      />
    </div>
  );
}
