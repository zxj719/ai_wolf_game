/**
 * Round 43 测试脚本
 * 验证：摄梦人和魔术师的 identity_table 读写闭环（DAY→NIGHT + NIGHT→NIGHT）
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const aiPromptsPath = join(root, 'src/services/aiPrompts.js');
const dreamweaverPath = join(root, 'src/services/rolePrompts/dreamweaver.js');
const magicianPath = join(root, 'src/services/rolePrompts/magician.js');

const aiPromptsSrc = readFileSync(aiPromptsPath, 'utf8');
const dreamweaverSrc = readFileSync(dreamweaverPath, 'utf8');
const magicianSrc = readFileSync(magicianPath, 'utf8');

let pass = 0;
let fail = 0;

function test(name, condition) {
  if (condition) {
    console.log(`  ✅ T${pass + fail + 1}: ${name}`);
    pass++;
  } else {
    console.log(`  ❌ T${pass + fail + 1}: FAIL — ${name}`);
    fail++;
  }
}

// ─── 摄梦人 NIGHT_DREAMWEAVER ──────────────────────────────────

console.log('\n[摄梦人 NIGHT_DREAMWEAVER 测试]');

// 定位 NIGHT_DREAMWEAVER case 块
const dwCaseIdx = aiPromptsSrc.indexOf("case PROMPT_ACTIONS.NIGHT_DREAMWEAVER: {");
test('T1: NIGHT_DREAMWEAVER case 块存在', dwCaseIdx !== -1);

const dwBlock = aiPromptsSrc.slice(dwCaseIdx, dwCaseIdx + 4000);

// Step 0 read guard
test('T2: dreamweaverHistoryStep 变量声明存在', dwBlock.includes('dreamweaverHistoryStep'));
test('T3: Step 0 读取连梦候选指令存在', dwBlock.includes('读取历史连梦候选'));
test('T4: 首夜分支存在（无历史记录）', dwBlock.includes('首夜】无历史连梦候选记录'));
test('T5: Step 0 注入到 return 模板中（${dreamweaverHistoryStep}）', dwBlock.includes('${dreamweaverHistoryStep}'));

// identity_table write guide in NIGHT_DREAMWEAVER
test('T6: identity_table 填写指导标题存在', dwBlock.includes('identity_table 填写指导（摄梦人夜间'));
test('T7: "连梦候选" 关键词在写指导中', dwBlock.includes('"连梦候选：'));
test('T8: "下轮 Step 0 将直接从此读取" 前向引用存在', dwBlock.includes('下轮 Step 0 将直接从此读取'));
test('T9: dreamweaverNightLabel 变量声明存在（R18 规范）', dwBlock.includes('dreamweaverNightLabel'));
test('T10: 殉情目标候选字段存在', dwBlock.includes('殉情目标候选'));
test('T11: 追加示例（few-shot）存在', dwBlock.includes('【追加示例】'));
test('T12: output JSON 仍包含 identity_table 字段', dwBlock.includes('"identity_table"'));

// ─── 摄梦人 DAY_SPEECH（dreamweaver.js）─────────────────────────

console.log('\n[摄梦人 DAY_SPEECH（dreamweaver.js）测试]');

// 定位 getDreamweaverDaySpeechPrompt 返回值
const dwDayIdx = dreamweaverSrc.lastIndexOf('输出JSON');
test('T13: dreamweaver.js 含输出 JSON 定义', dwDayIdx !== -1);

const dwDayBlock = dreamweaverSrc.slice(Math.max(0, dwDayIdx - 3000), dwDayIdx + 500);
test('T14: DAY_SPEECH identity_table 填写指导存在', dwDayBlock.includes('identity_table 填写指导（摄梦人白天'));
test('T15: 白天写指导含 "连梦候选" 关键词', dwDayBlock.includes('"连梦候选：'));
test('T16: 白天写指导含 "下轮夜间 Step 0 将直接从此读取"', dwDayBlock.includes('下轮夜间 Step 0 将直接从此读取'));
test('T17: 白天写指导含追加示例', dwDayBlock.includes('【追加示例】'));
test('T18: 白天写指导含防御入梦候选', dwDayBlock.includes('防御入梦候选'));
test('T19: 白天写指导含殉情目标候选', dwDayBlock.includes('殉情目标候选'));

// ─── 魔术师 NIGHT_MAGICIAN（magician.js）────────────────────────

console.log('\n[魔术师 NIGHT_MAGICIAN（magician.js）测试]');

// 定位 getMagicianNightActionPrompt return 段
const magNightReturnIdx = magicianSrc.indexOf('return `魔术师交换选择');
test('T20: getMagicianNightActionPrompt return 段存在', magNightReturnIdx !== -1);

// 变量声明在函数顶部，距 return ~2500 chars；窗口需要 3500
const magNightBefore = magicianSrc.slice(Math.max(0, magNightReturnIdx - 3500), magNightReturnIdx + 100);
test('T21: magicianHistoryStep 变量声明存在', magNightBefore.includes('magicianHistoryStep'));
test('T22: magicianNightLabel 变量声明存在（R18 规范）', magNightBefore.includes('magicianNightLabel'));
test('T23: Step 0 读取换刀候选指令存在', magNightBefore.includes('读取历史换刀候选与保护目标'));
test('T24: 首夜分支存在', magNightBefore.includes('首夜】无历史换刀/保护候选记录'));

const magNightBlock = magicianSrc.slice(magNightReturnIdx, magNightReturnIdx + 3000);
test('T25: ${magicianHistoryStep} 注入到 return 模板中', magNightBlock.includes('${magicianHistoryStep}'));
test('T26: identity_table 填写指导（夜间）存在', magNightBlock.includes('identity_table 填写指导（魔术师夜间'));
test('T27: 夜间写指导含 "换刀候选" 关键词', magNightBlock.includes('"换刀候选：'));
test('T28: 夜间写指导含 "保核目标候选" 关键词', magNightBlock.includes('"保核目标候选：'));
test('T29: 夜间写指导含 "下轮 Step 0 将直接从此读取"', magNightBlock.includes('下轮 Step 0 将直接从此读取'));
test('T30: 夜间写指导含追加示例', magNightBlock.includes('【追加示例】'));
test('T31: output JSON 仍包含 identity_table', magNightBlock.includes('"identity_table"'));

// ─── 魔术师 DAY_SPEECH（magician.js）────────────────────────────

console.log('\n[魔术师 DAY_SPEECH（magician.js）测试]');

const magDayReturnIdx = magicianSrc.indexOf('return `${getBaseContext(ctx)}');
test('T32: getMagicianDaySpeechPrompt return 段存在', magDayReturnIdx !== -1);

const magDayBlock = magicianSrc.slice(magDayReturnIdx, magDayReturnIdx + 4000);
test('T33: DAY_SPEECH identity_table 填写指导存在', magDayBlock.includes('identity_table 填写指导（魔术师白天'));
test('T34: 白天写指导含 "换刀候选" 关键词', magDayBlock.includes('"换刀候选：'));
test('T35: 白天写指导含 "保核目标候选" 关键词', magDayBlock.includes('"保核目标候选：'));
test('T36: 白天写指导含 "下轮夜间 Step 0 将直接从此读取"', magDayBlock.includes('下轮夜间 Step 0 将直接从此读取'));
test('T37: 白天写指导含追加示例', magDayBlock.includes('【追加示例】'));

// ─── 回归：原有四角色关键词对齐（R42）────────────────────────────

console.log('\n[回归：R42 四角色关键词对齐（5项抽检）]');

test('T38: 狼人 DAY_SPEECH 含 "高优先刀口"', aiPromptsSrc.includes('"高优先刀口：'));
test('T39: 预言家 DAY_SPEECH 含 "排队查验优先级"', aiPromptsSrc.includes('排队查验优先级：①'));
test('T40: 女巫 DAY_SPEECH 含 "毒药优先候选"', aiPromptsSrc.includes('"毒药优先候选：'));
test('T41: 守卫 DAY_SPEECH 含 "守护优先级：高" (含冒号)', aiPromptsSrc.includes('"守护优先级：高'));
test('T42: NIGHT_WOLF Step 0 含 "高优先刀口"', aiPromptsSrc.includes('"高优先刀口"'));

// ─── 常驻诊断：无悬空的"供下轮"前向引用────────────────────────

console.log('\n[常驻诊断]');

const suspendedRefs = ['供下轮', '下轮用', '下轮参考', '下轮复查'];
const hasSuspended = suspendedRefs.some(kw => aiPromptsSrc.includes(kw));
test('T43: aiPrompts.js 无悬空前向引用（"供下轮/下轮复查" 等）', !hasSuspended);

// ─── 结果汇总 ────────────────────────────────────────────────────

console.log(`\n==== Round 43 测试结果：${pass}/${pass + fail} passed ====\n`);
if (fail > 0) process.exit(1);
