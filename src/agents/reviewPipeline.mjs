/**
 * reviewPipeline.mjs — Phase 1 Review Pipeline Orchestrator
 *
 * Sequential execution: BugHunter → PromptEngineer → TestWriter
 *
 * For KV access (Cloudflare), this script can be run in two modes:
 *   1. Local dev (no KV): pass --local to use filesystem queue
 *   2. Production (KV): set WRANGLER_ACCOUNT_ID + KV namespace ID env vars
 *
 * Usage:
 *   node reviewPipeline.mjs                          # process all pending (KV)
 *   node reviewPipeline.mjs --dry-run               # simulate without writing
 *   node reviewPipeline.mjs --local                  # use local filesystem queue
 *   node reviewPipeline.mjs --game-id=abc123        # process specific game
 *   node reviewPipeline.mjs --queue-key="review:X:Y" # process specific queue item
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTS_DIR = __dirname;
const QUEUE_DIR = join(__dirname, '../knowledge/pending'); // local filesystem fallback
const LOG_DIR = join(__dirname, '../knowledge/case_library');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isLocal = args.includes('--local');
const specificGameId = args.find(a => a.startsWith('--game-id='))?.slice('--game-id='.length);
const specificQueueKey = args.find(a => a.startsWith('--queue-key='))?.slice('--queue-key='.length);

console.log(`[Pipeline] Starting review pipeline`);
console.log(`  Mode: ${isDryRun ? 'DRY RUN (no files written)' : 'LIVE'}`);
console.log(`  Queue: ${isLocal ? 'local filesystem' : 'KV'}`);
if (specificGameId) console.log(`  Game ID filter: ${specificGameId}`);
if (specificQueueKey) console.log(`  Queue key filter: ${specificQueueKey}`);

// ── Import agents ─────────────────────────────────────────────────────────

const { runBugHunter } = await import('./bugHunter.mjs');
const { runPromptEngineer } = await import('./promptEngineer.mjs');
const { runTestWriter } = await import('./testWriter.mjs');

// ── Queue operations ───────────────────────────────────────────────────────

/**
 * Get pending queue items.
 * Local mode: reads from QUEUE_DIR/*.json
 * KV mode: uses Cloudflare Workers KV API
 */
