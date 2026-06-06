# 变更日志 (Changelog)

本文件记录项目的重要变更，包括功能更新、Bug 修复和数据库迁移等。

## [2026-06-06] UI 重构 Phase F — 设计系统地基（taste-skill）

### 新功能
- **全局明暗切换**：右上角三态 toggle（跟随系统 / 浅色 / 深色），偏好持久化到 localStorage；解析优先级 = 用户显式偏好 > 模块默认主题 > 系统 `prefers-color-scheme`（狼人杀默认深色、生产力模块默认浅色）。内联脚本防 FOUC。
- **设计 token 修订**：凹陷面改 off-black（弃用纯黑）、新增 `--market-up/down`（A股红涨绿跌，与 UI 语义色解耦）、阴影染背景色调、新增 `rounded-input` 圆角档位。
- **legacy `.mac-*` 双主题化**：旧组件无需改 JSX，通过 `[data-theme="dark"]` 变量覆盖自动适配深色（Dashboard/Auth/Setup/Sites 等一次性受益）。

### 文件变更
| 文件 | 操作 | 说明 |
|------|------|------|
| `src/shell/theme.js` | 新建 | resolveTheme + 偏好持久化（含单测） |
| `src/components/ThemeToggle.jsx` | 新建 | 三态切换组件（含单测） |
| `src/shell/ShellProvider.jsx` | 修改 | themePref 跨模块状态 |
| `src/shell/Router.jsx` | 修改 | 按偏好解析主题 |
| `src/shell/GlobalOverlays.jsx` | 修改 | 挂载 ThemeToggle |
| `index.html` | 修改 | 防 FOUC 内联脚本 |
| `src/styles/tokens.css` | 修改 | token 修订（off-black/market/阴影/radius） |
| `src/styles/legacy-mac.css` | 修改 | `.mac-*` 双主题变量 + 暗色对比度修复 |
| `src/styles/base.css` | 修改 | 页面底色随主题、装饰渐变仅浅色 |
| `tailwind.config.js` | 修改 | rounded-input/pill + market 色映射 |

### 技术细节
- 主题机制：`ThemeScope` 在模块根写 `[data-theme]`，全局 toggle 由 `ShellProvider` 持有偏好、`Router` 调 `resolveTheme` 解析；CSS 变量自动切换，无需逐组件改写。
- 验收：`npm run build` 通过（check-build 无 localhost 泄漏）；37 个测试文件 / 256 用例全绿；`src/ui/` 9 个原语 100% token 化、无任意圆角。
- 范围：本期为地基（视觉打磨 + 响应式起步），不含各业务组件硬编码色逐一替换、狼人杀手机端重做、股票主题修复——留待 M1–M4。

## [2026-06-03] 屏幕共享 Phase 4（参考钉钉/腾讯：屏幕+摄像头同时）

### 新功能
- **桌面端屏幕共享**：通话中点「共享屏幕」，对方**同时**看到你的屏幕（主视图）+ 摄像头（缩略图）；双方都可共享；停止共享回到摄像头。
- **会议级 UI**：摄像头小窗**可拖动 + 拉边框缩放**（画中画）；控制栏「全屏」「隐藏栏」「最小化摄像头」；屏幕共享**清晰度选择 720p/1080p**（默认 1080p）。

### 架构
- **预协商第二条视频 transceiver**（camera + screen），屏幕共享 = `replaceTrack`，**无需重新协商**（沿用 Phase 3 稳健性）。媒体仍 P2P，不过服务器。
- 收发端按 **transceiver.kind** 识别 camera/screen（非 receiver.track.kind，避免静默对调）。
- 信令复用 WS：`call:screenshare{on}` 中继（chatHub）。**无 D1/Worker/secret/依赖改动。**

### 健壮性（来自 3 代理对抗评审，5 must-fix）
- transceiver.kind 识别；远端流身份稳定（原地增删轨，防闪烁）；远端音频独立常驻 `<audio>`（布局切换不断音）；setupAnswerer await replaceTrack 再 createAnswer（防 recvonly）；getDisplayMedia sharingRef 闩 + 捕获 sender 身份（防跨通话泄漏）。

### 文件变更（主要）
| 文件 | 操作 | 说明 |
|------|------|------|
| `server/chatHub.js` | 修改 | CALL_TYPES 加 call:screenshare，透传 on |
| `src/hooks/useWebRTC.js` | 修改 | 第二 transceiver + 远端轨重映射 + start/stop/applyResolution 屏幕共享 |
| `src/modules/chat/pipUtils.js` + `components/DraggablePiP.jsx` | 新建 | 画中画夹取纯函数 + 可拖动/缩放容器 |
| `src/modules/chat/components/VideoCallPanel.jsx` | 修改 | 会议布局 + 独立音频 + 全屏/隐藏栏/最小化/清晰度 |
| `src/modules/chat/ChatRoute.jsx` | 修改 | 透传屏幕共享相关 props + canScreenShare |

### 部署注意
- 前端 `npm run deploy`；ECS `git pull && pm2 restart`（call:screenshare 中继；无 npm install/nginx/secret）。
- 验证：245 测试通过；屏幕共享端到端（桌面双真人）需手动验证。

## [2026-06-03] 视频通话 Phase 3（WebRTC，仅管理员发起）

### 新功能
- **好友 1 对 1 视频通话**：管理员在会话里点「视频通话」发起，好友收到来电浮层可接听/拒绝。
- **通话控制**：本地+远端画面、静音、关摄像头、挂断；来电浮层（admin 不可见呼叫按钮以外的限制由服务端兜底）。

### 架构
- 纯前端 WebRTC（原生浏览器 API，无新依赖）；媒体 **P2P 直连 + 公共 STUN**（无 TURN），不过服务器。
- 信令复用 Phase 2 的 WS 通道：ECS chatHub 中继 `call:offer/answer/ice/hangup`。
- **无 D1 / 无 Worker handler 改动 / 无新 secret / 无新服务端依赖**（仅 chatHub.js 加中继）。

### 安全 & 健壮性（来自 4 代理对抗评审，5 must-fix）
- `call:offer` **服务端强制 isAdmin**（前端隐藏按钮不算边界）；call:* 走好友校验 + 令牌桶限流（防 ICE flood 放大成 Worker fetch）。
- `CONNECTED` 对任意活跃阶段生效（修复"ICE 早于 answer 落地→永远卡连接中"）；信令只订阅一次 + 串行化 + 实时 ref 读忙线（修复重订阅丢帧/竞态）；ICE drain 原子化（修复候选丢失）；每个 await 后校验 pc 身份（修复挂断竞态误发 hangup）；iceConnectionState 兜底 + 45s 振铃超时（Safari/无应答）；独立 error 阶段让相机被拒等错误可见。
- 非对称发起（仅 admin 发 offer）天然消除 WebRTC glare。

### 文件变更（主要）
| 文件 | 操作 | 说明 |
|------|------|------|
| `server/chatHub.js` | 修改 | call:* 中继（offer 校验 isAdmin + 限流 + TTL 好友校验） |
| `src/modules/chat/webrtcReducer.js` | 新建 | 通话状态机（纯函数，CONNECTED 权威 + error 阶段） |
| `src/hooks/useWebRTC.js` | 新建 | RTCPeerConnection + getUserMedia + 信令接线（评审修订全并入） |
| `src/hooks/useChatSocket.js` | 修改 | 加通用 `sendSignal` |
| `src/modules/chat/components/VideoCallPanel.jsx` | 新建 | 来电/通话/错误浮层 |
| `src/modules/chat/ChatRoute.jsx` / `ConversationView.jsx` | 修改 | 挂 useWebRTC + 浮层；admin 会话头「视频通话」按钮 |

### 部署注意
- 前端 `npm run deploy`（已含视频 UI）；ECS `git pull && pm2 restart`（chatHub 中继生效，**无需 npm install / nginx / secret**）。
- 验证：单元 + 全量 237 测试通过；WebRTC 端到端（双真人视频）需手动验证（jsdom 无 RTCPeerConnection）。

## [2026-06-03] 实时文字聊天 Phase 2（好友私聊 + 在线状态）

### 新功能
- **好友 1 对 1 实时文字聊天**：好友之间实时收发消息，消息持久化到 D1（单一数据源）。
- **在线状态(presence)**：好友上线/离线实时显示绿点；「对方正在输入…」提示。
- **断线自愈**：WS 指数退避自动重连，重连后自动补拉断线期消息；发送乐观更新 + ack 对账 + 失败态。

### 架构
- 浏览器原生 WebSocket **直连 ECS 源站** `wss://novel-origin.zhaxiaoji.com/ws/chat`（CF Worker 无法转发 WS 升级）。
- ECS 在现有 Express 进程内挂 `ws` 服务（`app.listen` → `http.createServer` + WebSocketServer）；presence 表单进程（PM2 instances:1）。
- **握手鉴权委托**：ECS 不持有 JWT_SECRET；WS 握手把 token 交给 Worker `GET /api/me` 验证（消除"两边 secret 字节一致"的脆弱耦合）。收到消息回调 Worker `POST /api/internal/chat/persist` 写 D1。
- 修复既有 bug：`/api/me` 历史上误用 `user.id`（JWT 载荷字段实为 `sub`）始终返回 undefined；前端只读 isAdmin 未暴露，但鉴权委托依赖 user.id，改为 `user.sub`。

### 安全加固（来自 4 代理对抗评审，10 must-fix）
- token 走 `Sec-WebSocket-Protocol` 子协议（不进 URL/nginx 日志）。
- WS `maxPayload` 16KB + 关压缩（防内存耗尽 DoS）；每连接令牌桶限流；每用户连接数上限 5。
- 握手鉴权委托 Worker `/api/me` + Origin 白名单（cors 不覆盖 upgrade）；启动做 Worker 可达性检查。
- persist 端点：service token + **好友关系校验**（token 泄露也无法向任意会话伪造写入）。
- 历史分页用唯一 `id` 游标（非 created_at，避免同毫秒丢消息/乱序）。

### 数据库迁移
- `migrations/005_chat_messages.sql`：`chat_messages` 表 + `(conversation_key, id)` 索引。

### 文件变更（主要）
| 文件 | 操作 | 说明 |
|------|------|------|
| `migrations/005_chat_messages.sql` | 新建 | 私聊消息表 |
| `workers/auth/chatLib.js` / `chat.js` | 新建 | conversationKey/分页纯函数 + history/persist 端点 |
| `workers/auth/index.js` | 修改 | 注册 `/api/chat/history`、`/api/internal/chat/persist` |
| `server/chatHub.js` / `chatSocket.js` | 新建 | WS 实时核心（限流/连接表/presence/多标签）+ 接线（子协议鉴权/maxPayload/自检） |
| `server/index.js` | 修改 | `app.listen` → `http.createServer` + 挂 WS（REST 不变） |
| `server/package.json` / `ecosystem.config.cjs` | 修改 | 加 `ws` 依赖；env 透传 JWT_SECRET/CHAT_SERVICE_TOKEN |
| `src/hooks/useChatSocket.js` | 新建 | WS 连接/重连/收发/presence hook |
| `src/modules/chat/components/{MessageList,MessageInput,ConversationView}.jsx` | 新建 | 会话 UI |
| `src/modules/chat/ChatRoute.jsx` / `src/services/friendService.js` | 修改 | 接入会话 + getHistory |
| `docs/deploy/phase2-chat-deploy-runbook.md` | 新建 | 手动部署手册（nginx WS、cloudflared、secrets、顺序、烟测） |

