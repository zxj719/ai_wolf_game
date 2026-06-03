# 实时文字聊天 Phase 2 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Phase 1 好友系统之上，加入好友之间的 **1 对 1 实时文字聊天 + 在线状态(presence)**，消息持久化到 D1（单一数据源）。视频通话留给 Phase 3。

**Architecture:** 浏览器用原生 WebSocket **直连 ECS 源站** `wss://novel-origin.zhaxiaoji.com/ws/chat`（CF Worker 无法转发 WS 升级）。ECS 在现有 Express 进程内挂一个 `ws` 服务器（presence 表必须单进程，PM2 `instances:1`）。WS 服务在握手时用 **与 Worker 完全相同的 `verifyToken`** 验 JWT；收到消息后实时转发对方 + 回调 CF Worker `POST /api/internal/chat/persist`（带 service token）写 D1。历史消息走 Worker REST `GET /api/chat/history`。

**Tech Stack:** ECS Node ≥18 (ESM) + `ws` + 复用 `workers/auth/jwt.js`；CF Worker + D1；React 原生 WebSocket；Vitest（含 node 环境的双 ws 客户端集成测试）。

**关联 spec:** [docs/superpowers/specs/2026-06-03-friend-chat-video-design.md](../specs/2026-06-03-friend-chat-video-design.md) · **关联 Phase 1:** [2026-06-03-friend-system-phase1.md](2026-06-03-friend-system-phase1.md)

---

## ⚠️ 多代理对抗评审修订（实现以本节为准，覆盖下方原始草案）

> 本计划经过 4 个对抗评审代理（correctness / security / spec-consistency / react）+ 综合，发现 10 个 must-fix + 15 个 should-fix。以下修订**已并入实现**，与下方原始任务草案冲突时**以本节为准**。

**Must-fix（全部并入）：**
1. **WS 帧上限**：`new WebSocketServer({ noServer:true, maxPayload: 16*1024, perMessageDeflate:false })` —— 在协议层拦截超大帧，避免单进程内存耗尽 DoS（同进程还跑 LLM 代理）。
2. **每连接限流**：chatHub 内置令牌桶（`chat:message` ~5/s，`chat:typing` ~30/s），超限回 `chat:error{error:'rate limited'}`，可单测。
3. **每用户连接数上限**：`addConnection` 限 5 socket/用户，超限踢最旧。
4. **Token 不进 URL/日志**：握手 token 改走 **`Sec-WebSocket-Protocol` 子协议头**（`new WebSocket(url, ['bearer', token])`），不再用 `?token=`。服务端从 `sec-websocket-protocol` 读取并回显。runbook nginx `access_log` 仅记录 `$uri`。（JWT 全局不过期是既有决策，本期不改；此修订消除"永久凭证进日志"的急性风险。）
5. **persist 防伪造**：`handleInternalChatPersist` 在 INSERT 前校验 `(fromUser,toUser)` 确为好友（查 `friendships`）；service token 泄露也无法向任意会话写入。
6. **历史加载用合并不覆盖**：ConversationView 历史 `.then()` 用 `mergeById` 与已到达的实时消息并集，绝不 `setMessages(replace)`。
7. **分页游标用唯一 `id` 而非 `created_at`**：`WHERE conversation_key=? AND id<? ORDER BY id DESC LIMIT ?`，前端传最小已加载 `id` 作 `before`；迁移加索引 `(conversation_key, id)`。
8. **断线补拉**：useChatSocket 暴露 `reconnectNonce`（onopen 且 retry>0 时自增）；ConversationView 监听它，重连后重拉最近一页并按 id 合并去重。
9. **friendCache TTL + miss 重取**：缓存 30s；授权 `chat:message/typing` 时若目标不在缓存集则先重取一次，杜绝"刚加的好友发不出"假阴性。
10. **`meId={user.id}`**：删掉 `?? user.sub`（前端 user 对象只有 `id`，`sub` 是服务端 JWT claim）。

**Should-fix（并入，廉价且高价值）：**
- StrictMode 安全重连：关闭意图绑定到**具体 socket 实例**（`ws._closedByUs`），不是共享 ref；`setTimeout` 重连前 `if (wsRef.current!==ws) return`；enabled 副作用顶部重置 `retryRef=0`。
- 乐观消息 React key 用 `m.clientMsgId ?? m.id`（ack 后 id 到位不 remount）。
- 收消息去重按 `clientMsgId` 优先、其次 `id`：命中 pending 则**原地替换**（补 id/createdAt、清 pending），否则 append；`msg.id!=null` 守卫。
- 多标签：persist 后把消息也回显给**发送者其它连接**（`for c of connections.get(userId) if c!==conn`）。
- 自动滚到底：`endRef` + `scrollIntoView` on `[messages]`。
- 失败/pending 态在 MessageList 渲染（pending 半透明、failed 红 + 可重试）。
- ConversationView 订阅副作用依赖 `[subscribe, friend.id]`（解构出稳定的 `subscribe`），不依赖整个 `chat` 字面量。
- typing：MessageInput 去抖（活跃时 ~1s 一次 true，~3s 空闲/发送后 false）；ConversationView 订阅 `chat:typing`（`from===friend.id`）渲染"对方正在输入…"；chatHub 转发保留 `from`。
- `addConnection` 在接 `ws.on('close')` 前 `await`；`removeConnection` 离线集为空时重新求好友集；上线广播仅在 `size===1` 时发（多标签不重复 ping）。
- 文本上限按字节：chatHub `Buffer.byteLength(text,'utf8')<=8192 && text.length<=4000`；Worker 同样校验。
- dev Origin 放行改显式开关 `WS_ALLOW_LOCAL_ORIGIN==='1'`（不靠 `NODE_ENV!=='production'`，防 NODE_ENV 未设时误开）。
- `sub` 校验：`Number.isInteger(sub)&&sub>0`（拒 `sub:0`/非数）；自检用正整数合成 id，绝不真开连接。
- 未知 upgrade 路径：`socket.destroy()`（当前唯一消费者）。

**词汇约定（避免实现漂移）**：WS 线协议用 `from`/`to`；REST persist body + D1 列 + history 行 + 前端用 `fromUser`/`toUser`；**ConversationView 是唯一翻译点**。presence 用 `presence:init`（全量快照 `{online:[...]}`）+ `presence`（增量 `{userId,online}`）两种，三处（chatHub/useChatSocket/测试）保持一致。

**Optional（本期不做，注释留痕）**：persist 幂等（`UNIQUE(conversation_key,from_user,clientMsgId)` + 重试）、read receipts（`read_at` 列保留但无 markRead 端点，history 不返回 readAt 以免误导）、call:* Phase 3 stub 注释。

---

---

## 已锁定决策（来自 understand 工作流 + 用户确认）

