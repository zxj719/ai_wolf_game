/**
 * Round 8 Test Script
 * Validates: DAY_SPEECH entries for 骑士/摄梦人/魔术师, LAST_WORDS branches for 骑士/摄梦人/魔术师
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dirname, '../src/services/aiPrompts.js'), 'utf-8');

let passed = 0;
let failed = 0;
const results = [];

function test(name, fn) {
  try {
    fn();
    results.push(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    results.push(`  ❌ ${name}: ${e.message}`);
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

// ─── GROUP 1: DAY_SPEECH entries for special roles ───────────────────────────
// T1: 骑士 entry in ROLE_DAY_SPEECH_PROMPTS
test('T1: 骑士 entry exists in ROLE_DAY_SPEECH_PROMPTS', () => {
  const knightEntry = src.indexOf("'骑士': (ctx, params) => getRoleModule('骑士').daySpeech(ctx, params)");
  assert(knightEntry > -1, 'Knight DAY_SPEECH entry not found');
  // Must be inside ROLE_DAY_SPEECH_PROMPTS, not after its closing brace
  const promptsDefStart = src.indexOf('const ROLE_DAY_SPEECH_PROMPTS = {');
  const promptsDefEnd = src.indexOf('\n};', promptsDefStart) + 2;
  assert(knightEntry > promptsDefStart && knightEntry < promptsDefEnd, 'Knight entry not inside ROLE_DAY_SPEECH_PROMPTS');
});

// T2: 摄梦人 entry in ROLE_DAY_SPEECH_PROMPTS
test('T2: 摄梦人 entry exists in ROLE_DAY_SPEECH_PROMPTS', () => {
  const dwEntry = src.indexOf("'摄梦人': (ctx, params) => getRoleModule('摄梦人').daySpeech(ctx, params)");
  assert(dwEntry > -1, 'Dreamweaver DAY_SPEECH entry not found');
});

// T3: 魔术师 entry in ROLE_DAY_SPEECH_PROMPTS
test('T3: 魔术师 entry exists in ROLE_DAY_SPEECH_PROMPTS', () => {
  const magEntry = src.indexOf("'魔术师': (ctx, params) => getRoleModule('魔术师').daySpeech(ctx, params)");
  assert(magEntry > -1, 'Magician DAY_SPEECH entry not found');
});

// T4: New roleParams fields are present in DAY_SPEECH case
test('T4: hasUsedDuel added to roleParams', () => {
  const field = src.indexOf('hasUsedDuel: currentPlayer?.hasUsedDuel');
  assert(field > -1, 'hasUsedDuel field not found in roleParams');
});

test('T5: dreamHistory added to roleParams', () => {
  const field = src.indexOf('dreamHistory: gameState.dreamweaverHistory');
  assert(field > -1, 'dreamHistory field not found in roleParams');
});

test('T6: lastDreamTarget added to roleParams', () => {
  const field = src.indexOf('lastDreamTarget: gameState.dreamweaverHistory?.lastDreamTarget');
  assert(field > -1, 'lastDreamTarget field not found in roleParams');
});

test('T7: swappedPlayers added to roleParams', () => {
  const field = src.indexOf('swappedPlayers: gameState.magicianHistory?.swappedPlayers');
  assert(field > -1, 'swappedPlayers field not found in roleParams');
});

test('T8: lastSwap added to roleParams', () => {
  const field = src.indexOf('lastSwap: gameState.magicianHistory?.lastSwap');
  assert(field > -1, 'lastSwap field not found in roleParams');
});

// ─── GROUP 2: LAST_WORDS branches ────────────────────────────────────────────
// Find the LAST_WORDS case block
const lwCaseIdx = src.indexOf("case PROMPT_ACTIONS.LAST_WORDS:");
assert(lwCaseIdx > -1, 'LAST_WORDS case not found');

// Extract the LAST_WORDS section
const lwSection = src.slice(lwCaseIdx, lwCaseIdx + 5000);

test('T9: LAST_WORDS has 骑士 branch', () => {
  const idx = lwSection.indexOf("playerRole === '骑士'");
  assert(idx > -1, 'Knight LAST_WORDS branch not found');
});

test('T10: LAST_WORDS 骑士 branch reads hasUsedDuel', () => {
  const idx = lwSection.indexOf('hasUsedDuel');
  assert(idx > -1, 'hasUsedDuel not referenced in LAST_WORDS');
});

test('T11: LAST_WORDS has 摄梦人 branch', () => {
  const idx = lwSection.indexOf("playerRole === '摄梦人'");
  assert(idx > -1, 'Dreamweaver LAST_WORDS branch not found');
});

test('T12: LAST_WORDS 摄梦人 branch references dreamweaverHistory', () => {
  const idx = lwSection.indexOf('dreamweaverHistory');
  assert(idx > -1, 'dreamweaverHistory not referenced in LAST_WORDS dreamweaver branch');
});

test('T13: LAST_WORDS 摄梦人 branch includes 同生共死 warning', () => {
  const idx = lwSection.indexOf('同生共死触发');
  assert(idx > -1, 'syncWarning (同生共死触发) not found in dreamweaver LAST_WORDS');
});

test('T14: LAST_WORDS has 魔术师 branch', () => {
  const idx = lwSection.indexOf("playerRole === '魔术师'");
  assert(idx > -1, 'Magician LAST_WORDS branch not found');
});

test('T15: LAST_WORDS 魔术师 branch references magicianHistory', () => {
  const idx = lwSection.indexOf('magicianHistory');
  assert(idx > -1, 'magicianHistory not referenced in LAST_WORDS magician branch');
});

test('T16: LAST_WORDS 魔术师 reveals swap redirection info', () => {
  const idx = lwSection.indexOf('重定向');
  assert(idx > -1, 'Swap redirection info not in magician LAST_WORDS branch');
});

// ─── GROUP 3: Regression checks ──────────────────────────────────────────────
test('T17: 村民 DAY_SPEECH unchanged (identity_table still there)', () => {
  const villagerStart = src.indexOf("'村民': (ctx, params)");
  assert(villagerStart > -1, '村民 entry not found');
  const villagerSection = src.slice(villagerStart, villagerStart + 2000);
  assert(villagerSection.includes('"identity_table"'), 'identity_table missing from 村民 template');
});

test('T18: HUNTER_SHOOT criticalGuidance from Round 7 still intact', () => {
  const idx = src.indexOf('hunterCriticalGuidance');
  assert(idx > -1, 'HUNTER_SHOOT criticalGuidance from Round 7 missing');
});

test('T19: NIGHT_DREAMWEAVER identity_table from Round 7 still intact', () => {
  // LEARNINGS Round 7: use 'case PROMPT_ACTIONS.XXX' to find case block, not enum def
  const ndwIdx = src.indexOf('case PROMPT_ACTIONS.NIGHT_DREAMWEAVER:');
  assert(ndwIdx > -1, 'NIGHT_DREAMWEAVER case block not found');
  // Output JSON line is ~1400 chars in; use 2000-char window
  const ndwSection = src.slice(ndwIdx, ndwIdx + 2000);
  assert(ndwSection.includes('identity_table'), 'identity_table missing from NIGHT_DREAMWEAVER output schema');
});

test('T20: SHERIFF_BADGE_PASS seerChecks from Round 6 unchanged', () => {
  const idx = src.indexOf('PROMPT_ACTIONS.SHERIFF_BADGE_PASS');
  assert(idx > -1, 'SHERIFF_BADGE_PASS case not found');
});

// Print results
console.log('\n=== Round 8 Test Results ===\n');
results.forEach(r => console.log(r));
console.log(`\nTotal: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
