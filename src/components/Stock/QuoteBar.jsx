import { TrendingUp, TrendingDown } from 'lucide-react';

function fmtMoney(val) {
  if (!val || isNaN(val)) return '—';
  if (val >= 1e8) return (val / 1e8).toFixed(2) + '亿';
  if (val >= 1e4) return (val / 1e4).toFixed(2) + '万';
  return val.toFixed(0);
}

/**
 * QuoteBar - 报价信息条
 * @param {{ quote: object }} props
 */
export function QuoteBar({ quote }) {
  const price = quote?.price;
  const changePct = quote?.changePct ?? 0;
  const change = quote?.change ?? 0;
  const isUp = changePct >= 0;
  const isFlat = changePct === 0;
  const hasData = price !== undefined;

  // A 股配色：涨红跌绿
  const priceColor = isFlat ? 'text-zinc-200' : isUp ? 'text-red-400' : 'text-green-400';
  const bgColor = isFlat
    ? 'border-zinc-700'
    : isUp
      ? 'border-red-900/30 bg-red-950/20'
      : 'border-green-900/30 bg-green-950/20';

  if (!hasData) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <div className="text-zinc-600 text-sm">等待行情数据...</div>
      </div>
    );
  }

  return (
    <div className={`bg-zinc-900 border rounded-xl p-4 ${bgColor}`}>
      {/* 价格行 */}
      <div className="flex items-baseline gap-3 mb-3">
        <span className={`text-3xl font-mono font-bold ${priceColor}`}>
          {price.toFixed(2)}
        </span>
        <span className={`text-lg font-medium flex items-center gap-1 ${priceColor}`}>
          {isUp ? <TrendingUp size={16} /> : isFlat ? null : <TrendingDown size={16} />}
          {isUp ? '+' : ''}{changePct.toFixed(2)}%
        </span>
        <span className={`text-sm ${priceColor}`}>
          {change >= 0 ? '+' : ''}{change.toFixed(3)}
        </span>
      </div>

      {/* 统计行 */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 text-xs">
        <div className="flex flex-col">
          <span className="text-zinc-500">今开</span>
          <span className="text-zinc-300 font-mono">{quote.open?.toFixed(2) ?? '—'}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-zinc-500">最高</span>
          <span className="text-red-400/80 font-mono">{quote.high?.toFixed(2) ?? '—'}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-zinc-500">最低</span>
          <span className="text-green-400/80 font-mono">{quote.low?.toFixed(2) ?? '—'}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-zinc-500">成交量</span>
          <span className="text-zinc-300 font-mono">{fmtMoney(quote.volume)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-zinc-500">成交额</span>
          <span className="text-zinc-300 font-mono">{fmtMoney(quote.turnover)}</span>
        </div>
      </div>
    </div>
  );
}
