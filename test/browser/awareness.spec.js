'use strict';
// What the player is told: where they are, what hit them, and why an action
// did nothing. The second playtest lost characters to all three being silent.
const { test } = require('@playwright/test');
const { expect, watchForErrors, startGame, clearBoons, faceOpenGround, placeMonster } = require('./helpers');

/**
 * Where the map has drawn the player, expressed as a dungeon square so it can be
 * compared with where the game says the player is.
 */
async function markerAt(page) {
  await page.click('[data-open="map"]');
  await page.waitForTimeout(150);
  const r = await page.evaluate(() => {
    const c = document.querySelector('#map-canvas');
    const g = c.getContext('2d', { willReadFrequently: true });
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let sx = 0, sy = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] > 200 && d[i + 1] > 80 && d[i + 1] < 140 && d[i + 2] > 50 && d[i + 2] < 110) {
        sx += (i / 4) % c.width; sy += Math.floor((i / 4) / c.width); n++;
      }
    }
    const tile = Number(c.dataset.tile);
    const originX = Number(c.dataset.originX), originY = Number(c.dataset.originY);
    const p = Game.player();
    return {
      pixels: n, tile,
      // the square the marker's centre falls in
      square: n ? { x: Math.floor(sx / n / tile) + originX, y: Math.floor(sy / n / tile) + originY } : null,
      player: { x: p.x, y: p.y },
    };
  });
  await page.click('#ov-map [data-close]');
  await page.waitForTimeout(80);
  return r;
}

test.describe('knowing where you are', () => {
  test('the map marker sits on the square the player is standing on', async ({ page }) => {
    await startGame(page, { seed: 'aware-map' });
    await clearBoons(page);

    const before = await markerAt(page);
    expect(before.pixels, 'the marker should be on the map').toBeGreaterThan(0);
    expect(before.square, 'the marker must be on the player').toEqual(before.player);
    // and it must be big enough to notice a single step
    expect(before.tile, 'map squares should be legible').toBeGreaterThanOrEqual(8);
    // a fresh floor has little explored: its squares stay map-sized, not a close-up
    expect(before.tile, 'map squares should not balloon on a fresh floor').toBeLessThanOrEqual(28);
    expect(before.pixels, 'the marker should fill its square').toBeGreaterThan(before.tile * before.tile * 0.4);

    await page.evaluate(async () => {
      const p = Game.player();
      const target = p.steps + 3;
      for (let i = 0; i < 40 && p.steps < target; i++) {
        Game.input('forward');
        await new Promise(r => setTimeout(r, 240));
        if (p.steps < target && i % 3 === 2) { Game.input('right'); await new Promise(r => setTimeout(r, 240)); }
      }
    });

    const after = await markerAt(page);
    const moved = Math.abs(after.player.x - before.player.x) + Math.abs(after.player.y - before.player.y);
    expect(moved, 'the player should have moved').toBeGreaterThan(0);
    expect(after.square, 'the marker must follow the player').toEqual(after.player);
  });

  test('on a short landscape screen the map uses the height it has, and the key still fits', async ({ page }) => {
    await page.setViewportSize({ width: 740, height: 360 });
    // a seed that starts in a small room: a few squares, all of them seen
    await startGame(page, { seed: 'maps1' });
    await clearBoons(page);
    await page.click('[data-open="map"]');
    await page.waitForTimeout(150);
    const m = await page.evaluate(() => ({
      tile: Number(document.querySelector('#map-canvas').dataset.tile),
      note: document.querySelector('#map-legend').nextElementSibling.getBoundingClientRect().bottom,
    }));
    // a guessed allowance left a fresh floor's squares at 16px in the middle of an empty screen
    expect(m.tile, 'the squares should use the free height').toBeGreaterThanOrEqual(20);
    expect(m.note, 'the note under the key should still be on the screen').toBeLessThanOrEqual(360);
  });

  test('on a phone with a notch and a home bar, a tall map and its key still fit without scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await startGame(page, { seed: 'maps1' });
    await clearBoons(page);
    // as a Home Screen app shows it: the insets are real, and the body keeps clear of them
    await page.addStyleTag({ content: ':root { --sat: 47px !important; --sab: 34px !important; }' });
    await page.evaluate(() => { const L = Game.level(), p = Game.player(); for (let y = 0; y < L.h; y++) for (let x = Math.max(0, p.x - 3); x <= Math.min(L.w - 1, p.x + 3); x++) L.explored[y * L.w + x] = 1; });
    await page.click('[data-open="map"]');
    await page.waitForTimeout(150);
    const m = await page.evaluate(() => { const b = document.querySelector('#ov-map .ov-body'); return { over: b.scrollHeight - b.clientHeight, note: document.querySelector('#map-legend').nextElementSibling.getBoundingClientRect().bottom }; });
    expect(m.over, 'the map body should not need scrolling').toBeLessThanOrEqual(0);
    expect(m.note, 'the note should end above the home bar').toBeLessThanOrEqual(844 - 34);
  });

  test('the map has a legend naming what the colours mean', async ({ page }) => {
    await startGame(page, { seed: 'aware-legend' });
    await clearBoons(page);
    await page.click('[data-open="map"]');
    const keys = page.locator('#map-legend .key');
    await expect(keys.first()).toBeVisible();
    expect(await keys.count()).toBeGreaterThan(6);
    await expect(page.locator('#map-legend')).toContainText('Stairs down');
    await expect(page.locator('#map-legend')).toContainText('Locked door');
    await expect(page.locator('#map-legend')).toContainText('You');
    // the ground walked is the lighter, as paths are on any map, and the walls darker
    const light = await page.evaluate(() => {
      const lum = label => { const k = [...document.querySelectorAll('#map-legend .key')].find(e => e.textContent.trim() === label); const [r, g, b] = getComputedStyle(k.querySelector('i')).backgroundColor.match(/\d+/g).map(Number); return 0.3 * r + 0.59 * g + 0.11 * b; };
      return { walked: lum('Explored'), wall: lum('Wall') };
    });
    expect(light.walked, 'walked ground should be lighter than wall').toBeGreaterThan(light.wall + 20);
  });

  test('walking into a wall says so', async ({ page }) => {
    await startGame(page, { seed: 'aware-bump' });
    await clearBoons(page);
    const said = await page.evaluate(async () => {
      const p = Game.player(), L = Game.level(), T = Dungeon.T;
      const [dx, dy] = Dungeon.DIRS[p.dir];
      L.tiles[(p.y + dy) * L.w + (p.x + dx)] = T.WALL;
      Game.input('forward');
      await new Promise(r => setTimeout(r, 200));
      return Game.state().log[Game.state().log.length - 1].m;
    });
    expect(said).toMatch(/wall blocks your path/i);
  });
});

