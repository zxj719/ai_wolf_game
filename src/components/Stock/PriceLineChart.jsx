import { useState, useCallback } from 'react';

/**
 * PriceLineChart - 分时价格折线图（SVG）
 * @param {{ prices: number[], height?: number }} props
 */
export function PriceLineChart({ prices, height = 260 }) {
  const [hoverIdx, setHoverIdx] = useState(-1);
  const width = 800; // viewBox 虚拟宽度，实际响应式

  if (!prices || prices.length < 2) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-zinc-600 text-sm">
        等待实时数据积累中...
      </div>
    );
  }

  const pad = { top: 16, right: 50, bottom: 24, left: 10 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const padRange = range * 0.08;
  const yMin = min - padRange;
  const yMax = max + padRange;
  const yRange = yMax - yMin;

  const toX = (i) => pad.left + (i / (prices.length - 1)) * chartW;
  const toY = (p) => pad.top + (1 - (p - yMin) / yRange) * chartH;

  // 折线路径
  const linePath = prices.map((p, i) => `${toX(i).toFixed(1)},${toY(p).toFixed(1)}`).join(' ');

  // 渐变填充路径
  const areaPath = `M${toX(0).toFixed(1)},${toY(prices[0]).toFixed(1)} ` +
    prices.map((p, i) => `L${toX(i).toFixed(1)},${toY(p).toFixed(1)}`).join(' ') +
    ` L${toX(prices.length - 1).toFixed(1)},${pad.top + chartH} L${toX(0).toFixed(1)},${pad.top + chartH} Z`;

  const isUp = prices[prices.length - 1] >= prices[0];
  const lineColor = isUp ? '#ef4444' : '#22c55e';
  const fillId = isUp ? 'priceGradUp' : 'priceGradDown';
  const gradColors = isUp ? ['rgba(239,68,68,0.25)', 'rgba(239,68,68,0)'] : ['rgba(34,197,94,0.25)', 'rgba(34,197,94,0)'];

  // Y 轴标签
  const yLabels = [];
  for (let i = 0; i <= 4; i++) {
    const val = yMin + (yRange * i) / 4;
    yLabels.push({ val, y: toY(val) });
  }

  // hover
  const hoverPrice = hoverIdx >= 0 ? prices[hoverIdx] : null;
  const hoverX = hoverIdx >= 0 ? toX(hoverIdx) : 0;
  const hoverY = hoverIdx >= 0 ? toY(hoverPrice) : 0;

  const handleMouseMove = useCallback((e) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width * width;
    const idx = Math.round(((relX - pad.left) / chartW) * (prices.length - 1));
    if (idx >= 0 && idx < prices.length) {
      setHoverIdx(idx);
    } else {
      setHoverIdx(-1);
    }
  }, [prices.length, chartW]);

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height: height + 'px' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIdx(-1)}
      >
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={gradColors[0]} />
            <stop offset="100%" stopColor={gradColors[1]} />
          </linearGradient>
        </defs>

        {/* 网格线 + Y 轴标签 */}
        {yLabels.map(({ val, y }, i) => (
          <g key={i}>
            <line x1={pad.left} y1={y} x2={width - pad.right} y2={y}
              stroke="#27272a" strokeWidth="0.5" />
            <text x={width - 4} y={y + 3} textAnchor="end"
              fill="#71717a" fontSize="10" fontFamily="monospace">
              {val >= 1000 ? val.toFixed(0) : val.toFixed(2)}
            </text>
          </g>
        ))}

        {/* 渐变填充 */}
        <path d={areaPath} fill={`url(#${fillId})`} />

        {/* 折线 */}
        <polyline points={linePath} fill="none" stroke={lineColor}
          strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* hover 光标 */}
        {hoverIdx >= 0 && (
          <>
            <line x1={hoverX} y1={pad.top} x2={hoverX} y2={pad.top + chartH}
              stroke="rgba(161,161,170,0.4)" strokeWidth="0.5" strokeDasharray="3,3" />
            <circle cx={hoverX} cy={hoverY} r="3" fill={lineColor} stroke="#18181b" strokeWidth="1.5" />
            {/* 价格标签 */}
            <rect x={hoverX - 30} y={hoverY - 20} width="60" height="16" rx="3"
              fill="#3f3f46" />
            <text x={hoverX} y={hoverY - 9} textAnchor="middle"
              fill="#e4e4e7" fontSize="10" fontFamily="monospace">
              {hoverPrice >= 1000 ? hoverPrice.toFixed(0) : hoverPrice.toFixed(2)}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}
