/**
 * 狼人行为树 —— 单元测试
 *
 * 覆盖：
 *   - werewolfVoteTree: 投票硬约束 + 优先级
 *   - werewolfSpeechTree: 策略选择 + 输出结构
 */

import { describe, it, expect } from 'vitest';
import { BehaviorTree } from '../core/BehaviorTree.js';
import { buildBlackboard } from '../blackboard/buildBlackboard.js';
import { werewolfVoteTree } from '../trees/werewolf/vote.js';
import { werewolfSpeechTree } from '../trees/werewolf/speech.js';

// ────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────

const makePlayer = (id, role = '村民', alive = true) => ({
  id, role, name: `${id}号`, isAlive: alive, personality: { traits: '普通' }
});

const makeWolfState = (wolfId, teammates = [], overrides = {}) => ({
  players: [1,2,3,4,5,6,7,8].map(id =>
    makePlayer(id, teammates.includes(id) || id === wolfId ? '狼人' : '村民')
  ),
  speechHistory: [],
  voteHistory: [],
  seerChecks: [],
  dayCount: 1,
  ...overrides,
});

const makeSeerSpeech = (playerId, day, { kills = [], goldWaters = [] } = {}) => ({
  playerId, day,
  claimedRole: '预言家',
  content: `我是预言家。${kills.map(k=>`查杀${k}号`).join('')}${goldWaters.map(g=>`金水${g}号`).join('')}`,
  logicNodes: [],
});

const runVoteTree = (gameState, wolfId, teammates, validTargets = null) => {
  const self = gameState.players.find(p => p.id === wolfId);
  const vt = validTargets ?? gameState.players
    .filter(p => p.isAlive && p.id !== wolfId)
    .map(p => p.id);
  const bb = buildBlackboard(gameState, self, { validTargets: vt });
  return new BehaviorTree(werewolfVoteTree).run(bb);
};

const runSpeechTree = (gameState, wolfId) => {
  const self = gameState.players.find(p => p.id === wolfId);
  const bb = buildBlackboard(gameState, self, {});
  return new BehaviorTree(werewolfSpeechTree).run(bb);
};

// ────────────────────────────────────────────────
// 投票树
// ────────────────────────────────────────────────

describe('werewolfVoteTree', () => {
  it('硬约束：永远不投狼队友', () => {
    // 1号狼，2号是队友，可投目标包含2号
    const state = makeWolfState(1, [2]);
    for (let i = 0; i < 30; i++) {
      const d = runVoteTree(state, 1, [2]);
      expect(d.targetId).not.toBe(2);
    }
  });

  it('有跳预言家 → 优先投预言家', () => {
    const state = makeWolfState(1, [2], {
      speechHistory: [makeSeerSpeech(5, 1, { goldWaters: [3] })],
    });
    const d = runVoteTree(state, 1, [2]);
    // 5 号是跳预言家，且不是队友
    expect(d.targetId).toBe(5);
  });

  it('有金水（无预言家）→ 投金水好人', () => {
    const state = makeWolfState(1, [2], {
      speechHistory: [makeSeerSpeech(5, 1, { kills: [1], goldWaters: [3] })],
    });
    // 狼1号自己被查杀；5号是预言家（优先）
    // 如果排除5号（当队友），则应该投3号金水
    // 不排除：5号是唯一预言家，优先级高于3号金水
    const d = runVoteTree(state, 1, [2]);
    expect([3, 5]).toContain(d.targetId); // 5优先，3次优
  });

  it('无线索 → 随机投非队友目标', () => {
    const state = makeWolfState(1, [2]);
    for (let i = 0; i < 20; i++) {
      const d = runVoteTree(state, 1, [2]);
      expect(d.targetId).not.toBe(2); // 不投队友
      expect(d.targetId).not.toBe(1); // 不投自己
    }
  });

  it('决策延迟 < 10ms', () => {
    const state = makeWolfState(1, [2]);
    const t = performance.now();
    runVoteTree(state, 1, [2]);
    expect(performance.now() - t).toBeLessThan(10);
  });
});

// ────────────────────────────────────────────────
// 发言策略树
// ────────────────────────────────────────────────

describe('werewolfSpeechTree', () => {
  it('始终输出策略对象（不为 null）', () => {
    const state = makeWolfState(1, [2]);
    const d = runSpeechTree(state, 1);
    expect(d).not.toBeNull();
    expect(d.strategy).toBeTruthy();
    expect(Array.isArray(d.facts)).toBe(true);
  });

  it('无人跳预言家时，策略输出为 quiet_villager 或 fake_seer', () => {
    const state = makeWolfState(1, [2]);
    const strategies = new Set();
    for (let i = 0; i < 40; i++) {
      const d = runSpeechTree(state, 1);
      strategies.add(d.strategy);
    }
    // quiet_villager 是兜底，应该一定出现
    expect(strategies.has('quiet_villager')).toBe(true);
    // 所有策略应属于已定义的策略集
    const defined = new Set(['quiet_villager','shadow_teammate','aggressive_lead_vote','fake_seer','counter_seer']);
    strategies.forEach(s => expect(defined.has(s)).toBe(true));
  });

  it('有队友今天已发言 → 优先 shadow_teammate 策略', () => {
    const state = makeWolfState(1, [2], {
      speechHistory: [{
        playerId: 2, day: 1, content: '我觉得5号可疑', voteIntention: 5, logicNodes: []
      }],
    });
    // 跑 30 次，shadow_teammate 应该是主流策略
    let shadowCount = 0;
    for (let i = 0; i < 30; i++) {
      const d = runSpeechTree(state, 1);
      if (d.strategy === 'shadow_teammate') shadowCount++;
    }
    expect(shadowCount).toBeGreaterThanOrEqual(25);
  });

  it('strategy=counter_seer 时 suspectTarget 指向跳预言家', () => {
    // 让 counterSeerRandom 高概率触发：狼队处于劣势
    const state = {
      players: [
        makePlayer(1, '狼人'), // 1号狼
        ...[2,3,4,5,6,7,8].map(id => makePlayer(id, '村民'))
      ],
      speechHistory: [makeSeerSpeech(5, 1, { kills: [1], goldWaters: [3] })],
      voteHistory: [], seerChecks: [], dayCount: 1,
    };
    const counterSeers = [];
    for (let i = 0; i < 50; i++) {
      const d = runSpeechTree(state, 1);
      if (d.strategy === 'counter_seer') counterSeers.push(d);
    }
    // 至少触发几次 counter_seer（80% 概率 × 50次 ≈ 40次，取宽松下界）
    expect(counterSeers.length).toBeGreaterThan(10);
    // 当 counter_seer 触发时，suspectTarget 应为 5 号（跳预言家）
    counterSeers.forEach(d => expect(d.suspectTarget).toBe(5));
  });

  it('facts 数组非空', () => {
    const state = makeWolfState(1, [2]);
    const d = runSpeechTree(state, 1);
    expect(d.facts.length).toBeGreaterThan(0);
  });

  it('决策延迟 < 10ms', () => {
    const state = makeWolfState(1, [2]);
    const t = performance.now();
    runSpeechTree(state, 1);
    expect(performance.now() - t).toBeLessThan(10);
  });
});
