import { describe, it, expect } from 'vitest';
import { createBattle, battleReducer, energyPenalty } from '../battleReducer';

const rngId = () => 0.999999;   // 恒等洗牌

const PLAYER = { name: '诚', face: '🐯', sta: 80, skill: 60, mind: 50, talent: 70 };
const OPP = { name: 'Elza', face: '🦊', sta: 60, skill: 70, mind: 60 };

function freshBattle(over = {}) {
  return createBattle({
    player: PLAYER,
    opponent: OPP,
    deckInstances: [
      { cardId: 'towelTime', upgraded: false },
      { cardId: 'newBalls', upgraded: false },
      { cardId: 'goldenMoment', upgraded: false },
      { cardId: 'hawkeye', upgraded: false },
    ],
    rng: rngId,
    ...over,
  });
}

/** 推进到出招阶段：开球（普通发球）+ 抽牌。Elza moveRoll=0 → 首招 slice */
function toPick(s, { serve = 'normal' } = {}) {
  s = battleReducer(s, { type: 'BEGIN_RALLY', rng: rngId, moveRoll: 0, truthRoll: 0.5, fakeRoll: 0 });
  if (s.phase === 'serve') {
    s = battleReducer(s, { type: 'SERVE_DONE', result: serve });
  }
  return s;
}

describe('energyPenalty 体力三档（spec §1.1）', () => {
  it.each([[100, 1.0], [60, 1.0], [59, 0.8], [20, 0.8], [19, 0.6], [0, 0.6]])(
    '体力 %i → ×%d', (e, p) => expect(energyPenalty(e)).toBe(p));
});

