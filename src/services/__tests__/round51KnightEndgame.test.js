/**
 * R51: 骑士终局决斗阈值动态化测试
 * 验证 getKnightDaySpeechPrompt 正确消费 aliveCount 参数
 */

import { readFileSync } from 'fs';
import path from 'path';

const knightSrc = readFileSync(
  path.resolve('src/services/rolePrompts/knight.js'),
  'utf8'
);

const { getKnightDaySpeechPrompt } = await import('../rolePrompts/knight.js');

const makeCtx = () => ({
  dayCount: 1,
  players: [],
  speeches: [],
  deadPlayers: [],
  lastNightDeaths: [],
  seerChecks: [],
  existingRoles: {},
  gameSetup: {},
  currentPlayer: { id: 1, name: '测试骑士', personality: { traits: '理性' } },
});

const makeParams = (aliveCount, hasUsedDuel = false) => ({ hasUsedDuel, aliveCount });

describe('R51: 骑士终局决斗阈值动态化', () => {
  test('T1: getKnightDaySpeechPrompt 解构了 aliveCount', () => {
    // Anchor-point extraction: find 'const {' before '} = params'
    const endIdx = knightSrc.indexOf('} = params');
    expect(endIdx).toBeGreaterThan(-1);
    const startIdx = knightSrc.lastIndexOf('const {', endIdx);
    const destructureBlock = knightSrc.slice(startIdx, endIdx);
    expect(destructureBlock).toContain('aliveCount');
  });

  test('T2: 非残局（aliveCount=8）阈值为 70% / 60%', () => {
    const prompt = getKnightDaySpeechPrompt(makeCtx(), makeParams(8));
    expect(prompt).toContain('≥ 70%');
    expect(prompt).toContain('≥ 60%');
  });

  test('T3: 残局（aliveCount=5）阈值下调至 50% / 40%', () => {
    const prompt = getKnightDaySpeechPrompt(makeCtx(), makeParams(5));
    expect(prompt).toContain('≥ 50%');
    expect(prompt).toContain('≥ 40%');
  });

  test('T4: 残局提示词包含"残局模式"注记', () => {
    const prompt = getKnightDaySpeechPrompt(makeCtx(), makeParams(4));
    expect(prompt).toContain('残局模式');
    expect(prompt).toContain('存活4人');
  });

  test('T5: 非残局提示词不含"残局模式"注记', () => {
    const prompt = getKnightDaySpeechPrompt(makeCtx(), makeParams(6));
    expect(prompt).not.toContain('残局模式');
  });

  test('T6: aliveCount 缺省值（不传参）视为非残局', () => {
    const prompt = getKnightDaySpeechPrompt(makeCtx(), { hasUsedDuel: false });
    expect(prompt).toContain('≥ 70%');
    expect(prompt).not.toContain('残局模式');
  });

  test('T7: 恰好临界值 aliveCount=5 触发残局', () => {
    const prompt = getKnightDaySpeechPrompt(makeCtx(), makeParams(5));
    expect(prompt).toContain('残局模式');
  });

  test('T8: aliveCount=6 不触发残局', () => {
    const prompt = getKnightDaySpeechPrompt(makeCtx(), makeParams(6));
    expect(prompt).not.toContain('残局模式');
    expect(prompt).toContain('≥ 70%');
  });
});
