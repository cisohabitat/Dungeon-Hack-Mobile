'use strict';
// The endgame: the Heart is held fast while the lich stands; bring it down,
// lift the Heart, and the run is won on the spot. There is no climb back out.
const { test } = require('@playwright/test');
const { expect, watchForErrors, startGame, descendTo } = require('./helpers');

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
