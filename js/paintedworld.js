// Approved world, equipment and material exports. Procedural pictures remain
// available while an individual image loads, or if that image cannot be decoded.
import { PAINTED } from './paintedcatalog.js';
const pending = new Map();
function picture(url, size, accept, variant = '') {
  const cacheKey = variant ? url + '#' + variant : url;
  if (pending.has(cacheKey)) return pending.get(cacheKey);
  const entry = { state: 'loading', value: null };
  pending.set(cacheKey, entry);
  const image = new Image();
  image.onload = () => {
    if (image.naturalWidth !== size || image.naturalHeight !== size) { entry.state = 'failed'; return; }
    try { entry.value = accept(image); entry.state = 'ready'; } catch { entry.state = 'failed'; }
  };
  image.onerror = () => { entry.state = 'failed'; };
  image.src = url;
  return entry;
}
function canvas(image) {
  const c = document.createElement('canvas'); c.width = image.width; c.height = image.height;
  c.getContext('2d').drawImage(image, 0, 0); return c;
}
function sprite(image, url, outline = null) {
  let base = canvas(image);
  if (outline) {
    // Cache the rarity edge once, including the URL used by Pack images.
    const edged = document.createElement('canvas'); edged.width = edged.height = 256;
    const ctx = edged.getContext('2d');
    for (const [x, y] of [[-3, 0], [3, 0], [0, -3], [0, 3], [-2, -2], [2, -2], [-2, 2], [2, 2]]) ctx.drawImage(base, x, y);
    ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = outline; ctx.fillRect(0, 0, 256, 256);
    ctx.globalCompositeOperation = 'source-over'; ctx.drawImage(base, 0, 0); base = edged; url = base.toDataURL();
  }
  const data = base.getContext('2d').getImageData(0, 0, 256, 256).data;
  let top = 256;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 32) { top = Math.floor(i / 4 / 256); break; }
  const wash = (colour, alpha) => {
    const c = canvas(base), ctx = c.getContext('2d'); ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = colour; ctx.globalAlpha = alpha; ctx.fillRect(0, 0, 256, 256); return c;
  };
  return { w: 256, h: 256, top: top / 256, levels: [base, ...[.25, .45, .62, .78].map(a => wash('#000', a))], flash: wash('#fff', .85), near: null, url };
}
// Stable sprite objects keep all existing callers, aliases and live pose objects.
export function paintWorld(fallback, key) {
  const url = PAINTED.static[key];
  const outline = key.startsWith('mythic_') ? '#e2bcff' : key.startsWith('legend_') ? '#ffa040' : key.startsWith('relic_') ? '#e8b84a' : null;
  if (!url) return fallback;
  const originalUrl = Object.getOwnPropertyDescriptor(fallback, 'url').get.bind(fallback);
  const base = Object.fromEntries(['w', 'h', 'top', 'levels', 'flash', 'near'].map(k => [k, fallback[k]]));
  let oldUrl = null, frame = null, entry = null;
  const start = () => {
    if (entry) return;
    entry = picture(url, 256, image => {
      frame = sprite(image, url, outline);
      if (oldUrl) for (const img of document.querySelectorAll('img')) if (img.getAttribute('src') === oldUrl) img.src = frame.url;
      return frame;
    }, outline || '');
  };
  for (const key of Object.keys(base)) Object.defineProperty(fallback, key, {
    configurable: true, enumerable: true, get() { start(); return frame ? frame[key] : base[key]; },
  });
  Object.defineProperty(fallback, 'url', { configurable: true, get() {
    start(); return frame ? frame.url : oldUrl || (oldUrl = originalUrl());
  } });
  return fallback;
}
function heldFrame(meta) {
  const entry = picture(meta.path, 256, image => ({ img: canvas(image), ax: meta.grip[0], ay: meta.grip[1], at: { min: meta.bounds.slice(0, 2), max: meta.bounds.slice(2), ...(meta.nocks || {}), ...(meta.tip ? { tip: meta.tip.slice() } : {}), ...(meta.base ? { base: meta.base.slice() } : {}) } }));
  return entry.value;
}
const heldFamilies = new Map();
for (const meta of Object.values(PAINTED.held)) {
  const key = meta.cls + '|' + meta.id;
  if (!heldFamilies.has(key)) heldFamilies.set(key, []);
  heldFamilies.get(key).push(meta);
}
export function paintedHeld(id, pose, cls, two, lit) {
  const family = heldFamilies.get(cls + '|' + id);
  const meta = family?.find(m => m.id === id && m.cls === cls && m.pose === pose && m.two === !!two && m.lit === !!lit);
  if (!meta) return null;
  // A whole weapon family switches together, so the first swing cannot mix
  // painted and procedural poses while individual frames are still loading.
  const frames = family.map(heldFrame);
  return frames.every(Boolean) ? frames[family.indexOf(meta)] : null;
}
const carriedFrames = new Map(Object.values(PAINTED.carried).map(meta => [meta.cls + '|' + meta.id, meta]));
export function paintedCarried(id, cls) {
  const meta = carriedFrames.get(cls + '|' + id);
  return meta && meta.id === id && meta.cls === cls ? heldFrame(meta) : null;
}
export function paintedImpact(family, index) {
  // Prepare the complete family together; an unfinished family stays procedural.
  const entries = [0, 1, 2, 3].map(i => picture(PAINTED.effects[family + '_' + i], 256, canvas));
  return entries.every(e => e.state === 'ready') ? entries[index].value : null;
}
// Empty iron frame: the renderer retains the lantern's own live light/flame.
export function paintedLantern() {
  const meta = PAINTED.overlays.amber_lantern;
  return picture(meta.path, 256, image => ({ img: canvas(image), ...meta })).value;
}
// Blank vellum only; writing and fire remain live in the spell renderer.
export function paintedReadingScroll() {
  const meta = PAINTED.overlays.reading_scroll;
  return picture(meta.path, 256, image => ({ img: canvas(image), ...meta })).value;
}
// Small material layers only. Shade canvases are prepared once on image load;
// projection, silhouette, splashes and landing time stay in the renderer.
export function paintedGroundDecal(kind, light) {
  const path = PAINTED.decals[kind];
  if (!path) return null;
  const entry = picture(path, 128, image => {
    // Mask once in local coordinates. Scaling this circle produces the same
    // projected ellipse without rebuilding a canvas clip for every stain.
    const base = canvas(image), mask = base.getContext('2d');
    mask.globalCompositeOperation = 'destination-in';
    mask.beginPath(); mask.ellipse(64, 64, 63, 63, 0, 0, Math.PI * 2); mask.fill();
    return Array.from({ length: 8 }, (_, step) => {
      const c = canvas(base), ctx = c.getContext('2d');
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = step / 7;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 128, 128);
      return c;
    });
  });
  return entry.value?.[Math.max(0, Math.min(7, Math.round((1 - light * .8) * 7)))] || null;
}
function levels(image) {
  const c = canvas(image), d = c.getContext('2d').getImageData(0, 0, 64, 64).data;
  if (d.some((v, i) => i % 4 === 3 && v !== 255)) throw Error('Transparent surface');
  return Array.from({ length: 8 }, (_, l) => {
    const f = 1 - l / 7, a = new Uint32Array(4096);
    for (let i = 0; i < 4096; i++) a[i] = (0xff000000 | ((d[i * 4 + 2] * f) | 0) << 16 | ((d[i * 4 + 1] * f) | 0) << 8 | ((d[i * 4] * f) | 0)) >>> 0;
    return a;
  });
}
export function paintTheme(original, index) {
  const catalog = PAINTED.themes[index];
  if (!catalog) return original;
  const entries = {}, composed = new Map();
  let revision = 0, decorationFrames = null, torchFrames = null;
  const value = key => {
    if (!catalog[key]) return null;
    if (!entries[key]) entries[key] = picture(catalog[key], 64, image => {
      if (/^(floor|ceil)/.test(key)) { const material = levels(image); revision++; return material; }
      return canvas(image);
    });
    return entries[key].value;
  };
  const compose = (key, base, make) => {
    const painted = value(key);
    if (!painted) return base;
    if (!composed.has(key)) { const c = canvas(base); make(c.getContext('2d'), painted); composed.set(key, c); }
    return composed.get(key);
  };
  const arch = () => compose('stairArch', original.stairArch, (ctx, painted) => {
    ctx.drawImage(painted, 0, 0);
    // Surface paint cannot change a doorway's exact authored opening. Native
    // stone covers the few opaque edge pixels absent from the candidate.
    ctx.globalCompositeOperation = 'destination-in'; ctx.drawImage(original.stairArch, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  });
  const gate = () => compose('cellDoor', original.cellDoor, (ctx, painted) => {
    // Shared painted ironwork; the native regional masonry stays at the edges.
    ctx.drawImage(painted, 8, 4, 48, 60, 8, 4, 48, 60);
  });
  const lock = (colour, cell) => {
    const native = cell ? original.cellLocked(colour) : original.locked[colour];
    const base = cell ? gate() : value('door');
    if (!base || (cell && base === original.cellDoor)) return native;
    const key = (cell ? 'cell_' : 'door_') + colour;
    if (!composed.has(key)) {
      const c = canvas(base), ctx = c.getContext('2d');
      const [x, y, w, h] = cell ? [40, 26, 12, 12] : [38, 27, 14, 16];
      ctx.drawImage(native, x, y, w, h, x, y, w, h); composed.set(key, c);
    }
    return composed.get(key);
  };
  const locks = new Proxy(original.locked, { get(t, k) { return typeof k === 'string' && Object.hasOwn(t, k) ? lock(k, false) : t[k]; } });
  return new Proxy(original, { get(t, k) {
    if (k === 'artRevision') return revision;
    if (k === 'floorOf') return n => value(n ? 'floor' + n : 'floor') || t.floorOf(n);
    if (k === 'floor') return value('floor') || t.floor;
    if (k === 'ceilOf') return n => value(n ? 'ceil' + n : 'ceiling') || t.ceilOf(n);
    if (k === 'ceil') return value('ceiling') || t.ceil;
    if (k === 'stairArch') return arch();
    if (k === 'cellDoor') return gate();
    if (k === 'locked') return locks;
    if (k === 'cellLocked') return colour => lock(colour, true);
    if (k === 'decor') {
      const keys = t.theme.decor.map((_, i) => 'decor' + i), frames = keys.map(value);
      if (!frames.every(Boolean)) return t.decor;
      return decorationFrames || (decorationFrames = frames);
    }
    if (k === 'torchFrames') {
      const frames = [0, 1, 2].map(i => value('torch' + i));
      if (!frames.every(Boolean)) return t.torchFrames;
      // Keep wall and bracket fixed; only the authored flame area changes.
      return torchFrames || (torchFrames = frames.map(frame => {
        const c = canvas(frames[0]); c.getContext('2d').drawImage(frame, 0, 0, 64, 30, 0, 0, 64, 30); return c;
      }));
    }
    return typeof k === 'string' ? value(k) || t[k] : t[k];
  } });
}
export function paintedWorldState() {
  return Object.fromEntries([...pending].map(([url, e]) => [url, e.state]));
}
