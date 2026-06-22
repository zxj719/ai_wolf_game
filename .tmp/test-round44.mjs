/**
 * Round 44 测试：骑士 DAY→DAY identity_table 读写闭环
 * 验证 knight.js 的 getKnightDaySpeechPrompt 新增了 Step 0 和写指导
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const knightSrc = readFileSync(join(__dirname, '../src/services/rolePrompts/knight.js'), 'utf8');

let passed = 0;
let failed = 0;

function test(name, condition) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.error(`  ❌ ${name}`);
    failed++;
  }
}

console.log('\n=== T1-T8: knightHistoryStep 变量声明 ===');

test('T1: knightHistoryStep 变量存在', knightSrc.includes('const knightHistoryStep'));
test('T2: R44 注释存在', knightSrc.includes('R44 DAY→DAY 读写闭环'));
test('T3: ctx.dayCount > 1 条件判断', knightSrc.includes('ctx.dayCount > 1'));
test('T4: 第一天兜底分支', knightSrc.includes('第一天】无历史决斗候选记录'));
test('T5: N2+ 读取指令含"决斗候选"关键词', knightSrc.includes('读取历史决斗候选'));
test('T6: 读取指令提及 identity_table', knightSrc.includes('你之前的身份推理表'));
test('T7: 存活过滤提示', knightSrc.includes('是否仍然存活'));
test('T8: 非硬约束说明（历史候选是起点）', knightSrc.includes('历史候选是决策起点'));

console.log('\n=== T9-T14: 思维链 Step 0 注入 ===');

// 定位 getKnightDaySpeechPrompt 函数的 return 模板字符串
const returnIdx = knightSrc.indexOf('return `${getBaseContext(ctx)}');
test('T9: return 模板字符串存在', returnIdx > -1);

if (returnIdx > -1) {
  const templateBlock = knightSrc.slice(returnIdx, returnIdx + 3000);
  test('T10: 思维链区块存在', templateBlock.includes('思维链（必须完成）'));
  test('T11: Step 0 注入到思维链', templateBlock.includes('${knightHistoryStep}'));
  // Step 0 应在 Step1 之前
  const step0Idx = templateBlock.indexOf('${knightHistoryStep}');
  const step1Idx = templateBlock.indexOf('Step1:');
  test('T12: Step 0 在 Step1 之前', step0Idx < step1Idx && step0Idx > -1);
  // 输出JSON应有"6步"提示
  test('T13: 输出JSON thought 字段提示含"Step0"', templateBlock.includes('Step0读历史') || templateBlock.includes('含Step0'));
  // Step 0 注入点在思维链标题后
  const thinkingIdx = templateBlock.indexOf('思维链（必须完成）');
  test('T14: knightHistoryStep 在思维链标题后', step0Idx > thinkingIdx);
}

console.log('\n=== T15-T22: identity_table 写指导 ===');

test('T15: 写指导标题存在', knightSrc.includes('identity_table 填写指导（骑士白天'));
test('T16: "决斗候选"关键词指导', knightSrc.includes('决斗候选：[优先级'));
test('T17: 下天 Step 0 前向引用', knightSrc.includes('下天 Step 0 将直接从此读取'));
test('T18: 追加示例 before/after 对比', knightSrc.includes('【追加示例】'));
test('T19: 追加示例含"优先级A"关键词', knightSrc.includes('优先级A，预言家对跳'));
test('T20: "铁好人"标记防误伤', knightSrc.includes('铁好人：[依据]；禁止决斗'));
test('T21: "已决斗出局"历史标记', knightSrc.includes('已决斗出局'));
test('T22: 追加不覆盖历史指令', knightSrc.includes('追加本轮新观察，不要覆盖历史'));

console.log('\n=== T23-T28: 格式与数量完整性 ===');

// 确认 identity_table 出现在输出 JSON 中
const outputJsonLine = knightSrc.match(/输出JSON:\{.*identity_table.*\}/);
test('T23: 输出JSON包含identity_table', outputJsonLine !== null);
// 确认 shouldDuel 依然在输出 JSON 中（模板字符串内使用转义引号 \"）
test('T24: shouldDuel 字段保留', knightSrc.includes('shouldDuel'));
// 确认 duelTarget 字段保留
test('T25: duelTarget 字段保留', knightSrc.includes('duelTarget'));
// 确认 confidence 字段保留
test('T26: confidence 字段保留', knightSrc.includes('"confidence"') || knightSrc.includes('\\"confidence\\"'));
// DAY→DAY 标记
test('T27: DAY→DAY 标记存在', knightSrc.includes('DAY→DAY'));
// 确认没有"下轮复查"这类悬空前向引用
test('T28: 无悬空前向引用 (下轮复查等)', !knightSrc.includes('下轮复查'));

console.log('\n=== T29-T32: 回归——原有骑士功能未破坏 ===');

test('T29: 骑士三阶段策略保留', knightSrc.includes('骑士发言三阶段策略'));
test('T30: 决斗决策系统三级优先级保留', knightSrc.includes('决斗决策系统（三级优先级）'));
test('T31: 决斗禁忌保留', knightSrc.includes('决斗禁忌'));
test('T32: getKnightDaySpeechPrompt 导出保留', knightSrc.includes('export const getKnightDaySpeechPrompt'));

console.log('\n=== 常驻诊断 ===');

// 常驻诊断：确认无悬空前向引用
const dangling = knightSrc.match(/供下轮|下轮用|下轮参考|下轮复查/g);
test('T33: 常驻诊断——无悬空前向引用', !dangling);

// 读写关键词一致性：写指导用"决斗候选"，Step 0 也搜"决斗候选"
const writeKeyword = '决斗候选：[优先级';
const readKeyword = '含"决斗候选"字样';
test('T34: 读写关键词一致（均含"决斗候选"）', knightSrc.includes(writeKeyword) && knightSrc.includes(readKeyword));

console.log('\n' + '='.repeat(50));
console.log(`总计：${passed + failed} 项测试，✅ ${passed} 通过，❌ ${failed} 失败`);

if (failed > 0) {
  process.exit(1);
}
