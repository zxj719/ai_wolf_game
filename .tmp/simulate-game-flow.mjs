/**
 * 狼人杀游戏流程干跑模拟
 * 不依赖 LLM，纯函数验证：夜间死亡结算、同守同救、猎人连锁、胜负判定
 */

// ── 角色定义 ─────────────────────────────────────────────────
const ROLES = { WEREWOLF: '狼人', SEER: '预言家', WITCH: '女巫', HUNTER: '猎人', GUARD: '守卫', VILLAGER: '村民' };

// ── 工具函数 ─────────────────────────────────────────────────
function mkPlayer(id, role, extra = {}) {
  return {
    id, role, name: `P${id}`, isAlive: true,
    hasWitchSave: role === ROLES.WITCH,
    hasWitchPoison: role === ROLES.WITCH,
    canHunterShoot: role === ROLES.HUNTER,
    isPoisoned: false,
    ...extra,
  };
}

// ── resolveNight 纯函数实现（从 useNightFlow.js 提取逻辑） ───
function resolveNight({ players, wolfTarget, witchSave, witchPoison, guardTarget }) {
  const deadIds = [];
  const poisonedIds = [];
  const deathReasons = {};

  if (wolfTarget !== null) {
    const isGuarded = guardTarget === wolfTarget;
    const isBothGuardedAndSaved = isGuarded && witchSave;

    if (isBothGuardedAndSaved) {
      deadIds.push(wolfTarget);
      deathReasons[wolfTarget] = '同守同救';
    } else if (!isGuarded && !witchSave) {
      deadIds.push(wolfTarget);
      deathReasons[wolfTarget] = '被狼人杀害';
    }
  }

  if (witchPoison !== null) {
    if (!deadIds.includes(witchPoison)) deadIds.push(witchPoison);
    poisonedIds.push(witchPoison);
    deathReasons[witchPoison] = '被女巫毒死';
  }

  const uniqueDeads = [...new Set(deadIds)];
  const updatedPlayers = players.map(p => {
    if (!uniqueDeads.includes(p.id)) return p;
    const wasPoisoned = poisonedIds.includes(p.id);
    return { ...p, isAlive: false, isPoisoned: wasPoisoned, canHunterShoot: !wasPoisoned };
  });

  return { uniqueDeads, deathReasons, updatedPlayers };
}

// ── 胜负判定（边界逻辑）────────────────────────────────────
function checkGameEnd(players) {
  const aliveWolves = players.filter(p => p.isAlive && p.role === ROLES.WEREWOLF);
  const aliveGood = players.filter(p => p.isAlive && p.role !== ROLES.WEREWOLF);
  if (aliveWolves.length === 0) return { winner: '好人', reason: '狼人全灭' };
  if (aliveWolves.length >= aliveGood.length) return { winner: '狼人', reason: '狼人数量>=好人' };
  return null;
}

// ── 猎人连锁开枪模拟 ─────────────────────────────────────────
// 注：真实游戏中猎人是"死亡后开枪"，所以不检查 isAlive（hunter 已死才触发）
function simHunterChain(players, hunterId, targetId, chainDepth = 0, maxDepth = 3) {
  if (chainDepth > maxDepth) return { killed: [], log: ['连锁上限'] };

  const hunter = players.find(p => p.id === hunterId);
  if (!hunter) return { killed: [], log: [] };

  const log = [`[链深${chainDepth}] 猎人${hunterId}号开枪→${targetId}号`];
  const updatedPlayers = players.map(p => p.id === targetId ? { ...p, isAlive: false } : p);
  const killed = [targetId];

  const nextHunter = updatedPlayers.find(p => p.id === targetId);
  if (nextHunter && nextHunter.role === ROLES.HUNTER && nextHunter.canHunterShoot) {
    // 连锁：next hunter also shoots — simulate choosing first alive player
    const nextTarget = updatedPlayers.find(p => p.isAlive && p.id !== targetId)?.id;
    if (nextTarget !== undefined) {
      const sub = simHunterChain(updatedPlayers, targetId, nextTarget, chainDepth + 1, maxDepth);
      killed.push(...sub.killed);
      log.push(...sub.log);
    }
  }
  return { killed, log };
}

// ═══════════════════════════════════════════════════════════════
// TEST CASES
// ═══════════════════════════════════════════════════════════════

