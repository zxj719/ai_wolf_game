/**
 * oddOpponents.js — 离谱对手（spec §4.3）
 *
 * 复用对战内核：build 自定义配招/权重，twists 注入 battleReducer 扭曲规则。
 * 属性按章节梯度；family 客串对手在运行时由 adventureReducer 生成。
 */

export const ODD_OPPONENTS = {
  '广场舞大妈': {
    name: '广场舞大妈', face: '💃', chapter: 1,
    sta: 55, skill: 45, mind: 99,
    build: { moves: ['flatDrive', 'lob', 'slice', 'dropShot'], weights: [0.45, 0.25, 0.2, 0.1] },
    twists: { mindImmune: true },
    taunt: '小伙子，蒲扇都比你的拍子快！',
    twistDesc: '心理战对她无效（心态 99 的广场霸主），心态系招式威力减半',
  },
  '外卖小哥': {
    name: '外卖小哥', face: '🛵', chapter: 1, elite: true,
    sta: 62, skill: 58, mind: 50,
    build: { moves: ['passingShot', 'volley', 'flatDrive', 'dropShot'], weights: [0.35, 0.3, 0.2, 0.15] },
    twists: { timeScale: 0.7 },
    taunt: '超时一秒扣我钱，你的小游戏时间也得砍！',
    twistDesc: '他赶时间——你的小游戏时限 −30%',
  },
  '太极宗师': {
    name: '太极宗师', face: '🧘', chapter: 2,
    sta: 60, skill: 70, mind: 68,
    build: { moves: ['slice', 'lob', 'dropShot', 'topspin'], weights: [0.4, 0.25, 0.2, 0.15] },
    twists: { powerReflect: 0.3 },
    taunt: '四两拨千斤，你的重炮就是我的助力。',
    twistDesc: '力量系招式 30% 概率被借力打力反弹（威力大减）',
  },
  '修仙童子': {
    name: '修仙童子', face: '🧒', chapter: 2, elite: true,
    sta: 68, skill: 66, mind: 74,
    build: { moves: ['topspin', 'dropShot', 'lob', 'passingShot'], weights: [0.3, 0.3, 0.2, 0.2] },
    twists: { forcedMindDuel: 3 },
    taunt: '每三球渡一次劫，心境不稳者败！',
    twistDesc: '每第 3 球强制双方比拼心态（渡劫）',
  },
  'BOT-3000': {
    name: 'BOT-3000', face: '🤖', chapter: 3,
    sta: 78, skill: 80, mind: 0,
    build: { moves: ['flatDrive', 'topspin', 'volley', 'passingShot'], weights: [0.25, 0.25, 0.25, 0.25] },
    twists: { predictable: true, mindless: true },
    taunt: 'BEEP. 计算最优击球轨迹. BEEP.',
    twistDesc: '机器无心态不吃心理招，但出招 100% 规律（提示永真）',
  },
  '网球之神': {
    name: '网球之神', face: '🏛️', chapter: 3, elite: true, boss: true,
    sta: 92, skill: 92, mind: 92,
    builds: [
      { moves: ['flatDrive', 'smash', 'topspin', 'passingShot'], weights: [0.35, 0.3, 0.2, 0.15] },
      { moves: ['slice', 'dropShot', 'lob', 'volley'], weights: [0.3, 0.3, 0.2, 0.2] },
      { moves: ['topspin', 'volley', 'smash', 'slice'], weights: [0.3, 0.25, 0.25, 0.2] },
    ],
    twists: { bossPhaseSwap: true },
    taunt: '凡人，奖杯在我手里。每一盘，我都是另一个我。',
    twistDesc: '每盘更换一套配招——上一盘的读招经验作废',
  },
};

/** 家人客串对手（章节梯度属性由调用方掷出） */
export const FAMILY_CAMEO_TAUNT = '没想到吧，我也来抢奖杯了！';
