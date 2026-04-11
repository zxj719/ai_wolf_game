/**
 * headlessGame.mjs — Node-side headless werewolf game driver
 *
 * Purpose: generate real game logs without the React app, so the
 * self-evolution pipeline (reviewPipeline.mjs) has something to chew on.
 *
 * Output: writes a game log JSON directly into src/knowledge/pending/
 *         so the next `node reviewPipeline.mjs --local` picks it up.
 *
 * PHASE 1 SCOPE (intentionally minimal — see TODO below)
 * ------------------------------------------------------
 *   - 6-player mini game: 2狼人 1预言家 1女巫 2村民
 *   - No 守卫/猎人/骑士/魔术师/摄梦人
 *   - No 警徽流 / 发警长 / 发查杀连锁
 *   - Night actions: wolf kill -> seer check -> witch save/poison
 *   - Day: each alive player speaks (1 sentence via LLM), then votes via LLM
 *   - Win condition: 屠边 — all wolves dead = good wins;
 *                    wolves >= (villagers + gods) = wolf wins
 *
 * TODO (Phase 2): wire prompts to src/services/promptFactory.js instead of
 *   using the inline BOOTSTRAP prompts below. Blocked on a one-shot refactor
 *   that adds explicit `.js` extensions to src/services/rolePrompts/**
 *   imports — Node ESM does not resolve directory or extensionless imports,
 *   while Vite does. When that's done, replace callRoleLLM's system-prompt
 *   builder with `buildProgressiveSystemPrompt(player, gameState, opts)`.
 *
 * Usage:
 *   node src/agents/headlessGame.mjs                  # run one game, queue it
 *   node src/agents/headlessGame.mjs --games=3        # run 3 games
 *   node src/agents/headlessGame.mjs --no-queue       # print game log to stdout only
 *   node src/agents/headlessGame.mjs --max-days=10    # cap at 10 day/night cycles
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { callLLM, getApiConfig } from './shared/llm.mjs';
import { withRetry } from './shared/validation.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PENDING_DIR = join(__dirname, '../knowledge/pending');

// ── CLI args ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const NUM_GAMES = Number(args.find(a => a.startsWith('--games='))?.slice('--games='.length) || 1);
const MAX_DAYS = Number(args.find(a => a.startsWith('--max-days='))?.slice('--max-days='.length) || 8);
const NO_QUEUE = args.includes('--no-queue');
const VERBOSE = args.includes('--verbose');

// ── Game config ────────────────────────────────────────────────────────────

const NAMES = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank', 'Grace', 'Henry', 'Ivy'];
const MINI_ROSTER = ['狼人', '狼人', '预言家', '女巫', '村民', '村民'];

// ── Inline BOOTSTRAP prompts (Phase 1 only; see TODO above) ────────────────

const PERSONA = {
  '狼人': `你是狼人，目标：伪装成好人、投出好人、熬到最后。说谎时保持逻辑自洽，不要自相矛盾。`,
  '预言家': `你是预言家，目标：查验身份、引导好人投狼。你查验过的结果是神圣的，发言时可以提到。`,
  '女巫': `你是女巫，目标：用解药救关键好人、用毒药毒狼。两瓶药一整局各一次，首夜不建议救自己。`,
  '村民': `你是村民，目标：靠逻辑分析找出狼人。敢于站边、质疑，不要划水。`
};

function buildSystemPrompt(player, state) {
  const { dayCount } = state;
  const aliveList = state.players.filter(p => p.isAlive).map(p => `[${p.id}]${p.name}`).join(', ');
  const deadList = state.players.filter(p => !p.isAlive).map(p => `[${p.id}]${p.name}(${p.role})`).join(', ') || '无';

  const parts = [
    `你是 [${player.id}号] ${player.name}，身份【${player.role}】。`,
    PERSONA[player.role] || PERSONA['村民'],
    `【游戏状态】第${dayCount}天 | 存活：${aliveList} | 已死亡：${deadList}`
  ];

  // Private role info
  if (player.role === '狼人') {
    const teammates = state.players.filter(p => p.role === '狼人' && p.id !== player.id && p.isAlive).map(p => `[${p.id}]${p.name}`);
    parts.push(`【狼队】${teammates.length ? teammates.join(', ') : '你是孤狼'}`);
  } else if (player.role === '预言家') {
    const checks = state.seerChecks.filter(c => c.seerId === player.id);
    if (checks.length) {
      parts.push(`【查验记录】${checks.map(c => `N${c.night}:[${c.targetId}]${c.isWolf ? '狼人' : '好人'}`).join(', ')}`);
    }
  } else if (player.role === '女巫') {
    parts.push(`【药水】解药:${player.hasWitchSave ? '有' : '已用'} | 毒药:${player.hasWitchPoison ? '有' : '已用'}`);
  }

  return parts.join('\n');
}

function buildActionPrompt(actionType, player, state, extra = {}) {
  const alive = state.players.filter(p => p.isAlive && p.id !== player.id);
  const aliveIds = alive.map(p => p.id).join(',');

  switch (actionType) {
    case 'NIGHT_WOLF_KILL':
      return `现在是第${state.dayCount}晚，狼人行动。
可选目标 ID: ${aliveIds}
输出 JSON：{"target": <玩家ID>, "reason": "<一句话原因>"}`;

    case 'NIGHT_SEER_CHECK':
      return `现在是第${state.dayCount}晚，你要查验一个玩家身份。
可选目标 ID: ${aliveIds}
输出 JSON：{"target": <玩家ID>, "reason": "<一句话原因>"}`;

    case 'NIGHT_WITCH':
      return `现在是第${state.dayCount}晚，刚被狼人袭击的是 [${extra.killedId}] (若无则为 null)。
解药：${player.hasWitchSave ? '有' : '已用'}；毒药：${player.hasWitchPoison ? '有' : '已用'}
可毒目标 ID: ${aliveIds}
输出 JSON：{"save": <true|false>, "poison": <玩家ID 或 null>, "reason": "<一句话原因>"}`;

    case 'DAY_SPEECH': {
      const recent = state.speechHistory.slice(-6).map(s =>
        `第${s.day}天 ${s.playerName}(${s.role ?? '?'}): ${s.content}`
      ).join('\n') || '(本局第一次发言)';
      return `现在是第${state.dayCount}天白天讨论。
【最近发言】
${recent}
请发表你的看法（<=80 字，不要暴露不属于你的私密信息）。
输出 JSON：{"speech": "<你的发言>"}`;
    }

    case 'DAY_VOTE': {
      const speeches = state.speechHistory.filter(s => s.day === state.dayCount).map(s =>
        `[${s.playerId}]${s.playerName}: ${s.content}`
      ).join('\n') || '(无发言)';
      return `现在是第${state.dayCount}天投票阶段。
【今日发言回顾】
${speeches}
可投目标 ID: ${aliveIds}
输出 JSON：{"target": <玩家ID>, "reason": "<一句话原因>"}`;
    }

    default:
      return '输出 JSON：{"action": "pass"}';
  }
}

// ── LLM helpers ────────────────────────────────────────────────────────────

function parseJson(raw) {
  if (raw == null || raw === '') {
    throw new Error('Empty LLM content');
  }
  const trimmed = String(raw).trim();

  // Fast path: whole thing is JSON.
  try { return JSON.parse(trimmed); } catch { /* fall through */ }

  // Strip fenced ```json blocks.
  const fenced = trimmed.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  try { return JSON.parse(fenced); } catch { /* fall through */ }

  // Balance-count all top-level {...} blocks; try them from last to first.
  // Handles thinking-model output where the real JSON is buried at the end
  // after a long reasoning preface that may itself contain stray braces.
  const blocks = [];
  for (let i = 0; i < fenced.length; i++) {
    if (fenced[i] !== '{') continue;
    let depth = 0, inStr = false, esc = false;
    for (let j = i; j < fenced.length; j++) {
      const c = fenced[j];
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) {
          blocks.push(fenced.slice(i, j + 1));
          i = j; // skip ahead past this block
          break;
        }
      }
    }
  }
  for (let k = blocks.length - 1; k >= 0; k--) {
    try { return JSON.parse(blocks[k]); } catch { /* try next */ }
  }
  throw new Error(`Could not parse JSON from: ${trimmed.slice(0, 120)}`);
}

