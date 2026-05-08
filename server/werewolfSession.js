import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  CONTRACT_VERSION,
  CAPABILITY_MODE,
  isSupportedAction,
  getContract,
  buildCapabilities,
  buildMemoryView,
  composePrompt,
  runWithRepair,
} from './werewolfAgent/index.js';

const DEFAULT_MODEL = 'MiniMax-M2.7';
const DEFAULT_MINIMAX_URL = 'https://api.minimaxi.com/anthropic/v1/messages';
const DEFAULT_MINIMAX_BASE_URL = 'https://api.minimaxi.com/anthropic';
const DEFAULT_PROVIDER = 'claude-code';
const DEFAULT_CLAUDE_ARGS = '--print --output-format json';
const MAX_SESSION_TURNS = 80;
const MAX_AGENT_MEMORY = 30;

const sessions = new Map();

function safeParseJSON(text) {
  if (!text) return null;
  const trimmed = String(text).replace(/```json\n?|\n?```/g, '').trim();
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) return null;

  const jsonString = trimmed.slice(first, last + 1);
  try {
    return JSON.parse(jsonString);
  } catch {
    try {
      const repaired = jsonString.replace(/([\u4e00-\u9fa5])"([\u4e00-\u9fa5])/g, '$1\\"$2');
      return JSON.parse(repaired);
    } catch {
      return null;
    }
  }
}

function parseWholeJSON(text) {
  try {
    return JSON.parse(String(text || '').trim());
  } catch {
    return null;
  }
}

function compact(value, limit = 1200) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function modelDisplayName(response) {
  return response?.provider === 'claude-code-minimax-codingplan'
    ? `Server Claude Code · ${response.model}`
    : response?.model;
}

function splitCommandArgs(value) {
  const args = [];
  let current = '';
  let quote = null;
  let escaping = false;

  for (const char of String(value || '')) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }
    if (char === '\\') {
      escaping = true;
      continue;
    }
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        args.push(current);
        current = '';
      }
      continue;
    }
    current += char;
  }

  if (current) args.push(current);
  return args;
}

function hasArg(args, name) {
  return args.some((arg) => arg === name || arg.startsWith(`${name}=`));
}

function isAnthropicEndpoint(url) {
  return /\/anthropic\/v\d+\/messages/.test(String(url || ''));
}

function sanitizePathPart(value) {
  return String(value || 'session').replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 120);
}

function getSession(gameSessionId) {
  const id = String(gameSessionId || '').trim();
  if (!id) throw new Error('gameSessionId is required');
  if (!sessions.has(id)) {
    sessions.set(id, {
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      publicTurns: [],
      agentMemories: new Map(),
      claudeSessionId: null,
      claudeSessionIds: new Map(),
      runtime: null,
    });
  }
  return sessions.get(id);
}

/**
 * Fail-fast provider sanity check, run at server boot.
 *
 * Returns { ok, provider, hasToken, warning }. Caller (server/index.js) is
 * expected to print `warning` LOUDLY when ok=false. We do not crash the
 * process: /health, /bt/decide, /bt/session/asset (deterministic SVG) and
 * the BT decision routes all keep working without a token. Only
 * /bt/session/ask needs the LLM. This way a misconfigured ECS still serves
 * everything else and the missing-token signal shows up in `pm2 logs`
 * within seconds rather than hidden behind the 90 s spawn timeout.
 */
export function checkProviderConfig(env = process.env) {
  const provider = (env.WEREWOLF_SESSION_PROVIDER || env.WEREWOLF_AI_RUNTIME || DEFAULT_PROVIDER)
    .trim()
    .toLowerCase();
  const tokenSources = [
    'ANTHROPIC_AUTH_TOKEN',
    'ANTHROPIC_API_KEY',
    'MINIMAX_API_KEY',
    'WEREWOLF_SESSION_API_KEY',
  ];
  const presentSource = tokenSources.find((k) => typeof env[k] === 'string' && env[k].length > 0) || null;
  const hasToken = Boolean(presentSource);
  return {
    provider,
    hasToken,
    presentSource,
    ok: hasToken,
    warning: hasToken
      ? null
      : `[werewolfSession] FATAL: provider="${provider}" requires one of [${tokenSources.join(', ')}] in env, but none are set. /bt/session/ask will time out at ${env.WEREWOLF_SESSION_TIMEOUT_MS || '90000'}ms with "Claude Code timed out" until configured.`,
  };
}

