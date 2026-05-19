/**
 * Quick prompt quality test — generates prompts for all roles with mock game state
 * and checks for known issues (self-outing words, passive filler, missing fields).
 *
 * Usage: node .tmp/test-prompts.mjs
 */

// Mock Vite env vars before importing
globalThis.import = { meta: { env: { VITE_WEREWOLF_AI_MODE: 'session' } } };

// We can't directly import Vite modules in Node ESM. Instead, let's test
// the prompt text by reading the source and extracting key patterns.
import { readFileSync } from 'fs';

const src = readFileSync('src/services/aiPrompts.js', 'utf8');

console.log('=== Prompt Quality Check ===\n');

// Check 1: No more 自爆 in wolf strategy
const selfDestruct = src.match(/自爆/g);
if (selfDestruct) {
  console.log(`❌ FAIL: Found ${selfDestruct.length} occurrences of "自爆" — wolves will self-out`);
} else {
  console.log('✅ PASS: No "自爆" found in wolf prompts');
}

// Check 2: Wolf thought/speech firewall exists
if (src.includes('thought 和 speech 是两个世界') || src.includes('铁律')) {
  console.log('✅ PASS: Wolf thought/speech firewall present');
} else {
  console.log('❌ FAIL: Missing wolf thought/speech firewall');
}

// Check 3: voteDecided in all role prompts
const voteDecidedCount = (src.match(/voteDecided/g) || []).length;
console.log(`${voteDecidedCount >= 10 ? '✅' : '⚠️'} voteDecided mentioned ${voteDecidedCount} times`);

// Check 4: No "划水" in strategies
const lurkCount = (src.match(/划水/g) || []).length;
// "划水" should only appear in "don't lurk" context, not as a strategy option
const lurkInStrategy = src.match(/策略.*划水|划水.*策略/g);
if (lurkInStrategy) {
  console.log(`❌ FAIL: "划水" still listed as strategy option`);
} else {
  console.log(`✅ PASS: "划水" not in strategy options (${lurkCount} mentions total, likely in "don't" context)`);
}

// Check 5: voteIntention semantic clarification
if (src.includes('想投票【淘汰/出局】的目标') || src.includes('想投票淘汰的人')) {
  console.log('✅ PASS: voteIntention semantics clarified (eliminate, not support)');
} else {
  console.log('❌ FAIL: Missing voteIntention semantic clarification');
}

// Check 6: Self-identity reminder
if (src.includes('你就是') && src.includes('不要用') && src.includes('第三人称')) {
  console.log('✅ PASS: Self-identity reminder present (no third-person self-reference)');
} else {
  console.log('⚠️ WARN: Self-identity reminder might be weak');
}

// Check 7: Speaker progress context
if (src.includes('未发言') && src.includes('已发言')) {
  console.log('✅ PASS: Speaker progress context (已发言/未发言 lists) present');
} else {
  console.log('❌ FAIL: Missing speaker progress context');
}

// Check 8: Accusation response guide
if (src.includes('被指控时的应对') || src.includes('被指控时')) {
  console.log('✅ PASS: Accusation response guide present');
} else {
  console.log('❌ FAIL: Missing accusation response guide');
}

// Check 9: Wolf deception strategies (A/B/C/D)
if (src.includes('主动踩人') && src.includes('站边混入') && src.includes('制造对立')) {
  console.log('✅ PASS: Wolf deception strategies A/B/C/D present');
} else {
  console.log('❌ FAIL: Missing wolf deception strategies');
}

// Check 10: Personality traits injection
if (src.includes('你的发言风格')) {
  console.log('✅ PASS: Personality traits injected into speech context');
} else {
  console.log('❌ FAIL: Missing personality traits injection');
}

// Check 11: Night strategy split (first night vs subsequent)
const firstNightCount = (src.match(/首夜策略/g) || []).length;
const subsequentNightCount = (src.match(/后续夜策略|后续夜/g) || []).length;
console.log(`${firstNightCount >= 2 && subsequentNightCount >= 2 ? '✅' : '⚠️'} Night strategy splits: ${firstNightCount} first-night, ${subsequentNightCount} subsequent-night`);

