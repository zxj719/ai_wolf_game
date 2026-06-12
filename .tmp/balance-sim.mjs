// 平衡性蒙特卡洛仿真 — 直接使用生产 battleReducer（纯函数+随机注入）
// 维度：策略 × 操作水平 × 对手强度 × 玩家流派 × 装备 × 关键分表现
import { createBattle, battleReducer } from '../src/modules/tennis/battle/battleReducer.js';
import { CHAR_BUILDS, MOVES, counterMultiplier } from '../src/modules/tennis/battle/moves.js';
import { TELLS } from '../src/modules/tennis/battle/opponentAI.js';
import { isKeyPoint } from '../src/modules/tennis/battle/scoring.js';

const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const uni = (a, b) => a + Math.random() * (b - a);

// ===== 操作水平模型 =====
const SKILLS = {
  noob: { mg: () => uni(0.55, 0.95), survivePass: 0.25, serve: [0.03, 0.30, 0.20] },  // [ace, good, fault]
  avg:  { mg: () => uni(0.75, 1.25), survivePass: 0.55, serve: [0.08, 0.40, 0.12] },
  pro:  { mg: () => uni(1.05, 1.50), survivePass: 0.85, serve: [0.18, 0.50, 0.05] },
};

// ===== 决策策略 =====
const tellToMove = (text) => Object.keys(TELLS).find((k) => TELLS[k] === text);
function availMoves(state, moves) {
  return moves.filter((id) => !(state.pEnergy < 20 && MOVES[id].energyCost >= 16));
}
const STRATEGIES = {
  random: (state, moves) => {
    const a = availMoves(state, moves);
    return a[rand(0, a.length - 1)];
  },
  energySaver: (state, moves) => {
    const a = availMoves(state, moves);
    if (state.pEnergy < 45) return a.reduce((x, y) => (MOVES[x].energyCost <= MOVES[y].energyCost ? x : y));
    return a[rand(0, a.length - 1)];
  },
  tellReader: (state, moves) => {
    const a = availMoves(state, moves);
    const predicted = state.tell ? tellToMove(state.tell.text) : null;
    if (predicted) {
      const counter = a.find((m) => counterMultiplier(m, predicted) === 1.5);
      if (counter) return counter;
      const safe = a.find((m) => counterMultiplier(predicted, m) !== 1.5);   // 至少别被克
      if (safe && state.pEnergy < 45) return safe;
    }
    if (state.pEnergy < 40) return a.reduce((x, y) => (MOVES[x].energyCost <= MOVES[y].energyCost ? x : y));
    return a[rand(0, a.length - 1)];
  },
  powerSpam: (state, moves) => {
    const a = availMoves(state, moves);
    const heavy = a.filter((m) => MOVES[m].system === 'power');
    return heavy[0] ?? a[0];
  },
};

// ===== 单场仿真 =====
function simMatch({ playerChar, build, skill, oppChar, oppBand, strategy, equip = null, survivePassOverride = null }) {
  const sk = SKILLS[skill];
  const player = { name: playerChar, face: '', talent: 70, ...build };
  const opponent = {
    name: oppChar, face: '',
    sta: rand(oppBand[0], oppBand[1]), skill: rand(oppBand[0], oppBand[1]), mind: rand(oppBand[0], oppBand[1]),
  };
  let s = createBattle({ player, opponent, deckInstances: [], rng: Math.random, equip });
  const moves = CHAR_BUILDS[playerChar].moves;
  const stats = { rallies: 0, exhaustedRallies: 0, countersFor: 0, countersAgainst: 0, keyPoints: 0, keyWins: 0 };
  let guard = 0;

  while (!s.score.matchOver && guard++ < 400) {
    s = battleReducer(s, { type: 'BEGIN_RALLY', rng: Math.random, moveRoll: Math.random(), truthRoll: Math.random(), fakeRoll: Math.random() });
    if (s.phase === 'serve') {
      const r = Math.random();
      const [pa, pg, pf] = sk.serve;
      const result = r < pa ? 'ace' : r < pa + pg ? 'good' : r < pa + pg + pf ? 'fault' : 'normal';
      s = battleReducer(s, { type: 'SERVE_DONE', result });
      if (s.phase !== 'cards') continue;       // ACE 直接得分
    }
    const keyPoint = isKeyPoint(s.score);
    const moveId = STRATEGIES[strategy](s, moves);
    const before = s;
    s = battleReducer(s, { type: 'PICK_MOVE', moveId });
    if (s === before) {     // 被拒（不应发生，策略已过滤）
      s = battleReducer(s, { type: 'PICK_MOVE', moveId: availMoves(s, moves)[0] });
    }
    stats.rallies++;
    if (s.pEnergy < 20) stats.exhaustedRallies++;
    // 小游戏：关键分=坚持类二值（1.5/0.6），普通=技能分布
    let m;
    if (keyPoint) {
      stats.keyPoints++;
      const passP = survivePassOverride ?? sk.survivePass;
      m = Math.random() < passP ? 1.5 : 0.6;
    } else {
      m = sk.mg();
    }
    s = battleReducer(s, { type: 'MINIGAME_DONE', multiplier: m });
    const prevPts = [...s.score.points];
    s = battleReducer(s, { type: 'RESOLVE', oppPerformRoll: rand(1, 20), noiseP: rand(-3, 3), noiseO: rand(-3, 3) });
    if (s.lastRally) {
      if (s.lastRally.counterMul > 1) stats.countersFor++;
      if (s.lastRally.counterMul < 1) stats.countersAgainst++;
      if (keyPoint && s.lastRally.win) stats.keyWins++;
    }
    void prevPts;
  }
  return { win: s.score.winner === 0, ...stats, aces: s.matchStats.aces, clutch: s.matchStats.clutchWins };
}

