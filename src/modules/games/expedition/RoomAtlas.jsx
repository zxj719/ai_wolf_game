import { roomMask, roomTotal } from "./roomLayout";
import { regionForce } from "./campaignEngine";

export default function RoomAtlas({ campaign, disabled, source, onRoom }) {
  const { layout } = campaign;
  return (
    <div className="room-atlas-panel">
      <header>
        <span>FLOOR BLUEPRINT / B{campaign.depth}</span>
        <strong>{layout.name}</strong>
        <small>
          {campaign.completed.length} / {roomTotal(campaign)} 间已点亮
        </small>
      </header>
      <svg
        className="room-atlas"
        viewBox={`-1 -1 ${layout.width * 10 + 2} ${layout.height * 10 + 2}`}
        role="group"
        aria-label="全层独立房间地图"
      >
        <g className="room-connections" aria-hidden="true">
          {Object.entries(layout.rooms).flatMap(([key, r]) =>
            ["east", "south"].map((d) => {
              const next =
                d === "east" ? `${r.x + 1},${r.y}` : `${r.x},${r.y + 1}`;
              return layout.rooms[next] ? (
                <line
                  key={key + d}
                  x1={r.x * 10 + 5}
                  y1={r.y * 10 + 5}
                  x2={(r.x + (d === "east" ? 1 : 0)) * 10 + 5}
                  y2={(r.y + (d === "south" ? 1 : 0)) * 10 + 5}
                />
              ) : null;
            }),
          )}
        </g>
        {Object.entries(layout.rooms).map(([key, r]) => {
          const known = !!campaign.regions[key],
            clear = campaign.completed.includes(key),
            owner = campaign.occupiers[key];
          const [ax, ay] = campaign.active.split(",").map(Number),
            near = Math.abs(ax - r.x) + Math.abs(ay - r.y) === 1;
          const [sx, sy] = (source || campaign.active).split(",").map(Number);
          const allowed = source
            ? known && Math.abs(sx - r.x) + Math.abs(sy - r.y) === 1
            : known || near;
          const status = clear
            ? "已清扫"
            : known
              ? "已发现"
              : near
                ? "相邻新房间"
                : "未抵达";
          const force = known
            ? regionForce(campaign, key, owner === "enemy" ? "enemy" : "player")
            : 0;
          const contested =
            owner !== "enemy" &&
            known &&
            regionForce(campaign, key, "enemy") > 0;
          const label = `房间 ${r.x + 1} · ${r.y + 1}，${status}${campaign.active === key ? "，当前位置" : ""}${known ? `，${owner === "enemy" ? "敌占" : "我方"}势力 ${force}` : ""}${contested ? `，入侵势力 ${regionForce(campaign, key, "enemy")}` : ""}`;
          const mask = roomMask(7, r.shape),
            path = mask
              .flatMap((v, i) =>
                v ? [`M${1 + (i % 7)},${1 + Math.floor(i / 7)}h1v1h-1z`] : [],
              )
              .join("");
          const roles = Object.values(campaign.regions[key]?.nodes || {})
            .filter((n) => n.role)
            .map((n) => n.name)
            .join("、");
          return (
            <g
              key={key}
              transform={`translate(${r.x * 10},${r.y * 10})`}
              className={`atlas-room ${known ? "visited" : "unvisited"} ${clear ? "cleared" : ""} ${owner === "enemy" ? "enemy" : ""} ${campaign.active === key ? "active" : ""} ${source === key ? "source" : ""}`}
              role="button"
              tabIndex={disabled || !allowed ? -1 : 0}
              aria-disabled={disabled || !allowed}
              aria-label={label}
              onClick={() => {
                if (!disabled && allowed) onRoom(key);
              }}
              onKeyDown={(e) => {
                if (
                  (e.key === "Enter" || e.key === " ") &&
                  !disabled &&
                  allowed
                ) {
                  e.preventDefault();
                  onRoom(key);
                }
              }}
            >
              <title>
                {label}
                {roles ? ` / ${roles}` : ""}
                {known
                  ? ` / 势力 ${regionForce(campaign, key, owner === "enemy" ? "enemy" : "player")}`
                  : ""}
              </title>
              <rect className="room-hit" width="9" height="9" rx="1" />
              <path d={path} />
              {campaign.active === key && <circle cx="4.5" cy="4.5" r="1.4" />}
              {contested && (
                <circle className="contested-marker" cx="7.6" cy="1.4" r="1" />
              )}
              {roles && campaign.active !== key && (
                <text x="4.5" y="6">
                  ⌂
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <footer>
        <span>
          <i /> 未抵达
        </span>
        <span>
          <i /> 已发现
        </span>
        <span>
          <i /> 已清扫
        </span>
        <span>● 当前位置</span>
        <span>红点：交战中 · 红色房间：敌占</span>
      </footer>
      <p>
        {source
          ? "选择相邻房间派出连接队"
          : "点击已发现房间返回，或进入当前房间相邻的新房间。"}
      </p>
    </div>
  );
}
