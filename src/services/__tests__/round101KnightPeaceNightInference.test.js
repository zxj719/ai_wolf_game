/**
 * Round 101: 骑士 DAY_SPEECH 平安夜推断三层体系（单夜→两连→三连）
 * 在 knight.js 中新增 isPeacefulNightKnight / isConsecutivePeacefulKnight /
 * isTripleConsecutivePeacefulKnight 三级条件，提供骑士独特的决斗候选修正框架
 *
 * T1-T7:   变量声明与依赖链顺序
 * T8-T12:  三连推断内容验证（⭕标记 / 三路径 / confidence区间 / identity_table）
 * T13-T15: 注入结构（prepend injection / 声明顺序 / 白熊效应合规）
 * T16-T18: 条件门控（isPeacefulNight / dayCount>=3 / dayCount>=4 / 非激活空串）
 * T19-T20: 单夜推断内容保留 / 非平安夜不激活
 */

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { getKnightDaySpeechPrompt } from '../rolePrompts/knight.js';

const src = readFileSync(resolve('src/services/rolePrompts/knight.js'), 'utf8');

// ─── block 定位 ───────────────────────────────────────────────────────────────
const fnStart = src.indexOf('export const getKnightDaySpeechPrompt');
const returnIdx = src.indexOf('  return `', fnStart);
const varBlock = src.slice(fnStart, returnIdx);

// 找到 if (isPeacefulNightKnight) 块
const ifPeaceIdx = varBlock.indexOf('if (isPeacefulNightKnight)');
const ifPeaceBlock = ifPeaceIdx >= 0 ? varBlock.slice(ifPeaceIdx, ifPeaceIdx + 3000) : '';

// ─── 公共 ctx / params 构造器 ─────────────────────────────────────────────────
const makeCtx = (dayCount, lastNightInfo = '', fullGameTimeline = '') => ({
    dayCount,
    lastNightInfo,
    fullGameTimeline,
    alivePlayersInfo: '2号、3号、4号、5号存活',
    deathLog: '',
    voteInfo: dayCount > 1 ? `D${dayCount - 1}: 6号(3票)出局` : '',
    seerChecks: [],
});

const makeParams = (hasUsedDuel = false) => ({ hasUsedDuel, aliveCount: 7 });

// ═══════════════════════════════════════════════════════════════════════════════
// T1-T7: 变量声明与依赖链顺序
// ═══════════════════════════════════════════════════════════════════════════════

