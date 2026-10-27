import { describe, it, expect } from "vitest";
import { createWorld, settleTurn, extendBridge } from "../bridgeWorld";
import { prepareConnection } from "../routeDrawing";

function arena() {
  const w = createWorld(21);
  w.mines.fill(0);
  w.revealed.fill(1);
  w.loot.fill(0);
  w.nodes = {
    22: { owner: "player", kind: "role", role: "lin", name: "林渡", power: 10 },
    25: { owner: "enemy", kind: "raider", name: "灰帆", power: 2 },
  };
  return w;
}
describe("进攻风险与真实对抗", () => {
  it("留守1并支付延伸成本，预告三回合后敌方增长，抵达才结算", () => {
    const w = arena();
    const p = prepareConnection(w, [22, 23, 24, 25]);
    expect(p.valid).toBe(true);
    expect(p.forecast).toMatchObject({
      amount: 6,
      turns: 3,
      defense: 5,
      favorable: true,
    });
    expect(p.world.nodes[22].power).toBe(1);
    let next = settleTurn(p.world);
    expect(next.nodes[25].owner).toBe("enemy");
    next = settleTurn(next);
    expect(next.nodes[25].owner).toBe("enemy");
    next = settleTurn(next);
    expect(next.nodes[25]).toMatchObject({ owner: "player", power: 1 });
    expect(next.deliveries[0]).toMatchObject({
      kind: "attack",
      captured: true,
    });
  });
  it("预测不足时明确提示，避免把抵达前的自然增长漏算", () => {
    const w = arena();
    w.nodes[25].power = 9;
    const p = prepareConnection(w, [22, 23, 24, 25]);
    expect(p.forecast.favorable).toBe(false);
    expect(p.reason).toContain("不足以占领");
  });
  it("敌人能进攻接有桥梁的我方营地，不再成为免战格", () => {
    const w = arena();
    w.turn = 14;
    w.nodes[25].power = 20;
    w.nodes[24] = { owner: "player", kind: "camp", name: "营地", power: 2 };
    w.bridges[24] = { owner: "player", parent: 23 };
    const next = settleTurn(w);
    expect(
      next.packets.some((p) => p.owner === "enemy" && p.target === 24),
    ).toBe(true);
  });
  it("同一路线有在途进攻队时不能重复派队耗空据点", () => {
    const w = arena();
    w.nodes[24] = { owner: "player", kind: "camp", name: "营地", power: 30 };
    const sent = extendBridge(w, 24, 25, "pass");
    const again = extendBridge(sent, 24, 25, "pass");
    expect(again.packets).toHaveLength(1);
    expect(again.nodes[24].power).toBe(sent.nodes[24].power);
    sent.nodes[26] = { owner: 'player', kind: 'camp', name: '另一座营地', power: 8 };
    expect(extendBridge(sent, 26, 25, 'pass').packets).toHaveLength(2);
  });
});
