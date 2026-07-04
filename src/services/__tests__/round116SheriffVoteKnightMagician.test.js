/**
 * Round 116: 骑士 + 魔术师 SHERIFF_VOTE 专属提示词
 *
 * 问题：SHERIFF_VOTE 中骑士和魔术师均走通用空字符串 fallback，
 *   未利用各自的角色私有信息：
 *   - 骑士：hasUsedDuel（决斗状态）→ 决斗未用时骑士 + 警长是全游戏最强双牌组合
 *   - 魔术师：hasRevealed（身份暴露）+ swappedPlayers（交换容量）
 *     → 身份隐藏时当选警长有暴露代价；身份已公开时当选纯增益
 *
 * 修复（R116）：
 *   1. svKnightHint：hasUsedDuel × isCandidate 两路径（决斗前/决斗后各有独立推荐框架）
 *   2. svMagicianHint：hasRevealed × isCandidate 两路径（隐藏期/公开期各有独立推荐框架）
 *   3. svRoleHint 升级为 8 路径（+骑士 +魔术师）
 *
 * 研究依据：Wang 2025 (arxiv:2408.17177) — 角色私有信息注入显著提升 AI 决策精准度；
 *   同 R112-R115 SHERIFF_* 设计模式。
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(__dirname, '../aiPrompts.js'), 'utf8');
const svStart = src.indexOf('case PROMPT_ACTIONS.SHERIFF_VOTE:');
const SV_WINDOW = 9500; // block=7296 (to SHERIFF_BADGE_PASS) × 130% ≈ 9485；R116 后 svRoleHint 在偏移 6073
const getSvBlock = () => src.slice(svStart, svStart + SV_WINDOW);

// ─── T1: 锚点校验 ────────────────────────────────────────────────────────────

describe('R116: SHERIFF_VOTE case 块存在', () => {
    test('T1: SHERIFF_VOTE case 锚点存在', () => {
        expect(svStart).toBeGreaterThan(0);
    });
});

// ─── T2-T6: 骑士 svKnightHint 变量声明与两路径 ──────────────────────────────

describe('R116: 骑士 SHERIFF_VOTE 专属提示词 — svKnightHint', () => {
    test('T2: 白熊效应 — svKnightHint 块无负向禁词（全正向描述）', () => {
        const blk = getSvBlock();
        const knightStart = blk.indexOf('let svKnightHint');
        const magStart = blk.indexOf('const svMagHistory');
        const knightBlock = knightStart >= 0 && magStart > knightStart
            ? blk.slice(knightStart, magStart)
            : '';
        expect(knightBlock.length).toBeGreaterThan(0);
        const negativeKeywords = ['自曝', '千万别', '绝对不要', '绝不能', '不要当'];
        negativeKeywords.forEach(kw => {
            expect(knightBlock).not.toContain(kw);
        });
    });

    test('T3: svKnightHint 声明为 let 且骑士判断分支存在', () => {
        const blk = getSvBlock();
        expect(blk).toContain("let svKnightHint = ''");
        expect(blk).toContain("playerRole === '骑士'");
    });

    test('T4: 骑士 hasUsedDuel 读取路径存在', () => {
        const blk = getSvBlock();
        expect(blk).toContain('svKnightDueled');
        expect(blk).toContain('hasUsedDuel');
    });

    test('T5: 骑士未决斗分支包含"双牌组合"核心词（最强双牌战略描述）', () => {
        const blk = getSvBlock();
        expect(blk).toContain('双牌');
        expect(blk).toContain('决斗尚未使用');
    });

    test('T6: 骑士已决斗分支包含"身份已公开"核心词（领袖期投票框架）', () => {
        const blk = getSvBlock();
        expect(blk).toContain('决斗已使用');
        expect(blk).toContain('身份已公开');
    });

    test('T6b: 骑士自竞选提示（isCandidate）路径存在（使用 Number 类型安全转换）', () => {
        const blk = getSvBlock();
        expect(blk).toContain('svKnightIsCandidate');
        expect(blk).toContain('svKnightSelfNote');
        // 类型安全：Number(currentPlayer?.id) 避免字符串/数字不匹配
        expect(blk).toContain('Number(currentPlayer?.id)');
    });
});

// ─── T7-T11: 魔术师 svMagicianHint 变量声明与两路径 ─────────────────────────

describe('R116: 魔术师 SHERIFF_VOTE 专属提示词 — svMagicianHint', () => {
    test('T7: 白熊效应 — svMagicianHint 块无负向禁词（全正向描述）', () => {
        const blk = getSvBlock();
        const magStart = blk.indexOf('const svMagHistory');
        const roleHintStart = blk.indexOf('const svRoleHint =');
        const magBlock = magStart >= 0 && roleHintStart > magStart
            ? blk.slice(magStart, roleHintStart)
            : '';
        expect(magBlock.length).toBeGreaterThan(0);
        const negativeKeywords = ['自曝', '千万别', '绝对不要', '绝不能', '不要当'];
        negativeKeywords.forEach(kw => {
            expect(magBlock).not.toContain(kw);
        });
    });

    test('T8: svMagHistory 安全读取（gameState.magicianHistory 或默认空值）', () => {
        const blk = getSvBlock();
        expect(blk).toContain('const svMagHistory = gameState.magicianHistory');
        expect(blk).toContain('svMagAlreadySwapped');
    });

    test('T9: svMagIsRevealed 读取路径（hasRevealed 来自 currentPlayer）', () => {
        const blk = getSvBlock();
        expect(blk).toContain('svMagIsRevealed');
        expect(blk).toContain('hasRevealed');
    });

    test('T10: 魔术师身份隐藏分支包含"暴露代价"核心框架', () => {
        const blk = getSvBlock();
        expect(blk).toContain('身份仍隐藏');
        expect(blk).toContain('暴露代价');
    });

    test('T11: 魔术师身份已公开分支包含"无额外暴露"核心词', () => {
        const blk = getSvBlock();
        expect(blk).toContain('身份已公开');
        expect(blk).toContain('无额外暴露');
    });

    test('T11b: 魔术师自竞选提示（isCandidate）路径存在', () => {
        const blk = getSvBlock();
        expect(blk).toContain('svMagIsCandidate');
        expect(blk).toContain('svMagCandidateNote');
    });
});

// ─── T12-T14: svRoleHint 8路径（新增骑士+魔术师） ───────────────────────────

describe('R116: svRoleHint 8路径独立分支（含骑士+魔术师）', () => {
    test('T12: svRoleHint 包含骑士独立分支', () => {
        const blk = getSvBlock();
        const svRoleIdx = blk.indexOf('const svRoleHint =');
        expect(svRoleIdx).toBeGreaterThan(0);
        const chain = blk.slice(svRoleIdx, svRoleIdx + 800);
        expect(chain).toContain("playerRole === '骑士'");
        expect(chain).toContain('svKnightHint');
    });

    test('T13: svRoleHint 包含魔术师独立分支', () => {
        const blk = getSvBlock();
        const svRoleIdx = blk.indexOf('const svRoleHint =');
        expect(svRoleIdx).toBeGreaterThan(0);
        const chain = blk.slice(svRoleIdx, svRoleIdx + 800);
        expect(chain).toContain("playerRole === '魔术师'");
        expect(chain).toContain('svMagicianHint');
    });

    test('T14: 骑士分支在摄梦人之后，魔术师在骑士之后，最终空字符串 fallback', () => {
        const blk = getSvBlock();
        const svRoleIdx = blk.indexOf('const svRoleHint =');
        const chain = blk.slice(svRoleIdx, svRoleIdx + 800);
        const dreamIdx = chain.indexOf("playerRole === '摄梦人'");
        const knightIdx = chain.indexOf("playerRole === '骑士'");
        const magIdx = chain.indexOf("playerRole === '魔术师'");
        const emptyIdx = chain.lastIndexOf(": '';");
        expect(dreamIdx).toBeGreaterThan(0);
        expect(knightIdx).toBeGreaterThan(dreamIdx);
        expect(magIdx).toBeGreaterThan(knightIdx);
        expect(emptyIdx).toBeGreaterThan(magIdx);
    });

    test('T15: 所有 8 路径均在 svRoleHint 链中（狼/预言家/女巫/守卫/猎人/摄梦人/骑士/魔术师）', () => {
        const blk = getSvBlock();
        const svRoleIdx = blk.indexOf('const svRoleHint =');
        const chain = blk.slice(svRoleIdx, svRoleIdx + 800);
        const allRoles = ['狼人', '预言家', '女巫', '守卫', '猎人', '摄梦人', '骑士', '魔术师'];
        allRoles.forEach(role => {
            expect(chain).toContain(`playerRole === '${role}'`);
        });
    });
});

// ─── T16-T17: R115 回归验证（摄梦人分支未受影响） ────────────────────────────

describe('R116: R115 回归验证 — 摄梦人分支保留', () => {
    test('T16: svDreamweaverHint（摄梦人同生共死路径）仍存在', () => {
        const blk = getSvBlock();
        expect(blk).toContain('svDreamweaverHint');
        expect(blk).toContain('同生共死');
    });

    test('T17: svHunterHint（猎人枪+警徽路径）仍存在', () => {
        const blk = getSvBlock();
        expect(blk).toContain('svHunterHint');
        expect(blk).toContain('枪');
    });
});

// ─── T18-T20: 块大小验证 ────────────────────────────────────────────────────

describe('R116: SHERIFF_VOTE block 大小', () => {
    test('T18: SHERIFF_VOTE → SHERIFF_BADGE_PASS block ≥ 7000 chars（R116 添加后）', () => {
        const bpStart = src.indexOf('case PROMPT_ACTIONS.SHERIFF_BADGE_PASS:', svStart);
        const blockSize = bpStart - svStart;
        expect(blockSize).toBeGreaterThanOrEqual(7000);
    });

    test('T19: SHERIFF_VOTE → SHERIFF_BADGE_PASS block ≤ 12000 chars（防止意外膨胀）', () => {
        const bpStart = src.indexOf('case PROMPT_ACTIONS.SHERIFF_BADGE_PASS:', svStart);
        const blockSize = bpStart - svStart;
        expect(blockSize).toBeLessThanOrEqual(12000);
    });

    test('T20: SHERIFF_VOTE case 存在骑士/魔术师专属 hint 注释（R116 标记）', () => {
        const blk = getSvBlock();
        expect(blk).toContain('R116');
    });
});
