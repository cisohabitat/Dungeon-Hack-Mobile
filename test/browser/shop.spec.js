'use strict';
// The trader: reaching one, trading with it, and the rules it will not bend.
const { test } = require('@playwright/test');
const { expect, watchForErrors, startGame } = require('./helpers');

/** Walk down until a level has a trader, then stand beside them. */
async function findTrader(page) {
  return page.evaluate(async () => {
    const G = Game.state(), p = G.player, T = Dungeon.T;
    for (let d = 1; d <= 7; d++) {
      const L = Game.level();
      // encounter props share the list: find the trader by kind
      const n = (L.npcs || []).find(q => q.kind !== 'encounter');
      if (n) {
        for (let k = 0; k < 4; k++) {
          const [dx, dy] = Dungeon.DIRS[k];
          const x = n.x - dx, y = n.y - dy;
          if (L.tiles[y * L.w + x] === T.FLOOR) {
            p.x = x; p.y = y; p.dir = k;
            return { depth: G.depth, stock: n.stock.length };
          }
        }
        return { depth: G.depth, stock: n.stock.length, noApproach: true };
      }
      if (!L.downStart) break;
      p.x = L.downStart.x; p.y = L.downStart.y; p.dir = (L.downStart.dir + 2) % 4;
      Game.input('forward');
      await new Promise(r => setTimeout(r, 280));
    }
    return null;
  });
}

