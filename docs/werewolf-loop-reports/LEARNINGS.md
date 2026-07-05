# AI 狼人杀评估优化 — 跨轮教训库

> 每轮追写。格式：`[YYYY-MM-DD HH:MM UTC] 教训简述（原因）`

---

### [2026-07-05 Round 120] 守卫 DAY_VOTE 读写闭环——guardHistory 作投票排除锚点（所有神职 DAY_VOTE 全覆盖）

- **完成状态**：`aiPrompts.js` DAY_VOTE case 新增 7 个变量（`dvGuardHistory/dvGuardProtectedAliveIds/dvGuardFreqMap/dvGuardLastTarget/dvGuardProtectedSummary/dvGuardLastTargetRef/guardVoteStrategy`）+ return 链插入 `playerRole === '守卫' ? guardVoteStrategy`（在魔术师分支之后）。DAY_VOTE block 13246 → 15065 chars（+1819 chars）；R71 窗口 14500 → 16000；R72 窗口 13000 → 16000；R64 T12 更新为正向确认。全量测试 2179/2179 ✅，build ✅。
- **守卫零间接信息设计（R120-A）**：`dvGuardHistory` 使用 `playerRole === '守卫'` 门控，`dvGuardProtectedAliveIds` 用 `Set` 去重（同一玩家可被保护多夜），`dvGuardFreqMap` 记录频次（多次守护=核心盟友）。排除锚点是守卫信息最直接的利用方式。**设计原则：守卫和预言家同样拥有零间接私有信息，应用相同"直接读取结构化数据 >> NLP 推断"原则**。
- **DAY_VOTE 窗口级联铁律（R120-B）**：每次新增超过约 800 chars 时，`输出JSON格式:` 可能超出原窗口。**检测命令（每次新增后必跑）**：`node -e "const s=require('fs').readFileSync('src/services/aiPrompts.js','utf8'); const a=s.lastIndexOf('case PROMPT_ACTIONS.DAY_VOTE:'); const block=s.slice(a,a+20000); console.log('block size:', block.indexOf('case PROMPT_ACTIONS.',1), 'JSON offset:', block.indexOf('输出JSON格式:'))"` 当前窗口需求：R71(16000)、R72(16000)、R119(16000)、R120(16500)。
- **R64 obsolete test 更新模式（R120-C）**：早期轮次的"禁止性"测试（`expect(X).toBe(false)`）被后续轮次颠覆时，必须更新为正向确认（`expect(X).toBe(true)`）并标注更新轮次。**铁律：任何新功能可能改变已有 false-assertion 测试时，全量 vitest 前先搜索 `toBe(false)` 相关测试，预判可能受影响的测试**。
- **守卫 DAY vs NIGHT 信息利用差异（R120-D）**：NIGHT_GUARD 读 identity_table "守护优先级"（AI 规划记忆）；DAY_VOTE 读 `gameState.guardHistory` 结构数据（系统记录的真实行为）。**两者互补独立，NIGHT 侧利用 AI 自行规划，DAY_VOTE 侧利用系统 ground truth**。
- **测试**：2179/2179（+17 new R120 tests T1-T17；R71/R72/R64 窗口+逻辑修复；1 pre-existing chatSocket failure 无关）；build ✅（WerewolfModule 258.59 kB）；check-build ✅；干跑 25/25 ✅。
- **下轮优先**：平衡性评估（N=100局干跑模拟统计狼/好人胜率），或女巫 DAY_VOTE 策略（witchHistory 药效状态 → 投票框架）。

---

### [2026-07-05 Round 119] 预言家 DAY_VOTE 读写闭环——seerChecks 作投票锚点（三路径 + confidence=100）

- **完成状态**：`aiPrompts.js` DAY_VOTE case 新增 5 个辅助变量（`dvSeerMyChecks/dvSeerConfirmedWolves/dvSeerConfirmedGood/dvSeerKillSummary/dvSeerGoodSummary`）+ `seerVoteStrategy` 从 2路径升级为3路径（对跳优先 > 有查杀记录 > 无记录）。直接从 `gameState.seerChecks` 读取结构化已验结果（不依赖 AI 对 identity_table 的 NLP 解析）。DAY_VOTE block 约 11728→13246 chars（+~1518 chars）。全量测试 2148/2148 ✅，build ✅。
- **seerVoteStrategy 三路径设计（R119-A）**：预言家 DAY_VOTE 独有"对跳优先"作为最高优先级路径（因对跳=已知狼人，高于任何 seerChecks 锚点）；第二路径为有存活查杀记录（`dvSeerConfirmedWolves.length > 0`）时展示具体 ID + confidence=100；第三路径为无锚点通用。**设计原则：与猎人/骑士/摄梦人/魔术师不同，预言家有独立的"对跳优先"第一优先级，必须在对跳路径中同时展示查验锚点（信息复用原则）**。
- **金水禁令从负向改正向（R119-B）**："绝不投金水" → "已确认好人，从投票选项中排除（confidence 最高，维持队友信任）"。第 34 次应用白熊效应正向铁律（R112 第 33 次）。**铁律累计：每次遇到"绝不X/千万别X"在提示词中时，必须重写为"Y（正向结果）"的等价描述**。
- **DAY_VOTE 窗口必须覆盖 `输出JSON格式:` 行（R119-C）**：该行位于 DAY_VOTE block 末尾（约 offset 13000+）；R71 原窗口 12000 被 +1518 chars 超出，T9/T10 失效。修复：12000 → 14500。**铁律：新增操作使 DAY_VOTE block 超过 R71 窗口时，必须更新 R71 测试窗口**（已建立为新铁律）。
- **测试**：2148/2148（+17 new R119 tests T1-T17；R71 窗口修复 3 tests 恢复；1 pre-existing chatSocket failure 无关）；build ✅（check-build 零泄露）。
- **下轮优先**：守卫 DAY_VOTE 读写闭环（最后一个未注入私有信息的角色），完成后所有神职角色 DAY_VOTE 均有专属锚点。

---

### [2026-07-05 Round 118] 骑士/魔术师 DAY_VOTE 私有信息注入——决斗验证锚点 × 交换知识一手信息

- **完成状态**：`aiPrompts.js` DAY_VOTE case 扩展骑士 post-duel 路径 + 魔术师双路径。骑士：`knightVoteStrategy` 的 true-branch 由单行通用扩展为结构化三步（a 决斗验证锚 b 投票优先排序 c 票权锁定），引导 AI 从 identity_table 中找"已决斗出局"的确认狼人，并将其生前"保护/力挺/金水"的存活玩家列为连带嫌疑（confidence 下调 20-30）。魔术师：新增 `dvMagIsRevealed`（`currentPlayer?.hasRevealed`）、`dvMagHistory`（`gameState.magicianHistory`）、`dvMagSwappedCount`（交换次数）、`dvMagRevealedVoteStrategy`（公开路径策略），返回链魔术师分支改为内嵌三元 `(dvMagIsRevealed ? dvMagRevealedVoteStrategy : magicianVoteStrategy)`；隐藏路径保持 R72 换刀候选框架不变。DAY_VOTE block 约 11728→12200 chars（+~480 chars）。
- **hasUsedDuel 在 DAY_VOTE 的语义（R118-A）**：`knightHasDueledForVote=true` 在 DAY_VOTE 阶段必然代表**成功决斗**，因为决斗失败导致骑士死亡→骑士无法进入投票阶段。因此 post-duel 路径无需任何 fallback，可直接无条件读取 identity_table 中"已决斗出局"的确认狼人。**设计原则：AI 的私有状态标志（hasUsedDuel、hasRevealed、hasUsedAbility）在不同 PROMPT_ACTIONS 下的语义可能不同；DAY_VOTE 中的状态是经过存活过滤后的语义，必须考虑"死亡玩家不会调用"这一隐含前提**。
- **内嵌三元保护原有测试（R118-B）**：为避免破坏 R72 的 `getMagicianStrategyContent()` 提取器（依赖 `const magicianVoteStrategy = \`` 关键字），将隐藏路径保留为独立变量 `magicianVoteStrategy`（不变），新增公开路径变量 `dvMagRevealedVoteStrategy`，通过内嵌三元路由。**设计原则：当新路径需要分叉且存在依赖原变量名的测试提取器时，保持原变量名作为旧路径、新增变量作为新路径，通过三元路由是最小干扰方案；切勿将原变量改为三元，否则会破坏所有依赖该关键字的提取器**。
- **窗口参数偏移规律（R118-C）**：在 return 链中插入内嵌三元时，三元后续的变量名（如 `magicianVoteStrategy`）在固定字符窗口内的位置会向后移动约 40-50 chars（三元表达式长度）。本轮修复 R72 T13 窗口 80→120 chars。**检测方法：每次修改 return 链三元顺序后，手动计算从 `playerRole === 'X'` 到目标变量名的字符偏移，确保测试窗口足够大**。
- **白熊效应合规（第 40 次验证）**：`dvMagRevealedVoteStrategy` 内容全正向描述（"交换知识锚""一手信息""引导好人阵营对齐"），无"绝不能/禁止"；"不要"词仅在"不要覆盖/不要重复"技术追加格式语境下允许（T13 合规检查覆盖）✅。
- **测试**：2118/2118（+15 new R118 tests T1-T15；R72 T13 窗口 80→120 修复；1 pre-existing chatSocket failure 与本轮无关）；build ✅（check-build 零泄露）。
- **下轮优先**：① 预言家 DAY_VOTE 读写闭环（NIGHT_DIVINE 查验结果写入 identity_table，DAY_VOTE 优先级提升）；② 猎人 DAY_VOTE 私有信息注入（`hasUsedAbility` 状态路由）；③ 守卫 DAY_VOTE 策略（夜间守护记录推断投票目标）。

---

### [2026-07-04 Round 112] 女巫 + 守卫 SHERIFF_SPEECH 专属提示词——信息权威 × 药效执行力框架

- **完成状态**：`aiPrompts.js` SHERIFF_SPEECH case 在 `knightSsHint` 之后新增 7 个变量：① `witchSsSaveHave`（`currentPlayer?.hasWitchSave ?? false`）；② `witchSsPoisonHave`（`currentPlayer?.hasWitchPoison ?? false`）；③ `let witchSsMedStatus` + if-else 4路径（双药均在/解药在手+毒药已用/毒药在手+解药已用/双药已用）；④ `const witchSsHint`（`hasRevealedIdentity` 三元：已跳身份→信息权威×药效执行力框架 / 未公开→"有底气的好人"隐性竞选框架）；⑤ `const guardSsHint`（`hasRevealedIdentity` 三元：已公开→守护记录信任锚点 / 未公开→稳健理性好人框架）。ssHint 链插入 `playerRole === '女巫' ? witchSsHint : playerRole === '守卫' ? guardSsHint` 在骑士之后、通用 fallback 之前。SHERIFF_SPEECH block 3876 → 5935 chars（+2059 chars）；WerewolfModule 250.90→252.07 kB（+1.17 kB）。
- **SHERIFF_SPEECH 覆盖完整闭合（R112-A）**：至此，所有 8 个特殊神职均有专属 SHERIFF_SPEECH 框架：预言家（信息资产展示）+ 狼人（悍跳/好人竞选）+ 猎人（隐性威慑）+ 摄梦人（双路威慑）+ 魔术师（信息修正权威）+ 骑士（隐性主动/行动验证）+ 女巫（药效矩阵×信息权威）+ 守卫（守护记录锚点×稳健框架）= 完整覆盖。村民走通用 fallback 是有意设计。**SHERIFF_SPEECH 覆盖审计完毕，下次无需再检查此维度**。
- **女巫 4路径药效矩阵（R112-B）**：与 PK辩护模式（lines 1666-1677）保持一致的状态分类体系：双药均在（杠杆放大器）/ 解药在（救援价值高）/ 毒药在（精准打击保留）/ 双药已用（决策记录竞选）。**设计原则：相同的角色状态在不同提示词上下文中应使用一致的分类框架，避免 AI 在不同场景下对同一状态有不同解读**。
- **守卫已公开身份框架（R112-C）**：守护记录是零间接信任锚点（同 DAY_SPEECH R104），身份公开后"报出守护过的关键目标"是最强竞选论据。**设计原则：守卫 DAY_SPEECH（R104）已建立守护记录可核实的框架，SHERIFF_SPEECH 守卫已公开分支应复用同一核心论据**。
- **Detached HEAD 恢复（R112-D）**：本轮再次触发 detached HEAD 状态。恢复协议（第 4 次应用）：① `cp <files> /tmp/`；② `git stash push -u`；③ `git checkout main && git fetch origin main && git reset --hard origin/main`；④ `git stash drop`（NOT pop）；⑤ `cp /tmp/<files> <原路径>`。**协议已固化为标准流程，detached HEAD 是本项目的高频问题，每轮工作开始先 `git status` 确认 `On branch main`**。
- **白熊效应合规（第 33 次验证）**：`witchSsMedStatus` 4路径推断内容全正向描述（"双药均在：…杠杆放大器"/"解药在手：…救援机会"/"毒药在手：…精准打击机会"/"双药已用：…判断力证明"），无 自曝/禁止/绝不能/千万别 ✅（T17 测试覆盖）。
- **测试**：1952/1952（+20 new R112 tests T1-T20；1 pre-existing chatSocket failure 与本轮无关；干跑 simulate-game-flow.mjs 25/25 ✅）；build ✅（WerewolfModule 252.07 kB）；check-build ✅。
- **下轮优先**：①SHERIFF_BADGE_PASS 遗言流审计（哪些角色有专属传徽策略框架？）；②平衡性评估（simulate-game-flow.mjs 多局干跑统计狼/好人胜率）；③SHERIFF_VOTE 守卫/女巫投票策略审计。

---

### [2026-07-03 Round 111] LAST_WORDS 遗言背景上下文增强（lwContextBlock）— 天次 + 先行出局 + 被投出票型摘要

- **完成状态**：`aiPrompts.js` LAST_WORDS case 新增 7 个外层变量：① `lwDay`（`gameState?.dayCount ?? 1`）；② `priorDeaths`（`deathHistory.filter(d => d.playerId !== currentPlayer?.id)`）；③ `lwDeathsText`（三元：有先行出局→`X号(DY夜/投票)`列表 / 无→`（无先行出局玩家）`）；④ `isVotedOut`（`cause.includes('投')`）；⑤ `let lwVotedByText = ''` + if 块内：⑥ `lastVoteRound`（`voteHistory.slice(-1)[0]`）和 ⑦ `votesAgainstMe`（`v.to === currentPlayer?.id` 过滤）；⑧ `lwContextBlock`（背景行模板字符串）。return 首行由 `你已死亡（${cause}）` 改为 `你已死亡（D${lwDay}，${cause}）`，且在首行之后、`${lwRoleHint}` 之前注入 `${lwContextBlock}`。LAST_WORDS block 3776 → 4869 chars（+1093 chars）；round54 窗口 4500→5500（12 处）。
- **遗言上下文三维增强（R111-A）**：遗言现在提供三个维度的上下文：① D${lwDay} 天次（AI 知道自己在第几天死）；② 先行出局列表（谁先走、什么原因死的，有助遗言引用已知死亡推断）；③ 被投出时的票型（谁投了你，这些人是潜在对立面/狼队嫌疑）。这三个维度直接提升遗言与局势的契合度，避免 AI 生成脱离游戏背景的遗言。**设计原则（Wang 2025 arxiv:2408.17177）：结构化历史上下文注入是提升 AI 信息决策精准度的核心机制；遗言是局中信息传递的关键节点，缺乏上下文的遗言质量直接影响好人阵营追查能力**。
- **voteHistory from/to 键规范（R111-B，第 2 次应用 R96 规则）**：`votesAgainstMe` 过滤用 `v.to === currentPlayer?.id`（非 `v.targetId`）。R96 教训已明确：`recordVoteRound` 存储时将 `voterId/targetId` 映射为 `from/to`；所有 voteHistory 读取必须用 `from/to` 键，禁用 `v.targetId`。此为第 2 次在 LAST_WORDS 相关代码中应用该规则，证明该规范已标准化。
- **round54 LAST_WORDS 窗口级联规律（R111-C）**：LAST_WORDS block +1093 chars（3776→4869），关键词 `整局积累` 从 3506 移至 4571，`帮助场上好人继续追查` 从 3577 至 4642，均超出旧窗口 4500。**标准检测命令：`node -e "const s=require('fs').readFileSync('src/services/aiPrompts.js','utf8'); const a=s.indexOf('case PROMPT_ACTIONS.LAST_WORDS: {'); const b=s.indexOf('case PROMPT_ACTIONS.SUMMARIZE_CONTENT',a); console.log('LAST_WORDS size:',b-a,'整局积累 at:',s.slice(a,a+6000).indexOf('整局积累'))"`；LAST_WORDS 任何新增代码后必须运行，若关键词超出 round54 窗口（当前 5500）立即更新**。
- **白熊效应合规（第 32 次验证）**：新增变量块全正向描述（"先行出局"/"投你出局"/"D${lwDay}出局背景"），无负向禁词 ✅（T17 测试覆盖）。
- **测试**：1932/1932（+20 new R111 tests T1-T20；+round54 窗口 4500→5500；干跑 15/15 ✅；1 pre-existing chatSocket failure 与本轮无关）；build ✅（WerewolfModule 250.90 kB）；check-build ✅。
- **下轮优先**：①游戏机制干跑模拟（useWerewolfGame.js reducer 完整一局流程，验证夜间顺序/投票/猎人连锁/胜负判定）；②警长竞选发言角色缺口审计（SHERIFF_SPEECH 是否所有角色都有专属发言框架？）；③平衡性评估。

---

### [2026-07-03 Round 110] 魔术师 DAY_SPEECH 平安夜逻辑镜像推断三层体系（isPeacefulNightMagicianDay + isConsecutivePeacefulMagicianDay + isTripleConsecutivePeacefulMagicianDay）— Prepend Injection 第 25 次

- **完成状态**：`magician.js` `getMagicianDaySpeechPrompt` 新增 11 个变量：① `isPeacefulNightMagicianDay`（`ctx.dayCount > 1 && ctx.lastNightInfo?.includes('平安夜')`）；② `magDayPrevDay`；③ `isConsecutivePeacefulMagicianDay`（`dayCount >= 3 + fullGameTimeline N-2:平安夜`）；④ `magDayPrevPrevDay`；⑤ `lastDayHadSwap`（`lastSwap && lastSwap.player1Id !== null`）；⑥ `lastDaySwapRef`（有换/未换两路参数化）；⑦ `swapDayStatusHint`（有换 confidence 升 15-20 / 未换 confidence 升 10-15）；⑧ `let magDayPeaceStep = ''` + if 块内：⑨ `isTripleConsecutivePeacefulMagicianDay`（`dayCount >= 4 + isConsecutive + fullGameTimeline N-3:平安夜`）；⑩ `magDayThreePrevDay`；⑪ `tripleConsecutivePeaceDayHintMag`；⑫ `consecutivePeaceDayHintMag`（前置三连，Prepend Injection 第 25 次）。注入方式：`${magDayPeaceStep}` 在 return 模板 `${magicianDayHistoryStep}` 之后、`Step1:` 之前。函数从 4403 → 7224 chars（+2821 chars）；round77 窗口 6000→8000。
- **魔术师 DAY_SPEECH vs NIGHT 推断框架差异（R110-A）**：NIGHT_MAGICIAN 推断结论是「今晚换刀方向（行动决策）」；DAY_SPEECH 推断结论是「更新逻辑镜像表 + identity_table 标注（信息整合）」。两者使用相同的 `lastSwap` 信息但结论目标不同。**设计原则：DAY 侧推断结论应适配 DAY 侧决策框架（信息整合→speech 策略），NIGHT 侧推断结论适配 NIGHT 侧决策框架（行动选择）；不能套用同一结论模板**。
- **平安夜推断矩阵完整闭合（R110-B）**：至此，所有需要平安夜推断的角色/侧均已覆盖：DAY_SPEECH 侧（Wolf/Guard/Seer/Witch/Villager/Knight/Dreamweaver/Magician 共 8 个）；NIGHT 侧（Guard/Wolf/Seer/Witch/Dreamweaver/Magician 共 6 个）；猎人 HUNTER_SHOOT 和骑士无夜间行动，不需要。**下轮起，平安夜推断系列已完整，应转向其他优化维度（游戏机制/平衡性/警长/遗言/干跑模拟）**。
- **round77 窗口级联规律（R110-C）**：`getMagicianDayBlock()` 窗口 6000→8000（函数体 +2821 chars，`${magicianSpeechLen}` 从 4207 移至 7028，超出旧窗口 6000）。**检测命令：`node -e "const s=require('fs').readFileSync('src/services/rolePrompts/magician.js','utf8'); const a=s.indexOf('export const getMagicianDaySpeechPrompt'); const b=s.indexOf('export const getMagicianVotePrompt',a); console.log('daySpeechFnSize:',b-a,'magicianSpeechLen offset:',s.indexOf('\${magicianSpeechLen}',a)-a)"`；getMagicianDaySpeechPrompt 新增代码后必须运行，若 magicianSpeechLen offset 超出 round77 窗口（当前 8000）立即更新**。
- **白熊效应合规（第 31 次验证）**：三层推断全正向描述（"confidence 升 35-45/30-40/25-35/20-30/15-20/10-15"/"逻辑镜像表标注"/"守卫守护候选"），无负向禁词 ✅（T14 测试覆盖）。
- **测试**：1912/1912（+20 new R110 tests T1-T20；+round77 窗口修复 6000→8000；1 pre-existing chatSocket failure 与本轮无关）；build ✅（WerewolfModule 250.35 kB）；check-build ✅。
- **下轮优先**：平安夜推断矩阵已完整，转向：①游戏机制干跑模拟（useWerewolfGame.js reducer 模拟一局完整流程）；②平衡性评估（狼/好人胜率分析）；③警长竞选提示词优化；④遗言生成质量优化。

---

### [2026-07-03 Round 109] 魔术师 NIGHT 平安夜交换价值评估框架（isNightPeacefulMagician + isConsecutivePeacefulNightMagician + isTripleConsecutivePeacefulNightMagician）— Prepend Injection 第 24 次

- **完成状态**：`magician.js` `getMagicianNightActionPrompt` 新增 11 个变量：① `isNightPeacefulMagician`（`dayCount > 1 && lastNightInfo?.includes('平安夜')`）；② `magNightPrevDay`；③ `isConsecutivePeacefulNightMagician`（`dayCount >= 3 + fullGameTimeline N-2:平安夜`）；④ `magNightPrevPrevDay`；⑤ `isTripleConsecutivePeacefulNightMagician`（`dayCount >= 4 + isConsecutive + fullGameTimeline N-3:平安夜`）；⑥ `magNightThreePrevDay`；⑦ `lastNightHadSwap`（`lastSwap && lastSwap.player1Id !== null`）；⑧ `lastSwapRef`（有换/未换两路参数化）；⑨ `swapStatusHint`（有换 confidence 升 15-20 / 未换 confidence 升 10-15）；⑩ `let tripleConsecutivePeaceNightHintMag = ''` + if 块内三连内容；⑪ `consecutivePeaceNightHintMag`（前置拼接三连，Prepend Injection 第 24 次）。注入方式：`${magicianNightPeaceStep}` 在 return 模板 `${magicianHistoryStep}` 之后、`${magicianNightStyle}` 之前。函数从 5567 → 8275 chars（+2708 chars）；aiPrompts.js NIGHT_MAGICIAN case 补传 `lastNightInfo: ctx.lastNightInfo` 和 `fullGameTimeline: ctx.fullGameTimeline`；round78 窗口 7500→9000。
- **魔术师 NIGHT 三元归因独特性（R109-A）**：魔术师知道 `lastSwap`（昨夜是否有交换 + 交换对象对），平安夜时推断守护来源——来源A（有换：狼刀经交换重定向后被守护）vs 来源B（未换：守卫直接保护狼刀目标）。推断结论落在**今晚换刀方向是否仍有价值**（切换 vs 维持换刀方向），而非"谁是好人"。**魔术师 NIGHT 推断精度层级：守卫（零间接读 guardHistory）> 魔术师（间接推断交换重定向后的守护落点）≈ 预言家（一阶间接 confidence 筛选）> 村民（二阶间接票压）**。
- **round78 窗口级联规律（R109-B）**：`getMagicianNightFnBlock()` 从 5566→8275（+2708 chars），`identity_table 填写指导` 从 4809 移至 7517，`追加不覆盖历史` 从 4854 移至 7562——均超出旧窗口 7500，须升至 9000。**标准检测命令：`node -e "const s=require('fs').readFileSync('src/services/rolePrompts/magician.js','utf8'); const a=s.indexOf('export const getMagicianNightActionPrompt'); const b=s.indexOf('export const getMagicianDaySpeechPrompt',a); console.log('nightFnSize:',b-a, 'idxIdentityTable:',s.slice(a,b).indexOf('identity_table 填写指导'))"`；getMagicianNightActionPrompt 新增代码后必须运行，若 idxIdentityTable 超出 round78 窗口立即更新**。
- **T5 测试设计纠正（R109-C）**：T5 初始使用 `getIfBlock()`（从 `if (isConsecutivePeacefulNightMagician)` 切片）检查 `const isTripleConsecutivePeacefulNightMagician`，但后者声明在 if 块**外**（与 NIGHT_WOLF/NIGHT_WITCH 同模式）。**修正规则：当 `isTriple` 变量声明在外层（if 块外），测试不应用 `getIfBlock()` 检查它；应直接用 `getMagicianNightFnBlock()` 全量函数块检查**。与 if 块内确认的内容（tripleHint/consecutiveHint 赋值）分开测试，不混用。
- **aiPrompts.js 参数补传模式（R109-D）**：NIGHT_MAGICIAN case 此前仅传了 `dayCount`，未传 `lastNightInfo` 和 `fullGameTimeline`，导致平安夜推断始终无法激活（`lastNightInfo?.includes('平安夜')` 总是 undefined）。**教训：为 NIGHT case 新增平安夜推断时，必须同时检查 aiPrompts.js 中该 case 的 `magicianModule.nightAction({...})` 调用，确认 `lastNightInfo: ctx.lastNightInfo` 和 `fullGameTimeline: ctx.fullGameTimeline` 已传入；缺少任一则推断永远不激活**。未来如需为其他模块函数（如 dreamweaver.js 之外的外部模块）添加平安夜推断，先检查 aiPrompts.js 传参列表。
- **白熊效应合规（第 30 次验证）**：三层推断全正向描述（"confidence 升 35-45/30-40/25-35/15-20/10-15"/"今晚切换交换方向覆盖未保护高威胁目标"/"建议覆盖未保护高威胁目标"），无负向禁词 ✅（T14 测试覆盖）。
- **测试**：1892/1892（+20 new R109 tests T1-T20；+round78 窗口修复 7500→9000；1 pre-existing chatSocket failure 与本轮无关）；build ✅（WerewolfModule 248.70 kB）；check-build ✅。
- **下轮优先**：魔术师 DAY_SPEECH 平安夜推断（`getMagicianDaySpeechPrompt`），或覆盖审计（NIGHT_HUNTER / NIGHT_KNIGHT 是否存在平安夜推断）。

---

### [2026-07-03 Round 108] 摄梦人 DAY_SPEECH 平安夜双来源推断三层体系（isPeacefulNightDW + isConsecutivePeacefulDW + isTripleConsecutivePeacefulDW）— Prepend Injection 第 23 次

- **完成状态**：`dreamweaver.js` `getDreamweaverDaySpeechPrompt` 新增 8 个变量：① `isPeacefulNightDW`（`dayCount > 1 && lastNightInfo?.includes('平安夜')`）；② `dwPrevDay`；③ `isConsecutivePeacefulDW`（`dayCount >= 3 + fullGameTimeline N-2:平安夜`）；④ `dwPrevPrevDay`；⑤ `dreamTargetRef`（`lastDreamTarget !== null ? '${lastDreamTarget}号' : '（记录缺失）'`）；⑥ let `dwPeaceNightStep = ''`；⑦ if 块内 `isTripleConsecutivePeacefulDW`（`dayCount >= 4 + isConsecutivePeacefulDW + N-3:平安夜`）；⑧ `dwThreePrevDay`；⑨ `tripleConsecutivePeaceHintDW`（三元）；⑩ `consecutivePeaceHintDW`（Prepend Injection）。注入方式：`${dwPeaceNightStep}` 在 return 模板 `${dreamweaverDayHistoryStep}` 之后、`Step1:` 之前。函数从 ~4800 → 6463 chars（+1663 chars）；round77 窗口 5500→7000。
- **摄梦人 DAY_SPEECH 双来源推断独特性（R108-A）**：摄梦人知道 `lastDreamTarget`（昨晚入梦目标），平安夜时需辨别"来源A（入梦免疫拦截狼刀）vs 来源B（守卫/女巫保护他处）"。推断结论落在**今晚是否维持入梦该目标**（防守决策），而非"谁是好人"。**设计原则：平安夜推断结论必须适配角色的核心决策框架——骑士（决斗候选置信度降）、摄梦人（入梦目标置信度升 + 今晚入梦方向）、守卫（守护目标来源推断）、狼人（换刀策略）——不能套用同一结论模板**。
- **dreamTargetRef 参数化（R108-B）**：通过 `const dreamTargetRef = lastDreamTarget !== null ? \`${lastDreamTarget}号\` : '（记录缺失）'` 将入梦目标具体玩家号注入推断文本，使推断内容与本局具体目标绑定（而非通用描述）。T19 测试验证：`makeParams(5)` 时 result 包含 `'5号'`。这是首个在平安夜推断文本中注入 params 派生变量的实现，可供未来角色参考。
- **detached HEAD + local main 落后 50 commits 恢复（R108-C）**：本轮启动时 `git checkout main` 显示"local main 落后 remote 50 commits"（local 停在 R86，remote 在 R123）。原因是远端 force push 后 local main 引用指向旧 SHA。工作树干净，直接 `git reset --hard origin/main` 恢复。**本地 main 落后 remote 超过 10 commits 时，若工作树干净，直接 `git reset --hard origin/main`；若有在制工作，先 cp 文件备份再 reset**。
- **round77 窗口更新规律（R108-D）**：`getDreamweaverDayBlock()` 窗口 5500→7000（函数体 +1663 chars，`${dreamweaverSpeechLen}` 从 ~4800 移至 5965，超出旧窗口）。**检测命令：`node -e "const s=require('fs').readFileSync('src/services/rolePrompts/dreamweaver.js','utf8'); const a=s.indexOf('export const getDreamweaverDaySpeechPrompt'); console.log('speechLen offset:',s.indexOf('\${dreamweaverSpeechLen}',a)-a)"`；dreamweaver.js 新增代码后必须运行，若 speechLen offset > round77 窗口则立即更新**。
- **摄梦人 DAY×NIGHT 双侧推断闭合（R108-E）**：R107（NIGHT_DW 双来源推断）+ R108（DAY_SPEECH 双来源推断）= 摄梦人双侧三层推断体系完整。至此所有已实现 NIGHT 推断的角色（守卫/狼人/预言家/女巫/摄梦人）均已完成 DAY_SPEECH 侧对应推断。**下一覆盖目标：魔术师 NIGHT 推断（magician.js），需在 NIGHT_MAGICIAN case 补充传递 `lastNightInfo` 和 `fullGameTimeline` 参数**。
- **白熊效应合规（第 29 次验证）**：三层推断全正向描述（"confidence 升 15-20/25-35/35-45"/"今晚维持入梦该目标"/"调整入梦方向"），无负向禁词 ✅（T15 测试覆盖）。
- **测试**：1864/1864（+20 new R108 tests T1-T20；+round77 窗口 5500→7000；1 pre-existing chatSocket failure 与本轮无关）；build ✅（WerewolfModule 247.21 kB）；check-build ✅。
- **下轮优先**：魔术师 NIGHT 平安夜推断（`magician.js` + NIGHT_MAGICIAN case 补传参数），或覆盖审计（NIGHT_HUNTER / NIGHT_KNIGHT 是否存在）。