| 决策 | 选择 | 理由 |
|---|---|---|
| WS 挂载 | **同进程**：`server/index.js` 改 `http.createServer(app)` + `WebSocketServer({noServer:true})` | presence Map 必须单进程；PM2 instances:1；聊天流量极小不会饿死 LLM 代理 |
| WS 地址 | **`wss://novel-origin.zhaxiaoji.com/ws/chat`** | CF Worker 无法转发 WS 升级；novel-origin 的 Tunnel→ECS 路径已被 REST 验证过 |
| 消息存储 | **D1 单一数据源**，WS 仅中继 + 回调 Worker 持久化 | 与 CLAUDE.md「D1 是数据库」一致 |
| JWT 验证 | ECS **复用** `workers/auth/jwt.js` 的 `verifyToken`（Node 18+ webcrypto） | 与 Worker 字节级一致，避免逻辑漂移 |
| JWT_SECRET / CHAT_SERVICE_TOKEN 投递 | 从 `/root/.config/wolfgame/*.env`（mode 600）source，**绝不**提交进 ecosystem.config.cjs | 沿用现有 API key 管理方式 |
| WS 握手鉴权 | `?token=` 查询参数，在 upgrade 处理器里验签，失败立即拒绝 101 | 无效连接根本不进 presence 表 |
| 部署 | **手动**（SSH+git pull+pm2 restart+nginx WS 规则）；本计划交付代码 + 部署手册，不自动上线 | 无 ssh-workspace MCP；ECS 只能人工运维 |

---

## 关键既有约定（实现者必读）

- ECS 入口 `server/index.js`：`const app = express()`（:126），CORS 在 :136-146（**注意：cors 中间件不覆盖 WS upgrade**），`app.listen(PORT)` 在 :543，`PORT` 默认 3001。启动时有 fail-fast 模式 `checkProviderConfig`（:550）——WS 的 JWT 自检要模仿这个「大声失败」模式。
- `server/` 是 ESM（`type:module`），可 `import` 同仓库 `../workers/auth/jwt.js` 与 `../src/...`（index.js 已这么做）。
- `workers/auth/jwt.js` 导出 `signToken(payload, secret)` 与 `verifyToken(token, secret)`，HS256/Web Crypto；JWT 载荷 `{ sub, username, email }`，**`ENABLE_JWT_EXPIRY=false`（token 永不过期）**。
- Worker 响应助手：`jsonResponse/errorResponse`（middleware.js）；D1：`env.DB.prepare().bind().first()/.all()/.run()`。
- Worker `authMiddleware(request, env)` → `{ user }`，`user.sub` 是用户 id。
- 前端 token：`getToken()`（`src/utils/authToken.js`，localStorage `wolfgame_auth_token`）。WS URL 要自己拼 token。
- Phase 1 已有：`friendsLib.normalizeFriendship`、`friends.js` 5 个端点、`chat` 模块（ChatRoute + 展示组件）、`friendService`。
- 测试：`npx vitest run <path>`；组件用 `renderToStaticMarkup`；**WS 集成测试文件首行加 `// @vitest-environment node`**（根 vite.config 默认 jsdom）。
- 环境变量铁律（CLAUDE.md）：`VITE_CHAT_WS_URL` 的本地 dev override 必须放 `.env.development.local`，**绝不** `.env.local`，否则 localhost 漏进生产 bundle，`check-build.mjs` fail build。

---

## File Structure

| 文件 | 操作 | 职责 |
|---|---|---|
| `migrations/005_chat_messages.sql` | 新建 | `chat_messages` 表 + 会话索引 |
| `workers/auth/chatLib.js` | 新建 | 纯函数：`conversationKey`、`parseHistoryParams` |
| `workers/auth/__tests__/chatLib.test.js` | 新建 | chatLib 单测 |
| `workers/auth/chat.js` | 新建 | Worker handlers：`history`（JWT）、`internalPersist`（service token） |
| `workers/auth/index.js` | 修改 | 注册 `/api/chat/history`、`/api/internal/chat/persist` 路由 |
| `server/chatHub.js` | 新建 | **可测核心**：连接表 + 消息路由 + presence（依赖注入 persist/getFriends） |
| `server/chatSocket.js` | 新建 | WS 接线：upgrade 验签/验 Origin、启动自检、真实 persist/getFriends fetch |
| `server/__tests__/chatHub.test.js` | 新建 | chatHub 纯逻辑单测（mock socket/persist/getFriends） |
| `server/__tests__/chatSocket.integration.test.js` | 新建 | 双 ws 客户端集成测试（node 环境，临时端口） |
| `server/index.js` | 修改 | `app.listen` → `http.createServer(app)` + 挂 WS（最小改动） |
| `server/package.json` | 修改 | 加 `ws` 依赖 |
| `ecosystem.config.cjs` | 修改 | env 块加 `JWT_SECRET`/`CHAT_SERVICE_TOKEN`（透传 `process.env`，不写明文） |
| `src/services/friendService.js` | 修改 | 加 `getHistory(api, friendId, before, limit)` |
| `src/hooks/useChatSocket.js` | 新建 | WS 连接/重连/收发/presence/ack hook |
| `src/modules/chat/components/MessageList.jsx` | 新建 | 展示型：消息气泡列表 |
| `src/modules/chat/components/MessageInput.jsx` | 新建 | 展示型：输入框 + typing 上报 |
| `src/modules/chat/components/ConversationView.jsx` | 新建 | 会话容器（历史 + 实时 + 输入） |
| `src/modules/chat/ChatRoute.jsx` | 修改 | 选中好友 → 打开 ConversationView；接 useChatSocket、presence 圆点 |
| `src/modules/chat/__tests__/messageComponents.test.jsx` | 新建 | MessageList/MessageInput 冒烟测试 |
| `docs/deploy/phase2-chat-deploy-runbook.md` | 新建 | 手动部署手册（nginx WS、cloudflared、secrets、迁移、顺序、烟测） |

---

## Task 1: D1 迁移 — chat_messages

**Files:** Create `migrations/005_chat_messages.sql`

- [ ] **Step 1: 写迁移**

```sql
-- 005: 私聊消息（Phase 2）
CREATE TABLE IF NOT EXISTS chat_messages (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_key TEXT    NOT NULL,     -- "minId:maxId"
  from_user        INTEGER NOT NULL,
  body             TEXT    NOT NULL,
  created_at       INTEGER NOT NULL,     -- epoch ms，也作断线补拉游标
  read_at          INTEGER               -- NULL = 未读
);
CREATE INDEX IF NOT EXISTS idx_chat_conv ON chat_messages(conversation_key, created_at);
```

- [ ] **Step 2: 本地应用 + 验证**

Run:
```bash
npx wrangler d1 execute wolfgame-db --local --file=./migrations/005_chat_messages.sql
npx wrangler d1 execute wolfgame-db --local --command="SELECT name FROM sqlite_master WHERE type='table' AND name='chat_messages';"
```
Expected: 返回 `chat_messages`。

- [ ] **Step 3: Commit**
```bash
git add migrations/005_chat_messages.sql
git commit -m "feat(chat): add chat_messages D1 migration (phase 2)"
```
> ⚠️ 生产迁移见部署手册，本地验证通过后由运维执行 `--remote`。

---

## Task 2: Worker 纯函数库 chatLib

**Files:** Create `workers/auth/chatLib.js`, Test `workers/auth/__tests__/chatLib.test.js`

- [ ] **Step 1: 写失败测试**

```js
import { describe, expect, it } from 'vitest';
import { conversationKey, parseHistoryParams } from '../chatLib.js';

describe('conversationKey', () => {
  it('is order-independent (min:max)', () => {
    expect(conversationKey(7, 3)).toBe('3:7');
    expect(conversationKey(3, 7)).toBe('3:7');
  });
  it('coerces numeric strings', () => {
    expect(conversationKey('10', '2')).toBe('2:10');
  });
  it('throws on equal ids', () => {
    expect(() => conversationKey(5, 5)).toThrow();
  });
});

describe('parseHistoryParams', () => {
  it('defaults before=null and clamps limit to 1..100 (default 30)', () => {
    expect(parseHistoryParams({ friendId: '4' })).toEqual({ friendId: 4, before: null, limit: 30 });
  });
  it('parses before + limit', () => {
    expect(parseHistoryParams({ friendId: '4', before: '1000', limit: '10' }))
      .toEqual({ friendId: 4, before: 1000, limit: 10 });
  });
  it('clamps limit above 100 down to 100 and below 1 up to 1', () => {
    expect(parseHistoryParams({ friendId: '4', limit: '500' }).limit).toBe(100);
    expect(parseHistoryParams({ friendId: '4', limit: '0' }).limit).toBe(1);
  });
  it('returns null friendId when invalid', () => {
    expect(parseHistoryParams({ friendId: 'x' }).friendId).toBeNull();
  });
});
```

