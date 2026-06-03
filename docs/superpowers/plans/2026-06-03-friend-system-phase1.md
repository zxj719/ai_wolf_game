# 好友系统 Phase 1 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现好友系统（用户名/邮箱搜索 → 发申请 → 审批 → 好友列表），作为新 `chat` 模块的 Phase 1，不含任何实时能力。

**Architecture:** 纯函数逻辑放 `workers/auth/friendsLib.js`（可单测）；D1 读写放 `workers/auth/friends.js` 的 handler；路由在 `workers/auth/index.js` 注册；前端 `src/services/friendService.js` 封装调用；新模块 `src/modules/chat/` 用展示型叶子组件 + `ChatRoute` 容器；首页卡片对游客隐藏。

**Tech Stack:** Cloudflare Workers + D1（SQLite）、React 18 + Vite、TailwindCSS、Vitest（`renderToStaticMarkup` 做组件冒烟测试）。

**关联 spec:** [docs/superpowers/specs/2026-06-03-friend-chat-video-design.md](../specs/2026-06-03-friend-chat-video-design.md)

---

## 关键既有约定（实现者必读）

- **JWT 用户 id = `user.sub`**（`signToken({ sub, username, email })`）。`authMiddleware(request, env)` 返回 `{ user, error }`，`user.sub` 是 id，`user.email` 是邮箱。**统一用 `user.sub`，不要用 `user.id`。**
- 响应助手在 `workers/auth/middleware.js`：`jsonResponse(data, status, env, request)`、`errorResponse(msg, status, env, request)`。
- 管理员判定 `isAdmin(email, env)` 已存在于 `workers/auth/queue.js`（Phase 1 不需要，Phase 3 才用）。
- D1 API：`env.DB.prepare(sql).bind(...).first()`（单行）/`.all()`（返回 `{ results: [...] }`）/`.run()`（返回 `{ meta: { changes, last_row_id } }`）。占位符用 `?`，按顺序 `.bind()`。
- 校验助手在 middleware.js：`isValidUsername`、`isValidEmail`。
- 迁移文件放 `migrations/00N_name.sql`，纯 SQL，`CREATE TABLE IF NOT EXISTS`。
- 前端 API base 在 `src/services/apiBase.js`：`buildApiUrl(endpoint)`。
- 测试：`npm test`（= `vitest run`）；单测单文件 `npx vitest run <path>`。组件用 `renderToStaticMarkup`（`react-dom/server`），**不要**用 `@testing-library`（未安装）。
- 模块注册：`src/modules/<name>/index.js` 默认导出描述符 → `src/shell/ModuleRegistry.js` 数组加一行；路径常量在 `src/shell/paths.js`。
- 首页卡片：当前由 `src/components/Dashboard.jsx` 显式渲染（非 registry 驱动），`src/modules/home/HomeRoute.jsx` 传 `onEnterX` 回调。

---

## File Structure

| 文件 | 操作 | 职责 |
|---|---|---|
| `migrations/004_friendships.sql` | 新建 | `friendships` + `friend_requests` 两张表 |
| `workers/auth/friendsLib.js` | 新建 | 纯函数：`normalizeFriendship`、`sanitizeSearchQuery` |
| `workers/auth/__tests__/friendsLib.test.js` | 新建 | friendsLib 单测 |
| `workers/auth/friends.js` | 新建 | 5 个 handler：search/request/requestsList/respond/friendsList |
| `workers/auth/index.js` | 修改 | 注册 5 条 `/api/friends*` `/api/users/search` 路由 |
| `src/services/friendService.js` | 新建 | 前端调用封装 |
| `src/services/__tests__/friendService.test.js` | 新建 | friendService 单测（mock fetch） |
| `src/shell/paths.js` | 修改 | 加 `CHAT: '/chat'` |
| `src/modules/chat/index.js` | 新建 | 模块描述符 |
| `src/modules/chat/ChatRoute.jsx` | 新建 | 容器：hooks + 状态 + 调 friendService |
| `src/modules/chat/components/AddFriend.jsx` | 新建 | 展示型：搜索框 + 结果 + 发申请 |
| `src/modules/chat/components/FriendRequests.jsx` | 新建 | 展示型：待处理申请 + 同意/拒绝 |
| `src/modules/chat/components/FriendList.jsx` | 新建 | 展示型：好友列表 |
| `src/modules/chat/__tests__/friendComponents.test.jsx` | 新建 | 三个展示组件冒烟测试 |
| `src/shell/ModuleRegistry.js` | 修改 | import chat + 加入数组 |
| `src/components/Dashboard.jsx` | 修改 | 加 `onEnterChat` 卡片（游客隐藏） |
| `src/modules/home/HomeRoute.jsx` | 修改 | 加 `onEnterChat` 回调 |

---

## Task 1: D1 迁移 — 好友表

**Files:**
- Create: `migrations/004_friendships.sql`

- [ ] **Step 1: 写迁移文件**

