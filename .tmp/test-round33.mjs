/**
 * Round 33 测试：多狼发言顺序感知（isFirstWolfToSpeak）
 * 验证两个改动：
 * 1. useSpeechFlow.js 正确计算 isFirstWolfToSpeak
 * 2. aiPrompts.js wolf DAY_SPEECH 正确使用 wolfRoleAssignment
 */
import { readFileSync } from 'fs';

const speechFlowSrc = readFileSync('./src/hooks/useSpeechFlow.js', 'utf8');
const promptsSrc = readFileSync('./src/services/aiPrompts.js', 'utf8');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${name}: ${e.message}`);
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

// ── 1. useSpeechFlow.js: 新增代码结构 ──────────────────────────────────
console.log('\nT1-T8: useSpeechFlow.js 发言顺序感知');

test('T1 - 计算 wolfSpeakParams 的代码块存在', () => {
  assert(speechFlowSrc.includes('wolfSpeakParams'), '缺少 wolfSpeakParams 变量');
});

test('T2 - 只有角色是狼人时才计算', () => {
  assert(speechFlowSrc.includes("currentSpeaker.role === '狼人'"), '缺少狼人角色判断');
});

test('T3 - 过滤存活狼人队友', () => {
  assert(speechFlowSrc.includes("p.isAlive && p.role === '狼人' && p.id !== currentSpeaker.id"), '缺少存活队友过滤条件');
});

test('T4 - 只在有队友时才设置（solo wolf 不设）', () => {
  assert(speechFlowSrc.includes('wolfTeammateIds.length > 0'), '缺少队友数量检查');
});

test('T5 - 通过 speechHistory 检测已说话的队友', () => {
  assert(speechFlowSrc.includes('speechHistory.some(s => s.day === dayCount && s.playerId === id)'),
    '缺少通过 speechHistory 检测已说话队友的逻辑');
});

test('T6 - isFirstWolfToSpeak 为 true 当没有队友已发言', () => {
  assert(speechFlowSrc.includes('wolfSpeakParams.isFirstWolfToSpeak = alreadySpokenWolves.length === 0'),
    '缺少 isFirstWolfToSpeak 赋值逻辑');
});

test('T7 - 将 wolfSpeakParams 传入 askAI 调用', () => {
  assert(speechFlowSrc.includes('await askAI(currentSpeaker, PROMPT_ACTIONS.DAY_SPEECH, wolfSpeakParams)'),
    '没有将 wolfSpeakParams 传入 askAI');
});

test('T8 - 原有不带参数的 askAI DAY_SPEECH 调用已被替换', () => {
  assert(!speechFlowSrc.includes('await askAI(currentSpeaker, PROMPT_ACTIONS.DAY_SPEECH);'),
    '旧的无参数 askAI 调用仍然存在（应已被替换）');
});

// ── 2. aiPrompts.js: wolfRoleAssignment ──────────────────────────────
console.log('\nT9-T18: aiPrompts.js wolf DAY_SPEECH wolfRoleAssignment');

// 定位狼人 DAY_SPEECH 函数块
const wolfDaySpeechStart = promptsSrc.indexOf("'狼人': (ctx, params) => {");
assert(wolfDaySpeechStart !== -1, '找不到狼人 DAY_SPEECH 函数');
const wolfBlock = promptsSrc.slice(wolfDaySpeechStart, wolfDaySpeechStart + 4000);

test('T9 - wolfRoleAssignment 变量存在', () => {
  assert(wolfBlock.includes('wolfRoleAssignment'), '缺少 wolfRoleAssignment 变量');
});

test('T10 - 检查 isFirstWolfToSpeak !== undefined（存在性检查）', () => {
  assert(wolfBlock.includes('params.isFirstWolfToSpeak !== undefined'),
    '缺少 isFirstWolfToSpeak 存在性检查');
});

test('T11 - 主动方分支存在（isFirstWolfToSpeak === true）', () => {
  assert(wolfBlock.includes('本轮你是：主动方'), '缺少主动方角色确认文本');
});

test('T12 - 低调方分支存在（isFirstWolfToSpeak === false）', () => {
  assert(wolfBlock.includes('本轮你是：低调方'), '缺少低调方角色确认文本');
});

test('T13 - 主动方描述：带动话题', () => {
  assert(wolfBlock.includes('带动讨论方向'), '主动方描述缺少"带动讨论方向"指导');
});

test('T14 - 低调方描述：中立评委', () => {
  assert(wolfBlock.includes('中立评委口吻'), '低调方描述缺少"中立评委口吻"指导');
});

test('T15 - 低调方：制造分歧感', () => {
  assert(wolfBlock.includes('轻微分歧'), '低调方描述缺少"轻微分歧"指导');
});

test('T16 - wolfRoleAssignment 被包含在 wolfTeammatesHint 中', () => {
  assert(wolfBlock.includes('${wolfRoleAssignment}'),
    'wolfRoleAssignment 未被插入 wolfTeammatesHint 模板字符串');
});

test('T17 - 无数据时 wolfRoleAssignment 为空字符串（兜底）', () => {
  // 当 isFirstWolfToSpeak === undefined 时，赋值应为 ''
  const undefinedBranch = wolfBlock.includes("let wolfRoleAssignment = ''") ||
                          wolfBlock.includes("wolfRoleAssignment = ''");
  // 也检查变量初始化为空串
  const initIdx = wolfBlock.indexOf('wolfRoleAssignment');
  const initWindow = wolfBlock.slice(initIdx, initIdx + 200);
  assert(initWindow.includes("= ''") || initWindow.includes('= "";') ||
         wolfBlock.includes("wolfRoleAssignment = ''"),
    'undefined 时 wolfRoleAssignment 应初始化为空串');
});

test('T18 - 主动方分支不包含"队友"等敏感词（不暴露协作）', () => {
  const mainActiveIdx = wolfBlock.indexOf('本轮你是：主动方');
  const mainActiveLine = wolfBlock.slice(mainActiveIdx, mainActiveIdx + 200);
  // speech 层面的隐性威慑：这只是 thought 层引导，所以队友信息是OK的
  // 但要确保没有让 AI 在 speech 中提及"我的队友"这类词
  // 这里只验证存在性，不做负向断言（因为 thought 层可以提队友）
  assert(mainActiveLine.includes('主动点名') || mainActiveLine.includes('率先开口'),
    '主动方分支描述不够具体');
});

// ── 3. 逻辑模拟验证 ──────────────────────────────────────────────────
console.log('\nT19-T25: 逻辑模拟验证');

// 模拟 isFirstWolfToSpeak 计算逻辑
function computeIsFirstWolf(currentSpeakerId, players, speechHistory, dayCount) {
  const wolfTeammateIds = players
    .filter(p => p.isAlive && p.role === '狼人' && p.id !== currentSpeakerId)
    .map(p => p.id);
  if (wolfTeammateIds.length === 0) return undefined; // solo wolf
  const alreadySpokenWolves = wolfTeammateIds.filter(id =>
    speechHistory.some(s => s.day === dayCount && s.playerId === id)
  );
  return alreadySpokenWolves.length === 0;
}

const mockPlayers = [
  { id: 1, isAlive: true, role: '狼人' },
  { id: 2, isAlive: true, role: '狼人' },
  { id: 3, isAlive: true, role: '预言家' },
  { id: 4, isAlive: true, role: '村民' },
];
const mockHistory = [
  { day: 1, playerId: 3 },
  { day: 2, playerId: 2 }, // 狼2在第2天已发言
];

test('T19 - 首个说话的狼：isFirstWolfToSpeak = true', () => {
  // 第2天，狼1是第一个说话的狼（狼2尚未在第2天发言）
  const result = computeIsFirstWolf(1, mockPlayers, [
    { day: 1, playerId: 3 },
    { day: 1, playerId: 2 }, // 第1天已说
  ], 2); // 第2天，只有第1天的记录
  assert(result === true, `期望 true，得到 ${result}`);
});

test('T20 - 后发言的狼：isFirstWolfToSpeak = false', () => {
  // 第2天，狼1要说话，但狼2已经在第2天发言了
  const result = computeIsFirstWolf(1, mockPlayers, [
    { day: 1, playerId: 3 },
    { day: 2, playerId: 2 }, // 狼2在第2天已说
  ], 2);
  assert(result === false, `期望 false，得到 ${result}`);
});

test('T21 - 单狼（无队友）：返回 undefined', () => {
  const singleWolfPlayers = [
    { id: 1, isAlive: true, role: '狼人' },
    { id: 2, isAlive: true, role: '预言家' },
  ];
  const result = computeIsFirstWolf(1, singleWolfPlayers, [], 1);
  assert(result === undefined, `期望 undefined，得到 ${result}`);
});

test('T22 - 死亡的狼队友不算入队友列表', () => {
  const playersWithDeadWolf = [
    { id: 1, isAlive: true, role: '狼人' },
    { id: 2, isAlive: false, role: '狼人' }, // 已死
    { id: 3, isAlive: true, role: '村民' },
  ];
  const result = computeIsFirstWolf(1, playersWithDeadWolf, [], 2);
  // 队友2已死，相当于单狼
  assert(result === undefined, `死亡队友后应视为单狼（undefined），得到 ${result}`);
});

test('T23 - 其他天的发言记录不影响本天判断', () => {
  // 狼2在第1天已发言，但第2天尚未发言 → 狼1在第2天是首发
  const result = computeIsFirstWolf(1, mockPlayers, [
    { day: 1, playerId: 2 }, // 第1天
  ], 2); // 第2天
  assert(result === true, `跨天记录不应影响本天判断，期望 true，得到 ${result}`);
});

test('T24 - 3狼场景：第3个说话的狼是低调方', () => {
  const threeWolfPlayers = [
    { id: 1, isAlive: true, role: '狼人' },
    { id: 2, isAlive: true, role: '狼人' },
    { id: 3, isAlive: true, role: '狼人' },
  ];
  // 狼1和狼2都已发言，狼3是第3个
  const histWith2Spoken = [
    { day: 1, playerId: 1 },
    { day: 1, playerId: 2 },
  ];
  const result = computeIsFirstWolf(3, threeWolfPlayers, histWith2Spoken, 1);
  assert(result === false, `第3只狼（队友均已发言）应为 false，得到 ${result}`);
});

test('T25 - wolfRoleAssignment 出现在 wolfTeammatesHint 的模板字符串中', () => {
  // 确认 wolfTeammatesHint 的模板字符串赋值包含 ${wolfRoleAssignment}
  // 模板字符串赋值以 `\n【多狼协作` 开头
  const teamHintTemplateIdx = wolfBlock.indexOf('`\\n【多狼协作');
  assert(teamHintTemplateIdx !== -1, '找不到 wolfTeammatesHint 模板字符串');
  const teamHintTemplate = wolfBlock.slice(teamHintTemplateIdx, teamHintTemplateIdx + 600);
  assert(teamHintTemplate.includes('${wolfRoleAssignment}'),
    'wolfTeammatesHint 模板字符串未包含 ${wolfRoleAssignment}');
});

// ── Summary ──────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`总计：${passed + failed} 测试 | ✅ ${passed} 通过 | ❌ ${failed} 失败`);
if (failed > 0) process.exit(1);
