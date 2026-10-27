import { describe, expect, it } from "vitest";
import {
  createLayout,
  roomMask,
  hasFloor,
  roomTotal,
  isRoomClear,
} from "../roomLayout";
import {
  createCampaign,
  navigateRegion,
  actCampaign,
  restoreCampaign,
  homePreview,
  planCampaign,
} from "../campaignEngine";
import { createWorld, settleTurn } from "../bridgeWorld";

describe("独立房间与整体轮廓", () => {
  it("灯塔包含超过一百间房，四向图全部连通且不是矩形填满", () => {
    const l = createLayout(42, 1),
      seen = new Set([l.start]),
      queue = [l.start];
    while (queue.length) {
      const [x, y] = queue.shift().split(",").map(Number);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const k = `${x + dx},${y + dy}`;
        if (l.rooms[k] && !seen.has(k)) {
          seen.add(k);
          queue.push(k);
        }
      }
    }
    expect(seen.size).toBe(Object.keys(l.rooms).length);
    expect(seen.size).toBeGreaterThan(100);
    expect(seen.size).toBeLessThan(l.width * l.height);
    expect(l.name).toBe("归航灯塔");
  });
  it("所有房间形态都连通，保留4×4建家空间，并有墙外空白", () => {
    for (const size of [7, 11, 15, 19, 23])
      for (let shape = 0; shape < 6; shape++) {
        const mask = roomMask(size, shape),
          start = mask.findIndex(Boolean),
          seen = new Set([start]),
          queue = [start];
        while (queue.length) {
          const i = queue.shift(),
            x = i % size,
            y = Math.floor(i / size);
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            const nx = x + dx,
              ny = y + dy,
              j = ny * size + nx;
            if (
              nx >= 0 &&
              nx < size &&
              ny >= 0 &&
              ny < size &&
              mask[j] &&
              !seen.has(j)
            ) {
              seen.add(j);
              queue.push(j);
            }
          }
        }
        expect(seen.size).toBe(mask.filter(Boolean).length);
        expect(mask).toContain(0);
        const lo = Math.floor(size / 2) - 1;
        for (let y = lo; y < lo + 4; y++)
          for (let x = lo; x < lo + 4; x++) expect(mask[y * size + x]).toBe(1);
      }
  });
  it("方向操作立即换棋盘，回去保留旗帜、建筑、原料且不耗回合", () => {
    let c = createCampaign(42),
      origin = c.active,
      w = c.regions[origin];
    const tile = w.floor.findIndex((v, i) => v && !w.revealed[i]);
    c = actCampaign(c, "flag", tile, "lin");
    const saved = structuredClone(c.regions[origin]),
      turn = c.turn;
    c = navigateRegion(c, "north");
    expect(c.active).not.toBe(origin);
    expect(Object.keys(c.regions)).toHaveLength(2);
    expect(c.regions[c.active].seed).not.toBe(saved.seed);
    c = navigateRegion(c, "south");
    expect(c.active).toBe(origin);
    expect(c.regions[origin]).toEqual(saved);
    expect(c.turn).toBe(turn);
  });
  it("墙外不能点、标记、建桥或建家；清区不包含墙外", () => {
    let c = createCampaign(42),
      w = c.regions[c.active],
      wall = w.floor.indexOf(0);
    expect(actCampaign(c, "open", wall, "lin").turn).toBe(0);
    expect(actCampaign(c, "flag", wall, "lin").turn).toBe(0);
    w.revealed = w.floor.map((v, i) => (v && !w.mines[i] ? 1 : 0));
    expect(isRoomClear(w)).toBe(true);
    expect(homePreview(c, "lin", wall).valid).toBe(false);
    expect(
      planCampaign(c, w.entry, wall, "camp").regions[c.active].nodes[wall],
    ).toBeUndefined();
    for (let i = 0; i < 16; i++) w = settleTurn(w);
    expect(Object.keys(w.nodes).every((i) => hasFloor(w, Number(i)))).toBe(
      true,
    );
  });
  it("旧版九区存档升级为大地图，原房间、家和队伍不丢失", () => {
    const w = createWorld(21);
    w.supplies = 99;
    const old = {
      version: 3,
      seed: 21,
      depth: 1,
      active: "1,1",
      regions: { "1,1": w },
      occupiers: { "1,1": "player" },
      completed: [],
      macroTurn: 0,
      turn: 5,
      orders: [{ id: 1, from: "1,1", path: ["1,0"], step: 0, amount: 3 }],
      orderId: 1,
      homes: {
        lin: { region: "1,1", anchor: w.entry, tiles: [w.entry], size: 3 },
      },
      archive: [],
      celebration: null,
    };
    const c = restoreCampaign(JSON.stringify(old));
    expect(c.version).toBe(4);
    expect(roomTotal(c)).toBeGreaterThan(100);
    expect(c.regions["8,13"].supplies).toBe(99);
    expect(c.homes.lin.region).toBe("8,13");
    expect(c.orders[0].path).toEqual(["8,12"]);
    expect(restoreCampaign(JSON.stringify(c))).toEqual(c);
  });
});