test.describe('knowing what is hitting you', () => {
  test('an attack from behind says which way it came from', async ({ page }) => {
    await startGame(page, { seed: 'aware-behind' });
    await clearBoons(page);
    const result = await page.evaluate(async () => {
      const p = Game.player(), L = Game.level(), T = Dungeon.T;
      p.maxHp = 500; p.hp = 500;
      // put a bat directly behind the player, on open ground
      const back = Dungeon.DIRS[(p.dir + 2) % 4];
      const bx = p.x + back[0], by = p.y + back[1];
      L.tiles[by * L.w + bx] = T.FLOOR;
      L.monsters.length = 0;
      L.monsters.push({ uid: 4242, id: 'bat', x: bx, y: by, hp: 50, maxHp: 50, awake: true,
        nextAct: 0, rx: bx, ry: by, fromX: bx, fromY: by, moveT0: 0, moveT1: 0, flashUntil: 0 });
      for (let i = 0; i < 60; i++) {
        Game.update(i * 300, 300);
        const hit = Game.state().log.find(e => /Cave Bat/.test(e.m) && /(hits|misses) you/.test(e.m));
        if (hit) return { line: hit.m, attacker: Game.lastAttacker() };
      }
      return { line: null };
    });
    expect(result.line, 'the bat should have acted').not.toBeNull();
    expect(result.line, 'the message must say where it struck from').toMatch(/from behind/i);
  });

  test('a blow from out of sight lights a broad red glow on its side, held a while, and buzzes twice', async ({ page }) => {
    await page.addInitScript(() => { window.__buzz = []; navigator.vibrate = p => { window.__buzz.push(p); return true; }; });
    // (no tips: the first one holds the dungeon still, and the orc with it)
    await page.addInitScript(() => localStorage.setItem('deepdelve.tipsOff', '1'));
    await startGame(page, { seed: 'aware-side' });
    await clearBoons(page);
    const r = await page.evaluate(async () => {
      const p = Game.player(), L = Game.level(), T = Dungeon.T;
      p.maxHp = 500; p.hp = 500;
      // an orc on the left, awake and swinging
      const left = Dungeon.DIRS[(p.dir + 3) % 4];
      const lx = p.x + left[0], ly = p.y + left[1];
      L.tiles[ly * L.w + lx] = T.FLOOR;
      L.monsters.length = 0;
      L.monsters.push({ uid: 4343, id: 'orc', x: lx, y: ly, hp: 50, maxHp: 50, awake: true, nextAct: 0, rx: lx, ry: ly, fromX: lx, fromY: ly, moveT0: 0, moveT1: 0, flashUntil: 0 });
      const hp = p.hp;
      for (let i = 0; i < 200 && p.hp === hp; i++) await new Promise(res => setTimeout(res, 30));
      if (p.hp === hp) return null;
      const fx = Game.renderState(performance.now()).fx;
      return { from: fx.hurtFrom, held: fx.hurtFromUntil - performance.now(), buzz: window.__buzz.slice(-1)[0] };
    });
    expect(r, 'the orc should have landed a blow').not.toBeNull();
    expect(r.from, 'the glow should be on the left').toBe(3);
    expect(r.held, 'the glow should be held well over a second').toBeGreaterThan(1100);
    expect(r.buzz, 'a blow from out of sight buzzes twice').toEqual([40, 70, 40]);
    // and the glow reaches well into the view, not a hairline at its edge
    const red = await page.evaluate(() => {
      const c = document.querySelector('#view'), g = c.getContext('2d');
      const px = (x, y) => g.getImageData(Math.round(c.width * x), Math.round(c.height * y), 1, 1).data;
      const a = px(0.1, 0.5), b = px(0.5, 0.5);
      return { edge: a[0] - (a[1] + a[2]) / 2, mid: b[0] - (b[1] + b[2]) / 2 };
    });
    expect(red.edge, 'a tenth of the way in should still be reddened').toBeGreaterThan(red.mid + 15);
  });

  test('the death screen names the killer and shows the last moments', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'aware-death' });
    await clearBoons(page);
    await faceOpenGround(page, 2);
    await placeMonster(page, 'ogre', 1, { hp: 400, maxHp: 400, nextAct: 0 });
    await page.evaluate(() => { Game.player().hp = 1; });

    await expect.poll(() => page.evaluate(() => Game.state().status), { timeout: 15_000 }).toBe('dead');
    await expect(page.locator('#end-cause')).toContainText(/Killed by/i);
    await expect(page.locator('#end-cause')).toContainText(/Ogre/i);
    await expect(page.locator('#end-final')).toBeVisible();
    expect(await page.locator('#end-final-log p').count()).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });
});

