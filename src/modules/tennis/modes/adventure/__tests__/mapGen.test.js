import { describe, it, expect } from 'vitest';
import { generateMap, NODE_TYPES } from '../mapGen';

const rngSeq = (vals) => {
  let i = 0;
  return () => vals[i++ % vals.length];
};

describe('generateMap（spec §4.2）', () => {
  it('三章，每章 4-5 步，每步 1-2 个节点选项', () => {
    const map = generateMap(rngSeq([0.1, 0.5, 0.9, 0.3, 0.7]));
    expect(map.chapters).toHaveLength(3);
    for (const ch of map.chapters) {
      expect(ch.steps.length).toBeGreaterThanOrEqual(4);
      expect(ch.steps.length).toBeLessThanOrEqual(5);
      for (const step of ch.steps) {
        expect(step.length).toBeGreaterThanOrEqual(1);
        expect(step.length).toBeLessThanOrEqual(2);
        for (const node of step) {
          expect(NODE_TYPES).toContain(node.type);
        }
      }
    }
  });

  it('每章末步固定单一精英战；第三章末为 BOSS', () => {
    const map = generateMap(rngSeq([0.2, 0.6, 0.4]));
    const elites = ['外卖小哥', '修仙童子', '网球之神'];
    map.chapters.forEach((ch, i) => {
      const last = ch.steps[ch.steps.length - 1];
      expect(last).toHaveLength(1);
      expect(last[0].type).toBe('battle');
      expect(last[0].opponentId).toBe(elites[i]);
      expect(last[0].elite).toBe(true);
    });
    expect(map.chapters[2].steps.at(-1)[0].boss).toBe(true);
  });

  it('对战节点带本章常规对手；任意 seed 都能走到 BOSS（线性步进+必有选项）', () => {
    for (const seed of [0.01, 0.33, 0.66, 0.99]) {
      const map = generateMap(rngSeq([seed, seed * 0.7, seed * 0.3]));
      let reachable = true;
      for (const ch of map.chapters) {
        for (const step of ch.steps) {
          if (step.length === 0) reachable = false;
        }
      }
      expect(reachable).toBe(true);
    }
  });

  it('章节主题文案齐备', () => {
    const map = generateMap(rngSeq([0.5]));
    expect(map.chapters.map((c) => c.title)).toEqual([
      '第一章 · 菜市场江湖', '第二章 · 修仙界', '第三章 · 太空站',
    ]);
  });
});
