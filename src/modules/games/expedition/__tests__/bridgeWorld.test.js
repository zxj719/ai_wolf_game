import { describe, expect, it } from "vitest";
import {
  createWorld,
  actOnWorld,
  extendBridge,
  advanceLayer,
  panWorld,
  canDescend,
  settleTurn,
  restoreWorld,
} from "../bridgeWorld";

function openWorld() {
  const w = createWorld(21);
  w.revealed = w.mines.map((m) => (m ? 0 : 1));
  w.nodes[w.entry].power = 20;
  return w;
}
describe("连续地图与回合", () => {
  it("首层较小，四向平移不推进回合；没有清扫完不能下层", () => {
    const w = createWorld(21);
    expect(w.size).toBe(7);
    const moved = panWorld(w, "north");
    expect(moved.camera.y).toBe(0);
    expect(moved.turn).toBe(0);
    expect(advanceLayer(w)).toBe(w);
  });
  it("标记、取消标记、重复点击都推进一个回合，不重复赚取势力", () => {
    let w = createWorld(21);
    w = actOnWorld(w, "open", w.entry, "lin");
    const index = w.revealed.findIndex((v, i) => !v && !w.blasts[i]);
    const a = actOnWorld(w, "flag", index, "lin");
    const b = actOnWorld(a, "flag", index, "lin");
    expect(b.turn).toBe(w.turn + 2);
    expect(b.nodes[w.entry].power).toBe(w.nodes[w.entry].power + 2);
    const c = actOnWorld(b, "open", w.entry, "lin");
    expect(c.turn).toBe(b.turn + 1);
  });
  it("清扫完成且到过四向边界后，下层变大，旧层归档", () => {
    let w = openWorld();
    expect(canDescend(w)).toBe(false);
    for (const direction of ["north", "south", "west", "east"])
      w = panWorld(w, direction);
    expect(canDescend(w)).toBe(true);
    const next = advanceLayer(w);
    expect(next.size).toBeGreaterThan(w.size);
    expect(next.depth).toBe(2);
    expect(next.archive).toHaveLength(1);
  });
});
describe("桥梁与逐格补给", () => {
  it("通行消耗1；驻扎额外消耗3，营地获得初始势力1", () => {
    const w = openWorld();
    const target = w.entry + 1;
    const a = extendBridge(w, w.entry, target, "pass");
    expect(a.nodes[w.entry].power).toBe(19);
    expect(a.bridges[target].parent).toBe(w.entry);
    expect(a.nodes[target]).toBeUndefined();
    const b = extendBridge(a, target, target, "camp");
    expect(b.nodes[w.entry].power).toBe(16);
    expect(b.nodes[target].power).toBe(1);
    expect(b.turn).toBe(0);
  });
  it("三格距离的补给恰好三回合到达，不瞬移，双方营地每回合增长1", () => {
    let w = openWorld();
    // Use a known cleared straight corridor for transport testing.
    const path = [w.entry + 1, w.entry + 2, w.entry + 3];
    for (const p of path) {
      w.mines[p] = 0;
      w.revealed[p] = 1;
    }
    w = extendBridge(w, w.entry, path[0], "pass");
    w = extendBridge(w, path[0], path[1], "pass");
    w = extendBridge(w, path[1], path[2], "camp");
    w = settleTurn(w);
    expect(w.nodes[path[2]].power).toBe(2);
    expect(w.packets[0].position).toBe(path[0]);
    w = settleTurn(w);
    expect(w.nodes[path[2]].power).toBe(3);
    expect(w.packets[0].position).toBe(path[1]);
    w = settleTurn(w);
    expect(w.nodes[path[2]].power).toBe(5);
  });
  it("角色势力不高于营地加在途补给时不再发货", () => {
    let w = openWorld();
    w = extendBridge(w, w.entry, w.entry + 1, "camp");
    w.nodes[w.entry].power = 1;
    w.nodes[w.entry + 1].power = 4;
    w = settleTurn(w);
    expect(w.packets).toHaveLength(0);
    expect(w.nodes[w.entry].power).toBe(2);
  });
  it("不能穿越地雷、未知格、对向桥，桥格不能分叉", () => {
    let w = openWorld();
    w = extendBridge(w, w.entry, w.entry + 1, "pass");
    w = extendBridge(w, w.entry + 1, w.entry + 2, "pass");
    const candidate = w.entry + 1 - w.size;
    w.mines[candidate] = 0;
    w.revealed[candidate] = 1;
    const denied = extendBridge(w, w.entry + 1, candidate, "pass");
    expect(denied.bridges[candidate]).toBeUndefined();
    expect(denied.nodes[w.entry].power).toBe(w.nodes[w.entry].power);
  });
  it("存档恢复不丢失在途运输和地图窗口", () => {
    const w = settleTurn(openWorld());
    expect(restoreWorld(JSON.stringify(w))).toEqual(w);
    expect(restoreWorld("{bad")).toBeNull();
    expect(restoreWorld(JSON.stringify({ ...w, version: 99 }))).toBeNull();
  });
});
