# 设计文档：好友私聊 + 视频通话模块（`chat`）

- **日期**：2026-06-03
- **作者**：与 Claude Code 协作 brainstorm
- **状态**：待用户评审
- **关联模块**：与 `werewolf` / `novel` / `chords` 平级的新顶级模块

---

## 1. 背景与目标

平台现有模块（狼人杀、小说工作台、音乐实验室）全部是**单人 + AI**形态。
本功能引入平台第一个**真人对真人**的实时社交能力：

1. **好友系统** — 用户名/邮箱搜索 → 发申请 → 对方审批 → 成为好友。
2. **1 对 1 实时文字聊天** — 好友之间私聊，实时收发，历史持久化。
3. **视频通话** — 好友间 WebRTC 视频，**仅管理员可发起**（admin only，实际只一组用户）。

三层层层依赖（好友 → 才能聊 → 才能视频），共用同一条 WebSocket 通道。
**设计一次完成，实现分三阶段。本次交付目标为三阶段全做。**

### 非目标（YAGNI）

- 群聊 / 多人房间（仅 1 对 1）。
- 消息撤回、表情包、文件/图片传输（一期纯文本）。
- TURN 中继服务器（一期纯 P2P + 公共 STUN，连不通再补 coturn）。
- 游客参与（必须真实注册用户）。
- 离线推送 / 邮件通知。

---

## 2. 关键决策（已与用户确认）

| 决策点 | 选择 | 理由 |
|---|---|---|
| 聊天形态 | 纯真人 ↔ 真人 | 用户明确确认 |
| 进房方式 | 仅好友可进（= 好友私聊 DM） | 用户明确选择 |
| 加好友方式 | 用户名/邮箱搜索 + 申请审批 | 用户明确选择 |
| 实时传输 | **ECS WebSocket** | 复用现有有状态 ECS 盒子；视频信令天然契合长连接；避免新增 CF 付费组件 |
| 消息存储 | **D1 单一数据源** | 与 CLAUDE.md「D1 是数据库」一致；WS 仅做中继 + 持久化代理 |
| 视频权限 | 仅 admin | 用户明确限制；并发恒为 1，服务器压力可忽略 |
| 游客可见性 | 对游客隐藏首页入口 | 用户明确选择 |
| 首期范围 | 三阶段全做 | 用户明确选择 |

---

## 3. 架构总览

```
┌─────────────┐   REST (好友/历史)   ┌──────────────────────┐
│  浏览器 A    │ ───────────────────▶ │  CF Worker + D1       │
│ (React SPA) │ ◀─────────────────── │  workers/auth/*       │
│             │                       │  - /api/users/search  │
│  useChatSocket  WSS (实时)          │  - /api/friends/*     │
│  useWebRTC  │ ──────────┐           │  - /api/chat/history  │
└─────────────┘           │           │  - /api/internal/...  │
                          ▼           └──────────┬───────────┘
                 ┌─────────────────┐   回调持久化  │ (service token)
                 │  ECS WS 服务      │ ◀───────────┘
                 │ server/chatSocket │ ── 校验好友/admin ──▶ (查 Worker, 缓存)
                 │  - JWT 验证       │
                 │  userId→sockets   │
                 └─────────────────┘
                          ▲ WSS 信令转发
┌─────────────┐           │
│  浏览器 B    │ ──────────┘
└─────────────┘
        ▲                          媒体流 P2P 直连（不过服务器）
        └──────────── WebRTC（STUN 协助 NAT 穿透）────────────┘
```

**数据库分工**：
- **D1（Cloudflare，Worker 访问）**：好友关系、好友申请、聊天消息历史 —— 单一数据源。
- **ECS WS 服务（内存）**：在线连接表 `userId → Set<socket>`、在线状态 presence —— 易失，重启即重建。

**职责边界**：
- WS 服务**不是数据库**。它只做三件事：① 实时转发消息/信令 ② 维护在线状态 ③ 收到消息后回调 Worker 写 D1。
- 所有持久化与权限真相在 CF Worker + D1。