---

### [2026-07-02 Round 106] 女巫 NIGHT 侧平安夜两连+三连推断（isNightPeacefulWitch + isConsecutivePeacefulNightWitch + isTripleConsecutivePeacefulNightWitch）— Prepend Injection 第 21 次

- **完成状态**：`aiPrompts.js` NIGHT_WITCH case 新增 9 个变量：① `isNightPeacefulWitch`（`ctx.dayCount > 1 && ctx.lastNightInfo?.includes('平安夜')`）；② `witchNightPrevDay`；③ `isConsecutivePeacefulNightWitch`（D3+，fullGameTimeline N-2:平安夜）；④ `witchNightPrevPrevDay`；⑤ `isTripleConsecutivePeacefulNightWitch`（D4+，fullGameTimeline N-3:平安夜）；⑥ `witchNightThreePrevDay`；⑦ `tripleConsecutivePeaceNightHintWitch`（let，if 块内三元）；⑧ `consecutivePeaceNightHintWitch`（let，if 块内拼接三连前置）；⑨ `witchNightPeaceStep`（三元）。注入方式：`${witchNightPeaceStep}` 在 return 模板 `${witchNightStyle}` 之后、`1. 解药考量：` 之前（Prepend Injection 第 21 次）。NIGHT_WITCH block 4023 → 6624 chars（+2601 chars）；round74 窗口 5200→8000。
- **女巫双轴推断独特优势（R106-A）**：女巫 NIGHT 推断拥有**双轴交叉信息**——轴一：历史平安夜记录（推断守卫守护目标）；轴二：今晚 `dyingId`（当前夜被攻击目标，直接决策依据）。两轴交叉：被刀目标与守护推断重合→救药效益降低（守卫可能再次拦截）；被刀目标是全新目标→救药价值提升。这是所有角色中**推断→决策最直接**的情景之一，优于纯历史记录角色的单轴推断。**设计原则：当角色同时拥有历史推断信息和当前行动目标时，提示词应明确指导 AI 如何将两者交叉验证，而非独立使用**。
- **NIGHT 侧一轮完成三层的第 2 次应用（R106-B）**：参照 R102（狼人 NIGHT，一轮完成两连+三连），R106 对女巫 NIGHT 同样一轮完成，避免两轮上下文重复初始化。与 R94（守卫 NIGHT 两连）+R97（守卫 NIGHT 三连）分两轮方案相比，节省约 30 分钟。**规律固化：NIGHT 侧平安夜三级推断已有 R98（预言家）、R102（狼人）、R106（女巫）三个一轮完成先例，下次遇到缺失两连+三连的 NIGHT 角色，默认一轮完成，无需分两轮**。
- **NIGHT_WITCH 窗口更新规律（R106-C）**：block 4023→6624（+2601 chars），触发 round74 `getNightWitchBlock()` 窗口 5200→8000。**标准检测命令：`node -e "const s=require('fs').readFileSync('src/services/aiPrompts.js','utf8'); const a=s.indexOf('case PROMPT_ACTIONS.NIGHT_WITCH:'); const b=s.indexOf('case PROMPT_ACTIONS.NIGHT_DREAMWEAVER:',a); console.log('NIGHT_WITCH size:',b-a)"`；任何 NIGHT_WITCH 新增代码后必须运行，若超出 round74 窗口（当前 8000）立即更新**。
- **女巫 DAY×NIGHT 双侧三层体系完整（R106-D）**：DAY_SPEECH：R82（单夜）→ R92（两连）→ R105（三连）；NIGHT_WITCH：R106 一轮完成单夜+两连+三连。女巫是本体系中首个 **DAY×NIGHT 双侧均有三层推断的神职角色**，是整个平安夜推断矩阵中覆盖最完整的角色（守卫 DAY×NIGHT 双侧三层也已完整，但 DAY 侧三连在 R104 完成；女巫 NIGHT 侧 R106 补齐）。
- **白熊效应合规（第 27 次验证）**：三层全正向描述（"confidence 升 35-45/30-40/25-35/15-25"/"守卫再次拦截"/"救药价值提升"），无负向禁词 ✅（T14 测试覆盖）。
- **测试**：1824/1824（+20 new R106 tests T1-T20；+round74 窗口 5200→8000；1 pre-existing chatSocket suite failure 与本轮无关）；build ✅（WerewolfModule 244.14 kB）；check-build ✅；干跑 6/6 ✅。
- **下轮优先**：覆盖审计——梳理所有 NIGHT case（NIGHT_HUNTER/NIGHT_DREAMWEAVER/NIGHT_MAGICIAN 等），找出还缺少平安夜推断的角色；或审计 DAY_SPEECH 侧是否有遗漏的三层体系。

---

### [2026-07-02 Round 105] 女巫 DAY_SPEECH 三连平安夜三阶推断（isTripleConsecutivePeacefulWitch）— Prepend Injection 第 20 次

- **完成状态**：`aiPrompts.js` 女巫 DAY_SPEECH 在 R82（单夜）和 R92（两连）基础上，新增三个变量：① `isTripleConsecutivePeacefulWitch`（外层：`ctx.dayCount >= 4 && isConsecutivePeacefulWitch && ctx.fullGameTimeline?.includes(\`N${ctx.dayCount - 3}:平安夜\`)`）；② if 块内 `threePrevDay`（`dayCount >= 4 ? dayCount - 3 : 0`）和 `tripleConsecutivePeaceHintWitch`（三元：路径A=三夜相同 confidence 升 35-45 / 路径B=两夜相同+一夜不同 confidence 升 30-40 / 路径C=三夜各不同→按单夜路径A/B独立评估）；③ Prepend Injection 第 20 次。witch block 4523 → 5414 chars（+891 chars）。
- **女巫 DAY 三层体系闭合（R105-A）**：R82（单夜）→ R92（两连）→ R105（三连）三层完整。女巫在 DAY_SPEECH 侧是**唯一拥有 hasWitchSave 双轨信息**的角色，三连推断叠加 hasWitchSave 状态给出"守卫三夜锁守=解药保留到①②信号"的可触发决策框架，精度层级：守卫（零间接）> 女巫（hasWitchSave+票压双轨）> 预言家（查验记录间接）> 村民（纯票压）。
- **witch window 级联更新规律（R105-B）**：`${witchSpeechLen}` 从 5742 移至 6633（+891），超出 round58（6000→7500）和 round70（6500→7500）两个测试文件。**检测命令：`node -e "const s=require('fs').readFileSync('src/services/aiPrompts.js','utf8'); const a=s.lastIndexOf(\"'女巫': (ctx, params) => {\"); const r=s.indexOf('return \\\`',a); const w=s.indexOf('\\\${witchSpeechLen}',r); console.log('witchSpeechLen offset from func:',w-a)"`；凡女巫 var block 新增 ≥400 chars，必须运行此命令，若超 7500 立即更新 round58/round70 窗口**。
- **测试窗口切片逻辑须精确匹配代码结构（R105-C）**：T6 初始用 `ifSection.indexOf('tripleConsecutivePeaceHintWitch')` 作为起点（索引到字符串第一次出现，可能是变量引用处），而非 `const tripleConsecutivePeaceHintWitch` 声明处，导致窗口切片起点偏移，`isTripleConsecutivePeacefulWitch` 不在 50-char 窗口内。**规则：在 ifSection 中用 indexOf 定位变量声明时，始终使用 `'const <varName>'` 而非仅 `'<varName>'`，防止匹配到引用处而非声明处**。
- **Prepend Injection 第 20 次（R105-D）**：标准三步模式（外层检测变量 + if 块内三元 + true 分支头部前置）已应用 20 次。女巫、守卫、狼人、预言家、村民、骑士 DAY_SPEECH 均已完成三层体系。所有 DAY_SPEECH 角色 Prepend Injection 计数：Wolf(×3) + Guard(×3) + Seer(×3) + Witch(×3) + Villager(×3) + Knight(×3) = 18次 from 那些角色 + 夜间 NIGHT 侧 2次 = 20次总计（含 R97 守卫 NIGHT 三连等）。
- **白熊效应合规（第 26 次验证）**：三路径全正向描述（"confidence 升 35-45"/"confidence 升 30-40"/"按单夜路径A/B独立评估"），无 不要/禁止/绝不能 ✅（T14 测试覆盖）。
- **测试**：1804/1804（+20 new R105 tests T1-T20；+round58/70 窗口级联更新；1 pre-existing chatSocket suite failure 与本轮无关）；build ✅（WerewolfModule 242.61 kB）；check-build ✅；干跑 17/17 ✅。
- **下轮优先**：女巫 NIGHT 侧两连+三连推断（NIGHT_WITCH case，参考 R102 狼人 NIGHT 一轮完成两连+三连模式；女巫是所有神职中 DAY+NIGHT 推断覆盖最不完整的角色）。

---

### [2026-07-02 Round 104] 守卫 DAY_SPEECH 三连平安夜三阶推断（isTripleConsecutivePeacefulGuard）— Prepend Injection 第 19 次

- **完成状态**：`aiPrompts.js` 守卫 DAY_SPEECH 在 R81（单夜）和 R91（两连）基础上，新增三个变量：① `isTripleConsecutivePeacefulGuard`（外层：`ctx.dayCount >= 4 && isConsecutivePeacefulGuard && ctx.fullGameTimeline?.includes(\`N${ctx.dayCount - 3}:平安夜\`)`）；② if 块内 `threePrevDay`（`dayCount >= 4 ? dayCount - 3 : 0`）和 `threeNightGuardTarget`（`guardHistory?.find(g => g.night === ctx.dayCount - 3)?.targetId ?? null`）；③ `tripleConsecutivePeaceHintGuard`（三元：三路径框架 A=三夜守同一目标 confidence 升 35-45 / B=两夜共同目标+一夜不同 confidence 升 30-40 / C=三夜各不同→按单夜路径A/B独立评估）。注入方式：`consecutivePeaceHintGuard` 三元 true 分支以 `${tripleConsecutivePeaceHintGuard}⭕【守卫两连` 前置拼接（Prepend Injection 第 19 次）。Guard DAY block 5471 → 6665 chars（+1194 chars）。
- **守卫 DAY 三层推断体系完整（R104-A）**：R81（单夜 +15-25）→ R91（两连 +25-35）→ R104（三连 +35-45）三层完整。守卫是 DAY_SPEECH 侧唯一通过 `guardHistory.find(g => g.night === N)?.targetId` 零间接读取历史守护目标的角色——所有夜次守护记录直接可查，无需票压代理推断。**DAY_SPEECH 侧平安夜推断精度层级：狼人（直读刀口记录）> 守卫（直读 guardHistory）> 女巫/预言家（有限私有信息）> 村民（纯票压）**。
- **guard block +1194 chars 的窗口级联规律（R104-B）**：新增变量块共 +1194 chars，插入在 if 块内 `prevPrevNightGuardTarget` 声明之后。三个测试文件需级联更新：① `round81`：`GUARD_WINDOW` 6500→8000（模块级常量，超出会 throw Error）；T25/T26/T27/T28/T30/T34/T37/T38 各窗口扩展（if start 之后各位置偏移 +1194）；② `round91`：T7 600→1500 / T15 1600→2400 / T16 1700→2500 / T20 上限 6500→8000；③ `round69`：`getGuardBlock()` 6000→7000（`${guardSpeechLen}` 偏移 ~4857→~6463，超出旧窗口）。**检测命令：`node -e "const s=require('fs').readFileSync('src/services/aiPrompts.js','utf8'); const w=s.indexOf(\"'守卫': (ctx, params) =>\"); const b=s.slice(w, w+10000); const ri=b.indexOf('return \`'); console.log('guardBlock:',b.indexOf('村民',ri)-0,'returnAt:',ri,'guardSpeechLen:',b.indexOf('\${guardSpeechLen}'),'guardPeaceNightStep assign:',b.indexOf('guardPeaceNightStep = \`'))"`**。
- **Prepend Injection 第 19 次（R104-C）**：标准三步模式（外层检测变量 + if 块内三元 + 前置到下一层 true 分支头部）已应用 19 次，在 Wolf/Guard/Seer/Witch/Villager/Knight DAY_SPEECH 及 NIGHT_WOLF 侧均有先例。下次遇到新角色三连推断直接复用，无需查阅代码。
- **白熊效应合规（第 25 次验证）**：三路径全正向描述（"confidence 升 35-45"/"confidence 升 30-40"/"按单夜路径A/B独立评估"），无 不要/禁止/绝不能 ✅（T14 测试覆盖）。
- **Detached HEAD 恢复（R104-D）**：本轮再次触发 detached HEAD 状态（与 R100-D / R101-A 相同），使用标准恢复协议：① `cp <5 files> /tmp/`；② `git stash push -u`；③ `git checkout main && git pull origin main`（fast-forward 39 commits）；④ `git stash drop`（NOT pop——stash base 是旧 HEAD，pop 会冲突）；⑤ `cp /tmp/<files> <原路径>`。**预防检查：每次工作开始运行 `git status` 确认 On branch main，在 detached HEAD 下绝不编辑文件**。
- **测试**：1784/1784（+20 new R104 tests T1-T20；+round69/81/91 窗口级联更新；1 pre-existing chatSocket suite failure 与本轮无关）；build ✅（WerewolfModule 242.15 kB）；check-build ✅；干跑 10/10 ✅。
- **下轮优先**：女巫 DAY_SPEECH 三连平安夜推断（R82 单夜 + R92 两连 + 缺三连；使用 `fullGameTimeline` N-3 + `witchHistory` 零间接）。

---

### [2026-07-02 Round 103] Wolf DAY_SPEECH 三连平安夜三阶战术推断（isTripleConsecutivePeacefulWolf）— Prepend Injection 第 18 次

- **完成状态**：`aiPrompts.js` Wolf DAY_SPEECH 在 R83（单夜）和 R88（两连）基础上，新增三个变量：① `isTripleConsecutivePeacefulWolf`（外层：`ctx.dayCount >= 4 && isConsecutivePeacefulWolf && ctx.fullGameTimeline?.includes(\`N${ctx.dayCount - 3}:平安夜\`)`）；② if 块内 `threePrevDay`（`dayCount >= 4 ? dayCount - 3 : 0`）；③ `tripleConsecutivePeaceHintWolf`（三元：三路径框架A=三夜刀口相同 confidence 升 35-45/B=两夜相同+一夜不同 confidence 升 25-35/C=三夜各不同→按单夜路径A/B）。注入方式：`consecutivePeaceHintWolf` 三元 true 分支以 `${tripleConsecutivePeaceHintWolf}⭕【狼人两连` 前置拼接（Prepend Injection 第 18 次）。Wolf DAY block 29383 → 30397 chars（+1014 chars）；更新 round58 wolf window 6500→7500（高优先刀口 从 ~5805 移至 ~6819）；更新 round70 getWolfBlock window 7500→9000（${wolfSpeechLen} 从 ~6636 移至 ~7651）。
- **Wolf DAY 侧零间接推断优势（R103-A）**：狼人在 DAY_SPEECH 侧可直接从 identity_table 读取"→已N${x}夜行刀"标记，三夜刀口历史确定性比对——路径A（三夜同目标=固定连守）/路径B（两夜同目标=部分连守）/路径C（三夜各不同=随机轮守）均基于确定事实，不需票压代理推断。**设计原则：DAY 侧三连推断的精度层级按私有信息类型分层——狼人（直读刀口记录，确定性最高）> 守卫（直读 guardHistory 守护记录）> 女巫/预言家（有限私有信息）> 村民（纯票压）**。
- **DAY 侧三连推断系列完成状态（R103-B）**：村民（R80单/R88两/R100三）→ 预言家（R81单/R90两/R99三）→ 守卫（R81单/R91两/缺三连）→ 女巫（R82单/R92两/缺三连）→ 骑士（缺单/R101三层一次完成）→ 狼人（R83单/R88两/R103三）。**下一优先：守卫 DAY_SPEECH 三连（guardHistory.find() 零间接，与 guardHistory 四象限对称）或女巫 DAY_SPEECH 三连**。
- **wolf block +1014 chars 的窗口级联规律（R103-C）**：新增三连变量块（~195 chars 外层 + ~820 chars if 块内）共 +1014 chars，插入在 wolfVarBlock 约 3741 处（isConsecutivePeacefulWolf 之后）。所有在此之后的 wolfVarBlock 内容偏移均 +1014：① `高优先刀口` 从 ~5805→6819，超出 round58 旧窗口 6500，须升至 7500；② `${wolfSpeechLen}` 在 return 模板从 ~6636→7651，超出 round70 旧窗口 7500，须升至 9000。**检测命令：`node -e "const s=require('fs').readFileSync('src/services/aiPrompts.js','utf8'); const w=s.indexOf(\"'狼人': (ctx, params) =>\"); const b=s.slice(w, w+10000); console.log('高优先刀口:', b.indexOf('高优先刀口'), '${wolfSpeechLen}:', b.indexOf('\${wolfSpeechLen}'))"`；Wolf DAY 新增代码后必须运行并与各测试窗口对比**。
- **Prepend Injection 第 18 次（R103-D）**：标准模式已应用 18 次：① 外层检测变量（`isTripleConsecutivePeacefulWolf`）② if 块内 threePrevDay + tripleHint 三元 ③ 在下一层 hint 变量的 true 分支头部前置 `${tripleHint}⭕【原始两连内容`。每次应用逻辑完全相同，无需查阅代码即可直接复用。
- **白熊效应合规（第 24 次验证）**：三路径全正向描述（"换刀 confidence 升 35-45"/"按单夜路径A/B独立评估"/"守卫极大概率固定连守"），无负向禁词 ✅（T13 测试覆盖）。
- **测试**：1764/1764（+20 new R103 tests T1-T20；+round58 wolf window 6500→7500；+round70 getWolfBlock window 7500→9000；1 pre-existing chatSocket suite failure 与本轮无关）；build ✅（WerewolfModule 241.50 kB）；check-build ✅；干跑 6/6 ✅。

---

### [2026-07-02 Round 102] NIGHT_WOLF 两连/三连平安夜换刀决策框架（零间接推断）— Prepend Injection 第 17 次

- **完成状态**：`aiPrompts.js` NIGHT_WOLF case 在 R84 单夜基础上，新增六个变量：① `isConsecutivePeacefulNightWolf`（`ctx.dayCount >= 3 && isNightPeacefulWolf && ctx.fullGameTimeline?.includes(\`N${ctx.dayCount - 2}:平安夜\`)`）；② `wolfNightPrevPrevDay`（`dayCount >= 3 ? dayCount - 2 : 0`）；③ `isTripleConsecutivePeacefulNightWolf`（`dayCount >= 4 && isConsecutivePeacefulNightWolf && fullGameTimeline N{dayCount-3}:平安夜`）；④ `wolfNightThreePrevDay`（`dayCount >= 4 ? dayCount - 3 : 0`）；⑤ `tripleConsecutivePeaceNightHintWolf`（if 块内三元，三连激活时注入三路径框架 A/B/C + confidence 升 35-45/25-35/按单夜）；⑥ `consecutivePeaceNightHintWolf`（`${tripleConsecutivePeaceNightHintWolf}⭕【两连平安夜二阶换刀决策...`前置拼接，confidence 升 25-35）。注入方式：`wolfNightPeaceStep` 三元 true 分支以 `${consecutivePeaceNightHintWolf}` 前置（Prepend Injection 第 17 次）。NIGHT_WOLF block 6115 → 7994 chars，更新 round76 窗口 7000→9000，round84 T19 上限 7000→9000。
- **NIGHT_WOLF 零间接推断优势（R102-A）**：狼人在 NIGHT 侧直接从 identity_table 的"→已NX夜行刀"标记读取历史刀口目标，无需票压推断——这是两连/三连推断的核心优势。相比守卫（从 guardHistory.find() 零间接读取守护目标）同级，相比预言家（从查验记录一阶间接）更高效，相比村民（二阶间接票压）精度更高。**设计原则：NIGHT 侧角色的连续平安夜推断应精确使用其私有信息的访问方式——有直接记录的用 identity_table 查找，不要降格为票压代理推断**。
- **注释字串与测试锚点冲突（R102-B）**：R102 注释 `// R102: ... 直接读取历史刀口，无需票压代理` 包含 `"读取历史刀口"` 字串，导致 round59 T15 的 `src.indexOf('读取历史刀口')` 定位到注释而非 wolfHistoryStep。**修复规则：当为大型 case block 添加包含业务关键词的注释时，必须立即检查已有测试中是否有以该关键词为锚点的 `indexOf` 查找，若有，改用更精确的全量短语（如 `'【读取历史刀口 + 核查执行结果】'`）。预防：注释使用元描述语言（"两连/三连推断框架"）而非直接使用 wolfHistoryStep 内的业务短语**。
- **R98 一轮完成 NIGHT 侧三级推断模式的复用（R102-C）**：R98（预言家 NIGHT）一轮完成单夜+两连+三连。R102（狼人 NIGHT）同样一轮完成两连+三连（单夜 R84 已有），避免两轮上下文重复初始化。对比 R94（守卫 NIGHT 两连）+ R97（守卫 NIGHT 三连）分两轮的方案，一轮方案节省约 30 分钟。**规律：NIGHT 侧平安夜三级推断已有 R98/R102 两个一轮完成先例，下次遇到缺失两连+三连的 NIGHT 角色，优先一轮完成而非分两轮**。
- **三连路径C设计（R102-D）**：三夜各不同目标时，守卫随机轮守，无规律可循 → 按单夜路径A/B独立评估昨夜刀口被守概率。这与 R97（守卫三连路径C）一致——三连 C 路径永远是"回退到单夜标准框架"。**通用规律：三连三路径中路径C（三夜各不同）的处理方式固定为"无规律→按单夜标准框架重新评估"**。
- **白熊效应合规（第 23 次验证）**：两连/三连内容全正向描述（"换刀 confidence 升 35-45"/"今晚选次高威胁目标"/"分别评估守护风险"），无负向禁词 ✅（T13 测试覆盖）。
- **测试**：1744/1744（+20 new R102 tests T1-T20；+round76/round84 窗口更新；+round59 T15 锚点修复；1 pre-existing chatSocket suite failure 与本轮无关）；build ✅（WerewolfModule 240.86 kB）；check-build ✅。

---

### [2026-07-02 Round 101] 骑士 DAY_SPEECH 平安夜推断三层体系（单夜→两连→三连）— 骑士决斗候选 confidence 修正框架

- **完成状态**：`knight.js` 新增三层平安夜推断：① `isPeacefulNightKnight`（`ctx.dayCount > 1 && ctx.lastNightInfo?.includes('平安夜')`）；② `isConsecutivePeacefulKnight`（`dayCount >= 3 && fullGameTimeline 含 N${dayCount-2}:平安夜`）；③ if 块内 `isTripleConsecutivePeacefulKnight`（`dayCount >= 4 && isConsecutivePeacefulKnight && fullGameTimeline 含 N${dayCount-3}:平安夜`）。三层 confidence 降幅梯度：单夜 10-20 / 两连 25-35 / 三连 35-45。注入方式：prepend injection（前置注入模式第 16 次应用），`${knightPeaceNightStep}` 在 return 模板 `${knightHistoryStep}` 之后注入。骑士独特角度：平安夜推断结论落在**决斗候选 confidence 下调**而非好人判断（被守护→守卫认为是好人→骑士决斗价值降低）。
- **Git 分叉恢复策略（R101-A，首次记录）**：本会话 local main 落后 remote main 30 commits（fa236cb vs f8b9dad），来自两个并行工作流（狼人杀循环 vs 网球循环）各自直接 push 到 main 后产生的历史分叉。**工作文件保存 + 快进 + 直接复制比 `stash pop` 更可靠**：① `cp <工作文件> /tmp/`；② `git stash push -u && git pull origin main`（fast-forward 快进）；③ `git stash drop && cp /tmp/<工作文件> <原路径>`；④ 正常 add/commit/push。原因：`git stash pop` 的 diff 基点是 stash 创建时的 HEAD（fa236cb），应用到快进后 HEAD（f8b9dad）时若该文件在 30 commits 中被修改，必然冲突；直接复制文件绕过 diff 基点。**预防：每次工作开始先 `git fetch origin main && git log --oneline origin/main..HEAD` 查看本地是否领先/落后远程；若落后且有在制工作，先快进再开始**。
- **`git stash pop` 失败场景（R101-B）**：stash pop 本质是将 `(stash_base → stash_content)` 的 diff 应用到当前 HEAD。若当前 HEAD 与 stash_base 相差较大（如 30 commits），且共同文件在这 30 commits 中被改动过，patch 无法 apply → CONFLICT。**规则：若 `git log --oneline <stash_base>..<current_HEAD>` 超过 5 commits，不要依赖 stash pop 来恢复工作文件；改用 /tmp 备份路径**。
- **Prepend Injection 模式第 16 次应用（R101-C）**：`consecutivePeaceHintKnight = isConsecutivePeacefulKnight ? \`${tripleConsecutivePeaceHintKnight}⭕【两连...`。超集激活原则再次验证（isTriple 激活时三层全显，isConsecutive 仅两层，isPeaceful 仅单层，空串则零激活）。
- **骑士平安夜推断 vs 村民推断的角度差异（R101-D）**：同为 DAY_SPEECH 平安夜推断，村民结论是"该目标可能是好人（confidence 提升）"，骑士结论是"该目标被守护→决斗候选 confidence 下调"。**设计原则：平安夜推断结论应适配角色的核心决策框架；村民核心=投票；骑士核心=决斗候选选择；不能套用同一结论模板**。
- **白熊效应合规（第 22 次验证）**：三路径（A/B/C）全正向描述（"confidence 降 35-45"/"守护"/"identity_table 追加"），无负向禁词 ✅（T15 测试覆盖）。
- **测试**：1720/1720（+20 new R101 tests T1-T20；1 pre-existing chatSocket suite failure 与本轮无关）；build ✅（WerewolfModule 232.02 kB）；check-build ✅。

---

### [2026-07-01 Round 100] 村民 DAY_SPEECH 三连平安夜三阶推断框架（isTripleConsecutivePeacefulVillager）— 平安夜推断三层体系完成

- **完成状态**：村民 DAY_SPEECH 在 R80（单夜）和 R88（两连）基础上，新增 `isTripleConsecutivePeacefulVillager`（`dayCount >= 4 && isConsecutivePeacefulVillager && fullGameTimeline?.includes(N${dayCount-3}:平安夜)`），`threePrevDay`（`dayCount >= 4 ? dayCount - 3 : 0`），`tripleConsecutivePeaceHintVillager`（三路径框架：路径A三夜相同目标 confidence 降35-45 / 路径B两夜共同目标降25-35 / 路径C三夜各不同各降10-15）。注入方式：`${tripleConsecutivePeaceHintVillager}` 前置到两连提示词的模板字符串头部（prepend injection 第15次应用）。村民块 4202 → 5058 chars。
- **Prepend Injection 模式第 15 次应用（R100-A）**：`consecutivePeaceHintVillager = isConsecutivePeacefulVillager ? \`${tripleConsecutivePeaceHintVillager}⭕【两连...`。更高层级内容直接前置到下一层模板字符串头部，无需在 template 中新增占位符。**超集原则**：`isTriple` 包含 `isConsecutive` 包含 `isPeacefulNight`，保证激活条件为严格超集——isTriple 激活时三层全部显示，isConsecutive 激活时两层，仅 isPeacefulNight 激活时一层，完全零激活时 peaceNightStep 为空字符串。
- **Confidence 分层体系完成（R100-B）**：单夜 +10-20 → 两连 +25-35 → 三连 +35-45，每增一层下界增加约 10 分。路径A（三夜相同）的 35-45 是整个推断体系的最高置信度，路径B借用两连区间，路径C降级回单夜。**设计原则：多层推断体系的 confidence 增量应呈严格递增梯度，让 AI 自然感知"连续夜数=推断可靠性"**。
- **固定窗口测试的级联脆性（R100-C）**：新增约 856 chars 变量声明块（`isTripleConsecutivePeacefulVillager` + `threePrevDay` + `tripleConsecutivePeaceHintVillager`），导致 if 块内 `peaceNightStep =` 赋值从 ~700 移至 ~1244（R80 T5 失败），`"identity_table"` 从约 2900 移至 ~4913（R54 T24 失败，被 `+4000` 窗口截断）。**教训：固定偏移窗口（`slice(start, start+N)`）在目标内容位置超出 N 时静默失败。每轮扩充任意函数体后，必须立即运行全部测试并逐条核查失败原因——不要相信"看上去改过了"**。检查命令：`grep -rn "villagerStart\|villagerBlock\|villagerSeg" src/services/__tests__/*.test.js | grep "+[0-9]"`.
- **Detached HEAD + stash pop 引发 merge conflict（R100-D）**：在 detached HEAD 状态下提交所有修改，再 `git checkout main && git stash pop` 导致 aiPrompts.js 和 round80 测试文件出现 merge conflict 标记。**预防：每次工作前先确认 `git status` 显示 On branch main，不要在 detached HEAD 下编辑文件；如已进入 detached HEAD，先 `git stash`，再 `git checkout main`，再 `git stash pop`，立即检查 conflict markers。分辨率规则：stashed（新）版本永远优先于 upstream（旧）**。
- **T24 单测漏网（R100-E）**：round54 T23 用 `+5500` 通过，T24 同文件用 `+4000` 静默截断——sed 替换命令 `s/4000/5500/` 只替换了 T23 所在行，因为两处都是 `villagerStart + 4000`，sed 以行为单位从前到后替换时依赖顺序，若有多行包含相同字面串则须 `g`（全局）替换或逐行检查。**教训：修改测试窗口后，立即 grep 检查是否还有遗漏实例，而非假设 sed 已处理全部**。
- **白熊效应合规（第 21 次验证）**：三路径均使用正向描述（"confidence 降 35-45"/"confidence 降 25-35"/"按单夜标准评估"），speech 约束用"speech 只说'三连平安夜，持续关注局势'"正向限定，无负向禁词 ✅。
- **测试**：1395/1395（+20 new R100 tests T1-T20；R54 T24 / R80 T5 / R80 T20 / R67 窗口各修复 1 处；chatSocket 预存失败与本轮无关）；build ✅；check-build ✅