function getProviderConfig(env = process.env) {
  const provider = (env.WEREWOLF_SESSION_PROVIDER || env.WEREWOLF_AI_RUNTIME || DEFAULT_PROVIDER)
    .trim()
    .toLowerCase();
  const model = env.WEREWOLF_SESSION_MODEL
    || env.CLAUDE_CODE_MODEL
    || env.ANTHROPIC_MODEL
    || env.MINIMAX_MODEL
    || DEFAULT_MODEL;
  const claudeArgs = splitCommandArgs(env.CLAUDE_CODE_ARGS || DEFAULT_CLAUDE_ARGS);
  if (model && !hasArg(claudeArgs, '--model')) {
    claudeArgs.push('--model', model);
  }

  const timeoutMs = Number.parseInt(env.WEREWOLF_SESSION_TIMEOUT_MS || '90000', 10);
  return {
    provider,
    model,
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 90000,
    apiUrl: env.WEREWOLF_SESSION_API_URL
      || env.MINIMAX_API_URL
      || env.ANTHROPIC_API_URL
      || DEFAULT_MINIMAX_URL,
    apiKey: env.WEREWOLF_SESSION_API_KEY
      || env.MINIMAX_API_KEY
      || env.ANTHROPIC_API_KEY
      || env.ANTHROPIC_AUTH_TOKEN
      || '',
    claudeCodeBin: env.CLAUDE_CODE_BIN || 'claude',
    claudeArgs,
    claudeResume: env.CLAUDE_CODE_RESUME !== 'false',
    claudeSessionRoot: env.CLAUDE_CODE_SESSION_ROOT
      || path.join(os.tmpdir(), 'wolfgame-claude-sessions'),
    anthropicBaseUrl: env.ANTHROPIC_BASE_URL
      || env.MINIMAX_ANTHROPIC_BASE_URL
      || DEFAULT_MINIMAX_BASE_URL,
    anthropicAuthToken: env.ANTHROPIC_AUTH_TOKEN
      || env.ANTHROPIC_API_KEY
      || env.MINIMAX_API_KEY
      || env.WEREWOLF_SESSION_API_KEY
      || '',
  };
}

function buildSessionContext({ session, player, actionType, gameStateMeta }) {
  const publicTurns = session.publicTurns
    .slice(-MAX_SESSION_TURNS)
    .map((turn, index) => `${index + 1}. D${turn.day ?? '?'} ${turn.phase || ''} P${turn.playerId} ${turn.actionType}: ${turn.summary}`)
    .join('\n');

  const agentMemory = (session.agentMemories.get(String(player.id)) || [])
    .slice(-MAX_AGENT_MEMORY)
    .map((turn, index) => `${index + 1}. ${turn.actionType}: ${turn.privateSummary || turn.summary}`)
    .join('\n');

  return [
    'Single-match multi-agent session context:',
    `- Game session: ${session.id}`,
    `- Current agent: player ${player.id}, role ${player.role}, action ${actionType}`,
    `- Day: ${gameStateMeta?.dayCount ?? '?'}, phase: ${gameStateMeta?.phase || 'unknown'}`,
    '- Treat every AI player as a separate agent in the same match.',
    '- Keep role secrets. Do not give this agent private memories from other agents.',
    '- Use the current system prompt as the only source of private role information.',
    '',
    'Public match transcript:',
    publicTurns || '(none yet)',
    '',
    `Private memory for player ${player.id}:`,
    agentMemory || '(none yet)',
  ].join('\n');
}

function buildAnthropicPayload({ model, system, user }) {
  return {
    model,
    system,
    messages: [{ role: 'user', content: user }],
    max_tokens: 4096,
    temperature: 0.7,
    top_p: 0.95,
  };
}

function buildOpenAIPayload({ model, system, user }) {
  return {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.7,
    top_p: 0.95,
    stream: false,
  };
}

