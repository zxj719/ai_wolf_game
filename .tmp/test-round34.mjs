/**
 * Round 34 测试：PK 发言 pkMode 修复
 * - 狼人 pkMode=true 时覆盖为防御框架
 * - 所有角色 pkMode=true 时加入全局 PK 辩护提示
 * - useDayFlow.js 透传 pkCandidates
 */

import { readFileSync } from 'fs';

const aiSrc = readFileSync(new URL('../src/services/aiPrompts.js', import.meta.url), 'utf-8');
const dayFlowSrc = readFileSync(new URL('../src/hooks/useDayFlow.js', import.meta.url), 'utf-8');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`✅ ${name}`);
        passed++;
    } catch (e) {
        console.error(`❌ ${name}: ${e.message}`);
        failed++;
    }
}

function assert(condition, msg) {
    if (!condition) throw new Error(msg || 'assertion failed');
}

// ===========================================================
// T1-T5: useDayFlow.js — pkCandidates 透传
// ===========================================================
test('T1: handlePKRound 中 askAI DAY_SPEECH 调用含 pkCandidates', () => {
    assert(
        dayFlowSrc.includes('pkCandidates: pkCandidateIds'),
        '应包含 pkCandidates: pkCandidateIds'
    );
});

test('T2: pkCandidates 出现在 DAY_SPEECH 调用行', () => {
    const dspIdx = dayFlowSrc.indexOf('PROMPT_ACTIONS.DAY_SPEECH, { pkMode: true');
    assert(dspIdx !== -1, '找不到 DAY_SPEECH pkMode 调用');
    const line = dayFlowSrc.slice(dspIdx, dspIdx + 120);
    assert(line.includes('pkCandidates'), `DAY_SPEECH 行应含 pkCandidates，实际: ${line}`);
});

test('T3: pkCandidates 传递来源是 pkCandidateIds 变量', () => {
    assert(
        dayFlowSrc.includes('pkCandidates: pkCandidateIds'),
        '应将 pkCandidateIds 赋值给 pkCandidates'
    );
});

test('T4: PK DAY_VOTE 调用仍含 pkMode + pkCandidates（使用 lastIndexOf 定位 PK 投票块）', () => {
    // PK 投票的 askAI 调用是最后一个 PROMPT_ACTIONS.DAY_VOTE（非 PK 普通投票在前）
    const pkVoteAnchorIdx = dayFlowSrc.indexOf('pkMode: true,\n          pkCandidates');
    if (pkVoteAnchorIdx !== -1) {
        // 方式1：直接找 pkMode + pkCandidates 相邻
        assert(true, 'PK DAY_VOTE 含 pkMode 和 pkCandidates（相邻形式）');
        return;
    }
    // 方式2：找最后一个 DAY_VOTE 调用块
    const lastVoteIdx = dayFlowSrc.lastIndexOf('PROMPT_ACTIONS.DAY_VOTE,');
    assert(lastVoteIdx !== -1, '找不到任何 DAY_VOTE 调用');
    const voteBlock = dayFlowSrc.slice(lastVoteIdx, lastVoteIdx + 400);
    assert(voteBlock.includes('pkCandidates'), `PK DAY_VOTE 块应含 pkCandidates，实际: ${voteBlock.slice(0, 200)}`);
});

test('T5: handlePKRound 中存在 pkCandidateIds 变量定义', () => {
    assert(
        dayFlowSrc.includes('pkCandidateIds'),
        '应定义 pkCandidateIds'
    );
});

// ===========================================================
// T6-T10: aiPrompts.js — 全局 pkHint 存在性
// ===========================================================

// 定位 DAY_SPEECH case 的 pkHint 块（用 return rolePromptGenerator 锚定）
const pkHintDefIdx = aiSrc.indexOf('const pkHint = roleParams.pkMode');
test('T6: pkHint 在 DAY_SPEECH case 中定义', () => {
    assert(pkHintDefIdx !== -1, '找不到 pkHint 定义');
});

test('T7: pkHint 含"PK 辩护模式"文本', () => {
    const block = aiSrc.slice(pkHintDefIdx, pkHintDefIdx + 400);
    assert(block.includes('PK 辩护模式'), `pkHint 块应含"PK 辩护模式"，实际: ${block.slice(0, 200)}`);
});

test('T8: pkHint 含"提供新论点"（新信息指引）', () => {
    const block = aiSrc.slice(pkHintDefIdx, pkHintDefIdx + 500);
    assert(block.includes('提供新论点'), '应包含提供新论点指引');
});

