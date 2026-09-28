'use strict';
// What the view draws: walls that match what the floor says of them, the
// weapon in the hero's hands, and a monster right in front of them.
const { test } = require('@playwright/test');
const { watchForErrors, startGame, clearBoons, faceOpenGround, placeMonster, expect } = require('./helpers');

test.describe('art', () => {
  test('pictures the title does not need wait to be painted, arrive whole when asked for, and are all painted soon after', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto('/');
    await page.waitForSelector('#btn-new', { state: 'visible' });
    const waiting = () => page.evaluate(() => Object.keys(Assets.sprites).filter(k => typeof Object.getOwnPropertyDescriptor(Assets.sprites, k).get === 'function'));
    // the title keeps its start quick: the pack's pictures are not among what it painted
    const first = await waiting();
    expect(first.length, 'some pictures should still be waiting at the title').toBeGreaterThan(20);
    // one asked for early is painted there and then, whole
    const one = first.find(k => /sword/.test(k)) || first[0];
    const got = await page.evaluate(k => { const s = Assets.sprites[k]; return { w: s.w, h: s.h, url: typeof s.url === 'string' && s.url.length > 30, painted: typeof Object.getOwnPropertyDescriptor(Assets.sprites, k).get !== 'function' }; }, one);
    expect(got.w).toBeGreaterThan(0);
    expect(got).toMatchObject({ url: true, painted: true });
    // and the rest are painted in the time to spare, well before a first floor
    await expect.poll(async () => (await waiting()).length, { timeout: 15_000 }).toBe(0);
    expect(errors).toEqual([]);
  });

  test('walls said to be black glass are drawn as glass, not the brick of the other floors', async ({ page }) => {
    // floor 8 said "black glass walls" over the same grey courses as floor 1
    const errors = watchForErrors(page);
    await page.goto('/');
    await page.waitForFunction(() => typeof Assets !== 'undefined' && Assets.themes.length > 0);
    const out = await page.evaluate(() => {
      // how much of a row the brick layout gives to mortar is mortar here
      const mortarShare = (i, y) => {
        const t = Assets.themes[i], c = t.wall, d = c.getContext('2d').getImageData(0, y, c.width, 1).data;
        const n = parseInt(THEMES[i].mortar.slice(1), 16), m = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
        let k = 0;
        for (let x = 0; x < c.width; x++) if (Math.abs(d[x * 4] - m[0]) + Math.abs(d[x * 4 + 1] - m[1]) + Math.abs(d[x * 4 + 2] - m[2]) < 6) k++;
        return k / c.width;
      };
      return THEMES.map((th, i) => ({ name: th.name, glass: /glass/i.test(th.flavor), face: th.face || 'brick', bricks: mortarShare(i, 8) }));
    });
    expect(out.filter(t => t.glass).length, 'a floor speaks of black glass').toBeGreaterThan(0);
    for (const t of out) {
      if (t.glass) expect(t.bricks, `${t.name} should not be laid in brick courses`).toBeLessThan(0.3);
      // the roads' walls (bone, dug earth) are not brick either
      else if (t.face !== 'brick') expect(t.bricks, `${t.name} should not be laid in brick courses`).toBeLessThan(0.8);
      else expect(t.bricks, `${t.name} is brick, with a course of mortar`).toBeGreaterThan(0.8);
    }
    expect(errors).toEqual([]);
  });

  test('the two-handed sword is held in both fists, and is a far bigger blade than the long sword', async ({ page }) => {
    // it was drawn one-handed, and at a long sword's size looked like one
    const errors = watchForErrors(page);
    await page.goto('/');
    await page.waitForFunction(() => typeof Assets !== 'undefined' && Assets.themes.length > 0);
    const out = await page.evaluate(() => {
      const inked = fr => { const d = fr.img.getContext('2d').getImageData(0, 0, fr.img.width, fr.img.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; };
      const long = Assets.held('longsword', 'rest', 'fighter', false);
      const great = Assets.held('greatsword', 'rest', 'fighter', true), oneFist = Assets.held('greatsword', 'rest', 'fighter', false);
      return { longH: long.img.height, greatH: great.img.height, long: inked(long), great: inked(great), oneFist: inked(oneFist) };
    });
    expect(out.greatH / out.longH, 'taller in the hand than a long sword').toBeGreaterThan(1.3);
    expect(out.great / out.long, 'and much more of it').toBeGreaterThan(1.5);
    expect(out.great, 'a second fist on the grip').toBeGreaterThan(out.oneFist * 1.05);
    // and in the view it is the two-handed grip that is drawn
    await startGame(page, { seed: 'two-hands', cls: 'Fighter' });
    await clearBoons(page);
    const two = await page.evaluate(() => { const p = Game.player(); p.eq.weapon = { t: 'greatsword', q: 1, e: 0 }; p.eq.shield = null; return Game.renderState(performance.now()).fx.view; });
    expect(two && two.two, 'the view is told it takes both hands').toBe(true);
    expect(errors).toEqual([]);
  });

  for (const [label, vp] of Object.entries({ sideways: { width: 851, height: 393 }, upright: { width: 393, height: 851 } })) {
    test(`the lich right in front fits under its bar and is drawn finely, held ${label}`, async ({ page }) => {
      // point-blank it grew past the top of the view, head cut off, each of
      // its pixels a block four of the view's wide
      const errors = watchForErrors(page);
      await page.addInitScript(() => localStorage.setItem('deepdelve.tipsOff', '1'));
      await page.setViewportSize(vp);
      await startGame(page, { seed: 'lich-near', cls: 'Fighter' });
      await clearBoons(page);
      await page.evaluate(() => { Game.level().monsters.length = 0; });
      expect(await faceOpenGround(page, 2)).toBeGreaterThanOrEqual(1);
      expect(await placeMonster(page, 'lich', 1, { hp: 300, maxHp: 300 })).not.toBeNull();
      await page.waitForTimeout(600);
      const seen = await page.evaluate(() => Renderer.shown.filter(c => c.dist < 1.5));
      expect(seen.length, 'the lich is drawn').toBe(1);
      expect(seen[0].top, 'its crown below the top edge, and below the bar').toBeGreaterThanOrEqual(26);
      expect(seen[0].texel, 'drawn from the finer painting, not blown up').toBeLessThan(2);
      expect(errors).toEqual([]);
    });
  }
  test('held sideways, the warning mark over a big one close in stands beside its head, not on its face', async ({ page }) => {
    // pushed down under the lich's bar, the mark sat on its skull with the misses written over it
    const errors = watchForErrors(page);
    await page.addInitScript(() => localStorage.setItem('deepdelve.tipsOff', '1'));
    await page.setViewportSize({ width: 851, height: 393 });
    await startGame(page, { seed: 'lich-mark', cls: 'Fighter' });
    await clearBoons(page);
    await page.evaluate(() => { Game.level().monsters.length = 0; });
    expect(await faceOpenGround(page, 3)).toBeGreaterThanOrEqual(2);
    expect(await placeMonster(page, 'lich', 2, { hp: 300, maxHp: 300 })).not.toBeNull();
    await page.evaluate(() => { const m = Game.level().monsters[0], G = Game.state(); m.nextAct = 1e12; m.windup = { at: G.t, until: G.t + 60000 }; });
    await page.waitForTimeout(600);
    const seen = await page.evaluate(() => Renderer.shown.filter(c => c.dist < 2.5 && c.markX != null));
    expect(seen.length, 'the lich is drawn with its mark').toBe(1);
    const c = seen[0];
    // the mark clear of the middle of the drawing, where the face is, or above the drawing altogether
    const clear = Math.abs(c.markX - c.midX) - c.markSize * 0.62 >= c.width * 0.18 || c.markY <= c.top;
    expect(clear, `mark at ${Math.round(c.markX)},${Math.round(c.markY)}; the lich's middle ${Math.round(c.midX)}, top ${Math.round(c.top)}, width ${Math.round(c.width)}`).toBe(true);
    expect(c.markX + c.markSize * 0.62, 'the mark stays in the view').toBeLessThanOrEqual(await page.evaluate(() => Renderer.W));
    expect(errors).toEqual([]);
  });
  for (const [label, vp] of Object.entries({ sideways: { width: 844, height: 390 }, upright: { width: 390, height: 844 } })) {
    test(`a creature right in front stands with its feet in the view, held ${label}`, async ({ page }) => {
      // sideways the view is short, and one a square off stood with its feet below the bottom edge
      const errors = watchForErrors(page);
      await page.addInitScript(() => localStorage.setItem('deepdelve.tipsOff', '1'));
      await page.setViewportSize(vp);
      await startGame(page, { seed: 'feet-in-view', cls: 'Fighter' });
      await clearBoons(page);
      await page.evaluate(() => { Game.level().monsters.length = 0; });
      expect(await faceOpenGround(page, 2)).toBeGreaterThanOrEqual(1);
      expect(await placeMonster(page, 'goblin', 1, { hp: 300, maxHp: 300, nextAct: 1e12 })).not.toBeNull();
      await page.waitForTimeout(600);
      const seen = await page.evaluate(() => Renderer.shown.filter(c => c.dist < 1.5));
      expect(seen.length, 'the goblin is drawn').toBe(1);
      expect(seen[0].bottom, 'its feet inside the view').toBeLessThanOrEqual(await page.evaluate(() => Renderer.H));
      expect(errors).toEqual([]);
    });
  }
  test('on a portrait phone the view stands taller than it is wide, and a room\'s dressing is drawn in it', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });   // a tall phone, where the log used to take the room
    await startGame(page, { seed: 'art-dress' });
    await clearBoons(page);
    const box = await page.locator('#view').boundingBox();
    expect(box.height / box.width, 'the view takes the room the log gave up').toBeGreaterThan(1.05);
    // stand facing a piece of dressing from two squares off, and it is among what the view draws
    const found = await page.evaluate(() => {
      const L = Game.level(), p = Game.player(), D = Dungeon.DIRS;
      for (const d of L.dressing || []) {
        if (d.k === 'puddle') continue;
        for (let k = 0; k < 4; k++) {
          const [dx, dy] = D[k], x = d.x - dx * 2, y = d.y - dy * 2;
          if ([1, 2].every(i => L.tiles[(d.y - dy * i) * L.w + d.x - dx * i] === Dungeon.T.FLOOR)) {
            p.x = x; p.y = y; p.dir = k; L.monsters.length = 0;
            Game.save(true); Game.load();
            return d.k;
          }
        }
      }
      return null;
    });
    expect(found, 'floor 1 has dressing to face').not.toBeNull();
    await page.waitForTimeout(300);
    // the drawn view has the dressing's own colours somewhere in its lower half
    const drawn = await page.evaluate(() => Renderer.drawnDressing());
    expect(drawn).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });
  for (const [label, vp] of Object.entries({ sideways: { width: 844, height: 390 }, narrow: { width: 360, height: 740 } })) {
    test(`a ranger's bow and drawing hand leave an item one square ahead in plain sight, held ${label}`, async ({ page }) => {
      // the drawing hand used to rest over the middle of the floor, right on a
      // ring or a coin lying one square ahead
      const errors = watchForErrors(page);
      await page.addInitScript(() => {
        localStorage.setItem('deepdelve.tipsOff', '1');
        localStorage.setItem('deepdelve.calm', '1');   // no sway, bob or flicker: frames can be compared
        localStorage.setItem('deepdelve.progress', JSON.stringify({ won: { fighter: { easy: 1 }, cleric: { normal: 1 }, mage: { hard: 1 }, thief: { easy: 1 } }, relics: [] }));
      });
      await page.setViewportSize(vp);
      await startGame(page, { seed: 'bow-clear', cls: 'Ranger' });
      await clearBoons(page);
      // the pixels of the item that show, found as what changes when it is taken away
      const itemPixels = async () => page.evaluate(async () => {
        const L = Game.level(), p = Game.player(), [dx, dy] = Dungeon.DIRS[p.dir];
        const key = (p.x + dx) + ',' + (p.y + dy), c = /** @type {HTMLCanvasElement} */ (document.getElementById('view'));
        const frame = async () => { await new Promise(r => setTimeout(r, 250)); return c.getContext('2d').getImageData(0, 0, c.width, c.height).data; };
        L.items[key] = [{ t: 'ring_protect' }];
        const withIt = await frame();
        delete L.items[key];
        const without = await frame();
        let n = 0;
        for (let i = 0; i < withIt.length; i += 4) if (Math.abs(withIt[i] - without[i]) + Math.abs(withIt[i + 1] - without[i + 1]) + Math.abs(withIt[i + 2] - without[i + 2]) > 24) n++;
        return n;
      });
      await page.evaluate(() => {
        const L = Game.level(), p = Game.player(), [dx, dy] = Dungeon.DIRS[p.dir];
        for (const k of [1, 2, 3]) L.tiles[(p.y + dy * k) * L.w + p.x + dx * k] = Dungeon.T.FLOOR;
        L.monsters.length = 0; L.dressing = []; L.npcs = [];
      });
      expect(await page.evaluate(() => Game.player().eq.weapon.t)).toBe('shortbow');
      const behindBow = await itemPixels();
      // and the same ring with the bow put away, a bare fist low on the right
      await page.evaluate(() => { Game.player().eq.weapon = null; });
      const clear = await itemPixels();
      expect(clear, 'the ring is drawn at all').toBeGreaterThan(40);
      expect(behindBow / clear, `the bow hid ${clear - behindBow} of the ring's ${clear} pixels`).toBeGreaterThan(0.95);
      expect(errors).toEqual([]);
    });
  }
  test('candles left burning light the floor around them, a smaller pool than a torch\'s', async ({ page }) => {
    // they were drawn alight but gave no light at all
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'candle-light' });
    const lit = await page.evaluate(() => {
      const room = (lights, dressing) => ({ w: 20, h: 20, lights, dressing });
      const candles = room([], [{ x: 10, y: 10, k: 'candles', ox: 0, oy: 0 }, { x: 4, y: 4, k: 'bones', ox: 0, oy: 0 }]);
      const torch = room([{ x: 10, y: 10 }], []);
      const dark = room([], [{ x: 10, y: 10, k: 'bones', ox: 0, oy: 0 }]);
      const at = (lv, x, y) => Renderer.lightOf(lv, x, y);
      return { on: at(candles, 10, 10), near: at(candles, 12, 10), far: at(candles, 14, 10), bones: at(candles, 4, 4), torch: at(torch, 10, 10), torchFar: at(torch, 14, 10), dark: at(dark, 10, 10) };
    });
    expect(lit.dark, 'bones give no light').toBe(0);
    expect(lit.bones).toBe(0);
    expect(lit.on, 'the candles\' own square is lit').toBeGreaterThan(0.5);
    expect(lit.near, 'and the squares beside them, less').toBeGreaterThan(0);
    expect(lit.near).toBeLessThan(lit.on);
    expect(lit.far, 'four squares off is dark again').toBe(0);
    expect(lit.torch, 'a torch is the brighter').toBeGreaterThan(lit.on);
    expect(lit.torchFar, 'and reaches further').toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });
  test('a creature standing on a pile of things is drawn in front of all of it', async ({ page }) => {
    // a gem scattered to the near side of its square came out over the orc standing on it
    const errors = watchForErrors(page);
    await page.addInitScript(() => localStorage.setItem('deepdelve.tipsOff', '1'));
    await startGame(page, { seed: 'pile-under' });
    await clearBoons(page);
    expect(await faceOpenGround(page, 2)).toBeGreaterThanOrEqual(1);
    const order = await page.evaluate(async () => {
      const L = Game.level(), p = Game.player(), [dx, dy] = Dungeon.DIRS[p.dir], x = p.x + dx, y = p.y + dy;
      L.monsters.length = 0; L.dressing = []; L.items = {};
      L.items[x + ',' + y] = ['gem', 'potion_heal', 'dagger', 'ration', 'gold'].map(t => (t === 'gem' ? { t, q: 50, name: 'Garnet' } : { t, q: t === 'gold' ? 10 : 1 }));
      L.monsters.push({ uid: 5, id: 'orc', x, y, hp: 99, maxHp: 99, awake: true, nextAct: 1e12, rx: x, ry: y, fromX: x, fromY: y, moveT0: 0, moveT1: 0, flashUntil: 0 });
      await new Promise(r => setTimeout(r, 300));
      return Renderer.order;
    });
    expect(order.filter(k => k === 'floor').length, 'the pile is drawn').toBeGreaterThanOrEqual(5);
    expect(order[order.length - 1], 'the orc last, over everything under it').toBe('stand');
    expect(errors).toEqual([]);
  });
});
