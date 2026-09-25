'use strict';
// How a run is set up and kept: Rest that only rests, a caster's own quick
// drink, permadeath by default, the Daily Delve and the difficulty picker.
const { test, devices } = require('@playwright/test');
const { expect, watchForErrors, startGame, clearBoons, faceOpenGround, placeMonster } = require('./helpers');

const healing = page => page.evaluate(() => Game.player().inv.filter(i => i.t === 'potion_heal').reduce((n, i) => n + i.q, 0));

test.describe('rest and the quick drink', () => {
  test('Rest never drinks a potion with enemies near: it dims and says why', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.addInitScript(() => localStorage.setItem('deepdelve.tipsOff', '1'));
    await startGame(page, { cls: 'fighter', seed: 'rest-foes' });
    await clearBoons(page);
    await faceOpenGround(page, 2);
    await page.evaluate(() => { const p = Game.player(); Game.state().known.potion_heal = 1; p.maxHp = 40; p.hp = 6; });
    await placeMonster(page, 'orc', 1, { hp: 99, maxHp: 99, nextAct: 1e12 });
    const rest = page.locator('[data-tap="rest"]');
    await expect(rest).toHaveClass(/unavail/);
    await expect(rest).toContainText(/foes near/i);
    const before = await healing(page);
    expect(before).toBeGreaterThan(0);
    await rest.click();
    await page.waitForTimeout(150);
    expect(await healing(page), 'Rest must not drink a potion').toBe(before);
    await expect(page.locator('#log')).toContainText(/can't rest/i);
    expect(await page.evaluate(() => Game.player().hp)).toBe(6);
    // the fight over, Rest is a rest again
    await page.evaluate(() => { Game.level().monsters.length = 0; });
    await expect(rest).not.toHaveClass(/unavail/);
    await expect(rest).toHaveText(/^Rest/);
    expect(errors).toEqual([]);
  });

  test("a caster's bottle beside the life bar drinks a healing potion; others quaff from Cast", async ({ page }) => {
    const errors = watchForErrors(page);
    await page.addInitScript(() => localStorage.setItem('deepdelve.tipsOff', '1'));
    await startGame(page, { cls: 'mage', seed: 'caster-quaff' });
    await clearBoons(page);
    const bottle = page.locator('#hud-quaff');
    await expect(bottle).toBeVisible();
    const box = await bottle.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    await page.evaluate(() => { const p = Game.player(); p.maxHp = 40; p.hp = 5; });
    const before = await healing(page);
    expect(before).toBeGreaterThan(0);
    await bottle.click();
    await expect.poll(() => healing(page)).toBe(before - 1);
    expect(await page.evaluate(() => Game.player().hp)).toBeGreaterThan(5);
    // the Cast button still casts
    await expect(page.locator('[data-tap="cast"] small')).not.toHaveText('Quaff');
    // with nothing known to drink, the bottle is gone rather than doing something else
    await page.evaluate(() => { const p = Game.player(); p.inv = p.inv.filter(i => i.t !== 'potion_heal' && i.t !== 'potion_xheal'); });
    await expect(bottle).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('a fighter has Bash on the Cast button and the bottle beside the life bar', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { cls: 'fighter', seed: 'fighter-quaff' });
    await clearBoons(page);
    await expect(page.locator('[data-tap="cast"] small')).toHaveText('Bash');
    await expect(page.locator('#hud-quaff')).toBeVisible();
    // bashed at a foe in front, it comes back after a few seconds and says so
    await page.evaluate(() => {
      const p = Game.player(), L = Game.level(), G = Game.state(), [dx, dy] = Dungeon.DIRS[p.dir];
      L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR;
      L.monsters.length = 0;
      L.monsters.push({ uid: 77, id: 'goblin', x: p.x + dx, y: p.y + dy, hp: 99, maxHp: 99, awake: true, spoke: true, nextAct: G.t + 1e9, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 });
    });
    await page.click('[data-tap="cast"]');
    await expect(page.locator('[data-tap="cast"] small')).toHaveText(/^Bash \d+s$/);
    await expect(page.locator('[data-tap="cast"]')).toHaveClass(/empty/);
    expect(await page.evaluate(() => Game.state().log.slice(-3).map(e => e.m).join(' '))).toContain('You bash the Goblin');
    expect(errors).toEqual([]);
  });

  test('a thief has Smoke on the Cast button', async ({ page }) => {
    await startGame(page, { cls: 'thief', seed: 'thief-smoke' });
    await clearBoons(page);
    await expect(page.locator('[data-tap="cast"] small')).toHaveText('Smoke');
  });
});

