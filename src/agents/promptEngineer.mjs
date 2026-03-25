/**
 * promptEngineer.mjs — Prompt Engineer Agent
 *
 * Role: Strategist
 * Input:  game log + bug report from BugHunter
 * Output: improved_prompts_{gameId}.json
 *
 * Usage:
 *   node promptEngineer.mjs <bugReport.json>
 *   node promptEngineer.mjs --game-id=abc123 --bug-report=path/to/bug_report.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { validateImprovedPrompts, withRetry } from './shared/validation.mjs';
import { callLLM, getApiConfig } from './shared/llm.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENT_NAME = 'PromptEngineer';
const OUTPUT_DIR = join(__dirname, '../knowledge/case_library');
const KNOWLEDGE_DIR = join(__dirname, '../knowledge');
const ROLE_PROMPTS_DIR = join(__dirname, '../../services/rolePrompts');

// ── System prompt ──────────────────────────────────────────────────────────

function buildSystemPrompt(existingPrompts) {
  return `你是 AI 狼人杀游戏的 Prompt Engineer Agent（策略师）。

你的职责是根据 Bug Hunter 找出的问题，生成针对性的提示词改进。

【当前 rolePrompts 内容参考】
${existingPrompts || '(rolePrompts 目录不存在或为空)'}

【输出格式】
输出一个 JSON 对象，不要有任何额外文本：
{
  "gameId": "游戏ID",
  "agent": "PromptEngineer",
  "timestamp": "ISO时间戳",
  "basedOnReport": "对应的 bug_report JSON 的 hash（简化处理：直接写 bug report 的 gameId）",
  "changes": [
    {
      "role": "改进的角色（如：狼人、村民、预言家）",
      "originalSnippet": "原始提示词片段（引用原文，50字以内）",
      "newSnippet": "改进后的提示词片段（50字以内）",
      "reason": "为什么这样改",
      "expectedImpact": "预期效果",
      "confidence": 0.85
    }
  ]
}

【原则】
- 区分"模型能力问题"和"提示词设计问题"
- 如果 rootCause 是 model_capability，不要强行写提示词修复，而是建议降级模型或调整期望
- 如果 rootCause 是 prompt_design，提供具体、可操作的提示词片段
- 每次最多改进 3 个最重要的点
- confidence 反映改进信心：0.5=猜测，0.8=有信心，1.0=非常有信心
- 只改提示词，不要改变游戏规则
`;
}

// ── Load role prompt content ───────────────────────────────────────────────

function loadRolePromptContent(role) {
  const roleFileMap = {
    '狼人': 'werewolf.js',
    '村民': 'villager.js',
    '预言家': 'seer.js',
    '女巫': 'witch.js',
    '猎人': 'hunter.js',
    '守卫': 'guard.js',
    '骑士': 'knight.js',
    '白痴': 'idiot.js',
    '长老': 'elder.js',
    '猎手': 'hunter.js',
    '守墓人': 'gravekeeper.js',
    '魔术师': 'magician.js',
    '摄梦人': 'dreamweaver.js',
  };

  const filename = roleFileMap[role];
  if (!filename) return null;
  const filePath = join(ROLE_PROMPTS_DIR, filename);
  if (!existsSync(filePath)) return null;

  try {
    const content = readFileSync(filePath, 'utf8');
    // Return first 500 chars as context
    return content.replace(/\/\/.*$/gm, '').slice(0, 500);
  } catch {
    return null;
  }
}

// ── Run ───────────────────────────────────────────────────────────────────

/**
 * @param {Object} params
 * @param {Object} params.bugReport   — output from BugHunter
 * @param {Object} params.gameLog     — original game log
 * @param {Object} [opts]
 * @param {boolean} [opts.dryRun]
 * @returns {Promise<Object>} ImprovedPrompts
 */
