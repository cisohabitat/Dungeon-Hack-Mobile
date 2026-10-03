'use strict';
// The endgame: the Heart is held fast while the lich stands; bring it down,
// lift the Heart, and the run is won on the spot. There is no climb back out.
const { test } = require('@playwright/test');
const { expect, watchForErrors, startGame, descendTo, placeMonster } = require('./helpers');

/** Stand on the Heart and try to take it. */
const takeHeart = () => {
  const G = Game.state(), L = Game.level(), p = G.player;
  let spot = null;
  for (const k in L.items) if (L.items[k].some(i => i.t === 'artifact')) spot = k.split(',').map(Number);
  if (!spot) return { error: 'no Heart on the final level' };
  p.x = spot[0]; p.y = spot[1];
  const mark = G.logSeq;
  Game.takeItem(L.items[`${spot[0]},${spot[1]}`].find(i => i.t === 'artifact'));
  const said = G.log.slice(-Math.min(G.logSeq - mark, G.log.length)).map(e => e.m);
  return {
    status: G.status, said,
    carrying: p.inv.some(i => i.t === 'artifact'),
    onFloor: !!(L.items[`${spot[0]},${spot[1]}`] || []).some(i => i.t === 'artifact'),
  };
};

test.describe('the endgame', () => {
  test('down the Warrens the Warlord keeps the Heart: he is drawn, speaks, and his life runs across the top of the view', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'end-warlord', levels: '8' });
    await page.evaluate(() => { Game.player().maxHp = 900; Game.player().hp = 900; });
    expect(await descendTo(page, 8)).toBe(8);
    expect(await page.evaluate(() => Game.route())).toBe('warrens');
    const boss = await page.evaluate(() => Game.level().monsters.filter(m => MONSTERS[m.id].boss).map(m => m.id));
    expect(boss).toEqual(['warlord']);
    expect(await page.evaluate(() => Game.state().log.some(e => /war-drum booms/.test(e.m)))).toBe(true);
    // bring him round to face the hero, awake
    await page.evaluate(() => {
      const L = Game.level(), m = L.monsters.find(o => o.id === 'warlord'), p = Game.player();
      L.monsters.length = 0; L.monsters.push(m);
      for (let k = 0; k < 4; k++) {
        const [dx, dy] = Dungeon.DIRS[k], x = p.x + dx * 2, y = p.y + dy * 2;
        if (L.tiles[y * L.w + x] === Dungeon.T.FLOOR && L.tiles[(p.y + dy) * L.w + p.x + dx] === Dungeon.T.FLOOR) { p.dir = k; Object.assign(m, { x, y, rx: x, ry: y, fromX: x, fromY: y, awake: true, nextAct: Game.state().t + 1e9, moveT1: 0 }); break; }
      }
    });
    await expect.poll(() => page.evaluate(() => (Game.renderState(performance.now()).fx.boss || {}).name)).toBe('Goblin Warlord');
    expect(await page.evaluate(() => Game.state().log.some(e => /fine footstool/.test(e.m)))).toBe(true);
    // (his picture is painted in the background, the first time a floor wants it: under load it can be a moment coming)
    await expect.poll(() => page.evaluate(() => Game.renderState(performance.now()).sprites.some(s => s.img === Assets.sprites.warlord)), { timeout: 8000 }).toBe(true);
    expect(errors).toEqual([]);
  });

  test('at the bottom of a Long Delve the Heartforged keeps the Heart: drawn, waking, its life across the top, and a tip when it raises its hammer', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'end-forge', levels: '12', tips: true });
    // past the first tip, which holds the dungeon still
    for (let i = 0; i < 3 && await page.locator('#tip.show').isVisible(); i++) { await page.locator('#tip').click(); await page.waitForTimeout(200); }
    await page.evaluate(() => { const p = Game.player(); p.maxHp = 900; p.hp = 900; Game.testFloor(12); });
    for (let i = 0; i < 10 && await page.locator('#ov-boons.open').isVisible(); i++) {
      await page.locator('#boon-list .boon').first().click(); await page.waitForTimeout(700);
      if (await page.locator('.spread-stat').count()) { await page.locator('.spread-stat:not(.full)').first().click(); await page.locator('.spread-stat:not(.full)').first().click(); }
    }
    expect(await page.evaluate(() => Game.level().monsters.filter(m => MONSTERS[m.id].boss).map(m => m.id))).toEqual(['heartforged']);
    expect(await page.evaluate(() => Game.state().log.some(e => /hammer rings on iron/.test(e.m)))).toBe(true);
    // bring it round to face the hero, two squares off down a line, awake
    await page.evaluate(() => {
      const L = Game.level(), m = L.monsters.find(o => o.id === 'heartforged'), p = Game.player();
      L.monsters.length = 0; L.monsters.push(m);
      for (let k = 0; k < 4; k++) {
        const [dx, dy] = Dungeon.DIRS[k], x = p.x + dx * 2, y = p.y + dy * 2;
        if (L.tiles[y * L.w + x] === Dungeon.T.FLOOR && L.tiles[(p.y + dy) * L.w + p.x + dx] === Dungeon.T.FLOOR) { p.dir = k; Object.assign(m, { x, y, rx: x, ry: y, fromX: x, fromY: y, awake: true, nextAct: Game.state().t + 1e9, moveT1: 0 }); break; }
      }
    });
    await expect.poll(() => page.evaluate(() => (Game.renderState(performance.now()).fx.boss || {}).name)).toBe('Heartforged');
    expect(await page.evaluate(() => Game.state().log.some(e => /a furnace opens in its chest/.test(e.m)))).toBe(true);
    expect(await page.evaluate(() => Game.renderState(performance.now()).sprites.some(s => s.img === Assets.sprites.heartforged))).toBe(true);
    // it raises its hammer: the tip says to step off its lines, and the drawing has the hammer up
    if (await page.locator('#tip.show').isVisible()) await page.locator('#tip').click();
    await page.evaluate(() => { const m = Game.level().monsters[0]; m.blows = 1; m.moveReady = 0; m.nextAct = Game.state().t; });
    await expect(page.locator('#tip')).toContainText('Step off its lines', { timeout: 4000 });
    // (the view draws its raised-hammer picture for a sprite with a tell)
    expect(await page.evaluate(() => Game.renderState(performance.now()).sprites.some(s => s.img === Assets.sprites.heartforged && s.tell && !!s.img.windup))).toBe(true);
    expect(errors).toEqual([]);
  });

  test('the Long Delve passes through the dark elves\' halls: their floor named on the map, their warriors, mages and High Priestess drawn as themselves, a tip when blades cross', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'end-elves', levels: '12', tips: true });
    for (let i = 0; i < 3 && await page.locator('#tip.show').isVisible(); i++) { await page.locator('#tip').click(); await page.waitForTimeout(200); }
    await page.evaluate(() => { const p = Game.player(); p.maxHp = 900; p.hp = 900; Game.testFloor(10); });
    for (let i = 0; i < 10 && await page.locator('#ov-boons.open').isVisible(); i++) {
      await page.locator('#boon-list .boon').first().click(); await page.waitForTimeout(700);
      if (await page.locator('.spread-stat').count()) { await page.locator('.spread-stat:not(.full)').first().click(); await page.locator('.spread-stat:not(.full)').first().click(); }
    }
    const kinds = await page.evaluate(() => [...new Set(Game.level().monsters.map(m => m.id))].sort());
    expect(kinds).toEqual(['drow_mage', 'drow_warrior', 'vaelith']);
    expect(await page.evaluate(() => THEMES[Game.level().theme].name)).toBe('The Dark Elf Halls');
    // their altar stands on the floor, drawn as itself, and the bestiary says where they live
    expect(await page.evaluate(() => (Game.level().npcs || []).some(n => n.id === 'spider_altar') && !!Assets.sprites.spider_altar)).toBe(true);
    // each of them stands before the hero in turn, drawn as itself
    await page.evaluate(() => { const L = Game.level(), p = Game.player(); L.monsters.length = 0; for (let k = 0; k < 4; k++) { const [dx, dy] = Dungeon.DIRS[k]; if ([1, 2].every(n => L.tiles[(p.y + dy * n) * L.w + p.x + dx * n] === Dungeon.T.FLOOR)) { p.dir = k; break; } } });
    for (const [id, art] of [['drow_warrior', 'drow_warrior'], ['drow_mage', 'drow_mage'], ['vaelith', 'vaelith']]) {
      await page.evaluate(() => { Game.level().monsters.length = 0; });
      expect(await placeMonster(page, id, 2, { hp: 200 })).not.toBeNull();
      await expect.poll(() => page.evaluate(a => {
        const want = a === 'vaelith' ? Assets.sprites.drow_mage.elite.vaelith : Assets.sprites[a];
        return Game.renderState(performance.now()).sprites.some(s => s.img === want);
      }, art), { timeout: 8000 }).toBe(true);
    }
    // a warrior beside the hero crosses its blades: the tip says to hold the blow, and the picture has the blades crossed
    await page.evaluate(() => { Game.level().monsters.length = 0; });
    await placeMonster(page, 'drow_warrior', 1, { hp: 200, blows: 1 });
    await page.evaluate(() => { const m = Game.level().monsters[0]; m.windup = { kind: 'move', move: 'parry', at: Game.state().t, until: Game.state().t + 1e9 }; m.nextAct = 1e12; });
    await expect(page.locator('#tip')).toContainText('Hold your blow', { timeout: 4000 });
    expect(await page.evaluate(() => Game.renderState(performance.now()).sprites.some(s => s.img === Assets.sprites.drow_warrior && s.tell && s.special && !!s.img.special))).toBe(true);
    expect(errors).toEqual([]);
  });

  test('the Heart will not come loose while the lich stands', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'end-held', levels: '4' });
    await page.evaluate(() => { Game.player().maxHp = 600; Game.player().hp = 600; });
    expect(await descendTo(page, 4)).toBe(4);
    const r = await page.evaluate(takeHeart);
    expect(r.error).toBeUndefined();
    expect(r.status, 'the run must go on while the lich lives').toBe('playing');
    expect(r.carrying).toBe(false);
    expect(r.onFloor, 'the Heart stays where it lies').toBe(true);
    expect(r.said.join(' ')).toMatch(/will not come loose/);
    // the pack's floor row says why instead of offering a Take that does nothing to see
    await page.click('[data-open="inv"]');
    await expect(page.locator('#floor-box')).toContainText('held fast while the lich stands');
    await expect(page.locator('#floor-box .floor-item', { hasText: 'Heart' }).locator('button')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('with the lich down, lifting the Heart wins at once: its light fills the view, then victory', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'end-won', levels: '4' });
    await page.evaluate(() => { Game.player().maxHp = 600; Game.player().hp = 600; });
    expect(await descendTo(page, 4)).toBe(4);
    const r = await page.evaluate(() => {
      const L = Game.level();
      const at = L.monsters.findIndex(m => m.id === 'lich');
      if (at < 0) return { error: 'no lich' };
      L.monsters.splice(at, 1);
      return null;
    });
    expect(r).toBeNull();
    const taken = await page.evaluate(takeHeart);
    expect(taken.status, 'taking the Heart ends the run').toBe('won');
    expect(taken.carrying).toBe(true);
    expect(await page.evaluate(() => Game.state().depth), 'won where it was taken, no climb').toBe(4);
    // the light first: the victory screen waits for it
    await page.waitForTimeout(1900);
    await expect(page.locator('#screen-end')).toBeHidden();
    const lit = await page.evaluate(() => {
      const c = document.getElementById('view'), x = c.getContext('2d');
      const d = x.getImageData(c.width / 2 - 20, c.height / 3, 40, 40).data;
      let sum = 0; for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
      return sum / (d.length / 4) / 3;
    });
    expect(lit, 'the middle of the view should be flooded with light').toBeGreaterThan(150);
    await expect(page.locator('#screen-end')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#end-title')).toHaveText(/VICTORY/i);
    await expect(page.locator('#end-text')).toContainText(/Dread Lich/);
    await expect(page.locator('#end-epilogue p').first()).toContainText(/Heart of the Mountain/i);
    const hall = await page.evaluate(() => Game.hall()[0]);
    expect(hall.won).toBe(true);
    expect(errors).toEqual([]);
  });

  test('quitting while the light rises leaves the victory behind with its run', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'end-quit', levels: '4' });
    await page.evaluate(() => {
      const p = Game.player(), L = Game.level(); L.monsters.length = 0;
      const k = p.x + ',' + p.y; (L.items[k] = L.items[k] || []).push({ t: 'artifact', q: 1, e: 0 });
      Game.takeItem(L.items[k].find(i => i.t === 'artifact'));
    });
    expect(await page.evaluate(() => Game.state().status)).toBe('won');
    // straight out to the title and into a new run, well inside the finale
    await page.locator('[data-open="menu"]').first().click();
    await page.click('#m-quit');
    await expect(page.locator('#screen-title')).toBeVisible();
    await page.click('#btn-new');
    await page.fill('#c-seed', 'end-quit-2');
    await page.click('#c-begin');
    await page.click('#pro-begin');
    await expect(page.locator('#screen-game')).toBeVisible();
    await page.waitForTimeout(3200);
    await expect(page.locator('#screen-end'), 'the old run\'s victory must not cover the new one').toBeHidden();
    expect(await page.evaluate(() => Game.state().status)).toBe('playing');
    expect(errors).toEqual([]);
  });

  test('an old climbing save opened straight from the title still shows the rising light', async ({ page }) => {
    await startGame(page, { seed: 'end-cold', levels: '4' });
    await page.evaluate(() => Game.save());
    // a fresh page: the game clock has not started when the save is opened. The
    // page saves again as it is put away, so the save is edited only after
    await page.goto('/');
    const left = await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('deepdelve.save'));
      s.escaping = true;
      localStorage.setItem('deepdelve.save', JSON.stringify(s));
      Game.load();
      if (Game.state().status !== 'won') return -1;
      // the renderer runs on the page's clock: the light must start now by that clock
      const fx = Game.renderState(performance.now()).fx;
      return 2600 - (performance.now() - fx.heartAt);
    });
    expect(left, 'the light should have its full time to rise').toBeGreaterThan(2000);
  });

  test('a run saved on the old climb out loads as won', async ({ page }) => {
    await startGame(page, { seed: 'end-old', levels: '4' });
    await page.evaluate(() => {
      Game.save();
      const s = JSON.parse(localStorage.getItem('deepdelve.save'));
      s.escaping = true; s.escapeStart = 1000; s.nextHunt = 5000; s.hunts = 3;
      s.player.inv.push({ t: 'artifact', q: 1, e: 0 });
      localStorage.setItem('deepdelve.save', JSON.stringify(s));
      Game.load();
    });
    expect(await page.evaluate(() => Game.state().status)).toBe('won');
    expect(await page.evaluate(() => 'hunts' in Game.state() || 'escaping' in Game.state())).toBe(false);
    await expect(page.locator('#end-title')).toHaveText(/VICTORY/i, { timeout: 6000 });
  });
});

