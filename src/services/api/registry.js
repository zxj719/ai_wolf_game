/**
 * 后端注册表 — 允许模块声明自己依赖的后端（'cf-workers' / 'aliyun-ecs' / …）
 *
 * Rationale：目前所有 API 走 Cloudflare Workers（zhaxiaoji.com）。未来狼人杀的
 * AI 推理、小说模块的重算场景可能迁到阿里云 ECS。本文件提供"后端 key → baseUrl"
 * 的查找，模块代码不关心具体部署位置——上线时切换 .env 即可。
 */

const BACKENDS = {
  'cf-workers': {
    baseUrl: import.meta.env.VITE_CF_API ?? import.meta.env.VITE_AUTH_API_URL ?? '',
    auth: 'jwt',
    description: 'Cloudflare Workers + D1 (主栈)',
  },
  'aliyun-ecs': {
    baseUrl: import.meta.env.VITE_ECS_API ?? '',
    auth: 'jwt',
    description: '阿里云 ECS (预留，未部署)',
  },
};

export const DEFAULT_BACKEND = 'cf-workers';

export function getBackend(key = DEFAULT_BACKEND) {
  return BACKENDS[key] ?? BACKENDS[DEFAULT_BACKEND];
}

export function listBackends() {
  return Object.entries(BACKENDS).map(([key, value]) => ({
    key,
    baseUrl: value.baseUrl,
    available: Boolean(value.baseUrl),
    description: value.description,
  }));
}
