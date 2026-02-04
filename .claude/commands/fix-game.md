# 修复游戏逻辑

修复游戏相关问题时的检查清单。

## 关键文件

| 问题类型 | 检查文件 |
|---------|---------|
| 夜间行动 | `src/App.jsx` - `executeNightAction` |
| 白天发言 | `src/hooks/useDayFlow.js` |
| 投票逻辑 | `src/hooks/useDayFlow.js` - `handleAutoVote` |
| AI 决策 | `src/hooks/useAI.js` + `src/services/aiPrompts.js` |
| 游戏结束 | `src/App.jsx` - `checkGameEnd` |
| 状态管理 | `src/useWerewolfGame.js` |

## 调试方法

在控制台搜索以下关键词：
- `[夜间行动]` - 夜间流程日志
- `[发言控制]` - 发言顺序日志
- `[狼人AI]` / `[预言家AI]` / `[女巫AI]` / `[守卫AI]` - AI 决策日志
- `[GameCheck]` - 胜负判定日志

## 常见问题

1. **AI 不行动**: 检查 `askAI` 返回值，可能是 API 调用失败
2. **重复发言**: 检查 `speakingLockRef` 和 `speechHistory` 判断
3. **状态不更新**: 确认使用了正确的 setter，注意异步更新
