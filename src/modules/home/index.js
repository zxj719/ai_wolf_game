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
  title: { zh: '个人主页', en: 'Home' },
  blurb: {
    zh: '汇总狼人杀、音乐实验室、行情工具与博客的统一入口。',
    en: 'Unified entry for werewolf, music lab, market tool and blog.',
  },
  theme: 'light',
  backend: 'cf-workers',
  routes: [
    { path: ROUTES.HOME, component: HomeRoute, requiresAuth: false },
  ],
  home: { visible: false }, // 自己就是 home，不需要卡片指回自己
};

export default homeModule;
