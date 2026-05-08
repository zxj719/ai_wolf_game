import { describe, it, expect } from 'vitest';
import {
  ACTION_TYPES,
  CONTRACT_VERSION,
  CAPABILITY_MODE,
  isSupportedAction,
  getContract,
  listContracts,
} from '../werewolfAgent/contracts.js';

describe('werewolfAgent contracts', () => {
  it('exposes the v1 contract and capability identifiers', () => {
    expect(CONTRACT_VERSION).toBe('werewolf-agent-contract-v1');
    expect(CAPABILITY_MODE).toBe('minimax-claude-code-v1');
  });

  it('supports exactly the 7 spec actions', () => {
    expect(ACTION_TYPES).toEqual([
      'DAY_SPEECH',
      'DAY_VOTE',
      'NIGHT_WOLF',
      'NIGHT_SEER',
      'NIGHT_WITCH',
      'NIGHT_GUARD',
      'HUNTER_SHOOT',
    ]);
    for (const a of ACTION_TYPES) expect(isSupportedAction(a)).toBe(true);
    expect(isSupportedAction('NIGHT_DREAMWEAVER')).toBe(false);
    expect(isSupportedAction('NIGHT_MAGICIAN')).toBe(false);
    expect(isSupportedAction('UNKNOWN')).toBe(false);
  });

  it('throws clearly on unsupported action types', () => {
    expect(() => getContract('NIGHT_DREAMWEAVER')).toThrow(/Unsupported action contract/);
  });

  it('every contract has required fields, repair guidance, and a fallback strategy', () => {
    for (const c of listContracts()) {
      expect(c.actionType).toMatch(/^[A-Z_]+$/);
      expect(Array.isArray(c.fields)).toBe(true);
      expect(c.fields.length).toBeGreaterThan(0);
      const hasRequired = c.fields.some((f) => f.required);
      expect(hasRequired).toBe(true);
      expect(typeof c.repairGuidance).toBe('string');
      expect(c.repairGuidance.length).toBeGreaterThan(20);
      expect(c.fallback?.strategy).toBeDefined();
    }
  });

  it('each action declares the right shape per spec', () => {
    const speech = getContract('DAY_SPEECH');
    expect(speech.fields.find((f) => f.name === 'speech')?.required).toBe(true);
    expect(speech.fields.find((f) => f.name === 'identity_table')).toBeDefined();
    expect(speech.allowSkip).toBe(false);

    const vote = getContract('DAY_VOTE');
    expect(vote.fields.find((f) => f.name === 'targetId')?.required).toBe(true);
    expect(vote.allowSkip).toBe(true);

    const wolf = getContract('NIGHT_WOLF');
    expect(wolf.targetSource).toBe('alive_non_wolf_team');
    expect(wolf.allowSkip).toBe(false);
    expect(wolf.allowNullTarget).toBe(false);

    const seer = getContract('NIGHT_SEER');
    expect(seer.targetSource).toBe('param_valid_targets');
    expect(seer.allowSkip).toBe(false);

    const witch = getContract('NIGHT_WITCH');
    const witchFieldNames = witch.fields.map((f) => f.name);
    expect(witchFieldNames).toEqual(expect.arrayContaining(['useSave', 'usePoison', 'reasoning', 'identity_table']));

    const guard = getContract('NIGHT_GUARD');
    expect(guard.allowNullTarget).toBe(true);
    expect(guard.targetSource).toBe('guard_targets');

    const hunter = getContract('HUNTER_SHOOT');
    expect(hunter.fields.find((f) => f.name === 'shoot')?.type).toBe('boolean');
    expect(hunter.fallback?.strategy).toBe('hunter_first_legal');
  });

  it('contracts are frozen and immutable', () => {
    const c = getContract('DAY_VOTE');
    expect(Object.isFrozen(c)).toBe(true);
    expect(Object.isFrozen(c.fields)).toBe(true);
    for (const field of c.fields) expect(Object.isFrozen(field)).toBe(true);
    expect(() => { c.actionType = 'X'; }).toThrow();
  });
});
