import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import WorldMap from "../WorldMap";
import { createWorld } from "../bridgeWorld";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
it("正式地图九宫格始终存在，移出后保留；暂停时不响应标记", () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host),
    game = createWorld(21),
    flag = vi.fn();
  act(() =>
    root.render(
      <WorldMap
        game={game}
        nums={Array(49).fill(0)}
        onCell={() => {}}
        onFlag={flag}
      />,
    ),
  );
  const frame = () => host.querySelector(".world-neighborhood");
  expect(frame()).not.toBeNull();
  act(() =>
    host
      .querySelector("button")
      .dispatchEvent(new MouseEvent("mouseover", { bubbles: true })),
  );
  const style = frame().getAttribute("style");
  act(() => host.dispatchEvent(new MouseEvent("mouseout", { bubbles: true })));
  expect(frame().getAttribute("style")).toBe(style);
  act(() =>
    root.render(
      <WorldMap
        game={game}
        nums={Array(49).fill(0)}
        disabled
        onCell={() => {}}
        onFlag={flag}
      />,
    ),
  );
  act(() =>
    host
      .querySelector("button")
      .dispatchEvent(new KeyboardEvent("keydown", { key: "f", bubbles: true })),
  );
  expect(flag).not.toHaveBeenCalled();
  act(() => root.unmount());
  host.remove();
});
