/**
 * Round 42 Test: DAY→NIGHT identity_table keyword alignment (4 roles)
 * Fix: DAY_SPEECH write guides now use the same keywords as NIGHT_* Step 0 readers
 */
import { readFileSync } from 'fs';

const src = readFileSync('src/services/aiPrompts.js', 'utf8');
let pass = 0; let fail = 0;
const ok = (desc) => { console.log(`✅ T${pass+fail+1}: ${desc}`); pass++; };
const ng = (desc, got) => { console.error(`❌ T${pass+fail+1}: ${desc}${got ? ` | got: ${got}` : ''}`); fail++; };

// ── Locate key sections ──────────────────────────────────────────────────────

// Wolf DAY_SPEECH identity_table block (around line 1006)
const wolfDayTableIdx = src.indexOf('identity_table 填写策略（日间公开视角');
const wolfDayTableEnd = src.indexOf('输出JSON:{"thought":"完整的博弈推理过程', wolfDayTableIdx);
const wolfDayTable = wolfDayTableIdx >= 0 && wolfDayTableEnd > wolfDayTableIdx
    ? src.slice(wolfDayTableIdx, wolfDayTableEnd + 200)
    : '';

// Seer DAY_SPEECH identity_table block (around line 1070)
const seerDayTableIdx = src.indexOf('identity_table 填写指导（预言家有确定性知识');
const seerDayTableEnd = src.indexOf('输出JSON:{"thought":"预言家视角分析', seerDayTableIdx);
const seerDayTable = seerDayTableIdx >= 0 && seerDayTableEnd > seerDayTableIdx
    ? src.slice(seerDayTableIdx, seerDayTableEnd + 200)
    : '';

// Witch DAY_SPEECH identity_table block (around line 1105)
const witchDayTableIdx = src.indexOf('identity_table 填写指导（女巫：药水使用历史');
const witchDayTableEnd = src.indexOf('输出JSON:{"thought":"女巫视角分析', witchDayTableIdx);
const witchDayTable = witchDayTableIdx >= 0 && witchDayTableEnd > witchDayTableIdx
    ? src.slice(witchDayTableIdx, witchDayTableEnd + 200)
    : '';

// Guard DAY_SPEECH identity_table block (around line 1164)
const guardDayTableIdx = src.indexOf('identity_table 填写指导（守卫：跨轮守护记录');
const guardDayTableEnd = src.indexOf('输出JSON:{"thought":"守卫视角分析', guardDayTableIdx);
const guardDayTable = guardDayTableIdx >= 0 && guardDayTableEnd > guardDayTableIdx
    ? src.slice(guardDayTableIdx, guardDayTableEnd + 200)
    : '';

// NIGHT_WOLF Step 0 read pattern
const nightWolfStepIdx = src.indexOf('读取历史刀口');
const nightWolfStep = nightWolfStepIdx >= 0 ? src.slice(nightWolfStepIdx, nightWolfStepIdx + 200) : '';

// NIGHT_SEER Step 0 read pattern
const nightSeerStepIdx = src.indexOf('读取历史查验候选');
const nightSeerStep = nightSeerStepIdx >= 0 ? src.slice(nightSeerStepIdx, nightSeerStepIdx + 200) : '';

// NIGHT_WITCH Step 0 read pattern
const nightWitchStepIdx = src.indexOf('读取历史毒药候选');
const nightWitchStep = nightWitchStepIdx >= 0 ? src.slice(nightWitchStepIdx, nightWitchStepIdx + 200) : '';

// NIGHT_GUARD Step 0 read pattern
const nightGuardStepIdx = src.indexOf('读取历史守护优先候选');
const nightGuardStep = nightGuardStepIdx >= 0 ? src.slice(nightGuardStepIdx, nightGuardStepIdx + 200) : '';

// ── T1-T4: Section location ───────────────────────────────────────────────────
wolfDayTable ? ok('Wolf DAY_SPEECH identity_table block found') : ng('Wolf DAY_SPEECH identity_table block NOT found');
seerDayTable ? ok('Seer DAY_SPEECH identity_table block found') : ng('Seer DAY_SPEECH identity_table block NOT found');
witchDayTable ? ok('Witch DAY_SPEECH identity_table block found') : ng('Witch DAY_SPEECH identity_table block NOT found');
guardDayTable ? ok('Guard DAY_SPEECH identity_table block found') : ng('Guard DAY_SPEECH identity_table block NOT found');

