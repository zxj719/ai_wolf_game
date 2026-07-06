/**
 * Round 125: 骑士悍跳骑士 Priority 0 决斗检测
 *
 * 问题：骑士 DAY_SPEECH 的三级优先级 (A/B/C) 均针对概率性场景（对跳预言家、假金水、
 *   紧急救场），缺少针对「其他玩家声称骑士」（悍跳骑士）的处理。
 *   骑士身份全局唯一，任何声称骑士的其他玩家必然撒谎（身份独占规则），
 *   命中率 100%——这是比 A/B/C 更高确定度的决斗触发场景。
 *   claimHistory 中的 jump_knight 类型已存在，数据具备，只缺决策逻辑。
 *
 * 修复（R125）：
 *   1. aiPrompts.js: roleParams 新增 knightCounterClaimants（骑士专用，过滤 jump_knight 类型）
 *   2. knight.js: getKnightDaySpeechPrompt 接受并使用 knightCounterClaimants
 *   3. knight.js: 新增优先级0（悍跳骑士处置）并更新标题为「四级优先级」
 *   4. knight.js: Step0 续战搜索 + Step1 优先级0检查提示
 *
 * 研究依据：Wang 2025 (arxiv:2408.17177) — 角色私有信息注入显著提升 AI 决策质量；
 *   骑士对悍跳骑士的身份独占推断是确定性 100% 的私有信息，是所有决斗场景中最高价值目标。
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const aiPromptsSrc = readFileSync(resolve(__dirname, '../aiPrompts.js'), 'utf8');
const knightSrc = readFileSync(resolve(__dirname, '../rolePrompts/knight.js'), 'utf8');

// ─── T1-T3: aiPrompts.js knightCounterClaimants 参数注入 ─────────────────────

describe('R125: aiPrompts.js — knightCounterClaimants 参数注入', () => {
    test('T1: knightCounterClaimants 键存在于 roleParams 构建块', () => {
        expect(aiPromptsSrc).toContain('knightCounterClaimants:');
    });

    test('T2: knightCounterClaimants 过滤 jump_knight 类型（悍跳骑士识别）', () => {
        const idx = aiPromptsSrc.indexOf('knightCounterClaimants:');
        const block = aiPromptsSrc.slice(idx, idx + 300);
        expect(block).toContain("jump_knight");
    });

    test('T3: knightCounterClaimants 仅在 playerRole === 骑士 时注入（角色隔离）', () => {
        const idx = aiPromptsSrc.indexOf('knightCounterClaimants:');
        const block = aiPromptsSrc.slice(idx, idx + 300);
        expect(block).toContain("playerRole === '骑士'");
    });
});

// ─── T4-T6: knight.js 参数接收 ───────────────────────────────────────────────

describe('R125: knight.js — knightCounterClaimants 参数接收', () => {
    test('T4: getKnightDaySpeechPrompt 从 params 解构 knightCounterClaimants（含默认空数组）', () => {
        const fnIdx = knightSrc.indexOf('export const getKnightDaySpeechPrompt');
        const fnHead = knightSrc.slice(fnIdx, fnIdx + 200);
        expect(fnHead).toContain('knightCounterClaimants = []');
    });

    test('T5: knight.js 使用 knightCounterClaimants.length 检测悍跳骑士', () => {
        expect(knightSrc).toContain('knightCounterClaimants.length');
    });

    test('T6: knight.js 有 hasKnightFakeJumper 布尔判断变量', () => {
        expect(knightSrc).toContain('hasKnightFakeJumper');
    });
});

// ─── T7-T10: knight.js 优先级0 内容完整性 ───────────────────────────────────

describe('R125: knight.js — 优先级0 内容完整性', () => {
    test('T7: 决斗决策系统标题已更新为「四级优先级」', () => {
        expect(knightSrc).toContain('四级优先级');
    });

    test('T8: 优先级0 块包含「100% 确定度」或「100%」标记（无负向禁令词汇）', () => {
        const p0Idx = knightSrc.indexOf('优先级0');
        expect(p0Idx).toBeGreaterThan(0);
        const p0Block = knightSrc.slice(p0Idx, p0Idx + 400);
        expect(p0Block).toMatch(/100%/);
    });

    test('T9: 优先级0 块包含「身份独占规则」说明（博弈论支撑）', () => {
        const p0Idx = knightSrc.indexOf('优先级0');
        const p0Block = knightSrc.slice(p0Idx, p0Idx + 400);
        expect(p0Block).toContain('身份独占规则');
    });

    test('T10: 优先级0 覆盖声明存在（「优先级0覆盖优先级A/B/C」）', () => {
        expect(knightSrc).toContain('优先级0覆盖优先级A/B/C');
    });
});

// ─── T11-T13: knight.js 思维链集成 ──────────────────────────────────────────

describe('R125: knight.js — 思维链 Step 集成', () => {
    test('T11: Step1 包含「优先级0」检查提示', () => {
        const step1Idx = knightSrc.indexOf('Step1: 场上局势分析');
        expect(step1Idx).toBeGreaterThan(0);
        const step1Block = knightSrc.slice(step1Idx, step1Idx + 300);
        expect(step1Block).toContain('优先级0');
    });

    test('T12: 续战搜索（Step0）包含「优先级0」（按优先级 0 > A > B > C 排序）', () => {
        // 验证续战搜索的优先级排序文本已更新
        expect(knightSrc).toContain('按优先级 0 > A > B > C');
    });

    test('T13: 续战搜索中「优先级0/A/B/C」格式存在（候选追加标签更新）', () => {
        expect(knightSrc).toContain('优先级0/A/B/C');
    });
});

// ─── T14-T16: 无悍跳时不输出Priority0（条件化内容）────────────────────────

describe('R125: knight.js — 条件化内容（无悍跳时不输出）', () => {
    test('T14: knightP0Hint 变量在无悍跳时为空字符串（空数组路径）', () => {
        // 验证: 在 knightCounterClaimants.length === 0 的路径下 knightP0Hint = ''
        const p0VarIdx = knightSrc.indexOf('const knightP0Hint');
        expect(p0VarIdx).toBeGreaterThan(0);
        const p0VarBlock = knightSrc.slice(p0VarIdx, p0VarIdx + 300);
        // 三元运算符的 false 分支是空字符串
        expect(p0VarBlock).toContain("''");
    });

    test('T15: knightP0Hint 插入点在模板中存在（${knightP0Hint} 占位符）', () => {
        expect(knightSrc).toContain('${knightP0Hint}');
    });

    test('T16: R125 注释标识存在于 knight.js（版本追踪）', () => {
        expect(knightSrc).toContain('R125');
    });
});
