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
  isToday,
  computeEff,
  getTodayEffBoard,
  isThisMonth,
  getPersonalMonthlyBest,
  computeAchievements,
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

describe('isToday', () => {
  // Anchor: 2026-07-05 12:00:00 UTC = ms value chosen for stable test reference
  const ANCHOR = new Date('2026-07-05T12:00:00Z').getTime();
  const SAME_DAY_MORNING = new Date('2026-07-05T01:30:00Z').getTime();
  const SAME_DAY_NIGHT   = new Date('2026-07-05T23:59:00Z').getTime();
  const YESTERDAY        = new Date('2026-07-04T23:00:00Z').getTime();
  const TOMORROW         = new Date('2026-07-06T01:00:00Z').getTime();

  it('returns true when ts matches the injected today (same ms)', () => {
    expect(isToday(ANCHOR, { today: ANCHOR })).toBe(true);
  });

  it('returns true for early-morning timestamp on same day', () => {
    expect(isToday(SAME_DAY_MORNING, { today: ANCHOR })).toBe(true);
  });

  it('returns true for late-night timestamp on same day', () => {
    expect(isToday(SAME_DAY_NIGHT, { today: ANCHOR })).toBe(true);
  });

  it('returns false for yesterday timestamp', () => {
    expect(isToday(YESTERDAY, { today: ANCHOR })).toBe(false);
  });

  it('returns false for tomorrow timestamp', () => {
    expect(isToday(TOMORROW, { today: ANCHOR })).toBe(false);
  });

  it('works without injected today (does not throw)', () => {
    expect(() => isToday(ANCHOR)).not.toThrow();
  });
});

describe('computeEff', () => {
  it('returns pts divided by matchCount', () => {
    expect(computeEff(9, 3)).toBe(3);
  });
  it('returns null for 0 matchCount', () => {
    expect(computeEff(9, 0)).toBeNull();
  });
  it('handles fractional result', () => {
    expect(computeEff(7, 3)).toBeCloseTo(2.333, 2);
  });
  it('returns 1 when all losses', () => {
    expect(computeEff(4, 4)).toBe(1);
  });
  it('returns 3 when all wins', () => {
    expect(computeEff(12, 4)).toBe(3);
  });
});

