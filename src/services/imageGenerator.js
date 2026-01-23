// Image generation service for player avatars
// Supports multiple providers with automatic fallback
import { MODELSCOPE_API_KEY, SILICONFLOW_API_KEY } from '../config/aiConfig';

// ============================================
// Provider Configuration
// ============================================

const PROVIDERS = {
  // ModelScope - 需要异步模式
  modelscope: {
    name: 'ModelScope',
    baseUrl: 'https://api-inference.modelscope.cn/v1',
    apiKey: MODELSCOPE_API_KEY,
    models: [
      'Tongyi-MAI/Z-Image-Turbo',        // 免费无限调用
      'MusePublic/FLUX.1-Kontext-Dev',   // FLUX 通用模型
      'MusePublic/Qwen-image',           // Qwen 图像模型
    ],
    async: true, // 必须使用异步模式
    pollInterval: 3000, // 轮询间隔 3s
    maxPollAttempts: 30, // 最多轮询 30 次 (90s)
  },

  // SiliconFlow - 同步模式，响应更快
  siliconflow: {
    name: 'SiliconFlow',
    baseUrl: 'https://api.siliconflow.cn/v1',
    apiKey: SILICONFLOW_API_KEY,
    models: [
      'Kwai-Kolors/Kolors',              // 快手 Kolors 模型 (免费)
      'stabilityai/stable-diffusion-3-5-large', // SD 3.5
      'black-forest-labs/FLUX.1-schnell', // FLUX.1 schnell (快速)
    ],
    async: false, // 同步模式
  },
};

// 当前提供商状态
let providerStatus = {
  modelscope: { available: true, failCount: 0, lastError: null },
  siliconflow: { available: true, failCount: 0, lastError: null },
};

// 提供商优先级顺序
let providerOrder = ['siliconflow', 'modelscope']; // 优先使用同步的 SiliconFlow

// ============================================
// Provider Management
// ============================================

/**
 * 重置提供商状态
 */
export const resetProviderStatus = () => {
  providerStatus = {
    modelscope: { available: true, failCount: 0, lastError: null },
    siliconflow: { available: true, failCount: 0, lastError: null },
  };
  console.log('[ImageGen] Provider status reset');
};

/**
 * 标记提供商失败
 */
const markProviderFailed = (providerId, error) => {
  const status = providerStatus[providerId];
  status.failCount++;
  status.lastError = error.message;

  // 连续失败 3 次后暂时禁用
  if (status.failCount >= 3) {
    status.available = false;
    console.warn(`[ImageGen] Provider ${providerId} disabled after ${status.failCount} failures`);

    // 5 分钟后自动重新启用
    setTimeout(() => {
      status.available = true;
      status.failCount = 0;
      console.log(`[ImageGen] Provider ${providerId} re-enabled`);
    }, 5 * 60 * 1000);
  }
};

/**
 * 标记提供商成功
 */
const markProviderSuccess = (providerId) => {
  providerStatus[providerId].failCount = 0;
  providerStatus[providerId].lastError = null;
};

// ============================================
// Image Generation - ModelScope (Async)
// ============================================

/**
 * ModelScope 异步图像生成
 */
