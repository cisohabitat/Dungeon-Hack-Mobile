'use strict';
// Accessibility beyond what axe sees: text at twice its size with nothing cut
// short or pushed off, the log read aloud, the view described, the colours a
// colour-blind player can tell apart, Calm view stilling every animation, and a
// one-handed layout with the fight's controls under one thumb.
const { test } = require('@playwright/test');
const { watchForErrors, startGame, clearBoons, expect } = require('./helpers');

/** Whatever sticks out of the screen sideways, or is cut off it, on the page as it stands. */
async function offScreen(page, selector) {
  return page.evaluate(sel => {
    const out = [], W = innerWidth, H = innerHeight;
    if (document.documentElement.scrollWidth > W + 1) out.push(`the page is ${document.documentElement.scrollWidth}px wide in ${W}`);
    for (const e of document.querySelectorAll(sel)) {
      if (!e.getClientRects().length || getComputedStyle(e).visibility === 'hidden') continue;
      const r = e.getBoundingClientRect();
      const name = e.id || e.dataset.act || e.dataset.tap || e.dataset.open || e.textContent.trim().slice(0, 12);
      // on the screen, and not under something else (a control slid behind another is as lost)
      const top = document.elementFromPoint(Math.min(W - 1, Math.max(0, (r.left + r.right) / 2)), Math.min(H - 1, Math.max(0, (r.top + r.bottom) / 2)));
      if (r.top >= -1 && r.bottom <= H + 1 && r.left >= -1 && r.right <= W + 1 && top && !e.contains(top) && !top.contains(e)) out.push(`${name} under ${top.id || top.className}`);
      if (r.left < -1 || r.right > W + 1 || r.top < -1 || r.bottom > H + 1) out.push(`${e.id || e.dataset.act || e.dataset.tap || e.dataset.open || e.textContent.trim().slice(0, 12)} at ${Math.round(r.left)},${Math.round(r.top)}-${Math.round(r.right)},${Math.round(r.bottom)}`);
    }
    return out;
  }, selector);
}

for (const [name, vp] of [['phone', { width: 393, height: 727 }], ['small phone', { width: 375, height: 667 }], ['phone on its side', { width: 740, height: 360 }]]) {
  test(`text at twice its size fits the ${name}: every screen, the dungeon's bars and controls, and every overlay`, async ({ page }) => {
    test.setTimeout(90_000);
    const errors = watchForErrors(page);
    await page.setViewportSize(vp);
    await page.addInitScript(() => localStorage.setItem('deepdelve.textSize', '4'));
    await page.goto('/');
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('32px');
    // off the title, each screen scrolls up and down, never sideways
    for (const [open, screen] of [['#btn-help', '#screen-help'], ['#btn-hall', '#screen-hall']]) {
      await page.click(open);
      await expect(page.locator(screen)).toBeVisible();
      expect(await offScreen(page, 'none'), screen).toEqual([]);
      await page.keyboard.press('Escape');
    }
    await startGame(page, { seed: 'twice', cls: 'mage' });
    await clearBoons(page);
    await page.waitForTimeout(400);
    // in the dungeon: every control on the screen, the view still a view, the life bar's numbers whole
    expect(await offScreen(page, '#screen-game .ctl, #screen-game .bottombar button, #hud-quaff, #log-more'), 'the dungeon').toEqual([]);
    expect(await page.evaluate(() => document.getElementById('view').getBoundingClientRect().height)).toBeGreaterThan(110);
    expect(await page.evaluate(() => { const t = document.getElementById('txt-hp'); return t.scrollWidth <= t.clientWidth + 1; }), 'the life bar shows its numbers').toBe(true);
    // each overlay: nothing sideways, and its way out on the screen
    for (const ov of ['inv', 'map', 'spells', 'char', 'journal', 'log', 'menu']) {
      await page.evaluate(o => document.querySelector(`[data-open="${o}"]`) ? document.querySelector(`[data-open="${o}"]`).click() : document.getElementById('log-more').click(), ov);
      await expect(page.locator(`#ov-${ov}`)).toHaveClass(/open/);
      expect(await offScreen(page, `#ov-${ov} [data-close]`), ov).toEqual([]);
      // the pack's slot labels fit their cells, and the hero sheet's scores and rows their columns (the review found both cut off)
      if (ov === 'inv') expect(await page.evaluate(() => Array.from(document.querySelectorAll('#ov-inv .slot .lbl')).filter(l => l.getBoundingClientRect().right > l.closest('.slot').getBoundingClientRect().right + 1).map(l => l.textContent)), 'slot labels').toEqual([]);
      if (ov === 'char') expect(await page.evaluate(() => Array.from(document.querySelectorAll('#ov-char .sheet div')).filter(d => d.scrollWidth > d.clientWidth + 1 || d.getBoundingClientRect().right > innerWidth).map(d => d.textContent.trim().slice(0, 20))), 'the hero sheet').toEqual([]);
      await page.keyboard.press('Escape');
      await expect(page.locator(`#ov-${ov}`)).not.toHaveClass(/open/);
    }
    // the newest log line stops short of the Log button, not under it
    expect(await page.evaluate(() => { const l = document.querySelector('#log div:last-child'), b = document.getElementById('log-more'); if (!l || !b) return true; const r = document.createRange(); r.selectNodeContents(l); return r.getBoundingClientRect().right <= b.getBoundingClientRect().left + 1; }), 'the log under its button').toBe(true);
    expect(errors).toEqual([]);
  });
}

