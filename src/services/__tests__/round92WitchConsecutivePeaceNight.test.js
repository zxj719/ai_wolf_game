/**
 * Round 92 tests: 女巫 DAY_SPEECH 连续两夜平安夜二阶推断框架
 * （isConsecutivePeacefulWitch + witchAntidoteHint + consecutivePeaceHintWitch）
 *
 * T1-T5   变量声明（isConsecutivePeacefulWitch / witchAntidoteHint / consecutivePeaceHintWitch / prevPrevDay / 条件检测）
 * T6-T10  内容验证（⭕标记 / 路径A/B / confidence 25-35 / 药水联动 / identity_table追加）
 * T11-T15 注入位置（路径A/B 赋值前置 / isConsec 在 if 块外 / 顺序 / 两路径均注入）
 * T16-T20 回归（空 fallback / 白熊合规 / 解药双轨 / >= 3 区分 / R82 内容保留）
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dirname, '../aiPrompts.js'), 'utf8');

// ── 定位女巫 DAY_SPEECH 函数 ──────────────────────────────────
const witchFuncMarkerIdx = src.lastIndexOf("'女巫': (ctx, params) => {");
// window 12000 — 女巫函数约 5700 chars 后 R92，保留大量余量
const witchFuncBlock = src.slice(witchFuncMarkerIdx, witchFuncMarkerIdx + 12000);

const witchReturnIdx = witchFuncBlock.indexOf('return `');
const witchVarDeclBlock = witchFuncBlock.slice(0, witchReturnIdx);

// R92 section starts at '// R92'
const r92Start = witchVarDeclBlock.indexOf('// R92');
const r92Block = witchVarDeclBlock.slice(r92Start);

// ── Group T1-T5: 变量声明 ─────────────────────────────────────

test('T1: isConsecutivePeacefulWitch 在 return 前声明', () => {
    expect(witchVarDeclBlock).toContain('isConsecutivePeacefulWitch');
});

test('T2: isConsecutivePeacefulWitch 使用 ctx.dayCount >= 3（区别于单夜的 > 1）', () => {
    expect(r92Block).toContain('ctx.dayCount >= 3');
});

test('T3: isConsecutivePeacefulWitch 使用 fullGameTimeline 检测 N-2 平安夜', () => {
    expect(r92Block).toContain('ctx.fullGameTimeline?.includes(');
    expect(r92Block).toContain('ctx.dayCount - 2}:平安夜');
});

test('T4: consecutivePeaceHintWitch 在 if (isPeacefulNightWitch) 块内声明', () => {
    const ifStart = witchVarDeclBlock.indexOf('if (isPeacefulNightWitch)');
    expect(ifStart).toBeGreaterThan(-1);
    const ifBlock = witchVarDeclBlock.slice(ifStart);
    expect(ifBlock).toContain('consecutivePeaceHintWitch');
});

test('T5: prevPrevDay 和 witchAntidoteHint 在 if (isPeacefulNightWitch) 块内声明', () => {
    const ifStart = witchVarDeclBlock.indexOf('if (isPeacefulNightWitch)');
    const ifBlock = witchVarDeclBlock.slice(ifStart);
    expect(ifBlock).toContain('const prevPrevDay = ctx.dayCount - 2');
    expect(ifBlock).toContain('witchAntidoteHint');
});

// ── Group T6-T10: 内容验证 ──────────────────────────────────

test('T6: consecutivePeaceHintWitch 含 ⭕ 标记和二阶推断标题', () => {
    expect(r92Block).toContain('⭕【女巫连续两夜平安夜二阶推断');
});

test('T7: 路径A（相同）含 confidence 升 25-35 指令', () => {
    expect(r92Block).toContain('confidence 升 25-35');
});

test('T8: 路径B（不同）含 confidence 均下调 10-15 指令', () => {
    expect(r92Block).toContain('confidence 均下调 10-15');
});

test('T9: 含 identity_table 追加两连平安夜标记指导', () => {
    expect(r92Block).toContain('两连平安夜');
    expect(r92Block).toContain('identity_table 追加');
});

test('T10: 路径A（相同）和路径B（不同）的描述均存在', () => {
    expect(r92Block).toContain('路径A（相同）');
    expect(r92Block).toContain('路径B（不同）');
});

// ── Group T11-T15: 注入位置 ──────────────────────────────────

test('T11: 路径A（解药已用）赋值以 ${consecutivePeaceHintWitch}⭕ 开头', () => {
    const ifStart = witchVarDeclBlock.indexOf('if (!hasWitchSave && witchHistory');
    expect(ifStart).toBeGreaterThan(-1);
    const pathABlock = witchVarDeclBlock.slice(ifStart, ifStart + 300);
    expect(pathABlock).toContain('`${consecutivePeaceHintWitch}⭕');
});

test('T12: 路径B（解药未用）赋值以 ${consecutivePeaceHintWitch}⭕ 开头', () => {
    const elseBStart = witchVarDeclBlock.indexOf('} else if (hasWitchSave)');
    expect(elseBStart).toBeGreaterThan(-1);
    const pathBBlock = witchVarDeclBlock.slice(elseBStart, elseBStart + 200);
    expect(pathBBlock).toContain('`${consecutivePeaceHintWitch}⭕');
});

test('T13: isConsecutivePeacefulWitch 声明在 if (isPeacefulNightWitch) 块之外（外层变量）', () => {
    const isConsecPos = witchVarDeclBlock.indexOf('isConsecutivePeacefulWitch');
    const ifStart = witchVarDeclBlock.indexOf('if (isPeacefulNightWitch)');
    expect(isConsecPos).toBeGreaterThan(-1);
    expect(ifStart).toBeGreaterThan(-1);
    expect(isConsecPos).toBeLessThan(ifStart);
});

test('T14: consecutivePeaceHintWitch 声明在 isPeacefulNightWitch 和路径A之间', () => {
    const hintPos = witchVarDeclBlock.indexOf('consecutivePeaceHintWitch =');
    const pathAPos = witchVarDeclBlock.indexOf('if (!hasWitchSave && witchHistory');
    expect(hintPos).toBeGreaterThan(-1);
    expect(pathAPos).toBeGreaterThan(-1);
    expect(hintPos).toBeLessThan(pathAPos);
});

test('T15: 声明顺序正确：isPeacefulNightWitch → isConsecutivePeacefulWitch → if块 → consecutivePeaceHintWitch', () => {
    const p1 = witchVarDeclBlock.indexOf('isPeacefulNightWitch');
    const p2 = witchVarDeclBlock.indexOf('isConsecutivePeacefulWitch');
    const p3 = witchVarDeclBlock.indexOf('if (isPeacefulNightWitch)');
    const p4 = witchVarDeclBlock.indexOf('consecutivePeaceHintWitch =');
    expect(p1).toBeLessThan(p2);
    expect(p2).toBeLessThan(p3);
    expect(p3).toBeLessThan(p4);
});

// ── Group T16-T20: 回归 ──────────────────────────────────────

test('T16: consecutivePeaceHintWitch 非连续时为空字符串 fallback（白熊效应兼容）', () => {
    // 三元表达式末尾为 `: ''`
    expect(r92Block).toContain(": ''");
});

test('T17: 连续推断步骤使用正向描述（白熊效应合规——无"不要展示"等负向禁词）', () => {
    expect(r92Block).not.toContain('不要展示');
    expect(r92Block).not.toContain('禁止说出');
    // 正向描述存在
    expect(r92Block).toContain('守卫极可能连守同一目标');
});

test('T18: witchAntidoteHint 使用 hasWitchSave 实现解药双轨分析', () => {
    expect(r92Block).toContain('witchAntidoteHint = hasWitchSave');
    // 两条分支均存在
    expect(r92Block).toContain('解药未动，两连平安夜均为守卫所为');
    expect(r92Block).toContain('解药已用且两连平安夜');
});

test('T19: isConsecutivePeacefulWitch 使用 >= 3，不使用单夜条件 > 1', () => {
    const consecPos = r92Block.indexOf('isConsecutivePeacefulWitch');
    const consecDeclBlock = r92Block.slice(consecPos, consecPos + 200);
    expect(consecDeclBlock).toContain('>= 3');
    expect(consecDeclBlock).not.toContain('> 1');
});

test('T20: R82 原始内容保留（isPeacefulNightWitch / 解药已使用 / 你解药未动）', () => {
    expect(witchVarDeclBlock).toContain('isPeacefulNightWitch');
    expect(witchVarDeclBlock).toContain('你的解药已使用');
    expect(witchVarDeclBlock).toContain('你解药未动');
    // 连续推断标记新增
    expect(witchVarDeclBlock).toContain('isConsecutivePeacefulWitch');
});
