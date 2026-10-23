// Painted dungeon poses keep their procedural counterparts as immediate fallbacks.
// Rendering only asks for a cached picture; decoding and shading happen between frames.
const links = new WeakMap();
const poses = ['idle', 'stepA', 'stepB', 'windup', 'strike', 'recover', 'special', 'hurt', 'blink'];
const shades = [0, 0.25, 0.45, 0.62, 0.78];
const kinds = new Set(['drow_warrior', 'hound', 'wyrm', 'lizardfolk', 'dwarf_arbalest', 'slime', 'rustmaw', 'skarrow', 'drow_mage', 'grey_dwarf', 'lizard_shaman', 'eyeless', 'puffcap', 'rat', 'bat', 'spider', 'goblin', 'skeleton', 'zombie', 'orc', 'ghoul', 'wraith', 'ogre', 'troll', 'minotaur', 'kobold', 'archer', 'basilisk', 'acolyte', 'moth', 'thornhog', 'imp', 'cutpurse']);
const atlases = new Map();

function bindPaintedCreature(sprite, kind, pose = 'idle', tint = '') {
  if (kinds.has(kind)) links.set(sprite, { kind, pose, tint });
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

function palette(atlas, tint) {
  const { palettes, image } = atlas;
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
      else { palettes.set(tint, frames); if (!tint) atlas.state = 'ready'; }
    } catch { atlas.state = 'failed'; }
  };
  setTimeout(next, 0);
}

function load(kind) {
  const atlas = { state: 'loading', image: new Image(), palettes: new Map() };
  atlases.set(kind, atlas);
  const { image } = atlas;
  image.onload = () => {
    if (image.naturalWidth !== 768 || image.naturalHeight !== 768) { atlas.state = 'failed'; return; }
    palette(atlas, '');
  };
  image.onerror = () => { atlas.state = 'failed'; };
  image.src = `img/creatures/${kind}.webp`;
  return atlas;
}

function paintedCreature(sprite) {
  const link = links.get(sprite);
  if (!link) return sprite;
  const atlas = atlases.get(link.kind) || load(link.kind);
  if (atlas.state !== 'ready') return sprite;
  const frames = atlas.palettes.get(link.tint);
  if (!frames) { palette(atlas, link.tint); return sprite; }
  return frames[link.pose] || sprite;
}

export { bindPaintedCreature, paintedCreature };
