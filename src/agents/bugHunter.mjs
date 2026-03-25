/**
 * bugHunter.mjs — Bug Hunter Agent
 *
 * Role: Auditor
 * Input:  game log (speechHistory, voteHistory, deathHistory, nightActionHistory)
 * Output: bug_report_{gameId}.json
 *
 * Usage:
 *   node bugHunter.mjs <gameLog.json>
 *   node bugHunter.mjs --game-id=abc123 --game-log=path/to/log.json
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { validateBugReport, withRetry } from './shared/validation.mjs';
import { callLLM, getApiConfig } from './shared/llm.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENT_NAME = 'BugHunter';
const OUTPUT_DIR = resolve(__dirname, '../knowledge/case_library');
const KNOWLEDGE_DIR = resolve(__dirname, '../knowledge');

// ── System prompt ──────────────────────────────────────────────────────────

function buildSystemPrompt(knowledgeBase) {
  return `你是 AI 狼人杀游戏的 Bug Hunter Agent（审计员）。

你的职责是从游戏日志中找出 AI 角色的行为问题，区分"模型能力问题"和"提示词设计问题"。

【输出格式】
输出一个 JSON 对象，不要有任何额外文本：
{
  "gameId": "游戏ID",
  "agent": "BugHunter",
  "timestamp": "ISO时间戳",
  "issues": [
    {
      "id": "issue-1",
      "severity": "critical|high|medium|low",
      "category": "speech_contradiction|vote_mismanagement|night_misplay|model_weakness|prompt_gap",
      "role": "涉及的的角色",
      "description": "问题描述",
      "evidence": {
        "source": "speechHistory|voteHistory|nightActionHistory",
        "entryIndex": 0,
        "quote": "具体证据引用"
      },
      "rootCause": "model_capability|prompt_design|game_bug|unknown",
      "suggestedFix": "建议修复方向"
    }
  ]
}

【评分标准 - severity】
- critical: 导致游戏无法正常结束或结果错误
- high: 严重影响博弈公平性（如狼人自爆、夜晚决策严重失误）
- medium: 存在博弈漏洞但未造成决定性影响
- low: 轻微逻辑问题或措辞不当

【评分标准 - category】
- speech_contradiction: 发言前后矛盾
- vote_mismanagement: 投票失误或被操控
- night_misplay: 夜间决策失误
- model_weakness: 模型能力不足导致的问题
- prompt_gap: 提示词设计缺陷

【评分标准 - rootCause】
- model_capability: 模型推理能力不足（上下文理解、博弈策略）
- prompt_design: 提示词没有正确引导模型行为
- game_bug: 游戏逻辑 bug（非 AI 问题）
- unknown: 无法确定，默认为 prompt_design

【知识库参考】
${knowledgeBase ? JSON.stringify(knowledgeBase, null, 2) : '(暂无知识库，用你的通用推理分析)'}

【重要】
- 最多输出 5 个最重要的问题
- 如果游戏正常结束且没有明显问题，输出空的 issues 数组
- 每个 issue 必须有具体的证据引用（entryIndex 和 quote）
- rootCause 默认为 prompt_design（保守策略，不轻易归咎于模型）
`;
}

// ── Run ───────────────────────────────────────────────────────────────────

/**
 * @param {Object} gameLog
 * @param {Object} [opts]
 * @param {boolean} [opts.dryRun] — if true, don't write output files
 * @returns {Promise<Object>} BugReport
 */