`migrations/004_friendships.sql`:
```sql
-- 004: 好友系统 — 好友关系 + 好友申请

-- 好友关系：无向边，规范化存储（user_a < user_b），避免重复行
CREATE TABLE IF NOT EXISTS friendships (
  user_a     INTEGER NOT NULL,           -- 较小的 user id
  user_b     INTEGER NOT NULL,           -- 较大的 user id
  created_at INTEGER NOT NULL,           -- epoch ms
  PRIMARY KEY (user_a, user_b)
);

-- 好友申请（有方向）
CREATE TABLE IF NOT EXISTS friend_requests (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  from_user  INTEGER NOT NULL,
  to_user    INTEGER NOT NULL,
  status     TEXT    NOT NULL DEFAULT 'pending',  -- pending | accepted | rejected
  created_at INTEGER NOT NULL,
  UNIQUE (from_user, to_user)
);
CREATE INDEX IF NOT EXISTS idx_freq_to ON friend_requests(to_user, status);
```

- [ ] **Step 2: 本地应用迁移并验证表存在**

Run:
```bash
npx wrangler d1 execute wolfgame-db --local --file=./migrations/004_friendships.sql
npx wrangler d1 execute wolfgame-db --local --command="SELECT name FROM sqlite_master WHERE type='table' AND name IN ('friendships','friend_requests');"
```
Expected: 输出包含 `friendships` 和 `friend_requests` 两行。

- [ ] **Step 3: Commit**

```bash
git add migrations/004_friendships.sql
git commit -m "feat(chat): add friendships + friend_requests D1 migration"
```

> ⚠️ 生产库迁移在 Phase 1 全部完成、本地验证后再执行：`npx wrangler d1 execute wolfgame-db --remote --file=./migrations/004_friendships.sql`。不要在开发中途打生产库。

---

## Task 2: 纯函数库 friendsLib

**Files:**
- Create: `workers/auth/friendsLib.js`
- Test: `workers/auth/__tests__/friendsLib.test.js`

- [ ] **Step 1: 写失败测试**

`workers/auth/__tests__/friendsLib.test.js`:
```js
import { describe, expect, it } from 'vitest';
import { normalizeFriendship, sanitizeSearchQuery } from '../friendsLib.js';

describe('normalizeFriendship', () => {
  it('orders the smaller id into user_a', () => {
    expect(normalizeFriendship(7, 3)).toEqual({ userA: 3, userB: 7 });
    expect(normalizeFriendship(3, 7)).toEqual({ userA: 3, userB: 7 });
  });

  it('coerces numeric strings', () => {
    expect(normalizeFriendship('10', '2')).toEqual({ userA: 2, userB: 10 });
  });

  it('throws when both ids are equal', () => {
    expect(() => normalizeFriendship(5, 5)).toThrow();
  });
});

describe('sanitizeSearchQuery', () => {
  it('trims and returns the query when long enough', () => {
    expect(sanitizeSearchQuery('  alice ')).toBe('alice');
  });

  it('returns null for queries shorter than 2 chars', () => {
    expect(sanitizeSearchQuery('a')).toBeNull();
    expect(sanitizeSearchQuery('   ')).toBeNull();
    expect(sanitizeSearchQuery('')).toBeNull();
    expect(sanitizeSearchQuery(null)).toBeNull();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run workers/auth/__tests__/friendsLib.test.js`
Expected: FAIL，报 `normalizeFriendship`/`sanitizeSearchQuery` 未定义（模块不存在）。

- [ ] **Step 3: 写最小实现**

`workers/auth/friendsLib.js`:
```js
/**
 * friendsLib — 好友系统纯函数（无 D1、无副作用，便于单测）
 */

/**
 * 规范化好友关系：较小 id 进 userA，较大进 userB。
 * @returns {{ userA: number, userB: number }}
 */
export function normalizeFriendship(a, b) {
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isFinite(na) || !Number.isFinite(nb)) {
    throw new Error('normalizeFriendship: ids must be numeric');
  }
  if (na === nb) {
    throw new Error('normalizeFriendship: cannot befriend self');
  }
  return { userA: Math.min(na, nb), userB: Math.max(na, nb) };
}

/**
 * 清洗搜索词：去空白；少于 2 字符返回 null（避免拉全表）。
 * @returns {string|null}
 */
export function sanitizeSearchQuery(q) {
  if (typeof q !== 'string') return null;
  const trimmed = q.trim();
  return trimmed.length >= 2 ? trimmed : null;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run workers/auth/__tests__/friendsLib.test.js`
Expected: PASS（3 + 2 个用例）。

- [ ] **Step 5: Commit**

```bash
git add workers/auth/friendsLib.js workers/auth/__tests__/friendsLib.test.js
git commit -m "feat(chat): add friendsLib pure helpers with tests"
```

---

## Task 3: Worker 好友 handlers + 路由

**Files:**
- Create: `workers/auth/friends.js`
- Modify: `workers/auth/index.js`（import + 路由）

- [ ] **Step 1: 写 handlers**

