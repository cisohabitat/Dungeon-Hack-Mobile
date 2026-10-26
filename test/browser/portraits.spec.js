'use strict';
const { test, expect } = require('@playwright/test');
const { customiseCreation, startGame, watchForErrors } = require('./helpers');

async function prepare(page) {
  await page.addInitScript(() => {
    localStorage.setItem('deepdelve.firstSeen', '1');
    localStorage.setItem('deepdelve.sound', 'off');
    localStorage.setItem('deepdelve.prelude', 'off');
    localStorage.setItem('deepdelve.tipsOff', '1');
  });
}

test('all six painted class portraits load with smooth scaling and the earned mastery frames', async ({ page }, testInfo) => {
  const errors = watchForErrors(page);
  await prepare(page); await page.goto('/');
  await page.evaluate(() => localStorage.setItem('deepdelve.progress', JSON.stringify({ won: { fighter: { hard: 1 }, mage: { easy: 1 } }, relics: [] })));
  await page.click('#btn-new');
  const faces = page.locator('.class-face'); await expect(faces).toHaveCount(6);
  await expect.poll(() => faces.evaluateAll(imgs => imgs.every(i => i.complete && i.naturalWidth === 512))).toBe(true);
  const classes = await page.evaluate(() => Object.keys(CLASSES).filter(id => !CLASSES[id].hidden));
  for (const cls of classes) {
    const face = page.locator(`.class-card[data-cls="${cls}"] .class-face`);
    await expect(face).toHaveAttribute('src', `img/portraits/${cls}.webp`);
    expect(await face.evaluate(i => getComputedStyle(i).imageRendering)).toBe('auto');
  }
  await expect(page.locator('[data-cls="fighter"] .class-face')).toHaveClass(/frame-silver/);
  await expect(page.locator('[data-cls="mage"] .class-face')).toHaveClass(/frame-bronze/);
  await page.screenshot({ path: testInfo.outputPath('painted-class-picker.png') });
  expect(errors).toEqual([]);
});

test('selecting each hero shows a larger portrait and its own backstory, and the portrait expands by touch or keyboard', { tag: '@mobile' }, async ({ page }, testInfo) => {
  const errors = watchForErrors(page);
  await prepare(page); await page.goto('/'); await page.click('#btn-new');
  const stories = await page.evaluate(() => Object.fromEntries(Object.entries(CLASSES).filter(([, c]) => !c.hidden).map(([id, c]) => [id, c.story])));
  expect(new Set(Object.values(stories)).size).toBe(6);
  for (const [cls, story] of Object.entries(stories)) {
    const card = page.locator(`.class-card[data-cls="${cls}"]`);
    await card.tap();
    await expect(card).toBeFocused();
    await expect(page.locator('.class-backstory')).toHaveText(story);
    const face = page.locator('#c-portrait'), toggle = page.locator('#c-portrait-toggle');
    await expect(face).toHaveAttribute('src', `img/portraits/${cls}.webp`);
    await expect.poll(() => face.evaluate(i => i.complete && i.naturalWidth === 512)).toBe(true);
    const cardWidth = (await card.locator('img').boundingBox()).width;
    const smallWidth = (await face.boundingBox()).width;
    expect(smallWidth).toBeGreaterThan(cardWidth * 2);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    if (cls === 'mage') { await toggle.focus(); await page.keyboard.press('Space'); }
    else await toggle.tap();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const box = await face.boundingBox();
    expect(box.width).toBeGreaterThan(smallWidth * 1.5);
    expect(Math.abs(box.width - box.height)).toBeLessThan(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (cls === 'mage') await page.keyboard.press('Enter');
    else await toggle.tap();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  }
  await page.locator('[data-cls="druid"]').click();
  await page.locator('#c-portrait-toggle').click();
  await page.locator('#c-class-more').scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('expanded-character-backstory.png') });
  expect(errors).toEqual([]);
});

