# 狼人杀待决策项

> 格式：`[YYYY-MM-DD] 决策描述（背景和选项）` — 用户批注后标记 ✅/❌ 并在下一轮执行

---

## [2026-06-15] promptFactory.js 路径接通 vs 删除

**背景**：`src/services/promptFactory.js` 中的 `getProgressiveActionPrompt` 从未被任何生产代码导入。
`rolePrompts/*.js` 的 `nightAction`/`daySpeech` 函数（如 `getSeerNightActionPrompt`、`getWerewolfDaySpeechPrompt`）都是**死代码**。

这意味着：
- 这些函数中的任何改动**对实际 AI 行为无效**
- 真正运行的是 `aiPrompts.js` 中的内联 `ROLE_DAY_SPEECH_PROMPTS` 和 `case PROMPT_ACTIONS.*`
- 代码中存在两套"提示词"但只有一套生效，容易误导后续开发

**选项**：
- **A. 接通路径**：在 `generateUserPrompt` 的各 action case 中，优先调用 `getProgressiveActionPrompt`，失败时 fallback 到现有内联逻辑。好处：rolePrompts 模块化架构生效，修改更清晰。代价：需要仔细验证每个 action type 的参数兼容性。
- **B. 删除死代码**：删除 `promptFactory.js` 的 `getProgressiveActionPrompt` 及各 rolePrompts/*.js 中的 `nightAction`/`daySpeech` 函数，只保留 `buildPersonaPrompt`（这条是活的）。好处：消除混淆，代码更干净。代价：如果未来想做模块化，需要重新写。
- **C. 保持现状**：不改动，继续在 `aiPrompts.js` 直接修改。不推荐（混淆会持续）。

**推荐**：A（接通路径），改动量约 50 行，每个 case 用 `getProgressiveActionPrompt(actionType, currentPlayer, gameState, params) || <现有逻辑>` 模式接通。

**待用户批注**：[ ]A — 接通  [ ]B — 删除  [ ]C — 保持现状
