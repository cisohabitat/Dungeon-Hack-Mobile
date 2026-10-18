import { Rng } from './rng.js';

// Architectural details baked into the existing textures, never into a level.
// No new lights, tile kinds or run dice: a stone still means the same thing.
/** @param {{adjust: Function, hexToRgb: Function}} K */
export function makeRegionArt(K) {
  const style = t => t.region || t.people || t.face || (/Catacombs|Crypts/.test(t.name) ? 'crypts' : /Mossy/.test(t.name) ? 'moss' : /Blue/.test(t.name) ? 'vaults' : 'halls');
  const colour = (a, b, mix) => {
    const x = K.hexToRgb(a), y = K.hexToRgb(b);
    return `rgb(${x.map((v, i) => Math.round(v * (1 - mix) + y[i] * mix)).join(',')})`;
  };
  const px = (c, ink, x, y, w = 1, h = 1) => { c.fillStyle = ink; c.fillRect(x, y, w, h); };
  function line(c, ink, x0, y0, x1, y1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) px(c, ink, Math.round(x0 + (x1 - x0) * i / (n || 1)), Math.round(y0 + (y1 - y0) * i / (n || 1)));
  }
  function rim(c, ink, x, y, w, h) {
    px(c, ink, x, y, w); px(c, ink, x, y + h - 1, w);
    px(c, ink, x, y, 1, h); px(c, ink, x + w - 1, y, 1, h);
  }
  function diamond(c, ink, x, y, r) {
    line(c, ink, x, y - r, x + r, y); line(c, ink, x + r, y, x, y + r);
    line(c, ink, x, y + r, x - r, y); line(c, ink, x - r, y, x, y - r);
  }
  function wall(t, image) {
    const c = image.getContext('2d'), s = style(t);
    const dark = K.adjust(t.wall, -24), edge = K.adjust(t.wall, 9);
    c.save();
    if (s === 'dwarves') {
      // Recessed iron uprights, square bosses, a mason's chevron at the foot.
      for (const x of [2, 58]) {
        px(c, '#292b2c', x, 2, 4, 60); px(c, '#626463', x, 2, 1, 60);
        for (const y of [5, 28, 53]) { px(c, '#85837a', x + 1, y, 2, 2); px(c, '#1c1e20', x + 2, y + 1); }
      }
      for (let x = 10; x < 56; x += 12) { line(c, dark, x, 55, x + 4, 59); line(c, edge, x + 4, 59, x + 8, 55); }
    } else if (s === 'marsh') {
      // The lashings belong to the wall, rather than looking like loose loot.
      for (const y of [11, 50]) {
        px(c, '#302d1c', 0, y + 2, 64, 2); px(c, '#77704b', 0, y, 64); px(c, '#565039', 0, y + 1, 64);
        for (let x = 4; x < 64; x += 16) { line(c, '#8a8055', x, y - 2, x + 4, y + 4); line(c, '#413c26', x + 4, y - 2, x, y + 4); }
      }
    } else if (s === 'crypts') {
      // A carved course above the burial chambers; the mortar row stays clear.
      px(c, dark, 0, 12, 64, 2); px(c, edge, 0, 14, 64);
      for (let x = 4; x < 64; x += 16) { rim(c, dark, x, 3, 9, 4); px(c, edge, x + 1, 3, 7); }
      for (const x of [8, 40]) { rim(c, dark, x, 52, 16, 7); px(c, edge, x + 1, 52, 14); }
    } else if (s === 'drowned') {
      const rng = new Rng('old-waterline:' + t.name);
      for (let x = 0; x < 64; x++) {
        const y = 44 + Math.round(Math.sin(x * 0.18));
        c.globalAlpha = 0.3; px(c, colour(t.wall, '#203637', 0.55), x, y, 1, 17);
        c.globalAlpha = 0.65;
        if (rng.chance(0.65)) px(c, colour(t.wall, '#a2a490', 0.28), x, y);
      }
    } else if (s === 'forge') {
      px(c, '#24201f', 0, 5, 64, 2); px(c, dark, 0, 53, 64, 5); px(c, edge, 0, 53, 64);
      for (let x = 7; x < 64; x += 16) { px(c, '#807467', x, 55, 2, 2); px(c, '#29211e', x + 1, 56); }
    } else if (s === 'glass' || s === 'elves') {
      const ink = colour(t.wall, t.accent, 0.23);
      for (const x of [3, 60]) px(c, ink, x, 2, 1, 60);
      for (let x = 8; x < 64; x += 16) diamond(c, ink, x, 5, 3);
      px(c, dark, 0, 56, 64); px(c, ink, 0, 57, 64);
    } else if (s !== 'bones' && s !== 'earth') {
      // Worn skirting and a narrow fret distinguish dressed halls from caves.
      px(c, dark, 0, 54, 64, 3); px(c, edge, 0, 57, 64);
      for (let x = 4; x < 64; x += 16) rim(c, dark, x, 3, 9, 4);
    }
    c.restore(); return image;
  }
  function floor(t, image) {
    const c = image.getContext('2d'), s = style(t), dark = K.adjust(t.floor, -13);
    const edge = colour(t.floor, t.wall, 0.25), inlay = colour(t.floor, t.accent, 0.18);
    const rng = new Rng('regional-floor:' + t.name);
    c.save();
    if (s === 'marsh') {
      // Dry mud is olive and matt; actual pools keep their blue water texture.
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) px(c, K.adjust(t.floor, rng.int(-9, 5)), x, y);
      for (let n = 0; n < 13; n++) {
        const x = rng.int(1, 13), y = rng.int(0, 63), right = n % 2 ? 48 : 0;
        line(c, '#514b2f', right + x, y, right + x + 2, Math.min(63, y + 7));
        px(c, '#68603d', right + x + 1, y, 1, 4);
      }
    } else if (s === 'crypts' || s === 'bones') {
      // Long ledger stones rather than a grid of little kitchen-like tiles.
      for (const x of [3, 35]) {
        const stone = colour(t.floor, t.wall, 0.09);
        c.fillStyle = stone; c.fillRect(x + 1, 3, 25, 57);
        c.globalAlpha = 0.025;
        for (let sy = 3; sy < 60; sy++) for (let sx = x + 1; sx < x + 26; sx++) {
          px(c, rng.chance(0.5) ? '#ffffff' : '#000000', sx, sy);
        }
        c.globalAlpha = 1;
        rim(c, dark, x, 2, 27, 60); rim(c, edge, x + 2, 4, 23, 56);
        for (const y of [14, 18, 22]) px(c, dark, x + 9, y, 9 - (y - 14) / 2);
      }
    } else if (s === 'dwarves' || s === 'forge') {
      rim(c, dark, 1, 1, 62, 62); rim(c, edge, 3, 3, 58, 58);
      diamond(c, dark, 32, 32, 23); diamond(c, edge, 32, 32, 21);
      for (const x of [7, 55]) for (const y of [7, 55]) { px(c, edge, x, y, 2, 2); px(c, dark, x + 1, y + 1); }
    } else if (s === 'glass' || s === 'elves' || s === 'vaults') {
      diamond(c, dark, 32, 32, 29); diamond(c, inlay, 32, 32, 27);
      if (s === 'glass') { rim(c, inlay, 12, 12, 40, 40); rim(c, dark, 14, 14, 36, 36); }
      else for (const x of [4, 60]) for (const y of [4, 60]) diamond(c, edge, x, y, 3);
    } else if (s === 'earth' || s === 'moss') {
      for (let n = 0; n < 9; n++) {
        const x = n % 2 ? rng.int(0, 9) : rng.int(54, 63), y = rng.int(0, 56);
        line(c, colour(t.floor, '#354328', 0.35), x, y, x - 2, y + 7);
      }
    } else if (s === 'drowned') {
      // Silt gathers at tile edges; it does not introduce a second water signal.
      for (let n = 0; n < 90; n++) { const x = rng.int(0, 63), y = rng.pick([rng.int(0, 4), rng.int(59, 63)]); px(c, colour(t.floor, '#647265', rng.next() * 0.2), x, y); }
    } else {
      for (const x of [3, 51]) for (const y of [3, 51]) { px(c, dark, x, y, 10); px(c, edge, x, y, 1, 10); }
    }
    c.restore(); return image;
  }
  function door(t, image) {
    const c = image.getContext('2d'), s = style(t);
    // Everything stays on the left panel, clear of the handle and coloured lock.
    const iron = '#414347', edge = '#898578';
    c.save();
    if (s === 'dwarves' || s === 'forge') {
      for (const y of [23, 36]) { line(c, iron, 12, y, 28, y + 6); line(c, edge, 12, y - 1, 28, y + 5); }
      for (const y of [24, 37]) px(c, '#a49b85', 14, y, 2, 2);
    } else if (s === 'marsh' || s === 'earth') {
      for (const y of [22, 38]) { line(c, '#a29260', 12, y, 29, y + 4); line(c, '#53482d', 12, y + 1, 29, y + 5); }
      line(c, '#7a704a', 16, 20, 16, 45); line(c, '#403d29', 26, 20, 26, 45);
    } else if (s === 'crypts' || s === 'bones') {
      rim(c, '#343033', 14, 22, 14, 20); rim(c, '#797164', 15, 23, 12, 18);
      for (const y of [28, 32, 36]) px(c, '#433d38', 18, y, 6);
    } else if (s === 'elves' || s === 'glass' || s === 'vaults') {
      diamond(c, '#302a3a', 21, 32, 11); diamond(c, colour('#635c6b', t.accent, 0.2), 21, 32, 9);
    } else if (s === 'drowned') {
      for (let x = 10; x < 31; x++) px(c, '#373f37', x, 55 + x % 3, 1, 6);
    }
    c.restore(); return image;
  }
  function wood(t, palette) {
    const s = style(t);
    const target = s === 'dwarves' ? [68, 70, 73] : s === 'marsh' ? [63, 76, 42]
      : s === 'forge' ? [42, 35, 31] : s === 'elves' || s === 'glass' ? [53, 43, 64]
        : s === 'crypts' || s === 'bones' ? [83, 75, 63] : null;
    if (!target) return palette;
    const mix = s === 'dwarves' ? 0.78 : s === 'crypts' || s === 'bones' ? 0.3 : 0.6;
    return palette.map(rgb => rgb.map((v, i) => Math.round(v * (1 - mix) + target[i] * mix)));
  }
  return { wall, floor, door, wood };
}
