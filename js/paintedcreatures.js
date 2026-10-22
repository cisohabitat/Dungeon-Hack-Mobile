// Painted dungeon poses keep their procedural counterparts as immediate fallbacks.
// Rendering only asks for a cached picture; decoding and shading happen between frames.
const links = new WeakMap();
const poses = ['idle', 'stepA', 'stepB', 'windup', 'strike', 'recover', 'special', 'hurt', 'blink'];
const shades = [0, 0.25, 0.45, 0.62, 0.78];
const palettes = new Map();
let image = null, state = 'idle';

function bindPaintedCreature(sprite, pose = 'idle', tint = '') {
  links.set(sprite, { pose, tint });
}

function canvas() {
  const c = document.createElement('canvas'); c.width = c.height = 256; return c;
}

function wash(base, colour, amount) {
  const c = canvas(), ctx = c.getContext('2d');
  ctx.drawImage(base, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = colour; ctx.globalAlpha = amount; ctx.fillRect(0, 0, 256, 256);
  return c;
}

function palette(tint) {
  if (palettes.has(tint)) return;
  palettes.set(tint, null);
  const frames = {};
  let i = 0;
  const next = () => {
    try {
      const base = canvas(), ctx = base.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(image, i % 3 * 256, Math.floor(i / 3) * 256, 256, 256, 0, 0, 256, 256);
      const pixels = ctx.getImageData(0, 0, 256, 256).data;
      let top = 256;
      for (let p = 3; p < pixels.length; p += 4) if (pixels[p] > 32) { top = Math.floor((p - 3) / 4 / 256); break; }
      const coloured = tint ? wash(base, tint, 0.4) : base;
      frames[poses[i]] = {
        w: 256, h: 256, top: top / 256, near: null,
        levels: shades.map(a => a ? wash(coloured, '#000', a) : coloured),
        flash: wash(base, '#fff', 0.85),
      };
      if (++i < poses.length) setTimeout(next, 0);
      else { palettes.set(tint, frames); if (!tint) state = 'ready'; }
    } catch { state = 'failed'; }
  };
  setTimeout(next, 0);
}

function load() {
  state = 'loading'; image = new Image();
  image.onload = () => {
    if (image.naturalWidth !== 768 || image.naturalHeight !== 768) { state = 'failed'; return; }
    palette('');
  };
  image.onerror = () => { state = 'failed'; };
  image.src = 'img/creatures/drow_warrior.webp';
}

function paintedCreature(sprite) {
  const link = links.get(sprite);
  if (!link) return sprite;
  if (state === 'idle') load();
  if (state !== 'ready') return sprite;
  const frames = palettes.get(link.tint);
  if (!frames) { palette(link.tint); return sprite; }
  return frames[link.pose] || sprite;
}

export { bindPaintedCreature, paintedCreature };
