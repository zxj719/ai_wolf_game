import { useState } from "react";
import { ArrowRight, RotateCcw } from "lucide-react";
import Minefield from "./Minefield";

const STEPS = [
  ["先看周围八格", "中心的 1 表示：框里的八个相邻格，一共藏着一颗雷。"],
  ["左键，打开安全格", "林渡确认过左下角是安全的。点亮着框的那一格，试试看。"],
  [
    "右键，标记地雷",
    "现在只剩右上角没打开，那颗雷只能在这里。对它点右键，留一面旗。手机可以用下方的标记按钮。",
  ],
  [
    "再点数字，一次展开",
    "换一张练习图：雷的位置已经插好旗。点中心的 1，周围剩下的安全格会一起打开。",
  ],
  [
    "会看路了",
    "就这三件事：开格、标雷、点数字展开。旗是你自己的判断，插错了仍会触雷；拿不准时，再看一眼九宫格。",
  ],
];
export default function FieldGuide({ onComplete, completeLabel = "开始探索" }) {
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState("");
  const [flagMode, setFlagMode] = useState(false);
  const [done, setDone] = useState(false);
  const revealed =
    step < 2
      ? [1, 1, 0, 1, 1, 1, done ? 1 : 0, 1, 1]
      : step === 2
        ? [1, 1, 0, 1, 1, 1, 1, 1, 1]
        : step === 3 && !done
          ? [0, 0, 0, 0, 1, 0, 0, 0, 0]
          : [1, 1, 0, 1, 1, 1, 1, 1, 1];
  const flags = [0, 0, step >= 3 || (step === 2 && done) ? 1 : 0, 0, 0, 0, 0, 0, 0];
  const advance = () => {
    setStep((s) => s + 1);
    setMessage("");
    setFlagMode(false);
    setDone(false);
  };
  const act = (i, flag) => {
    if (done) return;
    if (
      (step === 1 && i === 6 && !flag) ||
      (step === 2 && i === 2 && flag) ||
      (step === 3 && i === 4 && !flag)
    )
      { setDone(true); setMessage(step === 1 ? "安全。现在看看那颗雷藏在哪里。" : step === 2 ? "标好了。旗会提醒你别走这里。" : "一整圈都打开了。"); }
    else
      setMessage(
        step === 0
          ? "先看中心数字，再继续。"
          : step === 4
            ? "已掌握，开始探索吧。"
            : "试试发光的那一格，按提示操作。",
      );
  };
  return (
    <section className="echo-guide" aria-label="扫雷操作教程">
      <div className="guide-demo">
        <Minefield
          side={3}
          nums={[0, 1, 0, 0, 1, 1, 0, 0, 0]}
          revealed={revealed}
          flags={flags}
          pinned={4}
          target={done ? null : step === 1 ? 6 : step === 2 ? 2 : step === 3 ? 4 : null}
          onOpen={(i) => act(i, flagMode)}
          onFlag={(i) => act(i, true)}
          label="教程九宫格"
        />
      </div>
      <div className="guide-copy">
        <span className="echo-eyebrow">林渡的勘测图 · {step + 1} / 5</span>
        <h2 tabIndex={-1}>{STEPS[step][0]}</h2>
        <p>{STEPS[step][1]}</p>
        <div
          className="guide-scale"
          aria-label="数字底色：1 绿、2 黄、3 橙、4 红，数字始终为深色"
        >
          {[1, 2, 3, 4].map((n) => (
            <span key={n} className={`number-${n}`}>
              {n}
            </span>
          ))}
          <small>底色越深，雷位越密</small>
        </div>
        {step === 0 && (
          <button className="echo-primary" onClick={advance}>
            试着操作 <ArrowRight size={15} />
          </button>
        )}
        {step === 2 && !done && (
          <button
            className={flagMode ? "echo-primary" : "echo-secondary"}
            aria-pressed={flagMode}
            onClick={() => setFlagMode((v) => !v)}
          >
            {flagMode ? "标记已开启 · 点右上角" : "手机：开启标记"}
          </button>
        )}
        {step === 4 && (
          <button className="echo-primary" onClick={onComplete}>
            {completeLabel} <ArrowRight size={15} />
          </button>
        )}
        {done && step < 4 && <button className="echo-primary" onClick={advance}>下一步 <ArrowRight size={15} /></button>}
        {step > 0 && (
          <button
            className="echo-text"
            onClick={() => {
              setStep(0);
              setMessage("");
              setFlagMode(false);
              setDone(false);
            }}
          >
            <RotateCcw size={13} />
            重看
          </button>
        )}
        <div role="status" className="guide-message">
          {message}
        </div>
      </div>
    </section>
  );
}