---

## 4. 数据模型（D1 新增表）

```sql
-- 好友关系：无向边，规范化存储（user_a < user_b），避免重复行
CREATE TABLE IF NOT EXISTS friendships (
  user_a     INTEGER NOT NULL,           -- 较小的 user id
  user_b     INTEGER NOT NULL,           -- 较大的 user id
  created_at INTEGER NOT NULL,           -- epoch ms
  PRIMARY KEY (user_a, user_b)
);

-- 好友申请
CREATE TABLE IF NOT EXISTS friend_requests (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  from_user  INTEGER NOT NULL,
  to_user    INTEGER NOT NULL,
  status     TEXT    NOT NULL DEFAULT 'pending',  -- pending | accepted | rejected
  created_at INTEGER NOT NULL,
  UNIQUE (from_user, to_user)            -- 同一方向不可重复申请
);
CREATE INDEX IF NOT EXISTS idx_freq_to ON friend_requests(to_user, status);

-- 私聊消息
CREATE TABLE IF NOT EXISTS chat_messages (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_key TEXT    NOT NULL,     -- "minId:maxId"，1 对 1 会话唯一键
  from_user        INTEGER NOT NULL,
  body             TEXT    NOT NULL,
  created_at       INTEGER NOT NULL,     -- epoch ms（也用于断线补拉的游标）
  read_at          INTEGER               -- NULL = 未读
);
CREATE INDEX IF NOT EXISTS idx_chat_conv ON chat_messages(conversation_key, created_at);
```

**辅助约定**：
- `conversationKey(a, b) = `${Math.min(a,b)}:${Math.max(a,b)}``
- `normalizeFriendship(a, b) → { user_a: min, user_b: max }`
- 这两个纯函数需有单元测试。

---

## 5. 后端设计

### 5.1 CF Worker REST（`workers/auth/handlers.js` + `index.js` 路由）

| 方法 | 端点 | 鉴权 | 说明 |
|---|---|---|---|
| GET  | `/api/users/search?q=` | JWT | 按用户名/邮箱模糊搜（只返回 `{id, username}`，不含邮箱/哈希/token） |
| POST | `/api/friends/request` | JWT | body `{toUserId}`；幂等：已是好友/已申请则返回对应状态 |
| GET  | `/api/friends/requests` | JWT | 我收到的 `pending` 申请列表 |
| POST | `/api/friends/respond` | JWT | body `{requestId, action: 'accept'|'reject'}`；accept 时写 `friendships` |
| GET  | `/api/friends` | JWT | 我的好友列表 `[{id, username}]`（在线状态由前端经 WS 获取，不在此接口） |
| GET  | `/api/chat/history?friendId=&before=&limit=` | JWT | 分页历史，`before` 为 `created_at` 游标，倒序取再前端反转 |
| POST | `/api/internal/chat/persist` | **service token** | WS 服务回调写一条消息；校验 `X-Service-Token` 头 |

**安全要点**：
- `/api/users/search` 必须脱敏，绝不返回 `email` / `password_hash` / `modelscope_token`。
- `/api/internal/chat/persist` 不接受 JWT，只接受预共享 service token（新增 Worker Secret `CHAT_SERVICE_TOKEN`），防止伪造写库。
- 所有好友操作校验「操作者就是 JWT 主体」，禁止替他人发/批申请。

### 5.2 ECS WebSocket 服务（`server/chatSocket.js`）

- **挂载**：作为 `server/index.js` 同进程的 WS 升级处理，或独立 PM2 进程；路径 `wss://novel-origin.zhaxiaoji.com/ws/chat`。
- **库**：原生 `ws`（轻量，够用；不必上 socket.io）。
- **鉴权**：握手时从 query (`?token=`) 或首条消息取 JWT → 用 `node:crypto` webcrypto + 共享 `JWT_SECRET` 复刻 `verifyToken()` 逻辑验签 → 得 `userId`。验签失败立即关闭连接。
- **连接表**：内存 `Map<userId, Set<WebSocket>>`，支持多端登录。
- **权限缓存**：每连接首次需要时向 Worker 查 `isAdmin` 与「与目标是否好友」，结果在连接生命周期内缓存。

