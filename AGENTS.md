# battle-web（AI 狼人杀）- Codex 项目指南

本仓库已包含面向 Claude Code 的 `.claude/` 与 `CLAUDE.md`。下面是面向 **Codex CLI** 的等价工作流约定（配置、规则、skills），用于让 Codex 更稳定地理解项目结构与常用操作。

## 快速命令（PowerShell 友好）

- 开发：`npm.cmd run dev`
- 构建：`npm.cmd run build`
- 预览：`npm.cmd run preview`
- 部署：`npm.cmd run deploy`（内部会调用 wrangler）

PowerShell 注意：
- 避免使用 `&&`；改用多行或 `;`
- 本机可能禁用 `npx.ps1`，优先用 `npm.cmd`/`node ...`/`npm exec`（或开启脚本执行策略）

## 代码地图（改逻辑先看这里）

- `src/App.jsx`：游戏主流程、夜晚步骤推进、`resolveNight`（天亮结算入口）
- `src/hooks/useDayFlow.js`：白天发言→投票→结算；猎人开枪与连锁开枪逻辑
- `src/useWerewolfGame.js`：全局 reducer；历史记录结构（speech/vote/death/actions）
- `src/hooks/useAI.js`：LLM 调用封装、模型自动切换追踪、`identity_table` 清洗
- `src/services/aiPrompts.js`：提示词模板（渐进披露）；身份推理表约束
- `src/config/aiConfig.js`：AI Provider / API URL / 模型列表
- `workers/auth/*`：Cloudflare Workers 后端（JWT、Token、用户）

## 游戏流程关键约定

- 新增阶段：`day_resolution`
  - 位置：夜晚结算结束后、进入白天讨论（`day_discussion`）之前
  - 目的：处理“天亮结算期”的连锁事件（目前是猎人连锁开枪；未来可扩展更多角色）
  - 规则：结算阶段未完成前，**不得**进入发言/投票阶段

## 域名与 API 约定（必须遵守）

- **唯一域名**：前端与后端统一使用 `https://zhaxiaoji.com`
- **API Base**：前端 `VITE_AUTH_API_URL` 必须指向 `https://zhaxiaoji.com`（或同域）
- **禁止**使用任何 `*.workers.dev` 作为线上 API 入口，避免 D1 绑定混乱与调试困难

## 历史记录约定

- `nightActionHistory` 名称虽为“夜间行动”，但也承载少量白天公共行动（例如 `猎人开枪`）
- 通过 `addCurrentPhaseAction({ ..., persist: true })` 控制是否持久化进 `nightActionHistory`

## Codex 项目配置（仓库内）

- `.codex/config.toml`：本项目的 Codex 运行偏好（沙盒/审批/verbosity 等）
- `.codex/rules/*.rules`：命令放行规则（对齐 `.claude/settings.local.json` 的 allowlist 语义）
- `.agents/skills/*`：项目 skills（对齐 `.claude/commands/*`）

常用 skills：
- `$fix-game`：排查/修复游戏流程类问题
- `$add-api`：新增 Workers API 并在前端封装
- `$deploy`：构建并部署到 Cloudflare

## 提交前检查

- 运行：`npm.cmd run build`
- 不要提交：`.env`（已在 `.gitignore`）