test.describe('point buy', () => {
  test('scores can be bought from 27 points instead of rolled, and the hero starts with them', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto('/');
    await page.click('#btn-new');
    await page.click('#c-statmode [data-mode="buy"]');
    await expect(page.locator('#c-points')).toBeVisible();
    await expect(page.locator('#c-reroll')).toBeHidden();
    await expect(page.locator('#c-points')).toContainText('5 of 27 points left');
    await page.click('.buy-step[data-stat="dex"][data-step="1"]');
    await expect(page.locator('#c-points')).toContainText('4 of 27 points left');
    // nothing past 15, and nothing below 8
    await expect(page.locator('.buy-step[data-stat="str"][data-step="1"]')).toBeDisabled();
    await expect(page.locator('.buy-step[data-stat="cha"][data-step="-1"]')).toBeDisabled();
    await page.fill('#c-seed', 'bought');
    await page.click('#c-begin');
    await page.click('#pro-begin');
    await expect(page.locator('#screen-game')).toBeVisible();
    const s = await page.evaluate(() => Game.player().stats);
    expect(s.str).toBe(15); expect(s.dex).toBe(11); expect(s.cha).toBe(8);
    expect(errors).toEqual([]);
  });
});

test.describe('permadeath', () => {
  test('is on by default for a new hero and for Quick Start, and Load stays shut', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto('/');
    await page.click('#btn-new');
    await expect(page.locator('#c-permadeath')).toBeChecked();
    await page.fill('#c-seed', 'perma-default');
    await page.click('#c-begin');
    await expect(page.locator('#pro-rules')).toContainText(/permadeath is on/i);
    await page.click('#pro-begin');
    await page.waitForFunction(() => typeof Game !== 'undefined' && !!Game.state());
    expect(await page.evaluate(() => Game.state().opts.permadeath)).toBe(true);
    await clearBoons(page);
    await page.click('[data-open="menu"]');
    await expect(page.locator('#m-load')).toBeHidden();
    await expect(page.locator('#m-save')).toHaveText('Save for Continue');
    await expect(page.locator('#m-seed')).toContainText('permadeath');
    // the run is still kept when the game is put away, for Continue
    await page.click('#m-quit');
    await expect(page.locator('#btn-continue')).toBeEnabled();
    await page.evaluate(() => localStorage.removeItem('deepdelve.save'));
    await page.goto('/');
    await page.click('#btn-quick');
    await page.click('#pro-begin');
    await page.waitForFunction(() => typeof Game !== 'undefined' && !!Game.state());
    expect(await page.evaluate(() => Game.state().opts.permadeath)).toBe(true);
    expect(errors).toEqual([]);
  });

  test('can be unticked for a run that may be loaded again', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-new');
    await page.locator('label.check', { has: page.locator('#c-permadeath') }).click();
    await expect(page.locator('#c-permadeath')).not.toBeChecked();
    await page.fill('#c-seed', 'perma-off');
    await page.click('#c-begin');
    await page.click('#pro-begin');
    await page.waitForFunction(() => typeof Game !== 'undefined' && !!Game.state());
    expect(await page.evaluate(() => Game.state().opts.permadeath)).toBe(false);
  });

  test('a run that dies, loads its save and dies again is in the Hall once, as it last ended', async ({ page }) => {
    // it was written in once per death: the same hero twice, or ten times
    const errors = watchForErrors(page);
    await page.addInitScript(() => localStorage.setItem('deepdelve.tipsOff', '1'));
    await page.goto('/');
    await page.click('#btn-new');
    await page.locator('label.check', { has: page.locator('#c-permadeath') }).click();
    await page.fill('#c-name', 'Twice');
    await page.fill('#c-seed', 'hall-once');
    await page.click('#c-begin');
    await page.click('#pro-begin');
    await page.waitForFunction(() => typeof Game !== 'undefined' && !!Game.state());
    await clearBoons(page);
    // an earlier hero's line stays where it is
    await page.evaluate(() => {
      const old = { name: 'Elder', cls: 'fighter', level: 3, depth: 2, gold: 5, xp: 90, kills: 4, won: false, seed: 'old', date: 1, score: 380, difficulty: 'normal', permadeath: true };
      localStorage.setItem('deepdelve.hall', JSON.stringify([old]));
      Game.save(true);
    });
    const dieOnce = async (gold) => {
      await page.evaluate((gold) => {
        const p = Game.player(), L = Game.level(), [dx, dy] = Dungeon.DIRS[p.dir];
        p.gold = gold; p.hp = 1;
        L.monsters.length = 0;
        const x = p.x + dx, y = p.y + dy;
        // whatever is in front, an ogre stands there now and swings at once
        L.tiles[y * L.w + x] = Dungeon.T.FLOOR;
        L.monsters.push({ uid: 4242, id: 'ogre', x, y, hp: 400, maxHp: 400, awake: true, nextAct: 0, rx: x, ry: y, fromX: x, fromY: y, moveT0: 0, moveT1: 0, flashUntil: 0 });
      }, gold);
      await expect.poll(() => page.evaluate(() => Game.state().status), { timeout: 15_000 }).toBe('dead');
      await expect(page.locator('#screen-end')).toBeVisible();
    };
    await dieOnce(11);
    await page.click('#end-load');
    await page.waitForFunction(() => Game.state() && Game.state().status === 'playing');
    await clearBoons(page);
    await dieOnce(22);
    const hall = await page.evaluate(() => Game.hall());
    expect(hall.filter(h => h.name === 'Twice'), 'one line for the run').toHaveLength(1);
    expect(hall.find(h => h.name === 'Twice').gold, 'the line is how it last ended').toBe(22);
    expect(hall.filter(h => h.name === 'Elder'), 'another run keeps its own line').toHaveLength(1);
    await page.click('#end-title-btn');
    await page.click('#btn-hall');
    await expect(page.locator('.hall-row')).toHaveCount(2);
    expect(errors).toEqual([]);
  });
});