---

### [2026-07-01 Round 99] 预言家 DAY_SPEECH 三连平安夜三阶推断（isTripleConsecutivePeacefulSeer + tripleConsecutivePeaceHintSeer）— 预言家平安夜推断三层体系完整

- **完成状态**：`aiPrompts.js` 预言家 DAY_SPEECH 新增三个变量：① `isTripleConsecutivePeacefulSeer`（`ctx.dayCount >= 4 && isConsecutivePeacefulSeer && ctx.fullGameTimeline?.includes(\`N${ctx.dayCount - 3}:平安夜\`)`）；② if 块内 `threePrevDay`（`ctx.dayCount >= 4 ? ctx.dayCount - 3 : 0`）；③ `tripleConsecutivePeaceHintSeer`（三元：三路径框架A=三夜同一目标 confidence 升 35-45/B=两夜共同目标按两连处理/C=三夜各不同分别单夜评估；三夜查验记录交叉验证；identity_table 追加"三连平安夜 confidence 升 30-40"）。注入方式：`consecutivePeaceHintSeer` 三元的 true 分支以 `${tripleConsecutivePeaceHintSeer}` 前置拼接（前置注入模式第 14 次应用）。预言家 DAY_SPEECH 平安夜推断体系 R81（单夜）→ R90（两连）→ R99（三连）三层完整。
- **seer 区块边界双重检测规律（R99-A）**：预言家 DAY_SPEECH 有两种不同的边界标记：① `seer→witch`（round81/round99/round90 等用）= 实际函数体（8072 chars after R99）；② `seer→guard`（某些工具查询时可能偶然选用）= 更大范围（17080 chars after R99，含守卫代码前的其他角色）。**规则：所有涉及 seer block 的测试应统一用 `'女巫': (ctx, params)` 作为结束标记，不要用 `'守卫': (ctx, params)`；每次改动后运行 `node -e "...indexOf('预言家')/indexOf('女巫')"` 确认实际边界。标准检测命令：`node -e "const s=require('fs').readFileSync('src/services/aiPrompts.js','utf8'); const a=s.indexOf('ROLE_DAY_SPEECH_PROMPTS'); const b=s.indexOf(\"'预言家': (ctx, params) =>\",a); const c=s.indexOf(\"'女巫': (ctx, params)\",b); console.log('seer-to-witch block:',c-b,'seerSpeechLen offset:',s.indexOf('\${seerSpeechLen}',b)-b)"`**
- **round81 SEER_WINDOW 更新规律（R99-B）**：seer-to-witch block 从 6877（pre-R99）→ 8072（after R99，+1195 chars）。SEER_WINDOW 从 7500 → 20000 以给大量余量。旧窗口（7500）< 实际块大小（8072）→ 失败。**规则：凡预言家 DAY_SPEECH 函数体新增 800+ chars，立即运行标准检测命令，若 `seer-to-witch block` 超过当前 SEER_WINDOW 立即更新 round81 的 SEER_WINDOW 值**。
- **round70/round81 窗口同步（R99-C）**：R99 的 if 块新增 ~1195 chars 导致多个内部偏移位置全部下移，需同步更新 7 个窗口：T5(1100→1900) / T6(1100→1950) / T7(1200→2100) / T9(1400→2250) / T14(350→420) / T18(350→420) / T19(1600→2800)；round70 getSeerBlock 7000→9000（seerSpeechLen 移至 7869）。**通用规律：在 if 块首部插入 N chars 时，所有测试中 `ifSection.slice(ifStart, ifStart + X)` 的窗口 X 必须将目标关键词的旧偏移+N 作为新的下界**。
- **三连 confidence 区间递进原则（R99-D）**：单夜 +15-20 / 两连 +25-35 / 三连 +35-45。每增加一夜，confidence 区间下限 +10（统计证据正比例增长原则）。这与 NIGHT_GUARD/NIGHT_SEER 三连 confidence 区间设计一致（守卫 NIGHT 三连为 +30-40，预言家 DAY_SPEECH 三连为 +35-45，差异来自私有信息精度层级不同）。
- **白熊效应合规（第 20 次验证）**：三路径全正向描述（"confidence 升至 95-100"/"confidence 升 35-45"/"按单夜标准独立评估"），无负向禁词 ✅（T15 测试覆盖）。
- **测试**：1680/1680（+20 new R99 tests T1-T20；+round81 7项窗口修复；+round70 getSeerBlock 窗口修复；1 pre-existing chatSocket suite failure 与本轮无关）；build ✅；check-build ✅；干跑 8/8 ✅。

---

### [2026-07-01 Round 98] 预言家 NIGHT 侧平安夜三级推断（isNightPeacefulSeer + isConsecutivePeacefulNightSeer + isTripleConsecutivePeacefulNightSeer）

- **完成状态**：`aiPrompts.js` NIGHT_SEER case 新增六个变量：① `isNightPeacefulSeer`（`ctx.dayCount > 1 && ctx.lastNightInfo?.includes('平安夜')`）；② `seerNightPrevDay`；③ `isConsecutivePeacefulNightSeer`（`ctx.dayCount >= 3 + fullGameTimeline`）；④ `seerNightPrevPrevDay`；⑤ `isTripleConsecutivePeacefulNightSeer`（`ctx.dayCount >= 4 + fullGameTimeline`）；⑥ `seerNightThreePrevDay`。三个条件化 hint 变量（单夜/两连/三连）以前置注入模式构成三级嵌套，`${seerNightPeaceStep}` 注入于 return 模板中 `${seerNightStyle}` 之后、`${seerNightStrategy}` 之前（前置注入模式第 13 次应用）。
- **预言家 NIGHT 推断精度层级（R98-A）**：守卫 NIGHT（零间接，guardHistory 直读）> 预言家 NIGHT（一阶间接，confidence≥65筛选）> 村民 DAY（二阶间接，纯票压）。预言家无直接守护记录，只能从 identity_table 高嫌疑未验证候选推断狼刀目标，confidence 调整幅度适中（±10-15）。**设计原则：每个角色的平安夜推断框架应精确匹配其私有信息层级，不能套用同一模板；零间接推断（直接读记录）> 一阶间接（从已有分析推断）> 二阶间接（纯外部观察）**。
- **NIGHT_SEER 窗口更新（R98-B）**：NIGHT_SEER block 从 4645 → 7686 chars（+3041 chars），round75 测试窗口从 6200 → 9000。**标准检测命令：`node -e "const s=require('fs').readFileSync('src/services/aiPrompts.js','utf8'); const a=s.indexOf('case PROMPT_ACTIONS.NIGHT_SEER:'); const b=s.indexOf('case PROMPT_ACTIONS.NIGHT_GUARD:',a); console.log('NIGHT_SEER size:',b-a)"`；NIGHT_SEER 新增代码后必须运行，若超过 round75 测试窗口（当前 9000）立即更新**。
- **白熊效应合规（第 19 次验证）**：三级推断全正向描述（"今晚查验首选该候选"/"按下方优先级框架正常选择"/"confidence 升 25-35"/"confidence 升 30-40"），无负向禁词 ✅（T14 测试覆盖）。
- **测试**：1660/1660（+20 new R98 tests T1-T20；+round75 窗口修复 6200→9000；1 pre-existing chatSocket suite failure 与本轮无关）；build ✅；check-build ✅；干跑 7/7 ✅。

---

### [2026-07-01 Round 97] 守卫 NIGHT 三连平安夜三阶推断（isTripleConsecutivePeacefulNightGuard + tripleConsecutivePeaceNightHintGuard）+ 骑士写指导格式统一

- **完成状态**：`aiPrompts.js` NIGHT_GUARD case 新增四个变量：① `isTripleConsecutivePeacefulNightGuard`（`ctx.dayCount >= 4 && isConsecutivePeacefulNightGuard && ctx.fullGameTimeline?.includes(\`N${ctx.dayCount - 3}:平安夜\`)`）；② `guardNightThreePrevDay`（`ctx.dayCount >= 4 ? ctx.dayCount - 3 : 0`）；③ `threeNightGuardTarget`（`gameState.guardHistory?.find(g => g.night === guardNightThreePrevDay)?.targetId ?? null`，零间接推断）；④ `tripleConsecutivePeaceNightHintGuard`（三元表达式，路径A=三夜锁守/路径B=两夜高频/路径C=三夜全不同，`confidence 升 30-40`）。注入方式：`consecutivePeaceNightHintGuard` 正值分支前置 `${tripleConsecutivePeaceNightHintGuard}` 拼接（前置注入模式第 12 次应用）。`knight.js` 写指导从"供下轮阅读领袖行动历史"改为"供 DAY N+1 Step0 ④ 读取，read-write 闭环"（自文档化）。
- **梯度推断层级闭合（R97-A）**：守卫平安夜推断 R85（单夜）→ R94（两连）→ R97（三连）三层梯度完整。三连激活时三层推断叠加，精度最高。**通用规律：平安夜推断系列应按"单夜→两连→三连"顺序逐步扩展；每层的激活条件是前一层的超集，高层激活时 AI 获得全部层级叠加，无需在高层复述低层内容（低层已在下方呈现）**。
- **路径B阈值高于两连（R97-B）**：三连推断路径B的 `confidence 升 30-40`（高于两连路径A的 25-35）。**设计原则：三夜中出现同目标两次比两夜连守同目标的统计意义更强（更高频次=更强证据），confidence 阈值相应提高 5**；这是"证据权重随观测次数正比例增长"原则的自然应用。
- **窗口更新规律（R97-C，第 4 次应用 NIGHT_GUARD 窗口规则）**：NIGHT_GUARD block 从 6181 → 7761 chars（+1580 chars），round73/round85/round94 的 `getNightGuardBlock()` 窗口从 6500 → 8500；round85 T19 上限 6500 → 8500；round94 T18 范围 5700-6500 → 7000-8500。**检测命令：`` node -e "const s=require('fs').readFileSync('src/services/aiPrompts.js','utf8'); const a=s.indexOf('case PROMPT_ACTIONS.NIGHT_GUARD: {'); const b=s.indexOf('case PROMPT_ACTIONS.NIGHT_MAGICIAN:',a); console.log('NIGHT_GUARD size:',b-a)" ``；任何 NIGHT_GUARD 新增代码后必须运行此命令，若超过当前三个测试文件的窗口（当前 8500），立即全部更新**。
- **白熊效应合规（第 18 次验证）**：路径A/B/C 全正向描述，无负向禁词 ✅（T17 测试覆盖）。
- **测试**：1640/1640（+20 new R97 tests T1-T20；+round73/85/94 窗口修复；1 pre-existing chatSocket suite failure 与本轮无关）；build ✅；check-build ✅；干跑 26/26 ✅。

---

### [2026-07-01 Round 96] 猎人开枪增加前轮投票票压参考（感知-执行分裂修复 · 双文件改动）

- **完成状态**：`useDayFlow.js` `handleAIHunterShoot` 新增票压摘要注入：取 `voteHistory` 最新一条，过滤 `ABSTAIN_TARGET` 和 `aliveTargets` 后，降序取 Top-3 存活高票目标，以 `【D${day}票压】X号(n票) > Y号(m票)` 格式追加到 `hunterContext`。`aiPrompts.js` `hunterHistoryStep` 升级为"Step 0 读取历史候选 + 前轮票压参考"，明确要求与"开枪优先级：高"重叠者 confidence 提升 15-25。
- **voteHistory 键格式（R96-A）**：`recordVoteRound` 存储时将 `voterId/targetId` 映射为 `from/to`（`votes.map(v => ({ from: v.voterId, to: v.targetId }))`），所以 R96 过滤逻辑必须用 `v.to !== ABSTAIN_TARGET` 而非 `v.targetId`。**通用规则：读取 voteHistory 时始终用 `from/to` 键；`voterId/targetId` 只在 buildVoteRecord 函数的中间值中出现**。
- **"取最新一轮"设计（R96-B）**：`voteHistory[voteHistory.length - 1]` 覆盖两种猎人死亡场景——死于投票（当天 D${n} 已记录，票压显示当天格局）和死于夜间（最新为 D${n-1}，票压显示上一天格局）。若取 `dayCount - 1` 寻找特定日期，在第一天猎人死亡时会找不到记录；取最新一条更健壮。
- **测试 r96Block 窗口（R96-C）**：R96 代码从注释到 hunterContext 模板字面量约 800 chars。初始设 700 chars 时 T8 失败（模板字面量恰好被截断）；扩展至 900 chars 全通过。**规则：含模板字面量的代码块，测试窗口应≥代码块估算长度 × 1.2**。
- **白熊效应合规（第 17 次验证）**：hunterHistoryStep 新增内容全正向描述（"高票存活者是好人阵营持续怀疑的对象"/"confidence 可提升 15-25"），无负向禁词 ✅（T17 测试覆盖）。
- **测试**：1614/1614（+20 new R96 tests T1-T20；1 pre-existing chatSocket suite failure 与本轮无关）；build ✅；check-build ✅；干跑逻辑验证 ✅。

---

### [2026-07-01 Round 95] 女巫 witchAntidoteHint hasWitchSave=true 路径A细化 — 模糊语义→可触发双信号框架

- **完成状态**：`aiPrompts.js` `witchAntidoteHint` 的 `hasWitchSave=true` 分支从静态字符串升级为模板字面量 + 双信号框架：① 后续出现非平安夜且连守目标死亡（守卫换守失效）；② 票压最高存活者换人（连守节奏被打破）。同时新增 identity_table 追加指导（"守卫D${prevPrevDay}-D${prevDay}双轮连守，候选保护期，待①②信号出手"），与 DAY_SPEECH 读写闭环对齐。同步更新 round92 T18 中的旧文本匹配。
- **静态字符串→模板字面量升级的窗口安全规律（R95-A）**：将 `hasWitchSave=true` 分支从 `'...'` 改为 `` `...` `` 时，var block 增长 ~246 chars（4277→4523）。round58（6000 window）和 round70（6500 window）的关键内容（输出JSON: 在 5697 处）均在窗口内——**女巫 var block 增长 ≤ 300 chars 时，round58/70 窗口无需更新**。但 var block 超过 ~5700（使 输出JSON: 偏移超出 6000）时必须检查。标准检测命令：`` node -e "const s=require('fs').readFileSync('src/services/aiPrompts.js','utf8'); const a=s.lastIndexOf(\"'女巫': (ctx, params) => {\"); console.log('var block:',s.indexOf('return \`',a)-a,'输出JSON: at:',s.indexOf('输出JSON:',a)-a)" ``
- **"模糊保留时机→可触发信号"升级模式（R95-B）**：凡提示词中出现"保留到 X 时机"/"在合适时机使用"等模糊语义，均应升级为可观测信号（"检测 A 事件 OR B 事件时出手"）。信号设计原则：① 信号应来自 AI 可从 identity_table 或上下文直接观察到的事实（如平安夜状态变化、票压模式变化）；② 每个信号对应一种覆盖中断方式；③ 用"AND"连接事件内聚（非平安夜+目标死亡），用"OR"连接信号选择（信号①②）。
- **白熊效应合规（第 16 次验证）**：双信号框架全正向描述（"出手触发信号"/"守卫换守失效"/"连守节奏被打破"），无负向禁词 ✅（T17 测试覆盖）。
- **测试**：1588/1588（+20 new R95 tests T1-T20；+round92 T18 更新；1 pre-existing chatSocket suite failure 与本轮无关）；build ✅；check-build ✅；游戏干跑 25/25 ✅。

---

### [2026-06-30 Round 94] NIGHT_GUARD 两连平安夜 NIGHT 侧二阶推断（isConsecutivePeacefulNightGuard + consecutivePeaceNightHintGuard）— 守卫四象限推断矩阵闭合

- **完成状态**：`aiPrompts.js` NIGHT_GUARD case 新增四个变量：① `isConsecutivePeacefulNightGuard`（`ctx.dayCount >= 3 && isNightPeacefulGuard && ctx.fullGameTimeline?.includes(\`N${ctx.dayCount - 2}:平安夜\`)`）；② `guardNightPrevPrevDay`（`ctx.dayCount >= 3 ? ctx.dayCount - 2 : 0`）；③ `prevPrevNightGuardTarget`（`gameState.guardHistory?.find(g => g.night === guardNightPrevPrevDay)?.targetId ?? null`，零间接推断）；④ `consecutivePeaceNightHintGuard`（三元表达式，激活时路径A=连守同一目标 confidence 升 25-35 换守；路径B=两夜目标不同分别评估各夜命中概率）。注入方式：`guardNightPeaceStep = \`${consecutivePeaceNightHintGuard}⭕【守卫平安夜守护来源推断...\`` 前置拼接（R85 内容完整保留）。
- **守卫四象限推断矩阵闭合（R94-A）**：DAY 单夜（R81）→ DAY 两连（R91）→ NIGHT 单夜（R85）→ NIGHT 两连（R94）四象限全部完成。守卫平安夜推断在所有四个场景下均有明确脚手架：**每个"角色×时机×规模"组合都应该有独立的推断步骤，四象限缺一不可**。
- **NIGHT 侧 gameState 直接访问（R94-B）**：NIGHT_GUARD case 在 `generateUserPrompt(actionType, gameState, params)` 的 switch 作用域内，`gameState` 直接可用（非 DAY_SPEECH 的 `params` 传递路径）。因此 `gameState.guardHistory?.find(...)` 是合法的零间接推断访问方式。**区分规则：switch case 内声明的变量可以访问 `gameState`（外层函数参数）；DAY_SPEECH 中通过 `ROLE_DAY_SPEECH_PROMPTS['守卫']` 委托的函数只能访问 `(ctx, params)`，guardHistory 必须经由 params 传入**。
- **NIGHT_GUARD 窗口更新规律（R94-C，第 3 次应用）**：R94 新增约 1530 chars（block 4650→6181），触发 round73 和 round85 的 `getNightGuardBlock()` 5500→6500 扩展，以及 round85 T19 blockSize 上限 5000→6500。**标准检测命令：`node -e "const s=require('fs').readFileSync('src/services/aiPrompts.js','utf8'); const a=s.indexOf('case PROMPT_ACTIONS.NIGHT_GUARD: {'); const b=s.indexOf('case PROMPT_ACTIONS.NIGHT_MAGICIAN:',a); console.log('NIGHT_GUARD size:',b-a)"`；若超过当前窗口大小，立即更新 round73+round85 的窗口值**。
- **白熊效应合规（第 15 次验证）**：路径A/B 均使用正向描述（"拦截可信度极高"/"confidence 升 25-35"/"分别用两天票压评估命中概率"），无负向禁词 ✅（T17 测试覆盖）。
- **测试**：1562/1562（+20 new R94 tests T1-T20；+round73 窗口 5500→6500；+round85 窗口 5500→6500 + T19 上限更新；1 pre-existing chatSocket suite failure 与本轮无关）；build ✅；check-build ✅

---

### [2026-06-30 Round 93] 骑士 DAY→DAY 领袖指令读取闭环（knightLeaderReadHint，Step0 ④）— 感知-执行分裂修复

- **完成状态**：`knight.js` 的 `getKnightDaySpeechPrompt` 在 `knightHistoryStep` 之前新增 `knightLeaderReadHint`（条件：`hasUsedDuel && ctx.dayCount > 1`），激活时为 ④ 子步骤：查 `D${ctx.dayCount - 1}领袖指令` 字样条目，三路径读取（路径A=集火型续战/路径B=调查型整合/路径C=保护型续期），并要求 thought 中明确今日战略切换决策。修改 `knightHistoryStep` 在 ③ 末尾追加 `\n${knightLeaderReadHint}`，使 ④ 成为 Step0 的第四子步骤。identity_table write（R89 Step0.5 ③）与 read（R93 Step0 ④）精确对应：写端 `D${dayCount}领袖指令` vs 读端 `D${dayCount - 1}领袖指令`。
- **"仅写无读"是隐性感知-执行分裂（R93-A）**：R89 的 identity_table 写指导已标注"供下轮阅读领袖行动历史"，但 Step0 只扫描"决斗候选"关键词，使得 AI 能在 identity_table 中看到 `D{n}领袖指令` 记录，却无显式脚手架读取并基于其制定今日战略。**检测规则：凡 identity_table 写指导包含"供下轮读取"/"供下轮阅读"字样，必须立即检查对应的 Step0/读取步骤是否有 `indexOf(该关键词)` 的读取逻辑**——仅写无读是隐性感知-执行分裂，在实际游戏中 AI 可能偶尔自发读取，但无脚手架保证稳定性。
- **领袖期多天战略连续性（R93-B）**：骑士领袖期是游戏中极少数需要"跨多天维持同一战略"的场景——集火型需要持续2-3天集票；调查型需要累积跨轮交叉验证结果；保护型需要持续监控关键好人状态。如果 Step0 没有读取历史领袖指令，每天 Step0.5 都会重新三选一，历史决策信息丢失，战略不连贯。**下轮若添加其他角色跨多天战略维持机制，均应在写端标注关键词 + 读端有对应查找逻辑，并且两端关键词必须精确一致（动态插值也要精确匹配）**。
- **条件双重保护设计（R93-C）**：`knightLeaderReadHint` 条件为 `hasUsedDuel && ctx.dayCount > 1`。当 D1 时，`knightHistoryStep` 本身走 fallback 分支（不触发 active branch 中的 `${knightLeaderReadHint}`），且 hint 条件 `dayCount > 1` 也不满足——双重保护确保 D1 安全。设计原则：条件变量的激活判断应尽量自包含（变量本身就条件化），不要依赖外层 if 语句保护。
- **白熊效应合规（第 14 次验证）**：三路径全正向描述（"继续集票带节奏"/"整合进今日战略选择"/"延续战略C"/"今日更新战略"），无负向禁词 ✅（T20 测试覆盖）。
- **测试**：1542/1542（+20 new R93 tests T1-T20；1 pre-existing chatSocket suite failure 与本轮无关）；build ✅；check-build ✅

---

### [2026-06-30 Round 92] 女巫两连平安夜二阶推断（isConsecutivePeacefulWitch + witchAntidoteHint + consecutivePeaceHintWitch）— 平安夜推断系列里程碑完成

- **完成状态**：`aiPrompts.js` 女巫 DAY_SPEECH 新增三个变量：① `isConsecutivePeacefulWitch`（外层：`ctx.dayCount >= 3 && isPeacefulNightWitch && ctx.fullGameTimeline?.includes(\`N${ctx.dayCount - 2}:平安夜\`)`）；② if 块内：`prevPrevDay`（ctx.dayCount-2），`witchAntidoteHint`（`hasWitchSave ? '解药未动...守卫所为' : \`解药已用且两连平安夜——对比 savedIds 末位与 D${prevPrevDay}...\``），`consecutivePeaceHintWitch`（三元表达式：两连时注入四步两路径推断，否则为空字符串）。注入方式：路径A和路径B的 `witchPeaceNightStep` 赋值均以 `${consecutivePeaceHintWitch}⭕` 前置拼接，原 R82 内容完整保留。
- **平安夜推断系列里程碑（R92-A）**：R88（村民+狼人）→ R90（预言家）→ R91（守卫）→ R92（女巫）全部完成。五角色两连推断按私有信息精度排序：狼人（直接知道刀口）> 守卫（guardHistory零间接推断）> 女巫（hasWitchSave知道自己行动，但不知守卫行动）> 预言家（查验记录交叉验证）> 村民（纯票压间接推断）。**平安夜推断至此真正完整**。
- **女巫两连推断独特设计（R92-B）**：`witchAntidoteHint` 是所有角色两连推断中唯一实现双轨专属分析的变量——女巫知道自己是否用过解药，能区分"平安夜=自己救药行动"与"平安夜=守卫行动"，精度高于预言家和村民。`hasWitchSave ? 守卫独力两连连守 : savedIds末位×D-2高票存活者交叉验证` 双轨设计是女巫角色的信息优势的自然体现。
- **多窗口级联更新规律（R92-C，第 13 次应用）**：女巫 var block 增长 927 chars（3350→4277）导致两个测试文件失效：round58 witch window（4500→6000，因 identity_table 到 4956 超出 4500）；round70 witch window（5000→6500，因 输出JSON: 到 5451 超出 5000）。**新规律：每次为女巫 DAY_SPEECH var block 添加 900+ chars，必须同时检查 round58（witch window）和 round70（getWitchBlock）两个文件**。检测命令：`node -e "const s=require('fs').readFileSync('src/services/aiPrompts.js','utf8'); const a=s.lastIndexOf(\"'女巫': (ctx, params) => {\"); const r=s.indexOf('return \\\`',a); const t=s.indexOf('输出JSON:',r); console.log('var block:',r-a,'template to JSON:',t-a)"`。
- **白熊效应合规（第 13 次验证）**：路径A/B 均使用正向行为描述（"confidence 升 25-35"/"confidence 均下调 10-15"/"守卫极可能连守同一目标"），witchAntidoteHint 两分支均正向（"应保留到守卫无法覆盖的关键时机"/"confidence 升至 90-95"），无负向禁词 ✅（T17 测试覆盖）。
- **测试**：1522/1522（+20 new R92 tests T1-T20；+round58 witch window 4500→6000；+round70 witch window 5000→6500；1 pre-existing chatSocket suite failure 与本轮无关）；build ✅；check-build ✅

---

### [2026-06-30 Round 91] 守卫两连平安夜二阶推断（isConsecutivePeacefulGuard + consecutivePeaceHintGuard）

- **完成状态**：`aiPrompts.js` 守卫 DAY_SPEECH 新增两个变量：① `isConsecutivePeacefulGuard`（外层：`ctx.dayCount >= 3 && isPeacefulNightGuard && ctx.fullGameTimeline?.includes(\`N${ctx.dayCount - 2}:平安夜\`)`）；② if 块内三项：`prevPrevDay`（ctx.dayCount-2），`prevPrevNightGuardTarget`（`guardHistory?.find(g => g.night === ctx.dayCount - 2)?.targetId ?? null`），`consecutivePeaceHintGuard`（三元表达式前置注入，两连时输出路径A/B差异推断，否则为空字符串）。注入方式：`guardPeaceNightStep = \`${consecutivePeaceHintGuard}⭕【守卫平安夜推断...` 前置拼接，原 R81 内容完整保留。
- **守卫两连推断精度优势（R91-A）**：守卫的 `guardHistory` 数组直接记录了每夜守护目标，因此 `prevPrevNightGuardTarget = guardHistory.find(g => g.night === dayCount - 2)?.targetId` 是**零间接推断**（确定性读取）。村民（R88）需要用票压两层推断刀口；预言家（R90）需要交叉验证。守卫的"路径A=连守同一目标/路径B=轮换目标"判断完全确定。**设计原则：角色推断框架的实现方式应精确匹配其私有信息的获取方式——有历史记录的用 find() 直接读取，没有的才用票压间接推断**。
- **多轮测试窗口级联更新规律（R91-B，第 12 次应用）**：`consecutivePeaceHintGuard` block（~1100 chars）推移了 `if (isPeacefulNightGuard)` 内部所有后续内容的位置，导致 round81 T24-T38 共 8 个测试窗口失效。更重要的发现：**守卫 var block 从 ~3000 增长到 4264（return 移到 4264 处），导致 round69 的 4500 窗口无法覆盖 return 模板中的 `${guardPersonalityLens}` 和 `${guardSpeechLen}`**。新规则：每次守卫 var block 增长超过 600 chars，必须检查 round69（原地测 4500 窗口含 return 模板？还是只测 var block？）——实际上 round69 用 `start + 4500` 硬窗口涵盖了 return 模板，因此 var block 增长会把 return 模板内容挤出窗口。
- **"函数 var block 超过 window - template_start 才截断 return 内容"通用规则**：若一个测试用 `src.slice(start, start + N)` 检查函数，且 N 大于 var block 但小于总块大小，那么 N - varBlockSize 就是能被覆盖的 return 模板长度。round69 window=4500，var block=4264，可覆盖模板 4500-4264=236 chars。原来 4500 window 足够（var block 旧值~2800，可覆盖模板 1700 chars），R91 后 var block 4264 使模板覆盖降至 236，远不够覆盖 `${guardPersonalityLens}`。**预防命令：每当增加守卫 var block 代码时，计算 `returnStart - guardStart`，若超过 `guardWindow - 500`，立即扩大 guardWindow**。
- **白熊效应合规（第 12 次验证）**：路径A/B 均使用正向行为描述（"连守成功率极高"/"今晚应换守打破规律"/"按投票记录分别评估"），无负向禁词 ✅（T19 测试覆盖）。
- **测试**：1502/1502（+20 new R91 tests T1-T20；+round81 T24-T38 窗口修复；+round69/round58 guard window 升级；1 pre-existing chatSocket suite failure 与本轮无关）；build ✅；check-build ✅

---

### [2026-06-30 Round 90] 预言家两连平安夜二阶推断框架（isConsecutivePeacefulSeer + consecutivePeaceHintSeer）

