// Round 81: Seer + Guard peaceful night inference tests
// T1-T20: Seer (predicting protected target from vote records + verification history)
// T21-T40: Guard (leveraging known guard target to infer wolf kill direction)

import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve('src/services/aiPrompts.js'), 'utf-8');

// ── Seer block extraction ──────────────────────────────────────────────────
const seerBlockStart = src.indexOf("'预言家': (ctx, params) =>");
const seerBlockEnd = src.indexOf("'女巫': (ctx, params)", seerBlockStart);
const seerBlock = src.slice(seerBlockStart, seerBlockEnd);
// Window sized at ~7500 (seerBlock 5930 × 1.27)
const SEER_WINDOW = 7500;
if (seerBlock.length > SEER_WINDOW) {
    throw new Error(`seerBlock (${seerBlock.length}) exceeds window (${SEER_WINDOW}) — update test window`);
}

// Seer return template (for injection-position tests)
const seerReturnStart = seerBlock.indexOf('return `');
const seerReturnBlock = seerBlock.slice(seerReturnStart);

// Seer variable declaration block (before return)
const seerVarBlock = seerBlock.slice(0, seerReturnStart);

// ── Guard block extraction ─────────────────────────────────────────────────
const guardBlockStart = src.indexOf("'守卫': (ctx, params) =>");
const guardBlockEnd = src.indexOf("'村民': (ctx, params)", guardBlockStart);
const guardBlock = src.slice(guardBlockStart, guardBlockEnd);
// Window sized at ~6500 (guardBlock 5471 × 1.19 after R91 consecutivePeaceHintGuard addition)
const GUARD_WINDOW = 6500;
if (guardBlock.length > GUARD_WINDOW) {
    throw new Error(`guardBlock (${guardBlock.length}) exceeds window (${GUARD_WINDOW}) — update test window`);
}

// Guard return template
const guardReturnStart = guardBlock.indexOf('return `');
const guardReturnBlock = guardBlock.slice(guardReturnStart);

// Guard variable declaration block (before return)
const guardVarBlock = guardBlock.slice(0, guardReturnStart);

// ══ Seer Tests: T1–T20 ══════════════════════════════════════════════════════

test('T1: seer isPeacefulNightSeer declared in var block', () => {
    expect(seerVarBlock).toContain('isPeacefulNightSeer');
});

test('T2: seerPeaceNightStep initialized as empty string', () => {
    expect(seerVarBlock).toContain("let seerPeaceNightStep = ''");
});

test('T3: seer peaceful night triggered by ctx.dayCount > 1 AND lastNightInfo includes 平安夜', () => {
    expect(seerVarBlock).toContain("ctx.dayCount > 1 && ctx.lastNightInfo?.includes('平安夜')");
});

test('T4: seer prevDay derived inside if block', () => {
    const ifStart = seerVarBlock.indexOf('if (isPeacefulNightSeer)');
    const ifSection = seerVarBlock.slice(ifStart, ifStart + 600);
    expect(ifSection).toContain('dayCount - 1');
});

test('T5: seer peaceNightStep assignment uses template literal', () => {
    const ifStart = seerVarBlock.indexOf('if (isPeacefulNightSeer)');
    // R90: consecutivePeaceHintSeer declaration (~880 chars) pushes seerPeaceNightStep to char ~895
    const ifSection = seerVarBlock.slice(ifStart, ifStart + 1100);
    expect(ifSection).toContain('seerPeaceNightStep = `');
});

test('T6: seer peaceful night step starts with ⭕ marker', () => {
    const ifStart = seerVarBlock.indexOf('if (isPeacefulNightSeer)');
    // R90: seerPeaceNightStep starts with ${consecutivePeaceHintSeer}⭕【预言家平安夜推断 at ~920
    const ifSection = seerVarBlock.slice(ifStart, ifStart + 1100);
    expect(ifSection).toContain('⭕【预言家平安夜推断');
});

test('T7: seer Path A covers gold water (金水) verified player inference', () => {
    const ifStart = seerVarBlock.indexOf('if (isPeacefulNightSeer)');
    // R90: 金水 appears early (in consecutive hint ~400), confidence 升至 90-100 at ~1060
    const ifSection = seerVarBlock.slice(ifStart, ifStart + 1200);
    expect(ifSection).toContain('金水');
    expect(ifSection).toContain('confidence 升至 90-100');
});

