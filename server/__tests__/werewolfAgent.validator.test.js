import { describe, it, expect } from 'vitest';
import { validate, ERROR_TYPES, buildFallbackAction } from '../werewolfAgent/validator.js';
import { getContract } from '../werewolfAgent/contracts.js';
import { buildCapabilities } from '../werewolfAgent/capabilities.js';

const STANDARD_ROLES = ['狼人', '狼人', '预言家', '女巫', '守卫', '猎人', '村民'];
const gameSetup = { STANDARD_ROLES };

function players() {
  return [
    { id: 1, role: '狼人',  isAlive: true },
    { id: 2, role: '狼人',  isAlive: true },
    { id: 3, role: '预言家', isAlive: true },
    { id: 4, role: '女巫',  isAlive: true,  hasWitchSave: true,  hasWitchPoison: true },
    { id: 5, role: '守卫',  isAlive: true },
    { id: 6, role: '猎人',  isAlive: true },
    { id: 7, role: '村民',  isAlive: true },
  ];
}

function gameState(overrides = {}) {
  return {
    players: players(),
    deathHistory: [],
    voteHistory: [],
    seerChecks: [],
    nightDecisions: {},
    dayCount: 1,
    phase: 'night',
    gameSetup,
    ...overrides,
  };
}

function capsFor(actionType, params, currentPlayer) {
  const contract = getContract(actionType);
  const capabilities = buildCapabilities({
    contract,
    gameState: gameState(),
    params,
    player: currentPlayer,
  });
  return { contract, capabilities };
}

