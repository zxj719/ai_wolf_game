import { useState, useEffect, useRef, useCallback } from 'react';
import { INFOWAY_CONFIG, WS_CODES } from '../../config/stockConfig';

const HEARTBEAT_INTERVAL = 30000;
const RECONNECT_DELAY = 4000;

const randomTrace = () => Math.random().toString(36).substring(2, 18);

/**
 * useDepthWS - 五档盘口 WebSocket hook
 * 仅在详情页为单只股票订阅深度数据
 * @param {string} symbol
 * @param {string} market
 */
export function useDepthWS(symbol, market = 'stock') {
  const [depth, setDepth] = useState(null);
  const [status, setStatus] = useState('disconnected');

  const wsRef = useRef(null);
  const heartbeatRef = useRef(null);
  const reconnectRef = useRef(null);
  const sessionRef = useRef(0);

  const clearTimers = useCallback(() => {
    clearInterval(heartbeatRef.current);
    clearTimeout(reconnectRef.current);
  }, []);

  const subscribeDepth = useCallback((ws, sym) => {
    if (!sym || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({
      code: WS_CODES.DEPTH_SUB,
      trace: randomTrace(),
      data: { codes: sym },
    }));
    console.log('[Depth WS] 订阅盘口:', sym);
  }, []);

  const handleMessage = useCallback((raw) => {
    if (!raw.startsWith('{') && !raw.startsWith('[')) return;

    try {
      const data = JSON.parse(raw);

      // 带 code 字段的消息
      if (data.code !== undefined) {
        const payload = data.data;

        // 盘口推送 (code 10005 或其他可能的推送码)
        if ((data.code === WS_CODES.DEPTH_PUSH || data.code === 10004) && payload) {
          parseAndSetDepth(payload);
          return;
        }

        // 鉴权成功、订阅确认等控制消息忽略
        return;
      }

      // 无 code 字段：尝试解析为盘口数据
      if (data.s && (data.a || data.b || data.asks || data.bids)) {
        parseAndSetDepth(data);
      }
    } catch (e) {
      console.warn('[Depth WS] 解析失败:', e.message);
    }
  }, []);

  const parseAndSetDepth = useCallback((data) => {
    // infoway 盘口数据格式（可能的几种）:
    // 格式1: { a: [[price, vol], ...], b: [[price, vol], ...] }
    // 格式2: { asks: [{p, v}], bids: [{p, v}] }
    // 格式3: { a1~a5, av1~av5, b1~b5, bv1~bv5 }

    let asks = [];
    let bids = [];

    if (Array.isArray(data.a)) {
      asks = data.a.slice(0, 5).map(item =>
        Array.isArray(item)
          ? { price: parseFloat(item[0]), volume: parseFloat(item[1]) }
          : { price: parseFloat(item.p || item.price), volume: parseFloat(item.v || item.volume) }
      );
    } else if (Array.isArray(data.asks)) {
      asks = data.asks.slice(0, 5).map(item => ({
        price: parseFloat(item.p || item.price || item[0]),
        volume: parseFloat(item.v || item.volume || item[1]),
      }));
    } else if (data.a1 !== undefined) {
      // 字段名格式 a1~a5, av1~av5
      for (let i = 1; i <= 5; i++) {
        const p = parseFloat(data[`a${i}`]);
        const v = parseFloat(data[`av${i}`] || data[`a${i}v`] || 0);
        if (!isNaN(p)) asks.push({ price: p, volume: v });
      }
    }

    if (Array.isArray(data.b)) {
      bids = data.b.slice(0, 5).map(item =>
        Array.isArray(item)
          ? { price: parseFloat(item[0]), volume: parseFloat(item[1]) }
          : { price: parseFloat(item.p || item.price), volume: parseFloat(item.v || item.volume) }
      );
    } else if (Array.isArray(data.bids)) {
      bids = data.bids.slice(0, 5).map(item => ({
        price: parseFloat(item.p || item.price || item[0]),
        volume: parseFloat(item.v || item.volume || item[1]),
      }));
    } else if (data.b1 !== undefined) {
      for (let i = 1; i <= 5; i++) {
        const p = parseFloat(data[`b${i}`]);
        const v = parseFloat(data[`bv${i}`] || data[`b${i}v`] || 0);
        if (!isNaN(p)) bids.push({ price: p, volume: v });
      }
    }

    // 过滤无效数据
    asks = asks.filter(a => !isNaN(a.price) && a.price > 0);
    bids = bids.filter(b => !isNaN(b.price) && b.price > 0);

    if (asks.length || bids.length) {
      // 卖盘升序（最低价在前），买盘降序（最高价在前）
      asks.sort((a, b) => a.price - b.price);
      bids.sort((a, b) => b.price - a.price);
      setDepth({ asks, bids });
    }
  }, []);

  const connect = useCallback((sessionId) => {
    if (sessionRef.current !== sessionId) return;

    const url = `${INFOWAY_CONFIG.wsBase}?business=${market}&apikey=${INFOWAY_CONFIG.apiKey}`;
    setStatus('connecting');

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (sessionRef.current !== sessionId) return ws.close();
        setStatus('connected');
        subscribeDepth(ws, symbol);
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
        if (sessionRef.current !== sessionId) return;
        setStatus('disconnected');
        reconnectRef.current = setTimeout(() => connect(sessionId), RECONNECT_DELAY);
      };
    } catch {
      setStatus('error');
    }
  }, [market, symbol, subscribeDepth, handleMessage, clearTimers]);

  useEffect(() => {
    if (!symbol) return;
    const sessionId = ++sessionRef.current;
    connect(sessionId);
    return () => {
      sessionRef.current++;
      clearTimers();
      wsRef.current?.close();
    };
  }, [symbol, market]); // eslint-disable-line react-hooks/exhaustive-deps

  return { depth, status };
}
