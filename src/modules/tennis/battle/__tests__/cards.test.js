import { describe, it, expect } from 'vitest';
import { CARDS, createDeckState, startRally, playCard, cardEffect } from '../cards';

// 确定性 rng：接近 1 时 Fisher-Yates 的 j 恒等于 i（不交换），洗牌为恒等
const rng0 = () => 0.999999;

const mk = (ids) => createDeckState(ids.map((cardId) => ({ cardId, upgraded: false })), rng0);

describe('CARDS 卡池（spec §1.5 + D2 新增）', () => {
  it('共 14 张，费用与表一致', () => {
    expect(Object.keys(CARDS)).toHaveLength(14);
    expect(CARDS.tacticalPause.cost).toBe(1);
    expect(CARDS.adrenaline.cost).toBe(0);
    expect(CARDS.secondWind.cost).toBe(2);
    expect(CARDS.fullFocus.cost).toBe(1);
    expect(CARDS.deepBreath.cost).toBe(0);
    expect(CARDS.crowdCheer.cost).toBe(0);
    expect(CARDS.towelTime.cost).toBe(1);
    expect(CARDS.newBalls.cost).toBe(1);
    expect(CARDS.coachSign.cost).toBe(1);
    expect(CARDS.hawkeye.cost).toBe(2);
    expect(CARDS.stringTune.cost).toBe(2);
    expect(CARDS.mindMassage.cost).toBe(2);
    expect(CARDS.energyGel.cost).toBe(3);
    expect(CARDS.goldenMoment.cost).toBe(3);
  });

  it('升级版效果数值：毛巾 30→50、金球时刻下限 1.0→1.2', () => {
    expect(cardEffect({ cardId: 'towelTime', upgraded: false }).amount).toBe(30);
    expect(cardEffect({ cardId: 'towelTime', upgraded: true }).amount).toBe(50);
    expect(cardEffect({ cardId: 'goldenMoment', upgraded: false }).floor).toBe(1.0);
    expect(cardEffect({ cardId: 'goldenMoment', upgraded: true }).floor).toBe(1.2);
    expect(cardEffect({ cardId: 'stringTune', upgraded: false }).type).toBe('counterNullify');
    expect(cardEffect({ cardId: 'stringTune', upgraded: true }).type).toBe('counterInvert');
  });
});

describe('牌库状态机', () => {
  it('初始：牌入抽牌堆、手牌空、战术点 1', () => {
    const d = mk(['towelTime', 'deepBreath', 'newBalls']);
    expect(d.drawPile).toHaveLength(3);
    expect(d.hand).toHaveLength(0);
    expect(d.discard).toHaveLength(0);
    expect(d.tacticalPoints).toBe(1);
  });

  it('startRally：抽 1 入手 + 战术点 +1 上限 3', () => {
    let d = mk(['towelTime', 'deepBreath', 'newBalls']);
    d = startRally(d, rng0);
    expect(d.hand).toHaveLength(1);
    expect(d.tacticalPoints).toBe(2);
    d = startRally(d, rng0);
    d = startRally(d, rng0);
    expect(d.tacticalPoints).toBe(3);   // 封顶
    d = startRally(d, rng0);            // 牌堆已空：弃牌堆也空 → 不抽
    expect(d.tacticalPoints).toBe(3);
    expect(d.hand).toHaveLength(3);
  });

  it('抽空后弃牌堆洗回（StS 规则）', () => {
    let d = mk(['towelTime', 'deepBreath']);
    d = startRally(d, rng0);
    d = startRally(d, rng0);            // 抽光
    const r1 = playCard(d, 0);          // 打出 1 张进弃牌堆
    d = r1.deck;
    expect(d.discard).toHaveLength(1);
    d = startRally(d, rng0);            // 抽牌堆空 → 弃牌堆洗回再抽
    expect(d.hand).toHaveLength(2);
    expect(d.discard).toHaveLength(0);
  });

  it('手牌上限 5，爆牌直接弃置', () => {
    let d = mk(['deepBreath', 'deepBreath', 'deepBreath', 'deepBreath', 'deepBreath', 'deepBreath', 'deepBreath']);
    for (let i = 0; i < 6; i++) d = startRally(d, rng0);
    expect(d.hand).toHaveLength(5);
    expect(d.discard).toHaveLength(1);  // 第 6 张爆牌弃置
  });

  it('新卡效果：抽卡/回点/回体抽卡/专注', () => {
    expect(cardEffect({ cardId: 'tacticalPause', upgraded: false })).toEqual({ type: 'draw', count: 2 });
    expect(cardEffect({ cardId: 'tacticalPause', upgraded: true })).toEqual({ type: 'draw', count: 3 });
    expect(cardEffect({ cardId: 'adrenaline', upgraded: false })).toEqual({ type: 'tp', amount: 2 });
    expect(cardEffect({ cardId: 'secondWind', upgraded: false })).toEqual({ type: 'energyDraw', energy: 20, count: 1 });
    expect(cardEffect({ cardId: 'fullFocus', upgraded: true })).toEqual({ type: 'focus', windowBonus: 0.75, powerMul: 0.15 });
  });

  it('playCard：费用校验与扣点', () => {
    let d = mk(['energyGel', 'deepBreath']);
    d = startRally(d, rng0);            // 手牌[energyGel], tp=2
    const fail = playCard(d, 0);        // energyGel 费 3 > 2
    expect(fail.error).toBeTruthy();
    d = startRally(d, rng0);            // tp=3
    const ok = playCard(d, 0);
    expect(ok.error).toBeUndefined();
    expect(ok.deck.tacticalPoints).toBe(0);
    expect(ok.effect.type).toBe('halfCost');
    expect(ok.deck.discard).toHaveLength(1);
  });
});
