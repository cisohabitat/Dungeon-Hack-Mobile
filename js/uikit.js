// Small helpers every screen uses: finding elements, making text safe to
// put in HTML, and naming a run's difficulty.

/** @param {string} s @returns {any} */
export const $ = s => document.querySelector(s);
/** @param {string} s @returns {any[]} */
export const $$ = s => Array.from(document.querySelectorAll(s));
/** @param {any} s */
export function escapeHtml(s) { return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
/** @param {string} s */
export const upFirst = s => s.charAt(0).toUpperCase() + s.slice(1);
/** A run's difficulty; a save from before there was a choice is normal. */
export const diffOf = o => (o && (o.difficulty === 'easy' || o.difficulty === 'hard') ? o.difficulty : 'normal');
/** @param {string} d */
export const diffName = d => d.charAt(0).toUpperCase() + d.slice(1);

// The controls' icons: one set of line drawings, all on the same 24-square
// grid with the same stroke, coloured by the button they sit in. They used to
// be characters from whatever font the phone had, and some phones drew the
// arrows as coloured emoji, out of keeping with each other and the game.
const ICON_PATHS = {
  turnL: '<path d="M16 20v-7a6 6 0 0 0-6-6H5"/><path d="M9 3 5 7l4 4"/>',
  turnR: '<path d="M8 20v-7a6 6 0 0 1 6-6h5"/><path d="m15 3 4 4-4 4"/>',
  up: '<path d="M12 20V5"/><path d="m5 11 7-7 7 7"/>',
  down: '<path d="M12 4v15"/><path d="m5 13 7 7 7-7"/>',
  left: '<path d="M20 12H5"/><path d="m11 5-7 7 7 7"/>',
  right: '<path d="M4 12h15"/><path d="m13 5 7 7-7 7"/>',
  attack: '<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="m13 19 6-6"/><path d="m16 16 4 4"/><path d="m19 21 2-2"/><path d="M14.5 6.5 18 3h3v3l-3.5 3.5"/><path d="m5 14 4 4"/><path d="m7 17-3 3"/><path d="m3 19 2 2"/>',
  use: '<path d="M18 11V6a2 2 0 0 0-4 0v1"/><path d="M14 10V4a2 2 0 0 0-4 0v2"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.3l-3.6-3.6a2 2 0 0 1 2.8-2.8L7 15"/>',
  cast: '<path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z"/><path d="M19 15l.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7z"/>',
  bash: '<path d="M12 21s7-3.5 7-9V5.5L12 3 5 5.5V12c0 5.5 7 9 7 9z"/><path d="M12 8v6"/><path d="M9 11h6"/>',
  smoke: '<path d="M7 18a4 4 0 0 1-.5-8 5.5 5.5 0 0 1 10.6-1.2A4 4 0 0 1 17 18z"/><path d="M5 21h4"/><path d="M12 21h7"/>',
  snare: '<circle cx="12" cy="9" r="5"/><path d="M12 14v7"/><path d="M9 21h6"/>',
  flask: '<path d="M9 3h6"/><path d="M10 3v6L5 18a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3L14 9V3"/><path d="M7.5 15h9"/>',
};
/** A control's icon, as markup to set inside it. @param {string} name */
export function icon(name) {
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ''}</svg>`;
}
