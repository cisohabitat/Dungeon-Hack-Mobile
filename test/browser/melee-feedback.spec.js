'use strict';
const { test, expect } = require('@playwright/test');
const { startGame, faceOpenGround, placeMonster, artReady, watchForErrors } = require('./helpers');

async function setup(page) {
  await page.addInitScript(() => {
    localStorage.setItem('deepdelve.sound', 'off');
    localStorage.setItem('deepdelve.prelude', 'off');
  });
  await startGame(page, { seed: 'melee-preview' });
  await page.evaluate(() => { Game.level().monsters.length = 0; });
  expect(await faceOpenGround(page, 2)).toBeGreaterThanOrEqual(2);
  await placeMonster(page, 'orc', 1, { hp: 999, maxHp: 999, nextAct: 1e12 });
  await artReady(page);
}

test('a close blow leaves a short impact; blocked plates and arrows do not claim a melee hit', async ({ page }) => {
  const errors = watchForErrors(page);
  await setup(page);
  const result = await page.evaluate(() => {
    const p = Game.player(), m = Game.level().monsters[0];
    let metal = false;
    Sound.listen((name, o) => { if (name === 'block' && o.metal) metal = true; });
    const hit = weapon => {
      p.eq.weapon = { t: weapon, q: 1, e: 0 }; delete m.meleeImpact;
      const before = m.hp;
      for (let i = 0; i < 40 && m.hp === before; i++) { p.nextAttack = 0; Game.input('attack'); }
      return m.meleeImpact;
    };
    const blade = hit('longsword'), blunt = hit('mace');
    const now = blunt.at;
    const hasImpact = time => Game.renderState(time).sprites.some(s => !!s.impact);
    const active = hasImpact(now + 40), early = hasImpact(now - 1), expired = hasImpact(now + 181);
    const arrow = hit('longbow');
    m.elite = 'Armoured'; m.plated = false; delete m.meleeImpact;
    p.eq.weapon = { t: 'longsword', q: 1, e: 0 };
    const hp = m.hp;
    for (let i = 0; i < 40 && !m.plated; i++) { p.nextAttack = 0; Game.input('attack'); }
    const result = { blade: blade.kind, blunt: blunt.kind, active, early, expired, arrow: !!arrow, plated: m.plated, blockedImpact: !!m.meleeImpact, blockedDamage: hp - m.hp, metal };
    m.meleeImpact = { at: performance.now(), kind: 'slash', critical: false };
    Game.save(true); Game.load();
    return { ...result, restoredImpact: Game.level().monsters.some(m => !!m.meleeImpact) };
  });
  expect(result).toEqual({ blade: 'slash', blunt: 'blunt', active: true, early: false, expired: false, arrow: false, plated: true, blockedImpact: false, blockedDamage: 0, metal: true, restoredImpact: false });
  expect(errors).toEqual([]);
});

test('the impact is visible, smaller in Calm view, and hidden behind stone', async ({ page }, testInfo) => {
  const errors = watchForErrors(page);
  await setup(page);
  const result = await page.evaluate(() => {
    const m = Game.level().monsters[0], p = Game.player(), L = Game.level();
    const at = performance.now();
    m.meleeImpact = { at, kind: 'slash', critical: true };
    const rs = Game.renderState(at + 60), ctx = document.querySelector('#view').getContext('2d');
    const render = Renderer.render;
    const difference = calm => {
      Renderer.setCalm(calm);
      render(rs.level, rs.cam, rs.sprites.map(s => ({ ...s, impact: null })), rs.fx, at + 60);
      const a = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height).data;
      render(rs.level, rs.cam, rs.sprites, rs.fx, at + 60);
      const b = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height).data;
      let n = 0;
      for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) n++;
      return n;
    };
    const normal = difference(false), calm = difference(true);
    // Put the creature two squares away with stone between it and the hero.
    const [dx, dy] = Dungeon.DIRS[p.dir], tile = (p.y + dy) * L.w + p.x + dx, old = L.tiles[tile];
    for (const s of rs.sprites) if (s.impact) { s.x += dx; s.y += dy; }
    L.tiles[tile] = Dungeon.T.WALL;
    const hidden = difference(false);
    L.tiles[tile] = old;
    for (const s of rs.sprites) if (s.impact) { s.x -= dx; s.y -= dy; }
    // Hold this actual render state for a reviewable screenshot.
    Renderer.render = () => render(rs.level, rs.cam, rs.sprites, rs.fx, at + 60);
    return { normal, calm, hidden };
  });
  expect(result.normal).toBeGreaterThan(10);
  expect(result.calm).toBeGreaterThan(0);
  expect(result.calm).toBeLessThan(result.normal);
  expect(result.hidden).toBe(0);
  await page.screenshot({ path: testInfo.outputPath('melee-impact-preview.png') });
  expect(errors).toEqual([]);
});

test('a late wind-up keeps its warning readable beside an impact in Calm view', async ({ page }, testInfo) => {
  await setup(page);
  await page.evaluate(() => {
    const m = Game.level().monsters[0], at = performance.now();
    m.windup = { at: Game.state().t - 800, until: Game.state().t + 200, kind: 'melee' };
    m.meleeImpact = { at, kind: 'slash', critical: false };
    const rs = Game.renderState(at + 40), render = Renderer.render;
    Renderer.setCalm(true);
    Renderer.render = () => render(rs.level, rs.cam, rs.sprites, rs.fx, at + 40);
  });
  await expect.poll(() => page.evaluate(() => Renderer.shown.some(s => s.markSize > 0))).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('windup-calm-preview.png') });
});
