import { describe, it, expect } from 'vitest';
import { tennisReducer, initialState, gradeFromMs } from '../useTennisGame';

const start = () =>
  tennisReducer(initialState, {
    type: 'START',
    playerName: '诚',
    oppName: 'Elza',
    oppStats: { sta: 60, skill: 60, mind: 60 },
  });

/** 快速推进到比赛阶段：S 级天赋 + 4 轮全选第一项 */
function toMatch() {
  let s = start();
  s = tennisReducer(s, { type: 'SET_REACTION', ms: 200 });
  s = tennisReducer(s, { type: 'TO_PREP' });
  for (let i = 0; i < 4; i++) {
    s = tennisReducer(s, { type: 'PICK_PREP', optIdx: 0 });
  }
  return s;
}

describe('gradeFromMs（与原版阈值 1:1）', () => {
  it.each([
    [249, 'S', 90],
    [250, 'A', 70],
    [399, 'A', 70],
    [400, 'B', 50],
    [599, 'B', 50],
    [600, 'C', 30],
  ])('%ims → %s级 talent %i', (ms, grade, talent) => {
    expect(gradeFromMs(ms)).toMatchObject({ grade, talent });
  });
});

describe('tennisReducer', () => {
  it('START 装载玩家与对手并进入反应测试', () => {
    const s = start();
    expect(s.screen).toBe('react');
    expect(s.player).toMatchObject({ name: '诚', face: '🐯', sta: 0, skill: 0, mind: 0, ms: null });
    expect(s.opp).toMatchObject({ name: 'Elza', face: '🦊', sta: 60, skill: 60, mind: 60 });
  });

  it('SET_REACTION 定级；TO_PREP 进入备战', () => {
    let s = tennisReducer(start(), { type: 'SET_REACTION', ms: 320 });
    expect(s.player).toMatchObject({ ms: 320, grade: 'A', talent: 70 });
    s = tennisReducer(s, { type: 'TO_PREP' });
    expect(s.screen).toBe('prep');
    expect(s.prepRound).toBe(0);
  });

  it('PICK_PREP 应用加点、负值不低于 0、4 轮后进比赛', () => {
    let s = tennisReducer(start(), { type: 'SET_REACTION', ms: 200 });
    s = tennisReducer(s, { type: 'TO_PREP' });
    // 第一回合选项 A：sta+20, mind-10（mind 0 → clamp 0）
    s = tennisReducer(s, { type: 'PICK_PREP', optIdx: 0 });
    expect(s.player.sta).toBe(20);
    expect(s.player.mind).toBe(0);
    expect(s.prepRound).toBe(1);
    for (let i = 0; i < 3; i++) s = tennisReducer(s, { type: 'PICK_PREP', optIdx: 0 });
    expect(s.screen).toBe('match');
    expect(s.setIdx).toBe(0);
    expect(s.setsP).toBe(0);
  });

  it('PLAY_SCENE 比大小：玩家 base+talent*0.4+roll vs 对手，平分主队胜', () => {
    let s = toMatch();
    // 玩家 sta 此时 = 20+25+20+20 = 85? 取决于加点表——直接读 state 算期望
    const p = s.player;
    const attr = 'sta'; // 第一盘第一球选项 A 比拼体力
    const pBase = p[attr] + Math.round(p.talent * 0.4);
    const oBase = s.opp[attr];
    const oRoll = pBase + 1 - oBase; // 设计平分：oTot === pTot（pRoll=1）
    s = tennisReducer(s, { type: 'PLAY_SCENE', optIdx: 0, pRoll: 1, oRoll });
    expect(s.lastRally.pTot).toBe(s.lastRally.oTot);
    expect(s.lastRally.win).toBe(true); // 鹰眼偏主队
    expect(s.sceneP).toBe(1);
  });

  it('NEXT_SCENE：2 球拿下一盘，1:1 跳决胜盘（setIdx=2），2 盘定胜负进结局', () => {
    let s = toMatch();
    const winScene = () => {
      s = tennisReducer(s, { type: 'PLAY_SCENE', optIdx: 0, pRoll: 20, oRoll: 1 });
      s = tennisReducer(s, { type: 'NEXT_SCENE' });
    };
    const loseScene = () => {
      s = tennisReducer(s, { type: 'PLAY_SCENE', optIdx: 0, pRoll: -999, oRoll: 12 });
      s = tennisReducer(s, { type: 'NEXT_SCENE' });
    };
    winScene(); winScene();          // 第一盘 2-0 拿下
    expect(s.setsP).toBe(1);
    expect(s.setIdx).toBe(1);
    expect(s.sceneP).toBe(0);
    loseScene(); loseScene();        // 第二盘丢了 → 1:1 跳决胜盘
    expect(s.setsO).toBe(1);
    expect(s.setIdx).toBe(2);
    winScene(); winScene();          // 决胜盘拿下 → 结局
    expect(s.screen).toBe('result');
    expect(s.setsP).toBe(2);
    expect(s.setHistory).toEqual(['W', 'L', 'W']);
  });

  it('决胜盘比拼总战力（含 talent 全额）', () => {
    let s = toMatch();
    // 直接构造进入决胜盘
    s = { ...s, setIdx: 2, setsP: 1, setsO: 1, sceneIdx: 0, sceneP: 0, sceneO: 0 };
    const p = s.player, o = s.opp;
    s = tennisReducer(s, { type: 'PLAY_SCENE', optIdx: 0, pRoll: 5, oRoll: 5 });
    expect(s.lastRally.pBase).toBe(p.sta + p.skill + p.mind + p.talent);
    expect(s.lastRally.oBase).toBe(o.sta + o.skill + o.mind);
  });

  it('REPLAY 重置回选人界面', () => {
    const s = tennisReducer(toMatch(), { type: 'REPLAY' });
    expect(s).toEqual(initialState);
  });
});
