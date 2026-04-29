# 狼人杀 AI：Aliyun Claude Code + MiniMax Coding Plan 部署

这套模式把狼人杀 AI 从浏览器直连 ModelScope，改成由 Aliyun ECS 上的 Claude Code 作为游戏 AI runtime：

```text
Browser
-> https://zhaxiaoji.com/api/werewolf/session/ask
-> Cloudflare Worker
-> ECS bt-server /bt/session/ask
-> Claude Code CLI
-> MiniMax Coding Plan / Anthropic-compatible provider
```

核心目标：

- API key 只放在 ECS/PM2 环境里，不进入 `VITE_*` 前端包。
- 一局游戏使用同一个 `gameSessionId`。
- bt-server 保存该局 public transcript 和每个玩家自己的 private agent memory。
- Claude Code 返回 `session_id` 时，bt-server 会在同一局后续动作里用 `--resume <session_id>` 续接。
- 每个 AI 玩家仍然是同一局里的独立 agent，不共享其他玩家的私有夜间记忆。
- Claude Code 的 trace、stderr、system prompt 不会返回给前端 UI；前端只拿游戏 JSON。

## 前端开关

本地或生产构建只公开“使用 ECS 会话模式”，不要公开 MiniMax key：

```env
VITE_AI_PROVIDER=ecs-session
VITE_WEREWOLF_AI_MODE=session
```

不要在生产使用：

```env
VITE_MINIMAX_API_KEY=...
```

`VITE_` 会被 Vite 打进浏览器 bundle，等于把 key 发给所有访问者。如果真实 MiniMax key 曾经出现在聊天、截图、`.env` 的 `VITE_*` 变量或浏览器 bundle 里，建议到平台后台立即轮换一次。

## ECS 安装 Claude Code

在 Aliyun ECS 上安装 Claude Code：

```bash
npm i -g @anthropic-ai/claude-code
which claude
claude --version
```

如果 `which claude` 输出不是 `/usr/local/bin/claude`，后面把 `CLAUDE_CODE_BIN` 改成实际路径。

## ECS 环境变量

把密钥和 Claude Code runtime 配置放到 root-only 环境文件：

```bash
install -d -m 700 /root/.config/wolfgame
nano /root/.config/wolfgame/werewolf-ai.env
chmod 600 /root/.config/wolfgame/werewolf-ai.env
```

推荐内容：

```bash
# Wolfgame runtime: use Claude Code, not direct browser/API calls.
WEREWOLF_SESSION_PROVIDER="claude-code"
WEREWOLF_SESSION_TIMEOUT_MS="90000"

# Claude Code CLI.
CLAUDE_CODE_BIN="/usr/local/bin/claude"
CLAUDE_CODE_ARGS="--print --output-format json"
CLAUDE_CODE_SESSION_ROOT="/var/lib/wolfgame/claude-sessions"
CLAUDE_CODE_RESUME="true"

# MiniMax Coding Plan key used by Claude Code. Use your sk-cp-... key here.
MINIMAX_API_KEY="sk-cp-your-rotated-codingplan-key"
ANTHROPIC_AUTH_TOKEN="sk-cp-your-rotated-codingplan-key"
ANTHROPIC_API_KEY="sk-cp-your-rotated-codingplan-key"
ANTHROPIC_BASE_URL="https://api.minimaxi.com/anthropic"
ANTHROPIC_MODEL="MiniMax-M2.7"

# Direct API fallback only. Keep it configured, but do not use it unless
# WEREWOLF_SESSION_PROVIDER is changed to minimax-api.
MINIMAX_API_URL="https://api.minimaxi.com/anthropic/v1/messages"
MINIMAX_MODEL="MiniMax-M2.7"
```

如果你的 Claude Code/MiniMax 接入把 `codingplan` 暴露成模型名或 profile，可以用 `CLAUDE_CODE_ARGS` 覆盖默认参数，例如：

```bash
CLAUDE_CODE_ARGS="--print --output-format json --model codingplan"
```

代码会自动给没有 `--model` 的 `CLAUDE_CODE_ARGS` 追加 `--model $ANTHROPIC_MODEL`；默认模型是 `MiniMax-M2.7`。如果你手动写了 `--model codingplan`，就会以手动参数为准。

创建 Claude Code 单局 workspace 根目录：

```bash
install -d -m 700 /var/lib/wolfgame/claude-sessions
```

## PM2 配置

`ecosystem.config.cjs` 已把这些 env key 传给 `bt-server`。生产重启前先加载私密 env：

