'use strict';
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { selectJournalTab, startGame, faceOpenGround, placeMonster, watchForErrors } = require('./helpers');

const bosses = { lich: 'Dread Lich', warlord: 'Goblin Warlord', heartforged: 'Heartforged' };
async function prepare(page) {
  await page.addInitScript(() => {
    localStorage.setItem('deepdelve.sound', 'off');
    localStorage.setItem('deepdelve.prelude', 'off');
  });
}
async function introduce(page, id) {
  await page.evaluate(() => { Game.level().monsters.length = 0; Game.player().hp = Game.player().maxHp = 999; });
  expect(await faceOpenGround(page, 2)).toBeGreaterThanOrEqual(2);
  await placeMonster(page, id, 2, { awake: false, nextAct: 0 });
  await expect(page.locator('#ov-boss')).toHaveClass(/open/);
}

async function barPixels(page, portrait) {
  return page.evaluate(async portrait => {
    const { makeOverlay } = await import('/js/overlay.js');
    const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 40;
    const ctx = canvas.getContext('2d'), calls = [], draw = ctx.drawImage.bind(ctx);
    ctx.drawImage = (image, ...args) => { calls.push({ src: image.src, args }); draw(image, ...args); };
    const overlay = makeOverlay({ W: 320, H: 224, ctx });
    const boss = { name: 'Dread Lich', hp: 50, maxHp: 100, phase: 0, rite: false, riteDone: 0, ...(portrait ? { portrait } : {}) };
    overlay.drawBossBar(boss, 10000);
    return { pixels: Array.from(ctx.getImageData(0, 0, 320, 40).data), calls };
  }, portrait);
}

for (const id of Object.keys(bosses)) test(`${id}'s live life bar uses its known painted face without changing the run @mobile`, async ({ page }, testInfo) => {
  const errors = watchForErrors(page);
  await prepare(page); await startGame(page, { seed: 'keeper-bar-' + id });
  expect(await page.evaluate(async () => {
    const { bossFaceState } = await import('/js/bossart.js');
    return ['lich', 'warlord', 'heartforged'].map(bossFaceState);
  })).toEqual(['unrequested', 'unrequested', 'unrequested']);
  await introduce(page, id); await page.getByRole('button', { name: 'Face the keeper' }).click();
  await expect.poll(() => page.evaluate(async id => (await import('/js/bossart.js')).bossFaceState(id), id)).toBe('ready');
  const result = await page.evaluate(async id => {
    const { Dice, Odds } = await import('/js/rng.js'), { makeOverlay } = await import('/js/overlay.js');
    const bar = Game.renderState(performance.now()).fx.boss;
    const before = JSON.stringify(Game.state()), dice = [Dice.s, Odds.s];
    const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 40;
    const ctx = canvas.getContext('2d'), calls = [], draw = ctx.drawImage.bind(ctx);
    ctx.drawImage = (image, ...args) => { calls.push({ src: image.src, args }); draw(image, ...args); };
    const overlay = makeOverlay({ W: 320, H: 224, ctx });
    const count = () => { const a = ctx.getImageData(34, 18, 164, 1).data; let n = 0; for (let i = 0; i < a.length; i += 4) if (a[i] === 122 && a[i + 1] === 90 && a[i + 2] === 216) n++; return n; };
    overlay.drawBossBar({ ...bar, hp: 100, maxHp: 100, phase: 0, rite: false }, 10000); const full = count();
    ctx.clearRect(0, 0, 320, 40); overlay.drawBossBar({ ...bar, hp: 50, maxHp: 100, phase: 0, rite: false }, 10000); const half = count();
    return { identity: bar.portrait, calls, full, half, unchanged: before === JSON.stringify(Game.state()) && Dice.s === dice[0] && Odds.s === dice[1] };
  }, id);
  expect(result.identity).toBe(id); expect(result.unchanged).toBe(true);
  expect(result.calls).toHaveLength(2);
  for (const call of result.calls) {
    expect(call.src).toMatch(new RegExp(`/img/bosses/${id}\\.webp$`));
    expect(call.args.slice(-4)).toEqual([8, 1, 20, 20]);
  }
  expect(result.full).toBeGreaterThan(150);
  expect(result.half / result.full).toBeGreaterThan(0.45); expect(result.half / result.full).toBeLessThan(0.55);
  await page.screenshot({ path: testInfo.outputPath(`${id}-live-bar.png`) });
  expect(errors).toEqual([]);
});