test('T9: pkHint 在 roleParams.pkMode 为 falsy 时返回空字符串', () => {
    // 检查三元表达式右侧是空字符串
    const block = aiSrc.slice(pkHintDefIdx, pkHintDefIdx + 600);
    assert(block.includes(': \'\'') || block.includes(': ""'), '应有空字符串 fallback');
});

test('T10: pkHint 被追加到 return 语句', () => {
    const retIdx = aiSrc.indexOf('return rolePromptGenerator(ctx, roleParams) + pkHint');
    assert(retIdx !== -1, 'return 语句应包含 pkHint');
    const retLine = aiSrc.slice(retIdx, retIdx + 100);
    assert(retLine.includes('sheriffHint'), 'pkHint 在 sheriffHint 之前应存在于同一 return 语句');
});

// ===========================================================
// T11-T18: aiPrompts.js — 狼人 pkMode 覆盖逻辑
// ===========================================================

// 定位狼人 DAY_SPEECH pkMode 覆盖块
const wolfPkIdx = aiSrc.indexOf('// PK 模式覆盖：PK 发言目标是自保');
test('T11: 狼人 DAY_SPEECH 存在 pkMode 覆盖注释', () => {
    assert(wolfPkIdx !== -1, '找不到 pkMode 覆盖注释');
});

test('T12: 覆盖块检查 params.pkMode', () => {
    const block = aiSrc.slice(wolfPkIdx, wolfPkIdx + 100);
    assert(block.includes('params.pkMode'), `应检查 params.pkMode，实际: ${block}`);
});

test('T13: 覆盖块检测 teammatesInPk（队友是否也在 PK）', () => {
    const block = aiSrc.slice(wolfPkIdx, wolfPkIdx + 300);
    assert(block.includes('teammatesInPk'), '应定义 teammatesInPk');
    assert(block.includes('params.pkCandidates'), '应读取 params.pkCandidates');
});

test('T14: 双狼 PK 场景提供"危机"专属提示', () => {
    const block = aiSrc.slice(wolfPkIdx, wolfPkIdx + 700);
    assert(block.includes('PK 危机'), '应包含 PK 危机提示');
    assert(block.includes('绝对禁止'), '应包含绝对禁止辩护的指令');
});

test('T15: 双狼 PK 提示包含独立对抗策略', () => {
    const block = aiSrc.slice(wolfPkIdx, wolfPkIdx + 800);
    assert(block.includes('各自为战'), '应包含"各自为战"策略');
});

test('T16: 场外队友场景提供 outsideHint', () => {
    const block = aiSrc.slice(wolfPkIdx, wolfPkIdx + 900);
    assert(block.includes('outsideHint'), '应定义 outsideHint 变量');
    assert(block.includes('场外队友'), '应包含"场外队友"说明');
});

test('T17: pkMode 覆盖在 wolfTeammatesHint 构建之后（正确顺序）', () => {
    const teamHintIdx = aiSrc.indexOf('wolfTeammatesHint = `\\n【多狼协作');
    assert(teamHintIdx !== -1, '找不到 wolfTeammatesHint 赋值');
    assert(wolfPkIdx > teamHintIdx, `pkMode 覆盖(${wolfPkIdx})应在 wolfTeammatesHint 构建(${teamHintIdx})之后`);
});

test('T18: pkMode 覆盖在 return 语句之前', () => {
    const returnIdx = aiSrc.indexOf("return `${getBaseContext(ctx)}\n【狼人专属任务");
    assert(returnIdx !== -1, '找不到狼人 return 语句');
    assert(wolfPkIdx < returnIdx, `pkMode 覆盖(${wolfPkIdx})应在 return(${returnIdx})之前`);
});

// ===========================================================
// T19-T22: 正向行为：普通模式（pkMode=false）不被影响
// ===========================================================

test('T19: pkMode 覆盖只在 if(params.pkMode) 内生效', () => {
    const block = aiSrc.slice(wolfPkIdx, wolfPkIdx + 150);
    assert(block.includes('if (params.pkMode)'), '应用 if 语句保护覆盖逻辑');
});

test('T20: 普通 wolfTeammatesHint 仍包含"多狼协作"', () => {
    const teamHintIdx = aiSrc.indexOf('wolfTeammatesHint = `\\n【多狼协作');
    assert(teamHintIdx !== -1, '正常 wolfTeammatesHint 应保留');
    const normalBlock = aiSrc.slice(teamHintIdx, teamHintIdx + 200);
    assert(normalBlock.includes('多狼协作'), '正常 hint 应含多狼协作');
});

