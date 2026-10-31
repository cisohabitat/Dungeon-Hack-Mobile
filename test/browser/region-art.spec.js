'use strict';
const { test, expect } = require('@playwright/test');
const { startGame, faceOpenGround, placeMonster, artReady, watchForErrors } = require('./helpers');

async function surfaces(page) {
  await page.evaluate(async () => { window.__surfaceState = (await import('/js/paintedworld.js')).paintedWorldState; });
  // Exercise the same properties on each reload before waiting for demand-loaded art.
  await page.evaluate(() => { for(const t of Assets.themes) { void t.wall; void t.wallB; void t.door; void t.decor; t.floorOf(0); t.floorOf(4); for(const k of Object.keys(t.locked)) void t.locked[k]; } });
  await page.waitForFunction(() => Object.entries(window.__surfaceState()).filter(([p]) => p.includes('/materials/')).every(([, s]) => s === 'ready'));
  return page.evaluate(async () => {
    const { Dice, Odds } = await import('/js/rng.js');
    const before = [Dice.s, Odds.s];
    const hash = pixels => {
      let h = 2166136261;
      for (const v of pixels) h = Math.imul(h ^ v, 16777619);
      return h >>> 0;
    };
    const pixels = c => c.getContext('2d').getImageData(0, 0, 64, 64).data;
    const locks = {};
    const result = Assets.themes.map((t, i) => {
      for (const key of Object.keys(t.locked)) {
        // The entire coloured plate, keyhole and corner rivets stay identical
        // across regions, even where the door itself changes material.
        const patch = t.locked[key].getContext('2d').getImageData(38, 27, 14, 16).data;
        (locks[key] ||= []).push(hash(patch));
      }
      const dry = t.floorOf(0), wet = t.floorOf(4);
      const blue = arr => arr.reduce((sum, v) => sum + ((v >>> 16) & 255) - (v & 255), 0) / arr.length;
      return {
        name: THEMES[i].name, face: THEMES[i].face,
        wall: hash(pixels(t.wall)), floor: hash(dry[0]), door: hash(pixels(t.door)),
        cached: dry === t.floor && dry === t.floorOf(0) && t.wallB === t.wallB && t.decor === t.decor,
        opaque: dry.every(level => level.length === 4096 && level.every(v => (v >>> 24) === 255)),
        levels: dry.length, water: blue(wet[0]) - blue(dry[0]),
      };
    });
    return { result, locks, diceUntouched: Dice.s === before[0] && Odds.s === before[1] };
  });
}

test('regional materials keep coded locks, water, shade caches and run dice intact @mobile', async ({ page }) => {
  const errors = watchForErrors(page);
  await page.goto('/'); await page.waitForFunction(() => window.Assets?.themes.length);
  const { result, locks, diceUntouched } = await surfaces(page);
  expect(diceUntouched).toBe(true);
  for (const [key, signatures] of Object.entries(locks)) expect(new Set(signatures).size, key).toBe(1);
  for (const t of result) { expect(t.cached, t.name).toBe(true); expect(t.opaque, t.name).toBe(true); expect(t.levels).toBe(8); }
  expect(result.find(t => t.face === 'reed').water, 'water stays bluer than dry marsh mud').toBeGreaterThan(8);
  const identities = ['Brown Catacombs', 'The Grey Hold', 'The Sunless Marsh'].map(name => result.find(t => t.name === name));
  expect(new Set(identities.map(t => t.door)).size).toBe(3);
  expect(new Set(identities.map(t => t.floor)).size).toBe(3);
  expect(errors).toEqual([]);
});

