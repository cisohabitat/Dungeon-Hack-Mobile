import { bindCollectionGallery } from './collectionview.js';
import { COMPANIONS, companionBook, recoverCompanions } from './companionbook.js';
import { Game } from './game.js';
import { escapeHtml } from './uikit.js';
import { Assets } from './assets.js';
import { companionMilestones } from './companion.js';
import { COMPANION_REACTIONS } from './data.js';
import { visitedPlace } from './rooms.js';

/** Shared collection for the title and Journal. Unmet entries reveal no portrait. */
export function renderCompanions(root, state = null) {
  recoverCompanions(state);
  const known = companionBook(), ids = Object.keys(COMPANIONS).sort((a, b) => Number(!known.includes(a)) - Number(!known.includes(b)));
  root.innerHTML = companionCard(state) + '<p class="dim small">Companions your heroes have met, remembered across delves. Meet them to reveal their portraits; they need not join you. Tap a portrait to look closer.</p><div class="beasts">' + ids.map(id => {
    if (!known.includes(id)) return `<div class="beast unmet" data-companion="${id}"><div><h3>???</h3><p class="locked">Not yet met.</p></div></div>`;
    const c = COMPANIONS[id];
    return `<div class="beast" data-companion="${id}"><img class="beast-art bestiary-portrait" data-companion-portrait="${id}" alt="${c.name}" role="button" tabindex="0" aria-pressed="false" aria-label="Look closer at the ${c.name}"><div><h3>${c.name}</h3><p>${c.lore}</p><p>${c.role}</p></div></div>`;
  }).join('') + '</div>';
  for (const img of root.querySelectorAll('img[data-companion-portrait]')) {
    const face = /** @type {HTMLImageElement} */ (img), id = face.dataset.companionPortrait;
    face.onerror = () => { face.onerror = null; const sprite = Assets.sprites[COMPANIONS[id].sprite]; if (sprite) face.src = sprite.url; };
    face.src = `img/companions/${id}.webp`;
  }
  for (const button of root.querySelectorAll('[data-companion-order]')) button.addEventListener('click', () => {
    if (Game.commandCompanion(button.dataset.companionOrder)) {
      renderCompanions(root, state);
      root.querySelector(`[data-companion-order="${button.dataset.companionOrder === 'stay' ? 'follow' : 'stay'}"]`)?.focus();
    }
  });
  const zoom = e => {
    const face = e.target;
    if (!(face instanceof HTMLImageElement) || !face.dataset.companionPortrait || (e.type === 'keydown' && !['Enter', ' '].includes(e.key))) return;
    if (e.type === 'keydown') e.preventDefault();
    face.setAttribute('aria-pressed', String(face.classList.toggle('zoom')));
  };
  root.onclick = zoom; root.onkeydown = zoom;
  bindCollectionGallery(root, '.beasts');
  return `${known.length} of ${ids.length} met`;
}

/** Live state beside the current companion's portrait, including one left behind. */
export function companionCard(state) {
  const c = state?.companion;
  if (!c) return '';
  const id = Object.hasOwn(COMPANIONS, c.kind) ? c.kind : 'hound', def = COMPANIONS[id];
  const condition = c.fallen ? `Fallen on floor ${Number(c.fallen)}` : c.depth !== state.depth ? `Waiting on floor ${Number(c.depth)}` : c.mode === 'stay' ? 'Staying here' : 'Following';
  const reason = Game.companionCommandReason(), playing = state.status === 'playing';
  const rank = (c.floors || 0) >= 4 ? 'Veteran' : (c.floors || 0) >= 2 ? 'Blooded' : 'New companion';
  const here = !c.fallen && c.depth === state.depth && c.mode !== 'stay';
  const L = state.levels[state.depth], place = L && visitedPlace(L);
  const mood = state.status === 'won' ? 'won' : c.hp <= c.maxHp / 3 || state.player.hp <= state.player.maxHp / 3 ? 'danger' : place && L.roomId[state.player.y * L.w + state.player.x] === place.room ? 'place' : 'quiet';
  const reaction = here ? `<p class="companion-reaction">${escapeHtml(c.name)} ${escapeHtml(COMPANION_REACTIONS[id][mood])}</p>` : '';
  const milestones = '<div class="companion-milestones"><h4>Travelling together</h4>' + companionMilestones(c).map(t => `<div class="companion-milestone${t.learned ? ' learned' : ''}"><b>${t.learned ? '✦ ' : ''}${escapeHtml(t.name)}</b><p>${escapeHtml(t.learned ? t.says : c.fallen ? 'Not learned on this delve.' : `Learned after ${t.remaining} more floor${t.remaining === 1 ? '' : 's'} down at your side.`)}</p></div>`).join('') + '</div>';
  return `<section class="companion-card"><img data-companion-portrait="${id}" class="beast-art bestiary-portrait" alt="${def.name}" role="button" tabindex="0" aria-pressed="false" aria-label="Look closer at the ${def.name}"><div><h3>${escapeHtml(c.name)} · ${def.name}</h3><p>${condition} · ${rank}</p><label>Life <progress max="${Number(c.maxHp)}" value="${Math.max(0, Number(c.hp))}"></progress> ${Number(c.hp)}/${Number(c.maxHp)}</label>${reaction}</div><div class="companion-record">${milestones}<details class="companion-history"><summary>Companion record</summary><p class="small">${escapeHtml(Game.companionNote())}</p></details>${playing ? `<div class="companion-orders" role="group" aria-label="Companion orders">${[['follow', 'Follow'], ['stay', 'Stay']].map(([mode, label]) => `<button type="button" data-companion-order="${mode}" aria-pressed="${c.mode === mode}" ${reason || c.mode === mode ? 'disabled' : ''}>${label}</button>`).join('')}</div><p class="dim small">${escapeHtml(reason || 'Orders use the same action as Use while facing your companion.')}</p>` : ''}</div></section>`;
}