// ── T5-T8: DAY_SPEECH now uses NIGHT_* keywords ───────────────────────────────

// T5: Wolf DAY_SPEECH writes "高优先刀口" (NOT "刀口候选")
wolfDayTable.includes('高优先刀口')
    ? ok('Wolf DAY_SPEECH: writes "高优先刀口" (correct keyword for NIGHT_WOLF Step 0)')
    : ng('Wolf DAY_SPEECH: missing "高优先刀口"', wolfDayTable.slice(0, 200));

wolfDayTable.includes('刀口候选：')
    ? ng('Wolf DAY_SPEECH: still contains old keyword "刀口候选："')
    : ok('Wolf DAY_SPEECH: old keyword "刀口候选：" removed');

// T7: Seer DAY_SPEECH writes "排队查验优先级" (NOT just "查验候选")
seerDayTable.includes('排队查验优先级')
    ? ok('Seer DAY_SPEECH: writes "排队查验优先级" (correct keyword for NIGHT_SEER Step 0)')
    : ng('Seer DAY_SPEECH: missing "排队查验优先级"', seerDayTable.slice(0, 200));

seerDayTable.includes('下次查验候选')
    ? ng('Seer DAY_SPEECH: still contains old keyword "下次查验候选"')
    : ok('Seer DAY_SPEECH: old keyword "下次查验候选" removed');

// T9: Witch DAY_SPEECH writes "毒药优先候选" (NOT "毒药备选")
witchDayTable.includes('毒药优先候选')
    ? ok('Witch DAY_SPEECH: writes "毒药优先候选" (correct keyword for NIGHT_WITCH Step 0)')
    : ng('Witch DAY_SPEECH: missing "毒药优先候选"', witchDayTable.slice(0, 200));

witchDayTable.includes('毒药备选')
    ? ng('Witch DAY_SPEECH: still contains old keyword "毒药备选"')
    : ok('Witch DAY_SPEECH: old keyword "毒药备选" removed');

// T11: Guard DAY_SPEECH writes "守护优先级：高" (WITH colon)
guardDayTable.includes('守护优先级：高')
    ? ok('Guard DAY_SPEECH: writes "守护优先级：高" with colon (correct keyword for NIGHT_GUARD Step 0)')
    : ng('Guard DAY_SPEECH: missing "守护优先级：高" (with colon)', guardDayTable.slice(0, 200));

// T12: Guard DAY_SPEECH does NOT write "守护优先级高" (WITHOUT colon, old bug)
const guardDayColon = guardDayTable.match(/守护优先级[^：]/);
!guardDayColon
    ? ok('Guard DAY_SPEECH: no "守护优先级X" (missing colon) found — old bug fixed')
    : ng('Guard DAY_SPEECH: still contains "守护优先级" without colon', guardDayColon[0]);

// ── T13-T16: NIGHT_* Step 0 keywords still intact ────────────────────────────
nightWolfStep.includes('高优先刀口')
    ? ok('NIGHT_WOLF Step 0: reads "高优先刀口" (unchanged)')
    : ng('NIGHT_WOLF Step 0: "高优先刀口" keyword missing!');

nightSeerStep.includes('排队查验优先级')
    ? ok('NIGHT_SEER Step 0: reads "排队查验优先级" (unchanged)')
    : ng('NIGHT_SEER Step 0: "排队查验优先级" keyword missing!');

nightWitchStep.includes('毒药优先候选')
    ? ok('NIGHT_WITCH Step 0: reads "毒药优先候选" (unchanged)')
    : ng('NIGHT_WITCH Step 0: "毒药优先候选" keyword missing!');

nightGuardStep.includes('守护优先级：高')
    ? ok('NIGHT_GUARD Step 0: reads "守护优先级：高" (unchanged)')
    : ng('NIGHT_GUARD Step 0: "守护优先级：高" keyword missing!');

// ── T17-T20: NIGHT_* write guides still use correct keywords ─────────────────

// NIGHT_WOLF write guide (around line 1459)
const wolfNightWriteIdx = src.indexOf('identity_table 战略更新（读写闭环）');
const wolfNightWrite = wolfNightWriteIdx >= 0 ? src.slice(wolfNightWriteIdx, wolfNightWriteIdx + 400) : '';
wolfNightWrite.includes('高优先刀口：[具体威胁原因]')
    ? ok('NIGHT_WOLF write: still uses "高优先刀口：..." keyword')
    : ng('NIGHT_WOLF write: "高优先刀口：..." keyword missing!');