function extractText(data, anthropic) {
  if (anthropic) {
    return (Array.isArray(data?.content) ? data.content : [])
      .filter((block) => block?.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text)
      .join('\n');
  }
  return data?.choices?.[0]?.message?.content || '';
}

async function callDirectModel({ system, user, config }) {
  if (!config.apiKey) {
    throw new Error('Werewolf session AI key is not configured');
  }

  const anthropic = isAnthropicEndpoint(config.apiUrl);
  const payload = anthropic
    ? buildAnthropicPayload({ model: config.model, system, user })
    : buildOpenAIPayload({ model: config.model, system, user });

  const response = await fetch(config.apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Werewolf session AI ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  return {
    text: extractText(data, anthropic),
    model: config.model,
    provider: anthropic ? 'minimax-anthropic-api' : 'openai-compatible-api',
    runtimeSessionId: null,
  };
}

function buildClaudePrompt({ system, user, gameAction = false }) {
  const header = gameAction
    ? [
      'You are being invoked by an HTTP game server as a non-interactive Claude Code runtime.',
      'Live-game constraints (mandatory):',
      '  - No filesystem, no shell, no network, no tools, no MCP, no follow-up questions.',
      '  - No cross-player memory: only this prompt is your context.',
      '  - JSON only: stdout must be exactly one JSON object that satisfies the OUTPUT SCHEMA.',
      '  - Do not include markdown fences, explanations, trace output, system text, or the user prompt in the final result.',
    ].join('\n')
    : [
      'You are being invoked by an HTTP game server as a non-interactive Claude Code runtime.',
      'Do not edit files, do not run tools, and do not ask follow-up questions.',
      'Think privately if needed, but the final stdout result must contain exactly one JSON object for the game engine.',
      'Do not include markdown fences, explanations, trace output, system text, or the user prompt in the final result.',
    ].join('\n');

  return [
    header,
    '',
    'SYSTEM INSTRUCTIONS:',
    system,
    '',
    'ACTION REQUEST:',
    user,
  ].join('\n');
}

function buildClaudeEnv(baseEnv, config) {
  const merged = {
    ...process.env,
    ...baseEnv,
    ANTHROPIC_BASE_URL: config.anthropicBaseUrl,
    ANTHROPIC_MODEL: config.model,
  };

  if (config.anthropicAuthToken) {
    merged.ANTHROPIC_AUTH_TOKEN = config.anthropicAuthToken;
    merged.ANTHROPIC_API_KEY = config.anthropicAuthToken;
  }

  return Object.fromEntries(
    Object.entries(merged)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, String(value)]),
  );
}

