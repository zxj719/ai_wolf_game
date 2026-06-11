# 网球可玩性升级 v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 /tennis 升级为宝可梦式网球对战 + StS 牌库 + 装备养成 + 双模式（家族挑战/奇幻闯关），按 A→B→C 三段各自上线。

**Architecture:** 三层纯函数状态机（battleReducer 球级 / scoring 局盘级 / ladder·adventureReducer 赛程级），全部随机数经 action 注入；小游戏组件统一 `onDone(multiplier)` 契约；永久层 D1+localStorage 双写。v1 五屏与排行榜保留，单局快打换装新内核。

**Tech Stack:** React 18 useReducer、vitest（纯函数 TDD）、puppeteer-core E2E、CF Workers + D1（仅 B 段动后端）。

**Spec:** `docs/superpowers/specs/2026-06-11-tennis-playability-v2-design.md`（数值表以 spec 为准，本计划不重复全部数值）

---

## A 段：共享对战内核（上线物=单局快打全面升级）

### Task A1: 招式与克制数据 `battle/moves.js`（TDD）

**Files:** Create `src/modules/tennis/battle/moves.js`；Test `src/modules/tennis/battle/__tests__/moves.test.js`

- [ ] 失败测试：`MOVES` 含 spec §1.2 全部 8 招（id/name/system/stat/energyCost/minigame）；`counterMultiplier(a,b)` 覆盖 §1.3 全部克制对（四循环 4 对 + 网前组 5 对）返回 1.5，反向 0.7，无关 1.0，同招 1.0；`CHAR_BUILDS` 七人配招与 §1.7 一致且招式 id 合法；`ULTIMATES` 七绝技效果字段（type: 'autoCounter'|'reveal'|'drainEnergy'|...）结构校验
- [ ] 跑测试 FAIL → 实现 → PASS
- [ ] Commit `feat(tennis-v2): 招式池/克制表/配招/绝技数据`

### Task A2: 真实记分状态机 `battle/scoring.js`（TDD）

**Files:** Create `src/modules/tennis/battle/scoring.js`；Test `.../battle/__tests__/scoring.test.js`

- [ ] `createScore()` + `addPoint(score, who)` 纯函数。失败测试：0→15→30→40→局；40-40 进 Deuce；占先后失分回平分；平分封顶 2 次后第 3 次 40-40 触发 `goldenPoint: true`（一分定局）；3 局成盘；1:1 盘后第三盘；2 盘先取者 `matchOver`；局间 `restEnergy: 10`、盘间 `30` 字段
- [ ] FAIL → 实现 → PASS → Commit `feat(tennis-v2): 真实记分 lite 状态机`

### Task A3: 牌库系统 `battle/cards.js`（TDD）

**Files:** Create `src/modules/tennis/battle/cards.js`；Test `.../battle/__tests__/cards.test.js`

- [ ] `CARDS`：spec §1.5 表全部 12 张（id/cost/effect/upgraded 变体）。`createDeckState(cardIds, rng)`、`drawCard(deck)`（牌库空→弃牌堆洗回，注入 rng 洗牌）、`playCard(state, cardId)`（战术点不足报错、效果入 `pendingEffects`）、战术点每球 +1 上限 3。测试：抽空洗回、爆手牌（>5）弃置、费用校验、升级版效果数值
- [ ] FAIL → 实现 → PASS → Commit `feat(tennis-v2): StS 式战术牌库`

### Task A4: 对手 AI `battle/opponentAI.js`（TDD）

**Files:** Create `src/modules/tennis/battle/opponentAI.js`；Test `.../battle/__tests__/opponentAI.test.js`

- [ ] `pickOpponentMove(personality, energy, rngRoll)`：按性格权重选招，体力不足的招剔除后归一化；`makeTell(move, truthRoll)`：75% 真实（rngRoll<0.75 时提示真招），假提示从其它招随机；每招一条提示文案表。测试：权重边界、力竭时强攻被剔除、真假提示比例逻辑
- [ ] FAIL → 实现 → PASS → Commit `feat(tennis-v2): 性格化对手 AI 与读招提示`

### Task A5: 球级状态机 `battle/battleReducer.js`（TDD，本段核心）

**Files:** Create `src/modules/tennis/battle/battleReducer.js`；Test `.../battle/__tests__/battleReducer.test.js`

- [ ] 状态：`{ phase: 'serve'|'cards'|'pick'|'minigame'|'resolve', pEnergy, oEnergy, deck, tacticalPoints, pendingEffects, ultimateUsed, lastRally, score }`。Actions（随机量全注入）：`SERVE_DONE{result}` / `DRAW_AND_RAMP{shuffleRng}` / `PLAY_CARD{cardId}` / `PICK_MOVE{moveId}` + `OPPONENT_MOVE{moveId}` / `MINIGAME_DONE{multiplier}` / `RESOLVE{noise}`（按 spec §1.4 公式合成威力：属性+装备+talent×0.4 → 体力档惩罚 → 克制 → 小游戏倍率 → 卡牌修正 → 噪声）/ `USE_ULTIMATE{id}`。测试至少覆盖：克制倍率进公式、体力三档惩罚与禁招、ACE 直接得分、卡牌修正（换新球/拍线调整/金球时刻）、绝技各效果、得分进 scoring 推进
- [ ] FAIL → 实现 → PASS → Commit `feat(tennis-v2): 球级对决状态机`

