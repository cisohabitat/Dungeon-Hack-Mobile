'use strict';
// A whole run, start to finish: four floors down, the lich, and the Heart.
// Everything happens through the game's own inputs, so the stairs, keys,
// traders and the boss are all exercised as a player would meet them.
const { test } = require('@playwright/test');
const { expect, watchForErrors, startGame, clearBoons } = require('./helpers');

// A full campaign is a long real-time run with live dice; give it room. It
// takes about three minutes alone, but beside the other workers on a busy
// machine it has run close to six. The limit is only there to catch a hang.
test.describe.configure({ timeout: 600_000 });

/**
 * A bot that lives in the page: it explores, fights what is next to it, collects
 * what it walks over, and heads for a goal. Installed once, then driven a step
 * at a time so the test can assert between moves.
 */
const BOT = () => {
  const T = Dungeon.T;
  const solid = (L, i, keysKnown) => {
    const t = L.tiles[i];
    if (t === T.FLOOR || t === T.DOOR_OPEN || t === T.DOOR) return false;
    if (t === T.DOOR_LOCKED) return !keysKnown;
    return true;
  };
  /** Distances from a square, over ground the player could actually cross. */
  const field = (L, sx, sy, keysKnown) => {
    const dist = new Int32Array(L.w * L.h).fill(-1);
    const npcs = new Set((L.npcs || []).map(n => n.y * L.w + n.x));
    const q = [sy * L.w + sx];
    dist[q[0]] = 0;
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi], x = i % L.w, y = (i / L.w) | 0;
      for (const [dx, dy] of Dungeon.DIRS) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= L.w || ny >= L.h) continue;
        const ni = ny * L.w + nx;
        if (dist[ni] >= 0 || npcs.has(ni) || solid(L, ni, keysKnown)) continue;
        dist[ni] = dist[i] + 1;
        q.push(ni);
      }
    }
    return dist;
  };
  window.__bot = {
    field,
    /** One step toward a target square. Returns false when there is no route. */
    stepToward(tx, ty, keysKnown) {
      const L = Game.level(), p = Game.player();
      const dist = field(L, tx, ty, keysKnown);
      let best = null, bd = dist[p.y * L.w + p.x];
      if (bd < 0) return false;
      for (let k = 0; k < 4; k++) {
        const [dx, dy] = Dungeon.DIRS[k];
        const nx = p.x + dx, ny = p.y + dy;
        if (nx < 0 || ny < 0 || nx >= L.w || ny >= L.h) continue;
        if (nx === tx && ny === ty) { best = k; bd = -1; break; }
        const dd = dist[ny * L.w + nx];
        if (dd >= 0 && dd < bd) { bd = dd; best = k; }
      }
      if (best === null) return false;
      p.dir = best;
      Game.input('forward');
      return true;
    },
    /** The nearest square worth walking to: loot first, then anything unseen. */
    nextErrand(keysKnown) {
      const L = Game.level(), p = Game.player();
      const dist = field(L, p.x, p.y, keysKnown);
      let best = null, bestD = Infinity;
      const consider = (x, y, bias) => {
        const d = dist[y * L.w + x];
        if (d > 0 && d + bias < bestD) { bestD = d + bias; best = { x, y }; }
      };
      for (const k in L.items) {
        if (!L.items[k].length) continue;
        const [x, y] = k.split(',').map(Number);
        consider(x, y, 0);
      }
      for (let i = 0; i < L.tiles.length; i++) {
        if (L.explored[i] || solid(L, i, keysKnown)) continue;
        consider(i % L.w, (i / L.w) | 0, 20);
      }
      return best;
    },
    adjacentMonster() {
      const L = Game.level(), p = Game.player();
      for (let k = 0; k < 4; k++) {
        const [dx, dy] = Dungeon.DIRS[k];
        const m = L.monsters.find(mm => mm.x === p.x + dx && mm.y === p.y + dy);
        if (m) return { dir: k, uid: m.uid };
      }
      return null;
    },
  };
};

/**
 * Play until `done()` is true or the budget runs out. Fights, heals, shops and
 * takes level-up choices the way a player would.
 */
