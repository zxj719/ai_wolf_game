/**
 * testWriter.mjs — Test Writer Agent
 *
 * Role: QA Engineer
 * Input:  improved prompts from PromptEngineer
 * Output: test_cases_{gameId}.json + case_library/YYYY-MM-gameXXX.md
 *
 * Usage:
 *   node testWriter.mjs <improvedPrompts.json>
 *   node testWriter.mjs --game-id=abc123 --prompts=path/to/improved_prompts.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { validateTestCases, withRetry } from './shared/validation.mjs';
import { callLLM, getApiConfig } from './shared/llm.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENT_NAME = 'TestWriter';
const OUTPUT_DIR = join(__dirname, '../knowledge/case_library');
const KNOWLEDGE_DIR = join(__dirname, '../knowledge');

// ── System prompt ──────────────────────────────────────────────────────────

function buildSystemPrompt() {
  return `你是 AI 狼人杀游戏的 Test Writer Agent（质检员）。

你的职责是为改进后的提示词生成对抗性测试用例，验证新提示词是否真的比旧提示词更好。

【输出格式】
输出一个 JSON 对象，不要有任何额外文本：
{
  "gameId": "游戏ID",
  "agent": "TestWriter",
  "timestamp": "ISO时间戳",
  "basedOnPrompts": "对应的 improved_prompts 的 gameId",
  "testCases": [
    {
      "id": "test-1",
      "scenario": "测试场景描述（如：狼人在第3天被预言家查杀后的发言）",
      "setup": {
        "day": 3,
        "phase": "day_discussion",
        "players": [{"id": 0, "role": "狼人", "isAlive": true}],
        "context": "关键上下文描述"
      },
      "expectedBehavior": "期望的 AI 发言/行为",
      "passCriteria": "通过标准（什么情况下这个测试算通过）",
      "automated": false
    }
  ]
}

【原则】
- 生成对抗性场景（最难的情况）来测试提示词鲁棒性
- 每个 testCase 的 automated = false（Phase 1 为手动测试）
- passCriteria 必须具体可判定（如：发言中包含"查杀"关键词，且字数 > 20）
- 优先测试 rootCause = prompt_design 的改进
- 每个 changed prompt 至少生成 1 个测试用例
`;
}

// ── Run ───────────────────────────────────────────────────────────────────

/**
 * @param {Object} params
 * @param {Object} params.improvedPrompts  — output from PromptEngineer
 * @param {Object} params.gameLog           — original game log
 * @param {Object} [opts]
 * @param {boolean} [opts.dryRun]
 * @returns {Promise<Object>} TestCases
 */
