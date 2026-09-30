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

    const placed = await placeMonster(page, 'goblin', 3, { hp: 400, maxHp: 400 });   // ten sure throws, crits and all, must not kill it: the champion check needs it after
    test.skip(!placed, 'no straight corridor on this seed');

    const shot = await page.evaluate(async (uid) => {
      const p = Game.player(), L = Game.level();
      const knives = p.inv.find(i => i.t === 'throwknife');
      if (knives) Game.equip(knives);
      p.perkHit = 60;   // every throw lands: the test is about reach, not the dice
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
    // a scroll closes the pack by itself, so its page is seen to burn
    await expect(page.locator('#ov-inv')).not.toHaveClass(/open/);
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
  test('with the rolls hidden, an encounter shows its odds without the dice behind them', async ({ page }) => {
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
    await page.locator('[data-tap="use"]').click();
    await expect(page.locator('#ov-encounter')).toHaveClass(/open/);
    // on a tall phone the picture takes some of the room above the choices
    const art = await page.locator('.enc-art img').boundingBox();
    expect(art.width, 'the encounter picture on a tall phone').toBeGreaterThanOrEqual(140);
    const smalls = await page.locator('.enc-choice small').allInnerTexts();
    expect(smalls.some(t => /^[A-Z][a-z]+: \d+% chance/.test(t)), `no plain odds: ${smalls.join(' | ')}`).toBe(true);
    expect(smalls.some(t => /d20/.test(t)), `dice shown with the rolls hidden: ${smalls.join(' | ')}`).toBe(false);
    expect(errors).toEqual([]);
  });

  test('a tap already on its way when an encounter opens does not answer it', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.addInitScript(() => localStorage.setItem('deepdelve.tipsOff', '1'));
    await startGame(page, { seed: 'tour' });
    await clearBoons(page);
    const r = await page.evaluate(async () => {
      const L = Game.level(), p = Game.player(), T = Dungeon.T;
      const e = L.npcs.find(n => n.kind === 'encounter');
      if (!e) return null;
      L.monsters.length = 0;
      for (let k = 0; k < 4; k++) {
        const [dx, dy] = Dungeon.DIRS[k];
        if (L.tiles[(e.y - dy) * L.w + (e.x - dx)] === T.FLOOR) { p.x = e.x - dx; p.y = e.y - dy; p.dir = k; break; }
      }
      Game.input('use');
      for (let i = 0; i < 3; i++) await new Promise(res => requestAnimationFrame(res));
      const btn = document.querySelector('#enc-choices .enc-choice:not([disabled])');
      if (btn) btn.click();
      const cur = Game.currentEncounter();
      return { open: document.querySelector('#ov-encounter').classList.contains('open'), clicked: !!btn, answered: !!(cur && cur.result) };
    });
    expect(r, 'floor one of this seed should hold an encounter').not.toBeNull();
    expect(r.open && r.clicked).toBe(true);
    expect(r.answered, 'the early tap answered the encounter').toBe(false);
    // a moment later the choices are live; a double tap answers, and its second tap does not also dismiss the outcome
    await expect(page.locator('#enc-choices .arming')).toHaveCount(0);
    const after = await page.evaluate(() => {
      document.querySelector('#enc-choices .enc-choice:not([disabled])').click();
      const done = [...document.querySelectorAll('#enc-choices .primary')].find(b => /Continue/.test(b.textContent));
      if (done) done.click();
      return { answered: !!(Game.currentEncounter() && Game.currentEncounter().result), open: document.querySelector('#ov-encounter').classList.contains('open') };
    });
    expect(after.answered, 'the first tap answered').toBe(true);
    expect(after.open, 'the second tap left the outcome up to be read').toBe(true);
    expect(errors).toEqual([]);
  });

  test('an encounter asks, shows the odds, cannot be dodged, and reports what it did', async ({ page }) => {
    const errors = watchForErrors(page);
    // the roll behind the outcome is shown once the rolls are turned on
    await page.addInitScript(() => localStorage.setItem('deepdelve.rolls', 'on'));
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
    // answer it with the first checked choice this hero can take (one that
    // costs coin a fresh hero lacks is shown, but disabled)
    await expect(page.locator('#enc-choices .arming')).toHaveCount(0);
    await page.locator('.enc-choice:not([disabled])', { hasText: /% chance/ }).first().click();
    await expect(page.locator('#enc-text')).toContainText(/It goes (well|badly)\./);
    await expect(page.locator('#enc-text .roll')).toContainText(/d20/);
    await page.waitForTimeout(450);   // the outcome is read before Continue answers
    await page.locator('#enc-choices .primary', { hasText: 'Continue' }).click();
    await expect(page.locator('#ov-encounter')).not.toHaveClass(/open/);
    const left = await page.evaluate(id => Game.level().npcs.filter(n => n.id === id).length, placed);
    expect(left, 'the prop should be gone once answered').toBe(0);
    expect(errors).toEqual([]);
  });

  test('a level earned in an encounter waits until its result has been read, and nothing is left stuck open', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'enc-level' });
    await clearBoons(page);
    await page.evaluate(() => {
      const p = Game.player(), L = Game.level(), [dx, dy] = Dungeon.DIRS[p.dir];
      const x = p.x + dx, y = p.y + dy;
      L.tiles[y * L.w + x] = Dungeon.T.FLOOR; L.monsters.length = 0;
      L.npcs = [{ id: 'mercy', kind: 'encounter', x, y }];
      p.xp = XP_TABLE[p.level] - 1;
      Game.input('use');
    });
    await expect(page.locator('#ov-encounter')).toHaveClass(/open/);
    await expect(page.locator('#enc-choices .arming')).toHaveCount(0);
    await page.locator('#enc-choices button', { hasText: 'Finish it' }).click();
    // the outcome stays up; the level-up choice waits behind it
    await page.waitForTimeout(300);
    await expect(page.locator('#enc-text')).toContainText(/It is quick/);
    await expect(page.locator('#ov-boons')).not.toHaveClass(/open/);
    await page.waitForTimeout(450);   // the outcome is read before Continue answers
    await page.locator('#enc-choices .primary', { hasText: 'Continue' }).click();
    await expect(page.locator('#ov-boons')).toHaveClass(/open/);
    await expect(page.locator('#ov-encounter')).not.toHaveClass(/open/);
    await page.waitForTimeout(800);   // level-up cards ignore taps for a moment
    await clearBoons(page);
    await expect(page.locator('.overlay.open')).toHaveCount(0);
    expect(await page.evaluate(() => UI.paused())).toBe(false);
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

  test('a relic picked up from the floor shows in gold, with its powers and story', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'relic-ui', cls: 'Fighter' });
    await clearBoons(page);
    await page.evaluate(() => {
      const p = Game.player(), L = Game.level();
      L.items[p.x + ',' + p.y] = [{ t: 'battleaxe', q: 1, e: 1, u: 'ogres_toll' }];
    });
    await page.click('[data-open="inv"]');
    await page.locator('#floor-box button', { hasText: 'Take' }).click();
    const slot = page.locator('#inv-grid .slot.relic');
    await expect(slot).toHaveCount(1);
    await expect(slot).toContainText("The Ogre's Toll");
    await slot.click();
    await expect(page.locator('#item-detail h3.relic')).toHaveText("The Ogre's Toll");
    await expect(page.locator('#item-detail')).toContainText('Battle Axe');
    await expect(page.locator('#item-detail .relic-powers')).toContainText('Giant-feller');
    await expect(page.locator('#item-detail .relic-lore')).toContainText('tally marks');
    await page.locator('#item-detail button', { hasText: 'Equip' }).click();
    const worn = await page.evaluate(() => Game.player().eq.weapon && Game.player().eq.weapon.u);
    expect(worn).toBe('ogres_toll');
    expect(errors).toEqual([]);
  });

  test('unknown gear shows a ?, and a cursed piece put on will not come off', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'curse-ui', cls: 'Fighter' });
    await clearBoons(page);
    await page.evaluate(() => { Game.player().inv.push({ t: 'mace', q: 1, e: -1, h: 1, curse: 1 }); });
    await page.click('[data-open="inv"]');
    const idx = await page.evaluate(() => Game.player().inv.findIndex(i => i.t === 'mace'));
    const slot = page.locator('#inv-grid .slot').nth(idx);
    await expect(slot.locator('.unk')).toHaveText('?');
    await expect(slot).toContainText(/^Mace\?$/);
    await slot.click();
    await expect(page.locator('#item-detail')).toContainText('quality is unknown');
    await expect(page.locator('#item-detail button', { hasText: /^Study \(\d+%\)$/ })).toBeVisible();
    await page.locator('#item-detail button', { hasText: /^Equip$/ }).click();
    await expect(page.locator('#log')).toContainText('It is cursed');
    // the worn slot turns red, and offers no way to take it off
    const worn = page.locator('#equip .slot.cursed');
    await expect(worn).toContainText('Mace \u22121');
    await worn.click();
    await expect(page.locator('#item-detail')).toContainText('will not come off');
    await expect(page.locator('#item-detail button', { hasText: 'Unequip' })).toHaveCount(0);
    // nor any button that cannot work on a worn piece
    await expect(page.locator('#item-detail button', { hasText: /Drop|Equip/ })).toHaveCount(0);
    await expect(page.locator('#item-detail')).toContainText('Remove Curse');
    expect(errors).toEqual([]);
  });

  test('a spell that cannot be cast says why inside the spell list', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'spell-why', cls: 'Mage' });
    await clearBoons(page);
    await page.evaluate(() => { Game.level().monsters.length = 0; });
    await page.click('[data-open="spells"]');
    await page.locator('#spell-list button.spell', { hasText: 'Magic Missile' }).click();
    await expect(page.locator('#ov-spells')).toHaveClass(/open/);
    await expect(page.locator('#spell-list .spell-why')).toContainText(/Nothing|nothing/);
    expect(errors).toEqual([]);
  });

  test('Lightning Bolt cast from the spell list fells a whole group of three', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'pack-lightning', cls: 'Mage' });
    await clearBoons(page);
    await page.evaluate(() => {
      const p = Game.player(), L = Game.level(), G = Game.state();
      p.level = 9; p.sp = p.maxSp = 99; p.xp = XP_TABLE[8];
      const [dx, dy] = Dungeon.DIRS[p.dir];
      L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR;
      L.monsters.length = 0;
      const x = p.x + dx, y = p.y + dy;
      L.monsters.push({ uid: 7, id: 'skeleton', x, y, hp: 2, maxHp: 2, awake: true, nextAct: G.t + 60000, rx: x, ry: y, fromX: x, fromY: y, moveT0: 0, moveT1: 0, flashUntil: 0,
        pack: [{ hp: 2, maxHp: 2 }, { hp: 2, maxHp: 2 }] });
    });
    await page.click('[data-open="spells"]');
    await page.locator('#spell-list button.spell', { hasText: 'Lightning Bolt' }).click();
    await expect(page.locator('#ov-spells')).not.toHaveClass(/open/);
    const after = await page.evaluate(() => ({ left: Game.level().monsters.length, destroyed: Game.state().log.slice(-8).filter(l => /Skeleton is destroyed/.test(l.m)).reduce((n, l) => n + (l.n || 1), 0) }));
    expect(after.left, 'the whole group should be gone').toBe(0);
    expect(after.destroyed, 'each of the three should be logged as destroyed').toBe(3);
    expect(errors).toEqual([]);
  });

  test('Quick Start puts a fitting random hero in the dungeon in two taps', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto('/');
    await page.click('#btn-quick');
    await expect(page.locator('#screen-prologue')).toBeVisible();
    await page.click('#pro-begin');
    await page.waitForFunction(() => typeof Game !== 'undefined' && !!Game.state());
    // the roll as dealt, before a background's gift: the Ashborn's +1 constitution
    // could otherwise top a key stat that tied it (a failure now and then, by chance)
    const hero = await page.evaluate(() => { const p = Game.player(), key = CLASSES[p.cls].primary, rolled = { ...p.stats }; if (p.bg === 'ashborn') rolled.con -= 1; return { cls: p.cls, key: rolled[key], best: Math.max(...Object.values(rolled)), levels: Game.state().opts.levels }; });
    expect(Object.keys(await page.evaluate(() => CLASSES))).toContain(hero.cls);
    expect(hero.key, 'the class key stat should hold the best roll').toBeGreaterThanOrEqual(hero.best);
    expect(hero.levels).toBe(8);
    expect(errors).toEqual([]);
  });

  test('text size changes the whole interface and is remembered', async ({ page }) => {
    await startGame(page, { seed: 'text-size' });
    const size = () => page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
    expect(await size()).toBe(16);
    await page.click('[data-open="menu"]');
    await page.click('#m-text');
    await expect(page.locator('#m-text')).toHaveText('Text size: Large');
    expect(await size()).toBeGreaterThan(16);
    await page.reload();
    expect(await size(), 'the choice should survive a reload').toBeGreaterThan(16);
  });

  test('a basilisk readying its gaze says to turn away, over a tip already showing; an answered trick says there is an opening', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { tips: true, seed: 'gaze-tip' });
    await clearBoons(page);
    // the controls tip is up from the start: the warning must not wait behind it
    await expect(page.locator('#tip')).toContainText('Move with the arrows');
    await page.evaluate(() => {
      const p = Game.player(), L = Game.level(), G = Game.state(), [dx, dy] = Dungeon.DIRS[p.dir];
      L.monsters.length = 0;
      for (let k = 1; k <= 3; k++) L.tiles[(p.y + dy * k) * L.w + p.x + dx * k] = Dungeon.T.FLOOR;
      L.monsters.push({ uid: 7, id: 'basilisk', x: p.x + dx * 3, y: p.y + dy * 3, hp: 99, maxHp: 99, awake: true, spoke: true, nextAct: G.t + 60000, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0,
        windup: { kind: 'move', move: 'gaze', at: G.t, until: G.t + 60000 } });
    });
    await expect(page.locator('#tip')).toContainText('turn away', { timeout: 2000 });
    // and it stays to be read: the general word on tricks does not push it aside
    await page.waitForTimeout(1000);
    await expect(page.locator('#tip')).toContainText('turn away');
    // an opening, the first time, is named as one
    await page.evaluate(() => { const L = Game.level(), m = L.monsters[0]; m.windup = null; Game.player().opening = { uid: m.uid, until: Game.state().t + 60000 }; });
    await expect(page.locator('#tip')).toContainText('An opening', { timeout: 2000 });
    expect(errors).toEqual([]);
  });

  test('a ghoul\'s reaching claw says to strike it, and a web says fire burns it only to a hero with fire', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.addInitScript(() => localStorage.setItem('deepdelve.tipsSeen', JSON.stringify(['controls', 'monster', 'trick'])));
    await startGame(page, { tips: true, seed: 'claw-tip', cls: 'mage' });
    await clearBoons(page);
    await page.evaluate(() => {
      const p = Game.player(), L = Game.level(), G = Game.state(), [dx, dy] = Dungeon.DIRS[p.dir];
      L.monsters.length = 0;
      L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR;
      L.monsters.push({ uid: 9, id: 'ghoul', x: p.x + dx, y: p.y + dy, hp: 99, maxHp: 99, awake: true, spoke: true, nextAct: G.t + 60000, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0,
        windup: { kind: 'move', move: 'paralyse', at: G.t, until: G.t + 60000 } });
    });
    await expect(page.locator('#tip')).toContainText('Step back', { timeout: 2000 });
    // it stays to be read, though the mage's fire scroll now has a target (its tip waits)
    await page.waitForTimeout(1000);
    await expect(page.locator('#tip')).toContainText('Step back');
    // the claw is gone: so is its warning, and a web is next
    await page.evaluate(() => { Game.level().monsters.length = 0; });
    await expect(page.locator('#tip')).not.toHaveClass(/show/, { timeout: 4000 });
    await page.evaluate(() => { Game.player().webbed = Game.state().t + 60000; });
    await expect(page.locator('#tip')).toContainText('Fire burns it away', { timeout: 2000 });
    expect(errors).toEqual([]);
  });

  test('a hero with no fire is told to tear free of a web', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.addInitScript(() => localStorage.setItem('deepdelve.tipsSeen', JSON.stringify(['controls', 'monster', 'trick'])));
    await startGame(page, { tips: true, seed: 'web-tear', cls: 'fighter' });
    await clearBoons(page);
    await page.evaluate(() => { Game.level().monsters.length = 0; Game.player().webbed = Game.state().t + 60000; });
    await expect(page.locator('#tip')).toContainText('tear free', { timeout: 2000 });
    await expect(page.locator('#tip')).not.toContainText('Fire');
    expect(errors).toEqual([]);
  });

  test('once three foes are down, a quiet moment says where the hidden combat rolls are turned on', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.addInitScript(() => localStorage.setItem('deepdelve.tipsSeen', JSON.stringify(['controls', 'monster', 'trick', 'take', 'stairs', 'examine', 'trade', 'unknown', 'hurt'])));
    await startGame(page, { tips: true, seed: 'dice-tip' });
    await clearBoons(page);
    await page.evaluate(() => { const p = Game.player(); Game.level().monsters.length = 0; p.hp = p.maxHp; p.kills = 2; });
    // two is too soon
    await page.waitForTimeout(900);
    await expect(page.locator('#tip')).not.toHaveClass(/show/);
    // a hero who already shows the rolls is not told
    await page.evaluate(() => { Game.toggleRolls(); Game.player().kills = 3; });
    await page.waitForTimeout(900);
    await expect(page.locator('#tip')).not.toHaveClass(/show/);
    // with them hidden, the tip comes, naming the menu's switch
    await page.evaluate(() => Game.toggleRolls());
    await expect(page.locator('#tip')).toHaveClass(/show/, { timeout: 2000 });
    await expect(page.locator('#tip')).toContainText('Combat rolls');
    await page.click('[data-open="menu"]');
    await expect(page.locator('#m-rolls')).toHaveText(/Combat rolls: Off/);
    expect(errors).toEqual([]);
  });

  test('the newer things are each told once at a quiet moment: an oil, a job on its floor, a companion\'s trick, a mastered path; and the Warlord\'s throne in the fight', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.addInitScript(() => localStorage.setItem('deepdelve.tipsSeen', JSON.stringify(['controls', 'monster', 'trick', 'take', 'stairs', 'examine', 'trade', 'unknown', 'hurt', 'dice', 'quickscroll'])));
    await startGame(page, { tips: true, seed: 'new-tips' });
    await clearBoons(page);
    const tip = page.locator('#tip');
    const next = async (setup, words) => {
      await page.evaluate(() => { const el = document.getElementById('tip'); el.classList.remove('show'); });
      await page.evaluate(setup);
      await expect(tip).toHaveClass(/show/, { timeout: 3000 });
      await expect(tip).toContainText(words);
    };
    await page.evaluate(() => { Game.level().monsters.length = 0; const p = Game.player(); p.hp = p.maxHp; });
    await next(() => Game.player().inv.push({ t: 'oil_fire', q: 1, e: 0 }), 'Coat weapon');
    await page.waitForTimeout(7200);   // the last tip runs its time before the next is told
    await next(() => { Game.state().bounty = { kind: 'cull', depth: Game.state().depth, from: 0, need: 4, got: 0, reward: { gold: 40, t: 'oil_venom' }, started: true }; }, 'job');
    await page.waitForTimeout(7200);
    await next(() => { Game.player().capstone = 'rally'; Game.player().path = 'knight'; }, 'mastered your path');
    // and in a fight, the throne cannot wait
    await next(() => {
      const p = Game.player(), L = Game.level(), [dx, dy] = Dungeon.DIRS[p.dir];
      const base = { awake: true, nextAct: 1e12, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
      L.monsters.push({ ...base, uid: 881, id: 'warlord', x: p.x + dx * 3, y: p.y + dy * 3, hp: 200, maxHp: 300, spoke: true, throne: true, wardUntil: Game.state().t + 1e6, phase: 1 });
      L.monsters.push({ ...base, uid: 882, id: 'orc', x: -40, y: -40, hp: 30, maxHp: 30, bearer: 881, awake: false });
    }, 'shield-bearers');
    const seen = await page.evaluate(() => JSON.parse(localStorage.getItem('deepdelve.tipsSeen')));
    for (const id of ['oil', 'job', 'mastered', 'throne']) expect(seen).toContain(id);
    expect(errors).toEqual([]);
  });

  test('a puffcap coming close is told once: its spores, and how to answer them; not to a druid, who breathes them', async ({ page, browser }) => {
    const errors = watchForErrors(page);
    const seenFirst = JSON.stringify(['controls', 'monster', 'trick', 'take', 'stairs', 'examine', 'trade', 'unknown', 'hurt', 'dice', 'quickscroll']);
    await page.addInitScript(s => localStorage.setItem('deepdelve.tipsSeen', s), seenFirst);
    await startGame(page, { tips: true, seed: 'spore-tip' });
    await clearBoons(page);
    await faceOpenGround(page, 3);
    await page.evaluate(() => { Game.level().monsters.length = 0; document.getElementById('tip').classList.remove('show'); });
    await placeMonster(page, 'puffcap', 2, { hp: 30, maxHp: 30 });
    await expect(page.locator('#tip')).toHaveClass(/show/, { timeout: 3000 });
    await expect(page.locator('#tip')).toContainText('spores');
    await expect(page.locator('#tip')).toContainText('fire oil');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('deepdelve.tipsSeen')))).toContain('spores');
    expect(errors).toEqual([]);
    // a druid is not told
    const ctx = await browser.newContext({ viewport: page.viewportSize() });
    const p2 = await ctx.newPage();
    const errors2 = watchForErrors(p2);
    await p2.addInitScript(s => localStorage.setItem('deepdelve.tipsSeen', s), seenFirst);
    await startGame(p2, { tips: true, seed: 'spore-tip', cls: 'druid' });
    await clearBoons(p2);
    await faceOpenGround(p2, 3);
    await p2.evaluate(() => { Game.level().monsters.length = 0; document.getElementById('tip').classList.remove('show'); });
    await placeMonster(p2, 'puffcap', 2, { hp: 30, maxHp: 30 });
    await p2.waitForTimeout(1500);
    expect(await p2.evaluate(() => JSON.parse(localStorage.getItem('deepdelve.tipsSeen')))).not.toContain('spores');
    expect(errors2).toEqual([]);
    await ctx.close();
  });
  test('a drowned one shows only as a ripple until it rises, and is told when it does; an eyeless is told as it comes near', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.addInitScript(() => localStorage.setItem('deepdelve.tipsSeen', JSON.stringify(['controls', 'monster', 'trick', 'take', 'stairs', 'examine', 'trade', 'unknown', 'hurt', 'dice', 'quickscroll'])));
    await startGame(page, { tips: true, seed: 'kin-tips' });
    await clearBoons(page);
    await faceOpenGround(page, 4);
    await page.evaluate(() => { const L = Game.level(); L.monsters.length = 0; L.twist = 'flooded'; Game.player().hp = Game.player().maxHp = 999; document.getElementById('tip').classList.remove('show'); });
    // sunk three squares off: a ripple on the water, and no creature drawn
    await placeMonster(page, 'drowned', 3, { hp: 40, maxHp: 40, awake: false, sunk: true, nextAct: 0 });
    const drawn = () => page.evaluate(() => { const s = Game.renderState(performance.now()).sprites; return { ripple: s.some(x => x.img === Assets.sprites.dress_ripple), body: s.some(x => x.img === Assets.sprites.drowned) }; });
    await page.waitForTimeout(600);
    expect(await drawn()).toEqual({ ripple: true, body: false });
    // a step nearer, and it rises
    await page.evaluate(() => Game.input('forward'));
    await expect.poll(drawn, { timeout: 4000 }).toEqual({ ripple: false, body: true });
    await expect(page.locator('#tip')).toContainText('drowned one', { timeout: 3000 });
    await expect(page.locator('#tip')).toContainText('Step back');
    // an eyeless, awake and near
    await page.waitForTimeout(7200);
    await page.evaluate(() => { const L = Game.level(); L.monsters.length = 0; L.twist = 'dark'; document.getElementById('tip').classList.remove('show'); });
    await placeMonster(page, 'eyeless', 3, { hp: 40, maxHp: 40 });
    await expect(page.locator('#tip')).toContainText('Stand still', { timeout: 4000 });
    const seen = await page.evaluate(() => JSON.parse(localStorage.getItem('deepdelve.tipsSeen')));
    for (const id of ['drowned', 'eyeless']) expect(seen).toContain(id);
    expect(errors).toEqual([]);
  });
  test('a trick\'s warning goes once the trick has come and gone, and no log line runs under the Log button', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.addInitScript(() => localStorage.setItem('deepdelve.tipsSeen', JSON.stringify(['controls', 'monster', 'trick'])));
    await startGame(page, { tips: true, seed: 'stale-tip' });
    await clearBoons(page);
    await page.evaluate(() => {
      const p = Game.player(), L = Game.level(), G = Game.state(), [dx, dy] = Dungeon.DIRS[p.dir];
      L.monsters.length = 0;
      for (let k = 1; k <= 3; k++) L.tiles[(p.y + dy * k) * L.w + p.x + dx * k] = Dungeon.T.FLOOR;
      L.monsters.push({ uid: 8, id: 'basilisk', x: p.x + dx * 3, y: p.y + dy * 3, hp: 99, maxHp: 99, awake: true, spoke: true, nextAct: G.t + 60000, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0,
        windup: { kind: 'move', move: 'gaze', at: G.t, until: G.t + 60000 } });
    });
    await expect(page.locator('#tip')).toContainText('turn away', { timeout: 2000 });
    // the gaze is over (the creature is gone): the warning follows it
    await page.evaluate(() => { Game.level().monsters.length = 0; });
    await expect(page.locator('#tip')).not.toHaveClass(/show/, { timeout: 4000 });
    // long lines in the log keep clear of the Log button in its corner
    await page.evaluate(() => { for (let i = 0; i < 4; i++) Game.log('The Basilisk rears its head, and its eyes begin to blaze! Look away! Look away now!'); });
    await page.waitForTimeout(200);
    const clash = await page.evaluate(() => {
      const b = document.getElementById('log-more').getBoundingClientRect();
      return [...document.querySelectorAll('#log div')].some(d => {
        const r = d.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(d);
        return [...range.getClientRects()].some(t => t.bottom > b.top && t.top < b.bottom && t.right > b.left + 1);
      });
    });
    expect(clash, 'log text runs under the Log button').toBe(false);
    expect(errors).toEqual([]);
  });

  test('a tip lies along the top of the view: off the log, off the fight in the middle, and off the controls', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { tips: true, seed: 'tip-place' });
    await clearBoons(page);
    await expect(page.locator('#tip')).toHaveClass(/show/);
    const r = await page.evaluate(() => {
      const box = id => document.getElementById(id).getBoundingClientRect();
      const tip = box('tip'), view = box('view'), log = box('log');
      return { inView: tip.top >= view.top - 1 && tip.bottom <= view.bottom + 1, overLog: tip.bottom > log.top + 1,
        upperHalf: tip.bottom <= view.top + view.height * 0.5 + 1 };
    });
    expect(r.inView, 'the tip should lie on the view').toBe(true);
    expect(r.overLog, 'the tip covers the log').toBe(false);
    expect(r.upperHalf, 'the tip reaches down into the fight').toBe(true);
    expect(errors).toEqual([]);
  });

  test('every tip fits whole in the top half of the view, on a small phone and a large one', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await startGame(page, { seed: 'tip-fit' });
    // and sideways, where the view is short and a tip smaller
    for (const [width, height] of [[320, 568], [393, 727], [851, 393], [667, 375], [568, 320]]) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(300);
      const cut = await page.evaluate(() => {
        const el = document.getElementById('tip'), view = document.getElementById('view').getBoundingClientRect();
        el.classList.add('show');
        const out = [];
        for (const [k, v] of Object.entries(UI.tips())) {
          el.innerHTML = v;
          const r = el.getBoundingClientRect();
          if (el.scrollHeight > el.clientHeight + 1) out.push(`${k} is cut off (${el.scrollHeight} > ${el.clientHeight})`);
          if (r.bottom > view.top + view.height * 0.5 + 1) out.push(`${k} reaches down into the fight (${Math.round(r.bottom - view.top)} of ${Math.round(view.height)})`);
        }
        return out;
      });
      expect(cut, `at ${width}px`).toEqual([]);
    }
  });

  test('the controls tip gives way once the hero moves, and the dungeon waits while it is read', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { tips: true, seed: 'first-fight' });
    await clearBoons(page);
    await expect(page.locator('#tip')).toContainText('Move with the arrows');
    // while it is up, nothing moves: the game's clock stands still
    const t0 = await page.evaluate(() => Game.state().t);
    await page.waitForTimeout(1600);
    expect(await page.evaluate(() => Game.state().t)).toBe(t0);
    await page.evaluate(() => Game.input('right'));
    await expect(page.locator('#tip')).not.toHaveClass(/show/, { timeout: 2000 });
    // and once it has gone, the dungeon goes on
    await expect.poll(() => page.evaluate(() => Game.state().t)).toBeGreaterThan(t0 + 200);
    expect(errors).toEqual([]);
  });

  test('the first foe is taught at once, over the controls tip', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { tips: true, seed: 'first-fight-2' });
    await clearBoons(page);
    await expect(page.locator('#tip')).toContainText('Move with the arrows');
    await page.evaluate(() => {
      const p = Game.player(), L = Game.level(), G = Game.state(), [dx, dy] = Dungeon.DIRS[p.dir];
      L.tiles[(p.y + dy * 2) * L.w + p.x + dx * 2] = Dungeon.T.FLOOR; L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR;
      L.monsters.length = 0;
      L.monsters.push({ uid: 97, id: 'goblin', x: p.x + dx * 2, y: p.y + dy * 2, hp: 99, maxHp: 99, awake: true, spoke: true, nextAct: G.t + 1e9, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 });
    });
    await expect(page.locator('#tip')).toContainText('Something is coming', { timeout: 2000 });
    expect(errors).toEqual([]);
  });

  test('the first fight is coached: face it, strike it, step back from its blow with time slowed', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { tips: true, seed: 'coached' });
    await clearBoons(page);
    // a goblin awake on the hero's right, so the first step is to turn to it (a rat would
    // pounce after the step back; it has a lesson of its own)
    await page.evaluate(() => {
      const p = Game.player(), L = Game.level(), G = Game.state(), [rx, ry] = Dungeon.DIRS[(p.dir + 1) % 4], [bx, by] = Dungeon.DIRS[(p.dir + 2) % 4];
      L.tiles[(p.y + ry) * L.w + p.x + rx] = Dungeon.T.FLOOR; L.tiles[(p.y + by) * L.w + p.x + bx] = Dungeon.T.FLOOR;
      L.monsters.length = 0;
      L.monsters.push({ uid: 96, id: 'goblin', x: p.x + rx, y: p.y + ry, hp: 999, maxHp: 999, awake: true, spoke: true, nextAct: G.t + 1e9, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 });
    });
    await expect(page.locator('#tip')).toContainText('Turn to face it', { timeout: 2000 });
    await page.evaluate(() => Game.input('right'));
    await expect(page.locator('#tip')).toContainText('tap ⚔ Attack', { timeout: 3000 });
    // the strike tip waits for the strike, past the time an ordinary tip would go
    await page.waitForTimeout(4500);
    await expect(page.locator('#tip')).toContainText('tap ⚔ Attack');
    await page.evaluate(() => { const p = Game.player(); Game.state().t = Math.max(Game.state().t, p.nextAttack); Game.input('attack'); });
    await expect(page.locator('#tip')).not.toHaveClass(/show/, { timeout: 3000 });
    // its first blow: the warning comes with time slowed, and a step back answers it
    await page.evaluate(() => { const m = Game.level().monsters[0]; m.nextAct = Game.state().t; });
    await expect(page.locator('#tip')).toContainText('warning mark', { timeout: 3000 });
    expect(await page.evaluate(() => UI.timeScale())).toBeLessThan(1);
    // the mark it speaks of is drawn below the tip, not under it
    expect(await page.evaluate(() => Renderer.keptClear)).toBeGreaterThan(10);
    await page.evaluate(() => Game.input('back'));
    await expect(page.locator('#tip')).toContainText('hit empty air', { timeout: 4000 });
    expect(await page.evaluate(() => UI.timeScale())).toBe(1);
    await page.evaluate(() => document.getElementById('tip').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    await expect.poll(() => page.evaluate(() => Renderer.keptClear)).toBe(0);
    expect(errors).toEqual([]);
  });

  test('a first blow not stepped back from is called too slow if it lands, and time runs on after it', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { tips: true, seed: 'coached-late' });
    await clearBoons(page);
    await page.evaluate(() => {
      const p = Game.player(), L = Game.level(), G = Game.state(), [dx, dy] = Dungeon.DIRS[p.dir];
      L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR;
      L.monsters.length = 0;
      p.hp = p.maxHp = 500;
      L.monsters.push({ uid: 95, id: 'rat', x: p.x + dx, y: p.y + dy, hp: 999, maxHp: 999, awake: true, spoke: true, nextAct: G.t + 1e9, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 });
    });
    await expect(page.locator('#tip')).toContainText('tap ⚔ Attack', { timeout: 2000 });
    await page.evaluate(() => { const p = Game.player(); Game.state().t = Math.max(Game.state().t, p.nextAttack); Game.input('attack'); });
    await page.evaluate(() => { const m = Game.level().monsters[0]; m.nextAct = Game.state().t; });
    await expect(page.locator('#tip')).toContainText('warning mark', { timeout: 3000 });
    // no armour to speak of, so the blow lands unless the die comes up one
    const hurt0 = await page.evaluate(() => { const p = Game.player(); p.effects.ac = { amount: -100, until: 1e12 }; return p.lastHurt || 0; });
    // the lesson is settled by that first blow: once the warning tip goes,
    // a blow that landed has been called too slow; one that missed (a
    // natural one always does) teaches nothing, and says nothing
    await expect.poll(() => page.evaluate(() => { const t = document.getElementById('tip'); return !t.classList.contains('show') || !['dodge', 'dodgeside', 'dodgelunge', 'dodgelungeflank'].includes(t.dataset.tip); }), { timeout: 10000 }).toBe(true);
    const shown = await page.evaluate(() => { const t = document.getElementById('tip'); return t.classList.contains('show') ? t.dataset.tip : ''; });
    if (shown === 'late') expect(await page.evaluate(h => (Game.player().lastHurt || 0) > h, hurt0)).toBe(true);
    else expect(shown).not.toBe('dodged');
    expect(await page.evaluate(() => UI.timeScale())).toBe(1);
    expect(errors).toEqual([]);
  });

  test('a trick\'s first coming slows time while its answer is read, and only while it is coming', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.addInitScript(() => localStorage.setItem('deepdelve.tipsSeen', JSON.stringify(['controls', 'monster', 'trick'])));
    await startGame(page, { tips: true, seed: 'trick-slow' });
    await clearBoons(page);
    await page.evaluate(() => {
      const p = Game.player(), L = Game.level(), G = Game.state(), [dx, dy] = Dungeon.DIRS[p.dir];
      L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR; L.monsters.length = 0; p.hp = p.maxHp = 500;
      L.monsters.push({ uid: 94, id: 'ogre', x: p.x + dx, y: p.y + dy, hp: 999, maxHp: 999, awake: true, spoke: true, nextAct: G.t + 1e9, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0,
        windup: { kind: 'move', move: 'crush', at: G.t, until: G.t + 1500 } });
    });
    await expect(page.locator('#tip.show')).toContainText('crushing blow', { timeout: 2000 });
    expect(await page.evaluate(() => UI.timeScale())).toBeLessThan(1);
    // once the blow has come down, time runs on
    await expect.poll(() => page.evaluate(() => UI.timeScale()), { timeout: 10000 }).toBe(1);
    expect(errors).toEqual([]);
  });

  test('the step-back lesson waits for the next blow if the first foe dies first, and says to step aside with a wall behind', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { tips: true, seed: 'coached-owed' });
    await clearBoons(page);
    const rat = (hp, id = 'rat') => page.evaluate(([hp, id]) => {
      const p = Game.player(), L = Game.level(), G = Game.state(), [dx, dy] = Dungeon.DIRS[p.dir];
      L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR;
      L.monsters.length = 0; p.hp = p.maxHp = 500; p.perkHit = 60;
      L.monsters.push({ uid: 90 + hp, id, x: p.x + dx, y: p.y + dy, hp, maxHp: hp, awake: true, spoke: true, nextAct: G.t + 1e9, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 });
    }, [hp, id]);
    // the first rat dies to the first blow, before it ever swings
    await rat(1);
    await expect(page.locator('#tip')).toContainText('tap ⚔ Attack', { timeout: 2000 });
    // a natural 1 misses whatever the bonus, so swing until it falls
    await expect.poll(() => page.evaluate(() => {
      const p = Game.player(); Game.state().t = Math.max(Game.state().t, p.nextAttack); Game.input('attack');
      return Game.level().monsters.length;
    })).toBe(0);
    await page.waitForTimeout(1500);
    // the next (a goblin: a rat pounces after a step back, and has a lesson of its own), with a wall at the hero's back and room to one side
    await rat(999, 'goblin');
    await page.evaluate(() => {
      const p = Game.player(), L = Game.level(), T = Dungeon.T, [bx, by] = Dungeon.DIRS[(p.dir + 2) % 4], [rx, ry] = Dungeon.DIRS[(p.dir + 1) % 4];
      L.tiles[(p.y + by) * L.w + p.x + bx] = T.WALL; L.tiles[(p.y + ry) * L.w + p.x + rx] = T.FLOOR;
      const m = Game.level().monsters[0]; m.nextAct = Game.state().t;
    });
    await expect(page.locator('#tip.show')).toContainText('wall behind you', { timeout: 3000 });
    expect(await page.evaluate(() => UI.timeScale())).toBeLessThan(1);
    await page.evaluate(() => Game.input('strafeR'));
    await expect(page.locator('#tip.show')).toContainText('hit empty air', { timeout: 4000 });
    expect(errors).toEqual([]);
  });

  test('a first rat is taught with a step aside, as it pounces after a step back', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { tips: true, seed: 'coached-rat' });
    await clearBoons(page);
    await page.evaluate(() => {
      const p = Game.player(), L = Game.level(), G = Game.state(), T = Dungeon.T, D = Dungeon.DIRS;
      const [dx, dy] = D[p.dir], [bx, by] = D[(p.dir + 2) % 4], [rx, ry] = D[(p.dir + 1) % 4];
      for (const [x, y] of [[p.x + dx, p.y + dy], [p.x + bx, p.y + by], [p.x + rx, p.y + ry]]) L.tiles[y * L.w + x] = T.FLOOR;
      L.monsters.length = 0; p.hp = p.maxHp = 500;
      L.monsters.push({ uid: 91, id: 'rat', x: p.x + dx, y: p.y + dy, hp: 999, maxHp: 999, awake: true, spoke: true, nextAct: G.t + 1e9, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 });
    });
    await expect(page.locator('#tip')).toContainText('tap ⚔ Attack', { timeout: 2000 });
    await page.evaluate(() => { const m = Game.level().monsters[0]; m.nextAct = Game.state().t; });
    await expect(page.locator('#tip.show')).toContainText('lunges after a step back', { timeout: 3000 });
    await page.evaluate(() => Game.input('strafeR'));
    await expect(page.locator('#tip.show')).toContainText('hit empty air', { timeout: 4000 });
    expect(errors).toEqual([]);
  });

  test('a rat at your side is taught with a step forward or back, and a lunge that follows a step away is called a lunge', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { tips: true, seed: 'coached-flank' });
    await clearBoons(page);
    // first the strike lesson, with the rat ahead, so the step lesson is owed
    await page.evaluate(() => {
      const p = Game.player(), L = Game.level(), G = Game.state(), T = Dungeon.T, D = Dungeon.DIRS;
      const [dx, dy] = D[p.dir], [rx, ry] = D[(p.dir + 1) % 4], [lx, ly] = D[(p.dir + 3) % 4];
      for (const [x, y] of [[p.x + dx, p.y + dy], [p.x - dx, p.y - dy], [p.x + rx, p.y + ry], [p.x + lx, p.y + ly]]) L.tiles[y * L.w + x] = T.FLOOR;
      L.monsters.length = 0; p.hp = p.maxHp = 500;
      L.monsters.push({ uid: 93, id: 'rat', x: p.x + dx, y: p.y + dy, hp: 999, maxHp: 999, awake: true, spoke: true, nextAct: G.t + 1e9, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 });
    });
    await expect(page.locator('#tip')).toContainText('tap ⚔ Attack', { timeout: 2000 });
    // now it is at the hero's right, winding up
    await page.evaluate(() => {
      const p = Game.player(), m = Game.level().monsters[0], [rx, ry] = Dungeon.DIRS[(p.dir + 1) % 4];
      m.x = m.rx = m.fromX = p.x + rx; m.y = m.ry = m.fromY = p.y + ry; m.nextAct = Game.state().t;
    });
    await expect(page.locator('#tip.show')).toContainText('forward or back', { timeout: 3000 });
    // stepping straight away from it (to the left) is followed, and the lesson says so
    await page.evaluate(() => Game.input('strafeL'));
    await expect(page.locator('#tip.show')).toContainText('lunged after you', { timeout: 4000 });
    expect(await page.evaluate(() => Game.state().log.map(e => e.m).join(' '))).toMatch(/Giant Rat lunges after you/);
    expect(errors).toEqual([]);
  });

  test('the pack has two ring fingers, a throat and a cloak, and an unknown ring is put on and named', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.addInitScript(() => localStorage.setItem('deepdelve.tipsOff', '1'));
    await startGame(page, { seed: 'jewel-ui', cls: 'Mage' });
    await clearBoons(page);
    const look = await page.evaluate(() => { const it = { t: 'ring_protect', q: 1, e: 0 }; Game.player().inv.push(it); return Game.itemName(it); });
    await page.click('[data-open="inv"]');
    await expect(page.locator('#equip-jewels .slot')).toHaveCount(4);
    await page.locator('#inv-grid .slot.filled', { hasText: look }).click();
    await expect(page.locator('#item-detail')).toContainText('Putting it on will tell you');
    await page.locator('#item-detail button', { hasText: 'Put on' }).click();
    await expect(page.locator('#equip-jewels .slot').first()).toContainText('Ring of Protection');
    await expect(page.locator('#log')).toContainText('It is a Ring of Protection');
    expect(errors).toEqual([]);
  });

  test('with both fingers taken, a third ring asks which one comes off', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.addInitScript(() => localStorage.setItem('deepdelve.tipsOff', '1'));
    await startGame(page, { seed: 'jewel-finger', cls: 'Mage' });
    await clearBoons(page);
    await page.evaluate(() => {
      const p = Game.player(), G = Game.state();
      for (const t of ['ring_protect', 'ring_might', 'ring_evasion']) G.known[t] = 1;
      const a = { t: 'ring_protect', q: 1, e: 0 }, b = { t: 'ring_might', q: 1, e: 0 };
      p.inv.push(a, b); Game.equip(a, true); Game.equip(b, true);
      p.inv.push({ t: 'ring_evasion', q: 1, e: 0 });
    });
    await page.click('[data-open="inv"]');
    await page.locator('#inv-grid .slot.filled', { hasText: 'Ring of Evasion' }).click();
    await expect(page.locator('#item-detail button', { hasText: 'Put on' })).toHaveCount(0);
    await page.locator('#item-detail button', { hasText: 'Replace Might' }).click();
    const worn = await page.evaluate(() => { const eq = Game.player().eq; return [eq.ring && eq.ring.t, eq.ring2 && eq.ring2.t]; });
    expect(worn.sort()).toEqual(['ring_evasion', 'ring_protect']);
    expect(await page.evaluate(() => Game.player().inv.some(i => i.t === 'ring_might'))).toBe(true);
    expect(errors).toEqual([]);
  });

  test('the Hero sheet gives a ring its real amount, a curse\'s minus included, and two of a kind once', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.addInitScript(() => localStorage.setItem('deepdelve.tipsOff', '1'));
    await startGame(page, { seed: 'jewel-sheet', cls: 'Mage' });
    await clearBoons(page);
    await page.evaluate(() => {
      const p = Game.player(), G = Game.state(); G.known.ring_protect = 1;
      const bad = { t: 'ring_protect', q: 1, e: -2, curse: 1 };
      p.inv.push(bad); Game.equip(bad, true);
    });
    await page.click('[data-open="char"]');
    await expect(page.locator('#char-sheet')).toContainText('Armour class \u22121 (ring)');
    await page.click('#ov-char [data-close]');
    await page.evaluate(() => { const p = Game.player(), good = { t: 'ring_protect', q: 1, e: 1 }; p.inv.push(good); Game.equip(good, true); });
    await page.click('[data-open="char"]');
    await expect(page.locator('#char-sheet')).toContainText('Armour class +2 (the better of your two rings)');
    await expect(page.locator('#char-sheet li', { hasText: 'Protection' })).toHaveCount(1);
    expect(errors).toEqual([]);
  });

  test('what lies underfoot shows at the foot of the view, and a tap there takes it', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.addInitScript(() => localStorage.setItem('deepdelve.tipsOff', '1'));
    await startGame(page, { seed: 'feet', cls: 'Fighter' });
    await clearBoons(page);
    await expect(page.locator('#feet')).toBeHidden();
    await page.evaluate(() => {
      const p = Game.player(); Game.level().monsters.length = 0;
      for (const t of ['potion_heal', 'ration']) { const it = p.inv.find(i => i.t === t); if (it) Game.dropItem(it); }
    });
    await expect(page.locator('#feet')).toBeVisible();
    await expect(page.locator('#feet .feet-icons img')).toHaveCount(2);
    const box = await page.locator('#feet').boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    await page.click('#feet');
    await expect(page.locator('#feet')).toBeHidden();
    expect(await page.evaluate(() => Game.floorItems().length)).toBe(0);
    expect(errors).toEqual([]);
  });

  test('a fire scroll\'s log line and a draught\'s healing show when they land, not before', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.addInitScript(() => localStorage.setItem('deepdelve.tipsOff', '1'));
    await startGame(page, { seed: 'held-lines' });
    await clearBoons(page);
    await page.evaluate(() => {
      const p = Game.player(), L = Game.level(), G = Game.state(), [dx, dy] = Dungeon.DIRS[p.dir];
      for (let i = 1; i <= 2; i++) L.tiles[(p.y + dy * i) * L.w + p.x + dx * i] = Dungeon.T.FLOOR;
      L.monsters.length = 0;
      L.monsters.push({ uid: 98, id: 'goblin', x: p.x + dx * 2, y: p.y + dy * 2, hp: 500, maxHp: 500, awake: true, spoke: true, nextAct: G.t + 1e9, rx: p.x + dx * 2, ry: p.y + dy * 2, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 });
      const it = { t: 'scroll_fire', q: 1, e: 0 }; p.inv.push(it); G.known.scroll_fire = 1;
      Game.useItem(it);
    });
    await page.waitForTimeout(200);
    await expect(page.locator('#log')).not.toContainText('fireball hits');
    await expect(page.locator('#log')).toContainText('fireball hits', { timeout: 2000 });
    // a draught: the bar keeps its old life until it is down
    const hp = await page.evaluate(() => {
      const p = Game.player(); Game.level().monsters.length = 0;
      p.hp = 2; p.maxHp = 40; const it = { t: 'potion_heal', q: 1, e: 0 }; p.inv.push(it); Game.state().known.potion_heal = 1;
      Game.useItem(it); return p.hp;
    });
    expect(hp).toBeGreaterThan(2);
    await page.waitForTimeout(150);
    await expect(page.locator('#txt-hp')).toHaveText('HP 2/40');
    await expect(page.locator('#txt-hp')).toHaveText(`HP ${hp}/40`, { timeout: 2000 });
    expect(errors).toEqual([]);
  });

  test('a tip shows the first time, only once, and the menu can turn tips off', async ({ page }) => {
    await startGame(page, { tips: true, seed: 'tips' });
    await expect(page.locator('#tip')).toHaveClass(/show/);
    await expect(page.locator('#tip')).toContainText('Move with the arrows');
    // a tap on it puts it away (and goes no further: see the round five tests),
    // and it keeps to the top of the view, clear of the middle where taps act
    const box = await page.evaluate(() => { const t = document.getElementById('tip').getBoundingClientRect(), v = document.getElementById('view').getBoundingClientRect(); return { tipBottom: t.bottom, mid: v.top + v.height / 2 }; });
    expect(box.tipBottom).toBeLessThan(box.mid);
    const seen = await page.evaluate(() => JSON.parse(localStorage.getItem('deepdelve.tipsSeen')));
    expect(seen).toContain('controls');
    // a second run on this device does not repeat it. Leaving the page saves
    // the run, so clear that save on the title screen, where New Game then
    // goes straight to creation rather than asking to replace it.
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('deepdelve.save'));
    await page.click('#btn-new');
    await page.fill('#c-seed', 'tips-2');
    await page.click('#c-begin');
    await page.click('#pro-begin');
    await page.waitForFunction(() => typeof Game !== 'undefined' && !!Game.state());
    await page.waitForTimeout(600);
    await expect(page.locator('#tip')).not.toContainText('Move with the arrows');
    // turned off, nothing shows even for something new
    await page.click('[data-open="menu"]');
    await page.click('#m-tips');
    await expect(page.locator('#m-tips')).toHaveText('Tips: Off');
    expect(await page.evaluate(() => localStorage.getItem('deepdelve.tipsOff'))).toBe('1');
  });
  test('a dark floor is seen darker, and a flooded one shows its water', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'feat-twists' });
    await clearBoons(page);
    // the same square, the same view: only the floor's twist changes
    const look = async twist => {
      await page.evaluate(t => { const L = Game.level(); L.monsters.length = 0; L.twist = t; }, twist);
      await page.waitForTimeout(250);
      return page.evaluate(() => {
        const c = document.getElementById('view'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let all = 0, blue = 0, n = 0, low = 0;
        for (let i = 0; i < d.length; i += 4) {
          all += d[i] + d[i + 1] + d[i + 2]; n++;
          if (i / 4 / c.width > c.height * 0.6) { blue += d[i + 2] - d[i]; low++; }
        }
        return { bright: all / n / 3, blue: blue / low };
      });
    };
    const plain = await look(null), dark = await look('dark'), wet = await look('flooded');
    expect(dark.bright).toBeLessThan(plain.bright * 0.8);
    expect(wet.blue).toBeGreaterThan(plain.blue + 3);
    expect(errors).toEqual([]);
  });
  test('an oil cask is told once and kicked over spills oil; set alight it burns in the view, the fire is told, and it burns out to ash', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.addInitScript(() => localStorage.setItem('deepdelve.tipsSeen', JSON.stringify(['controls', 'monster', 'trick', 'take', 'stairs', 'examine', 'trade', 'unknown', 'hurt', 'dice', 'quickscroll'])));
    await startGame(page, { tips: true, seed: 'living-oil' });
    await clearBoons(page);
    await faceOpenGround(page, 3);
    await page.evaluate(() => { const L = Game.level(); L.monsters.length = 0; L.fields = {}; document.getElementById('tip').classList.remove('show');
      const p = Game.player(), [dx, dy] = Dungeon.DIRS[p.dir]; L.dressing.push({ x: p.x + dx, y: p.y + dy, k: 'oilcask', ox: 0, oy: 0 }); });
    await page.evaluate(() => { const p = Game.player(); p.hp = p.maxHp = 500; });
    await expect(page.locator('#tip')).toContainText('oil cask', { timeout: 3000 });
    await page.evaluate(() => { document.getElementById('tip').classList.remove('show'); Game.input('forward'); });
    const oil = () => page.evaluate(() => Object.values(Game.level().fields || {}).filter(f => f.k === 'oil').length);
    await expect.poll(oil, { timeout: 3000 }).toBeGreaterThan(2);
    // it tips away from the hero who kicked it
    expect(await page.evaluate(() => { const p = Game.player(); return Game.fieldAt(p.x, p.y); })).toBeNull();
    // the lower view before and after the oil is lit
    const orange = () => page.evaluate(() => { const c = document.getElementById('view'), d = c.getContext('2d').getImageData(0, c.height / 2, c.width, c.height / 2).data; let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] > 190 && d[i + 1] > 70 && d[i + 1] < 190 && d[i + 2] < 90) n++; return n; });
    await page.waitForTimeout(400);
    const before = await orange();
    await page.evaluate(() => { const L = Game.level(), p = Game.player(), [dx, dy] = Dungeon.DIRS[p.dir], t = Game.state().t;
      L.fields[`${p.x + dx},${p.y + dy}`] = { k: 'fire', fuel: 'oil', until: t + 4500, spread: t + 700, burn: t + 150, gen: 0 }; });
    await page.waitForTimeout(700);
    expect(await orange()).toBeGreaterThan(before + 150);
    await expect(page.locator('#tip')).toContainText('Fire!', { timeout: 4000 });
    // it burns through the oil and leaves ash
    await expect.poll(() => page.evaluate(() => { const F = Object.values(Game.level().fields || {}); return F.length > 0 && F.every(f => f.k === 'ash'); }), { timeout: 12000 }).toBe(true);
    expect(errors).toEqual([]);
  });
  test('a flask of lamp oil is thrown from the pack and spills where it lands', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'living-flask' });
    await clearBoons(page);
    await faceOpenGround(page, 3);
    await page.evaluate(() => { const L = Game.level(); L.monsters.length = 0; L.fields = {}; Game.player().inv.push({ t: 'lamp_oil', q: 2, e: 0 }); });
    await page.click('[data-open="inv"]');
    await expect(page.locator('#ov-inv')).toHaveClass(/open/);
    await page.locator('#inv-grid .slot.filled').filter({ has: page.locator('img') }).last().click();
    await expect(page.locator('#item-detail')).toContainText('Lamp Oil');
    await page.locator('#item-detail button', { hasText: 'Throw' }).click();
    await expect.poll(() => page.evaluate(() => Object.values(Game.level().fields || {}).filter(f => f.k === 'oil').length), { timeout: 3000 }).toBeGreaterThan(2);
    expect(await page.evaluate(() => Game.player().inv.find(i => i.t === 'lamp_oil').q)).toBe(1);
    expect(errors).toEqual([]);
  });
  test('a puffcap is drawn in front of you, and a blow from beside it bursts it in spores', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'feat-puffcap' });
    await clearBoons(page);
    await faceOpenGround(page, 3);
    const view = () => page.evaluate(() => { const c = document.getElementById('view'); return Array.from(c.getContext('2d').getImageData(0, 0, c.width, c.height).data.filter((_, i) => i % 16 === 0)); });
    await page.evaluate(() => { Game.level().monsters.length = 0; Game.level().twist = 'overgrown'; });
    await page.waitForTimeout(250);
    const bare = await view();
    const m = await placeMonster(page, 'puffcap', 2, { hp: 500, maxHp: 500 });
    expect(m && m.name).toBe('Puffcap');
    await page.waitForTimeout(250);
    const withCap = await view();
    expect(withCap.filter((v, i) => Math.abs(v - bare[i]) > 20).length).toBeGreaterThan(200);
    // step up beside it and strike until a blow lands
    await page.evaluate(() => { const p = Game.player(), [dx, dy] = Dungeon.DIRS[p.dir]; p.x += dx; p.y += dy; p.hp = p.maxHp = 500; p.stats.str = 30; });
    await expect.poll(async () => {
      await page.evaluate(() => { const p = Game.player(); p.nextAttack = 0; Game.input('attack'); });
      return page.locator('#log').innerText();
    }, { timeout: 8000 }).toContain('bursts in a cloud of spores');
    expect(errors).toEqual([]);
  });
  test('Calm view in the menu stops the shake and the dust, and is remembered', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'calm-view' });
    await clearBoons(page);
    const shakeNow = () => page.evaluate(async () => {
      const fx = Game.renderState(performance.now()).fx;
      fx.shakeAmp = 8; fx.shakeMs = 600; fx.shakeUntil = performance.now() + 600;
      await new Promise(r => setTimeout(r, 120));
      return document.getElementById('view').style.transform;
    });
    // without it, a blow shakes the view
    expect(await shakeNow()).toContain('translate');
    await page.click('[data-open="menu"]');
    await expect(page.locator('#m-calm')).toHaveText('Calm view: Off');
    await page.click('#m-calm');
    await expect(page.locator('#m-calm')).toHaveText('Calm view: On');
    expect(await page.evaluate(() => [localStorage.getItem('deepdelve.calm'), Renderer.calm])).toEqual(['1', true]);
    await page.click('#ov-menu [data-close]');
    // with it, the same blow leaves the view still
    await page.waitForTimeout(700);
    expect(await shakeNow()).toBe('');
    // and it holds after a reload
    await page.reload();
    await page.waitForFunction(() => typeof Renderer !== 'undefined');
    expect(await page.evaluate(() => Renderer.calm)).toBe(true);
    expect(errors).toEqual([]);
  });
  test('a save code from the menu carries the hero to a fresh browser; a bad code says why', async ({ page, browser }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'save-code', name: 'Wendeline' });
    await clearBoons(page);
    await page.click('[data-open="menu"]');
    await page.click('#m-code');
    await expect(page.locator('#ov-code')).toHaveClass(/open/);
    await expect(page.locator('#code-out')).toHaveValue(/^DD1\./);
    const code = await page.locator('#code-out').inputValue();
    await expect(page.locator('#code-note')).toContainText('copy all of it');
    // another phone: a browser with nothing saved
    const other = await browser.newContext({ viewport: page.viewportSize() });
    const p2 = await other.newPage();
    const errors2 = watchForErrors(p2);
    await p2.goto('/');
    await p2.click('#btn-code');
    await expect(p2.locator('#screen-code')).toBeVisible();
    await p2.fill('#code-in', 'not a code at all');
    await p2.click('#code-load');
    await expect(p2.locator('#code-why')).toContainText('not a Deepdelve save code');
    await p2.fill('#code-in', code);
    await p2.click('#code-load');
    await expect(p2.locator('#screen-game')).toBeVisible();
    expect(await p2.evaluate(() => Game.player().name)).toBe('Wendeline');
    // and it is kept there, to Continue from
    await p2.goto('/');
    await expect(p2.locator('#save-summary')).toContainText('Wendeline');
    expect(errors2).toEqual([]);
    await other.close();
    expect(errors).toEqual([]);
  });
  test('a returning player is told once what is new; a new player is not; dismissing or starting a run puts it away', async ({ page, browser }) => {
    const errors = watchForErrors(page);
    // a new player: nothing to compare with, so no note, now or later
    await page.goto('/');
    await expect(page.locator('#news')).toBeHidden();
    await page.reload();
    await expect(page.locator('#news')).toBeHidden();
    // a returning one (a Hall of Heroes on this device) sees it until dismissed
    const back = await browser.newContext({ viewport: page.viewportSize() });
    const p2 = await back.newPage();
    await p2.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('deepdelve.hall', '[]'); sessionStorage.setItem('seeded', '1'); } });
    await p2.goto('/');
    await expect(p2.locator('#news')).toBeVisible();
    await expect(p2.locator('#news-text')).toContainText('lamp oil');
    // clear of the menu
    const nb = await p2.locator('#news').boundingBox(), mb = await p2.locator('#btn-new').boundingBox();
    expect(nb.y + nb.height).toBeLessThanOrEqual(mb.y);
    await p2.click('#news-close');
    await expect(p2.locator('#news')).toBeHidden();
    await p2.reload();
    await expect(p2.locator('#news')).toBeHidden();
    // and starting a run puts it away too
    await p2.evaluate(() => localStorage.removeItem('deepdelve.news'));
    await p2.reload();
    await expect(p2.locator('#news')).toBeVisible();
    await p2.click('#btn-quick');
    await expect(p2.locator('#screen-prologue')).toBeVisible();
    await p2.click('#pro-begin');
    await expect(p2.locator('#screen-game')).toBeVisible();
    expect(await p2.evaluate(() => localStorage.getItem('deepdelve.news'))).not.toBeNull();
    await back.close();
    expect(errors).toEqual([]);
  });
  test('a charm in the pack is given to the hound from its card, and the Hero sheet says it wears it', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'charm-ui', cls: 'Fighter' });
    await clearBoons(page);
    await page.evaluate(() => { Game.player().inv.push({ t: 'charm_collar', q: 1, e: 0 }); });
    // with no companion the card offers nothing to do with it
    await page.click('[data-open="inv"]');
    await page.locator('#inv-grid .slot', { hasText: 'Iron-Studded Collar' }).click();
    await expect(page.locator('#item-detail')).toContainText('For your companion to wear');
    await expect(page.locator('#item-detail button', { hasText: /^Give to/ })).toHaveCount(0);
    await page.click('#ov-inv [data-close]');
    await page.evaluate(() => {
      const p = Game.player(), L = Game.level(), [dx, dy] = Dungeon.DIRS[p.dir];
      L.monsters.length = 0; L.npcs.length = 0;
      L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR;
      L.npcs.push({ kind: 'encounter', id: 'stray', x: p.x + dx, y: p.y + dy });
      Game.input('forward');
    });
    await expect(page.locator('#ov-encounter')).toHaveClass(/open/);
    await expect(page.locator('#enc-choices .arming')).toHaveCount(0);
    await page.locator('#enc-choices .enc-choice', { hasText: 'Share your food' }).click();
    await page.waitForTimeout(450);
    await page.locator('#enc-choices .primary', { hasText: 'Continue' }).click();
    await expect.poll(() => page.evaluate(() => !!Game.companion())).toBe(true);
    const name = await page.evaluate(() => Game.companion().name);
    await page.click('[data-open="inv"]');
    await page.locator('#inv-grid .slot', { hasText: 'Iron-Studded Collar' }).click();
    await page.locator('#item-detail button', { hasText: `Give to ${name}` }).click();
    await expect(page.locator('#ov-inv')).not.toHaveClass(/open/);
    expect(await page.evaluate(() => Game.companion().charm)).toBe('charm_collar');
    await page.click('[data-open="char"]');
    await expect(page.locator('#char-sheet')).toContainText('wearing the iron-studded collar');
    expect(errors).toEqual([]);
  });

  test('a hound that has come down two floors at the hero\'s side is blooded, and the Hero sheet says what it has learned', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'hound-grow-ui', cls: 'Fighter' });
    await clearBoons(page);
    await page.evaluate(() => {
      const p = Game.player(), L = Game.level(), [dx, dy] = Dungeon.DIRS[p.dir];
      L.monsters.length = 0; L.npcs.length = 0;
      L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR;
      L.npcs.push({ kind: 'encounter', id: 'stray', x: p.x + dx, y: p.y + dy });
      Game.input('forward');
    });
    await expect(page.locator('#ov-encounter')).toHaveClass(/open/);
    await expect(page.locator('#enc-choices .arming')).toHaveCount(0);
    await page.locator('#enc-choices .enc-choice', { hasText: 'Share your food' }).click();
    await page.waitForTimeout(450);
    await page.locator('#enc-choices .primary', { hasText: 'Continue' }).click();
    await expect.poll(() => page.evaluate(() => !!Game.companion())).toBe(true);
    const name = await page.evaluate(() => Game.companion().name);
    await page.click('[data-open="char"]');
    await expect(page.locator('#char-sheet')).toContainText('2 more floors down at your side and it learns Hamstring');
    await page.click('#ov-char [data-close]');
    await page.evaluate(() => { for (let i = 0; i < 2; i++) { Game.level().monsters.length = 0; Game.descend(); if (Game.forkPending()) Game.chooseRoute('crypts'); } });
    await expect.poll(() => page.evaluate(() => Game.companionRank())).toBe(1);
    expect(await page.evaluate(n => Game.state().log.some(e => e.m.includes(`${n} is blooded now`)), name)).toBe(true);
    await page.click('[data-open="char"]');
    await expect(page.locator('#char-sheet')).toContainText(`${name}, your hound, blooded`);
    await expect(page.locator('#char-sheet')).toContainText('Hamstring: one bite in three that lands holds its foe back a moment.');
    expect(errors).toEqual([]);
  });

  test('a starving hound fed on the way follows the hero, shows in the view, and stays or comes when told', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'hound-ui', cls: 'Fighter' });
    await clearBoons(page);
    // with no hound, the map's key does not mention one
    await page.click('[data-open="map"]');
    await expect(page.locator('#map-legend [data-key="hound"]')).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(page.locator('#ov-map')).not.toHaveClass(/open/);
    // the hound's corner, straight ahead
    await page.evaluate(() => {
      const p = Game.player(), L = Game.level(), [dx, dy] = Dungeon.DIRS[p.dir];
      L.monsters.length = 0; L.npcs.length = 0;
      L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR;
      L.npcs.push({ kind: 'encounter', id: 'stray', x: p.x + dx, y: p.y + dy });
      Game.input('forward');
    });
    await expect(page.locator('#ov-encounter')).toHaveClass(/open/);
    await expect(page.locator('#enc-choices')).toContainText('Share your food with it');
    await expect(page.locator('#enc-choices .arming')).toHaveCount(0);
    await page.locator('#enc-choices .enc-choice', { hasText: 'Share your food' }).click();
    await page.waitForTimeout(450);   // the outcome is read before Continue answers
    await page.locator('#enc-choices .primary', { hasText: 'Continue' }).click();
    await expect(page.locator('#ov-encounter')).not.toHaveClass(/open/);
    await expect.poll(() => page.evaluate(() => !!Game.companion())).toBe(true);
    const name = await page.evaluate(() => Game.companion().name);
    // turn to face it (it came in beside the hero)
    await page.evaluate(() => {
      const p = Game.player(), c = Game.companion(), want = Dungeon.DIRS.findIndex(([dx, dy]) => dx === c.x - p.x && dy === c.y - p.y);
      const turns = (want - p.dir + 4) % 4;
      for (let i = 0; i < (turns === 3 ? 1 : turns); i++) Game.input(turns === 3 ? 'left' : 'right');
    });
    await expect(page.locator('[data-tap="use"]')).toContainText('Stay');
    // it is drawn: the view holds the hound's picture
    expect(await page.evaluate(() => Game.renderState(performance.now()).sprites.some(s => s.img === Assets.sprites.dog))).toBe(true);
    await page.click('[data-tap="use"]');
    await expect(page.locator('#hud-status')).toContainText(`${name}`);
    await expect(page.locator('#hud-status')).toContainText('staying');
    // told to stay, it sits
    await expect.poll(() => page.evaluate(() => Game.renderState(performance.now()).sprites.some(s => s.img === Assets.sprites.dog.sit))).toBe(true);
    await expect(page.locator('[data-tap="use"]')).toContainText('Come');
    await page.click('[data-tap="use"]');
    await expect(page.locator('#hud-status')).not.toContainText('staying');
    // the map marks it, and its key says what the mark is
    await page.click('[data-open="map"]');
    await expect(page.locator('#map-legend [data-key="hound"]')).toBeVisible();
    const px = await page.evaluate(() => {
      const c = /** @type {HTMLCanvasElement} */ (document.querySelector('#map-canvas')), h = Game.companion(), t = +c.dataset.tile;
      const x = (h.x - +c.dataset.originX) * t + t / 2, y = (h.y - +c.dataset.originY) * t + t / 2;
      return [...c.getContext('2d').getImageData(Math.floor(x), Math.floor(y), 1, 1).data].slice(0, 3);
    });
    expect(px).toEqual([0xf2, 0xec, 0xdc]);
    await page.keyboard.press('Escape');
    // the Hero sheet knows it
    await page.click('[data-open="char"]');
    await expect(page.locator('#char-sheet')).toContainText(name);
    expect(errors).toEqual([]);
  });

  test('a goblin let out of its cage follows, and the Use button picks a locked door there is no key for', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'goblin-ui', cls: 'Fighter' });
    await clearBoons(page);
    // the cage straight ahead, through the real overlay
    await page.evaluate(() => {
      const p = Game.player(), L = Game.level(), [dx, dy] = Dungeon.DIRS[p.dir];
      p.stats.str = 18;
      L.monsters.length = 0; L.npcs.length = 0;
      L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR;
      L.npcs.push({ kind: 'encounter', id: 'caged', x: p.x + dx, y: p.y + dy });
      Game.input('forward');
    });
    await expect(page.locator('#ov-encounter')).toHaveClass(/open/);
    await expect(page.locator('#enc-choices')).toContainText('Pick the padlock');
    await expect(page.locator('#enc-choices .arming')).toHaveCount(0);
    await page.locator('#enc-choices .enc-choice', { hasText: 'Wrench the bars' }).click();
    await page.waitForTimeout(450);   // the outcome is read before Continue answers
    await page.locator('#enc-choices .primary', { hasText: 'Continue' }).click();
    // the bars may hold: wrench again until they give (a check can fail)
    await page.evaluate(() => {
      for (let i = 0; i < 30 && !Game.companion(); i++) {
        const p = Game.player(), L = Game.level(), [dx, dy] = Dungeon.DIRS[p.dir];
        L.npcs = [{ kind: 'encounter', id: 'caged', x: p.x + dx, y: p.y + dy }];
        Game.input('use'); Game.chooseEncounter(0); Game.closeEncounter();
      }
    });
    await expect.poll(() => page.evaluate(() => Game.companion() && Game.companion().kind)).toBe('goblin');
    // a locked door ahead with no key, the goblin beside the hero
    await page.evaluate(() => {
      const p = Game.player(), L = Game.level(), c = Game.companion(), [dx, dy] = Dungeon.DIRS[p.dir];
      L.npcs.length = 0;
      L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.DOOR_LOCKED;
      L.locks[`${p.x + dx},${p.y + dy}`] = 'iron';
      p.inv = p.inv.filter(it => it.t !== 'key');
      const [bx, by] = Dungeon.DIRS[(p.dir + 2) % 4];
      L.tiles[(p.y + by) * L.w + p.x + bx] = Dungeon.T.FLOOR;
      c.x = p.x + bx; c.y = p.y + by;
    });
    await expect(page.locator('[data-tap="use"]')).toContainText('Pick');
    await page.click('[data-tap="use"]');
    await expect.poll(() => page.evaluate(() => { const p = Game.player(), L = Game.level(), [dx, dy] = Dungeon.DIRS[p.dir]; return L.tiles[(p.y + dy) * L.w + p.x + dx] === Dungeon.T.DOOR_OPEN; })).toBe(true);
    // it is drawn as itself, not as the hound
    expect(await page.evaluate(() => Game.renderState(performance.now()).sprites.some(s => s.img === Assets.sprites.scrag || s.img === Assets.sprites.scrag.windup))).toBe(true);
    expect(errors).toEqual([]);
  });

  test('left-handed controls in the menu swap the pad and the buttons, and are remembered', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'left-hand' });
    await clearBoons(page);
    const sides = () => page.evaluate(() => {
      const mid = r => r.left + r.width / 2, box = s => document.querySelector(s).getBoundingClientRect();
      return { pad: mid(box('.dpad')), attack: mid(box('.ctl.attack')), use: mid(box('.ctl[data-tap="use"]')),
        view: mid(box('#view')), ctrl: mid(box('.ctrl-col')), half: innerWidth / 2 };
    });
    // by default the pad is under the left thumb and Attack under the right
    let s = await sides();
    expect(s.pad).toBeLessThan(s.half);
    expect(s.attack).toBeGreaterThan(s.half);
    await page.click('[data-open="menu"]');
    await expect(page.locator('#m-hand')).toHaveText('Controls: right-handed');
    await page.click('#m-hand');
    await expect(page.locator('#m-hand')).toHaveText('Controls: left-handed');
    await page.click('#ov-menu [data-close]');
    s = await sides();
    expect(s.pad).toBeGreaterThan(s.half);
    expect(s.attack).toBeLessThan(s.half);
    // Attack keeps to the inside edge, next to the pad
    expect(s.attack).toBeGreaterThan(s.use);
    // the log's words keep clear of its button, which has moved to the left with it
    const clear = await page.evaluate(() => { const b = document.querySelector('.log-more').getBoundingClientRect(), l = document.querySelector('#log'); return parseFloat(getComputedStyle(l).paddingLeft) + l.getBoundingClientRect().left - b.right; });
    expect(clear).toBeGreaterThanOrEqual(0);
    // it holds after a reload, and sideways the whole panel moves to the left
    await page.setViewportSize({ width: 844, height: 390 });
    await page.reload();
    await page.waitForFunction(() => typeof Renderer !== 'undefined');
    expect(await page.evaluate(() => document.body.classList.contains('lefty'))).toBe(true);
    await page.click('#btn-continue');
    await expect(page.locator('#screen-game')).toBeVisible();
    await page.waitForTimeout(200);
    s = await sides();
    expect(s.ctrl).toBeLessThan(s.view);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
});