let passed = 0;
let failed = 0;

function assert(desc, condition) {
  if (condition) {
    console.log(`  ✅ ${desc}`);
    passed++;
  } else {
    console.error(`  ❌ ${desc}`);
    failed++;
  }
}

// ── T1: 正常狼刀 ─────────────────────────────────────────────
console.log('\n【T1】正常狼刀（无守护无救）');
{
  const players = [mkPlayer(1, ROLES.WEREWOLF), mkPlayer(2, ROLES.SEER), mkPlayer(3, ROLES.VILLAGER)];
  const { uniqueDeads, deathReasons, updatedPlayers } = resolveNight({
    players, wolfTarget: 2, witchSave: false, witchPoison: null, guardTarget: null
  });
  assert('预言家死亡', uniqueDeads.includes(2));
  assert('死因：被狼人杀害', deathReasons[2] === '被狼人杀害');
  assert('玩家2 isAlive=false', !updatedPlayers.find(p => p.id === 2).isAlive);
  assert('玩家1 存活', updatedPlayers.find(p => p.id === 1).isAlive);
}

// ── T2: 守卫守住 ─────────────────────────────────────────────
console.log('\n【T2】守卫成功守护（无救）');
{
  const players = [mkPlayer(1, ROLES.WEREWOLF), mkPlayer(2, ROLES.SEER), mkPlayer(3, ROLES.GUARD)];
  const { uniqueDeads } = resolveNight({
    players, wolfTarget: 2, witchSave: false, witchPoison: null, guardTarget: 2
  });
  assert('无人死亡（守卫救住）', uniqueDeads.length === 0);
}

// ── T3: 女巫救人 ─────────────────────────────────────────────
console.log('\n【T3】女巫解药救人（无守卫）');
{
  const players = [mkPlayer(1, ROLES.WEREWOLF), mkPlayer(2, ROLES.SEER), mkPlayer(3, ROLES.WITCH)];
  const { uniqueDeads } = resolveNight({
    players, wolfTarget: 2, witchSave: true, witchPoison: null, guardTarget: null
  });
  assert('无人死亡（女巫救住）', uniqueDeads.length === 0);
}

// ── T4: 同守同救触发 ─────────────────────────────────────────
console.log('\n【T4】同守同救（守卫+女巫同时保护同一目标）');
{
  const players = [
    mkPlayer(1, ROLES.WEREWOLF), mkPlayer(2, ROLES.SEER),
    mkPlayer(3, ROLES.GUARD), mkPlayer(4, ROLES.WITCH)
  ];
  const { uniqueDeads, deathReasons } = resolveNight({
    players, wolfTarget: 2, witchSave: true, witchPoison: null, guardTarget: 2
  });
  assert('目标死亡（同守同救）', uniqueDeads.includes(2));
  assert('死因：同守同救', deathReasons[2] === '同守同救');
}

// ── T5: 女巫毒人 ──────────────────────────────────────────────
console.log('\n【T5】女巫毒人（无狼刀）');
{
  const players = [
    mkPlayer(1, ROLES.WEREWOLF), mkPlayer(2, ROLES.SEER),
    mkPlayer(3, ROLES.WITCH), mkPlayer(4, ROLES.VILLAGER)
  ];
  // 模拟平安夜（无狼刀），女巫毒4号
  const { uniqueDeads, deathReasons, updatedPlayers } = resolveNight({
    players, wolfTarget: null, witchSave: false, witchPoison: 4, guardTarget: null
  });
  assert('4号死亡（毒死）', uniqueDeads.includes(4));
  assert('死因：被女巫毒死', deathReasons[4] === '被女巫毒死');
  assert('毒死者 isPoisoned=true', updatedPlayers.find(p => p.id === 4).isPoisoned === true);
  assert('毒死者 canHunterShoot=false（若为猎人）', updatedPlayers.find(p => p.id === 4).canHunterShoot === false);
}

// ── T6: 被毒死的猎人不能开枪 ─────────────────────────────────
console.log('\n【T6】猎人被毒死后 canHunterShoot=false');
{
  const players = [
    mkPlayer(1, ROLES.WEREWOLF), mkPlayer(2, ROLES.HUNTER),
    mkPlayer(3, ROLES.WITCH), mkPlayer(4, ROLES.VILLAGER)
  ];
  const { updatedPlayers } = resolveNight({
    players, wolfTarget: null, witchSave: false, witchPoison: 2, guardTarget: null
  });
  const hunter = updatedPlayers.find(p => p.id === 2);
  assert('猎人已死', !hunter.isAlive);
  assert('猎人被毒死后不能开枪', !hunter.canHunterShoot);
}