### 部署注意
- **顺序**：先 D1 迁移 005 + Worker 部署（含 /api/me 修复），再 ECS 重启。
- ECS 只需新增 `CHAT_SERVICE_TOKEN`（从 `/root/.config/wolfgame/*.env` source，**不再需要 JWT_SECRET**）+ nginx `/ws/chat` 升级规则 + `npm install`（ws 新依赖）。详见部署手册。
- 验证：单元 + 双 client 集成 + **跨服务烟测（ECS WS → Worker → D1 全链路）** 全过；全量 215 测试通过。

## [2026-06-03] 好友系统 Phase 1（私聊/视频的基础层）

### 新功能

- **好友系统**：用户名/邮箱搜索 → 发好友申请 → 对方同意/拒绝 → 好友列表。作为新 `chat` 模块（`/chat`，标题「好友」），与狼人杀/小说/音乐实验室平级。
- **首页入口对游客隐藏**：仅登录用户能在 Dashboard 看到「好友」按钮；游客直接访问 `/chat` 会看到登录引导。
- **不受资源队列限制**：真人好友交互不调 ECS LLM，与思考博物馆同属豁免。
- **后续阶段**：Phase 2（ECS WebSocket 实时文字聊天 + presence）、Phase 3（WebRTC 视频通话，仅管理员）已在 spec/plan 中规划，本次仅交付 Phase 1。

### 权限矩阵

| 用户 | 首页入口 | 搜索/加好友 | 文字聊天(P2) | 视频(P3) |
|---|:---:|:---:|:---:|:---:|
| Admin | ✅ | ✅ | ✅ | ✅ |
| 普通登录用户 | ✅ | ✅ | ✅ | ❌ |
| 游客 | ❌（隐藏） | ❌ | ❌ | ❌ |

### 数据库迁移

- `migrations/004_friendships.sql`：新增 `friendships`（无向边，规范化 user_a<user_b）、`friend_requests`（带 UNIQUE 去重）两表 + 申请索引。已应用到本地与生产 D1。

### 文件变更

| 文件 | 操作 | 说明 |
|------|------|------|
| `migrations/004_friendships.sql` | 新建 | 好友关系 + 好友申请表 |
| `workers/auth/friendsLib.js` | 新建 | 纯函数：`normalizeFriendship` / `sanitizeSearchQuery`（含单测） |
| `workers/auth/friends.js` | 新建 | 5 个 API：搜索/申请/申请列表/响应/好友列表（脱敏，仅返回 id+username） |
| `workers/auth/index.js` | 修改 | 注册 `/api/users/search` 与 `/api/friends*` 路由 |
| `src/services/friendService.js` | 新建 | 前端封装（基于 `useShell().api('cf-workers')`，含单测） |
| `src/modules/chat/` | 新建 | 模块描述符 + ChatRoute + AddFriend/FriendRequests/FriendList（含组件冒烟测试） |
| `src/shell/paths.js` | 修改 | 新增 `CHAT: '/chat'` |
| `src/shell/ModuleRegistry.js` | 修改 | 注册 chat 模块 |
| `src/components/Dashboard.jsx` | 修改 | 新增「好友」按钮（游客隐藏） |
| `src/modules/home/HomeRoute.jsx` | 修改 | 新增 `onEnterChat` 回调 |

### 技术细节

- WS 服务的 JWT 认证可复用现有 `verifyToken`（HS256/Web Crypto，Node 端可同密钥验签）——为 Phase 2 预留。
- `isAdmin` 不在 JWT 内，由 `admins` 表判定（Phase 3 视频鉴权时 WS 服务回调 Worker）。
- 验证：15 个新单测 + 全量 188/188 通过；本地 `wrangler dev` + D1 跑通完整好友流程，确认搜索/好友列表无 email/password 泄漏、自加好友 400、未登录 401。

## [2026-05-11] 小说工作台开放只读访问（游客与普通用户）

### 新功能

- **首页入口对全员可见**：Dashboard 上的「小说工作台」按钮不再要求登录，游客也能直接进入。
- **GET 端点公开化**：CF Worker 的 `/api/novel/*` GET/HEAD 请求不再强制 JWT；POST/PATCH 仍需鉴权。游客和普通用户能浏览章节、故事圣经、章节摘要，但无法触发写操作。
- **QueueGate `readOnly` 旁路**：只读浏览不消耗 ECS 资源（不调 Codex CLI），所以无需排队锁；这让多个非 admin 用户能同时浏览不同小说。

### 权限矩阵

| 用户 | 首页按钮 | 浏览章节 | 编辑/保存 | Codex 对话 |
|---|:---:|:---:|:---:|:---:|
| Admin | ✅ | ✅ | ✅ | ✅ |
| 普通登录用户 | ✅ | ✅ | ❌ | ❌（锁图标）|
| 游客 | ✅ | ✅ | ❌ | ❌（锁图标）|

### 文件变更

| 文件 | 操作 | 说明 |
|------|------|------|
| `workers/auth/novel.js` | 修改 | GET/HEAD 跳过鉴权；写方法仍需 JWT；游客请求标记 `X-Zhaxiaoji-Role: guest` |
| `src/services/novelService.js` | 修改 | 按 HTTP method 分流：GET 允许无 token，写方法需 token |
| `src/components/Dashboard.jsx` | 修改 | 移除 `isLoggedIn && !isGuestMode` 限制 |
| `src/components/QueueGate.jsx` | 修改 | 新增 `readOnly` prop，true 时短路队列锁 |
| `src/modules/novel/NovelRoute.jsx` | 修改 | 给 QueueGate 传 `readOnly` |
| `src/components/NovelWorkspace.jsx` | 修改 | `ReaderPane` 加 `canEdit` prop，门控编辑按钮和 textarea |
| `src/components/__tests__/novelWorkspace.test.jsx` | 修改 | 补 `vi.mock` for useAuth（修复历史遗留的测试断裂）|

### 技术细节

- **HTTP 方法即权限语义**：GET 公开、写方法受控，不引入新的角色字段。每一层（Worker / service / UI）独立守护，任一层被绕过下一层都会兜底。
- **5 层防御**：QueueGate readOnly → novelService 按 method 鉴权 → Worker 按 method 鉴权 → UI canEdit gating → CodexChat 仅 admin 可见。
- **测试**：5 frontend + 11 server tests 全部通过。

## [2026-05-18] Bug 修复 + voteDecided 投票系统 + 8 轮 Prompt 优化

### Critical Bug 修复

- **女巫解药永远无法使用**：logicValidator.js 的 validateWitchSave 读取 `nightDecisions.wolfKill`（不存在），实际字段名是 `wolfTarget`。自引入 validator 以来女巫解药从未生效。同时修复毒药路径的同名 bug。
- **最后发言者卡住不进投票**：moveToNextSpeaker 在 microtask 中调用时，speechHistory 闭包未包含最后一条 recordSpeech（React batching）。改为接受 `justSpokenId` 参数绕过闭包时序问题。
- **玩家被跳过不发言不投票**：计数器 `spokenCount` 闭包过期导致提前进入投票。改为 `.every()` 全员验证 + `justSpokenId` 兜底。
- **投票语义反转**：AI 把"投票支持7号"理解为"投7号出局"。在发言 prompt 和投票 prompt 双重添加"voteIntention=想投票淘汰的人"语义校正。
- **lastVoteIntention 未传递**：投票阶段 AI 不知道自己发言时说了投谁（params 缺失 lastVoteIntention）。
- **voteDecided 类型不一致**：LLM 返回字符串 `"true"` 时 `=== true` 判断失败。

### 新功能

- **voteDecided 投票决策分离**：发言时 AI 填 `voteDecided=true/false`。true→投票阶段直接用 voteIntention；false→给 AI 额外一次投票思考调用。
- **PK 平票机制**：平票→被投候选人 PK 发言→全员重投→再平票进入黑夜（替代随机出局）。
- **发言顺序移至 SetupScreen**：从游戏中面板移至开局配置页，游戏中只读显示。

### Prompt 优化（8 轮）

| 角色 | 改动要点 |
|------|---------|
| 狼人（白天） | thought/speech 绝对防火墙 + ABCD 四种欺骗策略 + 被查杀应对剧本 |
| 狼人（系统） | **移除"自爆"指令**——这是 AI 自爆行为的根本原因（system prompt > user prompt） |
| 狼人（夜间） | 首夜/后续夜刀法策略分离 + "刀预言家断信息链"引导 |
| 村民 | 禁止被动话术 + 每次发言要求核心观点 + 分析框架 |
| 预言家（白天） | 指挥官语气 + 绝不投金水硬约束 |
| 预言家（夜间） | 首夜策略（边角/随机/关键位）vs 后续夜（最可疑目标） |
| 女巫 | 注入实际行动记录防幻觉（"你还没救过任何人"） |
| 猎人（白天） | 主动分析 + 心中锁定开枪目标 |
| 猎人（开枪） | 强化 "带走好人=帮狼人" 警告 |
| 守卫（白天） | 利用守护信息推理但不暴露身份 |
| 守卫（夜间） | 后续夜策略 + 守护结果分析指引 |
| 全角色 | 自我身份提醒（"你就是X号，用我不用第三人称"） |
| 全角色 | 发言进度上下文（已发言/未发言列表） |
| 全角色 | 被指控应对指南（逻辑反驳 + 反问指控者 + 不要沉默） |
| 全角色 | 个性特征强化到发言上下文（不同风格说不同话） |
| COT | 移除"划水"策略选项 + 投票语义校正 |
| 投票 | targetId 语义提醒 + thought 字段 + lastVoteIntention 传递 |

### 根因发现

狼人 AI 自爆的根本原因：`STRATEGIES['狼人']` 系统级 prompt 写了"形势不利可倒钩或自爆"。LLM 把"自爆"理解为"承认自己是狼人"（在真人狼人杀中是战术性牺牲确认身份）。System prompt 优先级 > user prompt，所以之前所有的伪装指令都被这条覆盖。

## [2026-05-11] 游戏日志审计完整性修复（导出黑匣子）

修复导出函数胜负误判 bug，补齐所有角色"空守/不用药/AI 决策无效"等分支的 nightAction 记录，让全 AI 模式下角色思考过程实时显示在 UI。

### Bug 修复

- **导出胜负误判**：`exportGameLog.js` 之前用 `aliveWolves > 0 → 狼人胜` 判定，完全忽略真实 `gameResult` 状态。中途导出未结束的游戏会被错误标记为狼人胜利。改为接收 `gameResult` 参数，未结束状态明确标注为"快照"。
- **审计黑洞**：守卫空守、女巫不用药、预言家放弃查验、AI 决策无效/被拒等所有非"采取行动"分支只走 `addLog` 不写 `recordNightAction`，导出后看不到这些决策。现在每条分支都写 nightAction，附带 thought 和拒绝原因。

### 新功能

