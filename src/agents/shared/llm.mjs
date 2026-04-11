/**
 * llm.mjs — Shared LLM caller for agent scripts.
 *
 * Agent scripts run in Node.js (not the browser), so we use a simple
 * fetch-based API client pointing at ModelScope-compatible endpoints.
 *
 * Phase 1: agents call ModelScope directly (no browser-side AI_MODELS needed).
 */

import { readFileSync } from 'fs';
import { resolve, join } from 'path';

const __dirname = import.meta.dirname;

// Load env vars from .env if present (for local dev)
try {
  const envFile = readFileSync(join(__dirname, '../../../.env'), 'utf8');
  for (const line of envFile.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (key && !process.env[key]) process.env[key] = val;
  }
} catch { /* no .env, use process.env */ }

/**
 * Call a ModelScope-compatible chat API.
 *
 * @param {Object} params
 * @param {string}   params.apiUrl      - API endpoint URL
 * @param {string}   params.apiKey      - API key
 * @param {string}   params.model       - model id
 * @param {string}   params.systemMsg   - system message
 * @param {string}   params.userMsg     - user message
 * @param {Object}   [params.options]  - model options (temperature, top_p, etc.)
 * @returns {Promise<{content: string, model: string}>}
 */
export async function callLLM({ apiUrl, apiKey, model, systemMsg, userMsg, options = {} }) {
  // Split known defaults from arbitrary pass-through options.
  // Anything not explicitly pulled out (e.g. response_format, max_tokens, stop)
  // is forwarded to the upstream API as-is.
  const {
    temperature = 0.7,
    top_p = 0.7,
    enable_thinking,
    thinking_budget = 4096,
    ...passthrough
  } = options;

  const payload = {
    model,
    messages: [
      { role: 'system', content: systemMsg },
      { role: 'user', content: userMsg }
    ],
    temperature,
    top_p,
    ...(enable_thinking ? { enable_thinking: true, thinking_budget } : {}),
    ...passthrough,
  };

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`LLM API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content ?? '';
  return { content, model: data?.model ?? model };
}

/**
 * Build the API config from environment variables.
 * Matches aiConfig.js: ModelScope is the project default, SiliconFlow optional.
 * AGENT_MODEL env var can override the default model.
 */
export function getApiConfig() {
  // Prefer explicit VITE_API_URL/KEY (matches aiConfig.js default provider = modelscope).
  // Fall back to SiliconFlow-specific env vars, then to ModelScope's public endpoint.
  const apiUrl = process.env.VITE_API_URL
    || process.env.VITE_SILICONFLOW_API_URL
    || process.env.SILICONFLOW_API_URL
    || 'https://api-inference.modelscope.cn/v1/chat/completions';
  const apiKey = process.env.VITE_API_KEY
    || process.env.VITE_SILICONFLOW_API_KEY
    || process.env.SILICONFLOW_API_KEY
    || '';

  // Default model for agent analysis — DeepSeek-V3.2 (verified on ModelScope, non-thinking, ~4s/call with response_format).
  // Override with AGENT_MODEL env var if you want a different model.
  // NOTE: not every model in aiConfig.js is actually hosted on ModelScope; verify with curl first.
  const model = process.env.AGENT_MODEL || 'deepseek-ai/DeepSeek-V3.2';

  return { apiUrl, apiKey, model };
}
