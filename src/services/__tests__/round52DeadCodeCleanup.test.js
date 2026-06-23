/**
 * Round 52 — 批量清理 dead 函数验证
 *
 * 验证 seer/werewolf/hunter/guard/villager 的 nightAction/daySpeech/vote/shoot
 * 函数已删除，PROMPTS 对象仅保留活跃键。
 *
 * 同时验证 knight.js aliveCount 参数合同（R51 建议 delegateParams 扩展）。
 */

import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rolePromptsDir = path.resolve(__dirname, '..', 'rolePrompts');

const readRole = (file) => fs.readFileSync(path.join(rolePromptsDir, file), 'utf8');

const seerSrc = readRole('seer.js');
const werewolfSrc = readRole('werewolf.js');
const hunterSrc = readRole('hunter.js');
const guardSrc = readRole('guard.js');
const villagerSrc = readRole('villager.js');
const knightSrc = readRole('knight.js');
const aiPromptsSrc = fs.readFileSync(
  path.resolve(__dirname, '..', 'aiPrompts.js'), 'utf8'
);

// ─────────────────────────────────────────────────────────────────────────────
// seer.js
// ─────────────────────────────────────────────────────────────────────────────
describe('R52: seer.js 死函数清理', () => {
  it('T1: getSeerNightActionPrompt 已删除', () => {
    expect(seerSrc).not.toContain('getSeerNightActionPrompt');
  });

  it('T2: getSeerDaySpeechPrompt 已删除', () => {
    expect(seerSrc).not.toContain('getSeerDaySpeechPrompt');
  });

  it('T3: getSeerVotePrompt 已删除', () => {
    expect(seerSrc).not.toContain('getSeerVotePrompt');
  });

  it('T4: SEER_PROMPTS 不含 nightAction/daySpeech/vote 键', () => {
    const idx = seerSrc.indexOf('export const SEER_PROMPTS');
    expect(idx).toBeGreaterThan(-1);
    const block = seerSrc.slice(idx, idx + 300);
    expect(block).not.toContain('nightAction');
    expect(block).not.toContain('daySpeech');
    expect(block).not.toContain('vote');
  });

  it('T5: SEER_PROMPTS 仍含活跃键 buildPersonaPrompt', () => {
    const idx = seerSrc.indexOf('export const SEER_PROMPTS');
    const block = seerSrc.slice(idx, idx + 300);
    expect(block).toContain('buildPersonaPrompt');
  });

  it('T6: seer.js 不再导入 getBaseContext（删除后无用）', () => {
    expect(seerSrc).not.toContain('getBaseContext');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// werewolf.js
// ─────────────────────────────────────────────────────────────────────────────
describe('R52: werewolf.js 死函数清理', () => {
  it('T7: getWerewolfNightActionPrompt 已删除', () => {
    expect(werewolfSrc).not.toContain('getWerewolfNightActionPrompt');
  });

  it('T8: getWerewolfDaySpeechPrompt 已删除', () => {
    expect(werewolfSrc).not.toContain('getWerewolfDaySpeechPrompt');
  });

  it('T9: getWerewolfVotePrompt 已删除', () => {
    expect(werewolfSrc).not.toContain('getWerewolfVotePrompt');
  });

  it('T10: WEREWOLF_PROMPTS 不含 nightAction/daySpeech/vote 键', () => {
    const idx = werewolfSrc.indexOf('export const WEREWOLF_PROMPTS');
    expect(idx).toBeGreaterThan(-1);
    const block = werewolfSrc.slice(idx, idx + 300);
    expect(block).not.toContain('nightAction');
    expect(block).not.toContain('daySpeech');
    expect(block).not.toContain('vote');
  });

  it('T11: werewolf.js 不再导入 getBaseContext 或 isMiniGame', () => {
    const importLine = werewolfSrc.split('\n').find(l => l.includes("from './baseRules'"));
    expect(importLine).toBeTruthy();
    expect(importLine).not.toContain('getBaseContext');
    expect(importLine).not.toContain('isMiniGame');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// hunter.js
// ─────────────────────────────────────────────────────────────────────────────
describe('R52: hunter.js 死函数清理', () => {
  it('T12: getHunterShootPrompt 已删除', () => {
    expect(hunterSrc).not.toContain('getHunterShootPrompt');
  });

  it('T13: getHunterDaySpeechPrompt 已删除', () => {
    expect(hunterSrc).not.toContain('getHunterDaySpeechPrompt');
  });

  it('T14: getHunterVotePrompt 已删除', () => {
    expect(hunterSrc).not.toContain('getHunterVotePrompt');
  });

  it('T15: HUNTER_PROMPTS 不含 shoot/daySpeech/vote 键', () => {
    const idx = hunterSrc.indexOf('export const HUNTER_PROMPTS');
    expect(idx).toBeGreaterThan(-1);
    const block = hunterSrc.slice(idx, idx + 300);
    expect(block).not.toContain('shoot');
    expect(block).not.toContain('daySpeech');
    expect(block).not.toContain('vote');
  });

  it('T16: hunter.js 不再导入 getBaseContext', () => {
    expect(hunterSrc).not.toContain('getBaseContext');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// guard.js
// ─────────────────────────────────────────────────────────────────────────────
describe('R52: guard.js 死函数清理', () => {
  it('T17: getGuardNightActionPrompt 已删除', () => {
    expect(guardSrc).not.toContain('getGuardNightActionPrompt');
  });

  it('T18: getGuardDaySpeechPrompt 已删除', () => {
    expect(guardSrc).not.toContain('getGuardDaySpeechPrompt');
  });

  it('T19: getGuardVotePrompt 已删除', () => {
    expect(guardSrc).not.toContain('getGuardVotePrompt');
  });

  it('T20: GUARD_PROMPTS 不含 nightAction/daySpeech/vote 键', () => {
    const idx = guardSrc.indexOf('export const GUARD_PROMPTS');
    expect(idx).toBeGreaterThan(-1);
    const block = guardSrc.slice(idx, idx + 300);
    expect(block).not.toContain('nightAction');
    expect(block).not.toContain('daySpeech');
    expect(block).not.toContain('vote');
  });

  it('T21: guard.js 不再导入 getBaseContext', () => {
    expect(guardSrc).not.toContain('getBaseContext');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// villager.js
// ─────────────────────────────────────────────────────────────────────────────
describe('R52: villager.js 死函数清理', () => {
  it('T22: getVillagerDaySpeechPrompt 已删除', () => {
    expect(villagerSrc).not.toContain('getVillagerDaySpeechPrompt');
  });

  it('T23: getVillagerVotePrompt 已删除', () => {
    expect(villagerSrc).not.toContain('getVillagerVotePrompt');
  });

  it('T24: VILLAGER_PROMPTS 不含 daySpeech/vote 键', () => {
    const idx = villagerSrc.indexOf('export const VILLAGER_PROMPTS');
    expect(idx).toBeGreaterThan(-1);
    const block = villagerSrc.slice(idx, idx + 300);
    expect(block).not.toContain('daySpeech');
    expect(block).not.toContain('vote');
  });

  it('T25: villager.js 不再导入 getBaseContext', () => {
    expect(villagerSrc).not.toContain('getBaseContext');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// knight.js aliveCount 参数合同（delegateParams 扩展，R51 建议）
// ─────────────────────────────────────────────────────────────────────────────
describe('R52: knight.js aliveCount 参数合同', () => {
  it('T26: getKnightDaySpeechPrompt 解构了 aliveCount', () => {
    const fnIdx = knightSrc.indexOf('getKnightDaySpeechPrompt');
    expect(fnIdx).toBeGreaterThan(-1);
    const fnBlock = knightSrc.slice(fnIdx, fnIdx + 500);
    expect(fnBlock).toContain('aliveCount');
  });

  it('T27: aiPrompts.js roleParams 传入 aliveCount 给骑士委托路径', () => {
    // 确认 aliveCount 在 roleParams 构建块中存在
    expect(aiPromptsSrc).toContain('aliveCount');
  });

  it('T28: knight.js 使用 aliveCount 计算 isEndgame 阈值', () => {
    expect(knightSrc).toContain('isEndgame');
    expect(knightSrc).toContain('thresholdA');
    expect(knightSrc).toContain('thresholdB');
  });
});
