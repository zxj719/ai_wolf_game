/**
 * Round 108: 摄梦人 DAY_SPEECH 平安夜双来源推断三层体系（单夜→两连→三连）
 * 在 dreamweaver.js getDreamweaverDaySpeechPrompt 中新增三层条件化推断框架
 * 独特双来源视角：来源A（入梦免疫拦截）vs 来源B（守卫/女巫保护他处）
 *
 * T1-T7:   变量声明与依赖链顺序（静态代码分析）
 * T8-T12:  推断内容验证（⭕标记 / 三路径 / confidence区间 / 双来源）
 * T13-T15: 注入结构（prepend injection / 模板注入 / 白熊效应合规）
 * T16-T18: 条件门控（生成验证 — 非平安夜 / D2单夜 / D4三连）
 * T19-T20: 骑士核心逻辑保留 + dreamTargetRef 参数化
 */

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { getDreamweaverDaySpeechPrompt } from '../rolePrompts/dreamweaver.js';

const src = readFileSync(resolve('src/services/rolePrompts/dreamweaver.js'), 'utf8');

// ─── block 定位 ───────────────────────────────────────────────────────────────
const fnStart = src.indexOf('export const getDreamweaverDaySpeechPrompt');
const returnIdx = src.indexOf('  return `${getBaseContext(ctx)}', fnStart);
const varBlock = src.slice(fnStart, returnIdx);

// 找到 if (isPeacefulNightDW) 块
const ifPeaceIdx = varBlock.indexOf('if (isPeacefulNightDW)');
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

const makeParams = (lastDreamTarget = 3) => ({
    dreamHistory: { dreamedPlayers: [lastDreamTarget], lastDreamTarget },
    lastDreamTarget,
});

// ═══════════════════════════════════════════════════════════════════════════════
// T1-T7: 变量声明与依赖链顺序
// ═══════════════════════════════════════════════════════════════════════════════

