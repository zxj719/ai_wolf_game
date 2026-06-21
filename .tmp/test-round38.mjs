/**
 * Round 38 测试脚本
 * 验证 NIGHT_WOLF 读写闭环改进：
 * - Step 0（历史刀口读取）
 * - 思维链步骤更新
 * - identity_table 战略更新（读写闭环标注）
 * - wolfNightLabel 变量引入（R18 规范）
 */

import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dirname, '../src/services/aiPrompts.js'), 'utf8');

let passed = 0;
let failed = 0;
const TOTAL = 28;

function test(name, fn) {
    try {
        const result = fn();
        if (result === true || result === undefined) {
            console.log(`  ✅ ${name}`);
            passed++;
        } else {
            console.error(`  ❌ ${name} → 期望 true, 得到 ${result}`);
            failed++;
        }
    } catch (e) {
        console.error(`  ❌ ${name} → 异常: ${e.message}`);
        failed++;
    }
}

// ── 定位 NIGHT_WOLF case 块 ────────────────────────────────────────────
// NIGHT_WOLF 现在有花括号（R11 修复），且 getCOTTemplate 里也有 NIGHT_WOLF 的 case
// 用 "case PROMPT_ACTIONS.NIGHT_WOLF: {" 精确定位真实 generateUserPrompt case
const nightWolfStart = src.indexOf('case PROMPT_ACTIONS.NIGHT_WOLF: {');
// NIGHT_SEER 标志着 NIGHT_WOLF 结束
const nightSeerStart = src.indexOf('case PROMPT_ACTIONS.NIGHT_SEER: {');
console.log('\n── 定位 ─────────────────────────────────────');
console.log(`  NIGHT_WOLF case 起始: ${nightWolfStart}`);
console.log(`  NIGHT_SEER case 起始: ${nightSeerStart}`);

// T0: case 找到且在 NIGHT_SEER 之前
test('T0: NIGHT_WOLF case 有花括号且可定位', () => nightWolfStart > 0 && nightWolfStart < nightSeerStart);

const nightWolfBlock = src.slice(nightWolfStart, nightSeerStart);

// ── Step 0 / 历史刀口读取 ─────────────────────────────────────────────
console.log('\n── Step 0 历史刀口读取 ─────────────────────────────────────');

test('T1: wolfNightLabel 变量定义存在', () => nightWolfBlock.includes('const wolfNightLabel'));
test('T2: wolfNightLabel 使用 ctx.dayCount（动态计算）', () => nightWolfBlock.includes('`N${ctx.dayCount}`'));
test('T3: wolfHistoryStep 变量定义存在', () => nightWolfBlock.includes('const wolfHistoryStep'));
test('T4: wolfHistoryStep 基于 dayCount > 1 分支', () => nightWolfBlock.includes('ctx.dayCount > 1'));
test('T5: N2+ 夜读取历史刀口分支文本', () => nightWolfBlock.includes('读取历史刀口'));
test('T6: 首夜分支有"无历史刀口"说明', () => nightWolfBlock.includes('首夜') && nightWolfBlock.includes('无历史刀口记录'));
test('T7: Step 0 引用"系统提示中【你之前的身份推理表】"', () => nightWolfBlock.includes('你之前的身份推理表'));
test('T8: Step 0 提到"高优先刀口"关键词', () => nightWolfBlock.includes('高优先刀口') && nightWolfBlock.indexOf('高优先刀口') < nightWolfBlock.indexOf('wolfHistoryStep') + 5000);

// ── 思维链步骤更新 ────────────────────────────────────────────────────
console.log('\n── 思维链步骤 1-3 ─────────────────────────────────────────');

// wolfHistoryStep 在模板字符串中被插值
test('T9: wolfHistoryStep 在 return 模板中被插值', () => nightWolfBlock.includes('${wolfHistoryStep}'));
test('T10: 步骤1含"角色推断"', () => nightWolfBlock.includes('角色推断'));
test('T11: 步骤2含"期望价值评估"', () => nightWolfBlock.includes('期望价值评估'));
test('T12: 步骤3含"最终决策"和"切换原因"', () => nightWolfBlock.includes('最终决策') && nightWolfBlock.includes('切换原因'));

// ── identity_table 读写闭环 ───────────────────────────────────────────
console.log('\n── identity_table 读写闭环 ─────────────────────────────────');

