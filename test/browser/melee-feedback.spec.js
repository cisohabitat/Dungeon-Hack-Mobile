'use strict';
const { test, expect } = require('@playwright/test');
const { startGame, faceOpenGround, placeMonster, artReady, watchForErrors } = require('./helpers');

async function setup(page) {
  await page.addInitScript(() => {
    localStorage.setItem('deepdelve.sound', 'off');
    localStorage.setItem('deepdelve.prelude', 'off');
  });
  await startGame(page, { seed: 'melee-preview' });
  await page.evaluate(() => { Game.level().monsters.length = 0; });
  expect(await faceOpenGround(page, 2)).toBeGreaterThanOrEqual(2);
  await placeMonster(page, 'orc', 1, { hp: 999, maxHp: 999, nextAct: 1e12 });
  await artReady(page);
}

test('a close blow leaves a short impact; blocked plates and arrows do not claim a melee hit', async ({ page }) => {
  const errors = watchForErrors(page);
  await setup(page);
  const result = await page.evaluate(() => {
    const p = Game.player(), m = Game.level().monsters[0];
    let metal = false;
    Sound.listen((name, o) => { if (name === 'block' && o.metal) metal = true; });
    const hit = weapon => {
      p.eq.weapon = { t: weapon, q: 1, e: 0 }; delete m.meleeImpact;
      const before = m.hp;
      for (let i = 0; i < 40 && m.hp === before; i++) { p.nextAttack = 0; Game.input('attack'); }
      return m.meleeImpact;
    };
    const blade = hit('longsword'), blunt = hit('mace');
    const now = blunt.at;
    const hasImpact = time => Game.renderState(time).sprites.some(s => !!s.impact);
    const active = hasImpact(now + 40), early = hasImpact(now - 1), expired = hasImpact(now + 181);
    const arrow = hit('longbow');
    m.elite = 'Armoured'; m.plated = false; delete m.meleeImpact;
    p.eq.weapon = { t: 'longsword', q: 1, e: 0 };
    const hp = m.hp;
    for (let i = 0; i < 40 && !m.plated; i++) { p.nextAttack = 0; Game.input('attack'); }
    const result = { blade: blade.kind, blunt: blunt.kind, active, early, expired, arrow: !!arrow, plated: m.plated, blockedImpact: !!m.meleeImpact, blockedDamage: hp - m.hp, metal };
    m.meleeImpact = { at: performance.now(), kind: 'slash', critical: false };
    Game.save(true); Game.load();
    return { ...result, restoredImpact: Game.level().monsters.some(m => !!m.meleeImpact) };
  });
  expect(result).toEqual({ blade: 'slash', blunt: 'blunt', active: true, early: false, expired: false, arrow: false, plated: true, blockedImpact: false, blockedDamage: 0, metal: true, restoredImpact: false });
  expect(errors).toEqual([]);
});

test('the impact is visible, smaller in Calm view, and hidden behind stone', async ({ page }, testInfo) => {
  const errors = watchForErrors(page);
  await setup(page);
  const result = await page.evaluate(() => {
    const m = Game.level().monsters[0], p = Game.player(), L = Game.level();
    const at = performance.now();
    m.meleeImpact = { at, kind: 'slash', critical: true };
    const rs = Game.renderState(at + 60), ctx = document.querySelector('#view').getContext('2d');
    const render = Renderer.render;
    const difference = calm => {
      Renderer.setCalm(calm);
      render(rs.level, rs.cam, rs.sprites.map(s => ({ ...s, impact: null })), rs.fx, at + 60);
      const a = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height).data;
      render(rs.level, rs.cam, rs.sprites, rs.fx, at + 60);
      const b = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height).data;
      let n = 0;
      for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) n++;
      return n;
    };
    const normal = difference(false), calm = difference(true);
    // Put the creature two squares away with stone between it and the hero.
    const [dx, dy] = Dungeon.DIRS[p.dir], tile = (p.y + dy) * L.w + p.x + dx, old = L.tiles[tile];
    for (const s of rs.sprites) if (s.impact) { s.x += dx; s.y += dy; }
    L.tiles[tile] = Dungeon.T.WALL;
    const hidden = difference(false);
    L.tiles[tile] = old;
    for (const s of rs.sprites) if (s.impact) { s.x -= dx; s.y -= dy; }
    // Hold this actual render state for a reviewable screenshot.
    Renderer.render = () => render(rs.level, rs.cam, rs.sprites, rs.fx, at + 60);
    return { normal, calm, hidden };
  });
  expect(result.normal).toBeGreaterThan(10);
  expect(result.calm).toBeGreaterThan(0);
  expect(result.calm).toBeLessThan(result.normal);
  expect(result.hidden).toBe(0);
  await page.screenshot({ path: testInfo.outputPath('melee-impact-preview.png') });
  expect(errors).toEqual([]);
});

