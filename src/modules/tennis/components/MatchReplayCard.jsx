import { MOVES } from '../battle/moves';

export function MatchReplayCard({ rallyLog, matchStats }) {
  if (!rallyLog?.length) return null;
  const top = matchStats?.topRally;
  const usage = matchStats?.moveUsage ?? {};
  const sortedMoves = Object.entries(usage).sort(([, a], [, b]) => b - a).slice(0, 3);

  return (
    <div className="card flat replay-card">
      <h2>🎬 对局回顾</h2>

      {top && (
        <div className="replay-section">
          <span className="replay-label">本场最佳一击</span>
          <div className="replay-best-rally">
            <span className="rp-movetext">{MOVES[top.pMove]?.name ?? top.pMove}</span>
            {top.counterMul > 1 && <span className="rp-counter">（克制）</span>}
            <span className="rp-vs"> vs </span>
            <span className="rp-movetext rp-opp">{MOVES[top.oppMove]?.name ?? top.oppMove}</span>
            <span className="rp-mult">×{top.pMultiplier.toFixed(2)}</span>
          </div>
        </div>
      )}

      {sortedMoves.length > 0 && (
        <div className="replay-section">
          <span className="replay-label">惯用招式（本场）</span>
          <div className="replay-usage">
            {sortedMoves.map(([id, cnt]) => (
              <span key={id} className="replay-usage-pill">
                {MOVES[id]?.name ?? id} ×{cnt}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="replay-section">
        <span className="replay-label">最后 {rallyLog.length} 球</span>
        <div className="replay-timeline">
          {rallyLog.map((r, i) => (
            <div
              key={i}
              className={`rp-rally${r.win ? ' rp-rally--win' : ' rp-rally--lose'}${r.clutch ? ' rp-rally--clutch' : ''}`}
              title={`${MOVES[r.pMove]?.name ?? r.pMove} vs ${MOVES[r.oppMove]?.name ?? r.oppMove}${r.clutch ? ' · CLUTCH！' : r.keyPoint ? ' · 关键球' : ''}`}
            >
              <span className="rp-move-name">{MOVES[r.pMove]?.name ?? r.pMove}</span>
              <span className="rp-tick">{r.win ? '✓' : '✗'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
