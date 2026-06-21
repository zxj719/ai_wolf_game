/**
 * Round 35 测试：预言家/守卫 PK 专属 pkHint 框架
 * - 预言家 pkMode=true → 专属框架（部署查验 + 量化存活价值 + ccLine 分支）
 * - 守卫 pkMode=true → 专属框架（身份暴露决策 + 残局/非残局阈值）
 * - 非预言家/守卫 pkMode=true → 通用框架不变（回归验证）
 * - pkMode=false → 所有角色无 pkHint（回归）
 */

import { readFileSync } from 'fs';

const aiSrc = readFileSync(new URL('../src/services/aiPrompts.js', import.meta.url), 'utf-8');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`✅ ${name}`);
        passed++;
    } catch (e) {
        console.error(`❌ ${name}: ${e.message}`);
        failed++;
    }
}

function assert(condition, msg) {
    if (!condition) throw new Error(msg || 'assertion failed');
}

// ===========================================================
// 定位 pkHint 块（新的 let + if 结构）
// ===========================================================

// 新结构用 "let pkHint = '';" 定位
const pkHintLetIdx = aiSrc.indexOf("let pkHint = '';");
const pkHintBlockStart = aiSrc.indexOf('if (roleParams.pkMode) {', pkHintLetIdx);

// 预言家分支
const seerPkIdx = aiSrc.indexOf("if (playerRole === '预言家') {", pkHintBlockStart);

// 守卫分支
const guardPkIdx = aiSrc.indexOf("} else if (playerRole === '守卫') {", pkHintBlockStart);

// 通用分支（else）
const genericPkIdx = aiSrc.indexOf('} else {\n                    pkHint = `\\n\\n【⚔️ PK 辩护模式', pkHintBlockStart);

// ===========================================================
// T1-T3: 基本结构检查
// ===========================================================

test('T1: pkHint 改为 let + if 结构（不再是三元 const）', () => {
    assert(pkHintLetIdx !== -1, '找不到 "let pkHint = \'\';"');
    assert(pkHintBlockStart !== -1, '找不到 if (roleParams.pkMode) {');
    assert(!aiSrc.slice(pkHintLetIdx - 10, pkHintLetIdx).includes('const'), 'pkHint 不应再使用 const 定义');
});

test('T2: pkHint 仍被追加到 return 语句（回归）', () => {
    const retIdx = aiSrc.indexOf('return rolePromptGenerator(ctx, roleParams) + pkHint');
    assert(retIdx !== -1, 'return 语句应包含 pkHint');
    const retLine = aiSrc.slice(retIdx, retIdx + 100);
    assert(retLine.includes('sheriffHint'), 'pkHint 应在 sheriffHint 之前');
});

test('T3: 预言家分支存在', () => {
    assert(seerPkIdx !== -1, `找不到预言家 pkHint 分支，pkHintBlockStart=${pkHintBlockStart}`);
});

// ===========================================================
// T4-T8: 预言家专属框架内容
// ===========================================================

test('T4: 预言家 pkHint 含"预言家专属框架"标题', () => {
    const block = aiSrc.slice(seerPkIdx, seerPkIdx + 600);
    assert(block.includes('预言家专属框架'), `预言家分支应含"预言家专属框架"，实际前300字: ${block.slice(0, 300)}`);
});

test('T5: 预言家 pkHint 含"部署全部查验"', () => {
    const block = aiSrc.slice(seerPkIdx, seerPkIdx + 600);
    assert(block.includes('部署全部查验'), '预言家分支应含"部署全部查验"');
});

test('T6: 预言家 pkHint 含"量化存活价值"', () => {
    const block = aiSrc.slice(seerPkIdx, seerPkIdx + 600);
    assert(block.includes('量化存活价值'), '预言家分支应含"量化存活价值"');
});

test('T7: 预言家 pkHint 中 ccLine 有两条分支（有/无对跳）', () => {
    const block = aiSrc.slice(seerPkIdx, seerPkIdx + 600);
    // 有对跳分支：Step A/B/C
    assert(block.includes('Step A'), '应有 Step A（对跳分支）');
    assert(block.includes('Step B'), '应有 Step B（对跳分支）');
    assert(block.includes('Step C'), '应有 Step C（对跳分支）');
    // 无对跳分支：提供新论点
    assert(block.includes('提供新论点'), '应有"提供新论点"（无对跳分支）');
});