export async function runBugHunter(gameLog, { dryRun = false } = {}) {
  const { gameSessionId, speechHistory = [], voteHistory = [], deathHistory = [], nightActionHistory = [], players = [] } = gameLog;

  const apiConfig = getApiConfig();

  // Load knowledge base for context
  let knowledgeBase = null;
  try {
    const kbPath = join(KNOWLEDGE_DIR, 'role_insights.json');
    knowledgeBase = JSON.parse(readFileSync(kbPath, 'utf8'));
  } catch { /* no knowledge base yet, that's fine */ }

  const playerSummary = players.map(p =>
    `[${p.id}] ${p.name} (${p.role}) ${p.isAlive ? '存活' : '死亡'}`
  ).join('\n');

  const speechSummary = speechHistory
    .slice(-20) // last 20 speeches for context
    .map((s, i) => `[${i}] ${s.day}天 ${s.playerName}(${s.role}): ${s.content?.slice(0, 100)}`)
    .join('\n');

  const userMsg = `【游戏会话ID】${gameSessionId}

【玩家列表】
${playerSummary}

【发言记录（最近20条）】
${speechSummary || '(无)'}

【投票记录】
${voteHistory.length > 0 ? JSON.stringify(voteHistory.slice(-5), null, 2) : '(无)'}

【死亡记录】
${deathHistory.length > 0 ? JSON.stringify(deathHistory, null, 2) : '(无)'}

【夜间行动记录】
${nightActionHistory.length > 0 ? JSON.stringify(nightActionHistory.slice(-10), null, 2) : '(无)'}

请分析以上游戏日志，找出 AI 角色表现最好的 3 个地方（强项）和 3 个最需要改进的地方（弱项）。
输出 JSON 格式的 Bug Report。`;

  const systemMsg = buildSystemPrompt(knowledgeBase);

  let rawOutput;
  try {
    ({ content: rawOutput } = await withRetry(
      () => callLLM({ ...apiConfig, systemMsg, userMsg }),
      3, 2000
    ));
  } catch (err) {
    throw new Error(`BugHunter LLM call failed after 3 retries: ${err.message}`);
  }

  // Parse JSON from LLM output
  let report;
  try {
    report = JSON.parse(rawOutput);
  } catch {
    // Try to extract JSON from markdown code blocks
    const match = rawOutput.match(/```(?:json)?\n?([\s\S]+?)\n?```/) || rawOutput.match(/(\{[\s\S]+\})/);
    if (match) {
      try { report = JSON.parse(match[1]); }
      catch { throw new Error(`BugHunter: failed to parse LLM output as JSON: ${rawOutput.slice(0, 200)}`); }
    } else {
      throw new Error(`BugHunter: no JSON found in LLM output: ${rawOutput.slice(0, 200)}`);
    }
  }

  // Ensure gameId is set
  if (!report.gameId) report.gameId = gameSessionId || 'unknown';
  if (!report.agent) report.agent = AGENT_NAME;
  if (!report.timestamp) report.timestamp = new Date().toISOString();

  // Validate schema
  try {
    validateBugReport(report);
  } catch (err) {
    throw new Error(`BugHunter output validation failed: ${err.message}`);
  }

  // Write output
  if (!dryRun) {
    const outFile = join(OUTPUT_DIR, `bug_report_${report.gameId}.json`);
    mkdirSync(dirname(outFile), { recursive: true });
    writeFileSync(outFile, JSON.stringify(report, null, 2), 'utf8');
    console.log(`[BugHunter] Wrote ${outFile}`);
  }

  return report;
}

// ── CLI ────────────────────────────────────────────────────────────────────

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  let gameLogPath, gameId;

  for (const arg of args) {
    if (arg.startsWith('--game-id=')) gameId = arg.slice('--game-id='.length);
    else if (arg.startsWith('--game-log=')) gameLogPath = arg.slice('--game-log='.length);
    else if (!arg.startsWith('--')) gameLogPath = arg;
  }

  if (!gameLogPath) {
    console.error('Usage: node bugHunter.mjs [--game-id=X] <gameLog.json>');
    process.exit(1);
  }

  const gameLog = JSON.parse(readFileSync(resolve(gameLogPath), 'utf8'));
  const id = gameId || gameLog.gameSessionId || 'unknown';

  runBugHunter({ ...gameLog, gameSessionId: id }, { dryRun: false })
    .then(report => {
      console.log(`[BugHunter] Done. Found ${report.issues.length} issues.`);
      process.exit(0);
    })
    .catch(err => {
      console.error('[BugHunter] FAILED:', err.message);
      process.exit(1);
    });
}