`workers/auth/friends.js`:
```js
/**
 * friends.js — 好友系统 API（D1）
 *
 * 端点：
 *   GET  /api/users/search?q=     搜用户（脱敏，仅 id+username）
 *   POST /api/friends/request     发好友申请 { toUserId }
 *   GET  /api/friends/requests    我收到的 pending 申请
 *   POST /api/friends/respond     { requestId, action: 'accept'|'reject' }
 *   GET  /api/friends             我的好友列表
 */

import { jsonResponse, errorResponse, authMiddleware } from './middleware.js';
import { normalizeFriendship, sanitizeSearchQuery } from './friendsLib.js';

/** 取已认证用户的数字 id；未认证返回 null */
async function requireUserId(request, env) {
  const { user } = await authMiddleware(request, env);
  if (!user || user.sub == null) return null;
  return Number(user.sub);
}

/** GET /api/users/search?q= */
export async function handleUserSearch(request, env) {
  const me = await requireUserId(request, env);
  if (me == null) return errorResponse('Not authenticated', 401, env, request);

  const url = new URL(request.url);
  const q = sanitizeSearchQuery(url.searchParams.get('q'));
  if (!q) return jsonResponse({ results: [] }, 200, env, request);

  const like = `%${q}%`;
  const rows = await env.DB.prepare(
    `SELECT id, username FROM users
     WHERE (username LIKE ? OR email LIKE ?) AND id != ?
     ORDER BY username LIMIT 20`
  ).bind(like, like, me).all();

  return jsonResponse({ results: rows.results || [] }, 200, env, request);
}

/** POST /api/friends/request  { toUserId } */
export async function handleFriendRequest(request, env) {
  const me = await requireUserId(request, env);
  if (me == null) return errorResponse('Not authenticated', 401, env, request);

  const body = await request.json().catch(() => ({}));
  const toUserId = Number(body.toUserId);
  if (!Number.isFinite(toUserId)) return errorResponse('Invalid toUserId', 400, env, request);
  if (toUserId === me) return errorResponse('Cannot add yourself', 400, env, request);

  // 目标用户存在？
  const target = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(toUserId).first();
  if (!target) return errorResponse('User not found', 404, env, request);

  // 已是好友？
  const { userA, userB } = normalizeFriendship(me, toUserId);
  const existing = await env.DB.prepare(
    'SELECT 1 FROM friendships WHERE user_a = ? AND user_b = ?'
  ).bind(userA, userB).first();
  if (existing) return jsonResponse({ status: 'already_friends' }, 200, env, request);

  // 反向已有 pending（对方先加了我）→ 直接成为好友
  const reverse = await env.DB.prepare(
    "SELECT id FROM friend_requests WHERE from_user = ? AND to_user = ? AND status = 'pending'"
  ).bind(toUserId, me).first();
  if (reverse) {
    const now = Date.now();
    await env.DB.prepare("UPDATE friend_requests SET status = 'accepted' WHERE id = ?").bind(reverse.id).run();
    await env.DB.prepare(
      'INSERT OR IGNORE INTO friendships (user_a, user_b, created_at) VALUES (?, ?, ?)'
    ).bind(userA, userB, now).run();
    return jsonResponse({ status: 'accepted' }, 200, env, request);
  }

  // 新建 pending（幂等：UNIQUE 冲突视为已存在）
  const now = Date.now();
  try {
    await env.DB.prepare(
      "INSERT INTO friend_requests (from_user, to_user, status, created_at) VALUES (?, ?, 'pending', ?)"
    ).bind(me, toUserId, now).run();
  } catch (e) {
    return jsonResponse({ status: 'already_requested' }, 200, env, request);
  }
  return jsonResponse({ status: 'requested' }, 201, env, request);
}

/** GET /api/friends/requests — 我收到的 pending */
export async function handleFriendRequestsList(request, env) {
  const me = await requireUserId(request, env);
  if (me == null) return errorResponse('Not authenticated', 401, env, request);

  const rows = await env.DB.prepare(
    `SELECT fr.id, fr.from_user AS fromUser, u.username AS fromUsername, fr.created_at AS createdAt
     FROM friend_requests fr
     JOIN users u ON u.id = fr.from_user
     WHERE fr.to_user = ? AND fr.status = 'pending'
     ORDER BY fr.created_at DESC`
  ).bind(me).all();

  return jsonResponse({ requests: rows.results || [] }, 200, env, request);
}

/** POST /api/friends/respond  { requestId, action } */
export async function handleFriendRespond(request, env) {
  const me = await requireUserId(request, env);
  if (me == null) return errorResponse('Not authenticated', 401, env, request);

  const body = await request.json().catch(() => ({}));
  const requestId = Number(body.requestId);
  const action = body.action;
  if (!Number.isFinite(requestId)) return errorResponse('Invalid requestId', 400, env, request);
  if (action !== 'accept' && action !== 'reject') return errorResponse('Invalid action', 400, env, request);

  // 申请存在且收件人是我且仍 pending
  const req = await env.DB.prepare(
    "SELECT id, from_user, to_user FROM friend_requests WHERE id = ? AND status = 'pending'"
  ).bind(requestId).first();
  if (!req) return errorResponse('Request not found', 404, env, request);
  if (Number(req.to_user) !== me) return errorResponse('Forbidden', 403, env, request);

  if (action === 'reject') {
    await env.DB.prepare("UPDATE friend_requests SET status = 'rejected' WHERE id = ?").bind(requestId).run();
    return jsonResponse({ status: 'rejected' }, 200, env, request);
  }

  // accept
  const { userA, userB } = normalizeFriendship(req.from_user, req.to_user);
  const now = Date.now();
  await env.DB.prepare("UPDATE friend_requests SET status = 'accepted' WHERE id = ?").bind(requestId).run();
  await env.DB.prepare(
    'INSERT OR IGNORE INTO friendships (user_a, user_b, created_at) VALUES (?, ?, ?)'
  ).bind(userA, userB, now).run();
  return jsonResponse({ status: 'accepted' }, 200, env, request);
}

/** GET /api/friends — 我的好友列表 */
export async function handleFriendsList(request, env) {
  const me = await requireUserId(request, env);
  if (me == null) return errorResponse('Not authenticated', 401, env, request);

  const rows = await env.DB.prepare(
    `SELECT u.id, u.username FROM friendships f
     JOIN users u ON u.id = (CASE WHEN f.user_a = ? THEN f.user_b ELSE f.user_a END)
     WHERE f.user_a = ? OR f.user_b = ?
     ORDER BY u.username`
  ).bind(me, me, me).all();

  return jsonResponse({ friends: rows.results || [] }, 200, env, request);
}
```

