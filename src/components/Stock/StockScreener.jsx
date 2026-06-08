import { useState, useMemo } from 'react';
import { ChevronLeft, Plus, Check, Search, ChevronDown } from 'lucide-react';
import { A_SHARE_STOCK_LIST, INDUSTRIES } from '../../config/stockList';

/**
 * StockScreener - 股票筛选器
 */
export function StockScreener({ onBack, onAddToWatchlist, existingSymbols }) {
  const [keyword, setKeyword] = useState('');
  const [industry, setIndustry] = useState('');
  const [showIndustryMenu, setShowIndustryMenu] = useState(false);
  const [selected, setSelected] = useState(new Set());

  const existingSet = useMemo(() => new Set(existingSymbols), [existingSymbols]);

  const filtered = useMemo(() => {
    let list = A_SHARE_STOCK_LIST;
    if (keyword) {
      const kw = keyword.toUpperCase();
      list = list.filter(s => s.symbol.includes(kw) || s.name.includes(keyword));
    }
    if (industry) {
      list = list.filter(s => s.industry === industry);
    }
    return list;
  }, [keyword, industry]);

  const toggleSelect = (symbol) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
  };

  const handleBatchAdd = () => {
    const items = A_SHARE_STOCK_LIST
      .filter(s => selected.has(s.symbol))
      .map(s => ({ symbol: s.symbol, name: s.name }));
    if (items.length) {
      onAddToWatchlist(items);
      setSelected(new Set());
    }
  };

  const handleSingleAdd = (stock) => {
    onAddToWatchlist([{ symbol: stock.symbol, name: stock.name }]);
  };

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="border-b border-line bg-bg-raised/60 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="px-3 py-1.5 text-sm bg-bg-sunken hover:bg-bg-raised text-ink-muted rounded-lg transition-colors flex items-center gap-1"
            >
              <ChevronLeft size={15} />
              返回列表
            </button>
            <div className="h-4 w-px bg-line-strong" />
            <span className="text-ink font-semibold text-sm">🔍 股票筛选</span>
          </div>
          {selected.size > 0 && (
            <button
              onClick={handleBatchAdd}
              className="px-3 py-1.5 text-sm bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors flex items-center gap-1"
            >
              <Plus size={14} />
              添加选中 ({selected.size})
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* 搜索 + 筛选 */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="flex-1 min-w-[200px] relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              type="text"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="搜索代码或名称"
              className="w-full pl-9 pr-3 py-2 bg-bg-sunken border border-line rounded-lg text-sm text-ink placeholder-ink-faint focus:outline-none focus:border-accent transition-colors"
            />
          </div>
          <div className="relative">
            <button
              onClick={() => setShowIndustryMenu(v => !v)}
              className="flex items-center gap-2 px-3 py-2 bg-bg-sunken hover:bg-bg-raised border border-line rounded-lg text-sm text-ink transition-colors"
            >
              {industry || '全部行业'}
              <ChevronDown size={13} />
            </button>
            {showIndustryMenu && (
              <div className="absolute top-full left-0 mt-1 bg-bg-raised border border-line rounded-lg overflow-hidden z-20 max-h-64 overflow-y-auto min-w-[120px] shadow-xl">
                <button
                  onClick={() => { setIndustry(''); setShowIndustryMenu(false); }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                    !industry ? 'bg-accent-soft text-accent' : 'text-ink hover:bg-bg-sunken'
                  }`}
                >
                  全部行业
                </button>
                {INDUSTRIES.map(ind => (
                  <button
                    key={ind}
                    onClick={() => { setIndustry(ind); setShowIndustryMenu(false); }}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                      industry === ind ? 'bg-accent-soft text-accent' : 'text-ink hover:bg-bg-sunken'
                    }`}
                  >
                    {ind}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 统计 */}
        <div className="text-xs text-ink-muted mb-3">
          共 {filtered.length} 只股票
          {selected.size > 0 && <span className="text-accent ml-2">已选 {selected.size} 只</span>}
        </div>

        {/* 结果列表 */}
        <div className="space-y-1">
          {filtered.map(stock => {
            const inWatchlist = existingSet.has(stock.symbol);
            const isSelected = selected.has(stock.symbol);
            return (
              <div
                key={stock.symbol}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isSelected ? 'bg-accent-soft border border-accent' : 'bg-bg-raised border border-line hover:border-line-strong'
                }`}
              >
                {/* 选择框 — 已添加=success(语义绿)，选中=accent */}
                <button
                  onClick={() => !inWatchlist && toggleSelect(stock.symbol)}
                  disabled={inWatchlist}
                  className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                    inWatchlist
                      ? 'bg-success-soft border-success text-success'
                      : isSelected
                        ? 'bg-accent border-accent text-white'
                        : 'border-line-strong text-transparent hover:border-ink-faint'
                  }`}
                >
                  {(inWatchlist || isSelected) && <Check size={12} />}
                </button>

                {/* 股票信息 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-ink font-medium">{stock.name}</span>
                    <span className="text-xs text-ink-muted font-mono">{stock.symbol}</span>
                  </div>
                </div>

                {/* 行业 */}
                <span className="text-xs text-ink-faint shrink-0">{stock.industry}</span>

                {/* 添加按钮 */}
                {inWatchlist ? (
                  <span className="text-xs text-success shrink-0">已添加</span>
                ) : (
                  <button
                    onClick={() => handleSingleAdd(stock)}
                    className="px-2 py-1 text-xs bg-bg-sunken hover:bg-accent text-ink-muted hover:text-white rounded transition-colors shrink-0"
                  >
                    <Plus size={12} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
