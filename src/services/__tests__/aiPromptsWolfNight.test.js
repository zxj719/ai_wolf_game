/**
 * R47: NIGHT_WOLF prompt — last-night outcome injection
 *
 * Verifies:
 *  T1. N1: no 上轮夜间结果 block, generic wolfHistoryStep
 *  T2. N2 with deaths: 上轮夜间结果 present, death player mentioned
 *  T3. N2 peaceful: 上轮夜间结果 present, 平安夜 text
 *  T4. wolfHistoryStep on N2+ includes knife-result cross-reference
 *  T5. wolfHistoryStep on N2+ includes witch-save inference text
 */

import { describe, it, expect } from 'vitest';
import { generateUserPrompt, PROMPT_ACTIONS } from '../aiPrompts.js';

// ─── Minimal gameState builder ──────────────────────────────────────────────

function makeGameState({ dayCount = 1, deathHistory = [] } = {}) {
  return {
    players: [
      { id: 1, role: '狼人', isAlive: true, name: 'A', personality: { traits: '冷静' } },
      { id: 2, role: '村民', isAlive: true, name: 'B', personality: {} },
      { id: 3, role: '预言家', isAlive: true, name: 'C', personality: {} },
      { id: 4, role: '女巫', isAlive: true, name: 'D', personality: {} },
      { id: 5, role: '村民', isAlive: true, name: 'E', personality: {} },
      { id: 6, role: '村民', isAlive: false, name: 'F', personality: {} },
    ],
    speechHistory: [],
    voteHistory: [],
    deathHistory,
    nightDecisions: {},
    seerChecks: [],
    guardHistory: [],
    witchHistory: { savedIds: [], poisonedIds: [] },
    dayCount,
    phase: 'night',
    gameSetup: { playerCount: 6 },
    nightActionHistory: [],
    claimHistory: [],
    dreamweaverHistory: null,
    magicianHistory: null,
  };
}

function wolfPrompt(dayCount, deathHistory = []) {
  const gs = makeGameState({ dayCount, deathHistory });
  return generateUserPrompt(PROMPT_ACTIONS.NIGHT_WOLF, gs, {
    playerId: 1,
    currentPlayer: gs.players[0],
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('NIGHT_WOLF prompt — R47 last-night outcome injection', () => {
  it('T1: N1 has no 上轮夜间结果 block and uses generic wolfHistoryStep', () => {
    const p = wolfPrompt(1);
    expect(p).not.toContain('上轮夜间结果');
    expect(p).toContain('首夜');
    expect(p).toContain('无历史刀口记录');
    expect(p).not.toContain('核查执行结果');
  });

  it('T2: N2 with a night death injects 上轮夜间结果 block with dead player', () => {
    const p = wolfPrompt(2, [{ playerId: 3, day: 1, phase: '夜', cause: '被狼人袭击' }]);
    expect(p).toContain('上轮夜间结果');
    expect(p).toContain('3号');
  });

  it('T3: N2 peaceful night injects 上轮夜间结果 with 平安夜', () => {
    const p = wolfPrompt(2, []);
    expect(p).toContain('上轮夜间结果');
    expect(p).toContain('平安夜');
  });

  it('T4: N2+ wolfHistoryStep contains knife-result cross-reference', () => {
    const p = wolfPrompt(2, []);
    expect(p).toContain('核查执行结果');
    expect(p).toContain('交叉比对');
  });

  it('T5: N2+ wolfHistoryStep explains witch-save inference (女巫只剩毒药)', () => {
    const p = wolfPrompt(2, []);
    expect(p).toContain('女巫只剩毒药');
  });

  it('T6: N1 validTargets excludes wolf self and dead players', () => {
    const p = wolfPrompt(1);
    // alive non-wolf: 2,3,4,5 (player 6 is dead, player 1 is wolf)
    expect(p).toMatch(/【可袭击目标】2,3,4,5号/);
  });
});
