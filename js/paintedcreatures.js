import { PAINTED } from './paintedcatalog.js';
// Painted dungeon poses keep their procedural counterparts as immediate fallbacks.
// Rendering only asks for a cached picture; decoding and shading happen between frames.
const links = new WeakMap();
const poses = ['idle', 'stepA', 'stepB', 'windup', 'strike', 'recover', 'special', 'hurt', 'blink'];
const shades = [0, 0.25, 0.45, 0.62, 0.78];
const kinds = new Set(['drow_warrior', 'hound', 'wyrm', 'lizardfolk', 'dwarf_arbalest', 'slime', 'rustmaw', 'skarrow', 'drow_mage', 'grey_dwarf', 'lizard_shaman', 'eyeless', 'puffcap', 'rat', 'bat', 'spider', 'goblin', 'skeleton', 'zombie', 'orc', 'ghoul', 'wraith', 'ogre', 'troll', 'minotaur', 'kobold', 'archer', 'basilisk', 'acolyte', 'moth', 'thornhog', 'imp', 'cutpurse', 'lookout', 'hexer', 'pikeman', 'quillback', 'drowned', 'emberling', 'mimic', 'lich', 'heartforged', 'warlord', 'shade', 'grisk', 'vessra', 'ushgar', 'morrow', 'orla', 'gorrum', 'vaelith', 'hissra', 'durgrim']);
for (const kind of Object.keys(PAINTED.atlases)) kinds.add(kind);
const atlases = new Map();
const companionKinds = new Set(['dog', 'wolf', 'scrag', 'sellsword', 'mender', 'renegade']);

function bindPaintedCreature(sprite, kind, pose = 'idle', tint = '') {
  if (kinds.has(kind)) links.set(sprite, { kind: kind === 'mender' && pose === 'heal' ? 'mender-heal' : kind, pose, tint });
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
      const name = companionKinds.has(atlas.kind) && i === 6 ? 'sit' : atlas.kind === 'mender-heal' ? 'heal' : poses[i];
      frames[name] = {
        w: 256, h: 256, top: top / 256, near: null,
        levels: shades.map(a => a ? wash(coloured, '#000', a) : coloured),
        flash: wash(base, '#fff', 0.85),
      };
      if (++i < (atlas.kind === 'mender-heal' ? 1 : poses.length)) setTimeout(next, 0);
      else { palettes.set(tint, frames); if (!tint) atlas.state = 'ready'; }
    } catch { atlas.state = 'failed'; }
  };
  setTimeout(next, 0);
}

function load(kind) {
  const atlas = { kind, state: 'loading', image: new Image(), palettes: new Map(), requestedAt: performance.now() };
  atlases.set(kind, atlas);
  const { image } = atlas;
  image.onload = () => {
    const size = kind === 'mender-heal' ? 256 : 768;
    if (image.naturalWidth !== size || image.naturalHeight !== size) { atlas.state = 'failed'; return; }
    palette(atlas, '');
  };
  image.onerror = () => { atlas.state = 'failed'; };
  image.src = `img/creatures/${kind}.webp`;
  return atlas;
}

function paintedCreature(sprite, variant = '') {
  const link = links.get(sprite);
  if (!link) return sprite;
  const kind = variant || link.kind;
  if (!kinds.has(kind)) return sprite;
  const atlas = atlases.get(kind) || load(kind);
  if (atlas.state !== 'ready') return sprite;
  const frames = atlas.palettes.get(link.tint);
  if (!frames) { palette(atlas, link.tint); return sprite; }
  return frames[link.pose] || sprite;
}

export { bindPaintedCreature, paintedCreature };

// Let a requested atlas decode before queuing a costly close-up fallback.
// A slow or failed image still gets the original refinement; this grace only
// affects picture preparation, never the creature's actions or visibility.
export function deferCreatureDetail(sprite, variant = '') {
  const link = links.get(sprite), kind = variant || link?.kind;
  if (!link || !kinds.has(kind)) return false;
  const atlas = atlases.get(kind);
  return !!atlas && atlas.state !== 'failed' && !atlas.palettes.get(link.tint)?.[link.pose]
    && performance.now() - atlas.requestedAt < 500;
}

// End-card exports wait only for their own pictures, never the world's queue.
// Failed or unbound art is settled too: its existing fallback remains usable.
export function paintedCreatureSettled(sprite) {
  const link = links.get(sprite);
  if (!link) return true;
  const atlas = atlases.get(link.kind);
  return !!atlas && (atlas.state === 'failed' || (atlas.state === 'ready' && !!atlas.palettes.get(link.tint)));
}

// Keep a shot's weapon through its strike and recovery without adding saved game state.
const shotCycles = new WeakMap();
function monsterPaintKind(m, now) {
  if (m.id === 'heartforged') return m.phase >= 2 ? 'heartforged_whitehot' : m.phase === 1 ? 'heartforged_open' : '';
  if (m.id === 'mimic' && m.disguise !== 'chest') return 'mimic_barrel';
  if (m.id !== 'warlord' || m.phase !== 1) { shotCycles.delete(m); return ''; }
  if (m.throne) return 'warlord_throne';
  if (m.windup?.kind === 'shot') { shotCycles.set(m, m.lungeAt ?? -1e9); return 'warlord_spear'; }
  if (m.windup) { shotCycles.delete(m); return ''; }
  const prior = shotCycles.get(m);
  if (prior !== undefined && m.lungeAt > prior && now >= m.lungeAt && now - m.lungeAt < 300) return 'warlord_spear';
  shotCycles.delete(m); return '';
}
export { monsterPaintKind };
