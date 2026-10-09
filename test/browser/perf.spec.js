'use strict';
// The frame-rate budget: with the processor slowed four times (an old phone),
// the view must keep its frame rate in the three heaviest scenes the game has:
// a fight of eight on floor 7, the same floor flooded, and the lich's rite.
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
const { startGame, clearBoons, faceOpenGround } = require('./helpers');

// Frames per second the view must hold in each scene. PERF_MIN_FPS lowers or
// raises it for a slower or faster machine; PERF_REPORT=1 only reports.
const MIN_FPS = Number(process.env.PERF_MIN_FPS || 30);
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
  // the first seconds of a fight paint the orcs finely as they come near: once
  await measure(page, cdp, 3000);
  out.fight = await measure(page, cdp, 4000);
  // the same floor flooded: water over every floor square
  await page.evaluate(() => { Game.level().twist = 'flooded'; });
  await measure(page, cdp, 1000);
  out.flooded = await measure(page, cdp, 4000);
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
  out.rite = await measure(page, cdp, 4000);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  console.log(`frame budget at ${RATE}x slower (need ${MIN_FPS} fps):`, JSON.stringify(out));
  if (REPORT_ONLY) return;
  for (const [scene, m] of Object.entries(out)) expect(m.fps, `${scene}: ${JSON.stringify(m)}`).toBeGreaterThanOrEqual(MIN_FPS);
});