- [ ] **Step 2: 跑测试确认失败** — `npx vitest run workers/auth/__tests__/chatLib.test.js` → FAIL（模块不存在）。

- [ ] **Step 3: 写实现**

```js
/**
 * chatLib — 私聊纯函数（无 D1、无副作用）
 */

/** 1 对 1 会话键："minId:maxId" */
export function conversationKey(a, b) {
  const na = Number(a), nb = Number(b);
  if (!Number.isFinite(na) || !Number.isFinite(nb)) throw new Error('conversationKey: ids must be numeric');
  if (na === nb) throw new Error('conversationKey: ids must differ');
  return `${Math.min(na, nb)}:${Math.max(na, nb)}`;
}

/** 解析 history 查询参数；friendId 非法→null；limit 夹到 1..100，默认 30 */
export function parseHistoryParams({ friendId, before, limit } = {}) {
  const fid = Number(friendId);
  const validFid = Number.isFinite(fid) ? fid : null;
  const beforeNum = before == null || before === '' ? null : Number(before);
  let lim = limit == null || limit === '' ? 30 : Number(limit);
  if (!Number.isFinite(lim)) lim = 30;
  lim = Math.max(1, Math.min(100, Math.trunc(lim)));
  return {
    friendId: validFid,
    before: Number.isFinite(beforeNum) ? beforeNum : null,
    limit: lim,
  };
}
```

- [ ] **Step 4: 跑测试确认通过** — `npx vitest run workers/auth/__tests__/chatLib.test.js` → PASS（8 用例）。

- [ ] **Step 5: Commit**
```bash
git add workers/auth/chatLib.js workers/auth/__tests__/chatLib.test.js
git commit -m "feat(chat): add chatLib pure helpers with tests (phase 2)"
```

---

## Task 3: Worker chat handlers + 路由

**Files:** Create `workers/auth/chat.js`, Modify `workers/auth/index.js`

- [ ] **Step 1: 写 handlers**

`workers/auth/chat.js`:
```js
/**
 * chat.js — 私聊 REST（D1）
 *   GET  /api/chat/history?friendId=&before=&limit=   历史消息（JWT）
 *   POST /api/internal/chat/persist                   WS 服务回调写库（service token）
 */
import { jsonResponse, errorResponse, authMiddleware } from './middleware.js';
import { conversationKey, parseHistoryParams } from './chatLib.js';

/** GET /api/chat/history — 倒序取，前端反转后展示 */
export async function handleChatHistory(request, env) {
  const { user } = await authMiddleware(request, env);
  if (!user || user.sub == null) return errorResponse('Not authenticated', 401, env, request);
  const me = Number(user.sub);

  const url = new URL(request.url);
  const { friendId, before, limit } = parseHistoryParams({
    friendId: url.searchParams.get('friendId'),
    before: url.searchParams.get('before'),
    limit: url.searchParams.get('limit'),
  });
  if (friendId == null) return errorResponse('Invalid friendId', 400, env, request);
  if (friendId === me) return errorResponse('Invalid friendId', 400, env, request);

  // 仅能读自己参与的会话
  const key = conversationKey(me, friendId);
  const beforeClause = before != null ? 'AND created_at < ?' : '';
  const binds = before != null ? [key, before, limit] : [key, limit];
  const rows = await env.DB.prepare(
    `SELECT id, from_user AS fromUser, body, created_at AS createdAt, read_at AS readAt
     FROM chat_messages
     WHERE conversation_key = ? ${beforeClause}
     ORDER BY created_at DESC
     LIMIT ?`
  ).bind(...binds).all();

  // 反转为时间升序返回（前端直接 append）
  const messages = (rows.results || []).slice().reverse();
  return jsonResponse({ messages }, 200, env, request);
}

/** POST /api/internal/chat/persist — WS 服务回调；service token 鉴权，绝不接受 JWT */
export async function handleInternalChatPersist(request, env) {
  const token = request.headers.get('X-Service-Token');
  if (!env.CHAT_SERVICE_TOKEN || token !== env.CHAT_SERVICE_TOKEN) {
    return errorResponse('Forbidden', 403, env, request);
  }
  const body = await request.json().catch(() => ({}));
  const fromUser = Number(body.fromUser);
  const toUser = Number(body.toUser);
  const text = typeof body.body === 'string' ? body.body : '';
  const createdAt = Number(body.createdAt) || Date.now();
  if (!Number.isFinite(fromUser) || !Number.isFinite(toUser) || fromUser === toUser) {
    return errorResponse('Invalid users', 400, env, request);
  }
  if (!text || text.length > 4000) return errorResponse('Invalid body', 400, env, request);

  const key = conversationKey(fromUser, toUser);
  const res = await env.DB.prepare(
    'INSERT INTO chat_messages (conversation_key, from_user, body, created_at) VALUES (?, ?, ?, ?)'
  ).bind(key, fromUser, text, createdAt).run();

  return jsonResponse({ id: res.meta.last_row_id, createdAt }, 201, env, request);
}
```

- [ ] **Step 2: 注册路由** — 修改 `workers/auth/index.js`：

import 块（friends.js import 之后）新增：
```js
import { handleChatHistory, handleInternalChatPersist } from './chat.js';
```
路由（好友系统路由块之后）新增：
```js
      // 私聊
      if (path === '/api/chat/history' && request.method === 'GET') {
        return handleChatHistory(request, env);
      }
      if (path === '/api/internal/chat/persist' && request.method === 'POST') {
        return handleInternalChatPersist(request, env);
      }
```

- [ ] **Step 3: 本地冒烟（wrangler dev + curl）**

> 复用 Phase 1 的本地准备（local D1 已 seed users + friendships；先确保 migration 005 已 `--local` 应用）。起服务带 service token：
```bash
npx wrangler dev --port 8787 --var JWT_SECRET:devsmokesecret123 --var CHAT_SERVICE_TOKEN:devservice456
```
另一终端（用 Phase 1 的注册流程拿 $TOKEN_A、$AID、$BID，并先让 A、B 互为好友）：
```bash
# 持久化一条 A→B（模拟 WS 回调）
curl -s -X POST http://localhost:8787/api/internal/chat/persist \
  -H "X-Service-Token: devservice456" -H "Content-Type: application/json" \
  -d "{\"fromUser\":$AID,\"toUser\":$BID,\"body\":\"hello\",\"createdAt\":1780000000000}"
# 无/错 service token → 403
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8787/api/internal/chat/persist \
  -H "X-Service-Token: wrong" -H "Content-Type: application/json" -d '{}'
# A 读历史 → 含 hello
curl -s "http://localhost:8787/api/chat/history?friendId=$BID" -H "Authorization: Bearer $TOKEN_A"
```
Expected: persist 返回 `{id, createdAt}`；错 token → `403`；history 返回 `{messages:[{fromUser:$AID, body:"hello",...}]}`。

