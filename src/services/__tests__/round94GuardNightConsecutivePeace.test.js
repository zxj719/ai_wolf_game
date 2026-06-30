/**
 * Round 94 Tests: NIGHT_GUARD 守卫两连平安夜 NIGHT 侧二阶推断
 * T1-T20: 验证 isConsecutivePeacefulNightGuard + consecutivePeaceNightHintGuard 实现
 *
 * 对称关系：
 * - DAY 侧 R91：isConsecutivePeacefulGuard + consecutivePeaceHintGuard（ROLE_DAY_SPEECH_PROMPTS['守卫']）
 * - NIGHT 侧 R94：isConsecutivePeacefulNightGuard + consecutivePeaceNightHintGuard（NIGHT_GUARD case）
 *
 * 守卫 NIGHT 侧独特优势：gameState.guardHistory 直接记录每夜守护目标，零间接推断
 * 与 DAY 侧 R91 相同的数据来源（guardHistory），但 NIGHT 侧决策精度更高
 * （DAY 侧 R91 通过 params 读取；NIGHT 侧直接访问 gameState）
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(process.cwd(), 'src/services/aiPrompts.js'), 'utf-8');

function getNightGuardBlock() {
    const start = src.indexOf('case PROMPT_ACTIONS.NIGHT_GUARD: {');
    if (start === -1) throw new Error('NIGHT_GUARD case 未找到');
    // R94 后约 6181 chars，用 6500 留余量
    return src.slice(start, start + 6500);
}

const block = getNightGuardBlock();

// ═══════════════════════════════════════════════════════
// T1-T4: isConsecutivePeacefulNightGuard 声明与条件
// ═══════════════════════════════════════════════════════

test('T1: isConsecutivePeacefulNightGuard 变量在 NIGHT_GUARD case 中声明', () => {
    expect(block).toContain('isConsecutivePeacefulNightGuard');
});

test('T2: isConsecutivePeacefulNightGuard 使用 ctx.dayCount >= 3 条件', () => {
    const idx = block.indexOf('isConsecutivePeacefulNightGuard');
    const declSection = block.slice(idx, idx + 200);
    expect(declSection).toContain('ctx.dayCount >= 3');
});

test('T3: isConsecutivePeacefulNightGuard 使用 fullGameTimeline 检测历史平安夜', () => {
    const idx = block.indexOf('isConsecutivePeacefulNightGuard');
    const declSection = block.slice(idx, idx + 200);
    expect(declSection).toContain('ctx.fullGameTimeline');
    expect(declSection).toContain(':平安夜');
});

test('T4: isConsecutivePeacefulNightGuard 声明在 guardNightPeaceStep 之前', () => {
    const consIdx = block.indexOf('isConsecutivePeacefulNightGuard');
    const peaceStepIdx = block.indexOf('const guardNightPeaceStep');
    expect(consIdx).toBeGreaterThan(-1);
    expect(peaceStepIdx).toBeGreaterThan(-1);
    expect(consIdx).toBeLessThan(peaceStepIdx);
});

// ═══════════════════════════════════════════════════════
// T5-T6: prevPrevNightGuardTarget — 零间接推断（直接读 gameState.guardHistory）
// ═══════════════════════════════════════════════════════

test('T5: prevPrevNightGuardTarget 使用 gameState.guardHistory.find() 读取 N-2 守护目标', () => {
    const idx = block.indexOf('prevPrevNightGuardTarget');
    const declSection = block.slice(idx, idx + 200);
    expect(declSection).toContain('gameState.guardHistory');
    expect(declSection).toContain('guardNightPrevPrevDay');
    expect(declSection).toContain('targetId');
});

test('T6: guardNightPrevPrevDay = ctx.dayCount - 2（且有 >= 3 保护）', () => {
    const idx = block.indexOf('guardNightPrevPrevDay');
    const declSection = block.slice(idx, idx + 100);
    expect(declSection).toContain('ctx.dayCount - 2');
    expect(declSection).toContain('3');
});

// ═══════════════════════════════════════════════════════
// T7-T13: consecutivePeaceNightHintGuard 内容验证
// ═══════════════════════════════════════════════════════

test('T7: consecutivePeaceNightHintGuard 包含 ⭕【守卫两连平安夜 NIGHT 二阶推断', () => {
    expect(block).toContain('⭕【守卫两连平安夜 NIGHT 二阶推断');
});

test('T8: 两连推断标识头包含 thought 指令', () => {
    const hintStart = block.indexOf('⭕【守卫两连平安夜 NIGHT 二阶推断');
    const header = block.slice(hintStart, hintStart + 120);
    expect(header).toContain('thought');
});

test('T9: consecutivePeaceNightHintGuard 包含路径A（连守同一目标）', () => {
    const hintStart = block.indexOf('⭕【守卫两连平安夜 NIGHT 二阶推断');
    const content = block.slice(hintStart, hintStart + 600);
    expect(content).toContain('路径A');
    expect(content).toContain('连守同一目标');
});

test('T10: consecutivePeaceNightHintGuard 包含路径B（两夜目标不同）', () => {
    const hintStart = block.indexOf('⭕【守卫两连平安夜 NIGHT 二阶推断');
    const content = block.slice(hintStart, hintStart + 800);
    expect(content).toContain('路径B');
    expect(content).toContain('两夜目标不同');
});

test('T11: consecutivePeaceNightHintGuard 路径A 包含 confidence 升 25-35', () => {
    const hintStart = block.indexOf('⭕【守卫两连平安夜 NIGHT 二阶推断');
    const content = block.slice(hintStart, hintStart + 600);
    expect(content).toContain('confidence 升 25-35');
});

test('T12: consecutivePeaceNightHintGuard 引用 guardNightPrevPrevDay 和 cannotGuard 动态插值', () => {
    const hintStart = block.indexOf('⭕【守卫两连平安夜 NIGHT 二阶推断');
    const content = block.slice(hintStart, hintStart + 700);
    expect(content).toContain('${guardNightPrevPrevDay}');
    expect(content).toContain('${guardNightPrevDay}');
    expect(content).toContain('${cannotGuard}');
});

test('T13: consecutivePeaceNightHintGuard 包含 identity_table 追加指令（两连格式）', () => {
    const hintStart = block.indexOf('⭕【守卫两连平安夜 NIGHT 二阶推断');
    const content = block.slice(hintStart, hintStart + 900);
    expect(content).toContain('identity_table 追加');
    expect(content).toContain('两连平安夜');
    expect(content).toContain('[路径A连守/路径B轮守]');
});

// ═══════════════════════════════════════════════════════
// T14-T16: 与 guardNightPeaceStep 的集成（前置注入模式）
// ═══════════════════════════════════════════════════════

test('T14: guardNightPeaceStep 正值分支以 ${consecutivePeaceNightHintGuard} 前置拼接', () => {
    const peaceIdx = block.indexOf('const guardNightPeaceStep');
    const declSection = block.slice(peaceIdx, peaceIdx + 200);
    expect(declSection).toContain('${consecutivePeaceNightHintGuard}⭕【守卫平安夜守护来源推断');
});

test('T15: 原 R85 守卫平安夜推断内容完整保留（路径A/B + confidence 升15-25 + 追加）', () => {
    expect(block).toContain('⭕【守卫平安夜守护来源推断（thought 中完成）】');
    expect(block).toContain('[A连守/B换守]');
    expect(block).toContain('confidence 升15-25');
});

test('T16: consecutivePeaceNightHintGuard 条件为 isConsecutivePeacefulNightGuard && cannotGuard !== null', () => {
    const hintDeclIdx = block.indexOf('const consecutivePeaceNightHintGuard');
    const declSection = block.slice(hintDeclIdx, hintDeclIdx + 100);
    expect(declSection).toContain('isConsecutivePeacefulNightGuard');
    expect(declSection).toContain('cannotGuard !== null');
});

// ═══════════════════════════════════════════════════════
// T17: 白熊效应合规
// ═══════════════════════════════════════════════════════

test('T17: consecutivePeaceNightHintGuard 路径A/B 均为正向描述（白熊效应合规）', () => {
    const hintStart = block.indexOf('⭕【守卫两连平安夜 NIGHT 二阶推断');
    const content = block.slice(hintStart, hintStart + 900);
    expect(content).not.toContain('不要');
    expect(content).not.toContain('禁止');
    expect(content).not.toContain('绝不能');
});

// ═══════════════════════════════════════════════════════
// T18-T19: 块大小与窗口安全
// ═══════════════════════════════════════════════════════

test('T18: NIGHT_GUARD block R94 后在 5700-6500 chars 范围内', () => {
    const start = src.indexOf('case PROMPT_ACTIONS.NIGHT_GUARD: {');
    const end = src.indexOf('case PROMPT_ACTIONS.NIGHT_MAGICIAN:', start);
    const blockSize = end - start;
    expect(blockSize).toBeGreaterThan(5700);
    expect(blockSize).toBeLessThan(6500);
});

test('T19: 6500 窗口包含 identity_table 填写指导 和 数字或null(空守)（全覆盖验证）', () => {
    expect(block).toContain('identity_table 填写指导');
    expect(block).toContain('数字或null(空守)');
});

// ═══════════════════════════════════════════════════════
// T20: 回归验证
// ═══════════════════════════════════════════════════════

test('T20: 回归 — R73 guardNightStyle 7种风格 + R85 isNightPeacefulGuard 均完整保留', () => {
    expect(block).toContain('isNightPeacefulGuard');
    expect(block).toContain('guardNightPeaceStep');
    expect(block).toContain('主动探索型');
    expect(block).toContain('稳健连守型');
    expect(block).toContain('信息挖掘型');
    expect(block).toContain('博弈欺骗型');
    expect(block).toContain('直觉感知型');
    expect(block).toContain('反预判型');
    expect(block).toContain('平衡渐进型');
});
