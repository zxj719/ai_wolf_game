// B 段 E2E：模式选择 → 家族挑战首站对战 → 掉落/金币入永久层 → 赛间三选一（进店）
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'http://localhost:3000/tennis';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 960 });

const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('/api/tennis/')) errors.push(m.text());
});

const text = () => page.evaluate(() => document.body.textContent);
const clickByText = (t) => page.evaluate((s) => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes(s));
  if (b) { b.click(); return true; } return false;
}, t);
const tap = (sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el) return false;
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  return true;
}, sel);

async function playOneMatch(deadlineMs) {
  let rallies = 0;
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    const body = await text();
    if (body.includes('站拿下') || body.includes('止步') || body.includes('球王加冕')) return { rallies, done: true };

    if (await page.$('.mg-shell') && body.includes('发球')) {
      await sleep(300 + Math.random() * 400);
      await tap('.mg-tap-area');
      await sleep(800);
      continue;
    }
    const moveBtn = await page.$('.bt-move:not(.off):not(.ultimate)');
    if (moveBtn) {
      // 节能策略：总是选耗体最低的招（切削回体优先）
      await page.evaluate(() => {
        const cost = (x) => {
          const t = x.querySelector('.bt-move-cost').textContent;
          return t.startsWith('+') ? -parseInt(t.slice(1)) : parseInt(t.slice(1)) || 0;
        };
        [...document.querySelectorAll('.bt-move:not(.off):not(.ultimate)')]
          .sort((a, b) => cost(a) - cost(b))[0].click();
      });
      rallies++;
      await sleep(350);
      const title = await page.evaluate(() => document.querySelector('.mg-title')?.textContent ?? '');
      if (title.includes('重炮')) {
        for (let i = 0; i < 12; i++) { await tap('.mg-tap-area'); await sleep(110); }
        await sleep(2200);
      } else if (title.includes('截击')) {
        for (let i = 0; i < 3; i++) {
          try { await page.waitForSelector('.mg-flyball', { timeout: 4000 }); await tap('.mg-flyball'); }
          catch { break; }
          await sleep(250);
        }
        await sleep(700);
      } else if (title.includes('挑高球')) {
        try {
          await page.waitForFunction(() => !document.querySelector('.mg-dir-target')?.textContent.includes('…'), { timeout: 4000 });
          await page.evaluate(() => {
            const t = document.querySelector('.mg-dir-target')?.textContent.trim();
            const btn = [...document.querySelectorAll('.mg-dir-btn')].find((b) => b.textContent.trim() === t);
            (btn ?? document.querySelector('.mg-dir-btn')).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
          });
        } catch { /* noop */ }
        await sleep(800);
      } else if (title.includes('放小球')) {
        await tap('.mg-tap-area');
        await sleep(450);
        await page.evaluate(() => document.querySelector('.mg-tap-area')?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })));
        await sleep(800);
      } else if (title.includes('上旋') || title.includes('穿越')) {
        for (let i = 0; i < 3; i++) { await sleep(420); await tap('.mg-tap-area'); }
        await sleep(800);
      } else {
        await sleep(400 + Math.random() * 400);
        await tap('.mg-tap-area');
        await sleep(800);
      }
      continue;
    }
    await sleep(400);
  }
  return { rallies, done: false };
}

await page.goto(URL, { waitUntil: 'networkidle2' });
await page.select('select.player-select', 'Elza');
await clickByText('入场检录');
await page.waitForFunction(() => document.body.textContent.includes('今天打哪种比赛'));
console.log('① 模式选择屏出现');
await clickByText('家族挑战');
await page.waitForSelector('.arena');
await page.click('.arena');
await page.waitForSelector('.ball-btn', { timeout: 10000 });
await page.click('.ball-btn');
await page.waitForSelector('.grade-badge');
await clickByText('进入备战');
for (let i = 0; i < 4; i++) {
  await page.waitForSelector('.opts .opt');
  await page.click('.opts .opt');
  await sleep(600);
}
await page.waitForSelector('.ladder-bar');
console.log('② 家族挑战首站开战（梯度进度条已渲染）');

const m1 = await playOneMatch(180000);
console.log(`③ 首站打完（${m1.rallies} 次出招，结束=${m1.done}）`);
await page.screenshot({ path: '.tmp/tennis-v2-b-after-m1.png' });

const body = await text();
const progress = await page.evaluate(() => JSON.parse(localStorage.getItem('tennis_v2_progress') || '{}'));
console.log(`④ 永久层：金币=${progress.coins} 装备槽=${Object.keys(progress.equipment ?? {}).length} 成就=${(progress.achievements ?? []).join(',')}`);

let shopOk = 'n/a';
if (body.includes('站拿下')) {
  await clickByText('逛网球用品店');
  await page.waitForSelector('.shop');
  const shopText = await text();
  shopOk = ['战术卡', '卡牌强化', '装备架', '装备升级'].every((s) => shopText.includes(s));
  console.log(`⑤ 商店五项服务渲染: ${shopOk}`);
  await page.screenshot({ path: '.tmp/tennis-v2-b-shop.png' });
  await clickByText('离开商店');
  await page.waitForSelector('.bt-scorepanel', { timeout: 10000 });
  console.log('⑥ 离店后第二站开战');
} else {
  console.log('⑤ 首站告负 → 止步结算屏（战利品保留路径）');
}

console.log('errors:', errors.length ? errors : '(none)');
await browser.close();

const coinsOk = (progress.coins ?? 0) > 0;
if (!m1.done || !coinsOk || errors.length || shopOk === false) { console.error('B E2E FAIL'); process.exit(1); }
console.log('B 段 E2E PASS ✅');
