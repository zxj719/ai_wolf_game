/**
 * R132: 猎人 DAY_SPEECH 两连+三连平安夜推断 — Prepend Injection 第 26 次
 *
 * 背景：R131 补全了猎人单夜平安夜推断（枪靶排除逻辑）。
 * R132 扩展为三层体系，与其他角色对齐：
 *   - 两连平安夜：两轮高票存活者重合 → 极可能被连守，枪靶候选移除（confidence 下调 30-40）
 *   - 三连平安夜：三轮高票存活者两次以上重合 → 几乎确认好人，枪靶彻底排除（confidence 下调 35-45）
 *
 * 博弈论依据：Wang 2025 (arxiv:2408.17177)
 * 渐进证据积累：连续平安夜中高票存活者重合是守卫连守的强信号；
 * 猎人枪靶分析依赖信号积累更新，多轮重合大幅降低对该目标的误射风险。
 *
 * Prepend Injection 第 26 次：三连 hint → 前置到两连 hint 头部；两连 hint → 前置到单夜 step 头部。
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(__dirname, '../aiPrompts.js'), 'utf8');

// 猎人 DAY_SPEECH 函数体（ROLE_DAY_SPEECH_PROMPTS 中的 '猎人' 函数）
const roleMapStart = src.indexOf('const ROLE_DAY_SPEECH_PROMPTS');
const hunterFnStart = src.indexOf("    '猎人': (ctx, params) => {", roleMapStart);
const guardFnStart = src.indexOf("    '守卫': (ctx, params) => {", hunterFnStart);
const hunterBlock = src.slice(hunterFnStart, guardFnStart);

// ─── T1-T2: 新变量声明存在 ──────────────────────────────────────────────────

describe('R132: 猎人两连+三连平安夜 — 新变量声明', () => {
    test('T1: isConsecutivePeacefulHunter 声明存在（D3+，N-2 是平安夜）', () => {
        expect(hunterBlock).toContain('isConsecutivePeacefulHunter');
        expect(hunterBlock).toContain('ctx.dayCount >= 3');
        expect(hunterBlock).toContain('isPeacefulNightHunter');
        expect(hunterBlock).toContain("N${ctx.dayCount - 2}:平安夜");
    });

    test('T2: isTripleConsecutivePeacefulHunter 声明存在（D4+，N-3 是平安夜）', () => {
        expect(hunterBlock).toContain('isTripleConsecutivePeacefulHunter');
        expect(hunterBlock).toContain('ctx.dayCount >= 4');
        expect(hunterBlock).toContain('isConsecutivePeacefulHunter');
        expect(hunterBlock).toContain("N${ctx.dayCount - 3}:平安夜");
    });
});

// ─── T3-T4: if 块内辅助变量 ──────────────────────────────────────────────────

describe('R132: if (isPeacefulNightHunter) 块内辅助变量', () => {
    test('T3: prevPrevDay 和 threePrevDay 在 if 块内声明', () => {
        const ifStart = hunterBlock.indexOf('if (isPeacefulNightHunter)');
        expect(ifStart).toBeGreaterThan(0);
        const ifBlock = hunterBlock.slice(ifStart, ifStart + 2000);
        expect(ifBlock).toContain('prevPrevDay');
        expect(ifBlock).toContain('threePrevDay');
    });

    test('T4: tripleConsecutivePeaceHintHunter let 声明在 if 块内', () => {
        const ifStart = hunterBlock.indexOf('if (isPeacefulNightHunter)');
        const ifBlock = hunterBlock.slice(ifStart, ifStart + 2000);
        expect(ifBlock).toContain('let tripleConsecutivePeaceHintHunter');
    });
});

// ─── T5-T6: 三连推断分支结构 ─────────────────────────────────────────────────

describe('R132: 三连推断分支结构', () => {
    test('T5: isTripleConsecutivePeacefulHunter if 分支存在', () => {
        expect(hunterBlock).toContain('if (isTripleConsecutivePeacefulHunter)');
    });

    test('T6: consecutivePeaceHintHunter 条件表达式（isConsecutivePeacefulHunter 三元）', () => {
        expect(hunterBlock).toContain('const consecutivePeaceHintHunter = isConsecutivePeacefulHunter');
        expect(hunterBlock).toContain('? `${tripleConsecutivePeaceHintHunter}');
    });
});

// ─── T7-T8: 三连推断内容验证 ─────────────────────────────────────────────────

describe('R132: 三连平安夜三阶推断内容', () => {
    test('T7: 三连推断标题包含「三阶推断」关键词', () => {
        expect(hunterBlock).toContain('猎人三连平安夜三阶推断');
        expect(hunterBlock).toContain('三连平安夜：三连高票存活');
    });

    test('T8: 三连推断 confidence 下调 35-45（彻底排除）', () => {
        expect(hunterBlock).toContain('confidence 下调 35-45');
        expect(hunterBlock).toContain('枪靶彻底排除');
    });
});

// ─── T9-T10: 两连推断内容验证 ────────────────────────────────────────────────

describe('R132: 两连平安夜二阶推断内容', () => {
    test('T9: 两连推断标题包含「二阶推断」关键词', () => {
        expect(hunterBlock).toContain('猎人两连平安夜二阶推断');
        expect(hunterBlock).toContain('两连平安夜：两连高票存活');
    });

    test('T10: 两连推断 confidence 下调 30-40（移除候选）', () => {
        expect(hunterBlock).toContain('confidence 下调 30-40');
        expect(hunterBlock).toContain('枪靶候选移除');
    });
});

// ─── T11: Prepend Injection 顺序验证 ─────────────────────────────────────────

describe('R132: Prepend Injection 顺序（三连 > 两连 > 单夜）', () => {
    test('T11: ${consecutivePeaceHintHunter} 在 hunterPeaceNightStep 模板中前置（早于单夜推断标题）', () => {
        const peaceStepAssign = hunterBlock.indexOf('hunterPeaceNightStep = `${consecutivePeaceHintHunter}');
        const singleNightTitle = hunterBlock.indexOf('猎人平安夜推断（thought 中完成；speech 只说"平安夜，继续分析局势"即可）');
        expect(peaceStepAssign).toBeGreaterThan(0);
        expect(singleNightTitle).toBeGreaterThan(0);
        expect(peaceStepAssign).toBeLessThan(singleNightTitle);
    });
});

// ─── T12-T13: fullGameTimeline 检测模式 ─────────────────────────────────────

describe('R132: fullGameTimeline 检测模式（N-2 / N-3）', () => {
    test('T12: isConsecutivePeacefulHunter 使用 fullGameTimeline N-2 检测', () => {
        const consec = hunterBlock.indexOf('const isConsecutivePeacefulHunter');
        const consecLine = hunterBlock.slice(consec, consec + 200);
        expect(consecLine).toContain('ctx.fullGameTimeline?.includes');
        expect(consecLine).toContain('ctx.dayCount - 2');
    });

    test('T13: isTripleConsecutivePeacefulHunter 使用 fullGameTimeline N-3 检测', () => {
        const triple = hunterBlock.indexOf('const isTripleConsecutivePeacefulHunter');
        const tripleLine = hunterBlock.slice(triple, triple + 200);
        expect(tripleLine).toContain('ctx.fullGameTimeline?.includes');
        expect(tripleLine).toContain('ctx.dayCount - 3');
    });
});

// ─── T14: dayCount 门控验证 ───────────────────────────────────────────────────

describe('R132: dayCount 门控（isConsecutive≥3, isTriple≥4）', () => {
    test('T14: isConsecutivePeacefulHunter 需 dayCount >= 3，isTriple 需 dayCount >= 4', () => {
        const consecIdx = hunterBlock.indexOf('const isConsecutivePeacefulHunter');
        const tripleIdx = hunterBlock.indexOf('const isTripleConsecutivePeacefulHunter');
        const consecSlice = hunterBlock.slice(consecIdx, consecIdx + 150);
        const tripleSlice = hunterBlock.slice(tripleIdx, tripleIdx + 150);
        expect(consecSlice).toContain('ctx.dayCount >= 3');
        expect(tripleSlice).toContain('ctx.dayCount >= 4');
    });
});

// ─── T15: R131 单夜回归 ──────────────────────────────────────────────────────

describe('R132: 回归验证 — R131 单夜推断仍存在', () => {
    test('T15: R131 添加的单夜推断关键词仍存在（枪靶排除推断 + confidence 下调 15-25）', () => {
        expect(hunterBlock).toContain('枪靶排除推断');
        expect(hunterBlock).toContain('confidence 下调 15-25');
        expect(hunterBlock).toContain('被保护好人推断，枪靶优先级降级');
    });
});

// ─── T16: 白熊效应合规 ───────────────────────────────────────────────────────

describe('R132: 白熊效应合规（consecutivePeaceHintHunter 和 tripleConsecutivePeaceHintHunter 无负向禁令词）', () => {
    test('T16: 两连+三连推断内容全正向描述（无「不要/禁止/绝不能/千万别」作行首指令）', () => {
        const consecIdx = hunterBlock.indexOf('const consecutivePeaceHintHunter');
        const consec = hunterBlock.slice(consecIdx, consecIdx + 400);
        expect(consec).not.toMatch(/^[\s\-]\s*(不要|禁止|绝不能|千万别)/m);

        const tripleIdx = hunterBlock.indexOf('if (isTripleConsecutivePeacefulHunter)');
        const triple = hunterBlock.slice(tripleIdx, tripleIdx + 400);
        expect(triple).not.toMatch(/^[\s\-]\s*(不要|禁止|绝不能|千万别)/m);
    });
});

// ─── T17: ${consecutivePeaceHintHunter} 插值位置 ────────────────────────────

describe('R132: ${consecutivePeaceHintHunter} 插值位置验证', () => {
    test('T17: hunterPeaceNightStep 以 ${consecutivePeaceHintHunter} 开头（Prepend Injection）', () => {
        expect(hunterBlock).toContain('hunterPeaceNightStep = `${consecutivePeaceHintHunter}⭕【猎人平安夜推断');
    });
});

// ─── T18: isConsecutivePeacefulHunter 依赖链 ─────────────────────────────────

describe('R132: isConsecutivePeacefulHunter 依赖链验证', () => {
    test('T18: isConsecutivePeacefulHunter 依赖 isPeacefulNightHunter（链式依赖，防止独立错误激活）', () => {
        const idx = hunterBlock.indexOf('const isConsecutivePeacefulHunter');
        const line = hunterBlock.slice(idx, idx + 200);
        expect(line).toContain('isPeacefulNightHunter');
    });
});