async function play(page, opts) {
  const { goal, budget = 1200, log = [] } = opts;
  for (let tick = 0; tick < budget; tick++) {
    const state = await page.evaluate(async ({ goal }) => {
      const G = Game.state();
      if (!G || G.status !== 'playing') return { status: G ? G.status : 'gone' };
      const p = Game.player(), L = Game.level();

      // a level-up choice blocks everything until it is made
      if (Game.pendingBoons()) { const id = Game.pendingBoons()[0]; Game.chooseBoon(id, id === 'spread' ? ['con', 'con'] : undefined); return { acted: 'boon' }; }

      // an encounter walked into by accident: this run is checking the route,
      // not the encounters, so it takes the way out and moves on
      if (Game.currentEncounter()) {
        if (!Game.currentEncounter().result) {
          const opts = Game.encounterOptions();
          Game.chooseEncounter(opts[opts.length - 1].i);
        }
        Game.closeEncounter();
        return { acted: 'encounter' };
      }

      // the trader: sell nothing, buy what keeps us alive
      if (Game.currentShop()) {
        const s = Game.currentShop();
        let bought = 0;
        for (const it of s.stock.slice()) {
          if (!['potion_heal', 'potion_xheal', 'ration'].includes(it.t)) continue;
          while (it.q > 0 && p.gold >= Game.buyPrice(s, it) && p.inv.length < 18 && Game.buy(it)) bought++;
        }
        Game.closeShop();
        return { acted: 'shop', bought };
      }

      // stay alive
      const heal = p.inv.find(i => i.t === 'potion_heal' || i.t === 'potion_xheal');
      if (p.hp < p.maxHp * 0.4 && heal && !Game.wasteReason(heal)) { Game.useItem(heal); return { acted: 'drink' }; }
      const food = p.inv.find(i => ITEMS[i.t] && ITEMS[i.t].kind === 'food');
      if (p.food < 25 && food && !Game.wasteReason(food)) { Game.useItem(food); return { acted: 'eat' }; }

      const near = window.__bot.adjacentMonster();
      if (near) {
        p.dir = near.dir;
        Game.input('attack');
        await new Promise(r => setTimeout(r, 90));
        return { acted: 'fight' };
      }
      if (p.hp < p.maxHp * 0.6 && Game.rest()) return { acted: 'rest' };

      // where are we headed?
      const keysHeld = p.inv.some(i => i.t === 'key');
      let target = null;
      if (goal === 'down') target = L.stairsDown;
      else if (goal === 'up') target = L.stairsUp;
      // the Heart will not come loose while the lich stands: go for the lich first
      else if (goal === 'artifact' && L.monsters.some(m => m.id === 'lich')) {
        const lich = L.monsters.find(m => m.id === 'lich');
        target = { x: lich.x, y: lich.y };
      }
      else if (goal === 'artifact' || goal === 'page') {
        const want = goal === 'artifact' ? 'artifact' : 'page';
        for (const k in L.items) if (L.items[k].some(i => i.t === want)) {
          const [x, y] = k.split(',').map(Number);
          target = { x, y };
        }
      }
      if (target && window.__bot.stepToward(target.x, target.y, keysHeld)) {
        await new Promise(r => setTimeout(r, 200));
        return { acted: 'travel', depth: G.depth };
      }
      // blocked: go find keys, loot, or unseen ground
      const errand = window.__bot.nextErrand(keysHeld);
      if (errand && window.__bot.stepToward(errand.x, errand.y, keysHeld)) {
        await new Promise(r => setTimeout(r, 200));
        return { acted: 'explore', depth: G.depth };
      }
      // truly stuck: try the other key assumption before giving up
      if (target && window.__bot.stepToward(target.x, target.y, true)) {
        await new Promise(r => setTimeout(r, 200));
        return { acted: 'force', depth: G.depth };
      }
      return { acted: 'stuck', depth: G.depth };
    }, { goal });

    if (state.status && state.status !== 'playing') return state;
    if (state.acted) log.push(state.acted);
    const finished = await page.evaluate(opts.doneFn);
    if (finished) return { done: true };
  }
  return { timeout: true };
}

