'use strict';
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
  function makeSprite(def) {
    const h = def.rows.length, w = def.rows[0].length;
    const base = canvas(w, h);
    const ctx = base.getContext('2d');
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ch = def.rows[y][x];
        if (ch === '.') continue;
        ctx.fillStyle = def.pal[ch] || '#ff00ff';
        ctx.fillRect(x, y, 1, 1);
      }
    }
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
    const make = () => ({
      w, h,
      levels: SHADES.map(a => (a === 0 ? base : tintOf('#000', a))),
      flash: tintOf('#fff', 0.85),
      url: base.toDataURL(),
    });
    const sprite = make();
    // Elite variants: the base sprite washed with the champion's colour, then shaded.
    sprite.elite = {};
    for (const e of ELITES) {
      const washed = tintOf(e.tint, 0.4);
      const shade = a => {
        const c = canvas(w, h);
        const cx = c.getContext('2d');
        cx.drawImage(washed, 0, 0);
        if (a > 0) { cx.globalCompositeOperation = 'source-atop'; cx.fillStyle = '#000'; cx.globalAlpha = a; cx.fillRect(0, 0, w, h); }
        return c;
      };
      sprite.elite[e.prefix] = { w, h, levels: SHADES.map(shade), flash: sprite.flash, url: washed.toDataURL() };
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
      const t = i / (steps - 1);
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
    THEMES.forEach((t, i) => { themes[i] = makeTheme(t, i); });
  }

  return { init, sprites, themes, SHADES, FLOOR_LEVELS, TEX };
})();
