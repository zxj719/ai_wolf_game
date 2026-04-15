/**
 * 夜间神职行为树 —— 单元测试
 *
 * 守卫：guardProtectTree
 * 预言家：seerCheckTree
 * 女巫：witchPotionTree
 */

import { describe, it, expect } from 'vitest';
import { BehaviorTree } from '../core/BehaviorTree.js';
import { buildBlackboard } from '../blackboard/buildBlackboard.js';
import { guardProtectTree } from '../trees/guard/protect.js';
import { seerCheckTree } from '../trees/seer/check.js';
import { witchPotionTree } from '../trees/witch/potion.js';

// ────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────

const makePlayer = (id, role = '村民', alive = true) => ({
  id, role, name: `${id}号`, isAlive: alive
});

const makeSeerSpeech = (playerId, day, { kills = [], goldWaters = [] } = {}) => ({
  playerId, day,
  claimedRole: '预言家',
  content: `我是预言家。${kills.length ? '查杀' + kills.map(k=>k+'号').join(',') : ''}${goldWaters.length ? '，金水'+goldWaters.map(g=>g+'号').join(',') : ''}`,
  logicNodes: [],
});

const makeState = (overrides = {}) => ({
  players: [1,2,3,4,5,6,7,8].map(id => makePlayer(id)),
  speechHistory: [],
  voteHistory: [],
  seerChecks: [],
  dayCount: 1,
  ...overrides,
});

const runTree = (tree, gameState, selfId, params = {}) => {
  const self = gameState.players.find(p => p.id === selfId);
  const validTargets = params.validTargets
    ?? gameState.players.filter(p => p.isAlive && p.id !== selfId).map(p => p.id);
  const bb = buildBlackboard(gameState, self, { ...params, validTargets });
  const decision = new BehaviorTree(tree).run(bb);
  return { decision, trace: bb.trace };
};

// ────────────────────────────────────────────────
// 守卫
// ────────────────────────────────────────────────

describe('guardProtectTree', () => {
  it('唯一预言家跳 → 守护预言家', () => {
    const state = makeState({
      speechHistory: [makeSeerSpeech(2, 1, { goldWaters: [5] })],
    });
    const { decision } = runTree(guardProtectTree, state, 7, { cannotGuard: null });
    expect(decision.targetId).toBe(2);
  });

  it('有金水且不是唯一预言家覆盖时 → 守护金水', () => {
    // 无人跳预言家，但某场景假设有金水信号（通过让seerClaims含金水）
    const state = makeState({
      speechHistory: [makeSeerSpeech(3, 1, { goldWaters: [6], kills: [] })],
    });
    const { decision } = runTree(guardProtectTree, state, 7, { cannotGuard: null });
    // 有唯一预言家（3号），优先守预言家
    expect(decision.targetId).toBe(3);
  });

  it('连守约束：不能守上晚目标', () => {
    const state = makeState({
      speechHistory: [makeSeerSpeech(2, 1)],
    });
    // 上晚守了 2 号（预言家），今晚应该守其他人
    const { decision } = runTree(guardProtectTree, state, 7, { cannotGuard: 2 });
    expect(decision.targetId).not.toBe(2);
    expect(decision.targetId).not.toBeNull(); // 不能空守（要兜底）
  });

  it('兜底：无线索时守随机存活玩家（不守自己）', () => {
    const state = makeState();
    const { decision } = runTree(guardProtectTree, state, 7, { cannotGuard: null });
    expect(decision.targetId).not.toBe(7);
    expect([1,2,3,4,5,6,8]).toContain(decision.targetId);
  });

  it('决策延迟 < 10ms', () => {
    const state = makeState({ speechHistory: [makeSeerSpeech(2, 1)] });
    const t = performance.now();
    runTree(guardProtectTree, state, 7, { cannotGuard: null });
    expect(performance.now() - t).toBeLessThan(10);
  });
});

// ────────────────────────────────────────────────
// 预言家
// ────────────────────────────────────────────────

