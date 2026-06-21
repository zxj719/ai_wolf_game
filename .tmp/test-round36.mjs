/**
 * Round 36 Tests — 女巫/猎人 PK 专属框架
 *
 * 验证 aiPrompts.js pkHint 块：
 * - 女巫：4 种药量状态各自触发正确的专属文案（双药/仅解/仅毒/无药）
 * - 猎人：隐性路线 vs 明示路线双维度框架
 * - 通用框架回归（三要点保留）
 * - R15/R18 代码规范合规
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dirname, '../src/services/aiPrompts.js'), 'utf-8');

let pass = 0;
let fail = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`✅ ${name}`);
        pass++;
    } catch (e) {
        console.error(`❌ ${name}: ${e.message}`);
        fail++;
    }
}

function assert(cond, msg) {
    if (!cond) throw new Error(msg || 'assertion failed');
}

// ─────────────────────────────────────────────────
// 提取 pkHint 块 (else if/else chain after 守卫 block)
// ─────────────────────────────────────────────────
const pkHintStart = src.indexOf("// PK 辩护模式注入");
assert(pkHintStart !== -1, 'pkHint block not found');
const pkHintBlock = src.slice(pkHintStart, src.indexOf('\n            // 警长身份注入', pkHintStart));

// 找女巫专属块
const witchBlockStart = pkHintBlock.indexOf("} else if (playerRole === '女巫')");
const hunterBlockStart = pkHintBlock.indexOf("} else if (playerRole === '猎人')");
const genericBlockStart = pkHintBlock.lastIndexOf("} else {");

const witchBlock = witchBlockStart !== -1 ? pkHintBlock.slice(witchBlockStart, hunterBlockStart) : '';
const hunterBlock = hunterBlockStart !== -1 ? pkHintBlock.slice(hunterBlockStart, genericBlockStart) : '';
const genericBlock = genericBlockStart !== -1 ? pkHintBlock.slice(genericBlockStart) : '';

// ─────────────────────────────────────────────────
// T1-T3: 基本结构检查
// ─────────────────────────────────────────────────
test('T1: pkHint 使用 let + if 多分支块（R15 规范）', () => {
    assert(pkHintBlock.includes("let pkHint = '';"), 'let pkHint 未找到');
    assert(pkHintBlock.includes("if (roleParams.pkMode)"), 'pkMode 检查未找到');
});

test('T2: 女巫专属分支存在', () => {
    assert(witchBlockStart !== -1, '女巫 else if 分支未找到');
    assert(witchBlock.includes('女巫专属框架'), '女巫专属框架标题未找到');
});

test('T3: 猎人专属分支存在', () => {
    assert(hunterBlockStart !== -1, '猎人 else if 分支未找到');
    assert(hunterBlock.includes('猎人专属框架'), '猎人专属框架标题未找到');
});

// ─────────────────────────────────────────────────
// T4-T8: 女巫专属框架内容
// ─────────────────────────────────────────────────
test('T4: 女巫 — 双药（hasSave && hasPoison）分支内容正确', () => {
    assert(witchBlock.includes('解药和毒药均未使用'), '双药分支文案未找到');
});

test('T5: 女巫 — 仅解药（hasSave, !hasPoison）分支内容正确', () => {
    assert(witchBlock.includes('解药尚存'), '仅解药分支文案未找到');
    assert(witchBlock.includes('救人记录'), '救人记录提示未找到');
    assert(witchBlock.includes('信任锚点'), '信任锚点概念未找到');
});

test('T6: 女巫 — 仅毒药（!hasSave, hasPoison）分支内容正确', () => {
    assert(witchBlock.includes('毒药尚存'), '仅毒药分支文案未找到');
    assert(witchBlock.includes('定向消灭'), '定向消灭价值说明未找到');
});

test('T7: 女巫 — 双药已用（!hasSave && !hasPoison）分支内容正确', () => {
    assert(witchBlock.includes('双药已用'), '双药已用分支文案未找到');
    assert(witchBlock.includes('聚焦逻辑辩护'), '纯逻辑辩护指导未找到');
});

test('T8: 女巫框架包含通用要求：新论点 + 直接回应对手', () => {
    assert(witchBlock.includes('新论点'), '新论点要求未找到');
    assert(witchBlock.includes('直接回应对手'), '直接回应对手指导未找到');
});

// ─────────────────────────────────────────────────
// T9-T14: 猎人专属框架内容
// ─────────────────────────────────────────────────
test('T9: 猎人框架包含维度A（隐性路线）', () => {
    assert(hunterBlock.includes('维度A') || hunterBlock.includes('维度A（隐性路线'), '维度A隐性路线未找到');
    assert(hunterBlock.includes('隐性路线'), '隐性路线说明未找到');
});

test('T10: 猎人框架包含维度B（明示路线）', () => {
    assert(hunterBlock.includes('维度B') || hunterBlock.includes('维度B（明示路线'), '维度B明示路线未找到');
    assert(hunterBlock.includes('明示路线'), '明示路线说明未找到');
});

test('T11: 猎人框架包含在 thought 中选择的指导（不预设路线）', () => {
    assert(hunterBlock.includes('thought'), 'thought 决策指导未找到');
    assert(hunterBlock.includes('选择'), '选择指导未找到');
});

test('T12: 猎人框架包含新论点要求', () => {
    assert(hunterBlock.includes('新论点'), '新论点要求未找到');
    assert(hunterBlock.includes('说服力归零') || hunterBlock.includes('重复旧话'), '重复内容警告未找到');
});

test('T13: 猎人框架维度A提到"嫌疑玩家"场景', () => {
    assert(hunterBlock.includes('嫌疑玩家'), '嫌疑玩家场景指导未找到');
});

test('T14: 猎人框架维度B提到"明确好人"决策条件', () => {
    assert(hunterBlock.includes('明确好人') || hunterBlock.includes('对手是明确好人'), '明确好人判断条件未找到');
});

// ─────────────────────────────────────────────────
// T15-T18: 通用框架回归（三要点完整保留）
// ─────────────────────────────────────────────────
test('T15: 通用框架第一要点（新论点）保留', () => {
    assert(genericBlock.includes('提供新论点'), '通用框架新论点要点缺失');
});

test('T16: 通用框架第二要点（直接回应/质疑）保留', () => {
    assert(genericBlock.includes('直接回应或质疑'), '通用框架直接回应要点缺失');
});

test('T17: 通用框架第三要点（存活价值）保留', () => {
    assert(genericBlock.includes('明确陈述你存活的价值'), '通用框架存活价值要点缺失');
});

test('T18: 通用框架标题包含"PK 辩护模式（平票决赛）"', () => {
    assert(genericBlock.includes('PK 辩护模式（平票决赛）'), '通用框架标题格式变化');
    // 通用框架不应包含"专属框架"字样
    const genericCore = genericBlock.slice(0, 500);
    assert(!genericCore.includes('专属框架'), '通用框架误含"专属框架"');
});

// ─────────────────────────────────────────────────
// T19-T21: R18 防范（无内联三元/boolean 插值）
// ─────────────────────────────────────────────────
test('T19: 女巫块使用 let witchMedLine + if 而非内联三元（R18）', () => {
    assert(witchBlock.includes('let witchMedLine'), 'witchMedLine 变量声明未找到');
    // 确保 witchMedLine 是预先计算的，不是内联三元
    const templateLineIdx = witchBlock.indexOf('${witchMedLine}');
    assert(templateLineIdx !== -1, '${witchMedLine} 模板插值未找到');
    // 检查模板插值行附近没有三元运算符（witchMedLine 本身不含 ? : ）
    const aroundTemplate = witchBlock.slice(Math.max(0, templateLineIdx - 20), templateLineIdx + 20);
    assert(!aroundTemplate.includes('?') || !aroundTemplate.includes(':'),
        '模板插值位置检测到内联三元（违反R18）');
});

test('T20: 女巫块四个 if/else if/else 分支结构完整', () => {
    // 检查 if (hasSave && hasPoison) 开头的多分支
    assert(witchBlock.includes('if (hasSave && hasPoison)'), 'hasSave && hasPoison 分支未找到');
    assert(witchBlock.includes('} else if (hasSave)'), '仅解药 else if 分支未找到');
    assert(witchBlock.includes('} else if (hasPoison)'), '仅毒药 else if 分支未找到');
    // 双药已用 else 分支
    const elseCount = (witchBlock.match(/\} else \{/g) || []).length;
    assert(elseCount >= 1, '双药已用 else 分支未找到');
});

test('T21: 各专属分支互斥（女巫/猎人/通用顺序正确）', () => {
    assert(witchBlockStart < hunterBlockStart, '女巫分支应在猎人分支之前');
    assert(hunterBlockStart < genericBlockStart, '猎人分支应在通用分支之前');
});

// ─────────────────────────────────────────────────
// T22-T28: 逻辑模拟验证
// ─────────────────────────────────────────────────

// 模拟 witchMedLine 逻辑（无需 import，直接模拟条件）
function getWitchMedLine(hasSave, hasPoison) {
    if (hasSave && hasPoison) {
        return '解药和毒药均未使用';
    } else if (hasSave) {
        return '解药尚存';
    } else if (hasPoison) {
        return '毒药尚存';
    } else {
        return '双药已用';
    }
}

test('T22: 模拟 — 双药（true,true）→ "解药和毒药均未使用"', () => {
    assert(getWitchMedLine(true, true).includes('解药和毒药均未使用'), '双药状态匹配错误');
});

test('T23: 模拟 — 仅解药（true,false）→ "解药尚存"', () => {
    assert(getWitchMedLine(true, false).includes('解药尚存'), '仅解药状态匹配错误');
    assert(!getWitchMedLine(true, false).includes('毒药'), '仅解药状态不应含毒药文字');
});

test('T24: 模拟 — 仅毒药（false,true）→ "毒药尚存"', () => {
    assert(getWitchMedLine(false, true).includes('毒药尚存'), '仅毒药状态匹配错误');
    assert(!getWitchMedLine(false, true).includes('解药尚存'), '仅毒药状态不应含解药文字');
});

test('T25: 模拟 — 双药已用（false,false）→ "双药已用"', () => {
    assert(getWitchMedLine(false, false).includes('双药已用'), '双药已用状态匹配错误');
});

test('T26: 模拟 — undefined 参数视为 falsy，走"双药已用"分支', () => {
    const result = getWitchMedLine(undefined, undefined);
    assert(result.includes('双药已用'), 'undefined 参数应走双药已用分支');
});

test('T27: 猎人框架对"嫌疑玩家"和"明确好人"的判断条件是对称的决策树', () => {
    // 维度A提到嫌疑玩家（隐性），维度B提到明确好人（明示）
    const hasA = hunterBlock.includes('嫌疑玩家');
    const hasB = hunterBlock.includes('明确好人') || hunterBlock.includes('对手是明确好人');
    assert(hasA && hasB, `对称决策树不完整: A=${hasA}, B=${hasB}`);
});

test('T28: 女巫分支从 roleParams 读取 hasWitchSave 和 hasWitchPoison', () => {
    assert(witchBlock.includes('roleParams.hasWitchSave'), 'hasWitchSave 读取未找到');
    assert(witchBlock.includes('roleParams.hasWitchPoison'), 'hasWitchPoison 读取未找到');
});

// ─────────────────────────────────────────────────
// 结果
// ─────────────────────────────────────────────────
console.log(`\n总计：${pass + fail} tests，${pass} passed，${fail} failed`);
if (fail > 0) process.exit(1);
