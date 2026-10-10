'use strict';
// The sound check page (sound/listen.html): every sound and theme in the
// manifest is listed and plays, the music's layers follow the mood buttons,
// and nothing breaks. (The test browser has no AAC, so it plays the .ogg files.)
const { test } = require('@playwright/test');
const { expect, watchForErrors } = require('./helpers');

test('the sound check page lists everything in the manifest and plays it', async ({ page }) => {
  const errors = watchForErrors(page);
  await page.goto('/sound/listen.html');
  await expect(page.locator('#status')).toContainText('Ready', { timeout: 10_000 });
  const m = await page.evaluate(async () => (await fetch('/sound/manifest.json')).json());
  // every theme and every sound effect has its row
  await expect(page.locator('details').first().locator('.item')).toHaveCount(Object.keys(m.music).length);
  const sfxRows = await page.locator('details:has(h2:text-matches("Sound effects")) .item').count();
  expect(sfxRows).toBe(Object.keys(m.sfx).length);
  // a sound effect plays: the page says how long it is
  await page.locator('details:has(h2:text("Sound effects, tier 1"))').evaluate(d => { d.open = true; });
  await page.locator('details:has(h2:text("Sound effects, tier 1")) .item').first().locator('button').first().click();
  await expect(page.locator('#status')).toContainText(/s, mono/, { timeout: 10_000 });
  // a theme plays its four stems in step, and the mood buttons choose its layers
  const halls = page.locator('details').first().locator('.item').first();
  await halls.getByRole('button', { name: 'Play' }).click();
  await expect(page.locator('#status')).toContainText(/bpm/, { timeout: 20_000 });
  await halls.getByRole('button', { name: 'fight', exact: true }).first().click();
  await expect(halls.getByRole('button', { name: 'fight', exact: true }).first()).toHaveClass(/on/);
  for (const s of ['explore', 'tension']) await expect(halls.getByRole('button', { name: s, exact: true })).toHaveClass(/on/);
  await expect(halls.getByRole('button', { name: 'boss', exact: true }).last()).not.toHaveClass(/on/);
  await page.click('#stop');
  await expect(halls.getByRole('button', { name: 'Play' })).toBeVisible();
  expect(errors).toEqual([]);
});
