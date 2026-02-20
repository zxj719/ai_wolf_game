import { useState, useMemo } from 'react';
import {
  ChevronLeft, TrendingUp, TrendingDown,
  Wifi, WifiOff, Loader2, Plus, X, ChevronDown, Clock,
} from 'lucide-react';
import { useStockWS } from './useStockWS';
import { DEFAULT_WATCHLIST, MARKETS } from '../../config/stockConfig';

/**
 * 判断 A 股当前是否处于交易时段（北京时间）
 * 上午：09:30–11:30 / 下午：13:00–15:00 / 仅周一至周五
 */
function getAShareMarketStatus() {
  // 转换为北京时间（UTC+8）
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
  const day = now.getDay(); // 0=周日, 6=周六
  if (day === 0 || day === 6) return { open: false, reason: '周末休市' };

  const h = now.getHours();
  const m = now.getMinutes();
  const t = h * 60 + m; // 当前分钟数

  if (t >= 9 * 60 + 30 && t < 11 * 60 + 30) return { open: true, session: '上午场' };
  if (t >= 13 * 60 && t < 15 * 60)           return { open: true, session: '下午场' };
  if (t < 9 * 60 + 30)  return { open: false, reason: `未开盘，09:30 开市` };
  if (t < 13 * 60)       return { open: false, reason: `午间休市，13:00 恢复` };
  return { open: false, reason: '已收盘，明日 09:30 开市' };
}

// 纯 SVG Sparkline 折线图
function Sparkline({ prices, isUp, width = 72, height = 28 }) {
  if (!prices || prices.length < 2) {
    return <div style={{ width, height }} className="flex items-end text-zinc-700 text-xs pb-1">—</div>;
  }
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const points = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * width;
    const y = height - ((p - min) / range) * (height - 2) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const color = isUp ? '#22c55e' : '#ef4444';
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline points={points} fill="none" stroke={color}
        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
    </svg>
  );
}

// WebSocket 状态指示
function StatusBadge({ status }) {
  const map = {
    connected:    { dot: 'bg-green-500',            text: '实时', color: 'text-green-400' },
    connecting:   { dot: 'bg-amber-400 animate-pulse', text: '连接中', color: 'text-amber-400' },
    disconnected: { dot: 'bg-zinc-500',             text: '已断开', color: 'text-zinc-400' },
    error:        { dot: 'bg-red-500',              text: '错误', color: 'text-red-400' },
  };
  const cfg = map[status] ?? map.disconnected;
  return (
    <span className={`flex items-center gap-1.5 text-xs ${cfg.color}`}>
      <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
      {cfg.text}
    </span>
  );
}

// 格式化大数字（成交额）
function fmtMoney(val) {
  if (!val || isNaN(val)) return '—';
  if (val >= 1e8) return (val / 1e8).toFixed(2) + '亿';
  if (val >= 1e4) return (val / 1e4).toFixed(2) + '万';
  return val.toFixed(0);
}

// 单只 A 股行情卡片
function StockCard({ symbol, name, quote, onRemove, marketStatus }) {
  const changePct = quote?.changePct ?? 0;
  const isUp = changePct >= 0;
  const isFlat = changePct === 0;
  const hasData = quote?.price !== undefined;

  const priceColor = isFlat ? 'text-zinc-300' : isUp ? 'text-red-400' : 'text-green-400';
  // A 股：涨为红，跌为绿（国内习惯）

  return (
    <div className="group relative bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-600 transition-all">
      {/* 移除按钮 */}
      <button
        onClick={() => onRemove(symbol)}
        className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center text-zinc-600 hover:text-red-400 transition-all"
        title="移除"
      >
        <X size={12} />
      </button>

      {/* 头部：名称 + Sparkline */}
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0 pr-2">
          <div className="text-white font-semibold text-sm truncate">{name || symbol}</div>
          <div className="text-zinc-500 text-xs mt-0.5 font-mono">{symbol}</div>
        </div>
        <Sparkline prices={quote?.priceHistory} isUp={isUp} />
      </div>

      {hasData ? (
        <>
          {/* 价格 + 涨跌 */}
          <div className="flex items-baseline justify-between mt-1">
            <span className={`text-xl font-mono font-bold ${priceColor}`}>
              {quote.price.toFixed(2)}
            </span>
            <span className={`text-sm font-medium flex items-center gap-0.5 ${priceColor}`}>
              {isUp ? <TrendingUp size={13} /> : isFlat ? null : <TrendingDown size={13} />}
              {isUp ? '+' : ''}{changePct.toFixed(2)}%
            </span>
          </div>

          {/* 涨跌额 + 成交额 */}
          <div className="flex justify-between mt-1.5 text-xs text-zinc-500">
            <span>
              {quote.change >= 0 ? '+' : ''}{(quote.change ?? 0).toFixed(3)}
            </span>
            <span>成交 {fmtMoney(quote.turnover)}</span>
          </div>

          {/* 最高/最低 */}
          {(quote.high || quote.low) && (
            <div className="flex justify-between mt-1 text-xs">
              <span className="text-red-400/70">高 {quote.high?.toFixed(2)}</span>
              <span className="text-green-400/70">低 {quote.low?.toFixed(2)}</span>
            </div>
          )}
        </>
      ) : (
        <div className="text-zinc-600 text-xs mt-3 flex items-center gap-1.5">
          {marketStatus?.open
            ? <><Loader2 size={12} className="animate-spin" /> 等待推送...</>
            : <><Clock size={12} /> {marketStatus?.reason ?? '非交易时段'}</>
          }
        </div>
      )}
    </div>
  );
}