function collectProcess({ child, prompt, timeoutMs }) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      finish(reject, new Error(`Claude Code timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (err) => finish(reject, err));
    child.on('close', (code) => {
      if (code === 0) {
        finish(resolve, { stdout, stderr });
        return;
      }
      finish(reject, new Error(`Claude Code exited ${code}: ${compact(stderr || stdout, 900)}`));
    });

    child.stdin?.write(prompt);
    child.stdin?.end();
  });
}

function extractClaudeCodeResult(stdout) {
  const data = parseWholeJSON(stdout);
  if (!data) {
    return { text: stdout, runtimeSessionId: null };
  }

  const runtimeSessionId = data.session_id || data.sessionId || data.session || null;
  if (typeof data.result === 'string') {
    return { text: data.result, runtimeSessionId };
  }
  if (typeof data.text === 'string') {
    return { text: data.text, runtimeSessionId };
  }
  if (typeof data.message?.content === 'string') {
    return { text: data.message.content, runtimeSessionId };
  }
  if (Array.isArray(data.message?.content)) {
    return {
      text: data.message.content
        .map((block) => typeof block === 'string' ? block : block?.text)
        .filter(Boolean)
        .join('\n'),
      runtimeSessionId,
    };
  }
  return { text: stdout, runtimeSessionId };
}

async function callClaudeCode({ system, user, env, config, session, player, gameAction = false }) {
  const agentKey = String(player.id);
  const sessionDir = path.join(
    config.claudeSessionRoot,
    sanitizePathPart(session.id),
    `player_${sanitizePathPart(agentKey)}`,
  );
  await mkdir(sessionDir, { recursive: true, mode: 0o700 });

  // For live game actions we never `--resume`. Each contract action has a
  // distinct OUTPUT SCHEMA (NIGHT_SEER expects {targetId,...}; DAY_SPEECH
  // expects {speech,...}); resuming a prior session feeds claude its
  // previous turn's prompt as context and consistently produces the wrong
  // shape (e.g. seer's day speech echoing night-action JSON), which then
  // burns repair attempts and falls back. The v1 adapter already packs all
  // needed memory (public/private/episodic/strategy) into the prompt
  // explicitly, so claude's own session memory is redundant. Visual assets
  // are deterministic local SVG and never spawn claude. Only the legacy
  // (non-game-action) path keeps --resume so its prior contract is
  // preserved.
  const agentClaudeSessionId = session.claudeSessionIds?.get(agentKey) || null;
  const args = [...config.claudeArgs];
  if (
    !gameAction
    && config.claudeResume
    && agentClaudeSessionId
    && !hasArg(args, '--resume')
    && !hasArg(args, '--continue')
  ) {
    args.push('--resume', agentClaudeSessionId);
  }

  const child = spawn(config.claudeCodeBin, args, {
    cwd: sessionDir,
    env: buildClaudeEnv(env, config),
    windowsHide: true,
  });

  const prompt = buildClaudePrompt({ system, user, gameAction });
  const { stdout } = await collectProcess({ child, prompt, timeoutMs: config.timeoutMs });
  const { text, runtimeSessionId } = extractClaudeCodeResult(stdout);
  if (runtimeSessionId) {
    session.claudeSessionIds.set(agentKey, runtimeSessionId);
    session.claudeSessionId = runtimeSessionId;
  }

  return {
    text,
    model: config.model,
    provider: 'claude-code-minimax-codingplan',
    runtimeSessionId: session.claudeSessionIds.get(agentKey) || null,
  };
}

async function callSessionModel({ system, user, env, session, player, gameAction = false }) {
  const config = getProviderConfig(env);
  session.runtime = config.provider;

  if (config.provider === 'claude-code') {
    return callClaudeCode({ system, user, env, config, session, player, gameAction });
  }

  return callDirectModel({ system, user, config });
}

function summarizePublicResult(result, actionType) {
  if (!result) return 'no result';
  const fields = [];

  if (actionType === 'DAY_SPEECH') {
    if (result.speech) fields.push(`speech=${compact(result.speech, 360)}`);
    if (result.voteIntention !== undefined) fields.push(`vote=${result.voteIntention}`);
  } else if (actionType === 'DAY_VOTE') {
    if (result.targetId !== undefined) fields.push(`vote=${result.targetId}`);
  } else if (actionType === 'HUNTER_SHOOT') {
    if (result.targetId !== undefined) fields.push(`target=${result.targetId}`);
    if (result.shoot !== undefined) fields.push(`shoot=${result.shoot}`);
  }

  return fields.join('; ') || 'no public output';
}

function summarizePrivateResult(result) {
  if (!result) return 'no result';
  const fields = [];
  if (result.speech) fields.push(`speech=${compact(result.speech, 360)}`);
  if (result.voteIntention !== undefined) fields.push(`vote=${result.voteIntention}`);
  if (result.targetId !== undefined) fields.push(`target=${result.targetId}`);
  if (result.useSave !== undefined) fields.push(`save=${result.useSave}`);
  if (result.usePoison !== undefined) fields.push(`poison=${result.usePoison}`);
  if (result.thought || result.reasoning) fields.push(`privateReason=${compact(result.thought || result.reasoning, 360)}`);
  return fields.join('; ') || compact(JSON.stringify(result), 600);
}

function isPublicAction(actionType) {
  return ['DAY_SPEECH', 'DAY_VOTE', 'HUNTER_SHOOT'].includes(actionType);
}

function recordTurn({ session, player, actionType, gameStateMeta, result }) {
  const summary = summarizePublicResult(result, actionType);
  const privateSummary = summarizePrivateResult(result);
  const turn = {
    at: new Date().toISOString(),
    day: gameStateMeta?.dayCount ?? null,
    phase: gameStateMeta?.phase || '',
    playerId: player.id,
    role: player.role,
    actionType,
    summary,
    privateSummary,
  };

  const agentKey = String(player.id);
  const memory = session.agentMemories.get(agentKey) || [];
  memory.push(turn);
  session.agentMemories.set(agentKey, memory.slice(-MAX_AGENT_MEMORY));

  if (isPublicAction(actionType) && summary) {
    session.publicTurns.push({ ...turn, privateSummary: undefined });
    session.publicTurns = session.publicTurns.slice(-MAX_SESSION_TURNS);
  }
  session.updatedAt = new Date().toISOString();
}

function buildLegacyResult({ parsed, response, session }) {
  return {
    ...parsed,
    _modelInfo: {
      modelId: response.model,
      modelName: modelDisplayName(response),
      provider: response.provider,
    },
    _sessionInfo: {
      gameSessionId: session.id,
      mode: response.provider === 'claude-code-minimax-codingplan'
        ? 'claude-code-single-match-multi-agent'
        : 'single-match-multi-agent',
      runtimeSessionId: response.runtimeSessionId || null,
    },
  };
}

async function askWerewolfSessionLegacy({
  session,
  player,
  actionType,
  systemInstruction,
  prompt,
  gameStateMeta,
  env,
}) {
  const sessionContext = buildSessionContext({ session, player, actionType, gameStateMeta });
  const system = [
    'You are the AI engine for a Werewolf social deduction game.',
    'Return valid JSON only. Do not include markdown fences.',
    sessionContext,
    '',
    systemInstruction,
  ].join('\n\n');

  const user = [
    'Current action request:',
    prompt,
  ].join('\n\n');

  const response = await callSessionModel({ system, user, env, session, player, gameAction: true });
  const parsed = safeParseJSON(response.text);
  if (!parsed) {
    throw new Error(`Invalid JSON from werewolf session AI: ${compact(response.text, 500)}`);
  }

  const result = buildLegacyResult({ parsed, response, session });
  recordTurn({ session, player, actionType, gameStateMeta, result });
  return result;
}

async function askWerewolfSessionAdapter({
  session,
  player,
  actionType,
  systemInstruction,
  prompt,
  gameState,
  params,
  gameStateMeta,
  env,
}) {
  const contract = getContract(actionType);
  const capabilities = buildCapabilities({ contract, gameState, params, player });
  const memoryView = buildMemoryView({ session, playerId: player.id, gameState });
  const basePrompt = composePrompt({
    contract,
    capabilities,
    params,
    player: capabilities.currentPlayer || player,
    memoryView,
    systemAddon: systemInstruction || null,
    userAddon: prompt || null,
  });

  let lastResponse = null;
  const runModel = async (composed) => {
    const response = await callSessionModel({
      system: composed.system,
      user: composed.user,
      env,
      session,
      player,
      gameAction: true,
    });
    lastResponse = response;
    return {
      text: response.text,
      transport: {
        model: response.model,
        provider: response.provider,
        runtimeSessionId: response.runtimeSessionId || null,
      },
    };
  };

  const outcome = await runWithRepair({
    contract,
    capabilities,
    params,
    gameSetup: gameState?.gameSetup || null,
    basePrompt,
    runModel,
  });

  const transport = outcome.transport || (lastResponse ? {
    model: lastResponse.model,
    provider: lastResponse.provider,
    runtimeSessionId: lastResponse.runtimeSessionId || null,
  } : { model: null, provider: null, runtimeSessionId: null });

  const result = {
    ...outcome.action,
    _modelInfo: {
      modelId: transport.model,
      modelName: modelDisplayName({ provider: transport.provider, model: transport.model }),
      provider: transport.provider,
    },
    _sessionInfo: {
      gameSessionId: session.id,
      mode: transport.provider === 'claude-code-minimax-codingplan'
        ? 'claude-code-single-match-multi-agent'
        : 'single-match-multi-agent',
      runtimeSessionId: transport.runtimeSessionId || null,
      contractVersion: CONTRACT_VERSION,
      capabilityMode: CAPABILITY_MODE,
    },
    _diagnostics: {
      validationAttempts: outcome.diagnostics.validationAttempts,
      repairAttempts: outcome.diagnostics.repairAttempts,
      fallbackUsed: outcome.diagnostics.fallbackUsed,
      errorType: outcome.diagnostics.errorType,
    },
  };
  recordTurn({ session, player, actionType, gameStateMeta, result });
  return result;
}

export async function askWerewolfSession({
  gameSessionId,
  player,
  actionType,
  systemInstruction,
  prompt,
  gameStateMeta = {},
  gameState = null,
  params = null,
  contractVersion,
  capabilityMode,
  env = process.env,
}) {
  if (!player || player.id === undefined) {
    throw new Error('player is required');
  }
  if (!actionType) {
    throw new Error('actionType is required');
  }
  if (contractVersion && contractVersion !== CONTRACT_VERSION) {
    throw new Error(`Unsupported contractVersion ${contractVersion}; server is ${CONTRACT_VERSION}`);
  }
  if (capabilityMode && capabilityMode !== CAPABILITY_MODE) {
    throw new Error(`Unsupported capabilityMode ${capabilityMode}; server is ${CAPABILITY_MODE}`);
  }

  const session = getSession(gameSessionId);

  if (gameState && isSupportedAction(actionType)) {
    return askWerewolfSessionAdapter({
      session,
      player,
      actionType,
      systemInstruction,
      prompt,
      gameState,
      params: params || {},
      gameStateMeta,
      env,
    });
  }

  return askWerewolfSessionLegacy({
    session,
    player,
    actionType,
    systemInstruction,
    prompt,
    gameStateMeta,
    env,
  });
}

function sanitizeSvg(svg) {
  const text = String(svg || '').trim();
  if (!text.startsWith('<svg') || !text.includes('</svg>')) {
    throw new Error('Visual asset response did not contain a complete SVG');
  }
  if (/<script\b/i.test(text) || /\son[a-z]+\s*=/i.test(text) || /<foreignObject\b/i.test(text)) {
    throw new Error('Visual asset SVG contains unsafe content');
  }
  return text;
}

function svgToDataUri(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// ── Deterministic SVG asset generator ───────────────────────────────────
// Replaces the prior LLM-based generator. The reasoning LLM (MiniMax-M2.7)
// burned 60–90 s + thousands of tokens per avatar and the upstream cut the
// stream at ~70 s, so the call was a near-100 % failure that the frontend
// had to paper over with placeholders anyway. A deterministic generator
// is faster, cheaper, never fails, and produces consistent visuals.

const ROLE_GLYPHS = {
  '狼人': '🐺',
  '预言家': '🔮',
  '女巫': '⚗️',
  '守卫': '🛡️',
  '猎人': '🏹',
  '村民': '🧑',
  '魔术师': '🎩',
  '骑士': '⚔️',
  '摄梦人': '🌙',
};
const DEFAULT_GLYPH = '🎭';

const PALETTE = [
  ['#6366f1', '#312e81'], // indigo
  ['#ec4899', '#831843'], // pink
  ['#10b981', '#064e3b'], // emerald
  ['#f59e0b', '#78350f'], // amber
  ['#06b6d4', '#164e63'], // cyan
  ['#a855f7', '#581c87'], // purple
  ['#ef4444', '#7f1d1d'], // red
  ['#14b8a6', '#134e4a'], // teal
];

function pickPalette(seedKey) {
  let h = 5381;
  const text = String(seedKey ?? 'x');
  for (let i = 0; i < text.length; i += 1) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildAvatarSvg({ player, glyph, palette }) {
  const [c1, c2] = palette;
  const id = player?.id ?? 0;
  const name = player?.name || `P${id}`;
  const initial = (name.match(/[\p{L}\p{N}]/u)?.[0] || String(id))
    .slice(0, 2)
    .toUpperCase();
  const safeGlyph = escapeXml(glyph);
  const safeInitial = escapeXml(initial);
  const gradientId = `g_${Math.abs(id)}_${escapeXml(palette.join('')).replace(/[^a-z0-9]/gi, '').slice(0, 8)}`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="${escapeXml(name)} avatar">`,
    `<defs><radialGradient id="${gradientId}" cx="50%" cy="35%" r="65%"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></radialGradient></defs>`,
    `<rect width="512" height="512" fill="${c2}"/>`,
    `<circle cx="256" cy="256" r="232" fill="url(#${gradientId})"/>`,
    `<text x="256" y="290" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, sans-serif" font-size="200" text-anchor="middle" fill="rgba(255,255,255,0.92)">${safeGlyph}</text>`,
    `<text x="478" y="478" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, sans-serif" font-size="64" font-weight="700" text-anchor="end" fill="rgba(255,255,255,0.85)">${safeInitial}</text>`,
    `</svg>`,
  ].join('');
}

