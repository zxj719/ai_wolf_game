/**
 * Round 41 测试脚本
 * 验证：NIGHT_SEER 读写闭环（seerHistoryStep）+ HUNTER_SHOOT 读写闭环（hunterHistoryStep）
 * 遵循 R22/R24/R25 教训：窗口需比预期大 30%；用 lastIndexOf 或精确锚点锁定真实 case。
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(__dirname, '../src/services/aiPrompts.js'), 'utf8');

let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.error(`  ❌ ${name}`);
    failed++;
  }
}

// ─── NIGHT_SEER 定位 ─────────────────────────────────────────────────────────
// NIGHT_SEER 有花括号（R11 规范确认），用精确形式定位
const seerCaseIdx = src.indexOf('case PROMPT_ACTIONS.NIGHT_SEER: {');
assert(seerCaseIdx !== -1, 'T0: NIGHT_SEER case 存在（带花括号）');

// NIGHT_WITCH 在 NIGHT_SEER 之后，用作窗口上边界
const witchCaseIdx = src.indexOf('case PROMPT_ACTIONS.NIGHT_WITCH: {');
const seerBlock = src.slice(seerCaseIdx, witchCaseIdx);
assert(seerBlock.length > 0, 'T1: seerBlock 提取成功（非空）');

// ─── NIGHT_SEER seerNightLabel 检测 ─────────────────────────────────────────
console.log('\n── NIGHT_SEER seerNightLabel (R18 规范) ──');
assert(seerBlock.includes('const seerNightLabel = `N${ctx.dayCount}`'), 'T2: seerNightLabel 变量在 case 块内定义');
assert(!seerBlock.includes('N${ctx.dayCount} 夜'), 'T3: return 模板不含原始 N${ctx.dayCount}（已替换为 seerNightLabel）');
assert(seerBlock.includes('当前第 ${seerNightLabel} 夜'), 'T4: 查验历史行用 seerNightLabel 替换');

// ─── NIGHT_SEER seerHistoryStep 检测 ─────────────────────────────────────────
console.log('\n── NIGHT_SEER seerHistoryStep (读写闭环) ──');
assert(seerBlock.includes('const seerHistoryStep = ctx.dayCount > 1'), 'T5: seerHistoryStep 变量定义（首夜/N2+分支）');
assert(seerBlock.includes('排队查验优先级'), 'T6: N2+ 分支提及"排队查验优先级"关键词');
assert(seerBlock.includes('首夜'), 'T7: 首夜分支存在');
assert(seerBlock.includes('${seerHistoryStep}'), 'T8: return 模板注入 seerHistoryStep');

// Step 0 应该出现在 seerNightStrategy 之前（先读历史，再执行策略）
const histStepPos = seerBlock.indexOf('${seerHistoryStep}');
const nightStratPos = seerBlock.indexOf('${seerNightStrategy}');
assert(histStepPos < nightStratPos && histStepPos !== -1 && nightStratPos !== -1,
  'T9: seerHistoryStep 注入位置在 seerNightStrategy 之前');

// ─── NIGHT_SEER identity_table 写指导更新 ────────────────────────────────────
console.log('\n── NIGHT_SEER identity_table 写指导（前向引用追加）──');
assert(seerBlock.includes('${seerNightLabel}夜查验确认'), 'T10: 已查验玩家 reason 写指导用 seerNightLabel 动态化');
assert(seerBlock.includes('下轮 Step 0 将直接从此读取'), 'T11: 排队查验优先级写指导含"下轮 Step 0"前向引用');

// R18 规范：return 模板内的指导文本不能含 ctx.dayCount 直接插值
const returnStart = seerBlock.indexOf('return `预言家查验决策');
assert(returnStart !== -1, 'T12: return 语句定位成功');
const returnBlock = seerBlock.slice(returnStart);
assert(!returnBlock.includes('ctx.dayCount'), 'T13: return 模板内无 ctx.dayCount 直接插值（R18 规范）');

// ─── HUNTER_SHOOT 定位 ───────────────────────────────────────────────────────
console.log('\n── HUNTER_SHOOT hunterHistoryStep (读写闭环) ──');
const hunterCaseIdx = src.indexOf('case PROMPT_ACTIONS.HUNTER_SHOOT: {');
assert(hunterCaseIdx !== -1, 'T14: HUNTER_SHOOT case 存在（带花括号）');

// 定位 HUNTER_SHOOT case 结束边界（SHERIFF_RUN 之后）
const sheriffRunIdx = src.indexOf('case PROMPT_ACTIONS.SHERIFF_RUN: {');
const hunterBlock = src.slice(hunterCaseIdx, sheriffRunIdx);
assert(hunterBlock.length > 0, 'T15: hunterBlock 提取成功（非空）');

assert(hunterBlock.includes('const hunterHistoryStep = '), 'T16: hunterHistoryStep 变量在 HUNTER_SHOOT case 块内定义');
assert(hunterBlock.includes('开枪优先级：高'), 'T17: hunterHistoryStep 提及"开枪优先级：高"关键词');
assert(hunterBlock.includes('预言家查杀信息优先于此'), 'T18: hunterHistoryStep 说明查杀信息优先（不覆盖现有优先级框架）');
assert(hunterBlock.includes('${hunterHistoryStep}'), 'T19: return 模板注入 hunterHistoryStep');

// Step 0 应在 hunterStrategies 列出之前（历史候选先读，再执行策略）
const hunterHistPos = hunterBlock.indexOf('${hunterHistoryStep}');
const hunterStratPos = hunterBlock.indexOf('${hunterStrategies.map');
assert(hunterHistPos !== -1 && hunterStratPos !== -1 && hunterHistPos < hunterStratPos,
  'T20: hunterHistoryStep 注入位置在 hunterStrategies 之前');

// ─── 常驻诊断命令检查 ─────────────────────────────────────────────────────────
console.log('\n── 常驻诊断命令（读写闭环清零确认）──');
const keywords = ['供下轮', '下轮用', '下轮参考', '下轮复查'];
const diagMatches = keywords.some(k => src.includes(k));
// "下轮 Step 0 将直接从此读取" 是新格式，不含上述旧关键词 → 应该清零
assert(!diagMatches, 'T21: 诊断命令 grep "供下轮|下轮用|下轮参考|下轮复查" 返回空（旧格式清零）');

// 新格式"下轮 Step 0"应存在于 SEER/WITCH/WOLF/GUARD 写指导中
const newFormatCount = (src.match(/下轮 Step 0 将直接从此读取/g) || []).length;
assert(newFormatCount >= 4, `T22: "下轮 Step 0"格式出现 ${newFormatCount} 次（预期≥4：WOLF/WITCH/GUARD/SEER）`);

// ─── 回归测试 ─────────────────────────────────────────────────────────────────
console.log('\n── 回归测试（R40 NIGHT_GUARD/NIGHT_WOLF/NIGHT_WITCH）──');
// 文件中 case 顺序：NIGHT_GUARD → NIGHT_MAGICIAN → NIGHT_WOLF → NIGHT_SEER → NIGHT_WITCH
// NIGHT_WOLF wolfHistoryStep（NIGHT_WOLF 在 NIGHT_SEER 之前）
const wolfCaseIdx = src.indexOf('case PROMPT_ACTIONS.NIGHT_WOLF: {');
// NIGHT_SEER 是 NIGHT_WOLF 之后的下一个，用作边界
const wolfEndIdx = src.indexOf('case PROMPT_ACTIONS.NIGHT_SEER: {');
const wolfBlock = src.slice(wolfCaseIdx, wolfEndIdx);
assert(wolfBlock.includes('wolfHistoryStep'), 'T23: NIGHT_WOLF wolfHistoryStep 存在（R38 回归）');

// NIGHT_GUARD guardHistoryStep（NIGHT_GUARD 在 NIGHT_MAGICIAN 之前）
const guardCaseIdx = src.indexOf('case PROMPT_ACTIONS.NIGHT_GUARD: {');
const magicianCaseIdx = src.indexOf('case PROMPT_ACTIONS.NIGHT_MAGICIAN:');
const guardBlock = src.slice(guardCaseIdx, magicianCaseIdx);
assert(guardBlock.includes('guardHistoryStep'), 'T24: NIGHT_GUARD guardHistoryStep 存在（R40 回归）');

// NIGHT_WITCH witchHistoryStep
assert(src.slice(witchCaseIdx, seerCaseIdx > witchCaseIdx ? src.indexOf('case PROMPT_ACTIONS.NIGHT_DREAMWEAVER:') : witchCaseIdx + 3000).includes('witchHistoryStep'), 'T25: NIGHT_WITCH witchHistoryStep 存在（R39 回归）');

// ─── 结果 ────────────────────────────────────────────────────────────────────
console.log(`\n总计：${passed + failed} 项，通过 ${passed}，失败 ${failed}`);
if (failed > 0) process.exit(1);
