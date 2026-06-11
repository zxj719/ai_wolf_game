# 家庭网球公开赛模块 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把单文件网球小游戏移植为 React 模块（/tennis），接入用户系统，D1 全网排行榜。

**Architecture:** 前端新增 `src/modules/tennis/`（ModuleRegistry 注册，自带作用域 CSS）；后端 `workers/auth/tennis.js`（纯校验逻辑拆 `tennisLib.js` 便于 vitest）；D1 新表 `tennis_matches`。游客全功能游玩 + localStorage 本地榜；登录用户赛后自动上传。

**Tech Stack:** React 18 + useReducer、TailwindCSS（仅外壳，游戏区用原版 CSS）、CF Workers + D1、vitest。

**Spec:** `docs/superpowers/specs/2026-06-11-tennis-module-design.md`

---

### Task 1: 后端校验纯逻辑 `tennisLib.js`（TDD）

**Files:**
- Create: `workers/auth/tennisLib.js`
- Test: `workers/auth/__tests__/tennisLib.test.js`

- [ ] **Step 1: 写失败测试** — 覆盖：合法 payload 通过并归一化；非法盘分（1-1、2-2、3-0）、未知角色、自己打自己、反应时间 <80 / 非数字、非法 grade 各自拒绝。

- [ ] **Step 2: `npx vitest run workers/auth/__tests__/tennisLib.test.js`** 预期 FAIL（模块不存在）。

- [ ] **Step 3: 实现 `validateTennisRecord(body)`** — 返回 `{ ok: true, record }` 或 `{ ok: false, error }`，白名单角色表与前端 CHARS 一致。

- [ ] **Step 4: 重跑测试** 预期 PASS。

- [ ] **Step 5: Commit** `feat(tennis): 后端战绩校验纯逻辑`

### Task 2: 后端 API `tennis.js` + 路由

**Files:**
- Create: `workers/auth/tennis.js`
- Modify: `workers/auth/index.js`（import + 2 条路由，加在 game 端点附近）

- [ ] handleTennisRecord：authMiddleware → validateTennisRecord → INSERT tennis_matches → 201
- [ ] handleTennisLeaderboard：公开；players 聚合 TOP 50（胜场 DESC → 胜率 DESC → best_ms ASC，last_face 用相关子查询）+ recent 20（join users）
- [ ] `node --check workers/auth/tennis.js` & `node --check workers/auth/index.js`
- [ ] Commit `feat(tennis): /api/tennis/record + /api/tennis/leaderboard`

### Task 3: 数据库迁移

**Files:**
- Create: `migrations/006_tennis.sql`（按 spec 的 DDL）
- Modify: `schema.sql`（追加同样的表，保持 schema.sql 为全量基准）

- [ ] 写 006_tennis.sql + schema.sql 同步
- [ ] Commit `feat(tennis): tennis_matches 迁移`

### Task 4: 游戏数据与状态机（TDD）

**Files:**
- Create: `src/modules/tennis/gameData.js`（CHARS/PREP/SETS/ENDINGS/FXNAME/gradeFromMs 原样搬运）
- Create: `src/modules/tennis/useTennisGame.js`（纯 reducer + initialState；随机数由 action payload 注入保持纯函数）
- Test: `src/modules/tennis/__tests__/tennisReducer.test.js`

- [ ] **Step 1: 失败测试** — START 装载玩家与对手；SET_REACTION 按 ms 定级（249→S/90，599→B/50）；PICK_PREP 应用加点且不低于 0、4 轮后进 match；PLAY_SCENE 比大小（平分主队胜）；NEXT_SCENE 盘分推进、1:1 跳决胜盘（setIdx=2）、2 盘定胜负进 result；REPLAY 回 select。
- [ ] **Step 2: 跑测试 FAIL**
- [ ] **Step 3: 实现 reducer**（数值规则与原版 1:1：d20 vs d12、talent*0.4 加成、决胜盘总战力）
- [ ] **Step 4: 跑测试 PASS**
- [ ] **Step 5: Commit** `feat(tennis): 游戏状态机移植（数值 1:1）`

### Task 5: 前端服务 + 本地榜

**Files:**
- Create: `src/services/tennisService.js`（仿 gameService.js：getToken + buildApiUrl；saveTennisRecord / getTennisLeaderboard）
- Create: `src/modules/tennis/localBoard.js`（localStorage 'family_tennis_open_records' 读写，原版降级语义）

- [ ] 实现两个文件，commit `feat(tennis): 战绩服务与本地榜`

### Task 6: UI 组件 + 样式

**Files:**
- Create: `src/modules/tennis/tennis.css`（原版 CSS 全量，选择器统一加 `.tennis-scope` 前缀；body→`.tennis-scope`，body::before→`.tennis-scope::before`）
- Create: `src/modules/tennis/components/{SelectScreen,ReactTest,PrepScreen,MatchScreen,ResultScreen,Leaderboard,Toast}.jsx`
- Create: `src/modules/tennis/TennisRoute.jsx`（useReducer 装配 + 字体注入 + 全网榜加载 + 赛后上传 effect）

- [ ] 移植五屏组件（交互细节：反应测试偷跑判罚、空格键、ball 随机位置；备战 420ms 自动下一轮；比赛 battle log + 下一球/结算按钮文案切换）
- [ ] ResultScreen：登录→saveTennisRecord（失败 toast 降级）；游客→仅本地 + 「登录上全网榜」按钮
- [ ] `npm run build` 通过
- [ ] Commit `feat(tennis): 五屏 UI 移植 + 夜场网球主题`

### Task 7: 平台接线

**Files:**
- Modify: `src/shell/paths.js`（ROUTES.TENNIS = '/tennis'）
- Create: `src/modules/tennis/index.js`（ModuleDescriptor，order 25）
- Modify: `src/shell/ModuleRegistry.js`（import + modules 数组）
- Modify: `src/modules/home/HomeRoute.jsx`（onEnterTennis）
- Modify: `src/components/Dashboard.jsx`（🎾 家庭网球按钮，Medal 图标）

- [ ] 接线 + `npm run build` + `npm run test`
- [ ] Commit `feat(tennis): 注册 /tennis 模块与首页入口`

### Task 8: 本地验证

- [ ] `npm run dev` + /browse 走通完整一局：选角→反应→备战 4 轮→三局两胜→结算→本地榜入榜；截图存 .tmp/
- [ ] 验证游客提示文案与全网榜空态

### Task 9: 部署上线

- [ ] `npx wrangler d1 execute wolfgame-db --remote --file=migrations/006_tennis.sql`
- [ ] `npm run build` → `npm run deploy`（脚本已含 .wrangler/state 清理与 inject-html 还原）
- [ ] Fingerprint：walk index → TennisRoute 懒加载 chunk 链，确认 prod = local；grep localhost = 0
- [ ] 线上 /browse 验证 /tennis 可玩 + `curl /api/tennis/leaderboard` 返回 200

### Task 10: 收尾

- [ ] CHANGELOG.md 顶部加变更记录
- [ ] `git push origin main`