- [ ] **Step 4: Commit**
```bash
git add workers/auth/chat.js workers/auth/index.js
git commit -m "feat(chat): Worker chat history + internal persist endpoints (phase 2)"
```

---

## Task 4: ECS — 加 ws 依赖 + index.js 挂载 WS（最小改动）

**Files:** Modify `server/package.json`, `server/index.js`

- [ ] **Step 1: 加 ws 依赖** — `server/package.json` dependencies 加 `"ws": "^8.18.0"`，然后：
```bash
cd server && npm install ws && cd ..
```
Run（验证安装）：`node -e "require('ws'); console.log('ws ok')"`（在 server/ 下）→ 期望 `ws ok`。

- [ ] **Step 2: 重构启动为 http.createServer + 挂 WS**

修改 `server/index.js`：
1. 顶部 import 区加：
```js
import { createServer } from 'node:http';
import { attachChatSocket } from './chatSocket.js';
```
2. 把末尾启动段（:541-558）从
```js
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
```
改为
```js
const PORT = process.env.PORT || 3001;
const httpServer = createServer(app);
attachChatSocket(httpServer);   // 挂载 /ws/chat（含 JWT 自检，自检失败会大声告警但不阻断 LLM 代理）
httpServer.listen(PORT, () => {
```
（`app.listen` → `httpServer.listen`，回调体保持不变；末尾 `});` 不变。）

- [ ] **Step 3: 不破坏现有服务的回归** — 见 Task 6 集成测试与本地手测：起服务后 `curl http://127.0.0.1:3001/health`、`/bt/*`、`/novel/*` 仍正常。（本步代码改动很小；真正验证在 Task 6。）

- [ ] **Step 4: Commit**（与 Task 5 一起，因为 chatSocket.js 此时还不存在；先写 Task 5 再统一构建/测试/commit）。**Task 4 不单独 commit。**

---

## Task 5: ECS — chatHub（可测核心）+ chatSocket（接线）

**Files:** Create `server/chatHub.js`, `server/chatSocket.js`

### 5a. chatHub.js — 可测核心（依赖注入）

- [ ] **Step 1: 写 chatHub**

```js
/**
 * chatHub — 私聊实时核心（无 ws/无 fetch 依赖，便于单测）。
 *
 * 注入：
 *   - persist(fromUser, toUser, body, createdAt) -> Promise<{id, createdAt}>
 *   - getFriends(userId, token) -> Promise<Set<number>>   // 该用户的好友 id 集合
 *   - now() -> number                                     // 便于测试注入时间
 *
 * 连接对象 conn = { userId, token, send(obj), close() }
 */
export function createChatHub({ persist, getFriends, now = () => Date.now() }) {
  const connections = new Map();   // userId -> Set<conn>
  const friendCache = new Map();   // userId -> Set<friendId>

  function online(userId) { return connections.has(userId) && connections.get(userId).size > 0; }

  function sendTo(userId, obj) {
    const set = connections.get(userId);
    if (!set) return false;
    let any = false;
    for (const c of set) { try { c.send(obj); any = true; } catch { /* drop */ } }
    return any;
  }

  async function friendsOf(conn) {
    if (friendCache.has(conn.userId)) return friendCache.get(conn.userId);
    const set = await getFriends(conn.userId, conn.token);
    friendCache.set(conn.userId, set);
    return set;
  }

  async function addConnection(conn) {
    if (!connections.has(conn.userId)) connections.set(conn.userId, new Set());
    connections.get(conn.userId).add(conn);
    // presence: 告诉该用户哪些好友在线；并通知在线好友"我上线了"
    const friends = await friendsOf(conn);
    const onlineFriends = [...friends].filter(online);
    conn.send({ type: 'presence:init', online: onlineFriends });
    for (const fid of onlineFriends) sendTo(fid, { type: 'presence', userId: conn.userId, online: true });
  }

  async function removeConnection(conn) {
    const set = connections.get(conn.userId);
    if (set) { set.delete(conn); if (set.size === 0) connections.delete(conn.userId); }
    if (!online(conn.userId)) {
      const friends = friendCache.get(conn.userId) || new Set();
      for (const fid of friends) if (online(fid)) sendTo(fid, { type: 'presence', userId: conn.userId, online: false });
    }
  }

  async function handleMessage(conn, raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (!msg || typeof msg.type !== 'string') return;

    if (msg.type === 'chat:typing') {
      const to = Number(msg.to);
      const friends = await friendsOf(conn);
      if (!friends.has(to)) return;
      sendTo(to, { type: 'chat:typing', from: conn.userId, typing: !!msg.typing });
      return;
    }

    if (msg.type === 'chat:message') {
      const to = Number(msg.to);
      const text = typeof msg.body === 'string' ? msg.body.trim() : '';
      if (!Number.isFinite(to) || !text) return;
      if (text.length > 4000) { conn.send({ type: 'chat:error', clientMsgId: msg.clientMsgId, error: 'too long' }); return; }
      const friends = await friendsOf(conn);
      if (!friends.has(to)) { conn.send({ type: 'chat:error', clientMsgId: msg.clientMsgId, error: 'not friends' }); return; }

      const createdAt = now();
      let saved;
      try {
        saved = await persist(conn.userId, to, text, createdAt);
      } catch (e) {
        conn.send({ type: 'chat:error', clientMsgId: msg.clientMsgId, error: 'persist failed' });
        return;
      }
      const out = { type: 'chat:message', id: saved.id, from: conn.userId, to, body: text, createdAt: saved.createdAt ?? createdAt };
      sendTo(to, out);                                   // 转发给对方（如在线）
      conn.send({ type: 'chat:ack', clientMsgId: msg.clientMsgId, id: saved.id, createdAt: out.createdAt });
      return;
    }
    // 其它类型（call:* 视频）属于 Phase 3，此处忽略
  }

  return { addConnection, removeConnection, handleMessage, online, _connections: connections, _friendCache: friendCache };
}
```

- [ ] **Step 2: 写 chatSocket.js（接线层）**

```js
/**
 * chatSocket — 把 chatHub 接到真实 ws + http.upgrade + CF Worker 回调。
 */
import { WebSocketServer } from 'ws';
import { verifyToken, signToken } from '../workers/auth/jwt.js';
import { createChatHub } from './chatHub.js';

const WS_PATH = '/ws/chat';
const WORKER_BASE = (process.env.CHAT_WORKER_URL || 'https://zhaxiaoji.com').replace(/\/+$/, '');
const ALLOWED_ORIGIN_LIST = (process.env.ALLOWED_ORIGIN || 'https://zhaxiaoji.com')
  .split(',').map((o) => o.trim()).filter(Boolean);

function originAllowed(origin) {
  if (!origin) return false;                              // 浏览器 WS 一定带 Origin
  if (ALLOWED_ORIGIN_LIST.includes(origin)) return true;
  if (process.env.NODE_ENV !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  return false;
}

/** 真实持久化：回调 CF Worker（service token） */
async function persistToWorker(fromUser, toUser, body, createdAt) {
  const res = await fetch(`${WORKER_BASE}/api/internal/chat/persist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Service-Token': process.env.CHAT_SERVICE_TOKEN || '' },
    body: JSON.stringify({ fromUser, toUser, body, createdAt }),
  });
  if (!res.ok) throw new Error(`persist ${res.status}`);
  return res.json();
}

