/**
 * Round 7 patch verification tests
 * 1. NIGHT_DREAMWEAVER output schema now contains identity_table
 * 2. HUNTER_SHOOT now has criticalGuidance with alive-count math and decision framework
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dirname, '../src/services/aiPrompts.js'), 'utf-8');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`❌ ${name}: ${e.message}`);
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

// Helper: extract a case block by searching for PROMPT_ACTIONS.CASE_NAME
function getCaseSection(caseName, windowSize = 4000) {
  const marker = `PROMPT_ACTIONS.${caseName}`;
  const idx = src.indexOf(marker);
  if (idx < 0) throw new Error(`${marker} not found`);
  return src.slice(idx, idx + windowSize);
}

// ─── T1-T4: NIGHT_DREAMWEAVER identity_table ─────────────────────────────────

test('T1: NIGHT_DREAMWEAVER output schema contains identity_table field', () => {
  const section = getCaseSection('NIGHT_DREAMWEAVER');
  const outputIdx = section.indexOf('输出JSON:');
  assert(outputIdx > 0, '输出JSON line not found in NIGHT_DREAMWEAVER');
  const outputLine = section.slice(outputIdx, outputIdx + 600);
  assert(outputLine.includes('identity_table'), 'identity_table missing from NIGHT_DREAMWEAVER output schema');
});

test('T2: NIGHT_DREAMWEAVER identity_table format matches other NIGHT_* schemas', () => {
  const section = getCaseSection('NIGHT_DREAMWEAVER');
  const outputIdx = section.indexOf('输出JSON:');
  const outputLine = section.slice(outputIdx, outputIdx + 600);
  assert(outputLine.includes('"suspect"'), 'suspect field missing');
  assert(outputLine.includes('"confidence"'), 'confidence field missing');
  assert(outputLine.includes('"reason"'), 'reason field missing');
});

test('T3: dreamTarget field still present (regression - existing schema fields preserved)', () => {
  const section = getCaseSection('NIGHT_DREAMWEAVER');
  const outputLine = section.slice(section.indexOf('输出JSON:'), section.indexOf('输出JSON:') + 600);
  assert(outputLine.includes('"dreamTarget"'), 'dreamTarget missing');
  assert(outputLine.includes('"dreamMode"'), 'dreamMode missing');
  assert(outputLine.includes('"dreamReason"'), 'dreamReason missing');
  assert(outputLine.includes('"isConsecutiveDream"'), 'isConsecutiveDream missing');
});

test('T4: All 5 NIGHT_* cases now have identity_table (SEER, GUARD, WOLF, WITCH, DREAMWEAVER)', () => {
  const nightCases = ['NIGHT_SEER', 'NIGHT_GUARD', 'NIGHT_WOLF', 'NIGHT_WITCH', 'NIGHT_DREAMWEAVER'];
  for (const c of nightCases) {
    const section = getCaseSection(c);
    assert(section.includes('identity_table'), `${c} missing identity_table in output schema`);
  }
});

// ─── T5-T9: HUNTER_SHOOT critical guidance ────────────────────────────────────

test('T5: HUNTER_SHOOT case has hunterCriticalGuidance variable', () => {
  const section = getCaseSection('HUNTER_SHOOT');
  assert(section.includes('hunterCriticalGuidance'), 'hunterCriticalGuidance variable not found');
});

test('T6: HUNTER_SHOOT criticalGuidance contains alive-count math logic', () => {
  const section = getCaseSection('HUNTER_SHOOT');
  assert(section.includes('hunterAliveCount') || section.includes('aliveTargets'), 'alive count math missing');
  assert(section.includes('好人数'), '好人数 reasoning missing');
  assert(section.includes('狼人'), 'wolf reasoning missing');
});

test('T7: HUNTER_SHOOT criticalGuidance injected into return string', () => {
  const section = getCaseSection('HUNTER_SHOOT');
  assert(section.includes('${hunterCriticalGuidance}'), 'hunterCriticalGuidance not interpolated into template');
});

test('T8: HUNTER_SHOOT thought field updated to require alive-count reasoning', () => {
  const section = getCaseSection('HUNTER_SHOOT', 1800); // tight window to avoid spilling into next case
  const outputIdx = section.indexOf('输出JSON:');
  assert(outputIdx > 0, '输出JSON not found in HUNTER_SHOOT');
  const outputLine = section.slice(outputIdx, outputIdx + 300);
  assert(outputLine.includes('"thought"'), 'thought field not found in HUNTER_SHOOT output JSON');
  assert(
    outputLine.includes('约剩') || outputLine.includes('推断') || outputLine.includes('X狼'),
    `thought field should require wolf-count reasoning, got: ${outputLine}`
  );
});

test('T9: HUNTER_SHOOT original strategy list still present (regression)', () => {
  const section = getCaseSection('HUNTER_SHOOT');
  assert(section.includes('优先带走'), '优先带走 strategy missing');
  assert(section.includes('悍跳预言家'), '悍跳预言家 strategy missing');
});

// ─── T10-T12: Regression — previous rounds' fixes unchanged ──────────────────

test('T10: NIGHT_WITCH still has identity_table (Round 6 fix preserved)', () => {
  const section = getCaseSection('NIGHT_WITCH');
  assert(section.includes('identity_table'), 'NIGHT_WITCH identity_table lost');
});

test('T11: SHERIFF_BADGE_PASS still has goldWaterTargets/killedTargets (Round 6 fix preserved)', () => {
  assert(src.includes('goldWaterTargets'), 'goldWaterTargets filter missing');
  assert(src.includes('killedTargets'), 'killedTargets filter missing');
});

test('T12: NIGHT_SEER still has identity_table (Round 4 fix preserved)', () => {
  const section = getCaseSection('NIGHT_SEER');
  assert(section.includes('identity_table'), 'NIGHT_SEER identity_table lost');
});

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n总计: ${passed + failed} 项测试，${passed} 通过，${failed} 失败`);
if (failed > 0) process.exit(1);