- **全 AI 模式实时思考过程**：useNightFlow 所有角色（守卫/狼人/预言家/女巫/魔术师/摄梦人）+ useDayFlow（投票/猎人开枪）+ useSpeechFlow（发言）在 ai-only 模式下，AI 的 `thought` 字段会通过新增的 `thought` 类型 addLog 实时显示。
- **GameLog 新增 thought 类型样式**：紫色斜体、不大写、左对齐，与系统通知 / 警告 / 成功明显区分。
- **导出文件加入完整事件流**：新增【完整事件流（系统日志）】、【结构化声明事件】、【当前阶段快照】、【未结算的夜间决策】四个 section。【AI 身份推理表】按天分组（之前只保留每人最后一次）。每条 nightAction 带时间戳和 source。
- **addLog 现在自动写入 timestamp**，导出时按时序回放。

### 文件变更

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/utils/exportGameLog.js` | 重写 | 接收 gameResult/logs/claimHistory/currentPhaseData/phase/nightDecisions；按天分组推理表；加入完整事件流 |
| `src/hooks/useNightFlow.js` | 修改 | 守卫/魔术师/摄梦人/狼人/预言家/女巫 所有 else 分支补 recordNightAction；ai-only 模式 addLog thought |
| `src/hooks/useDayFlow.js` | 修改 | 投票循环和猎人开枪在 ai-only 模式 addLog thought |
| `src/hooks/useSpeechFlow.js` | 修改 | 发言 thought 改用 'thought' 类型而非 'chat' |
| `src/components/GameLog.jsx` | 修改 | 新增 'thought' 类型渲染（紫色斜体） |
| `src/useWerewolfGame.js` | 修改 | addLog 自动写入 timestamp 字段 |
| `src/modules/werewolf/WerewolfModule.jsx` | 修改 | 导出时透传 gameResult/logs/claimHistory/currentPhaseData/phase/nightStep/nightDecisions |

### 根因诊断（来自用户反馈的游戏日志分析）

用户提供了一份导出日志，发现：
1. "胜利模式: 屠边模式 / 游戏结果: 狼人阵营胜利" 但 1 狼 vs 2 民 + 1 神，屠边条件未满足 → 导出函数自身 bug
2. 守卫两晚都没记录、预言家无查验、女巫无用药 → AI 选择"空守/不用药"时只 addLog 没 recordNightAction，记录通道断了
3. 第 2 天发言只有 2/5 人 → 导出是游戏中途快照（与上面胜负判错对应）

这些都对应"无法区分'AI 选了空动作' vs '流程根本没跑到该角色'"的审计盲区，本次修复让导出文件具备完整的根因分析能力。

## [2026-05-08 ~ 05-10] Werewolf Agent Adapter v1 + 生产全链路修复

从零搭建 MiniMax/Claude Code 狼人杀 AI 代理适配器，并修复生产环境端到端链路，使游戏从「完全无 AI 响应」到「8 玩家完整夜→天循环」可玩。

### 核心功能：Werewolf Agent Contract v1

新增 `server/werewolfAgent/` 模块组（7 个文件），为 7 种游戏动作提供 contract-driven 的 prompt 组装 → 验证 → 修复 → 兜底管线：

| 模块 | 职责 |
|------|------|
| `contracts.js` | 7 种 action 的 schema、字段类型、合法目标来源、修复指南、兜底策略 |
| `capabilities.js` | 按 action 生成 public/private facts + 合法目标列表 + 策略提示 |
| `skills.js` | 按角色注入中文技能描述（只注入当前玩家的，不泄露其他角色） |
| `memory.js` | 5 层压缩记忆视图（public/private/semantic/episodic/strategy） |
| `validator.js` | 严格 JSON 解析 + 字段类型 + 目标合法性 + action 专属规则 |
| `promptComposer.js` | schema-first prompt 组装（SYSTEM RULES → ACTION → PRIVATE → PUBLIC → SCHEMA → JSON-ONLY） |
| `repair.js` | 最多 2 次修复重试，失败则确定性兜底（skip-vote / first-legal-target / witch-no-op 等） |

### 生产链路修复（按发现顺序）

| # | Bug | 影响 | 修复 |
|---|-----|------|------|
| 1 | identity_table 校验过严 | 5/7 action 触发无谓 repair（MiniMax 用英文 metadata label） | 改成 sanitize 而非 reject |
| 2 | server CORS 写死 zhaxiaoji.com | 本地 dev 不能跑 | 支持逗号列表 + 非 prod 自动放过 localhost |
| 3 | 视觉资产用 reasoning LLM 生成 SVG | 70s 超时 → 502，100% 失败 | 改用本地确定性 SVG（17ms，0 token） |
| 4 | ECS PM2 没继承 MiniMax token | 所有 ask 90s 超时 | /etc/wolfgame/env + fail-fast 启动检查 |
| 5 | /health 不暴露 provider 状态 | 配置错误隐藏在 90s 超时背后 | ECS + Worker 联通 health probe |
| 6 | .env.local 把 dev URL 写进 prod bundle | prod `fetch('')` → 405 | 改名 .env.development.local + post-build guard |
| 7 | wrangler state 缓存旧 asset manifest | deploy 后 prod 仍 serve 旧 bundle | deploy 脚本自动清 .wrangler/state |
| 8 | Workers Assets env.ASSETS 内部缓存 | HTML 永远返回旧版 | 移除 SPA handler + 内联 HTML 到 Worker 脚本 |
| 9 | Claude Code `--resume` 跨 action | 预言家白天发言输出夜间 schema → fallback | game-action 永不 resume |
| 10 | 投票并行 8 个 spawn | ECS 资源竞争 → 偶发 502 | 投票改顺序 + server 并发限制（2 inflight） |
| 11 | ECS 用 claude-code provider | 连续 10+ spawn transient fail | 切到 minimax-api 直接 HTTP |
| 12 | handleAutoVote 重入竞争 | askAI 内部 setIsThinking(false) 重触发投票 useEffect | votingInProgressRef 防重入 |
| 13 | voteDispatch 被拒 → 无推进 | 投票后游戏卡死 | 拒绝时仍推进到下一夜 |
| 14 | handleVote 引用未导入的 IS_HYBRID | 玩家模式投票 crash | 改用已导入的 btDecide |
| 15 | outPlayer null → dead end | 投票后卡死 | 记录空投票 + 推进 |
| 16 | useNightFlow catch rethrow | 夜间 AI 错误 → 永久卡夜 | 不 rethrow，advance 下一步 |
| 17 | 女巫毒药缺少大括号 | validator 拒绝后仍然毒人 | 加正确的 else {} |
| 18 | proceedNight stale resolveNight | 过时的夜间结算数据 | 加 resolveNight 到 useCallback deps |
| 19 | speech 为空时不标记已发言 | 同一玩家无限重发言 | 收到 res 立刻标记 spoken |
| 20 | VITE_BT_API_URL 指向不存在的域名 | CORS 报错 + 500ms 死时间 | 注释掉 |

### 部署基建

- `scripts/check-build.mjs`：post-build 静态守门，扫 dist 找 localhost / 127.0.0.1 / 私网 IP / file://，发现即 fail build
- `scripts/inject-html.mjs`：deploy 时将 dist/index.html 内联到 Worker 脚本，绕过 Workers Assets 的内部缓存
- `npm run deploy` 管线：inject → 清 wrangler state → wrangler deploy → git checkout 还原源码
- Worker HTML 响应：`Cache-Control: no-store` + `Vary: *` + `CDN-Cache-Control: no-store`，永不被 CF edge 缓存
- ECS `/health` 暴露 provider 状态；Worker `/api/health` 反映上游就绪性

### 文件变更

| 文件 | 操作 | 说明 |
|------|------|------|
| `server/werewolfAgent/*.js` (8 个) | 新建 | v1 contract adapter 全套 |
| `server/werewolfSession.js` | 重构 | adapter 管线 + 确定性 SVG + no-resume + checkProviderConfig |
| `server/index.js` | 修改 | CORS dev + concurrency limit + health provider + fail-fast |
| `workers/auth/index.js` | 重写 | 内联 HTML SPA fallback + no-store headers + health upstream |
| `src/hooks/useDayFlow.js` | 修复 | 投票顺序化 + 防重入 + 4 个 stuck-state fix |
| `src/hooks/useNightFlow.js` | 修复 | catch 不 rethrow + 女巫大括号 + stale closure |
| `src/hooks/useSpeechFlow.js` | 修复 | falsy speech 标记 spoken |
| `src/services/werewolfAITransport.js` | 重写 | 永远走 session path |
| `src/services/werewolfSessionClient.js` | 修改 | 转发 gameState + params + contractVersion |
| `src/hooks/useAI.js` | 修改 | session 模式传 gameState + params |
| `ecosystem.config.cjs` | 修改 | 默认 minimax-api provider |
| `wrangler.toml` | 修改 | 移除 not_found_handling |
| `scripts/check-build.mjs` | 新建 | post-build localhost leak guard |
| `scripts/inject-html.mjs` | 新建 | deploy-time HTML 内联注入 |
| `package.json` | 修改 | build 链 check-build + deploy 链 inject |
| `README.md` | 重写 | 反映 AppShell/ModuleRegistry 架构 |
| `CLAUDE.md` | 更新 | 添加「构建与部署陷阱」章节 |

### 测试覆盖

- 169 unit + integration tests passing（含 26 个新 contract/capabilities/validator 测试）
- 22-call sequential prod-fullgame stress test：21/22 成功（minimax-api 后 22/22）
- 本地浏览器 dogfood：game arena 渲染 → 守卫→狼人 phase 推进 → MiniMax M2.7 model 标签出现

## [2026-04-14] 个人主页平台重构 — Phase 3b：AppShell 切到 Router + 删 App.jsx

Phase 3a 已经准备好了模块脚手架，本提交真正**切换入口**：AppShell 改渲染 `<Router /> + <GlobalOverlays />`，旧 `App.jsx` 与 `useAppRouter.js` 整体删除，ShellProvider 的遗留路径 301 重定向激活。

### 变更要点
- **`src/AppShell.jsx`**：不再包 `<App />`，直接 `<ShellProvider><Router /><GlobalOverlays /></ShellProvider>`。应用根对任何业务模块一无所知。
- **删除 `src/App.jsx`** (~814 行) 与 **`src/hooks/useAppRouter.js`** (~110 行)：所有职责分拆到 `modules/werewolf/WerewolfModule.jsx`（游戏状态）、`shell/Router.jsx`（路由匹配）、`shell/navGuards.js`（鉴权守卫）、`shell/ShellProvider.jsx`（locale/auth/overlay/api）、`shell/useDocumentMeta.js`（SEO）、`modules/home/HomeRoute.jsx`（Dashboard 桥接）、`modules/sites/SitesRoute.jsx`（SitesPage 桥接）、`modules/auth/AuthRoute.jsx`（认证页桥接）。
- **遗留路径 301 激活**：访问 `/wolfgame`、`/wolfgame/custom`、`/wolfgame/play`、`/home` 会在首次挂载时 `history.replaceState` 到 `/werewolf`、`/werewolf/setup`、`/werewolf/play`、`/` —— 无刷新、URL 栏原地更新。
- **UI 浮层整理**：`GlobalOverlays` 只负责跨模块 LanguageToggle，在 werewolf setup/play 两条路径上返回 null 避免与模块内部 routeToolbar 重叠；`TokenManager`/`UserStats` 留在 WerewolfModule 内（只有它消费）；WerewolfModule 的 routeToolbar 重新带回 LanguageToggle，保持与原 App.jsx 一致的单浮条 UX。

### 文件变更
| 文件 | 操作 | 说明 |
|------|------|------|
| `src/AppShell.jsx` | 重写 | `<ShellProvider><Router /><GlobalOverlays /></ShellProvider>` |
| `src/App.jsx` | **删除** | 职责全部迁入 shell + modules/werewolf |
| `src/hooks/useAppRouter.js` | **删除** | 路由逻辑迁入 Router / navGuards / ShellProvider |
| `src/shell/GlobalOverlays.jsx` | 重写 | 只渲染 LanguageToggle；在 werewolf setup/play 上抑制避免重叠 |
| `src/shell/ShellProvider.jsx` | 修改 | 新增「挂载时 replaceState 到规范化路径」的副作用 |
| `src/modules/werewolf/WerewolfModule.jsx` | 修改 | routeToolbar 加回 LanguageToggle，保持单浮条 UX |

### 技术细节 — Bundle 结构重塑（用户可见的性能收益）
Phase 2b 时 gzipped main 72.57 kB（App.jsx 静态 import 拉进了所有狼人杀代码）。Phase 3b 切到 lazy module 后：

| chunk | gzip | 作用 |
|-------|------|------|
| `index-*.js` (main) | **16.84 kB** | Shell + 路由 baseline |
| `WerewolfModule-*.js` | 57.08 kB | 只有访问 `/werewolf/*` 时才加载 |
| `SitesPage-*.js` | 26.45 kB | 只有访问 `/sites` 时（Phase 4 会再拆） |
| `HomeRoute`/`SitesRoute`/`AuthRoute` | <1 kB | 每条路由独立桥接层 |
| `gameService-*.js`、`useAuthNav-*.js` | <0.5 kB | 被多入口共享，自动抽共享 chunk |

**首屏 gzip 72.57 → 16.84 kB（-77%）**：用户落在 `/`、`/login`、`/sites` 时不再下载狼人杀引擎代码；进入 `/werewolf/*` 才按需拉 57 kB 游戏 chunk。Rollup 自动抽 `gameService`/`useAuthNav` 为共享 chunk 是模块导入图变干净后的副产品。

### 已知需手测
由于入口切换影响运行时，下列场景需手测一次：
- URL 直达：`/`、`/werewolf`、`/werewolf/setup`、`/werewolf/play`、`/sites`、`/login`、`/reset-password`、`/verify-email`
- 遗留 URL 自动跳：`/wolfgame`、`/wolfgame/custom`、`/wolfgame/play`、`/home`（URL 栏应原地变到新路径）
- 浏览器前进 / 后退按钮
- 未登录访问 `/werewolf/setup` → 跳 `/login`；登录后访问 `/login` → 跳 `/`
- 狼人杀完整对局（AI-only / 人机 / 自定义阵容 / 猎人 / 女巫 / 守卫 / 投票 / 胜负 / 导出 / 战绩入库 / 模型统计上报）
- 游戏中点击 "结束并回首页" → 触发 endGame + 清理 → 跳 `/`
- 语言切换在所有路由持久化

## [2026-04-14] 个人主页平台重构 — Phase 3a：模块化脚手架（未切入口）

把 `App.jsx` 承担的职责按「Shell + 平级模块」的最终结构拆成 4 个 Module，所有文件齐备但 `AppShell.jsx` 还没切换到 Router。Phase 3b 再一次性完成入口切换 + 旧 `App.jsx` / `useAppRouter.js` 删除 + 遗留路径 301 重定向。

### 新功能
- **`src/modules/werewolf/WerewolfModule.jsx`**：狼人杀模块根组件，接管 App.jsx 的全部游戏状态 / 副作用 / hooks / handler。3 条路由（`/werewolf`、`/werewolf/setup`、`/werewolf/play`）都指向同一组件，React 跨路径切换不 unmount，游戏状态自然保留。离开 `/werewolf/*` 进入其它模块时通过 `useEffect(() => () => endGame())` 卸载清理。
- **`src/modules/home/HomeRoute.jsx`**：Phase 3 过渡包装，暂时复用现有 `Dashboard`；Phase 4 换成 Registry 驱动的卡片墙。
- **`src/modules/sites/SitesRoute.jsx`**：Phase 3 过渡包装，复用现有 `SitesPage`；Phase 4 拆成 chords/stock/blog 三条独立模块后整个目录删除。
- **`src/modules/auth/AuthRoute.jsx`**：`/login`、`/reset-password`、`/verify-email` 统一挂进 Registry，方便 Router 走一套匹配流程；`home.visible=false` 不上卡片墙。
- **`ModuleRegistry` 首次填充**：`[home, auth, werewolf, sites]`，Phase 4 新增 chords/stock/blog 后替换 sites。

### 文件变更
| 文件 | 操作 | 说明 |
|------|------|------|
| `src/modules/werewolf/WerewolfModule.jsx` | 新建 | 狼人杀模块根（~430 行，由 App.jsx 游戏状态全量迁入） |
| `src/modules/werewolf/index.js` | 新建 | ModuleDescriptor（3 路由 / theme: 'dark' / order: 10） |
| `src/modules/home/HomeRoute.jsx` | 新建 | Dashboard 的桥接层，handlers 走 useShell + useAuthNav |
| `src/modules/home/index.js` | 新建 | Home ModuleDescriptor（路由 `/` / theme: 'light'） |
| `src/modules/sites/SitesRoute.jsx` | 新建 | SitesPage 过渡包装，locale/onBack 走 useShell |
| `src/modules/sites/index.js` | 新建 | Sites ModuleDescriptor（Phase 4 删除） |
| `src/modules/auth/AuthRoute.jsx` | 新建 | AuthPage 包装 |
| `src/modules/auth/index.js` | 新建 | Auth ModuleDescriptor（3 认证路径） |
| `src/shell/ModuleRegistry.js` | 修改 | 导入并注册 4 个模块 |
| `src/shell/paths.js` | 修改 | 新增 `ROUTES.SITES`（Phase 3 过渡用），并把 `/sites` 从 LEGACY 表移除 |

### 技术细节
- **为什么 3 条路由指同一组件**：React reconciler 用元素类型（`Component` 引用）判断是否保留实例。同一 `WerewolfModule` 引用在 setup→play 切换时 React 不会 unmount，`useState` 的 `players/phase/...` 自动延续——这正是我们要的行为，省掉一层 store。
- **为什么卸载清理比 `descriptor.onLeave` 更好**：`onLeave` 需要把实例的 `endGame` 反向写回 descriptor（可变 handle，易 stale）。`useEffect(() => () => endGame())` 是纯 React 模型，生命周期与组件同步，离开 werewolf 进入 home 时 Router 换组件 → WerewolfModule unmount → cleanup 跑一次 endGame。
- **Tree-shake 证据**：注册了 10+ 个新文件但 gzipped main 72.57 → 72.57 kB（无变化）。因为 AppShell 仍渲染 `<App />`，`ModuleRegistry` 没有消费者，Rollup 整棵新树全部 DCE 掉。Phase 3b 切 AppShell 的那一瞬间才会把这些 chunk 真正加载出来。
- **Shell 状态升为真相源**：WerewolfModule 不再自己维护 `isGuestMode`/`showTokenManager`/`showStats`/`locale`，全部走 `useShell()`。ShellProvider 里那些「影子状态」在 3b 会正式生效。

## [2026-04-14] 个人主页平台重构 — Phase 2b：挂载 ShellProvider（缩小版）

将 Phase 2b 缩小为「仅挂载 ShellProvider 到 App 外层」，**不**替换 `App.jsx`、**不**删除 `useAppRouter.js`、**不**注入 301 重定向。完整的入口切换与狼人杀模块化合并到 Phase 3，保证 URL 切换与 `modules/werewolf/` 上线同一提交落地（两者物理耦合，不可分批）。

### 新功能
- **`src/AppShell.jsx`**：新的应用根，`<ShellProvider><App /></ShellProvider>`。Shell 的 `locale`/`user`/`navigate`/`api` 能力此刻对任何 `useShell()` 消费者可用。
- **`src/main.jsx`**：入口从 `<App />` 切到 `<AppShell />`，唯一一行变化。

### 文件变更
| 文件 | 操作 | 说明 |
|------|------|------|
| `src/AppShell.jsx` | 新建 | ShellProvider + 旧 App 的薄包裹，Phase 3 会改渲染 Router |
| `src/main.jsx` | 修改 | import App → AppShell（一行） |

### 技术细节
- **运行时零行为变化**：`App.jsx` 仍调用 `useAppRouter()` 做路由；ShellProvider 的 `currentPath`/`isGuestMode`/`showTokenManager` 是此刻没有消费者的「影子状态」，不影响老逻辑。Phase 3 删掉 App.jsx 时这些状态才升为单一真相。
- **popstate 双监听无冲突**：ShellProvider 和 useAppRouter 各自独立监听 `popstate` + 各自更新 state；`popstate` 是广播事件，多监听器互不干扰；两者的 `navigate()` 仍然只有 useAppRouter 的版本被调用，所以 Shell 的 currentPath 暂时滞后是预期行为。
- **Bundle 变化**：gzipped main bundle 71.37 → 72.57 kB（+1.2 kB），即 ShellProvider + `utils/authToken.js` + `services/api/client.js` + paths 的进入成本，符合「Phase 1/2 增量 ≤ 2 KB」预算。
- **为什么不现在切 Router 和加 301**：`App.jsx::useAppRouter` 仍以 `/wolfgame` 为规范路径。若提前加 `LEGACY_PATH_MAP` 把 `/wolfgame` 改写成 `/werewolf`，useAppRouter 的 `APP_ROUTES` 集合不认识新路径会把用户踢回 `/home`。路径切换必须与 Registry 里真正注册 `/werewolf` 路由同时发生——Phase 3 一起提交。

## [2026-04-13] 个人主页平台重构 — Phase 2a：Shell + API 并行基础设施（未接线）

Phase 2 拆为 2a（纯新增、零风险）与 2b（入口切换）两步。本提交只新增 Shell 与多后端 API 客户端的骨架，**`main.jsx` 仍走老 `App.jsx`**，bundle 体积与运行时行为完全不变。

### 新功能
- **Shell 层骨架 `src/shell/`**：`ShellContext` / `ShellProvider` / `Router` / `GlobalOverlays` / `ThemeScope` / `navGuards` / `ModuleRegistry` / `paths` / `useDocumentMeta` / `useAuthNav`，集中汇拢 locale、auth、路由、modal 等跨模块能力；`useShell()` 是模块唯一入口。
- **Registry 驱动路由**：`Router.jsx` 从 `ModuleRegistry` 摊平 `routes`，匹配 → `navGuards` 决策 → `onLeave(ctx)` 清理 → `<ThemeScope theme={module.theme}><Suspense>` 包裹。
- **扁平化路径表 `shell/paths.js`**：`ROUTES.HOME/WEREWOLF/CHORDS/STOCK/BLOG`，附 `LEGACY_PATH_MAP`（`/wolfgame → /werewolf` 等）用于 Phase 2b 做 301 式重定向。
- **多后端 API 抽象 `src/services/api/`**：`registry.js` 注册 `cf-workers` + `aliyun-ecs`（ECS 暂留空 URL），`client.js` 导出 `createApiClient(key, { getAuthToken })` 返回已注入 JWT 的 `{ get, post, put, delete }`。模块只声明 `backend` 字段，上线切换只改 `.env`。

### 文件变更
| 文件 | 操作 | 说明 |
|------|------|------|
| `src/shell/paths.js` | 新建 | ROUTES 常量 + 旧路径归一化 |
| `src/shell/ShellContext.js` | 新建 | `createContext(null)` + `useShell()` 守卫钩子 |
| `src/shell/ShellProvider.jsx` | 新建 | 汇总 locale / auth / 路由 / overlay / api 能力 |
| `src/shell/Router.jsx` | 新建 | Registry 驱动的路由器 + `onLeave` 清理 + ThemeScope 包裹 |
| `src/shell/ThemeScope.jsx` | 新建 | `[data-theme]` 包装器（forwardRef） |
| `src/shell/ModuleRegistry.js` | 新建 | ModuleDescriptor 契约 + `findRoute` / `homeCards` / `listModules`（数组暂空） |
| `src/shell/navGuards.js` | 新建 | 纯函数 `resolveNavigation({ route, isAuthed, normalizedPath })` |
| `src/shell/useDocumentMeta.js` | 新建 | 标题 + SEO meta 副作用（从 App.jsx 抽出） |
| `src/shell/useAuthNav.js` | 新建 | `enterGuestMode` / `handleLoginSuccess` / `handleLogout` 等导航动作 |
| `src/shell/GlobalOverlays.jsx` | 新建 | `LanguageToggle` + `TokenManager` + `UserStats` 浮层（lazy） |
| `src/services/api/registry.js` | 新建 | `cf-workers` / `aliyun-ecs` 后端注册表 |
| `src/services/api/client.js` | 新建 | `createApiClient` — 注入 base URL + Authorization |

### 技术细节
- **tree-shaking 验证**：新增 ~12 个文件后 `index-*.js` / CSS gzipped 体积与 Phase 1 完全一致（69.48 kB CSS, 71.37 kB main JS），证明新文件未被 `main.jsx` 引用，Rollup 成功剔除——Phase 2a "additive only" 的构建级证据。
- **单向依赖**：模块 → `shell/*` → `contexts/Auth` / `services/api`；Registry 不反向 import Router。Phase 3 起用 ESLint `no-restricted-imports` 固化边界。
- **Auth token 接入**：`ShellProvider.api()` 直接调用 `utils/authToken.js::getToken`，与 `authService` 的 JWT 存储约定保持一致。
- **下一步（Phase 2b）**：单独提交，切换 `main.jsx` 入口到 `AppShell`，`App.jsx` / `useAppRouter.js` 整体替换，狼人杀状态暂留 `AppShell` 内部占位 module，待 Phase 3 再搬进 `modules/werewolf/`。

## [2026-04-13] 个人主页平台重构 — Phase 1：设计令牌 + UI 原语层

项目从「狼人杀单一应用」演进为「个人主页多模块平台」（狼人杀 / 音乐编排 / 股市 / 博客 平级），第一阶段建立设计系统底座。

### 新功能
- **设计令牌系统**：`src/styles/tokens.css` 通过 `[data-theme="light|dark"]` 提供双主题 CSS 变量（`--bg`、`--ink`、`--accent`、`--border`、`--shadow-*`、`--radius-*`），为后续 Hub 浅色 + 游戏深色双主题打下基础。
- **Tailwind 令牌映射**：`tailwind.config.js` 扩展 `colors` / `borderColor` / `borderRadius` / `boxShadow` / `ringColor`，UI 原语可用 `bg-bg-raised text-ink border-line` 等令牌类，跨主题自动适配。
- **UI 原语层 `src/ui/`**：`Button`、`Card`、`Input`/`Textarea`/`Select`、`Modal`、`Badge`、`PageShell`、`Toolbar`、`Spinner`、`Skeleton` 共 9 个跨主题基础组件，全部 `forwardRef` + 接受 `className` 覆盖。
- **样式文件分层**：`src/index.css` 从 475 行单文件拆为 4 个模块化文件 + 1 个导入清单。

### 文件变更
| 文件 | 操作 | 说明 |
|------|------|------|
| `src/styles/tokens.css` | 新建 | 双主题设计令牌定义 |
| `src/styles/base.css` | 新建 | `@tailwind` 指令 + 全局基线（body / 字体 / 通用工具） |
| `src/styles/legacy-mac.css` | 新建 | 旧 `.mac-*` 组件类与 `--mac-*` 变量物理迁移（待 Phase 5 codemod 退役） |
| `src/styles/game-animations.css` | 新建 | 狼人杀气泡/弹跳/星光/发光等动画 |
| `src/index.css` | 重写 | 从 475 行实现降为 18 行的导入清单 |
| `tailwind.config.js` | 修改 | 扩展令牌映射（colors / borderColor / radius / shadow / ring） |
| `src/ui/Button.jsx` | 新建 | primary/secondary/ghost/danger × sm/md/lg，loading 态 |
| `src/ui/Card.jsx` | 新建 | padding 档位 + interactive hover，支持 `as` 多态 |
| `src/ui/Input.jsx` | 新建 | Input + Textarea + Select，统一 focus ring + error 态 |
| `src/ui/Modal.jsx` | 新建 | createPortal + Escape + body scroll lock + backdrop 关闭 |
| `src/ui/Badge.jsx` | 新建 | tone: neutral/accent/danger/success/warning |
| `src/ui/PageShell.jsx` | 新建 | 模块根容器（`min-h-screen bg-bg text-ink`） |
| `src/ui/Toolbar.jsx` | 新建 | 替代 `.mac-floating-toolbar` |
| `src/ui/Spinner.jsx` | 新建 | sm/md/lg 三档加载态 |
| `src/ui/Skeleton.jsx` | 新建 | 占位骨架 |
| `src/ui/index.js` | 新建 | 桶式导出 |

### 技术细节
- **零行为变化**：所有现有 `.mac-*` 类与 `--mac-*` 变量保持原效，老组件无需改动；新令牌仅"添加在旁边"。
- **CSS 注释陷阱**：legacy-mac.css 首版 docstring 内含 `*/` 序列（`--mac-*/--homepage-*`）触发 PostCSS 解析错误，已修正——CSS 块注释不能嵌套，描述变量名时需避免 `*/` 字面量。
- **Bundle 影响**：CSS 66.64 → 69.48 kB（gzipped 12.58 → 13.02 kB，+0.44 kB），JS 不变（UI 原语未被引用，Vite 完成 tree-shake）。
- **主题作用域机制**：Phase 2 引入 `shell/ThemeScope.jsx` 后，路由切换会在模块根设置 `data-theme`，CSS 变量自动重解析。

### 后续阶段（已规划）
- Phase 2 — Shell 抽离 + Router Registry 化 + 多后端 API 客户端（CF Workers + Aliyun ECS 预留）
- Phase 3 — 狼人杀模块化（`modules/werewolf/`）
- Phase 4 — Chords/Stock/Blog 平级化 + Home 卡片墙重构（删除 `SitesPage` 二级导航）
- Phase 5 — `.mac-*` codemod 退役 + 模块脚手架文档

## [2026-04-11] 自我进化循环：闭环验证 + Windows 路径修复

### Bug 修复
- **NTFS 文件名非法字符**：`headlessGame.mjs` 和 `reviewPipeline.mjs` 的本地队列 key 格式为 `local:${ts}:${gameId}`，冒号是 NTFS 保留字符（alt stream 分隔符），在 Windows 上 `writeFileSync` 直接 ENOENT（错误信息完全看不出是路径问题）。修复：本地模式改用下划线 `local_${ts}_${gameId}`。KV 模式仍用 `review:...`（Cloudflare KV 接受冒号）。
- **LLM target 解析过严**：`DAY_VOTE` / `NIGHT_WOLF_KILL` / `NIGHT_SEER_CHECK` / `NIGHT_WITCH` 的 target 字段原本只认 `Number(act.target)`，若 LLM 返回 `"Alice"`（名字）或 `"[1]Alice"`（带括号前缀）则 `NaN` 静默失效 → 全局 null 投票/无效夜间行动。新增 `resolveTarget()` 工具函数支持 5 种解析策略：数字、数字字符串、`[id]` 括号、`数字号`、玩家名精确/子串匹配。
- **`--verbose` 投票诊断**：每轮投票后打印 tally 字符串和 null 票数，让"8 轮无人出局"这类系统性故障可以从日志直接看出来。

### 闭环验证
- headless driver 成功产出一局有信息量的游戏：Day 1 狼胜（真预言家 Ivy 被误投出局，女巫首夜误毒被狼刀目标 Carol）
- reviewPipeline.mjs --local 完整跑通 BugHunter → PromptEngineer → TestWriter 三步：
  - BugHunter 识别 5 条 issue（1 critical 女巫首夜乱毒 / 2 high 预言家空跳 + 村民误杀预言家 / 1 medium 狼人反驳空洞 / 1 low 村民过于消极）
  - PromptEngineer 产出 3 条高置信度（0.90~0.95）prompt 改写建议，分别针对女巫、预言家、村民
  - TestWriter 生成 3 条测试用例 + markdown 案例研究
- `src/knowledge/case_library/` 从 2 条种子案例增长到 3 条，其中新增的 `auto-1775908658493-h8qdd7` 是第一条由完整自动化流水线产出的案例。

### 已知非阻断问题
- BugHunter / PromptEngineer 输出的 `timestamp` 字段是模型幻觉（返回 `2023-12-01` / `2024-06-09`），应由 agent 代码覆盖而不是信任 LLM 输出。下一轮修复。
- ModelScope 模型额度是**按模型**而非按 API key 的 —— 切换到 `AGENT_MODEL="Qwen/Qwen3-Next-80B-A3B-Instruct"` 绕过了 DeepSeek-V3.2 的每日限额。验证过的备选模型已记入项目记忆。

### 文件变更
| 文件 | 操作 | 说明 |
|------|------|------|
| `src/agents/headlessGame.mjs` | 修改 | colon→underscore / resolveTarget / verbose tally |
| `src/agents/reviewPipeline.mjs` | 修改 | colon→underscore (queueGameLocally) |
| `src/knowledge/case_library/bug_report_auto-*.json` | 新建 | BugHunter 产出 |
| `src/knowledge/case_library/improved_prompts_auto-*.json` | 新建 | PromptEngineer 产出 |
| `src/knowledge/case_library/test_cases_auto-*.json` | 新建 | TestWriter 产出 |
| `src/knowledge/case_library/2026-04-auto-*.md` | 新建 | 案例研究 markdown |

## [2026-04-11] 自我进化循环：headless driver + codex 指令

### 新功能
- **Headless 游戏驱动器**：Node 侧无头 6 人迷你局驱动器，打通 review pipeline 的数据源
  - 6 人配置：2 狼人 1 预言家 1 女巫 2 村民
  - 夜间流程：狼刀 → 预言家查 → 女巫救/毒 → 死亡结算
  - 白天流程：全员发言（≤80 字）→ 全员投票 → 最高票出局
  - 胜负判定：屠边模式（神职或村民全灭 / 狼数≥好人数）
  - 输出 game log 直接落 `src/knowledge/pending/`，无缝喂给 `reviewPipeline.mjs --local`
  - CLI 参数：`--games=N --max-days=N --no-queue --verbose`
- **`/evolve-codex` 斜杠命令**：把自我进化循环托付给 codex CLI 的 subagent 机制
  - 定义 scout/analyst/surgeon 三种子代理角色分工
  - 5 步循环：盘点 → 选建议 → 落地 → 闭环验证 → 记录
  - 收敛条件 & 停机条件与 Phase 1 设计对齐
  - 禁止 `git push` / 修改 workers_auth / 伪造 game log

### Bug 修复
- **`llm.mjs` Provider 映射修复**：shared LLM 封装长期与 `aiConfig.js` 默认值不一致
  - `getApiConfig` 之前只识别 `VITE_SILICONFLOW_*` 环境变量，项目实际 `.env` 用的是 ModelScope 的 `VITE_API_URL`/`VITE_API_KEY` → 返回 401
  - 默认模型 `Qwen/Qwen3-8B` 在 ModelScope 未托管 → API 返回 `choices: null` 空响应
  - `callLLM` 不透传未知 options → `response_format: {type:'json_object'}` 永远达不到上游
  - 修复后：ModelScope 优先、默认模型改为已验证的 `deepseek-ai/DeepSeek-V3.2`、options 透传

### 文件变更
| 文件 | 操作 | 说明 |
|------|------|------|
| `src/agents/headlessGame.mjs` | 新建 | Node 侧 6 人无头对局驱动器（~380 行） |
| `.claude/commands/evolve-codex.md` | 新建 | `/evolve-codex` 斜杠命令，codex 自我进化循环指令 |
| `src/agents/shared/llm.mjs` | 修改 | getApiConfig + callLLM 三处缺陷修复 |

### 技术细节
- **Phase 1 技术债**：headless driver 当前使用内联 BOOTSTRAP prompts 而不是 `src/services/promptFactory.js`。原因是 `promptFactory` 的 `from './rolePrompts'` 无后缀目录导入 Node ESM 不认，而 Vite 认。Phase 2 待用户批准后一次性给 `src/services/rolePrompts/**` 所有相对导入加 `.js` 后缀，即可把 driver 切换到生产提示词，真正闭合循环。
- **JSON 解析鲁棒性**：`parseJson` 用平衡计数扫描所有顶层 `{...}` 块，从末尾反向逐个 try —— 对 thinking 模型输出里 "reasoning preface + final JSON" 的 pattern 天然鲁棒，即使 `response_format` 不被某些模型尊重也能兜底。
- **验证结果**：`node src/agents/headlessGame.mjs --no-queue --verbose --max-days=2` 跑出一局完整狼人杀，狼胜（D1），产出 5 条发言 + 1 轮投票 + 2 条死亡记录 + 3 条夜间行动记录，所有 LLM 调用都返回干净 JSON，parseJson fallback 未触发。

## [2026-02-18] 实时行情系统（简单版）

### 新功能
- **实时行情页面**：在"站点入口"中新增"实时行情"入口卡片
  - WebSocket 连接 infoway.io，支持股票/加密货币/外汇期货三类市场
  - 自定义自选列表，按 market 分类存储在 sessionStorage
  - 实时价格显示 + SVG Sparkline 折线图（纯前端，无第三方图表库）
  - 连接状态指示器（实时/连接中/已断开/错误）
  - 内置调试面板，可查看 WebSocket 原始消息（首次联调使用）
  - 自动重连（4s 延迟）+ 心跳保活（25s ping）

### 文件变更
| 文件 | 操作 | 说明 |
|------|------|------|
| `src/config/stockConfig.js` | 新建 | API Key、WebSocket 端点、默认自选列表 |
| `src/components/Stock/useStockWS.js` | 新建 | WebSocket Hook，灵活解析多种响应格式 |
| `src/components/Stock/StockPage.jsx` | 新建 | 行情主页面（搜索、卡片网格、调试面板） |
| `src/components/SitesPage.jsx` | 修改 | 添加"实时行情"入口卡片，内嵌子视图切换 |

### 技术细节
- 单 WebSocket 连接多路复用，避免频繁建立连接
- `parseTickerItem()` 同时兼容 3 种常见字段格式，首次运行后可根据控制台日志微调
- `SitesPage` 用内部 `view` state 切换子视图，不修改主路由体系

## [2026-02-15] 魔术师角色完整实现

### 新功能
- **魔术师角色（神职）**
  - 每晚可交换两名玩家，重定向所有夜间技能（狼刀、验人、毒药、守护）
  - 整局限制：每个号码只能被交换一次
  - 连续限制：不能连续两晚交换同一个人
  - 支持自换（交换自己和他人）实现躲刀
- **目标重定向机制**
  - 狼刀 A → 魔术师交换后 B 死亡
  - 预言家验 A → 实际验 B 的身份（制造逻辑混乱）
  - 女巫毒 A → 实际 B 死亡
  - 守卫守 A → 实际守护 B
- **AI 博弈思维系统**
  - 5步推演：局势分析 → 狼人视角 → 后果模拟 → 逻辑闭环 → 最终决策
  - 优先级系统：保核（保护预言家）→ 换刀（狼刀狼）→ 自保（躲刀）
  - 逻辑镜像表：只有魔术师知道真相，其他角色看到的是交换前目标
- **用户魔术师 UI**
  - 分步选择界面（第一个目标 → 第二个目标 → 确认交换）
  - 实时显示交换限制（已交换玩家、上次交换警告）
  - 清除选择和"不交换"选项
  - 实时验证交换合法性
- **渐进式披露提示词**
  - 根据场上存在角色动态调整策略提示
  - 无女巫时不提及毒药重定向，无预言家时不提及保护预言家

### 技术细节
- **夜间顺序调整**：守卫(1) → 魔术师(2) → 狼人(3) → 预言家(4) → 女巫(5)
- **状态管理**：
  - `nightDecisions.magicianSwap` 存储当晚交换决策
  - `magicianHistory.swappedPlayers` 跟踪整局已交换玩家
  - `magicianHistory.lastSwap` 记录上次交换用于连续限制验证
- **核心算法**：
  - `applyMagicianSwap()` 应用目标重定向（A↔B）
  - `validateMagicianSwap()` 验证交换合法性（整局限制+连续限制）
  - `updateMagicianHistory()` 更新历史记录
  - `getValidSwapTargets()` 获取可交换目标列表

### 文件变更
| 文件 | 操作 | 说明 |
|------|------|------|
| `src/config/roles.js` | 修改 | 添加 MAGICIAN 定义，nightOrder=2，短名"术" |
| `src/useWerewolfGame.js` | 修改 | 添加 magicianSwap 和 magicianHistory 状态 |
| `src/utils/magicianUtils.js` | 新建 | 核心工具函数：重定向、验证、历史更新 |
| `src/services/rolePrompts/magician.js` | 新建 | 完整的 AI 提示词系统（博弈思维+逻辑镜像表） |
| `src/services/rolePrompts/index.js` | 修改 | 导出 MAGICIAN_PROMPTS 并添加到映射表 |
| `src/services/aiPrompts.js` | 修改 | 添加 NIGHT_MAGICIAN action 和处理逻辑 |
| `src/hooks/useNightFlow.js` | 修改 | 魔术师夜间行动 + resolveNight 全技能重定向 |
| `src/components/RoleSelector.jsx` | 修改 | 添加魔术师图标 🎩 |
| `src/components/CirclePlayerLayout.jsx` | 修改 | 完整的用户魔术师 UI（双选择+验证） |
| `src/components/ActionPanel.jsx` | 修改 | 导入魔术师工具函数（备用） |
| `src/components/GameArena.jsx` | 修改 | 传递 magicianHistory 到子组件 |
| `src/App.jsx` | 修改 | magicianHistory 集成到 useNightFlow 和 GameArena |

### 游戏流程示例
```
第1夜：
- 魔术师交换 1号 和 3号
- 狼人选择刀 1号 → 实际 3号 死亡
- 预言家验 3号 → 实际验 1号（狼），但记录为"3号是狼"

第2天：
- 预言家跳身份："我验了 3号，是狼！"
- 但 3号 已死，实际 1号 是狼
- 场上逻辑崩盘
- 魔术师可选择跳身份修正逻辑
```

### 已知特性
- ✅ AI 完整逻辑（含博弈思维链）
- ✅ 用户 UI 支持（双选择界面）
- ✅ 全技能重定向（狼刀/验人/毒药/守护）
- ✅ 预言家查验制造逻辑混乱
- ✅ 交换限制严格验证
- ✅ 渐进式披露提示词

## [2026-02-07] SPA 路由回退 + Changelog 编码修复

### 修复
- **/login 等前端路由返回 Not found**
  - Worker 非 `/api/*` 请求现在走静态资源并回退到 `/index.html`
