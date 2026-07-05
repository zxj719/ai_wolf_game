/**
 * moves.js — 招式池 / 克制表 / 七人配招 / 绝技（纯数据，spec §1.2–1.7）
 *
 * 克制语义来自真实网球战术：切削破上旋节奏、放小球拉重炮上网、
 * 穿越球惩罚网前、高压终结挑高。数值改动必须同步 spec。
 */

/**
 * powerFactor（2026-06-12 平衡补丁）：体力成本买威力。
 * 修复「满分重炮打不过低耗挑高球」——耗体越高的招，每点属性输出越高。
 */
export const MOVES = {
  flatDrive: {
    id: 'flatDrive', name: '重炮平击', system: 'power', stat: 'sta',
    energyCost: 20, powerFactor: 1.30, minigame: 'rhythmMash',
    desc: '底线大力平击，势大力沉',
  },
  smash: {
    id: 'smash', name: '高压扣杀', system: 'power', stat: 'sta',
    energyCost: 16, powerFactor: 1.22, minigame: 'shrinkSmash',
    desc: '高点暴力终结',
  },
  topspin: {
    id: 'topspin', name: '上旋抽击', system: 'spin', stat: 'skill',
    energyCost: 12, powerFactor: 1.10, minigame: 'rhythmBar',
    desc: '强烈上旋压制对手反手',
  },
  slice: {
    id: 'slice', name: '切削放缓', system: 'spin', stat: 'skill',
    energyCost: -3, powerFactor: 0.85, minigame: 'precisionStop',
    desc: '低平切削改变节奏，顺势喘口气',
  },
  volley: {
    id: 'volley', name: '网前截击', system: 'net', stat: 'skill',
    energyCost: 10, powerFactor: 1.05, minigame: 'whackVolley',
    desc: '上网拦截，不给反应时间',
  },
  dropShot: {
    id: 'dropShot', name: '放小球', system: 'control', stat: 'mind',
    energyCost: 8, powerFactor: 0.95, minigame: 'gaugeDrop',
    desc: '网前轻吊，调动对手',
  },
  lob: {
    id: 'lob', name: '挑高球', system: 'control', stat: 'mind',
    energyCost: 6, powerFactor: 0.86, minigame: 'directionReact',
    desc: '过顶高球送对手回老家',
  },
  passingShot: {
    id: 'passingShot', name: '穿越球', system: 'control', stat: 'mind',
    energyCost: 14, powerFactor: 1.15, minigame: 'dualTiming',
    desc: '直线/斜线穿越上网者',
  },
};

/**
 * 克制对：[克方, 被克方]。克中 1.5×，被克 0.7×，其余 1.0×。
 * 核心四循环 + 网前组（见 spec §1.3）。
 */
export const COUNTER_PAIRS = [
  // 核心四循环：重炮 → 切削 → 上旋 → 放小球 → 重炮
  ['flatDrive', 'slice'],
  ['slice', 'topspin'],
  ['topspin', 'dropShot'],
  ['dropShot', 'flatDrive'],
  // 网前组
  ['volley', 'dropShot'],
  ['volley', 'slice'],
  ['passingShot', 'volley'],
  ['lob', 'volley'],
  ['smash', 'lob'],
];

const COUNTER_SET = new Set(COUNTER_PAIRS.map(([a, b]) => `${a}>${b}`));

export function counterMultiplier(myMove, theirMove) {
  if (COUNTER_SET.has(`${myMove}>${theirMove}`)) return 1.5;
  if (COUNTER_SET.has(`${theirMove}>${myMove}`)) return 0.7;
  return 1.0;
}

/** 克制结算文案（用于战斗日志） */
export const COUNTER_QUIPS = {
  'flatDrive>slice': '重炮碾过慢球，力量就是道理！',
  'slice>topspin': '切削彻底打乱了上旋节奏！',
  'topspin>dropShot': '重上旋压得对方根本来不及放小球！',
  'dropShot>flatDrive': '小球把重炮手拉到网前狼狈扑救！',
  'volley>dropShot': '早就料到你要放小球，上网拦个正着！',
  'volley>slice': '慢悠悠的切削被网前一拍打死！',
  'passingShot>volley': '一记穿越，从上网者身边呼啸而过！',
  'lob>volley': '挑高球过顶，送上网者回老家！',
  'smash>lob': '高压扣杀，挑高球就是送分！',
};

/** 七人配招（性格即流派，spec §1.7） */
export const CHAR_BUILDS = {
  '诚':   { style: '重炮流', moves: ['flatDrive', 'smash', 'topspin', 'passingShot'] },
  'Elza': { style: '控制流', moves: ['slice', 'dropShot', 'lob', 'volley'] },
  '菲比': { style: '灵动流', moves: ['volley', 'dropShot', 'passingShot', 'topspin'] },
  'Ross': { style: '暴力流', moves: ['flatDrive', 'smash', 'passingShot', 'slice'] },
  '铁蛋': { style: '铁壁流', moves: ['slice', 'lob', 'topspin', 'flatDrive'] },
  '丫':   { style: '网前流', moves: ['volley', 'smash', 'dropShot', 'lob'] },
  '莹':   { style: '优雅流', moves: ['topspin', 'slice', 'lob', 'passingShot'] },
};

/** 绝技（一场限用一次，spec §1.6） */
export const ULTIMATES = {
  '虎啸正手':   { owner: '诚',   face: '🐯', effect: { type: 'autoCounter', powerMul: 1.5 },
    desc: '本球自动克中对手，威力 1.5×' },
  '狐步幻影':   { owner: 'Elza', face: '🦊', effect: { type: 'reveal', rollBonus: 8 },
    desc: '透视对手本球出招，发挥 +8' },
  '兔子急停':   { owner: '菲比', face: '🐰', effect: { type: 'drainEnergy', amount: 30 },
    desc: '对手体力 -30' },
  '霸王龙重扣': { owner: 'Ross', face: '🦖', effect: { type: 'freePower', rollBonus: 10 },
    desc: '本球重炮平击零耗体，发挥 +10' },
  '平底锅神挡': { owner: '铁蛋', face: '🍳', effect: { type: 'counterImmune', rollBonus: 6 },
    desc: '本球免疫被克，发挥 +6' },
  '猫步上网':   { owner: '丫',   face: '🐱', effect: { type: 'stealEnergy', amount: 15 },
    desc: '偷取对手 15 体力归自己' },
  '天鹅之舞':   { owner: '莹',   face: '🦢', effect: { type: 'fullRestore', mindBonus: 5 },
    desc: '体力回满，本场心态 +5' },
};
