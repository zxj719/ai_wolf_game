import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useShell } from '../shell/ShellContext';
import { buildApiUrl } from '../services/apiBase';
import { getToken } from '../utils/authToken';
import { markQueueAcquiring, setQueueLease, clearQueueLease, setQueueBypass } from '../services/queueLease';

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
 *   readOnly    — bool, true = bypass queue (page does not consume ECS resources)
 *   children    — the actual page content
 */
export function QueueGate({ resource, onPreempted, readOnly = false, children }) {
  const { isAdmin } = useAuth();
  const { isGuestMode } = useShell();

  // Admin 不走队列：标记 bypass，让 session 客户端不等待租约（代理端凭 JWT 放行）
  useEffect(() => {
    if (isAdmin) {
      setQueueBypass(true);
      return () => setQueueBypass(false);
    }
  }, [isAdmin]);

  // Admin bypasses queue entirely
  if (isAdmin) return children;
  // Read-only callers (e.g. non-admin novel browsing) consume no ECS resources,
  // so the lock would be a UX-blocking no-op. Per CLAUDE.md: "不受队列限制: 小说只读观看".
  if (readOnly) return children;

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
    // 每次取租约都先宣告状态：等待方（werewolfSessionClient.waitForQueueLease）
    // 在 'acquiring' 下用 8s 预算，在 'idle' 下只给 600ms。心跳因租约过期重新
    // acquire 时若不标记，这个窗口里发出的 AI 请求会不带 X-Lease-Id 而被 401。
    markQueueAcquiring();
    try {
      const resp = await fetch(buildApiUrl('/api/queue/acquire'), {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ resource }),
      });
      const data = await resp.json();

      if (data.acquired) {
        leaseRef.current = data.leaseId;
        setQueueLease(data.leaseId);
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
    clearQueueLease();
  }, [headers]);

  const heartbeat = useCallback(async () => {
    if (!leaseRef.current) return;
    try {
      const resp = await fetch(buildApiUrl('/api/queue/heartbeat'), {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ leaseId: leaseRef.current, resource }),
      });
      const data = await resp.json();
      if (data.renewed) return;

      // 租约到期后被清理表扫掉（后台标签页 setInterval 被节流是最常见成因），
      // 资源当下无人持有 → 静默补回租约，不打断进行中的对局。
      if (data.reason === 'expired') {
        leaseRef.current = null;
        clearQueueLease();
        await acquire();
        return;
      }

      clearQueueLease();
      setStatus('preempted');
      onPreempted?.();
    } catch {}
  }, [headers, onPreempted, resource, acquire]);

  // 抢占检测只认 heartbeat：它把 leaseId 交给服务端判定，是唯一可靠信号。
  //
  // 这里曾经拿 /api/queue/status 的 lock.lease_id 和本地租约比对，但那个接口
  // 从不返回 lease_id —— 它无需鉴权、任何人都能读，泄露 lease_id 等于把
  // X-Lease-Id 送人，可以直接绕开队列白嫖 ECS。字段既然永远是 undefined，
  // `!undefined?.startsWith(...)` 就恒为 true，于是每 15s 轮询都把正常对局
  // 判成「管理员已接管」，开局十几秒就被踢回设置页。管理员因为整个 QueueGate
  // 都走 bypass，从来复现不到。
  //
  // 现在这里只负责排队中的自动重试。
  const pollStatus = useCallback(async () => {
    if (status !== 'waiting') return;
    await acquire();
  }, [status, acquire]);

  useEffect(() => {
    markQueueAcquiring();
    acquire();
    return () => {
      release();
      clearInterval(heartbeatRef.current);
      clearInterval(pollRef.current);
    };
  }, []);

  // 轮询只在排队时跑。此前它挂在 status === 'active' 分支下，而 pollStatus
  // 内部只处理 'waiting'，两个条件永不同时成立 —— 排队页那句「系统会自动检查
  // 可用性，无需手动刷新」其实从来没生效过。
  useEffect(() => {
    if (status === 'active') {
      heartbeatRef.current = setInterval(heartbeat, HEARTBEAT_INTERVAL);
    } else if (status === 'waiting') {
      pollRef.current = setInterval(pollStatus, POLL_INTERVAL);
    }
    return () => {
      clearInterval(heartbeatRef.current);
      clearInterval(pollRef.current);
    };
  }, [status, heartbeat, pollStatus]);

  // 标签页重新可见时立刻补一次心跳：后台期间 setInterval 被浏览器节流，
  // 等下一个 30s 周期可能已经超过 5 分钟租约窗口。
  useEffect(() => {
    if (status !== 'active') return;
    const onVisible = () => { if (!document.hidden) heartbeat(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [status, heartbeat]);

  if (status === 'acquiring') {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-accent border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-ink-muted">正在获取游戏资源...</p>
        </div>
      </div>
    );
  }

  if (status === 'waiting') {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">⏳</div>
          <h2 className="text-xl font-bold text-ink mb-2">排队中</h2>
          <p className="text-ink-muted mb-4">
            当前有其他{queueInfo?.holderRole === 'admin' ? '管理员' : '用户'}正在使用，请稍候。
          </p>
          <p className="text-ink-faint text-sm">系统会自动检查可用性，无需手动刷新。</p>
        </div>
      </div>
    );
  }

  if (status === 'preempted') {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">👋</div>
          <h2 className="text-xl font-bold text-ink mb-2">管理员已接管</h2>
          <p className="text-ink-muted mb-4">
            {isGuest
              ? '管理员使用完毕后您可以重新开始。'
              : '您的游戏进度已自动保存，管理员使用完毕后您可以继续。'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-accent text-white rounded-lg hover:bg-accent-hover transition"
          >
            重新排队
          </button>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center">
          <p className="text-danger">获取资源失败，请刷新重试。</p>
        </div>
      </div>
    );
  }

  return children;
}
