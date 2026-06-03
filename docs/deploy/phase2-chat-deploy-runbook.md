# Phase 2 实时聊天 — 部署手册（手动）

> 本功能后端跨 **CF Worker + D1** 与 **ECS（Aliyun, PM2 bt-server）**。Worker/D1 这边可由本地 `npm run deploy` + wrangler 完成；**ECS 这边必须手动 SSH 操作**（无 CI、无 ssh-workspace MCP）。按本手册顺序执行。

## 0. 前置概念（来自 understand 工作流核实）

- ECS：PM2 app `bt-server`，cwd `/var/www/wolfgame`，端口 `3001`；env 文件 `/root/.config/wolfgame/werewolf-ai.env`（mode 600）。
- 对外：`novel-origin.zhaxiaoji.com` = Cloudflare Tunnel(cloudflared) → nginx → `127.0.0.1:3001`。
- WS 地址：浏览器直连 `wss://novel-origin.zhaxiaoji.com/ws/chat`（CF Worker 无法转发 WS 升级）。
- token 经 `Sec-WebSocket-Protocol` 子协议传，不进 URL/nginx 访问日志。
- **鉴权委托**：ECS **不持有 JWT_SECRET**。WS 握手时把 token 交给 Worker `GET /api/me` 验证。ECS 只需要 `CHAT_SERVICE_TOKEN`（持久化回调用）。
- **顺序铁律**：先 D1 迁移 + Worker 部署（含 persist 端点 + /api/me 返回 user.id 修复），再 ECS 重启。否则 ECS 的 persist 回调打到旧 Worker → 500，且鉴权委托拿不到 user.id。

## 1. 准备 secret（只需 ECS 一侧持有 CHAT_SERVICE_TOKEN）

CF Worker（本地执行）：
```bash
# 已在本次发布中设好 CHAT_SERVICE_TOKEN（wrangler secret put）。如需轮换重设即可。
npx wrangler secret list                       # 应能看到 CHAT_SERVICE_TOKEN
```

ECS（SSH 到机器）——只写 service token（**不再需要 JWT_SECRET**）：
```bash
ssh <ecs>
vi /root/.config/wolfgame/werewolf-ai.env
#   追加一行（值与 Worker 的 CHAT_SERVICE_TOKEN secret 完全一致）：
#   CHAT_SERVICE_TOKEN=<与 Worker secret 相同>
chmod 600 /root/.config/wolfgame/werewolf-ai.env
```
> ✅ 不再有"JWT_SECRET 两边必须字节一致"的脆弱耦合——握手鉴权全部委托给 Worker `/api/me`。CHAT_SERVICE_TOKEN 仅用于 persist 回调；不一致只会导致写库 403（持久化失败），不影响连接/收发本身（消息仍实时转发，只是不入库——日志会报 `persist 403`）。

## 2. D1 迁移（生产）

本地执行：
```bash
npx wrangler d1 execute wolfgame-db --remote --file=./migrations/005_chat_messages.sql
```

## 3. 部署 Worker（含 chat 路由 + persist 端点）

本地执行（沿用 CLAUDE.md 流程 + fingerprint 核对）：
```bash
npm run build
npm run deploy
# 部署后核对（CLAUDE.md §B）：prod=local、bundle 0 个 localhost
# 验证新路由存在（401 而非 404 即正确）：
curl -s -o /dev/null -w "%{http_code}\n" "https://zhaxiaoji.com/api/chat/history?friendId=1"   # 期望 401
```

## 4. nginx 加 WebSocket 升级 location（ECS）

在 `novel-origin.zhaxiaoji.com` 对应的 server 块里加（与现有 `/novel/` location 同级）：
```nginx
location /ws/chat {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_read_timeout 3600s;          # 长连接
    access_log off;                     # token 在子协议头里，本就不进 $request；这里再保险
}
```
```bash
nginx -t && systemctl reload nginx
```

## 5. cloudflared（ECS）

cloudflared 默认透传 WebSocket（101 升级），通常无需改动。若用显式 ingress rules，确认 `novel-origin.zhaxiaoji.com` 指向本机 nginx（或 `http://localhost:3001`）。重启隧道（如有改动）：`systemctl restart cloudflared`。

## 6. 部署 ECS 代码 + 重启（注意 server/package.json 变了，要 npm install）

```bash
ssh <ecs>
cd /var/www/wolfgame
git pull
cd server && npm install && cd ..          # ws 是新依赖
set -a && . /root/.config/wolfgame/werewolf-ai.env && set +a
pm2 restart ecosystem.config.cjs --update-env
pm2 save
```
立即看日志确认 JWT 自检 + 不破坏原服务：
```bash
pm2 logs bt-server --lines 40 --nostream
#   期望看到：[chatSocket] worker https://zhaxiaoji.com reachable (HTTP 200/503)
#   若 WARN worker unreachable → 检查 CHAT_WORKER_URL / 出网；鉴权委托与 persist 都依赖它
curl --noproxy '*' http://127.0.0.1:3001/health      # REST 仍正常（200）
```

## 7. 端到端 WS 烟测（从本地，token 走子协议）

用 wscat（token 放子协议，不放 URL）：
```bash
# 先拿一个有效 JWT（登录任意账号后从浏览器 localStorage 'wolfgame_auth_token' 复制，或登录接口返回）
TOKEN='<jwt>'
npx wscat -c "wss://novel-origin.zhaxiaoji.com/ws/chat" -s "bearer" -s "$TOKEN" -H "Origin: https://zhaxiaoji.com"
#   期望：连接成功，收到 {"type":"presence:init",...}
#   无 -s token / 错 token → 连接被拒（401）
```
> wscat 用 `-s <subprotocol>` 传子协议；传两个：`bearer` 和 token。

真人验证：两个真实账号登录 `https://zhaxiaoji.com` → 互为好友 → 进「好友」选中对方 → 发消息应实时到达、刷新后历史还在、对方在线圆点变绿、输入时显示「对方正在输入…」。

## 8. 前端本地联调（可选）

`.env.development.local`（**绝不** `.env.local`）：
```
VITE_CHAT_WS_URL=ws://localhost:3001/ws/chat
```
本地起 ECS：`cd server && JWT_SECRET=xxx CHAT_SERVICE_TOKEN=yyy CHAT_WORKER_URL=http://localhost:8787 WS_ALLOW_LOCAL_ORIGIN=1 node index.js`（或 `npm run dev`）。

## 9. 回滚

WS 故障不影响 REST：
```bash
ssh <ecs> 'cd /var/www/wolfgame && git revert <ecs-commit> && pm2 restart ecosystem.config.cjs --update-env'
```
好友系统 + 聊天历史（REST）仍可用，仅实时收发摘除。Worker/D1 无需回滚（chat_messages 表与 history 端点是增量、向后兼容）。

## 10. 部署后核对清单

- [ ] `curl .../api/chat/history?friendId=1` → 401（路由在）
- [ ] `pm2 logs bt-server` 见 `worker ... reachable`
- [ ] `wscat` 连 `wss://novel-origin.zhaxiaoji.com/ws/chat`（子协议带 token）→ 收到 presence:init
- [ ] 两真人实时收发 + 历史 + presence + typing 正常
- [ ] `/health`、`/bt/*`、`/novel/*` 仍正常（http.createServer 重构未伤及）
