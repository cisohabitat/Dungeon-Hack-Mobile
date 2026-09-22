'use strict';
// The things a player touches: layout across screens, reachable controls,
// readable text, and a frame budget that holds when the level is crowded.
const { test, devices } = require('@playwright/test');
const { expect, watchForErrors, startGame, clearBoons } = require('./helpers');

/** Relative luminance, per WCAG 2.1. */
function luminance([r, g, b]) {
  const f = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
}
function contrast(fg, bg) {
  const a = luminance(fg), b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
const rgb = s => (s.match(/\d+/g) || []).slice(0, 3).map(Number);

test.describe('interface', () => {
  test('every control on the game screen is at least 44 pixels', async ({ page }) => {
    await startGame(page, { seed: 'ui-targets' });
    await clearBoons(page);
    const small = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('#screen-game button')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;      // hidden overlays
        if (r.width < 44 || r.height < 44) {
          out.push({ label: el.dataset.act || el.dataset.tap || el.dataset.open || el.textContent.trim().slice(0, 14),
                     w: Math.round(r.width), h: Math.round(r.height) });
        }
      }
      return out;
    });
    expect(small, 'controls below the 44px touch guideline').toEqual([]);
  });

  test('the text a player reads clears the 4.5:1 contrast minimum', async ({ page }) => {
    await startGame(page, { seed: 'ui-contrast' });
    await clearBoons(page);
    const samples = await page.evaluate(() => {
      const pick = sel => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const cs = getComputedStyle(el);
        return { sel, color: cs.color, bg: cs.backgroundColor };
      };
      return ['#log div', '.hud-name', '#hud-depth', '.bottombar button', '#hud-gold']
        .map(pick).filter(Boolean);
    });
    expect(samples.length).toBeGreaterThan(3);
    const page_bg = [14, 13, 20];
    for (const s of samples) {
      const bg = /, 0\)$/.test(s.bg) || rgb(s.bg).length < 3 ? page_bg : rgb(s.bg);
      const ratio = contrast(rgb(s.color), bg);
      expect(ratio, `${s.sel} contrast`).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('a crowded level still renders inside a 60fps budget', async ({ page }) => {
    await startGame(page, { seed: 'ui-perf' });
    await clearBoons(page);
    const perf = await page.evaluate(() => {
      const p = Game.player(), L = Game.level();
      const seed = L.monsters[0];
      if (seed) {
        for (let i = 0; i < 40; i++) {
          const m = JSON.parse(JSON.stringify(seed));
          m.uid = 7000 + i;
          m.x = p.x + (i % 7) - 3; m.y = p.y + ((i / 7) | 0) - 3;
          m.rx = m.x; m.ry = m.y; m.awake = true;
          L.monsters.push(m);
        }
      }
      const rs = Game.renderState(performance.now());
      const t0 = performance.now();
      for (let i = 0; i < 40; i++) Renderer.render(rs.level, rs.cam, rs.sprites, rs.fx, performance.now());
      return { monsters: L.monsters.length, ms: (performance.now() - t0) / 40 };
    });
    expect(perf.monsters).toBeGreaterThan(30);
    expect(perf.ms, 'one frame must fit well inside 16.7ms').toBeLessThan(8);
  });

  test('the title screen animates and survives a round trip into a game', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto('/');
    await expect(page.locator('#screen-title')).toBeVisible();

    // the camera walks the dungeon, so successive frames must differ
    const frames = await page.evaluate(async () => {
      const c = document.querySelector('#title-art');
      const g = c.getContext('2d');
      const seen = [];
      for (let i = 0; i < 4; i++) {
        const d = g.getImageData(40, 40, 60, 60).data;
        let h = 0;
        for (let k = 0; k < d.length; k += 97) h = (h * 31 + d[k]) >>> 0;
        seen.push(h);
        await new Promise(r => setTimeout(r, 320));
      }
      return new Set(seen).size;
    });
    expect(frames, 'the title camera should be moving').toBeGreaterThan(1);

    await startGame(page, { seed: 'ui-title' });
    await clearBoons(page);
    await page.click('[data-open="menu"]');
    await page.click('#m-quit');
    await expect(page.locator('#screen-title')).toBeVisible();
    await expect(page.locator('#save-summary')).toContainText(/level/i);
    expect(errors).toEqual([]);
  });

  test('the message panel keeps scrolling after the log fills up', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'log-cap' });
    await clearBoons(page);

    // the log is capped at 80 entries, so push well past that: a panel that
    // watches the array's length instead of counting messages freezes here
    const read = () => page.locator('#log').innerText();
    await page.evaluate(() => { for (let i = 1; i <= 120; i++) Game.log(`filler ${i}`); });
    await page.waitForTimeout(150);
    const full = await read();
    expect(full, 'the newest message should be on screen').toContain('filler 120');

    await page.evaluate(() => Game.log('the message after the cap'));
    await page.waitForTimeout(150);
    const after = await read();
    expect(after, 'a message written past the cap must still appear')
      .toContain('the message after the cap');
    expect(after, 'the panel should have moved on').not.toBe(full);

    // and the capped array itself is still doing its job
    const size = await page.evaluate(() => Game.state().log.length);
    expect(size, 'the log should stay capped').toBeLessThanOrEqual(80);
    expect(errors).toEqual([]);
  });

  test('the corner map draws a torch as the wall it is set into', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'mini-torch' });
    await clearBoons(page);

    // stand next to a torch with the ground around it explored, then read the
    // pixel the corner map draws for it
    const probe = await page.evaluate(async () => {
      const L = Game.level(), p = Game.player(), T = Dungeon.T;
      let at = null;
      for (let i = 0; i < L.tiles.length && !at; i++) {
        if (L.tiles[i] !== T.TORCH) continue;
        const tx = i % L.w, ty = (i / L.w) | 0;
        // a walkable square next to it to stand on
        for (const [dx, dy] of Dungeon.DIRS) {
          const sx = tx + dx, sy = ty + dy;
          if (L.tiles[sy * L.w + sx] === T.FLOOR) { at = { tx, ty, sx, sy }; break; }
        }
      }
      if (!at) return null;
      p.x = at.sx; p.y = at.sy;
      // the map only draws what has been seen
      for (let y = at.sy - 2; y <= at.sy + 2; y++) for (let x = at.sx - 2; x <= at.sx + 2; x++) {
        if (x >= 0 && y >= 0 && x < L.w && y < L.h) L.explored[y * L.w + x] = 1;
      }
      await new Promise(r => setTimeout(r, 300));

      const c = document.getElementById('minimap');
      const ctx = c.getContext('2d', { willReadFrequently: true });
      const R = 7, size = 6;
      const read = (gx, gy) => {
        const px = (gx - at.sx + R) * size + 3, py = (gy - at.sy + R) * size + 3;
        const d = ctx.getImageData(px, py, 1, 1).data;
        return `${d[0]},${d[1]},${d[2]}`;
      };
      // a plain wall to compare against, and a floor square
      let wall = null, floor = null;
      for (let y = at.sy - 2; y <= at.sy + 2 && !(wall && floor); y++) {
        for (let x = at.sx - 2; x <= at.sx + 2; x++) {
          const t = L.tiles[y * L.w + x];
          if (t === T.WALL && !wall) wall = read(x, y);
          if (t === T.FLOOR && !floor && !(x === at.sx && y === at.sy)) floor = read(x, y);
        }
      }
      return { torch: read(at.tx, at.ty), wall, floor };
    });

    test.skip(!probe, 'no torch with open ground beside it on this level');
    expect(probe.torch, 'a torch should be drawn as wall, not picked out').toBe(probe.wall);
    if (probe.floor) expect(probe.torch, 'and never as walkable floor').not.toBe(probe.floor);
    expect(errors).toEqual([]);
  });

  test('the pack compares a weapon against the one already in hand', async ({ page }) => {
    await startGame(page, { seed: 'ui-compare' });
    await clearBoons(page);
    await page.evaluate(() => {
      const p = Game.player();
      p.inv.push({ t: 'greatsword', q: 1, e: 1 });
      p.inv.push({ t: 'plate', q: 1, e: 0 });
    });
    await page.click('[data-open="inv"]');
    await page.locator('#inv-grid .slot.filled', { hasText: 'Two-handed Sword' }).first().click();
    await expect(page.locator('.compare')).toContainText(/damage per second/);
    await page.locator('#inv-grid .slot.filled', { hasText: 'Plate Mail' }).first().click();
    await expect(page.locator('.compare')).toContainText(/armor class/);
  });
});

test.describe('layout', () => {
  for (const [label, viewport] of Object.entries({
    'small phone': { width: 320, height: 568 },
    'tall phone': { width: 390, height: 844 },
    'landscape phone': { width: 844, height: 390 },
    desktop: { width: 1280, height: 800 },
  })) {
    test(`the title screen fits a ${label} without sideways scroll`, async ({ page }) => {
      const errors = watchForErrors(page);
      await page.setViewportSize(viewport);
      await page.goto('/');
      await expect(page.locator('#screen-title')).toBeVisible();
      await page.waitForTimeout(400);
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, 'no horizontal overflow').toBeLessThanOrEqual(1);
      await expect(page.locator('#btn-new')).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
});
