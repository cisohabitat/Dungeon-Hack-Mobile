// The testing aids: for whoever is testing the game, not a way to play it.
// Life, spell points or gold that never run out, switched in the Menu and kept
// on the device (not in the save), and tools that do a thing once: go to a
// floor, lay the floor out, gain a level, put an item in the pack. A run that
// has used any of them is marked for good, and kept out of the Hall, the
// trophies, the fallen, the codex and the Daily. Split out of game.js; what it
// borrows from the game comes through the getters in K.
import { Rng } from './rng.js';
import { ROUTES, XP_TABLE, MAX_LEVEL, ITEMS } from './data.js';
import { RELICS } from './relics.js';
import { Dungeon } from './dungeon.js';

/** @param {any} K */
export function makeTesting(K) {
  const P = () => K.P(), lvl = () => K.lvl();
  const log = (/** @type {string} */ m, /** @type {string} */ c) => K.log(m, c);
  // (the eye, every monster on the map, is drawn by the screens; here it only marks the run)
  let testing = { hp: false, sp: false, gold: false, eye: false };
  const TEST_GOLD = 99999;
  /** @param {{hp?: boolean, sp?: boolean, gold?: boolean, eye?: boolean}} t */
  function setTesting(t) { testing = { hp: !!t.hp, sp: !!t.sp, gold: !!t.gold, eye: !!t.eye }; applyTesting(); }
  const testingOn = () => testing.hp || testing.sp || testing.gold || testing.eye;
  // The tools below do a thing once rather than stay on, and mark the run the same way.
  function testTool() {
    if (!K.G || K.G.status !== 'playing') return false;
    K.G.tested = true;
    return true;
  }
  /**
   * Straight to a floor, up or down, without the floors between. Down past the
   * divided stair with no road taken yet, it takes the road given (or the
   * seed's own, as descend() does).
   * @param {number} depth @param {string} [road]
   */
  function testFloor(depth, road) {
    if (!K.G || K.G.status !== 'playing') return false;
    const n = K.G.opts.levels || 8;
    depth = Math.max(1, Math.min(n, Math.floor(depth) || 1));
    if (depth === K.G.depth) return false;
    testTool();
    const span = Dungeon.routeSpan(n);
    if (span && depth > span.fork && !K.G.route) K.G.route = ROUTES[road || ''] ? road : new Rng(`${K.G.seed}|road`).next() < 0.5 ? 'crypts' : 'warrens';
    K.G.forkPending = false;
    const down = depth > K.G.depth;
    log(`(Testing) You are carried ${down ? 'down' : 'up'} to floor ${depth}.`, 'info');
    K.enterLevel(depth, down ? 'down' : 'up');
    K.save(true);
    return true;
  }
  /** The whole of this floor on the map, as a Scroll of Mapping draws it. */
  function testReveal() {
    if (!testTool()) return false;
    lvl().explored.fill(1);
    log('(Testing) The whole floor is laid out on your map.', 'info');
    return true;
  }
  /** Enough experience for the next level, and its choice with it. */
  function testLevel() {
    if (!K.G || K.G.status !== 'playing' || P().level >= MAX_LEVEL) return false;
    testTool();
    const p = P();
    p.xp = Math.max(p.xp, XP_TABLE[p.level]);
    K.checkLevelUp();
    K.emit('stats');
    return true;
  }
  // what can be handed over: not the Heart, coin, gems or the things a place or an encounter gives
  const NOT_GIVEN = ['gold', 'gem', 'artifact', 'page', 'quest', 'key'];
  /** @returns {{id: string, name: string, group: string}[]} */
  function testGifts() {
    const out = [{ id: 'keys', name: 'Keys to this floor\'s locked doors', group: 'Keys' }];
    for (const id in ITEMS) if (!NOT_GIVEN.includes(ITEMS[id].kind)) out.push({ id, name: ITEMS[id].name, group: ITEMS[id].kind });
    for (const id in RELICS) out.push({ id: 'relic:' + id, name: RELICS[id].name, group: 'relic' });
    return out;
  }
  /**
   * Into the pack, known for what it is: an item's id, 'keys' (one for each
   * colour of lock left on this floor) or 'relic:' and a relic's id.
   * @param {string} id
   */
  function testGive(id) {
    if (!K.G || K.G.status !== 'playing') return false;
    const L = lvl();
    if (id === 'keys') {
      const colours = [...new Set(Object.values(L.locks || {}))];
      if (!colours.length) { log('(Testing) No door on this floor is locked.', 'info'); return false; }
      testTool();
      for (const color of colours) K.giveItem({ t: 'key', q: 1, color });
      log(`(Testing) Keys put in your pack: ${colours.join(', ')}.`, 'info');
      K.emit('stats');
      return true;
    }
    const relic = id.startsWith('relic:') ? id.slice(6) : '';
    if (relic ? !RELICS[relic] : !ITEMS[id] || NOT_GIVEN.includes(ITEMS[id].kind)) return false;
    const it = relic ? K.relicItem(relic) : { t: id, q: 1, e: 0 };
    if (!K.giveItem(it)) { log('Your pack is full.', 'bad'); return false; }
    testTool();
    K.G.known[it.t] = 1;
    if (relic) K.discoverRelic(relic);
    log(`(Testing) ${relic ? RELICS[relic].name : ITEMS[id].name} put in your pack.`, 'info');
    K.emit('stats');
    return true;
  }
  function applyTesting() {
    if (!K.G || K.G.status !== 'playing' || !testingOn()) return;
    K.G.tested = true;
    const p = P();
    if (testing.hp) p.hp = p.maxHp;
    if (testing.sp && p.maxSp) p.sp = p.maxSp;
    if (testing.gold && p.gold < TEST_GOLD) p.gold = TEST_GOLD;
  }
  /** Whether an aid that stays on is on (hp, sp, gold, eye). @param {'hp'|'sp'|'gold'|'eye'} k */
  const on = k => !!testing[k];
  return { setTesting, testingOn, testFloor, testReveal, testLevel, testGifts, testGive, applyTesting, on };
}