test.describe('the trader', () => {
  test('a trader offers a job for the floor below, taken at a tap; on that floor the status line says how it goes', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'job-ui', levels: '8' });
    await page.evaluate(() => {
      const p = Game.player(), L = Game.level(), [dx, dy] = Dungeon.DIRS[p.dir];
      L.monsters.length = 0; L.npcs.length = 0;
      L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR;
      L.npcs.push({ id: 'merchant', x: p.x + dx, y: p.y + dy, markup: 2, stock: [], greeted: false });
      Game.input('forward');
    });
    await expect(page.locator('#ov-shop')).toHaveClass(/open/);
    const row = page.locator('#shop-services .shop-row', { hasText: 'A job for the floor below' });
    await expect(row).toBeVisible();
    await expect(row).toContainText('It pays');
    await page.waitForTimeout(700);   // a tap just after the shop opens is not taken as a choice
    await row.locator('button', { hasText: 'Take it' }).click();
    await expect.poll(() => page.evaluate(() => !!Game.bounty())).toBe(true);
    await expect(row.locator('button')).toHaveText('\u2014');
    await page.evaluate(() => document.querySelector('#ov-shop [data-close]').click());
    await page.evaluate(() => { Game.level().monsters.length = 0; Game.descend(); });
    await expect(page.locator('#hud-status .bounty')).toContainText('Job:');
    await page.click('[data-open="char"]');
    await expect(page.locator('#char-sheet')).toContainText('A job from the traders');
    expect(errors).toEqual([]);
  });

  test('walking into a trader opens a shop and does not walk through them', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'shop-open', levels: '8' });
    const found = await findTrader(page);
    test.skip(!found || found.noApproach, 'no reachable trader in the first seven levels');
    expect(found.stock).toBeGreaterThan(0);

    const opened = await page.evaluate(async () => {
      const p = Game.player();
      const at = { x: p.x, y: p.y };
      Game.input('forward');
      await new Promise(r => setTimeout(r, 150));
      return { shop: !!Game.currentShop(), movedThrough: p.x !== at.x || p.y !== at.y };
    });
    expect(opened.shop).toBe(true);
    expect(opened.movedThrough, 'the trader is solid').toBe(false);
    await expect(page.locator('#ov-shop')).toHaveClass(/open/);
    expect(errors).toEqual([]);
  });

  test('gear the hero\'s class can never use says so in the trader\'s list', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'shop-open', levels: '8', cls: 'Mage' });
    const found = await findTrader(page);
    test.skip(!found || found.noApproach, 'no reachable trader in the first seven levels');
    // a mage is offered studded leather, which no mage may wear, and a robe, which one may
    await page.evaluate(() => {
      const n = Game.level().npcs.find(q => q.kind !== 'encounter');
      n.stock.unshift({ t: 'studded', q: 1, e: 1, id: 1 });
      Game.player().stats.cha = 4;   // and a manner that puts prices up, said plainly
      Game.input('forward');
    });
    await expect(page.locator('#ov-shop')).toHaveClass(/open/);
    await expect(page.locator('#shop-gold')).toContainText(/your low Charisma: prices \d+% higher/);
    const row = page.locator('#shop-stock .shop-row, #shop-stock > *', { hasText: 'Studded Leather' }).first();
    const why = await page.evaluate(() => Game.canEquip({ t: 'studded', q: 1, e: 1 }));
    expect(why, 'a mage cannot wear it').toBeTruthy();
    await expect(row).toContainText(why);
    expect(errors).toEqual([]);
  });

  test('the shop names who keeps it: one of the Lampfolk, or at a goblin market a goblin pedlar, drawn as such', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'shop-open', levels: '8' });
    const found = await findTrader(page);
    test.skip(!found || found.noApproach, 'no reachable trader in the first seven levels');
    /** walk in, read the heading and which picture the trader is drawn with, and walk away */
    const visit = () => page.evaluate(async () => {
      Game.input('forward');
      await new Promise(r => setTimeout(r, 450));
      const L = Game.level(), n = L.npcs.find(q => q.kind !== 'encounter');
      const drawn = Game.renderState(performance.now()).sprites.find(s => s.x === n.x + 0.5 && s.y === n.y + 0.5);
      const which = Object.keys(Assets.sprites).find(k => Assets.sprites[k] === (drawn && drawn.img));
      const title = document.querySelector('#shop-title').textContent;
      document.querySelector('#ov-shop [data-close]').click();
      await new Promise(r => setTimeout(r, 150));
      return { title, which };
    });
    expect(await visit()).toEqual({ title: 'Lampfolk trader', which: 'merchant' });
    await page.evaluate(() => { Game.level().twist = 'market'; });
    expect(await visit()).toEqual({ title: 'Goblin pedlar', which: 'pedlar' });
    expect(errors).toEqual([]);
  });

  test('gear of another make on the shelf is measured against what you wear', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'shop-open', levels: '8', cls: 'Fighter' });
    const found = await findTrader(page);
    test.skip(!found || found.noApproach, 'no reachable trader in the first seven levels');
    await page.evaluate(() => {
      const n = Game.level().npcs.find(q => q.kind !== 'encounter');
      Game.state().known.dagger = 1; Game.state().known.leather = 1;
      n.stock = [{ t: 'dagger', q: 1, e: 0 }, { t: 'leather', q: 1, e: 0 }];
      Game.input('forward');
    });
    await expect(page.locator('#ov-shop')).toHaveClass(/open/);
    const worn = await page.evaluate(() => ({ w: Game.itemName({ ...Game.player().eq.weapon, q: 1 }), a: Game.player().eq.armor ? Game.itemName({ ...Game.player().eq.armor, q: 1 }) : null }));
    const rows = page.locator('#shop-stock .shop-row');
    await expect(rows.filter({ hasText: 'Dagger' })).toContainText(new RegExp(`vs ${worn.w}: [+-]?\\d+(\\.\\d)? damage per second`));
    if (worn.a) await expect(rows.filter({ hasText: 'Leather' })).toContainText(new RegExp(`vs ${worn.a}: [+-]?\\d+ armour class`));
    expect(errors).toEqual([]);
  });

  test('buying costs gold, fills the pack and names what was bought', async ({ page }) => {
    await startGame(page, { seed: 'shop-buy', levels: '8' });
    const found = await findTrader(page);
    test.skip(!found || found.noApproach, 'no reachable trader in the first seven levels');

    const trade = await page.evaluate(async () => {
      const p = Game.player();
      p.gold = 1000;
      Game.input('forward');
      await new Promise(r => setTimeout(r, 120));
      const s = Game.currentShop();
      if (!s) return { error: 'the shop did not open' };
      const count = () => p.inv.reduce((a, i) => a + (i.q || 1), 0);
      const it = s.stock[0];
      const price = Game.buyPrice(s, it);
      const before = count();
      const ok = Game.buy(it);
      return { ok, price, gold: p.gold, gained: count() - before, known: Game.isKnown(it.t) };
    });
    expect(trade.error).toBeUndefined();
    expect(trade.ok).toBe(true);
    expect(trade.gold).toBe(1000 - trade.price);
    expect(trade.gained).toBe(1);
    expect(trade.known, 'the trader tells you what it is').toBe(true);
  });

  test('a dear purchase or sale asks twice, a cheap one does not, and the whole row answers a tap', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'shop-buy', levels: '8' });
    const found = await findTrader(page);
    test.skip(!found || found.noApproach, 'no reachable trader in the first seven levels');
    await page.evaluate(async () => {
      const p = Game.player(), L = Game.level(), [dx, dy] = Dungeon.DIRS[p.dir];
      p.gold = 100000;
      // one dear thing and one cheap one, set out before the shop opens
      const n = (L.npcs || []).find(q => q.x === p.x + dx && q.y === p.y + dy);
      n.stock = [{ t: 'plate', q: 1, e: 2 }, { t: 'ration', q: 3, e: 0 }];
      Game.input('forward');
      await new Promise(r => setTimeout(r, 120));
    });
    await expect(page.locator('#ov-shop')).toHaveClass(/open/);
    const gold = () => page.evaluate(() => Game.player().gold);
    // a second tap on the step that opened the shop lands on nothing: the rows arm a moment later
    const early = await page.evaluate(async () => {
      document.querySelector('#ov-shop [data-close]').click();
      const p = Game.player(), g = p.gold;
      Game.input('forward');
      for (let i = 0; i < 3; i++) await new Promise(r => requestAnimationFrame(r));
      const row = [...document.querySelectorAll('#shop-stock .shop-row')].find(r => /ration/i.test(r.textContent));
      if (row) row.querySelector('.what').click();
      return { open: document.querySelector('#ov-shop').classList.contains('open'), spent: g - p.gold, row: !!row };
    });
    expect(early.open && early.row, 'the shop opened again for the early tap').toBe(true);
    expect(early.spent, 'a tap the moment the shop opened bought nothing').toBe(0);
    // taps a person makes, a beat apart
    const settle = () => page.waitForTimeout(450);
    const rows = page.locator('#shop-stock .shop-row');
    const g0 = await gold();
    await settle();
    await rows.nth(0).locator('button').click();
    expect(await gold(), 'the first tap on a dear thing only arms it').toBe(g0);
    await expect(rows.nth(0).locator('button')).toContainText('Tap again');
    await settle();
    await rows.nth(0).locator('button').click();
    expect(await gold(), 'the second tap pays').toBeLessThan(g0);
    // a cheap thing: one tap on the row's text buys it
    const g1 = await gold();
    await settle();
    await page.locator('#shop-stock .shop-row', { hasText: /ration/i }).locator('.what').click();
    expect(await gold()).toBeLessThan(g1);
    // selling the plate back asks too, as the trader wants far more to sell it again
    const g2 = await gold();
    const sell = page.locator('#shop-sell .shop-row', { hasText: /plate/i }).locator('button');
    await settle();
    await sell.click();
    expect(await gold(), 'the first tap on a dear sale only arms it').toBe(g2);
    await expect(sell).toContainText('Tap again to sell');
    await settle();
    await sell.click();
    expect(await gold()).toBeGreaterThan(g2);
    // a cheap sale takes one tap
    const g3 = await gold();
    await settle();
    await page.locator('#shop-sell .shop-row', { hasText: /ration/i }).locator('button').click();
    expect(await gold()).toBeGreaterThan(g3);
    expect(errors).toEqual([]);
  });

  test('the trader refuses the Heart and will not sell on credit', async ({ page }) => {
    await startGame(page, { seed: 'shop-guard', levels: '8' });
    const found = await findTrader(page);
    test.skip(!found || found.noApproach, 'no reachable trader in the first seven levels');

    const guards = await page.evaluate(async () => {
      const p = Game.player();
      Game.input('forward');
      await new Promise(r => setTimeout(r, 120));
      const s = Game.currentShop();
      if (!s) return { error: 'the shop did not open' };
      p.gold = 0;
      const broke = Game.buy(s.stock[0]);
      p.inv.push({ t: 'artifact', q: 1, e: 0 });
      const sold = Game.sell(p.inv.find(i => i.t === 'artifact'));
      return { broke, sold, stillHasHeart: p.inv.some(i => i.t === 'artifact') };
    });
    expect(guards.error).toBeUndefined();
    expect(guards.broke, 'a penniless player cannot buy').toBe(false);
    expect(guards.sold, 'the Heart is not for sale').toBe(false);
    expect(guards.stillHasHeart).toBe(true);
  });

  test('a trader and their stock survive a save', async ({ page }) => {
    await startGame(page, { seed: 'shop-save', levels: '8' });
    const found = await findTrader(page);
    test.skip(!found, 'no trader in the first seven levels');
    const same = await page.evaluate(() => {
      const before = JSON.stringify(Game.level().npcs);
      Game.save(); Game.load();
      return before === JSON.stringify(Game.level().npcs);
    });
    expect(same).toBe(true);
  });
});
