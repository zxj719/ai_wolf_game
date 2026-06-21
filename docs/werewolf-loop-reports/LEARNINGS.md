# AI 狼人杀评估优化 — 跨轮教训库

> 每轮追写。格式：`[YYYY-MM-DD HH:MM UTC] 教训简述（原因）`

---

## 关于提示词工程

### [2026-06-15] 女巫人格禁忌不能与夜间策略提示矛盾
- **问题**：`WITCH_PERSONA.taboos` 中的 `'首夜不救人'` 表义为"首夜不救人是禁忌"，即"你必须在首夜救人"。但夜间行动提示词中 `firstNightHint` 在有守卫时说"建议不救"。两者直接矛盾，LLM 会接收到冲突信号。
- **教训**：人格层面的 `taboos` 不能承载条件化策略（条件化内容应在 `nightAction` 提示词中动态生成）。凡是需要根据局势动态调整的策略建议，一律放到对应的 Action 提示词里，而不要硬编码进 Persona 的静态字段。
- **修复**：将 `'首夜不救人'` 改为 `'同一晚又救又毒'`（真正应禁止的行为），首夜策略由 `firstNightHint` 动态决定。

### [2026-06-15] 负向词汇列表会激活 LLM 对这些词的注意力
- **问题**：狼人发言提示词中 `speech 中绝对禁止出现：狼人、队友、刀、狼队、保狼、抗推` 列出了具体禁止词汇。根据 LLM 激活理论，列出"禁止词"会让模型对这些词汇更加敏感和关注，反而更可能出现（类似"不要想一头白熊"效应）。
- **教训**：用正向描述期望行为替代负向禁止列表。"像普通好人一样分析局势"比"不要说狼人/刀/保狼"更有效。
- **修复**：删除具体禁止词列表，改为正向描述："以普通好人视角写就：只谈分析、怀疑、投票逻辑"。

### [2026-06-15] JSON 输出 Schema 中的冗余字段可能导致 AI 只填其中一个
- **问题**：女巫夜间输出 schema 同时定义了 `usePoison: 数字或null` 和 `poisonTarget: 数字或null`，但代码只读 `usePoison`。AI 可能填了 `poisonTarget` 而 `usePoison` 保持 null，导致毒药失效但无错误提示（静默 bug）。
- **教训**：Schema 中每个语义概念只能有一个字段名，避免"一意多表"导致 AI 不确定填哪个。清理所有冗余/同义字段。
- **修复**：删除 `poisonTarget` 字段，只保留 `usePoison`，并明确注释其含义（数字=目标号码，null=不毒）。

## 关于游戏流程

### [2026-06-15] 猎人模拟测试不能用 isAlive 拦截 —— 猎人死亡后才开枪
- **问题**：在干跑模拟脚本中，对猎人调用开枪逻辑前检查了 `hunter.isAlive`，结果拦截了所有测试（猎人在游戏里恰恰是死亡后才开枪）。
- **教训**：模拟脚本的前置条件必须还原真实调用时序。猎人开枪的函数在真实代码里是 `handleAIHunterShoot`，调用方已确认猎人已死，函数内部不再检查 isAlive。模拟时应遵循相同约定。

## 关于架构约定

### [2026-06-15] 渐进式披露已建立：role 模块 > aiPrompts.js 降级逻辑
- `buildPersonaPrompt` 先尝试 `getRoleModule(player.role).buildPersonaPrompt`，失败时降级到 `aiPrompts.js` 里的 `ROLE_PERSONAS`。两处都需要同步更新，否则降级路径仍存在旧 bug（本轮已同步修复女巫 taboos）。

