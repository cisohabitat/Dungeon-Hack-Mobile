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

  test('a thumb that strays up off the d-pad does not open the log; its own button does, and a press just above an arrow is that arrow', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'stray' });
    await clearBoons(page);
    await page.evaluate(() => { Game.level().monsters.length = 0; const t = document.getElementById('tip'); if (t) t.remove(); });
    // a tap on the bottom edge of the log, right above the pad, opens nothing
    const log = await page.locator('#log').boundingBox();
    await page.mouse.click(log.x + 40, log.y + log.height - 4);
    await page.waitForTimeout(150);
    await expect(page.locator('#ov-log')).not.toHaveClass(/open/);
    // a press in the gap just above the forward arrow walks forward
    const fwd = await page.locator('[data-act="forward"]').boundingBox();
    const before = await page.evaluate(() => { const p = Game.player(); return { x: p.x, y: p.y, dir: p.dir }; });
    await page.evaluate(() => {
      const p = Game.player(), L = Game.level(), [dx, dy] = Dungeon.DIRS[p.dir];
      L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR;
    });
    await page.mouse.move(fwd.x + fwd.width / 2, fwd.y - 6);
    await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up();
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => { const p = Game.player(); return { x: p.x, y: p.y }; });
    expect(after.x !== before.x || after.y !== before.y, 'a press just above ▲ should step forward').toBe(true);
    // the Log button opens the history
    await page.locator('#log-more').click();
    await expect(page.locator('#ov-log')).toHaveClass(/open/);
    expect(errors).toEqual([]);
  });

  test('a scroll can be read in a fight on a small phone with a full pack, and the pack gets out of the way', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.setViewportSize({ width: 320, height: 568 });
    await page.addInitScript(() => localStorage.setItem('deepdelve.tipsOff', '1'));
    await startGame(page, { seed: 'scroll-fight' });
    await clearBoons(page);
    await page.evaluate(() => {
      const p = Game.player(), L = Game.level(), G = Game.state(), [dx, dy] = Dungeon.DIRS[p.dir];
      p.hp = p.maxHp = 999;
      for (const t of ['potion_heal', 'scroll_map', 'ration', 'dagger', 'club', 'leather', 'potion_cure', 'scroll_uncurse', 'shortsword', 'sling', 'potion_mana', 'buckler', 'potion_might', 'scroll_heal', 'mace', 'spear'])
        if (p.inv.length < Game.INV_MAX - 1) p.inv.push({ t, q: 1, e: 0 });
      p.inv.push({ t: 'scroll_fire', q: 1, e: 0 }); G.known.scroll_fire = 1;
      L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR;
      L.monsters.length = 0;
      L.monsters.push({ uid: 91, id: 'goblin', x: p.x + dx, y: p.y + dy, hp: 500, maxHp: 500, awake: true, spoke: true, nextAct: G.t + 1e9, rx: p.x + dx, ry: p.y + dy, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 });
    });
    await page.click('[data-open="inv"]');
    await page.locator('#inv-grid .slot', { hasText: 'Scroll of Fire' }).click();
    const read = page.locator('#item-detail button', { hasText: /^Read$/ });
    const box = await read.boundingBox();
    expect(box && box.y + box.height <= 568, `Read is off the bottom of the screen at ${box && box.y}`).toBe(true);
    await read.click();
    await expect(page.locator('#ov-inv')).not.toHaveClass(/open/);
    expect(await page.evaluate(() => Game.level().monsters[0].hp)).toBeLessThan(500);
    expect(errors).toEqual([]);
  });

  test('a scroll or a draught used from the pack, even out of a fight, closes it and is seen to be read or drunk', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.addInitScript(() => localStorage.setItem('deepdelve.tipsOff', '1'));
    await startGame(page, { seed: 'scroll-read' });
    await clearBoons(page);
    await page.evaluate(() => {
      const p = Game.player(), G = Game.state();
      Game.level().monsters.length = 0; Game.level().explored.fill(0);
      p.inv.push({ t: 'scroll_map', q: 1, e: 0 }); G.known.scroll_map = 1;
    });
    await page.click('[data-open="inv"]');
    await page.locator('#inv-grid .slot', { hasText: 'Scroll of Mapping' }).click();
    await page.locator('#item-detail button', { hasText: /^Read$/ }).click();
    await expect(page.locator('#ov-inv')).not.toHaveClass(/open/);
    const fx = await page.evaluate(() => { const now = performance.now(), f = Game.renderState(now).fx; return { ago: now - f.readAt, kind: f.readKind }; });
    expect(fx.kind).toBe('map');
    expect(fx.ago, 'the reading should be under way').toBeLessThan(1000);
    // and the page, lit blue, is drawn on the view while it is read
    await page.waitForTimeout(350);
    const blue = await page.evaluate(() => {
      const c = document.getElementById('view'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 2] > 200 && d[i + 2] > d[i] + 60) n++;
      return n;
    });
    expect(blue, 'no blue writing on the view').toBeGreaterThan(20);
    // a draught is the same: the pack closes and the bottle comes up
    await page.waitForTimeout(800);
    await page.evaluate(() => { const p = Game.player(); p.hp = 1; p.inv.push({ t: 'potion_heal', q: 1, e: 0 }); Game.state().known.potion_heal = 1; });
    await page.click('[data-open="inv"]');
    await page.locator('#inv-grid .slot', { hasText: 'Potion of Healing' }).first().click();
    await page.locator('#item-detail button', { hasText: /^Drink$/ }).click();
    await expect(page.locator('#ov-inv')).not.toHaveClass(/open/);
    const use = await page.evaluate(() => { const now = performance.now(), f = Game.renderState(now).fx; return { ago: now - f.useAt, kind: f.useKind }; });
    expect(use.kind).toBe('drink');
    expect(use.ago).toBeLessThan(850);
    expect(errors).toEqual([]);
  });

  test('the text a player reads clears the 4.5:1 contrast minimum', async ({ page }) => {
    await startGame(page, { seed: 'ui-contrast' });
    await clearBoons(page);
    // the dice are set in a dimmer tone than the line they sit on, and they are
    // the part being read, so make sure there is one on screen to measure
    await page.evaluate(() => Game.log('You hit the Goblin for 7. (d20 14+5 vs AC 13)'));
    await page.waitForTimeout(200);
    const samples = await page.evaluate(() => {
      const pick = sel => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const cs = getComputedStyle(el);
        return { sel, color: cs.color, bg: cs.backgroundColor };
      };
      return ['#log div', '#log .roll', '.hud-name', '#hud-depth', '.bottombar button', '#hud-gold']
        .map(pick).filter(Boolean);
    });
    expect(samples.length).toBeGreaterThan(3);
    expect(samples.some(x => x.sel === '#log .roll'), 'no roll on screen to measure').toBe(true);
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

  for (const [label, vp] of Object.entries({
    'small phone': { width: 360, height: 640 },
    'iPhone SE': { width: 375, height: 667 },
    'tall phone': { width: 393, height: 851 },
    'landscape phone': { width: 844, height: 390 },
    'small landscape': { width: 740, height: 360 },
    desktop: { width: 1280, height: 800 },
  })) {
    test(`every control can be reached on a ${label}`, async ({ page }) => {
      // A landscape phone once had Cast below the bottom edge: a spellcaster
      // playing sideways could not cast at all, and nothing noticed.
      const errors = watchForErrors(page);
      await page.setViewportSize(vp);
      await startGame(page, { seed: 'reach' });
      await clearBoons(page);
      await page.waitForTimeout(250);
      const out = await page.evaluate(() => [...document.querySelectorAll('#screen-game .ctl, #screen-game .bottombar button')]
        // a button this hero has no use for (Spells, for a fighter) is not shown at all
        .filter(b => getComputedStyle(b).display !== 'none')
        .filter(b => { const r = b.getBoundingClientRect(); return r.bottom > innerHeight + 1 || r.right > innerWidth + 1 || r.top < -1 || r.height < 30; })
        .map(b => b.getAttribute('aria-label') || b.textContent.trim()));
      expect(out, 'controls off screen or too small to press').toEqual([]);
      expect(errors).toEqual([]);
    });
  }

  test('on a tall phone the view grows into the spare height without stretching', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.setViewportSize({ width: 393, height: 851 });
    await startGame(page, { seed: 'tall-view' });
    await clearBoons(page);
    await page.waitForTimeout(250);
    const v = await page.evaluate(() => {
      const c = document.getElementById('view'), b = c.getBoundingClientRect();
      const pad = document.querySelector('.dpad').getBoundingClientRect(), ctl = document.querySelector('.controls').getBoundingClientRect();
      return { share: b.height / innerHeight, buffer: c.height, aspect: (b.width / c.width) / (b.height / c.height),
        slack: ctl.height - pad.height };
    });
    // the view used to be fixed at 16:10, under 30% of the screen, while the
    // controls padded a quarter of it with nothing
    expect(v.share, 'the view should take a real share of a tall screen').toBeGreaterThan(0.4);
    expect(v.buffer, 'the renderer should draw a taller picture, not scale a short one').toBeGreaterThan(260);
    expect(Math.abs(v.aspect - 1), 'pixels should stay square').toBeLessThan(0.03);
    expect(v.slack, 'the controls should not be padded with empty space').toBeLessThan(40);
    expect(errors).toEqual([]);
  });

  test('on a narrow phone the message box wraps rather than cutting off the roll', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.setViewportSize({ width: 360, height: 780 });
    await startGame(page, { seed: 'log-wrap' });
    await clearBoons(page);
    // the longest lines the game writes, each ending in the part worth reading;
    // with the floor emptied first, so nothing that wakes can write after them
    await page.evaluate(() => {
      Game.level().monsters.length = 0;
      Game.log('You hit the Goblin for 7. (d20 14+5 vs AC 13)');
      Game.log('The Goblin Archer shoots an arrow at you for 5. (d20 18+3 vs AC 18)');
      Game.log('A mighty blow! You hit the Skeleton for 18. (d20 20, a telling blow)');
      Game.log('The Dark Acolyte hurls a bolt of shadow at you from your left for 9. (d20 15+6 vs AC 18)');
    });
    await page.waitForTimeout(250);
    const shown = await page.evaluate(() => {
      const el = document.getElementById('log'), box = el.getBoundingClientRect();
      return [...el.children].map(d => {
        const db = d.getBoundingClientRect(), s = d.querySelector('.roll'), rb = s && s.getBoundingClientRect();
        return {
          text: d.textContent,
          whole: db.top >= box.top - 0.5 && db.bottom <= box.bottom + 0.5,
          roll: !!rb && rb.top >= db.top - 0.5 && rb.bottom <= db.bottom + 0.5 && rb.right <= box.right + 0.5,
          cut: d.scrollWidth > d.clientWidth + 1,
        };
      });
    });
    expect(shown.length, 'at least the newest two should fit').toBeGreaterThanOrEqual(2);
    // the newest line is the one being read, and it is the longest
    expect(shown[shown.length - 1].text).toContain('Dark Acolyte');
    for (const line of shown) {
      expect(line.whole, `half a line left in the panel: ${line.text}`).toBe(true);
      expect(line.cut, `a line was cut off sideways: ${line.text}`).toBe(false);
      expect(line.roll, `the roll was hidden: ${line.text}`).toBe(true);
    }
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

test.describe('round five playtest', () => {
  test('trying another class and coming back gives back the same numbers, and a background bonus shows', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto('/');
    await page.click('#btn-new');
    const card = name => page.locator('.class-card', { has: page.locator('b', { hasText: new RegExp(`^${name}$`, 'i') }) });
    await card('Fighter').click();
    const before = await page.locator('#c-stats').innerText();
    await card('Mage').click();
    await card('Thief').click();
    await card('Fighter').click();
    expect(await page.locator('#c-stats').innerText()).toBe(before);
    const conOf = async () => Number((await page.locator('#c-stats > div', { hasText: 'CON' }).innerText()).match(/CON\s+(\d+)/)[1]);
    await page.locator('.bg-card', { hasText: 'Oathbroken' }).click();
    const plain = await conOf();
    await page.locator('.bg-card', { hasText: 'Ashborn' }).click();
    expect(await conOf()).toBe(plain + 1);
    expect(errors).toEqual([]);
  });

  test('a tap on a tip puts it away, and does not act in the dungeon', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto('/');
    await page.evaluate(() => { localStorage.removeItem('deepdelve.tipsSeen'); localStorage.removeItem('deepdelve.tipsOff'); localStorage.removeItem('deepdelve.save'); });
    await startGame(page, { seed: 'tip-tap' });
    await clearBoons(page);
    const tip = page.locator('#tip.show');
    await expect(tip).toBeVisible();
    const log0 = await page.evaluate(() => Game.state().logSeq);
    await tip.click();
    await expect(page.locator('#tip')).not.toHaveClass(/show/);
    expect(await page.evaluate(() => Game.state().logSeq)).toBe(log0);
    expect(errors).toEqual([]);
  });
});

