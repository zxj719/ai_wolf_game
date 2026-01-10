// Consolidated Prompt Engineering Service
// This module manages ALL context construction for the AI agents.
// It separates System Prompts (Personality, Global Rules) from User Prompts (Tasks).

// --- CONSTANTS ---
export const PROMPT_ACTIONS = {
    DAY_SPEECH: 'DAY_SPEECH',
    DAY_VOTE: 'DAY_VOTE',
    NIGHT_GUARD: 'NIGHT_GUARD',
    NIGHT_WOLF: 'NIGHT_WOLF',
    NIGHT_SEER: 'NIGHT_SEER',
    NIGHT_WITCH: 'NIGHT_WITCH',
    HUNTER_SHOOT: 'HUNTER_SHOOT'
};

const TERMINOLOGY = `
【狼人杀专用术语表】
1️⃣ 发言相关：
- 划水: 内容少、无判断、无立场。
- 踩人: 明确怀疑某人是狼。
- 站边: 明确支持某一预言家。
- 带节奏: 引导投票方向。

2️⃣ 行为逻辑：
- 行为像狼 : 行为鬼祟，无正当理由。
- 自爆: (Wolf) 狼人公开承认身份并离场(通常用于直接进入黑夜)，不要误用于"公开跳预言家"。

3️⃣ 身份判定：
- 金水 : 预言家查验的好人。 (逻辑：若给金水的预言家为真，则金水必为好人)
- 查杀 : 预言家查验的狼人。
- 跳/起跳: 这轮表明身份。
- 悍跳 : 狼人假装预言家。
- 银水 : 女巫救的人（通常是好人）。
- 冲锋狼: 积极对抗好人的狼。
- 倒钩狼: 假装站边好人的狼。
- 抗推位: 容易被误出的好人。

请在发言中自然使用这些术语！禁止使用"自爆"来描述正常的"起跳"行为！`;

const STRATEGIES = {
    '狼人': (isFirstDay, nightNum) => `【狼人策略：撕咬与悍跳】
你的目标是生存并放逐好人。不要复读。如果预言家查杀了你或队友，立刻反手"悍跳"（声称自己是预言家），给好人发"查杀"或"金水"。指责对方"聊爆"或"背稿子"。如果局势不利，尝试穿神职衣服（如跳守卫）。`,
    '预言家': (isFirstDay, nightNum) => {
        if (isFirstDay) {
          return `【预言家策略：强硬带队-首日必跳】
必须跳身份！霸气发言："我是全场唯一真预言家，昨晚查杀X号（或验了Y号金水）"。如果不跳，好人会迷茫。如果有狼人悍跳，对比心路历程，点出其破绽。`;
        }
        return `【预言家策略：强硬带队】
继续报验人信息（金水/查杀）。如果之前的查杀没走，必须号召全票打飞。你是好人领袖，不要软弱。`;
    },
    '女巫': (isFirstDay, nightNum, player) => {
        const shouldSave = nightNum <= 2 && player.hasWitchSave;
        return `【女巫策略：刀口审判】
你掌握生杀大权。${shouldSave ? '前期通常救人（形成银水）。' : ''}如果没药了或有人对跳，直接跳身份报"银水"（昨晚救的人）或"刀口"。警告穿你衣服的狼人："今晚毒你"。`;
    },
    '猎人': (isFirstDay, nightNum) => `【猎人策略：强势压制】
发言要横："我是猎人，全场最硬的牌"。重点关注那些"划水"或不敢站队的玩家。谁敢踩你，直接怼回去。`,
    '守卫': (isFirstDay, nightNum) => `【守卫策略：低调守护】
${nightNum === 1 ? '通常守中立或预言家。' : ''}避免同守同救。不要轻易暴露身份，除非为了保真预言家。试着分析谁在"倒钩"，谁是"冲锋狼"。`,
    '村民': (isFirstDay, nightNum) => `【村民策略：逻辑找狼】
不要划水！虽然无技能，但要敢于"站边"（选择相信一个预言家）。
【特别逻辑】如果你被预言家发了"金水"：
1. 暂时倾向相信该预言家（除非有铁逻辑反驳）。
2. 绝对不要说"如果他是真预言家，我就是狼"这种疯话！(逻辑：若他是真预，你必好人)。
3. 不要攻击唯一保你的预言家，否则你会被当成"狼人反水"。
分析谁的行为"做作"、谁在"跟风"。如果不确定，可以说"先听其他玩家发言"。`
};