test('changing a class resets the expanded portrait and keeps the chosen name and background', async ({ page }) => {
  await prepare(page); await page.goto('/'); await page.click('#btn-new');
  await page.fill('#c-name', 'Mira');
  await customiseCreation(page);
  await page.click('[data-bg="tombwise"]');
  await page.click('#c-portrait-toggle');
  await expect(page.locator('#c-portrait-toggle')).toHaveAttribute('aria-expanded', 'true');
  await page.click('[data-cls="thief"]');
  await expect(page.locator('#c-portrait-toggle')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#c-portrait')).toHaveAttribute('src', 'img/portraits/thief.webp');
  await expect(page.locator('#c-name')).toHaveValue('Mira');
  await expect(page.locator('[data-bg="tombwise"]')).toHaveAttribute('aria-pressed', 'true');
  await page.click('#c-begin');
  await expect(page.locator('#screen-prologue')).toBeVisible();
  await expect(page.locator('#pro-face')).toHaveAttribute('src', 'img/portraits/thief.webp');
});

test('the chosen portrait follows the hero into the story, hero sheet, ending and exported share card', async ({ page }) => {
  const errors = watchForErrors(page);
  await prepare(page); await startGame(page, { cls: 'Druid', seed: 'painted-hero' });
  await page.evaluate(() => { Game.level().monsters.length = 0; });
  await expect(page.locator('#pro-face')).toHaveAttribute('src', 'img/portraits/druid.webp');
  await page.click('[data-open="char"]');
  await expect(page.locator('.sheet-face')).toHaveAttribute('src', 'img/portraits/druid.webp');
  await expect.poll(() => page.evaluate(() => Assets.sprites.portrait_druid.levels[0].width)).toBe(512);
  await page.click('#ov-char [data-close]');
  await page.evaluate(() => Game.hurtPlayer(99999, 'the portrait test'));
  await expect(page.locator('#screen-end')).toBeVisible();
  await expect(page.locator('#end-face')).toHaveAttribute('src', 'img/portraits/fallen/druid.webp');
  await expect.poll(() => page.locator('#end-face').evaluate(i => i.complete && i.naturalWidth === 512)).toBe(true);
  expect(await page.locator('#end-face').evaluate(i => i.naturalWidth)).toBe(512);
  await expect(page.locator('#end-face')).toHaveClass(/fallen/);
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#end-card')]);
  const png = require('node:fs').readFileSync(await download.path());
  expect(png.slice(1, 4).toString()).toBe('PNG');
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([800, 420]);
  expect(errors).toEqual([]);
});

test('a missing painted portrait falls back to the original face without blocking character creation', async ({ page }) => {
  await prepare(page);
  await page.route('**/img/portraits/fighter.webp', r => r.abort());
  await page.goto('/'); await page.click('#btn-new');
  const face = page.locator('[data-cls="fighter"] .class-face');
  await expect(face).toHaveAttribute('src', /^data:image\/png/);
  expect(await face.evaluate(i => i.complete && i.naturalWidth > 0)).toBe(true);
  await expect(page.locator('#c-portrait')).toHaveAttribute('src', /^data:image\/png/);
  await page.click('#c-portrait-toggle');
  await expect(page.locator('#c-portrait-toggle')).toHaveAttribute('aria-expanded', 'true');
  await page.click('#c-begin'); await expect(page.locator('#screen-prologue')).toBeVisible();
  await expect(page.locator('#pro-face')).toHaveAttribute('src', /^data:image\/png/);
});

test('the installed game retains living and all seven fallen class portraits offline', async ({ page, context }) => {
  const errors = watchForErrors(page);
  await prepare(page); await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.register('/sw.js'));
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 30000 }).toBe(true);
  await context.setOffline(true); await page.reload();
  expect(await page.evaluate(async () => {
    const { fallenPortrait } = await import('/js/portraits.js');
    return Promise.all(Object.keys(CLASSES).map(async cls => {
      const art = fallenPortrait(cls); await art.ready;
      const img = new Image(); img.src = art.url; await img.decode();
      return art.url === `img/portraits/fallen/${cls}.webp` && img.naturalWidth === 512;
    }));
  })).toEqual(Array(7).fill(true));
  await page.click('#btn-new');
  await expect.poll(() => page.locator('.class-face').evaluateAll(imgs => imgs.length === 6 && imgs.every(i => i.complete && i.naturalWidth === 512))).toBe(true);
  await page.click('[data-cls="ranger"]'); await page.click('#c-portrait-toggle');
  await expect.poll(() => page.locator('#c-portrait').evaluate(i => i.complete && i.naturalWidth === 512)).toBe(true);
  await expect(page.locator('.class-backstory')).toHaveText(await page.evaluate(() => CLASSES.ranger.story));
  expect(errors).toEqual([]);
});

