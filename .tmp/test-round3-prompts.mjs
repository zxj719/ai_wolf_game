/**
 * Round 3 prompt validation — no LLM dependency
 * Tests: multi-wolf stance hint injection, roleParams wolfTeammates, SHERIFF_SPEECH 3-point framework
 */
import { readFileSync } from 'fs';

const src = readFileSync(new URL('../src/services/aiPrompts.js', import.meta.url), 'utf8');

let pass = 0;
let fail = 0;

function test(name, condition) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    pass++;
  } else {
    console.log(`  ❌ ${name}`);
    fail++;
  }
}

console.log('\n=== Round 3 Prompt Tests ===\n');

// ---- 多狼白天协作：立场分散具体化 ----
console.log('【多狼协作具体化】');

test('狼人 DAY_SPEECH 转换为函数体（wolfTeammatesHint 变量存在）',
  src.includes('const wolfTeammatesHint = params.wolfTeammates?.length > 0'));

test('wolfTeammatesHint 包含"立场分散"关键词',
  src.includes('立场分散'));

test('wolfTeammatesHint 包含"投票错位"关键词',
  src.includes('投票错位'));

test('wolfTeammatesHint 包含"制造分歧感"关键词',
  src.includes('制造分歧感'));

test('wolfTeammatesHint 正确引用 params.wolfTeammates',
  src.includes('params.wolfTeammates?.length > 0'));

// ---- roleParams 包含 wolfTeammates ----
console.log('\n【roleParams wolfTeammates 注入】');

test('roleParams 包含 wolfTeammates 字段',
  src.includes('wolfTeammates: playerRole === \'狼人\''));

test('wolfTeammates 筛选存活狼队友',
  src.includes("players.filter(p => p.isAlive && p.role === '狼人' && p.id !== currentPlayer?.id)"));

// ---- SHERIFF_SPEECH 三要点框架 ----
console.log('\n【SHERIFF_SPEECH 三要点框架】');

test('SHERIFF_SPEECH 预言家提示含"首夜查验结果"',
  src.includes('首夜查验结果'));

test('SHERIFF_SPEECH 预言家提示含"心路历程"',
  src.includes('心路历程'));

test('SHERIFF_SPEECH 预言家提示含"后续计划"',
  src.includes('后续计划'));

test('SHERIFF_SPEECH 好人提示含"昨夜局势分析"',
  src.includes('昨夜局势分析'));

test('SHERIFF_SPEECH 好人提示含"票型判断"',
  src.includes('票型判断'));

test('SHERIFF_SPEECH 有12人局警徽流条件判断（isLargeGame）',
  src.includes('isLargeGame(gameState?.gameSetup)'));

test('SHERIFF_SPEECH 字数要求改为60-80字（扩展）',
  src.includes('60-80字'));

test('SHERIFF_SPEECH 输出 JSON 包含 thought 字段（博弈思路）',
  src.includes('"真实竞选考量（含博弈思路）"'));

test('SHERIFF_SPEECH 增加核心原则提示',
  src.includes('竞争"分析权威"'));

// ---- Round 2 sanity checks（回归）----
console.log('\n【回归检查（Round 2 修复完好）】');

test('狼人 DAY_SPEECH 无负向词汇列表（无"绝对禁止出现"）',
  !src.includes('绝对禁止出现'));

test('狼人 DAY_SPEECH 含正向描述（100%以好人视角）',
  src.includes('必须100%以好人视角写就'));

test('NIGHT_WOLF 多狼协作提示存在（夜间刀法）',
  src.includes('multiWolfHint'));

// ---- Final ----
console.log(`\n结果: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
