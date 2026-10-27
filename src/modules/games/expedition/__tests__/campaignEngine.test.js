import { roomTotal } from "../roomLayout";
import { describe, expect, it } from "vitest";
import {
  createCampaign,
  switchRegion,
  navigateRegion,
  actCampaign,
  orderRegion,
  homePreview,
  establishHome,
  nextCampaignLayer,
  findRole,
  restoreCampaign,
} from "../campaignEngine";

const keys = Object.keys(createCampaign(21).layout.rooms);
function cleared(c, key = c.active) {
  const w = c.regions[key];
  w.pendingStart = false;
  w.revealed = w.mines.map((m) => (m ? 0 : 1));
  return w;
}

describe("连通区域战役", () => {
  it("穿门一次即跨区，移动不推进回合，不能跳过未知区", () => {
    let c = createCampaign(21);
    c = navigateRegion(c, "north");
    expect(c.active).toBe("8,13");
    expect(c.turn).toBe(0);
    expect(switchRegion(createCampaign(21), "0,0").active).toBe("8,14");
  });
  it("清扫推进已开始区域，未开始房间冻结；清区只结算一次战略回合", () => {
    let c = switchRegion(createCampaign(21), "8,13");
    const w = cleared(c);
    c = actCampaign(c, "open", w.entry, "lin");
    expect(c.turn).toBe(1);
    expect(c.regions["8,14"].turn).toBe(0);
    expect(c.macroTurn).toBe(1);
    expect(c.celebration.key).toBe("8,13");
    c = actCampaign(c, "open", w.entry, "lin");
    expect(c.macroTurn).toBe(1);
  });
  it("空区域的不足三人队伍不能派出，不吞掉资源", () => {
    let c = switchRegion(createCampaign(21), "8,13");
    const origin = c.regions["8,14"];
    origin.nodes[origin.entry].power = 4;
    const next = orderRegion(c, "8,14", "8,13");
    expect(next.orders).toHaveLength(0);
    expect(next.regions["8,14"].nodes[origin.entry].power).toBe(4);
  });
  it("最后未清区被占仍能潜行清扫，结算收复队伍，避免死局", () => {
    let c = switchRegion(createCampaign(21), "8,13");
    c.completed = keys.filter((k) => k !== "8,13");
    const w = cleared(c);
    w.nodes = {
      [w.entry]: { owner: "enemy", kind: "camp", name: "占领区", power: 3 },
    };
    c.occupiers["8,13"] = "enemy";
    c.regions["8,14"].nodes[c.regions["8,14"].entry].power = 30;
    c = orderRegion(c, "8,14", "8,13");
    c = actCampaign(c, "open", w.entry, "lin");
    expect(c.completed).toHaveLength(keys.length);
    expect(c.orders).toHaveLength(0);
    expect(c.occupiers["8,13"]).toBe("player");
    expect(c.macroTurn).toBe(1);
  });
  it("大本营只占一格，跨区迁移保留培养等级", () => {
    let c = switchRegion(createCampaign(21), "8,13");
    const w = c.regions[c.active];
    w.floor.fill(1);
    w.mines.fill(0);
    w.revealed.fill(1);
    const origin = c.regions["8,14"];
    origin.supplies = 30;
    origin.levels.lin = 4;
    expect(homePreview(c, "lin", 0).tiles).toHaveLength(1);
    expect(homePreview(c, "cen", 0).tiles).toHaveLength(1);
    w.revealed[0] = 0;
    expect(homePreview(c, "lin", 0).valid).toBe(false);
    w.revealed[0] = 1;
    c = establishHome(c, "lin", 0);
    expect(findRole(c, "lin").key).toBe("8,13");
    expect(c.regions["8,13"].levels.lin).toBe(4);
    expect(c.homes.lin.tiles).toHaveLength(1);
    expect(c.regions["8,14"].supplies).toBe(29);
  });
  it("全层结束才下层，两位角色、等级、库存保留", () => {
    let c = createCampaign(21);
    expect(nextCampaignLayer(c)).toBe(c);
    const w = c.regions[c.active];
    w.nodes[w.entry + 1] = {
      owner: "player",
      kind: "role",
      role: "cen",
      name: "岑灯",
      power: 12,
    };
    w.levels.cen = 3;
    w.supplies = 15;
    c.completed = keys;
    const next = nextCampaignLayer(c);
    expect(next.depth).toBe(2);
    expect(next.regions[next.active].size).toBe(11);
    expect(findRole(next, "cen").node.power).toBe(12);
    expect(next.regions[next.active].levels.cen).toBe(3);
    expect(next.regions[next.active].supplies).toBe(15);
    expect(next.archive).toHaveLength(1);
    expect(restoreCampaign(JSON.stringify(next))).toEqual(next);
  });
  it("角色失守迁移保留等级，原区域敌占，战役不会结束", () => {
    let c = createCampaign(21);
    const w = c.regions[c.active],
      entry = w.entry;
    w.levels.lin = 5;
    w.nodes[entry].power = 1;
    w.nodes[entry + 1] = {
      owner: "enemy",
      kind: "camp",
      name: "入侵者",
      power: 50,
    };
    w.packets = [
      {
        id: 1,
        owner: "enemy",
        kind: "attack",
        amount: 20,
        path: [entry],
        step: -1,
        position: entry + 1,
        target: entry,
      },
    ];
    c = actCampaign(c, "flag", entry, "lin");
    const person = findRole(c, "lin");
    expect(person).not.toBeNull();
    expect(person.key).not.toBe("8,14");
    expect(c.regions[person.key].levels.lin).toBe(5);
    expect(c.occupiers["8,14"]).toBe("enemy");
  });
});
