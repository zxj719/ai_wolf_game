import { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { useStockWS } from './useStockWS';
import { useStockREST } from './useStockREST';
import { useDepthWS } from './useDepthWS';
import { usePaperTrading } from './usePaperTrading';
import { QuoteBar } from './QuoteBar';
import { PriceLineChart } from './PriceLineChart';
import { CandlestickChart } from './CandlestickChart';
import { OrderBook } from './OrderBook';
import { TradePanel } from './TradePanel';
import { KLINE_PERIODS } from '../../config/stockConfig';

/**
 * StockDetail - 个股详情页
 */
export function StockDetail({ symbol, name, market = 'stock', onBack }) {
  const [tab, setTab] = useState('timeline');
  const [klinePeriod, setKlinePeriod] = useState('DAY');
  const [klineData, setKlineData] = useState(null);

  const symbols = useMemo(() => [symbol], [symbol]);
  const { quotes, status } = useStockWS(symbols, market);
  const { fetchKline, loading: klineLoading, error: klineError } = useStockREST();
  const { depth } = useDepthWS(symbol, market);
  const { account, buyStock, sellStock, canSell, getPosition } = usePaperTrading();

  const quote = quotes[symbol];
  const position = getPosition(symbol);
  const sellable = canSell(symbol);

  useEffect(() => {
    if (tab !== 'kline') return;
    let cancelled = false;
    (async () => {
      const data = await fetchKline(symbol, klinePeriod);
      if (!cancelled && data) setKlineData(data);
    })();
    return () => { cancelled = true; };
  }, [tab, klinePeriod, symbol, fetchKline]);

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
              返回列表
            </button>
            <div className="h-4 w-px bg-zinc-700" />
            <div>
              <span className="text-white font-semibold">{name || symbol}</span>
              <span className="text-zinc-500 text-sm ml-2 font-mono">{symbol}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-green-500' : 'bg-zinc-600'}`} />
            <span className="text-zinc-500">{status === 'connected' ? '实时' : '离线'}</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* 报价条 */}
        <QuoteBar quote={quote} />

        {/* 主区域：图表 + 侧边栏 */}
        <div className="grid md:grid-cols-3 gap-4 mt-4">
          {/* 左侧：图表 */}
          <div className="md:col-span-2 space-y-4">
            {/* Tab 切换 */}
            <div className="flex items-center gap-1 border-b border-zinc-800 pb-0">
              <button
                onClick={() => setTab('timeline')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tab === 'timeline'
                    ? 'border-amber-500 text-amber-400'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                分时
              </button>
              <button
                onClick={() => setTab('kline')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tab === 'kline'
                    ? 'border-amber-500 text-amber-400'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                K线
              </button>

              {tab === 'kline' && (
                <div className="flex items-center gap-1 ml-4">
                  {KLINE_PERIODS.map(p => (
                    <button
                      key={p.value}
                      onClick={() => setKlinePeriod(p.value)}
                      className={`px-2.5 py-1 text-xs rounded transition-colors ${
                        klinePeriod === p.value
                          ? 'bg-amber-600 text-white'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 图表 */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              {tab === 'timeline' ? (
                <PriceLineChart prices={quote?.priceHistory} height={320} />
              ) : (
                <>
                  {klineLoading && (
                    <div className="flex items-center justify-center py-20 gap-2 text-zinc-500 text-sm">
                      <Loader2 size={16} className="animate-spin" />
                      加载K线数据...
                    </div>
                  )}
                  {klineError && !klineLoading && (
                    <div className="flex items-center justify-center py-20 text-red-400 text-sm">
                      加载失败: {klineError}
                    </div>
                  )}
                  {!klineLoading && !klineError && klineData && (
                    <CandlestickChart candles={klineData} periodKey={klinePeriod} height={400} />
                  )}
                  {!klineLoading && !klineError && !klineData && (
                    <div className="flex items-center justify-center py-20 text-zinc-600 text-sm">
                      暂无K线数据
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* 右侧：盘口 + 交易 */}
          <div className="space-y-4">
            <OrderBook depth={depth} />
            <TradePanel
              symbol={symbol}
              name={name || symbol}
              currentPrice={quote?.price}
              cash={account.cash}
              position={position}
              canSell={sellable}
              onBuy={buyStock}
              onSell={sellStock}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
