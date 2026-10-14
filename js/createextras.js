// What a player has earned to start a run with, on the hero's making: the
// class's second kit, once a win with it has opened it, and a hound from the
// first stair, once a veteran companion has seen a hero through. Each shows
// as a choice once open, and as a locked line saying how to earn it before;
// ui.js keeps the choice in its `create` and passes it into the run's options.
// And, on Hard, the rungs of the ladder past it this class has opened.
import { CLASSES, LADDER, MASTERY } from './data.js';
import { Progress } from './progress.js';
import { RELICS } from './relics.js';
import { escapeHtml } from './uikit.js';

/**
 * Fill el with the start's choices for this class, and call back when one changes.
 * @param {HTMLElement} el
 * @param {{cls: string, kit: string, hound: boolean, relic: string}} create
 * @param {() => void} changed
 */
export function renderStart(el, create, changed) {
  const v = Progress.load(), c = CLASSES[create.cls];
  const kitOpen = Progress.kitOpen(create.cls, v), houndOpen = Progress.houndOpen(v), kit3Open = Progress.kit3Open(create.cls, v);
  if (!kitOpen || (create.kit === 'third' && !kit3Open)) create.kit = '';
  if (!houndOpen) create.hound = false;
  const alt = c && c.altKit, third = c && c.thirdKit;
  const kitLine = !alt ? ''
    : kitOpen ? `<div class="seg kit-seg" role="radiogroup" aria-label="Starting kit">`
      + `<button type="button" role="radio" data-kit="" aria-checked="${!create.kit}" class="${create.kit ? '' : 'on'}">Standard kit</button>`
      + `<button type="button" role="radio" data-kit="alt" aria-checked="${create.kit === 'alt'}" class="${create.kit === 'alt' ? 'on' : ''}">${escapeHtml(alt.name)}</button>`
      + (kit3Open && third ? `<button type="button" role="radio" data-kit="third" aria-checked="${create.kit === 'third'}" class="${create.kit === 'third' ? 'on' : ''}">${escapeHtml(third.name)}</button>` : '') + '</div>'
      + `<p class="dim small kit-note">${escapeHtml(create.kit === 'third' && third ? third.desc : create.kit === 'alt' ? alt.desc : 'The kit every ' + c.name + ' starts with.')}</p>`
      + (third && !kit3Open ? `<p class="dim small kit-note locked-line">${escapeHtml(third.name)}: locked. ${escapeHtml(Progress.stageNeed(create.cls, 4))} And on Hard: the fourth stage of its mastery.</p>` : '')
    : `<p class="dim small kit-note locked-line">${escapeHtml(alt.name)}: locked. Win as a ${escapeHtml(c.name)} on Normal or Hard to unlock it.</p>`;
  const houndLine = houndOpen
    ? `<label class="check"><input type="checkbox" id="c-hound"${create.hound ? ' checked' : ''}> <span><b>A hound from the first stair</b>: start with a hound at your side.</span></label>`
    : '<p class="dim small locked-line">A hound from the first stair: locked. Win with a veteran companion at your side to unlock it.</p>';
  // at the last stage of the class's mastery, a relic once found to begin with, at a quarter of the score
  const starts = Progress.codexStarts(create.cls, v);
  if (!starts.includes(create.relic)) create.relic = '';
  const relicLine = !Progress.codexOpen(create.cls, v)
    ? `<p class="dim small locked-line relic-line">A start with a relic once found: locked. ${escapeHtml(Progress.stageNeed(create.cls, 5))} The last stage of its mastery.</p>`
    : `<label class="relic-line"><span><b>Begin with a relic once found</b> <em class="vow-score">${Math.round(MASTERY.codexScore * 100)}% score</em></span>`
      + `<select id="c-relic"><option value="">None</option>${starts.map(id => `<option value="${id}"${id === create.relic ? ' selected' : ''}>${escapeHtml(RELICS[id].name)}</option>`).join('')}</select></label>`
      + (starts.length ? '' : '<p class="dim small">Every relic you find goes in the codex; none yet that this class can use.</p>');
  el.innerHTML = kitLine + houndLine + relicLine;
  el.hidden = false;
  for (const b of el.querySelectorAll('[data-kit]')) b.addEventListener('click', () => { create.kit = /** @type {HTMLElement} */ (b).dataset.kit || ''; changed(); });
  const pick = /** @type {HTMLSelectElement|null} */ (el.querySelector('#c-relic'));
  if (pick) pick.addEventListener('change', () => { create.relic = pick.value; });
  const box = /** @type {HTMLInputElement|null} */ (el.querySelector('#c-hound'));
  if (box) box.addEventListener('change', () => { create.hound = box.checked; });
}

/**
 * On Hard, the rungs of the ladder past it this class may climb: Hard itself,
 * then +1 and on to the highest opened, with every rule the chosen rung keeps,
 * and how the next is opened. Hidden off Hard, or before a class has won there.
 * @param {HTMLElement} el
 * @param {{cls: string, difficulty: string, rung: number}} create
 * @param {() => void} changed
 */
export function renderRung(el, create, changed) {
  const open = create.difficulty === 'hard' ? Progress.rungOpen(create.cls) : 0, c = CLASSES[create.cls];
  if (create.rung > open) create.rung = open;
  el.hidden = !open;
  if (!open) { el.innerHTML = ''; return; }
  const rungs = Array.from({ length: open + 1 }, (_, n) => n);
  const rules = LADDER.slice(1, create.rung + 1).map((x, i) => `<li><b>+${i + 1}</b> ${escapeHtml(x.rule)}</li>`).join('');
  const next = open < LADDER.length - 1 ? `Win on Hard+${open} as a ${c.name} to open Hard+${open + 1}.` : 'Every rung is open.';
  el.innerHTML = `<div class="seg rung-seg" role="radiogroup" aria-label="Rung past Hard">${rungs.map(n => `<button type="button" role="radio" data-rung="${n}" aria-checked="${n === create.rung}" class="${n === create.rung ? 'on' : ''}">${n ? '+' + n : 'Hard'}</button>`).join('')}</div>`
    + (rules ? `<ul class="rung-rules">${rules}</ul><p class="dim small">Each rung adds a tenth to the run's score.</p>` : '<p class="dim small">The ladder past Hard: each rung keeps one rule more, and adds a tenth to the score.</p>')
    + `<p class="dim small rung-next">${escapeHtml(next)}</p>`;
  for (const b of el.querySelectorAll('[data-rung]')) b.addEventListener('click', () => { create.rung = Number(/** @type {HTMLElement} */ (b).dataset.rung) || 0; changed(); });
}
