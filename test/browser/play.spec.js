'use strict';
// The core loop: make a character, walk, fight, descend, save, die.
const { test } = require('@playwright/test');
const { expect, watchForErrors, startGame, clearBoons, faceOpenGround, placeMonster, killMonster } = require('./helpers');

test.describe('core play', () => {
  test('a new character can move, and every step is drawn without error', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'play-move', name: 'Tester' });

    const before = await page.evaluate(() => Game.player().steps);
    for (let i = 0; i < 3; i++) { await page.keyboard.press('ArrowUp'); await page.waitForTimeout(260); }
    await page.keyboard.press('KeyA');
    await page.waitForTimeout(260);
    const after = await page.evaluate(() => ({ steps: Game.player().steps, dir: Game.player().dir }));

    expect(after.steps).toBeGreaterThan(before);
    expect(errors).toEqual([]);
  });

  test('attacking an adjacent monster kills it and grants experience', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'play-fight' });
    await faceOpenGround(page, 2);

    const placed = await placeMonster(page, 'goblin', 1, { hp: 6, maxHp: 6 });
    expect(placed, 'a monster should fit in front of the player').not.toBeNull();

    const xpBefore = await page.evaluate(() => Game.player().xp);
    expect(await killMonster(page, placed.uid)).toBe(true);
    await clearBoons(page);

    const after = await page.evaluate(() => ({ xp: Game.player().xp, kills: Game.player().kills }));
    expect(after.xp).toBeGreaterThan(xpBefore);
    expect(after.kills).toBe(1);
    expect(errors).toEqual([]);
  });

  test('a melee weapon cannot reach a monster three tiles away', async ({ page }) => {
    await startGame(page, { seed: 'play-reach' });
    await faceOpenGround(page, 4);
    const placed = await placeMonster(page, 'goblin', 3, { hp: 40, maxHp: 40 });
    test.skip(!placed, 'no straight corridor on this seed');

    const damage = await page.evaluate(async (uid) => {
      const L = Game.level(), p = Game.player();
      const m = L.monsters.find(x => x.uid === uid);
      // make sure a melee weapon is in hand
      const sword = p.inv.find(i => ITEMS[i.t] && ITEMS[i.t].kind === 'weapon' && !ITEMS[i.t].range);
      if (sword) Game.equip(sword);
      const before = m.hp;
      for (let i = 0; i < 8; i++) { p.nextAttack = 0; Game.input('attack'); await new Promise(r => setTimeout(r, 40)); }
      return before - m.hp;
    }, placed.uid);

    expect(damage, 'melee must not reach across three tiles').toBe(0);
  });

  test('descending generates the next level and keeps the game playable', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'play-descend' });

    const result = await page.evaluate(async () => {
      const G = Game.state(), p = G.player, L = Game.level();
      p.x = L.downStart.x; p.y = L.downStart.y; p.dir = (L.downStart.dir + 2) % 4;
      Game.input('forward');
      await new Promise(r => setTimeout(r, 300));
      return { depth: G.depth, monsters: Game.level().monsters.length, status: G.status };
    });

    expect(result.depth).toBe(2);
    expect(result.monsters).toBeGreaterThan(0);
    expect(result.status).toBe('playing');
    expect(errors).toEqual([]);
  });

  test('a save reloads to exactly the same position and pack', async ({ page }) => {
    await startGame(page, { seed: 'play-save' });
    const same = await page.evaluate(() => {
      const snap = () => JSON.stringify({
        d: Game.state().depth, x: Game.player().x, y: Game.player().y,
        hp: Game.player().hp, inv: Game.player().inv.length, gold: Game.player().gold,
      });
      const before = snap();
      if (!Game.save()) return 'save refused';
      if (!Game.load()) return 'load refused';
      return before === snap() ? true : `drifted: ${before} -> ${snap()}`;
    });
    expect(same).toBe(true);
  });

  test('running out of hit points ends the run and records the hero', async ({ page }) => {
    await startGame(page, { seed: 'play-death' });
    await faceOpenGround(page, 2);
    await placeMonster(page, 'ogre', 1, { hp: 400, maxHp: 400, nextAct: 0 });

    await page.evaluate(() => { Game.player().hp = 1; });
    await expect.poll(
      () => page.evaluate(() => Game.state().status),
      { timeout: 15_000 },
    ).toBe('dead');

    await expect(page.locator('#screen-end')).toBeVisible();
    await expect(page.locator('#end-title')).toHaveText(/DIED/i);
    const hall = await page.evaluate(() => Game.hall().length);
    expect(hall).toBeGreaterThan(0);
  });
});
