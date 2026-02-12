// AI and API configuration
// NOTE: Do NOT hardcode API keys in source. Use Vite env vars instead.
//
// Supported providers:
// - modelscope (legacy default)
// - siliconflow
export const AI_PROVIDER = import.meta.env.VITE_AI_PROVIDER || 'modelscope';

// Provider-specific keys
export const MODELSCOPE_API_KEY = import.meta.env.VITE_API_KEY || '';
export const SILICONFLOW_API_KEY = import.meta.env.VITE_SILICONFLOW_API_KEY || '';

// Provider-specific URLs
export const MODELSCOPE_API_URL = import.meta.env.VITE_API_URL || 'https://api-inference.modelscope.cn/v1/chat/completions';
export const SILICONFLOW_API_URL = import.meta.env.VITE_SILICONFLOW_API_URL || 'https://api.siliconflow.cn/v1/chat/completions';

// Back-compat exports used by the app
export const API_KEY = AI_PROVIDER === 'siliconflow' ? SILICONFLOW_API_KEY : MODELSCOPE_API_KEY;
export const API_URL = AI_PROVIDER === 'siliconflow' ? SILICONFLOW_API_URL : MODELSCOPE_API_URL;

// Warn if API key is missing (development aid)
if (!API_KEY && typeof window !== 'undefined') {
  const hint = AI_PROVIDER === 'siliconflow' ? 'VITE_SILICONFLOW_API_KEY' : 'VITE_API_KEY';
  console.warn(`[Config] ${hint} is not set. Please check your env vars.`);
}

// ============================================
// 模型分类说明:
// 1. THINKING_MODELS: 带推理能力的模型 (>32B)，用于AI角色扮演（需要深度思考）
// 2. INSTRUCT_MODELS: 指令微调模型，用于总结历史发言等简单任务
// ============================================

// Thinking Models (>32B) - 用于AI角色的推理决策
export const THINKING_MODELS = [
  // DeepSeek R1 系列 - 顶级推理模型
  { 
    id: 'deepseek-ai/DeepSeek-R1-0528', 
    name: 'DeepSeek-R1-0528 (684B)',
    options: { 
      temperature: 0.6,
      top_p: 0.95
    },
    isThinking: true
  },
  // QwQ - 32B 推理模型
  { 
    id: 'Qwen/QwQ-32B', 
    name: 'QwQ-32B (Reasoning)',
    options: { 
      temperature: 0.6,
      top_p: 0.95,
      top_k: 20
    },
    isThinking: true
  },
  // Qwen3 Thinking 系列
  { 
    id: 'Qwen/Qwen3-235B-A22B-Thinking-2507', 
    name: 'Qwen3-235B-Thinking',
    options: { 
      temperature: 0.6,
      top_p: 0.95
    },
    isThinking: true
  },
  // Qwen3-Next 80B - 新一代混合注意力 Thinking 模型
  { 
    id: 'Qwen/Qwen3-Next-80B-A3B-Thinking', 
    name: 'Qwen3-Next-80B-Thinking',
    options: { 
      temperature: 0.6,
      top_p: 0.95,
      top_k: 20
    },
    isThinking: true
  },
  // Qwen3-30B Thinking - 轻量 Thinking 模型
  { 
    id: 'Qwen/Qwen3-30B-A3B-Thinking-2507', 
    name: 'Qwen3-30B-Thinking',
    options: { 
      temperature: 0.6,
      top_p: 0.95
    },
    isThinking: true
  },
  // 小米 MiMo-V2-Flash - 309B 超大规模推理模型
  { 
    id: 'XiaomiMiMo/MiMo-V2-Flash', 
    name: 'MiMo-V2-Flash (309B)',
    options: { 
      temperature: 0.8,
      top_p: 0.95
    },
    isThinking: true
  },
  // 智谱 GLM-4.7 Flash - 快速推理模型
  {
    id: 'ZhipuAI/GLM-4.7-Flash',
    name: 'GLM-4.7-Flash',
    options: {
      temperature: 0.7,
      top_p: 0.9
    },
    isThinking: true
  },
  // 智谱 GLM-4.7 - 标准推理模型
  {
    id: 'ZhipuAI/GLM-4.7',
    name: 'GLM-4.7',
    options: {
      temperature: 0.7,
      top_p: 0.9
    },
    isThinking: true
  },
  // 智谱 GLM-5 - 最新旗舰推理模型
  {
    id: 'ZhipuAI/GLM-5',
    name: 'GLM-5',
    options: {
      temperature: 0.7,
      top_p: 0.9
    },
    isThinking: true
  },
  // 美团 LongCat Flash Lite - 轻量快速模型
  {
    id: 'meituan-longcat/LongCat-Flash-Lite',
    name: 'LongCat-Flash-Lite',
    options: {
      temperature: 0.7,
      top_p: 0.9
    },
    isThinking: false
  },
  // DeepSeek R1 蒸馏版
  { 
    id: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-32B', 
    name: 'DeepSeek-R1-Distill-32B',
    options: { 
      response_format: { type: 'json_object' }
    },
    isThinking: true
  },
  // DeepSeek V3.2 with thinking
  { 
    id: 'deepseek-ai/DeepSeek-V3.2', 
    name: 'DeepSeek-V3.2 (Thinking)',
    options: { 
      extra_body: { enable_thinking: true }
    },
    isThinking: true
  },
  // Qwen3 with thinking enabled
  { 
    id: 'Qwen/Qwen3-235B-A22B', 
    name: 'Qwen3-235B-A22B',
    options: { 
      extra_body: { enable_thinking: true }
    },
    isThinking: true
  }
];

