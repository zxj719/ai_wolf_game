import { describe, it, expect, beforeEach } from 'vitest';
import {
  formatTime,
  buildShareText,
  computeGrade,
  SPRINT_DURATION_S,
  WIN_PTS,
  LOSS_PTS,
} from '../modes/SprintScreen';
import {
  loadSprintHiscores,
  saveSprintHiscore,
  clearSprintHiscores,
} from '../modes/sprintScores';

describe('SprintScreen — constants', () => {
  it('SPRINT_DURATION_S is 15 minutes', () => {
    expect(SPRINT_DURATION_S).toBe(900);
  });
  it('WIN_PTS is 3', () => {
    expect(WIN_PTS).toBe(3);
  });
  it('LOSS_PTS is 1', () => {
    expect(LOSS_PTS).toBe(1);
  });
});

describe('formatTime', () => {
  it('formats 0 as 0:00', () => {
    expect(formatTime(0)).toBe('0:00');
  });
  it('formats 60 as 1:00', () => {
    expect(formatTime(60)).toBe('1:00');
  });
  it('formats 900 as 15:00', () => {
    expect(formatTime(900)).toBe('15:00');
  });
  it('pads seconds with leading zero', () => {
    expect(formatTime(65)).toBe('1:05');
  });
  it('formats 179 as 2:59', () => {
    expect(formatTime(179)).toBe('2:59');
  });
});

describe('buildShareText', () => {
  const GRADES = [
    { totalPts: 33, label: '传说冲分王', icon: '🏆' },
    { totalPts: 20, label: '进阶冲刺手', icon: '🥈' },
    { totalPts: 10, label: '坚持就是胜利', icon: '🥉' },
    { totalPts: 5, label: '参与奖领取中…', icon: '🎾' },
  ];

  it('includes totalPts in share text', () => {
    const text = buildShareText({ totalPts: 27, matchCount: 9, winCount: 7, grade: { label: '进阶冲刺手', icon: '🥈' } });
    expect(text).toContain('27分');
  });

  it('includes matchCount in share text', () => {
    const text = buildShareText({ totalPts: 27, matchCount: 9, winCount: 7, grade: { label: '进阶冲刺手', icon: '🥈' } });
    expect(text).toContain('9场');
  });

  it('includes winCount in share text', () => {
    const text = buildShareText({ totalPts: 27, matchCount: 9, winCount: 7, grade: { label: '进阶冲刺手', icon: '🥈' } });
    expect(text).toContain('7胜');
  });

  it('includes grade label and icon in share text', () => {
    const text = buildShareText({ totalPts: 27, matchCount: 9, winCount: 7, grade: { label: '进阶冲刺手', icon: '🥈' } });
    expect(text).toContain('进阶冲刺手🥈');
  });

  it('includes timer emoji', () => {
    const text = buildShareText({ totalPts: 5, matchCount: 2, winCount: 1, grade: { label: '参与奖领取中…', icon: '🎾' } });
    expect(text).toContain('⏱️');
  });

  it.each(GRADES)('produces correct share text for grade "$label"', ({ totalPts, label, icon }) => {
    const text = buildShareText({ totalPts, matchCount: 5, winCount: 3, grade: { label, icon } });
    expect(text).toContain(`${label}${icon}`);
    expect(text).toContain(`${totalPts}分`);
  });

  it('zero score edge case', () => {
    const text = buildShareText({ totalPts: 0, matchCount: 0, winCount: 0, grade: { label: '参与奖领取中…', icon: '🎾' } });
    expect(text).toContain('0分');
    expect(text).toContain('0场');
    expect(text).toContain('0胜');
  });
});

describe('computeGrade', () => {
  it('returns 传说冲分王 for 30', () => {
    const g = computeGrade(30);
    expect(g.label).toBe('传说冲分王');
    expect(g.icon).toBe('🏆');
  });
  it('returns 传说冲分王 for 99', () => {
    expect(computeGrade(99).label).toBe('传说冲分王');
  });
  it('returns 进阶冲刺手 for 18', () => {
    const g = computeGrade(18);
    expect(g.label).toBe('进阶冲刺手');
    expect(g.icon).toBe('🥈');
  });
  it('returns 进阶冲刺手 for 29', () => {
    expect(computeGrade(29).icon).toBe('🥈');
  });
  it('returns 坚持就是胜利 for 9', () => {
    const g = computeGrade(9);
    expect(g.label).toBe('坚持就是胜利');
    expect(g.icon).toBe('🥉');
  });
  it('returns 坚持就是胜利 for 17', () => {
    expect(computeGrade(17).label).toBe('坚持就是胜利');
  });
  it('returns 参与奖领取中… for 8', () => {
    const g = computeGrade(8);
    expect(g.label).toBe('参与奖领取中…');
    expect(g.icon).toBe('🎾');
  });
  it('returns 参与奖领取中… for 0', () => {
    expect(computeGrade(0).icon).toBe('🎾');
  });
});

