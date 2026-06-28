import { describe, it, expect } from 'vitest';
import { EVENTS, pickEvent, rewardTier, REWARD_KINDS } from '../events';
import { MOVES } from '../../../battle/moves';

describe('事件表（spec §4.4 + §7b）', () => {
  it('12 个小游戏事件（8 微操 + 4 坚持/刷分）+ 12 个剧情事件，三章都有内容', () => {
    expect(EVENTS.filter((e) => e.type === 'minigame')).toHaveLength(12);
    expect(EVENTS.filter((e) => e.type === 'story')).toHaveLength(12);
    for (const ch of [1, 2, 3]) {
      expect(EVENTS.some((e) => e.chapter === ch)).toBe(true);
    }
  });

  it('小游戏事件引用的 minigame key 均在注册表内（含坚持/刷分类）', () => {
    const validKeys = new Set([
      ...Object.values(MOVES).map((m) => m.minigame),
      'flappy', 'dodge', 'goldMiner', 'jumpJump',
    ]);
    for (const e of EVENTS.filter((x) => x.type === 'minigame')) {
      expect(validKeys.has(e.minigame)).toBe(true);
      expect(e.rewards).toHaveLength(3);
    }
  });

  it('所有奖励 kind 合法（圆回网球：属性/金币/卡/装备/体力上限/回体）', () => {
    const allRewards = EVENTS.flatMap((e) =>
      e.type === 'minigame' ? e.rewards : e.options.map((o) => o.reward));
    for (const r of allRewards) {
      expect(REWARD_KINDS).toContain(r.kind);
    }
  });

  it('rewardTier 阈值：<0.8→0，<1.2→1，≥1.2→2', () => {
    expect(rewardTier(0.5)).toBe(0);
    expect(rewardTier(0.79)).toBe(0);
    expect(rewardTier(0.8)).toBe(1);
    expect(rewardTier(1.19)).toBe(1);
    expect(rewardTier(1.2)).toBe(2);
    expect(rewardTier(1.5)).toBe(2);
  });

  it('pickEvent 从对应章节池取且确定性', () => {
    const e1 = pickEvent(1, 0);
    expect(e1.chapter).toBe(1);
    expect(pickEvent(1, 0)).toBe(e1);
    expect(pickEvent(3, 0.99).chapter).toBe(3);
  });
});