### [2026-06-15 Round 2] promptFactory.js 的 getProgressiveActionPrompt 是死代码
- **问题**：`src/services/promptFactory.js` 中的 `getProgressiveActionPrompt` 从未被任何生产代码 import，导致 `rolePrompts/*.js` 中的 `nightAction`/`daySpeech` 函数（如 `getWerewolfDaySpeechPrompt`、`getSeerNightActionPrompt`）完全不会被调用。
- **教训**：修改 rolePrompts/*.js 的 nightAction/daySpeech 函数对实际 AI 行为**没有任何影响**。Round 1 对 `werewolf.js#getWerewolfDaySpeechPrompt` 的修复是无效的——真正的主路径是 `aiPrompts.js` 中的 `ROLE_DAY_SPEECH_PROMPTS[role]` 和各 `case PROMPT_ACTIONS.*` 代码块。
- **唯一例外**：`buildPersonaPrompt`（系统提示词）确实调用了 `roleModule.buildPersonaPrompt`，所以 `rolePrompts/*.js` 的 persona builder 是活的。
- **操作规则**：修改提示词时，优先检查 `aiPrompts.js` 的 `ROLE_DAY_SPEECH_PROMPTS` 和各 `case PROMPT_ACTIONS.*`（用户提示）；系统提示走 `rolePrompts/*.js` 的 `buildPersonaPrompt`。两者都改。

### [2026-06-15 Round 3] 狼人 DAY_SPEECH 模板若含动态变量，必须用函数体语法（不能用纯箭头函数 + 模板字符串）
- **问题**：`ROLE_DAY_SPEECH_PROMPTS['狼人']` 原来是 `(ctx, params) => \`...\`` 的箭头函数，无法在模板之前声明本地变量（如 `wolfTeammatesHint`）。
- **教训**：凡是提示词函数需要根据 `params` 中的数据进行条件化处理（如 `params.wolfTeammates?.length > 0`），必须用函数体写法 `(ctx, params) => { const x = ...; return \`...\`; }`，而不是直接的模板字符串。
- **修复**：Round 3 将 `'狼人'` 条目改为函数体语法，在 `return` 前定义 `wolfTeammatesHint` 变量，并通过 `${wolfTeammatesHint}` 注入到提示词中。

### [2026-06-15 Round 3] roleParams 是 DAY_SPEECH 注入动态上下文的正确位置
- **问题**：原 `roleParams` 只传递了女巫/守卫/预言家的私有状态，没有传递多狼协作所需的队友列表。
- **教训**：`generateUserPrompt` 的 DAY_SPEECH case 统一在 `roleParams` 构建动态上下文，再传入 `ROLE_DAY_SPEECH_PROMPTS[role](ctx, roleParams)`。需要什么数据就在 `roleParams` 里加，不要在模板函数内部再读 `gameState`（会产生不一致）。
- **修复**：在 `roleParams` 中添加 `wolfTeammates` 字段，只在 `playerRole === '狼人'` 时计算。

### [2026-06-15 Round 3] SHERIFF_SPEECH 提示词不能只给发言目标，要给发言框架
- **问题**：旧版 SHERIFF_SPEECH 好人提示只说"说明你上警的理由、给出判断计划"，太宽泛。AI 会生成"我是好人，请大家投我"这类无实质内容的口号式发言。
- **教训**：竞选类提示词（AI 需要主动说服他人）必须给出结构化的内容框架——具体说什么（3个要点）、如何说（语气/逻辑要求）、避免什么（口号 vs 实质内容）。
- **修复**：Round 3 为预言家、狼人、好人各自定义3点结构框架；为12人局（`isLargeGame`）加入警徽流计划要点；字数限制从 60 扩展到 60-80 字；输出 JSON 新增 `thought` 博弈思路字段。

### [2026-06-16 Round 4] 降级路径与主路径的同步是持续义务
- **问题**：Round 2 只修了 `seer.js` 模块的 `getSeerThinkingDimensions`，未同步修 `ROLE_PERSONAS` 降级路径，导致两条路径产生不一致直到 Round 4 才被发现。
- **教训**：每次修改 `rolePrompts/*.js` 的 `buildPersonaPrompt`、`getThinkingDimensions` 等函数时，**必须同步检查** `aiPrompts.js` 中 `ROLE_PERSONAS[role]` 对应字段是否需要同步更新。两处是"主路径+降级路径"的关系，任何一处的策略描述都不能滞后。
- **检查清单**：每轮结束后运行 grep 确认 `ROLE_PERSONAS['预言家'].thinkingDimensions[0]` 和 `seer.js getSeerThinkingDimensions` 的第一维度描述一致。

### [2026-06-16 Round 4] 所有夜间行动的输出 schema 必须包含 identity_table
- **问题**：`NIGHT_SEER` 的输出 schema 长期缺少 `identity_table`，而 `NIGHT_GUARD` 和 `NIGHT_WOLF` 都有。这导致预言家在查验夜无法更新身份推理表（静默信息缺口，不报错）。
- **教训**：新增任何夜间行动类型时，必须在输出 schema 中包含 `identity_table` 字段（除非有明确理由不要，如简单查询型行动）。建立一条常驻测试：所有 `NIGHT_*` case 的输出行都应包含 `identity_table`。
- **修复**：Round 4 在 `NIGHT_SEER` 输出 schema 末尾添加 `identity_table` 字段，与 guard/wolf 保持一致。

### [2026-06-16 Round 5] currentPlayer 在 generateUserPrompt 全局可用，可读取玩家私有状态
- **背景**：LAST_WORDS 女巫分支需要访问 `hasWitchSave` / `hasWitchPoison` 判断药品状态。
- **发现**：`generateUserPrompt` 在 switch 块开始前的 line 1143 已声明 `const currentPlayer = params.currentPlayer || players.find(...)`, 在全部 case 中均可用。
- **教训**：需要玩家私有状态（药品/身份/任何存在于 player 对象上的字段）时，直接用 `currentPlayer?.fieldName` 即可，**无需在 useDayFlow.js 的调用方额外传参**。避免为了传递 1 个字段而改动整个调用链。

### [2026-06-16 Round 5] 遗言是信息传递的最后机会，应按角色专属信息分支而非泛化
- **问题**：原版 LAST_WORDS 对女巫/猎人/守卫/村民使用同一段泛化提示，导致 AI 无法充分利用这些角色的独有信息（女巫药品状态、守卫守护记录、猎人开枪目标）。
- **教训**：每当有玩家死亡类提示词，要逐一问"这个角色在死亡时刻有哪些其他角色没有的信息？"。遗言、竞选发言、入场自证都属于此类——通用模板覆盖多角色时，大概率存在信息浪费。
- **修复方式**：增加 `if/else if` 分支（女巫、猎人、守卫），每个分支利用对应的玩家私有状态字段。

---

### [2026-06-16 Round 6] NIGHT_* schema 统一检查：不要只修一个，要检查全部

- **问题**：Round 4 补 NIGHT_SEER identity_table，Round 5 未检查 NIGHT_WITCH，导致 NIGHT_WITCH 漏网直到 Round 6 才发现。
- **教训**：每次修任何一个 `NIGHT_*` case 的输出 schema，必须对所有 `NIGHT_*` case 做全量扫描，确保 schema 字段一致。可用 grep `'"targetId"\|"useSave"'` + 验证每处是否含 `identity_table`。
- **修复**：Round 6 补全 NIGHT_WITCH，现在 NIGHT_SEER/GUARD/WOLF/WITCH 均有 identity_table。待查：NIGHT_DREAMWEAVER。

### [2026-06-16 Round 6] 调用端传参不完整是提示词失效的隐患

- **问题**：SHERIFF_BADGE_PASS 的 `generateUserPrompt` 有能力读取 seerChecks，但 `useDayFlow.js` 调用时只传了 `validTargets`，导致提示端即使想用也拿不到数据。
- **教训**：提示词能力扩展时，必须同时检查 *调用端* 是否传了对应参数。提示端和调用端是配对关系——只改一端等于改了个寂寞。使用 grep 找到所有 `askAI(player, PROMPT_ACTIONS.XXX, {` 调用，核对参数完整性。
- **修复**：Round 6 在 `useDayFlow.js` 的 `handleSheriffBadgePass` 中加入 `seerChecks` 参数。

### [2026-06-16 Round 7] test 脚本的 indexOf 起点很关键：必须从 PROMPT_ACTIONS.XXX 找，而不是从字符串首次出现

- **问题**：测试脚本中 `src.indexOf('NIGHT_DREAMWEAVER')` 找到的是枚举定义（顶部），而不是 case 块；`src.lastIndexOf('"thought"')` 在大窗口里会溢出到下一个 case。
- **教训**：验证测试必须用 `src.indexOf('PROMPT_ACTIONS.XXX')` 定位 case 块；用足够小的窗口（tight window）避免溢出到相邻 case；`输出JSON:` 后用 `indexOf` 找输出行而不是 `lastIndexOf`。

### [2026-06-16 Round 7] HUNTER_SHOOT 的"临界推理"不能告知答案，要引导推断过程

- **背景**：猎人开枪不同于女巫用药——猎人必须开枪（没有"不行动"选项），所以 criticalGuidance 的框架是"谁值得带走"而非"要不要动"。
- **教训**：不同的"强制行动 vs 可选行动"场景需要不同的 criticalGuidance 框架。强制行动场景重点是"如何选择目标才能最大化胜率"，可选行动场景重点是"是否值得行动"。两者混用会让 AI 感到困惑（强制场景问"要不要"等于无效指令）。

---

### [2026-06-16 Round 8] ROLE_DAY_SPEECH_PROMPTS 覆盖缺口导致 3 个特殊神职共享村民模板，最严重的是骑士决斗完全失效

- **问题**：`ROLE_DAY_SPEECH_PROMPTS` 只定义了 6 个主要角色（狼人/预言家/女巫/猎人/守卫/村民），骑士/摄梦人/魔术师 fallthrough 到村民模板。最严重的是骑士：村民模板从不输出 `shouldDuel: true`，而 `useSpeechFlow.js:265` 仅靠此字段触发决斗，导致 AI 骑士整局无法决斗（7 轮都是静默 bug）。
- **教训**：每次新增角色时，**必须检查 `ROLE_DAY_SPEECH_PROMPTS` 是否有对应条目**。任何有特殊技能触发字段（如 `shouldDuel`、`shouldReveal`、`duelTarget`）的角色，必须有独立的提示词函数。
- **操作规则**：每轮检查 `Object.keys(ROLE_DAY_SPEECH_PROMPTS)` vs 游戏中存在的角色列表，发现缺口立即补全。
- **修复**：Round 8 为骑士/摄梦人/魔术师 添加 `ROLE_DAY_SPEECH_PROMPTS` 条目，委托给各自的 `getRoleModule(role).daySpeech(ctx, params)`；同时在 `roleParams` 中补充 `hasUsedDuel`/`dreamHistory`/`lastDreamTarget`/`swappedPlayers`/`lastSwap` 五个私有状态字段。

### [2026-06-16 Round 9] 函数分叉漂移：两个 getBaseContext 函数并存时，追加字段必须同步两处

- **问题**：`aiPrompts.js` 本地版 `getBaseContext` 和 `baseRules.js` 导出版 `getBaseContext` 功能相同但内容分叉。P1 重构时提取了 `baseRules.js` 版本，但后续追加的 `currentPlayerTraits` 字段只加到了本地版，导致骑士/摄梦人/魔术师（调用 `baseRules.js` 版）长期缺少发言风格注入。
- **教训**：代码库中存在两个功能重叠的函数时，任意追加字段都必须检查另一处是否需要同步。检查方法：`grep -rn "getBaseContext" src/` 找到所有调用点，确认它们使用的是哪个版本的函数。
- **修复**：Round 9 在 `baseRules.js` 的 `getBaseContext` 末尾追加 `currentPlayerTraits` 注入，与 `aiPrompts.js` 本地版保持一致。
- **后续**：可考虑将 `aiPrompts.js` 本地版改为直接 re-import `baseRules.js` 版，彻底消除分叉隐患（需回归测试 6 个主要角色）。

### [2026-06-17 Round 10] import 替代本地定义是消除分叉的正确姿势，死代码在 JS 中不报错

- **问题**：`aiPrompts.js` 本地 `const getBaseContext` 和 `baseRules.js` 导出版并存了 10 轮。每次只改一处都会形成静默分叉（JS 不报"defined but never used"，也不报"local shadow"）。
- **教训**：彻底消除分叉的方法是 **把本地定义改为 import**，而不是"记住要同步两处"——import 路径失效会立即报错，是自证活代码的唯一方式。
- **修复**：Round 10 在 `aiPrompts.js` 顶部 import block 加入 `getBaseContext`（从 `./rolePrompts` re-export 链），删除 lines 1121-1140 本地定义；同时删除从未被任何 case 使用的 `const baseContext` 死变量（7 行）。
- **副教训**：`const X = ...` 在 JS 中如果定义了但未使用，编译器和 runtime 都不报错——只有 eslint/TypeScript strict 模式才会提示。本项目没有 `noUnusedLocals`，所以死变量需要人工发现。

### [2026-06-17 Round 11] 调用端传参沉默：pkMode 存在于调用端 11 轮但从未被消费

- **问题**：`useDayFlow.js` 的 PK 投票路径长期传递 `pkMode: true` 给 `askAI(p, PROMPT_ACTIONS.DAY_VOTE, { pkMode: true, ... })`，但 `generateUserPrompt` 的 DAY_VOTE case 从未在 `params` 解构中包含 `pkMode`——参数悄然被忽略，PK 重投与普通投票使用完全相同的提示词。
- **根因**：调用端新增参数时没有同步检查提示端是否消费。这是 R6 教训（`seerChecks` 沉默）的同类问题，但 `pkMode` 沉默时间更长（至少 8 轮）。
- **教训**：每次在调用端新增 `askAI` 参数时，必须立即在 `generateUserPrompt` 的对应 case 中消费（或明确注释"此参数供其他用途"）。可用 grep 扫描：`grep -n "askAI.*DAY_VOTE" src/` 列出所有调用，对比 case 中的 `params` 解构。
- **修复**：Round 11 将 `pkMode` 加入 `const { ..., pkMode } = params` 解构，并在 `sceneHint` 中作为最高优先级分支处理。

### [2026-06-17 Round 11] case 作用域的 const 安全：switch case 应使用 { } 封闭

- **问题**：`case PROMPT_ACTIONS.DAY_VOTE:` 块内有多个 `const` 声明，但未使用花括号 `{ }`，这在同一 switch 中可能与其他 case 的同名变量产生提升冲突（JS 引擎规则：整个 switch body 为同一词法作用域，除非用花括号隔离）。
- **教训**：含 `const`/`let` 声明的 case 块必须用 `{ }` 封闭。参考 `HUNTER_SHOOT` 的写法（已在 R7 期间加了花括号）。每次给一个已有 `const` 的 case 添加更多变量时，先检查是否有 `{`。
- **修复**：Round 11 将 `case PROMPT_ACTIONS.DAY_VOTE:` 改为 `case PROMPT_ACTIONS.DAY_VOTE: {` 并在 `return` 后加 `}`。

### [2026-06-17 Round 12] getCOTTemplate 中的假 case 会让测试 indexOf 定位错误

- **问题**：`aiPrompts.js` 中的 `getCOTTemplate` 函数也是一个 switch 语句，里面有 `case PROMPT_ACTIONS.DAY_VOTE:` 等。用 `src.indexOf("case PROMPT_ACTIONS.DAY_VOTE:")` 会定位到 getCOTTemplate 里的假 case，而非 generateUserPrompt 里的真实 case。
- **教训**：测试验证 switch case 时，应搜索带花括号的形式 `"case PROMPT_ACTIONS.XXX: {"` 以锁定真实实现块（getCOTTemplate 版本没有花括号）。或者使用行号锚点更可靠。
- **修复**：Round 12 测试脚本 T21 改为搜索 `"case PROMPT_ACTIONS.DAY_VOTE: {"` 以绕过假 case。

### [2026-06-17 Round 12] SHERIFF_VOTE 的 gameState 访问模式（无需修改调用端）

- **背景**：SHERIFF_VOTE 在 `useDayFlow.js` 调用时只传了 `validTargets: candidateIds`，但 `generateUserPrompt` 内部可直接访问 `gameState`，`gameState.seerChecks` 不需要经调用端二次传参。
- **教训**：`generateUserPrompt` 的所有 case 都可通过闭包访问 `gameState`，因此需要历史数据（seerChecks、voteHistory、guardHistory 等）时，优先从 `gameState` 读取而非修改调用端，除非调用端需要计算派生值（如热力排名 Top3）。DAY_VOTE 的热力计算选择在 case 内部就地计算即为此模式的正例。

---

### [2026-06-17 Round 13] 多狼夜间行动：后置狼会静默覆盖首狼刀目标

- **问题**：`useNightFlow.js` 对每只 AI 狼独立调用 `askAI` + `mergeNightDecisions({ wolfTarget })`，后置狼的决策会覆盖首狼结果。最终刀目标是"最后一只 AI 狼的选择"，不是协调后的最优目标；且浪费了多次 LLM 调用。
- **根因**：用户狼有 `if (wolfTarget !== null) { skip }` 保护（line 332），但 AI 狼没有此检查。
- **教训**：任何"同角色多实例"的夜间行动（如多狼），必须检查前置同伴是否已设决策结果，若已设则后续直接确认，不重复决策。这是"协调型多代理"的基本约定。
- **修复**：Round 13 在 AI 狼行动入口添加 `if (nightDecisions.wolfTarget !== null) { 确认并跳过 }` 逻辑，同时提示词告知首狼"你是本晚决策人"。

### [2026-06-17 Round 13] 测试 indexOf 定位：同字符串多处出现时需要更精确的锚点

- **问题**：`nightFlowSrc.indexOf('nightDecisions.wolfTarget !== null')` 找到的是 line 332（用户狼检查），而非 line 563（AI 狼新增检查）。导致 T4 测试扫描了错误的代码段并误报"askAI 出现"。
- **教训**：验证新增逻辑时，若目标字符串可能在文件中出现多次，应使用唯一的注释或函数名作为锚点（`indexOf('// 多狼协作：首狼决策后')`），然后从该锚点开始查找目标字符串。单纯的 `indexOf(targetStr)` 只能在确认字符串全局唯一时使用。
- **类比**：LEARNINGS.md R12 中的 getCOTTemplate 假 case 问题（用带花括号的形式区分）同属此类——都是"相同模式出现多处"导致定位错误。

---

### [2026-06-17 Round 14] promptFactory.js Plan B 执行：死代码删除 ~500 行，无回归

- **完成项**：删除了 `getProgressiveActionPrompt`（promptFactory.js）以及 6 个主角色（werewolf/seer/witch/hunter/guard/villager）的 `daySpeech` 和 `nightAction` 函数；同时删除了 `dreamweaver.js#getDreamweaverNightPrompt`（NIGHT_DREAMWEAVER case 在 aiPrompts.js 有独立内联实现）。
- **保留项**：knight/dreamweaver/magician 的 `daySpeech`（被 `ROLE_DAY_SPEECH_PROMPTS` 活调）；magician 的 `nightAction`（被 `NIGHT_MAGICIAN` case 活调）；所有角色的 `buildPersonaPrompt`（活）。
- **教训**：14 轮总结——死代码一旦形成就会持续混淆开发者（"改了为什么没效果？"），应在首次发现时立即删除，不要积压 13 轮。
- **检查方法**：删除前用 `grep -rn "functionName" src/ --include="*.js" | grep -v "rolePrompts/own-file.js"` 确认无外部引用，再安全删除。

---

### [2026-06-17 Round 15] 多分支提示词应用 `let + if` 块而非三元表达式

- **问题**：`wolfTeammatesHint` 原先用单行三元表达式，导致2狼/3+狼/残局三种场景无法分别处理，只能写成一个扁平文本。
- **教训**：凡提示词需要根据 3+ 个条件分支（狼数、局面阶段、残局标志）生成内容时，必须用 `let xxx = ''; if (...) { const ... ; xxx = ...; }` 形式——三元表达式只适合 2 选 1 场景，多分支时可读性和可维护性都极差。
- **修复**：Round 15 将 `wolfTeammatesHint` 重构为 `let + if` 块，内含 `totalWolves`/`aliveCount`/`isLateGame`/`roleDiv`/`lateHint` 五个派生变量，清晰对应不同策略场景。
- **isLateGame 阈值**：`aliveCount <= totalWolves * 2 + 1`（wolf-parity danger zone 标准定义）。

### [2026-06-17 Round 15] 云端构建环境需手动安装原生 Rollup 包

- **问题**：`npm run build` 报 `Cannot find module '@rollup/rollup-linux-x64-gnu'`，但项目代码本身无变化。
- **原因**：云端容器初始化时 `node_modules` 未安装平台特定的原生包（`@rollup/rollup-linux-x64-gnu`），这是 rollup v4 的新行为（native binary 独立发布）。
- **修复**：运行 `npm install @rollup/rollup-linux-x64-gnu --no-save` 后 build 正常。
- **教训**：每次 build 失败时先检查是否是原生包缺失问题（报错信息为 `Cannot find module '@rollup/...'`），不要误判为代码问题。

---

### [2026-06-18 Round 16] 夜/日提示词一致性：multiWolfHint 与 DAY_SPEECH 角色分化必须互相呼应

- **问题**：Round 15 在 DAY_SPEECH 中加入了详细的角色分化（主动方/低调方），但 NIGHT_WOLF 的 multiWolfHint 只说"立场分散"，未提角色分化。导致狼人在夜间决策时无法意识到第二天应该用什么角色策略。
- **教训**：任何跨阶段的策略提示（夜间决策 → 白天执行）必须在两处同步更新，否则 AI 夜间做计划时无法看到白天的执行框架，相当于没有提前规划。
- **修复**：在 `multiWolfHint` 末尾添加"白天角色分化（与白天发言策略一致）：先开口担任主动方，后开口担任低调方"一行，使夜/日策略互相锚定。

### [2026-06-18 Round 17] 好人方 identity_table 的差异化：确定性知识 vs 推断性知识

- **背景**：Round 16 完成了狼人 identity_table 战略化。好人方（预言家/守卫）同样需要差异化填写，但方向不同：预言家有**确定性知识**（查验结果），守卫有**守护计划状态**。
- **核心区分**：预言家的查验结果是二元事实（狼/好），confidence 应填 95-100；其他玩家是推断，填 40-80。若不区分，AI 跨轮无法快速辨别"已知事实"和"推断"，容易把已确认的金水当成可疑目标处理。
- **预言家待报标记**：引导预言家在 reason 字段标记"已公开/待明日报"，让跨轮记忆中包含"哪条查验信息已告知好人"，防止 AI 在 N2 晚遗忘 N1 已报还是未报。
- **守卫守护计划记忆**：引导守卫在 reason 字段写"N[X]夜守护结果 + 今晚换守判断"，让 AI 在次日夜间行动时能延续守护策略，而不是每轮重新评估。
- **教训**：identity_table 战略化应逐角色评估"该角色有什么独有信息"，而不是批量套用同一个模板。

### [2026-06-18 Round 16] identity_table 是跨轮私有记忆，应按角色战略需求差异化填写

- **背景**：`identity_table` 通过 `identityTablesRef.current[player.id]` 存储，每轮以 `previousIdentityTable` 形式返还给 AI，且从不在任何 UI 中渲染——纯粹是 AI 的私有跨轮记忆机制。
- **问题**：狼人和好人的 identity_table 使用语义完全不同：好人是"推断角色"；狼人已知所有身份，空着 reason 字段是浪费。
- **教训**：identity_table 的 `reason` 字段是最有价值的扩展空间——可以用来记录该局的战略注记（高优先刀口/对队友的公开叙事）。这些注记在下轮 LLM 调用时会重新可见，形成跨轮战略一致性。
- **修复**：在 NIGHT_WOLF 和 DAY_SPEECH '狼人' 两处均添加 identity_table 战略填写指导：高威胁好人标"高优先刀口"、已知队友标"村民"以维持公开叙事一致性。

### [2026-06-18 Round 18] NIGHT_* case 模板字符串内的变量会被求值，指导文本不能含已声明变量名的 `${}` 插值

- **问题**：在 NIGHT_WITCH case 的 `return \`...\`` 模板字符串内写指导文本时，用了 `${canSave ? '可用' : '已用'}`（canSave 在该 case 中已声明）。这不是静态文本——会被 JS 在运行时求值，导致 AI 收到的是"解药已已用"（当 canSave=false 时，汉字重复，语义奇怪）。
- **根因**：所有 NIGHT_* case 和多数 DAY_SPEECH 条目都使用模板字符串返回。任何 case 作用域内的变量（dyingId/canSave/hasPoison 等）如果出现在 `${}` 里，都会被求值而非展示为文字。
- **教训**：在 NIGHT_* / DAY_SPEECH 模板字符串内写"指导文本"（Instructions for AI）时，必须使用**纯静态方括号占位符**格式，如 `[救/未救原因]`、`[当前可用/已用]`，不得使用 `${变量名}` 或 `${表达式}`。若需要动态值展示，应在 `return` 前的代码段定义一个有意义的字符串变量（如 `const canSaveHint = canSave ? '可用' : '已用'`），再在模板中插入 `${canSaveHint}`。
- **防范机制**：测试脚本应包含一项"无 `${canSave`" 类的负向断言，检查指导文本区间内不含已知 case 变量名的插值。R18 测试 T20 已示范此模式。

### [2026-06-18 Round 18] 村民 identity_table 必须显式指令"追加不覆盖历史"

- **问题**：LLM 在没有明确约束时，每轮会重写 `reason` 字段（只写当前轮观察），抹去所有历史证据链。对村民而言，`identity_table` 是唯一的跨轮持久记忆，历史行为模式积累是识别狼人的关键。
- **教训**：任何依赖跨轮追加的指导文本，必须明确写"**在上轮 reason 基础上追加**本轮新观察，不要覆盖历史"。只写"记录行为模式"不足够——LLM 会理解为"写当前情况"而非"在已有内容上追加"。
- **适用场景**：村民（行为模式积累）、猎人（开枪优先级积累）——任何需要多轮累积而非单轮更新的状态。

---

### [2026-06-18 Round 19] 格式示例（few-shot）比纯指令更有效地控制 LLM 的追加行为

- **问题**：Round 18 加了"追加不覆盖历史"指令，但没有给 LLM 具体的格式演示。LLM 可能把"追加"解读为"重新写一个包含历史信息的字符串"（两者看起来都满足了"包含历史"的要求），而不是在旧字符串末尾用分号拼接。
- **教训**：涉及字符串拼接格式的指导，必须附上 before→after 格式示例。`上轮 reason="X" → 本轮更新为"X；Y"` 这种对比形式，让 LLM 精确理解"追加"的实现方式——这是 few-shot in-context learning 的核心原理。
- **修复**：Round 19 在村民和猎人的追加指令后各添加一行 `【追加示例】`，包含具体的前后对比和分号拼接格式。
- **通用规则**：凡是提示词中涉及"格式转换"或"字符串拼接"的指导，始终提供具体示例，不要只靠文字描述。

### [2026-06-18 Round 19] DAY_VOTE 热力计算经边界测试确认逻辑正确

- **验证**：通过 `.tmp/test-round19.mjs` T19-T23 纯函数模拟，确认 5 个边界情况均正确：首轮无历史→无提示；历史全弃票→无提示；正常历史→Top3 排序正确；已死玩家→被过滤；当天投票→不计入历史。
- **提示**：DAY_VOTE 热力计算的 `voteDay` 过滤用的是严格小于（`v.day < voteDay`），所以平票触发 PK 时，同一天的 PK 投票（若有）不会自引用。
- **遗留**：热力提示是否会导致 AI "盲从热力" 仍未在真实对局中验证（19轮累计0次）。

---

### [2026-06-18 Round 20] "死字段"比"死代码"更难发现：LLM 输出字段若未被消费，外表无异常

- **问题**：`shouldReveal` 存在于魔术师 DAY_SPEECH 的 JSON 输出 schema 中长达 19+ 轮，但 `useSpeechFlow.js` 从未读取此字段。魔术师跳身份的决策完全被丢弃。与"死代码"不同，"死字段"不会触发任何报错——AI 正常输出，游戏正常运行，只是跳身份后 `hasRevealed` 永远为 `false`，下一轮提示词仍显示"伪装成平民"。
- **根因**：JSON 响应字段与游戏状态更新之间没有自动绑定。`shouldDuel` 有人工绑定（Round 8 明确添加了触发代码），`shouldReveal` 从 Round 8 起就未绑定。
- **检测方法**：对每个角色的 DAY_SPEECH / NIGHT_* 输出 JSON schema，列出所有布尔型触发字段（`shouldDuel`, `shouldReveal`, `shouldDream` 等），逐一确认 `useSpeechFlow.js` / `useNightFlow.js` 中有对应消费代码。
- **修复模式**：遵循 `hasUsedDuel`/骑士的完整模式：① player 初始状态加字段 ② 消费端消费触发字段 + `setPlayers` 持久化 ③ roleParams 传参 ④ 提示词根据状态切换阶段。幂等守护（`!currentSpeaker.hasRevealed`）防止重复触发。
- **注意区别**：shouldReveal 与 shouldDuel 的消费后处理不同——shouldDuel 触发物理效果（杀人）需要 `return`，shouldReveal 只是状态更新，白天流程继续，**不 `return`**。

### [2026-06-18 Round 21] 同构 bug 需要主动迁移，不能等"自然发现"

- **问题**：Round 20 修复了魔术师 `shouldReveal` 死字段 bug，LEARNINGS 也明确注明了"修复模式：① player 初始状态 ② 消费端 ③ roleParams ④ 提示词条件化"。但摄梦人与魔术师完全同构（都有 3 阶段策略、都需要 shouldReveal），仍然需要再用一轮才修复。
- **根因**：修复一个角色时没有立即检查"是否有其他角色也有同样的三阶段结构？"这个问题。
- **教训**：修复某个 bug 时，必须主动扫描"哪些其他角色具有相同的架构模式（多阶段策略/需要状态追踪的特殊行动）"，一次性批量修复同构 bug，而不是等到下一轮被发现。具体方法：在报告中列出"同构候选列表"，Round 20 应该同时修复摄梦人。
- **防范机制**：每次新增 `shouldReveal`/`hasRevealed` 模式时，`useSpeechFlow.js` 中搜索其他神职的 `if (currentSpeaker.role ===` 块，确认都有对应的特殊字段消费。

---

### [2026-06-19 Round 22] 「状态可用但未接入提示词 action」是持续性死区

- **问题**：`hasRevealed` 已在 `DAY_SPEECH` roleParams 传递（22 轮前），但 `NIGHT_MAGICIAN` case 从未传入，导致魔术师夜间行动在身份暴露后仍用"保核>换刀>自保"的错误优先级，而非正确的"自保>保核>换刀"。
- **根因**：每次新增 player 字段时，开发者只更新了自己关心的 action case，未系统检查"该字段对哪些其他 action 也有影响"。
- **教训**：新增或修改任何 `player` 状态字段时，必须扫描所有 `NIGHT_*` 和 `DAY_*` case，问"此字段在该 action 的决策逻辑中有意义吗？如有意义，是否已传入且被消费？"。
- **检查方法**：`grep -n "currentPlayer?." src/services/aiPrompts.js` 列出所有已传字段，对比每个角色的所有 action case 是否应该接收。
- **修复**：Round 22 补传 `hasRevealed: currentPlayer?.hasRevealed` 到 `NIGHT_MAGICIAN` case，并重写优先级逻辑（使用 `if/else` 而非三元，R15 教训）。

### [2026-06-19 Round 22] 测试索引定位：窗口大小 + 锚点精度两件事必须同时处理

- **问题1（窗口大小）**：NIGHT_MAGICIAN case 约 1369 chars，初始窗口 1000 导致 T13/T14/T23 全部找不到 `hasRevealed`。
- **问题2（假 case 干扰）**：`DAY_SPEECH` 在 `getCOTTemplate`（顶部）也有一个 case，`indexOf("case PROMPT_ACTIONS.DAY_SPEECH:")` 找到假 case，真实 generateUserPrompt 在后面。用 `lastIndexOf` 锁定后者。（同 R12 教训，本轮重现）
- **问题3（return 位置）**：`knight.js` 中第一个 `return \`` 来自 `buildKnightPersonaPrompt` 函数，不是 `getKnightDaySpeechPrompt`。需用 `indexOf('return \`${getBaseContext')` 精确锚定。
- **教训**：测试定位组合三要素：①窗口足够大（比预期多 30%）；②用 `lastIndexOf` 或精确锚点避免假 case；③跨函数文件中的 `return \`` 需包含内容锚点。缺任何一环都会导致测试通过但验证对象错误。

### [2026-06-19 Round 23] 同构 bug 的正确修复姿势：评估后立即批量修复，不等"自然发现"

- **问题**：R21 教训明确写"修复 A 角色时必须检查同构角色 B"，但 R22 修复了魔术师 `hasRevealed`，R23 才修复摄梦人——晚了 2 轮。
- **根因**：修复时看到 "NIGHT_DREAMWEAVER case 目前不需要 hasRevealed（摄梦人入梦是独立决策，不受身份暴露影响）" 这句已有注释，就默认跳过了，而没有用博弈论重新评估。
- **教训**：现有注释中的"目前不需要"结论可能基于旧的分析，每次进行同构 bug 审计时，必须**重新推导**而不是引用旧结论——注释的保质期有限，博弈论的推导是长青的。
- **具体方法**：对每个"可能不需要"的场景问：① 这个字段改变了什么博弈信息？② 在这个 action 的决策时刻，该信息是否影响最优策略？如果两者都是 yes，就接入。

### [2026-06-19 Round 23] NIGHT_* 状态系统审计结论：当前无缺口，常驻清单已建立

- **审计日期**：2026-06-19
- **审计结论**：6 个 NIGHT_* case（GUARD/SEER/WOLF/WITCH/MAGICIAN/DREAMWEAVER）全量审计：
  - 所有 case 均包含 `identity_table` 输出字段
  - `hasRevealed` 字段：仅 MAGICIAN/DREAMWEAVER 角色有此字段，均已接入
  - `canHunterShoot`：HUNTER 无夜间 case，HUNTER_SHOOT 在 DAY phase
  - `isPoisoned`：无对应夜间行动（被毒杀是被动的，不影响毒药使用者的提示词）
  - `hasWitchSave`/`hasWitchPoison`：NIGHT_WITCH 通过 `canSave`/`hasPoison` params 接入
- **维护义务**：每次新增 player 字段时，必须更新此清单，确认是否影响任何 NIGHT_* case 决策。

### [2026-06-19 Round 24] 测试窗口大小：每次初始值需考虑目标段落实际长度

- **问题**：T25 验证村民 DAY_SPEECH 追加示例时，初始窗口 800 字节不够（村民段落约 2200 字节），导致找不到位于段落后半部的 `【追加示例】`，误报 FAIL。
- **根因**：R22 已记录"窗口比预期多 30%"教训，但初始值 800 依然偏低。村民 DAY_SPEECH 是整个 `aiPrompts.js` 中最长的 DAY_SPEECH 段落之一（超 2000 字节）。
- **教训**：为特定角色的段落写测试时，先估算段落长度（可以 `wc -c` 或统计行数），窗口设为估算值的 150%。对超过 1500 字节的段落，初始窗口不应小于 2500。
- **修复**：Round 24 将 T25 窗口从 800 改为 2200 后通过。

### [2026-06-19 Round 24] 三类跨轮记忆改进应"齐头并进"而非逐轮叠加

- **问题**：R19 补了村民/猎人的"追加不覆盖历史"格式，但守卫 DAY_SPEECH 和 NIGHT_GUARD 均未同步，直到 R24（5 轮后）才补完。
- **根因**：R19 只看了"当前要修什么"（村民/猎人），未检查"同类模式在其他角色有无遗漏"。
- **教训**：凡是修改"跨轮记忆类"提示词指导（追加格式/少覆盖历史/追加示例），修改完成后必须立即检查所有其他有 identity_table 的角色（守卫/预言家/女巫/守卫夜间）是否也缺少同类指导，一次性补齐。
- **检查方法**：`grep -n "identity_table 填写指导" aiPrompts.js` 列出所有现有指导段落，逐一核对是否含"追加"和"【追加示例】"。

---

### [2026-06-19 Round 25] 测试"无变量插值"断言：窗口必须以换行符为边界，不能用固定字节数

- **问题**：T22 检查"避免"指导文本行无 `${` 插值，使用了"避免" + 100字节窗口。但实际上 100字节后进入了 `return` 模板字符串区域，其中合法的 `${counterClaimText}` 触发了假失败。
- **根因**：指导文本（静态纯文字）与模板字符串（有合法插值）之间没有固定字节距离，用字节窗口会因代码长度变化而漂移。
- **教训**：检查"单行文本无 JS 变量插值"时，必须以**换行符**为边界（`nightSeerBlock.indexOf('\n', avoidIdx)`），而不是固定字节数。这确保只检查该行本身，不溢出到紧随其后的 `return` 语句。
- **通用规则**：所有"指导文本内容断言"应精确到行级别（indexOf + indexOf('\n', pos)），"代码块存在断言"才适合使用更大的窗口。

### [2026-06-19 Round 26] 对跳局面的"主动进攻框架"比"被动辩驳"更有竞技效果

- **问题**：DAY_SPEECH 预言家原来的"对跳预言家：拆解对方逻辑漏洞，用你的查验记录建立公信力"只有目标，没有方法。AI 会生成"我是真的预言家，对方是假的"这类无实质内容的声明。
- **教训**：竞技狼人杀中，对跳局面的核心竞争力不是"声称自己是真的"，而是"让对方的报告无法自圆其说"——两者认知负担不同，后者更可操作，更可信。具体三步法：① 主动公开记录（可追溯信息链）② 找矛盾点（冲突的查验结果）③ 心路历程收口（悍跳狼只有结果，没有决策过程）。
- **依据**：Wang 2025 信息链理论 + 竞技 meta 共识（心路历程是鉴别真假预言家的最可靠维度）。
- **修复**：Round 26 新增动态 `counterClaimants` 注入、对跳局面三步法 Section（Step A-B-C）、残局集票战模式（≤5人）；同步 seer.js + ROLE_PERSONAS 降级路径；35/35 测试通过。

### [2026-06-19 Round 26] roleParams 的参数传递只能解决"调用端→提示端"，不能解决"提示端→AI 执行"

- **发现**：将 `counterClaimants` 加入 roleParams 后，AI 在白天会知道"场上有人对跳"，但还需要具体的执行框架（三步法）告诉它"怎么做"。参数注入解决了"感知"，但策略框架才解决"执行"——两者缺一不可。
- **教训**：每次给提示词新增动态参数时，问两个问题：① 这个参数让 AI 感知到了什么？② AI 有没有明确的框架指导如何利用这个信息？如果只有感知没有执行框架，参数注入效果有限。

---

### [2026-06-20 Round 30] 隐性威慑提示词中的"禁止词示例"仍会激活 LLM 注意力

- **问题**：猎人 SHERIFF_SPEECH 提示词初版写 `绝不能说"我是猎人"或"我死了能开枪"` — 想通过负向示例告知 AI 不要说这些话，但"开枪"出现在提示词中（即使是"不能说X"语境），仍会被 LLM 激活关注。T10 检测到猎人分支含"开枪"字样后立即报失败，正是这个激活效应的早期拦截。
- **根因**：R1 教训（负向词汇列表会激活 LLM 注意力，"不要想白熊"效应）不仅适用于"禁止词列表"，也适用于"禁止措辞示例"中引用的具体词汇。即使句子结构是"不要说[X]"，LLM 对 X 仍会有更高的激活权重。
- **修复**：将具体禁止词替换为**抽象类别描述**：`绝不能明说身份或技能细节` 比 `不能说"我是猎人"或"我死了能开枪"` 更安全——前者只激活"身份/技能"这个类别概念，不激活具体词汇。
- **通用规则**：任何"禁止做X"的提示词，优先描述"应该做什么"（正向框架）；若必须用负向框架，用抽象类别描述（"不要暴露身份"）而非具体词汇示例（"不要说'我是猎人'"）。

### [2026-06-20 Round 30] 猎人隐性威慑竞选框架：不确定性本身是策略价值

- **背景**：猎人在警长竞选中有独特优势——死亡不是纯损失（必然开枪），但若直接说"我是猎人"会立刻暴露身份、消除狼人决策不确定性，反而丧失威慑。
- **框架设计原则**：好的隐性威慑应满足：① 让好人感受到"投你不亏" ② 让狼人无法确认你是否是猎人 ③ 不引导 AI 说出任何技能词汇。三者同时满足，才能维持"不确定性威慑"。
- **实现方式**：提供两个"改编角度"而非一个固定示例（改编 = AI 有创作余地 = 发言不会机械重复 = 更自然）；用"倒下了好人不亏"而非"我是猎人死了能开枪"实现等价语义。
- **下游验证**：此框架的效果需要实局验证（30 轮累计 0 次 LLM 对局），关注 `speech` 字段是否出现"即便最坏情况…也不亏"等隐晦措辞。

---

### [2026-06-20 Round 32] 骑士隐性威慑框架：主动进攻型 vs 猎人被动防御型的语义差异

- **背景**：骑士和猎人都适合"隐性威慑竞选"（不透露身份词汇，让狼方无法确认底牌），但两者的威慑来源根本不同。
- **猎人**："倒下了好人不亏"——被动防御，威慑来自死亡触发的技能（狼人刀你仍要付出"猎人开枪"的代价）。
- **骑士**："判断了就会直接落实"——主动进攻，威慑来自主动触发的技能（狼方无法确认警长是否会在关键时刻发动决斗）。
- **教训**：角色威慑框架的措辞必须反映技能触发方式（被动死亡触发 vs 主动选择触发）。两者都可以用隐性语言，但语义重心不同：猎人强调"即使被针对，好人也不亏"；骑士强调"在需要拍板时，我会主动做出最直接的判断"。使用相同的"倒下了不亏"语言描述骑士，会弱化骑士的主动威慑感。
- **检查方法**：每次为新角色设计隐性威慑框架时，先问"该角色的技能是主动触发还是被动触发？"，然后选择匹配的语义框架（主动：强调意志和执行力；被动：强调阵营不亏损）。

### [2026-06-20 Round 32] SHERIFF_SPEECH 所有特殊神职专属分支已全量补全

- **里程碑**：Round 32 为骑士（最后一个走 fallback 的特殊神职）补全了 SHERIFF_SPEECH 和 SHERIFF_RUN 专属分支。
- **最终覆盖状态**：预言家/狼人（主流程）、猎人（R30）、摄梦人/魔术师（R31）、骑士（R32）均有专属分支；女巫/守卫/村民走 fallback 是有意设计（女巫不上警策略已在 SHERIFF_RUN 单独处理）。
- **常驻检查义务**：每次新增角色时，必须检查 SHERIFF_SPEECH ssHint 链和 SHERIFF_RUN if-else 链是否需要添加该角色的分支。可用 `grep -o "playerRole === '[^']*'" src/services/aiPrompts.js | sort -u` 快速列出所有已有分支。

---

## 下轮建议

1. ~~**LAST_WORDS 遗言提示词增强**~~ ✅ Round 5 已完成
2. ~~**promptFactory.js 路径决策 — Plan B 删除死代码**~~ ✅ Round 14 已完成（~500 行，14/14 测试通过）
3. ~~**SHERIFF_BADGE_PASS 动态场景化**~~ ✅ Round 6 已完成
4. ~~**NIGHT_WITCH identity_table 补全检查**~~ ✅ Round 6 已完成
5. ~~**NIGHT_DREAMWEAVER identity_table 检查**~~ ✅ Round 7 已完成（全部 5 个 NIGHT_* case 现在均有 identity_table）
6. ~~**HUNTER_SHOOT 临界局势引导**~~ ✅ Round 7 已完成（alive-count 推断框架 + 决策路径）
7. **实局 smoke test（最高优先级）**：12 轮优化均无真实 LLM 验证。重点场景：骑士决斗触发（双预言家对跳局面）+ 魔术师 shouldReveal + SHERIFF_VOTE seer 数据实际利用率。
8. ~~**骑士/摄梦人/魔术师 LAST_WORDS 专属分支**~~ ✅ Round 8 已完成
9. ~~**DAY_SPEECH 中骑士/魔术师 identity_table 审计**~~ ✅ Round 8 已完成（通过接通专属模块，各自已有 identity_table）
10. ~~**骑士/摄梦人/魔术师 DAY_SPEECH 人格特征注入**~~ ✅ Round 9 已完成（baseRules.js getBaseContext 追加 currentPlayerTraits）
11. ~~**消除 getBaseContext 函数分叉**~~ ✅ Round 10 已完成（import 替代本地定义 + 删除 baseContext 死变量）
12. ~~**DAY_VOTE 场景化增强**~~ ✅ Round 11 已完成（跨轮热力 + 首轮/终局/PK 三层场景提示 + pkMode 消费修复）
13. ~~**SHERIFF_VOTE 增强**~~ ✅ Round 12 已完成（seer 查验候选人分类 + 角色专属策略 + identity_table + 判断框架）
14. **常驻检查项**：每轮结束后运行 `grep -o "'[^']*': (ctx, params)" aiPrompts.js` 对比角色列表，确保无缺口。
15. ~~**NIGHT_WOLF 协作增强**~~ ✅ Round 13 已完成（首狼决策人机制 + 后续狼跳过 AI 调用）
16. ~~**`promptFactory.js` Plan B 强制执行**~~ ✅ Round 14 已完成
17. ~~**狼人白天多狼分工提示**~~ ✅ Round 15 已完成（`let wolfTeammatesHint + if` 块，2狼主动/低调分工，3+狼激进/分析分工，残局票型精算模式）
18. **实局 smoke test**：16 轮无真实 LLM 验证，ECS 不在云端 allowlist，需用户在本地运行验证或在 allowlist 中加入 zhaxiaoji.com。
19. ~~**NIGHT_WOLF multiWolfHint 与白天角色分化提示一致性**~~ ✅ Round 16 已完成（在 multiWolfHint 末尾加入"白天角色分化：先开口担任主动方，后开口担任低调方"）
20. ~~**狼人 identity_table 策略化**~~ ✅ Round 16 已完成（NIGHT_WOLF + DAY_SPEECH 两处添加战略填写指导：高优先刀口/队友公开叙事一致性）
21. ~~**好人方 identity_table 质量提升（预言家 + 守卫）**~~ ✅ Round 17 已完成（NIGHT_SEER：夜间查验三级指导；DAY_SPEECH 预言家：确认事实 95-100 + 悍跳嫌疑场景；DAY_SPEECH 守卫：守护历史记录 + 神职候选标记）
22. **DAY_VOTE 跨轮热力表 review**：Round 11 添加了热力计算，但从未在真实对局中验证效果。在用户本地测一局，检查是否有 AI 明显的"热力盲从"或"历史覆盖"问题。
23. ~~**好人方 identity_table 第二阶段（女巫/猎人/村民）**~~ ✅ Round 18 已完成（DAY_SPEECH 女巫/猎人/村民 + NIGHT_WITCH 夜间指导，23/23 测试通过）
24. **实局 smoke test**：18 轮无真实 LLM 验证，ECS 不在云端 allowlist，需用户在本地验证。
25. ~~**DAY_VOTE 跨轮热力 review**~~（item 22 升级）✅ Round 19 已完成（5 边界情况纯函数验证全通过：首轮/全弃票/Top3排序/死玩家过滤/当天不自引用）
26. ~~**村民"追加"格式示例**~~ ✅ Round 19 已完成（村民+猎人各增加 `【追加示例】` 行，包含 before→after 分号拼接演示）
27. **实局 smoke test**（19 轮未完成）：ECS 不在云端 allowlist，需用户本地验证。重点关注：村民 reason 是否出现"N1...；N2..."追加格式；猎人 HUNTER_SHOOT 时是否利用了积累的开枪优先级。
28. ~~**骑士 shouldDuel 触发机制回顾**~~ ✅ Round 20 已完成（全链路审计：shouldDuel 消费 → handleKnightDuel → applyDuelResult → hasUsedDuel → roleParams → knight.js 阶段切换，无 bug）
29. ~~**魔术师 shouldReveal 回顾**~~ ✅ Round 20 已完成（修复死字段 bug：4 文件同步 hasRevealed 机制；23/23 测试通过）
30. **DAY_VOTE 热力"盲从"防护**：热力提示刻意加了"也可能是狼人刷票的靶子"警告，但没有给 AI 识别刷票靶子的具体方法。若真实对局发现 AI 盲从热力，可补充"若热力高但本轮发言合理，降低热力权重"指导。
31. **实局 smoke test**（20 轮未完成，最高优先级）：若云端 allowlist 加入 zhaxiaoji.com 立即执行；否则用户本地验证魔术师 hasRevealed 效果。
32. ~~**骑士决斗置信度阈值审计**~~ ✅ Round 22 已完成（aliveCount≤5 时 A=50%/B=40%，>5 时维持 A=70%/B=60%；endgameNote 动态显示）
33. ~~**JSON 触发字段全量审计（摄梦人）**~~ ✅ Round 21 已完成（dreamweaver.js: hasRevealed 条件化三阶段 + shouldReveal 输出；useSpeechFlow.js: 摄梦人消费块；23/23 测试通过）
34. ~~**魔术师 NIGHT_MAGICIAN hasRevealed 利用**~~ ✅ Round 22 已完成（身份已公开时优先级 C→A：自保跃升为最高；身份未公开时维持原顺序；23/23 测试通过）
35. ~~**骑士决斗置信度阈值审计**~~ ✅ Round 22 已完成（同 item 32，合并执行）
36. **实局 smoke test**（21 轮未完成）：ECS 不在云端 allowlist，需用户本地验证摄梦人 hasRevealed 效果。重点：宣告后次日是否收到"身份已公开"提示而非"阶段1 潜伏期"。
37. **实局 smoke test**（22 轮未完成）：用户本地验证魔术师 hasRevealed 夜间自保优先级 + 骑士终局阈值降低效果。
38. **DAY_VOTE 热力"盲从"防护**（item 30）：补充"识别刷票靶子"方法：若热力高但本轮发言合理且被狼嫌疑力推，降低热力权重。
39. ~~**NIGHT_* 状态接入系统审计**~~ ✅ Round 23 已完成（6 个 NIGHT_* case 全量审计：所有 identity_table 齐全；hasRevealed 仅 DREAM/MAG 相关，均已接入；无残余缺口）
40. ~~**NIGHT_DREAMWEAVER hasRevealed 评估**~~ ✅ Round 23 已完成（身份已公开时殉情跃升最高优先，阈值从 75% 降至 50%；25/25 测试通过）
41. **实局 smoke test**（23 轮未完成）：用户本地验证摄梦人宣告后次日夜间是否收到殉情最优先提示 + 魔术师 hasRevealed 夜间自保效果。
42. ~~**DAY_VOTE 热力"盲从"防护**~~ ✅ Round 24 已完成（三标准识别刷票靶子：①热力高但发言清晰 ②多狼嫌疑一致力推 ③热力高的人踩狼；决策原则：先评估发言再参考热力；26/26 测试通过）
43. ~~**守卫 identity_table 跨轮追加格式**~~ ✅ Round 24 已完成（DAY_SPEECH + NIGHT_GUARD 双处同步补全追加格式 + 【追加示例】；与村民/猎人 R19 格式对齐）
44. ~~**预言家夜间信息增量策略**~~ ✅ Round 25 已完成（NIGHT_SEER 五级优先级框架：悍跳响应>多路汇聚>投票关键位>信任链延伸>行为异常兜底；动态悍跳警报注入（claimHistory.jump_seer）；残局策略（≤5人精准打击模式）；主路径+seer.js+ROLE_PERSONAS 三处同步；30/30 测试通过）
45. **实局 smoke test**（24 轮未完成）：ECS 不在云端 allowlist；建议用户本地验证 DAY_VOTE 热力降权逻辑（观察 thought 字段推理）+ 守卫跨轮追加格式（连续 2 夜后检查 identity_table reason 格式）。
46. **实局 smoke test**（25 轮未完成）：重点关注 NIGHT_SEER 新策略——① 对跳局面是否优先验证对跳报告；② 残局（≤5人）是否切换精准打击模式；③ thought 字段是否出现"悍跳响应""信任链延伸"等框架语言。
47. ~~**DAY_SPEECH 预言家悍跳应对策略对齐**~~ ✅ Round 26 已完成（动态 counterClaimants 注入 + 对跳局面三步法 Step A-B-C + 残局集票战模式；seer.js + ROLE_PERSONAS 降级路径同步；35/35 测试通过）
48. **实局 smoke test**（26 轮未完成）：ECS 不在云端 allowlist；建议用户本地验证对跳局面预言家白天发言是否出现三步法框架语言（Step A/B/C）+ 残局（≤5人）是否切换集票战模式。
49. **DAY_VOTE 热力盲从效果观察**（item 42 后续）：实局验证热力降权三标准（清晰发言/狼嫌力推/正向踩狼）是否被 AI 正确使用。
50. **守卫跨轮追加格式效果回验**（item 43 后续）：连续守 2 夜后，identity_table reason 是否出现"N1守...；N2守..."追加格式。
51. ~~**DAY_VOTE 预言家对跳投票优先级**~~ ✅ Round 27 已完成（seerCounterClaimantsInVote 检测 + seerVoteStrategy 三路分支：对跳+PK必须投/对跳+普通优先/无对跳回退；27/27 测试通过；恢复 R1-R26 回归）
52. **实局 smoke test**（27 轮未完成）：ECS 不在云端 allowlist；建议用户本地验证对跳局面 DAY_VOTE thought 字段是否出现"对跳优先"等框架语言。
53. **防并发回归检查**：每轮开始时运行 `git merge-base HEAD origin/main` 确认工作基础是否最新，避免不同 session 使用旧版基础覆盖改进。
54. ~~**DAY_SPEECH + DAY_VOTE isSheriff 注入**~~ ✅ Round 28 已完成（roleParams 加 isSheriff；sheriffHint 后处理注入警长指路三分支；DAY_VOTE 加 sheriffVoteHint 1.5 票权重提醒；25/25 测试通过）
55. **实局 smoke test**（28 轮未完成）：建议用户本地验证警长发言结尾是否出现"我本轮指向X号"等指路语言。
56. ~~**SHERIFF_RUN 神职上警策略细化**~~ ✅ Round 29 已完成（猎人独立分支"值得认真考虑"含死亡双重威慑分析；女巫"默认不上警+双例外"；守卫"强烈建议不上警+极端例外"；let+if 块替代合并三元；25/25 测试通过）
57. **实局 smoke test**（29 轮未完成）：建议用户本地验证 AI 猎人上警率变化 + thought 字段是否出现"双重威慑/1.5票+开枪"等框架语言。
58. ~~**SHERIFF_SPEECH 猎人隐性威慑框架**~~ ✅ Round 30 已完成（隐性威慑框架：两个改编角度①②；"倒下了好人不亏"等价语义；绝不明说技能；T10 捕获负向示例白熊效应并修复；25/25 测试通过）
59. **实局 smoke test**（30 轮未完成）：建议用户本地验证猎人竞选发言 speech 字段是否出现"即便最坏情况好人也不亏"等隐晦措辞，且不出现"猎人"等身份词汇。
60. **DAY_VOTE 热力盲从效果观察**（item 49 续）：实局验证热力降权三标准是否被正确应用。
61. **守卫跨轮追加格式效果回验**（item 50 续）：连续守 2 夜后检查 identity_table reason 格式。
62. ~~**SHERIFF_SPEECH 摄梦人/魔术师专属分支**~~ ✅ Round 31 已完成（SHERIFF_SPEECH + SHERIFF_RUN 双处补全；摄梦人"杀我代价双倍"威慑框架 + 魔术师"信息修正权威×1.5票"框架；revealed/unrevealed 双状态各自处理；25/25 测试通过）
63. **实局 smoke test**（31 轮未完成）：ECS 不在云端 allowlist；建议用户本地验证摄梦人/魔术师竞选发言效果 + 上警决策变化
64. ~~**骑士 SHERIFF_SPEECH/SHERIFF_RUN 评估**~~ ✅ Round 32 已完成（骑士"隐性主动框架"未决斗 + "行动验证权威"已决斗，两状态；25/25 测试通过）
65. **SHERIFF_SPEECH 全角色覆盖常驻检查**：每轮结束后对比游戏中存在的角色列表，确认 SHERIFF_SPEECH 均有专属分支或有意选择好人 fallback（本轮骑士补完后，所有特殊神职均已覆盖）
66. **实局 smoke test**（32 轮未完成）：ECS 不在云端 allowlist；建议用户本地验证骑士上警决策 + 竞选发言（关注 thought 是否出现"双重不确定性"，speech 不出现"骑士/决斗"词汇）
67. **DAY_VOTE 热力盲从效果观察**（item 49 续）：实局验证热力降权三标准是否被正确应用
68. **守卫跨轮追加格式效果回验**（item 50 续）：连续守 2 夜后检查 identity_table reason 是否出现"N1守...；N2守..."追加格式
69. ~~**多狼发言顺序感知（isFirstWolfToSpeak）**~~ ✅ Round 33 已完成（useSpeechFlow.js 计算首发/后发 + wolf DAY_SPEECH ⭐主动方/低调方确认；25/25 测试通过）
70. **实局 smoke test**（33 轮未完成）：ECS 不在云端 allowlist；建议用户本地验证 2 狼局两只狼的 thought 字段是否分别出现"主动方/低调方"语言 + speech 内容差异化（一只质疑好人、另一只中立评委口吻）
71. ~~**pkMode 下 wolfRoleAssignment 评估**~~ ✅ Round 34 已完成（评估结论：不应在 PK 中沿用主动方/低调方分工，而应完全切换为防御框架；实现了 pkMode 覆盖逻辑 + 全局 pkHint；25/25 测试通过）
72. **实局 smoke test**（34 轮未完成）：ECS 不在云端 allowlist；建议用户本地验证 PK 发言——狼人 thought 是否出现"辩护"语言，双狼 PK 场景是否各自为战
73. ~~**预言家/守卫 PK 专属 pkHint 评估**~~ ✅ Round 35 已完成（预言家：部署全部查验+量化存活价值+ccLine 悍跳/无悍跳分支；守卫：暴露 vs 隐秘决策树+残局阈值≤5人；25/25 测试通过）
74. **DAY_VOTE 热力盲从效果观察**（item 67 续）：实局验证热力降权三标准是否被正确应用
75. **守卫跨轮追加格式效果回验**（item 68 续）：连续守 2 夜后检查 identity_table reason 格式
76. **实局 smoke test**（35 轮未完成）：ECS 不在云端 allowlist；建议用户本地验证预言家/守卫 PK 发言——预言家 thought 是否出现"部署查验"语言；守卫 thought 是否出现"暴露 vs 隐秘"权衡
77. ~~**其他角色 PK 专属框架评估**~~ ✅ Round 36 已完成（女巫：4 药量状态专属文案 hasSave/hasPoison 四分支；猎人：隐性路线 vs 明示路线双维度决策树 + 对手性质引导；28/28 测试通过）
78. **实局 smoke test**（36 轮未完成）：ECS 不在云端 allowlist；建议用户本地验证女巫/猎人 PK 发言——女巫 thought 是否出现"药量"论据；猎人 thought 是否选择了隐性/明示路线
79. **DAY_VOTE 热力盲从——执行框架补强**（item 74 续）：voteMomentumHint 已有三条评估标准（①②③），但没有"在参考热力前先对热力目标本轮发言独立打分"的执行步骤——感知-执行分裂待解决
80. **女巫/猎人 PK 效果回验**（新增）：用户本地验证女巫 4 种药量状态各自发言效果 + 猎人路线选择行为

---

### [2026-06-21 Round 36] 女巫/猎人 PK 框架：角色独特竞技资产必须专属化

- **女巫 PK 问题**：通用 pkHint 要求"陈述你存活的价值"，但女巫的价值是**可量化的具体药量资产**——双药均可用 / 仅解药 / 仅毒药 / 双药已用 四种状态对应完全不同的说服策略。通用框架对女巫等于给了目标但没给执行路径（感知-执行分裂）。
- **猎人 PK 问题**：猎人在 PK 中面临**二元路线选择**（隐性威慑 vs 明示身份），取决于对手性质（嫌疑玩家 → 隐性；明确好人 → 明示）。通用框架不知道"死亡不是纯损失"这个独特竞技优势，更不知道这个优势的利用路线。
- **修复**：女巫：4 分支 `let witchMedLine + if/else if` 块（R15/R18 规范），从 `roleParams.hasWitchSave/hasWitchPoison` 读取状态；猎人：双维度决策树（维度A/B），在 `thought` 中自主选择。
- **通用规则**：为 PK 等特殊发言场景设计通用框架后，必须逐角色问："该角色在此场景中有什么**可量化的专属资产**（如药量/查验记录/守护历史）或**二元决策树**（如暴露 vs 隐秘/隐性 vs 明示）？如有，必须提供专属框架，通用的'陈述价值'无法替代具体执行路径。"
- **猎人特例注意**：R30（sheriff election）要求猎人 speech 不含技能词汇（隐性威慑）；但 PK 场景中"维度B明示路线"包含"猎人/开枪"是合法的——两者不矛盾，区别在于 sheriff election 只有一条最优路线（隐性），PK 有两条路各有适用场景。

---

### [2026-06-19 Round 27] 并发 session 导致改进被覆盖：后到 commit 使用旧版基础

- **问题**：`feat(werewolf): 警长机制`（f8e75f6）和 `feat(werewolf): 遗言系统`（8c1964b）使用了比 2184daf 更早的 aiPrompts.js 版本作为基础，导致 R1-R26 的约 300 行改进（女巫 taboo/狼人多协作/预言家对跳三步法/DAY_VOTE 全部场景化/identity_table 跨轮记忆格式等）被静默覆盖。git 不报 conflict，因为修改路径与改进路径完全独立。
- **根因**：两个并发运行的 session（tennis vs werewolf）各自从不同时间点的 HEAD 开始工作。若 session A 提交在 session B 之后，且 B 从 A 提交前的版本开始工作，B 的提交会静默覆盖 A 的改进。
- **检测方法**：每轮开始时运行 `git diff HEAD origin/HEAD -- src/services/aiPrompts.js | wc -l`，若结果 > 50，说明本地工作基础比远端落后较多，需要先 `git pull` 再开始。
- **修复**：从 2184daf 恢复完整版 aiPrompts.js（含 R1-R26 全部改进）叠加 R27 改进后 push 到 main。
- **教训**：云端定时任务的 HEAD detach 可能停留在历史提交。每轮务必先 `git fetch && git status`，确认本地状态与 origin/main 对齐后再开始工作。

---

### [2026-06-20 Round 28] player 字段存在于对象上 ≠ 提示词已消费——需主动扫描所有 action case

- **问题**：`isSheriff` 字段在 `player.isSheriff` 上存在、在 `useDayFlow.js` 中用于投票权重计算，但在 `aiPrompts.js` 的任何 `DAY_*` 或 `NIGHT_*` case 中均未被消费，导致 28 轮内警长 AI 发言无"指路"行为、投票无 1.5 票权重感知。
- **根因**：每次新增 player 字段时，只检查了"有没有添加到 player 对象"，没有问"哪些 action case 在该字段影响最优策略时需要感知它"。
- **教训**：新增或修改任何 player 状态字段时，必须扫描所有 `DAY_*` 和 `NIGHT_*` case，问"此字段在该 action 的决策时刻是否改变最优策略？如是，是否已传入且被消费？"——这是 R22 关于 `hasRevealed` 的同类遗漏，也是 R6 教训的同类问题，应被视为常驻检查义务而非单次修复。
- **修复模式**：采用"后处理注入"模式（在 `rolePromptGenerator` 之后、`CLAIMS_SCHEMA_SUFFIX` 之前插入特殊任务块），避免修改 9 个角色函数，是处理"所有角色共有但不通用"的横切关注点的最简方式。
- **可泛化规则**：对警长类"横切关注点"（同时影响所有/多数角色但内容不同），后处理注入比修改每个角色函数更可维护；对单角色专属字段，直接在对应 case 传入并消费。

---

### [2026-06-20 Round 29] 委托模式的测试需要联合验证委托目标文件

- **问题**：T24 回归测试检查"所有 NIGHT_* case 均含 identity_table"，在 aiPrompts.js 中扫描 NIGHT_MAGICIAN 的 case 块时，块内只有 `return magicianModule.nightAction(...)` 而没有字面量 `identity_table`，导致测试误报 FAIL。实际上 identity_table 在 magician.js 的 `getMagicianNightActionPrompt` 返回字符串中（line 194）。
- **根因**：`NIGHT_MAGICIAN` 和 `NIGHT_DREAMWEAVER` 两个 case 通过委托模式（`roleModule.nightAction()`）把提示词生成移到了各自的 `.js` 文件中，不在 aiPrompts.js 的 case 块内。这与 `NIGHT_GUARD/SEER/WOLF/WITCH` 直接内联的模式不同。
- **教训**：每次编写"全量字段存在性"测试时，必须先确认每个 case 的实现模式：① 直接内联 → 只扫 aiPrompts.js ② 委托模块 → 同时扫 aiPrompts.js + 委托目标文件。可用 `grep -n "roleModule.nightAction\|Module.nightAction"` 快速找出哪些 case 使用委托模式。
- **修复**：Round 29 将 T24 改为：直接实现的 4 个 case 在 aiPrompts.js 中检查；NIGHT_MAGICIAN → 检查 magician.js；NIGHT_DREAMWEAVER → 检查 dreamweaver.js。
- **常驻清单更新**：如未来新增 NIGHT_KNIGHT 等 case 且也采用委托模式，需在 T24 中增加对应文件的检查。

---

### [2026-06-20 Round 30] 提示词中的"禁止词示例"自身也会激活 LLM 注意力（白熊效应扩展）

- **问题**：为猎人 `SHERIFF_SPEECH` 撰写隐性威慑框架时，初版写了 `绝不能说"我是猎人"或"我死了能开枪"`——"开枪"出现在负向语境中，但 T10 测试检查猎人分支不含"开枪"时立即失败，说明提示词中的具体禁止词示例已被传给 AI，仍会在输出中激活该词汇。
- **根因**：R1 白熊效应的自然延伸：不仅"请不要想大象"会激活"大象"，"绝不能说X"同样会让 X 进入 LLM 的高激活状态，即使出现在否定语境中。禁止词示例与禁止词本身对 LLM 注意力的影响几乎等价。
- **修复**：将 `绝不能说"我是猎人"或"我死了能开枪"` 替换为抽象描述：`绝不能明说身份或技能细节，一旦直接点破反而丧失隐性威慑`。完全不出现具体禁止词。
- **教训**：提示词中任何形式的具体禁止词示例（包括加引号的"负向范例"）都是禁忌——用抽象类别描述替代，避免任何具体词汇出现。测试中可用负向断言验证此约束（T10: `!hunterBlock.includes('开枪')`）。

---

### [2026-06-20 Round 31] Python 写文件时 `\$` 是两个字符，不是 JS 模板字符串转义

- **问题**：用 Python 脚本向 aiPrompts.js 写入 JS 模板字符串时，Python 字符串中的 `\${badgeFlowLine}` 会被原样写入文件（`\$` 在 Python 中是反斜杠+美元号两个字符，Python 不识别为特殊转义）。JS 模板字符串收到 `\${badgeFlowLine}` 后，把 `$` 当作转义处理，输出字面量 `${badgeFlowLine}` 而非变量值，导致 AI 提示词中出现未插值的占位符字符串。
- **根因**：Python 和 JavaScript 的转义规则不同。Python 字符串中 `\n`/`\t` 有意义，但 `\$` 没有对应转义含义，保留为两个字符。JS 模板字符串中 `\${` 是对 `$` 的显式转义，阻止插值。两者叠加造成跨语言写文件时的静默语义错误。
- **修复**：在 Python 中直接写 `${badgeFlowLine}`（不加反斜杠）；已写入的 `\${...}` 用 `content.replace('\\${badgeFlowLine}', '${badgeFlowLine}')` 批量修复。
- **防范**：测试脚本中加入负向断言（T15: `!speechBlock.includes('\\${badgeFlowLine}')`），监测此类静默错误。凡 Python 脚本向 JS 模板字符串写内容时，事后必须用 `grep '\\${'` 检查写入结果。

---

### [2026-06-20 Round 33] 多代理协作策略必须配套"角色身份感知"——感知-执行分裂是策略失效的根因

- **问题**：R15 在狼人 DAY_SPEECH 中加入"先开口担任主动方/后开口担任低调方"的角色分工指导，但 `askAI(currentSpeaker, PROMPT_ACTIONS.DAY_SPEECH)` 不传任何参数，AI 无法得知自己是先还是后发言 → 可能两只狼都成主动方（同时质疑同一目标，协作暴露），或两只狼都低调（失去攻击主动权）。
- **根因**：这是"感知-执行分裂"（Perception-Execution Split）的典型模式：有策略框架（执行），但缺少当前状态感知（感知）。参照 Wang 2025 §4.3：多代理欺骗需要"全局策略 + 局部感知"同时具备。
- **修复**：在 `useSpeechFlow.js` 的 `triggerAISpeech` 中，通过 `speechHistory.some(s => s.day === dayCount && s.playerId === id)` 判断当天是否有队友已发言，计算 `isFirstWolfToSpeak: boolean`，透传给 wolf DAY_SPEECH 提示词，在 `wolfTeammatesHint` 中生成 `⭐【本轮你是：主动方/低调方】` 明确确认。
- **通用规则**：每次在提示词中加入"依据当前状态做出不同行为"的指导（如"若你是 X 则做 A，若你是 Y 则做 B"），必须同时检查调用端是否传递了区分 X/Y 的具体数据。没有数据的状态感知 = 随机猜测 = 策略失效。
- **边界处理**：solo wolf（无存活队友）不传 `isFirstWolfToSpeak`（保持空 params），提示词中 `wolfRoleAssignment = ''` 安全兜底；死亡队友过滤 `p.isAlive`；跨天记录过滤 `s.day === dayCount`。

---

### [2026-06-21 Round 35] 通用 PK 框架的"感知-执行分裂"：角色有独特竞技优势时必须专属框架

- **问题**：Round 34 引入的通用 `pkHint`（"陈述你存活的价值"）对**预言家**和**守卫**存在"感知-执行分裂"：通用框架提供了目标（"说明你有什么价值"），但没有提供这两个角色专属的执行方法。预言家的存活价值是**可量化的**（未来查验能力、信息链），守卫面临的是**二元决策树**（暴露身份 vs 保持隐秘），两者都无法被通用的"不要泛说你是好人"所覆盖。
- **预言家专属框架三要素**：① 部署全部查验记录（PK 是公开信息的最佳时机，包括之前保留的）；② 量化存活价值（"我还有未来的查验能力"是可测量的论据）；③ ccLine 分支：有悍跳对手 → 执行 Step A-B-C；无悍跳对手 → 提供新判断。
- **守卫专属框架两条路**：① 暴露身份 vs 保持隐秘的决策树，取决于局面价值；② 残局（≤5人）暴露收益更高；③ 非残局：评估场上保护力量后决定；④ 两条路都要求新论点。
- **通用规则**：为 PK 等特殊发言场景设计通用框架后，必须逐角色问"该角色在此场景中有什么通用框架无法捕获的独特竞技优势？"如有独特优势（可量化的价值/二元决策树），必须提供专属框架而非依赖通用描述。
- **实现方式**：在 `pkHint` 块使用 `let + if (playerRole === ...)` 分支（R15 规范），pre-compute `ccLine`/`phaseLabel` 后注入模板字符串（R18 规范）。所有数据（`counterClaimants`/`aliveCount`）在 `roleParams` 中已有，无需改动调用端。

---

### [2026-06-21 Round 34] PK 发言是「发言目的反转」场景——进攻协作框架在防御模式完全失效

- **问题**：`wolfTeammatesHint`（主动方/低调方角色分化）在 `pkMode: true` 的 PK 发言中被原样发送给 AI。但 PK 是防御场景（目标：说服他人不投自己），而 `wolfTeammatesHint` 完全是进攻协作框架（目标：分散好人注意力、协调投票方向）。两者目标正相反，AI 会收到矛盾指令而无法正确执行。
- **最危险子场景**：双狼都进入 PK（`teammatesInPk.length > 0`）——如果其中一只执行"主动方"框架（质疑第三方好人）而非自我辩护，好人立刻能看出两只狼行为的异常协调，关系链立即暴露。
- **根因**：每次添加新的 `params`（如 `pkMode`）时，没有检查已有的条件化策略块（如 `wolfTeammatesHint`）是否需要在该新参数的语义下重新设计。
- **修复**：在 `wolfTeammatesHint` 构建块之后添加 `if (params.pkMode)` 覆盖：双狼 PK → 反协调指令（攻击队友逻辑漏洞）；场外队友 → 中性轻提示（无协作指令）。同时为所有角色添加全局 `pkHint` 后处理（新论点 / 直接对抗 / 存活价值）。
- **通用规则**：每次为现有动作添加新的模式参数（如 `pkMode`、`endgameMode`）时，必须检查所有已有的条件化策略块并问"在这个模式下，该策略块的目标函数是否发生了反转？如果是，需要完全覆盖而不是叠加"。进攻目标和防御目标反转时，策略框架必须随之反转，不能部分覆盖。