test('a screen reader hears each log line once as it shows, the view put into words as the hero turns, and the bars by name', async ({ page }) => {
  const errors = watchForErrors(page);
  await startGame(page, { seed: 'reader' });
  await clearBoons(page);
  const region = page.locator('#sr-log');
  await expect(region).toHaveAttribute('role', 'log');
  await expect(region).toHaveAttribute('aria-live', 'polite');
  // the first lines of the run are there, and a new line is added on its own, not the screen's four again
  await expect.poll(() => region.locator('p').count()).toBeGreaterThan(0);
  const before = await region.locator('p').count();
  await page.evaluate(() => { const G = Game.state(); G.log.push({ m: 'A test line for the reader.', c: 'info', at: 0 }); G.logSeq++; });
  await expect.poll(() => region.locator('p').count()).toBe(before + 1);
  await expect(region.locator('p').last()).toHaveText('A test line for the reader.');
  // the view: which way, and what lies ahead; a turn says so
  const view = page.locator('#view');
  await expect(view).toHaveAttribute('role', 'img');
  await expect.poll(() => view.getAttribute('aria-label')).toMatch(/^The dungeon\. Facing (north|east|south|west)\./);
  const was = await view.getAttribute('aria-label');
  await page.keyboard.press('KeyD');
  await expect.poll(() => view.getAttribute('aria-label')).not.toBe(was);
  // the life bar by its numbers
  await expect(page.locator('.bar.hp')).toHaveAttribute('aria-label', /^Life \d+ of \d+$/);
  // an overlay opened by a tap takes the focus in, and gives it back to its button on closing
  await page.locator('[data-open="inv"]').click();
  await expect.poll(() => page.evaluate(() => !!document.activeElement && !!document.activeElement.closest('#ov-inv'))).toBe(true);
  await page.locator('#ov-inv [data-close]').click();
  await expect.poll(() => page.evaluate(() => document.activeElement && document.activeElement.dataset.open)).toBe('inv');
  expect(errors).toEqual([]);
});

