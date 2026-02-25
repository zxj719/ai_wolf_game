/**
 * OrderBook - 五档盘口显示组件
 * 上方：5 档卖盘（红色，从高到低）
 * 中间：价差
 * 下方：5 档买盘（绿色，从高到低）
 */
export function OrderBook({ depth }) {
  if (!depth || (!depth.asks?.length && !depth.bids?.length)) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <div className="text-xs text-zinc-500 mb-2 font-medium">五档盘口</div>
        <div className="text-sm text-zinc-600 text-center py-6">等待盘口数据...</div>
      </div>
    );
  }

  const { asks = [], bids = [] } = depth;

  // 所有成交量的最大值，用于计算比例条宽度
  const allVolumes = [...asks.map(a => a.volume), ...bids.map(b => b.volume)];
  const maxVolume = Math.max(...allVolumes, 1);

  // 卖盘：显示从高到低（卖5在上，卖1在下）
  const askRows = [];
  for (let i = 4; i >= 0; i--) {
    askRows.push(asks[i] || null);
  }

  // 价差
  const bestAsk = asks[0]?.price;
  const bestBid = bids[0]?.price;
  const spread = bestAsk && bestBid ? bestAsk - bestBid : null;
  const spreadPct = spread && bestBid ? (spread / bestBid) * 100 : null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="text-xs text-zinc-500 mb-3 font-medium">五档盘口</div>

      {/* 卖盘 */}
      <div className="space-y-0.5 mb-2">
        {askRows.map((ask, i) => {
          const label = `卖${5 - i}`;
          if (!ask) {
            return (
              <div key={label} className="flex items-center gap-2 text-xs h-6">
                <span className="w-6 text-zinc-600 shrink-0">{label}</span>
                <span className="text-zinc-700">—</span>
              </div>
            );
          }
          const pct = (ask.volume / maxVolume) * 100;
          return (
            <div key={label} className="flex items-center gap-2 text-xs h-6 relative">
              {/* 背景条 */}
              <div
                className="absolute right-0 top-0 bottom-0 bg-red-500/10 rounded-r"
                style={{ width: `${pct}%` }}
              />
              <span className="w-6 text-zinc-600 shrink-0 relative z-10">{label}</span>
              <span className="flex-1 text-red-400 font-mono relative z-10">{ask.price.toFixed(2)}</span>
              <span className="text-zinc-400 font-mono relative z-10">{fmtVol(ask.volume)}</span>
            </div>
          );
        })}
      </div>

      {/* 价差 */}
      <div className="border-t border-b border-zinc-800 py-1.5 mb-2 text-center">
        {spread !== null ? (
          <span className="text-xs text-zinc-500">
            价差 <span className="text-zinc-300 font-mono">{spread.toFixed(2)}</span>
            <span className="text-zinc-600 ml-1">({spreadPct.toFixed(2)}%)</span>
          </span>
        ) : (
          <span className="text-xs text-zinc-700">—</span>
        )}
      </div>

      {/* 买盘 */}
      <div className="space-y-0.5">
        {[0, 1, 2, 3, 4].map(i => {
          const bid = bids[i];
          const label = `买${i + 1}`;
          if (!bid) {
            return (
              <div key={label} className="flex items-center gap-2 text-xs h-6">
                <span className="w-6 text-zinc-600 shrink-0">{label}</span>
                <span className="text-zinc-700">—</span>
              </div>
            );
          }
          const pct = (bid.volume / maxVolume) * 100;
          return (
            <div key={label} className="flex items-center gap-2 text-xs h-6 relative">
              <div
                className="absolute right-0 top-0 bottom-0 bg-green-500/10 rounded-r"
                style={{ width: `${pct}%` }}
              />
              <span className="w-6 text-zinc-600 shrink-0 relative z-10">{label}</span>
              <span className="flex-1 text-green-400 font-mono relative z-10">{bid.price.toFixed(2)}</span>
              <span className="text-zinc-400 font-mono relative z-10">{fmtVol(bid.volume)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function fmtVol(v) {
  if (!v || isNaN(v)) return '—';
  if (v >= 1e4) return (v / 1e4).toFixed(0) + '万';
  return v.toFixed(0);
}
