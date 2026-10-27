import { describe, expect, it } from "vitest";
import {
  createExpedition,
  expeditionMove,
  nextSector,
  restoreExpedition,
} from "../expeditionEngine";

describe("地下回响：探索规则", () => {
  it("相同种子重建相同地图，入口九宫格安全", () => {
    const a = createExpedition(42);
    expect(a.mines).toEqual(createExpedition(42).mines);
    for (const i of [30, 31, 32, 39, 40, 41, 48, 49, 50])
      expect(a.mines[i]).toBe(0);
    expect(a.revealed.every((v) => !v)).toBe(true);
    expect(expeditionMove(a, "open", 0).revealed.every((v) => !v)).toBe(true);
  });
  it("安全开格获得物资，重复点击不能重复领取", () => {
    const a = expeditionMove(createExpedition(42), "open", 40);
    expect(a.revealed[40]).toBe(1);
    expect(a.supplies).toBeGreaterThan(0);
    expect(expeditionMove(a, "open", 40).supplies).toBe(a.supplies);
  });
  it("插旗保护格子；踩雷仅造成局部损失，仍可继续", () => {
    const initial = expeditionMove(createExpedition(42), "open", 40);
    const mine = initial.mines.findIndex(Boolean);
    const flagged = expeditionMove(initial, "flag", mine);
    expect(expeditionMove(flagged, "open", mine)).toBe(flagged);
    const boom = expeditionMove(initial, "open", mine);
    expect(boom.blasts[mine]).toBe(1);
    expect(boom.supplies).toBeLessThanOrEqual(initial.supplies);
    expect(boom.status).toBe("exploring");
    expect(expeditionMove(boom, "open", mine)).toBe(boom);
    const safe = boom.mines.findIndex((v, i) => !v && !boom.revealed[i]);
    expect(expeditionMove(boom, "open", safe).revealed[safe]).toBe(1);
  });
  it("数字格按已确认雷位展开；误标仍会爆炸", () => {
    const a = createExpedition(4);
    a.mines = Array(81).fill(0);
    a.mines[0] = 1;
    a.revealed[10] = 1;
    const flagged = expeditionMove(a, "flag", 0);
    expect(expeditionMove(flagged, "open", 10).revealed[1]).toBe(1);
    const wrong = expeditionMove(a, "flag", 1);
    expect(expeditionMove(wrong, "open", 10).blasts[0]).toBe(1);
  });
  it("未完成不能跳区；清理后保留原料与居民并生成新区域", () => {
    let a = createExpedition(27);
    expect(nextSector(a)).toBe(a);
    a = expeditionMove(a, "open", 40);
    for (let i = 0; i < 81; i++)
      if (!a.mines[i]) a = expeditionMove(a, "open", i);
    expect(a.status).toBe("cleared");
    expect(a.people).toBeGreaterThan(3);
    const b = nextSector(a);
    expect(b.sector).toBe(2);
    expect(b.supplies).toBe(a.supplies);
    expect(b.people).toBe(a.people);
    expect(b.previous.revealed).toEqual(a.revealed);
    expect(b.mines).not.toEqual(a.mines);
  });
  it("存档可恢复，损坏或未知版本存档不进入游戏", () => {
    const a = expeditionMove(createExpedition(99), "open", 40);
    expect(restoreExpedition(JSON.stringify(a))).toEqual(a);
    expect(restoreExpedition("{bad")).toBeNull();
    expect(restoreExpedition(JSON.stringify({ ...a, version: 99 }))).toBeNull();
    expect(restoreExpedition(JSON.stringify({ ...a, flags: [1] }))).toBeNull();
    expect(restoreExpedition(JSON.stringify({ ...a, people: -2 }))).toBeNull();
  });
});
