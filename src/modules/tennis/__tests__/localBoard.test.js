import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { computeCharStats, findBestChar, saveLocalRecord, loadLocalRecords, clearLocalRecords, computeStreakCount, computeWeeklyChamp, computeCurrentWinStreak, computeRecentResults, computeOppRecentResults, computeOppWinStreak } from '../localBoard';

describe('computeCharStats', () => {
  it('未出战角色不出现在 map 中', () => {
    const result = computeCharStats([]);
    expect(result).toEqual({});
  });

  it('正确统计出战场次与胜场', () => {
    const records = [
      { p: '诚', o: 'Elza', sp: 2, so: 1 },
      { p: '诚', o: '菲比', sp: 1, so: 2 },
      { p: '诚', o: 'Ross', sp: 2, so: 0 },
      { p: 'Elza', o: '诚', sp: 2, so: 1 },
    ];
    const result = computeCharStats(records);
    expect(result['诚']).toEqual({ played: 3, won: 2 });
    expect(result['Elza']).toEqual({ played: 1, won: 1 });
    expect(result['菲比']).toBeUndefined();
  });

  it('平局（0-0）不计入胜场', () => {
    const records = [{ p: '丫', o: '莹', sp: 0, so: 0 }];
    const result = computeCharStats(records);
    expect(result['丫']).toEqual({ played: 1, won: 0 });
  });

  it('缺失 p 字段的记录被跳过', () => {
    const records = [
      { o: '铁蛋', sp: 2, so: 1 },
      { p: '莹', o: '铁蛋', sp: 2, so: 1 },
    ];
    const result = computeCharStats(records);
    expect(Object.keys(result)).toEqual(['莹']);
    expect(result['莹']).toEqual({ played: 1, won: 1 });
  });
});

describe('findBestChar', () => {
  it('空 map 返回 null', () => {
    expect(findBestChar({})).toBeNull();
  });

  it('所有角色出战场次不足 minPlayed 时返回 null', () => {
    const map = { 诚: { played: 1, won: 1 }, Elza: { played: 1, won: 0 } };
    expect(findBestChar(map, 2)).toBeNull();
  });

  it('返回满足 minPlayed 且胜率最高的角色', () => {
    const map = {
      诚: { played: 3, won: 2 },   // 66.7%
      Elza: { played: 4, won: 1 }, // 25%
      菲比: { played: 2, won: 2 }, // 100%
    };
    expect(findBestChar(map, 2)).toBe('菲比');
  });

  it('胜率相同时出战场次更多者优先', () => {
    const map = {
      诚: { played: 2, won: 2 },   // 100%, 2场
      Ross: { played: 5, won: 5 }, // 100%, 5场
    };
    expect(findBestChar(map, 2)).toBe('Ross');
  });

  it('won === 0 的角色不参与评选', () => {
    const map = {
      铁蛋: { played: 3, won: 0 }, // 0%
      丫: { played: 2, won: 1 },   // 50%
    };
    expect(findBestChar(map, 2)).toBe('丫');
  });

  it('自定义 minPlayed = 1 时单场胜利也可入选', () => {
    const map = { 莹: { played: 1, won: 1 } };
    expect(findBestChar(map, 1)).toBe('莹');
  });
});

describe('computeStreakCount', () => {
  const W = (n = '诚') => ({ p: n, o: 'Elza', sp: 2, so: 0 }); // 胜
  const L = (n = '诚') => ({ p: n, o: 'Elza', sp: 0, so: 2 }); // 败

  it('无历史记录时当前局本身算 1 连', () => {
    expect(computeStreakCount([], '诚', true)).toBe(1);
    expect(computeStreakCount([], '诚', false)).toBe(1);
  });

  it('连胜：历史末尾 3 胜 + 当前胜 = 4 连胜', () => {
    const records = [L(), W(), W(), W()];
    expect(computeStreakCount(records, '诚', true)).toBe(4);
  });

  it('连败：历史末尾 2 败 + 当前败 = 3 连败', () => {
    const records = [W(), L(), L()];
    expect(computeStreakCount(records, '诚', false)).toBe(3);
  });

  it('连胜被历史中的败局截断', () => {
    const records = [W(), L(), W(), W()]; // 最近 2 连胜
    expect(computeStreakCount(records, '诚', true)).toBe(3); // 当前胜 + 历史末 2 胜
  });

  it('只统计同名玩家的记录，其他玩家不干扰', () => {
    const records = [L('诚'), L('菲比'), L('菲比')];
    // 诚只有 1 败在历史，当前再败 = 2
    expect(computeStreakCount(records, '诚', false)).toBe(2);
    // 菲比历史末 2 败，当前再败 = 3
    expect(computeStreakCount(records, '菲比', false)).toBe(3);
  });

  it('sp === so（平局）视为败局，纳入连败计数', () => {
    const draw = { p: '诚', o: 'Elza', sp: 1, so: 1 };
    expect(computeStreakCount([draw], '诚', false)).toBe(2);
  });
});