test('the colour-blind safe colours tell a blow from a trick by blue and orange, and recolour the map and its legend', async ({ page }) => {
  const errors = watchForErrors(page);
  await startGame(page, { seed: 'colours' });
  await clearBoons(page);
  const marks = () => page.evaluate(() => [Renderer.tellColour(false, 1), Renderer.tellColour(true, 1)]);
  expect(await marks()).toEqual(['#ff3020', '#ff40e0']);
  await page.locator('[data-open="menu"]').click();
  await expect(page.locator('#m-colours')).toHaveText('Colours: standard');
  await page.locator('#m-colours').click();
  await expect(page.locator('#m-colours')).toHaveText('Colours: colour-blind safe');
  expect(await page.evaluate(() => Renderer.palette)).toBe('safe');
  expect(await marks()).toEqual(['#d55e00', '#0072b2']);
  await page.keyboard.press('Escape');
  // the map's legend in the same colours: the stairs up no longer green
  await page.locator('[data-open="map"]').click();
  await expect(page.locator('#map-legend [data-key="up"] i')).toHaveAttribute('style', /#56b4e9/i);
  await page.keyboard.press('Escape');
  // kept for the next visit
  await page.reload();
  await page.waitForFunction(() => typeof Renderer !== 'undefined');
  expect(await page.evaluate(() => Renderer.palette)).toBe('safe');
  expect(errors).toEqual([]);
});

test('Calm view stills every animation on the page as well as the view', async ({ page }) => {
  const errors = watchForErrors(page);
  await page.addInitScript(() => localStorage.setItem('deepdelve.calm', '1'));
  await startGame(page, { seed: 'calm' });
  await clearBoons(page);
  expect(await page.evaluate(() => document.body.classList.contains('calm'))).toBe(true);
  // an overlay opens without its fade, and the drink button's beat is stilled
  await page.locator('[data-open="inv"]').click();
  const durations = await page.evaluate(() => {
    const ov = getComputedStyle(document.getElementById('ov-inv')), q = getComputedStyle(document.getElementById('hud-quaff'));
    return [ov.animationDuration, ov.transitionDuration, q.animationDuration];
  });
  for (const d of durations) for (const part of d.split(',')) expect(parseFloat(part)).toBeLessThan(0.001);
  expect(errors).toEqual([]);
});

for (const hand of ['one-right', 'one-left']) {
  test(`one-handed (${hand === 'one-right' ? 'right' : 'left'} thumb) puts every control a fight needs within the thumb's reach, the drink with them`, async ({ page }) => {
    const errors = watchForErrors(page);
    await page.addInitScript(h => localStorage.setItem('deepdelve.hand', h), hand);
    await startGame(page, { seed: 'thumb', cls: 'mage' });
    await clearBoons(page);
    await page.waitForTimeout(300);
    // the thumb's side three quarters of the width, the lower 45% of the height
    const far = await page.evaluate(right => {
      const W = innerWidth, H = innerHeight, out = [];
      for (const e of document.querySelectorAll('#screen-game .ctl, #hud-quaff')) {
        if (!e.getClientRects().length || getComputedStyle(e).display === 'none') continue;
        const r = e.getBoundingClientRect(), cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
        const reach = right ? cx >= W * 0.25 : cx <= W * 0.75;
        const top = document.elementFromPoint(cx, cy);
        if (!reach || cy < H * 0.55 || !top || !(e.contains(top) || top.contains(e))) out.push(`${e.id || e.dataset.act || e.dataset.tap} at ${Math.round(cx)},${Math.round(cy)}`);
      }
      return out;
    }, hand === 'one-right');
    expect(far).toEqual([]);
    expect(await page.evaluate(() => !!document.getElementById('hud-quaff').closest('.controls'))).toBe(true);
    // and the Menu says so, and puts it back as it was
    await page.locator('[data-open="menu"]').click();
    await expect(page.locator('#m-hand')).toHaveText(new RegExp(`one-handed, ${hand === 'one-right' ? 'right' : 'left'} thumb`));
    await page.locator('#m-hand').click();
    await expect(page.locator('#m-hand')).toHaveText(hand === 'one-right' ? /one-handed, left thumb/ : /right-handed/);
    if (hand === 'one-left') expect(await page.evaluate(() => !!document.getElementById('hud-quaff').closest('.hud'))).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('with the largest text a long tip takes the view\'s height and scrolls: a drag reads on, only a tap closes it', async ({ page }) => {
  const errors = watchForErrors(page);
  await page.addInitScript(() => localStorage.setItem('deepdelve.textSize', '4'));
  // the first tip, about the controls, stays up until the hero moves
  await startGame(page, { seed: 'long-tip', tips: true });
  const tip = page.locator('#tip');
  await expect(tip).toHaveClass(/show/, { timeout: 8000 });
  const box = await page.evaluate(() => { const el = document.getElementById('tip'), v = document.getElementById('view').getBoundingClientRect(); return { scrolls: getComputedStyle(el).overflowY, room: el.clientHeight, view: v.height, all: el.scrollHeight }; });
  expect(box.scrolls).toBe('auto');
  expect(box.room).toBeGreaterThan(box.view * 0.6);
  // a drag on it does not close it
  const r = await tip.boundingBox();
  await page.mouse.move(r.x + r.width / 2, r.y + r.height - 10);
  await page.mouse.down();
  await page.mouse.move(r.x + r.width / 2, r.y + 10, { steps: 6 });
  await page.mouse.up();
  await expect(tip).toHaveClass(/show/);
  // a tap does
  await tip.click();
  await expect(tip).not.toHaveClass(/show/);
  expect(errors).toEqual([]);
});
