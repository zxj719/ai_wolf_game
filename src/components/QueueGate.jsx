import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useShell } from '../shell/ShellContext';
import { buildApiUrl } from '../services/apiBase';
import { getToken } from '../utils/authToken';

const HEARTBEAT_INTERVAL = 30_000;
const POLL_INTERVAL = 15_000;

/**
 * QueueGate — wraps a resource-consuming page (werewolf, novel).
 * Acquires a resource lock on mount, releases on unmount.
 * If preempted by admin, triggers onPreempted callback.
 *
 * Props:
 *   resource    — 'werewolf' | 'novel'
 *   onPreempted — () => void (save snapshot + redirect)
 *   children    — the actual page content
 */
export function QueueGate({ resource, onPreempted, children }) {
  const { isAdmin } = useAuth();
  const { isGuestMode } = useShell();

  // Admin bypasses queue entirely
  if (isAdmin) return children;

  return (
    <QueueGateInner
      resource={resource}
      onPreempted={onPreempted}
      isGuest={isGuestMode}
    >
      {children}
    </QueueGateInner>
  );
}

function QueueGateInner({ resource, onPreempted, isGuest, children }) {
  const [status, setStatus] = useState('acquiring');
  const [queueInfo, setQueueInfo] = useState(null);
  const leaseRef = useRef(null);
  const heartbeatRef = useRef(null);
  const pollRef = useRef(null);

  const headers = useCallback(() => {
    const token = getToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, []);

  const acquire = useCallback(async () => {
    try {
      const resp = await fetch(buildApiUrl('/api/queue/acquire'), {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ resource }),
      });
      const data = await resp.json();

      if (data.acquired) {
        leaseRef.current = data.leaseId;
        setStatus('active');
        return true;
      }

      setQueueInfo(data);
      setStatus('waiting');
      return false;
    } catch {
      setStatus('error');
      return false;
    }
  }, [resource, headers]);

  const release = useCallback(async () => {
    if (!leaseRef.current) return;
    try {
      await fetch(buildApiUrl('/api/queue/release'), {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ leaseId: leaseRef.current }),
      });
    } catch {}
    leaseRef.current = null;
  }, [headers]);

  const heartbeat = useCallback(async () => {
    if (!leaseRef.current) return;
    try {
      const resp = await fetch(buildApiUrl('/api/queue/heartbeat'), {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ leaseId: leaseRef.current }),
      });
      const data = await resp.json();
      if (!data.renewed) {
        setStatus('preempted');
        onPreempted?.();
      }
    } catch {}
  }, [headers, onPreempted]);

  const pollStatus = useCallback(async () => {
    if (status === 'active' && leaseRef.current) {
      try {
        const resp = await fetch(buildApiUrl(`/api/queue/status?resource=${resource}`), {
          headers: headers(),
        });
        const data = await resp.json();
        if (data.occupied && data.lock && !data.lock.lease_id?.startsWith(leaseRef.current?.slice(0, 10))) {
          setStatus('preempted');
          onPreempted?.();
        }
      } catch {}
    } else if (status === 'waiting') {
      const success = await acquire();
      if (success) setStatus('active');
    }
  }, [status, resource, headers, acquire, onPreempted]);

  useEffect(() => {
    acquire();
    return () => {
      release();
      clearInterval(heartbeatRef.current);
      clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    if (status === 'active') {
      heartbeatRef.current = setInterval(heartbeat, HEARTBEAT_INTERVAL);
      pollRef.current = setInterval(pollStatus, POLL_INTERVAL);
    }
    return () => {
      clearInterval(heartbeatRef.current);
      clearInterval(pollRef.current);
    };
  }, [status, heartbeat, pollStatus]);

  if (status === 'acquiring') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-zinc-400">正在获取游戏资源...</p>
        </div>
      </div>
    );
  }

  if (status === 'waiting') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">⏳</div>
          <h2 className="text-xl font-bold text-white mb-2">排队中</h2>
          <p className="text-zinc-400 mb-4">
            当前有其他{queueInfo?.holderRole === 'admin' ? '管理员' : '用户'}正在使用，请稍候。
          </p>
          <p className="text-zinc-500 text-sm">系统会自动检查可用性，无需手动刷新。</p>
        </div>
      </div>
    );
  }

  if (status === 'preempted') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">👋</div>
          <h2 className="text-xl font-bold text-white mb-2">管理员已接管</h2>
          <p className="text-zinc-400 mb-4">
            {isGuest
              ? '管理员使用完毕后您可以重新开始。'
              : '您的游戏进度已自动保存，管理员使用完毕后您可以继续。'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            重新排队
          </button>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400">获取资源失败，请刷新重试。</p>
        </div>
      </div>
    );
  }

  return children;
}
