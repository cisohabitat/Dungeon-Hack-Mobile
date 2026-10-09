// What a few walls in each theme wear: moss, roots, seeping damp, a skull in the
// mortar, an iron ring, a niche. Each is painted over a copy of the theme's plain
// wall (see makeTheme in assets.js, which borrows what it needs through K).
import { Rng } from './rng.js';

/** @param {any} K */
export function makeWallDecor(K) {
  const TEX = K.TEX;
  const adjust = (/** @type {any[]} */ ...a) => K.adjust(...a);
  const canvas = (/** @type {any[]} */ ...a) => K.canvas(...a);
  const hexToRgb = (/** @type {any[]} */ ...a) => K.hexToRgb(...a);

  // ---- wall decorations ----
  // A few walls in each theme wear something: moss, a skull in the mortar, an
  // iron ring. Each is painted over a copy of the theme's plain wall, so its
  // bricks match the walls beside it. The brick layout is the same in every
  // theme (see makeWall), so a decoration can ask where the mortar is and grow
  // along it, or sit neatly in the place of a brick.
  const isMortar = (x, y) => {
    const r = y & 7;
    if (r === 0 || r === 7) return true;
    const bx = (x + ((y >> 3) & 1 ? 8 : 0)) & 15;
    return bx === 0 || bx === 15;
  };
  const IRON = { o: '#121216', s: '#2c2e36', m: '#50545e', h: '#8e949e' };
  const BONE = { h: '#e8dec4', m: '#bdb08c', s: '#837456', d: '#1a120c' };
  const ROOT = { h: '#86643e', m: '#5c4028', s: '#3a2616' };
  const VIOLET = { h: '#e4d8ff', m: '#b090f0', s: '#6a4cb0' };
  const SKULL = ['.hhmmm.', 'hhmmmms', 'hddmdds', 'mddmdds', '.mmdms.', '.s.s.s.'];
  const LONG_BONE = ['hm........mh', '.hmmmmmmmms.', 'ms........sm'];
  /** Paint a small grid of pixels: '.' is left alone, other characters index the palette. */
  function stamp(ctx, rows, pal, x, y) {
    for (let j = 0; j < rows.length; j++) {
      for (let i = 0; i < rows[j].length; i++) {
        const c = pal[rows[j][i]];
        if (!c) continue;
        ctx.fillStyle = c;
        ctx.fillRect(x + i, y + j, 1, 1);
      }
    }
  }
  function px(ctx, color, x, y, w = 1, h = 1) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }
  /** A one-pixel line, stepped the way pixel art draws them rather than smoothed. */
  function line(ctx, color, x0, y0, x1, y1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    ctx.fillStyle = color;
    for (let i = 0; i <= n; i++) ctx.fillRect(Math.round(x0 + (x1 - x0) * i / (n || 1)), Math.round(y0 + (y1 - y0) * i / (n || 1)), 1, 1);
  }
  // An iron ring, lit from the upper left like the bricks.
  function ring(ctx, cx, cy, r, thick = 1) {
    for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) {
      for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
        if (Math.abs(d - r) > thick * 0.55) continue;
        const lit = -(dx + dy) / (d * 1.414);
        px(ctx, lit > 0.4 ? IRON.h : lit > -0.4 ? IRON.m : IRON.s, x, y);
      }
    }
  }
  // A hanging chain: links alternate face-on and edge-on, as real ones do.
  function chain(ctx, x, y0, y1) {
    for (let y = y0; y < y1; y += 6) {
      stamp(ctx, ['.h.', 'h.s', 'h.s', 'm.s', '.s.'], IRON, x - 1, y);
      if (y + 6 < y1) stamp(ctx, ['h', 'm', 's'], IRON, x, y + 4);
    }
  }
  // Things that stand out from the wall (iron, roots, bone) are drawn apart
  // first, then set down over a dark outline and a shadow cast down and to the
  // right, so they read as objects rather than paint. Two scratch canvases
  // serve every decoration in every theme.
  let scratch = null, sil = null;
  function ensureScratch() { if (!scratch) { scratch = canvas(TEX, TEX); sil = canvas(TEX, TEX); } }
  function raised(ctx, draw, { outline = null, shadow = 'rgba(0,0,0,0.45)' } = {}) {
    ensureScratch();
    const s = scratch.getContext('2d'), m = sil.getContext('2d');
    s.clearRect(0, 0, TEX, TEX);
    draw(s);
    const silhouette = color => {
      m.globalCompositeOperation = 'copy';
      m.drawImage(scratch, 0, 0);
      m.globalCompositeOperation = 'source-in';
      m.fillStyle = color;
      m.fillRect(0, 0, TEX, TEX);
      m.globalCompositeOperation = 'source-over';
      return sil;
    };
    if (shadow) ctx.drawImage(silhouette(shadow), 1, 1);
    if (outline) {
      silhouette(outline);
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) ctx.drawImage(sil, ox, oy);
    }
    ctx.drawImage(scratch, 0, 0);
  }
  // The brick slots that lie wholly inside the texture, as [x, y] of each
  // brick's top-left corner, row by row.
  const slotsInRow = row => (row % 2 ? [8, 24, 40] : [0, 16, 32, 48]).map(x => [x, row * 8]);
  // A damp streak running down from a joint: darker wet stone, a darker core,
  // a crust of whatever the water carries at its edges, glints where it runs
  // over the lip of a brick, and a stain pooling where it meets the floor.
  function seep(ctx, rng, { wet, core, crust, glint, spread = 4 }) {
    const x0 = rng.int(20, 42), y0 = rng.pick([7, 15, 23]);
    let x = x0;
    px(ctx, 'rgba(0,0,0,0.6)', x - 1, y0, 3, 1);
    for (let y = y0 + 1; y < TEX; y++) {
      const u = (y - y0) / (TEX - y0);
      const w = 2 + Math.round(u * spread + rng.next() * 1.2), l = x - (w >> 1);
      if (rng.chance(0.16)) x += rng.chance(0.5) ? -1 : 1;
      px(ctx, wet, l, y, w, 1);
      px(ctx, core, x - (w > 4 ? 1 : 0), y, w > 4 ? 2 : 1, 1);
      // a sheen down the lit side of the wet, and crust thickening lower down
      px(ctx, 'rgba(255,255,255,0.1)', l, y);
      if (rng.chance(0.25 * u)) px(ctx, crust, rng.chance(0.5) ? l - 1 : l + w, y);
      if (!isMortar(x, y) && isMortar(x, y - 1)) px(ctx, glint, x, y);
    }
    // where it pools at the foot of the wall
    px(ctx, wet, x - spread - 3, 61, spread * 2 + 6, 3);
    px(ctx, wet, x - spread - 1, 60, spread * 2 + 2, 1);
    for (let i = 0; i < 9; i++) px(ctx, crust, x + rng.int(-spread - 3, spread + 2), rng.int(60, 63));
    return { x: x0, y: y0 };
  }
  // An arched recess: dark at the back, its left side catching the light, a
  // stone sill across the foot. Whatever sits in it is drawn by the caller.
  const NICHE = { x0: 23, x1: 41, top: 14, bot: 40, cx: 32, r: 9 };
  function niche(ctx, t) {
    const { x0, x1, top, bot, cx, r } = NICHE, cy = top + r;
    const inside = (x, y) => x >= x0 && x < x1 && y >= top && y < bot && (y >= cy || (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r);
    const side = adjust(t.mortar, -2), edge = adjust(t.mortar, -30), lit = adjust(t.wall, 28), dark = adjust(t.wall, -34);
    for (let y = top - 1; y < bot; y++) {
      const back = adjust(t.mortar, -22 + Math.round((y - top) * 0.55));
      for (let x = x0 - 1; x <= x1; x++) {
        if (inside(x, y)) {
          px(ctx, x < x0 + 2 && y > cy - 4 ? side : x === x1 - 1 ? edge : back, x, y);
          // the arch throws a shadow across the top of the back wall
          if (!inside(x, y - 2)) px(ctx, 'rgba(0,0,0,0.5)', x, y);
        } else if (inside(x + 1, y) || inside(x, y + 1)) px(ctx, lit, x, y);
        else if (inside(x - 1, y) || inside(x, y - 1)) px(ctx, dark, x, y);
      }
    }
    px(ctx, adjust(t.wall, 36), x0 - 3, bot, x1 - x0 + 6, 1);
    px(ctx, adjust(t.wall, 6), x0 - 3, bot + 1, x1 - x0 + 6, 2);
    px(ctx, adjust(t.wall, -30), x0 - 3, bot + 3, x1 - x0 + 6, 1);
    px(ctx, 'rgba(0,0,0,0.4)', x0 - 2, bot + 4, x1 - x0 + 5, 1);
  }
  // Roots from the earth above, breaking through the top of the wall. They are
  // the same in every theme that has them, so they are drawn once and kept.
  let rootsArt = null;
  function roots() {
    if (rootsArt) return rootsArt;
    rootsArt = canvas(TEX, TEX);
    const ctx = rootsArt.getContext('2d');
    const rng = new Rng('roots');
    const grow = (c, x, y, len, thick) => {
      for (let i = 0; i < len && y < TEX; i++, y++) {
        const w = Math.max(1, Math.round(thick * (1 - i / len) + 0.3));
        px(c, ROOT.m, x, y, w, 1);
        if (w > 1) { px(c, ROOT.h, x, y); px(c, ROOT.s, x + w - 1, y); }
        if (rng.chance(0.3)) x += rng.chance(0.5) ? -1 : 1;
        if (thick > 1.6 && i > 3 && rng.chance(0.09)) grow(c, rng.chance(0.5) ? x - 1 : x + w, y + 1, Math.round((len - i) * 0.55), thick * 0.5);
      }
    };
    // the broken earth they come through, then the roots, outlined as one
    for (let x = 16; x < 50; x++) {
      const d = Math.round(4 + 3 * Math.sin((x - 16) / 34 * Math.PI) + rng.next() * 2);
      px(ctx, '#140d08', x, 0, 1, d);
      px(ctx, '#2a1c10', x, d, 1, 1);
    }
    raised(ctx, c => {
      grow(c, 20, 2, 34, 3);
      grow(c, 30, 4, 52, 3.6);
      grow(c, 41, 3, 26, 2.6);
      grow(c, 46, 2, 14, 1.6);
    }, { outline: '#120c08' });
    return rootsArt;
  }
  // moss greens as pixels (little-endian ABGR): edge, body, thick, lit top
  const MOSS = [0xff264e34, 0xff2e6846, 0xff38845a, 0xff46a076];
  // Moss spreading from a few clumps: thickest at their centres, ragged at the
  // edges, reaching further along the damp mortar, with strands hanging below.
  // It thins out toward the sides, since the next wall along has none.
  function moss(ctx, rng, low) {
    const blobs = [];
    for (let k = 0; k < 5; k++) blobs.push({ x: rng.int(0, 63), y: low ? rng.int(46, 72) : rng.int(-8, 16), r: rng.int(10, 20) });
    const on = new Uint8Array(TEX * TEX), val = new Float32Array(TEX * TEX);
    // clumps near the top reach no lower than this, and those near the floor no higher
    const y0 = low ? 26 : 0, y1 = low ? TEX : 38;
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < TEX; x++) {
        let v = 0;
        for (const b of blobs) v = Math.max(v, 1 - Math.hypot(x - b.x, (y - b.y) * 1.3) / b.r);
        v += rng.next() * 0.3 + (isMortar(x, y) ? 0.16 : 0) - Math.max(0, 8 - Math.min(x, TEX - 1 - x)) * 0.06;
        val[y * TEX + x] = v;
        if (v > 0.5) on[y * TEX + x] = 1;
      }
    }
    // painted as raw pixels and laid over the wall in one go: moss covers
    // hundreds of pixels, far too many to fill one by one at startup
    const img = ctx.createImageData(TEX, TEX), out = new Uint32Array(img.data.buffer);
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < TEX; x++) {
        if (!on[y * TEX + x]) continue;
        const v = val[y * TEX + x], top = y === 0 || !on[(y - 1) * TEX + x];
        out[y * TEX + x] = MOSS[top && !isMortar(x, y) ? 3 : v > 0.95 ? 2 : v > 0.7 ? 1 : 0];
        // strands hang from the underside
        if (y < TEX - 1 && !on[(y + 1) * TEX + x] && rng.chance(0.18)) {
          for (let k = 1, n = rng.int(1, 6); k <= n && y + k < TEX; k++) out[(y + k) * TEX + x] = MOSS[0];
        }
      }
    }
    ensureScratch();
    scratch.getContext('2d').putImageData(img, 0, 0);
    ctx.drawImage(scratch, 0, 0);
  }
  // The dressings named in each theme's decor list.
  const DECOR = {
    banner(ctx, t, rng) {
      // a hanging banner in the theme's colour, faded and torn at the foot,
      // hung from an iron rod: someone once claimed these halls
      const x0 = rng.pick([18, 22, 26]), w = 18, top = 9, len = rng.int(34, 42);
      const [r, g, b] = hexToRgb(t.accent);
      const cloth = k => `rgb(${Math.round(r * k)},${Math.round(g * k)},${Math.round(b * k)})`;
      raised(ctx, c => {
        for (let y = 0; y < len; y++) {
          // the foot is cut in a swallowtail and frayed
          const cut = y > len - 7 ? Math.abs(y - len + 7) : 0;
          for (let x = 0; x < w; x++) {
            if (cut && x > w / 2 - cut * 1.2 && x < w / 2 + cut * 1.2) continue;
            // folds: light down the left of each, shade down the right
            const fold = Math.sin((x + 1) * 0.9) * 0.14, edge = x === 0 || x === w - 1 ? -0.12 : 0;
            const k = 0.62 + fold + edge - y * 0.004 + (rng.chance(0.06) ? -0.08 : 0);
            px(c, cloth(Math.max(0.25, k)), x0 + x, top + y);
          }
        }
        // a pale device sewn on: a ring and a bar, worn half away
        const cx = x0 + w / 2, cy = top + 13;
        for (let a = 0; a < 24; a++) { const q = a / 24 * Math.PI * 2; if (rng.chance(0.8)) px(c, 'rgba(236,222,190,0.8)', Math.round(cx + Math.cos(q) * 4.5), Math.round(cy + Math.sin(q) * 4.5)); }
        px(c, 'rgba(236,222,190,0.8)', cx - 1, cy - 7, 2, 15);
        // the rod and its two brackets
        px(c, IRON.m, x0 - 3, top - 2, w + 6, 2); px(c, IRON.h, x0 - 3, top - 2, w + 6, 1);
        px(c, IRON.s, x0 - 3, top - 4, 2, 4); px(c, IRON.s, x0 + w + 1, top - 4, 2, 4);
      }, { outline: 'rgba(10,8,14,0.9)' });
    },
    cobweb(ctx, t, rng, n) {
      // an old web strung across a top corner: spokes from the corner and
      // sagging threads between them, grey with dust
      const left = n % 2 === 0 ? rng.chance(0.5) : n % 2 === 1, sx = left ? 0 : TEX - 1, dir = left ? 1 : -1;
      const spokes = [0.08, 0.35, 0.62, 0.9].map(f => f * Math.PI / 2);
      const reach = rng.int(26, 34);
      for (const a of spokes) line(ctx, 'rgba(220,220,228,0.55)', sx, 0, sx + dir * Math.cos(a) * reach, Math.sin(a) * reach);
      for (let ring = 6; ring < reach; ring += rng.int(5, 7)) {
        for (let k = 0; k < spokes.length - 1; k++) {
          const a0 = spokes[k], a1 = spokes[k + 1];
          for (let s = 0; s <= 8; s++) {
            const a = a0 + (a1 - a0) * s / 8, sag = Math.sin(s / 8 * Math.PI) * 1.6;
            px(ctx, 'rgba(210,210,220,0.42)', Math.round(sx + dir * Math.cos(a) * (ring - sag)), Math.round(Math.sin(a) * (ring - sag)));
          }
        }
      }
      // a dead fly, and dust caught in the strands
      px(ctx, '#1a1418', sx + dir * rng.int(8, 14), rng.int(8, 14), 2, 2);
    },
    sconce(ctx, t, rng) {
      // an iron sconce with a candle burnt to a stub, long cold, and wax run down the wall
      const x = rng.pick([28, 32, 36]);
      raised(ctx, c => {
        stamp(c, ['.hhm.', 'hmmms', '.mms.', '..s..', '..s..', '.hms.', 'hmmss'], IRON, x - 2, 26);
        stamp(c, ['.hm.', 'hhms', 'hhms', 'hmms'], { h: '#efe6cc', m: '#cfc2a0', s: '#9a8c6a' }, x - 1, 21);
        px(c, '#2a2018', x, 20);
      }, { outline: IRON.o });
      px(ctx, 'rgba(230,222,196,0.7)', x - 1, 33, 1, rng.int(4, 9));
      px(ctx, 'rgba(0,0,0,0.3)', x - 6, 14, 12, 8);
    },
    ring(ctx, t, rng) {
      // a heavy iron ring on a plate, for tethering something long gone
      const x = rng.pick([28, 32, 36]);
      raised(ctx, c => {
        stamp(c, ['.hm.', 'hhms', 'hmss', '.ss.'], IRON, x - 2, 16);
        stamp(c, ['m', 's'], IRON, x, 20);
        ring(c, x + 0.5, 28.5, 6.5, 1.9);
      }, { outline: IRON.o });
    },
    chains(ctx, t, rng) {
      // two chains from staples, one ending in a shut manacle, one hanging open
      raised(ctx, c => {
        for (const [x, len, open] of [[20, rng.int(22, 26), false], [43, rng.int(16, 20), true]]) {
          stamp(c, ['hms', 'mss'], IRON, x - 1, 9);
          chain(c, x, 11, 11 + len);
          const cy = 11 + len + 3;
          ring(c, x + 0.5, cy, 3.5, 1.9);
          if (open) c.clearRect(x - 4, cy, 4, 6);
        }
      }, { outline: IRON.o });
    },
    niche(ctx, t) {
      // a stub of candle, long since burnt down
      niche(ctx, t);
      raised(ctx, c => {
        stamp(c, ['.o.', 'hmm', 'hms', 'hms', 'mms'], { o: '#201810', h: '#e4dcc0', m: '#c8bc9c', s: '#948a70' }, NICHE.cx - 1, NICHE.bot - 5);
        px(c, '#c8bc9c', NICHE.cx + 2, NICHE.bot - 1);
      }, { shadow: 'rgba(0,0,0,0.5)' });
    },
    burial(ctx, t) {
      // a skull laid in a burial niche, a long bone beside it
      niche(ctx, t);
      raised(ctx, c => {
        stamp(c, SKULL, BONE, NICHE.cx - 5, NICHE.bot - 6);
        stamp(c, ['hmmmmh', 'smmmms'], BONE, NICHE.cx + 2, NICHE.bot - 2);
      });
    },
    shrine(ctx, t) {
      // a shard of violet crystal in a recess, lighting the stone round it
      niche(ctx, t);
      const g = ctx.createRadialGradient(NICHE.cx, NICHE.bot - 6, 1, NICHE.cx, NICHE.bot - 6, 11);
      g.addColorStop(0, 'rgba(150,110,230,0.55)');
      g.addColorStop(1, 'rgba(150,110,230,0)');
      ctx.fillStyle = g;
      ctx.fillRect(NICHE.x0, NICHE.top, NICHE.x1 - NICHE.x0, NICHE.bot - NICHE.top);
      raised(ctx, c => stamp(c, ['..h..', '.hhm.', '.hmm.', 'hhmms', '.mms.', '.mms.', '..s..'], VIOLET, NICHE.cx - 2, NICHE.bot - 7), { outline: '#1a1030' });
    },
    skulls(ctx, t, rng) {
      // three skulls set into the wall where bricks once were
      const rows = rng.shuffle([1, 2, 3, 4, 5, 6]).slice(0, 3);
      raised(ctx, c => {
        for (const row of rows) {
          const [x, y] = rng.pick(slotsInRow(row));
          // the hole goes straight onto the wall, the skull into it
          px(ctx, adjust(t.mortar, -16), x + 1, y + 1, 14, 6);
          stamp(c, SKULL, BONE, x + 4, y + 1);
        }
      }, { shadow: null });
    },
    ossuary(ctx, t) {
      // a course of skulls over two of long bones stacked end to end, the way
      // the catacombs were walled when the graveyards above ran out of room
      px(ctx, adjust(t.mortar, -18), 0, 24, TEX, 16);
      raised(ctx, c => {
        for (let x = 1; x < TEX; x += 9) stamp(c, SKULL, BONE, x, 25);
        for (let x = -6; x < TEX; x += 13) stamp(c, LONG_BONE, BONE, x, 32);
        for (let x = 0; x < TEX; x += 13) stamp(c, LONG_BONE, BONE, x, 36);
      }, { shadow: 'rgba(0,0,0,0.6)' });
      px(ctx, 'rgba(0,0,0,0.35)', 0, 24, TEX, 1);
    },
    roots(ctx) { ctx.drawImage(roots(), 0, 0); },
    // the first moss hangs from above, a second rises from the floor
    moss(ctx, t, rng, nth) { moss(ctx, rng, nth % 2 === 1); },
    lichen(ctx, t, rng) {
      // crusts of pale lichen, each spreading in a ragged disc from where it
      // took hold, a few clustered together as lichen grows
      const cx = rng.int(18, 46), cy = rng.int(16, 48);
      for (let k = 0; k < 7; k++) {
        const bx = cx + rng.int(-14, 14), by = cy + rng.int(-12, 12), r = rng.int(2, 5);
        for (let y = by - r - 1; y <= by + r + 1; y++) {
          for (let x = bx - r - 1; x <= bx + r + 1; x++) {
            const d = Math.hypot(x - bx, y - by) + rng.next() * 1.6 - 0.8;
            if (d > r) continue;
            px(ctx, d > r - 1 ? '#9c9e7e' : rng.chance(0.35) ? '#6c7058' : '#84886a', x, y);
          }
        }
      }
    },
    seep(ctx, t, rng) {
      // water weeping from a joint, leaving a crust of lime (or slime) behind
      seep(ctx, rng, { wet: 'rgba(0,0,0,0.38)', core: 'rgba(0,0,0,0.3)', crust: adjust(t.accent, 40), glint: 'rgba(255,255,255,0.5)' });
    },
    stain(ctx, t, rng) {
      // rust bleeding from an old iron spike driven into the mortar
      const at = seep(ctx, rng, { wet: 'rgba(120,34,16,0.5)', core: 'rgba(70,12,6,0.5)', crust: '#b05a3a', glint: 'rgba(255,180,140,0.4)', spread: 7 });
      raised(ctx, c => stamp(c, ['.o.', 'omo', 'oms', '.s.'], { o: '#3a1a10', m: '#7a3c22', s: '#4a2214' }, at.x - 1, at.y - 3));
    },
    rime(ctx, t, rng) {
      // a bloom of frost spreading from the top of the wall, grown thickest
      // along the joints and the lips of the bricks, and icicles hanging from
      // above. It fades out before the sides, where the next wall has none.
      const g = ctx.createRadialGradient(32, 0, 4, 32, 0, 36);
      g.addColorStop(0, 'rgba(200,225,255,0.4)');
      g.addColorStop(1, 'rgba(200,225,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, TEX, 36);
      for (let y = 0; y < 34; y++) {
        for (let x = 0; x < TEX; x++) {
          const k = Math.max(0, 1 - Math.hypot((x - 32) / 34, y / 34)) ** 1.2, m = isMortar(x, y);
          if (rng.chance(k * (m ? 0.8 : (y & 7) === 1 ? 0.55 : 0.02))) px(ctx, m ? '#a8c6e6' : '#dcecff', x, y);
        }
      }
      for (let i = 0; i < 8; i++) {
        const x = rng.int(12, 52), len = Math.round(rng.int(3, 12) * (1 - Math.abs(x - 32) / 40));
        px(ctx, '#eaf4ff', x, 0, 1, len);
        px(ctx, '#9cbce0', x + 1, 0, 1, Math.max(2, len - 4));
        px(ctx, '#ffffff', x, len, 1, 1);
      }
    },
    grate(ctx, t) {
      // an iron grate over a shaft, where the cold air comes from
      const x0 = 22, y0 = 26, w = 20, h = 13;
      px(ctx, adjust(t.wall, 30), x0 - 2, y0 - 2, w + 4, 1);
      px(ctx, adjust(t.wall, 30), x0 - 2, y0 - 2, 1, h + 4);
      px(ctx, adjust(t.wall, -36), x0 - 2, y0 + h + 1, w + 4, 1);
      px(ctx, adjust(t.wall, -36), x0 + w + 1, y0 - 2, 1, h + 4);
      px(ctx, adjust(t.wall, 4), x0 - 1, y0 - 1, w + 2, h + 2);
      px(ctx, '#04060a', x0, y0, w, h);
      px(ctx, '#0c1018', x0, y0 + h - 4, w, 4);
      raised(ctx, c => {
        for (let x = x0 + 2; x < x0 + w - 1; x += 4) { px(c, IRON.m, x, y0 - 1, 2, h + 2); px(c, IRON.h, x, y0 - 1, 1, h + 2); }
        px(c, IRON.m, x0 - 1, y0 + 5, w + 2, 2);
        px(c, IRON.h, x0 - 1, y0 + 5, w + 2, 1);
      }, { shadow: 'rgba(0,0,0,0.7)' });
      // frost where the cold breath meets the stone
      const rng = new Rng('grate');
      for (let i = 0; i < 16; i++) px(ctx, rng.pick(['#dcecff', '#b4cfea']), x0 - 3 + rng.int(0, w + 5), y0 - 4 + rng.int(0, 2));
    },
    runes(ctx) {
      // a ring of runes cut into the black glass, glowing along the cuts
      raised(ctx, c => {
        for (let a = 0; a < 64; a++) {
          const an = a / 64 * Math.PI * 2;
          px(c, VIOLET.m, Math.round(32 + Math.cos(an) * 12), Math.round(30 + Math.sin(an) * 12));
        }
        line(c, VIOLET.h, 32, 21, 32, 39);
        line(c, VIOLET.h, 32, 28, 26, 22);
        line(c, VIOLET.h, 32, 28, 38, 22);
        line(c, VIOLET.m, 27, 34, 37, 34);
        // lesser runes round the ring
        const RUNES = [['h.h', 'hhh', '.h.', '.h.'], ['hh.', 'h.h', 'hh.', 'h..'], ['h..', 'hh.', 'h.h', 'h..'], ['.h.', 'h.h', '.h.', 'h.h']];
        [[20, 16], [42, 16], [20, 41], [42, 41]].forEach(([x, y], k) => stamp(c, RUNES[k], VIOLET, x - 1, y - 2));
      }, { outline: 'rgba(128,96,192,0.45)', shadow: 'rgba(0,0,0,0.8)' });
    },
    vein(ctx, t, rng) {
      // a crack in the glass with something bright showing through, and
      // crystals grown out of it
      const pts = [[rng.int(22, 42), 0]];
      while (pts[pts.length - 1][1] < TEX) { const [x, y] = pts[pts.length - 1]; pts.push([Math.max(6, Math.min(58, x + rng.int(-7, 7))), y + rng.int(6, 11)]); }
      raised(ctx, c => {
        // wider where it opened first, near the top, narrowing as it runs
        for (let i = 1; i < pts.length; i++) {
          if (i < 4) line(c, VIOLET.m, pts[i - 1][0] + 1, pts[i - 1][1], pts[i][0] + 1, pts[i][1]);
          line(c, VIOLET.h, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
        }
        for (const i of [2, 4]) stamp(c, ['..h..', '.hhm.', 'hhmms', '.mms.', '..s..'], VIOLET, pts[i][0] - 2, pts[i][1] - 2);
      }, { outline: 'rgba(128,96,192,0.55)', shadow: 'rgba(0,0,0,0.8)' });
    },
  };

  return { BONE, DECOR, LONG_BONE, SKULL, isMortar, line, moss, px, stamp };
}
