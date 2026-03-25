import { describe, it, expect, vi } from 'vitest';

// Import from the ESM module directly
import {
  validate,
  validateBugReport,
  validateImprovedPrompts,
  validateTestCases,
  withRetry,
  ValidationError,
} from '../validation.mjs';

describe('validate', () => {
  it('returns output when all required fields present', () => {
    const output = { a: 1, b: 2 };
    expect(validate(output, ['a', 'b'])).toBe(output);
  });

  it('throws ValidationError when output is null', () => {
    expect(() => validate(null, ['a'])).toThrow(ValidationError);
  });

  it('throws ValidationError when output is not an object', () => {
    expect(() => validate('string', ['a'])).toThrow(ValidationError);
  });

  it('throws ValidationError when required field is missing', () => {
    expect(() => validate({ a: 1 }, ['a', 'b'])).toThrow(ValidationError);
    expect(() => validate({ a: 1 }, ['a', 'b'])).toThrow('missing required field "b"');
  });

  it('throws with custom label in error message', () => {
    expect(() => validate({ a: 1 }, ['a', 'b'], 'MyReport'))
      .toThrow('MyReport: missing required field "b"');
  });
});

describe('validateBugReport', () => {
  const makeBugReport = (overrides = {}) => ({
    gameId: 'game-1',
    agent: 'BugHunter',
    timestamp: '2026-03-25T00:00:00Z',
    issues: [],
    ...overrides,
  });

  it('accepts a valid BugReport with no issues', () => {
    const report = makeBugReport();
    expect(validateBugReport(report)).toBe(report);
  });

  it('accepts a valid issue', () => {
    const report = makeBugReport({
      issues: [{
        id: 'issue-1',
        severity: 'high',
        category: 'speech_contradiction',
        role: '狼人',
        description: '前后发言矛盾',
        evidence: { source: 'speechHistory', entryIndex: 0 },
        rootCause: 'prompt_design',
      }],
    });
    expect(validateBugReport(report)).toBe(report);
  });

  it('throws when issues is not an array', () => {
    const report = makeBugReport({ issues: 'not-array' });
    expect(() => validateBugReport(report)).toThrow('issues must be an array');
  });

  it('throws when issue has invalid severity', () => {
    const report = makeBugReport({
      issues: [{
        id: 'i1', severity: 'super-critical', // invalid
        category: 'speech_contradiction',
        role: '狼人',
        description: 'x',
        evidence: { source: 'speechHistory', entryIndex: 0 },
        rootCause: 'prompt_design',
      }],
    });
    expect(() => validateBugReport(report)).toThrow('severity must be');
  });

  it('throws when issue has invalid category', () => {
    const report = makeBugReport({
      issues: [{
        id: 'i1', severity: 'high',
        category: 'not-a-category', // invalid
        role: '狼人',
        description: 'x',
        evidence: { source: 'speechHistory', entryIndex: 0 },
        rootCause: 'prompt_design',
      }],
    });
    expect(() => validateBugReport(report)).toThrow('category has invalid value');
  });
});

describe('validateImprovedPrompts', () => {
  const makePrompts = (overrides = {}) => ({
    gameId: 'game-1',
    agent: 'PromptEngineer',
    timestamp: '2026-03-25T00:00:00Z',
    basedOnReport: 'game-1',
    changes: [],
    ...overrides,
  });

  it('accepts valid ImprovedPrompts', () => {
    const prompts = makePrompts({
      changes: [{
        role: '狼人',
        originalSnippet: '杀预言家',
        newSnippet: '不要直接杀预言家',
        reason: '更好的策略',
        expectedImpact: '狼人胜率提升',
        confidence: 0.85,
      }],
    });
    expect(validateImprovedPrompts(prompts)).toBe(prompts);
  });

  it('throws when confidence is out of range', () => {
    const prompts = makePrompts({
      changes: [{
        role: '狼人',
        originalSnippet: 'a', newSnippet: 'b',
        reason: 'r', expectedImpact: 'e',
        confidence: 1.5, // invalid
      }],
    });
    expect(() => validateImprovedPrompts(prompts)).toThrow('confidence must be 0-1');
  });

  it('throws when changes is not an array', () => {
    const prompts = makePrompts({ changes: {} });
    expect(() => validateImprovedPrompts(prompts)).toThrow('changes must be an array');
  });
});

describe('validateTestCases', () => {
  const makeCases = (overrides = {}) => ({
    gameId: 'game-1',
    agent: 'TestWriter',
    timestamp: '2026-03-25T00:00:00Z',
    basedOnPrompts: 'game-1',
    testCases: [],
    ...overrides,
  });

  it('accepts valid TestCases', () => {
    const cases = makeCases({
      testCases: [{
        id: 'test-1',
        scenario: '狼人被查杀后发言',
        expectedBehavior: '应该发起自救或辩解',
        passCriteria: '发言中包含辩解策略',
        automated: false,
      }],
    });
    expect(validateTestCases(cases)).toBe(cases);
  });

  it('throws when automated is not a boolean', () => {
    const cases = makeCases({
      testCases: [{
        id: 'test-1',
        scenario: 'x',
        expectedBehavior: 'x',
        passCriteria: 'x',
        automated: 'yes', // invalid
      }],
    });
    expect(() => validateTestCases(cases)).toThrow('automated must be boolean');
  });
});

describe('withRetry', () => {
  it('returns result on first success', async () => {
    const fn = vi.fn(() => Promise.resolve(42));
    const result = await withRetry(fn, 3, 10);
    expect(result).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and succeeds on second attempt', async () => {
    let attempts = 0;
    const fn = vi.fn(() => {
      attempts++;
      if (attempts < 2) throw new Error('Transient');
      return Promise.resolve('ok');
    });

    const result = await withRetry(fn, 3, 5); // 5ms base
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting all attempts', async () => {
    const fn = vi.fn(() => Promise.reject(new Error('Permanent')));

    await expect(withRetry(fn, 3, 5)).rejects.toThrow('Permanent');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
