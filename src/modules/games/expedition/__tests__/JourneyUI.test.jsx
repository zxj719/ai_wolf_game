import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import ExpeditionRoute from "../ExpeditionRoute";
import { CAMPAIGN_SAVE, createCampaign, actCampaign } from "../campaignEngine";
import { finishStory, createStoryProgress, storyStorageKey } from "../storyProgress";
import { openJourneyScene, finishJourneyScene, syncJourney } from "../journeyProgress";
import ConnectionPractice from "../ConnectionPractice";
import { createConnectionLesson, LESSON_ROUTE } from "../connectionLesson";
import { prepareConnection } from "../routeDrawing";
import { createConnectionDemo } from "../connectionDemoSequence";
import WorldMap from "../WorldMap";

vi.mock("../../../../shell/ShellContext", () => ({ useShell: () => ({ navigate: vi.fn() }) }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root, host;
beforeEach(() => {
  localStorage.clear(); vi.useFakeTimers();
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers(); });
const click = (el) => act(() => el.click());
const button = (label) => [...host.querySelectorAll("button")].find((b) => b.textContent.includes(label));
function renderCampaign(c) {
  localStorage.setItem(CAMPAIGN_SAVE, JSON.stringify(c));
  localStorage.setItem(storyStorageKey(c.seed), JSON.stringify(finishStory(createStoryProgress(c))));
  act(() => root.render(<ExpeditionRoute />));
}
function clearedCampaign() {
  const c = actCampaign(createCampaign(241, 1, { guided: true }), "open", 24, "lin");
  c.regions[c.active].revealed = c.regions[c.active].mines.map((m) => m ? 0 : 1);
  c.completed = [c.active];
  return syncJourney(c);
}

it("开场只有清扫，帮助也只教扫雷，没有后续系统和强制演练", () => {
  renderCampaign(createCampaign(241, 1, { guided: true }));
  expect(host.querySelector(".survey-grid")).not.toBeNull();
  expect(host.querySelector(".network-panel")).toBeNull();
  expect(button("培养角色")).toBeUndefined();
  expect(button("缩放至全层")).toBeUndefined();
  expect(host.querySelector("dialog[open]")).toBeNull();
  click(button("看看数字怎么读"));
  click(button("显示整句")); click(button("继续"));
  click(button("显示整句")); click(button("继续"));
  click(button("显示整句")); click(button("拿起探测器"));
  expect(host.querySelectorAll(".practice-steps li")).toHaveLength(1);
  expect(host.querySelector(".connection-demo")).toBeNull();
  expect(host.querySelector(".connection-practice .tactical-grid")).toBeNull();
});
it("守桥只有已清理的势力地图，结束回合才推进", () => {
  const c = finishJourneyScene(openJourneyScene(clearedCampaign()));
  renderCampaign(c);
  expect(host.querySelector(".survey-panel")).toBeNull();
  expect(host.querySelector(".tactical-grid")).not.toBeNull();
  expect(button("结束回合").disabled).toBe(false);
  act(() => vi.advanceTimersByTime(60000));
  expect(JSON.parse(localStorage.getItem(CAMPAIGN_SAVE)).turn).toBe(c.turn);
  click(button("结束回合"));
  expect(JSON.parse(localStorage.getItem(CAMPAIGN_SAVE)).turn).toBe(c.turn + 1);
});
it("旧远征可切换独立故事存档，再返回时棋盘和回合保持原样", () => {
  const c = createCampaign(941);
  renderCampaign(c);
  const before = localStorage.getItem(CAMPAIGN_SAVE);
  click(button("体验故事开场"));
  expect(host.querySelector('main[data-play-mode="survey"]')).not.toBeNull();
  expect(localStorage.getItem(CAMPAIGN_SAVE)).toBe(before);
  click(button("返回原远征"));
  expect(host.querySelector('main[data-play-mode="free"]')).not.toBeNull();
  expect(localStorage.getItem(CAMPAIGN_SAVE)).toBe(before);
});
it("守桥演练与动画都使用结束回合，不要求玩家再去学左侧清扫", () => {
  const world = prepareConnection(createConnectionLesson("defense"), LESSON_ROUTE).world;
  localStorage.setItem("defense-test", JSON.stringify({ version: 1, stage: 2, world, speaking: false, line: 0, trace: [] }));
  act(() => root.render(<ConnectionPractice mode="defense" storageKey="defense-test" onClose={() => {}} />));
  expect(host.querySelector(".survey-grid")).toBeNull();
  for (let i = 0; i < 3; i++) { click(button("结束回合")); act(() => vi.advanceTimersByTime(800)); }
  const w = JSON.parse(localStorage.getItem("defense-test")).world;
  expect(w.turn).toBe(3);
  expect(w.nodes[25].power).toBe(5);
  expect(w.deliveries).toEqual(expect.arrayContaining([expect.objectContaining({ to: 25, amount: 1 })]));
  const demo = createConnectionDemo("defense");
  expect(demo.some((f) => f.dual || f.pointer?.board === "survey")).toBe(false);
  expect(demo.at(-1).world.nodes[26]).toMatchObject({ owner: "player", power: 2 });
});

it("收掉窄房空墙后，尚未移动鼠标也能看到有效的九宫格范围", () => {
  const world = createConnectionLesson();
  world.floor = Array.from({ length: 49 }, (_, i) => i >= 14 && i < 35 ? 1 : 0);
  act(() => root.render(<WorldMap game={world} nums={Array(49).fill(0)} onCell={() => {}} onFlag={() => {}} />));
  const frame = host.querySelector(".world-neighborhood");
  expect(host.querySelectorAll(".world-cell")).toHaveLength(21);
  expect(Number.isFinite(parseFloat(frame.style.top))).toBe(true);
  expect(parseFloat(frame.style.height)).toBeGreaterThan(0);
  expect(parseFloat(frame.style.top) + parseFloat(frame.style.height)).toBeLessThanOrEqual(100);
});