test.describe('the Daily Delve', () => {
  const DAY = new Date('2026-09-24T10:00:00');
  /** Tap Daily Delve on a fresh page and step into the dungeon; returns who and where. */
  async function startDaily(page) {
    await page.clock.setFixedTime(DAY);
    await page.addInitScript(() => localStorage.setItem('deepdelve.tipsOff', '1'));
    await page.goto('/');
    await page.click('#btn-daily');
    await expect(page.locator('#screen-prologue')).toBeVisible();
    await expect(page.locator('#pro-rules')).toContainText(/Daily Delve/);
    await page.click('#pro-begin');
    await page.waitForFunction(() => typeof Game !== 'undefined' && !!Game.state());
    return page.evaluate(() => { const G = Game.state(), p = G.player; return { seed: G.seed, cls: p.cls, bg: p.bg, name: p.name, stats: p.stats, opts: G.opts }; });
  }

  test('a custom game cannot borrow the day\'s seed to practise it, nor pass itself off as the day\'s run', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.clock.setFixedTime(DAY);
    await page.addInitScript(() => localStorage.setItem('deepdelve.tipsOff', '1'));
    await page.goto('/');
    await page.click('#btn-new');
    await page.fill('#c-seed', 'daily-2026-09-24');
    await page.click('#c-begin');
    await page.click('#pro-begin');
    await page.waitForFunction(() => typeof Game !== 'undefined' && !!Game.state());
    const seed = await page.evaluate(() => Game.state().seed);
    expect(seed).not.toBe('daily-2026-09-24');
    // back on the title, with that run saved, today's one try is still today's
    await page.evaluate(() => Game.save(true));
    await page.goto('/');
    await expect(page.locator('#daily-summary')).not.toContainText('waits');
    expect(errors).toEqual([]);
  });

  test('gives everyone the same dungeon and hero on the same day, and one try', async ({ page, browser }) => {
    const errors = watchForErrors(page);
    const first = await startDaily(page);
    expect(first.seed).toBe('daily-2026-09-24');
    expect(first.opts).toMatchObject({ levels: 8, permadeath: true, difficulty: 'normal', daily: '2026-09-24', monsters: 'normal', treasure: 'normal', size: 'medium' });
    // another phone, the same day
    const other = await browser.newContext({ ...devices['Pixel 5'] });
    const page2 = await other.newPage();
    const second = await startDaily(page2);
    expect(second).toEqual(first);
    await other.close();

    // fall, and the day is over
    await clearBoons(page);
    await faceOpenGround(page, 2);
    await placeMonster(page, 'ogre', 1, { hp: 400, maxHp: 400, nextAct: 0 });
    await page.evaluate(() => { Game.player().hp = 1; });
    await expect.poll(() => page.evaluate(() => Game.state().status), { timeout: 15_000 }).toBe('dead');
    await expect(page.locator('#screen-end')).toBeVisible();
    await page.click('#end-share');
    await expect(page.locator('#end-share-line')).toContainText(/^Deepdelve daily 2026-09-24: \w+, fell on floor 1, \d+ kills?, streak 1$/);

    await page.goto('/');
    await expect(page.locator('#daily-summary')).toContainText('Today: fell on floor 1');
    await page.click('#btn-daily');
    await page.waitForTimeout(300);
    await expect(page.locator('#screen-title'), 'a second try the same day is refused').toBeVisible();
    expect(await page.evaluate(() => !!Game.state())).toBe(false);
    // the Hall marks it as the day's run
    await page.click('#btn-hall');
    await expect(page.locator('.hall-row.daily .daily-mark')).toHaveText('Daily 2026-09-24');
    expect(errors).toEqual([]);
  });

  test('a run left in progress is waiting on the button, and a new day is a new dungeon with the streak', async ({ page }) => {
    const first = await startDaily(page);
    await clearBoons(page);
    await page.click('[data-open="menu"]');
    await expect(page.locator('#m-seed')).toContainText('Daily Delve 2026-09-24');
    await page.click('#m-quit');
    await expect(page.locator('#daily-summary')).toContainText("Today's delve waits");
    await page.click('#btn-daily');
    await expect(page.locator('#screen-game')).toBeVisible();
    expect(await page.evaluate(() => Game.state().seed)).toBe(first.seed);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('deepdelve.daily')).streak)).toBe(1);

    // the next day: a different dungeon, and the streak grows. Yesterday's
    // run is still saved (leaving the page keeps it), so it asks first
    await page.clock.setFixedTime(new Date('2026-09-25T09:00:00'));
    await page.goto('/');
    await expect(page.locator('#daily-summary')).toContainText('streak 1');
    await page.click('#btn-daily');
    await expect(page.locator('#screen-confirm')).toBeVisible();
    await page.click('#confirm-replace');
    await page.click('#pro-begin');
    await page.waitForFunction(() => typeof Game !== 'undefined' && !!Game.state());
    expect(await page.evaluate(() => Game.state().seed)).toBe('daily-2026-09-25');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('deepdelve.daily')).streak)).toBe(2);
  });
});

