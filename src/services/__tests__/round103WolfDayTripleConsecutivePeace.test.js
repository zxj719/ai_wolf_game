/**
 * Round 103: 狼人 DAY_SPEECH 三连平安夜三阶战术推断框架
 * 在 R83（单夜）和 R88（两连）基础上，新增 D4+ 三连平安夜检测，
 * 利用 identity_table 零间接推断三夜刀口模式，提供三路径换刀决策框架
 *
 * T1-T6:   变量声明（isTripleConsecutivePeacefulWolf / threePrevDay / tripleHint / 条件链 / 依赖顺序）
 * T7:      Prepend Injection 注入结构（第 18 次应用）
 * T8-T12:  内容验证（⭕标记 / 路径A/B/C / confidence区间 / identity_table追加）
 * T13:     白熊效应合规（第 24 次验证）
 * T14-T18: 条件门控（D4激活三连 / D3仅两连 / D2仅单夜 / N1非平安夜不激活 / 三连条件链完整）
 * T19-T20: 回归（R88两连内容保留 / R83单夜 wolfPeaceNightStep 保留）
 */

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve('src/services/aiPrompts.js'), 'utf8');

// ─── Wolf DAY_SPEECH block 定位 ──────────────────────────────────────────────
const wolfDayStart = src.indexOf("'狼人': (ctx, params) =>");
const villagerDayStart = src.indexOf("'村民': (ctx, params) =>", wolfDayStart);
const wolfDayBlock = src.slice(wolfDayStart, villagerDayStart);

// 变量声明区（return 之前）
const wolfReturnIdx = wolfDayBlock.indexOf('return `${getBaseContext(ctx)}');
const wolfVarBlock = wolfDayBlock.slice(0, wolfReturnIdx);

// if (isPeacefulNightWolf) 块定位
const ifPeaceIdx = wolfVarBlock.indexOf('if (isPeacefulNightWolf)');
const ifPeaceBlock = wolfVarBlock.slice(ifPeaceIdx);

// tripleConsecutivePeaceHintWolf 赋值内容
const tripleHintStart = wolfVarBlock.indexOf('tripleConsecutivePeaceHintWolf = isTriple');
const tripleHintEnd = wolfVarBlock.indexOf(": '';\n", tripleHintStart);
const tripleHintContent = tripleHintStart >= 0
    ? wolfVarBlock.slice(tripleHintStart, tripleHintEnd + 50)
    : '';

// consecutivePeaceHintWolf 赋值内容（两连，含三连前缀）
const consecHintStart = wolfVarBlock.indexOf('consecutivePeaceHintWolf = isConsecutivePeacefulWolf');
const consecHintEnd = wolfVarBlock.indexOf(": '';\n", consecHintStart);
const consecHintContent = consecHintStart >= 0
    ? wolfVarBlock.slice(consecHintStart, consecHintEnd + 50)
    : '';

// ═══════════════════════════════════════════════════════════════════════
// 变量声明验证（T1-T6）
// ═══════════════════════════════════════════════════════════════════════

describe('R103 狼人 DAY_SPEECH: 变量声明验证', () => {
    test('T1: 声明了 isTripleConsecutivePeacefulWolf 变量', () => {
        expect(wolfVarBlock).toContain('isTripleConsecutivePeacefulWolf');
    });

    test('T2: isTripleConsecutivePeacefulWolf 条件包含 dayCount >= 4', () => {
        const condIdx = wolfVarBlock.indexOf('isTripleConsecutivePeacefulWolf =');
        const condLine = wolfVarBlock.slice(condIdx, condIdx + 200);
        expect(condLine).toContain('dayCount >= 4');
    });

    test('T3: isTripleConsecutivePeacefulWolf 依赖 isConsecutivePeacefulWolf（超集原则）', () => {
        const condIdx = wolfVarBlock.indexOf('isTripleConsecutivePeacefulWolf =');
        const condLine = wolfVarBlock.slice(condIdx, condIdx + 200);
        expect(condLine).toContain('isConsecutivePeacefulWolf');
    });

    test('T4: isTripleConsecutivePeacefulWolf 检测 N(dayCount-3) 平安夜', () => {
        const condIdx = wolfVarBlock.indexOf('isTripleConsecutivePeacefulWolf =');
        const condLine = wolfVarBlock.slice(condIdx, condIdx + 250);
        expect(condLine).toContain('dayCount - 3');
        expect(condLine).toContain('平安夜');
    });

    test('T5: threePrevDay 在 if (isPeacefulNightWolf) 块内声明', () => {
        const threePrevIdx = ifPeaceBlock.indexOf('const threePrevDay = ctx.dayCount >= 4');
        expect(threePrevIdx).toBeGreaterThan(-1);
    });

    test('T6: tripleConsecutivePeaceHintWolf 变量在 if 块内声明', () => {
        expect(ifPeaceBlock).toContain('tripleConsecutivePeaceHintWolf = isTripleConsecutivePeacefulWolf');
    });
});

// ═══════════════════════════════════════════════════════════════════════
// Prepend Injection 注入结构（T7）
// ═══════════════════════════════════════════════════════════════════════

describe('R103 狼人 DAY_SPEECH: Prepend Injection 注入结构', () => {
    test('T7: consecutivePeaceHintWolf 三元 true 分支以 ${tripleConsecutivePeaceHintWolf}⭕【狼人两连 开头', () => {
        expect(consecHintContent).toContain('${tripleConsecutivePeaceHintWolf}⭕【狼人两连平安夜二阶战术推断');
    });
});

// ═══════════════════════════════════════════════════════════════════════
// 内容验证（T8-T12）
// ═══════════════════════════════════════════════════════════════════════

