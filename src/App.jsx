import React, { useState, useEffect } from 'react';
import { useWerewolfGame } from './useWerewolfGame';
import { Moon, Sun, Eye, Skull, Shield, Zap, MessageSquare, RefreshCw, XCircle, Crosshair, FlaskConical, Gavel, ScrollText, Brain, Send, User, ArrowUp, Info, Target, RotateCcw, AlertTriangle, Download } from 'lucide-react';
import { PlayerCardList } from './components/PlayerCardList';
import { GameLog } from './components/GameLog';
import { ActionPanel } from './components/ActionPanel';
import { SpeechPanel } from './components/SpeechPanel';
import { VotePanel } from './components/VotePanel';

/**
 * 游戏配置：8人标准局 (2狼, 2民, 1预, 1女, 1猎, 1守)
 */
const TOTAL_PLAYERS = 8;
// API configuration - Hardcoded as requested
const API_KEY = "ms-b341776e-11ee-40fc-9ab8-42154ff1b42d";
const API_URL = "https://api-inference.modelscope.cn/v1/chat/completions";

// 扩展的模型池，用于负载均衡 - 包含原有的DeepSeek/MiniMax和新增的Qwen3系列
const AI_MODELS = [
  { id: "deepseek-ai/DeepSeek-R1-Distill-Qwen-32B", options: { response_format: { type: "json_object" } } }, // 0
  { id: "Qwen/Qwen2.5-72B-Instruct", options: { } }, // 1
  { id: "deepseek-ai/DeepSeek-V3.2", options: { extra_body: { enable_thinking: true } } }, // 2
  { id: "MiniMax/MiniMax-M1-80k", options: { } }, // 3
  // 新增模型
  { id: "Qwen/Qwen3-235B-A22B", options: { extra_body: { enable_thinking: true } } }, // 4 (Thinking Model)
  { id: "Qwen/Qwen3-Coder-480B-A35B-Instruct", options: { response_format: { type: "json_object" } } }, // 5
  { id: "Qwen/Qwen3-235B-A22B-Instruct-2507", options: { response_format: { type: "json_object" } } }, // 6
  { id: "Qwen/Qwen3-235B-A22B-Thinking-2507", options: { } }, // 7
  { id: "Qwen/Qwen2.5-32B-Instruct", options: { } } // 8 (Backup)
];


const ROLE_DEFINITIONS = {
  WEREWOLF: '狼人',
  VILLAGER: '村民',
  SEER: '预言家',
  WITCH: '女巫',
  HUNTER: '猎人',
  GUARD: '守卫'
};

// 8人局：2狼人, 1预言家, 1女巫, 1猎人, 1守卫, 2村民
const STANDARD_ROLES = [
  ROLE_DEFINITIONS.WEREWOLF, ROLE_DEFINITIONS.WEREWOLF,
  ROLE_DEFINITIONS.SEER, ROLE_DEFINITIONS.WITCH,
  ROLE_DEFINITIONS.HUNTER, ROLE_DEFINITIONS.GUARD,
  ROLE_DEFINITIONS.VILLAGER, ROLE_DEFINITIONS.VILLAGER
];

const GAME_SETUPS = [
  {
    id: 'standard_8',
    name: '8人标准局',
    TOTAL_PLAYERS: 8,
    STANDARD_ROLES: [
      ROLE_DEFINITIONS.WEREWOLF, ROLE_DEFINITIONS.WEREWOLF,
      ROLE_DEFINITIONS.SEER, ROLE_DEFINITIONS.WITCH,
      ROLE_DEFINITIONS.HUNTER, ROLE_DEFINITIONS.GUARD,
      ROLE_DEFINITIONS.VILLAGER, ROLE_DEFINITIONS.VILLAGER
    ],
    NIGHT_SEQUENCE: ['GUARD', 'WEREWOLF', 'SEER', 'WITCH'], // Night action order
    description: '2狼 2民 1预 1女 1猎 1守'
  },
  {
    id: 'mini_6',
    name: '6人迷你局',
    TOTAL_PLAYERS: 6,
    STANDARD_ROLES: [
      ROLE_DEFINITIONS.WEREWOLF, ROLE_DEFINITIONS.WEREWOLF,
      ROLE_DEFINITIONS.SEER, ROLE_DEFINITIONS.WITCH,
      ROLE_DEFINITIONS.VILLAGER, ROLE_DEFINITIONS.VILLAGER
    ],
    NIGHT_SEQUENCE: ['WEREWOLF', 'SEER', 'WITCH'], // No Guard
    description: '2狼 2民 1预 1女'
  }
];

const PERSONALITIES = [
  { type: 'logical', name: '逻辑怪', traits: '严谨冷静，通过投票记录和发言矛盾找狼，理性分析。' },
  { type: 'aggressive', name: '暴躁哥', traits: '直觉敏锐，攻击性强，怀疑划水者。' },
  { type: 'steady', name: '稳健派', traits: '发言平和，倾向于保护神职，不轻易带节奏。' },
  { type: 'cunning', name: '心机王', traits: '善于伪装和误导，喜欢带节奏和引导舆论。' }
];

const NAMES = ["阿强", "翠花", "小明", "老王", "杰克", "露西", "小红", "大刘"];

