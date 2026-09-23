'use strict';
// The story layer: prologue, backgrounds, level-up choices, journal, epilogue.
const { test } = require('@playwright/test');
const { expect, watchForErrors, startGame, faceOpenGround, placeMonster, killMonster } = require('./helpers');

test.describe('story and progression', () => {
  test('choosing a background changes the stated advantage', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-new');
    const first = await page.textContent('#c-bg-perk');
    await page.locator('.bg-card', { hasText: 'The Debtor' }).click();
    const second = await page.textContent('#c-bg-perk');
    expect(second).not.toBe(first);
    expect(second).toMatch(/gold/i);
  });

  test('the prologue runs before the first stair and names your background', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto('/');
    await page.click('#btn-new');
    await page.locator('.bg-card', { hasText: 'The Debtor' }).click();
    await page.fill('#c-seed', 'story-prologue');
    await page.click('#c-begin');

    await expect(page.locator('#screen-prologue')).toBeVisible();
    await expect(page.locator('#pro-who')).toHaveText('The Debtor');
    await expect(page.locator('#pro-world p')).toHaveCount(4);
    await expect(page.locator('#screen-game')).not.toBeVisible();

    await page.click('#pro-begin');
    await expect(page.locator('#screen-game')).toBeVisible();
    const started = await page.evaluate(() => ({ bg: Game.player().bg, gold: Game.player().gold }));
    expect(started.bg).toBe('debtor');
    expect(started.gold, 'the Debtor is paid in advance').toBe(150);
    expect(errors).toEqual([]);
  });

  test('levelling offers three choices, blocks play, and changes the character', async ({ page }) => {
    await startGame(page, { seed: 'story-boons' });
    await faceOpenGround(page, 2);
    const placed = await placeMonster(page, 'goblin', 1, { hp: 1, maxHp: 1 });
    expect(placed).not.toBeNull();

    // one level up: level 2 now brings a lesson (a talent waits for level 3)
    await page.evaluate(() => { Game.player().xp = XP_TABLE[1] - 1; });
    expect(await killMonster(page, placed.uid)).toBe(true);
    await page.waitForTimeout(150);

    await expect(page.locator('#ov-boons')).toHaveClass(/open/);
    await expect(page.locator('#boon-list .boon')).toHaveCount(3);

    // the choice cannot be dodged
    await page.keyboard.press('Escape');
    await expect(page.locator('#ov-boons')).toHaveClass(/open/);
    expect(await page.evaluate(() => Game.chooseBoon('not-a-real-boon'))).toBe(false);

    const before = await page.evaluate(() => JSON.stringify(Game.player().stats) + Game.player().maxHp);
    await page.locator('#boon-list .boon').first().click();
    await page.waitForTimeout(120);

    const after = await page.evaluate(() => ({
      sig: JSON.stringify(Game.player().stats) + Game.player().maxHp,
      boons: Game.player().boons || [],
      perks: (Game.player().perkHit || 0) + (Game.player().perkSpeed || 0) + (Game.player().perkRegen || 0),
      open: document.querySelector('#ov-boons').classList.contains('open'),
    }));
    expect(after.boons).toHaveLength(1);
    expect(after.sig !== before || after.perks > 0, 'the choice must do something').toBe(true);
    expect(after.open, 'the overlay closes once the choice is made').toBe(false);
  });

  test('a journal page is recorded once and shown in the journal', async ({ page }) => {
    await startGame(page, { seed: 'story-journal' });
    const picked = await page.evaluate(() => {
      const L = Game.level(), p = Game.player();
      let key = null;
      for (const k in L.items) if (L.items[k].some(i => i.t === 'page')) key = k;
      if (!key) return null;
      const [x, y] = key.split(',').map(Number);
      p.x = x; p.y = y;
      const page0 = L.items[key].find(i => i.t === 'page');
      Game.takeItem(page0);
      Game.takeItem(page0);                 // a second pickup must not double count
      return { entries: Game.journal().length, total: Game.pagesInDungeon(), levels: Game.state().opts.levels, archive: JOURNAL.length };
    });
    expect(picked, 'every level should carry one page').not.toBeNull();
    expect(picked.entries).toBe(1);

    await page.click('[data-open="journal"]');
    await expect(page.locator('#ov-journal')).toHaveClass(/open/);
    await expect(page.locator('.journal-entry')).toHaveCount(1);
    await expect(page.locator('#journal-count')).toHaveText(`1 of ${picked.total}`);
    // the count is out of what this delve buried, never the archive's full eight
    expect(picked.total, 'a delve holds one page per floor, capped at the archive')
      .toBe(Math.min(picked.levels, picked.archive));
  });

  test('the epilogue names the hero and differs between winning and dying', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-new');
    await page.fill('#c-name', 'Wren');
    await page.locator('.bg-card', { hasText: 'The Tombwise' }).click();
    await page.fill('#c-seed', 'story-epilogue');
    await page.click('#c-begin');
    await page.click('#pro-begin');
    await expect(page.locator('#screen-game')).toBeVisible();

    const text = await page.evaluate(() => ({
      won: Game.epilogue(true).join(' '),
      lost: Game.epilogue(false).join(' '),
    }));
    expect(text.won).toContain('Wren');
    expect(text.lost).toContain('Wren');
    expect(text.won).toMatch(/grave/i);
    expect(text.won).not.toBe(text.lost);
    expect(text.won, 'the epilogue speaks in the third person').not.toMatch(/\byou\b/i);
    expect(text.lost).not.toMatch(/\byou\b/i);
  });
});