function runCell(cfg, n = 400) {
  let wins = 0, rallies = 0, exhausted = 0, kp = 0, kw = 0, cf = 0;
  for (let i = 0; i < n; i++) {
    const r = simMatch(cfg);
    wins += r.win ? 1 : 0;
    rallies += r.rallies;
    exhausted += r.exhaustedRallies;
    kp += r.keyPoints; kw += r.keyWins; cf += r.countersFor;
  }
  return {
    winRate: (wins / n * 100).toFixed(1),
    avgRallies: (rallies / n).toFixed(1),
    exhaustedPct: (exhausted / rallies * 100).toFixed(1),
    keyPerMatch: (kp / n).toFixed(2),
    keyWinPct: kp ? (kw / kp * 100).toFixed(1) : '—',
    counterPct: (cf / rallies * 100).toFixed(1),
  };
}

const BUILDS = {
  balanced: { sta: 32, skill: 32, mind: 31 },
  power:    { sta: 60, skill: 20, mind: 15 },
  tech:     { sta: 20, skill: 60, mind: 15 },
  mind:     { sta: 15, skill: 25, mind: 55 },
};

console.log('═══ 1) 策略 × 操作水平（诚 balanced vs 随机对手 55-65 中档）═══');
for (const strategy of Object.keys(STRATEGIES)) {
  for (const skill of Object.keys(SKILLS)) {
    const r = runCell({ playerChar: '诚', build: BUILDS.balanced, skill, oppChar: 'Elza', oppBand: [55, 65], strategy });
    console.log(`${strategy.padEnd(12)} ${skill.padEnd(5)} → 胜率 ${r.winRate}%  场均球 ${r.avgRallies}  力竭球占比 ${r.exhaustedPct}%  关键分/场 ${r.keyPerMatch}  关键分胜率 ${r.keyWinPct}%`);
  }
}

console.log('\n═══ 2) 七角色平衡（tellReader avg vs 互打 55-65）═══');
for (const c of Object.keys(CHAR_BUILDS)) {
  const opps = Object.keys(CHAR_BUILDS).filter((x) => x !== c);
  let wins = 0, n = 0;
  for (const o of opps) {
    for (let i = 0; i < 120; i++) {
      n++;
      if (simMatch({ playerChar: c, build: BUILDS.balanced, skill: 'avg', oppChar: o, oppBand: [55, 65], strategy: 'tellReader' }).win) wins++;
    }
  }
  console.log(`${c.padEnd(6)}（${CHAR_BUILDS[c].style}） → 胜率 ${(wins / n * 100).toFixed(1)}%`);
}

console.log('\n═══ 3) 流派平衡（诚 tellReader avg vs 55-65）═══');
for (const [name, build] of Object.entries(BUILDS)) {
  const r = runCell({ playerChar: '诚', build, skill: 'avg', oppChar: 'Elza', oppBand: [55, 65], strategy: 'tellReader' });
  console.log(`${name.padEnd(9)} → 胜率 ${r.winRate}%  力竭 ${r.exhaustedPct}%`);
}

console.log('\n═══ 4) 家族挑战难度曲线（tellReader avg balanced，各站 400 场独立）═══');
let cumP = 1;
for (let stage = 0; stage < 6; stage++) {
  const lo = 40 + stage * 8;
  const r = runCell({ playerChar: '诚', build: BUILDS.balanced, skill: 'avg', oppChar: 'Elza', oppBand: [lo, lo + 10], strategy: 'tellReader' });
  cumP *= parseFloat(r.winRate) / 100;
  console.log(`第${stage + 1}站 [${lo}-${lo + 10}] → 单场胜率 ${r.winRate}%  累计通关概率 ${(cumP * 100).toFixed(1)}%`);
}

