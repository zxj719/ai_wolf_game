import { it, expect } from "vitest";
import {
  createCampaign,
  navigateRegion,
  actCampaign,
  findRole,
  trainCampaign,
  orderRegion,
  restoreCampaign,
} from "../campaignEngine";
import { settleTurn, actOnWorld } from "../bridgeWorld";
import { roomDifficulty } from "../campaignBalance";
import { roomMask } from "../roomLayout";
import { generateRoomBoard } from "../maskedBoard";

it("封锁暂停角色自然增长，但真实清扫仍能支援被围角色", () => {
  const w = createCampaign(21).regions["8,14"];
  w.pendingStart = false;
  w.training = true;
  w.mines.fill(0);
  w.revealed.fill(0);
  w.loot.fill(0);
  w.nodes[w.entry].power = 5;
  w.nodes[w.entry + 1] = { owner: "enemy", kind: "camp", power: 10 };
  expect(settleTurn(w).nodes[w.entry].power).toBe(5);
  expect(
    actOnWorld(w, "open", w.entry, "lin").nodes[w.entry].power,
  ).toBeGreaterThan(5);
});
it("撤离优先选择没有敌军的后方，而不是最近的交战区", () => {
  let c = createCampaign(21),
    origin = c.active;
  c = navigateRegion(c, "north");
  const near = c.active;
  c = navigateRegion(c, "north");
  const safe = c.active;
  const n = c.regions[near];
  n.nodes[n.entry] = { owner: "enemy", kind: "camp", power: 8 };
  n.training = true;
  c.active = origin;
  const w = c.regions[origin];
  w.pendingStart = false;
  w.training = true;
  w.nodes[w.entry].power = 1;
  w.packets = [
    {
      id: 1,
      owner: "enemy",
      kind: "attack",
      amount: 20,
      path: [w.entry],
      step: -1,
      position: w.entry + 1,
      target: w.entry,
    },
  ];
  c = actCampaign(c, "flag", w.entry, "lin");
  expect(findRole(c, "lin").key).toBe(safe);
});
it("角色离开后的留守营地失守也会转为敌占并记录战报", () => {
  let c = createCampaign(21),
    w = c.regions[c.active];
  w.pendingStart = false;
  w.training = true;
  w.nodes[w.entry] = { owner: "player", kind: "camp", power: 1 };
  w.packets = [
    {
      id: 1,
      owner: "enemy",
      kind: "attack",
      amount: 20,
      path: [w.entry],
      step: -1,
      position: w.entry + 1,
      target: w.entry,
    },
  ];
  c = actCampaign(c, "flag", w.entry, "lin");
  expect(c.occupiers[c.active]).toBe("enemy");
  expect(c.events.some((e) => e.kind === "lost")).toBe(true);
});

