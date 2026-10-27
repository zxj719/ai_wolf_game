import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { actOnWorld, settleTurn, restoreWorld } from "./bridgeWorld";
import { buildNeighbors, computeNumbers } from "../minesweeper/mineEngine";
import { extendTrace, prepareConnection } from "./routeDrawing";
import {
  createConnectionLesson,
  LESSON_ROUTE,
  LESSON_SWEEPS,
} from "./connectionLesson";
import WorldMap from "./WorldMap";
import FieldGuide from "./FieldGuide";
import { StoryScene } from "./StoryScene";
import { LESSON_SCENES } from "./storyScript";
import ConnectionDemo from "./ConnectionDemo.jsx";
const COPY = [
  [
    "来，把这座桥接上。",
    "点绿色大本营 → 鼠标向右经过 1、2、2 → 在最后一格点一下，营地就建好了。",
  ],
  [
    "灯亮了。这里有人守着了。",
    "林渡还剩 11 点势力，桥头营地从 1 开始。接下来，看看补给怎么过桥。",
  ],
  [
    "别急，补给正在路上。",
    "打开左边的金色未知格，再看右边：带数字的补给前进了一格。照这样试四次。",
  ],
  [
    "把门关上，我们过去。",
    "点右边的绿色营地，移到紧邻的红色据点，再点一下派队。随后在左边清扫一格。",
  ],
];
const LABELS = ["看路", "铺桥", "落脚", "等补给", "守住中继站"];
const routePrefix = (path) => path.length > 0 && path.every((cell, i) => cell === LESSON_ROUTE[i]);
export function loadLessonProgress(storageKey, mode = "combined") {
  try {
    const s = JSON.parse(localStorage.getItem(storageKey));
    const world = s && restoreWorld(JSON.stringify(s.world));
    if (s?.version === 1 && world?.training && world.size === 7 && world.nodes[22]?.role === "lin" &&
      Number.isInteger(s.stage) && s.stage >= -1 && s.stage <= 4 &&
      (s.stage < 2 || world.nodes[25]) && (s.stage < 3 || world.nodes[26])) {
      if (mode === "defense") { world.revealed = world.mines.map((m) => m ? 0 : 1); world.flags = [...world.mines]; }
      return { world, stage: mode === "survey" ? -1 : mode === "defense" ? Math.max(0, s.stage) : s.stage, speaking: s.speaking !== false || s.stage === 4,
        line: Math.max(0, Math.min(LESSON_SCENES[s.stage + 1].lines.length - 1, Number.isInteger(s.line) ? s.line : 0)),
        trace: Array.isArray(s.trace) && s.trace.every((i) => Number.isInteger(i) && i >= 0 && i < 49)
          ? s.stage < 2 && !routePrefix(s.trace) ? [] : s.trace : [],
      };
    }
  } catch { /* A damaged rehearsal can be restarted without touching the campaign. */ }
  return { world: createConnectionLesson(mode), stage: mode === "defense" ? 0 : -1, speaking: true, line: 0, trace: [] };
}
export default function ConnectionPractice({ onClose, storageKey = "echoes-lesson-v1", mode = "combined" }) {
  const defense = mode === "defense", survey = mode === "survey";
  const [saved] = useState(() => loadLessonProgress(storageKey, mode));
  const copy = defense ? COPY.map((row, i) => i === 2 ? [row[0], "点一次「结束回合」，看看带数字的补给往前走一格。等它走到桥头。"] : i === 3 ? [row[0], "点绿色营地，划向旁边的红色据点并点一下。再结束回合，让队伍过桥。"] : row) : COPY;
  const dialog = useRef(null),
    lock = useRef(false),
    timer = useRef(null);
  const [w, setW] = useState(saved.world),
    [stage, setStage] = useState(saved.stage);
  const [speaking, setSpeaking] = useState(saved.speaking);
  const [line, setLine] = useState(saved.line);
  const [showDemo, setShowDemo] = useState(false);
  const [trace, setTrace] = useState(saved.trace),
    [hint, setHint] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current.showModal();
    dialog.current.querySelector(".story-continue")?.focus();
    return () => { clearTimeout(timer.current); document.body.style.overflow = overflow; };
  }, []);
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify({ version: 1, world: w, stage, speaking, line, trace })); }
    catch { /* Rehearsal remains playable with browser storage disabled. */ }
  }, [storageKey, w, stage, speaking, line, trace]);
  useEffect(() => {
    if (!speaking && !showDemo) dialog.current.querySelector(".practice-work h2")?.focus();
  }, [speaking, showDemo]);
  const finish = () => {
    try { localStorage.removeItem(storageKey); } catch {}
    onClose(true);
  };
  const nums = Array.from(computeNumbers(w.mines, buildNeighbors(7, 7)));
  const plan = prepareConnection(w, trace);
  const routed =
    trace.length === LESSON_ROUTE.length &&
    trace.every((v, i) => v === LESSON_ROUTE[i]);
  const sent = w.packets.some((p) => p.kind === "attack");
  const won = w.nodes[26]?.owner === "player";
  const ready =
    stage === 0
      ? false
      : stage === 1
        ? !!w.nodes[25]
        : stage === 2
          ? w.turn >= 4
          : won;
  const sweep = LESSON_SWEEPS[w.turn];
  const maySweep = !busy && ((stage === 2 && !ready) || (stage === 3 && sent));
  const restart = () => {
    clearTimeout(timer.current);
    lock.current = false;
    setBusy(false);
    setW(createConnectionLesson(mode));
    setStage(defense ? 0 : -1);
    setSpeaking(true);
    setLine(0);
    setTrace([]);
    setHint("");
    setShowDemo(false);
  };
  const click = (i) => {
    if (busy || stage === 2 || sent || won || (stage === 1 && ready)) return;
    if (stage === 0 || stage === 1) {
      if (i === 22) {
        setTrace([22]);
        setHint("选中了。鼠标向右移动，经过金色框里的 1、2、2。");
        return;
      }
      if (!trace.length) {
        setHint("先点击绿色的林渡大本营，选中它再画路线。");
        return;
      }
    }
    if (stage === 3 && i === 25) {
      setTrace([25]);
      setHint("划向紧邻的红色据点，先看进攻预估。");
      return;
    }
    const target = stage <= 1 ? 25 : 26;
    if (i !== target) {
      setHint(stage <= 1 ? "继续向右经过 1、2、2，在最后一个 2 上点一下。" : "点击营地右边的红色据点派队。");
      return;
    }
    const start = stage <= 1 && !routePrefix(trace) ? [22] : trace;
    const path = extendTrace(w, start, i),
      p = prepareConnection(w, path);
    if (path.at(-1) !== i || !p.valid) {
      setHint(p.reason);
      return;
    }
    setW(p.world);
    setTrace([]);
    setHint(p.world.notice.text);
    if (stage <= 1) setStage(1);
  };
  const advance = (i) => {
    if (!maySweep || lock.current) return;
    if (!defense && i !== sweep) {
      setHint("先打开金色框中的未知格，观察这一回合的补给。");
      return;
    }
    lock.current = true;
    setBusy(true);
    const next = defense ? settleTurn(w) : actOnWorld(w, "open", i, "lin");
    const delivery = next.deliveries.find(
      (p) => p.to === 25 && p.kind === "supply",
    );
    setW(next);
    setHint(
      stage === 3
        ? "门口安全了。派出的 5 点势力抵消敌方 3 点，还剩 2 点留守。"
        : delivery
          ? `第 ${next.turn} 回合：一份补给到了！营地自然长了 1，又收到 1。`
          : `第 ${next.turn} 回合：补给走过 ${next.turn} / 3 格，还在路上。营地自己长了 1。`,
    );
    timer.current = setTimeout(() => {
      lock.current = false;
      setBusy(false);
    }, 700);
  };
  const next = () => {
    if (!ready || busy) return;
    if (stage === 3) {
      setStage(4);
      setLine(0);
      setSpeaking(true);
      return;
    }
    if (stage === 2)
      setW((old) => ({
        ...old,
        nodes: {
          ...old.nodes,
          26: { owner: "enemy", kind: "raider", name: "灰帆侦察队", power: 2 },
        },
      }));
    setStage(stage + 1);
    setSpeaking(true);
    setLine(0);
    setHint("");
    if (stage !== 0) setTrace([]);
  };
  const feedback =
    stage < 0 || stage > 3 ? "" : stage <= 1 && routed && !w.nodes[25]
      ? "现在点击路线尽头的金色格子（最后一个 2），建立营地。"
      : stage === 1 && ready
        ? "桥头的灯亮了。林渡还剩 11 点势力，新营地有了第 1 点。"
        : stage === 2 && ready
          ? "两份补给已经到了。营地从 1 长到 7：自己增长了 4，又收到 2。"
          : won
            ? "红色据点变绿了。中继站安全了，岑灯正在电台里叫你。"
            : sent
              ? defense ? "队伍已出发。点「结束回合」，等他们过桥。" : "连接队已出发。点击左侧金色格推进一回合；阅读和观察不会推进时间。"
              : hint || (stage === 3 && trace.length > 1
                ? plan.reason
                :
                  (stage === 2
                    ? defense ? "点「结束回合」，观察桥上的第一份补给。" : "点击左侧第一个金色未知格，开始观察运输。"
                    : copy[stage <= 1 ? 0 : stage][1]));
  const lessonScene = defense && stage === 2 ? { ...LESSON_SCENES[3], finish: "看看桥上的补给", lines: [
    { speaker: "cen", text: "桥修好了。电池到了吗？" },
    { speaker: "lin", text: "刚送出去。路得一段一段走，我们等他们过桥。" },
  ] } : LESSON_SCENES[stage + 1];
  return (
    <dialog
      ref={dialog}
      className="connection-practice narrative-practice"
      aria-label="断桥的另一端 · 剧情教学"
      onCancel={(e) => {
        e.preventDefault();
        onClose(false);
      }}
    >
      {showDemo ? <ConnectionDemo mode={mode} onClose={() => setShowDemo(false)} /> : speaking ? <StoryScene
        key={stage}
        scene={lessonScene}
        index={line}
        onLine={setLine}
        mode="lesson"
        onDismiss={() => onClose(false)}
        onFinish={() => { if (stage === 4) finish(); else { setSpeaking(false); if (stage === 0) setShowDemo(true); } }}
      /> : <div className="practice-work" data-threat={stage === 3 && !won ? "hostile" : "quiet"}>
      <header>
        <span>序章演练 · 不改动远征存档</span>
        <div>
          <button onClick={restart}>重新练习</button>
          <button onClick={() => { setLine(0); setSpeaking(true); }}>再听一遍</button>
          <button onClick={() => onClose(false)}>回到远征</button>
        </div>
      </header>
      <ol className="practice-steps">
        {LABELS.map((label, i) => (survey && i > 0) || (defense && i === 0) ? null : (
          <li
            key={label}
            aria-current={stage + 1 === i ? "step" : undefined}
            className={i < stage + 1 ? "complete" : ""}
          >
            {i < stage + 1 ? "✓" : i + 1} {label}
          </li>
        ))}
      </ol>
      {stage === -1 ? <FieldGuide completeLabel={survey ? "回到我的地图" : "去铺第一段桥"} onComplete={() => {
        if (survey) finish(); else { setStage(0); setLine(0); setSpeaking(true); }
      }} /> : <>
      <div className="practice-prompt">
        <div className="practice-portrait" aria-hidden="true" />
        <div><span>林渡 · 在你身旁</span><h2 id="practice-title" tabIndex={-1}>{copy[stage === 1 && !ready ? 0 : stage][0]}</h2><p>{copy[stage === 1 && !ready ? 0 : stage][1]}</p></div>
      </div>
      <button className="practice-watch" onClick={() => setShowDemo(true)}><Play size={15} />看完整动画演示 · 可暂停</button>
      {stage <= 1 && !ready && <ol className="practice-mini-steps" aria-label="建桥操作">
        {["① 点击绿色大本营", "② 向右划过 1、2、2", "③ 点击终点驻扎"].map((text, i) => {
          const current = !trace.length ? 0 : routed ? 2 : 1;
          return <li key={text} aria-current={i === current ? "step" : undefined} className={i < current ? "complete" : ""}>{text}</li>;
        })}
      </ol>}
      <div className="practice-boards" data-placing={stage <= 1 && routed && !ready ? "true" : undefined}>
        {!defense && stage >= 2 && (
          <section className={!maySweep ? "practice-inactive" : ""}>
            <h3>清扫 · 决定回合</h3>
            <WorldMap
              game={w}
              nums={nums}
              onCell={advance}
              onFlag={() =>
                setHint("本次练习先打开高亮格；正式探索中标记也会推进回合。")
              }
              disabled={!maySweep}
              guide={maySweep ? [sweep] : []}
            />
            <small>
              {sent
                ? "队伍等待你的下一次清扫"
                : stage === 3
                  ? "先在右侧派队"
                  : "只操作金色框中的未知格"}
            </small>
          </section>
        )}
        <section>
          <h3>连接 · {stage === 2 ? "观察每一份补给" : "描绘你的路线"}</h3>
          <WorldMap
            tactical
            game={w}
            nums={nums}
            selected={trace[0]}
            trace={trace}
            guide={
              stage === 0
                ? LESSON_ROUTE
                : stage === 1
                  ? [25]
                  : stage === 3 && !won
                    ? [25, 26]
                    : [23, 24, 25]
            }
            onCell={click}
            onHover={(i) => {
              if (busy || sent || won || ready) return;
              if (stage <= 1 && trace.length && LESSON_ROUTE.includes(i)) {
                setTrace(LESSON_ROUTE.slice(0, LESSON_ROUTE.indexOf(i) + 1));
                setHint("");
              } else if (stage === 3) {
                setTrace((p) => extendTrace(w, p, i));
                setHint("");
              }
            }}
          />
          <small>{stage <= 1 && !ready ? "本次先沿金色格画直线；正式探索可以自由选路线。" : "白点沿桥流动；带数字的圆点是一份正在运输的势力。"}</small>
        </section>
      </div>
      <div className="practice-feedback" role="status">
        {feedback}
      </div>
      {defense && stage >= 2 && <div className="journey-defense-turn"><span>回合由你推进，阅读和画路线时暂停。</span><button className="echo-primary" disabled={!maySweep} onClick={() => advance(sweep)}>结束回合</button></div>}
      <footer>
        <span>
          回合 {w.turn} · 大本营 {w.nodes[22].power} · 营地{" "}
          {w.nodes[25]?.power ?? 0} · 在途{" "}
          {w.packets.filter((p) => p.kind === "supply").length}
        </span>
        <button
          className="echo-primary"
          disabled={!ready || busy}
          onClick={next}
        >
          {stage === 3 ? "接听岑灯的呼叫" : stage <= 1 ? ready ? "看补给怎么过桥 →" : "先在棋盘上建好营地" : "接下来呢 →"}
        </button>
      </footer>
      </>}
      </div>}
    </dialog>
  );
}
