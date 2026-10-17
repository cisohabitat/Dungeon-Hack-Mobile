// Optional catches on treasure already laid by the floor. Separate dice keep
// both the map and the run's combat rolls exactly as they were. No key, quest
// object or relic is ever held back, and a cache never blocks a passage.
import { Rng } from './rng.js';
import { Dungeon } from './dungeon.js';
import { PUZZLE_KINDS, PUZZLE_WORDS } from './puzzledata.js';
import { Sound } from './sound.js';

/** @param {import('./types.js').Kit} K */
export function makePuzzles(K) {
  /** @type {import('./types.js').Puzzle|null} */
  let active = null;
  function place(L, depth) {
    if (K.G.opts.puzzles !== true || K.G.opts.daily || K.G.opts.weekly || L.isFinal) return;
    const rng = new Rng(`${K.G.seed}|puzzle|${depth}`);
    const pool = Object.entries(L.items).filter(([k, list]) => {
      const [x, y] = k.split(',').map(Number);
      return L.tiles[y * L.w + x] === Dungeon.T.FLOOR && !L.traps[k]
        && !(x === L.start.x && y === L.start.y)
        && !(L.dressing || []).some(q => q.x === x && q.y === y)
        && !L.monsters.some(q => q.x === x && q.y === y)
        && !(L.npcs || []).some(q => q.x === x && q.y === y)
        && list.some(it => (it.t === 'gold' || it.t === 'gem') && !it.u);
    });
    if (!pool.length) return;
    const [k, list] = rng.pick(pool), [x, y] = k.split(',').map(Number);
    // Rotate the three kinds across floors, from a seed's own starting kind.
    const offset = new Rng(`${K.G.seed}|puzzle-kind`).int(0, 2);
    L.puzzle = { x, y, kind: PUZZLE_KINDS[(depth - 1 + offset) % 3], order: rng.shuffle([0, 1, 2, 3]),
      target: rng.int(1, 14), input: [], lit: [false, false, false, false], solved: false };
    for (const it of list) if ((it.t === 'gold' || it.t === 'gem') && !it.u) it.puzzle = true;
  }
  function at(x, y) {
    const q = K.lvl().puzzle;
    return K.G.opts.puzzles === true && q && !q.solved && q.x === x && q.y === y ? q : null;
  }
  function nearby() {
    const p = K.P(), [dx, dy] = Dungeon.DIRS[p.dir];
    return at(p.x, p.y) || at(p.x + dx, p.y + dy);
  }
  function open() {
    if (!K.G || K.G.status !== 'playing') return false;
    const q = nearby();
    if (!q) return false;
    active = q;
    K.emit('puzzle');
    return true;
  }
  function blocks(it, walking = false) {
    const p = K.P(), q = it.puzzle && at(p.x, p.y);
    if (!q) return false;
    if (walking) {
      if (!q.seen) { q.seen = true; K.log(PUZZLE_WORDS.found, 'info'); }
    } else open();
    return true;
  }
  function action(act, value) {
    if (!active || !K.G || K.G.status !== 'playing' || active !== nearby() || active.solved) return false;
    const q = active;
    if (act === 'reset') { q.input = []; q.lit.fill(false); q.feedback = 'reset'; }
    else if (act === 'mark' && Number.isInteger(value) && value >= 0 && value < 4) {
      if (q.kind === 'torches') q.lit[value] = !q.lit[value];
      else if (q.kind === 'runes') { if (q.input.length >= 4) return false; q.input.push(value); }
      else q.input = [value];
      delete q.feedback;
    } else if (act === 'submit') {
      const right = q.kind === 'runes' ? q.input.length === 4 && q.input.every((n, i) => n === q.order[i])
        : q.kind === 'torches' ? q.lit.every((lit, i) => lit === !!(q.target & (1 << i)))
          : q.input.length === 1 && q.input[0] === q.order[0];
      if (!right) { q.feedback = 'wrong'; K.emit('puzzle'); return false; }
      q.solved = true; q.feedback = 'solved';
      // Remove the marks, rather than leave metadata on coins in the pack.
      for (const it of K.lvl().items[K.key(q.x, q.y)] || []) delete it.puzzle;
      K.log(PUZZLE_WORDS.solved, 'good');
      Sound.play('door');
    } else return false;
    K.emit('puzzle'); K.emit('inv');
    return true;
  }
  return { place, at, nearby, open, blocks, action, current: () => active, clear: () => { active = null; } };
}