describe('werewolfAgent validator', () => {
  it('rejects malformed JSON', () => {
    const { contract, capabilities } = capsFor('DAY_VOTE', { validTargets: [1, 2, 3] }, { id: 7, role: '村民' });
    const result = validate({ contract, text: 'not json', capabilities, params: { validTargets: [1, 2, 3] }, gameSetup });
    expect(result.ok).toBe(false);
    expect(result.errorType).toBe(ERROR_TYPES.PARSE);
  });

  it('rejects missing required fields', () => {
    const { contract, capabilities } = capsFor('DAY_VOTE', { validTargets: [1, 2, 3] }, { id: 7, role: '村民' });
    const result = validate({
      contract,
      text: JSON.stringify({ reasoning: 'no targetId here' }),
      capabilities,
      params: { validTargets: [1, 2, 3] },
      gameSetup,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.type === ERROR_TYPES.MISSING_FIELD)).toBe(true);
  });

  it('rejects illegal vote target outside validTargets', () => {
    const { contract, capabilities } = capsFor('DAY_VOTE', { validTargets: [1, 2, 3] }, { id: 7, role: '村民' });
    const result = validate({
      contract,
      text: JSON.stringify({ reasoning: 'vote', targetId: 99 }),
      capabilities,
      params: { validTargets: [1, 2, 3] },
      gameSetup,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.type === ERROR_TYPES.ILLEGAL_TARGET)).toBe(true);
  });

  it('accepts -1 vote when contract.allowSkip is true', () => {
    const { contract, capabilities } = capsFor('DAY_VOTE', { validTargets: [1, 2, 3] }, { id: 7, role: '村民' });
    const result = validate({
      contract,
      text: JSON.stringify({ reasoning: 'abstain', targetId: -1 }),
      capabilities,
      params: { validTargets: [1, 2, 3] },
      gameSetup,
    });
    expect(result.ok).toBe(true);
  });

  it('rejects wolf killing a wolf teammate', () => {
    const { contract, capabilities } = capsFor('NIGHT_WOLF', {}, { id: 1, role: '狼人' });
    const result = validate({
      contract,
      text: JSON.stringify({ targetId: 2, reasoning: 'oops teammate' }),
      capabilities,
      params: {},
      gameSetup,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.type === ERROR_TYPES.ILLEGAL_TARGET)).toBe(true);
  });

  it('rejects guard repeating cannotGuard target', () => {
    const { contract, capabilities } = capsFor('NIGHT_GUARD', { cannotGuard: 4 }, { id: 5, role: '守卫' });
    const result = validate({
      contract,
      text: JSON.stringify({ targetId: 4, reasoning: 'repeat' }),
      capabilities,
      params: { cannotGuard: 4 },
      gameSetup,
    });
    expect(result.ok).toBe(false);
    const types = result.errors.map((e) => e.type);
    expect(types.includes(ERROR_TYPES.ILLEGAL_TARGET) || types.includes(ERROR_TYPES.ACTION_RULE)).toBe(true);
  });

  it('accepts null guard target when contract.allowNullTarget is true', () => {
    const { contract, capabilities } = capsFor('NIGHT_GUARD', { cannotGuard: 4 }, { id: 5, role: '守卫' });
    const result = validate({
      contract,
      text: JSON.stringify({ targetId: null, reasoning: 'skip' }),
      capabilities,
      params: { cannotGuard: 4 },
      gameSetup,
    });
    expect(result.ok).toBe(true);
  });

  it('rejects witch using both potions on the same night', () => {
    const { contract, capabilities } = capsFor(
      'NIGHT_WITCH',
      { dyingId: 7, canSave: true, hasPoison: true },
      { id: 4, role: '女巫' },
    );
    const result = validate({
      contract,
      text: JSON.stringify({ useSave: true, usePoison: 1, reasoning: 'both' }),
      capabilities,
      params: { dyingId: 7, canSave: true, hasPoison: true },
      gameSetup,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.type === ERROR_TYPES.ACTION_RULE)).toBe(true);
  });

  it('rejects witch using save when antidote is unavailable', () => {
    const { contract, capabilities } = capsFor(
      'NIGHT_WITCH',
      { dyingId: 7, canSave: false, hasPoison: true },
      { id: 4, role: '女巫' },
    );
    const result = validate({
      contract,
      text: JSON.stringify({ useSave: true, usePoison: null, reasoning: 'forbidden' }),
      capabilities,
      params: { dyingId: 7, canSave: false, hasPoison: true },
      gameSetup,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.type === ERROR_TYPES.ACTION_RULE)).toBe(true);
  });

  it('rejects hunter shoot=false', () => {
    const { contract, capabilities } = capsFor('HUNTER_SHOOT', { aliveTargets: [1, 2, 3, 4, 5, 7] }, { id: 6, role: '猎人' });
    const result = validate({
      contract,
      text: JSON.stringify({ shoot: false, targetId: 1, reason: 'decline' }),
      capabilities,
      params: { aliveTargets: [1, 2, 3, 4, 5, 7] },
      gameSetup,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.type === ERROR_TYPES.ACTION_RULE)).toBe(true);
  });

  it('rejects identity_table referencing unknown players or roles', () => {
    const { contract, capabilities } = capsFor('DAY_SPEECH', {}, { id: 7, role: '村民' });
    const result = validate({
      contract,
      text: JSON.stringify({
        speech: 'hi',
        identity_table: {
          1: { suspect: '狼人', confidence: 80 },
          99: { suspect: '村民' },
          3: { suspect: '吸血鬼', confidence: 50 },
        },
      }),
      capabilities,
      params: {},
      gameSetup,
    });
    expect(result.ok).toBe(false);
    const types = result.errors.map((e) => e.type);
    expect(types).toContain(ERROR_TYPES.IDENTITY_TABLE);
  });

  it('accepts a valid example for every supported action', () => {
    const cases = [
      {
        action: 'DAY_SPEECH',
        params: {},
        player: { id: 7, role: '村民' },
        body: { speech: '我先观察。', voteIntention: null },
      },
      {
        action: 'DAY_VOTE',
        params: { validTargets: [1, 2, 3] },
        player: { id: 7, role: '村民' },
        body: { reasoning: 'vote 1', targetId: 1 },
      },
      {
        action: 'NIGHT_WOLF',
        params: {},
        player: { id: 1, role: '狼人' },
        body: { targetId: 3, reasoning: 'kill seer' },
      },
      {
        action: 'NIGHT_SEER',
        params: { validTargets: [1, 2, 4, 5, 6, 7] },
        player: { id: 3, role: '预言家' },
        body: { targetId: 1, reasoning: 'inspect' },
      },
      {
        action: 'NIGHT_WITCH',
        params: { dyingId: 7, canSave: true, hasPoison: true },
        player: { id: 4, role: '女巫' },
        body: { useSave: true, usePoison: null, reasoning: 'save' },
      },
      {
        action: 'NIGHT_GUARD',
        params: { cannotGuard: 4 },
        player: { id: 5, role: '守卫' },
        body: { targetId: 3, reasoning: 'protect seer' },
      },
      {
        action: 'HUNTER_SHOOT',
        params: { aliveTargets: [1, 2, 3, 4, 5, 7] },
        player: { id: 6, role: '猎人' },
        body: { shoot: true, targetId: 1, reason: 'wolf' },
      },
    ];
    for (const c of cases) {
      const { contract, capabilities } = capsFor(c.action, c.params, c.player);
      const result = validate({
        contract,
        text: JSON.stringify(c.body),
        capabilities,
        params: c.params,
        gameSetup,
      });
      expect(result.ok, `${c.action} should accept valid example`).toBe(true);
      expect(result.parsed).toMatchObject(c.body);
    }
  });

  it('builds a deterministic legal fallback per contract', () => {
    const speechFallback = buildFallbackAction({
      contract: getContract('DAY_SPEECH'),
      capabilities: { legalTargets: [] },
    });
    expect(typeof speechFallback.speech).toBe('string');
    expect(speechFallback.voteIntention).toBeNull();

    const voteFallback = buildFallbackAction({
      contract: getContract('DAY_VOTE'),
      capabilities: { legalTargets: [1, 2, 3] },
    });
    expect(voteFallback.targetId).toBe(-1);

    const guardFallback = buildFallbackAction({
      contract: getContract('NIGHT_GUARD'),
      capabilities: { legalTargets: [1, 2] },
    });
    expect(guardFallback.targetId).toBeNull();

    const witchFallback = buildFallbackAction({
      contract: getContract('NIGHT_WITCH'),
      capabilities: { legalTargets: [1, 2] },
    });
    expect(witchFallback).toMatchObject({ useSave: false, usePoison: null });

    const wolfFallback = buildFallbackAction({
      contract: getContract('NIGHT_WOLF'),
      capabilities: { legalTargets: [3, 4] },
    });
    expect(wolfFallback.targetId).toBe(3);

    const hunterFallback = buildFallbackAction({
      contract: getContract('HUNTER_SHOOT'),
      capabilities: { legalTargets: [3] },
    });
    expect(hunterFallback).toMatchObject({ shoot: true, targetId: 3 });
  });
});
