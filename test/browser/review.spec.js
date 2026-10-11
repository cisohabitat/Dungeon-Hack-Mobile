// The October 2026 review's fixes on the interface (docs/REVIEW.md, ROADMAP.md
// Phase 6): the title for a first visit and a returning player, the prologue's way
// back, the replace question, the hero above a choice, the end screen's lesson and
// goal, the name kept, the first tip off the hero's hands, and How to Play in order.
const { test, expect } = require('@playwright/test');
const { watchForErrors, startGame, clearBoons, faceOpenGround, placeMonster } = require('./helpers');

test.describe('the title', () => {
  test('a first visit sees a three-line card, one Daily button and a line for a code; a returning player the daily switch and a goal (P9, P11)', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto('/');
    await expect(page.locator('#first-time')).toBeVisible();
    expect(await page.locator('#first-time li').count()).toBe(3);
    // the key art shows under the card: the card ends above the middle of a phone's screen
    const vh = await page.evaluate(() => innerHeight);
    expect(await page.locator('#first-time').evaluate(e => e.getBoundingClientRect().bottom)).toBeLessThan(vh * 0.78);
    await expect(page.locator('.daily-kind')).toBeHidden();
    await expect(page.locator('#btn-code')).toHaveClass(/linkish/);
    await expect(page.locator('#next-goal')).toBeHidden();
    // once a run has been played, the switch and a goal
    await startGame(page, { seed: 'review-title' });
    await page.evaluate(() => Game.save(true));
    await page.goto('/');
    await expect(page.locator('.daily-kind')).toBeVisible();
    await expect(page.locator('#next-goal')).toBeVisible();
    // (a hero with no win yet is set a floor to reach, not a trophy)
    await expect(page.locator('#next-goal')).toHaveText('Next: Reach floor 3, for the divided stair.');
    expect(errors).toEqual([]);
  });

  test('the prologue shows the hero\'s face and has a way back that spends nothing (P6, P10)', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.clock.setFixedTime(new Date('2026-09-24T10:00:00'));
    await page.addInitScript(() => { localStorage.setItem('deepdelve.tipsOff', '1'); localStorage.setItem('deepdelve.firstSeen', '1'); });
    await page.goto('/');
    await page.click('#btn-daily');
    await expect(page.locator('#screen-prologue')).toBeVisible();
    await expect(page.locator('#pro-face')).toBeVisible();
    expect(await page.locator('#pro-face').getAttribute('src')).toMatch(/^data:|^blob:/);
    await page.click('#pro-back');
    await expect(page.locator('#screen-title')).toBeVisible();
    // the day's one try is still to be had
    await expect(page.locator('#daily-summary')).toContainText(/one try/i);
    await expect(page.locator('#daily-summary')).not.toContainText(/unfinished|waits/);
    expect(await page.evaluate(() => !!Game.state())).toBe(false);
    expect(errors).toEqual([]);
  });

  test('the replace question says what was chosen (P18)', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'review-confirm' });
    await page.evaluate(() => Game.save(true));
    await page.goto('/');
    await page.click('#btn-quick');
    await expect(page.locator('#screen-confirm')).toBeVisible();
    await expect(page.locator('#confirm-what')).toHaveText('You chose Quick Start.');
    await page.click('#confirm-keep');
    await expect(page.locator('#screen-game')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('a background tapped keeps the name shown; the dice draw another (P7)', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.addInitScript(() => localStorage.setItem('deepdelve.firstSeen', '1'));
    await page.goto('/');
    await page.click('#btn-new');
    const name = await page.inputValue('#c-name');
    expect(name).not.toBe('');
    await page.locator('.bg-card:not(.locked)').nth(1).click();
    expect(await page.inputValue('#c-name')).toBe(name);
    await page.click('#c-name-rand');
    expect(await page.inputValue('#c-name')).not.toBe(name);
    expect(errors).toEqual([]);
  });

  test('How to Play begins with who you are and moving, and ends with how the delve ends; the settings sit under Modes (P4)', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-help');
    const basics = await page.locator('[data-hpage="basics"] h3').allTextContents();
    expect(basics[0]).toBe('Who you are');
    expect(basics[basics.length - 1]).toBe('How it ends');
    expect(await page.locator('[data-hpage="basics"]').textContent()).not.toMatch(/Send reports|Testing tools/);
    expect(await page.locator('[data-hpage="modes"] h3').allTextContents()).toContain('Settings');
  });
});

test.describe('in the dungeon', () => {
  test('the hero stands above the level-up\'s cards held upright, and makes way for them held sideways (P2)', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'review-head', name: 'Hollis' });
    await page.evaluate(() => Game.testLevel());
    await expect(page.locator('#ov-boons')).toHaveClass(/open/);
    const head = page.locator('#boon-list .choice-head');
    await expect(head).toBeVisible();
    await expect(head).toContainText('Hollis');
    await expect(head).toContainText(/hit points/);
    await expect(head.locator('.choice-face')).toBeVisible();
    // the cards still at the thumb, under it
    const headBottom = await head.evaluate(e => e.getBoundingClientRect().bottom);
    const cardTop = await page.locator('#boon-list .boon').first().evaluate(e => e.getBoundingClientRect().top);
    expect(cardTop).toBeGreaterThan(headBottom);
    // held sideways there is no room: the cards come first
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(head).toBeHidden();
    await expect(page.locator('#boon-list .boon').first()).toBeVisible();
    await page.setViewportSize({ width: 393, height: 851 });
    await clearBoons(page);
    expect(errors).toEqual([]);
  });

  test('the end screen says what beats what killed you, and one goal to go down for (P1, P11)', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'review-end', cls: 'mage' });
    await faceOpenGround(page, 2);
    await placeMonster(page, 'goblin', 1, { hp: 400, maxHp: 400, nextAct: 0 });
    await page.evaluate(() => { const p = Game.player(); p.hp = 1; p.eq.armor = null; p.eq.shield = null; });
    await expect(page.locator('#screen-end')).toBeVisible({ timeout: 25_000 });
    await expect(page.locator('#end-cause')).toContainText(/Killed by a goblin/i);
    await expect(page.locator('#end-cause .beats')).toContainText(/^What beats it: /);
    await expect(page.locator('#end-goal')).toBeVisible();
    await expect(page.locator('#end-goal')).toHaveText('Next: Reach floor 3, for the divided stair.');
    expect(errors).toEqual([]);
  });

  test('the first arrow drawn down the line brings its own tip: out of the line, or close in (P1)', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'review-arrow', tips: true });
    // past the controls tip, which holds the dungeon still
    for (let i = 0; i < 3 && await page.locator('#tip.show').isVisible(); i++) { await page.locator('#tip').click(); await page.waitForTimeout(200); }
    await faceOpenGround(page, 4);
    await placeMonster(page, 'archer', 3, { hp: 30, maxHp: 30, nextAct: 0 });
    // its draw is the mark: the tip comes with it, and says what beats it
    await expect.poll(() => page.evaluate(() => { const t = document.getElementById('tip'); return t.classList.contains('show') ? t.dataset.tip : ''; }), { timeout: 10_000 }).toBe('shot');
    await expect(page.locator('#tip')).toContainText(/out of its line/);
    expect(errors).toEqual([]);
  });

  test('a find flares the gold on the HUD (P16)', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'review-gold' });
    await page.evaluate(() => { Game.player().gold += 50; });
    await expect(page.locator('#hud-gold')).toHaveClass(/flare/);
    expect(errors).toEqual([]);
  });
});
