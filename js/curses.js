// Curses and hidden quality: gear found with its enchantment unknown, cursed
// pieces that will not come off, how they are revealed and broken, and the cloaks
// laid about a floor. What it borrows from the game comes through K, read live.
import { ITEMS } from './data.js';
import { Dungeon } from './dungeon.js';
import { routeRelic } from './relics.js';
import { Rng } from './rng.js';

/** @param {any} K */
export function makeCurses(K) {
  const DIRS = K.DIRS;
  const T = K.T;
  const itemName = K.itemName;
  const P = (/** @type {any[]} */ ...a) => K.P(...a);
  const isJewel = (/** @type {any[]} */ ...a) => K.isJewel(...a);
  const isKnown = (/** @type {any[]} */ ...a) => K.isKnown(...a);
  const key = (/** @type {any[]} */ ...a) => K.key(...a);
  const log = (/** @type {any[]} */ ...a) => K.log(...a);
  const relicItem = (/** @type {any[]} */ ...a) => K.relicItem(...a);
  const the = (/** @type {any[]} */ ...a) => K.the(...a);

  // ---------- curses ----------
  // Found gear keeps its quality to itself (h) until it is worn, studied or
  // appraised, and a cursed piece will not come off once worn until the
  // curse is broken. A cursed thing in the pack does no harm: it only binds.
  const isGear = it => { const b = ITEMS[it.t]; return !!b && (b.kind === 'weapon' || b.kind === 'armor' || b.kind === 'shield' || b.kind === 'ring' || b.kind === 'amulet'); };
  const bound = it => !!(it && it.curse);
  const cap = str => str[0].toUpperCase() + str.slice(1);
  /**
   * Whether a piece's quality is hidden, as far as the player can tell. Only
   * rings that come in amounts can be finely made or cursed, so while a ring
   * or amulet's kind is unknown its quality is part of that mystery: a "?"
   * on one Jade Ring and not another would say which kind each is.
   */
  const qualityHidden = it => !!(it && it.h) && !(isJewel(it) && !isKnown(it.t));
  /** Everything carried or worn whose quality is still hidden. */
  const hiddenGear = () => [...P().inv, ...Object.values(P().eq)].filter(qualityHidden);
  const cursedWorn = () => Object.values(P().eq).filter(bound);
  /** Show the true quality of every piece carried; returns what was revealed. */
  function revealAll() {
    const seen = hiddenGear();
    for (const it of seen) delete it.h;
    return seen;
  }
  /** Break the curse on everything worn; returns how many let go. */
  function breakCurses() {
    const held = cursedWorn();
    for (const it of held) { delete it.curse; delete it.h; }
    return held.length;
  }
  /** A newly revealed piece, as you find it out by putting it on. */
  function tellQuality(it) {
    if (it.curse) log(`${cap(the(it))} tightens around you like a living thing. It is cursed, and will not come off.`, 'bad');
    else if (it.e > 0) log(`It is finely made: ${itemName(it)}.`, 'good');
    else log('It is ordinary work, neither better nor worse.');
  }
  /**
   * Lay this floor's relic on the pile furthest from the way in, which is
   * often a vault's reward, and let a trader here keep the next one behind
   * the counter. The last floor down a road at the fork holds that road's
   * own relic as well, on the next furthest pile. Runs once, when the floor
   * is first generated.
   */
  function placeRelics(L, depth) {
    const R = K.G.relics;
    if (!R) return;
    const span = K.G.route && Dungeon.routeSpan(K.G.opts.levels || 8);
    const road = span && depth === span.to ? routeRelic(K.G.route) : '';
    for (const id of [R.floor[depth], road]) if (id) layRelic(L, id);
    const trader = (L.npcs || []).find(n => n.kind !== 'encounter' && n.stock);
    if (trader && depth >= 2 && R.offered < R.shop.length) trader.stock.push(relicItem(R.shop[R.offered++]));
  }
  /** The open floor square farthest from the way in, with nothing on it: where a lost thing lies (a bounty's satchel). */
  function farthestFloor(L) {
    const dist = new Int32Array(L.w * L.h).fill(-1);
    const q = [L.start.y * L.w + L.start.x];
    dist[q[0]] = 0;
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi], x = i % L.w, y = (i / L.w) | 0;
      for (const [dx, dy] of DIRS) {
        if (x + dx < 0 || y + dy < 0 || x + dx >= L.w || y + dy >= L.h) continue;
        const ni = (y + dy) * L.w + x + dx;
        // (never behind a secret door or a lock: a job is for the one floor, and this must be findable on it)
        const t = L.tiles[ni];
        if (dist[ni] >= 0 || t === T.WALL || t === T.TORCH || t === T.FOUNTAIN || t === T.SECRET || t === T.DOOR_LOCKED) continue;
        dist[ni] = dist[i] + 1; q.push(ni);
      }
    }
    const held = new Set((L.npcs || []).map(n => key(n.x, n.y)));
    let best = null, bd = -1;
    for (let i = 0; i < dist.length; i++) {
      const k = key(i % L.w, (i / L.w) | 0);
      if (dist[i] > bd && L.tiles[i] === T.FLOOR && !L.traps[k] && !held.has(k) && !L.items[k] && !(L.props || []).some(pr => key(pr.x, pr.y) === k)) { bd = dist[i]; best = k; }
    }
    return best;
  }
  /** Lay a relic on the pile furthest from the way in that holds none yet, or on bare floor if there is no such pile. */
  function layRelic(L, id) {
    const dist = new Int32Array(L.w * L.h).fill(-1);
    const q = [L.start.y * L.w + L.start.x];
    dist[q[0]] = 0;
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi], x = i % L.w, y = (i / L.w) | 0;
      for (const [dx, dy] of DIRS) {
        if (x + dx < 0 || y + dy < 0 || x + dx >= L.w || y + dy >= L.h) continue;
        const ni = (y + dy) * L.w + x + dx, t = L.tiles[ni];
        // a secret door counts as a way through, so a vault's reward can be chosen
        if (dist[ni] >= 0 || t === T.WALL || t === T.TORCH || t === T.FOUNTAIN) continue;
        dist[ni] = dist[i] + 1; q.push(ni);
      }
    }
    let best = null, bd = -1;
    for (const k in L.items) {
      const [x, y] = k.split(',').map(Number), dd = dist[y * L.w + x];
      if (dd > bd && !L.items[k].some(it => it.t === 'artifact' || it.u)) { bd = dd; best = k; }
    }
    if (!best) {
      const held = new Set((L.npcs || []).map(n => key(n.x, n.y)));
      for (let i = 0; i < dist.length; i++) {
        const k = key(i % L.w, (i / L.w) | 0);
        if (dist[i] > bd && L.tiles[i] === T.FLOOR && !L.traps[k] && !held.has(k)) { bd = dist[i]; best = k; }
      }
    }
    if (best) (L.items[best] = L.items[best] || []).push(relicItem(id));
  }
  /**
   * Rings and amulets, from the second floor down: now and then one lies on
   * a pile, and a trader may keep one. They come from a stream of their own,
   * so a seed's floors hold everything they held before there were rings.
   * A ring that comes in amounts may be finely made, or cursed; the kind is
   * known only by its look until it is worn or studied.
   */
  const JEWEL_FIND = 0.45, JEWEL_SHOP = 0.4;
  function placeJewellery(L, depth) {
    if (depth < 2) return;
    const rng = new Rng(`${K.G.seed}|jewels|${depth}`);
    const maxTier = 1 + Math.floor(depth / 2);
    const pool = Object.keys(ITEMS).filter(id => isJewel({ t: id }) && ITEMS[id].tier <= maxTier);
    if (!pool.length) return;
    const piles = Object.keys(L.items).filter(k => !L.items[k].some(it => it.t === 'artifact'));
    if (piles.length && rng.chance(JEWEL_FIND)) {
      const id = rng.pick(pool), b = ITEMS[id], it = { t: id, q: 1, e: 0 };
      if (b.bonus) {
        const r = rng.next();
        if (r < 0.2) { it.e = r < 0.07 ? -2 : -1; it.curse = 1; }
        else if (r > 0.65) it.e = r > 0.92 ? 2 : 1;
        it.h = 1;
      }
      L.items[rng.pick(piles)].push(it);
    }
    const trader = (L.npcs || []).find(n => n.kind !== 'encounter' && n.stock);
    if (trader && rng.chance(JEWEL_SHOP)) {
      const id = rng.pick(pool);
      trader.stock.push({ t: id, q: 1, e: ITEMS[id].bonus && rng.chance(0.3) ? 1 : 0 });
    }
  }
  /**
   * Robes turn up only in a mage's dungeon: a pile now and then, or on a
   * trader's shelf. A stream of their own, so no other hero's floors change.
   * Found ones keep their make to themselves, as any found armour does.
   */
  const ROBE_FIND = 0.3, ROBE_SHOP = 0.35;
  function placeRobes(L, depth) {
    if (depth < 2 || P().cls !== 'mage') return;
    const rng = new Rng(`${K.G.seed}|robes|${depth}`);
    const maxTier = 1 + Math.floor(depth / 2);
    const pool = Object.keys(ITEMS).filter(id => ITEMS[id].weight === 'cloth' && ITEMS[id].tier > 1 && ITEMS[id].tier <= maxTier);
    if (!pool.length) return;
    // a trader's shelf reaches a tier deeper than the piles, as it does for other gear
    const shelf = Object.keys(ITEMS).filter(id => ITEMS[id].weight === 'cloth' && ITEMS[id].tier > 1 && ITEMS[id].tier <= maxTier + 1);
    const piles = Object.keys(L.items).filter(k => !L.items[k].some(it => it.t === 'artifact'));
    if (piles.length && rng.chance(ROBE_FIND)) {
      const it = { t: rng.weighted(pool.map(id => [id, ITEMS[id].tier])), q: 1, e: 0, h: 1 };
      const r = rng.next();
      if (r < 0.15) { it.e = -1; it.curse = 1; }
      else if (r > 0.7) it.e = r > 0.93 ? 2 : 1;
      L.items[rng.pick(piles)].push(it);
    }
    const trader = (L.npcs || []).find(n => n.kind !== 'encounter' && n.stock);
    if (trader && rng.chance(ROBE_SHOP)) trader.stock.push({ t: rng.pick(shelf), q: 1, e: rng.chance(0.3) ? 1 : 0 });
  }
  /** A cloak, for anyone: now and then on a pile or a trader's shelf, on a stream of its own. */
  const CLOAK_FIND = 0.2, CLOAK_SHOP = 0.25;
  function placeCloaks(L, depth) {
    if (depth < 2) return;
    const rng = new Rng(`${K.G.seed}|cloaks|${depth}`);
    const pool = Object.keys(ITEMS).filter(id => ITEMS[id].kind === 'cloak' && ITEMS[id].tier < 99);
    const piles = Object.keys(L.items).filter(k => !L.items[k].some(it => it.t === 'artifact'));
    if (piles.length && rng.chance(CLOAK_FIND)) L.items[rng.pick(piles)].push({ t: rng.pick(pool), q: 1, e: 0 });
    const trader = (L.npcs || []).find(n => n.kind !== 'encounter' && n.stock);
    if (trader && rng.chance(CLOAK_SHOP)) trader.stock.push({ t: rng.pick(pool), q: 1, e: 0 });
  }

  return { bound, breakCurses, cap, cursedWorn, farthestFloor, hiddenGear, isGear, layRelic, placeCloaks, placeJewellery, placeRelics, placeRobes, qualityHidden, revealAll, tellQuality };
}
