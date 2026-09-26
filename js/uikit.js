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
