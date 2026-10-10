// The legendary pieces (LEGEND entries in relics.js): one made for each path,
// found as a champion falls before a hero already walking it, once a run.
// Each power bends the way its path fights, and every rule here is asked from
// the one place in the fight it changes, so a piece touches the rest of the
// rules at a single point each, as a path does.
//
// The grades of what is found live here too: plain, fine, rare, relic and
// legendary, read from the piece rather than kept on it, so nothing that
// copies an item has to carry one more field.
// Wired near the end of game.js, borrowing what it needs through K.
import { d } from './rng.js';
import { ITEMS, MONSTERS } from './data.js';
import { RELICS, legendFor } from './relics.js';
import { Sound } from './sound.js';

/** How a found thing ranks, lowest first: the word the pack shows, and its colour's name in the style sheet. */
const GRADES = { plain: 'Plain', fine: 'Fine', rare: 'Rare', relic: 'Relic', legend: 'Legendary' };
/** How long the strike from the shadows a slain foe gives the Last Word's bearer lasts. */
const UNSEEN_MS = 4000;
/** How long a foe the cold has held stays brittle for the Grimoire, past the hold itself. */
const BRITTLE_MS = 1500;

/** @param {any} K */
export function makeLegends(K) {
  const P = () => K.P();
  const lvl = () => K.lvl();
  const has = power => K.hasPower(power);
  const log = (msg, cls) => K.log(msg, cls);

  /**
   * How a found thing ranks, as far as the player can tell: a relic or a
   * legend says so at a glance; ordinary gear only once its make is known,
   * fine for a good enchantment, rare for a quality of make or a power.
   * @returns {'plain'|'fine'|'rare'|'relic'|'legend'}
   */
  function grade(it) {
    const r = it && it.u && RELICS[it.u];
    if (r) return r.legend ? 'legend' : 'relic';
    const b = it && ITEMS[it.t];
    if (!b || !['weapon', 'armor', 'shield', 'ring', 'amulet', 'cloak'].includes(b.kind) || it.h) return 'plain';
    if (it.curse || (it.e || 0) < 0) return 'plain';
    if (it.pw || it.px) return 'rare';
    return (it.e || 0) > 0 ? 'fine' : 'plain';
  }

  /**
   * A champion falls: the legendary piece made for the hero's path drops
   * with it, if the hero walks one and has not found it yet this run.
   * @returns {boolean} whether one dropped
   */
  function drop(m) {
    const p = P(), id = legendFor(p.path || ''), L = lvl(), G = K.G;
    if (!id || !G.relics || G.relics.found.includes(id)) return false;
    if (Object.values(L.items).some(pile => pile.some(it => it.u === id))) return false;
    const k = K.key(m.x, m.y);
    (L.items[k] = L.items[k] || []).push(K.relicItem(id));
    log(`Something falls as the ${K.mstat(m).named ? 'champion' : K.mstat(m).name} does, made for a ${K.pathOf().name}: ${RELICS[id].name[0].toUpperCase() + RELICS[id].name.slice(1)}, a legend of its kind.`, 'good');
    K.floatText(m, 'legendary!', '#ffb040');
    return true;
  }

  /** The Bastion: a blow caught on the shield is caught whole, and the Bash is ready again. */
  function caught(m) {
    if (!has('bastion') || !P().eq.shield || K.shaped()) return false;
    const p = P();
    p.abilityReady = Math.min(p.abilityReady || 0, K.G.t);
    log(`The Bastion takes the ${MONSTERS[m.id].name}'s blow whole. Your Bash is ready.`, 'good');
    Sound.play('block', K.heard(m));
    K.floatText(m, 'caught', '#ffb040');
    K.combos.note('shield_wall', m);
    return true;
  }

  /** Motley: a blow slipped leaves its maker open. */
  function mocked(m) { if (has('mock')) { K.opening(m); K.combos.note('jest', m); } }

  /** The Lantern of Mercy: what healing would spill past full life is kept as a ward. */
  function overflow(n) {
    const p = P();
    const over = p.hp + n - p.maxHp;
    if (over <= 0 || !has('overflow')) return;
    const cap = Math.max(1, Math.floor(p.maxHp / 4)), was = p.aegis && p.aegis.until > K.G.t ? p.aegis.hp : 0;
    const now = Math.min(cap, was + over);
    if (now <= was) { p.aegis.until = K.G.t + 60000; return; }
    p.aegis = { hp: now, until: K.G.t + 60000 };
    if (!was) log(`The Lantern of Mercy keeps what the healing spilled: a ward of light (${now}).`, 'good');
  }
  /** What the Lantern's ward takes of a blow before it reaches the hero; returns what is left of it. */
  function warded(dmg) {
    const p = P(), a = p.aegis;
    if (!a || !(a.until > K.G.t) || a.hp <= 0 || dmg <= 0) return { dmg, took: 0 };
    const took = Math.min(dmg, a.hp);
    a.hp -= took;
    if (a.hp <= 0) delete p.aegis;
    K.combos.note('ward_of_light');
    return { dmg: dmg - took, took };
  }

  /** The cold held this foe back: for the Grimoire, it is brittle a while. */
  function chill(m, hold) { m.brittleUntil = Math.max(m.brittleUntil || 0, K.G.t + hold + BRITTLE_MS); }
  const brittle = m => has('shatter') && m.brittleUntil > K.G.t;
  const rooted = m => has('rootbond') && m.heldBy === 'roots' && m.snaredUntil > K.G.t;
  // what the hero's own hand does, as against fire on the floor, a dying thing's poison or a falling rock
  const OWN = tag => !['companion', 'blaze', 'rockfall', 'burning', 'venom', 'bleed'].includes(tag || '');
  /** A blow about to land: the Grimoire's third more on a brittle foe, and Heartroot's 2 on a rooted one. */
  function harder(m, dmg, tag) {
    let n = dmg;
    if (OWN(tag) && brittle(m)) n = Math.round(n * 4 / 3);
    if ((OWN(tag) || tag === 'companion') && rooted(m)) n += 2;
    return n;
  }

  /** A blow or an arrow of the hero's has landed: the Sunhammer's holy fire, and Thornbinder's knot. */
  function landed(m, survived) {
    const G = K.G, mb = K.mstat(m), p = P();
    if (survived && has('sunfire') && mb.undead && !(m.dot && m.dot.kind === 'burning' && m.dot.until > G.t + 1000)) {
      m.dot = { kind: 'burning', until: G.t + 3000, next: G.t + 1000, die: 4 };
      K.floatText(m, 'sunfire', '#ffd860');
      if (p.coating && p.coating.t === 'silver' && p.coating.left > 0) K.combos.note('dawnfire', m);
    }
    if (survived && has('bind') && m.snaredUntil > G.t) { m.snaredUntil = Math.min(m.snaredUntil + 1000, G.t + 6000); K.combos.note('tightening_cord', m); }
  }

  /** When the Last Word's moment was last spent: a kill in that same moment never left the shadows. */
  let spentAt = -1;
  /** How deep in one another's bursts the pyres are: one set off by another is a chain. */
  let pyreDepth = 0;
  /** Whether the Last Word's moment in the shadows is still open; taking it spends it. */
  function unseen() {
    const p = P();
    if (!(p.unseenUntil > K.G.t)) return false;
    p.unseenUntil = 0;
    spentAt = K.G.t;
    return true;
  }

  /**
   * A foe has fallen to the hero or the companion: what each piece makes of
   * a death. `sneak` is a strike from the shadows; `burning` and `brittle`
   * how it stood as it died.
   */
  function felled(m, tag, how) {
    const p = P(), G = K.G;
    if (tag === 'companion') {
      if (has('rootbond') && p.hp < p.maxHp) { K.healPlayer(d(1, 4)); K.combos.note('pack_and_root', m); }
      return;
    }
    if (!OWN(tag) && tag !== 'burning') return;
    if (has('harvest') && p.hp < p.maxHp / 2) {
      const n = d(1, 8);
      K.healPlayer(n);
      K.floatText(m, 'harvest', '#ff7060');
      if (K.capped('bloodlust')) K.combos.note('red_feast', m);
    }
    if (has('feast') && K.shaped()) {
      K.healPlayer(d(1, 6));
      p.shape.until += 5000;
      K.combos.note('feeding_frenzy', m);
    }
    if (how.sneak && has('unseen')) {
      if (spentAt === G.t) K.combos.note('unbroken_shadow', m);
      p.unseenUntil = G.t + UNSEEN_MS;
      log('You melt back into the shadows.', 'good');
    }
    if (how.burning && has('pyre')) { K.combos.note(pyreDepth ? 'chain_pyre' : 'pyre', m); pyre(m); }
    if (how.brittle && has('shatter')) { K.combos.note('shatter', m); shatter(m); }
  }
  const besides = m => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [m.x + dx, m.y + dy]);
  /** Cinderheart: the burning dead burst, and what stands beside them burns. */
  function pyre(m) {
    log(`The ${K.mstat(m).name} bursts in a gout of flame!`, 'good');
    pyreDepth++;
    try {
      for (const [x, y] of besides(m)) {
        const o = K.monsterAt(x, y);
        if (o && o !== m && o.hp > 0) K.damageMonster(o, d(2, 6), 'burn');
        else K.elements.ignite(x, y);
      }
    } finally { pyreDepth--; }
  }
  /** The Grimoire: a brittle foe that dies shatters, and the cold catches those beside it. */
  function shatter(m) {
    log(`The ${K.mstat(m).name} shatters like ice!`, 'good');
    for (const [x, y] of besides(m)) {
      const o = K.monsterAt(x, y);
      if (!o || o === m || o.hp <= 0) continue;
      o.nextAct = Math.max(o.nextAct, K.G.t) + 1500;
      if (o.windup) o.windup.until += 1500;
      chill(o, 1500);
      K.floatText(o, 'chilled', '#a8d8ff');
    }
  }

  /**
   * Farstrider: an arrow that felled its mark flies on down the passage into
   * the next foe in its way, as far as the bow reaches.
   */
  function pierce(fromX, fromY, dx, dy, left, dmg) {
    if (!has('pierce')) return;
    for (let i = 1; i <= left; i++) {
      const x = fromX + dx * i, y = fromY + dy * i;
      if (!K.passable(x, y)) return;
      const o = K.monsterAt(x, y);
      if (!o || (o.disguised && !o.creaked)) continue;
      K.combos.note('skewer', o);
      K.damageMonster(o, Math.max(1, dmg), 'pierce');
      return;
    }
  }

  /**
   * This run's finds: anything rare or better, once the hero knows it for
   * what it is, kept by name even after it is sold or lost, for the hero
   * sheet and the end of the run.
   */
  function noteFinds() {
    const p = P(), st = K.runStats();
    const finds = st.finds = st.finds || [];
    for (const it of [...p.inv, ...Object.values(p.eq)]) {
      if (!it) continue;
      const g = grade(it);
      if (g !== 'rare' && g !== 'relic' && g !== 'legend') continue;
      const key = [it.t, it.e || 0, it.pw || '', it.px || '', it.u || ''].join('|');
      if (finds.some(f => f.key === key)) continue;
      finds.push({ key, name: K.itemName({ ...it, q: 1 }), grade: g, depth: K.G.depth });
    }
  }

  return { GRADES, noteFinds, grade, drop, caught, mocked, overflow, warded, chill, harder, landed, unseen, felled, pierce };
}
