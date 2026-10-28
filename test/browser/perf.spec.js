'use strict';
// The frame-rate budget: with the processor slowed four times (an old phone),
// the view must keep its frame rate in the three heaviest scenes the game has:
// a fight of eight on floor 7, the same floor flooded, and the lich's rite; the
// fight again on a wide screen, where the map is docked beside the view; and a
// run must open within a few seconds of Begin.
//
// It runs as its own project on one worker (see playwright.config.js), and
// only when PERF=1: beside two hundred other tests it would measure the
// machine, not the game. Locally:
//   PERF=1 npx playwright test --project=perf --workers=1
//
// Every picture the game paints in spare time is painted first, at full speed:
// the budget is for play once that is done (about a minute on a slow phone; see
// ROADMAP.md), not for the painting.
const { test, expect } = require('@playwright/test');
const { customiseCreation, startGame, clearBoons, faceOpenGround } = require('./helpers');

// Frames per second the view must hold in each scene. PERF_MIN_FPS lowers or
// raises it for a slower or faster machine; PERF_REPORT=1 only reports.
const MIN_FPS = Number(process.env.PERF_MIN_FPS || 30);
// The wide screen's own bar: the picture is drawn larger and the map beside it, and it measured
// a tenth under the phone's fight wherever the two were measured together (October 2026). A
// laptop is not what the budget is for; it must not fall far behind.
const MIN_FPS_WIDE = Number(process.env.PERF_MIN_FPS_WIDE || 27);
// Milliseconds a run may take to open from Begin to its first frame, slowed the same.
const MAX_START_MS = Number(process.env.PERF_MAX_START || 6000);
const REPORT_ONLY = process.env.PERF_REPORT === '1';
const RATE = 4;

/**
 * Frames per second over `ms`, and the milliseconds of script each frame cost
 * (from the browser's own count, so it holds when the frame rate is capped).
 */
async function measure(page, cdp, ms) {
  const script = async () => {
    const { metrics } = await cdp.send('Performance.getMetrics');
    return metrics.find(m => m.name === 'ScriptDuration').value * 1000;
  };
  const s0 = await script();
  const frames = await page.evaluate(ms => new Promise(res => {
    let n = 0; const t0 = performance.now();
    const f = now => { n++; if (now - t0 < ms) requestAnimationFrame(f); else res({ n, secs: (now - t0) / 1000 }); };
    requestAnimationFrame(f);
  }), ms);
  const s1 = await script();
  return { fps: Math.round(frames.n / frames.secs * 10) / 10, scriptMs: Math.round((s1 - s0) / frames.n * 10) / 10 };
}

/** Wait for what is painted in spare moments (a close-up of a creature come near) to be done. */
const settled = page => page.waitForFunction(() => Assets.painting() === 0, null, { timeout: 90_000, polling: 250 });

