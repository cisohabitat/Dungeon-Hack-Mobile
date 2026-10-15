// The keepers have painted faces for their introduction and the bestiary;
// their creatures in the dungeon keep the same poses and warning marks.
import { Assets } from './assets.js';

const PORTRAITS = { lich: 'lich', warlord: 'warlord', heartforged: 'heartforged' };
export const bossPortrait = id => PORTRAITS[id] ? `img/bosses/${PORTRAITS[id]}.webp` : '';

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
