import { createConnectionLesson, LESSON_ROUTE, LESSON_SWEEPS } from "./connectionLesson";
import { prepareConnection } from "./routeDrawing";
import { actOnWorld, settleTurn } from "./bridgeWorld";

// Rehearsal snapshots use the same rules as play; watching never advances a save.
export function createConnectionDemo(mode = "combined") {
  const defense = mode === "defense";
  let world = createConnectionLesson(mode);
  const frames = [];
  const add = (frame) => frames.push({ world, trace: [], duration: 2800, chapter: 0, ...frame });
  add({ title: "先点林渡的大本营。", detail: "绿色据点里的 12，是林渡现在能调动的势力。", pointer: { board: "connection", cell: 22, click: true }, trace: [22] });
  [23, 24, 25].forEach((cell, index) => add({
    title: index === 0 ? "鼠标往右移，经过第一个数字。" : index === 1 ? "继续往右，经过第二格。" : "到这里停下，点击终点。",
    detail: index === 0 ? "这格是 1，建桥时能得到 1 点势力。" : index === 1 ? "再经过 2，沿路收入加到 3。" : "1 + 2 + 2，一共能得到 5。金色路线还在等待你确认。",
    pointer: { board: "connection", cell }, trace: LESSON_ROUTE.slice(0, index + 2), gain: [1, 3, 5][index], duration: 2200,
  }));
  add({ title: "在最后一格点一下。", detail: "这次点击会同时铺桥、领取数字势力、建立营地。", pointer: { board: "connection", cell: 25, click: true }, trace: LESSON_ROUTE, gain: 5, duration: 1700 });
  world = prepareConnection(world, LESSON_ROUTE).world;
  add({ title: "桥接通了，营地亮起第一盏灯。", detail: "林渡：12 + 5 − 3 格桥 − 3 驻扎 = 11。新营地有 1 点势力。", pointer: { board: "connection", cell: 25 }, highlight: [25], duration: 3800 });
  add({ chapter: 1, title: defense ? "桥接好了，结束这一回合。" : "现在，回到左边清扫。", detail: defense ? "点「结束回合」，补给向前走一格。阅读和画路线时，时间暂停。" : "点击金色未知格，推进一个回合。右边的补给也会走一格。", dual: !defense, pointer: { board: defense ? "control" : "survey", cell: LESSON_SWEEPS[0], click: true }, surveyGuide: [LESSON_SWEEPS[0]] });
  for (let turn = 0; turn < 4; turn++) {
    world = defense ? settleTurn(world) : actOnWorld(world, "open", LESSON_SWEEPS[turn], "lin");
    add({
      chapter: turn < 2 ? 1 : 2, dual: !defense,
      title: ["第一回合：补给走到第一格。", "第二回合：再走一格。", "第三回合：第一份补给到了。", "第四回合：第二份也到了。"][turn],
      detail: ["看右边带 1 的圆点。营地自己增长 1，变成 2。", "营地变成 3。第一份补给离它还差一格。", "营地 3 → 5：自然增长 1，再收到补给 1。", "营地已经有 7 点势力，可以派人守住前面的中继站。"][turn],
      pointer: { board: defense ? "control" : "survey", cell: LESSON_SWEEPS[turn], click: true },
      highlight: [turn === 0 ? 23 : turn === 1 ? 24 : 25], duration: 3600,
    });
  }
  world = structuredClone(world);
  world.nodes[26] = { owner: "enemy", kind: "raider", name: "灰帆侦察队", power: 2 };
  add({ chapter: 3, dual: !defense, title: "灰帆的人来了。点我们的桥头营地。", detail: "绿色营地有 7，旁边红色据点有 2。先选中营地。", pointer: { board: "connection", cell: 25, click: true }, trace: [25] });
  add({ chapter: 3, dual: !defense, title: "移到红色据点，点一下派队。", detail: "留守 1，走一格花 1，剩下 5 点势力出发。", pointer: { board: "connection", cell: 26, click: true }, trace: [25, 26] });
  world = prepareConnection(world, [25, 26]).world;
  add({ chapter: 3, dual: !defense, title: defense ? "队伍出发了。结束回合，等他们过桥。" : "队伍出发了。再清扫一格。", detail: defense ? "进攻也要等回合：队伍走完这一格桥，才会抵达红色据点。" : "进攻也要等回合：点左边金色格，让队伍走完这一格桥。", pointer: { board: defense ? "control" : "survey", cell: LESSON_SWEEPS[4], click: true }, surveyGuide: [LESSON_SWEEPS[4]] });
  world = defense ? settleTurn(world) : actOnWorld(world, "open", LESSON_SWEEPS[4], "lin");
  add({ chapter: 3, dual: !defense, title: "红色变成了绿色。我们守住了。", detail: "5 点势力抵消敌方增长后的 3，留下 2 点驻守。轮到你试试了。", highlight: [26], duration: 4000, complete: true });
  return frames;
}