/** 真实好友查询：用该用户的 JWT 调 Worker GET /api/friends */
async function getFriendsFromWorker(userId, token) {
  const res = await fetch(`${WORKER_BASE}/api/friends`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return new Set();
  const data = await res.json().catch(() => ({}));
  return new Set((data.friends || []).map((f) => Number(f.id)));
}

/** 启动自检：用 JWT_SECRET 签发+验签一个 token，失败大声告警（仿 checkProviderConfig） */
async function jwtSelfTest() {
  const secret = process.env.JWT_SECRET;
  if (!secret) { console.error('━'.repeat(80)); console.error('[chatSocket] FATAL: JWT_SECRET 未设置，WS 将拒绝所有连接'); console.error('━'.repeat(80)); return false; }
  try {
    const t = await signToken({ sub: 0, username: '_selftest', email: 'x@x' }, secret);
    const ok = await verifyToken(t, secret);
    if (!ok) throw new Error('verify returned null');
    console.log('[chatSocket] JWT self-test OK');
    return true;
  } catch (e) {
    console.error('━'.repeat(80)); console.error(`[chatSocket] FATAL JWT self-test failed: ${e.message}`); console.error('━'.repeat(80));
    return false;
  }
}

export function attachChatSocket(httpServer, opts = {}) {
  const hub = opts.hub || createChatHub({ persist: persistToWorker, getFriends: getFriendsFromWorker });
  const wss = new WebSocketServer({ noServer: true });

  jwtSelfTest();

  httpServer.on('upgrade', async (req, socket, head) => {
    let url;
    try { url = new URL(req.url, 'http://localhost'); } catch { socket.destroy(); return; }
    if (url.pathname !== WS_PATH) return;                 // 不是我们的路径，交给别的处理器/默认

    if (!originAllowed(req.headers.origin)) { socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); socket.destroy(); return; }

    const token = url.searchParams.get('token');
    const payload = token ? await verifyToken(token, process.env.JWT_SECRET) : null;
    if (!payload || payload.sub == null) { socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); socket.destroy(); return; }

    wss.handleUpgrade(req, socket, head, (ws) => {
      const conn = {
        userId: Number(payload.sub),
        token,
        send: (obj) => { try { ws.send(JSON.stringify(obj)); } catch { /* closed */ } },
        close: () => { try { ws.close(); } catch { /* noop */ } },
      };
      hub.addConnection(conn);
      ws.on('message', (data) => hub.handleMessage(conn, data.toString()));
      ws.on('close', () => hub.removeConnection(conn));
      ws.on('error', () => { try { ws.close(); } catch { /* noop */ } });
    });
  });

  return { wss, hub };
}
```

> 注意：`httpServer.on('upgrade')` 里对非 `/ws/chat` 路径**直接 return**（不 destroy），以免影响未来其它 upgrade 使用者；当前仓库没有别的 WS，所以也可不处理。

- [ ] **Step 3: 构建/语法检查** — `node --check server/chatHub.js && node --check server/chatSocket.js`（或起服务）确保无语法错误。

### 5b. 提交点：写完 Task 6 测试后统一 commit Task 4+5+6。

---

## Task 6: ECS 测试（纯逻辑 + 双客户端集成）

**Files:** Create `server/__tests__/chatHub.test.js`, `server/__tests__/chatSocket.integration.test.js`

- [ ] **Step 1: chatHub 纯逻辑测试**

```js
import { describe, expect, it, vi } from 'vitest';
import { createChatHub } from '../chatHub.js';

function fakeConn(userId, token = 't') {
  const sent = [];
  return { userId, token, sent, send: (o) => sent.push(o), close: () => {} };
}

function hubWith(friendsMap, persist) {
  return createChatHub({
    persist: persist || vi.fn(async (f, t, b, c) => ({ id: 1, createdAt: c })),
    getFriends: async (uid) => new Set(friendsMap[uid] || []),
    now: () => 1000,
  });
}

describe('chatHub', () => {
  it('relays a chat:message between friends + persists + acks sender', async () => {
    const persist = vi.fn(async (f, t, b, c) => ({ id: 42, createdAt: c }));
    const hub = hubWith({ 1: [2], 2: [1] }, persist);
    const a = fakeConn(1), b = fakeConn(2);
    await hub.addConnection(a); await hub.addConnection(b);
    await hub.handleMessage(a, JSON.stringify({ type: 'chat:message', to: 2, body: 'hi', clientMsgId: 'c1' }));
    expect(persist).toHaveBeenCalledWith(1, 2, 'hi', 1000);
    expect(b.sent).toContainEqual({ type: 'chat:message', id: 42, from: 1, to: 2, body: 'hi', createdAt: 1000 });
    expect(a.sent).toContainEqual({ type: 'chat:ack', clientMsgId: 'c1', id: 42, createdAt: 1000 });
  });

  it('rejects + does NOT persist a message to a non-friend', async () => {
    const persist = vi.fn();
    const hub = hubWith({ 1: [], 3: [] }, persist);
    const a = fakeConn(1);
    await hub.addConnection(a);
    await hub.handleMessage(a, JSON.stringify({ type: 'chat:message', to: 3, body: 'hi', clientMsgId: 'c2' }));
    expect(persist).not.toHaveBeenCalled();
    expect(a.sent).toContainEqual({ type: 'chat:error', clientMsgId: 'c2', error: 'not friends' });
  });

  it('broadcasts presence on connect and disconnect to online friends', async () => {
    const hub = hubWith({ 1: [2], 2: [1] });
    const a = fakeConn(1); await hub.addConnection(a);
    const b = fakeConn(2); await hub.addConnection(b);
    // a should learn b came online
    expect(a.sent).toContainEqual({ type: 'presence', userId: 2, online: true });
    // b's init should include a as online
    expect(b.sent.find((m) => m.type === 'presence:init')).toBeTruthy();
    await hub.removeConnection(b);
    expect(a.sent).toContainEqual({ type: 'presence', userId: 2, online: false });
  });

  it('ignores typing to a non-friend; relays typing to a friend', async () => {
    const hub = hubWith({ 1: [2], 2: [1] });
    const a = fakeConn(1), b = fakeConn(2);
    await hub.addConnection(a); await hub.addConnection(b);
    await hub.handleMessage(a, JSON.stringify({ type: 'chat:typing', to: 2, typing: true }));
    expect(b.sent).toContainEqual({ type: 'chat:typing', from: 1, typing: true });
  });
});
```

- [ ] **Step 2: 跑 chatHub 测试** — `npx vitest run server/__tests__/chatHub.test.js` → 期望全绿。

- [ ] **Step 3: 双客户端集成测试（真实 ws + 临时端口 + node 环境）**

```js
// @vitest-environment node
import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest';
import { createServer } from 'node:http';
import { WebSocket } from 'ws';
import { signToken } from '../../workers/auth/jwt.js';
import { attachChatSocket } from '../chatSocket.js';
import { createChatHub } from '../chatHub.js';

const SECRET = 'test-secret-123';
let server, port;

beforeAll(async () => {
  process.env.JWT_SECRET = SECRET;
  process.env.NODE_ENV = 'test';
  process.env.ALLOWED_ORIGIN = 'http://localhost:5173';
  // 注入一个 hub：好友固定 {1:[2],2:[1]}，persist 直接回 id；不打真 Worker
  const hub = createChatHub({
    persist: async (f, t, b, c) => ({ id: 99, createdAt: c }),
    getFriends: async (uid) => new Set(uid === 1 ? [2] : [1]),
  });
  server = createServer((_, res) => res.end('ok'));
  attachChatSocket(server, { hub });
  await new Promise((r) => server.listen(0, r));
  port = server.address().port;
});