test.describe('talents', () => {
  test('an even level offers a class talent, and the Hero sheet lists it', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.addInitScript(() => localStorage.setItem('deepdelve.tipsOff', '1'));
    await startGame(page, { seed: 'talent-ui', cls: 'Thief' });
    await clearBoons(page);
    await page.evaluate(() => {
      const p = Game.player(), L = Game.level(), G = Game.state(); const [dx, dy] = Dungeon.DIRS[p.dir];
      L.monsters.length = 0; p.level = 3; p.xp = XP_TABLE[3] - 1; p.perkHit = 60;
      L.monsters.push({ uid: 5, id: 'rat', x: p.x + dx, y: p.y + dy, hp: 1, maxHp: 1, awake: true, nextAct: 1e12, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 });
      for (let i = 0; i < 6 && L.monsters.length; i++) { G.t = p.nextAttack; Game.input('attack'); }
    });
    await expect(page.locator('#boon-title')).toHaveText("Hero level 4: a Thief's talent");
    await expect(page.locator('.boon.talent')).toHaveCount(3);
    const name = (await page.locator('.boon.talent b').first().innerText()).trim();
    await page.locator('.boon.talent').first().click();
    await expect(page.locator('#ov-boons')).not.toHaveClass(/open/);
    await page.click('[data-open="char"]');
    await expect(page.locator('#char-sheet')).toContainText(name);
    expect(errors).toEqual([]);
  });

  test('a tap already on its way when the level-up opens does not choose, and the screen says what the level gave', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.addInitScript(() => localStorage.setItem('deepdelve.tipsOff', '1'));
    await startGame(page, { seed: 'talent-guard', cls: 'Fighter' });
    await clearBoons(page);
    const early = await page.evaluate(() => {
      const p = Game.player(), L = Game.level(), G = Game.state(); const [dx, dy] = Dungeon.DIRS[p.dir];
      L.monsters.length = 0; p.xp = XP_TABLE[1] - 1; p.perkHit = 60;
      L.monsters.push({ uid: 6, id: 'rat', x: p.x + dx, y: p.y + dy, hp: 1, maxHp: 1, awake: true, nextAct: 1e12, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 });
      for (let i = 0; i < 6 && L.monsters.length; i++) { G.t = p.nextAttack; Game.input('attack'); }
      return true;
    });
    expect(early).toBe(true);
    await expect(page.locator('#ov-boons')).toHaveClass(/open/);
    // a mashed tap in the first moment
    await page.evaluate(() => document.querySelector('#boon-list .boon').click());
    expect(await page.evaluate(() => !!Game.pendingBoons())).toBe(true);
    await expect(page.locator('.boon-head')).toContainText(/\+\d+ hit points/);
    // level 2 is a talent's level: the next comes at 4
    await expect(page.locator('.boon-head')).toContainText('next talent at level 4');
    await page.locator('#boon-list .boon').first().click();
    await expect(page.locator('#ov-boons')).not.toHaveClass(/open/);
    expect(errors).toEqual([]);
  });
});

test.describe('gear powers', () => {
  test('a powered piece names its power in the pack, and the Hero sheet lists what the gear gives', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.addInitScript(() => localStorage.setItem('deepdelve.tipsOff', '1'));
    await startGame(page, { seed: 'gear-ui', cls: 'Fighter' });
    await clearBoons(page);
    await page.evaluate(() => { Game.player().inv.push({ t: 'longsword', q: 1, e: 1, pw: 'leech' }); });
    await page.click('[data-open="inv"]');
    await page.locator('.slot', { hasText: 'of Thirst' }).first().click();
    await expect(page.locator('.relic-powers')).toContainText('Thirsting');
    await page.locator('button', { hasText: /^Equip$/ }).click();
    await page.click('#ov-inv [data-close]');
    await page.click('[data-open="char"]');
    await expect(page.locator('#char-sheet')).toContainText('Powers of your gear');
    await expect(page.locator('#char-sheet')).toContainText('Thirsting');
    expect(errors).toEqual([]);
  });
});