> 注：`handleUserSearch` 第三个参数 `request2` 是无用占位，删掉它，签名保持 `(request, env)`。**实现时函数签名统一为 `(request, env)`。**（上面代码块已用 `(request, env, request2 = request)` 是笔误，落地写成 `export async function handleUserSearch(request, env) {`。）

- [ ] **Step 2: 在 index.js 注册路由**

修改 `workers/auth/index.js`。在现有 import 块（约第 27-56 行的 `from './handlers.js'` 之后）新增：
```js
import {
  handleUserSearch,
  handleFriendRequest,
  handleFriendRequestsList,
  handleFriendRespond,
  handleFriendsList,
} from './friends.js';
```

在路由 `try {` 块内（紧接 `/api/me` 路由之后，约第 84 行后）新增：
```js
      // 好友系统
      if (path === '/api/users/search' && request.method === 'GET') {
        return handleUserSearch(request, env);
      }
      if (path === '/api/friends/request' && request.method === 'POST') {
        return handleFriendRequest(request, env);
      }
      if (path === '/api/friends/requests' && request.method === 'GET') {
        return handleFriendRequestsList(request, env);
      }
      if (path === '/api/friends/respond' && request.method === 'POST') {
        return handleFriendRespond(request, env);
      }
      if (path === '/api/friends' && request.method === 'GET') {
        return handleFriendsList(request, env);
      }
```

- [ ] **Step 3: 起本地 Worker 冒烟验证**

> 前置：需要两个真实用户和一个有效 JWT。用注册接口造两个用户、各取 token。

启动：`npm run dev:worker`（`wrangler dev`，端口 8787，使用 `--local` D1）。在另一个终端：
```bash
# 造用户 A
curl -s -X POST http://localhost:8787/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"alice01","email":"alice@example.com","password":"Passw0rd1"}'
# 造用户 B
curl -s -X POST http://localhost:8787/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"bob01","email":"bob@example.com","password":"Passw0rd1"}'
```
记下两个返回里的 `token` 为 `$TOKEN_A` / `$TOKEN_B`，B 的 `user.id` 为 `$BID`。

```bash
# A 搜 bob → 应返回 bob01
curl -s "http://localhost:8787/api/users/search?q=bob" -H "Authorization: Bearer $TOKEN_A"
# A 给 B 发申请
curl -s -X POST http://localhost:8787/api/friends/request -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" -d "{\"toUserId\":$BID}"
# B 查申请 → 应有一条 from alice01，记下 requestId 为 $RID
curl -s http://localhost:8787/api/friends/requests -H "Authorization: Bearer $TOKEN_B"
# B 同意
curl -s -X POST http://localhost:8787/api/friends/respond -H "Authorization: Bearer $TOKEN_B" \
  -H "Content-Type: application/json" -d "{\"requestId\":$RID,\"action\":\"accept\"}"
# A 查好友 → 应有 bob01
curl -s http://localhost:8787/api/friends -H "Authorization: Bearer $TOKEN_A"
```
Expected: search 返回 `{"results":[{"id":..,"username":"bob01"}]}`；request 返回 `{"status":"requested"}`；requests 含一条；respond 返回 `{"status":"accepted"}`；friends 返回含 `bob01`。**关键脱敏断言：search/friends 返回里不得出现 `email`/`password_hash`。**

- [ ] **Step 4: Commit**

```bash
git add workers/auth/friends.js workers/auth/index.js
git commit -m "feat(chat): friend system Worker endpoints (search/request/respond/list)"
```

