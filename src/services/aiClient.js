// AI client utilities extracted from App
// Responsibilities: JSON parsing robustness and LLM fetching with retry/blacklist.

export const safeParseJSON = (text) => {
  if (!text) return null;
  const trimmed = text.replace(/```json\n?|\n?```/g, '').trim();
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) return null;

  const jsonString = trimmed.slice(first, last + 1);

  try {
    return JSON.parse(jsonString);
  } catch (err) {
    try {
      // Fix common Chinese quote issues inside text
      const repaired = jsonString.replace(/([\u4e00-\u9fa5])"([\u4e00-\u9fa5])/g, '$1\\"$2');
      return JSON.parse(repaired);
    } catch (retryErr) {
      console.warn('JSON parse failed, raw snippet:', trimmed);
      return null;
    }
  }
};

const siliconflowModelToConfig = (modelId) => {
  const lastSegment = String(modelId || '').split('/').pop() || String(modelId || '');
  const looksLikeThinking = /thinking|reason|r1/i.test(lastSegment) || /thinking|reason|r1/i.test(String(modelId || ''));

  return {
    id: modelId,
    name: lastSegment,
    options: looksLikeThinking
      ? { enable_thinking: true, thinking_budget: 4096, temperature: 0.7, top_p: 0.7 }
      : { temperature: 0.7, top_p: 0.7 },
    isThinking: looksLikeThinking
  };
};

export const fetchSiliconFlowChatModels = async ({ apiKey }) => {
  if (!apiKey) return [];

  try {
    const response = await fetch('https://api.siliconflow.cn/v1/models?sub_type=chat', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      console.warn('[SiliconFlow] Failed to load model list:', response.status);
      return [];
    }

    const data = await response.json();
    const ids = (data?.data || [])
      .map((m) => m?.id)
      .filter(Boolean);

    // De-dup and convert to app config shape
    const uniqueIds = Array.from(new Set(ids));
    return uniqueIds.map(siliconflowModelToConfig);
  } catch (err) {
    console.warn('[SiliconFlow] Model list request failed:', err);
    return [];
  }
};

export const fetchLLM = async (
  { player, prompt, systemInstruction, retries = 3, backoff = 2000, forcedModelIndex = null },
  { API_URL, API_KEY, AI_MODELS, disabledModelsRef }
) => {
  const defaultModelIndex = player ? player.id % AI_MODELS.length : 0;
  let modelIndex = forcedModelIndex !== null ? forcedModelIndex : defaultModelIndex;

  // Skip blacklisted models
  let attempts = 0;
  while (disabledModelsRef.current.has(modelIndex) && attempts < AI_MODELS.length) {
    modelIndex = (modelIndex + 1) % AI_MODELS.length;
    attempts++;
  }

  // If all models are blocked, reset blacklist to avoid deadlock
  if (attempts >= AI_MODELS.length) {
    console.warn('[API] 所有模型均被禁用(429)，重置黑名单。');
    disabledModelsRef.current.clear();
  }

  const modelConfig = AI_MODELS[modelIndex];

  let requestOptions = { ...modelConfig.options };
  if (requestOptions.extra_body) {
    const { extra_body, ...rest } = requestOptions;
    requestOptions = { ...rest, ...extra_body };
  }

  const payload = {
    model: modelConfig.id,
    messages: [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: prompt }
    ],
    ...requestOptions
  };

  const startTime = Date.now();
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const duration = Date.now() - startTime;
    console.log(`[API Call] Player: ${player ? player.id : 'System'}, Model: ${modelConfig.id}, Duration: ${duration}ms, Forced: ${forcedModelIndex !== null}`);

    if (!response.ok) {
      if (response.status === 429 || response.status === 426) {
        throw new Error(`RunningModel: ${modelConfig.id} failed with ${response.status} ${response.status === 429 ? 'Too Many Requests' : 'Upgrade Required'}`);
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();

    const content = result.choices?.[0]?.message?.content;
    const parsed = safeParseJSON(content);
    
    if (!parsed) {
      throw new Error('RunningModel: Invalid JSON response');
    }
    
    return parsed;
  } catch (error) {
    console.error(`LLM Fetch Error [Model: ${modelConfig.id}]:`, error);

    // 检测各种错误类型
    const isRateLimit = error.message.includes('429') || error.message.includes('Too Many Requests');
    const isUpgradeRequired = error.message.includes('426') || error.message.includes('Upgrade Required');
    const isNetworkError = error.message.includes('fetch') || error.message.includes('network');
    const isHTTPError = error.message.includes('HTTP error');
    
    // 任何错误都需要切换模型，包括网络错误、解析错误、超时等
    const shouldFallback = true;

    if (retries > 0) {
      let nextModelIndex = modelIndex;
      let nextBackoff = backoff;
      let delay = 500;

      // 任何错误都立即切换模型并重试
      const errorType = isRateLimit ? '429限流' 
        : isUpgradeRequired ? '426不可用' 
        : isNetworkError ? '网络错误'
        : isHTTPError ? 'HTTP错误'
        : '未知错误';
      
      console.warn(`[${errorType}] 模型 ${modelConfig.id} 遇到问题，加入黑名单。`);
      disabledModelsRef.current.add(modelIndex);
      
      // 切换到下一个可用模型
      nextModelIndex = (modelIndex + 1) % AI_MODELS.length;
      let switchAttempts = 0;
      while (disabledModelsRef.current.has(nextModelIndex) && switchAttempts < AI_MODELS.length) {
        nextModelIndex = (nextModelIndex + 1) % AI_MODELS.length;
        switchAttempts++;
      }
      
      // 如果所有模型都被禁用，清空黑名单重新开始
      if (switchAttempts >= AI_MODELS.length) {
        console.warn('[API] 所有模型均已失败，清空黑名单重新尝试。');
        disabledModelsRef.current.clear();
        nextModelIndex = (modelIndex + 1) % AI_MODELS.length;
      }
      
      console.warn(`[自动切换] 切换到模型索引 ${nextModelIndex}: ${AI_MODELS[nextModelIndex]?.name || 'unknown'}`);
      console.log(`[上下文保持] Player: ${player?.id}, 角色: ${player?.role}, 提示词和历史信息已自动传递到新模型`);
      
      await new Promise((res) => setTimeout(res, delay));
      
      // 重要：传递所有原始参数（player, prompt, systemInstruction）确保上下文完整
      return fetchLLM(
        { 
          player, 
          prompt, 
          systemInstruction, 
          retries: retries - 1, 
          backoff: nextBackoff, 
          forcedModelIndex: nextModelIndex 
        },
        { API_URL, API_KEY, AI_MODELS, disabledModelsRef }
      );
    }
    
    // 重试次数用尽
    console.error(`[失败] 所有重试均失败，Player: ${player?.id}, 角色: ${player?.role}`);
    return null;
  }
};
