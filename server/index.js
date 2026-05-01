/**
 * @wolfgame/bt-server — ECS 后端服务
 *
 * 职责：
 *   1. /bt/decide        — 行为树决策（投票、夜间角色行动）
 *   2. /bt/wolf-speech   — 狼人两段式管线（BT 策略 + LLM 润色）
 *   3. /bt/game/start    — 创建游戏记录（版本 + 配置）
 *   4. /bt/game/end      — 写入胜利方
 *   5. /bt/game/speech   — 记录 AI 发言
 *   6. /bt/stats         — 按版本统计胜率
 *   7. /bt/export        — 导出日志供本地分析
 *   8. /health           — 健康检查（含版本号）
 *
 * 启动：
 *   pm2 start ecosystem.config.cjs
 */

import express from 'express';
import cors from 'cors';
import { createRequire } from 'module';

// ── 版本（从 package.json 读取，与 git tag 对应）────────────
const require = createRequire(import.meta.url);
const { version: AI_VERSION } = require('./package.json');

// ── BT 核心 ──────────────────────────────────────────────
import { BehaviorTree } from '../src/services/decisionEngine/core/BehaviorTree.js';
import { buildBlackboard } from '../src/services/decisionEngine/blackboard/buildBlackboard.js';
import { VERSION as BT_VERSION } from '../src/services/decisionEngine/index.js';
import { villagerVoteTree } from '../src/services/decisionEngine/trees/villager/vote.js';
import { werewolfVoteTree } from '../src/services/decisionEngine/trees/werewolf/vote.js';
import { werewolfSpeechTree } from '../src/services/decisionEngine/trees/werewolf/speech.js';
import { guardProtectTree } from '../src/services/decisionEngine/trees/guard/protect.js';
import { seerCheckTree } from '../src/services/decisionEngine/trees/seer/check.js';
import { witchPotionTree } from '../src/services/decisionEngine/trees/witch/potion.js';
import { hunterShootTree } from '../src/services/decisionEngine/trees/hunter/shoot.js';

// ── 润色 prompt ───────────────────────────────────────────
import { buildPolishSystemPrompt, buildPolishUserPrompt } from '../src/services/polishPrompts.js';

// ── 游戏日志 ──────────────────────────────────────────────
import { createGame, logDecision, logSpeech, endGame,
         statsByVersion, exportGames } from './db.js';
import {
  createNovelProject,
  getCodexJob,
  getNovelChapter,
  getNovelProject,
  listNovelProjects,
  resolveNovelWorkspaceRoot,
  startCodexGeneration,
  updateNovelChapter,
  updateNovelMemoryFile,
} from './novelWorkspace.js';
import {
  askWerewolfSession,
  generateWerewolfVisualAsset,
  getWerewolfSessionSnapshot,
  resetWerewolfSession,
} from './werewolfSession.js';

// ── 行为树路由表 ──────────────────────────────────────────
const TREE_REGISTRY = {
  '村民::DAY_VOTE':     villagerVoteTree,
  '狼人::DAY_VOTE':     werewolfVoteTree,
  '守卫::NIGHT_GUARD':  guardProtectTree,
  '预言家::NIGHT_SEER': seerCheckTree,
  '女巫::NIGHT_WITCH':  witchPotionTree,
  '猎人::HUNTER_SHOOT': hunterShootTree,
};

function runBT(player, actionType, gameState, params = {}) {
  const tree = TREE_REGISTRY[`${player.role}::${actionType}`];
  if (!tree) return null;
  const bb = buildBlackboard(gameState, player, params);
  return new BehaviorTree(tree).run(bb);
}

// ── 润色模型池 ────────────────────────────────────────────
const WOLF_POLISH_MODELS = (
  process.env.WOLF_POLISH_MODELS ||
  'Qwen/Qwen3-235B-A22B-Thinking-2507,Qwen/Qwen3-Next-80B-A3B-Thinking,deepseek-ai/DeepSeek-R1-Distill-Qwen-32B'
).split(',').map(s => s.trim());