// Keep for compatibility during transition, or remove if fully migrated? 
// We will export it but usage should be internal mainly. 
export const ROLE_STRATEGIES = STRATEGIES;

// --- HELPER FUNCTIONS ---

export const getWerewolfTerminology = () => TERMINOLOGY;

export const buildRoleStrategy = (player, dayCount) => {
  const isFirstDay = dayCount === 1;
  const strategyFn = STRATEGIES[player.role] || STRATEGIES['村民'];
  return strategyFn(isFirstDay, dayCount, player);
};

export const buildPrivateRoleInfo = (player, gameState) => {
    // Adapter for old call signature vs new simplified gameState object
    // Old: (player, { seerChecks, nightDecisions, witchHistory, guardHistory, players, dayCount })
    // New: (player, gameState) where gameState has all these.
    
    // We try to support both styles or standardize on one.
    // The passed 'gameState' usually comes from useAI which passes a big object.
    
    // Deconstruct safe properties
    const seerChecks = gameState.seerChecks || [];
    const nightDecisions = gameState.nightDecisions || {};
    const witchHistory = gameState.witchHistory || { savedIds: [], poisonedIds: [] };
    const guardHistory = gameState.guardHistory || [];
    const players = gameState.players || [];
    
    let info = '';

    switch (player.role) {
        case '预言家':
            const myChecks = seerChecks.filter(c => c.seerId === player.id);
            info = myChecks.length > 0
                ? `【历史查验】${myChecks.map(c => `N${c.night}:${c.targetId}号是${c.isWolf ? '狼' : '好人'}`).join(';')}`
                : '【历史查验】无';
            if (nightDecisions.seerResult?.targetId !== undefined) {
                 // Avoid duplicate if already in history?
                 if (!myChecks.some(c => c.targetId === nightDecisions.seerResult.targetId)) {
                    info += `\n【今晚查验(最新)】: ${nightDecisions.seerResult.targetId}号是${nightDecisions.seerResult.isWolf ? '狼' : '好人'}`;
                 }
            }
            break;
        case '女巫':
            info = `【药】解:${player.hasWitchSave ? '有' : '无'} 毒:${player.hasWitchPoison ? '有' : '无'}`;
            if (witchHistory.savedIds.length > 0) info += ` 救过:${witchHistory.savedIds.join(',')}号`;
            if (witchHistory.poisonedIds.length > 0) info += ` 毒过:${witchHistory.poisonedIds.join(',')}号`;
            break;
        case '守卫':
            info = guardHistory.length > 0
                ? `【守】${guardHistory.map(g => `N${g.night}:${g.targetId}号`).join(';')}`
                : '【守】无';
            if (nightDecisions.lastGuardTarget !== null) info += ` 禁守${nightDecisions.lastGuardTarget}号(连守)`;
            break;
        case '狼人':
            const wolfTeam = players.filter(p => p.role === '狼人').map(p => `${p.id}号${p.isAlive ? '' : '(死)'}`).join(',');
            info = `【狼队】${wolfTeam}`;
            break;
        default:
            info = '';
            break;
    }
    return info;
};

