/**
 * Round 25 测试脚本：NIGHT_SEER 信息增量策略改进
 *
 * 验证点：
 * T1-T4：case 块语法（有花括号）
 * T5-T8：悍跳警报动态注入
 * T9-T11：查验历史计数
 * T12-T14：残局策略（≤5 人）
 * T15-T18：五级优先级框架（后续夜，非残局）
 * T19-T22：首夜策略保持不变
 * T23-T25：identity_table 指导保留
 * T26-T28：seer.js 思维维度同步
 * T29-T30：ROLE_PERSONAS 降级路径同步
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const src = readFileSync(join(root, 'src/services/aiPrompts.js'), 'utf8');
const seerSrc = readFileSync(join(root, 'src/services/rolePrompts/seer.js'), 'utf8');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    const result = fn();
    if (result) {
      console.log(`✅ ${name}`);
      passed++;
    } else {
      console.log(`❌ ${name} → assertion returned false`);
      failed++;
    }
  } catch (e) {
    console.log(`❌ ${name} → ${e.message}`);
    failed++;
  }
}

// Find the NIGHT_SEER case block in aiPrompts.js
// Use lastIndexOf("case PROMPT_ACTIONS.NIGHT_SEER: {") to find the block with braces
const nightSeerStart = src.lastIndexOf('case PROMPT_ACTIONS.NIGHT_SEER: {');
if (nightSeerStart === -1) {
  console.log('FATAL: Cannot find "case PROMPT_ACTIONS.NIGHT_SEER: {" in aiPrompts.js');
  process.exit(1);
}
// Extract a window large enough to cover the entire case block (~3000 chars)
const nightSeerBlock = src.slice(nightSeerStart, nightSeerStart + 3500);

// === T1-T4: Case block syntax ===
test('T1: NIGHT_SEER case opens with braces', () => {
  return src.indexOf('case PROMPT_ACTIONS.NIGHT_SEER: {') !== -1;
});

test('T2: NIGHT_SEER case closes with } after return', () => {
  // Check that after the return template string, there is a closing brace
  const returnIdx = nightSeerBlock.lastIndexOf('输出:{"targetId":数字');
  const closingIdx = nightSeerBlock.indexOf('}', returnIdx + 50);
  return closingIdx !== -1 && closingIdx < 3500;
});

test('T3: NIGHT_SEER uses let for seerNightStrategy', () => {
  return nightSeerBlock.includes('let seerNightStrategy;');
});

test('T4: NIGHT_SEER uses if/else if/else structure (not ternary)', () => {
  return nightSeerBlock.includes('if (isFirstNight)') &&
         nightSeerBlock.includes('} else if (isEndgame)') &&
         nightSeerBlock.includes('} else {');
});

// === T5-T8: 悍跳警报动态注入 ===
test('T5: counterClaimants uses claimHistory filter by jump_seer', () => {
  return nightSeerBlock.includes("c.type === 'jump_seer'") &&
         nightSeerBlock.includes('c.playerId !== currentPlayer?.id');
});

test('T6: counterClaimText generated when counterClaimants non-empty', () => {
  return nightSeerBlock.includes('counterClaimants.length > 0') &&
         nightSeerBlock.includes('counterClaimText');
});

test('T7: counterClaimText includes 悍跳警报 text', () => {
  return nightSeerBlock.includes('悍跳警报') &&
         nightSeerBlock.includes('对跳');
});

test('T8: counterClaimText injected into return template', () => {
  const returnStart = nightSeerBlock.indexOf('return `预言家查验决策。');
  const returnEnd = nightSeerBlock.indexOf('输出:', returnStart);
  const returnBlock = nightSeerBlock.slice(returnStart, returnEnd);
  return returnBlock.includes('${counterClaimText}');
});

// === T9-T11: 查验历史计数 ===
test('T9: mySeerChecksCount filters by seerId', () => {
  return nightSeerBlock.includes('c.seerId === currentPlayer?.id') &&
         nightSeerBlock.includes('mySeerChecksCount');
});

test('T10: mySeerChecksCount injected into return template', () => {
  const returnStart = nightSeerBlock.indexOf('return `预言家查验决策。');
  const returnEnd = nightSeerBlock.indexOf('输出:', returnStart);
  const returnBlock = nightSeerBlock.slice(returnStart, returnEnd);
  return returnBlock.includes('${mySeerChecksCount}');
});

test('T11: return shows check count context', () => {
  return nightSeerBlock.includes('查验历史】本局已查验');
});

// === T12-T14: 残局策略 ===
test('T12: isEndgame threshold is 5 or fewer alive players', () => {
  return nightSeerBlock.includes('aliveCount <= 5') ||
         nightSeerBlock.includes('aliveCount <=5');
});

test('T13: endgame strategy mentions 精准打击', () => {
  return nightSeerBlock.includes('精准打击');
});

test('T14: endgame strategy includes different guidance than general', () => {
  return nightSeerBlock.includes('残局策略');
});

// === T15-T18: 五级优先级框架 ===
test('T15: five-tier priority framework present', () => {
  return nightSeerBlock.includes('① 悍跳响应') &&
         nightSeerBlock.includes('② 多路汇聚') &&
         nightSeerBlock.includes('③ 投票关键位') &&
         nightSeerBlock.includes('④ 信任链延伸') &&
         nightSeerBlock.includes('⑤ 行为异常兜底');
});

test('T16: priority framework includes info-chain strategy label', () => {
  return nightSeerBlock.includes('信息增量最大化') ||
         nightSeerBlock.includes('信息链策略');
});

test('T17: avoid-list present (confirms anti-waste guidance)', () => {
  return nightSeerBlock.includes('浪费查验') || nightSeerBlock.includes('避免');
});

test('T18: 悍跳 priority notes public trust (公信权)', () => {
  return nightSeerBlock.includes('公信权') || nightSeerBlock.includes('公信');
});

// === T19-T22: 首夜策略保持不变 ===
test('T19: 首夜策略 edge/random/center strategies still present', () => {
  return nightSeerBlock.includes('边角位策略') &&
         nightSeerBlock.includes('随机策略') &&
         nightSeerBlock.includes('关键位策略');
});

test('T20: 首夜 心路历程 reminder still present', () => {
  return nightSeerBlock.includes('心路历程');
});

test('T21: isFirstNight still used for 首夜 branch', () => {
  return nightSeerBlock.includes('if (isFirstNight)');
});

test('T22: no unwanted JS variable interpolation within 避免 guidance line', () => {
  // Find the 避免 guidance line within the seerNightStrategy template (not the return block)
  const avoidIdx = nightSeerBlock.indexOf('【避免】');
  if (avoidIdx === -1) return false;
  // Only check up to the next newline (the 避免 line itself)
  const lineEnd = nightSeerBlock.indexOf('\n', avoidIdx);
  const avoidLine = nightSeerBlock.slice(avoidIdx, lineEnd === -1 ? avoidIdx + 120 : lineEnd);
  // Confirm the line has no ${...} variable interpolation (pure static text)
  return !avoidLine.includes('${');
});

// === T23-T25: identity_table 指导保留 ===
test('T23: identity_table 填写指导 section preserved', () => {
  return nightSeerBlock.includes('identity_table 填写指导');
});

test('T24: already-checked players guidance (95-100 confidence) still present', () => {
  return nightSeerBlock.includes('95-100') &&
         nightSeerBlock.includes('待明日报');
});

test('T25: tonight target reason includes new priority tier reference', () => {
  // The updated reason hint should reference the priority tiers (①②③④⑤)
  return nightSeerBlock.includes('对跳验证') ||
         nightSeerBlock.includes('多路汇聚') ||
         nightSeerBlock.includes('投票节点');
});

// === T26-T28: seer.js 思维维度同步 ===
test('T26: seer.js getSeerThinkingDimensions updated with priority framework', () => {
  return seerSrc.includes('悍跳响应') &&
         seerSrc.includes('多路汇聚目标');
});

test('T27: seer.js dimension 1 mentions 5-tier structure', () => {
  return seerSrc.includes('① 悍跳响应') &&
         seerSrc.includes('⑤ 行为异常兜底');
});

test('T28: seer.js 心路历程 updated to mention 信息链依据', () => {
  return seerSrc.includes('信息链依据');
});

// === T29-T30: ROLE_PERSONAS 降级路径同步 ===
const personasStart = src.indexOf("'预言家': {");
const personasBlock = src.slice(personasStart, personasStart + 600);

test('T29: ROLE_PERSONAS 预言家 thinkingDimensions[0] updated with ①②③④⑤', () => {
  return personasBlock.includes('① 悍跳响应') &&
         personasBlock.includes('⑤ 行为异常兜底');
});

test('T30: ROLE_PERSONAS 预言家 心路历程 mentions 信息链依据', () => {
  return personasBlock.includes('信息链依据');
});

console.log(`\n总计：${passed + failed} 项测试 — ${passed} 通过 / ${failed} 失败`);
if (failed > 0) process.exit(1);
