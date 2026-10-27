import { hasFloor } from "./roomLayout";
import {
  growthCapacity,
  threatProfile,
  roleBlockaded,
  explorationReward,
  trainingCost,
} from "./campaignBalance";
import { generateRoomBoard } from "./maskedBoard";
import {
  buildNeighbors,
  computeNumbers,
  generateNoGuessBoard,
  mulberry32,
} from "../minesweeper/mineEngine";

export const WORLD_SAVE = "zhaxiaoji-bridge-world-v2";
export const WINDOW = 5;
export const CAST = {
  lin: {
    name: "林渡",
    job: "架桥人",
    color: "#86b9a4",
    line: "杯子先别收，说不定还会来人。",
    bio: "以前检修桥梁。工具包里有半截粉笔和一双备用手套；出发前，总要再走一遍桥。",
  },
  cen: {
    name: "岑灯",
    job: "信号修复师",
    color: "#d9bd79",
    line: "明天同一时间。你们记得开机。",
    bio: "守着九号中继站，修无线电，也修灯。每晚关机前，会多留一分钟听听频道。",
  },
};
const clone = (s) => structuredClone(s);
const adjacent = (a, b, n) =>
  Math.abs((a % n) - (b % n)) +
    Math.abs(Math.floor(a / n) - Math.floor(b / n)) ===
  1;
const four = (i, n) =>
  [i - n, i + 1, i + n, i - 1].filter(
    (j) => j >= 0 && j < n * n && adjacent(i, j, n),
  );
function note(s, text, kind = "info") {
  s.notice = { text, kind };
}
function story(s, id, speaker, text) {
  if (s.journal.some((e) => e.id === id)) return;
  s.journal.push({ id, speaker, text, turn: s.turn, depth: s.depth });
}

export function createWorld(seed, depth = 1, options = {}) {
  const size = options.size ?? Math.min(23, 7 + (depth - 1) * 4),
    count = Math.min(
      size * 4 - 4,
      Math.floor(size * size * Math.min(0.18, 0.1 + depth * 0.02)),
    );
  const entry = Math.floor(size / 2) * size + Math.floor(size / 2),
    rng = mulberry32((seed + depth * 9173) >>> 0);
  const generated = generateNoGuessBoard({
    rows: size,
    cols: size,
    mines: count,
    start: entry,
    seed: (seed + depth * 9173) >>> 0,
    timeBudgetMs: 200,
  });
  // A contiguous perimeter prefix leaves every safe tile reachable by the central zero flood.
  const rim = [];
  for (let x = 0; x < size; x++) rim.push(x);
  for (let y = 1; y < size; y++) rim.push(y * size + size - 1);
  for (let x = size - 2; x >= 0; x--) rim.push((size - 1) * size + x);
  for (let y = size - 2; y > 0; y--) rim.push(y * size);
  const mines =
    generated.noGuess && generated.mines
      ? Array.from(generated.mines)
      : Array.from({ length: size * size }, (_, i) =>
          rim.slice(0, count).includes(i) ? 1 : 0,
        );
  const blank = () => Array(size * size).fill(0),
    loot = mines.map((m) => (m ? 0 : rng() < 0.22 ? 1 : 0));
  const nb = buildNeighbors(size, size);
  const candidates = mines.flatMap((m, i) =>
    !m && i !== entry && !nb[entry].includes(i) ? [i] : [],
  );
  const rescue = candidates[Math.floor(rng() * candidates.length)];
  loot[rescue] = 2;
  const revealed = blank();
  revealed[entry] = 1;
  return {
    version: 2,
    seed: seed >>> 0,
    depth,
    size,
    entry,
    mines,
    loot,
    revealed,
    flags: blank(),
    blasts: blank(),
    destroyed: blank(),
    latest: [],
    explosions: [],
    turn: 0,
    supplies: 0,
    rescued: 0,
    levels: { lin: 1, cen: 1 },
    camera: { x: Math.floor(size / 2) - 2, y: Math.floor(size / 2) - 2 },
    borders: { north: false, east: false, south: false, west: false },
    nodes: {
      [entry]: {
        owner: "player",
        kind: "role",
        role: "lin",
        name: "林渡",
        power: 8,
      },
    },
    bridges: {},
    packets: [],
    packetId: 0,
    landings: 0,
    archive: [],
    journal: [
      {
        id: "opening",
        speaker: "林渡",
        turn: 0,
        depth,
        text: "地表已经没有可以回去的家。我们在废弃隧道的一块安全地面上点亮灯。清掉脚下的雷，再把彼此连起来——避难所就从这里开始。",
      },
    ],
    notice: {
      kind: "info",
      text: "先点击中央的亮格。你清出的地面，就是未来的避难所。",
    },
  };
}

