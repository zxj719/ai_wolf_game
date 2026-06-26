import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { computeCharStats, findBestChar, saveLocalRecord, loadLocalRecords, clearLocalRecords } from '../localBoard';

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
