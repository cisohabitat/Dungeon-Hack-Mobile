'use strict';
// How a run is set up and kept: Rest that only rests, a caster's own quick
// drink, permadeath by default, the Daily Delve and the difficulty picker.
const { test, devices } = require('@playwright/test');
const { expect, watchForErrors, startGame, clearBoons, faceOpenGround, placeMonster } = require('./helpers');

const healing = page => page.evaluate(() => Game.player().inv.filter(i => i.t === 'potion_heal').reduce((n, i) => n + i.q, 0));

test.describe('rest and the quick drink', () => {
  test('How to Play from the Menu mid-run keeps the run, and Back (or Escape) returns to the Menu, still paused', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.addInitScript(() => localStorage.setItem('deepdelve.tipsOff', '1'));
    await startGame(page, { seed: 'help-mid-run' });
    await clearBoons(page);
    await page.evaluate(() => { Game.player().steps = 7; localStorage.removeItem('deepdelve.save'); });
    await page.click('[data-open="menu"]');
    await page.click('#m-help');
    await expect(page.locator('#screen-help')).toBeVisible();
    // kept before the help opened: a phone may close a page it cannot see
    expect(await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('deepdelve.save')).player.steps; } catch (e) { return null; } })).toBe(7);
    await page.click('#help-back');
    await expect(page.locator('#screen-game')).toBeVisible();
    await expect(page.locator('#ov-menu')).toHaveClass(/open/);
    expect(await page.evaluate(() => UI.paused())).toBe(true);
    // and Escape does as Back does
    await page.click('#m-help');
    await page.keyboard.press('Escape');
    await expect(page.locator('#ov-menu')).toHaveClass(/open/);
    await page.click('#ov-menu [data-close]');
    expect(await page.evaluate(() => UI.paused())).toBe(false);
    expect(errors).toEqual([]);
  });

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
    await expect(page.locator('#log')).toContainText(/cannot rest/i);
    expect(await page.evaluate(() => Game.player().hp)).toBe(6);
    // the fight over, Rest is a rest again
    await page.evaluate(() => { Game.level().monsters.length = 0; });
    await expect(rest).not.toHaveClass(/unavail/);
    await expect(rest).toHaveText(/^Rest/);
    // a thinner rest says so in words, and the last says where to go instead
    await page.evaluate(() => { Game.level().rests = 1; });
    await expect(rest).toContainText('half rest');
    await page.evaluate(() => { Game.level().rests = 2; });
    await expect(rest).toContainText('quarter rest');
    await page.evaluate(() => { Game.level().rests = 3; });
    await expect(rest).toContainText('find the stairs');
    await expect(rest).toHaveClass(/unavail/);
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

  test('the floors picked are explained under the options: a quick delve, a short delve, the divided stair, the Long Delve', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto('/');
    await page.click('#btn-new');
    await expect(page.locator('#c-levels-note')).toContainText('the stair divides');
    await page.selectOption('#c-levels', '2');
    await expect(page.locator('#c-levels-note')).toContainText('A quick delve: two floors');
    await page.selectOption('#c-levels', '4');
    await expect(page.locator('#c-levels-note')).toContainText('no road to choose');
    await page.selectOption('#c-levels', '12');
    await expect(page.locator('#c-levels-note')).toContainText('The Long Delve: 12 floors');
    expect(errors).toEqual([]);
  });

  test('each class card says how it plays, and a new player is pointed at the Fighter and the Cleric', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.click('#btn-new');
    for (const cls of ['fighter', 'cleric', 'mage', 'thief', 'ranger', 'druid']) await expect(page.locator(`.class-card[data-cls="${cls}"] .ease`)).toHaveText(/^\w+: .+\.$/);
    await expect(page.locator('.class-card[data-cls="mage"] .ease')).toContainText('Fragile');
    await expect(page.locator('.class-card .first-hero')).toHaveCount(2);
    await expect(page.locator('.class-card[data-cls="fighter"] .first-hero')).toHaveText('Good first hero');
    await expect(page.locator('.class-card[data-cls="cleric"] .first-hero')).toBeVisible();
    // three runs down, and the pointer is no longer needed
    await page.evaluate(() => localStorage.setItem('deepdelve.hall', JSON.stringify([1, 2, 3].map(i => ({ name: 'Old ' + i, cls: 'mage', level: 1, depth: 1, won: false, score: 1, date: '2026-01-01' })))));
    await page.click('#c-back'); await page.click('#btn-new');
    await expect(page.locator('.class-card .first-hero')).toHaveCount(0);
    await expect(page.locator('.class-card[data-cls="fighter"] .ease')).toBeVisible();
    expect(errors).toEqual([]);
  });
  test('the Ranger and the Druid can be chosen from the start; a Ranger starts with a bow and has Snare on the Cast button', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.click('#btn-new');
    for (const cls of ['ranger', 'druid']) {
      await expect(page.locator(`.class-card[data-cls="${cls}"]`)).toBeEnabled();
      await expect(page.locator(`.class-card[data-cls="${cls}"]`)).not.toContainText('Locked');
    }
    // a class won on Hard shows its title
    await page.evaluate(() => localStorage.setItem('deepdelve.progress', JSON.stringify({ won: { mage: { hard: 1 } }, relics: [] })));
    await page.click('#c-back'); await page.click('#btn-new');
    await expect(page.locator('.class-card[data-cls="mage"] .class-title')).toHaveText('Archmage');
    await startGame(page, { cls: 'ranger', seed: 'ranger-snare' });
    await clearBoons(page);
    await expect(page.locator('[data-tap="cast"] small')).toHaveText('Snare');
    expect(await page.evaluate(() => Game.player().eq.weapon.t)).toBe('shortbow');
    const caught = await page.evaluate(() => {
      const p = Game.player(), L = Game.level(), G = Game.state(); const [dx, dy] = Dungeon.DIRS[p.dir];
      for (const k of [1, 2, 3]) L.tiles[(p.y + dy * k) * L.w + p.x + dx * k] = Dungeon.T.FLOOR;
      L.monsters.length = 0;
      const m = { uid: 77, id: 'goblin', x: p.x + dx * 3, y: p.y + dy * 3, hp: 50, maxHp: 50, awake: true, nextAct: G.t, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
      L.monsters.push(m);
      return { ok: Game.useAbility(), held: m.nextAct - G.t };
    });
    expect(caught.ok).toBe(true);
    expect(caught.held).toBeGreaterThanOrEqual(2500);
    await expect(page.locator('[data-tap="cast"] small')).toHaveText(/^Snare \d+s$/);
    expect(errors).toEqual([]);
  });

  test('a druid in a delve with no hound is met by a wolf at the first stair, named on the status line when told to stay', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { cls: 'druid', seed: 'wolf-0' });
    await clearBoons(page);
    expect(await page.evaluate(() => Game.companion() && Game.companion().kind)).toBe('wolf');
    expect(await page.evaluate(() => Game.state().log.some(e => /grey wolf pads out of the dark/.test(e.m)))).toBe(true);
    const name = await page.evaluate(() => { Game.companion().mode = 'stay'; return Game.companion().name; });
    await expect(page.locator('#hud-status')).toContainText(name);
    expect(errors).toEqual([]);
  });

  test('a Druid\'s Wild Shape from the spell list makes a bear, shown on the status line', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { cls: 'druid', seed: 'druid-bear' });
    await clearBoons(page);
    await page.evaluate(() => { Game.level().monsters.length = 0; });
    await page.click('[data-open="spells"]');
    await page.locator('#spell-list button.spell', { hasText: 'Wild Shape' }).click();
    await expect(page.locator('#hud-status')).toContainText(/Bear: \d+s, hide \d+/);
    expect(await page.evaluate(() => [Game.shaped(), Game.renderState().fx.view.cls, Game.weapon().name])).toEqual([true, 'bear', 'claws']);
    expect(errors).toEqual([]);
  });
});

