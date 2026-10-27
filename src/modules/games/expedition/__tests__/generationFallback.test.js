import { expect, it, vi } from "vitest";
import { createExpedition } from "../expeditionEngine";
import { solveLogically } from "../../minesweeper/mineEngine";
vi.mock("../../minesweeper/mineEngine", async (importOriginal) => ({
  ...(await importOriginal()),
  generateNoGuessBoard: () => ({ mines: null, noGuess: false }),
}));
it("地图生成超时时使用首击安全且可逻辑求解的备用布局", () => {
  const game = createExpedition(42);
  expect(game.mines.filter(Boolean)).toHaveLength(10);
  expect(solveLogically(Uint8Array.from(game.mines), 9, 9, 40).solved).toBe(
    true,
  );
  for (const i of [30, 31, 32, 39, 40, 41, 48, 49, 50])
    expect(game.mines[i]).toBe(0);
});
