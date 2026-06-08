import { useState, useMemo } from 'react';
import {
  ChevronLeft, TrendingUp, TrendingDown,
  Wifi, WifiOff, Loader2, Plus, X, ChevronDown, Clock,
  Search, ListPlus, Tag,
} from 'lucide-react';
import { useStockWS } from './useStockWS';
import { StockDetail } from './StockDetail';
import { StockScreener } from './StockScreener';
import { PaperTrading } from './PaperTrading';
import { WatchlistTags, COLOR_DOT } from './WatchlistTags';
import { WatchlistSorter } from './WatchlistSorter';
import { BatchAddModal } from './BatchAddModal';
import { useWatchlistTags } from './useWatchlistTags';
import { DEFAULT_WATCHLIST, MARKETS } from '../../config/stockConfig';

/**
 * 判断 A 股当前是否处于交易时段（北京时间）
 */
function getAShareMarketStatus() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
  const day = now.getDay();
  if (day === 0 || day === 6) return { open: false, reason: '周末休市' };

  const h = now.getHours();
  const m = now.getMinutes();
  const t = h * 60 + m;

  if (t >= 9 * 60 + 30 && t < 11 * 60 + 30) return { open: true, session: '上午场' };
  if (t >= 13 * 60 && t < 15 * 60)           return { open: true, session: '下午场' };
  if (t < 9 * 60 + 30)  return { open: false, reason: `未开盘，09:30 开市` };
  if (t < 13 * 60)       return { open: false, reason: `午间休市，13:00 恢复` };
  return { open: false, reason: '已收盘，明日 09:30 开市' };
}

// 纯 SVG Sparkline 折线图
function Sparkline({ prices, isUp, width = 72, height = 28 }) {
  if (!prices || prices.length < 2) {
    return <div style={{ width, height }} className="flex items-end text-ink-faint text-xs pb-1">—</div>;
  }
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const points = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * width;
    const y = height - ((p - min) / range) * (height - 2) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  // A股红涨绿跌：上涨用 market-up(红)，下跌用 market-down(绿)。修复此前 up/down 颜色反转的 bug。
  // 用 currentColor 让 stroke 跟随 token 文字色，在 light/dark 两套 [data-theme] 下都正确解析。
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}
      className={isUp ? 'text-market-up' : 'text-market-down'}>
      <polyline points={points} fill="none" stroke="currentColor"
        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
    </svg>
  );
}

// WebSocket 状态指示
function StatusBadge({ status }) {
  const map = {
    connected:    { dot: 'bg-success',                text: '实时', color: 'text-success' },
    connecting:   { dot: 'bg-warning animate-pulse',  text: '连接中', color: 'text-warning' },
    disconnected: { dot: 'bg-ink-faint',              text: '已断开', color: 'text-ink-muted' },
    error:        { dot: 'bg-danger',                 text: '错误', color: 'text-danger' },
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
function StockCard({ symbol, name, quote, onRemove, marketStatus, onClick, stockTags, onTagClick }) {
  const changePct = quote?.changePct ?? 0;
  const isUp = changePct >= 0;
  const isFlat = changePct === 0;
  const hasData = quote?.price !== undefined;

  const priceColor = isFlat ? 'text-ink' : isUp ? 'text-market-up' : 'text-market-down';

  return (
    <div className="group relative bg-bg-raised border border-line rounded-xl p-4 hover:border-line-strong transition-all cursor-pointer" onClick={onClick}>
      {/* 移除按钮 */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(symbol); }}
        className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center text-ink-faint hover:text-danger transition-all"
        title="移除"
      >
        <X size={12} />
      </button>

      {/* 标签按钮 */}
      {onTagClick && (
        <button
          onClick={(e) => { e.stopPropagation(); onTagClick(symbol); }}
          className="absolute top-2.5 right-9 opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center text-ink-faint hover:text-accent transition-all"
          title="标签"
        >
          <Tag size={11} />
        </button>
      )}

      {/* 头部：名称 + Sparkline */}
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0 pr-2">
          <div className="text-ink font-semibold text-sm truncate">{name || symbol}</div>
          <div className="text-ink-muted text-xs mt-0.5 font-mono">{symbol}</div>
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
          <div className="flex justify-between mt-1.5 text-xs text-ink-muted">
            <span>
              {quote.change >= 0 ? '+' : ''}{(quote.change ?? 0).toFixed(3)}
            </span>
            <span>成交 {fmtMoney(quote.turnover)}</span>
          </div>

          {/* 最高/最低 — 高=涨(market-up 红) / 低=跌(market-down 绿) */}
          {(quote.high || quote.low) && (
            <div className="flex justify-between mt-1 text-xs">
              <span className="text-market-up">高 {quote.high?.toFixed(2)}</span>
              <span className="text-market-down">低 {quote.low?.toFixed(2)}</span>
            </div>
          )}
        </>
      ) : (
        <div className="text-ink-faint text-xs mt-3 flex items-center gap-1.5">
          {marketStatus?.open
            ? <><Loader2 size={12} className="animate-spin" /> 等待推送...</>
            : <><Clock size={12} /> {marketStatus?.reason ?? '非交易时段'}</>
          }
        </div>
      )}

      {/* 标签小点 */}
      {stockTags?.length > 0 && (
        <div className="flex gap-1 mt-2">
          {stockTags.map(t => (
            <span key={t.id} className={`w-2 h-2 rounded-full ${COLOR_DOT[t.color] || 'bg-ink-faint'}`} title={t.name} />
          ))}
        </div>
      )}
    </div>
  );
}

