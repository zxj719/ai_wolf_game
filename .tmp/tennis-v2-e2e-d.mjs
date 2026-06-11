// D 段 E2E：开盒机制 — 预置金币 → 家族挑战赢首站 → 进店 → 开木盒玩 Flappy → 结算
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'http://localhost:3000/tennis';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 960 });
await page.evaluateOnNewDocument(() => {
  localStorage.setItem('tennis_v2_progress', JSON.stringify({
    coins: 500, equipment: {}, unlockedMoves: [], achievements: [],
    championships: 0, adventureClears: 0,
  }));
  // 预置家族挑战赛间快照：直达三选一界面（确定性覆盖开盒路径）
  sessionStorage.setItem('tennis_v2_ladder_snapshot', JSON.stringify({
    ladder: {
      stage: 0,
      opponents: ['诚', '菲比', 'Ross', '铁蛋', '丫', '莹'].map((n, i) => ({
        name: n, face: ['🐯', '🐰', '🦖', '🍳', '🐱', '🦢'][i],
        sta: 45 + i * 8, skill: 45 + i * 8, mind: 45 + i * 8,
      })),
      status: 'between',
      carryEnergy: 80, lastRemainingEnergy: 40, massageBonus: 0,
      bonusStats: { sta: 0, skill: 0, mind: 0 },
      drops: [], coinsEarned: 50, unlockedThisRun: ['虎啸正手'],
      pendingShop: false,
    },
    deck: [{ cardId: 'towelTime', upgraded: false }],
  }));
});

const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

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

let survivalInBattle = 0;
async function playMinigame() {
  const title = await page.evaluate(() => document.querySelector('.mg-title')?.textContent ?? '');
  if (title.includes('飞翔') || title.includes('躲避')) survivalInBattle++;
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
  } else if (title.includes('飞翔') || title.includes('躲避')) {
    // 坚持类（关键分挑战）：随缘扇翅 11 秒
    for (let i = 0; i < 28; i++) { await tap('.mg-tap-area'); await sleep(400); }
  } else if (title.includes('上旋') || title.includes('穿越')) {
    for (let i = 0; i < 3; i++) { await sleep(420); await tap('.mg-tap-area'); }
    await sleep(800);
  } else {
    await sleep(400 + Math.random() * 400);
    await tap('.mg-tap-area');
    await sleep(800);
  }
}

await page.goto(URL, { waitUntil: 'networkidle2' });
await page.select('select.player-select', 'Elza');
await clickByText('入场检录');
await page.waitForFunction(() => document.body.textContent.includes('今天打哪种比赛'));
const coinsShown = await page.evaluate(() => document.body.textContent.includes('500 金币'));
console.log(`① 预置金币生效: ${coinsShown}`);
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
await page.waitForFunction(() => document.body.textContent.includes('站拿下'));
console.log('② 快照恢复：直达赛间三选一');

const afterM1 = await text();
let boxOk = 'n/a';
if (afterM1.includes('站拿下')) {
  await clickByText('逛网球用品店');
  await page.waitForSelector('.shop');
  const shopHasBoxes = (await text()).includes('盲盒');
  console.log(`④ 盲盒区渲染: ${shopHasBoxes}`);
  await clickByText('木盒');
  await page.waitForFunction(() => document.body.textContent.includes('开木盒'));
  console.log('⑤ 开盒小游戏启动，随缘扇翅 11s…');
  for (let i = 0; i < 30; i++) { await tap('.mg-tap-area'); await sleep(380); }
  await page.waitForSelector('.shop-section', { timeout: 15000 });   // 回到商店主界面
  const prog = await page.evaluate(() => JSON.parse(localStorage.getItem('tennis_v2_progress') || '{}'));
  boxOk = prog.achievements?.includes('boxOpener') && Object.keys(prog.equipment ?? {}).length >= 1;
  console.log(`⑥ 开盒结算: boxOpener=${prog.achievements?.includes('boxOpener')} 装备槽=${Object.keys(prog.equipment ?? {}).length} 金币=${prog.coins}`);
  await page.screenshot({ path: '.tmp/tennis-v2-d-shop.png' });
}

console.log('errors:', errors.length ? errors : '(none)');
await browser.close();
if (errors.length || boxOk === false) { console.error('D E2E FAIL'); process.exit(1); }
console.log('D 段 E2E PASS ✅');