test('a delayed keeper face retains the complete text bar until its own painting is ready @mobile', async ({ page }) => {
  const errors = watchForErrors(page);
  let release; const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/img/bosses/lich.webp', async route => { await gate; await route.continue(); });
  await prepare(page); await startGame(page, { seed: 'keeper-bar-delayed' });
  await introduce(page, 'lich'); await page.getByRole('button', { name: 'Face the keeper' }).click();
  await expect.poll(() => page.evaluate(async () => (await import('/js/bossart.js')).bossFaceState('lich'))).toBe('loading');
  const legacy = await barPixels(page, null), delayed = await barPixels(page, 'lich');
  expect(delayed).toEqual(legacy);
  release();
  await expect.poll(() => page.evaluate(async () => (await import('/js/bossart.js')).bossFaceState('lich'))).toBe('ready');
  expect((await barPixels(page, 'lich')).calls).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('a corrupt keeper face retains its original bar and cannot disable another keeper @mobile', async ({ page }) => {
  const errors = watchForErrors(page);
  await page.route('**/img/bosses/warlord.webp', route => route.fulfill({ contentType: 'image/webp', body: Buffer.from('broken portrait') }));
  await prepare(page); await startGame(page, { seed: 'keeper-bar-failed' });
  expect(await page.evaluate(async () => {
    const { bossPortraitFace, bossFaceState } = await import('/js/bossart.js');
    return ['constructor', 'toString', 'grisk'].map(id => [bossPortraitFace(id), bossFaceState(id)]);
  })).toEqual([[null, 'unrequested'], [null, 'unrequested'], [null, 'unrequested']]);
  await page.evaluate(async () => { (await import('/js/bossart.js')).bossPortraitFace('warlord'); });
  await expect.poll(() => page.evaluate(async () => (await import('/js/bossart.js')).bossFaceState('warlord'))).toBe('failed');
  expect(await barPixels(page, 'warlord')).toEqual(await barPixels(page, null));
  await page.evaluate(async () => { (await import('/js/bossart.js')).bossPortraitFace('heartforged'); });
  await expect.poll(() => page.evaluate(async () => (await import('/js/bossart.js')).bossFaceState('heartforged'))).toBe('ready');
  expect((await barPixels(page, 'heartforged')).calls).toHaveLength(1);
  expect(errors).toEqual([]);
});

for (const [id, name] of Object.entries(bosses)) test(`${name}: its introduction pauses play, unlocks the portrait and happens once`, async ({ page }, testInfo) => {
  const errors = watchForErrors(page);
  await prepare(page); await startGame(page, { seed: 'boss-portrait-' + id });
  await introduce(page, id);
  const dialog = page.getByRole('dialog', { name, exact: true });
  await expect(dialog).toBeVisible();
  await expect(page.locator('#boss-title')).toHaveText(name);
  await expect(page.locator('#boss-speech')).toHaveText(await page.evaluate(id => MONSTERS[id].speech, id));
  await expect(page.locator('#boss-portrait')).toHaveAttribute('src', `img/bosses/${id}.webp`);
  await expect.poll(() => page.locator('#boss-portrait').evaluate(i => i.complete && i.naturalWidth === 512)).toBe(true);
  const time = await page.evaluate(() => Game.state().t);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => Game.state().t)).toBe(time);
  expect(await page.evaluate(id => Game.bestiary()[id].met, id)).toBeGreaterThan(0);
  expect(await page.locator('#screen-game .game-layout').evaluate(e => e.inert)).toBe(true);
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(axe.violations.filter(v => ['serious', 'critical'].includes(v.impact))).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath(`${id}-introduction.png`) });
  await page.getByRole('button', { name: 'Face the keeper' }).click();
  await expect(dialog).not.toBeVisible();
  await expect.poll(() => page.evaluate(() => Game.state().t)).toBeGreaterThan(time);
  await page.click('[data-open="journal"]'); await selectJournalTab(page, 'beasts');
  const portrait = page.locator(`#ov-journal [data-beast="${id}"] .boss-portrait`);
  await expect(portrait).toHaveAttribute('src', `img/bosses/${id}.webp`);
  await portrait.focus(); await page.keyboard.press('Enter');
  await expect(portrait).toHaveAttribute('aria-pressed', 'true');
  expect(await portrait.evaluate(e => getComputedStyle(e).imageRendering)).toBe('auto');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  await expect(page.locator('#ov-boss')).not.toHaveClass(/open/);
  if (id === 'lich') {
    await page.evaluate(() => Game.save(true));
    await page.reload(); await page.click('#btn-continue');
    await expect(page.locator('#screen-game')).toBeVisible();
    await page.waitForTimeout(250);
    await expect(page.locator('#ov-boss')).not.toHaveClass(/open/);
    expect(await page.evaluate(() => Game.level().monsters.find(m => m.id === 'lich').spoke)).toBe(true);
  }
  expect(errors).toEqual([]);
});