test('a four floor campaign: down to the lich, and the Heart', async ({ page }) => {
  const errors = watchForErrors(page);
  await startGame(page, { seed: 'campaign-4', levels: '4', name: 'Vessa', bg: 'The Ashborn' });
  await clearBoons(page);
  await page.evaluate(BOT);

  // A validation run, not a test of the dice: the character is given the
  // stamina to reach the end so that every mechanic on the way is exercised.
  await page.evaluate(() => {
    const p = Game.player();
    p.maxHp = 400; p.hp = 400;
    p.gold = 400;
  });

  const seen = { traders: 0, keysUsed: 0, pages: 0, boss: false };
  const journey = [];

  // ---- the descent ----
  for (let floor = 1; floor <= 3; floor++) {
    const before = await page.evaluate(() => ({
      depth: Game.state().depth,
      hasTrader: (Game.level().npcs || []).some(n => n.kind !== 'encounter'),
      locked: Object.keys(Game.level().locks).length,
      pages: Game.journal().length,
    }));
    seen.traders += before.hasTrader ? 1 : 0;

    // the page first: it is the story of the floor, and a player who explores
    // will walk over it long before they find the stairs
    const pg = await play(page, {
      goal: 'page',
      doneFn: `Game.journal().length > ${before.pages}`,
      budget: 900,
    });
    expect(pg.status, `died hunting the page on floor ${floor}`).toBeUndefined();
    expect(pg.timeout, `never reached the page on floor ${floor}`).toBeFalsy();
    await page.evaluate(() => { const p = Game.player(); p.hp = p.maxHp; });

    const r = await play(page, {
      goal: 'down',
      doneFn: `(${floor + 1}) === Game.state().depth`,
      budget: 900,
    });
    expect(r.timeout, `stuck on floor ${floor}`).toBeFalsy();
    expect(r.status, `died on floor ${floor}`).toBeUndefined();

    const after = await page.evaluate(() => ({ depth: Game.state().depth, pages: Game.journal().length }));
    expect(after.depth, `should have reached floor ${floor + 1}`).toBe(floor + 1);
    journey.push(`floor ${floor} -> ${after.depth}, pages ${after.pages}`);
    seen.pages = after.pages;
    seen.keysUsed += before.locked > 0 ? 1 : 0;
    await page.evaluate(() => { const p = Game.player(); p.hp = p.maxHp; });
  }

  // ---- the bottom: the boss and the Heart ----
  const bottom = await page.evaluate(() => ({
    depth: Game.state().depth,
    isFinal: Game.level().isFinal,
    boss: Game.level().monsters.some(m => MONSTERS[m.id].boss),
  }));
  expect(bottom.depth).toBe(4);
  expect(bottom.isFinal, 'floor four should be the last').toBe(true);
  expect(bottom.boss, 'the Dread Lich should be waiting').toBe(true);
  seen.boss = true;

  // the last page belongs to the deepest floor, and it has to be in hand before
  // the Heart is lifted: the run ends the moment it is
  const lastPage = await play(page, {
    goal: 'page',
    doneFn: 'Game.journal().length >= 4',
    budget: 900,
  });
  expect(lastPage.status, 'died hunting the last page').toBeUndefined();
  expect(lastPage.timeout, 'never reached the page on floor four').toBeFalsy();
  await page.evaluate(() => { const p = Game.player(); p.hp = p.maxHp; });

  // ---- the lich, then the Heart ----
  const grab = await play(page, {
    goal: 'artifact',
    doneFn: "Game.state().status === 'won'",
    budget: 1500,
  });
  expect(grab.timeout, 'never brought down the lich and took the Heart').toBeFalsy();

  const ending = await page.evaluate(() => ({
    status: Game.state().status,
    depth: Game.state().depth,
    lich: Game.level().monsters.some(m => m.id === 'lich'),
    pages: Game.journal().length,
    level: Game.player().level,
    gold: Game.player().gold,
  }));
  expect(ending.status, 'lifting the Heart should win the game').toBe('won');
  expect(ending.lich, 'the lich should be down').toBe(false);
  expect(ending.depth, 'won on the deepest floor, with no climb back').toBe(4);
  journey.push('brought down the lich and took the Heart on floor 4');
  // one page per floor, four floors: this run read the delve's whole story
  expect(ending.pages, 'every page on the way down should have been found').toBe(4);
  expect(await page.evaluate(() => Game.pagesInDungeon()),
    'a four level delve holds four pages, not the archive\'s full eight').toBe(4);

  await expect(page.locator('#screen-end')).toBeVisible();
  await expect(page.locator('#end-title')).toHaveText(/VICTORY/i);
  await expect(page.locator('#end-epilogue')).toContainText('Vessa');
  await expect(page.locator('#end-epilogue')).toContainText(/Heart of the Mountain/i);
  // having found all four, the epilogue must not claim pages were left behind
  await expect(page.locator('#end-epilogue')).toContainText(/every page the earlier crews left behind/i);
  const hall = await page.evaluate(() => Game.hall()[0]);
  expect(hall.won, 'the victory should reach the Hall of Heroes').toBe(true);

  console.log('CAMPAIGN:', JSON.stringify({ journey, seen, ending }, null, 1));
  expect(errors).toEqual([]);
});
