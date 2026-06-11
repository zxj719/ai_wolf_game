// C 段 E2E：奇幻闯关 — 选路 → 节点执行（事件/休息/商店/对战）走完第一章或定量步数
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

async function playMinigameIfAny() {
  const title = await page.evaluate(() => document.querySelector('.mg-title')?.textContent ?? '');
  if (!title) return false;
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
  return true;
}

await page.goto(URL, { waitUntil: 'networkidle2' });
await page.select('select.player-select', 'Elza');
await clickByText('入场检录');
await page.waitForFunction(() => document.body.textContent.includes('今天打哪种比赛'));
await clickByText('奇幻闯关');
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
await page.waitForFunction(() => document.body.textContent.includes('第一章'));
console.log('① 闯关开始：第一章地图已渲染');
await page.screenshot({ path: '.tmp/tennis-v2-c-map.png' });

const seen = { battle: false, event: false, rest: false, shop: false };
let steps = 0;
const deadline = Date.now() + 240000;

while (Date.now() < deadline && steps < 12) {
  const body = await text();
  if (body.includes('夺回') || body.includes('闯关失败') || body.includes('第二章')) break;

  // 选路屏：点第一个选项
  if (body.includes('选择去向')) {
    await page.click('.opts .opt');
    steps++;
    await sleep(600);
    continue;
  }
  // 商店节点
  if (await page.$('.shop')) {
    seen.shop = true;
    await clickByText('离开商店');
    await sleep(600);
    continue;
  }
  // 休息节点
  if (body.includes('营地')) {
    seen.rest = true;
    await clickByText('休息');
    await sleep(600);
    continue;
  }
  // 剧情事件（A/B 选项卡片，无 .mg-shell 无对战面板）
  if (!await page.$('.bt-scorepanel') && !await page.$('.mg-shell') && await page.$('.opts .opt')) {
    seen.event = true;
    await page.click('.opts .opt');
    await sleep(700);
    continue;
  }
  // 事件小游戏
  if (await page.$('.mg-shell') && !await page.$('.bt-scorepanel')) {
    seen.event = true;
    await playMinigameIfAny();
    continue;
  }
  // 对战节点
  if (await page.$('.bt-scorepanel')) {
    seen.battle = true;
    const moveBtn = await page.$('.bt-move:not(.off):not(.ultimate)');
    if (moveBtn) {
      await page.evaluate(() => {
        const cost = (x) => {
          const t = x.querySelector('.bt-move-cost').textContent;
          return t.startsWith('+') ? -parseInt(t.slice(1)) : parseInt(t.slice(1)) || 0;
        };
        [...document.querySelectorAll('.bt-move:not(.off):not(.ultimate)')]
          .sort((a, b) => cost(a) - cost(b))[0].click();
      });
      await sleep(350);
      await playMinigameIfAny();
      continue;
    }
    if (await page.$('.mg-shell')) { await playMinigameIfAny(); continue; }
  }
  await sleep(500);
}

const final = await text();
console.log(`② 走过 ${steps} 步；节点覆盖：对战=${seen.battle} 事件=${seen.event} 休息=${seen.rest} 商店=${seen.shop}`);
console.log(`③ 终态：${final.includes('第二章') ? '进入第二章' : final.includes('闯关失败') ? '止步结算' : final.includes('夺回') ? '通关' : '进行中'}`);
await page.screenshot({ path: '.tmp/tennis-v2-c-final.png' });

const progress = await page.evaluate(() => JSON.parse(localStorage.getItem('tennis_v2_progress') || '{}'));
console.log(`④ 永久层：金币=${progress.coins ?? 0} 装备=${Object.keys(progress.equipment ?? {}).length}`);
console.log('errors:', errors.length ? errors : '(none)');
await browser.close();

const ended = final.includes('第二章') || final.includes('闯关失败') || final.includes('夺回') || steps >= 6;
if (!ended || errors.length) { console.error('C E2E FAIL'); process.exit(1); }
console.log('C 段 E2E PASS ✅');