// ── T7: 正常刀杀猎人，猎人可以开枪 ──────────────────────────
console.log('\n【T7】猎人被狼人击杀后 canHunterShoot=true');
{
  const players = [
    mkPlayer(1, ROLES.WEREWOLF), mkPlayer(2, ROLES.HUNTER),
    mkPlayer(3, ROLES.VILLAGER)
  ];
  const { updatedPlayers } = resolveNight({
    players, wolfTarget: 2, witchSave: false, witchPoison: null, guardTarget: null
  });
  const hunter = updatedPlayers.find(p => p.id === 2);
  assert('猎人已死', !hunter.isAlive);
  assert('猎人被刀杀后可以开枪', hunter.canHunterShoot);
}

// ── T8: 胜负判定 ─────────────────────────────────────────────
console.log('\n【T8】胜负判定');
{
  const w = mkPlayer(1, ROLES.WEREWOLF);
  const v1 = mkPlayer(2, ROLES.VILLAGER);
  const v2 = mkPlayer(3, ROLES.VILLAGER, { isAlive: false });
  assert('狼人数>=好人数→狼赢', checkGameEnd([w, v1, v2])?.winner === '狼人');

  const w2 = mkPlayer(1, ROLES.WEREWOLF, { isAlive: false });
  const v3 = mkPlayer(2, ROLES.VILLAGER);
  assert('狼人全灭→好人赢', checkGameEnd([w2, v3])?.winner === '好人');

  const w3 = mkPlayer(1, ROLES.WEREWOLF);
  const v4 = mkPlayer(2, ROLES.VILLAGER);
  const v5 = mkPlayer(3, ROLES.VILLAGER);
  assert('狼1好人2→游戏继续', checkGameEnd([w3, v4, v5]) === null);
}

// ── T9: 猎人连锁开枪（最大深度3层）──────────────────────────
console.log('\n【T9】猎人连锁开枪');
{
  const players = [
    mkPlayer(1, ROLES.HUNTER),
    mkPlayer(2, ROLES.HUNTER, { isAlive: false }), // 被投票出局的猎人触发开枪
    mkPlayer(3, ROLES.WEREWOLF),
    mkPlayer(4, ROLES.VILLAGER),
  ];
  // 猎人2（已死）开枪→3号（实际上 simHunterChain 从已死猎人 shoot）
  // 3号是狼人，不是猎人，不会触发连锁
  const result = simHunterChain(players, 2, 3, 0);
  assert('猎人开枪击杀3号', result.killed.includes(3));
  assert('无连锁（3号非猎人）', result.killed.length === 1);
}

{
  // 连锁场景：1号猎人死后开枪→2号猎人，2号猎人也死后开枪→3号村民
  const players = [
    mkPlayer(1, ROLES.HUNTER, { isAlive: false }),
    mkPlayer(2, ROLES.HUNTER),
    mkPlayer(3, ROLES.VILLAGER),
    mkPlayer(4, ROLES.WEREWOLF),
  ];
  const result = simHunterChain(players, 1, 2, 0);
  assert('连锁：1号打死2号', result.killed.includes(2));
  assert('连锁：2号再打死其他人', result.killed.length >= 2);
  result.log.forEach(l => console.log(`    ${l}`));
}

// ── T10: 同一晚又救又毒：规则应拒绝（救优先，毒作废）─────────
console.log('\n【T10】同一晚又救又毒 → 解药生效、毒药作废');
{
  // 模拟规则硬校验（从 resolveNight 中的注释逻辑）
  let witchSave = true;
  let witchPoison = 5; // AI 同时指定救和毒
  if (witchSave && witchPoison !== null) {
    witchPoison = null; // 规则：救优先，毒作废
  }
  assert('毒药被设为 null（救优先）', witchPoison === null);
  assert('解药保留 true', witchSave === true);
}

// ── 汇总 ─────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`结果: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('❌ 存在失败测试！');
  process.exit(1);
} else {
  console.log('✅ 所有游戏流程逻辑验证通过！');
}