async function callRoleLLM(actionType, player, state, apiConfig, extra = {}) {
  const systemMsg = buildSystemPrompt(player, state);
  const userMsg = buildActionPrompt(actionType, player, state, extra);

  const { content } = await withRetry(
    () => callLLM({
      ...apiConfig,
      systemMsg,
      userMsg,
      options: {
        temperature: 0.8,
        // Force strict JSON output — supported by ModelScope for most chat models.
        response_format: { type: 'json_object' }
      }
    }),
    3, 1500
  );

  if (VERBOSE) console.log(`  [LLM raw ${player.name}/${actionType}] ${content.slice(0, 120).replace(/\n/g, ' ')}`);
  return parseJson(content);
}

// ── Game loop ──────────────────────────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildInitialState(roster) {
  const roles = shuffle(roster);
  const names = shuffle(NAMES).slice(0, roster.length);
  const players = roles.map((role, i) => ({
    id: i,
    name: names[i],
    role,
    isAlive: true,
    hasWitchSave: role === '女巫',
    hasWitchPoison: role === '女巫'
  }));

  return {
    gameSessionId: `auto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    dayCount: 1,
    players,
    speechHistory: [],
    voteHistory: [],
    deathHistory: [],
    nightActionHistory: [],
    seerChecks: [],
    startedAt: new Date().toISOString()
  };
}

function logAction(state, night, type, playerId, description) {
  state.nightActionHistory.push({ night, type, playerId, description });
}

async function nightPhase(state, apiConfig) {
  const night = state.dayCount;
  if (VERBOSE) console.log(`\n── N${night} ──`);

  // 1. 狼人刀
  const wolves = state.players.filter(p => p.isAlive && p.role === '狼人');
  let killedId = null;
  if (wolves.length) {
    const decider = wolves[0]; // simplification: first wolf decides for the pack
    try {
      const act = await callRoleLLM('NIGHT_WOLF_KILL', decider, state, apiConfig);
      const target = Number(act.target);
      const valid = state.players.find(p => p.id === target && p.isAlive && p.role !== '狼人');
      if (valid) {
        killedId = target;
        logAction(state, night, 'wolf_kill', decider.id, `狼队刀[${target}]${valid.name}，理由：${act.reason ?? '无'}`);
      } else {
        logAction(state, night, 'wolf_kill', decider.id, `狼队刀无效目标(${act.target})`);
      }
    } catch (err) {
      logAction(state, night, 'wolf_kill', decider.id, `狼队决策失败：${err.message}`);
    }
  }

  // 2. 预言家查
  const seer = state.players.find(p => p.isAlive && p.role === '预言家');
  if (seer) {
    try {
      const act = await callRoleLLM('NIGHT_SEER_CHECK', seer, state, apiConfig);
      const target = Number(act.target);
      const valid = state.players.find(p => p.id === target && p.isAlive && p.id !== seer.id);
      if (valid) {
        const isWolf = valid.role === '狼人';
        state.seerChecks.push({ seerId: seer.id, night, targetId: target, isWolf });
        logAction(state, night, 'seer_check', seer.id, `预言家查[${target}]${valid.name}=${isWolf ? '狼人' : '好人'}`);
      } else {
        logAction(state, night, 'seer_check', seer.id, `预言家查无效目标(${act.target})`);
      }
    } catch (err) {
      logAction(state, night, 'seer_check', seer.id, `预言家决策失败：${err.message}`);
    }
  }

  // 3. 女巫救/毒
  const witch = state.players.find(p => p.isAlive && p.role === '女巫');
  let witchSaved = false;
  let witchPoisonId = null;
  if (witch) {
    try {
      const act = await callRoleLLM('NIGHT_WITCH', witch, state, apiConfig, { killedId });
      if (act.save === true && witch.hasWitchSave && killedId !== null) {
        witchSaved = true;
        witch.hasWitchSave = false;
        logAction(state, night, 'witch_save', witch.id, `女巫救[${killedId}]`);
      }
      if (act.poison !== null && act.poison !== undefined && witch.hasWitchPoison) {
        const target = Number(act.poison);
        const valid = state.players.find(p => p.id === target && p.isAlive && p.id !== witch.id);
        if (valid) {
          witchPoisonId = target;
          witch.hasWitchPoison = false;
          logAction(state, night, 'witch_poison', witch.id, `女巫毒[${target}]${valid.name}`);
        }
      }
    } catch (err) {
      logAction(state, night, 'witch_action', witch.id, `女巫决策失败：${err.message}`);
    }
  }

  // 4. Resolve deaths
  const deaths = [];
  if (killedId !== null && !witchSaved) deaths.push({ id: killedId, cause: 'wolf_kill' });
  if (witchPoisonId !== null) deaths.push({ id: witchPoisonId, cause: 'witch_poison' });

  for (const d of deaths) {
    const p = state.players.find(pl => pl.id === d.id);
    if (p && p.isAlive) {
      p.isAlive = false;
      state.deathHistory.push({ day: night, playerId: d.id, playerName: p.name, role: p.role, cause: d.cause });
      if (VERBOSE) console.log(`  [dead] [${d.id}]${p.name} (${p.role}) by ${d.cause}`);
    }
  }

  if (deaths.length === 0) {
    state.deathHistory.push({ day: night, playerId: null, playerName: null, role: null, cause: 'peaceful' });
    if (VERBOSE) console.log(`  平安夜`);
  }
}

async function dayPhase(state, apiConfig) {
  const day = state.dayCount;
  if (VERBOSE) console.log(`\n── D${day} ──`);

  const alive = state.players.filter(p => p.isAlive);

  // Speeches
  for (const p of alive) {
    try {
      const act = await callRoleLLM('DAY_SPEECH', p, state, apiConfig);
      const speech = (act.speech || '').toString().slice(0, 150);
      state.speechHistory.push({
        day, playerId: p.id, playerName: p.name, role: p.role, content: speech
      });
      if (VERBOSE) console.log(`  [${p.id}]${p.name}(${p.role}): ${speech.slice(0, 60)}`);
    } catch (err) {
      state.speechHistory.push({
        day, playerId: p.id, playerName: p.name, role: p.role, content: `(发言失败: ${err.message})`
      });
    }
  }

  // Votes
  const votes = {};
  for (const p of alive) {
    try {
      const act = await callRoleLLM('DAY_VOTE', p, state, apiConfig);
      const target = Number(act.target);
      const valid = state.players.find(pl => pl.id === target && pl.isAlive && pl.id !== p.id);
      if (valid) {
        votes[p.id] = { target, reason: act.reason || '' };
      } else {
        votes[p.id] = { target: null, reason: 'invalid target' };
      }
    } catch (err) {
      votes[p.id] = { target: null, reason: `vote failed: ${err.message}` };
    }
  }

  // Tally
  const tally = {};
  for (const v of Object.values(votes)) {
    if (v.target !== null) tally[v.target] = (tally[v.target] || 0) + 1;
  }
  const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  let eliminatedId = null;
  if (sorted.length && sorted[0][1] > 0) {
    // Handle tie: pick lowest id among tied — keeps game deterministic-ish
    const topCount = sorted[0][1];
    const tied = sorted.filter(([, c]) => c === topCount).map(([id]) => Number(id));
    eliminatedId = Math.min(...tied);
  }

  state.voteHistory.push({ day, votes, tally, eliminatedId });

  if (eliminatedId !== null) {
    const p = state.players.find(pl => pl.id === eliminatedId);
    if (p) {
      p.isAlive = false;
      state.deathHistory.push({ day, playerId: p.id, playerName: p.name, role: p.role, cause: 'voted_out' });
      if (VERBOSE) console.log(`  voted out: [${p.id}]${p.name}(${p.role})`);
    }
  }
}

function checkWin(state) {
  const aliveWolves = state.players.filter(p => p.isAlive && p.role === '狼人').length;
  const aliveGood = state.players.filter(p => p.isAlive && p.role !== '狼人').length;
  const aliveGods = state.players.filter(p => p.isAlive && (p.role === '预言家' || p.role === '女巫')).length;
  const aliveVillagers = state.players.filter(p => p.isAlive && p.role === '村民').length;

  if (aliveWolves === 0) return 'good';
  // 屠边: 神职全灭 或 村民全灭
  if (aliveGods === 0 || aliveVillagers === 0) return 'wolf';
  // 狼数 >= 好人数 也算狼胜
  if (aliveWolves >= aliveGood) return 'wolf';
  return null;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function runOneGame(apiConfig) {
  const state = buildInitialState(MINI_ROSTER);
  console.log(`[headless] game ${state.gameSessionId} starting (${MINI_ROSTER.length} players)`);

  let winner = null;
  for (let d = 1; d <= MAX_DAYS; d++) {
    state.dayCount = d;
    await nightPhase(state, apiConfig);
    winner = checkWin(state);
    if (winner) break;

    await dayPhase(state, apiConfig);
    winner = checkWin(state);
    if (winner) break;
  }

  state.winner = winner || 'timeout';
  state.endedAt = new Date().toISOString();

  console.log(`[headless] game ${state.gameSessionId} ended: ${state.winner} (after day ${state.dayCount})`);
  console.log(`  speeches: ${state.speechHistory.length}, votes rounds: ${state.voteHistory.length}, deaths: ${state.deathHistory.filter(d => d.playerId !== null).length}`);

  if (!NO_QUEUE) {
    mkdirSync(PENDING_DIR, { recursive: true });
    const key = `local:${Date.now()}:${state.gameSessionId}`;
    const outPath = join(PENDING_DIR, `${key}.json`);
    writeFileSync(outPath, JSON.stringify({ key, ...state }, null, 2), 'utf8');
    console.log(`  queued: ${outPath}`);
  } else {
    console.log('\n--- GAME LOG ---');
    console.log(JSON.stringify(state, null, 2));
  }

  return state;
}

async function main() {
  const apiConfig = getApiConfig();
  if (!apiConfig.apiKey) {
    console.error('[headless] No API key found. Set VITE_SILICONFLOW_API_KEY or VITE_API_KEY in .env');
    process.exit(1);
  }
  console.log(`[headless] model=${apiConfig.model} games=${NUM_GAMES} max_days=${MAX_DAYS}`);

  for (let g = 0; g < NUM_GAMES; g++) {
    try {
      await runOneGame(apiConfig);
    } catch (err) {
      console.error(`[headless] game ${g + 1} failed: ${err.message}`);
    }
  }
}

main().catch(err => {
  console.error('[headless] fatal:', err);
  process.exit(1);
});
