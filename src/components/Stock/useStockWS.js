import { useState, useEffect, useRef, useCallback } from 'react';
import { INFOWAY_CONFIG, WS_CODES, CANDLE_TYPES } from '../../config/stockConfig';

const HEARTBEAT_INTERVAL = 30000;
const RECONNECT_BASE_DELAY = 4000;
const MAX_PRICE_HISTORY = 40;

const randomTrace = () => Math.random().toString(36).substring(2, 18);

/**
 * 解析 K 线推送
 * 格式：{ "s": "002594.SZ", "respList": [{ t, h, o, l, c, v, vw, pc, pca }] }
 * 注意：数据推送没有 code 字段，靠 respList 特征识别
 */
function parseCandlePush(data) {
  const symbol = data.s;
  const candle = Array.isArray(data.respList) ? data.respList[data.respList.length - 1] : null;
  if (!symbol || !candle) return null;

  const price = parseFloat(candle.c);
  if (isNaN(price)) return null;

  // pc 格式为 "1.23%" 或 "-0.50%"，去掉 % 再转数字
  const changePct = parseFloat((candle.pc ?? '0').replace('%', ''));
  const change    = parseFloat(candle.pca ?? 0);

  return {
    symbol,
    price,
    change:    isNaN(change)    ? 0 : change,
    changePct: isNaN(changePct) ? 0 : changePct,
    open:     parseFloat(candle.o),
    high:     parseFloat(candle.h),
    low:      parseFloat(candle.l),
    volume:   parseFloat(candle.v),
    turnover: parseFloat(candle.vw),
  };
}

/**
 * 解析成交明细推送
 * 格式：{ "s": "...", "t": ms, "p": "price", "v": "vol", "vw": "...", "td": 1 }
 */
function parseTradePush(data) {
  const price = parseFloat(data.p);
  if (!data.s || isNaN(price)) return null;
  return { symbol: data.s, price };
}

/**
 * useStockWS
 * @param {string[]} symbols
 * @param {string}   market  - 'stock' | 'crypto' | 'common'
 */
