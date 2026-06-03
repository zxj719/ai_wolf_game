import React, { useEffect, useRef } from 'react';

/**
 * 展示型：消息输入。受控。typing 去抖：活跃时 ~1s 一次 true，~3s 空闲/发送后 false。
 * props: value, onChange, onSend, onTyping(bool), disabled
 */
export function MessageInput({ value, onChange, onSend, onTyping, disabled }) {
  const lastTrueRef = useRef(0);
  const idleTimerRef = useRef(null);

  useEffect(() => () => { if (idleTimerRef.current) clearTimeout(idleTimerRef.current); }, []);

  const stopTyping = () => {
    lastTrueRef.current = 0;
    if (idleTimerRef.current) { clearTimeout(idleTimerRef.current); idleTimerRef.current = null; }
    onTyping?.(false);
  };

  const handleChange = (v) => {
    onChange?.(v);
    const now = Date.now();
    if (now - lastTrueRef.current > 1000) { lastTrueRef.current = now; onTyping?.(true); }
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(stopTyping, 3000);
  };

  const handleSend = () => {
    if (disabled) return;
    stopTyping();
    onSend?.();
  };

  return (
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); handleSend(); }}>
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={stopTyping}
        placeholder={disabled ? '连接中…' : '输入消息'}
        className="flex-1 px-3 py-2 rounded border border-zinc-300 text-ink disabled:opacity-50"
      />
      <button type="submit" disabled={disabled} className="px-4 py-2 rounded bg-amber-600 text-white disabled:opacity-50">发送</button>
    </form>
  );
}

export default MessageInput;
