/**
 * Round 4 prompt validation — no LLM dependency
 * Tests:
 *   1. ROLE_PERSONAS['预言家'].thinkingDimensions[0] 降级路径同步（移除"焦点位/定点位"）
 *   2. NIGHT_SEER 输出 schema 包含 identity_table
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

console.log('\n=== Round 4 Prompt Tests ===\n');

// ---- Fix 1: 预言家降级路径 thinkingDimensions[0] 同步 ----
console.log('【预言家降级路径同步】');

test('ROLE_PERSONAS 预言家不再包含"焦点位或定点位"',
  !src.includes('焦点位或定点位'));

test('ROLE_PERSONAS 预言家第一维度包含"最可疑或影响力最大的未验证玩家"',
  src.includes('最可疑或影响力最大的未验证玩家'));

test('ROLE_PERSONAS 预言家第一维度与 seer.js 一致（含"已有发言和线索"）',
  src.includes('根据已有发言和线索选择最可疑或影响力最大的未验证玩家'));

// 确保这是在降级路径的 ROLE_PERSONAS 中（不仅仅在 seer.js 导入的字符串里）
test('降级路径的查验逻辑描述符合动态策略标准（非硬编码位置偏好）',
  src.includes("'查验逻辑：查谁能提供最大信息量？根据已有发言和线索选择最可疑或影响力最大的未验证玩家'"));

// ---- Fix 2: NIGHT_SEER 输出 schema 包含 identity_table ----
console.log('\n【NIGHT_SEER identity_table 一致性】');

test('NIGHT_SEER 输出 schema 包含 identity_table 字段',
  src.includes('"identity_table":{"玩家号":{"suspect":"角色","confidence":0-100,"reason":"依据"}}}` ;') ||
  src.includes('"identity_table":{"玩家号":{"suspect":"角色","confidence":0-100,"reason":"依据"}}}`'));

test('NIGHT_SEER case 含"reasoning":"查验理由"（未破坏原有字段）',
  src.includes('"reasoning":"查验理由"'));

test('NIGHT_SEER case 含"thought":"查验思考过程"（未破坏原有字段）',
  src.includes('"thought":"查验思考过程"'));

// 守卫也有 identity_table（回归测试）
test('NIGHT_GUARD 输出 schema 仍包含 identity_table（回归）',
  src.includes('守护思考过程","identity_table"'));

// ---- 回归测试：Round 1-3 关键修复未被破坏 ----
console.log('\n【回归测试（Round 1-3 关键修复）】');

test('女巫 taboo 不含"首夜不救人"（Round 1 修复）',
  !src.includes("'首夜不救人'"));

test('女巫 taboo 含"同一晚又救又毒"（Round 1 修复）',
  src.includes('同一晚又救又毒'));

test('女巫输出 schema 无 poisonTarget 冗余字段（Round 1 修复）',
  !src.includes('"poisonTarget"'));

test('NIGHT_WOLF 多狼协作提示存在（Round 1 修复）',
  src.includes('多狼协作'));

test('狼人 DAY_SPEECH 无负向词汇列表（Round 2 修复）',
  !src.includes('狼队、保狼、抗推'));

test('狼人 DAY_SPEECH 含正向描述（Round 2 修复）',
  src.includes('以好人视角写就'));

test('SHERIFF_SPEECH 含"分析权威"核心原则（Round 3 修复）',
  src.includes('分析权威'));

test('狼人 DAY_SPEECH wolfTeammatesHint 函数体存在（Round 3 修复）',
  src.includes('const wolfTeammatesHint = params.wolfTeammates?.length > 0'));

// ---- 汇总 ----
console.log(`\n=== 结果: ${pass} passed, ${fail} failed ===\n`);
if (fail > 0) process.exit(1);
