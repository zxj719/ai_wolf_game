import { describe, it, expect, vi } from 'vitest';
import { checkGameEnd, isGoodMajority, getPlayer, isUserTurn, getCurrentNightRole } from '../gameUtils';

// Mock player factory
const makePlayer = (id, role, isAlive = true, isUser = false) => ({
  id, role, isAlive, isUser, name: `P${id}`
});

describe('checkGameEnd', () => {
  const addLog = vi.fn();
  const setGameResult = vi.fn();

  beforeEach(() => {
    addLog.mockClear();
    setGameResult.mockClear();
  });

  it('returns good_win when all wolves are dead', () => {
    const players = [
      makePlayer(0, '村民'), makePlayer(1, '预言家'),
      makePlayer(2, '狼人', false), makePlayer(3, '狼人', false),
    ];
    const result = checkGameEnd(players, 'edge', addLog, setGameResult);
    expect(result).toBe('good_win');
    expect(setGameResult).toHaveBeenCalledWith('good_win');
  });

  it('returns wolf_win in edge mode when all villagers are dead', () => {
    const players = [
      makePlayer(0, '村民', false), makePlayer(1, '村民', false),
      makePlayer(2, '狼人'), makePlayer(3, '预言家'),
    ];
    const result = checkGameEnd(players, 'edge', addLog, setGameResult);
    expect(result).toBe('wolf_win');
  });

  it('returns wolf_win in edge mode when all gods are dead', () => {
    const players = [
      makePlayer(0, '村民'), makePlayer(1, '预言家', false),
      makePlayer(2, '狼人'), makePlayer(3, '女巫', false),
    ];
    const result = checkGameEnd(players, 'edge', addLog, setGameResult);
    expect(result).toBe('wolf_win');
  });

  it('returns null in town mode when some good people are alive and outnumber wolves', () => {
    const players = [
      makePlayer(0, '村民', false), makePlayer(1, '预言家'),
      makePlayer(2, '狼人'), makePlayer(3, '村民'),
    ];
    // In town mode, 2 good (seer + villager) vs 1 wolf → game continues
    const result = checkGameEnd(players, 'town', addLog, setGameResult);
    expect(result).toBeNull();
  });

  it('returns wolf_win in town mode when all good people are dead', () => {
    const players = [
      makePlayer(0, '村民', false), makePlayer(1, '预言家', false),
      makePlayer(2, '狼人'),
    ];
    const result = checkGameEnd(players, 'town', addLog, setGameResult);
    expect(result).toBe('wolf_win');
  });

  it('returns wolf_win when wolves >= good people', () => {
    const players = [
      makePlayer(0, '村民'), makePlayer(1, '狼人'), makePlayer(2, '狼人'),
    ];
    const result = checkGameEnd(players, 'edge', addLog, setGameResult);
    expect(result).toBe('wolf_win');
  });

  it('returns null when game should continue', () => {
    const players = [
      makePlayer(0, '村民'), makePlayer(1, '预言家'),
      makePlayer(2, '狼人'), makePlayer(3, '村民'),
    ];
    const result = checkGameEnd(players, 'edge', addLog, setGameResult);
    expect(result).toBeNull();
  });
});

describe('isGoodMajority', () => {
  it('returns true when good > wolves', () => {
    const players = [
      makePlayer(0, '村民'), makePlayer(1, '预言家'), makePlayer(2, '狼人'),
    ];
    expect(isGoodMajority(players)).toBe(true);
  });

  it('returns false when wolves >= good', () => {
    const players = [
      makePlayer(0, '村民'), makePlayer(1, '狼人'), makePlayer(2, '狼人'),
    ];
    expect(isGoodMajority(players)).toBe(false);
  });

  it('only counts alive players', () => {
    const players = [
      makePlayer(0, '村民', false), makePlayer(1, '村民'),
      makePlayer(2, '狼人'),
    ];
    expect(isGoodMajority(players)).toBe(false);
  });
});

describe('getPlayer', () => {
  const players = [makePlayer(0, '村民'), makePlayer(1, '狼人')];

  it('finds player by id', () => {
    expect(getPlayer(players, 1).role).toBe('狼人');
  });

  it('returns undefined for non-existent id', () => {
    expect(getPlayer(players, 99)).toBeUndefined();
  });
});

describe('isUserTurn', () => {
  const nightSequence = ['GUARD', 'WEREWOLF', 'SEER', 'WITCH'];

  it('returns true when user role matches current step', () => {
    const userPlayer = { isAlive: true, role: '守卫' };
    expect(isUserTurn(userPlayer, 0, nightSequence)).toBe(true);
  });

  it('returns false when user role does not match', () => {
    const userPlayer = { isAlive: true, role: '村民' };
    expect(isUserTurn(userPlayer, 0, nightSequence)).toBe(false);
  });

  it('returns false when user is dead', () => {
    const userPlayer = { isAlive: false, role: '守卫' };
    expect(isUserTurn(userPlayer, 0, nightSequence)).toBe(false);
  });
});

describe('getCurrentNightRole', () => {
  const nightSequence = ['GUARD', 'WEREWOLF', 'SEER', 'WITCH'];

  it('returns correct role name for each step', () => {
    expect(getCurrentNightRole(0, nightSequence)).toBe('守卫');
    expect(getCurrentNightRole(1, nightSequence)).toBe('狼人');
    expect(getCurrentNightRole(2, nightSequence)).toBe('预言家');
    expect(getCurrentNightRole(3, nightSequence)).toBe('女巫');
  });

  it('returns empty string for out-of-bounds step', () => {
    expect(getCurrentNightRole(10, nightSequence)).toBe('');
  });
});
