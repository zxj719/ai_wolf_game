import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronDown, RefreshCw, TrendingUp, TrendingDown, Lock } from 'lucide-react';
import { usePaperTrading } from './usePaperTrading';
import { TradePanel } from './TradePanel';
import { useStockWS } from './useStockWS';

function fmtMoney(val) {
  if (Math.abs(val) >= 1e8) return (val / 1e8).toFixed(2) + '亿';
  if (Math.abs(val) >= 1e4) return (val / 1e4).toFixed(2) + '万';
  return val.toFixed(2);
}

function fmtTime(ts) {
  const d = new Date(ts);
  return `${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

/**
 * PaperTrading - 模拟交易主页
 */
export function PaperTrading({ onBack, quotes: parentQuotes, wsStatus }) {
  const {
    account, buyStock, sellStock, canSell, getPosition,
    resetAccount, getPortfolioValue, INITIAL_CASH,
  } = usePaperTrading();

  const [tradeSymbol, setTradeSymbol] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [showOrders, setShowOrders] = useState(false);
  const [showReset, setShowReset] = useState(false);

  // 为持仓股票订阅 WebSocket
  const posSymbols = useMemo(() => account.positions.map(p => p.symbol), [account.positions]);
  const { quotes: posQuotes } = useStockWS(posSymbols, 'stock');

  // 合并父级和持仓的报价
  const allQuotes = useMemo(() => ({ ...parentQuotes, ...posQuotes }), [parentQuotes, posQuotes]);

  const portfolioValue = getPortfolioValue(allQuotes);
  const totalEquity = account.cash + portfolioValue;
  const totalPnL = totalEquity - INITIAL_CASH;
  const pnlPct = INITIAL_CASH > 0 ? (totalPnL / INITIAL_CASH) * 100 : 0;

  // 当前交易的股票
  const tradePrice = allQuotes[tradeSymbol]?.price;
  const tradePosition = getPosition(tradeSymbol);
  const tradeCanSell = canSell(tradeSymbol);

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
              返回列表
            </button>
            <div className="h-4 w-px bg-line-strong" />
            <span className="text-ink font-semibold text-sm">💰 模拟交易</span>
          </div>
          <button
            onClick={() => setShowReset(true)}
            className="px-2.5 py-1.5 text-xs bg-bg-sunken hover:bg-bg-raised text-ink-muted hover:text-danger rounded-lg transition-colors flex items-center gap-1"
          >
            <RefreshCw size={12} />
            重置
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* 账户概览 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-bg-raised border border-line rounded-xl p-4">
            <div className="text-xs text-ink-muted mb-1">可用资金</div>
            <div className="text-lg font-mono font-bold text-ink">¥{fmtMoney(account.cash)}</div>
          </div>
          <div className="bg-bg-raised border border-line rounded-xl p-4">
            <div className="text-xs text-ink-muted mb-1">持仓市值</div>
            <div className="text-lg font-mono font-bold text-ink">¥{fmtMoney(portfolioValue)}</div>
          </div>
          <div className="bg-bg-raised border border-line rounded-xl p-4">
            <div className="text-xs text-ink-muted mb-1">总权益</div>
            <div className="text-lg font-mono font-bold text-ink">¥{fmtMoney(totalEquity)}</div>
          </div>
          {/* 总盈亏：正=涨(market-up 红) / 负=跌(market-down 绿) */}
          <div className={`bg-bg-raised border rounded-xl p-4 ${
            totalPnL >= 0 ? 'border-market-up' : 'border-market-down'
          }`}>
            <div className="text-xs text-ink-muted mb-1">总盈亏</div>
            <div className={`text-lg font-mono font-bold flex items-center gap-1 ${
              totalPnL >= 0 ? 'text-market-up' : 'text-market-down'
            }`}>
              {totalPnL >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {totalPnL >= 0 ? '+' : ''}{fmtMoney(totalPnL)}
              <span className="text-xs font-normal">({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)</span>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* 左侧：持仓 + 交易记录 */}
          <div className="md:col-span-2 space-y-4">
            {/* 持仓列表 */}
            <div className="bg-bg-raised border border-line rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-line text-sm font-medium text-ink">
                持仓 ({account.positions.length})
              </div>
              {account.positions.length === 0 ? (
                <div className="p-6 text-center text-ink-faint text-sm">暂无持仓</div>
              ) : (
                <div className="divide-y divide-line">
                  {account.positions.map(pos => {
                    const curPrice = allQuotes[pos.symbol]?.price ?? pos.avgCost;
                    const marketValue = curPrice * pos.quantity;
                    const pnl = (curPrice - pos.avgCost) * pos.quantity;
                    const pnlPercent = pos.avgCost > 0 ? ((curPrice - pos.avgCost) / pos.avgCost) * 100 : 0;
                    const isUp = pnl >= 0;
                    const sellable = canSell(pos.symbol);
                    // 盈=涨(market-up 红) / 亏=跌(market-down 绿)
                    const color = pnl === 0 ? 'text-ink' : isUp ? 'text-market-up' : 'text-market-down';

                    return (
                      <div key={pos.symbol} className="px-4 py-3 hover:bg-bg-sunken transition-colors">
                        <div className="flex items-center justify-between mb-1">
                          <div>
                            <span className="text-sm text-ink font-medium">{pos.name}</span>
                            <span className="text-xs text-ink-muted ml-2 font-mono">{pos.symbol}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {!sellable && (
                              <span className="text-xs text-warning flex items-center gap-0.5">
                                <Lock size={10} /> T+1
                              </span>
                            )}
                            <button
                              onClick={() => { setTradeSymbol(pos.symbol); setTradeName(pos.name); }}
                              className="px-2 py-1 text-xs bg-bg-sunken hover:bg-bg text-ink-muted rounded transition-colors"
                            >
                              交易
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-xs">
                          <div>
                            <span className="text-ink-muted">数量</span>
                            <div className="text-ink font-mono">{pos.quantity}</div>
                          </div>
                          <div>
                            <span className="text-ink-muted">均价</span>
                            <div className="text-ink font-mono">¥{pos.avgCost.toFixed(2)}</div>
                          </div>
                          <div>
                            <span className="text-ink-muted">现价</span>
                            <div className="text-ink font-mono">¥{curPrice.toFixed(2)}</div>
                          </div>
                          <div>
                            <span className="text-ink-muted">盈亏</span>
                            <div className={`font-mono ${color}`}>
                              {pnl >= 0 ? '+' : ''}{fmtMoney(pnl)}
                              <span className="text-[10px] ml-0.5">({pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%)</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 交易记录 */}
            <div>
              <button
                onClick={() => setShowOrders(v => !v)}
                className="flex items-center gap-1 text-sm text-ink-muted hover:text-ink transition-colors mb-2"
              >
                <ChevronDown size={13} className={`transition-transform ${showOrders ? 'rotate-180' : ''}`} />
                交易记录 ({account.orders.length})
              </button>
              {showOrders && (
                <div className="bg-bg-raised border border-line rounded-xl overflow-hidden">
                  {account.orders.length === 0 ? (
                    <div className="p-4 text-center text-ink-faint text-sm">暂无交易记录</div>
                  ) : (
                    <div className="divide-y divide-line max-h-64 overflow-y-auto">
                      {account.orders.slice(0, 50).map(order => (
                        <div key={order.id} className="px-4 py-2 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            {/* 买入=涨(market-up 红) / 卖出=跌(market-down 绿)；market 无 soft token，用中性底 */}
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium bg-bg-sunken ${
                              order.direction === 'buy'
                                ? 'text-market-up'
                                : 'text-market-down'
                            }`}>
                              {order.direction === 'buy' ? '买入' : '卖出'}
                            </span>
                            <span className="text-ink">{order.name}</span>
                            <span className="text-ink-faint font-mono">{order.symbol}</span>
                          </div>
                          <div className="flex items-center gap-3 text-ink-muted font-mono">
                            <span>{order.quantity}股</span>
                            <span>¥{order.price.toFixed(2)}</span>
                            <span className="text-ink-faint">{fmtTime(order.timestamp)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 右侧：交易面板 */}
          <div>
            {/* 股票选择 */}
            <div className="mb-3">
              <input
                type="text"
                value={tradeSymbol}
                onChange={e => { setTradeSymbol(e.target.value.toUpperCase()); setTradeName(''); }}
                placeholder="输入股票代码，如 600519.SH"
                className="w-full px-3 py-2 bg-bg-sunken border border-line rounded-lg text-sm text-ink placeholder-ink-faint focus:outline-none focus:border-accent transition-colors"
              />
              {tradeName && (
                <div className="text-xs text-ink-muted mt-1 px-1">{tradeName}</div>
              )}
            </div>

            {tradeSymbol && (
              <TradePanel
                symbol={tradeSymbol}
                name={tradeName || tradeSymbol}
                currentPrice={tradePrice}
                cash={account.cash}
                position={tradePosition}
                canSell={tradeCanSell}
                onBuy={buyStock}
                onSell={sellStock}
              />
            )}

            {!tradeSymbol && (
              <div className="bg-bg-raised border border-line rounded-xl p-6 text-center text-ink-faint text-sm">
                输入股票代码或从持仓点击"交易"开始
              </div>
            )}
          </div>
        </div>
      </main>

      {/* 重置确认 */}
      {showReset && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowReset(false)}>
          <div className="bg-bg-raised border border-line rounded-xl p-6 max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="text-sm text-ink mb-2 font-medium">确认重置账户？</div>
            <div className="text-xs text-ink-muted mb-4">
              将清空所有持仓和交易记录，资金恢复为 ¥{INITIAL_CASH.toLocaleString()}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowReset(false)} className="px-3 py-1.5 text-sm text-ink-muted hover:text-ink">
                取消
              </button>
              <button
                onClick={() => { resetAccount(); setShowReset(false); setTradeSymbol(''); }}
                className="px-4 py-1.5 text-sm bg-danger hover:bg-danger text-white rounded-lg"
              >
                确认重置
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
