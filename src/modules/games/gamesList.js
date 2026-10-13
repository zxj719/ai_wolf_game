import { ROUTES } from '../../shell/paths';

/**
 * 小游戏目录 — 每一项对应大厅里的一张卡片。
 * 新增一个游戏 = 往这里加一项 + 在本目录下建对应子目录，不用碰 GamesRoute.jsx。
 */
export const GAMES = [
  {
    id: 'minesweeper',
    title: { zh: '扫雷 · 无猜版', en: 'Minesweeper (No-Guess)' },
    blurb: {
      zh: '雷区经求解器验证、全程可推理，不会出现被隔断只能硬猜的局面。三档难度全网排行榜。',
      en: 'Every board is verified solvable by pure logic — no 50/50 guesses. Global leaderboards.',
    },
    path: ROUTES.GAMES_MINESWEEPER,
  },
  {
    id: 'mahjong',
    title: { zh: '麻将消除', en: 'Mahjong Solitaire' },
    blurb: {
      zh: '龟、金字塔、堡垒等 6 种布局，每局都有一次清空的解，无需洗牌。每种布局独立排行榜。',
      en: 'Six layouts, every deal guaranteed solvable without shuffling. Per-layout leaderboards.',
    },
    path: ROUTES.GAMES_MAHJONG,
  },
  {
    id: 'sudoku',
    title: { zh: '数独求解可视化', en: 'Sudoku Solver Visualizer' },
    blurb: {
      zh: '逐步回放约束传播、唯一余数与回溯，看清求解器每一步的推理依据。',
      en: 'Step through constraint propagation, singles and backtracking with full reasoning.',
    },
    path: ROUTES.GAMES_SUDOKU,
  },
  {
    id: 'gomoku',
    title: { zh: '五子棋 · 好友约战', en: 'Gomoku (vs Friends)' },
    blurb: {
      zh: '邀请在线好友实时对弈，15×15 黑先、连五即胜，服务器裁判，支持再来一局。',
      en: 'Play live against an online friend. Server-refereed, five in a row wins.',
    },
    path: ROUTES.GAMES_GOMOKU,
  },
  {
    id: 'banqi',
    title: { zh: '翻翻棋 · 好友约战', en: 'Chinese Dark Chess (vs Friends)' },
    blurb: {
      zh: '中国象棋暗棋：翻子定色、大吃小、炮隔子打。暗子只存在服务器，谁也偷看不到。',
      en: 'Xiangqi banqi: flip to reveal, rank captures, cannon jumps. Hidden pieces stay server-side.',
    },
    path: ROUTES.GAMES_BANQI,
  },
];
