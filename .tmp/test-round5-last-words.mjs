/**
 * Round 5 LAST_WORDS prompt verification tests
 * Verifies the enhanced role-specific last words hints in aiPrompts.js
 * Run: node .tmp/test-round5-last-words.mjs
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '../src/services/aiPrompts.js'), 'utf-8');

// Extract the LAST_WORDS case block for inspection
const lwStart = src.indexOf('case PROMPT_ACTIONS.LAST_WORDS:');
const lwEnd = src.indexOf('case PROMPT_ACTIONS.SUMMARIZE_CONTENT:', lwStart);
const lwBlock = src.slice(lwStart, lwEnd);

let passed = 0;
let failed = 0;

function test(name, condition) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}`);
    failed++;
  }
}

console.log('\n=== Round 5: LAST_WORDS 提示词增强验证 ===\n');

// --- 狼人遗言 ---
console.log('[狼人遗言]');
test('T1: 狼人：正向描述"以普通好人的视角"（不用负向禁止词）', lwBlock.includes('以普通好人的视角'));
test('T2: 狼人：提及"职能好人"（对狼队威胁最大）', lwBlock.includes('职能好人'));
test('T3: 狼人：不含明显负向词列表（不含"绝对禁止"）', !lwBlock.includes('绝对禁止'));
test('T4: 狼人：不含自曝相关提示（不含"自曝"）', !lwBlock.includes('自曝'));

// --- 预言家遗言 ---
console.log('\n[预言家遗言]');
test('T5: 预言家：包含"按夜次列出全部查验结果"', lwBlock.includes('按夜次列出全部查验结果'));
test('T6: 预言家：包含"怀疑排序"', lwBlock.includes('怀疑排序'));
test('T7: 预言家：包含12人局警徽流建议（isLargeGame）', lwBlock.includes('hasPoliceFlow') && lwBlock.includes('警徽流建议'));
test('T8: 预言家：列出至少3个步骤（①②③）', lwBlock.includes('①') && lwBlock.includes('②') && lwBlock.includes('③'));

// --- 女巫遗言 ---
console.log('\n[女巫遗言]');
test('T9: 女巫：包含药品状态动态提示', lwBlock.includes('medState'));
test('T10: 女巫：覆盖"双药已用完"场景', lwBlock.includes('双药已用完'));
test('T11: 女巫：覆盖"解药尚存，毒药已用"场景', lwBlock.includes('解药尚存，毒药已用'));
test('T12: 女巫：使用currentPlayer?.hasWitchSave检查', lwBlock.includes('currentPlayer?.hasWitchSave'));
test('T13: 女巫：提示"最高嫌疑的狼人"', lwBlock.includes('最高嫌疑的狼人'));

// --- 猎人遗言 ---
console.log('\n[猎人遗言]');
test('T14: 猎人：包含猎人角色专属分支', lwBlock.includes("playerRole === '猎人'"));
test('T15: 猎人：提及开枪相关（触发开枪）', lwBlock.includes('开枪'));
test('T16: 猎人：积极框架（不含"无法开枪"式纯限制表述）', lwBlock.includes('接棒追查'));

// --- 守卫遗言 ---
console.log('\n[守卫遗言]');
test('T17: 守卫：包含守卫角色专属分支', lwBlock.includes("playerRole === '守卫'"));
test('T18: 守卫：提示"守护记录"', lwBlock.includes('守护记录'));
test('T19: 守卫：提及帮助好人识别谎言', lwBlock.includes('谎言'));

// --- 通用好人遗言 ---
console.log('\n[通用好人遗言]');
test('T20: 通用好人：不含"谁可信、谁可疑"（旧版已替换）', !lwBlock.includes('谁可信、谁可疑'));
test('T21: 通用好人：包含"最高信息密度"', lwBlock.includes('最高信息密度'));
test('T22: 通用好人：包含"投票中的阵营线索"', lwBlock.includes('投票中的阵营线索'));

// --- 结构完整性 ---
console.log('\n[结构完整性]');
test('T23: 仍要求80字以内', lwBlock.includes('80字以内'));
test('T24: 仍要求输出JSON格式', lwBlock.includes('输出JSON'));
test('T25: 包含thought字段', lwBlock.includes('"thought"'));
test('T26: 包含speech字段', lwBlock.includes('"speech"'));
test('T27: isLargeGame（hasPoliceFlow）已定义', lwBlock.includes('isLargeGame(gameState?.gameSetup)'));

// --- 回归检查：不破坏其他case ---
console.log('\n[回归：其他关键提示词未破坏]');
const hasNightSeerIdentityTable = src.includes('"identity_table":{"玩家号"');
test('T28: NIGHT_SEER identity_table仍存在（Round 4修复回归）', hasNightSeerIdentityTable);
const hasSeerThinkingFix = src.includes('最可疑或影响力最大的未验证玩家');
test('T29: 预言家ROLE_PERSONAS降级路径修复仍存在（Round 4）', hasSeerThinkingFix);
const hasWolfTeammatesHint = src.includes('wolfTeammatesHint');
test('T30: 狼人白天发言队友协作逻辑仍存在（Round 3）', hasWolfTeammatesHint);

console.log(`\n=== 结果: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);
