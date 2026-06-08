import React from 'react';

/**
 * 展示型：搜索 + 添加好友。受控（query/results 由父组件传入）。
 * onQueryChange(value) / onSearch() / onSendRequest(user)
 */
export function AddFriend({ query, results, onQueryChange, onSearch, onSendRequest }) {
  return (
    <div className="space-y-2">
      <form
        className="flex gap-2"
        onSubmit={(e) => { e.preventDefault(); onSearch?.(); }}
      >
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange?.(e.target.value)}
          placeholder="用户名或邮箱"
          className="flex-1 px-3 py-2 rounded border border-line bg-bg-raised text-ink"
        />
        <button type="submit" className="px-3 py-2 rounded bg-accent hover:bg-accent-hover text-white">搜索</button>
      </form>
      {results && results.length > 0 && (
        <ul className="space-y-1">
          {results.map((u) => (
            <li key={u.id} className="flex items-center justify-between px-3 py-2 rounded hover:bg-bg-sunken">
              <span className="text-ink">{u.username}</span>
              <button type="button" onClick={() => onSendRequest?.(u)} className="text-sm text-accent">添加</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default AddFriend;