test('a late wind-up keeps its warning readable beside an impact in Calm view', async ({ page }, testInfo) => {
  await setup(page);
  await page.evaluate(() => {
    const m = Game.level().monsters[0], at = performance.now();
    m.windup = { at: Game.state().t - 800, until: Game.state().t + 200, kind: 'melee' };
    m.meleeImpact = { at, kind: 'slash', critical: false };
    const rs = Game.renderState(at + 40), render = Renderer.render;
    Renderer.setCalm(true);
    Renderer.render = () => render(rs.level, rs.cam, rs.sprites, rs.fx, at + 40);
  });
  await expect.poll(() => page.evaluate(() => Renderer.shown.some(s => s.markSize > 0))).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('windup-calm-preview.png') });
});

test('shot warnings distinguish missiles and magic, including grouped special attacks @mobile', async ({ page }, testInfo) => {
  const errors = watchForErrors(page);
  await setup(page);
  const result = await page.evaluate(async () => {
    const { Dice, Odds } = await import('/js/rng.js');
    const m = Game.level().monsters[0], at = performance.now(), t = Game.state().t;
    const dice = [Dice.s, Odds.s];
    m.windup = { kind: 'shot', at: t - 800, until: t + 200 };
    const kind = id => {
      m.id = id;
      return Game.renderState(at).sprites.find(s => s.maxHp === 999).tellKind;
    };
    const kinds = ['archer', 'kobold', 'dwarf_arbalest', 'acolyte', 'drow_mage', 'lich', 'warlord'].map(kind);
    m.id = 'orc'; m.pack = [{ hp: 20, maxHp: 20 }];
    m.windup = { kind: 'move', move: 'crush', at: t - 800, until: t + 200 };
    const rs = Game.renderState(at), lead = rs.sprites.filter(s => s.tell);
    const render = Renderer.render; window.__combatRender = render;
    Renderer.setCalm(true);
    Renderer.render = () => render(rs.level, rs.cam, rs.sprites, rs.fx, at);
    return { kinds, lead: lead.length, special: lead[0].special, tell: lead[0].tell, dice: Dice.s === dice[0] && Odds.s === dice[1] };
  });
  expect(result).toEqual({ kinds: ['shot', 'shot', 'shot', 'magic', 'magic', 'magic', 'shot'], lead: 1, special: true, tell: 0.8, dice: true });
  await page.screenshot({ path: testInfo.outputPath('group-warning-preview.png') });
  for (const id of ['archer', 'acolyte']) {
    await page.evaluate(id => {
      const m = Game.level().monsters[0], t = Game.state().t, at = performance.now();
      m.id = id; delete m.pack;
      m.windup = { kind: 'shot', at: t - 800, until: t + 200 };
      const rs = Game.renderState(at);
      Renderer.render = () => window.__combatRender(rs.level, rs.cam, rs.sprites, rs.fx, at);
    }, id);
    await page.screenshot({ path: testInfo.outputPath(`${id}-warning-preview.png`) });
  }
  expect(errors).toEqual([]);
});

test('avoided blows show their actual outcome without a red damage cue or extra dice @mobile', async ({ page }) => {
  const errors = watchForErrors(page);
  await setup(page);
  const result = await page.evaluate(async () => {
    const { makeFoes } = await import('/js/foes.js'), { Dice, Rng } = await import('/js/rng.js');
    const savedDice = Dice.s;
    let seed = 1;
    while (new Rng(seed).int(1, 20) !== 10) seed++;
    const expectedDice = new Rng(seed); expectedDice.int(1, 20);
    const p = { eq: { shield: null }, mirrors: 0 }, fx = { hurtFrom: -1, hurtFromUntil: 0 };
    let ac = 100, shield = false;
    const K = { P: () => p, G: { t: 1000 }, fx, realNow: 2000, mstat: m => ({ ...MONSTERS[m.id], hit: 0 }),
      meet() {}, playerAC: () => ac, rollNote: () => '', heard: () => ({}), relativeBearing: () => ({ rel: 3, word: 'on your left' }),
      log() {}, riposte() {}, shaped: () => false, hasTalent: () => false, effectFrom: () => shield };
    const foes = makeFoes(K), m = { id: 'orc' };
    const run = shot => {
      Dice.s = seed; fx.defence = null;
      if (shot) foes.rangedAttack(m); else foes.monsterAttack(m);
      return { cue: { ...fx.defence }, dice: Dice.s === expectedDice.s, red: fx.hurtFromUntil };
    };
    const miss = run(false);
    p.eq.shield = { t: 'shield', e: 0 }; ac = 11;
    const block = run(false);
    m.id = 'acolyte'; ac = 0; shield = true;
    const magic = run(true);
    shield = false; ac = 100;
    const shotMiss = run(true);
    Dice.s = savedDice;
    // Real save/load must not replay presentation receipts from the old fight.
    Game.renderState(performance.now()).fx.defence = { ...block.cue };
    Game.save(true); Game.load();
    return { miss, block, magic, shotMiss, restored: Game.renderState(performance.now()).fx.defence };
  });
  const cue = kind => ({ cue: { kind, rel: 3, at: 2000, until: 2700 }, dice: true, red: 0 });
  expect(result).toEqual({ miss: cue('miss'), block: cue('block'), magic: cue('block'), shotMiss: cue('miss'), restored: null });
  expect(errors).toEqual([]);
});

