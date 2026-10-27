import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import ConnectionPractice from "../ConnectionPractice";
import { createConnectionLesson } from "../connectionLesson";
import { createConnectionDemo } from "../connectionDemoSequence";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root, host;
const key = "bridge-practice-regression";
beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers(); });
function mount(stage = 0, trace = []) {
  localStorage.setItem(key, JSON.stringify({ version: 1, world: createConnectionLesson(), stage, speaking: false, line: 0, trace }));
  act(() => root.render(<ConnectionPractice storageKey={key} onClose={() => {}} />));
}
const cell = (i) => host.querySelector(`.tactical-grid [data-cell="${i}"]`);
const button = (label) => [...host.querySelectorAll("button")].find((b) => b.textContent.includes(label));
const click = (el) => act(() => el.click());
const hover = (i) => act(() => cell(i).dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));
const saved = () => JSON.parse(localStorage.getItem(key));

it("画线阶段点击终点立即驻扎，不需要先翻到另一个教学阶段", () => {
  mount();
  click(cell(22)); hover(23); hover(24); hover(25);
  expect(host.querySelector(".practice-feedback").textContent).toContain("现在点击");
  click(cell(25));
  expect(saved().world.nodes[25]).toMatchObject({ owner: "player", power: 1 });
  expect(saved().world.nodes[22].power).toBe(11);
  expect(saved().world.turn).toBe(0);
  expect(button("看补给怎么过桥").disabled).toBe(false);
  click(cell(25));
  expect(saved().world.nodes[22].power).toBe(11);
});

it("移出教学路线不会累积隐藏绕路或卡住驻扎；未选起点有可见提示", () => {
  mount();
  click(cell(25));
  expect(host.querySelector(".practice-feedback").textContent).toContain("先点击绿色");
  click(cell(22)); hover(23); hover(30); hover(31); hover(24); hover(25);
  expect(saved().trace).toEqual([22, 23, 24, 25]);
  click(cell(25));
  expect(saved().world.nodes[25].power).toBe(1);
});

it("旧版停在驻扎前的教学进度可以直接继续", () => {
  mount(1, [22, 23, 24, 25]);
  click(cell(25));
  expect(saved().world.nodes[25].power).toBe(1);
  expect(saved().world.nodes[22].power).toBe(11);
});

it("演示可暂停、前后逐步看和重播，退出后练习与远征存档保持原样", () => {
  mount(); click(cell(22)); hover(23);
  localStorage.setItem("campaign-sentinel", "unchanged");
  const before = localStorage.getItem(key);
  click(button("看完整动画演示"));
  expect(button("上一步").disabled).toBe(true);
  click(host.querySelector('[aria-label="暂停演示"]'));
  const caption = host.querySelector(".demo-caption").textContent;
  act(() => vi.advanceTimersByTime(10000));
  expect(host.querySelector(".demo-caption").textContent).toBe(caption);
  click(button("下一步"));
  expect(host.querySelector(".demo-caption").textContent).toContain("第一个数字");
  click(host.querySelector('[aria-label="播放演示"]'));
  click(button("上一步"));
  expect(host.querySelector(".demo-caption").textContent).toBe(caption);
  expect(button("上一步").disabled).toBe(true);
  expect(host.querySelector('[aria-label="播放演示"]')).not.toBeNull();
  act(() => vi.advanceTimersByTime(10000));
  expect(host.querySelector(".demo-caption").textContent).toBe(caption);
  click(button("击退入侵者"));
  click(button("下一步")); click(button("下一步")); click(button("下一步"));
  expect(button("下一步").disabled).toBe(true);
  click(button("上一步"));
  expect(host.querySelector(".demo-caption").textContent).toContain("队伍出发了");
  expect(button("下一步").disabled).toBe(false);
  click(button("重播"));
  expect(host.querySelector(".demo-caption").textContent).toContain("先点林渡");
  click(button("返回我的练习"));
  expect(localStorage.getItem(key)).toBe(before);
  expect(localStorage.getItem("campaign-sentinel")).toBe("unchanged");
  expect(saved().trace).toEqual([22, 23]);
});

it("动画中的驻扎、第三回合抵达和击退敌军均由游戏规则计算", () => {
  const frames = createConnectionDemo();
  const camp = frames.find((f) => f.world.nodes[25]);
  expect(camp.world.nodes[22].power).toBe(11);
  expect(camp.world.nodes[25].power).toBe(1);
  const third = frames.find((f) => f.world.turn === 3);
  expect(third.world.nodes[25].power).toBe(5);
  expect(third.world.deliveries.some((p) => p.to === 25 && p.amount === 1)).toBe(true);
  expect(frames.at(-1).world.nodes[26]).toMatchObject({ owner: "player", power: 2 });
  expect(frames[0].world.nodes[22].power).toBe(12);
  expect(frames[0].world.nodes[25]).toBeUndefined();
});