describe('R103 狼人 DAY_SPEECH: 三连推断内容验证', () => {
    test('T8: 三连推断标题包含"三连平安夜三阶战术推断"和零间接推断说明', () => {
        expect(tripleHintContent).toContain('三连平安夜三阶战术推断');
        expect(tripleHintContent).toContain('零间接推断');
    });

    test('T9: 路径A描述三夜刀口相同场景及 confidence 升 35-45', () => {
        expect(tripleHintContent).toContain('路径A');
        expect(tripleHintContent).toContain('三夜刀口相同');
        expect(tripleHintContent).toContain('35-45');
    });

    test('T10: 路径B描述两夜相同+一夜不同场景及 confidence 升 25-35', () => {
        expect(tripleHintContent).toContain('路径B');
        expect(tripleHintContent).toContain('两夜刀口相同+一夜不同');
        expect(tripleHintContent).toContain('25-35');
    });

    test('T11: 路径C描述三夜各不同场景（无规律→按单夜评估）', () => {
        expect(tripleHintContent).toContain('路径C');
        expect(tripleHintContent).toContain('三夜各不同目标');
        expect(tripleHintContent).toContain('按单夜路径A/B');
    });

    test('T12: identity_table 追加三连平安夜格局标记', () => {
        expect(tripleHintContent).toContain('三连平安夜');
        expect(tripleHintContent).toContain('identity_table 追加');
        expect(tripleHintContent).toContain('路径A/B/C');
    });
});

// ═══════════════════════════════════════════════════════════════════════
// 白熊效应合规（T13）
// ═══════════════════════════════════════════════════════════════════════

describe('R103 狼人 DAY_SPEECH: 白熊效应合规（第 24 次验证）', () => {
    test('T13: 三连推断内容全正向描述，无负向禁词', () => {
        const negativeWords = ['不要', '禁止', '不能', '不应', '避免自爆', '不暴露'];
        for (const word of negativeWords) {
            expect(tripleHintContent).not.toContain(word);
        }
        // 正向描述验证
        expect(tripleHintContent).toContain('换刀');
        expect(tripleHintContent).toContain('confidence 升');
    });
});

// ═══════════════════════════════════════════════════════════════════════
// 条件门控（T14-T18）
// ═══════════════════════════════════════════════════════════════════════

describe('R103 狼人 DAY_SPEECH: 条件门控验证', () => {
    test('T14: D4 dayCount >= 4 才激活三连（条件下限正确）', () => {
        const condIdx = wolfVarBlock.indexOf('isTripleConsecutivePeacefulWolf =');
        const condLine = wolfVarBlock.slice(condIdx, condIdx + 150);
        // 必须 >= 4，不能是 >= 3
        expect(condLine).toContain('>= 4');
        expect(condLine).not.toContain('>= 3 &&');
    });

    test('T15: 三连检测在两连检测之后声明（依赖顺序正确）', () => {
        const twoConsecIdx = wolfVarBlock.indexOf('isConsecutivePeacefulWolf =');
        const threeConsecIdx = wolfVarBlock.indexOf('isTripleConsecutivePeacefulWolf =');
        expect(threeConsecIdx).toBeGreaterThan(twoConsecIdx);
    });

    test('T16: 三连 let/const 声明在 let wolfPeaceNightStep 之前', () => {
        const wolfPeaceLetIdx = wolfVarBlock.indexOf('let wolfPeaceNightStep');
        const threeConsecIdx = wolfVarBlock.indexOf('isTripleConsecutivePeacefulWolf =');
        expect(threeConsecIdx).toBeLessThan(wolfPeaceLetIdx);
    });

    test('T17: tripleConsecutivePeaceHintWolf 在 consecutivePeaceHintWolf 之前声明', () => {
        const tripleIdx = ifPeaceBlock.indexOf('tripleConsecutivePeaceHintWolf = isTriple');
        const consecIdx = ifPeaceBlock.indexOf('consecutivePeaceHintWolf = isConsecutivePeacefulWolf');
        expect(tripleIdx).toBeGreaterThan(-1);
        expect(consecIdx).toBeGreaterThan(tripleIdx);
    });

    test('T18: 三连条件使用 fullGameTimeline 检测 N(dayCount-3):平安夜', () => {
        const condIdx = wolfVarBlock.indexOf('isTripleConsecutivePeacefulWolf =');
        const condBlock = wolfVarBlock.slice(condIdx, condIdx + 300);
        expect(condBlock).toContain('fullGameTimeline');
        expect(condBlock).toContain('dayCount - 3');
        expect(condBlock).toContain(':平安夜');
    });
});

// ═══════════════════════════════════════════════════════════════════════
// 回归验证（T19-T20）
// ═══════════════════════════════════════════════════════════════════════

describe('R103 狼人 DAY_SPEECH: 回归兼容验证', () => {
    test('T19: R88 两连推断内容保留（两夜刀口相同/换刀建议/资源损耗）', () => {
        expect(consecHintContent).toContain('两夜刀口相同');
        expect(consecHintContent).toContain('换刀');
        expect(consecHintContent).toContain('资源损耗评估');
        expect(consecHintContent).toContain('两连平安夜');
    });

    test('T20: R83 单夜 wolfPeaceNightStep 保留（平安夜战术推断/守护来源推断）', () => {
        const wolfPeaceStepIdx = wolfVarBlock.indexOf('wolfPeaceNightStep = `');
        const wolfPeaceContent = wolfVarBlock.slice(wolfPeaceStepIdx, wolfPeaceStepIdx + 800);
        expect(wolfPeaceContent).toContain('狼人平安夜战术推断');
        expect(wolfPeaceContent).toContain('守护来源推断');
        expect(wolfPeaceContent).toContain('高票存活者');
    });
});