**消息协议（JSON over WS）**：

| type | 方向 | payload | 处理 |
|---|---|---|---|
| `chat:message` | C→S→C | `{to, body, clientMsgId}` | 校验好友 → 转发对方在线 socket → 回调 Worker 持久化 → 回 `chat:ack{clientMsgId, id, created_at}` |
| `chat:ack` | S→C | `{clientMsgId, id, created_at}` | 前端把乐观消息标记为已送达 |
| `chat:typing` | C→S→C | `{to, typing:bool}` | 仅转发，不持久化 |
| `presence:sync` | S→C | `{userId, online}` | 好友上下线广播给其好友 |
| `call:offer` | C→S→C | `{to, sdp}` | **仅 admin 可发**；非 admin 直接拒绝并回错误 |
| `call:answer` | C→S→C | `{to, sdp}` | 转发 |
| `call:ice` | C→S→C | `{to, candidate}` | 转发 |
| `call:hangup` | C→S→C | `{to}` | 转发 |

**视频权限二次校验**：`call:*` 一律在服务端检查发起者 `isAdmin`，前端隐藏按钮只是 UX，不构成安全边界。

---

## 6. 前端设计（`src/modules/chat/`）

```
src/modules/chat/
├── index.js              # ModuleDescriptor: id:'chat', title:{zh:'好友',en:'Friends'}, theme, routes, home
├── ChatRoute.jsx         # 布局：左=好友列表+申请徽标，右=会话窗（含视频面板）
├── useChatSocket.js      # WS 连接/重连(指数退避)/收发/presence/ack
├── useWebRTC.js          # getUserMedia + RTCPeerConnection；信令通过 useChatSocket 收发
└── components/
    ├── AddFriend.jsx       # 搜索框 + 搜索结果 + 发申请按钮
    ├── FriendList.jsx      # 好友列表，带在线圆点
    ├── FriendRequests.jsx  # 收到的待处理申请，同意/拒绝
    ├── ConversationView.jsx# 选中好友后的会话容器
    ├── MessageList.jsx     # 消息气泡列表 + 分页加载更早
    ├── MessageInput.jsx    # 输入框 + typing 上报
    └── VideoCallPanel.jsx  # 本地+远端 video，呼叫/接听/挂断/静音（仅 admin 显示）
```

**集成点**：
- `src/shell/paths.js`：新增 `CHAT: '/chat'`。
- `src/shell/ModuleRegistry.js`：`import chat` 并加入 `modules` 数组。
- `src/components/Dashboard.jsx`：新增 `onEnterChat` prop + 一个 mac-button（与 Novel/Chords 同模式）；**对游客隐藏**（`!isGuestMode && user` 时才渲染）。
- `src/modules/home/HomeRoute.jsx`：新增 `onEnterChat` 回调 → `navigate(ROUTES.CHAT)`。
- 模块描述符 `home.visible` 配合前端守卫：游客不显示卡片。

**环境变量**：
- `VITE_CHAT_WS_URL`（默认 `wss://zhaxiaoji.com/ws/chat` 或 ECS 域名）。
  ⚠️ 按 CLAUDE.md 铁律：本地 dev override 用 `.env.development.local`，**绝不**用 `.env.local`，避免 `localhost` 漏进生产 bundle。

---

## 7. WebRTC 视频流程（Phase 3）

1. admin 在会话窗点「视频通话」→ `getUserMedia({video, audio})` 取本地流。
2. 创建 `RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] })`。
3. `createOffer()` → 经 `call:offer` 发给对方。
4. 对方 `setRemoteDescription` → `createAnswer()` → `call:answer` 回传。
5. 双方交换 `call:ice` 候选直到连通；媒体流 **P2P 直连，不过服务器**。
6. 任一方 `call:hangup` → 关闭 `RTCPeerConnection` + 停止本地轨道。