describe('R108 摄梦人DAY平安夜推断: 变量声明', () => {
    // T1: isPeacefulNightDW 声明
    test('T1: isPeacefulNightDW 变量在函数体内声明', () => {
        expect(varBlock).toContain('isPeacefulNightDW');
    });

    // T2: isPeacefulNightDW 条件包含 lastNightInfo 和平安夜
    test('T2: isPeacefulNightDW 使用 lastNightInfo?.includes 检测平安夜', () => {
        const peaceIdx = varBlock.indexOf('isPeacefulNightDW =');
        const condLine = varBlock.slice(peaceIdx, peaceIdx + 120);
        expect(condLine).toContain("lastNightInfo?.includes('平安夜')");
        expect(condLine).toContain('dayCount > 1');
    });

    // T3: isConsecutivePeacefulDW 声明存在
    test('T3: isConsecutivePeacefulDW 变量在函数体内声明', () => {
        expect(varBlock).toContain('isConsecutivePeacefulDW');
    });

    // T4: isConsecutivePeacefulDW 条件包含 dayCount >= 3 和 fullGameTimeline
    test('T4: isConsecutivePeacefulDW 条件包含 dayCount >= 3 和 fullGameTimeline', () => {
        const consecIdx = varBlock.indexOf('isConsecutivePeacefulDW =');
        const condBlock = varBlock.slice(consecIdx, consecIdx + 200);
        expect(condBlock).toContain('dayCount >= 3');
        expect(condBlock).toContain('fullGameTimeline');
        expect(condBlock).toContain('dayCount - 2');
    });

    // T5: isTripleConsecutivePeacefulDW 声明在 if (isPeacefulNightDW) 块内
    test('T5: isTripleConsecutivePeacefulDW 在 if (isPeacefulNightDW) 块内声明', () => {
        expect(ifPeaceBlock).toContain('isTripleConsecutivePeacefulDW');
    });

    // T6: isTripleConsecutivePeacefulDW 条件包含 dayCount >= 4（超集原则）
    test('T6: isTripleConsecutivePeacefulDW 条件包含 dayCount >= 4 和 isConsecutivePeacefulDW', () => {
        const tripleIdx = ifPeaceBlock.indexOf('const isTripleConsecutivePeacefulDW');
        const condBlock = ifPeaceBlock.slice(tripleIdx, tripleIdx + 200);
        expect(condBlock).toContain('dayCount >= 4');
        expect(condBlock).toContain('isConsecutivePeacefulDW');
        expect(condBlock).toContain('dayCount - 3');
    });

    // T7: tripleConsecutivePeaceHintDW 在 consecutivePeaceHintDW 之前声明（注入顺序）
    test('T7: tripleConsecutivePeaceHintDW 在 consecutivePeaceHintDW 之前声明', () => {
        const tripleHintIdx = ifPeaceBlock.indexOf('tripleConsecutivePeaceHintDW');
        const consecHintIdx = ifPeaceBlock.indexOf('consecutivePeaceHintDW');
        expect(tripleHintIdx).toBeGreaterThan(-1);
        expect(consecHintIdx).toBeGreaterThan(tripleHintIdx);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// T8-T12: 推断内容验证
// ═══════════════════════════════════════════════════════════════════════════════

describe('R108 摄梦人DAY平安夜推断: 内容验证', () => {
    // T8: 三连推断包含 ⭕ 标记和标题
    test('T8: 三连推断包含 ⭕ 标记和三连平安夜三阶标题', () => {
        const tripleHintIdx = ifPeaceBlock.indexOf('const tripleConsecutivePeaceHintDW');
        const tripleContent = ifPeaceBlock.slice(tripleHintIdx, tripleHintIdx + 1200);
        expect(tripleContent).toContain('⭕');
        expect(tripleContent).toContain('三连平安夜三阶双来源推断');
    });

    // T9: 三连推断包含三路径（A/B/C）
    test('T9: 三连推断包含路径A（三夜相同）/ 路径B（两夜相同）/ 路径C（三夜各不相同）', () => {
        const tripleHintIdx = ifPeaceBlock.indexOf('const tripleConsecutivePeaceHintDW');
        const tripleContent = ifPeaceBlock.slice(tripleHintIdx, tripleHintIdx + 1200);
        expect(tripleContent).toContain('路径A');
        expect(tripleContent).toContain('路径B');
        expect(tripleContent).toContain('路径C');
    });

    // T10: 三连推断 confidence 区间 35-45（路径A）
    test('T10: 三连推断路径A 的 confidence 升幅为 35-45', () => {
        const tripleHintIdx = ifPeaceBlock.indexOf('const tripleConsecutivePeaceHintDW');
        const tripleContent = ifPeaceBlock.slice(tripleHintIdx, tripleHintIdx + 1000);
        expect(tripleContent).toContain('35-45');
    });

    // T11: 两连推断包含路径A confidence 25-35
    test('T11: 两连推断路径A 的 confidence 升幅为 25-35', () => {
        const consecHintIdx = ifPeaceBlock.indexOf('const consecutivePeaceHintDW');
        const consecContent = ifPeaceBlock.slice(consecHintIdx, consecHintIdx + 800);
        expect(consecContent).toContain('25-35');
    });

    // T12: 单夜推断包含双来源（来源A / 来源B）和 confidence 升 15-20
    test('T12: 单夜推断包含来源A / 来源B 双来源框架和 confidence 升 15-20', () => {
        const singleHintIdx = ifPeaceBlock.indexOf('dwPeaceNightStep =');
        const singleContent = ifPeaceBlock.slice(singleHintIdx, singleHintIdx + 800);
        expect(singleContent).toContain('来源A');
        expect(singleContent).toContain('来源B');
        expect(singleContent).toContain('15-20');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// T13-T15: 注入结构与白熊效应合规
// ═══════════════════════════════════════════════════════════════════════════════

describe('R108 摄梦人DAY平安夜推断: 注入结构', () => {
    // T13: dwPeaceNightStep 在 return 模板中注入
    test('T13: return 模板中包含 ${dwPeaceNightStep} 插值', () => {
        const templateSection = src.slice(returnIdx, returnIdx + 3000);
        expect(templateSection).toContain('${dwPeaceNightStep}');
    });

    // T14: prepend injection 结构（三连前置到两连，两连前置到单夜）
    test('T14: consecutivePeaceHintDW 使用前置注入 ${tripleConsecutivePeaceHintDW}', () => {
        const consecHintIdx = ifPeaceBlock.indexOf('const consecutivePeaceHintDW');
        const consecContent = ifPeaceBlock.slice(consecHintIdx, consecHintIdx + 300);
        expect(consecContent).toContain('${tripleConsecutivePeaceHintDW}');
    });

    // T15: 白熊效应合规——推断内容使用正向描述，无负向禁词
    test('T15: 白熊效应合规（第 29 次验证）——推断内容不含 不要/禁止 等负向指令', () => {
        const tripleHintIdx = ifPeaceBlock.indexOf('const tripleConsecutivePeaceHintDW');
        const allHintContent = ifPeaceBlock.slice(tripleHintIdx, tripleHintIdx + 2500);
        expect(allHintContent).toContain('confidence 升');
        expect(allHintContent).toContain('identity_table');
        expect(allHintContent).not.toMatch(/不要|禁止|绝不能/);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// T16-T18: 条件门控（生成验证）
// ═══════════════════════════════════════════════════════════════════════════════

describe('R108 摄梦人DAY平安夜推断: 生成条件门控', () => {
    // T16: 非平安夜（正常死亡夜晚）时 dwPeaceNightStep 为空
    test('T16: 非平安夜时生成结果不含平安夜双来源推断', () => {
        const result = getDreamweaverDaySpeechPrompt(
            makeCtx(2, '3号死亡', 'N1:3号死亡'),
            makeParams()
        );
        expect(result).not.toContain('平安夜双来源推断');
    });

    // T17: D2 单平安夜激活单层推断，不激活两连或三连
    test('T17: D2 单平安夜 → 激活单层推断，不激活两连/三连', () => {
        const result = getDreamweaverDaySpeechPrompt(
            makeCtx(2, '平安夜', 'N1:平安夜'),
            makeParams()
        );
        expect(result).toContain('摄梦人平安夜双来源推断');
        expect(result).not.toContain('两连平安夜二阶双来源推断');
        expect(result).not.toContain('三连平安夜三阶双来源推断');
    });

    // T18: D4 三连全部激活（fullGameTimeline 含 N1/N2/N3 平安夜）
    test('T18: D4 三连平安夜激活三层全部推断', () => {
        const result = getDreamweaverDaySpeechPrompt(
            makeCtx(4, '平安夜', 'N1:平安夜 → D1:5号出局 → N2:平安夜 → D2:6号出局 → N3:平安夜'),
            makeParams()
        );
        expect(result).toContain('摄梦人平安夜双来源推断');
        expect(result).toContain('两连平安夜二阶双来源推断');
        expect(result).toContain('三连平安夜三阶双来源推断');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// T19-T20: 摄梦人核心逻辑保留 + dreamTargetRef 参数化
// ═══════════════════════════════════════════════════════════════════════════════

describe('R108 摄梦人DAY平安夜推断: 核心逻辑保留', () => {
    // T19: dreamTargetRef 在单夜推断文本中出现（参数化验证）
    test('T19: 单夜推断文本包含 lastDreamTarget 的引用（dreamTargetRef 参数化）', () => {
        const result = getDreamweaverDaySpeechPrompt(
            makeCtx(2, '平安夜', 'N1:平安夜'),
            makeParams(5)  // lastDreamTarget = 5
        );
        expect(result).toContain('5号');
    });

    // T20: 平安夜场景下摄梦人 Step1-Step5 思维链保持完整
    test('T20: 平安夜场景下 Step1-Step5 思维链仍完整', () => {
        const result = getDreamweaverDaySpeechPrompt(
            makeCtx(4, '平安夜', 'N1:平安夜 → N2:平安夜 → N3:平安夜'),
            makeParams()
        );
        expect(result).toContain('Step1: 昨晚入梦回顾');
        expect(result).toContain('Step2: 死讯分析');
        expect(result).toContain('Step3: 狼人排查');
        expect(result).toContain('Step4: 发言内容确定');
        expect(result).toContain('Step5: 投票倾向');
    });
});
