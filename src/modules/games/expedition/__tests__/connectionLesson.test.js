import { it, expect } from "vitest";
import {
  createConnectionLesson,
  LESSON_ROUTE,
  LESSON_SWEEPS,
} from "../connectionLesson";
import { prepareConnection } from "../routeDrawing";
import { actOnWorld } from "../bridgeWorld";
it("真实清扫四次获得数字收益、驻扎与补给，第五次击败入侵者", () => {
  let w = createConnectionLesson();
  const plan = prepareConnection(w, LESSON_ROUTE);
  expect(plan.gain).toBe(5);
  expect(plan.cost).toBe(6);
  w = plan.world;
  expect(w.nodes[22].power).toBe(11);
  for (let turn = 0; turn < 4; turn++) {
    w = actOnWorld(w, "open", LESSON_SWEEPS[turn]);
    expect(w.latest).toEqual([LESSON_SWEEPS[turn]]);
    expect(w.nodes[25].power).toBe([2, 3, 5, 7][turn]);
  }
  w.nodes[26] = { owner: "enemy", kind: "raider", name: "灰帆", power: 2 };
  const attack = prepareConnection(w, [25, 26]);
  expect(attack.forecast).toMatchObject({
    amount: 5,
    defense: 3,
    favorable: true,
  });
  w = actOnWorld(attack.world, "open", LESSON_SWEEPS[4]);
  expect(w.nodes[26]).toMatchObject({ owner: "player", power: 2 });
  expect(w.turn).toBe(5);
});
