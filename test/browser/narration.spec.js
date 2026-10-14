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

async function openPrologue(page) {
  await page.addInitScript(() => {
    localStorage.setItem('deepdelve.firstSeen', '1');
    localStorage.setItem('deepdelve.prelude', 'off');
    localStorage.setItem('deepdelve.samples', 'off');
    localStorage.setItem('deepdelve.tips', 'off');
    const Native = window.Audio;
    window.__narrations = [];
    window.Audio = function (...args) {
      const audio = new Native(...args); window.__narrations.push(audio); return audio;
    };
  });
  await page.goto('/');
  await page.click('#btn-new'); await page.click('#c-begin');
  await expect(page.locator('#screen-prologue')).toBeVisible();
}

test('narration is on by default and plays the real George recording without a separate tap', async ({ page }) => {
  const errors = watchForErrors(page);
  await openPrologue(page);
  expect(await page.evaluate(() => Sound.isEnabled())).toBe(true);
  await expect(page.locator('#pro-voice-volume')).toHaveValue('85');
  await expect.poll(() => page.evaluate(() => window.__narrations.at(-1).currentTime)).toBeGreaterThan(0.1);
  await expect(page.locator('#pro-voice-play')).toHaveText('Pause narration');
  expect(await page.evaluate(() => window.__narrations.at(-1).duration)).toBeGreaterThan(30);
  expect(errors).toEqual([]);
});

test('the prologue speaks, can be paused, keeps its voice volume, and stops at Back or the first stair', async ({ page }) => {
  const errors = watchForErrors(page);
  await page.route('**/sound/narration/prologue.*', r => r.fulfill({ status: 200, contentType: 'audio/wav', body: wav }));
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
  await page.click('#pro-begin');
  expect(await page.evaluate(() => window.__narrations.at(-1).paused)).toBe(true);
  await expect(page.locator('#screen-game')).toBeVisible();
  expect(errors).toEqual([]);
});

test('an unavailable recording leaves the written story and the first stair usable', async ({ page }) => {
  await page.route('**/sound/narration/prologue.*', r => r.fulfill({ status: 404, body: '' }));
  await openPrologue(page);
  await expect(page.locator('#pro-voice')).toBeHidden();
  await expect(page.locator('#pro-world p')).toHaveCount(4);
  await expect(page.locator('#pro-begin')).toBeEnabled();
});
