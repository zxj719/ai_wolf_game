import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MessageList } from '../components/MessageList.jsx';
import { MessageInput } from '../components/MessageInput.jsx';

describe('MessageList', () => {
  it('renders message bodies', () => {
    const html = renderToStaticMarkup(
      <MessageList meId={1} messages={[
        { id: 1, fromUser: 1, body: 'hi there', createdAt: 1 },
        { id: 2, fromUser: 2, body: 'hello back', createdAt: 2 },
      ]} />
    );
    expect(html).toContain('hi there');
    expect(html).toContain('hello back');
  });

  it('shows empty hint when no messages', () => {
    const html = renderToStaticMarkup(<MessageList meId={1} messages={[]} />);
    expect(html).toContain('还没有消息');
  });

  it('marks a failed message', () => {
    const html = renderToStaticMarkup(
      <MessageList meId={1} messages={[{ clientMsgId: 'c1', fromUser: 1, body: 'oops', createdAt: 1, failed: true }]} />
    );
    expect(html).toContain('发送失败');
  });
});

describe('MessageInput', () => {
  it('renders input and send button', () => {
    const html = renderToStaticMarkup(
      <MessageInput value="" onChange={() => {}} onSend={() => {}} onTyping={() => {}} disabled={false} />
    );
    expect(html).toContain('发送');
  });
});
