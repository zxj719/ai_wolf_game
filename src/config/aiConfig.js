// AI and API configuration
// API_KEY is now loaded from environment variables for security
// In production, set VITE_API_KEY in Cloudflare Pages environment settings
export const API_KEY = import.meta.env.VITE_API_KEY || '';
export const API_URL = import.meta.env.VITE_API_URL || 'https://api-inference.modelscope.cn/v1/chat/completions';

// Warn if API key is missing (development aid)
if (!API_KEY && typeof window !== 'undefined') {
  console.warn('[Config] VITE_API_KEY is not set. Please check your .env file or Cloudflare Pages environment variables.');
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

