import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FriendList } from '../components/FriendList.jsx';
import { FriendRequests } from '../components/FriendRequests.jsx';
import { AddFriend } from '../components/AddFriend.jsx';

describe('FriendList', () => {
  it('renders each friend username', () => {
    const html = renderToStaticMarkup(
      <FriendList friends={[{ id: 1, username: 'alice01' }, { id: 2, username: 'bob01' }]} onSelect={() => {}} />
    );
    expect(html).toContain('alice01');
    expect(html).toContain('bob01');
  });

  it('renders an empty hint when no friends', () => {
    const html = renderToStaticMarkup(<FriendList friends={[]} onSelect={() => {}} />);
    expect(html).toContain('还没有好友');
  });
});

describe('FriendRequests', () => {
  it('renders requester username and accept/reject controls', () => {
    const html = renderToStaticMarkup(
      <FriendRequests
        requests={[{ id: 9, fromUser: 3, fromUsername: 'carol', createdAt: 1 }]}
        onAccept={() => {}}
        onReject={() => {}}
      />
    );
    expect(html).toContain('carol');
    expect(html).toContain('同意');
    expect(html).toContain('拒绝');
  });
});

describe('AddFriend', () => {
  it('renders search input and button', () => {
    const html = renderToStaticMarkup(
      <AddFriend query="" results={[]} onQueryChange={() => {}} onSearch={() => {}} onSendRequest={() => {}} />
    );
    expect(html).toContain('搜索');
  });

  it('renders search results with send buttons', () => {
    const html = renderToStaticMarkup(
      <AddFriend
        query="bo" results={[{ id: 2, username: 'bob01' }]}
        onQueryChange={() => {}} onSearch={() => {}} onSendRequest={() => {}}
      />
    );
    expect(html).toContain('bob01');
  });
});
