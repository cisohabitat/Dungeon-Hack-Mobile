// The hero's companion: a hound won over on the way down (the Starving Hound),
// or, in the delves that have no hound, a goblin let out of a cage further
// down (A Caged Goblin; both in encounters.js). One at a time. It follows,
// strikes whatever awake thing stands beside it (the one at the hero's side
// first), draws the blows of anything that reaches it first, heals when the
// hero rests, and grows with the hero and with every floor it goes down at
// their side (blooded after two, a veteran after four: a trick at each);
// the goblin picks locks and makes safe
// the traps it passes, where the hound is the stronger in a fight. If it
// falls it is gone for the run. It lives outside the monster list, so nothing
// that counts monsters counts it; what it borrows from the game comes through
// the getters in K, as the monsters' and the traders' do.
import { d, Rng } from './rng.js';
import { Sound } from './sound.js';

// Each kind: its picture and voice, its armour, how often it strikes and how
// fast it walks (it trots when it has fallen behind), its hit points and blow
// as the hero's level grows, and the words for it.
const KINDS = {
  hound: { sprite: 'dog', voice: 'dog', ac: 13, speed: 900, stepMs: 330, trotMs: 140, hp: [10, 4], hit: 3, dmg: [1, 6], verb: 'bites', sits: 'sits', word: 'hound',
    names: ['Brindle', 'Soot', 'Bramble', 'Pip', 'Ash', 'Moss', 'Tansy', 'Grip', 'Wick', 'Nettle', 'Rook', 'Hob'],
    tricks: [{ id: 'hamstring', name: 'Hamstring', says: 'one bite in three that lands holds its foe back a moment' },
      { id: 'pack', name: 'Pack Hunter', says: 'you have +2 to hit anything it stands beside' }] },
  goblin: { sprite: 'scrag', voice: 'goblin', ac: 14, speed: 800, stepMs: 300, trotMs: 130, hp: [6, 3], hit: 2, dmg: [1, 4], verb: 'stabs', sits: 'squats on its heels', word: 'goblin',
    names: ['Snik', 'Grub', 'Nib', 'Skaz', 'Twitch', 'Mog', 'Rattle', 'Fenn', 'Scrag', 'Wort'],
    tricks: [{ id: 'backstab', name: 'Backstab', says: 'its stab deals double to anything at your side' },
      { id: 'scrounge', name: 'Scrounger', says: 'on each new floor it finds you something on the way down' }] },
};
// It grows with the floors it goes down at the hero's side, not its kills: a
// hound kept alive through the dark has earned it, whoever struck the blows.
const RANKS = [{ floors: 2, name: 'blooded' }, { floors: 4, name: 'a veteran' }];
/** How far it has come: 0, then 1 (blooded), then 2 (a veteran). */
const rankOf = c => RANKS.filter(r => ((c && c.floors) || 0) >= r.floors).length;
/** Whether it has learned this trick. */
const knows = (c, id) => !!c && kindOf(c).tricks.slice(0, rankOf(c)).some(t => t.id === id);
// what a goblin that has learned to scrounge turns up on the way down, from its own dice
const SCROUNGE = [['gold', 40], ['potion_heal', 20], ['oil_fire', 12], ['oil_venom', 10], ['oil_silver', 8], ['scroll_map', 10]];
const LOST_MS = 3000;
/** @param {{kind?: string}|null} c */
const kindOf = c => KINDS[(c && c.kind) || 'hound'] || KINDS.hound;

