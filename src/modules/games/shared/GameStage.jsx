import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, Play, Trophy, X } from 'lucide-react';
import { useShell } from '../../../shell/ShellContext';
import { ROUTES } from '../../../shell/paths';
import { useElementSize } from './useElementSize';
import { haptic } from './haptics';
import './stage.css';

/**
 * 小游戏全屏舞台：玻璃顶栏 + 控件行 + 自适应舞台 + 悬浮 dock + 排行榜 sheet。
 *
 * children 是 render prop：({ width, height }) => 棋盘，尺寸为舞台可用内容区，
 * 棋盘据此自行缩放以占满页面。
 */
export default function GameStage({
  title,
  controls,
  dock,
  message,
  scroll = false,
  sheet,          // { open, onClose, title, content }
  onOpenSheet,
  overlay,        // 结算弹窗等
  paused = false, // 暂停：盖住棋盘（不能边停表边想），dock 保持可用
  onResume,
  children,
}) {
  const { navigate } = useShell();
  const rootRef = useRef(null);
  const [theme, setTheme] = useState('light');
  const [stageRef, size] = useElementSize();

  // 取最近的 [data-theme]（ThemeScope），而不是用 CSS 祖先选择器
  useLayoutEffect(() => {
    const scope = rootRef.current?.parentElement?.closest('[data-theme]');
    setTheme(scope?.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
  });

  return (
    <div ref={rootRef} className="gs" data-gs-theme={theme} onTouchStart={() => {}}>
      <header className="gs-bar">
        <button type="button" className="gs-back gs-press" onClick={() => { haptic(); navigate(ROUTES.GAMES); }}>
          <ChevronLeft size={24} strokeWidth={2.2} />
          小游戏
        </button>
        <div className="gs-title">{title}</div>
        <div className="gs-bar-right">
          {onOpenSheet && (
            <button type="button" className="gs-icon-btn gs-press" onClick={() => { haptic(); onOpenSheet(); }} aria-label="排行榜">
              <Trophy size={20} />
            </button>
          )}
        </div>
      </header>

      {controls && <div className="gs-controls">{controls}</div>}

      <div ref={stageRef} className={`gs-stage${scroll ? ' is-scroll' : ''}`}>
        {size.width > 0 && children(size)}
        {paused && (
          <div className="gs-pause" role="dialog" aria-label="已暂停">
            <div className="gs-pause-card">
              <div className="gs-pause-title">已暂停</div>
              <p>计时已停止，棋盘已隐藏</p>
              <button type="button" className="gs-btn gs-btn-primary gs-press" onClick={() => { haptic(); onResume?.(); }}>
                <Play size={16} /> 继续
              </button>
            </div>
          </div>
        )}
      </div>

      {message?.text && (
        <div key={message.text} className={`gs-message${message.tone ? ` is-${message.tone}` : ''}`}>
          {message.text}
        </div>
      )}

      {dock && <nav className="gs-dock">{dock}</nav>}

      {sheet?.open && (
        <>
          <div className="gs-scrim" onClick={sheet.onClose} />
          <aside className="gs-sheet" role="dialog" aria-label={sheet.title}>
            <div className="gs-sheet-head">
              <h2>{sheet.title}</h2>
              <button type="button" className="gs-close gs-press" onClick={sheet.onClose} aria-label="关闭">
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>
            <div className="gs-sheet-body">{sheet.content}</div>
          </aside>
        </>
      )}

      {overlay}
    </div>
  );
}

/** 切到后台（换标签页、锁屏）时自动暂停 */
export function useAutoPause(active, pause) {
  const pauseRef = useRef(pause);
  pauseRef.current = pause;
  useEffect(() => {
    if (!active) return undefined;
    const onVis = () => { if (document.hidden) pauseRef.current(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [active]);
}

/** 底部 dock 按钮 */
export function DockButton({ icon: Icon, label, onClick, disabled, on, title }) {
  return (
    <button
      type="button"
      className={`gs-dock-btn gs-press${on ? ' is-on' : ''}`}
      onClick={() => { haptic(); onClick(); }}
      disabled={disabled}
      title={title}
      aria-pressed={on}
    >
      <Icon size={20} strokeWidth={2} />
      {label}
    </button>
  );
}

/** iOS 分段控件：滑块按选中项的实际位置弹簧滑动 */
export function Segmented({ options, value, onChange }) {
  const btnRefs = useRef({});
  const [thumb, setThumb] = useState(null);

  useLayoutEffect(() => {
    const el = btnRefs.current[value];
    if (el) setThumb({ left: el.offsetLeft, width: el.offsetWidth });
  }, [value, options]);

  return (
    <div className="gs-seg" role="tablist">
      {thumb && <span className="gs-seg-thumb" style={thumb} />}
      {options.map((o) => (
        <button
          key={o.value}
          ref={(el) => { btnRefs.current[o.value] = el; }}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          className={`gs-seg-btn${o.value === value ? ' is-active' : ''}`}
          onClick={() => { if (o.value !== value) { haptic(); onChange(o.value); } }}
        >
          {o.label}
          {o.hint && <small>{o.hint}</small>}
        </button>
      ))}
    </div>
  );
}

/** 通关弹窗 */
export function WinDialog({ emoji = '🎉', title, timeText, detail, onAgain, onBoard }) {
  return (
    <div className="gs-dialog-wrap">
      <div className="gs-dialog" role="dialog" aria-label={title}>
        <div className="gs-dialog-emoji">{emoji}</div>
        <h3>{title}</h3>
        {timeText && <div className="gs-dialog-time">{timeText}</div>}
        <p>{detail}</p>
        <div className="gs-dialog-actions">
          <button type="button" className="gs-btn gs-btn-primary gs-press" onClick={() => { haptic(); onAgain(); }}>再来一局</button>
          {onBoard && (
            <button type="button" className="gs-btn gs-btn-tinted gs-press" onClick={() => { haptic(); onBoard(); }}>查看排行榜</button>
          )}
        </div>
      </div>
    </div>
  );
}