- **完成状态**：`aiPrompts.js` 预言家 DAY_SPEECH 新增两个变量：① `isConsecutivePeacefulSeer`（D3+ 检测：`ctx.dayCount >= 3 && isPeacefulNightSeer && ctx.fullGameTimeline?.includes(\`N${ctx.dayCount - 2}:平安夜\`)`）；② `consecutivePeaceHintSeer`（三元表达式：两连情况下注入差异化二阶推断步骤，否则为空字符串）。注入方式：在 `if (isPeacefulNightSeer)` 块内，`consecutivePeaceHintSeer` 以 prepend 方式注入到原 `seerPeaceNightStep` 赋值头部（``${consecutivePeaceHintSeer}⭕【预言家平安夜推断...】``）。
- **预言家两连推断的独特优势（R90-A）**：与村民/狼人（R88）的两连推断相比，预言家的二阶推断多了一层**查验记录交叉验证**：若两夜高票存活者与已验金水玩家重叠，说明狼人持续追杀已确认好人（忌惮程度极高）；若已验查杀目标出现在存活者名单，则触发矛盾预警（狼不会针对自己人）。**设计原则：每个角色的两连推断应基于其私有信息维度定制——预言家独有"查验结论"实证，使其能进行二级矛盾检测，是与通用村民推断的核心区别**。
- **三元表达式前置注入模式第 11 次应用（R90-B）**：R80-R90 连续 11 轮同构，模式已完全固化：① 在 `if (isPeacefulNightX)` 块内声明 `const consecutivePeaceHintX = isConsecutivePeacefulX ? '...' : ''`；② 在同一块内，`xPeaceNightStep = \`${consecutivePeaceHintX}⭕【原始内容...\`` 前置拼接；③ 无需修改 return 模板或 if-else 结构。此模式是"条件步骤扩展"的标准手法，下一轮如需扩展守卫/女巫/骑士的两连推断，可直接套用。
- **测试窗口级联更新（R90-C）**：为 `if (isPeacefulNightSeer)` 块内新增 `consecutivePeaceHintSeer`（~880 chars）后，同一块内的所有 `ifSection` 切片均需更新：R81 T5（600→1100），T6（600→1100），T7（600→1200），T8（700→1300），T9（700→1400），T14（200→350），T18（200→350），T19（700→1600）。**精确更新规则：当 if-block 内部首部插入 N 字符，block 内所有后续内容的位置偏移 +N；以实际字符位置（`src.index(keyword, ifStart) - ifStart`）计算确认新窗口大小，而非估算**。同时 R57（预言家 DAY_SPEECH 函数整窗口）从 6000→8000 以覆盖 return 后的 thinkBlock/writeGuideBlock。
- **白熊效应合规（第 11 次验证）**：两连推断步骤均使用正向行为描述（"confidence 升至 95-100"/"强化金水保护意愿"/"信任度上调"），无负向禁词 ✅（R90 T16 测试覆盖）。
- **测试**：1482/1482（+20 new R90 tests T1-T20；+8 修复 R81 旧测试窗口；1 pre-existing chatSocket suite failure 与本轮无关）；build ✅；check-build ✅

---

### [2026-06-30 Round 89] 骑士领袖期专属 Step0.5（post-duel 全场引导规划——感知-执行分裂第 N+1 次修复）

- **完成状态**：`knight.js` `getKnightDaySpeechPrompt` 新增 `knightLeaderStep`（三元表达式：`hasUsedDuel ? \`Step0.5: 【领袖期战略规划...】\` : ''`）。三步内容：① 读取 identity_table 中"已决斗出局"玩家确认实证锚点 + 连锁推断（同立场玩家 confidence 下调 15-25；金水玩家下调 40-50）；② 三选一战略框架（集火型/调查型/保护型）；③ identity_table 追加 `D${ctx.dayCount}领袖指令` 格式标记。注入位置：`${knightHistoryStep}` 之后、`Step1:` 之前。identity_table 写指导新增"领袖期核心目标"条目。
- **感知-执行分裂识别范式（R89-A）**：骑士决斗成功后 AI 能看到 identity_table 中的"已决斗出局"条目（感知），但思维链 Step1 仍从通用"场上局势分析"开始——信息存在但无推断脚手架，是 R80-A / R86-A 同类问题的 post-duel 变体。**识别信号：若一个角色拥有"第一性实证"（物理验证级别的确认信息），但下一个思维链步骤是通用分析而非专门读取该实证并推导连锁逻辑——则存在感知-执行分裂，应插入专属 Step**。
- **"Step0.5:" 区分技巧（R89-B）**：identity_table 写指导中有静态文本 "Step0.5 执行后"（无冒号），而 knightLeaderStep 块头为 `` `Step0.5: 【` ``（有冒号）。测试 `not.toContain('Step0.5')` 会因 id_table 静态文本误失败；正确做法是 `not.toContain('Step0.5:')` 带冒号区分。**通用规则：当语义片段在函数体中多处出现（激活态 vs 静态说明），找"激活态独有的 suffix/wrapper"（如带冒号、双引号包裹）作为测试 needle，而非整个词**。
- **三元表达式前置注入模式（第 10 次应用）**：R80-R88 连续 9 轮同构，R89 继续沿用：声明 `const X = condition ? '内容' : ''`，在 return 模板中 `${X}` 占位替换。这是 knight.js 委托模式下的标准扩展方式，不需要改调用端。
- **白熊效应合规（第 10 次验证）**：Step0.5 三步均使用正向描述（"实证锚点"/"confidence 下调"/"集火型/调查型/保护型"），无负向禁词 ✅（T19/T20 测试覆盖）。
- **测试**：1454/1454（+20 new R89 tests T1-T20；1 pre-existing chatSocket suite failure 与本轮无关）；build ✅；check-build ✅

---

### [2026-06-29 Round 88] 连续平安夜二阶推断（isConsecutivePeacefulX + consecutivePeaceHintX，村民+狼人双侧）

- **完成状态**：`aiPrompts.js` 村民/狼人 DAY_SPEECH 各新增两个变量：① `isConsecutivePeacefulX`（D3+ 检测：`ctx.dayCount >= 3 && isPeacefulNightX && ctx.fullGameTimeline?.includes(\`N${ctx.dayCount - 2}:平安夜\`)`）；② `consecutivePeaceHintX`（三元表达式：两连情况下注入差异化推断步骤，否则为空字符串）。注入方式：在 `if (isPeacefulNightX)` 块内，将 `consecutivePeaceHintX` 前置拼接到原 `xPeaceNightStep` 赋值头部（`${consecutivePeaceHintX}⭕【原始内容...】`）。
- **fullGameTimeline 作为历史检测工具（R88-A）**：`ctx.fullGameTimeline` 已由 `prepareGameContext()` 构建为 `N1:平安夜 → N2:5号死亡 → ...` 格式字符串，可用模板字符串 `\`N${n}:平安夜\`` 精确检测任意夜次平安夜状态。**设计原则：检测多夜历史模式不需要解析时间线数组或引入新字段——`fullGameTimeline` 字符串格式已包含所需信息，includes 匹配足够精确**。
- **"前置注入"模式 vs "else 分支"（R88-B）**：两连推断使用三元表达式前置注入（两连时非空，否则为空字符串），而非 `if (isConsecutive) { ... } else { 原始 }`。**根因：R80 T17 测试在 `if (isPeacefulNight)` 之后 500 字符内检查无 `} else {`；else 分支会触发此测试失败。三元表达式前置注入模式天然避开此陷阱，同时保留原始推断内容完整**。今后凡需在"已有条件块"内扩展功能，优先考虑"额外变量三元表达式前置/追加"而非 if-else 分支。
- **测试窗口同步更新（R88-C）**：R88 代码增量（wolf +730 chars，villager +590 chars）导致 4 个预存在测试的切片偏移失效：round80 T5（300→700），round54 T24（4000→5000），round58 T26（5000→6500），round70 getWolfBlock（6500→7500）。**记录规律：每当 aiPrompts.js 的 wolf/villager 函数体增长超过 400 chars，下游的切片窗口测试通常需要同步更新。建议在每次大幅增长后，用 python3 计算实际偏移量（`src.index(keyword, blockStart) - blockStart`），直接确认窗口是否仍覆盖目标关键词**。
- **白熊效应合规（第 9 次验证）**：村民/狼人两连推断均使用正向行为描述，无负向禁词 ✅（T10/T20 测试覆盖）。
- **测试**：1426/1426（+20 new R88 tests T1-T20，+5 修复旧测试窗口；1 pre-existing chatSocket suite failure 与本轮无关）；build ✅；check-build ✅

---

### [2026-06-29 Round 87] 骑士 DAY_SPEECH personalityLens 双阶段个性化（knightPersonalityLens + knightSpeechLen）

- **完成状态**：`knight.js` 的 `getKnightDaySpeechPrompt` 新增 `knightPersonalityType`（从 `params.personalityType` 读取）、`knightPersonalityLens`（7 种类型 × 2 阶段三元表达式）和 `knightSpeechLen`（aggressive 35-55字/post-duel 30-55字，cautious 55-90字，默认 40-80字）。注入位置：【决斗禁忌】之后、【思维链】之前。输出 JSON 字数由硬编码"40-80字"改为 `${knightSpeechLen}` 插值。
- **里程碑声明 vs 实际状态差距（R87-A）**：R77 LEARNINGS 声称"DAY_SPEECH 全角色个性化完成里程碑"，但 `knight.js` 实际无任何 personalityLens 实现。**根因：R77 在 aiPrompts.js 中内联完成了摄梦人/魔术师的 lens，同时声称"骑士"也覆盖了——但骑士的 DAY_SPEECH 委托给 `getRoleModule('骑士').daySpeech(ctx, params)`，需要在 `knight.js` 模块文件中实现，而非在 aiPrompts.js 中内联**。今后声称"全角色覆盖"前，必须逐文件验证：用 `grep -l "personalityLens" src/services/rolePrompts/*.js` 确认所有委托模式的角色均已在其模块内实现。
- **骑士 personalityLens 独特设计维度（R87-B）**：骑士是所有神职角色中唯一需要"双阶段分支"的 personalityLens——其他角色（猎人=伪装/守卫=伪装/预言家=报验）只有一种发言模式，但骑士有 pre-duel（隐藏积累证据）和 post-duel（领袖指挥）两种截然不同的模式。**设计原则：当角色有离散的状态切换（而非连续的风格差异），personalityLens 必须为每个状态各提供一套行为指令；用 `hasUsedDuel ? '领袖模式' : '隐藏模式'` 三元表达式在同一分支内处理，避免引入两倍变量**。
- **测试 T1 重复 require 陷阱（R87-C）**：测试文件顶层有 `import { getKnightDaySpeechPrompt }` ESM 导入，T1 内部又写了 `require('../rolePrompts/knight.js')` 的 CJS 动态导入——后者触发 vitest 的 CJS→ESM 解析尝试，因 knight.js 使用 ESM `import` 语法失败。**修复原则：当测试文件已顶层 import 模块时，函数级测试直接使用 import 的引用；文件内容测试（源码字符串检查）始终用 `require('fs').readFileSync()`，不要再次 require 模块**。
- **白熊效应合规（第 8 次验证）**：14 种（7 类型 × 2 阶段）lens 文本均使用正向描述，无负向禁词 ✅。
- **测试**：1403/1403（+20 new R87 tests T1-T20；1 pre-existing chatSocket suite failure 与本轮无关）；build ✅；check-build ✅

---

### [2026-06-29 Round 86] 骑士延迟决斗补救策略（knightHistoryStep 三路径 + 续战搜索框架）

- **完成状态**：`knight.js` 的 `knightHistoryStep` 从 4 行升级为三步三路径框架：① 三路径分类（路径A=候选存活/路径B=候选被投票出局/路径C=候选被狼夜杀）→ B/C 触发续战搜索；② 续战搜索按优先级A>B>C 扫描替补候选，`${thresholdA}`/`${thresholdB}` 动态阈值插值；③ 历史约束说明不变。identity_table 写指导新增路径B/C 关键词（"→已投票出局（好人方向一致）"/"→已被狼击杀（铁好人确认）"/"→重启决斗候选：[优先级A/B/C]，[新依据]"）。
- **感知-执行分裂修复（R86-A）**：旧版 `knightHistoryStep` 只说"已出局则跳过"，是一个空操作——骑士知道候选不在了，但无任何替补框架。与 R61（狼人 DAY_VOTE）/ R62（猎人 DAY_VOTE）/ R63（骑士 DAY_VOTE）的感知-执行分裂完全同构，只是发生在 DAY_SPEECH Step 0 层面。**修复原则：凡是"识别到 X 已发生"的感知步骤之后缺少"发生后做什么"的执行路径，都是感知-执行分裂，必须添加对应的执行路径**。
- **动态阈值整合（R86-B）**：续战搜索中使用 `${thresholdA}` / `${thresholdB}` 插值（R51 已声明在 `knightHistoryStep` 之前），残局时自动降低决斗阈值（50%/40%）。**变量依赖顺序原则**：新变量引用其他变量时，必须确认被引用变量在当前变量之前声明——`thresholdA`/`thresholdB` 在 R51 的函数体顶部声明，远早于 `knightHistoryStep`，安全。
- **路径B 信息价值（R86-C）**：候选被群体投票出局（路径B）不仅是"候选消失"，更是"好人阵营方向一致"的正反馈信号——骑士应将此信息用于提升全局判断的 confidence，而非仅仅标注"已出局"。**设计原则：identity_table 中每个"状态变化"都应携带语义——"出局原因"是有价值的二级信息，不要只记录状态，要记录原因**。
- **白熊效应合规（第 7 次验证）**：三路径均使用正向描述（"好人阵营已消灭"/"目标已确认为好人"/"触发续战搜索"），无负向禁词 ✅。
- **测试**：1375/1375（+20 new R86 tests T1-T20；1 pre-existing chatSocket suite failure 与本轮无关）；build ✅；check-build ✅

---

### [2026-06-29 Round 85] NIGHT_GUARD 守卫平安夜守护来源推断框架（guardNightPeaceStep）— NIGHT 侧守卫/狼人平安夜推断对称完成

- **完成状态**：NIGHT_GUARD 新增 `isNightPeacefulGuard`（`ctx.dayCount > 1 && ctx.lastNightInfo?.includes('平安夜')`）、`guardNightPrevDay`（`ctx.dayCount > 1 ? ctx.dayCount - 1 : 0`）和 `guardNightPeaceStep`（三步两路径：① 查 identity_table 含"N${prevDay}夜守护"玩家确认守护目标；② 用守护目标票压推断路径A=票压高→成功拦截狼刀→连守+confidence升15-25；路径B=票压低→狼刀在别处→切换次高候选；③ identity_table 追加"N${prevDay}平安夜：[A连守/B换守]"）。注入位置：`${guardNightStyle}` 之后、`1. 【守护优先级】` 之前，与 R84 wolfNightPeaceStep 结构完全对称。
- **守卫/狼人 NIGHT 侧平安夜推断对称里程碑（R85 总结）**：狼人（R84 wolfNightPeaceStep）知道刀口目标，用票压推断"守卫守住 vs 女巫救了"；守卫（R85 guardNightPeaceStep）知道守护目标，用票压推断"成功拦截 vs 守错方向"。两者互为镜像，利用相同公开信息（票压），从各自私有信息（刀口/守护目标）出发，得出对称决策（换刀/维持 vs 连守/切换）。**平安夜框架至此真正完整**：好人 DAY（R80-R82）+ 狼人 DAY（R83）+ 狼人 NIGHT（R84）+ 守卫 NIGHT（R85）。
- **"预计算条件变量→template 插值"模式第 6 次应用（R85-A）**：R80（peaceNightStep）→R81（seerPeaceNightStep/guardPeaceNightStep）→R82（witchPeaceNightStep）→R83（wolfPeaceNightStep）→R84（wolfNightPeaceStep）→R85（guardNightPeaceStep），连续 6 轮同构，模式已完全固化并可直接用于下一轮连续平安夜二阶推断。
- **守卫 NIGHT 侧独特推断价值（R85-B）**：守卫不需要推断"昨夜刀口是谁"（她不知道）；她只需用票压推断"她守的人是不是狼人的目标"。这比好人 DAY 侧（需要先推断刀口是谁）更直接，但比狼人 NIGHT 侧（直接从 identity_table 读刀口）精度低一级。**设计层级：各角色推断精度 = 私有信息维度（狼人 NIGHT > 守卫 NIGHT > 好人 DAY）**，提示词框架应精确匹配此层级，不能套用统一模板。
- **R73 窗口更新（R85-C）**：NIGHT_GUARD 块从 3777 → 4650 chars（+873 chars），R73 测试窗口从 4500 → 5500。规则（R73 首建、R74/R75/R76/R78 连续应用）第 6 次验证：每次为 NIGHT_* 块添加 800+ chars 后，必须立即检查引用该块的已有测试窗口。
- **白熊效应合规（第 6 次验证）**：路径A/B 均使用正向描述，思维链约束用"thought 中完成"正向限定，无负向禁词 ✅。
- **测试**：1348/1348（+20 new R85 tests T1-T20；R73 窗口修复；1 pre-existing chatSocket suite failure 与本轮无关）；build ✅；check-build ✅

---

### [2026-06-29 Round 84] NIGHT_WOLF 平安夜换刀决策框架（wolfNightPeaceStep）— DAY→NIGHT 平安夜响应闭环完成

- **完成状态**：NIGHT_WOLF wolfHistoryStep 的"若平安夜"单行通用指导（"守卫可能守住/女巫救了，重新评估优先目标"）升级为三步两路径换刀决策框架（wolfNightPeaceStep）：① 查 identity_table "→已NX夜行刀"条目确认刀口ID；② 用刀口目标票压推断守卫/女巫来源（路径A=票压高→守卫守住→今晚换刀；路径B=票压低→女巫救了→维持高优先）；③ identity_table 追加"NX平安夜：[A换刀/B维持]"。与 R83 的 DAY_SPEECH wolfPeaceNightStep 形成完整平安夜 DAY→NIGHT 闭环。
- **狼人 NIGHT 侧独特优势（R84-A）**：狼人在 NIGHT 侧直接知道刀口目标（identity_table 中 `→已NX夜行刀` 标记），因此平安夜推断只需一步（用票压判断守卫/女巫来源），而好人侧需要两步（先用票压推断刀口是谁，再推断守卫/女巫）。**设计原则：角色的推断框架精度应随其私有信息维度而设计，不要套用通用模板**——狼人 NIGHT 侧的推断链比好人 DAY 侧更短、更直接。
- **"预计算条件变量→template 插值"模式第 5 次应用（R84-B）**：R80（peaceNightStep）→ R81（seerPeaceNightStep/guardPeaceNightStep）→ R82（witchPeaceNightStep）→ R83（wolfPeaceNightStep）→ R84（wolfNightPeaceStep），连续 5 轮同构应用，模式已完全固化：① 声明 `isXxx = ctx.dayCount > 1 && ctx.lastNightInfo?.includes('平安夜')`；② 声明 `xxxPeaceStep = isXxx ? '...' : '原始 fallback'`；③ 在 template 中用 `${xxxPeaceStep}` 替换硬编码文本；④ 测试：静态断言 + 生成断言各 10 项。
- **wolfHistoryStep 改动安全性（R84-C）**：wolfNightPeaceStep 必须在 wolfHistoryStep 之前声明（JavaScript 时序约束）；wolfHistoryStep 第3分支的原始文本改为 `${wolfNightPeaceStep}`，非平安夜时 fallback 返回原始文本，向下兼容。**验证清单：① 声明顺序正确 ② fallback 保留原文本 ③ R76（7000 char 窗口）未截断 ④ R79（动态切片）不受影响**。
- **白熊效应合规（第 5 次验证）**：wolfNightPeaceStep 两路径均使用正向描述（"今晚换刀"/"维持今晚高优先"），thought 约束用"thought 中完成"正向限定，无负向禁词 ✅。
- **测试**：1319/1319（+20 new R84 tests T1-T20；1 pre-existing chatSocket suite failure 与本轮无关）；build ✅；check-build ✅

---

### [2026-06-29 Round 83] 狼人 DAY_SPEECH 平安夜战术推断（wolfPeaceNightStep）— 好/狼两侧感知对称完成

- **完成状态**：狼人 DAY_SPEECH 新增 `isPeacefulNightWolf`（`ctx.dayCount > 1 && ctx.lastNightInfo?.includes('平安夜')`）和 `wolfPeaceNightStep`（两路径：路径A=高票存活者=刀口目标→连守概率高，强烈建议换刀；路径B=高票存活者≠刀口目标→女巫可能救了，维持高优先）。注入位置 `${wolfPeaceNightStep}Step1 局势评估`，在 Step0（次日叙事预案读取）文本末尾之后插入，与 R80-R82 好人侧完全对称。
- **平安夜感知对称里程碑（R83 总结）**：好人侧（村民R80/预言家R81/守卫R81/女巫R82）+ 狼人侧（R83）全部完成。每个角色依据其私有信息精度提供不同层次的平安夜推断，双侧均可利用平安夜公开信息更新各自的战术评估。
- **窗口截断（新教训 R83-A）**：R83 在 `wolfSpeechLen` 赋值后新增约 760 chars 变量块，使 wolf Step0 内容从约 4169 移至 4911，超出 `round57SeerDaySpeechStep0.test.js` T23 的 4500 窗口。**修改 wolf DAY_SPEECH 变量声明区（`wolfSpeechLen` 之后、`return` 之前）时，必须检查所有以固定偏移搜索 wolf 模板内容的测试**。检测命令：`grep -rn "wolfFnStart\|wolf.*slice" src/services/__tests__/*.test.js`。窗口已修复至 6000。
- **狼人视角的平安夜推断独特性**：狼人知道自己的刀口目标，因此推断优先级更直接——无需用高票存活者推断"刀口"（已知），只需用高票存活者判断"是守卫守的还是女巫救的"——这是好人侧村民/守卫/女巫无法做到的（他们不知道狼人刀口是谁）。
- **白熊效应合规**：路径A/B 均使用正向描述（"连守概率高/换刀"、"维持高优先"），speech 约束用"参照次日叙事预案自然应对"正向限定，无负向禁词 ✅
- **测试**：1289/1289（+20 new R83 tests T1-T20；+1 round57 窗口修复；1 pre-existing chatSocket suite failure 与本轮无关）；build ✅；check-build ✅

---

### [2026-06-28 Round 82] 女巫平安夜推断框架（witchPeaceNightStep）— 感知-执行分裂修复

- **完成状态**：女巫 DAY_SPEECH 新增 `isPeacefulNightWitch`（`ctx.dayCount > 1 && ctx.lastNightInfo?.includes('平安夜')`）和 `witchPeaceNightStep`（两分支：路径A=解药已用且savedIds非空→确认lastSaved为狼刀目标，confidence升20-30；路径B=解药未用→推断守卫守中高票存活者，confidence降10-15）。注入位置 `${witchPeaceNightStep}Step1:`，在 `${witchDayHistoryStep}` 之后、Step1 之前（不覆盖 R58 读写闭环的 Step0）。
- **女巫推断精度级联（R82 总结）**：平安夜推断级联按私有信息精度排序：村民（仅票记录）→ 预言家（+查验历史）→ 守卫（+知道守了谁）→ 女巫（+知道是否用过解药）。女巫的关键优势：能直接判断平安夜来源（自己行动 vs 守卫行动），无需间接推断。至此平安夜推断级联四角色全部完成（R80 村民 → R81 预言家+守卫 → R82 女巫）。
- **窗口大小教训（R82-A）**：R81 全功能版本的女巫函数约 6000 chars；R82 新增约 2000 chars，总计约 8050 chars。测试窗口必须从旧版本的 3000 扩展到 10000。**每轮在复杂角色函数中新增代码后，必须重新计算函数字符数，确保测试窗口 ≥ 函数总大小 × 1.2**。计算命令：`awk '/函数Marker/{start=NR} start{chars+=length($0)+1} /下一角色/{if(start && NR>start){print chars; exit}}' src/services/aiPrompts.js`。
- **插入位置设计（R82-B）**：witchPeaceNightStep 插入在 `witchSpeechLen` 之后、`return` 之前。这是本轮所有平安夜推断变量的一致位置——紧邻 return 前，避免干扰已有的历史读写变量（witchDayHistoryStep、personalityLens 等）。
- **白熊效应合规**：路径A/B 均使用正向描述（"confidence 升 20-30"、"按普通村民发言"），无负向禁词 ✅
- **测试**：1259/1259（+20 new R82 tests T1-T20，窗口 10000 chars；1 pre-existing chatSocket suite failure 与本轮无关）；build ✅；check-build ✅

---

### [2026-06-28 Round 81] 预言家/守卫平安夜推断框架（seerPeaceNightStep + guardPeaceNightStep）— 同构批量完成

- **完成状态**：预言家 DAY_SPEECH 新增 `isPeacefulNightSeer` + `seerPeaceNightStep`（三路径：A=高票存活者已验金水→confidence升至90-100+改查方向；B=高票存活者未验→confidence升15-20+排队查验优先级①；C=票型分散→维持队列）。守卫 DAY_SPEECH 新增 `isPeacefulNightGuard` + `guardPeaceNightStep`（两分支：lastGuardTarget已知→命中推断 confidence升15-25/未中推断维持；lastGuardTarget为null→通用高票推断）。注入位置均为 `${角色DayHistoryStep}\n${角色PeaceNightStep}Step1:`，与 R80 村民完全对称。
- **平安夜推断级联原则（R81-A）**：发现"某角色平安夜推断缺失"后，应立即审计所有拥有**更强私有信息**的角色是否同样缺失：村民（仅有公开票记录）→ 预言家（+查验历史金水/查杀）→ 守卫（+知道昨夜守了谁）→ 女巫（+知道是否用过救药）。每个角色的推断精度因私有信息不同而递增，应按此顺序逐轮修复，而非只修村民。
- **Round58 窗口扩展（R81-B）**：守卫 DAY_SPEECH block 从 3338→4182 chars（+844 chars），导致 `round58WitchGuardDaySpeechStep0.test.js` 的 3200 窗口被截断，T18/T19/T20/T21 失败。**每次为某角色添加 ~800+ chars 后，必须立即检查所有引用该角色 block 的已有测试文件的窗口大小**。检测命令：`grep -l "守卫\|'guard'\|guardFuncBlock" src/services/__tests__/*.test.js` 列出引用守卫的测试文件，逐一核查窗口是否仍足够。
- **守卫平安夜推断的独特价值（R81-C）**：守卫的 `guardPeaceNightStep` 在变量声明阶段直接引用 `lastGuardTarget`（已从 params 解构），将目标号码嵌入推断文本——这是"运行时个性化提示词"的典范：同一个函数为不同的守护目标生成不同的推断文本，而无需任何 LLM 特殊处理。设计原则：凡是角色有"已知的、具体的、数字型的"私有状态，优先将其直接插入推断文本而非泛化描述（"某个目标"→"${lastGuardTarget}号"）。
- **白熊效应合规（3轮验证）**：R80（村民）+ R81（预言家+守卫）连续三次平安夜推断框架均使用正向描述（"confidence 升"/"维持队列"/"命中推断"），Speech 限制使用正向框定（"思维链中完成；speech 正常发言即可"），无"不要展示"等负向禁词。这是经3轮验证的合规设计模式，可直接复用于女巫平安夜推断。
- **测试**：1230/1230（+40 new R81 tests + 1 round58 window fix）；build ✅；check-build ✅；pre-existing chatSocket suite failure（missing `ws` package）与本轮无关。

---

### [2026-06-28 Round 80] 村民平安夜推断框架（peaceNightStep）— 好人侧感知-执行闭合

- **完成状态**：`ROLE_DAY_SPEECH_PROMPTS['村民']` 函数新增条件化变量 `isPeacefulNight`（`ctx.dayCount > 1 && ctx.lastNightInfo?.includes('平安夜')`）和 `peaceNightStep`（空字符串初值，平安夜时赋值为结构化推断步骤）。步骤内容：① 查投票记录 D${prevDay} 中票压最高的存活玩家（最可能被刀但未死）；② 若场上有守卫或女巫，该玩家 identity_table confidence 可降 10-20；③ 若票型分散，维持现有判断。注入位置：`${peaceNightStep}Step1:`，即 Step0（历史积累读取）之后、Step1（当前嫌疑分析）之前。只在 D2+ 平安夜触发，D1 和非平安夜下注入为空字符串，完全向下兼容。
- **感知-执行分裂（新教训 R80-A）**：`ctx.lastNightInfo` 和 `ctx.voteInfo` 中平安夜信息在 D2+ 通过 `getBaseContext` 已注入 base prompt，AI"看得到"但无推断脚手架，是典型感知-执行分裂。修复方式是在 Step0 和 Step1 之间插入条件化步骤。检验原则：**每个"AI 能看到的信息"都应该有对应的"AI 知道怎么用这个信息"的推断步骤**，否则信息对 AI 决策质量贡献为零。
- **模板端块定位（新教训 R80-B）**：测试定位村民 DAY_SPEECH block 时，正确的结束标记是 `"    '骑士':"` 而非 `"'猎人':"（不存在）`。测试编写前应先用 `src.indexOf()` 验证下一个 key 是什么，不要凭直觉猜测 ROLE_DAY_SPEECH_PROMPTS 中角色排列顺序。
- **T18 白盒测试设计（新教训 R80-C）**：验证"模板使用变量插值而非硬编码"时，不能用 `expect(block).not.toContain(stepContent)` ——因为 `peaceNightStep` 的赋值语句本身就在同一 block 内，会导致误报。正确做法：找到 `return` 语句的切片，在 return 块内验证 `${peaceNightStep}` 存在且 `⭕` 不存在（因为 ⭕ 只在赋值段，不在 return 段）。
- **白熊效应合规**：步骤内容无"不要""禁止"等负向禁词；speech 指引用"只说'平安夜，继续分析局势'"正向描述限制范围，不用"不要在 speech 里展示推断过程" ✅。
- **Block 大小**：村民 DAY_SPEECH 2940 → 3459 chars（+519 chars），测试窗口 3000-5000 chars。
- **测试**：1179/1179（+20 new R80 tests，T1-T20）；build ✅；check-build ✅；pre-existing chatSocket suite failure（missing `ws` package）与本轮无关。

---

### [2026-06-28 Round 79] NIGHT_WOLF 次日刀后叙事预案 + DAY_SPEECH Step 0 次日叙事读取 — 新增跨阶段叙事一致性闭环

