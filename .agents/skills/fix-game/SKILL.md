---
name: fix-game
description: 排查并修复狼人杀游戏流程/记录/AI 决策相关问题。
---

## 关键文件（按问题类型定位）

| 问题类型 | 优先检查 |
|---|---|
| 夜间行动与结算 | `src/App.jsx`（`executeNightAction` / `resolveNight`） |
| 白天发言/投票/结算 | `src/hooks/useDayFlow.js` |
| 状态与历史记录结构 | `src/useWerewolfGame.js` |
| AI 决策/上下文 | `src/hooks/useAI.js` + `src/services/aiPrompts.js` |
| 角色/配置 | `src/config/roles.js` |

## 调试关键词（控制台搜索）

- `[夜间行动]`：夜间流程推进
- `[发言控制]`：发言顺序/锁
- `[GameCheck]`：胜负判断
- `AI 响应` / 各角色 `xxxAI`：模型返回与校验

## 常见坑位

1. “阶段跳转过早”：确认是否需要 `day_resolution` 做链式结算，再进入 `day_discussion`
2. “记录丢失/错天数”：检查 `addCurrentPhaseAction` 是否带 `night/day` 与 `persist`，以及 reducer 是否持久化
3. “AI 幻觉出不存在的身份”：检查 `aiPrompts` 的 role pool 约束 + `identityTableSanitizer`

