/**
 * Round 95 tests: 女巫 witchAntidoteHint hasWitchSave=true 分支细化
 * （从"保留到守卫无法覆盖的关键时机"升级为可触发的双信号框架）
 *
 * T1-T5   变量/结构（R95 注释 / true 分支模板字面量 / confidence ≥ 95% / 触发信号①② / prevPrevDay+prevDay 插值）
 * T6-T10  内容验证（守卫双轮连守 / 今晚继续储药 / identity_table 追加指导 / false 分支保留 / 双信号文本存在）
 * T11-T15 注入位置/顺序（if 块内 / antidote 先于 consecutivePeaceHint / 旧文本消失 / 两分支结构）
 * T16-T20 回归（R92 路径A/B 保留 / 白熊效应合规 / R82 内容保留 / 解药未动文本存在 / 守卫换守失效正向描述）
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dirname, '../aiPrompts.js'), 'utf8');

// ── 定位女巫 DAY_SPEECH 函数 ──────────────────────────────────
const witchFuncMarkerIdx = src.lastIndexOf("'女巫': (ctx, params) => {");
// window 12000 — 女巫函数约 5700+ chars，大余量
const witchFuncBlock = src.slice(witchFuncMarkerIdx, witchFuncMarkerIdx + 12000);

const witchReturnIdx = witchFuncBlock.indexOf('return `');
const witchVarDeclBlock = witchFuncBlock.slice(0, witchReturnIdx);

// R95 区域：if (isPeacefulNightWitch) 块内，witchAntidoteHint 声明附近
const ifPeaceStart = witchVarDeclBlock.indexOf('if (isPeacefulNightWitch)');
const ifPeaceBlock = witchVarDeclBlock.slice(ifPeaceStart);

// R95 特定区域：R95 注释行开始
const r95Start = witchVarDeclBlock.indexOf('// R95');
const r95Block = witchVarDeclBlock.slice(r95Start, r95Start + 1200);

// ── Group T1-T5: 变量/结构 ─────────────────────────────────────

test('T1: R95 注释标记存在于女巫 DAY_SPEECH var block', () => {
    expect(witchVarDeclBlock).toContain('// R95');
});

test('T2: witchAntidoteHint hasWitchSave=true 分支使用模板字面量（含 ${prevPrevDay}+${prevDay}）', () => {
    // 模板字面量：反引号开头
    expect(r95Block).toContain('`解药未动，两连平安夜=守卫极可能连守同一目标（D${prevPrevDay}+D${prevDay}');
});

test('T3: hasWitchSave=true 分支含 confidence ≥ 95%', () => {
    expect(r95Block).toContain('confidence ≥ 95%');
});

test('T4: 含出手触发信号①（非平安夜且连守目标死亡）', () => {
    expect(r95Block).toContain('① 后续出现非平安夜且连守目标死亡');
});

test('T5: 含出手触发信号②（票压最高存活者换人）', () => {
    expect(r95Block).toContain('② 票压最高存活者换人');
});

// ── Group T6-T10: 内容验证 ──────────────────────────────────

test('T6: 守卫双轮连守标记文本存在（用于 identity_table 追加）', () => {
    expect(r95Block).toContain('双轮连守');
});

test('T7: "今晚继续储药" 指令存在（具体行动指导）', () => {
    expect(r95Block).toContain('今晚继续储药');
});

test('T8: identity_table 追加指导含"待①②信号出手"', () => {
    expect(r95Block).toContain('待①②信号出手');
});

test('T9: hasWitchSave=false 分支"解药已用且两连平安夜"内容保留', () => {
    // R92 false 分支不变
    expect(ifPeaceBlock).toContain('解药已用且两连平安夜');
    expect(ifPeaceBlock).toContain('savedIds 末位');
    expect(ifPeaceBlock).toContain('confidence 升至 90-95');
});

test('T10: 双触发信号均存在（①+②完整）', () => {
    // 两个信号编号都出现
    expect(r95Block).toContain('守卫换守失效');
    expect(r95Block).toContain('连守节奏被打破');
});

// ── Group T11-T15: 注入位置/顺序 ──────────────────────────────

test('T11: witchAntidoteHint 在 if (isPeacefulNightWitch) 块内声明', () => {
    expect(ifPeaceBlock).toContain('witchAntidoteHint = hasWitchSave');
});

test('T12: witchAntidoteHint 声明在 consecutivePeaceHintWitch 之前', () => {
    const antidotePos = ifPeaceBlock.indexOf('witchAntidoteHint = hasWitchSave');
    const conseqPos = ifPeaceBlock.indexOf('consecutivePeaceHintWitch =');
    expect(antidotePos).toBeGreaterThan(-1);
    expect(conseqPos).toBeGreaterThan(-1);
    expect(antidotePos).toBeLessThan(conseqPos);
});

test('T13: 旧文本"应保留到守卫无法覆盖的关键时机"不再出现（已被更精确描述替代）', () => {
    expect(ifPeaceBlock).not.toContain('应保留到守卫无法覆盖的关键时机');
});

test('T14: 旧文本"守卫正积极连守"不再出现（改为 confidence ≥ 95% 量化表达）', () => {
    expect(ifPeaceBlock).not.toContain('守卫正积极连守');
});

test('T15: hasWitchSave true/false 双分支结构存在（? ... : ...）', () => {
    const antidoteBlock = ifPeaceBlock.slice(
        ifPeaceBlock.indexOf('witchAntidoteHint = hasWitchSave'),
        ifPeaceBlock.indexOf('witchAntidoteHint = hasWitchSave') + 700
    );
    // true 分支有 confidence ≥ 95%
    expect(antidoteBlock).toContain('confidence ≥ 95%');
    // false 分支有 savedIds 末位
    expect(antidoteBlock).toContain('savedIds 末位');
});

// ── Group T16-T20: 回归 ──────────────────────────────────────

test('T16: R92 consecutivePeaceHintWitch 路径A/B 描述保留', () => {
    expect(witchVarDeclBlock).toContain('路径A（相同）');
    expect(witchVarDeclBlock).toContain('路径B（不同）');
    expect(witchVarDeclBlock).toContain('confidence 升 25-35');
    expect(witchVarDeclBlock).toContain('confidence 均下调 10-15');
});

test('T17: 白熊效应合规（正向触发信号描述，无负向禁词）', () => {
    expect(r95Block).not.toContain('不要出手');
    expect(r95Block).not.toContain('禁止使用');
    // 正向：有具体触发条件
    expect(r95Block).toContain('出手触发信号');
});

test('T18: R82 基本框架保留（isPeacefulNightWitch / 路径A解药已用 / 路径B解药未动）', () => {
    expect(witchVarDeclBlock).toContain('isPeacefulNightWitch');
    expect(witchVarDeclBlock).toContain('你的解药已使用');
    expect(witchVarDeclBlock).toContain('你解药未动');
});

test('T19: "解药未动" 文本仍存在于 hasWitchSave=true 分支头部', () => {
    expect(r95Block).toContain('解药未动');
});

test('T20: "守卫换守失效" 使用正向描述（不是"不要/禁止"等负向指令）', () => {
    // "守卫换守失效" 是对信号的正向描述，描述"发生了什么"而非"不要做什么"
    expect(r95Block).toContain('守卫换守失效');
    // 确认没有 "禁止" 等词
    expect(r95Block).not.toContain('禁止');
});
