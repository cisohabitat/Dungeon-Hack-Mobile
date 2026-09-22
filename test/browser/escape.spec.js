'use strict';
// The endgame: taking the Heart starts a climb rather than winning outright.
const { test } = require('@playwright/test');
const { expect, watchForErrors, startGame, descendTo } = require('./helpers');

test.describe('the escape', () => {
  test('taking the Heart wakes the mountain instead of ending the run', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'escape-take', levels: '4' });
    await page.evaluate(() => { Game.player().maxHp = 600; Game.player().hp = 600; });

    const bottom = await descendTo(page, 4);
    expect(bottom).toBe(4);

    const taken = await page.evaluate(() => {
      const G = Game.state(), L = Game.level(), p = G.player;
      let spot = null;
      for (const k in L.items) if (L.items[k].some(i => i.t === 'artifact')) spot = k.split(',').map(Number);
      if (!spot) return { error: 'no artifact on the final level' };
      p.x = spot[0]; p.y = spot[1];
      const before = G.status;
      Game.takeItem(L.items[`${spot[0]},${spot[1]}`].find(i => i.t === 'artifact'));
      return {
        before, after: G.status, escaping: !!G.escaping,
        carrying: p.inv.some(i => i.t === 'artifact'),
        allAwake: Game.level().monsters.every(m => m.awake),
      };
    });

    expect(taken.error).toBeUndefined();
    expect(taken.before).toBe('playing');
    expect(taken.after, 'picking it up must not win the game').toBe('playing');
    expect(taken.escaping).toBe(true);
    expect(taken.carrying).toBe(true);
    expect(taken.allAwake, 'everything on the level should wake').toBe(true);
    expect(errors).toEqual([]);
  });

  test('the dark produces pursuers, and never on top of the trader', async ({ page }) => {
    await startGame(page, { seed: 'escape-hunt', levels: '4' });
    const hunted = await page.evaluate(async () => {
      const G = Game.state(), L = Game.level(), p = G.player;
      p.maxHp = 9999; p.hp = 9999;
      G.escaping = true; G.escapeStart = G.t; G.hunts = 0;
      const before = L.monsters.length;
      let onTrader = 0;
      for (let i = 0; i < 120; i++) {
        G.nextHunt = G.t;
        Game.update(i * 300, 300);
        for (const n of (L.npcs || [])) if (L.monsters.some(m => m.x === n.x && m.y === n.y)) onTrader++;
      }
      return { before, after: L.monsters.length, hunts: G.hunts, onTrader };
    });
    expect(hunted.hunts).toBeGreaterThan(0);
    expect(hunted.after).toBeGreaterThan(hunted.before);
    expect(hunted.onTrader, 'a hunter must not spawn on a person').toBe(0);
  });

  test('the Heart cannot be dropped, and the surface stairs win the game', async ({ page }) => {
    await startGame(page, { seed: 'escape-climb', levels: '4' });
    await page.evaluate(() => { Game.player().maxHp = 600; Game.player().hp = 600; });
    await descendTo(page, 4);

    const kept = await page.evaluate(() => {
      const L = Game.level(), p = Game.player();
      let spot = null;
      for (const k in L.items) if (L.items[k].some(i => i.t === 'artifact')) spot = k.split(',').map(Number);
      if (!spot) return { error: 'no artifact' };
      p.x = spot[0]; p.y = spot[1];
      Game.takeItem(L.items[`${spot[0]},${spot[1]}`].find(i => i.t === 'artifact'));
      Game.dropItem(p.inv.find(i => i.t === 'artifact'));
      return { stillHeld: p.inv.some(i => i.t === 'artifact') };
    });
    expect(kept.error).toBeUndefined();
    expect(kept.stillHeld, 'you could not bear to part with it').toBe(true);

    const climb = await page.evaluate(async () => {
      const G = Game.state(), p = G.player;
      const seen = [];
      for (let guard = 0; G.depth > 1 && guard < 12; guard++) {
        const L = Game.level();
        p.x = L.start.x; p.y = L.start.y; p.dir = (L.start.dir + 2) % 4;
        Game.input('forward');
        await new Promise(r => setTimeout(r, 300));
        seen.push(G.depth);
      }
      const atSurface = G.depth === 1 && G.status === 'playing';
      const L = Game.level();
      p.x = L.start.x; p.y = L.start.y; p.dir = (L.start.dir + 2) % 4;
      Game.input('forward');
      await new Promise(r => setTimeout(r, 250));
      return { seen, atSurface, status: G.status, escapeMs: G.escapeMs };
    });

    expect(climb.seen).toEqual([3, 2, 1]);
    expect(climb.atSurface, 'reaching level 1 must not win on its own').toBe(true);
    expect(climb.status).toBe('won');
    expect(climb.escapeMs).toBeGreaterThan(0);
    await expect(page.locator('#end-title')).toHaveText(/VICTORY/i);
    await expect(page.locator('#end-epilogue p').first()).toContainText(/Heart of the Mountain/i);
  });
});
