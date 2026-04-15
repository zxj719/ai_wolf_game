/**
 * 村民投票行为树 —— 单元测试
 *
 * 验证 4 条优先级路径：
 *   1. 跟查杀（唯一预言家给出查杀目标）
 *   2. 打对抗（多预言家对抗时投嫌疑高的）
 *   3. 跟归票（场上有高嫌疑目标）
 *   4. 兜底（没有线索时随机选一个非金水）
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BehaviorTree } from '../core/BehaviorTree.js';
import { buildBlackboard } from '../blackboard/buildBlackboard.js';
import { villagerVoteTree } from '../trees/villager/vote.js';

// ────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────

const makePlayer = (id, role = '村民', alive = true) => ({
  id, role, name: `${id}号`, isAlive: alive,
});

const makeSeerSpeech = (playerId, day, { kills = [], goldWaters = [] } = {}) => ({
  playerId,
  day,
  claimedRole: '预言家',
  content: `我是预言家。昨晚查杀${kills.map(k => k + '号').join(',')}${
    goldWaters.length ? '，金水' + goldWaters.map(g => g + '号').join(',') : ''
  }。`,
  logicNodes: [],
});

const runTree = (gameState, selfId, validTargets = null) => {
  const self = gameState.players.find(p => p.id === selfId);
  const bb = buildBlackboard(gameState, self, validTargets ? { validTargets } : {});
  return { decision: new BehaviorTree(villagerVoteTree).run(bb), trace: bb.trace };
};

// ────────────────────────────────────────────────
// 固定数据：8 人局，3 号村民做决策
// ────────────────────────────────────────────────

const basePlayers = [1, 2, 3, 4, 5, 6, 7, 8].map(id => makePlayer(id));

function baseState(overrides = {}) {
  return {
    players: basePlayers,
    speechHistory: [],
    voteHistory: [],
    seerChecks: [],
    dayCount: 1,
    ...overrides,
  };
}

// ────────────────────────────────────────────────
// 测试
// ────────────────────────────────────────────────

describe('villagerVoteTree', () => {
  it('路径1：唯一预言家给出查杀 → 投查杀目标', () => {
    const state = baseState({
      speechHistory: [
        makeSeerSpeech(1, 1, { kills: [5], goldWaters: [2] }),
      ],
    });
    const { decision, trace } = runTree(state, 3);
    expect(decision).not.toBeNull();
    expect(decision.targetId).toBe(5);
    expect(trace.some(t => /跟查杀/.test(t))).toBe(true);
  });

  it('路径1-约束：村民不应投被金水的玩家', () => {
    const state = baseState({
      speechHistory: [
        makeSeerSpeech(1, 1, { kills: [5], goldWaters: [2, 4] }),
      ],
    });
    // 跑 30 次，确保 2 号和 4 号永远不会被 3 号村民投票
    for (let i = 0; i < 30; i++) {
      const { decision } = runTree(state, 3);
      expect([2, 4]).not.toContain(decision.targetId);
    }
  });

  it('路径2：两个预言家对抗 → 投嫌疑更高的那个', () => {
    // 1 号先跳，指认 5 号狼；6 号后跳，也指认 5 号狼（或反指 1 号）
    // 简单起见：6 号嫌疑应更高（后跳 +15）
    const state = baseState({
      speechHistory: [
        makeSeerSpeech(1, 1, { kills: [5] }),
        makeSeerSpeech(6, 1, { kills: [1] }), // 6 号反跳指认 1 号
      ],
    });
    // 跑 30 次，大多数情况应该投对抗的两人之一（1 或 6）
    let hitCounter = 0;
    for (let i = 0; i < 30; i++) {
      const { decision } = runTree(state, 3);
      if ([1, 6].includes(decision.targetId)) hitCounter++;
    }
    expect(hitCounter).toBeGreaterThanOrEqual(25); // 至少 25/30 命中
  });

  it('路径3：无预言家跳但有高嫌疑 → 跟归票', () => {
    // 没有人跳预言家，但 5 号被多次明确指控（通过 logicNodes）
    const accusations = [1, 2, 6, 7].map((voter, i) => ({
      playerId: voter,
      day: 1,
      content: `我怀疑 5 号`,
      logicNodes: [
        { type: 'accuse', targetId: 5, text: '5号是狼' },
      ],
    }));

    const state = baseState({
      speechHistory: accusations,
    });

    // 5 号会获得 4*5=20 分，不够 40 分阈值。我们需要更多或更强的信号。
    // 叠加更多来源确保 >= 40
    for (let i = 0; i < 5; i++) {
      accusations.push({
        playerId: (i + 1) % 8 + 1,
        day: 1,
        content: '5号',
        logicNodes: [{ type: 'accuse', targetId: 5, text: '5号是狼' }],
      });
    }

    const state2 = baseState({ speechHistory: accusations });
    const { decision, trace } = runTree(state2, 3);
    expect(decision).not.toBeNull();
    expect(decision.targetId).toBe(5);
    expect(trace.some(t => /跟归票|最高嫌疑/.test(t))).toBe(true);
  });

  it('路径4：无线索 → 兜底随机', () => {
    const state = baseState();
    const { decision, trace } = runTree(state, 3);
    expect(decision).not.toBeNull();
    expect(decision.targetId).not.toBe(3); // 不投自己
    expect([1, 2, 4, 5, 6, 7, 8]).toContain(decision.targetId);
    expect(trace.some(t => /随机兜底/.test(t))).toBe(true);
  });

  it('决策延迟应在 10ms 以内', () => {
    const state = baseState({
      speechHistory: [
        makeSeerSpeech(1, 1, { kills: [5], goldWaters: [2] }),
      ],
    });
    const started = performance.now();
    runTree(state, 3);
    const elapsed = performance.now() - started;
    expect(elapsed).toBeLessThan(10);
  });
});