function buildBackgroundSvg({ player, gameMode, palette }) {
  const [c1, c2] = palette;
  const seed = `${player?.role || gameMode || 'werewolf'}-${player?.id ?? 0}`;
  const safeSeed = escapeXml(seed);
  const gradientId = `bg_${Math.abs(seed.length)}`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720" role="img" aria-label="${safeSeed} background">`,
    `<defs><linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${c2}"/><stop offset="100%" stop-color="${c1}"/></linearGradient></defs>`,
    `<rect width="1280" height="720" fill="url(#${gradientId})"/>`,
    `<circle cx="180" cy="180" r="60" fill="rgba(255,255,255,0.08)"/>`,
    `<circle cx="1080" cy="540" r="140" fill="rgba(255,255,255,0.06)"/>`,
    `<circle cx="900" cy="120" r="40" fill="rgba(255,255,255,0.05)"/>`,
    `</svg>`,
  ].join('');
}

function generateLocalVisualAsset({ assetType, player, gameMode }) {
  const role = player?.role;
  const glyph = ROLE_GLYPHS[role] || DEFAULT_GLYPH;
  const palette = pickPalette(`${assetType}:${player?.id ?? 'x'}:${role || ''}`);
  const svg = assetType === 'background'
    ? buildBackgroundSvg({ player, gameMode, palette })
    : buildAvatarSvg({ player, glyph, palette });
  const sanitized = sanitizeSvg(svg);
  const alt = assetType === 'background'
    ? `${role || gameMode || 'Werewolf'} background`
    : `${player?.name || 'Player'} (${role || 'unknown'}) avatar`;
  return { svg: sanitized, alt };
}