- **Changelog 中文乱码**
  - 统一为 UTF-8 编码，中文正常显示
- **AI 模型排行榜筛选过长**
  - 移除“全部角色”选项
- **部署失败：_redirects 无限循环**
  - 移除 `public/_redirects`，改由 Worker 负责 SPA 回退
- **头像被数据库覆盖**
  - 已有开局头像时不再从数据库覆盖

### 文件变更
| 文件 | 操作 | 说明 |
|------|------|------|
| `workers/auth/index.js` | 修改 | 非 API 路由静态资源与 SPA 回退 |
| `CHANGELOG.md` | 修改 | UTF-8 编码修复 |
| `src/components/ModelLeaderboard.jsx` | 修改 | 移除“全部角色”筛选 |
| `public/_redirects` | 删除 | 避免 Cloudflare _redirects 规则循环 |
| `src/services/avatarService.js` | 修改 | 保留开局头像，不再覆盖 |

## [2026-02-06] 页面路由管理 + 退出即停机制

### 新功能
- **前端路由映射**
  - 登录页 `/login`、主页 `/home`、自定义局 `/wolfgame/custom`、对局 `/wolfgame/play`、博客 `/sites` 统一由 SPA 管理
  - 仪表盘“我的博客”入口切换为 `/sites` 内嵌展示
