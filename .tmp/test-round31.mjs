/**
 * Round 31 测试脚本：验证摄梦人和魔术师 SHERIFF_SPEECH / SHERIFF_RUN 新增分支
 */
import { readFileSync } from 'fs';

const src = readFileSync('/home/user/ai_wolf_game/src/services/aiPrompts.js', 'utf-8');

let passed = 0;
let failed = 0;

function test(name, condition) {
  if (condition) {
    console.log(`✅ ${name}`);
    passed++;
  } else {
    console.log(`❌ FAIL: ${name}`);
    failed++;
  }
}

// ==== T1-T5: SHERIFF_RUN 摄梦人分支 ====

// T1: SHERIFF_RUN 有摄梦人 else-if 分支
test('T1 SHERIFF_RUN contains 摄梦人 branch', src.includes("playerRole === '摄梦人'") && src.includes("srHint = dreamReveal"));

// T2: 摄梦人 revealed 分支提及同生共死
test('T2 摄梦人 SHERIFF_RUN revealed mentions 同生共死', src.includes("同生共死触发（狼方再损失一个）"));

// T3: 摄梦人 unrevealed 分支提及双重不确定性
test('T3 摄梦人 SHERIFF_RUN unrevealed mentions 不确定性', src.includes("不知道是谁、不知道连着谁") || src.includes("双重不确定性"));

// T4: SHERIFF_RUN 有魔术师 else-if 分支
test('T4 SHERIFF_RUN contains 魔术师 branch', src.includes("playerRole === '魔术师'") && src.includes("srHint = magReveal"));

// T5: 魔术师 unrevealed 分支提及信息不对称
test('T5 魔术师 SHERIFF_RUN unrevealed mentions 信息不对称', src.includes("信息不对称"));

// ==== T6-T12: SHERIFF_SPEECH 摄梦人分支 ====

// Locate the SHERIFF_SPEECH block
const speechStart = src.indexOf("case PROMPT_ACTIONS.SHERIFF_SPEECH: {");
const speechEnd = src.indexOf("case PROMPT_ACTIONS.SHERIFF_VOTE:", speechStart);
const speechBlock = src.slice(speechStart, speechEnd);

// T6: hasRevealedIdentity 变量已声明
test('T6 SHERIFF_SPEECH declares hasRevealedIdentity', speechBlock.includes("const hasRevealedIdentity = currentPlayer?.hasRevealed || false"));

// T7: dreamweaverSsHint 变量已声明
test('T7 SHERIFF_SPEECH declares dreamweaverSsHint', speechBlock.includes("const dreamweaverSsHint = hasRevealedIdentity"));

// T8: magicianSsHint 变量已声明
test('T8 SHERIFF_SPEECH declares magicianSsHint', speechBlock.includes("const magicianSsHint = hasRevealedIdentity"));

// T9: ssHint 链包含摄梦人分支
test('T9 ssHint uses dreamweaverSsHint', speechBlock.includes("playerRole === '摄梦人'\n                 ? dreamweaverSsHint"));

// T10: ssHint 链包含魔术师分支
test('T10 ssHint uses magicianSsHint', speechBlock.includes("playerRole === '魔术师'\n                 ? magicianSsHint"));

// T11: 摄梦人 revealed 分支提及"杀我代价双倍"
test('T11 dreamweaver revealed 提及双倍代价', speechBlock.includes("杀我代价双倍") || speechBlock.includes("同生共死触发"));

// T12: 摄梦人 unrevealed 分支绝不含身份词汇禁止说明
test('T12 dreamweaver unrevealed 告知不能出现机制词汇', speechBlock.includes("入梦/连梦/同生共死等均不能出现"));

// ==== T13-T17: SHERIFF_SPEECH 魔术师分支 ====

// T13: 魔术师 revealed 提及信息修正权威
test('T13 magician revealed 提及信息修正权威', speechBlock.includes("信息修正权威 × 1.5票杠杆"));

// T14: 魔术师 unrevealed 禁止提交换信息
test('T14 magician unrevealed 禁止提交换信息', speechBlock.includes("绝不提任何交换/号码互换相关信息"));

// T15: badgeFlowLine 正确内嵌（无 \$ 转义问题）
test('T15 No escaped badgeFlowLine in speech block', !speechBlock.includes("\\${badgeFlowLine}"));

// ==== T16-T20: 其他角色回归测试 ====

// T16: 预言家分支保留
test('T16 seer branch still present', speechBlock.includes("你是预言家：竞选发言 = 信息资产展示"));

// T17: 狼人分支保留
test('T17 werewolf branch still present', speechBlock.includes("若悍跳预言家：构造可信的"));

// T18: 猎人分支保留
test('T18 hunter branch still present', speechBlock.includes("持续威慑力") && speechBlock.includes("隐性威慑框架"));

// T19: 猎人分支无"开枪"字样（R30 教训）
const hunterBranchStart = speechBlock.indexOf("你是猎人：竞选发言");
const hunterBranchEnd = speechBlock.indexOf("结尾可带一句底气话");
const hunterBranch = speechBlock.slice(hunterBranchStart, hunterBranchEnd);
test('T19 hunter branch has no 开枪 (R30 lesson)', !hunterBranch.includes("开枪"));

// T20: 好人 fallback 保留
test('T20 good person fallback still present', speechBlock.includes("你是好人（${playerRole}）：竞选发言 = 分析能力展示"));

// ==== T21-T25: R29/R30 回归（SHERIFF_RUN 其他角色）====

const runStart = src.indexOf("case PROMPT_ACTIONS.SHERIFF_RUN: {");
const runEnd = src.indexOf("case PROMPT_ACTIONS.SHERIFF_SPEECH:", runStart);
const runBlock = src.slice(runStart, runEnd);

// T21: SHERIFF_RUN 预言家分支
test('T21 SHERIFF_RUN seer branch', runBlock.includes("你是预言家：标准打法是必上警"));

// T22: SHERIFF_RUN 猎人分支
test('T22 SHERIFF_RUN hunter branch', runBlock.includes("上警是值得认真考虑的选项") && runBlock.includes("双重打击"));

// T23: SHERIFF_RUN 女巫分支
test('T23 SHERIFF_RUN witch branch', runBlock.includes("默认不上警——解药+毒药"));

// T24: SHERIFF_RUN 守卫分支
test('T24 SHERIFF_RUN guard branch', runBlock.includes("强烈建议不上警——守卫的最高价值"));

// T25: SHERIFF_RUN 好人 fallback 保留
test('T25 SHERIFF_RUN good person fallback', runBlock.includes("你是好人：可以上警为阵营争取空间"));

// ==== 汇总 ====
console.log(`\n总计: ${passed}/${passed + failed} passed`);
if (failed > 0) process.exit(1);
