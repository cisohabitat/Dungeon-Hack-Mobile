'use strict';
// Accessibility: axe looks over every screen and overlay a player can reach,
// and none may hold a fault it rates serious or critical.
const { test } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { expect, startGame, clearBoons, faceOpenGround, placeMonster } = require('./helpers');

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const BAR = ['serious', 'critical'];

/** Every fault axe finds on the page as it stands, under the name of where it was. */
async function scan(page, where, found) {
  await page.waitForTimeout(250);   // overlays fade in
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  for (const v of r.violations) {
    for (const n of v.nodes) found.push({ where, rule: v.id, impact: v.impact, target: n.target.join(' '), help: v.help, summary: n.failureSummary });
  }
}
function report(found) {
  const by = {};
  for (const f of found) { const k = `${f.impact} ${f.rule}`; (by[k] = by[k] || { n: 0, where: new Set(), eg: [] }).n++; by[k].where.add(f.where); if (by[k].eg.length < 4 && !by[k].eg.includes(f.target)) by[k].eg.push(f.target); }
  for (const [k, v] of Object.entries(by).sort()) console.log(`AXE ${k}: ${v.n} in ${[...v.where].join(', ')} e.g. ${v.eg.join(' | ')}`);
  return found.filter(f => BAR.includes(f.impact));
}

test('the title, the hero\'s making and the screens off the title', async ({ page }) => {
  test.setTimeout(120_000);
  const found = [];
  await page.goto('/');
  await expect(page.locator('#screen-title')).toBeVisible();
  // the opening's fade over, so the colours are read as they stand
  await expect(page.locator('#screen-title')).not.toHaveClass(/opening/, { timeout: 5000 });
  await scan(page, 'title', found);
  for (const [btn, screen, back] of [['#btn-hall', '#screen-hall', '#hall-back'], ['#btn-beasts', '#screen-beasts', null], ['#btn-help', '#screen-help', null], ['#btn-code', '#screen-code', null]]) {
    await page.click(btn);
    await expect(page.locator(screen)).toBeVisible();
    await scan(page, screen.slice(8), found);
    if (screen === '#screen-hall') {
      await page.click('#hall-relics');
      await expect(page.locator('#screen-relics')).toBeVisible();
      await scan(page, 'relics', found);
    }
    await page.goto('/');
  }
  await page.click('#btn-new');
  await expect(page.locator('#screen-create')).toBeVisible();
  await scan(page, 'create', found);
  // and with everything a player can earn open: the second kit, the hound, the vows, and the same in the Hall
  await page.evaluate(() => localStorage.setItem('deepdelve.progress', JSON.stringify({ won: { fighter: { hard: 1, normal: 1 } }, relics: [], feats: { veteran: 1 } })));
  await page.goto('/');
  await page.click('#btn-hall');
  await expect(page.locator('[data-trophy="unlock-kit:fighter"]')).toHaveClass(/open/);
  await scan(page, 'hall-unlocked', found);
  await page.goto('/');
  await page.click('#btn-new');
  await page.click('[data-kit="alt"]');
  await expect(page.locator('#c-vows')).toBeVisible();
  await page.click('#c-difficulty [data-diff="hard"]');
  await page.click('#c-rung [data-rung="1"]');
  await scan(page, 'create-unlocked', found);
  await page.evaluate(() => localStorage.removeItem('deepdelve.progress'));
  await page.fill('#c-seed', 'a11y');
  await page.click('#c-begin');
  await expect(page.locator('#screen-prologue')).toBeVisible();
  await scan(page, 'prologue', found);
  const bad = report(found);
  expect(bad, JSON.stringify(bad, null, 1)).toEqual([]);
});

