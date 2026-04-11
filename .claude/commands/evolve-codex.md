# 自我进化循环（codex 版）

把 "自我进化" 流水线的下一轮迭代**交给 codex CLI**，由它的 subagent 机制驱动。

## 何时使用

- 你不想让当前 Claude Code 会话直接跑循环，改由 codex 独立推进
- 你希望用 codex 的 subagent 而不是 Claude 的 Agent 工具
- 你要把循环挂到后台或 CI，让 codex 作为无人值守执行体

## 前提（必须先确认）

- `src/agents/reviewPipeline.mjs` 存在且能跑（`node src/agents/reviewPipeline.mjs --local`）
- `src/agents/headlessGame.mjs` 存在（由 Phase 2 建立）——没有它 pending/ 就永远是空
- `.env` 或环境变量里有可用的 `VITE_SILICONFLOW_API_KEY` / `VITE_API_KEY`
- `src/knowledge/case_library/` 当前状态已盘点（2 条种子案例，0 条建议已落地）
- CHANGELOG.md 头部没有未提交的草稿

## 执行

本命令不直接跑代码。它把下面这段**指令原文**传给 codex——
可以通过 `/codex`、`codex exec`、或直接粘贴到 codex 会话里：

```
你现在接管 AI 狼人杀项目的 "自我进化" 循环。这套系统 Phase 1 已落地，
你不是在从零搭，而是在推动一个已经停了 17 天的循环继续转。

==== 真实状态（开始前必须先读一遍）====
- 流水线入口: src/agents/reviewPipeline.mjs
- 对局生成器: src/agents/headlessGame.mjs（跑一局自动写入 pending/）
- 三 agent: src/agents/bugHunter.mjs → promptEngineer.mjs → testWriter.mjs
- LLM 封装: src/agents/shared/llm.mjs（SiliconFlow / Qwen3-8B）
- 案例库: src/knowledge/case_library/（当前只有 demo-001 和 local-test-001 两条种子）
- pending 队列: src/knowledge/pending/（当前为空）
- 持久化知识: src/knowledge/{model_weaknesses,role_insights,successful_prompts}.json
- 进化目标: src/services/rolePrompts/*.js + src/services/promptFactory.js
- 收敛条件: 连续 5 局改进 < 5% 则停止
- 审批: 所有改动走 GitHub PR，不直接 push main

==== 硬性约束 ====
1. 必须用 codex 自己的 subagent 分工。主会话一把梭 = 违规。
2. 每轮最多派: 1 只读 scout + 1 只读 analyst + 1 可写 surgeon。顺序执行。
3. 禁止碰 workers/auth/、src/App.jsx、src/useWerewolfGame.js。
   本轮只改 src/services/rolePrompts/、promptFactory.js、aiPrompts.js，
   以及 src/knowledge/*.json。
4. 每次改完必须 `npm run build` 通过；失败则本轮回滚。
5. 禁止 git push。只本地 commit，交给人类审查。
6. pending 为空时，调用 src/agents/headlessGame.mjs 跑一局生成真数据；
   禁止手写假 game log 喂进队列。

==== 五步循环 ====

Step 1 — scout(只读): 盘点
  - 读 pending/ 与 case_library/ 最新 3~5 条 improved_prompts_*.json
  - 读 successful_prompts.json / model_weaknesses.json / role_insights.json
  - 读 CHANGELOG.md 顶部
  产出: <250 字报告，答清 "还有几条未应用建议、距离收敛还有几轮"

Step 2 — analyst(只读): 选一条
  按 (置信度 × 影响) / 风险 排序，选 top-1 未应用建议。
  产出决策单: {目标文件, 锚点, 改动摘要, 预期指标, 回滚方式}
  若无值得改的 → 跳 Step 5 记 "本轮无改动"

Step 3 — surgeon(可写): 落地
  - 只改 1 个文件，用精确 Edit 锚点
  - 新增内容用 existingRoles / gameSetup 条件化
  - 同步更新 src/knowledge/successful_prompts.json 记录改动元数据
  - `npm run build` 验证；失败则回滚本轮，记 "build 失败"

Step 4 — 闭环验证
  - 跑 `node src/agents/headlessGame.mjs` 新一局
  - 跑 `node src/agents/reviewPipeline.mjs --local`
  - 读最新 bug_report_*.json：上轮建议是否仍出现？出现 = 无效回滚
  - 计算本轮 issues 改进百分比

Step 5 — 记录
  - CHANGELOG.md 顶部追加 "## [YYYY-MM-DD] 自我进化循环 第 N 轮"
  - git commit（不 push）
  - stdout 打印: 改了什么 / 改进百分比 / 下一轮候选

==== 停机条件 ====
A. 连续 5 轮 < 5% → 收敛，写 src/knowledge/versions/convergence_report_*.md
B. 连续 2 轮 build 失败 → 系统问题，停机等人类
C. headless driver 失败 → 停机并列出需要人类做什么
D. 累计 commit ≥ 6 → 交人类批量审查

==== 第一轮起点 ====
先派 scout 做 Step 1 全状态盘点。不要假设 pending 为空就立刻跑新局——
先读最新 improved_prompts_*.json 里的未应用建议。如果有未应用建议，
本轮的 Step 3 直接应用其中一条，Step 4 再跑新局验证效果。
如果全部已应用或仅剩 2 条种子案例毫无指导意义，再走 headless driver 生成新数据。

每步先打印 "我现在派 [agent_name]，输入是 X，期望产出是 Y"，再真正调用。
过程可见性优先于执行速度。

开始第一轮。
```

## 不做什么

- **不会** 自动 `git push`（指令里显式禁止）
- **不会** 重写 workers/auth 或游戏状态机
- **不会** 改动 rolePrompts 以外的核心代码
- **不会** 在没有真 game log 的情况下捏造数据

## 产出物

每轮成功迭代后可见：
- CHANGELOG.md 顶部一条新记录
- src/knowledge/case_library/ 多出一对 bug_report + improved_prompts
- src/services/rolePrompts/*.js 至少一处条件化改动
- 本地新 commit（未 push）