afterAll(() => new Promise((r) => server.close(r)));

function connect(userId) {
  const token = ''; // set below
  return new Promise((resolve, reject) => {
    signToken({ sub: userId, username: `u${userId}`, email: `u${userId}@x` }, SECRET).then((tok) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/chat?token=${tok}`, { headers: { Origin: 'http://localhost:5173' } });
      ws.on('open', () => resolve(ws));
      ws.on('error', reject);
    });
  });
}
function nextMsg(ws, pred) {
  return new Promise((resolve) => {
    const on = (d) => { const m = JSON.parse(d.toString()); if (!pred || pred(m)) { ws.off('message', on); resolve(m); } };
    ws.on('message', on);
  });
}

describe('chatSocket integration (two clients)', () => {
  it('delivers A→B message and acks A', async () => {
    const a = await connect(1);
    const b = await connect(2);
    const bGot = nextMsg(b, (m) => m.type === 'chat:message');
    const aAck = nextMsg(a, (m) => m.type === 'chat:ack');
    a.send(JSON.stringify({ type: 'chat:message', to: 2, body: 'yo', clientMsgId: 'x1' }));
    const got = await bGot; const ack = await aAck;
    expect(got).toMatchObject({ type: 'chat:message', from: 1, to: 2, body: 'yo', id: 99 });
    expect(ack).toMatchObject({ type: 'chat:ack', clientMsgId: 'x1', id: 99 });
    a.close(); b.close();
  });

  it('rejects connection with bad token (401, no open)', async () => {
    await expect(new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/chat?token=garbage`, { headers: { Origin: 'http://localhost:5173' } });
      ws.on('open', () => { ws.close(); resolve('opened'); });
      ws.on('error', () => reject(new Error('refused')));
      ws.on('unexpected-response', () => reject(new Error('refused')));
    })).rejects.toThrow('refused');
  });
});
```

- [ ] **Step 4: 跑集成测试** — `npx vitest run server/__tests__/chatSocket.integration.test.js` → 期望全绿。若 ws 在 jsdom 下异常，确认文件首行 `// @vitest-environment node` 存在。

- [ ] **Step 5: 全量回归 + commit Task 4+5+6**
```bash
npm test
git add server/package.json server/package-lock.json server/index.js server/chatHub.js server/chatSocket.js server/__tests__/chatHub.test.js server/__tests__/chatSocket.integration.test.js
git commit -m "feat(chat): ECS WebSocket chat server (hub + socket + tests, phase 2)"
```

---

## Task 7: ECS — ecosystem.config.cjs 透传 secrets

**Files:** Modify `ecosystem.config.cjs`

- [ ] **Step 1: env 块加（透传 process.env，不写明文）**

在 `env: { ... }` 块内加：
```js
        // Phase 2 私聊：JWT 验签密钥（必须与 CF Worker 的 JWT_SECRET 字节一致）
        // 与 CHAT_SERVICE_TOKEN（持久化回调鉴权）。两者从 /root/.config/wolfgame/*.env
        // source 后由 pm2 --update-env 注入；绝不在此写明文。
        JWT_SECRET: process.env.JWT_SECRET || '',
        CHAT_SERVICE_TOKEN: process.env.CHAT_SERVICE_TOKEN || '',
        CHAT_WORKER_URL: process.env.CHAT_WORKER_URL || 'https://zhaxiaoji.com',
```

- [ ] **Step 2: Commit**
```bash
git add ecosystem.config.cjs
git commit -m "chore(chat): wire JWT_SECRET/CHAT_SERVICE_TOKEN into pm2 env (phase 2)"
```

---

## Task 8: 前端 — friendService.getHistory + useChatSocket

**Files:** Modify `src/services/friendService.js`, Create `src/hooks/useChatSocket.js`

- [ ] **Step 1: friendService 加 getHistory（+ 更新 Phase 1 测试同风格的新测试）**

`src/services/friendService.js` 加方法：
```js
  /** 拉历史消息，返回 { messages: [{id, fromUser, body, createdAt}] }（时间升序） */
  getHistory(api, friendId, before, limit) {
    const q = new URLSearchParams({ friendId: String(friendId) });
    if (before != null) q.set('before', String(before));
    if (limit != null) q.set('limit', String(limit));
    return api.get(`/api/chat/history?${q.toString()}`);
  },
```
在 `src/services/__tests__/friendService.test.js` 加：
```js
  it('getHistory GETs /api/chat/history with friendId', async () => {
    const api = makeApi();
    await friendService.getHistory(api, 5);
    expect(api.get).toHaveBeenCalledWith('/api/chat/history?friendId=5');
  });
  it('getHistory includes before + limit when provided', async () => {
    const api = makeApi();
    await friendService.getHistory(api, 5, 1000, 20);
    expect(api.get).toHaveBeenCalledWith('/api/chat/history?friendId=5&before=1000&limit=20');
  });
```
Run: `npx vitest run src/services/__tests__/friendService.test.js` → 期望 7 用例全绿（5 旧 + 2 新）。

- [ ] **Step 2: 写 useChatSocket hook**

`src/hooks/useChatSocket.js`:
```js
import { useCallback, useEffect, useRef, useState } from 'react';
import { getToken } from '../utils/authToken';

const WS_URL = import.meta.env.VITE_CHAT_WS_URL || 'wss://novel-origin.zhaxiaoji.com/ws/chat';

/**
 * useChatSocket — 维护到 ECS 的 WebSocket：自动重连、收发、presence、ack。
 * 返回 { status, onlineFriends, send, sendTyping, subscribe }。
 * subscribe(handler) 注册原始消息回调（ConversationView 用它接 chat:message/typing）。
 */
export function useChatSocket(enabled) {
  const [status, setStatus] = useState('idle');         // idle|connecting|open|closed
  const [onlineFriends, setOnlineFriends] = useState(() => new Set());
  const wsRef = useRef(null);
  const handlersRef = useRef(new Set());
  const retryRef = useRef(0);
  const closedByUs = useRef(false);

  const emit = useCallback((msg) => {
    for (const h of handlersRef.current) { try { h(msg); } catch { /* ignore */ } }
  }, []);

  const connect = useCallback(() => {
    const token = getToken();
    if (!token) return;
    setStatus('connecting');
    const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;
    ws.onopen = () => { retryRef.current = 0; setStatus('open'); };
    ws.onclose = () => {
      setStatus('closed');
      if (closedByUs.current) return;
      const delay = Math.min(30000, 1000 * 2 ** retryRef.current);   // 指数退避，封顶 30s
      retryRef.current += 1;
      setTimeout(() => { if (!closedByUs.current) connect(); }, delay);
    };
    ws.onerror = () => { try { ws.close(); } catch { /* noop */ } };
    ws.onmessage = (ev) => {
      let msg; try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.type === 'presence:init') setOnlineFriends(new Set((msg.online || []).map(Number)));
      else if (msg.type === 'presence') {
        setOnlineFriends((prev) => { const n = new Set(prev); msg.online ? n.add(Number(msg.userId)) : n.delete(Number(msg.userId)); return n; });
      }
      emit(msg);
    };
  }, [emit]);

  useEffect(() => {
    if (!enabled) return undefined;
    closedByUs.current = false;
    connect();
    return () => { closedByUs.current = true; try { wsRef.current?.close(); } catch { /* noop */ } };
  }, [enabled, connect]);

  const send = useCallback((to, body, clientMsgId) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify({ type: 'chat:message', to, body, clientMsgId }));
    return true;
  }, []);
  const sendTyping = useCallback((to, typing) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'chat:typing', to, typing }));
  }, []);
  const subscribe = useCallback((handler) => { handlersRef.current.add(handler); return () => handlersRef.current.delete(handler); }, []);

  return { status, onlineFriends, send, sendTyping, subscribe };
}
```
> WS_URL 默认是生产 wss（无 localhost），所以 `check-build.mjs` 不会报泄漏。本地 dev 用 `.env.development.local` 里 `VITE_CHAT_WS_URL=ws://localhost:3001/ws/chat`（**绝不** `.env.local`）。