describe('computeWeeklyChamp', () => {
  const NOW = 1_000_000_000_000; // 固定"当前"时间
  const WEEK = 7 * 24 * 60 * 60 * 1000;
  // 便捷构造器
  const rec = (p, pf, sp, so, ts) => ({ p, pf, o: 'Elza', of: '🦊', sp, so, ts });

  it('空记录返回 null', () => {
    expect(computeWeeklyChamp([], { now: NOW })).toBeNull();
  });

  it('无 ts 字段的旧记录被忽略', () => {
    const records = [{ p: '诚', pf: '🐯', o: 'Elza', sp: 2, so: 0 }]; // 无 ts
    expect(computeWeeklyChamp(records, { now: NOW })).toBeNull();
  });

  it('7 天外的记录被忽略', () => {
    const records = [rec('诚', '🐯', 2, 0, NOW - WEEK - 1)];
    expect(computeWeeklyChamp(records, { now: NOW })).toBeNull();
  });

  it('胜场不足 minWins 时返回 null', () => {
    const records = [rec('诚', '🐯', 2, 0, NOW - 1000)]; // 1 胜，默认 minWins=2
    expect(computeWeeklyChamp(records, { now: NOW })).toBeNull();
  });

  it('单角色满足 minWins 时正确返回', () => {
    const records = [
      rec('诚', '🐯', 2, 0, NOW - 1000),
      rec('诚', '🐯', 2, 1, NOW - 2000),
    ];
    const champ = computeWeeklyChamp(records, { now: NOW });
    expect(champ).toEqual({ name: '诚', face: '🐯', wins: 2, played: 2 });
  });

  it('返回胜场最多的角色', () => {
    const records = [
      rec('诚', '🐯', 2, 0, NOW - 1000),
      rec('诚', '🐯', 2, 0, NOW - 2000),
      rec('Elza', '🦊', 2, 0, NOW - 3000),
      rec('Elza', '🦊', 2, 0, NOW - 4000),
      rec('Elza', '🦊', 2, 0, NOW - 5000),
    ];
    const champ = computeWeeklyChamp(records, { now: NOW });
    expect(champ?.name).toBe('Elza');
    expect(champ?.wins).toBe(3);
  });

  it('胜场相同时出战场次更多者优先', () => {
    const records = [
      rec('诚', '🐯', 2, 0, NOW - 1000),
      rec('诚', '🐯', 2, 0, NOW - 2000),
      rec('诚', '🐯', 0, 2, NOW - 3000), // 额外出战 1 场，总 played=3
      rec('菲比', '🌸', 2, 0, NOW - 4000),
      rec('菲比', '🌸', 2, 0, NOW - 5000), // 同为 2 胜，played=2
    ];
    const champ = computeWeeklyChamp(records, { now: NOW });
    expect(champ?.name).toBe('诚'); // 胜场同，出战更多
  });

  it('恰好在截止时间边界内的记录被计入', () => {
    const ts = NOW - WEEK + 1; // 刚好在 7 天内
    const records = [
      rec('莹', '🌙', 2, 0, ts),
      rec('莹', '🌙', 2, 0, ts + 1000),
    ];
    const champ = computeWeeklyChamp(records, { now: NOW });
    expect(champ?.name).toBe('莹');
  });

  it('自定义 minWins=1 时单场胜利也可入选', () => {
    const records = [rec('丫', '🐰', 2, 0, NOW - 1000)];
    const champ = computeWeeklyChamp(records, { now: NOW, minWins: 1 });
    expect(champ?.name).toBe('丫');
  });
});

