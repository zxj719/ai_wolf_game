import { describe, expect, it } from "vitest";
import { createCampaign, actCampaign, navigateRegion, findRole, restoreCampaign } from "../campaignEngine";
import { journeyMode, openJourneyScene, finishJourneyScene, advanceDefense, chooseFreeExplore } from "../journeyProgress";
import { hasFloor, roomExit } from "../roomLayout";
import { prepareConnection } from "../routeDrawing";
import { createStoryProgress, finishStory, syncStoryProgress } from "../storyProgress";

// Engine fixtures intentionally know mine positions. Browser playtests use visible numbers.
export function clearRoom(c, start) {
  let w = c.regions[c.active];
  if (w.pendingStart) c = actCampaign(c, "open", start ?? w.floor.findIndex(Boolean), "lin");
  w = c.regions[c.active];
  for (let i = 0; i < w.size ** 2; i++) {
    w = c.regions[c.active];
    if (hasFloor(w, i) && !w.mines[i] && !w.revealed[i]) c = actCampaign(c, "open", i, "lin");
  }
  return c;
}
export function defenseCampaign(seed = 241, start) {
  let c = clearRoom(createCampaign(seed, 1, { guided: true }), start);
  c.celebration = null;
  return finishJourneyScene(openJourneyScene(c));
}
function pathTo(w, from, to) {
  const q = [[from]], seen = new Set([from]);
  for (let k = 0; k < q.length; k++) {
    const path = q[k], i = path.at(-1);
    if (i === to) return path;
    for (const n of [i - w.size, i + 1, i + w.size, i - 1]) {
      if (seen.has(n) || n < 0 || n >= w.size ** 2 || !hasFloor(w, n) || w.mines[n] ||
        (w.nodes[n] && n !== to) || Math.abs(i % w.size - n % w.size) + Math.abs(Math.floor(i / w.size) - Math.floor(n / w.size)) !== 1) continue;
      seen.add(n); q.push([...path, n]);
    }
  }
  return [];
}
export function winDefense(c) {
  const w = c.regions[c.active], p = findRole(c, "lin"), path = pathTo(w, p.index, c.journey.enemy);
  const campPath = path.slice(0, -1), plan = prepareConnection(w, campPath);
  expect(plan.valid).toBe(true);
  c.regions[c.active] = plan.world;
  const camp = campPath.at(-1);
  for (let i = 0; i < 5; i++) c = advanceDefense(c);
  const attack = prepareConnection(c.regions[c.active], [camp, c.journey.enemy]);
  expect(attack.forecast.favorable).toBe(true);
  c.regions[c.active] = attack.world;
  return advanceDefense(c);
}

describe("新玩法从玩家已经做过的事里长出来", () => {
  it("纯清扫可以慢慢玩，超过入侵时间也没有隐藏战斗或势力增长", () => {
    let c = createCampaign(241, 1, { guided: true });
    c = actCampaign(c, "open", 24, "lin");
    const power = findRole(c, "lin").node.power;
    const unknown = c.regions[c.active].revealed.findIndex((v, i) => !v && hasFloor(c.regions[c.active], i));
    for (let i = 0; i < 60; i++) c = actCampaign(c, "flag", unknown, "lin");
    expect(c.turn).toBe(61);
    expect(findRole(c, "lin").node.power).toBe(power);
    expect(Object.values(c.regions[c.active].nodes).some((n) => n.owner === "enemy")).toBe(false);
    expect(c.journey.phase).toBe("survey");
  });
  it("清扫完成只提出邀请，可以先去别的房间；接听才在原地图守桥", () => {
    let c = clearRoom(createCampaign(241, 1, { guided: true }));
    const home = c.active, old = structuredClone(c.regions[home]);
    expect(c.journey).toMatchObject({ phase: "survey", offer: "shelter", scene: null });
    const dir = ["east", "north", "south", "west"].find((d) => roomExit(c, d));
    c = navigateRegion(c, dir);
    expect(c.active).not.toBe(home);
    c = openJourneyScene(c);
    expect(actCampaign(c, "open", 24, "lin")).toBe(c);
    c = finishJourneyScene(c);
    expect(c.journey.phase).toBe("defense");
    expect(c.active).toBe(home);
    expect(c.regions[home].mines).toEqual(old.mines);
    expect(c.regions[home].revealed).toEqual(old.revealed);
    expect(c.regions[home].nodes[c.journey.enemy].owner).toBe("enemy");
    expect(actCampaign(c, "open", 24, "lin")).toBe(c);
    expect(navigateRegion(c, dir)).toBe(c);
  });
  it("不同随机开局都有可到达的敌人，可以驻扎、运输并击退", () => {
    for (const seed of [1, 2, 3, 24, 57, 241, 1017, 65535]) {
      const c = defenseCampaign(seed, seed % 2 ? 24 : 0);
      expect(c.journey.phase).toBe("defense");
      const won = winDefense(c);
      expect(won.journey).toMatchObject({ phase: "defense", offer: "outward" });
      expect(won.regions[won.active].nodes[won.journey.enemy].owner).toBe("player");
    }
  });
  it("合流后一次清扫推动后方一个回合；完成新的供给路后收束，不追加房间配额", () => {
    let c = finishJourneyScene(openJourneyScene(winDefense(defenseCampaign())));
    expect(journeyMode(c)).toBe("combined");
    const home = c.journey.home;
    const d = ["east", "north", "south", "west"].find((d) => roomExit(c, d));
    c = navigateRegion(c, d);
    const before = c.regions[home].turn;
    c = actCampaign(c, "open", 24, "lin");
    expect(c.regions[home].turn).toBe(before + 1);
    expect(c.journey.offer).toBeNull();
    c = clearRoom(c);
    expect(c.journey.offer).toBe("rest");
    c = finishJourneyScene(openJourneyScene(c));
    expect(c.journey.ended).toBe(true);
    expect(c.journey.phase).toBe("combined");
    expect(chooseFreeExplore(c).journey.phase).toBe("free");
    expect(Object.values(c.regions).some((w) => w.landings > 0)).toBe(false);
  });
  it("保存解锁状态和未读句子，旧远征保持开放，不因清区数量塞入剧情", () => {
    let c = openJourneyScene(clearRoom(createCampaign(241, 1, { guided: true })));
    c.journey.line = 1;
    expect(restoreCampaign(JSON.stringify(c)).journey).toEqual(c.journey);
    c.journey.scene = null;
    expect(openJourneyScene(c).journey.line).toBe(1);
    const p = finishStory(createStoryProgress(c));
    c.completed = Array.from({ length: 18 }, (_, i) => String(i));
    expect(syncStoryProgress(p, c)).toBe(p);
    const legacy = createCampaign(241);
    expect(journeyMode(restoreCampaign(JSON.stringify(legacy)))).toBe("free");
  });
});
