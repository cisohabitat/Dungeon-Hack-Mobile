'use strict';
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { startGame, watchForErrors, usePad, padPress } = require('./helpers');

// Reach the real generated cache without having a fixture replace its rules.
async function reachCache(page) {
  return page.evaluate(() => {
    const L = Game.level(), q = L.puzzle;
    if (!q) throw new Error('No cache in the fixture');
    L.monsters = []; L.traps = {}; Game.player().x = q.x; Game.player().y = q.y;
    return { kind: q.kind, order: q.order, target: q.target, gold: Game.player().gold };
  });
}
async function solve(page, q) {
  await page.click('#puzzle-reset');
  const marks = q.kind === 'runes' ? q.order : q.kind === 'torches' ? [0, 1, 2, 3].filter(i => q.target & (1 << i)) : [q.order[0]];
  for (const mark of marks) await page.click(`#puzzle-mark-${mark}`);
  await page.evaluate(() => document.querySelector('#puzzle-submit').addEventListener('click', () => {
    // Run in the submit event, before a test round trip can outlast the guard.
    document.querySelector('#puzzle-reward-gold')?.click();
    window.__puzzleGuardReward = Game.currentPuzzle().reward;
  }, { once: true }));
  await page.click('#puzzle-submit');
  await expect(page.locator('#puzzle-feedback')).toContainText('cache is open');
}

test('each new hero chooses puzzles at the stair, including returning Quick Start @mobile', async ({ page }) => {
  const errors = watchForErrors(page);
  await startGame(page, { seed: 'puzzle1', puzzles: true });
  expect(await page.evaluate(() => Game.state().opts.puzzles)).toBe(true);
  await page.evaluate(() => {
    // A previous run in the Hall used to bypass the stair in Quick Start.
    localStorage.setItem('deepdelve.hall', JSON.stringify([{ cls: 'fighter', name: 'Old', level: 1, depth: 1, won: false, score: 10, date: '2026-10-17', seed: 'old', run: 'old' }]));
    localStorage.removeItem('deepdelve.save');
  });
  await page.reload();
  await page.evaluate(() => localStorage.removeItem('deepdelve.save'));
  await page.click('#btn-quick');
  await expect(page.locator('#screen-prologue')).toBeVisible();
  await expect(page.locator('#pro-puzzles')).not.toBeChecked();
  await page.click('#pro-begin');
  await expect(page.locator('#screen-game')).toBeVisible();
  expect(await page.evaluate(() => !!Game.state().opts.puzzles)).toBe(false);
  expect(errors).toEqual([]);
});

for (const [seed, kind] of [['puzzle1', 'runes'], ['puzzle3', 'torches'], ['puzzle0', 'seals']]) {
  test(`${kind}: touch, a wrong guess, leaving and reopening, then collecting the cache @mobile`, async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed, puzzles: true });
    const q = await reachCache(page); expect(q.kind).toBe(kind);
    await expect(page.locator('[data-tap="use"] small')).toHaveText('Puzzle');
    await page.locator('[data-tap="use"]').tap();
    const dialog = page.locator('#ov-puzzle');
    await expect(dialog).toHaveClass(/open/);
    await expect(dialog).toHaveAttribute('role', 'dialog');
    const start = await page.evaluate(() => ({ t: Game.state().t, hp: Game.player().hp, food: Game.player().food }));
    await page.click('#puzzle-submit');
    await expect(page.locator('#puzzle-feedback')).toContainText('nothing is lost');
    await page.click('#puzzle-mark-1');
    const progress = await page.evaluate(() => JSON.stringify([Game.currentPuzzle().input, Game.currentPuzzle().lit]));
    await page.click('#puzzle-leave'); await expect(dialog).not.toHaveClass(/open/);
    await page.locator('[data-tap="use"]').tap();
    await expect(dialog).toHaveClass(/open/);
    expect(await page.evaluate(() => JSON.stringify([Game.currentPuzzle().input, Game.currentPuzzle().lit]))).toBe(progress);
    await solve(page, q);
    const end = await page.evaluate(() => ({ t: Game.state().t, hp: Game.player().hp, food: Game.player().food }));
    // The short interval spent outside the overlay may advance the clock.
    expect(end.hp).toBe(start.hp); expect(end.food).toBe(start.food);
    expect(await page.evaluate(() => Game.player().gold)).toBe(q.gold);
    await page.click('#puzzle-reward-gold');
    await page.click('#puzzle-leave'); await expect(dialog).not.toHaveClass(/open/);
    await page.click('#feet');
    expect(await page.evaluate(() => Game.player().gold)).toBeGreaterThan(q.gold);
    expect(errors).toEqual([]);
  });
}

