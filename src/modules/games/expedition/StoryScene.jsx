import { useEffect, useRef, useState } from "react";
import { ArrowRight, BookOpen, Pause, X } from "lucide-react";
import { VOICES } from "./storyScript";
import "./story.css";

const reduceMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function StoryScene({ scene, index = 0, onLine, onFinish, onDismiss, secondary, mode = "story" }) {
  const [instant, setInstant] = useState(() => {
    try { return reduceMotion() || localStorage.getItem("echoes-dialogue-instant") === "yes"; }
    catch { return reduceMotion(); }
  });
  const [shown, setShown] = useState(0);
  const [history, setHistory] = useState(false);
  const finished = useRef(false);
  const entry = scene.lines[index] || scene.lines[0];
  const voice = entry.speaker === "narrator"
    ? { ...VOICES.narrator, name: "旁白", detail: scene.location }
    : VOICES[entry.speaker] || VOICES.narrator;
  const complete = instant || shown >= entry.text.length;
  const last = index === scene.lines.length - 1;
  useEffect(() => {
    try { localStorage.setItem("echoes-dialogue-instant", instant ? "yes" : "no"); } catch {}
  }, [instant]);
  useEffect(() => {
    setShown(0);
    if (instant) return;
    let count = 0;
    const timer = setInterval(() => {
      count++;
      setShown((n) => Math.min(entry.text.length, n + 1));
      if (count >= entry.text.length) clearInterval(timer);
    }, 32);
    return () => clearInterval(timer);
  }, [entry.text, instant]);
  const finishOnce = (callback) => {
    if (finished.current) return;
    finished.current = true;
    callback();
  };
  const advance = () => {
    if (!complete) { setShown(entry.text.length); return; }
    if (last) finishOnce(onFinish); else onLine(index + 1);
  };
  return (
    <section className={`echo-story-scene voice-${entry.speaker}`} aria-label={scene.title}>
      <img className="story-art" src="/images/echoes/relay-platform.png" alt="旧站台上，林渡拿着桥索，望向桥另一端亮着灯的中继站。" />
      <div className="story-vignette" aria-hidden="true" />
      <header className="story-toolbar">
        <span><Pause size={12} />{mode === "lesson" ? "序章演练 · 远征已暂停" : "剧情中 · 棋盘已暂停"}</span>
        {onDismiss && <button onClick={onDismiss} aria-label="稍后继续这段对话"><X size={17} /><span>稍后</span></button>}
      </header>
      <div className="story-chapter">
        <span>{scene.chapter}</span>
        <h2>{scene.title}</h2>
        <p>{scene.location}</p>
        <div className="story-frequency" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /><span>09.17 MHz</span></div>
      </div>
      <div className="story-dialogue" style={{ "--voice": voice.color }}>
        {history ? (
          <div className="story-backlog" tabIndex={0} aria-label="已读对话">
            <h3>刚才的对话</h3>
            {scene.lines.slice(0, index + 1).map((l, i) => <p key={i}><b>{VOICES[l.speaker]?.name}</b>{l.text}</p>)}
          </div>
        ) : (
          <>
            <div className="story-speaker"><strong>{voice.name}</strong><span>{voice.detail}</span></div>
            <button className={`story-text ${entry.speaker === "narrator" ? "narration" : ""}`} onClick={advance} aria-label="继续对话">
              <span aria-hidden="true">{entry.text.slice(0, instant ? entry.text.length : shown)}<i className={complete ? "story-caret ready" : "story-caret"} /></span>
            </button>
            <p className="story-sr" aria-live="polite" aria-atomic="true">{voice.name}：{entry.text}</p>
            {last && complete && scene.tip && <p className="story-rule"><span>回到地图后</span>{scene.tip}</p>}
          </>
        )}
        <footer className="story-controls">
          <div className="story-reading-controls">
            <button aria-pressed={history} onClick={() => setHistory((v) => !v)}><BookOpen size={14} />{history ? "返回对话" : "回看"}</button>
            <button aria-pressed={instant} onClick={() => setInstant((v) => !v)}>{instant ? "即时文字" : "逐字文字"}</button>
            <span>{String(index + 1).padStart(2, "0")} / {String(scene.lines.length).padStart(2, "0")}</span>
          </div>
          {!history && <div className="story-forward-controls">
            {last && complete && secondary && <button className="story-secondary" onClick={() => finishOnce(secondary.onClick)}>{secondary.label}</button>}
            <button className="story-continue" onClick={advance} autoFocus>{!complete ? "显示整句" : last ? scene.finish : entry.next || "继续"}<ArrowRight size={16} /></button>
          </div>}
        </footer>
      </div>
    </section>
  );
}

export default function StoryDialog(props) {
  const ref = useRef(null);
  const [localIndex, setLocalIndex] = useState(0);
  useEffect(() => {
    const d = ref.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (!d.open) d.showModal();
    d.querySelector(".story-continue")?.focus();
    return () => { if (d.open) d.close(); document.body.style.overflow = overflow; };
  }, []);
  return <dialog ref={ref} className="echo-story-modal" aria-label={props.scene.title} onCancel={(e) => {
    e.preventDefault(); props.onDismiss?.();
  }}>
    <StoryScene {...props} index={props.index ?? localIndex} onLine={props.onLine || setLocalIndex} />
  </dialog>;
}
