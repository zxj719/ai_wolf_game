import { useEffect, useMemo, useRef, useState } from "react";
import { MousePointer2, Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import { buildNeighbors, computeNumbers } from "../minesweeper/mineEngine";
import { createConnectionDemo } from "./connectionDemoSequence";
import WorldMap from "./WorldMap";
import "./connectionDemo.css";

const CHAPTERS = ["画桥与驻扎", "逐格运输", "补给抵达", "击退入侵者"];
function DemoMap({ frame, board, nums }) {
  const pointer = frame.pointer?.board === board ? frame.pointer : null;
  return <section className={`demo-board ${pointer ? "is-active" : ""}`}>
    <h3>{board === "survey" ? "清扫 · 推进回合" : "连接 · 建桥与调动势力"}</h3>
    <div className="demo-map">
      <WorldMap game={frame.world} nums={nums} tactical={board === "connection"} disabled
        trace={board === "connection" ? frame.trace : []} selected={frame.trace[0]}
        guide={board === "survey" ? frame.surveyGuide || [] : frame.highlight || frame.trace} />
      {pointer && <div className={`demo-cursor ${pointer.click ? "is-clicking" : ""}`} aria-hidden="true"
        style={{ left: `${((pointer.cell % 7 + .5) / 7) * 100}%`, top: `${((Math.floor(pointer.cell / 7) + .5) / 7) * 100}%` }}>
        <i key={`${frame.title}-${pointer.cell}`} /><MousePointer2 size={26} fill="currentColor" />
      </div>}
    </div>
    <p>{board === "survey" ? `第 ${frame.world.turn} 回合` : frame.gain ? `这条路线预计获得 +${frame.gain} 势力` : `林渡 ${frame.world.nodes[22].power}　·　桥头营地 ${frame.world.nodes[25]?.power ?? "尚未建立"}`}</p>
  </section>;
}

export default function ConnectionDemo({ onClose, mode = "combined" }) {
  const frames = useMemo(() => createConnectionDemo(mode), [mode]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(() => !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  const heading = useRef(null);
  const frame = frames[index];
  const nums = useMemo(() => Array.from(computeNumbers(frames[0].world.mines, buildNeighbors(7, 7))), [frames]);
  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => {
    if (!playing || frame.complete) return;
    const timer = setTimeout(() => setIndex((i) => i + 1), frame.duration);
    return () => clearTimeout(timer);
  }, [playing, frame]);
  const previous = () => { setPlaying(false); setIndex((i) => Math.max(i - 1, 0)); };
  const next = () => { setPlaying(false); setIndex((i) => Math.min(i + 1, frames.length - 1)); };
  return <div className="connection-demo" role="region" aria-label="建桥、补给与进攻动画演示">
    <header><span>林渡的示范 · 约 45 秒</span><button onClick={onClose}>返回我的练习</button></header>
    <nav aria-label="演示章节">{CHAPTERS.map((title, chapter) => <button key={title}
      aria-current={frame.chapter === chapter ? "step" : undefined}
      onClick={() => { setIndex(frames.findIndex((f) => f.chapter === chapter)); setPlaying(false); }}>
      <small>0{chapter + 1}</small>{title}</button>)}</nav>
    <div className="demo-caption" role="status"><h2 ref={heading} tabIndex={-1}>{frame.title}</h2><p>{frame.detail}</p></div>
    <div className={`demo-boards ${frame.dual ? "dual" : ""}`}>
      {frame.dual && <DemoMap frame={frame} board="survey" nums={nums} />}
      <DemoMap frame={frame} board="connection" nums={nums} />
    </div>
    {mode === "defense" && <div className={`journey-step-demo ${frame.pointer?.board === "control" ? "is-active" : ""}`}><span>第 {frame.world.turn} 回合</span><button disabled>结束回合</button></div>}
    <footer>
      <div className="demo-controls">
        <button onClick={previous} disabled={index === 0}><SkipBack size={16} />上一步</button>
        <button aria-label={playing && !frame.complete ? "暂停演示" : "播放演示"} onClick={() => { if (frame.complete) setIndex(0); setPlaying(!playing || frame.complete); }}>
          {playing && !frame.complete ? <Pause size={16} /> : <Play size={16} />}{playing && !frame.complete ? "暂停" : "播放"}
        </button>
        <button onClick={next} disabled={frame.complete}><SkipForward size={16} />下一步</button>
        <button onClick={() => { setIndex(0); setPlaying(true); }}><RotateCcw size={15} />重播</button>
      </div>
      <span className="demo-progress">{String(index + 1).padStart(2, "0")} / {frames.length}</span>
      <button className="echo-primary" onClick={onClose}>我来试试 →</button>
    </footer>
  </div>;
}
