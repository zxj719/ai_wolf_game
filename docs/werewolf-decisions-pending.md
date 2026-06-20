# 狼人杀待决策项

> 格式：`[YYYY-MM-DD] 决策描述（背景和选项）` — 用户批注后标记 ✅/❌ 并在下一轮执行

---

## ✅ [2026-06-15] promptFactory.js 路径接通 vs 删除

**已解决**：Round 14 执行了 Plan B（删除死代码）。`getProgressiveActionPrompt` 及 6 个主角色的 `nightAction`/`daySpeech` 函数已删除，约 500 行死代码清除，无回归。详见 `docs/werewolf-loop-reports/2026-06-17-round14.md`。
