import { Game } from './game.js';
import { Progress } from './progress.js';
import { RELICS, RELIC_SETS } from './relics.js';
import { escapeHtml } from './uikit.js';

/** Collection discovery and current equipment are separate, visible counts. */
export function setTracker() {
  const found = Progress.load().relics, active = Game.state()?.status === 'playing', p = active ? Game.player() : null;
  const worn = p ? Object.values(p.eq).filter(it => it && !it.h && Game.isKnown(it.t)) : [];
  const carried = p ? [...p.inv, ...worn].filter(it => !it.h && Game.isKnown(it.t)) : [];
  return '<details class="set-tracker"><summary>Relic sets</summary>' + Object.entries(RELIC_SETS).map(([id, set]) => {
    const discovered = set.pieces.filter(u => found.includes(u)).length, equipped = set.pieces.filter(u => worn.some(it => it.u === u)).length;
    const complete = active && Game.setWorn(id) && equipped === set.pieces.length;
    return `<section data-set="${id}"><h3>${escapeHtml(set.name)}</h3><p>${discovered}/${set.pieces.length} discovered${active ? ` · ${equipped}/${set.pieces.length} worn · ${complete ? 'Bonus active' : 'Bonus inactive'}` : ''}</p><ul>`
      + set.pieces.map(u => `<li>${found.includes(u) || carried.some(it => it.u === u) ? escapeHtml(RELICS[u].name) : 'Undiscovered piece'}${worn.some(it => it.u === u) ? ' · Worn' : carried.some(it => it.u === u) ? ' · In pack' : ''}</li>`).join('')
      + `</ul><p class="dim small">${escapeHtml(set.text)}</p></section>`;
  }).join('') + '</details>';
}
