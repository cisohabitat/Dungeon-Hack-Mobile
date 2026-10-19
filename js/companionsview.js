import { COMPANIONS, companionBook, recoverCompanions } from './companionbook.js';
import { Assets } from './assets.js';

/** Shared collection for the title and Journal. Unmet entries reveal no portrait. */
export function renderCompanions(root, state = null) {
  recoverCompanions(state);
  const known = companionBook(), ids = Object.keys(COMPANIONS).sort((a, b) => Number(!known.includes(a)) - Number(!known.includes(b)));
  root.innerHTML = '<p class="dim small">Companions your heroes have met, remembered across delves. Meet them to reveal their portraits; they need not join you. Tap a portrait to look closer.</p><div class="beasts">' + ids.map(id => {
    if (!known.includes(id)) return `<div class="beast unmet" data-companion="${id}"><div><h3>???</h3><p class="locked">Not yet met.</p></div></div>`;
    const c = COMPANIONS[id];
    return `<div class="beast" data-companion="${id}"><img class="beast-art bestiary-portrait" data-companion-portrait="${id}" alt="${c.name}" role="button" tabindex="0" aria-pressed="false" aria-label="Look closer at the ${c.name}"><div><h3>${c.name}</h3><p>${c.lore}</p><p>${c.role}</p></div></div>`;
  }).join('') + '</div>';
  for (const img of root.querySelectorAll('img[data-companion-portrait]')) {
    const face = /** @type {HTMLImageElement} */ (img), id = face.dataset.companionPortrait;
    face.onerror = () => { face.onerror = null; const sprite = Assets.sprites[COMPANIONS[id].sprite]; if (sprite) face.src = sprite.url; };
    face.src = `img/companions/${id}.webp`;
  }
  const zoom = e => {
    const face = e.target;
    if (!(face instanceof HTMLImageElement) || !face.dataset.companionPortrait || (e.type === 'keydown' && !['Enter', ' '].includes(e.key))) return;
    if (e.type === 'keydown') e.preventDefault();
    face.setAttribute('aria-pressed', String(face.classList.toggle('zoom')));
  };
  root.onclick = zoom; root.onkeydown = zoom;
  return `${known.length} of ${ids.length} met`;
}
