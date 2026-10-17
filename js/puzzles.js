// Optional catches on treasure already laid by the floor. Separate dice keep
// both the map and the run's combat rolls exactly as they were. No key, quest
// object or relic is ever held back, and a cache never blocks a passage.
import { Rng } from './rng.js';
import { Dungeon } from './dungeon.js';
import { PUZZLE_KINDS, PUZZLE_WORDS } from './puzzledata.js';
import { ITEMS, CLASSES, armorFits, shieldFits } from './data.js';
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
      target: rng.int(1, 14), input: [], lit: [false, false, false, false], solved: false, reward: 'pending' };
    for (const it of list) if ((it.t === 'gold' || it.t === 'gem') && !it.u) it.puzzle = true;
  }
  function at(x, y) {
    const q = K.lvl().puzzle;
    return K.G.opts.puzzles === true && q && (!q.solved || q.reward === 'pending') && q.x === x && q.y === y ? q : null;
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
  // The cache's original coins pay for an alternative; no bonus purse is made.
  // Its own dice give the same offer after a save, without touching a fight roll.
  function offers() {
    const q = active;
    if (!q || q.reward !== 'pending') return [];
    const coins = (K.lvl().items[K.key(q.x, q.y)] || []).filter(it => it.puzzle);
    const budget = coins.reduce((n, it) => n + it.q, 0);
    if (!Number.isSafeInteger(budget) || budget < 1) return [];
    const rng = new Rng(`${K.G.seed}|puzzle-reward|${K.G.depth}`), cls = CLASSES[K.P().cls];
    const dear = K.G.opts.rung ? 2 : 1;
    const price = (id, e = 0) => Math.ceil(ITEMS[id].value * (1 + e * 0.9) * 1.6 * dear);
    /** @type {{id: 'gold'|'potion'|'gear', gold: number, item: import('./types.js').Item|null}[]} */
    const result = [{ id: 'gold', gold: budget, item: null }];
    const cost = price('potion_heal');
    if (cost <= budget) result.push({ id: 'potion', gold: budget - cost, item: { t: 'potion_heal', q: 1, e: 0 } });
    const e = rng.chance(0.3) ? 1 : 0;
    const pool = Object.keys(ITEMS).filter(id => {
      const b = ITEMS[id];
      return b.tier <= Math.min(4, 1 + Math.floor(K.G.depth / 3)) && price(id, e) <= budget
        && (b.kind === 'weapon' ? b.cls?.includes(K.P().cls)
          : b.kind === 'armor' ? armorFits(cls, b) : b.kind === 'shield' && shieldFits(cls, b));
    });
    if (pool.length) {
      const id = rng.pick(pool);
      result.push({ id: 'gear', gold: budget - price(id, e), item: { t: id, q: 1, e, h: 1 } });
    }
    return result;
  }
  function claim(value) {
    const q = active;
    if (!q.solved || q.reward !== 'pending') return false;
    const offer = offers().find(o => o.id === value);
    if (!offer) return false;
    const k = K.key(q.x, q.y), list = K.lvl().items[k] || [];
    if (offer.id === 'gold') { for (const it of list) delete it.puzzle; }
    else {
      K.lvl().items[k] = list.filter(it => !it.puzzle);
      if (offer.item) K.lvl().items[k].push(offer.item);
      if (offer.gold) K.lvl().items[k].push({ t: 'gold', q: offer.gold });
      // Naming the draught tells the hero what it is, as a starting kit does.
      if (offer.id === 'potion') K.G.known.potion_heal = 1;
    }
    q.reward = offer.id;
    K.log(PUZZLE_WORDS.chosen, 'good'); Sound.play('pickup');
    K.emit('puzzle'); K.emit('inv');
    return true;
  }
  function action(act, value) {
    if (!active || !K.G || K.G.status !== 'playing' || active !== nearby()) return false;
    if (act === 'claim') return claim(value);
    if (active.solved) return false;
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
      if (q.reward !== 'pending') for (const it of K.lvl().items[K.key(q.x, q.y)] || []) delete it.puzzle;
      K.log(PUZZLE_WORDS.solved, 'good');
      Sound.play('door');
    } else return false;
    K.emit('puzzle'); K.emit('inv');
    return true;
  }
  return { place, at, nearby, open, blocks, action, offers, current: () => active, clear: () => { active = null; } };
}