export default function App() {
  const {
    state,
    setPhase,
    setNightStep,
    setDayCount,
    setPlayers,
    setUserPlayer,
    setNightDecisions,
    mergeNightDecisions,
    setSeerChecks,
    setGuardHistory,
    setWitchHistory,
    setSpeechHistory,
    setVoteHistory,
    setDeathHistory,
    setLogs,
    addLog,
    initGame,
    processedVoteDayRef,
    gameInitializedRef,
  } = useWerewolfGame({ TOTAL_PLAYERS, STANDARD_ROLES, ROLE_DEFINITIONS, PERSONALITIES, NAMES });

  const { phase, nightStep, dayCount, players, userPlayer, logs, nightDecisions, seerChecks, guardHistory, witchHistory, speechHistory, voteHistory, deathHistory } = state;
  
  // 防御性检查：确保 state 值不是函数
  if (typeof dayCount === 'function' || typeof phase === 'function' || typeof nightStep === 'function') {
    console.error('⚠️ State 被错误地设置为函数！', { dayCount, phase, nightStep });
  }
  
  const [isThinking, setIsThinking] = useState(false);
  const [gameMode, setGameMode] = useState(null); // 'player' 或 'ai-only'
  const [selectedSetup, setSelectedSetup] = useState(GAME_SETUPS[0]);
  
  // 解决 React Strict Mode 下 Effect 执行两次导致的夜间行动重复问题
  const processingStepRef = React.useRef(-1);
  // 记录被429的模型索引，避免重复使用
  const disabledModelsRef = React.useRef(new Set());
  
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [userInput, setUserInput] = useState("");
  const [speakerIndex, setSpeakerIndex] = useState(-1);
  const [speakingOrder, setSpeakingOrder] = useState('left'); // 'left' or 'right'
  const [spokenCount, setSpokenCount] = useState(0); // 记录今日已发言人数
  const [hunterShooting, setHunterShooting] = useState(null); // 猎人开枪

  // Computed night sequence for current setup
  const currentNightSequence = selectedSetup.NIGHT_SEQUENCE || ['GUARD', 'WEREWOLF', 'SEER', 'WITCH'];

  // 粗暴的 JSON 清洗：尝试截取首尾大括号之间的内容，避免模型输出杂质
  const safeParseJSON = (text) => {
    if (!text) return null;
    const trimmed = text.replace(/```json\n?|\n?```/g, '').trim();
    const first = trimmed.indexOf('{');
    const last = trimmed.lastIndexOf('}');
    if (first === -1 || last === -1 || last <= first) return null;
    
    const jsonString = trimmed.slice(first, last + 1);
    
    try {
      return JSON.parse(jsonString);
    } catch (err) {
      // 尝试修复常见格式错误
      try {
        // 1. 修复像 "典型的"幻视"行为" 这样的中文内部引号 (Chinese char " Chinese char)
        let repaired = jsonString.replace(/([\u4e00-\u9fa5])"([\u4e00-\u9fa5])/g, '$1\\"$2');
        return JSON.parse(repaired);
      } catch (retryErr) {
        console.warn('JSON parse failed, raw snippet:', trimmed);
        return null;
      }
    }
  };

  const fetchLLM = async (player, prompt, systemInstruction, retries = 3, backoff = 2000, forcedModelIndex = null) => {
    // 确定模型：均匀分配给所有玩家
    // 如果没有传入player（比如全局操作），默认使用第一个模型
    // 如果指定了 forcedModelIndex，作为候选（但仍需检查是否禁用）
    const defaultModelIndex = player ? player.id % AI_MODELS.length : 0;
    let modelIndex = forcedModelIndex !== null ? forcedModelIndex : defaultModelIndex;

    // 检查并跳过已禁用的模型
    // 如果当前选择的模型在黑名单中，尝试寻找下一个可用模型
    let attempts = 0;
    while (disabledModelsRef.current.has(modelIndex) && attempts < AI_MODELS.length) {
      modelIndex = (modelIndex + 1) % AI_MODELS.length;
      attempts++;
    }
    
    // 如果所有模型都被禁用，清空黑名单重试（避免死锁）
    if (attempts >= AI_MODELS.length) {
      console.warn("[API] 所有模型均被禁用(429)，重置黑名单。");
      disabledModelsRef.current.clear();
      // 保持当前的 modelIndex 继续尝试
    }

    const modelConfig = AI_MODELS[modelIndex];

    // 处理配置选项: 模拟 OpenAI Python SDK 的 extra_body 行为
    let requestOptions = { ...modelConfig.options };
    if (requestOptions.extra_body) {
        const { extra_body, ...rest } = requestOptions;
        requestOptions = { ...rest, ...extra_body };
    }

    const payload = {
      model: modelConfig.id,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: prompt }
      ],
      ...requestOptions
    };
    
    const startTime = Date.now();
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify(payload)
      });

      const duration = Date.now() - startTime;
      console.log(`[API Call] Player: ${player ? player.id : 'System'}, Model: ${modelConfig.id}, Duration: ${duration}ms, Forced: ${forcedModelIndex !== null}`);

      if (!response.ok) {
        // 专门处理 429 错误 (Too Many Requests)
        if (response.status === 429) {
          throw new Error(`RunningModel: ${modelConfig.id} failed with 429 Too Many Requests`);
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      
      const content = result.choices?.[0]?.message?.content;
      return safeParseJSON(content);
    } catch (error) {
      console.error(`LLM Fetch Error [Model: ${modelConfig.id}]:`, error);
      
      const isRateLimit = error.message.includes('429') || error.message.includes('Too Many Requests');

      if (retries > 0) {
        let nextModelIndex = modelIndex;
        let nextBackoff = backoff * 2;
        let delay = Math.min(15000, backoff);

        if (isRateLimit) {
             // 永久拉黑当前模型
             console.warn(`[429 封禁] 模型 ${modelConfig.id} 触发限流，已加入黑名单。`);
             disabledModelsRef.current.add(modelIndex);

             // 寻找下一个可用的
             nextModelIndex = (modelIndex + 1) % AI_MODELS.length; 
             // 下一次递归调用 fetchLLM 时会在开头自动处理 blacklist 跳过逻辑
             
             nextBackoff = 1000; // 重置 backoff 因为是新模型
             delay = 500; // 0.5秒后尝试下一个
             
             console.warn(`[429 自动切换] 切换到索引 ${nextModelIndex} (将在执行时验证 availability)`);
             await new Promise(res => setTimeout(res, delay));
             return fetchLLM(player, prompt, systemInstruction, retries - 1, nextBackoff, nextModelIndex);
        } else {
             console.log(`等待${delay}ms后重试... (剩余重试次数: ${retries})`);
             await new Promise(res => setTimeout(res, delay));
             return fetchLLM(player, prompt, systemInstruction, retries - 1, backoff * 2, forcedModelIndex);
        }
      }
      return null;
    }
  };

  // 构建AI上下文 - 根据角色提供不同信息（用序号称呼）
  const buildAIContext = (player) => {
    const alivePlayers = players.filter(p => p.isAlive);
    const aliveList = alivePlayers.map(p => `${p.id}号`).join(',');
    const deadList = players.filter(p => !p.isAlive).map(p => `${p.id}号`).join(',') || '无';
    
    // 发言记录（区分今日和往日）
    const todaySpeeches = speechHistory.filter(s => s.day === dayCount).map(s => `${s.playerId}号:${s.content}`).join('\n');
    // 使用摘要(summary)作为共享发言池的核心，压缩记录
    const historySpeeches = speechHistory.filter(s => s.day < dayCount).map(s => `D${s.day} ${s.playerId}号:${s.summary || s.content.slice(0, 50)}`).join('\n');
    
    // 投票记录（简洁）
    const voteInfo = voteHistory.length > 0 ? voteHistory.map(v => 
      `D${v.day}:${v.votes.map(vote => `${vote.from}->${vote.to}`).join(',')}=>${v.eliminated}号出局`
    ).join(';') : '无';
    
    // 死亡记录（区分昨夜和历史）
    const lastNightDeaths = deathHistory.filter(d => d.day === dayCount && d.phase === '夜');
    const lastNightInfo = lastNightDeaths.length > 0 
      ? `昨晚(第${dayCount}夜)死亡: ${lastNightDeaths.map(d => `${d.playerId}号(${d.cause})`).join(',')}`
      : `昨晚(第${dayCount}夜): 平安夜(无人死亡)`;
      
    const priorDeaths = deathHistory.filter(d => d.day < dayCount || (d.day === dayCount && d.phase !== '夜'))
       .map(d => `D${d.day}${d.phase}: ${d.playerId}号${d.cause}`).join(';');
    
    // 角色特定信息
    let roleInfo = '';
    if (player.role === '预言家') {
      const myChecks = seerChecks.filter(c => c.seerId === player.id);
      roleInfo = myChecks.length > 0 
        ? `【历史查验】${myChecks.map(c => `N${c.night}:${c.targetId}号是${c.isWolf ? '狼' : '好人'}`).join(';')}`
        : '【历史查验】无';
        
      // 重要补丁：如果今晚（当前dayCount）刚刚查验了，也需要加进去
      // 因为 React state 更新可能没那么快反映到 seerChecks 中，或者 buildAIContext 是在 state 更新前调用的
      // 我们从 nightDecisions.seerResult 补充"今晚的即时查验信息"
      if (player.role === '预言家' && nightDecisions.seerResult && nightDecisions.seerResult.targetId !== undefined) {
         const { targetId, isWolf } = nightDecisions.seerResult;
         // 避免重复显示
         const alreadyInHistory = myChecks.some(c => c.targetId === targetId);
         if (!alreadyInHistory) {
             roleInfo += `\n【今晚查验(最新)】: ${targetId}号是${isWolf ? '狼' : '好人'}`;
         }
      }
    } else if (player.role === '女巫') {
      roleInfo = `【药】解:${player.hasWitchSave ? '有' : '无'} 毒:${player.hasWitchPoison ? '有' : '无'}`;
      if (witchHistory.savedIds.length > 0) roleInfo += ` 救过:${witchHistory.savedIds.join(',')}号`;
      if (witchHistory.poisonedIds.length > 0) roleInfo += ` 毒过:${witchHistory.poisonedIds.join(',')}号`;
      // 女巫知道昨晚具体的刀口
      if (lastNightDeaths.length > 0) {
         // 这里简化处理，假设女巫通过死亡名单知道谁死了。实际上女巫在晚上知道谁被刀。
         // 如果女巫救了人，yesterdayDeaths里就没有那个人的死亡记录。
         // 所以我们需要告诉女巫"昨晚谁被刀了"（不管有没有救活）。
         // 但为了简化，我们只提供公开的死亡信息 + 自己的救人历史。
      }
    } else if (player.role === '守卫') {
      roleInfo = guardHistory.length > 0 
        ? `【守】${guardHistory.map(g => `N${g.night}:${g.targetId}号`).join(';')}`
        : '【守】无';
      if (nightDecisions.lastGuardTarget !== null) {
        roleInfo += ` 禁守${nightDecisions.lastGuardTarget}号(连守)`;
      }
    } else if (player.role === '狼人') {
      const wolfTeam = players.filter(p => p.role === '狼人').map(p => `${p.id}号${p.isAlive ? '' : '(死)'}`).join(',');
      roleInfo = `【狼队】${wolfTeam}`;
    }
    
    return { aliveList, deadList, todaySpeeches, historySpeeches, voteInfo, deathInfo: `${lastNightInfo}; 历史死亡:${priorDeaths}`, roleInfo, dayCount };
  };


  const askAI = async (player, task, extraInfo = "") => {
    setIsThinking(true);
    const ctx = buildAIContext(player);
    
    // 狼人杀专业术语表
    const werewolfTerminology = `
【狼人杀专用术语表】
1️⃣ 发言相关：
- 划水 (Water/Flood): 内容少、无判断、无立场。
- 爆水/给水: 给某人强烈好人评价。
- 踩人 (Step on): 明确怀疑某人是狼。
- 站边 (Stand by): 明确支持某一预言家。
- 带节奏: 引导投票方向。

2️⃣ 行为逻辑：
- 逻辑自洽 (Consistent): 前后一致。
- 行为像狼 (Wolfy): 行为鬼祟，无正当理由。

3️⃣ 身份判定：
- 金水 (Gold Water): 预言家查验的好人。
- 查杀 (Kill Check/Cha Sha): 预言家查验的狼人。
- 跳 (Jump/Claim): 这轮表明身份。
- 悍跳 (Wolf Jump): 狼人假装预言家。
- 银水 (Silver Water): 女巫救的人（通常是好人）。
- 冲锋狼: 积极对抗好人的狼。
- 倒钩狼: 假装站边好人的狼。
- 抗推位: 容易被误出的好人。

请在发言中自然使用这些术语！`;

    // 根据身份定制策略
    let roleStrategy = '';
    const isFirstDay = dayCount === 1;
    const nightNum = dayCount;
    
    if (player.role === '狼人') {
      roleStrategy = `【狼人策略：撕咬与悍跳】
你的目标是生存并放逐好人。不要复读。如果预言家查杀了你或队友，立刻反手"悍跳"（声称自己是预言家），给好人发"查杀"或"金水"。指责对方"聊爆"或"背稿子"。如果局势不利，尝试穿神职衣服（如跳守卫）。`;
    } else if (player.role === '预言家') {
      if (isFirstDay) {
        roleStrategy = `【预言家策略：强硬带队-首日必跳】
必须跳身份！霸气发言："我是全场唯一真预言家，昨晚查杀X号（或验了Y号金水）"。如果不跳，好人会迷茫。如果有狼人悍跳，对比心路历程，点出其破绽。`;
      } else {
        roleStrategy = `【预言家策略：强硬带队】
继续报验人信息（金水/查杀）。如果之前的查杀没走，必须号召全票打飞。你是好人领袖，不要软弱。`;
      }
    } else if (player.role === '女巫') {
      const shouldSave = nightNum <= 2 && player.hasWitchSave;
      roleStrategy = `【女巫策略：刀口审判】
你掌握生杀大权。${shouldSave ? '前期通常救人（形成银水）。' : ''}如果没药了或有人对跳，直接跳身份报"银水"（昨晚救的人）或"刀口"。警告穿你衣服的狼人："今晚毒你"。`;
    } else if (player.role === '猎人') {
      roleStrategy = `【猎人策略：强势压制】
发言要横："我是猎人，全场最硬的牌"。重点关注那些"划水"或不敢站队的玩家。谁敢踩你，直接怼回去。`;
    } else if (player.role === '守卫') {
      roleStrategy = `【守卫策略：低调守护】
${nightNum === 1 ? '通常守中立或预言家。' : ''}避免同守同救。不要轻易暴露身份，除非为了保真预言家。试着分析谁在"倒钩"，谁是"冲锋狼"。`;
    } else {
      roleStrategy = `【村民策略：逻辑找狼】
不要划水！虽然无技能，但要敢于"站边"（选择相信一个预言家）。分析谁的行为"做作"、谁在"跟风"。如果不确定，可以说"先听其他玩家发言"。`;
    }
    

    // 硬核博弈法则
    // 动态调整规则：如果是首日且首位发言，放宽"必须攻击"的要求，防止幻视
    const isFirstSpeaker = isFirstDay && (!ctx.todaySpeeches || ctx.todaySpeeches.trim() === '');
    
    // 强制攻击规则 (仅在非首位发言时生效)
    const attackRule = isFirstSpeaker 
      ? '- 由于你是首个发言，尚未有人发言。你可以简单点评昨夜情况（如平安夜），或聊聊自己的身份底牌（也可以划水过）。切记：不要凭空捏造他人的发言或行为！因为还没人说话！'
      : (player.role !== '狼人' 
          ? '- 如果你是好人：怀疑1-2名玩家。不要开上帝视角。' 
          : '- 如果你是狼人：制造混乱，甚至可以"倒钩"（假装帮好人说话）。');

    const gameTheoryRules = `
【硬核博弈法则-必须执行】
1. 拒绝废话：禁止使用"昨晚平安夜"等无意义开场。
2. 逻辑钩子：指控他人时，必须引用具体的理由（如"3号刚才划水"、"5号逻辑矛盾"）。
3. 攻击性要求：
   ${attackRule}
4. 战场意识：分析局势，但不要陈述你无法得知的隐形信息。
5. 身份伪装：禁止直接说"我是好人"这种苍白的话，用逻辑证明。
6. 发言格式：包含【局势分析】+【逻辑输出】。（村民可无【归票建议】，如不确定可说"先听发言"）。
7. 记忆与状态约束：
   - 只能根据【今日发言】和【投票记录】推理。
   - 【严禁幻视】：绝对不要评价【尚未发言】的玩家，因为他们还没说话！只攻击已有发言的玩家。
   ${isFirstSpeaker ? '- 特别警告：你是第一个发言的，场上除了昨夜死亡信息外是一张白纸。不要说"3号划水"之类的话，因为3号还没说话。' : ''}
8. 术语规范：请根据【狼人杀术语表】使用专业词汇，如"金水"、"查杀"、"银水"、"悍跳"等，不要用大白话。`;



    const systemPrompt = `你是[${player.id}号]，身份【${player.role}】。性格:${player.personality.traits}
【游戏状态】第${ctx.dayCount}天
【你的状态】存活
【场上存活】${ctx.aliveList}
${ctx.roleInfo}
${roleStrategy}
${gameTheoryRules}
${werewolfTerminology}
【发言规则】
1.用序号称呼如"3号"。只能选存活玩家互动。
2.禁止向自己提问或投票。
3.禁止复读。
4.发言简练。
${extraInfo}
输出JSON`;

    const userPrompt = `第${dayCount}天${phase}。
【今日发言(不能重复)】\n${ctx.todaySpeeches || '暂无'}\n
【历史发言摘要】\n${ctx.historySpeeches || '暂无'}\n
【昨夜情况】${ctx.deathInfo.split(';')[0]}\n
【历史死亡】${ctx.deathInfo.split(';')[1] || '无'}\n
【投票记录】${ctx.voteInfo}\n
任务:${task}`;

    const result = await fetchLLM(player, userPrompt, systemPrompt);
    setIsThinking(false);
    return result;
  };

  useEffect(() => { 
    if (phase === 'setup' && !gameInitializedRef.current && gameMode) {
      gameInitializedRef.current = true;
      initGame(gameMode, selectedSetup); 
    }
  }, [phase, gameMode, selectedSetup]);

  // 触发夜间 AI 行动
  useEffect(() => {
    if (phase === 'night') {
      // 防止重复执行
      if (processingStepRef.current === nightStep) {
        console.log(`[Effect] 忽略重复的夜间步骤触发: ${nightStep}`);
        return;
      }
      processingStepRef.current = nightStep;
      handleNightActions();
    } else {
      // 非夜间阶段重置
      processingStepRef.current = -1;
    }
  }, [phase, nightStep]);

  // --- 夜间行动：动态顺序 ---
  const handleNightActions = async () => {
    const roleOrder = currentNightSequence;
    const currentRoleKey = roleOrder[nightStep];
    
    console.log(`[夜间行动] nightStep=${nightStep}, 当前角色=${ROLE_DEFINITIONS[currentRoleKey] || '未知'}`);
    
    // 如果nightStep超出范围，直接跳过
    if (!currentRoleKey) {
      console.log('[夜间行动] nightStep超出范围，跳过');
      setTimeout(proceedNight, 100);
      return;
    }
    
    const actor = players.find(p => p.role === ROLE_DEFINITIONS[currentRoleKey] && p.isAlive);

    // 修正：如果该角色已全员阵亡，自动跳过
    if (!actor) {
      console.log(`[夜间行动] 没有找到存活的${ROLE_DEFINITIONS[currentRoleKey]}`);
      addLog(`由于场上没有存活的${ROLE_DEFINITIONS[currentRoleKey]}，直接跳过。`, 'system');
      setTimeout(proceedNight, 1500);
      return;
    }
    console.log(`[夜间行动] 找到角色：${actor.id}号 ${actor.name}，是否用户：${actor.isUser}`);
    // 如果是存活的用户且非全AI模式，等待交互；否则自动执行AI
    if (actor.isUser && actor.isAlive && gameMode !== 'ai-only') {
      console.log(`[夜间行动] 等待用户操作`);
      return;
    }

    // 全AI模式：打印夜间行动提示
    if (gameMode === 'ai-only') {
      // addLog(`[${actor.id}号 ${actor.name}] 正在行动...`, 'system'); // 移除【正在行动】日志
    }

    if (currentRoleKey === 'GUARD') {
      const cannotGuard = nightDecisions.lastGuardTarget;
      const alivePlayers = players.filter(p => p.isAlive).map(p => p.id);
      // 首夜建议空守避免同守同救
      const isFirstNight = dayCount === 1;
      const hint = isFirstNight ? '首夜建议空守避免同守同救。' : '';
      console.log(`[守卫AI] 开始守卫决策，存活玩家：${alivePlayers.join(',')}`);
      const res = await askAI(actor, `守卫选择。${hint}存活:${alivePlayers.join(',')}。${cannotGuard !== null ? `禁守${cannotGuard}号。` : ''}输出:{"targetId":数字或null}`);
      console.log(`[守卫AI] AI返回结果：`, res);
      // 允许 null (空守) 且如果空守，不需要检查 lastGuardTarget
      if (res && (res.targetId === null || (res.targetId !== cannotGuard && (players.find(p => p.id === res.targetId)?.isAlive)))) {
        if (res.targetId !== null) {
          console.log(`[守卫AI] 守护目标：${res.targetId}号`);
          if (gameMode === 'ai-only') {
            addLog(`[${actor.id}号] 守卫守护了 ${res.targetId}号`, 'system');
          }
          mergeNightDecisions({ guardTarget: res.targetId });
          setGuardHistory([...guardHistory, { night: dayCount, targetId: res.targetId }]);
        } else {
          console.log(`[守卫AI] 选择空守`);
          if (gameMode === 'ai-only') {
            addLog(`[${actor.id}号] 守卫选择空守`, 'system');
          }
          mergeNightDecisions({ guardTarget: null }); // Explicitly set to null
        }
      } else {
        console.log(`[守卫AI] AI决策无效或被过滤`);
        // 当校验失败时，尝试用空守作为 fallback，而不是卡住
        console.log('[守卫AI] 强制空守');
        mergeNightDecisions({ guardTarget: null });
      }
    }
    else if (currentRoleKey === 'WEREWOLF') {
      const validTargets = players.filter(p => p.isAlive && p.role !== '狼人').map(p => p.id);
      console.log(`[狼人AI] 开始狼人决策，可选目标：${validTargets.join(',')}`);
      const res = await askAI(actor, `狼人袭击。可选:${validTargets.join(',')}。输出:{"targetId":数字}`);
      console.log(`[狼人AI] AI返回结果：`, res);
      if (res && validTargets.includes(res.targetId)) {
        console.log(`[狼人AI] 狼人袭击目标：${res.targetId}号`);
        if (gameMode === 'ai-only') {
          addLog(`[${actor.id}号] 狼人选择袭击 ${res.targetId}号`, 'system');
        }
        mergeNightDecisions({ wolfTarget: res.targetId, wolfSkipKill: false });
      } else {
        console.log(`[狼人AI] AI决策无效，狼人空刀`);
        if (gameMode === 'ai-only') {
          addLog(`[${actor.id}号] 狼人选择空刀`, 'system');
        }
      }
    } 
    else if (currentRoleKey === 'SEER') {
      const checkedIds = seerChecks.filter(c => c.seerId === actor.id).map(c => c.targetId);
      const validTargets = players.filter(p => p.isAlive && p.id !== actor.id && !checkedIds.includes(p.id)).map(p => p.id);
      console.log(`[预言家AI] 已查验：${checkedIds.join(',') || '无'}，可验：${validTargets.join(',')}`);
      if (validTargets.length === 0) {
        console.log(`[预言家AI] 所有目标已验完`);
        addLog(`预言家已验完所有目标。`, 'system');
      } else {
        console.log(`[预言家AI] 开始查验决策`);
        const res = await askAI(actor, `预言家查验。可验:${validTargets.join(',')}。输出:{"targetId":数字}`);
        console.log(`[预言家AI] AI返回结果：`, res);
        if (res?.targetId !== undefined && validTargets.includes(res.targetId)) {
          // 确保 getPlayer 这里能获取到正确的玩家
          const targetPlayer = players.find(p => p.id === res.targetId);
          if (targetPlayer) {
             const isWolf = targetPlayer.role === ROLE_DEFINITIONS.WEREWOLF;
             console.log(`[预言家AI] 查验${res.targetId}号，结果：${isWolf ? '狼人' : '好人'}`);
             if (gameMode === 'ai-only') {
               addLog(`[${actor.id}号] 预言家查验了 ${res.targetId}号，结果是${isWolf ? '狼人' : '好人'}`, 'system');
             }
             mergeNightDecisions({ seerResult: { targetId: res.targetId, isWolf } });
             // 关键修复：确保这一步正确更新了 seerChecks 状态，以便在 buildAIContext 中使用
             setSeerChecks(prev => [...prev, { night: dayCount, targetId: res.targetId, isWolf, seerId: actor.id }]);
          } else {
             console.error(`[预言家AI] 无法找到目标玩家 ${res.targetId}`);
          }
        } else {
          console.log(`[预言家AI] AI决策无效或被过滤:`, res);
          // 视为放弃查验 (Skip Check)
          if (gameMode === 'ai-only') {
             addLog(`[${actor.id}号] 预言家放弃查验`, 'system');
          }
        }
      }
    } 
    else if (currentRoleKey === 'WITCH') {
      const dyingId = nightDecisions.wolfTarget;
      const canSave = actor.hasWitchSave && dyingId !== null && (dyingId !== actor.id || dayCount === 1);
      const validPoisonTargets = players.filter(p => p.isAlive && p.id !== dyingId).map(p => p.id);
      // 女巫首夜通常救人
      const isFirstNight = dayCount === 1;
      const hint = isFirstNight ? '首夜通常使用解药救人。' : '';
      const extra = `${hint}被刀:${dyingId !== null ? dyingId + '号' : '无'}。解药:${canSave ? '可用' : '无'}。毒药:${actor.hasWitchPoison ? '可用' : '无'}。不能同时用两药。`;
      
      console.log(`[女巫AI] 开始女巫决策，被刀：${dyingId}，解药：${canSave}，毒药：${actor.hasWitchPoison}`);
      const res = await askAI(actor, `女巫决策。${extra}输出:{"useSave":true/false,"usePoison":数字或null}`);
      console.log(`[女巫AI] AI返回结果：`, res);
      
      // 构建完整的夜间决策对象
      const finalDecisions = { ...nightDecisions };
      
      if (res) {
        if (res.useSave && canSave) {
          console.log(`[女巫AI] 使用解药救${dyingId}号`);
          if (gameMode === 'ai-only') {
            addLog(`[${actor.id}号] 女巫使用解药救了 ${dyingId}号`, 'system');
          }
          finalDecisions.witchSave = true;
          mergeNightDecisions({ witchSave: true });
          // remove setPlayers here to avoid state race condition, handle in resolveNight
          setWitchHistory(prev => ({ ...prev, savedIds: [...prev.savedIds, dyingId] })); // 修复：使用 prev
        } else if (res.usePoison !== null && actor.hasWitchPoison && !res.useSave && validPoisonTargets.includes(res.usePoison)) {
          console.log(`[女巫AI] 使用毒药毒${res.usePoison}号`);
          if (gameMode === 'ai-only') {
            addLog(`[${actor.id}号] 女巫使用毒药毒了 ${res.usePoison}号`, 'system');
          }
          finalDecisions.witchPoison = res.usePoison;
          mergeNightDecisions({ witchPoison: res.usePoison });
          // remove setPlayers here too
          setWitchHistory(prev => ({ ...prev, poisonedIds: [...prev.poisonedIds, res.usePoison] })); // 修复：使用 prev
        } else {
          console.log(`[女巫AI] 不使用药水`);
          if (gameMode === 'ai-only') {
            addLog(`[${actor.id}号] 女巫选择不使用药水`, 'system');
          }
        }
      } else {
        console.log(`[女巫AI] AI决策失败`);
      }
      
      // 女巫是最后一步，传递完整的决策对象
      console.log(`[女巫AI] 最终决策：`, finalDecisions);
      setTimeout(() => proceedNight(finalDecisions), 1500);
      return; // 直接返回，不要继续执行后面的 setTimeout
    }

    console.log(`[夜间行动] ${ROLE_DEFINITIONS[currentRoleKey]}行动完成，1.5秒后进入下一步`);
    setTimeout(proceedNight, 1500);
  };

  const proceedNight = (decisionsOverride = null) => {
    const maxSteps = currentNightSequence.length;
    console.log(`[proceedNight] 当前nightStep=${nightStep}, 将要${nightStep < maxSteps - 1 ? '进入下一步' : '结算夜晚'}`);
    setSelectedTarget(null);
    if (nightStep < maxSteps - 1) {
      console.log(`[proceedNight] nightStep从${nightStep}变为${nightStep + 1}`);
      setNightStep(nightStep + 1);
    } else {
      console.log(`[proceedNight] 开始结算夜晚`);
      resolveNight(decisionsOverride);
    }
  };

  const resolveNight = (decisionsOverride = null) => {
    const { wolfTarget, wolfSkipKill, witchSave, witchPoison, guardTarget } = decisionsOverride || nightDecisions;
    console.log(`[resolveNight] 夜间决策：`, { wolfTarget, wolfSkipKill, witchSave, witchPoison, guardTarget });
    
    let deadIds = [];
    let poisonedIds = [];
    let deathReasons = {};

    // 处理狼人袭击
    if (wolfTarget !== null && !wolfSkipKill) {
      const isGuarded = guardTarget === wolfTarget;
      const isBothGuardedAndSaved = isGuarded && witchSave;
      
      console.log(`[resolveNight] 狼刀${wolfTarget}号，守卫守${guardTarget}号，女巫救${witchSave}，守护=${isGuarded}，同守同救=${isBothGuardedAndSaved}`);
      
      if (isBothGuardedAndSaved) {
        deadIds.push(wolfTarget);
        deathReasons[wolfTarget] = '同守同救';
        addLog(`[${wolfTarget}号] 触发同守同救规则！`, 'warning');
        console.log(`[resolveNight] ${wolfTarget}号同守同救死亡`);
      } else if (!isGuarded && !witchSave) {
        deadIds.push(wolfTarget);
        deathReasons[wolfTarget] = '被狼人杀害';
        console.log(`[resolveNight] ${wolfTarget}号被狼人杀害`);
      } else {
        console.log(`[resolveNight] ${wolfTarget}号存活（守护=${isGuarded}，女巫救=${witchSave}）`);
      }
    }

    // 处理毒药
    if (witchPoison !== null) {
      if (!deadIds.includes(witchPoison)) {
        deadIds.push(witchPoison);
      }
      poisonedIds.push(witchPoison);
      deathReasons[witchPoison] = '被女巫毒死';
    }

    const uniqueDeads = [...new Set(deadIds)];
    
    // 记录死亡历史
    const deathRecords = uniqueDeads.map(id => ({ 
        day: dayCount, 
        phase: '夜', 
        playerId: id, 
        cause: deathReasons[id] || '死亡' 
    }));
    setDeathHistory([...deathHistory, ...deathRecords]);
    
    // 更新玩家状态
    let updatedPlayers = players.map(p => {
      let newP = { ...p };
      
      // 更新女巫的药水状态
      // 注意：这里假设场上只有一个女巫，或者所有女巫共享决策（当前逻辑是单一女巫）
      if (p.role === ROLE_DEFINITIONS.WITCH) {
        if (witchSave) newP.hasWitchSave = false;
        if (witchPoison !== null) newP.hasWitchPoison = false;
      }

      if (uniqueDeads.includes(p.id)) {
        const wasPoisoned = poisonedIds.includes(p.id);
        newP.isAlive = false;
        newP.isPoisoned = wasPoisoned;
        newP.canHunterShoot = !wasPoisoned;
      }
      return newP;
    });
    
    setPlayers(updatedPlayers);
    
    // 更新守卫的上一夜守护目标
    mergeNightDecisions({
      lastGuardTarget: guardTarget,
      wolfTarget: null,
      wolfSkipKill: false,
      witchSave: false,
      witchPoison: null,
      guardTarget: null,
      seerResult: null
    });

    // 检查游戏是否结束（例如屠边触发）
    if (checkGameEnd(updatedPlayers)) {
      setPhase('game_over');
      return;
    }

    if (uniqueDeads.length === 0) {
      addLog("天亮了，昨晚是平安夜。", "success");
      setPhase('day_announce');
      setTimeout(() => {
        startDayDiscussion(updatedPlayers, []);
      }, 2000);
    } else {
      addLog(`天亮了，昨晚倒牌的玩家：${uniqueDeads.map(id => `[${id}号]`).join(', ')}`, "danger");
      setPhase('day_announce');
      
      // 夜晚死亡无遗言，但猎人可以开枪
      const hunter = uniqueDeads.map(id => updatedPlayers.find(p => p.id === id))
        .find(p => p && p.role === ROLE_DEFINITIONS.HUNTER && p.canHunterShoot);
      
      if (hunter) {
        setTimeout(() => {
          setHunterShooting({ ...hunter, source: 'night' });
          if (hunter.isUser && gameMode !== 'ai-only') {
            setPhase('hunter_shoot');
          } else {
            handleAIHunterShoot(hunter, 'night', uniqueDeads, updatedPlayers); // Pass uniqueDeads & updatedPlayers
          }
        }, 2000);
      } else {
        // 夜晚死亡无遗言，直接进入白天讨论
        setTimeout(() => {
          startDayDiscussion(updatedPlayers, uniqueDeads);
        }, 2000);
      }
    }
  };

  // 处理被投票出局玩家的遗言（标准狼人杀规则：只有投票出局才有遗言）
  const handleDeathLastWords = (deadIds, currentPlayers, source) => {
    // 此函数已废弃，改为在handlePlayerElimination中直接处理遗言
    // 保留此函数以避免破坏现有调用，但不执行任何操作
    console.warn('handleDeathLastWords is deprecated');
  };

  const startDayDiscussion = (currentPlayers, nightDeads = []) => {
    setPhase('day_discussion');
    const alivePlayers = (currentPlayers || players).filter(p => p.isAlive);
    const aliveIds = alivePlayers.map(p => p.id).sort((a,b)=>a-b);
    
    if (nightDeads.length > 0) {
        // 如果昨晚有人死，从死者右手边（号码+1方向）开始发言
        // 如果有多个死者，通常取最后一个死者或者随机，这里简化取第一个死者
        // 规则：DeadID -> Next Alive ID (Cyclic)
        // 找最大的死者号码，从他下一位开始（或者狼人杀常见规则：多个死者时随机死者顺位？通常是看最后一个被宣布死亡的，这里我们取 nightDeads 的最大值作为基准）
        const deadId = Math.max(...nightDeads);
        
        // 找到 deadId 之后的第一个存活玩家
        // 简单的算法：从 (deadId + 1) 开始找，直到找到一个在 aliveIds 里的
        let startId = -1;
        for (let i = 1; i <= TOTAL_PLAYERS; i++) {
            const check = (deadId + i) % TOTAL_PLAYERS; // 0-7
            if (aliveIds.includes(check)) {
                startId = check;
                break;
            }
        }
        
        const startIndexInAlive = alivePlayers.findIndex(p => p.id === startId);
        setSpeakerIndex(startIndexInAlive);
        addLog(`昨晚${deadId}号死亡，从${startId}号开始发言。`, 'system');
        
    } else {
        // 平安夜，随机开始
        const randomStartPlayer = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
        const startIndexInAlive = alivePlayers.findIndex(p => p.id === randomStartPlayer.id);
        setSpeakerIndex(startIndexInAlive);
        addLog(`平安夜，随机从${randomStartPlayer.id}号开始发言。`, 'system');
    }
    setSpokenCount(0);
  };

  // 猎人开枪处理
  const handleAIHunterShoot = async (hunter, source, nightDeads = [], currentPlayersState = null) => {
    setIsThinking(true);
    // Use passed state or fallback to current state (which might be stale, but better than nothing)
    // CRITICAL: We must use the state where Hunter is ALREADY DEAD otherwise we might resurrect them or miscalculate game end
    let currentPlayers = currentPlayersState ? [...currentPlayersState] : [...players];
    
    const aliveTargets = currentPlayers.filter(p => p.isAlive && p.id !== hunter.id).map(p => p.id);
    const res = await askAI(hunter, `你是猎人，选择开枪目标或不开枪。可选:${aliveTargets.join(',')}。输出:{"shoot":true/false,"targetId":数字或null}`);
    setIsThinking(false);
    
    if (res?.shoot && res.targetId !== null && aliveTargets.includes(res.targetId)) {
      addLog(`[${hunter.id}号] ${hunter.name} 是猎人！开枪带走了 [${res.targetId}号]！`, 'danger');
      currentPlayers = currentPlayers.map(p => p.id === res.targetId ? { ...p, isAlive: false } : p);
      setPlayers(currentPlayers);
      setDeathHistory(prev => [...prev, { day: dayCount, phase: '猎人枪', playerId: res.targetId, cause: '被猎人带走' }]);
    } else {
      addLog(`[${hunter.id}号] ${hunter.name} 是猎人，选择不开枪。`, 'info');
    }
    
    setTimeout(() => {
      setHunterShooting(null);
      const result = checkGameEnd(currentPlayers);
      if (result) {
        setPhase('game_over');
        return;
      }
      
      if (source === 'vote') {
        proceedToNextNight();
      } else {
        startDayDiscussion(currentPlayers, nightDeads);
      }
    }, 2000);
  };

  const handleUserHunterShoot = (source) => {
    let currentPlayers = [...players];
    const aliveTargets = currentPlayers.filter(p => p.isAlive && p.id !== userPlayer.id);
    
    if (selectedTarget !== null && aliveTargets.some(p => p.id === selectedTarget)) {
      addLog(`你是猎人！开枪带走了 [${selectedTarget}号]！`, 'danger');
      currentPlayers = currentPlayers.map(p => p.id === selectedTarget ? { ...p, isAlive: false } : p);
      setPlayers(currentPlayers);
      setDeathHistory(prev => [...prev, { day: dayCount, phase: '猎人枪', playerId: selectedTarget, cause: '被猎人带走' }]);
    } else {
      addLog(`你是猎人，选择不开枪。`, 'info');
    }
    
    setTimeout(() => {
      setHunterShooting(null);
      setSelectedTarget(null);
      const result = checkGameEnd(currentPlayers);
      if (result) {
        setPhase('game_over');
        return;
      }
      
      // 根据来源决定进入下一阶段
      if (hunterShooting?.source === 'vote') {
        proceedToNextNight();
      } else {
        startDayDiscussion(currentPlayers); // Use fresh players
      }
    }, 2000);
  };

  const checkGameEnd = (currentPlayers = players) => {
    const aliveWolves = currentPlayers.filter(p => p.isAlive && p.role === ROLE_DEFINITIONS.WEREWOLF).length;
    const aliveVillagers = currentPlayers.filter(p => p.isAlive && p.role === ROLE_DEFINITIONS.VILLAGER).length;
    const aliveGods = currentPlayers.filter(p => p.isAlive && (p.role !== '狼人' && p.role !== '村民')).length;
    
    console.log(`[GameCheck] Wolves: ${aliveWolves}, Villagers: ${aliveVillagers}, Gods: ${aliveGods}, Check State:`, currentPlayers.map(p => `${p.id}:${p.role[0]}:${p.isAlive?'alive':'dead'}`).join(','));

    const aliveGood = aliveVillagers + aliveGods;
    
    if (aliveWolves === 0) {
      addLog("🎉 狼人全灭，好人胜利！", "success");
      return 'good_win';
    }
    if (aliveVillagers === 0) {
      addLog("💀 村民全灭，狼人胜利（屠边）！", "danger");
      return 'wolf_win';
    }
    if (aliveGods === 0) {
      addLog("💀 神职全灭，狼人胜利（屠边）！", "danger");
      return 'wolf_win';
    }
    if (aliveWolves >= aliveGood) {
      addLog("💀 狼人数量大于等于好人，狼人胜利！", "danger");
      return 'wolf_win';
    }
    return null;
  };

  // --- 发言与投票逻辑 ---
  // 用户死亡后或全AI模式下自动进行投票
  useEffect(() => {
    if (phase === 'day_voting' && !isThinking) {
      const userAlive = players.find(p => p.id === 0)?.isAlive;
      if (!userAlive || gameMode === 'ai-only') {
        // 用户已死亡或全AI模式，自动AI投票
        handleAutoVote();
      }
    }
  }, [phase, players]);

  useEffect(() => {
    if (phase === 'day_discussion' && speakerIndex !== -1) {
      const alivePlayers = players.filter(p => p.isAlive);
      if (speakerIndex < 0 || speakerIndex >= alivePlayers.length) {
        setSpeakerIndex(-1);
        setPhase('day_voting');
        addLog('全员发言结束，进入放逐投票阶段。', 'system');
        return;
      }
      
      const currentSpeaker = alivePlayers[speakerIndex];
      
      // 防止重复发言：检查该玩家今日是否已发言
      // Don't modify state inside this check, just return. 
      // Rely on the previous act (User action or AI timeout) to call moveToNextSpeaker
      if (speechHistory.some(s => s.day === dayCount && s.playerId === currentSpeaker.id)) {
        return;
      }

      if (currentSpeaker && (!currentSpeaker.isUser || gameMode === 'ai-only')) {
        const triggerAISpeech = async () => {
          // Double check inside async in case of race conditions
          if (speechHistory.some(s => s.day === dayCount && s.playerId === currentSpeaker.id)) return;

          const aliveIds = alivePlayers.map(p => p.id);
          const speechPrompt = `白天发言。
【必须做到】
1.首先检查【今日发言】，绝对不能重复别人的观点或问题。
2.如果你有夜间信息(查验/刀口/守护)，必须第一时间报出来。
3.如果预言家已死，不要再讨论他的查验（除非是为了回顾逻辑）。
4.如果怀疑某人，必须分析其"狼人动机"（收益论）。
5.可以点名一个【存活】的玩家要求其对【历史发言】解释。严禁评价【未发言】玩家的内容。
6.如果场上信息很少，可以谈谈"平安夜"的可能性或简单的站边。
7.【强制要求】发言最后必须表明：【本轮投票意向】：X号（必须是存活玩家${aliveIds.join(',')}号之一）

输出JSON:{"speech":"内容(40-60字，必须包含投票意向)","summary":"发言摘要(15字内，用于公共发言池记录)","voteIntention":数字(投票目标的号码)}`;
          const res = await askAI(currentSpeaker, speechPrompt);
          if (res?.speech) {
            addLog(res.speech, "chat", `[${currentSpeaker.id}号]`);
            setSpeechHistory(prev => [...prev, { 
              playerId: currentSpeaker.id, 
              name: currentSpeaker.name, 
              content: res.speech, 
              day: dayCount, 
              summary: res.summary || res.speech.slice(0, 20), // 优先使用AI生成的摘要
              voteIntention: res.voteIntention 
            }]);
          }
          // 添加延迟避免API速率限制
          await new Promise(resolve => setTimeout(resolve, 500));
          moveToNextSpeaker();
        };
        triggerAISpeech();
      }
    }
  }, [phase, speakerIndex, players, speechHistory, dayCount]);

  // 用户发言
  const handleUserSpeak = () => {
    if (!userInput.trim()) return;
    addLog(userInput, "chat", "你");
    setSpeechHistory([...speechHistory, { playerId: 0, name: "你", content: userInput, day: dayCount }]);
    setUserInput("");
    moveToNextSpeaker();
  };

  const moveToNextSpeaker = () => {
    const alivePlayers = players.filter(p => p.isAlive);
    const newSpokenCount = spokenCount + 1;
    setSpokenCount(newSpokenCount);

    if (newSpokenCount >= alivePlayers.length) {
      setSpeakerIndex(-1);
      setPhase('day_voting');
      addLog('全员发言结束，进入放逐投票阶段。', 'system');
    } else {
      // 循环逻辑：默认顺序(index+1)，若 speakingOrder='right' 则逆序(index-1)
      const direction = speakingOrder === 'right' ? -1 : 1;
      setSpeakerIndex(prev => {
        let next = prev + direction;
        // Wrap around ensuring 0 to length-1
        if (next < 0) next = alivePlayers.length - 1;
        if (next >= alivePlayers.length) next = 0;
        return next;
      });
    }
  };

  // 自动投票（用户死亡后触发）
  const handleAutoVote = async () => {
    setIsThinking(true);
    const alive = players.filter(p => p.isAlive);
    const aliveIds = alive.map(p => p.id);
    const deadIds = players.filter(p => !p.isAlive).map(p => p.id);
    let votes = [];
    
    // AI投票 - 只有存活玩家可以投票
    for (let p of alive) {
      let targetId = null;
      
      // 1. 优先尝试使用发言阶段确定的投票意向
      const mySpeech = speechHistory.find(s => s.day === dayCount && s.playerId === p.id);
      if (mySpeech && mySpeech.voteIntention !== undefined && aliveIds.includes(mySpeech.voteIntention)) {
        console.log(`[AI自动投票] ${p.id}号 使用发言时的意向 -> ${mySpeech.voteIntention}号`);
        targetId = mySpeech.voteIntention;
      }
      
      // 2. 如果没有有效意向，才进行AI思考
      if (targetId === null) {
        const prompt = `投票放逐。【存活可投】${aliveIds.join(',')}号。【已死禁投】${deadIds.length > 0 ? deadIds.join(',') + '号' : '无'}。
【投票前必须思考】
1.你投的人可能无辜的理由是什么？
2.为什么你仍然投他？
3.不要因为别人投就跟投，要有独立判断
输出:{"targetId":数字}`;
        const res = await askAI(p, prompt);
        targetId = res?.targetId;
      }

      // 严格验证：必须是存活玩家
      if (targetId !== undefined && aliveIds.includes(targetId)) {
        votes.push({ voterId: p.id, voterName: p.name, targetId: targetId });
      } else if (targetId !== undefined) {
        // 容错：AI投了死人，随机选一个存活玩家
        const fallback = aliveIds.filter(id => id !== p.id)[0] || aliveIds[0];
        votes.push({ voterId: p.id, voterName: p.name, targetId: fallback });
      }
      // 添加延迟避免API速率限制（如果跳过了思考，延迟可以短一点，但为了安全还是保留）
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    processVoteResults(votes, aliveIds);
  };

  const handleVote = async () => {
    if (selectedTarget === null || isThinking) return;
    
    // 检查目标是否存活
    const targetPlayer = players.find(p => p.id === selectedTarget);
    if (!targetPlayer?.isAlive) {
      addLog("不能投票给死亡玩家！", "warning");
      return;
    }
    
    setIsThinking(true);
    const alive = players.filter(p => p.isAlive);
    const aliveIds = alive.map(p => p.id);
    const deadIds = players.filter(p => !p.isAlive).map(p => p.id);
    
    // 用户投票（先保存，稍后一起公布）
    const userVote = players.find(p => p.id === 0)?.isAlive 
      ? { voterId: 0, voterName: '你', targetId: selectedTarget }
      : null;
    
    // AI串行投票（避免速率限制）
    const aiPlayers = alive.filter(p => !p.isUser);
    
    // 串行发起AI投票请求，添加延迟避免速率限制
    const aiVotes = [];
    for (const p of aiPlayers) {
      // 过滤掉自己
      const validTargets = aliveIds.filter(id => id !== p.id);
      let targetId = null;

      // 1. 优先尝试使用发言阶段确定的投票意向
      const mySpeech = speechHistory.find(s => s.day === dayCount && s.playerId === p.id);
      if (mySpeech && mySpeech.voteIntention !== undefined && validTargets.includes(mySpeech.voteIntention)) {
         console.log(`[AI投票] ${p.id}号 使用发言时的意向 -> ${mySpeech.voteIntention}号`);
         targetId = mySpeech.voteIntention;
      }

      // 2. 如果没有有效意向，才进行AI思考
      if (targetId === null) {
        const prompt = `投票放逐。【存活可投】${validTargets.join(',')}号(不能投自己)。【已死禁投】${deadIds.length > 0 ? deadIds.join(',') + '号' : '无'}。
【投票前必须思考】
1.你投的人可能无辜的理由是什么？
2.为什么你仍然投他？
3.不要因为别人投就跟投，要有独立判断
输出:{"targetId":数字}`;

        const res = await askAI(p, prompt);
        targetId = res?.targetId;
      }

      // 严格验证：必须是存活玩家且不是自己
      if (targetId !== undefined && validTargets.includes(targetId)) {
        aiVotes.push({ voterId: p.id, voterName: p.name, targetId: targetId });
      } else if (targetId !== undefined) {
        // 容错：AI投了死人或自己，随机选一个存活玩家（排除自己）
        const fallback = validTargets[Math.floor(Math.random() * validTargets.length)];
        aiVotes.push({ voterId: p.id, voterName: p.name, targetId: fallback });
      }
      // 添加延迟避免API速率限制
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // 合并所有投票（用户投票和AI投票是独立的，互不影响）
    const votes = userVote ? [userVote, ...aiVotes] : aiVotes;
    
    processVoteResults(votes, aliveIds);
  };

  const processVoteResults = (votes, aliveIds) => {
    // 防止重复记录（React 18 Strict Mode or Event Racing）
    if (processedVoteDayRef.current === dayCount) {
       return;
    }
    processedVoteDayRef.current = dayCount;

    // 保存投票记录
    setVoteHistory([...voteHistory, { 
      day: dayCount, 
      votes: votes.map(v => ({ from: v.voterId, to: v.targetId })),
      eliminated: null // 稍后更新
    }]);
    
    addLog("--- 投票记录 ---", "system");
    votes.forEach(v => addLog(`[${v.voterId}号] 投给 -> [${v.targetId}号]`, "info"));
    
    const counts = votes.reduce((acc, v) => {
      acc[v.targetId] = (acc[v.targetId] || 0) + 1;
      return acc;
    }, {});

    if (Object.keys(counts).length === 0) {
      addLog("无人投票，平安日。", "info");
      setVoteHistory([...voteHistory, { 
        day: dayCount, 
        votes: [],
        eliminated: null 
      }]);
      setIsThinking(false);
      setSelectedTarget(null);
      
      const result = checkGameEnd();
      if (result) {
        setPhase('game_over');
      } else {
        setPhase('night');
        setNightStep(0);
        addLog(`=== 第 ${dayCount + 1} 夜 ===`, "system");
      }
      return;
    }
    
    const maxVotes = Math.max(...Object.values(counts));
    const topCandidates = Object.keys(counts).filter(id => counts[id] === maxVotes);
    
    let outPlayer;
    if (topCandidates.length > 1) {
      addLog(`平票！[${topCandidates.join('号]和[')}号] 各获得 ${maxVotes} 票，PK后随机出局。`, "warning");
      const outId = topCandidates[Math.floor(Math.random() * topCandidates.length)];
      outPlayer = getPlayer(parseInt(outId));
    } else {
      outPlayer = getPlayer(parseInt(topCandidates[0]));
    }
    
    if (!outPlayer) {
      addLog("系统错误：无法确定出局玩家", "error");
      setIsThinking(false);
      setSelectedTarget(null);
      return;
    }

    addLog(`[${outPlayer.id}号] ${outPlayer.name} 被公投出局。`, "danger");
    
    // 更新投票记录中的出局者
    const updatedVoteHistory = [...voteHistory];
    if (updatedVoteHistory.length > 0) updatedVoteHistory[updatedVoteHistory.length - 1].eliminated = outPlayer.id;
    setVoteHistory(updatedVoteHistory);
    
    // 立即切换阶段，防止 useEffect 重复触发自动投票
    setPhase('day_processing');

    handlePlayerElimination(outPlayer);
    
    setIsThinking(false);
    setSelectedTarget(null);
  };

  const handlePlayerElimination = (outPlayer) => {
    // 更新玩家存活状态
    const updatedPlayers = players.map(p => p.id === outPlayer.id ? { ...p, isAlive: false } : p);
    setPlayers(updatedPlayers);
    
    // 记录死亡
    setDeathHistory([...deathHistory, { day: dayCount, phase: '投票', playerId: outPlayer.id, cause: '被公投出局' }]);
    
    // 检查是否是猎人
    const isHunter = outPlayer.role === ROLE_DEFINITIONS.HUNTER && outPlayer.canHunterShoot;
    
    setTimeout(() => {
      if (isHunter) {
        // 猎人可以开枪
        setHunterShooting({ ...outPlayer, source: 'vote' });
        if (outPlayer.isUser && gameMode !== 'ai-only') {
          setPhase('hunter_shoot');
        } else {
          // 传递 updatedPlayers 防止状态闭包导致的死人复活问题
          handleAIHunterShoot(outPlayer, 'vote', [], updatedPlayers);
        }
      } else {
        // 非猎人直接进入下一夜
        const result = checkGameEnd(updatedPlayers);
        if (result) {
          setPhase('game_over');
          return;
        }
        proceedToNextNight();
      }
    }, 2000);
  };

  const proceedToNextNight = () => {
    // 检查游戏是否结束 (这里的 checkGameEnd 使用当前 state 的 players，
    // 因为通常 proceedToNextNight 是在 setTimeout 中调用的，此时 state 应该已经更新)
    // 但为了保险，如果它是直接被调用的，可能会有问题。
    // 在本逻辑中，proceedToNextNight 只在 processVoteResults 和 hunterShoot 中被调用。
    // 它们都已经手动 checkGameEnd(updatedPlayers) 了。
    // 这里再次检查是为了防止遗漏，但这里只能拿到旧 players (closure)。
    // 幸运的是，如果上一步的 checkGameEnd(updatedPlayers) 通过了，这里通常不需要做什么。
    // 不过，为了代码健壮性，我们可以让 proceedToNextNight 接受一个可选的 playersList
    
    // 注意：React state update 在 render 后生效。
    setDayCount(dayCount + 1);
    setPhase('night');
    setNightStep(0);
    addLog(`进入第 ${dayCount + 1} 夜...`, "system");
  };

  // 重新开始游戏
  const restartGame = () => {
    processedVoteDayRef.current = -1;
    gameInitializedRef.current = false;
    setGameMode(null);
    setLogs([]);
    setPhase('setup');
  };

  // 导出游戏日志
  const exportGameLog = () => {
    const timestamp = new Date().toLocaleString('zh-CN');
    let logContent = `========================================\n`;
    logContent += `狼人杀游戏记录\n`;
    logContent += `导出时间: ${timestamp}\n`;
    logContent += `游戏天数: ${dayCount}\n`;
    logContent += `========================================\n\n`;
    
    // 玩家身份列表
    logContent += `【玩家身份】\n`;
    logContent += `----------------------------------------\n`;
    players.forEach(p => {
      const status = p.isAlive ? '存活' : '死亡';
      const userMark = p.isUser ? ' (你)' : '';
      logContent += `${p.id}号 ${p.name}${userMark}: ${p.role} [${status}]\n`;
    });
    logContent += `\n`;
    
    // 死亡记录
    logContent += `【死亡记录】\n`;
    logContent += `----------------------------------------\n`;
    if (deathHistory.length === 0) {
      logContent += `无人死亡\n`;
    } else {
      deathHistory.forEach(d => {
        const player = players.find(p => p.id === d.playerId);
        logContent += `第${d.day}天${d.phase}: ${d.playerId}号 ${player?.name || ''} (${player?.role || '未知'}) - ${d.cause}\n`;
      });
    }
    logContent += `\n`;
    
    // 发言记录
    logContent += `【发言记录】\n`;
    logContent += `----------------------------------------\n`;
    if (speechHistory.length === 0) {
      logContent += `暂无发言\n`;
    } else {
      let currentDay = 0;
      speechHistory.forEach(s => {
        if (s.day !== currentDay) {
          currentDay = s.day;
          logContent += `\n--- 第${currentDay}天 ---\n`;
        }
        const player = players.find(p => p.id === s.playerId);
        const role = player?.role || '未知';
        logContent += `[${s.playerId}号 ${s.name} (${role})]: ${s.content}\n`;
      });
    }
    logContent += `\n`;
    
    // 投票记录
    logContent += `【投票记录】\n`;
    logContent += `----------------------------------------\n`;
    if (voteHistory.length === 0) {
      logContent += `暂无投票\n`;
    } else {
      voteHistory.forEach(v => {
        logContent += `\n第${v.day}天投票:\n`;
        v.votes.forEach(vote => {
          const fromPlayer = players.find(p => p.id === vote.from);
          const toPlayer = players.find(p => p.id === vote.to);
          logContent += `  ${vote.from}号(${fromPlayer?.role || '?'}) -> ${vote.to}号(${toPlayer?.role || '?'})\n`;
        });
        const eliminated = players.find(p => p.id === v.eliminated);
        logContent += `  结果: ${v.eliminated}号 ${eliminated?.name || ''} (${eliminated?.role || '未知'}) 被放逐\n`;
      });
    }
    logContent += `\n`;
    
    // 预言家查验记录
    logContent += `【预言家查验记录】\n`;
    logContent += `----------------------------------------\n`;
    if (seerChecks.length === 0) {
      logContent += `无查验记录\n`;
    } else {
      seerChecks.forEach(c => {
        const seer = players.find(p => p.id === c.seerId);
        const target = players.find(p => p.id === c.targetId);
        logContent += `第${c.night}夜: ${c.seerId}号(${seer?.name || ''}) 查验 ${c.targetId}号(${target?.name || ''}) = ${c.isWolf ? '狼人' : '好人'}\n`;
      });
    }
    logContent += `\n`;
    
    // 守卫记录
    logContent += `【守卫守护记录】\n`;
    logContent += `----------------------------------------\n`;
    if (guardHistory.length === 0) {
      logContent += `无守护记录\n`;
    } else {
      guardHistory.forEach(g => {
        const target = players.find(p => p.id === g.targetId);
        logContent += `第${g.night}夜: 守护 ${g.targetId}号 ${target?.name || ''}\n`;
      });
    }
    logContent += `\n`;
    
    // 女巫用药记录
    logContent += `【女巫用药记录】\n`;
    logContent += `----------------------------------------\n`;
    if (witchHistory.savedIds.length === 0 && witchHistory.poisonedIds.length === 0) {
      logContent += `无用药记录\n`;
    } else {
      if (witchHistory.savedIds.length > 0) {
        logContent += `解药救过: ${witchHistory.savedIds.map(id => {
          const p = players.find(x => x.id === id);
          return `${id}号(${p?.name || ''})`;
        }).join(', ')}\n`;
      }
      if (witchHistory.poisonedIds.length > 0) {
        logContent += `毒药毒过: ${witchHistory.poisonedIds.map(id => {
          const p = players.find(x => x.id === id);
          return `${id}号(${p?.name || ''})`;
        }).join(', ')}\n`;
      }
    }
    logContent += `\n`;
    
    // 游戏结果
    logContent += `========================================\n`;
    const aliveWolves = players.filter(p => p.isAlive && p.role === '狼人').length;
    if (aliveWolves === 0) {
      logContent += `游戏结果: 好人阵营胜利！\n`;
    } else {
      logContent += `游戏结果: 狼人阵营胜利！\n`;
    }
    logContent += `========================================\n`;
    
    // 创建下载
    const blob = new Blob([logContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `狼人杀记录_${new Date().toISOString().slice(0,10)}_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getPlayer = (id) => players.find(p => p.id === id);
  const isUserTurn = () => {
    const roles = currentNightSequence;
    return userPlayer?.isAlive && userPlayer.role === ROLE_DEFINITIONS[roles[nightStep]];
  };

  // 获取当前夜间阶段的角色名
  const getCurrentNightRole = () => {
    const roles = currentNightSequence.map(key => ROLE_DEFINITIONS[key]);
    return roles[nightStep] || '';
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col h-screen overflow-hidden p-4">
      {/* 模式选择界面 */}
      {phase === 'setup' && !gameMode && (
        <div className="flex flex-col items-center justify-center h-full gap-8">
          <h1 className="text-4xl font-black tracking-tighter">
            WEREWOLF <span className="text-indigo-500">PRO</span>
          </h1>

          {/* Setup Selection */}
          <div className="flex gap-4 p-2 bg-zinc-900/50 rounded-xl">
             {GAME_SETUPS.map(setup => (
               <button
                 key={setup.id}
                 onClick={() => setSelectedSetup(setup)}
                 className={`px-6 py-3 rounded-lg font-bold transition-all ${
                    selectedSetup.id === setup.id 
                    ? 'bg-indigo-600 text-white shadow-lg' 
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                 }`}
               >
                 <div className="text-lg">{setup.name}</div>
                 <div className="text-xs opacity-70 font-normal">{setup.description}</div>
               </button>
             ))}
          </div>

          <h2 className="text-xl text-zinc-400">请选择开始模式</h2>
          <div className="flex gap-6">
            <button
              onClick={() => setGameMode('player')}
              className="group px-10 py-6 bg-gradient-to-br from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 rounded-2xl text-xl font-bold transition-all transform hover:scale-105 shadow-xl flex flex-col items-center gap-3"
            >
              <User className="w-10 h-10" />
              <span>玩家模式</span>
              <span className="text-sm text-green-200 font-normal">您将扮演一名玩家</span>
            </button>
            <button
              onClick={() => setGameMode('ai-only')}
              className="group px-10 py-6 bg-gradient-to-br from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 rounded-2xl text-xl font-bold transition-all transform hover:scale-105 shadow-xl flex flex-col items-center gap-3"
            >
              <Brain className="w-10 h-10" />
              <span>全AI模式</span>
              <span className="text-sm text-purple-200 font-normal">观看{selectedSetup.TOTAL_PLAYERS}位AI对战</span>
            </button>
          </div>
        </div>
      )}

      {/* 游戏主界面 */}
      {(phase !== 'setup' || gameMode) && (
      <>
      <header className="max-w-6xl mx-auto w-full flex justify-between items-center mb-6 bg-zinc-900/60 p-5 rounded-[2rem] border border-white/5 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-2xl ${phase.includes('night') ? 'bg-indigo-500/20 text-indigo-400' : 'bg-amber-500/20 text-amber-400'}`}>
            {phase.includes('night') ? <Moon size={28}/> : <Sun size={28}/>}
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter">WEREWOLF <span className="text-indigo-500">PRO</span></h1>
            <div className="flex gap-2 mt-1">
               <span className="text-[10px] bg-zinc-800 px-2 py-0.5 rounded text-zinc-400 font-bold">DAY {dayCount}</span>
               <span className="text-[10px] text-zinc-500 font-bold uppercase">{phase.replace('_', ' ')}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
           {isThinking && (
             <div className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl animate-pulse">
               <Brain size={14} className="text-indigo-400"/>
               <span className="text-[10px] text-indigo-400 font-black">AI REASONING</span>
             </div>
           )}
           <div className="text-right">
              <div className="mt-auto bg-zinc-900/60 border border-white/5 rounded-[3rem] p-8 shadow-2xl min-h-[180px] flex flex-col justify-center">
                  {phase === 'game_over' && (
                    <ActionPanel
                      type="game_over"
                      exportGameLog={exportGameLog}
                      restartGame={restartGame}
                    />
                  )}

                  {phase === 'hunter_shoot' && hunterShooting && (
                    <ActionPanel
                      type="hunter_shoot"
                      selectedTarget={selectedTarget}
                      handleUserHunterShoot={() => handleUserHunterShoot(hunterShooting.source || 'vote')}
                      hunterPlayer={hunterShooting}
                    />
                  )}

                  {phase === 'day_discussion' && speakerIndex !== -1 && (
                    <SpeechPanel
                      players={players}
                      speakerIndex={speakerIndex}
                      speakingOrder={speakingOrder}
                      setSpeakingOrder={setSpeakingOrder}
                      userInput={userInput}
                      setUserInput={setUserInput}
                      handleUserSpeak={handleUserSpeak}
                      isThinking={isThinking}
                    />
                  )}

                  {(phase === 'night' && isUserTurn()) && (
                    <ActionPanel
                      type="night_user"
                      userPlayer={userPlayer}
                      players={players}
                      nightDecisions={nightDecisions}
                      mergeNightDecisions={mergeNightDecisions}
                      proceedNight={proceedNight}
                      setPlayers={setPlayers}
                      setUserPlayer={setUserPlayer}
                      witchHistory={witchHistory}
                      setWitchHistory={setWitchHistory}
                      selectedTarget={selectedTarget}
                      getPlayer={getPlayer}
                      addLogFn={addLog}
                      seerChecks={seerChecks}
                      setSeerChecks={setSeerChecks}
                      dayCount={dayCount}
                      nightStep={nightStep}
                      isUserTurn={isUserTurn}
                    />
                  )}

                  {(phase === 'night' && !isUserTurn() && phase !== 'game_over') && (
                    <ActionPanel type="night_ai" getCurrentNightRole={getCurrentNightRole} />
                  )}

                  {phase === 'day_voting' && (
                    <VotePanel
                      players={players}
                      selectedTarget={selectedTarget}
                      isThinking={isThinking}
                      handleVote={handleVote}
                    />
                  )}

                  {phase === 'day_announce' && (
                    <ActionPanel type="day_announce" />
                  )}
              </div>
           </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto w-full flex gap-6 flex-1 min-h-0">
        <PlayerCardList 
          players={players} 
          selectedTarget={selectedTarget}
          setSelectedTarget={setSelectedTarget}
          phase={phase}
          gameMode={gameMode}
          userPlayer={userPlayer}
          AI_MODELS={AI_MODELS} // Pass AI_MODELS for display
          seerChecks={seerChecks}
        />
        <GameLog logs={logs} />
      </div>
      </>
      )}
    </div>
  );
}
