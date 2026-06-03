import React from 'react';

/** 展示型：好友列表。friends=[{id,username}]，点击触发 onSelect(friend)。 */
export function FriendList({ friends, onSelect }) {
  if (!friends || friends.length === 0) {
    return <p className="text-sm text-ink-muted px-2 py-4">还没有好友，去上面搜索添加吧。</p>;
  }
  return (
    <ul className="space-y-1">
      {friends.map((f) => (
        <li key={f.id}>
          <button
            type="button"
            onClick={() => onSelect?.(f)}
            className="w-full text-left px-3 py-2 rounded hover:bg-zinc-100 text-ink"
          >
            {f.username}
          </button>
        </li>
      ))}
    </ul>
  );
}

export default FriendList;
