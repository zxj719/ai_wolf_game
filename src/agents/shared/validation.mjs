/**
 * validation.mjs — Shared validation helpers for agent output schemas.
 *
 * DRY: extracted from bugHunter.mjs, promptEngineer.mjs, testWriter.mjs.
 * Single source of truth — update here instead of in 3 places.
 */

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validate that an object has all required top-level fields.
 * Throws ValidationError if any field is missing.
 *
 * @param {Object} output       - the agent output to validate
 * @param {string[]} requiredFields - field names that must be present
 * @param {string} label        - human-readable label for error messages (e.g. "BugReport")
 */
export function validate(output, requiredFields, label = 'Output') {
  if (!output || typeof output !== 'object') {
    throw new ValidationError(`${label}: expected object, got ${typeof output}`);
  }
  for (const field of requiredFields) {
    if (output[field] === undefined) {
      throw new ValidationError(`${label}: missing required field "${field}"`);
    }
  }
  return output;
}

/**
 * Validate a BugReport output.
 * Schema: { gameId, agent, timestamp, issues[] }
 */
export function validateBugReport(report) {
  validate(report, ['gameId', 'agent', 'issues', 'timestamp'], 'BugReport');
  if (!Array.isArray(report.issues)) {
    throw new ValidationError('BugReport.issues must be an array');
  }
  for (const issue of report.issues) {
    validate(issue, ['id', 'severity', 'category', 'description'], 'BugReport.issue');
    if (!['critical', 'high', 'medium', 'low'].includes(issue.severity)) {
      throw new ValidationError(`BugReport.issue.severity must be critical|high|medium|low, got "${issue.severity}"`);
    }
    if (!['speech_contradiction', 'vote_mismanagement', 'night_misplay', 'model_weakness', 'prompt_gap'].includes(issue.category)) {
      throw new ValidationError(`BugReport.issue.category has invalid value: "${issue.category}"`);
    }
  }
  return report;
}

/**
 * Validate an ImprovedPrompts output.
 * Schema: { gameId, agent, timestamp, basedOnReport, changes[] }
 */
export function validateImprovedPrompts(prompts) {
  validate(prompts, ['gameId', 'agent', 'timestamp', 'basedOnReport', 'changes'], 'ImprovedPrompts');
  if (!Array.isArray(prompts.changes)) {
    throw new ValidationError('ImprovedPrompts.changes must be an array');
  }
  for (const change of prompts.changes) {
    validate(change, ['role', 'originalSnippet', 'newSnippet', 'reason', 'expectedImpact', 'confidence'], 'ImprovedPrompts.change');
    if (typeof change.confidence !== 'number' || change.confidence < 0 || change.confidence > 1) {
      throw new ValidationError(`ImprovedPrompts.change.confidence must be 0-1, got ${change.confidence}`);
    }
  }
  return prompts;
}

/**
 * Validate a TestCases output.
 * Schema: { gameId, agent, timestamp, basedOnPrompts, testCases[] }
 */
export function validateTestCases(cases) {
  validate(cases, ['gameId', 'agent', 'timestamp', 'basedOnPrompts', 'testCases'], 'TestCases');
  if (!Array.isArray(cases.testCases)) {
    throw new ValidationError('TestCases.testCases must be an array');
  }
  for (const tc of cases.testCases) {
    validate(tc, ['id', 'scenario', 'expectedBehavior', 'passCriteria'], 'TestCases.testCase');
    if (typeof tc.automated !== 'boolean') {
      throw new ValidationError(`TestCases.testCase.automated must be boolean, got ${typeof tc.automated}`);
    }
  }
  return cases;
}

/**
 * Retry a function up to `maxAttempts` times with exponential back-off.
 * Returns the result of the first successful call, or throws the last error.
 *
 * @param {Function} fn         - async function to retry
 * @param {number}   maxAttempts - max call attempts (default 3)
 * @param {number}   baseMs      - initial back-off delay in ms (default 1000)
 * @returns {Promise<any>}
 */
export async function withRetry(fn, maxAttempts = 3, baseMs = 1000) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        const delay = baseMs * Math.pow(2, attempt - 1);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}
