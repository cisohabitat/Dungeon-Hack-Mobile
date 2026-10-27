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

test('painted fire and frost stay local at close range and expire @mobile', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const { paintedImpact } = await import('/js/paintedworld.js');
    window.__impactReady = () => ['fire', 'frost'].every(k => [0, 1, 2, 3].every(i => !!paintedImpact(k, i)));
    window.__impactReady();
  });
  await page.waitForFunction(() => window.__impactReady());
  const rows = await page.evaluate(async () => {
    const { makeSpellFx } = await import('/js/spellfx.js');
    const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 240;
    const ctx = canvas.getContext('2d'), fx = makeSpellFx({ W: 320, H: 240, ctx, calm: false });
    return ['fireball', 'cone'].flatMap(style => [35, 240, 800].map(r => {
      const effect = { spells: [{ style, color: '#8ef', impact: .35, born: 0, until: 1000, pts: [{}] }] };
      const bounds = age => {
        ctx.clearRect(0, 0, 320, 240);
        fx.drawSpells(effect, age * 1000, () => ({ x: 160, y: 120, r }));
        const data = ctx.getImageData(0, 0, 320, 240).data;
        let minX = 320, maxX = -1, minY = 240, maxY = -1, n = 0;
        for (let i = 0; i < data.length; i += 4) if (data[i + 3]) {
          const x = i / 4 % 320, y = (i / 4 / 320) | 0;
          minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); n++;
        }
        return { width: maxX - minX + 1, height: maxY - minY + 1, n };
      };
      return { style, r, impact: bounds(.36), gone: bounds(1), composite: ctx.globalCompositeOperation, alpha: ctx.globalAlpha };
    }));
  });
  for (const row of rows) {
    expect(row.impact.n).toBeGreaterThan(row.r > 35 ? 10 : 0);
    expect(row.impact.width).toBeLessThanOrEqual(103);
    expect(row.impact.height).toBeLessThanOrEqual(103);
    expect(row.gone.n).toBe(0); expect(row.composite).toBe('source-over'); expect(row.alpha).toBe(1);
  }
  for (const style of ['fireball', 'cone']) {
    const [far, middle, close] = rows.filter(r => r.style === style);
    expect(close.impact.width).toBe(middle.impact.width);
    expect(far.impact.width).toBeLessThan(close.impact.width);
  }
});

test('overlapping spells leave warning and damage receipt pixels clear @mobile', async ({ page }) => {
  await setup(page, 'Mage');
  const result = await page.evaluate(async () => {
    const { Dice, Odds } = await import('/js/rng.js');
    Game.update = () => {};
    const m = Game.level().monsters[0], at = performance.now(), G = Game.state();
    m.windup = { at: G.t - 800, until: G.t + 200, kind: 'melee' };
    const rs = Game.renderState(at), render = Renderer.render, ctx = document.querySelector('#view').getContext('2d');
    const pt = { x: m.rx + .5, y: m.ry + .5 }, state = JSON.stringify(G), dice = [Dice.s, Odds.s];
    const fx = { ...rs.fx, view: null, texts: [{ ...pt, text: '42', color: '#ff7040', outcome: 'critical', born: at - 10, until: at + 500 }], spells: [] };
    const rows = [];
    for (const big of [false, true]) for (const calm of [false, true]) {
      Renderer.setBigNumbers(big); Renderer.setCalm(calm);
      render(rs.level, rs.cam, rs.sprites, fx, at);
      const marks = Renderer.shown.filter(m => m.markSize).map(m => ({ x: m.markX - m.markSize - 2, y: m.markY - m.markSize - 2, w: m.markSize * 2 + 4, h: m.markSize + 4 }));
      const labels = Renderer.numbers.map(n => ({ x: n.x - n.half - 3, y: n.y - (big ? 23 : 16) - 3, w: n.half * 2 + 6, h: (big ? 23 : 16) + 7 }));
      const rects = [...marks, ...labels].map(r => ({ x: Math.max(0, Math.floor(r.x)), y: Math.max(0, Math.floor(r.y)), w: Math.floor(r.w), h: Math.floor(r.h) }));
      // Compare only opaque ink; translucent antialias edges naturally blend
      // with the spell behind them. A dense volley deliberately crosses both.
      const ink = [];
      const originalFill = ctx.fillText.bind(ctx), originalStroke = ctx.strokeText.bind(ctx);
      ctx.fillText = () => {}; ctx.strokeText = () => {};
      render(rs.level, rs.cam, rs.sprites, fx, at);
      const noText = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height).data;
      ctx.fillText = originalFill; ctx.strokeText = originalStroke;
      render(rs.level, rs.cam, rs.sprites, fx, at);
      const before = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height).data;
      for (const r of labels) for (let y = Math.ceil(r.y); y < Math.floor(r.y + r.h); y++) for (let x = Math.ceil(r.x); x < Math.floor(r.x + r.w); x++) {
        const i = (y * ctx.canvas.width + x) * 4;
        if (before[i] === 255 && before[i + 1] === 112 && before[i + 2] === 64 && (before[i] !== noText[i] || before[i + 1] !== noText[i + 1])) ink.push(i);
      }
      // A dense stationary volley crosses the label and warning even in Calm.
      fx.spells = Array.from({ length: 12 }, () => ({ style: 'lightning', from: { x: .5, y: 0 }, color: '#8ef', impact: 0, born: at - 20, until: at + 500, pts: [pt] }));
      render(rs.level, rs.cam, rs.sprites, fx, at);
      const after = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height).data;
      const same = i => before[i] === after[i] && before[i + 1] === after[i + 1] && before[i + 2] === after[i + 2];
      let warningChanges = 0;
      for (const r of rects.slice(0, marks.length)) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (!same((y * ctx.canvas.width + x) * 4)) warningChanges++;
      rows.push({ big, calm, marks: marks.length, labels: labels.length, ink: ink.length, changedInk: ink.filter(i => !same(i)).length, warningChanges });
      fx.spells = [];
    }
    return { rows, unchanged: JSON.stringify(G) === state && Dice.s === dice[0] && Odds.s === dice[1] };
  });
  for (const row of result.rows) {
    expect(row.marks).toBeGreaterThan(0); expect(row.labels).toBe(1); expect(row.ink).toBeGreaterThan(5);
    expect(row.changedInk).toBe(0); expect(row.warningChanges).toBe(0);
  }
  expect(result.unchanged).toBe(true);
});
