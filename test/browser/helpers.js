'use strict';
// Shared helpers for the browser suites. Everything a spec needs to get from a
// cold page into a running game, and to reach in and set up a situation.
const { expect } = require('@playwright/test');

// Warnings the tests provoke themselves rather than faults in the game. Keep
// this list short and justified; anything else should fail the run.
const BENIGN = [
  // raised by specs that sample canvas pixels to prove the view is animating
  /willReadFrequently/,
];

/** Fail the test on any page error or console error, rather than passing silently. */
function watchForErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => {
    if (m.type() !== 'error' && m.type() !== 'warning') return;
    const text = m.text();
    if (BENIGN.some(re => re.test(text))) return;
    errors.push(`${m.type()}: ${text}`);
  });
  return errors;
}

/**
 * Create a character and step through the prologue into the dungeon.
 * @param {import('@playwright/test').Page} page
 * @param {{seed?: string, cls?: number, bg?: string, levels?: string, name?: string}} [opts]
 */
async function startGame(page, opts = {}) {
  await page.goto('/');
  await page.click('#btn-new');
  if (opts.name) await page.fill('#c-name', opts.name);
  // a class by name reads better than a position and survives reordering
  if (typeof opts.cls === 'number') await page.click(`.class-card:nth-child(${opts.cls})`);
  else if (opts.cls) await page.locator('.class-card', { has: page.locator('b', { hasText: new RegExp(`^${opts.cls}$`, 'i') }) }).click();
  if (opts.bg) await page.locator('.bg-card', { hasText: opts.bg }).click();
  if (opts.levels) await page.selectOption('#c-levels', opts.levels);
  await page.fill('#c-seed', opts.seed || 'spec');
  await page.click('#c-begin');
  await expect(page.locator('#screen-prologue')).toBeVisible();
  await page.click('#pro-begin');
  await expect(page.locator('#screen-game')).toBeVisible();
  await page.waitForFunction(() => typeof Game !== 'undefined' && !!Game.state());
}

/** Levelling opens a modal choice that blocks the rest of the interface. */
async function clearBoons(page) {
  for (let i = 0; i < 20; i++) {
    if (!(await page.locator('#ov-boons.open').isVisible())) return;
    await page.locator('#boon-list .boon').first().click();
    // Self-Taught asks where its two points go
    if (await page.locator('.spread-stat').count()) { await page.locator('.spread-stat:not(.full)').first().click(); await page.locator('.spread-stat:not(.full)').first().click(); }
    await page.waitForTimeout(60);
  }
}

/** Turn on the spot until at least `want` open floor tiles lie straight ahead. */
async function faceOpenGround(page, want = 3) {
  return page.evaluate(async (n) => {
    const p = Game.player(), L = Game.level(), T = Dungeon.T;
    const ahead = () => {
      const D = Dungeon.DIRS[p.dir];
      let k = 0;
      for (let i = 1; i <= 6; i++) {
        if (L.tiles[(p.y + D[1] * i) * L.w + (p.x + D[0] * i)] === T.FLOOR) k++;
        else break;
      }
      return k;
    };
    for (let t = 0; t < 4 && ahead() < n; t++) {
      Game.input('right');
      await new Promise(r => setTimeout(r, 300));
    }
    return ahead();
  }, want);
}

/** Put a monster a given number of tiles directly in front of the player. */
async function placeMonster(page, id, distance, patch = {}) {
  return page.evaluate(({ id, distance, patch }) => {
    const p = Game.player(), L = Game.level(), T = Dungeon.T;
    const D = Dungeon.DIRS[p.dir];
    const x = p.x + D[0] * distance, y = p.y + D[1] * distance;
    if (L.tiles[y * L.w + x] !== T.FLOOR) return null;
    const base = MONSTERS[id];
    const hp = patch.hp || 20;
    const m = Object.assign({
      uid: 90000 + Math.floor(Math.random() * 1000), id, x, y, hp, maxHp: patch.maxHp || hp,
      awake: true, nextAct: 1e12, rx: x, ry: y, fromX: x, fromY: y,
      moveT0: 0, moveT1: 0, flashUntil: 0,
    }, patch);
    m.x = x; m.y = y; m.rx = x; m.ry = y;
    L.monsters.push(m);
    return { uid: m.uid, name: base.name, x, y };
  }, { id, distance, patch });
}

/** Swing until the monster with this uid is gone, or give up. */
async function killMonster(page, uid, swings = 40) {
  return page.evaluate(async ({ uid, swings }) => {
    const L = Game.level(), p = Game.player();
    for (let i = 0; i < swings; i++) {
      if (!L.monsters.some(m => m.uid === uid)) return true;
      p.nextAttack = 0;
      Game.input('attack');
      await new Promise(r => setTimeout(r, 40));
    }
    return !L.monsters.some(m => m.uid === uid);
  }, { uid, swings });
}

/** Walk down to the given depth using each level's own stairs. */
async function descendTo(page, depth) {
  return page.evaluate(async (target) => {
    const G = Game.state(), p = G.player;
    for (let guard = 0; G.depth < target && guard < 20; guard++) {
      const L = Game.level();
      if (!L.downStart) break;
      p.x = L.downStart.x; p.y = L.downStart.y; p.dir = (L.downStart.dir + 2) % 4;
      Game.input('forward');
      // at the divided stair, the Warrens
      if (Game.forkPending()) Game.chooseRoute('warrens');
      await new Promise(r => setTimeout(r, 280));
    }
    return G.depth;
  }, depth);
}

module.exports = { watchForErrors, startGame, clearBoons, faceOpenGround, placeMonster, killMonster, descendTo, expect };
