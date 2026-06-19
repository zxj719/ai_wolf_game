/**
 * Round 21 测试脚本 — 摄梦人 shouldReveal 状态追踪修复
 *
 * 修复：
 * - dreamweaver.js: 新增 hasRevealed 参数 + shouldReveal 输出字段 + 条件化阶段显示
 * - useSpeechFlow.js: 新增摄梦人 shouldReveal 消费块
 *
 * 基础设施（Round 20 已完成）：
 * - useWerewolfGame.js: hasRevealed: false 初始化
 * - aiPrompts.js: roleParams 含 hasRevealed
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const pass = (label) => console.log(`  ✅ ${label}`);
const fail = (label, detail = '') => { console.error(`  ❌ ${label}${detail ? ': ' + detail : ''}`); process.exitCode = 1; };

// ───────────────────────────────────────────────────────────────────────────────
// 读取源文件
// ───────────────────────────────────────────────────────────────────────────────
const dreamweaverSrc = readFileSync(join(root, 'src/services/rolePrompts/dreamweaver.js'), 'utf-8');
const speechFlowSrc = readFileSync(join(root, 'src/hooks/useSpeechFlow.js'), 'utf-8');
const aiPromptsSrc = readFileSync(join(root, 'src/services/aiPrompts.js'), 'utf-8');
const werewolfGameSrc = readFileSync(join(root, 'src/useWerewolfGame.js'), 'utf-8');
const magicianSrc = readFileSync(join(root, 'src/services/rolePrompts/magician.js'), 'utf-8');

// ───────────────────────────────────────────────────────────────────────────────
// T1-T6: dreamweaver.js — hasRevealed 参数与条件化分支
// ───────────────────────────────────────────────────────────────────────────────
console.log('\n=== T1-T6: dreamweaver.js 条件化阶段内容 ===');

{
  // T1: getDreamweaverDaySpeechPrompt 应该解构 hasRevealed
  const hasRevealedDestructure = dreamweaverSrc.includes('hasRevealed } = params');
  hasRevealedDestructure
    ? pass('T1: 解构 hasRevealed from params')
    : fail('T1: 缺少 hasRevealed 解构');
}

{
  // T2: 应该有 revealedStatus 变量（含 hasRevealed 的三元判断）
  const hasRevealedStatus = dreamweaverSrc.includes('revealedStatus') && dreamweaverSrc.includes('身份已公开');
  hasRevealedStatus
    ? pass('T2: 存在 revealedStatus + 已公开文案')
    : fail('T2: 缺少 revealedStatus 或 已公开文案');
}

{
  // T3: 当 hasRevealed 时应跳过阶段1（阶段1 已完成）
  const hasSkipStage1 = dreamweaverSrc.includes('阶段1 已完成');
  hasSkipStage1
    ? pass('T3: hasRevealed=true 时显示"阶段1 已完成"')
    : fail('T3: 缺少"阶段1 已完成"文案');
}

{
  // T4: stageContent 使用 let + if 块而非三元表达式
  const usesLetIfBlock = dreamweaverSrc.includes('let stageContent') && dreamweaverSrc.includes('if (hasRevealed)');
  usesLetIfBlock
    ? pass('T4: stageContent 使用 let + if 块')
    : fail('T4: stageContent 未使用 let + if 块');
}

{
  // T5: revealGuide 变量存在，hasRevealed=false 时给出 shouldReveal 跳身份指导
  const hasRevealGuide = dreamweaverSrc.includes('revealGuide') && dreamweaverSrc.includes('是否跳身份判断');
  hasRevealGuide
    ? pass('T5: revealGuide 变量 + 是否跳身份判断指导')
    : fail('T5: 缺少 revealGuide 或 是否跳身份判断');
}

{
  // T6: step4Content 也是条件化的
  const hasStep4Content = dreamweaverSrc.includes('step4Content') && dreamweaverSrc.includes('shouldReveal 决策');
  hasStep4Content
    ? pass('T6: step4Content 存在 + shouldReveal 决策提示')
    : fail('T6: 缺少 step4Content 或 shouldReveal 决策提示');
}

// ───────────────────────────────────────────────────────────────────────────────
// T7-T10: dreamweaver.js — 输出 JSON schema 含 shouldReveal
// ───────────────────────────────────────────────────────────────────────────────
console.log('\n=== T7-T10: dreamweaver.js 输出 JSON schema ===');

{
  // T7: 输出 JSON 应包含 shouldReveal 字段
  const outputIdx = dreamweaverSrc.indexOf('输出JSON:');
  const outputSection = dreamweaverSrc.slice(outputIdx, outputIdx + 400);
  const hasShouldReveal = outputSection.includes('shouldReveal');
  hasShouldReveal
    ? pass('T7: 输出 JSON 包含 shouldReveal 字段')
    : fail('T7: 输出 JSON 缺少 shouldReveal 字段');
}

{
  // T8: 输出 JSON 包含 true/false 作为 shouldReveal 的值说明
  const outputIdx = dreamweaverSrc.indexOf('输出JSON:');
  const outputSection = dreamweaverSrc.slice(outputIdx, outputIdx + 400);
  const hasTrueFalse = outputSection.includes('true/false');
  hasTrueFalse
    ? pass('T8: 输出 JSON 的 shouldReveal 值说明含 true/false')
    : fail('T8: 输出 JSON 缺少 true/false 值说明');
}

{
  // T9: 输出 JSON 不含已知变量的 ${...} 插值（R18 教训：防止模板字符串中静态文本被求值）
  const outputIdx = dreamweaverSrc.indexOf('输出JSON:');
  const outputSection = dreamweaverSrc.slice(outputIdx, outputIdx + 400);
  // 检查不含 ${hasRevealed} 或 ${lastDreamTarget} 等变量插值
  const hasDangerousInterp = outputSection.includes('${hasRevealed') || outputSection.includes('${lastDream') || outputSection.includes('${nightDeaths') || outputSection.includes('${seerChecks');
  !hasDangerousInterp
    ? pass('T9: 输出 JSON schema 内无危险变量插值')
    : fail('T9: 输出 JSON schema 含变量插值（R18 教训：会被求值）');
}

{
  // T10: 输出 JSON 含 identity_table
  const outputIdx = dreamweaverSrc.indexOf('输出JSON:');
  const outputSection = dreamweaverSrc.slice(outputIdx, outputIdx + 400);
  const hasIdentityTable = outputSection.includes('identity_table');
  hasIdentityTable
    ? pass('T10: 输出 JSON 含 identity_table')
    : fail('T10: 输出 JSON 缺少 identity_table');
}

// ───────────────────────────────────────────────────────────────────────────────
// T11-T14: useSpeechFlow.js — 摄梦人 shouldReveal 消费
// ───────────────────────────────────────────────────────────────────────────────
console.log('\n=== T11-T14: useSpeechFlow.js 摄梦人消费块 ===');

{
  // T11: 应该有 DREAMWEAVER + shouldReveal + hasRevealed 的 if 判断
  const hasDreamweaverBlock = speechFlowSrc.includes('ROLE_DEFINITIONS.DREAMWEAVER') && speechFlowSrc.includes('res.shouldReveal');
  hasDreamweaverBlock
    ? pass('T11: 存在 DREAMWEAVER + res.shouldReveal 判断块')
    : fail('T11: 缺少 DREAMWEAVER shouldReveal 消费块');
}

{
  // T12: 消费块有 !currentSpeaker.hasRevealed 幂等守护
  const dwBlockIdx = speechFlowSrc.indexOf('摄梦人跳身份处理');
  const dwSection = speechFlowSrc.slice(dwBlockIdx, dwBlockIdx + 300);
  const hasIdempotentGuard = dwSection.includes('!currentSpeaker.hasRevealed');
  hasIdempotentGuard
    ? pass('T12: 摄梦人消费块含幂等守护 !currentSpeaker.hasRevealed')
    : fail('T12: 缺少幂等守护 !currentSpeaker.hasRevealed');
}

{
  // T13: 摄梦人块不含 return（reveal 不结束白天流程）
  const dwBlockIdx = speechFlowSrc.indexOf('摄梦人跳身份处理');
  const dwSection = speechFlowSrc.slice(dwBlockIdx, dwBlockIdx + 300);
  // 不应该有紧跟 return 的语句（骑士有 return，魔术师和摄梦人不应有）
  const hasReturn = dwSection.includes('\n              return;');
  !hasReturn
    ? pass('T13: 摄梦人消费块无 return（reveal 不结束白天）')
    : fail('T13: 摄梦人消费块含 return（不应有）');
}

{
  // T14: 摄梦人块在魔术师块之后（保持处理顺序一致）
  const magicianBlockIdx = speechFlowSrc.indexOf('魔术师跳身份处理');
  const dreamweaverBlockIdx = speechFlowSrc.indexOf('摄梦人跳身份处理');
  const correctOrder = magicianBlockIdx > 0 && dreamweaverBlockIdx > magicianBlockIdx;
  correctOrder
    ? pass('T14: 摄梦人消费块在魔术师消费块之后')
    : fail('T14: 顺序错误或缺少魔术师/摄梦人块');
}

// ───────────────────────────────────────────────────────────────────────────────
// T15-T16: 基础设施验证（Round 20 已完成，本轮确认无回归）
// ───────────────────────────────────────────────────────────────────────────────
console.log('\n=== T15-T16: 基础设施验证 ===');

{
  // T15: useWerewolfGame.js 含 hasRevealed: false 初始化
  const hasInit = werewolfGameSrc.includes('hasRevealed: false');
  hasInit
    ? pass('T15: useWerewolfGame.js 含 hasRevealed: false 初始化')
    : fail('T15: 缺少 hasRevealed: false 初始化');
}

{
  // T16: aiPrompts.js roleParams 传递 hasRevealed
  const hasRoleParamsPassthrough = aiPromptsSrc.includes('hasRevealed: currentPlayer?.hasRevealed');
  hasRoleParamsPassthrough
    ? pass('T16: aiPrompts.js roleParams 已传递 hasRevealed')
    : fail('T16: aiPrompts.js roleParams 未传递 hasRevealed');
}

// ───────────────────────────────────────────────────────────────────────────────
// T17-T19: 骑士/魔术师回归测试（确保 Round 20 修复无退化）
// ───────────────────────────────────────────────────────────────────────────────
console.log('\n=== T17-T19: 骑士/魔术师回归测试 ===');

{
  // T17: 骑士 shouldDuel 消费仍存在
  const hasKnightDuel = speechFlowSrc.includes('ROLE_DEFINITIONS.KNIGHT') && speechFlowSrc.includes('res.shouldDuel');
  hasKnightDuel
    ? pass('T17: 骑士 shouldDuel 消费块仍存在')
    : fail('T17: 骑士 shouldDuel 消费块丢失（回归）');
}

{
  // T18: 魔术师 shouldReveal 消费仍存在
  const hasMagicianReveal = speechFlowSrc.includes('ROLE_DEFINITIONS.MAGICIAN') && speechFlowSrc.includes('res.shouldReveal');
  hasMagicianReveal
    ? pass('T18: 魔术师 shouldReveal 消费块仍存在')
    : fail('T18: 魔术师 shouldReveal 消费块丢失（回归）');
}

{
  // T19: 魔术师 daySpeech 中的 hasRevealed 分支仍存在
  const hasMagicianRevealBranch = magicianSrc.includes('hasRevealed') && magicianSrc.includes('身份已公开');
  hasMagicianRevealBranch
    ? pass('T19: 魔术师 daySpeech hasRevealed 分支仍存在')
    : fail('T19: 魔术师 daySpeech hasRevealed 分支丢失（回归）');
}

// ───────────────────────────────────────────────────────────────────────────────
// T20-T23: 摄梦人内容一致性检查
// ───────────────────────────────────────────────────────────────────────────────
console.log('\n=== T20-T23: 摄梦人内容一致性 ===');

{
  // T20: "同生共死"机制说明在两个分支中都保留了（revealed/not revealed）
  const syncDeathCount = (dreamweaverSrc.match(/同生共死/g) || []).length;
  syncDeathCount >= 2
    ? pass(`T20: 同生共死出现 ${syncDeathCount} 次（两个分支均保留）`)
    : fail(`T20: 同生共死出现 ${syncDeathCount} 次，应 >=2`);
}

{
  // T21: 死讯逻辑分析（情况A/B/C/D）仍然保留
  const hasSituationABCD = dreamweaverSrc.includes('情况A') && dreamweaverSrc.includes('情况B') && dreamweaverSrc.includes('情况C') && dreamweaverSrc.includes('情况D');
  hasSituationABCD
    ? pass('T21: 死讯逻辑分析（情况A/B/C/D）保留')
    : fail('T21: 死讯逻辑分析缺失');
}

{
  // T22: 输出 JSON 包含 confidence 字段
  const outputIdx = dreamweaverSrc.indexOf('输出JSON:');
  const outputSection = dreamweaverSrc.slice(outputIdx, outputIdx + 400);
  const hasConfidence = outputSection.includes('confidence');
  hasConfidence
    ? pass('T22: 输出 JSON 含 confidence 字段')
    : fail('T22: 输出 JSON 缺少 confidence 字段');
}

{
  // T23: identity_table reason 字段含追加示例提示（R19 教训）
  const outputIdx = dreamweaverSrc.indexOf('输出JSON:');
  const outputSection = dreamweaverSrc.slice(outputIdx, outputIdx + 400);
  const hasAppendHint = outputSection.includes('追加') || outputSection.includes('上轮reason');
  hasAppendHint
    ? pass('T23: identity_table reason 含追加示例提示')
    : fail('T23: identity_table reason 缺少追加示例提示（R19 教训）');
}

// ───────────────────────────────────────────────────────────────────────────────
// 最终结果
// ───────────────────────────────────────────────────────────────────────────────
console.log('\n');
if (process.exitCode === 1) {
  console.error('❌ 部分测试失败，请检查以上错误');
} else {
  console.log('✅ 全部测试通过 (23/23)');
}
