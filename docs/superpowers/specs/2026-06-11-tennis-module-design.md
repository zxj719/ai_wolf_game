# 家庭网球公开赛模块 — 设计文档

日期：2026-06-11
状态：已批准（全部实施并部署上线）

## 背景

把单文件小游戏《家庭网球公开赛 · 相爱相杀前传》（`家庭网球公开赛 v2(1).html`，784 行纯前端）
整合进 zhaxiaoji.com 主站，作为与狼人杀、音乐实验室平级的首页模块，并接入用户系统，
实现跨用户的全网排行榜（D1 存储）。

## 已确认决策

1. **整合方式**：移植为 React 模块（`src/modules/tennis/`），不用 iframe / 静态页。
2. **游客策略**：游客可完整游玩，成绩只存 localStorage（本地"家族榜"保留）；
   登录用户成绩自动上传全网榜。游客视角全网榜只读 + 登录提示。
3. **榜单身份**：`用户名（角色 emoji）`——同时记录账号与本局所选家庭角色。

## 前端设计

### 模块结构

```
src/modules/tennis/
├── index.js            # ModuleDescriptor：id 'tennis'，路由 /tennis，requiresAuth: false
├── TennisRoute.jsx     # 路由壳：屏幕切换 + 全局布局 + 字体注入
├── tennis.css          # 原版样式整体移植，所有选择器加 .tennis-scope 前缀
├── useTennisGame.js    # useReducer 状态机（游戏数值逻辑与原版 1:1）
├── gameData.js         # CHARS / PREP / SETS / ENDINGS 常量原样搬运
└── components/
    ├── SelectScreen.jsx   # ① 报名选角 + 本地家族榜 + 全网榜
    ├── ReactTest.jsx      # ② 反应测试（点击/空格，偷跑判罚）
    ├── PrepScreen.jsx     # ③ 4 轮备战加点 + 属性面板
    ├── MatchScreen.jsx    # ④ 记分牌 + 三局两胜对决
    ├── ResultScreen.jsx   # ⑤ 结局 + 战报 + 双榜
    └── Leaderboard.jsx    # 全网榜 + 本地榜渲染
```

### 关键点

- **数值逻辑不改**：反应分级（<250ms=S/90 … ≥600ms=C/30）、备战加点表、
  d20 vs d12 主场加成、平分鹰眼判主队胜、决胜盘总战力对决，全部照搬。
- **样式隔离**：`tennis.css` 顶层包 `.tennis-scope`，避免污染主站 token；
  ZCOOL KuaiLe / JetBrains Mono 字体 link 在 TennisRoute 挂载时注入 `<head>`（幂等）。
- **路由接入**：`paths.js` 加 `TENNIS: '/tennis'`；`ModuleRegistry.js` 注册；
  `Dashboard.jsx` 入口按钮区加「🎾 家庭网球」；`HomeRoute.jsx` 加 `onEnterTennis`。
- **赛后上传**：登录态（`useAuth().user` 存在）→ `POST /api/tennis/record`；
  失败静默降级为仅本地保存（toast 提示）。游客 → 仅 localStorage（沿用原 key
  `family_tennis_open_records`，老玩家本地数据无损）。

## 后端设计

### `workers/auth/tennis.js`（仿 friends.js 独立文件模式）

| 端点 | 方法 | 认证 | 行为 |
|------|------|------|------|
| `/api/tennis/record` | POST | JWT（authMiddleware） | 校验后写入 `tennis_matches` |
| `/api/tennis/leaderboard` | GET | 公开 | 聚合榜 + 最近战报 |

### 服务端校验（防伪造的唯一防线）

- `setsWon`/`setsLost` ∈ {0,1,2}，且恰有一方 = 2，另一方 < 2
- `reactionMs` 为 null 或 80–10000 之间的整数（<80ms 超人类反应，拒绝）
- `character`/`opponent` 必须在 7 人角色白名单内，且二者不同
- `grade` ∈ {S,A,B,C}
- 超限 → 400；不做更重的反作弊（家庭娱乐场景）

### 响应结构

```jsonc
// GET /api/tennis/leaderboard
{
  "players": [   // 按 胜场 DESC → 胜率 DESC → 最快反应 ASC，TOP 50
    { "username": "...", "wins": 3, "games": 5, "winRate": 60.0,
      "bestMs": 213, "bestGrade": "S", "lastFace": "🐯", "lastCharacter": "诚" }
  ],
  "recent": [    // 最近 20 场
    { "username": "...", "character": "诚", "face": "🐯", "opponent": "Elza",
      "opponentFace": "🦊", "setsWon": 2, "setsLost": 1, "reactionMs": 213,
      "grade": "S", "createdAt": "..." }
  ]
}
```

## 数据库

`migrations/006_tennis.sql`：

```sql
CREATE TABLE IF NOT EXISTS tennis_matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  character TEXT NOT NULL,
  character_face TEXT,
  opponent TEXT NOT NULL,
  opponent_face TEXT,
  sets_won INTEGER NOT NULL,
  sets_lost INTEGER NOT NULL,
  reaction_ms INTEGER,
  grade TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_tennis_matches_user ON tennis_matches(user_id);
CREATE INDEX IF NOT EXISTS idx_tennis_matches_created ON tennis_matches(created_at DESC);
```

用户名通过 join `users` 取得，不冗余存储（与 game_history 模式一致）。

## 错误处理

- 上传失败（网络/401/校验）：toast「成绩已存本地，上传失败」，本地照常入榜。
- 榜单加载失败：显示本地榜 + 重试按钮，不阻塞游戏。
- 游客点全网榜区域的「登录上榜」→ 跳 `/login`。

## 测试与验证

- `npm run build` 必须过（含 check-build.mjs 静态守门）。
- 本地 `npx playwright`/browse 走通：选角 → 反应测试 → 备战 → 比赛 → 结算 → 本地榜入榜。
- 后端：本地 curl 校验 record 各非法 payload 返回 400、合法返回 201、leaderboard 返回聚合结构。

## 部署清单

1. `wrangler d1 migrations apply`（远程）执行 006
2. `npm run build` → 清 `.wrangler/state` → `npm run deploy`
3. CLAUDE.md fingerprint 校验：walk index → 懒加载 chunk 链，确认 prod = local
4. prod bundle grep localhost 必须 0
