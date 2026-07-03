/**
 * Round 109: 魔术师 NIGHT 平安夜交换价值评估框架（单夜→两连→三连）
 * Prepend Injection 第 24 次
 *
 * T1-T2   isNightPeacefulMagician 声明
 * T3-T4   isConsecutivePeacefulNightMagician 声明
 * T5-T7   if 块内声明（isTriple + tripleHint + consecutiveHint 顺序）
 * T8-T10  三连/两连/单夜内容（⭕标记 + 路径A/B/C + confidence 梯度）
 * T11     注入结构（return 模板 prepend injection）
 * T12-T13 aiPrompts.js NIGHT_MAGICIAN 传入 lastNightInfo / fullGameTimeline
 * T14     白熊效应合规（第 30 次验证）
 * T15-T16 生成门控（非平安夜 / D1首夜）
 * T17-T19 生成门控（D2单夜 / D3两连 / D4三连）
 * T20     lastNightInfo + fullGameTimeline 在函数签名中声明
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const magicianSrc = readFileSync(
    join(process.cwd(), 'src/services/rolePrompts/magician.js'),
    'utf8'
);
const promptsSrc = readFileSync(
    join(process.cwd(), 'src/services/aiPrompts.js'),
    'utf8'
);

// getMagicianNightActionPrompt 函数体切片（R109 新增后 8275 chars，窗口 9000）
function getMagicianNightFnBlock() {
    const start = magicianSrc.indexOf('export const getMagicianNightActionPrompt');
    if (start === -1) throw new Error('getMagicianNightActionPrompt 未找到');
    return magicianSrc.slice(start, start + 9000);
}

// NIGHT_MAGICIAN case 切片（aiPrompts.js）
function getNightMagicianBlock() {
    const start = promptsSrc.indexOf('case PROMPT_ACTIONS.NIGHT_MAGICIAN:');
    const end = promptsSrc.indexOf('case PROMPT_ACTIONS.NIGHT_WOLF: {', start);
    if (start === -1 || end === -1) throw new Error('NIGHT_MAGICIAN case 未找到');
    return promptsSrc.slice(start, end);
}

// if 块内容切片（isConsecutivePeacefulNightMagician 之后）
function getIfBlock() {
    const fn = getMagicianNightFnBlock();
    const ifStart = fn.indexOf('if (isConsecutivePeacefulNightMagician)');
    if (ifStart === -1) throw new Error('if 块未找到');
    return fn.slice(ifStart, ifStart + 2000);
}

// ═══════════════════════════════════════════════════════
// T1-T2: isNightPeacefulMagician 声明
// ═══════════════════════════════════════════════════════

test('T1: isNightPeacefulMagician 变量声明存在', () => {
    const block = getMagicianNightFnBlock();
    expect(block).toContain('const isNightPeacefulMagician');
});

test('T2: isNightPeacefulMagician 条件（dayCount > 1 + includes 平安夜）', () => {
    const block = getMagicianNightFnBlock();
    const idx = block.indexOf('const isNightPeacefulMagician');
    const lineCtx = block.slice(idx, idx + 120);
    expect(lineCtx).toContain('dayCount > 1');
    expect(lineCtx).toContain("lastNightInfo?.includes('平安夜')");
});

// ═══════════════════════════════════════════════════════
// T3-T4: isConsecutivePeacefulNightMagician 声明
// ═══════════════════════════════════════════════════════

test('T3: isConsecutivePeacefulNightMagician 变量声明存在', () => {
    const block = getMagicianNightFnBlock();
    expect(block).toContain('const isConsecutivePeacefulNightMagician');
});

test('T4: isConsecutivePeacefulNightMagician 条件（dayCount >= 3 + fullGameTimeline）', () => {
    const block = getMagicianNightFnBlock();
    const idx = block.indexOf('const isConsecutivePeacefulNightMagician');
    const lineCtx = block.slice(idx, idx + 200);
    expect(lineCtx).toContain('dayCount >= 3');
    expect(lineCtx).toContain('isNightPeacefulMagician');
    expect(lineCtx).toContain('fullGameTimeline?.includes');
});

// ═══════════════════════════════════════════════════════
// T5-T7: if 块内声明顺序
// ═══════════════════════════════════════════════════════

test('T5: isTripleConsecutivePeacefulNightMagician 声明（dayCount >= 4 + isConsecutive）', () => {
    const block = getMagicianNightFnBlock();
    expect(block).toContain('const isTripleConsecutivePeacefulNightMagician');
    const idx = block.indexOf('const isTripleConsecutivePeacefulNightMagician');
    const lineCtx = block.slice(idx, idx + 180);
    expect(lineCtx).toContain('dayCount >= 4');
    expect(lineCtx).toContain('isConsecutivePeacefulNightMagician');
});

test('T6: if 块内 tripleConsecutivePeaceNightHintMag 声明存在且用三元表达式', () => {
    const ifBlock = getIfBlock();
    expect(ifBlock).toContain('tripleConsecutivePeaceNightHintMag');
    const idx = ifBlock.indexOf('tripleConsecutivePeaceNightHintMag = isTripleConsecutivePeacefulNightMagician');
    expect(idx).toBeGreaterThan(-1);
});

test('T7: if 块内 consecutivePeaceNightHintMag 引用 tripleConsecutivePeaceNightHintMag（超集前置）', () => {
    const ifBlock = getIfBlock();
    const tripleIdx = ifBlock.indexOf('tripleConsecutivePeaceNightHintMag');
    const consIdx = ifBlock.indexOf('consecutivePeaceNightHintMag');
    expect(tripleIdx).toBeGreaterThan(-1);
    expect(consIdx).toBeGreaterThan(tripleIdx);
    // consecutivePeaceNightHintMag 引用 tripleConsecutivePeaceNightHintMag（前置拼接）
    const consLine = ifBlock.slice(consIdx, consIdx + 200);
    expect(consLine).toContain('${tripleConsecutivePeaceNightHintMag}');
});

// ═══════════════════════════════════════════════════════
// T8-T10: 三连/两连/单夜内容
// ═══════════════════════════════════════════════════════

test('T8: 三连内容——⭕三连平安夜三阶 + 路径A/B/C + confidence 升 35-45', () => {
    const block = getMagicianNightFnBlock();
    expect(block).toContain('三连平安夜三阶交换价值评估');
    expect(block).toContain('路径A');
    expect(block).toContain('路径B');
    expect(block).toContain('路径C');
    expect(block).toContain('confidence 升 35-45');
});

test('T9: 两连内容——⭕两连平安夜二阶 + 路径A/B + confidence 升 25-35', () => {
    const block = getMagicianNightFnBlock();
    expect(block).toContain('两连平安夜二阶交换价值评估');
    expect(block).toContain('confidence 升 25-35');
    expect(block).toContain('confidence 升 20-30');
});

test('T10: 单夜内容——⭕魔术师平安夜 + 有换/未换两分支 + confidence 升 15-20', () => {
    const block = getMagicianNightFnBlock();
    expect(block).toContain('魔术师平安夜交换价值评估');
    expect(block).toContain('confidence 升 15-20');
    expect(block).toContain('confidence 升 10-15');
    expect(block).toContain('来源推断');
});

// ═══════════════════════════════════════════════════════
// T11: 注入结构（prepend injection）
// ═══════════════════════════════════════════════════════

test('T11: 注入结构——magicianNightPeaceStep 在 magicianHistoryStep 之后、magicianNightStyle 之前注入', () => {
    const block = getMagicianNightFnBlock();
    const histIdx = block.indexOf('${magicianHistoryStep}');
    const peaceIdx = block.indexOf('${magicianNightPeaceStep}');
    const styleIdx = block.indexOf('${magicianNightStyle}');
    const step1Idx = block.indexOf('Step 1: 当前局势分析');
    expect(histIdx).toBeGreaterThan(0);
    expect(peaceIdx).toBeGreaterThan(histIdx);
    expect(styleIdx).toBeGreaterThan(peaceIdx);
    expect(step1Idx).toBeGreaterThan(styleIdx);
});

// ═══════════════════════════════════════════════════════
// T12-T13: aiPrompts.js NIGHT_MAGICIAN 传入新参数
// ═══════════════════════════════════════════════════════

test('T12: aiPrompts.js NIGHT_MAGICIAN 传入 lastNightInfo（ctx.lastNightInfo）', () => {
    const block = getNightMagicianBlock();
    expect(block).toContain('lastNightInfo: ctx.lastNightInfo');
});

test('T13: aiPrompts.js NIGHT_MAGICIAN 传入 fullGameTimeline（ctx.fullGameTimeline）', () => {
    const block = getNightMagicianBlock();
    expect(block).toContain('fullGameTimeline: ctx.fullGameTimeline');
});

// ═══════════════════════════════════════════════════════
// T14: 白熊效应合规（第 30 次验证）
// ═══════════════════════════════════════════════════════

test('T14: 白熊效应合规——推断区段无负向禁词（不要/禁止/不能/绝不）', () => {
    const block = getMagicianNightFnBlock();
    const peaceStart = block.indexOf('// R109: NIGHT_MAGICIAN 平安夜交换价值评估框架');
    const peaceEnd = block.indexOf('// R78: NIGHT_MAGICIAN 换刀决策风格个性化', peaceStart);
    const peaceSection = block.slice(peaceStart, peaceEnd);
    expect(peaceSection).not.toContain('不要');
    expect(peaceSection).not.toContain('禁止');
    expect(peaceSection).not.toContain('不能');
    expect(peaceSection).not.toContain('绝不');
    // 验证正向描述存在
    expect(peaceSection).toContain('confidence 升');
    expect(peaceSection).toContain('建议');
});

// ═══════════════════════════════════════════════════════
// T15-T16: 生成门控（非平安夜 / D1首夜）
// ═══════════════════════════════════════════════════════

function makeParams(dayCount, lastNightInfo, fullGameTimeline, lastSwap) {
    const magicianSrcFull = readFileSync(
        join(process.cwd(), 'src/services/rolePrompts/magician.js'),
        'utf8'
    );
    // 动态调用 getMagicianNightActionPrompt
    const fn = new Function(
        'params',
        magicianSrcFull
            .replace(/^import.*$/gm, '')
            .replace(/^export /gm, '')
            + '\nreturn getMagicianNightActionPrompt(params);'
    );
    return fn({
        validTargets: [2, 3, 4, 5],
        swappedPlayers: [],
        lastSwap: lastSwap || { player1Id: null, player2Id: null },
        existingRoles: { hasSeer: true, hasWitch: true, hasGuard: true, hasHunter: true },
        dayCount,
        nightContext: '',
        knownGods: [],
        suspectedWolves: [],
        hasRevealed: false,
        personalityType: '',
        lastNightInfo: lastNightInfo || '',
        fullGameTimeline: fullGameTimeline || '',
    });
}

test('T15: 非平安夜时 magicianNightPeaceStep 为空（无⭕魔术师平安夜）', () => {
    const result = makeParams(2, '3号死亡，身份为村民');
    expect(result).not.toContain('魔术师平安夜交换价值评估');
});

test('T16: D1首夜时 magicianNightPeaceStep 为空（dayCount=1不满足条件）', () => {
    const result = makeParams(1, '平安夜');
    expect(result).not.toContain('魔术师平安夜交换价值评估');
});

// ═══════════════════════════════════════════════════════
// T17-T19: 生成门控（单夜/两连/三连）
// ═══════════════════════════════════════════════════════

test('T17: D2 单夜平安夜——生成单层推断（含 ⭕魔术师平安夜，不含两连/三连）', () => {
    const result = makeParams(2, '平安夜', 'N1:平安夜');
    expect(result).toContain('魔术师平安夜交换价值评估');
    expect(result).not.toContain('两连平安夜二阶交换价值评估');
    expect(result).not.toContain('三连平安夜三阶交换价值评估');
});

test('T18: D3 两连平安夜——生成两层推断（含单夜 + 两连，不含三连）', () => {
    const result = makeParams(3, '平安夜', 'N1:平安夜 N2:平安夜');
    expect(result).toContain('魔术师平安夜交换价值评估');
    expect(result).toContain('两连平安夜二阶交换价值评估');
    expect(result).not.toContain('三连平安夜三阶交换价值评估');
});

test('T19: D4 三连平安夜——生成三层推断（含单夜 + 两连 + 三连）', () => {
    const result = makeParams(4, '平安夜', 'N1:平安夜 N2:平安夜 N3:平安夜');
    expect(result).toContain('魔术师平安夜交换价值评估');
    expect(result).toContain('两连平安夜二阶交换价值评估');
    expect(result).toContain('三连平安夜三阶交换价值评估');
});

// ═══════════════════════════════════════════════════════
// T20: lastNightInfo + fullGameTimeline 在函数签名中声明
// ═══════════════════════════════════════════════════════

test('T20: getMagicianNightActionPrompt params 解构中声明 lastNightInfo 和 fullGameTimeline', () => {
    const block = getMagicianNightFnBlock();
    expect(block).toContain('lastNightInfo,');
    expect(block).toContain('fullGameTimeline,');
    // 确认在 params 解构块内（在 return 之前）
    const paramsEnd = block.indexOf('} = params;');
    const lastNightIdx = block.indexOf('lastNightInfo,');
    const fullTimelineIdx = block.indexOf('fullGameTimeline,');
    expect(lastNightIdx).toBeLessThan(paramsEnd);
    expect(fullTimelineIdx).toBeLessThan(paramsEnd);
});