test('the view holds its frame rate on a slow processor', async ({ page }) => {
  test.skip(process.env.PERF !== '1', 'the frame-rate budget runs alone: PERF=1 --project=perf --workers=1');
  test.setTimeout(240_000);
  await startGame(page, { seed: 'perf-budget' });
  await clearBoons(page);
  await page.waitForFunction(() => Assets.painting() === 0, null, { timeout: 120_000, polling: 250 });
  // the hero cannot die, and the monsters wake at once
  await page.evaluate(() => { Game.setTesting({ hp: true }); Game.testFloor(7); });
  await faceOpenGround(page);
  await page.evaluate(() => {
    const p = Game.player(), L = Game.level(), T = Dungeon.T;
    let k = 0;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const x = p.x + dx, y = p.y + dy;
      if ((dx || dy) && k < 8 && L.tiles[y * L.w + x] === T.FLOOR && !L.monsters.some(m => m.x === x && m.y === y)) {
        L.monsters.push({ uid: 95000 + k++, id: 'orc', x, y, hp: 999, maxHp: 999, awake: true, nextAct: 0, rx: x, ry: y, fromX: x, fromY: y, moveT0: 0, moveT1: 0, flashUntil: 0 });
      }
    }
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
  const out = {};
  // the first seconds of a fight paint the orcs finely as they come near, a
  // piece at a time in spare moments: once, and not what the budget is for
  await measure(page, cdp, 3000);
  await settled(page);
  out.fight = await measure(page, cdp, 4000);
  // the same fight on a wide screen (a laptop, a tablet on its side): the map docked beside the view
  const phone = page.viewportSize();
  await page.setViewportSize({ width: 1280, height: 800 });
  await measure(page, cdp, 1000);
  out.wide = await measure(page, cdp, 4000);
  await page.setViewportSize(phone);
  await measure(page, cdp, 500);
  // the same floor flooded: water over every floor square
  await page.evaluate(() => { Game.level().twist = 'flooded'; });
  await measure(page, cdp, 1000);
  out.flooded = await measure(page, cdp, 4000);
  // The same crowd using painted poses: their cached shades must hold the
  // existing budget too, including ordinary combat motion and warning marks.
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await page.evaluate(() => {
    Game.level().twist = null;
    const kinds=['drow_warrior','hound','wyrm','skarrow','troll','minotaur','archer','moth'];
    let i=0;for (const m of Game.level().monsters) if (m.id === 'orc') m.id = kinds[i++%kinds.length];
  });
  await page.evaluate(async()=>{window.__paintedCreature=(await import('/js/paintedcreatures.js')).paintedCreature;});
  await page.waitForFunction(() => {
    const paintedCreature = window.__paintedCreature;
    return ['drow_warrior','hound','wyrm','skarrow','troll','minotaur','archer','moth'].map(k=>k==='skarrow'?Assets.sprites.wyrm.elite.skarrow:Assets.sprites[k]).map(art=>art&&paintedCreature(art)!==art).every(Boolean);
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
  await measure(page, cdp, 3000);
  out.painted = await measure(page, cdp, 4000);
  // Exercise the new body with the same painted crowd and native dark-floor light.
  await page.evaluate(async()=>{Game.level().twist='dark';window.__amberFrame=(await import('/js/paintedworld.js')).paintedLantern;});
  await page.waitForFunction(()=>window.__amberFrame()?.img&&Renderer.lantern===1,null,{timeout:30000});
  out.amber = await measure(page, cdp, 4000);
  // Repeated native reads exercise the blank parchment and its live writing/fire.
  await page.evaluate(async()=>{window.__scrollFrame=(await import('/js/paintedworld.js')).paintedReadingScroll;window.__scrollFrame();});
  await page.waitForFunction(()=>window.__scrollFrame()?.img,null,{timeout:30000});
  await page.evaluate(()=>{const read=()=>{const p=Game.player(),it={t:'scroll_map',q:1,e:0};p.inv.push(it);delete Game.state().known.scroll_map;Game.useItem(it);if(p.inv.includes(it))throw Error('Budget read did not run');};read();window.__scrollBudget=setInterval(read,1100);});
  try { out.scroll = await measure(page, cdp, 4000); }
  finally { await page.evaluate(()=>clearInterval(window.__scrollBudget)); }
  // the last floor, the lich awake two squares ahead and working its rite
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await page.evaluate(() => { Game.level().twist = null; Game.testFloor(Game.state().opts.levels || 8); });
  await faceOpenGround(page);
  await page.evaluate(() => {
    const L = Game.level(), lich = L.monsters.find(m => m.id === 'lich'), p = Game.player(), D = Dungeon.DIRS[p.dir];
    if (!lich) return;
    lich.awake = true; lich.spoke = true;
    lich.x = p.x + D[0] * 2; lich.y = p.y + D[1] * 2; lich.rx = lich.x; lich.ry = lich.y;
    lich.windup = { move: 'rite', at: Game.state().t, until: Game.state().t + 1e9 };
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
  await measure(page, cdp, 3000);
  await settled(page);
  out.rite = await measure(page, cdp, 4000);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  // a new run's opening, slowed the same: from Begin on the prologue to the dungeon's first frame
  // (the pictures painted in spare moments are done by now; it is the floor's making and the first
  // paint of the view that this measures)
  // (the hero above cannot die, and a page left mid-run saves the run on its way out: the save
  // is taken away once the title is up, and the title opened again without it)
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('deepdelve.save'));
  await page.goto('/');
  await page.click('#btn-new'); await customiseCreation(page);
  await page.fill('#c-seed', 'perf-start');
  await page.click('#c-begin');
  await expect(page.locator('#screen-prologue')).toBeVisible();
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
  const t0 = Date.now();
  await page.click('#pro-begin');
  await expect(page.locator('#screen-game')).toBeVisible();
  await page.evaluate(() => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res))));
  const start = { ms: Date.now() - t0 };
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  console.log(`frame budget at ${RATE}x slower (need ${MIN_FPS} fps):`, JSON.stringify(out), 'start', JSON.stringify(start));
  if (REPORT_ONLY) return;
  for (const [scene, m] of Object.entries(out)) expect(m.fps, `${scene}: ${JSON.stringify(m)}`).toBeGreaterThanOrEqual(scene === 'wide' ? MIN_FPS_WIDE : MIN_FPS);
  expect(start.ms, `a run opens within ${MAX_START_MS} ms of Begin`).toBeLessThanOrEqual(MAX_START_MS);
});