// Instruct Models - 用于总结历史发言等任务（也作为Thinking模型的备用）
export const INSTRUCT_MODELS = [
  { 
    id: 'Qwen/Qwen3-Coder-480B-A35B-Instruct', 
    name: 'Qwen3-Coder-480B',
    options: { 
      response_format: { type: 'json_object' }
    },
    isThinking: false
  },
  { 
    id: 'Qwen/Qwen3-235B-A22B-Instruct-2507', 
    name: 'Qwen3-235B-Instruct',
    options: { 
      response_format: { type: 'json_object' }
    },
    isThinking: false
  },
  // ERNIE 4.5 - 百度文心大模型
  { 
    id: 'PaddlePaddle/ERNIE-4.5-300B-A47B-PT', 
    name: 'ERNIE-4.5-300B',
    options: {},
    isThinking: false
  },
  // Mistral Large - 123B 参数
  { 
    id: 'mistralai/Mistral-Large-Instruct-2407', 
    name: 'Mistral-Large-123B',
    options: {},
    isThinking: false
  },
  // Llama 4 Maverick - Meta 最新模型
  { 
    id: 'LLM-Research/Llama-4-Maverick-17B-128E-Instruct', 
    name: 'Llama-4-Maverick-400B',
    options: {},
    isThinking: false
  },
  // Command R+ - Cohere 对话模型
  { 
    id: 'LLM-Research/c4ai-command-r-plus-08-2024', 
    name: 'Command-R-Plus-104B',
    options: {},
    isThinking: false
  },
  { 
    id: 'Qwen/Qwen2.5-72B-Instruct', 
    name: 'Qwen2.5-72B-Instruct',
    options: {},
    isThinking: false
  },
  { 
    id: 'Qwen/Qwen2.5-32B-Instruct', 
    name: 'Qwen2.5-32B-Instruct',
    options: {},
    isThinking: false
  },
  { 
    id: 'MiniMax/MiniMax-M1-80k', 
    name: 'MiniMax-M1-80k',
    options: {},
    isThinking: false
  }
];

// SiliconFlow fallback chat models.
// The full available model set is best retrieved dynamically via GET https://api.siliconflow.cn/v1/models?sub_type=chat.
// These are only used when SiliconFlow is selected but the model list cannot be loaded.
export const SILICONFLOW_FALLBACK_MODELS = [
  {
    id: 'deepseek-ai/DeepSeek-R1-0528-Qwen3-8B',
    name: 'DeepSeek-R1-0528-Qwen3-8B',
    options: { enable_thinking: true, thinking_budget: 4096, temperature: 0.6, top_p: 0.95 },
    isThinking: true
  },
  {
    id: 'Qwen/Qwen3-8B',
    name: 'Qwen3-8B',
    options: { enable_thinking: true, thinking_budget: 4096, temperature: 0.7, top_p: 0.7 },
    isThinking: true
  },
  {
    id: 'THUDM/GLM-Z1-9B-0414',
    name: 'GLM-Z1-9B-0414',
    options: { temperature: 0.7, top_p: 0.7 },
    isThinking: false
  },
  {
    id: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B',
    name: 'DeepSeek-R1-Distill-Qwen-7B',
    options: { enable_thinking: true, thinking_budget: 4096, temperature: 0.6, top_p: 0.95 },
    isThinking: true
  },
  {
    id: 'zai-org/GLM-4.6',
    name: 'GLM-4.6',
    options: { temperature: 0.7, top_p: 0.7 },
    isThinking: false
  },
  {
    id: 'deepseek-ai/DeepSeek-V3.2-Exp',
    name: 'DeepSeek-V3.2-Exp',
    options: { temperature: 0.7, top_p: 0.7 },
    isThinking: false
  },
  {
    id: 'moonshotai/Kimi-K2-Instruct-0905',
    name: 'Kimi-K2-Instruct',
    options: { temperature: 0.7, top_p: 0.7 },
    isThinking: false
  },
  {
    id: 'moonshotai/Kimi-K2-Thinking',
    name: 'Kimi-K2-Thinking',
    options: { enable_thinking: true, thinking_budget: 4096, temperature: 0.7, top_p: 0.7 },
    isThinking: true
  },
  {
    id: 'Qwen/Qwen3-32B',
    name: 'Qwen3-32B',
    options: { enable_thinking: true, thinking_budget: 4096, temperature: 0.7, top_p: 0.7 },
    isThinking: true
  }
];

// 合并的模型列表 (兼容原有代码)
// Thinking models 优先，用于角色扮演
export const AI_MODELS = [...THINKING_MODELS, ...INSTRUCT_MODELS];

// 根据用途获取模型
export const getThinkingModel = (playerIndex = 0) => {
  return THINKING_MODELS[playerIndex % THINKING_MODELS.length];
};

export const getInstructModel = (index = 0) => {
  return INSTRUCT_MODELS[index % INSTRUCT_MODELS.length];
};

