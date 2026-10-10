// The threads: a few choices follow the hero down. Each is kept with the
// floor it was made on (G.threads, by id), pays off or comes due further
// down, and the epilogue remembers it. The encounters (encounters.js, meet.js)
// start one with a `thread` effect; here is what each comes to, told on the
// first arrival at a floor where it does: most of them two floors on, so a
// choice made is a promise kept a little later, where the hero can see it.
// Wired near the end of game.js, borrowing what it needs through K.
import { Rng } from './rng.js';
import { ITEMS, MONSTERS } from './data.js';

/** @param {any} K */
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
    if (ripe('spared') && leave(L, rng, [{ t: 'potion_heal', q: 1, e: 0 }, { t: 'gold', q: 8 * depth }])) {
      paid('spared');
      if (L.traps && Object.keys(L.traps).length) L.trapsKnown = true;
      log('A goblin\'s scratch-mark by the stair, and a bundle tied up in rags beside it: the one you spared has not forgotten you. Its marks show where this floor\'s traps lie, too.', 'good');
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
    if (ripe('tollpaid') && leave(L, rng, [{ t: 'gold', q: 12 * depth }])) {
      paid('tollpaid');
      log('A goblin in a dented helmet salutes you from the dark by the stair, and drops a purse: your toll\'s worth, and more. Word of a fair payer travels.', 'good');
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
    if (ripe('offering')) {
      paid('offering');
      const p = P();
      if (p.hp < p.maxHp) K.healPlayer(p.maxHp - p.hp);
      log('A lamp burns at the foot of the stair, and fresh offerings lie under it: whoever tends the old stone has been here before you. Your wounds close in its light.', 'good');
    }
    if (ripe('fed') && leave(L, rng, [{ t: 'ration', q: 2, e: 0 }, { t: 'potion_heal', q: 1, e: 0 }])) {
      paid('fed');
      log('A bundle by the stair, tied with a strip of a fine old coat: the last delver has gone down before you, and left you a meal for the one you shared.', 'good');
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
    two('spared', 'The goblin you spared left you a bundle and marked a floor\'s traps.', 'The goblin you spared will remember you, a floor or two down.');
    two('tollpaid', 'The toll-goblins paid you back, with interest.', 'You paid the goblins\' toll: word of it travels ahead.');
    two('tollowed', 'The toll-goblins\' big friend found you.', 'You crossed the goblins at their toll: they will not forget it.');
    two('oath', 'The weeping knight\'s blade lay where its knights fell.', 'You swore yourself to the weeping knight\'s task.');
    two('offering', 'Whoever tends the old stone lit a lamp for you.', 'You left an offering at the old stone.');
    two('fed', 'The last delver left you a meal for the one you shared.', 'You shared a meal with the last delver.');
    two('delverShade', 'The last delver came for what you took.', 'You robbed the last delver.');
    two('egg', 'The wyrm whose egg you smashed came after you.', 'You smashed a wyrm\'s egg.');
    if (t.mule) out.push(t.muleDone ? 'A trader knew the lost mule you led on, and paid you for it.' : 'You led a lost mule on: the next trader below will know whose it is.');
    { const n = K.companion.note(); if (n) out.push(n); }
    return out;
  }

  return { threads, THREAD_SAID, bargained, vouched, threadArrivals, threadNotes };
}