export function useStockWS(symbols, market = 'stock') {
  const [quotes, setQuotes]           = useState({});
  const [status, setStatus]           = useState('disconnected');
  const [rawMessages, setRawMessages] = useState([]);

  const wsRef        = useRef(null);
  const heartbeatRef = useRef(null);
  const reconnectRef = useRef(null);
  const sessionRef   = useRef(0);   // 单调递增，解决 Strict Mode 双调用问题
  const symbolsRef   = useRef(symbols);

  useEffect(() => { symbolsRef.current = symbols; }, [symbols]);

  const clearTimers = useCallback(() => {
    clearInterval(heartbeatRef.current);
    clearTimeout(reconnectRef.current);
  }, []);

  const subscribeCandle = useCallback((ws, syms) => {
    if (!syms.length || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({
      code: WS_CODES.CANDLE_SUB,
      trace: randomTrace(),
      data: { arr: [{ type: CANDLE_TYPES.MIN1, codes: syms.join(',') }] },
    }));
    console.log('[Stock WS] 订阅K线:', syms);
  }, []);

  const subscribeTrade = useCallback((ws, syms) => {
    if (!syms.length || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({
      code: WS_CODES.TRADE_SUB,
      trace: randomTrace(),
      data: { codes: syms.join(',') },
    }));
    console.log('[Stock WS] 订阅成交:', syms);
  }, []);

  const handleMessage = useCallback((raw) => {
    // 服务端可能发纯文本（如欢迎语），不是 JSON，直接记录跳过
    if (!raw.startsWith('{') && !raw.startsWith('[')) {
      console.log('[Stock WS] 服务端文本消息:', raw);
      setRawMessages(prev => [`[文本] ${raw}`, ...prev].slice(0, 5));
      return;
    }

    try {
      const data = JSON.parse(raw);

      // 调试面板（保留最近 5 条）
      setRawMessages(prev => [JSON.stringify(data, null, 2), ...prev].slice(0, 5));

      // 有 code 字段 = 控制消息（订阅确认 / 心跳回包 / 鉴权结果），直接忽略数据处理
      if (data.code !== undefined) {
        if (data.code === 200) {
          console.log('[Stock WS] ✓ 鉴权成功，API Key 有效');
        } else {
          console.log('[Stock WS] 控制消息 code:', data.code);
        }
        return;
      }

      console.log('[Stock WS] 数据推送:', data);

      // K 线推送：有 respList 字段
      if (data.s && Array.isArray(data.respList)) {
        const ticker = parseCandlePush(data);
        if (!ticker) return;
        setQuotes(prev => {
          const existing = prev[ticker.symbol] ?? { priceHistory: [] };
          const priceHistory = [...existing.priceHistory, ticker.price].slice(-MAX_PRICE_HISTORY);
          return { ...prev, [ticker.symbol]: { ...existing, ...ticker, priceHistory, updatedAt: Date.now() } };
        });
        return;
      }

      // 成交明细推送：有 p 字段（价格）+ td 字段（方向）
      if (data.s && data.p !== undefined) {
        const tick = parseTradePush(data);
        if (!tick) return;
        setQuotes(prev => {
          const existing = prev[tick.symbol];
          if (!existing) return prev;
          const priceHistory = [...existing.priceHistory, tick.price].slice(-MAX_PRICE_HISTORY);
          return { ...prev, [tick.symbol]: { ...existing, price: tick.price, priceHistory, updatedAt: Date.now() } };
        });
      }
    } catch (e) {
      console.warn('[Stock WS] JSON 解析失败:', e.message, raw.slice(0, 80));
    }
  }, []);

  const connect = useCallback((sessionId) => {
    // sessionId 不匹配说明已被新 session 取代，不再连接
    if (sessionRef.current !== sessionId) return;

    const url = `${INFOWAY_CONFIG.wsBase}?business=${market}&apikey=${INFOWAY_CONFIG.apiKey}`;
    setStatus('connecting');
    console.log('[Stock WS] 连接 (session', sessionId, '):', url);

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (sessionRef.current !== sessionId) return ws.close();
        console.log('[Stock WS] 已连接');
        setStatus('connected');
        // 官方示例建议多个订阅之间留间隔，避免触发频率限制（60次/分钟）
        subscribeTrade(ws, symbolsRef.current);
        setTimeout(() => subscribeCandle(ws, symbolsRef.current), 1000);
        heartbeatRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ code: WS_CODES.HEARTBEAT, trace: randomTrace() }));
          }
        }, HEARTBEAT_INTERVAL);
      };

      ws.onmessage = e => handleMessage(e.data);

      ws.onerror = () => setStatus('error');

      ws.onclose = () => {
        clearTimers();
        // session 已过期（组件卸载或市场切换），不重连
        if (sessionRef.current !== sessionId) return;
        console.log('[Stock WS] 断开，', RECONNECT_BASE_DELAY, 'ms 后重连');
        setStatus('disconnected');
        reconnectRef.current = setTimeout(() => connect(sessionId), RECONNECT_BASE_DELAY);
      };
    } catch (e) {
      console.error('[Stock WS] 连接失败:', e);
      setStatus('error');
    }
  }, [market, subscribeCandle, subscribeTrade, handleMessage, clearTimers]);

  // 市场切换或首次挂载 → 新 session 连接
  useEffect(() => {
    const sessionId = ++sessionRef.current;
    connect(sessionId);
    return () => {
      // 让当前 session 失效，防止 Strict Mode 双调用产生的 onclose 触发重连
      sessionRef.current++;
      clearTimers();
      wsRef.current?.close();
    };
  }, [market]); // eslint-disable-line react-hooks/exhaustive-deps

  // 自选列表变化 → 追加订阅（不断开）
  useEffect(() => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      subscribeCandle(ws, symbols);
      subscribeTrade(ws, symbols);
    }
  }, [symbols, subscribeCandle, subscribeTrade]);

  return { quotes, status, rawMessages };
}
