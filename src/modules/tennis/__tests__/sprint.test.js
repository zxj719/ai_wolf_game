import { describe, it, expect } from 'vitest';
import {
  formatTime,
  buildShareText,
  SPRINT_DURATION_S,
  WIN_PTS,
  LOSS_PTS,
} from '../modes/SprintScreen';

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
