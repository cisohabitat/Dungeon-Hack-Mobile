'use strict';
// What the player is allowed to walk into. A torch is set into the wall, so it
// must stop you exactly as the wall around it does.
const { test } = require('@playwright/test');
const { expect, watchForErrors, startGame, clearBoons } = require('./helpers');

test.describe('movement', () => {
  test('a wall torch stops the player like any other wall', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'move-torch' });
    await clearBoons(page);

    const result = await page.evaluate(async () => {
      const p = Game.player(), L = Game.level(), T = Dungeon.T;
      const [dx, dy] = Dungeon.DIRS[p.dir];
      const tx = p.x + dx, ty = p.y + dy;
      L.tiles[ty * L.w + tx] = T.TORCH;
      const from = { x: p.x, y: p.y, steps: p.steps };
      Game.input('forward');
      await new Promise(r => setTimeout(r, 300));
      return { x: p.x, y: p.y, from, tookAStep: p.steps !== from.steps };
    });

    expect(result.x, 'the player must not enter the torch').toBe(result.from.x);
    expect(result.y).toBe(result.from.y);
    expect(result.tookAStep, 'bumping a wall is not a step').toBe(false);
    expect(errors).toEqual([]);
  });

  test('facing a torch and pressing use searches it like stonework', async ({ page }) => {
    await startGame(page, { seed: 'move-torch-use' });
    await clearBoons(page);
    const message = await page.evaluate(() => {
      const p = Game.player(), L = Game.level(), T = Dungeon.T;
      const [dx, dy] = Dungeon.DIRS[p.dir];
      L.tiles[(p.y + dy) * L.w + (p.x + dx)] = T.TORCH;
      Game.input('use');
      return Game.state().log[Game.state().log.length - 1].m;
    });
    expect(message).toMatch(/search the wall/i);
  });

  test('every tile type either blocks the player or is meant to be entered', async ({ page }) => {
    await startGame(page, { seed: 'move-tiles' });
    await clearBoons(page);
    const wrong = await page.evaluate(async () => {
      const walkable = new Set(['FLOOR', 'DOOR_OPEN']);
      const bad = [];
      const p = Game.player(), L = Game.level();
      const home = { x: p.x, y: p.y };
      for (const [name, value] of Object.entries(Dungeon.T)) {
        if (name === 'STAIRS_DOWN' || name === 'STAIRS_UP') continue;   // these change level
        p.x = home.x; p.y = home.y;
        const [dx, dy] = Dungeon.DIRS[p.dir];
        const tx = p.x + dx, ty = p.y + dy;
        const was = L.tiles[ty * L.w + tx];
        L.tiles[ty * L.w + tx] = value;
        Game.input('forward');
        await new Promise(r => setTimeout(r, 260));
        const entered = p.x !== home.x || p.y !== home.y;
        L.tiles[ty * L.w + tx] = was;
        if (entered !== walkable.has(name)) bad.push(`${name}: entered=${entered}`);
      }
      return bad;
    });
    expect(wrong).toEqual([]);
  });
  test('one tap on a turn button turns a quarter, however long the finger rests on it', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'turn-tap' });
    await clearBoons(page);
    for (const [act, step] of [['left', 3], ['right', 1]]) {
      for (const hold of [40, 150, 190]) {
        const d0 = await page.evaluate(() => Game.player().dir);
        const box = await page.locator(`.ctl[data-act="${act}"]`).boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.waitForTimeout(hold);
        await page.mouse.up();
        await page.waitForTimeout(700);
        const d1 = await page.evaluate(() => Game.player().dir);
        expect(`${act} held ${hold}ms: ${d1}`).toBe(`${act} held ${hold}ms: ${(d0 + step) % 4}`);
      }
    }
    expect(errors).toEqual([]);
  });
  test('holding a turn button turns once and no further', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'turn-hold' });
    await clearBoons(page);
    for (const [act, step] of [['right', 1], ['left', 3]]) {
      const d0 = await page.evaluate(() => Game.player().dir);
      const box = await page.locator(`.ctl[data-act="${act}"]`).boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(1500);
      await page.mouse.up();
      await page.waitForTimeout(300);
      expect(await page.evaluate(() => Game.player().dir)).toBe((d0 + step) % 4);
    }
    // walking still repeats while held
    const steps0 = await page.evaluate(() => Game.player().steps);
    await page.evaluate(() => { const p = Game.player(), L = Game.level(); for (let r = 0; r < 4; r++) { for (let i = 1; i <= 6; i++) { const [dx, dy] = Dungeon.DIRS[p.dir]; const x = p.x + dx * i, y = p.y + dy * i; if (x > 0 && y > 0 && x < L.w - 1 && y < L.h - 1) L.tiles[y * L.w + x] = Dungeon.T.FLOOR; } } L.monsters.length = 0; });
    const fwd = await page.locator('.ctl[data-act="forward"]').boundingBox();
    await page.mouse.move(fwd.x + fwd.width / 2, fwd.y + fwd.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(1200);
    await page.mouse.up();
    expect(await page.evaluate(() => Game.player().steps) - steps0).toBeGreaterThanOrEqual(3);
    expect(errors).toEqual([]);
  });
});
