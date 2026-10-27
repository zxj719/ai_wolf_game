import { useEffect, useRef, useState } from "react";

export const TOUR_STEPS = [
  [
    "story",
    "清扫，重建，连接",
    "每间房都是独立地图。第一格由你自由选择，首击安全；清出来的地面将成为桥、营地与单格大本营。",
  ],
  [
    "survey",
    "先读九宫格",
    "亮格数字表示周围八格的雷数。深蓝格尚未清扫。鼠标移动或选中格子，九宫格框会一直保留；1 绿、2 黄、3 橙、4 红。",
  ],
  [
    "controls",
    "每次操作，就是一回合",
    "左键开格，右键或 F 标记。旗数匹配时点数字展开；剩余邻格全应是雷时，点数字连标。雷数归零可按标记巡检，误标仍会触雷。每次操作推进一回合。",
  ],
  [
    "navigation",
    "穿门，进入独立房间",
    "每次按方向门都进入另一间独立房间。原房间的清扫和建设会保留，随时能返回。全层由大量不同形状的房间拼成灯塔，全部扫清后才能下层。穿门不消耗回合。",
  ],
  [
    "roles",
    "把清扫所得交给谁",
    "先选角色，清扫增援就分给他。培养提升容量，每两级增加清扫增援；隔两区以上支援会衰减，可花原料迁近。自然增长到容量为止，被邻接敌军封锁的角色需要清扫支援。",
  ],
  [
    "network",
    "点大本营，划路线，点终点",
    "每个大本营只占一格。点选后，鼠标划过安全地面，路线实时跟随；点空白终点驻扎，点红色据点进攻。途经数字格按数字获得势力，每格只领取一次。右侧有可实际操作的实战教学。",
  ],
  [
    "logistics",
    "桥需要时间",
    "相连角色比营地更强时，每回合自动送出 1。每回合只能走一格，路长 3 格就等 3 回合。运输中的势力会显示在桥上。",
  ],
  [
    "network",
    "他们也会架桥",
    "本区探索会推进空降倒计时，大房间稍晚出现；已有敌军随行动扩张。点据点划路到敌军即可进攻，数值抵消。阅读和规划时世界暂停，点击开始才恢复。",
  ],
];
export default function WorldTour({ step, steps = TOUR_STEPS, onStep, onClose }) {
  const dialog = useRef(null),
    [rect, setRect] = useState(null);
  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
    return () => {
      if (d?.open) d.close();
    };
  }, []);
  useEffect(() => {
    const target = document.querySelector(
      `[data-tour="${steps[step][0]}"]`,
    );
    target?.scrollIntoView({ block: "center", behavior: "instant" });
    const measure = () => {
      const r = target?.getBoundingClientRect();
      if (r)
        setRect({ left: r.left, top: r.top, width: r.width, height: r.height });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step, steps]);
  return (
    <dialog
      className="world-tour"
      ref={dialog}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-labelledby="tour-title"
    >
      {rect && <div className="tour-spotlight" style={rect} />}
      <div className="tour-card">
        <span>
          现场引导 · 已暂停 / {step + 1} OF {steps.length}
        </span>
        <h2 id="tour-title">{steps[step][1]}</h2>
        <p>{steps[step][2]}</p>
        <div className="tour-dots">
          {steps.map((_, i) => (
            <i key={i} className={i === step ? "active" : ""} />
          ))}
        </div>
        <footer>
          <button type="button" onClick={onClose}>
            结束引导
          </button>
          <div>
            {step > 0 && (
              <button type="button" onClick={() => onStep(step - 1)}>
                上一步
              </button>
            )}
            <button
              autoFocus
              type="button"
              className="echo-primary"
              onClick={() =>
                step === steps.length - 1 ? onClose() : onStep(step + 1)
              }
            >
              {step === steps.length - 1 ? "开始行动" : "下一步 →"}
            </button>
          </div>
        </footer>
      </div>
    </dialog>
  );
}
