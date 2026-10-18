'use strict';
const { test, expect } = require('@playwright/test');
const { watchForErrors } = require('./helpers');

// A silent minute exercises real media playback without shipping a stand-in
// for the actor's reading. The browser detects WAV regardless of the URL.
const rate = 8000, bytes = rate * 60 * 2, wav = Buffer.alloc(44 + bytes);
wav.write('RIFF'); wav.writeUInt32LE(36 + bytes, 4); wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28);
wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
wav.write('data', 36); wav.writeUInt32LE(bytes, 40);

test('the server supports media byte ranges, including suffixes and invalid ranges', async ({ request }) => {
  const file = require('node:fs').readFileSync(require('node:path').join(__dirname, '../../sound/narration/prologue.ogg'));
  for (const [range, start, end] of [['bytes=0-63', 0, 63], ['bytes=-64', file.length - 64, file.length - 1], [`bytes=${file.length - 64}-`, file.length - 64, file.length - 1]]) {
    const response = await request.get('/sound/narration/prologue.ogg', { headers: { Range: range } });
    expect(response.status()).toBe(206);
    expect(response.headers()['content-type']).toBe('audio/ogg');
    expect(response.headers()['content-range']).toBe(`bytes ${start}-${end}/${file.length}`);
    expect(Number(response.headers()['content-length'])).toBe(end - start + 1);
    expect(await response.body()).toEqual(file.subarray(start, end + 1));
  }
  for (const range of [`bytes=${file.length}-`, 'bytes=10-2', 'bytes=-0']) {
    const response = await request.get('/sound/narration/prologue.ogg', { headers: { Range: range } });
    expect(response.status()).toBe(416);
    expect(response.headers()['content-range']).toBe(`bytes */${file.length}`);
  }
});

async function openPrologue(page, ogg = false) {
  await page.addInitScript(forceOgg => {
    localStorage.setItem('deepdelve.firstSeen', '1');
    localStorage.setItem('deepdelve.prelude', 'off');
    localStorage.setItem('deepdelve.samples', 'off');
    localStorage.setItem('deepdelve.tipsOff', '1');
    const Native = window.Audio;
    window.__narrations = [];
    window.__narrationPlayback = [];
    window.Audio = function (...args) {
      const audio = new Native(...args);
      if (forceOgg) audio.canPlayType = () => '';
      // The player reuses this element for the background after the prologue.
      // Keep evidence of each recording playing before its src is replaced.
      audio.addEventListener('timeupdate', () => {
        if (audio.currentTime > 0.1 && !window.__narrationPlayback.some(p => p.src === audio.src)) {
          window.__narrationPlayback.push({ src: audio.src, duration: audio.duration });
        }
      });
      window.__narrations.push(audio); return audio;
    };
  }, ogg);
  await page.goto('/');
  await page.click('#btn-new'); await page.click('#c-begin');
  await expect(page.locator('#screen-prologue')).toBeVisible();
}

for (const ogg of [false, true]) test(`narration is on by default and plays the real George recording without a separate tap (${ogg ? 'Ogg fallback' : 'browser format'})`, async ({ page }) => {
  const errors = watchForErrors(page);
  await openPrologue(page, ogg);
  if (ogg) expect(await page.evaluate(() => window.__narrations.at(-1).src)).toMatch(/\.ogg$/);
  expect(await page.evaluate(() => Sound.isEnabled())).toBe(true);
  await expect(page.locator('#pro-voice-volume')).toHaveValue('85');
  await expect.poll(() => page.evaluate(() => window.__narrationPlayback.some(p => /\/prologue\.(m4a|ogg)$/.test(p.src)))).toBe(true);
  await expect(page.locator('#pro-voice-play')).toHaveText('Pause narration');
  // Exercise the handoff explicitly: a slow CI runner can reach this point
  // after the opening has already finished and the background has begun.
  await page.evaluate(() => {
    const audio = window.__narrations.at(-1);
    if (/\/prologue\.(m4a|ogg)$/.test(audio.src)) audio.dispatchEvent(new Event('ended'));
  });
  await expect.poll(() => page.evaluate(() => window.__narrations.at(-1).src)).not.toMatch(/\/prologue\.(m4a|ogg)$/);
  expect(await page.evaluate(() => window.__narrationPlayback.find(p => /\/prologue\.(m4a|ogg)$/.test(p.src)).duration)).toBeGreaterThan(30);
  expect(errors).toEqual([]);
});

