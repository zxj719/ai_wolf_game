/**
 * @wolfgame/bt-server — ECS 后端服务
 *
 * 职责：
 *   1. /bt/decide      — 行为树决策（投票、夜间角色行动）
 *   2. /bt/wolf-speech — 狼人两段式管线（BT 策略 + LLM 润色），一次调用完成
 *   3. /health         — 健康检查
 *
 * 服务端直接导入 BT 树节点，跳过 IS_HYBRID feature flag，
 * 因为这台服务器本身就是 BT 执行层。
 *
 * 启动：
 *   AI_MODE=hybrid PORT=3001 node server/index.js
 *   # 或通过 PM2: pm2 start ecosystem.config.cjs
 */

import express from 'express';
import cors from 'cors';

// ── BT 核心 ──────────────────────────────────────────────
import { BehaviorTree } from '../src/services/decisionEngine/core/BehaviorTree.js';
import { buildBlackboard } from '../src/services/decisionEngine/blackboard/buildBlackboard.js';
import { villagerVoteTree } from '../src/services/decisionEngine/trees/villager/vote.js';
import { werewolfVoteTree } from '../src/services/decisionEngine/trees/werewolf/vote.js';
import { werewolfSpeechTree } from '../src/services/decisionEngine/trees/werewolf/speech.js';
import { guardProtectTree } from '../src/services/decisionEngine/trees/guard/protect.js';
import { seerCheckTree } from '../src/services/decisionEngine/trees/seer/check.js';
import { witchPotionTree } from '../src/services/decisionEngine/trees/witch/potion.js';
import { hunterShootTree } from '../src/services/decisionEngine/trees/hunter/shoot.js';

// ── 润色 prompt ───────────────────────────────────────────
import { buildPolishSystemPrompt, buildPolishUserPrompt } from '../src/services/polishPrompts.js';

// ── 行为树路由表（服务端无 IS_HYBRID 门控，永远执行）─────
const TREE_REGISTRY = {
  '村民::DAY_VOTE':    villagerVoteTree,
  '狼人::DAY_VOTE':    werewolfVoteTree,
  '守卫::NIGHT_GUARD': guardProtectTree,
  '预言家::NIGHT_SEER': seerCheckTree,
  '女巫::NIGHT_WITCH': witchPotionTree,
  '猎人::HUNTER_SHOOT': hunterShootTree,
};

/**
 * 运行行为树并返回决策结果
 */
function runBT(player, actionType, gameState, params = {}) {
  const tree = TREE_REGISTRY[`${player.role}::${actionType}`];
  if (!tree) return null;
  const bb = buildBlackboard(gameState, player, params);
  return new BehaviorTree(tree).run(bb);
}

// ── 角色→润色模型池（与前端 aiConfig.js 保持同步）────────
// 狼人用思维链大模型，其他角色用快速 Instruct
const WOLF_POLISH_MODELS = (
  process.env.WOLF_POLISH_MODELS ||
  'Qwen/Qwen3-235B-A22B-Thinking-2507,Qwen/Qwen3-Next-80B-A3B-Thinking,deepseek-ai/DeepSeek-R1-Distill-Qwen-32B'
).split(',').map(s => s.trim());

const OTHER_POLISH_MODELS = (
  process.env.OTHER_POLISH_MODELS ||
  'Qwen/Qwen3-235B-A22B-Instruct-2507,Qwen/Qwen2.5-72B-Instruct,Qwen/Qwen2.5-32B-Instruct'
).split(',').map(s => s.trim());

/**
 * 根据玩家角色随机选润色模型，逻辑与前端 getPolishPool() 对齐
 */
function pickPolishModel(role) {
  const pool = role === '狼人' ? WOLF_POLISH_MODELS : OTHER_POLISH_MODELS;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * 调用 ModelScope（或兼容 OpenAI 格式的接口）
 * apiKey 优先使用 body 传入的用户 token，回退到环境变量
 * model 由 pickPolishModel(role) 决定，body 中传入的 model 仅作紧急覆盖
 */
async function callLLM({ apiKey, apiUrl, model, role, system, user }) {
  const key = apiKey || process.env.MODELSCOPE_API_KEY;
  const url = apiUrl || process.env.MODELSCOPE_API_URL
    || 'https://api-inference.modelscope.cn/v1/chat/completions';
  // 优先级：请求方强制指定 > 角色对应模型池随机选
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
  // 去掉可能的 markdown 代码块包裹
  const clean = content.replace(/^```json\s*/m, '').replace(/\s*```$/m, '').trim();
  return JSON.parse(clean);
}

// ── Express ───────────────────────────────────────────────
const app = express();

app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || 'https://zhaxiaoji.com',
  methods: ['GET', 'POST', 'OPTIONS'],
}));
app.use(express.json({ limit: '2mb' }));

// ── 路由 ─────────────────────────────────────────────────

/** 健康检查 */
app.get('/health', (_, res) => {
  res.json({ ok: true, version: '1.0.0', uptime: process.uptime() });
});

/**
 * POST /bt/decide
 * Body: { player, actionType, gameState, params? }
 * 返回: 决策结果对象 或 null
 */
app.post('/bt/decide', (req, res) => {
  try {
    const { player, actionType, gameState, params } = req.body;
    const result = runBT(player, actionType, gameState, params ?? {});
    res.json(result ?? null);
  } catch (err) {
    console.error('[BT decide error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /bt/wolf-speech
 * 狼人两段式管线（BT 策略 + LLM 润色）全部在服务端完成
 * Body: { player, gameState, apiKey?, apiUrl?, model? }
 * 返回: { speech, voteIntention, thought, identity_table, _strategy } 或 null
 */
app.post('/bt/wolf-speech', async (req, res) => {
  const { player, gameState, apiKey, apiUrl, model } = req.body;

  // Stage 1: BT 决策策略（<1ms）
  const bb = buildBlackboard(gameState, player, {});
  const strategyDecision = new BehaviorTree(werewolfSpeechTree).run(bb);

  if (!strategyDecision) {
    return res.json(null);
  }

  console.log(
    `[BT Server] ${player.id}号狼人 → 策略: ${strategyDecision.strategy}`,
  );

  // Stage 2: LLM 润色
  try {
    const system = buildPolishSystemPrompt(player, gameState.dayCount);
    const user   = buildPolishUserPrompt(strategyDecision, gameState.players);
    const polished = await callLLM({ apiKey, apiUrl, model, role: player.role, system, user });

    res.json({
      ...polished,
      thought: polished.thought || `[${strategyDecision.strategy}] ${strategyDecision.reasoning}`,
      _strategy: strategyDecision.strategy,
    });
  } catch (err) {
    console.error('[LLM polish error]', err.message);
    // 润色失败时返回 BT 策略信息，让客户端降级处理
    res.status(502).json({
      error: err.message,
      _strategyDecision: strategyDecision,
    });
  }
});

// ── 启动 ─────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[BT Server] 监听端口 :${PORT}`);
  console.log(`[BT Server] 允许来源: ${process.env.ALLOWED_ORIGIN || 'https://zhaxiaoji.com'}`);
});
