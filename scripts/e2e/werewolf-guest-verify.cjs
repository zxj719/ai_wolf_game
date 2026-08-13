/**
 * Guest-mode werewolf regression test — drives the REAL production stack.
 *
 * Catches the bug class that unit tests cannot: the queue-lease handshake between
 * QueueGate (a separate lazy chunk) and the AI session client. Two shipped bugs
 * live here:
 *
 *   1. pollStatus compared against `lock.lease_id`, which /api/queue/status never
 *      returns → every 15s poll declared "管理员已接管" → kicked back to setup.
 *   2. The first night's four AI calls fire before QueueGate mounts, so the lease
 *      was still 'idle' and waitForQueueLease gave up after 600ms → requests went
 *      out with no X-Lease-Id → 401 → every role fell back to a default action.
 *
 * Admin bypasses QueueGate entirely (`if (isAdmin) return children`), so neither
 * bug is reproducible while logged in as admin. This test runs as a GUEST.
 *
 * Run:
 *   cd scripts/e2e && node werewolf-guest-verify.cjs
 *
 * Env:
 *   E2E_BASE      target origin        (default https://zhaxiaoji.com)
 *   E2E_CHROME    chrome/edge exe      (default: auto-detect)
 *   E2E_HEADLESS  '0' to watch it run  (default headless)
 *   E2E_WATCH_MS  observation window   (default 75000)
 */
const fs = require('fs');
const puppeteer = require('puppeteer-core');

const BASE = (process.env.E2E_BASE || 'https://zhaxiaoji.com').replace(/\/+$/, '');
const HEADLESS = process.env.E2E_HEADLESS !== '0';
const WATCH_MS = Number(process.env.E2E_WATCH_MS || 75000);

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

/** Click the first element whose trimmed text contains `text`. */
async function clickByText(page, text, { timeout = 20000 } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const clicked = await page.evaluate((t) => {
      const nodes = [...document.querySelectorAll('button, a, [role="button"]')];
      const el = nodes.find((n) => (n.innerText || n.textContent || '').replace(/\s+/g, '').includes(t.replace(/\s+/g, '')));
      if (!el) return false;
      el.click();
      return true;
    }, text);
    if (clicked) return true;
    await sleep(250);
  }
  throw new Error(`clickByText timeout: ${text}`);
}

async function waitForText(page, text, { timeout = 30000 } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const found = await page.evaluate(
      (t) => (document.body.innerText || '').replace(/\s+/g, '').includes(t.replace(/\s+/g, '')),
      text
    );
    if (found) return true;
    await sleep(300);
  }
  return false;
}

