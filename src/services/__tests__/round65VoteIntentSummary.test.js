/**
 * Round 65: DAY_VOTE 本轮发言票型摘要 + 狼人防守局面感知信号
 *
 * 解决感知-执行分裂：
 *   - 执行路径已有"防守局面"场景，但 DAY_VOTE 不包含今日发言 speeches，
 *     wolf AI 无法从上下文感知队友是否遭到多数追杀。
 *   - 修复：从 speechHistory.voteIntention 提取结构化票型，
 *     供所有玩家查看（thisRoundVoteHint），并为狼人计算防守触发信号（wolfDefenseTrigger）。
 */
import { readFileSync } from 'fs';
import { describe, it, expect } from 'vitest';
import { resolve } from 'path';

const aiPromptsPath = resolve(process.cwd(), 'src/services/aiPrompts.js');
const src = readFileSync(aiPromptsPath, 'utf-8');

// 定位 DAY_VOTE case 块（精确到 HUNTER_SHOOT，不含后续 case）
const dayVoteStart = src.indexOf('case PROMPT_ACTIONS.DAY_VOTE: {');
const dayVoteEnd = src.indexOf('case PROMPT_ACTIONS.HUNTER_SHOOT:', dayVoteStart);
const dayVoteBlock = src.slice(dayVoteStart, dayVoteEnd);

describe('Round 65: 本轮发言票型摘要变量（thisRoundVoteHint）', () => {
  it('T1: DAY_VOTE 块中存在 todayIntentionsList 过滤逻辑（按 day + voteIntention 过滤）', () => {
    expect(dayVoteBlock).toContain('todayIntentionsList');
    expect(dayVoteBlock).toContain('voteIntention');
  });

  it('T2: DAY_VOTE 块中存在 thisRoundTally 计票对象', () => {
    expect(dayVoteBlock).toContain('thisRoundTally');
  });

  it('T3: thisRoundVoteHint 变量在 DAY_VOTE 块中定义', () => {
    expect(dayVoteBlock).toContain('thisRoundVoteHint');
  });

  it('T4: thisRoundVoteHint 包含"本轮发言票型"标识文本', () => {
    expect(dayVoteBlock).toContain('本轮发言票型');
  });

  it('T5: thisRoundVoteHint 注入到 return 模板（在 voteMomentumHint 之后）', () => {
    const returnIdx = dayVoteBlock.lastIndexOf('return `');
    const returnBlock = dayVoteBlock.slice(returnIdx, returnIdx + 800);
    expect(returnBlock).toContain('${thisRoundVoteHint}');
    // 确保位置在 voteMomentumHint 之后
    const momentumIdx = returnBlock.indexOf('${voteMomentumHint}');
    const thisRoundIdx = returnBlock.indexOf('${thisRoundVoteHint}');
    expect(momentumIdx).toBeGreaterThanOrEqual(0);
    expect(thisRoundIdx).toBeGreaterThanOrEqual(0);
    expect(thisRoundIdx).toBeGreaterThan(momentumIdx);
  });

  it('T6: 排序逻辑按票意向数降序（高票靠前）', () => {
    expect(dayVoteBlock).toContain('sortedThisRoundTally');
    expect(dayVoteBlock).toContain('b[1] - a[1]');
  });
});

describe('Round 65: 狼人防守局面感知信号（wolfDefenseTrigger）', () => {
  it('T7: wolfDefenseTrigger 变量在 DAY_VOTE 块中定义', () => {
    expect(dayVoteBlock).toContain('wolfDefenseTrigger');
  });

  it('T8: 防守触发使用 Math.ceil(totalExpressed / 2) 严格多数阈值', () => {
    expect(dayVoteBlock).toContain('Math.ceil(totalExpressed / 2)');
  });

  it('T9: 触发信号包含"防守局面已触发"文本', () => {
    expect(dayVoteBlock).toContain('防守局面已触发');
  });

  it('T10: 非多数情况输出"局势预警"（轻量提示）', () => {
    expect(dayVoteBlock).toContain('局势预警');
  });

  it('T11: wolfDefenseTrigger 仅在 playerRole === 狼人 时计算', () => {
    expect(dayVoteBlock).toContain("playerRole === '狼人'");
    // 防守触发逻辑在 wolfDefenseTrigger 赋值块中
    const defenseTriggerStart = dayVoteBlock.indexOf('wolfDefenseTrigger =');
    expect(defenseTriggerStart).toBeGreaterThanOrEqual(0);
  });

  it('T12: wolfDefenseTrigger 注入到狼人投票框架（a) 刀口对齐之后）', () => {
    const returnIdx = dayVoteBlock.lastIndexOf('return `');
    const wolfSectionIdx = dayVoteBlock.indexOf('狼人投票博弈框架', returnIdx);
    const knifeAlignIdx = dayVoteBlock.indexOf('刀口对齐', wolfSectionIdx);
    const triggerInjectIdx = dayVoteBlock.indexOf('wolfDefenseTrigger}', wolfSectionIdx);
    expect(wolfSectionIdx).toBeGreaterThanOrEqual(0);
    expect(knifeAlignIdx).toBeGreaterThanOrEqual(0);
    expect(triggerInjectIdx).toBeGreaterThanOrEqual(0);
    // 触发信号注入在刀口对齐之后（a 步骤末尾，b 步骤之前）
    expect(triggerInjectIdx).toBeGreaterThan(knifeAlignIdx);
  });

  it('T13: 触发信号告知 wolf 队友编号（interpolation 含 teammateUnderFire）', () => {
    expect(dayVoteBlock).toContain('teammateUnderFire');
  });
});

