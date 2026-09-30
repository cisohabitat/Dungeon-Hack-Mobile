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
//
// What lies on each square (fire, ash, oil, ice) is kept on the level in
// `fields`, keyed like its items, so it is saved with the rest. What it
// borrows from the game comes through K, as the monsters' and traders' do.
import { d } from './rng.js';
import { Sound } from './sound.js';

const FIRE_MS = 3000, OIL_FIRE_MS = 4500, SPREAD_MS = 700, BURN_MS = 800;
const ICE_MS = 8000, ICE_HOLD = 2500, HERO_ICE_HOLD = 1200;
// how many squares out from where it caught a moss fire can still spread: two,
// so a hero who strikes from three squares off is clear of it
const MOSS_REACH = 2;
// scorch left by burnt oil fades; burnt moss stays burnt
const OIL_ASH_MS = 30000;
// how far lightning runs through water from what it struck
const ARC_REACH = 2;

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
  /** What would burn on a square: spilt oil, or an overgrown floor's moss not yet burnt. */
  function fuel(x, y) {
    const f = fieldAt(x, y);
    if (f && f.k === 'oil') return 'oil';
    if (f && f.k !== 'oil') return '';
    return lvl().twist === 'overgrown' && K.tile(x, y) === K.T.FLOOR ? 'moss' : '';
  }
  const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  /** Set a square alight. @param {number} gen how many squares from where the fire caught */
  function ignite(x, y, gen = 0) {
    const f = fieldAt(x, y), G = K.G;
    if (f && f.k === 'ice') { delete fields()[K.key(x, y)]; return false; }
    const kind = fuel(x, y);
    if (!kind) return false;
    fields()[K.key(x, y)] = { k: 'fire', fuel: kind, until: G.t + (kind === 'oil' ? OIL_FIRE_MS : FIRE_MS), spread: G.t + SPREAD_MS, burn: G.t + 150, gen };
    const L = lvl();
    if (!(L.fireSaid > G.t)) {
      L.fireSaid = G.t + 4000;
      const seen = dist({ x, y }, K.P()) <= 6;
      K.log(seen ? (kind === 'oil' ? 'The spilt oil goes up in a sheet of flame!' : 'The moss catches, and fire runs across the floor!') : 'Somewhere near, something is burning.', 'bad');
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
    if (el === 'fire') {
      const f = fieldAt(m.x, m.y);
      if (f && f.k === 'ice') { delete fields()[K.key(m.x, m.y)]; K.log('The ice hisses and runs back into water.'); return; }
      ignite(m.x, m.y, 0);
      return;
    }
    if (how !== 'spell' || !wet(m.x, m.y)) return;
    if (el === 'lightning') arc(m, dmg, seen);
    else if (el === 'cold') freeze(m);
  }

  /** Lightning runs through the water from what it struck to all else standing in it close by. */
  function arc(m, dmg, seen) {
    const L = lvl(), p = K.P(), n = Math.max(1, Math.ceil(dmg / 2));
    const hit = L.monsters.filter(o => !seen.has(o) && !o.collapsed && dist(o, m) <= ARC_REACH && wet(o.x, o.y));
    const heroIn = wet(p.x, p.y) && dist(p, m) <= ARC_REACH;
    const comp = K.companionHere();
    const compIn = !!comp && wet(comp.x, comp.y) && dist(comp, m) <= ARC_REACH;
    if (!hit.length && !heroIn && !compIn) return;
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
    const on = (o) => squares.some(([x, y]) => o.x === x && o.y === y);
    for (const o of L.monsters) {
      if (!on(o) || o.collapsed || o.sunk) continue;
      o.nextAct = Math.max(o.nextAct, G.t + ICE_HOLD);
      if (o.windup) o.windup.until += ICE_HOLD;
      o.snaredUntil = Math.max(o.snaredUntil || 0, G.t + ICE_HOLD);
      K.floatText(o, 'frozen in', '#cfeaff');
    }
    Sound.play('cast', K.heard(m, { spell: 'cone_cold' }));
    K.log(`The water freezes solid round the ${K.mstat(m).name}, and holds it fast.`, 'good');
    if (on(p)) {
      p.held = Math.max(p.held || 0, G.t + HERO_ICE_HOLD); p.heldBy = 'ice';
      K.log('The ice closes round your own feet too!', 'bad');
    }
  }

  /** Oil from a broken cask, over its square and the dry floor beside it (not the hero's: it tips away from whoever breaks it). */
  function spill(x, y) {
    const p = K.P();
    let n = 0;
    for (const [sx, sy] of [[x, y], ...DIRS4.map(([dx, dy]) => [x + dx, y + dy])]) {
      if (!open(sx, sy) || wet(sx, sy) || (sx === p.x && sy === p.y)) continue;
      const f = fieldAt(sx, sy);
      if (f && (f.k === 'fire' || f.k === 'oil')) continue;
      fields()[K.key(sx, sy)] = { k: 'oil' };
      n++;
    }
    if (n) K.log('Lamp oil spills out across the floor.', 'info');
  }

  /** A fire that reaches an oil cask still whole bursts it. */
  function burstCask(x, y) {
    const L = lvl();
    const cask = (L.dressing || []).find(q => q.k === 'oilcask' && q.x === x && q.y === y);
    if (!cask) return;
    K.smash(L, cask, false, true);
    K.log('An oil cask bursts in the heat!', 'bad');
    spill(x, y);
    ignite(x, y, 0);
  }

  /** A gout of fire down a line (a cave wyrm's breath) sets alight what will burn along it. */
  function burnLine(x, y, dx, dy, reach) {
    for (let i = 1; i <= reach; i++) {
      const sx = x + dx * i, sy = y + dy * i;
      if (!open(sx, sy)) break;
      const f = fieldAt(sx, sy);
      if (f && f.k === 'ice') { delete fields()[K.key(sx, sy)]; continue; }
      ignite(sx, sy, 0);
      burstCask(sx, sy);
    }
  }

  /** Fire spreads and burns, ice melts, ash settles: called every frame the dungeon runs. */
  function tick() {
    const L = lvl(), G = K.G;
    if (!L.fields) return;
    const depthBite = Math.floor(G.depth / 3);
    for (const k of Object.keys(L.fields)) {
      const f = L.fields[k];
      if (!f) continue;
      if ((f.k === 'ice' || f.k === 'ash') && f.until && G.t >= f.until) { delete L.fields[k]; continue; }
      if (f.k !== 'fire') continue;
      const [x, y] = k.split(',').map(Number);
      if (G.t >= f.until) { L.fields[k] = { k: 'ash', until: f.fuel === 'oil' ? G.t + OIL_ASH_MS : 0 }; continue; }
      if (G.t >= f.spread) {
        f.spread += SPREAD_MS;
        for (const [dx, dy] of DIRS4) {
          const nx = x + dx, ny = y + dy, kind = fuel(nx, ny);
          burstCask(nx, ny);
          if (!kind) continue;
          if (kind === 'moss' && f.gen >= MOSS_REACH) continue;
          if (Math.random() < (kind === 'oil' ? 0.9 : 0.5)) ignite(nx, ny, kind === 'oil' ? 0 : f.gen + 1);
        }
      }
      if (G.t >= f.burn) {
        f.burn += BURN_MS;
        for (const m of L.monsters.filter(o => o.x === x && o.y === y && !o.collapsed && !o.sunk)) K.damageMonster(m, K.elemental(m, d(1, 6) + depthBite, 'fire'), 'burning');
        if (G.status !== 'playing') return;
        const p = K.P();
        if (p.x === x && p.y === y) {
          const n = d(1, 4) + depthBite;
          K.hurtPlayer(n, `The flames lick at you! (${n})`, null, f.fuel === 'oil' ? 'burning oil' : 'burning moss');
          if (G.status !== 'playing') return;
        }
        const c = K.companionHere();
        if (c && c.x === x && c.y === y) K.companionHurt(d(1, 4) + depthBite, 'The flames lick at');
      }
    }
  }

  /** What the renderer draws on the floor, and where flames stand. */
  function view() {
    const out = [];
    const F = lvl().fields;
    if (!F) return out;
    for (const k in F) { const [x, y] = k.split(',').map(Number); out.push({ x, y, k: F[k].k, fuel: F[k].fuel || '' }); }
    return out;
  }

  return { fieldAt, wet, fuel, ignite, strike, spill, burstCask, burnLine, tick, view };
}