test('torchlight crosses a floor tile boundary without a brightness step @mobile', async ({ page }) => {
  await startGame(page, { seed: 'floor-light-boundary' });
  const result = await page.evaluate(async () => {
    Game.update = () => {}; Game.level().monsters = []; Game.level().npcs = [];
    const { Dice, Odds } = await import('/js/rng.js'), original = Assets.themes[0];
    // Uniform diagnostic materials isolate lighting from painted grout/colour.
    // They are never used as visual review or substituted into shipped art.
    const shades = Array.from({ length: 8 }, (_, n) => {
      const v = n === 7 ? 0 : 160 - n * 20;
      return new Uint32Array(4096).fill((0xff000000 | v << 16 | v << 8 | v) >>> 0);
    });
    Assets.themes[0] = new Proxy(original, { get(t, k) {
      if (k === 'floor' || k === 'ceil') return shades;
      if (k === 'floorOf' || k === 'ceilOf') return () => shades;
      return t[k];
    } });
    const T = Dungeon.T, w = 15, h = 15, tiles = new Uint8Array(w * h).fill(T.FLOOR);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!x || !y || x === w - 1 || y === h - 1) tiles[y * w + x] = T.WALL;
    const L = { ...Game.level(), w, h, tiles, theme: 0, twist: null, roomId: new Int16Array(w * h), rooms: [{ x: 1, y: 1, w: 13, h: 13, shape: 'box' }], piece: null, pieces: [], caved: [], lights: [{ x: 7, y: 3 }], dressing: [], remains: [], monsters: [], npcs: [], items: {}, fields: {}, explored: new Uint8Array(w * h).fill(1), seen: new Uint8Array(w * h).fill(1), locks: {}, pools: [], stairsUp: null, stairsDown: null };
    const now = 10000, rs = Game.renderState(now), fx = { ...rs.fx, view: null, arriveAt: -1e9, doorShut: {}, doorFire: {}, frost: [], vents: [], rocks: [], stains: {} };
    const state = JSON.stringify(Game.state()), dice = [Dice.s, Odds.s], samples = [], canvas = document.querySelector('#view'), ctx = canvas.getContext('2d'), row = canvas.height / 2 + 70;
    Renderer.setCalm(true);
    try {
      for (let j = -10; j <= 10; j++) {
        const cam = { x: 7.5, y: 6 + j * .004 + 100 / 70, angle: -Math.PI / 2 };
        Renderer.render(L, cam, [], fx, now);
        const p = ctx.getImageData(160, row, 1, 1).data;
        samples.push((p[0] + p[1] + p[2]) / 3);
      }
      Renderer.render({ ...L, lights: [] }, { x: 7.5, y: 6 + 100 / 70, angle: -Math.PI / 2 }, [], fx, now);
      const p = ctx.getImageData(160, row, 1, 1).data, unlit = (p[0] + p[1] + p[2]) / 3;
      // A weak distant torch must not cancel the hero's brighter foot light.
      const nearRow = canvas.height / 2 + 110, nearCam = { x: 7.5, y: 7 + 100 / 110, angle: -Math.PI / 2 };
      Renderer.render(L, nearCam, [], fx, now);
      const a = ctx.getImageData(160, nearRow, 1, 1).data, nearLit = (a[0] + a[1] + a[2]) / 3;
      Renderer.render({ ...L, lights: [] }, nearCam, [], fx, now);
      const b = ctx.getImageData(160, nearRow, 1, 1).data, nearUnlit = (b[0] + b[1] + b[2]) / 3;
      return { samples, unlit, nearLit, nearUnlit, maxStep: Math.max(...samples.slice(1).map((v, i) => Math.abs(v - samples[i]))), unchanged: state === JSON.stringify(Game.state()) && dice[0] === Dice.s && dice[1] === Odds.s };
    } finally { Assets.themes[0] = original; Renderer.setCalm(false); }
  });
  expect(result.unchanged).toBe(true);
  expect(result.samples.every(v => v > 100)).toBe(true);
  expect(Math.min(...result.samples) - result.unlit).toBeGreaterThan(10);
  expect(result.nearLit, JSON.stringify({ lit: result.nearLit, unlit: result.nearUnlit })).toBeGreaterThanOrEqual(result.nearUnlit);
  expect(result.maxStep, JSON.stringify(result.samples)).toBeLessThanOrEqual(5);
});

test('regional stone and wood are stable across a full page reload', async ({ page }) => {
  await page.goto('/'); await page.waitForFunction(() => window.Assets?.themes.length);
  const before = (await surfaces(page)).result;
  await page.reload(); await page.waitForFunction(() => window.Assets?.themes.length);
  expect((await surfaces(page)).result).toEqual(before);
});

test('every region renders the same visible foe with its own scenery in Calm view @mobile', async ({ page }, testInfo) => {
  const errors = watchForErrors(page);
  await startGame(page, { seed: 'regional-scenery', permadeath: false });
  await artReady(page); await faceOpenGround(page);
  await page.evaluate(() => { Game.level().monsters = []; });
  expect(await placeMonster(page, 'orc', 2, { hp: 300, maxHp: 300 })).not.toBeNull();
  const out = await page.evaluate(() => {
    Renderer.setCalm(true);
    const now = performance.now(), state = Game.renderState(now), view = document.querySelector('#view');
    const sheet = document.createElement('canvas'); sheet.width = view.width * 3; sheet.height = (view.height + 24) * Math.ceil(THEMES.length / 3);
    const c = sheet.getContext('2d'); c.font = '14px sans-serif';
    const regions = THEMES.map((theme, i) => {
      const level = { ...state.level, theme: i };
      Renderer.render(level, state.cam, state.sprites, state.fx, now);
      const shown = Renderer.shown;
      const x = i % 3 * view.width, y = Math.floor(i / 3) * (view.height + 24);
      c.fillStyle = '#15141a'; c.fillRect(x, y, view.width, view.height + 24); c.fillStyle = '#eee'; c.fillText(theme.name, x + 8, y + 17);
      c.drawImage(view, x, y + 24);
      return { name: theme.name, shown };
    });
    return { regions, sheet: sheet.toDataURL().split(',')[1] };
  });
  for (const region of out.regions) expect(region.shown, region.name).toEqual(out.regions[0].shown);
  expect(out.regions[0].shown.length, 'the nearby foe remains visible').toBeGreaterThan(0);
  await testInfo.attach('regional-scenes', { body: Buffer.from(out.sheet, 'base64'), contentType: 'image/png' });
  if (process.env.REGION_REVIEW_OUT) require('fs').writeFileSync(process.env.REGION_REVIEW_OUT, Buffer.from(out.sheet, 'base64'));
  expect(errors).toEqual([]);
});