test('T8: 预言家 pkHint 中 ccLine 使用 hasCC 变量（非内联三元）', () => {
    const block = aiSrc.slice(seerPkIdx, seerPkIdx + 400);
    assert(block.includes('hasCC'), '应定义 hasCC 变量');
    assert(block.includes('const ccLine'), '应定义 ccLine 变量');
    // 确认 pkHint 模板字符串里使用 ${ccLine} 而不是内联三元
    const pkHintTemplate = aiSrc.slice(seerPkIdx, seerPkIdx + 600);
    assert(pkHintTemplate.includes('${ccLine}'), '模板字符串应通过 ${ccLine} 注入');
});

// ===========================================================
// T9-T14: 守卫专属框架内容
// ===========================================================

test('T9: 守卫分支存在', () => {
    assert(guardPkIdx !== -1, `找不到守卫 pkHint 分支，pkHintBlockStart=${pkHintBlockStart}`);
});

test('T10: 守卫 pkHint 含"守卫专属框架"标题', () => {
    const block = aiSrc.slice(guardPkIdx, guardPkIdx + 700);
    assert(block.includes('守卫专属框架'), '守卫分支应含"守卫专属框架"');
});

test('T11: 守卫 pkHint 含"核心权衡"（身份暴露决策框架）', () => {
    const block = aiSrc.slice(guardPkIdx, guardPkIdx + 700);
    assert(block.includes('核心权衡'), '应含"核心权衡"');
});

test('T12: 守卫 pkHint 使用 phaseLabel 变量（非内联三元）', () => {
    const block = aiSrc.slice(guardPkIdx, guardPkIdx + 500);
    assert(block.includes('const phaseLabel'), '应定义 phaseLabel 变量');
    assert(block.includes('aliveNow <= 5'), '应有残局阈值检查');
});

test('T13: 守卫 phaseLabel 含"残局"分支', () => {
    const block = aiSrc.slice(guardPkIdx, guardPkIdx + 600);
    assert(block.includes('残局'), '"残局"文本应在守卫分支中');
    assert(block.includes('非残局'), '"非残局"文本应在守卫分支中');
});

test('T14: 守卫 pkHint 含"若暴露身份"和"若保持隐秘"两条路', () => {
    const block = aiSrc.slice(guardPkIdx, guardPkIdx + 700);
    assert(block.includes('若暴露身份'), '应含"若暴露身份"路径');
    assert(block.includes('若保持隐秘'), '应含"若保持隐秘"路径');
});

// ===========================================================
// T15-T18: 通用框架（非预言家/守卫）保持不变
// ===========================================================

test('T15: 通用 else 分支存在', () => {
    assert(genericPkIdx !== -1, '找不到通用 else 分支（pkHint 回退到通用框架）');
});

test('T16: 通用框架含原有"提供新论点"文本（回归）', () => {
    const block = aiSrc.slice(genericPkIdx, genericPkIdx + 400);
    assert(block.includes('提供新论点'), '通用框架应含"提供新论点"');
});

test('T17: 通用框架含"直接回应或质疑对方"（回归）', () => {
    const block = aiSrc.slice(genericPkIdx, genericPkIdx + 400);
    assert(block.includes('直接回应或质疑对方'), '通用框架应含"直接回应或质疑对方"');
});

test('T18: 通用框架含"明确陈述你存活的价值"（回归）', () => {
    const block = aiSrc.slice(genericPkIdx, genericPkIdx + 400);
    assert(block.includes('明确陈述你存活的价值'), '通用框架应含"明确陈述你存活的价值"');
});

// ===========================================================
// T19-T21: R18 防范——模板字符串内无内联变量插值的布尔表达式
// ===========================================================

