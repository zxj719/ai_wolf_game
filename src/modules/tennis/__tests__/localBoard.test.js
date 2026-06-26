import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { computeCharStats, saveLocalRecord, loadLocalRecords, clearLocalRecords } from '../localBoard';

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