const generateWithModelScope = async (prompt, provider) => {
  const model = provider.models[0];

  // 步骤1: 提交异步任务
  console.log(`[ImageGen] Submitting async task to ModelScope: ${model}`);

  const submitResponse = await fetch(`${provider.baseUrl}/images/generations`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${provider.apiKey}`,
      'Content-Type': 'application/json',
      'X-ModelScope-Async-Mode': 'true', // 关键: 启用异步模式
    },
    body: JSON.stringify({
      model: model,
      prompt: prompt,
      size: '512x512',
      n: 1,
    }),
  });

  if (!submitResponse.ok) {
    const errorText = await submitResponse.text();
    throw new Error(`Submit failed: ${submitResponse.status} - ${errorText}`);
  }

  const submitResult = await submitResponse.json();
  const taskId = submitResult.task_id || submitResult.request_id;

  if (!taskId) {
    throw new Error('No task_id in response');
  }

  console.log(`[ImageGen] Task submitted: ${taskId}`);

  // 步骤2: 轮询任务状态
  return await pollModelScopeTask(taskId, provider);
};

/**
 * 轮询 ModelScope 任务状态
 */
const pollModelScopeTask = async (taskId, provider) => {
  for (let i = 0; i < provider.maxPollAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, provider.pollInterval));

    try {
      const response = await fetch(`${provider.baseUrl}/tasks/${taskId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${provider.apiKey}`,
          'X-ModelScope-Task-Type': 'image_generation',
        },
      });

      if (!response.ok) {
        console.warn(`[ImageGen] Poll error: ${response.status}`);
        continue;
      }

      const data = await response.json();
      console.log(`[ImageGen] Task status: ${data.task_status || data.status}`);

      const status = data.task_status || data.status;

      if (status === 'SUCCEED' || status === 'SUCCESS') {
        // 提取图像 URL
        const imageUrl =
          data.output_images?.[0] ||
          data.data?.[0]?.url ||
          data.output?.results?.[0]?.url ||
          data.result?.images?.[0];

        if (imageUrl) {
          return imageUrl;
        }
        throw new Error('No image URL in completed task');
      }

      if (status === 'FAILED' || status === 'FAILURE') {
        throw new Error(`Task failed: ${data.message || 'Unknown error'}`);
      }

      // RUNNING/PENDING - 继续轮询
    } catch (error) {
      console.warn(`[ImageGen] Poll attempt ${i + 1} error:`, error.message);
      if (i === provider.maxPollAttempts - 1) {
        throw error;
      }
    }
  }

  throw new Error('Task polling timeout');
};

// ============================================
// Image Generation - SiliconFlow (Sync)
// ============================================

/**
 * SiliconFlow 同步图像生成
 */
const generateWithSiliconFlow = async (prompt, provider) => {
  // 尝试每个模型直到成功
  for (const model of provider.models) {
    try {
      console.log(`[ImageGen] Generating with SiliconFlow: ${model}`);

      const response = await fetch(`${provider.baseUrl}/images/generations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${provider.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          prompt: prompt,
          image_size: '512x512',
          num_inference_steps: 20,
          batch_size: 1,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[ImageGen] SiliconFlow model ${model} failed: ${response.status}`, errorText);
        continue; // 尝试下一个模型
      }

      const result = await response.json();

      // 提取图像 URL
      const imageUrl =
        result.images?.[0]?.url ||
        result.data?.[0]?.url ||
        result.data?.[0]?.b64_json;

      if (imageUrl) {
        // 如果是 base64，转换为 data URL
        if (result.data?.[0]?.b64_json) {
          return `data:image/png;base64,${result.data[0].b64_json}`;
        }
        return imageUrl;
      }

      console.warn(`[ImageGen] No image URL in response for ${model}`);
    } catch (error) {
      console.warn(`[ImageGen] SiliconFlow model ${model} error:`, error.message);
    }
  }

  throw new Error('All SiliconFlow models failed');
};

// ============================================
// Main Generation Function
// ============================================

/**
 * Generate avatar prompt based on role and personality
 * @param {Object} player - Player object
 * @param {boolean} isUserPlayer - Whether this is the user's player
 * @param {string} gameMode - Game mode: 'ai-only' or 'player'
 */
export const generateAvatarPrompt = (player, isUserPlayer = false, gameMode = 'ai-only') => {
  const nameHint = player?.name ? `Character named ${player.name}. ` : '';
  // 用户玩家使用猫咪头像
  if (isUserPlayer) {
    const personalityMap = {
      'logical': 'A wise gray tabby cat with glasses, intellectual appearance, digital art portrait',
      'aggressive': 'A fierce orange cat with sharp eyes, aggressive stance, digital art portrait',
      'steady': 'A calm white cat with gentle expression, peaceful demeanor, digital art portrait',
      'cunning': 'A sleek black cat with mysterious eyes, cunning look, digital art portrait'
    };

    const personalityType = player.personality?.type || 'steady';
    return `${nameHint}${personalityMap[personalityType] || 'A cute fluffy cat with bright eyes, digital art portrait'}`;
  }

  // 玩家模式：使用中性角色头像，不透露身份
  if (gameMode !== 'ai-only') {
    const neutralPrompts = [
      'A mysterious hooded figure in medieval village, neutral expression, fantasy art portrait',
      'A village elder with wise eyes, wearing simple robes, fantasy portrait',
      'A young traveler with curious eyes, medieval setting, fantasy art portrait',
      'A scholarly figure with quill and book, thoughtful expression, fantasy portrait',
      'A merchant with friendly smile, medieval marketplace background, fantasy portrait',
      'A craftsman with weathered hands, village workshop setting, fantasy portrait',
      'A mysterious stranger with cloak, moonlit village, fantasy art portrait',
      'A village keeper with lantern, twilight atmosphere, fantasy portrait',
      'A wandering bard with lute, medieval tavern background, fantasy portrait',
      'A retired soldier in plain clothes, village square, fantasy portrait'
    ];

    const personalityTraits = {
      'logical': ', analytical and thoughtful expression',
      'aggressive': ', determined and bold expression',
      'steady': ', calm and composed demeanor',
      'cunning': ', perceptive and alert look'
    };

    const personalityType = player.personality?.type || 'steady';
    const trait = personalityTraits[personalityType] || '';
    // 使用玩家ID作为随机种子选择提示词
    const promptIndex = player.id % neutralPrompts.length;
    return `${nameHint}${neutralPrompts[promptIndex]}${trait}, high quality digital art`;
  }

  // AI模式：使用基于角色的头像
  const rolePrompts = {
    '狼人': 'A mysterious wolf character in dark cloak, red glowing eyes, fantasy art style, high quality portrait',
    '预言家': 'A wise elderly fortune teller with crystal ball, mystical aura, starry background, fantasy portrait',
    '女巫': 'A mysterious witch with potion bottles, purple magical aura, fantasy style portrait',
    '猎人': 'A rugged hunter with crossbow, forest background, determined expression, fantasy portrait',
    '守卫': 'A noble knight with shield and sword, protective stance, medieval armor, fantasy portrait',
    '村民': 'A friendly villager in casual clothes, warm smile, village background, fantasy portrait'
  };

  const basePrompt = `${nameHint}${rolePrompts[player.role] || 'A friendly character portrait, fantasy art style'}`;

  const personalityTraits = {
    'logical': ', analytical and serious expression',
    'aggressive': ', fierce and intimidating look',
    'steady': ', calm and composed demeanor',
    'cunning': ', sly and mysterious appearance'
  };

  const personalityType = player.personality?.type || 'steady';
  const trait = personalityTraits[personalityType] || '';

  return `${basePrompt}${trait}, high quality digital art`;
};

/**
 * Generate avatar image for a player with automatic fallback
 */
export const generatePlayerAvatar = async (player, isUserPlayer = false, gameMode = 'ai-only') => {
  const prompt = generateAvatarPrompt(player, isUserPlayer, gameMode);

  // 尝试所有可用的提供商
  for (const providerId of providerOrder) {
    const provider = PROVIDERS[providerId];
    const status = providerStatus[providerId];

    // 跳过不可用或没有 API key 的提供商
    if (!status.available || !provider.apiKey) {
      continue;
    }

    try {
      console.log(`[ImageGen] Trying provider: ${provider.name}`);

      let imageUrl;
      if (providerId === 'modelscope') {
        imageUrl = await generateWithModelScope(prompt, provider);
      } else if (providerId === 'siliconflow') {
        imageUrl = await generateWithSiliconFlow(prompt, provider);
      }

      if (imageUrl) {
        markProviderSuccess(providerId);
        console.log(`[ImageGen] Success with ${provider.name}`);
        return imageUrl;
      }
    } catch (error) {
      console.error(`[ImageGen] ${provider.name} failed:`, error.message);
      markProviderFailed(providerId, error);
      // 继续尝试下一个提供商
    }
  }

  // 所有提供商都失败，使用占位符
  console.warn('[ImageGen] All providers failed, using placeholder');
  return getPlaceholderAvatar(player.role);
};

/**
 * Get placeholder avatar based on role
 */
export const getPlaceholderAvatar = (role) => {
  const placeholders = {
    '狼人': 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="40" fill="%23dc2626"/%3E%3Ctext x="50" y="60" text-anchor="middle" fill="white" font-size="30"%3E🐺%3C/text%3E%3C/svg%3E',
    '预言家': 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="40" fill="%236366f1"/%3E%3Ctext x="50" y="60" text-anchor="middle" fill="white" font-size="30"%3E🔮%3C/text%3E%3C/svg%3E',
    '女巫': 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="40" fill="%239333ea"/%3E%3Ctext x="50" y="60" text-anchor="middle" fill="white" font-size="30"%3E🧙%3C/text%3E%3C/svg%3E',
    '猎人': 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="40" fill="%23ea580c"/%3E%3Ctext x="50" y="60" text-anchor="middle" fill="white" font-size="30"%3E🏹%3C/text%3E%3C/svg%3E',
    '守卫': 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="40" fill="%2315803d"/%3E%3Ctext x="50" y="60" text-anchor="middle" fill="white" font-size="30"%3E🛡️%3C/text%3E%3C/svg%3E',
    '村民': 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="40" fill="%2364748b"/%3E%3Ctext x="50" y="60" text-anchor="middle" fill="white" font-size="30"%3E👤%3C/text%3E%3C/svg%3E',
    'cat': 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="40" fill="%23f59e0b"/%3E%3Ctext x="50" y="60" text-anchor="middle" fill="white" font-size="30"%3E🐱%3C/text%3E%3C/svg%3E'
  };

  return placeholders[role] || placeholders['村民'];
};

/**
 * Generate avatars for all players in batch
 */
export const generateAllPlayerAvatars = async (players, gameMode) => {
  console.log('[ImageGen] Starting batch avatar generation...');
  console.log('[ImageGen] Available providers:',
    providerOrder.filter(id => PROVIDERS[id].apiKey && providerStatus[id].available)
  );

  const promises = players.map(player => {
    const isUserPlayer = player.isUser && gameMode !== 'ai-only';
    return generatePlayerAvatar(player, isUserPlayer, gameMode)
      .then(avatarUrl => ({ ...player, avatarUrl }))
      .catch(err => {
        console.error(`[ImageGen] Failed for player ${player.id}:`, err);
        // 玩家模式下使用中性占位符
        const placeholder = gameMode === 'ai-only' ? getPlaceholderAvatar(player.role) : getPlaceholderAvatar('村民');
        return { ...player, avatarUrl: placeholder };
      });
  });

  const playersWithAvatars = await Promise.all(promises);
  console.log('[ImageGen] Batch generation complete');
  return playersWithAvatars;
};

/**
 * 获取当前提供商状态（调试用）
 */
export const getProviderStatus = () => {
  return Object.entries(providerStatus).map(([id, status]) => ({
    id,
    name: PROVIDERS[id].name,
    hasApiKey: !!PROVIDERS[id].apiKey,
    ...status,
  }));
};

// ============================================
// Game Background Generation
// ============================================

/**
 * 生成游戏主题背景图像
 */
export const generateGameBackground = async () => {
  const themes = [
    'A mysterious medieval village at twilight, fog rolling through cobblestone streets, dark fantasy atmosphere, cinematic lighting, 16:9 aspect ratio, high quality digital art',
    'A dark enchanted forest clearing under moonlight, ancient stones in a circle, werewolf game atmosphere, mystical fog, dark fantasy art style, wide panoramic view',
    'A gothic castle courtyard at night, torches casting shadows, mysterious figures in cloaks, werewolf hunt atmosphere, dark fantasy digital painting, cinematic wide shot',
    'A haunted village square during a full moon night, old European architecture, eerie atmosphere, dark fantasy game background, fog and shadows, ultra wide angle',
    'A mystical forest village at dusk, magical lanterns glowing, secrets and intrigue atmosphere, dark fantasy RPG style, panoramic view, highly detailed'
  ];

  const randomTheme = themes[Math.floor(Math.random() * themes.length)];

  // 尝试所有可用的提供商
  for (const providerId of providerOrder) {
    const provider = PROVIDERS[providerId];
    const status = providerStatus[providerId];

    if (!status.available || !provider.apiKey) {
      continue;
    }

    try {
      console.log(`[ImageGen] Generating background with ${provider.name}`);

      let imageUrl;
      if (providerId === 'modelscope') {
        imageUrl = await generateWithModelScope(randomTheme, provider);
      } else if (providerId === 'siliconflow') {
        imageUrl = await generateBackgroundWithSiliconFlow(randomTheme, provider);
      }

      if (imageUrl) {
        markProviderSuccess(providerId);
        console.log(`[ImageGen] Background generated successfully`);
        return imageUrl;
      }
    } catch (error) {
      console.error(`[ImageGen] Background generation failed with ${provider.name}:`, error.message);
      markProviderFailed(providerId, error);
    }
  }

  // 所有提供商失败，返回默认渐变背景
  console.warn('[ImageGen] All providers failed for background, using default');
  return null;
};

/**
 * SiliconFlow 背景图像生成（更大尺寸）
 */
const generateBackgroundWithSiliconFlow = async (prompt, provider) => {
  for (const model of provider.models) {
    try {
      console.log(`[ImageGen] Generating background with SiliconFlow: ${model}`);

      const response = await fetch(`${provider.baseUrl}/images/generations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${provider.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          prompt: prompt,
          image_size: '1024x576', // 16:9 宽屏背景
          num_inference_steps: 25,
          batch_size: 1,
        }),
      });

      if (!response.ok) {
        console.warn(`[ImageGen] Background model ${model} failed: ${response.status}`);
        continue;
      }

      const result = await response.json();
      const imageUrl =
        result.images?.[0]?.url ||
        result.data?.[0]?.url ||
        result.data?.[0]?.b64_json;

      if (imageUrl) {
        if (result.data?.[0]?.b64_json) {
          return `data:image/png;base64,${result.data[0].b64_json}`;
        }
        return imageUrl;
      }
    } catch (error) {
      console.warn(`[ImageGen] Background model ${model} error:`, error.message);
    }
  }

  throw new Error('All SiliconFlow models failed for background');
};