it("未开始的房间不会因远方清扫提前增长或错过入侵窗口", () => {
  let c = createCampaign(21);
  c = navigateRegion(c, "north");
  const i = c.regions[c.active].floor.findIndex(Boolean);
  c = actCampaign(c, "open", i, "lin");
  expect(c.regions["8,14"].turn).toBe(0);
});
it("培养使用全层库存且立刻给出成功或不足反馈", () => {
  let c = navigateRegion(createCampaign(21), "north");
  c.regions["8,14"].supplies = 0;
  c.regions["8,13"].supplies = 20;
  c = trainCampaign(c, "lin");
  expect(c.regions["8,14"].levels.lin).toBe(2);
  expect(Object.values(c.regions).reduce((a, w) => a + w.supplies, 0)).toBe(14);
  expect(c.announcement).toContain("成长");
});
it("自然增长有容量，旧存档超过容量的已有势力不会被削掉", () => {
  let w = createCampaign(21).regions["8,14"];
  w.pendingStart = false;
  w.training = true;
  w.nodes[w.entry].power = 100;
  for (let i = 0; i < 80; i++) w = settleTurn(w);
  expect(w.nodes[w.entry].power).toBe(100);
});
it("失守迁入的新房间立即可用，不会首次开格重新布雷吞掉角色", () => {
  let c = createCampaign(21),
    w = c.regions[c.active];
  w.pendingStart = false;
  w.nodes[w.entry].power = 1;
  w.levels.lin = 3;
  w.packets = [
    {
      id: 1,
      owner: "enemy",
      kind: "attack",
      amount: 12,
      path: [w.entry],
      step: -1,
      position: w.entry + 1,
      target: w.entry,
    },
  ];
  c = actCampaign(c, "flag", w.entry, "lin");
  const person = findRole(c, "lin"),
    dest = c.regions[person.key];
  expect(dest.pendingStart).toBe(false);
  expect(dest.mines[person.index]).toBe(0);
  expect(c.events.some((e) => e.kind === "migration")).toBe(true);
  expect(restoreCampaign(JSON.stringify(c))).not.toBeNull();
});
it("跨区派队不允许重复透支同一条线路", () => {
  let c = navigateRegion(createCampaign(21), "north");
  c.regions["8,14"].nodes[c.regions["8,14"].entry].power = 100;
  c = orderRegion(c, "8,14", "8,13");
  const next = orderRegion(c, "8,14", "8,13");
  expect(next.orders).toHaveLength(1);
});
it("同层每六个清区渐进变大，已有房间不被重新生成", () => {
  expect([0, 6, 12, 18, 80].map((n) => roomDifficulty(n, 1).size)).toEqual([
    7, 9, 11, 13, 13,
  ]);
  const c = createCampaign(21);
  c.completed = Object.keys(c.layout.rooms).slice(0, 6);
  const next = navigateRegion(c, "north");
  expect(next.regions[next.active].size).toBe(9);
  expect(next.regions["8,14"]).toEqual(c.regions["8,14"]);
});
it("六种房型的雷密度按真实地面计算，首击和已有角色都安全", () => {
  for (let shape = 0; shape < 6; shape++)
    for (let seed = 1; seed <= 5; seed++) {
      const w = createCampaign(seed).regions["8,14"];
      w.floor = roomMask(7, shape);
      const start = w.floor.findIndex(Boolean),
        board = generateRoomBoard(w, start);
      const count = w.floor.filter(Boolean).length;
      expect(board.mines.reduce((a, v) => a + v, 0)).toBe(
        Math.max(2, Math.round(count * 0.12)),
      );
      expect(board.mines[start]).toBe(0);
      expect(board.mines[w.entry]).toBe(0);
      expect(board.mines.every((m, i) => !m || w.floor[i])).toBe(true);
    }
});
it("失守后用共享库存恢复角色，清扫另一房间即可结算收复，培养保留", () => {
  let c = createCampaign(21),
    w = c.regions[c.active],
    lost = c.active;
  w.pendingStart = false;
  w.revealed.fill(1);
  w.supplies = 400;
  w.levels.lin = 2;
  w.nodes[w.entry].power = 1;
  w.packets = [
    {
      id: 1,
      owner: "enemy",
      kind: "attack",
      amount: 20,
      path: [w.entry],
      step: -1,
      position: w.entry + 1,
      target: w.entry,
    },
  ];
  c = actCampaign(c, "flag", w.entry, "lin");
  const refuge = findRole(c, "lin").key;
  expect(c.occupiers[lost]).toBe("enemy");
  for (let n = 0; n < 5; n++) c = trainCampaign(c, "lin");
  expect(c.regions[refuge].levels.lin).toBe(7);
  c = orderRegion(c, refuge, lost);
  c.active = refuge;
  const safe = c.regions[refuge];
  safe.pendingStart = false;
  safe.mines.fill(0);
  safe.revealed = safe.floor.slice();
  c = actCampaign(c, "open", safe.entry, "lin");
  expect(c.occupiers[lost]).toBe("player");
  expect(c.regions[lost].notice.text).toContain("已收复");
  expect(findRole(c, "lin").key).toBe(refuge);
  expect(c.events.some((e) => e.kind === "reclaimed")).toBe(true);
});
