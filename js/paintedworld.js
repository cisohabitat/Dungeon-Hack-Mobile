// Approved world, equipment and material exports. Procedural pictures remain
// available while an individual image loads, or if that image cannot be decoded.
import { PAINTED } from './paintedcatalog.js';
const pending = new Map();
function picture(url, size, accept) {
  if (pending.has(url)) return pending.get(url);
  const entry = { state: 'loading', value: null };
  pending.set(url, entry);
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
function sprite(image, url) {
  const base = canvas(image), data = base.getContext('2d').getImageData(0, 0, 256, 256).data;
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
  if (!url) return fallback;
  const originalUrl = Object.getOwnPropertyDescriptor(fallback, 'url').get.bind(fallback);
  const base = Object.fromEntries(['w', 'h', 'top', 'levels', 'flash', 'near'].map(k => [k, fallback[k]]));
  let oldUrl = null, frame = null, entry = null;
  const start = () => {
    if (entry) return;
    entry = picture(url, 256, image => {
      frame = sprite(image, url);
      if (oldUrl) for (const img of document.querySelectorAll('img')) if (img.getAttribute('src') === oldUrl) img.src = url;
      return frame;
    });
  };
  for (const key of Object.keys(base)) Object.defineProperty(fallback, key, {
    configurable: true, enumerable: true, get() { start(); return frame ? frame[key] : base[key]; },
  });
  Object.defineProperty(fallback, 'url', { configurable: true, get() {
    start(); return frame ? url : oldUrl || (oldUrl = originalUrl());
  } });
  return fallback;
}
function heldFrame(meta) {
  const entry = picture(meta.path, 256, image => ({ img: canvas(image), ax: meta.grip[0], ay: meta.grip[1], at: { min: meta.bounds.slice(0, 2), max: meta.bounds.slice(2), ...(meta.nocks || {}), ...(meta.tip ? { tip: meta.tip.slice() } : {}) } }));
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
  const meta = family?.find(m => m.pose === pose && m.two === !!two && m.lit === !!lit);
  if (!meta) return null;
  // A whole weapon family switches together, so the first swing cannot mix
  // painted and procedural poses while individual frames are still loading.
  const frames = family.map(heldFrame);
  return frames.every(Boolean) ? frames[family.indexOf(meta)] : null;
}
const carriedFrames = new Map(Object.values(PAINTED.carried).map(meta => [meta.cls + '|' + meta.id, meta]));
export function paintedCarried(id, cls) {
  const meta = carriedFrames.get(cls + '|' + id);
  return meta ? heldFrame(meta) : null;
}
export function paintedImpact(family, index) {
  // Prepare the complete family together; an unfinished family stays procedural.
  const entries = [0, 1, 2, 3].map(i => picture(PAINTED.effects[family + '_' + i], 256, canvas));
  return entries.every(e => e.state === 'ready') ? entries[index].value : null;
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
  const catalog = PAINTED.themes[index], entries = {};
  let revision = 0;
  // Theme images are tiny native64 assets, decoded outside the render loop.
  for (const [key, url] of Object.entries(catalog)) entries[key] = picture(url, 64, image => {
    if (/^(floor|ceil)/.test(key)) { const material = levels(image); revision++; return material; }
    return canvas(image);
  });
  const value = key => entries[key]?.value;
  return new Proxy(original, { get(t, k) {
    if (k === 'artRevision') return revision;
    if (k === 'floorOf') return n => value(n ? 'floor' + n : 'floor') || t.floorOf(n);
    if (k === 'ceilOf') return n => value(n ? 'ceil' + n : 'ceiling') || t.ceilOf(n);
    if (k === 'ceil') return value('ceiling') || t.ceil;
    if (k === 'torchFrames') return [0, 1, 2].every(i => value('torch' + i)) ? [0, 1, 2].map(i => value('torch' + i)) : t.torchFrames;
    // Exact stair alpha, coloured lock plates and regional decoration stay authored.
    return value(k) || t[k];
  } });
}
export function paintedWorldState() {
  return Object.fromEntries([...pending].map(([url, e]) => [url, e.state]));
}