test.describe('point buy', () => {
  test('scores can be bought from 27 points instead of rolled, up to 17, and the hero starts with them', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto('/');
    await page.click('#btn-new');
    await page.click('#c-statmode [data-mode="buy"]');
    await expect(page.locator('#c-points')).toBeVisible();
    await expect(page.locator('#c-reroll')).toBeHidden();
    await expect(page.locator('#c-points')).toContainText('5 of 27 points left');
    await page.click('.buy-step[data-stat="dex"][data-step="1"]');
    await expect(page.locator('#c-points')).toContainText('4 of 27 points left');
    // 16 and 17 cost three points each: one fits, the next does not
    await page.click('.buy-step[data-stat="str"][data-step="1"]');
    await expect(page.locator('#c-points')).toContainText('1 of 27 points left');
    await expect(page.locator('.buy-step[data-stat="str"][data-step="1"]')).toBeDisabled();
    // and nothing below 8
    await expect(page.locator('.buy-step[data-stat="cha"][data-step="-1"]')).toBeDisabled();
    await page.fill('#c-seed', 'bought');
    await page.click('#c-begin');
    await page.click('#pro-begin');
    await expect(page.locator('#screen-game')).toBeVisible();
    const s = await page.evaluate(() => Game.player().stats);
    expect(s.str).toBe(16); expect(s.dex).toBe(11); expect(s.cha).toBe(8);
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

test.describe('putting the phone down', () => {
  test('a page put away with a foe close comes back paused on the Menu; on a quiet floor it does not', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.addInitScript(() => localStorage.setItem('deepdelve.tipsOff', '1'));
    await startGame(page, { seed: 'put-away' });
    await clearBoons(page);
    const hide = () => page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    // nothing awake near: the run is saved and left as it was
    await page.evaluate(() => { for (const m of Game.level().monsters) m.awake = false; });
    await hide();
    await expect(page.locator('#ov-menu')).not.toHaveClass(/open/);
    // a foe two steps off: the Menu is waiting, and the world with it
    await faceOpenGround(page, 3);
    expect(await placeMonster(page, 'orc', 2)).not.toBeNull();
    await hide();
    await expect(page.locator('#ov-menu')).toHaveClass(/open/);
    expect(await page.evaluate(() => UI.paused())).toBe(true);
    expect(errors).toEqual([]);
  });
});

test.describe('sharing a run', () => {
  test('any run that ends can be shared in a line with its seed and whatever was changed from the usual', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto('/');
    await page.click('#btn-new');
    await page.locator('.class-card', { has: page.locator('b', { hasText: /^Fighter$/ }) }).click();
    await page.fill('#c-seed', 'share-me');
    await page.selectOption('#c-levels', '6');
    await page.selectOption('#c-size', 'large');
    await page.uncheck('#c-traps');
    await page.click('#c-begin');
    await page.click('#pro-begin');
    await page.waitForFunction(() => typeof Game !== 'undefined' && !!Game.state());
    await clearBoons(page);
    await faceOpenGround(page, 2);
    await placeMonster(page, 'ogre', 1, { hp: 400, maxHp: 400, nextAct: 0 });
    await page.evaluate(() => { Game.player().hp = 1; });
    await expect.poll(() => page.evaluate(() => Game.state().status), { timeout: 15_000 }).toBe('dead');
    await expect(page.locator('#end-share')).toHaveText('Share this run');
    await page.click('#end-share');
    await expect(page.locator('#end-share-line')).toHaveText(/^Deepdelve seed share-me \(Normal, 6 floors, large halls, no traps\): Fighter, fell on floor 1, \d+ kills?, score \d+$/);
    expect(errors).toEqual([]);
  });

  test('a run can be shared as a picture: saved where the browser cannot share files, sent to the sheet where it can', async ({ page, browser }) => {
    const die = async pg => {
      await clearBoons(pg);
      await faceOpenGround(pg, 2);
      await placeMonster(pg, 'ogre', 1, { hp: 400, maxHp: 400, nextAct: 0 });
      await pg.evaluate(() => { Game.player().hp = 1; });
      await expect.poll(() => pg.evaluate(() => Game.state().status), { timeout: 15_000 }).toBe('dead');
    };
    const errors = watchForErrors(page);
    // what the card writes, so the hound's line can be looked for
    await page.addInitScript(() => {
      window.__cardText = [];
      const fill = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (t, ...rest) { window.__cardText.push(String(t)); return fill.call(this, t, ...rest); };
    });
    await startGame(page, { seed: 'card-me', cls: 'Fighter' });
    // a hound that followed this hero down to this floor (told to stay in a far corner, out of the fight)
    await page.evaluate(() => { const G = Game.state(); G.companion = { kind: 'hound', name: 'Pip', x: 1, y: 1, depth: G.depth, hp: 17, maxHp: 17, mode: 'stay', nextAct: 0, kills: 0, joined: 1 }; });
    await die(page);
    await expect(page.locator('#end-card')).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('#end-card')]);
    expect(download.suggestedFilename()).toBe('deepdelve-card-me.png');
    const png = require('fs').readFileSync(await download.path());
    // a real PNG, 800 by 420
    expect(png.slice(1, 4).toString()).toBe('PNG');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([800, 420]);
    await expect(page.locator('#end-card')).toHaveText('Picture saved');
    expect(await page.evaluate(() => window.__cardText)).toContain('With Pip, the hound');
    expect(errors).toEqual([]);
    // a phone whose sheet takes files gets the picture, with the line beside it
    const phone = await browser.newContext({ viewport: page.viewportSize() });
    const p2 = await phone.newPage();
    await p2.addInitScript(() => {
      window.__sent = null;
      navigator.canShare = d => !!(d && d.files && d.files.length);
      navigator.share = async d => { window.__sent = { name: d.files[0].name, type: d.files[0].type, size: d.files[0].size, text: d.text }; };
    });
    await startGame(p2, { seed: 'card-sheet', cls: 'Fighter' });
    await die(p2);
    await p2.click('#end-card');
    await expect(p2.locator('#end-card')).toHaveText('Shared');
    const sent = await p2.evaluate(() => window.__sent);
    expect(sent.name).toBe('deepdelve-card-sheet.png');
    expect(sent.type).toBe('image/png');
    expect(sent.size).toBeGreaterThan(5000);
    expect(sent.text).toMatch(/^Deepdelve seed card-sheet/);
    await phone.close();
  });

  test("a phone with a share sheet shares through it, and closing the sheet is not a failure", async ({ page }) => {
    const errors = watchForErrors(page);
    // a stand-in for the phone's sheet: the first time it is closed unchosen, then something is picked
    await page.addInitScript(() => {
      window.__sheet = [];
      navigator.share = async d => { window.__sheet.push(d.text); if (window.__sheet.length === 1) throw new DOMException('closed', 'AbortError'); };
    });
    await startGame(page, { seed: 'share-sheet', cls: 'Fighter' });
    await clearBoons(page);
    // sworn as a Hard winner could swear it: the vow goes in the line too
    await page.evaluate(() => { Game.state().opts.vows = ['iron']; });
    await faceOpenGround(page, 2);
    await placeMonster(page, 'ogre', 1, { hp: 400, maxHp: 400, nextAct: 0 });
    await page.evaluate(() => { Game.player().hp = 1; });
    await expect.poll(() => page.evaluate(() => Game.state().status), { timeout: 15_000 }).toBe('dead');
    await page.click('#end-share');
    await expect.poll(() => page.evaluate(() => window.__sheet.length)).toBe(1);
    await expect(page.locator('#end-share'), 'closing the sheet leaves the button as it was').toHaveText('Share this run');
    await page.click('#end-share');
    await expect(page.locator('#end-share')).toHaveText('Shared');
    const sent = await page.evaluate(() => window.__sheet[1]);
    expect(sent).toMatch(/^Deepdelve seed share-sheet \(Normal, Iron Vow\): Fighter, fell on floor 1, /);
    await expect(page.locator('#end-share-line')).toHaveText(sent);
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

  test('the Ranger & Druid Daily is there from the start, deals one of the two, and keeps apart from the first Daily', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.clock.setFixedTime(DAY);
    await page.addInitScript(() => localStorage.setItem('deepdelve.tipsOff', '1'));
    await page.goto('/');
    // one Daily button, and a switch under it: set to the Ranger & Druid, it says so
    await expect(page.locator('#btn-daily-earned')).toBeVisible();
    await expect(page.locator('#btn-daily')).toContainText('Daily Delve');
    const cls = await page.evaluate(async () => (await import('./js/daily.js')).Daily.heroFor('2026-09-24', 'earned').cls);
    expect(['ranger', 'druid']).toContain(cls);
    await page.click('#btn-daily-earned');
    await expect(page.locator('#btn-daily-earned')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#btn-daily')).toContainText('Ranger & Druid Daily');
    await expect(page.locator('#btn-daily')).toContainText('A Ranger or a Druid, one try');
    await page.click('#btn-daily');
    await expect(page.locator('#pro-rules')).toContainText('Ranger & Druid Daily');
    await page.click('#pro-begin');
    await page.waitForFunction(() => typeof Game !== 'undefined' && !!Game.state());
    const run = await page.evaluate(() => ({ seed: Game.state().seed, cls: Game.player().cls, kind: Game.state().opts.dailyKind }));
    expect(run).toEqual({ seed: 'daily-earned-2026-09-24', cls, kind: 'earned' });
    await page.evaluate(() => Game.save(true));
    await page.goto('/');
    await expect(page.locator('#daily-earned-summary')).toContainText('waits on floor 1');
    await expect(page.locator('#daily-summary')).not.toContainText('waits');
    // the switch is as it was left; set back, the button is the first Daily again
    await expect(page.locator('#btn-daily')).toContainText('waits on floor 1');
    await page.click('#btn-daily-main');
    await expect(page.locator('#daily-name')).toHaveText('Daily Delve');
    await expect(page.locator('#daily-summary')).toBeVisible();
    await expect(page.locator('#daily-earned-summary')).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('a Daily run that used a testing aid keeps no result, so its end offers none to share', async ({ page }) => {
    const errors = watchForErrors(page);
    await startDaily(page);
    await clearBoons(page);
    await page.click('[data-open="menu"]');
    // (the testing tools are folded away until opened)
    await page.click('#m-testing');
    await page.click('#m-test-map');
    await page.click('#m-test-map');
    await page.click('#ov-map [data-close]');
    await faceOpenGround(page, 2);
    await placeMonster(page, 'ogre', 1, { hp: 400, maxHp: 400, nextAct: 0 });
    await page.evaluate(() => { Game.player().hp = 1; });
    await expect.poll(() => page.evaluate(() => Game.state().status), { timeout: 15_000 }).toBe('dead');
    await expect(page.locator('#screen-end')).toBeVisible();
    await expect(page.locator('#end-share')).toBeHidden();
    await expect(page.locator('#end-card')).toBeVisible();
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
    // a new hero would spend today's one try: the question says so
    await page.click('#btn-new');
    await expect(page.locator('#confirm-who')).toContainText("today's Daily Delve, your one try");
    // and so would a hero loaded from a save code
    await page.goto('/');
    await page.click('#btn-code');
    await expect(page.locator('#code-warn')).toContainText("today's Daily Delve, your one try");
    await page.goto('/');
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
    // yesterday's try is spent either way: no warning about it
    await expect(page.locator('#confirm-who')).not.toContainText('one try');
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

  test('choosing another background draws a name to suit it, but never over one the player typed', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto('/');
    await page.click('#btn-new');
    const open = page.locator('.bg-card:not(.locked)');
    expect(await open.count()).toBeGreaterThan(1);
    const before = await page.inputValue('#c-name');
    await open.nth(1).click();
    const after = await page.inputValue('#c-name');
    expect(after).not.toBe(before);
    expect(await page.evaluate(() => window.HERO_NAMES)).toContain(after);
    await page.fill('#c-name', 'Mine');
    await open.nth(0).click();
    expect(await page.inputValue('#c-name')).toBe('Mine');
    // even typed to match the name the game drew, it is the player's now
    await page.click('#c-name-rand');
    const drawn = await page.inputValue('#c-name');
    await page.fill('#c-name', drawn);
    await open.nth(1).click();
    expect(await page.inputValue('#c-name')).toBe(drawn);
    expect(errors).toEqual([]);
  });

  test('a new hero arrives already named, a different name each time, and a name typed over it is kept', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto('/');
    await page.click('#btn-new');
    const names = await page.evaluate(() => window.HERO_NAMES);
    const first = await page.inputValue('#c-name');
    expect(names).toContain(first);
    await page.click('#c-back');
    await page.click('#btn-new');
    const again = await page.inputValue('#c-name');
    expect(names).toContain(again);
    expect(again).not.toBe(first);
    await page.fill('#c-name', 'Gwendolyn');
    await page.fill('#c-seed', 'typed-name');
    await page.click('#c-begin');
    await page.click('#pro-begin');
    await page.waitForFunction(() => typeof Game !== 'undefined' && !!Game.state());
    expect(await page.evaluate(() => Game.player().name)).toBe('Gwendolyn');
    expect(errors).toEqual([]);
  });
});
