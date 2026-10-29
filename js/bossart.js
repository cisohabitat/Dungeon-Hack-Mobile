// The keepers have painted faces for their introduction and the bestiary;
// their creatures in the dungeon keep the same poses and warning marks.
import { Assets } from './assets.js';

const PORTRAITS = { lich: 'lich', warlord: 'warlord', heartforged: 'heartforged' };
export const bossPortrait = id => PORTRAITS[id] ? `img/bosses/${PORTRAITS[id]}.webp` : '';

// Face crops from the approved512px introduction paintings. Keep the source
// intact; the small live bar only samples these rectangles while drawing.
const FACE = { lich: [180, 12, 200], warlord: [160, 12, 208], heartforged: [190, 8, 200] };
const faces = new Map();
export function bossPortraitFace(id) {
  if (!Object.hasOwn(FACE, id)) return null;
  let face = faces.get(id);
  if (!face) {
    const img = new Image(), [x, y, size] = FACE[id];
    face = { img, x, y, size, state: 'loading' };
    faces.set(id, face);
    img.onload = () => { face.state = img.naturalWidth === 512 && img.naturalHeight === 512 ? 'ready' : 'failed'; };
    img.onerror = () => { face.state = 'failed'; };
    img.src = bossPortrait(id);
  }
  return face.state === 'ready' ? face : null;
}
export const bossFaceState = id => faces.get(id)?.state || 'unrequested';

/** A missing painting never holds up an introduction or a bestiary entry.
 * @param {HTMLElement} root */
export function fillBossPortraits(root) {
  for (const img of root.querySelectorAll('img[data-boss-portrait]')) {
    const face = /** @type {HTMLImageElement} */ (img), id = face.dataset.bossPortrait;
    face.onerror = () => {
      face.onerror = null;
      const art = Assets.sprites[id];
      if (art) face.src = art.url;
    };
    face.src = bossPortrait(id);
  }
}
