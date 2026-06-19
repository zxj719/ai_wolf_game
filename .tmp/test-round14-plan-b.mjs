/**
 * Round 14 — Plan B 验证测试
 * 确认死代码删除后，所有活代码路径仍正常工作
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (e) {
    console.error(`❌ ${name}: ${e.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'assertion failed');
}

// ── 读取源文件 ──
const pfSrc = readFileSync(join(root, 'src/services/promptFactory.js'), 'utf-8');
const wolfSrc = readFileSync(join(root, 'src/services/rolePrompts/werewolf.js'), 'utf-8');
const seerSrc = readFileSync(join(root, 'src/services/rolePrompts/seer.js'), 'utf-8');
const witchSrc = readFileSync(join(root, 'src/services/rolePrompts/witch.js'), 'utf-8');
const hunterSrc = readFileSync(join(root, 'src/services/rolePrompts/hunter.js'), 'utf-8');
const guardSrc = readFileSync(join(root, 'src/services/rolePrompts/guard.js'), 'utf-8');
const villagerSrc = readFileSync(join(root, 'src/services/rolePrompts/villager.js'), 'utf-8');
const dwSrc = readFileSync(join(root, 'src/services/rolePrompts/dreamweaver.js'), 'utf-8');
const knightSrc = readFileSync(join(root, 'src/services/rolePrompts/knight.js'), 'utf-8');
const magicianSrc = readFileSync(join(root, 'src/services/rolePrompts/magician.js'), 'utf-8');
const aiPromptsSrc = readFileSync(join(root, 'src/services/aiPrompts.js'), 'utf-8');

// ── T1-T5: 死代码已删除 ──
test('T1: promptFactory 不再包含 getProgressiveActionPrompt 函数定义', () => {
  assert(!pfSrc.includes('export const getProgressiveActionPrompt'), 'function still exists');
});
test('T2: promptFactory 不再包含 CLAIMS_SCHEMA_SUFFIX import', () => {
  assert(!pfSrc.includes('CLAIMS_SCHEMA_SUFFIX'), 'import still exists');
});
test('T3: promptFactory 默认导出不含 getProgressiveActionPrompt', () => {
  const defaultExport = pfSrc.slice(pfSrc.indexOf('export default {'));
  assert(!defaultExport.includes('getProgressiveActionPrompt'), 'still in default export');
});
test('T4: werewolf.js 不再包含 getWerewolfNightActionPrompt / DaySpeechPrompt', () => {
  assert(!wolfSrc.includes('getWerewolfNightActionPrompt'), 'nightAction still present');
  assert(!wolfSrc.includes('getWerewolfDaySpeechPrompt'), 'daySpeech still present');
});
test('T5: 6个主角色 PROMPTS 对象中不含 nightAction/daySpeech 字段', () => {
  for (const [name, src] of [['werewolf', wolfSrc], ['seer', seerSrc], ['witch', witchSrc], ['hunter', hunterSrc], ['guard', guardSrc], ['villager', villagerSrc]]) {
    const prompts = src.slice(src.lastIndexOf('export const ') + 'export const '.length);
    // Should not have nightAction: or daySpeech: in the PROMPTS object
    const promptsObj = src.slice(src.lastIndexOf('_PROMPTS = {'));
    assert(!promptsObj.includes('nightAction:'), `${name} still has nightAction in PROMPTS`);
    assert(!promptsObj.includes('daySpeech:'), `${name} still has daySpeech in PROMPTS`);
  }
});

// ── T6-T10: 活代码路径仍然存在 ──
test('T6: aiPrompts.js 仍然有 NIGHT_MAGICIAN case 调用 magicianModule.nightAction', () => {
  assert(aiPromptsSrc.includes('magicianModule.nightAction('), 'NIGHT_MAGICIAN nightAction call missing');
});
test('T7: aiPrompts.js 仍然有 ROLE_DAY_SPEECH_PROMPTS 骑士/摄梦人/魔术师', () => {
  assert(aiPromptsSrc.includes("'骑士': (ctx, params) => getRoleModule('骑士').daySpeech"), 'knight daySpeech missing');
  assert(aiPromptsSrc.includes("'摄梦人': (ctx, params) => getRoleModule('摄梦人').daySpeech"), 'dreamweaver daySpeech missing');
  assert(aiPromptsSrc.includes("'魔术师': (ctx, params) => getRoleModule('魔术师').daySpeech"), 'magician daySpeech missing');
});
test('T8: knight.js daySpeech 仍然存在', () => {
  assert(knightSrc.includes('export const getKnightDaySpeechPrompt'), 'knight daySpeech deleted by mistake');
  assert(knightSrc.includes('daySpeech: getKnightDaySpeechPrompt'), 'knight PROMPTS.daySpeech missing');
});
test('T9: magician.js nightAction 仍然存在', () => {
  assert(magicianSrc.includes('export const getMagicianNightActionPrompt'), 'magician nightAction deleted by mistake');
  assert(magicianSrc.includes('nightAction: getMagicianNightActionPrompt'), 'magician PROMPTS.nightAction missing');
});
test('T10: dreamweaver.js daySpeech 仍然存在, nightAction 已删除', () => {
  assert(dwSrc.includes('export const getDreamweaverDaySpeechPrompt'), 'dreamweaver daySpeech deleted');
  assert(dwSrc.includes('daySpeech: getDreamweaverDaySpeechPrompt'), 'dreamweaver PROMPTS.daySpeech missing');
  assert(!dwSrc.includes('getDreamweaverNightPrompt'), 'dreamweaver nightAction still present');
  assert(!dwSrc.includes('nightAction:'), 'dreamweaver PROMPTS.nightAction still present');
});

// ── T11-T14: 各角色 buildPersonaPrompt 仍然存在 ──
test('T11: 所有9个角色的 buildPersonaPrompt 仍然存在', () => {
  for (const [name, src] of [
    ['werewolf', wolfSrc], ['seer', seerSrc], ['witch', witchSrc],
    ['hunter', hunterSrc], ['guard', guardSrc], ['villager', villagerSrc],
    ['dreamweaver', dwSrc], ['knight', knightSrc], ['magician', magicianSrc]
  ]) {
    assert(src.includes('buildPersonaPrompt'), `${name} missing buildPersonaPrompt`);
  }
});
test('T12: promptFactory.js buildProgressivePersonaPrompt 仍然导出', () => {
  assert(pfSrc.includes('export const buildProgressivePersonaPrompt'), 'buildProgressivePersonaPrompt missing');
});
test('T13: promptFactory.js buildProgressiveSystemPrompt 仍然导出', () => {
  assert(pfSrc.includes('export const buildProgressiveSystemPrompt'), 'buildProgressiveSystemPrompt missing');
});

// ── T14: 死掉的 baseRules import 已清理 ──
test('T14: 6个主角色中 getBaseContext import 已清理 (where no live code used it)', () => {
  assert(!wolfSrc.includes("import { getBaseContext"), 'werewolf still imports getBaseContext');
  assert(!seerSrc.includes("import { getBaseContext"), 'seer still imports getBaseContext');
  assert(!witchSrc.includes("import { getBaseContext") && !witchSrc.includes("getBaseContext"), 'witch still imports/uses getBaseContext');
  assert(!hunterSrc.includes("getBaseContext"), 'hunter still uses getBaseContext');
  assert(!guardSrc.includes("getBaseContext"), 'guard still uses getBaseContext');
  assert(!villagerSrc.includes("getBaseContext"), 'villager still uses getBaseContext');
  // dreamweaver STILL uses getBaseContext for daySpeech (live) — should keep it
  assert(dwSrc.includes("getBaseContext"), 'dreamweaver missing getBaseContext (needed for daySpeech)');
});

console.log(`\n总计：${passed}/${passed+failed} 通过`);
if (failed > 0) process.exit(1);
