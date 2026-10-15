'use strict';
const { test, expect } = require('@playwright/test');
const { startGame, faceOpenGround, placeMonster, watchForErrors } = require('./helpers');

async function setup(page, cls) {
  await page.addInitScript(() => {
    localStorage.setItem('deepdelve.sound', 'off');
    localStorage.setItem('deepdelve.prelude', 'off');
  });
  await startGame(page, { seed: 'elements-preview', cls });
  await page.evaluate(() => {
    Game.level().monsters.length = 0;
    const p = Game.player(); p.level = 10; p.hp = p.maxHp = 999; p.sp = p.maxSp = 999;
  });
  expect(await faceOpenGround(page, 2)).toBeGreaterThanOrEqual(2);
  await placeMonster(page, 'orc', 1, { hp: 999, maxHp: 999, nextAct: 1e12 });
  await page.waitForTimeout(2700);
}

for (const [cls, id, style, duration, impact] of [
  ['Cleric', 'flame_strike', 'pillar', 700, 0.15],
  ['Mage', 'cone_cold', 'cone', 520, 0.3],
  ['Mage', 'lightning', 'lightning', 380, 0],
  ['Druid', 'call_lightning', 'lightning', 380, 0],
  ['Druid', 'insect_plague', 'swarm', 560, 0.3],
]) test(`${id} keeps its cost and impact timing with its own visual style`, async ({ page }, testInfo) => {
  const errors = watchForErrors(page);
  await setup(page, cls);
  const result = await page.evaluate(id => {
    const spell = Game.knownSpells().find(s => s.id === id), p = Game.player(), m = Game.level().monsters[0], before = { sp: p.sp, hp: m.hp };
    Game.castSpell(spell);
    const frame = Game.renderState(performance.now()), effect = frame.fx.spells.at(-1), render = Renderer.render;
    window.__elementPreview = calm => {
      const phase = effect.impact + (1 - effect.impact) * 0.35;
      const now = effect.born + (effect.until - effect.born) * phase, rs = Game.renderState(now), fx = { ...rs.fx, spells: [effect] };
      Renderer.setCalm(calm); Renderer.render = () => render(rs.level, rs.cam, rs.sprites, fx, now);
    };
    return { cost: before.sp - p.sp, expectedCost: spell.cost, damage: before.hp - m.hp, style: effect.style, duration: effect.until - effect.born, impact: effect.impact, flash: m.flashAt - effect.born };
  }, id);
  expect(result.cost).toBe(result.expectedCost); expect(result.damage).toBeGreaterThan(0);
  expect(result.style).toBe(style); expect(result.duration).toBeCloseTo(duration, 4);
  expect(result.impact).toBe(impact); expect(result.flash).toBeCloseTo(Math.round(duration * impact), 4);
  for (const calm of [false, true]) {
    await page.evaluate(calm => window.__elementPreview(calm), calm);
    await page.waitForTimeout(80);
    await page.screenshot({ path: testInfo.outputPath(`${id}${calm ? '-calm' : ''}.png`) });
  }
  expect(errors).toEqual([]);
});

test('elemental scrolls keep their delayed launch and damage alignment', async ({ page }) => {
  const errors = watchForErrors(page);
  await setup(page, 'Mage');
  const result = await page.evaluate(() => {
    const p = Game.player(), G = Game.state(), m = Game.level().monsters[0], out = [];
    for (const [type, style, duration] of [['fire', 'fireball', 750], ['frost', 'cone', 450], ['lightning', 'lightning', 380]]) {
      const scroll = { t: 'scroll_' + type, q: 1, e: 0 };
      p.inv.push(scroll); p.nextAttack = 0; G.blowGate = 0;
      Game.useItem(scroll);
      const fx = Game.renderState(performance.now()).fx, effect = fx.spells.at(-1);
      out.push({ style: effect.style, duration: effect.until - effect.born, launch: effect.born - fx.readAt, impact: effect.impact, flash: m.flashAt - effect.born, expectedFlash: Math.round(duration * 0.35), consumed: !p.inv.includes(scroll), expectedStyle: style });
    }
    return out;
  });
  expect(result).toHaveLength(3);
  for (const r of result) {
    expect(r.style).toBe(r.expectedStyle); expect(r.launch).toBeCloseTo(600, 4); expect(r.impact).toBe(0.35);
    expect(r.flash).toBeCloseTo(r.expectedFlash, 4); expect(r.consumed).toBe(true);
  }
  expect(errors).toEqual([]);
});

test('elemental impacts fade and Calm view removes travelling effects and holds the target still', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { makeSpellFx } = await import('/js/spellfx.js');
    const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 200;
    const ctx = canvas.getContext('2d'); let calm = true;
    const spells = makeSpellFx({ W: 320, H: 200, ctx, get calm() { return calm; } });
    const metrics = (style, hit, phase) => {
      ctx.clearRect(0, 0, 320, 200);
      spells.drawSpells({ spells: [{ style, impact: hit, color: '#8ef', born: 100, until: 600, pts: [{ x: 1, y: 1 }] }] }, 100 + phase * 500, () => ({ x: 160, y: 110, r: 200 }));
      const p = ctx.getImageData(0, 0, 320, 200).data;
      let n = 0, light = 0, x = 0, y = 0, minY = 200, maxY = -1;
      for (let i = 0; i < p.length; i += 4) if (p[i + 3]) {
        const a = p[i + 3], px = (i / 4) % 320, py = Math.floor(i / 4 / 320);
        n++; light += a; x += px * a; y += py * a; minY = Math.min(minY, py); maxY = Math.max(maxY, py);
      }
      return { n, light, x: x / light, y: y / light, minY, maxY };
    };
    return ['fireball', 'pillar', 'cone', 'lightning'].map(style => {
      // A delayed impact also checks the scroll variant of a lightning bolt.
      const hit = 0.35;
      calm = true;
      const before = metrics(style, hit, 0.2), early = metrics(style, hit, 0.45), late = metrics(style, hit, 0.75), gone = metrics(style, hit, 1);
      calm = false; const normal = metrics(style, hit, 0.45);
      return { style, before, early, late, gone, normal, composite: ctx.globalCompositeOperation };
    });
  });
  for (const r of result) {
    expect(r.before.n, r.style).toBe(0); expect(r.early.n, r.style).toBeGreaterThan(0);
    expect(r.early.minY, r.style).toBeGreaterThan(75); expect(r.early.maxY, r.style).toBeLessThan(145);
    expect(r.late.light, r.style).toBeLessThan(r.early.light);
    expect(Math.abs(r.early.x - r.late.x), r.style).toBeLessThan(0.6);
    expect(Math.abs(r.early.y - r.late.y), r.style).toBeLessThan(0.6);
    expect(r.early.n, r.style).toBeLessThan(r.normal.n);
    expect(r.gone.n, r.style).toBe(0); expect(r.composite).toBe('source-over');
  }
});