export const buildGameTheoryRules = (isFirstSpeaker, playerRole, alivePlayerIdsString = "各存活玩家") => {
  const attackRule = isFirstSpeaker
    ? '- 由于你是首个发言，尚未有人发言。你可以简单点评昨夜情况（如平安夜），或聊聊自己的身份底牌（也可以划水过）。切记：不要凭空捏造他人的发言或行为！因为还没人说话！'
    : (playerRole !== '狼人'
        ? '- 如果你是好人：怀疑1-2名玩家。不要开上帝视角。'
        : '- 如果你是狼人：制造混乱，甚至可以"倒钩"（假装帮好人说话）。');

  return `
【发言必须遵守的规则】
1. 查重检查：首先检查【今日发言】，绝对不能重复别人的观点或问题。
2. 夜间情报：如果有夜间信息(查验/刀口/守护)，必须第一时间报出来。【预言家】若验了好人，必报"X号是金水"，且【投票意向】不能投给金水！
3. 信息时效：如果预言家已死，不要再讨论他的查验（除非回顾逻辑）。
4. 动机分析：怀疑某人时，必须分析其"狼人动机"（收益论）。
5. 有效互动：可点名【存活】玩家解释【历史发言】。严禁评价【未发言】内容。
6. 低信息应对：若信息少，可谈"平安夜"可能或简单站边。
7. 【强制要求】：发言最后必须表明：【本轮投票意向】：X号（存活玩家${alivePlayerIdsString}号之一）。请在voteIntention字段输出该号码。
8. 记忆与状态约束：
   - 只能根据【今日发言】和【投票记录】推理。
   - 【严禁幻视】：绝对不要评价【尚未发言】的玩家！
   ${isFirstSpeaker ? '- 特别警告：你是首个发言，场上除死亡信息外是一张白纸。' : ''}
9. 行为约束：
   - 【严禁自投】：不能投票给自己。
   - 【严禁自杀式逻辑】：好人不要说"如果他是真预，我就是狼"这种话。
   - ${attackRule}`;
};

// --- DATA PREPARATION ---

export const prepareGameContext = (gameState) => {
    const { players, speechHistory, voteHistory, deathHistory, dayCount, phase } = gameState;
    const alivePlayers = players.filter(p => p.isAlive);
    const aliveList = alivePlayers.map(p => `${p.id}号`).join(',');
    const deadList = players.filter(p => !p.isAlive).map(p => `${p.id}号`).join(',') || '无';

    const todaySpeeches = speechHistory.filter(s => s.day === dayCount).map(s => `${s.playerId}号:${s.content}`).join('\n');
    
    // Improved: Keep more context for recent days (especially yesterday)
    const historySpeeches = speechHistory.filter(s => s.day < dayCount).map(s => {
        const isYesterday = s.day === dayCount - 1;
        // If it's yesterday, use full content if summary is missing, or allow longer slice. 
        // Summary is still preferred if available as it encapsulates the "point".
        const content = s.summary || (isYesterday ? s.content : s.content.slice(0, 50));
        return `D${s.day} ${s.playerId}号:${content}`;
    }).join('\n');

    const voteInfo = voteHistory.length > 0 ? voteHistory.map(v =>
        `D${v.day}:${v.votes.map(vote => `${vote.from}->${vote.to}`).join(',')}=>${v.eliminated}号出局`
    ).join(';') : '无';

    const targetNight = phase === 'night' ? dayCount - 1 : dayCount;
    let lastNightInfo;
    if (targetNight < 1) {
        lastNightInfo = `昨晚: 无 (首夜)`;
    } else {
        const lastNightDeaths = deathHistory.filter(d => d.day === targetNight && d.phase === '夜');
        lastNightInfo = lastNightDeaths.length > 0
            ? `昨晚(第${targetNight}夜)死亡: ${lastNightDeaths.map(d => `${d.playerId}号`).join(',')}`
            : `昨晚(第${targetNight}夜): 平安夜(无人死亡)`;
    }

    const priorDeaths = deathHistory.filter(d => d.day < targetNight || (d.day === targetNight && d.phase !== '夜'))
        .map(d => `D${d.day}${d.phase}: ${d.playerId}号${d.cause}`).join(';');
    
    // For buildPrivateRoleInfo compatibility
    const gameStateForRole = {
        players,
        seerChecks: gameState.seerChecks,
        nightDecisions: gameState.nightDecisions,
        witchHistory: gameState.witchHistory,
        guardHistory: gameState.guardHistory,
        dayCount
    };

    return {
        aliveList,
        deadList,
        todaySpeeches,
        historySpeeches,
        voteInfo,
        deathInfo: `${lastNightInfo}; 历史死亡:${priorDeaths}`,
        lastNightInfo,
        dayCount,
        phase,
        aliveIdsString: alivePlayers.map(p => p.id).join(','),
        gameStateForRole // Cached for helper
    };
};

// --- PUBLIC API ---