- **完成状态**：NIGHT_WOLF 新增 Step 4"次日刀后叙事预案"（+386 chars），在刀口决策后规划明天的公开应对，覆盖三种情况：① 今日推过/质疑过→"顺势应对"；② 今日中立或曾站该目标→"补叙细节"；③ 今日明确保过→"引导焦点到第三方"。Wolf DAY_SPEECH Step 0 标题更新为"读取跨轮威胁积累 + 次日叙事预案"，新增读取 identity_table 中含"次日叙事"的注记并按注记执行。identity_table 刀口行写指导更新为追加"次日叙事：[预计应对策略]"。
- **新增 Read-Write 闭环（新教训 R79-A）**：这是在"高优先刀口"闭环基础上新增的第二条狼人跨阶段闭环——"次日叙事"。**NIGHT_WOLF（写）→ DAY_SPEECH Step 0（读）→ speech 执行**。两条闭环共存于同一 identity_table 条目中（reason 字段含"高优先刀口：..."和"→已NX夜行刀；次日叙事：..."），各自在不同阶段被读取。设计原则：一个 identity_table reason 字段可以包含多个语义段，用"；"分隔，各段由不同阶段的 Step 0 读取，互不干扰。
- **竞技依据（Wang 2025，arxiv:2408.17177）**：LLM 狼人最大弱点之一是跨轮行为一致性——AI 在某轮"保了"某好人，次日对其死亡却反应异常，暴露决策模式。次日叙事预案解决了"决策时点（NIGHT）"和"叙事时点（DAY）"之间的信息断层。
- **白熊效应合规**：Step 4 三个分支均用正向描述（"顺势"/"补叙细节"/"引导到第三方"），无"不要显示怀疑"等负向禁词 ✅。
- **Block 大小控制（已固化规则的第 5 次应用）**：NIGHT_WOLF 4975→5361 chars，测试窗口 7000；Wolf DAY_SPEECH 5187→5242 chars，测试窗口 7000。
- **测试**：1159/1159（+20 new R79 tests）；dry-run 27/27；build ✅；check-build ✅。

---

### [2026-06-28 Round 78] 摄梦人/魔术师 NIGHT 侧个性化（dreamweaverNightStyle + magicianNightStyle）— 全角色三阶段覆盖里程碑

- **完成状态**：NIGHT_DREAMWEAVER（内联于 aiPrompts.js）新增 `dreamweaverNightPersonalityType`（从 `currentPlayer?.personality?.type` 直接读取）和 `dreamweaverNightStyle`（7 种入梦风格分叉）：aggressive→主动进攻型（连梦阈值≥65%即出手）；cautious→谨慎保护型（防御最高优先，≥80%才进攻）；logical/analytical→推理优化型（量化三模式期望收益）；cunning→博弈欺骗型（切换目标制造方向假象）；emotional→直觉感知型（白天发言感受>数值）；contrarian→反预判型（选狼人最不预期候选）；steady→平衡渐进型（防御>进攻>殉情严格框架）。NIGHT_MAGICIAN 通过 `magicianModule.nightAction()` 委托，`currentPlayer` 不在闭包内，需从调用端显式传递 `personalityType`（区别于 NIGHT_DREAMWEAVER 闭包访问模式）。`getMagicianNightActionPrompt` 新增 `personalityType` 解构和 `magicianNightStyle`（7 种换刀风格分叉）。
- **关键架构差异（新教训 R78-A）**：NIGHT 侧个性化注入有两种模式——①内联模式（NIGHT_GUARD/WITCH/SEER/WOLF/DREAMWEAVER）：`currentPlayer` 在 `generateUserPrompt` 闭包中直接可用，只在 case 内部添加变量声明即可；②委托模式（NIGHT_MAGICIAN）：角色夜间逻辑在独立模块文件（`rolePrompts/magician.js`）中，`currentPlayer` 不在其作用域，**必须**从调用端（aiPrompts.js NIGHT_MAGICIAN case）显式传递 `personalityType: currentPlayer?.personality?.type || ''`。判断依据：看 case 是 `return magicianModule.nightAction({...})` 委托还是内联 `return \`模板字符串\``。
- **批量同构同轮完成（R58 原则）**：NIGHT_DREAMWEAVER + NIGHT_MAGICIAN 结构完全相同（7 分支 if-else，historyStep 后、Step1 前注入），一轮完成避免两轮上下文重复初始化。与 R77（同轮完成两者 DAY_SPEECH personalityLens）前后呼应。
- **全角色三阶段里程碑**：R78 完成后，摄梦人（DAY_SPEECH R77 + DAY_VOTE R72 + NIGHT R78）和魔术师（DAY_SPEECH R77 + DAY_VOTE R72 + NIGHT R78）均达到三阶段全覆盖。结合守卫（R69+R71+R73）/ 女巫（R68+R71+R74）/ 预言家（R68+R71+R75）/ 狼人（R66+R61+R76）/ 骑士（DAY_SPEECH+VOTE+夜间不适用），所有有 NIGHT 行动的非平民角色均已三阶段个性化完整覆盖。
- **identity_table 追加不覆盖（一致性修复）**：T17 失败发现 NIGHT_DREAMWEAVER identity_table 指导缺少 `追加不覆盖历史` 显式条目（其他角色均有，该段仅有 `追加示例`）。补充此行使指导与其他角色一致。教训：写测试时检查每个 identity_table 指导是否包含三要素：①填写规则、②追加示例、③追加不覆盖历史。
- **测试**：1131/1131（+40 new R78 tests，T1-T20 摄梦人，T21-T40 魔术师）；build ✅；check-build ✅；pre-existing chatSocket suite failure（missing `ws` package）与本轮无关。

---

### [2026-06-27 Round 77] 摄梦人/魔术师 DAY_SPEECH personalityLens（R77）— 同构批量完成

- **完成状态**：`dreamweaver.js` 的 `getDreamweaverDaySpeechPrompt` 和 `magician.js` 的 `getMagicianDaySpeechPrompt` 各新增 personalityType 参数读取和 7 分支 personalityLens（dreamweaverPersonalityLens / magicianPersonalityLens），字数范围联动调整（aggressive 偏长、cautious 偏短）。注入位置与其他角色 DAY_SPEECH 完全对称（发言策略开头部分）。
- **DAY_SPEECH 全角色个性化完成里程碑**：R77 后，所有非平民神职角色（预言家/守卫/女巫/猎人/骑士/摄梦人/魔术师）和狼人的 DAY_SPEECH 均有 personalityLens。
- **测试**：1048/1048（+40 new R77 tests，T1-T20 摄梦人，T21-T40 魔术师）；build ✅；check-build ✅；干跑 25/25 ✅。

---

### [2026-06-27 Round 76] 狼人 NIGHT_WOLF 刀口选择风格个性化（wolfNightStyle）— NIGHT 侧四连完成里程碑

- **完成状态**：NIGHT_WOLF case 新增 `wolfNightPersonalityType`（从 `currentPlayer?.personality?.type` 直接读取）和 `wolfNightStyle`（7 种个性类型的刀口选择风格分叉）。aggressive→主动锁刀型（直刀最高 confidence 威胁目标，不因守护风险回避）；cautious→保守规避型（刀"最安全"目标，守护概率>40%放弃）；logical/analytical→推理优化型（量化期望价值=威胁等级×(1-被守护概率)，选最高）；cunning→博弈迷雾型（偶尔刀次优目标制造刀口方向假象）；emotional→直觉感知型（白天最敌对/活跃玩家优先，个人威胁感知先于数据）；contrarian→反预判型（选守卫最不可能守护的次优目标，让守护资源浪费）；steady→平衡渐进型（严格按角色优先级框架保持目标连续性，不随意换刀）。注入位置：wolfHistoryStep 之后、1.【角色推断】之前，与 R73/R74/R75 守卫/女巫/预言家模式完全对称。
- **NIGHT_WOLF block 大小变化**：3287 → 4975 chars（+1688 chars），测试窗口设为 7000（4975 × 1.4）。第四次成功应用"先估算块大小→再设测试窗口"规则（R73 首建、R74/R75/R76 连续验证）——规则已完全固化，可不再赘述。
- **NIGHT 侧四连完成里程碑**：守卫（R73）→ 女巫（R74）→ 预言家（R75）→ 狼人（R76）全部完成 NIGHT 侧个性化。4 大主 NIGHT 行动角色全量覆盖，骑士/摄梦人/魔术师因特殊性可放低优先级。
- **狼人三阶段覆盖里程碑**：狼人成为第四个三阶段全覆盖角色：DAY_SPEECH（R66 pressureHint + R70 speechLen）+ DAY_VOTE（R61 wolfDefenseTrigger + R65 thisRoundVoteHint）+ NIGHT_WOLF（R76 wolfNightStyle）。
- **NIGHT 侧个性化注入位置模式（四例验证后完全固化）**：注入点 = `${角色HistoryStep}` 之后（紧接历史读取）、主思维链步骤 1 之前（不干预决策框架）。调用端无需改动（`currentPlayer` 在 generateUserPrompt 闭包中直接可用，R5 教训）。7 种风格均正向描述，无"不要刀"等负向禁词（白熊效应合规）。
- **测试**：1048/1048（+20 new R76 tests）；build ✅；check-build ✅；干跑 25/25 ✅。

---

### [2026-06-27 Round 75] 预言家 NIGHT_SEER 夜间查验顺序个性化（seerNightStyle）— NIGHT 侧第三个个性化完成

- **完成状态**：NIGHT_SEER case 新增 `seerNightPersonalityType`（从 `currentPlayer?.personality?.type` 直接读取）和 `seerNightStyle`（7 种个性类型的查验目标选择风格分叉）。aggressive→主动威胁型（直接查最高嫌疑目标，早确认=早带全员集票）；cautious→边缘安全型（查边缘/陌生目标，多元化路径掩护推断主方向）；logical/analytical→推理优化型（按 identity_table confidence 选信息增量最大目标）；cunning→情报迷雾型（故意查确认好人制造查验随机假象）；emotional→直觉导向型（白天强烈直觉感知优先于数据 confidence）；contrarian→反预判型（预判狼人在预判被查目标，选次优但最不被预期的候选）；steady→平衡渐进型（严格按①②③④⑤优先级框架稳步推进）。注入位置：seerHistoryStep 之后、seerNightStrategy（三阶段策略框架）之前，与 R73 守卫、R74 女巫模式完全对称。
- **NIGHT_SEER block 大小变化**：2872 → 4645 chars（+1773 chars），测试窗口设为 6200（4645 × 1.35）。第三次成功应用"先估算块大小→再设测试窗口"规则（R73 首建、R74 首验证、R75 再次成功应用）——规则已稳定固化。
- **预言家三阶段个性化覆盖里程碑**：预言家成为第三个三阶段个性化全覆盖角色（DAY_SPEECH R68 + DAY_VOTE R71 + NIGHT_SEER R75）。守卫（R69+R71+R73）、女巫（R68+R71+R74）同样已完成三阶段覆盖。
- **NIGHT 侧个性化连续成功模式确认**：同一套"historyStep 之后、strategy 之前"注入模式已在 NIGHT_GUARD（R73）、NIGHT_WITCH（R74）、NIGHT_SEER（R75）三个 case 中验证成功，成为 NIGHT 侧个性化标准模板。下次为 NIGHT_WOLF 添加个性化时直接复用此模式。
- **白熊效应合规设计**：7 种查验风格均为正向指令（"主动威胁型"、"边缘安全型"等），核心描述"什么样的玩家→如何选择目标"，无"不要查"等负向禁词 ✅。
- **测试**：1019/1019（+20 new R75 tests）；build ✅；check-build ✅；干跑 25/25 ✅。

---

### [2026-06-27 Round 74] 女巫 NIGHT_WITCH 夜间用药策略个性化（witchNightStyle）— NIGHT 侧第二个个性化完成

- **完成状态**：NIGHT_WITCH case 新增 `witchNightPersonalityType`（从 `currentPlayer?.personality?.type` 直接读取）和 `witchNightStyle`（7 种个性类型的用药激进程度分叉）。aggressive→激进出手型（有机会立即行动）；cautious→保守持药型（保留双药到临界）；logical/analytical→推理验证型（quantity化判断再行动）；cunning→博弈伪装型（刻意延迟用毒制造假象）；emotional→直觉感知型（当晚威胁感先于数据）；contrarian→反预判型（预判狼人在预判自己的用药节奏）；steady→平衡节药型（中等阈值稳步出手）。注入位置：witchHistoryStep 之后、Step 1（解药考量）之前，与 R73 守卫模式完全对称。
- **NIGHT_WITCH block 大小变化**：2209 → 4023 chars（+1814 chars），测试窗口设为 5200（4023 × 1.3）。这是 R73 "大型 case block 修改后必须估算尺寸"教训的第一次成功预防应用——先估算再设窗口，未发生截断失败。
- **女巫三阶段覆盖里程碑**：女巫成为第二个三阶段个性化全覆盖角色（DAY_SPEECH R68 + DAY_VOTE R71 + NIGHT_WITCH R74）。NIGHT 侧个性化下一优先：预言家（查验顺序个性化）→ 狼人（首狼刀口选择风格）。
- **白熊效应合规设计**：7 种用药风格均为正向指令（"激进出手型"、"保守持药型"等），核心描述"什么样的玩家→如何决策"，无"不要用毒"等负向禁词 ✅。
- **测试**：999/999（+20 new R74 tests）；build ✅；check-build ✅；干跑 25/25 ✅。

---

### [2026-06-27 Round 73] 守卫夜间守护决策个性化（guardNightStyle）— NIGHT 侧首个个性化完成

- **完成状态**：NIGHT_GUARD case 新增 `guardNightPersonalityType`（从 `currentPlayer?.personality?.type` 直接读取，无需改调用端）和 `guardNightStyle`（7 种个性类型的换守 vs 连守策略分叉）。aggressive→主动探索型；cautious→稳健连守型；logical/analytical→信息挖掘型；cunning→博弈欺骗型；emotional→直觉感知型；contrarian→反预判型；steady→平衡渐进型。注入位置：Step 0（历史读取）之后、Step 1（守护优先级）之前。守卫成为首个三阶段全覆盖角色（DAY_SPEECH R69 + DAY_VOTE R71 + NIGHT R73）。
- **窗口截断第三次（R68-A / R70 教训重现）**：NIGHT_GUARD block 添加 ~700 chars 个性块后达 3777 chars，初始窗口 3200 导致 T11/T16/T18 失败。调整到 4500 通过。预防命令：每次修改大型 case block 后运行 `node -e "const s=require('fs').readFileSync('src/services/aiPrompts.js','utf8'); const a=s.indexOf('case PROMPT_ACTIONS.NIGHT_GUARD: {'); const b=s.indexOf('case PROMPT_ACTIONS.NIGHT_MAGICIAN:', a); console.log('NIGHT_GUARD size:', b-a)"` 估算尺寸，测试窗口取 estimatedSize * 1.2。
- **NIGHT 侧个性化路线图（R73 新增）**：守卫 NIGHT 个性化完成后，下一优先序：女巫（是否激进用药/双保策略差异大）→ 预言家（查验顺序是否按 confidence 降序或反直觉选择）→ 狼人（多狼协作时刀口选择风格）。NIGHT 侧个性化的设计维度与 DAY 侧不同——DAY 侧影响"如何表达"，NIGHT 侧影响"如何决策"，两者正交。
- **测试**：979/979（+20 new R73 tests）；build ✅；check-build ✅；干跑 25/25 ✅。

---

### [2026-06-27 Round 72] 摄梦人/魔术师 DAY_VOTE 读写闭环补完 — 梦票对齐 + 换票对齐

- **完成状态**：摄梦人（dreamweaverVoteStrategy）和魔术师（magicianVoteStrategy）DAY_VOTE 专属策略新增并接入三元链。摄梦人读取"连梦候选" → 梦票对齐（投票出局 > 夜间入梦，节省入梦能力）；魔术师读取"换刀候选" → 换票对齐（投票直接淘汰 > 夜间换刀风险转移）。防御入梦候选（摄梦人需要保护的核心好人）有反向例外处理。DAY_VOTE 全角色读写闭环**首次完整覆盖**（6 专属路径 + 3 有意 fallback）。
- **同构检测三步法（R72 新增）**：每次在 DAY_VOTE 中为某角色添加专属路径时，立即问"哪些其他角色在 DAY_SPEECH 或 NIGHT_* 中有 identity_table 候选写指导？"。用 `grep -n "连梦候选\|换刀候选\|开枪优先级：高\|高优先刀口\|决斗候选" src/services/aiPrompts.js src/services/rolePrompts/*.js` 列出所有写候选关键词，对比 DAY_VOTE 三元链缺口，发现即修复——不等"自然发现"（R21/R23 教训）。
- **摄梦人防御候选例外设计原则**：摄梦人 identity_table 有两类写候选——"连梦候选"（进攻目标）和"防御入梦候选"（需要保护的好人）。DAY_VOTE 策略必须区分两类方向：连梦候选 → 投票淘汰；防御入梦候选 → 方向相反，投查杀或进攻候选。这是摄梦人独有的"防御保护"写候选带来的投票反向例外，是策略设计考虑到游戏语义的专属处理。
- **vote-dream/vote-swap 对齐原则（同 vote-duel/vote-shoot 原则）**：凡是角色有"一次性或有限次技能"（骑士决斗/猎人开枪/摄梦人入梦/魔术师换刀），DAY_SPEECH 积累的技能方向候选**必须**在 DAY_VOTE 中有对应读取框架——投票方向与技能行动方向对齐，能出局就节省技能资源。普适原则：先用投票，再用技能。
- **测试**：953/953（+20 new R72 tests）；build ✅；check-build ✅；干跑 25/25 ✅。

---

### [2026-06-27 Round 71] DAY_VOTE 语气风格一致性 — personalityType 影响投票理由表述

- **完成状态**：DAY_VOTE case 新增 `votePersonalityType`（从 `currentPlayer?.personality?.type` 直接读取，无需改调用端）和 `voteStyleHint`（5 种个性类型差异化风格指引）。输出 JSON `reasoning` 字段描述对 aggressive/cautious 差异化。形成 DAY_SPEECH（个性化发言风格）→ DAY_VOTE（个性化投票表述）的跨阶段个性化完整覆盖。
- **DAY_VOTE 个性化设计原则（R71 新增）**：`voteStyleHint` 调整"如何表达投票决策"，不影响"选谁"的策略框架——策略由角色专属块（wolfsVotingFramework/seerVoteStrategy/hunterVoteStrategy/knightVoteStrategy）覆盖。两层分离：策略层（选谁）+ 表达层（如何说）。
- **调用端无需修改规则**：`generateUserPrompt` 中 `currentPlayer` 已在所有 case 作用域可用，需要玩家私有状态时直接用 `currentPlayer?.field` 读取，不必通过调用端传参（R5 教训的延伸应用：DAY_VOTE 也适用此模式）。
- **"有意 fallback"不等于"没有个性化空间"**：守卫/女巫/村民 DAY_VOTE 走通用 fallback（R63 确认），但这只是"策略框架"层面的 fallback——**在相同策略框架内**，仍可通过 `voteStyleHint` 注入表达风格差异化。两者是正交维度，不互斥。
- **测试**：933/933（+15 new R71 tests）；build ✅；check-build ✅；干跑 25/25 ✅。

---

### [2026-06-26 Round 70] 狼人/预言家/女巫/村民 DAY_SPEECH 发言字数差异化

- **完成状态**：R67（村民）→ R68（预言家/女巫）→ R69（猎人/守卫）→ R70（狼人+预言家+女巫+村民）完成所有 6 主角色 `speechLen` 差异化。`aggressive` 型发言更短促，`cautious` 型发言更详尽，每个角色的字数范围与其个性风格自然匹配，提升可观战性。
- **窗口截断第二次发生（R68-A 重演）**：R70 为女巫函数新增 `witchSpeechLen` 块（~110 bytes）后，round58 测试的 3200 字节窗口变得不够用（女巫函数至 `return` 已达 2261 bytes，追加示例位于 tmpl 第 995 bytes）。必须把窗口从 3200 升至 4500。这是 R68-A 教训第二次发生的情况——证明该问题是系统性的，不是一次性的。
- **窗口截断预防性命令**：每次修改大型 DAY_SPEECH 函数后，用以下命令快速估算风险：`node -e "const fs=require('fs'); const src=fs.readFileSync('src/services/aiPrompts.js','utf8'); ['女巫','狼人','预言家','猎人','守卫','村民'].forEach(r => { const i=src.lastIndexOf(\"'\" + r + \"': (ctx, params) =>\"); if(i>-1) { const ret=src.indexOf('return \`', i); console.log(r+'函数至return:',ret-i,'bytes'); }})"` 对比各测试文件的窗口值，发现截断风险。
- **字数差异化设计原则（R70 新增）**：反映该性格"信息处理深度"的自然差异——`aggressive` 结论先行省略铺垫（下界降低），`cautious` 全面分析再表态（上界提高）。其他类型保持默认范围不变。
- **测试**：918/918 通过（+24 new R70 tests）；build ✅；check-build ✅；干跑 25/25 ✅。

---

### [2026-06-26 Round 69] 猎人/守卫 DAY_SPEECH personalityLens + 发言字数差异化

- **完成状态**：R67（村民）→ R68（预言家/女巫）→ R69（猎人/守卫）完成 personalityLens 注入，所有主路径 DAY_SPEECH 角色均已覆盖。
- **伪装风格 vs 分析/报验风格**：猎人/守卫 lens 的设计维度与村民/预言家本质不同——村民 lens 影响"如何分析局势"，预言家 lens 影响"如何呈现验证结果"，而**猎人/守卫 lens 影响"如何伪装成普通村民"**。核心张力是信息优势与身份隐藏之间的平衡，不同个性产生不同的"信息泄露风险控制策略"。
- **发言字数差异化**：`hunterSpeechLen`（aggressive→40-60字；cautious→60-100字；默认40-80字）+ `guardSpeechLen`（aggressive→35-55字；steady→45-75字；默认40-70字）。字数分化使不同性格的 AI 发言长度自然匹配其风格期望，提升可观战性。
- **R68-A 教训再次验证**：为角色添加新代码段（personalityLens + speechLen 两组 if/else）会使函数体显著增长，导致已有测试的窗口截断失效。每次新增大段代码后，必须检查所有引用该函数的测试文件的 `src.slice(start, start + N)` 窗口大小是否仍然足够。本轮猎人函数超出 1600 窗口（需 4000），roleParams 区超出 2000 窗口（需 2200）。
- **vitest test() 格式强制规则（R69 新增）**：测试文件中任何断言必须放在 `test()` 或 `it()` 调用内，vitest 才能发现和执行。console.log + 手动循环的"脚本式测试"在 `node` 环境可运行，但 vitest 显示 `(0 tests)`，相当于测试完全无效。检测方法：`grep -c "^test\b\|^it\b" src/services/__tests__/*.test.js` 所有文件应 ≥ 1。
- **白熊效应合规程式**：lens 块从变量初始化到 speechLen 声明之间，全面检查是否包含"不要说"、"禁止"、"绝不能"、"不能说"。本轮猎人/守卫 lens 全部为正向描述（"展现X形象"、"用Y方式表达"），合规 ✅。
- **测试**：894/894 通过（+28 new R69 tests）；build ✅；check-build ✅。

---

### [2026-06-26 Round 68] 预言家/女巫 DAY_SPEECH personalityLens 注入

- **完成**：R67 村民 personalityLens → R68 预言家（seerPersonalityLens，7分支"报验风格"）+ 女巫（witchPersonalityLens，7分支"发言风格"）。
- **R68-A 教训（窗口截断）**：为 seer/witch 添加 personalityLens if/else 链后，函数体约增加 1200-1500 字节。round67VillagerPersonalityLens.test.js 的 `roleParamsBlock` 窗口（2000 chars）开始逼近边界——后续每次在 DAY_SPEECH case 之前添加代码都可能推移 `const roleParams = {` 位置。解决方案：窗口保持 ≥ 2500 以留有余量，或改用 `src.indexOf('personality?.type', roleParamsStart)` 直接定位而非依赖固定窗口。
- **R68-B 教训（lens 设计原则）**：角色特定的 personalityLens 影响的是"呈现方式"而非"决策内容"——预言家 lens 影响"如何在发言中传递验证信息"（强势vs柔和vs暗示），女巫 lens 影响"如何在保留资源/行动后组织发言"。lens 不应触及"是否用药"、"今晚守护谁"等核心决策——那些属于 thought 层面，不在发言风格范畴。
- **测试**：866/866 通过；build ✅。

---

### [2026-06-26 Round 67] 村民 DAY_SPEECH personalityLens 注入

- **问题**：所有村民发言模式趋同，可观战性 7.8/10。8 种个性类型在系统提示词有差异，但用户提示词【分析框架】完全相同。
- **修复**：`personalityType` 字段新增到 roleParams，村民 DAY_SPEECH 函数体语法改写，按 7 种类型动态生成 `personalityLens`，注入到【村民发言要求】之后、【分析框架】之前。
- **白熊效应**：所有 lens 均为正向指令（"优先用X分析"），无负向禁止词 ✅。
- **向下兼容**：无 personalityType 时 `personalityLens = ''`，prompt 退化到 R66 状态 ✅。
- **测试**：806/806（含 R67 的 24 new tests）；build ✅。

---

### [2026-06-26 Round 66] DAY_SPEECH 狼人发言阶段队友票压感知 — 跨阶段防守链补全

- **问题**：R65 为 DAY_VOTE 添加了 `wolfDefenseTrigger`（当 ≥ ceil(N/2) 人指向队友时执行防守），但 DAY_VOTE 中的防守操作（"将票转向第三方好人"）依赖一个前提：发言阶段已预铺"Z号更可疑"的叙事。aiPrompts.js 第1902行明确标注"须在发言阶段已预铺理由才能说服他人"，但 DAY_SPEECH 提示词没有任何机制让狼人在此时机采取行动。结果：防守链"发令枪"在投票时发出，但"赛前准备"（发言阶段的叙事建立）从未完成。
- **修复**：
  - `useSpeechFlow.js`：在 wolf roleParams 构建块中新增压力图计算——扫描当天已发言记录的 `voteIntention` 字段，当 ≥2 个非弃票意向指向同一队友时，注入 `pressuredTeammate` + `pressuredCount` 参数。
  - `aiPrompts.js`：wolf DAY_SPEECH 中新增 `wolfSpeechPressureHint`——触发时注入"引入第三嫌疑人作为焦点"指令，为后续投票阶段的叙事转移提供基础；PK 模式下自动跳过。
- **阈值梯度设计**：DAY_SPEECH 阶段 2票触发（需要早期预防），DAY_VOTE 阶段 ceil(N/2) 触发（严格多数执行）——两阶段梯度形成"早准备→晚执行"的防守链。
- **白熊效应检查**：hint 为纯正向指令（"引入Z作为焦点"），无"不要保护X"等负向禁止词 ✅。
- **跨阶段感知-执行分裂的通用原则**：当某个"执行指令"（DAY_VOTE防守）依赖前一阶段（DAY_SPEECH）的叙事准备时，必须在前一阶段同时注入对应的感知信号。检测方法：在 aiPrompts.js 中搜索"须在…阶段…铺垫"等前提条件描述，验证这些前提的满足机制是否存在于对应的前置阶段提示词中。
- **测试**：806/806 通过（+15 new），build ✅，check-build ✅。

---

### [2026-06-26 Round 65] DAY_VOTE 本轮发言票型感知 + 狼人防守局面激活信号

- **问题**：DAY_VOTE 不使用 `getBaseContext(ctx)`，因此 `todaySpeeches` **完全不在** DAY_VOTE 上下文中。`speechHistory.voteIntention` 是 DAY_SPEECH 每个玩家必须输出的结构化字段，但从未被汇总注入投票阶段。狼人的"防守局面（队友被多数追杀）"执行路径存在，但 AI 无法从 DAY_VOTE 上下文感知是否满足触发条件——经典**感知-执行分裂**。
- **修复一（所有角色）**：`thisRoundVoteHint` — 从 `speechHistory.voteIntention` 中提取当天（day=voteDay）非弃票的结构化意向，按票数降序汇总，注入到 DAY_VOTE prompt。格式：`【本轮发言票型】已有N人表达投票意向：X号(n票意向)、Y号(m票意向)`。帮助所有角色在投票时了解当前轮票型趋势。
- **修复二（狼人专属）**：`wolfDefenseTrigger` — 对狼人玩家预计算队友受票压情况：若 ≥ ceil(已表态数/2) 人指向同一队友，注入 `⚡【防守局面已触发】` 信号；有少量票压但未达多数则注入 `【局势预警】`。注入位置在 `a) 刀口对齐` 末尾，确保 wolf 读完刀口信息后立即看到防守激活信号，自然选择正确场景。
- **关键诊断工具**：`grep "getBaseContext" src/services/aiPrompts.js` → DAY_VOTE case 从不调用 `getBaseContext`。任何依赖 `todaySpeeches` 的感知需求，必须从 `gameState.speechHistory` 中单独提取结构化字段，不能假设上下文中有发言文本。
- **DAY_VOTE 上下文结构（已知清单）**：`authoritativeFacts`（存活/死亡/事件线/历史投票/声明）、`ragContext`（对抗分析/金查信息/矛盾检测）、`voteMomentumHint`（跨轮热力）、`thisRoundVoteHint`（本轮意向，R65新增）。**不包含**：today speeches 文本（需单独提取）。
- **阈值设计**：严格多数 ceil(N/2) 对应"票型领先=追杀成功"的临界点；N/3 以下轻量预警；两级梯度设计避免误触发。
- **KNIGHT_DUEL 执行链确认（R64 待确认事项）**：经 R65 详细审计，骑士决斗链 **完整**。DAY_SPEECH 中 `knightHistoryStep` 读取 identity_table "决斗候选" → AI 输出 `shouldDuel/duelTarget` → `useSpeechFlow.js:278` 直接消费 → `handleKnightDuel` 执行。函数不需要独立读取 identity_table，因 AI 已在 prompt 生成时完成读取。所有"终局高价值动作"（HUNTER_SHOOT/LAST_WORDS/SHERIFF_BADGE_PASS/KNIGHT_DUEL）确认全部完整 ✅。
- **测试**：787/787 通过（+21 new），build ✅，check-build ✅，干跑 8/8 通过（票意向计票边界条件全覆盖）。

---

### [2026-06-25 Round 64] SHERIFF_BADGE_PASS 读写闭环补完：终局高价值动作的 identity_table 读取

