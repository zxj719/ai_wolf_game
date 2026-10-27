import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FieldGuide from "../FieldGuide";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
describe("九宫格操作教学", () => {
  let container, root;
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });
  const button = (text) =>
    [...container.querySelectorAll("button")].find((b) =>
      b.textContent.includes(text),
    );
  const cell = (r, c) =>
    container.querySelector(`button[aria-label^="${r} 行 ${c} 列"]`);
  const click = (el) =>
    act(() => el.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  it("要求正确的开格、右键标记和数字展开，框线全程可见", () => {
    const done = vi.fn();
    act(() => root.render(<FieldGuide onComplete={done} />));
    click(button("试着操作"));
    click(cell(1, 3));
    expect(container.textContent).toContain("左键，打开安全格");
    click(cell(3, 1));
    expect(container.textContent).toContain("左键，打开安全格");
    click(button("下一步"));
    expect(container.textContent).toContain("右键，标记地雷");
    act(() =>
      cell(1, 3).dispatchEvent(
        new MouseEvent("contextmenu", { bubbles: true }),
      ),
    );
    click(button("下一步"));
    expect(container.textContent).toContain("再点数字，一次展开");
    expect(container.querySelector(".echo-neighborhood")).not.toBeNull();
    click(cell(2, 2));
    expect(container.querySelectorAll(".echo-cell.open")).toHaveLength(8);
    click(button("下一步"));
    click(button("开始探索"));
    expect(done).toHaveBeenCalledTimes(1);
  });
  it("手机无需右键即可完成插旗，并可从头重看", () => {
    act(() => root.render(<FieldGuide onComplete={() => {}} />));
    click(button("试着操作"));
    click(cell(3, 1));
    click(button("下一步"));
    click(button("手机：开启标记"));
    click(cell(1, 3));
    click(button("下一步"));
    expect(container.textContent).toContain("再点数字，一次展开");
    click(button("重看"));
    expect(container.textContent).toContain("先看周围八格");
  });
});
