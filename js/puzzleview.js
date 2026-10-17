// The same four real buttons work by touch, keyboard and controller. Names
// carry every clue; neither colour nor sound is needed to answer one.
import { Game } from './game.js';
import { $, escapeHtml } from './uikit.js';
import { PUZZLE_MARKS, PUZZLE_WORDS } from './puzzledata.js';

let armedAt = 0, solvedBefore = false;
export function renderPuzzle(close, opening = false) {
  const q = Game.currentPuzzle();
  if (!q) { close(); return; }
  if (opening || (q.solved && !solvedBefore)) armedAt = performance.now() + 350;
  solvedBefore = q.solved;
  const guarded = (btn, fn, full = false) => {
    const wait = Math.max(0, armedAt - performance.now());
    btn.disabled = full || wait > 0;
    if (wait && !full) setTimeout(() => { btn.disabled = false; }, wait);
    btn.addEventListener('click', () => { if (performance.now() >= armedAt) fn(); });
  };
  const words = PUZZLE_WORDS[q.kind];
  $('#puzzle-title').textContent = words.title;
  $('#puzzle-text').textContent = q.solved ? PUZZLE_WORDS.solved : words.text;
  $('#puzzle-hint').textContent = PUZZLE_WORDS.hint;
  $('#puzzle-feedback').textContent = q.feedback ? PUZZLE_WORDS[q.feedback] : '';
  const clue = q.kind === 'seals'
    ? words.clue.replace('{a}', PUZZLE_MARKS[q.order[1]]).replace('{b}', PUZZLE_MARKS[q.order[2]]).replace('{c}', PUZZLE_MARKS[q.order[3]])
    : words.clue + ' ' + (q.kind === 'runes' ? q.order.map(i => PUZZLE_MARKS[i]).join(' → ')
      : PUZZLE_MARKS.filter((_, i) => q.target & (1 << i)).join(' and ')) + '.';
  $('#puzzle-clue').textContent = clue;
  $('#puzzle-progress').textContent = q.kind === 'runes' ? `Pressed: ${q.input.map(i => PUZZLE_MARKS[i]).join(' → ') || 'none'} (${q.input.length}/4)`
    : q.kind === 'torches' ? `Burning: ${PUZZLE_MARKS.filter((_, i) => q.lit[i]).join(', ') || 'none'}`
      : `Chosen: ${q.input.length ? PUZZLE_MARKS[q.input[0]] : 'none'}`;
  const el = $('#puzzle-controls');
  const focused = document.activeElement?.id;
  el.innerHTML = '';
  if (!q.solved) {
    const grid = document.createElement('div'); grid.className = 'puzzle-marks';
    PUZZLE_MARKS.forEach((name, i) => {
      const btn = document.createElement('button'); btn.type = 'button'; btn.id = `puzzle-mark-${i}`;
      const selected = q.kind === 'torches' ? q.lit[i] : q.kind === 'seals' && q.input[0] === i;
      btn.innerHTML = `<b>${escapeHtml(name)}</b>${q.kind === 'torches' ? `<small>${selected ? 'Lit' : 'Dark'}</small>` : ''}`;
      if (q.kind !== 'runes') btn.setAttribute('aria-pressed', String(!!selected));
      guarded(btn, () => { Game.puzzleAction('mark', i); renderPuzzle(close); }, q.kind === 'runes' && q.input.length >= 4);
      grid.appendChild(btn);
    });
    el.appendChild(grid);
    for (const [id, label, act] of [['puzzle-submit', 'Try the catch', 'submit'], ['puzzle-reset', 'Start again', 'reset']]) {
      const btn = document.createElement('button'); btn.type = 'button'; btn.id = id; btn.textContent = label;
      guarded(btn, () => { Game.puzzleAction(act); renderPuzzle(close); }); el.appendChild(btn);
    }
  }
  const leave = document.createElement('button'); leave.type = 'button'; leave.id = 'puzzle-leave';
  leave.textContent = q.solved ? 'Continue' : 'Leave for later';
  guarded(leave, close); el.appendChild(leave);
  if (focused && focused.startsWith('puzzle-')) {
    const next = document.getElementById(focused);
    const target = next || (q.solved ? leave : $('#puzzle-submit'));
    (/** @type {HTMLButtonElement} */ (target).disabled ? $('#puzzle-clue') : target).focus({ preventScroll: true });
  }
}