export function panWorld(state, direction) {
  const s = clone(state),
    max = s.size - WINDOW;
  if (direction === "north") s.camera.y = Math.max(0, s.camera.y - 2);
  if (direction === "south") s.camera.y = Math.min(max, s.camera.y + 2);
  if (direction === "west") s.camera.x = Math.max(0, s.camera.x - 2);
  if (direction === "east") s.camera.x = Math.min(max, s.camera.x + 2);
  if (s.camera.y === 0) s.borders.north = true;
  if (s.camera.y === max) s.borders.south = true;
  if (s.camera.x === 0) s.borders.west = true;
  if (s.camera.x === max) s.borders.east = true;
  return s;
}
export function focusWorld(state, index) {
  const s = clone(state),
    max = s.size - WINDOW;
  s.camera = {
    x: Math.max(0, Math.min(max, (index % s.size) - 2)),
    y: Math.max(0, Math.min(max, Math.floor(index / s.size) - 2)),
  };
  return panWorld(s, "stay");
}
export function canDescend(s) {
  return (
    Object.values(s.borders).every(Boolean) &&
    s.mines.every((m, i) => m || s.revealed[i])
  );
}
export function advanceLayer(state) {
  if (!canDescend(state)) return state;
  const s = createWorld(state.seed, state.depth + 1);
  s.supplies = state.supplies;
  s.rescued = state.rescued;
  s.levels = state.levels;
  s.nodes[s.entry].power = 8 + state.levels.lin * 2;
  s.archive = [
    ...state.archive,
    {
      depth: state.depth,
      size: state.size,
      nodes: state.nodes,
      bridges: state.bridges,
      mines: state.mines,
      revealed: state.revealed,
    },
  ];
  s.journal = [...state.journal];
  story(
    s,
    `depth-${s.depth}`,
    "林渡",
    "上一层的灯留给后来的人。更深处的桥还没有修好，但我们已经知道该怎么开始。",
  );
  if (state.rescued > 0) {
    const p = s.entry + 1;
    s.revealed[p] = 1;
    s.nodes[p] = {
      owner: "player",
      kind: "role",
      role: "cen",
      name: "岑灯",
      power: 6,
    };
  }
  return s;
}

