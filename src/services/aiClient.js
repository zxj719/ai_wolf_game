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
        console.warn(`[429 封禁] 模型 ${modelConfig.id} 触发限流，已加入黑名单。`);
        disabledModelsRef.current.add(modelIndex);
        nextModelIndex = (modelIndex + 1) % AI_MODELS.length;
        nextBackoff = 1000;
        delay = 500;
        console.warn(`[429 自动切换] 切换到索引 ${nextModelIndex} (将在执行时验证 availability)`);
        await new Promise((res) => setTimeout(res, delay));
        return fetchLLM(
          { player, prompt, systemInstruction, retries: retries - 1, backoff: nextBackoff, forcedModelIndex: nextModelIndex },
          { API_URL, API_KEY, AI_MODELS, disabledModelsRef }
        );
      }

      console.log(`等待${delay}ms后重试... (剩余重试次数: ${retries})`);
      await new Promise((res) => setTimeout(res, delay));
      return fetchLLM(
        { player, prompt, systemInstruction, retries: retries - 1, backoff: backoff * 2, forcedModelIndex },
        { API_URL, API_KEY, AI_MODELS, disabledModelsRef }
      );
    }
    return null;
  }
};