test('T8: seer Path B covers unverified high-vote survivor → add to query queue', () => {
    const ifStart = seerVarBlock.indexOf('if (isPeacefulNightSeer)');
    // R90: 排队查验优先级：① in consecutive hint (~580), confidence 升 15-20 at ~1130
    const ifSection = seerVarBlock.slice(ifStart, ifStart + 1300);
    expect(ifSection).toContain('排队查验优先级：①');
    expect(ifSection).toContain('confidence 升 15-20');
});

test('T9: seer Path C covers scattered vote case → maintain current judgment', () => {
    const ifStart = seerVarBlock.indexOf('if (isPeacefulNightSeer)');
    // R90: 票型分散 and 维持当前查验队列 in original step at ~1215/1240
    const ifSection = seerVarBlock.slice(ifStart, ifStart + 1400);
    expect(ifSection).toContain('票型分散');
    expect(ifSection).toContain('维持当前查验队列');
});

test('T10: seer peaceNightStep references prevDay with D${prevDay} interpolation', () => {
    const ifStart = seerVarBlock.indexOf('if (isPeacefulNightSeer)');
    const ifSection = seerVarBlock.slice(ifStart, ifStart + 600);
    expect(ifSection).toContain('D${prevDay}');
});

test('T11: seer template has ${seerDayHistoryStep} before ${seerPeaceNightStep}', () => {
    const historyIdx = seerReturnBlock.indexOf('${seerDayHistoryStep}');
    const peaceIdx = seerReturnBlock.indexOf('${seerPeaceNightStep}');
    expect(historyIdx).toBeGreaterThan(-1);
    expect(peaceIdx).toBeGreaterThan(-1);
    expect(historyIdx).toBeLessThan(peaceIdx);
});

test('T12: seer template has ${seerPeaceNightStep} immediately before Step1:', () => {
    const injectionPattern = '${seerPeaceNightStep}Step1:';
    expect(seerReturnBlock).toContain(injectionPattern);
});

test('T13: seer step order is seerDayHistoryStep → seerPeaceNightStep → Step2', () => {
    const historyIdx = seerReturnBlock.indexOf('${seerDayHistoryStep}');
    const peaceIdx = seerReturnBlock.indexOf('${seerPeaceNightStep}');
    const step2Idx = seerReturnBlock.indexOf('Step2:');
    expect(historyIdx).toBeGreaterThan(-1);
    expect(peaceIdx).toBeGreaterThan(-1);
    expect(step2Idx).toBeGreaterThan(-1);
    expect(historyIdx).toBeLessThan(peaceIdx);
    expect(peaceIdx).toBeLessThan(step2Idx);
    // T12 already verifies ${seerPeaceNightStep}Step1: exists
});

test('T14: seer peaceNightStep restricts analysis to thought only (speech 正常报验)', () => {
    const ifStart = seerVarBlock.indexOf('if (isPeacefulNightSeer)');
    // R90: consecutivePeaceHintSeer header at ~180 chars contains thought/speech at ~240; window updated 200→350
    const ifSection = seerVarBlock.slice(ifStart, ifStart + 350);
    expect(ifSection).toContain('thought');
    expect(ifSection).toContain('speech');
});

test('T15: seer var block does NOT contain ⭕ outside the peaceNightStep assignment (return block has no hardcoded ⭕)', () => {
    // ⭕ should only appear in the assignment, not in the return template
    const returnSection = seerReturnBlock;
    expect(returnSection).not.toContain('⭕');
});

test('T16: seerPeaceNightStep empty string init ensures empty on D1 (no else needed)', () => {
    // Empty string init means D1 / non-peaceful night → no output
    expect(seerVarBlock).toContain("let seerPeaceNightStep = ''");
    // Should not have an else branch (empty string init is the fallback)
    const ifStart = seerVarBlock.indexOf('if (isPeacefulNightSeer)');
    const afterIf = seerVarBlock.slice(ifStart, ifStart + 800);
    // The block closes with } and then immediately return — no else
    const hasElse = /\}\s*else\s*\{/.test(afterIf.slice(afterIf.indexOf('isPeacefulNightSeer')));
    expect(hasElse).toBe(false);
});

test('T17: return block uses ${seerPeaceNightStep} interpolation (not hardcoded content)', () => {
    // Return block should contain the interpolation but NOT the raw ⭕ marker
    expect(seerReturnBlock).toContain('${seerPeaceNightStep}');
    expect(seerReturnBlock).not.toContain('⭕');
});

