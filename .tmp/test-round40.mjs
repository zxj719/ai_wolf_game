/**
 * Round 40 测试：NIGHT_GUARD 守护优先候选读写闭环修复
 * 验证点：
 * T0:  case 定位（有花括号 R11 规范）
 * T1-T4: guardNightLabel + guardHistoryStep 变量（R18 规范 + 首夜/N2+分支）
 * T5-T8: 思维链 Step 0 内容（首夜 vs N2+夜）
 * T9-T12: identity_table 写指导（forward reference + guardNightLabel 替换 N[X]）
 * T13-T14: 旧版内容已被替换
 * T15-T17: R18 合规（return 模板内无 ctx.dayCount；guardNightLabel/guardHistoryStep 在 return 前定义）
 * T18-T23: 回归检查（NIGHT_WOLF/WITCH wolfHistoryStep/witchHistoryStep；NIGHT_SEER；DAY_VOTE Step A/B）
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

// ─── 定位 NIGHT_GUARD case 块 ────────────────────────────────────────────────
const guardCaseIdx = src.indexOf('case PROMPT_ACTIONS.NIGHT_GUARD: {');

// ─── T0: case 定位（有花括号） ───────────────────────────────────────────────
console.log('\n【T0】NIGHT_GUARD case 定位（R11 花括号规范）');
test('T0: 找到 "case PROMPT_ACTIONS.NIGHT_GUARD: {"', guardCaseIdx !== -1);

// 找到 NIGHT_MAGICIAN 作为边界
const magicianCaseIdx = src.indexOf('case PROMPT_ACTIONS.NIGHT_MAGICIAN:', guardCaseIdx);
const guardBlock = guardCaseIdx !== -1 && magicianCaseIdx !== -1
    ? src.slice(guardCaseIdx, magicianCaseIdx)
    : '';

// ─── T1-T4: 变量存在性 ───────────────────────────────────────────────────────
console.log('\n【T1-T4】guardNightLabel + guardHistoryStep 变量（R18 规范）');

const returnIdx = guardBlock.indexOf('return `');
const preReturnBlock = returnIdx > 0 ? guardBlock.slice(0, returnIdx) : guardBlock;

test('T1: guardNightLabel 在 return 前定义', preReturnBlock.includes("const guardNightLabel = `N${ctx.dayCount}`"));
test('T2: guardHistoryStep 在 return 前定义', preReturnBlock.includes('const guardHistoryStep ='));
test('T3: guardHistoryStep N2+分支含"读取历史守护优先候选"', preReturnBlock.includes('读取历史守护优先候选'));
test('T4: guardHistoryStep 首夜分支含"首夜"', preReturnBlock.includes('首夜】无历史守护记录'));

// ─── T5-T8: 思维链 Step 0 内容 ──────────────────────────────────────────────
console.log('\n【T5-T8】思维链 Step 0 内容');

const returnBlock = returnIdx > 0 ? guardBlock.slice(returnIdx) : '';

test('T5: return 模板含 ${guardHistoryStep}', returnBlock.includes('${guardHistoryStep}'));
test('T6: 【守护思维链】标签', returnBlock.includes('【守护思维链】'));
test('T7: 有 "1. 【守护优先级】" 步骤（已编号）', returnBlock.includes('1. 【守护优先级】'));
test('T8: 有 "2. 【禁连守处理】" 步骤', returnBlock.includes('2. 【禁连守处理】'));

// ─── T9-T12: identity_table 写指导 ──────────────────────────────────────────
console.log('\n【T9-T12】identity_table 写指导（forward reference + guardNightLabel）');

test('T9: identity_table 写指导含 "下轮 Step 0 将直接从此读取"',
    returnBlock.includes('下轮 Step 0 将直接从此读取'));
test('T10: 守护候选 reason 含 "${guardNightLabel}夜守护"',
    returnBlock.includes('${guardNightLabel}夜守护'));
test('T11: 疑似神职候选 reason 含 "守护优先级：高/中"',
    returnBlock.includes('守护优先级：高/中'));
test('T12: 有 "3. 【最终决策】" 步骤',
    returnBlock.includes('3. 【最终决策】'));

// ─── T13-T14: 旧版内容已替换 ────────────────────────────────────────────────
console.log('\n【T13-T14】旧版内容已替换');

test('T13: 旧版 "N[X]夜守护" 已被替换',
    !returnBlock.includes('"N[X]夜守护'));
test('T14: 旧版无编号"【守护优先级】"已被替换',
    !returnBlock.includes('\n【守护优先级】已跳身份'));

// ─── T15-T17: R18 合规 ──────────────────────────────────────────────────────
console.log('\n【T15-T17】R18 合规（return 模板无裸 ctx.dayCount）');

const returnTemplateEnd = guardBlock.lastIndexOf('`;\n');
const returnTemplateContent = returnIdx > 0 && returnTemplateEnd > returnIdx
    ? guardBlock.slice(returnIdx, returnTemplateEnd)
    : returnBlock;

test('T15: return 模板内无裸 ctx.dayCount 插值',
    !returnTemplateContent.includes('${ctx.dayCount}'));
test('T16: guardNightLabel 在 return 前定义（R18 核心约束）',
    preReturnBlock.includes("const guardNightLabel = `N${ctx.dayCount}`"));
test('T17: guardHistoryStep 在 return 前定义（R18 核心约束）',
    preReturnBlock.includes('const guardHistoryStep ='));

// ─── T18-T23: 回归检查 ──────────────────────────────────────────────────────
console.log('\n【T18-T23】回归检查');

// NIGHT_WOLF wolfHistoryStep（R38 核心改动）
const wolfCaseIdx = src.indexOf('case PROMPT_ACTIONS.NIGHT_WOLF: {');
const wolfBlock = wolfCaseIdx !== -1 ? src.slice(wolfCaseIdx, wolfCaseIdx + 3000) : '';
test('T18: NIGHT_WOLF wolfHistoryStep 仍存在', wolfBlock.includes('wolfHistoryStep'));
test('T19: NIGHT_WOLF Step 0 "读取历史刀口" 仍存在', wolfBlock.includes('读取历史刀口'));

// NIGHT_WITCH witchHistoryStep（R39 核心改动）
const witchCaseIdx = src.indexOf('case PROMPT_ACTIONS.NIGHT_WITCH: {');
const witchBlock = witchCaseIdx !== -1 ? src.slice(witchCaseIdx, witchCaseIdx + 3000) : '';
test('T20: NIGHT_WITCH witchHistoryStep 仍存在', witchBlock.includes('witchHistoryStep'));
test('T21: NIGHT_WITCH Step 0 "读取历史毒药候选" 仍存在', witchBlock.includes('读取历史毒药候选'));

// NIGHT_SEER identity_table（R25 核心改动）
const seerCaseIdx = src.indexOf('case PROMPT_ACTIONS.NIGHT_SEER: {');
const seerBlock = seerCaseIdx !== -1 ? src.slice(seerCaseIdx, seerCaseIdx + 2500) : '';
test('T22: NIGHT_SEER identity_table 仍含 "夜查验确认"', seerBlock.includes('夜查验确认'));

// DAY_VOTE Step A/B（R37 核心改动）
const voteIdx = src.indexOf('case PROMPT_ACTIONS.DAY_VOTE: {');
const voteBlock = voteIdx !== -1 ? src.slice(voteIdx, voteIdx + 3000) : '';
test('T23: DAY_VOTE Step A 三维打分仍存在', voteBlock.includes('Step A：独立评估'));

// ─── 统计 ────────────────────────────────────────────────────────────────────
console.log(`\n总计：${passed}/${passed + failed} passed`);

if (failed > 0) {
    console.log('\n⚠️  有测试失败，请检查 aiPrompts.js');
    process.exit(1);
} else {
    console.log('\n✅ 所有测试通过！');
}
