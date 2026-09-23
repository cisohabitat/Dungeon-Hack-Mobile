import { Rng } from './rng.js';
import { SPRITES, THEMES, KEY_COLORS, ELITES, ITEMS } from './data.js';
import { CREATURES, PROPS, FLOATING, paintParts } from './creatures.js';
import { ITEM_ART } from './itemart.js';
import { heldParts, carriedParts } from './heldart.js';

// Builds all textures and sprites procedurally at startup: no image files needed.

const Assets = (() => {
  const TEX = 64;
  const SHADES = [0, 0.25, 0.45, 0.62, 0.78];
  const sprites = {};
  const themes = [];

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function adjust(hex, delta) {
    const [r, g, b] = hexToRgb(hex).map(v => Math.max(0, Math.min(255, v + delta)));
    return `rgb(${r},${g},${b})`;
  }

  // ---- sprites ----
  // Art is drawn as flat tones; the outline, contact shadow and top light are
  // added here so every sprite reads the same way against a dark wall.
  function makeSprite(def) {
    // a creature built from parts arrives already lit; the old grids are flat
    const painted = def.parts ? paintParts(def.parts, 32, def.fine ? 2 : 1) : null;
    const aw = painted ? painted.aw : def.rows[0].length, ah = painted ? painted.ah : def.rows.length;
    const w = aw + 2, h = ah + 2;               // room for the outline
    const art = canvas(aw, ah);
    const actx = art.getContext('2d');
    const solid = new Uint8Array(aw * ah);
    for (let y = 0; y < ah; y++) {
      for (let x = 0; x < aw; x++) {
        const c = painted ? painted.color[y * aw + x] : (def.rows[y][x] === '.' ? null : (def.pal[def.rows[y][x]] || '#ff00ff'));
        if (!c) continue;
        solid[y * aw + x] = 1;
        actx.fillStyle = c;
        actx.fillRect(x, y, 1, 1);
      }
    }
    const base = canvas(w, h);
    const ctx = base.getContext('2d');
    // a soft contact shadow so creatures sit on the floor instead of hovering
    if (def.shadow) {
      let minX = aw, maxX = -1;
      for (let x = 0; x < aw; x++) for (let y = ah - 4; y < ah; y++) if (solid[y * aw + x]) { if (x < minX) minX = x; if (x > maxX) maxX = x; }
      if (maxX >= minX) {
        const cx = (minX + maxX) / 2 + 1, rx = Math.max(3, (maxX - minX) / 2 + 1.5);
        const g = ctx.createRadialGradient(cx, h - 1.5, 0, cx, h - 1.5, rx);
        g.addColorStop(0, 'rgba(0,0,0,0.55)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.save();
        ctx.translate(cx, h - 1.5);
        ctx.scale(1, 0.34);
        ctx.translate(-cx, -(h - 1.5));
        ctx.beginPath();
        ctx.arc(cx, h - 1.5, rx, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    // outline every edge pixel
    const outline = def.outline || '#0a0810';
    ctx.fillStyle = outline;
    for (let y = -1; y <= ah; y++) {
      for (let x = -1; x <= aw; x++) {
        if (x >= 0 && y >= 0 && x < aw && y < ah && solid[y * aw + x]) continue;
        let touches = false;
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + ox, ny = y + oy;
          if (nx < 0 || ny < 0 || nx >= aw || ny >= ah) continue;
          if (solid[ny * aw + nx]) { touches = true; break; }
        }
        if (touches) ctx.fillRect(x + 1, y + 1, 1, 1);
      }
    }
    ctx.drawImage(art, 1, 1);
    // light from above, shadow pooling at the feet
    const lg = ctx.createLinearGradient(0, 0, 0, h);
    lg.addColorStop(0, `rgba(255,245,215,${painted ? 0.05 : 0.16})`);
    lg.addColorStop(0.45, 'rgba(255,245,215,0)');
    lg.addColorStop(1, `rgba(0,0,20,${painted ? 0.2 : 0.28})`);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = lg;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
    const tintOf = (color, alpha) => {
      const c = canvas(w, h);
      const cx = c.getContext('2d');
      cx.drawImage(base, 0, 0);
      cx.globalCompositeOperation = 'source-atop';
      cx.fillStyle = color;
      cx.globalAlpha = alpha;
      cx.fillRect(0, 0, w, h);
      return c;
    };
    // where the drawing starts, as a fraction of the frame: a rat fills only
    // the bottom of its frame, and a mark over the frame floated far above it
    let firstRow = 0;
    while (firstRow < ah && !solid.subarray(firstRow * aw, firstRow * aw + aw).some(v => v)) firstRow++;
    const top = firstRow / h;
    const make = () => ({
      w, h, top,
      levels: SHADES.map(a => (a === 0 ? base : tintOf('#000', a))),
      flash: tintOf('#fff', 0.85),
      url: base.toDataURL(),
    });
    const sprite = make();
    // Elite variants: the base sprite washed with the champion's colour, then
    // shaded. Only monsters can be champions, and building these for every
    // item, key and prop as well was over half the time the game took to start.
    sprite.elite = {};
    if (def.elites) for (const e of ELITES) {
      const washed = tintOf(e.tint, 0.4);
      const shade = a => {
        const c = canvas(w, h);
        const cx = c.getContext('2d');
        cx.drawImage(washed, 0, 0);
        if (a > 0) { cx.globalCompositeOperation = 'source-atop'; cx.fillStyle = '#000'; cx.globalAlpha = a; cx.fillRect(0, 0, w, h); }
        return c;
      };
      sprite.elite[e.prefix] = { w, h, top, levels: SHADES.map(shade), flash: sprite.flash, url: washed.toDataURL() };
    }
    return sprite;
  }

  // ---- textures ----
  function makeWall(theme, seed, cracked) {
    const c = canvas(TEX, TEX);
    const ctx = c.getContext('2d');
    const rng = new Rng(seed);
    ctx.fillStyle = theme.mortar;
    ctx.fillRect(0, 0, TEX, TEX);
    const bh = 8, bw = 16;
    for (let row = 0; row < TEX / bh; row++) {
      const off = (row % 2) ? 8 : 0;
      for (let bx = -1; bx <= TEX / bw; bx++) {
        const x = bx * bw + off, y = row * bh;
        const shade = rng.int(-14, 14);
        ctx.fillStyle = adjust(theme.wall, shade);
        ctx.fillRect(x + 1, y + 1, bw - 2, bh - 2);
        ctx.fillStyle = adjust(theme.wall, shade + 20);
        ctx.fillRect(x + 1, y + 1, bw - 2, 1);
        ctx.fillRect(x + 1, y + 1, 1, bh - 2);
        ctx.fillStyle = adjust(theme.wall, shade - 24);
        ctx.fillRect(x + 1, y + bh - 2, bw - 2, 1);
        ctx.fillRect(x + bw - 2, y + 1, 1, bh - 2);
      }
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = 0; i < 50; i++) ctx.fillRect(rng.int(0, TEX - 1), rng.int(0, TEX - 1), 1, 1);
    if (cracked) {
      ctx.fillStyle = theme.accent;
      for (let i = 0; i < 26; i++) ctx.fillRect(rng.int(0, TEX - 1), rng.int(0, TEX - 1), rng.int(1, 2), 1);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      let x = rng.int(10, 50), y = 0;
      while (y < TEX) { ctx.fillRect(x, y, 1, 2); y += 2; x += rng.int(-1, 1); }
    }
    return c;
  }

  function makeDoor(theme, wallTex, lockColor) {
    const c = canvas(TEX, TEX);
    const ctx = c.getContext('2d');
    ctx.drawImage(wallTex, 0, 0);
    // frame
    ctx.fillStyle = '#1a1410';
    ctx.fillRect(6, 2, 52, 62);
    // planks
    for (let i = 0; i < 6; i++) {
      const x = 8 + i * 8;
      ctx.fillStyle = i % 2 ? '#6b4a2a' : '#7a5632';
      ctx.fillRect(x, 4, 8, 60);
      ctx.fillStyle = '#4a3018';
      ctx.fillRect(x, 4, 1, 60);
    }
    // wood grain
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 6; y < 62; y += 5) for (let i = 0; i < 6; i++) ctx.fillRect(9 + i * 8 + ((y * 7 + i * 3) % 5), y, 3, 1);
    // iron bands
    for (const y of [12, 46]) {
      ctx.fillStyle = '#4a4e56';
      ctx.fillRect(8, y, 48, 6);
      ctx.fillStyle = '#7c8088';
      ctx.fillRect(8, y, 48, 1);
      ctx.fillStyle = '#9aa0a8';
      for (let x = 12; x < 56; x += 10) ctx.fillRect(x, y + 2, 2, 2);
    }
    if (lockColor) {
      ctx.fillStyle = '#2a2a30';
      ctx.fillRect(38, 27, 14, 16);
      ctx.fillStyle = lockColor;
      ctx.fillRect(39, 28, 12, 14);
      ctx.fillStyle = '#101010';
      ctx.fillRect(44, 31, 2, 2);
      ctx.fillRect(44, 33, 2, 5);
    } else {
      ctx.fillStyle = '#2a2a30';
      ctx.fillRect(42, 30, 6, 6);
      ctx.fillStyle = '#c0c4cc';
      ctx.fillRect(43, 31, 4, 4);
    }
    return c;
  }

  function makeStairs(theme, wallTex, down) {
    const c = canvas(TEX, TEX);
    const ctx = c.getContext('2d');
    ctx.drawImage(wallTex, 0, 0);
    // archway
    ctx.fillStyle = '#050508';
    ctx.beginPath();
    ctx.moveTo(8, 64);
    ctx.lineTo(8, 20);
    ctx.quadraticCurveTo(32, -8, 56, 20);
    ctx.lineTo(56, 64);
    ctx.closePath();
    ctx.fill();
    // steps
    const steps = 7;
    for (let i = 0; i < steps; i++) {
      let y, hgt, inset, bright;
      if (down) {
        // steps descend away from the viewer into darkness
        y = 30 + i * 5; hgt = 5; inset = 4 + i * 2; bright = 110 - i * 14;
      } else {
        // steps climb toward light
        y = 60 - i * 6; hgt = 6; inset = 4 + i * 2; bright = 60 + i * 14;
      }
      ctx.fillStyle = `rgb(${bright},${bright},${bright + 6})`;
      ctx.fillRect(10 + inset, y, 44 - inset * 2, hgt);
      ctx.fillStyle = `rgb(${bright + 30},${bright + 30},${bright + 36})`;
      ctx.fillRect(10 + inset, y, 44 - inset * 2, 1);
    }
    if (!down) {
      // daylight glow at the top of an ascending stair
      ctx.fillStyle = 'rgba(255,240,200,0.35)';
      ctx.fillRect(22, 16, 20, 8);
    }
    return c;
  }

  // Floor and ceiling textures are stored as Uint32 pixel arrays at 8 darkness
  // levels so the floor caster can copy pixels without per-pixel math.
  const FLOOR_LEVELS = 8;
  function toLevels(c) {
    const data = c.getContext('2d').getImageData(0, 0, TEX, TEX).data;
    const out = [];
    for (let l = 0; l < FLOOR_LEVELS; l++) {
      const f = 1 - l / (FLOOR_LEVELS - 1);
      const arr = new Uint32Array(TEX * TEX);
      for (let i = 0; i < TEX * TEX; i++) {
        const r = (data[i * 4] * f) | 0, g = (data[i * 4 + 1] * f) | 0, b = (data[i * 4 + 2] * f) | 0;
        arr[i] = 0xff000000 | (b << 16) | (g << 8) | r;
      }
      out.push(arr);
    }
    return out;
  }
  function makeFloor(theme, seed) {
    const c = canvas(TEX, TEX);
    const ctx = c.getContext('2d');
    const rng = new Rng(seed);
    ctx.fillStyle = adjust(theme.floor, -18);
    ctx.fillRect(0, 0, TEX, TEX);
    const n = 4, s = TEX / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const sh = rng.int(-10, 10);
      ctx.fillStyle = adjust(theme.floor, sh + 6);
      ctx.fillRect(x * s + 1, y * s + 1, s - 2, s - 2);
      ctx.fillStyle = adjust(theme.floor, sh + 16);
      ctx.fillRect(x * s + 1, y * s + 1, s - 2, 1);
      ctx.fillStyle = adjust(theme.floor, sh - 10);
      ctx.fillRect(x * s + 1, y * s + s - 2, s - 2, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      for (let k = 0; k < 6; k++) ctx.fillRect(x * s + rng.int(2, s - 3), y * s + rng.int(2, s - 3), 1, 1);
    }
    return c;
  }
  function makeCeiling(theme, seed) {
    const c = canvas(TEX, TEX);
    const ctx = c.getContext('2d');
    const rng = new Rng(seed);
    ctx.fillStyle = theme.ceil;
    ctx.fillRect(0, 0, TEX, TEX);
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = adjust(theme.ceil, rng.int(-10, 14));
      ctx.fillRect(rng.int(0, TEX - 1), rng.int(0, TEX - 1), rng.int(1, 3), rng.int(1, 2));
    }
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let i = 0; i < 4; i++) { let x = rng.int(0, TEX - 1); for (let y = 0; y < TEX; y += 2) { ctx.fillRect(x, y, 1, 2); x = (x + rng.int(-1, 1) + TEX) % TEX; } }
    return c;
  }
  function makeFountain(theme, wallTex, dry) {
    const c = canvas(TEX, TEX);
    const ctx = c.getContext('2d');
    ctx.drawImage(wallTex, 0, 0);
    // carved niche
    ctx.fillStyle = '#101018';
    ctx.beginPath();
    ctx.moveTo(14, 40); ctx.lineTo(14, 18); ctx.quadraticCurveTo(32, 2, 50, 18); ctx.lineTo(50, 40); ctx.closePath(); ctx.fill();
    // spout face
    ctx.fillStyle = '#7a7a84';
    ctx.fillRect(28, 18, 8, 8);
    ctx.fillStyle = '#3a3a44';
    ctx.fillRect(30, 20, 4, 4);
    // basin
    ctx.fillStyle = '#5a5a66';
    ctx.fillRect(8, 40, 48, 18);
    ctx.fillStyle = '#8a8a94';
    ctx.fillRect(8, 40, 48, 2);
    ctx.fillStyle = '#3a3a44';
    ctx.fillRect(10, 44, 44, 12);
    if (!dry) {
      ctx.fillStyle = '#3070c0';
      ctx.fillRect(11, 45, 42, 10);
      ctx.fillStyle = '#7ab0f0';
      for (let i = 0; i < 8; i++) ctx.fillRect(13 + i * 5, 46 + (i % 2) * 3, 3, 1);
      // falling water
      ctx.fillStyle = '#9ac8ff';
      ctx.fillRect(31, 26, 2, 19);
    } else {
      ctx.fillStyle = '#2a2a30';
      ctx.fillRect(11, 47, 42, 8);
    }
    return c;
  }

  // A wall with a lit torch bracket. Used as a light source in corridors.
  function makeTorch(theme, wallTex, seed) {
    const c = canvas(TEX, TEX);
    const ctx = c.getContext('2d');
    const rng = new Rng(seed);
    ctx.drawImage(wallTex, 0, 0);
    // bracket
    ctx.fillStyle = '#2a2a32';
    ctx.fillRect(29, 30, 6, 12);
    ctx.fillRect(26, 40, 12, 3);
    // handle
    ctx.fillStyle = '#5a3a1a';
    ctx.fillRect(30, 24, 4, 8);
    // flame
    /** @type {Array<[string, number]>} */
    const flame = [['#ff4010', 9], ['#ff9020', 6], ['#ffe060', 3]];
    for (const [col, r] of flame) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(32, 20 - r * 0.4, r * 0.7, r, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // glow on the surrounding stone
    const g = ctx.createRadialGradient(32, 20, 2, 32, 20, 30);
    g.addColorStop(0, 'rgba(255,180,60,0.45)');
    g.addColorStop(1, 'rgba(255,140,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, TEX, TEX);
    // soot
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    for (let i = 0; i < 20; i++) ctx.fillRect(rng.int(24, 40), rng.int(0, 14), 2, 1);
    return c;
  }

  function makeTheme(theme, i) {
    const wall = makeWall(theme, 'wall' + i, false);
    const wallCracked = makeWall(theme, 'crack' + i, true);
    const locked = {};
    for (const k in KEY_COLORS) locked[k] = makeDoor(theme, wall, KEY_COLORS[k]);
    return {
      wall, wallCracked,
      door: makeDoor(theme, wall, null),
      locked,
      stairsDown: makeStairs(theme, wall, true),
      stairsUp: makeStairs(theme, wall, false),
      torch: makeTorch(theme, wall, 'torch' + i),
      fountain: makeFountain(theme, wall, false),
      fountainDry: makeFountain(theme, wall, true),
      floor: toLevels(makeFloor(theme, 'floor' + i)),
      ceil: toLevels(makeCeiling(theme, 'ceil' + i)),
      theme,
    };
  }

  function init() {
    for (const k in SPRITES) sprites[k] = makeSprite(SPRITES[k]);
    // items painted from parts replace their old grids too
    // items are painted finely too: a pack slot on a phone shows them at two or three device pixels to the unit
    for (const k in ITEM_ART) sprites[k] = makeSprite({ parts: ITEM_ART[k](), fine: true });
    // relics wear their base item's picture with a gold edge, on the floor and in the pack
    for (const k of new Set(Object.values(ITEMS).filter(b => ['weapon', 'armor', 'shield'].includes(b.kind)).map(b => b.sprite))) {
      if (ITEM_ART[k]) sprites['relic_' + k] = makeSprite({ parts: ITEM_ART[k](), outline: '#e8b84a', fine: true });
    }
    // creatures built from parts replace their old grids
    // creatures and props stand in the world, close enough to fill the view: they
    // are painted twice as fine as the items in the pack
    for (const k in CREATURES) sprites[k] = makeSprite({ parts: CREATURES[k](), shadow: FLOATING.has(k) ? 0 : 1, elites: true, fine: true });
    for (const k in PROPS) sprites[k] = makeSprite({ parts: PROPS[k](), shadow: FLOATING.has(k) ? 0 : 1, fine: true });
    THEMES.forEach((t, i) => { themes[i] = makeTheme(t, i); });
  }

  // ---- what the hero holds ----
  // Painted three times as fine as the grid and only when first needed: a
  // frame for each pose of the swing, cropped to what was drawn, with the
  // hand's place in it kept so the view can put the hand where it wants it.
  const heldCache = new Map();
  function trim(painted, outline, anchor, marks = {}) {
    const { aw, color } = painted;
    let x0 = aw, y0 = aw, x1 = -1, y1 = -1;
    for (let y = 0; y < aw; y++) for (let x = 0; x < aw; x++) if (color[y * aw + x]) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    if (x1 < 0) return null;
    const w = x1 - x0 + 3, h = y1 - y0 + 3;
    const c = canvas(w, h), cx = c.getContext('2d');
    const on = (x, y) => x >= 0 && y >= 0 && x < aw && y < aw && !!color[y * aw + x];
    cx.fillStyle = outline;
    for (let y = y0 - 1; y <= y1 + 1; y++) for (let x = x0 - 1; x <= x1 + 1; x++) {
      if (on(x, y)) { cx.fillStyle = color[y * aw + x]; cx.fillRect(x - x0 + 1, y - y0 + 1, 1, 1); continue; }
      if (on(x + 1, y) || on(x - 1, y) || on(x, y + 1) || on(x, y - 1)) { cx.fillStyle = outline; cx.fillRect(x - x0 + 1, y - y0 + 1, 1, 1); }
    }
    const at = {};
    for (const k in marks) at[k] = [marks[k][0] - x0 + 1, marks[k][1] - y0 + 1];
    return { img: c, ax: anchor[0] - x0 + 1, ay: anchor[1] - y0 + 1, at };
  }
  const paintHeld = (h, outline) => {
    const SCALE = 3, m = {};
    for (const k in h.marks || {}) m[k] = h.marks[k].map(v => v * SCALE);
    return trim(paintParts(h.parts, h.grid, SCALE), outline, h.anchor.map(v => v * SCALE), m);
  };
  const outlineFor = id => (id && id.startsWith('relic_') ? '#e8b84a' : '#0a0810');
  /** One pose of a held weapon (or bare fist, id null) with the hand on it. */
  function held(id, pose, cls, two) {
    const key = `${id}|${pose}|${cls}|${two ? 2 : 1}`;
    if (heldCache.has(key)) return heldCache.get(key);
    const h = heldParts(id, pose, cls, two);
    const fr = h ? paintHeld(h, outlineFor(id)) : null;
    heldCache.set(key, fr);
    return fr;
  }
  /** A shield as it is carried: seen from behind, on the hero's arm. */
  function carried(id, cls) {
    const key = `carried|${id}|${cls}`;
    if (heldCache.has(key)) return heldCache.get(key);
    const h = carriedParts(id, cls);
    const fr = h ? paintHeld(h, outlineFor(id)) : null;
    heldCache.set(key, fr);
    return fr;
  }

  return { init, sprites, themes, SHADES, FLOOR_LEVELS, TEX, held, carried };
})();

export { Assets };
