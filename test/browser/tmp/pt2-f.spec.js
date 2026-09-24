'use strict';
const { test } = require('@playwright/test');
const { errs, shot, note, logTail, startUI, clearBoons } = require('./pt2-util');
const T = 'f';
test('forge and belt at a trader, Fighter Normal', async ({ page }) => {
  const E = errs(page, T);
  await startUI(page, { cls: 'Fighter', diff: 'normal', seed: 'pt2-mage-hard' });
  await clearBoons(page);
  const found = await page.evaluate(async () => {
    const G = Game.state(), p = G.player, T = Dungeon.T;
    for (let d = 0; d < 8; d++) {
      const L = Game.level();
      const n = (L.npcs || []).find(q => q.kind !== 'encounter');
      if (n) { for (let k = 0; k < 4; k++) { const [dx, dy] = Dungeon.DIRS[k]; const x = n.x - dx, y = n.y - dy; if (L.tiles[y * L.w + x] === T.FLOOR) { p.x = x; p.y = y; p.dir = k; return { depth: G.depth }; } } }
      if (!L.downStart) break;
      p.x = L.downStart.x; p.y = L.downStart.y; p.dir = (L.downStart.dir + 2) % 4;
      Game.input('forward');
      await new Promise(r => setTimeout(r, 320));
      if (Game.pendingBoons && Game.pendingBoons()) Game.chooseBoon(Game.pendingBoons()[0]);
    }
    return null;
  });
  await clearBoons(page);
  note(T, { found });
  await page.evaluate(() => { const p = Game.player(); p.gold = 900; p.eq.armor.e = -1; p.inv = p.inv.filter(i => i.t !== 'potion_heal'); p.inv.push({ t: 'potion_heal', q: 4 }); Game.level().monsters = Game.level().monsters.filter(m => Math.abs(m.x - p.x) + Math.abs(m.y - p.y) > 8); });
  await page.waitForTimeout(500);
  await page.tap('[data-tap="use"]'); await page.waitForTimeout(500);
  await page.evaluate(() => document.querySelector('#shop-services').scrollIntoView());
  await shot(page, 'f01-services-rusted');
  note(T, { before: await page.locator('#shop-services').innerText() });
  const svc = re => page.locator('#shop-services .shop-row', { hasText: re }).locator('button');
  await svc(/Reinforce/).tap(); await page.waitForTimeout(300);
  await svc(/Hone/).tap(); await page.waitForTimeout(300);
  await svc(/Hone/).tap(); await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelector('#shop-services').scrollIntoView());
  await shot(page, 'f02-services-after');
  note(T, { after: await page.locator('#shop-services').innerText(), log: await logTail(page, 4), gold: await page.evaluate(() => Game.player().gold) });
  const buy = page.locator('#shop-stock .shop-row', { hasText: /Potion of Healing/ }).locator('button');
  for (let i = 0; i < 3; i++) { if (await buy.count()) { await buy.first().tap().catch(() => {}); await page.waitForTimeout(250); } }
  await page.evaluate(() => document.querySelector('#shop-stock').scrollIntoView());
  await shot(page, 'f03-stock-belt');
  note(T, { buyLog: await logTail(page, 3), pots: await page.evaluate(() => Game.player().inv.filter(i => i.t === 'potion_heal').map(i => i.q)), row: await page.locator('#shop-stock .shop-row', { hasText: /Potion of Healing/ }).innerText().catch(() => 'none') });
  await page.tap('#ov-shop [data-close]'); await page.waitForTimeout(300);
  await shot(page, 'f04-after-shop');
  E.dump();
});