for (const cls of ['fighter', 'thief', 'cleric', 'mage', 'ranger', 'druid', 'spellblade']) {
  test(`the fallen ${cls} keeps class identity in the death screen and exported portrait`, { tag: '@mobile' }, async ({ page }, testInfo) => {
    const errors = watchForErrors(page);
    const deathRequests = [];
    page.on('request', request => { if (request.url().includes('/img/portraits/fallen/')) deathRequests.push(request.url()); });
    await prepare(page);
    await page.addInitScript(() => {
      localStorage.setItem('deepdelve.wayfarer', '1');
      localStorage.setItem('deepdelve.progress', JSON.stringify({ won: { fighter: { hard: 1 } }, relics: [] }));
    });
    await startGame(page, { cls, seed: `fallen-${cls}`, permadeath: false });
    await page.evaluate(() => { Game.level().monsters.length = 0; Game.save(); });
    await page.click('[data-open="char"]');
    await expect(page.locator('.sheet-face')).toHaveAttribute('src', `img/portraits/${cls}.webp`);
    await page.click('#ov-char [data-close]');
    expect(deathRequests).toEqual([]);
    await page.evaluate(() => Game.hurtPlayer(99999, 'the fallen portrait test'));
    await expect(page.locator('#screen-end')).toBeVisible();
    const face = page.locator('#end-face');
    await expect(face).toHaveAttribute('src', `img/portraits/fallen/${cls}.webp`);
    await expect(face).toHaveAccessibleName(/fallen.*skull portrait/);
    await expect.poll(() => face.evaluate(i => i.complete && i.naturalWidth === 512)).toBe(true);
    expect(await face.evaluate(i => getComputedStyle(i).filter)).toBe('none');
    if (cls === 'fighter') {
      await expect(face).toHaveClass(/frame-silver/);
      expect(await face.evaluate(i => getComputedStyle(i).borderTopColor)).toBe('rgb(200, 204, 212)');
    }
    await page.screenshot({ path: testInfo.outputPath(`fallen-${cls}.png`) });
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('#end-card')]);
    await download.saveAs(testInfo.outputPath(`fallen-${cls}-share.png`));
    const png = require('node:fs').readFileSync(await download.path());
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([800, 420]);
    // Check the actual exported face pixels, not just a PNG signature or selector.
    expect(await page.evaluate(async base64 => {
      const png = new Image(); png.src = `data:image/png;base64,${base64}`; await png.decode();
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 80;
      const g = canvas.getContext('2d'); g.drawImage(png, 34, 34, 80, 80, 0, 0, 80, 80);
      const actual = g.getImageData(0, 0, 80, 80).data;
      // Match the export's canvas size and placement: fractional resampling
      // rounds differently when the same picture is drawn at the origin.
      const reference = document.createElement('canvas'); reference.width = 800; reference.height = 420;
      const r = reference.getContext('2d'); r.imageSmoothingEnabled = true; r.imageSmoothingQuality = 'high';
      const source = document.createElement('canvas'); source.width = source.height = 512;
      source.getContext('2d').drawImage(document.querySelector('#end-face'), 0, 0);
      r.drawImage(source, 34, 34, 80, 80);
      return r.getImageData(34, 34, 80, 80).data.every((v, i) => v === actual[i]);
    }, png.toString('base64'))).toBe(true);
    await page.click('#end-load');
    await expect(page.locator('#screen-game')).toBeVisible();
    expect(await page.evaluate(() => Game.state().status)).toBe('playing');
    await page.click('[data-open="char"]');
    await expect(page.locator('.sheet-face')).toHaveAttribute('src', `img/portraits/${cls}.webp`);
    expect(await page.evaluate(async () => {
      const { makeEndScreen } = await import('/js/endscreen.js');
      return makeEndScreen({}).cardInfo(true).face === Assets.sprites['portrait_' + Game.player().cls].levels[0];
    })).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('a failed skull painting keeps a skull fallback and leaves other classes independent', async ({ page }) => {
  await prepare(page);
  await page.route('**/img/portraits/fallen/fighter.webp', r => r.abort());
  await startGame(page, { seed: 'failed-skull' });
  await page.evaluate(() => { Game.level().monsters.length = 0; Game.hurtPlayer(99999, 'the skull fallback test'); });
  await expect(page.locator('#screen-end')).toBeVisible();
  await expect(page.locator('#end-face')).toHaveAttribute('src', /^data:image\/png/);
  const result = await page.evaluate(async () => {
    const { fallenPortrait } = await import('/js/portraits.js');
    const fighter = fallenPortrait('fighter'), mage = fallenPortrait('mage');
    await mage.ready;
    return { fallback: fighter.url.startsWith('data:image/png'), size: fighter.levels[0].width,
      independent: mage !== fighter && mage.url === 'img/portraits/fallen/mage.webp',
      living: Assets.sprites.portrait_fighter.url };
  });
  expect(result).toEqual({ fallback: true, size: 88, independent: true, living: 'img/portraits/fighter.webp' });
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#end-card')]);
  expect(require('node:fs').statSync(await download.path()).size).toBeGreaterThan(1000);
});

test('a stalled skull load stays usable, exports its fallback, then upgrades in place', async ({ page }) => {
  const errors = watchForErrors(page);
  await prepare(page);
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  await page.route('**/img/portraits/fallen/fighter.webp', async route => { await pending; await route.continue(); });
  await startGame(page, { seed: 'slow-skull' });
  await page.evaluate(() => { Game.level().monsters.length = 0; Game.hurtPlayer(99999, 'the slow skull test'); });
  await expect(page.locator('#screen-end')).toBeVisible();
  await expect(page.locator('#end-face')).toHaveAttribute('src', /^data:image\/png/);
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), page.click('#end-card')]);
  expect(require('node:fs').statSync(await download.path()).size).toBeGreaterThan(1000);
  release();
  await expect(page.locator('#end-face')).toHaveAttribute('src', 'img/portraits/fallen/fighter.webp');
  await expect.poll(() => page.locator('#end-face').evaluate(i => i.complete && i.naturalWidth === 512)).toBe(true);
  expect(errors).toEqual([]);
});
