/**
 * snapshotBuilder.js — 不可变游戏快照
 *
 * 每次 AI 请求前调用 buildSnapshot()，把当前 state 冻结成一个带版本号的对象。
 * AI 回调拿到结果后，commitDecision() 会检查 snapshot.version 是否还等于
 * 当前 state.version。如果已经有其他动作推进了 state，直接丢弃该结果。
 *
 * 这解决了：
 *   - 预言家多次查验：第一次 commit 成功后 version 递增，后续重复回调被丢弃
 *   - 女巫解药多次使用：同上
 *   - 夜间结算不一致：resolveNight 基于 snapshot，不受异步 callback 干扰
 */

let _globalVersion = 0;

/**
 * 从 game state 构建不可变快照
 * @param {object} state  当前游戏 state（players, dayCount, nightDecisions, ...）
 * @param {object} extra  附加字段（如 nightStep, phase, seerChecks）
 * @returns {Snapshot}
 */
export function buildSnapshot(state, extra = {}) {
  const version = ++_globalVersion;
  return Object.freeze({
    version,
    timestamp: Date.now(),
    // 深拷贝避免外部 mutation 影响快照
    players:        state.players.map(p => ({ ...p })),
    dayCount:       state.dayCount,
    nightDecisions: { ...state.nightDecisions },
    seerChecks:     [...(state.seerChecks ?? [])],
    speechHistory:  [...(state.speechHistory ?? [])],
    voteHistory:    [...(state.voteHistory ?? [])],
    deathHistory:   [...(state.deathHistory ?? [])],
    ...extra,
    // 推导出常用字段
    alivePlayers:   state.players.filter(p => p.isAlive),
    aliveIds:       state.players.filter(p => p.isAlive).map(p => p.id),
    wolves:         state.players.filter(p => p.isAlive && p.role === '狼人'),
    goodPlayers:    state.players.filter(p => p.isAlive && p.role !== '狼人'),
  });
}

/**
 * 检查快照是否仍然有效（version 未被其他 commit 推进）
 * @param {Snapshot} snapshot
 * @param {number}   currentVersion  调用方从 useRef 或闭包里拿到的最新 version
 * @returns {boolean}
 */
export function isSnapshotFresh(snapshot, currentVersion) {
  return snapshot.version === currentVersion;
}

/** 获取当前全局 version（存入 ref，供 commit 时比对） */
export function getCurrentVersion() {
  return _globalVersion;
}

/**
 * 构建动作的幂等 key
 * 格式：{gameId}:d{day}:{phase}:s{step}:p{playerId}:{actionType}
 */
export function buildActionKey({ gameId, day, phase, step, playerId, actionType }) {
  return `${gameId ?? 'local'}:d${day}:${phase}:s${step ?? 0}:p${playerId}:${actionType}`;
}
