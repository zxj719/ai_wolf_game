/**
 * R98: 预言家 NIGHT 侧平安夜三级推断框架测试
 *
 * 本轮新增：NIGHT_SEER case 中的平安夜查验优先级调整（三个层级）
 *
 * 背景：NIGHT_GUARD 已在 R85（单夜）→ R94（两连）→ R97（三连）建立完整推断体系。
 * 预言家 NIGHT 侧此前完全缺失平安夜处理，本轮补全对应的三级框架：
 *   - 单夜（isNightPeacefulSeer）：用 identity_table confidence ≥ 65 间接推断狼刀目标
 *   - 两连（isConsecutivePeacefulNightSeer）：两天高票存活者交叉验证
 *   - 三连（isTripleConsecutivePeacefulNightSeer）：三天连续高票存活者近确认关键好人
 *
 * 推断精度层级（与 R97 LEARNINGS 对称）：
 *   守卫 NIGHT（零间接，guardHistory 直读）> 预言家 NIGHT（一阶间接，confidence≥65）> 村民 DAY（二阶间接，纯票压）
 *
 * 测试矩阵（T1-T20）：
 * T1      NIGHT_SEER case 可定位
 * T2      isNightPeacefulSeer 变量存在且条件正确（dayCount > 1 && lastNightInfo 含平安夜）
 * T3      isConsecutivePeacefulNightSeer 条件包含 dayCount >= 3 和 fullGameTimeline 检测
 * T4      isTripleConsecutivePeacefulNightSeer 条件包含 dayCount >= 4 和 fullGameTimeline 检测
 * T5      seerNightPrevDay 变量存在（dayCount > 1 ? dayCount - 1 : 0）
 * T6      seerNightPrevPrevDay 变量存在（dayCount >= 3 ? dayCount - 2 : 0）
 * T7      seerNightThreePrevDay 变量存在（dayCount >= 4 ? dayCount - 3 : 0）
 * T8      seerNightPeaceStep：非平安夜时为空字符串（向下兼容）
 * T9      seerNightPeaceStep：激活时包含 confidence ≥ 65 路径A/B 框架
 * T10     consecutivePeaceNightHintSeer：两连激活时包含路径A/路径B（两天高票存活者交叉验证）
 * T11     tripleConsecutivePeaceNightHintSeer：三连激活时包含路径A/B/C
 * T12     三级嵌套注入顺序：三连 → 两连 → 单夜（前置注入模式）
 * T13     seerNightPeaceStep 注入位置：在 seerNightStyle 之后、seerNightStrategy 之前
 * T14     白熊效应合规：平安夜推断文本无"不要""禁止""绝不能"等负向禁词
 * T15     单夜推断仅触发 seerNightPeaceStep，不触发两连/三连块（dayCount == 2 时）
 * T16     两连不触发三连块（dayCount == 3 时）
 * T17     fullGameTimeline 检测格式：使用模板字符串 N${ctx.dayCount - 2}:平安夜 等
 * T18     R98 推断精度注释存在（精度层级说明）
 * T19     回归——round75 seerNightStyle 7 种风格仍然完整（R75 内容未被破坏）
 * T20     回归——seerHistoryStep 和输出 schema 仍然完整
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve('src/services/aiPrompts.js'), 'utf8');

// ── 定位 NIGHT_SEER block ──────────────────────────────────────────────────
function getNightSeerBlock() {
    const start = src.indexOf('case PROMPT_ACTIONS.NIGHT_SEER:');
    if (start === -1) throw new Error('NIGHT_SEER case 未找到');
    // R98 后 block 约 7686 chars，用 9200 留余量
    return src.slice(start, start + 9200);
}

// ═══════════════════════════════════════════════════════
// T1: case 可定位
// ═══════════════════════════════════════════════════════

test('T1: NIGHT_SEER case 可定位', () => {
    expect(src.indexOf('case PROMPT_ACTIONS.NIGHT_SEER:')).toBeGreaterThan(0);
});

// ═══════════════════════════════════════════════════════
// T2-T7: 变量声明正确性
// ═══════════════════════════════════════════════════════

test('T2: isNightPeacefulSeer 条件正确（dayCount > 1 + lastNightInfo 含平安夜）', () => {
    const block = getNightSeerBlock();
    expect(block).toContain('isNightPeacefulSeer');
    expect(block).toContain('ctx.lastNightInfo?.includes(\'平安夜\')');
    // 条件应含 dayCount > 1
    const decl = block.match(/const isNightPeacefulSeer\s*=\s*(.+)/)?.[1] || '';
    expect(decl).toContain('ctx.dayCount > 1');
});

test('T3: isConsecutivePeacefulNightSeer 条件包含 dayCount >= 3 和 fullGameTimeline 检测', () => {
    const block = getNightSeerBlock();
    expect(block).toContain('isConsecutivePeacefulNightSeer');
    const idx = block.indexOf('isConsecutivePeacefulNightSeer');
    const declLine = block.slice(idx, idx + 200);
    expect(declLine).toContain('ctx.dayCount >= 3');
    expect(declLine).toContain('ctx.fullGameTimeline?.includes');
});

test('T4: isTripleConsecutivePeacefulNightSeer 条件包含 dayCount >= 4 和 fullGameTimeline 检测', () => {
    const block = getNightSeerBlock();
    expect(block).toContain('isTripleConsecutivePeacefulNightSeer');
    const idx = block.indexOf('isTripleConsecutivePeacefulNightSeer');
    const declLine = block.slice(idx, idx + 200);
    expect(declLine).toContain('ctx.dayCount >= 4');
    expect(declLine).toContain('ctx.fullGameTimeline?.includes');
});

test('T5: seerNightPrevDay 变量存在（dayCount > 1 ? dayCount - 1 : 0）', () => {
    const block = getNightSeerBlock();
    expect(block).toContain('seerNightPrevDay');
    const decl = block.match(/const seerNightPrevDay\s*=\s*(.+)/)?.[1] || '';
    expect(decl).toContain('ctx.dayCount - 1');
});

test('T6: seerNightPrevPrevDay 变量存在（dayCount >= 3 ? dayCount - 2 : 0）', () => {
    const block = getNightSeerBlock();
    expect(block).toContain('seerNightPrevPrevDay');
    const decl = block.match(/const seerNightPrevPrevDay\s*=\s*(.+)/)?.[1] || '';
    expect(decl).toContain('ctx.dayCount - 2');
});

test('T7: seerNightThreePrevDay 变量存在（dayCount >= 4 ? dayCount - 3 : 0）', () => {
    const block = getNightSeerBlock();
    expect(block).toContain('seerNightThreePrevDay');
    const decl = block.match(/const seerNightThreePrevDay\s*=\s*(.+)/)?.[1] || '';
    expect(decl).toContain('ctx.dayCount - 3');
});

// ═══════════════════════════════════════════════════════
// T8-T11: 内容框架正确性
// ═══════════════════════════════════════════════════════

test('T8: seerNightPeaceStep 非平安夜时为空字符串（向下兼容）', () => {
    const block = getNightSeerBlock();
    // 三元表达式末尾应有 ': \'\'' 或者在 seerNightPeaceStep 定义中用三元表达式且有非激活分支
    const seerPeaceIdx = block.indexOf('const seerNightPeaceStep = isNightPeacefulSeer');
    expect(seerPeaceIdx).toBeGreaterThan(0);
    const peaceDecl = block.slice(seerPeaceIdx, seerPeaceIdx + 2000);
    // 非平安夜分支应返回空字符串
    expect(peaceDecl).toContain(': \'\'');
});

test('T9: seerNightPeaceStep 激活时包含 confidence ≥ 65 路径A/路径B 框架', () => {
    const block = getNightSeerBlock();
    expect(block).toContain('confidence ≥ 65');
    expect(block).toContain('路径A：存在 confidence ≥ 65');
    expect(block).toContain('路径B：无 confidence ≥ 65');
});

test('T10: consecutivePeaceNightHintSeer 两连时包含路径A/路径B（两天高票存活者交叉验证）', () => {
    const block = getNightSeerBlock();
    expect(block).toContain('consecutivePeaceNightHintSeer');
    const idx = block.indexOf('consecutivePeaceNightHintSeer');
    const section = block.slice(idx, idx + 1500);
    expect(section).toContain('两天高票存活者相同');
    expect(section).toContain('两天高票存活者不同');
    // 应有两连激活条件
    expect(section).toContain('isConsecutivePeacefulNightSeer');
});

test('T11: tripleConsecutivePeaceNightHintSeer 三连时包含路径A/B/C', () => {
    const block = getNightSeerBlock();
    expect(block).toContain('tripleConsecutivePeaceNightHintSeer');
    const idx = block.indexOf('tripleConsecutivePeaceNightHintSeer');
    const section = block.slice(idx, idx + 1500);
    expect(section).toContain('路径A');
    expect(section).toContain('路径B');
    expect(section).toContain('路径C');
    // 三连激活条件
    expect(section).toContain('isTripleConsecutivePeacefulNightSeer');
});

// ═══════════════════════════════════════════════════════
// T12-T13: 注入顺序
// ═══════════════════════════════════════════════════════

test('T12: 三级嵌套注入顺序正确：tripleHint → consecutiveHint → seerNightPeaceStep（前置注入模式）', () => {
    const block = getNightSeerBlock();
    // tripleConsecutivePeaceNightHintSeer 应在 consecutivePeaceNightHintSeer 赋值的正值分支内出现
    const consIdx = block.indexOf('const consecutivePeaceNightHintSeer');
    const consSection = block.slice(consIdx, consIdx + 200);
    expect(consSection).toContain('tripleConsecutivePeaceNightHintSeer');
    // consecutivePeaceNightHintSeer 应在 seerNightPeaceStep 赋值内出现
    const peaceIdx = block.indexOf('const seerNightPeaceStep = isNightPeacefulSeer');
    const peaceSection = block.slice(peaceIdx, peaceIdx + 200);
    expect(peaceSection).toContain('consecutivePeaceNightHintSeer');
});

test('T13: seerNightPeaceStep 在 return 模板中位于 seerNightStyle 之后、seerNightStrategy 之前', () => {
    const block = getNightSeerBlock();
    const styleInject = block.indexOf('${seerNightStyle}');
    const peaceInject = block.indexOf('${seerNightPeaceStep}');
    const strategyInject = block.indexOf('${seerNightStrategy}');
    expect(styleInject).toBeGreaterThan(0);
    expect(peaceInject).toBeGreaterThan(0);
    expect(strategyInject).toBeGreaterThan(0);
    expect(peaceInject).toBeGreaterThan(styleInject);
    expect(peaceInject).toBeLessThan(strategyInject);
});

// ═══════════════════════════════════════════════════════
// T14: 白熊效应合规
// ═══════════════════════════════════════════════════════

test('T14: 平安夜推断文本无"不要""禁止""绝不能"等负向禁词（白熊效应合规）', () => {
    const block = getNightSeerBlock();
    const peaceStart = block.indexOf('R98: NIGHT_SEER 平安夜查验优先级调整框架');
    const peaceSection = block.slice(peaceStart, peaceStart + 4000);
    expect(peaceSection).not.toContain('不要查');
    expect(peaceSection).not.toContain('禁止');
    expect(peaceSection).not.toContain('绝不能');
    // 应包含正向描述
    expect(peaceSection).toContain('今晚查验首选该候选');
    expect(peaceSection).toContain('按下方优先级框架正常选择');
});

// ═══════════════════════════════════════════════════════
// T15-T16: 层级隔离
// ═══════════════════════════════════════════════════════

test('T15: 单夜变量不依赖两连/三连条件（isNightPeacefulSeer 独立于 isConsecutive/isTriple）', () => {
    const block = getNightSeerBlock();
    // isNightPeacefulSeer 应在 isConsecutivePeacefulNightSeer 之前声明
    const singleIdx = block.indexOf('const isNightPeacefulSeer');
    const twoIdx = block.indexOf('const isConsecutivePeacefulNightSeer');
    const threeIdx = block.indexOf('const isTripleConsecutivePeacefulNightSeer');
    expect(singleIdx).toBeGreaterThan(0);
    expect(twoIdx).toBeGreaterThan(singleIdx);
    expect(threeIdx).toBeGreaterThan(twoIdx);
});

test('T16: 两连推断引用 isConsecutivePeacefulNightSeer，三连引用 isTripleConsecutivePeacefulNightSeer（层级正确）', () => {
    const block = getNightSeerBlock();
    // consecutivePeaceNightHintSeer 的三元条件应检查 isConsecutivePeacefulNightSeer
    const consDecl = block.match(/const consecutivePeaceNightHintSeer\s*=\s*(\w+)/)?.[1] || '';
    expect(consDecl).toBe('isConsecutivePeacefulNightSeer');
    // tripleConsecutivePeaceNightHintSeer 的三元条件应检查 isTripleConsecutivePeacefulNightSeer
    const tripleDecl = block.match(/const tripleConsecutivePeaceNightHintSeer\s*=\s*(\w+)/)?.[1] || '';
    expect(tripleDecl).toBe('isTripleConsecutivePeacefulNightSeer');
});

// ═══════════════════════════════════════════════════════
// T17: fullGameTimeline 检测格式
// ═══════════════════════════════════════════════════════

test('T17: fullGameTimeline 检测使用正确的模板字符串格式（N${dayCount - 2}:平安夜）', () => {
    const block = getNightSeerBlock();
    // 两连：N${ctx.dayCount - 2}:平安夜
    expect(block).toContain('N${ctx.dayCount - 2}:平安夜');
    // 三连：N${ctx.dayCount - 3}:平安夜
    expect(block).toContain('N${ctx.dayCount - 3}:平安夜');
});

// ═══════════════════════════════════════════════════════
// T18: 精度层级注释存在
// ═══════════════════════════════════════════════════════

test('T18: 推断精度层级注释存在（说明 NIGHT_SEER 精度低于 NIGHT_GUARD 但高于村民 DAY）', () => {
    const block = getNightSeerBlock();
    expect(block).toContain('精度层级');
    // 或包含精度层级对比信息
    expect(block).toContain('一阶间接');
});

// ═══════════════════════════════════════════════════════
// T19-T20: 回归
// ═══════════════════════════════════════════════════════

test('T19: 回归——round75 seerNightStyle 7 种风格仍然完整（R75 内容未被破坏）', () => {
    const block = getNightSeerBlock();
    const styles = ['主动威胁型', '边缘安全型', '推理优化型', '情报迷雾型', '直觉导向型', '反预判型', '平衡渐进型'];
    styles.forEach(style => {
        expect(block).toContain(style);
    });
    // seerNightStyle 仍在 return 模板中注入
    expect(block).toContain('${seerNightStyle}');
});

test('T20: 回归——seerHistoryStep 和输出 schema 仍然完整（R41/R75 基础功能未破坏）', () => {
    const block = getNightSeerBlock();
    expect(block).toContain('seerHistoryStep');
    expect(block).toContain('排队查验优先级');
    expect(block).toContain('"targetId"');
    expect(block).toContain('"reasoning"');
    expect(block).toContain('"thought"');
    expect(block).toContain('"identity_table"');
});