describe('sprintScores', () => {
  beforeEach(() => { clearSprintHiscores(); });

  it('loads empty array initially', () => {
    expect(loadSprintHiscores()).toEqual([]);
  });

  it('saveSprintHiscore returns rank 1 and isNew for first entry', () => {
    const { rank, isNew } = saveSprintHiscore(
      { totalPts: 15, matchCount: 5, winCount: 3, grade: { label: '坚持就是胜利', icon: '🥉' }, playerName: '诚' },
      { now: 1000 },
    );
    expect(rank).toBe(1);
    expect(isNew).toBe(true);
  });

  it('saves entry that can be loaded back', () => {
    saveSprintHiscore(
      { totalPts: 21, matchCount: 7, winCount: 5, grade: { label: '进阶冲刺手', icon: '🥈' }, playerName: 'Elza' },
      { now: 5000 },
    );
    const list = loadSprintHiscores();
    expect(list).toHaveLength(1);
    expect(list[0].pts).toBe(21);
    expect(list[0].player).toBe('Elza');
  });

  it('sorts by pts descending', () => {
    saveSprintHiscore({ totalPts: 10, matchCount: 4, winCount: 2, grade: { label: '坚持就是胜利', icon: '🥉' }, playerName: 'A' }, { now: 1000 });
    saveSprintHiscore({ totalPts: 25, matchCount: 8, winCount: 6, grade: { label: '进阶冲刺手', icon: '🥈' }, playerName: 'B' }, { now: 2000 });
    saveSprintHiscore({ totalPts: 5, matchCount: 2, winCount: 1, grade: { label: '参与奖领取中…', icon: '🎾' }, playerName: 'C' }, { now: 3000 });
    const list = loadSprintHiscores();
    expect(list[0].pts).toBe(25);
    expect(list[1].pts).toBe(10);
    expect(list[2].pts).toBe(5);
  });

  it('new high score gets rank 1', () => {
    saveSprintHiscore({ totalPts: 12, matchCount: 4, winCount: 2, grade: { label: '坚持就是胜利', icon: '🥉' }, playerName: 'A' }, { now: 1000 });
    const { rank } = saveSprintHiscore({ totalPts: 35, matchCount: 12, winCount: 10, grade: { label: '传说冲分王', icon: '🏆' }, playerName: 'B' }, { now: 2000 });
    expect(rank).toBe(1);
  });

  it('lower score gets lower rank', () => {
    saveSprintHiscore({ totalPts: 30, matchCount: 10, winCount: 8, grade: { label: '传说冲分王', icon: '🏆' }, playerName: 'A' }, { now: 1000 });
    const { rank } = saveSprintHiscore({ totalPts: 6, matchCount: 2, winCount: 1, grade: { label: '参与奖领取中…', icon: '🎾' }, playerName: 'B' }, { now: 2000 });
    expect(rank).toBe(2);
  });

  it('tie-breaks: earlier timestamp wins (lower rank number = better)', () => {
    saveSprintHiscore({ totalPts: 20, matchCount: 7, winCount: 5, grade: { label: '进阶冲刺手', icon: '🥈' }, playerName: 'A' }, { now: 1000 });
    const { rank } = saveSprintHiscore({ totalPts: 20, matchCount: 7, winCount: 5, grade: { label: '进阶冲刺手', icon: '🥈' }, playerName: 'B' }, { now: 2000 });
    expect(rank).toBe(2);
  });

  it('caps at 10 entries, keeps highest scorers', () => {
    for (let i = 0; i < 12; i++) {
      saveSprintHiscore(
        { totalPts: i * 3, matchCount: i, winCount: Math.floor(i / 2), grade: { label: '参与奖领取中…', icon: '🎾' }, playerName: 'X' },
        { now: i * 1000 },
      );
    }
    const list = loadSprintHiscores();
    expect(list).toHaveLength(10);
    // The two lowest (0 and 3 pts) should be evicted
    expect(list.every((s) => s.pts >= 6)).toBe(true);
  });

  it('clearSprintHiscores empties the board', () => {
    saveSprintHiscore({ totalPts: 10, matchCount: 3, winCount: 2, grade: { label: '坚持就是胜利', icon: '🥉' }, playerName: 'X' }, { now: 1 });
    clearSprintHiscores();
    expect(loadSprintHiscores()).toEqual([]);
  });
});
