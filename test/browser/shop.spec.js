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
