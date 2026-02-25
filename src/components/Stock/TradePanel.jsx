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
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      {/* Tab */}
      <div className="flex gap-1 mb-3">
        <button
          onClick={() => setTab('buy')}
          className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            tab === 'buy' ? 'bg-red-600/20 text-red-400 border border-red-600/30' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          买入
        </button>
        <button
          onClick={() => setTab('sell')}
          className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            tab === 'sell' ? 'bg-green-600/20 text-green-400 border border-green-600/30' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          卖出
        </button>
      </div>

      {/* 价格 */}
      <div className="flex justify-between items-center mb-3 text-xs">
        <span className="text-zinc-500">当前价格</span>
        <span className="text-zinc-200 font-mono font-medium">
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
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-600 transition-colors"
        />
      </div>

      {/* 快捷按钮 */}
      <div className="flex gap-1.5 mb-3">
        {QTY_BUTTONS.map(q => (
          <button
            key={q}
            onClick={() => setQuantity(String(q))}
            className="flex-1 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded transition-colors"
          >
            {q}股
          </button>
        ))}
        <button
          onClick={() => setQuantity(String(tab === 'buy' ? maxBuyQty : maxSellQty))}
          className="flex-1 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded transition-colors"
        >
          {tab === 'buy' ? '全仓' : '全部'}
        </button>
      </div>

      {/* 信息行 */}
      <div className="space-y-1 mb-3 text-xs">
        <div className="flex justify-between">
          <span className="text-zinc-500">预估金额</span>
          <span className="text-zinc-300 font-mono">¥{amount > 0 ? fmtMoney(amount) : '0.00'}</span>
        </div>
        {tab === 'buy' ? (
          <div className="flex justify-between">
            <span className="text-zinc-500">可用资金</span>
            <span className="text-zinc-300 font-mono">¥{fmtMoney(cash)}</span>
          </div>
        ) : (
          <div className="flex justify-between">
            <span className="text-zinc-500">可卖数量</span>
            <span className="text-zinc-300 font-mono">
              {canSell ? `${maxSellQty}股` : (
                <span className="flex items-center gap-1 text-amber-400">
                  <Lock size={10} /> T+1限制
                </span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* T+1 提示 */}
      {tab === 'sell' && !canSell && position && (
        <div className="text-xs text-amber-400/80 bg-amber-600/10 rounded px-2 py-1.5 mb-3 flex items-center gap-1">
          <Lock size={10} />
          当日买入股票次日才能卖出
        </div>
      )}

      {/* 提交按钮 */}
      <button
        onClick={handleSubmit}
        disabled={!qty || !price || (tab === 'buy' && amount > cash) || (tab === 'sell' && (!canSell || qty > maxSellQty))}
        className={`w-full py-2.5 text-sm font-medium rounded-lg transition-colors ${
          tab === 'buy'
            ? 'bg-red-600 hover:bg-red-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white'
            : 'bg-green-600 hover:bg-green-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white'
        }`}
      >
        {tab === 'buy' ? '确认买入' : '确认卖出'}
      </button>

      {/* 操作结果 */}
      {message && (
        <div className={`mt-2 text-xs text-center py-1 rounded ${
          message.ok ? 'text-green-400 bg-green-600/10' : 'text-red-400 bg-red-600/10'
        }`}>
          {message.msg}
        </div>
      )}
    </div>
  );
}