test('a second death opens the end screen at its title, not where the last one was scrolled to', async ({ page }) => {
  const { clearBoons, faceOpenGround, placeMonster } = require('./helpers');
  const errors = watchForErrors(page);
  await page.setViewportSize({ width: 851, height: 393 });
  const fall = async (seed, again) => {
    if (!again) await startGame(page, { seed });
    else {
      // straight on from the end screen, in the same page, as a player would
      await page.click('#end-new');
      await page.fill('#c-seed', seed);
      await page.click('#c-begin');
      await page.click('#pro-begin');
      await expect(page.locator('#screen-game')).toBeVisible();
    }
    await clearBoons(page);
    await faceOpenGround(page, 2);
    await placeMonster(page, 'ogre', 1, { hp: 400, maxHp: 400, nextAct: 0 });
    await page.evaluate(() => { Game.player().hp = 1; });
    await expect.poll(() => page.evaluate(() => Game.state().status), { timeout: 15_000 }).toBe('dead');
    await expect(page.locator('#screen-end')).toBeVisible();
  };
  await fall('end-scroll-1');
  // on a short screen the title is a heading, not two fifths of the view
  expect(await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#end-title')).fontSize)), 'the title should leave room for the rest').toBeLessThan(36);
  await page.evaluate(() => { document.querySelector('#screen-end').scrollTop = 9999; });
  expect(await page.evaluate(() => document.querySelector('#screen-end').scrollTop), 'the end screen should be long enough to scroll sideways').toBeGreaterThan(0);
  await fall('end-scroll-2', true);
  expect(await page.evaluate(() => document.querySelector('#screen-end').scrollTop)).toBe(0);
  expect(errors).toEqual([]);
});

test('the end screen lists the lessons learnt at each level, with a count for one learnt twice', async ({ page }) => {
  const { clearBoons, faceOpenGround, placeMonster } = require('./helpers');
  const errors = watchForErrors(page);
  await startGame(page, { seed: 'end-lessons' });
  await clearBoons(page);
  await page.evaluate(() => { const p = Game.player(); p.boons = ['swift', 'str', 'str']; p.hp = 1; });
  await faceOpenGround(page, 2);
  await placeMonster(page, 'ogre', 1, { hp: 400, maxHp: 400, nextAct: 0 });
  await expect.poll(() => page.evaluate(() => Game.state().status), { timeout: 15_000 }).toBe('dead');
  const lessons = page.locator('#end-summary .end-h', { hasText: 'Lessons' });
  await expect(lessons).toBeVisible();
  await expect(page.locator('#end-summary')).toContainText('Practised Hands');
  await expect(page.locator('#end-summary')).toContainText('Hard-Won Strength ×2');
  expect(errors).toEqual([]);
});
