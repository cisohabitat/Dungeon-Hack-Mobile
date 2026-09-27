import { Rng } from './rng.js';
import { SPRITES, THEMES, KEY_COLORS, ELITES, ITEMS, MONSTERS } from './data.js';
import { CREATURES, POSES, PROPS, FLOATING, paintParts } from './creatures.js';
import { ITEM_ART } from './itemart.js';
import { DRESSING } from './dressing.js';
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
    const painted = def.parts ? paintParts(def.parts, 32, sc) : null;
    const aw = painted ? painted.aw : def.rows[0].length, ah = painted ? painted.ah : def.rows.length;
    // the outline keeps its weight in a finer painting: two of its pixels wide
    const ow = sc >= 4 ? 2 : 1;
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
      const r = v & 255, g = (v >> 8) & 255, b = (v >> 16) & 255, k = 0.68;
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
            touch = def.outline || !(ox > 0 || oy > 0) ? 0 : px32[(ny + ow) * w + nx + ow];
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
    const make = () => ({
      w, h, top,
      levels: SHADES.map(a => (a === 0 ? base : tintOf('#000', a))),
      flash: tintOf('#fff', 0.85),
      // the finer painting is only ever drawn in the view, never shown as a picture
      url: scale ? '' : base.toDataURL(),
      /** @type {null | (() => any)} the finer painting for up close, once it is ready (see nearFor) */
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
        return { w, h, top, levels: SHADES.map(shade), flash: sprite.flash, url: scale ? '' : washed.toDataURL(), near: /** @type {null | (() => any)} */ (null) };
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
  /** The decorated walls of one theme, each a copy of its plain wall dressed. */
  function makeDecor(theme, wall, i) {
    return (theme.decor || []).map((name, k) => {
      const c = canvas(TEX, TEX);
      const ctx = c.getContext('2d');
      ctx.drawImage(wall, 0, 0);
      DECOR[name](ctx, theme, new Rng(`decor${i}:${k}`), theme.decor.slice(0, k).filter(n => n === name).length);
      return c;
    });
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

  function makeTheme(theme, i) {
    const wall = makeWall(theme, 'wall' + i, false);
    const wallCracked = makeWall(theme, 'crack' + i, true);
    const locked = {};
    for (const k in KEY_COLORS) locked[k] = makeDoor(theme, wall, KEY_COLORS[k]);
    const torches = makeTorch(theme, wall, 'torch' + i);
    // A level shows only one theme, so its decorations are painted the first
    // time the renderer asks for them rather than all six sets at startup.
    let decor = null;
    return {
      wall, wallCracked,
      get decor() { return decor || (decor = makeDecor(theme, wall, i)); },
      door: makeDoor(theme, wall, null),
      locked,
      stairsDown: makeStairs(theme, wall, true),
      stairsUp: makeStairs(theme, wall, false),
      torchFrames: torches,
      fountain: makeFountain(theme, wall, false),
      fountainDry: makeFountain(theme, wall, true),
      floor: toLevels(makeFloor(theme, 'floor' + i)),
      ceil: toLevels(makeCeiling(theme, 'ceil' + i)),
      theme,
    };
  }

  const named = k => Object.keys(MONSTERS).filter(id => MONSTERS[id].named && MONSTERS[id].sprite === k).map(id => ({ prefix: id, tint: MONSTERS[id].named.tint }));
  /** A creature's sprite, its champions' and its other poses, which ride on it. */
  function creature(k, scale) {
    const def = pose => ({ parts: CREATURES[k](pose), shadow: FLOATING.has(k) ? 0 : 1, elites: true, named: named(k), fine: true });
    const s = makeSprite(def(), scale);
    for (const pose of POSES[k] || []) {
      const ps = makeSprite(def(pose), scale);
      s[pose] = ps;
      // (the finer painting's champions are found through the pose: see nearFor)
      if (!scale) for (const e in ps.elite) s.elite[e][pose] = ps.elite[e];
    }
    return s;
  }
  // Right in front of the hero a creature fills the view, and painted at two
  // pixels to the unit each of its pixels came out a block. So each kind is
  // painted again twice as fine, the first time the renderer asks (as one
  // comes near), off the frame being drawn; until then it keeps its usual
  // picture. Every pose and champion of it asks through near().
  const NEAR_SCALE = 4;
  function nearFor(k, lo = sprites[k]) {
    let hi = null, asked = false;
    /** @param {(s: any) => any} pick */
    const via = pick => () => {
      if (hi) return pick(hi);
      if (!asked) { asked = true; setTimeout(() => { hi = creature(k, NEAR_SCALE); }, 0); }
      return null;
    };
    lo.near = via(s => s);
    for (const e in lo.elite) lo.elite[e].near = via(s => s.elite[e]);
    for (const pose of POSES[k] || []) {
      lo[pose].near = via(s => s[pose]);
      for (const e in lo[pose].elite) lo[pose].elite[e].near = via(s => s[pose].elite[e]);
    }
  }

  // Painting every picture before the title could answer a tap took three
  // seconds on a slow phone, and the title needs none of the items, props or
  // room dressing. Those are painted the first time anything asks for one, and
  // the rest a few at a time once the title is up, so they are all ready long
  // before the first floor.
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
   * @param {{ timeRemaining(): number }} [idle]
   */
  function paintAhead(idle) {
    const until = performance.now() + (idle ? Math.max(1, idle.timeRemaining() - 1) : 5);
    do { const k = unpainted.shift(); if (k) void sprites[k]; } while (unpainted.length && performance.now() < until);
    if (unpainted.length) paintSoon();
  }
  const paintSoon = () => (typeof requestIdleCallback === 'function' ? requestIdleCallback(paintAhead, { timeout: 500 }) : setTimeout(paintAhead, 40));
  function init() {
    for (const k in SPRITES) sprites[k] = makeSprite(SPRITES[k]);
    // creatures built from parts replace their old grids: they are painted first
    // of what waits, as the first floor wants them before anything else. They
    // stand in the world, close enough to fill the view, so they are painted
    // twice as fine as the items in the pack
    for (const k in CREATURES) later(k, () => { const s = creature(k); nearFor(k, s); return s; });
    // items painted from parts replace their old grids too
    // items are painted finely too: a pack slot on a phone shows them at two or three device pixels to the unit
    for (const k in ITEM_ART) later(k, () => makeSprite({ parts: ITEM_ART[k](), fine: true }));
    // relics wear their base item's picture with a gold edge, on the floor and in the pack
    for (const k of new Set(Object.values(ITEMS).filter(b => ['weapon', 'armor', 'shield'].includes(b.kind)).map(b => b.sprite))) {
      if (ITEM_ART[k]) later('relic_' + k, () => makeSprite({ parts: ITEM_ART[k](), outline: '#e8b84a', fine: true }));
    }
    // props stand in the world too, painted as finely
    for (const k in PROPS) later(k, () => makeSprite({ parts: PROPS[k](), shadow: FLOATING.has(k) ? 0 : 1, fine: true }));
    // what lies about a room, and what the fallen leave behind (see dressing.js)
    for (const k in DRESSING) later('dress_' + k, () => makeSprite({ parts: DRESSING[k](), shadow: 1, fine: true }));
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

  return { init, sprites, themes, SHADES, FLOOR_LEVELS, TEX, held, carried, crackedDoor };
})();

export { Assets };
