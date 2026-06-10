// 共享队列租约存储 — QueueGate 写入，werewolf session 客户端读取并随请求携带。
//
// 后端代理（workers/auth/werewolf.js）要求非 admin 调用必须持有有效的
// werewolf 资源租约（X-Lease-Id 头），这里是前端的租约单一来源。
// 模块级单例：租约本质上「整个标签页同一时刻最多一个」，与组件生命周期无关。

/** @type {'idle' | 'acquiring' | 'active' | 'bypass'} */
let leaseState = 'idle';
let currentLease = null;

export function markQueueAcquiring() {
  if (leaseState !== 'bypass') leaseState = 'acquiring';
}

export function setQueueLease(leaseId) {
  currentLease = leaseId;
  leaseState = 'active';
}

export function clearQueueLease() {
  currentLease = null;
  if (leaseState !== 'bypass') leaseState = 'idle';
}

/** Admin 不走队列（QueueGate 对 admin 直接放行），代理端凭 JWT 放行 */
export function setQueueBypass(bypass) {
  leaseState = bypass ? 'bypass' : 'idle';
  if (bypass) currentLease = null;
}

export function getQueueLease() {
  return currentLease;
}

/**
 * 等待租约就绪。QueueGate 的 acquire 是异步请求，而游戏初始化的首批
 * AI/资产调用几乎同时发出，直接读会有竞态：
 * - active/bypass：立即返回
 * - acquiring：等待至多 timeoutMs（gate 正在抢锁）
 * - idle：等待一个短宽限期（gate 可能正在挂载；测试/无 gate 场景不被长阻塞）
 */
export async function waitForQueueLease(timeoutMs = 8000, idleGraceMs = 600) {
  const start = Date.now();
  while (!currentLease && leaseState !== 'bypass') {
    const budget = leaseState === 'acquiring' ? timeoutMs : idleGraceMs;
    if (Date.now() - start >= budget) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return currentLease;
}