---

## Task 4: 前端 friendService

**Files:**
- Create: `src/services/friendService.js`
- Test: `src/services/__tests__/friendService.test.js`

- [ ] **Step 1: 写失败测试**

`src/services/__tests__/friendService.test.js`:
```js
import { describe, expect, it, vi } from 'vitest';
import { friendService } from '../friendService.js';

// 模拟 useShell().api('cf-workers') 返回的客户端：{ get, post, put, delete }
function makeApi() {
  return {
    get: vi.fn(() => Promise.resolve({ results: [] })),
    post: vi.fn(() => Promise.resolve({ status: 'ok' })),
  };
}

describe('friendService', () => {
  it('searchUsers GETs /api/users/search with an encoded query', async () => {
    const api = makeApi();
    await friendService.searchUsers(api, 'bo b');
    expect(api.get).toHaveBeenCalledWith('/api/users/search?q=bo%20b');
  });

  it('sendRequest POSTs toUserId', async () => {
    const api = makeApi();
    api.post.mockResolvedValueOnce({ status: 'requested' });
    const res = await friendService.sendRequest(api, 42);
    expect(api.post).toHaveBeenCalledWith('/api/friends/request', { toUserId: 42 });
    expect(res).toEqual({ status: 'requested' });
  });

  it('listRequests GETs /api/friends/requests', async () => {
    const api = makeApi();
    await friendService.listRequests(api);
    expect(api.get).toHaveBeenCalledWith('/api/friends/requests');
  });

  it('respond POSTs requestId + action', async () => {
    const api = makeApi();
    await friendService.respond(api, 7, 'accept');
    expect(api.post).toHaveBeenCalledWith('/api/friends/respond', { requestId: 7, action: 'accept' });
  });

  it('listFriends GETs /api/friends', async () => {
    const api = makeApi();
    await friendService.listFriends(api);
    expect(api.get).toHaveBeenCalledWith('/api/friends');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/services/__tests__/friendService.test.js`
Expected: FAIL（模块不存在 / 方法未定义）。

- [ ] **Step 3: 写实现**

`src/services/friendService.js`:
```js
/**
 * friendService — 好友系统前端调用封装。
 *
 * 每个方法第一个参数是 useShell().api('cf-workers') 返回的 api 客户端，
 * 它已自动注入 base URL + Authorization（token 取自 localStorage），并统一
 * 解析错误。复用现有 createApiClient，避免重复实现 fetch / 错误处理。
 */
export const friendService = {
  /** 搜索用户（按用户名/邮箱），返回 { results: [{id, username}] } */
  searchUsers(api, q) {
    return api.get(`/api/users/search?q=${encodeURIComponent(q)}`);
  },
  /** 发好友申请，返回 { status } */
  sendRequest(api, toUserId) {
    return api.post('/api/friends/request', { toUserId });
  },
  /** 我收到的待处理申请，返回 { requests: [...] } */
  listRequests(api) {
    return api.get('/api/friends/requests');
  },
  /** 同意/拒绝申请，返回 { status } */
  respond(api, requestId, action) {
    return api.post('/api/friends/respond', { requestId, action });
  },
  /** 我的好友列表，返回 { friends: [{id, username}] } */
  listFriends(api) {
    return api.get('/api/friends');
  },
};
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/services/__tests__/friendService.test.js`
Expected: PASS（4 个用例）。

- [ ] **Step 5: Commit**

```bash
git add src/services/friendService.js src/services/__tests__/friendService.test.js
git commit -m "feat(chat): add friendService frontend client with tests"
```

---

## Task 5: 路由常量 + 模块描述符

**Files:**
- Modify: `src/shell/paths.js`
- Create: `src/modules/chat/index.js`

- [ ] **Step 1: 加路由常量**

修改 `src/shell/paths.js`，在 `ROUTES` 对象「其它并列模块」分组里（`NOVEL: '/novel',` 之后）新增：
```js
  CHAT:   '/chat',
```

- [ ] **Step 2: 写模块描述符**

`src/modules/chat/index.js`:
```js
import { lazy } from 'react';
import { ROUTES } from '../../shell/paths';

const ChatRoute = lazy(() => import('./ChatRoute'));

const chatModule = {
  id: 'chat',
  title: { zh: '好友', en: 'Friends' },
  blurb: {
    zh: '好友私聊与实时通话（需登录）',
    en: 'Friends, private chat and live calls (login required)',
  },
  theme: 'light',
  backend: 'cf-workers',
  routes: [
    { path: ROUTES.CHAT, component: ChatRoute, requiresAuth: true },
  ],
  // 游客在首页不显示（Dashboard 用 isGuestMode 控制实际渲染）；
  // 此处保留 visible:true 供未来 registry 卡片墙使用。
  home: { visible: true, order: 25 },
};

export default chatModule;
```

- [ ] **Step 3: 构建验证（确保 import 不报错）**

