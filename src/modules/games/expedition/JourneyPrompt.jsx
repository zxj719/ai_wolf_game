import { Radio } from "lucide-react";
import { journeyMode } from "./journeyProgress";

export default function JourneyPrompt({ campaign, disabled, onStory, onHelp, onExplore, onFree, onLeave }) {
  const j = campaign.journey, mode = journeyMode(campaign);
  if (!j || mode === "free") return null;
  let title, detail, action, label;
  if (j.ended) {
    title = "这一晚，先到这里。";
    detail = "这段故事已结束。存档会留在这里；想再走走，可以继续自由探索。";
    action = onLeave; label = "收起地图";
  } else if (j.offer === "rest") {
    title = "电台里传来水烧开的声音。";
    detail = "这条路已经帮上了桥头的人。林渡在招呼你回去歇脚。";
    action = onStory; label = "回去歇会儿";
  } else if (j.offer === "outward") {
    title = "桥头有人守着了。";
    detail = "岑灯接过了电台。下一次出门，你可以把找到的人和物资送回来。";
    action = onStory; label = "和岑灯说句话";
  } else if (j.offer === "shelter") {
    title = "这块地扫干净了。";
    detail = "林渡放下工具，招呼你回来安顿。还想再看看，也可以先走走。";
    action = onStory; label = "回去看看";
  } else if (mode === "survey") {
    title = "先找一块能落脚的地面。";
    detail = "任选一格开始。数字告诉你，周围八格藏着多少雷。";
    action = onHelp; label = "看看数字怎么读";
  } else if (mode === "defense") {
    const w = campaign.regions[campaign.active];
    const camp = Object.values(w.nodes).some((n) => n.owner === "player" && n.kind === "camp");
    title = "守住刚清出来的地方。";
    detail = camp ? "桥头安顿好了。结束回合，观察补给；点我方据点，划向红色据点派队。" : "点林渡的绿色据点，划过安全地面；点终点驻扎，点红色据点派队。";
    action = onHelp; label = "让林渡演示一下";
  } else {
    title = "你在前面清扫，桥头的人也在行动。";
    detail = "每次开格或标记，补给向前走一格。阅读和画路线时，大家会等你。";
    action = campaign.active === j.home ? onExplore : onHelp;
    label = campaign.active === j.home ? "去隔壁看看" : "看看两边怎么配合";
  }
  return <section className="journey-prompt" data-tour="story" aria-label="当前故事与行动">
    <Radio size={18} aria-hidden="true" />
    <div><h2>{title}</h2><p>{detail}</p></div>
    <div className="journey-prompt-actions">
      <button className="echo-secondary" disabled={disabled} onClick={action}>{label}</button>
      {j.ended && <button disabled={disabled} onClick={onFree}>继续自由探索</button>}
    </div>
  </section>;
}