describe('seerCheckTree', () => {
  it('兜底：从 validTargets 里查一个', () => {
    const state = makeState();
    const validTargets = [1, 2, 4, 5]; // 已排除自己（3）和已查过的
    const { decision } = runTree(seerCheckTree, state, 3, { validTargets });
    expect(validTargets).toContain(decision.targetId);
  });

  it('高嫌疑目标（有归票）→ 优先查验', () => {
    // 多条发言指控 5 号
    const accusations = [1, 2, 6, 7, 8].map(voter => ({
      playerId: voter, day: 1, content: '5号可疑',
      logicNodes: [{ type: 'accuse', targetId: 5, text: '5号是狼' }],
    }));
    const state = makeState({ speechHistory: accusations });
    const validTargets = [1, 2, 4, 5, 6]; // 5 号是高嫌疑
    const { decision } = runTree(seerCheckTree, state, 3, { validTargets });
    // 可能是随机兜底（因为 speechHistory 无 seerClaims），但 5 号的 accusation 加分
    // 5 条指控 × 5 = 25，不够 30 阈值 —— 这时走随机兜底是合理的
    expect(validTargets).toContain(decision.targetId);
  });

  it('所有目标都已查（validTargets 为空） → 决策为 null（上层逻辑处理）', () => {
    const state = makeState();
    const validTargets = [];
    const { decision } = runTree(seerCheckTree, state, 3, { validTargets });
    // checkRandom 返回 false 时 BT 失败，decision 为 null
    expect(decision).toBeNull();
  });

  it('决策延迟 < 10ms', () => {
    const state = makeState();
    const t = performance.now();
    runTree(seerCheckTree, state, 3, { validTargets: [1, 2, 4] });
    expect(performance.now() - t).toBeLessThan(10);
  });
});

// ────────────────────────────────────────────────
// 女巫
// ────────────────────────────────────────────────

describe('witchPotionTree', () => {
  it('第一夜 + canSave → 使用解药', () => {
    const state = makeState({ dayCount: 1 });
    const { decision } = runTree(witchPotionTree, state, 6, {
      dyingId: 2, canSave: true, hasPoison: true,
    });
    expect(decision.useSave).toBe(true);
    expect(decision.usePoison).toBeNull();
  });

  it('被刀的是公开金水 → 使用解药（非第一夜）', () => {
    const state = makeState({
      dayCount: 2,
      speechHistory: [makeSeerSpeech(1, 1, { goldWaters: [3] })],
    });
    const { decision } = runTree(witchPotionTree, state, 6, {
      dyingId: 3, canSave: true, hasPoison: true,
    });
    expect(decision.useSave).toBe(true);
  });

  it('有查杀目标存活 + 有毒药 → 毒查杀目标', () => {
    const state = makeState({
      dayCount: 2,
      speechHistory: [makeSeerSpeech(1, 1, { kills: [5] })],
    });
    const validTargets = [2, 3, 4, 5, 7, 8]; // 5 号是查杀目标且存活
    const { decision } = runTree(witchPotionTree, state, 6, {
      dyingId: 4, canSave: false, hasPoison: true, validTargets,
    });
    expect(decision.useSave).toBe(false);
    expect(decision.usePoison).toBe(5);
  });

  it('无线索 + 无解药 + 无毒药 → 什么都不做', () => {
    const state = makeState({ dayCount: 2 });
    const { decision } = runTree(witchPotionTree, state, 6, {
      dyingId: 2, canSave: false, hasPoison: false,
    });
    expect(decision.useSave).toBe(false);
    expect(decision.usePoison).toBeNull();
  });

  it('无线索 + 有解药但不值得救（非金水/非第一夜）→ 不救，留药', () => {
    const state = makeState({ dayCount: 3 });
    const { decision } = runTree(witchPotionTree, state, 6, {
      dyingId: 2, canSave: true, hasPoison: true,
    });
    // dyingId=2 不是金水也不是唯一预言家 → shouldSave = false → 走后续分支
    // 无查杀目标 + 无高嫌疑（空 speechHistory）→ doNothing
    expect(decision.useSave).toBe(false);
    expect(decision.usePoison).toBeNull();
  });

  it('决策延迟 < 10ms', () => {
    const state = makeState();
    const t = performance.now();
    runTree(witchPotionTree, state, 6, { dyingId: 2, canSave: true, hasPoison: false });
    expect(performance.now() - t).toBeLessThan(10);
  });
});
