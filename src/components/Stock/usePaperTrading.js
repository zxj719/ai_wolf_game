import { useState, useCallback } from 'react';

const STORAGE_KEY = 'paper_trading_account';
const INITIAL_CASH = 1000000;

function getBJDate() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { cash: INITIAL_CASH, positions: [], orders: [], createdAt: Date.now() };
}

function save(account) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(account)); } catch {}
}

/**
 * usePaperTrading - 模拟交易 hook
 * 全部数据存储在 localStorage，支持买卖、T+1、盈亏计算
 */
export function usePaperTrading() {
  const [account, setAccount] = useState(load);

  const update = useCallback((fn) => {
    setAccount(prev => {
      const next = fn(prev);
      save(next);
      return next;
    });
  }, []);

  const buyStock = useCallback((symbol, name, quantity, price) => {
    if (quantity <= 0 || price <= 0) return { ok: false, msg: '数量和价格必须大于0' };
    const amount = quantity * price;

    let result = { ok: false, msg: '' };
    update(acc => {
      if (acc.cash < amount) {
        result = { ok: false, msg: `资金不足，需要 ¥${amount.toFixed(2)}，可用 ¥${acc.cash.toFixed(2)}` };
        return acc;
      }

      const positions = [...acc.positions];
      const idx = positions.findIndex(p => p.symbol === symbol);

      if (idx >= 0) {
        // 加仓：加权平均成本
        const pos = { ...positions[idx] };
        const totalQty = pos.quantity + quantity;
        pos.avgCost = (pos.avgCost * pos.quantity + price * quantity) / totalQty;
        pos.quantity = totalQty;
        pos.buyDate = getBJDate(); // 更新买入日期（T+1 按最近一次买入算）
        positions[idx] = pos;
      } else {
        positions.push({ symbol, name, quantity, avgCost: price, buyDate: getBJDate() });
      }

      const order = {
        id: crypto.randomUUID(),
        symbol, name, direction: 'buy', quantity, price, amount,
        timestamp: Date.now(),
      };

      result = { ok: true, msg: `买入 ${name} ${quantity}股 @ ¥${price.toFixed(2)}` };
      return { ...acc, cash: acc.cash - amount, positions, orders: [order, ...acc.orders] };
    });
    return result;
  }, [update]);

  const sellStock = useCallback((symbol, quantity, price) => {
    if (quantity <= 0 || price <= 0) return { ok: false, msg: '数量和价格必须大于0' };

    let result = { ok: false, msg: '' };
    update(acc => {
      const idx = acc.positions.findIndex(p => p.symbol === symbol);
      if (idx < 0) {
        result = { ok: false, msg: '无此持仓' };
        return acc;
      }

      const pos = acc.positions[idx];

      // T+1 检查
      const today = getBJDate();
      if (pos.buyDate === today) {
        result = { ok: false, msg: 'T+1限制：当日买入股票次日才能卖出' };
        return acc;
      }

      if (pos.quantity < quantity) {
        result = { ok: false, msg: `持仓不足，可卖 ${pos.quantity} 股` };
        return acc;
      }

      const amount = quantity * price;
      const positions = [...acc.positions];

      if (pos.quantity === quantity) {
        positions.splice(idx, 1);
      } else {
        positions[idx] = { ...pos, quantity: pos.quantity - quantity };
      }

      const order = {
        id: crypto.randomUUID(),
        symbol, name: pos.name, direction: 'sell', quantity, price, amount,
        timestamp: Date.now(),
      };

      result = { ok: true, msg: `卖出 ${pos.name} ${quantity}股 @ ¥${price.toFixed(2)}` };
      return { ...acc, cash: acc.cash + amount, positions, orders: [order, ...acc.orders] };
    });
    return result;
  }, [update]);

  const canSell = useCallback((symbol) => {
    const pos = account.positions.find(p => p.symbol === symbol);
    if (!pos) return false;
    return pos.buyDate !== getBJDate();
  }, [account.positions]);

  const getPosition = useCallback((symbol) => {
    return account.positions.find(p => p.symbol === symbol) || null;
  }, [account.positions]);

  const resetAccount = useCallback(() => {
    const fresh = { cash: INITIAL_CASH, positions: [], orders: [], createdAt: Date.now() };
    save(fresh);
    setAccount(fresh);
  }, []);

  const getPortfolioValue = useCallback((quotes) => {
    return account.positions.reduce((sum, pos) => {
      const price = quotes[pos.symbol]?.price ?? pos.avgCost;
      return sum + price * pos.quantity;
    }, 0);
  }, [account.positions]);

  return {
    account,
    buyStock,
    sellStock,
    canSell,
    getPosition,
    resetAccount,
    getPortfolioValue,
    INITIAL_CASH,
  };
}
