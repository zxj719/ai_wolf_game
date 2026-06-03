import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getToken } from '../utils/authToken';

// 生产默认是 wss（无 localhost，check-build 不报泄漏）。
// 本地 dev：把 VITE_CHAT_WS_URL=ws://localhost:3001/ws/chat 放 .env.development.local（绝不 .env.local）。
const WS_URL = import.meta.env.VITE_CHAT_WS_URL || 'wss://novel-origin.zhaxiaoji.com/ws/chat';

/**
 * useChatSocket — 维护到 ECS 的 WebSocket：自动重连、收发、presence、ack。
 * token 通过 Sec-WebSocket-Protocol 子协议传递（不进 URL/日志）。
 *
 * 返回 { status, onlineFriends, reconnectNonce, send, sendTyping, subscribe }。
 *   subscribe(handler) 注册原始消息回调；返回取消订阅函数。
 *   reconnectNonce 每次「重连成功」自增，供会话层做断线补拉。
 */
export function useChatSocket(enabled) {
  const [status, setStatus] = useState('idle');          // idle|connecting|open|closed
  const [onlineFriends, setOnlineFriends] = useState(() => new Set());
  const [reconnectNonce, setReconnectNonce] = useState(0);

  const wsRef = useRef(null);
  const handlersRef = useRef(new Set());
  const retryRef = useRef(0);

  const emit = useCallback((msg) => {
    for (const h of handlersRef.current) { try { h(msg); } catch { /* ignore */ } }
  }, []);

  const connect = useCallback(() => {
    const token = getToken();
    if (!token) return;
    setStatus('connecting');
    let ws;
    try {
      ws = new WebSocket(WS_URL, ['bearer', token]);       // token 走子协议
    } catch {
      setStatus('closed');
      return;
    }
    ws._closedByUs = false;                                // 关闭意图绑到具体实例（StrictMode 安全）
    wsRef.current = ws;

    ws.onopen = () => {
      const wasRetry = retryRef.current > 0;
      retryRef.current = 0;
      setStatus('open');
      if (wasRetry) setReconnectNonce((n) => n + 1);       // 重连成功 → 触发补拉
    };
    ws.onclose = () => {
      if (ws._closedByUs) return;
      if (wsRef.current === ws) setStatus('closed');
      const delay = Math.min(30000, 1000 * 2 ** retryRef.current);   // 指数退避，封顶 30s
      retryRef.current += 1;
      setTimeout(() => { if (!ws._closedByUs && wsRef.current === ws) connect(); }, delay);
    };
    ws.onerror = () => { try { ws.close(); } catch { /* noop */ } };
    ws.onmessage = (ev) => {
      let msg; try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.type === 'presence:init') {
        setOnlineFriends(new Set((msg.online || []).map(Number)));
      } else if (msg.type === 'presence') {
        setOnlineFriends((prev) => {
          const n = new Set(prev);
          if (msg.online) n.add(Number(msg.userId)); else n.delete(Number(msg.userId));
          return n;
        });
      }
      emit(msg);
    };
  }, [emit]);

  useEffect(() => {
    if (!enabled) return undefined;
    retryRef.current = 0;
    connect();
    return () => {
      const ws = wsRef.current;
      if (ws) { ws._closedByUs = true; try { ws.close(); } catch { /* noop */ } }
      wsRef.current = null;
    };
  }, [enabled, connect]);

  const send = useCallback((to, body, clientMsgId) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify({ type: 'chat:message', to, body, clientMsgId }));
    return true;
  }, []);

  const sendTyping = useCallback((to, typing) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'chat:typing', to, typing }));
  }, []);

  const subscribe = useCallback((handler) => {
    handlersRef.current.add(handler);
    return () => handlersRef.current.delete(handler);
  }, []);

  return useMemo(
    () => ({ status, onlineFriends, reconnectNonce, send, sendTyping, subscribe }),
    [status, onlineFriends, reconnectNonce, send, sendTyping, subscribe]
  );
}