// NIGHT_SEER write guide (around line 1520)
const seerNightWriteIdx = src.indexOf('identity_table 填写指导（夜间查验：记录确认知识与候选优先级）');
const seerNightWrite = seerNightWriteIdx >= 0 ? src.slice(seerNightWriteIdx, seerNightWriteIdx + 400) : '';
seerNightWrite.includes('排队查验优先级：[①②③④⑤')
    ? ok('NIGHT_SEER write: still uses "排队查验优先级：..." keyword')
    : ng('NIGHT_SEER write: "排队查验优先级：..." keyword missing!');

// NIGHT_WITCH write guide (around line 1565)
const witchNightWriteIdx = src.indexOf('identity_table 填写指导（女巫夜间：药水决策状态持久化）');
const witchNightWrite = witchNightWriteIdx >= 0 ? src.slice(witchNightWriteIdx, witchNightWriteIdx + 400) : '';
witchNightWrite.includes('毒药优先候选：')
    ? ok('NIGHT_WITCH write: still uses "毒药优先候选：" keyword')
    : ng('NIGHT_WITCH write: "毒药优先候选：" keyword missing!');

// NIGHT_GUARD write guide (around line 1370)
const guardNightWriteIdx = src.indexOf('identity_table 填写指导（守卫夜间：守护历史跨轮追加');
const guardNightWrite = guardNightWriteIdx >= 0 ? src.slice(guardNightWriteIdx, guardNightWriteIdx + 400) : '';
guardNightWrite.includes('守护优先级：高/中')
    ? ok('NIGHT_GUARD write: still uses "守护优先级：高/中" keyword')
    : ng('NIGHT_GUARD write: "守护优先级：高/中" keyword missing!');

// ── T21-T22: Diagnostic command still clean ───────────────────────────────────
!src.includes('供下轮') && !src.includes('下轮复查')
    ? ok('Diagnostic command clean: no "供下轮|下轮复查" gaps')
    : ng('Diagnostic command: found "供下轮" or "下轮复查" — new gaps exist!');

// R41 pattern: count "下轮 Step 0 将直接从此读取" forward references
const forwardRefs = (src.match(/下轮 Step 0 将直接从此读取/g) || []).length;
forwardRefs >= 4
    ? ok(`Forward references count: ${forwardRefs} ≥ 4 (NIGHT_WOLF/WITCH/GUARD/SEER write guides)`)
    : ng(`Forward references count: ${forwardRefs} < 4`, '');

// T23: Keyword alignment table — summary check
const allKeywordsOk =
    src.includes('高优先刀口：[威胁描述]') &&      // Wolf DAY
    src.includes('高优先刀口：[具体威胁原因]') &&   // Wolf NIGHT
    src.includes('高优先刀口"？') &&               // Wolf Step 0 read
    src.includes('排队查验优先级：①（下夜') &&     // Seer DAY
    src.includes('排队查验优先级：[①②③④⑤') &&   // Seer NIGHT
    src.includes('排队查验优先级"？') &&            // Seer Step 0 read
    src.includes('毒药优先候选：[带节奏') &&        // Witch DAY (new)
    src.includes('毒药优先候选：[发言带节奏') &&    // Witch NIGHT
    src.includes('毒药优先候选"？') &&              // Witch Step 0 read
    src.includes('守护优先级：高；如上轮') &&       // Guard DAY (new)
    src.includes('守护优先级：高/中"') &&           // Guard NIGHT
    src.includes('守护优先级：高"或') ;             // Guard Step 0 read
allKeywordsOk
    ? ok('Full keyword alignment table: all 12 occurrences correct (4 roles × DAY/NIGHT/Step0)')
    : ng('Full keyword alignment table: some keywords missing', '');

// T24: R38/R39/R40/R41 regressions — wolfHistoryStep still exists
src.includes('wolfHistoryStep') && src.includes('witchHistoryStep') &&
src.includes('guardHistoryStep') && src.includes('seerHistoryStep')
    ? ok('R38/R39/R40/R41 regression: all 4 night history steps still present')
    : ng('Regression: one or more night history steps missing!');

// T25: hunterHistoryStep still exists (R41)
src.includes('hunterHistoryStep')
    ? ok('R41 regression: hunterHistoryStep still present')
    : ng('Regression: hunterHistoryStep missing!');

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n─── Round 42: ${pass}/${pass+fail} passed ───`);
if (fail > 0) process.exit(1);