Run: `npm run build`
Expected: 构建成功（此时 ChatRoute 还不存在会失败 → 故本步在 Task 6 之后再跑；先只 commit 常量与描述符的话，描述符 lazy import 一个不存在的文件，build 时不会立即解析 lazy，但 Vite 会在打包 chunk 时报找不到模块）。

> 因此把 Task 5 的 commit 与 Task 6 合并：先完成 Task 6 的 ChatRoute 与组件，再统一 `npm run build` + commit。**Task 5 不单独 commit。**

---

## Task 6: chat 模块 UI（展示组件 + 容器）

**Files:**
- Create: `src/modules/chat/components/AddFriend.jsx`
- Create: `src/modules/chat/components/FriendRequests.jsx`
- Create: `src/modules/chat/components/FriendList.jsx`
- Create: `src/modules/chat/ChatRoute.jsx`
- Test: `src/modules/chat/__tests__/friendComponents.test.jsx`

- [ ] **Step 1: 写失败测试（三个展示组件）**

`src/modules/chat/__tests__/friendComponents.test.jsx`:
```jsx
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FriendList } from '../components/FriendList.jsx';
import { FriendRequests } from '../components/FriendRequests.jsx';
import { AddFriend } from '../components/AddFriend.jsx';

describe('FriendList', () => {
  it('renders each friend username', () => {
    const html = renderToStaticMarkup(
      <FriendList friends={[{ id: 1, username: 'alice01' }, { id: 2, username: 'bob01' }]} onSelect={() => {}} />
    );
    expect(html).toContain('alice01');
    expect(html).toContain('bob01');
  });

  it('renders an empty hint when no friends', () => {
    const html = renderToStaticMarkup(<FriendList friends={[]} onSelect={() => {}} />);
    expect(html).toContain('还没有好友');
  });
});

describe('FriendRequests', () => {
  it('renders requester username and accept/reject controls', () => {
    const html = renderToStaticMarkup(
      <FriendRequests
        requests={[{ id: 9, fromUser: 3, fromUsername: 'carol', createdAt: 1 }]}
        onAccept={() => {}}
        onReject={() => {}}
      />
    );
    expect(html).toContain('carol');
    expect(html).toContain('同意');
    expect(html).toContain('拒绝');
  });
});

describe('AddFriend', () => {
  it('renders search input and button', () => {
    const html = renderToStaticMarkup(
      <AddFriend query="" results={[]} onQueryChange={() => {}} onSearch={() => {}} onSendRequest={() => {}} />
    );
    expect(html).toContain('搜索');
  });

  it('renders search results with send buttons', () => {
    const html = renderToStaticMarkup(
      <AddFriend
        query="bo" results={[{ id: 2, username: 'bob01' }]}
        onQueryChange={() => {}} onSearch={() => {}} onSendRequest={() => {}}
      />
    );
    expect(html).toContain('bob01');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/modules/chat/__tests__/friendComponents.test.jsx`
Expected: FAIL（组件模块不存在）。

- [ ] **Step 3: 写三个展示组件**

`src/modules/chat/components/FriendList.jsx`:
```jsx
import React from 'react';

/** 展示型：好友列表。friends=[{id,username}]，点击触发 onSelect(friend)。 */
export function FriendList({ friends, onSelect }) {
  if (!friends || friends.length === 0) {
    return <p className="text-sm text-ink-muted px-2 py-4">还没有好友，去上面搜索添加吧。</p>;
  }
  return (
    <ul className="space-y-1">
      {friends.map((f) => (
        <li key={f.id}>
          <button
            type="button"
            onClick={() => onSelect?.(f)}
            className="w-full text-left px-3 py-2 rounded hover:bg-zinc-100 text-ink"
          >
            {f.username}
          </button>
        </li>
      ))}
    </ul>
  );
}

export default FriendList;
```

`src/modules/chat/components/FriendRequests.jsx`:
```jsx
import React from 'react';

/** 展示型：收到的好友申请。requests=[{id,fromUser,fromUsername,createdAt}]。 */
export function FriendRequests({ requests, onAccept, onReject }) {
  if (!requests || requests.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-ink-muted">好友申请</h3>
      <ul className="space-y-2">
        {requests.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded bg-amber-50">
            <span className="text-ink">{r.fromUsername}</span>
            <span className="flex gap-2">
              <button type="button" onClick={() => onAccept?.(r)} className="text-sm text-green-700">同意</button>
              <button type="button" onClick={() => onReject?.(r)} className="text-sm text-red-600">拒绝</button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default FriendRequests;
```