test('T13: 标题含"读写闭环"', () => nightWolfBlock.includes('读写闭环'));
test('T14: 写操作：高优先刀口 reason 写法说明存在', () => nightWolfBlock.includes('高优先刀口：[具体威胁原因]'));
test('T15: 前向引用"下轮 Step 0 将直接从此读取"', () => nightWolfBlock.includes('下轮 Step 0 将直接从此读取'));
test('T16: 执行状态追踪：wolfNightLabel 夜行刀标记', () => nightWolfBlock.includes('${wolfNightLabel}夜行刀'));
test('T17: 执行状态追踪：防止下轮重复评估', () => nightWolfBlock.includes('防止下轮重复评估'));
test('T18: 狼队友 identity_table 策略保留（维持公开发言一致性）', () => nightWolfBlock.includes('维持公开发言一致性'));
test('T19: 低威胁村民条目保留', () => nightWolfBlock.includes('无明显神职特征'));

// ── R18 规范：指导文本无直接 JS 变量插值 ─────────────────────────────
console.log('\n── R18 规范检查 ───────────────────────────────────────────');

// 确认 ${ctx.dayCount} 不在指导文本 instructions 区域（只在 wolfNightLabel 定义处出现）
// 我们要验证 wolfNightLabel 行之后的 return 模板中不含 ${ctx.dayCount}
const returnStart = nightWolfBlock.indexOf('return `狼人袭击决策');
const returnBlock = nightWolfBlock.slice(returnStart);
test('T20: return 模板中不含 ${ctx.dayCount}（已通过 wolfNightLabel 间接使用）',
    () => !returnBlock.includes('${ctx.dayCount}'));

// 确认 wolfNightLabel 在 return 模板前定义
const wolfNightLabelDef = nightWolfBlock.indexOf('const wolfNightLabel');
test('T21: wolfNightLabel 在 return 语句前定义（R18 合规）',
    () => wolfNightLabelDef > 0 && wolfNightLabelDef < returnStart);

// ── 回归测试 ───────────────────────────────────────────────────────────
console.log('\n── 回归测试（其他 NIGHT_* case）─────────────────────────');

// NIGHT_SEER 回归
const nightSeerEnd = src.indexOf('case PROMPT_ACTIONS.NIGHT_WITCH:', nightSeerStart);
const nightSeerBlock = src.slice(nightSeerStart, nightSeerEnd);
test('T22: NIGHT_SEER 仍有 identity_table 输出字段', () => nightSeerBlock.includes('identity_table'));
test('T23: NIGHT_SEER 仍有 counterClaimText 悍跳逻辑', () => nightSeerBlock.includes('counterClaimText'));

// NIGHT_WITCH 回归
const nightWitchStart = src.indexOf('case PROMPT_ACTIONS.NIGHT_WITCH:', nightSeerEnd);
const nightGuardStart = src.indexOf('case PROMPT_ACTIONS.NIGHT_GUARD:', 0);
const nightWitchBlock = src.slice(nightWitchStart, nightWitchStart + 2000);
test('T24: NIGHT_WITCH 仍有 identity_table 输出字段', () => nightWitchBlock.includes('identity_table'));

// DAY_VOTE 回归（Step A/B 结构）
const dayVoteStart = src.lastIndexOf('case PROMPT_ACTIONS.DAY_VOTE: {');
const dayVoteBlock = src.slice(dayVoteStart, dayVoteStart + 4000);
test('T25: DAY_VOTE Step A 三维打分框架保留', () => dayVoteBlock.includes('Step A') && dayVoteBlock.includes('逻辑自洽'));
test('T26: DAY_VOTE Step B 热力校正规则保留', () => dayVoteBlock.includes('Step B'));

// NIGHT_WOLF 输出 schema 完整性
test('T27: NIGHT_WOLF 输出 schema 包含全部必要字段',
    () => nightWolfBlock.includes('"targetId"') &&
          nightWolfBlock.includes('"reasoning"') &&
          nightWolfBlock.includes('"thought"') &&
          nightWolfBlock.includes('"identity_table"'));

// ── 汇总 ───────────────────────────────────────────────────────────────
console.log(`\n── 结果 ─────────────────────────────────────────────────`);
console.log(`  通过: ${passed}/${TOTAL}   失败: ${failed}`);
if (failed > 0) process.exit(1);