test('T19: 预言家 pkHint 模板字符串内无 ${hasCC 插值（已提取为 ccLine）', () => {
    // 在预言家的 pkHint = `...` 模板字符串区域内，不应有 ${hasCC
    const seerBlock = aiSrc.slice(seerPkIdx, seerPkIdx + 600);
    // 查找 pkHint = ` 之后的模板区域
    const tplStart = seerBlock.indexOf('pkHint = `');
    if (tplStart !== -1) {
        const tplContent = seerBlock.slice(tplStart, tplStart + 400);
        assert(!tplContent.includes('${hasCC'), '模板字符串内不应有 ${hasCC 插值');
    } else {
        assert(false, '找不到预言家 pkHint = ` 模板起点');
    }
});

test('T20: 守卫 pkHint 模板字符串内无内联三元插值（${aliveNow <= 5 ? ...}）', () => {
    const guardBlock = aiSrc.slice(guardPkIdx, guardPkIdx + 700);
    const tplStart = guardBlock.indexOf('pkHint = `');
    if (tplStart !== -1) {
        const tplContent = guardBlock.slice(tplStart, tplStart + 500);
        // 不应有 `${aliveNow <= 5` 这样的三元插值
        assert(!tplContent.includes('${aliveNow <= 5'), '模板字符串内不应有 ${aliveNow <= 5 三元插值');
        // 但应有 ${phaseLabel} 和 ${aliveNow}（简单变量）
        assert(tplContent.includes('${phaseLabel}'), '模板字符串应通过 ${phaseLabel} 注入阶段说明');
        assert(tplContent.includes('${aliveNow}'), '模板字符串应通过 ${aliveNow} 注入人数');
    } else {
        assert(false, '找不到守卫 pkHint = ` 模板起点');
    }
});

test('T21: pkHint 整体块在 return 语句之前（顺序正确）', () => {
    const retIdx = aiSrc.indexOf('return rolePromptGenerator(ctx, roleParams) + pkHint');
    assert(pkHintLetIdx < retIdx, `pkHint let 定义(${pkHintLetIdx}) 应在 return(${retIdx}) 之前`);
    assert(pkHintBlockStart < retIdx, `pkHint if 块(${pkHintBlockStart}) 应在 return(${retIdx}) 之前`);
});

// ===========================================================
// T22-T25: 逻辑模拟验证（阈值和分支条件）
// ===========================================================

test('T22: 守卫残局阈值为 5（aliveNow <= 5）', () => {
    const guardBlock = aiSrc.slice(guardPkIdx, guardPkIdx + 300);
    assert(guardBlock.includes('aliveNow <= 5'), '残局阈值应为 aliveNow <= 5');
});

test('T23: 守卫 aliveNow 默认值为 8（aliveCount || 8）', () => {
    const guardBlock = aiSrc.slice(guardPkIdx, guardPkIdx + 200);
    assert(guardBlock.includes('roleParams.aliveCount || 8'), 'aliveCount 默认值应为 8');
});

test('T24: 预言家 hasCC 基于 counterClaimants 数组长度', () => {
    const seerBlock = aiSrc.slice(seerPkIdx, seerPkIdx + 200);
    assert(seerBlock.includes('roleParams.counterClaimants'), '应读取 roleParams.counterClaimants');
    assert(seerBlock.includes('.length > 0'), '应检查 length > 0');
});

test('T25: 狼人 pkMode 覆盖块独立于 pkHint 块（互不干扰）', () => {
    // 狼人 wolfTeammatesHint 的 pkMode 覆盖在 ROLE_DAY_SPEECH_PROMPTS['狼人'] 内
    const wolfPkIdx = aiSrc.indexOf('// PK 模式覆盖：PK 发言目标是自保');
    assert(wolfPkIdx !== -1, '找不到狼人 pkMode 覆盖注释');
    // 应早于 pkHintLetIdx（狼人的 wolfTeammatesHint 覆盖在角色函数内，pkHint 在 generateUserPrompt case 里）
    assert(wolfPkIdx < pkHintLetIdx, `狼人覆盖(${wolfPkIdx}) 应早于全局 pkHint 定义(${pkHintLetIdx})`);
});

// ===========================================================
// 结果汇总
// ===========================================================
console.log('\n─────────────────────────────────────');
console.log(`总计: ${passed + failed} 项 | ✅ ${passed} 通过 | ❌ ${failed} 失败`);
if (failed > 0) process.exit(1);