describe('Round 65: 干跑（dry-run）—— 票意向计票逻辑验证', () => {
  /**
   * 模拟 speechHistory 中的 voteIntention 字段，
   * 复现 DAY_VOTE 块中的计票逻辑（同构逻辑提取到辅助函数测试）
   */
  const computeVoteTally = (speechHistory, voteDay, currentPlayerId) => {
    const todayIntentionsList = speechHistory.filter(s =>
      s.day === voteDay &&
      s.voteIntention !== undefined && s.voteIntention !== null && s.voteIntention !== -1 &&
      s.playerId !== currentPlayerId
    );
    const thisRoundTally = {};
    todayIntentionsList.forEach(s => {
      const target = Number(s.voteIntention);
      if (!isNaN(target) && target !== -1) {
        thisRoundTally[target] = (thisRoundTally[target] || 0) + 1;
      }
    });
    return { todayIntentionsList, thisRoundTally };
  };

  const detectWolfDefense = (thisRoundTally, todayIntentionsList, wolfTeammateIds) => {
    if (wolfTeammateIds.length === 0 || todayIntentionsList.length === 0) return null;
    const totalExpressed = todayIntentionsList.length;
    const teammateUnderFire = wolfTeammateIds.find(id =>
      (thisRoundTally[id] || 0) >= Math.ceil(totalExpressed / 2)
    );
    return teammateUnderFire ?? null;
  };

  const mockSpeechHistory = [
    { day: 2, playerId: 1, voteIntention: 3 },
    { day: 2, playerId: 3, voteIntention: 5 },  // wolf teammate (3) has their own intention
    { day: 2, playerId: 4, voteIntention: 3 },
    { day: 2, playerId: 5, voteIntention: 3 },
    { day: 2, playerId: 6, voteIntention: 3 },
    { day: 1, playerId: 1, voteIntention: 4 },  // prior day, should be ignored
  ];

  it('T14: 只统计当天（day=2）且排除当前玩家的发言', () => {
    const { todayIntentionsList } = computeVoteTally(mockSpeechHistory, 2, 2);
    // day=2 有6条，但 playerId=3 和 day=1 的排除后剩 5 条
    // currentPlayerId=2 不存在于 mockSpeechHistory，过滤后仍 5 条（day=2 非 p2）
    expect(todayIntentionsList.length).toBe(5);
  });

  it('T15: 票意向计票正确（3号收到4票，5号收到1票）', () => {
    const { thisRoundTally } = computeVoteTally(mockSpeechHistory, 2, 2);
    expect(thisRoundTally[3]).toBe(4);
    expect(thisRoundTally[5]).toBe(1);
  });

  it('T16: 防守局面检测——3号为队友时触发（4/5 >= ceil(5/2)=3）', () => {
    const { todayIntentionsList, thisRoundTally } = computeVoteTally(mockSpeechHistory, 2, 2);
    const triggered = detectWolfDefense(thisRoundTally, todayIntentionsList, [3]);
    expect(triggered).toBe(3);
  });

  it('T17: 防守局面不触发——5号为队友时（1/5 < 3）', () => {
    const { todayIntentionsList, thisRoundTally } = computeVoteTally(mockSpeechHistory, 2, 2);
    const triggered = detectWolfDefense(thisRoundTally, todayIntentionsList, [5]);
    expect(triggered).toBeNull();
  });

  it('T18: 恰好多数（3/5 == ceil(5/2)=3）正好触发', () => {
    const historyExact = [
      { day: 2, playerId: 1, voteIntention: 7 },
      { day: 2, playerId: 4, voteIntention: 7 },
      { day: 2, playerId: 5, voteIntention: 7 },
      { day: 2, playerId: 6, voteIntention: 3 },
      { day: 2, playerId: 8, voteIntention: 3 },
    ];
    const { todayIntentionsList, thisRoundTally } = computeVoteTally(historyExact, 2, 2);
    const triggered = detectWolfDefense(thisRoundTally, todayIntentionsList, [7]);
    expect(triggered).toBe(7);
  });

  it('T19: 恰好少于多数（2/5 < 3）不触发', () => {
    const historyBelow = [
      { day: 2, playerId: 1, voteIntention: 7 },
      { day: 2, playerId: 4, voteIntention: 7 },
      { day: 2, playerId: 5, voteIntention: 3 },
      { day: 2, playerId: 6, voteIntention: 3 },
      { day: 2, playerId: 8, voteIntention: 3 },
    ];
    const { todayIntentionsList, thisRoundTally } = computeVoteTally(historyBelow, 2, 2);
    const triggered = detectWolfDefense(thisRoundTally, todayIntentionsList, [7]);
    expect(triggered).toBeNull();
  });

  it('T20: 空发言历史时不触发防守', () => {
    const { todayIntentionsList, thisRoundTally } = computeVoteTally([], 2, 2);
    const triggered = detectWolfDefense(thisRoundTally, todayIntentionsList, [3]);
    expect(triggered).toBeNull();
  });

  it('T21: 弃票（voteIntention=-1）不计入票型统计', () => {
    const historyWithAbstain = [
      { day: 2, playerId: 1, voteIntention: -1 },
      { day: 2, playerId: 4, voteIntention: -1 },
      { day: 2, playerId: 5, voteIntention: 3 },
    ];
    const { todayIntentionsList, thisRoundTally } = computeVoteTally(historyWithAbstain, 2, 2);
    // 弃票被过滤，只有 1 条有效
    expect(todayIntentionsList.length).toBe(1);
    expect(thisRoundTally[3]).toBe(1);
    expect(thisRoundTally[-1]).toBeUndefined();
  });
});
