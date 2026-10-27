import { describe, it, expect } from "vitest";
import { createCampaign } from "../campaignEngine";
import { createStoryProgress, finishStory, restoreStoryProgress, syncStoryProgress } from "../storyProgress";

describe("剧情随实际战役推进", () => {
  it("旧存档不倒灌历史弹窗，仍允许重听已经到达的章节", () => {
    const c = createCampaign(241);
    c.completed = Array.from({ length: 20 }, (_, i) => String(i));
    c.events = [{ kind: "invasion" }, { kind: "reclaimed" }];
    const p = createStoryProgress(c);
    expect(p.queue).toEqual(["opening"]);
    expect(p.unlocked).toEqual(expect.arrayContaining(["firstClear", "reclaimed"]));
    expect(p.unlocked).not.toEqual(expect.arrayContaining(["sixRooms", "twelveRooms", "eighteenRooms"]));
    expect(syncStoryProgress(p, c)).toBe(p);
  });
  it("同一次行动的多段剧情排队，读完一段才轮到下一段", () => {
    const c = createCampaign(241);
    let p = finishStory(createStoryProgress(c));
    c.completed = [c.active];
    c.events = [{ kind: "invasion" }];
    p = syncStoryProgress(p, c);
    expect(p.queue).toEqual(["firstClear", "invasion"]);
    expect(p.active).toBe("firstClear");
    p = finishStory(p);
    expect(p.active).toBe("invasion");
    p = finishStory(p);
    expect(p.active).toBeNull();
    expect(syncStoryProgress(p, c)).toBe(p);
  });
  it("暂停阅读和刷新保留句子，不把略过当作已读", () => {
    const c = createCampaign(24);
    const p = { ...createStoryProgress(c), active: null, positions: { opening: 3 }, lessonActive: true };
    const saved = restoreStoryProgress(JSON.stringify(p), c);
    expect(saved.positions.opening).toBe(3);
    expect(saved.active).toBeNull();
    expect(saved.finished).toEqual([]);
    expect(saved.queue).toEqual(["opening"]);
    expect(saved.lessonActive).toBe(true);
  });
  it("坏数据与其他战役的阅读位置不会破坏当前剧情", () => {
    const c = createCampaign(24);
    const p = { ...createStoryProgress(c), positions: { opening: 9999 }, active: "missing" };
    const restored = restoreStoryProgress(JSON.stringify(p), c);
    expect(restored.active).toBeNull();
    expect(restored.positions.opening).toBe(6);
    expect(restoreStoryProgress("{", c)).toEqual(createStoryProgress(c));
    expect(restoreStoryProgress(JSON.stringify(p), createCampaign(25)).seed).toBe(25);
  });
});
