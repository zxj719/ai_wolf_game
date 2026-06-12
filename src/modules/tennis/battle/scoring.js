/**
 * scoring.js — 真实网球记分 lite 状态机（纯函数，spec §1.4）
 *
 * 规则：15-30-40 成局（Deuce/占先；回平分 2 次后金球制一分定局）；
 * 先胜 3 局成盘（lite，无需净胜 2 局）；三盘两胜。
 * restEnergy 字段向 battleReducer 通告局间(+10)/盘间(+30)回体量。
 */

const GAMES_PER_SET = 3;
const SETS_TO_WIN = 2;
const DEUCE_CAP = 2;

export function createScore() {
  return {
    points: [0, 0],        // 0..3 → 0/15/30/40
    games: [0, 0],
    sets: [0, 0],
    isDeuce: false,
    advantage: null,       // null | 0 | 1
    deuceCount: 0,         // 回平分次数
    goldenPoint: false,
    matchOver: false,
    winner: null,
    restEnergy: 0,         // 本次得分触发的回体量（0/10/30）
    setHistory: [],        // 'W'/'L'（以 0 号位视角）
  };
}

const LABELS = ['0', '15', '30', '40'];

/**
 * 关键分判定（D 段）：金球，或任一方拿下此分即赢盘/赢赛。
 * 普通局点不算关键分（太频繁会拖节奏）。
 */
export function isKeyPoint(score) {
  if (score.matchOver) return false;
  if (score.goldenPoint) return true;
  const gamePointFor = (who) => {
    if (score.isDeuce) return score.advantage === who;
    return score.points[who] === 3 && score.points[1 - who] < 3;
  };
  for (const who of [0, 1]) {
    if (!gamePointFor(who)) continue;
    const setPoint = score.games[who] === GAMES_PER_SET - 1;
    if (setPoint) return true;                      // 盘点（含赛点：赢盘即可能赢赛）
  }
  return false;
}

export function pointLabel(score, side) {
  if (score.isDeuce) {
    if (score.advantage === side) return 'Adv';
    return '40';
  }
  return LABELS[score.points[side]];
}

function winGame(score, who) {
  const games = [...score.games];
  games[who] += 1;

  const next = {
    ...score,
    points: [0, 0],
    isDeuce: false,
    advantage: null,
    deuceCount: 0,
    goldenPoint: false,
    games,
    restEnergy: 20,    // 平衡补丁：局间回体 10→20
  };

  if (games[who] >= GAMES_PER_SET) {
    const sets = [...score.sets];
    sets[who] += 1;
    next.sets = sets;
    next.games = [0, 0];
    next.restEnergy = 50;    // 平衡补丁：盘间回体 30→50
    next.setHistory = [...score.setHistory, who === 0 ? 'W' : 'L'];
    if (sets[who] >= SETS_TO_WIN) {
      next.matchOver = true;
      next.winner = who;
      next.restEnergy = 0;
    }
  }
  return next;
}

export function addPoint(score, who) {
  if (score.matchOver) return score;
  const other = 1 - who;

  // 金球：一分定局
  if (score.goldenPoint) {
    return winGame(score, who);
  }

  if (score.isDeuce) {
    if (score.advantage === null) {
      return { ...score, advantage: who, restEnergy: 0 };
    }
    if (score.advantage === who) {
      return winGame(score, who);
    }
    // 占先方失分 → 回平分
    const deuceCount = score.deuceCount + 1;
    return {
      ...score,
      advantage: null,
      deuceCount,
      goldenPoint: deuceCount >= DEUCE_CAP,
      restEnergy: 0,
    };
  }

  const points = [...score.points];
  points[who] += 1;

  if (points[who] >= 4) {
    return winGame(score, who);
  }
  if (points[who] === 3 && points[other] === 3) {
    return { ...score, points, isDeuce: true, restEnergy: 0 };
  }
  return { ...score, points, restEnergy: 0 };
}
