'use strict';
// What carries from one run to the next: trophies in the Hall, the relic
// codex, and the two backgrounds that are earned by winning.
const { test } = require('@playwright/test');
const { expect, watchForErrors, startGame, clearBoons } = require('./helpers');

const relicCount = page => page.evaluate(async () => Object.keys((await import('./js/relics.js')).RELICS).length);

test.describe('progress between runs', () => {
  test('the Hall shows a trophy for each class and difficulty won', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.click('#btn-hall');
    await expect(page.locator('#trophy-count')).toHaveText(new RegExp('^0 of \\d+ won$'));
    // a cell for every class at every difficulty, every path, every vow and every feat
    const cells = await page.evaluate(() => Object.keys(CLASSES).length * 3 + document.querySelectorAll('[data-trophy^="path-"]').length + document.querySelectorAll('[data-trophy^="vow-"]').length + document.querySelectorAll('[data-trophy^="feat-"]').length);
    await expect(page.locator('#hall-trophies .cell')).toHaveCount(cells);
    await expect(page.locator('[data-trophy^="feat-"]')).toHaveCount(1);
    await expect(page.locator('#hall-trophies .cell.won')).toHaveCount(0);
    await page.click('#hall-back');
    await page.evaluate(() => localStorage.setItem('deepdelve.progress', JSON.stringify({ won: { fighter: { easy: 2, normal: 1 }, mage: { hard: 1 } }, relics: [] })));
    await page.click('#btn-hall');
    await expect(page.locator('#trophy-count')).toHaveText(new RegExp('^3 of \\d+ won$'));
    await expect(page.locator('#hall-trophies .cell.won')).toHaveCount(3);
    for (const lit of ['fighter-easy', 'fighter-normal', 'mage-hard']) await expect(page.locator(`[data-trophy="${lit}"]`)).toHaveClass(/won/);
    for (const dark of ['fighter-hard', 'mage-easy', 'cleric-normal', 'thief-hard']) await expect(page.locator(`[data-trophy="${dark}"]`)).not.toHaveClass(/won/);
    await expect(page.locator('[data-trophy="fighter-easy"]')).toHaveAttribute('aria-label', 'Fighter on Easy: won 2 times');
    // vows are shut until a Hard win: this one has one
    await expect(page.locator('[data-trophy="vow-iron"]')).not.toHaveClass(/shut/);
    // a path won and a vow kept light their own cells
    await page.click('#hall-back');
    await page.evaluate(() => localStorage.setItem('deepdelve.progress', JSON.stringify({ won: { fighter: { easy: 1 } }, relics: [], paths: { knight: 1 }, vows: { pauper: 2 } })));
    await page.click('#btn-hall');
    await expect(page.locator('#trophy-count')).toHaveText(new RegExp('^3 of \\d+ won$'));
    await expect(page.locator('[data-trophy="path-knight"]')).toHaveClass(/won/);
    await expect(page.locator('[data-trophy="path-berserker"]')).not.toHaveClass(/won/);
    await expect(page.locator('[data-trophy="vow-pauper"]')).toHaveAttribute('aria-label', "Pauper's Vow: kept 2 times");
    await expect(page.locator('[data-trophy="vow-iron"]')).toHaveClass(/shut/);
    expect(errors).toEqual([]);
  });

  test('after a Hard win, a new hero can swear vows, and a vow binds the run', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto('/');
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('deepdelve.tipsOff', '1'); });
    await page.click('#btn-new');
    await expect(page.locator('#c-vows')).toBeHidden();
    await page.click('#c-back');
    await page.evaluate(() => localStorage.setItem('deepdelve.progress', JSON.stringify({ won: { cleric: { hard: 1 } }, relics: [] })));
    await page.click('#btn-new');
    await expect(page.locator('#c-vows')).toBeVisible();
    await page.check('[data-vow="iron"]');
    await page.fill('#c-seed', 'vow-run');
    await page.click('#c-begin');
    await page.click('#pro-begin');
    await expect(page.locator('#screen-game')).toBeVisible();
    expect(await page.evaluate(() => Game.state().opts.vows)).toEqual(['iron']);
    const said = await page.evaluate(() => { Game.level().monsters.length = 0; Game.player().hp = 1; Game.rest(); return Game.state().log.slice(-1)[0].m; });
    expect(said).toContain('Iron Vow');
    expect(errors).toEqual([]);
  });

  test('the relic codex shows found relics in full and the rest by kind only, from the Hall and the Journal', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto('/');
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('deepdelve.progress', JSON.stringify({ won: {}, relics: ['grimtooth'] })); });
    const total = await relicCount(page);
    await page.click('#btn-hall');
    await expect(page.locator('#hall-relics-count')).toHaveText(`1 of ${total} found`);
    await page.click('#hall-relics');
    await expect(page.locator('#screen-relics')).toHaveClass(/active/);
    await expect(page.locator('#relics-count')).toHaveText(`1 of ${total} found`);
    const tooth = page.locator('#relics-list [data-relic="grimtooth"]');
    await expect(tooth).toContainText('Grimtooth');
    await expect(tooth).toContainText('Weapon');
    await expect(tooth.locator('.relic-powers')).toContainText('Keen');
    await expect(tooth.locator('.relic-lore')).toContainText('goblin chieftain');
    // the rest: dim rows that say only what sort of thing they are
    await expect(page.locator('#relics-list .relic-row.unfound')).toHaveCount(total - 1);
    const whisper = page.locator('#relics-list [data-relic="whisper"]');
    await expect(whisper).toContainText('Not yet found');
    await expect(whisper).toContainText('Weapon');
    await expect(whisper).not.toContainText('Whisper');
    await expect(page.locator('#relics-list [data-relic="rustwarden"]')).toContainText('Armour');
    await expect(page.locator('#relics-list [data-relic="kests_bulwark"]')).toContainText('Shield');
    await page.click('#relics-back');
    await expect(page.locator('#screen-hall')).toHaveClass(/active/);

    // in a run, a relic picked up goes in the codex, and the Journal's Relics tab shows it
    await page.click('#hall-back');
    await startGame(page, { seed: 'codex-tab' });
    await clearBoons(page);
    await page.evaluate(() => {
      const p = Game.player(), L = Game.level(), k = `${p.x},${p.y}`;
      const it = { t: 'shortsword', q: 1, e: 2, u: 'whisper' };
      (L.items[k] = L.items[k] || []).push(it);
      Game.takeItem(it);
    });
    await page.click('[data-open="journal"]');
    await page.click('[data-jtab="relics"]');
    await expect(page.locator('[data-jtab="relics"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#journal-count')).toHaveText(`2 of ${total} found`);
    await expect(page.locator('#journal-list [data-relic="whisper"]')).toContainText('Whisper');
    await expect(page.locator('#journal-list [data-relic="whisper"]')).not.toHaveClass(/unfound/);
    await page.click('[data-jtab="pages"]');
    await expect(page.locator('#journal-list .relic-row')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('an earned background is a locked card until a win opens it, and the victory screen says so', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.click('#btn-new');
    const returned = page.locator('.bg-card[data-bg="returned"]'), heart = page.locator('.bg-card[data-bg="heartsworn"]');
    await expect(returned).toBeDisabled();
    await expect(returned).toHaveClass(/locked/);
    await expect(returned).toContainText('Win a run on Normal or Hard to unlock.');
    await expect(heart).toBeDisabled();
    await expect(heart).toContainText('Win a run on Hard to unlock.');
    await expect(page.locator('.bg-card[data-bg="oathbroken"]')).toBeEnabled();
    await page.click('#c-back');

    // win a Normal run as a Fighter: lift the Heart where the hero stands
    await startGame(page, { seed: 'earn-it', cls: 'fighter' });
    await clearBoons(page);
    await page.evaluate(() => {
      const p = Game.player(), L = Game.level(), k = `${p.x},${p.y}`;
      const heart = { t: 'artifact', q: 1, e: 0 };
      L.monsters.length = 0;
      (L.items[k] = L.items[k] || []).push(heart);
      Game.takeItem(heart);
    });
    await expect(page.locator('#screen-end')).toHaveClass(/active/, { timeout: 15000 });
    await expect(page.locator('#end-trophy')).toBeVisible();
    await expect(page.locator('#end-trophy')).toContainText('First win as a Fighter on Normal!');
    await expect(page.locator('#end-trophy')).toContainText('The Returned can now be chosen');

    // the Hall lights the trophy
    await page.click('#end-title-btn');
    await page.click('#btn-hall');
    await expect(page.locator('[data-trophy="fighter-normal"]')).toHaveClass(/won/);
    await expect(page.locator('#trophy-count')).toHaveText(new RegExp('^1 of \\d+ won$'));
    await page.click('#hall-back');

    // and the Returned can be chosen; the Heartsworn still waits on a Hard win
    await page.click('#btn-new');
    await expect(returned).toBeEnabled();
    await expect(returned).not.toHaveClass(/locked/);
    await returned.click();
    await expect(returned).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#c-bg-perk')).toContainText('Potion of Extra Healing');
    await expect(heart).toBeDisabled();
    await page.fill('#c-seed', 'returned-run');
    await page.click('#c-begin');
    await expect(page.locator('#pro-who')).toHaveText('The Returned');
    await page.click('#pro-begin');
    await page.waitForFunction(() => typeof Game !== 'undefined' && !!Game.state() && Game.state().status === 'playing');
    expect(await page.evaluate(() => Game.player().bg)).toBe('returned');
    expect(await page.evaluate(() => Game.player().inv.some(it => it.t === 'potion_xheal'))).toBe(true);
    expect(errors).toEqual([]);
  });
});
