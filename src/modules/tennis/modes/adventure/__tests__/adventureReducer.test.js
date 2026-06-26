import { describe, it, expect } from 'vitest';
import { createAdventure, adventureReducer } from '../adventureReducer';

const rngHalf = () => 0.5;
const mk = () => createAdventure({ rng: rngHalf });

/** 选第 0 个节点并按类型完成它（非战斗节点用 EVENT_DONE/REST 推进） */
function clearStep(s, { win = true } = {}) {
  s = adventureReducer(s, { type: 'CHOOSE_NODE', optionIdx: 0 });
  const node = s.currentNode;
  if (node.type === 'battle') {
    return adventureReducer(s, { type: 'BATTLE_RESULT', win, remainingEnergy: 40, drop: null, coins: 30 });
  }
  if (node.type === 'rest') {
    return adventureReducer(s, { type: 'REST' });
  }
  if (node.type === 'shop') {
    return adventureReducer(s, { type: 'SHOP_DONE' });
  }
  return adventureReducer(s, { type: 'EVENT_DONE', reward: { kind: 'nothing' }, statRoll: 0 });
}

describe('adventureReducer（spec §4）', () => {
  it('初始：第一章第 0 步待选', () => {
    const s = mk();
    expect(s.phase).toBe('pick');
    expect(s.chapterIdx).toBe(0);
    expect(s.stepIdx).toBe(0);
    expect(s.carryEnergy).toBe(100);
  });

  it('CHOOSE_NODE 锁定节点进入执行相位', () => {
    let s = mk();
    s = adventureReducer(s, { type: 'CHOOSE_NODE', optionIdx: 0 });
    expect(s.phase).toBe('node');
    expect(s.currentNode).toBeTruthy();
  });

  it('战斗胜利推进下一步并继承体力（+35 喘息）', () => {
    let s = mk();
    // 直接构造战斗节点
    s = { ...s, phase: 'node', currentNode: { type: 'battle', opponentId: '广场舞大妈' } };
    s = adventureReducer(s, { type: 'BATTLE_RESULT', win: true, remainingEnergy: 20, drop: { slot: 'grip', rarity: 'fine' }, coins: 30 });
    expect(s.stepIdx).toBe(1);
    expect(s.phase).toBe('pick');
    expect(s.carryEnergy).toBe(55);   // 20+35
    expect(s.coinsEarned).toBe(30);
    expect(s.drops).toHaveLength(1);
  });

  it('战斗失败 → failed（战利品保留）', () => {
    let s = mk();
    s = { ...s, phase: 'node', currentNode: { type: 'battle', opponentId: '广场舞大妈' } };
    s = adventureReducer(s, { type: 'BATTLE_RESULT', win: false, remainingEnergy: 0, drop: null, coins: 15 });
    expect(s.phase).toBe('failed');
    expect(s.coinsEarned).toBe(15);
  });

  it('事件奖励：属性入 runStats、体力上限、回体、随机属性', () => {
    let s = mk();
    s = { ...s, phase: 'node', currentNode: { type: 'event' } };
    s = adventureReducer(s, { type: 'EVENT_DONE', reward: { kind: 'stat', stat: 'skill', amount: 8 }, statRoll: 0 });
    expect(s.runStats.skill).toBe(8);
    s = { ...s, phase: 'node', currentNode: { type: 'event' } };
    s = adventureReducer(s, { type: 'EVENT_DONE', reward: { kind: 'energyMax', amount: 5 }, statRoll: 0 });
    expect(s.tempEnergyMax).toBe(5);
    s = { ...s, phase: 'node', currentNode: { type: 'event' }, carryEnergy: 30 };
    s = adventureReducer(s, { type: 'EVENT_DONE', reward: { kind: 'heal', amount: 50 }, statRoll: 0 });
    expect(s.carryEnergy).toBe(80);
    s = { ...s, phase: 'node', currentNode: { type: 'event' } };
    s = adventureReducer(s, { type: 'EVENT_DONE', reward: { kind: 'stat', stat: 'random', amount: 6 }, statRoll: 0 });
    expect(s.runStats.sta).toBe(6);   // roll 0 → sta
  });

  it('healDelta 副作用（剑冢参悟：加点但掉体力）', () => {
    let s = { ...mk(), phase: 'node', currentNode: { type: 'event' }, carryEnergy: 50 };
    s = adventureReducer(s, {
      type: 'EVENT_DONE',
      reward: { kind: 'stat', stat: 'skill', amount: 6, healDelta: -20 },
      statRoll: 0,
    });
    expect(s.runStats.skill).toBe(6);
    expect(s.carryEnergy).toBe(30);
  });

  it('整章打穿进入下一章；BOSS 胜利 → victory', () => {
    let s = mk();
    // 连续清步直到第三章 BOSS
    let guard = 0;
    while (s.phase === 'pick' && guard++ < 40) {
      s = clearStep(s);
    }
    expect(s.phase).toBe('victory');
    expect(s.chapterIdx).toBe(2);
  });

  it('BATTLE_RESULT 胜利时保存 lastMatchStats，供攻防回顾', () => {
    let s = mk();
    s = { ...s, phase: 'node', currentNode: { type: 'battle', opponentId: '广场舞大妈' } };
    const matchStats = { countersWon: 3, counterLost: 1, aces: 0, clutchWins: 0 };
    s = adventureReducer(s, { type: 'BATTLE_RESULT', win: true, remainingEnergy: 40, drop: null, coins: 30, matchStats });
    expect(s.lastMatchStats).toEqual(matchStats);
    expect(s.phase).toBe('pick');
  });

  it('BATTLE_RESULT 失败时也保存 lastMatchStats', () => {
    let s = mk();
    s = { ...s, phase: 'node', currentNode: { type: 'battle', opponentId: '广场舞大妈' } };
    const matchStats = { countersWon: 0, counterLost: 4, aces: 0, clutchWins: 0 };
    s = adventureReducer(s, { type: 'BATTLE_RESULT', win: false, remainingEnergy: 0, drop: null, coins: 15, matchStats });
    expect(s.lastMatchStats).toEqual(matchStats);
    expect(s.phase).toBe('failed');
  });

  it('无 matchStats 时 lastMatchStats 为 null', () => {
    let s = mk();
    s = { ...s, phase: 'node', currentNode: { type: 'battle', opponentId: '广场舞大妈' } };
    s = adventureReducer(s, { type: 'BATTLE_RESULT', win: true, remainingEnergy: 40, drop: null, coins: 30 });
    expect(s.lastMatchStats).toBeNull();
  });

  it('快照 JSON 往返', () => {
    let s = clearStep(mk());
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});
