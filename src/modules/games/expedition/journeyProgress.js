import { settleTurn } from "./bridgeWorld";
import { hasFloor } from "./roomLayout";

export const createJourney = () => ({ version: 1, phase: "survey", offer: null, home: null, enemy: null, scene: null, line: 0, baseline: 0, ended: false, heard: [] });
export const journeyMode = (campaign) => campaign.journey?.phase || "free";
const clone = (value) => structuredClone(value);
const neighbors = (w, i) => [i - w.size, i + 1, i + w.size, i - 1].filter((j) =>
  j >= 0 && j < w.size ** 2 && Math.abs(j % w.size - i % w.size) + Math.abs(Math.floor(j / w.size) - Math.floor(i / w.size)) === 1 && hasFloor(w, j) && !w.mines[j]);

export function syncJourney(c) {
  const j = c.journey;
  if (!j) return c;
  if (j.phase === "survey" && c.completed.length && !j.home) {
    j.home = c.completed[0];
    j.offer = "shelter";
  }
  if (j.phase === "defense" && c.regions[j.home]?.nodes[j.enemy]?.owner === "player") j.offer = "outward";
  if (j.phase === "combined" && !j.ended && c.completed.length > j.baseline) j.offer = "rest";
  return c;
}

export function openJourneyScene(state) {
  if (!state.journey?.offer) return state;
  const c = clone(state);
  c.journey.scene = c.journey.offer;
  return c;
}

function defendHome(c) {
  const j = c.journey, w = c.regions[j.home];
  if (!w) return c;
  let lin = null;
  for (const [key, room] of Object.entries(c.regions)) {
    const entry = Object.entries(room.nodes).find(([, n]) => n.role === "lin" && n.owner === "player");
    if (entry) { lin = { key, index: Number(entry[0]), node: entry[1] }; break; }
  }
  if (!lin) return c;
  if (lin.key !== j.home) {
    const index = w.revealed.findIndex((v, i) => v && hasFloor(w, i) && !w.mines[i] && !w.nodes[i] && !w.bridges[i]);
    if (index < 0) return c;
    delete c.regions[lin.key].nodes[lin.index];
    w.nodes[index] = lin.node;
    lin.index = index;
  }
  // The first encounter reuses the floor the player actually cleared.
  // Keep a short, walkable approach and room to build a bridgehead.
  const queue = [{ i: lin.index, distance: 0 }], visited = new Set([lin.index]);
  for (let head = 0; head < queue.length; head++) {
    const p = queue[head];
    if (p.distance >= 4) continue;
    for (const i of neighbors(w, p.i)) {
      if (visited.has(i) || w.nodes[i] || w.bridges[i]) continue;
      visited.add(i); queue.push({ i, distance: p.distance + 1 });
    }
  }
  const target = queue.filter((p) => p.distance >= 2).sort((a, b) => Math.abs(a.distance - 3) - Math.abs(b.distance - 3))[0];
  if (!target) { c.announcement = "这片地面还没有可展开的桥头。再清出一间房，我们回来安顿。"; return c; }
  lin.node.power = Math.max(lin.node.power, 12);
  w.nodes[target.i] = { owner: "enemy", kind: "raider", name: "灰帆探路人", power: 2, introThreat: true };
  w.flags = w.mines.map((mine, i) => mine && !w.blasts[i] ? 1 : w.flags[i]);
  w.training = true;
  w.notice = { kind: "info", text: "清扫过的地面还在。选林渡，沿安全格画桥；点空地驻扎，点红色据点派队。" };
  c.active = j.home;
  Object.assign(j, { phase: "defense", enemy: target.i, offer: null });
  c.announcement = "林渡留在刚清出的房间里。先把桥接好，再结束回合。";
  return c;
}

export function finishJourneyScene(state) {
  if (!state.journey?.scene) return state;
  let c = clone(state);
  const j = c.journey, scene = j.scene;
  j.heard = [...new Set([...(j.heard || []), scene])];
  j.scene = null; j.line = 0;
  if (scene === "shelter" && j.phase === "survey") c = defendHome(c);
  if (scene === "outward" && j.phase === "defense" && j.offer === "outward") {
    Object.assign(j, { phase: "combined", offer: null, baseline: c.completed.length });
    for (const w of Object.values(c.regions)) w.explorationTurns = 0;
    c.announcement = "出门看看。每次清扫，留在桥头的人也会行动一回合。";
  }
  if (scene === "rest" && j.phase === "combined") {
    j.ended = true; j.offer = null;
    c.announcement = "这一晚的路已经接通。存档留在这里，随时可以回来。";
  }
  return c;
}

export function advanceDefense(state) {
  if (journeyMode(state) !== "defense" || state.journey.scene) return state;
  const c = clone(state), key = c.journey.home;
  c.regions[key] = settleTurn(c.regions[key], { allowLanding: false });
  c.turn++;
  const arrivals = c.regions[key].deliveries;
  c.announcement = arrivals.some((p) => p.kind === "attack" && p.captured)
    ? "灰帆退开了。刚才的红色据点，现在有人替我们守着。"
    : arrivals.some((p) => p.kind === "supply") ? "补给到了。桥头又多了一份力量。"
      : "一回合过去了。人手在增长，桥上的补给向前走了一格。";
  return syncJourney(c);
}

export function chooseFreeExplore(state) {
  if (!state.journey?.ended) return state;
  const c = clone(state);
  c.journey.phase = "free";
  return c;
}

export const JOURNEY_SCENES = {
  shelter: {
    chapter: "歇脚", title: "这块地，可以住人了", location: "刚清出的房间", finish: "回到这片地面",
    lines: [
      { speaker: "lin", text: "先把工具放下吧。这块地干净了。" },
      { speaker: "cen", text: "通风井那边有人。我认得那面灰色的旗。" },
      { speaker: "lin", text: "我们刚找到落脚的地方。把桥索拿来，先守住这里。" },
    ],
  },
  outward: {
    chapter: "分工", title: "这次，有人留下来", location: "桥头营地", finish: "去看前面的路",
    lines: [
      { speaker: "cen", text: "他们退了。桥头我守着，你们去看看隔壁？" },
      { speaker: "lin", text: "行。外面找到的人和物资，都往这边送。" },
      { speaker: "cen", text: "频道留着。有事叫我。" },
    ],
  },
  rest: {
    chapter: "这一晚", title: "把灯留着", location: "已接通的桥头", finish: "在这里歇一会儿",
    lines: [
      { speaker: "cen", text: "东西到了。水也烧开了。" },
      { speaker: "lin", text: "今晚就到这儿。把灯留着，后面也许还有人。" },
    ],
  },
};
