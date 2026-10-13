// The threads: a few choices follow the hero down. Each is kept with the
// floor it was made on (G.threads, by id), pays off or comes due further
// down, and the epilogue remembers it. The encounters (encounters.js, meet.js)
// start one with a `thread` effect; here is what each comes to, told on the
// first arrival at a floor where it does: most of them two floors on, so a
// choice made is a promise kept a little later, where the hero can see it.
// Wired near the end of game.js, borrowing what it needs through K.
import { Rng, d } from './rng.js';
import { ITEMS, JOURNAL, MONSTERS } from './data.js';

/** @param {import('./types.js').Kit} K */
export function makeThreads(K) {
  const P = () => K.P();
  const log = (/** @type {any[]} */ ...a) => K.log(...a);

  // ---------- threads ----------
  // A few choices follow the hero down. Each is kept with the floor it was
  // made on, pays off (or comes due) further down, and the epilogue remembers it.
  /** @returns {Record<string, number>} */
  const threads = () => (K.G.threads = K.G.threads || {});
  const THREAD_SAID = {
    guide: 'He means to go on ahead and mark the way for you.',
    captive: 'He swears he will put in a word with the traders below.',
    crew: 'The third crew is at rest.',
    bargain: '+1 to hit and damage for the rest of the delve. Something far below will be the stronger for it.',
    lamp: 'The Lampfolk will hear of it.',
    robbed: 'The Lampfolk will hear of this.',
    // the choices that come back two floors on (twoOn, below)
    spared: 'It will remember you.',
    tollpaid: 'Word of a toll paid travels ahead of you.',
    tollowed: 'The goblins will not forget this.',
    oath: 'Whatever its task was, you have sworn yourself to it.',
    offering: 'Whoever tends the old stone will know of it.',
    fed: 'They will not forget a meal.',
    delverShade: 'They will not forget this either.',
    egg: 'Somewhere far off, something will come looking.',
    // the kept smith's way (encounters.js): an ending to choose at the Heart
    smithway: 'You know now how the Heart is kept, if you would keep it.',
  };
  /** The Pale One's strength, for the rest of the run. */
  const bargained = () => (K.G && K.G.threads && K.G.threads.bargain ? 1 : 0);
  /** A trader below the captive you freed has heard of you: a sixth off. */
  const vouched = () => (K.G && K.G.threads && K.G.threads.captive && K.G.depth > K.G.threads.captive ? 1 / 6 : 0);
  /** Arriving on a floor for the first time: whatever a thread has waiting here. */
  function threadArrivals(L, depth, fresh = true) {
    const t = threads();
    if (t.guide && depth > t.guide && !t.guided) {
      t.guided = depth; L.explored.fill(1);
      log('Chalk arrows on the stair wall: the guildsman you dug out came this way, and marked the whole floor for you.', 'good');
    }
    if (L.isFinal && t.crew && !t.sung) {
      t.sung = 1;
      const p = P(); p.effects.crew_hit = { amount: 2, until: K.G.t + 600000 };
      log('On the last stair you hear, faint as breath, a crew\'s marching song. The dead you buried have not forgotten you (+2 to hit).', 'good');
    }
    if (fresh) twoOn(L, depth);
    if (L.isFinal && t.bargain && fresh) log('Cold settles in your hands, and something ahead drinks it in. The Pale One\'s price has come due: whatever keeps the Heart is the stronger for your bargain.', 'bad');
  }
  /**
   * Squares round the hero, by steps walked (not through walls), from near
   * to far: open floor with nothing standing or lying there.
   */
  function stepsAway(L, near, far) {
    const p = P(), dist = new Map([[K.key(p.x, p.y), 0]]), q = [[p.x, p.y]], out = [];
    for (let qi = 0; qi < q.length; qi++) {
      const [x, y] = q[qi], d = dist.get(K.key(x, y));
      if (d >= far) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = K.key(nx, ny);
        if (dist.has(k) || !K.passable(nx, ny)) continue;
        dist.set(k, d + 1); q.push([nx, ny]);
        if (d + 1 >= near && K.tile(nx, ny) === K.T.FLOOR && !K.monsterAt(nx, ny) && !(L.items[k] && L.items[k].length) && !(L.traps && L.traps[k])) out.push([nx, ny]);
      }
    }
    return out;
  }
  /** Lay these where the hero arrives, a step or two off. */
  function leave(L, rng, items) {
    const spots = stepsAway(L, 1, 3);
    if (!spots.length) return false;
    const [x, y] = rng.pick(spots), k = K.key(x, y);
    (L.items[k] = L.items[k] || []).push(...items);
    return true;
  }
  /** Bring this creature to the stair, awake, a few steps off. */
  function waiting(L, rng, kind, near = 3, far = 6) {
    const spots = stepsAway(L, near, far), b = MONSTERS[kind];
    if (!spots.length || !b) return null;
    const [x, y] = rng.pick(spots);
    const m = K.newMonster(kind, x, y, rng.dice(b.hp[0], b.hp[1], b.hp[2]) + Math.floor((K.G.depth - 1) / 2));
    m.awake = true;
    return m;
  }
  /** The goblins a paid toll makes peace with, on the floor where word of it arrives. */
  const TOLL_KIN = ['goblin', 'archer', 'pikeman'];
  /** The last delver's own page (JOURNAL), left for a shared meal: never dealt to a floor. */
  const DELVER_PAGE = JOURNAL.findIndex(e => e.thread === 'fed');
  /** A plain wall by the hero, with open floor before it, to open a spring in. */
  function springSpot(L) {
    for (const [x, y] of stepsAway(L, 0, 4)) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const wx = x + dx, wy = y + dy;
        if (wx < 1 || wy < 1 || wx >= L.w - 1 || wy >= L.h - 1 || K.tile(wx, wy) !== K.T.WALL) continue;
        if (L.features && L.features[K.key(wx, wy)]) continue;
        return { x: wx, y: wy };
      }
    }
    return null;
  }
  /**
   * The goblin you spared, about on the floor where it came back: the first time a
   * foe draws back a blow at the hero, it drops out of the dark onto the foe's back,
   * once. @returns {boolean} whether it did (the foe's blow is spoiled)
   */
  function sparedAid(m) {
    const t = threads();
    if (!t.sparedPaid || t.sparedStruck || K.G.depth < t.sparedPaid) return false;
    t.sparedStruck = K.G.depth;
    const name = K.mstat(m).name, n = d(2, 6) + K.G.depth;
    log(`A small shape drops out of the dark onto the ${name}'s back: the goblin you spared, knife first, for ${n}! It is gone again before you can thank it.`, 'good');
    K.damageMonster(m, n, 'spared');
    if (m.hp > 0 && K.lvl().monsters.includes(m)) { m.windup = null; m.nextAct = K.G.t + 1400; K.opening(m); }
    return true;
  }
  /** A page a thread left, read: the last delver's shows every hidden door and trap on the floor. */
  function readThreadPage(entry) {
    if (!entry || entry.thread !== 'fed') return;
    const L = K.lvl();
    let doors = 0;
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) if (K.tile(x, y) === K.T.SECRET) { K.setTile(x, y, K.T.DOOR); L.explored[y * L.w + x] = 1; doors++; }
    if (L.traps && Object.keys(L.traps).length) L.trapsKnown = true;
    log(`On the back, the floor you stand on, every stone of it, drawn in ash: ${doors ? `${doors === 1 ? 'a hidden door' : `${doors} hidden doors`} and ` : ''}every trap marked.`, 'good');
  }
  /** A blade the hero can use, finely made: the best of a few kinds this deep. */
  function bladeFor(rng, depth) {
    const p = P(), most = 1 + Math.floor(depth / 2);
    const fits = Object.keys(ITEMS).filter(id => { const b = ITEMS[id]; return b.kind === 'weapon' && b.cls.includes(p.cls) && b.tier <= most && !b.range; });
    const best = fits.sort((a, b) => ITEMS[b].tier - ITEMS[a].tier).slice(0, 3);
    return best.length ? { t: rng.pick(best), q: 1, e: 2 } : null;
  }
  /**
   * The choices that come back two floors on: each is told on the first
   * arrival at a floor two or more below where it was made, once, and what it
   * brings is laid about the stair the hero comes down by, where it is seen.
   * Its own dice, so the floor's are never shifted.
   */
  function twoOn(L, depth) {
    const t = threads(), rng = new Rng(`${K.G.seed}|thread|${depth}`);
    const ripe = id => t[id] && depth >= t[id] + 2 && !t[id + 'Paid'];
    const paid = id => { t[id + 'Paid'] = depth; };
    // the goblin you spared does not leave a parcel: it is about on this floor, watching
    // your back, and comes out of the dark the first time a foe draws back a blow at you
    if (ripe('spared')) {
      paid('spared');
      if (L.traps && Object.keys(L.traps).length) L.trapsKnown = true;
      log('A goblin\'s scratch-mark by the stair, and its marks on the floor\'s traps: the one you spared has come this way, and it is still about. Something small is watching your back.', 'good');
    }
    if (ripe('captive')) {
      // a door he knew of, unbarred for you: the nearest locked one
      const locked = Object.keys(L.locks || {}).map(k => k.split(',').map(Number)).filter(([x, y]) => K.tile(x, y) === K.T.DOOR_LOCKED);
      const p = P();
      locked.sort((a, b) => (Math.abs(a[0] - p.x) + Math.abs(a[1] - p.y)) - (Math.abs(b[0] - p.x) + Math.abs(b[1] - p.y)));
      if (locked.length) {
        const [x, y] = locked[0];
        K.setTile(x, y, K.T.DOOR);
        delete L.locks[K.key(x, y)];
        paid('captive');
        log('A goblin brand is chalked on a locked door on this floor, and the lock hangs broken: the captive you freed came this way before you, and left it open.', 'good');
      }
    }
    // a fair payer's word has gone ahead: the goblins of this floor let the hero by
    // (until one is struck), and the toll-goblin chalks the stair down on the map
    if (ripe('tollpaid')) {
      paid('tollpaid');
      let kin = 0;
      for (const m of L.monsters) if (TOLL_KIN.includes(m.id) && !MONSTERS[m.id].boss) { m.truce = true; m.awake = false; m.windup = null; kin++; }
      const s = L.stairsDown;
      if (s) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = s.x + dx, y = s.y + dy; if (x >= 0 && y >= 0 && x < L.w && y < L.h) L.explored[y * L.w + x] = 1; }
      log(`A goblin in a dented helmet salutes you from the dark by the stair, and chalks the way down on your map. Word of a fair payer travels${kin ? ': the goblins of this floor will let you by, so long as you leave them be' : ''}.`, 'good');
    }
    if (ripe('tollowed')) {
      const m = waiting(L, rng, depth >= 4 ? 'ogre' : 'orc');
      if (m) { paid('tollowed'); log(`The toll-goblins have a big friend, and it has been waiting at the foot of the stair for you. A${depth >= 4 ? 'n ogre' : 'n orc'} lumbers up, cracking its knuckles.`, 'bad'); }
    }
    if (ripe('oath')) {
      const it = bladeFor(rng, depth), k = K.farthestFloor(L);
      if (it && k) {
        (L.items[k] = L.items[k] || []).push(it);
        paid('oath');
        log('Something old and patient is at your back again. Somewhere on this floor, where its knights fell, lies the blade the weeping knight swore you to carry.', 'good');
      }
    }
    // whoever tends the old stone has opened a spring in the wall by the stair: a
    // fountain blessed, drunk when the hero likes, that heals and watches over them
    if (ripe('offering')) {
      const spot = springSpot(L);
      if (spot) {
        paid('offering');
        K.setTile(spot.x, spot.y, K.T.FOUNTAIN);
        (L.features = L.features || {})[K.key(spot.x, spot.y)] = { type: 'fountain', used: false, blessed: true };
        log('Water runs from the wall by the stair, where there was none, and a lamp burns over it among fresh offerings: whoever tends the old stone has opened a spring for you. Drink when you have need of it.', 'good');
      }
    }
    // the last delver leaves a page of their own: read, it shows every hidden door
    // and every trap on the floor (items.js reads it, through readThreadPage)
    if (ripe('fed') && DELVER_PAGE >= 0 && leave(L, rng, [{ t: 'page', q: 1, page: DELVER_PAGE }])) {
      paid('fed');
      log('A page by the stair, weighted with a bone and tied with a strip of a fine old coat: the last delver has gone down before you, and left you something for the meal you shared.', 'good');
    }
    if (ripe('delverShade')) {
      const m = waiting(L, rng, 'wraith');
      if (m) { paid('delverShade'); log('A cold shape waits at the foot of the stair, in the rags of a fine coat. The last delver has come for what you took.', 'bad'); }
    }
    if (ripe('egg')) {
      const m = waiting(L, rng, 'wyrm', 4, 8);
      if (m) { paid('egg'); log('A roar shakes the stair, and something huge comes up it, scenting the air: the egg you smashed had a mother, and she has followed you down.', 'bad'); }
    }
  }
  /** What the hero carries from their choices, for the hero sheet. */
  function threadNotes() {
    const t = K.G.threads || {}, out = [];
    if (K.bounty.note()) out.push(K.bounty.note());
    if (t.guide) out.push(t.guided ? `The guildsman you dug out marked floor ${t.guided} for you.` : 'The guildsman you dug out has gone ahead to mark the way.');
    if (t.captive) out.push('The captive you freed has put in a word: traders below him ask a sixth less for their wares.');
    if (t.crew) out.push('You buried the third crew. They will be with you at the end.');
    if (t.bargain) out.push('You took the Pale One\'s strength: +1 to hit and damage. Whatever keeps the Heart will be the stronger for it.');
    if (t.lamp) out.push(t.lampGift ? 'A Lampfolk trader thanked you for its kin\'s lamp with a gift of healing.' : 'You relit a Lampfolk\'s lamp: the next Lampfolk trader below will thank you for it.');
    if (t.robbed) out.push('You robbed one of the Lampfolk in the dark: their traders below ask a sixth more.');
    const two = (id, now, later) => { if (t[id]) out.push(t[id + 'Paid'] ? now : later); };
    two('spared', t.sparedStruck ? 'The goblin you spared came out of the dark and fought beside you.' : 'The goblin you spared is about, watching your back.', 'The goblin you spared will remember you, a floor or two down.');
    two('tollpaid', 'The toll-goblins sent word ahead: their kin let you by.', 'You paid the goblins\' toll: word of it travels ahead.');
    two('tollowed', 'The toll-goblins\' big friend found you.', 'You crossed the goblins at their toll: they will not forget it.');
    two('oath', 'The weeping knight\'s blade lay where its knights fell.', 'You swore yourself to the weeping knight\'s task.');
    two('offering', 'Whoever tends the old stone opened a spring for you.', 'You left an offering at the old stone.');
    two('fed', 'The last delver left you a page of their own, for the meal you shared.', 'You shared a meal with the last delver.');
    two('delverShade', 'The last delver came for what you took.', 'You robbed the last delver.');
    two('egg', 'The wyrm whose egg you smashed came after you.', 'You smashed a wyrm\'s egg.');
    if (t.smithway) out.push('The kept smith told you how the Heart is kept: you may stay with it, at the end.');
    if (P().inv.some(it => it.t === 'quench')) out.push('You carry the smiths\' quench: at the end, it can put the Heart out for good.');
    if (t.mule) out.push(t.muleDone ? 'A trader knew the lost mule you led on, and paid you for it.' : 'You led a lost mule on: the next trader below will know whose it is.');
    { const n = K.companion.note(); if (n) out.push(n); }
    return out;
  }

  return { threads, THREAD_SAID, bargained, vouched, threadArrivals, threadNotes, sparedAid, readThreadPage };
}