// Parent links define a directed route. Bridges have one incoming and at most one outgoing edge.
function ancestry(s, index, stopAtCamp = false) {
  const route = [],
    seen = new Set();
  let p = index;
  while (p != null && !seen.has(p)) {
    seen.add(p);
    route.unshift(p);
    if (
      s.nodes[p]?.kind === "role" ||
      s.nodes[p]?.kind === "raider" ||
      (stopAtCamp && s.nodes[p])
    )
      return route;
    p = s.bridges[p]?.parent;
  }
  return null;
}
function build(s, from, to, mode, owner = "player") {
  const sourceRoute = ancestry(s, from, true),
    source = sourceRoute && s.nodes[sourceRoute[0]];
  if (!source || source.owner !== owner) {
    note(s, "先选择一位角色、营地或己方桥头。");
    return;
  }
  if (
    !Number.isInteger(to) ||
    to < 0 ||
    to >= s.size * s.size ||
    !hasFloor(s, to) ||
    s.mines[to] ||
    !s.revealed[to]
  ) {
    note(s, "只能连接已经清扫的非雷地块。");
    return;
  }
  const here = s.nodes[to],
    bridge = s.bridges[to],
    upgrade =
      from === to && bridge?.owner === owner && !here && mode === "camp";
  if (!upgrade && !adjacent(from, to, s.size)) {
    note(s, "桥梁每次只向上下左右延伸一格。");
    return;
  }
  if (
    !upgrade &&
    Object.values(s.bridges).some((b) => b.parent === from) &&
    !s.nodes[from]
  ) {
    note(s, "这格已有前进方向；单向通路不能分叉。");
    return;
  }
  if (here && here.owner !== owner) {
    if (
      s.packets.some(
        (p) =>
          p.kind === "attack" &&
          p.owner === owner &&
          p.target === to &&
          (p.source ?? (p.step === -1 ? p.position : null)) === sourceRoute[0],
      )
    ) {
      note(s, "这条路线已有连接队在途；先推进清扫，观察接敌结果。");
      return;
    }
    if (source.power < 3) {
      note(s, "至少需要 3 势力才能派出连接队。");
      return;
    }
    // Keep one defender at home and pay one for the final bridge segment.
    const amount = source.power - 2,
      path = [...sourceRoute.slice(1), to];
    source.power -= amount + 1;
    s.packets.push({
      id: ++s.packetId,
      owner,
      kind: "attack",
      source: sourceRoute[0],
      amount,
      path,
      step: -1,
      position: sourceRoute[0],
      target: to,
    });
    note(
      s,
      `连接队 ${amount} 已出发；路径 ${path.length} 格，每回合推进一格。`,
    );
    return;
  }
  const cutEnemyBridge = owner === "enemy" && bridge?.owner === "player";
  if (here || (bridge && !upgrade && !cutEnemyBridge)) {
    note(s, "该格已有势力或单向通路，不能反向占用。");
    return;
  }
  const cost = upgrade ? 3 : mode === "camp" ? 4 : 1;
  if (source.power < cost) {
    note(
      s,
      `势力不足：${mode === "camp" ? "新驻扎需要 4（延伸 1 + 驻扎 3）" : "通行需要 1"}。`,
    );
    return;
  }
  source.power -= cost;
  if (!upgrade) s.bridges[to] = { owner, parent: from };
  if (mode === "camp") {
    s.nodes[to] = {
      owner,
      kind: "camp",
      name: owner === "player" ? "灯火营地" : "敌方营地",
      power: 1,
    };
    if (owner === "player")
      story(
        s,
        `first-camp`,
        "林渡",
        "这里曾经只是一个数字。现在有人在这里等下一班补给。这就是我们的第一座避难所。",
      );
  }
  if (owner === "player")
    note(
      s,
      mode === "camp"
        ? "营地建立：初始势力 1，每回合增长 1。"
        : "通路已延伸：消耗 1，不会自行增长。",
    );
}
export function extendBridge(state, from, to, mode) {
  const s = clone(state);
  build(s, from, to, mode);
  return s;
}

