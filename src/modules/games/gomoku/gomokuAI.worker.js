// 在 Worker 里算棋，主线程（落子动画、计时）不卡顿
import { chooseMove } from './gomokuAI';

self.onmessage = (e) => {
  const { id, board, color, level } = e.data;
  const t0 = Date.now();
  const move = chooseMove(board, color, level);
  self.postMessage({ id, move, ms: Date.now() - t0 });
};
