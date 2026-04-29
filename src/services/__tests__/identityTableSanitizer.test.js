import { describe, expect, it } from 'vitest';
import { sanitizeIdentityTable } from '../identityTableSanitizer.js';

describe('sanitizeIdentityTable', () => {
  it('does not erase dead confirmed wolves when capping live wolf suspects', () => {
    const players = [
      { id: 0, role: '狼人', isAlive: true },
      { id: 1, role: '狼人', isAlive: false },
      { id: 2, role: '守卫', isAlive: true },
      { id: 7, role: '猎人', isAlive: true },
    ];
    const gameSetup = { STANDARD_ROLES: ['狼人', '狼人', '守卫', '猎人'] };

    const { identityTable } = sanitizeIdentityTable({
      0: { suspect: '狼人', confidence: 100, reason: '我是狼人' },
      1: { suspect: '狼人', confidence: 100, reason: '狼队友，已出局' },
      7: { suspect: '狼人', confidence: 75, reason: '疑似带节奏' },
    }, { players, gameSetup });

    expect(identityTable['0'].suspect).toBe('狼人');
    expect(identityTable['1'].suspect).toBe('狼人');
    expect(identityTable['7'].suspect).toBe('未知');
  });
});