describe('computeRecentResults', () => {
  const mk = (p, sp, so) => ({ p, sp, so });

  it('空记录返回 []', () => {
    expect(computeRecentResults([], '诚')).toEqual([]);
  });

  it('玩家无历史记录返回 []', () => {
    expect(computeRecentResults([mk('Elza', 2, 1)], '诚')).toEqual([]);
  });

  it('单场胜利返回 [true]', () => {
    expect(computeRecentResults([mk('诚', 2, 1)], '诚')).toEqual([true]);
  });

  it('单场失败返回 [false]', () => {
    expect(computeRecentResults([mk('诚', 0, 2)], '诚')).toEqual([false]);
  });

  it('3 场记录全返回（旧→新顺序）', () => {
    const records = [mk('诚', 2, 0), mk('诚', 1, 2), mk('诚', 2, 1)];
    expect(computeRecentResults(records, '诚')).toEqual([true, false, true]);
  });

  it('记录超过 n=3 时只返回最近 3 条', () => {
    const records = [mk('诚', 2, 0), mk('诚', 2, 0), mk('诚', 0, 2), mk('诚', 2, 1), mk('诚', 0, 2)];
    expect(computeRecentResults(records, '诚')).toEqual([false, true, false]);
  });

  it('自定义 n=1 时只返回最后 1 条', () => {
    const records = [mk('诚', 2, 0), mk('诚', 0, 2)];
    expect(computeRecentResults(records, '诚', 1)).toEqual([false]);
  });

  it('n=0 时返回 []', () => {
    expect(computeRecentResults([mk('诚', 2, 0)], '诚', 0)).toEqual([]);
  });

  it('只统计指定玩家，忽略其他玩家记录', () => {
    const records = [mk('诚', 0, 2), mk('Elza', 2, 0), mk('诚', 2, 1)];
    expect(computeRecentResults(records, '诚')).toEqual([false, true]);
  });

  it('sp === so 视为败局返回 false', () => {
    expect(computeRecentResults([{ p: '丫', sp: 1, so: 1 }], '丫')).toEqual([false]);
  });
});

describe('computeOppRecentResults', () => {
  const mk = (p, o, sp, so) => ({ p, o, sp, so });

  it('空记录返回 []', () => {
    expect(computeOppRecentResults([], '诚', 'Elza')).toEqual([]);
  });

  it('玩家名不匹配时返回 []', () => {
    expect(computeOppRecentResults([mk('Elza', '诚', 2, 1)], '诚', '诚')).toEqual([]);
  });

  it('对手名不匹配时返回 []', () => {
    expect(computeOppRecentResults([mk('诚', 'Ross', 2, 1)], '诚', 'Elza')).toEqual([]);
  });

  it('单场对 Elza 胜返回 [true]', () => {
    expect(computeOppRecentResults([mk('诚', 'Elza', 2, 1)], '诚', 'Elza')).toEqual([true]);
  });

  it('单场对 Elza 败返回 [false]', () => {
    expect(computeOppRecentResults([mk('诚', 'Elza', 0, 2)], '诚', 'Elza')).toEqual([false]);
  });

  it('3 场对同一对手（旧→新顺序）', () => {
    const records = [mk('诚', 'Elza', 2, 0), mk('诚', 'Elza', 1, 2), mk('诚', 'Elza', 2, 1)];
    expect(computeOppRecentResults(records, '诚', 'Elza')).toEqual([true, false, true]);
  });

  it('超 3 场只返回最近 3 条', () => {
    const records = [
      mk('诚', 'Elza', 2, 0), mk('诚', 'Elza', 2, 0),
      mk('诚', 'Elza', 0, 2), mk('诚', 'Elza', 2, 1), mk('诚', 'Elza', 0, 2),
    ];
    expect(computeOppRecentResults(records, '诚', 'Elza')).toEqual([false, true, false]);
  });

  it('混杂其他玩家/对手记录时只统计指定组合', () => {
    const records = [
      mk('诚', 'Elza', 2, 0),
      mk('Elza', 'Elza', 2, 0), // 玩家不符
      mk('诚', 'Ross', 2, 0),   // 对手不符
      mk('诚', 'Elza', 0, 2),
    ];
    expect(computeOppRecentResults(records, '诚', 'Elza')).toEqual([true, false]);
  });

  it('n=0 时立即返回 []', () => {
    expect(computeOppRecentResults([mk('诚', 'Elza', 2, 0)], '诚', 'Elza', 0)).toEqual([]);
  });

  it('n=1 时只返回最后 1 条', () => {
    const records = [mk('诚', 'Elza', 2, 0), mk('诚', 'Elza', 0, 2)];
    expect(computeOppRecentResults(records, '诚', 'Elza', 1)).toEqual([false]);
  });
});