/** @param {any} K */
export function makeCompanion(K) {
  /** The companion, if it is on this floor and still standing. */
  const here = () => { const c = K.G && K.G.companion; return c && !c.fallen && c.depth === K.G.depth ? c : null; };
  /** Its armour: its kind's, and more under an iron-studded collar. */
  const acOf = c => kindOf(c).ac + (c && c.charm === 'charm_collar' ? 3 : 0);
  const maxHpFor = (c, level) => kindOf(c).hp[0] + kindOf(c).hp[1] * level + 4 * rankOf(c);
  const hitFor = (c, level) => kindOf(c).hit + Math.floor(level / 3);
  const biteFor = (c, level) => [kindOf(c).dmg[0], kindOf(c).dmg[1], Math.floor(level / 3)];
  /** A hound at heel pants, and its claws click on the stone: sleepers hear the hero a square sooner. (A goblin goes quiet as a thief.) */
  const noisy = () => { const c = here(), p = K.P(); return !!c && c.kind !== 'goblin' && c.mode === 'follow' && Math.abs(c.x - p.x) + Math.abs(c.y - p.y) <= 3; };
  const at = (x, y) => { const c = here(); return !!c && c.x === x && c.y === y; };
  /** Ground it can stand on: open floor, no trader, stone or barrel in the way. */
  const ground = (x, y) => K.passable(x, y) && !K.npcAt(x, y) && !K.propAt(x, y);
  const free = (x, y) => ground(x, y) && !K.monsterAt(x, y) && !(x === K.P().x && y === K.P().y);
  /**
   * Its own way to the hero, walked out from them over ground it can stand on.
   * The monsters' map stops at a score of squares and treats a shut door as
   * open, and a hound that trusted it sat down in front of a door, or lost the
   * hero in a long corridor, and never moved again.
   */
  function trail() {
    const L = K.lvl(), p = K.P(), n = L.w * L.h;
    const dist = new Int16Array(n).fill(-1), q = new Int32Array(n);
    let head = 0, tail = 0;
    dist[p.y * L.w + p.x] = 0; q[tail++] = p.y * L.w + p.x;
    while (head < tail) {
      const i = q[head++], x = i % L.w, y = (i / L.w) | 0;
      for (const [dx, dy] of K.DIRS) {
        const nx = x + dx, ny = y + dy, j = ny * L.w + nx;
        if (nx < 0 || ny < 0 || nx >= L.w || ny >= L.h || dist[j] >= 0 || !ground(nx, ny)) continue;
        dist[j] = dist[i] + 1; q[tail++] = j;
      }
    }
    return dist;
  }
  /** An open square beside the hero, the one behind them first; failing that, the nearest open one. */
  function besideHero() {
    const p = K.P();
    for (const turn of [2, 1, 3, 0]) {
      const [dx, dy] = K.DIRS[(p.dir + turn) % 4], x = p.x + dx, y = p.y + dy;
      if (free(x, y)) return { x, y };
    }
    const L = K.lvl(), dist = trail();
    let best = null, bd = Infinity;
    for (let i = 0; i < dist.length; i++) {
      if (dist[i] < 2 || dist[i] >= bd) continue;
      const x = i % L.w, y = (i / L.w) | 0;
      if (free(x, y)) { bd = dist[i]; best = { x, y }; }
    }
    return best;
  }
  /** A companion of this kind joins the hero (while none stands with them already). */
  function join(kind = 'hound') {
    const G = K.G, p = K.P();
    if (G.companion && !G.companion.fallen) return '';
    const k = KINDS[kind] ? kind : 'hound', def = KINDS[k];
    const name = new Rng(`${G.seed}|${k}`).pick(def.names);
    const spot = besideHero() || { x: p.x, y: p.y };
    const c = { kind: k, name, x: spot.x, y: spot.y, depth: G.depth, hp: 0, maxHp: 0, mode: /** @type {'follow'} */ ('follow'), nextAct: G.t + 600, kills: 0, joined: G.depth };
    c.hp = c.maxHp = maxHpFor(c, p.level);
    G.companion = c;
    Sound.play('voice', K.heard({ x: spot.x, y: spot.y }, { who: def.voice }));
    return `${name} follows you now.`;
  }
  /** Its blow, for the log: the hound bites, the goblin stabs. */
  const verb = () => kindOf(K.G && K.G.companion).verb;
  /** The goblin, if it is close enough to a locked door at (x, y) to pick it. */
  function picker(x, y) {
    const c = here();
    return c && c.kind === 'goblin' && Math.abs(c.x - x) + Math.abs(c.y - y) <= 3 ? c : null;
  }
  /** The goblin's eye for a loose flagstone: traps within two squares of it are made safe. */
  function sniffTraps(c) {
    const L = K.lvl();
    if (c.kind !== 'goblin' || !L.traps) return;
    for (const k of Object.keys(L.traps)) {
      const [x, y] = k.split(',').map(Number);
      if (Math.abs(x - c.x) + Math.abs(y - c.y) > 2) continue;
      delete L.traps[k];
      c.traps = (c.traps || 0) + 1;
      K.log(`${c.name} finds a trap under a loose flagstone, and jams it with a sliver of iron.`, 'good');
    }
  }
  /** It takes a blow, or the quills, or anything else: it may fall. */
  function hurt(n, what) {
    const c = here(), G = K.G;
    if (!c || n <= 0) return;
    c.hp -= n;
    c.flashUntil = K.realNow + 130;
    if (c.hp > 0) { K.log(`${what} ${c.name} for ${n}.`, 'bad'); return; }
    c.hp = 0; c.fallen = G.depth;
    K.log(`${what} ${c.name}, and ${c.name} falls, and does not get up.`, 'bad');
    // what it wore is left where it fell, for the hero to take up again
    if (c.charm) {
      const L = K.lvl(), k = `${c.x},${c.y}`;
      (L.items[k] = L.items[k] || []).push({ t: c.charm, q: 1, e: 0 });
      K.log(`The ${K.itemName({ t: c.charm, q: 1, e: 0 }).toLowerCase()} ${c.name} wore lies where ${c.name} fell.`, 'info');
      delete c.charm;
    }
    Sound.play('death', K.heard({ x: c.x, y: c.y }, { gore: 'blood' }));
  }
  /** A monster beside it and not beside the hero swings at it instead. */
  function struck(m, mb) {
    const c = here(), p = K.P();
    if (!c || Math.abs(m.x - c.x) + Math.abs(m.y - c.y) !== 1) return;
    const roll = d(1, 20);
    if (roll === 1 || (roll !== 20 && roll + mb.hit < acOf(c) + Math.floor(p.level / 3))) return;
    hurt(Math.max(1, d(...mb.dmg)), `The ${mb.name} hits`);
  }
  /** Its bite: an awake thing beside it, the one at the hero's side first. */
  function bite(c) {
    const L = K.lvl(), p = K.P();
    const foes = L.monsters.filter(m => m.awake && !m.collapsed && !m.fleeing && Math.abs(m.x - c.x) + Math.abs(m.y - c.y) === 1);
    if (!foes.length) return false;
    const m = foes.find(o => Math.abs(o.x - p.x) + Math.abs(o.y - p.y) === 1) || foes[0];
    c.lungeAt = K.realNow;
    const roll = d(1, 20), mb = K.mstat(m);
    if (roll !== 1 && (roll === 20 || roll + hitFor(c, p.level) >= mb.ac)) {
      // in a group the front one falls and the next steps up into the same place
      const many = m.pack ? m.pack.length : 0;
      // a goblin that has learned to backstab goes for what the hero is fighting
      const atSide = Math.abs(m.x - p.x) + Math.abs(m.y - p.y) === 1;
      K.damageMonster(m, (Math.max(1, d(...biteFor(c, p.level))) + (c.charm === 'charm_fang' ? 2 : 0)) * (atSide && knows(c, 'backstab') ? 2 : 1), 'companion');
      const down = !L.monsters.includes(m) || (m.pack ? m.pack.length : 0) < many;
      if (down) c.kills++;
      // a hound that has learned to hamstring drags at the leg: the foe's next move comes later
      // (not a boss wrapped in its shadow or up on its throne, where the bite never landed, nor through a rite)
      else if (knows(c, 'hamstring') && !(m.wardUntil > K.G.t && K.mstat(m).boss) && !(m.windup && m.windup.move === 'rite') && d(1, 3) === 1) m.nextAct = Math.max(m.nextAct, K.G.t) + (K.mstat(m).boss ? 250 : 500);
    }
    return true;
  }
  /** Its turn: bite, or keep up with the hero, or wait where it was told. */
  function turn() {
    const c = here(), G = K.G;
    if (!c || G.status !== 'playing' || G.t < c.nextAct) return;
    const p = K.P(), L = K.lvl(), def = kindOf(c);
    // it grows with the hero
    const want = maxHpFor(c, p.level);
    if (c.maxHp < want) { c.hp += want - c.maxHp; c.maxHp = want; }
    // a rowan knot closes its wounds, slowly
    if (c.charm === 'charm_rowan' && c.hp < c.maxHp && G.t >= (c.mendAt || 0)) { if (c.mendAt) c.hp++; c.mendAt = G.t + 4000; }
    sniffTraps(c);
    // something came to stand where it stands (a lunge, a summoning): it gives way first
    if (K.monsterAt(c.x, c.y)) {
      const out = K.DIRS.map(([dx, dy]) => [c.x + dx, c.y + dy]).find(([x, y]) => free(x, y));
      if (out) moveTo(c, out[0], out[1], def.stepMs);
      c.nextAct = G.t + def.stepMs; return;
    }
    // it fights beside the hero, not alone: once they have gone on, it goes after them
    const away = Math.abs(c.x - p.x) + Math.abs(c.y - p.y);
    if ((c.mode === 'stay' || away <= 3) && bite(c)) { c.nextAct = G.t + def.speed; c.stuckSince = 0; return; }
    if (c.mode === 'stay') { c.nextAct = G.t + 300; c.stuckSince = 0; return; }
    const dist = trail(), di = dist[c.y * L.w + c.x];
    const step = di > 2 || di < 0 ? def.trotMs : def.stepMs;
    c.nextAct = G.t + step;
    if (di >= 0 && di <= 1) { c.stuckSince = 0; return; }
    // close by, it is not lost, only waiting for a way through
    if (di >= 0 && di <= 3) c.stuckSince = 0;
    // the square that brings it nearest; failing that, one as near that it did
    // not just come from, to get round whatever stands in the way
    let best = null, bd = di < 0 ? Infinity : di, side = null;
    for (const [dx, dy] of K.DIRS) {
      const x = c.x + dx, y = c.y + dy;
      if (x < 0 || y < 0 || x >= L.w || y >= L.h || !free(x, y)) continue;
      const dd = dist[y * L.w + x];
      if (dd < 0) continue;
      if (dd < bd) { bd = dd; best = [x, y]; } else if (dd === di && !side && !(x === c.fromX && y === c.fromY)) side = [x, y];
    }
    const to = best || side;
    if (to) { moveTo(c, to[0], to[1], step); if (best) { c.stuckSince = 0; return; } }
    // no way through for a while, or none at all (a door pulled shut behind the
    // hero): it finds its own way round and turns up at their back or side. Never
    // where the hero is looking: a hound that blinked out of sight and into the
    // square in front of them read as magic
    if (di >= 0 && di <= 3) return;
    if (!c.stuckSince) c.stuckSince = G.t;
    else if (G.t - c.stuckSince >= LOST_MS && !inView(c.x, c.y)) {
      const spot = [2, 1, 3].map(t => K.DIRS[(p.dir + t) % 4]).map(([dx, dy]) => ({ x: p.x + dx, y: p.y + dy })).find(q => free(q.x, q.y));
      if (spot) { Object.assign(c, spot); c.moveT1 = 0; c.stuckSince = 0; }
    }
  }
  /**
   * Whether the hero can see a square: ahead of them, near enough to be lit,
   * and nothing solid on the straight line between.
   */
  function inView(x, y) {
    const p = K.P(), [fx, fy] = K.DIRS[p.dir];
    const rx = x - p.x, ry = y - p.y;
    if (rx * fx + ry * fy <= 0 || Math.abs(rx) + Math.abs(ry) > 12) return false;
    const n = Math.ceil(Math.max(Math.abs(rx), Math.abs(ry)) * 4);
    for (let i = 1; i < n; i++) {
      const tx = Math.floor(p.x + 0.5 + rx * i / n), ty = Math.floor(p.y + 0.5 + ry * i / n);
      if ((tx !== p.x || ty !== p.y) && (tx !== x || ty !== y) && !K.passable(tx, ty)) return false;
    }
    return true;
  }
  function moveTo(c, x, y, ms = kindOf(c).stepMs) {
    c.fromX = c.x; c.fromY = c.y; c.x = x; c.y = y;
    c.moveT0 = K.realNow; c.moveT1 = K.realNow + ms;
  }
  /** Stay where you are, or come: the hero's word, facing it. */
  function toggle() {
    const c = here();
    if (!c) return false;
    c.mode = c.mode === 'stay' ? 'follow' : 'stay';
    K.log(c.mode === 'stay' ? `You tell ${c.name} to stay. ${c.name} ${kindOf(c).sits}.` : `You call ${c.name} to heel.`, 'info');
    if (c.mode === 'stay') Sound.play('step'); else Sound.play('voice', K.heard({ x: c.x, y: c.y }, { who: kindOf(c).voice }));
    return true;
  }
  /** The hero steps into its square: it steps into theirs, and nobody is stuck in a corridor. */
  function swap(fromX, fromY) {
    const c = here();
    if (!c) return;
    moveTo(c, fromX, fromY);
  }
  /** Rest heals it with the hero, by the same share. */
  function rested(share) {
    const c = here();
    if (c) c.hp = Math.min(c.maxHp, c.hp + Math.ceil(c.maxHp * share));
  }
  /** Down or up the stair: a companion at heel comes too; one told to stay, stays. */
  function arrive(fromDepth) {
    const c = K.G.companion;
    if (!c || c.fallen || c.depth !== fromDepth || c.mode === 'stay') return;
    const spot = besideHero(), p = K.P();
    c.depth = K.G.depth;
    Object.assign(c, spot || { x: p.x, y: p.y });
    c.moveT1 = 0; c.nextAct = K.G.t + 700; c.stuckSince = 0;
    // a floor it has not been down to before, at the hero's side: it grows
    if (K.G.depth > (c.deepest || c.joined)) {
      c.deepest = K.G.depth;
      const was = rankOf(c);
      c.floors = (c.floors || 0) + 1;
      if (rankOf(c) > was) {
        const t = kindOf(c).tricks[rankOf(c) - 1];
        c.maxHp = maxHpFor(c, p.level); c.hp = c.maxHp;
        K.log(`${c.name} is ${RANKS[rankOf(c) - 1].name} now, and has learned a trick: ${t.name}, ${t.says}.`, 'good');
        Sound.play('voice', K.heard({ x: c.x, y: c.y }, { who: kindOf(c).voice }));
      }
      if (knows(c, 'scrounge')) scrounge(c);
    }
  }
  /** A scrounging goblin's find on the way down: gold, or a flask or a scroll it slips into the pack. */
  function scrounge(c) {
    const G = K.G, p = K.P(), rng = new Rng(`${G.seed}|scrounge|${G.depth}`);
    const t = rng.weighted(SCROUNGE);
    if (t === 'gold') {
      const n = rng.int(4, 10) * G.depth;
      p.gold += n;
      K.log(`${c.name} tips ${n} gold into your hand: found on the way down, it says, and will not say where.`, 'good');
    } else if (K.giveItem({ t, q: 1, e: 0 })) {
      K.log(`${c.name} slips ${K.aThing(K.itemName({ t, q: 1, e: 0 }))} into your pack: found on the way down.`, 'good');
    }
  }
  /**
   * A charm from the pack for it to wear, on this floor: the one it wore goes
   * back into the pack. @returns {string|null} why not, or null when it is worn
   */
  function wear(it) {
    const c = here(), p = K.P();
    if (!c) return K.G.companion && !K.G.companion.fallen ? `${K.G.companion.name} is not on this floor.` : 'You have no companion to wear it.';
    const i = p.inv.indexOf(it);
    if (i < 0) return 'You are not carrying that.';
    p.inv.splice(i, 1);
    const old = c.charm;
    c.charm = it.t;
    if (old) K.giveItem({ t: old, q: 1, e: 0 });
    K.log(`You fasten the ${K.itemName(it).toLowerCase()} on ${c.name}${old ? `, and take back the ${K.itemName({ t: old, q: 1, e: 0 }).toLowerCase()}` : ''}.`, 'good');
    Sound.play('voice', K.heard({ x: c.x, y: c.y }, { who: kindOf(c).voice }));
    return null;
  }
  /** It helps the hero land a blow on what it stands beside, once it has learned to hunt as a pack. */
  function flanks(m) {
    const c = here();
    return !!c && knows(c, 'pack') && Math.abs(m.x - c.x) + Math.abs(m.y - c.y) === 1;
  }
  /** After a load: its clock starts again with the game's. */
  function loaded() {
    const c = K.G.companion;
    // (its picture's clocks run on the page's time, which starts again from nothing)
    if (c) { c.nextAct = K.G.t + 800; c.moveT1 = 0; c.flashUntil = 0; c.lungeAt = 0; c.stuckSince = 0; }
  }
  /** Where to draw it, smoothly between squares. */
  function sprite(Assets, now) {
    const c = here();
    if (!c) return null;
    let x = c.x, y = c.y;
    if (c.moveT1 > now && c.fromX != null) {
      const t = Math.max(0, Math.min(1, (now - c.moveT0) / (c.moveT1 - c.moveT0)));
      x = c.fromX + (c.x - c.fromX) * t; y = c.fromY + (c.y - c.fromY) * t;
    }
    const s = Assets.sprites[kindOf(c).sprite] || Assets.sprites.dog;
    const lunging = now - (c.lungeAt || 0) < 220;
    // told to stay (and not moving or biting), it sits
    const img = lunging && s.windup ? s.windup : c.mode === 'stay' && !(c.moveT1 > now) && s.sit ? s.sit : s;
    return { x: x + 0.5, y: y + 0.5, img, scale: 0.62, yOff: 0, flash: now < (c.flashUntil || 0) ? c.flashUntil : 0 };
  }
  /** For the hero sheet and the epilogue. */
  function note() {
    const c = K.G && K.G.companion;
    if (!c) return '';
    const w = kindOf(c).word;
    if (c.fallen) return `${c.name}, the ${w} who followed you from floor ${c.joined}, fell on floor ${c.fallen}.`;
    const tricks = c.kind === 'goblin' ? `${c.locks ? `, ${c.locks} lock${c.locks > 1 ? 's' : ''} picked` : ''}${c.traps ? `, ${c.traps} trap${c.traps > 1 ? 's' : ''} made safe` : ''}` : '';
    const r = rankOf(c), learned = kindOf(c).tricks.slice(0, r);
    const next = r < RANKS.length ? ` ${RANKS[r].floors - (c.floors || 0)} more floor${RANKS[r].floors - (c.floors || 0) > 1 ? 's' : ''} down at your side and it learns ${kindOf(c).tricks[r].name}.` : '';
    const worn = c.charm ? `, wearing the ${K.itemName({ t: c.charm, q: 1, e: 0 }).toLowerCase()}` : '';
    return `${c.name}, your ${w}${r ? `, ${RANKS[r - 1].name}` : ''}: ${c.hp} of ${c.maxHp} hit points, ${c.mode === 'stay' ? `told to stay on floor ${c.depth}` : 'at your heel'}${worn}${c.kills ? `, ${c.kills} kill${c.kills > 1 ? 's' : ''}` : ''}${tricks}.${learned.map(t => ` ${t.name}: ${t.says}.`).join('')}${next}`;
  }
  /** The word for it (hound, goblin), for the screens. */
  const word = () => kindOf(K.G && K.G.companion).word;
  return { here, noisy, at, join, verb, word, picker, hurt, struck, turn, toggle, swap, rested, arrive, loaded, sprite, note, flanks, wear, rank: () => rankOf(K.G && K.G.companion) };
}
