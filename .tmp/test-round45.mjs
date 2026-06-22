/**
 * Round 45 Test Suite: 骑士/摄梦人/魔术师 PK 专属框架
 * 验证三个特殊神职的 PK 辩护模式专属框架是否正确实现
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(__dirname, '../src/services/aiPrompts.js'), 'utf8');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ T${passed + failed + 1}: ${name}`);
    passed++;
  } catch (e) {
    console.error(`❌ T${passed + failed + 1}: ${name}`);
    console.error(`   ${e.message}`);
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

// ─── 定位 DAY_SPEECH case 中的 pkHint 块 ───────────────────────────────────
// 使用 lastIndexOf 定位真实的 generateUserPrompt 中的 DAY_SPEECH case（R22教训：避免 getCOTTemplate 假case）
const pkHintCommentIdx = src.lastIndexOf('// PK 辩护模式注入');
assert(pkHintCommentIdx > 0, 'Cannot locate pkHint block');
// 找到整个 pkHint 块，直到 SHERIFF_BADGE_PASS 之前
const sheriffHintIdx = src.indexOf('// 警长身份注入', pkHintCommentIdx);
assert(sheriffHintIdx > pkHintCommentIdx, 'Cannot locate sheriffHint block after pkHint');
const pkBlock = src.slice(pkHintCommentIdx, sheriffHintIdx);

// ─── T1-T3：注释更新 ─────────────────────────────────────────────────────
test('注释已更新包含骑士/摄梦人/魔术师', () => {
  assert(pkBlock.includes('骑士/摄梦人/魔术师'), 'Comment not updated');
});

// ─── T4-T10：骑士 PK 框架 ──────────────────────────────────────────────
const knightBranchIdx = pkBlock.indexOf("playerRole === '骑士'");
test('骑士 PK 专属分支存在', () => {
  assert(knightBranchIdx >= 0, "Missing '骑士' branch in pkHint block");
});

const knightBlock = pkBlock.slice(knightBranchIdx, pkBlock.indexOf("playerRole === '摄梦人'"));

test('骑士 PK 块有 knightPkLine 变量', () => {
  assert(knightBlock.includes('knightPkLine'), 'Missing knightPkLine variable');
});

test('骑士 PK 块检查 hasUsedDuel', () => {
  assert(knightBlock.includes('roleParams.hasUsedDuel'), 'Missing hasUsedDuel check');
});

test('骑士 PK 未决斗分支含隐性威慑语言', () => {
  assert(knightBlock.includes('隐性威慑'), 'Missing implicit deterrence language for pre-duel knight');
});

test('骑士 PK 已决斗分支含物理验证语言', () => {
  assert(knightBlock.includes('物理验证不可伪造'), 'Missing verification language for post-duel knight');
});

test('骑士 PK 未决斗分支不含"决斗"词（R30白熊效应：未揭示身份时禁用）', () => {
  // 找 knightPkLine 的 else 分支: 从 } else { 到下一行末尾
  const elseIdx = knightBlock.indexOf('} else {');
  // 只看 else 块内的赋值行（到第一个 ; 结束）
  const elseAssignEnd = knightBlock.indexOf("';", elseIdx);
  const elseBlock = knightBlock.slice(elseIdx, elseAssignEnd + 2);
  assert(!elseBlock.includes('决斗'), `Pre-duel knight PK should not contain "决斗" in hidden-identity path. Got: ${elseBlock.slice(0, 200)}`);
});

test('骑士 PK 已决斗分支合法使用"决斗"词', () => {
  const ifIdx = knightBlock.indexOf('if (roleParams.hasUsedDuel)');
  const nextElse = knightBlock.indexOf('} else {', ifIdx);
  const revealedBlock = knightBlock.slice(ifIdx, nextElse);
  assert(revealedBlock.includes('决斗'), 'Post-duel knight PK should contain "决斗" for revealed identity path');
});

// ─── T11-T18：摄梦人 PK 框架 ───────────────────────────────────────────
const dwBranchIdx = pkBlock.indexOf("playerRole === '摄梦人'");
test('摄梦人 PK 专属分支存在', () => {
  assert(dwBranchIdx >= 0, "Missing '摄梦人' branch in pkHint block");
});

const dwBlock = pkBlock.slice(dwBranchIdx, pkBlock.indexOf("playerRole === '魔术师'"));

test('摄梦人 PK 块检查 hasRevealed', () => {
  assert(dwBlock.includes('roleParams.hasRevealed'), 'Missing hasRevealed check in dreamweaver PK');
});

test('摄梦人 PK 块检查 activeDreamTarget', () => {
  assert(dwBlock.includes('activeDreamTarget'), 'Missing activeDreamTarget check');
});

test('摄梦人 PK 块获取 lastDreamTarget', () => {
  assert(dwBlock.includes('roleParams.lastDreamTarget'), 'Missing lastDreamTarget from roleParams');
});

test('摄梦人 PK 已揭示+有连接分支含同生共死关联语言', () => {
  assert(dwBlock.includes('同生共死关联'), 'Missing soul-link language for revealed dreamweaver with target');
});

test('摄梦人 PK 框架名称含摄梦人', () => {
  assert(dwBlock.includes('摄梦人专属框架'), 'Missing 摄梦人专属框架 section header');
});

test('摄梦人 PK 读取 dreamHistory（追加示例R19模式）', () => {
  assert(dwBlock.includes('roleParams.dreamHistory'), 'Missing dreamHistory access');
});

// R18检查：template字符串内的 activeDreamTarget 插值应通过 dtStr 中间变量实现
test('摄梦人 PK 通过 dtStr 中间变量插入 dream target（R18规范）', () => {
  assert(dwBlock.includes('const dtStr = String(activeDreamTarget)'), 'Missing dtStr intermediate variable (R18 pattern)');
});

// ─── T19-T26：魔术师 PK 框架 ──────────────────────────────────────────
const magBranchIdx = pkBlock.indexOf("playerRole === '魔术师'");
test('魔术师 PK 专属分支存在', () => {
  assert(magBranchIdx >= 0, "Missing '魔术师' branch in pkHint block");
});

// Find the end of the magician block: look for its pkHint assignment which starts with 魔术师专属框架
const magPkHintStart = pkBlock.indexOf('魔术师专属框架', magBranchIdx);
// The magician block extends from magBranchIdx to just past the closing backtick of its pkHint assignment
const magPkHintEnd = pkBlock.indexOf('归零`', magPkHintStart) + '归零`'.length;
const magBlock = pkBlock.slice(magBranchIdx, magPkHintEnd);

test('魔术师 PK 块检查 hasRevealed', () => {
  assert(magBlock.includes('roleParams.hasRevealed'), 'Missing hasRevealed check in magician PK');
});

test('魔术师 PK 块检查 hasSwapRecord', () => {
  assert(magBlock.includes('hasSwapRecord'), 'Missing hasSwapRecord check');
});

test('魔术师 PK 块读取 lastSwap', () => {
  assert(magBlock.includes('roleParams.lastSwap'), 'Missing lastSwap from roleParams');
});

test('魔术师 PK 已揭示+有交换分支含信息修正资产语言', () => {
  assert(magBlock.includes('信息修正资产'), 'Missing 信息修正资产 language for revealed magician with swap');
});

test('魔术师 PK 未揭示分支含隐秘存活价值语言', () => {
  assert(magBlock.includes('隐秘存活价值'), 'Missing hidden value language for unrevealed magician');
});

test('魔术师 PK 框架名称含魔术师', () => {
  assert(magBlock.includes('魔术师专属框架'), 'Missing 魔术师专属框架 section header');
});

// ─── T27-T30：通用 else 分支仍然存在 ──────────────────────────────────
const genericElseIdx = pkBlock.indexOf('} else {', pkBlock.indexOf("playerRole === '魔术师'"));
test('通用 else 分支仍然存在（村民/狼人 fallback）', () => {
  assert(genericElseIdx >= 0, 'Missing generic else branch');
});

const genericBlock = pkBlock.slice(genericElseIdx, pkBlock.indexOf('}', genericElseIdx + 10));
test('通用 else 分支含"提供新论点"', () => {
  assert(pkBlock.slice(genericElseIdx, genericElseIdx + 500).includes('提供新论点'), 'Generic branch missing "提供新论点"');
});

// ─── T31-T34：回归——旧有框架未被破坏 ──────────────────────────────────
test('预言家 PK 框架仍然存在', () => {
  assert(pkBlock.includes("playerRole === '预言家'"), 'Missing 预言家 PK branch (regression)');
  assert(pkBlock.includes('部署全部查验'), 'Missing 部署全部查验 in 预言家 PK (regression)');
});

test('守卫 PK 框架仍然存在', () => {
  assert(pkBlock.includes("playerRole === '守卫'"), 'Missing 守卫 PK branch (regression)');
  assert(pkBlock.includes('暴露守卫身份'), 'Missing 暴露守卫身份 in 守卫 PK (regression)');
});

test('女巫 PK 框架仍然存在', () => {
  assert(pkBlock.includes("playerRole === '女巫'"), 'Missing 女巫 PK branch (regression)');
  assert(pkBlock.includes('药水资产'), 'Missing 药水资产 in 女巫 PK (regression)');
});

test('猎人 PK 框架仍然存在', () => {
  assert(pkBlock.includes("playerRole === '猎人'"), 'Missing 猎人 PK branch (regression)');
  assert(pkBlock.includes('维度A'), 'Missing 维度A in 猎人 PK (regression)');
});

// ─── T35-T38：完整覆盖检查 ───────────────────────────────────────────
const allRolesInPk = ["playerRole === '预言家'", "playerRole === '守卫'",
                       "playerRole === '女巫'", "playerRole === '猎人'",
                       "playerRole === '骑士'", "playerRole === '摄梦人'",
                       "playerRole === '魔术师'"];
test('PK 框架覆盖全部 7 个特殊神职', () => {
  for (const role of allRolesInPk) {
    assert(pkBlock.includes(role), `Missing role: ${role}`);
  }
});

// 顺序检查：骑士 < 摄梦人 < 魔术师 (防止 if-else 顺序错误)
test('骑士/摄梦人/魔术师 分支顺序正确', () => {
  const knightPos = pkBlock.indexOf("playerRole === '骑士'");
  const dwPos = pkBlock.indexOf("playerRole === '摄梦人'");
  const magPos = pkBlock.indexOf("playerRole === '魔术师'");
  assert(knightPos < dwPos, '骑士分支应在摄梦人之前');
  assert(dwPos < magPos, '摄梦人分支应在魔术师之前');
});

// 检查新增的3个专属框架（R45本轮）均含"必须提供之前未说过的新论点"底线
// 注：R35-R36 的旧框架已在当时验证；预言家的要求通过 ${ccLine} 动态注入，源码层无法静态检查
test('R45新增3个专属框架均含"新论点"要求', () => {
  const newHeaders = ['骑士专属框架', '摄梦人专属框架', '魔术师专属框架'];
  for (const h of newHeaders) {
    const idx = pkBlock.indexOf(h);
    assert(idx >= 0, `Missing header: ${h}`);
    const window = pkBlock.slice(idx, idx + 400);
    const hasNewArg = window.includes('新论点') || window.includes('新论');
    assert(hasNewArg, `Framework '${h}' missing "新论点" requirement`);
  }
});

// R18 检查：pkBlock 中没有 ${roleParams.xxx} 这样的直接 roleParams 属性插值
// （应该先赋值给中间变量再用 ${中间变量}）
test('pkBlock 内无直接 ${roleParams.xxx} 插值（R18规范）', () => {
  // 只检查模板字符串内的 ${roleParams.，不检查普通代码行
  const templateStrings = pkBlock.match(/`[^`]*`/gs) || [];
  for (const ts of templateStrings) {
    assert(!ts.includes('${roleParams.'), `Template string contains direct roleParams interpolation: ${ts.slice(0, 100)}`);
  }
});

// ─── 汇总 ─────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`总计: ${passed + failed} 项 | ✅ ${passed} 通过 | ❌ ${failed} 失败`);
if (failed > 0) process.exit(1);
