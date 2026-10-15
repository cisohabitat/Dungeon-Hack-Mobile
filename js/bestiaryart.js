// Every creature has a painted face in the bestiary. The keepers share the
// paintings shown at their introduction; the dungeon keeps its moving sprites.
import { MONSTERS } from './data.js';
import { Assets } from './assets.js';
import { bossPortrait } from './bossart.js';

export const bestiaryPortrait = id => MONSTERS[id] ? bossPortrait(id) || `img/bestiary/${id}.webp` : '';

/** A failed painting falls back once, to this creature's own dungeon picture.
 * @param {HTMLElement} root */
export function fillBestiaryPortraits(root) {
  for (const img of root.querySelectorAll('img[data-bestiary-portrait]')) {
    const face = /** @type {HTMLImageElement} */ (img), id = face.dataset.bestiaryPortrait;
    face.onerror = () => {
      face.onerror = null;
      const mb = MONSTERS[id], art = mb && Assets.sprites[mb.sprite];
      const own = mb && mb.named && art && art.elite && art.elite[id];
      if (own || art) face.src = (own || art).url;
    };
    face.src = bestiaryPortrait(id);
  }
}
