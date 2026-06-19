import { readFileSync } from 'fs';

const src = readFileSync('/home/user/ai_wolf_game/src/services/aiPrompts.js', 'utf8');

let passed = 0;
let failed = 0;

function assert(name, condition) {
    if (condition) { console.log(`✅ ${name}`); passed++; }
    else { console.error(`❌ ${name}`); failed++; }
}

// T1: wolfTeammatesHint is now a let declaration (not const ternary)
assert('T1: let wolfTeammatesHint declaration', src.includes("let wolfTeammatesHint = '';"));

// T2: totalWolves calculation present
assert('T2: totalWolves = teammates + 1', src.includes('const totalWolves = params.wolfTeammates.length + 1'));

// T3: aliveCount computed from ctx.aliveList
assert('T3: aliveCount from ctx.aliveList', src.includes("const aliveCount = ctx.aliveList ? ctx.aliveList.split(',').length : 0"));

// T4: isLateGame condition
assert('T4: isLateGame condition', src.includes('aliveCount <= totalWolves * 2 + 1'));

// T5: roleDiv 2-wolf path mentions 主动方 and 低调方
assert('T5: roleDiv 2狼 主动方 mentioned', src.includes('主动方'));
assert('T5b: roleDiv 2狼 低调方 mentioned', src.includes('低调方'));

// T6: roleDiv multi-wolf path mentions 激进狼 and 分析狼
assert('T6: roleDiv 多狼 激进狼', src.includes('激进狼'));
assert('T6b: roleDiv 多狼 分析狼', src.includes('分析狼'));

// T7: lateHint mentions ticket calculation
assert('T7: lateHint 票型精算', src.includes('票型精算'));

// T8: original 3 principles still present (not removed)
assert('T8: 立场分散 principle preserved', src.includes('立场分散'));
assert('T8b: 投票错位 principle preserved', src.includes('投票错位'));
assert('T8c: 制造分歧感 principle preserved', src.includes('制造分歧感'));

// T9: wolfTeammatesHint assignment uses teammates join (template literal continues beyond join)
assert('T9: teammates join in wolfTeammatesHint', src.includes('wolfTeammatesHint = `') && src.includes('params.wolfTeammates.join(\',\')'));

// T10: function structure - let wolfTeammatesHint outside if, then assignment inside if
const letIdx = src.indexOf("let wolfTeammatesHint = '';");
const ifIdx = src.indexOf('if (params.wolfTeammates?.length > 0)');
const assignIdx = src.indexOf('wolfTeammatesHint = `\\n【多狼协作');
assert('T10: let before if before assignment', letIdx < ifIdx && ifIdx < assignIdx);

// T11: Wang 2025 reference comment present
assert('T11: Wang 2025 reference in code', src.includes('Wang 2025'));

// T12: No old ternary pattern remains
assert('T12: old const ternary removed', !src.includes("const wolfTeammatesHint = params.wolfTeammates?.length > 0"));

console.log(`\n总计: ${passed}/${passed + failed} passed`);
process.exit(failed > 0 ? 1 : 0);
