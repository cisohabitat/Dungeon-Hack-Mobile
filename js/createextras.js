// What a player has earned to start a run with, on the hero's making: the
// class's second kit, once a win with it has opened it, and a hound from the
// first stair, once a veteran companion has seen a hero through. Each shows
// as a choice once open, and as a locked line saying how to earn it before;
// ui.js keeps the choice in its `create` and passes it into the run's options.
import { CLASSES } from './data.js';
import { Progress } from './progress.js';
import { escapeHtml } from './uikit.js';

/**
 * Fill el with the start's choices for this class, and call back when one changes.
 * @param {HTMLElement} el
 * @param {{cls: string, kit: string, hound: boolean}} create
 * @param {() => void} changed
 */
export function renderStart(el, create, changed) {
  const v = Progress.load(), c = CLASSES[create.cls];
  const kitOpen = Progress.kitOpen(create.cls, v), houndOpen = Progress.houndOpen(v);
  if (!kitOpen) create.kit = '';
  if (!houndOpen) create.hound = false;
  const alt = c && c.altKit;
  const kitLine = !alt ? ''
    : kitOpen ? `<div class="seg kit-seg" role="radiogroup" aria-label="Starting kit">`
      + `<button type="button" role="radio" data-kit="" aria-checked="${!create.kit}" class="${create.kit ? '' : 'on'}">Standard kit</button>`
      + `<button type="button" role="radio" data-kit="alt" aria-checked="${create.kit === 'alt'}" class="${create.kit === 'alt' ? 'on' : ''}">${escapeHtml(alt.name)}</button></div>`
      + `<p class="dim small kit-note">${escapeHtml(create.kit === 'alt' ? alt.desc : 'The kit every ' + c.name + ' starts with.')}</p>`
    : `<p class="dim small kit-note locked-line">${escapeHtml(alt.name)}: locked. Win as a ${escapeHtml(c.name)} on Normal or Hard to unlock it.</p>`;
  const houndLine = houndOpen
    ? `<label class="check"><input type="checkbox" id="c-hound"${create.hound ? ' checked' : ''}> <span><b>A hound from the first stair</b>: start with a hound at your side.</span></label>`
    : '<p class="dim small locked-line">A hound from the first stair: locked. Win with a veteran companion at your side to unlock it.</p>';
  el.innerHTML = kitLine + houndLine;
  el.hidden = false;
  for (const b of el.querySelectorAll('[data-kit]')) b.addEventListener('click', () => { create.kit = /** @type {HTMLElement} */ (b).dataset.kit || ''; changed(); });
  const box = /** @type {HTMLInputElement|null} */ (el.querySelector('#c-hound'));
  if (box) box.addEventListener('change', () => { create.hound = box.checked; });
}