export const generateSystemPrompt = (player, gameState) => {
    const ctx = prepareGameContext(gameState);
    const roleInfo = buildPrivateRoleInfo(player, ctx.gameStateForRole);
    const roleStrategy = buildRoleStrategy(player, ctx.dayCount);
    
    // Check if first speaker
    const isFirstSpeaker = ctx.dayCount === 1 && (!ctx.todaySpeeches || ctx.todaySpeeches.trim() === '');
    const rules = buildGameTheoryRules(isFirstSpeaker, player.role, ctx.aliveIdsString);

    return `你是[${player.id}号]，身份【${player.role}】。性格:${player.personality?.traits || '普通'}
【游戏状态】第${ctx.dayCount}天
【你的状态】存活
【场上存活】${ctx.aliveList}
${roleInfo}
${roleStrategy}
${rules}
${TERMINOLOGY}
输出JSON`;
};

export const generateUserPrompt = (actionType, gameState, params = {}) => {
    const ctx = prepareGameContext(gameState);
    const { players } = gameState; 

    // Base context block included in most prompts
    const baseContext = `第${ctx.dayCount}天${ctx.phase}。
【今日发言(不能重复)】\n${ctx.todaySpeeches || '暂无'}\n
【历史发言摘要】\n${ctx.historySpeeches || '暂无'}\n
【昨夜情况】${ctx.lastNightInfo}\n
【历史死亡】${ctx.deathInfo.split(';')[1] || '无'}\n
【投票记录】${ctx.voteInfo}\n`;

    switch (actionType) {
        case PROMPT_ACTIONS.DAY_SPEECH:
            return `${baseContext}
任务:白天发言。
输出JSON:{"speech":"内容(40-60字，必须包含投票意向)","summary":"发言摘要(15字内，用于公共发言池记录)","voteIntention":数字(投票目标的号码)}`;

        case PROMPT_ACTIONS.NIGHT_GUARD:
            const { cannotGuard } = params;
            const aliveStr = players.filter(p => p.isAlive).map(p => p.id).join(',');
            const hint = ctx.dayCount === 1 ? '首夜建议空守避免同守同救。' : '';
            return `守卫选择。${hint}存活:${aliveStr}。${cannotGuard !== null ? `禁守${cannotGuard}号。` : ''}输出:{"targetId":数字或null}`;

        case PROMPT_ACTIONS.NIGHT_WOLF:
             const validTargets = players.filter(p => p.isAlive && p.role !== '狼人').map(p => p.id).join(',');
             return `狼人袭击。可选:${validTargets}。输出:{"targetId":数字}`;

        case PROMPT_ACTIONS.NIGHT_SEER:
             const { validTargets: seerTargets } = params;
             return `预言家查验。可验:${seerTargets?.join(',') || '无'}。输出:{"targetId":数字}`;

        case PROMPT_ACTIONS.NIGHT_WITCH:
             const { dyingId, canSave, hasPoison } = params; 
             const hintFirstNight = ctx.dayCount === 1 ? '首夜通常使用解药救人。' : '';
             const extra = `${hintFirstNight}被刀:${dyingId !== null ? dyingId + '号' : '无'}。解药:${canSave ? '可用' : '无'}。毒药:${hasPoison ? '可用' : '无'}。不能同时用两药。`;
             return `女巫决策。${extra}输出:{"useSave":true/false,"usePoison":数字或null}`;
             
        case PROMPT_ACTIONS.DAY_VOTE:
             const { validTargets: voteTargets, seerConstraint, lastVoteIntention } = params;
             const intentionReminder = lastVoteIntention ? `你刚才在发言中表示想投 ${lastVoteIntention} 号。` : '';
             
             return `投票放逐阶段。
【存活可投】${voteTargets.join(',')}号(不能投自己)。
${intentionReminder}
${seerConstraint || ''}

【投票逻辑推演】
1. 回顾你的发言意向（${lastVoteIntention || '无'}），保持言行一致，除非有突发情况。
2. 分析场上局势，如果是好人，确保不分票；如果是狼人，计算冲票收益。

输出JSON格式:
{"reasoning":"一句话分析(如:言行一致投X，或 听了Y发言觉得更像狼改投Y)","targetId":数字}`;

        case PROMPT_ACTIONS.HUNTER_SHOOT:
             const { aliveTargets } = params;
             return `你是猎人，选择开枪目标或不开枪。可选:${aliveTargets.join(',')}。输出:{"shoot":true/false,"targetId":数字或null}`;

        default:
            return `任务: ${actionType}`; 
    }
};