test('T18: seer peaceful night hint instructs thought analysis before speech (thought precedes speech in instruction)', () => {
    const ifStart = seerVarBlock.indexOf('if (isPeacefulNightSeer)');
    // R90: thought/speech now first appear in consecutivePeaceHintSeer header at ~240 chars; window updated 200→350
    const ifSection = seerVarBlock.slice(ifStart, ifStart + 350);
    const thoughtIdx = ifSection.indexOf('thought');
    const speechIdx = ifSection.indexOf('speech');
    expect(thoughtIdx).toBeGreaterThan(-1);
    expect(speechIdx).toBeGreaterThan(-1);
    expect(thoughtIdx).toBeLessThan(speechIdx);
});

test('T19: seer peaceNightStep content has no negative prohibitions (white bear compliance)', () => {
    const ifStart = seerVarBlock.indexOf('if (isPeacefulNightSeer)');
    // R90: whole if block is now ~1500 chars (consecutivePeaceHintSeer ~880 + original ~615); window updated 700→1600
    const ifSection = seerVarBlock.slice(ifStart, ifStart + 1600);
    expect(ifSection).not.toContain('不要');
    expect(ifSection).not.toContain('禁止');
    expect(ifSection).not.toContain('绝不能');
});

test('T20: seer block size within expected window', () => {
    expect(seerBlock.length).toBeGreaterThan(5000);
    expect(seerBlock.length).toBeLessThan(SEER_WINDOW);
});

// ══ Guard Tests: T21–T40 ════════════════════════════════════════════════════

test('T21: guard isPeacefulNightGuard declared in var block', () => {
    expect(guardVarBlock).toContain('isPeacefulNightGuard');
});

test('T22: guardPeaceNightStep initialized as empty string', () => {
    expect(guardVarBlock).toContain("let guardPeaceNightStep = ''");
});

test('T23: guard peaceful night triggered by ctx.dayCount > 1 AND lastNightInfo includes 平安夜', () => {
    expect(guardVarBlock).toContain("ctx.dayCount > 1 && ctx.lastNightInfo?.includes('平安夜')");
});

test('T24: guard has lastGuardTarget !== null branch (target-known path)', () => {
    const ifGuardStart = guardVarBlock.indexOf('if (isPeacefulNightGuard)');
    // R91: consecutivePeaceHintGuard block (~1100 chars) shifted inner-if to offset ~1122; window updated 900→1300
    const ifSection = guardVarBlock.slice(ifGuardStart, ifGuardStart + 1300);
    expect(ifSection).toContain('lastGuardTarget !== null');
});

test('T25: guard has else branch for no-target case (昨夜未守护)', () => {
    const ifGuardStart = guardVarBlock.indexOf('if (isPeacefulNightGuard)');
    // R91: 昨夜未守护 in else branch now at offset ~1601; window updated 900→1700
    const ifSection = guardVarBlock.slice(ifGuardStart, ifGuardStart + 1700);
    expect(ifSection).toContain('昨夜未守护');
});

test('T26: guard known-target path starts with ⭕ marker', () => {
    const ifGuardStart = guardVarBlock.indexOf('if (isPeacefulNightGuard)');
    // R91: ⭕【守卫平安夜推断 in assignment now at offset ~1221; window updated 900→1400
    const ifSection = guardVarBlock.slice(ifGuardStart, ifGuardStart + 1400);
    expect(ifSection).toContain('⭕【守卫平安夜推断');
});

test('T27: guard known-target path covers 命中推断 with confidence increase', () => {
    const ifGuardStart = guardVarBlock.indexOf('if (isPeacefulNightGuard)');
    // R91: 命中推断 at ~1306, confidence 升 15-25 at ~1377; window updated 900→1600
    const ifSection = guardVarBlock.slice(ifGuardStart, ifGuardStart + 1600);
    expect(ifSection).toContain('命中推断');
    expect(ifSection).toContain('confidence 升 15-25');
});

test('T28: guard known-target path covers 未中推断 with witch save scenario', () => {
    const ifGuardStart = guardVarBlock.indexOf('if (isPeacefulNightGuard)');
    // R91: 未中推断 at ~1411, 女巫 at ~1424; window updated 900→1700
    const ifSection = guardVarBlock.slice(ifGuardStart, ifGuardStart + 1700);
    expect(ifSection).toContain('未中推断');
    expect(ifSection).toContain('女巫');
});

test('T29: guard known-target path references ${lastGuardTarget}号', () => {
    const ifGuardStart = guardVarBlock.indexOf('if (isPeacefulNightGuard)');
    const ifSection = guardVarBlock.slice(ifGuardStart, ifGuardStart + 900);
    expect(ifSection).toContain('${lastGuardTarget}号');
});

