import { describe, it, expect } from 'vitest';
import { createBattle, battleReducer } from '../battleReducer';
import { ODD_OPPONENTS } from '../../modes/adventure/oddOpponents';

const rngId = () => 0.999999;
const PLAYER = { name: '诚', face: '🐯', sta: 80, skill: 60, mind: 50, talent: 70 };
const DECK = [{ cardId: 'deepBreath', upgraded: false }];

function mk(opponentName, over = {}) {
  const opp = ODD_OPPONENTS[opponentName];
  return createBattle({
    player: PLAYER, opponent: opp, deckInstances: DECK, rng: rngId,
    twists: opp.twists, ...over,
  });
}

function playRally(s, moveId, { moveRoll = 0, reflectRoll = 1, multiplier = 1.0, oppRoll = 10 } = {}) {
  s = battleReducer(s, { type: 'BEGIN_RALLY', rng: rngId, moveRoll, truthRoll: 0.9, fakeRoll: 0 });
  if (s.phase === 'serve') s = battleReducer(s, { type: 'SERVE_DONE', result: 'normal' });
  s = battleReducer(s, { type: 'PICK_MOVE', moveId });
  s = battleReducer(s, { type: 'MINIGAME_DONE', multiplier });
  s = battleReducer(s, { type: 'RESOLVE', oppPerformRoll: oppRoll, noiseP: 0, noiseO: 0, reflectRoll });
  return s;
}

describe('离谱对手规则扭曲（spec §4.3）', () => {
  it('广场舞大妈：心理战系招式威力减半', () => {
    const s = playRally(mk('广场舞大妈'), 'dropShot');
    // dropShot 吃心态：(50+28)×0.5=39 为底 × 克制 1.5（小球克重炮）= 58.5
    expect(s.lastRally.pPower).toBeCloseTo(58.5, 5);
  });

  it('外卖小哥：timeScale 进入 twists（UI 用），出招照常', () => {
    const s = mk('外卖小哥');
    expect(s.twists.timeScale).toBe(0.7);
  });

  it('太极宗师：reflectRoll 命中时力量系威力 ×0.25', () => {
    const hit = playRally(mk('太极宗师'), 'flatDrive', { reflectRoll: 0.1 });
    const miss = playRally(mk('太极宗师'), 'flatDrive', { reflectRoll: 0.9 });
    expect(hit.lastRally.reflected).toBe(true);
    expect(miss.lastRally.reflected).toBe(false);
    expect(hit.lastRally.pPower).toBeLessThan(miss.lastRally.pPower * 0.5);
  });

  it('修仙童子：第 3 球渡劫，双方强制比拼心态', () => {
    let s = mk('修仙童子');
    s = playRally(s, 'flatDrive');
    s = playRally(s, 'flatDrive');
    s = playRally(s, 'flatDrive');     // rallyCount=3 → 渡劫
    expect(s.lastRally.mindDuel).toBe(true);
  });

  it('BOT-3000：提示永真（predictable）', () => {
    let s = mk('BOT-3000');
    // truthRoll 0.9 本应假提示，predictable 强制真
    s = battleReducer(s, { type: 'BEGIN_RALLY', rng: rngId, moveRoll: 0, truthRoll: 0.9, fakeRoll: 0 });
    expect(s.tell.isTrue).toBe(true);
  });

  it('网球之神：每盘轮换配招（builds 数组按盘数取模）', () => {
    const boss = ODD_OPPONENTS['网球之神'];
    let s = mk('网球之神');
    s = battleReducer(s, { type: 'BEGIN_RALLY', rng: rngId, moveRoll: 0, truthRoll: 0.5, fakeRoll: 0 });
    expect(boss.builds[0].moves).toContain(s.oppMove);
    // 伪造已打完一盘
    s = { ...s, phase: 'idle', score: { ...s.score, sets: [1, 0] } };
    s = battleReducer(s, { type: 'BEGIN_RALLY', rng: rngId, moveRoll: 0, truthRoll: 0.5, fakeRoll: 0 });
    expect(boss.builds[1].moves).toContain(s.oppMove);
  });
});
