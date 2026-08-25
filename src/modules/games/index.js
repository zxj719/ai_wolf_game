import { lazy } from 'react';
import { ROUTES } from '../../shell/paths';

const GamesRoute = lazy(() => import('./GamesRoute'));
const SudokuRoute = lazy(() => import('./sudoku/SudokuRoute'));

/**
 * 小游戏模块 — 与狼人杀/家网赛/小说工作台平级的首页板块。
 *
 * 纯前端小工具合集，不调用 ECS/LLM API，不进资源队列，游客可直接玩。
 */
const gamesModule = {
  id: 'games',
  title: { zh: '小游戏', en: 'Mini Games' },
  blurb: {
    zh: '轻量小工具与可视化玩具，随时打开随时玩。',
    en: 'Lightweight tools and visual toys, playable anytime.',
  },
  theme: 'dark',
  backend: 'cf-workers',
  routes: [
    { path: ROUTES.GAMES, component: GamesRoute, requiresAuth: false },
    { path: ROUTES.GAMES_SUDOKU, component: SudokuRoute, requiresAuth: false },
  ],
  home: { visible: true, order: 27 },
};

export default gamesModule;