- **返回按钮覆盖**
  - 自定义局、对局、博客页新增“返回首页/返回登录”按钮
- **退出即停**
  - 离开对局页立即终止游戏并取消 API 请求

### 行为优化
- **AI 调用防护**
  - 增加 `gameActiveRef` 守卫，阻断退出后继续触发日/夜流程

### 文件变更
| 文件 | 操作 | 说明 |
|------|------|------|
| `src/App.jsx` | 修改 | 增加路由状态、退出逻辑与返回按钮传递 |
| `src/components/Dashboard.jsx` | 修改 | 博客入口改为 `/sites` |
| `src/components/SetupScreen.jsx` | 修改 | 自定义界面新增返回按钮 |
| `src/components/GameArena.jsx` | 修改 | 对局界面新增返回按钮 |
| `src/components/SitesPage.jsx` | 新增 | 博客嵌入页 |
| `src/hooks/useAI.js` | 修改 | 新增 `gameActiveRef` 防止退出后调用 |
| `src/hooks/useDayFlow.js` | 修改 | 流程退出守卫 |

## [2026-02-06] 路由改造 + 域名统一 + 令牌安全策略

### 新功能

- **路由结构明确化**
  - `/login` → 登录后 `/home`
  - `/home` 入口：`/sites`、`/wolfgame/custom`
  - `/wolfgame/custom` 配置后进入 `/wolfgame/play`
  - `/wolfgame/play` “结束并返回主页”终止游戏
  - `/sites` 站点聚合页可返回 `/home`
