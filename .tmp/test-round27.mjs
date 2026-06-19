// Round 27 测试：DAY_VOTE 预言家对跳投票优先级
// 验证：seerCounterClaimantsInVote 计算 + seerVoteStrategy 变量 + 对跳/PK/回退场景

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dirname, '../src/services/aiPrompts.js'), 'utf8');

let passed = 0;
let failed = 0;

function test(name, condition, detail = '') {
    if (condition) {
        console.log(`  ✅ ${name}`);
        passed++;
    } else {
        console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`);
        failed++;
    }
}

// ── 定位 DAY_VOTE case 块（必须用带花括号的形式，避免 getCOTTemplate 假 case）
const dayVoteStart = src.indexOf('case PROMPT_ACTIONS.DAY_VOTE: {');
if (dayVoteStart === -1) {
    console.log('❌ 找不到 case PROMPT_ACTIONS.DAY_VOTE: {');
    process.exit(1);
}

// 截取约 8000 字节（DAY_VOTE 块含 seerVoteStrategy + return 模板，约 6500 bytes）
// R24 教训：窗口为估算值的 150%
const dayVoteBlock = src.slice(dayVoteStart, dayVoteStart + 8000);

console.log('\n=== T1-T5: seerCounterClaimantsInVote 计算验证 ===');
test('T1: seerCounterClaimantsInVote 变量已声明',
    dayVoteBlock.includes('seerCounterClaimantsInVote'));
test('T2: 仅对预言家计算（playerRole 条件）',
    dayVoteBlock.includes("playerRole === '预言家'") && dayVoteBlock.includes('seerCounterClaimantsInVote'));
test('T3: 过滤 type === jump_seer',
    dayVoteBlock.includes("c.type === 'jump_seer'"));
test('T4: 排除当前玩家自身',
    dayVoteBlock.includes("c.playerId !== currentPlayer?.id"));
test('T5: 限制在本轮投票目标内（voteTargets.includes）',
    dayVoteBlock.includes('voteTargets.includes(c.playerId)'));

console.log('\n=== T6-T10: seerVoteStrategy 变量验证 ===');
test('T6: seerVoteStrategy 变量已声明',
    dayVoteBlock.includes('seerVoteStrategy'));
test('T7: 对跳时含"对跳优先"关键词',
    dayVoteBlock.includes('对跳优先'));
test('T8: 引用 seerCounterClaimantsInVote.join 拼接 ID',
    dayVoteBlock.includes('seerCounterClaimantsInVote.join'));
test('T9: 包含"悍跳者"描述',
    dayVoteBlock.includes('悍跳者'));
test('T10: 无对跳时回退到原有策略（率先投查杀目标）',
    dayVoteBlock.includes('率先投查杀目标'));

console.log('\n=== T11-T14: PK 场景专属文本 ===');
test('T11: pkMode 分支存在于 seerVoteStrategy',
    dayVoteBlock.includes('pkMode') && dayVoteBlock.includes('seerVoteStrategy'));
test('T12: PK时含"PK必须投悍跳者"',
    dayVoteBlock.includes('PK必须投悍跳者'));
test('T13: PK弃票警告（弃票=放过已知狼人）',
    dayVoteBlock.includes('弃票=放过已知狼人'));
test('T14: 非PK时含"率先投悍跳者出局"或类似引导',
    dayVoteBlock.includes('率先投悍跳者出局') || dayVoteBlock.includes('投悍跳者出局'));

console.log('\n=== T15-T18: 模板内引用验证 ===');
// seerVoteStrategy 被模板字符串引用
const templateStart = dayVoteBlock.indexOf('return `投票放逐阶段');
if (templateStart !== -1) {
    const templateBlock = dayVoteBlock.slice(templateStart, templateStart + 1200);
    test('T15: 模板中 playerRole=== 预言家 分支引用 seerVoteStrategy',
        templateBlock.includes('seerVoteStrategy'));
    test('T16: 模板中狼人博弈条目仍在',
        templateBlock.includes('狼人投票博弈'));
    test('T17: 模板中通用投票策略条目仍在',
        templateBlock.includes('有查杀 → 跟投查杀'));
    test('T18: 目标意义警告仍在（targetId = 淘汰/出局）',
        templateBlock.includes('targetId = 你想投票【淘汰'));
} else {
    test('T15', false, '找不到 return `投票放逐阶段');
    test('T16', false, '');
    test('T17', false, '');
    test('T18', false, '');
}

console.log('\n=== T19-T22: R18 格式安全（指导文本不含原始 JS 变量名插值）===');
// 检查 seerVoteStrategy 变量声明行内不含不当 ${变量名} — 只有合法的 join 和 pkMode 三元
// 定位 seerVoteStrategy 声明行
const svsIdx = dayVoteBlock.indexOf('const seerVoteStrategy');
if (svsIdx !== -1) {
    // 找到该声明直到下一个 ';' 的块
    const svsEnd = dayVoteBlock.indexOf('`;', svsIdx);
    const svsBlock = svsEnd !== -1 ? dayVoteBlock.slice(svsIdx, svsEnd + 2) : dayVoteBlock.slice(svsIdx, svsIdx + 500);
    test('T19: seerVoteStrategy 声明存在', svsIdx !== -1);
    // 验证使用了 .join() 而不是裸 ID 数组
    test('T20: 使用 .join(\',\') 拼接 ID 列表（格式正确）',
        svsBlock.includes('.join(\',\')'));
    // 验证 pkMode 三元在声明块内
    test('T21: pkMode 三元在声明块内',
        svsBlock.includes('pkMode'));
    // 验证没有非法的 ${aliveCount} 等 case 变量名裸插值在指导文本行
    const svsText = svsBlock;
    const hasBadInterp = /\$\{(aliveCount|wolfCount|voteDay|alivePlayers)\}/.test(svsText);
    test('T22: 声明内无非法 case 变量名裸插值（aliveCount/wolfCount/voteDay）',
        !hasBadInterp);
} else {
    ['T19','T20','T21','T22'].forEach(t => test(t, false, '找不到 seerVoteStrategy 声明'));
}

console.log('\n=== T23-T27: 回归测试（核心功能不受影响）===');
// 热力计算
test('T23: 跨轮投票热力逻辑仍在',
    dayVoteBlock.includes('voteMomentumHint') && dayVoteBlock.includes('hotTargets'));
// PK sceneHint（通用）
test('T24: PK 通用场景提示仍在（sceneHint）',
    dayVoteBlock.includes('平票后重投') || dayVoteBlock.includes('PK重投'));
// 首轮提示
test('T25: 首轮信息有限提示仍在',
    dayVoteBlock.includes('首轮投票') && dayVoteBlock.includes('首轮信息有限'));
// 弃票说明
test('T26: 弃票选项说明仍在',
    dayVoteBlock.includes('-1弃票'));
// targetId 格式
test('T27: JSON 输出格式不变（targetId 字段）',
    dayVoteBlock.includes('"targetId":数字或-1'));

console.log(`\n==============================`);
console.log(`总计: ${passed + failed} 项 | ✅ ${passed} 通过 | ❌ ${failed} 失败`);
if (failed > 0) process.exit(1);