test('built roofs recede from the room while distant surfaces keep their fog boundary @mobile', async ({ page }) => {
  const errors = watchForErrors(page);
  await startGame(page, { seed: 'roof-focal-plane' });
  const result = await page.evaluate(() => {
    const original = Assets.themes[0], calm = Renderer.calm;
    // Uniform diagnostic surfaces isolate roof lighting from authored patterns.
    const shades = Array.from({ length: 8 }, (_, n) => new Uint32Array(4096).fill((0xff000000 | (200 - n * 20) * 0x010101) >>> 0));
    Assets.themes[0] = new Proxy(original, { get(t, k) {
      if (k === 'floor' || k === 'ceil') return shades;
      if (k === 'floorOf' || k === 'ceilOf') return () => shades;
      return t[k];
    } });
    const w = 31, h = 31, T = Dungeon.T, tiles = new Uint8Array(w * h).fill(T.FLOOR);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!x || !y || x === w - 1 || y === h - 1) tiles[y * w + x] = T.WALL;
    const L = { ...Game.level(), w, h, tiles, theme: 0, twist: null, roomId: new Int16Array(w * h), rooms: [{ x: 1, y: 1, w: 29, h: 29, shape: 'box' }], piece: null, pieces: [], caved: [], lights: [], dressing: [], remains: [], monsters: [], npcs: [], items: {}, fields: {}, explored: new Uint8Array(w * h).fill(1), seen: new Uint8Array(w * h).fill(1), locks: {}, pools: [], stairsUp: null, stairsDown: null };
    const now = 10000, rs = Game.renderState(now), fx = { ...rs.fx, view: null, arriveAt: -1e9, doorShut: {}, doorFire: {}, stains: {}, frost: [], vents: [], rocks: [], texts: [], spells: [], corpses: [], bits: [], boss: null };
    const canvas = document.querySelector('#view'), ctx = canvas.getContext('2d');
    try {
      Renderer.setCalm(true); Renderer.render(L, { x: 15.5, y: 15.5, angle: -Math.PI / 2 }, [], fx, now);
      const sample = offset => { const y = canvas.height / 2 + offset; return [ctx.getImageData(160, y, 1, 1).data[0], ctx.getImageData(160, canvas.height - 1 - y, 1, 1).data[0]]; };
      const room = { middle: sample(29), distant: sample(13), fog: sample(10) };
      Renderer.render({ ...L, rooms: [{ ...L.rooms[0], shape: 'cave' }] }, { x: 15.5, y: 15.5, angle: -Math.PI / 2 }, [], fx, now);
      return { ...room, caveDistant: sample(13) };
    } finally { Assets.themes[0] = original; Renderer.setCalm(calm); }
  });
  expect(result.middle[0] - result.middle[1], 'the roof recedes from a lit room floor').toBeGreaterThan(10);
  expect(result.middle[1], 'the ceiling remains visible').toBeGreaterThan(50);
  expect(result.distant[0], 'a distant surface remains visible').toBeGreaterThan(20);
  expect(result.distant[1], 'the new roof shade does not introduce earlier fog').toBe(result.distant[0]);
  expect(result.fog[1]).toBe(result.fog[0]);
  expect(result.caveDistant[0]).toBe(result.distant[0]);
  expect(result.caveDistant[1], 'natural caves retain their original darker roof').toBe(result.fog[1]);
  expect(errors).toEqual([]);
});

