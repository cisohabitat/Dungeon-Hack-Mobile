'use strict';
// The sound pack in play (js/samples.js): blows, doors and steps from the
// pack, a stinger for a level, the floor's four music stems following the
// fight, and its ambience under the drone. The tests start with the pack off
// (as they do with the way in), so this one turns it on.
const { test } = require('@playwright/test');
const { expect, startGame, clearBoons, watchForErrors } = require('./helpers');

test('with the sound pack on, the game plays its samples, its music stems follow the fight, and its ambience loops', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = watchForErrors(page);
  await page.addInitScript(() => localStorage.setItem('deepdelve.samples', 'on'));
  await startGame(page, { seed: 'sound-pack' });
  await clearBoons(page);
  await page.evaluate(() => { if (!Sound.isEnabled()) Sound.toggle(); if (!Music.isEnabled()) Music.toggle(); Sound.unlock(); });
  // the list arrives, and the everyday sounds behind it
  await expect.poll(() => page.evaluate(() => Samples.state().listed), { timeout: 15_000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => Samples.state().waiting), { timeout: 40_000 }).toBe(0);
  expect(await page.evaluate(() => Samples.state().failed)).toBe(0);
  // a blow, a door pulled shut, a step, a level: each from the pack
  await page.evaluate(() => { Sound.play('hit', {}); Sound.play('door', { how: 'shut' }); Sound.play('step', {}); Sound.play('levelup'); });
  const played = await page.evaluate(() => Samples.state().played);
  for (const id of ['hit-blade', 'door-close', 'step-stone', 'stinger:level-up']) expect(played, id).toContain(id);
  // the first floor's music theme: its stems take over from the composer, quiet at first
  await expect.poll(() => page.evaluate(() => Music.state().stems), { timeout: 30_000 }).toBe('halls');
  expect(await page.evaluate(() => Music.state().layers)).toEqual(['explore']);
  // a goblin awake beside the hero: the fight's layers come in
  await page.evaluate(() => {
    const p = Game.player(), L = Game.level(), [dx, dy] = Dungeon.DIRS[p.dir];
    p.hp = p.maxHp = 999;
    L.monsters.length = 0;
    L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR;
    L.monsters.push({ uid: 7, id: 'goblin', x: p.x + dx, y: p.y + dy, hp: 999, maxHp: 999, awake: true, nextAct: 1e12, rx: p.x + dx, ry: p.y + dy, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 });
  });
  await expect.poll(() => page.evaluate(() => Music.state().layers), { timeout: 5000 }).toEqual(['explore', 'tension', 'fight']);
  // and the floor's ambience loops under the drone
  await expect.poll(() => page.evaluate(() => Sound.mix().bed), { timeout: 15_000 }).toBe('halls');
  expect(errors).toEqual([]);
});

test('with the sound pack off, everything is synthesised as before', async ({ page }) => {
  const errors = watchForErrors(page);
  await page.addInitScript(() => localStorage.setItem('deepdelve.samples', 'off'));
  await startGame(page, { seed: 'sound-pack-off' });
  await clearBoons(page);
  await page.evaluate(() => { if (!Sound.isEnabled()) Sound.toggle(); Sound.unlock(); window.__heard = []; Sound.listen(n => window.__heard.push(n)); Sound.play('hit', {}); });
  await page.waitForTimeout(1500);
  const s = await page.evaluate(() => ({ samples: Samples.state(), heard: window.__heard, stems: Music.state().stems, bed: Sound.mix().bed }));
  expect(s.samples.on).toBe(false);
  expect(s.samples.played).toEqual([]);
  expect(s.heard).toContain('hit');
  expect(s.stems).toBe('');
  expect(s.bed).toBe('');
  expect(errors).toEqual([]);
});

test('with the sound pack on, the first tap at the title plays its cue in place of the synthesised swell', async ({ page }) => {
  const errors = watchForErrors(page);
  await page.addInitScript(() => { localStorage.setItem('deepdelve.samples', 'on'); localStorage.setItem('deepdelve.firstSeen', '1'); });
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => !!Samples.ready('music/title')), { timeout: 20_000 }).toBe(true);
  await page.mouse.click(180, 120);
  await expect.poll(() => page.evaluate(() => Music.state().swelled)).toBe(true);
  expect(await page.evaluate(() => Music.state().cue)).toBe(true);
  expect(errors).toEqual([]);
});
