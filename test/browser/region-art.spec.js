'use strict';
const { test, expect } = require('@playwright/test');
const { startGame, faceOpenGround, placeMonster, artReady, watchForErrors } = require('./helpers');

async function surfaces(page) {
  await page.evaluate(async () => { window.__surfaceState = (await import('/js/paintedworld.js')).paintedWorldState; });
  // Exercise the same properties on each reload before waiting for demand-loaded art.
  await page.evaluate(() => { for(const t of Assets.themes) { void t.wall; void t.wallB; void t.door; void t.decor; t.floorOf(0); t.floorOf(4); for(const k of Object.keys(t.locked)) void t.locked[k]; } });
  await page.waitForFunction(() => Object.entries(window.__surfaceState()).filter(([p]) => p.includes('/materials/')).every(([, s]) => s === 'ready'));
  return page.evaluate(async () => {
    const { Dice, Odds } = await import('/js/rng.js');
    const before = [Dice.s, Odds.s];
    const hash = pixels => {
      let h = 2166136261;
      for (const v of pixels) h = Math.imul(h ^ v, 16777619);
      return h >>> 0;
    };
    const pixels = c => c.getContext('2d').getImageData(0, 0, 64, 64).data;
    const locks = {};
    const result = Assets.themes.map((t, i) => {
      for (const key of Object.keys(t.locked)) {
        // The entire coloured plate, keyhole and corner rivets stay identical
        // across regions, even where the door itself changes material.
        const patch = t.locked[key].getContext('2d').getImageData(38, 27, 14, 16).data;
        (locks[key] ||= []).push(hash(patch));
      }
      const dry = t.floorOf(0), wet = t.floorOf(4);
      const blue = arr => arr.reduce((sum, v) => sum + ((v >>> 16) & 255) - (v & 255), 0) / arr.length;
      return {
        name: THEMES[i].name, face: THEMES[i].face,
        wall: hash(pixels(t.wall)), floor: hash(dry[0]), door: hash(pixels(t.door)),
        cached: dry === t.floor && dry === t.floorOf(0) && t.wallB === t.wallB && t.decor === t.decor,
        opaque: dry.every(level => level.length === 4096 && level.every(v => (v >>> 24) === 255)),
        levels: dry.length, water: blue(wet[0]) - blue(dry[0]),
      };
    });
    return { result, locks, diceUntouched: Dice.s === before[0] && Odds.s === before[1] };
  });
}

test('regional materials keep coded locks, water, shade caches and run dice intact @mobile', async ({ page }) => {
  const errors = watchForErrors(page);
  await page.goto('/'); await page.waitForFunction(() => window.Assets?.themes.length);
  const { result, locks, diceUntouched } = await surfaces(page);
  expect(diceUntouched).toBe(true);
  for (const [key, signatures] of Object.entries(locks)) expect(new Set(signatures).size, key).toBe(1);
  for (const t of result) { expect(t.cached, t.name).toBe(true); expect(t.opaque, t.name).toBe(true); expect(t.levels).toBe(8); }
  expect(result.find(t => t.face === 'reed').water, 'water stays bluer than dry marsh mud').toBeGreaterThan(8);
  const identities = ['Brown Catacombs', 'The Grey Hold', 'The Sunless Marsh'].map(name => result.find(t => t.name === name));
  expect(new Set(identities.map(t => t.door)).size).toBe(3);
  expect(new Set(identities.map(t => t.floor)).size).toBe(3);
  expect(errors).toEqual([]);
});

test('regional stone and wood are stable across a full page reload', async ({ page }) => {
  await page.goto('/'); await page.waitForFunction(() => window.Assets?.themes.length);
  const before = (await surfaces(page)).result;
  await page.reload(); await page.waitForFunction(() => window.Assets?.themes.length);
  expect((await surfaces(page)).result).toEqual(before);
});

test('every region renders the same visible foe with its own scenery in Calm view @mobile', async ({ page }, testInfo) => {
  const errors = watchForErrors(page);
  await startGame(page, { seed: 'regional-scenery', permadeath: false });
  await artReady(page); await faceOpenGround(page);
  await page.evaluate(() => { Game.level().monsters = []; });
  expect(await placeMonster(page, 'orc', 2, { hp: 300, maxHp: 300 })).not.toBeNull();
  const out = await page.evaluate(() => {
    Renderer.setCalm(true);
    const now = performance.now(), state = Game.renderState(now), view = document.querySelector('#view');
    const sheet = document.createElement('canvas'); sheet.width = view.width * 3; sheet.height = (view.height + 24) * Math.ceil(THEMES.length / 3);
    const c = sheet.getContext('2d'); c.font = '14px sans-serif';
    const regions = THEMES.map((theme, i) => {
      const level = { ...state.level, theme: i };
      Renderer.render(level, state.cam, state.sprites, state.fx, now);
      const shown = Renderer.shown;
      const x = i % 3 * view.width, y = Math.floor(i / 3) * (view.height + 24);
      c.fillStyle = '#15141a'; c.fillRect(x, y, view.width, view.height + 24); c.fillStyle = '#eee'; c.fillText(theme.name, x + 8, y + 17);
      c.drawImage(view, x, y + 24);
      return { name: theme.name, shown };
    });
    return { regions, sheet: sheet.toDataURL().split(',')[1] };
  });
  for (const region of out.regions) expect(region.shown, region.name).toEqual(out.regions[0].shown);
  expect(out.regions[0].shown.length, 'the nearby foe remains visible').toBeGreaterThan(0);
  await testInfo.attach('regional-scenes', { body: Buffer.from(out.sheet, 'base64'), contentType: 'image/png' });
  if (process.env.REGION_REVIEW_OUT) require('fs').writeFileSync(process.env.REGION_REVIEW_OUT, Buffer.from(out.sheet, 'base64'));
  expect(errors).toEqual([]);
});