`src/modules/chat/components/AddFriend.jsx`:
```jsx
import React from 'react';

/**
 * 展示型：搜索 + 添加好友。受控（query/results 由父组件传入）。
 * onQueryChange(value) / onSearch() / onSendRequest(user)
 */
export function AddFriend({ query, results, onQueryChange, onSearch, onSendRequest }) {
  return (
    <div className="space-y-2">
      <form
        className="flex gap-2"
        onSubmit={(e) => { e.preventDefault(); onSearch?.(); }}
      >
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange?.(e.target.value)}
          placeholder="用户名或邮箱"
          className="flex-1 px-3 py-2 rounded border border-zinc-300 text-ink"
        />
        <button type="submit" className="px-3 py-2 rounded bg-amber-600 text-white">搜索</button>
      </form>
      {results && results.length > 0 && (
        <ul className="space-y-1">
          {results.map((u) => (
            <li key={u.id} className="flex items-center justify-between px-3 py-2 rounded hover:bg-zinc-100">
              <span className="text-ink">{u.username}</span>
              <button type="button" onClick={() => onSendRequest?.(u)} className="text-sm text-amber-700">添加</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default AddFriend;
```

- [ ] **Step 4: 运行组件测试确认通过**

Run: `npx vitest run src/modules/chat/__tests__/friendComponents.test.jsx`
Expected: PASS（2 + 1 + 2 个用例）。

- [ ] **Step 5: 写 ChatRoute 容器**

`src/modules/chat/ChatRoute.jsx`:
```jsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useShell } from '../../shell/ShellContext';
import { ROUTES } from '../../shell/paths';
import { friendService } from '../../services/friendService';
import { AddFriend } from './components/AddFriend';
import { FriendRequests } from './components/FriendRequests';
import { FriendList } from './components/FriendList';

/**
 * ChatRoute — 好友管理页（Phase 1）。
 * Phase 2 起右侧会接入会话窗；当前仅好友/申请/搜索。
 * 游客（无真实 user）看到登录引导。
 *
 * 认证：用 useShell().api('cf-workers') 拿到已注入 Authorization 的客户端。
 */
export default function ChatRoute() {
  const { user, navigate, api: shellApi } = useShell();
  const api = useMemo(() => shellApi('cf-workers'), [shellApi]);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [requests, setRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const [rq, fl] = await Promise.all([
        friendService.listRequests(api),
        friendService.listFriends(api),
      ]);
      setRequests(rq.requests || []);
      setFriends(fl.friends || []);
    } catch (e) {
      setError(e.message);
    }
  }, [api, user]);

  useEffect(() => { refresh(); }, [refresh]);

  const onSearch = useCallback(async () => {
    try {
      const res = await friendService.searchUsers(api, query);
      setResults(res.results || []);
    } catch (e) { setError(e.message); }
  }, [api, query]);

  const onSendRequest = useCallback(async (u) => {
    try {
      await friendService.sendRequest(api, u.id);
      setResults((prev) => prev.filter((r) => r.id !== u.id));
      await refresh();
    } catch (e) { setError(e.message); }
  }, [api, refresh]);

  const onAccept = useCallback(async (r) => {
    try { await friendService.respond(api, r.id, 'accept'); await refresh(); }
    catch (e) { setError(e.message); }
  }, [api, refresh]);

  const onReject = useCallback(async (r) => {
    try { await friendService.respond(api, r.id, 'reject'); await refresh(); }
    catch (e) { setError(e.message); }
  }, [api, refresh]);

  if (!user) {
    return (
      <div className="mac-app-shell min-h-screen flex items-center justify-center bg-bg">
        <div className="text-center space-y-3">
          <p className="text-ink">好友功能需要登录</p>
          <button type="button" onClick={() => navigate(ROUTES.LOGIN)} className="px-4 py-2 rounded bg-amber-600 text-white">
            去登录
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mac-app-shell min-h-screen bg-bg text-ink">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">好友</h1>
          <button type="button" onClick={() => navigate(ROUTES.HOME)} className="text-sm text-ink-muted">返回</button>
        </header>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <AddFriend
          query={query} results={results}
          onQueryChange={setQuery} onSearch={onSearch} onSendRequest={onSendRequest}
        />
        <FriendRequests requests={requests} onAccept={onAccept} onReject={onReject} />
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-ink-muted">我的好友</h2>
          <FriendList friends={friends} onSelect={() => { /* Phase 2: 打开会话 */ }} />
        </section>
      </div>
    </div>
  );
}
```

> ✅ **认证方式（已确认）**：`useShell()` 暴露的是 `api(backendKey)`（非裸 token）。它返回 `createApiClient` 客户端，token 来自 `localStorage`（`src/utils/authToken.js`），由客户端自动附加 `Authorization`。`friendService` 各方法首参即此 api 客户端。无需手动取 token。

- [ ] **Step 6: 全量构建验证**

Run: `npm run build`
Expected: 构建成功，无 “could not resolve” 错误（ChatRoute、组件、描述符 lazy import 都已就位）。`scripts/check-build.mjs` 不报 localhost 泄漏。

- [ ] **Step 7: Commit（含 Task 5 的常量与描述符）**

```bash
git add src/shell/paths.js src/modules/chat/
git commit -m "feat(chat): chat module UI — AddFriend/FriendRequests/FriendList + ChatRoute"
```

---

## Task 7: 接入 Registry + 首页卡片（游客隐藏）

**Files:**
- Modify: `src/shell/ModuleRegistry.js`
- Modify: `src/components/Dashboard.jsx`
- Modify: `src/modules/home/HomeRoute.jsx`