test('the prologue speaks, can be paused, keeps its voice volume, and stops at Back or the first stair', async ({ page }) => {
  const errors = watchForErrors(page);
  await page.route('**/sound/narration/*', r => r.fulfill({ status: 200, contentType: 'audio/wav', body: wav }));
  await openPrologue(page);
  const button = page.locator('#pro-voice-play');
  // A browser which asks for a fresh gesture offers Resume instead of failing.
  await expect(button).toHaveText(/Pause narration|Resume narration/);
  if (await button.textContent() === 'Resume narration') await button.click();
  await expect(button).toHaveText('Pause narration');
  await expect(page.locator('#pro-world p')).toHaveCount(4);
  await button.click(); await expect(button).toHaveText('Resume narration');
  await page.locator('#pro-voice-volume').evaluate(el => {
    el.value = '35'; el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(await page.evaluate(() => localStorage.getItem('deepdelve.voiceVolume'))).toBe('0.35');
  await button.click(); await expect(button).toHaveText('Pause narration');
  await page.click('#pro-back');
  expect(await page.evaluate(() => window.__narrations.at(-1).paused)).toBe(true);
  await page.click('#btn-new'); await page.click('#c-begin');
  await expect(page.locator('#pro-voice-volume')).toHaveValue('35');
  await page.evaluate(() => { window.__openingAudio = window.__narrations.at(-1); });
  await page.click('#pro-begin');
  expect(await page.evaluate(() => window.__openingAudio.src)).not.toContain('prologue.');
  await expect(page.locator('#screen-game')).toBeVisible();
  expect(errors).toEqual([]);
});

test('an unavailable recording leaves the written story and the first stair usable', async ({ page }) => {
  await page.route('**/sound/narration/*', r => r.fulfill({ status: 404, body: '' }));
  await openPrologue(page);
  await expect(page.locator('#pro-voice')).toBeHidden();
  await expect(page.locator('#pro-world p')).toHaveCount(4);
  await expect(page.locator('#pro-begin')).toBeEnabled();
});

async function quietGame(page) {
  await page.click('#pro-begin');
  await page.evaluate(() => { Game.level().monsters.length = 0; });
}
async function stubReadings(page) {
  await page.route('**/sound/narration/*', r => r.fulfill({ status: 200, contentType: 'audio/wav', body: wav }));
}

test('the opening continues into the chosen background on the same unlocked audio element', async ({ page }) => {
  const errors = watchForErrors(page);
  await stubReadings(page); await openPrologue(page);
  const want = await page.evaluate(async () => {
    const { voiceId, backgroundText } = await import('/js/voicelines.js');
    return voiceId(backgroundText(document.querySelector('.bg-card.sel').dataset.bg));
  });
  await page.evaluate(() => window.__narrations.at(-1).dispatchEvent(new Event('ended')));
  await expect.poll(() => page.evaluate(() => window.__narrations.at(-1).src)).toContain(want);
  expect(await page.evaluate(() => window.__narrations.length)).toBe(1);
  await page.click('[data-voice-background]');
  await expect.poll(() => page.evaluate(() => window.__narrations.at(-1).src)).toContain(want);
  await page.click('#pro-voice [data-voice-stop]');
  await expect(page.locator('#pro-voice')).toBeHidden();
  expect(errors).toEqual([]);
});

test('Journal pages auto-read the latest find, offer individual replay, and stop on closing', async ({ page }) => {
  const errors = watchForErrors(page);
  await stubReadings(page); await openPrologue(page); await quietGame(page);
  await page.evaluate(() => { Game.state().journal = [{ i: 0, depth: 1 }, { i: 1, depth: 2 }]; });
  await page.click('[data-open="journal"]');
  const latest = page.locator('#journal-list [data-voice-page="1"]');
  await expect(latest).toHaveText('Pause');
  expect(await page.evaluate(() => window.__narrations.length)).toBe(1);
  await latest.click(); await expect(latest).toHaveText('Resume');
  const first = page.locator('#journal-list [data-voice-page="0"]');
  await first.click(); await expect(first).toHaveText('Pause');
  await page.click('#ov-journal [data-close]');
  expect(await page.evaluate(() => window.__narrations.at(-1).paused)).toBe(true);
  expect(errors).toEqual([]);
});

test('discoveries defer to enemy warnings and do not repeat after a region revisit', async ({ page }) => {
  const errors = watchForErrors(page);
  await stubReadings(page); await openPrologue(page); await quietGame(page);
  await expect(page.locator('#discovery-voice')).toBeVisible();
  await page.evaluate(() => {
    window.__regionAudio = window.__narrations.at(-1);
    const m = { id: 'rat', hp: 3, x: 0, y: 0, windup: { until: 1e12 }, nextAct: 1e12 };
    Game.level().monsters.push(m);
  });
  await expect(page.locator('#discovery-voice')).toBeHidden();
  expect(await page.evaluate(() => window.__regionAudio.paused)).toBe(true);
  await page.evaluate(() => { Game.level().monsters.length = 0; });
  await expect(page.locator('#discovery-voice')).toBeVisible();
  await page.click('#discovery-voice [data-voice-stop]');
  await page.evaluate(() => { Game.testFloor(2); Game.testFloor(1); Game.level().monsters.length = 0; });
  await page.waitForTimeout(400);
  await expect(page.locator('#discovery-voice')).toBeHidden();
  const relic = await page.evaluate(async () => {
    const { RELICS } = await import('/js/relics.js');
    const id = Object.keys(RELICS)[0];
    const p = Game.player(), L = Game.level(), k = p.x + ',' + p.y;
    const item = { t: RELICS[id].t, e: RELICS[id].e, u: id, q: 1 };
    (L.items[k] ||= []).push(item); Game.takeItem(item);
    return RELICS[id].name;
  });
  await expect(page.locator('#discovery-voice-caption')).toContainText(relic);
  await expect(page.locator('#discovery-voice')).toBeVisible();
  await page.setViewportSize({ width: 320, height: 568 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  const voiceBox = await page.locator('#discovery-voice').boundingBox(), viewBox = await page.locator('.view-wrap').boundingBox();
  expect(voiceBox.y).toBeGreaterThanOrEqual(viewBox.y);
  expect(voiceBox.y + voiceBox.height).toBeLessThanOrEqual(viewBox.y + viewBox.height);
  await expect(page.locator('#discovery-voice [data-voice-toggle]')).toHaveText('Pause');
  expect(errors).toEqual([]);
});

test('voice can be disabled separately, persists, and respects the master sound switch', async ({ page }) => {
  const errors = watchForErrors(page);
  await stubReadings(page); await openPrologue(page); await quietGame(page);
  await page.click('[data-open="menu"]');
  await expect(page.locator('#m-voice')).toHaveText('Voice: On');
  await page.click('#m-voice');
  expect(await page.evaluate(() => Sound.isEnabled())).toBe(true);
  await page.click('#m-quit'); await page.reload(); await page.click('#btn-new');
  // A run still saved asks whether to replace it.
  if (await page.locator('#confirm-replace').isVisible()) await page.click('#confirm-replace');
  await page.click('#c-begin');
  await expect(page.locator('#pro-voice')).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('deepdelve.narration'))).toBe('off');
  expect(errors).toEqual([]);
});

test('the death epilogue is narrated and can be paused or replayed', async ({ page }) => {
  const errors = watchForErrors(page);
  await stubReadings(page); await openPrologue(page); await quietGame(page);
  await page.evaluate(() => { Game.hurtPlayer(99999, 'a voice test'); });
  await expect(page.locator('#screen-end')).toBeVisible();
  const box = page.locator('[data-voice-context="end"]');
  await expect(box).toBeVisible();
  await box.locator('[data-voice-toggle]').click();
  await expect(box.locator('[data-voice-toggle]')).toHaveText('Resume narration');
  await box.locator('[data-voice-toggle]').click();
  await expect(box.locator('[data-voice-toggle]')).toHaveText('Pause narration');
  await page.click('#end-title-btn');
  expect(await page.evaluate(() => window.__narrations.at(-1).paused)).toBe(true);
  expect(errors).toEqual([]);
});

test('Hall pages can be replayed on a small phone with large text', async ({ page }) => {
  const errors = watchForErrors(page);
  await stubReadings(page); await openPrologue(page);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.evaluate(async () => {
    const { Progress } = await import('/js/progress.js');
    const saved = Progress.load(); saved.pages = [0];
    localStorage.setItem('deepdelve.progress', JSON.stringify(saved));
    document.documentElement.style.fontSize = '200%';
  });
  await page.click('#pro-back'); await page.click('#btn-hall');
  await page.locator('.hall-pages summary').click();
  const button = page.locator('#hall-list [data-voice-page="0"]');
  await button.click(); await expect(button).toHaveText('Pause');
  const controls = page.locator('[data-voice-context="hall"]');
  await expect(controls).toBeVisible();
  expect(await page.evaluate(() => document.querySelector('#screen-hall').scrollWidth <= innerWidth)).toBe(true);
  await controls.locator('[data-voice-stop]').click();
  expect(await page.evaluate(() => window.__narrations.at(-1).paused)).toBe(true);
  expect(errors).toEqual([]);
});

for (const [ending, choice] of [['take', 2], ['quench', 0], ['keep', 1]]) {
  test(`George reads the ${ending} victory and advances through its epilogue`, async ({ page }) => {
    const errors = watchForErrors(page);
    await stubReadings(page); await openPrologue(page); await quietGame(page);
    await page.evaluate(() => {
      const G = Game.state(), p = Game.player(), L = Game.level(), k = p.x + ',' + p.y;
      G.threads.smithway = true; p.inv.push({ t: 'quench', q: 1 });
      const item = { t: 'artifact', q: 1 }; (L.items[k] ||= []).push(item); Game.takeItem(item);
    });
    await expect(page.locator('#ov-encounter')).toHaveClass(/open/);
    await page.waitForTimeout(700);
    await page.locator('.enc-choice').nth(choice).click();
    await expect(page.locator('#screen-end')).toBeVisible();
    expect(await page.evaluate(() => Game.state().ending)).toBe(ending);
    const nextId = await page.evaluate(async () => {
      const { endingSpeech, voiceId } = await import('/js/voicelines.js');
      return voiceId(endingSpeech(Game.epilogue(true), Game.state())[1]);
    });
    await expect(page.locator('[data-voice-context="end"]')).toBeVisible();
    await page.evaluate(() => window.__narrations.at(-1).dispatchEvent(new Event('ended')));
    await expect.poll(() => page.evaluate(() => window.__narrations.at(-1).src)).toContain(nextId);
    expect(errors).toEqual([]);
  });
}

test('the installed game can read an unheard Journal page with the connection off', async ({ page, context }) => {
  const errors = watchForErrors(page);
  await openPrologue(page);
  await page.evaluate(() => navigator.serviceWorker.register('/sw.js'));
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 30000 }).toBe(true);
  await expect(page.locator('#offline-status')).toHaveAttribute('data-voice', 'ready', { timeout: 30000 });
  await quietGame(page);
  await page.evaluate(() => { Game.state().journal = [{ i: 22, depth: 1 }]; });
  await context.setOffline(true);
  const ranges = await page.evaluate(async () => {
    const { voiceId, pageText } = await import('/js/voicelines.js');
    const url = '/sound/narration/' + voiceId(pageText(22)) + '.m4a';
    const out = [];
    for (const range of ['bytes=0-99', 'bytes=100-', 'bytes=-25']) {
      const response = await fetch(url, { headers: { Range: range } });
      out.push({ status: response.status, bytes: (await response.arrayBuffer()).byteLength, range: response.headers.get('Content-Range') });
    }
    return out;
  });
  expect(ranges[0]).toMatchObject({ status: 206, bytes: 100 });
  expect(ranges[1].status).toBe(206); expect(ranges[1].range).toMatch(/^bytes 100-/);
  expect(ranges[2]).toMatchObject({ status: 206, bytes: 25 });
  await page.click('[data-open="journal"]');
  await expect(page.locator('#journal-list [data-voice-page="22"]')).toHaveText('Pause');
  await expect.poll(() => page.evaluate(() => window.__narrations.at(-1).currentTime)).toBeGreaterThan(0.1);
  expect(await page.evaluate(() => window.__narrations.at(-1).duration)).toBeGreaterThan(1);
  expect(errors).toEqual([]);
});

test('the master Sound switch also silences default-on narration', async ({ page }) => {
  const errors = watchForErrors(page);
  await page.addInitScript(() => localStorage.setItem('deepdelve.sound', 'off'));
  await openPrologue(page);
  await expect(page.locator('#pro-voice')).toBeHidden();
  expect(await page.evaluate(() => window.__narrations.length)).toBe(0);
  await quietGame(page);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__narrations.length)).toBe(0);
  expect(errors).toEqual([]);
});
