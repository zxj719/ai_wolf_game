/**
 * Round 2 prompt validation — no LLM, pure logic checks.
 * Tests:
 *  T1: Werewolf DAY_SPEECH no longer contains negative forbidden-word list
 *  T2: Werewolf DAY_SPEECH still contains positive behavior description
 *  T3: NIGHT_WOLF multi-wolf hint present when teammates exist
 *  T4: NIGHT_WOLF multi-wolf hint absent when no teammates (孤狼)
 *  T5: Seer thinking dimension no longer says "焦点位或定点位"
 *  T6: Seer thinking dimension still contains meaningful check logic
 *  T7: getSeerNightActionPrompt uses first-night strategy on night 1
 *  T8: getSeerNightActionPrompt uses standard strategy on night 2+
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// Read source files directly as text (no ESM module imports needed)
const aiPrompts = readFileSync(path.join(projectRoot, 'src/services/aiPrompts.js'), 'utf8');
const seerJs = readFileSync(path.join(projectRoot, 'src/services/rolePrompts/seer.js'), 'utf8');

let pass = 0;
let fail = 0;

function test(label, fn) {
  try {
    const result = fn();
    if (result) {
      console.log(`  ✅ ${label}`);
      pass++;
    } else {
      console.log(`  ❌ ${label} — returned falsy`);
      fail++;
    }
  } catch (e) {
    console.log(`  ❌ ${label} — threw: ${e.message}`);
    fail++;
  }
}

console.log('\n=== Round 2 Prompt Validation ===\n');

// T1: Negative forbidden word list removed from aiPrompts.js DAY_SPEECH
test('T1: ROLE_DAY_SPEECH_PROMPTS[狼人] no longer has explicit forbidden-word list', () => {
  return !aiPrompts.includes('speech 中绝对禁止出现：狼人、队友、刀、狼队');
});

// T2: Positive description present
test('T2: ROLE_DAY_SPEECH_PROMPTS[狼人] has positive behavior description', () => {
  return aiPrompts.includes('以好人视角写就：只谈发言分析');
});

// T3: Multi-wolf hint is present in NIGHT_WOLF case
test('T3: NIGHT_WOLF has multi-wolf coordination hint', () => {
  return aiPrompts.includes('多狼协作') && aiPrompts.includes('wolfTeammates');
});

// T4: Multi-wolf hint only triggers when wolfTeammates.length > 0
test('T4: Multi-wolf hint is conditional (length > 0)', () => {
  return aiPrompts.includes('wolfTeammates.length > 0');
});

// T5: Seer thinking dimension no longer has "焦点位或定点位"
test('T5: Seer thinking dimension no longer says "焦点位或定点位"', () => {
  return !seerJs.includes('优先查焦点位或定点位');
});

// T6: Seer thinking dimension still has meaningful check logic
test('T6: Seer thinking dimension has updated check logic', () => {
  return seerJs.includes('根据已有发言和线索选择最可疑或影响力最大的未验证玩家');
});

// T7: getSeerNightActionPrompt has first-night branch
test('T7: getSeerNightActionPrompt handles first night (dayCount <= 1)', () => {
  return seerJs.includes('isFirstNight') && seerJs.includes('首夜策略');
});

// T8: getSeerNightActionPrompt has standard strategy for subsequent nights
test('T8: getSeerNightActionPrompt has standard strategy for subsequent nights', () => {
  return seerJs.includes('发言最可疑或影响力最大');
});

// Bonus: werewolf.js daySpeech dead code path also uses positive description (sanity)
const werewolfJs = readFileSync(path.join(projectRoot, 'src/services/rolePrompts/werewolf.js'), 'utf8');
test('T9 (sanity): werewolf.js daySpeech still has positive description from round 1', () => {
  return werewolfJs.includes('以普通好人视角写就');
});

// Check no localhost leaked into build
const checkBuildScript = readFileSync(path.join(projectRoot, 'scripts/check-build.mjs'), 'utf8');
test('T10: check-build.mjs script exists and has localhost check', () => {
  return checkBuildScript.includes('localhost');
});

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===\n`);
process.exit(fail > 0 ? 1 : 0);