console.log('\n═══ 5) 装备影响（vs 60-70，全史诗套 vs 裸装，tellReader avg）═══');
const noEq = runCell({ playerChar: '诚', build: BUILDS.balanced, skill: 'avg', oppChar: 'Ross', oppBand: [60, 70], strategy: 'tellReader' });
const fullEq = runCell({ playerChar: '诚', build: BUILDS.balanced, skill: 'avg', oppChar: 'Ross', oppBand: [60, 70], strategy: 'tellReader',
  equip: { sta: 7, skill: 7, mind: 7, energyMax: 20, special: {} } });
console.log(`裸装   → 胜率 ${noEq.winRate}%`);
console.log(`全史诗 → 胜率 ${fullEq.winRate}%（手残补偿量化：noob 裸装 vs noob 全史诗如下）`);
const noobNo = runCell({ playerChar: '诚', build: BUILDS.balanced, skill: 'noob', oppChar: 'Ross', oppBand: [55, 65], strategy: 'energySaver' });
const noobEq = runCell({ playerChar: '诚', build: BUILDS.balanced, skill: 'noob', oppChar: 'Ross', oppBand: [55, 65], strategy: 'energySaver',
  equip: { sta: 7, skill: 7, mind: 7, energyMax: 20, special: {} } });
console.log(`noob 裸装 ${noobNo.winRate}% → noob 全史诗 ${noobEq.winRate}%`);

console.log('\n═══ 6) 关键分挑战影响（avg 玩家，坚持过关率 25%/55%/85% 对比）═══');
for (const p of [0.25, 0.55, 0.85]) {
  const r = runCell({ playerChar: '诚', build: BUILDS.balanced, skill: 'avg', oppChar: 'Elza', oppBand: [55, 65], strategy: 'tellReader', survivePassOverride: p });
  console.log(`坚持过关率 ${(p * 100).toFixed(0)}% → 整场胜率 ${r.winRate}%（关键分胜率 ${r.keyWinPct}%）`);
}

console.log('\n═══ 7) 用户反馈专项：广场舞大妈（mind 99）vs 各水平玩家 ═══');
import('../src/modules/tennis/modes/adventure/oddOpponents.js').then(({ ODD_OPPONENTS }) => {
  const dama = ODD_OPPONENTS['广场舞大妈'];
  for (const skill of ['noob', 'avg', 'pro']) {
    let wins = 0;
    const n = 400;
    for (let i = 0; i < n; i++) {
      const sk = SKILLS[skill];
      const player = { name: '诚', face: '', talent: 70, ...BUILDS.balanced };
      let s = createBattle({ player, opponent: dama, deckInstances: [], rng: Math.random, twists: dama.twists });
      const moves = CHAR_BUILDS['诚'].moves;
      let guard = 0;
      while (!s.score.matchOver && guard++ < 400) {
        s = battleReducer(s, { type: 'BEGIN_RALLY', rng: Math.random, moveRoll: Math.random(), truthRoll: Math.random(), fakeRoll: Math.random() });
        if (s.phase === 'serve') {
          s = battleReducer(s, { type: 'SERVE_DONE', result: 'normal' });
          if (s.phase !== 'cards') continue;
        }
        const kp = isKeyPoint(s.score);
        s = battleReducer(s, { type: 'PICK_MOVE', moveId: STRATEGIES.tellReader(s, moves) });
        s = battleReducer(s, { type: 'MINIGAME_DONE', multiplier: kp ? (Math.random() < sk.survivePass ? 1.5 : 0.6) : sk.mg() });
        s = battleReducer(s, { type: 'RESOLVE', oppPerformRoll: rand(1, 20), noiseP: rand(-3, 3), noiseO: rand(-3, 3), reflectRoll: Math.random() });
      }
      if (s.score.winner === 0) wins++;
    }
    console.log(`${skill.padEnd(5)} vs 大妈 → 胜率 ${(wins / 400 * 100).toFixed(1)}%`);
  }

  console.log('\n═══ 8) 单球力学：满分重炮 vs 大妈普通挑高球（补丁后复现） ═══');
  const pPower = (45 + 28) * 1.30 * 1.5;           // powerFactor 1.30
  let lose = 0;
  for (let roll = 1; roll <= 20; roll++) {
    const oPower = dama.mind * 0.90 * (0.5 + (roll - 1) / 19 * 0.85);   // lob 0.90 系数 + 发挥上限 1.35
    if (oPower > pPower) lose++;
  }
  console.log(`满分重炮 ${pPower.toFixed(0)} vs 大妈挑高球（${dama.mind}×0.90×0.5–1.35）→ d20 中 ${lose}/20 个 roll 能打爆满分重炮`);
});
