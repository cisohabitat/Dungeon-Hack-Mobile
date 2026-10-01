// The dungeon answers the elements. Fire, cold and lightning hurt what they
// strike, as they always did; now they also act on the place itself:
//
// - Lightning striking something that stands in water runs through the water
//   to everything else standing in it within two squares, at half the force:
//   the hero too, if they are wading close. A flooded floor is all water; on
//   the others, only the puddles are.
// - Fire sets moss (an overgrown floor's) and spilt oil alight. The flames
//   spread to the fuel beside them and burn whatever stands in them, and
//   leave ash. A moss fire burns out two squares from where it caught, so
//   one spark does not take a whole floor; oil burns as far as the oil goes.
// - Cold striking something in water freezes the water round it: whatever
//   stands in it is held fast a moment, and the ice carries no lightning. A
//   drowned one cannot rise through it.
// - Some barrels are oil casks. Broken, one spills its oil about it; a fire
//   that reaches one whole bursts it.
// - A wooden door beside a fire may catch. It burns a while, then falls in,
//   and leaves an open doorway: a locked one too, so oil and a flame are a
//   way through a lock without a key.
// - On a floor of tremors the ground shudders now and then, and rock comes
//   down from the roof: the squares it will fall on are marked a moment
//   before it lands, round the hero. It falls on whatever stands there then,
//   the hero's foes too, which never think to look up.
// - On a smouldering floor (a deep one) cracks in the stones glow, heat up
//   where they can be seen, and flare: fire over the crack and the four
//   squares beside it, a moment, on whatever stands there. Cold striking by
//   a crack seals it a while.
//
// What lies on each square (fire, ash, oil, ice) is kept on the level in
// `fields`, keyed like its items, so it is saved with the rest. What it
// borrows from the game comes through K, as the monsters' and traders' do.
import { d } from './rng.js';
import { Sound } from './sound.js';

const FIRE_MS = 3000, OIL_FIRE_MS = 4500, DOOR_FIRE_MS = 6000, SPREAD_MS = 700, BURN_MS = 800;
const ICE_MS = 8000, ICE_HOLD = 2500, HERO_ICE_HOLD = 1200;
// how many squares out from where it caught a moss fire can still spread: two,
// so a hero who strikes from three squares off is clear of it
const MOSS_REACH = 2;
// scorch left by burnt oil fades; burnt moss stays burnt
const OIL_ASH_MS = 30000;
// how far lightning runs through water from what it struck
const ARC_REACH = 2;
// a floor of tremors: how long between shudders, how long the marks stand
// before the rock lands (long enough to see and take a step), how far round
// the hero it falls, and on how many squares besides the hero's own
const QUAKE_GAP = [16000, 24000], QUAKE_WARN = 1700, QUAKE_REACH = 3, QUAKE_FALLS = 4;
// a smouldering floor's cracks: how long between flares, how long one glows first, how long
// its fire lasts, and how long cold seals it
const VENT_GAP = [9000, 15000], VENT_WARN = 1500, VENT_FIRE_MS = 2200, VENT_SEAL_MS = 25000;