**前提核对（部署时一次性确认）**：
- `getUserMedia` 仅在 **HTTPS** 可用 → ✓ 站点已是 `https://zhaxiaoji.com`。
- 信令需 **WSS** 透过前置代理（CF / nginx 均原生支持 WS 升级）→ 部署时验证一次。
- 若发现部分网络 P2P 连不通（对称 NAT）→ 后续在 ECS 跑 `coturn`，admin 单路通话带宽可忽略。

---

## 8. 容错与边界情况

| 场景 | 处理 |
|---|---|
| WS 断线 | 指数退避自动重连；重连后用本地 last-seen `created_at` 调 `/api/chat/history` 补拉断线期消息 |
| 消息发送中断线 | 乐观渲染 + `clientMsgId`；超时未收到 `chat:ack` 标记「发送失败/重试」 |
| 重复消息 | 前端按 `clientMsgId` / server `id` 去重 |
| 摄像头/麦克风被拒 | 捕获 `getUserMedia` 异常，提示「需授权摄像头」 |
| ICE 连接失败 | 提示「网络无法直连，可能需要中继」，挂断 |
| 非好友发消息 | 服务端拒绝并回错误，不持久化 |
| 非 admin 发起视频 | 服务端拒绝 `call:offer` |
| JWT 无效/缺失 | WS 拒绝握手；REST 返回 401 |
| 自己加自己 / 重复申请 | Worker 幂等处理，返回友好状态 |

---

## 9. 测试策略

- **单元**：`conversationKey()`、`normalizeFriendship()`、消息分页游标、JWT 验签（ECS 侧用同密钥对 Worker 签发的 token 验签通过）。
- **WS 集成**：用两个 `ws` client 模拟 A/B，断言 message/typing/presence/call 信令正确转发与权限拒绝。
- **REST 集成**：好友申请全流程（search→request→requests→respond→friends）、脱敏校验、service token 校验。
- **端到端**：A、B 两个浏览器上下文走「加好友→聊天→消息送达→（admin）视频建连」。
  ⚠️ 记忆提示 `browse` 工具难长时间持有 session；聊天为短交互一般可行，但双窗口实时收发与视频建连可能需手动验证一次。

---

## 10. 分阶段实现计划

| 阶段 | 内容 | 验收 |
|---|---|---|
| **Phase 1：好友系统** | D1 三表 + Worker REST（search/request/respond/friends）+ 前端 AddFriend/FriendList/FriendRequests + 首页卡片 | 无需实时即可完成加好友闭环 |
| **Phase 2：实时文字聊天** | ECS WS 服务（JWT 验签 + 连接表 + message/typing/presence）+ `/api/chat/history` + `/api/internal/chat/persist` + 前端 useChatSocket/ConversationView/MessageList/MessageInput | 两端实时收发 + 历史持久化 + presence |
| **Phase 3：视频通话** | WS 信令 `call:*`（admin 校验）+ 前端 useWebRTC/VideoCallPanel + STUN | admin 与好友建立 P2P 视频 |

---

## 11. 风险与待确认项

- **WSS 透传**：需确认 `novel-origin.zhaxiaoji.com`（及 CF 前置）允许 WebSocket 升级。属部署核对项，非阻塞。
- **ECS 首次引入入站 JWT 校验**：此前 ECS 仅信任 CF 代理；WS 服务是第一个被浏览器直连且需自行验签的 ECS 端点。需共享 `JWT_SECRET` 到 ECS 环境。
- **`isAdmin` 不在 token 内**：WS 服务需回调 Worker 查管理员身份（连接内缓存）。
- **D1 1MB 单行限制**：纯文本消息无虞；未来若加图片需走 R2，不在本期。
- **资源队列**：本模块**不接入** resource_locks（真人聊天不调 ECS LLM），与思考博物馆同属豁免。
