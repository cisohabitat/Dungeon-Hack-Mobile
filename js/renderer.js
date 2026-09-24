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
        const tx = ((fx * TX) | 0) & (TX - 1), ty = ((fy * TX) | 0) & (TX - 1);
        let lv = level;
        if (mx >= 0 && my >= 0 && mx < lw && my < lh) {
          const boost = lm[my * lw + mx];
          // rounded to a shade level, with a pattern fixed to the texture
          // deciding the texels of a tile that sits between two
          if (boost > 0) lv = Math.max(0, level - ((boost + DITHER[((ty & 3) << 2) | (tx & 3)]) | 0));
        }
        if (lv >= 7) { fb32[o + x] = 0xff000000; fb32[oc + x] = 0xff000000; fx += stepX; fy += stepY; continue; }
        const src = lv === level ? fl : floorT[lv];
        const csrc = lv === level ? ce : ceilT[lv];
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

  // A per-tile brightness field from the level's torches, built once per
  // level, and again whenever its list of lights is replaced: the lich puts
  // its torches out, and they catch again when it falls. Each lit tile also
  // remembers which torch lights it most, so the field can flicker torch by
  // torch: `live` is the field as it stands this frame.
  function ensureLights(level) {
    const key = level.lights || level;
    const cached = lightCache.get(key);
    if (cached) return cached;
    const lm = new Float32Array(level.w * level.h);
    const src = new Int16Array(level.w * level.h).fill(-1);
    const lights = level.lights || [];
    lights.forEach((l, k) => {
      const r = Math.ceil(LIGHT_R);
      for (let y = Math.max(0, l.y - r); y <= Math.min(level.h - 1, l.y + r); y++) {
        for (let x = Math.max(0, l.x - r); x <= Math.min(level.w - 1, l.x + r); x++) {
          const dist = Math.hypot(x - l.x, y - l.y);
          if (dist > LIGHT_R) continue;
          const v = LIGHT_MAX * (1 - dist / LIGHT_R) * (1 - dist / LIGHT_R);
          const i = y * level.w + x;
          if (v > lm[i]) { lm[i] = v; src[i] = k; }
        }
      }
    });
    const lit = [];
    for (let i = 0; i < lm.length; i++) if (lm[i] > 0) lit.push(i);
    // each torch's own rhythm, fixed by where it hangs so it never changes
    const phase = new Float32Array(lights.length), rate = new Float32Array(lights.length);
    lights.forEach((l, k) => {
      phase[k] = ((l.x * 73 + l.y * 151) % 97) / 97 * Math.PI * 2;
      rate[k] = 0.85 + ((l.x * 37 + l.y * 17) % 31) / 31 * 0.3;
    });
    const L = { lm, src, lit: Int32Array.from(lit), live: lm.slice(), gain: new Float32Array(lights.length).fill(1), phase, rate, at: -1 };
    lightCache.set(key, L);
    return L;
  }

  // This frame's torchlight. Each torch breathes on its own slow rhythm, three
  // sines of unrelated speeds so it never visibly repeats, swinging its light
  // by up to a fifth either way, and every tile it lights follows it. Only lit
  // tiles are touched, once a frame; the floor, walls and sprites all read the
  // result, so they rise and fall together.
  function flickerLights(L, now) {
    if (L.at === now) return L.live;
    L.at = now;
    const t = now / 1000, { gain, phase, rate, lm, live, lit, src } = L;
    for (let k = 0; k < gain.length; k++) {
      const p = phase[k], r = rate[k];
      gain[k] = 1 + 0.09 * Math.sin(t * 2.1 * r + p) + 0.06 * Math.sin(t * 5.3 * r + p * 1.7) + 0.035 * Math.sin(t * 11.3 + p * 2.3);
    }
    for (let j = 0; j < lit.length; j++) { const i = lit[j]; live[i] = lm[i] * gain[src[i]]; }
    return live;
  }
  // A 4x4 ordered-dither threshold per texel, squeezed round a half: a tile
  // well inside a shade level is solid, as plain rounding left it, and only
  // one close to the edge between two levels mixes them, so it fades across
  // as its torch flickers instead of jumping.
  const DITHER = new Float32Array([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => 0.35 + 0.3 * (v + 0.5) / 16));

  // Which plain walls wear one of the theme's decorations: a hash of the tile,
  // so the choice never changes and costs nothing to store. About one wall in
  // twelve; the rest stay plain, so a decoration is something to notice.
  function decorAt(x, y) {
    let h = Math.imul(x, 73856093) ^ Math.imul(y, 19349663);
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
    return (h ^ (h >>> 15)) >>> 0;
  }
  // the flame's frames in an uneven order, so it never visibly cycles
  const FLAME_SEQ = [0, 1, 0, 2, 1, 2, 0, 2, 1];
  const FLAME_MS = 140;
  let flameTick = 0;

  function texFor(tex, tile, x, y) {
    switch (tile) {
      case T.DOOR: return tex.door;
      case T.DOOR_LOCKED: return null; // resolved by caller using locks
      case T.STAIRS_DOWN: return tex.stairsDown;
      case T.STAIRS_UP: return tex.stairsUp;
      case T.FOUNTAIN: return null;
      // each torch starts at its own place in the sequence
      case T.TORCH: return tex.torchFrames[FLAME_SEQ[(flameTick + x * 5 + y * 3) % FLAME_SEQ.length]];
      default: {
        if ((x * 7 + y * 13) % 6 === 0) return tex.wallCracked;
        const h = decorAt(x, y);
        return h % 12 === 0 && tex.decor.length ? tex.decor[(h >>> 8) % tex.decor.length] : tex.wall;
      }
    }
  }

  // sprites: [{x, y, img (sprite asset), scale, yOff, flash}]
  // ---------- the hero's hands ----------
  // What the hero holds, drawn at the bottom of the view: the weapon's own
  // picture in a gloved fist at the right, a shield or second blade at the
  // left. It sways at rest, bobs with each step, slashes across on Attack,
  // jolts when a blow lands, and the other hand rises glowing to cast.
  const ease = u => (u < 0 ? 0 : u > 1 ? 1 : u * u * (3 - 2 * u));
  const lerp = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  // art pixels to view pixels: the hands are the nearest thing in sight, so
  // they are painted finer than anything in the world, but not drawn smaller
  const artK = () => H / 122;
  /** Draw a painted frame with its hand (or centre) at view point (x, y). */
  function put(fr, x, y) {
    if (!fr) return;
    const k = artK();
    ctx.drawImage(fr.img, Math.round(x - fr.ax * k), Math.round(y - fr.ay * k), Math.round(fr.img.width * k), Math.round(fr.img.height * k));
  }
  // where the hand is in each pose, as a fraction of the view
  const POSE_AT = {
    rest: [0.75, 0.8], windup: [0.78, 0.6], cut: [0.58, 0.74], through: [0.44, 0.9],
    fist: [0.76, 0.86], punch: [0.58, 0.72], left: [0.24, 0.84], cast: [0.3, 0.86], shield: [0.22, 0.84], bow: [0.44, 0.68],
  };
  const at = (pose, lift = 0) => [POSE_AT[pose][0] * W, (POSE_AT[pose][1] - lift) * H];
  function drawView(fx, now) {
    const v = fx.view;
    if (!v) return;
    // a step's bob and a slow sway at rest
    const step = Math.sin((v.walk || 0) * Math.PI);
    const bx = Math.sin(now / 900) * 1.5 + (v.steps % 2 ? 1 : -1) * step * 3, by = Math.abs(step) * 7 + Math.sin(now / 700) * 1.2;
    // a blow landing jolts the hands down
    const hurt = now < fx.damageUntil ? (fx.damageUntil - now) / 260 : 0;
    const jx = hurt ? Math.sin(now / 17) * 4 * hurt : 0, jy = hurt * 9;
    const dx = bx + jx, dy = by + jy;
    const u = (now - fx.swingAt) / (fx.swingMs || 300);
    const swinging = u >= 0 && u < 1;
    const ou = (now - fx.offAt) / 260;
    const jab = ou >= 0 && ou < 1 ? Math.sin(ou * Math.PI) : 0;
    // casting: the off hand rises into view, alight, and what it held dips
    const cu = (now - fx.castAt) / 520;
    const cast = cu >= 0 && cu < 1 ? Math.sin(cu * Math.PI) : 0;

    // left: a shield carried low, or a second blade
    if (v.weapon && v.drawn) {
      // a bow: held out in the left hand, the right on the string; an attack
      // draws the string back to the cheek and looses it
      const [x, y] = at('bow'), fr = Assets.held(v.weapon, 'rest', v.cls, false);
      const pull = swinging && u < 0.7 ? ease(u / 0.5) : 0, loosed = swinging && u >= 0.7;
      const hx = x + dx + W * 0.11 + pull * W * 0.12, hy = y + dy + H * 0.11 + pull * H * 0.06;
      put(fr, x + dx, y + dy);
      if (fr) {
        const k = artK(), ox = Math.round(x + dx - fr.ax * k), oy = Math.round(y + dy - fr.ay * k);
        const tip = m => [ox + fr.at[m][0] * k, oy + fr.at[m][1] * k];
        const [tx, ty] = tip('top'), [bx2, by2] = tip('bot');
        // the string hangs straight until the fingers draw it back
        const [nx, ny] = pull > 0.04 ? [hx, hy - H * 0.02] : [(tx + bx2) / 2, (ty + by2) / 2];
        ctx.lineCap = 'round';
        for (const [c, w] of [['#0a0810', 3], ['#e8e0cc', 1]]) {
          ctx.strokeStyle = c; ctx.lineWidth = w;
          ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(nx, ny); ctx.lineTo(bx2, by2); ctx.stroke();
        }
        if (!loosed) {
          // the arrow, nocked, foreshortened toward what it is aimed at
          const ax = W * 0.5, ay = H * 0.4, len = 0.55;
          const ex = nx + (ax - nx) * len, ey = ny + (ay - ny) * len;
          for (const [c, w] of [['#0a0810', 4], ['#b08858', 2]]) {
            ctx.strokeStyle = c; ctx.lineWidth = w;
            ctx.beginPath(); ctx.moveTo(nx, ny); ctx.lineTo(ex, ey); ctx.stroke();
          }
          ctx.fillStyle = '#d8dce4'; ctx.beginPath(); ctx.arc(ex, ey, 2, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#e04838'; ctx.fillRect(nx - 3, ny - 6, 6, 4);
        }
      }
      put(Assets.held(null, 'fist', v.cls, false), hx, hy);
    } else if (v.shield) {
      const [x, y] = at('shield');
      put(Assets.carried(v.shield, v.cls), x + dx - hurt * 4, y + dy + cast * H * 0.4 + hurt * 6);
    } else if (v.offhand) {
      const [x, y] = at('left');
      put(Assets.held(v.offhand, 'left', v.cls, false), x + dx + jab * W * 0.14, y + dy - jab * H * 0.1 + cast * H * 0.4);
    }
    if (cast > 0) {
      const [x, y] = at('cast'), cy = y + (1 - cast) * H * 0.35 + by;
      const g = ctx.createRadialGradient(x + bx, cy - H * 0.08, 0, x + bx, cy - H * 0.08, H * 0.2);
      g.addColorStop(0, (fx.castColor || '#fff').replace(/^#(.)(.)(.)$/, '#$1$1$2$2$3$3') + 'cc'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(x + bx - H * 0.2, cy - H * 0.28, H * 0.4, H * 0.4);
      put(Assets.held(null, 'cast', v.cls, false), x + bx, cy);
    }

    // right: the weapon, through the poses of a swing, or a bare fist
    if (v.weapon && v.drawn) {
      // drawn above, with the left hand
    } else if (v.weapon) {
      // a two-handed grip sits higher so the lower hand shows; a sling hangs from the hand
      const lift = v.two ? 0.1 : /sling$/.test(v.weapon) ? 0.22 : 0;
      let pose = 'rest', p = at('rest', lift);
      if (swinging) {
        if (u < 0.16) { pose = 'windup'; p = lerp(at('rest', lift), at('windup', lift), ease(u / 0.16)); }
        else if (u < 0.32) { pose = 'cut'; p = lerp(at('windup', lift), at('cut', lift), ease((u - 0.16) / 0.16)); }
        else if (u < 0.52) { pose = 'through'; p = lerp(at('cut', lift), at('through', lift), ease((u - 0.32) / 0.2)); }
        else p = [p[0], p[1] + (1 - ease((u - 0.52) / 0.48)) * H * 0.5];
      }
      // the lower hand of a two-handed grip is the one that casts
      put(Assets.held(v.weapon, pose, v.cls, v.two && !cast), p[0] + dx, p[1] + dy);
    } else {
      const punch = swinging && u < 0.55;
      const p = punch ? lerp(at('fist'), at('punch'), Math.sin(u / 0.55 * Math.PI)) : at('fist');
      put(Assets.held(null, punch && u > 0.12 && u < 0.43 ? 'punch' : 'fist', v.cls, false), p[0] + dx, p[1] + dy);
    }
  }

  /** The lich's life along the top of the view, marked where its fight turns. */
  function drawBossBar(b, now) {
    if (!b) return;
    const bw = Math.round(W * 0.62), bx = Math.round((W - bw) / 2), by = 16, bh = 5;
    ctx.save();
    ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.9)';
    ctx.strokeText(b.name.toUpperCase(), W / 2, by - 4);
    ctx.fillStyle = b.rite ? (Math.sin(now / 90) > 0 ? '#ff80ff' : '#c080ff') : '#d8c8ff';
    ctx.fillText(b.name.toUpperCase(), W / 2, by - 4);
    ctx.fillStyle = '#000'; ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
    ctx.fillStyle = '#2a1030'; ctx.fillRect(bx, by, bw, bh);
    const f = Math.max(0, b.hp / b.maxHp);
    ctx.fillStyle = b.phase >= 2 ? '#c02040' : b.phase === 1 ? '#a03cc0' : '#7a5ad8';
    ctx.fillRect(bx, by, Math.round(bw * f), bh);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(bx, by, Math.round(bw * f), 1);
    // notches where its fight turns
    ctx.fillStyle = '#000';
    for (const n of [1 / 3, 2 / 3]) ctx.fillRect(bx + Math.round(bw * n), by, 1, bh);
    ctx.restore();
  }

  // ---------- what a fight leaves ----------
  const rgbOf = hex => {
    const h = hex.length === 4 ? hex.slice(1).split('').map(c => c + c).join('') : hex.slice(1);
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const dim = (hex, f, a = 1) => { const [r, g, b] = rgbOf(hex); return `rgba(${Math.round(r * f)},${Math.round(g * f)},${Math.round(b * f)},${a.toFixed(3)})`; };
  /** A floor stain: a pool and a few splashes round it, laid flat in perspective and darkened like the floor under it. */
  function drawStains(list, level, px, py, dirX, dirY, planeX, planeY, lm) {
    if (!list || !list.length) return;
    const invDet = 1 / (planeX * dirY - dirX * planeY);
    const lx = W / 2 / TAN_HALF;
    const blob = (x, y, r, c) => {
      const sx = x - px, sy = y - py;
      const tY = invDet * (-planeY * sx + planeX * sy);
      if (tY < 0.35 || tY > FOG) return;
      const tX = invDet * (dirY * sx - dirX * sy);
      const cx = (W / 2) * (1 + tX / tY), cy = H / 2 + (P / 2) / tY;
      const rx = r * lx / tY, ry = r * (P / 2) / (tY * tY);
      if (cx + rx < 0 || cx - rx > W || ry < 0.3) return;
      const tx = x | 0, ty = y | 0;
      const lit = tx >= 0 && ty >= 0 && tx < level.w && ty < level.h ? lm[ty * level.w + tx] : 0;
      const f = Math.max(0.1, Math.min(1, 1 - tY / FOG + lit / 7));
      ctx.fillStyle = dim(c, f * 0.8, 0.7);
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, Math.min(ry, rx), 0, 0, Math.PI * 2); ctx.fill();
    };
    for (const st of list) {
      blob(st.x, st.y, st.r, st.c);
      for (let i = 0; i < 4; i++) {
        const a = hash(st.seed + i) * Math.PI * 2, d = st.r * (0.9 + hash(st.seed + i + 9) * 0.9);
        blob(st.x + Math.cos(a) * d, st.y + Math.sin(a) * d, st.r * (0.18 + hash(st.seed + i + 5) * 0.2), st.c);
      }
    }
  }
  /** Droplets, bone chips and sparks in flight, falling under their own weight; each is hidden behind walls nearer than it. */
  function drawBits(fx, now, px, py, dirX, dirY, planeX, planeY, invDet) {
    if (!fx.bits || !fx.bits.length) return;
    for (const b of fx.bits) {
      const age = now - b.born;
      if (age < 0 || age >= b.life) continue;
      let t = age / 1000;
      // what falls stops where it meets the floor
      if (b.g > 0) { const land = (b.vz + Math.sqrt(b.vz * b.vz + 2 * b.g * b.z)) / b.g; if (t > land) t = land; }
      const x = b.x + b.vx * t * 0.6, y = b.y + b.vy * t * 0.6, z = Math.max(0, b.z + b.vz * t - b.g * t * t / 2);
      const sx = x - px, sy = y - py;
      const tY = invDet * (-planeY * sx + planeX * sy);
      if (tY <= 0.2 || tY > FOG) continue;
      const tX = invDet * (dirY * sx - dirX * sy);
      const cx = Math.round((W / 2) * (1 + tX / tY));
      if (cx < 0 || cx >= W || tY >= zbuf[cx]) continue;
      const hFull = P / tY, cy = Math.round(H / 2 + hFull / 2 - z * hFull);
      const size = Math.max(1, Math.round(b.size * hFull));
      const u = age / b.life;
      ctx.globalAlpha = Math.max(0, 1 - u * u);
      if (b.glow) ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = b.c;
      ctx.fillRect(cx - (size >> 1), cy - (size >> 1), size, size);
      if (b.glow) ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
  }
  /** Blood on the view after a hard blow: a splash at the edge, flecks flung
   * round it, a thin run down from it; it all fades. Pixel squares, like the rest. */
  function drawDrops(drops, now) {
    if (!drops || !drops.length) return;
    for (let i = 0; i < drops.length; i++) {
      const d = drops[i];
      const u = (now - d.born) / d.life;
      if (u < 0 || u >= 1) continue;
      const x = Math.round(d.x * W), y = Math.round(d.y * H), r = Math.max(2, Math.round(d.r * H));
      const run = Math.round(Math.min(1, u * 1.4) * r * 3);
      ctx.globalAlpha = u < 0.6 ? 0.8 : 0.8 * (1 - (u - 0.6) / 0.4);
      ctx.fillStyle = '#5a0306';
      ctx.fillRect(x - r, y - (r >> 1), r * 2, r);
      ctx.fillRect(x - (r >> 1), y - r, r, r * 2);
      ctx.fillRect(x - 1, y, 2, r + run);
      for (let k = 0; k < 5; k++) {
        const a = hash(d.born + k) * Math.PI * 2, dd = r * (1.4 + hash(d.born + k + 7) * 1.6);
        ctx.fillRect(Math.round(x + Math.cos(a) * dd), Math.round(y + Math.sin(a) * dd), 2, 2);
      }
      ctx.fillStyle = '#9a1418';
      ctx.fillRect(x - (r >> 1), y - (r >> 1), Math.max(1, r >> 1), Math.max(1, r >> 1));
    }
    ctx.globalAlpha = 1;
  }
  /** An edge glow in one colour, strongest at the rim, for what ails or aids the hero. */
  function rim(r, g, b, a, inner = 0.34) {
    const grad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * inner, W / 2, H / 2, Math.max(W, H) * 0.66);
    grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},${a.toFixed(3)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }
  // A web across the corners, and frost that creeps in from them: fixed
  // strands, placed by hash so they hold still from frame to frame.
  function corners(color, width, n, reach, jag) {
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
    for (const [cx, cy, sx, sy] of [[0, 0, 1, 1], [W, 0, -1, 1], [0, H, 1, -1], [W, H, -1, -1]]) {
      for (let i = 0; i < n; i++) {
        const a = (i + 0.5) / n * Math.PI / 2, len = reach * (0.6 + hash(i * 7 + cx + cy) * 0.5);
        ctx.beginPath(); ctx.moveTo(cx, cy);
        let x = cx, y = cy;
        for (let k = 1; k <= 4; k++) {
          const j = jag ? (hash(i * 13 + k + cx) - 0.5) * jag : 0;
          x = cx + sx * Math.cos(a + j) * len * k / 4; y = cy + sy * Math.sin(a + j) * len * k / 4;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      if (!jag) {
        // the web's rings, strung between its spokes
        for (let ring = 1; ring <= 3; ring++) {
          ctx.beginPath();
          for (let i = 0; i < n; i++) {
            const a = (i + 0.5) / n * Math.PI / 2, rr = reach * ring / 4 * (0.8 + hash(i + ring * 3) * 0.2);
            const x = cx + sx * Math.cos(a) * rr, y = cy + sy * Math.sin(a) * rr;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }
  function drawStatus(st, now) {
    if (!st) return;
    const slow = 0.5 + 0.5 * Math.sin(now / 600);
    if (st.poison) rim(70, 170, 40, 0.22 + 0.14 * slow);
    if (st.starving) rim(20, 14, 10, 0.4, 0.3);
    if (st.grabbed) rim(70, 50, 30, 0.35);
    if (st.might) rim(230, 110, 40, 0.14 + 0.06 * slow, 0.42);
    if (st.ac) {
      // a thin shimmer running round the rim of the shield
      rim(90, 150, 255, 0.2 + 0.08 * Math.sin(now / 250), 0.4);
    }
    if (st.hit) {
      // motes of gold rising up the sides
      rim(255, 210, 90, 0.1, 0.44);
      ctx.fillStyle = '#ffe89a';
      for (let i = 0; i < 14; i++) {
        const side = i % 2, speed = 0.25 + hash(i) * 0.2, phase = (now / 1000 * speed + hash(i + 20)) % 1;
        const x = side ? W - 6 - hash(i + 3) * 26 : 6 + hash(i + 3) * 26, y = H * (1 - phase);
        ctx.globalAlpha = Math.sin(phase * Math.PI) * 0.9;
        ctx.fillRect(Math.round(x), Math.round(y), 3, 3);
      }
      ctx.globalAlpha = 1;
    }
    if (st.held) {
      rim(170, 220, 255, 0.35, 0.3);
      corners('rgba(220,240,255,0.55)', 1, 5, Math.min(W, H) * 0.3, 0.5);
    }
    if (st.webbed) corners('rgba(220,220,210,0.5)', 1, 5, Math.min(W, H) * 0.34, 0);
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
    const lights = ensureLights(level);
    const lm = flickerLights(lights, now);
    flameTick = Math.floor(now / FLAME_MS);
    castFloor(tex, px, py, dirX, dirY, planeX, planeY, level, lm);
    // stains lie on the floor, so the walls drawn next hide them where they should
    drawStains(fx.stains && fx.stains[level.depth], level, px, py, dirX, dirY, planeX, planeY, lm);
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
      // torchlight falling on this wall face brightens it; a torch's own wall
      // is lit fully, rising and falling with its flame
      const lightHere = lm[mapY * w + mapX];
      if (tile === T.TORCH) { const k = lights.src[mapY * w + mapX]; shade -= LIGHT_MAX * (k >= 0 ? lights.gain[k] : 1) / 7; }
      else if (lightHere > 0) shade -= lightHere / 7;
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

    drawBits(fx, now, px, py, dirX, dirY, planeX, planeY, invDet);

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
    // the hero's hands, over the world and under the flashes; once the Heart
    // is lifted they put down what they held and take it up instead
    if (!(fx.heartAt >= 0)) drawView(fx, now);
    drawBossBar(fx.boss, now);
    if (now < fx.castUntil) {
      const a = (fx.castUntil - now) / 260;
      ctx.fillStyle = fx.castColor;
      ctx.globalAlpha = a * 0.18;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    drawStatus(fx.status, now);
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
      ctx.globalAlpha = a * (fx.hurtAmt || 0.5);
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    drawDrops(fx.drops, now);
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
    if (fx.heartAt >= 0 && now >= fx.heartAt) drawFinale(now - fx.heartAt, fx.view && fx.view.cls);
  }
  /** The Heart lifted: it rises in the hero's hands and its light swells from
   * it, motes streaming up, until the light is all there is. */
  function drawFinale(t, cls) {
    const u = Math.min(1, t / 2400), e = ease(u);
    const cx = W / 2, cy = H * (0.95 - 0.4 * e);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const r = Math.max(W, H) * (0.18 + 1.2 * u * u);
    const g = ctx.createRadialGradient(cx, cy - H * 0.05, 0, cx, cy - H * 0.05, r);
    g.addColorStop(0, `rgba(255,244,215,${(0.5 + 0.4 * u).toFixed(3)})`);
    g.addColorStop(0.35, `rgba(255,190,110,${(0.2 + 0.5 * u).toFixed(3)})`);
    g.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // motes streaming up out of it, faster as the light grows
    ctx.fillStyle = '#fff0c0';
    for (let i = 0; i < 40; i++) {
      const sp = 0.35 + hash(i) * 0.6, ph = (t / 1000 * sp * (1 + u) + hash(i + 50)) % 1;
      const x = cx + (hash(i + 7) - 0.5) * W * (0.3 + ph * 0.9), y = cy - ph * H * 1.1;
      ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.9;
      ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
    }
    ctx.restore();
    // two open hands raise it, over its own light so they stay seen: the
    // casting hand, and the same turned about
    const palm = cls ? Assets.held(null, 'cast', cls, false) : null;
    if (palm) {
      const k = artK(), w = palm.img.width * k, h = palm.img.height * k;
      const hy = Math.round(cy + H * 0.2 - palm.ay * k);
      ctx.drawImage(palm.img, Math.round(cx - W * 0.1 - palm.ax * k), hy, Math.round(w), Math.round(h));
      ctx.save(); ctx.translate(Math.round(cx + W * 0.1), 0); ctx.scale(-1, 1);
      ctx.drawImage(palm.img, Math.round(-palm.ax * k), hy, Math.round(w), Math.round(h));
      ctx.restore();
    }
    const art = Assets.sprites.artifact;
    if (art) {
      const size = H * (0.3 + 0.12 * e);
      ctx.drawImage(art.levels[0], Math.round(cx - size / 2), Math.round(cy - size * 0.6), Math.round(size), Math.round(size));
    }
    // and at the last it is all light
    if (u > 0.62) {
      ctx.fillStyle = `rgba(255,246,226,${Math.min(1, (u - 0.62) / 0.33).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }


  return { init, render, setHeight, W, H_MIN, H_MAX, FOG, get H() { return H; } };
})();

export { Renderer };
