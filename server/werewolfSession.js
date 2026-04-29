const DEFAULT_MODEL = 'MiniMax-M2';
const DEFAULT_MINIMAX_URL = 'https://api.minimaxi.com/anthropic/v1/messages';
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

function compact(value, limit = 1200) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function isAnthropicEndpoint(url) {
  return /\/anthropic\/v\d+\/messages/.test(String(url || ''));
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
    });
  }
  return sessions.get(id);
}

function getProviderConfig(env = process.env) {
  const apiUrl = env.WEREWOLF_SESSION_API_URL
    || env.MINIMAX_API_URL
    || env.ANTHROPIC_API_URL
    || DEFAULT_MINIMAX_URL;
  const apiKey = env.WEREWOLF_SESSION_API_KEY
    || env.MINIMAX_API_KEY
    || env.ANTHROPIC_API_KEY
    || '';
  const model = env.WEREWOLF_SESSION_MODEL
    || env.MINIMAX_MODEL
    || DEFAULT_MODEL;
  const timeoutMs = Number.parseInt(env.WEREWOLF_SESSION_TIMEOUT_MS || '45000', 10);
  return {
    apiUrl,
    apiKey,
    model,
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 45000,
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

async function callSessionModel({ system, user, env }) {
  const config = getProviderConfig(env);
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
    provider: anthropic ? 'minimax-anthropic' : 'openai-compatible',
  };
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

  const response = await callSessionModel({ system, user, env });
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
      mode: 'single-match-multi-agent',
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
  };
}
