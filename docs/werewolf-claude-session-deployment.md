# 狼人杀 AI：ECS Claude/MiniMax 单局会话部署

这套模式把狼人杀 AI 从浏览器直连 ModelScope 切到服务端会话：

```text
Browser
-> https://zhaxiaoji.com/api/werewolf/session/ask
-> Cloudflare Worker
-> ECS bt-server /bt/session/ask
-> MiniMax Anthropic-compatible Messages API
```

核心目标：

- API key 只放在 ECS/PM2 环境里，不进入 `VITE_*` 前端包。
- 一局游戏使用同一个 `gameSessionId`，服务端保存该局的 public transcript 和每个玩家自己的 agent memory。
- 每个 AI 玩家是同一局会话里的独立 agent，不共享其它玩家的私有夜间记忆。
- 如果服务端会话失败，前端仍会回退到旧 LLM 管线，方便灰度。

## 本地开关

本地或构建环境只需要公开“使用服务端会话模式”，不要公开 MiniMax key：

```env
VITE_AI_PROVIDER=ecs-session
VITE_WEREWOLF_AI_MODE=session
```

不要在生产使用：

```env
VITE_MINIMAX_API_KEY=...
```

`VITE_` 会被 Vite 打进浏览器 bundle，等于把 key 发给所有访问者。

如果真实 MiniMax key 曾经出现在聊天、截图、`.env` 的 `VITE_*` 变量或浏览器 bundle 里，建议到平台后台立即轮换一次。之后只把新 key 放进 ECS 的服务端环境。

## ECS 环境变量

在 ECS 上把密钥放到 root-only 环境文件，例如：

```bash
install -d -m 700 /root/.config/wolfgame
nano /root/.config/wolfgame/werewolf-ai.env
chmod 600 /root/.config/wolfgame/werewolf-ai.env
```

文件内容：

```bash
MINIMAX_API_KEY="your-minimax-key"
MINIMAX_API_URL="https://api.minimaxi.com/anthropic/v1/messages"
MINIMAX_MODEL="MiniMax-M2"
WEREWOLF_SESSION_TIMEOUT_MS="45000"
```

如果要在服务器上同时安装 Claude Code：

```bash
npm i -g @anthropic-ai/claude-code
```

当前游戏运行时走的是 MiniMax Anthropic-compatible Messages API，因为它比每步拉起 CLI 更稳定、延迟更低。Claude Code 可以作为服务器运维/调试工具保留；不要把游戏每个行动做成临时 CLI 进程。

## PM2 配置

`ecosystem.config.cjs` 已包含服务端会话所需 env key 名。生产建议通过 shell 加载私密 env 后重启：

```bash
cd /var/www/wolfgame
set -a
. /root/.config/wolfgame/werewolf-ai.env
set +a

pm2 restart ecosystem.config.cjs --update-env
pm2 save
pm2 env 0 | grep -E "MINIMAX|WEREWOLF_SESSION|PORT"
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

部署：

```bash
cd /var/www/wolfgame
export VITE_AI_PROVIDER=ecs-session
export VITE_WEREWOLF_AI_MODE=session
npm run build || exit 1
npm exec -- wrangler deploy --assets ./dist
```

## 验证

健康检查：

```bash
curl --noproxy '*' -i https://novel-origin.zhaxiaoji.com/health
```

服务端会话接口测试，不要带真实玩家秘密也可以跑通结构：

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
    "_sessionInfo": {
      "mode": "single-match-multi-agent"
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

npm run build || exit 1
pm2 restart ecosystem.config.cjs --update-env
pm2 save
npm exec -- wrangler deploy --assets ./dist
```

## 排障

- 游戏设置页还提示 ModelScope token：确认前端构建时有 `VITE_WEREWOLF_AI_MODE=session`。
- `/api/werewolf/session/ask` 返回 502：看 `pm2 logs bt-server --lines 80`，通常是 `MINIMAX_API_KEY` 没进 PM2 环境。
- 线上前端没变化：先确认 `npm run build` 成功，再确认 `wrangler deploy` 上传了新 assets。
- 单局记忆丢失：PM2 重启会清空内存会话；这是当前设计。需要跨重启保留时，再把 session 写入 SQLite。
