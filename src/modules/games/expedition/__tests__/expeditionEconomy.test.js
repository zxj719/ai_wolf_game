import { describe, expect, it } from "vitest";
import {
  createCampaign,
  trainCampaign,
  navigateRegion,
  moveRoleToRegion,
  findRole,
  actCampaign,
} from "../campaignEngine";
import { actOnWorld, canSurveyRemaining } from "../bridgeWorld";
import { trainingCost, remoteExplorationReward } from "../campaignBalance";
import { generateRoomBoard } from "../maskedBoard";
import { roomMask } from "../roomLayout";

function fixture() {
  const c = createCampaign(21),
    w = c.regions[c.active];
  w.training = true;
  w.pendingStart = false;
  w.floor.fill(1);
  w.mines.fill(0);
  w.flags.fill(0);
  w.loot.fill(0);
  w.revealed.fill(1);
  w.nodes[w.entry].power = 10;
  return { c, w };
}

describe("长期培养与前线迁驻", () => {
  it("三级培养需要实际库存30；不足时不扣原料、不改变等级", () => {
    const { c, w } = fixture();
    w.levels.lin = 3;
    w.supplies = 29;
    const denied = trainCampaign(c, "lin");
    expect(findRole(denied, "lin").node.power).toBe(10);
    expect(denied.regions[c.active].levels.lin).toBe(3);
    expect(denied.regions[c.active].supplies).toBe(29);
    expect(denied.announcement).toContain("不足");
    w.supplies = 30;
    const trained = trainCampaign(c, "lin");
    expect(trained.regions[c.active].supplies).toBe(0);
    expect(trained.regions[c.active].levels.lin).toBe(4);
    expect(findRole(trained, "lin").node.power).toBe(14);
  });
  it("迁驻按人物实际距离扣共享库存，保留等级和势力，不额外推进回合", () => {
    let { c, w } = fixture();
    w.supplies = 9;
    w.levels.lin = 3;
    c = navigateRegion(navigateRegion(c, "north"), "north");
    const destination = c.regions[c.active];
    destination.pendingStart = false;
    destination.mines.fill(0);
    destination.revealed = destination.floor.slice();
    const denied = moveRoleToRegion(c, "lin");
    expect(findRole(denied, "lin").key).toBe("8,14");
    expect(denied.regions["8,14"].supplies).toBe(9);
    c.regions["8,14"].supplies = 10;
    const moved = moveRoleToRegion(c, "lin");
    expect(findRole(moved, "lin").key).toBe(c.active);
    expect(findRole(moved, "lin").node.power).toBe(10);
    expect(moved.regions[c.active].levels.lin).toBe(3);
    expect(moved.regions["8,14"].supplies).toBe(0);
    expect(
      Object.values(moved.regions["8,14"].nodes).some(
        (n) => n.kind === "camp" && n.power === 1,
      ),
    ).toBe(true);
    expect(moved.turn).toBe(c.turn);
  });
  it("培养提升有效清扫，距离削弱远程支援，重复点击不吃培养奖励", () => {
    const { c, w } = fixture();
    w.levels.lin = 5;
    w.revealed[1] = 0;
    w.mines[0] = 1;
    let next = actOnWorld(w, "open", 1, "lin");
    expect(next.nodes[w.entry].power).toBe(14); // one safe + two training + one natural growth
    next = actOnWorld(next, "open", 1, "lin");
    expect(next.nodes[w.entry].power).toBe(15);
    expect(remoteExplorationReward(5, 5, 1)).toBe(7);
    expect(remoteExplorationReward(5, 5, 4)).toBe(3);
    expect(remoteExplorationReward(0, 5, 4)).toBe(0);
    expect(trainingCost(7)).toBe(150);
  });
});

describe("确定数字的便捷操作仍保持回合和风险", () => {
  it("数字周围剩余两格都应是雷时一次连标，只结算一回合", () => {
    const { w } = fixture();
    w.mines[0] = w.mines[1] = 1;
    w.revealed[0] = w.revealed[1] = 0;
    const next = actOnWorld(w, "open", 8, "lin");
    expect(next.flags[0]).toBe(1);
    expect(next.flags[1]).toBe(1);
    expect(next.turn).toBe(w.turn + 1);
    expect(next.latest).toHaveLength(0);
    expect(next.nodes[w.entry].power).toBe(11);
  });
  it("还有多余未知格时不会猜测插旗", () => {
    const { w } = fixture();
    w.mines[0] = w.mines[1] = 1;
    w.revealed[0] = w.revealed[1] = w.revealed[2] = 0;
    const next = actOnWorld(w, "open", 8, "lin");
    expect(next.flags.filter(Boolean)).toHaveLength(0);
    expect(next.revealed[2]).toBe(0);
  });
  it("正确标完后巡检所有余格，只获得一次清区与物资结算", () => {
    const { c, w } = fixture();
    w.mines[0] = 1;
    w.flags[0] = 1;
    w.revealed[0] = w.revealed[1] = w.revealed[2] = 0;
    w.loot[1] = 1;
    expect(canSurveyRemaining(w)).toBe(true);
    const next = actCampaign(c, "finish", w.entry, "lin");
    expect(next.turn).toBe(1);
    expect(next.macroTurn).toBe(1);
    expect(next.celebration).toMatchObject({ turns: 1, earned: 3, losses: 0 });
    const again = actCampaign(next, "finish", w.entry, "lin");
    expect(again.turn).toBe(1);
    expect(again.macroTurn).toBe(1);
    expect(again.regions[c.active].supplies).toBe(3);
  });
  it("巡检按玩家标记执行，误旗仍会触雷、损失原料且不能白拿清扫势力", () => {
    const { w } = fixture();
    w.mines[0] = 1;
    w.flags[1] = 1;
    w.supplies = 10;
    w.revealed[0] = w.revealed[1] = w.revealed[2] = 0;
    const next = actOnWorld(w, "finish", w.entry, "lin");
    expect(next.blasts[0]).toBe(1);
    expect(next.revealed[1]).toBe(0);
    expect(next.supplies).toBe(7);
    expect(next.losses).toBe(3);
    expect(next.nodes[w.entry].power).toBe(11);
  });
  it("雷未标完不能请求全图巡检，也不消耗回合", () => {
    const { w } = fixture();
    w.mines[0] = 1;
    w.revealed[0] = w.revealed[1] = 0;
    expect(canSurveyRemaining(w)).toBe(false);
    expect(actOnWorld(w, "finish", w.entry, "lin")).toBe(w);
  });
});

it("十一阶和十三阶六种房型保持目标密度及任意首击安全", () => {
  for (const size of [11, 13])
    for (let shape = 0; shape < 6; shape++)
      for (const seed of [21, 67, 123]) {
        const w = {
          size,
          depth: 1,
          danger: size === 11 ? 2 : 3,
          seed,
          floor: roomMask(size, shape),
          nodes: {},
        };
        const start = w.floor.findIndex(Boolean),
          b = generateRoomBoard(w, start);
        expect(b.mines[start]).toBe(0);
        expect(b.mines.every((m, i) => !m || w.floor[i])).toBe(true);
        expect(b.mines.filter(Boolean).length).toBe(
          Math.round(
            w.floor.filter(Boolean).length * (size === 11 ? 0.15 : 0.165),
          ),
        );
      }
});
