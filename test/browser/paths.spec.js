'use strict';
// The class paths: offered once, at level 5, in the level-up screen, and
// kept on the Hero sheet for the rest of the run.
const { test } = require('@playwright/test');
const { watchForErrors, startGame, clearBoons, expect } = require('./helpers');

test.describe('paths', () => {
  test('level 5 offers the two paths of the class, and the one taken is on the Hero sheet', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.addInitScript(() => localStorage.setItem('deepdelve.tipsOff', '1'));
    await startGame(page, { seed: 'path-ui', cls: 'Fighter' });
    await clearBoons(page);
    // one kill takes the hero from the first level to the fifth, as a big one can
    await page.evaluate(() => {
      const p = Game.player(), L = Game.level(), G = Game.state(); const [dx, dy] = Dungeon.DIRS[p.dir];
      L.monsters.length = 0; p.xp = XP_TABLE[4] - 1; p.perkHit = 60;
      L.monsters.push({ uid: 7, id: 'rat', x: p.x + dx, y: p.y + dy, hp: 1, maxHp: 1, awake: true, nextAct: 1e12, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 });
      for (let i = 0; i < 6 && L.monsters.length; i++) { G.t = p.nextAttack; Game.input('attack'); }
    });
    await expect(page.locator('#ov-boons')).toHaveClass(/open/);
    // the talents and the lesson of levels 2 to 4 come first, in order
    for (let i = 0; i < 3; i++) {
      await expect(page.locator('#boon-title')).toContainText(`Hero level ${i + 2}`);
      await page.locator('#boon-list .boon').first().click();
      // Self-Taught asks where its two points go first
      if (await page.locator('.spread-stat').count()) { await page.locator('.spread-stat').first().click(); await page.locator('.spread-stat').first().click(); }
    }
    await expect(page.locator('#boon-title')).toHaveText('Hero level 5: choose your path');
    const cards = page.locator('.boon.path');
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0).locator('b')).toHaveText('Knight');
    await expect(cards.nth(1).locator('b')).toHaveText('Berserker');
    // each says what it does: a line of flavour and its effects as a list
    await expect(cards.nth(1).locator('.path-flavour')).not.toBeEmpty();
    await expect(cards.nth(1).locator('.path-effects li')).toHaveCount(4);
    await expect(cards.nth(1)).toContainText('armour class');
    // it is for good, so one tap only marks the card and asks for a second
    await cards.nth(1).click();
    await expect(page.locator('#ov-boons')).toHaveClass(/open/);
    await expect(cards.nth(1)).toHaveClass(/armed/);
    await expect(cards.nth(1).locator('.path-confirm')).toHaveText('Tap again to take the Berserker\'s path');
    expect(await page.evaluate(() => Game.player().path || null)).toBeNull();
    // a tap on the other card moves the question there rather than choosing
    await cards.nth(0).click();
    await expect(cards.nth(0)).toHaveClass(/armed/);
    await expect(cards.nth(1)).not.toHaveClass(/armed/);
    await expect(page.locator('.path-confirm')).toHaveCount(1);
    expect(await page.evaluate(() => Game.player().path || null)).toBeNull();
    await cards.nth(1).click();
    await cards.nth(1).click();
    await expect(page.locator('#ov-boons')).not.toHaveClass(/open/);
    expect(await page.evaluate(() => Game.player().path)).toBe('berserker');
    await page.click('[data-open="char"]');
    const sheet = page.locator('#char-sheet');
    await expect(sheet.locator('.sheet-h', { hasText: /^Path$/ })).toBeVisible();
    await expect(sheet.locator('.path-sheet b')).toHaveText('Berserker');
    await expect(sheet.locator('.path-sheet .path-effects li')).toHaveCount(4);
    await expect(sheet).toContainText('Fighter, Berserker');
    expect(errors).toEqual([]);
  });

  test('a fighter with a blade in the off hand is told the Knight\'s first two powers need a shield', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.addInitScript(() => localStorage.setItem('deepdelve.tipsOff', '1'));
    await startGame(page, { seed: 'path-warn', cls: 'Fighter' });
    await clearBoons(page);
    await page.evaluate(() => {
      const p = Game.player(), L = Game.level(), G = Game.state(); const [dx, dy] = Dungeon.DIRS[p.dir];
      p.eq.shield = null; p.eq.offhand = { t: 'dagger', q: 1, e: 0 };
      L.monsters.length = 0; p.xp = XP_TABLE[4] - 1; p.perkHit = 60;
      L.monsters.push({ uid: 8, id: 'rat', x: p.x + dx, y: p.y + dy, hp: 1, maxHp: 1, awake: true, nextAct: 1e12, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 });
      for (let i = 0; i < 6 && L.monsters.length; i++) { G.t = p.nextAttack; Game.input('attack'); }
    });
    for (let i = 0; i < 3; i++) {
      await expect(page.locator('#boon-title')).toContainText(`Hero level ${i + 2}`);
      await page.locator('#boon-list .boon').first().click();
    }
    await expect(page.locator('.boon.path')).toHaveCount(2, { timeout: 3000 });
    await expect(page.locator('.boon.path').nth(0).locator('.path-warn')).toHaveText('Your off hand holds a blade: the first two need a shield.');
    await expect(page.locator('.boon.path').nth(1).locator('.path-warn')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('before level 5 the Hero sheet says which paths are ahead', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.addInitScript(() => localStorage.setItem('deepdelve.tipsOff', '1'));
    await startGame(page, { seed: 'path-ahead', cls: 'Mage' });
    await clearBoons(page);
    await page.click('[data-open="char"]');
    await expect(page.locator('#char-sheet')).toContainText('At hero level 5 you choose your path: Pyromancer or Frostweaver.');
    expect(errors).toEqual([]);
  });
});