describe('getTodayEffBoard', () => {
  const ANCHOR    = new Date('2026-07-05T12:00:00Z').getTime();
  const YESTERDAY = new Date('2026-07-04T12:00:00Z').getTime();
  const G = { label: '坚持就是胜利', icon: '🥉' };
  const save = (pts, matches, name, ts) =>
    saveSprintHiscore({ totalPts: pts, matchCount: matches, winCount: 0, grade: G, playerName: name }, { now: ts });

  beforeEach(() => clearSprintHiscores());

  it('returns empty array for empty hiscores', () => {
    expect(getTodayEffBoard([], { today: ANCHOR })).toEqual([]);
  });

  it('filters out non-today entries', () => {
    save(15, 5, 'A', YESTERDAY);
    const board = getTodayEffBoard(loadSprintHiscores(), { today: ANCHOR });
    expect(board).toHaveLength(0);
  });

  it('includes today entries', () => {
    save(9, 3, 'A', ANCHOR);
    const board = getTodayEffBoard(loadSprintHiscores(), { today: ANCHOR });
    expect(board).toHaveLength(1);
    expect(board[0].player).toBe('A');
  });

  it('sorts by efficiency descending', () => {
    save(8, 4, 'B', ANCHOR + 1000); // eff 2.0
    save(9, 3, 'A', ANCHOR);        // eff 3.0
    const board = getTodayEffBoard(loadSprintHiscores(), { today: ANCHOR });
    expect(board[0].player).toBe('A');
    expect(board[1].player).toBe('B');
  });

  it('tie-breaks by pts descending when same eff', () => {
    save(8, 4, 'B', ANCHOR + 1000);  // eff 2.0, pts 8
    save(12, 6, 'C', ANCHOR + 2000); // eff 2.0, pts 12
    const board = getTodayEffBoard(loadSprintHiscores(), { today: ANCHOR });
    expect(board[0].player).toBe('C');
    expect(board[1].player).toBe('B');
  });

  it('tie-breaks by timestamp ascending when eff and pts equal', () => {
    save(9, 3, 'B', ANCHOR + 1500);
    save(9, 3, 'A', ANCHOR + 500);
    const board = getTodayEffBoard(loadSprintHiscores(), { today: ANCHOR });
    expect(board[0].player).toBe('A');
  });

  it('filters out entries with 0 matches', () => {
    saveSprintHiscore({ totalPts: 0, matchCount: 0, winCount: 0, grade: G, playerName: 'Z' }, { now: ANCHOR });
    const board = getTodayEffBoard(loadSprintHiscores(), { today: ANCHOR });
    expect(board).toHaveLength(0);
  });

  it('mixes today and non-today, returns only today', () => {
    save(15, 5, 'D', YESTERDAY);
    save(9, 3, 'A', ANCHOR);
    save(6, 2, 'B', ANCHOR + 1000);
    const board = getTodayEffBoard(loadSprintHiscores(), { today: ANCHOR });
    expect(board).toHaveLength(2);
    expect(board.every((s) => s.player !== 'D')).toBe(true);
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

describe('isThisMonth', () => {
  const ANCHOR        = new Date('2026-07-05T12:00:00Z').getTime();
  const SAME_MONTH_1  = new Date('2026-07-01T00:00:00Z').getTime();
  const SAME_MONTH_31 = new Date('2026-07-31T23:59:00Z').getTime();
  const PREV_MONTH    = new Date('2026-06-30T23:59:00Z').getTime();
  const NEXT_MONTH    = new Date('2026-08-01T00:00:00Z').getTime();
  const LAST_YEAR     = new Date('2025-07-05T12:00:00Z').getTime();

  it('returns true for same timestamp', () => {
    expect(isThisMonth(ANCHOR, { today: ANCHOR })).toBe(true);
  });
  it('returns true for first day of the month', () => {
    expect(isThisMonth(SAME_MONTH_1, { today: ANCHOR })).toBe(true);
  });
  it('returns true for last day of the month', () => {
    expect(isThisMonth(SAME_MONTH_31, { today: ANCHOR })).toBe(true);
  });
  it('returns false for last day of previous month', () => {
    expect(isThisMonth(PREV_MONTH, { today: ANCHOR })).toBe(false);
  });
  it('returns false for first day of next month', () => {
    expect(isThisMonth(NEXT_MONTH, { today: ANCHOR })).toBe(false);
  });
  it('returns false for same day+month in previous year', () => {
    expect(isThisMonth(LAST_YEAR, { today: ANCHOR })).toBe(false);
  });
  it('works without injected today (does not throw)', () => {
    expect(() => isThisMonth(ANCHOR)).not.toThrow();
  });
});

describe('computeAchievements', () => {
  const W = { win: true };
  const L = { win: false };

  it('returns [] for empty results', () => {
    expect(computeAchievements([])).toEqual([]);
  });

  it('returns [] for null results', () => {
    expect(computeAchievements(null)).toEqual([]);
  });

  it('returns [完美收官] for single win', () => {
    const result = computeAchievements([W]);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('完美收官');
  });

  it('returns [] for single loss', () => {
    expect(computeAchievements([L])).toEqual([]);
  });

  it('全场全胜 requires 3+ all-win matches', () => {
    // 2 wins — not enough for 全场全胜
    const two = computeAchievements([W, W]);
    expect(two.some((a) => a.label === '全场全胜')).toBe(false);
    // 3 wins — should trigger
    const three = computeAchievements([W, W, W]);
    expect(three.some((a) => a.label === '全场全胜')).toBe(true);
  });

  it('全场全胜 not awarded when any match is a loss', () => {
    const result = computeAchievements([W, W, L, W, W]);
    expect(result.some((a) => a.label === '全场全胜')).toBe(false);
  });

  it('三连胜 awarded for 3 consecutive wins anywhere', () => {
    // Loss then 3 wins
    const result = computeAchievements([L, W, W, W]);
    expect(result.some((a) => a.label === '三连胜')).toBe(true);
  });

  it('三连胜 not awarded when max streak is 2', () => {
    const result = computeAchievements([W, W, L, W, W]);
    expect(result.some((a) => a.label === '三连胜')).toBe(false);
  });

  it('逆势翻盘 awarded when behind early and last match a win', () => {
    // L, L, W, W, W — was behind (0-2 after 2nd match), finished with 3 wins
    const result = computeAchievements([L, L, W, W, W]);
    expect(result.some((a) => a.label === '逆势翻盘')).toBe(true);
  });

  it('逆势翻盘 not awarded when last match is a loss', () => {
    const result = computeAchievements([L, W, W, L]);
    expect(result.some((a) => a.label === '逆势翻盘')).toBe(false);
  });

  it('逆势翻盘 not awarded when never behind', () => {
    // W, L, W → never had losses > wins
    const result = computeAchievements([W, L, W]);
    expect(result.some((a) => a.label === '逆势翻盘')).toBe(false);
  });

  it('铁打意志 awarded for 6+ matches', () => {
    const six = computeAchievements([L, L, L, L, L, L]);
    expect(six.some((a) => a.label === '铁打意志')).toBe(true);
    const five = computeAchievements([L, L, L, L, L]);
    expect(five.some((a) => a.label === '铁打意志')).toBe(false);
  });

  it('caps at 3 achievements even when more are earned', () => {
    // 6 all wins: 全场全胜 + 完美收官 + 三连胜 + 铁打意志 = 4 earned → capped to 3
    const result = computeAchievements([W, W, W, W, W, W]);
    expect(result).toHaveLength(3);
  });

  it('returns highest-prestige achievements first when capping', () => {
    // 6 all wins: should pick 全场全胜(6) > 完美收官(4) > 三连胜(3), dropping 铁打意志(1)
    const result = computeAchievements([W, W, W, W, W, W]);
    const labels = result.map((a) => a.label);
    expect(labels[0]).toBe('全场全胜');
    expect(labels).toContain('完美收官');
    expect(labels).toContain('三连胜');
    expect(labels).not.toContain('铁打意志');
  });

  it('each achievement has icon, label, and color fields', () => {
    const result = computeAchievements([W, W, W]);
    result.forEach((a) => {
      expect(typeof a.icon).toBe('string');
      expect(typeof a.label).toBe('string');
      expect(typeof a.color).toBe('string');
    });
  });
});

describe('getPersonalMonthlyBest', () => {
  const ANCHOR     = new Date('2026-07-05T12:00:00Z').getTime();
  const PREV_MONTH = new Date('2026-06-15T12:00:00Z').getTime();
  const G = { label: '坚持就是胜利', icon: '🥉' };
  const save = (pts, name, ts) =>
    saveSprintHiscore(
      { totalPts: pts, matchCount: Math.max(1, Math.ceil(pts / 2)), winCount: 0, grade: G, playerName: name },
      { now: ts },
    );

  beforeEach(() => clearSprintHiscores());

  it('returns null for empty hiscores', () => {
    expect(getPersonalMonthlyBest([], 'A', { today: ANCHOR })).toBeNull();
  });

  it('returns null when player has no records this month', () => {
    save(15, 'A', PREV_MONTH);
    expect(getPersonalMonthlyBest(loadSprintHiscores(), 'A', { today: ANCHOR })).toBeNull();
  });

  it('returns the single record when only one this month', () => {
    save(12, 'A', ANCHOR);
    const best = getPersonalMonthlyBest(loadSprintHiscores(), 'A', { today: ANCHOR });
    expect(best).not.toBeNull();
    expect(best.pts).toBe(12);
    expect(best.player).toBe('A');
  });

  it('returns highest pts among multiple records this month', () => {
    save(9, 'A', ANCHOR);
    save(18, 'A', ANCHOR + 1000);
    save(6, 'A', ANCHOR + 2000);
    const best = getPersonalMonthlyBest(loadSprintHiscores(), 'A', { today: ANCHOR });
    expect(best.pts).toBe(18);
  });

  it('ignores other players — returns only for requested playerName', () => {
    save(30, 'B', ANCHOR);
    save(9, 'A', ANCHOR + 500);
    const best = getPersonalMonthlyBest(loadSprintHiscores(), 'A', { today: ANCHOR });
    expect(best.pts).toBe(9);
    expect(best.player).toBe('A');
  });

  it('ignores records from previous months', () => {
    save(50, 'A', PREV_MONTH);
    save(9, 'A', ANCHOR);
    const best = getPersonalMonthlyBest(loadSprintHiscores(), 'A', { today: ANCHOR });
    expect(best.pts).toBe(9);
  });

  it('tie-breaks equal pts by earliest timestamp', () => {
    save(15, 'A', ANCHOR + 2000);
    save(15, 'A', ANCHOR + 500);
    const best = getPersonalMonthlyBest(loadSprintHiscores(), 'A', { today: ANCHOR });
    expect(best.ts).toBe(ANCHOR + 500);
  });
});
