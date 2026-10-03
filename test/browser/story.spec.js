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

    // one level up, to 3, which brings a lesson (talents come at the even levels)
    await page.evaluate(() => { const p = Game.player(); p.level = 2; p.xp = XP_TABLE[2] - 1; });
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
    // Self-Taught asks where its two points go first
    if (await page.locator('.spread-stat').count()) { await page.locator('.spread-stat:not(.full)').first().click(); await page.locator('.spread-stat:not(.full)').first().click(); }
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

  test('Self-Taught asks for a score for each of its two points, and can be taken back before the second', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'story-spread' });
    await faceOpenGround(page, 2);
    const placed = await placeMonster(page, 'goblin', 1, { hp: 1, maxHp: 1 });
    // every other lesson already learned as often as it can be: Self-Taught and Old Scars are left
    await page.evaluate(() => { const p = Game.player(); p.level = 2; p.xp = XP_TABLE[2] - 1; p.boons = ['str', 'str', 'dex', 'dex', 'con', 'con', 'keen', 'swift', 'hardy']; });
    expect(await killMonster(page, placed.uid)).toBe(true);
    await expect(page.locator('#ov-boons')).toHaveClass(/open/);
    await page.waitForTimeout(700);   // the guard against a tap already on its way
    await page.locator('#boon-list .boon', { hasText: 'Self-Taught' }).click();
    await expect(page.locator('.spread-stat')).toHaveCount(6);
    const str0 = await page.evaluate(() => Game.player().stats.str);
    await page.click('.spread-stat[data-stat="str"]');
    await expect(page.locator('#boon-list .boon-head')).toContainText('1 point to place');
    await page.click('#boon-list button.ghost');            // start again
    await expect(page.locator('#boon-list .boon-head')).toContainText('2 points to place');
    await page.click('.spread-stat[data-stat="str"]');
    await page.click('.spread-stat[data-stat="str"]');
    await expect(page.locator('#ov-boons')).not.toHaveClass(/open/);
    expect(await page.evaluate(() => Game.player().stats.str)).toBe(str0 + 2);
    expect(errors).toEqual([]);
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

test.describe('choices kept', () => {
  test('a level-up choice left waiting is still waiting after the game is reloaded', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('deepdelve.tipsOff', '1'));
    await startGame(page, { seed: 'boon-reload' });
    await faceOpenGround(page, 2);
    const placed = await placeMonster(page, 'goblin', 1, { hp: 1, maxHp: 1 });
    await page.evaluate(() => { Game.player().xp = XP_TABLE[1] - 1; });
    expect(await killMonster(page, placed.uid)).toBe(true);
    await expect(page.locator('#ov-boons')).toHaveClass(/open/);
    await page.evaluate(() => Game.save());
    await page.reload();
    await page.click('#btn-continue');
    await expect(page.locator('#ov-boons')).toHaveClass(/open/);
    await expect(page.locator('#boon-title')).toContainText('Hero level 2');
  });
  test('the valley\'s story is told in full the first time, then waits folded so the stair is on the screen', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.click('#btn-new');
    await page.fill('#c-seed', 'story-fold');
    await page.click('#c-begin');
    await expect(page.locator('#pro-world > p')).toHaveCount(4);
    await page.click('#pro-begin');
    await expect(page.locator('#screen-game')).toBeVisible();
    // a second hero: the story folded away, the stair in view without scrolling
    await page.goto('/');
    await page.click('#btn-new');
    if (await page.locator('#screen-confirm').isVisible()) await page.click('#confirm-replace');
    await page.fill('#c-seed', 'story-fold-2');
    await page.click('#c-begin');
    await expect(page.locator('#pro-world details.pro-again')).toHaveCount(1);
    expect(await page.locator('#pro-world details').evaluate(d => d.open)).toBe(false);
    const inView = await page.locator('#pro-begin').evaluate(b => { const r = b.getBoundingClientRect(); return r.bottom <= innerHeight && r.top >= 0; });
    expect(inView, 'the stair button is on the screen').toBe(true);
    // and the story is still there to read
    await page.locator('#pro-world summary').click();
    await expect(page.locator('#pro-world details p').first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  // The way in: a new run opens on the hero walking down a passage, turning at a
  // rumble and watching the roof come down. (A browser driven by the tests starts
  // without it unless asked: see preludeWanted in ui.js.)
  test('the way in plays as a run opens: the controls tip waits for it, a tap on the view skips it, and the roof is told', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.addInitScript(() => localStorage.setItem('deepdelve.prelude', 'on'));
    await startGame(page, { seed: 'way-in-quiet', tips: true });
    expect(await page.evaluate(() => Game.preludeOn())).toBe(true);
    await expect(page.locator('#prelude-skip')).toBeVisible();
    // in the corner map's place: that map is of the first floor, not the passage
    await expect(page.locator('#minimap')).toBeHidden();
    // the passage, not the first floor, and no tip over it while it plays
    expect(await page.evaluate(() => Game.renderState(performance.now()).level.w)).toBe(7);
    await page.waitForTimeout(600);
    await expect(page.locator('#tip.show')).toHaveCount(0);
    const at = await page.evaluate(() => { const p = Game.player(); return [p.x, p.y, p.dir]; });
    await page.locator('#view').click();
    expect(await page.evaluate(() => Game.preludeOn())).toBe(false);
    await expect(page.locator('#prelude-skip')).toBeHidden();
    await expect(page.locator('#minimap')).toBeVisible();
    // the tap only skipped it: the hero stands where the run begins
    expect(await page.evaluate(() => { const p = Game.player(); return [p.x, p.y, p.dir]; })).toEqual(at);
    expect(await page.evaluate(() => Game.state().log.some(l => /the roof of the passage comes down/.test(l.base || l.m || '')))).toBe(true);
    // and now the first tip comes
    await expect(page.locator('#tip.show[data-tip="controls"]')).toBeVisible({ timeout: 5000 });
    expect(errors).toEqual([]);
  });

  test('left alone the way in plays out by itself into the first floor, where the stair up lies under fallen rock', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.addInitScript(() => localStorage.setItem('deepdelve.prelude', 'on'));
    await startGame(page, { seed: 'way-in-alone' });
    expect(await page.evaluate(() => Game.preludeOn())).toBe(true);
    const t0 = await page.evaluate(() => Game.state().t);
    await page.waitForFunction(() => !Game.preludeOn(), null, { timeout: 15000 });
    // the dungeon stood still while it played
    expect(await page.evaluate(() => Game.state().t) - t0).toBeLessThan(1000);
    await expect(page.locator('#prelude-skip')).toBeHidden();
    expect(await page.evaluate(() => Game.state().log.some(l => /the roof of the passage comes down/.test(l.base || l.m || '')))).toBe(true);
    // turned round, the hero faces fallen rock where the stair up was
    for (let i = 0; i < 2; i++) { await page.evaluate(() => Game.input('left')); await page.waitForTimeout(450); }
    await expect.poll(() => page.evaluate(() => Renderer.looks.fallen), { timeout: 3000 }).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });
});