export function StockPage({ onBack }) {
  const [market, setMarket] = useState('stock');
  const [watchlist, setWatchlist] = useState(() => {
    try {
      const saved = sessionStorage.getItem('stock_watchlist');
      return saved ? JSON.parse(saved) : DEFAULT_WATCHLIST;
    } catch {
      return DEFAULT_WATCHLIST;
    }
  });
  const [searchInput, setSearchInput] = useState('');
  const [showDebug, setShowDebug] = useState(false);
  const [showMarketMenu, setShowMarketMenu] = useState(false);

  const currentList = watchlist[market] ?? [];
  const symbols = useMemo(() => currentList.map(s => s.symbol), [currentList]);
  const { quotes, status, rawMessages } = useStockWS(symbols, market);

  // A 股交易时段（仅在 stock 市场显示提示）
  const marketStatus = market === 'stock' ? getAShareMarketStatus() : null;

  const saveWatchlist = (next) => {
    setWatchlist(next);
    try { sessionStorage.setItem('stock_watchlist', JSON.stringify(next)); } catch {}
  };

  const addSymbol = () => {
    const sym = searchInput.trim().toUpperCase();
    if (!sym) return;
    if (currentList.some(s => s.symbol === sym)) { setSearchInput(''); return; }
    saveWatchlist({ ...watchlist, [market]: [...currentList, { symbol: sym, name: '' }] });
    setSearchInput('');
  };

  const removeSymbol = (sym) => {
    saveWatchlist({ ...watchlist, [market]: currentList.filter(s => s.symbol !== sym) });
  };

  const currentMarketLabel = MARKETS.find(m => m.value === market)?.label ?? market;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/60 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors flex items-center gap-1"
            >
              <ChevronLeft size={15} />
              返回
            </button>
            <div className="h-4 w-px bg-zinc-700" />
            <span className="text-white font-semibold text-sm">📈 实时行情</span>
          </div>
          <div className="flex items-center gap-3">
            {/* A 股交易时段指示 */}
            {marketStatus && (
              <span className={`text-xs flex items-center gap-1 ${
                marketStatus.open ? 'text-green-400' : 'text-zinc-500'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  marketStatus.open ? 'bg-green-500 animate-pulse' : 'bg-zinc-600'
                }`} />
                {marketStatus.open ? marketStatus.session : marketStatus.reason}
              </span>
            )}
            <StatusBadge status={status} />
            {status === 'connected'
              ? <Wifi size={14} className="text-green-500" />
              : <WifiOff size={14} className="text-zinc-500" />
            }
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* 控制栏 */}
        <div className="flex flex-wrap gap-3 mb-6">
          {/* 市场下拉 */}
          <div className="relative">
            <button
              onClick={() => setShowMarketMenu(v => !v)}
              className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-sm text-zinc-200 transition-colors"
            >
              {currentMarketLabel}
              <ChevronDown size={13} />
            </button>
            {showMarketMenu && (
              <div className="absolute top-full left-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden z-20 min-w-[120px] shadow-xl">
                {MARKETS.map(m => (
                  <button
                    key={m.value}
                    onClick={() => { setMarket(m.value); setShowMarketMenu(false); }}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                      market === m.value
                        ? 'bg-amber-600/20 text-amber-400'
                        : 'text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 搜索添加（A股示例提示） */}
          <div className="flex gap-2 flex-1 min-w-[220px]">
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addSymbol()}
              placeholder={market === 'stock' ? '如 600519.SH 或 002594.SZ' : '输入代码'}
              className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-600 transition-colors"
            />
            <button
              onClick={addSymbol}
              disabled={!searchInput.trim()}
              className="px-3 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-lg transition-colors flex items-center gap-1 text-sm"
            >
              <Plus size={14} />
              添加
            </button>
          </div>
        </div>

        {/* 股票卡片网格 */}
        {currentList.length === 0 ? (
          <div className="text-center py-24 text-zinc-600">
            <div className="text-5xl mb-4">📊</div>
            <div className="text-sm">暂无自选，输入股票代码添加</div>
            <div className="text-xs mt-1 text-zinc-700">A股格式：600519.SH（沪）/ 002594.SZ（深）</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {currentList.map(({ symbol, name }) => (
              <StockCard
                key={symbol}
                symbol={symbol}
                name={name}
                quote={quotes[symbol]}
                onRemove={removeSymbol}
                marketStatus={marketStatus}
              />
            ))}
          </div>
        )}

        {/* 调试面板 */}
        <div className="mt-10">
          <button
            onClick={() => setShowDebug(v => !v)}
            className="text-xs text-zinc-700 hover:text-zinc-500 transition-colors flex items-center gap-1"
          >
            <ChevronDown size={11} className={`transition-transform ${showDebug ? 'rotate-180' : ''}`} />
            调试信息（开发用）
          </button>
          {showDebug && (
            <div className="mt-2 p-3 bg-zinc-900 border border-zinc-800 rounded-lg space-y-1">
              <div className="text-xs text-zinc-500">
                WS 状态: <span className="text-amber-400">{status}</span>
                {' · '}已订阅: <span className="text-zinc-400">{symbols.join(', ') || '—'}</span>
              </div>
              <div className="text-xs text-zinc-600 mt-1">最近原始消息（最多 5 条）：</div>
              {rawMessages.length === 0
                ? <div className="text-zinc-700 text-xs">暂无</div>
                : rawMessages.map((msg, i) => (
                    <pre key={i} className="text-xs text-zinc-400 bg-zinc-950 rounded p-2 overflow-auto max-h-28 leading-relaxed">
                      {msg}
                    </pre>
                  ))
              }
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