(async () => {
  const exe = findChrome();
  if (!exe) { console.error('No Chrome/Edge found. Set E2E_CHROME=<path>'); process.exit(3); }
  log(`chrome: ${exe}`);
  log(`base:   ${BASE}`);

  const browser = await puppeteer.launch({
    executablePath: exe,
    headless: HEADLESS ? 'new' : false,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=1400,1000'],
  });

  // Fresh context = no cached bundle, no stale localStorage. This is what makes
  // the run trustworthy: a stale tab is exactly how the previous manual test
  // ended up exercising an old WerewolfModule chunk.
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1400, height: 1000 });
  await page.setCacheEnabled(false);

  /** @type {{url:string,status:number,body:string}[]} */
  const sessionCalls = [];
  const queueCalls = [];
  let bundleName = null;

  /** @type {{url:string,status:number}[]} */
  const failedResponses = [];

  page.on('response', async (res) => {
    const url = res.url();
    if (res.status() >= 400) failedResponses.push({ url: url.replace(BASE, ''), status: res.status() });
    if (/WerewolfModule-[A-Za-z0-9_-]+\.js/.test(url)) {
      bundleName = url.match(/WerewolfModule-[A-Za-z0-9_-]+\.js/)[0];
    }
    if (url.includes('/api/werewolf/session/')) {
      let body = '';
      try { body = (await res.text()).slice(0, 200); } catch {}
      sessionCalls.push({ url: url.replace(BASE, ''), status: res.status(), body });
    }
    if (url.includes('/api/queue/')) {
      let body = '';
      try { body = (await res.text()).slice(0, 160); } catch {}
      queueCalls.push({ url: url.replace(BASE, ''), status: res.status(), body });
    }
  });

  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });

  try {
    log('\n[1] 打开登录页 → 游客模式');
    await page.goto(`${BASE}/login?e2e=${Date.now()}`, { waitUntil: 'networkidle2', timeout: 60000 });
    await clickByText(page, '游客模式体验');
    await sleep(1500);

    log('[2] 进入狼人杀 setup');
    await clickByText(page, '立即开始首局');
    const onSetup = await waitForText(page, '选择开始模式', { timeout: 30000 });
    if (!onSetup) throw new Error('never reached setup screen');
    log(`    url = ${page.url()}`);

    log('[3] 开始对局（游客固定为全 AI 模式）');
    await clickByText(page, '开始游戏');
    await sleep(2000);
    log(`    url = ${page.url()}`);
    log(`    bundle = ${bundleName || '(未捕获)'}`);

    log(`\n[4] 观察 ${Math.round(WATCH_MS / 1000)}s —— 跨过 15s 轮询与 30s 心跳两道坎`);
    const start = Date.now();
    let bouncedAt = null;
    let preemptScreenAt = null;
    while (Date.now() - start < WATCH_MS) {
      const u = page.url();
      if (u.includes('/werewolf/setup')) { bouncedAt = Math.round((Date.now() - start) / 1000); break; }
      if (await page.evaluate(() => (document.body.innerText || '').includes('管理员已接管'))) {
        preemptScreenAt = Math.round((Date.now() - start) / 1000);
        break;
      }
      await sleep(1000);
      const el = Math.round((Date.now() - start) / 1000);
      if (el % 15 === 0) log(`    ${el}s  url=${u.replace(BASE, '')}  session调用=${sessionCalls.length}`);
    }

    const text = await page.evaluate(() => document.body.innerText || '');
    const fallbackHits = (text.match(/兜底|决策无效|决策失败/g) || []).length;

    log('\n──────── 结果 ────────');
    log(`部署包            : ${bundleName || '未捕获'}`);
    log(`是否弹回 setup    : ${bouncedAt !== null ? `是（${bouncedAt}s）` : '否'}`);
    log(`是否出现"已接管"  : ${preemptScreenAt !== null ? `是（${preemptScreenAt}s）` : '否'}`);
    log(`queue 请求        : ${queueCalls.length}`);
    for (const c of queueCalls.slice(0, 6)) log(`   ${c.status}  ${c.url}  ${c.body}`);
    log(`session/ask 请求  : ${sessionCalls.length}`);
    const bad = sessionCalls.filter((c) => c.status !== 200);
    log(`   非 200          : ${bad.length}`);
    for (const c of bad.slice(0, 5)) log(`   ${c.status}  ${c.url}  ${c.body}`);
    const ok = sessionCalls.filter((c) => c.status === 200);
    log(`   200            : ${ok.length}`);
    if (ok[0]) log(`   首个成功响应   : ${ok[0].body}`);
    log(`日志中兜底字样    : ${fallbackHits}`);
    log(`控制台 error      : ${consoleErrors.length}`);
    for (const e of consoleErrors.slice(0, 5)) log(`   ${e}`);
    log(`失败的请求(>=400) : ${failedResponses.length}`);
    for (const f of failedResponses.slice(0, 8)) log(`   ${f.status}  ${f.url}`);

    const pass =
      bouncedAt === null &&
      preemptScreenAt === null &&
      bad.length === 0 &&
      ok.length > 0 &&
      fallbackHits === 0;

    log(`\n判定: ${pass ? 'PASS' : 'FAIL'}`);
    await ctx.close();
    await browser.close();
    process.exit(pass ? 0 : 1);
  } catch (err) {
    log(`\n异常: ${err.message}`);
    log(`url = ${page.url()}`);
    log(`session 调用 ${sessionCalls.length}，queue 调用 ${queueCalls.length}`);
    for (const c of sessionCalls.slice(0, 5)) log(`   ${c.status} ${c.url} ${c.body}`);
    try { await ctx.close(); await browser.close(); } catch {}
    process.exit(2);
  }
})();
