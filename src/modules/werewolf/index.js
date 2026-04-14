import { lazy } from 'react';
import { ROUTES } from '../../shell/paths';

const WerewolfModule = lazy(() => import('./WerewolfModule'));

/**
 * 狼人杀模块 ModuleDescriptor。
 *
 * 3 条路由 (hub/setup/play) 都指向同一个 WerewolfModule 组件 —— 组件
 * 元素类型不变 → 跨路径切换不会 unmount，游戏状态（players/phase/...)
 * 在 setup→play 过程中自动保留。内部按 currentPath 渲染对应子视图。
 *
 * 离开 /werewolf/* 的清理由 WerewolfModule 自身的 useEffect 卸载钩子
 * 兜底，不依赖 descriptor.onLeave（避免跨组件可变 runtime handle）。
 */
const werewolfModule = {
  id: 'werewolf',
  title: { zh: '狼人杀', en: 'Werewolf' },
  blurb: {
    zh: 'AI 多智能体狼人杀游戏',
    en: 'AI multi-agent werewolf game',
  },
  theme: 'dark',
  backend: 'cf-workers',
  routes: [
    { path: ROUTES.WEREWOLF,       component: WerewolfModule, requiresAuth: false },
    { path: ROUTES.WEREWOLF_SETUP, component: WerewolfModule, requiresAuth: true  },
    { path: ROUTES.WEREWOLF_PLAY,  component: WerewolfModule, requiresAuth: true  },
  ],
  home: { visible: true, order: 10 },
};

export default werewolfModule;
