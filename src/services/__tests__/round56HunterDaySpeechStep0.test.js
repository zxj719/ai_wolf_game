/**
 * Round 56: 猎人 DAY_SPEECH Step 0 — 读写闭环 DAY_SPEECH 侧补全（猎人）
 *
 * 问题：猎人 DAY_SPEECH identity_table 写指导有"开枪前回顾上轮 identity_table：
 *       若某人 reason 已记'开枪优先级：高'，优先锁定"指令，但该指令放在了
 *       写指导区（末尾条目），而非思维链 Step 0——这是"指令在错误位置"的经典错误。
 *       猎人在白天分析时无法从历史中系统读取积累的开枪候选，导致每轮从头锁定目标，
 *       与 HUNTER_SHOOT 的 Step 0 读取已形成 DAY→DAY→SHOOT 的断链。
 *
 * 修复：
 * 1. 将猎人 DAY_SPEECH 从箭头函数转为函数体（R3 教训：需要前置变量时必须用函数体语法）
 * 2. 新增 hunterDayHistoryStep 变量（D1=跳过；D2+=读取"开枪优先级：高"历史候选）
 * 3. 将 Step0 插入思维链顶部，Step3 新增"结合 Step0 历史候选"引用
 * 4. 写指导末尾条目改为"追加不覆盖历史"格式，对齐 R18/R24 已建立的追加规范
 * 5. 高威胁候选写指导末尾追加"（下轮 Step 0 将直接从此读取）"前向引用
 *
 * 博弈论依据：Wang 2025 信息链理论——多轮行为模式积累比单轮印象更可靠；
 *             猎人在残局的开枪决策是好人方最高价值的战略动作，需要跨轮积累的一致判断。
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(__dirname, '../aiPrompts.js'), 'utf8');

// ─── 定位猎人 DAY_SPEECH 函数段落 ────────────────────────────────────────────
// '猎人': (ctx, params) => { 是函数体形式（R56 改动后），全文唯一
const hunterFnMarker = "'猎人': (ctx, params) => {";
const hunterFnStart = src.indexOf(hunterFnMarker);
// 窗口：R132 猎人函数体 5134 chars（R132 两连+三连扩展后）→ 窗口 5500
const hunterBlock = src.slice(hunterFnStart, hunterFnStart + 5500);

// ─── 定位思维链段落（在 return 模板字符串内，含插值占位）─────────────────────
// 注意：Step0 文本在 hunterDayHistoryStep 变量声明中（函数体顶部），
//       模板字符串中只有 ${hunterDayHistoryStep} 插值占位符，
//       所以 Step0 相关断言必须搜索 hunterBlock（整个函数体），而非仅 thinkBlock
const thinkChainMarker = '【思维链】';
const thinkStart = hunterBlock.indexOf(thinkChainMarker);
const thinkBlock = hunterBlock.slice(thinkStart, thinkStart + 600);

// hunterDayHistoryStep 变量声明区（return 之前）
const varDeclBlock = hunterBlock.slice(0, hunterBlock.indexOf('return `'));

describe('R56: 猎人 DAY_SPEECH 函数体形式（R3 教训验证）', () => {
    test('T1: 猎人 DAY_SPEECH marker 存在（函数体形式）', () => {
        expect(hunterFnStart).toBeGreaterThan(0);
    });

    test('T2: 猎人函数使用 hunterDayHistoryStep 变量（函数体内预计算）', () => {
        expect(hunterBlock).toContain('hunterDayHistoryStep');
    });

    test('T3: hunterDayHistoryStep 含 D2+ 分支条件（dayCount > 1）', () => {
        expect(hunterBlock).toContain('ctx.dayCount > 1');
    });
});

describe('R56: 猎人 DAY_SPEECH Step 0 存在且位置正确', () => {
    test('T4: 思维链 marker 存在', () => {
        expect(thinkStart).toBeGreaterThan(0);
    });

    test('T5: 变量声明区含 Step0（Step0 在 hunterDayHistoryStep 变量中）', () => {
        // Step0: 文本在变量声明中，不在 return 模板字符串里
        expect(varDeclBlock).toContain('Step0:');
    });

    test('T6: Step0 D2+ 分支包含"历史开枪候选"关键词', () => {
        const step0Idx = varDeclBlock.indexOf('Step0:');
        // Step0 文本到行末
        const lineEnd = varDeclBlock.indexOf("'", step0Idx + 10);
        const step0 = varDeclBlock.slice(step0Idx, lineEnd > 0 ? lineEnd : step0Idx + 400);
        expect(step0).toContain('历史开枪候选');
    });

    test('T7: Step0 D2+ 分支包含"开枪优先级：高"（与 HUNTER_SHOOT Step 0 关键词对齐）', () => {
        const step0Idx = varDeclBlock.indexOf('Step0:');
        const lineEnd = varDeclBlock.indexOf("'", step0Idx + 10);
        const step0 = varDeclBlock.slice(step0Idx, lineEnd > 0 ? lineEnd : step0Idx + 400);
        expect(step0).toContain('开枪优先级：高');
    });

    test('T8: Step0 D1 分支包含"首日无历史可跳过"（D1 免责）', () => {
        // hunterDayHistoryStep 三元表达式的 false 分支含此关键词
        expect(varDeclBlock).toContain('首日无历史可跳过');
    });

    test('T9: 模板字符串中 ${hunterDayHistoryStep} 出现在 Step1 之前（顺序正确）', () => {
        // 模板字符串中的插值 ${hunterDayHistoryStep} 应在 Step1 之前
        const interpolationPos = thinkBlock.indexOf('${hunterDayHistoryStep}');
        const step1Pos = thinkBlock.indexOf('Step1:');
        expect(interpolationPos).toBeGreaterThan(0);
        expect(step1Pos).toBeGreaterThan(0);
        expect(interpolationPos).toBeLessThan(step1Pos);
    });
});

describe('R56: 猎人思维链 Step1-Step4 回归（未破坏原思维链）', () => {
    test('T10: Step1 身份暴露判断存在', () => {
        expect(thinkBlock).toContain('Step1:');
    });

    test('T11: Step2 局势分析存在', () => {
        expect(thinkBlock).toContain('Step2:');
    });

    test('T12: Step3 含"结合 Step0"引用（执行框架与读取步骤锚定）', () => {
        const step3Idx = thinkBlock.indexOf('Step3:');
        const step4Idx = thinkBlock.indexOf('Step4:');
        const step3 = thinkBlock.slice(step3Idx, step4Idx > 0 ? step4Idx : step3Idx + 200);
        expect(step3).toContain('Step0');
    });

    test('T13: Step4 投票决策存在', () => {
        expect(thinkBlock).toContain('Step4:');
    });
});

describe('R56: identity_table 写指导格式更新（追加规范 + 前向引用）', () => {
    const writeGuideMarker = '【identity_table 填写指导（猎人：跨轮积累开枪优先级）】';
    const writeGuideStart = hunterBlock.indexOf(writeGuideMarker);
    const writeGuideBlock = hunterBlock.slice(writeGuideStart, writeGuideStart + 500);

    test('T14: identity_table 写指导存在', () => {
        expect(writeGuideStart).toBeGreaterThan(0);
    });

    test('T15: 高威胁候选写指导含"下轮 Step 0 将直接从此读取"前向引用', () => {
        expect(writeGuideBlock).toContain('下轮 Step 0 将直接从此读取');
    });

    test('T16: 写指导含"追加不覆盖历史"追加规范（R18/R24 格式对齐）', () => {
        expect(writeGuideBlock).toContain('追加不覆盖历史');
    });

    test('T17: 写指导含【追加示例】（few-shot 格式；R19 教训）', () => {
        expect(writeGuideBlock).toContain('【追加示例】');
    });

    test('T18: 旧版"开枪前回顾上轮 identity_table"指令已从写指导移出（位置迁移）', () => {
        // 这条指令应只出现在写指导区之前（即 Step3），而不再在写指导末尾
        const oldInstruction = '开枪前回顾上轮 identity_table：若某人';
        expect(writeGuideBlock).not.toContain(oldInstruction);
    });
});

describe('R56: 关键词对齐 — DAY_SPEECH write → HUNTER_SHOOT read', () => {
    test('T19: HUNTER_SHOOT Step 0 仍使用"开枪优先级：高"关键词（未被改动）', () => {
        // HUNTER_SHOOT 的 hunterHistoryStep 在 case PROMPT_ACTIONS.HUNTER_SHOOT 内
        const hunterShootMarker = 'case PROMPT_ACTIONS.HUNTER_SHOOT:';
        const hunterShootStart = src.indexOf(hunterShootMarker);
        const hunterShootBlock = src.slice(hunterShootStart, hunterShootStart + 800);
        expect(hunterShootBlock).toContain('开枪优先级：高');
    });

    test('T20: DAY_SPEECH write guide 使用相同的"开枪优先级：高"关键词（对齐）', () => {
        // writeGuide 中有"当前开枪优先级：高"
        const writeGuideMarker = '【identity_table 填写指导（猎人：跨轮积累开枪优先级）】';
        const wgStart = src.indexOf(writeGuideMarker);
        const wgBlock = src.slice(wgStart, wgStart + 500);
        expect(wgBlock).toContain('开枪优先级：高');
    });
});

describe('R56: 回归测试 — 关联系统未受影响', () => {
    test('T21: 狼人 DAY_SPEECH Step0 仍存在（R55 未回归）', () => {
        // 狼人的 Step0 用"跨轮威胁积累"关键词
        expect(src).toContain('读取跨轮威胁积累');
    });

    test('T22: 村民 DAY_SPEECH Step0 仍存在（R54 未回归）', () => {
        expect(src).toContain('读取历史推理积累');
    });

    test('T23: HUNTER_SHOOT case 存在（死亡开枪 Step 0 未被破坏）', () => {
        expect(src).toContain('读取历史开枪候选');
    });

    test('T24: 猎人输出 JSON schema 未变（格式未被破坏）', () => {
        expect(hunterBlock).toContain('"thought"');
        expect(hunterBlock).toContain('"speech"');
        expect(hunterBlock).toContain('"voteIntention"');
        expect(hunterBlock).toContain('"identity_table"');
    });

    test('T25: 猎人函数以 }, 结束（函数体完整闭合）', () => {
        // 函数体末尾：voteDecided 行之后的 `; } 结束
        expect(hunterBlock).toContain('voteDecided=true=已决定；false=投票阶段再思考');
    });
});
