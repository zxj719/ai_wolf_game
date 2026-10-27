import BridgeOverlay from "./BridgeOverlay";
import { useState, useRef } from "react";
import { Flag, Zap } from "lucide-react";
import { hasFloor } from "./roomLayout";

export default function WorldMap({
  game,
  nums,
  tactical = false,
  selected,
  onCell,
  onFlag,
  disabled = false,
  preview,
  onHover,
  trace = [],
  guide = [],
  showUnits = true,
}) {
  const [last, setLast] = useState(null);
  const touch = useRef(null),
    suppressClick = useRef(0);
  const side = game.size;
  const floorCells = Array.from({ length: side ** 2 }, (_, i) => i).filter((i) => hasFloor(game, i));
  const firstRow = Math.floor((floorCells[0] ?? 0) / side), lastRow = Math.floor((floorCells.at(-1) ?? side ** 2 - 1) / side);
  const rows = lastRow - firstRow + 1;
  const cells = Array.from({ length: rows * side }, (_, i) => firstRow * side + i);
  const active =
    last != null && cells.includes(last) && hasFloor(game, last)
      ? last
      : floorCells[Math.floor(floorCells.length / 2)] ?? 0;
  const r = Math.floor(active / side), c = active % side;
  const top = Math.max(firstRow, r - 1),
    left = Math.max(0, c - 1),
    bottom = Math.min(lastRow, r + 1),
    right = Math.min(side - 1, c + 1);
  return (
    <div
      className={`world-grid ${trace.length ? "drawing" : ""} ${tactical ? "tactical-grid" : "survey-grid"} ${game.explosions.length && !tactical ? "recent-blast" : ""}`}
      style={{ "--side": side }}
      onPointerDown={(e) => {
        if (e.pointerType === "touch" && trace.length && !disabled) {
          touch.current = { x: e.clientX, y: e.clientY, moved: false };
          e.currentTarget.setPointerCapture(e.pointerId);
        }
      }}
      onPointerMove={(e) => {
        if (touch.current && !disabled) {
          if (
            Math.hypot(
              e.clientX - touch.current.x,
              e.clientY - touch.current.y,
            ) > 5
          )
            touch.current.moved = true;
          const cell = document
            .elementFromPoint(e.clientX, e.clientY)
            ?.closest("[data-cell]");
          if (cell && e.currentTarget.contains(cell))
            onHover?.(Number(cell.dataset.cell));
        }
      }}
      onPointerUp={(e) => {
        if (touch.current?.moved) {
          const cell = document
            .elementFromPoint(e.clientX, e.clientY)
            ?.closest("[data-cell]");
          if (cell && e.currentTarget.contains(cell)) {
            e.preventDefault();
            suppressClick.current = Date.now() + 400;
            onCell(Number(cell.dataset.cell));
          }
        }
        touch.current = null;
      }}
      onPointerCancel={() => {
        touch.current = null;
      }}
      role="group"
      aria-label={tactical ? "势力地图" : "清扫地图"}
    >
      {cells.map((i) => {
        if (!hasFloor(game, i))
          return <span key={i} className="room-void" aria-hidden="true" />;
        const node = !showUnits || game.pendingStart ? null : game.nodes[i],
          bridge = showUnits ? game.bridges[i] : null,
          known = game.revealed[i],
          blast = game.blasts[i],
          n = nums[i];
        const dir = bridge ? i - bridge.parent : 0;
        const arrow =
          dir === 1 ? "→" : dir === -1 ? "←" : dir === game.size ? "↓" : "↑";
        const state = node
          ? `${node.owner === "enemy" ? "敌方" : "我方"}${node.name}，势力 ${node.power}`
          : bridge
            ? `${bridge.owner === "enemy" ? "敌方" : "我方"}通路${arrow}`
            : blast
              ? "爆坑"
              : game.flags[i]
                ? "已标记"
                : known
                  ? `${n} 颗相邻地雷`
                  : "未知";
        return (
          <button
            key={`${game.depth}-${i}`}
            type="button"
            data-cell={i}
            disabled={disabled}
            onClick={() => {
              if (Date.now() < suppressClick.current) return;
              setLast(i);
              onCell(i);
            }}
            onMouseEnter={() => {
              setLast(i);
              onHover?.(i);
            }}
            onFocus={() => {
              setLast(i);
              onHover?.(i);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              if (!disabled && !tactical) {
                setLast(i);
                onFlag(i);
              }
            }}
            onKeyDown={(e) => {
              const delta = {
                ArrowUp: -side,
                ArrowDown: side,
                ArrowLeft: -1,
                ArrowRight: 1,
              }[e.key];
              if (delta && !disabled) {
                e.preventDefault();
                const next = i + delta;
                if (
                  next >= 0 &&
                  next < side * side &&
                  (Math.abs(delta) !== 1 ||
                    Math.floor(next / side) === Math.floor(i / side))
                )
                  e.currentTarget.parentElement
                    .querySelector(`[data-cell="${next}"]`)
                    ?.focus();
              }

              if (!disabled && !tactical && e.key.toLowerCase() === "f") {
                e.preventDefault();
                setLast(i);
                onFlag(i);
              }
            }}
            aria-label={`${Math.floor(i / game.size) + 1} 行 ${(i % game.size) + 1} 列，${state}`}
            aria-pressed={tactical ? selected === i : undefined}
            className={`world-cell ${guide.includes(i) ? "guide-cell" : ""} ${known ? "known" : "unknown"} ${game.flags[i] ? "flagged" : ""} ${known && !node && !bridge ? `number-${n}` : ""} ${node ? `node owner-${node.owner}` : ""} ${bridge && !node ? `bridge owner-${bridge.owner}` : ""} ${blast ? "crater" : ""} ${game.explosions.includes(i) ? "impact" : ""} ${game.latest.includes(i) ? "just-cleared" : ""} ${trace.includes(i) ? "route-cell" : ""} ${selected === i && tactical ? "chosen" : ""} ${preview?.tiles.includes(i) ? (preview.valid ? "home-valid" : "home-invalid") : ""}`}
          >
            {tactical && node ? (
              <>
                <span className="node-glyph">
                  {node.kind === "role"
                    ? "◉"
                    : node.kind === "raider"
                      ? "▼"
                      : "⌂"}
                </span>
                <strong>{node.power}</strong>
              </>
            ) : tactical && bridge ? (
              <span className="bridge-arrow">{arrow}</span>
            ) : blast ? (
              <Zap size={tactical ? 11 : 23} />
            ) : game.flags[i] ? (
              <Flag size={tactical ? 10 : 20} />
            ) : known ? (
              <span className="cell-number">{n || ""}</span>
            ) : (
              <span className="unknown-mark">·</span>
            )}
            {!tactical && node && (
              <small className={`survey-node owner-${node.owner}`}>
                {node.owner === "enemy"
                  ? "▼"
                  : node.kind === "role"
                    ? node.name
                    : "⌂"}
              </small>
            )}
            {!tactical && bridge && !node && (
              <small className="survey-node">{arrow}</small>
            )}
            {!!known &&
              !node &&
              game.loot[i] > 0 &&
              !game.destroyed[i] &&
              !tactical && (
                <small className="world-loot">
                  {game.loot[i] === 2 ? "♧" : "◇"}
                </small>
              )}
          </button>
        );
      })}
      {showUnits && <BridgeOverlay game={game} trace={trace} firstRow={firstRow} rows={rows} />}
      {!tactical && (
        <div
          className="world-neighborhood"
          aria-label="当前格的九宫格范围"
          style={{
            top: `${((top - firstRow) / rows) * 100}%`,
            left: `${(left / side) * 100}%`,
            width: `${((right - left + 1) / side) * 100}%`,
            height: `${((bottom - top + 1) / rows) * 100}%`,
          }}
        />
      )}
      {!tactical && game.explosions.length > 0 && (
        <div key={game.turn} className="blast-flash" aria-hidden="true" />
      )}
    </div>
  );
}
