'use strict';
// Dungeon features: secrets, fountains, ranged attacks, champions, identification.
const { test } = require('@playwright/test');
const { expect, watchForErrors, startGame, clearBoons, faceOpenGround, placeMonster } = require('./helpers');

test.describe('dungeon features', () => {
  test('a secret door can be found by walking into the wall that hides it', async ({ page }) => {
    await startGame(page, { seed: 'feat-secret' });
    const revealed = await page.evaluate(async () => {
      const p = Game.player(), L = Game.level(), T = Dungeon.T;
      const [dx, dy] = Dungeon.DIRS[p.dir];
      const x = p.x + dx, y = p.y + dy;
      const was = L.tiles[y * L.w + x];
      L.tiles[y * L.w + x] = T.SECRET;
      Game.input('forward');
      await new Promise(r => setTimeout(r, 250));
      const now = L.tiles[y * L.w + x];
      L.tiles[y * L.w + x] = was;
      return now === T.DOOR_OPEN;
    });
    expect(revealed).toBe(true);
  });

  test('a fountain heals once and then runs dry', async ({ page }) => {
    await startGame(page, { seed: 'feat-fountain' });
    const result = await page.evaluate(async () => {
      const p = Game.player(), L = Game.level(), T = Dungeon.T;
      const [dx, dy] = Dungeon.DIRS[p.dir];
      const x = p.x + dx, y = p.y + dy;
      L.tiles[y * L.w + x] = T.FOUNTAIN;
      L.features[`${x},${y}`] = { type: 'fountain', used: false };
      p.hp = 1;
      Game.input('use');
      const healed = p.hp === p.maxHp;
      p.hp = 1;
      Game.input('use');
      return { healed, dryAgain: p.hp === 1, message: Game.state().log.slice(-1)[0].m };
    });
    expect(result.healed, 'the first drink should heal to full').toBe(true);
    expect(result.dryAgain, 'the second drink should do nothing').toBe(true);
    expect(result.message).toMatch(/dry/i);
  });

  test('a missile weapon reaches down a corridor and a champion is tougher', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'feat-ranged', cls: 4 });  // the thief starts with knives
    await faceOpenGround(page, 4);

    const placed = await placeMonster(page, 'goblin', 3, { hp: 60, maxHp: 60 });
    test.skip(!placed, 'no straight corridor on this seed');

    const shot = await page.evaluate(async (uid) => {
      const p = Game.player(), L = Game.level();
      const knives = p.inv.find(i => i.t === 'throwknife');
      if (knives) Game.equip(knives);
      const w = Game.weapon();
      const m = L.monsters.find(x => x.uid === uid);
      const before = m.hp;
      for (let i = 0; i < 10; i++) { p.nextAttack = 0; Game.input('attack'); await new Promise(r => setTimeout(r, 40)); }
      return { range: w.range, damage: before - m.hp, distance: Math.abs(m.x - p.x) + Math.abs(m.y - p.y) };
    }, placed.uid);

    expect(shot.range, 'throwing knives should have reach').toBeGreaterThan(1);
    expect(shot.damage, 'the missile should land at range').toBeGreaterThan(0);
    expect(shot.distance, 'the target should not have closed').toBe(3);

    const elite = await page.evaluate((uid) => {
      const m = Game.level().monsters.find(x => x.uid === uid);
      const plain = Game.mstat(m);
      m.elite = 'Ancient';
      const champ = Game.mstat(m);
      return { plainName: plain.name, champName: champ.name, harder: champ.hit > plain.hit && champ.xp > plain.xp };
    }, placed.uid);
    expect(elite.champName).toBe(`Ancient ${elite.plainName}`);
    expect(elite.harder).toBe(true);
    expect(errors).toEqual([]);
  });

  test('unfamiliar potions read as an appearance until one is drunk', async ({ page }) => {
    await startGame(page, { seed: 'feat-ident' });
    const before = await page.evaluate(() => {
      const G = Game.state();
      const unknown = Object.keys(ITEMS).filter(
        id => (ITEMS[id].kind === 'potion' || ITEMS[id].kind === 'scroll') && !G.known[id]);
      return {
        anyUnknown: unknown.length > 0,
        allVague: unknown.every(id => !Game.itemName({ t: id, q: 1 }).includes(ITEMS[id].name)),
        first: unknown[0],
      };
    });
    expect(before.anyUnknown).toBe(true);
    expect(before.allVague, 'every unknown item must hide its true name').toBe(true);

    const after = await page.evaluate((id) => {
      const p = Game.player();
      p.inv.push({ t: id, q: 1, e: 0 });
      Game.useItem(p.inv[p.inv.length - 1]);
      return { id, known: Game.isKnown(id), name: Game.itemName({ t: id, q: 1 }),
               log: Game.state().log.slice(-2).map(l => l.m) };
    }, before.first);
    expect(after.known, `drinking ${after.id} did not identify it: ${JSON.stringify(after)}`).toBe(true);
    expect(after.name).toContain(await page.evaluate(id => ITEMS[id].name, before.first));
  });

  test('a strong character can force a locked door without the key', async ({ page }) => {
    await startGame(page, { seed: 'feat-bash' });
    const bashed = await page.evaluate(async () => {
      const p = Game.player(), L = Game.level(), T = Dungeon.T;
      p.stats.str = 18;
      p.inv = p.inv.filter(i => i.t !== 'key');
      // stand on a floor tile that borders a wall, and lock that wall
      let spot = null;
      for (let i = 0; i < L.w * L.h && !spot; i++) {
        if (L.tiles[i] !== T.FLOOR) continue;
        const x = i % L.w, y = (i / L.w) | 0;
        const k = Dungeon.DIRS.findIndex(([dx, dy]) => L.tiles[(y + dy) * L.w + (x + dx)] === T.WALL);
        if (k >= 0) spot = { x, y, k };
      }
      if (!spot) return 'no wall-adjacent floor tile';
      const [dx, dy] = Dungeon.DIRS[spot.k];
      const wx = spot.x + dx, wy = spot.y + dy;
      p.x = spot.x; p.y = spot.y; p.dir = spot.k;
      L.tiles[wy * L.w + wx] = T.DOOR_LOCKED;
      L.locks[`${wx},${wy}`] = 'gold';
      for (let i = 0; i < 80; i++) {
        p.nextAttack = 0;
        Game.input('use');
        if (L.tiles[wy * L.w + wx] === T.DOOR_OPEN) return true;
      }
      return 'eighty attempts failed';
    });
    expect(bashed).toBe(true);
  });
  test('a fighter can take a second blade, and the shield hand knows it', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'dual-ui', cls: 'fighter' });
    await clearBoons(page);

    const start = await page.evaluate(() => {
      const p = Game.player();
      p.inv.push({ t: 'shortsword', q: 1, e: 0 });
      return { ac: Game.playerAC(), shield: !!p.eq.shield, swing: Game.weapon().speed };
    });

    await page.click('[data-open="inv"]');
    await expect(page.locator('#ov-inv')).toHaveClass(/open/);
    // the off hand has its own slot, empty for now
    await expect(page.locator('#equip .slot').filter({ hasText: /off hand/i })).toHaveCount(1);

    // pick the short sword out of the pack and send it to the off hand
    await page.locator('#inv-grid .slot.filled').filter({ has: page.locator('img') }).last().click();
    const offBtn = page.locator('#item-detail button', { hasText: 'Off hand' });
    await expect(offBtn).toBeVisible();
    await offBtn.click();

    const after = await page.evaluate(() => {
      const p = Game.player();
      return { off: p.eq.offhand && p.eq.offhand.t, shield: !!p.eq.shield,
        stowed: p.inv.some(i => i.t === 'shield'), ac: Game.playerAC(), swing: Game.weapon().speed };
    });
    expect(after.off, 'the blade should be in the off hand').toBe('shortsword');
    expect(after.shield, 'the shield cannot share the hand').toBe(false);
    if (start.shield) expect(after.stowed, 'the shield should go back in the pack').toBe(true);
    expect(after.ac, 'losing the shield should cost armour').toBeLessThan(start.ac);
    expect(after.swing, 'two blades should swing slower than one').toBeGreaterThan(start.swing);
    expect(errors).toEqual([]);
  });

  test('a cleric is offered no second blade', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'dual-cleric', cls: 'cleric' });
    await clearBoons(page);
    await page.evaluate(() => Game.player().inv.push({ t: 'club', q: 1, e: 0 }));
    await page.click('[data-open="inv"]');
    await expect(page.locator('#equip .slot').filter({ hasText: /off hand/i })).toHaveCount(0);
    await page.locator('#inv-grid .slot.filled').filter({ has: page.locator('img') }).last().click();
    await expect(page.locator('#item-detail button', { hasText: 'Off hand' })).toHaveCount(0);
    expect(errors).toEqual([]);
  });
  test('the Use button says Descend when you face the stairs, and taking them works', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'use-descend' });
    await clearBoons(page);
    const btn = page.locator('[data-tap="use"]');
    // stand on the approach square facing along the wall, then turn to the stair
    const plan = await page.evaluate(() => {
      const L = Game.level(), p = Game.player();
      L.monsters.length = 0;
      for (const k in L.items) delete L.items[k];
      const ds = L.downStart, toward = (ds.dir + 2) % 4;
      p.x = ds.x; p.y = ds.y; p.dir = (toward + 1) % 4;
      return { toward };
    });
    await page.waitForTimeout(150);
    await expect(btn).not.toHaveText(/Descend/);
    await page.evaluate(t => { Game.player().dir = t; }, plan.toward);
    await expect(btn).toHaveText(/Descend/);
    await expect(btn).toHaveClass(/ctx/);
    await expect(btn).toHaveAttribute('aria-label', 'Descend');
    await btn.click();
    await expect.poll(() => page.evaluate(() => Game.state().depth)).toBe(2);
    expect(errors).toEqual([]);
  });

  test('a scroll of mapping shows the whole level the moment the map opens', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'map-scroll', cls: 'Thief' });   // the thief starts with one
    await clearBoons(page);
    await page.click('[data-open="inv"]');
    const idx = await page.evaluate(() => Game.player().inv.findIndex(i => /map/i.test(i.t)));
    expect(idx, 'the thief should start with a scroll of mapping').toBeGreaterThanOrEqual(0);
    await page.locator('#inv-grid .slot').nth(idx).click();
    await page.locator('#item-detail button', { hasText: 'Read' }).click();
    await page.keyboard.press('Escape');
    await page.click('[data-open="map"]');
    // no waiting: the playtest reported a sparse first look
    const first = await page.evaluate(() => {
      const c = document.getElementById('map-canvas'), L = Game.level();
      const r = c.getBoundingClientRect();
      return { all: L.explored.every(Boolean), tile: Number(c.dataset.tile), cols: c.width / Number(c.dataset.tile),
        fits: r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 && r.left >= -1 };
    });
    expect(first.all, 'every square should be known').toBe(true);
    expect(first.cols, 'the map should span the level, not the ten squares walked').toBeGreaterThan(20);
    expect(first.fits, 'the whole map should be on screen').toBe(true);
    expect(errors).toEqual([]);
  });
  test('an encounter asks, shows the odds, cannot be dodged, and reports what it did', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'tour' });
    await clearBoons(page);
    const placed = await page.evaluate(() => {
      const L = Game.level(), p = Game.player(), T = Dungeon.T;
      const e = L.npcs.find(n => n.kind === 'encounter');
      if (!e) return null;
      L.monsters.length = 0;
      for (let k = 0; k < 4; k++) {
        const [dx, dy] = Dungeon.DIRS[k];
        if (L.tiles[(e.y - dy) * L.w + (e.x - dx)] === T.FLOOR) { p.x = e.x - dx; p.y = e.y - dy; p.dir = k; return e.id; }
      }
      return null;
    });
    expect(placed, 'floor one of this seed should hold an encounter').not.toBeNull();
    await expect(page.locator('[data-tap="use"]')).toHaveText(/Examine/);
    await page.locator('[data-tap="use"]').click();
    await expect(page.locator('#ov-encounter')).toHaveClass(/open/);
    // every checked choice states its stat, the roll it needs and the odds
    const smalls = await page.locator('.enc-choice small').allInnerTexts();
    expect(smalls.some(t => /d20[+-]\d+ vs \d+, \d+% chance/.test(t)), `no odds shown: ${smalls.join(' | ')}`).toBe(true);
    // Escape does not dodge it
    await page.keyboard.press('Escape');
    await expect(page.locator('#ov-encounter')).toHaveClass(/open/);
    // answer it with the first checked choice
    await page.locator('.enc-choice').first().click();
    await expect(page.locator('#enc-text')).toContainText(/It goes (well|badly)\./);
    await expect(page.locator('#enc-text .roll')).toContainText(/d20/);
    await page.locator('#enc-choices .primary', { hasText: 'Continue' }).click();
    await expect(page.locator('#ov-encounter')).not.toHaveClass(/open/);
    const left = await page.evaluate(id => Game.level().npcs.filter(n => n.id === id).length, placed);
    expect(left, 'the prop should be gone once answered').toBe(0);
    expect(errors).toEqual([]);
  });

  test('an unknown potion can be studied from the pack, with the odds on the button', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'study-ui', cls: 'Mage' });
    await clearBoons(page);
    const t = await page.evaluate(() => {
      const id = Object.keys(ITEMS).find(k => ITEMS[k].kind === 'potion' && !Game.isKnown(k));
      Game.player().inv.push({ t: id, q: 1, e: 0 });
      return id;
    });
    await page.click('[data-open="inv"]');
    const idx = await page.evaluate(t => Game.player().inv.findIndex(i => i.t === t), t);
    await page.locator('#inv-grid .slot').nth(idx).click();
    const btn = page.locator('#item-detail button', { hasText: /^Study \(\d+%\)$/ });
    await expect(btn).toBeVisible();
    await btn.click();
    const after = await page.evaluate(t => ({ known: Game.isKnown(t), blocked: !!Game.studyReason({ t, q: 1, e: 0 }) }), t);
    // either it worked, or it failed and cannot be retried at this level
    expect(after.known || after.blocked, 'a study should identify it or bar a retry').toBe(true);
    expect(errors).toEqual([]);
  });
});