- **新增 Sites 聚合页**
  - 独立页面承载外部站点入口，风格与主页一致
- **SPA 路由回退支持**
  - 新增 `_redirects` 支持直接访问深层路径

### 安全与一致性

- **登录 Token 永不过期**
- **ModelScope 令牌失效自动清空**
- **统一 API 域名与数据库入口**
  - 明确 `https://zhaxiaoji.com` 为唯一线上域名
  - 移除 `workers/auth/wrangler.toml`，避免误部署到旧 Worker
  - 头像服务改为跟随 `VITE_AUTH_API_URL`，不再指向 `*.workers.dev`

### 文件变更
| 文件 | 操作 | 说明 |
|------|------|------|
| `src/App.jsx` | 修改 | 路由与退出游戏流程 |
| `src/components/Dashboard.jsx` | 修改 | 首页入口拆分 |
| `src/components/SitesPage.jsx` | 新增 | 站点聚合页 |
| `public/_redirects` | 新增 | SPA 路由回退 |
| `workers/auth/jwt.js` | 修改 | JWT 永不过期 |
| `workers/auth/handlers.js` | 修改 | 令牌失效自动清空 |
| `src/contexts/AuthContext.jsx` | 修改 | 前端同步清空令牌 |
| `src/services/avatarService.js` | 修改 | 统一 API Base |
| `workers/auth/wrangler.toml` | 删除 | 避免误部署旧 Worker |
| `.claude/commands/deploy.md` | 修改 | 域名与 API 约定 |
| `.codex/rules/default.rules` | 修改 | 域名约束 |
| `AGENTS.md` | 修改 | 域名约定 |
| CLAUDE.md | 修改 | 域名约定 |