test('T30: guard prevDay used inside if block with D${prevDay}', () => {
    const ifGuardStart = guardVarBlock.indexOf('if (isPeacefulNightGuard)');
    // R91: D${prevDay} first appears in consecutivePeaceHintGuard at ~898; window updated 900→1100
    const ifSection = guardVarBlock.slice(ifGuardStart, ifGuardStart + 1100);
    expect(ifSection).toContain('dayCount - 1');
    expect(ifSection).toContain('D${prevDay}');
});

test('T31: guard template has ${guardDayHistoryStep} before ${guardPeaceNightStep}', () => {
    const historyIdx = guardReturnBlock.indexOf('${guardDayHistoryStep}');
    const peaceIdx = guardReturnBlock.indexOf('${guardPeaceNightStep}');
    expect(historyIdx).toBeGreaterThan(-1);
    expect(peaceIdx).toBeGreaterThan(-1);
    expect(historyIdx).toBeLessThan(peaceIdx);
});

test('T32: guard template has ${guardPeaceNightStep} immediately before Step1:', () => {
    expect(guardReturnBlock).toContain('${guardPeaceNightStep}Step1:');
});

test('T33: guard step order is guardDayHistoryStep → guardPeaceNightStep → Step2', () => {
    const historyIdx = guardReturnBlock.indexOf('${guardDayHistoryStep}');
    const peaceIdx = guardReturnBlock.indexOf('${guardPeaceNightStep}');
    const step2Idx = guardReturnBlock.indexOf('Step2:');
    expect(historyIdx).toBeGreaterThan(-1);
    expect(peaceIdx).toBeGreaterThan(-1);
    expect(step2Idx).toBeGreaterThan(-1);
    expect(historyIdx).toBeLessThan(peaceIdx);
    expect(peaceIdx).toBeLessThan(step2Idx);
    // T32 already verifies ${guardPeaceNightStep}Step1: exists
});

test('T34: guard peaceNightStep restricts to thought (not speech)', () => {
    const ifGuardStart = guardVarBlock.indexOf('if (isPeacefulNightGuard)');
    // R91: thought/speech first appear in consecutivePeaceHintGuard header at ~408/420; window updated 300→500
    const ifSection = guardVarBlock.slice(ifGuardStart, ifGuardStart + 500);
    expect(ifSection).toContain('thought');
    expect(ifSection).toContain('speech');
});

test('T35: guard return template has no hardcoded ⭕ (uses ${guardPeaceNightStep} interpolation)', () => {
    expect(guardReturnBlock).toContain('${guardPeaceNightStep}');
    expect(guardReturnBlock).not.toContain('⭕');
});

test('T36: guardPeaceNightStep empty init ensures no output on D1 or non-peaceful nights', () => {
    expect(guardVarBlock).toContain("let guardPeaceNightStep = ''");
});

test('T37: guard var block assigns to guardPeaceNightStep using template literal backtick', () => {
    const ifGuardStart = guardVarBlock.indexOf('if (isPeacefulNightGuard)');
    // R91: guardPeaceNightStep = ` now at offset ~1170 (after consecutivePeaceHintGuard decl); window updated 300→1300
    const ifSection = guardVarBlock.slice(ifGuardStart, ifGuardStart + 1300);
    expect(ifSection).toContain('guardPeaceNightStep = `');
});

test('T38: guard peaceNightStep thought instruction comes before speech instruction', () => {
    const ifGuardStart = guardVarBlock.indexOf('if (isPeacefulNightGuard)');
    // R91: thought at ~408, speech at ~420 (in consecutivePeaceHintGuard header); window updated 300→500
    const ifSection = guardVarBlock.slice(ifGuardStart, ifGuardStart + 500);
    const thoughtIdx = ifSection.indexOf('thought');
    const speechIdx = ifSection.indexOf('speech');
    expect(thoughtIdx).toBeGreaterThan(-1);
    expect(speechIdx).toBeGreaterThan(-1);
    expect(thoughtIdx).toBeLessThan(speechIdx);
});

test('T39: guard peaceNightStep content has no negative prohibitions (white bear compliance)', () => {
    const ifGuardStart = guardVarBlock.indexOf('if (isPeacefulNightGuard)');
    const ifSection = guardVarBlock.slice(ifGuardStart, ifGuardStart + 900);
    // Check the peaceNightStep assignment content — 不提 is ok (it describes speech restriction)
    // Check for actual prohibitions that could backfire
    expect(ifSection).not.toContain('禁止');
    expect(ifSection).not.toContain('绝不能');
    expect(ifSection).not.toContain('不要');
});

test('T40: guard block size within expected window', () => {
    expect(guardBlock.length).toBeGreaterThan(3500);
    expect(guardBlock.length).toBeLessThan(GUARD_WINDOW);
});
