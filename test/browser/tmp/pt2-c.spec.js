'use strict';
const { test } = require('@playwright/test');
const { errs, shot, note, logTail, startUI, clearBoons, descendTo, arena, place, tapAct } = require('./pt2-util');
const T = 'c';

test('Mage on Hard: bottle, rest, cast, trader forge, permadeath death', async ({ page }) => {
  const E = errs(page, T);
  await startUI(page, { cls: 'Mage', diff: 'hard', seed: 'pt2-mage-hard' });
  await clearBoons(page);
  await page.waitForTimeout(800);
  await shot(page, 'c01-mage-start');
  note(T, { inv: await page.evaluate(() => Game.player().inv.map(i => i.t + 'x' + (i.q || 1))), known: await page.evaluate(() => Object.keys(Game.state().known || {})), quaffVisible: await page.locator('#hud-quaff').isVisible(), castLabel: await page.textContent('[data-tap="cast"]') });
  await page.tap('#tip').catch(() => {});
  // cast at something in front
  await arena(page);
  let uid = await place(page, 'goblin', 2, { hp: 8, nextAct: 1e12 });
  await page.waitForTimeout(300);
  await page.tap('[data-tap="cast"]');
  await page.waitForTimeout(250);
  await shot(page, 'c02-cast-missile');
  await page.waitForTimeout(600);
  note(T, { cast: await logTail(page, 4) });
  await page.tap('[data-open="spells"]'); await page.waitForTimeout(300); await shot(page, 'c03-spells'); await page.tap('#ov-spells [data-close]');
  // hurt, bottle
  await page.evaluate(() => { Game.level().monsters.length = 0; const p = Game.player(); p.hp = Math.max(2, Math.floor(p.maxHp * 0.3)); p.lastHurt = -1e9; });
  await page.waitForTimeout(1200);
  await shot(page, 'c04-hurt-bottle');
  note(T, { quaffVisible: await page.locator('#hud-quaff').isVisible(), restLabel: await page.textContent('[data-tap="rest"]'), tip: await page.textContent('#tip') });
  // rest with foes near
  await arena(page);
  uid = await place(page, 'orc', 3, { hp: 30, nextAct: 1e12 });
  await page.waitForTimeout(400);
  await shot(page, 'c05-rest-foes-near');
  await page.tap('[data-tap="rest"]'); await page.waitForTimeout(300);
  note(T, { restNear: await logTail(page, 2), restLabel: await page.textContent('[data-tap="rest"]') });
  await shot(page, 'c06-rest-refused');
  if (await page.locator('#hud-quaff').isVisible()) { await page.tap('#hud-quaff'); await page.waitForTimeout(300); await shot(page, 'c07-bottle-drunk'); note(T, { drink: await logTail(page, 2) }); }
  await page.evaluate(() => { Game.level().monsters.length = 0; const p = Game.player(); p.hp = 3; });
  await page.waitForTimeout(400);
  note(T, { restLabelAlone: await page.textContent('[data-tap="rest"]') });
  await shot(page, 'c08-rest-ready');
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => { Game.player().hp = 3; });
    await page.waitForTimeout(250);
    const lab = await page.textContent('[data-tap="rest"]');
    await page.tap('[data-tap="rest"]'); await page.waitForTimeout(1500);
    note(T, { restN: i, label: lab, hp: await page.evaluate(() => Game.player().hp + '/' + Game.player().maxHp), log: await logTail(page, 2) });
    if (i === 0) await shot(page, 'c09-after-rest');
  }
  await shot(page, 'c10-rest-exhausted');
  // trader search from floor 1 down
  const found = await page.evaluate(async () => {
    const G = Game.state(), p = G.player, T = Dungeon.T;
    for (let d = 0; d < 8; d++) {
      const L = Game.level();
      const n = (L.npcs || []).find(q => q.kind !== 'encounter');
      if (n) {
        for (let k = 0; k < 4; k++) { const [dx, dy] = Dungeon.DIRS[k]; const x = n.x - dx, y = n.y - dy; if (L.tiles[y * L.w + x] === T.FLOOR) { p.x = x; p.y = y; p.dir = k; return { depth: G.depth }; } }
      }
      if (!L.downStart) break;
      p.x = L.downStart.x; p.y = L.downStart.y; p.dir = (L.downStart.dir + 2) % 4;
      Game.input('forward');
      await new Promise(r => setTimeout(r, 320));
      if (Game.pendingBoons && Game.pendingBoons()) Game.chooseBoon(Game.pendingBoons()[0]);
    }
    return null;
  });
  await clearBoons(page);
  note(T, { trader: found });
  if (found) {
    await page.evaluate(() => { const p = Game.player(); p.gold = 700; p.hp = p.maxHp; Game.level().monsters = Game.level().monsters.filter(m => Math.abs(m.x - p.x) + Math.abs(m.y - p.y) > 8); });
    await page.waitForTimeout(700);
    await shot(page, 'c11-facing-trader');
    note(T, { useLabel: await page.textContent('[data-tap="use"]'), tip: await page.textContent('#tip') });
    await page.tap('[data-tap="use"]'); await page.waitForTimeout(500);
    await shot(page, 'c12-shop-top');
    await page.evaluate(() => document.querySelector('#shop-services').scrollIntoView());
    await page.waitForTimeout(200);
    await shot(page, 'c13-shop-services');
    note(T, { services: await page.locator('#shop-services').innerText() });
    for (const re of [/Hone/i, /Reinforce/i, /Hone/i]) {
      const b = page.locator('#shop-services button', { hasText: re }).first();
      if (await b.count()) { await b.tap().catch(e => note(T, 'tap fail ' + e.message.slice(0, 60))); await page.waitForTimeout(300); }
    }
    await page.evaluate(() => document.querySelector('#shop-services').scrollIntoView());
    await shot(page, 'c14-shop-after-forge');
    note(T, { servicesAfter: await page.locator('#shop-services').innerText(), log: await logTail(page, 4), gold: await page.evaluate(() => Game.player().gold) });
    // buy healing potions until the belt stops it
    for (let i = 0; i < 7; i++) { const b = page.locator('#shop-stock button', { hasText: /Healing/ }).first(); if (!(await b.count())) break; await b.tap().catch(() => {}); await page.waitForTimeout(150); }
    await page.evaluate(() => document.querySelector('#shop-stock').scrollIntoView());
    await shot(page, 'c15-shop-belt');
    note(T, { buy: await logTail(page, 3), stock: (await page.locator('#shop-stock').innerText()).slice(0, 400), pots: await page.evaluate(() => Game.player().inv.filter(i => /potion_(x)?heal/.test(i.t)).map(i => i.t + 'x' + i.q)) });
    await page.tap('#ov-shop [data-close]');
  }
  // death under permadeath
  await clearBoons(page);
  await page.evaluate(() => { const p = Game.player(); p.hp = 1; p.inv = p.inv.filter(i => !/potion/.test(i.t)); });
  await arena(page);
  await place(page, 'ogre', 1, { hp: 99, nextAct: 0, blows: 0 });
  await page.waitForFunction(() => Game.state().status === 'dead', null, { timeout: 20000 });
  await page.waitForTimeout(300);
  await shot(page, 'c16-dying');
  await page.waitForSelector('#screen-end.active', { timeout: 15000 });
  await page.waitForTimeout(800);
  await shot(page, 'c17-death-screen');
  const sc = page.locator('#screen-end');
  await sc.evaluate(el => el.scrollTo(0, el.scrollHeight / 2)); await page.waitForTimeout(200); await shot(page, 'c18-death-mid');
  await sc.evaluate(el => el.scrollTo(0, el.scrollHeight)); await page.waitForTimeout(200); await shot(page, 'c19-death-bottom');
  note(T, { endTitle: await page.textContent('#end-title'), endText: await page.textContent('#end-text'), cause: await page.textContent('#end-cause'), loadVisible: await page.locator('#end-load').isVisible() });
  await page.click('#end-title-btn');
  await page.waitForTimeout(500);
  await shot(page, 'c20-title-after-death');
  note(T, { save: await page.textContent('#save-summary'), contDisabled: await page.locator('#btn-continue').isDisabled() });
  E.dump();
});
