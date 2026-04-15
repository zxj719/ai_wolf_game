# AI 行为树决策系统 — 设计报告

> **版本**：v1.0.0 · **更新日期**：2026-04-15
>
> 本报告描述 wolfgame 项目行为树（Behavior Tree，简称 BT）决策引擎的完整设计，包括节点架构、评分系统、各角色决策树与所有策略变体。

---

## 目录

1. [整体架构](#整体架构)
2. [Blackboard 黑板与派生指标](#blackboard-黑板与派生指标)
3. [核心节点类型](#核心节点类型)
4. [条件节点速查](#条件节点速查)
5. [各角色决策树](#各角色决策树)
   - [村民 — 白天投票](#村民--白天投票)
   - [预言家 — 夜间查验](#预言家--夜间查验)
   - [守卫 — 夜间守护](#守卫--夜间守护)
   - [女巫 — 夜间用药](#女巫--夜间用药)
   - [猎人 — 开枪](#猎人--开枪)
   - [狼人 — 白天投票](#狼人--白天投票)
   - [狼人 — 白天发言（五策略）](#狼人--白天发言五策略)
6. [随机化机制](#随机化机制)
7. [评分系统](#评分系统)
8. [部署集成流程](#部署集成流程)

---

## 整体架构

系统将 AI 决策拆分为**两段式管线**：

```
askAI(player, actionType)
    │
    ▼
┌─────────────────────────────────────────┐
│  Stage 1：BT 决策引擎（纯 JS，< 1ms）  │
│  输入：gameState + player               │
│  输出：{ targetId, strategy, facts[] }  │
└─────────────────────────────────────────┘
    │
    ▼（把"为什么"喂给 LLM）
┌─────────────────────────────────────────┐
│  Stage 2：LLM 润色（语言组织，1–3s）   │
│  输入：strategy + facts + persona       │
│  输出：{ speech, identity_table }       │
└─────────────────────────────────────────┘
```

**决策层**（本文档的主题）运行在 ECS Node.js 服务器上（端口 3001），或在服务不可用时降级到前端本地执行。LLM 润色层**不参与任何决策**，只负责把结构化策略翻译成角色口吻的自然语言。

### 文件布局

```
src/services/decisionEngine/
├── index.js                   # 统一入口
├── core/
│   ├── BehaviorTree.js        # BT 运行时（tick 循环）
│   └── nodes.js               # selector / sequence / condition / action
├── blackboard/
│   ├── buildBlackboard.js     # 从 gameState 构建角色视图
│   └── derivations.js         # 派生指标：嫌疑分、信任分、预言家声明解析
├── conditions/
│   ├── common.js              # 通用条件节点
│   ├── night.js               # 夜间专属条件
│   └── wolf.js                # 狼人专属条件
├── actions/
│   ├── pickVote.js            # 通用投票动作（平民/神职）
│   ├── nightActions.js        # 夜间动作（守卫/预言家/女巫）
│   └── wolfActions.js         # 狼人投票 + 发言策略动作
└── trees/
    ├── villager/vote.js
    ├── werewolf/vote.js
    ├── werewolf/speech.js
    ├── seer/check.js
    ├── guard/protect.js
    ├── witch/potion.js
    └── hunter/shoot.js
```

---

## Blackboard 黑板与派生指标

Blackboard 是决策引擎的"信息总线"，把原始 `gameState` + `player` 转换成结构化的只读视图（`bb.state`），并提供唯一写口 `bb.setDecision(target, reasoning)`。

### 关键字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `self` | Player | 当前 AI 玩家自身信息 |
| `alivePlayers` | Player[] | 所有存活玩家 |
| `aliveIds` | number[] | 存活玩家 ID 列表 |
| `validTargets` | number[] | 当前动作的合法目标（排除自己） |
| `seerClaims` | SeerClaim[] | 从发言历史解析出的预言家声明 |
| `suspicion` | Map\<id, 0-100\> | 每名存活玩家的怀疑分 |
| `trust` | Map\<id, 0-100\> | 每名存活玩家的信任分 |
| `wolfTeammates` | number[] | 仅狼人可见：己方队友 ID |
| `myChecks` | Check[] | 仅预言家可见：自己历史查验结果 |
| `canSave` / `hasPoison` | boolean | 仅女巫可见：药瓶状态 |
| `dyingId` | number\|null | 仅女巫可见：当晚被刀玩家 |
| `cannotGuard` | number | 仅守卫可见：昨晚已守目标（不能连守） |

### 预言家声明解析（`parseSeerClaims`）

从 `speechHistory` 逐条扫描，识别以下信号：

1. **结构化 logicNodes**（优先）：`accuse` + `/狼|查杀/` → 加入 `kills`；`defend` + `/金水|好人/` → 加入 `goldWaters`
2. **文本正则回退**：`查杀\s*N号` / `金水\s*N号`
3. **触发条件**：`claimedRole === '预言家'` 或文本匹配 `/我是预言家|我跳预言家/`

输出格式：
```js
[{ playerId, firstClaimDay, kills: [id, ...], goldWaters: [id, ...] }]
```

---

## 核心节点类型

| 节点 | 行为 |
|------|------|
| `selector(name, children)` | 依次尝试子节点，第一个返回 `true` 则成功（OR 语义） |
| `sequence(name, children)` | 子节点必须全部返回 `true` 才成功（AND 语义） |
| `condition(name, fn)` | 纯判断，不修改 Blackboard |
| `action(name, fn)` | 执行决策，调用 `bb.setDecision()` 并返回 `true/false` |

BT 以**优先级 Selector** 为根节点，从上到下尝试每条 Sequence，第一条成功的路径即为最终决策。

---

## 条件节点速查

### 通用条件（`conditions/common.js`）

| 节点名 | 触发条件 |
|--------|---------|
| `anySeerClaim` | 场上至少有 1 个预言家跳身份 |
| `uniqueSeerWithKill` | 仅 1 个预言家且有查杀目标 |
| `multipleSeerClaims` | 存在 ≥ 2 个预言家（对抗局面） |
| `hasHighSuspicion` | 存在怀疑分 ≥ 40 的目标 |
| `isSelfDeclaredGood` | 自己在某个预言家的金水列表里 |

### 夜间条件（`conditions/night.js`）

| 节点名 | 角色 | 触发条件 |
|--------|------|---------|
| `canGuardSeer` | 守卫 | 唯一跳预言家存活且不是昨晚守护目标 |
| `hasGuardableGoldWater` | 守卫 | 存在公开金水玩家可守（非昨晚目标） |
| `hasUncheckSeerConflict` | 预言家 | 多预言家对抗，至少一个对手尚未被查 |
| `hasUncheckedSuspect` | 预言家 | 有怀疑分 ≥ 30 的未查验目标 |
| `shouldSave` | 女巫 | 有解药且满足救人价值（金水 / 第1夜 / 唯一预言家被刀） |
| `hasPoisonTarget` | 女巫 | 有毒药且存在预言家明确指认的存活查杀目标 |
| `hasPoisonHighSuspicion` | 女巫 | 有毒药且有怀疑分 ≥ 40 的目标（无明确查杀时的次选） |

### 狼人条件（`conditions/wolf.js`）

| 节点名 | 触发条件 |
|--------|---------|
| `seerClaimInValidTargets` | 场上跳预言家且该玩家可投 |
| `goldWaterInValidTargets` | 场上有金水玩家可投 |
| `hasWolfSafeTarget` | 合法目标中存在非队友可选 |
| `noSeerClaimYet` | 场上目前无人声称预言家 |
| `exactlyOneSeerClaim` | 场上恰好有 1 个跳预言家 |
| `hasSpokenWolfTeammate` | 今天已有狼人队友发言 |
| `wolvesInMajority` | 存活狼数量 ≥ 好人数量（狼队占优） |

---

## 各角色决策树

### 村民 — 白天投票

```
Selector [villager_vote]
├── Sequence [投预言家查杀]
│   ├── uniqueSeerWithKill
│   └── action: voteSeerKill         ← 跟唯一预言家的查杀目标
├── Sequence [投可疑对抗预言家]
│   ├── multipleSeerClaims
│   └── action: voteSuspiciousSeer   ← 按嫌疑分选后跳预言家
├── Sequence [投高嫌疑目标]
│   ├── hasHighSuspicion
│   └── action: voteHighestSuspicion ← 嫌疑分最高者，10% 选次高
└── action: voteRandom               ← 兜底随机
```

**硬约束**：排除自己的金水好人（预言家不投自己查验过的好人；普通玩家在单预言家局排除金水）。

---

### 预言家 — 夜间查验

```
Selector [seer_check]
├── Sequence [查对抗预言家]
│   ├── hasUncheckSeerConflict
│   └── action: checkHighestSuspicion ← 多预言家时先验对方
├── Sequence [查高嫌疑目标]
│   ├── hasUncheckedSuspect
│   └── action: checkSuspiciousSeer  ← 嫌疑分 ≥ 30 的未查目标
└── action: checkRandom              ← 兜底随机
```

---

### 守卫 — 夜间守护

```
Selector [guard_protect]
├── Sequence [守公开预言家]
│   ├── canGuardSeer
│   └── action: guardSeerClaimant    ← 唯一预言家存活则优先守
├── Sequence [守公开金水]
│   ├── hasGuardableGoldWater
│   └── action: guardGoldWater       ← 次选金水玩家
└── action: guardRandom              ← 兜底随机（不重复昨晚）
```

---

### 女巫 — 夜间用药

```
Selector [witch_potion]
├── Sequence [使用解药]
│   ├── shouldSave
│   └── action: useSavePotion        ← 救金水/第1夜/唯一预言家
├── Sequence [毒预言家查杀目标]
│   ├── hasPoisonTarget
│   └── action: usePoisonOnSeerKill  ← 直接毒预言家指认的狼
├── Sequence [毒高嫌疑目标]
│   ├── hasPoisonHighSuspicion
│   └── action: usePoisonHighSuspicion ← 次选嫌疑 ≥ 40 目标
└── action: doNothing                ← 本轮不用药
```

---

### 猎人 — 开枪

```
Selector [hunter_shoot]
├── Sequence [打预言家查杀目标]
│   ├── uniqueSeerWithKill
│   └── action: voteSeerKill
├── Sequence [打对抗假预言家]
│   ├── multipleSeerClaims
│   └── action: voteSuspiciousSeer
├── Sequence [打高嫌疑]
│   ├── hasHighSuspicion
│   └── action: voteHighestSuspicion
└── action: voteRandom
```

猎人开枪逻辑复用了村民投票条件/动作，决策规则相同（打最可疑的人）。

---

### 狼人 — 白天投票

**硬约束：永远不投狼人队友。**

```
Selector [werewolf_vote]
├── Sequence [投跳预言家]
│   ├── seerClaimInValidTargets
│   └── action: voteRealSeer         ← 消灭唯一信息源，最高价值
├── Sequence [投金水好人]
│   ├── goldWaterInValidTargets
│   └── action: voteGoldWater        ← 消灭已验证好人
├── Sequence [跟高嫌疑掩护]
│   ├── hasHighSuspicion
│   └── action: voteHighSuspicionForCover ← 顺势跟归票，掩护身份
└── Sequence [随机安全票]
    ├── hasWolfSafeTarget
    └── action: voteRandomNonWolf    ← 兜底
```

---

### 狼人 — 白天发言（五策略）

这是最复杂的决策树，输出一个**策略对象**（不是自然语言），交由 LLM 润色层生成最终发言。

```
Selector [werewolf_speech]
├── Sequence [影随队友]
│   ├── hasSpokenWolfTeammate
│   └── action: strategyShadeTeammate    ← 优先级1
├── Sequence [激进推票]
│   ├── wolvesInMajority
│   └── action: strategyAggressiveVote   ← 优先级2
├── Sequence [对抗跳]
│   ├── counterSeerRandom (80%/20%)
│   └── action: strategyCounterSeer      ← 优先级3
├── Sequence [悍跳]
│   ├── fakeSeerRandom (25%)
│   └── action: strategyFakeSeer         ← 优先级4
└── action: strategyQuietVillager        ← 兜底：深水
```

#### 五种发言策略详解

| 策略 ID | 中文名 | 触发条件 | LLM 收到的 facts |
|---------|--------|---------|----------------|
| `quiet_villager` | 深水潜伏 | 兜底（任何情况） | 平安夜，轻微怀疑某个目标 |
| `shadow_teammate` | 影随队友 | 有狼人队友今天已发言 | 认可队友分析，跟队友立场 |
| `aggressive_lead_vote` | 激进推票 | 狼队存活数 ≥ 好人数 | 指出目标发言破绽，煽动出局 |
| `fake_seer` | 悍跳预言家 | 无人跳预言家 + 25% 随机 | 声称是预言家，捏造查验结果 |
| `counter_seer` | 对抗跳 | 场上有真预言家 + 劣势80%/优势20% | 宣称自己才是真预言家 |

#### `fake_seer` 策略细节

- 优先找**已死的非狼人**作为"声称已查过的对象"（不影响当前局面）
- 找**存活的非队友**作为指认的"查杀目标"
- 输出 `facts`：`["我查X号是好人", "我强烈怀疑Y号是狼"]`

#### `counter_seer` 策略细节

- 直接把真预言家（`seerClaims[0].playerId`）标记为 `voteTarget`
- 随机选一个非队友、非真预言家的存活玩家作为"假金水"
- 在劣势（好人 > 狼人）时以 **80%** 概率触发；在优势时仅 **20%** 触发

---

## 随机化机制

随机化防止 AI 行为过于机械可预测：

| 位置 | 随机度 | 说明 |
|------|--------|------|
| 通用投票 `pickWithJitter` | 10% | 从最优目标切换到次优目标 |
| 狼人发言 `pickSuspectTarget` | 20% | 从最高嫌疑目标切换到次高 |
| 悍跳预言家触发 | 25% | 在无人跳时才可能触发 |
| 对抗跳触发（劣势） | 80% | 形势紧张时高概率跳 |
| 对抗跳触发（优势） | 20% | 形势宽松时低概率跳 |

**设计原则**：随机度足够打破预测性，但不能颠覆主要决策逻辑。核心硬约束（不投队友、不重复守护）永远不参与随机化。

---

## 评分系统

### 怀疑分（0–100）

由 `computeSuspicionScores()` 计算，初始为 0，累加以下信号：

| 信号 | 分值 |
|------|------|
| 被预言家指名查杀 | +50 |
| 多预言家对抗：后跳的预言家（非先跳） | +15 |
| 被其他玩家在发言中 `accuse` 指控 | +5 / 次 |
| 为被查杀玩家进行 `defend` 辩护 | +8 |

### 信任分（0–100）

由 `computeTrustScores()` 计算：

| 信号 | 分值 |
|------|------|
| 被预言家声称金水 | +60 |
| 场上唯一预言家（自身信任分） | +30 |
| 场上多预言家对抗（弱化信任） | +10 |

### 分数用途

- **怀疑分 ≥ 40**：触发 `hasHighSuspicion` 条件，进入推票逻辑
- **怀疑分 ≥ 30**：触发 `hasUncheckedSuspect`，预言家优先查验
- **金水在 seerClaims 列表**：硬排除出村民投票候选、守卫优先守护

---

## 部署集成流程

```
前端 btClient.js
    │
    ├─── VITE_BT_API_URL 已设置
    │       └── POST https://zhaxiaoji.com/bt/decide  (timeout 500ms)
    │               ↓ Nginx → 127.0.0.1:3001
    │               ↓ server/index.js
    │               ↓ BehaviorTree.run(bb)
    │               ↓ 返回 { targetId, reasoning }
    │
    ├─── 远端失败 + IS_HYBRID=true
    │       └── 降级：本地 BT 运行（同样逻辑，浏览器内）
    │
    └─── 全部失败
            └── 返回 null → 上层 useAI.js 走原有 LLM 全量调用
```

**狼人发言特殊路径**：

```
POST /bt/wolf-speech
    ├── Stage 1：BT 决策策略（< 1ms，纯 JS）
    └── Stage 2：LLM 润色（1–3s，ModelScope API）
            ├── 狼人 → WOLF_POLISH_MODELS（思维链大模型池）
            └── 其他 → OTHER_POLISH_MODELS（Instruct 小模型池）
```

---

## 扩展说明

### 添加新策略

1. 在 `actions/wolfActions.js` 新增 `strategyXxx` 动作节点
2. 在 `trees/werewolf/speech.js` 的 `selector` 数组中按优先级插入 `sequence([condXxx, strategyXxx])`
3. 对应在 `src/services/polishPrompts.js` 的 `STRATEGY_HINTS` 中加入提示词

### 调整评分权重

所有评分逻辑集中在 `blackboard/derivations.js`，调整对应数值即可，无需修改任何 BT 节点。

### 单元测试

```bash
npx vitest run src/services/decisionEngine/__tests__/villagerVote.test.js
npx vitest run src/services/decisionEngine/__tests__/werewolf.test.js
npx vitest run src/services/decisionEngine/__tests__/nightRoles.test.js
```
