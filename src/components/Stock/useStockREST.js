import { useState, useCallback, useRef } from 'react';
import { REST_KLINE_TYPES } from '../../config/stockConfig';

/**
 * useStockREST - 股票 REST API hook
 * 通过 /api/stock/kline 代理获取历史 K 线数据（避免 CORS）
 */
export function useStockREST() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const cacheRef = useRef({});

  const fetchKline = useCallback(async (symbol, periodKey = 'DAY', count = 200) => {
    const klineType = REST_KLINE_TYPES[periodKey];
    if (!klineType) {
      setError(`无效的K线周期: ${periodKey}`);
      return null;
    }

    const cacheKey = `${symbol}_${periodKey}_${count}`;
    const cached = cacheRef.current[cacheKey];
    if (cached && Date.now() - cached.ts < 60000) {
      return cached.data;
    }

    setLoading(true);
    setError(null);

    try {
      const resp = await fetch('/api/stock/kline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codes: symbol,
          klineType,
          klineNum: count,
        }),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }

      const json = await resp.json();

      // 响应格式: { ret: 200, data: [{ s: "symbol", respList: [...] }] }
      const dataArr = json.data || [];
      const entry = Array.isArray(dataArr) ? dataArr[0] : dataArr;
      const list = entry?.respList || [];

      const candles = list.map(item => ({
        time:   parseInt(item.t),
        open:   parseFloat(item.o),
        high:   parseFloat(item.h),
        low:    parseFloat(item.l),
        close:  parseFloat(item.c),
        volume: parseFloat(item.v),
        turnover: parseFloat(item.vw || 0),
        changePct: parseFloat((item.pc || '0').replace('%', '')),
      })).filter(c => !isNaN(c.close)).sort((a, b) => a.time - b.time);

      cacheRef.current[cacheKey] = { data: candles, ts: Date.now() };
      return candles;
    } catch (e) {
      console.error('[Stock REST] K线请求失败:', e);
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { fetchKline, loading, error };
}