## [2026-02-06] 自定义模式独占 + 天亮结算阶段 + AI 逻辑约束 + Codex 项目配置

### 新功能

- **自定义局成为唯一模式**
  - 移除 6/8 人预设局，仅保留自定义配置（角色数/夜晚顺序自动生成）
  - 设置界面增加“免费算力平台”提示（慢/掉线/需耐心等待）

- **新增 `day_resolution` 结算阶段**
  - 夜晚结束后先进入结算阶段，支持猎人连锁开枪完整结算后再开始白天讨论

- **AI 模型与推理表增强**
  - 角色卡显示每名 AI 实际使用的模型（自动 fallback 后也会更新）
  - `identity_table` 增加 role pool 硬约束 + 本地清洗，避免推理出本局不存在的身份
  - 新增 GLM-4.7 / GLM-4.7-Flash 作为可选模型

### Bug 修复

- **猎人行动记录缺失/错归夜晚**
  - 猎人开枪记录持久化为白天行动，导出与历史表可正确显示

- **历史表渲染崩溃**
  - 修复 thought/identity_table 为对象导致的 React 渲染错误（统一 stringify）

### 工具与文档

- **新增 Codex 项目配套文件**
  - 增加 `AGENTS.md`、`.codex/` 规则/配置与 `.agents/skills/*`（对齐 `.claude/commands/*` 工作流）

### 文件变更
| 文件 | 操作 | 说明 |
|------|------|------|
| `src/config/roles.js` | 修改 | 移除 6/8 人预设，仅保留自定义 setup |
| `src/components/SetupScreen.jsx` | 修改 | 自定义-only UI + 免费算力平台提示 |
| `src/components/CirclePlayerLayout.jsx` | 修改 | Game Over 显示胜负；角色卡显示实际模型 |
| `src/App.jsx` | 修改 | 固定使用自定义 setup；移除预设切换状态 |
| `src/hooks/useDayFlow.js` | 修改 | 猎人连锁开枪结算；行动记录持久化 |
| `src/hooks/useAI.js` | 修改 | `identity_table` 清洗 + 模型追踪回调 |
| `src/services/identityTableSanitizer.js` | 新建 | 基于角色池的 `identity_table` 纠偏 |
| `src/services/aiPrompts.js` | 修改 | role pool 约束提示 |
| `src/config/aiConfig.js` | 修改 | 增加 GLM-4.7/Flash 模型 |
| `src/components/GameHistoryTable.jsx` | 修改 | thought/object 安全渲染 |
| `AGENTS.md` | 新建 | Codex 项目指南 |
| `.codex/` | 新建 | Codex 项目配置与 rules |
| `.agents/skills/*` | 新建 | Codex skills（对齐 Claude commands） |
| `.gitignore` | 修改 | 忽略 Codex 运行态文件 |

---

## [2026-02-06] 游戏规则强制执行 + 页面关闭处理 + 数据库头像系统

### 新功能

- **页面关闭时终止对战**
  - 添加全局 AbortController 管理 API 请求
  - 页面关闭/隐藏时自动取消所有进行中的 API 调用
  - 页面恢复可见时重置 AbortController

- **狼人禁止空刀**
  - AI 提示词明确强制 "狼人每晚必须袭击一名玩家"
  - 后端逻辑：AI 返回无效时随机选择目标
  - 移除 UI 中的 "空刀" 按钮

- **猎人必须开枪**
  - AI 提示词明确 "猎人死亡时必须开枪"（毒死除外）
  - 后端逻辑：AI 返回无效时随机选择目标
  - UI 禁用未选择目标时的开枪按钮

- **数据库头像系统**
  - 新建 `avatars` 表存储预生成头像
  - 添加 `/api/avatars` 和 `/api/avatars/batch` API
  - 前端 `avatarService.js` 从数据库获取头像
  - 创建 `scripts/generateAvatars.js` 生成脚本

- **AI 模型排行榜数据库**
  - 新建 `game_model_usage` 表记录每局模型使用
  - 新建 `ai_model_stats` 表聚合模型胜率统计

### 文件变更
| 文件 | 操作 | 说明 |
|------|------|------|
| `src/services/aiClient.js` | 修改 | 添加 AbortController 管理 |
| `src/App.jsx` | 修改 | 添加页面关闭/可见性处理 |
| `src/services/rolePrompts/werewolf.js` | 修改 | 添加禁止空刀规则 |
| `src/services/rolePrompts/hunter.js` | 修改 | 添加必须开枪规则 |
| `src/services/aiPrompts.js` | 修改 | 同步更新猎人提示词 |
| `src/hooks/useDayFlow.js` | 修改 | 强制狼人/猎人有效选择 |
| `src/hooks/useNightFlow.js` | 修改 | 强制狼人有效选择 |
| `src/components/ActionPanel.jsx` | 修改 | 移除空刀按钮，禁用无目标开枪 |
| `src/components/CirclePlayerLayout.jsx` | 修改 | 移除空刀按钮 |
| `src/services/rolePrompts/witch.js` | 修改 | 移除 "狼人空刀" 描述 |
| `src/services/avatarService.js` | 新建 | 头像服务（从数据库获取） |
| `src/useWerewolfGame.js` | 修改 | 使用 assignPlayerAvatars |
| `workers/auth/handlers.js` | 修改 | 添加头像 API 处理函数 |
| `workers/auth/index.js` | 修改 | 添加头像 API 路由 |
| `schema.sql` | 修改 | 添加 avatars、game_model_usage、ai_model_stats 表 |
| `scripts/generateAvatars.js` | 新建 | 头像生成脚本 |

### 数据库迁移
```sql
-- 预生成头像表
CREATE TABLE IF NOT EXISTS avatars (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  personality TEXT,
  image_url TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(name, role, personality)
);

-- AI 模型游戏使用记录表
CREATE TABLE IF NOT EXISTS game_model_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_session_id TEXT NOT NULL,
  player_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  model_id TEXT NOT NULL,
  model_name TEXT NOT NULL,
  result TEXT CHECK(result IN ('win', 'lose')) NOT NULL,
  game_mode TEXT NOT NULL,
  duration_seconds INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI 模型统计聚合表
CREATE TABLE IF NOT EXISTS ai_model_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  model_id TEXT NOT NULL,
  model_name TEXT NOT NULL,
  role TEXT NOT NULL,
  total_games INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  win_rate REAL DEFAULT 0.0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(model_id, role)
);
```

---

## [2026-02-06] 猎人延迟开枪 + 行动板持久化 + 提示词渐进式披露

### 新功能

- **猎人延迟开枪机制**
  - 狼人袭击猎人后，如果好人占多数，猎人延迟到白天开枪
  - 支持连锁开枪：被带走的玩家如果也是猎人，可继续开枪（最大3层）
  - 新增 `isGoodMajority()` 函数判断阵营优势
  - 新增 `pendingHunterShoot` 状态管理延迟开枪

- **全AI模式行动板持久化**
  - 行动面板现在显示整局游戏的所有记录（不再每天刷新）
  - 投票结果作为系统公告显示在行动列表中
  - 按日/夜分组显示（N1 → D1 → N2 → D2...）
  - 每组有 sticky 标题带图标（🌙第1夜 / ☀️第1天）

- **提示词渐进式披露架构**
  - 每个角色有独立的提示词模块（`src/services/rolePrompts/`）
  - 根据游戏配置动态调整提示内容（没有的角色不会被提及）
  - 守卫首夜策略根据有无女巫调整（同守同救提醒）
  - 狼人刀法优先级根据存在的角色动态生成

### 文件变更
| 文件 | 操作 | 说明 |
|------|------|------|
| `src/services/rolePrompts/index.js` | 新建 | 角色模块导出聚合器 |
| `src/services/rolePrompts/baseRules.js` | 新建 | 通用规则和辅助函数 |
| `src/services/rolePrompts/werewolf.js` | 新建 | 狼人提示词模块 |
| `src/services/rolePrompts/seer.js` | 新建 | 预言家提示词模块 |
| `src/services/rolePrompts/witch.js` | 新建 | 女巫提示词模块 |
| `src/services/rolePrompts/hunter.js` | 新建 | 猎人提示词模块 |
| `src/services/rolePrompts/guard.js` | 新建 | 守卫提示词模块 |
| `src/services/rolePrompts/villager.js` | 新建 | 村民提示词模块 |
| `src/services/promptFactory.js` | 新建 | 渐进式披露提示词工厂 |
| `src/services/aiPrompts.js` | 修改 | 集成渐进式披露架构 |
| `src/useWerewolfGame.js` | 修改 | 添加 `pendingHunterShoot` 状态 |
| `src/App.jsx` | 修改 | 添加 `isGoodMajority()` 和延迟开枪逻辑 |
| `src/hooks/useDayFlow.js` | 修改 | 实现连锁开枪机制 |
| `src/components/GameArena.jsx` | 修改 | `getAllActions()` 添加投票历史 |
| `src/components/SidePanels.jsx` | 修改 | 添加日/夜分组标题 |
| `CLAUDE.md` | 修改 | 更新目录结构和常见任务指南 |

### 技术细节
- 延迟开枪状态格式：`{ hunterId, source: 'night', chainDepth: 0 }`
- 连锁深度限制：`chainDepth > 3` 时停止递归
- 渐进式披露核心函数：`detectExistingRoles()` 返回 `{ hasWitch, hasGuard, hasHunter, hasSeer }`
- 条件化规则通过 `buildConditionalRules(existingRoles, gameSetup)` 动态生成

---

## [2026-02-05] 屠边/屠城模式 + AI身份推理表 + 思考过程记录

### Bug 修复
- **AI 模型排行榜网络错误**
  - 问题：排行榜显示"网络错误，请稍后重试"
  - 原因：数据库迁移 `002_add_model_stats.sql` 未执行，`ai_model_stats` 表不存在
  - 修复：执行数据库迁移创建表和索引

