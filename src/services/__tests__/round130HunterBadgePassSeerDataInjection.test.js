/**
 * Round 130: 猎人 SHERIFF_BADGE_PASS — bpHunterHint 枪×徽协同结构化数据注入
 *
 * 问题（R127 遗留）：
 *   猎人 BADGE_PASS 有 bpHint + bpIdentityStep 专属文本，但缺少「结构化数据注入」——
 *   女巫/守卫/摄梦人均有私有数据块（bpWitchHint/bpGuardHint/bpDreamweaverHint）
 *   将游戏历史过滤到 badgeableSet，生成「候选中存活的优先/回避列表」。
 *   猎人缺少同等的结构化注入，「枪×徽协同 — 目标分离」原则只停留在文字指导层面，
 *   未利用已计算的 killedTargets（查杀候选）和 goldWaterTargets（金水候选）。
 *
 * 优化（R130）：
 *   新增 bpHunterHint 变量：
 *     - 若 killedTargets 中有 badgeable 候选 → 注入「回避传徽 / 枪击首选」提示
 *     - 若 goldWaterTargets 中有 badgeable 候选 → 注入「优先传徽 / 枪击回避」提示
 *     - 复用已计算的 killedTargets/goldWaterTargets，零额外数据读取
 *   模板注入：${bpHunterHint} 追加在 ${bpDreamweaverHint} 之后
 *
 * 博弈论依据：
 *   R127 原则「枪×徽协同：两张牌互补，勿合一」需要结构化数据支撑——
 *   告诉猎人「查杀候选在候选中，回避传徽」比泛化文字描述精准度更高。
 *
 * BADGE_PASS block 大小历史：
 *   R117: 6389 chars → BP_WINDOW=8500
 *   R123: +1525 → 8327 chars → BP_WINDOW=10000
 *   R127: +424 → ~8751 chars → BP_WINDOW=10000 (余量1330)
 *   R130: +~600 → ~9351 chars → BP_WINDOW=10000 (余量~649)
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(__dirname, '../aiPrompts.js'), 'utf8');
const bpStart = src.indexOf('case PROMPT_ACTIONS.SHERIFF_BADGE_PASS:');
const BP_WINDOW = 10000;
const getBpBlock = () => src.slice(bpStart, bpStart + BP_WINDOW);

// ─── T1-T2: 块锚点 + R130 版本标识 ─────────────────────────────────────────

describe('R130: SHERIFF_BADGE_PASS 锚点 + R130 版本标识', () => {
    test('T1: SHERIFF_BADGE_PASS case 块存在（锚点校验）', () => {
        expect(bpStart).toBeGreaterThan(0);
    });

    test('T2: R130 版本注释存在于 BADGE_PASS 块', () => {
        const blk = getBpBlock();
        expect(blk).toContain('R130');
    });
});

// ─── T3-T6: bpHunterHint 变量声明与内容 ─────────────────────────────────────

describe('R130: bpHunterHint 变量声明与内容', () => {
    test('T3: bpHunterHint 变量声明存在（let bpHunterHint）', () => {
        const blk = getBpBlock();
        expect(blk).toContain('let bpHunterHint');
    });

    test("T4: bpHunterHint 以 playerRole === '猎人' 为条件（角色门控）", () => {
        const blk = getBpBlock();
        const hunterHintIdx = blk.indexOf('let bpHunterHint');
        const hunterHintBlock = blk.slice(hunterHintIdx, hunterHintIdx + 600);
        expect(hunterHintBlock).toContain("playerRole === '猎人'");
    });

    test('T5: bpHunterHint 包含「回避传徽」关键词（查杀目标 → 勿传徽）', () => {
        const blk = getBpBlock();
        const hunterHintIdx = blk.indexOf('let bpHunterHint');
        const hunterHintBlock = blk.slice(hunterHintIdx, hunterHintIdx + 600);
        expect(hunterHintBlock).toContain('回避传徽');
    });

    test('T6: bpHunterHint 包含「优先传徽」关键词（金水候选 → 优先传徽）', () => {
        const blk = getBpBlock();
        const hunterHintIdx = blk.indexOf('let bpHunterHint');
        const hunterHintBlock = blk.slice(hunterHintIdx, hunterHintIdx + 600);
        expect(hunterHintBlock).toContain('优先传徽');
    });
});

// ─── T7-T8: bpHunterHint 复用已计算变量 ─────────────────────────────────────

describe('R130: bpHunterHint 复用 killedTargets / goldWaterTargets', () => {
    test('T7: bpHunterHint 块引用 killedTargets（预言家查杀候选）', () => {
        const blk = getBpBlock();
        const hunterHintIdx = blk.indexOf('let bpHunterHint');
        const hunterHintBlock = blk.slice(hunterHintIdx, hunterHintIdx + 600);
        expect(hunterHintBlock).toContain('killedTargets');
    });

    test('T8: bpHunterHint 块引用 goldWaterTargets（金水候选）', () => {
        const blk = getBpBlock();
        const hunterHintIdx = blk.indexOf('let bpHunterHint');
        const hunterHintBlock = blk.slice(hunterHintIdx, hunterHintIdx + 600);
        expect(hunterHintBlock).toContain('goldWaterTargets');
    });
});

// ─── T9: 模板注入 — ${bpHunterHint} 在 return 语句中 ──────────────────────────

describe('R130: 模板注入 ${bpHunterHint}', () => {
    test('T9: return 模板字符串包含 ${bpHunterHint}（注入点存在）', () => {
        const blk = getBpBlock();
        expect(blk).toContain('${bpHunterHint}');
    });
});

// ─── T10: 注入位置顺序 — bpHunterHint 在 bpDreamweaverHint 之后 ──────────────

describe('R130: 注入顺序 — bpHunterHint 跟在 bpDreamweaverHint 之后', () => {
    test('T10: 模板中 bpDreamweaverHint 偏移量 < bpHunterHint 偏移量', () => {
        const blk = getBpBlock();
        const returnIdx = blk.lastIndexOf('return `');
        const returnBlock = blk.slice(returnIdx);
        const dwOffset = returnBlock.indexOf('${bpDreamweaverHint}');
        const hunterOffset = returnBlock.indexOf('${bpHunterHint}');
        expect(dwOffset).toBeGreaterThan(0);
        expect(hunterOffset).toBeGreaterThan(dwOffset);
    });
});

// ─── T11: 白熊效应合规 ───────────────────────────────────────────────────────

describe('R130: 白熊效应合规（R121-C 铁律）', () => {
    test('T11: bpHunterHint 块无「不要」「禁止」「绝不能」「千万别」等负向禁令词', () => {
        const blk = getBpBlock();
        const hunterHintIdx = blk.indexOf('let bpHunterHint');
        const hunterHintBlock = blk.slice(hunterHintIdx, hunterHintIdx + 600);
        expect(hunterHintBlock).not.toContain('不要');
        expect(hunterHintBlock).not.toContain('禁止');
        expect(hunterHintBlock).not.toContain('绝不能');
        expect(hunterHintBlock).not.toContain('千万别');
    });
});

// ─── T12: BP_WINDOW 余量 ─────────────────────────────────────────────────────

describe('R130: BP_WINDOW 余量充足', () => {
    test('T12: BADGE_PASS 输出JSON偏移量 < BP_WINDOW=10000（余量充足）', () => {
        const blk = src.slice(bpStart, bpStart + 20000);
        const jsonOffset = blk.indexOf('输出JSON');
        expect(jsonOffset).toBeGreaterThan(0);
        expect(jsonOffset).toBeLessThan(BP_WINDOW);
    });
});

// ─── T13-T14: 回归测试 — R127/R123/R113 已有内容完整 ─────────────────────────

describe('R130: 回归 — 已有专属分支完整保留', () => {
    test('T13: bpDreamweaverHint 仍存在（R123 未被移除）', () => {
        const blk = getBpBlock();
        expect(blk).toContain('let bpDreamweaverHint');
    });

    test('T14: bpHint 猎人分支「猎人警长」关键词仍存在（R127 文本未被改动）', () => {
        const blk = getBpBlock();
        expect(blk).toContain('猎人警长');
    });
});