test('a level-up waits for the introduction rather than covering it', async ({ page }) => {
  await prepare(page); await startGame(page, { seed: 'boss-portrait-choice' });
  await introduce(page, 'lich');
  await page.evaluate(() => Game.testLevel());
  await expect.poll(() => page.evaluate(() => !!Game.pendingBoons())).toBe(true);
  await expect(page.locator('#ov-boss')).toHaveClass(/open/);
  await expect(page.locator('#ov-boons')).not.toHaveClass(/open/);
  await page.getByRole('button', { name: 'Face the keeper' }).click();
  await expect(page.locator('#ov-boons')).toHaveClass(/open/);
});

test('unmet keepers keep their portraits hidden; met portraits survive offline reload and enlarge without cropping', async ({ page, context }, testInfo) => {
  const errors = watchForErrors(page);
  await prepare(page); await page.goto('/'); await page.click('#btn-beasts');
  for (const id of Object.keys(bosses)) {
    await expect(page.locator(`[data-beast="${id}"]`)).toHaveClass(/unmet/);
    await expect(page.locator(`[data-beast="${id}"] .boss-portrait`)).toHaveCount(0);
  }
  await page.evaluate(() => localStorage.setItem('deepdelve.bestiary', JSON.stringify(Object.fromEntries(['lich', 'warlord', 'heartforged'].map(id => [id, { met: 1, kills: 0 }])))));
  await page.evaluate(() => navigator.serviceWorker.register('/sw.js'));
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 30000 }).toBe(true);
  await context.setOffline(true); await page.reload(); await page.click('#btn-beasts');
  for (const id of Object.keys(bosses)) {
    await page.evaluate(async id => { (await import('/js/bossart.js')).bossPortraitFace(id); }, id);
    await expect.poll(() => page.evaluate(async id => (await import('/js/bossart.js')).bossFaceState(id), id)).toBe('ready');
    expect((await barPixels(page, id)).calls).toHaveLength(1);
    const face = page.locator(`[data-beast="${id}"] .boss-portrait`);
    await expect.poll(() => face.evaluate(e => e.complete && e.naturalWidth === 512)).toBe(true);
    await face.click(); await expect(face).toHaveAttribute('aria-pressed', 'true');
    const [w, h] = await face.evaluate(e => [e.getBoundingClientRect().width, e.getBoundingClientRect().height]);
    expect(Math.abs(w - h)).toBeLessThan(2);
    await face.click();
  }
  await page.locator('[data-beast="lich"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('boss-bestiary.png') });
  expect(errors).toEqual([]);
});

test('a missing portrait uses the dungeon sprite and the introduction still closes by keyboard', async ({ page }) => {
  await prepare(page); await page.route('**/img/bosses/lich.webp', r => r.abort());
  await startGame(page, { seed: 'boss-missing-portrait' }); await introduce(page, 'lich');
  await expect(page.locator('#boss-portrait')).toHaveAttribute('src', /^data:image\/png/);
  await expect.poll(() => page.locator('#boss-portrait').evaluate(e => e.complete && e.naturalWidth > 0)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('#ov-boss')).not.toHaveClass(/open/);
  await expect.poll(() => page.evaluate(() => UI.paused())).toBe(false);
});
