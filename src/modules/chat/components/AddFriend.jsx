import React from "react";
import { Search, UserPlus } from "lucide-react";
import { Avatar } from "../../../components/Personal/Avatar";

/**
 * 展示型：搜索 + 添加好友。受控（query/results 由父组件传入）。
 * onQueryChange(value) / onSearch() / onSendRequest(user)
 */
export function AddFriend({
  query,
  results,
  onQueryChange,
  onSearch,
  onSendRequest,
  searching = false,
  searched = false,
  pendingId,
}) {
  return (
    <div className="friend-search">
      <form
        className="friend-search-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSearch?.();
        }}
      >
        <Search size={16} aria-hidden="true" />
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange?.(e.target.value)}
          placeholder="用户名或邮箱"
          aria-label="搜索好友：用户名或邮箱"
          minLength={2}
          required
          maxLength={100}
        />
        <button type="submit" disabled={searching || query.trim().length < 2}>
          {searching ? "搜索中…" : "搜索"}
        </button>
      </form>
      {results && results.length > 0 && (
        <ul className="friend-search-results">
          {results.map((u) => (
            <li key={u.id}>
              <Avatar
                name={u.displayName || u.username}
                color={u.avatarColor}
              />
              <span>
                <strong>{u.displayName || u.username}</strong>
                <small>@{u.username}</small>
              </span>
              <button
                type="button"
                disabled={pendingId === u.id}
                onClick={() => onSendRequest?.(u)}
              >
                <UserPlus size={14} />
                {pendingId === u.id ? "处理中…" : "添加"}
              </button>
            </li>
          ))}
        </ul>
      )}
      {searched && !searching && !results?.length && (
        <p className="friend-search-hint" role="status">
          没有找到匹配的用户，试试其他用户名。
        </p>
      )}
    </div>
  );
}

export default AddFriend;
