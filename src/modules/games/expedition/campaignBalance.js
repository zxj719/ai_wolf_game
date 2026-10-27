export function growthCapacity(w, node) {
  if (node.introThreat) return 3;
  if (node.kind === "role") return 24 + (w.levels[node.role] || 1) * 8;
  return (node.owner === "enemy" ? 16 : 12) + w.depth * 2 + (w.danger || 0) * 2;
}
export function trainingCost(level = 1) {
  return level * 6 + 3 * (level - 1) ** 2;
}
export function explorationBonus(level = 1) {
  return Math.floor((level - 1) / 2);
}
export function explorationReward(cleared, level = 1) {
  return cleared > 0 ? Math.min(5, cleared) + explorationBonus(level) : 0;
}
export function relocationCost(from, to) {
  const [x, y] = from.split(",").map(Number),
    [u, v] = to.split(",").map(Number);
  return (
    8 + Math.min(4, Math.max(0, Math.abs(x - u) + Math.abs(y - v) - 1)) * 2
  );
}
export function supportDistance(from, to) {
  const [x, y] = from.split(",").map(Number),
    [u, v] = to.split(",").map(Number);
  return Math.abs(x - u) + Math.abs(y - v);
}
export function remoteExplorationReward(cleared, level, distance) {
  const reward = explorationReward(cleared, level);
  return reward
    ? Math.max(1, Math.ceil(reward / (1 + Math.floor(distance / 2))))
    : 0;
}
export function roleBlockaded(w, index) {
  const node = w.nodes[index];
  return (
    node?.kind === "role" &&
    Object.entries(w.nodes).some(([key, n]) => {
      const i = Number(key);
      return (
        n.owner !== node.owner &&
        Math.abs((i % w.size) - (index % w.size)) +
          Math.abs(Math.floor(i / w.size) - Math.floor(index / w.size)) ===
          1
      );
    })
  );
}
export function threatProfile(w) {
  const danger = w.danger || 0;
  return {
    first: 12 + Math.floor((w.size - 7) / 2),
    second: 30 + Math.floor((w.size - 7) / 2),
    strength: 6 + w.depth + danger * 2,
    cadence: danger >= 3 ? 2 : 3,
  };
}
export function roomDifficulty(completed, depth) {
  const danger = Math.min(4, Math.floor(completed / 6));
  return {
    danger,
    size: Math.min(23, 7 + (depth - 1) * 4 + Math.min(3, danger) * 2),
  };
}