- [ ] **Step 3: Commit**
```bash
git add src/services/friendService.js src/services/__tests__/friendService.test.js src/hooks/useChatSocket.js
git commit -m "feat(chat): friendService.getHistory + useChatSocket hook (phase 2)"
```

---

## Task 9: 前端 — 会话 UI 组件 + 接入 ChatRoute

**Files:** Create `MessageList.jsx`, `MessageInput.jsx`, `ConversationView.jsx`, test `messageComponents.test.jsx`; Modify `ChatRoute.jsx`

- [ ] **Step 1: 组件冒烟测试（失败）**

`src/modules/chat/__tests__/messageComponents.test.jsx`:
```jsx
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MessageList } from '../components/MessageList.jsx';
import { MessageInput } from '../components/MessageInput.jsx';

describe('MessageList', () => {
  it('renders message bodies and aligns own vs other', () => {
    const html = renderToStaticMarkup(
      <MessageList meId={1} messages={[
        { id: 1, fromUser: 1, body: 'hi there', createdAt: 1 },
        { id: 2, fromUser: 2, body: 'hello back', createdAt: 2 },
      ]} />
    );
    expect(html).toContain('hi there');
    expect(html).toContain('hello back');
  });
  it('shows empty hint when no messages', () => {
    const html = renderToStaticMarkup(<MessageList meId={1} messages={[]} />);
    expect(html).toContain('还没有消息');
  });
});

describe('MessageInput', () => {
  it('renders input and send button', () => {
    const html = renderToStaticMarkup(
      <MessageInput value="" onChange={() => {}} onSend={() => {}} disabled={false} />
    );
    expect(html).toContain('发送');
  });
});
```

- [ ] **Step 2: 跑测试确认失败** — `npx vitest run src/modules/chat/__tests__/messageComponents.test.jsx` → FAIL（组件不存在）。

- [ ] **Step 3: 写 MessageList.jsx**
```jsx
import React from 'react';

/** 展示型：消息气泡列表。meId 用于区分左右对齐。 */
export function MessageList({ meId, messages }) {
  if (!messages || messages.length === 0) {
    return <p className="text-sm text-ink-muted py-6 text-center">还没有消息，发一条吧。</p>;
  }
  return (
    <div className="space-y-2">
      {messages.map((m) => {
        const mine = Number(m.fromUser) === Number(meId);
        return (
          <div key={m.id ?? `${m.fromUser}-${m.createdAt}`} className={mine ? 'flex justify-end' : 'flex justify-start'}>
            <span className={`inline-block max-w-[75%] px-3 py-2 rounded-lg text-sm ${mine ? 'bg-amber-600 text-white' : 'bg-zinc-100 text-ink'}`}>
              {m.body}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default MessageList;
```

- [ ] **Step 4: 写 MessageInput.jsx**
```jsx
import React from 'react';

/** 展示型：消息输入。受控；Enter 发送（Shift+Enter 换行）。 */
export function MessageInput({ value, onChange, onSend, onTyping, disabled }) {
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => { e.preventDefault(); if (!disabled) onSend?.(); }}
    >
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={(e) => { onChange?.(e.target.value); onTyping?.(true); }}
        onBlur={() => onTyping?.(false)}
        placeholder={disabled ? '连接中…' : '输入消息'}
        className="flex-1 px-3 py-2 rounded border border-zinc-300 text-ink disabled:opacity-50"
      />
      <button type="submit" disabled={disabled} className="px-4 py-2 rounded bg-amber-600 text-white disabled:opacity-50">发送</button>
    </form>
  );
}

export default MessageInput;
```

- [ ] **Step 5: 写 ConversationView.jsx（容器：历史 + 实时 + 输入）**
```jsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { friendService } from '../../../services/friendService';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';

let _cid = 0;
const nextClientId = () => `c${Date.now()}_${_cid++}`;

/**
 * ConversationView — 与某个好友的会话。
 * props: api, meId, friend{id,username}, chat(useChatSocket 返回值)
 */
export function ConversationView({ api, meId, friend, chat }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState(null);
  const pending = useRef(new Map());   // clientMsgId -> temp index marker

  // 载入历史（切换好友时）
  useEffect(() => {
    let alive = true;
    setMessages([]);
    friendService.getHistory(api, friend.id)
      .then((r) => { if (alive) setMessages(r.messages || []); })
      .catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [api, friend.id]);

  // 订阅实时消息（仅与当前好友相关）
  useEffect(() => {
    return chat.subscribe((msg) => {
      if (msg.type === 'chat:message') {
        const involved = Number(msg.from) === Number(friend.id) || Number(msg.to) === Number(friend.id);
        if (!involved) return;
        setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev
          : [...prev, { id: msg.id, fromUser: msg.from, body: msg.body, createdAt: msg.createdAt }]);
      } else if (msg.type === 'chat:ack') {
        const cid = msg.clientMsgId;
        if (pending.current.has(cid)) {
          pending.current.delete(cid);
          setMessages((prev) => prev.map((m) => m.clientMsgId === cid ? { ...m, id: msg.id, createdAt: msg.createdAt, pending: false } : m));
        }
      } else if (msg.type === 'chat:error') {
        setMessages((prev) => prev.map((m) => m.clientMsgId === msg.clientMsgId ? { ...m, failed: true } : m));
      }
    });
  }, [chat, friend.id]);

  const onSend = useCallback(() => {
    const body = draft.trim();
    if (!body) return;
    const clientMsgId = nextClientId();
    pending.current.set(clientMsgId, true);
    setMessages((prev) => [...prev, { id: undefined, clientMsgId, fromUser: meId, body, createdAt: Date.now(), pending: true }]);
    setDraft('');
    const ok = chat.send(friend.id, body, clientMsgId);
    if (!ok) setMessages((prev) => prev.map((m) => m.clientMsgId === clientMsgId ? { ...m, failed: true } : m));
  }, [draft, chat, friend.id, meId]);

  return (
    <div className="flex flex-col h-[60vh] border border-zinc-200 rounded">
      <div className="px-3 py-2 border-b text-sm font-semibold text-ink flex items-center gap-2">
        {friend.username}
        <span className={`inline-block w-2 h-2 rounded-full ${chat.onlineFriends.has(Number(friend.id)) ? 'bg-green-500' : 'bg-zinc-300'}`} />
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {error && <p className="text-sm text-red-600">{error}</p>}
        <MessageList meId={meId} messages={messages} />
      </div>
      <div className="p-2 border-t">
        <MessageInput
          value={draft}
          disabled={chat.status !== 'open'}
          onChange={setDraft}
          onSend={onSend}
          onTyping={(t) => chat.sendTyping(friend.id, t)}
        />
      </div>
    </div>
  );
}

export default ConversationView;
```

