/**
 * Round 58 tests: 女巫 & 守卫 DAY_SPEECH Step 0 读写闭环
 *
 * 验证：
 * A. witchDayHistoryStep 变量声明 + D1/D2+ 分支
 * B. 女巫 思维链 Step 0 位置正确
 * C. 女巫 identity_table 写指导格式更新
 * D. guardDayHistoryStep 变量声明 + D1/D2+ 分支
 * E. 守卫 思维链 Step 0 位置正确
 * F. 守卫 identity_table 写指导格式更新
 * G. 关键词对齐验证（NIGHT_WITCH / NIGHT_GUARD 回归）
 * H. 回归验证（R55/R56/R57 不破坏）
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dirname, '../aiPrompts.js'), 'utf8');

// ── 定位锚点 ──────────────────────────────────────────────
// 女巫 DAY_SPEECH 函数（ROLE_DAY_SPEECH_PROMPTS 中的 '女巫' 条目）
// lastIndexOf 排除 ROLE_STRATEGY_PROMPTS 中的 '女巫': (isFirstDay,...) 条目
const witchFuncMarkerIdx = src.lastIndexOf("'女巫': (ctx, params) => {");
const witchFuncBlock = src.slice(witchFuncMarkerIdx, witchFuncMarkerIdx + 7500); // R105: window expanded from 6000 (witch var block grew ~891 chars from isTripleConsecutivePeacefulWitch + tripleConsecutivePeaceHintWitch; 输出JSON: now at ~6588)

// 守卫 DAY_SPEECH 函数（ROLE_DAY_SPEECH_PROMPTS 中的 '守卫' 条目）
const guardFuncMarkerIdx = src.lastIndexOf("'守卫': (ctx, params) => {");
const guardFuncBlock = src.slice(guardFuncMarkerIdx, guardFuncMarkerIdx + 6500); // R91: window expanded from 5500 (guard block is now 5471 chars after consecutivePeaceHintGuard addition)

// 找到 return ` 的位置，区分变量声明区（varDecl）和模板字符串区（tmpl）
const witchReturnIdx = witchFuncBlock.indexOf('return `');
const witchVarDeclBlock = witchFuncBlock.slice(0, witchReturnIdx);
const witchTmplBlock = witchFuncBlock.slice(witchReturnIdx);

const guardReturnIdx = guardFuncBlock.indexOf('return `');
const guardVarDeclBlock = guardFuncBlock.slice(0, guardReturnIdx);
const guardTmplBlock = guardFuncBlock.slice(guardReturnIdx);

// ── Group A: witchDayHistoryStep 变量 ────────────────────
test('T1: 女巫 DAY_SPEECH 函数体 marker 存在', () => {
    expect(witchFuncMarkerIdx).toBeGreaterThan(-1);
});

test('T2: witchDayHistoryStep 变量在函数体 return 之前声明', () => {
    expect(witchVarDeclBlock).toContain('witchDayHistoryStep');
});

test('T3: D2+ 条件判断存在（ctx.dayCount > 1）', () => {
    expect(witchVarDeclBlock).toContain('ctx.dayCount > 1');
});

test('T4: D2+ 分支含"毒药优先候选"关键词（与 NIGHT_WITCH Step 0 对齐）', () => {
    // 找到 witchDayHistoryStep 变量声明块
    const varStart = witchVarDeclBlock.indexOf('witchDayHistoryStep');
    const varEnd = witchVarDeclBlock.indexOf(';', varStart + 200) + 1;
    const varContent = witchVarDeclBlock.slice(varStart, varEnd);
    expect(varContent).toContain('毒药优先候选');
});

test('T5: D1 分支含"首日无历史毒药候选"（首日跳过标识）', () => {
    const varStart = witchVarDeclBlock.indexOf('witchDayHistoryStep');
    const varEnd = witchVarDeclBlock.indexOf(';', varStart + 200) + 1;
    const varContent = witchVarDeclBlock.slice(varStart, varEnd);
    expect(varContent).toContain('首日无历史毒药候选');
});

// ── Group B: 女巫 思维链 Step 0 位置 ─────────────────────
test('T6: ${witchDayHistoryStep} 插值占位符在模板字符串 思维链 中', () => {
    expect(witchTmplBlock).toContain('${witchDayHistoryStep}');
});

test('T7: ${witchDayHistoryStep} 出现在 Step1 之前', () => {
    const step0Pos = witchTmplBlock.indexOf('${witchDayHistoryStep}');
    const step1Pos = witchTmplBlock.indexOf('Step1:');
    expect(step0Pos).toBeGreaterThan(-1);
    expect(step1Pos).toBeGreaterThan(-1);
    expect(step0Pos).toBeLessThan(step1Pos);
});

test('T8: Step3 引用 Step0 历史候选', () => {
    // Step3 should mention Step0 history
    const step3Pos = witchTmplBlock.indexOf('Step3:');
    const nextStepPos = witchTmplBlock.indexOf('Step4:', step3Pos);
    const step3Content = witchTmplBlock.slice(step3Pos, nextStepPos > -1 ? nextStepPos : step3Pos + 200);
    expect(step3Content).toContain('Step0');
});

// ── Group C: 女巫 write guidance 更新 ────────────────────
test('T9: 写指导含"下轮 DAY Step 0"前向引用（关键词对齐更新）', () => {
    const writeMarkerPos = witchTmplBlock.indexOf('identity_table 填写指导');
    expect(writeMarkerPos).toBeGreaterThan(-1);
    const writeBlock = witchTmplBlock.slice(writeMarkerPos, writeMarkerPos + 1000);
    expect(writeBlock).toContain('下轮 DAY Step 0');
});

test('T10: 写指导含"追加不覆盖历史"规范', () => {
    const writeMarkerPos = witchTmplBlock.indexOf('identity_table 填写指导');
    const writeBlock = witchTmplBlock.slice(writeMarkerPos, writeMarkerPos + 1000);
    expect(writeBlock).toContain('追加不覆盖历史');
});

test('T11: 写指导含【追加示例】', () => {
    const writeMarkerPos = witchTmplBlock.indexOf('identity_table 填写指导');
    const writeBlock = witchTmplBlock.slice(writeMarkerPos, writeMarkerPos + 1000);
    expect(writeBlock).toContain('【追加示例】');
});

test('T12: 【追加示例】含分号拼接格式示例', () => {
    const examplePos = witchTmplBlock.indexOf('【追加示例】');
    expect(examplePos).toBeGreaterThan(-1);
    // Find end of that line
    const lineEnd = witchTmplBlock.indexOf('\n', examplePos);
    const exampleLine = witchTmplBlock.slice(examplePos, lineEnd);
    expect(exampleLine).toContain('→');
    expect(exampleLine).toContain('；');  // semicolon separator
});

// ── Group D: guardDayHistoryStep 变量 ────────────────────
test('T13: 守卫 DAY_SPEECH 函数体 marker 存在', () => {
    expect(guardFuncMarkerIdx).toBeGreaterThan(-1);
});

test('T14: guardDayHistoryStep 变量在函数体 return 之前声明', () => {
    expect(guardVarDeclBlock).toContain('guardDayHistoryStep');
});

test('T15: D2+ 条件判断存在（ctx.dayCount > 1）', () => {
    expect(guardVarDeclBlock).toContain('ctx.dayCount > 1');
});

test('T16: D2+ 分支含"守护优先级：高"关键词（与 NIGHT_GUARD Step 0 对齐）', () => {
    const varStart = guardVarDeclBlock.indexOf('guardDayHistoryStep');
    const varEnd = guardVarDeclBlock.indexOf(';', varStart + 200) + 1;
    const varContent = guardVarDeclBlock.slice(varStart, varEnd);
    expect(varContent).toContain('守护优先级：高');
});

test('T17: D1 分支含"首日无历史守护候选"（首日跳过标识）', () => {
    const varStart = guardVarDeclBlock.indexOf('guardDayHistoryStep');
    const varEnd = guardVarDeclBlock.indexOf(';', varStart + 200) + 1;
    const varContent = guardVarDeclBlock.slice(varStart, varEnd);
    expect(varContent).toContain('首日无历史守护候选');
});

// ── Group E: 守卫 思维链 Step 0 位置 ─────────────────────
test('T18: ${guardDayHistoryStep} 插值占位符在模板字符串 思维链 中', () => {
    expect(guardTmplBlock).toContain('${guardDayHistoryStep}');
});

test('T19: ${guardDayHistoryStep} 出现在 Step1 之前', () => {
    const step0Pos = guardTmplBlock.indexOf('${guardDayHistoryStep}');
    const step1Pos = guardTmplBlock.indexOf('Step1:');
    expect(step0Pos).toBeGreaterThan(-1);
    expect(step1Pos).toBeGreaterThan(-1);
    expect(step0Pos).toBeLessThan(step1Pos);
});

test('T20: Step4 引用 Step0 历史候选', () => {
    const step4Pos = guardTmplBlock.indexOf('Step4:');
    expect(step4Pos).toBeGreaterThan(-1);
    const step4Content = guardTmplBlock.slice(step4Pos, step4Pos + 200);
    expect(step4Content).toContain('Step0');
});

// ── Group F: 守卫 write guidance 更新 ────────────────────
test('T21: 守卫写指导"疑似关键神职"条目含"下轮 DAY Step 0"前向引用', () => {
    const writeMarkerPos = guardTmplBlock.indexOf('identity_table 填写指导');
    expect(writeMarkerPos).toBeGreaterThan(-1);
    const writeBlock = guardTmplBlock.slice(writeMarkerPos, writeMarkerPos + 800);
    expect(writeBlock).toContain('下轮 DAY Step 0');
});

// ── Group G: 关键词对齐验证 ───────────────────────────────
test('T22: NIGHT_WITCH Step 0 仍使用"毒药优先候选"关键词（R39 回归）', () => {
    const nightWitchCaseIdx = src.indexOf('case PROMPT_ACTIONS.NIGHT_WITCH: {');
    expect(nightWitchCaseIdx).toBeGreaterThan(-1);
    const nightWitchBlock = src.slice(nightWitchCaseIdx, nightWitchCaseIdx + 3000);
    expect(nightWitchBlock).toContain('毒药优先候选');
});

test('T23: NIGHT_GUARD Step 0 仍使用"守护优先级"关键词（R40 回归）', () => {
    const nightGuardCaseIdx = src.indexOf('case PROMPT_ACTIONS.NIGHT_GUARD: {');
    expect(nightGuardCaseIdx).toBeGreaterThan(-1);
    const nightGuardBlock = src.slice(nightGuardCaseIdx, nightGuardCaseIdx + 3000);
    expect(nightGuardBlock).toContain('守护优先级：高');
});

test('T24: 女巫 DAY Step 0 与 NIGHT_WITCH Step 0 使用相同关键词"毒药优先候选"', () => {
    // 两者都应含有这个关键词（已在 T4 和 T22 各自验证，这里做联合确认）
    const varStart = witchVarDeclBlock.indexOf('witchDayHistoryStep');
    const varEnd = witchVarDeclBlock.indexOf(';', varStart + 200) + 1;
    const varContent = witchVarDeclBlock.slice(varStart, varEnd);
    expect(varContent).toContain('毒药优先候选');

    const nightWitchCaseIdx = src.indexOf('case PROMPT_ACTIONS.NIGHT_WITCH: {');
    const nightWitchBlock = src.slice(nightWitchCaseIdx, nightWitchCaseIdx + 3000);
    expect(nightWitchBlock).toContain('毒药优先候选');
});

test('T25: 守卫 DAY Step 0 与 NIGHT_GUARD Step 0 使用相同关键词"守护优先级：高"', () => {
    const varStart = guardVarDeclBlock.indexOf('guardDayHistoryStep');
    const varEnd = guardVarDeclBlock.indexOf(';', varStart + 200) + 1;
    const varContent = guardVarDeclBlock.slice(varStart, varEnd);
    expect(varContent).toContain('守护优先级：高');

    const nightGuardCaseIdx = src.indexOf('case PROMPT_ACTIONS.NIGHT_GUARD: {');
    const nightGuardBlock = src.slice(nightGuardCaseIdx, nightGuardCaseIdx + 3000);
    expect(nightGuardBlock).toContain('守护优先级：高');
});

// ── Group H: 回归验证 ─────────────────────────────────────
test('T26: 狼人 DAY_SPEECH Step 0 仍存在（R55 回归，搜索"高优先刀口"内联关键词）', () => {
    // R55: 狼人 Step 0 是内联实现（无独立变量名），用关键词搜索
    const wolfFuncIdx = src.indexOf("'狼人': (ctx, params) => {");
    expect(wolfFuncIdx).toBeGreaterThan(-1);
    // 窗口已从 6500 升至 7500（R103 新增 isTripleConsecutivePeacefulWolf + tripleConsecutivePeaceHintWolf 变量块，高优先刀口 移至 ~6819 处）
    const wolfBlock = src.slice(wolfFuncIdx, wolfFuncIdx + 7500);
    expect(wolfBlock).toContain('高优先刀口');
});

test('T27: 猎人 DAY_SPEECH Step 0 仍存在（R56 回归）', () => {
    expect(src).toContain('hunterDayHistoryStep');
    const hunterFuncIdx = src.lastIndexOf("'猎人': (ctx, params) => {");
    const hunterBlock = src.slice(hunterFuncIdx, hunterFuncIdx + 3000);
    expect(hunterBlock).toContain('hunterDayHistoryStep');
});

test('T28: 预言家 DAY_SPEECH Step 0 仍存在（R57 回归，搜索"排队查验优先级"）', () => {
    expect(src).toContain('seerDayHistoryStep');
    const seerFuncIdx = src.lastIndexOf("'预言家': (ctx, params) => {");
    const seerBlock = src.slice(seerFuncIdx, seerFuncIdx + 4000);
    expect(seerBlock).toContain('seerDayHistoryStep');
    expect(seerBlock).toContain('排队查验优先级');
});