```bash
cd /var/www/wolfgame
set -a
. /root/.config/wolfgame/werewolf-ai.env
set +a

pm2 restart ecosystem.config.cjs --update-env
pm2 save
pm2 env 0 | grep -E "WEREWOLF_SESSION|CLAUDE_CODE|ANTHROPIC|MINIMAX|PORT"
```

## Cloudflare Worker

Worker 会把：

```text
/api/werewolf/session/ask
```

代理到：

```text
ECS_BT_URL + /bt/session/ask
```

`wrangler.toml` 继续使用稳定 Tunnel：

```toml
ECS_BT_URL = "https://novel-origin.zhaxiaoji.com"
ECS_NOVEL_URL = "https://novel-origin.zhaxiaoji.com"
```

部署前端和 Worker Assets：

```bash
cd /var/www/wolfgame
export VITE_AI_PROVIDER=ecs-session
export VITE_WEREWOLF_AI_MODE=session
npm run build || exit 1
npm exec -- wrangler deploy --assets ./dist
```

## 验证

先验证 ECS origin：

```bash
curl --noproxy '*' -i https://novel-origin.zhaxiaoji.com/health
```

再验证 Claude Code 自己能通过 MiniMax 返回结果：

```bash
cd /var/www/wolfgame
set -a
. /root/.config/wolfgame/werewolf-ai.env
set +a

printf 'Return exactly {"ok":true} and nothing else.\n' \
  | "$CLAUDE_CODE_BIN" $CLAUDE_CODE_ARGS
```

然后验证狼人杀服务端会话接口：

```bash
curl --noproxy '*' -sS -X POST https://novel-origin.zhaxiaoji.com/bt/session/ask \
  -H "Content-Type: application/json" \
  -d '{
    "gameSessionId":"manual-test",
    "player":{"id":1,"name":"AI-1","role":"村民","isAlive":true},
    "actionType":"DAY_SPEECH",
    "systemInstruction":"你是狼人杀玩家。只输出 JSON。",
    "prompt":"请输出 {\"speech\":\"测试发言\",\"voteIntention\":null,\"identity_table\":{}}",
    "gameStateMeta":{"dayCount":1,"phase":"day_discussion"}
  }' | jq .
```

预期返回：

```json
{
  "success": true,
  "result": {
    "speech": "...",
    "_modelInfo": {
      "provider": "claude-code-minimax-codingplan"
    },
    "_sessionInfo": {
      "mode": "claude-code-single-match-multi-agent"
    }
  }
}
```

## 部署顺序

```bash
cd /var/www/wolfgame
git pull --ff-only
npm install
npm install --prefix server

export VITE_AI_PROVIDER=ecs-session
export VITE_WEREWOLF_AI_MODE=session

set -a
. /root/.config/wolfgame/werewolf-ai.env
set +a

install -d -m 700 /var/lib/wolfgame/claude-sessions
npm run build || exit 1
pm2 restart ecosystem.config.cjs --update-env
pm2 save
npm exec -- wrangler deploy --assets ./dist
```

## 回退到直连 MiniMax API

如果 Claude Code runtime 临时不可用，可以只在 ECS 环境里改：

```bash
WEREWOLF_SESSION_PROVIDER="minimax-api"
```

然后：

```bash
set -a
. /root/.config/wolfgame/werewolf-ai.env
set +a
pm2 restart ecosystem.config.cjs --update-env
```

这会绕过 Claude Code，直接走 `MINIMAX_API_URL`。这只是应急回退，不是主方案。

## 排障

- 游戏设置页还提示 ModelScope token：确认前端构建时有 `VITE_WEREWOLF_AI_MODE=session`。
- `/api/werewolf/session/ask` 返回 502：看 `pm2 logs bt-server --lines 80`。
- 报 `spawn claude ENOENT`：`CLAUDE_CODE_BIN` 路径不对，先跑 `which claude`。
- Claude Code 卡住或超时：确认 `CLAUDE_CODE_ARGS` 包含 `--print --output-format json`，且 MiniMax provider 鉴权可用。
- Claude Code 输出不是 JSON：先用上面的 `printf ... | "$CLAUDE_CODE_BIN" $CLAUDE_CODE_ARGS` 测试 CLI，再看 prompt 是否被模型忽略。
- 线上前端没变化：先确认 `npm run build` 成功，再确认 `wrangler deploy` 上传了新 assets。
- 单局记忆丢失：bt-server 内存里的 public/private memory 会在 PM2 重启后清空；Claude Code 自己的 session workspace 仍在 `CLAUDE_CODE_SESSION_ROOT` 下，但游戏侧短期记忆需要后续接 SQLite 才能跨重启完整恢复。
