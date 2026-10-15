'use strict';
const { test, expect } = require('@playwright/test');
const { startGame, faceOpenGround, placeMonster, watchForErrors } = require('./helpers');

test('Burning Hands keeps its cost and impact timing, with a readable target and warning', async ({ page }, testInfo) => {
  const errors = watchForErrors(page);
  await page.addInitScript(() => {
    localStorage.setItem('deepdelve.sound', 'off');
    localStorage.setItem('deepdelve.prelude', 'off');
  });
  await startGame(page, { seed: 'fire-preview', cls: 'Mage' });
  await page.evaluate(() => { Game.level().monsters.length = 0; });
  expect(await faceOpenGround(page, 2)).toBeGreaterThanOrEqual(2);
  await placeMonster(page, 'orc', 1, { hp: 999, maxHp: 999, nextAct: 1e12 });
  // Let the floor's arrival title settle before taking the combat previews.
  await page.waitForTimeout(2700);
  const result = await page.evaluate(() => {
    const p = Game.player(), m = Game.level().monsters[0], before = { sp: p.sp, hp: m.hp };
    const spell = Game.knownSpells().find(s => s.id === 'burning_hands');
    Game.castSpell(spell);
    const rs = Game.renderState(performance.now()), fire = rs.fx.spells.find(s => s.style === 'hands');
    const render = Renderer.render;
    // A late ordinary blow alongside the spell: its warning must stay readable.
    m.windup = { at: Game.state().t - 800, until: Game.state().t + 200, kind: 'melee' };
    window.__firePreview = (phase, calm) => {
      const now = fire.born + (fire.until - fire.born) * phase, frame = Game.renderState(now);
      const fx = { ...frame.fx, spells: [fire] };
      Renderer.setCalm(calm);
      Renderer.render = () => render(frame.level, frame.cam, frame.sprites, fx, now);
    };
    return { cost: before.sp - p.sp, damage: before.hp - m.hp, duration: fire.until - fire.born, impact: m.flashAt - fire.born };
  });
  expect(result.cost).toBe(3); expect(result.damage).toBeGreaterThan(0);
  expect(result.duration).toBeCloseTo(450, 4); expect(result.impact).toBeCloseTo(203, 4);
  for (const [name, phase, calm] of [['fire-impact', 0.48, false], ['fire-embers', 0.8, false], ['fire-calm', 0.48, true]]) {
    await page.evaluate(({ phase, calm }) => window.__firePreview(phase, calm), { phase, calm });
    await expect.poll(() => page.evaluate(() => Renderer.shown.some(s => s.markSize > 0))).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`${name}.png`) });
  }
  expect(errors).toEqual([]);
});

test('fire flares locally at impact, fades out, and Calm view holds a smaller still glow', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { makeSpellFx } = await import('/js/spellfx.js');
    const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 200;
    const ctx = canvas.getContext('2d'); let calm = false;
    const spells = makeSpellFx({ W: 320, H: 200, ctx, get calm() { return calm; } });
    const effect = { spells: [{ style: 'hands', color: '#f84', born: 100, until: 550, pts: [{ x: 1, y: 1 }] }] };
    const frame = phase => {
      ctx.clearRect(0, 0, 320, 200);
      spells.drawSpells(effect, 100 + phase * 450, () => ({ x: 160, y: 110, r: 200 }));
      const pixels = ctx.getImageData(0, 0, 320, 200).data;
      let count = 0, light = 0, minY = 200, maxY = -1, sx = 0, sy = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const a = pixels[i + 3]; if (!a) continue;
        const x = (i / 4) % 320, y = Math.floor(i / 4 / 320);
        count++; light += a; sx += x * a; sy += y * a; minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
      return { count, light, minY, maxY, x: sx / light, y: sy / light };
    };
    const fan = frame(0.25), impact = frame(0.48), tail = frame(0.85), gone = frame(1);
    calm = true;
    const before = frame(0.44), early = frame(0.48), late = frame(0.75), calmGone = frame(1);
    return { fan, impact, tail, gone, before, early, late, calmGone, composite: ctx.globalCompositeOperation, alpha: ctx.globalAlpha };
  });
  expect(result.fan.count).toBeGreaterThan(0);
  expect(result.impact.count).toBeGreaterThan(0);
  expect(result.impact.minY).toBeGreaterThan(60);
  expect(result.tail.light).toBeLessThan(result.impact.light);
  expect(result.gone.count).toBe(0); expect(result.calmGone.count).toBe(0);
  expect(result.before.count).toBe(0);
  expect(result.early.count).toBeGreaterThan(0);
  expect(result.early.count).toBeLessThan(result.impact.count);
  expect(Math.abs(result.early.x - result.late.x)).toBeLessThan(0.5);
  expect(Math.abs(result.early.y - result.late.y)).toBeLessThan(0.5);
  expect(result.late.light).toBeLessThan(result.early.light);
  expect(result.composite).toBe('source-over'); expect(result.alpha).toBe(1);
});
