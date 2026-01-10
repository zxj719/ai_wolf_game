# 🧠 Prompt Engineering Architecture Report

本文档详细阐述了本项目（Werewolf AI Battle）中 Prompt Engineering（提示工程）的架构设计、模块化策略及上下文管理机制。

## 1. 核心设计哲学

为了让 LLM 在长周期的狼人杀游戏中保持逻辑连贯且不产生幻觉，我们采用了 **"Stateless Hook, Stateful Context"**（无状态接口，全状态上下文）的设计模式。

*   **System Prompt (长期记忆/人格)**：负责定义"我是谁"（身份、性格）、"世界观"（游戏规则、博弈论策略）以及"当前存活状态"。
*   **User Prompt (短期任务/动态)**：负责定义"现在做什么"（发言、投票、夜间行动）以及"即时信息"（刚刚谁说了什么、历史死亡记录）。

## 2. 模块化架构 (`src/services/aiPrompts.js`)

我们将原本散落在各个组件中的 Prompt 拼接逻辑收敛到了统一的服务模块中。

### 2.1 动作驱动 (Action-Driven)
引入 `PROMPT_ACTIONS` 枚举，将 AI 的行为标准化，避免由 UI 层直接拼接字符串：

```javascript
export const PROMPT_ACTIONS = {
    DAY_SPEECH: 'DAY_SPEECH',      // 白天发言
    DAY_VOTE: 'DAY_VOTE',         // 放逐投票
    NIGHT_WOLF: 'NIGHT_WOLF',     // 狼人袭击
    NIGHT_SEER: 'NIGHT_SEER',     // 预言家查验
    NIGHT_WITCH: 'NIGHT_WITCH',   // 女巫用药
    NIGHT_GUARD: 'NIGHT_GUARD',   // 守卫守护
    HUNTER_SHOOT: 'HUNTER_SHOOT'  // 猎人开枪
};
```

### 2.2 双层 Prompt 生成器

#### Layer 1: System Prompt (身份构建)
`generateSystemPrompt(player, gameState)` 函数负责构建稳固的 Agent 认知：
*   **身份锁死**：明确告知 "你是[X号]，身份[Y]"，防止模型并在多轮对话后忘记身份。
*   **性格注入**：动态插入 `player.personality`，让激进型玩家和保守型玩家表现不同。
*   **私有信息**：即时计算玩家的"私有视角"（如预言家的查验历史、狼人的队友名单），这部分信息对其他玩家不可见。
*   **博弈论规则**：根据身份通过 `buildRoleStrategy` 注入高阶策略（如：狼人需要学会悍跳，村民需要学会找神）。

#### Layer 2: User Prompt (任务下发)
`generateUserPrompt(actionType, gameState, params)` 负责构建当前帧的任务环境：
*   **任务原子化**：每次请求只完成一个原子任务（如"输出JSON格式的发言"）。
*   **防呆约束**：明确列出 `validTargets`（合法目标），防止 AI 投票给死人或无法交互的对象。
*   **格式强制**：强制要求输出 JSON，并定义字段结构（`voteIntention` 等），便于前端解析。

## 3. 上下文管理机制

LLM 没有记忆，我们需要在每次请求中重建"游戏脑"。我们实现了 `prepareGameContext` 方法来标准化数据的注入。

### 3.1 信息压缩与格式化
为了节省 Token 并提高 AI 理解效率，我们将复杂的 Object 数组被压缩为自然语言描述：

*   **存活列表**：`[1, 2, 5]` -> `"1号,2号,5号"`
*   **发言历史**：将 `speechHistory` 过滤并转换为摘要形式：
    > "D1 3号: 我是预言家，查杀5号..."
*   **死亡与投票**：
    > "D1投票: 1->2, 3->2 => 2号出局"

### 3.2 动态视野控制 (View Control)
系统严格区分"上帝视角"与"玩家视角"：
*   **狼人视野**：System Prompt 中包含 `狼队友: [3号, 6号]`。
*   **所有玩家**：User Prompt 中包含 `公共发言` 和 `公开死亡信息`。
*   **预言家**：System Prompt 中动态追加 `checkHistory`（验人记录）。

## 4. 防幻觉与鲁棒性设计

针对 LLM 常见的弱点，我们植入了多层防御：

1.  **JSON 健壮解析 (`safeParseJSON`)**：
    *   处理 Markdown 包裹 (` ```json ... ``` `)。
    *   自动修复中文引号转义错误。
2.  **逻辑硬约束**：
    *   在 Prompt 中显式加入 `【存活可投】X,Y,Z`。
    *   在代码层（Hook）再次校验 AI 返回的 `targetId` 是否在合法列表内，如果越界则通过回退逻辑（Fallback）修正（如随机选择或空操作）。
3.  **思维链引导 (CoT)**：
    *   在投票 Prompt 中加入 `"1.你投的人可能无辜的理由是什么？ 2.为什么你仍然投他？"` 强迫模型先生成推理过程再输出结果。
    
## 5. 示例：一次完整的 AI 思考过程

**Input (Prompt):**
> System: 你是3号，身份女巫。昨晚你救了1号。解药已用，毒药可用。
> User: 现在是第2天晚上。昨晚5号死亡。毒药可用。请决策是否用毒。

**Output (LLM Response):**
```json
{
  "reasoning": "5号死因不明，但我昨晚救了1号，说明可能是狼刀不够快或者有冲突。目前场上7号发言极其划水，且试图跟票好人，像一张倒钩狼。为了以此试错，我决定带走7号。",
  "useSave": false,
  "usePoison": 7
}
```

**Context Injection:**
前端逻辑接收到 JSON，解析出 `usePoison: 7`，执行游戏逻辑。

---

通过这套架构，我们将"游戏逻辑"与"AI 文本生成"解耦，使得 Prompt 易于调试、维护和扩展。