async function getPendingItems() {
  if (isLocal) {
    mkdirSync(QUEUE_DIR, { recursive: true });
    const files = readdirSync(QUEUE_DIR).filter(f => f.endsWith('.json'));
    return files.map(f => {
      const key = f.replace('.json', '');
      const item = JSON.parse(readFileSync(join(QUEUE_DIR, f), 'utf8'));
      return { key, ...item };
    });
  }

  // KV mode: use wrangler or Cloudflare API
  // For production, set CLOUDFLARE_API_TOKEN + account ID
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const namespaceId = process.env.REVIEW_QUEUE_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !namespaceId || !apiToken) {
    console.warn('[Pipeline] KV env vars not set (CLOUDFLARE_ACCOUNT_ID, REVIEW_QUEUE_ID, CLOUDFLARE_API_TOKEN).');
    console.warn('[Pipeline] Falling back to local filesystem queue (--local).');
    return getPendingItems_localFallback();
  }

  try {
    const listUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/keys`;
    const resp = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${apiToken}` }
    });
    if (!resp.ok) throw new Error(`KV list failed: ${resp.status}`);
    const data = await resp.json();
    const keys = (data.result || []).filter(k => k.name.startsWith('review:')).map(k => k.name);
    const items = await Promise.all(keys.map(async key => {
      const getUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/keys/${encodeURIComponent(key)}`;
      const r = await fetch(getUrl, { headers: { Authorization: `Bearer ${apiToken}` } });
      if (!r.ok) return null;
      const value = await r.json();
      return { key, ...JSON.parse(value.value) };
    }));
    return items.filter(Boolean);
  } catch (err) {
    console.error('[Pipeline] KV read error:', err.message);
    console.warn('[Pipeline] Falling back to local filesystem queue.');
    return getPendingItems_localFallback();
  }
}

function getPendingItems_localFallback() {
  mkdirSync(QUEUE_DIR, { recursive: true });
  const files = readdirSync(QUEUE_DIR).filter(f => f.endsWith('.json'));
  return files.map(f => {
    const key = f.replace('.json', '');
    const item = JSON.parse(readFileSync(join(QUEUE_DIR, f), 'utf8'));
    return { key, ...item };
  });
}

/**
 * Remove a processed item from the queue.
 */
async function removeQueueItem(key) {
  if (isDryRun) {
    console.log(`[Pipeline] (dry) Would remove queue item: ${key}`);
    return;
  }

  if (isLocal) {
    const filePath = join(QUEUE_DIR, `${key}.json`);
    if (existsSync(filePath)) unlinkSync(filePath);
    return;
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const namespaceId = process.env.REVIEW_QUEUE_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !namespaceId || !apiToken) return;

  const delUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/keys/${encodeURIComponent(key)}`;
  await fetch(delUrl, { method: 'DELETE', headers: { Authorization: `Bearer ${apiToken}` } });
}

/**
 * Write a raw game log to the local queue (for manual testing / local dev).
 */
export function queueGameLocally(gameLog) {
  const { gameSessionId } = gameLog;
  if (!gameSessionId) throw new Error('gameLog must have gameSessionId');
  const key = `local:${Date.now()}:${gameSessionId}`;
  mkdirSync(QUEUE_DIR, { recursive: true });
  const filePath = join(QUEUE_DIR, `${key}.json`);
  writeFileSync(filePath, JSON.stringify({ key, ...gameLog }, null, 2), 'utf8');
  console.log(`[Pipeline] Queued locally: ${filePath}`);
  return key;
}

// ── Pipeline steps ─────────────────────────────────────────────────────────

/**
 * Run the full pipeline for one game log.
 * Sequential: BugHunter → PromptEngineer → TestWriter
 */
async function processGame(gameLog, queueKey) {
  const { gameSessionId } = gameLog;
  const gameId = gameSessionId || 'unknown';

  console.log(`\n[Pipeline] Processing game: ${gameId}`);
  console.log('─'.repeat(50));

  // Step 1: BugHunter
  let bugReport;
  try {
    console.log(`[Step 1/3] BugHunter analyzing...`);
    bugReport = await runBugHunter(gameLog, { dryRun: isDryRun });
    console.log(`  → Found ${bugReport.issues?.length ?? 0} issues`);
  } catch (err) {
    console.error(`  ✗ BugHunter failed: ${err.message}`);
    // Don't remove from queue — retry next time
    return { success: false, gameId, step: 'bugHunter', error: err.message };
  }

  // Step 2: PromptEngineer
  let improvedPrompts;
  try {
    console.log(`[Step 2/3] PromptEngineer generating improvements...`);
    improvedPrompts = await runPromptEngineer({ bugReport, gameLog }, { dryRun: isDryRun });
    console.log(`  → ${improvedPrompts.changes?.length ?? 0} prompt changes`);
  } catch (err) {
    console.error(`  ✗ PromptEngineer failed: ${err.message}`);
    // Bug report written, prompts not — retry
    return { success: false, gameId, step: 'promptEngineer', error: err.message };
  }

  // Step 3: TestWriter
  let testCases;
  try {
    console.log(`[Step 3/3] TestWriter generating test cases...`);
    testCases = await runTestWriter({ improvedPrompts, gameLog }, { dryRun: isDryRun });
    console.log(`  → ${testCases.testCases?.length ?? 0} test cases`);
  } catch (err) {
    console.error(`  ✗ TestWriter failed: ${err.message}`);
    return { success: false, gameId, step: 'testWriter', error: err.message };
  }

  // Success — remove from queue
  await removeQueueItem(queueKey);

  return { success: true, gameId, bugReport, improvedPrompts, testCases };
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  mkdirSync(LOG_DIR, { recursive: true });

  let items;
  try {
    items = await getPendingItems();
  } catch (err) {
    console.error('[Pipeline] Failed to get pending items:', err.message);
    process.exit(1);
  }

  if (items.length === 0) {
    console.log('[Pipeline] No pending game logs to process.');
    process.exit(0);
  }

  console.log(`[Pipeline] Found ${items.length} pending item(s)`);

  // Filter by specific game ID if provided
  const filtered = specificGameId
    ? items.filter(i => i.gameSessionId === specificGameId)
    : specificQueueKey
      ? items.filter(i => i.key === specificQueueKey)
      : items;

  if (specificGameId && filtered.length === 0) {
    console.log(`[Pipeline] No items found for game ID: ${specificGameId}`);
    process.exit(0);
  }

  const results = [];
  for (const item of filtered) {
    const result = await processGame(item, item.key);
    results.push(result);
  }

  // Summary
  console.log(`\n${'='.repeat(50)}`);
  console.log(`[Pipeline] Summary:`);
  const succeeded = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  console.log(`  Succeeded: ${succeeded}`);
  console.log(`  Failed:    ${failed}`);
  for (const r of results.filter(r => !r.success)) {
    console.log(`    ✗ ${r.gameId} — ${r.step}: ${r.error}`);
  }

  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error('[Pipeline] Fatal error:', err.message);
  process.exit(1);
});
