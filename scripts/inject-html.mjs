#!/usr/bin/env node
/**
 * Reads dist/index.html and injects it as an inline string constant into
 * workers/auth/index.js, replacing the __SPA_HTML__ placeholder.
 *
 * Run AFTER `vite build` and BEFORE `wrangler deploy`.
 * Wired into the deploy script in package.json.
 *
 * This exists because Workers Assets' env.ASSETS.fetch() has an internal
 * content-address cache that survives Worker version updates — meaning
 * env.ASSETS.fetch('/index.html') keeps returning stale HTML even after a
 * deploy with new chunks. By inlining the HTML into the Worker script
 * itself, we guarantee the SPA shell always matches the deployed JS chunks.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const HTML_PATH = 'dist/index.html';
const WORKER_PATH = 'workers/auth/index.js';

const html = readFileSync(HTML_PATH, 'utf8');
const escaped = JSON.stringify(html);

let worker = readFileSync(WORKER_PATH, 'utf8');

if (worker.includes("typeof __SPA_HTML__")) {
  worker = worker.replace(
    /const SPA_HTML = typeof __SPA_HTML__ !== 'undefined' \? __SPA_HTML__ : '';/,
    `const SPA_HTML = ${escaped};`
  );
  writeFileSync(WORKER_PATH, worker, 'utf8');
  console.log(`[inject-html] Injected ${html.length} chars of HTML into Worker.`);
} else {
  console.error('[inject-html] Could not find SPA_HTML placeholder in Worker.');
  process.exit(1);
}