- **问题**：SHERIFF_BADGE_PASS 是每局最多触发一次的高价值不可逆决策，但好人警长通过 D1→D(n-1) 积累的 identity_table（confidence 分值 + reason 字段）在传徽时从未被读取。旧版 `bpHint` = "金水>真预言家>发言可信者" 是完全凭空判断，与 R38-R54 系列"写了但不读"的感知-执行分裂完全同构，但发生在触发频率极低（每局一次）、单次影响极大的场景。
- **修复**：新增 `bpIdentityStep`（好人警长专属）：Step0 读取 confidence ≥ 70 且非狼嫌疑候选 → Step1 传徽优先级（金水 > id_table ≥ 70 > 发言可信 > 撕毁）。与预言家金水（外部确定事实）形成互补：金水最高优先，id_table 作为金水的补充校验和无金水时的备选。
- **「终局高价值动作」读写闭环完成状态（R64 后）**：HUNTER_SHOOT ✅（R41）、LAST_WORDS ✅（R54）、SHERIFF_BADGE_PASS ✅（R64）。骑士决斗执行链 ⚠️（待下轮确认：`useSpeechFlow.js#handleKnightDuel` 是否读取 identity_table 的"决斗候选"标注）。
- **守卫/女巫 DAY_VOTE 有意 fallback 确认**：T12/T13 测试验证——守卫的"守护优先级"是夜间计划（不影响白天投票），女巫的"毒药优先候选"是独立夜间决策（白天投票参考会暴露身份），两者走通用 fallback 是正确架构决定。DAY_VOTE 全量覆盖已完成（4 专属 + 5 有意 fallback）。
- **终局动作类别通用原则**：凡是「每局最多触发一次的不可逆高价值动作」（SHERIFF_BADGE_PASS/HUNTER_SHOOT/LAST_WORDS），都应有 identity_table 读取步骤——这类动作的单次决策影响远大于日常发言，更需要综合利用历史积累的信息。检查方法：枚举所有"一次性触发"动作，逐一确认 Step0 是否存在。
- **测试**：763/763 通过（+14 new），build ✅，check-build ✅，干跑 11/11 通过。

---

### [2026-06-25 Round 63] DAY_VOTE 读写闭环全量完成：4 角色专属框架 + 守卫/女巫有意 fallback

- **问题**：骑士 DAY_SPEECH（knight.js getKnightDaySpeechPrompt，R44 补全）写"决斗候选：[优先级A/B/C]"到 identity_table，但 DAY_VOTE 长期走通用分支——通用分支不读 identity_table，骑士多轮积累的决斗候选在投票阶段被完全忽略。与 R61/R62 狼人/猎人 DAY_VOTE 感知-执行分裂完全同构（第三个同构实例）。
- **修复**：新增 `knightVoteStrategy`（双状态框架）：①技能待用：读取 identity_table "决斗候选"存活目标 → 投票首选对齐决斗方向（能出局→全力推票节省决斗；不能→仍然投积累认知）②已使用决斗：作为公开领袖用 1.5 票权重带动票型。形成 knight.js DAY_SPEECH写→aiPrompts.js DAY_VOTE读 闭环。
- **DAY_VOTE 完成状态（R63 后，里程碑）**：狼人✅(R61)、预言家✅(pre-existing)、猎人✅(R62)、骑士✅(R63)。守卫/女巫/摄梦人/魔术师/村民走通用 fallback 是**有意设计**（守卫写"守护优先级"≠投票候选；女巫"毒药候选"是夜间独立决策）——DAY_VOTE 专属分支已**全量完成**，没有遗漏。
- **vote-duel 对齐原则（通用化）**：凡是角色有"一次性技能"（骑士决斗/猎人开枪），相关 DAY_SPEECH 积累的"技能候选"必须在 DAY_VOTE 中有对应读取框架——投票方向与技能行动方向对齐，使技能资源利用率最大化（能用投票出局就节省技能）。
- **工具互补性原则**：骑士决斗和投票是顺序互补工具——如果决斗候选可被群体投票出局，优先使用投票（节省一次性决斗）；无法翻转票型时再决斗。这是竞技狼人杀中"稀缺资源保留"的博弈论原则。
- **同构检测自动化**：下次修任何 DAY_VOTE 分支时，用 `grep -n "决斗候选\|开枪优先级：高\|高优先刀口\|毒药优先候选\|守护优先级：高" src/services/aiPrompts.js src/services/rolePrompts/*.js` 列出所有 identity_table 行动候选写入，对比 DAY_VOTE 中的专属分支，可快速验证无新缺口。
- **测试**：749/749 全量通过（10 new）；build ✅；check-build ✅；inline 6/6 通过。

---

### [2026-06-25 Round 62] 猎人 DAY_VOTE 读写闭环补完：刀票对齐框架

- **问题**：猎人 DAY_SPEECH（D2+）写"开枪优先级：高"到 identity_table，HUNTER_SHOOT 读取，但 DAY_VOTE 长期走通用分支——通用分支不读 identity_table，积累的开枪候选在投票阶段完全被忽略。与 R61 狼人 DAY_VOTE 感知-执行分裂完全同构（只是在好人阵营侧）。
- **修复**：新增 `hunterVoteStrategy`（3 点"刀票对齐"框架）：① 读取 identity_table "开枪优先级：高"存活目标作为投票首选 ② 场景评估（今天能出局→全力推票；不能→仍然投向同目标积累压力）③ 无高优先候选时回退到通用路径。形成 DAY_SPEECH写→DAY_VOTE读→HUNTER_SHOOT读 的完整三段闭环。
- **刀票对齐原则（通用化）**：凡是角色有"多轮积累的行动候选"写入 identity_table（如猎人的"开枪优先级：高"、狼人的"高优先刀口"），该角色的 DAY_VOTE 必须有对应读取框架，使投票方向与行动方向对齐。这是"读写闭环"在 DAY_VOTE 侧的专项检查清单。
- **DAY_VOTE 完成状态（R62 后）**：狼人✅(R61)、预言家✅(pre-existing)、猎人✅(R62)、骑士⚠️(待检查：有"决斗候选"积累)、其他角色通用fallback。
- **教训**：DAY_VOTE 的读写闭环检查不能只看"有无专属框架"，还要问"这个角色的 DAY_SPEECH 是否向 identity_table 写入了行动候选？如有，DAY_VOTE 必须读取"。检测方法：`grep -n "开枪优先级\|高优先刀口\|决斗候选\|守护候选" src/services/aiPrompts.js` 列出所有 identity_table 写入关键词，对比这些角色是否在 DAY_VOTE 有对应读取分支。
- **测试**：739/739 全量通过；build ✅；check-build ✅；inline 6/6 通过。

---

### [2026-06-25 Round 61] 干跑模拟完成：45 项核心机制测试全通过，并修复狼人 DAY_VOTE 感知-执行分裂

- **干跑模拟（第一次！）**：R61 编写了 `.tmp/dry-run-sim.mjs`，纯函数重现 `resolveNight` / `checkGameEnd` / 猎人连锁 / 投票计票逻辑，共 23 用例 45 断言，全部通过。验证了：基础狼刀、守卫救、女巫救、同守同救（双保死亡）、摄梦人入梦免疫（刀/毒均免疫）、连梦击杀（第2夜同目标死亡不可救）、摄梦人死亡触发同生共死、魔术师交换、猎人连锁开枪（最大深度3）、胜负判定（含屠边/屠城/通用规则）、投票计票（含警长1.5倍权重）、平票pk判断、女巫同晚救+毒（毒作废）、平安夜。
- **狼人 DAY_VOTE 感知-执行分裂修复**：`DAY_VOTE` case 中狼人投票策略仅 1 行（"考虑：投谁最大化狼队利益？"），而好人侧有 24 行含 Step A/B 热力图框架。这是 R26/R33/R37 "感知-执行分裂"反模式在投票阶段的重现——狼人的 identity_table 里有"高优先刀口"标注，但 DAY_VOTE 无任何框架指引如何使用它。**修复**：替换为 3 点框架：① 读取 identity_table "高优先刀口"存活目标 → 首选投票方向；② 3 种姿态选择（正常/防守/残局）；③ 掩护一致性（维持发言 voteIntention，改票须台词铺垫）。
- **读写闭环延伸**：DAY_VOTE 狼人现在读取 DAY_SPEECH 写入的"高优先刀口"标注，形成 DAY_SPEECH写→DAY_VOTE读 的新闭环（不增加新关键词，复用已有的"高优先刀口"）。
- **教训**：DAY_VOTE 是一个常被忽视的"读写闭环读取点"——角色在 DAY_SPEECH 中写入的 voteIntention 和 identity_table，应该在 DAY_VOTE 中通过明确框架被读取和执行，而不是让 AI 凭感觉投票。凡是有"前置发言写入 voteIntention"的角色，都应在 DAY_VOTE 中有对应读取框架。
- **测试**：739/739 全量通过（1 个预存在的 ws 依赖失败，与本次无关）；构建洁净；干跑模拟 45/45 通过。

---

### [2026-06-25 Round 60] 特殊角色在独立文件中实现，DAY Step 0 审计必须单独覆盖这些文件

