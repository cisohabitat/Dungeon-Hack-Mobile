import { Assets } from './assets.js';
import { Dungeon } from './dungeon.js';

// First-person raycast renderer with textured walls and billboard sprites.

const Renderer = (() => {
  // The buffer is always 320 wide; its height follows the shape of the space
  // the view is given, so a tall phone gets a tall view instead of empty
  // screen. P is the projection scale, the height a wall one tile away fills.
  // It stays fixed, so walls keep their proportions and a taller view simply
  // shows more floor and ceiling, as a lens held upright would.
  const W = 320, P = 200, H_MIN = 200, H_MAX = 300;
  let H = H_MIN;
  const FOV = Math.PI / 3;
  const TAN_HALF = Math.tan(FOV / 2);
  const FOG = 9;
  const T = Dungeon.T;
  const LIGHT_R = 4.5;        // torch radius in tiles
  const LIGHT_MAX = 3.2;       // strongest brightening, in shade levels
  const lightCache = new WeakMap();
  let canvas, ctx, fb, fb32;
  const zbuf = new Float32Array(W);
  const rowLevel = new Uint8Array(H_MAX);   // darkness level per floor row
  const rowDist = new Float32Array(H_MAX);
  function buildRows() {
    for (let y = H / 2 + 1; y < H; y++) {
      const dist = (P / 2) / (y - H / 2);
      rowDist[y] = dist;
      rowLevel[y] = Math.min(7, Math.round(dist / FOG * 7));
    }
  }
  buildRows();
  const shadeStyles = [];
  for (let i = 0; i <= 20; i++) shadeStyles.push(`rgba(0,0,0,${(i / 20).toFixed(2)})`);

  function init(c, height) {
    canvas = c;
    setHeight(height || H_MIN);
  }
  /** Match the buffer to the view's shape. Returns the height it settled on. */
  function setHeight(h) {
    // even, so the horizon falls between two rows as it always has
    H = Math.max(H_MIN, Math.min(H_MAX, Math.round(h / 2) * 2));
    canvas.width = W; canvas.height = H;
    ctx = canvas.getContext('2d', { alpha: false });
    ctx.imageSmoothingEnabled = false;
    fb = ctx.createImageData(W, H);
    fb32 = new Uint32Array(fb.data.buffer);
    buildRows();
    return H;
  }

  // Textured floor and ceiling: for every screen row below the horizon, walk
  // the world-space line it sees and copy pre-shaded texture pixels.
  function castFloor(tex, px, py, dirX, dirY, planeX, planeY, level, lm) {
    const TX = Assets.TEX;
    const floorT = tex.floor, ceilT = tex.ceil;
    const lw = level.w, lh = level.h;
    const rdx0 = dirX - planeX, rdy0 = dirY - planeY;
    const rdx1 = dirX + planeX, rdy1 = dirY + planeY;
    const half = H / 2;
    for (let y = half + 1; y < H; y++) {
      const level = rowLevel[y];
      const dist = rowDist[y];
      const fl = floorT[level], ce = ceilT[level];
      if (level >= 7 && dist > FOG) {
        const o0 = y * W, oc0 = (H - 1 - y) * W;
        for (let x = 0; x < W; x++) { fb32[o0 + x] = 0xff000000; fb32[oc0 + x] = 0xff000000; }
        continue;
      }
      const stepX = dist * (rdx1 - rdx0) / W, stepY = dist * (rdy1 - rdy0) / W;
      let fx = px + dist * rdx0, fy = py + dist * rdy0;
      let o = y * W, oc = (H - 1 - y) * W;
      for (let x = 0; x < W; x++) {
        const mx = fx | 0, my = fy | 0;
        let lv = level;
        if (mx >= 0 && my >= 0 && mx < lw && my < lh) {
          const boost = lm[my * lw + mx];
          if (boost > 0) lv = Math.max(0, level - Math.round(boost));
        }
        if (lv >= 7) { fb32[o + x] = 0xff000000; fb32[oc + x] = 0xff000000; fx += stepX; fy += stepY; continue; }
        const src = lv === level ? fl : floorT[lv];
        const csrc = lv === level ? ce : ceilT[lv];
        const tx = ((fx * TX) | 0) & (TX - 1), ty = ((fy * TX) | 0) & (TX - 1);
        const ti = ty * TX + tx;
        fb32[o + x] = src[ti];
        fb32[oc + x] = csrc[ti];
        fx += stepX; fy += stepY;
      }
    }
    // horizon rows
    for (let x = 0; x < W; x++) { fb32[half * W + x] = 0xff000000; fb32[(half - 1) * W + x] = 0xff000000; }
    ctx.putImageData(fb, 0, 0);
  }

  function isSolid(t) { return t !== T.FLOOR && t !== T.DOOR_OPEN; }

  // A per-tile brightness field from the level's torches, built once per level.
  function ensureLights(level) {
    const cached = lightCache.get(level);
    if (cached) return cached;
    const lm = new Float32Array(level.w * level.h);
    for (const l of (level.lights || [])) {
      const r = Math.ceil(LIGHT_R);
      for (let y = Math.max(0, l.y - r); y <= Math.min(level.h - 1, l.y + r); y++) {
        for (let x = Math.max(0, l.x - r); x <= Math.min(level.w - 1, l.x + r); x++) {
          const dist = Math.hypot(x - l.x, y - l.y);
          if (dist > LIGHT_R) continue;
          const v = LIGHT_MAX * (1 - dist / LIGHT_R) * (1 - dist / LIGHT_R);
          const i = y * level.w + x;
          if (v > lm[i]) lm[i] = v;
        }
      }
    }
    lightCache.set(level, lm);
    return lm;
  }

  function texFor(tex, tile, x, y) {
    switch (tile) {
      case T.DOOR: return tex.door;
      case T.DOOR_LOCKED: return null; // resolved by caller using locks
      case T.STAIRS_DOWN: return tex.stairsDown;
      case T.STAIRS_UP: return tex.stairsUp;
      case T.FOUNTAIN: return null;
      case T.TORCH: return tex.torch;
      default: return ((x * 7 + y * 13) % 6 === 0) ? tex.wallCracked : tex.wall;
    }
  }

  // sprites: [{x, y, img (sprite asset), scale, yOff, flash}]
  // ---------- the hero's hands ----------
  // What the hero holds, drawn at the bottom of the view: the weapon's own
  // picture in a gloved fist at the right, a shield or second blade at the
  // left. It sways at rest, bobs with each step, slashes across on Attack,
  // jolts when a blow lands, and the other hand rises glowing to cast.
  // Item pictures lie grip at the lower left, point at the upper right; this
  // is where the grip is in them.
  const GRIP = [0.2, 0.8];
  const ease = u => (u < 0 ? 0 : u > 1 ? 1 : u * u * (3 - 2 * u));
  function held(id, gx, gy, size, angle, mirror) {
    const art = Assets.sprites[id];
    if (!art) return;
    const img = art.levels[0];
    ctx.save();
    ctx.translate(gx, gy);
    ctx.rotate(angle);
    if (mirror) ctx.scale(-1, 1);
    ctx.drawImage(img, -GRIP[0] * size, -GRIP[1] * size, size, size);
    ctx.restore();
  }
  function hand(id, cx, cy, size, glow) {
    const art = Assets.sprites[id];
    if (!art) return;
    if (glow) {
      const g = ctx.createRadialGradient(cx, cy - size * 0.2, 0, cx, cy - size * 0.2, size * 0.8);
      g.addColorStop(0, glow.replace(/^#(.)(.)(.)$/, '#$1$1$2$2$3$3') + 'cc'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(cx - size, cy - size, size * 2, size * 2);
    }
    ctx.drawImage(art.levels[0], cx - size * 0.5, cy - size * 0.55, size, size);
  }
  function drawView(fx, now) {
    const v = fx.view;
    if (!v) return;
    // a step's bob and a slow sway at rest
    const step = Math.sin((v.walk || 0) * Math.PI);
    const bx = Math.sin(now / 900) * 1.5 + (v.steps % 2 ? 1 : -1) * step * 3, by = Math.abs(step) * 7 + Math.sin(now / 700) * 1.2;
    // a blow landing jolts the hands down
    const hurt = now < fx.damageUntil ? (fx.damageUntil - now) / 260 : 0;
    const jx = hurt ? Math.sin(now / 17) * 4 * hurt : 0, jy = hurt * 9;
    // the swing: drawn back a moment, slashed across, and back to rest
    const u = (now - fx.swingAt) / (fx.swingMs || 300);
    let sa = 0, sx = 0, sy = 0;
    if (u >= 0 && u < 1) {
      const back = ease(u / 0.22), cut = ease((u - 0.22) / 0.4), home = ease((u - 0.72) / 0.28);
      sa = 0.3 * back - 1.25 * cut * (1 - home) - 0.3 * back * cut;
      sx = -W * 0.2 * cut * (1 - home); sy = H * 0.06 * cut * (1 - home) - H * 0.03 * back * (1 - cut);
    }
    const ou = (now - fx.offAt) / 260;
    const oa = ou >= 0 && ou < 1 ? Math.sin(ou * Math.PI) : 0;
    // casting: the off hand rises into view, alight
    const cu = (now - fx.castAt) / 520;
    const cast = cu >= 0 && cu < 1 ? Math.sin(cu * Math.PI) : 0;

    // left: shield, second blade, or a bare fist
    const lx = W * 0.17 + bx + jx, ly = H + by + jy;
    if (v.shield) {
      const dip = cast * H * 0.35;
      held(v.shield, lx - W * 0.13, ly + dip - H * 0.02 - hurt * 10, H * 0.6, -0.3 + hurt * 0.1, false);
    } else if (v.offhand) {
      held(v.offhand, lx + W * 0.02 + oa * W * 0.12, ly - oa * H * 0.04 + cast * H * 0.3, H * 0.75, -0.3 + oa * 1.1, false);
      hand(v.fist, lx + W * 0.02 + oa * W * 0.12, ly - oa * H * 0.04 + cast * H * 0.3 - H * 0.02, H * 0.34);
    } else if (!v.two) {
      hand(v.fist, lx, ly + H * 0.1 - cast * H * 0.02, H * 0.36);
    }
    if (cast > 0) hand(v.fist, W * 0.3 + bx, H * (1.12 - cast * 0.3) + by, H * 0.38, fx.castColor);

    // right: the weapon in the fist, or the fist alone
    if (v.weapon) {
      // a pole is held low and upright, off to the side, so it never hides the corridor
      const gx = (v.pole ? W * 0.8 : v.two ? W * 0.74 : W * 0.84) + bx + jx + sx, gy = (v.two ? H * 1.04 : H * 1.03) + by + jy + sy;
      held(v.weapon, gx, gy, H * (v.pole ? 0.8 : v.two ? 0.92 : 0.78), (v.pole ? 0.95 : 0.66) + sa, true);
      hand(v.fist, gx + H * 0.02, gy - H * 0.03, H * 0.34);
      if (v.two) hand(v.fist, gx - H * 0.13, gy + H * 0.05, H * 0.32);
    } else {
      const punch = u >= 0 && u < 1 ? Math.sin(Math.min(1, u / 0.6) * Math.PI) : 0;
      hand(v.fist, W * 0.78 + bx + jx - punch * W * 0.18, H + by + jy + H * 0.1 - punch * H * 0.2, H * 0.36 * (1 + punch * 0.25));
    }
  }

  // ---------- spell effects ----------
  // Each spell draws its own effect between the hero's hand and what it
  // hits, instead of only tinting the view: darts that fly, a fan of fire,
  // a jagged bolt, a pillar of light. Particles are placed by a hash of their
  // index, not by chance, so a frame never flickers from randomness alone.
  const hash = n => { const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
  const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
  function glow(x, y, r, color, alpha) {
    if (alpha <= 0 || r <= 0) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${alpha.toFixed(3)})`);
    g.addColorStop(0.35, hexA(color, alpha * 0.9));
    g.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function hexA(hex, a) {
    const h = hex.length === 4 ? hex.slice(1).split('').map(c => c + c).join('') : hex.slice(1);
    const n = parseInt(h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
  }
  function drawSpells(fx, now, proj) {
    if (!fx.spells || !fx.spells.length) return;
    const hand = { x: W * 0.5, y: H * 0.95, r: H * 0.4 };
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const s of fx.spells) {
      if (now >= s.until || now < s.born) continue;
      const t = (now - s.born) / (s.until - s.born);
      const fade = 1 - t;
      const pts = s.pts.map(proj).filter(Boolean);
      const aim = pts.length ? pts[pts.length - 1] : (s.ahead ? proj(s.ahead) : null) || { x: W / 2, y: H * 0.55, r: H * 0.5 };
      const first = pts[0] || aim;
      const c = s.color;
      switch (s.style) {
        case 'missile': {
          // three darts, a beat apart, curving in from either side
          for (let i = 0; i < 3; i++) {
            const u = clamp01((t - i * 0.12) / 0.5);
            if (u <= 0) continue;
            if (u < 1) {
              for (let k = 0; k < 4; k++) {
                const v = Math.max(0, u - k * 0.05);
                const x = hand.x + (first.x - hand.x) * v + (i - 1) * W * 0.12 * Math.sin(Math.PI * v), y = hand.y + (first.y - hand.y) * v;
                glow(x, y, (10 - k * 2) * (1 - v * 0.3), c, 0.95 - k * 0.2);
              }
            } else {
              const b = clamp01((t - i * 0.12 - 0.5) / 0.25);
              glow(first.x + (i - 1) * 4, first.y, 6 + b * first.r * 0.25, c, 1 - b);
            }
          }
          break;
        }
        case 'hands': {
          // a fan of flame from the hand into the square ahead
          for (let i = 0; i < 26; i++) {
            const u = clamp01(t * 1.7 - hash(i) * 0.5);
            if (u <= 0 || u >= 1) continue;
            const spread = (hash(i + 31) - 0.5) * first.r * 0.9 * u;
            const x = hand.x + (first.x - hand.x) * u + spread, y = hand.y + (first.y - hand.y) * u - hash(i + 7) * first.r * 0.2 * u;
            glow(x, y, 4 + u * first.r * 0.12, u < 0.5 ? '#ffd040' : c, (1 - u) * 0.9);
          }
          break;
        }
        case 'pillar': {
          // a column of fire rising out of the floor where the foe stands
          glow(first.x, first.y + first.r * 0.3, first.r * 0.6, '#ff9040', fade * 0.9);
          for (let i = 0; i < 34; i++) {
            const u = (t * 1.6 + hash(i)) % 1;
            const x = first.x + (hash(i + 11) - 0.5) * first.r * 0.55, y = first.y + first.r * 0.35 - u * first.r * 1.4;
            glow(x, y, 5 + (1 - u) * first.r * 0.12, u < 0.35 ? '#fff0a0' : '#ff8030', Math.min(1, fade * 1.3) * (1 - u * 0.8));
          }
          break;
        }
        case 'fireball': {
          // an orb flies, then bursts
          const u = clamp01(t / 0.35);
          if (u < 1) glow(hand.x + (first.x - hand.x) * u, hand.y + (first.y - hand.y) * u, 8 + u * 6, c, 1);
          else {
            const b = clamp01((t - 0.35) / 0.65);
            for (const q of pts.length ? pts : [first]) {
              glow(q.x, q.y, q.r * (0.25 + b * 0.8), '#ff8030', (1 - b) * 0.9);
              glow(q.x, q.y, q.r * (0.1 + b * 0.35), '#ffe080', (1 - b));
            }
          }
          break;
        }
        case 'lightning': {
          // a jagged bolt to the furthest foe, forking to each one it passes
          const seed = Math.floor(now / 45);
          const bolt = (a, b, width, alpha, salt) => {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            const n = 9;
            for (let k = 1; k < n; k++) {
              const f = k / n;
              const j = (hash(seed * 31 + k * 7 + salt) - 0.5) * W * 0.09 * Math.sin(Math.PI * f);
              ctx.lineTo(a.x + (b.x - a.x) * f + j, a.y + (b.y - a.y) * f + j * 0.4);
            }
            ctx.lineTo(b.x, b.y);
            ctx.lineWidth = width * 3; ctx.strokeStyle = hexA(c, alpha * 0.35); ctx.stroke();
            ctx.lineWidth = width; ctx.strokeStyle = `rgba(255,255,240,${alpha.toFixed(3)})`; ctx.stroke();
          };
          const a = fade * (0.7 + 0.3 * hash(seed));
          bolt(hand, aim, 2.2, a, 0);
          pts.forEach((q, i) => { glow(q.x, q.y, q.r * 0.3, c, a); if (q !== aim) bolt({ x: q.x, y: q.y - q.r * 0.3 }, q, 1.2, a * 0.8, 50 + i); });
          break;
        }
        case 'cone': {
          // a widening cone of frost to the furthest foe it reaches
          const half = Math.max(aim.r * 0.9, W * 0.18);
          const g = ctx.createLinearGradient(hand.x, hand.y, aim.x, aim.y);
          g.addColorStop(0, hexA('#ffffff', fade * 0.55));
          g.addColorStop(1, hexA(c, fade * 0.25));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(hand.x - 6, hand.y); ctx.lineTo(aim.x - half, aim.y - aim.r * 0.3);
          ctx.lineTo(aim.x + half, aim.y + aim.r * 0.1); ctx.lineTo(hand.x + 6, hand.y);
          ctx.closePath(); ctx.fill();
          for (let i = 0; i < 24; i++) {
            const u = (t * 1.3 + hash(i)) % 1;
            const side = (hash(i + 5) - 0.5) * 2 * half * u;
            glow(hand.x + (aim.x - hand.x) * u + side, hand.y + (aim.y - hand.y) * u, 2 + u * 3, '#e8fbff', fade);
          }
          break;
        }
        case 'smite': {
          // a shaft of light straight down on the foe
          const bw = Math.max(8, first.r * 0.3) * (1 - t * 0.5);
          const g = ctx.createLinearGradient(first.x - bw, 0, first.x + bw, 0);
          g.addColorStop(0, hexA(c, 0)); g.addColorStop(0.5, `rgba(255,255,235,${(fade * 0.9).toFixed(3)})`); g.addColorStop(1, hexA(c, 0));
          ctx.fillStyle = g;
          ctx.fillRect(first.x - bw, 0, bw * 2, first.y + first.r * 0.35);
          glow(first.x, first.y + first.r * 0.3, first.r * 0.45, c, fade);
          break;
        }
        case 'heal': {
          // green sparks rising through the view
          for (let i = 0; i < 28; i++) {
            const u = clamp01(t * 1.2 - hash(i) * 0.3);
            if (u <= 0 || u >= 1) continue;
            const x = hash(i + 17) * W, y = H * (1.02 - u * (0.6 + hash(i + 3) * 0.4));
            glow(x, y, 3 + hash(i + 9) * 4, c, (1 - u) * 0.9);
          }
          break;
        }
        case 'buff': {
          // a ring of light spreading from the hero, and the edges of the view glowing
          const R = Math.max(W, H) * (0.1 + t * 0.7);
          ctx.lineWidth = 6 * fade + 1;
          ctx.strokeStyle = hexA(c, fade * 0.8);
          ctx.beginPath(); ctx.ellipse(W / 2, H * 0.62, R, R * 0.55, 0, 0, Math.PI * 2); ctx.stroke();
          const e = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.7);
          e.addColorStop(0, hexA(c, 0)); e.addColorStop(1, hexA(c, fade * 0.45));
          ctx.fillStyle = e; ctx.fillRect(0, 0, W, H);
          break;
        }
      }
    }
    ctx.restore();
  }
  function render(level, cam, sprites, fx, now) {
    const tex = Assets.themes[level.theme];
    const px = cam.x, py = cam.y;
    {
      const hx = px | 0, hy = py | 0;
      if (hx >= 0 && hy >= 0 && hx < level.w && hy < level.h) level.explored[hy * level.w + hx] = 1;
    }
    const dirX = Math.cos(cam.angle), dirY = Math.sin(cam.angle);
    const planeX = -dirY * TAN_HALF, planeY = dirX * TAN_HALF;
    const lm = ensureLights(level);
    castFloor(tex, px, py, dirX, dirY, planeX, planeY, level, lm);
    const w = level.w, h = level.h, tiles = level.tiles, explored = level.explored;
    const getT = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? T.WALL : tiles[y * w + x];

    for (let col = 0; col < W; col++) {
      const camX = 2 * col / W - 1;
      const rdx = dirX + planeX * camX, rdy = dirY + planeY * camX;
      let mapX = Math.floor(px), mapY = Math.floor(py);
      const ddx = rdx === 0 ? 1e30 : Math.abs(1 / rdx), ddy = rdy === 0 ? 1e30 : Math.abs(1 / rdy);
      let stepX, stepY, sdx, sdy;
      if (rdx < 0) { stepX = -1; sdx = (px - mapX) * ddx; } else { stepX = 1; sdx = (mapX + 1 - px) * ddx; }
      if (rdy < 0) { stepY = -1; sdy = (py - mapY) * ddy; } else { stepY = 1; sdy = (mapY + 1 - py) * ddy; }
      let side = 0, tile = T.WALL, n = 0;
      while (n++ < 64) {
        if (sdx < sdy) { sdx += ddx; mapX += stepX; side = 0; } else { sdy += ddy; mapY += stepY; side = 1; }
        tile = getT(mapX, mapY);
        if (mapX >= 0 && mapY >= 0 && mapX < w && mapY < h) explored[mapY * w + mapX] = 1;
        if (isSolid(tile)) break;
      }
      const dist = side === 0 ? (sdx - ddx) : (sdy - ddy);
      zbuf[col] = dist;
      if (dist > FOG + 1) continue;
      const lineH = Math.floor(P / dist);
      const top = ((H - lineH) / 2) | 0;
      let wallX = side === 0 ? py + dist * rdy : px + dist * rdx;
      wallX -= Math.floor(wallX);
      let tx = Math.floor(wallX * 64);
      if ((side === 0 && rdx > 0) || (side === 1 && rdy < 0)) tx = 63 - tx;
      let img = texFor(tex, tile, mapX, mapY);
      if (!img) {
        if (tile === T.FOUNTAIN) { const f = level.features && level.features[mapX + ',' + mapY]; img = (f && f.used) ? tex.fountainDry : tex.fountain; }
        else { const c = level.locks[mapX + ',' + mapY]; img = tex.locked[c] || tex.door; }
      }
      ctx.drawImage(img, tx, 0, 1, 64, col, top, 1, lineH);
      let shade = dist / FOG + (side === 1 ? 0.12 : 0);
      // torchlight falling on this wall face brightens it
      const lightHere = lm[mapY * w + mapX];
      if (lightHere > 0 || tile === T.TORCH) shade -= (tile === T.TORCH ? LIGHT_MAX : lightHere) / 7;
      if (shade > 0.03) {
        ctx.fillStyle = shadeStyles[Math.min(20, Math.round(shade * 20))];
        ctx.fillRect(col, top, 1, lineH);
      }
    }

    // sprites
    const invDet = 1 / (planeX * dirY - dirX * planeY);
    const list = [];
    for (const s of sprites) {
      const sx = s.x - px, sy = s.y - py;
      const tY = invDet * (-planeY * sx + planeX * sy);
      if (tY <= 0.15 || tY > FOG + 0.5) continue;
      const tX = invDet * (dirY * sx - dirX * sy);
      list.push({ s, tX, tY });
    }
    list.sort((a, b) => b.tY - a.tY);
    for (const { s, tX, tY } of list) {
      const screenX = (W / 2) * (1 + tX / tY);
      const hFull = P / tY;
      // a monster winding up a blow swells a little toward you as it draws back
      const size = hFull * s.scale * (1 + 0.07 * (s.tell || 0));
      // a monster's body squashes and stretches as it breathes, lunges and falls
      const sh = size * (s.sqy || 1), sw = size * (s.sqx || 1);
      const floorY = H / 2 + hFull / 2;
      const top = floorY - sh - (s.yOff || 0) * hFull;
      // where the drawing itself begins: bars and marks sit on it, not on the empty frame
      const drawnTop = top + (s.img.top || 0) * sh;
      const left = screenX - sw / 2;
      const x0 = Math.max(0, Math.floor(left)), x1 = Math.min(W, Math.ceil(left + sw));
      if (x1 <= x0) continue;
      let shadeIdx = Math.min(Assets.SHADES.length - 1, Math.floor(tY / FOG * Assets.SHADES.length));
      const sLm = (s.x | 0) >= 0 && (s.y | 0) >= 0 && (s.x | 0) < w && (s.y | 0) < h ? lm[(s.y | 0) * w + (s.x | 0)] : 0;
      if (sLm > 0) shadeIdx = Math.max(0, shadeIdx - Math.round(sLm / 7 * Assets.SHADES.length));
      const img = (s.flash && now < s.flash) ? s.img.flash : s.img.levels[shadeIdx];
      let run = -1;
      const fading = s.alpha != null && s.alpha < 1;
      if (fading) ctx.globalAlpha = Math.max(0, s.alpha);
      for (let x = x0; x <= x1; x++) {
        const vis = x < x1 && tY < zbuf[x];
        if (vis && run < 0) run = x;
        if (!vis && run >= 0) {
          const tw = img.width, th = img.height;   // sprites are not all one size
          const u0 = (run - left) / sw * tw, u1 = (x - left) / sw * tw;
          ctx.drawImage(img, u0, 0, Math.max(0.01, u1 - u0), th, run, top, x - run, sh);
          run = -1;
        }
      }
      if (fading) ctx.globalAlpha = 1;
      // an ogre up close is taller than the view: its bar stays inside it
      if (s.hp != null && s.hp < s.maxHp) {
        const bw = Math.max(10, Math.floor(sw * 0.5)), bx = Math.floor(screenX - bw / 2), by = Math.max(3, Math.floor(drawnTop) - 5);
        ctx.fillStyle = '#000';
        ctx.fillRect(bx - 1, by - 1, bw + 2, 4);
        ctx.fillStyle = '#5a1a1a';
        ctx.fillRect(bx, by, bw, 2);
        ctx.fillStyle = '#e04030';
        ctx.fillRect(bx, by, Math.max(1, Math.round(bw * s.hp / s.maxHp)), 2);
      }
      // a skeleton's heap of bones: a violet ring on the floor round it that
      // closes as it pulls itself together, a countdown rather than a warning
      if (s.heap) {
        const cx = Math.round(screenX), cy = Math.round(floorY - sh * 0.18);
        const rx = Math.max(6, sw * 0.46), ry = Math.max(3, sh * 0.16);
        ctx.save();
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 2; ctx.strokeStyle = s.heap > 0.75 ? '#ff40e0' : '#b060ff';
        ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * s.heap); ctx.stroke();
        ctx.restore();
      }
      // the tell: a bright mark over anything about to strike, filling as the
      // blow comes, so it can be seen and answered before it lands
      if (s.tell) {
        // a monster's own trick: a bigger violet mark, unlike any plain blow
        // half as big again as it was, and sat on the drawing, not its frame
        const size = Math.max(s.special ? 14 : 11, Math.min(s.special ? 30 : 24, Math.round(sw * (s.special ? 0.5 : 0.4))));
        const tx = Math.round(screenX), ty = Math.min(H - 4, Math.max(size + (s.hp != null && s.hp < s.maxHp ? 10 : 3), Math.floor(drawnTop) - (s.hp != null && s.hp < s.maxHp ? 9 : 4)));
        ctx.save();
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(tx, ty - size); ctx.lineTo(tx + size * 0.62, ty); ctx.lineTo(tx - size * 0.62, ty); ctx.closePath();
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.stroke();
        ctx.fillStyle = s.special ? (s.tell >= 1 ? '#ff40e0' : (s.tell > 0.5 ? '#d050ff' : '#a070ff'))
          : (s.tell >= 1 ? '#ff3020' : (s.tell > 0.5 ? '#ff7a20' : '#ffc030'));
        ctx.fill();
        ctx.fillStyle = '#1a0a08';
        ctx.fillRect(tx - 1, ty - size * 0.68, 2, size * 0.38);
        ctx.fillRect(tx - 1, ty - size * 0.2, 2, 2);
        ctx.restore();
      }
    }

    // floating texts
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    for (const t of fx.texts) {
      const sx = t.x - px, sy = t.y - py;
      const tY = invDet * (-planeY * sx + planeX * sy);
      if (tY <= 0.15) continue;
      const tX = invDet * (dirY * sx - dirX * sy);
      const screenX = (W / 2) * (1 + tX / tY);
      const hFull = P / tY;
      const age = (now - t.born) / (t.until - t.born);
      // rise from the monster's middle, not the ceiling: close up, the old
      // spot was the top edge of the view, dark and easy to miss
      const y = Math.max(18, Math.min(H - 10, H / 2 + hFull * 0.05 - age * 22));
      ctx.globalAlpha = Math.max(0, Math.min(1, 1.6 - age * 1.6));
      // a full dark outline, so pale words like "miss" read on a pale ceiling
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.9)';
      ctx.strokeText(t.text, screenX, y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, screenX, y);
      ctx.globalAlpha = 1;
    }

    // spells, drawn over the world where they land
    drawSpells(fx, now, pt => {
      const sx = pt.x - px, sy = pt.y - py;
      const tY = invDet * (-planeY * sx + planeX * sy);
      if (tY <= 0.2) return null;
      const tX = invDet * (dirY * sx - dirX * sy);
      const hFull = P / tY;
      return { x: (W / 2) * (1 + tX / tY), y: H / 2 + hFull * 0.08, r: hFull };
    });

    // effects
    // the hero's hands, over the world and under the flashes
    drawView(fx, now);
    if (now < fx.castUntil) {
      const a = (fx.castUntil - now) / 260;
      ctx.fillStyle = fx.castColor;
      ctx.globalAlpha = a * 0.18;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    // near death, the edges of the view pulse red: the heartbeat is no help
    // to someone playing with the sound off, which on a phone is most people
    if (fx.hpFrac > 0 && fx.hpFrac < 0.25) {
      const beat = 0.5 + 0.5 * Math.sin(now / (fx.hpFrac < 0.12 ? 140 : 220));
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.62);
      g.addColorStop(0, 'rgba(160,0,0,0)');
      g.addColorStop(1, `rgba(190,0,0,${(0.35 + 0.3 * beat).toFixed(2)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    if (now < fx.damageUntil) {
      const a = (fx.damageUntil - now) / 260;
      ctx.fillStyle = 'rgba(200,0,0,1)';
      ctx.globalAlpha = a * 0.5;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    // Which edge the blow came from. The view only shows what is ahead, so
    // without this an attacker behind you is invisible and unexplained.
    if (fx.hurtFrom >= 0 && now < fx.hurtFromUntil) {
      const a = Math.min(1, (fx.hurtFromUntil - now) / 900);
      const band = 16;
      const grads = [
        [0, 0, 0, band, 0, band],                 // ahead: down from the top
        [W, 0, W - band, 0, band, H],             // right
        [0, H, 0, H - band, W, band],             // behind: up from the bottom
        [0, 0, band, 0, band, H],                 // left
      ];
      const [gx0, gy0, gx1, gy1, bw, bh] = grads[fx.hurtFrom];
      const g = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
      g.addColorStop(0, `rgba(255,60,50,${(a * 0.85).toFixed(2)})`);
      g.addColorStop(1, 'rgba(255,60,50,0)');
      ctx.fillStyle = g;
      if (fx.hurtFrom === 0) ctx.fillRect(0, 0, W, bh);
      else if (fx.hurtFrom === 2) ctx.fillRect(0, H - bh, W, bh);
      else if (fx.hurtFrom === 1) ctx.fillRect(W - bw, 0, bw, H);
      else ctx.fillRect(0, 0, bw, H);
    }
    // A chevron on the edge nearest anything that can reach you from out of
    // sight: pulsing when it is beside you, steady when it is a step away.
    if (fx.threats && fx.threats.length) {
      const drawn = new Set();
      for (const t of fx.threats) {
        if (drawn.has(t.rel)) continue;        // one per side; nearest wins, it is sorted first
        drawn.add(t.rel);
        // big and bright enough to catch the corner of the eye mid-fight
        const a = t.tell ? 0.85 + 0.15 * Math.sin(now / 45) : (t.near ? 0.75 + 0.25 * Math.sin(now / 110) : 0.6);
        const s = t.tell ? 17 : (t.near ? 14 : 11);
        let cx, cy, ang;
        if (t.rel === 1) { cx = W - 14; cy = H / 2; ang = 0; }
        else if (t.rel === 3) { cx = 14; cy = H / 2; ang = Math.PI; }
        else { cx = W / 2; cy = H - 14; ang = Math.PI / 2; }
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(ang);
        ctx.globalAlpha = a;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-s * 0.6, -s); ctx.lineTo(s * 0.5, 0); ctx.lineTo(-s * 0.6, s);
        ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.stroke();
        ctx.lineWidth = 4.5; ctx.strokeStyle = '#ff4030'; ctx.stroke();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
    if (now < fx.healUntil) {
      const a = (fx.healUntil - now) / 260;
      ctx.fillStyle = 'rgba(80,220,120,1)';
      ctx.globalAlpha = a * 0.35;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }

  return { init, render, setHeight, W, H_MIN, H_MAX, FOG, get H() { return H; } };
})();

export { Renderer };
