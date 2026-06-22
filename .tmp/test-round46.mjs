/**
 * Round 46 — 三项 Bug 修复验证脚本
 * Bug 1: dreamweaverHistory/magicianHistory 缺失（useAI.js & WerewolfModule.jsx）
 * Bug 2: NIGHT_DREAMWEAVER hasRevealed 未从 currentPlayer 回退读取
 * Bug 3: NIGHT_MAGICIAN hasRevealed 未被 getMagicianNightActionPrompt 消费
 * Bug 4: SHERIFF_BADGE_PASS seerChecks 从 params 读取（永远为空），改为从 gameState 读取
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const aiPromptsSrc = readFileSync(path.join(root, 'src/services/aiPrompts.js'), 'utf8');
const magicianSrc = readFileSync(path.join(root, 'src/services/rolePrompts/magician.js'), 'utf8');
const useAISrc = readFileSync(path.join(root, 'src/hooks/useAI.js'), 'utf8');
const werewolfModuleSrc = readFileSync(path.join(root, 'src/modules/werewolf/WerewolfModule.jsx'), 'utf8');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    const result = fn();
    if (result === true || result === undefined) {
      console.log(`✅ ${name}`);
      passed++;
    } else {
      console.log(`❌ ${name}: ${result}`);
      failed++;
    }
  } catch (e) {
    console.log(`❌ ${name}: ${e.message}`);
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

// ────── Bug 1: useAI.js 接受 dreamweaverHistory / magicianHistory ──────
test('T1: useAI.js 参数列表包含 dreamweaverHistory', () => {
  assert(useAISrc.includes('dreamweaverHistory = null'), 'useAI.js 未包含 dreamweaverHistory 默认参数');
});
test('T2: useAI.js 参数列表包含 magicianHistory', () => {
  assert(useAISrc.includes('magicianHistory = null'), 'useAI.js 未包含 magicianHistory 默认参数');
});
test('T3: useAI.js gameState 包含 dreamweaverHistory', () => {
  const gsIdx = useAISrc.indexOf('const gameState = {');
  assert(gsIdx > 0, 'gameState 未找到');
  const gsBlock = useAISrc.slice(gsIdx, gsIdx + 800);
  assert(gsBlock.includes('dreamweaverHistory,'), `gameState 未注入 dreamweaverHistory，块内容：\n${gsBlock}`);
});
test('T4: useAI.js gameState 包含 magicianHistory', () => {
  const gsIdx = useAISrc.indexOf('const gameState = {');
  assert(gsIdx > 0, 'gameState 未找到');
  const gsBlock = useAISrc.slice(gsIdx, gsIdx + 800);
  assert(gsBlock.includes('magicianHistory,'), `gameState 未注入 magicianHistory，块内容：\n${gsBlock}`);
});

// ────── Bug 1: WerewolfModule.jsx 传递 dreamweaverHistory / magicianHistory ──────
test('T5: WerewolfModule.jsx useAI() 调用传递 dreamweaverHistory', () => {
  const useAICallIdx = werewolfModuleSrc.indexOf('const { askAI } = useAI({');
  assert(useAICallIdx >= 0, 'WerewolfModule.jsx useAI 调用未找到');
  const callBlock = werewolfModuleSrc.slice(useAICallIdx, useAICallIdx + 600);
  assert(callBlock.includes('dreamweaverHistory,'), `useAI() 调用未包含 dreamweaverHistory\n${callBlock}`);
});
test('T6: WerewolfModule.jsx useAI() 调用传递 magicianHistory', () => {
  const useAICallIdx = werewolfModuleSrc.indexOf('const { askAI } = useAI({');
  assert(useAICallIdx >= 0, 'WerewolfModule.jsx useAI 调用未找到');
  const callBlock = werewolfModuleSrc.slice(useAICallIdx, useAICallIdx + 600);
  assert(callBlock.includes('magicianHistory,'), `useAI() 调用未包含 magicianHistory\n${callBlock}`);
});

// ────── Bug 1: DAY_SPEECH roleParams 中的 dreamHistory/swappedPlayers 来自 gameState ──────
test('T7: DAY_SPEECH roleParams dreamHistory 读取 gameState.dreamweaverHistory', () => {
  assert(aiPromptsSrc.includes('dreamHistory: gameState.dreamweaverHistory'), 'DAY_SPEECH roleParams 未正确引用 gameState.dreamweaverHistory');
});
test('T8: DAY_SPEECH roleParams swappedPlayers 读取 gameState.magicianHistory', () => {
  assert(aiPromptsSrc.includes('swappedPlayers: gameState.magicianHistory?.swappedPlayers'), 'DAY_SPEECH roleParams 未正确引用 gameState.magicianHistory');
});
test('T9: LAST_WORDS 摄梦人 读取 gameState.dreamweaverHistory', () => {
  const lwIdx = aiPromptsSrc.indexOf('case PROMPT_ACTIONS.LAST_WORDS:');
  assert(lwIdx >= 0, 'LAST_WORDS case 未找到');
  const lwBlock = aiPromptsSrc.slice(lwIdx, lwIdx + 2000);
  assert(lwBlock.includes('gameState.dreamweaverHistory'), `LAST_WORDS 未读取 gameState.dreamweaverHistory\n${lwBlock.slice(0,400)}`);
});
test('T10: LAST_WORDS 魔术师 读取 gameState.magicianHistory', () => {
  const lwIdx = aiPromptsSrc.indexOf('case PROMPT_ACTIONS.LAST_WORDS:');
  assert(lwIdx >= 0, 'LAST_WORDS case 未找到');
  // 魔术师是 LAST_WORDS 中最后一个特殊分支，需要 4000 char 窗口（R24 教训：复杂分支用大窗口）
  const lwBlock = aiPromptsSrc.slice(lwIdx, lwIdx + 4000);
  assert(lwBlock.includes('gameState?.magicianHistory'), `LAST_WORDS 未读取 gameState.magicianHistory\n${lwBlock.slice(0,400)}`);
});

// ────── Bug 2: NIGHT_DREAMWEAVER hasRevealed 从 currentPlayer 回退读取 ──────
test('T11: NIGHT_DREAMWEAVER hasRevealed 使用 currentPlayer 回退', () => {
  const dwIdx = aiPromptsSrc.indexOf('case PROMPT_ACTIONS.NIGHT_DREAMWEAVER:');
  assert(dwIdx >= 0, 'NIGHT_DREAMWEAVER case 未找到');
  const dwBlock = aiPromptsSrc.slice(dwIdx, dwIdx + 500);
  assert(
    dwBlock.includes('params.hasRevealed ?? params.currentPlayer?.hasRevealed'),
    `NIGHT_DREAMWEAVER 未使用 currentPlayer 回退读取 hasRevealed\n${dwBlock}`
  );
});
test('T12: NIGHT_DREAMWEAVER 不再从 params 直接解构 hasRevealed', () => {
  const dwIdx = aiPromptsSrc.indexOf('case PROMPT_ACTIONS.NIGHT_DREAMWEAVER:');
  assert(dwIdx >= 0);
  const dwBlock = aiPromptsSrc.slice(dwIdx, dwIdx + 300);
  // 不应在解构中有 hasRevealed: dwHasRevealed
  assert(!dwBlock.includes('hasRevealed: dwHasRevealed'), `NIGHT_DREAMWEAVER 仍在解构中含 hasRevealed: dwHasRevealed`);
});
test('T13: NIGHT_DREAMWEAVER dwHasRevealed 定义后被使用（触发 dwRevealedAlert）', () => {
  const dwIdx = aiPromptsSrc.indexOf('case PROMPT_ACTIONS.NIGHT_DREAMWEAVER:');
  assert(dwIdx >= 0);
  const dwBlock = aiPromptsSrc.slice(dwIdx, dwIdx + 1800);
  assert(dwBlock.includes('if (dwHasRevealed)'), `NIGHT_DREAMWEAVER 未使用 dwHasRevealed\n${dwBlock.slice(0,400)}`);
});

// ────── Bug 3: NIGHT_MAGICIAN hasRevealed 在 magician.js 中被消费 ──────
test('T14: magician.js getMagicianNightActionPrompt 解构 hasRevealed', () => {
  assert(magicianSrc.includes('hasRevealed,'), 'magician.js 未解构 hasRevealed');
});
test('T15: magician.js 身份已公开时自保优先（if hasRevealed 块）', () => {
  assert(magicianSrc.includes('if (hasRevealed) {'), 'magician.js 未检查 hasRevealed 分支');
});
test('T16: magician.js 自保优先块包含 C（自保——最高优先！身份已暴露）', () => {
  const revIdx = magicianSrc.indexOf('if (hasRevealed) {');
  assert(revIdx >= 0);
  const revBlock = magicianSrc.slice(revIdx, revIdx + 400);
  assert(revBlock.includes('最高优先'), `自保优先块未包含"最高优先"标记\n${revBlock}`);
});
test('T17: magician.js 未暴露时也有优先级C（非强制路径）', () => {
  assert(magicianSrc.includes('if (!hasRevealed) {'), 'magician.js 缺少 !hasRevealed 时的 C 分支');
});
test('T18: magician.js 优先级标签随 hasRevealed 动态切换', () => {
  assert(magicianSrc.includes("hasRevealed ? '优先级A（保核）' : '优先级A（保核——最高优先）'"), '优先级A标签未动态切换');
});

// ────── Bug 4: SHERIFF_BADGE_PASS seerChecks 从 gameState 读取 ──────
test('T19: SHERIFF_BADGE_PASS 不再从 params 解构 seerChecks', () => {
  const bpIdx = aiPromptsSrc.indexOf('case PROMPT_ACTIONS.SHERIFF_BADGE_PASS:');
  assert(bpIdx >= 0, 'SHERIFF_BADGE_PASS case 未找到');
  const bpBlock = aiPromptsSrc.slice(bpIdx, bpIdx + 300);
  // 不应有 seerChecks: bpSeerChecks 在解构中
  assert(!bpBlock.includes('seerChecks: bpSeerChecks'), `SHERIFF_BADGE_PASS 仍在解构 seerChecks\n${bpBlock}`);
});
test('T20: SHERIFF_BADGE_PASS 从 gameState.seerChecks 读取', () => {
  const bpIdx = aiPromptsSrc.indexOf('case PROMPT_ACTIONS.SHERIFF_BADGE_PASS:');
  assert(bpIdx >= 0);
  const bpBlock = aiPromptsSrc.slice(bpIdx, bpIdx + 400);
  assert(bpBlock.includes('gameState.seerChecks'), `SHERIFF_BADGE_PASS 未使用 gameState.seerChecks\n${bpBlock}`);
});
test('T21: SHERIFF_BADGE_PASS seerHint 仍然可以被填充（goldWaterTargets 逻辑存在）', () => {
  const bpIdx = aiPromptsSrc.indexOf('case PROMPT_ACTIONS.SHERIFF_BADGE_PASS:');
  assert(bpIdx >= 0);
  const bpBlock = aiPromptsSrc.slice(bpIdx, bpIdx + 800);
  assert(bpBlock.includes('goldWaterTargets'), `SHERIFF_BADGE_PASS 缺少 goldWaterTargets 逻辑\n${bpBlock}`);
  assert(bpBlock.includes('killedTargets'), `SHERIFF_BADGE_PASS 缺少 killedTargets 逻辑\n${bpBlock}`);
});

// ────── 回归测试：关键旧有功能不受影响 ──────
test('T22: NIGHT_WOLF hasRevealed 场景不受影响（无狼人版 hasRevealed 逻辑）', () => {
  const wolfIdx = aiPromptsSrc.lastIndexOf('case PROMPT_ACTIONS.NIGHT_WOLF:');
  assert(wolfIdx >= 0);
  const wolfBlock = aiPromptsSrc.slice(wolfIdx, wolfIdx + 300);
  // 狼人夜行不需要 hasRevealed
  assert(!wolfBlock.includes('hasRevealed'), '意外地在 NIGHT_WOLF 中添加了 hasRevealed');
});
test('T23: DAY_SPEECH 摄梦人委托到 getRoleModule', () => {
  assert(aiPromptsSrc.includes("'摄梦人': (ctx, params) => getRoleModule('摄梦人').daySpeech(ctx, params)"), '摄梦人 DAY_SPEECH 委托路径丢失');
});
test('T24: DAY_SPEECH 魔术师委托到 getRoleModule', () => {
  assert(aiPromptsSrc.includes("'魔术师': (ctx, params) => getRoleModule('魔术师').daySpeech(ctx, params)"), '魔术师 DAY_SPEECH 委托路径丢失');
});
test('T25: SHERIFF_VOTE 仍使用 gameState.seerChecks（不受影响）', () => {
  const svIdx = aiPromptsSrc.indexOf('case PROMPT_ACTIONS.SHERIFF_VOTE:');
  assert(svIdx >= 0);
  const svBlock = aiPromptsSrc.slice(svIdx, svIdx + 500);
  assert(svBlock.includes('gameState.seerChecks'), `SHERIFF_VOTE 不再使用 gameState.seerChecks\n${svBlock}`);
});
test('T26: NIGHT_MAGICIAN 传递 hasRevealed 给模块（aiPrompts.js）', () => {
  const nmIdx = aiPromptsSrc.indexOf('case PROMPT_ACTIONS.NIGHT_MAGICIAN:');
  assert(nmIdx >= 0);
  // hasRevealed: currentPlayer?.hasRevealed 在 case 开头约 1400 字节处（R24 教训：大 case 用大窗口）
  const nmBlock = aiPromptsSrc.slice(nmIdx, nmIdx + 1500);
  assert(nmBlock.includes('hasRevealed: currentPlayer?.hasRevealed'), `NIGHT_MAGICIAN 未传 hasRevealed\n${nmBlock}`);
});
test('T27: magician.js 步骤0（读取历史）仍然存在', () => {
  assert(magicianSrc.includes('读取历史换刀候选与保护目标'), 'magician.js 步骤0 消失');
});
test('T28: magician.js identity_table 写指导仍存在', () => {
  assert(magicianSrc.includes('换刀候选'), 'magician.js identity_table 写指导消失');
});

// ────── 实验性：模拟 SHERIFF_BADGE_PASS 行为 ──────
test('T29: SHERIFF_BADGE_PASS gameState 路径逻辑模拟', () => {
  // 模拟：seerChecks 在 gameState 中有验证结果，候选人在 validTargets
  const mockSeerChecks = [
    { targetId: 3, isWolf: false },  // 金水
    { targetId: 5, isWolf: true },   // 查杀
  ];
  const badgeTargets = [2, 3, 4, 5, 6];
  const badgeableSet = new Set(badgeTargets);
  const goldWaterTargets = mockSeerChecks.filter(c => !c.isWolf && badgeableSet.has(c.targetId));
  const killedTargets = mockSeerChecks.filter(c => c.isWolf && badgeableSet.has(c.targetId));

  assert(goldWaterTargets.length === 1 && goldWaterTargets[0].targetId === 3, '金水过滤逻辑错误');
  assert(killedTargets.length === 1 && killedTargets[0].targetId === 5, '查杀过滤逻辑错误');

  // 验证 hint 生成
  let seerHint = '';
  if (goldWaterTargets.length > 0) seerHint += `\n⚡金水：${goldWaterTargets.map(c => `${c.targetId}号`).join('、')}`;
  if (killedTargets.length > 0) seerHint += `\n⛔查杀：${killedTargets.map(c => `${c.targetId}号`).join('、')}`;

  assert(seerHint.includes('3号'), '金水 hint 缺少 3 号');
  assert(seerHint.includes('5号'), '查杀 hint 缺少 5 号');
});

test('T30: NIGHT_DREAMWEAVER hasRevealed 回退逻辑模拟', () => {
  // 模拟 params 没有 hasRevealed 但有 currentPlayer.hasRevealed = true
  const params = {
    dreamHistory: { dreamedPlayers: [3] },
    lastDreamTarget: 3,
    aliveTargets: [1, 2, 4, 5],
    currentPlayer: { id: 7, hasRevealed: true, role: '摄梦人' }
    // 注意：没有直接的 hasRevealed 字段
  };
  const dwHasRevealed = params.hasRevealed ?? params.currentPlayer?.hasRevealed ?? false;
  assert(dwHasRevealed === true, `hasRevealed 回退读取失败，结果：${dwHasRevealed}`);
});

test('T31: NIGHT_DREAMWEAVER hasRevealed 回退（两者均无时为 false）', () => {
  const params = { dreamHistory: {}, lastDreamTarget: null, aliveTargets: [1, 2, 3] };
  const dwHasRevealed = params.hasRevealed ?? params.currentPlayer?.hasRevealed ?? false;
  assert(dwHasRevealed === false, `hasRevealed 默认值应为 false，得到：${dwHasRevealed}`);
});

test('T32: magician.js hasRevealed=true 时 strategyHints 包含自保最高优先标记', () => {
  // 验证魔术师自保优先逻辑存在且正确
  const hasRevealedBlock = magicianSrc.slice(magicianSrc.indexOf('if (hasRevealed) {'), magicianSrc.indexOf('if (hasRevealed) {') + 600);
  assert(hasRevealedBlock.includes('最高优先！身份已暴露'), `自保最高优先标记不存在\n${hasRevealedBlock}`);
  assert(hasRevealedBlock.includes('交换自己和最高嫌疑狼人'), '自换指令不存在');
});

test('T33: useAI.js gameState 中 dreamweaverHistory 在 claimHistory 附近（结构完整性）', () => {
  const gsIdx = useAISrc.indexOf('const gameState = {');
  const gsEnd = useAISrc.indexOf('};', gsIdx);
  const gsBlock = useAISrc.slice(gsIdx, gsEnd + 2);
  assert(gsBlock.includes('claimHistory'), 'claimHistory 不在 gameState 中');
  assert(gsBlock.includes('dreamweaverHistory'), 'dreamweaverHistory 不在 gameState 中');
  assert(gsBlock.includes('magicianHistory'), 'magicianHistory 不在 gameState 中');
});

// ────── 汇总 ──────
console.log(`\n总计：${passed + failed} 项，通过 ${passed}，失败 ${failed}`);
if (failed > 0) process.exit(1);
