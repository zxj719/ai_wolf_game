import React from 'react';

/** 展示型：收到的好友申请。requests=[{id,fromUser,fromUsername,createdAt}]。 */
export function FriendRequests({ requests, onAccept, onReject }) {
  if (!requests || requests.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-ink-muted">好友申请</h3>
      <ul className="space-y-2">
        {requests.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded bg-amber-50">
            <span className="text-ink">{r.fromUsername}</span>
            <span className="flex gap-2">
              <button type="button" onClick={() => onAccept?.(r)} className="text-sm text-green-700">同意</button>
              <button type="button" onClick={() => onReject?.(r)} className="text-sm text-red-600">拒绝</button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default FriendRequests;
