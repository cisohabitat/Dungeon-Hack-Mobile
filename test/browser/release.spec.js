'use strict';
const { test, expect } = require('@playwright/test');
const { watchForErrors } = require('./helpers');
const { version } = require('../../package.json');
const {execFileSync}=require('node:child_process');
const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim().slice(0,7);

test('the main page shows its release and commit at the bottom on phones and desktop', async ({ page }) => {
  const errors = watchForErrors(page);
  await page.addInitScript(() => localStorage.setItem('deepdelve.firstSeen', '1'));
  await page.goto('/');
  const footer = page.locator('#release-info');
  for (const [width, height] of [[320, 568], [390, 844], [844, 390], [1280, 800]]) {
    await page.setViewportSize({ width, height });
    await expect(footer).toHaveText(`Release ${version} · Commit ${commit}`);
    await footer.scrollIntoViewIfNeeded();
    const box = await footer.boundingBox();
    expect(box.y + box.height).toBeLessThanOrEqual(height + 1);
    expect(box.y + box.height).toBeGreaterThan(height - 2);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
  }
  expect(await page.evaluate(() => UI.version())).toBe(`${version} (${commit})`);
  await page.click('#btn-new');
  await expect(footer).not.toBeVisible();
  await page.click('#c-back');
  await expect(footer).toHaveText(`Release ${version} · Commit ${commit}`);
  expect(errors).toEqual([]);
});

test('release details and the menu stay reachable with double text and the first-time card', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('deepdelve.textSize', '4'));
  await page.goto('/');
  await expect(page.locator('#first-time')).toBeVisible();
  const footer = page.locator('#release-info');
  await footer.scrollIntoViewIfNeeded();
  await expect(footer).toBeInViewport();
  expect(await page.evaluate(() => document.querySelector('#screen-title').scrollWidth <= innerWidth)).toBe(true);
  await page.click('#btn-new');
  await expect(page.locator('#screen-create')).toBeVisible();
});

test('the installed game keeps its release and commit offline', async ({ page, context }) => {
  const errors = watchForErrors(page);
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.register('/sw.js'));
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 30000 }).toBe(true);
  await context.setOffline(true); await page.reload();
  await expect(page.locator('#release-info')).toHaveText(`Release ${version} · Commit ${commit}`);
  expect(await page.evaluate(() => UI.version())).toBe(`${version} (${commit})`);
  expect(errors).toEqual([]);
});
