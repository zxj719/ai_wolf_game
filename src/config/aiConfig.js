// AI and API configuration
export const API_KEY = 'ms-b341776e-11ee-40fc-9ab8-42154ff1b42d';
export const API_URL = 'https://api-inference.modelscope.cn/v1/chat/completions';

// Model pool for load balancing
export const AI_MODELS = [
  { id: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-32B', options: { response_format: { type: 'json_object' } } },
  { id: 'Qwen/Qwen2.5-72B-Instruct', options: { } },
  { id: 'deepseek-ai/DeepSeek-V3.2', options: { extra_body: { enable_thinking: true } } },
  { id: 'MiniMax/MiniMax-M1-80k', options: { } },
  { id: 'Qwen/Qwen3-235B-A22B', options: { extra_body: { enable_thinking: true } } },
  { id: 'Qwen/Qwen3-Coder-480B-A35B-Instruct', options: { response_format: { type: 'json_object' } } },
  { id: 'Qwen/Qwen3-235B-A22B-Instruct-2507', options: { response_format: { type: 'json_object' } } },
  { id: 'Qwen/Qwen3-235B-A22B-Thinking-2507', options: { } },
  { id: 'Qwen/Qwen2.5-32B-Instruct', options: { } }
];
