/**
 * Round 37 测试脚本：DAY_VOTE voteMomentumHint 独立评估步骤
 *
 * 验证：添加了 Step A（三维打分）+ Step B（热力校正逻辑）结构
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dir = dirname(__filename);
const src = readFileSync(join(__dir, '../src/services/aiPrompts.js'), 'utf8');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        const result = fn();
        if (result) {
            console.log(`✅ ${name}`);
            passed++;
        } else {
            console.log(`❌ ${name}`);
            failed++;
        }
    } catch (e) {
        console.log(`❌ ${name} (exception: ${e.message})`);
        failed++;
    }
}

// 定位 DAY_VOTE case 块（使用花括号形式，避免 getCOTTemplate 假 case）
const dayVoteCaseIdx = src.indexOf('case PROMPT_ACTIONS.DAY_VOTE: {');
test('T0: DAY_VOTE case 块存在（带花括号）', () => dayVoteCaseIdx !== -1);

// 定位 voteMomentumHint 赋值区域
const momentumStartIdx = src.indexOf('voteMomentumHint = `', dayVoteCaseIdx);
test('T1: voteMomentumHint 赋值语句存在（在 DAY_VOTE case 内）', () => momentumStartIdx !== -1 && momentumStartIdx > dayVoteCaseIdx);

// 提取 voteMomentumHint 模板字符串内容（到反引号结束）
const momentumEndIdx = src.indexOf('`;', momentumStartIdx + 20);
const momentumBlock = momentumStartIdx !== -1 && momentumEndIdx !== -1
    ? src.slice(momentumStartIdx, momentumEndIdx + 2)
    : '';

test('T2: voteMomentumHint 块非空（正常截取）', () => momentumBlock.length > 100);

// === Step A 存在性检查 ===
test('T3: Step A 标签存在（独立评估步骤）', () => momentumBlock.includes('Step A'));
test('T4: Step A 要求在 thought 中先完成', () => momentumBlock.includes('thought') && momentumBlock.includes('先完成'));
test('T5: 维度 (a) 逻辑自洽存在', () => momentumBlock.includes('(a)') && momentumBlock.includes('逻辑自洽'));
test('T6: 维度 (b) 信息价值存在', () => momentumBlock.includes('(b)') && momentumBlock.includes('信息价值'));
test('T7: 维度 (c) 行为连贯存在', () => momentumBlock.includes('(c)') && momentumBlock.includes('行为连贯'));
test('T8: 三维度评分结果标识（高/低）', () => momentumBlock.includes('→ 高') && momentumBlock.includes('→ 低'));

// === Step B 存在性检查 ===
test('T9: Step B 标签存在（热力校正逻辑）', () => momentumBlock.includes('Step B'));
test('T10: ① 热力高 + 独立评分低 → 可参考跟投', () => momentumBlock.includes('独立评分低') && momentumBlock.includes('参考跟投'));
test('T11: ② 热力高 + 独立评分高 → 警惕刷票靶子', () => momentumBlock.includes('独立评分高') && momentumBlock.includes('警惕刷票靶子'));
test('T12: ③ 合谋警报（多个狼嫌疑）存在', () => momentumBlock.includes('高度警惕合谋') && momentumBlock.includes('热力直接降权'));
test('T13: ④ 踩明显狼嫌疑 → 好人特征可跟投 存在', () => momentumBlock.includes('踩明显狼嫌疑') && momentumBlock.includes('可跟投'));

// === Step A → Step B 的执行顺序 ===
const stepAIdx = momentumBlock.indexOf('Step A');
const stepBIdx = momentumBlock.indexOf('Step B');
test('T14: Step A 出现在 Step B 之前', () => stepAIdx !== -1 && stepBIdx !== -1 && stepAIdx < stepBIdx);

// === 旧版内容替换确认（不再有孤立的"决策原则"一行） ===
test('T15: 旧版"决策原则：先独立评估"行已被替换', () => !momentumBlock.includes('决策原则：先独立评估本轮发言质量'));
// 旧版原 ①②③ 格式（没有"独立评分低/高"区分的简单版本）应已不存在
test('T16: 旧版 ① 格式已替换（新版带"独立评分"字样）', () => !momentumBlock.includes('热力高但本轮发言逻辑清晰'));

// === 动态变量插值安全检查（R18 规范）===
// Step A 行本身（静态指导文本）不应含 JS 变量插值（hotTargets 在 header 中是合法的）
const stepALineStart = momentumBlock.indexOf('Step A');
const stepBLineStart = momentumBlock.indexOf('Step B');
const stepAOnlyBlock = momentumBlock.slice(stepALineStart, stepBLineStart);
// 在静态指导文本中不应有 ${非hotTargets的变量}（hotTargets.map 已在 header 消费完）
const hasIllegalInterp = /\$\{(?!hotTargets)/.test(stepAOnlyBlock);
test('T17: Step A 指导文本不含非法 JS 变量插值', () => !hasIllegalInterp);

// === 整体结构一致性检查 ===
test('T18: header 包含"热力不能直接决定投票"', () => momentumBlock.includes('热力不能直接决定投票'));
test('T19: header 包含"先独立评估，再用热力校正"', () => momentumBlock.includes('先独立评估，再用热力校正'));
test('T20: 四条校正规则（①②③④）均存在', () => {
    return momentumBlock.includes('①') && momentumBlock.includes('②') &&
           momentumBlock.includes('③') && momentumBlock.includes('④');
});

// === 回归检查：DAY_VOTE case 其他关键内容保留 ===
// 检查 DAY_VOTE 的返回模板（在 voteMomentumHint 之后）
const returnIdx = src.indexOf('return `投票放逐阶段', dayVoteCaseIdx);
test('T21: DAY_VOTE return 语句存在（完整保留）', () => returnIdx !== -1);

// 检查 sceneHint 块依然存在
test('T22: sceneHint PK 分支依然存在', () => src.indexOf('PK重投】平票后重投', dayVoteCaseIdx) !== -1);
test('T23: sceneHint 终局警报依然存在', () => src.indexOf('终局警报】场上仅', dayVoteCaseIdx) !== -1);
test('T24: seerVoteStrategy 预言家投票策略依然存在', () => src.indexOf('预言家投票策略—对跳优先', dayVoteCaseIdx) !== -1);
test('T25: 警长投票提醒（sheriffVoteHint）依然存在', () => src.indexOf('警长投票】你的投票权重', dayVoteCaseIdx) !== -1);

// === 逻辑模拟验证（纯函数模拟 voteMomentumHint 生成逻辑）===
function simulateVoteMomentumHint(prevVoteRounds, alivePlayers) {
    if (prevVoteRounds.length === 0) return '';
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
    if (hotTargets.length === 0) return '';
    return `【跨轮投票热力】历史投票中：${hotTargets.map(([id, cnt]) => `${id}号被投${cnt}次`).join('、')}`;
}

// T26: 正常历史 → 热力 Top3 排序正确
const historyRounds = [
    { votes: [{to:3}, {to:3}, {to:5}, {to:5}, {to:5}, {to:7}] },
    { votes: [{to:3}, {to:5}, {to:7}, {to:7}] }
];
const aliveMock = [3,4,5,6,7].map(id => ({ id }));
const hint = simulateVoteMomentumHint(historyRounds, aliveMock);
// 5号：3+1=4次，3号：2+1=3次，7号：1+2=3次 → 5号最多
test('T26: 热力计算 Top3 正确（5号最高，被投4次）', () => hint.includes('5号被投4次') && hint.startsWith('【跨轮投票热力】'));

// T27: 空历史 → 无热力提示
test('T27: 空历史 → 返回空字符串', () => simulateVoteMomentumHint([], aliveMock) === '');

// T28: 全弃票 → 无热力提示
test('T28: 全弃票历史（to=-1）→ 无热力提示', () => {
    const h = simulateVoteMomentumHint([{ votes: [{to:-1},{to:-1}] }], aliveMock);
    return h === '';
});

// T29: 死亡玩家被过滤
test('T29: 死亡玩家（不在 alivePlayers）被过滤', () => {
    const smallAlive = [{ id: 5 }, { id: 7 }];
    const h = simulateVoteMomentumHint(historyRounds, smallAlive);
    return !h.includes('3号') && h.includes('5号');
});

console.log(`\n结果：${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
