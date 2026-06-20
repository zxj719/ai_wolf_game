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
  s = tennisReducer(s, { type: 'SET_MODE', mode: 'single' });
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

describe('tennisReducer（外层流程：选角/反应/备战/结算）', () => {
  it('START 装载玩家与对手并进入模式选择', () => {
    const s = start();
    expect(s.screen).toBe('mode');
    expect(s.player).toMatchObject({ name: '诚', face: '🐯', sta: 0, skill: 0, mind: 0, ms: null });
    expect(s.opp).toMatchObject({ name: 'Elza', face: '🦊', sta: 60, skill: 60, mind: 60 });
  });

  it('SET_MODE 选模式后进入反应测试', () => {
    const s = tennisReducer(start(), { type: 'SET_MODE', mode: 'ladder' });
    expect(s.mode).toBe('ladder');
    expect(s.screen).toBe('react');
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
    s = tennisReducer(s, { type: 'PICK_PREP', optIdx: 0 });
    expect(s.player.sta).toBe(20);
    expect(s.player.mind).toBe(0);
    expect(s.prepRound).toBe(1);
    for (let i = 0; i < 3; i++) s = tennisReducer(s, { type: 'PICK_PREP', optIdx: 0 });
    expect(s.screen).toBe('match');
  });

  it('MATCH_OVER（v2 BattleScreen 回填）进入结算屏', () => {
    let s = toMatch();
    s = tennisReducer(s, { type: 'MATCH_OVER', setsP: 2, setsO: 1, setHistory: ['W', 'L', 'W'] });
    expect(s.screen).toBe('result');
    expect(s.setsP).toBe(2);
    expect(s.setsO).toBe(1);
    expect(s.setHistory).toEqual(['W', 'L', 'W']);
  });

  it('REPLAY 重置回选人界面', () => {
    const s = tennisReducer(toMatch(), { type: 'REPLAY' });
    expect(s).toEqual(initialState);
  });

  it('REMATCH 保留角色与对手、重置属性、回到反应测试', () => {
    let s = toMatch();
    s = tennisReducer(s, { type: 'MATCH_OVER', setsP: 2, setsO: 1, setHistory: ['W', 'L', 'W'] });
    const rematch = tennisReducer(s, { type: 'REMATCH' });
    expect(rematch.screen).toBe('react');
    expect(rematch.mode).toBe('single');
    expect(rematch.player.name).toBe('诚');
    expect(rematch.player.sta).toBe(0);
    expect(rematch.player.ms).toBeNull();
    expect(rematch.opp).toEqual({ name: 'Elza', face: '🦊', sta: 60, skill: 60, mind: 60 });
  });
});