const OTHER_POLISH_MODELS = (
  process.env.OTHER_POLISH_MODELS ||
  'Qwen/Qwen3-235B-A22B-Instruct-2507,Qwen/Qwen2.5-72B-Instruct,Qwen/Qwen2.5-32B-Instruct'
).split(',').map(s => s.trim());

function pickPolishModel(role) {
  const pool = role === '狼人' ? WOLF_POLISH_MODELS : OTHER_POLISH_MODELS;
  return pool[Math.floor(Math.random() * pool.length)];
}

async function callLLM({ apiKey, apiUrl, model, role, system, user }) {
  const key = apiKey || process.env.MODELSCOPE_API_KEY;
  const url = apiUrl || process.env.MODELSCOPE_API_URL
    || 'https://api-inference.modelscope.cn/v1/chat/completions';
  const mod = model || pickPolishModel(role);

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: mod,
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: user },
      ],
      max_tokens: 400,
      stream: false,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? '';
  const clean = content.replace(/^```json\s*/m, '').replace(/\s*```$/m, '').trim();
  return { parsed: JSON.parse(clean), modelUsed: mod };
}

// ── Express ───────────────────────────────────────────────
const app = express();

app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || 'https://zhaxiaoji.com',
  methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
}));
app.use(express.json({ limit: '2mb' }));

// ── 路由 ─────────────────────────────────────────────────

/** 健康检查（含版本信息） */
app.get('/health', (_, res) => {
  res.json({
    ok: true,
    ai_version: AI_VERSION,
    bt_version: BT_VERSION,
    uptime: process.uptime(),
  });
});

/**
 * POST /bt/decide
 * Body: { player, actionType, gameState, params?, gameId? }
 */
