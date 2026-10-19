import { RELICS } from './relics.js';

/** Bind only already revealed relics; small gameplay sprites remain unchanged. */
export function fillRelicPortraits(root) {
  for (const node of root.querySelectorAll('img[data-relic-portrait]')) {
    const img = /** @type {HTMLImageElement} */ (node), id = img.dataset.relicPortrait;
    if (!Object.hasOwn(RELICS, id)) continue;
    const fallback = img.getAttribute('src');
    img.classList.add('relic-portrait');
    img.alt = RELICS[id].name;
    img.tabIndex = 0;
    img.setAttribute('role', 'button');
    img.setAttribute('aria-label', `Look closer at ${RELICS[id].name}`);
    img.setAttribute('aria-pressed', 'false');
    img.onerror = () => {
      img.onerror = null;
      img.classList.remove('relic-portrait');
      img.src = fallback;
    };
    const toggle = () => img.setAttribute('aria-pressed', String(img.classList.toggle('zoom')));
    img.onclick = toggle;
    img.onkeydown = event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault(); toggle();
    };
    img.src = `img/relics/${id}.webp`;
  }
}
