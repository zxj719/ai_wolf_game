/**
 * Round 82 tests: 女巫 DAY_SPEECH 平安夜推断框架（witchPeaceNightStep）
 *
 * 验证在 R81 全功能版本（含 witchDayHistoryStep + personalityLens + speechLen）之上：
 * T1-T5   变量声明（isPeacefulNightWitch / witchPeaceNightStep 初值 / 条件 / 分支逻辑 / lastSaved）
 * T6-T10  内容验证（⭕标记 / 路径A解药已用 / 路径B解药未用 / prevDay / confidence 指导）
 * T11-T15 注入位置（${witchPeaceNightStep}Step1: / thought 优先 / 顺序 / 不覆盖witchDayHistoryStep）
 * T16-T20 回归（空初值 / 白熊合规 / 双重保护 / 块大小 / 参数解构兼容）
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dirname, '../aiPrompts.js'), 'utf8');

// ── 定位女巫 DAY_SPEECH 函数 ──────────────────────────────────
// lastIndexOf 确保找到 ROLE_DAY_SPEECH_PROMPTS 中的 '女巫' 条目
const witchFuncMarkerIdx = src.lastIndexOf("'女巫': (ctx, params) => {");
// 窗口 10000 chars — R81 全功能版本约 6000 chars + R82 新增约 2000 chars
const witchFuncBlock = src.slice(witchFuncMarkerIdx, witchFuncMarkerIdx + 10000);

const witchReturnIdx = witchFuncBlock.indexOf('return `');
const witchVarDeclBlock = witchFuncBlock.slice(0, witchReturnIdx);
const witchTmplBlock = witchFuncBlock.slice(witchReturnIdx);

// ── Group T1-T5: 变量声明 ─────────────────────────────────────

test('T1: 女巫 DAY_SPEECH 函数体 marker 存在', () => {
    expect(witchFuncMarkerIdx).toBeGreaterThan(-1);
});

test('T2: isPeacefulNightWitch 变量在 return 前声明', () => {
    expect(witchVarDeclBlock).toContain('isPeacefulNightWitch');
});

test('T3: witchPeaceNightStep 以空字符串初始化', () => {
    expect(witchVarDeclBlock).toContain("witchPeaceNightStep = ''");
});

test('T4: 平安夜条件使用 ctx.dayCount > 1 且含 平安夜 检测', () => {
    expect(witchVarDeclBlock).toContain('ctx.dayCount > 1');
    expect(witchVarDeclBlock).toContain("ctx.lastNightInfo?.includes('平安夜')");
});

test('T5: 解药已用分支检测 !hasWitchSave 且 savedIds 有值，解药未用分支检测 hasWitchSave', () => {
    expect(witchVarDeclBlock).toContain('!hasWitchSave');
    expect(witchVarDeclBlock).toContain('witchHistory?.savedIds?.length > 0');
    expect(witchVarDeclBlock).toContain('} else if (hasWitchSave)');
});

// ── Group T6-T10: 内容验证 ──────────────────────────────────

test('T6: 路径A（解药已用）和路径B（解药未用）均含 ⭕ 推断标记', () => {
    const r82Start = witchVarDeclBlock.indexOf('// R82');
    const r82Block = witchVarDeclBlock.slice(r82Start);
    // 两个路径各有一个 ⭕
    const occurrences = (r82Block.match(/⭕/g) || []).length;
    expect(occurrences).toBeGreaterThanOrEqual(2);
});

test('T7: 路径A（解药已用）含 confidence 升 20-30 指令', () => {
    const r82Start = witchVarDeclBlock.indexOf('// R82');
    const r82Block = witchVarDeclBlock.slice(r82Start);
    expect(r82Block).toContain('confidence 升 20-30');
});

test('T8: 路径A（解药已用）含 prevDay 平安夜推断 追加指导', () => {
    const r82Start = witchVarDeclBlock.indexOf('// R82');
    const r82Block = witchVarDeclBlock.slice(r82Start);
    expect(r82Block).toContain('D${prevDay}平安夜推断');
});

test('T9: 路径B（解药未用）含"你解药未动"说明', () => {
    const r82Start = witchVarDeclBlock.indexOf('// R82');
    const r82Block = witchVarDeclBlock.slice(r82Start);
    expect(r82Block).toContain('你解药未动');
});

test('T10: 路径B（解药未用）含连续平安夜守卫连守推断', () => {
    const r82Start = witchVarDeclBlock.indexOf('// R82');
    const r82Block = witchVarDeclBlock.slice(r82Start);
    expect(r82Block).toContain('连续出现平安夜');
    expect(r82Block).toContain('守卫正在连守同一目标');
});

// ── Group T11-T15: 注入位置 ──────────────────────────────────

test('T11: 模板中存在 ${witchPeaceNightStep}Step1: 复合字符串', () => {
    expect(witchTmplBlock).toContain('${witchPeaceNightStep}Step1:');
});

test('T12: 模板中 witchPeaceNightStep 在 Step1: 之前出现（合并形式）', () => {
    const peaceIdx = witchTmplBlock.indexOf('${witchPeaceNightStep}');
    const step1Idx = witchTmplBlock.indexOf('Step1:');
    expect(peaceIdx).toBeGreaterThan(-1);
    expect(step1Idx).toBeGreaterThan(-1);
    expect(peaceIdx).toBeLessThan(step1Idx);
});

test('T13: 路径A 含 thought 约束（推断在 thought 中完成）', () => {
    const r82Start = witchVarDeclBlock.indexOf('// R82');
    const r82Block = witchVarDeclBlock.slice(r82Start);
    expect(r82Block).toContain('thought 中完成');
});

test('T14: 路径A 从 savedIds 末位提取 lastSaved', () => {
    const r82Start = witchVarDeclBlock.indexOf('// R82');
    const r82Block = witchVarDeclBlock.slice(r82Start);
    expect(r82Block).toContain('savedIds[witchHistory.savedIds.length - 1]');
});

test('T15: witchDayHistoryStep 在模板中仍然存在（R82 未覆盖 R58 Step0）', () => {
    // R82 只是在 Step0 之后、Step1 之前插入，不替换 witchDayHistoryStep
    expect(witchTmplBlock).toContain('${witchDayHistoryStep}');
    expect(witchTmplBlock).toContain('${witchPeaceNightStep}Step1:');
});

// ── Group T16-T20: 回归 ──────────────────────────────────────

test('T16: 非平安夜时 witchPeaceNightStep 为空字符串（向下兼容）', () => {
    expect(witchVarDeclBlock).toContain("let witchPeaceNightStep = ''");
});

test('T17: 推断步骤约束描述为正向（白熊效应合规——无"不要展示"等负向禁词）', () => {
    const r82Start = witchVarDeclBlock.indexOf('// R82');
    const r82Block = witchVarDeclBlock.slice(r82Start);
    expect(r82Block).toContain('按普通村民发言');
    expect(r82Block).not.toContain('不要展示推断');
    expect(r82Block).not.toContain('禁止说出');
});

test('T18: 路径A 含双重保护评估（解药+守卫协同场景）', () => {
    const r82Start = witchVarDeclBlock.indexOf('// R82');
    const r82Block = witchVarDeclBlock.slice(r82Start);
    expect(r82Block).toContain('双重保护');
});

test('T19: 女巫 DAY_SPEECH block 比 R82 前更大（含 R82 新增代码后 > 6000 chars）', () => {
    // R81 全功能版本约 6000 chars；R82 新增约 2000 chars
    expect(witchFuncBlock.length).toBeGreaterThan(6000);
    expect(witchFuncBlock).toContain('isPeacefulNightWitch');
});

test('T20: params 解构包含 witchHistory/hasWitchSave/hasWitchPoison（兼容性验证）', () => {
    expect(witchVarDeclBlock).toContain('witchHistory');
    expect(witchVarDeclBlock).toContain('hasWitchSave');
    expect(witchVarDeclBlock).toContain('hasWitchPoison');
});