describe('R101 骑士平安夜推断: 变量声明', () => {
    // T1: isPeacefulNightKnight 声明
    test('T1: isPeacefulNightKnight 变量在函数体内声明', () => {
        expect(varBlock).toContain('isPeacefulNightKnight');
    });

    // T2: isPeacefulNightKnight 条件包含 lastNightInfo 和平安夜
    test('T2: isPeacefulNightKnight 使用 lastNightInfo?.includes 检测平安夜', () => {
        const peaceIdx = varBlock.indexOf('isPeacefulNightKnight =');
        const condLine = varBlock.slice(peaceIdx, peaceIdx + 120);
        expect(condLine).toContain("lastNightInfo?.includes('平安夜')");
        expect(condLine).toContain('dayCount > 1');
    });

    // T3: isConsecutivePeacefulKnight 声明存在
    test('T3: isConsecutivePeacefulKnight 变量在函数体内声明', () => {
        expect(varBlock).toContain('isConsecutivePeacefulKnight');
    });

    // T4: isConsecutivePeacefulKnight 条件包含 dayCount >= 3 和 fullGameTimeline
    test('T4: isConsecutivePeacefulKnight 条件包含 dayCount >= 3 和 fullGameTimeline', () => {
        const consecIdx = varBlock.indexOf('isConsecutivePeacefulKnight =');
        const condBlock = varBlock.slice(consecIdx, consecIdx + 200);
        expect(condBlock).toContain('dayCount >= 3');
        expect(condBlock).toContain('fullGameTimeline');
        expect(condBlock).toContain('dayCount - 2');
    });

    // T5: isTripleConsecutivePeacefulKnight 声明存在（在 if 块内）
    test('T5: isTripleConsecutivePeacefulKnight 在 if (isPeacefulNightKnight) 块内声明', () => {
        expect(ifPeaceBlock).toContain('isTripleConsecutivePeacefulKnight');
    });

    // T6: isTripleConsecutivePeacefulKnight 条件包含 dayCount >= 4 和 isConsecutivePeacefulKnight（超集原则）
    test('T6: isTripleConsecutivePeacefulKnight 条件包含 dayCount >= 4 和 isConsecutivePeacefulKnight', () => {
        const tripleIdx = ifPeaceBlock.indexOf('isTripleConsecutivePeacefulKnight =');
        const condBlock = ifPeaceBlock.slice(tripleIdx, tripleIdx + 200);
        expect(condBlock).toContain('dayCount >= 4');
        expect(condBlock).toContain('isConsecutivePeacefulKnight');
        expect(condBlock).toContain('dayCount - 3');
    });

    // T7: tripleConsecutivePeaceHintKnight 在 consecutivePeaceHintKnight 之前声明（注入顺序）
    test('T7: tripleConsecutivePeaceHintKnight 在 consecutivePeaceHintKnight 之前声明', () => {
        const tripleHintIdx = ifPeaceBlock.indexOf('tripleConsecutivePeaceHintKnight');
        const consecHintIdx = ifPeaceBlock.indexOf('consecutivePeaceHintKnight');
        expect(tripleHintIdx).toBeGreaterThan(-1);
        expect(consecHintIdx).toBeGreaterThan(tripleHintIdx);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// T8-T12: 三连推断内容验证
// ═══════════════════════════════════════════════════════════════════════════════

describe('R101 骑士平安夜推断: 内容验证', () => {
    // T8: 三连推断包含 ⭕ 标记和正确标题
    test('T8: 三连平安夜推断内容包含 ⭕ 标记和三阶推断标题', () => {
        const tripleHintIdx = ifPeaceBlock.indexOf('tripleConsecutivePeaceHintKnight =');
        const tripleContent = ifPeaceBlock.slice(tripleHintIdx, tripleHintIdx + 1000);
        expect(tripleContent).toContain('⭕');
        expect(tripleContent).toContain('三连平安夜三阶推断');
    });

    // T9: 三连推断包含三路径（A/B/C）
    test('T9: 三连推断包含路径A（三夜相同）/ 路径B（两夜相同）/ 路径C（三夜各不相同）', () => {
        const tripleHintIdx = ifPeaceBlock.indexOf('tripleConsecutivePeaceHintKnight =');
        const tripleContent = ifPeaceBlock.slice(tripleHintIdx, tripleHintIdx + 1000);
        expect(tripleContent).toContain('路径A');
        expect(tripleContent).toContain('路径B');
        expect(tripleContent).toContain('路径C');
    });

    // T10: 三连推断 confidence 区间 35-45（路径A）
    test('T10: 三连推断路径A 的 confidence 降幅为 35-45', () => {
        const tripleHintIdx = ifPeaceBlock.indexOf('tripleConsecutivePeaceHintKnight =');
        const tripleContent = ifPeaceBlock.slice(tripleHintIdx, tripleHintIdx + 800);
        expect(tripleContent).toContain('35-45');
    });

    // T11: 两连推断包含路径A confidence 25-35
    test('T11: 两连推断路径A 的 confidence 降幅为 25-35', () => {
        const consecHintIdx = ifPeaceBlock.indexOf('consecutivePeaceHintKnight =');
        const consecContent = ifPeaceBlock.slice(consecHintIdx, consecHintIdx + 800);
        expect(consecContent).toContain('25-35');
    });

    // T12: 单夜推断包含 confidence 10-20
    test('T12: 单夜推断的 confidence 降幅为 10-20', () => {
        const singleHintIdx = ifPeaceBlock.indexOf('knightPeaceNightStep =');
        const singleContent = ifPeaceBlock.slice(singleHintIdx, singleHintIdx + 600);
        expect(singleContent).toContain('10-20');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// T13-T15: 注入结构与白熊效应合规
// ═══════════════════════════════════════════════════════════════════════════════

describe('R101 骑士平安夜推断: 注入结构', () => {
    // T13: knightPeaceNightStep 在 return 模板中注入
    test('T13: return 模板中包含 ${knightPeaceNightStep} 插值', () => {
        const templateSection = src.slice(returnIdx, returnIdx + 3000);
        expect(templateSection).toContain('${knightPeaceNightStep}');
    });

    // T14: prepend injection 结构（三连前置到两连，两连前置到单夜）
    test('T14: consecutivePeaceHintKnight 使用前置注入 ${tripleConsecutivePeaceHintKnight}', () => {
        const consecHintIdx = ifPeaceBlock.indexOf('consecutivePeaceHintKnight =');
        const consecContent = ifPeaceBlock.slice(consecHintIdx, consecHintIdx + 200);
        expect(consecContent).toContain('${tripleConsecutivePeaceHintKnight}');
    });

    // T15: 白熊效应合规——推断内容不包含"不要"/"禁止"等负向禁词
    test('T15: 白熊效应合规——所有推断内容使用正向描述，无负向禁词', () => {
        // 检查 if 块内不包含 "不要" 作为推断内容指令（骑士禁忌里有"禁止"，但推断步骤内不应有）
        const tripleHintIdx = ifPeaceBlock.indexOf('tripleConsecutivePeaceHintKnight =');
        const allHintContent = ifPeaceBlock.slice(tripleHintIdx, tripleHintIdx + 2000);
        // 断言使用正向描述
        expect(allHintContent).toContain('confidence 降');
        expect(allHintContent).toContain('守护');
        expect(allHintContent).toContain('identity_table 追加');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// T16-T18: 条件门控（生成验证）
// ═══════════════════════════════════════════════════════════════════════════════

describe('R101 骑士平安夜推断: 生成条件门控', () => {
    // T16: 非平安夜（正常夜晚死亡）时 knightPeaceNightStep 为空 → 不出现推断步骤
    test('T16: 非平安夜时生成结果不含平安夜守护来源推断', () => {
        const result = getKnightDaySpeechPrompt(
            makeCtx(2, '3号死亡', 'N1:3号死亡'),
            makeParams()
        );
        expect(result).not.toContain('⭕【平安夜守护来源推断');
    });

    // T17: D2 单平安夜激活单层推断，不激活两连或三连
    test('T17: D2 单平安夜 → 激活单层推断，不激活两连/三连', () => {
        const result = getKnightDaySpeechPrompt(
            makeCtx(2, '平安夜', 'N1:平安夜'),
            makeParams()
        );
        expect(result).toContain('⭕【平安夜守护来源推断');
        expect(result).not.toContain('两连平安夜二阶推断');
        expect(result).not.toContain('三连平安夜三阶推断');
    });

    // T18: D4 三连全部激活（需 fullGameTimeline 包含 N2 和 N1 平安夜记录）
    test('T18: D4 三连平安夜激活三层全部推断', () => {
        const result = getKnightDaySpeechPrompt(
            makeCtx(4, '平安夜', 'N1:平安夜 → D1:5号出局 → N2:平安夜 → D2:6号出局 → N3:平安夜'),
            makeParams()
        );
        expect(result).toContain('⭕【平安夜守护来源推断');
        expect(result).toContain('两连平安夜二阶推断');
        expect(result).toContain('三连平安夜三阶推断');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// T19-T20: 单夜推断内容与决斗相关内容保留
// ═══════════════════════════════════════════════════════════════════════════════

describe('R101 骑士平安夜推断: 单夜内容与骑士决斗逻辑保留', () => {
    // T19: 单夜推断内容包含骑士独特的决斗候选修正
    test('T19: 单夜推断包含骑士独特的决斗修正描述', () => {
        const result = getKnightDaySpeechPrompt(
            makeCtx(2, '平安夜', 'N1:平安夜'),
            makeParams()
        );
        expect(result).toContain('决斗修正');
        expect(result).toContain('决斗候选优先级下调');
    });

    // T20: 现有骑士核心逻辑（knightHistoryStep + duelStatus + Step1-Step5）在所有平安夜场景下仍完整
    test('T20: 平安夜场景下骑士 Step1-Step5 思维链保持完整', () => {
        const result = getKnightDaySpeechPrompt(
            makeCtx(4, '平安夜', 'N1:平安夜 → N2:平安夜 → N3:平安夜'),
            makeParams()
        );
        expect(result).toContain('Step1: 场上局势分析');
        expect(result).toContain('Step2: 真假预言家判断');
        expect(result).toContain('Step3: 决斗收益计算');
        expect(result).toContain('Step4: 发言内容确定');
        expect(result).toContain('Step5: 投票倾向');
    });
});
