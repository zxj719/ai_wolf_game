#!/usr/bin/env node
/**
 * Post-build static guard.
 *
 * Runs after `vite build` (wired in package.json) and scans dist/assets/*.js
 * for forbidden literals — typically the dev-only URLs that should never
 * end up in a production bundle but historically did because Vite loads
 * `.env.local` in every mode (see CLAUDE.md "构建与部署陷阱" section).
 *
 * Exits 1 on any hit. CI / npm run deploy refuses to ship.
 *
 * To allow a literal that is legitimately needed in prod, add it to
 * ALLOW_LIST below with a justification comment.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST_DIR = 'dist/assets';

// Patterns that must not appear in any production JS bundle.
// Each entry: { pattern: RegExp, label: string, suggestion: string }
const FORBIDDEN = [
  {
    pattern: /\blocalhost(:\d+)?\b/i,
    label: 'localhost reference',
    suggestion: 'Move dev-only URL out of .env / .env.local into .env.development.local.',
  },
  {
    pattern: /\b127\.0\.0\.1(:\d+)?\b/,
    label: '127.0.0.1 reference',
    suggestion: 'Same fix as localhost: dev-only URL must live in .env.development.local.',
  },
  {
    pattern: /\bhttp:\/\/192\.(?:168|0|1)\.\d+/,
    label: 'private LAN IP',
    suggestion: 'A LAN URL leaked to prod. Move to .env.development.local.',
  },
  {
    pattern: /\bfile:\/\/[a-z0-9._/-]/i,
    label: 'file:// URL',
    suggestion: 'A local filesystem URL leaked to prod.',
  },
];

// Literals that are legitimately required in prod bundles.
// Add with a one-line justification.
const ALLOW_LIST = [
  // none yet
];

function listJsBundles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isFile() && entry.endsWith('.js')) out.push(full);
  }
  return out;
}

function isAllowed(literal) {
  return ALLOW_LIST.some((rule) => rule.pattern.test(literal));
}

let hits = 0;
const files = listJsBundles(DIST_DIR);
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  for (const { pattern, label, suggestion } of FORBIDDEN) {
    const match = text.match(pattern);
    if (match && !isAllowed(match[0])) {
      hits += 1;
      console.error(`[check-build] ❌ ${file} contains ${label}: "${match[0]}"`);
      console.error(`[check-build]    → ${suggestion}`);
    }
  }
}

if (hits > 0) {
  console.error('');
  console.error(`[check-build] FAILED: ${hits} forbidden literal(s) leaked into the production bundle.`);
  console.error('[check-build] Refusing to ship. See CLAUDE.md "构建与部署陷阱" for the fix.');
  process.exit(1);
}

console.log(`[check-build] ✅ ${files.length} JS bundle(s) clean (no localhost / 127.0.0.1 / LAN IP / file:// leaks).`);