export async function runPromptEngineer({ bugReport, gameLog }, { dryRun = false } = {}) {
  const { gameSessionId } = gameLog || {};

  const apiConfig = getApiConfig();

  // Collect role-specific prompt context for roles mentioned in bug report
  const rolesInReport = [...new Set((bugReport.issues || []).map(i => i.role))];
  const roleContext = rolesInReport.map(role => {
    const content = loadRolePromptContent(role);
    return content ? `[${role}]\n${content}` : `[${role}]\n(无提示词文件)`;
  }).join('\n\n');

  const bugSummary = (bugReport.issues || []).slice(0, 5).map(issue =>
    `- [${issue.severity}] ${issue.role}: ${issue.description}
  rootCause: ${issue.rootCause}, suggestedFix: ${issue.suggestedFix || '(无)'}`)
    .join('\n');

  const userMsg = `【游戏会话ID】${bugReport.gameId || gameSessionId}

【Bug Report 摘要】
${bugSummary}

【涉及角色的当前提示词片段】
${roleContext || '(无)'}

请根据以上 Bug Report，生成针对性的提示词改进。
只针对 rootCause = prompt_design 的问题生成改进建议。
输出 JSON 格式的 ImprovedPrompts。`;

  const systemMsg = buildSystemPrompt(roleContext);

  let rawOutput;
  try {
    ({ content: rawOutput } = await withRetry(
      () => callLLM({ ...apiConfig, systemMsg, userMsg }),
      3, 2000
    ));
  } catch (err) {
    throw new Error(`PromptEngineer LLM call failed: ${err.message}`);
  }

  let prompts;
  try {
    prompts = JSON.parse(rawOutput);
  } catch {
    const match = rawOutput.match(/```(?:json)?\n?([\s\S]+?)\n?```/) || rawOutput.match(/(\{[\s\S]+\})/);
    if (match) {
      try { prompts = JSON.parse(match[1]); }
      catch { throw new Error(`PromptEngineer: failed to parse JSON: ${rawOutput.slice(0, 200)}`); }
    } else {
      throw new Error(`PromptEngineer: no JSON found: ${rawOutput.slice(0, 200)}`);
    }
  }

  if (!prompts.gameId) prompts.gameId = bugReport.gameId || gameSessionId || 'unknown';
  if (!prompts.agent) prompts.agent = AGENT_NAME;
  if (!prompts.timestamp) prompts.timestamp = new Date().toISOString();
  if (!prompts.basedOnReport) prompts.basedOnReport = bugReport.gameId || '';

  try {
    validateImprovedPrompts(prompts);
  } catch (err) {
    throw new Error(`PromptEngineer output validation failed: ${err.message}`);
  }

  if (!dryRun) {
    const outFile = join(OUTPUT_DIR, `improved_prompts_${prompts.gameId}.json`);
    writeFileSync(outFile, JSON.stringify(prompts, null, 2), 'utf8');
    console.log(`[PromptEngineer] Wrote ${outFile}`);
  }

  return prompts;
}

// ── CLI ────────────────────────────────────────────────────────────────────

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  let bugReportPath, gameId;

  for (const arg of args) {
    if (arg.startsWith('--game-id=')) gameId = arg.slice('--game-id='.length);
    else if (arg.startsWith('--bug-report=')) bugReportPath = arg.slice('--bug-report='.length);
    else if (!arg.startsWith('--')) bugReportPath = arg;
  }

  if (!bugReportPath) {
    console.error('Usage: node promptEngineer.mjs [--game-id=X] <bugReport.json>');
    process.exit(1);
  }

  const bugReport = JSON.parse(readFileSync(resolve(bugReportPath), 'utf8'));
  const id = gameId || bugReport.gameId || 'unknown';

  runPromptEngineer({ bugReport, gameLog: { gameSessionId: id } }, { dryRun: false })
    .then(result => {
      console.log(`[PromptEngineer] Done. ${result.changes?.length ?? 0} prompt changes.`);
      process.exit(0);
    })
    .catch(err => {
      console.error('[PromptEngineer] FAILED:', err.message);
      process.exit(1);
    });
}
