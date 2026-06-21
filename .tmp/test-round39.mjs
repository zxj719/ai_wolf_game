/**
 * Round 39 测试：NIGHT_WITCH 读写闭环修复
 * 验证点：
 * T0:  case 定位（有花括号 R11 规范）
 * T1-T4: witchNightLabel + witchHistoryStep 变量（R18 规范 + 首夜/N2+分支）
 * T5-T8: 思维链 Step 0 内容（首夜 vs N2+夜）
 * T9-T12: identity_table 写指导（forward reference + witchNightLabel 替换 N[X]）
 * T13-T14: 旧版内容已被替换
 * T15-T17: R18 合规（return 模板内无 ctx.dayCount；witchNightLabel/witchHistoryStep 在 return 前定义）
 * T18-T22: 回归检查（NIGHT_WOLF wolfHistoryStep 完整性；NIGHT_SEER identity_table；DAY_VOTE Step A/B）
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(process.cwd(), 'src/services/aiPrompts.js'), 'utf8');

let passed = 0;
let failed = 0;

function test(name, condition, debugInfo) {
    if (condition) {
        console.log(`  ✅ ${name}`);
        passed++;
    } else {
        console.log(`  ❌ ${name}${debugInfo ? '\n     ' + debugInfo : ''}`);
        failed++;
    }
}

// ─── 定位 NIGHT_WITCH case 块 ───────────────────────────────────────────────
const witchCaseIdx = src.indexOf('case PROMPT_ACTIONS.NIGHT_WITCH: {');

// ─── T0: case 定位（有花括号） ───────────────────────────────────────────────
console.log('\n【T0】NIGHT_WITCH case 定位（R11 花括号规范）');
test('T0: 找到 "case PROMPT_ACTIONS.NIGHT_WITCH: {"', witchCaseIdx !== -1);

// 找到 case 结束的 "}" 在 NIGHT_DREAMWEAVER 之前
const dreamweaverCaseIdx = src.indexOf('case PROMPT_ACTIONS.NIGHT_DREAMWEAVER: {', witchCaseIdx);
const witchBlock = witchCaseIdx !== -1 && dreamweaverCaseIdx !== -1
    ? src.slice(witchCaseIdx, dreamweaverCaseIdx)
    : '';

// ─── T1-T4: 变量存在性 ───────────────────────────────────────────────────────
console.log('\n【T1-T4】witchNightLabel + witchHistoryStep 变量（R18 规范）');

// R18: 变量必须在 return 之前定义
const returnIdx = witchBlock.indexOf('return `');
const preReturnBlock = returnIdx > 0 ? witchBlock.slice(0, returnIdx) : witchBlock;

test('T1: witchNightLabel 在 return 前定义', preReturnBlock.includes("const witchNightLabel = `N${ctx.dayCount}`"));
test('T2: witchHistoryStep 在 return 前定义', preReturnBlock.includes('const witchHistoryStep ='));
test('T3: witchHistoryStep N2+分支含"读取历史毒药候选"', preReturnBlock.includes('读取历史毒药候选'));
test('T4: witchHistoryStep 首夜分支含"首夜"', preReturnBlock.includes('首夜】无历史毒药候选记录'));

// ─── T5-T8: 思维链 Step 0 内容 ──────────────────────────────────────────────
console.log('\n【T5-T8】思维链 Step 0 内容');

const returnBlock = returnIdx > 0 ? witchBlock.slice(returnIdx) : '';

test('T5: return 模板含 ${witchHistoryStep}', returnBlock.includes('${witchHistoryStep}'));
test('T6: 【用药策略（思维链）】标签', returnBlock.includes('【用药策略（思维链）】'));
test('T7: 有 "1. 解药考量" 步骤（已编号）', returnBlock.includes('1. 解药考量'));
test('T8: 有 "2. 毒药考量：结合上方历史候选（Step 0）"', returnBlock.includes('2. 毒药考量：结合上方历史候选（Step 0）'));

// ─── T9-T12: identity_table 写指导 ──────────────────────────────────────────
console.log('\n【T9-T12】identity_table 写指导（forward reference + witchNightLabel）');

test('T9: identity_table 写指导含 "下轮 Step 0 将直接从此读取"',
    returnBlock.includes('下轮 Step 0 将直接从此读取'));
test('T10: 本晚被刀目标 reason 含 "${witchNightLabel}夜被狼刀"',
    returnBlock.includes('${witchNightLabel}夜被狼刀'));
test('T11: 已毒杀玩家 reason 含 "${witchNightLabel}夜毒药处决"',
    returnBlock.includes('${witchNightLabel}夜毒药处决'));
test('T12: 高威胁毒药候选 reason 含 "毒药优先候选"',
    returnBlock.includes('毒药优先候选'));

// ─── T13-T14: 旧版内容已替换 ────────────────────────────────────────────────
console.log('\n【T13-T14】旧版内容已替换');

test('T13: 旧版"下轮复查"（单独）已被替换', !returnBlock.includes('；下轮复查"'));
test('T14: 旧版无编号"解药考量"已被替换', !returnBlock.includes('- 解药考量：被刀者是否为关键神职'));

// ─── T15-T17: R18 合规 ──────────────────────────────────────────────────────
console.log('\n【T15-T17】R18 合规（return 模板无裸 ctx.dayCount）');

// 找到 return 模板字符串的结束位置（最后一个 `; 前）
const returnTemplateEnd = witchBlock.lastIndexOf('`;\n');
const returnTemplateContent = returnIdx > 0 && returnTemplateEnd > returnIdx
    ? witchBlock.slice(returnIdx, returnTemplateEnd)
    : returnBlock;

test('T15: return 模板内无裸 ctx.dayCount 插值',
    !returnTemplateContent.includes('${ctx.dayCount}'));
test('T16: witchNightLabel 在 return 前定义（R18 核心约束）',
    preReturnBlock.includes("const witchNightLabel = `N${ctx.dayCount}`"));
test('T17: witchHistoryStep 在 return 前定义（R18 核心约束）',
    preReturnBlock.includes('const witchHistoryStep ='));

// ─── T18-T22: 回归检查 ──────────────────────────────────────────────────────
console.log('\n【T18-T22】回归检查');

// NIGHT_WOLF wolfHistoryStep（R38 核心改动）
const wolfCaseIdx = src.indexOf('case PROMPT_ACTIONS.NIGHT_WOLF: {');
const wolfBlock = wolfCaseIdx !== -1 ? src.slice(wolfCaseIdx, wolfCaseIdx + 3000) : '';
test('T18: NIGHT_WOLF wolfHistoryStep 仍存在', wolfBlock.includes('wolfHistoryStep'));
test('T19: NIGHT_WOLF Step 0 "读取历史刀口" 仍存在', wolfBlock.includes('读取历史刀口'));

// NIGHT_SEER identity_table（R25 核心改动）
const seerCaseIdx = src.indexOf('case PROMPT_ACTIONS.NIGHT_SEER: {');
const seerBlock = seerCaseIdx !== -1 ? src.slice(seerCaseIdx, seerCaseIdx + 2500) : '';
test('T20: NIGHT_SEER identity_table 仍含 "夜查验确认"', seerBlock.includes('夜查验确认'));

// DAY_VOTE Step A/B（R37 核心改动）
const voteIdx = src.indexOf('case PROMPT_ACTIONS.DAY_VOTE: {');
const voteBlock = voteIdx !== -1 ? src.slice(voteIdx, voteIdx + 3000) : '';
test('T21: DAY_VOTE Step A 三维打分仍存在', voteBlock.includes('Step A：独立评估'));
test('T22: DAY_VOTE Step B 热力校正仍存在', voteBlock.includes('Step B：热力校正逻辑'));

// ─── 统计 ────────────────────────────────────────────────────────────────────
console.log(`\n总计：${passed}/${passed + failed} passed`);

if (failed > 0) {
    console.log('\n⚠️  有测试失败，请检查 aiPrompts.js');
    process.exit(1);
} else {
    console.log('\n✅ 所有测试通过！');
}
