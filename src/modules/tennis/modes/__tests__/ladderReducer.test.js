import { describe, it, expect } from 'vitest';
import { createLadder, ladderReducer, STAGE_COUNT } from '../ladderReducer';
import { ULTIMATES } from '../../battle/moves';

const rngHalf = () => 0.5;

const mk = () => createLadder({ playerName: '诚', rng: rngHalf });

describe('createLadder（spec §3）', () => {
  it('6 个对手且不含玩家自己', () => {
    const s = mk();
    expect(s.opponents).toHaveLength(STAGE_COUNT);
    expect(s.opponents.map((o) => o.name)).not.toContain('诚');
  });

  it('实力梯度：第 i 场属性 ∈ [40+8i, 50+8i]，逐场递增', () => {
    const s = mk();
    s.opponents.forEach((o, i) => {
      const lo = 40 + i * 8;
      const hi = 50 + i * 8;
      for (const k of ['sta', 'skill', 'mind']) {
        expect(o[k]).toBeGreaterThanOrEqual(lo);
        expect(o[k]).toBeLessThanOrEqual(hi);
      }
    });
  });

  it('初始状态在战斗中，第 0 站', () => {
    const s = mk();
    expect(s.status).toBe('fighting');
    expect(s.stage).toBe(0);
    expect(s.carryEnergy).toBe(100);
  });
});

describe('ladderReducer', () => {
  it('胜场进入赛间，解锁对手绝技，记录掉落与金币', () => {
    let s = mk();
    const beaten = s.opponents[0].name;
    s = ladderReducer(s, {
      type: 'MATCH_WON',
      remainingEnergy: 30,
      drop: { slot: 'racket', rarity: 'fine' },
      coins: 60,
    });
    expect(s.status).toBe('between');
    expect(s.coinsEarned).toBe(60);
    expect(s.drops).toHaveLength(1);
    const expectedUlt = Object.entries(ULTIMATES).find(([, u]) => u.owner === beaten)[0];
    expect(s.unlockedThisRun).toContain(expectedUlt);
  });

  it('第 6 胜 → 加冕球王（won）', () => {
    let s = mk();
    for (let i = 0; i < STAGE_COUNT; i++) {
      s = ladderReducer(s, { type: 'MATCH_WON', remainingEnergy: 50, drop: null, coins: 50 });
      if (i < STAGE_COUNT - 1) {
        s = ladderReducer(s, { type: 'INTERMISSION', choice: 'massage', statRoll: 0 });
      }
    }
    expect(s.status).toBe('won');
    expect(s.unlockedThisRun).toHaveLength(STAGE_COUNT);
  });

  it('败北即止步（lost），战利品保留', () => {
    let s = mk();
    s = ladderReducer(s, { type: 'MATCH_LOST', drop: { slot: 'grip', rarity: 'common' }, coins: 15 });
    expect(s.status).toBe('lost');
    expect(s.drops).toHaveLength(1);
    expect(s.coinsEarned).toBe(15);
  });

  it('赛间特训：+8 注入属性并推进下一站；体力回 min(100, 余量+40)', () => {
    let s = mk();
    s = ladderReducer(s, { type: 'MATCH_WON', remainingEnergy: 30, drop: null, coins: 0 });
    s = ladderReducer(s, { type: 'INTERMISSION', choice: 'train', statRoll: 0 }); // roll 0 → sta
    expect(s.bonusStats.sta).toBe(8);
    expect(s.stage).toBe(1);
    expect(s.status).toBe('fighting');
    expect(s.carryEnergy).toBe(70);   // 30 + 40
  });

  it('赛间按摩：额外 +30 体力', () => {
    let s = mk();
    s = ladderReducer(s, { type: 'MATCH_WON', remainingEnergy: 50, drop: null, coins: 0 });
    s = ladderReducer(s, { type: 'INTERMISSION', choice: 'massage', statRoll: 0 });
    expect(s.carryEnergy).toBe(100);  // min(100, 50+40+30)
  });

  it('赛间进店：pendingShop 置位，SHOP_DONE 后推进', () => {
    let s = mk();
    s = ladderReducer(s, { type: 'MATCH_WON', remainingEnergy: 60, drop: null, coins: 0 });
    s = ladderReducer(s, { type: 'INTERMISSION', choice: 'shop', statRoll: 0 });
    expect(s.pendingShop).toBe(true);
    expect(s.status).toBe('between');   // 逛完店才开打
    s = ladderReducer(s, { type: 'SHOP_DONE' });
    expect(s.pendingShop).toBe(false);
    expect(s.stage).toBe(1);
    expect(s.status).toBe('fighting');
  });

  it('快照可 JSON 序列化往返', () => {
    let s = mk();
    s = ladderReducer(s, { type: 'MATCH_WON', remainingEnergy: 30, drop: null, coins: 10 });
    const restored = JSON.parse(JSON.stringify(s));
    expect(restored).toEqual(s);
  });
});