/** @param {any} K */
export function makeElements(K) {
  const lvl = () => K.lvl();
  const fields = () => { const L = lvl(); return L.fields || (L.fields = {}); };
  /** What lies on a square: fire, ash, oil or ice, or null. */
  const fieldAt = (x, y) => (lvl().fields || {})[K.key(x, y)] || null;
  const open = (x, y) => { const t = K.tile(x, y); return t === K.T.FLOOR || t === K.T.DOOR_OPEN; };
  const puddle = (x, y) => (lvl().dressing || []).some(q => q.k === 'puddle' && q.x === x && q.y === y);
  const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  /** Standing water: all of a flooded floor, or a puddle; not ice, and not where fire burns. */
  function wet(x, y) {
    const f = fieldAt(x, y);
    if (f && (f.k === 'ice' || f.k === 'fire')) return false;
    return open(x, y) && (lvl().twist === 'flooded' || puddle(x, y));
  }
  /** What would burn on a square: spilt oil, a shut wooden door, or an overgrown floor's moss not yet burnt. */
  function fuel(x, y) {
    const f = fieldAt(x, y), t = K.tile(x, y);
    // (a door shut over spilt oil burns as a door: it catches, and falls)
    if (t === K.T.DOOR || t === K.T.DOOR_LOCKED) return f && f.k !== 'oil' ? '' : 'door';
    if (f && f.k === 'oil') return 'oil';
    if (f) return '';
    return lvl().twist === 'overgrown' && t === K.T.FLOOR ? 'moss' : '';
  }
  const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  /**
   * Set a square alight.
   * @param {number} gen how many squares from where the fire caught
   * @param {boolean} [wild] a monster's fire (a wyrm's breath), not the hero's:
   *   what it burns is not the hero's blow, and does not break a chant
   */
  function ignite(x, y, gen = 0, wild = false) {
    const f = fieldAt(x, y), G = K.G;
    if (f && f.k === 'ice') { delete fields()[K.key(x, y)]; return false; }
    const kind = fuel(x, y);
    if (!kind) return false;
    fields()[K.key(x, y)] = { k: 'fire', fuel: kind, until: G.t + (kind === 'oil' ? OIL_FIRE_MS : kind === 'door' ? DOOR_FIRE_MS : FIRE_MS), spread: G.t + SPREAD_MS, burn: G.t + 150, gen, ...(wild ? { wild: true } : {}) };
    const L = lvl();
    // (a door catching is said whenever it is seen: it is news, not more of the same fire)
    if (kind === 'door') { if (dist({ x, y }, K.P()) <= 6) K.log('The door catches fire!', 'bad'); return true; }
    if (!(L.fireSaid > G.t)) {
      L.fireSaid = G.t + 4000;
      const seen = dist({ x, y }, K.P()) <= 6;
      K.log(seen ? (kind === 'oil' ? 'The oil goes up in a sheet of flame!' : 'The moss catches, and fire runs across the floor!') : 'Somewhere near, something is burning.', 'bad');
      Sound.play('cast', K.heard({ x, y }, { spell: 'burning_hands' }));
    }
    return true;
  }

  /**
   * An element has struck a creature. How it struck matters: a spell's
   * lightning or cold works on the water; any fire, a blade's included, on
   * what will burn.
   * @param {'spell'|'blade'} how
   * @param {Set<any>} [seen] what this one casting has already struck, so a
   *   bolt through several in a line shocks each only once
   */
  function strike(m, el, dmg, how, seen = new Set()) {
    if (!m || !el || K.G.status !== 'playing') return;
    seen.add(m);
    // cold by a smouldering floor's crack seals it, a spell's or a blade's;
    // and an emberling blazing up is quenched by it
    if (el === 'cold') {
      seal(m.x, m.y);
      if (m.windup && m.windup.move === 'flare' && K.lvl().monsters.includes(m)) {
        m.windup = null; m.moveReady = K.G.t + 6000; m.nextAct = K.G.t + 600;
        K.log(`The cold dulls the ${K.mstat(m).name}'s glow before it can flare.`, 'good');
        K.learn(m.id, 'answer');
      }
    }
    if (el === 'fire') {
      const f = fieldAt(m.x, m.y);
      if (f && f.k === 'ice') { delete fields()[K.key(m.x, m.y)]; K.log('The ice hisses and runs back into water.'); return; }
      ignite(m.x, m.y, 0);
      return;
    }
    if (how !== 'spell' || !wet(m.x, m.y)) return;
    // (what the struck one's own weakness added to the blow stays with it, and
    // does not run on through the water)
    const f = el === 'lightning' ? K.elemental(m, 100, el) / 100 : 1;
    if (el === 'lightning') arc(m, f > 0 ? dmg / f : dmg, seen);
    else if (el === 'cold') freeze(m);
  }

  /** The water joined to a square within so many steps: lightning runs through the water, not through walls. */
  function waterNear(x, y, reach) {
    const got = new Set([K.key(x, y)]);
    let edge = [[x, y]];
    for (let i = 0; i < reach; i++) {
      const next = [];
      for (const [ex, ey] of edge) for (const [dx, dy] of DIRS4) {
        const nx = ex + dx, ny = ey + dy, k = K.key(nx, ny);
        if (got.has(k) || !wet(nx, ny)) continue;
        got.add(k); next.push([nx, ny]);
      }
      edge = next;
    }
    return got;
  }
  /**
   * Lightning runs through the water from what it struck to all else standing
   * in it close by. The hero and the companion are shocked once a casting at
   * most, however many things in the water it struck.
   */
  function arc(m, dmg, seen) {
    const L = lvl(), p = K.P(), n = Math.max(1, Math.ceil(dmg / 2));
    const water = waterNear(m.x, m.y, ARC_REACH), inWater = (o) => water.has(K.key(o.x, o.y));
    const hit = L.monsters.filter(o => !seen.has(o) && !o.collapsed && inWater(o));
    const heroIn = !seen.has('hero') && inWater(p);
    const comp = K.companionHere();
    const compIn = !!comp && !seen.has('companion') && inWater(comp);
    if (!hit.length && !heroIn && !compIn) return;
    if (heroIn) seen.add('hero');
    if (compIn) seen.add('companion');
    Sound.play('cast', K.heard(m, { spell: 'lightning' }));
    K.floatText(m, 'arcs', '#bfe4ff');
    for (const o of hit) {
      seen.add(o);
      if (!L.monsters.includes(o)) continue;
      if (o.sunk) K.surface(o, 'shock');
      K.spray(o, 'spark', 0.3, false);
      K.damageMonster(o, K.elemental(o, n, 'lightning'), 'shock');
    }
    if (compIn) K.companionHurt(Math.max(1, Math.ceil(dmg / 3)), 'The lightning runs through the water into');
    if (heroIn) {
      const own = Math.max(1, Math.ceil(dmg / 3));
      K.hurtPlayer(own, `The lightning runs through the water into you as well! (${own})`, null, 'their own lightning, through the water');
    }
  }

  /** Cold freezes the water round what it struck: what stands in it is held fast. */
  function freeze(m) {
    const G = K.G, L = lvl(), p = K.P();
    const squares = [[m.x, m.y], ...DIRS4.map(([dx, dy]) => [m.x + dx, m.y + dy])].filter(([x, y]) => wet(x, y));
    for (const [x, y] of squares) fields()[K.key(x, y)] = { k: 'ice', until: G.t + ICE_MS };
    const stands = L.monsters.includes(m);
    const on = (o) => squares.some(([x, y]) => o.x === x && o.y === y);
    for (const o of L.monsters) {
      if (!on(o) || o.collapsed || o.sunk) continue;
      o.nextAct = Math.max(o.nextAct, G.t + ICE_HOLD);
      if (o.windup) o.windup.until += ICE_HOLD;
      o.snaredUntil = Math.max(o.snaredUntil || 0, G.t + ICE_HOLD);
      K.floatText(o, 'frozen in', '#cfeaff');
    }
    Sound.play('cast', K.heard(m, { spell: 'cone_cold' }));
    K.log(stands ? `The water freezes solid round the ${K.mstat(m).name}, and holds it fast.` : 'The water freezes solid where it fell.', 'good');
    // (a hold already longer, a basilisk's stone, keeps its own name)
    if (on(p) && !((p.held || 0) > G.t + HERO_ICE_HOLD)) {
      p.held = G.t + HERO_ICE_HOLD; p.heldBy = 'ice';
      K.log('The ice closes round your own feet too!', 'bad');
    }
  }

  /**
   * Oil from a broken cask or a flask, over its square and the floor beside it
   * (not the hero's: it tips away from whoever breaks it). On water it floats,
   * and burns there as well as on stone; the water under it still carries
   * lightning until it is alight.
   */
  function spill(x, y) {
    const p = K.P();
    let n = 0, afloat = false;
    for (const [sx, sy] of [[x, y], ...DIRS4.map(([dx, dy]) => [x + dx, y + dy])]) {
      if (!open(sx, sy) || (sx === p.x && sy === p.y)) continue;
      if (wet(sx, sy)) afloat = true;
      const f = fieldAt(sx, sy);
      // (ice is water too, frozen: the oil runs off it)
      if (f && (f.k === 'fire' || f.k === 'oil' || f.k === 'ice')) continue;
      fields()[K.key(sx, sy)] = { k: 'oil' };
      n++;
    }
    if (n) K.log(afloat ? 'Lamp oil spreads out over the water.' : 'Lamp oil spills out across the floor.', 'info');
  }

  /**
   * A goblin's pot of burning oil bursts on these squares: oil over each (the
   * hero's too: it was thrown at them), and alight at once. A monster's fire.
   */
  function firepot(spots) {
    for (const [x, y] of spots) {
      if (!open(x, y)) continue;
      const f = fieldAt(x, y);
      if (f && f.k === 'ice') { delete fields()[K.key(x, y)]; continue; }
      if (!f || f.k !== 'fire') fields()[K.key(x, y)] = { k: 'oil' };
    }
    for (const [x, y] of spots) if (open(x, y)) ignite(x, y, 0, true);
  }

  /**
   * A wraith's grave-cold on a square: ice over it (dry stone too) for a few
   * seconds, and a fire there put out. @returns {boolean} whether it froze
   */
  function rime(x, y) {
    if (!open(x, y)) return false;
    const f = fieldAt(x, y);
    if (f && f.k === 'fire') { delete fields()[K.key(x, y)]; return false; }
    fields()[K.key(x, y)] = { k: 'ice', until: K.G.t + ICE_MS };
    return true;
  }
  /**
   * An acolyte's lightning called down on a square: the full of it there, and
   * half through the water to anyone else wading within a square of it (not
   * across ice). @returns {{hero: number, comp: number}} what reached the hero and the companion
   */
  function stormAt(x, y, dmg) {
    const p = K.P(), water = wet(x, y) ? waterNear(x, y, 1) : new Set();
    const half = Math.max(1, Math.ceil(dmg / 2));
    // (a square that is no longer water, frozen or burning, gives it nothing to come down into)
    if (!wet(x, y)) return { hero: 0, comp: 0 };
    const hero = p.x === x && p.y === y ? dmg : water.has(K.key(p.x, p.y)) && wet(p.x, p.y) ? half : 0;
    const c = K.companionHere();
    const comp = c && water.has(K.key(c.x, c.y)) && wet(c.x, c.y) ? half : 0;
    return { hero, comp };
  }

  /** A fire that reaches an oil cask still whole bursts it. */
  function burstCask(x, y, wild = false) {
    const L = lvl();
    const cask = (L.dressing || []).find(q => q.k === 'oilcask' && q.x === x && q.y === y);
    if (!cask) return;
    K.smash(L, cask, false, true);
    K.log('An oil cask bursts in the heat!', 'bad');
    spill(x, y);
    ignite(x, y, 0, wild);
  }

  /**
   * A gout of fire down a line (a cave wyrm's breath) sets alight what will
   * burn along it, from so many squares out: a wyrm's fire passes over the
   * square under its jaws.
   */
  function burnLine(x, y, dx, dy, reach, from = 1) {
    for (let i = 1; i <= reach; i++) {
      const sx = x + dx * i, sy = y + dy * i;
      if (!open(sx, sy)) break;
      if (i < from) continue;
      const f = fieldAt(sx, sy);
      if (f && f.k === 'ice') { delete fields()[K.key(sx, sy)]; continue; }
      ignite(sx, sy, 0, true);
      burstCask(sx, sy, true);
    }
  }

  /** Fire that strikes no creature, at the end of its flight: it melts ice there, or sets alight what will burn. */
  function scorch(x, y) {
    if (!open(x, y) || K.G.status !== 'playing') return;
    const f = fieldAt(x, y);
    if (f && f.k === 'ice') { delete fields()[K.key(x, y)]; return; }
    ignite(x, y, 0);
  }

  /** Fire spreads and burns, ice melts, ash settles: called every frame the dungeon runs. */
  function tick() {
    const L = lvl(), G = K.G;
    quake();
    if (G.status === 'playing') smoulder();
    if (G.status !== 'playing' || !L.fields) return;
    const depthBite = Math.floor(G.depth / 3);
    for (const k of Object.keys(L.fields)) {
      const f = L.fields[k];
      if (!f) continue;
      if ((f.k === 'ice' || f.k === 'ash') && f.until && G.t >= f.until) { delete L.fields[k]; continue; }
      if (f.k !== 'fire') continue;
      const [x, y] = k.split(',').map(Number);
      // (oil that burnt on moss took the moss with it: that ash stays, as the moss's does)
      if (G.t >= f.until) {
        L.fields[k] = { k: 'ash', until: (f.fuel === 'oil' || f.fuel === 'vent') && L.twist !== 'overgrown' ? G.t + OIL_ASH_MS : 0, ...(f.fuel === 'door' ? { door: true } : {}) };
        if (f.fuel === 'door') doorFalls(x, y);
        continue;
      }
      if (G.t >= f.spread) {
        f.spread += SPREAD_MS;
        for (const [dx, dy] of DIRS4) {
          const nx = x + dx, ny = y + dy, kind = fuel(nx, ny);
          burstCask(nx, ny, !!f.wild);
          if (!kind) continue;
          if (kind === 'moss' && f.gen >= MOSS_REACH) continue;
          if (Math.random() < (kind === 'oil' ? 0.9 : 0.5)) ignite(nx, ny, kind === 'oil' ? 0 : f.gen + 1, !!f.wild);
        }
      }
      if (G.t >= f.burn) {
        f.burn += BURN_MS;
        for (const m of L.monsters.filter(o => o.x === x && o.y === y && !o.collapsed && !o.sunk)) K.damageMonster(m, K.elemental(m, d(1, 6) + depthBite, 'fire'), f.wild ? 'blaze' : 'burning');
        if (G.status !== 'playing') return;
        const p = K.P();
        // (a hero wearing the Cinder Ring walks through it: the web still burns)
        if (p.x === x && p.y === y && K.hasPower && K.hasPower('emberwalk')) K.burnWeb();
        else if (p.x === x && p.y === y) {
          // a web holding the hero burns away, as it does for a fire spell
          K.burnWeb();
          const n = d(1, 4) + depthBite;
          K.hurtPlayer(n, `The flames lick at you! (${n})`, null, f.fuel === 'oil' ? 'burning oil' : f.fuel === 'door' ? 'a burning door' : f.fuel === 'vent' ? 'a fire from the floor' : 'burning moss');
          if (G.status !== 'playing') return;
        }
        const c = K.companionHere();
        if (c && c.x === x && c.y === y) K.companionHurt(d(1, 4) + depthBite, 'The flames lick at');
      }
    }
  }

  /**
   * A floor of tremors: every so often the ground shudders, and the squares
   * rock will fall on are marked, the hero's own among them, so standing still
   * is never safe. When the marks are done it lands on whatever stands there.
   * Kept on the level as `quake` (when it next shudders, and what is falling).
   */
  function quake() {
    const L = lvl(), G = K.G, p = K.P();
    if (L.twist !== 'tremors') return;
    const q = L.quake || (L.quake = { next: G.t + QUAKE_GAP[0] / 2, falls: [] });
    for (const f of q.falls.filter(o => G.t >= o.lands)) {
      q.falls.splice(q.falls.indexOf(f), 1);
      rockFalls(f.x, f.y);
      if (G.status !== 'playing') return;
    }
    if (G.t < q.next) return;
    q.next = G.t + QUAKE_GAP[0] + Math.random() * (QUAKE_GAP[1] - QUAKE_GAP[0]);
    // (none fall round a hero on the stair: they are leaving, and a stair is no place to dodge)
    if (K.tile(p.x, p.y) === K.T.STAIRS_DOWN || K.tile(p.x, p.y) === K.T.STAIRS_UP) return;
    const near = [];
    for (let dy = -QUAKE_REACH; dy <= QUAKE_REACH; dy++) for (let dx = -QUAKE_REACH; dx <= QUAKE_REACH; dx++) {
      const x = p.x + dx, y = p.y + dy;
      if ((dx || dy) && Math.abs(dx) + Math.abs(dy) <= QUAKE_REACH && K.tile(x, y) === K.T.FLOOR) near.push({ x, y });
    }
    const spots = [{ x: p.x, y: p.y }];
    while (spots.length <= QUAKE_FALLS && near.length) spots.push(near.splice(Math.floor(Math.random() * near.length), 1)[0]);
    for (const s of spots) q.falls.push({ x: s.x, y: s.y, at: G.t, lands: G.t + QUAKE_WARN });
    K.log('The ground shudders, and dust sifts down from the roof! Get out from under it!', 'bad');
    Sound.play('rumble');
    K.shake(3, 900);
  }
  /** Rock lands on a square: on the hero, a companion, and the monsters standing there alike. */
  function rockFalls(x, y) {
    const L = lvl(), G = K.G, p = K.P();
    for (const m of L.monsters.filter(o => o.x === x && o.y === y && !o.collapsed && !o.sunk && !o.disguised)) {
      K.damageMonster(m, d(2, 6) + G.depth, 'rockfall');
      if (G.status !== 'playing') return;
    }
    if (p.x === x && p.y === y) {
      const n = d(2, 6) + Math.floor(G.depth / 2);
      K.hurtPlayer(n, `Rock crashes down on you from the roof! (${n})`, null, 'falling rock');
      if (G.status !== 'playing') return;
      K.shake(6, 500);
    }
    const c = K.companionHere();
    if (c && c.x === x && c.y === y) K.companionHurt(d(2, 6) + Math.floor(G.depth / 2), 'Rock crashes down on');
    if (dist({ x, y }, p) <= 5) Sound.play('smash', K.heard({ x, y }));
    // what came down stays where it fell, for looks (rubble blocks nothing)
    const dr = L.dressing || (L.dressing = []);
    if (dr.filter(o => o.k === 'rubble' && o.fell).length < 40 && !dr.some(o => o.x === x && o.y === y)) dr.push({ k: 'rubble', x, y, ox: 0, oy: 0, fell: true });
  }
  /** The squares rock is about to fall on, and how near it is to landing (0 to 1), for the renderer and the bot. */
  function falling() {
    const L = lvl(), G = K.G;
    return ((L.quake && L.quake.falls) || []).map(f => ({ x: f.x, y: f.y, u: Math.max(0, Math.min(1, (G.t - f.at) / Math.max(1, f.lands - f.at))) }));
  }

  /** The squares a crack's flare covers: its own and the four beside it that are open floor. */
  function ventArea(v) {
    return [[0, 0], ...DIRS4].map(([dx, dy]) => ({ x: v.x + dx, y: v.y + dy })).filter(s => open(s.x, s.y));
  }
  /**
   * Flames on a square that need no fuel (a crack's flare, an emberling's blaze):
   * oil there goes up as oil does, ice melts instead, and the rest burns a moment.
   * A monster's fire, not the hero's.
   */
  function flame(x, y, ms = VENT_FIRE_MS) {
    const G = K.G, f = fieldAt(x, y);
    if (!open(x, y)) return;
    if (f && f.k === 'ice') { delete fields()[K.key(x, y)]; return; }
    if (f && f.k === 'fire') { f.until = Math.max(f.until, G.t + ms); return; }
    if (fuel(x, y)) { ignite(x, y, 0, true); return; }
    // (it spreads no further than the moss or oil beside it would let any fire)
    fields()[K.key(x, y)] = { k: 'fire', fuel: 'vent', until: G.t + ms, spread: G.t + SPREAD_MS, burn: G.t + 150, gen: MOSS_REACH, wild: true };
  }
  /**
   * A smouldering floor's cracks, each in its own time: it glows for a moment
   * (seen, and heard close by), then flares over its square and the four beside
   * it. One sealed by cold waits out the seal.
   */
  function smoulder() {
    const L = lvl(), G = K.G, p = K.P();
    if (L.twist !== 'smouldering' || !L.vents) return;
    for (const v of L.vents) {
      if (!v.next) v.next = G.t + 2000 + Math.random() * VENT_GAP[1];
      if ((v.sealedUntil || 0) > G.t) continue;
      if (!v.heat && G.t >= v.next) {
        // (never 0, which reads as quiet: the clock starts there)
        v.heat = Math.max(1, G.t);
        if (dist(v, p) <= 5) Sound.play('hiss', K.heard(v));
        continue;
      }
      if (v.heat && G.t >= v.heat + VENT_WARN) {
        v.heat = 0;
        v.next = G.t + VENT_GAP[0] + Math.random() * (VENT_GAP[1] - VENT_GAP[0]);
        for (const s of ventArea(v)) flame(s.x, s.y);
        if (dist(v, p) <= 6 && !(L.ventSaid > G.t)) { L.ventSaid = G.t + 6000; K.log('A crack in the floor flares, and fire sheets out of it!', 'bad'); }
        if (dist(v, p) <= 6) Sound.play('cast', K.heard(v, { spell: 'burning_hands' }));
      }
    }
  }
  /** Cold by a crack seals it a while: its glow dies, and it does not flare. @returns {number} how many were sealed */
  function seal(x, y) {
    const L = lvl(), G = K.G;
    if (L.twist !== 'smouldering' || !L.vents) return 0;
    let n = 0;
    for (const v of L.vents) {
      if (dist(v, { x, y }) > 1 || (v.sealedUntil || 0) > G.t) continue;
      v.sealedUntil = G.t + VENT_SEAL_MS; v.heat = 0; v.next = v.sealedUntil + 2000;
      n++;
    }
    if (n) K.log(n > 1 ? 'The cold crusts the glowing cracks over: they will not flare for a while.' : 'The cold crusts the glowing crack over: it will not flare for a while.', 'good');
    return n;
  }
  /** A smouldering floor's cracks for the renderer and the bot: where, how near to flaring (0 to 1, or 0 when quiet), sealed or not, and the squares a flare would cover. */
  function vents() {
    const L = lvl(), G = K.G;
    if (!L.vents) return [];
    return L.vents.map(v => ({ x: v.x, y: v.y, heat: v.heat ? Math.max(0, Math.min(1, (G.t - v.heat) / VENT_WARN)) : 0, sealed: (v.sealedUntil || 0) > G.t, area: v.heat ? ventArea(v) : [] }));
  }

  /** A burnt door falls in: the doorway stands open, and whatever lock it had is gone with it. */
  function doorFalls(x, y) {
    const L = lvl();
    if (K.tile(x, y) === K.T.DOOR || K.tile(x, y) === K.T.DOOR_LOCKED) K.setTile(x, y, K.T.DOOR_OPEN);
    if (L.locks) delete L.locks[K.key(x, y)];
    // (kept apart from what lies on the floor, which oil or fire may cover again)
    (L.burntDoors || (L.burntDoors = {}))[K.key(x, y)] = true;
    if (dist({ x, y }, K.P()) <= 6) K.log('The burning door gives way and falls in.', 'info');
    Sound.play('door', K.heard({ x, y }));
  }

  /** What the renderer draws on the floor, and where flames stand. */
  function view() {
    const out = [];
    const F = lvl().fields;
    if (!F) return out;
    for (const k in F) {
      const [x, y] = k.split(',').map(Number), f = F[k];
      // (a door on fire, how far through its burning: the renderer chars it as it goes)
      out.push({ x, y, k: f.k, fuel: f.fuel || '', burnt: f.fuel === 'door' ? Math.max(0, Math.min(1, 1 - (f.until - K.G.t) / DOOR_FIRE_MS)) : 0 });
    }
    return out;
  }

  return { fieldAt, wet, fuel, ignite, strike, scorch, spill, firepot, rime, stormAt, burstCask, burnLine, tick, view, falling, flame, seal, vents };
}