function arrive(s, p) {
  const target = s.nodes[p.target];
  if (target?.owner === p.owner) {
    target.power += p.amount;
    return;
  }
  if (!target) return;
  const remaining = target.power - p.amount;
  if (remaining >= 0) {
    target.power = remaining;
    return;
  }
  s.nodes[p.target] = {
    owner: p.owner,
    kind: "camp",
    name: p.owner === "player" ? "重连营地" : "敌方营地",
    power: -remaining,
  };
  // Capturing severs incoming links: no opposing packets can use a newly owned junction.
  s.bridges[p.target] = { owner: p.owner, parent: p.position };
  note(
    s,
    p.owner === "player"
      ? "连接队夺回了一处营地。"
      : "一处据点失去连接。请保护其余灯火。",
    p.owner === "player" ? "safe" : "danger",
  );
}
function movePackets(s) {
  const keep = [];
  s.deliveries = [];
  for (const p of s.packets) {
    const nextStep = p.step + 1,
      pos = p.path[nextStep],
      target = s.nodes[pos];
    if (pos == null) continue;
    if (nextStep < p.path.length - 1) {
      if ((s.bridges[pos]?.owner ?? target?.owner) !== p.owner) continue;
      keep.push({ ...p, step: nextStep, position: pos });
    } else {
      s.deliveries.push({
        id: p.id,
        from: p.position,
        to: p.target,
        amount: p.amount,
        owner: p.owner,
        kind: p.kind,
        captured:
          target?.owner !== p.owner && p.amount > (target?.power ?? Infinity),
      });
      arrive(s, p);
    }
  }
  s.packets = keep;
}
function sendSupplies(s) {
  const used = new Set();
  const camps = Object.entries(s.nodes)
    .filter(([, n]) => n.kind === "camp")
    .sort(
      (a, b) =>
        (a[1].owner === "enemy" && b[1].owner === "enemy"
          ? nearestPlayer(s, Number(a[0])) - nearestPlayer(s, Number(b[0]))
          : 0) || a[1].power - b[1].power,
    );
  for (const [key, camp] of camps) {
    const target = Number(key),
      path = ancestry(s, target),
      root = path && s.nodes[path[0]];
    if (
      !root ||
      root.owner !== camp.owner ||
      path.length < 2 ||
      used.has(path[0])
    )
      continue;
    if (
      path.some(
        (p) => (s.nodes[p]?.owner ?? s.bridges[p]?.owner) !== root.owner,
      )
    )
      continue;
    const inFlight = s.packets
      .filter((p) => p.target === target && p.owner === camp.owner)
      .reduce((a, p) => a + p.amount, 0);
    if (root.power <= camp.power + inFlight) continue;
    root.power--;
    used.add(path[0]);
    s.packets.push({
      id: ++s.packetId,
      owner: root.owner,
      kind: "supply",
      amount: 1,
      path: path.slice(1),
      step: -1,
      position: path[0],
      target,
    });
  }
}
function invaders(s, allowLanding = true) {
  if (s.pendingStart || s.training) return;
  const profile = threatProfile(s),
    clock = s.explorationTurns ?? s.turn;
  if (allowLanding && clock >= profile.first - 4 && !s.landings)
    story(
      s,
      `warning-${s.depth}`,
      "岑灯 · 无线电",
      `有降落伞的影子。再清扫 ${Math.max(0, profile.first - clock)} 回合，他们就会落下来。先把我们的人连起来。`,
    );
  if (
    allowLanding &&
    ((s.landings === 0 && clock >= profile.first) ||
      (s.landings === 1 && clock >= profile.second))
  ) {
    const candidates = s.mines
      .flatMap((m, i) =>
        hasFloor(s, i) && !m && !s.nodes[i] && !s.bridges[i] ? [i] : [],
      )
      .sort(
        (a, b) =>
          Math.abs((b % s.size) - (s.entry % s.size)) +
          Math.abs(Math.floor(b / s.size) - Math.floor(s.entry / s.size)) -
          Math.abs((a % s.size) - (s.entry % s.size)) -
          Math.abs(Math.floor(a / s.size) - Math.floor(s.entry / s.size)),
      );
    const p = candidates[0];
    if (p != null) {
      s.revealed[p] = 1;
      s.nodes[p] = {
        owner: "enemy",
        kind: "raider",
        name: "灰帆空降队",
        power: profile.strength,
      };
      s.landings++;
      story(
        s,
        `landing-${s.depth}-${s.turn}`,
        "林渡",
        "灰帆在废墟里落下了第一面旗。先把我们的人连起来；不要让一座孤立的营地独自面对他们。",
      );
      note(s, "灰帆空降队已进入本层；红色标记处出现敌方据点。", "danger");
    }
  }
  if (s.turn < 15 || s.turn % profile.cadence !== 0) return;
  const enemy = Object.entries(s.nodes).filter(
    ([, n]) => n.owner === "enemy" && n.kind === "raider",
  );
  for (const [key] of enemy) {
    const root = Number(key),
      fronts = [
        root,
        ...Object.keys(s.bridges)
          .map(Number)
          .filter((i) => ancestry(s, i)?.[0] === root),
      ];
    let acted = false;
    for (const from of fronts.reverse()) {
      const opts = four(from, s.size).sort(
        (a, b) =>
          (s.nodes[a]?.owner === "player" ? -1 : 0) -
            (s.nodes[b]?.owner === "player" ? -1 : 0) ||
          nearestPlayer(s, a) - nearestPlayer(s, b),
      );
      for (const to of opts) {
        if (
          !hasFloor(s, to) ||
          s.mines[to] ||
          s.nodes[to]?.owner === "enemy" ||
          s.bridges[to]?.owner === "enemy"
        )
          continue;
        if (
          Object.values(s.bridges).some((b) => b.parent === from) &&
          !s.nodes[from]
        )
          continue;
        const sourcePath = ancestry(s, from, true);
        const source = sourcePath && s.nodes[sourcePath[0]];
        if (!source || source.power < (s.nodes[to] ? 3 : 4)) continue;
        // Build pressure at the front instead of feeding tiny suicidal attacks.
        if (
          s.nodes[to]?.owner === "player" &&
          source.power - 2 <
            Math.min(s.nodes[to].power + 2, 8 + (s.danger || 0) * 2)
        )
          continue;
        s.revealed[to] = 1;
        build(s, from, to, "camp", "enemy");
        acted = true;
        break;
      }
      if (acted) break;
    }
  }
}
function nearestPlayer(s, i) {
  return Math.min(
    ...Object.entries(s.nodes)
      .filter(([, n]) => n.owner === "player")
      .map(([key]) => {
        const p = Number(key);
        return (
          Math.abs((i % s.size) - (p % s.size)) +
          Math.abs(Math.floor(i / s.size) - Math.floor(p / s.size))
        );
      }),
    s.size * 2,
  );
}
// Only this function advances time. New packets move one cell in their launch turn.
export function settleTurn(state, options = {}) {
  const s = clone(state);
  s.turn++;
  if (s.occupied) {
    s.deliveries = [];
    return s;
  }
  for (const [key, n] of Object.entries(s.nodes)) {
    if (n.power < growthCapacity(s, n) && !roleBlockaded(s, Number(key)))
      n.power++;
  }
  sendSupplies(s);
  movePackets(s);
  invaders(s, options.allowLanding !== false);
  return s;
}
export function canSurveyRemaining(s) {
  return (
    !s.pendingStart &&
    s.mines.filter(Boolean).length ===
      s.flags.filter(Boolean).length + s.blasts.filter(Boolean).length &&
    s.revealed.some(
      (v, i) => hasFloor(s, i) && !v && !s.flags[i] && !s.blasts[i],
    )
  );
}
export function actOnWorld(state, action, index, role = "lin", options = {}) {
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= state.size ** 2 ||
    !hasFloor(state, index) ||
    !["open", "flag", "finish"].includes(action) ||
    (action === "finish" && !canSurveyRemaining(state))
  )
    return state;
  const s = clone(state),
    nb = buildNeighbors(s.size, s.size);
  const finishAction = (world) => options.surveyOnly ? { ...world, turn: world.turn + 1 } : settleTurn(world, { allowLanding: options.allowLanding });
  if (s.pendingStart && action === "open" && !s.flags[index]) {
    const generated = s.floor
      ? generateRoomBoard(s, index)
      : generateNoGuessBoard({
          rows: s.size,
          cols: s.size,
          mines: s.mines.filter(Boolean).length,
          start: index,
          seed: s.seed + s.depth * 9173,
          timeBudgetMs: 200,
        });
    if (generated.mines) s.mines = Array.from(generated.mines);
    for (let i = 0; i < s.mines.length; i++)
      if (!hasFloor(s, i) || i === index || nb[index].includes(i))
        s.mines[i] = 0;
    for (let i = 0; i < s.loot.length; i++)
      if (s.mines[i] || !hasFloor(s, i)) s.loot[i] = 0;
    s.loot[index] = 0;
    if (!s.loot.includes(2)) {
      const rescue = s.mines.findIndex(
        (m, i) => !m && hasFloor(s, i) && i !== index,
      );
      if (rescue >= 0) s.loot[rescue] = 2;
    }
    const initial = s.nodes[s.entry];
    if (initial?.owner === "player" && initial.role) {
      delete s.nodes[s.entry];
      s.nodes[index] = initial;
    }
    s.entry = index;
    s.pendingStart = false;
  }
  s.explorationTurns = (s.explorationTurns ?? s.turn) + 1;
  const nums = computeNumbers(s.mines, nb);
  s.latest = [];
  s.explosions = [];
  let reward = 0;
  if (action === "flag") {
    if (!s.revealed[index] && !s.blasts[index])
      s.flags[index] = 1 - s.flags[index];
    note(s, options.surveyOnly ? "标记已更新。再看看周围的数字。" : "标记也是一次行动。双方势力与补给推进一回合。");
  } else if (action === "finish" || (!s.flags[index] && !s.blasts[index])) {
    let targets =
      action === "finish"
        ? s.revealed.flatMap((v, i) =>
            hasFloor(s, i) && !v && !s.flags[i] && !s.blasts[i] ? [i] : [],
          )
        : [index];
    if (action !== "finish" && s.revealed[index]) {
      const known = nb[index].filter((i) => s.flags[i] || s.blasts[i]).length;
      const covered = nb[index].filter(
        (i) => hasFloor(s, i) && !s.flags[i] && !s.revealed[i] && !s.blasts[i],
      );
      if (covered.length > 0 && nums[index] - known === covered.length) {
        for (const i of covered) s.flags[i] = 1;
        note(
          s,
          `数字 ${nums[index]} 的剩余 ${covered.length} 格已连标 · 仅推进 1 回合。旗帜仍需你判断。`,
        );
        return finishAction(s);
      }
      targets =
        known === nums[index]
          ? nb[index].filter(
              (i) => !s.flags[i] && !s.revealed[i] && !s.blasts[i],
            )
          : [];
    }
    for (const i of targets)
      if (s.mines[i]) {
        s.blasts[i] = 1;
        s.explosions.push(i);
        s.losses = (s.losses || 0) + Math.min(3, s.supplies);
        s.supplies = Math.max(0, s.supplies - 3);
        for (const j of nb[i])
          if (!s.revealed[j] && s.loot[j] === 1) s.destroyed[j] = 1;
      }
    const stack = targets.filter((i) => !s.mines[i]);
    while (stack.length) {
      const i = stack.pop();
      if (!hasFloor(s, i) || s.revealed[i] || s.flags[i] || s.mines[i])
        continue;
      s.revealed[i] = 1;
      s.latest.push(i);
      if (s.loot[i] === 1 && !s.destroyed[i]) {
        s.supplies += 3;
        s.earned = (s.earned || 0) + 3;
      }
      if (s.loot[i] === 2) {
        s.rescued++;
        if (!Object.values(s.nodes).some((n) => n.role === "cen"))
          s.nodes[i] = {
            owner: "player",
            kind: "role",
            role: "cen",
            name: "岑灯",
            power: 5,
          };
        story(
          s,
          "rescue-cen",
          "岑灯",
          "我在这里听了十七天杂音。刚才那三声敲击，是你吗？你修桥，我来让桥两头的人听见彼此。",
        );
      }
      if (!nums[i]) stack.push(...nb[i]);
    }
    const receiver = Object.values(s.nodes).find(
      (n) => n.owner === "player" && n.role === role,
    );
    reward = s.explosions.length
      ? 0
      : explorationReward(s.latest.length, s.levels[role]);
    if (receiver && !options.surveyOnly) receiver.power += reward;
    note(
      s,
      s.explosions.length
        ? options.surveyOnly ? "爆炸！附近的物资被毁了。停一下，重新看清周围的数字。" : "爆炸！附近未领取物资损毁，损失部分原料。阵地没有消失，继续连接。"
        : s.latest.length
          ? options.surveyOnly ? `清扫 ${s.latest.length} 格。安全的地面又多了一点。` : `清扫 ${s.latest.length} 格 · ${CAST[role]?.name || "角色"}获得 ${receiver ? reward : 0} 势力`
          : "这一操作没有新增安全格，仍推进一个回合。",
      s.explosions.length ? "blast" : "safe",
    );
  } else note(s, "该格未打开；这一操作仍推进一个回合。");
  return finishAction(s);
}
export function upgradeRole(state, role) {
  const s = clone(state),
    n = Object.values(s.nodes).find(
      (n) => n.role === role && n.owner === "player",
    ),
    cost = trainingCost(s.levels[role] || 1);
  if (!n || s.supplies < cost) {
    note(s, `训练需要 ${cost} 原料。`);
    return s;
  }
  s.supplies -= cost;
  s.levels[role]++;
  n.power += 4;
  note(
    s,
    `${n.name}成长至 ${s.levels[role]} 级，获得 4 势力；下层初始力量也会提高。`,
  );
  return s;
}
export function restoreWorld(raw) {
  try {
    const s = JSON.parse(raw);
    if (
      s?.version !== 2 ||
      !Number.isInteger(s.size) ||
      s.size < 7 ||
      s.size > 23
    )
      return null;
    if (
      s.floor &&
      (!Array.isArray(s.floor) ||
        s.floor.length !== s.size ** 2 ||
        s.floor.some((v) => v !== 0 && v !== 1) ||
        s.floor[s.entry] !== 1)
    )
      return null;
    for (const k of ["mines", "revealed", "flags", "blasts", "destroyed"])
      if (
        !Array.isArray(s[k]) ||
        s[k].length !== s.size ** 2 ||
        s[k].some((v) => v !== 0 && v !== 1)
      )
        return null;
    for (const k of [
      "seed",
      "depth",
      "turn",
      "supplies",
      "rescued",
      "packetId",
      "landings",
    ])
      if (!Number.isSafeInteger(s[k]) || s[k] < 0) return null;
    if (
      !s.nodes ||
      !s.bridges ||
      !Array.isArray(s.packets) ||
      !Array.isArray(s.archive) ||
      !Array.isArray(s.journal) ||
      !s.camera ||
      !s.levels ||
      !s.borders
    )
      return null;
    if (
      !Array.isArray(s.loot) ||
      s.loot.length !== s.size ** 2 ||
      s.loot.some((v) => ![0, 1, 2].includes(v))
    )
      return null;
    if (
      !Array.isArray(s.latest) ||
      !Array.isArray(s.explosions) ||
      typeof s.notice?.text !== "string"
    )
      return null;
    const index = (i) => Number.isInteger(i) && i >= 0 && i < s.size ** 2;
    if (
      !index(s.entry) ||
      !Number.isInteger(s.camera.x) ||
      !Number.isInteger(s.camera.y) ||
      s.camera.x < 0 ||
      s.camera.y < 0 ||
      s.camera.x > s.size - WINDOW ||
      s.camera.y > s.size - WINDOW
    )
      return null;
    if (
      Object.entries(s.nodes).some(
        ([i, n]) =>
          !index(Number(i)) ||
          !["player", "enemy"].includes(n.owner) ||
          !Number.isInteger(n.power) ||
          n.power < 0,
      )
    )
      return null;
    if (
      Object.entries(s.bridges).some(
        ([i, b]) =>
          !index(Number(i)) ||
          !index(b.parent) ||
          !adjacent(Number(i), b.parent, s.size) ||
          !["player", "enemy"].includes(b.owner),
      )
    )
      return null;
    if (
      s.packets.some(
        (p) =>
          !Array.isArray(p.path) ||
          !p.path.length ||
          p.path.some((i) => !index(i)) ||
          !index(p.target) ||
          !index(p.position) ||
          !Number.isInteger(p.step) ||
          p.step < -1 ||
          p.step >= p.path.length ||
          !Number.isInteger(p.amount) ||
          p.amount < 1,
      )
    )
      return null;
    return s;
  } catch {
    return null;
  }
}
