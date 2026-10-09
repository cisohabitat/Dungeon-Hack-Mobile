import { Rng } from './rng.js';
import { SPRITES, THEMES, KEY_COLORS, ELITES, ITEMS, MONSTERS } from './data.js';
import { SHADE_GEAR, PORTRAITS, CHAMPIONS, CHAMPION_OF, CREATURES, POSES, PROPS, FLOATING, gridOf, paintParts, up2 } from './creatures.js';
import { ITEM_ART } from './itemart.js';
import { DRESSING } from './dressing.js';
import { heldParts, carriedParts } from './heldart.js';
import { makeWallDecor } from './walldecor.js';

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

  // A colour as the four bytes a canvas would store for it, read back from one
  // pixel painted with it the first time, so any colour a style takes works.
  const rgbaCache = new Map();
  let probe = null;
  function rgba32(c) {
    let v = rgbaCache.get(c);
    if (v !== undefined) return v;
    if (!probe) probe = canvas(1, 1).getContext('2d', { willReadFrequently: true });
    probe.clearRect(0, 0, 1, 1);
    probe.fillStyle = c;
    probe.fillRect(0, 0, 1, 1);
    v = new Uint32Array(probe.getImageData(0, 0, 1, 1).data.buffer)[0];
    rgbaCache.set(c, v);
    return v;
  }

  // ---- sprites ----
  // Art is drawn as flat tones; the outline, contact shadow and top light are
  // added here so every sprite reads the same way against a dark wall.
  /** @param {number} [scale]  pixels to the grid unit, if not the usual for its kind */
  function makeSprite(def, scale) {
    // a creature built from parts arrives already lit; the old grids are flat
    const sc = scale || (def.fine ? 2 : 1);
    const painted = def.parts ? paintParts(def.parts, def.grid || 32, sc, def.grim || false) : null;
    const aw = painted ? painted.aw : def.rows[0].length, ah = painted ? painted.ah : def.rows.length;
    // the outline keeps its weight in a finer painting: two of its pixels wide
    const ow = sc * (def.grid || 32) / 32 >= 4 ? 2 : 1;
    const w = aw + ow * 2, h = ah + ow * 2;     // room for the outline
    // the drawing and its outline are set pixel by pixel into one layer, which
    // then goes over the shadow: a canvas call per pixel was most of the time
    // a finer painting took
    const layer = canvas(w, h), lctx = layer.getContext('2d');
    const img = lctx.createImageData(w, h), px32 = new Uint32Array(img.data.buffer);
    const solid = new Uint8Array(aw * ah);
    for (let y = 0; y < ah; y++) {
      for (let x = 0; x < aw; x++) {
        const c = painted ? painted.color[y * aw + x] : (def.rows[y][x] === '.' ? null : (def.pal[def.rows[y][x]] || '#ff00ff'));
        if (!c) continue;
        solid[y * aw + x] = 1;
        px32[(y + ow) * w + x + ow] = rgba32(c);
      }
    }
    const base = canvas(w, h);
    const ctx = base.getContext('2d');
    // a soft contact shadow so creatures sit on the floor instead of hovering
    if (def.shadow) {
      let minX = aw, maxX = -1;
      for (let x = 0; x < aw; x++) for (let y = ah - sc * 2; y < ah; y++) if (solid[y * aw + x]) { if (x < minX) minX = x; if (x > maxX) maxX = x; }
      if (maxX >= minX) {
        const cx = (minX + maxX) / 2 + ow, rx = Math.max(3, (maxX - minX) / 2 + 1.5);
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
    const outline = rgba32(def.outline || '#0a0810');
    // a colour mixed most of the way to the outline's ink (pixels are ABGR in memory)
    const inked = v => {
      const r = v & 255, g = (v >> 8) & 255, b = (v >> 16) & 255, k = def.grim ? 0.8 : 0.68;
      return (0xff << 24 | Math.round(b + (30 - b) * k) << 16 | Math.round(g + (18 - g) * k) << 8 | Math.round(r + (22 - r) * k)) >>> 0;
    };
    const reach = ow === 1 ? [[1, 0], [-1, 0], [0, 1], [0, -1]]
      : [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    for (let y = -ow; y < ah + ow; y++) {
      for (let x = -ow; x < aw + ow; x++) {
        if (x >= 0 && y >= 0 && x < aw && y < ah && solid[y * aw + x]) continue;
        let touch = -1;
        for (const [ox, oy] of reach) {
          const nx = x + ox, ny = y + oy;
          if (nx < 0 || ny < 0 || nx >= aw || ny >= ah) continue;
          if (solid[ny * aw + nx]) {
            // on the side the light comes from (the drawing lies below or to
            // the right of this edge) the outline is a deep shade of what it
            // wraps, as a pixel artist inks it; on the shadow side it stays
            // near black, so the shape still stands off a dark wall
            // (painted grim, it is a deep shade of what it wraps all round:
            // no black line about a figure, which read as a cartoon)
            touch = def.outline || (!def.grim && !(ox > 0 || oy > 0)) ? 0 : px32[(ny + ow) * w + nx + ow];
            break;
          }
        }
        if (touch >= 0) px32[(y + ow) * w + x + ow] = touch ? inked(touch) : outline;
      }
    }
    lctx.putImageData(img, 0, 0);
    ctx.drawImage(layer, 0, 0);
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
    // The picture as a data URL is made the first time something shows it (the
    // pack, the bestiary, the class cards): made for every sprite and champion's
    // wash as it was built, it was spent mostly on pictures never shown.
    // (the finer painting is only ever drawn in the view, never shown as a picture)
    const lazyUrl = (/** @type {HTMLCanvasElement} */ c) => { let u = null; return () => (u === null ? (u = scale ? '' : c.toDataURL()) : u); };
    const baseUrl = lazyUrl(base);
    const make = () => ({
      w, h, top,
      levels: SHADES.map(a => (a === 0 ? base : tintOf('#000', a))),
      flash: tintOf('#fff', 0.85),
      get url() { return baseUrl(); },
      /** @type {null | (() => any)} the finer painting for up close, once it is ready (see finerOf) */
      near: null,
    });
    const sprite = make();
    // Elite variants: the base sprite washed with the champion's colour, then
    // shaded. Only monsters can be champions, and building these for every
    // item, key and prop as well was over half the time the game took to start.
    sprite.elite = {};
    // a named champion's own wash rides on its kind's picture, keyed by its id
    if (def.elites) for (const e of [...ELITES, ...(def.named || [])]) {
      const wash = () => {
        const washed = tintOf(e.tint, 0.4);
        const shade = a => {
          const c = canvas(w, h);
          const cx = c.getContext('2d');
          cx.drawImage(washed, 0, 0);
          if (a > 0) { cx.globalCompositeOperation = 'source-atop'; cx.fillStyle = '#000'; cx.globalAlpha = a; cx.fillRect(0, 0, w, h); }
          return c;
        };
        const washedUrl = lazyUrl(washed);
        return { w, h, top, levels: SHADES.map(shade), flash: sprite.flash, get url() { return washedUrl(); }, near: /** @type {null | (() => any)} */ (null) };
      };
      // the finer painting washes a champion's colour on only when one comes near
      if (scale) { let made = null; Object.defineProperty(sprite.elite, e.prefix, { get: () => made || (made = wash()), enumerable: true }); }
      else sprite.elite[e.prefix] = wash();
    }
    return sprite;
  }

  // ---- textures ----
  function makeWall(theme, seed, cracked) {
    if (theme.face === 'glass') return makeGlass(theme, seed, cracked);
    if (theme.face === 'bones') return makeOssuary(theme, seed, cracked);
    if (theme.face === 'earth') return makeEarth(theme, seed, cracked);
    if (theme.face === 'ashlar') return makeAshlar(theme, seed, cracked);
    if (theme.face === 'granite') return makeGranite(theme, seed, cracked);
    if (theme.face === 'reed') return makeReed(theme, seed, cracked);
    return makeBrick(theme, seed, cracked);
  }
  // Black glass: the Sanctum's walls are not laid in courses of brick but cut
  // in great polished slabs, dark as a well, that catch the light from above
  // in a sheen and a streak or two. Their joints fall on brick lines, so a
  // recess or a crack painted over them still sits on a seam.
  function makeGlass(theme, seed, cracked) {
    const c = canvas(TEX, TEX);
    const ctx = c.getContext('2d');
    const rng = new Rng(seed);
    const [ar, ag, ab] = hexToRgb(theme.accent);
    const glow = a => `rgba(${ar},${ag},${ab},${a})`;
    ctx.fillStyle = theme.mortar;
    ctx.fillRect(0, 0, TEX, TEX);
    // three courses of slabs, each set over the one above: [top, height, offset]
    for (const [y0, sh, off] of [[0, 24, 0], [24, 16, 20], [40, 24, 8]]) {
      for (let k = -1; k <= 1; k++) {
        const x0 = off + k * 32, sw = 32, tone = rng.int(-5, 5);
        ctx.save();
        ctx.beginPath(); ctx.rect(x0 + 1, y0 + 1, sw - 2, sh - 2); ctx.clip();
        // polished: the ceiling's light sits in the top of each slab, and it
        // falls away to near black below
        for (let y = 1; y < sh - 1; y++) {
          const t = (y - 1) / (sh - 3);
          ctx.fillStyle = adjust(theme.wall, tone - 26 + Math.round(20 * (1 - t) * (1 - t) * (1 - t)) - Math.round(t * 12));
          ctx.fillRect(x0 + 1, y0 + y, sw - 2, 1);
        }
        // a streak of reflected light across it, and a fainter one beside
        const sx = x0 + rng.int(4, sw - 6);
        for (const [dx, a, w] of [[0, 0.24, 2], [rng.int(4, 7), 0.1, 1]]) {
          ctx.fillStyle = `rgba(214,200,255,${a})`;
          for (let y = 1; y < sh - 1; y++) ctx.fillRect(sx + dx + Math.round((sh - y) * 0.6), y0 + y, w, 1);
        }
        ctx.fillStyle = 'rgba(236,228,255,0.3)';
        for (let y = 2; y < Math.min(sh - 2, 7); y++) ctx.fillRect(sx + Math.round((sh - y) * 0.6), y0 + y, 1, 1);
        // a glint where the light meets an edge, deep in the glass
        ctx.fillStyle = glow(0.5);
        ctx.fillRect(x0 + rng.int(3, sw - 4), y0 + rng.int(3, sh - 4), 1, 1);
        ctx.restore();
        // cut edges: lit along the top and left, in shadow along the bottom and right
        ctx.fillStyle = adjust(theme.wall, tone + 30);
        ctx.fillRect(x0 + 1, y0 + 1, sw - 2, 1);
        ctx.fillStyle = adjust(theme.wall, tone + 6);
        ctx.fillRect(x0 + 1, y0 + 2, 1, sh - 3);
        ctx.fillStyle = adjust(theme.wall, tone - 34);
        ctx.fillRect(x0 + 1, y0 + sh - 2, sw - 2, 1);
        ctx.fillRect(x0 + sw - 2, y0 + 2, 1, sh - 3);
      }
    }
    // the power the walls hum with shows faintly in the joints
    ctx.fillStyle = glow(0.45);
    for (let i = 0; i < 18; i++) {
      const [y0, off] = rng.pick([[0, 0], [24, 20], [40, 8]]);
      if (rng.chance(0.5)) ctx.fillRect(rng.int(0, TEX - 1), y0, rng.int(1, 3), 1);
      else ctx.fillRect((off + rng.int(0, 1) * 32) % TEX, y0 + rng.int(1, 14), 1, rng.int(1, 3));
    }
    if (cracked) {
      // struck glass: a star of bright cracks from one point, dark beside each
      const cx = rng.int(20, 44), cy = rng.int(18, 44);
      for (let r = 0; r < 6; r++) {
        let a = r / 6 * Math.PI * 2 + rng.next() * 0.6, x = cx, y = cy;
        const len = rng.int(9, 22);
        for (let s = 0; s < len; s++) {
          a += (rng.next() - 0.5) * 0.5;
          x += Math.cos(a); y += Math.sin(a);
          ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(Math.round(x) + 1, Math.round(y) + 1, 1, 1);
          ctx.fillStyle = s < len * 0.6 ? '#d8ccff' : glow(0.8); ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
        }
      }
      ctx.fillStyle = '#f4f0ff';
      ctx.fillRect(cx - 1, cy, 3, 1); ctx.fillRect(cx, cy - 1, 1, 3);
    }
    return c;
  }

  // The Crypts' deep road: no brick at all, but the dead themselves, stacked
  // floor to roof between stone shelves. A course of skulls, then long bones
  // laid end-on in three layers, then skulls again, as the old sextons packed
  // an ossuary; the shelves are the theme's stone, the gaps its dark.
  function makeOssuary(theme, seed, cracked) {
    const c = canvas(TEX, TEX);
    const ctx = c.getContext('2d');
    const rng = new Rng(seed);
    ctx.fillStyle = theme.mortar;
    ctx.fillRect(0, 0, TEX, TEX);
    const shelf = y => {
      px(ctx, adjust(theme.wall, -30), 0, y, TEX, 3);
      px(ctx, adjust(theme.wall, -8), 0, y, TEX, 1);
      px(ctx, adjust(theme.wall, -52), 0, y + 2, TEX, 1);
    };
    for (let band = 0; band < 4; band++) {
      const y0 = band * 16;
      shelf(y0);
      if (band % 2 === 0) {
        // a course of skulls, packed by hand: not quite evenly spaced, some
        // sunk lower, some yellower, a jaw lost here, a pair of crossed bones
        // pushed into a gap there. Laid in a strict row they read, from a few
        // paces off, as one chain of links repeating along the whole wall.
        for (let x = rng.int(-3, 0); x < TEX; x += rng.int(7, 10)) {
          if (cracked ? rng.chance(0.3) : rng.chance(0.08)) continue;
          const tone = rng.int(-30, 10), pal = { h: adjust(BONE.h, tone), m: adjust(BONE.m, tone), s: adjust(BONE.s, tone), d: BONE.d };
          const y = y0 + 5 + rng.int(0, 2);
          if (rng.chance(0.14)) {
            // crossed long bones in the place of a skull
            line(ctx, pal.m, x, y, x + 6, y + 5); line(ctx, pal.s, x + 6, y, x, y + 5);
            px(ctx, pal.h, x, y, 1, 1); px(ctx, pal.h, x + 6, y, 1, 1);
            continue;
          }
          stamp(ctx, rng.chance(0.25) ? SKULL.slice(0, 5) : SKULL, pal, x, y);
          if (rng.chance(0.3)) px(ctx, BONE.d, x + rng.int(2, 4), y + 1, 1, 1);   // a hole knocked in the crown
        }
      } else {
        // long bones laid end-on in rows: only their knuckled ends show, a few
        // sticking out further than the rest, and here and there one laid lengthwise
        for (let row = 0; row < 3; row++) {
          for (let x = (row % 2) * 3 - 2 + rng.int(0, 1); x < TEX; x += rng.int(5, 7)) {
            if (rng.chance(cracked ? 0.2 : 0.07)) continue;
            const tone = rng.int(-28, 8), pal = { h: adjust(BONE.h, tone), m: adjust(BONE.m, tone), s: adjust(BONE.s, tone) };
            if (rng.chance(0.08)) { stamp(ctx, LONG_BONE, pal, x, y0 + 4 + row * 4); x += 7; continue; }
            stamp(ctx, ['.hm.', 'hmms', '.ms.'], pal, x, y0 + 4 + row * 4 + (rng.chance(0.2) ? 1 : 0));
          }
        }
      }
    }
    // dust gathered on everything
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    for (let i = 0; i < 40; i++) ctx.fillRect(rng.int(0, TEX - 1), rng.int(0, TEX - 1), 1, 1);
    if (cracked) {
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      let x = rng.int(12, 50), y = 0;
      while (y < TEX) { ctx.fillRect(x, y, 2, 2); y += 2; x += rng.int(-1, 1); }
    }
    return c;
  }
  // The Warrens' deep road: tunnels dug, not built. Packed earth full of
  // stones, roots hanging through, and every few paces a timber frame, a post
  // up either side and a beam across, that the diggers put in to keep the
  // roof off them. The posts sit at the edges so two walls side by side meet
  // in one stout prop.
  function makeEarth(theme, seed, cracked) {
    const c = canvas(TEX, TEX);
    const ctx = c.getContext('2d');
    const rng = new Rng(seed);
    const img = ctx.createImageData(TEX, TEX), d = new Uint32Array(img.data.buffer);
    const [r0, g0, b0] = hexToRgb(theme.wall);
    // soil: grainy, in clods a shade apart
    const clod = [];
    for (let i = 0; i < 18; i++) clod.push([rng.int(0, TEX), rng.int(0, TEX), rng.int(5, 12), rng.int(-16, 12)]);
    for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
      let t = rng.int(-9, 9);
      for (const [cx, cy, r, s] of clod) if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) { t += s; break; }
      const v = (k, base) => Math.max(0, Math.min(255, base + k));
      d[y * TEX + x] = (255 << 24 | v(t * 0.8, b0) << 16 | v(t * 0.9, g0) << 8 | v(t, r0)) >>> 0;
    }
    ctx.putImageData(img, 0, 0);
    // stones bedded in it, lit from the upper left
    for (let i = 0; i < 9; i++) {
      const cx = rng.int(8, 56), cy = rng.int(10, 58), rx = rng.int(2, 4), ry = rng.int(2, 3), tone = rng.int(-10, 20);
      for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
        const q = (x / rx) ** 2 + (y / ry) ** 2;
        if (q > 1) continue;
        px(ctx, adjust('#6e6a64', tone + (x + y < -1 ? 18 : x + y > 1 ? -22 : 0)), cx + x, cy + y);
      }
    }
    // roots hanging through from above
    for (let i = 0; i < 3; i++) {
      let x = rng.int(12, 52), y = 6;
      const len = rng.int(8, 22);
      for (let k = 0; k < len; k++) { px(ctx, k < len - 4 ? '#4a3420' : '#5e4630', x, y + k); if (rng.chance(0.3)) x += rng.int(-1, 1); }
    }
    // the timber frame: a beam across the top, a post down each edge
    const wood = (x, y, w, h, vertical) => {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const along = vertical ? i : j, grain = ((vertical ? j : i) * 7 + along * 13) % 11 === 0 ? -14 : 0;
        const edge = along === 0 ? 16 : along === (vertical ? w : h) - 1 ? -26 : 0;
        px(ctx, adjust('#6a4a2c', edge + grain), x + i, y + j);
      }
    };
    wood(0, 6, 4, TEX - 6, true); wood(TEX - 4, 6, 4, TEX - 6, true);
    wood(0, 0, TEX, 6, false);
    px(ctx, 'rgba(0,0,0,0.35)', 4, 6, TEX - 8, 2);   // the beam's shadow on the earth
    for (const x of [2, TEX - 3]) px(ctx, '#2a2a30', x, 2, 1, 1);   // pegs
    if (cracked) {
      // the earth has slumped: a dark fissure and a spill of loose soil at its foot
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      let x = rng.int(16, 48), y = 8;
      while (y < TEX) { ctx.fillRect(x, y, 2, 2); y += 2; x += rng.int(-1, 1); }
      for (let i = 0; i < 30; i++) px(ctx, adjust(theme.wall, rng.int(-30, 10)), rng.int(10, 54), rng.int(56, 63));
    }
    return c;
  }

  /** The decorated walls of one theme, each a copy of its plain wall dressed. */
  // ---- the painter's tools for stone and wood ----
  // Surfaces are painted a pixel at a time, the way stone and wood actually
  // look: no two bricks the same tone, a grain through each, light on the top
  // edges and shadow under them, damp creeping up from the floor.
  /** a repeatable 0..1 value for a pixel and a seed */
  function hash2(x, y, s) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  /** smooth noise that tiles across the texture: blotches about `cell` pixels across */
  function vnoise(x, y, cell, s) {
    const n = TEX / cell, gx = x / cell, gy = y / cell, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
    const v = (i, j) => hash2(((i % n) + n) % n, ((j % n) + n) % n, s);
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    return (v(x0, y0) * (1 - sx) + v(x0 + 1, y0) * sx) * (1 - sy) + (v(x0, y0 + 1) * (1 - sx) + v(x0 + 1, y0 + 1) * sx) * sy;
  }
  /** a pixel canvas to paint into, and the way to hand it back as a canvas */
  function pixels() {
    // (read back as often as it is written: a canvas kept on the GPU is slow to read, and the browser said so)
    const c = canvas(TEX, TEX), ctx = c.getContext('2d', { willReadFrequently: true }), img = ctx.createImageData(TEX, TEX), d = img.data;
    /** @param {number} x @param {number} y @param {number[]} c  red, green, blue @param {number} [k]  how much lighter (or darker) */
    const set = (x, y, c, k = 0) => {
      const i = (y * TEX + x) * 4, [r, g, b] = c;
      d[i] = Math.max(0, Math.min(255, r + k)); d[i + 1] = Math.max(0, Math.min(255, g + k)); d[i + 2] = Math.max(0, Math.min(255, b + k)); d[i + 3] = 255;
    };
    const get = (x, y) => { const i = (y * TEX + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
    return { c, ctx, set, get, done: () => { ctx.putImageData(img, 0, 0); return c; } };
  }
  const mixRgb = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

  /** A brick wall: courses of dressed stone, each its own tone, in recessed mortar. */
  function makeBrick(theme, seed, cracked) {
    const rng = new Rng(seed), s = Math.floor(rng.next() * 1e6);
    const P = pixels(), wall = hexToRgb(theme.wall), mortar = hexToRgb(theme.mortar), damp = mixRgb(wall, [26, 34, 30], 0.55);
    // each brick's tone, tint and whether a corner has been knocked off
    const brick = new Map();
    const brickOf = (bx, row) => {
      const k = bx * 31 + row;
      if (!brick.has(k)) brick.set(k, { t: rng.int(-16, 14), warm: rng.int(-5, 5), chip: rng.chance(0.35) ? rng.int(0, 3) : -1, pores: rng.int(2, 6) });
      return brick.get(k);
    };
    for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
      const row = y >> 3, off = row & 1 ? 8 : 0, lx = (x + off) & 15, ly = y & 7, bx = (x + off) >> 4;
      const dampness = Math.max(0, (y - 40) / 24) * (0.55 + 0.45 * vnoise(x, y, 16, s + 3));
      if (isMortar(x, y)) {
        // mortar sits back from the face: in shadow, and crumbling, just under
        // each brick (ly 7); the course above the next brick is the mortar's own colour
        const under = ly === 7 ? -14 + (hash2(x, y, s) - 0.5) * 14 : (hash2(x, y, s) - 0.5) * 3;
        P.set(x, y, mixRgb(mortar, [10, 10, 12], dampness * 0.4), under);
        continue;
      }
      const b = brickOf(bx, row);
      // a knocked-off corner shows as a hollow in the stone
      const corner = b.chip >= 0 && ((b.chip === 0 && lx < 3 && ly < 3 && lx + ly < 3) || (b.chip === 1 && lx > 12 && ly < 3 && (15 - lx) + ly < 4) ||
        (b.chip === 2 && lx < 3 && ly > 4 && lx + (7 - ly) < 3) || (b.chip === 3 && lx > 12 && ly > 4 && (15 - lx) + (7 - ly) < 4));
      let k = b.t + (vnoise(x, y, 4, s + 1) - 0.5) * 18 + (hash2(x, y, s + 2) - 0.5) * 12;
      // the stone's grain runs along the course
      k += Math.sin((x + b.t) * 0.9 + vnoise(x, y, 8, s + 5) * 6) * 2.5;
      // dressed faces catch the light on top and to the left, and fall into shadow below
      if (ly === 1) k += 16; else if (ly === 2) k += 6;
      if (lx === 1) k += 8;
      if (ly === 6) k -= 22; else if (ly === 5) k -= 7;
      if (lx === 14) k -= 14;
      if (corner) k -= 30;
      // pores and flecks
      const h = hash2(x, y, s + 9);
      if (h < b.pores * 0.006) k -= 26; else if (h > 0.985) k += 22;
      let c = mixRgb(wall, damp, dampness);
      c = [c[0] + b.warm, c[1], c[2] - b.warm];
      P.set(x, y, c, k);
    }
    // stains run down the face from a few joints, darker where water stands
    for (let i = 0; i < 4; i++) {
      let x = rng.int(0, TEX - 1);
      const y0 = rng.int(0, 30), len = rng.int(10, 30);
      for (let y = y0; y < Math.min(TEX, y0 + len); y++) {
        const [r, g, b] = P.get(x, y), a = 0.18 * (1 - (y - y0) / len);
        P.set(x, y, [r * (1 - a) + 18 * a, g * (1 - a) + 22 * a, b * (1 - a) + 18 * a]);
        if (rng.chance(0.15)) x = (x + rng.int(-1, 1) + TEX) % TEX;
      }
    }
    if (cracked) {
      // a crack running down through stone and mortar alike, the stone's colour beside it lit
      let x = rng.int(10, 50);
      for (let y = 0; y < TEX; y++) {
        P.set(x, y, [12, 10, 10]);
        if (x + 1 < TEX) { const c = P.get(x + 1, y); P.set(x + 1, y, c, 18); }
        if (rng.chance(0.45)) x = Math.max(1, Math.min(TEX - 2, x + rng.int(-1, 1)));
        if (rng.chance(0.08)) { const bx = Math.max(0, Math.min(TEX - 1, x + rng.int(-4, 4))); P.set(bx, y, hexToRgb(theme.accent)); }
      }
    }
    return P.done();
  }

  // The dark elves' halls: black stone laid true, in long blocks set so close
  // that the joints are a hairline, polished smooth and catching the light in
  // a cold sheen along the top of each; and on some, cut into the face and
  // filled with the violet of their lamps, a strand of web or a rune.
  function makeAshlar(theme, seed, cracked) {
    const rng = new Rng(seed), s = Math.floor(rng.next() * 1e6);
    const P = pixels(), wall = hexToRgb(theme.wall), joint = hexToRgb(theme.mortar), glow = hexToRgb(theme.accent);
    const block = new Map();
    const blockOf = (bx, row) => {
      const k = bx * 31 + row;
      if (!block.has(k)) block.set(k, { t: rng.int(-8, 8), carve: rng.chance(0.3) ? rng.int(0, 2) : -1 });
      return block.get(k);
    };
    for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
      const row = y >> 4, off = row & 1 ? 16 : 0, lx = (x + off) & 31, ly = y & 15, bx = (x + off) >> 5;
      if (ly === 0 || lx === 0) { P.set(x, y, joint, (hash2(x, y, s) - 0.5) * 4); continue; }
      const b = blockOf(bx, row);
      // polished: the light sits along the top and falls away below, no grain to speak of
      let k = b.t + (vnoise(x, y, 16, s + 1) - 0.5) * 8 + (hash2(x, y, s + 2) - 0.5) * 4 - Math.round(ly * 1.3);
      if (ly === 1) k += 22; else if (ly === 2) k += 10;
      if (lx === 1) k += 8; else if (lx === 31) k -= 16;
      if (ly === 15) k -= 18;
      // a faint diagonal sheen across the face
      if (((x + y * 2 + b.t * 3) & 31) < 2 && ly > 2 && ly < 13) k += 10;
      P.set(x, y, wall, k);
      // the carving: a strand of web fanned from a corner, or a rune of three strokes
      if (b.carve === 0 && ly > 2 && ly < 14 && lx > 2 && lx < 29) {
        const dx = lx - 3, dy = ly - 3, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
        if ((Math.abs(a - 0.25) < 0.05 || Math.abs(a - 0.75) < 0.05 || Math.abs(a - 1.25) < 0.06) && r < 12) P.set(x, y, mixRgb(wall, glow, 0.55), 6);
        else if ((Math.abs(r - 5) < 0.5 || Math.abs(r - 9) < 0.5) && a > 0.1 && a < 1.4) P.set(x, y, mixRgb(wall, glow, 0.45), 4);
      } else if (b.carve === 1 && ly > 3 && ly < 12) {
        if (lx === 14 || (lx === 16 && ly < 8) || (ly === 4 + Math.abs(lx - 15) && lx > 11 && lx < 19)) P.set(x, y, mixRgb(wall, glow, 0.6), 8);
      }
    }
    if (cracked) {
      // a crack through the black stone, violet light showing in the deepest of it
      let x = rng.int(12, 50);
      for (let y = 0; y < TEX; y++) {
        P.set(x, y, rng.chance(0.2) ? glow : [8, 6, 10]);
        if (x + 1 < TEX) P.set(x + 1, y, P.get(x + 1, y), 16);
        if (rng.chance(0.4)) x = Math.max(1, Math.min(TEX - 2, x + rng.int(-1, 1)));
      }
    }
    return P.done();
  }
  // The grey dwarves' hold: the living granite squared off in blocks as big as
  // a door, each face dressed with the chisel in rows of strokes, a bevel at
  // its edges; and across every course a band of dark iron, riveted, a glint
  // of copper at each rivet, that the dwarves set to hold the hold together.
  function makeGranite(theme, seed, cracked) {
    const rng = new Rng(seed), s = Math.floor(rng.next() * 1e6);
    const P = pixels(), wall = hexToRgb(theme.wall), joint = hexToRgb(theme.mortar), iron = [44, 46, 52], copper = [200, 122, 58];
    const block = new Map();
    const blockOf = (bx, row) => { const k = bx * 31 + row; if (!block.has(k)) block.set(k, { t: rng.int(-12, 10), warm: rng.int(-4, 4), slant: rng.chance(0.5) ? 1 : -1 }); return block.get(k); };
    for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
      const row = y >> 5, off = row & 1 ? 16 : 0, lx = (x + off) & 31, ly = y & 31, bx = (x + off) >> 5;
      // the iron band across the middle of each course, its edges lit and shadowed
      if (ly >= 20 && ly <= 25) {
        let k = (hash2(x, y, s + 7) - 0.5) * 6;
        if (ly === 20) k += 26; else if (ly === 25) k -= 24;
        const rivet = ((x + 4) & 15) < 3 && ly >= 21 && ly <= 24;
        if (rivet) P.set(x, y, ((x + 4) & 15) === 0 && ly === 21 ? copper : iron, ((x + 4) & 15) === 0 ? 40 : 22);
        else P.set(x, y, iron, k);
        continue;
      }
      if (ly === 0 || lx === 0 || ly === 31) { P.set(x, y, joint, (hash2(x, y, s) - 0.5) * 6 - 4); continue; }
      const b = blockOf(bx, row);
      let k = b.t + (vnoise(x, y, 6, s + 1) - 0.5) * 14 + (hash2(x, y, s + 2) - 0.5) * 14;
      // the chisel's strokes, in slanting rows across the face
      if (((lx * b.slant + ly * 2) & 3) === 0) k -= 9;
      // granite's flecks, pale and dark
      const h = hash2(x, y, s + 9);
      if (h > 0.97) k += 26; else if (h < 0.03) k -= 22;
      // the bevel: lit along the top and left of a block, shadowed at its foot and right
      if (ly === 1 || ly === 26) k += 18; else if (ly === 2 || ly === 27) k += 6;
      if (lx === 1) k += 12; else if (lx === 31) k -= 18;
      if (ly === 19 || ly === 30) k -= 22;
      P.set(x, y, [wall[0] + b.warm, wall[1], wall[2] - b.warm], k);
    }
    if (cracked) {
      // a crack through block and band alike, the band's iron sprung where it crosses
      let x = rng.int(10, 50);
      for (let y = 0; y < TEX; y++) {
        P.set(x, y, [10, 9, 8]);
        if (x + 1 < TEX) P.set(x + 1, y, P.get(x + 1, y), 18);
        if (rng.chance(0.45)) x = Math.max(1, Math.min(TEX - 2, x + rng.int(-1, 1)));
      }
    }
    return P.done();
  }

  // The lizardfolk's marsh: walls of wattle, bundles of reeds stood on end and
  // lashed with cord, and mud daubed over them in great smears that have dried
  // and cracked, the reeds showing through where it has fallen away; damp and
  // green at the foot, where the water stands.
  function makeReed(theme, seed, cracked) {
    const rng = new Rng(seed), s = Math.floor(rng.next() * 1e6);
    const P = pixels(), reed = hexToRgb(theme.wall), mud = mixRgb(reed, [92, 74, 52], 0.6), cord = [70, 54, 32], slime = [44, 70, 36];
    const bundle = Array.from({ length: 16 }, () => rng.int(-14, 12));
    for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
      const b = x >> 2, lx = x & 3;
      // the reeds: each bundle its own tone, each stem lit down its left, a node now and then
      let k = bundle[b] + (lx === 0 ? 10 : lx === 3 ? -14 : 0) + (hash2(x, y, s) - 0.5) * 8 + Math.sin(y * 0.35 + b * 2.1) * 3;
      if (hash2(b, y >> 3, s + 3) > 0.86 && (y & 7) === 0) k -= 18;
      let c = reed;
      // the lashings: two turns of cord across every course
      const ly = y & 15;
      if (ly === 7 || ly === 8) { c = cord; k = (ly === 7 ? 8 : -12) + (hash2(x, y, s + 1) - 0.5) * 8; }
      // the daub over it, thick in smears, cracked as it dried
      const daub = vnoise(x, y, 14, s + 5);
      if (daub > 0.42) {
        c = mud; k = (vnoise(x, y, 5, s + 6) - 0.5) * 16 + (hash2(x, y, s + 7) - 0.5) * 8 + (daub < 0.47 ? -14 : 0);
        if (vnoise(x, y, 4, s + 8) > 0.83) k -= 24;   // a crack in the dried mud
      }
      // damp and green at the foot
      const foot = Math.max(0, (y - 44) / 20);
      if (foot > 0) c = mixRgb(c, slime, foot * (0.5 + 0.5 * vnoise(x, y, 6, s + 9)));
      P.set(x, y, c, k);
    }
    if (cracked) {
      // a great piece of the daub has fallen away, and the reeds behind it have split
      const cx = rng.int(16, 48), cy = rng.int(14, 40);
      for (let y = cy - 10; y < cy + 12; y++) for (let x = cx - 9; x < cx + 9; x++) {
        if ((x - cx) ** 2 / 81 + (y - cy) ** 2 / 121 > 1 || x < 0 || y < 0 || x >= TEX || y >= TEX) continue;
        P.set(x, y, (x & 3) === 1 ? [16, 14, 10] : reed, (x & 3) === 0 ? 6 : -20);
      }
    }
    return P.done();
  }

  /** Flagstones: big worn slabs, uneven, with grime in the joints and a crack or two. */
  function makeFlags(theme, seed) {
    const rng = new Rng(seed), s = Math.floor(rng.next() * 1e6);
    const P = pixels(), floor = hexToRgb(theme.floor), grime = mixRgb(floor, [8, 8, 8], 0.6);
    const n = 4, sz = TEX / n, slab = [];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) slab.push({ t: rng.int(-12, 10), tilt: rng.int(-6, 6), crack: rng.chance(0.3) });
    for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
      const i = Math.floor(x / sz), j = Math.floor(y / sz), lx = x - i * sz, ly = y - j * sz, sl = slab[j * n + i];
      // the joints wander a pixel: no mason laid these to a rule
      const jitter = vnoise(x, y, 8, s + 7) > 0.62 ? 1 : 0;
      if (lx < 1 + jitter || ly < 1 + (jitter ^ 1) || lx === sz - 1 || ly === sz - 1) { P.set(x, y, grime, (hash2(x, y, s) - 0.5) * 10); continue; }
      let k = sl.t + (vnoise(x, y, 6, s + 1) - 0.5) * 16 + (hash2(x, y, s + 2) - 0.5) * 10 + sl.tilt * (lx / sz - 0.5);
      // worn smooth and pale in the middle where feet go, dark at the edges
      const edge = Math.min(lx, ly, sz - 1 - lx, sz - 1 - ly);
      if (edge <= 1) k -= 10; else if (edge >= 4) k += 4;
      if (ly === 1 + (jitter ^ 1)) k += 8;
      const h = hash2(x, y, s + 4);
      if (h < 0.03) k -= 20; else if (h > 0.985) k += 18;
      P.set(x, y, floor, k);
    }
    // cracks across a few slabs
    slab.forEach((sl, idx) => {
      if (!sl.crack) return;
      const i = idx % n, j = Math.floor(idx / n);
      let x = i * sz + rng.int(3, sz - 4), y = j * sz + 2;
      while (y < (j + 1) * sz - 2) { P.set(x, y, grime, -10); y++; if (rng.chance(0.5)) x = Math.max(i * sz + 2, Math.min((i + 1) * sz - 3, x + rng.int(-1, 1))); }
    });
    // grit scattered over it
    for (let k = 0; k < 18; k++) { const x = rng.int(0, TEX - 1), y = rng.int(0, TEX - 1); P.set(x, y, floor, rng.int(-26, 26)); }
    return P.done();
  }

  /** The roof of the place: rough-hewn rock, cracked, dark with damp in patches. */
  function makeRock(theme, seed) {
    const rng = new Rng(seed), s = Math.floor(rng.next() * 1e6);
    const P = pixels(), ceil = hexToRgb(theme.ceil);
    for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
      const big = vnoise(x, y, 16, s), mid = vnoise(x, y, 6, s + 1), fine = hash2(x, y, s + 2);
      // chisel marks: facets where the rock was cut, each lit a little differently
      const facet = Math.floor(vnoise(x, y, 10, s + 3) * 5) * 4 - 8;
      P.set(x, y, ceil, (big - 0.5) * 18 + (mid - 0.5) * 12 + (fine - 0.5) * 10 + facet);
    }
    // one faint crack: more, repeated on every square of the roof, read as a net
    let x = rng.int(0, TEX - 1);
    for (let y = rng.int(0, 20), end = y + rng.int(20, 40); y < Math.min(TEX, end); y++) { const c = P.get(x, y); P.set(x, y, c, -14); if (rng.chance(0.5)) x = (x + rng.int(-1, 1) + TEX) % TEX; }
    return P.done();
  }

  // ---- what a place is laid with, roofed with and built of (see looks.js) ----
  /** A painted texture's pixels, to paint over again. */
  function copyOf(src) {
    const P = pixels();
    P.ctx.drawImage(src, 0, 0);
    const d = P.ctx.getImageData(0, 0, TEX, TEX).data;
    for (let i = 0; i < TEX * TEX; i++) P.set(i % TEX, (i / TEX) | 0, [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]]);
    return P;
  }
  /**
   * The way between rooms: small setts worn smooth by feet, darker than a
   * room's flags, with grime packed between them; down a dug tunnel, earth
   * trodden hard with gravel pressed into it.
   */
  function makePath(theme, seed) {
    const rng = new Rng(seed), s = Math.floor(rng.next() * 1e6);
    const P = pixels(), base = hexToRgb(theme.floor), grime = mixRgb(base, [6, 6, 6], 0.65);
    if (theme.face === 'earth') {
      for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
        let k = (vnoise(x, y, 8, s) - 0.5) * 14 + (hash2(x, y, s + 1) - 0.5) * 10 - 8;
        const g = hash2(x >> 1, y >> 1, s + 2);
        if (g < 0.05) k += 20; else if (hash2(x >> 1, (y - 1) >> 1, s + 2) < 0.05) k -= 14;
        P.set(x, y, base, k);
      }
      return P.done();
    }
    for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
      const row = y >> 3, off = row & 1 ? 4 : 0, lx = (x + off) & 7, ly = y & 7, col = ((x + off) >> 3) & 7;
      if (lx === 0 || ly === 0) { P.set(x, y, grime, (hash2(x, y, s) - 0.5) * 8); continue; }
      const tone = hash2(col, row, s + 3);
      let k = (tone - 0.5) * 22 + (vnoise(x, y, 4, s + 4) - 0.5) * 10 + (hash2(x, y, s + 5) - 0.5) * 8 - 4;
      // each sett is domed: lit along its top, dark at its foot and in its corners
      if (ly === 1) k += 9; else if (ly === 7) k -= 12;
      if ((lx === 1 || lx === 7) && (ly === 1 || ly === 7)) k -= 12;
      P.set(x, y, base, k);
    }
    return P.done();
  }
  /**
   * A shrine's floor: tesserae set in a border and a lozenge, some long gone
   * from their bed; and at its heart the altar, a slab carved with a ring of
   * marks, worn hollow in the middle where the offerings were laid.
   */
  function makeMosaic(theme, seed, altar) {
    const rng = new Rng(seed), s = Math.floor(rng.next() * 1e6);
    const P = pixels(), fl = hexToRgb(theme.floor), ac = hexToRgb(theme.accent);
    const field = mixRgb(fl, [176, 166, 148], 0.14), acc = mixRgb(mixRgb(ac, fl, 0.45), [0, 0, 0], 0.15), dark = mixRgb(fl, [0, 0, 0], 0.35), grout = mixRgb(fl, [0, 0, 0], 0.22);
    for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
      const tx = x >> 2, ty = y >> 2, lx = x & 3, ly = y & 3;
      if (lx === 3 || ly === 3 || hash2(tx, ty, s + 5) < 0.05) { P.set(x, y, grout, (hash2(x, y, s) - 0.5) * 8); continue; }
      const d = Math.abs(tx - 7.5) + Math.abs(ty - 7.5);
      const c = tx === 0 || ty === 0 || tx === 15 || ty === 15 ? dark : tx === 1 || ty === 1 || tx === 14 || ty === 14 || d === 6 || d <= 1 ? acc : field;
      const k = (hash2(tx, ty, s) - 0.5) * 12 + (vnoise(x, y, 16, s + 1) - 0.5) * 12 + (lx === 0 && ly === 0 ? 6 : 0) + (lx === 2 || ly === 2 ? -5 : 0);
      P.set(x, y, c, k);
    }
    if (altar) {
      const stone = mixRgb(hexToRgb(theme.wall), fl, 0.25);
      // its shadow first, thrown down and to the right, then the slab
      for (let y = 12; y < 56; y++) for (let x = 12; x < 56; x++) { const c = P.get(x, y); P.set(x, y, mixRgb(c, [0, 0, 0], 0.55)); }
      for (let y = 9; y < 53; y++) for (let x = 9; x < 53; x++) {
        const r = Math.hypot(x - 30.5, y - 30.5);
        let k = (vnoise(x, y, 6, s + 7) - 0.5) * 14 + (hash2(x, y, s + 8) - 0.5) * 8;
        if (x < 11 || y < 11) k += 22; else if (x > 50 || y > 50) k -= 26;
        if (Math.abs(r - 15) < 1.1) k -= 30;
        if (r < 6) k -= (6 - r) * 4;
        P.set(x, y, stone, k);
      }
      // the marks round the ring, cut in and filled with the place's own colour
      for (let m = 0; m < 10; m++) {
        const a = m / 10 * Math.PI * 2, cx = 30.5 + Math.cos(a) * 19, cy = 30.5 + Math.sin(a) * 19;
        for (let j = -2; j <= 2; j++) P.set(Math.round(cx + Math.cos(a + m) * j * 0.6), Math.round(cy + Math.sin(a + m) * j), mixRgb(ac, [0, 0, 0], 0.3));
      }
    }
    return P.done();
  }
  /** A cistern's floor: flags under a hand's depth of still, black water that catches the light in its ripples. */
  function makeWaterFloor(theme, seed) {
    const s = 4471, P = copyOf(makeFlags(theme, seed)), water = [14, 34, 46];
    for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
      const v = vnoise(x, y, 12, s), ridge = 1 - Math.abs(2 * v - 1), c = P.get(x, y);
      let out = mixRgb(c, water, 0.62);
      if (ridge > 0.9) out = mixRgb(out, [120, 160, 175], (ridge - 0.9) * 2.4);
      if (hash2(x, y, s + 1) > 0.994) out = mixRgb(out, [210, 230, 235], 0.6);
      P.set(x, y, out);
    }
    return P.done();
  }
  /** Where the roof came down: the flags cracked under it, chips of stone everywhere, pale dust over all. */
  function makeRubbleFloor(theme, seed) {
    const rng = new Rng(seed + 'r'), s = 6211, P = copyOf(makeFlags(theme, seed)), stone = hexToRgb(theme.wall);
    for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
      const v = vnoise(x, y, 10, s);
      if (v > 0.6) P.set(x, y, mixRgb(P.get(x, y), [150, 142, 128], (v - 0.6) * 0.5));
    }
    for (let i = 0; i < 26; i++) {
      const x = rng.int(0, TEX - 4), y = rng.int(0, TEX - 4), w = rng.int(1, 4), h = rng.int(1, 3), t = rng.int(-14, 16);
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) P.set(x + xx, y + yy, stone, t + (yy === 0 ? 12 : 0) - 10);
      for (let xx = 0; xx <= w; xx++) P.set((x + xx) & (TEX - 1), (y + h) & (TEX - 1), mixRgb(P.get((x + xx) & (TEX - 1), (y + h) & (TEX - 1)), [0, 0, 0], 0.5));
    }
    return P.done();
  }
  /** A cell's floor: the flags under old straw, matted in heaps where someone slept. */
  function makeStraw(theme, seed) {
    const rng = new Rng(seed + 's'), P = copyOf(makeFlags(theme, seed));
    // (old straw, grey-gold and rotting, not fresh from the field)
    const STRAW = [[104, 86, 48], [88, 70, 38], [120, 100, 60], [70, 56, 32]];
    const heaps = [0, 1, 2].map(() => [rng.int(0, TEX - 1), rng.int(0, TEX - 1)]);
    for (let i = 0; i < 280; i++) {
      const [hx, hy] = heaps[i % 3], r = rng.next() * 26;
      const a0 = rng.next() * Math.PI * 2, x0 = hx + Math.cos(a0) * r, y0 = hy + Math.sin(a0) * r;
      const a = rng.next() * Math.PI, len = rng.int(4, 9), c = STRAW[rng.int(0, 3)];
      for (let j = 0; j < len; j++) {
        const x = ((Math.round(x0 + Math.cos(a) * j) % TEX) + TEX) % TEX, y = ((Math.round(y0 + Math.sin(a) * j) % TEX) + TEX) % TEX;
        P.set(x, y, c, (j === 0 ? 10 : 0) + rng.int(-8, 8));
        const ys = (y + 1) % TEX;
        P.set(x, ys, mixRgb(P.get(x, ys), [0, 0, 0], 0.25));
      }
    }
    return P.done();
  }
  /**
   * A roof with beams across it: timber in a hall or a propped tunnel, a
   * rib of dressed stone where the dead are kept, and of black glass in the
   * Sanctum. The beam runs across the square, and the rock either side of it
   * is in its shadow.
   */
  function makeBeams(theme, seed) {
    const s = 3307, P = copyOf(makeRock(theme, seed));
    const y0 = 26, y1 = 38;
    for (let y = y0 - 3; y < y1 + 3; y++) for (let x = 0; x < TEX; x++) {
      if (y < y0 || y >= y1) { P.set(x, y, mixRgb(P.get(x, y), [0, 0, 0], 0.45)); continue; }
      const ly = y - y0;
      let c, k;
      if (theme.face === 'bones') { c = hexToRgb(theme.wall); k = (x & 15) === 0 ? -40 : (hash2(x, y, s) - 0.5) * 14 + (vnoise(x, y, 6, s + 1) - 0.5) * 16 - 18; }
      else if (theme.face === 'glass') { c = hexToRgb(theme.wall); k = ly === 5 || ly === 6 ? 40 : (vnoise(x, y, 16, s + 2) - 0.5) * 10 - 10; if (ly === 5) c = hexToRgb(theme.accent); }
      else { c = [66, 46, 28]; k = Math.sin(y * 1.9 + vnoise(x, y, 12, s + 3) * 7) * 5 + (hash2(x, y, s + 4) - 0.5) * 8 - 10; }
      // its sides in shadow, its underside lit by whatever burns below
      if (ly === 0 || ly === 11) k -= 26; else if (ly === 1 || ly === 10) k -= 10; else if (ly > 3 && ly < 8) k += 6;
      P.set(x, y, c, k);
    }
    return P.done();
  }
  /** A roof the roots of the world above have broken through, hanging in tangles. */
  function makeRootRoof(theme, seed) {
    const rng = new Rng(seed + 'roots'), P = copyOf(makeRock(theme, seed));
    // (darker than the roots breaking through a wall: up here no torch reaches them)
    const RC = [[22, 16, 10], [36, 26, 16], [50, 38, 24]];
    const grow = (x, y, a, len, thick) => {
      for (let i = 0; i < len; i++) {
        const w = Math.max(1, Math.round(thick * (1 - i / len) + 0.4));
        for (let t = 0; t < w; t++) {
          const px0 = ((Math.round(x - Math.sin(a) * t) % TEX) + TEX) % TEX, py0 = ((Math.round(y + Math.cos(a) * t) % TEX) + TEX) % TEX;
          P.set(px0, py0, RC[t === 0 ? 2 : t === w - 1 ? 0 : 1], rng.int(-6, 6));
        }
        x += Math.cos(a); y += Math.sin(a); a += (rng.next() - 0.5) * 0.5;
        if (thick > 1.5 && rng.chance(0.08)) grow(x, y, a + (rng.chance(0.5) ? 0.9 : -0.9), Math.round((len - i) * 0.5), thick * 0.55);
      }
    };
    for (let k = 0; k < 3; k++) grow(rng.int(0, TEX - 1), rng.int(0, TEX - 1), rng.next() * Math.PI * 2, rng.int(26, 44), rng.next() * 1.5 + 3.6);
    return P.done();
  }
  /** A cavern's roof: lumpy, never cut, darker, lit only on the undersides of its bulges. */
  function makeCaveRoof(theme, seed) {
    const rng = new Rng(seed + 'cave'), s = Math.floor(rng.next() * 1e6), P = pixels(), ceil = hexToRgb(theme.ceil);
    const height = (x, y) => vnoise(x, y, 16, s) * 0.6 + vnoise(x, y, 8, s + 1) * 0.4;
    for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
      const hgt = height(x, y), slope = hgt - height(x, (y + TEX - 1) % TEX);
      P.set(x, y, ceil, (hgt - 0.5) * 40 + slope * 260 + (hash2(x, y, s + 2) - 0.5) * 8 - 6 - (hgt < 0.35 ? (0.35 - hgt) * 120 : 0));
    }
    return P.done();
  }
  /**
   * Bare rock, as a cavern was found: broken into facets the way stone splits,
   * each turned its own way to the light, black in the cracks between them,
   * wet and dark toward the floor.
   */
  function makeCaveWall(theme, seed) {
    const rng = new Rng(seed), s = Math.floor(rng.next() * 1e6), P = pixels();
    const rock = mixRgb(hexToRgb(theme.wall), [62, 58, 54], 0.35), wet = mixRgb(rock, [20, 24, 22], 0.6);
    // the facets: a point each, the stone nearest it its own, and a slant to the light (lit from above, mostly)
    const facets = [];
    for (let i = 0; i < 26; i++) facets.push({ x: rng.next() * TEX, y: rng.next() * TEX, gx: (rng.next() - 0.5) * 1.6, gy: -0.4 - rng.next() * 1.2, t: rng.int(-14, 12) });
    for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
      let d1 = Infinity, d2 = Infinity, f = facets[0];
      for (const q of facets) {
        // (across the edges too, so the wall runs on into the next square)
        let dx = Math.abs(x - q.x), dy = Math.abs(y - q.y);
        if (dx > TEX / 2) dx = TEX - dx;
        if (dy > TEX / 2) dy = TEX - dy;
        const d = Math.hypot(dx, dy);
        if (d < d1) { d2 = d1; d1 = d; f = q; } else if (d < d2) d2 = d;
      }
      let dx = x - f.x, dy = y - f.y;
      if (dx > TEX / 2) dx -= TEX; else if (dx < -TEX / 2) dx += TEX;
      if (dy > TEX / 2) dy -= TEX; else if (dy < -TEX / 2) dy += TEX;
      let k = f.t + dx * f.gx + dy * f.gy + (vnoise(x, y, 4, s) - 0.5) * 12 + (hash2(x, y, s + 3) - 0.5) * 8;
      // the crack between two facets, and the lip of the lower one catching the light
      const gap = d2 - d1;
      if (gap < 1.2) k -= 46; else if (gap < 2.2) k += dy < 0 ? 14 : -14;
      const damp = Math.max(0, (y - 42) / 22);
      P.set(x, y, mixRgb(rock, wet, damp), k);
    }
    return P.done();
  }
  /** Masonry that has come down: dressed blocks lying every way in a heap that reaches the broken roof, dust on their tops. */
  function makeFallen(theme, seed) {
    const rng = new Rng(seed), s = 5099, P = pixels(), stone = mixRgb(hexToRgb(theme.wall), [0, 0, 0], 0.12), gap = [10, 9, 9];
    for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) P.set(x, y, gap);
    // course by course, but nothing lies true: each block its own size, tipped, sunk or proud of the next
    let y = 4;
    while (y < TEX) {
      const h = rng.int(5, 9);
      let x = rng.int(0, 6);
      while (x < TEX + 6) {
        const w = rng.int(6, 15), t = rng.int(-20, 14), tilt = (rng.next() - 0.5) * 0.4, sink = rng.int(-1, 2);
        if (!rng.chance(0.08)) {
          for (let yy = 0; yy < h - 1; yy++) for (let xx = 0; xx < w - 1; xx++) {
            const py = y + yy + sink + Math.round((xx - w / 2) * tilt);
            if (py < 0 || py >= TEX) continue;
            let k = t + (vnoise(x + xx, py, 4, s + 1) - 0.5) * 14 + (hash2(x + xx, py, s + 2) - 0.5) * 10;
            if (yy === 0) k += 26; else if (yy === 1) k += 8; else if (yy === h - 2) k -= 26;
            if (xx === 0) k += 6; else if (xx === w - 2) k -= 20;
            const c = yy === 0 && hash2(x + xx, py, s + 3) < 0.5 ? [150, 142, 128] : stone;
            P.set((x + xx) % TEX, py, c, k);
          }
        }
        x += w;
      }
      y += h - 1;
    }
    // the roof's broken edge, ragged across the top
    for (let x = 0; x < TEX; x++) { const d = 2 + Math.round(vnoise(x, 0, 8, s + 3) * 5); for (let yy = 0; yy < d; yy++) P.set(x, yy, [8, 7, 7]); }
    return P.done();
  }
  /** A pillar of the living rock, left where the diggers went round it: rounded by shadow, but never dressed. */
  function makeRockPillar(rock) {
    const c = canvas(TEX, TEX), ctx = c.getContext('2d');
    ctx.drawImage(rock, 0, 0);
    for (let x = 0; x < TEX; x++) {
      const off = (x + 0.5) / TEX - 0.42;
      ctx.fillStyle = `rgba(0,0,0,${Math.min(0.62, off * off * 3.2).toFixed(3)})`;
      ctx.fillRect(x, 0, 1, TEX);
    }
    return c;
  }
  /** A wall where the damp has got in: the stone dark and wet at its foot, moss climbing it. */
  function makeDampWall(theme, wall, seed) {
    const c = canvas(TEX, TEX), ctx = c.getContext('2d'), rng = new Rng(seed);
    ctx.drawImage(wall, 0, 0);
    const g = ctx.createLinearGradient(0, 40, 0, TEX);
    g.addColorStop(0, 'rgba(8,14,12,0)'); g.addColorStop(1, 'rgba(8,14,12,0.45)');
    ctx.fillStyle = g; ctx.fillRect(0, 40, TEX, TEX - 40);
    if (theme.face !== 'glass') moss(ctx, rng, true);
    return c;
  }
  /**
   * A cell's door: a gate of iron bars in a stone frame, and only darkness
   * behind them, since nothing in a cell is seen until it is opened.
   */
  function makeCellDoor(theme, wallTex, lockColor) {
    const s = 2287, P = copyOf(wallTex);
    for (let y = 2; y < TEX; y++) for (let x = 6; x < 58; x++) {
      if (x < 8 || x > 55 || y < 4) { P.set(x, y, [26, 22, 20], (hash2(x, y, s) - 0.5) * 8); continue; }
      // the gloom inside, a little less black low down where the floor is
      P.set(x, y, [8, 8, 10], (y > 48 ? (y - 48) * 0.8 : 0) + (hash2(x, y, s + 1) - 0.5) * 4);
    }
    const iron = [70, 72, 80];
    const bar = (x, y) => { const lx = (x - 9) % 6; P.set(x, y, iron, (lx === 0 ? 30 : lx === 2 ? -24 : 0) + (hash2(x, y, s + 2) - 0.5) * 10); };
    for (let x = 9; x < 55; x++) if ((x - 9) % 6 < 3) for (let y = 4; y < TEX; y++) bar(x, y);
    for (const y0 of [10, 50]) for (let y = y0; y < y0 + 4; y++) for (let x = 8; x < 56; x++) {
      P.set(x, y, iron, (y === y0 ? 34 : y === y0 + 3 ? -20 : 0) + (vnoise(x, y, 4, s + 3) - 0.5) * 12);
    }
    // rust run down from the crossbars
    for (let x = 9; x < 55; x += 3) for (let k = 0; k < 2 + (x % 5); k++) { const c = P.get(x, 54 + k); P.set(x, 54 + k, mixRgb(c, [120, 56, 28], 0.4)); }
    // the lock: a heavy box on the bars, in its key's colour when it wants one
    const lc = lockColor ? hexToRgb(lockColor) : [58, 60, 66];
    for (let y = 26; y < 38; y++) for (let x = 40; x < 52; x++) {
      const edge = x === 40 || x === 51 || y === 26 || y === 37;
      P.set(x, y, edge ? [30, 30, 36] : lc, edge ? 0 : (y === 27 ? 30 : y === 36 ? -24 : 0) + (hash2(x, y, s + 4) - 0.5) * 10);
    }
    for (const [x, y] of [[45, 30], [46, 30], [45, 31], [46, 31], [45, 32], [45, 33], [46, 33]]) P.set(x, y, [10, 8, 8]);
    return P.done();
  }
  /** A web strung across a corner where wall meets wall and roof: the corner at the left, the roof along the top. */
  let webArt = null;
  function web() {
    if (webArt) return webArt;
    webArt = canvas(32, 32);
    const ctx = webArt.getContext('2d');
    ctx.strokeStyle = 'rgba(214,214,220,0.5)'; ctx.lineWidth = 1;
    for (let k = 0; k <= 5; k++) {
      const a = k / 5 * Math.PI / 2;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 34, Math.sin(a) * 34); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(214,214,220,0.32)';
    for (const r of [7, 13, 20, 27]) {
      ctx.beginPath();
      for (let k = 0; k <= 5; k++) {
        const a = k / 5 * Math.PI / 2, rr = r - (k % 2) * 1.5;
        if (k === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.stroke();
    }
    return webArt;
  }

  /** A plank door in a dark frame: grained oak, iron bands riveted across, rust bleeding from them. */
  function makePlankDoor(theme, wallTex, lockColor) {
    const s = 9137, P = pixels();
    P.ctx.drawImage(wallTex, 0, 0);
    const src = P.ctx.getImageData(0, 0, TEX, TEX).data;
    for (let i = 0; i < TEX * TEX; i++) { const x = i % TEX, y = (i / TEX) | 0; P.set(x, y, [src[i * 4], src[i * 4 + 1], src[i * 4 + 2]]); }
    const oak = [[122, 86, 50], [107, 74, 42], [116, 80, 46], [100, 70, 40], [118, 84, 48], [110, 76, 44]];
    for (let y = 2; y < TEX; y++) for (let x = 6; x < 58; x++) {
      // the frame: a deep reveal, darker at the top where the lintel shades it
      if (x < 8 || x > 55 || y < 4) { P.set(x, y, [26, 20, 16], (hash2(x, y, s) - 0.5) * 8 - (y < 4 ? 4 : 0)); continue; }
      const p = Math.floor((x - 8) / 8), lx = (x - 8) % 8;
      // grain: lines that wander down each plank, with a knot or two to bend round
      const knot = Math.hypot(lx - 4, (y + p * 17) % 37 - 18) < 2.2;
      const grain = Math.sin(lx * 1.7 + vnoise(x, y, 8, s + p) * 9 + p * 2.3);
      let k = grain * 7 + (hash2(x, y, s + 1) - 0.5) * 8 + (vnoise(x, y, 16, s + 2) - 0.5) * 10;
      if (lx === 0) k -= 34; else if (lx === 1) k += 10; else if (lx === 7) k -= 12;
      if (knot) k -= 22 + (Math.hypot(lx - 4, (y + p * 17) % 37 - 18) < 1 ? 14 : 0);
      // worn pale at hand height near the handle, dark with grime at the foot
      if (y > 58) k -= (y - 58) * 4;
      P.set(x, y, oak[p], k);
    }
    // iron bands: a face, a lit top edge, a shadow under, rivets with their glints, rust run below
    for (const y0 of [12, 46]) {
      for (let y = y0; y < y0 + 6; y++) for (let x = 8; x < 56; x++) {
        const k = (y === y0 ? 34 : y === y0 + 5 ? -16 : 0) + (hash2(x, y, s + 3) - 0.5) * 10 + (vnoise(x, y, 4, s + 4) - 0.5) * 12;
        P.set(x, y, [74, 78, 86], k);
      }
      for (let x = 8; x < 56; x++) { const c = P.get(x, y0 + 6); P.set(x, y0 + 6, c, -26); }
      for (let x = 12; x < 56; x += 10) {
        P.set(x, y0 + 2, [168, 172, 180]); P.set(x + 1, y0 + 2, [130, 134, 142]); P.set(x, y0 + 3, [96, 100, 108]); P.set(x + 1, y0 + 3, [40, 42, 48]);
        for (let k = 0; k < 3 + (x % 4); k++) { const c = P.get(x + (k % 2), y0 + 7 + k); P.set(x + (k % 2), y0 + 7 + k, mixRgb(c, [120, 56, 28], 0.35)); }
      }
    }
    if (lockColor) {
      const lc = hexToRgb(lockColor);
      for (let y = 27; y < 43; y++) for (let x = 38; x < 52; x++) {
        const edge = x === 38 || x === 51 || y === 27 || y === 42;
        P.set(x, y, edge ? [36, 36, 42] : lc, edge ? 0 : (y === 28 ? 30 : y === 41 ? -24 : 0) + (x === 39 ? 14 : x === 50 ? -14 : 0) + (hash2(x, y, s + 6) - 0.5) * 10);
      }
      for (const [x, y] of [[44, 31], [45, 31], [44, 32], [45, 32], [44, 33], [45, 33], [44.5, 34], [44, 35], [45, 35], [44, 36], [45, 36], [44, 37], [45, 37]]) P.set(Math.floor(x), y, [10, 8, 8]);
      for (const [x, y] of [[40, 29], [49, 29], [40, 40], [49, 40]]) P.set(x, y, [200, 204, 210]);
    } else {
      // an iron ring for a handle on a round plate
      for (let y = 26; y < 40; y++) for (let x = 38; x < 52; x++) {
        const d = Math.hypot(x - 44.5, y - 32.5);
        if (d < 3.2) P.set(x, y, [60, 62, 70], (y < 32 ? 26 : -10));
        else if (Math.abs(d - 5.2) < 0.9 && y > 31) P.set(x, y, [118, 122, 132], y < 35 ? 30 : -6);
      }
    }
    return P.done();
  }

  /** A stair through an arch of cut stone: down into the dark, or up toward a grey light. */
  function makeArchStairs(theme, wallTex, down) {
    const s = down ? 4421 : 8812, P = pixels(), stone = hexToRgb(theme.wall);
    P.ctx.drawImage(wallTex, 0, 0);
    const src = P.ctx.getImageData(0, 0, TEX, TEX).data;
    for (let i = 0; i < TEX * TEX; i++) P.set(i % TEX, (i / TEX) | 0, [src[i * 4], src[i * 4 + 1], src[i * 4 + 2]]);
    const inArch = (x, y, r) => y >= 20 ? Math.abs(x - 31.5) <= r : Math.hypot((x - 31.5) / r, (y - 20) / 22) <= 1;
    for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
      if (inArch(x, y, 24) && !inArch(x, y, 21)) {
        // the arch's voussoirs: wedges of dressed stone radiating from the curve
        const a = Math.atan2(y - 20, x - 31.5), seg = Math.floor((a + Math.PI) / (Math.PI / 9)), edge = Math.abs(((a + Math.PI) / (Math.PI / 9)) % 1 - 0.5) > 0.44;
        P.set(x, y, stone, edge && y < 22 ? -40 : 14 + (seg % 2) * 8 + (hash2(x, y, s) - 0.5) * 14 + (inArch(x, y, 22.4) ? -12 : 4));
      } else if (inArch(x, y, 21)) P.set(x, y, [5, 5, 8], (hash2(x, y, s + 1) - 0.5) * 4);
    }
    // the treads, stone, lit at the nose, each narrower as it goes
    const steps = 7;
    for (let i = 0; i < steps; i++) {
      const y = down ? 30 + i * 5 : 60 - i * 6, h = down ? 5 : 6, inset = 4 + i * 2, light = down ? 1 - i * 0.13 : 0.35 + i * 0.1;
      for (let yy = y; yy < Math.min(TEX, y + h); yy++) for (let x = 14 + inset; x < 50 - inset; x++) {
        const nose = yy === y, k = (hash2(x, yy, s + 2) - 0.5) * 12 + (vnoise(x, yy, 4, s + 3) - 0.5) * 10 + (nose ? 26 : yy === y + h - 1 ? -18 : 0);
        P.set(x, yy, stone.map(v => v * light), k * light);
      }
    }
    if (!down) {
      // grey daylight spilling down from the top of the climb
      for (let y = 6; y < 30; y++) for (let x = 18; x < 46; x++) {
        if (!inArch(x, y, 21)) continue;
        const a = Math.max(0, 0.42 - Math.hypot(x - 31.5, y - 14) / 26), c = P.get(x, y);
        P.set(x, y, mixRgb(c, [236, 228, 200], a));
      }
    }
    return P.done();
  }

  // ---- the stairwell, drawn in depth (renderer.js: drawStairs) ----
  // A stair square is a recess behind an arch: the arch at the wall's face with
  // its opening clear, the recess's own side walls in the walls' stone, and on
  // its back wall the flight going on in perspective. The opening's width, as a
  // share of the square, is STAIR_OPEN either side of the middle.
  const STAIR_OPEN = 21 / 64;
  /** The arch at the stair's face: dressed voussoirs round an opening left clear. */
  function makeStairArch(theme, wallTex) {
    const s = 7713, P = pixels(), stone = hexToRgb(theme.wall);
    P.ctx.drawImage(wallTex, 0, 0);
    const src = P.ctx.getImageData(0, 0, TEX, TEX).data;
    for (let i = 0; i < TEX * TEX; i++) P.set(i % TEX, (i / TEX) | 0, [src[i * 4], src[i * 4 + 1], src[i * 4 + 2]]);
    const inArch = (x, y, r) => y >= 20 ? Math.abs(x - 31.5) <= r : Math.hypot((x - 31.5) / r, (y - 20) / 22) <= 1;
    for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
      if (inArch(x, y, 24) && !inArch(x, y, 21)) {
        const a = Math.atan2(y - 20, x - 31.5), seg = Math.floor((a + Math.PI) / (Math.PI / 9)), edge = Math.abs(((a + Math.PI) / (Math.PI / 9)) % 1 - 0.5) > 0.44;
        P.set(x, y, stone, edge && y < 22 ? -40 : 14 + (seg % 2) * 8 + (hash2(x, y, s) - 0.5) * 14 + (inArch(x, y, 22.4) ? -12 : 4));
      }
    }
    const c = P.done(), ctx = c.getContext('2d'), img = ctx.getImageData(0, 0, TEX, TEX);
    // the opening: clear, so the stairwell behind shows through it
    for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) if (inArch(x, y, 21)) img.data[(y * TEX + x) * 4 + 3] = 0;
    ctx.putImageData(img, 0, 0);
    return c;
  }
  /**
   * The back of the recess: the flight going on beyond it, in perspective, as
   * seen from a square or two off. Up, the treads climb toward a grey light
   * and the roof rises with them; down, the first tread's nose shows at the
   * foot, the roof slopes away below and there is only a far, faint glow.
   */
  function makeStairBack(theme, down) {
    const c = canvas(TEX, TEX), ctx = c.getContext('2d'), rng = new Rng(down ? 'stairback-d' : 'stairback-u');
    const D0 = 1.4, W = TEX / (2 * STAIR_OPEN);   // how far off it is seen from, in squares; texture pixels to a square, across
    // a point of the stairwell: lateral (squares from the middle), height (floor 0, roof 1), and how far beyond the back
    const at = (xw, h, z) => { const k = 1 / (1 + z / D0); return [TEX / 2 + xw * W * k, TEX / 2 + (0.5 - h) * TEX * k]; };
    const poly = (pts, fill) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); };
    const fade = (hex, z, more = 0) => adjust(hex, -Math.round(z * (down ? 70 : 34) + more));
    const sw = STAIR_OPEN, rise = 0.14, run = 0.2, N = 9;
    ctx.fillStyle = down ? '#020203' : adjust(theme.ceil, -20);
    ctx.fillRect(0, 0, TEX, TEX);
    const roof = z => (down ? 1 - z * 0.62 : 1 + z * 0.62);
    const ground = z => (down ? (z < 0.06 ? 0 : -Math.ceil((z - 0.06) / run) * rise) : Math.floor(z / run) * rise);
    const zEnd = run * N;
    // the roof, then the walls either side, each in bands that darken going in
    for (let k = 0; k < 12; k++) {
      const z0 = zEnd * k / 12, z1 = zEnd * (k + 1) / 12;
      poly([at(-sw, roof(z0), z0), at(sw, roof(z0), z0), at(sw, roof(z1), z1), at(-sw, roof(z1), z1)], fade(theme.ceil, z0, 6));
      for (const sx of [-sw, sw]) poly([at(sx, roof(z0), z0), at(sx, roof(z1), z1), at(sx, ground(z1) - (down ? rise : 0), z1), at(sx, ground(z0) - (down ? rise : 0), z0)], fade(theme.wall, z0, sx < 0 ? 4 : 16));
    }
    // courses in the walls, running into the dark
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1;
    for (let hc = 0.125; hc < 1; hc += 0.25) for (const sx of [-sw, sw]) {
      const a = at(sx, hc, 0), b = at(sx, hc, zEnd);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    if (!down) {
      // a grey light from the top of the climb, behind the last of the treads
      const [lx, ly] = at(0, roof(zEnd) - 0.25, zEnd);
      const g = ctx.createRadialGradient(lx, ly, 1, lx, ly, 22);
      g.addColorStop(0, 'rgba(236,228,200,0.85)'); g.addColorStop(0.5, 'rgba(200,192,170,0.25)'); g.addColorStop(1, 'rgba(200,192,170,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, TEX, TEX);
      // the treads and their risers, the far ones first
      for (let i = N - 1; i >= 0; i--) {
        const z0 = i * run, z1 = (i + 1) * run, h0 = i * rise, h1 = (i + 1) * rise;
        poly([at(-sw, h0, z0), at(sw, h0, z0), at(sw, h1, z0), at(-sw, h1, z0)], fade(theme.wall, z0, 22));
        poly([at(-sw, h1, z0), at(sw, h1, z0), at(sw, h1, z1), at(-sw, h1, z1)], fade(theme.floor, z0, -26));
        // the nose of each tread, catching the light
        const [ax, ay] = at(-sw, h1, z0), [bx] = at(sw, h1, z0);
        ctx.fillStyle = `rgba(255,248,226,${(0.5 - i * 0.04).toFixed(2)})`; ctx.fillRect(Math.round(ax), Math.round(ay), Math.round(bx - ax), 1);
      }
    } else {
      // far below, the glow of a light on some landing
      const [lx, ly] = at(0, -1.1, zEnd * 1.6);
      const g = ctx.createRadialGradient(lx, ly, 1, lx, ly, 16);
      g.addColorStop(0, 'rgba(255,170,80,0.45)'); g.addColorStop(1, 'rgba(255,140,60,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, TEX, TEX);
      // the treads dropping away: only the nearest show above the foot of the opening
      for (let i = N - 1; i >= 0; i--) {
        const z0 = 0.06 + i * run, h = -i * rise;
        poly([at(-sw, h, z0), at(sw, h, z0), at(sw, h, z0 + run), at(-sw, h, z0 + run)], fade(theme.floor, z0, 10));
        const [ax, ay] = at(-sw, h, z0), [bx] = at(sw, h, z0);
        ctx.fillStyle = `rgba(255,240,210,${Math.max(0, 0.42 - i * 0.12).toFixed(2)})`; ctx.fillRect(Math.round(ax), Math.round(ay), Math.round(bx - ax), 1);
      }
      // the floor's own edge, where it drops
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, TEX - 2, TEX, 2);
    }
    // grit over it all, so it sits with the hand-made stone round it
    const img = ctx.getImageData(0, 0, TEX, TEX);
    for (let i = 0; i < TEX * TEX; i++) { const n = (rng.next() - 0.5) * 14; for (let k = 0; k < 3; k++) img.data[i * 4 + k] = Math.max(0, Math.min(255, img.data[i * 4 + k] + n)); }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function makeDecor(theme, wall, i) {
    return (theme.decor || []).map((name, k) => {
      const c = canvas(TEX, TEX);
      const ctx = c.getContext('2d');
      ctx.drawImage(wall, 0, 0);
      DECOR[name](ctx, theme, new Rng(`decor${i}:${k}`), theme.decor.slice(0, k).filter(n => n === name).length);
      return c;
    });
  }

  function makeDoor(theme, wallTex, lockColor) { return makePlankDoor(theme, wallTex, lockColor); }

  // A door a beast is battering shows each blow: a plank splits, then the
  // splits run and an iron band bends, and on the third the wood gives
  // enough to show the dark behind it. One more and it bursts.
  const DOOR_CRACKS = [
    // [x, y] runs of a split, drawn dark with a pale splintered edge beside it
    [[[20, 20], [21, 26], [19, 31], [21, 38], [20, 44]], [[37, 52], [38, 57], [36, 62]]],
    [[[29, 6], [30, 11]], [[44, 19], [43, 25], [45, 32], [44, 40]], [[12, 22], [13, 30], [11, 36]]],
    [[[27, 24], [33, 21], [36, 29], [34, 37], [27, 38], [24, 31], [27, 24]]],
  ];
  const cracked = new WeakMap();
  /** The door texture with the damage of n blows on it (n from 1 to 3). */
  // A shut door on fire, drawn on the door itself: the planks blacken as it
  // burns (stage 0 to 2), embers glow in the grain, and flames lick up from its
  // foot, higher as it goes (three frames, so they move). Made once and kept.
  const burnt = new Map();
  function burningDoor(door, stage, frame) {
    let set = burnt.get(door);
    if (!set) burnt.set(door, set = []);
    const k = stage * 3 + frame;
    if (set[k]) return set[k];
    const c = canvas(TEX, TEX), ctx = c.getContext('2d');
    ctx.drawImage(door, 0, 0);
    ctx.fillStyle = `rgba(22,11,4,${0.22 + 0.24 * stage})`;
    ctx.fillRect(0, 0, TEX, TEX);
    for (let i = 0; i < 10 + stage * 14; i++) {
      const x = (i * 37 + stage * 11) % TEX, y = (i * 53 + 7) % (TEX - 8);
      ctx.fillStyle = (i + frame) % 3 ? '#ff6a1a' : '#ffc050';
      ctx.fillRect(x, y, 1, 1);
    }
    const reach = 20 + stage * 12;
    for (let x = 0; x < TEX; x++) {
      const h = Math.max(3, Math.round(reach * (0.35 + 0.65 * Math.abs(Math.sin(x * 0.31 + frame * 2.1)) * (0.75 + 0.25 * Math.sin(x * 0.93 + frame * 1.7)))));
      for (let y = 0; y < h; y++) {
        const t = y / h;
        ctx.fillStyle = t < 0.3 ? '#fff0a8' : t < 0.6 ? '#ffb030' : t < 0.85 ? '#e2561a' : '#8a2410';
        ctx.fillRect(x, TEX - 1 - y, 1, 1);
      }
    }
    return (set[k] = c);
  }
  function crackedDoor(door, n) {
    let set = cracked.get(door);
    if (!set) cracked.set(door, set = []);
    if (set[n]) return set[n];
    const c = canvas(TEX, TEX), ctx = c.getContext('2d');
    ctx.drawImage(door, 0, 0);
    for (let i = 0; i < Math.min(n, DOOR_CRACKS.length); i++) {
      for (const run of DOOR_CRACKS[i]) {
        for (let j = 1; j < run.length; j++) {
          const [x0, y0] = run[j - 1], [x1, y1] = run[j];
          const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
          for (let k = 0; k <= steps; k++) {
            const x = Math.round(x0 + (x1 - x0) * k / steps), y = Math.round(y0 + (y1 - y0) * k / steps);
            ctx.fillStyle = '#140c06'; ctx.fillRect(x, y, 1, 1);
            ctx.fillStyle = '#b08a5a'; ctx.fillRect(x + 1, y, 1, 1);
          }
        }
      }
    }
    if (n >= 2) {
      // the lower band is bent in where the blows land
      ctx.fillStyle = '#3a3d44'; ctx.fillRect(24, 47, 16, 3);
      ctx.fillStyle = '#6c7078'; ctx.fillRect(24, 50, 16, 1);
    }
    if (n >= 3) {
      // a hole through the planks, dark behind, ringed with splinters
      ctx.fillStyle = '#050302';
      ctx.fillRect(27, 26, 7, 10); ctx.fillRect(26, 28, 9, 6); ctx.fillRect(29, 24, 3, 14);
      ctx.fillStyle = '#c29a66';
      for (const [x, y] of [[26, 26], [34, 27], [25, 33], [35, 34], [30, 23], [28, 38], [33, 37]]) ctx.fillRect(x, y, 1, 2);
    }
    return (set[n] = c);
  }

  function makeStairs(theme, wallTex, down) { return makeArchStairs(theme, wallTex, down); }

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
    if (theme.face === 'earth') {
      // a dug tunnel has no flagstones: trodden earth, a worn path down the
      // middle, stones and grit, the odd root breaking the surface
      for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
        const worn = Math.abs(x - TEX / 2) < 14 ? 6 : 0;
        px(ctx, adjust(theme.floor, rng.int(-8, 8) + worn), x, y);
      }
      for (let i = 0; i < 26; i++) {
        const x = rng.int(0, TEX - 3), y = rng.int(0, TEX - 3), t = rng.int(-6, 22);
        px(ctx, adjust('#6a6660', t), x, y, rng.int(1, 3), rng.int(1, 2));
        px(ctx, 'rgba(0,0,0,0.3)', x, y + 1, 2, 1);
      }
      for (let i = 0; i < 2; i++) { let x = rng.int(0, TEX), y = rng.int(0, TEX); for (let k = 0; k < 14; k++) { px(ctx, '#4a3420', x & (TEX - 1), y & (TEX - 1)); x += 1; if (rng.chance(0.4)) y += rng.int(-1, 1); } }
      return c;
    }
    return makeFlags(theme, seed);
  }
  function makeCeiling(theme, seed) { return makeRock(theme, seed); }
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
  // Three frames of the flame: upright, leaning and stretched one way, then
  // squat and leaning the other. The renderer steps through them.
  /** @type {Array<[number, number]>} */
  const FLAME_FRAMES = [[0, 1], [-1.5, 1.12], [1.5, 0.9]];   // lean in pixels at the tip, height
  function makeTorch(theme, wallTex, seed) {
    return FLAME_FRAMES.map(([lean, tall]) => {
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
      // flame: the hotter inner layers lean further, as a flame's tip sways
      // while its root stays on the torch
      /** @type {Array<[string, number]>} */
      const flame = [['#ff4010', 9], ['#ff9020', 6], ['#ffe060', 3]];
      for (const [col, r] of flame) {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.ellipse(32 + lean * (9 - r) / 4, 20 - r * 0.4 * tall, r * 0.7, r * tall, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // a spark thrown off the leaning tip
      if (lean) { ctx.fillStyle = '#ffc040'; ctx.fillRect(32 + lean * 3, 5, 1, 1); }
      // glow on the surrounding stone
      const g = ctx.createRadialGradient(32, 20, 2, 32, 20, 30);
      g.addColorStop(0, 'rgba(255,180,60,0.45)');
      g.addColorStop(1, 'rgba(255,140,40,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, TEX, TEX);
      // soot, the same in every frame
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      for (let i = 0; i < 20; i++) ctx.fillRect(rng.int(24, 40), rng.int(0, 14), 2, 1);
      return c;
    });
  }

  /**
   * A pillar: the walls' own stone, shaded round as a column is (lit down
   * the middle, falling into shadow at either edge), with a capital at its
   * head and a plinth at its foot, so it reads as standing free in a room.
   */
  function makePillar(theme, wall) {
    const c = canvas(TEX, TEX), ctx = c.getContext('2d');
    ctx.drawImage(wall, 0, 0);
    // round: a band of light a little left of the middle, dark toward both edges
    for (let x = 0; x < TEX; x++) {
      const u = (x + 0.5) / TEX, off = u - 0.42, shade = Math.min(0.62, off * off * 3.2);
      ctx.fillStyle = `rgba(0,0,0,${shade.toFixed(3)})`;
      ctx.fillRect(x, 0, 1, TEX);
      if (Math.abs(off) < 0.08) { ctx.fillStyle = 'rgba(255,240,220,0.08)'; ctx.fillRect(x, 0, 1, TEX); }
    }
    // fluting: a few shallow grooves down its length
    for (const gx of [10, 22, 34, 46, 56]) { ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fillRect(gx, 8, 1, TEX - 16); ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(gx + 1, 8, 1, TEX - 16); }
    // the capital and the plinth: a broader band of dressed stone, lit on top, shadowed beneath
    for (const [y0, h] of [[0, 7], [TEX - 8, 8]]) {
      ctx.fillStyle = adjust(theme.wall, 8); ctx.fillRect(0, y0, TEX, h);
      ctx.fillStyle = adjust(theme.wall, 30); ctx.fillRect(0, y0, TEX, 1);
      ctx.fillStyle = adjust(theme.mortar, -10); ctx.fillRect(0, y0 + h - 1, TEX, 1);
      for (let x = 0; x < TEX; x++) { const off = (x + 0.5) / TEX - 0.42; ctx.fillStyle = `rgba(0,0,0,${Math.min(0.5, off * off * 2.4).toFixed(3)})`; ctx.fillRect(x, y0, 1, h); }
    }
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 7, TEX, 2);
    return c;
  }

  // Shadow gathers where a wall meets the floor, and the roof: painted into
  // the stone itself, so it costs nothing to draw, and everything made from
  // the wall (a door's frame, a torch's bracket, a decoration) has it too.
  function footShade(c) {
    const ctx = c.getContext('2d');
    for (let y = 0; y < 5; y++) { ctx.fillStyle = `rgba(0,0,0,${(0.34 * (1 - y / 5)).toFixed(3)})`; ctx.fillRect(0, TEX - 1 - y, TEX, 1); }
    for (let y = 0; y < 3; y++) { ctx.fillStyle = `rgba(0,0,0,${(0.26 * (1 - y / 3)).toFixed(3)})`; ctx.fillRect(0, y, TEX, 1); }
    return c;
  }
  function makeTheme(theme, i) {
    const wall = footShade(makeWall(theme, 'wall' + i, false));
    const wallCracked = footShade(makeWall(theme, 'crack' + i, true));
    const locked = {};
    for (const k in KEY_COLORS) locked[k] = makeDoor(theme, wall, KEY_COLORS[k]);
    const torches = makeTorch(theme, wall, 'torch' + i);
    // A level shows only one theme, so its decorations are painted the first
    // time the renderer asks for them rather than all six sets at startup.
    let decor = null;
    let pillar = null;
    // the rest of what a place may be built of, laid with and roofed with
    // (see looks.js), painted the first time a floor wants it
    const once = {}, kept = (k, make) => once[k] || (once[k] = make());
    const floors = [toLevels(makeFloor(theme, 'floor' + i))], roofs = [toLevels(makeCeiling(theme, 'ceil' + i))];
    const FLOORS = [
      () => makeFloor(theme, 'floor' + i), () => makePath(theme, 'path' + i), () => makeMosaic(theme, 'mosaic' + i, false), () => makeMosaic(theme, 'mosaic' + i, true),
      () => makeWaterFloor(theme, 'floor' + i), () => makeRubbleFloor(theme, 'floor' + i), () => makeStraw(theme, 'floor' + i),
    ];
    const ROOFS = [() => makeCeiling(theme, 'ceil' + i), () => makeBeams(theme, 'ceil' + i), () => makeRootRoof(theme, 'ceil' + i), () => makeCaveRoof(theme, 'ceil' + i)];
    return {
      wall, wallCracked,
      /** The floor of each kind (looks.js FLOOR), at each shade. */
      floorOf: k => floors[k] || (floors[k] = toLevels(FLOORS[k] ? FLOORS[k]() : FLOORS[0]())),
      /** The roof of each kind (looks.js CEIL), at each shade. */
      ceilOf: k => roofs[k] || (roofs[k] = toLevels(ROOFS[k] ? ROOFS[k]() : ROOFS[0]())),
      // the same stone laid again, and the same stone where the damp has got in, so a long wall does not repeat
      get wallB() { return kept('wallB', () => footShade(makeWall(theme, 'wallb' + i, false))); },
      get wallDamp() { return kept('wallDamp', () => makeDampWall(theme, kept('wallB', () => footShade(makeWall(theme, 'wallb' + i, false))), 'damp' + i)); },
      get rock() { return kept('rock', () => footShade(makeCaveWall(theme, 'rock' + i))); },
      get rockPillar() { return kept('rockPillar', () => makeRockPillar(kept('rock', () => footShade(makeCaveWall(theme, 'rock' + i))))); },
      get fallen() { return kept('fallen', () => footShade(makeFallen(theme, 'fallen' + i))); },
      get cellDoor() { return kept('cellDoor', () => makeCellDoor(theme, wall, null)); },
      /** A cell's gate with a lock in its key's colour. */
      cellLocked: k => kept('cell_' + k, () => makeCellDoor(theme, wall, KEY_COLORS[k] || null)),
      get web() { return web(); },
      // (painted the first time a pillar is seen, as the decorations are)
      get pillar() { return pillar || (pillar = makePillar(theme, wall)); },
      get decor() { return decor || (decor = makeDecor(theme, wall, i)); },
      door: makeDoor(theme, wall, null),
      locked,
      stairsDown: makeStairs(theme, wall, true),
      stairsUp: makeStairs(theme, wall, false),
      // the stairwell drawn in depth: its arch, and the flight beyond it
      stairArch: makeStairArch(theme, wall),
      stairsUpBack: makeStairBack(theme, false),
      stairsDownBack: makeStairBack(theme, true),
      torchFrames: torches,
      fountain: makeFountain(theme, wall, false),
      fountainDry: makeFountain(theme, wall, true),
      floor: floors[0],
      ceil: roofs[0],
      theme,
    };
  }

  // a named champion drawn as itself (see CHAMPIONS) needs no wash of its kind's picture
  const named = k => Object.keys(MONSTERS).filter(id => MONSTERS[id].named && MONSTERS[id].sprite === k && !CHAMPIONS[id]).map(id => ({ prefix: id, tint: MONSTERS[id].named.tint }));
  /**
   * A creature's sprite in pieces, to be painted in order: its own picture and
   * its champions' drawn as themselves first, then each pose (both steps of a
   * walk together, so a stride never finds one foot painted and not the other),
   * then a shade's gear, trade by trade. Painted one after another they make
   * the whole sprite; painted a piece at a time in spare moments, none of them
   * holds up a frame for long. Until a pose is painted the creature is drawn in
   * its plain picture, which is what everything that reads a pose falls back to.
   * @param {string} k
   * @param {number} [scale]
   * @param {null | ((pick: (s: any) => any) => () => any)} [fine]  how each picture asks for its finer painting (see finerOf)
   */
  function creaturePieces(k, scale, fine = null) {
    const def = pose => ({ parts: CREATURES[k](pose), shadow: FLOATING.has(k) ? 0 : 1, elites: true, named: named(k), fine: true, grim: true, grid: gridOf(k) });
    const s = makeSprite(def(), scale);
    // a champion drawn as itself is painted from its own parts, poses and all, into
    // the place its wash would take, so whatever looks a champion up finds it there
    const champs = [];
    for (const id in CHAMPION_OF) {
      if (CHAMPION_OF[id] !== k || !MONSTERS[id] || MONSTERS[id].sprite !== k) continue;
      const own = pose => ({ parts: CHAMPIONS[id](pose), shadow: FLOATING.has(k) ? 0 : 1, elites: false, fine: true, grim: true, grid: gridOf(k) });
      s.elite[id] = makeSprite(own(), scale);
      champs.push({ id, own });
    }
    if (fine) {
      s.near = fine(x => x);
      for (const e in s.elite) s.elite[e].near = fine(x => x.elite[e]);
    }
    const poses = POSES[k] || [];
    const groups = [];
    for (const pose of poses) {
      if (pose === 'stepB' && poses.includes('stepA')) continue;
      groups.push(pose === 'stepA' && poses.includes('stepB') ? ['stepA', 'stepB'] : [pose]);
    }
    const rest = groups.map(group => () => {
      for (const pose of group) {
        const ps = makeSprite(def(pose), scale);
        s[pose] = ps;
        // (the finer painting's champions are found through the pose: see finerOf)
        if (!scale) for (const e in ps.elite) s.elite[e][pose] = ps.elite[e];
        for (const c of champs) { const o = s.elite[c.id]; o[pose] = makeSprite(c.own(pose), scale); ps.elite[c.id] = o[pose]; }
        if (fine) {
          ps.near = fine(x => x[pose]);
          // (the finer painting is itself painted a piece at a time: a pose of it may not be there yet)
          for (const e in ps.elite) ps.elite[e].near = fine(x => x[pose] && x[pose].elite[e]);
        }
      }
    });
    // a fallen hero's shade in the gear of their trade, likewise (see SHADE_GEAR),
    // a trade to a piece: until one is painted, a shade is drawn in its plain picture
    if (k === 'shade') for (const cls in SHADE_GEAR) rest.push(() => {
      const key = 'shade_' + cls;
      const own = pose => ({ parts: SHADE_GEAR[cls](pose), shadow: 0, elites: false, fine: true, grim: true, grid: gridOf(k) });
      const o = makeSprite(own(), scale);
      for (const pose of poses) { o[pose] = makeSprite(own(pose), scale); if (s[pose]) s[pose].elite[key] = o[pose]; }
      s.elite[key] = o;
      if (fine) {
        o.near = fine(x => x.elite[key]);
        for (const pose of poses) if (s[pose]) o[pose].near = fine(x => x[pose] && x[pose].elite[key]);
      }
    });
    return { s, rest };
  }
  // Right in front of the hero a creature fills the view, and painted at two
  // pixels to the unit each of its pixels came out a block. So each kind is
  // painted again twice as fine, the first time the renderer asks (as one
  // comes near), in spare moments; until then it keeps its usual picture.
  // Every pose and champion of it asks through near().
  const NEAR_SCALE = 4;
  /** How each picture of a kind asks for its finer painting, made once for the kind. */
  function finerOf(k) {
    let hi = null, asked = false;
    /** @param {(s: any) => any} pick */
    return pick => () => {
      if (hi) return pick(hi);
      // (a lifelike figure on the finer grid is fine already: three to its unit is enough)
      // Painted a piece at a time like the rest: whole, it was over a second's
      // work on a slow phone, with the creature right there. It waits behind the
      // creatures not yet painted at all (a plain picture matters more than a
      // finer one) and ahead of the items and props, and a pose not yet painted
      // finely is drawn in its usual picture meanwhile
      if (!asked) {
        asked = true;
        const at = unpainted.findIndex(x => typeof x === 'string' && !(x in CREATURES));
        unpainted.splice(at < 0 ? unpainted.length : at, 0, () => {
          const p = creaturePieces(k, gridOf(k) === 64 ? 3 : NEAR_SCALE);
          hi = p.s;
          unpainted.unshift(...p.rest);
        });
        paintSoon();
      }
      return null;
    };
  }

  // Painting every picture before the title could answer a tap took three
  // seconds on a slow phone, and the title needs none of the items, props or
  // room dressing. Those are painted the first time anything asks for one, and
  // the rest a few at a time once the title is up, so they are all ready long
  // before the first floor.
  /** @type {(string | (() => void))[]} the keys of pictures still to paint, and the pieces of creatures already begun */
  const unpainted = [];
  function later(key, make) {
    const keep = v => Object.defineProperty(sprites, key, { value: v, writable: true, configurable: true, enumerable: true });
    Object.defineProperty(sprites, key, {
      configurable: true, enumerable: true,
      get() { const v = make(); keep(v); return v; },
      set: keep,
    });
    unpainted.push(key);
  }
  /**
   * Paint what is still waiting in the time the browser has spare between
   * frames (a few milliseconds a slice where it cannot say), so the title and
   * the first floor keep their frame rate while it happens.
   * @param {{ timeRemaining(): number, didTimeout?: boolean }} [idle]
   */
  function paintAhead(idle) {
    waiting = true;
    // (a slice the browser had to be pressed for, its frames too busy to leave any
    // time spare, still gets a little: a piece a slice every half second was a
    // queue that took a minute)
    const until = performance.now() + (!idle ? 8 : idle.didTimeout ? 12 : Math.max(4, idle.timeRemaining() - 1));
    do { const k = unpainted.shift(); if (typeof k === 'function') k(); else if (k) void sprites[k]; } while (unpainted.length && performance.now() < until);
    waiting = false;
    if (unpainted.length) paintSoon();
  }
  // (one slice asked for at a time: a creature's pieces ask too, as they join the queue)
  let waiting = false;
  const paintSoon = () => {
    if (waiting) return;
    waiting = true;
    if (typeof requestIdleCallback === 'function') requestIdleCallback(paintAhead, { timeout: 500 }); else setTimeout(paintAhead, 40);
  };
  function init() {
    for (const k in SPRITES) sprites[k] = makeSprite(SPRITES[k]);
    // creatures built from parts replace their old grids: they are painted first
    // of what waits, as the first floor wants them before anything else. They
    // stand in the world, close enough to fill the view, so they are painted
    // twice as fine as the items in the pack
    // A creature is painted its own picture first, and the rest of it (its
    // poses, a shade's gear) is put at the head of what waits: a whole creature
    // at once was up to half a second's work on a slow phone, in the middle of a
    // fight's first frames.
    for (const k in CREATURES) later(k, () => {
      const { s, rest } = creaturePieces(k, undefined, finerOf(k));
      unpainted.unshift(...rest);
      paintSoon();
      return s;
    });
    // the heroes' portraits, one to a class (see PORTRAITS)
    for (const k in PORTRAITS) later('portrait_' + k, () => makeSprite({ parts: PORTRAITS[k](), shadow: 0, elites: false, fine: true, grid: 64 }));
    // items painted from parts replace their old grids too
    // items are painted finely too: a pack slot on a phone shows them at two or three device pixels to the unit.
    // They are set on the creatures' finer grid and lit as they are, softly grim (see ramp), clean of the
    // painter's grain: their own fine work carries the wood and the steel, where grain read as rust on all of it
    const itemParts = k => ITEM_ART[k]().map(p => ({ ...up2(p), smooth: 1 }));
    for (const k in ITEM_ART) later(k, () => makeSprite({ parts: itemParts(k), fine: true, grim: 'soft', grid: 64 }));
    // relics wear their base item's picture with a gold edge, on the floor and in the pack
    // (and a champion's own jewel, never dealt a seed's look, wears its own picture so: the Spider Pendant, Durgrim's Ring)
    for (const k of new Set(Object.values(ITEMS).filter(b => ['weapon', 'armor', 'shield'].includes(b.kind) || (['ring', 'amulet'].includes(b.kind) && b.tier >= 99)).map(b => b.sprite))) {
      if (ITEM_ART[k]) later('relic_' + k, () => makeSprite({ parts: itemParts(k), outline: '#e8b84a', fine: true, grim: 'soft', grid: 64 }));
    }
    // props stand in the world too, painted as finely
    for (const k in PROPS) later(k, () => makeSprite({ parts: PROPS[k](), shadow: FLOATING.has(k) ? 0 : 1, fine: true, grim: true, grid: gridOf(k) }));
    // what lies about a room, and what the fallen leave behind (see dressing.js)
    for (const k in DRESSING) later('dress_' + k, () => makeSprite({ parts: DRESSING[k](), shadow: 1, fine: true, grim: true, grid: 64 }));
    THEMES.forEach((t, i) => { themes[i] = makeTheme(t, i); });
    setTimeout(paintSoon, 200);
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
    // in the same light as the pictures in the pack: softly grim, clean of grain
    return trim(paintParts(h.parts.map(p => ({ ...p, smooth: 1 })), h.grid, SCALE, 'soft'), outline, h.anchor.map(v => v * SCALE), m);
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

  /** How many pictures still wait to be painted in spare time (the frame-rate checks wait for none). */
  const painting = () => unpainted.length;
  /**
   * The pictures a floor will want soonest (its creatures, as the hero arrives)
   * go to the head of what waits, so they are painted before any other.
   * @param {string[]} keys
   */
  function paintFirst(keys) {
    const want = new Set(keys);
    const first = unpainted.filter(k => typeof k === 'string' && want.has(k));
    if (!first.length) return;
    for (let i = unpainted.length - 1; i >= 0; i--) if (typeof unpainted[i] === 'string' && want.has(/** @type {string} */ (unpainted[i]))) unpainted.splice(i, 1);
    // (behind any creature's pieces already begun: they finish what is on the floor already)
    const begun = unpainted.findIndex(k => typeof k === 'string');
    unpainted.splice(begun < 0 ? unpainted.length : begun, 0, ...first);
    paintSoon();
  }
  // ---------- walldecor: see walldecor.js ----------
  const { BONE, DECOR, LONG_BONE, SKULL, isMortar, line, moss, px, stamp } = makeWallDecor({
    get TEX() { return TEX; }, get adjust() { return adjust; }, get canvas() { return canvas; }, get hexToRgb() { return hexToRgb; },
  });

  return { init, painting, paintFirst, sprites, themes, SHADES, FLOOR_LEVELS, TEX, STAIR_OPEN, held, carried, crackedDoor, burningDoor };
})();

export { Assets };