test.describe('not wasting what you carry', () => {
  test('a known potion is refused at full health, and an unknown one is not', async ({ page }) => {
    await startGame(page, { seed: 'aware-waste' });
    await clearBoons(page);
    const result = await page.evaluate(() => {
      const p = Game.player(), G = Game.state();
      p.hp = p.maxHp;
      p.inv.length = 0;
      G.known.potion_heal = 1;
      p.inv.push({ t: 'potion_heal', q: 2, e: 0 });
      Game.useItem(p.inv[0]);
      const knownRefused = p.inv[0].q === 2;
      const knownMessage = G.log[G.log.length - 1].m;
      // an unidentified draught must still be drinkable, or refusing it would
      // tell the player what it is
      const unknownId = Object.keys(ITEMS).find(
        id => ITEMS[id].kind === 'potion' && ITEMS[id].effect === 'heal' && !G.known[id]);
      let unknownUsed = null;
      if (unknownId) {
        p.inv.push({ t: unknownId, q: 1, e: 0 });
        const n = p.inv.length;
        Game.useItem(p.inv[n - 1]);
        unknownUsed = p.inv.length < n || p.inv[n - 1].q === 0;
      }
      return { knownRefused, knownMessage, unknownId, unknownUsed };
    });
    expect(result.knownRefused, 'a known healing potion must not be drunk at full health').toBe(true);
    expect(result.knownMessage).toMatch(/unhurt/i);
    if (result.unknownId) {
      expect(result.unknownUsed, 'refusing an unknown potion would reveal what it is').toBe(true);
    }
  });

  test('a spell with no target costs nothing', async ({ page }) => {
    await startGame(page, { seed: 'aware-spell', cls: 3 });
    await clearBoons(page);
    const result = await page.evaluate(() => {
      const p = Game.player();
      p.maxSp = 40; p.sp = 40; p.hp = p.maxHp;
      Game.level().monsters.length = 0;
      const bolt = Game.knownSpells().find(s => s.kind === 'bolt');
      const cast = Game.castSpell(bolt);
      return { cast, sp: p.sp, said: Game.state().log[Game.state().log.length - 1].m };
    });
    expect(result.cast).toBe(false);
    expect(result.sp, 'no points should be spent').toBe(40);
    expect(result.said).toMatch(/nothing within reach/i);
  });
});