describe('battleReducer 球级流程', () => {
  it('首球需发球；BEGIN_RALLY 抽牌+战术点 ramp', () => {
    let s = freshBattle();
    expect(s.needServe).toBe(true);
    s = battleReducer(s, { type: 'BEGIN_RALLY', rng: rngId, moveRoll: 0, truthRoll: 0.5, fakeRoll: 0 });
    expect(s.phase).toBe('serve');
    expect(s.deck.hand).toHaveLength(1);
    expect(s.deck.tacticalPoints).toBe(2);
    expect(s.oppMove).toBe('slice');       // Elza 首招
    expect(s.tell.isTrue).toBe(true);      // truthRoll 0.5 < 0.75
  });

  it('ACE 直接得分并进入下一球', () => {
    let s = toPick(freshBattle(), { serve: 'ace' });
    expect(s.score.points[0]).toBe(1);
    expect(s.matchStats.aces).toBe(1);
    expect(s.phase).toBe('idle');          // 等待下一次 BEGIN_RALLY
  });

  it('完整一球：克制 1.5× 进入公式，平分判主队', () => {
    let s = toPick(freshBattle());
    expect(s.phase).toBe('cards');
    s = battleReducer(s, { type: 'PICK_MOVE', moveId: 'flatDrive' });   // 重炮 克 切削
    expect(s.phase).toBe('minigame');
    expect(s.pEnergy).toBe(80);            // 100 - 20
    s = battleReducer(s, { type: 'MINIGAME_DONE', multiplier: 1.0 });
    expect(s.phase).toBe('resolve');
    s = battleReducer(s, { type: 'RESOLVE', oppPerformRoll: 10, noiseP: 0, noiseO: 0 });
    // pBase = 80(sta) + 28(talent*0.4) = 108; ×1.0 体力 ×1.5 克制 ×1.0 小游戏 = 162
    expect(s.lastRally.pPower).toBeCloseTo(162, 5);
    expect(s.lastRally.counterMul).toBe(1.5);
    expect(s.lastRally.win).toBe(true);
    expect(s.score.points[0]).toBe(1);
  });

  it('卡牌：毛巾回体、换新球加成进公式', () => {
    let s = toPick(freshBattle());
    // 手牌第 1 张是 towelTime（恒等洗牌）；先扣到 40 体验证回复
    s = { ...s, pEnergy: 40 };
    s = battleReducer(s, { type: 'PLAY_CARD', idx: 0 });
    expect(s.pEnergy).toBe(70);
    // 第二球抽 newBalls 再打
    s = battleReducer(s, { type: 'PICK_MOVE', moveId: 'topspin' });
    s = battleReducer(s, { type: 'MINIGAME_DONE', multiplier: 1.0 });
    s = battleReducer(s, { type: 'RESOLVE', oppPerformRoll: 20, noiseP: 0, noiseO: 0 });
    s = battleReducer(s, { type: 'BEGIN_RALLY', rng: rngId, moveRoll: 0, truthRoll: 0.5, fakeRoll: 0 });
    s = battleReducer(s, { type: 'PLAY_CARD', idx: 0 });             // newBalls
    expect(s.pendingEffects.powerMul).toBeCloseTo(0.2);
  });

  it('力竭：重招禁出（PICK_MOVE 拒绝），轻招威力 ×0.6', () => {
    let s = toPick(freshBattle());
    s = { ...s, pEnergy: 10 };
    const rejected = battleReducer(s, { type: 'PICK_MOVE', moveId: 'flatDrive' });
    expect(rejected.phase).toBe('cards');   // 没推进
    s = battleReducer(s, { type: 'PICK_MOVE', moveId: 'topspin' });  // 12 耗体可出？
    // 力竭线只禁 ≥16，topspin12 可出；出招后体力归 0 下限
    expect(s.phase).toBe('minigame');
    expect(s.pEnergy).toBe(0);
    s = battleReducer(s, { type: 'MINIGAME_DONE', multiplier: 1.0 });
    s = battleReducer(s, { type: 'RESOLVE', oppPerformRoll: 10, noiseP: 0, noiseO: 0 });
    // pBase = 60(skill)+28 = 88 ×0.6 力竭 ×1.0(topspin vs slice 被克 0.7!) —— topspin 被 slice 克
    expect(s.lastRally.counterMul).toBe(0.7);
    expect(s.lastRally.pPower).toBeCloseTo(88 * 0.6 * 0.7, 5);
  });

  it('绝技：虎啸正手 autoCounter 强制 1.5×，一场限一次', () => {
    let s = toPick(freshBattle());
    s = battleReducer(s, { type: 'USE_ULTIMATE', name: '虎啸正手' });
    expect(s.ultimateUsed).toBe(true);
    s = battleReducer(s, { type: 'PICK_MOVE', moveId: 'topspin' });  // 本会被克
    s = battleReducer(s, { type: 'MINIGAME_DONE', multiplier: 1.0 });
    s = battleReducer(s, { type: 'RESOLVE', oppPerformRoll: 10, noiseP: 0, noiseO: 0 });
    expect(s.lastRally.counterMul).toBe(1.5);                        // 被克翻转为克
    const again = battleReducer(s, { type: 'USE_ULTIMATE', name: '虎啸正手' });
    expect(again).toEqual(s);                                        // 冻结
  });

  it('绝技：兔子急停吸对方 30 体', () => {
    let s = toPick(freshBattle({
      ultimate: '兔子急停',
    }));
    s = battleReducer(s, { type: 'USE_ULTIMATE', name: '兔子急停' });
    expect(s.oEnergy).toBe(70);
  });

  it('鹰眼挑战：失分翻判重打，分数不变', () => {
    let s = toPick(freshBattle());
    s = { ...s, deck: { ...s.deck, hand: [{ cardId: 'hawkeye', upgraded: false }], tacticalPoints: 3 } };
    s = battleReducer(s, { type: 'PLAY_CARD', idx: 0 });
    expect(s.pendingEffects.hawkeyeCharges).toBe(1);
    s = battleReducer(s, { type: 'PICK_MOVE', moveId: 'topspin' });   // 被 slice 克
    s = battleReducer(s, { type: 'MINIGAME_DONE', multiplier: 0.5 });
    s = battleReducer(s, { type: 'RESOLVE', oppPerformRoll: 20, noiseP: 0, noiseO: 0 });
    expect(s.lastRally.hawkeyeSaved).toBe(true);
    expect(s.score.points).toEqual([0, 0]);                            // 分数没动
    expect(s.pendingEffects.hawkeyeCharges).toBe(0);
  });

  it('金球时刻：小游戏倍率下限抬到 1.0', () => {
    let s = toPick(freshBattle());
    s = { ...s, deck: { ...s.deck, hand: [{ cardId: 'goldenMoment', upgraded: false }], tacticalPoints: 3 } };
    s = battleReducer(s, { type: 'PLAY_CARD', idx: 0 });
    s = battleReducer(s, { type: 'PICK_MOVE', moveId: 'flatDrive' });
    s = battleReducer(s, { type: 'MINIGAME_DONE', multiplier: 0.5 });
    expect(s.pMultiplier).toBe(1.0);
  });

  it('局结束触发回体与重新发球', () => {
    let s = freshBattle();
    // 直接构造 40-0 局点
    s = { ...s, score: { ...s.score, points: [3, 0] } };
    s = toPick(s);
    s = battleReducer(s, { type: 'PICK_MOVE', moveId: 'flatDrive' });
    s = battleReducer(s, { type: 'MINIGAME_DONE', multiplier: 1.5 });
    const before = s.pEnergy;
    s = battleReducer(s, { type: 'RESOLVE', oppPerformRoll: 1, noiseP: 0, noiseO: 0 });
    expect(s.score.games[0]).toBe(1);
    expect(s.needServe).toBe(true);
    expect(s.pEnergy).toBe(Math.min(100, before + 10));               // 局间回体
  });

  it('挂件特效：counterBoost 克中 +0.1、restBonus 局间多回体、初始体力注入', () => {
    let s = createBattle({
      player: PLAYER, opponent: OPP, rng: rngId,
      deckInstances: [{ cardId: 'deepBreath', upgraded: false }],
      equip: { sta: 0, skill: 0, mind: 0, energyMax: 0, special: { counterBoost: 0.1, restBonus: 5 } },
      initialEnergy: 60,
    });
    expect(s.pEnergy).toBe(60);
    s = { ...s, score: { ...s.score, points: [3, 0] } };   // 局点
    s = toPick(s);
    s = battleReducer(s, { type: 'PICK_MOVE', moveId: 'flatDrive' });  // 克 slice
    s = battleReducer(s, { type: 'MINIGAME_DONE', multiplier: 1.0 });
    const beforeRest = s.pEnergy;
    s = battleReducer(s, { type: 'RESOLVE', oppPerformRoll: 1, noiseP: 0, noiseO: 0 });
    expect(s.lastRally.counterMul).toBeCloseTo(1.6);
    expect(s.pEnergy).toBe(Math.min(100, beforeRest + 10 + 5));        // restBonus
  });

  it('比赛结束 phase=over', () => {
    let s = freshBattle();
    s = { ...s, score: { ...s.score, points: [3, 0], games: [2, 0], sets: [1, 0] } };
    s = toPick(s);
    s = battleReducer(s, { type: 'PICK_MOVE', moveId: 'flatDrive' });
    s = battleReducer(s, { type: 'MINIGAME_DONE', multiplier: 1.5 });
    s = battleReducer(s, { type: 'RESOLVE', oppPerformRoll: 1, noiseP: 0, noiseO: 0 });
    expect(s.score.matchOver).toBe(true);
    expect(s.phase).toBe('over');
  });
});
