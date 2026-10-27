const point = (i, n) => [(i % n) + 0.5, Math.floor(i / n) + 0.5];
export default function BridgeOverlay({ game, trace = [], firstRow = 0, rows = game.size }) {
  const n = game.size;
  const path = (a, b) => {
    const [x, y] = point(a, n),
      [u, v] = point(b, n);
    return `M${x},${y} L${u},${v}`;
  };
  return (
    <svg
      className="bridge-overlay"
      viewBox={`0 ${firstRow} ${n} ${rows}`}
      aria-hidden="true"
    >
      {Object.entries(game.bridges).map(([to, b]) => (
        <g
          key={`${to}-${b.parent}-${b.owner}`}
          className={
            b.owner === "enemy" ? "bridge-visual hostile" : "bridge-visual"
          }
        >
          <path className="bridge-bed" d={path(b.parent, Number(to))} />
          <path
            className="bridge-built"
            pathLength="1"
            d={path(b.parent, Number(to))}
          />
          <circle className="bridge-flow-dot" r=".045">
            <animateMotion
              path={path(b.parent, Number(to))}
              dur="1.6s"
              repeatCount="indefinite"
            />
          </circle>
        </g>
      ))}
      {trace.length > 1 && (
        <polyline
          className="route-preview-line"
          points={trace.map((i) => point(i, n).join(",")).join(" ")}
        />
      )}
      {game.packets.map((p) => {
        const from =
          p.step > 0
            ? p.path[p.step - 1]
            : (game.bridges[p.position]?.parent ?? p.position);
        return (
          <g
            key={`move-${p.id}-${game.turn}`}
            className={`moving-unit ${p.owner === "enemy" ? "hostile" : ""}`}
          >
            <animateMotion
              path={path(from, p.position)}
              dur=".55s"
              fill="freeze"
            />
            <circle r=".15" />
            <text textAnchor="middle" dy=".07">
              {p.amount}
            </text>
          </g>
        );
      })}
      {(game.deliveries || []).map((p) => (
        <g
          key={`arrival-${p.id}-${game.turn}`}
          className={`arriving-unit ${p.owner === "enemy" ? "hostile" : ""}`}
        >
          <animateMotion path={path(p.from, p.to)} dur=".55s" fill="freeze" />
          <circle r=".17" />
          <text textAnchor="middle" dy=".07">
            {p.kind === "attack"
              ? p.captured
                ? "占领"
                : `−${p.amount}`
              : `+${p.amount}`}
          </text>
        </g>
      ))}
    </svg>
  );
}