export async function runTestWriter({ improvedPrompts, gameLog }, { dryRun = false } = {}) {
  const { gameSessionId } = gameLog || {};
  const apiConfig = getApiConfig();

  const promptChangesSummary = (improvedPrompts.changes || []).map(c =>
    `[${c.role}]\n  旧: ${c.originalSnippet?.slice(0, 80)}\n  新: ${c.newSnippet?.slice(0, 80)}`)
    .join('\n\n');

  const userMsg = `【游戏会话ID】${improvedPrompts.gameId}

【Prompt Engineer 的改进建议】
${promptChangesSummary || '(无改进建议)'}

请为以上每个提示词改进生成 1-2 个对抗性测试用例。
测试场景应该模拟最难博弈情况，验证新提示词是否真的更好。
输出 JSON 格式的 TestCases。`;

  const systemMsg = buildSystemPrompt();

  let rawOutput;
  try {
    ({ content: rawOutput } = await withRetry(
      () => callLLM({ ...apiConfig, systemMsg, userMsg }),
      3, 2000
    ));
  } catch (err) {
    throw new Error(`TestWriter LLM call failed: ${err.message}`);
  }

  let testCases;
  try {
    testCases = JSON.parse(rawOutput);
  } catch {
    const match = rawOutput.match(/```(?:json)?\n?([\s\S]+?)\n?```/) || rawOutput.match(/(\{[\s\S]+\})/);
    if (match) {
      try { testCases = JSON.parse(match[1]); }
      catch { throw new Error(`TestWriter: failed to parse JSON: ${rawOutput.slice(0, 200)}`); }
    } else {
      throw new Error(`TestWriter: no JSON found: ${rawOutput.slice(0, 200)}`);
    }
  }

  if (!testCases.gameId) testCases.gameId = improvedPrompts.gameId || gameSessionId || 'unknown';
  if (!testCases.agent) testCases.agent = AGENT_NAME;
  if (!testCases.timestamp) testCases.timestamp = new Date().toISOString();
  if (!testCases.basedOnPrompts) testCases.basedOnPrompts = improvedPrompts.gameId || '';

  try {
    validateTestCases(testCases);
  } catch (err) {
    throw new Error(`TestWriter output validation failed: ${err.message}`);
  }

  // Write test cases JSON
  if (!dryRun) {
    const outFile = join(OUTPUT_DIR, `test_cases_${testCases.gameId}.json`);
    mkdirSync(dirname(outFile), { recursive: true });
    writeFileSync(outFile, JSON.stringify(testCases, null, 2), 'utf8');
    console.log(`[TestWriter] Wrote ${outFile}`);

    // Also write a human-readable markdown case report
    const mdFile = generateMarkdownReport(testCases, improvedPrompts, gameLog);
    writeFileSync(mdFile, _mdFileContent, 'utf8');
    console.log(`[TestWriter] Wrote ${mdFile}`);
  }

  return testCases;
}

// ── Markdown report generator ──────────────────────────────────────────────

let _mdFileContent = ''; // populated by generateMarkdownReport before write

function generateMarkdownReport(testCases, improvedPrompts, gameLog) {
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const gameId = testCases.gameId || 'unknown';
  const filename = `${dateStr}-${gameId}.md`;

  const promptChanges = (improvedPrompts.changes || []).map(c =>
    `### ${c.role}\n**原提示词**: ${c.originalSnippet}\n**新提示词**: ${c.newSnippet}\n**理由**: ${c.reason}\n**预期效果**: ${c.expectedImpact}\n**信心指数**: ${(c.confidence * 100).toFixed(0)}%\n`
  ).join('\n');

  const testCaseList = (testCases.testCases || []).map(tc =>
    `- **${tc.id}**: ${tc.scenario}\n  - 通过标准: ${tc.passCriteria}\n  - 可自动化: ${tc.automated ? '是' : '否（手动测试）'}`
  ).join('\n');

  _mdFileContent = `# 复盘报告: ${gameId}

生成时间: ${now.toISOString()}
游戏会话: ${gameId}

## Prompt 改进

${promptChanges || '（无改进建议）'}

## 测试用例

${testCaseList || '（无测试用例）'}

## 关键发现

（本节由人工填写）

---
*由 TestWriter Agent 自动生成*
`;

  return join(OUTPUT_DIR, filename);
}

// ── CLI ────────────────────────────────────────────────────────────────────

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  let promptsPath, gameId;

  for (const arg of args) {
    if (arg.startsWith('--game-id=')) gameId = arg.slice('--game-id='.length);
    else if (arg.startsWith('--prompts=')) promptsPath = arg.slice('--prompts='.length);
    else if (!arg.startsWith('--')) promptsPath = arg;
  }

  if (!promptsPath) {
    console.error('Usage: node testWriter.mjs [--game-id=X] <improvedPrompts.json>');
    process.exit(1);
  }

  const improvedPrompts = JSON.parse(readFileSync(resolve(promptsPath), 'utf8'));
  const id = gameId || improvedPrompts.gameId || 'unknown';

  runTestWriter({ improvedPrompts, gameLog: { gameSessionId: id } }, { dryRun: false })
    .then(result => {
      console.log(`[TestWriter] Done. ${result.testCases?.length ?? 0} test cases.`);
      process.exit(0);
    })
    .catch(err => {
      console.error('[TestWriter] FAILED:', err.message);
      process.exit(1);
    });
}
