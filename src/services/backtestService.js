// Shared API client for the 反向T策略回测 tool. See workers/auth/backtest.js for the
// proxy this talks to and docs/superpowers/specs/2026-08-25-backtest-tool-design.md
// for the endpoint contract.
import { buildApiUrl } from './apiBase';

async function parseJsonOrThrow(response) {
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // leave data null — fall through to the generic status-based message below
  }
  if (!response.ok) {
    const message = data?.detail || data?.error || `请求失败（${response.status}）`;
    throw new Error(message);
  }
  return data;
}

export const backtestService = {
  async fetchDailyTrend(code) {
    const response = await fetch(buildApiUrl(`/api/backtest/daily-trend?code=${encodeURIComponent(code)}`));
    return parseJsonOrThrow(response);
  },

  async runBacktest({ code, qty, positionPct, template, params }) {
    const response = await fetch(buildApiUrl('/api/backtest/run'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, qty, positionPct, template, params }),
    });
    return parseJsonOrThrow(response);
  },
};
