import { lazy } from 'react';
import { ROUTES } from '../../shell/paths';

const GamesRoute = lazy(() => import('./GamesRoute'));
const SudokuRoute = lazy(() => import('./sudoku/SudokuRoute'));
const MinesweeperRoute = lazy(() => import('./expedition/ExpeditionRoute'));
const MahjongRoute = lazy(() => import('./mahjong/MahjongRoute'));
const GomokuRoute = lazy(() => import('./gomoku/GomokuRoute'));
const BanqiRoute = lazy(() => import('./banqi/BanqiRoute'));
const CoopMinesRoute = lazy(() => import('./coopmines/CoopMinesRoute'));

/**
 * 小游戏模块 — 与狼人杀/家网赛/小说工作台平级的首页板块。
 *
 * 纯前端小工具合集，不调用 ECS/LLM API，不进资源队列，游客可直接玩。
 * 扫雷 / 麻将消除的成绩走 CF Workers D1 全网排行榜（/api/minigames/*，仅登录用户上榜）。
 * 五子棋 / 翻翻棋是好友约战：复用私聊的 ECS WebSocket（game:* 消息），服务端 server/games/ 权威裁判。
 */
const gamesModule = {
  id: 'games',
  title: { zh: '小游戏', en: 'Mini Games' },
  blurb: {
    zh: '轻量小工具与可视化玩具，随时打开随时玩。',
    en: 'Lightweight tools and visual toys, playable anytime.',
  },
  theme: 'light',
  backend: 'cf-workers',
  routes: [
    { path: ROUTES.GAMES, component: GamesRoute, requiresAuth: false },
    { path: ROUTES.GAMES_SUDOKU, component: SudokuRoute, requiresAuth: false },
    { path: ROUTES.GAMES_MINESWEEPER, component: MinesweeperRoute, requiresAuth: false },
    { path: ROUTES.GAMES_MAHJONG, component: MahjongRoute, requiresAuth: false },
    { path: ROUTES.GAMES_GOMOKU, component: GomokuRoute, requiresAuth: false },
    { path: ROUTES.GAMES_BANQI, component: BanqiRoute, requiresAuth: false },
    { path: ROUTES.GAMES_COOPMINES, component: CoopMinesRoute, requiresAuth: false },
  ],
  home: { visible: true, order: 27 },
};

export default gamesModule;
