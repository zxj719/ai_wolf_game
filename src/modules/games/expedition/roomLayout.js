// A floor is a connected room graph drawn into a meaningful silhouette.
// Room interiors have their own playable-cell masks, independent of this graph.
const LIGHTHOUSE = [
  "........#........",
  ".......###.......",
  "......#####......",
  "..#############..",
  "#################",
  "..#############..",
  "......#####......",
  ".......###.......",
  ".......###.......",
  ".......###.......",
  "......#####......",
  "......#####......",
  ".....#######.....",
  ".....#######.....",
  "....#########....",
  "..#############..",
  ".###############.",
];
export const ROOM_SHAPES = [
  "切角室",
  "十字厅",
  "转角厅",
  "横向长廊",
  "纵向长廊",
  "T 形厅",
];
export function createLayout(seed, depth) {
  const rooms = {};
  LIGHTHOUSE.forEach((row, y) =>
    [...row].forEach((cell, x) => {
      if (cell === "#")
        rooms[`${x},${y}`] = {
          x,
          y,
          shape: (seed + x * 13 + y * 7 + depth) % ROOM_SHAPES.length,
        };
    }),
  );
  return {
    name: "归航灯塔",
    subtitle: "每个房间亮起，都是一次回应。",
    width: 17,
    height: 17,
    start: "8,14",
    rooms,
  };
}
export function roomMask(size, shape) {
  const mid = Math.floor(size / 2),
    lo = mid - 1,
    hi = mid + 2;
  return Array.from({ length: size * size }, (_, i) => {
    const x = i % size,
      y = Math.floor(i / size),
      core = x >= lo && x <= hi && y >= lo && y <= hi;
    const wideX = x >= lo && x <= hi,
      wideY = y >= lo && y <= hi;
    return Number(
      core ||
        [
          Math.abs(x - mid) + Math.abs(y - mid) <= size - 3,
          wideX || wideY,
          x >= lo || y >= lo,
          wideY,
          wideX,
          y <= hi - 1 || wideX,
        ][shape % 6],
    );
  });
}
export const hasFloor = (world, index) =>
  !world.floor || world.floor[index] === 1;
export const safeCount = (world) =>
  world.mines.filter((m, i) => !m && hasFloor(world, i)).length;
export const clearedCount = (world) =>
  world.revealed.filter((v, i) => v && hasFloor(world, i)).length;
export const isRoomClear = (world) =>
  world.mines.every((m, i) => !hasFloor(world, i) || m || world.revealed[i]);
export function roomExit(c, direction) {
  const [x, y] = c.active.split(",").map(Number);
  const [dx, dy] = {
    north: [0, -1],
    east: [1, 0],
    south: [0, 1],
    west: [-1, 0],
  }[direction] ?? [0, 0];
  const key = `${x + dx},${y + dy}`;
  return c.layout.rooms[key] ? key : null;
}
export const roomTotal = (c) => Object.keys(c.layout.rooms).length;
