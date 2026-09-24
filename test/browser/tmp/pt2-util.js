'use strict';
const fs = require('fs');
const OUT = '/tmp/claude-0/-home-user-Dungeon-Hack-Mobile/0ea3aa4c-4ff7-53aa-a82b-10845959c612/scratchpad/playtest2';
function errs(page, tag) {
  const list = [];
  page.on('pageerror', e => list.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') list.push(`${m.type()}: ${m.text()}`); });
  return { list, dump() { fs.writeFileSync(`${OUT}/${tag}-errors.json`, JSON.stringify(list, null, 1)); } };
}
async function shot(page, name, full) { await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: !!full }); }
function note(tag, obj) { fs.appendFileSync(`${OUT}/${tag}-notes.txt`, (typeof obj === 'string' ? obj : JSON.stringify(obj)) + '\n'); }
const logTail = (page, n = 6) => page.evaluate(n => Game.state().log.slice(-n).map(l => l.m), n);
module.exports = { OUT, errs, shot, note, logTail };
const { expect } = require('@playwright/test');
async function startUI(page, { cls, diff, seed, levels }) {
  await page.goto('/');
  await page.click('#btn-new');
  if (await page.locator('#screen-confirm.active').count()) await page.click('#confirm-replace');
  if (diff) await page.click(`[data-diff="${diff}"]`);
  await page.click('#c-name-rand');
  if (cls) await page.locator('.class-card', { has: page.locator('b', { hasText: new RegExp(`^${cls}$`, 'i') }) }).click();
  if (levels) await page.selectOption('#c-levels', levels);
  if (seed) await page.fill('#c-seed', seed);
  await page.click('#c-begin');
  await page.click('#pro-begin');
  await page.waitForFunction(() => typeof Game !== 'undefined' && !!Game.state());
}
async function clearBoons(page) {
  for (let i = 0; i < 20; i++) {
    if (!(await page.locator('#ov-boons.open').isVisible())) return;
    await page.locator('#boon-list .boon').first().click();
    await page.waitForTimeout(80);
  }
}
async function descendTo(page, depth) {
  return page.evaluate(async (target) => {
    const G = Game.state(), p = G.player;
    for (let guard = 0; G.depth < target && guard < 20; guard++) {
      const L = Game.level();
      if (!L.downStart) break;
      p.x = L.downStart.x; p.y = L.downStart.y; p.dir = (L.downStart.dir + 2) % 4;
      Game.input('forward');
      await new Promise(r => setTimeout(r, 300));
    }
    return G.depth;
  }, depth);
}
/** clear ground: monsters gone, a straight line of floor ahead and behind */
async function arena(page) {
  return page.evaluate(() => {
    const p = Game.player(), L = Game.level(), T = Dungeon.T;
    L.monsters.length = 0;
    const [dx, dy] = Dungeon.DIRS[p.dir];
    for (let k = -3; k <= 5; k++) { const x = p.x + dx * k, y = p.y + dy * k; if (x > 0 && y > 0 && x < L.w - 1 && y < L.h - 1) L.tiles[y * L.w + x] = T.FLOOR; }
    return true;
  });
}
async function place(page, id, dist, patch = {}) {
  return page.evaluate(({ id, dist, patch }) => {
    const p = Game.player(), L = Game.level(), G = Game.state();
    const [dx, dy] = Dungeon.DIRS[p.dir];
    const x = p.x + dx * dist, y = p.y + dy * dist;
    const hp = patch.hp || 40;
    const m = Object.assign({ uid: 90000 + Math.floor(Math.random() * 1000), id, x, y, hp, maxHp: hp, awake: true, spoke: true, nextAct: G.t + 200, rx: x, ry: y, fromX: x, fromY: y, moveT0: 0, moveT1: 0, flashUntil: 0 }, patch);
    L.monsters.push(m);
    return m.uid;
  }, { id, dist, patch });
}
const tapAct = async (page, act) => { await page.tap(`.ctl[data-act="${act}"]`); };
module.exports.startUI = startUI; module.exports.clearBoons = clearBoons; module.exports.descendTo = descendTo; module.exports.arena = arena; module.exports.place = place; module.exports.tapAct = tapAct;
