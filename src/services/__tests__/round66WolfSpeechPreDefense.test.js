/**
 * Round 66 Tests: Wolf DAY_SPEECH pre-defense pressure hint
 *
 * Fixes the DAY_SPEECH analog of R65's wolfDefenseTrigger:
 * When ≥2 prior speakers have voteIntention targeting a wolf teammate,
 * inject a "introduce third-party suspect" hint into the wolf's speech prompt.
 *
 * Tests:
 *   T1–T5:  useSpeechFlow pressure computation logic (pure function)
 *   T6–T10: aiPrompts.js wolfSpeechPressureHint injection (source text)
 *   T11–T15: edge cases (PK mode skip, solo wolf, threshold boundary)
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const aiPromptsSrc = fs.readFileSync(
  path.resolve(__dirname, '../aiPrompts.js'),
  'utf8'
);
const speechFlowSrc = fs.readFileSync(
  path.resolve(__dirname, '../../hooks/useSpeechFlow.js'),
  'utf8'
);

// ─── Helper: pure pressure-map computation (mirrors useSpeechFlow logic) ─────

function computePressureMap(speechHistory, dayCount, wolfTeammateIds) {
  const pressureMap = {};
  speechHistory.forEach(s => {
    if (
      s.day === dayCount &&
      s.voteIntention !== undefined && s.voteIntention !== null &&
      s.voteIntention !== -1 &&
      wolfTeammateIds.includes(Number(s.voteIntention))
    ) {
      const t = Number(s.voteIntention);
      pressureMap[t] = (pressureMap[t] || 0) + 1;
    }
  });
  return pressureMap;
}

function getPressureEntry(pressureMap) {
  const entries = Object.entries(pressureMap)
    .filter(([, cnt]) => cnt >= 2)
    .sort(([, a], [, b]) => b - a);
  return entries.length > 0
    ? { pressuredTeammate: Number(entries[0][0]), pressuredCount: entries[0][1] }
    : null;
}

// ─── T1: No speeches → no pressure ──────────────────────────────────────────

describe('R66 – Wolf speech pressure: pressure-map computation', () => {
  it('T1: empty speechHistory → no pressure entry', () => {
    const result = getPressureEntry(computePressureMap([], 2, [3, 5]));
    expect(result).toBeNull();
  });

  it('T2: only 1 speech targeting teammate → no pressure (threshold is 2)', () => {
    const history = [{ day: 2, playerId: 1, voteIntention: 3 }];
    const result = getPressureEntry(computePressureMap(history, 2, [3, 5]));
    expect(result).toBeNull();
  });

  it('T3: 2 speeches targeting same teammate → pressure triggered', () => {
    const history = [
      { day: 2, playerId: 1, voteIntention: 3 },
      { day: 2, playerId: 4, voteIntention: 3 },
    ];
    const result = getPressureEntry(computePressureMap(history, 2, [3, 5]));
    expect(result).not.toBeNull();
    expect(result.pressuredTeammate).toBe(3);
    expect(result.pressuredCount).toBe(2);
  });

  it('T4: speeches from a different day are ignored', () => {
    const history = [
      { day: 1, playerId: 1, voteIntention: 3 },
      { day: 1, playerId: 4, voteIntention: 3 },
    ];
    const result = getPressureEntry(computePressureMap(history, 2, [3, 5]));
    expect(result).toBeNull();
  });

  it('T5: split votes across two teammates — picks the most-pressured one', () => {
    const history = [
      { day: 3, playerId: 1, voteIntention: 5 },
      { day: 3, playerId: 2, voteIntention: 5 },
      { day: 3, playerId: 4, voteIntention: 5 },
      { day: 3, playerId: 6, voteIntention: 3 },
      { day: 3, playerId: 7, voteIntention: 3 },
    ];
    const result = getPressureEntry(computePressureMap(history, 3, [3, 5]));
    expect(result).not.toBeNull();
    expect(result.pressuredTeammate).toBe(5);
    expect(result.pressuredCount).toBe(3);
  });
});

// ─── T6-T10: aiPrompts.js source contains pressure hint logic ─────────────

describe('R66 – aiPrompts.js wolf speech pressure hint', () => {
  it('T6: wolfSpeechPressureHint variable is declared in wolf DAY_SPEECH', () => {
    expect(aiPromptsSrc).toContain('wolfSpeechPressureHint');
  });

  it('T7: wolfSpeechPressureHint checks pressuredTeammate param', () => {
    expect(aiPromptsSrc).toContain('params.pressuredTeammate');
  });

  it('T8: wolfSpeechPressureHint checks pressuredCount param', () => {
    expect(aiPromptsSrc).toContain('params.pressuredCount');
  });

  it('T9: hint is suppressed in PK mode (no double-activation)', () => {
    const hintBlock = aiPromptsSrc.slice(
      aiPromptsSrc.indexOf('wolfSpeechPressureHint'),
      aiPromptsSrc.indexOf('wolfSpeechPressureHint') + 600
    );
    expect(hintBlock).toContain('!params.pkMode');
  });

  it('T10: wolfSpeechPressureHint is injected into the return template', () => {
    // The template should have ${wolfSpeechPressureHint} after ${wolfTeammatesHint}
    const templateStart = aiPromptsSrc.indexOf('【狼人专属任务】白天发言');
    const templateSlice = aiPromptsSrc.slice(templateStart - 200, templateStart + 200);
    expect(templateSlice).toContain('${wolfSpeechPressureHint}');
    expect(templateSlice).toContain('${wolfTeammatesHint}');
  });
});

// ─── T11-T15: edge cases ─────────────────────────────────────────────────────

describe('R66 – edge cases', () => {
  it('T11: voteIntention=-1 (abstain) is excluded from pressure map', () => {
    const history = [
      { day: 2, playerId: 1, voteIntention: -1 },
      { day: 2, playerId: 4, voteIntention: -1 },
    ];
    const result = getPressureEntry(computePressureMap(history, 2, [3, 5]));
    expect(result).toBeNull();
  });

  it('T12: votes targeting non-teammate are excluded from pressure map', () => {
    const history = [
      { day: 2, playerId: 1, voteIntention: 6 }, // 6 is not a wolf teammate
      { day: 2, playerId: 4, voteIntention: 6 },
    ];
    const result = getPressureEntry(computePressureMap(history, 2, [3, 5]));
    expect(result).toBeNull();
  });

  it('T13: pressureMap threshold boundary — exactly 2 votes triggers', () => {
    const history = [
      { day: 2, playerId: 1, voteIntention: 3 },
      { day: 2, playerId: 2, voteIntention: 3 },
    ];
    const result = getPressureEntry(computePressureMap(history, 2, [3]));
    expect(result).not.toBeNull();
    expect(result.pressuredCount).toBe(2);
  });

  it('T14: useSpeechFlow.js contains pressureMap computation', () => {
    expect(speechFlowSrc).toContain('pressureMap');
    expect(speechFlowSrc).toContain('pressuredTeammate');
    expect(speechFlowSrc).toContain('pressuredCount');
  });

  it('T15: useSpeechFlow.js R66 comment is present (traceability)', () => {
    expect(speechFlowSrc).toContain('R66');
  });
});
