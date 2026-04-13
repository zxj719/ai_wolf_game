/**
 * 模块注册表 — 个人主页平台的"模块总线"。
 *
 * 每个模块在 modules/<name>/index.js 默认导出一个 ModuleDescriptor：
 *
 *   export default {
 *     id: 'werewolf',
 *     title: { zh: '狼人杀', en: 'Werewolf' },
 *     blurb: { zh: '...', en: '...' },
 *     icon: SomeIcon,
 *     theme: 'dark',              // 'light' | 'dark'
 *     backend: 'cf-workers',      // services/api/registry.js 中的 key
 *     routes: [
 *       { path: '/werewolf',       component: lazy(...), requiresAuth: false },
 *       { path: '/werewolf/setup', component: lazy(...), requiresAuth: true  },
 *       { path: '/werewolf/play',  component: lazy(...), requiresAuth: true,
 *         onLeave: (ctx) => ctx.module.endGame() },
 *     ],
 *     home: { visible: true, order: 10 },
 *   };
 *
 * 新增模块 = 1 个目录 + 在 modules 数组加一行。Router/Home 自动接管。
 *
 * Phase 2a 起：数组先保持空，Phase 3/4 逐个加入真实 module。
 */

const modules = [];

export default modules;

/**
 * 根据路径找到匹配的 { module, route }。
 */
export function findRoute(normalizedPath) {
  for (const mod of modules) {
    for (const route of mod.routes ?? []) {
      if (route.path === normalizedPath) {
        return { module: mod, route };
      }
    }
  }
  return null;
}

/**
 * Home 卡片墙 — 返回应该显示的模块列表，按 order 升序。
 */
export function homeCards() {
  return modules
    .filter((m) => m.home?.visible !== false)
    .slice()
    .sort((a, b) => (a.home?.order ?? 999) - (b.home?.order ?? 999));
}

/**
 * 调试工具：列出已注册的 module ids。
 */
export function listModules() {
  return modules.map((m) => m.id);
}
