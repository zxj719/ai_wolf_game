/**
 * actionQueue.js — 幂等动作队列
 *
 * 解决问题：
 *   - AI 回调可能因网络重试被调用多次
 *   - 同一夜间阶段可能因 useEffect 重触发发出两次 AI 请求
 *   - LLM 超时重试导致同一决策被 commit 两次
 *
 * 使用方式：
 *   const key = buildActionKey({ gameId, day, phase, step, playerId, actionType });
 *   if (actionQueue.isDuplicate(key)) return;   // 丢弃重复
 *   actionQueue.mark(key);                       // 标记已处理
 *   // ... commit decision ...
 *   actionQueue.complete(key, result);           // 完成
 *
 * 每局游戏结束后调用 actionQueue.reset() 清空记录。
 */

/** @typedef {'pending'|'completed'|'failed'} ActionStatus */

class ActionQueue {
  constructor() {
    /** @type {Map<string, { status: ActionStatus, result?: any, ts: number }>} */
    this._map = new Map();
    this._maxAge = 5 * 60 * 1000; // 5 分钟自动过期（防止内存泄漏）
  }

  /**
   * 检查该 key 是否已经在队列中（pending 或 completed）
   * @param {string} key
   * @returns {boolean}
   */
  isDuplicate(key) {
    this._evict();
    return this._map.has(key);
  }

  /**
   * 标记动作开始处理（pending 状态）
   * @param {string} key
   */
  mark(key) {
    this._map.set(key, { status: 'pending', ts: Date.now() });
  }

  /**
   * 标记动作已完成
   * @param {string} key
   * @param {any}    result
   */
  complete(key, result) {
    const entry = this._map.get(key);
    if (entry) {
      entry.status = 'completed';
      entry.result = result;
    }
  }

  /**
   * 标记动作失败（允许重试）
   * 失败后会从队列移除，下一次请求视为新请求
   * @param {string} key
   */
  fail(key) {
    this._map.delete(key);
  }

  /**
   * 获取已完成动作的缓存结果（用于快速重放）
   * @param {string} key
   * @returns {any|undefined}
   */
  getResult(key) {
    const entry = this._map.get(key);
    return entry?.status === 'completed' ? entry.result : undefined;
  }

  /** 当前队列大小（用于调试） */
  get size() {
    return this._map.size;
  }

  /** 清空所有记录（每局游戏结束时调用） */
  reset() {
    this._map.clear();
  }

  /** 清除超过 maxAge 的过期条目 */
  _evict() {
    const cutoff = Date.now() - this._maxAge;
    for (const [key, entry] of this._map) {
      if (entry.ts < cutoff) this._map.delete(key);
    }
  }
}

/** 全局单例，整个应用共享 */
export const actionQueue = new ActionQueue();