test('the dungeon and every overlay in it', async ({ page }) => {
  test.setTimeout(180_000);
  const found = [];
  await startGame(page, { seed: 'a11y', cls: 'mage' });
  await clearBoons(page);
  await scan(page, 'game', found);
  for (const name of ['menu', 'map', 'inv', 'spells', 'char', 'journal']) {
    await page.click(`[data-open="${name}"]`);
    await expect(page.locator(`#ov-${name}`)).toHaveClass(/open/);
    await scan(page, name, found);
    // the journal's other pages, the combinations among them
    if (name === 'journal') for (const tab of ['beasts', 'relics', 'combos']) { await page.click(`[data-jtab="${tab}"]`); await scan(page, 'journal-' + tab, found); }
    await page.keyboard.press('Escape');
    await expect(page.locator(`#ov-${name}`)).not.toHaveClass(/open/);
  }
  // a level's choice
  await page.evaluate(() => Game.testLevel());
  await expect(page.locator('#ov-boons')).toHaveClass(/open/);
  await scan(page, 'boons', found);
  await clearBoons(page);
  // the save code, from the Menu
  await page.click('[data-open="menu"]');
  await page.click('#m-code');
  await expect(page.locator('#ov-code')).toHaveClass(/open/);
  await scan(page, 'code', found);
  await page.keyboard.press('Escape');
  // a trader
  await page.evaluate(() => {
    const p = Game.player(), L = Game.level(), [dx, dy] = Dungeon.DIRS[p.dir];
    L.monsters.length = 0; L.npcs.length = 0;
    L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR;
    L.npcs.push({ id: 'merchant', x: p.x + dx, y: p.y + dy, markup: 2, stock: [], greeted: false });
    Game.input('forward');
  });
  await expect(page.locator('#ov-shop')).toHaveClass(/open/);
  await scan(page, 'shop', found);
  await page.evaluate(() => document.querySelector('#ov-shop [data-close]').click());
  // the end, fallen
  await page.evaluate(() => { Game.level().npcs.length = 0; });
  await faceOpenGround(page, 2);
  await placeMonster(page, 'ogre', 1, { hp: 400, maxHp: 400, nextAct: 0 });
  await page.evaluate(() => { const p = Game.player(); p.hp = 1; p.eq.armor = null; p.eq.shield = null; });
  await expect(page.locator('#screen-end')).toBeVisible({ timeout: 25_000 });
  await scan(page, 'end', found);
  const bad = report(found);
  expect(bad, JSON.stringify(bad, null, 1)).toEqual([]);
});

test('an encounter', async ({ page }) => {
  test.setTimeout(120_000);
  const found = [];
  await startGame(page, { seed: 'a11y' });
  await clearBoons(page);
  // the first floor with an encounter: stand before it and use it
  const placed = await page.evaluate(() => {
    for (let d = 0; d < 6; d++) {
      const L = Game.level(), p = Game.player(), T = Dungeon.T;
      const e = L.npcs.find(n => n.kind === 'encounter');
      if (e) {
        L.monsters.length = 0;
        for (let k = 0; k < 4; k++) {
          const [dx, dy] = Dungeon.DIRS[k];
          if (L.tiles[(e.y - dy) * L.w + (e.x - dx)] === T.FLOOR) { p.x = e.x - dx; p.y = e.y - dy; p.dir = k; return true; }
        }
      }
      L.monsters.length = 0; Game.descend(); if (Game.forkPending()) Game.chooseRoute('crypts');
    }
    return false;
  });
  expect(placed).toBe(true);
  await page.locator('[data-tap="use"]').click();
  await expect(page.locator('#ov-encounter')).toHaveClass(/open/);
  await scan(page, 'encounter', found);
  const bad = report(found);
  expect(bad, JSON.stringify(bad, null, 1)).toEqual([]);
});

test('the divided stair', async ({ page }) => {
  const found = [];
  await startGame(page, { seed: 'play-fork' });
  await clearBoons(page);
  await page.evaluate(() => { for (let d = 1; d < 3; d++) { Game.level().monsters.length = 0; Game.descend(); } });
  await page.evaluate(() => {
    const L = Game.level(), p = Game.player();
    L.monsters.length = 0;
    p.x = L.downStart.x; p.y = L.downStart.y; p.dir = (L.downStart.dir + 2) % 4;
    Game.input('forward');
  });
  await expect(page.locator('#ov-fork')).toHaveClass(/open/);
  await scan(page, 'fork', found);
  const bad = report(found);
  expect(bad, JSON.stringify(bad, null, 1)).toEqual([]);
});
