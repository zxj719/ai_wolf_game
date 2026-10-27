import {
  createLayout,
  roomMask,
  hasFloor,
  isRoomClear,
  clearedCount,
  roomExit,
  roomTotal,
  ROOM_SHAPES,
} from "./roomLayout";
import {
  createWorld,
  actOnWorld,
  settleTurn,
  extendBridge,
  focusWorld,
  restoreWorld,
} from "./bridgeWorld";
import {
  roomDifficulty,
  growthCapacity,
  trainingCost,
  remoteExplorationReward,
  explorationBonus,
  relocationCost,
} from "./campaignBalance";
import { createJourney, journeyMode, syncJourney } from "./journeyProgress";

export const CAMPAIGN_SAVE = "zhaxiaoji-connected-world-v4";
export const HOME_SIZE = { lin: 1, cen: 1 };

const clone = (s) => structuredClone(s);
const coord = (k) => k.split(",").map(Number);
const distance = (a, b) => {
  const [x, y] = coord(a),
    [u, v] = coord(b);
  return Math.abs(x - u) + Math.abs(y - v);
};
const keySeed = (seed, k) => {
  const [x, y] = coord(k);
  return (seed + x * 673 + y * 1877) >>> 0;
};
export function createCampaign(seed, depth = 1, options = {}) {
  const layout = createLayout(seed, depth),
    key = layout.start;
  return {
    version: 4,
    ...(options.guided ? { journey: createJourney() } : {}),
    layout,
    seed: seed >>> 0,
    depth,
    active: key,
    regions: { [key]: makeRoom(seed, depth, key, layout.rooms[key].shape) },
    occupiers: { [key]: "player" },
    completed: [],
    turn: 0,
    macroTurn: 0,
    orders: [],
    orderId: 0,
    homes: {},
    archive: [],
    celebration: null,
    events: [],
    alert: null,
    announcement: "清扫，重建，连接。这里的每一片安全地面，都可以成为家。",
  };
}
export function regionForce(c, key, owner = "player") {
  return Object.values(c.regions[key]?.nodes || {})
    .filter((n) => n.owner === owner)
    .reduce((sum, n) => sum + n.power, 0);
}
export function findRole(c, role) {
  for (const [key, w] of Object.entries(c.regions)) {
    const entry = Object.entries(w.nodes).find(
      ([, n]) => n.role === role && n.owner === "player",
    );
    if (entry) return { key, index: Number(entry[0]), node: entry[1] };
  }
  return null;
}
function makeRoom(seed, depth, key, shape, completed = 0) {
  const difficulty = roomDifficulty(completed, depth);
  const w = createWorld(keySeed(seed, key), depth, difficulty);
  w.danger = difficulty.danger;
  w.occupied = false;
  w.explorationTurns = 0;
  w.earned = 0;
  w.losses = 0;
  w.floor = roomMask(w.size, shape);
  w.shapeName = ROOM_SHAPES[shape];
  w.pendingStart = true;
  w.revealed.fill(0);
  w.routeClaimed = Array(w.size * w.size).fill(0);
  w.notice = {
    kind: "info",
    text: "任选一个格子开始。第一次开格安全。",
  };
  for (let i = 0; i < w.floor.length; i++)
    if (!w.floor[i]) {
      w.mines[i] = 0;
      w.loot[i] = 0;
      w.revealed[i] = 0;
    }
  // Keep a rescue reachable even if the generated square placed it outside the room.
  if (!w.loot.includes(2)) {
    const p = w.floor.findIndex((v, i) => v && !w.mines[i] && i !== w.entry);
    if (p >= 0) w.loot[p] = 2;
  }
  return w;
}
function newRegion(c, key) {
  const w = makeRoom(
    c.seed,
    c.depth,
    key,
    c.layout.rooms[key].shape,
    c.completed.length,
  );
  w.nodes = {};
  w.journal = [
    {
      id: `arrival-${key}`,
      speaker: "林渡",
      turn: 0,
      depth: c.depth,
      text: "隧道没有在地图边缘结束。我们跨过上一处灯火，新的空间仍在同一层里。",
    },
  ];
  return w;
}
export function switchRegion(state, key) {
  if (journeyMode(state) === "defense" && key !== state.journey.home) return state;
  if (!state.layout.rooms[key]) return state;
  const c = clone(state);
  if (!c.regions[key] && distance(c.active, key) !== 1) {
    c.announcement = "先沿相邻的隧道探索，不能直接越过未到达的区域。";
    return c;
  }
  if (!c.regions[key]) c.regions[key] = newRegion(c, key);
  c.active = key;
  c.announcement = `已移动至区域 ${coord(key)
    .map((v) => v + 1)
    .join(" · ")}；已进入独立房间，不推进回合。`;
  return c;
}
export function navigateRegion(state, direction) {
  const to = roomExit(state, direction);
  if (!to)
    return {
      ...state,
      announcement: "这面墙没有通往相邻房间的门。查看全层地图寻找其他通路。",
    };
  return switchRegion(state, to);
}
export function focusCampaign(state, index) {
  const c = clone(state);
  c.regions[c.active] = focusWorld(c.regions[c.active], index);
  return c;
}
function relocate(c, role, from) {
  const choices = Object.keys(c.regions)
    .filter((k) => k !== from && c.occupiers[k] !== "enemy")
    .sort(
      (a, b) =>
        Number(regionForce(c, a, "enemy") > 0) -
          Number(regionForce(c, b, "enemy") > 0) ||
        distance(a, from) - distance(b, from),
    );
  let to = choices[0];
  if (!to) {
    to = Object.keys(c.layout.rooms)
      .filter((k) => k !== from && c.occupiers[k] !== "enemy")
      .sort((a, b) => distance(a, from) - distance(b, from))[0];
  }
  if (!to) to = Object.keys(c.layout.rooms).find((k) => k !== from);

  if (!c.regions[to]) c.regions[to] = newRegion(c, to);
  const w = c.regions[to],
    pos = w.entry;
  w.levels[role] = c.regions[from].levels[role];
  const free = w.mines.findIndex((m, i) => hasFloor(w, i) && !m && !w.nodes[i]);
  const p = free >= 0 ? free : pos;
  w.pendingStart = false;
  w.entry = p;
  w.mines[p] = 0;
  w.flags[p] = 0;
  w.revealed[p] = 1;
  w.nodes[p] = {
    owner: "player",
    kind: "role",
    role,
    name: role === "lin" ? "林渡" : "岑灯",
    power: 3,
  };
  c.occupiers[to] = "player";
  delete c.homes[role];
  w.journal.push({
    id: `migration-${role}-${c.macroTurn}-${w.turn}`,
    speaker: w.nodes[p].name,
    turn: w.turn,
    depth: c.depth,
    text: "家失去了，但人还在。桥的另一头接住了我们。等力量重新聚齐，我们会沿着那条路回去。",
  });
  c.announcement = `${w.nodes[p].name}被迫迁移至区域 ${coord(to)
    .map((v) => v + 1)
    .join(" · ")}。失去的区域可从邻区夺回。`;
  recordEvent(c, "migration", from, c.announcement, to);
  c.alert = {
    title: "灯灭了，人还在。",
    text: c.announcement,
    destination: to,
  };
}
function recordEvent(c, kind, key, text, destination) {
  c.events ??= [];
  c.events.push({
    kind,
    key,
    text,
    destination,
    turn: c.turn,
    macroTurn: c.macroTurn,
  });
  c.events = c.events.slice(-60);
}
function conquer(c, key, owner, force) {
  const w = c.regions[key];
  if (!w) return;
  const displaced = Object.values(w.nodes)
    .filter((n) => n.role && n.owner !== owner)
    .map((n) => n.role);
  if (owner === "player") {
    w.occupied = false;
    w.nodes = Object.fromEntries(
      Object.entries(w.nodes).filter(([, n]) => n.owner === "player"),
    );
    w.bridges = Object.fromEntries(
      Object.entries(w.bridges).filter(([, b]) => b.owner === "player"),
    );
    const target = w.nodes[w.entry] ?? Object.values(w.nodes)[0];
    if (target) target.power += Math.max(1, force);
    else
      w.nodes[w.entry] = {
        owner,
        kind: "camp",
        name: "收复前哨",
        power: Math.max(1, force),
      };
  } else {
    w.occupied = true;
    w.nodes = {
      [w.entry]: {
        owner,
        kind: "camp",
        name: "灰帆占领区",
        power: Math.max(
          6,
          Math.min(18 + w.depth * 2 + (w.danger || 0) * 2, force),
        ),
      },
    };
    w.bridges = {};
  }
  w.packets = [];
  c.occupiers[key] = owner;
  w.notice = {
    kind: owner === "player" ? "success" : "danger",
    text:
      owner === "player"
        ? "这间房已收复。驻军已撤去，前哨重新接上支援。"
        : "区域失守。保住人物，沿邻区的桥重新回来。",
  };
  if (owner === "player")
    w.journal.push({
      id: `reclaimed-${c.turn}-${c.macroTurn}`,
      speaker: "地下频道",
      turn: w.turn,
      depth: w.depth,
      text: "旧灯重新亮了。桥上留下的名字还在，我们沿着它回到了这里。",
    });
  recordEvent(
    c,
    owner === "player" ? "reclaimed" : "lost",
    key,
    owner === "player"
      ? "连接队收复了这间房，幸存的营地重新接上支援。"
      : "区域失守，灰帆留下驻军。可从相邻房间派队收复。",
  );
  if (owner === "enemy") for (const role of displaced) relocate(c, role, key);
}
function macroStep(c) {
  c.macroTurn++;
  for (const [key, w] of Object.entries(c.regions))
    if (c.occupiers[key] === "enemy") {
      for (const n of Object.values(w.nodes))
        if (n.owner === "enemy" && n.power < growthCapacity(w, n)) n.power++;
    }
  const pending = [];
  for (const order of c.orders) {
    order.step++;
    if (order.step < order.path.length) {
      pending.push(order);
      continue;
    }
    const key = order.path.at(-1),
      enemy = regionForce(c, key, "enemy"),
      ours = regionForce(c, key, "player");
    if (enemy > 0) {
      if (order.amount > enemy) {
        conquer(c, key, "player", order.amount - enemy);
        c.announcement = "跨区连接队已夺回失去的区域。";
      } else {
        let damage = order.amount;
        for (const n of Object.values(c.regions[key].nodes).filter(
          (n) => n.owner === "enemy",
        )) {
          const hit = Math.min(n.power, damage);
          n.power -= hit;
          damage -= hit;
        }
        c.announcement = "跨区连接队已抵达，敌方仍控制该区域。";
      }
    } else {
      const w = c.regions[key];
      const dest = Object.values(w.nodes).find((n) => n.owner === "player");
      if (dest) dest.power += order.amount;
      else if (order.amount >= 3) {
        w.nodes[w.entry] = {
          owner: "player",
          kind: "camp",
          name: "跨区前哨",
          power: order.amount - 2,
        };
        c.occupiers[key] = "player";
      }
      c.announcement = "跨区补给已抵达。";
    }
  }
  c.orders = pending;
}
export function orderRegion(state, from, to) {
  const c = clone(state);
  if (from === to || !c.regions[from] || !c.regions[to]) return c;
  if (c.completed.length === roomTotal(c)) {
    c.announcement =
      "本层清扫已结束，请带队进入下一层；不再排入没有回合可结算的新队伍。";
    return c;
  }
  if (distance(from, to) !== 1) {
    c.announcement = "跨区桥梁先连接相邻区域，每次只跨过一条区域边界。";
    return c;
  }
  if (c.orders.some((o) => o.from === from && o.path.at(-1) === to)) {
    c.announcement = "这条跨区线路已有队伍在途；先清扫一间房，让队伍抵达。";
    return c;
  }
  const source = Object.values(c.regions[from].nodes)
    .filter((n) => n.owner === "player")
    .sort((a, b) => b.power - a.power)[0];
  if (!source || source.power < 5) {
    c.announcement = "出发据点至少需要 5 势力。";
    return c;
  }
  const amount = source.power - 2;
  if (!Object.keys(c.regions[to].nodes).length && amount < 3) {
    c.announcement =
      "空白区域建立前哨至少需要 3 势力；出发据点需要至少 5 势力。";
    return c;
  }
  source.power -= amount + 1;
  c.orders.push({ id: ++c.orderId, from, path: [to], step: 0, amount });
  c.announcement = `已派出 ${amount} 跨区势力，连接消耗 1。再完成一个区域的清扫，队伍才会抵达。`;
  return c;
}
export function regionalPreview(c, from, to) {
  const source = Object.values(c.regions[from]?.nodes || {})
    .filter((n) => n.owner === "player")
    .sort((a, b) => b.power - a.power)[0];
  const enemy = regionForce(c, to, "enemy");
  return {
    amount: Math.max(0, (source?.power || 0) - 2),
    enemy,
    adjacent: distance(from, to) === 1,
  };
}
export function actCampaign(state, action, index, role) {
  if (journeyMode(state) === "defense" || state.journey?.scene) return state;
  const c = clone(state),
    active = c.active,
    before = c.regions[active],
    oldRole = findRole(c, role);
  const surveyOnly = journeyMode(c) === "survey";
  c.regions[active] = actOnWorld(before, action, index, role, { surveyOnly, allowLanding: journeyMode(c) !== "combined" });
  if (c.regions[active] === before || c.regions[active].turn === before.turn)
    return c;
  c.turn = (state.turn ?? 0) + 1;
  // One local action is one tactical turn for all already discovered regions.
  for (const key of Object.keys(c.regions))
    if (
      !surveyOnly && key !== active &&
      c.occupiers[key] !== "enemy" &&
      !c.regions[key].pendingStart
    )
      c.regions[key] = settleTurn(c.regions[key], { allowLanding: false });
  const now = c.regions[active];
  if (journeyMode(c) === "combined" && action === "flag") now.notice = { kind: "info", text: "标记更新 · 后方推进 1 回合。" };
  if (now.landings > before.landings)
    recordEvent(
      c,
      "invasion",
      active,
      "灰帆在当前房间空降。已有敌军仍会随行动回合扩张，查看红色据点。",
    );
  if (!surveyOnly && oldRole && oldRole.key !== active && !now.explosions.length) {
    const target = findRole(c, role);
    if (target) {
      const roomsAway = distance(target.key, active);
      const gain = remoteExplorationReward(
        now.latest.length,
        c.regions[target.key].levels[role],
        roomsAway,
      );
      target.node.power += gain;
      if (gain)
        now.notice = {
          kind: "safe",
          text: `清扫 ${now.latest.length} 格 · ${target.node.name}相距 ${roomsAway} 区，收到 ${gain} 势力${roomsAway > 1 ? "（远程衰减）" : ""}`,
        };
    }
  }
  // Surveying remains possible under occupation; clearing the final hostile sector
  // must still advance the strategic convoy that can liberate it.
  if (state.occupiers[active] === "enemy") {
    for (const [i, n] of Object.entries(now.nodes))
      if (n.owner === "player") {
        delete now.nodes[i];
        if (n.role && !findRole(c, n.role)) relocate(c, n.role, active);
      }
    c.announcement =
      "敌占区潜行清扫：清除未知不改变归属。完成清扫后，邻区连接队推进一回合。";
  }
  const oldCen = findRole(state, "cen");
  if (oldCen && oldCen.key !== active) {
    for (const n of Object.values(now.nodes))
      if (n.role === "cen") {
        delete n.role;
        n.kind = "camp";
        n.name = "获救居民";
      }
    now.journal = now.journal.filter((e) => e.id !== "rescue-cen");
  }
  const lost = [];
  for (const id of ["lin", "cen"]) {
    const old = findRole(state, id);
    if (old && !findRole(c, id)) lost.push({ id, key: old.key });
  }
  for (const key of new Set(lost.map((p) => p.key)))
    conquer(c, key, "enemy", Math.max(3, regionForce(c, key, "enemy")));
  for (const { id, key } of lost) if (!findRole(c, id)) relocate(c, id, key);
  // A rear camp can fall after its character has moved elsewhere, too.
  for (const [key, w] of Object.entries(c.regions)) {
    if (
      c.occupiers[key] !== "enemy" &&
      Object.values(state.regions[key]?.nodes || {}).some(
        (n) => n.owner === "player",
      ) &&
      !Object.values(w.nodes).some((n) => n.owner === "player") &&
      regionForce(c, key, "enemy") > 0
    ) {
      conquer(c, key, "enemy", regionForce(c, key, "enemy"));
    }
  }
  for (const [key, w] of Object.entries(c.regions))
    if (Object.values(w.nodes).some((n) => n.owner === "player"))
      c.occupiers[key] = "player";
  if (!c.completed.includes(active) && isRoomClear(now)) {
    c.completed.push(active);
    macroStep(c);
    c.celebration = {
      key: active,
      safe: clearedCount(now),
      macroTurn: c.macroTurn,
      turns: now.explorationTurns ?? now.turn,
      earned: now.earned,
      losses: now.losses || 0,
    };
    now.journal.push({
      id: `clear-${active}`,
      speaker: "林渡",
      turn: now.turn,
      depth: c.depth,
      text: c.journey ? "林渡擦掉了门上的危险记号。这块地可以留下来用了。" : reconnectionLine(c.completed.length, now.shapeName),
    });
  }
  return syncJourney(c);
}
function reconnectionLine(count, shape) {
  const milestone = {
    6: "六盏灯连成第一段路。岑灯把频道留着：后来的人，不必再独自摸黑。",
    12: "地图上的点开始连成线。有人问下一站在哪，我们终于能给出方向。",
    18: "桥已经长过我们能看见的地方。岑灯说，连接的意义，就是不必每一盏灯都亲自守着。",
  };
  return (
    milestone[count] ||
    {
      切角室: "拐角的墙后传来敲击声。我们接上灯，留下一条可以回来的路。",
      十字厅: "四条走廊在这里相遇。旧指路牌上，多了我们刚刚点亮的方向。",
      转角厅: "转过这道弯，电台终于不再只有杂音。有人记下了这间房的坐标。",
      横向长廊: "长廊的灯逐盏亮起。这次走到另一头，不再需要回头确认同伴还在。",
      纵向长廊: "一根线穿过窄廊。两端的人同时听到了对方的脚步。",
      "T 形厅": "岔路口留下两盏灯。一盏照向前方，另一盏留给后来的人。",
    }[shape] ||
    "这间房重新接上了灯。远处有人回了两下光。"
  );
}
export function planCampaign(state, from, to, mode) {
  const c = clone(state);
  if (c.occupiers[c.active] === "enemy") {
    c.announcement = "先从邻区收复该区域，才能重建桥梁与营地。";
    return c;
  }
  c.regions[c.active] = extendBridge(c.regions[c.active], from, to, mode);
  return c;
}
export function homePreview(c, role, anchor) {
  if (c.occupiers[c.active] === "enemy")
    return { valid: false, tiles: [], reason: "先收复区域，才能建立根据地。" };
  const w = c.regions[c.active],
    size = HOME_SIZE[role],
    r = Math.floor(anchor / w.size),
    col = anchor % w.size,
    tiles = [];
  if (!size || r + size > w.size || col + size > w.size)
    return {
      valid: false,
      tiles,
      reason: `根据地需要完整的 ${size}×${size} 空间。`,
    };
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) tiles.push((r + y) * w.size + col + x);
  const valid = tiles.every(
    (i) =>
      hasFloor(w, i) &&
      w.revealed[i] &&
      !w.mines[i] &&
      (!w.nodes[i] ||
        w.nodes[i].role === role ||
        w.nodes[i].homeRole === role) &&
      !w.bridges[i],
  );
  return {
    valid,
    tiles,
    reason: valid
      ? "这片安全空间可以建立根据地。"
      : "需要连续安全地面，且不能覆盖桥、其它营地或敌人。",
  };
}
export function establishHome(state, role, anchor) {
  const c = clone(state),
    preview = homePreview(c, role, anchor),
    person = findRole(c, role),
    w = c.regions[c.active],
    cost = HOME_SIZE[role] ** 2;
  const bank = c.regions[person?.key ?? c.active];
  if (!person || !preview.valid || bank.supplies < cost) {
    c.announcement = !person
      ? "先在地下找到这位角色。"
      : !preview.valid
        ? preview.reason
        : `根据地需要 ${cost} 原料（使用角色所在区域库存）。`;
    return c;
  }
  bank.supplies -= cost;
  const previous = c.homes[role];
  w.levels[role] = bank.levels[role];
  if (previous) {
    const old = c.regions[previous.region];
    for (const i of previous.tiles)
      if (old.nodes[i]?.homeRole === role) delete old.nodes[i];
  }
  delete c.regions[person.key].nodes[person.index];
  for (const i of preview.tiles)
    w.nodes[i] = {
      owner: "player",
      kind: "home",
      homeRole: role,
      name: `${person.node.name}的家`,
      power: 1,
    };
  w.nodes[anchor] = { ...person.node, homeRole: role };
  c.homes[role] = {
    region: c.active,
    anchor,
    tiles: preview.tiles,
    size: HOME_SIZE[role],
  };
  c.occupiers[c.active] = "player";
  c.announcement = `${person.node.name}的 ${HOME_SIZE[role]}×${HOME_SIZE[role]} 根据地建立。每个占地格各有势力，每回合各增长 1。`;
  return c;
}
export function trainCampaign(state, role) {
  const c = clone(state),
    person = findRole(c, role);
  if (person) {
    const w = c.regions[person.key],
      cost = trainingCost(w.levels[role] || 1);
    if (!spendSupplies(c, cost)) {
      c.announcement = `培养需要 ${cost} 原料，远征库存不足。`;
      return c;
    }
    w.levels[role] = (w.levels[role] || 1) + 1;
    person.node.power += 4;
    c.announcement = `${person.node.name}成长至 ${w.levels[role]} 级 · 势力 +4 · 每次有效清扫额外 +${explorationBonus(w.levels[role])} · 容量 ${growthCapacity(w, person.node)} · 消耗 ${cost} 原料。`;
    recordEvent(c, "training", person.key, c.announcement);
  }
  return c;
}
export function spendSupplies(c, amount) {
  if (Object.values(c.regions).reduce((a, w) => a + w.supplies, 0) < amount)
    return false;
  for (const w of Object.values(c.regions)) {
    const debit = Math.min(w.supplies, amount);
    w.supplies -= debit;
    amount -= debit;
    if (!amount) break;
  }
  return true;
}
export function moveRoleToRegion(state, role) {
  const c = clone(state),
    person = findRole(c, role),
    w = c.regions[c.active];
  if (!person || person.key === c.active) return c;
  if (w.pendingStart || c.occupiers[c.active] === "enemy") {
    c.announcement = "先清出一块安全地面；敌占区需要先收复。";
    return c;
  }
  const p =
    w.revealed
      .flatMap((v, i) =>
        v && hasFloor(w, i) && !w.mines[i] && !w.nodes[i] && !w.bridges[i]
          ? [i]
          : [],
      )
      .sort(
        (a, b) =>
          Math.abs((a % w.size) - (w.entry % w.size)) +
          Math.abs(Math.floor(a / w.size) - Math.floor(w.entry / w.size)) -
          Math.abs((b % w.size) - (w.entry % w.size)) -
          Math.abs(Math.floor(b / w.size) - Math.floor(w.entry / w.size)),
      )[0] ?? -1;
  const cost = relocationCost(person.key, c.active);
  if (p < 0 || !spendSupplies(c, cost)) {
    c.announcement = `迁驻需要 ${cost} 原料和一格未占用的安全地面。`;
    return c;
  }
  const old = c.regions[person.key];
  old.nodes[person.index] = {
    owner: "player",
    kind: "camp",
    name: "留守营地",
    power: 1,
  };
  w.nodes[p] = { ...person.node };
  delete w.nodes[p].homeRole;
  delete c.homes[role];
  w.levels[role] = old.levels[role];
  c.occupiers[c.active] = "player";
  c.announcement = `${person.node.name}已迁驻当前房间 · 消耗 ${cost} 原料，原据点留下 1 单位留守。`;
  recordEvent(c, "move", c.active, c.announcement);
  return c;
}
export function nextCampaignLayer(state) {
  if (state.completed.length !== roomTotal(state)) return state;
  const c = createCampaign(state.seed, state.depth + 1),
    w = c.regions[c.active];
  if (state.journey) c.journey = { ...state.journey, phase: "free", scene: null, offer: null, home: c.active };
  c.archive = [
    ...state.archive,
    {
      depth: state.depth,
      regions: state.regions,
      layout: state.layout,
      occupiers: state.occupiers,
      homes: state.homes,
    },
  ];
  w.supplies = Object.values(state.regions).reduce(
    (sum, r) => sum + r.supplies,
    0,
  );
  w.rescued = Object.values(state.regions).reduce(
    (sum, r) => sum + r.rescued,
    0,
  );
  for (const [i, id] of ["lin", "cen"].entries()) {
    const old = findRole(state, id);
    if (!old) continue;
    w.levels[id] = state.regions[old.key].levels[id];
    const p = w.entry + i;
    w.revealed[p] = 1;
    w.nodes[p] = { ...old.node, power: Math.max(8, old.node.power) };
    delete w.nodes[p].homeRole;
  }
  c.announcement =
    "本层所有房间已清扫。角色、培养等级与原料随队下行；旧层根据地已归档。";
  return c;
}
export function restoreCampaign(raw) {
  try {
    let c = JSON.parse(raw);
    if (c?.version === 3) c = migrateLegacy(c);
    if (
      c?.version !== 4 ||
      !c.layout?.rooms ||
      !c.layout.rooms[c.active] ||
      !c.regions?.[c.active] ||
      !Array.isArray(c.completed) ||
      !Array.isArray(c.orders) ||
      !Array.isArray(c.archive) ||
      !c.homes ||
      !c.occupiers ||
      !Number.isSafeInteger(c.macroTurn) ||
      c.macroTurn < 0
    )
      return null;
    for (const [key, w] of Object.entries(c.regions))
      if (!c.layout.rooms[key] || !restoreWorld(JSON.stringify(w))) return null;
    for (const [key, w] of Object.entries(c.regions)) {
      w.occupied = c.occupiers[key] === "enemy";
      if (
        w.turn === 0 &&
        w.revealed.filter(Boolean).length === 1 &&
        !w.flags.some(Boolean)
      ) {
        w.pendingStart = true;
        w.revealed.fill(0);
        w.notice = { kind: "info", text: "任选一个格子开始。第一次开格安全。" };
      }
    }
    c.events ??= [];
    c.alert ??= null;
    if (c.journey) {
      const j = c.journey;
      if (j.version !== 1 || !["survey", "defense", "combined", "free"].includes(j.phase) ||
        (j.home && !c.regions[j.home]) || (["defense", "combined"].includes(j.phase) && !c.regions[j.home])) return null;
      if (![null, "shelter", "outward", "rest"].includes(j.offer)) j.offer = null;
      if (![null, "shelter", "outward", "rest"].includes(j.scene)) j.scene = null;
      j.line = Math.max(0, Math.min(j.scene === "rest" ? 1 : 2, Number.isInteger(j.line) ? j.line : 0));
      j.baseline = Number.isSafeInteger(j.baseline) && j.baseline >= 0 ? j.baseline : c.completed.length;
      j.ended = j.ended === true;
      j.heard = Array.isArray(j.heard) ? [...new Set(j.heard.filter((id) => ["shelter", "outward", "rest"].includes(id)))] : [];
    }
    // Collapse old multi-cell homes into their character cell, preserving accumulated forces.
    for (const [role, h] of Object.entries(c.homes))
      if (h.size > 1) {
        const w = c.regions[h.region],
          p = findRole(c, role);
        let reclaimed = 0;
        for (const i of h.tiles)
          if (w.nodes[i]?.homeRole === role && !w.nodes[i].role) {
            reclaimed += w.nodes[i].power;
            delete w.nodes[i];
          }
        if (p) {
          p.node.power += reclaimed;
          c.homes[role] = {
            region: p.key,
            anchor: p.index,
            tiles: [p.index],
            size: 1,
          };
        } else delete c.homes[role];
      }
    return c;
  } catch {
    return null;
  }
}

// Preserve the old nine rooms as a district at the foot of the new lighthouse.
function migrateLegacy(c) {
  const map = (k) => {
    const [x, y] = coord(k);
    return `${x + 7},${y + 12}`;
  };
  const layout = createLayout(c.seed, c.depth);
  c.regions = Object.fromEntries(
    Object.entries(c.regions).map(([k, w]) => [
      map(k),
      { ...w, floor: Array(w.size * w.size).fill(1), shapeName: "旧站房" },
    ]),
  );
  c.occupiers = Object.fromEntries(
    Object.entries(c.occupiers).map(([k, v]) => [map(k), v]),
  );
  c.active = map(c.active);
  c.completed = c.completed.map(map);
  c.orders = c.orders.map((o) => ({
    ...o,
    from: map(o.from),
    path: o.path.map(map),
  }));
  for (const h of Object.values(c.homes)) h.region = map(h.region);
  if (c.celebration) c.celebration.key = map(c.celebration.key);
  c.version = 4;
  c.layout = layout;
  c.announcement =
    "原有房间与根据地已接入归航灯塔。方向门现在直接切换独立房间；全层轮廓会随探索逐渐点亮。";
  return c;
}
