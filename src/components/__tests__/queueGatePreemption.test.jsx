import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockUseAuth = vi.fn();
const mockUseShell = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../../shell/ShellContext', () => ({
  useShell: () => mockUseShell(),
}));

vi.mock('../../services/apiBase', () => ({
  buildApiUrl: (p) => `https://example.test${p}`,
}));

vi.mock('../../utils/authToken', () => ({
  getToken: () => null,
}));

vi.mock('../../services/queueLease', () => ({
  markQueueAcquiring: vi.fn(),
  setQueueLease: vi.fn(),
  clearQueueLease: vi.fn(),
  setQueueBypass: vi.fn(),
}));

const { QueueGate } = await import('../QueueGate.jsx');

const LEASE_ID = 'lease-1786583927858-e35mmybp';

/**
 * 生产环境 /api/queue/status 的真实返回形状。
 *
 * 关键：lock 里【没有】lease_id。handleQueueStatus 只 SELECT
 * resource / holder_role / acquired_at / expires_at，这是有意为之——该接口
 * 无需鉴权，泄露 lease_id 等于把 X-Lease-Id 送人，可绕过队列直接消耗 ECS。
 */
function statusBody() {
  return {
    resource: 'werewolf',
    occupied: true,
    lock: {
      resource: 'werewolf',
      holder_role: 'guest',
      acquired_at: '2026-08-13 01:18:47',
      expires_at: '2026-08-13T01:23:47.858Z',
    },
  };
}

function installFetch() {
  const calls = [];
  globalThis.fetch = vi.fn(async (url) => {
    calls.push(String(url));
    const u = String(url);
    let body;
    if (u.includes('/api/queue/acquire')) {
      body = { acquired: true, leaseId: LEASE_ID };
    } else if (u.includes('/api/queue/status')) {
      body = statusBody();
    } else if (u.includes('/api/queue/heartbeat')) {
      body = { renewed: true, expiresAt: '2026-08-13T01:28:47.858Z' };
    } else if (u.includes('/api/queue/release')) {
      body = { released: true };
    } else {
      body = {};
    }
    return { ok: true, json: async () => body };
  });
  return calls;
}

// act() + fake timers：推进定时器后还要把 fetch 的 microtask 队列排空。
async function advance(ms) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('QueueGate 抢占误判回归', () => {
  let container;
  let root;

  beforeEach(() => {
    vi.useFakeTimers();
    mockUseAuth.mockReturnValue({ isAdmin: false });
    mockUseShell.mockReturnValue({ isGuestMode: true });
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('对局进行中不会因为 status 不返回 lease_id 而误判被抢占', async () => {
    installFetch();
    const onPreempted = vi.fn();

    await act(async () => {
      root = createRoot(container);
      root.render(
        <QueueGate resource="werewolf" onPreempted={onPreempted}>
          <div data-testid="arena">对局进行中</div>
        </QueueGate>
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    // 租约到手，正常渲染对局。
    expect(container.textContent).toContain('对局进行中');

    // 跨过若干个轮询周期(15s)和心跳周期(30s)。
    // 修复前：第一个 15s 轮询就会把 undefined lease_id 判成被抢占并踢回设置页。
    await advance(20_000);
    expect(onPreempted).not.toHaveBeenCalled();
    expect(container.textContent).toContain('对局进行中');

    await advance(40_000);
    expect(onPreempted).not.toHaveBeenCalled();

    await advance(60_000);
    expect(onPreempted).not.toHaveBeenCalled();
    expect(container.textContent).toContain('对局进行中');
    expect(container.textContent).not.toContain('管理员已接管');
  });

  it('heartbeat 报 preempted 时才真正中断对局', async () => {
    globalThis.fetch = vi.fn(async (url) => {
      const u = String(url);
      if (u.includes('/api/queue/acquire')) {
        return { ok: true, json: async () => ({ acquired: true, leaseId: LEASE_ID }) };
      }
      if (u.includes('/api/queue/heartbeat')) {
        return { ok: true, json: async () => ({ renewed: false, reason: 'preempted', holderRole: 'admin' }) };
      }
      return { ok: true, json: async () => ({}) };
    });
    const onPreempted = vi.fn();

    await act(async () => {
      root = createRoot(container);
      root.render(
        <QueueGate resource="werewolf" onPreempted={onPreempted}>
          <div>对局进行中</div>
        </QueueGate>
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    await advance(35_000);
    expect(onPreempted).toHaveBeenCalled();
    expect(container.textContent).toContain('管理员已接管');
  });

  it('heartbeat 报 expired（自己掉线、资源空闲）时静默续租，不中断对局', async () => {
    let heartbeats = 0;
    globalThis.fetch = vi.fn(async (url) => {
      const u = String(url);
      if (u.includes('/api/queue/acquire')) {
        return { ok: true, json: async () => ({ acquired: true, leaseId: LEASE_ID }) };
      }
      if (u.includes('/api/queue/heartbeat')) {
        heartbeats += 1;
        return { ok: true, json: async () => ({ renewed: false, reason: 'expired', holderRole: null }) };
      }
      return { ok: true, json: async () => ({}) };
    });
    const onPreempted = vi.fn();

    await act(async () => {
      root = createRoot(container);
      root.render(
        <QueueGate resource="werewolf" onPreempted={onPreempted}>
          <div>对局进行中</div>
        </QueueGate>
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    await advance(35_000);
    expect(heartbeats).toBeGreaterThan(0);
    expect(onPreempted).not.toHaveBeenCalled();
    expect(container.textContent).toContain('对局进行中');
  });

  it('admin 完全绕过队列，不发任何 queue 请求', async () => {
    const calls = installFetch();
    mockUseAuth.mockReturnValue({ isAdmin: true });

    await act(async () => {
      root = createRoot(container);
      root.render(
        <QueueGate resource="werewolf" onPreempted={vi.fn()}>
          <div>对局进行中</div>
        </QueueGate>
      );
      await Promise.resolve();
    });

    expect(container.textContent).toContain('对局进行中');
    expect(calls.filter((c) => c.includes('/api/queue/'))).toHaveLength(0);
  });
});