test.describe('difficulty', () => {
  test('the picker writes the choice into the run, and the menu says it', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto('/');
    await page.click('#btn-new');
    await expect(page.locator('[data-diff="normal"]')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#c-diff-note')).toContainText(/Normal/);
    await page.click('[data-diff="hard"]');
    await expect(page.locator('[data-diff="hard"]')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('[data-diff="normal"]')).toHaveAttribute('aria-checked', 'false');
    await expect(page.locator('#c-diff-note')).toContainText(/Hard/);
    // Descend is in reach without scrolling
    const begin = await page.locator('#c-begin').boundingBox();
    expect(begin.y + begin.height).toBeLessThanOrEqual(page.viewportSize().height + 1);
    await page.fill('#c-seed', 'diff-hard');
    await page.click('#c-begin');
    await page.click('#pro-begin');
    await page.waitForFunction(() => typeof Game !== 'undefined' && !!Game.state());
    expect(await page.evaluate(() => Game.state().opts.difficulty)).toBe('hard');
    await clearBoons(page);
    await page.click('[data-open="menu"]');
    await expect(page.locator('#m-seed')).toContainText('Hard');
    expect(errors).toEqual([]);
  });

  test('Quick Start is normal, and a save from before the choice reads as normal', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-quick');
    await page.click('#pro-begin');
    await page.waitForFunction(() => typeof Game !== 'undefined' && !!Game.state());
    expect(await page.evaluate(() => Game.state().opts.difficulty)).toBe('normal');
    await page.evaluate(() => {
      Game.save();
      const s = JSON.parse(localStorage.getItem('deepdelve.save'));
      delete s.opts.difficulty;
      localStorage.setItem('deepdelve.save', JSON.stringify(s));
      Game.load();
    });
    await clearBoons(page);
    await page.click('[data-open="menu"]');
    await expect(page.locator('#m-seed')).toContainText('Normal');
  });
});

test.describe('the hero\'s name', () => {
  test('the button beside the name gives a random name, a new one each press, and the hero takes it', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto('/');
    await page.click('#btn-new');
    const btn = page.locator('#c-name-rand');
    await expect(btn).toBeVisible();
    const box = await btn.boundingBox();
    expect(box.width >= 44 && box.height >= 44, `button is ${box.width}x${box.height}`).toBe(true);
    await btn.click();
    const first = await page.inputValue('#c-name');
    const names = await page.evaluate(() => window.HERO_NAMES || null);
    expect(first.length > 0, 'no name was given').toBe(true);
    if (names) expect(names).toContain(first);
    await btn.click();
    const second = await page.inputValue('#c-name');
    expect(second).not.toBe(first);
    await page.fill('#c-seed', 'named');
    await page.click('#c-begin');
    await page.click('#pro-begin');
    await page.waitForFunction(() => typeof Game !== 'undefined' && !!Game.state());
    expect(await page.evaluate(() => Game.player().name)).toBe(second);
    expect(errors).toEqual([]);
  });
});
