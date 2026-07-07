/**
 * Round 133: LAST_WORDS 补全警长传徽声明提示 — 守卫/女巫/骑士/摄梦人/魔术师
 *
 * 问题：LAST_WORDS 中"警长传徽声明"提示仅预言家（R54 ④警徽流建议）和
 *   猎人（R128 🎖️hunterBadgeHint）有专属提示；
 *   守卫/女巫/骑士/摄梦人/魔术师作为警长死亡时，遗言中缺少声明传徽意向的引导。
 *
 * 修复（R133）：
 *   1. 女巫：witchBadgeHint — 银水好人优先，其次金水候选
 *   2. 守卫：guardBadgeHint — 守护次数最多的存活好人优先
 *   3. 骑士：knightBadgeHint — 金水候选优先，发言最可信次之
 *   4. 摄梦人：dwBadgeHint — 入梦次数最多的存活好人优先
 *   5. 魔术师：magBadgeHint — 交换记录确认的可信好人或金水候选
 *   全部以 hasPoliceFlow && currentPlayer?.isSheriff 门控，非警长死亡时静默。
 *   同步升级 LW_WINDOW: 7000→9000（block 5286→6640，余量 360→2360）。
 *
 * 研究依据：Wang 2025 (arxiv:2408.17177) — 警长临死时在遗言中公开传徽意向
 *   为好人阵营提供票权延续信号；与 BADGE_PASS（实际决策）互补：
 *   LAST_WORDS 是"说什么"（信息展示），BADGE_PASS 是"决定什么"（结构化 JSON）。
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(__dirname, '../aiPrompts.js'), 'utf8');
const lwStart = src.indexOf('case PROMPT_ACTIONS.LAST_WORDS: {');
const LW_WINDOW = 9000; // R133: 升级后的窗口大小
const getLwBlock = () => src.slice(lwStart, lwStart + LW_WINDOW);

// ─── T1: 锚点 ─────────────────────────────────────────────────────────────────

describe('R133: LAST_WORDS 锚点存在', () => {
    test('T1: LAST_WORDS case 块存在', () => {
        expect(lwStart).toBeGreaterThan(0);
    });
});

// ─── T2-T4: 女巫 witchBadgeHint ───────────────────────────────────────────────

describe('R133: 女巫 witchBadgeHint — 银水好人优先传徽', () => {
    test('T2: witchBadgeHint 变量声明存在', () => {
        const blk = getLwBlock();
        expect(blk).toContain('const witchBadgeHint = hasPoliceFlow && (currentPlayer?.isSheriff ?? false)');
    });

    test('T3: witchBadgeHint 内容包含"银水好人"关键词（女巫私有信任信号）', () => {
        const blk = getLwBlock();
        const varIdx = blk.indexOf('const witchBadgeHint =');
        const hintBlock = blk.slice(varIdx, varIdx + 350);
        expect(hintBlock).toContain('银水好人');
    });

    test('T4: witchBadgeHint 插值在女巫 lwRoleHint 末尾（${witchBadgeHint} 追加）', () => {
        const blk = getLwBlock();
        const lwRoleHintWitch = blk.indexOf('lwRoleHint = `你是女巫');
        const witchHintRefIdx = blk.indexOf('${witchBadgeHint}', lwRoleHintWitch);
        expect(lwRoleHintWitch).toBeGreaterThan(0);
        expect(witchHintRefIdx).toBeGreaterThan(lwRoleHintWitch);
        expect(witchHintRefIdx - lwRoleHintWitch).toBeLessThan(400);
    });
});

// ─── T5-T7: 守卫 guardBadgeHint ──────────────────────────────────────────────

describe('R133: 守卫 guardBadgeHint — 守护频次最高者优先', () => {
    test('T5: guardBadgeHint 变量声明存在', () => {
        const blk = getLwBlock();
        expect(blk).toContain('const guardBadgeHint = hasPoliceFlow && (currentPlayer?.isSheriff ?? false)');
    });

    test('T6: guardBadgeHint 内容包含"守护次数"关键词（守卫私有信任信号）', () => {
        const blk = getLwBlock();
        const varIdx = blk.indexOf('const guardBadgeHint =');
        const hintBlock = blk.slice(varIdx, varIdx + 350);
        expect(hintBlock).toContain('守护次数');
    });

    test('T7: guardBadgeHint 插值在守卫 lwRoleHint 末尾', () => {
        const blk = getLwBlock();
        const lwRoleHintGuard = blk.indexOf('lwRoleHint = `你是守卫');
        const guardHintRefIdx = blk.indexOf('${guardBadgeHint}', lwRoleHintGuard);
        expect(lwRoleHintGuard).toBeGreaterThan(0);
        expect(guardHintRefIdx).toBeGreaterThan(lwRoleHintGuard);
        expect(guardHintRefIdx - lwRoleHintGuard).toBeLessThan(350);
    });
});

// ─── T8-T10: 骑士 knightBadgeHint ────────────────────────────────────────────

describe('R133: 骑士 knightBadgeHint — 金水优先，发言最可信次之', () => {
    test('T8: knightBadgeHint 变量声明存在', () => {
        const blk = getLwBlock();
        expect(blk).toContain('const knightBadgeHint = hasPoliceFlow && (currentPlayer?.isSheriff ?? false)');
    });

    test('T9: knightBadgeHint 内容包含"金水"关键词（金水优先锚点）', () => {
        const blk = getLwBlock();
        const varIdx = blk.indexOf('const knightBadgeHint =');
        const hintBlock = blk.slice(varIdx, varIdx + 350);
        expect(hintBlock).toContain('金水');
    });

    test('T10: knightBadgeHint 插值在骑士 lwRoleHint 末尾', () => {
        const blk = getLwBlock();
        const lwRoleHintKnight = blk.indexOf('lwRoleHint = `你是骑士');
        const knightHintRefIdx = blk.indexOf('${knightBadgeHint}', lwRoleHintKnight);
        expect(lwRoleHintKnight).toBeGreaterThan(0);
        expect(knightHintRefIdx).toBeGreaterThan(lwRoleHintKnight);
        expect(knightHintRefIdx - lwRoleHintKnight).toBeLessThan(350);
    });
});

// ─── T11-T13: 摄梦人 dwBadgeHint ─────────────────────────────────────────────

describe('R133: 摄梦人 dwBadgeHint — 入梦次数最多存活好人优先', () => {
    test('T11: dwBadgeHint 变量声明存在', () => {
        const blk = getLwBlock();
        expect(blk).toContain('const dwBadgeHint = hasPoliceFlow && (currentPlayer?.isSheriff ?? false)');
    });

    test('T12: dwBadgeHint 内容包含"入梦次数"关键词（摄梦人私有信任信号）', () => {
        const blk = getLwBlock();
        const varIdx = blk.indexOf('const dwBadgeHint =');
        const hintBlock = blk.slice(varIdx, varIdx + 400);
        expect(hintBlock).toContain('入梦次数');
    });

    test('T13: dwBadgeHint 插值在摄梦人 lwRoleHint 末尾', () => {
        const blk = getLwBlock();
        const lwRoleHintDw = blk.indexOf('lwRoleHint = `你是摄梦人');
        const dwHintRefIdx = blk.indexOf('${dwBadgeHint}', lwRoleHintDw);
        expect(lwRoleHintDw).toBeGreaterThan(0);
        expect(dwHintRefIdx).toBeGreaterThan(lwRoleHintDw);
        expect(dwHintRefIdx - lwRoleHintDw).toBeLessThan(450);
    });
});

// ─── T14-T16: 魔术师 magBadgeHint ────────────────────────────────────────────

describe('R133: 魔术师 magBadgeHint — 交换记录确认好人或金水候选', () => {
    test('T14: magBadgeHint 变量声明存在', () => {
        const blk = getLwBlock();
        expect(blk).toContain('const magBadgeHint = hasPoliceFlow && (currentPlayer?.isSheriff ?? false)');
    });

    test('T15: magBadgeHint 内容包含"交换记录"关键词（魔术师私有信息）', () => {
        const blk = getLwBlock();
        const varIdx = blk.indexOf('const magBadgeHint =');
        const hintBlock = blk.slice(varIdx, varIdx + 400);
        expect(hintBlock).toContain('交换记录');
    });

    test('T16: magBadgeHint 插值在魔术师 lwRoleHint 末尾', () => {
        const blk = getLwBlock();
        const lwRoleHintMag = blk.indexOf('lwRoleHint = `你是魔术师');
        const magHintRefIdx = blk.indexOf('${magBadgeHint}', lwRoleHintMag);
        expect(lwRoleHintMag).toBeGreaterThan(0);
        expect(magHintRefIdx).toBeGreaterThan(lwRoleHintMag);
        expect(magHintRefIdx - lwRoleHintMag).toBeLessThan(500);
    });
});

// ─── T17: 条件门控对称性（5个 badge hints 均有 hasPoliceFlow && isSheriff 门控）───

describe('R133: 条件门控对称性（全部 5 个 badge hints 均有 hasPoliceFlow && isSheriff 门控）', () => {
    test('T17: 5 个 badge hint 声明均包含 hasPoliceFlow && (currentPlayer?.isSheriff ?? false)', () => {
        const blk = getLwBlock();
        const gatePhrase = 'hasPoliceFlow && (currentPlayer?.isSheriff ?? false)';
        // Count all badge hint declarations with this gate
        const pattern = new RegExp(`const (?:witch|guard|knight|dw|mag)BadgeHint = ${gatePhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
        const matches = blk.match(pattern) || [];
        expect(matches.length).toBe(5);
    });
});

// ─── T18: LW_WINDOW 余量验证 ─────────────────────────────────────────────────

describe('R133: LW_WINDOW 余量验证（9000，余量 ≥ 300）', () => {
    test('T18: LW block size ≤ 9000（R133 新增 5 个 badge hint 后余量充足）', () => {
        const lwEnd = src.indexOf('case PROMPT_ACTIONS.SUMMARIZE_CONTENT:', lwStart);
        const blockSize = lwEnd - lwStart;
        // 当前 block: 6640 chars，余量: 9000-6640=2360 chars（安全线300✅）
        expect(blockSize).toBeLessThanOrEqual(9000);
    });

    test('T19: 5个 badge hints 的🎖️前缀均在 LW_WINDOW 内（窗口不截断）', () => {
        const blk = getLwBlock();
        // 所有 badge hints 都有 🎖️ 前缀
        const badgeEmoji = '🎖️【你也是警长】';
        const firstBadgeIdx = blk.indexOf(badgeEmoji);
        expect(firstBadgeIdx).toBeGreaterThan(0);
        // At least 3 occurrences (witch/guard/knight/dw/mag) all within window
        const allOccurrences = [];
        let searchFrom = 0;
        while (true) {
            const idx = blk.indexOf(badgeEmoji, searchFrom);
            if (idx === -1) break;
            allOccurrences.push(idx);
            searchFrom = idx + 1;
        }
        expect(allOccurrences.length).toBeGreaterThanOrEqual(5);
    });
});