- [ ] **Step 6: 跑组件测试确认通过** — `npx vitest run src/modules/chat/__tests__/messageComponents.test.jsx` → 期望 3 用例全绿。

- [ ] **Step 7: 接入 ChatRoute** — 修改 `src/modules/chat/ChatRoute.jsx`：
1. import：
```jsx
import { useChatSocket } from '../../hooks/useChatSocket';
import { ConversationView } from './components/ConversationView';
```
2. 组件内（`const api = ...` 之后）加：
```jsx
  const chat = useChatSocket(Boolean(user));
  const [selectedFriend, setSelectedFriend] = useState(null);
```
3. FriendList 的 `onSelect` 改为 `setSelectedFriend`；在「我的好友」区右侧/下方渲染会话：
```jsx
        <FriendList friends={friends} onSelect={setSelectedFriend} />
        {selectedFriend && (
          <ConversationView api={api} meId={user.id ?? user.sub} friend={selectedFriend} chat={chat} />
        )}
```
> `user` 来自 useShell；其 id 字段在不同地方为 `user.id`（登录响应）；ConversationView 用 `meId={user.id ?? user.sub}` 兜底。

- [ ] **Step 8: 全量构建 + 测试**
```bash
npm run build
npm test
```
Expected: 构建成功（check-build 0 泄漏，新增 useChatSocket/ConversationView 进 ChatRoute chunk）；`npm test` 全绿。

- [ ] **Step 9: Commit**
```bash
git add src/modules/chat/components/MessageList.jsx src/modules/chat/components/MessageInput.jsx src/modules/chat/components/ConversationView.jsx src/modules/chat/__tests__/messageComponents.test.jsx src/modules/chat/ChatRoute.jsx
git commit -m "feat(chat): conversation UI (MessageList/Input/View) wired into ChatRoute (phase 2)"
```

---

## Task 10: 部署手册（交付文档，不在此执行）

**Files:** Create `docs/deploy/phase2-chat-deploy-runbook.md`

- [ ] **Step 1: 写手册**，内容必须包含（逐条可执行）：

1. **前置 secrets**（两边必须字节一致）
   - CF Worker：`npx wrangler secret put CHAT_SERVICE_TOKEN`（输入一个随机强 token）。确认 `JWT_SECRET` 已是 Worker secret。
   - ECS：在 `/root/.config/wolfgame/werewolf-ai.env`（mode 600）加 `JWT_SECRET=<与 Worker 同值>` 和 `CHAT_SERVICE_TOKEN=<与上面 wrangler 同值>`。
2. **D1 迁移（生产）**：`npx wrangler d1 execute wolfgame-db --remote --file=./migrations/005_chat_messages.sql`
3. **部署 Worker**：`npm run build && npm run deploy`，随后 CLAUDE.md §B fingerprint 核对（prod=local、0 localhost）；并验证新路由：`curl -o /dev/null -w "%{http_code}" https://zhaxiaoji.com/api/chat/history` → 401（存在，非 404）。
4. **nginx 加 WebSocket 升级 location**（ECS）——在 novel-origin 对应 server 块加：
   ```nginx
   location /ws/chat {
     proxy_pass http://127.0.0.1:3001;
     proxy_http_version 1.1;
     proxy_set_header Upgrade $http_upgrade;
     proxy_set_header Connection "upgrade";
     proxy_set_header Host $host;
     proxy_set_header X-Real-IP $remote_addr;
     proxy_read_timeout 3600s;   # 长连接
   }
   ```
   `nginx -t && systemctl reload nginx`。
5. **cloudflared ingress**：确认 tunnel 配置允许该 hostname 透传（cloudflared 默认支持 WS，无需特殊开关；若用 ingress rules，确保 `novel-origin.zhaxiaoji.com` → `http://localhost:80`（nginx）或直 `:3001`）。
6. **部署 ECS 代码 + 重启**（顺序：先 Worker+迁移，再 ECS）：
   ```bash
   ssh <ecs> 'cd /var/www/wolfgame && git pull && cd server && npm install && cd .. \
     && set -a && . /root/.config/wolfgame/werewolf-ai.env && set +a \
     && pm2 restart ecosystem.config.cjs --update-env && pm2 save'
   ```
7. **ECS 自检**：`pm2 logs bt-server --lines 30 --nostream` 应见 `[chatSocket] JWT self-test OK`；若见 FATAL → JWT_SECRET 缺失/不匹配，停止并修复。
8. **端到端 WS 烟测**（从本地）：
   ```bash
   npx wscat -c "wss://novel-origin.zhaxiaoji.com/ws/chat?token=<一个有效JWT>" -H "Origin: https://zhaxiaoji.com"
   ```
   期望连接成功（收到 presence:init）；无 token → 连接被拒。
9. **前端 dev override 提醒**：本地联调把 `VITE_CHAT_WS_URL=ws://localhost:3001/ws/chat` 放 `.env.development.local`（**绝不** `.env.local`）。
10. **回滚**：WS 出问题不影响 REST——`git revert` ECS 的 index.js 改动 + `pm2 restart` 即可摘除 WS，好友/聊天历史 REST 仍可用。

- [ ] **Step 2: 更新 CHANGELOG.md**（Phase 2 条目：新功能、文件变更、迁移 005、部署注意）。

- [ ] **Step 3: Commit**
```bash
git add docs/deploy/phase2-chat-deploy-runbook.md CHANGELOG.md
git commit -m "docs(chat): phase 2 deploy runbook + changelog"
```

---

## Self-Review

- **Spec 覆盖**：WS 服务(§5.2)→Task4/5；chat:message/typing/presence/ack 协议→chatHub(Task5)+测试(Task6)；`/api/chat/history`+`/api/internal/chat/persist`(§5.1)→Task3；chat_messages 表(§4)→Task1；前端 useChatSocket/ConversationView/MessageList/MessageInput(§6)→Task8/9；容错(重连指数退避/乐观+ack/去重)(§8)→useChatSocket+ConversationView；测试策略(§9)→Task6。视频 call:*(§5.2/§7) 明确属 Phase 3，本计划不含。
- **占位符**：无 TBD；每步含完整代码或可执行命令 + 期望输出。
- **类型/命名一致**：协议字段 `type/to/from/body/clientMsgId/id/createdAt/online/userId` 在 chatHub、chatSocket、集成测试、useChatSocket、ConversationView 五处一致；`conversationKey`/`parseHistoryParams` 在 chatLib 与 chat.js 一致；`persist(fromUser,toUser,body,createdAt)` 签名在 chatHub 注入点、chatSocket persistToWorker、chatHub 测试三处一致；`getFriends(userId, token)→Set<number>` 一致。
- **新增 Worker secret**：`CHAT_SERVICE_TOKEN`（Task3 用、Task10 部署创建）。
- **已知运维确认项（部署手册内强调，本机无法验证）**：① ECS `JWT_SECRET` 与 Worker 字节一致（否则握手静默全拒——故加了启动自检大声告警）；② nginx `/ws/chat` 升级头 + cloudflared 透传 101；③ ECS Node ≥18 暴露 `globalThis.crypto.subtle`（`node -e "console.log(process.version,!!globalThis.crypto?.subtle)"`）；④ 部署顺序：先 Worker+迁移 005 再 ECS，避免 persist 500。
- **安全**：WS 握手验签+验 Origin（cors 不覆盖 upgrade）；persist 仅 service token 不收 JWT；消息长度上限 4000；非好友消息拒绝且不持久化。