### Task A6: 小游戏组件族 `battle/minigames/`

**Files:** Create `.../minigames/{ServeTiming,DirectionReact,RhythmMash,WhackVolley,ShrinkSmash,PrecisionStop,GaugeDrop,DualTiming}.jsx` + `index.js`（招式 id→组件映射）+ `MinigameShell.jsx`（倒计时框+结果文案）

- [ ] 统一契约 `<X onDone={(m)=>} timeScale windowBonus />`，输出 0.5–1.5；判定全部用 `performance.now()` 时间戳；`prefers-reduced-motion` 时 windowBonus+0.3。每个组件 2–4 秒一局。时间戳判定函数抽成纯函数进 vitest（如 `scoreTiming(clickTs, targetTs, window)`）
- [ ] `npm run build` 通过 → Commit `feat(tennis-v2): 八招小游戏组件族`

### Task A7: 对战 UI `battle/BattleScreen.jsx`

**Files:** Create `.../battle/BattleScreen.jsx` + `components/{ScorePanel,EnergyBar,HandCards,MovePicker,RallyLog}.jsx`；Modify `tennis.css`（新增牌面/体力条/招式按钮样式，继续 `.tennis-scope` 前缀）

- [ ] 布局：顶部真实记分牌（15/30/40/Deuce）+ 双体力条；中部对决日志（克制文案"效果拔群！"）；下部手牌横排（费用角标，点击打出）+ 4 招按钮（耗体/系别图标，力竭灰禁）+ 绝技按钮；tell 文案显示在对手头像气泡。props 全部来自 battleReducer state + dispatch，无内部业务逻辑
- [ ] build 通过 → Commit `feat(tennis-v2): 对战界面`

### Task A8: 单局快打接入新内核

**Files:** Modify `TennisRoute.jsx`（match 屏换 BattleScreen，赛后沿用 v1 ResultScreen/上传逻辑，reactionMs/grade 继续上报）；Modify `useTennisGame.js`（match 阶段委托新内核，备战/选角/反应测试屏保留）；单局发 4 张体验牌

- [ ] 全量 `npm run test` 无回归 → build → Commit `feat(tennis-v2): 单局快打切换新对战内核`

### Task A9: A 段验证 + 部署

- [ ] puppeteer-core E2E：完整一场（发球小游戏→打牌→出招→小游戏→真实记分推进→盘→赛→上传断言），脚本存 `.tmp/tennis-v2-e2e-a.mjs`
- [ ] `npm run deploy` + fingerprint 校验（walk TennisRoute chunk）+ prod 冒烟 → Commit + push + CHANGELOG 段落

## B 段：永久养成 + 家族挑战（上线物=装备/商店/挑战模式/榜单新列）

### Task B1: 装备数据与逻辑 `meta/equipment.js`（TDD）

- [ ] `EQUIPMENT_SLOTS` 5 槽 × `RARITIES` 4 档数值（spec §2.1 表）；`rollDrop(source, rng)` 掉落（胜高一档概率/败保底）；`upgradeCost(rarity)` 50/120/300；`applyEquipment(stats, equipped)` 合成属性加成与挂件特效字段。测试覆盖掉落概率边界、升级路径、特效字段
- [ ] FAIL→实现→PASS → Commit

### Task B2: 后端 progress（TDD 仿 v1 模式）

**Files:** Create `workers/auth/tennisProgressLib.js`（白名单校验纯函数）+ `__tests__/tennisProgressLib.test.js`；Modify `workers/auth/tennis.js`（+`handleGetTennisProgress`/`handlePutTennisProgress`）、`workers/auth/index.js`（2 路由）；Create `migrations/007_tennis_v2.sql`（spec §2.3 表）+ schema.sql 同步

- [ ] 校验测试：装备/成就/绝技 id 枚举外拒绝、coins 增量 >500 拒绝、championships 回退拒绝；GET 无记录返回默认结构
- [ ] FAIL→实现→PASS → `node --check` → Commit

### Task B3: 前端进度仓 `meta/progressStore.js` + service

- [ ] `src/services/tennisService.js` 加 `getTennisProgress/putTennisProgress`；progressStore：登录=D1 读+本地缓存+变更后 PUT（失败留 dirty 标记下次重试），游客=纯 localStorage（key `tennis_v2_progress`）；纯合并函数 `mergeProgress(local, remote)`（last-write-wins，unlock 集合并）进 vitest
- [ ] Commit