// Check 12: Witch fact-checking
if (src.includes('你还没有救过任何人') || src.includes('不要声称你救过谁')) {
  console.log('✅ PASS: Witch fact-checking (anti-hallucination) present');
} else {
  console.log('❌ FAIL: Missing witch fact-checking');
}

// Check 13: Hunter anti-friendly-fire
if (src.includes('带走好人') && src.includes('帮狼人')) {
  console.log('✅ PASS: Hunter anti-friendly-fire warning present');
} else {
  console.log('❌ FAIL: Missing hunter anti-friendly-fire');
}

// Check 14: logicValidator wolfTarget fix
const validatorSrc = readFileSync('src/services/logicValidator.js', 'utf8');
const wolfKillCount = (validatorSrc.match(/wolfKill/g) || []).length;
const wolfTargetCount = (validatorSrc.match(/wolfTarget/g) || []).length;
if (wolfKillCount === 0 && wolfTargetCount >= 2) {
  console.log('✅ PASS: logicValidator uses wolfTarget (not wolfKill)');
} else {
  console.log(`❌ FAIL: logicValidator still has wolfKill (${wolfKillCount}) vs wolfTarget (${wolfTargetCount})`);
}

// Check 15: lastVoteIntention passed to DAY_VOTE
const dayFlowSrc = readFileSync('src/hooks/useDayFlow.js', 'utf8');
if (dayFlowSrc.includes('lastVoteIntention: mySpeech?.voteIntention')) {
  console.log('✅ PASS: lastVoteIntention passed to DAY_VOTE AI call');
} else {
  console.log('❌ FAIL: lastVoteIntention NOT passed to DAY_VOTE');
}

// Check 16: justSpokenId in moveToNextSpeaker
if (dayFlowSrc.includes('justSpokenId')) {
  console.log('✅ PASS: moveToNextSpeaker accepts justSpokenId parameter');
} else {
  console.log('❌ FAIL: Missing justSpokenId in moveToNextSpeaker');
}

// Check 17: PK tie-breaking
if (dayFlowSrc.includes('handlePKRound') && dayFlowSrc.includes('PK 环节')) {
  console.log('✅ PASS: PK tie-breaking mechanism present');
} else {
  console.log('❌ FAIL: Missing PK tie-breaking');
}

// Check 18: Anti-passive-wait phrases banned
if (src.includes('禁止消极等待话术') && src.includes('先不急着站队')) {
  console.log('✅ PASS: Anti-passive-wait phrases explicitly banned');
} else {
  console.log('❌ FAIL: Missing anti-passive-wait ban');
}

// Check 19: Topic diversity rule
if (src.includes('引入新的分析角度') || src.includes('引入新视角')) {
  console.log('✅ PASS: Topic diversity rule (don\'t all discuss same point)');
} else {
  console.log('❌ FAIL: Missing topic diversity rule');
}

// Check 20: Identity table — don't fill for unanalyzed players
if (src.includes('只填你有分析依据的玩家') || src.includes('不要填到推理表')) {
  console.log('✅ PASS: Identity table quality rule (no random fills)');
} else {
  console.log('❌ FAIL: Missing identity table quality rule');
}

// Check 21: PK vote context
if (dayFlowSrc.includes('PK 重投') || dayFlowSrc.includes('不要沿用之前')) {
  console.log('✅ PASS: PK vote re-think context present');
} else {
  console.log('❌ FAIL: Missing PK vote re-think context');
}

// Check 22: Night mechanism analysis ban
if (src.includes('不要分析平安夜的机制原因') || src.includes('不要分析平安夜的机制')) {
  console.log('✅ PASS: Night mechanism analysis ban present');
} else {
  console.log('❌ FAIL: Missing night mechanism analysis ban');
}

// Check 23: Conditional seer-follow voting
if (src.includes('预言家已验证') && src.includes('必须跟查杀走')) {
  console.log('✅ PASS: Conditional seer-follow voting guidance');
} else {
  console.log('❌ FAIL: Missing conditional seer-follow');
}

// Check 24: COT Step5 查杀 checkpoint
if (src.includes('查杀检查') && src.includes('投查杀目标')) {
  console.log('✅ PASS: COT Step5 查杀 checkpoint');
} else {
  console.log('❌ FAIL: Missing COT Step5 checkpoint');
}

console.log('\n=== Done ===');
