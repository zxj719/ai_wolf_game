import { useState } from "react";
import { Flag, Box, User, Zap } from "lucide-react";

// Shared by the teaching board and the expedition. The outline is a real 3 × 3 area.
export default function Minefield({
  side = 9,
  nums,
  revealed,
  flags,
  blasts = [],
  loot = [],
  destroyed = [],
  latest = [],
  onOpen,
  onFlag,
  pinned,
  target,
  entry,
  label = "地下勘探地图",
}) {
  const [hover, setHover] = useState(entry ?? Math.floor((side * side) / 2));
  const active = pinned ?? hover;
  const row = active == null ? 0 : Math.floor(active / side);
  const col = active == null ? 0 : active % side;
  const top = Math.max(0, row - 1),
    left = Math.max(0, col - 1);
  const bottom = Math.min(side - 1, row + 1),
    right = Math.min(side - 1, col + 1);
  return (
    <div
      className="echo-field"
      style={{ "--side": side }}
      role="group"
      aria-label={label}
    >
      {nums.map((n, i) => {
        const open = !!revealed[i],
          blast = !!blasts[i];
        const item = open && !destroyed[i] ? loot[i] : 0;
        const status = blast
          ? "爆坑"
          : flags[i]
            ? "已标记"
            : open
              ? `${n} 颗相邻地雷${item === 1 ? "，物资已回收" : item === 2 ? "，幸存者已获救" : ""}`
              : i === entry
                ? "安全入口"
                : "未探索";
        return (
          <button
            key={i}
            type="button"
            className={`echo-cell ${open ? `open number-${n}` : ""} ${blast ? "blast" : ""} ${flags[i] ? "flagged" : ""} ${latest.includes(i) ? "fresh" : ""} ${target === i ? "target" : ""} ${!open && i === entry ? "entry" : ""}`}
            aria-label={`${Math.floor(i / side) + 1} 行 ${(i % side) + 1} 列，${status}`}
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onClick={() => {
              setHover(i);
              onOpen(i);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              onFlag(i);
            }}
            onKeyDown={(e) => {
              if (e.key.toLowerCase() === "f") {
                e.preventDefault();
                onFlag(i);
              }
            }}
          >
            {blast ? (
              <Zap size={17} />
            ) : flags[i] ? (
              <Flag size={17} />
            ) : open ? (
              <>
                <span>{n || ""}</span>
                {item > 0 && (
                  <small className="cell-find">
                    {item === 2 ? <User size={10} /> : <Box size={10} />}
                  </small>
                )}
                {destroyed[i] === 1 && <small className="cell-find">×</small>}
              </>
            ) : i === entry ? (
              <span>↓</span>
            ) : (
              <span className="buried-dot" />
            )}
          </button>
        );
      })}
      {active != null && (
        <div
          aria-hidden="true"
          className="echo-neighborhood"
          style={{
            left: `${(left / side) * 100}%`,
            top: `${(top / side) * 100}%`,
            width: `${((right - left + 1) / side) * 100}%`,
            height: `${((bottom - top + 1) / side) * 100}%`,
          }}
        />
      )}
    </div>
  );
}
