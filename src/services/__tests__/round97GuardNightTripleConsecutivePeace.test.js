/**
 * Round 97 Tests: NIGHT_GUARD 守卫三连平安夜 NIGHT 侧三阶推断
 * T1-T20: 验证 isTripleConsecutivePeacefulNightGuard + tripleConsecutivePeaceNightHintGuard 实现
 *
 * 对称关系：
 * - NIGHT 侧 R94：isConsecutivePeacefulNightGuard（两连，dayCount >= 3）
 * - NIGHT 侧 R97：isTripleConsecutivePeacefulNightGuard（三连，dayCount >= 4）
 *
 * 三连推断独特价值：
 * - 三夜模式识别（A+A+A=锁守、A+A+B=高频+换、A+B+C=轮守）
 * - 路径A高频目标 confidence 升 30-40（高于两连 25-35）
 * - "前置注入"模式：tripleHint 前置于 consecutivePeaceNightHintGuard（R90/R91/R92 同构）
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(process.cwd(), 'src/services/aiPrompts.js'), 'utf-8');

function getNightGuardBlock() {
    const start = src.indexOf('case PROMPT_ACTIONS.NIGHT_GUARD: {');
    if (start === -1) throw new Error('NIGHT_GUARD case 未找到');
    // R97 后约 7761 chars，用 8500 留余量
    return src.slice(start, start + 8500);
}

const block = getNightGuardBlock();

// ═══════════════════════════════════════════════════════
// T1-T4: isTripleConsecutivePeacefulNightGuard 声明与条件
// ═══════════════════════════════════════════════════════

test('T1: isTripleConsecutivePeacefulNightGuard 变量在 NIGHT_GUARD case 中声明', () => {
    expect(block).toContain('isTripleConsecutivePeacefulNightGuard');
});

test('T2: isTripleConsecutivePeacefulNightGuard 使用 ctx.dayCount >= 4 条件', () => {
    const idx = block.indexOf('isTripleConsecutivePeacefulNightGuard');
    const declSection = block.slice(idx, idx + 200);
    expect(declSection).toContain('ctx.dayCount >= 4');
});

test('T3: isTripleConsecutivePeacefulNightGuard 检测 N(n-3):平安夜', () => {
    const idx = block.indexOf('isTripleConsecutivePeacefulNightGuard');
    const declSection = block.slice(idx, idx + 200);
    expect(declSection).toContain('ctx.fullGameTimeline');
    expect(declSection).toContain('ctx.dayCount - 3');
    expect(declSection).toContain(':平安夜');
});

test('T4: isTripleConsecutivePeacefulNightGuard 声明在 consecutivePeaceNightHintGuard 之前', () => {
    const tripleIdx = block.indexOf('isTripleConsecutivePeacefulNightGuard');
    const twoIdx = block.indexOf('const consecutivePeaceNightHintGuard');
    expect(tripleIdx).toBeGreaterThan(-1);
    expect(twoIdx).toBeGreaterThan(-1);
    expect(tripleIdx).toBeLessThan(twoIdx);
});

// ═══════════════════════════════════════════════════════
// T5-T6: threeNightGuardTarget — 零间接推断（直接读 gameState.guardHistory）
// ═══════════════════════════════════════════════════════

test('T5: threeNightGuardTarget 使用 gameState.guardHistory.find() 读取 N-3 守护目标', () => {
    const idx = block.indexOf('threeNightGuardTarget');
    const declSection = block.slice(idx, idx + 200);
    expect(declSection).toContain('gameState.guardHistory');
    expect(declSection).toContain('guardNightThreePrevDay');
    expect(declSection).toContain('targetId');
});

test('T6: guardNightThreePrevDay = ctx.dayCount - 3（且有 >= 4 保护）', () => {
    const idx = block.indexOf('guardNightThreePrevDay');
    const declSection = block.slice(idx, idx + 120);
    expect(declSection).toContain('ctx.dayCount - 3');
    expect(declSection).toContain('4');
});

// ═══════════════════════════════════════════════════════
// T7-T13: tripleConsecutivePeaceNightHintGuard 内容验证
// ═══════════════════════════════════════════════════════

test('T7: tripleConsecutivePeaceNightHintGuard 包含 ⭕【守卫三连平安夜 NIGHT 三阶推断', () => {
    expect(block).toContain('⭕【守卫三连平安夜 NIGHT 三阶推断');
});

test('T8: 三连推断标识头包含 thought 指令', () => {
    const hintStart = block.indexOf('⭕【守卫三连平安夜 NIGHT 三阶推断');
    const header = block.slice(hintStart, hintStart + 120);
    expect(header).toContain('thought');
});

test('T9: tripleConsecutivePeaceNightHintGuard 包含路径A（三夜锁守同目标）', () => {
    const hintStart = block.indexOf('⭕【守卫三连平安夜 NIGHT 三阶推断');
    const content = block.slice(hintStart, hintStart + 600);
    expect(content).toContain('路径A');
    expect(content).toContain('三夜锁守同目标');
});

test('T10: tripleConsecutivePeaceNightHintGuard 包含路径B（高频目标）', () => {
    const hintStart = block.indexOf('⭕【守卫三连平安夜 NIGHT 三阶推断');
    const content = block.slice(hintStart, hintStart + 800);
    expect(content).toContain('路径B');
    expect(content).toContain('高频目标');
});

test('T11: tripleConsecutivePeaceNightHintGuard 包含路径C（三夜全不同目标）', () => {
    const hintStart = block.indexOf('⭕【守卫三连平安夜 NIGHT 三阶推断');
    const content = block.slice(hintStart, hintStart + 1000);
    expect(content).toContain('路径C');
    expect(content).toContain('三夜全不同目标');
});

test('T12: tripleConsecutivePeaceNightHintGuard 路径B 包含 confidence 升 30-40（高于两连 25-35）', () => {
    const hintStart = block.indexOf('⭕【守卫三连平安夜 NIGHT 三阶推断');
    const content = block.slice(hintStart, hintStart + 900);
    expect(content).toContain('confidence 升 30-40');
});

test('T13: tripleConsecutivePeaceNightHintGuard 引用三夜动态插值变量', () => {
    const hintStart = block.indexOf('⭕【守卫三连平安夜 NIGHT 三阶推断');
    const content = block.slice(hintStart, hintStart + 1000);
    expect(content).toContain('${guardNightThreePrevDay}');
    expect(content).toContain('${guardNightPrevPrevDay}');
    expect(content).toContain('${guardNightPrevDay}');
});

// ═══════════════════════════════════════════════════════
// T14-T16: 前置注入模式 + identity_table 追加
// ═══════════════════════════════════════════════════════

test('T14: consecutivePeaceNightHintGuard 正值分支以 ${tripleConsecutivePeaceNightHintGuard} 前置拼接', () => {
    const twoHintIdx = block.indexOf('const consecutivePeaceNightHintGuard');
    const declSection = block.slice(twoHintIdx, twoHintIdx + 200);
    expect(declSection).toContain('${tripleConsecutivePeaceNightHintGuard}');
    expect(declSection).toContain('⭕【守卫两连平安夜 NIGHT 二阶推断');
});

test('T15: tripleConsecutivePeaceNightHintGuard 包含 identity_table 三连格式追加指令', () => {
    const hintStart = block.indexOf('⭕【守卫三连平安夜 NIGHT 三阶推断');
    const content = block.slice(hintStart, hintStart + 1100);
    expect(content).toContain('identity_table 追加');
    expect(content).toContain('三连平安');
    expect(content).toContain('[路径A锁守/路径B高频/路径C轮守]');
});

test('T16: tripleConsecutivePeaceNightHintGuard 条件包含 isTripleConsecutivePeacefulNightGuard && cannotGuard !== null', () => {
    const tripleHintDeclIdx = block.indexOf('const tripleConsecutivePeaceNightHintGuard');
    const declSection = block.slice(tripleHintDeclIdx, tripleHintDeclIdx + 120);
    expect(declSection).toContain('isTripleConsecutivePeacefulNightGuard');
    expect(declSection).toContain('cannotGuard !== null');
});

// ═══════════════════════════════════════════════════════
// T17: 白熊效应合规
// ═══════════════════════════════════════════════════════

test('T17: tripleConsecutivePeaceNightHintGuard 路径A/B/C 均为正向描述（白熊效应合规）', () => {
    const hintStart = block.indexOf('⭕【守卫三连平安夜 NIGHT 三阶推断');
    const content = block.slice(hintStart, hintStart + 1100);
    expect(content).not.toContain('不要');
    expect(content).not.toContain('禁止');
    expect(content).not.toContain('绝不能');
});

// ═══════════════════════════════════════════════════════
// T18-T19: 块大小与窗口安全
// ═══════════════════════════════════════════════════════

test('T18: NIGHT_GUARD block R97 后在 7000-8500 chars 范围内', () => {
    const start = src.indexOf('case PROMPT_ACTIONS.NIGHT_GUARD: {');
    const end = src.indexOf('case PROMPT_ACTIONS.NIGHT_MAGICIAN:', start);
    const blockSize = end - start;
    expect(blockSize).toBeGreaterThan(7000);
    expect(blockSize).toBeLessThan(8500);
});

test('T19: 8500 窗口包含三连推断 + 两连推断 + 单夜推断全部内容（全覆盖验证）', () => {
    expect(block).toContain('⭕【守卫三连平安夜 NIGHT 三阶推断');
    expect(block).toContain('⭕【守卫两连平安夜 NIGHT 二阶推断');
    expect(block).toContain('⭕【守卫平安夜守护来源推断（thought 中完成）】');
    expect(block).toContain('identity_table 填写指导');
});

// ═══════════════════════════════════════════════════════
// T20: 回归验证
// ═══════════════════════════════════════════════════════

test('T20: 回归 — R73/R85/R94 所有关键变量完整保留', () => {
    expect(block).toContain('isNightPeacefulGuard');
    expect(block).toContain('isConsecutivePeacefulNightGuard');
    expect(block).toContain('guardNightPeaceStep');
    expect(block).toContain('consecutivePeaceNightHintGuard');
    expect(block).toContain('prevPrevNightGuardTarget');
    expect(block).toContain('guardNightStyle');
    expect(block).toContain('主动探索型');
    expect(block).toContain('稳健连守型');
});
