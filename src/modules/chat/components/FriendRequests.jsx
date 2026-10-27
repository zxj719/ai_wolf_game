import React from "react";
import { Avatar } from "../../../components/Personal/Avatar";

/** 展示型：收到的好友申请。requests=[{id,fromUser,fromUsername,createdAt}]。 */
export function FriendRequests({ requests, onAccept, onReject, pendingId }) {
  if (!requests || requests.length === 0) return null;
  return (
    <div className="friend-requests">
      <h3>
        新的相遇 <span>{requests.length}</span>
      </h3>
      <ul>
        {requests.map((r) => (
          <li key={r.id}>
            <Avatar
              name={r.fromDisplayName || r.fromUsername}
              color={r.avatarColor || "sage"}
            />
            <span className="request-name">
              {r.fromDisplayName || r.fromUsername}
              <small>想成为你的好友</small>
            </span>
            <span className="request-actions">
              <button
                type="button"
                disabled={pendingId === r.id}
                onClick={() => onAccept?.(r)}
              >
                同意
              </button>
              <button
                type="button"
                disabled={pendingId === r.id}
                onClick={() => onReject?.(r)}
              >
                拒绝
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default FriendRequests;
