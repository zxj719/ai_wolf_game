import React from 'react';

/**
 * 展示型：消息气泡列表。meId 区分左右对齐。
 * 消息可带 pending（发送中）/ failed（发送失败）态。
 */
export function MessageList({ meId, messages }) {
  if (!messages || messages.length === 0) {
    return <p className="text-sm text-ink-muted py-6 text-center">还没有消息，发一条吧。</p>;
  }
  return (
    <div className="space-y-2">
      {messages.map((m) => {
        const mine = Number(m.fromUser) === Number(meId);
        const key = m.clientMsgId ?? m.id;                 // 稳定 key：ack 后 id 到位也不 remount
        return (
          <div key={key} className={mine ? 'flex justify-end' : 'flex justify-start'}>
            <span
              className={[
                'inline-block max-w-[75%] px-3 py-2 rounded-lg text-sm',
                mine ? 'bg-accent text-white' : 'bg-bg-raised text-ink',
                m.pending ? 'opacity-60' : '',
              ].join(' ')}
            >
              {m.body}
              {m.failed && <span className="block text-xs text-danger mt-0.5">发送失败</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default MessageList;