test('puzzle overlay pauses the world, supports keyboard and controller, and passes axe at double text', async ({ page }) => {
  await usePad(page);
  await startGame(page, { seed: 'puzzle3', puzzles: true });
  await reachCache(page); await page.locator('[data-tap="use"]').tap();
  await expect(page.locator('#ov-puzzle')).toHaveClass(/open/);
  await page.evaluate(() => document.documentElement.style.fontSize = '32px');
  const initial = await page.evaluate(() => ({ t: Game.state().t, hp: Game.player().hp, x: Game.player().x, y: Game.player().y }));
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement.closest('#ov-puzzle'))).toBe(true);
  await expect(page.locator('#puzzle-mark-0')).toBeEnabled();
  await page.locator('#puzzle-mark-0').focus();
  await padPress(page, 'A');
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(axe.violations.filter(v => ['serious', 'critical'].includes(v.impact))).toEqual([]);
  expect(await page.evaluate(() => ({ t: Game.state().t, hp: Game.player().hp, x: Game.player().x, y: Game.player().y }))).toEqual(initial);
  const bounds = await page.locator('#ov-puzzle').evaluate(el => ({ w: el.clientWidth, scroll: el.scrollWidth }));
  expect(bounds.scroll).toBeLessThanOrEqual(bounds.w + 1);
  await page.keyboard.press('Escape');
  await expect(page.locator('#ov-puzzle')).not.toHaveClass(/open/);
});

test('a reload and a save code keep the same partially answered puzzle @mobile', async ({ page }) => {
  const errors = watchForErrors(page);
  await startGame(page, { seed: 'puzzle1', puzzles: true, permadeath: false });
  const q = await reachCache(page);
  await page.locator('[data-tap="use"]').tap();
  await expect(page.locator('#ov-puzzle')).toHaveClass(/open/);
  await page.click('#puzzle-mark-2');
  await page.evaluate(() => Game.save(true));
  const code = await page.evaluate(() => Game.saveCode());
  await page.reload(); await page.click('#btn-continue');
  await expect(page.locator('#screen-game')).toBeVisible();
  expect(await page.evaluate(() => Game.level().puzzle.input)).toEqual([2]);
  await expect(page.locator('[data-tap="use"]')).toHaveAttribute('aria-label', 'Puzzle');
  await page.click('[data-tap="use"]');
  await expect(page.locator('#ov-puzzle')).toHaveClass(/open/);
  await expect(page.locator('#puzzle-progress')).toContainText('Crown');
  await page.click('#puzzle-reset'); await page.click('#puzzle-leave');
  await expect(page.locator('#ov-puzzle')).not.toHaveClass(/open|closing/);
  await expect.poll(() => page.evaluate(() => history.state?.dd)).toBe('game');
  expect(await page.evaluate(code => Game.loadCode(code), code)).toMatchObject({ ok: true });
  expect(await page.evaluate(() => Game.level().puzzle.input)).toEqual([2]);
  await expect(page.locator('[data-tap="use"]')).toHaveAttribute('aria-label', 'Puzzle');
  await page.click('[data-tap="use"]');
  await expect(page.locator('#ov-puzzle')).toHaveClass(/open/);
  await expect(page.locator('#puzzle-progress')).toContainText('Crown');
  await solve(page, q);
  expect(errors).toEqual([]);
});

test('Daily and Weekly starts explain that their puzzle rules stay fixed', async ({ page }) => {
  await page.goto('/');
  // Actual challenge buttons and their prologue, before spending a try.
  for (const button of ['#btn-daily', '#btn-weekly']) {
    await page.click(button);
    await expect(page.locator('#screen-prologue')).toBeVisible();
    await expect(page.locator('#pro-puzzles')).toBeDisabled();
    await expect(page.locator('#pro-puzzles')).not.toBeChecked();
    await expect(page.locator('#pro-puzzle-note')).toContainText('fixed');
    await page.click('#pro-back');
  }
});

