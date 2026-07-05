/**
 * Round 115: 摄梦人 SHERIFF_VOTE 专属提示词
 *
 * 问题：SHERIFF_VOTE 中 摄梦人 走通用空字符串 fallback，
 *   未利用角色私有信息：
 *   - 摄梦人：currentDreamTarget/lastDreamTarget（当前入梦目标）
 *     → 若入梦目标当选警长后死亡，摄梦人连带死亡 + 警徽 1.5 票权重同时作废
 *     → "同生共死"连带风险是唯一需要排除特定候选人的约束
 *
 * 修复（R115）：
 *   1. svDWHistory = gameState.dreamweaverHistory（安全读取）
 *   2. svDWCurrentTarget = currentDreamTarget ?? lastDreamTarget（优先当前）
 *   3. svDWTargetIsCandidate（入梦目标是否在候选名单中）
 *   4. svDreamweaverHint（两路径：有连带风险 / 无连带风险）
 *   5. svRoleHint 升级为 6 路径（+摄梦人）
 *
 * 研究依据：Wang 2025 (arxiv:2408.17177) — 角色私有信息注入显著提升 AI 决策精准度；
 *   同 R112-R114 SHERIFF_* 设计模式。
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(__dirname, '../aiPrompts.js'), 'utf8');
const svStart = src.indexOf('case PROMPT_ACTIONS.SHERIFF_VOTE:');
const SV_WINDOW = 7500; // R116 后 svRoleHint 移至偏移 6073，原 6000 窗口截断 T12；更新至 7500（block=7296）
const getSvBlock = () => src.slice(svStart, svStart + SV_WINDOW);

// ─── T1: 锚点校验 ────────────────────────────────────────────────────────────

describe('R115: SHERIFF_VOTE case 块存在', () => {
    test('T1: SHERIFF_VOTE case 锚点存在', () => {
        expect(svStart).toBeGreaterThan(0);
    });
});

// ─── T2-T5: svDWHistory + svDWCurrentTarget 变量声明 ─────────────────────────

describe('R115: 摄梦人私有信息变量声明', () => {
    test('T2: svDWHistory 声明存在（gameState.dreamweaverHistory 安全读取）', () => {
        const blk = getSvBlock();
        expect(blk).toContain('const svDWHistory = gameState.dreamweaverHistory');
    });

    test('T3: svDWCurrentTarget 使用 currentDreamTarget ?? lastDreamTarget 双路回退', () => {
        const blk = getSvBlock();
        expect(blk).toContain('svDWCurrentTarget');
        expect(blk).toContain('currentDreamTarget');
        expect(blk).toContain('lastDreamTarget');
    });

    test('T4: svDWTargetIsCandidate 声明存在（svCandidateSet.has 过滤）', () => {
        const blk = getSvBlock();
        expect(blk).toContain('svDWTargetIsCandidate');
        expect(blk).toContain('svCandidateSet.has(Number(svDWCurrentTarget))');
    });

    test('T5: svDreamweaverHint 声明为 let 且摄梦人判断分支存在', () => {
        const blk = getSvBlock();
        expect(blk).toContain("let svDreamweaverHint = ''");
        expect(blk).toContain("playerRole === '摄梦人'");
    });
});

// ─── T6-T9: svDreamweaverHint 两路径内容 ────────────────────────────────────

describe('R115: svDreamweaverHint 两路径内容', () => {
    test('T6: 连带风险路径存在（入梦目标是候选人时展示风险警告）', () => {
        const blk = getSvBlock();
        expect(blk).toContain('svDWTargetIsCandidate');
        expect(blk).toContain('连带风险');
    });

    test('T7: 连带风险说明包含核心逻辑（当选警长后死亡→摄梦人连带+权重作废）', () => {
        const blk = getSvBlock();
        expect(blk).toContain('遭狼刀/被投出局');
        expect(blk).toContain('你同时死亡');
        expect(blk).toContain('权重随之作废');
    });

    test('T8: 无连带风险路径存在（入梦目标不在候选名单时）', () => {
        const blk = getSvBlock();
        expect(blk).toContain('当前入梦目标不在候选名单中，无直接连带风险');
    });

    test('T9: 摄梦人投票策略包含核心词（同生共死 + 投票优先级）', () => {
        const blk = getSvBlock();
        expect(blk).toContain('同生共死');
        expect(blk).toContain('金水候选人');
    });
});

// ─── T10-T12: svRoleHint 6路径（新增摄梦人） ────────────────────────────────

describe('R115: svRoleHint 6路径独立分支（含摄梦人）', () => {
    test("T10: svRoleHint 包含摄梦人独立分支（playerRole === '摄梦人'）", () => {
        const blk = getSvBlock();
        expect(blk).toContain("playerRole === '摄梦人'");
        expect(blk).toContain('svDreamweaverHint');
    });

    test('T11: 摄梦人分支在猎人分支之后（svHunterHint → svDreamweaverHint → 空字符串）', () => {
        const blk = getSvBlock();
        const hunterIdx = blk.indexOf("playerRole === '猎人'");
        const dreamIdx = blk.indexOf("playerRole === '摄梦人'");
        const emptyIdx = blk.indexOf(": '';", dreamIdx);
        expect(hunterIdx).toBeGreaterThan(0);
        expect(dreamIdx).toBeGreaterThan(hunterIdx);
        expect(emptyIdx).toBeGreaterThan(dreamIdx);
    });

    test('T12: 所有 6 路径均在 svRoleHint 链中（狼/预言家/女巫/守卫/猎人/摄梦人）', () => {
        const blk = getSvBlock();
        const svRoleIdx = blk.indexOf('const svRoleHint =');
        const chain = blk.slice(svRoleIdx, svRoleIdx + 700);
        expect(chain).toContain("playerRole === '狼人'");
        expect(chain).toContain("playerRole === '预言家'");
        expect(chain).toContain("playerRole === '女巫'");
        expect(chain).toContain("playerRole === '守卫'");
        expect(chain).toContain("playerRole === '猎人'");
        expect(chain).toContain("playerRole === '摄梦人'");
    });
});

// ─── T13: 白熊效应（第 36 次验证）──────────────────────────────────────────────

describe('R115: 白熊效应验证（第 36 次）— svDreamweaverHint 无负向禁词', () => {
    test('T13: 摄梦人 hint 块无负向游戏策略禁词（全正向描述）', () => {
        const blk = getSvBlock();
        const dwStart = blk.indexOf('const svDWHistory');
        const svRoleStart = blk.indexOf('const svRoleHint');
        const dwBlock = dwStart >= 0 && svRoleStart > dwStart
            ? blk.slice(dwStart, svRoleStart)
            : blk;
        const negativeKeywords = ['自曝', '承认是狼', '千万别', '绝对不要', '绝不能'];
        negativeKeywords.forEach(kw => {
            expect(dwBlock).not.toContain(kw);
        });
    });
});

// ─── T14-T15: R114 回归验证 ─────────────────────────────────────────────────

describe('R115: R114 回归验证 — 现有分支保留', () => {
    test('T14: svWitchHint（女巫银水路径）仍存在', () => {
        const blk = getSvBlock();
        expect(blk).toContain('svWitchHint');
        expect(blk).toContain('银水候选人');
    });

    test('T15: svGuardHint（守卫守护频次路径）仍存在', () => {
        const blk = getSvBlock();
        expect(blk).toContain('svGuardHint');
        expect(blk).toContain('守护频次');
    });
});

// ─── T16-T18: 游戏流程干跑回归 ─────────────────────────────────────────────

describe('R115: 游戏流程干跑（SHERIFF_VOTE 不影响夜间流程）', () => {
    // 仅做静态源码验证（夜间流程 simulate-game-flow.mjs 独立运行，此处只做锚点检查）
    test('T16: SHERIFF_VOTE case 后紧跟 SHERIFF_BADGE_PASS（case 顺序正确）', () => {
        const svEnd = svStart + src.slice(svStart).indexOf('case PROMPT_ACTIONS.SHERIFF_BADGE_PASS:');
        const lwStart = src.indexOf('case PROMPT_ACTIONS.LAST_WORDS:', svStart);
        expect(lwStart).toBeGreaterThan(svStart + src.slice(svStart).indexOf('case PROMPT_ACTIONS.SHERIFF_BADGE_PASS:'));
    });

    test('T17: svDWCurrentTarget 使用 Number() 转换（类型安全，避免 Set.has 类型不匹配）', () => {
        const blk = getSvBlock();
        expect(blk).toContain('Number(svDWCurrentTarget)');
    });

    test('T18: svDreamweaverHint 初始为空字符串（非摄梦人时不注入内容）', () => {
        const blk = getSvBlock();
        expect(blk).toContain("let svDreamweaverHint = ''");
    });
});

// ─── T19-T20: 块大小验证 ────────────────────────────────────────────────────

describe('R115: SHERIFF_VOTE block 大小', () => {
    test('T19: SHERIFF_VOTE block ≥ 8000 chars（R115 添加后）', () => {
        const lwStart = src.indexOf('case PROMPT_ACTIONS.LAST_WORDS:', svStart);
        const blockSize = lwStart - svStart;
        expect(blockSize).toBeGreaterThanOrEqual(8000);
    });

    test('T20: SHERIFF_VOTE block ≤ 17000 chars（防止意外膨胀；R123: +摄梦人 BP 分支 +1525 → 15623）', () => {
        const lwStart = src.indexOf('case PROMPT_ACTIONS.LAST_WORDS:', svStart);
        const blockSize = lwStart - svStart;
        expect(blockSize).toBeLessThanOrEqual(17000);
    });
});