describe('computeOppWinStreak', () => {
  const mk = (p, o, sp, so) => ({ p, o, sp, so });

  it('空记录返回 0', () => {
    expect(computeOppWinStreak([], '诚', 'Elza')).toBe(0);
  });

  it('玩家名不匹配返回 0', () => {
    expect(computeOppWinStreak([mk('Elza', '诚', 2, 1)], '诚', '诚')).toBe(0);
  });

  it('对手名不匹配返回 0', () => {
    expect(computeOppWinStreak([mk('诚', 'Ross', 2, 1)], '诚', 'Elza')).toBe(0);
  });

  it('最近一场为败时返回 0', () => {
    const records = [mk('诚', 'Elza', 2, 0), mk('诚', 'Elza', 0, 2)];
    expect(computeOppWinStreak(records, '诚', 'Elza')).toBe(0);
  });

  it('单场胜利返回 1', () => {
    expect(computeOppWinStreak([mk('诚', 'Elza', 2, 1)], '诚', 'Elza')).toBe(1);
  });

  it('连续 3 胜返回 3', () => {
    const records = [mk('诚', 'Elza', 2, 0), mk('诚', 'Elza', 2, 1), mk('诚', 'Elza', 2, 0)];
    expect(computeOppWinStreak(records, '诚', 'Elza')).toBe(3);
  });

  it('中间有一败，只计末尾连胜', () => {
    const records = [
      mk('诚', 'Elza', 2, 0),
      mk('诚', 'Elza', 0, 2),
      mk('诚', 'Elza', 2, 1),
      mk('诚', 'Elza', 2, 0),
    ];
    expect(computeOppWinStreak(records, '诚', 'Elza')).toBe(2);
  });

  it('其他玩家或对手记录不干扰结果', () => {
    const records = [
      mk('诚', 'Ross', 2, 0),   // 对手不符
      mk('Elza', 'Elza', 2, 0), // 玩家不符
      mk('诚', 'Elza', 2, 1),
      mk('诚', 'Elza', 2, 0),
    ];
    expect(computeOppWinStreak(records, '诚', 'Elza')).toBe(2);
  });

  it('sp === so（平局）截断连胜返回 0', () => {
    const records = [mk('诚', 'Elza', 2, 0), mk('诚', 'Elza', 1, 1)];
    expect(computeOppWinStreak(records, '诚', 'Elza')).toBe(0);
  });
});

describe('computeCurrentWinStreak', () => {
  const mk = (p, sp, so) => ({ p, sp, so });

  it('空记录返回 0', () => {
    expect(computeCurrentWinStreak([], '诚')).toBe(0);
  });

  it('玩家无历史记录返回 0', () => {
    expect(computeCurrentWinStreak([mk('Elza', 2, 1)], '诚')).toBe(0);
  });

  it('最近一场为败时返回 0', () => {
    const records = [mk('诚', 2, 1), mk('诚', 1, 2)];
    expect(computeCurrentWinStreak(records, '诚')).toBe(0);
  });

  it('单场胜利返回 1', () => {
    expect(computeCurrentWinStreak([mk('诚', 2, 1)], '诚')).toBe(1);
  });

  it('连续 3 胜返回 3', () => {
    const records = [mk('诚', 2, 1), mk('诚', 2, 0), mk('诚', 2, 1)];
    expect(computeCurrentWinStreak(records, '诚')).toBe(3);
  });

  it('中间有一败则只计末尾连胜', () => {
    const records = [mk('诚', 2, 0), mk('诚', 1, 2), mk('诚', 2, 1), mk('诚', 2, 0)];
    expect(computeCurrentWinStreak(records, '诚')).toBe(2);
  });

  it('只统计指定玩家，忽略其他玩家记录', () => {
    const records = [mk('诚', 2, 1), mk('Elza', 1, 2), mk('诚', 2, 0)];
    expect(computeCurrentWinStreak(records, '诚')).toBe(2);
  });

  it('连胜 5 场正确返回 5', () => {
    const records = Array.from({ length: 5 }, () => mk('铁蛋', 2, 1));
    expect(computeCurrentWinStreak(records, '铁蛋')).toBe(5);
  });

  it('连胜 10 场正确返回 10', () => {
    const records = Array.from({ length: 10 }, () => mk('莹', 2, 0));
    expect(computeCurrentWinStreak(records, '莹')).toBe(10);
  });
});