### 新功能
- **屠边/屠城胜利模式选择**
  - 屠边模式（默认）：狼人杀光所有村民或所有神职即可胜利
  - 屠城模式：狼人必须杀光所有好人（村民+神职）才能胜利
  - 在设置界面添加模式选择 UI
  - 根据模式动态调整 AI 提示词和策略建议

- **AI 身份推理表系统**
  - 每个 AI 维护自己的身份推理表（`identity_table`）
  - 记录对每个玩家的身份猜测、置信度（0-100%）和推理依据
  - AI 基于排除法和行为分析进行推理
  - 推理表在每次发言后更新，实现持续的身份追踪

- **AI 思考过程记录**
  - 发言历史中保存 AI 的 `thought`（思考过程）和 `identity_table`（推理表）
  - 导出的 txt 记录文件现在包含：
    - 💭 思考过程：AI 内部的分析和推理
    - 🗳️ 投票意向：AI 的投票目标
    - 📊 身份推理表：每个 AI 对场上玩家身份的最终判断

### 文件变更
| 文件 | 操作 | 说明 |
|------|------|------|
| `src/config/roles.js` | 修改 | 新增 `VICTORY_MODES` 胜利模式配置 |
| `src/components/SetupScreen.jsx` | 修改 | 添加胜利模式选择 UI |
| `src/App.jsx` | 修改 | 添加 `victoryMode` 状态，修改 `checkGameEnd` 和导出函数 |
| `src/services/aiPrompts.js` | 修改 | 添加 `VICTORY_MODE_PROMPTS`、`IDENTITY_TABLE_PROMPT`，修改输出格式 |
| `src/hooks/useAI.js` | 修改 | 添加 `identityTablesRef` 存储推理表，传递 `victoryMode` |
| `migrations/002_add_model_stats.sql` | 执行 | 创建 `ai_model_stats` 和 `game_model_usage` 表 |

### 技术细节
- 身份推理表格式：`{"玩家号": {"suspect": "角色猜测", "confidence": 0-100, "reason": "推理依据"}}`
- 胜利条件判断在 `checkGameEnd` 函数中根据 `victoryMode` 动态切换
- AI 提示词根据角色阵营显示不同的胜利目标和策略建议

---

## [2026-02-05] 自定义角色选择功能

### 新功能
- **自定义角色配置系统**
  - 玩家可自由选择参与游戏的角色，不再局限于固定模式
  - 新增 `RoleSelector` 组件，提供直观的角色选择界面
  - 角色分类展示：狼人阵营（红色）、神职角色（琥珀色）、好人阵营（绿色）
  - 唯一角色（预言家/女巫/守卫）使用开关选择，最多1个
  - 多选角色（狼人/村民/猎人）使用 +/- 按钮调整数量

- **角色元数据系统** (`ROLE_METADATA`)
  - 为每个角色定义约束条件（maxCount）和夜间行动顺序（nightOrder）
  - 支持动态生成夜间行动顺序 `generateNightSequence()`
  - 自动生成配置描述字符串 `generateDescription()`

- **配置验证系统**
  - 实时验证：总人数 4-10 人、至少1名狼人、好人数量多于狼人
  - 错误提示（红色）阻止开始游戏
  - 警告提示（琥珀色）仅提示但不阻止（如狼人比例偏高）

### 文件变更
| 文件 | 操作 | 说明 |
|------|------|------|
| `src/config/roles.js` | 修改 | 新增 ROLE_METADATA、验证函数、工具函数 |
| `src/components/RoleSelector.jsx` | 新建 | 角色选择器 UI 组件 |
| `src/components/SetupScreen.jsx` | 修改 | 集成自定义按钮和 RoleSelector |
| `src/App.jsx` | 修改 | 状态提升、传递新 props |
| `src/components/ModelLeaderboard.jsx` | 修复 | 修复 authService 导入错误 |

### 技术细节
- 夜间顺序根据 `nightOrder` 数值自动排序，添加新角色只需在 `ROLE_METADATA` 中定义
- 向后兼容：预设模式（8人局、6人局）完全保留
- 自定义配置在开始游戏时构建，复用现有的 `selectedSetup` 状态

---

## [2026-02-05] AI 模型排行榜系统 + 游戏逻辑优化

### 新功能
- **AI 模型排行榜系统**
  - 添加数据库表追踪每个 AI 模型在不同角色下的表现统计
  - 实现等概率随机模型选择机制，确保公平竞争
  - 游戏结束时自动上报模型使用数据和结果
  - 新增后端 API 端点：
    - `POST /api/model-stats` - 提交模型游戏统计
    - `GET /api/model-leaderboard` - 获取模型排行榜（支持按角色筛选和排序）
  - 新增前端排行榜组件 `ModelLeaderboard.jsx`
    - 显示模型胜率、总场次、胜负记录
    - 支持按角色筛选和多种排序方式（胜率/总场次/胜场）
    - 所有注册用户可见，集成到 Dashboard 主页

### 优化改进
- **AI 模型调用优化**
  - 修改 AI 客户端从基于玩家 ID 的轮询改为真随机选择
  - 添加模型使用追踪，每次 AI 调用记录使用的模型信息
  - 游戏状态新增 `modelUsage` 字段追踪整局游戏的模型使用

- **游戏逻辑改进**
  - 修复玩家模式下投票记录不显示问题
  - 添加身份推理系统，AI 可根据游戏配置推断角色身份
    - 示例："只有1号跳预言家，大概率是真预言家（本局只有1个预言家）"
  - 白天投票增加思考过程记录，显示投票原因
  - 优化投票流程为并行执行，大幅减少等待时间
  - 女巫策略调整为基于推理而非"上帝视角"
    - 不再直接告知好人/狼人剩余数量
    - 引导女巫通过时间线、历史死亡、查验记录自己推断局势

### 数据库变更
**迁移文件**: `migrations/002_add_model_stats.sql`

新增表：
1. **ai_model_stats** - AI 模型统计聚合表
   ```sql
   CREATE TABLE ai_model_stats (
     id INTEGER PRIMARY KEY,
     model_id TEXT NOT NULL,
     model_name TEXT NOT NULL,
     role TEXT NOT NULL,
     total_games INTEGER DEFAULT 0,
     wins INTEGER DEFAULT 0,
     losses INTEGER DEFAULT 0,
     win_rate REAL DEFAULT 0.0,
     created_at TIMESTAMP,
     updated_at TIMESTAMP,
     UNIQUE(model_id, role)
   );
   ```

2. **game_model_usage** - 游戏模型使用记录表
   ```sql
   CREATE TABLE game_model_usage (
     id INTEGER PRIMARY KEY,
     game_session_id TEXT NOT NULL,
     player_id INTEGER NOT NULL,
     role TEXT NOT NULL,
     model_id TEXT NOT NULL,
     model_name TEXT NOT NULL,
     result TEXT CHECK(result IN ('win', 'lose')),
     game_mode TEXT NOT NULL,
     duration_seconds INTEGER,
     created_at TIMESTAMP
   );
   ```

### 修改文件列表
**前端**:
- `src/services/aiClient.js` - 随机模型选择和信息追踪
- `src/hooks/useAI.js` - 模型使用回调
- `src/useWerewolfGame.js` - 模型追踪状态管理
- `src/App.jsx` - 游戏结束时上报统计
- `src/services/authService.js` - 新增 API 调用方法
- `src/components/ModelLeaderboard.jsx` - **新增**排行榜组件
- `src/components/Dashboard.jsx` - 集成排行榜组件
- `src/hooks/useDayFlow.js` - 优化投票逻辑为并行执行
- `src/services/aiPrompts.js` - 添加身份推理和女巫推理引导

**后端**:
- `workers/auth/handlers.js` - 新增统计处理逻辑
- `workers/auth/index.js` - 新增路由

### 部署命令
```bash
# 应用数据库迁移
npx wrangler d1 execute wolfgame-db --remote --file=migrations/002_add_model_stats.sql

# 构建并部署
npm run build
npm run deploy
```

### 验证命令
```bash
# 查看新表结构
npx wrangler d1 execute wolfgame-db --remote --command "SELECT sql FROM sqlite_master WHERE type='table' AND name IN ('ai_model_stats', 'game_model_usage');"

# 查看排行榜数据
npx wrangler d1 execute wolfgame-db --remote --command "SELECT * FROM ai_model_stats ORDER BY win_rate DESC LIMIT 10;"
```

---

## [2026-02-04] 修复 Cloudflare 部署和令牌验证功能

### 问题描述
- 用户登录后配置 ModelScope 令牌时报错 "Not found"
- Cloudflare 部署失败，错误: `binding DB of type d1 must have a valid id specified`

### 根本原因分析
1. **wrangler.toml 配置错误**
   - `database_id` 使用占位符 `"your-database-id-here"` 而非实际 ID
   - `database_name` 不匹配 (`wolfgame_db` vs 实际的 `wolfgame-db`)

2. **JWT_SECRET 未配置**
   - Cloudflare Workers Secret 未设置
   - 导致登录时 HMAC 签名失败 (key length = 0)

3. **数据库 Schema 不完整**
   - `users` 表缺少 `modelscope_token` 和 `token_verified_at` 列
   - 表结构与 `schema.sql` 定义不同步

### 修复内容

#### 1. 修复 wrangler.toml 配置
```toml
# 修改前
[[d1_databases]]
binding = "DB"
database_name = "wolfgame_db"
database_id = "your-database-id-here"

# 修改后
[[d1_databases]]
binding = "DB"
database_name = "wolfgame-db"
database_id = "f54315ad-c129-41e4-a23d-82463488d315"
```

#### 2. 配置 JWT_SECRET
```bash
npx wrangler secret put JWT_SECRET
# 输入 32 字节随机密钥
```

#### 3. 数据库迁移 - 添加令牌相关列
```sql
ALTER TABLE users ADD COLUMN modelscope_token TEXT;
ALTER TABLE users ADD COLUMN token_verified_at TIMESTAMP;
```

### 修复后的 users 表结构
| 列名 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| username | TEXT | 用户名 |
| email | TEXT | 邮箱 |
| password_hash | TEXT | 密码哈希 |
| email_verified | INTEGER | 邮箱验证状态 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |
| last_login | TIMESTAMP | 最后登录时间 |
| **modelscope_token** | TEXT | ModelScope API 令牌 (新增) |
| **token_verified_at** | TIMESTAMP | 令牌验证时间 (新增) |

### 验证命令
```bash
# 查看 D1 数据库列表
npx wrangler d1 list

# 查看 Secrets 配置
npx wrangler secret list

# 查看表结构
npx wrangler d1 execute wolfgame-db --remote --command "PRAGMA table_info(users);"

# 部署
npm run build && npm run deploy
```

### 经验教训
1. **配置文件检查**: 部署前确保 `wrangler.toml` 中没有占位符
2. **Secrets 管理**: Workers Secrets 需要单独配置，不能写在代码中
3. **数据库迁移**: 生产环境表结构变更需要手动执行 `ALTER TABLE`
4. **版本保留**: Cloudflare Workers 部署失败时旧版本继续运行，需注意新功能可能未上线

---

## 历史版本

### [2026-01-23] 初始版本
- 创建 D1 数据库 `wolfgame-db`
- 部署基础认证系统
- 实现用户注册/登录功能
