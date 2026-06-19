/**
 * Round 26 测试脚本
 * 验证 DAY_SPEECH 预言家悍跳应对策略（item 47）
 * - counterClaimants 参数注入
 * - 对跳局面专属策略三步框架
 * - 残局策略
 * - seer.js 思维维度同步
 * - ROLE_PERSONAS 降级路径同步
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const src = readFileSync(path.join(root, 'src/services/aiPrompts.js'), 'utf8');
const seerSrc = readFileSync(path.join(root, 'src/services/rolePrompts/seer.js'), 'utf8');

let passed = 0;
let failed = 0;

function test(name, condition, errorMsg = '') {
    if (condition) {
        console.log(`  ✅ ${name}`);
        passed++;
    } else {
        console.log(`  ❌ ${name}${errorMsg ? ': ' + errorMsg : ''}`);
        failed++;
    }
}

// ── 定位辅助函数 ──────────────────────────────────────────────────────────────
// 找到 ROLE_DAY_SPEECH_PROMPTS['预言家'] 函数的文本区间
const seerFnMarker = `'预言家': (ctx, params) => {`;
const seerFnStart = src.lastIndexOf(seerFnMarker); // lastIndexOf 避免 getCOTTemplate 干扰（R22教训）
// 该函数结束于下一个 '    },' 后 —— 定位到 '女巫' 函数开始
const witchFnMarker = `    '女巫': (ctx, params) => {`;
const witchFnStart = src.indexOf(witchFnMarker, seerFnStart);
const seerFnBlock = src.slice(seerFnStart, witchFnStart);

// 找到 DAY_SPEECH case 中的 roleParams 构建区间
const roleParamsMarker = `const roleParams = {`;
const roleParamsStart = src.indexOf(roleParamsMarker, src.lastIndexOf('case PROMPT_ACTIONS.DAY_SPEECH:'));
const roleParamsEnd = src.indexOf('};', roleParamsStart) + 2;
const roleParamsBlock = src.slice(roleParamsStart, roleParamsEnd);

// ROLE_PERSONAS 预言家 区间
const personasMarker = `    '预言家': {`;
// ROLE_PERSONAS 对象中的预言家（不在 ROLE_DAY_SPEECH_PROMPTS 里）
const personasStart = src.indexOf(personasMarker, src.indexOf('ROLE_PERSONAS'));
const personasEnd = src.indexOf('    },', personasStart + 10) + 5;
const personasBlock = src.slice(personasStart, personasEnd);


// ═══════════════════════════════════════════════════════════════════════
console.log('\n【T1-T5】roleParams counterClaimants 注入验证');
// ═══════════════════════════════════════════════════════════════════════

test('T1: roleParams 包含 counterClaimants 字段',
    roleParamsBlock.includes('counterClaimants:'));

test('T2: counterClaimants 仅在角色为预言家时计算',
    roleParamsBlock.includes(`playerRole === '预言家'`));

test('T3: counterClaimants 过滤 jump_seer 类型',
    roleParamsBlock.includes(`c.type === 'jump_seer'`));

test('T4: counterClaimants 排除自身（避免自我检测）',
    roleParamsBlock.includes(`c.playerId !== currentPlayer?.id`));

test('T5: 非预言家角色 counterClaimants 为空数组',
    roleParamsBlock.includes(`: []`));

// ═══════════════════════════════════════════════════════════════════════
console.log('\n【T6-T10】对跳局面专属策略内容验证');
// ═══════════════════════════════════════════════════════════════════════

test('T6: 函数中包含 counterClaimants 变量声明',
    seerFnBlock.includes('const counterClaimants = params.counterClaimants || [];'));

test('T7: 包含 counterClaimSection 动态构建逻辑',
    seerFnBlock.includes('let counterClaimSection = \'\''));

test('T8: 包含 Step A 框架（主动公开查验记录）',
    seerFnBlock.includes('Step A'));

test('T9: 包含 Step B 框架（找对方矛盾点）',
    seerFnBlock.includes('Step B'));

test('T10: 包含 Step C 框架（心路历程收口）',
    seerFnBlock.includes('Step C'));

// ═══════════════════════════════════════════════════════════════════════
console.log('\n【T11-T14】对跳局面策略博弈依据验证');
// ═══════════════════════════════════════════════════════════════════════

test('T11: 包含"悍跳狼只有结果"（心路历程鉴别）',
    seerFnBlock.includes('悍跳狼只有结果，没有合理的查验心路历程'));

test('T12: 包含从"被动防守"到"主动进攻"的语气原则',
    seerFnBlock.includes('语气原则'));

test('T13: 思维链 Step2 包含对跳分支路由',
    seerFnBlock.includes('Step2: 场上有对跳预言家？→ 有：执行【对跳局面专属策略】Step A-B-C'));

test('T14: 发言要点第5条指向对跳框架而非泛化建议',
    seerFnBlock.includes('执行上方【对跳局面专属策略】三步框架'));

// ═══════════════════════════════════════════════════════════════════════
console.log('\n【T15-T18】残局策略验证');
// ═══════════════════════════════════════════════════════════════════════

test('T15: 包含 aliveCount 变量（来自 params）',
    seerFnBlock.includes('const aliveCount = params.aliveCount || 8'));

test('T16: 残局阈值为 ≤5 人',
    seerFnBlock.includes('aliveCount <= 5'));

test('T17: 包含残局模式标题',
    seerFnBlock.includes('【残局模式（存活≤5人）】'));

test('T18: 残局策略提到一锤定音公布结果',
    seerFnBlock.includes('一锤定音'));

// ═══════════════════════════════════════════════════════════════════════
console.log('\n【T19-T22】格式安全检查（R18 教训：指导文本无 JS 变量插值）');
// ═══════════════════════════════════════════════════════════════════════

// 找到 counterClaimSection 字符串字面量范围（赋值行开始到分号结束）
const ccSectionStart = seerFnBlock.indexOf('counterClaimSection = `');
const ccSectionEnd = seerFnBlock.indexOf('`;', ccSectionStart) + 2;
const ccSectionText = seerFnBlock.slice(ccSectionStart, ccSectionEnd);

test('T19: counterClaimSection 模板字符串内只有 ${ccIds} 合法插值（无其他 JS 变量）',
    // ccSectionText 中除了 ${ccIds} 之外不应有其他 ${ 插值
    !ccSectionText.replace('${ccIds}', '').includes('${'));

// Step A/B/C 文本使用方括号占位符而不是 JS 插值
const stepALine = seerFnBlock.indexOf('Step A');
const stepALineEnd = seerFnBlock.indexOf('\n', stepALine);
const stepAText = seerFnBlock.slice(stepALine, stepALineEnd);

test('T20: Step A 行使用方括号占位符而非 JS 插值',
    !stepAText.includes('${'));

const stepBLine = seerFnBlock.indexOf('Step B');
const stepBLineEnd = seerFnBlock.indexOf('\n', stepBLine);
const stepBText = seerFnBlock.slice(stepBLine, stepBLineEnd);

test('T21: Step B 行使用方括号占位符而非 JS 插值',
    !stepBText.includes('${'));

const stepCLine = seerFnBlock.indexOf('Step C');
const stepCLineEnd = seerFnBlock.indexOf('\n', stepCLine);
const stepCText = seerFnBlock.slice(stepCLine, stepCLineEnd);

test('T22: Step C 行使用方括号占位符而非 JS 插值',
    !stepCText.includes('${'));

// ═══════════════════════════════════════════════════════════════════════
console.log('\n【T23-T26】seer.js 思维维度同步验证（R4 教训）');
// ═══════════════════════════════════════════════════════════════════════

test('T23: seer.js 第一维度仍包含五级优先级框架',
    seerSrc.includes('① 悍跳响应（验证对跳报告）'));

test('T24: seer.js 第二维度更新为三步法',
    seerSrc.includes('戳穿悍跳（白天执行三步法）'));

test('T25: seer.js 三步法包含"金水/查杀是否冲突"',
    seerSrc.includes('金水/查杀是否冲突'));

test('T26: seer.js 第三维度保留心路历程',
    seerSrc.includes('心路历程：我的查验选择是否有合理的信息链依据可以解释？'));

// ═══════════════════════════════════════════════════════════════════════
console.log('\n【T27-T30】ROLE_PERSONAS 降级路径同步验证（R4 教训）');
// ═══════════════════════════════════════════════════════════════════════

test('T27: ROLE_PERSONAS 预言家包含五级优先级（第一维度）',
    personasBlock.includes('① 悍跳响应（验证对跳报告）'));

test('T28: ROLE_PERSONAS 预言家第二维度已更新为三步法',
    personasBlock.includes('戳穿悍跳（白天执行三步法）'));

test('T29: ROLE_PERSONAS 降级路径与 seer.js 第二维度一致',
    // 两处使用相同的关键词
    seerSrc.includes('戳穿悍跳（白天执行三步法）') &&
    personasBlock.includes('戳穿悍跳（白天执行三步法）'));

test('T30: identity_table 指导保留"待明日报"标记',
    seerFnBlock.includes('待明日报'));

// ═══════════════════════════════════════════════════════════════════════
console.log('\n【T31-T35】原有功能保留验证（防回归）');
// ═══════════════════════════════════════════════════════════════════════

test('T31: 查验记录展示保留',
    seerFnBlock.includes('【你的查验记录】'));

test('T32: 金水保护提示保留',
    seerFnBlock.includes('【金水(好人)】'));

test('T33: 查杀带票提示保留',
    seerFnBlock.includes('【查杀(狼人)】'));

test('T34: 警徽流逻辑保留（12人局）',
    seerFnBlock.includes('policeFlowPoint'));

test('T35: voteIntention 禁投金水提示保留',
    seerFnBlock.includes('绝不能是金水号码'));

// ═══════════════════════════════════════════════════════════════════════
console.log('\n═══════════════════════════════════════════════════════════');
console.log(`总计: ${passed} 通过，${failed} 失败`);
if (failed === 0) {
    console.log('✅ 全部测试通过！');
} else {
    console.log('❌ 有测试失败，需要修复');
    process.exit(1);
}