test.describe('not losing a run by accident', () => {
  test('starting a new run warns before replacing a saved hero', async ({ page }) => {
    await startGame(page, { seed: 'aware-save', name: 'Keepme' });
    await clearBoons(page);
    await page.evaluate(() => Game.save());
    await page.click('[data-open="menu"]');
    await page.click('#m-quit');
    await expect(page.locator('#screen-title')).toBeVisible();

    await page.click('#btn-new');
    await expect(page.locator('#screen-confirm')).toBeVisible();
    await expect(page.locator('#confirm-who')).toContainText('Keepme');
    await expect(page.locator('#screen-create')).not.toBeVisible();

    // keeping the old hero resumes that run rather than starting over
    await page.click('#confirm-keep');
    await expect(page.locator('#screen-game')).toBeVisible();
    expect(await page.evaluate(() => Game.player().name)).toBe('Keepme');
  });

  test('choosing to replace reaches character creation', async ({ page }) => {
    await startGame(page, { seed: 'aware-replace', name: 'Oldone' });
    await clearBoons(page);
    await page.evaluate(() => Game.save());
    await page.click('[data-open="menu"]');
    await page.click('#m-quit');
    await page.click('#btn-new');
    await page.click('#confirm-replace');
    await expect(page.locator('#screen-create')).toBeVisible();
  });
});

test.describe('being readable by assistive technology', () => {
  test('the chosen class, background and item announce their state', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-new');
    const chosen = page.locator('.class-card[aria-pressed="true"]');
    await expect(chosen).toHaveCount(1);
    await page.locator('.class-card[data-cls="thief"]').click();
    await expect(page.locator('.class-card[aria-pressed="true"]')).toContainText('Thief');
    await expect(page.locator('.bg-card[aria-pressed="true"]')).toHaveCount(1);

    await page.fill('#c-seed', 'aware-a11y');
    await page.click('#c-begin');
    await page.click('#pro-begin');
    await expect(page.locator('#screen-game')).toBeVisible();
    await clearBoons(page);
    await page.click('[data-open="inv"]');
    // a filled slot is a real button with a name, not a clickable div
    const slot = page.locator('#inv-grid button.slot.filled').first();
    await expect(slot).toBeVisible();
    await expect(slot).toHaveAttribute('aria-label', /.+/);
    await slot.click();
    await expect(slot).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('seeing the dice behind a swing', () => {
  test('the roll behind a swing is hidden on a first run, and the menu shows it in the message box and hides it again', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'roll-ui' });
    await clearBoons(page);
    await faceOpenGround(page, 2);
    const foe = await placeMonster(page, 'goblin', 1, { hp: 400, maxHp: 400 });
    expect(foe, 'needed open ground to put a goblin on').not.toBeNull();

    const swing = async () => page.evaluate(async () => {
      const p = Game.player(), G = Game.state();
      // count new lines by sequence, not by length: the log is capped
      const before = G.logSeq;
      for (let i = 0; i < 12; i++) { G.t = p.nextAttack; Game.input('attack'); }
      await new Promise(r => setTimeout(r, 120));
      const n = G.logSeq - before;
      return G.log.slice(-Math.min(n, G.log.length)).map(e => e.m);
    });

    // a first run shows the blow, not the arithmetic
    const first = await swing();
    expect(first.some(l => /^You (hit|miss) /.test(l)), 'the swing itself should be logged').toBe(true);
    expect(first.some(l => /d20/.test(l)), `a roll was shown on a first run: ${first.join(' | ')}`).toBe(false);

    // the menu turns it on
    await page.click('[data-open="menu"]');
    const btn = page.locator('#m-rolls');
    await expect(btn).toHaveText(/Combat rolls: Off/);
    await btn.click();
    await expect(btn).toHaveText(/Combat rolls: On/);
    await page.click('#ov-menu [data-close]');

    const loud = await swing();
    expect(loud.some(l => /\(d20 /.test(l)), `no roll in: ${loud.join(' | ')}`).toBe(true);
    // and it reaches the panel the player actually reads
    await expect(page.locator('#log')).toContainText(/d20/);

    // and off again
    await page.click('[data-open="menu"]');
    await expect(btn).toHaveText(/Combat rolls: On/);
    await btn.click();
    await expect(btn).toHaveText(/Combat rolls: Off/);
    await page.click('#ov-menu [data-close]');

    const quiet = await swing();
    expect(quiet.length, 'swings should still be reported').toBeGreaterThan(0);
    expect(quiet.some(l => /d20/.test(l)), `a roll survived the toggle: ${quiet.join(' | ')}`).toBe(false);
    expect(quiet.some(l => /^You (hit|miss) /.test(l)), 'the swing itself should still be logged').toBe(true);
    expect(errors).toEqual([]);
  });
});
