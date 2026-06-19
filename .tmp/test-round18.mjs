/**
 * Round 18 test: Verify identity_table guidance for witch (day+night), hunter, villager
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '../src/services/aiPrompts.js'), 'utf8');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`✅ ${name}`);
        passed++;
    } catch (e) {
        console.log(`❌ ${name}: ${e.message}`);
        failed++;
    }
}

function assert(condition, msg) {
    if (!condition) throw new Error(msg);
}

// Find ROLE_DAY_SPEECH_PROMPTS block (after line ~938)
const dspStart = src.indexOf("const ROLE_DAY_SPEECH_PROMPTS = {");
assert(dspStart !== -1, "ROLE_DAY_SPEECH_PROMPTS not found");

// ─── 女巫 (witch) DAY_SPEECH 指导 ───
const witchDayStart = src.indexOf("'女巫': (ctx, params) => {", dspStart);
assert(witchDayStart !== -1, "witch day speech section not found");
// Witch section ends before '猎人' entry
const witchDayEnd = src.indexOf("'猎人': (ctx, params)", witchDayStart);
const witchDayBlock = src.slice(witchDayStart, witchDayEnd);

test("T1: 女巫DAY_SPEECH有identity_table填写指导标题", () => {
    assert(witchDayBlock.includes('identity_table 填写指导（女巫：药水使用历史'), "missing witch day guidance header");
});

test("T2: 女巫DAY_SPEECH有已救活玩家指导（85-95）", () => {
    assert(witchDayBlock.includes('85-95'), "missing confidence 85-95 for saved player");
    assert(witchDayBlock.includes('银水救活'), "missing 银水救活 keyword");
});

test("T3: 女巫DAY_SPEECH有已毒杀玩家指导（98-100）", () => {
    assert(witchDayBlock.includes('98-100'), "missing confidence 98-100 for poisoned player");
    assert(witchDayBlock.includes('毒药处决确认出局'), "missing 毒药处决确认出局 keyword");
});

test("T4: 女巫DAY_SPEECH有高威胁毒药候选指导", () => {
    assert(witchDayBlock.includes('65-85'), "missing confidence 65-85 for threat candidate");
    assert(witchDayBlock.includes('毒药备选'), "missing 毒药备选 keyword");
});

test("T5: 女巫DAY_SPEECH有关键神职银水保护指导", () => {
    assert(witchDayBlock.includes('若明夜被刀且银水在'), "missing future save hint");
    assert(witchDayBlock.includes('50-75'), "missing confidence 50-75 for divine protection candidate");
});

// ─── 猎人 (hunter) DAY_SPEECH 指导 ───
const hunterDayStart = src.indexOf("'猎人': (ctx, params) => `", dspStart);
assert(hunterDayStart !== -1, "hunter day speech section not found");
const hunterDayEnd = src.indexOf("'守卫': (ctx, params) =>", hunterDayStart);
const hunterDayBlock = src.slice(hunterDayStart, hunterDayEnd);

test("T6: 猎人DAY_SPEECH有identity_table填写指导标题", () => {
    assert(hunterDayBlock.includes('identity_table 填写指导（猎人：跨轮积累开枪优先级）'), "missing hunter day guidance header");
});

test("T7: 猎人DAY_SPEECH有高威胁候选开枪优先指导（70-90）", () => {
    assert(hunterDayBlock.includes('70-90'), "missing confidence 70-90 for high threat");
    assert(hunterDayBlock.includes('开枪优先'), "missing 开枪优先 keyword");
});

test("T8: 猎人DAY_SPEECH有中等嫌疑备选指导（50-70）", () => {
    assert(hunterDayBlock.includes('50-70'), "missing confidence 50-70 for medium threat");
    assert(hunterDayBlock.includes('开枪备选'), "missing 开枪备选 keyword");
});

test("T9: 猎人DAY_SPEECH有明确好人排除指导（15-35）", () => {
    assert(hunterDayBlock.includes('15-35'), "missing confidence 15-35 for clear good");
    assert(hunterDayBlock.includes('排除开枪对象'), "missing 排除开枪对象 keyword");
});

test("T10: 猎人DAY_SPEECH有跨轮回顾指导", () => {
    assert(hunterDayBlock.includes('开枪前回顾上轮 identity_table'), "missing cross-round review instruction");
    assert(hunterDayBlock.includes('开枪优先级：高'), "missing priority:high in guidance");
});

// ─── 村民 (villager) DAY_SPEECH 指导 ───
const villagerDayStart = src.indexOf("'村民': (ctx, params) => `${getBaseContext(ctx)}\n【村民专属任务】");
assert(villagerDayStart !== -1, "villager day speech section not found");
// Villager section ends before 骑士
const villagerDayEnd = src.indexOf("'骑士':", villagerDayStart);
const villagerDayBlock = src.slice(villagerDayStart, villagerDayEnd);

test("T11: 村民DAY_SPEECH有identity_table填写指导标题", () => {
    assert(villagerDayBlock.includes('identity_table 填写指导（村民：跨轮行为模式积累'), "missing villager day guidance header");
});

test("T12: 村民DAY_SPEECH有可疑玩家积累指导（55-80）", () => {
    assert(villagerDayBlock.includes('55-80'), "missing confidence 55-80 for suspect");
    assert(villagerDayBlock.includes('行为积累'), "missing 行为积累 keyword");
});

test("T13: 村民DAY_SPEECH有信任玩家积累指导（15-40）", () => {
    assert(villagerDayBlock.includes('15-40'), "missing confidence 15-40 for trust");
    assert(villagerDayBlock.includes('信任积累'), "missing 信任积累 keyword");
});

test("T14: 村民DAY_SPEECH有票型关联指导", () => {
    assert(villagerDayBlock.includes('票型关联'), "missing 票型关联 keyword");
    assert(villagerDayBlock.includes('两人可能一队'), "missing duo suspicion hint");
});

test("T15: 村民DAY_SPEECH要求每轮追加不覆盖", () => {
    assert(villagerDayBlock.includes('追加'), "missing append instruction");
    assert(villagerDayBlock.includes('不要覆盖历史'), "missing no-overwrite instruction");
});

// ─── NIGHT_WITCH case 指导 ───
const nightWitchCaseStart = src.indexOf("case PROMPT_ACTIONS.NIGHT_WITCH:");
assert(nightWitchCaseStart !== -1, "NIGHT_WITCH case not found");
const nightWitchEnd = src.indexOf("case PROMPT_ACTIONS.NIGHT_DREAMWEAVER", nightWitchCaseStart);
const nightWitchBlock = src.slice(nightWitchCaseStart, nightWitchEnd);

test("T16: NIGHT_WITCH有identity_table夜间指导标题", () => {
    assert(nightWitchBlock.includes('identity_table 填写指导（女巫夜间：药水决策状态持久化）'), "missing night witch guidance header");
});

test("T17: NIGHT_WITCH夜间指导有被刀目标条目（70-85）", () => {
    assert(nightWitchBlock.includes('70-85'), "missing confidence 70-85 for dying target");
    assert(nightWitchBlock.includes('被狼刀'), "missing 被狼刀 keyword");
});

test("T18: NIGHT_WITCH夜间指导有高威胁毒药候选", () => {
    assert(nightWitchBlock.includes('高威胁毒药候选'), "missing poison candidate guidance");
    assert(nightWitchBlock.includes('下轮复查'), "missing next-round check instruction");
});

test("T19: NIGHT_WITCH夜间指导有确认出局条目（98-100）", () => {
    // Both day and night witch have 98-100
    const nightWitchBlockAfterGuidance = nightWitchBlock.slice(nightWitchBlock.indexOf('identity_table 填写指导（女巫夜间'));
    assert(nightWitchBlockAfterGuidance.includes('98-100'), "missing confidence 98-100 for poisoned player in night block");
    assert(nightWitchBlockAfterGuidance.includes('N[X]夜毒药处决，出局确认'), "missing night poison confirm keyword");
});

// ─── No template interpolation leak in guidance text ───
test("T20: NIGHT_WITCH夜间指导无template interpolation漏洞", () => {
    const guidanceBlock = nightWitchBlock.slice(nightWitchBlock.indexOf('identity_table 填写指导（女巫夜间'));
    // Should NOT contain raw ${canSave} interpolation baked into guidance
    assert(!guidanceBlock.includes("${canSave"), "found ${canSave} in guidance text (interpolation bug)");
});

// ─── Regression checks ───
test("T21: R17 守卫DAY_SPEECH identity_table指导保持完整", () => {
    const guardStart = src.indexOf("'守卫': (ctx, params) => {", dspStart);
    const guardEnd = src.indexOf("'村民': (ctx, params)", guardStart);
    const guardBlock = src.slice(guardStart, guardEnd);
    assert(guardBlock.includes('N[X]夜守护，结果'), "guard history guidance missing");
    assert(guardBlock.includes('今晚换守判断'), "guard tonight decision guidance missing");
});

test("T22: R17 NIGHT_SEER identity_table指导保持完整", () => {
    const seerCaseStart = src.indexOf("case PROMPT_ACTIONS.NIGHT_SEER:");
    assert(seerCaseStart !== -1, "NIGHT_SEER case not found");
    const seerEnd = src.indexOf("case PROMPT_ACTIONS.NIGHT_WITCH:", seerCaseStart);
    const seerBlock = src.slice(seerCaseStart, seerEnd);
    assert(seerBlock.includes('confidence 填 95-100'), "seer 95-100 guidance missing");
    assert(seerBlock.includes('待明日报'), "seer pending report guidance missing");
});

test("T23: R16 NIGHT_WOLF identity_table战略指导保持完整", () => {
    const wolfCaseStart = src.indexOf("case PROMPT_ACTIONS.NIGHT_WOLF:");
    assert(wolfCaseStart !== -1, "NIGHT_WOLF case not found");
    const wolfEnd = src.indexOf("case PROMPT_ACTIONS.NIGHT_SEER:", wolfCaseStart);
    const wolfBlock = src.slice(wolfCaseStart, wolfEnd);
    assert(wolfBlock.includes('高优先刀口') || wolfBlock.includes('战略'), "wolf strategic identity_table guidance missing");
});

// ─── Summary ───
console.log(`\n总计：${passed + failed} 项测试，${passed} 通过，${failed} 失败`);
if (failed > 0) process.exit(1);
