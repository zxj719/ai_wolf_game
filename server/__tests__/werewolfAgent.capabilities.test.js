import { describe, it, expect } from 'vitest';
import { buildCapabilities } from '../werewolfAgent/capabilities.js';
import { getContract } from '../werewolfAgent/contracts.js';

function makePlayers() {
  return [
    { id: 1, role: '狼人',  isAlive: true },
    { id: 2, role: '狼人',  isAlive: true },
    { id: 3, role: '预言家', isAlive: true },
    { id: 4, role: '女巫',  isAlive: true,  hasWitchSave: true,  hasWitchPoison: true },
    { id: 5, role: '守卫',  isAlive: true },
    { id: 6, role: '猎人',  isAlive: false },
    { id: 7, role: '村民',  isAlive: true },
  ];
}

function baseGameState() {
  return {
    players: makePlayers(),
    deathHistory: [{ playerId: 6, day: 1, phase: '夜', cause: '被刀' }],
    voteHistory: [{ day: 1, eliminated: -1, votes: [{ from: 1, to: 7 }, { from: 7, to: 1 }] }],
    seerChecks: [{ seerId: 3, night: 1, targetId: 1, isWolf: true }],
    nightDecisions: { wolfTarget: 7, lastGuardTarget: 4 },
    dayCount: 2,
    phase: 'day_discussion',
  };
}

describe('werewolfAgent capabilities', () => {
  it('publicFacts excludes any private night thoughts (only structural fields)', () => {
    const caps = buildCapabilities({
      contract: getContract('DAY_SPEECH'),
      gameState: baseGameState(),
      params: {},
      player: { id: 7, role: '村民' },
    });
    const json = JSON.stringify(caps.publicFacts);
    expect(json).not.toMatch(/seerCheck|wolfTeam|私|private|targetId/i);
    expect(caps.publicFacts.alive).toEqual(expect.arrayContaining([1, 2, 3, 4, 5, 7]));
    expect(caps.publicFacts.dead).toEqual([6]);
  });

  it('privateFacts only exposes the current player\'s role-known information', () => {
    const seerCaps = buildCapabilities({
      contract: getContract('NIGHT_SEER'),
      gameState: baseGameState(),
      params: { validTargets: [2, 4, 5, 7] },
      player: { id: 3, role: '预言家' },
    });
    expect(seerCaps.privateFacts.seerChecks).toEqual([{ night: 1, targetId: 1, isWolf: true }]);
    expect(seerCaps.privateFacts.wolfTeam).toBeUndefined();

    const wolfCaps = buildCapabilities({
      contract: getContract('NIGHT_WOLF'),
      gameState: baseGameState(),
      params: {},
      player: { id: 1, role: '狼人' },
    });
    expect(wolfCaps.privateFacts.wolfTeam.map((p) => p.id)).toEqual([1, 2]);
    expect(wolfCaps.privateFacts.seerChecks).toBeUndefined();
  });

  it('legal targets for NIGHT_WOLF exclude wolf teammates and dead players', () => {
    const caps = buildCapabilities({
      contract: getContract('NIGHT_WOLF'),
      gameState: baseGameState(),
      params: {},
      player: { id: 1, role: '狼人' },
    });
    expect(caps.legalTargets).toEqual(expect.arrayContaining([3, 4, 5, 7]));
    expect(caps.legalTargets).not.toContain(1);
    expect(caps.legalTargets).not.toContain(2);
    expect(caps.legalTargets).not.toContain(6);
  });

  it('NIGHT_GUARD legal targets exclude cannotGuard', () => {
    const caps = buildCapabilities({
      contract: getContract('NIGHT_GUARD'),
      gameState: baseGameState(),
      params: { cannotGuard: 4 },
      player: { id: 5, role: '守卫' },
    });
    expect(caps.legalTargets).not.toContain(4);
    expect(caps.legalTargets).toEqual(expect.arrayContaining([1, 2, 3, 5, 7]));
    expect(caps.forbiddenTargets).toContain(4);
  });

  it('DAY_VOTE legal targets are taken from params.validTargets when supplied', () => {
    const caps = buildCapabilities({
      contract: getContract('DAY_VOTE'),
      gameState: baseGameState(),
      params: { validTargets: [1, 2, 3], lastVoteIntention: 1 },
      player: { id: 7, role: '村民' },
    });
    expect(caps.legalTargets).toEqual([1, 2, 3]);
    expect(caps.strategyHints.join(' ')).toMatch(/voting 1/);
  });

  it('HUNTER_SHOOT excludes self and dead players from legal targets', () => {
    const caps = buildCapabilities({
      contract: getContract('HUNTER_SHOOT'),
      gameState: baseGameState(),
      params: { aliveTargets: [1, 2, 3, 4, 5, 6, 7] },
      player: { id: 6, role: '猎人' },
    });
    expect(caps.legalTargets).not.toContain(6);
    expect(caps.legalTargets).not.toContain(0);
    expect(caps.forbiddenTargets).toContain(6);
  });

  it('NIGHT_WITCH hints reflect potion availability', () => {
    const caps = buildCapabilities({
      contract: getContract('NIGHT_WITCH'),
      gameState: baseGameState(),
      params: { dyingId: 7, canSave: false, hasPoison: true },
      player: { id: 4, role: '女巫' },
    });
    expect(caps.strategyHints.some((h) => h.includes('Antidote'))).toBe(true);
  });
});
