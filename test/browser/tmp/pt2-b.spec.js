'use strict';
const { test } = require('@playwright/test');
const { errs, shot, note, logTail, startUI, clearBoons, descendTo, arena, place, tapAct } = require('./pt2-util');
const T = 'b';
const waitWind = (page, uid, t = 8000) => page.waitForFunction(uid => { const m = Game.level().monsters.find(m => m.uid === uid); return m && m.windup && m.windup.kind === 'move'; }, uid, { timeout: t }).then(() => true, () => false);

test('tricks, forge and belt: Fighter on Normal', async ({ page }) => {
  const E = errs(page, T);
  await startUI(page, { cls: 'Fighter', diff: 'normal', seed: 'pt2-tricks' });
  await clearBoons(page);
  await page.waitForTimeout(500);
  await page.tap('#tip').catch(() => {});
  const d = await descendTo(page, 5);
  await clearBoons(page);
  note(T, { depth: d });
  await page.evaluate(() => { const p = Game.player(); p.maxHp = 90; p.hp = 90; p.level = Math.max(p.level, 5); });
  await page.waitForTimeout(600);
  await shot(page, 'b01-depth5');

  // ---- ogre crush: step back
  await arena(page);
  let uid = await place(page, 'ogre', 1, { hp: 60, blows: 2, nextAct: 0 });
  const w1 = await waitWind(page, uid);
  await page.waitForTimeout(150);
  await shot(page, 'b02-ogre-windup');
  note(T, { ogreWind: w1, log: await logTail(page, 3) });
  await tapAct(page, 'back');
  await page.waitForTimeout(1100);
  await shot(page, 'b03-ogre-missed');
  note(T, { afterCrush: await logTail(page, 4), opening: await page.evaluate(() => !!Game.player().opening) });
  await tapAct(page, 'forward');
  await page.waitForTimeout(300);
  await page.tap('.ctl.attack');
  await page.waitForTimeout(250);
  await shot(page, 'b04-ogre-opening-hit');
  note(T, { openingHit: await logTail(page, 4) });

  // ---- ogre crush: take it (what does a landed crush look like?)
  await arena(page);
  uid = await place(page, 'ogre', 1, { hp: 60, blows: 2, nextAct: 0 });
  await waitWind(page, uid);
  await page.waitForTimeout(1200);
  await shot(page, 'b05-ogre-crush-landed');
  note(T, { crushLanded: await logTail(page, 4), hp: await page.evaluate(() => Game.player().hp) });

  // ---- orc charge: stay in line, get knocked down
  await page.evaluate(() => { const p = Game.player(); p.hp = p.maxHp; });
  await arena(page);
  for (let tries = 0; tries < 8; tries++) {
    await page.evaluate(() => { Game.level().monsters.length = 0; });
    uid = await place(page, 'orc', 3, { hp: 40, nextAct: 0, moveReady: 0 });
    if (await waitWind(page, uid, 2500)) break;
  }
  await page.waitForTimeout(100);
  await shot(page, 'b06-orc-charge-windup');
  note(T, { orcWind: await logTail(page, 3) });
  await page.waitForTimeout(750);
  await shot(page, 'b07-orc-knockdown');
  note(T, { knock: await logTail(page, 4), held: await page.evaluate(() => ({ held: Game.player().held - Game.state().t, by: Game.player().heldBy })) });
  await tapAct(page, 'back');   // try to move while down
  await page.waitForTimeout(150);
  await shot(page, 'b08-orc-down-try-move');
  note(T, { tryMove: await logTail(page, 3) });
  // second orc: sidestep the charge
  await page.waitForTimeout(1200);
  await arena(page);
  for (let tries = 0; tries < 8; tries++) {
    await page.evaluate(() => { Game.level().monsters.length = 0; });
    uid = await place(page, 'orc', 3, { hp: 40, nextAct: 0, moveReady: 0 });
    if (await waitWind(page, uid, 2500)) break;
  }
  // make sure the side is open
  await page.evaluate(() => { const p = Game.player(), L = Game.level(); const [dx, dy] = Dungeon.DIRS[(p.dir + 1) % 4]; L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR; });
  await tapAct(page, 'strafeR');
  await page.waitForTimeout(900);
  await shot(page, 'b09-orc-sidestep');
  note(T, { sidestep: await logTail(page, 4) });

  // ---- basilisk gaze: turn away
  await page.evaluate(() => { const p = Game.player(); p.hp = p.maxHp; p.held = 0; });
  await tapAct(page, 'strafeL'); await page.waitForTimeout(300);
  await arena(page);
  for (let tries = 0; tries < 8; tries++) {
    await page.evaluate(() => { Game.level().monsters.length = 0; });
    uid = await place(page, 'basilisk', 2, { hp: 40, nextAct: 0, moveReady: 0, blows: 1 });
    if (await waitWind(page, uid, 2500)) break;
  }
  await page.waitForTimeout(250);
  await shot(page, 'b10-basilisk-gaze-windup');
  note(T, { gaze: await logTail(page, 3), tip: await page.textContent('#tip') });
  await tapAct(page, 'right');
  await page.waitForTimeout(1100);
  await shot(page, 'b11-basilisk-turned-away');
  note(T, { turned: await logTail(page, 4), tip: await page.textContent('#tip') });
  await tapAct(page, 'left'); await page.waitForTimeout(300);
  await page.tap('.ctl.attack'); await page.waitForTimeout(200);
  await shot(page, 'b12-basilisk-opening');
  note(T, { basOpen: await logTail(page, 3) });
  // and look at it: be stoned
  await arena(page);
  for (let tries = 0; tries < 8; tries++) {
    await page.evaluate(() => { Game.level().monsters.length = 0; });
    uid = await place(page, 'basilisk', 2, { hp: 40, nextAct: 0, moveReady: 0, blows: 1 });
    if (await waitWind(page, uid, 2500)) break;
  }
  await page.waitForTimeout(1250);
  await shot(page, 'b13-basilisk-stoned');
  note(T, { stoned: await logTail(page, 3) });

  // ---- rustmaw bite: take it
  await page.waitForTimeout(1600);
  await page.evaluate(() => { const p = Game.player(); p.hp = p.maxHp; });
  await arena(page);
  const armorBefore = await page.evaluate(() => JSON.stringify(Game.player().eq.armor));
  uid = await place(page, 'rustmaw', 1, { hp: 40, blows: 2, nextAct: 0 });
  await waitWind(page, uid);
  await page.waitForTimeout(200);
  await shot(page, 'b14-rustmaw-windup');
  note(T, { rustTip: await page.textContent('#tip') });
  await page.waitForTimeout(900);
  await shot(page, 'b15-rustmaw-bit');
  note(T, { rust: await logTail(page, 4), armorBefore, armorAfter: await page.evaluate(() => JSON.stringify(Game.player().eq.armor)) });
  await page.evaluate(() => { Game.level().monsters.length = 0; });
  await page.tap('[data-open="inv"]'); await page.waitForTimeout(300);
  await page.locator('#equip > *').nth(2).tap().catch(() => {});
  await page.waitForTimeout(300);
  await shot(page, 'b16-pack-rusted-armour');
  await page.tap('#ov-inv [data-close]');
  // bestiary after all that
  await page.tap('[data-open="journal"]'); await page.tap('[data-jtab="beasts"]'); await page.waitForTimeout(300);
  await shot(page, 'b17-journal-bestiary');
  await page.tap('#ov-journal [data-close]');

  // ---- belt: five potions
  await page.evaluate(() => {
    const p = Game.player(), L = Game.level(), k = `${p.x},${p.y}`;
    p.inv = p.inv.filter(i => i.t !== 'potion_heal');
    p.inv.push({ t: 'potion_heal', q: 3 });
    (L.items[k] = L.items[k] || []).push({ t: 'potion_heal', q: 4 });
  });
  await page.waitForTimeout(400);
  await shot(page, 'b18-standing-on-potions');
  note(T, { useLabel: await page.textContent('[data-tap="use"]') });
  await page.tap('[data-tap="use"]'); await page.waitForTimeout(400);
  await shot(page, 'b19-belt-full');
  note(T, { belt: await logTail(page, 3), q: await page.evaluate(() => Game.player().inv.filter(i => i.t === 'potion_heal').map(i => i.q)), left: await page.evaluate(() => { const p = Game.player(); return JSON.stringify(Game.level().items[`${p.x},${p.y}`]); }) });
  await page.tap('[data-tap="use"]'); await page.waitForTimeout(400);
  note(T, { belt2: await logTail(page, 2) });

  // ---- trader forge
  const found = await page.evaluate(async () => {
    const G = Game.state(), p = G.player, T = Dungeon.T;
    for (let d = 0; d < 4; d++) {
      const L = Game.level();
      const n = (L.npcs || []).find(q => q.kind !== 'encounter');
      if (n) {
        for (let k = 0; k < 4; k++) { const [dx, dy] = Dungeon.DIRS[k]; const x = n.x - dx, y = n.y - dy; if (L.tiles[y * L.w + x] === T.FLOOR) { p.x = x; p.y = y; p.dir = k; return { depth: G.depth }; } }
      }
      if (!L.downStart) break;
      p.x = L.downStart.x; p.y = L.downStart.y; p.dir = (L.downStart.dir + 2) % 4;
      Game.input('forward');
      await new Promise(r => setTimeout(r, 300));
    }
    return null;
  });
  await clearBoons(page);
  note(T, { trader: found });
  await page.evaluate(() => { Game.player().gold = 600; Game.level().monsters = Game.level().monsters.filter(m => Math.abs(m.x - Game.player().x) + Math.abs(m.y - Game.player().y) > 8); });
  await page.waitForTimeout(500);
  await shot(page, 'b20-facing-trader');
  note(T, { useLabel: await page.textContent('[data-tap="use"]') });
  await page.tap('[data-tap="use"]'); await page.waitForTimeout(500);
  await shot(page, 'b21-shop-top');
  await page.locator('#shop-services').scrollIntoViewIfNeeded();
  await shot(page, 'b22-shop-services');
  note(T, { services: await page.locator('#shop-services').innerText() });
  const hone = page.locator('#shop-services button', { hasText: /Hone/i }).first();
  if (await hone.count()) { await hone.tap(); await page.waitForTimeout(300); }
  const reinf = page.locator('#shop-services button', { hasText: /Reinforce|mend|rust/i }).first();
  if (await reinf.count()) { await reinf.tap(); await page.waitForTimeout(300); }
  await shot(page, 'b23-shop-after-forge');
  note(T, { servicesAfter: await page.locator('#shop-services').innerText(), log: await logTail(page, 4) });
  // buy potions past the belt
  const buyPot = page.locator('#shop-stock button', { hasText: /Healing/ }).first();
  if (await buyPot.count()) { await buyPot.tap(); await page.waitForTimeout(300); await shot(page, 'b24-shop-buy-past-belt'); note(T, { buy: await logTail(page, 2), stock: await page.locator('#shop-stock').innerText() }); }
  await page.tap('#ov-shop [data-close]');
  E.dump();
});
