import { buildNeighbors, computeNumbers } from "../minesweeper/mineEngine";
import { hasFloor } from "./roomLayout";
import { extendBridge } from "./bridgeWorld";
import { growthCapacity } from './campaignBalance';

const adjacent = (a, b, n) =>
  Math.abs((a % n) - (b % n)) +
    Math.abs(Math.floor(a / n) - Math.floor(b / n)) ===
  1;
const walkable = (w, i) =>
  Number.isInteger(i) &&
  i >= 0 &&
  i < w.size * w.size &&
  hasFloor(w, i) &&
  w.revealed[i] &&
  !w.mines[i];

// Mouse tracing can skip cells at high speed. Interpolate only a straight sweep;
// never invent a turn or route through a wall on the player's behalf.
export function extendTrace(w, path, target) {
  if (!path.length || !walkable(w, target)) return path;
  const previous = path.indexOf(target);
  if (previous >= 0) return path.slice(0, previous + 1);
  let from = path.at(-1);
  if (w.nodes[from]?.owner === "enemy") return path;
  const dx = (target % w.size) - (from % w.size),
    dy = Math.floor(target / w.size) - Math.floor(from / w.size);
  if (dx && dy) return path;
  const step = dx ? Math.sign(dx) : Math.sign(dy) * w.size,
    addition = [];
  while (from !== target) {
    from += step;
    if (
      !walkable(w, from) ||
      path.includes(from) ||
      (from !== target && w.nodes[from]?.owner === "enemy")
    )
      return path;
    addition.push(from);
  }
  return [...path, ...addition];
}

export function prepareConnection(world, path) {
  const fail = (reason) => ({ valid: false, reason, gain: 0, cost: 0 });
  if (path.length < 2)
    return fail("点选大本营，划过相邻安全格，点击终点驻扎。");
  if (world.pendingStart) return fail("先在左侧任选一格开始探索。");
  if (world.nodes[path[0]]?.owner !== "player")
    return fail("路线必须从我方大本营或营地出发。");
  if (new Set(path).size !== path.length)
    return fail("路线不能重复绕过同一格。");
  let s = structuredClone(world),
    gain = 0,
    cost = 0;
  s.routeClaimed ??= Array(s.size * s.size).fill(0);
  const nums = computeNumbers(s.mines, buildNeighbors(s.size, s.size));
  for (let j = 1; j < path.length; j++) {
    const i = path[j],
      from = path[j - 1],
      last = j === path.length - 1;
    if (!walkable(s, i) || !adjacent(from, i, s.size))
      return fail("沿相邻安全格划线，不能穿过未知、墙壁或地雷。");
    if (s.nodes[i]?.owner === "enemy") {
      if (!last) return fail("敌方据点只能作为进攻终点。");
      const next = extendBridge(s, from, i, "pass");
      if (next.packets.length === s.packets.length)
        return fail(next.notice.text);
      const packet = next.packets.at(-1);
      const defense = Math.max(s.nodes[i].power, Math.min(growthCapacity(s,s.nodes[i]), s.nodes[i].power + packet.path.length));
      const forecast = {
        amount: packet.amount,
        turns: packet.path.length,
        defense,
        favorable: packet.amount > defense,
      };
      const reason = `派出 ${packet.amount} · ${packet.path.length} 回合抵达 · 敌方预计 ≥${defense} · ${forecast.favorable ? "有望占领" : "不足以占领，先积累补给"}（未计敌方增援）`;
      next.notice = {
        kind: "safe",
        text: `连接队 ${packet.amount} 已出发 · ${packet.path.length} 回合后接敌 · 出发点留守 1。`,
      };
      return {
        valid: true,
        world: next,
        gain,
        cost: cost + 1,
        attack: true,
        forecast,
        reason,
      };
    }
    if (s.nodes[i]) return fail("选择空白地面驻扎，或以敌方据点为进攻终点。");
    if (
      s.bridges[i] &&
      (s.bridges[i].owner !== "player" || s.bridges[i].parent !== from)
    )
      return fail("已有桥梁只能沿原方向通行。");
    if (!s.routeClaimed[i]) {
      const n = nums[i];
      s.nodes[path[0]].power += n;
      gain += n;
      s.routeClaimed[i] = 1;
    }
    if (!s.bridges[i]) {
      const next = extendBridge(s, from, i, "pass");
      if (!next.bridges[i]) return fail(next.notice.text);
      s = next;
      cost++;
    }
    if (last) {
      const next = extendBridge(s, i, i, "camp");
      if (!next.nodes[i])
        return fail("驻扎还需要 3 势力；缩短路线或途经更多数字格。");
      s = next;
      cost += 3;
    }
  }
  s.notice = {
    kind: "safe",
    text: `营地建立 · 数字 +${gain} 势力 · 路线与驻扎消耗 ${cost} · 补给将逐格抵达。`,
  };
  return {
    valid: true,
    world: s,
    gain,
    cost,
    attack: false,
    reason: `途经数字 +${gain} · 建设 −${cost} · 点击终点驻扎`,
  };
}