- [ ] **Step 1: 注册模块**

修改 `src/shell/ModuleRegistry.js`：
```js
import chat from '../modules/chat';
```
并把 `chat` 加入数组（放在 novel 之后）：
```js
const modules = [home, auth, werewolf, novel, chat, chords, sites];
```

- [ ] **Step 2: HomeRoute 加回调**

修改 `src/modules/home/HomeRoute.jsx`：在其它 `onEnterX` 回调旁新增：
```js
  const onEnterChat = useCallback(() => navigate(ROUTES.CHAT), [navigate]);
```
并把 `onEnterChat` 透传给 `<Dashboard .../>`（在 props 列表里加 `onEnterChat={onEnterChat}`）。

- [ ] **Step 3: Dashboard 加卡片（游客隐藏）**

修改 `src/components/Dashboard.jsx`：
1. 在组件 props 解构里（约第 49-53 行 `onEnterNovel,` 附近）加入 `onEnterChat,`。
2. 在按钮区（约第 215 行 `onEnterNovel` 按钮附近），紧随其后新增——**仅非游客显示**：
```jsx
                {!isGuestMode && (
                  <button type="button" onClick={onEnterChat} className="mac-button mac-button-secondary">
                    好友
                  </button>
                )}
```
> `isGuestMode` 已是 Dashboard 的现有 prop（见第 65 行附近用法）。

- [ ] **Step 4: 构建 + 现有测试回归**

Run:
```bash
npm run build
npm test
```
Expected: 构建成功；`npm test` 全绿（新增的 friendsLib/friendService/friendComponents 测试通过，且未破坏既有测试）。

- [ ] **Step 5: 手动端到端验证**

Run: `npm run dev`（Vite，端口 3000，`/api` 代理到 zhaxiaoji.com；如需打本地 Worker，临时把代理 target 指向 `http://localhost:8787` 并同时跑 `npm run dev:worker`）。

浏览器核对清单：
1. 用真实账号登录 → 首页能看到「好友」卡片。
2. 退出登录走游客模式 → 首页**看不到**「好友」卡片。
3. 游客直接访问 `/chat` → 显示「好友功能需要登录」+ 去登录按钮。
4. 登录后进 `/chat` → 搜索另一账号用户名 → 出现结果 → 点「添加」。
5. 另一账号登录 → `/chat` 顶部出现好友申请 → 点「同意」。
6. 双方好友列表互相出现对方用户名。

- [ ] **Step 6: Commit**

```bash
git add src/shell/ModuleRegistry.js src/components/Dashboard.jsx src/modules/home/HomeRoute.jsx
git commit -m "feat(chat): register chat module + home card (hidden for guests)"
```

---

## Task 8: 生产迁移 + 收尾

- [ ] **Step 1: 应用生产库迁移**

> 仅在以上全部本地验证通过后执行。
Run: `npx wrangler d1 execute wolfgame-db --remote --file=./migrations/004_friendships.sql`
Expected: 成功，无错误。

- [ ] **Step 2: 更新 CHANGELOG**

在 `CHANGELOG.md` 顶部按项目规范加一条 `## [2026-06-XX] 好友系统 Phase 1`，列出新功能与文件变更。

- [ ] **Step 3: 部署（按 CLAUDE.md 流程）**

Run: `npm run deploy`
随后跑 CLAUDE.md「部署后 fingerprint check」确认 prod = local，且 bundle 无 localhost。

- [ ] **Step 4: Commit + push**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog for friend system phase 1"
git push origin main
```

---

## Self-Review 记录

- **Spec 覆盖**：好友表(§4 friendships/friend_requests)→Task1；REST(§5.1 search/request/requests/respond/friends)→Task3；前端模块结构(§6)→Task5/6；首页集成+游客隐藏(§6/§2)→Task7；`requiresAuth`+游客引导(§2)→Task6 ChatRoute。chat_messages 表、`/api/chat/*`、WS、视频属 Phase 2/3，本计划不含（按 §10 分阶段）。
- **占位符**：无 TBD/TODO 式步骤；每步含完整代码或可执行命令。两处显式标注的「依赖核对」（`useShell().token`、`handleUserSearch` 签名笔误修正）是落地确认项，非占位。
- **类型/命名一致**：服务方法 `searchUsers/sendRequest/listRequests/respond/listFriends` 在 friendService、测试、ChatRoute 三处一致；handler 名 `handleUserSearch/handleFriendRequest/handleFriendRequestsList/handleFriendRespond/handleFriendsList` 在 friends.js 与 index.js import 一致；返回字段 `results/requests/friends/status` 前后端一致。
- **已知落地确认项**（实现者开工先确认）：`src/services/api/registry.js` 中 `cf-workers` 后端的 `baseUrl` 解析为同源 / `https://zhaxiaoji.com`（chat 描述符 `backend:'cf-workers'`，dev 下经 Vite 代理）。`handleUserSearch` 签名 `(request, env)`、前端认证用 `useShell().api` —— 均已在本计划内修正，无遗留歧义。