app.post('/bt/decide', (req, res) => {
  try {
    const { player, actionType, gameState, params, gameId } = req.body;
    const bb = buildBlackboard(gameState, player, params ?? {});
    const result = new BehaviorTree(TREE_REGISTRY[`${player.role}::${actionType}`] ?? null)
      .run?.(bb) ?? null;

    // 异步记录（不阻塞响应）
    if (gameId && result) {
      setImmediate(() => {
        try {
          logDecision({
            gameId,
            dayCount:    gameState.dayCount,
            phase:       actionType.startsWith('NIGHT') ? 'night' : 'day',
            playerId:    player.id,
            role:        player.role,
            actionType,
            strategy:    result.strategy ?? actionType,
            targetId:    result.targetId ?? result.decision,
            reasoning:   result.reasoning,
            suspicionMap: bb.state?.suspicion,
            trustMap:    bb.state?.trust,
          });
        } catch (e) {
          console.error('[DB logDecision]', e.message);
        }
      });
    }

    res.json(result ?? null);
  } catch (err) {
    console.error('[BT decide error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /bt/wolf-speech
 * Body: { player, gameState, apiKey?, apiUrl?, model?, gameId? }
 */
app.post('/bt/wolf-speech', async (req, res) => {
  const { player, gameState, apiKey, apiUrl, model, gameId } = req.body;

  const bb = buildBlackboard(gameState, player, {});
  const strategyDecision = new BehaviorTree(werewolfSpeechTree).run(bb);
  if (!strategyDecision) return res.json(null);

  console.log(`[BT Server] ${player.id}号狼人 → 策略: ${strategyDecision.strategy}`);

  try {
    const system = buildPolishSystemPrompt(player, gameState.dayCount);
    const user   = buildPolishUserPrompt(strategyDecision, gameState.players);
    const { parsed: polished, modelUsed } = await callLLM({
      apiKey, apiUrl, model, role: player.role, system, user,
    });

    const result = {
      ...polished,
      thought: polished.thought || `[${strategyDecision.strategy}] ${strategyDecision.reasoning}`,
      _strategy: strategyDecision.strategy,
    };

    // 记录发言
    if (gameId) {
      setImmediate(() => {
        try {
          logSpeech({
            gameId,
            dayCount:      gameState.dayCount,
            playerId:      player.id,
            role:          player.role,
            strategy:      strategyDecision.strategy,
            suspectTarget: strategyDecision.suspectTarget,
            voteTarget:    strategyDecision.voteTarget,
            facts:         strategyDecision.facts,
            speech:        polished.speech,
            modelUsed,
          });
        } catch (e) {
          console.error('[DB logSpeech]', e.message);
        }
      });
    }

    res.json(result);
  } catch (err) {
    console.error('[LLM polish error]', err.message);
    res.status(502).json({ error: err.message, _strategyDecision: strategyDecision });
  }
});

/**
 * POST /bt/game/start
 * 游戏开始时创建记录
 * Body: { gameId, playerCount, wolfCount, config? }
 */
app.post('/bt/game/start', (req, res) => {
  try {
    const { gameId, playerCount, wolfCount, config } = req.body;
    createGame({ id: gameId, aiVersion: AI_VERSION, btVersion: BT_VERSION,
                 playerCount, wolfCount, config });
    res.json({ ok: true, gameId, ai_version: AI_VERSION });
  } catch (err) {
    console.error('[DB createGame]', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /bt/game/end
 * 游戏结束时记录胜利方
 * Body: { gameId, winnerTeam }  winnerTeam: "wolf" | "villager"
 */
app.post('/bt/game/end', (req, res) => {
  try {
    const { gameId, winnerTeam } = req.body;
    endGame({ gameId, winnerTeam });
    console.log(`[BT Server] 游戏 ${gameId} 结束 → ${winnerTeam} 获胜`);
    res.json({ ok: true });
  } catch (err) {
    console.error('[DB endGame]', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /bt/game/speech
 * 记录非狼人的 AI 发言（狼人发言在 /bt/wolf-speech 里自动记录）
 * Body: { gameId, dayCount, playerId, role, speech }
 */
app.post('/bt/game/speech', (req, res) => {
  try {
    const { gameId, dayCount, playerId, role, speech } = req.body;
    logSpeech({ gameId, dayCount, playerId, role, speech });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/bt/session/ask', async (req, res) => {
  try {
    const result = await askWerewolfSession({
      gameSessionId: req.body?.gameSessionId,
      player: req.body?.player,
      actionType: req.body?.actionType,
      systemInstruction: req.body?.systemInstruction,
      prompt: req.body?.prompt,
      gameStateMeta: req.body?.gameStateMeta || {},
      env: process.env,
    });
    res.json({ success: true, result, session: result._sessionInfo });
  } catch (err) {
    console.error('[Werewolf session ask]', err.message);
    res.status(502).json({ success: false, error: err.message });
  }
});

app.post('/bt/session/asset', async (req, res) => {
  try {
    const result = await generateWerewolfVisualAsset({
      gameSessionId: req.body?.gameSessionId,
      assetType: req.body?.assetType,
      visualPrompt: req.body?.visualPrompt,
      player: req.body?.player || null,
      gameMode: req.body?.gameMode,
      aspectRatio: req.body?.aspectRatio,
      env: process.env,
    });
    res.json({ success: true, result, session: result._sessionInfo });
  } catch (err) {
    console.error('[Werewolf session asset]', err.message);
    res.status(502).json({ success: false, error: err.message });
  }
});

app.post('/bt/session/reset', (req, res) => {
  const ok = resetWerewolfSession(req.body?.gameSessionId);
  res.json({ success: true, reset: ok });
});

app.post('/bt/session/status', (req, res) => {
  res.json({
    success: true,
    session: getWerewolfSessionSnapshot(req.body?.gameSessionId),
  });
});

/**
 * GET /bt/stats
 * 按 AI 版本统计胜率（供本地分析脚本调用）
 */
app.get('/bt/stats', (_, res) => {
  try {
    res.json(statsByVersion());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /bt/export?limit=20&version=1.0.0
 * 导出最近 N 局完整日志（BT 路径 + 发言 + 结果）
 */
app.get('/bt/export', (req, res) => {
  try {
    const limit   = Math.min(parseInt(req.query.limit  ?? 20), 100);
    const version = req.query.version ?? null;
    res.json(exportGames(limit, version));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 小说工作台。Cloudflare Worker 会在 /api/novel/* 做鉴权后代理到这里。
app.get('/novel/projects', (req, res) => {
  try {
    const workspaceRoot = resolveNovelWorkspaceRoot();
    res.json({ success: true, projects: listNovelProjects(workspaceRoot) });
  } catch (err) {
    console.error('[Novel projects]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/novel/projects', (req, res) => {
  try {
    const workspaceRoot = resolveNovelWorkspaceRoot();
    const project = createNovelProject(workspaceRoot, req.body || {});
    res.status(201).json({ success: true, project });
  } catch (err) {
    console.error('[Novel create project]', err.message);
    res.status(err.message.includes('already exists') ? 409 : 400).json({ success: false, error: err.message });
  }
});

app.get('/novel/projects/:project/chapters/:chapter', (req, res) => {
  try {
    const workspaceRoot = resolveNovelWorkspaceRoot();
    const chapter = getNovelChapter(workspaceRoot, req.params.project, req.params.chapter);
    res.json({ success: true, chapter });
  } catch (err) {
    console.error('[Novel chapter]', err.message);
    res.status(err.message.includes('not found') ? 404 : 400).json({ success: false, error: err.message });
  }
});

app.patch('/novel/projects/:project/chapters/:chapter', (req, res) => {
  try {
    const workspaceRoot = resolveNovelWorkspaceRoot();
    const chapter = updateNovelChapter(
      workspaceRoot,
      req.params.project,
      req.params.chapter,
      typeof req.body?.content === 'string' ? req.body.content : '',
    );
    res.json({ success: true, chapter });
  } catch (err) {
    console.error('[Novel update chapter]', err.message);
    res.status(err.message.includes('not found') ? 404 : 400).json({ success: false, error: err.message });
  }
});

app.get('/novel/projects/:project', (req, res) => {
  try {
    const workspaceRoot = resolveNovelWorkspaceRoot();
    const project = getNovelProject(workspaceRoot, req.params.project);
    res.json({ success: true, project });
  } catch (err) {
    console.error('[Novel project]', err.message);
    res.status(err.message.includes('not found') ? 404 : 400).json({ success: false, error: err.message });
  }
});

app.patch('/novel/projects/:project/memory', (req, res) => {
  try {
    const workspaceRoot = resolveNovelWorkspaceRoot();
    const file = updateNovelMemoryFile(
      workspaceRoot,
      req.params.project,
      req.body?.path,
      typeof req.body?.content === 'string' ? req.body.content : '',
    );
    res.json({ success: true, file });
  } catch (err) {
    console.error('[Novel update memory]', err.message);
    res.status(err.message.includes('not found') ? 404 : 400).json({ success: false, error: err.message });
  }
});

app.post('/novel/projects/:project/generate', (req, res) => {
  try {
    const workspaceRoot = resolveNovelWorkspaceRoot();
    const job = startCodexGeneration({
      workspaceRoot,
      projectName: req.params.project,
      guidance: typeof req.body?.guidance === 'string' ? req.body.guidance : '',
    });
    res.status(202).json({ success: true, job });
  } catch (err) {
    console.error('[Novel generate]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/novel/jobs/:jobId', (req, res) => {
  const job = getCodexJob(req.params.jobId);
  if (!job) {
    res.status(404).json({ success: false, error: 'Job not found' });
    return;
  }
  res.json({ success: true, job });
});

// ── 启动 ─────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[BT Server v${AI_VERSION}] 监听端口 :${PORT}`);
  console.log(`[BT Server] BT引擎版本: ${BT_VERSION}`);
  console.log(`[BT Server] 允许来源: ${process.env.ALLOWED_ORIGIN || 'https://zhaxiaoji.com'}`);
});
