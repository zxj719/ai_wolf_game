import { describe, it, expect } from "vitest";
import { createWorld, actOnWorld, settleTurn } from "../bridgeWorld";
import { createCampaign, actCampaign } from "../campaignEngine";
import { extendTrace, prepareConnection } from "../routeDrawing";

function training() {
  const w = createWorld(21);
  w.mines.fill(0);
  w.mines[17] = 1;
  w.mines[32] = 1;
  w.revealed = w.mines.map((m) => (m ? 0 : 1));
  w.entry = 22;
  w.loot.fill(0);
  w.nodes = {
    22: { owner: "player", kind: "role", role: "lin", name: "林渡", power: 18 },
  };
  return w;
}
describe("自由首击", () => {
  it("任意有效格都能作为首击，首击安全，角色落在所选格而不是中央", () => {
    for (const choice of ["first", "last", "mine"]) {
      const c = createCampaign(21),
        w = c.regions[c.active];
      expect(w.revealed.some(Boolean)).toBe(false);
      const candidates = w.floor.flatMap((v, i) => (v ? [i] : []));
      const i =
        choice === "first"
          ? candidates[0]
          : choice === "last"
            ? candidates.at(-1)
            : w.mines.findIndex((m, j) => m && w.floor[j]);
      const chosen = i < 0 ? candidates[0] : i;
      const next = actCampaign(c, "open", chosen, "lin").regions[c.active];
      expect(next.pendingStart).toBe(false);
      expect(next.mines[chosen]).toBe(0);
      expect(next.revealed[chosen]).toBe(1);
      expect(next.explosions).toHaveLength(0);
      expect(next.nodes[chosen].role).toBe("lin");
    }
  });
  it("首击前插旗不锁定起点，取消旗后仍可自由选择", () => {
    let c = createCampaign(21);
    const w = c.regions[c.active],
      i = w.floor.findIndex(Boolean);
    c = actCampaign(c, "flag", i, "lin");
    expect(c.regions[c.active].pendingStart).toBe(true);
    c = actCampaign(c, "flag", i, "lin");
    c = actCampaign(c, "open", i, "lin");
    expect(c.regions[c.active].mines[i]).toBe(0);
  });
});
describe("手势路线、数字收益与运输表现", () => {
  it("沿鼠标扫过的直线插值，允许回退，不穿越地雷或凭空转弯", () => {
    const w = training();
    expect(extendTrace(w, [22], 25)).toEqual([22, 23, 24, 25]);
    expect(extendTrace(w, [22, 23, 24, 25], 23)).toEqual([22, 23]);
    expect(extendTrace(w, [22], 17)).toEqual([22]);
    expect(extendTrace(w, [22], 30)).toEqual([22]);
  });
  it("1+2+2 带来5势力，三格桥加驻扎消耗6，预览不修改真实状态", () => {
    const w = training(),
      before = structuredClone(w),
      p = prepareConnection(w, [22, 23, 24, 25]);
    expect(p.valid).toBe(true);
    expect(p.gain).toBe(5);
    expect(p.cost).toBe(6);
    expect(p.world.nodes[22].power).toBe(17);
    expect(p.world.nodes[25].power).toBe(1);
    expect(w).toEqual(before);
    expect(p.world.turn).toBe(0);
  });
  it("数字格只领取一次，资源不足时路线整笔拒绝、不留下半条桥", () => {
    const w = training();
    w.routeClaimed = Array(49).fill(0);
    w.routeClaimed[23] = 1;
    expect(prepareConnection(w, [22, 23, 24, 25]).gain).toBe(4);
    w.nodes[22].power = 0;
    w.routeClaimed.fill(1);
    expect(prepareConnection(w, [22, 23, 24, 25]).valid).toBe(false);
    expect(w.bridges).toEqual({});
  });
  it("教学可打通：补给三回合抵达，随后通过同一手势击败红色入侵者", () => {
    let w = prepareConnection(training(), [22, 23, 24, 25]).world;
    w = settleTurn(w);
    expect(w.packets[0].position).toBe(23);
    expect(w.deliveries).toHaveLength(0);
    w = settleTurn(w);
    expect(w.packets[0].position).toBe(24);
    w = settleTurn(w);
    expect(w.deliveries[0]).toMatchObject({ from: 24, to: 25, amount: 1 });
    w = settleTurn(w);
    expect(w.nodes[25].power).toBe(7);
    w.nodes[26] = { owner: "enemy", kind: "raider", name: "入侵者", power: 1 };
    const attack = prepareConnection(w, [25, 26]);
    expect(attack.valid).toBe(true);
    expect(attack.attack).toBe(true);
    w = actOnWorld(attack.world, "open", 22, "lin");
    expect(w.nodes[26].owner).toBe("player");
    expect(w.deliveries.some((p) => p.to === 26)).toBe(true);
  });
});