for (const choice of ['potion', 'gear']) {
  test(`cache ${choice} choice survives leaving and a reload, then grants only one share @mobile`, async ({ page }) => {
    const errors = watchForErrors(page);
    // Exercise persistence independently of a narration stream being torn down.
    // The partial-save case and the media suites retain their voice coverage.
    await page.addInitScript(() => localStorage.setItem('deepdelve.narration', 'off'));
    await startGame(page, { seed: 'puzzle1', puzzles: true, permadeath: false });
    const q = await reachCache(page);
    // A rich cache exercises every affordable option and a co-located key.
    await page.evaluate(() => {
      const L = Game.level(), q = L.puzzle;
      L.items[`${q.x},${q.y}`] = [{ t: 'gold', q: 200, puzzle: true }, { t: 'key', q: 1, color: 'silver' }];
    });
    await page.locator('[data-tap="use"]').tap();
    await solve(page, q);
    await expect(page.locator('#puzzle-unlock')).toBeVisible();
    const offers = await page.evaluate(() => Game.puzzleOffers());
    expect(offers).toHaveLength(3);
    // A fast second press cannot pick the reward under the submit button.
    expect(await page.evaluate(() => window.__puzzleGuardReward)).toBe('pending');
    await page.click('#puzzle-leave');
    await expect(page.locator('#ov-puzzle')).not.toHaveClass(/open|closing/);
    // The fade and Safari's same-document history traversal settle separately.
    await expect.poll(() => page.evaluate(() => history.state?.dd)).toBe('game');
    await page.evaluate(() => Game.save(true));
    await page.reload(); await page.click('#btn-continue');
    await expect(page.locator('#screen-game')).toBeVisible();
    expect(await page.evaluate(() => Game.level().puzzle.reward)).toBe('pending');
    await expect(page.locator('[data-tap="use"]')).toHaveAttribute('aria-label', 'Puzzle');
    await page.click('[data-tap="use"]');
    await expect(page.locator('#puzzle-reward-' + choice)).toBeVisible();
    expect(await page.evaluate(() => Game.puzzleOffers())).toEqual(offers);
    await page.click('#puzzle-reward-' + choice);
    await expect(page.locator('#puzzle-hint')).toContainText('share waits');
    expect(await page.evaluate(() => Game.puzzleAction('claim', 'gold'))).toBe(false);
    const offer = offers.find(o => o.id === choice);
    await page.click('#puzzle-leave');
    await expect(page.locator('#ov-puzzle')).not.toHaveClass(/open/);
    await page.click('#feet');
    expect(await page.evaluate(() => Game.player().gold)).toBe(q.gold + offer.gold);
    expect(await page.evaluate(id => Game.player().inv.some(it => it.t === id), offer.item.t)).toBe(true);
    expect(await page.evaluate(() => Game.player().inv.some(it => it.t === 'key' && it.color === 'silver'))).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('reward choices stay accessible at double text; Calm view and reduced motion keep the catch still', async ({ page }) => {
  await usePad(page);
  await startGame(page, { seed: 'puzzle1', puzzles: true });
  const q = await reachCache(page);
  await page.evaluate(() => {
    const L = Game.level(), q = L.puzzle;
    L.items[`${q.x},${q.y}`] = [{ t: 'gold', q: 200, puzzle: true }];
    document.documentElement.style.fontSize = '32px';
  });
  await page.click('[data-tap="use"]'); await solve(page, q);
  await expect(page.locator('#puzzle-reward-gold')).toBeEnabled();
  const bounds = await page.locator('#ov-puzzle').evaluate(el => ({ w: el.clientWidth, scroll: el.scrollWidth }));
  expect(bounds.scroll).toBeLessThanOrEqual(bounds.w + 1);
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(axe.violations.filter(v => ['serious', 'critical'].includes(v.impact))).toEqual([]);
  await padPress(page, 'A'); // the first press brings in the controller's ring
  await page.locator('#puzzle-reward-gear').focus(); await padPress(page, 'A');
  expect(await page.evaluate(() => Game.currentPuzzle().reward)).toBe('gear');
  await page.evaluate(() => document.body.classList.add('calm'));
  expect(await page.locator('.puzzle-lid').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  await page.evaluate(() => document.body.classList.remove('calm'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.locator('.puzzle-lid').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement.closest('#ov-puzzle'))).toBe(true);
});