export async function generateWerewolfVisualAsset({
  gameSessionId,
  assetType = 'avatar',
  visualPrompt = '',  // unused; kept for API compatibility
  player = null,
  gameMode = 'ai-only',
  aspectRatio = null, // unused; kept for API compatibility
  env = process.env,  // unused; kept for API compatibility
}) {
  if (!['avatar', 'background'].includes(assetType)) {
    throw new Error('assetType must be avatar or background');
  }
  const session = getSession(`${gameSessionId || 'visual-assets'}:visuals`);
  const { svg, alt } = generateLocalVisualAsset({ assetType, player, gameMode });
  return {
    assetType,
    imageUrl: svgToDataUri(svg),
    svg,
    alt,
    _modelInfo: {
      modelId: 'local-deterministic-svg',
      modelName: 'Deterministic SVG',
      provider: 'local-svg',
    },
    _sessionInfo: {
      gameSessionId: session.id,
      mode: 'visual-asset',
      runtimeSessionId: null,
    },
  };
}

export function resetWerewolfSession(gameSessionId) {
  const id = String(gameSessionId || '').trim();
  if (!id) return false;
  return sessions.delete(id);
}

export function getWerewolfSessionSnapshot(gameSessionId) {
  const session = sessions.get(String(gameSessionId || '').trim());
  if (!session) return null;
  return {
    id: session.id,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    publicTurnCount: session.publicTurns.length,
    agentCount: session.agentMemories.size,
    runtime: session.runtime,
    runtimeSessionId: session.claudeSessionId,
    runtimeSessionIds: Object.fromEntries(session.claudeSessionIds || []),
  };
}
