/**
 * Round 19 test:
 * 1. Verify villager & hunter identity_table "追加" format examples are present (item 26)
 * 2. Validate DAY_VOTE heat calculation logic edge cases (item 25)
 * 3. Regression: prior round changes (R17 seer/guard, R18 witch/villager)
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '../src/services/aiPrompts.js'), 'utf8');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`✅ ${name}`);
        passed++;
    } catch (e) {
        console.log(`❌ ${name}: ${e.message}`);
        failed++;
    }
}

function assert(condition, msg) {
    if (!condition) throw new Error(msg);
}

// ── Locate ROLE_DAY_SPEECH_PROMPTS block ──
const dspStart = src.indexOf("const ROLE_DAY_SPEECH_PROMPTS = {");
assert(dspStart !== -1, "ROLE_DAY_SPEECH_PROMPTS not found");

// ── Locate villager section (uses template literal, not curly brace) ──
const villagerStart = src.indexOf("'村民': (ctx, params) => `", dspStart);
assert(villagerStart !== -1, "villager day speech section not found");
const villagerEnd = src.indexOf("'骑士': (ctx, params)", villagerStart);
const villagerBlock = src.slice(villagerStart, villagerEnd);

// ── Locate hunter section (uses template literal, not curly brace) ──
const hunterStart = src.indexOf("'猎人': (ctx, params) => `", dspStart);
assert(hunterStart !== -1, "hunter day speech section not found");
const hunterEnd = src.indexOf("'守卫': (ctx, params)", hunterStart);
const hunterBlock = src.slice(hunterStart, hunterEnd);

// ─── Group 1: 村民 identity_table 追加格式示例 (item 26) ───
test("T1: 村民DAY_SPEECH有追加格式示例标记", () => {
    assert(villagerBlock.includes('【追加示例】'), "missing 【追加示例】 in villager block");
});

test("T2: 村民格式示例包含旧→新格式演示", () => {
    assert(villagerBlock.includes('N1发言带节奏'), "missing N1 behavior example");
    assert(villagerBlock.includes('N2投好人'), "missing N2 behavior example");
});

test("T3: 村民格式示例包含分号拼接格式（追加符号）", () => {
    // The example should show that N1 and N2 are joined with semicolon
    const exampleIdx = villagerBlock.indexOf('【追加示例】');
    const exampleLine = villagerBlock.slice(exampleIdx, exampleIdx + 200);
    assert(exampleLine.includes('；'), "missing semicolon joining format in example");
});

test("T4: 村民格式示例包含→箭头（before/after对比）", () => {
    const exampleIdx = villagerBlock.indexOf('【追加示例】');
    const exampleLine = villagerBlock.slice(exampleIdx, exampleIdx + 200);
    assert(exampleLine.includes('→'), "missing → arrow in format example");
});

test("T5: 村民的追加指令（不覆盖历史）仍然存在", () => {
    assert(villagerBlock.includes('不要覆盖历史'), "missing 不要覆盖历史 instruction");
    assert(villagerBlock.includes('**追加**'), "missing **追加** emphasis");
});

// ─── Group 2: 猎人 identity_table 追加格式示例 (item 26) ───
test("T6: 猎人DAY_SPEECH有追加格式示例标记", () => {
    assert(hunterBlock.includes('【追加示例】'), "missing 【追加示例】 in hunter block");
});

test("T7: 猎人格式示例包含具体玩家号和轮次", () => {
    const exampleIdx = hunterBlock.indexOf('【追加示例】');
    const exampleLine = hunterBlock.slice(exampleIdx, exampleIdx + 200);
    assert(exampleLine.includes('N1') && exampleLine.includes('N2'), "missing round references in hunter example");
});

test("T8: 猎人格式示例包含开枪优先级升级描述", () => {
    const exampleIdx = hunterBlock.indexOf('【追加示例】');
    const exampleLine = hunterBlock.slice(exampleIdx, exampleIdx + 200);
    assert(exampleLine.includes('升为开枪优先'), "missing '升为开枪优先' in hunter example");
});

test("T9: 猎人格式示例包含→箭头（before/after对比）", () => {
    const exampleIdx = hunterBlock.indexOf('【追加示例】');
    const exampleLine = hunterBlock.slice(exampleIdx, exampleIdx + 200);
    assert(exampleLine.includes('→'), "missing → arrow in hunter format example");
});

test("T10: 猎人的开枪前回顾指令仍然存在", () => {
    assert(hunterBlock.includes('开枪前回顾上轮 identity_table'), "missing 开枪前回顾 instruction");
    assert(hunterBlock.includes('开枪优先级：高'), "missing 开枪优先级：高 keyword");
});

// ─── Group 3: DAY_VOTE 热力计算逻辑边界测试 (item 25) ───
// Extract the heat calculation section
const dayVoteCaseIdx = src.indexOf('case PROMPT_ACTIONS.DAY_VOTE: {');
assert(dayVoteCaseIdx !== -1, "DAY_VOTE case not found");
const dayVoteEnd = src.indexOf('case PROMPT_ACTIONS.HUNTER_SHOOT:', dayVoteCaseIdx);
const dayVoteBlock = src.slice(dayVoteCaseIdx, dayVoteEnd);

test("T11: DAY_VOTE热力计算存在prevVoteRounds过滤", () => {
    assert(dayVoteBlock.includes('voteHistory || []).filter(v => v.day < voteDay)'),
        "missing prevVoteRounds filter logic");
});

test("T12: DAY_VOTE热力计算v.to!=-1过滤弃票", () => {
    assert(dayVoteBlock.includes('v.to !== -1'), "missing abstain filter (v.to !== -1)");
});

test("T13: DAY_VOTE热力计算过滤已死玩家", () => {
    assert(dayVoteBlock.includes('alivePlayers.find(p => p.id === Number(id))'),
        "missing dead player filter in heat calc");
});

test("T14: DAY_VOTE热力计算只取Top3", () => {
    assert(dayVoteBlock.includes('.slice(0, 3)'), "missing .slice(0,3) for top3 targets");
});

test("T15: DAY_VOTE热力计算按票数降序排列", () => {
    assert(dayVoteBlock.includes('(a, b) => b[1] - a[1]'), "missing descending sort in heat calc");
});

test("T16: DAY_VOTE首轮(voteDay===1)进入首轮场景提示", () => {
    assert(dayVoteBlock.includes("voteDay === 1"), "missing voteDay===1 condition for first round hint");
    assert(dayVoteBlock.includes('首轮投票'), "missing 首轮投票 hint text");
});

test("T17: DAY_VOTE终局警报包含活着人数和狼数", () => {
    assert(dayVoteBlock.includes('aliveCount}人'), "missing aliveCount display in late game hint");
    assert(dayVoteBlock.includes('wolfCount}狼'), "missing wolfCount display in late game hint");
});

test("T18: DAY_VOTE PK模式提示优先级高于终局和首轮", () => {
    // PK should be first if-branch
    const pkIdx = dayVoteBlock.indexOf('if (pkMode)');
    const firstRoundIdx = dayVoteBlock.indexOf("voteDay === 1");
    assert(pkIdx < firstRoundIdx, "pkMode check should come before voteDay===1 check");
});

// Pure function simulation of heat calculation to test edge cases
function simulateHeatCalc(voteHistory, voteDay, alivePlayers) {
    const prevVoteRounds = (voteHistory || []).filter(v => v.day < voteDay);
    if (prevVoteRounds.length === 0) return { hint: '', hotTargets: [] };

    const tally = {};
    for (const round of prevVoteRounds) {
        for (const v of (round.votes || [])) {
            if (v.to !== -1) tally[v.to] = (tally[v.to] || 0) + 1;
        }
    }
    const hotTargets = Object.entries(tally)
        .filter(([id]) => alivePlayers.find(p => p.id === Number(id)))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

    const hint = hotTargets.length > 0
        ? `【跨轮投票热力】${hotTargets.map(([id, cnt]) => `${id}号被投${cnt}次`).join('、')}`
        : '';
    return { hint, hotTargets };
}

test("T19: 热力计算—首轮无历史数据时无热力提示", () => {
    const { hint } = simulateHeatCalc([], 1, [{ id: 1 }, { id: 2 }, { id: 3 }]);
    assert(hint === '', `expected empty hint for first round, got: "${hint}"`);
});

test("T20: 热力计算—历史全弃票时无热力提示", () => {
    const voteHistory = [
        { day: 1, votes: [{ from: 1, to: -1 }, { from: 2, to: -1 }, { from: 3, to: -1 }] }
    ];
    const { hint } = simulateHeatCalc(voteHistory, 2, [{ id: 1 }, { id: 2 }, { id: 3 }]);
    assert(hint === '', `expected empty hint for all-abstain round, got: "${hint}"`);
});

test("T21: 热力计算—有历史投票时显示Top3热目标", () => {
    const voteHistory = [
        { day: 1, votes: [
            { from: 1, to: 5 },  // player 5 gets 3 votes
            { from: 2, to: 5 },
            { from: 3, to: 5 },
            { from: 4, to: 3 },  // player 3 gets 2 votes
            { from: 5, to: 3 },
            { from: 6, to: 2 },  // player 2 gets 1 vote
        ]}
    ];
    const alivePlayers = [{ id: 2 }, { id: 3 }, { id: 5 }, { id: 6 }, { id: 7 }];
    const { hotTargets } = simulateHeatCalc(voteHistory, 2, alivePlayers);
    assert(hotTargets[0][0] === '5', `expected player 5 as hottest, got ${hotTargets[0][0]}`);
    assert(hotTargets[0][1] === 3, `expected 3 votes for player 5, got ${hotTargets[0][1]}`);
    assert(hotTargets[1][0] === '3', `expected player 3 second, got ${hotTargets[1][0]}`);
    assert(hotTargets.length <= 3, "should only return top 3 targets");
});

test("T22: 热力计算—已死玩家不出现在热力目标中", () => {
    const voteHistory = [
        { day: 1, votes: [
            { from: 2, to: 9 },  // player 9 was voted heavily but is now dead
            { from: 3, to: 9 },
            { from: 4, to: 9 },
            { from: 5, to: 7 },  // player 7 is still alive
        ]}
    ];
    // Player 9 is NOT in alivePlayers (dead)
    const alivePlayers = [{ id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 7 }];
    const { hotTargets } = simulateHeatCalc(voteHistory, 2, alivePlayers);
    const deadInHot = hotTargets.some(([id]) => id === '9');
    assert(!deadInHot, "dead player 9 should not appear in hot targets");
    assert(hotTargets.length > 0 && hotTargets[0][0] === '7', "player 7 should be the only hot target");
});

test("T23: 热力计算—同一天的投票不计入（过滤v.day < voteDay）", () => {
    const voteHistory = [
        { day: 3, votes: [{ from: 1, to: 4 }, { from: 2, to: 4 }] }  // Same day as voteDay
    ];
    const { hint } = simulateHeatCalc(voteHistory, 3, [{ id: 4 }, { id: 5 }]);
    assert(hint === '', "current day's votes should not be included in heat calculation");
});

// ─── Group 4: 回归检查 ───
test("T24: R17守卫DAY_SPEECH有守护记录identity_table指导", () => {
    const guardStart = src.indexOf("'守卫': (ctx, params) => {", dspStart);
    assert(guardStart !== -1, "guard day speech section not found");
    const guardEnd = src.indexOf("'村民': (ctx, params) => {", guardStart);
    const guardBlock = src.slice(guardStart, guardEnd);
    // Guard guidance uses 守护过的玩家 + 换守判断
    assert(guardBlock.includes('守护过的玩家'), "missing 守护过的玩家 in guard identity_table guidance");
    assert(guardBlock.includes('换守判断'), "missing 换守判断 in guard identity_table guidance");
});

test("T25: R17预言家DAY_SPEECH有查验结果95-100高确定性指导", () => {
    const seerStart = src.indexOf("'预言家': (ctx, params) => {", dspStart);
    assert(seerStart !== -1, "seer day speech section not found");
    const seerEnd = src.indexOf("'女巫': (ctx, params) => {", seerStart);
    const seerBlock = src.slice(seerStart, seerEnd);
    assert(seerBlock.includes('95-100'), "missing confidence 95-100 in seer day guidance");
});

test("T26: R18村民追加指令有唯一持久记忆说明", () => {
    assert(villagerBlock.includes('唯一的持久记忆'), "missing 唯一的持久记忆 in villager block");
});

// ─── Summary ───
console.log(`\n结果: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
