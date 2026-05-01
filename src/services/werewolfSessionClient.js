import { buildApiUrl } from './apiBase';
import { getToken } from '../utils/authToken';

const REQUEST_TIMEOUT = 45000;

const SESSION_MODE = import.meta.env.VITE_WEREWOLF_AI_MODE
  || (import.meta.env.VITE_AI_PROVIDER === 'ecs-session' ? 'session' : 'legacy');

const DIRECT_SESSION_BASE = import.meta.env.VITE_WEREWOLF_SESSION_API_URL?.replace(/\/+$/, '') || '';

export function isWerewolfSessionAIEnabled() {
  return SESSION_MODE === 'session' || SESSION_MODE === 'claude-session';
}

function resolveSessionUrl(path) {
  if (DIRECT_SESSION_BASE) {
    return `${DIRECT_SESSION_BASE}${path}`;
  }
  return buildApiUrl(`/api/werewolf/session${path}`);
}

async function postSession(path, body) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  const token = getToken();
  try {
    const response = await fetch(resolveSessionUrl(path), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) {
      throw new Error(data.error || `Werewolf session request failed: ${response.status}`);
    }
    return data;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function askWerewolfSessionAI({
  gameSessionId,
  player,
  actionType,
  systemInstruction,
  prompt,
  gameStateMeta,
}) {
  const data = await postSession('/ask', {
    gameSessionId,
    player,
    actionType,
    systemInstruction,
    prompt,
    gameStateMeta,
  });
  return data.result || null;
}

export async function resetWerewolfSessionAI(gameSessionId) {
  return postSession('/reset', { gameSessionId });
}

export async function generateWerewolfSessionAsset({
  gameSessionId = 'visual-assets',
  assetType,
  visualPrompt,
  player = null,
  gameMode = 'ai-only',
  aspectRatio = null,
}) {
  const data = await postSession('/asset', {
    gameSessionId,
    assetType,
    visualPrompt,
    player,
    gameMode,
    aspectRatio,
  });
  return data.result || null;
}
