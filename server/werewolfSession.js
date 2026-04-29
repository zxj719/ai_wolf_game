import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

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
      runtime: null,
    });
  }
  return sessions.get(id);
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
    .map((turn, index) => `${index + 1}. ${turn.actionType}: ${turn.summary}`)
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

function buildClaudePrompt({ system, user }) {
  return [
    'You are being invoked by an HTTP game server as a non-interactive Claude Code runtime.',
    'Do not edit files, do not run tools, and do not ask follow-up questions.',
    'Think privately if needed, but the final stdout result must contain exactly one JSON object for the game engine.',
    'Do not include markdown fences, explanations, trace output, system text, or the user prompt in the final result.',
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

async function callClaudeCode({ system, user, env, config, session }) {
  const sessionDir = path.join(config.claudeSessionRoot, sanitizePathPart(session.id));
  await mkdir(sessionDir, { recursive: true, mode: 0o700 });

  const args = [...config.claudeArgs];
  if (
    config.claudeResume
    && session.claudeSessionId
    && !hasArg(args, '--resume')
    && !hasArg(args, '--continue')
  ) {
    args.push('--resume', session.claudeSessionId);
  }

  const child = spawn(config.claudeCodeBin, args, {
    cwd: sessionDir,
    env: buildClaudeEnv(env, config),
    windowsHide: true,
  });

  const prompt = buildClaudePrompt({ system, user });
  const { stdout } = await collectProcess({ child, prompt, timeoutMs: config.timeoutMs });
  const { text, runtimeSessionId } = extractClaudeCodeResult(stdout);
  if (runtimeSessionId) {
    session.claudeSessionId = runtimeSessionId;
  }

  return {
    text,
    model: config.model,
    provider: 'claude-code-minimax-codingplan',
    runtimeSessionId: session.claudeSessionId,
  };
}

async function callSessionModel({ system, user, env, session }) {
  const config = getProviderConfig(env);
  session.runtime = config.provider;

  if (config.provider === 'claude-code') {
    return callClaudeCode({ system, user, env, config, session });
  }

  return callDirectModel({ system, user, config });
}

function summarizeResult(result) {
  if (!result) return 'no result';
  const fields = [];
  if (result.speech) fields.push(`speech=${compact(result.speech, 360)}`);
  if (result.voteIntention !== undefined) fields.push(`vote=${result.voteIntention}`);
  if (result.targetId !== undefined) fields.push(`target=${result.targetId}`);
  if (result.useSave !== undefined) fields.push(`save=${result.useSave}`);
  if (result.usePoison !== undefined) fields.push(`poison=${result.usePoison}`);
  if (result.thought || result.reasoning) fields.push(`reason=${compact(result.thought || result.reasoning, 360)}`);
  return fields.join('; ') || compact(JSON.stringify(result), 600);
}

function isPublicAction(actionType) {
  return ['DAY_SPEECH', 'DAY_VOTE', 'HUNTER_SHOOT'].includes(actionType);
}

function recordTurn({ session, player, actionType, gameStateMeta, result }) {
  const summary = summarizeResult(result);
  const turn = {
    at: new Date().toISOString(),
    day: gameStateMeta?.dayCount ?? null,
    phase: gameStateMeta?.phase || '',
    playerId: player.id,
    role: player.role,
    actionType,
    summary,
  };

  const agentKey = String(player.id);
  const memory = session.agentMemories.get(agentKey) || [];
  memory.push(turn);
  session.agentMemories.set(agentKey, memory.slice(-MAX_AGENT_MEMORY));

  if (isPublicAction(actionType)) {
    session.publicTurns.push(turn);
    session.publicTurns = session.publicTurns.slice(-MAX_SESSION_TURNS);
  }
  session.updatedAt = new Date().toISOString();
}

export async function askWerewolfSession({
  gameSessionId,
  player,
  actionType,
  systemInstruction,
  prompt,
  gameStateMeta = {},
  env = process.env,
}) {
  if (!player || player.id === undefined) {
    throw new Error('player is required');
  }
  if (!actionType) {
    throw new Error('actionType is required');
  }

  const session = getSession(gameSessionId);
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

  const response = await callSessionModel({ system, user, env, session });
  const parsed = safeParseJSON(response.text);
  if (!parsed) {
    throw new Error(`Invalid JSON from werewolf session AI: ${compact(response.text, 500)}`);
  }

  const result = {
    ...parsed,
    _modelInfo: {
      modelId: response.model,
      modelName: response.model,
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
  recordTurn({ session, player, actionType, gameStateMeta, result });
  return result;
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
  };
}
