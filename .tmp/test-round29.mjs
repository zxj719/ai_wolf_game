/**
 * Round 29 测试：SHERIFF_RUN 角色分化策略验证
 * 测试猎人/女巫/守卫三角色在上警决策中的差异化提示词
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '../src/services/aiPrompts.js'), 'utf-8');

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
  if (!cond) throw new Error(msg || '断言失败');
}

// 定位 SHERIFF_RUN case 块（确保是 generateUserPrompt 里的真实实现，不是 getCOTTemplate）
// 用 lastIndexOf 确保找到最后一个（真正的实现在 generateUserPrompt 中）
const sheriffRunIdx = src.lastIndexOf('case PROMPT_ACTIONS.SHERIFF_RUN:');
assert(sheriffRunIdx >= 0, '找不到 SHERIFF_RUN case');

// 找到 case 块的结束位置（下一个 case）
const nextCaseIdx = src.indexOf('case PROMPT_ACTIONS.SHERIFF_SPEECH:', sheriffRunIdx);
assert(nextCaseIdx > sheriffRunIdx, '找不到 SHERIFF_SPEECH case');

const sheriffRunBlock = src.slice(sheriffRunIdx, nextCaseIdx);

console.log('\n=== T1-T5: 使用 let + if 块（R15 教训：多分支用 let+if 而非三元）===');

test('T1: 使用 let srHint = 空字符串初始化', () => {
  assert(sheriffRunBlock.includes("let srHint = '';"), "应使用 let srHint = '' 而非三元表达式");
});

test('T2: 预言家分支存在', () => {
  assert(sheriffRunBlock.includes("if (playerRole === '预言家')"), '缺少预言家 if 分支');
});

test('T3: 狼人分支存在', () => {
  assert(sheriffRunBlock.includes("} else if (playerRole === '狼人')"), '缺少狼人 else if 分支');
});

test('T4: 猎人独立分支存在（不再与女巫/守卫合并）', () => {
  assert(sheriffRunBlock.includes("} else if (playerRole === '猎人')"), '猎人应有独立 else if 分支');
  // 确保不存在把猎人和女巫/守卫放在同一条件中的旧写法
  assert(!sheriffRunBlock.includes("'女巫' || playerRole === '猎人' || playerRole === '守卫'"),
    '猎人不应再与女巫/守卫合并为同一条件');
});

test('T5: 女巫和守卫各有独立分支', () => {
  assert(sheriffRunBlock.includes("} else if (playerRole === '女巫')"), '缺少女巫独立分支');
  assert(sheriffRunBlock.includes("} else if (playerRole === '守卫')"), '缺少守卫独立分支');
});

console.log('\n=== T6-T10: 猎人策略内容验证（上警是值得考虑的选项）===');

test('T6: 猎人提示词说明"值得认真考虑"而非默认不上警', () => {
  // 找到猎人分支
  const hunterIdx = sheriffRunBlock.indexOf("} else if (playerRole === '猎人')");
  const witchIdx = sheriffRunBlock.indexOf("} else if (playerRole === '女巫')");
  const hunterBlock = sheriffRunBlock.slice(hunterIdx, witchIdx);
  assert(hunterBlock.includes('值得认真考虑') || hunterBlock.includes('值得'), '猎人提示词应体现"值得考虑"');
});

test('T7: 猎人提示词包含利弊分析', () => {
  const hunterIdx = sheriffRunBlock.indexOf("} else if (playerRole === '猎人')");
  const witchIdx = sheriffRunBlock.indexOf("} else if (playerRole === '女巫')");
  const hunterBlock = sheriffRunBlock.slice(hunterIdx, witchIdx);
  assert(hunterBlock.includes('上警优势') || hunterBlock.includes('利'), '猎人提示词应包含利弊分析');
});

test('T8: 猎人提示词提到"开枪"（死亡双重价值）', () => {
  const hunterIdx = sheriffRunBlock.indexOf("} else if (playerRole === '猎人')");
  const witchIdx = sheriffRunBlock.indexOf("} else if (playerRole === '女巫')");
  const hunterBlock = sheriffRunBlock.slice(hunterIdx, witchIdx);
  assert(hunterBlock.includes('开枪'), '猎人提示词应提到开枪（死亡双重威慑）');
});

test('T9: 猎人提示词提到"警徽"移交', () => {
  const hunterIdx = sheriffRunBlock.indexOf("} else if (playerRole === '猎人')");
  const witchIdx = sheriffRunBlock.indexOf("} else if (playerRole === '女巫')");
  const hunterBlock = sheriffRunBlock.slice(hunterIdx, witchIdx);
  assert(hunterBlock.includes('警徽'), '猎人提示词应提到可移交警徽');
});

test('T10: 猎人提示词包含具体决策建议（发言能力判断）', () => {
  const hunterIdx = sheriffRunBlock.indexOf("} else if (playerRole === '猎人')");
  const witchIdx = sheriffRunBlock.indexOf("} else if (playerRole === '女巫')");
  const hunterBlock = sheriffRunBlock.slice(hunterIdx, witchIdx);
  assert(hunterBlock.includes('决策建议') || hunterBlock.includes('倾向'), '猎人提示词应包含具体决策建议');
});

console.log('\n=== T11-T15: 女巫策略内容验证（默认不上警 + 例外）===');

test('T11: 女巫提示词说明默认不上警', () => {
  const witchIdx = sheriffRunBlock.indexOf("} else if (playerRole === '女巫')");
  const guardIdx = sheriffRunBlock.indexOf("} else if (playerRole === '守卫')");
  const witchBlock = sheriffRunBlock.slice(witchIdx, guardIdx);
  assert(witchBlock.includes('默认不上警') || witchBlock.includes('标准打法是不上警'), '女巫提示词应说明默认不上警');
});

test('T12: 女巫提示词提到"解药"和"毒药"（隐性武器）', () => {
  const witchIdx = sheriffRunBlock.indexOf("} else if (playerRole === '女巫')");
  const guardIdx = sheriffRunBlock.indexOf("} else if (playerRole === '守卫')");
  const witchBlock = sheriffRunBlock.slice(witchIdx, guardIdx);
  assert(witchBlock.includes('解药') || witchBlock.includes('毒药'), '女巫提示词应提到药品作为不上警的原因');
});

test('T13: 女巫提示词包含"例外"条件', () => {
  const witchIdx = sheriffRunBlock.indexOf("} else if (playerRole === '女巫')");
  const guardIdx = sheriffRunBlock.indexOf("} else if (playerRole === '守卫')");
  const witchBlock = sheriffRunBlock.slice(witchIdx, guardIdx);
  assert(witchBlock.includes('例外') || witchBlock.includes('可考虑'), '女巫提示词应说明例外情形');
});

test('T14: 女巫例外条件包含"警徽落入狼方"场景', () => {
  const witchIdx = sheriffRunBlock.indexOf("} else if (playerRole === '女巫')");
  const guardIdx = sheriffRunBlock.indexOf("} else if (playerRole === '守卫')");
  const witchBlock = sheriffRunBlock.slice(witchIdx, guardIdx);
  assert(witchBlock.includes('警徽落入狼') || witchBlock.includes('落入狼方'), '女巫例外应包含防止警徽落狼场景');
});

test('T15: 女巫例外包含"药用完"降低成本条件', () => {
  const witchIdx = sheriffRunBlock.indexOf("} else if (playerRole === '女巫')");
  const guardIdx = sheriffRunBlock.indexOf("} else if (playerRole === '守卫')");
  const witchBlock = sheriffRunBlock.slice(witchIdx, guardIdx);
  assert(witchBlock.includes('已全部用完') || witchBlock.includes('用完'), '女巫例外应包含药品用完降低成本的条件');
});

console.log('\n=== T16-T20: 守卫策略内容验证（强烈建议不上警）===');

test('T16: 守卫提示词使用"强烈建议不上警"（比女巫更坚定）', () => {
  const guardIdx = sheriffRunBlock.indexOf("} else if (playerRole === '守卫')");
  const elseIdx = sheriffRunBlock.indexOf('} else {', guardIdx);
  const guardBlock = sheriffRunBlock.slice(guardIdx, elseIdx);
  assert(guardBlock.includes('强烈建议不上警'), '守卫提示词应使用"强烈建议不上警"');
});

test('T17: 守卫提示词解释不确定性价值', () => {
  const guardIdx = sheriffRunBlock.indexOf("} else if (playerRole === '守卫')");
  const elseIdx = sheriffRunBlock.indexOf('} else {', guardIdx);
  const guardBlock = sheriffRunBlock.slice(guardIdx, elseIdx);
  assert(guardBlock.includes('不确定性') || guardBlock.includes('不知道是谁'), '守卫提示词应解释隐藏价值');
});

test('T18: 守卫提示词说明上警会让狼人针对性调整', () => {
  const guardIdx = sheriffRunBlock.indexOf("} else if (playerRole === '守卫')");
  const elseIdx = sheriffRunBlock.indexOf('} else {', guardIdx);
  const guardBlock = sheriffRunBlock.slice(guardIdx, elseIdx);
  assert(guardBlock.includes('针对性') || guardBlock.includes('转移刀目标') || guardBlock.includes('削弱'),
    '守卫提示词应说明暴露后狼人可针对性调整');
});

test('T19: 守卫提示词包含"极端例外"（比女巫"例外"更苛刻）', () => {
  const guardIdx = sheriffRunBlock.indexOf("} else if (playerRole === '守卫')");
  const elseIdx = sheriffRunBlock.indexOf('} else {', guardIdx);
  const guardBlock = sheriffRunBlock.slice(guardIdx, elseIdx);
  assert(guardBlock.includes('极端例外') || guardBlock.includes('唯一'), '守卫的例外条件应比女巫更苛刻');
});

test('T20: 守卫极端例外包含"警徽几乎确定将落入狼方"条件', () => {
  const guardIdx = sheriffRunBlock.indexOf("} else if (playerRole === '守卫')");
  const elseIdx = sheriffRunBlock.indexOf('} else {', guardIdx);
  const guardBlock = sheriffRunBlock.slice(guardIdx, elseIdx);
  assert(guardBlock.includes('落入狼') || guardBlock.includes('落狼'), '守卫极端例外应包含警徽确定落狼条件');
});

console.log('\n=== T21-T25: 回归测试（R28 核心特性完整性）===');

// 检查 isSheriff 后处理注入是否还在
test('T21: R28 isSheriff 后处理注入仍然存在', () => {
  assert(src.includes('isSheriff: currentPlayer?.isSheriff || false'), 'isSheriff roleParams 注入应存在');
  assert(src.includes('roleParams.isSheriff'), 'sheriffHint 条件检查应存在');
});

test('T22: R27 seerCounterClaimantsInVote 检测仍然存在', () => {
  assert(src.includes('seerCounterClaimantsInVote') || src.includes('counterClaimants'),
    '对跳投票优先级逻辑应存在');
});

test('T23: R26 预言家对跳三步法仍然存在', () => {
  assert(src.includes('Step A') || src.includes('Step B'), '预言家对跳三步法应存在');
});

test('T24: NIGHT_* case 均含 identity_table（全量检查，包括委托模块）', () => {
  // 读取委托模块（NIGHT_MAGICIAN → magician.js，NIGHT_DREAMWEAVER → dreamweaver.js 的 nightAction 函数）
  const magicianSrc = readFileSync(join(__dirname, '../src/services/rolePrompts/magician.js'), 'utf-8');
  const dreamweaverSrc = readFileSync(join(__dirname, '../src/services/rolePrompts/dreamweaver.js'), 'utf-8');

  // 检查直接在 aiPrompts.js 实现的 NIGHT_* case
  const directCases = ['NIGHT_GUARD', 'NIGHT_SEER', 'NIGHT_WOLF', 'NIGHT_WITCH'];
  for (const nc of directCases) {
    const idx = src.lastIndexOf(`case PROMPT_ACTIONS.${nc}:`);
    assert(idx >= 0, `找不到 ${nc} case`);
    const nextIdx = src.indexOf('case PROMPT_ACTIONS.', idx + 1);
    const block = src.slice(idx, nextIdx > idx ? nextIdx : idx + 4000);
    assert(block.includes('identity_table'), `${nc} case 缺少 identity_table`);
  }

  // NIGHT_MAGICIAN 委托给 magicianModule.nightAction() → 在 magician.js 中检查
  assert(magicianSrc.includes('identity_table'), 'magician.js nightAction 缺少 identity_table');

  // NIGHT_DREAMWEAVER 委托给 dreamweaverModule.nightAction() → 在 dreamweaver.js 中检查
  assert(dreamweaverSrc.includes('identity_table'), 'dreamweaver.js nightAction 缺少 identity_table');
});

test('T25: SHERIFF_RUN case 输出 JSON 模板完整', () => {
  assert(sheriffRunBlock.includes('"run":true或false'), 'SHERIFF_RUN 应输出 run 字段');
  assert(sheriffRunBlock.includes('"reason"'), 'SHERIFF_RUN 应输出 reason 字段');
  assert(sheriffRunBlock.includes('"thought"'), 'SHERIFF_RUN 应输出 thought 字段');
});

console.log(`\n============================`);
console.log(`总计：${passed + failed} 项测试，通过 ${passed}，失败 ${failed}`);
console.log(`============================\n`);

if (failed > 0) process.exit(1);
