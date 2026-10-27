import { createWorld } from "./bridgeWorld";
export const LESSON_ROUTE = [22, 23, 24, 25];
export const LESSON_SWEEPS = [9, 10, 11, 16, 18];
export function createConnectionLesson(mode = "combined") {
  const w = createWorld(21);
  w.training = true;
  w.mines.fill(0);
  w.mines[17] = 1;
  w.mines[32] = 1;
  w.revealed = w.mines.map((m, i) => (m || (mode !== "defense" && LESSON_SWEEPS.includes(i)) ? 0 : 1));
  if (mode === "defense") w.flags = [...w.mines];
  w.loot.fill(0);
  w.entry = 22;
  w.nodes = {
    22: {
      owner: "player",
      kind: "role",
      role: "lin",
      name: "林渡大本营",
      power: 12,
    },
  };
  w.routeClaimed = Array(49).fill(0);
  w.bridges = {};
  w.packets = [];
  w.deliveries = [];
  return w;
}
