import { lazy } from 'react';
import { ROUTES } from '../../shell/paths';

const HomeRoute = lazy(() => import('./HomeRoute'));

/**
 * Home 模块 ModuleDescriptor。
 *
 * Phase 3：仍渲染现有 Dashboard 作过渡。Phase 4 切换为 Registry 驱动的
 * 卡片墙 (HomeModule)，自动聚合所有 `home.visible` 模块的 4 张卡片。
 */
const homeModule = {
  id: 'home',
  title: { zh: '炸小鸡 · 好奇心游乐场', en: 'Zhaxiaoji · A playground for curiosity' },
  blurb: {
    zh: '小说工作台、AI 狼人杀，还有一些正在建设中的好玩东西。',
    en: 'Writing, AI Werewolf, and a few worlds still in the making.',
  },
  theme: 'light',
  backend: 'cf-workers',
  routes: [
    { path: ROUTES.HOME, component: HomeRoute, requiresAuth: false },
  ],
  home: { visible: false }, // 自己就是 home，不需要卡片指回自己
};

export default homeModule;
