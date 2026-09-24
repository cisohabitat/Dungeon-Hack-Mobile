'use strict';
const { test, expect } = require('@playwright/test');
const { errs, shot, note, logTail } = require('./pt2-util');
const T = 'a';

test('first minute as a new player: New Game, Fighter, Normal', async ({ page }) => {
  const E = errs(page, T);
  await page.goto('/');
  await page.waitForTimeout(1200);
  await shot(page, 'a01-title');
  await page.click('#btn-new');
  await page.waitForTimeout(400);
  await shot(page, 'a02-create-top');
  await shot(page, 'a03-create-full', true);
  await page.click('#c-name-rand');
  const n1 = await page.inputValue('#c-name');
  await page.click('#c-name-rand');
  const n2 = await page.inputValue('#c-name');
  note(T, { names: [n1, n2] });
  await page.click('[data-diff="easy"]');
  await shot(page, 'a04-create-easy');
  await page.click('[data-diff="hard"]');
  note(T, { hardNote: await page.textContent('#c-diff-note') });
  await page.click('[data-diff="normal"]');
  await page.locator('.class-card', { has: page.locator('b', { hasText: /^Fighter$/ }) }).click();
  await page.locator('.bg-card[data-bg="returned"]').scrollIntoViewIfNeeded();
  await shot(page, 'a05-create-backgrounds');
  // tap a locked one: what happens?
  await page.locator('.bg-card[data-bg="returned"]').click({ force: true }).catch(e => note(T, 'locked click: ' + e.message.slice(0, 80)));
  await shot(page, 'a06-locked-tap');
  note(T, { perk: await page.textContent('#c-bg-perk') });
  await page.locator('#c-permadeath').scrollIntoViewIfNeeded();
  await shot(page, 'a07-create-bottom');
  await page.click('#c-begin');
  await page.waitForTimeout(500);
  await shot(page, 'a08-prologue');
  await shot(page, 'a08b-prologue-full', true);
  await page.click('#pro-begin');
  await page.waitForFunction(() => typeof Game !== 'undefined' && !!Game.state());
  await page.waitForTimeout(700);
  await shot(page, 'a09-first-view');
  // boons at start?
  note(T, { boonsOpen: await page.locator('#ov-boons.open').isVisible() });
  // walk with the d-pad as a thumb would
  const tap = async (act, n = 1) => { for (let i = 0; i < n; i++) { await page.tap(`.ctl[data-act="${act}"]`); await page.waitForTimeout(260); } };
  await tap('forward', 3);
  await shot(page, 'a10-after-steps');
  await tap('right'); await tap('forward', 2);
  await shot(page, 'a11-turned');
  await page.tap('#log-more');
  await page.waitForTimeout(300);
  await shot(page, 'a12-log-history');
  await page.tap('#ov-log [data-close]');
  for (const ov of ['map', 'inv', 'spells', 'char', 'journal', 'menu']) {
    if (!(await page.locator(`[data-open="${ov}"]`).isVisible())) { note(T, 'hidden button: ' + ov); continue; }
    await page.tap(`[data-open="${ov}"]`);
    await page.waitForTimeout(350);
    await shot(page, `a13-ov-${ov}`);
    await page.tap(`#ov-${ov} [data-close]`);
    await page.waitForTimeout(200);
  }
  // Pack: tap first item to see detail
  await page.tap('[data-open="inv"]');
  await page.waitForTimeout(250);
  const first = page.locator('#inv-grid > *').first();
  if (await first.count()) { await first.tap(); await page.waitForTimeout(250); await shot(page, 'a14-pack-item', true); }
  await page.tap('#ov-inv [data-close]');
  // Now go meet a real monster: walk (by d-pad input) toward the nearest one
  const r = await page.evaluate(async () => {
    const T = Dungeon.T, L = Game.level(), p = Game.player();
    const field = (sx, sy) => { const dist = new Int32Array(L.w * L.h).fill(-1); const q = [sy * L.w + sx]; dist[q[0]] = 0;
      for (let qi = 0; qi < q.length; qi++) { const i = q[qi], x = i % L.w, y = (i / L.w) | 0;
        for (const [dx, dy] of Dungeon.DIRS) { const ni = (y + dy) * L.w + x + dx; const t = L.tiles[ni]; if (dist[ni] >= 0 || !(t === T.FLOOR || t === T.DOOR || t === T.DOOR_OPEN)) continue; dist[ni] = dist[i] + 1; q.push(ni); } } return dist; };
    for (let step = 0; step < 200; step++) {
      if (Game.pendingBoons && Game.pendingBoons()) Game.chooseBoon(Game.pendingBoons()[0]);
      const m = L.monsters.filter(m => !MONSTERS[m.id].boss).sort((a, b) => Math.abs(a.x - p.x) + Math.abs(a.y - p.y) - Math.abs(b.x - p.x) - Math.abs(b.y - p.y))[0];
      if (!m) return 'none';
      if (Math.abs(m.x - p.x) + Math.abs(m.y - p.y) <= 2) return { near: m.id, step };
      const dist = field(m.x, m.y);
      let best = null, bd = 1e9;
      for (let k = 0; k < 4; k++) { const [dx, dy] = Dungeon.DIRS[k]; const d = dist[(p.y + dy) * L.w + p.x + dx]; if (d >= 0 && d < bd) { bd = d; best = k; } }
      if (best === null) return 'noroute';
      p.dir = best; Game.input('forward');
      await new Promise(r => setTimeout(r, 230));
    }
    return 'far';
  });
  note(T, { approach: r });
  await page.waitForTimeout(500);
  await shot(page, 'a15-monster-near');
  // face it and fight with the attack button
  for (let i = 0; i < 30; i++) {
    const st = await page.evaluate(() => { const p = Game.player(), L = Game.level(); if (Game.state().status !== 'playing') return 'over';
      for (let k = 0; k < 4; k++) { const [dx, dy] = Dungeon.DIRS[k]; const m = L.monsters.find(m => m.x === p.x + dx && m.y === p.y + dy); if (m) { p.dir = k; return { hp: p.hp, m: m.id, mhp: m.hp, wind: !!m.windup }; } }
      return { hp: p.hp, none: true }; });
    if (st === 'over') break;
    if (i === 2 || i === 6) await shot(page, `a16-fight-${i}`);
    if (st.none && i > 4) break;
    if (!st.none) await page.tap('.ctl.attack');
    await page.waitForTimeout(450);
  }
  await shot(page, 'a17-after-fight');
  note(T, { log: await logTail(page, 12) });
  if (await page.locator('#ov-boons.open').isVisible()) { await shot(page, 'a18-boons'); await page.locator('#boon-list .boon').first().tap(); }
  // Hero sheet after fight
  await page.tap('[data-open="char"]'); await page.waitForTimeout(300); await shot(page, 'a19-hero', true); await page.tap('#ov-char [data-close]');
  // tap the view (should act on thing in front)
  await page.tap('#view'); await page.waitForTimeout(300);
  await shot(page, 'a20-view-tap');
  // small phone check
  await page.setViewportSize({ width: 360, height: 640 });
  await page.waitForTimeout(500);
  await shot(page, 'a21-small-phone');
  await page.setViewportSize({ width: 393, height: 727 });
  E.dump();
});

test.skip('quick start and title', async ({ page }) => {
  const E = errs(page, 'a2');
  await page.goto('/');
  await page.click('#btn-quick');
  await page.waitForTimeout(400);
  await shot(page, 'a30-quick-prologue');
  await page.click('#pro-begin');
  await page.waitForFunction(() => typeof Game !== 'undefined' && !!Game.state());
  await page.waitForTimeout(800);
  await shot(page, 'a31-quick-game');
  note('a2', await page.evaluate(() => ({ cls: Game.player().cls, bg: Game.player().bg, name: Game.player().name, stats: Game.player().stats, opts: Game.state().opts })));
  // the view swipe
  await page.tap('[data-open="menu"]'); await page.waitForTimeout(200); await shot(page, 'a32-menu'); await page.tap('#m-quit');
  await page.waitForTimeout(500);
  await shot(page, 'a33-title-with-save');
  await page.click('#btn-new'); await page.waitForTimeout(300); await shot(page, 'a34-new-with-save');
  await page.click('#btn-help').catch(() => {});
  E.dump();
});
