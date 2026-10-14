'use strict';
// The shallows' own creatures, one for each of the first four floors: drawn
// with their poses, and the glimmer moth's flare shown on the hero.
const { test } = require('@playwright/test');
const { watchForErrors, startGame, clearBoons, faceOpenGround, placeMonster, expect } = require('./helpers');

test.describe('the shallows', () => {
  test('the four are painted with a wind-up, a trick and a flinch of their own', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto('/');
    await page.waitForSelector('#btn-new', { state: 'visible' });
    await page.evaluate(() => Assets.paintFirst(['moth', 'thornhog', 'imp', 'pikeman', 'cutpurse', 'lookout', 'hexer']));
    await expect.poll(() => page.evaluate(() => ['moth', 'thornhog', 'imp', 'pikeman', 'cutpurse', 'lookout', 'hexer'].filter(k => { const s = Assets.sprites[k]; return !(s.w > 0 && s.windup && s.special && s.hurt && s.stepA); })), { timeout: 40_000 }).toEqual([]);
    // the moth beats its own wings rather than walking, and casts no shadow on the floor
    expect(await page.evaluate(() => MONSTERS.moth.fly > 0)).toBe(true);
    expect(errors).toEqual([]);
  });

  test('a glimmer moth\'s flare dazzles a hero looking at it: the bar says so until it fades, and one turned away is spared', async ({ page }) => {
    test.setTimeout(60_000);
    const errors = watchForErrors(page);
    await startGame(page);
    await clearBoons(page);
    await faceOpenGround(page, 3);
    await page.evaluate(() => { const p = Game.player(); p.hp = p.maxHp = 999; });
    const flare = async () => {
      const m = await placeMonster(page, 'moth', 2, { hp: 50, maxHp: 50 });
      expect(m).not.toBeNull();
      await page.evaluate(uid => { const G = Game.state(), L = Game.level(); const o = L.monsters.find(q => q.uid === uid); L.monsters.splice(0, L.monsters.length, o); o.windup = { kind: 'move', move: 'dazzle', at: G.t, until: G.t + 400 }; o.nextAct = o.windup.until; }, m.uid);
      return m;
    };
    await flare();
    await expect(page.locator('#hud-status')).toContainText('Dazzled', { timeout: 5_000 });
    await expect(page.locator('#hud-status')).not.toContainText('Dazzled', { timeout: 8_000 });
    // turned away, the light washes over the hero's back
    await page.evaluate(() => { Game.level().monsters.length = 0; });
    await flare();
    await page.evaluate(() => Game.input('left'));
    await expect.poll(() => page.evaluate(() => { const p = Game.player(); return !!(p.opening && p.opening.until > Game.state().t); }), { timeout: 5_000 }).toBe(true);
    await expect(page.locator('#hud-status')).not.toContainText('Dazzled');
    expect(errors).toEqual([]);
  });

  test('a goblin hexer\'s hex shows on the bar: Slowed on a hero who has cast nothing, until it lifts', async ({ page }) => {
    test.setTimeout(60_000);
    const errors = watchForErrors(page);
    await startGame(page);
    await clearBoons(page);
    await faceOpenGround(page, 3);
    await page.evaluate(() => { const p = Game.player(); p.hp = p.maxHp = 999; p.stats.wis = 1; Game.state().lastSpell = null; });
    const m = await placeMonster(page, 'hexer', 2, { hp: 50, maxHp: 50 });
    expect(m).not.toBeNull();
    await page.evaluate(uid => { const G = Game.state(), L = Game.level(); const o = L.monsters.find(q => q.uid === uid); L.monsters.splice(0, L.monsters.length, o); o.windup = { kind: 'move', move: 'hex', at: G.t, until: G.t + 400 }; o.nextAct = o.windup.until; }, m.uid);
    await expect(page.locator('#hud-status')).toContainText('Slowed', { timeout: 5_000 });
    await page.evaluate(() => { Game.level().monsters.length = 0; });
    await expect(page.locator('#hud-status')).not.toContainText('Slowed', { timeout: 9_000 });
    expect(errors).toEqual([]);
  });
});
