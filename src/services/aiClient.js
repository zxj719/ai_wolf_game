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

// 全局 AbortController，用于在页面关闭时取消所有请求
let globalAbortController = null;

/**
 * 获取或创建全局 AbortController
 */
export const getAbortController = () => {
  if (!globalAbortController) {
    globalAbortController = new AbortController();
  }
  return globalAbortController;
};

/**
 * 取消所有正在进行的 API 请求
 */
export const abortAllRequests = () => {
  if (globalAbortController) {
    globalAbortController.abort();
    globalAbortController = null;
  }
};

/**
 * 重置 AbortController（用于新游戏）
 */
export const resetAbortController = () => {
  globalAbortController = new AbortController();
};

/**
 * 判定端点是否为 Anthropic 兼容（MiniMax /anthropic/v1/messages 等）
 */
const isAnthropicEndpoint = (url) => /\/anthropic\/v\d+\/messages/.test(String(url || ''));

/**
 * 构造 Anthropic 格式请求体：system 顶层、messages 只含 user/assistant、max_tokens 必填
 * 把 modelConfig.options 里可映射的字段原样透传（temperature/top_p/max_tokens）
 */
const buildAnthropicPayload = (modelConfig, systemInstruction, prompt) => {
  const opts = modelConfig.options || {};
  // 禁止把 OpenAI 专属字段泄进来（response_format/extra_body 等）
  const { temperature, top_p, max_tokens = 4096, top_k } = opts;
  const payload = {
    model: modelConfig.id,
    system: systemInstruction,
    messages: [{ role: 'user', content: prompt }],
    max_tokens,
  };
  if (typeof temperature === 'number') payload.temperature = temperature;
  if (typeof top_p === 'number') payload.top_p = top_p;
  if (typeof top_k === 'number') payload.top_k = top_k;
  return payload;
};

/**
 * 从 Anthropic 响应中抽文本：content 是数组，取 type=text 的 text 字段
 */
const extractAnthropicContent = (result) => {
  const blocks = Array.isArray(result?.content) ? result.content : [];
  return blocks
    .filter(b => b && b.type === 'text' && typeof b.text === 'string')
    .map(b => b.text)
    .join('\n');
};

export const fetchLLM = async (
  { player, prompt, systemInstruction, retries = 3, backoff = 2000, forcedModelIndex = null, signal = null },
  { API_URL, API_KEY, AI_MODELS, disabledModelsRef }
) => {
  if (!API_URL) return null;
  // 使用传入的 signal 或全局 controller 的 signal
  const abortSignal = signal || getAbortController().signal;
  // 等概率选择模型（随机）而不是基于玩家ID
  // 这样可以确保每个模型都有相同的机会被选中
  const defaultModelIndex = forcedModelIndex !== null
    ? forcedModelIndex
    : Math.floor(Math.random() * AI_MODELS.length);
  let modelIndex = defaultModelIndex;

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
  const useAnthropic = isAnthropicEndpoint(API_URL);

  let requestOptions = { ...modelConfig.options };
  if (requestOptions.extra_body) {
    const { extra_body, ...rest } = requestOptions;
    requestOptions = { ...rest, ...extra_body };
  }

  const payload = useAnthropic
    ? buildAnthropicPayload(modelConfig, systemInstruction, prompt)
    : {
        model: modelConfig.id,
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: prompt }
        ],
        ...requestOptions
      };

  // MiniMax Anthropic-compat endpoint 不要求 anthropic-version 头
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${API_KEY}`,
  };

  const startTime = Date.now();
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: abortSignal
    });

    const duration = Date.now() - startTime;
    console.log(`[API Call] Player: ${player ? player.id : 'System'}, Model: ${modelConfig.id}, Duration: ${duration}ms, Forced: ${forcedModelIndex !== null}`);

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      const err = new Error(`HTTP ${response.status} [${modelConfig.id}]: ${bodyText.slice(0, 200)}`);
      err.status = response.status;
      throw err;
    }
    const result = await response.json();

    const content = useAnthropic
      ? extractAnthropicContent(result)
      : result.choices?.[0]?.message?.content;
    const parsed = safeParseJSON(content);

    if (!parsed) {
      const err = new Error(`Invalid JSON response [${modelConfig.id}]`);
      err.kind = 'parse';
      throw err;
    }

    // 返回解析结果 + 模型信息（用于统计）
    return {
      ...parsed,
      _modelInfo: {
        modelId: modelConfig.id,
        modelName: modelConfig.name,
        modelIndex: modelIndex
      }
    };
  } catch (error) {
    // 检测是否是用户主动取消（页面关闭）
    if (error.name === 'AbortError') {
      console.log(`[API] 请求被取消 (Player: ${player?.id})`);
      return null;
    }

    console.error(`LLM Fetch Error [Model: ${modelConfig.id}]:`, error);

    // 错误分类：不同错误需要不同的处理策略，盲目切模型重试会浪费配额和时间
    const status = error.status || 0;
    const kind = error.kind
      || (status === 429 || status === 426 ? 'rate_limit'
        : status === 401 || status === 403 ? 'auth'
        : status >= 500 ? 'server'
        : status >= 400 ? 'bad_request'
        : 'network');

    // 鉴权失败对所有模型都成立，重试/切换没有意义，快速失败
    if (kind === 'auth') {
      console.error(`[鉴权失败] HTTP ${status}，API Key 无效或无权限，停止重试。`);
      return null;
    }

    if (retries > 0) {
      // 各类错误的策略：
      // rate_limit  - 该模型配额耗尽：拉黑 + 切模型
      // bad_request - 同一 payload 在该模型上大概率再次失败（参数不支持/超限）：拉黑 + 切模型
      // parse       - 输出格式坏，可能是采样噪声：切模型但不拉黑
      // server      - 网关/上游瞬时故障：切模型但不拉黑，指数退避
      // network     - 端点不可达，切模型无济于事：同模型指数退避重试
      const shouldBlacklist = kind === 'rate_limit' || kind === 'bad_request';
      const shouldSwitch = kind !== 'network';
      const delay = (kind === 'server' || kind === 'network') ? backoff : 500;
      const nextBackoff = Math.min(backoff * 2, 16000);

      const errorType = { rate_limit: '429限流', bad_request: '请求被拒', parse: 'JSON解析失败', server: '上游5xx', network: '网络错误' }[kind];
      console.warn(`[${errorType}] 模型 ${modelConfig.id}，策略：拉黑=${shouldBlacklist}，切换=${shouldSwitch}，退避=${delay}ms`);

      if (shouldBlacklist) disabledModelsRef.current.add(modelIndex);

      let nextModelIndex = modelIndex;
      if (shouldSwitch) {
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
      }

      await new Promise((res) => setTimeout(res, delay));

      // 重要：传递所有原始参数（player, prompt, systemInstruction）确保上下文完整
      return fetchLLM(
        {
          player,
          prompt,
          systemInstruction,
          retries: retries - 1,
          backoff: nextBackoff,
          forcedModelIndex: nextModelIndex,
          signal: abortSignal
        },
        { API_URL, API_KEY, AI_MODELS, disabledModelsRef }
      );
    }
    
    // 重试次数用尽
    console.error(`[失败] 所有重试均失败，Player: ${player?.id}, 角色: ${player?.role}`);
    return null;
  }
};