test('T21: isFirstWolfToSpeak 正常逻辑在 pkMode 覆盖前', () => {
    const firstWolfIdx = aiSrc.indexOf('if (params.isFirstWolfToSpeak !== undefined)');
    assert(firstWolfIdx !== -1, '找不到 isFirstWolfToSpeak 检查');
    assert(firstWolfIdx < wolfPkIdx, `isFirstWolfToSpeak 检查(${firstWolfIdx})应在 pkMode 覆盖(${wolfPkIdx})前`);
});

test('T22: 非 pkMode 场景下 wolfTeammatesHint 包含 roleDiv', () => {
    const teamHintIdx = aiSrc.indexOf('wolfTeammatesHint = `\\n【多狼协作');
    const block = aiSrc.slice(teamHintIdx, teamHintIdx + 300);
    assert(block.includes('roleDiv') || block.includes('${roleDiv}'), '正常 hint 应含 roleDiv');
});

// ===========================================================
// T23-T25: 逻辑模拟验证
// ===========================================================

// 模拟 wolfTeammatesHint 生成逻辑
function simulateWolfDaySpeech(params) {
    let wolfTeammatesHint = '';
    if (params.wolfTeammates?.length > 0) {
        const totalWolves = params.wolfTeammates.length + 1;
        const roleDiv = totalWolves === 2 ? '【2狼角色分化】' : `【多狼角色分化(${totalWolves}狼)】`;
        const lateHint = '';
        let wolfRoleAssignment = '';
        if (params.isFirstWolfToSpeak !== undefined) {
            wolfRoleAssignment = params.isFirstWolfToSpeak ? '⭐主动方' : '⭐低调方';
        }
        wolfTeammatesHint = `多狼协作 队友:${params.wolfTeammates.join(',')}号${roleDiv}${wolfRoleAssignment}${lateHint}`;
    }
    // PK 模式覆盖（模拟 aiPrompts.js 逻辑）
    if (params.pkMode) {
        const teammatesInPk = (params.wolfTeammates || []).filter(id =>
            (params.pkCandidates || []).includes(id)
        );
        if (teammatesInPk.length > 0) {
            wolfTeammatesHint = `PK危机:队友${teammatesInPk.join(',')}在PK 绝对禁止保护`;
        } else {
            const outsideHint = (params.wolfTeammates || []).length > 0
                ? `场外队友${params.wolfTeammates.join(',')}号正在观看`
                : '';
            wolfTeammatesHint = outsideHint;
        }
    }
    return wolfTeammatesHint;
}

test('T23: 模拟——正常2狼发言含角色分化提示', () => {
    const result = simulateWolfDaySpeech({
        wolfTeammates: [3],
        isFirstWolfToSpeak: true,
        pkMode: false,
    });
    assert(result.includes('多狼协作'), `应含多狼协作，实际: ${result}`);
    assert(result.includes('⭐主动方'), `应含主动方标记，实际: ${result}`);
});

test('T24: 模拟——双狼 PK 切换为危机防御提示', () => {
    const result = simulateWolfDaySpeech({
        wolfTeammates: [3],
        pkMode: true,
        pkCandidates: [1, 3], // 当前狼ID=1(假设), 队友3号也在PK
    });
    assert(!result.includes('多狼协作'), `不应含多狼协作（防御模式），实际: ${result}`);
    assert(result.includes('PK危机'), `应含 PK危机，实际: ${result}`);
    assert(result.includes('绝对禁止'), `应含绝对禁止，实际: ${result}`);
});

test('T25: 模拟——场外队友场景下 pkMode 提示中性', () => {
    const result = simulateWolfDaySpeech({
        wolfTeammates: [3],
        pkMode: true,
        pkCandidates: [1, 5], // 队友3号不在PK候选
    });
    assert(!result.includes('PK危机'), `不应含 PK危机，实际: ${result}`);
    assert(result.includes('场外队友'), `应含场外队友提示，实际: ${result}`);
    assert(!result.includes('多狼协作'), `不应含进攻协作指令，实际: ${result}`);
});

// ===========================================================
// 汇总
// ===========================================================
console.log(`\n总计: ${passed}/${passed + failed} 通过`);
if (failed > 0) process.exit(1);
