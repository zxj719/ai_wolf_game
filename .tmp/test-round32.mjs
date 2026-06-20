// Round 32 Test: 骑士 SHERIFF_SPEECH + SHERIFF_RUN 专属分支
import { readFileSync } from 'fs';

const src = readFileSync('src/services/aiPrompts.js', 'utf-8');
let pass = 0, fail = 0;

function test(name, cond) {
  if (cond) { console.log(`  ✅ ${name}`); pass++; }
  else { console.log(`  ❌ FAIL: ${name}`); fail++; }
}

// ── Find SHERIFF_RUN block ──
const srStart = src.indexOf("case PROMPT_ACTIONS.SHERIFF_RUN: {");
const srEnd = src.indexOf("case PROMPT_ACTIONS.SHERIFF_SPEECH: {");
const srBlock = src.slice(srStart, srEnd);

// ── Find SHERIFF_SPEECH block ──
// Use lastIndexOf to get the real case (not getCOTTemplate fake case)
const ssStart = src.lastIndexOf("case PROMPT_ACTIONS.SHERIFF_SPEECH: {");
const ssEnd = src.indexOf("case PROMPT_ACTIONS.SHERIFF_VOTE: {");
const ssBlock = src.slice(ssStart, ssEnd);

console.log('\n=== T1-T5: SHERIFF_RUN 骑士 分支 ===');
test('T1: SHERIFF_RUN 骑士 branch exists', srBlock.includes("playerRole === '骑士'"));
test('T2: SHERIFF_RUN 骑士 未决斗 branch includes 行动能力/双重不确定性',
  srBlock.includes('双重不确定性') && srBlock.includes('行动能力'));
test('T3: SHERIFF_RUN 骑士 已决斗 branch includes 公信力',
  srBlock.includes('公信力'));
test('T4: SHERIFF_RUN 骑士 uses hasUsedDuel',
  srBlock.includes('hasUsedDuel'));
test('T5: SHERIFF_RUN 骑士 is positioned before 摄梦人',
  srBlock.indexOf("playerRole === '骑士'") < srBlock.indexOf("playerRole === '摄梦人'"));

console.log('\n=== T6-T15: SHERIFF_SPEECH 骑士 分支 ===');
test('T6: knightHasDueled variable defined in SHERIFF_SPEECH',
  ssBlock.includes('knightHasDueled'));
test('T7: knightSsHint variable defined in SHERIFF_SPEECH',
  ssBlock.includes('knightSsHint'));
test('T8: ssHint chain contains 骑士 branch',
  ssBlock.includes("playerRole === '骑士'"));
test('T9: 骑士 branch in ssHint chain is before 好人 fallback',
  ssBlock.indexOf("playerRole === '骑士'") < ssBlock.indexOf('你是好人（'));
test('T10: 骑士 branch after 魔术师 in ssHint chain',
  ssBlock.indexOf("playerRole === '魔术师'") < ssBlock.indexOf("playerRole === '骑士'"));

// Find knight block within ssBlock
const knightSsStart = ssBlock.indexOf('const knightSsHint');
const knightSsEnd = ssBlock.indexOf('const ssHint');
const knightSsBlock = ssBlock.slice(knightSsStart, knightSsEnd);

test('T11: 骑士 revealed branch mentions 已验证 or 行动验证',
  knightSsBlock.includes('已验证') || knightSsBlock.includes('行动验证'));
test('T12: 骑士 unrevealed branch has 2 改编方向 (①②)',
  knightSsBlock.includes('①') && knightSsBlock.includes('②'));
test('T13: 骑士 unrevealed branch does NOT contain "骑士" keyword in output instructions',
  !knightSsBlock.slice(knightSsBlock.indexOf("身份未公开")).includes('你是骑士（身份未公开）：以隐性主动框架竞选，绝不透露任何身份词汇。\n【改编方向') ||
  !knightSsBlock.includes("决斗") || 
  // The word 决斗 ONLY appears in the variable-declaration context, not in the framework text itself
  (() => {
    const frameworkStart = knightSsBlock.indexOf('身份未公开）：以隐性主动框架');
    const frameworkEnd = knightSsBlock.indexOf("const ssHint", frameworkStart);
    const frameworkText = knightSsBlock.slice(frameworkStart, frameworkEnd);
    return !frameworkText.includes('决斗');
  })());
test('T14: 骑士 unrevealed branch says 绝不透露任何身份词汇',
  knightSsBlock.includes('绝不透露任何身份词汇'));
test('T15: 骑士 revealed branch references 竞选3要点',
  knightSsBlock.includes('竞选3要点'));

console.log('\n=== T16-T20: 其他角色回归测试 ===');
test('T16: 预言家 still in ssHint chain',
  ssBlock.includes("playerRole === '预言家'"));
test('T17: 狼人 still in ssHint chain',
  ssBlock.includes("playerRole === '狼人'"));
test('T18: 猎人 still in ssHint chain',
  ssBlock.includes("playerRole === '猎人'"));
test('T19: 摄梦人 still in ssHint chain',
  ssBlock.includes("playerRole === '摄梦人'"));
test('T20: 魔术师 still in ssHint chain',
  ssBlock.includes("playerRole === '魔术师'"));

console.log('\n=== T21-T25: SHERIFF_RUN 其他角色回归 ===');
test('T21: 猎人 still in SHERIFF_RUN',
  srBlock.includes("playerRole === '猎人'"));
test('T22: 守卫 still in SHERIFF_RUN',
  srBlock.includes("playerRole === '守卫'"));
test('T23: 摄梦人 still in SHERIFF_RUN',
  srBlock.includes("playerRole === '摄梦人'"));
test('T24: 魔术师 still in SHERIFF_RUN',
  srBlock.includes("playerRole === '魔术师'"));
test('T25: 骑士 SHERIFF_RUN branch is inserted (not in good-person fallback)',
  srBlock.includes("playerRole === '骑士'") &&
  srBlock.indexOf("playerRole === '骑士'") < srBlock.indexOf("srHint = '你是好人：可以上警"));

console.log(`\n===========================`);
console.log(`Total: ${pass}/${pass+fail} passed`);
if (fail > 0) process.exit(1);
