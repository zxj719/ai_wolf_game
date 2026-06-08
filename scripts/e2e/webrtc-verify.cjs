#!/usr/bin/env node
/**
 * webrtc-verify — headless two-browser regression test for the chat video call.
 *
 * Drives the REAL prod stack (CF Worker auth, ECS WS signaling, P2P media) with two
 * isolated Chrome contexts and a fake camera, then asserts remote video flows BOTH ways.
 * Catches the class of bugs that unit tests can't (transceiver direction, track binding).
 *
 * Usage:
 *   cd scripts/e2e && npm install        # once (puppeteer-core, ~5MB, no browser download)
 *   node webrtc-verify.cjs               # verify against https://zhaxiaoji.com
 *
 * Env overrides:
 *   E2E_BASE      target origin            (default https://zhaxiaoji.com)
 *   E2E_CHROME    chrome/edge exe path     (default: auto-detect)
 *   E2E_HEADLESS  "0" to watch it run      (default headless)
 *   E2E_PASSWORD  test account password    (default Passw0rd1)
 *
 * Exit code 0 = remote video verified both ways; non-zero = failure (reason logged).
 *
 * NOTE: requires the ECS chatHub to allow the caller's call:offer. Since 2026-06 any
 * logged-in friend may call, so two fresh accounts suffice. If you see "not allowed",
 * the ECS server is running an older chatHub — git pull + pm2 restart on the box.
 */
const fs = require('fs');
const puppeteer = require('puppeteer-core');

const BASE = (process.env.E2E_BASE || 'https://zhaxiaoji.com').replace(/\/+$/, '');
const PW = process.env.E2E_PASSWORD || 'Passw0rd1';
const HEADLESS = process.env.E2E_HEADLESS !== '0';

function findChrome() {
  if (process.env.E2E_CHROME && fs.existsSync(process.env.E2E_CHROME)) return process.env.E2E_CHROME;
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    `${process.env.LOCALAPPDATA || ''}\\Google\\Chrome\\Application\\chrome.exe`,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  return candidates.find((p) => { try { return fs.existsSync(p); } catch { return false; } });
}

const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}
async function regOrLogin(username, email) {
  let r = await api('/api/auth/register', { method: 'POST', body: { username, email, password: PW } });
  if (r.status < 400) return r.data;
  r = await api('/api/auth/login', { method: 'POST', body: { email, password: PW } });
  if (r.status < 400) return r.data;
  throw new Error(`auth ${email}: ${r.status} ${JSON.stringify(r.data)}`);
}
const clickByText = (page, text) => page.evaluate((t) => {
  const el = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().includes(t));
  if (el) { el.click(); return true; } return false;
}, text);
const hasText = (page, text) => page.evaluate((t) => [...document.querySelectorAll('button,div,p,span,h1,h2')].some((e) => e.textContent.includes(t)), text);
const videoStats = (page) => page.evaluate(() => [...document.querySelectorAll('video')].map((v) => ({ w: v.videoWidth, rs: v.readyState })));

(async () => {
  const exe = findChrome();
  if (!exe) { console.error('No Chrome/Edge found. Set E2E_CHROME=<path to chrome.exe>'); process.exit(3); }
  log(`browser: ${exe}\ntarget:  ${BASE}\n`);

  const sfx = String(Date.now()).slice(-6);
  const A = await regOrLogin(`e2ev_a_${sfx}`, `e2ev_a_${sfx}@e2e.test`);
  const B = await regOrLogin(`e2ev_b_${sfx}`, `e2ev_b_${sfx}@e2e.test`);
  log(`accounts: A=${A.user.username} B=${B.user.username}`);
  await api('/api/friends/request', { method: 'POST', token: A.token, body: { toUserId: B.user.id } });
  const reqs = await api('/api/friends/requests', { token: B.token });
  if (reqs.data.requests && reqs.data.requests.length) {
    await api('/api/friends/respond', { method: 'POST', token: B.token, body: { requestId: reqs.data.requests[0].id, action: 'accept' } });
  }
  log('friended A<->B\n');

  const browser = await puppeteer.launch({
    executablePath: exe,
    headless: HEADLESS ? 'new' : false,
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--no-sandbox', '--disable-dev-shm-usage'],
  });

  async function openAs(acct) {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.evaluateOnNewDocument((tok, usr) => {
      localStorage.setItem('wolfgame_auth_token', tok);
      localStorage.setItem('wolfgame_user', JSON.stringify(usr));
    }, acct.token, acct.user);
    await page.goto(`${BASE}/?fresh=${Date.now()}`, { waitUntil: 'networkidle2', timeout: 45000 });
    await sleep(2500);
    await clickByText(page, '好友');                       // dashboard -> /chat (SPA nav, no guard race)
    return { ctx, page };
  }
  async function waitFriend(page, name) {
    for (let i = 0; i < 12; i++) { await sleep(1500); if (await hasText(page, name)) return true; }
    return false;
  }

  let code = 1;
  try {
    const a = await openAs(A);
    const b = await openAs(B);
    if (!(await waitFriend(a.page, B.user.username)) || !(await waitFriend(b.page, A.user.username))) {
      log('FAIL: chat/friends did not load (auth injection?)'); throw 0;
    }
    log('both on /chat, friends visible');

    await clickByText(a.page, B.user.username);
    await sleep(1000);
    await clickByText(a.page, '视频通话');
    let accepted = false;
    for (let i = 0; i < 20; i++) {
      await sleep(800);
      if (await hasText(b.page, '邀请你视频通话')) { accepted = await clickByText(b.page, '接听'); break; }
      if (await hasText(a.page, 'not allowed')) { log('FAIL: call:offer rejected ("not allowed") — ECS chatHub is stale (git pull + pm2 restart).'); throw 0; }
    }
    if (!accepted) { log('FAIL: callee never saw the ring (signaling not relayed — check ECS WS).'); throw 0; }
    log('call answered, waiting for media…');

    for (let i = 0; i < 8; i++) {
      await sleep(2500);
      const la = (await videoStats(a.page)).filter((v) => v.w > 0).length;
      const lb = (await videoStats(b.page)).filter((v) => v.w > 0).length;
      if (la >= 2 && lb >= 2) { log(`\n✅ PASS — remote video flows both ways (A=${la}, B=${lb} live videos).`); code = 0; break; }
      if (i === 7) log(`\n❌ FAIL — remote video did not flow (A=${la}, B=${lb} live videos; expected 2 each).`);
    }
  } catch { /* logged above */ } finally {
    await browser.close();
  }
  process.exit(code);
})().catch((e) => { console.error('E2E ERROR:', e); process.exit(1); });