### Task B4: 家族挑战状态机 `modes/ladderReducer.js`（TDD）

- [ ] 梯度生成（6 对手排除玩家角色，属性带 40-50 起每场 +8）、赛间三选一（特训 +8 随机属性/按摩 +30 体/进店标记）、败北终局结算（已得装备金币保留）、6 胜 `championships+1` + 击败者绝技入 unlock 集；sessionStorage 快照（中途退出可恢复，与闯关同一快照工具函数）。测试覆盖推进/中断/解锁/恢复
- [ ] FAIL→实现→PASS → Commit

### Task B5: 商店组件 `meta/ShopPanel.jsx` + 挑战 UI `modes/LadderScreen.jsx`

- [ ] ShopPanel 五项服务（购卡 3 选 1/升卡/购装 3 件/升装/删卡，金币扣减走 progressStore），B 段用于赛间，C 段复用为商店节点；LadderScreen：6 站进度条 + 对手卡片（性格/流派预览）+ 赛间三选一界面；TennisRoute 加模式选择屏（单局快打/家族挑战）；备战屏加绝技换装下拉（图鉴已解锁的非本命绝技可选 1 个替换出战）
- [ ] build → Commit

### Task B6: 成就 + 榜单新列

- [ ] `meta/achievements.js` 定义 spec §2.2 八成就 + 触发检查纯函数（测试）；后端 leaderboard SQL join tennis_progress 加 championships/adventure_clears；前端 Leaderboard 加「👑/🗺️」列
- [ ] FAIL→实现→PASS → Commit

### Task B7: B 段验证 + 部署

- [ ] 远程跑 migration 007 → E2E（家族挑战打 2 场：掉装断言/商店购卡/败北结算）→ deploy + fingerprint + prod 冒烟（progress API 401/200）→ CHANGELOG + push

## C 段：奇幻闯关（上线物=完整双模式）

### Task C1: 地图生成 `modes/adventure/mapGen.js`（TDD）

- [ ] 三章每章 4–5 节点 2–3 分叉（rng 注入），节点类型权重（对战 40%/事件 30%/商店 15%/休息 15%），章末固定精英、终章 BOSS。测试：任意 seed 必存在起点→BOSS 通路、节点数边界、精英/BOSS 固定位
- [ ] FAIL→实现→PASS → Commit

### Task C2: 离谱对手与规则扭曲（TDD）

- [ ] `modes/adventure/oddOpponents.js`：spec §4.3 六对手（配招复用 MOVES + 自定义 face/名台词）；扭曲实现为 battleReducer 已留的 `twists` 配置（`mindImmune`/`timeScale:0.7`/`powerReflect:0.3`/`forcedMindDuel:3`/`predictable`/`bossPhaseSwap`），battleReducer 补 twists 处理 + 测试每条扭曲
- [ ] FAIL→实现→PASS → Commit

### Task C3: 事件小游戏 + 事件表

- [ ] `modes/adventure/events.js`：4 个事件小游戏（火锅捞丸子=限时连点/躲蒲扇=节奏判定/失重颠球=区间保持/打坐数息=精准计时，复用 MinigameShell 契约但输出奖励档 0–2）+ 8 条剧情二选一事件（文案+奖励：属性/金币/卡/装备）；奖励映射纯函数测试
- [ ] FAIL→实现→PASS → Commit

### Task C4: 闯关状态机 `modes/adventure/adventureReducer.js`（TDD）

- [ ] run 状态：当前章/节点/路径选择/单局层（卡组/属性 buff/临时体力上限）/永久层增量缓冲；节点完成推进、失败结算（永久层保留）、通关 `adventure_clears+1`；sessionStorage 快照恢复。测试覆盖三章推进/失败/通关/恢复
- [ ] FAIL→实现→PASS → Commit

### Task C5: 闯关 UI

- [ ] `modes/adventure/AdventureScreen.jsx`：节点地图（SVG 连线 + 当前位置）、事件屏（剧情文案+选项/小游戏挂载）、章节过场（三章场景文案）、BOSS 战入场动画、通关结算屏（圆回主题文案：奖杯夺回 + 全程所获清单）；模式选择屏加第三项
- [ ] build → Commit

### Task C6: C 段验证 + 部署 + 收尾

- [ ] E2E：闯关走完第一章（事件小游戏 1 个 + 精英战）；全量 test；deploy + fingerprint + prod 冒烟
- [ ] CHANGELOG 总结三段 + push；спec 状态行更新为「已全部上线」

## 全程纪律

- 每 Task 一 commit；每段结束 `npm run test` 全量 + `npm run build` 必绿
- 部署铁律照旧：`.wrangler/state` 清理（deploy 脚本已含）、fingerprint walk 懒加载链、prod grep localhost = 0
- battleReducer 是 A 段地基，B/C 段只许通过 props/config 扩展（twists、装备加成入参），不许改公式语义
