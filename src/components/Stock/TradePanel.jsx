import { useState } from 'react';
import { Lock } from 'lucide-react';

function fmtMoney(val) {
  if (val >= 1e8) return (val / 1e8).toFixed(2) + '亿';
  if (val >= 1e4) return (val / 1e4).toFixed(2) + '万';
  return val.toFixed(2);
}

const QTY_BUTTONS = [100, 500, 1000];

/**
 * TradePanel - 买卖下单面板
 */
export function TradePanel({ symbol, name, currentPrice, cash, position, canSell, onBuy, onSell }) {
  const [tab, setTab] = useState('buy'); // 'buy' | 'sell'
  const [quantity, setQuantity] = useState('');
  const [message, setMessage] = useState(null);

  const qty = parseInt(quantity) || 0;
  const price = currentPrice ?? 0;
  const amount = qty * price;

  const handleSubmit = () => {
    if (!qty || !price) return;
    const result = tab === 'buy' ? onBuy(symbol, name, qty, price) : onSell(symbol, qty, price);
    setMessage(result);
    if (result.ok) setQuantity('');
    setTimeout(() => setMessage(null), 3000);
  };

  const maxBuyQty = price > 0 ? Math.floor(cash / price / 100) * 100 : 0;
  const maxSellQty = position?.quantity ?? 0;

  return (
    <div className="bg-bg-raised border border-line rounded-xl p-4">
      {/* Tab — 买入=涨(market-up 红) / 卖出=跌(market-down 绿)；market 无 soft token，激活态用中性底 */}
      <div className="flex gap-1 mb-3">
        <button
          onClick={() => setTab('buy')}
          className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            tab === 'buy' ? 'bg-bg-sunken text-market-up border border-market-up' : 'text-ink-muted hover:text-ink'
          }`}
        >
          买入
        </button>
        <button
          onClick={() => setTab('sell')}
          className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            tab === 'sell' ? 'bg-bg-sunken text-market-down border border-market-down' : 'text-ink-muted hover:text-ink'
          }`}
        >
          卖出
        </button>
      </div>

      {/* 价格 */}
      <div className="flex justify-between items-center mb-3 text-xs">
        <span className="text-ink-muted">当前价格</span>
        <span className="text-ink font-mono font-medium">
          {price > 0 ? `¥${price.toFixed(2)}` : '—'}
        </span>
      </div>

      {/* 数量输入 */}
      <div className="mb-2">
        <input
          type="number"
          value={quantity}
          onChange={e => setQuantity(e.target.value)}
          placeholder="数量（股）"
          min="1"
          step="100"
          className="w-full px-3 py-2 bg-bg-sunken border border-line rounded-lg text-sm text-ink placeholder-ink-faint focus:outline-none focus:border-accent transition-colors"
        />
      </div>

      {/* 快捷按钮 */}
      <div className="flex gap-1.5 mb-3">
        {QTY_BUTTONS.map(q => (
          <button
            key={q}
            onClick={() => setQuantity(String(q))}
            className="flex-1 py-1 text-xs bg-bg-sunken hover:bg-bg text-ink-muted rounded transition-colors"
          >
            {q}股
          </button>
        ))}
        <button
          onClick={() => setQuantity(String(tab === 'buy' ? maxBuyQty : maxSellQty))}
          className="flex-1 py-1 text-xs bg-bg-sunken hover:bg-bg text-ink-muted rounded transition-colors"
        >
          {tab === 'buy' ? '全仓' : '全部'}
        </button>
      </div>

      {/* 信息行 */}
      <div className="space-y-1 mb-3 text-xs">
        <div className="flex justify-between">
          <span className="text-ink-muted">预估金额</span>
          <span className="text-ink font-mono">¥{amount > 0 ? fmtMoney(amount) : '0.00'}</span>
        </div>
        {tab === 'buy' ? (
          <div className="flex justify-between">
            <span className="text-ink-muted">可用资金</span>
            <span className="text-ink font-mono">¥{fmtMoney(cash)}</span>
          </div>
        ) : (
          <div className="flex justify-between">
            <span className="text-ink-muted">可卖数量</span>
            <span className="text-ink font-mono">
              {canSell ? `${maxSellQty}股` : (
                <span className="flex items-center gap-1 text-warning">
                  <Lock size={10} /> T+1限制
                </span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* T+1 提示 — 语义警示(warning) */}
      {tab === 'sell' && !canSell && position && (
        <div className="text-xs text-warning bg-warning-soft rounded px-2 py-1.5 mb-3 flex items-center gap-1">
          <Lock size={10} />
          当日买入股票次日才能卖出
        </div>
      )}

      {/* 提交按钮 — 买入=涨(market-up 红) / 卖出=跌(market-down 绿) */}
      <button
        onClick={handleSubmit}
        disabled={!qty || !price || (tab === 'buy' && amount > cash) || (tab === 'sell' && (!canSell || qty > maxSellQty))}
        className={`w-full py-2.5 text-sm font-medium rounded-lg transition-colors disabled:bg-bg-sunken disabled:text-ink-faint text-white ${
          tab === 'buy'
            ? 'bg-market-up hover:bg-market-up'
            : 'bg-market-down hover:bg-market-down'
        }`}
      >
        {tab === 'buy' ? '确认买入' : '确认卖出'}
      </button>

      {/* 操作结果 — 语义 success/danger，market 无 soft token 用中性底 */}
      {message && (
        <div className={`mt-2 text-xs text-center py-1 rounded bg-bg-sunken ${
          message.ok ? 'text-success' : 'text-danger'
        }`}>
          {message.msg}
        </div>
      )}
    </div>
  );
}
