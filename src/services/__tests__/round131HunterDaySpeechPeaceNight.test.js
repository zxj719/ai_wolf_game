/**
 * R131: 猎人 DAY_SPEECH 平安夜推断步骤 — 枪靶排除逻辑
 *
 * 背景：狼人/预言家/女巫/守卫/村民 均有平安夜推断步骤，猎人独缺此分析视角。
 * R131 补全猎人 DAY_SPEECH 的平安夜推断：
 *   - 高票存活者 = 被保护好人 → 从枪靶优先列表降级（枪靶反证逻辑）
 *   - 仅在 D2+（dayCount > 1）且 lastNightInfo 包含 "平安夜" 时注入
 *
 * 博弈论依据：Wang 2025 (arxiv:2408.17177) — 角色专属视角的私有信息推断
 * 猎人枪靶分析的核心约束：被狼重点针对且被守/救 = 更可能是好人，不是合适枪靶。
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(__dirname, '../aiPrompts.js'), 'utf8');

// 猎人 DAY_SPEECH 函数体（ROLE_DAY_SPEECH_PROMPTS 中的 '猎人' 函数）
const roleMapStart = src.indexOf('const ROLE_DAY_SPEECH_PROMPTS');
const hunterFnStart = src.indexOf("    '猎人': (ctx, params) => {", roleMapStart);
const guardFnStart = src.indexOf("    '守卫': (ctx, params) => {", hunterFnStart);
const hunterBlock = src.slice(hunterFnStart, guardFnStart);

// ─── T1-T2: 变量声明存在 ────────────────────────────────────────────────────

describe('R131: 猎人 DAY_SPEECH 平安夜推断变量声明', () => {
    test('T1: isPeacefulNightHunter 变量声明存在（D2+且lastNightInfo含平安夜）', () => {
        expect(hunterBlock).toContain('isPeacefulNightHunter');
        expect(hunterBlock).toContain("ctx.lastNightInfo?.includes('平安夜')");
        expect(hunterBlock).toContain('ctx.dayCount > 1');
    });

    test('T2: hunterPeaceNightStep 变量声明存在（条件性注入）', () => {
        expect(hunterBlock).toContain('hunterPeaceNightStep');
        expect(hunterBlock).toContain("if (isPeacefulNightHunter)");
    });
});

// ─── T3-T5: 平安夜推断核心内容 ──────────────────────────────────────────────

describe('R131: 猎人平安夜推断步骤核心内容', () => {
    test('T3: 包含「猎人平安夜推断」标题块', () => {
        expect(hunterBlock).toContain('猎人平安夜推断');
    });

    test('T4: 包含枪靶排除逻辑关键词（枪靶排除推断 + 开枪优先级）', () => {
        expect(hunterBlock).toContain('枪靶排除推断');
        expect(hunterBlock).toContain('开枪优先级');
    });

    test('T5: 包含高票存活者推断关键词（高票存活 + 被保护好人）', () => {
        expect(hunterBlock).toContain('票压最高的存活玩家');
        expect(hunterBlock).toContain('被保护好人推断');
    });
});

// ─── T6: 模板插值顺序验证 ─────────────────────────────────────────────────────

describe('R131: 模板插值顺序（hunterDayHistoryStep → hunterPeaceNightStep → Step1）', () => {
    test('T6: ${hunterPeaceNightStep} 在 ${hunterDayHistoryStep} 之后、Step1: 之前', () => {
        const historyPos = hunterBlock.indexOf('${hunterDayHistoryStep}');
        const peacePos = hunterBlock.indexOf('${hunterPeaceNightStep}');
        const step1Pos = hunterBlock.indexOf('Step1:');
        expect(historyPos).toBeGreaterThan(0);
        expect(peacePos).toBeGreaterThan(0);
        expect(step1Pos).toBeGreaterThan(0);
        expect(historyPos).toBeLessThan(peacePos);
        expect(peacePos).toBeLessThan(step1Pos);
    });
});

// ─── T7: 白熊效应合规 ────────────────────────────────────────────────────────

describe('R131: 白熊效应合规（hunterPeaceNightStep 无负向禁令词）', () => {
    test('T7: hunterPeaceNightStep 模板字符串使用正向描述，无「不要/禁止/绝不能/千万别」开头', () => {
        // 提取 hunterPeaceNightStep 模板字符串内容
        const peaceStepStart = hunterBlock.indexOf('hunterPeaceNightStep = `');
        const peaceStepEnd = hunterBlock.indexOf('`;\n', peaceStepStart);
        if (peaceStepStart > 0 && peaceStepEnd > 0) {
            const peaceContent = hunterBlock.slice(peaceStepStart, peaceStepEnd);
            // 验证无白熊效应违规词（负向禁令放在单独行首的指令形式）
            const lines = peaceContent.split('\n');
            lines.forEach(line => {
                const trimmed = line.trim();
                expect(trimmed).not.toMatch(/^(不要|禁止|绝不能|千万别)\s/);
            });
        }
    });
});

// ─── T8: D2+条件门控（speech 指导不分析机制） ────────────────────────────────

describe('R131: 平安夜 speech 层面不暴露机制（正向指导）', () => {
    test('T8: speech 指导包含「继续分析局势」（正向中性表述，与现有策略2对齐）', () => {
        expect(hunterBlock).toContain('继续分析局势');
    });
});

// ─── T9: 回归 — R56 已有 hunterDayHistoryStep 完整保留 ──────────────────────

describe('R131: 回归测试（R56 hunterDayHistoryStep 未破坏）', () => {
    test('T9: hunterDayHistoryStep 仍存在（R56 Step0 读写闭环完整）', () => {
        expect(hunterBlock).toContain('hunterDayHistoryStep');
        expect(hunterBlock).toContain('开枪优先级：高');
    });

    test('T10: R69 个性化发言风格分支（hunterPersonalityLens）仍存在', () => {
        expect(hunterBlock).toContain('hunterPersonalityLens');
        expect(hunterBlock).toContain('hunterPersonalityType');
    });
});
