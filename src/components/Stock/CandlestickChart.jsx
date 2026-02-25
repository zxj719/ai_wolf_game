import { useRef, useEffect, useState, useCallback } from 'react';

const PADDING = { top: 20, right: 60, bottom: 30, left: 10 };
const VOLUME_HEIGHT_RATIO = 0.2;
const MIN_CANDLE_WIDTH = 3;
const MAX_CANDLE_WIDTH = 20;

function formatPrice(v) {
  return v >= 1000 ? v.toFixed(0) : v.toFixed(2);
}

function formatVolume(v) {
  if (v >= 1e8) return (v / 1e8).toFixed(1) + '亿';
  if (v >= 1e4) return (v / 1e4).toFixed(0) + '万';
  return v.toFixed(0);
}

function formatTime(ts, periodKey) {
  const d = new Date(ts * 1000);
  if (['MIN1', 'MIN5', 'MIN15', 'MIN60'].includes(periodKey)) {
    return `${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}

/**
 * CandlestickChart - 纯 Canvas K 线蜡烛图
 * @param {{ candles: Array, periodKey: string, height?: number }} props
 */
export function CandlestickChart({ candles, periodKey = 'DAY', height = 360 }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height });
  const [viewRange, setViewRange] = useState(null); // { start, end }
  const [hoverIndex, setHoverIndex] = useState(-1);
  const [mousePos, setMousePos] = useState(null);

  // 响应式宽度
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width;
      if (w > 0) setDimensions(prev => ({ ...prev, width: Math.floor(w) }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 数据变化时重置视窗
  useEffect(() => {
    if (!candles?.length) return;
    const visible = Math.min(candles.length, Math.floor((dimensions.width - PADDING.left - PADDING.right) / 8));
    setViewRange({ start: Math.max(0, candles.length - visible), end: candles.length });
    setHoverIndex(-1);
  }, [candles, dimensions.width]);

  // 滚轮缩放 + 平移
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    if (!candles?.length || !viewRange) return;

    const { start, end } = viewRange;
    const len = candles.length;

    if (e.ctrlKey || Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      // 缩放
      const zoomDelta = e.deltaY > 0 ? 5 : -5;
      const newStart = Math.max(0, start - zoomDelta);
      const newEnd = Math.min(len, end + zoomDelta);
      if (newEnd - newStart >= 10 && newEnd - newStart <= len) {
        setViewRange({ start: newStart, end: newEnd });
      }
    } else {
      // 平移
      const panDelta = e.deltaX > 0 ? 3 : -3;
      const count = end - start;
      let newStart = start + panDelta;
      let newEnd = end + panDelta;
      if (newStart < 0) { newStart = 0; newEnd = count; }
      if (newEnd > len) { newEnd = len; newStart = len - count; }
      setViewRange({ start: Math.max(0, newStart), end: Math.min(len, newEnd) });
    }
  }, [candles, viewRange]);

  // 鼠标移动 → hover index
  const handleMouseMove = useCallback((e) => {
    if (!candles?.length || !viewRange) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });

    const { start, end } = viewRange;
    const visibleCount = end - start;
    const chartWidth = dimensions.width - PADDING.left - PADDING.right;
    const candleWidth = chartWidth / visibleCount;
    const idx = Math.floor((x - PADDING.left) / candleWidth);
    if (idx >= 0 && idx < visibleCount) {
      setHoverIndex(start + idx);
    } else {
      setHoverIndex(-1);
    }
  }, [candles, viewRange, dimensions.width]);

  const handleMouseLeave = useCallback(() => {
    setHoverIndex(-1);
    setMousePos(null);
  }, []);

  // Canvas 绘制
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !candles?.length || !viewRange) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const { width: W, height: H } = dimensions;

    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.scale(dpr, dpr);

    // 清空
    ctx.fillStyle = '#18181b'; // zinc-900
    ctx.fillRect(0, 0, W, H);

    const { start, end } = viewRange;
    const visible = candles.slice(start, end);
    if (!visible.length) return;

    const chartWidth = W - PADDING.left - PADDING.right;
    const priceHeight = (H - PADDING.top - PADDING.bottom) * (1 - VOLUME_HEIGHT_RATIO);
    const volumeTop = PADDING.top + priceHeight + 8;
    const volumeHeight = (H - PADDING.top - PADDING.bottom) * VOLUME_HEIGHT_RATIO - 8;

    const candleWidth = Math.max(MIN_CANDLE_WIDTH, Math.min(MAX_CANDLE_WIDTH, chartWidth / visible.length));
    const bodyWidth = Math.max(1, candleWidth * 0.7);
    const gap = (chartWidth - candleWidth * visible.length) / 2;

    // 价格范围
    let minPrice = Infinity, maxPrice = -Infinity, maxVolume = 0;
    for (const c of visible) {
      if (c.low < minPrice) minPrice = c.low;
      if (c.high > maxPrice) maxPrice = c.high;
      if (c.volume > maxVolume) maxVolume = c.volume;
    }
    const priceRange = maxPrice - minPrice || 1;
    const pricePad = priceRange * 0.05;
    minPrice -= pricePad;
    maxPrice += pricePad;
    const finalPriceRange = maxPrice - minPrice;

    const priceToY = (p) => PADDING.top + (1 - (p - minPrice) / finalPriceRange) * priceHeight;
    const volumeToY = (v) => volumeTop + volumeHeight - (v / (maxVolume || 1)) * volumeHeight;

    // 网格线 + Y 轴价格标签
    ctx.strokeStyle = '#27272a'; // zinc-800
    ctx.lineWidth = 0.5;
    ctx.fillStyle = '#71717a'; // zinc-500
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    const gridCount = 5;
    for (let i = 0; i <= gridCount; i++) {
      const price = minPrice + (finalPriceRange * i) / gridCount;
      const y = priceToY(price);
      ctx.beginPath();
      ctx.moveTo(PADDING.left, y);
      ctx.lineTo(W - PADDING.right, y);
      ctx.stroke();
      ctx.fillText(formatPrice(price), W - 4, y + 3);
    }

    // X 轴时间标签
    ctx.textAlign = 'center';
    const labelInterval = Math.max(1, Math.floor(visible.length / 6));
    for (let i = 0; i < visible.length; i += labelInterval) {
      const x = PADDING.left + gap + i * candleWidth + candleWidth / 2;
      const label = formatTime(visible[i].time, periodKey);
      ctx.fillText(label, x, H - 4);
    }

    // 绘制蜡烛
    for (let i = 0; i < visible.length; i++) {
      const c = visible[i];
      const isUp = c.close >= c.open;
      const color = isUp ? '#ef4444' : '#22c55e'; // 红涨绿跌（A 股）

      const x = PADDING.left + gap + i * candleWidth + candleWidth / 2;
      const bodyX = x - bodyWidth / 2;

      // 影线
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, priceToY(c.high));
      ctx.lineTo(x, priceToY(c.low));
      ctx.stroke();

      // 蜡烛体
      const openY = priceToY(c.open);
      const closeY = priceToY(c.close);
      const bodyH = Math.max(1, Math.abs(closeY - openY));
      ctx.fillStyle = isUp ? color : color;
      if (isUp) {
        // 阳线：空心或实心
        ctx.fillRect(bodyX, closeY, bodyWidth, bodyH);
      } else {
        ctx.fillRect(bodyX, openY, bodyWidth, bodyH);
      }

      // 成交量柱
      const vColor = isUp ? 'rgba(239,68,68,0.5)' : 'rgba(34,197,94,0.5)';
      ctx.fillStyle = vColor;
      const vY = volumeToY(c.volume);
      const vH = volumeTop + volumeHeight - vY;
      ctx.fillRect(bodyX, vY, bodyWidth, Math.max(1, vH));
    }

    // hover 十字光标
    if (hoverIndex >= start && hoverIndex < end && mousePos) {
      const hi = hoverIndex - start;
      const hx = PADDING.left + gap + hi * candleWidth + candleWidth / 2;

      // 竖线
      ctx.strokeStyle = 'rgba(161,161,170,0.4)';
      ctx.lineWidth = 0.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(hx, PADDING.top);
      ctx.lineTo(hx, H - PADDING.bottom);
      ctx.stroke();

      // 横线
      ctx.beginPath();
      ctx.moveTo(PADDING.left, mousePos.y);
      ctx.lineTo(W - PADDING.right, mousePos.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // 价格标签（右侧）
      const hoverPrice = minPrice + (1 - (mousePos.y - PADDING.top) / priceHeight) * finalPriceRange;
      if (hoverPrice >= minPrice && hoverPrice <= maxPrice) {
        ctx.fillStyle = '#3f3f46';
        ctx.fillRect(W - PADDING.right, mousePos.y - 8, PADDING.right, 16);
        ctx.fillStyle = '#e4e4e7';
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(formatPrice(hoverPrice), W - 4, mousePos.y + 4);
      }
    }
  }, [candles, viewRange, dimensions, hoverIndex, mousePos, periodKey]);

  // hover 信息面板
  const hoverCandle = hoverIndex >= 0 && candles?.[hoverIndex];

  return (
    <div ref={containerRef} className="relative w-full">
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: height + 'px', cursor: 'crosshair' }}
        onWheel={handleWheel}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
      {/* OHLCV Hover 信息 */}
      {hoverCandle && (
        <div className="absolute top-1 left-2 flex gap-3 text-[10px] font-mono pointer-events-none">
          <span className="text-zinc-500">{formatTime(hoverCandle.time, periodKey)}</span>
          <span className="text-zinc-400">开 <b className="text-zinc-200">{formatPrice(hoverCandle.open)}</b></span>
          <span className="text-zinc-400">高 <b className="text-red-400">{formatPrice(hoverCandle.high)}</b></span>
          <span className="text-zinc-400">低 <b className="text-green-400">{formatPrice(hoverCandle.low)}</b></span>
          <span className="text-zinc-400">收 <b className="text-zinc-200">{formatPrice(hoverCandle.close)}</b></span>
          <span className="text-zinc-400">量 <b className="text-zinc-200">{formatVolume(hoverCandle.volume)}</b></span>
        </div>
      )}
    </div>
  );
}
