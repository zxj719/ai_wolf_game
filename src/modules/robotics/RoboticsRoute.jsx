import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { useShell } from '../../shell/ShellContext';
import { ThemeScope } from '../../shell/ThemeScope';
import { ROUTES } from '../../shell/paths';

/**
 * 讲义入口。静态文件由 public/robotics/ 提供，Worker 对带扩展名的路径
 * 直接走 env.ASSETS（workers/auth/index.js 的 hasExtension 分支），
 * 因此 /robotics（SPA 路由）和 /robotics/*.html（静态资产）互不冲突。
 */
const TUTORIAL_ENTRY = '/robotics/day0.html';

/** 讲义当前是明是暗：优先它自己写在 <html> 上的手动选择，否则跟随系统。 */
function readFrameTheme(doc, win) {
  const explicit = doc.documentElement.getAttribute('data-theme');
  if (explicit === 'light' || explicit === 'dark') return explicit;
  return win.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function RoboticsRoute() {
  const { navigate } = useShell();
  const frameRef = useRef(null);
  const [frameTheme, setFrameTheme] = useState('light');

  const onBack = useCallback(() => navigate(ROUTES.HOME), [navigate]);

  /**
   * 把讲义的明暗同步到外层 <html data-theme>。
   *
   * 必须做这件事的原因：styles/base.css 里那两个装饰光晕挂在
   * `html:not([data-theme="dark"]) body::before/after` 上。iframe 里的深色
   * 只写在 iframe 自己的 documentElement 上，外层文档一无所知，于是讲义已经
   * 变黑、外层却仍按浅色画出两团光晕。同源才读得到 contentDocument。
   */
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;

    const root = document.documentElement;
    const previous = root.getAttribute('data-theme'); // null = 跟随系统/模块默认
    let applied = null;
    let observer = null;
    let media = null;

    const sync = () => {
      const doc = frame.contentDocument;
      const win = frame.contentWindow;
      if (!doc || !win) return;
      const theme = readFrameTheme(doc, win);
      applied = theme;
      root.setAttribute('data-theme', theme);
      setFrameTheme(theme);
    };

    // 讲义换页（侧栏 Day 0 → Day 1）会重建 contentDocument，监听器要重新挂
    const attach = () => {
      const doc = frame.contentDocument;
      const win = frame.contentWindow;
      if (!doc || !win) return;

      observer?.disconnect();
      observer = new MutationObserver(sync);
      observer.observe(doc.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme'],
      });

      media?.removeEventListener?.('change', sync);
      media = win.matchMedia?.('(prefers-color-scheme: dark)') ?? null;
      media?.addEventListener?.('change', sync);

      sync();
    };

    frame.addEventListener('load', attach);
    attach(); // 挂载时 iframe 可能已经 load 完，load 事件不会再来

    return () => {
      frame.removeEventListener('load', attach);
      observer?.disconnect();
      media?.removeEventListener?.('change', sync);
      // 只回滚我们自己写进去的值：期间用户若用外层主题开关手动改过，别覆盖他
      if (root.getAttribute('data-theme') !== applied) return;
      if (previous === null) root.removeAttribute('data-theme');
      else root.setAttribute('data-theme', previous);
    };
  }, []);

  return (
    <ThemeScope theme={frameTheme} className="flex h-[100dvh] flex-col bg-bg">
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
        ref={frameRef}
        src={TUTORIAL_ENTRY}
        title="ROS2 入门讲义"
        className="min-h-0 flex-1 w-full border-0"
      />
    </ThemeScope>
  );
}
