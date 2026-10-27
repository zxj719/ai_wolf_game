import React from "react";
import { MessageCircle, Users } from "lucide-react";
import { Avatar } from "../../../components/Personal/Avatar";

/** 展示型：好友列表。friends=[{id,username}]，点击触发 onSelect(friend)。 */
export function FriendList({
  friends,
  onSelect,
  selectedId,
  onlineFriends = new Set(),
}) {
  if (!friends || friends.length === 0) {
    return (
      <div className="friends-empty-list">
        <Users size={25} strokeWidth={1.3} />
        <strong>还没有好友</strong>
        <p>
          从一个招呼开始。搜索用户名，
          <br />
          邀请朋友来这里坐坐。
        </p>
      </div>
    );
  }
  return (
    <ul className="friend-list">
      {friends.map((f) => (
        <li key={f.id}>
          <button
            type="button"
            onClick={() => onSelect?.(f)}
            aria-pressed={Number(selectedId) === Number(f.id)}
            className="friend-row"
          >
            <span className="friend-avatar-wrap">
              <Avatar
                name={f.displayName || f.username}
                color={f.avatarColor}
              />
              {onlineFriends.has(Number(f.id)) && (
                <i className="friend-online-dot" />
              )}
            </span>
            <span className="friend-row-copy">
              <strong>{f.displayName || f.username}</strong>
              <small>{f.bio || `@${f.username}`}</small>
            </span>
            <MessageCircle size={15} className="friend-row-arrow" />
          </button>
        </li>
      ))}
    </ul>
  );
}

export default FriendList;
