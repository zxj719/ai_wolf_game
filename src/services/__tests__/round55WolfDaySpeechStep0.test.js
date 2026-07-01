/**
 * Round 55: 狼人 DAY_SPEECH Step 0 — 读写闭环补全（日间读取跨轮威胁积累）
 *
 * 问题：R38-R44 修复了 NIGHT_* case 的读写闭环（NIGHT_WOLF Step 0 读取 identity_table），
 *       R54 补全了村民 DAY_SPEECH Step 0。但狼人 DAY_SPEECH 仍无 Step 0：
 *       狼人在白天发言时无法从历史 identity_table 读取积累的"高优先刀口"威胁笔记，
 *       每轮从头进行 Step2 威胁识别，丧失了多轮积累的战略一致性。
 *
 * 修复：
 * 狼人 DAY_SPEECH 思维框架新增 Step0（读取跨轮威胁积累，D2+适用），
 * 引导 AI 从身份推理表中读取"高优先刀口"标注，以此为 Step2 威胁识别的起点，
 * 保持白天言行与夜间刀目标计划的一致性。
 *
 * 博弈论依据：Wang 2025 信息链理论——多轮战略一致性是 AI 狼人杀中狼方的核心竞争力，
 *             没有 Step 0 等于每轮抛弃所有历史威胁评估。
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(__dirname, '../aiPrompts.js'), 'utf8');

// ─── 定位狼人 DAY_SPEECH 思维框架段落 ────────────────────────────────────────
// "思维框架（在 thought 中完成，不要写进 speech）" 是全文唯一（grep -c 验证为 1）
const wolfThinkMarker = '【思维框架（在 thought 中完成，不要写进 speech）】';
const wolfThinkStart = src.indexOf(wolfThinkMarker);
// 窗口：Step1-Step5 约 500 chars，Step0 约 200 chars，共约 700 chars → 窗口 1200
const wolfThinkBlock = src.slice(wolfThinkStart, wolfThinkStart + 1200);

describe('R55: 狼人 DAY_SPEECH Step 0 存在', () => {
    test('T1: 狼人思维框架 marker 存在（唯一锚点）', () => {
        expect(wolfThinkStart).toBeGreaterThan(0);
    });

    test('T2: 思维框架包含 Step0', () => {
        expect(wolfThinkBlock).toContain('Step0:');
    });

    test('T3: Step0 包含"跨轮威胁积累"关键词', () => {
        const step0Line = wolfThinkBlock.slice(wolfThinkBlock.indexOf('Step0:'));
        const step0End = step0Line.indexOf('Step1');
        const step0 = step0Line.slice(0, step0End);
        expect(step0).toContain('跨轮威胁积累');
    });

    test('T4: Step0 包含"身份推理表"关键词', () => {
        const step0Line = wolfThinkBlock.slice(wolfThinkBlock.indexOf('Step0:'));
        const step0End = step0Line.indexOf('Step1');
        const step0 = step0Line.slice(0, step0End);
        expect(step0).toContain('身份推理表');
    });

    test('T5: Step0 包含"高优先刀口"跨轮读取关键词（与 NIGHT_WOLF write guide 关键词对齐）', () => {
        const step0Line = wolfThinkBlock.slice(wolfThinkBlock.indexOf('Step0:'));
        const step0End = step0Line.indexOf('Step1');
        const step0 = step0Line.slice(0, step0End);
        expect(step0).toContain('高优先刀口');
    });

    test('T6: Step0 包含"首日无历史可跳过"（D1 免责）', () => {
        const step0Line = wolfThinkBlock.slice(wolfThinkBlock.indexOf('Step0:'));
        const step0End = step0Line.indexOf('Step1');
        const step0 = step0Line.slice(0, step0End);
        expect(step0).toContain('首日无历史可跳过');
    });

    test('T7: Step0 在 Step1 之前（顺序正确）', () => {
        const step0Pos = wolfThinkBlock.indexOf('Step0:');
        const step1Pos = wolfThinkBlock.indexOf('Step1');
        expect(step0Pos).toBeLessThan(step1Pos);
    });
});

describe('R55: 狼人 DAY_SPEECH Step1-Step5 回归（未破坏原思维链）', () => {
    test('T8: Step1 局势评估存在', () => {
        expect(wolfThinkBlock).toContain('Step1');
    });

    test('T9: Step2 威胁识别存在', () => {
        expect(wolfThinkBlock).toContain('Step2');
    });

    test('T10: Step3 行动空间存在', () => {
        expect(wolfThinkBlock).toContain('Step3');
    });

    test('T11: Step4 最优行动存在', () => {
        expect(wolfThinkBlock).toContain('Step4');
    });

    test('T12: Step5 投票规划存在', () => {
        expect(wolfThinkBlock).toContain('Step5');
    });
});

describe('R55: 回归测试 — 关联系统未受影响', () => {
    test('T13: 狼人 identity_table 写指导仍存在（高优先刀口 write 路径）', () => {
        // 狼人 DAY_SPEECH 的 write 指导紧跟在思维框架之后
        const wolfSection = src.slice(wolfThinkStart, wolfThinkStart + 2000);
        expect(wolfSection).toContain('identity_table 填写策略');
    });

    test('T14: NIGHT_WOLF Step0 仍存在（夜间读写闭环未被破坏）', () => {
        // NIGHT_WOLF case 在 generateUserPrompt switch 里，有独立的 Step 0 读取
        expect(src).toContain('NIGHT_WOLF Step 0');
    });

    test('T15: 村民 DAY_SPEECH Step0 仍存在（R54 未回归）', () => {
        expect(src).toContain('读取历史推理积累');
    });

    test('T16: 狼人 Step0 与村民 Step0 格式一致（"首日无历史可跳过"双方都有）', () => {
        const wolfStep0Start = wolfThinkBlock.indexOf('Step0:');
        const wolfStep0End = wolfThinkBlock.indexOf('Step1');
        const wolfStep0 = wolfThinkBlock.slice(wolfStep0Start, wolfStep0End);
        expect(wolfStep0).toContain('首日无历史可跳过');
        // 村民的 Step0 也含此句（R54 验证；R67 改为函数体语法，用新标记定位）
        const villagerMarker = "'村民': (ctx, params) => {";
        const villagerStart = src.indexOf(villagerMarker);
        const villagerBlock = src.slice(villagerStart, villagerStart + 5500);
        expect(villagerBlock).toContain('首日无历史可跳过');
    });

    test('T17: 狼人 speech 输出 schema 未变（未破坏输出格式）', () => {
        // 找到狼人 output JSON 行
        const wolfSectionLong = src.slice(wolfThinkStart, wolfThinkStart + 3000);
        expect(wolfSectionLong).toContain('"thought"');
        expect(wolfSectionLong).toContain('"speech"');
        expect(wolfSectionLong).toContain('"voteIntention"');
        expect(wolfSectionLong).toContain('"identity_table"');
    });
});
