import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { StoryScene } from "../StoryScene";
import ExpeditionRoute from "../ExpeditionRoute";
import { CAMPAIGN_SAVE, createCampaign } from "../campaignEngine";
import { storyStorageKey } from "../storyProgress";
import { loadLessonProgress } from "../ConnectionPractice";
import { createConnectionLesson, LESSON_ROUTE, LESSON_SWEEPS } from "../connectionLesson";
import { prepareConnection } from "../routeDrawing";
import { actOnWorld } from "../bridgeWorld";

vi.mock("../../../../shell/ShellContext", () => ({ useShell: () => ({ navigate: vi.fn() }) }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let host, root;
beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  host = document.createElement("div"); document.body.append(host);
  root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers(); });
const button = (text) => [...host.querySelectorAll("button")].find((b) => b.textContent === text);
const click = (el) => act(() => el.click());

it("打字不会自动换句；第一次点击补全，第二次才继续", () => {
  const next = vi.fn(); const finish = vi.fn();
  const scene = { title: "测试", lines: [{ speaker: "lin", text: "先等一下。" }, { speaker: "cen", text: "我在。" }] };
  act(() => root.render(<StoryScene scene={scene} onLine={next} onFinish={finish} />));
  click(button("显示整句"));
  expect(next).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(5000));
  expect(next).not.toHaveBeenCalled();
  expect(host.querySelector(".story-text").textContent).toContain("先等一下。");
  click(button("继续"));
  expect(next).toHaveBeenCalledWith(1);
  expect(finish).not.toHaveBeenCalled();
});

it("回看只展示已经读到的台词", () => {
  const scene = { title: "测试", lines: [{ speaker: "lin", text: "当前台词" }, { speaker: "cen", text: "以后才说" }] };
  act(() => root.render(<StoryScene scene={scene} onLine={() => {}} onFinish={() => {}} />));
  click(button("回看"));
  expect(host.querySelector(".story-backlog").textContent).toContain("当前台词");
  expect(host.querySelector(".story-backlog").textContent).not.toContain("以后才说");
});

it("最后一句连点不会跳过下一段剧情", () => {
  localStorage.setItem("echoes-dialogue-instant", "yes");
  const finish = vi.fn();
  const scene = { title: "最后一句", finish: "回到地图", lines: [{ speaker: "lin", text: "走吧。" }] };
  act(() => root.render(<StoryScene scene={scene} onLine={() => {}} onFinish={finish} />));
  click(button("回到地图")); click(button("回到地图"));
  expect(finish).toHaveBeenCalledTimes(1);
});

it("演练刷新保留桥和在途补给，正式战役不受影响", () => {
  let world = prepareConnection(createConnectionLesson(), LESSON_ROUTE).world;
  world = actOnWorld(world, "open", LESSON_SWEEPS[0]);
  localStorage.setItem("rehearsal-test", JSON.stringify({ version: 1, world, stage: 2, speaking: false, line: 2, trace: [] }));
  const restored = loadLessonProgress("rehearsal-test");
  expect(restored.stage).toBe(2);
  expect(restored.speaking).toBe(false);
  expect(restored.world.turn).toBe(1);
  expect(restored.world.packets).toEqual(world.packets);
  expect(restored.world.nodes[25].power).toBe(2);
  expect(localStorage.getItem(CAMPAIGN_SAVE)).toBeNull();
});

it("剧情锁住清扫和迁移；稍后退出恢复操作且不推进回合", () => {
  const campaign = createCampaign(191);
  localStorage.setItem(CAMPAIGN_SAVE, JSON.stringify(campaign));
  act(() => root.render(<ExpeditionRoute />));
  const cells = [...host.querySelectorAll(".survey-grid button")];
  expect(cells.length).toBeGreaterThan(0);
  expect(cells.every((b) => b.disabled)).toBe(true);
  expect(host.querySelector('button[aria-label="向上进入相邻房间"]').disabled).toBe(true);
  act(() => vi.advanceTimersByTime(60000));
  expect(JSON.parse(localStorage.getItem(CAMPAIGN_SAVE)).turn).toBe(0);
  click(host.querySelector('button[aria-label="稍后继续这段对话"]'));
  expect(host.querySelectorAll(".survey-grid button:disabled")).toHaveLength(0);
  const story = JSON.parse(localStorage.getItem(storyStorageKey(campaign.seed)));
  expect(story.active).toBeNull();
  expect(story.finished).toEqual([]);
  expect(JSON.parse(localStorage.getItem(CAMPAIGN_SAVE)).turn).toBe(0);
});