// 标签选择弹出框
function TagPopover({ symbol, tags, stockTags, onTag, onUntag, onClose }) {
  const currentTagIds = stockTags[symbol] || [];
  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="fixed inset-0 bg-black/40" />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-bg-raised border border-line rounded-lg p-3 min-w-[200px] shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="text-xs text-ink-muted mb-2">选择标签：{symbol}</div>
        {tags.length === 0 ? (
          <div className="text-xs text-ink-faint">暂无标签，请先创建</div>
        ) : (
          <div className="space-y-1">
            {tags.map(tag => {
              const active = currentTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  onClick={() => active ? onUntag(symbol, tag.id) : onTag(symbol, tag.id)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded transition-colors ${
                    active ? 'bg-accent-soft text-accent' : 'text-ink hover:bg-bg-sunken'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${COLOR_DOT[tag.color] || 'bg-ink-faint'}`} />
                  {tag.name}
                  {active && <span className="ml-auto text-accent">✓</span>}
                </button>
              );
            })}
          </div>
        )}
        <button onClick={onClose} className="mt-2 w-full text-center text-xs text-ink-muted hover:text-ink py-1">
          关闭
        </button>
      </div>
    </div>
  );
}

export function StockPage({ onBack }) {
  const [market, setMarket] = useState('stock');
  const [watchlist, setWatchlist] = useState(() => {
    try {
      const saved = localStorage.getItem('stock_watchlist')
        || sessionStorage.getItem('stock_watchlist');
      return saved ? JSON.parse(saved) : DEFAULT_WATCHLIST;
    } catch {
      return DEFAULT_WATCHLIST;
    }
  });
  const [searchInput, setSearchInput] = useState('');
  const [showDebug, setShowDebug] = useState(false);
  const [showMarketMenu, setShowMarketMenu] = useState(false);
  const [detailStock, setDetailStock] = useState(null);
  const [screenView, setScreenView] = useState(null); // 'screener' | 'trading' | null
  const [activeTag, setActiveTag] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'default', asc: true });
  const [showBatchAdd, setShowBatchAdd] = useState(false);
  const [tagPopoverSymbol, setTagPopoverSymbol] = useState(null);

  const {
    tags, stockTags, TAG_COLORS,
    createTag, deleteTag, tagStock, untagStock, getStockTags,
  } = useWatchlistTags();

  const currentList = watchlist[market] ?? [];
  const symbols = useMemo(() => currentList.map(s => s.symbol), [currentList]);
  const { quotes, status, rawMessages } = useStockWS(symbols, market);

  const marketStatus = market === 'stock' ? getAShareMarketStatus() : null;

  const saveWatchlist = (next) => {
    setWatchlist(next);
    try { localStorage.setItem('stock_watchlist', JSON.stringify(next)); } catch {}
  };

  const addSymbol = () => {
    const sym = searchInput.trim().toUpperCase();
    if (!sym) return;
    if (currentList.some(s => s.symbol === sym)) { setSearchInput(''); return; }
    saveWatchlist({ ...watchlist, [market]: [...currentList, { symbol: sym, name: '' }] });
    setSearchInput('');
  };

  const addSymbols = (items) => {
    const existing = new Set(currentList.map(s => s.symbol));
    const newItems = items.filter(s => !existing.has(s.symbol));
    if (newItems.length) {
      saveWatchlist({ ...watchlist, [market]: [...currentList, ...newItems] });
    }
  };

  const removeSymbol = (sym) => {
    saveWatchlist({ ...watchlist, [market]: currentList.filter(s => s.symbol !== sym) });
  };

  // 标签筛选 + 排序
  const displayList = useMemo(() => {
    let list = currentList;

    // 按标签筛选
    if (activeTag) {
      const taggedSymbols = new Set(
        Object.entries(stockTags)
          .filter(([, ids]) => ids.includes(activeTag))
          .map(([sym]) => sym)
      );
      list = list.filter(s => taggedSymbols.has(s.symbol));
    }

    // 排序
    if (sortConfig.key !== 'default') {
      list = [...list].sort((a, b) => {
        let cmp = 0;
        if (sortConfig.key === 'name') {
          cmp = (a.name || a.symbol).localeCompare(b.name || b.symbol, 'zh-CN');
        } else if (sortConfig.key === 'price') {
          cmp = (quotes[a.symbol]?.price ?? 0) - (quotes[b.symbol]?.price ?? 0);
        } else if (sortConfig.key === 'changePct') {
          cmp = (quotes[a.symbol]?.changePct ?? 0) - (quotes[b.symbol]?.changePct ?? 0);
        }
        return sortConfig.asc ? cmp : -cmp;
      });
    }

    return list;
  }, [currentList, activeTag, stockTags, sortConfig, quotes]);

  const currentMarketLabel = MARKETS.find(m => m.value === market)?.label ?? market;

  // 子页面路由
  if (detailStock) {
    return (
      <StockDetail
        symbol={detailStock.symbol}
        name={detailStock.name}
        market={market}
        onBack={() => setDetailStock(null)}
      />
    );
  }

  if (screenView === 'screener') {
    return (
      <StockScreener
        onBack={() => setScreenView(null)}
        onAddToWatchlist={addSymbols}
        existingSymbols={symbols}
      />
    );
  }

  if (screenView === 'trading') {
    return (
      <PaperTrading
        onBack={() => setScreenView(null)}
        quotes={quotes}
        wsStatus={status}
      />
    );
  }

  return (
    <div className="min-h-screen bg-bg text-ink">
      {/* Header */}
      <header className="border-b border-line bg-bg-raised/60 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="px-3 py-1.5 text-sm bg-bg-sunken hover:bg-bg-raised text-ink-muted rounded-lg transition-colors flex items-center gap-1"
            >
              <ChevronLeft size={15} />
              返回
            </button>
            <div className="h-4 w-px bg-line-strong" />
            <span className="text-ink font-semibold text-sm">📈 实时行情</span>
          </div>
          <div className="flex items-center gap-2">
            {/* 功能入口 */}
            <button
              onClick={() => setScreenView('screener')}
              className="px-2.5 py-1.5 text-xs bg-bg-sunken hover:bg-bg-raised text-ink-muted hover:text-ink rounded-lg transition-colors flex items-center gap-1"
            >
              <Search size={12} />
              筛选
            </button>
            <button
              onClick={() => setScreenView('trading')}
              className="px-2.5 py-1.5 text-xs bg-bg-sunken hover:bg-bg-raised text-ink-muted hover:text-ink rounded-lg transition-colors flex items-center gap-1"
            >
              💰 模拟交易
            </button>
            <div className="h-4 w-px bg-line-strong" />
            {marketStatus && (
              <span className={`text-xs flex items-center gap-1 ${
                marketStatus.open ? 'text-success' : 'text-ink-muted'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  marketStatus.open ? 'bg-success animate-pulse' : 'bg-ink-faint'
                }`} />
                {marketStatus.open ? marketStatus.session : marketStatus.reason}
              </span>
            )}
            <StatusBadge status={status} />
            {status === 'connected'
              ? <Wifi size={14} className="text-success" />
              : <WifiOff size={14} className="text-ink-muted" />
            }
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* 控制栏 */}
        <div className="flex flex-wrap gap-3 mb-4">
          {/* 市场下拉 */}
          <div className="relative">
            <button
              onClick={() => setShowMarketMenu(v => !v)}
              className="flex items-center gap-2 px-3 py-2 bg-bg-sunken hover:bg-bg-raised border border-line rounded-lg text-sm text-ink transition-colors"
            >
              {currentMarketLabel}
              <ChevronDown size={13} />
            </button>
            {showMarketMenu && (
              <div className="absolute top-full left-0 mt-1 bg-bg-raised border border-line rounded-lg overflow-hidden z-20 min-w-[120px] shadow-xl">
                {MARKETS.map(m => (
                  <button
                    key={m.value}
                    onClick={() => { setMarket(m.value); setShowMarketMenu(false); }}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                      market === m.value
                        ? 'bg-accent-soft text-accent'
                        : 'text-ink hover:bg-bg-sunken'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 搜索添加 */}
          <div className="flex gap-2 flex-1 min-w-[220px]">
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addSymbol()}
              placeholder={market === 'stock' ? '如 600519.SH 或 002594.SZ' : '输入代码'}
              className="flex-1 px-3 py-2 bg-bg-sunken border border-line rounded-lg text-sm text-ink placeholder-ink-faint focus:outline-none focus:border-accent transition-colors"
            />
            <button
              onClick={addSymbol}
              disabled={!searchInput.trim()}
              className="px-3 py-2 bg-accent hover:bg-accent-hover disabled:bg-bg-sunken disabled:text-ink-faint text-white rounded-lg transition-colors flex items-center gap-1 text-sm"
            >
              <Plus size={14} />
              添加
            </button>
          </div>

          {/* 批量添加 + 排序 */}
          <button
            onClick={() => setShowBatchAdd(true)}
            className="px-2.5 py-2 text-xs bg-bg-sunken hover:bg-bg-raised border border-line text-ink-muted hover:text-ink rounded-lg transition-colors flex items-center gap-1"
          >
            <ListPlus size={13} />
            批量
          </button>
          <WatchlistSorter sortConfig={sortConfig} onSort={setSortConfig} />
        </div>

        {/* 标签栏 */}
        {tags.length > 0 && (
          <div className="mb-4">
            <WatchlistTags
              tags={tags}
              activeTag={activeTag}
              onSelect={setActiveTag}
              onCreate={createTag}
              onDelete={deleteTag}
              TAG_COLORS={TAG_COLORS}
            />
          </div>
        )}

        {/* 创建首个标签的提示（无标签时显示在控制栏右侧） */}
        {tags.length === 0 && (
          <div className="mb-4">
            <WatchlistTags
              tags={tags}
              activeTag={activeTag}
              onSelect={setActiveTag}
              onCreate={createTag}
              onDelete={deleteTag}
              TAG_COLORS={TAG_COLORS}
            />
          </div>
        )}

        {/* 股票卡片网格 */}
        {displayList.length === 0 ? (
          <div className="text-center py-24 text-ink-faint">
            <div className="text-5xl mb-4">📊</div>
            <div className="text-sm">
              {activeTag ? '该标签下暂无股票' : '暂无自选，输入股票代码添加'}
            </div>
            {!activeTag && (
              <div className="text-xs mt-1 text-ink-faint">A股格式：600519.SH（沪）/ 002594.SZ（深）</div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {displayList.map(({ symbol, name }) => (
              <StockCard
                key={symbol}
                symbol={symbol}
                name={name}
                quote={quotes[symbol]}
                onRemove={removeSymbol}
                marketStatus={marketStatus}
                onClick={() => setDetailStock({ symbol, name })}
                stockTags={getStockTags(symbol)}
                onTagClick={tags.length > 0 ? setTagPopoverSymbol : undefined}
              />
            ))}
          </div>
        )}

        {/* 调试面板 */}
        <div className="mt-10">
          <button
            onClick={() => setShowDebug(v => !v)}
            className="text-xs text-ink-faint hover:text-ink-muted transition-colors flex items-center gap-1"
          >
            <ChevronDown size={11} className={`transition-transform ${showDebug ? 'rotate-180' : ''}`} />
            调试信息（开发用）
          </button>
          {showDebug && (
            <div className="mt-2 p-3 bg-bg-raised border border-line rounded-lg space-y-1">
              <div className="text-xs text-ink-muted">
                WS 状态: <span className="text-accent">{status}</span>
                {' · '}已订阅: <span className="text-ink-muted">{symbols.join(', ') || '—'}</span>
              </div>
              <div className="text-xs text-ink-faint mt-1">最近原始消息（最多 5 条）：</div>
              {rawMessages.length === 0
                ? <div className="text-ink-faint text-xs">暂无</div>
                : rawMessages.map((msg, i) => (
                    <pre key={i} className="text-xs text-ink-muted bg-bg-sunken rounded p-2 overflow-auto max-h-28 leading-relaxed">
                      {msg}
                    </pre>
                  ))
              }
            </div>
          )}
        </div>
      </main>

      {/* 批量添加弹窗 */}
      {showBatchAdd && (
        <BatchAddModal
          onClose={() => setShowBatchAdd(false)}
          onAdd={addSymbols}
          existingSymbols={symbols}
        />
      )}

      {/* 标签选择弹出框 */}
      {tagPopoverSymbol && (
        <TagPopover
          symbol={tagPopoverSymbol}
          tags={tags}
          stockTags={stockTags}
          onTag={tagStock}
          onUntag={untagStock}
          onClose={() => setTagPopoverSymbol(null)}
        />
      )}
    </div>
  );
}
