import {
  buildNeighbors,
  computeNumbers,
  generateNoGuessBoard,
  mulberry32,
} from "../minesweeper/mineEngine";

export const SIDE = 9;
export const ENTRY = 40;
export const SAVE_KEY = "zhaxiaoji-underground-v1";
export const NEIGHBORS = buildNeighbors(SIDE, SIDE);
const empty = () => Array(SIDE * SIDE).fill(0);

// A deterministic map and a serializable campaign. No React, clock, network or storage here.
export function createExpedition(seed, sector = 1) {
  const mapSeed = (seed + Math.imul(sector, 2654435761)) >>> 0;
  const random = mulberry32(mapSeed);
  const generated = generateNoGuessBoard({
    rows: SIDE,
    cols: SIDE,
    mines: 10,
    start: ENTRY,
    seed: mapSeed,
    timeBudgetMs: 200,
  });
  // The generator can exhaust its time budget. Never accept its unverified result.
  // This fixed fallback is independently covered by the logical solver test.
  const mines =
    generated.noGuess && generated.mines
      ? generated.mines
      : Uint8Array.from({ length: 81 }, (_, i) =>
          [7, 17, 26, 28, 35, 42, 56, 65, 66, 77].includes(i) ? 1 : 0,
        );
  const loot = Array.from(mines, (mine) =>
    mine ? 0 : random() < 0.26 ? 1 : 0,
  );
  const candidates = Array.from(mines, (m, i) =>
    !m && ![ENTRY, ...NEIGHBORS[ENTRY]].includes(i) ? i : -1,
  ).filter((i) => i >= 0);
  const survivor = candidates[Math.floor(random() * candidates.length)];
  loot[survivor] = 2;
  loot[ENTRY] = 1;
  return {
    version: 1,
    seed: seed >>> 0,
    sector,
    mines: Array.from(mines),
    loot,
    revealed: empty(),
    flags: empty(),
    blasts: empty(),
    destroyed: empty(),
    supplies: 0,
    people: 3,
    status: "exploring",
    previous: null,
    moves: 0,
    latest: [],
    event: {
      type: "arrival",
      text: "地表失联第 17 天。先从亮着灯的入口下去。",
    },
  };
}

export function expeditionMove(state, action, index) {
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= 81 ||
    state.status !== "exploring"
  )
    return state;
  if (action === "flag") {
    if (state.revealed[index] || state.blasts[index]) return state;
    const flags = [...state.flags];
    flags[index] = flags[index] ? 0 : 1;
    return {
      ...state,
      flags,
      latest: [],
      event: {
        type: "flag",
        text: flags[index]
          ? "已标记。旗子代表你的判断，不代表系统确认安全。"
          : "已取消标记。",
      },
    };
  }
  if (action !== "open" || state.flags[index] || state.blasts[index])
    return state;
  if (!state.revealed.some(Boolean) && index !== ENTRY)
    return {
      ...state,
      event: {
        type: "hint",
        text: "先从中央发光的安全入口下去，再沿数字探索。",
      },
    };
  const nums = computeNumbers(state.mines, NEIGHBORS);
  let targets = [index];
  if (state.revealed[index]) {
    const known = NEIGHBORS[index].filter(
      (i) => state.flags[i] || state.blasts[i],
    ).length;
    if (!nums[index] || known !== nums[index])
      return {
        ...state,
        latest: [],
        event: {
          type: "hint",
          text: "周围已标记的雷位数量，要先与数字一致。误标仍会触雷。",
        },
      };
    targets = NEIGHBORS[index].filter(
      (i) => !state.revealed[i] && !state.flags[i] && !state.blasts[i],
    );
    if (!targets.length) return state;
  }
  const next = {
    ...state,
    revealed: [...state.revealed],
    flags: [...state.flags],
    blasts: [...state.blasts],
    destroyed: [...state.destroyed],
    latest: [],
    moves: state.moves + 1,
  };
  let exploded = 0,
    damaged = 0,
    gained = 0,
    rescued = 0;
  // Resolve blasts before awards, so a chord cannot collect resources that the same move destroys.
  for (const i of targets)
    if (state.mines[i]) {
      next.blasts[i] = 1;
      exploded++;
      for (const j of NEIGHBORS[i])
        if (!next.revealed[j] && next.loot[j] === 1 && !next.destroyed[j]) {
          next.destroyed[j] = 1;
          damaged++;
        }
    }
  const stack = targets.filter((i) => !state.mines[i]);
  while (stack.length) {
    const i = stack.pop();
    if (next.revealed[i] || next.flags[i] || next.mines[i]) continue;
    next.revealed[i] = 1;
    next.latest.push(i);
    if (!next.destroyed[i]) {
      if (next.loot[i] === 1) gained += 3;
      if (next.loot[i] === 2) rescued++;
    }
    if (!nums[i]) stack.push(...NEIGHBORS[i]);
  }
  const loss = Math.min(next.supplies, exploded * 3);
  next.supplies = next.supplies - loss + gained;
  next.people += rescued;
  const cleared = next.mines.every((m, i) => m || next.revealed[i]);
  next.status = cleared ? "cleared" : "exploring";
  next.event = exploded
    ? {
        type: "blast",
        text: `局部爆炸：遗失 ${loss} 原料，${damaged} 处未领取物资损毁。队伍仍可继续。${rescued ? `救出 ${rescued} 位幸存者。` : ""}`,
      }
    : rescued
      ? {
          type: "rescue",
          text: `救出 ${rescued} 位幸存者。「上面还有人吗？我会修机器，让我跟你们走。」`,
        }
      : {
          type: cleared ? "clear" : "safe",
          text: cleared
            ? "区域已扫清。把这片安全地带留给基地，向下一个信号出发。"
            : `安全推进 +${next.latest.length}${gained ? ` · 原料 +${gained}` : ""}`,
        };
  return next;
}

export function nextSector(state) {
  if (state.status !== "cleared") return state;
  return {
    ...createExpedition(state.seed, state.sector + 1),
    supplies: state.supplies,
    people: state.people,
    previous: {
      sector: state.sector,
      mines: state.mines,
      revealed: state.revealed,
      blasts: state.blasts,
    },
    event: {
      type: "arrival",
      text: "无线电传来新的敲击声。前方，还有人等着被找到。",
    },
  };
}

export function restoreExpedition(raw) {
  try {
    const s = JSON.parse(raw);
    const bits = (a) =>
      Array.isArray(a) && a.length === 81 && a.every((v) => v === 0 || v === 1);
    if (s?.version !== 1 || !["exploring", "cleared"].includes(s.status))
      return null;
    for (const key of ["seed", "sector", "supplies", "people", "moves"])
      if (!Number.isSafeInteger(s[key]) || s[key] < 0) return null;
    if (s.sector < 1 || s.people < 3) return null;
    if (
      !["mines", "revealed", "flags", "blasts", "destroyed"].every((k) =>
        bits(s[k]),
      )
    )
      return null;
    if (
      !Array.isArray(s.loot) ||
      s.loot.length !== 81 ||
      s.loot.some((v) => ![0, 1, 2].includes(v))
    )
      return null;
    if (
      !Array.isArray(s.latest) ||
      s.latest.some((i) => !Number.isInteger(i) || i < 0 || i > 80)
    )
      return null;
    if (
      !s.event ||
      typeof s.event.text !== "string" ||
      typeof s.event.type !== "string"
    )
      return null;
    if (
      s.previous &&
      (!bits(s.previous.mines) ||
        !bits(s.previous.revealed) ||
        !bits(s.previous.blasts))
    )
      return null;
    return s;
  } catch {
    return null;
  }
}
