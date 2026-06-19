/**
 * Round 20 Tests: 魔术师 shouldReveal 修复 + 骑士机制回顾
 * T1-T6: magician.js hasRevealed 分支验证
 * T7-T10: useSpeechFlow.js shouldReveal 消费代码验证
 * T11-T13: useWerewolfGame.js hasRevealed 初始状态验证
 * T14-T15: aiPrompts.js hasRevealed 传参验证
 * T16-T19: 骑士机制现状审计（确认正常）
 * T20-T23: 回归（R19 格式示例）
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const magicianSrc = readFileSync(path.join(root, 'src/services/rolePrompts/magician.js'), 'utf-8');
const speechFlowSrc = readFileSync(path.join(root, 'src/hooks/useSpeechFlow.js'), 'utf-8');
const gameReducerSrc = readFileSync(path.join(root, 'src/useWerewolfGame.js'), 'utf-8');
const aiPromptsSrc = readFileSync(path.join(root, 'src/services/aiPrompts.js'), 'utf-8');
const knightSrc = readFileSync(path.join(root, 'src/services/rolePrompts/knight.js'), 'utf-8');

let passed = 0;
let failed = 0;

function test(label, fn) {
  try {
    fn();
    console.log(`  ✅ ${label}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${label}: ${e.message}`);
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

// ─── magician.js hasRevealed 分支验证 ──────────────────────────────
console.log('\n[T1-T6] magician.js hasRevealed 分支验证');

test('T1: getMagicianDaySpeechPrompt 解构了 hasRevealed', () => {
  assert(magicianSrc.includes('hasRevealed } = params'), 'hasRevealed not destructured from params');
});

test('T2: hasRevealed=true 时显示"身份已公开"状态', () => {
  assert(magicianSrc.includes('身份已公开'), '缺少身份已公开文字');
});

test('T3: hasRevealed 用于三元表达式控制阶段提示', () => {
  // 应该有 hasRevealed ? ... : ... 的条件分支
  assert(magicianSrc.includes('hasRevealed ?'), '缺少 hasRevealed ? 三元分支');
});

test('T4: hasRevealed=true 时显示"阶段1/2 已完成"', () => {
  assert(magicianSrc.includes('阶段1/2 已完成'), '缺少阶段1/2 已完成提示');
});

test('T5: hasRevealed=true 时跳过"是否跳身份判断"章节（用 hasRevealed ? 控制）', () => {
  // 通过 ${hasRevealed ? '' : `...跳身份判断...`} 来控制
  assert(magicianSrc.includes("hasRevealed ? '' : "), '缺少 hasRevealed 控制的跳身份判断章节');
});

test('T6: shouldReveal 仍然在输出 JSON schema 中', () => {
  assert(magicianSrc.includes('"shouldReveal":true/false'), '输出JSON schema中缺少shouldReveal字段');
});

// ─── useSpeechFlow.js shouldReveal 消费代码验证 ────────────────────
console.log('\n[T7-T10] useSpeechFlow.js shouldReveal 消费验证');

test('T7: shouldReveal 被消费（存在 res.shouldReveal 检查）', () => {
  assert(speechFlowSrc.includes('res.shouldReveal'), 'useSpeechFlow.js 未消费 res.shouldReveal');
});

test('T8: 消费代码检查 ROLE_DEFINITIONS.MAGICIAN', () => {
  assert(speechFlowSrc.includes("ROLE_DEFINITIONS.MAGICIAN && res.shouldReveal"), '缺少 MAGICIAN && shouldReveal 联合检查');
});

test('T9: 消费代码防止重复标记（!currentSpeaker.hasRevealed 防护）', () => {
  assert(speechFlowSrc.includes('!currentSpeaker.hasRevealed'), '缺少幂等防护 !currentSpeaker.hasRevealed');
});

test('T10: 消费代码通过 setPlayers 更新 hasRevealed: true', () => {
  assert(speechFlowSrc.includes('hasRevealed: true'), 'setPlayers 更新中缺少 hasRevealed: true');
});

// ─── useWerewolfGame.js 初始状态验证 ──────────────────────────────
console.log('\n[T11-T13] useWerewolfGame.js 初始状态验证');

test('T11: 初始 players 包含 hasRevealed: false', () => {
  assert(gameReducerSrc.includes('hasRevealed: false'), '初始状态缺少 hasRevealed: false');
});

test('T12: hasRevealed 与 hasUsedDuel 在同一区域声明', () => {
  const duelIdx = gameReducerSrc.indexOf('hasUsedDuel: false');
  const revealIdx = gameReducerSrc.indexOf('hasRevealed: false');
  assert(duelIdx !== -1, 'hasUsedDuel: false 不存在');
  assert(revealIdx !== -1, 'hasRevealed: false 不存在');
  assert(Math.abs(revealIdx - duelIdx) < 200, 'hasRevealed 与 hasUsedDuel 距离过远');
});

test('T13: 注释说明 hasRevealed 用途', () => {
  assert(gameReducerSrc.includes('魔术师跳身份标记'), '缺少 hasRevealed 用途注释');
});

// ─── aiPrompts.js 传参验证 ────────────────────────────────────────
console.log('\n[T14-T15] aiPrompts.js roleParams 传参验证');

test('T14: roleParams 中包含 hasRevealed 传参', () => {
  assert(aiPromptsSrc.includes('hasRevealed: currentPlayer?.hasRevealed'), '缺少 hasRevealed 传参');
});

test('T15: hasRevealed 在 hasUsedDuel 附近传参', () => {
  const duelIdx = aiPromptsSrc.indexOf('hasUsedDuel: currentPlayer?.hasUsedDuel');
  const revealIdx = aiPromptsSrc.indexOf('hasRevealed: currentPlayer?.hasRevealed');
  assert(duelIdx !== -1, '缺少 hasUsedDuel 传参');
  assert(revealIdx !== -1, '缺少 hasRevealed 传参');
  assert(Math.abs(revealIdx - duelIdx) < 300, 'hasRevealed 传参距离 hasUsedDuel 过远');
});

// ─── 骑士机制现状审计 ─────────────────────────────────────────────
console.log('\n[T16-T19] 骑士机制现状审计（确认正常）');

test('T16: knight.js 输出 JSON 包含 shouldDuel 字段（转义引号格式）', () => {
  // 模板字符串内使用转义引号
  assert(knightSrc.includes('\\"shouldDuel\\":true/false') || knightSrc.includes('"shouldDuel":true/false'), '骑士 JSON schema 缺少 shouldDuel');
});

test('T17: knight.js 输出 JSON 包含 duelTarget 字段（转义引号格式）', () => {
  assert(knightSrc.includes('\\"duelTarget\\":数字或null') || knightSrc.includes('"duelTarget":数字或null'), '骑士 JSON schema 缺少 duelTarget');
});

test('T18: useSpeechFlow.js 消费 shouldDuel（骑士决斗触发）', () => {
  assert(speechFlowSrc.includes('ROLE_DEFINITIONS.KNIGHT && res.shouldDuel'), '缺少骑士 shouldDuel 消费');
});

test('T19: 骑士 hasUsedDuel 在 roleParams 中传递', () => {
  assert(aiPromptsSrc.includes('hasUsedDuel: currentPlayer?.hasUsedDuel'), '骑士 hasUsedDuel 未在 roleParams 中传递');
});

// ─── 回归测试 ─────────────────────────────────────────────────────
console.log('\n[T20-T23] 回归测试（R18/R19）');

test('T20: 村民 DAY_SPEECH 包含追加格式示例', () => {
  // 村民条目在 ROLE_DAY_SPEECH_PROMPTS 中以 '村民': (ctx, params) 形式出现
  const villagerIdx = aiPromptsSrc.indexOf("'村民': (ctx, params)");
  assert(villagerIdx !== -1, '找不到村民条目');
  const segment = aiPromptsSrc.slice(villagerIdx, villagerIdx + 2000);
  assert(segment.includes('追加示例'), '村民缺少追加示例');
});

test('T21: 猎人 DAY_SPEECH 包含追加格式示例', () => {
  // 猎人条目在 ROLE_DAY_SPEECH_PROMPTS 中
  const hunterIdx = aiPromptsSrc.lastIndexOf("'猎人': (ctx, params)");
  assert(hunterIdx !== -1, '找不到猎人条目');
  const segment = aiPromptsSrc.slice(hunterIdx, hunterIdx + 2000);
  assert(segment.includes('追加示例'), '猎人缺少追加示例');
});

test('T22: 守卫 NIGHT_GUARD identity_table 仍存在', () => {
  const guardStart = aiPromptsSrc.indexOf('case PROMPT_ACTIONS.NIGHT_GUARD:');
  assert(guardStart !== -1, '找不到 NIGHT_GUARD case');
  const segment = aiPromptsSrc.slice(guardStart, guardStart + 1500);
  assert(segment.includes('identity_table'), 'NIGHT_GUARD 缺少 identity_table');
});

test('T23: 魔术师 shouldReveal 消费代码不会重复触发（幂等守护）', () => {
  // T9 已验证 !currentSpeaker.hasRevealed，这里验证整个 if 条件的完整性
  const revealBlock = speechFlowSrc.indexOf('魔术师跳身份处理');
  assert(revealBlock !== -1, '找不到魔术师跳身份处理注释');
  const segment = speechFlowSrc.slice(revealBlock, revealBlock + 400);
  assert(segment.includes('ROLE_DEFINITIONS.MAGICIAN'), '处理块未检查 MAGICIAN 角色');
  assert(segment.includes('res.shouldReveal'), '处理块未检查 shouldReveal');
  assert(segment.includes('!currentSpeaker.hasRevealed'), '处理块未检查幂等防护');
});

// ─── 结果 ─────────────────────────────────────────────────────────
console.log(`\n总计: ${passed + failed} | ✅ ${passed} | ❌ ${failed}`);
if (failed > 0) process.exit(1);