test('wall strips match individual draws through regions, doors and stairs @mobile', async ({ page }) => {
  const errors = watchForErrors(page);
  await startGame(page, { seed: 'wall-column-batches' });
  await artReady(page); await surfaces(page);
  const result = await page.evaluate(async () => {
    Game.update = () => {}; Renderer.render = () => {};
    const [{ Renderer: batched }, { Renderer: separate }] = await Promise.all([
      import('/js/renderer.js?wall-batches'), import('/js/renderer.js?wall-individual'),
    ]);
    const canvases = [document.createElement('canvas'), document.createElement('canvas')];
    const renderers = [batched, separate];
    renderers.forEach((r, i) => { r.init(canvases[i], 304); r.setCalm(true); });
    const ctx = canvases[1].getContext('2d'), draw = ctx.drawImage.bind(ctx);
    let expanded = 0;
    ctx.drawImage = function (...args) {
      // Independent fitting reference: expand repeated columns and contiguous source strips back
      // into the original one-pixel destination calls on the actual canvas.
      if (args.length === 9 && (args[3] === 1 || args[3] === args[7]) && args[4] === 64 && args[7] > 1 && Number.isInteger(args[7])) {
        expanded += args[7] - 1;
        for (let x = 0; x < args[7]; x++) draw(args[0], args[1] + (args[3] === 1 ? 0 : x), args[2], 1, 64, args[5] + x, args[6], 1, args[8]);
      } else draw(...args);
    };
    const prototype = CanvasRenderingContext2D.prototype, nativeDraw = prototype.drawImage, mirrors = new Map();
    prototype.drawImage = function (...args) {
      const result = nativeDraw.apply(this, args);
      if (args.length === 3 && this.canvas.width === 64 && this.canvas.height === 64) {
        const t = this.getTransform();
        if (t.a === -1 && t.d === 1 && t.b === 0 && t.c === 0 && t.e === 64 && t.f === 0) mirrors.set(this.canvas, args[0]);
      }
      return result;
    };
    const T = Dungeon.T, w = 15, h = 15, now = 10000, rs = Game.renderState(now);
    const fx = { ...rs.fx, view: null, arriveAt: -1e9, doorShut: {}, doorFire: {}, stains: {}, frost: [], vents: [], rocks: [], texts: [], spells: [], corpses: [], bits: [], boss: null };
    const rows = [];
    try {
    for (let region = 0; region < Assets.themes.length; region++) for (const aperture of [T.WALL, T.DOOR, T.DOOR_OPEN, T.STAIRS_DOWN]) {
      const tiles = new Uint8Array(w * h).fill(T.FLOOR);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!x || !y || x === w - 1 || y === h - 1 || y === 6) tiles[y * w + x] = T.WALL;
      tiles[6 * w + 7] = aperture;
      const L = { ...Game.level(), w, h, tiles, theme: region, twist: null, roomId: new Int16Array(w * h), rooms: [{ x: 1, y: 1, w: 13, h: 13, shape: 'box' }], piece: null, pieces: [], caved: [], lights: [], dressing: [], remains: [], monsters: [], npcs: [], items: {}, fields: {}, explored: new Uint8Array(w * h).fill(1), seen: new Uint8Array(w * h).fill(1), locks: {}, pools: [], stairsUp: null, stairsDown: aperture === T.STAIRS_DOWN ? { x: 7, y: 6 } : null };
      for (const angle of [-Math.PI / 2, -Math.PI / 2 + .2]) {
        fx.doorShut = aperture === T.DOOR && angle > -Math.PI / 2 ? { [6 * w + 7]: { shut: .45, lock: null } } : {};
        for (const r of renderers) r.render(L, { x: 7.5, y: 7.5, angle }, [], fx, now);
        const pixels = canvases.map(c => new Uint32Array(c.getContext('2d').getImageData(0, 0, c.width, c.height).data.buffer));
        let changed = 0; for (let i = 0; i < pixels[0].length; i++) if (pixels[0][i] !== pixels[1][i]) changed++;
        rows.push({ region, aperture, angle, changed, merged: batched.wallMerged });
      }
    }
    } finally { prototype.drawImage = nativeDraw; }
    let copiedPixelsChanged = 0;
    for (const [mirror, source] of mirrors) {
      const a = mirror.getContext('2d').getImageData(0, 0, 64, 64).data;
      const b = source.getContext('2d').getImageData(0, 0, 64, 64).data;
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) for (let c = 0; c < 4; c++) {
        if (a[(y * 64 + x) * 4 + c] !== b[(y * 64 + 63 - x) * 4 + c]) copiedPixelsChanged++;
      }
    }
    return { rows, expanded, mirroredPictures: mirrors.size, copiedPixelsChanged };
  });
  expect(result.mirroredPictures, 'prepared mirrors must be exercised').toBeGreaterThan(0);
  expect(result.copiedPixelsChanged, 'reflection must preserve every source RGBA channel').toBe(0);
  expect(result.rows.every(r => r.changed === 0), JSON.stringify(result.rows.filter(r => r.changed))).toBe(true);
  expect(result.expanded, 'the comparison must exercise combined wall draws').toBeGreaterThan(0);
  expect(result.rows.some(r => r.merged > 0)).toBe(true);
  expect(errors).toEqual([]);
});