test('warning glyphs stay distinct without colour and defence receipts expire without travelling @mobile', async ({ page }, testInfo) => {
  const errors = watchForErrors(page);
  await setup(page);
  const result = await page.evaluate(async () => {
    const { drawTellGlyph, drawDefence, drawThreat } = await import('/js/meleeview.js');
    const c = document.createElement('canvas'); c.width = 320; c.height = 160;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const pixels = () => [...ctx.getImageData(0, 0, c.width, c.height).data];
    const glyphs = ['melee', 'shot', 'magic'].map(kind => {
      ctx.clearRect(0, 0, 320, 160); drawTellGlyph(ctx, kind, 160, 40, 20);
      return pixels().filter((_, i) => i % 4 === 3).join(',');
    });
    const threat = (time, calm) => {
      ctx.clearRect(0, 0, 320, 160); drawThreat(ctx, { rel: 1, near: true, tell: true }, time, calm, 320, 160); return pixels();
    };
    const calmA = threat(150, true), calmB = threat(400, true), normalA = threat(150, false), normalB = threat(400, false);
    const calmSteady = calmA.every((v, i) => v === calmB[i]), normalPulse = normalA.some((v, i) => v !== normalB[i]);
    const cue = { kind: 'block', rel: 1, at: 100, until: 800 };
    const receipt = now => { ctx.clearRect(0, 0, 320, 160); drawDefence(ctx, cue, now, 320, 160, 20, true); return pixels(); };
    const early = receipt(99).some(Boolean), active = receipt(150), still = receipt(400), gone = receipt(800).some(Boolean);
    const at = performance.now(), rs = Game.renderState(at), render = Renderer.render;
    rs.fx.defence = { kind: 'block', rel: 1, at, until: at + 700 };
    Renderer.setCalm(true);
    Renderer.render = () => render(rs.level, rs.cam, rs.sprites, rs.fx, at + 100);
    return { calmSteady, normalPulse, distinct: new Set(glyphs).size, early, active: active.some(Boolean), still: active.every((v, i) => v === still[i]), gone };
  });
  expect(result).toEqual({ calmSteady: true, normalPulse: true, distinct: 3, early: false, active: true, still: true, gone: false });
  await page.screenshot({ path: testInfo.outputPath('shield-block-preview.png') });
  expect(errors).toEqual([]);
});

test('stepping out of a wind-up gives dodge feedback and a landed blow takes priority @mobile', async ({ page }) => {
  const errors = watchForErrors(page);
  await setup(page);
  const result = await page.evaluate(async () => {
    const { Dice, Rng } = await import('/js/rng.js');
    const p = Game.player(), m = Game.level().monsters[0], G = Game.state(), [dx, dy] = Dungeon.DIRS[p.dir];
    p.hp = p.maxHp = 999; p.eq.armor = null; p.eq.shield = null;
    const fx = Game.renderState(performance.now()).fx; fx.hurtFromUntil = 0;
    // The orc's ordinary blow cannot follow a full square out of reach.
    m.x = p.x + dx * 2; m.y = p.y + dy * 2;
    m.windup = { kind: 'melee', at: G.t - 1000, until: G.t - 1, px: p.x, py: p.y };
    m.nextAct = 0;
    Game.update(performance.now(), 32);
    const dodge = { kind: fx.defence?.kind, hp: p.hp, red: fx.hurtFromUntil };
    // Seed a natural twenty for the next actual attack, rather than relying on luck.
    let seed = 1; while (new Rng(seed).int(1, 20) !== 20) seed++;
    Dice.s = seed;
    m.x = p.x + dx; m.y = p.y + dy;
    m.windup = { kind: 'melee', at: G.t - 1000, until: G.t - 1, px: p.x, py: p.y };
    m.nextAct = 0; G.blowGate = 0;
    Game.update(performance.now() + 32, 32);
    return { dodge, damaged: p.hp < 999, receipt: fx.defence, red: fx.hurtFromUntil > 0 };
  });
  expect(result).toEqual({ dodge: { kind: 'dodge', hp: 999, red: 0 }, damaged: true, receipt: null, red: true });
  expect(errors).toEqual([]);
});
