/**
 * Round 85: NIGHT_GUARD 守卫平安夜守护来源推断框架（guardNightPeaceStep）
 *
 * T1      isNightPeacefulGuard 变量声明存在
 * T2      guardNightPrevDay 变量声明存在
 * T3      guardNightPeaceStep 变量声明存在
 * T4      条件：dayCount > 1 && lastNightInfo?.includes('平安夜')
 * T5      非平安夜 fallback：guardNightPeaceStep 为空字符串
 * T6      ⭕ 标记存在（thought 约束正向限定）
 * T7      路径A：票压高 → 成功拦截 → 连守 → confidence 升15-25
 * T8      路径B：票压低 → 狼刀在别处 → 切换次高候选
 * T9      identity_table 追记：追加"平安夜：[A连守/B换守]"
 * T10     thought 约束：用"thought 中完成"正向限定，无负向禁词
 * T11     注入位置：${guardNightPeaceStep} 在 ${guardNightStyle} 之后
 * T12     注入位置：${guardNightPeaceStep} 在 "1. 【守护优先级】" 之前
 * T13     动态 prevDay：引用 guardNightPrevDay（非硬编码数字）
 * T14     查 identity_table 含"夜守护"的玩家（Step ①）
 * T15     查系统提示游戏时间线投票记录（Step ②）
 * T16     回归：D1 安全 —— dayCount=1 时 isNightPeacefulGuard 为 false
 * T17     回归：非平安夜时 guardNightPeaceStep 返回空字符串
 * T18     白熊效应合规：路径A/B 均为正向描述（无"不要""禁止""绝不能"）
 * T19     块大小：NIGHT_GUARD block < 5000 chars（确保窗口足够）
 * T20     回归：R73 guardNightStyle 仍然存在；R73/R81 测试不受影响
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, test, expect } from 'vitest';

const src = readFileSync(resolve(process.cwd(), 'src/services/aiPrompts.js'), 'utf-8');

function getNightGuardBlock() {
    const start = src.indexOf('case PROMPT_ACTIONS.NIGHT_GUARD: {');
    if (start === -1) throw new Error('NIGHT_GUARD case 未找到');
    // NIGHT_GUARD case R85 后约 4650 chars，R94 后约 5810 chars，用 6500 留余量
    return src.slice(start, start + 6500);
}

const block = getNightGuardBlock();

// ═══════════════════════════════════════════════════════
// T1-T5: 变量声明与条件
// ═══════════════════════════════════════════════════════

test('T1: isNightPeacefulGuard 变量声明存在', () => {
    expect(block).toContain('isNightPeacefulGuard');
});

test('T2: guardNightPrevDay 变量声明存在', () => {
    expect(block).toContain('guardNightPrevDay');
});

test('T3: guardNightPeaceStep 变量声明存在', () => {
    expect(block).toContain('guardNightPeaceStep');
});

test('T4: 条件正确：dayCount > 1 && lastNightInfo?.includes(平安夜)', () => {
    expect(block).toContain("ctx.dayCount > 1 && ctx.lastNightInfo?.includes('平安夜')");
    // isNightPeacefulGuard 使用此条件（与 wolfNightPeaceStep R84 对称）
    const condIdx = block.indexOf('isNightPeacefulGuard');
    expect(block.slice(condIdx, condIdx + 120)).toContain("ctx.dayCount > 1 && ctx.lastNightInfo?.includes('平安夜')");
});

test('T5: 非平安夜 fallback：guardNightPeaceStep 声明有空字符串分支', () => {
    // 三元表达式的 false 分支或 else 赋值应为 ''
    const decl = block.indexOf('const guardNightPeaceStep');
    expect(decl).toBeGreaterThan(0);
    const declSegment = block.slice(decl, decl + 800);
    expect(declSegment).toContain("''");
});

// ═══════════════════════════════════════════════════════
// T6-T10: 内容验证
// ═══════════════════════════════════════════════════════

test('T6: ⭕ 标记存在（thought 约束正向限定）', () => {
    expect(block).toContain('⭕【守卫平安夜守护来源推断');
});

test('T7: 路径A：票压高 → 成功拦截 → 连守 → confidence 升15-25', () => {
    expect(block).toContain('路径A');
    expect(block).toContain('连守');
    expect(block).toContain('confidence 升15-25');
});

test('T8: 路径B：票压低 → 狼刀在别处 → 切换次高候选', () => {
    expect(block).toContain('路径B');
    expect(block).toContain('切换至 identity_table 次高优先候选');
});

test('T9: identity_table 追记：追加平安夜A/B推断', () => {
    expect(block).toContain('[A连守/B换守]');
    expect(block).toContain('平安夜：');
});

test('T10: thought 约束使用正向限定（thought 中完成）', () => {
    expect(block).toContain('thought 中完成');
    // 白熊效应合规：不使用"不要在 thought 外展示"等负向禁词
    const peaceStepIdx = block.indexOf('守卫平安夜守护来源推断');
    const peaceStepContent = block.slice(peaceStepIdx, peaceStepIdx + 500);
    expect(peaceStepContent).not.toContain('不要');
    expect(peaceStepContent).not.toContain('禁止');
    expect(peaceStepContent).not.toContain('绝不能');
});

// ═══════════════════════════════════════════════════════
// T11-T15: 注入位置与动态引用
// ═══════════════════════════════════════════════════════

test('T11: 注入位置：${guardNightPeaceStep} 在模板中的 ${guardNightStyle} 之后', () => {
    const returnIdx = block.indexOf('return `守卫守护选择');
    expect(returnIdx).toBeGreaterThan(0);
    const template = block.slice(returnIdx, returnIdx + 600);
    const styleIdx = template.indexOf('${guardNightStyle}');
    const peaceIdx = template.indexOf('${guardNightPeaceStep}');
    expect(styleIdx).toBeGreaterThan(0);
    expect(peaceIdx).toBeGreaterThan(0);
    expect(peaceIdx).toBeGreaterThan(styleIdx);
});

test('T12: 注入位置：${guardNightPeaceStep} 在 "1. 【守护优先级】" 之前', () => {
    const returnIdx = block.indexOf('return `守卫守护选择');
    const template = block.slice(returnIdx, returnIdx + 700);
    const peaceIdx = template.indexOf('${guardNightPeaceStep}');
    const priorityIdx = template.indexOf('1. 【守护优先级】');
    expect(peaceIdx).toBeGreaterThan(0);
    expect(priorityIdx).toBeGreaterThan(0);
    expect(peaceIdx).toBeLessThan(priorityIdx);
});

test('T13: guardNightPeaceStep 内容动态引用 guardNightPrevDay（非硬编码）', () => {
    const decl = block.indexOf('const guardNightPeaceStep');
    const declSegment = block.slice(decl, decl + 700);
    // 应该包含 ${guardNightPrevDay} 而不是硬编码的数字
    expect(declSegment).toContain('${guardNightPrevDay}');
});

test('T14: Step ① 查 identity_table 含"夜守护"的玩家（守护来源推断第一步）', () => {
    expect(block).toContain('N${guardNightPrevDay}夜守护');
    // 或等价的包含 "夜守护" 的守护目标检索指令
});

test('T15: Step ② 查系统提示游戏时间线投票记录（D${prevDay}）', () => {
    expect(block).toContain('D${guardNightPrevDay}');
    expect(block).toContain('投票记录');
});

// ═══════════════════════════════════════════════════════
// T16-T20: 回归与兼容性
// ═══════════════════════════════════════════════════════

test('T16: D1 安全 —— isNightPeacefulGuard 需要 dayCount > 1', () => {
    // 条件中有 ctx.dayCount > 1，确保首夜不触发
    const condIdx = block.indexOf('isNightPeacefulGuard');
    const condSeg = block.slice(condIdx, condIdx + 80);
    expect(condSeg).toContain('ctx.dayCount > 1');
});

test('T17: 非平安夜回退：guardNightPeaceStep 可赋空字符串（fallback）', () => {
    // 验证三元/if-else 有空字符串分支
    const decl = block.indexOf('guardNightPeaceStep');
    const declSeg = block.slice(decl, decl + 800);
    expect(declSeg).toContain("''");
});

test('T18: 白熊效应合规：路径A/B 描述为正向策略，无负向禁词', () => {
    const pathAIdx = block.indexOf('路径A');
    const pathBIdx = block.indexOf('路径B');
    expect(pathAIdx).toBeGreaterThan(0);
    expect(pathBIdx).toBeGreaterThan(0);
    const pathsContent = block.slice(pathAIdx, pathBIdx + 200);
    expect(pathsContent).not.toContain('不要守');
    expect(pathsContent).not.toContain('禁止守');
    expect(pathsContent).not.toContain('绝对不');
});

test('T19: NIGHT_GUARD block 总大小 < 6500 chars（窗口安全验证，R94 后约 5810 chars）', () => {
    const start = src.indexOf('case PROMPT_ACTIONS.NIGHT_GUARD: {');
    const end = src.indexOf('case PROMPT_ACTIONS.NIGHT_MAGICIAN:', start);
    const blockSize = end - start;
    // R94 后约 5810 chars，确保 6500 窗口足够
    expect(blockSize).toBeLessThan(6500);
});

test('T20: 回归 —— R73 guardNightStyle 7种风格仍然存在', () => {
    // 确保 R73 的个性化守护风格未被破坏
    expect(block).toContain('guardNightStyle');
    expect(block).toContain('主动探索型');
    expect(block).toContain('稳健连守型');
    expect(block).toContain('信息挖掘型');
    expect(block).toContain('博弈欺骗型');
    expect(block).toContain('直觉感知型');
    expect(block).toContain('反预判型');
    expect(block).toContain('平衡渐进型');
});