- **问题**：R54-R58 为主路径 6 个角色（wolf/hunter/seer/witch/guard/villager）补全了 DAY_SPEECH Step 0，骑士在 R44 也已完成；但摄梦人（dreamweaver.js）和魔术师（magician.js）均缺少 DAY_SPEECH Step 0 长达 16 轮。摄梦人/魔术师的 NIGHT Step 0 是有的（aiPrompts.js 的 NIGHT_DREAMWEAVER / R43 的 magicianHistoryStep），但 DAY 侧完全缺失。
- **根因**：R58 声称"读写闭环 9 角色全部完成"时，只检查了 aiPrompts.js 中的 6 大主角色。特殊角色的 DAY_SPEECH 在独立文件（rolePrompts/*.js）中，对这些文件的审计被遗漏了 16 轮。
- **教训**：凡是进行"全角色 DAY Step 0 覆盖率"审计，必须同时检查 aiPrompts.js（主路径）和所有 rolePrompts/*.js 文件（特殊角色路径）。`grep -n "DayHistoryStep\|DayStep0\|dayHistoryStep" src/services/rolePrompts/*.js` 可列出已有 DAY Step 0 的特殊角色文件，与角色列表对比即可发现缺口。
- **检测方法**：`grep -rn "HistoryStep\|dayHistoryStep" src/services/rolePrompts/` 列出所有已有 Step 0 的特殊角色，对比骑士/摄梦人/魔术师应各有 DAY+NIGHT Step 0（骑士无夜间行动）。
- **修复**：R60 在 dreamweaver.js 添加 `dreamweaverDayHistoryStep`，在 magician.js 添加 `magicianDayHistoryStep`，均与各自的 NIGHT write guide 关键词（"连梦候选"/"换刀候选"）精确对齐；同时将三特殊角色文件的"不要覆盖历史"平文本统一升级为 `**追加不覆盖历史**` 粗体格式；25/25 测试通过；738/738 全量通过；构建洁净。
- **里程碑**：9/9 角色的 DAY_SPEECH Step 0 + 写指导"追加不覆盖历史"格式已全部完成（真正意义的全量完成）。
- **下轮建议**：60 轮累计 0 次实局 smoke test，所有提示词优化均未经真实对局验证。下轮最高优先级是用干跑模拟或触发一局测试观察摄梦人/魔术师的 D2 thought 字段是否引用历史候选。

---

### [2026-06-25 Round 59] 读写闭环修复必须同时检查写指导是否有"追加约束"——只有关键词对齐而无追加规则是半完成状态

- **问题**：R55 修复了狼人 DAY_SPEECH Step 0（读取侧），并检查了关键词四环对齐（DAY写→DAY读→NIGHT读→NIGHT写的"高优先刀口"对齐），但遗漏了检查"写指导是否有追加不覆盖历史规则"。结果：预言家/女巫/猎人/守卫/村民的写指导都有"**追加不覆盖历史**"+"【追加示例】"，只有狼人缺失。
- **根因**：读写闭环的"完成标准"只检查了"有读取步骤 + 有写指导 + 关键词一致"三项，未包含第四项"写指导有追加约束"。本质上是"完成标准"定义不完整——R18/R19 建立了追加约束规范，但未纳入后续每轮的"读写闭环完成验证清单"。
- **教训**：读写闭环的完整验证清单必须包含四项：① 写侧有关键词写指导 ② 读侧有 Step 0 读取 ③ 两侧关键词精确一致 ④ **写侧有"追加不覆盖历史"约束和"【追加示例】"**。缺少任一项均为半完成。每次验证某角色的读写闭环是否"完整"，必须用此四项清单逐一核对。
- **检测方法**：`grep -n "追加不覆盖\|追加示例\|追加本轮\|追加新" src/services/aiPrompts.js` 列出所有已有追加约束的角色，与读写闭环矩阵对比，发现未覆盖角色。
- **修复**：R59 在狼人 DAY_SPEECH 写指导和 NIGHT_WOLF 写指导中各添加"**追加不覆盖历史**"规则和"【追加示例】"（D2→D3 / N2→N3 分号拼接格式）；21/21 测试通过；713 全量通过；构建洁净。
- **下轮建议**：特殊角色（骑士/摄梦人/魔术师）在独立文件中实现，本轮审计未覆盖，下轮用同样的四项清单检查。

---

### [2026-06-24 Round 58] 同构修复要在发现时一并完成，不拖到下一轮

- **问题**：R57 建议"女巫 DAY_SPEECH Step 0 优先于守卫"，将两者分为两轮修复。但女巫和守卫的问题完全同构（都是函数体形式、都有夜间 Step 0、都有写指导关键词、都缺 DAY_SPEECH Step 0），同一轮修复两个只比修一个多花了 10 分钟，而拆成两轮则额外消耗一整轮循环资源。
- **根因**：评估时只看到"女巫优先级更高"就停止，没有问"守卫是否同构"——R21 和 R23 的教训重演（同构 bug 拖了 1-2 轮才批量修复）。
- **教训**：一旦识别到 Step 0 缺失的模式，立即扫描**所有其他角色的同构程度**（函数体形式？有夜间 Step 0？有写指导关键词？），把同一优先级的同构项全部纳入同一轮，不分批。判断标准：如果两个修复操作的代码结构 90% 相同，就合并到一轮。
- **下轮建议更新**：读写闭环 9 角色全部完成，下轮建议转向实局 smoke test 和横向一致性审计。

---

### [2026-06-24 Round 57] 内联 Step 0 vs 变量 Step 0：两种实现方式的测试定位策略不同

- **问题**：R55 的狼人 DAY_SPEECH Step 0 是**直接内联于模板字符串**（无独立变量名），R56/R57 的猎人/预言家 Step 0 是**预计算变量**（`hunterDayHistoryStep`/`seerDayHistoryStep`）。编写 R57 回归测试时，T23 错误地用 `wolfDayHistoryStep` 变量名搜索狼人 Step 0，而实际上狼人 Step 0 根本没有独立变量。
- **根因**：不同轮次的 Step 0 实现方式不一致——R55 内联实现（无法用变量名定位），R56/R57 预计算变量（可用变量名定位）。跨轮回归测试需要了解各角色 Step 0 的实现方式。
- **修复**：T23 改为搜索狼人 Step 0 的**关键内容词**（`高优先刀口`）而非变量名，因为关键内容词在内联和变量两种实现中都会出现（内联时在模板字符串里，变量时在变量声明里）。
- **通用规则**：编写"某角色 Step 0 存在"的回归测试时，优先搜索**关键词内容**（如 `高优先刀口`、`排队查验优先级`），而非实现细节（变量名），这样对内联和变量两种实现方式都适用。

---

### [2026-06-24 Round 56] 函数体内变量 vs 模板字符串插值：测试定位策略不同

- **问题**：将猎人 DAY_SPEECH 从箭头函数改为函数体（R3 教训），`Step0:` 文本在 `hunterDayHistoryStep` 变量声明中，不在 `return \`...\`` 模板字符串里。测试用 `thinkBlock`（从 `【思维链】` 定位的模板段落）查找 `Step0:` 时返回 -1，因为模板字符串中只有 `${hunterDayHistoryStep}` 插值占位符，Step0 文本要到运行时才展开。
- **根因**：测试读取的是**源文件字符串**，不是运行时求值结果。源文件中模板字符串里只有 `${变量名}`，变量的内容在声明区而非模板区。
- **修复**：将 Step0 内容断言改为搜索 `varDeclBlock`（函数体内 `return` 之前的变量声明区）；将插值顺序断言改为检查 `${hunterDayHistoryStep}` 占位符在模板中的位置，而非 `Step0:` 文字。
- **通用规则**：对函数体形式的提示词函数（R3 教训：需要前置变量时必须用函数体），测试时需要分两个区域定位：① `return \`` 之前的变量声明区（找 `Step0:` 文字、找条件判断）；② `return \`...\`` 之后的模板字符串（找 `${变量名}` 插值占位符、找各 Step 的顺序）。两个区域的检查目标不同，不能混用。

---

### [2026-06-23 Round 47] NIGHT_WOLF 的刀口执行结果核查需要显式上下文

- **问题**：NIGHT_WOLF 提示词通过 `wolfHistoryStep` 引导狼人读取上轮 identity_table 中的"高优先刀口"记录，但缺少一个关键推理步骤：刀口目标是否真的死了？若女巫救了刀口目标（平安夜），狼人无法在提示词中直接感知，只能通过复杂的间接推理（目标还活着+identity_table 有行刀标记）得出女巫使用了救药。
- **根因**：NIGHT_WOLF 的 user prompt 不包含 `getBaseContext(ctx)` 也不包含 `ctx.lastNightInfo`；死亡信息只在 system prompt 的游戏时间线中体现，属于"感知-执行分裂"——AI 在技术上能访问到信息，但没有结构化的推理框架将其映射到具体的策略行动（女巫资源判断）。
- **修复**：R47 在 NIGHT_WOLF 的 `wolfHistoryStep`（N2+分支）中添加了三分支核查逻辑：① 刀口目标死亡→成功 ② 刀口目标存活→女巫救了（更新女巫优先级）③ 平安夜→重新评估。同时在 prompt 顶部注入 `wolfLastNightBlock`（`ctx.lastNightInfo`）作为显式上下文参照。
- **通用规则**：凡是需要 AI 在夜间动作中进行跨轮结果验证的推理步骤（"上轮 X 发生了吗？"），必须在 user prompt 中提供对应的显式上下文 block，不能仅依赖 system prompt 中的隐式时间线信息。

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
79. ~~**DAY_VOTE 热力盲从——执行框架补强**~~ ✅ Round 37 已完成（Step A 三维打分框架：逻辑自洽/信息价值/行为连贯 + Step B 四条热力校正规则；旧版"决策原则：先独立评估"升级为结构化两步执行流程；30/30 测试通过）
80. **女巫/猎人 PK 效果回验**（新增）：用户本地验证女巫 4 种药量状态各自发言效果 + 猎人路线选择行为
81. **DAY_VOTE 热力 Step A/B 效果回验**（新增）：用户本地验证 thought 字段是否出现三维评分语言（逻辑自洽/信息价值/行为连贯）；是否有盲跟热力但发言清晰的案例（期望不出现）
82. **NIGHT_WOLF 刀口连续性效果回验**（新增，Round 38 改动）：用户本地验证 N2+ 夜 thought 是否引用历史"高优先刀口"标记（Step 0 框架语言）；刀口是否有跨夜连续性；切换目标时是否有切换原因说明
83. ~~**NIGHT_WITCH 毒药候选读写闭环**~~ ✅ Round 39 已完成（witchHistoryStep：首夜=无历史；N2+夜=读取 identity_table 中"毒药优先候选"标记；case 花括号 R11；witchNightLabel R18；23/23 测试通过）
84. **NIGHT_WITCH 毒药候选连续性效果回验**（新增，Round 39 改动）：用户本地验证 N2+ 夜 thought 是否引用历史"毒药优先候选"标记（Step 0 框架语言）；连续嫌疑场景是否延续 N1 候选目标
85. ~~**NIGHT_GUARD 同构评估**~~ ✅ Round 40 已完成（guardHistoryStep：首夜=无历史；N2+夜=读取 identity_table 中"守护优先级：高/中"标记；case 花括号 R11；guardNightLabel R18；Step 2 处理连守禁令顺延；24/24 测试通过）
86. **NIGHT_GUARD 守护候选连续性效果回验**（新增，Round 40 改动）：用户本地验证 N2+ 夜 thought 是否引用"守护优先级"历史标记（Step 0 框架语言）；连守禁令冲突时是否有切换原因说明
87. ~~**NIGHT_SEER + HUNTER_SHOOT 读写闭环**~~ ✅ Round 41 已完成（seerHistoryStep + hunterHistoryStep；seerNightLabel R18；26/26 测试通过）
88. **NIGHT_SEER 查验候选连续性效果回验**（新增，Round 41 改动）：用户本地验证 N2+ 夜 thought 是否引用"排队查验优先级"历史标记（Step 0 框架语言）；连续嫌疑场景是否延续 N1 候选目标
89. **HUNTER_SHOOT 历史候选效果回验**（新增，Round 41 改动）：多轮后死亡的猎人 thought 是否出现"开枪优先级：高""历史推理表"等语言；是否正确区分"查杀优先"vs"历史候选"
90. ~~**DAY→NIGHT identity_table 关键词全量对齐**~~ ✅ Round 42 已完成（狼人"刀口候选"→"高优先刀口"；预言家"下次查验候选"→"排队查验优先级：①②③④⑤"；女巫"毒药备选"→"毒药优先候选"；守卫"守护优先级高"→"守护优先级：高"（补冒号）；25/25 测试通过）
91. **DAY→NIGHT 白天→夜间连续性回验**（新增，Round 42 修复后续）：白天标注的"高优先刀口/毒药优先候选/守护优先级：高/排队查验优先级"是否能被次夜 Step 0 正确召回，用户本地验证
92. ~~**identity_table 委托模块 DAY→NIGHT 审计**~~ ✅ Round 43 已完成（摄梦人/魔术师 DAY_SPEECH 写指导 + NIGHT_* Step 0 全部补全，全 6 角色读写闭环首次完整覆盖）
93. ~~**骑士 identity_table DAY→DAY 闭环**~~ ✅ Round 44 已完成（knightHistoryStep + "决斗候选"写指导 + 追加示例 + 追加不覆盖历史；34/34 测试通过）
94. **三类闭环全景回验**（新增，R44 后续）：用户本地验证三类闭环效果：① DAY→DAY：骑士 D2+ 的 thought 是否引用"决斗候选"历史标记；② DAY→NIGHT：白天"高优先刀口/毒药优先候选/守护优先级：高/排队查验优先级"能否被次夜 Step 0 正确召回；③ NIGHT→NIGHT：跨夜连续目标是否有连贯性
95. **常驻诊断命令局限性提醒**（R44 新教训）：`grep "供下轮\|下轮参考"` 只能检测明确标注的缺口；对于"根本没有写指导"的角色（如骑士 R44 前），需要每轮人工评估所有有白天特殊技能的角色是否需要 DAY→DAY 闭环
96. ~~**骑士/摄梦人/魔术师 PK 专属框架**~~ ✅ Round 45 已完成（三角色 pkHint 专属分支：骑士决斗前后双框架/摄梦人同生共死连接/魔术师信息修正资产；R30 白熊效应扩展教训；33/33 测试通过）
97. **实局 smoke test**（45 轮未完成）：ECS 不在云端 allowlist；建议用户本地验证骑士/摄梦人/魔术师 PK thought 字段语言特征（骑士"尚未落地的确定性判断机会"/摄梦人"同时失去两张牌"/魔术师"信息修正资产"）
98. **SHERIFF_SPEECH + PK 联合覆盖检查**（新常驻）：每次新增角色时，同时检查 ssHint 链、SHERIFF_RUN if-else 链、pkHint if-else 链三处；可用 `grep -o "playerRole === '[^']*'" src/services/aiPrompts.js | sort -u` 快速列出已有分支
99. **数据流审计脚本**（R47 新建议，优先级 HIGH）：自动检查所有 `gameState.X` 访问点与 `useAI.js` / `WerewolfModule.jsx` 三层传递链一致性，防止 R46 类三层传递链静默断裂
100. ~~**委托模式参数合同静态检查**~~ ✅ Round 48 已完成（10 个静态分析测试：T1-T3 验证 NIGHT_MAGICIAN hasRevealed；T4-T7 骑士/摄梦人死解构清理；T8-T10 getDreamweaverNightPrompt 删除验证；495/495 测试通过；构建洁净）
101. **实局 smoke test**（持续未完成，48 轮无真实 LLM 验证）：ECS 不在云端 allowlist；建议用户本地验证近 48 轮提示词累积效果
102. ~~**witch.js 主路径 taboos 与 aiPrompts.js 降级路径对齐**~~ ✅ Round 50 已完成（`'首夜不救人'`→`'同一晚又救又毒'`，`'盲毒好人'`→`'盲毒（逻辑不充分时用毒）'`；主路径与降级路径首次完全对齐）
103. ~~**NIGHT_WITCH firstNight hint 守卫感知**~~ ✅ Round 50 已完成（有守卫→同守同救警告+自救例外；无守卫→鼓励正常救人；17/17 测试通过）
104. **路径分叉常驻检查**（R50 新教训）：每次修改 rolePrompts/*.js 的 taboos/archetype/coreGoal 时，必须用 `grep -n "taboos:" src/services/rolePrompts/<role>.js src/services/aiPrompts.js` 核查两条路径是否对齐
105. **dead function → live path 迁移检查**（R50 新教训）：扫描 rolePrompts/*.js 的 dead functions 时，顺便问"live path 是否实现了同等逻辑？"——dead function 里正确的实现不等于 live path 里正确的实现
106. **实局 smoke test**（50 轮未完成）：ECS 不在云端 allowlist；建议用户本地验证 R50 修复后女巫首夜决策是否更合理（有守卫时不救/无守卫时救）
107. ~~**batch dead 函数清理（seer/werewolf/hunter/guard/villager）**~~ ✅ Round 52 已完成（437行 / 14个死函数删除 + import 清理；28/28 测试通过；557/557 测试通过；构建洁净）
108. ~~**promptFactory.js 整体删除**~~ ✅ Round 53 已完成（282行死代码，R2 起最长悬案，彻底封闭死代码入口；16/16 测试通过；557/557 测试通过；构建洁净）
109. ~~**预言家对跳三步法 few-shot 示例**~~ ✅ Round 53 已完成（before→after 对比框架 + Step A→B→C 示例；seer.js + ROLE_PERSONAS 降级路径三处同步；16/16 测试通过；构建洁净）
110. **实局 smoke test**（53 轮未完成）：ECS 不在云端 allowlist；建议用户本地验证对跳局面预言家发言是否出现三步法框架语言（"N[X]夜查/直接矛盾/为什么验这个人"），且不再出现纯声明式"我是真预言家"。
111. **ROLE_PERSONAS vs rolePrompts 分叉治理**（长期）：当前三处路径（主路径/降级/seer.js）需手动同步。若差异持续扩大，可考虑将 ROLE_PERSONAS 改为动态从 rolePrompts 模块读取（需 9 角色回归测试）。
112. ~~**村民 DAY_SPEECH Step 0 读写闭环 + LAST_WORDS identity_table 读取**~~ ✅ Round 54 已完成（村民思维链 Step0 + LAST_WORDS 好人/狼人分支先读 identity_table；24/24 测试通过；597/597 测试通过；构建洁净）
113. **实局 smoke test**（54 轮未完成）：ECS 不在云端 allowlist；建议用户本地验证 D2+ 村民 thought 字段是否出现"历史推理积累"相关框架语言（引用上轮 confidence 最高的嫌疑人），以及死亡村民/狼人遗言是否出现读取 identity_table 后的历史判断而非纯临场分析。
114. **读写闭环全量审计**（新常驻）：执行 `grep -n "Step0" src/services/aiPrompts.js` 列出所有已有 Step 0 的段落，与所有有 `identity_table 填写指导` 的段落对比，确认无新增缺口。对象：所有 NIGHT_* case、DAY_SPEECH（村民/狼人/预言家等）、LAST_WORDS、DAY_VOTE（是否需要）。

---

### [2026-06-22 Round 42] DAY→NIGHT 是独立于 NIGHT→NIGHT 的关键词流，必须分别检查

- **发现方式**：R41 建议项 4（identity_table 全量人工审计）——逐一比对所有角色 DAY_SPEECH identity_table 写指导与对应 NIGHT_* Step 0 读取关键词。
- **根本原因**：R38-R41 修复的是 NIGHT→NIGHT 闭环（夜间写→次夜读），但从未检查 DAY→NIGHT 流（白天写→当夜读）。两者使用同一个 `identity_table`，但关键词完全不同。4 个角色（狼人/预言家/女巫/守卫）的白天写入关键词与夜间 Step 0 读取关键词长期不匹配，41 轮白天积累的信息从未流入夜间决策。
- **4 处修复**：
  - 狼人 DAY_SPEECH: `"刀口候选：..."` → `"高优先刀口：..."` （对齐 NIGHT_WOLF Step 0）
  - 预言家 DAY_SPEECH: `"下次查验候选"` → `"排队查验优先级：①②③④⑤之一"` （对齐 NIGHT_SEER Step 0）
  - 女巫 DAY_SPEECH: `"毒药备选，威胁等级：..."` → `"毒药优先候选：..."` （对齐 NIGHT_WITCH Step 0）
  - 守卫 DAY_SPEECH: `"守护优先级高"` → `"守护优先级：高"` （补冒号，对齐 NIGHT_GUARD Step 0）
- **通用规则**：每次修改或新增 NIGHT_* Step 0 的读取关键词时，必须同时检查对应角色的 **所有** identity_table 写指导（包括 DAY_SPEECH 和 NIGHT_* 写指导），确保关键词精确匹配。DAY→NIGHT 和 NIGHT→NIGHT 是两条独立流，缺一检查就会形成静默断裂。
- **检查清单**：每次 Step 0 关键词变化后，运行 `grep -n "写.*高优先刀口\|写.*毒药优先候选\|写.*守护优先级：高\|写.*排队查验优先级\|写.*开枪优先级：高" src/services/aiPrompts.js` 列出所有写指导，确认与对应 Step 0 读取字符串精确匹配。

---

### [2026-06-22 Round 41] 读写闭环扩展：NIGHT_SEER + HUNTER_SHOOT 两处同构缺口

- **发现方式**：人工评估（同 R40 模式）——常驻诊断命令 `grep "供下轮|下轮复查"` 仍返回空（旧格式），但 NIGHT_SEER 的"排队查验优先级"标记和 HUNTER_SHOOT 中 DAY_SPEECH 的"开枪前回顾 identity_table"说明都是同类缺口，只是没有旧式关键词。
- **NIGHT_SEER 特殊性**：预言家的"排队查验优先级"记录的是**尚未验证的嫌疑候选**（不是执行历史）。Step 0 说明"结合新信息重新排序；已死亡目标跳过"——历史候选是起点，不是硬约束（不同于守卫的守护优先级约束）。
- **HUNTER_SHOOT 特殊性**：① 不是 NIGHT_* action，不需要 `hunterNightLabel`（R18 规范不适用）② 查杀信息优先于历史候选（hunterHistoryStep 明确澄清）③ 这是"读写闭环"模式扩展到 DAY action 的首例——说明该模式不限于夜间行动。
- **通用规则更新**：任何 action（不论 DAY_* 还是 NIGHT_*）的 identity_table 写指导，如果包含"积累候选供后续使用"的语义，必须有对应的显式读取 Step 0。检查方法：逐一审计所有角色的 identity_table 写指导，找"供X场景使用"或"前回顾"等语义。

---

### [2026-06-21 Round 40] 读写闭环三轮完成：WOLF/WITCH/GUARD 首次全部清零

- **完成标志**：本轮修复 NIGHT_GUARD 后，`grep "供下轮\|下轮用\|下轮参考\|下轮复查" aiPrompts.js` 首次返回空——三个主要夜间行动的 identity_table 读写闭环全部完成。
- **NIGHT_GUARD 特殊性**：守卫有"禁止连守"约束（`cannotGuard` 参数），历史优先候选可能恰好是禁守对象——Step 0 读取指令必须包含"若该目标在禁止连守限制内，改选次高优先候选"，Step 2 专门处理连守顺延逻辑。这是 WOLF/WITCH 没有的守卫专属约束。
- **发现方式**：R39 LEARNINGS item 85 人工预标注（NIGHT_GUARD 的写指导无"下轮复查"关键词，只有"守护优先级：高/中"，常驻诊断命令无法自动捕获）。说明常驻诊断命令有局限性——只能发现"下轮"关键词类缺口，不含该关键词的同类缺口需要人工评估。
- **通用规则**：R38/R39/R40 确立了夜间行动读写闭环的完整模式：① `const xNightLabel = N${ctx.dayCount}` (R18) ② `const xHistoryStep = dayCount > 1 ? '0. 读取历史...' : '0. 首夜无历史'` ③ return 模板中注入 `${xHistoryStep}` 作为 Step 0 ④ 写指导末尾追加"（下轮 Step 0 将直接从此读取）" ⑤ case 花括号 (R11)。每个夜间行动的私有跨轮标记都应套用此模式。

---

### [2026-06-21 Round 39] 读写闭环规则的扩展应用：grep "下轮复查" 是常驻诊断命令

- **问题**：NIGHT_WITCH identity_table 写指导（R6 加入）中"毒药优先候选：...；下轮复查"是愿景陈述而非可执行指令——NIGHT_WITCH 思维链从未有 Step 0 读取该记录，与 R38 NIGHT_WOLF 的同类缺口完全对称。
- **发现方式**：R38 LEARNINGS 规定的常驻诊断命令 `grep "供下轮\|下轮用\|下轮参考\|下轮复查" aiPrompts.js` 准确定位了该缺口，验证了该命令的有效性。
- **修复**：添加 `witchHistoryStep` 变量（首夜/N2+两分支），作为【用药策略（思维链）】Step 0 注入；Step 2 明确说"结合上方历史候选（Step 0）"；identity_table 写指导从"下轮复查"改为"（下轮 Step 0 将直接从此读取）"。
- **通用规则升级**：`grep "供下轮\|下轮用\|下轮参考\|下轮复查" aiPrompts.js` 必须是每轮开始时的常驻检查——结果为空才代表所有 identity_table 读写闭环均已完成；否则每个匹配项都是潜在缺口，需要逐一确认对应 action 的思维链是否有显式读取步骤。
- **剩余候选**：NIGHT_GUARD 的"守护优先级：高/中"标记未被同类诊断命令捕获（无"下轮"关键词），需要人工评估是否同构。

---

### [2026-06-21 Round 38] identity_table 的写指导和读指导必须形成显式闭环

- **问题**：NIGHT_WOLF 的 identity_table 指导（R16 加入）说 reason 写"高优先刀口：..."是"供下轮夜间决策时优先锁定"——但下轮的 NIGHT_WOLF 思维链从未说"检查高优先刀口"，AI 每晚从头评估所有目标，等于建立了一个永远不会被查阅的备忘录。系统提示（`buildPersonaHint`）已正常注入 `previousIdentityTable`，问题完全在用户提示端：思维链缺少读取步骤。
- **根因**：同 R26/R33/R37 的感知-执行分裂模式，但发生在夜间行动的跨轮记忆上：write 端指导（R16）写了目标，read 端执行框架（下轮 NIGHT_WOLF 用户提示思维链）从未建立。"供下轮...优先锁定"是愿景陈述，不是可执行指令。
- **修复**：在 NIGHT_WOLF 用户提示中添加 `wolfHistoryStep` 变量（首夜="无历史刀口记录直接推断"，N2+夜="读取系统提示中【你之前的身份推理表】：哪些 reason 含高优先刀口？作为刀口候选起点"），作为思维链 Step 0 注入；同时在 identity_table 写指导中添加前向引用"下轮 Step 0 将直接从此读取"和执行状态追踪"→已N[X]夜行刀"。
- **通用规则**：任何 identity_table 的"写"指导如果包含"供下轮...使用"的愿景，必须立即对应一个"读"指导（在该 action 的下一轮提示中显式引用）。否则形成单向写、永不读的空转记忆。检查方法：grep "供下轮\|下轮用\|下轮参考" aiPrompts.js，逐一确认是否有对应的读取步骤。

---

### [2026-06-21 Round 37] "先 A 再 B"决策原则必须同时给出 A 步骤的具体执行方法

- **问题**：`voteMomentumHint` 中 R24 写的"决策原则：先独立评估本轮发言质量，再参考热力"已有 13 轮（R24-R36），但"先独立评估本轮发言质量"只陈述了决策顺序（目标/感知），没有告诉 AI 什么叫"评估发言质量"（执行层）。等价于"你先评估一下，然后参考热力"——没有执行框架的"先评估"等于随机行为。
- **根因**：R26 教训（"参数注入解决感知，策略框架才解决执行"）和 R33 教训（感知-执行分裂）的自然延伸。"先 A 再 B"这类顺序性决策原则中，A 步骤如果没有具体方法，是死指令。
- **修复**：升级 voteMomentumHint 为两步结构——Step A（三维打分：逻辑自洽/信息价值/行为连贯，在 thought 中先完成）+ Step B（热力校正逻辑：四条规则，明确引用 Step A 的"独立评分低/高"作为校正条件）。
- **通用规则**：任何提示词中"先 A 再 B"的决策原则，都必须同时提供 A 的具体执行步骤，不能只陈述顺序。每次写"先 X 再 Y"类提示词时，立刻问"X 步骤有具体的执行方法吗？如果没有，添加一个结构化框架。"

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

---

### [2026-06-22 Round 43] 委托模块和内联 case 需要独立审计 identity_table 读写闭环

- **背景**：R38-R41 修复了 wolf/witch/guard/seer 四个角色（均以内联方式在 `aiPrompts.js` 实现 NIGHT_* case）的 identity_table 读写闭环。但摄梦人和魔术师的夜间行动采用了混合模式：NIGHT_DREAMWEAVER 内联在 `aiPrompts.js`，NIGHT_MAGICIAN 委托给 `magician.js` 的 `getMagicianNightActionPrompt`。这两种模式都没有被 R38-R41 的系统性检查覆盖到。
- **教训**：对内联 case 的批量审计（"所有 NIGHT_* case 是否有 Step 0"）不能自动覆盖委托函数——委托函数在独立文件的独立函数体中，需要单独打开该文件验证。审计时必须区分两类 NIGHT_* 实现，逐一检查。
- **覆盖矩阵**：每次完成某批 identity_table 闭环后，维护一个 "角色 × 实现方式（内联/委托）× 检查状态" 的矩阵，确认所有行都已检查，而不仅仅检查了某种实现方式。
- **修复范围**：dreamweaver.js `getDreamweaverDaySpeechPrompt` 写指导 + aiPrompts.js NIGHT_DREAMWEAVER Step 0 + 写指导；magician.js `getMagicianNightActionPrompt` Step 0 + 写指导 + `getMagicianDaySpeechPrompt` 写指导。全部 6 个有夜间行动角色读写闭环首次完全覆盖。

---

### [2026-06-22 Round 43] 测试窗口大小必须基于实际变量声明位置

- **问题**：测试脚本使用 `magicianSrc.slice(magNightReturnIdx - 1500, magNightReturnIdx + 100)` 搜索 `magicianHistoryStep` 变量，但该变量在函数顶部声明，距 `return` 语句约 2500 chars。固定 1500 的窗口导致 T21-T24 全部 FAIL。
- **根因**：函数体长度因实现复杂度而差异显著。`getMagicianNightActionPrompt` 包含复杂的 Phase/Mode 判断 + 策略 hint 构建，函数体较长。简单角色（如 seer）可能只有 500 chars，复杂角色（如 magician）可能超过 3000 chars。
- **修复**：将窗口扩大到 3500：`magicianSrc.slice(Math.max(0, magNightReturnIdx - 3500), ...)` 后全部通过。
- **通用规则**：在测试脚本中搜索函数顶部的变量声明时，不要使用固定小窗口。正确做法：先手动检查函数体实际长度（`getMagicianNightActionPrompt` 函数从 `export function` 到 `return` 的距离），再据此设定窗口大小并加 20% 余量。或者在 `test()` 时直接搜索全文（`magicianSrc.includes(...)`），避免窗口问题。

---

### [2026-06-22 Round 44] identity_table 读写闭环存在三类，常驻诊断命令只能检测其中一类

- **背景**：R38-R43 建立了 NIGHT→NIGHT（跨夜读写）和 DAY→NIGHT（白天写→当夜读）两类闭环。R44 发现骑士的"决斗候选"积累需要第三类——DAY→DAY（跨白天读写）。
- **骑士的特殊性**：骑士是游戏中唯一没有夜间行动但有白天技能的角色。其决斗候选置信度需要跨天积累（D1+D2+D3 叠加），而不是每天从头分析。错误决斗的代价极高（误伤好人 = 当天白天损失两张牌），因此历史候选积累对风险控制至关重要。
- **常驻诊断命令的局限性**：`grep "供下轮\|下轮用\|下轮参考\|下轮复查"` 只能检测"明确标注了下轮使用"的愿景陈述类缺口；对于本来就没有写任何"下轮..."语言的缺口（如骑士的 identity_table 根本没有写指导），常驻诊断命令无法捕获。因此，每次新增/修改角色时，仍需人工评估"该角色的决策是否受跨轮历史信息影响"。
- **三类闭环检查清单**：
  - NIGHT→NIGHT：所有有夜间行动的角色，思维链是否有 Step 0 读取历史标记？
  - DAY→NIGHT：所有有夜间行动+白天发言的角色，DAY_SPEECH 写指导的关键词与 NIGHT_* Step 0 读关键词是否精确匹配？
  - DAY→DAY：所有有白天技能的角色（目前只有骑士），白天发言写指导的关键词与次天 Step 0 读关键词是否匹配？
- **修复**：R44 为骑士补全：`knightHistoryStep`（ctx.dayCount > 1 分支）+ identity_table 写指导（"决斗候选：[优先级A/B/C]"关键词）+ 追加示例 + 追加不覆盖历史指令；34/34 测试通过。

---

### [2026-06-22 Round 45] 白熊效应扩展：技能状态描述本身也会激活技能词汇

- **问题**：骑士 PK 专属框架的未揭示身份分支初版写 `- 决斗未使用，隐性威慑：...`——这是对技能状态的描述，意图是告知 AI "尚未决斗，请用隐性威慑"。T7 测试（`!elseBlock.includes('决斗')`）立即检测到"决斗"出现在 else 分支中并报 FAIL。
- **根因**：R30 白熊效应不仅适用于"禁止词列表"（"绝不能说X"），也适用于**技能状态描述**：写"决斗未使用"时，"决斗"这个词已经出现在提示词中，LLM 对该词的激活权重会升高，即使语义是"未使用"。换句话说，描述一个技能的"缺席状态"时，若使用了技能名称，等于把技能词汇带入了 LLM 的激活上下文。
- **修复**：将 `决斗未使用，隐性威慑` 改为 `隐性威慑（技能尚未使用）`——用抽象描述"技能"替代具体技能名称"决斗"，前者只激活"技能/尚未"类别概念，后者激活的是"决斗"这个具体词汇。
- **通用规则**：在提示词中描述"某技能尚未使用"的状态时，**不论是正向还是状态描述**，都必须使用抽象类别词（"技能"/"能力"/"此项能力"）而非具体技能词汇。只有在"技能已使用"（已公开，可以直接引用技能效果和结论）的分支中，才能使用具体技能名称。
- **测试防护**：每个角色的未揭示/未使用分支中，应加入负向断言检查不含对应技能词汇（T7 示范）。

### [2026-06-22 Round 46] 特殊角色历史必须经过三层传递链：WerewolfModule → useAI → gameState → prompt

- **问题**：`dreamweaverHistory`（摄梦人换梦记录）和 `magicianHistory`（魔术师换位记录）在 `aiPrompts.js` 的 `DAY_SPEECH` 和 `LAST_WORDS` 分支中通过 `gameState?.dreamweaverHistory` / `gameState?.magicianHistory` 访问，但 `useAI.js` 的参数列表没有这两个参数，`gameState` 对象中也未包含它们，导致所有访问永远得到 `undefined`。
- **根因**：三层传递链中任一层缺失，都会让数据静默消失：① `WerewolfModule.jsx` 向 `useAI()` 传参 → ② `useAI.js` 函数签名接收并放入 `gameState` → ③ `aiPrompts.js` 用 `gameState.X` 读取。只有 ③ 写了读取代码，但 ① 和 ② 均未实现传递，因此永远返回 `undefined`。
- **检测方法**：每次新增一个 `gameState.X` 访问点，立即 grep `useAI.js` 确认参数列表和 gameState 对象中均有 `X`；再 grep `WerewolfModule.jsx` 确认 `useAI()` 调用中传了 `X`。
- **修复**：R46 在 `useAI.js` 参数列表、gameState 对象、`WerewolfModule.jsx` 调用端三处同步添加 `dreamweaverHistory` 和 `magicianHistory`。

### [2026-06-22 Round 46] 委托函数接收到参数但不解构 = 特性静默失效

- **问题**：`aiPrompts.js` 的 `NIGHT_MAGICIAN` case 向 `getMagicianNightActionPrompt(params)` 传递了 `hasRevealed: currentPlayer?.hasRevealed`，但 `magician.js` 的 `getMagicianNightActionPrompt` 解构列表中没有 `hasRevealed`，导致"身份已公开时自保跃升最高优先"的功能虽然在调用端配置了，但在执行端从未生效。
- **教训**：委托模式（`case → moduleFunction(params)`）的参数传递是**无类型的键值对**，TypeScript 不检查，传了不用也不报错。每次在 `case` 中为委托函数新增参数时，必须立即打开目标模块文件确认解构列表已更新。
- **口诀**：传了就要用，用了就要传——两侧必须成对出现。

### [2026-06-22 Round 46] params 调用端不传 → prompt 端只读 undefined（应改为从 gameState 读）

- **问题**：`SHERIFF_BADGE_PASS` 在 prompt 端通过 `const { seerChecks: bpSeerChecks } = params` 期望调用端传入预言家查验结果，但 `useDayFlow.js` 的调用处 `await askAI(deadSheriff, PROMPT_ACTIONS.SHERIFF_BADGE_PASS, { validTargets: aliveTargets })` 从未传 `seerChecks`，导致金水/杀手提示永远为空字符串。
- **根因**：同类问题在 `SHERIFF_VOTE` 中已于 R12 修复（改用 `gameState.seerChecks`）。`SHERIFF_BADGE_PASS` 是当时遗漏的同构 case，两者都需要读 seerChecks，应使用同一访问模式。
- **教训**：`gameState` 在 `generateUserPrompt` 中始终可用，高频公共数据（`seerChecks`、`deathHistory`、`guardHistory`）直接从 `gameState` 读，不依赖调用端传参，可彻底规避"调用端遗漏"这类静默 bug。
- **R12 访问模式**（标准）：`const bpSeerChecks = gameState.seerChecks || [];`

### [2026-06-22 Round 45] PK 辩护框架覆盖检查应与 SHERIFF_SPEECH/SHERIFF_RUN 一同进行

- **背景**：R32 完成了 SHERIFF_SPEECH 和 SHERIFF_RUN 的全角色覆盖检查，建立了"每次新增角色必须检查两个 ssHint/if-else 链"的常驻义务。但骑士/摄梦人/魔术师在 PK pkHint 链中退化为通用 fallback（"通用辩护"），直到 R45 才补全，与 R35-R36 发现的缺口相隔 9 轮。
- **根因**：R32 记录的常驻检查义务只提及 SHERIFF_SPEECH + SHERIFF_RUN 两处，未将 pkHint 链纳入同一检查清单。三处 if-else 链（ssHint/SHERIFF_RUN/pkHint）本质上是同构的——都是"针对特殊神职的专属竞技框架 vs 通用 fallback"，应该在同一时机检查。
- **教训**：每次新增角色或修改某个角色的竞技框架时，必须同时检查三处 if-else 链：① SHERIFF_SPEECH 的 `ssHint` 链（竞选发言）② SHERIFF_RUN 的 if-else 链（竞选决策）③ `pkHint` 的 if-else 链（PK 辩护），确保新角色在三处都有专属分支，或有意选择 fallback。
- **检查命令**：`grep -o "playerRole === '[^']*'" src/services/aiPrompts.js | sort -u` 快速列出所有已有分支，对比游戏角色列表。
- **R45 状态**：R45 后，全部 7 个特殊神职（预言家/守卫/女巫/猎人/骑士/摄梦人/魔术师）均有 pkHint 专属框架；狼人/村民走通用 fallback（有意设计）。

---

### [2026-06-23 Round 48] 死函数比死变量更难发现：外观上"活着"的导出函数

- **问题**：`getDreamweaverNightPrompt`（~129 行）在 R14 报告中记录为"已删除"，实际函数体在 `dreamweaver.js` 中存在了 34 轮（R14→R48）。
- **为何难以发现**：函数通过 `DREAMWEAVER_PROMPTS.nightAction` 导出，看起来是活跃的 exports 成员。常见工具（linter、tree-shaking）在 ESM 中仅当整个导出对象未被任何模块 import 时才报告死代码。但 `DREAMWEAVER_PROMPTS` 本身是活跃导出，因此死函数字段被当作活代码处理。
- **定位方法**：追踪**消费端**而非生产端。关键问题是"有没有生产代码调用 `getRoleModule('摄梦人').nightAction()`？"——搜索 `nightAction` 在 `aiPrompts.js` 中的出现情况即可确认摄梦人路径是内联而非委托。
- **通用规则**：每次重构某个 case 从"委托模式"改为"内联模式"时，必须立即删除目标模块中的委托函数和 exports 字段，不能只删委托调用端。否则委托函数会以"exports 成员"外观存活，直到有人追踪消费端才能发现。
- **R48 修复**：删除 `getDreamweaverNightPrompt` 函数体 + `DREAMWEAVER_PROMPTS.nightAction`，并通过 T8/T9/T10 三个测试永久守门。

---

### [2026-06-23 Round 48] 静态分析测试是防范"传了但不解构"委托模式 bug 的最佳工具

- **问题**：R46 修复了 NIGHT_MAGICIAN 的 `hasRevealed` 未解构 bug，但同类 bug 可以在任何委托调用中悄然重现——委托函数的参数是无类型键值对，无运行时报错，特性静默失效。
- **Item 100 解法**：`delegateParams.test.js` 通过读取源文件文本、解析 object literal 和 destructure block，在 **CI 层面** 锁定调用端传参 ↔ 接收端解构的双向一致性。任何 case 未来新增参数而漏更新委托函数时，T1 类测试立即报红。
- **`extractDestructuredKeys` 的坑**：不能用简单正则 `/\{([^}]+)\}\s*=\s*params/` 匹配解构块，因为箭头函数 `(ctx, params) => {` 的函数体 `{` 会被优先匹配，导致提取的 key 列表包含整个函数头。正确做法是**锚点反向定位**：先找 `'} = params'`（终点），再 `lastIndexOf('const {')`（起点），两者之间的内容才是真正的解构列表。
- **死解构的危害等级**：死解构（destructured but never used）比未解构（passed but not destructured）更难察觉——后者特性失效，前者连特性失效都不提示，只是白白造成"可用字段"的错误心理预期。T4/T5/T6/T7 四个测试守护骑士和摄梦人的解构列表精确性。
- **R48 状态**：knight.js 清除死解构 `seerChecks/deathHistory/speechHistory`；dreamweaver.js 清除 `nightDeaths/seerChecks`；10/10 测试通过。

---

### [2026-06-23 Round 49] 死解构会让函数的"参数合同"产生误导——解构列表是判断函数消费字段的第一参照

- **问题**：`magician.js` 的两个函数（`getMagicianNightActionPrompt`、`getMagicianDaySpeechPrompt`）解构了 `seerChecks`（以及 `deathHistory`），但函数体中从未引用这些变量。R48 的 `delegateParams.test.js` 只检查"调用端传了什么 ↔ 接收端解构了什么"，并不检测解构了却从未使用的字段——死解构因此漏网。
- **发现方法**：手动搜索函数体（`seerChecks` 在 ~115 行 / ~90 行范围内无匹配），配合调用端分析（`seerChecks` 已被用来计算 `knownGods`/`suspectedWolves`，不需要再原样传入）。
- **修复规则**：清理死解构时，必须**同时检查调用端**——若调用端也在传该字段，需一并删除（否则 `delegateParams.test.js` T1 会因"传了但未解构"立即报红）。本轮正是因此追加了 `aiPrompts.js` NIGHT_MAGICIAN 的 `seerChecks` 传参删除。
- **Item 99 dataFlowChain 测试**：9 个测试守门 gameState 三层传递链（WerewolfModule.jsx → useAI.js → aiPrompts.js）完整性 + magician.js 死解构两处 + 所有特殊神职 SHERIFF/PK 联合覆盖。`extractGameStateKeys` 使用平衡括号配对（非正则）找对象体范围，避免嵌套结构干扰。
- **R49 状态**：magician.js 清除 3 处死解构；504/504 测试通过；构建洁净。

---

### [2026-06-23 Round 50] 降级路径 fix 不等于主路径 fix——两条路径必须同步维护

- **问题**：LEARNINGS R1（2026-06-15）修复了 `aiPrompts.js` 里 `ROLE_PERSONAS['女巫'].taboos` 中的 `'首夜不救人'`（降级路径），但 `witch.js` 的 `WITCH_PERSONA.taboos`（主路径，通过 `buildWitchPersonaPrompt` 传入系统提示）从未同步修复，`'首夜不救人'` 在主路径存活了 49 轮。
- **根因**：R1 的修复说明"将 `'首夜不救人'` 改为 `'同一晚又救又毒'`"，但执行者只改了 `aiPrompts.js`，没有打开 `witch.js` 同步。分叉路径（主路径 vs 降级路径）同步是持续义务，但没有测试守门。
- **影响**：系统提示（`buildWitchPersonaPrompt`）向女巫 AI 传达"首夜不救人是禁忌"（即"必须首夜救人"），但 NIGHT_WITCH 用户提示在有守卫时建议首夜不救，两者直接矛盾，49 轮内所有有守卫的局中女巫都收到了互相冲突的指令。
- **修复**：witch.js `WITCH_PERSONA.taboos`：`'首夜不救人'` → `'同一晚又救又毒'`，`'盲毒好人'` → `'盲毒（逻辑不充分时用毒）'`，与 aiPrompts.js 降级路径完全对齐。
- **教训**：每次修改任意一条路径（主路径 `rolePrompts/*.js` 或降级路径 `aiPrompts.js ROLE_PERSONAS`）的 `taboos`/`archetype`/`coreGoal`/`signalGameTips` 时，必须立即检查另一条路径是否需要同步。可用 `grep -n "taboos:" src/services/rolePrompts/witch.js src/services/aiPrompts.js` 快速对比。

### [2026-06-23 Round 50] NIGHT_WITCH firstNight hint 静态字符串未感知守卫存在 49 轮

- **问题**：aiPrompts.js NIGHT_WITCH case 的 `witchHint`（首夜提示）长期是静态字符串 `'【首夜策略】通常使用解药救人...'`，不区分"有守卫"和"无守卫"场景。而 `getWitchNightActionPrompt`（dead function）早在 R1 就实现了守卫感知——只是它从来没被调用过。
- **修复**：在 NIGHT_WITCH case 中调用 `detectExistingRoles(players)` 得到 `witchExistingRoles`，然后：
  - 有守卫：`'【首夜警告】守卫可能也守了被刀目标，同守同救会导致目标死亡！...例外：若被刀者是你自己，必须自救！'`
  - 无守卫：`'【首夜策略】没有守卫，无同守同救风险，可直接救关键目标...'`
- **教训**：dead function 里有正确的实现不等于 live path 里有正确的实现。当某个逻辑只在 dead function 里存在而 live path 里缺失时，问题不会在 runtime 报错——只有通过对比 dead vs live 实现才能发现。扫描 rolePrompts/*.js 里 dead 函数时，顺便问一句：live path 是否实现了同等逻辑？

---

### [2026-06-23 Round 51] "传了但不解构" 第三例——intent comment 不等于功能实现

- **问题**：`aiPrompts.js` 在构建骑士 `roleParams` 时传入了 `aliveCount: players.filter(p => p.isAlive).length`，且注释明确写道"骑士终局决斗阈值用"（line 1254）。但 `knight.js` 的 `getKnightDaySpeechPrompt` 只解构 `{ hasUsedDuel }` 而忽略 `aliveCount`，导致决斗阈值永远是硬编码 70%/60%，终局动态阈值从未生效。
- **根因**：LEARNINGS item 32 记录"Round 22 已完成终局阈值调整（aliveCount≤5 时 A=50%/B=40%）"，但 R27 的并发会话回滚（`git restore` 恢复旧版 aiPrompts.js）把 knight.js 一同回滚到了 R14 之前的版本，实际代码中从未有过动态阈值实现。"已完成"的 LEARNINGS 标注是对计划意图而非代码实现的标注。
- **修复**：knight.js `getKnightDaySpeechPrompt` 增加 `aliveCount: aliveNow = 8` 解构，计算 `isEndgame = aliveNow <= 5`，`thresholdA = isEndgame ? 50 : 70`，`thresholdB = isEndgame ? 40 : 60`，注入 `endgameNote`（残局时显示降阈说明），并将 prompt 内所有硬编码 70%/60% 替换为模板变量 `${thresholdA}%`/`${thresholdB}%`。
- **教训**：intent comment（"用于 X"）≠ 功能实现。当 LEARNINGS 标注某 item "已完成"时，需要去读对应代码文件验证——特别是经历过 R27 式大回滚的代码库。今后"完成"标注应附上"已验证行号：file:line"。
- **教训**：三例"传了但不解构"（R46 magician.hasRevealed, R49 magician.seerChecks, R51 knight.aliveCount）都无 runtime 报错，只有测试/代码审查才能发现。`delegateParams.test.js` 的"传入 key 集合 ⊆ 接收函数解构 key 集合"检查是标准守门方式。
- **R51 状态**：knight.js 动态阈值实装；8 个新测试通过（round51KnightEndgame.test.js）；529/529 测试通过（1 pre-existing ws 模块错误无关）；构建洁净。

---

### [2026-06-23 Round 52] 死代码清理时须同步清理不再使用的 import

- **问题**：seer/werewolf/hunter/guard/villager 的 nightAction/daySpeech/vote 函数删除后，对应的 `getBaseContext`、`isMiniGame` import 仍留在文件顶部。未使用的 import 不会触发运行时错误，但 Vite/Rollup 会在打包时尝试解析，可能意外引入不需要的依赖树。
- **根因**：删除死函数时只关注函数体，忘记检查 import 语句是否还有其他使用场景。
- **教训**：删除一组函数后，必须立即用 `grep -n "importedName" file.js` 检查每个被删除函数引用的外部 symbol 是否仍在文件剩余代码中出现。若未出现，立即从 import 语句中移除。
- **通用规则**：清理死代码 = 删函数体 + 检查并清理无用 import，二者是配对操作。
- **R52 状态**：437 行死代码（14个函数）清除，rolePrompts 5个主角色文件从840行减至403行；28个新测试通过；557/557 测试通过；构建洁净。



---

### [2026-06-24 Round 53] few-shot 示例中的动态插值：指导文本静态性规则的精确边界

- **背景**：R18 教训规定"在 NIGHT_* / DAY_SPEECH 模板字符串内写指导文本时，必须使用纯静态方括号占位符格式，不得使用 `${变量名}`"。本轮在对跳 few-shot 示例中使用了 `${ccIds}` 动态插值。
- **边界厘清**：R18 规则针对的是"显示给 AI 看的指导纯文字中误用了变量名插值"（导致 AI 收到被求值的动态字符串而非格式说明）。但 few-shot 示例本身需要引用具体玩家号码才有意义——用 `${ccIds}` 让示例中的玩家号码与当前局面一致，反而增强了示例的情境感。
- **精确规则**：区分两种类型的 `${}` 使用：① 在"[占位符]"格式说明区域（如"N[X]夜我查了[目标号]"）中使用已声明变量 → **违反 R18**；② 在 few-shot 示例中用有意义的命名动态变量（如 `ccIds`）填充情境 → **合法**，不是白熊效应触发点。白熊效应规则适用于"禁止词汇出现在禁止语境中"，不适用于"有意义的动态上下文注入"。
- **验证方式**：T14 测试已验证：示例行中除 `ccIds` 外无其他变量插值，且 `ccIds` 是合法动态变量。
- **通用规则更新**：改写 R18："指导文本的格式说明部分（如`reason 写"X; Y（格式）"`）不得用已声明变量名插值；few-shot 示例部分若需要情境化占位可以用有意义的命名动态变量。两者的区分标准是：是在解释格式还是在示范输出。"

---

### [2026-06-24 Round 54] 读写闭环扩展：DAY_SPEECH 村民 Step 0 + LAST_WORDS 身份推理表读取

- **问题**：R38-R44 系统修复了所有 NIGHT_* case 的读写闭环（每个角色的 Step 0 读取历史 identity_table 标注），但遗漏了两个日间对称点：① 村民 DAY_SPEECH 思维链无 Step 0（有写指导，无读取步骤）；② LAST_WORDS 的好人/村民 fallback 和狼人分支均未引导 AI 读取积累的 identity_table。
- **根因**：读写闭环的"写侧"（identity_table 填写指导）在 R18-R24 期间已全面补全，但"读侧"（Step 0 读取步骤）的覆盖止步于 NIGHT_* 阶段，未延伸到 DAY_SPEECH 和 LAST_WORDS。
- **修复**：
  1. 村民 DAY_SPEECH 思维链新增 Step 0：读取历史推理积累（confidence ≥ 60 → 高嫌疑起点，confidence ≤ 30 → 信任候选；首日无历史可跳过）
  2. LAST_WORDS 好人 fallback：先查身份推理表 → confidence 最高的玩家作为遗言核心
  3. LAST_WORDS 狼人分支：先查身份推理表 → confidence 最高（威胁最大）的好人作为遗言"怀疑"目标（维持整局逻辑一致性）；不点"高优先刀口"字面量（R30 白熊效应规则）
- **影响范围**：村民是最高频角色，DAY_SPEECH Step 0 影响每局 D2+ 的所有村民发言；LAST_WORDS 读取影响每局每个死亡角色的遗言质量。
- **教训**：读写闭环的修复义务不区分"夜间阶段"和"白天阶段"——只要有写指导（identity_table 填写）且有对应的读取时机（下一次该角色行动），就应该有显式的读取步骤（Step 0）。检查方法：`grep -n "Step0\|身份推理表" src/services/aiPrompts.js` 列出所有读取步骤，逐一确认所有有写指导的角色+阶段是否配套。

---

### [2026-06-24 Round 54] 测试窗口大小：LAST_WORDS else 分支在长 if-else 链末尾，需要 4500+ 字节

- **问题**：LAST_WORDS case 块的 else 分支（好人 fallback）位于 if-else-if 链末尾（9个 if-else-if 之后），距离 `case PROMPT_ACTIONS.LAST_WORDS: {` 约 3467 字符。使用 3000 字节窗口导致 T13/T14 两个测试误报 FAIL。
- **修复**：将 LAST_WORDS case 段的测试窗口从 3000 改为 4500（R24 教训：窗口 = 实际距离 × 130%）。
- **通用规则更新**：LAST_WORDS case 的测试窗口不应小于 5000。凡是扫描"长 if-else 链末尾分支"的测试，先用 node -e 命令确认 distance，再设窗口为 distance × 130%。

---

### [2026-06-24 Round 53] promptFactory.js 52 轮后删除：死代码入口完全封闭

- **里程碑**：`src/services/promptFactory.js`（282行）自 R2（2026-06-15）被发现从未被 import，历经 52 轮才在本轮完全删除。
- **根因回顾**：R14 删除了其调用的 6 个主角色的 nightAction/daySpeech 函数（~500行），R52 进一步清理了另外 5 个角色的 14 个函数（437行）。但 `promptFactory.js` 本身一直保留，因为每轮"本轮只做一件事"的原则，加之文件本身已无被调用的子函数，危害降为 0，被推迟了 52 轮。
- **教训**：死代码文件（无任何 import 引用者）应在首次确认后一轮内删除，而不是仅删除其被调用函数。死代码文件的存在会误导开发者（读到 `export const getProgressiveActionPrompt` 会以为这是活路径）；已删除被调用函数的死文件更危险——文件存在给人"路径存在"的错觉。
- **实操步骤**：确认死代码文件 = `grep -rn "import.*promptFactory\|require.*promptFactory" src/ --include="*.js" | grep -v "own-file"` 返回空，立即 `rm`。

---

### [2026-06-24 Round 55] 读写闭环的 DAY_SPEECH 侧：按优先级逐角色补全，不能批量跳过

- **背景**：R54 新增村民 DAY_SPEECH Step 0，R55 全量审计发现 5 个角色（狼人/预言家/女巫/猎人/守卫）均缺少 Step 0。
- **优先级排序**（从高到低）：① 狼人（identity_table 最复杂，战略私有注记，5步思维链）→ ② 猎人（write guide 里有"读取上轮"指令但错误地放在了写指导区末尾，而非思维链 Step 0）→ ③ 预言家（主要知识已通过 params 注入，边际价值较小）→ ④ 守卫/女巫（白天发言较简单，Step 0 边际价值最小）。
- **R55 完成**：狼人 DAY_SPEECH Step 0，关键词 "高优先刀口" 与 NIGHT_WOLF Step 0 对齐，保持"日间读取→夜间读取→日间写入→夜间写入"完整闭环。
- **教训**：读写闭环修复优先级与"角色的 identity_table 信息复杂度"直接相关——越复杂的角色（狼人 > 预言家 > 猎人 > 守卫 > 女巫），读写闭环缺失的成本越高，应优先修复。
- **教训**：write guide 区域（identity_table 填写指导）中出现的"读取"指令是错误位置——读取指令必须在思维链 Step 0 中，写指导区只能有"写"相关内容。发现"写指导区有读取指令"时立即提升为 Step 0。

---

---

## Round 67（2026-06-26）：村民 DAY_SPEECH 个性化分析视角注入

**问题**：8 种个性类型在系统提示词中有差异，但用户提示词的【分析框架】对所有村民完全相同，导致所有村民发言模式趋同，可观战性持续偏低（7.8/10）。

**修复**：`ROLE_DAY_SPEECH_PROMPTS['村民']` 改为函数体语法，根据 `params.personalityType` 动态生成 `personalityLens`（7 种有效分支 + 无类型 fallback=空），注入在【村民发言要求】之后、【分析框架】之前。`roleParams` 中新增 `personalityType: currentPlayer?.personality?.type || ''`。

**教训 R67-A：函数体语法改动必须同步更新所有依赖 `=> \`` 标记的测试文件**
- 将 `(ctx, params) => \`` 改为 `(ctx, params) => { ... return \`...\`; }` 后，所有用 `src.indexOf("'角色': (ctx, params) => \`")` 定位的测试文件全部返回 -1。
- 修复方法：改用 `"'角色': (ctx, params) => {"` 作为标记，并将切片窗口从 2500 扩大到 4000（函数体前置声明区 ~1800 chars）。
- 扩展 R56/R57 教训：函数体语法有两个区域（declaration block + template block），测试应分别定位，用 `villagerBlock.indexOf('return \`')` 分割。

**教训 R67-B：personalityLens 白熊效应检查为正向指令铁律**
- 所有 personalityLens 均以"XX驱动型：优先/重点/以..."开头，描述期望行为，不使用"不要""禁止"等负向词。
- logical 和 analytical 共用同一个数据驱动 lens（两者行为模式重叠，符合设计意图）。

**教训 R67-C：unrelated histories 场景下 git stash/rebase 必须谨慎**
- 若本地与远端无共同祖先（`git merge-base` 返回空），不要 `git pull --rebase`——直接 `git reset --hard origin/main` 然后重新应用变更是最安全的路径。
- auto-merge 可能丢失模板内容，每次合并后必须运行全套专项测试，不能只靠 build passed 判断。

**测试覆盖**：新增 `round67VillagerPersonalityLens.test.js` 24 个测试，全部通过。

---

---

## Round 68（2026-06-26）：神职角色（预言家/女巫）DAY_SPEECH 个性化发言风格注入

**问题**：R67 为村民引入 personalityLens，但预言家/女巫 DAY_SPEECH 仍趋同——8 种个性类型在系统提示词中有差异，但用户提示词的发言要点/策略对所有预言家、所有女巫完全相同，可观战性仍受限（7.9/10）。

**修复**：在 `'预言家': (ctx, params) => {}` 和 `'女巫': (ctx, params) => {}` 函数体内各新增 personalityLens 变量块（7 分支）：
- `seerPersonalityLens`：影响"如何呈现查验结论"（数据驱动/强攻/感染/质疑/谋划/严谨/稳健型），注入在 `${lastPointNumber}. 语气要坚定果断...` 之后、`【思维链】` 之前。
- `witchPersonalityLens`：影响"如何伪装平民并参与讨论"（分析/强势/共情/逆向/策略/保守/稳健型），注入在 `5. 配合预言家...` 之后、`【思维链】` 之前。

**教训 R68-A：为已有函数体新增大量预计算变量（~1500 chars）后，下游测试的切片窗口必须更新**
- `seerPersonalityLens` 变量块约 1500 chars，加入后 `round57SeerDaySpeechStep0.test.js` 的 4200-char 窗口不再覆盖 `【思维链】` 和 `identity_table 填写指导` 段落，导致 10 个测试失败（`thinkStart=-1`、`writeGuideStart=-1`，slice 返回空字符串）。
- 修复：窗口从 4200 扩至 6000（R24 铁律：窗口 = 实际距离 × 130%）。
- **通用规则**：每次在任意角色的 DAY_SPEECH 函数体增加大段内容（>500 chars）后，必须检查该角色的所有历史测试文件，更新 `src.slice(fnStart, fnStart + N)` 中的 N。

**教训 R68-B：神职 personalityLens 是"表达风格" lens，不是"决策" lens**
- 神职角色 lens 影响"如何框架和呈现"（叙事风格/修辞策略），不影响"做什么决策"（预言家报哪些查验、女巫用什么药）。
- 与村民的"分析视角" lens 不同——村民 lens 影响分析框架；神职 lens 影响表达方式。
- 白熊效应铁律同样适用：全正向指令（"XX型：优先/重点/以..."），无"不要""禁止"等负向词。

**测试覆盖**：新增 `round68DivineRolePersonalityLens.test.js` 26 个测试，全部通过；R57 回归修复（窗口扩展）25/25 通过；866/866 全量通过。

---

## 下轮建议

1. ~~**猎人 DAY_SPEECH Step 0**~~ ✅ Round 56 已完成
2. ~~**预言家 DAY_SPEECH Step 0**~~ ✅ Round 57 已完成
3. ~~**女巫 DAY_SPEECH Step 0**~~ ✅ Round 58 已完成
4. ~~**守卫 DAY_SPEECH Step 0**~~ ✅ Round 58 已完成
5. ~~**干跑模拟**~~ ✅ Round 61 已完成（45/45 断言通过）
6. ~~**DAY_VOTE 角色框架全量**~~ ✅ Round 61-63 已完成（狼/猎/骑全专属，守/女/摄/魔/村有意 fallback）
7. ~~**DAY_SPEECH 狼人防守预铺**~~ ✅ Round 66 已完成（wolfSpeechPressureHint + pressuredTeammate 参数链）
8. ~~**村民 DAY_SPEECH 个性化视角**~~ ✅ Round 67 已完成（personalityLens 7 分支 + roleParams.personalityType）
9. ~~**神职角色（预言家/女巫）DAY_SPEECH 个性化**~~ ✅ Round 68 已完成（seerPersonalityLens + witchPersonalityLens 各 7 分支）
10. ~~**摄梦人/魔术师 DAY_SPEECH 个性化**~~ ✅ Round 77 已完成（dwPersonalityLens + magPersonalityLens 各 7 分支 + speechLen 差异化）
11. **实局 smoke test**（持续优先级）：ECS 不在云端 allowlist；建议用户本地运行一局全 AI 观战，观察摄梦人/魔术师不同性格的发言密度和切入角度差异（8人局）。
12. **NIGHT_DREAMWEAVER / NIGHT_MAGICIAN 个性化**：为两个特殊角色的夜间选目标决策添加 nightPersonalityStyle（类比 R76 wolfNightStyle）。
13. **守卫/猎人 NIGHT 个性化**：nightGuardStyle / nightHunterStyle 完成 NIGHT 四连的剩余两角。
14. **NIGHT_DREAMWEAVER 迁移**（非紧急）：当前 NIGHT_DREAMWEAVER（~80行）内联在 aiPrompts.js；摄梦人日间已独立在 dreamweaver.js。迁移不改变行为，纯架构一致性收益。
15. **跨阶段感知-执行分裂系统审计**（R66 通用原则衍生）：搜索 aiPrompts.js 中所有"须在…阶段…铺垫/预铺"类语言，逐一确认对应的前置阶段是否有感知信号注入机制。

---

## Round 77 新增教训（2026-06-28）

**教训 R77-A：白熊效应测试必须是首批测试，否则负向词修复后才发现**
- 魔术师 cautious 分支初稿含 `绝不`（"除非逻辑完全崩盘否则绝不跳身份"），T27 白熊检测失败。
- 测试文件将白熊效应验证（T27）放在 7 个分支关键词测试之后，导致先写错了内容才被测试捕获。
- **建议**：白熊效应检测测试应排在所有分支内容验证之前，确保"内容存在"和"内容合规"同时通过。
- 修复：将 `绝不` 改为正向表述"把身份保留到逻辑真正崩盘的临界点，在此之前韬光养晦"。

**教训 R77-B：关键词匹配测试应使用最短区分性子串**
- T20 初稿测试 `cautious` 分支包含 `关键时刻`，但修复白熊违规后改为 `关键时机`，导致测试再次失败。
- 根本原因：测试和实现使用了不同的近义词，不应对语义等价的词汇做精确字符串匹配。
- 修复：断言改为 `toContain('关键时')`（公共前缀 3 字）——仍有区分性，不锁定具体措辞。
- **通用规则**：测试关键词时，优先选能区分有/无的最短公共子串，而非锁定完整词组。

**教训 R77-C：特殊角色 personalityLens 设计聚焦点与主角色不同**
- 主角色（村民/神职）lens 聚焦「分析视角/表达风格」；特殊角色 lens 聚焦「核心博弈决策的时机和方式」。
- 摄梦人 lens：聚焦「如何在身份未暴露时表达自己的立场」（因摄梦人每晚都在影响场上死讯但不会直说）。
- 魔术师 lens：聚焦「何时/如何决策揭示逻辑镜像身份」（魔术师的核心博弈就是跳vs不跳这一决策）。
- **通用规则**：设计 personalityLens 时，先明确"该角色的核心博弈问题是什么"，lens 就是「不同性格的人如何面对这个核心问题」。

---

## Round 107 新增教训（2026-07-03）

**教训 R107-A：摄梦人平安夜推断具有独特双来源视角，设计时不能套用单来源模板**
- 其他所有角色（预言家/守卫/女巫/村民等）的平安夜推断只需推断守卫守护目标（单来源）。
- 摄梦人的平安夜有两个独立来源：
  - **来源 A**：狼人攻击了摄梦人的入梦目标 → 被入梦免疫拦截（狼刀被梦境吸收）
  - **来源 B**：狼人攻击了其他目标 → 守卫/女巫保护生效（与摄梦人入梦选择无关）
- 两条路径的信息价值完全不同：来源 A 提供"入梦目标是狼刀首选"的强信号；来源 B 提供"守卫轮守位置"线索。
- **通用规则**：为具有独特能力机制的角色设计平安夜推断时，先列出"平安夜可能的所有来源"，再为每条来源设计独立推断分支。

**教训 R107-B：测试窗口（WINDOW）随代码增长需同步更新**
- round78 测试文件的 `getNightDreamweaverBlock()` 窗口为 7000 chars（R78 时 block 约 5412 chars）。
- R107 新增 2625 chars 后 block 达 8037 chars，超出 7000 窗口 → T11/T17/T18 三个测试因内容被截断而失败。
- 修复：窗口更新至 8500（block 8037 + 约 500 余量）。
- **通用规则**：每当为现有 case 新增大量内容时，必须同时检查该 case 对应的所有已有测试文件的窗口大小，避免静默截断。
- **检查命令**：`grep -n "WINDOW\|window\|slice(start" src/services/__tests__/round*.test.js | grep -i dreamweaver`

**教训 R107-C：Prepend Injection 第 22 次应用 — 三层嵌套结构已成熟模板**
- 截至 R107，Prepend Injection 模式已应用 22 次（R86 首次，R107 第 22 次）。
- 固定结构：`tripleHint → 注入到 consecutiveHint 开头 → 注入到 singleHint/peaceStep 开头 → 注入到 return 模板`。
- 下层变量赋值格式：`consecutiveHint = \`${tripleHint}⭕【两连...】\``（当 tripleHint 为空时前置空串，无副作用）。
- **注意**：此模式不需要 else 分支，空串前置是幂等操作。

**教训 R107-D：所有 NIGHT 角色平安夜推断覆盖率审计（R107 完成后）**
- ✅ NIGHT_SEER（预言家）：已有推断
- ✅ NIGHT_GUARD（守卫）：已有推断
- ✅ NIGHT_WITCH（女巫）：R106 完成
- ✅ NIGHT_DREAMWEAVER（摄梦人）：R107 完成（双来源）
- ❓ NIGHT_KNIGHT（骑士）：需检查是否存在此 case
- ❓ NIGHT_MAGICIAN（魔术师）：需检查是否存在此 case
- 下轮进入前先运行：`grep -n "case PROMPT_ACTIONS.NIGHT_" src/services/aiPrompts.js` 确认完整列表。

---

## Round 112 新增教训（2026-07-04）

**教训 R112-A：SHERIFF_SPEECH 女巫/守卫 4-path 分支完成后，所有 8 个特殊神职均有专属竞选框架**
- 预言家/狼人/猎人/摄梦人/魔术师/骑士在 SHERIFF_SPEECH 已有专属提示词。
- R112 补全：女巫（4路径药效矩阵 × 已跳/未跳 = witchSsHint）+ 守卫（hasRevealedIdentity = guardSsHint）。
- 村民走通用 fallback 是有意设计（无私有信息可复用）。

**教训 R112-B：SHERIFF_SPEECH 白熊效应（第 33 次验证）—— witchSsMedStatus 4路径推断全正向**
- 4路径均以"双药均在/解药在手/毒药在手/双药已用"开头，描述状态和价值，不含任何"自曝/禁止/绝不能/千万别"。
- 这是第 33 次应用正向描述铁律（R112）；白熊测试应排在分支内容验证之前（R77-A 铁律）。

**教训 R112-C：窗口大小铁律 — 函数体增长时必须同步更新测试窗口**
- R112 新增 ~2059 chars 到 SHERIFF_SPEECH block，历史测试若有窗口未更新会悄然截断。
- 每次向现有 case 新增超过 500 chars，必须用 `grep -n "WINDOW\|window\|slice(start" src/services/__tests__/round*.test.js | grep <caseName>` 检查所有历史测试窗口。

---

## Round 113 新增教训（2026-07-04）

**教训 R113-A：SHERIFF_BADGE_PASS 完成女巫/守卫专属框架（私有信息 > identity_table 优先级链）**
- 女巫：`witchHistory.savedIds` 过滤存活候选 = 银水存活好人（最高可信度传徽候选）。
- 守卫：`guardHistory` 频次分析 Top-2 = 守护最多次者（不可伪造的信任排序）。
- 两者的 `bpIdentityStep` 优先级链同步更新：⚡金水 > 💊/🛡️私有信息 > identity_table > 发言可信者 > 撕毁。

**教训 R113-B：回归测试应检查语义意图而非实现字面**
- R64 T7 测试字面检查 `playerRole !== '狼人'`，在 R113 将二元条件改为 4-path ternary（`=== '狼人' ? ''`）后失效。
- 修复：改为检查 `=== '狼人'` 存在 + `? ''`（空串赋值意图），而非原始字符串。
- **通用规则**：测试应锚定"哪些角色不应得到此信息"的语义结果（狼人得到空串），而非具体的条件写法；任何角色扩展不会再触发此类回归。

**教训 R113-C：BP_WINDOW 铁律 — 每次扩充 SHERIFF_BADGE_PASS block 都需更新测试窗口**
- R113 新增 ~1500 chars，导致 bpHint/return 模板超出原 3200-char 窗口范围。
- 修复：BP_WINDOW 从 3200 扩至 4500（block ~2700 + 约 1800 余量）。
- **测试写作铁律（R24 扩展）**：每次向现有 case 新增大量内容后，新测试文件的窗口应设为"预估 block 大小 × 130%"，历史测试文件中对应 case 的窗口也需同步检查更新。

---

## Round 114 新增教训（2026-07-04）

**教训 R114-A：SHERIFF_VOTE 三神职 5-path 完成（私有信息注入闭环）**
- 女巫：`witchHistory.savedIds` 过滤候选人集合 = 最高可信度投票锚点（同 R113 SHERIFF_BADGE_PASS 设计）。
- 守卫：`guardHistory` 频次分析 Top-2 = 不可伪造的候选人信任排序（同 R113 SHERIFF_BADGE_PASS 设计）。
- 猎人：枪+警徽连锁框架（正向价值描述，无暴露风险警告）= 独特战略视角。
- SHERIFF 三大 case（SPEECH/BADGE_PASS/VOTE）的女巫/守卫/猎人分支至此全部补齐。

**教训 R114-B：测试窗口必须在写测试前测量实际 block 大小**
- 初始窗口估算 3200 chars，实际 SHERIFF_VOTE block 为 4105 chars（新增 ~2600 chars 后），T20 因窗口截断失败。
- **铁律（强化）**：写新测试文件前，先用 `node -e "const src = require('fs').readFileSync('src/services/aiPrompts.js','utf8'); const s = src.indexOf('case PROMPT_ACTIONS.XXX:'); const e = src.indexOf('case PROMPT_ACTIONS.', s+10); console.log(e-s);"` 测量实际 block 大小，然后设窗口为 `block_size × 130%`，不要靠直觉估算。

**教训 R114-C：NIGHT_KNIGHT 和 NIGHT_MAGICIAN R107-D 遗留已完全关闭**
- 骑士（Knight）`nightAction: false`（见 roles.js），无需 NIGHT_KNIGHT case → ✅ 关闭。
- 魔术师 NIGHT_MAGICIAN 已在 R109 完成平安夜推断（lastNightInfo + fullGameTimeline）→ ✅ 关闭。
- R107-D 审计清单全部完成，无需再次检查。

---

## Round 115 新增教训（2026-07-04）

**教训 R115-A：摄梦人同生共死约束是 SHERIFF_VOTE 唯一需要排除特定候选人的约束**
- 所有其他角色的投票逻辑是"投谁更好"（正向选择），唯有摄梦人需要"排除谁"（负向约束）：入梦目标当选警长后死亡 → 摄梦人连带死亡 + 警徽 1.5 票权重双重损失。
- **设计模式**：svDWTargetIsCandidate 两路径 — 有连带风险展示风险警告，无风险展示"无直接连带风险"（全正向描述，符合白熊效应原则）。
- 白熊效应第 36 次验证：连带风险警告以"⚠️【连带风险】…你同时死亡，警徽…随之作废"的正向陈述事实方式呈现，无"千万别/绝对不要"等负向禁令。

**教训 R115-B：dreamweaverHistory 双路回退 — currentDreamTarget ?? lastDreamTarget**
- 摄梦人刚入梦（第一夜）可能只有 `lastDreamTarget` 无 `currentDreamTarget`；白天竞选时则 current 覆盖 last。
- **铁律**：读取摄梦人入梦状态时，始终 `currentDreamTarget ?? lastDreamTarget ?? null`，不要单独读 current。
- 同 R96 类型安全铁律：`svCandidateSet.has(Number(svDWCurrentTarget))` — Set 存储数字，游戏状态 id 可能是字符串，`Number()` 转换消除类型不匹配。

**教训 R115-C：SV_WINDOW 5400 对 R114 测试仍然足够（重新验证）**
- R115 新增 896 chars 后，R114 测试的 `svRoleHint` 锚点从 offset 3104 移至 3919，仍在 5400 chars 窗口内。
- R115 新测试文件设 SV_WINDOW = 6000（block 9004 × 67% ≈ 6000，保留 ~33% 余量用于后续追加）。
- **观察**：SHERIFF_VOTE block 已达 9004 chars，R116 摄梦人后续角色（骑士/魔术师）每个约 +600-900 chars，预计 block 不超过 11000 chars，R115 测试窗口 6000 仍满足。

**教训 R115-D：Monte Carlo 平衡仿真发现 3 狼配置严重偏强（平均 87%）**
- 简化策略模型（非 LLM）显示：8-9 人 2 狼局较平衡（60-65%），10 人 3 狼局严重失衡（84-90%）。
- 主因：① 狼人协调完美投票，好人有随机噪声；② 3 狼压力下守护/解药覆盖率不足。
- **决策**：平衡调整属大改（影响角色配置比例），本轮不实现，记入 `werewolf-decisions-pending.md` 长期跟踪。
- MC 仿真脚本：`.tmp/werewolf-balance-sim-r115.mjs`（600局/配置，无 LLM 依赖）。

---

## Round 116 新增教训（2026-07-04）

**教训 R116-A：向 SHERIFF_VOTE 新增角色分支后必须同步检查所有历史 getSvBlock() 测试文件的 SV_WINDOW**
- R116 新增骑士/魔术师分支（+2295 chars）后，svRoleHint 从块内偏移 ~5000 移到 6073。
- R114 (SV_WINDOW=5400) 和 R115 (SV_WINDOW=6000) 均截断了 svRoleHint 链，导致 T19/T20（R114）和 T12（R115）失败。
- **铁律（R107-B/R113-C 强化）**：每次向任何角色 case 新增超过 500 chars 后，必须运行：
  ```
  grep -n "SV_WINDOW\|BP_WINDOW\|getSvBlock\|getSs\|getBp" src/services/__tests__/round*.test.js | grep <caseName>
  ```
  并将所有对应测试文件的窗口更新到 `实际 block 大小（到下一个 case）× 130%`。
- 本次修复：R114/R115 的 SV_WINDOW 均从原值更新至 7500（block 7296 到 BADGE_PASS）。

**教训 R116-B：骑士的 SHERIFF_VOTE 核心博弈 — 决斗前/后框架截然不同**
- 未决斗时：骑士 + 警长是全游戏最强双牌（1.5 票 + 决斗威慑），应优先自投（若自身在候选名单）。
- 已决斗时：身份已公开，警长价值在延续领袖可信度，不再需要自投优先逻辑。
- **通用模式**：hasUsedDuel 是骑士在任何 SHERIFF_* case 的核心分支变量，两路径设计不可省略。

**教训 R116-C：魔术师的 SHERIFF_VOTE 核心博弈 — 身份暴露代价是唯一特殊变量**
- `hasRevealed=false`：当选警长 = 公开身份 = 狼人针对优先级上升，需要评估代价是否值得 1.5 票。
- `hasRevealed=true`：当选警长 = 零额外代价，纯收益，框架与其他角色相同（投金水/稳健者）。
- **注意**：`svMagAlreadySwapped`（交换容量）不需要影响投票决策（影响的是今晚的夜间行动，不是警长选举）——仅作候选人注释信息，不改变核心排序。

**教训 R116-D：R115 预测"SV_WINDOW 6000 仍满足"被证伪——预测性窗口估算不可靠**
- R115 LEARNINGS 最后一行预测："R116 摄梦人后续角色每个约 +600-900 chars，预计 block 不超过 11000 chars，R115 测试窗口 6000 仍满足"。
- 实际情况：block 仅增加 2295 chars（900×2.5），但 svRoleHint 从偏移 ~5000 移到 6073，超过了 6000 窗口。
- **教训**：不要在 LEARNINGS 中预测"下轮窗口仍然够用"——每轮开始时必须重新测量，不依赖上轮的预测。

---

## Round 117 新增教训（2026-07-04）

**教训 R117-A：SHERIFF 三大 case 骑士/魔术师分支全部闭环（6-path 完成）**
- R116 完成 SHERIFF_VOTE，R117 完成 SHERIFF_BADGE_PASS，SHERIFF_SPEECH 早已完成。
- 所有 8 个特殊神职（预言家/狼人/猎人/摄梦人/骑士/魔术师/女巫/守卫）在 SHERIFF_SPEECH/BADGE_PASS/VOTE 三 case 中均有专属分支或合理 fallback。
- **完成标志**：`bpIdentityStep` 和 `bpHint` 均为 6-path；BADGE_PASS 骑士/魔术师分支闭环。

**教训 R117-B：BP_WINDOW 铁律 — 每次向 SHERIFF_BADGE_PASS 新增超过 500 chars 需同步更新 R113 测试窗口**
- R117 新增 ~2386 chars 后 block 从 4003 → 6389 chars，超出 R113 的 4500-char BP_WINDOW。
- 失效症状：T10-T17（bpIdentityStep/bpHint/return 模板锚点）全部超出窗口范围而 FAIL。
- **铁律（R113-C 的 BADGE_PASS 专属强化）**：每次向 SHERIFF_BADGE_PASS case 新增超过 500 chars，必须运行 `grep -n "BP_WINDOW" src/services/__tests__/round*.test.js` 并将所有窗口更新到 `实际 block 大小 × 130%`。

**教训 R117-C：骑士 BADGE_PASS 未用能力路径不能出现"决斗"技能词汇（R45 铁律二次应用）**
- 骑士 BADGE_PASS 的"能力尚未使用"路径描述时，若写"决斗未使用"会激活"决斗"词汇（R45 白熊效应扩展）。
- 修复：以"能力尚未使用，将随你离场作废"替代，用抽象类别词"能力"而非具体技能名"决斗"。
- **通用模式**：描述骑士技能"未使用"状态时，始终用"能力"替代"决斗"作为词汇——R45 铁律的骑士 BADGE_PASS 专属应用案例。

**教训 R117-D：魔术师 BADGE_PASS 的核心私有信息是"交换知识作一手信息"而非"交换容量"**
- R116 SHERIFF_VOTE 中 `svMagAlreadySwapped`（交换容量）不影响投票决策，仅作注释。
- R117 SHERIFF_BADGE_PASS 中，已公开时关键是"交换知识（谁的真实身份是什么）"而非"还有多少次交换可用"。
- **通用规则**：魔术师在 SHERIFF_* 的核心决策轴：VOTE = 身份暴露代价；BADGE_PASS = 交换知识作信任依据；SPEECH = 信息修正权威。三者均从 `hasRevealed` 分叉，但二级变量不同，不能混用。
