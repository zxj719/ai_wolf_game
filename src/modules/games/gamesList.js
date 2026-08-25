import { ROUTES } from '../../shell/paths';

/**
 * 小游戏目录 — 每一项对应大厅里的一张卡片。
 * 新增一个游戏 = 往这里加一项 + 在本目录下建对应子目录，不用碰 GamesRoute.jsx。
 */
export const GAMES = [
  {
    id: 'sudoku',
    title: { zh: '数独求解可视化', en: 'Sudoku Solver Visualizer' },
    blurb: {
      zh: '逐步回放约束传播、唯一余数与回溯，看清求解器每一步的推理依据。',
      en: 'Step through constraint propagation, singles and backtracking with full reasoning.',
    },
    path: ROUTES.GAMES_SUDOKU,
  },
];
