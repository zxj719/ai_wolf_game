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
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-900/60 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors flex items-center gap-1"
            >
              <ChevronLeft size={15} />
              返回列表
            </button>
            <div className="h-4 w-px bg-zinc-700" />
            <span className="text-white font-semibold text-sm">🔍 股票筛选</span>
          </div>
          {selected.size > 0 && (
            <button
              onClick={handleBatchAdd}
              className="px-3 py-1.5 text-sm bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors flex items-center gap-1"
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
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="搜索代码或名称"
              className="w-full pl-9 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-600 transition-colors"
            />
          </div>
          <div className="relative">
            <button
              onClick={() => setShowIndustryMenu(v => !v)}
              className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-sm text-zinc-200 transition-colors"
            >
              {industry || '全部行业'}
              <ChevronDown size={13} />
            </button>
            {showIndustryMenu && (
              <div className="absolute top-full left-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden z-20 max-h-64 overflow-y-auto min-w-[120px] shadow-xl">
                <button
                  onClick={() => { setIndustry(''); setShowIndustryMenu(false); }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                    !industry ? 'bg-amber-600/20 text-amber-400' : 'text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  全部行业
                </button>
                {INDUSTRIES.map(ind => (
                  <button
                    key={ind}
                    onClick={() => { setIndustry(ind); setShowIndustryMenu(false); }}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                      industry === ind ? 'bg-amber-600/20 text-amber-400' : 'text-zinc-300 hover:bg-zinc-700'
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
        <div className="text-xs text-zinc-500 mb-3">
          共 {filtered.length} 只股票
          {selected.size > 0 && <span className="text-amber-400 ml-2">已选 {selected.size} 只</span>}
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
                  isSelected ? 'bg-amber-600/10 border border-amber-600/20' : 'bg-zinc-900 border border-zinc-800 hover:border-zinc-700'
                }`}
              >
                {/* 选择框 */}
                <button
                  onClick={() => !inWatchlist && toggleSelect(stock.symbol)}
                  disabled={inWatchlist}
                  className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                    inWatchlist
                      ? 'bg-green-600/20 border-green-600/30 text-green-400'
                      : isSelected
                        ? 'bg-amber-600 border-amber-600 text-white'
                        : 'border-zinc-600 text-transparent hover:border-zinc-500'
                  }`}
                >
                  {(inWatchlist || isSelected) && <Check size={12} />}
                </button>

                {/* 股票信息 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-200 font-medium">{stock.name}</span>
                    <span className="text-xs text-zinc-500 font-mono">{stock.symbol}</span>
                  </div>
                </div>

                {/* 行业 */}
                <span className="text-xs text-zinc-600 shrink-0">{stock.industry}</span>

                {/* 添加按钮 */}
                {inWatchlist ? (
                  <span className="text-xs text-green-500 shrink-0">已添加</span>
                ) : (
                  <button
                    onClick={() => handleSingleAdd(stock)}
                    className="px-2 py-1 text-xs bg-zinc-800 hover:bg-amber-600 text-zinc-400 hover:text-white rounded transition-colors shrink-0"
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
