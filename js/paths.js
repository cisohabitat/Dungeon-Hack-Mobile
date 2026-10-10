// The paths: at PATH_LEVEL each class takes one of two for the rest of the
// run, and at CAPSTONE_LEVEL masters it (PATHS in data.js says what each
// does). Every effect lives in one small function here, and the rule it
// changes asks it once, so a path touches the rest of the rules at a single
// point each. The relic sets and the saves a hero's gear adds sit here too,
// beside the Assassin's strike from the shadows that the Nightwalk deepens.
// Wired near the end of game.js, borrowing what it needs through K.
import { Dice, d } from './rng.js';
import { ITEMS, PATHS } from './data.js';
import { RELIC_SETS } from './relics.js';

/** @param {any} K */
export function makePaths(K) {
  const P = (/** @type {any[]} */ ...a) => K.P(...a);
  const mstat = (/** @type {any[]} */ ...a) => K.mstat(...a);
  const effectFrom = (/** @type {any[]} */ ...a) => K.effectFrom(...a);
  const emit = (/** @type {any[]} */ ...a) => K.emit(...a);
  const focusHas = (/** @type {any[]} */ ...a) => K.focusHas(...a);
  const hasTalent = (/** @type {any[]} */ ...a) => K.hasTalent(...a);
  const lvl = (/** @type {any[]} */ ...a) => K.lvl(...a);
  const noteHealed = (/** @type {any[]} */ ...a) => K.noteHealed(...a);
  const opening = (/** @type {any[]} */ ...a) => K.opening(...a);
  const spellDC = (/** @type {any[]} */ ...a) => K.spellDC(...a);
  const STAT_WORD = K.STAT_WORD;

  // ---------- paths ----------
  // At PATH_LEVEL each class takes one of two paths for the rest of the run
  // (PATHS in data.js says what each does). Every effect lives in one small
  // function here, and the rule it changes asks it once, so a path touches
  // the rest of the rules at a single point each.
  /** Whether the hero has taken this path. */
  const onPath = id => P().path === id;
  /** The hero's path as PATHS describes it, or null before one is chosen. */
  const pathOf = (p = P()) => (PATHS[p.cls] || []).find(x => x.id === p.path) || null;
  // At CAPSTONE_LEVEL a hero on a path masters it: one of its two capstones,
  // each a harder edge on something the path already does, so a run's last
  // floors have something new in them where before the path was the end of it.
  /** Whether the hero has taken this capstone. */
  const capped = id => P().capstone === id;
  /** The hero's capstone as PATHS describes it, or null. */
  const capstoneOf = (p = P()) => { const x = pathOf(p); return (x && (x.capstones || []).find(c => c.id === p.capstone)) || null; };
  /** A share more, true on every roll rather than only on big numbers (see aTenthMore). */
  const moreBy = (n, f) => { const x = n * (1 + f), whole = Math.floor(x); return whole + (Dice.chance(x - whole) ? 1 : 0); };
  // Knight: the shield is the point. A guard needs one up; the footing does not.
  /** More armour from a Knight's shield. */
  const knightShieldAC = () => (onPath('knight') ? 1 : 0);
  /** An ordinary blow that lands on a Knight with a shield up: one in eight is caught on it, for half. */
  function knightGuard(dmg) {
    if (!onPath('knight') || !P().eq.shield || d(1, capped('unbreakable') ? 4 : 8) !== 1) return dmg;
    return Math.max(1, Math.ceil(dmg / 2));
  }
  /** A warned trick that lands on a Knight does a quarter less (after Stand Firm, if taken). */
  const knightSteadfast = dmg => (onPath('knight') ? Math.max(1, Math.ceil(dmg * 0.75)) : dmg);
  // Berserker: harder the worse it goes, and nothing held back for guarding.
  /** A Berserker's rage: +1 on every blow for each sixth of life lost, up to +4. */
  function berserkerRage() {
    const p = P();
    if (!onPath('berserker')) return 0;
    // Bloodlust's rage climbs faster as well as higher, or its +6 would only come at no life at all
    const deep = capped('bloodlust');
    return Math.max(0, Math.min(deep ? 6 : 4, Math.floor((deep ? 8 : 6) * (1 - p.hp / p.maxHp))));
  }
  /** Below half their life a Berserker's swing comes a tenth sooner. */
  const berserkerFrenzy = () => (onPath('berserker') && P().hp < P().maxHp / 2 ? 0.9 : 1);
  /** A Berserker fights open. */
  const berserkerOpen = () => (onPath('berserker') ? -2 : 0);
  // Templar: the front-line priest.
  /** A Templar's blow on the undead: 1d3 more (Sanctified's die adds to it). */
  const templarBlow = m => (onPath('templar') && mstat(m).undead ? d(1, capped('dawnbringer') ? 6 : 3) : 0);
  /** Holy Smite in a Templar's hands deals a tenth more. */
  /**
   * A tenth more, true on every cast rather than only on big numbers: what
   * rounding would lose is a chance of one more. Rounded, a Smite of 4
   * stayed 4, and most early Smites and heals were that small.
   */
  const aTenthMore = n => { const x = n * 1.1, whole = Math.floor(x); return whole + (Dice.chance(x - whole) ? 1 : 0); };
  const templarSmite = (sp, dmg) => (sp.id === 'smite' && onPath('templar') ? (capped('crusade') ? moreBy(dmg, 0.25) : aTenthMore(dmg)) : dmg);
  // Healer: mending, and the points to spend on it.
  /**
   * A Healer's healing spell heals a quarter more (after Healing Hands, if
   * taken). A tenth was a rounding error: Healer trailed Templar on both
   * difficulties, and its mending was half of what a talent gives.
   */
  const healerHeal = n => { if (!onPath('healer')) return n; const x = n * 1.25, whole = Math.floor(x); return whole + (Dice.chance(x - whole) ? 1 : 0); };
  /** A Healer's deeper well: a spell point for every three hero levels. */
  const healerSp = p => (p.path === 'healer' ? Math.floor(p.level / 3) : 0);
  /** While Protection is up a Healer mends a hit point every four seconds, on a clock of its own beside Warding Light's. */
  function healerMercy() {
    const p = P();
    if (!onPath('healer') || p.hp >= p.maxHp || !effectFrom('ac', 'protection') || K.G.t < (p.nextMercy || 0)) return;
    p.hp++; p.nextMercy = K.G.t + 4000; noteHealed(1); emit('stats');
  }
  // Pyromancer: hotter fire that keeps burning, and the cold given up for it.
  /** The fire spells and the fire scroll in a Pyromancer's hands deal a fifth more. */
  const pyroFire = dmg => (onPath('pyromancer') ? Math.round(dmg * (capped('inferno') ? 4 / 3 : 1.2)) : dmg);
  /** Whether the hero's fire leaves things burning: Kindling, or a Pyromancer's own. */
  const kindles = () => hasTalent('kindling') || onPath('pyromancer');
  /** Set what the hero's fire struck burning: three seconds, six when Kindling and the path both feed it. */
  function setBurning(m) {
    const ms = (hasTalent('kindling') && onPath('pyromancer') ? 6000 : 3000) * (capped('wildfire') ? 2 : 1);
    m.dot = { kind: 'burning', until: K.G.t + ms, next: K.G.t + 1000, die: capped('wildfire') ? 6 : 4 };
  }
  // Frostweaver: the cold holds things back, and the Shield holds longer.
  const FROST_SPELLS = ['lightning', 'cone_cold'];
  /** How long a spell holds back what it hits: Rime's jolt, a Frostweaver's, or both. */
  const spellHold = sp => (sp.pierce && hasTalent('rime') ? 700 : 0) + (sp.id === 'thorn_lash' && onPath('grovewarden') ? 700 : 0) + (sp.id === 'call_lightning' && hasTalent('stormborn') ? 700 : 0) + (onPath('frostweaver') && FROST_SPELLS.includes(sp.id) ? (capped('deep_winter') ? 1400 : 700) : 0)
    + (FROST_SPELLS.includes(sp.id) && focusHas('storm') ? 400 : 0);
  // What a spell costs, and what a buff gives and for how long, with the paths in.
  /** Spell points a spell costs this hero. */
  function spellCost(sp) {
    let cost = sp.cost;
    if (sp.id === 'lightning' && onPath('frostweaver')) cost -= 1;
    else if (sp.id === 'cone_cold' && onPath('frostweaver')) cost -= 2;
    // a Pyromancer has given the cold up for the fire, and it comes harder to them
    else if (FROST_SPELLS.includes(sp.id) && onPath('pyromancer')) cost += sp.id === 'cone_cold' ? 2 : 1;
    // (and the fire they throw three squares down the passage costs them a point more than a fan in the face)
    else if (sp.id === 'burning_hands' && onPath('pyromancer')) cost += 1;
    if ((sp.id === 'smite' && capped('crusade')) || (sp.kind === 'heal' && capped('wellspring'))) cost = Math.max(1, cost - 1);
    // a Shapeshifter reaches the bear more easily, and the words less so
    if (onPath('shapeshifter')) cost += sp.id === 'wild_shape' ? -1 : 1;
    if (sp.id === 'mending_moss' && capped('heartwood')) cost = Math.max(1, cost - 1);
    // an overgrown floor is a druid's own ground
    if (P().cls === 'druid' && K.G && K.G.levels && lvl() && lvl().twist === 'overgrown') cost = Math.max(1, cost - 1);
    // the Robe of the Magi eases the great workings: five points or more cost one less
    const robe = P().eq.armor;
    if (robe && ITEMS[robe.t].cheap && cost >= 5) cost -= 1;
    return cost;
  }
  /** How much a buff gives: a Frostweaver's Shield gives one more. */
  const buffAmount = sp => sp.amount + (sp.id === 'shield' && onPath('frostweaver') ? (capped('ice_armour') ? 3 : 1) : 0);
  /** How long a buff lasts: Zeal and a Templar each double Bless, and a Frostweaver's Shield lasts half as long again. */
  const buffDuration = sp => sp.dur * (sp.id === 'bless' && hasTalent('zeal') ? 2 : 1) * (sp.id === 'bless' && onPath('templar') ? 2 : 1) * (sp.id === 'shield' && onPath('frostweaver') ? 1.5 : 1);
  const SPAN_WORDS = { 60000: 'a minute', 90000: 'a minute and a half', 120000: 'two minutes', 180000: 'three minutes', 240000: 'four minutes' };
  /** A spell's description as it works for this hero: a buff's amount and time with the paths and talents in. */
  // what a foe's saving throw does to a spell, said on its card (the number to beat moves with the hero)
  function saveLine(sp) {
    if (sp.kind === 'root') return ` A foe that saves by its Strength (against your ${spellDC()}) is held two thirds as long; a boss always half.`;
    if (sp.save) return ` A foe that saves by its ${STAT_WORD[sp.save]} (against your ${spellDC()}) takes three quarters.`;
    if (sp.kind === 'bolt') return ' Never saved against.';
    return '';
  }
  function spellDesc(sp) {
    if (sp.kind === 'shape') return sp.desc.replace('forty seconds', `${Math.round(K.wild.duration() / 1000)} seconds`);
    if (sp.kind !== 'buff') return sp.desc + saveLine(sp);
    const dur = buffDuration(sp);
    return sp.desc.replace(/^\+\d+/, '+' + buffAmount(sp))
      .replace(/for (a minute and a half|a minute)/, 'for ' + (SPAN_WORDS[dur] || `${Math.round(dur / 1000)} seconds`));
  }
  // Assassin: the blow from the dark.
  /** What a strike from the shadows multiplies by: two, one more for Assassinate, one more for the path. */
  // (past the sixth floor of sixteen, on Normal or Easy, what sleeps there sleeps lightly and
  // turns from the blade a little as it falls: one less. The thief alone was left untouched by
  // the deep floors' reckoning, and won 87.5% there where the classes together won 77.5%; with
  // this, 84.75%, and the Assassin no longer five to eight points over the Trickster. From the
  // thirteenth floor only, it was worth one point)
  // (floored at the double blow, the trim was undone: a Trickster lost nothing, and the thief came
  // back to 87.75%. A thief with nothing to add strikes there as any blow, and is not told otherwise)
  const sneakMult = () => 2 + (hasTalent('assassinate') ? 1 : 0) + (onPath('assassin') ? 1 : 0) + (capped('death_mark') ? 1 : 0) + (setWorn('night') ? 1 : 0)
    - (K.G && (K.G.opts.levels || 8) >= 16 && K.G.opts.difficulty !== 'hard' && K.G.depth > 6 ? 1 : 0);
  /** Whether every piece of a relic set is worn at once. */
  const setWorn = (id, p = P()) => RELIC_SETS[id].pieces.every(u => Object.values(p.eq).some(it => it && it.u === u));
  /** The Order of the Dawn's pair: +1d4 on the undead. */
  const dawnBlow = m => (setWorn('dawn') && mstat(m).undead ? d(1, 4) : 0);
  /** A Blessed make on armour or shield: +1 to every save, each. */
  const blessedSaves = (p = P()) => ['armor', 'shield'].filter(s => p.eq[s] && p.eq[s].px === 'blessed').length;
  /** What the hero adds to every saving throw of their own: blessed gear, and renown's Unshaken. */
  const heroSaves = (p = P()) => blessedSaves(p) + (p.perkSave || 0);
  /** Squares closer a sleeping monster lets an Assassin come. */
  const assassinQuiet = () => (onPath('assassin') ? 1 : 0);
  // Trickster: never where the blow lands.
  /** One ordinary blow in eight that would land on a Trickster, they slip aside from. */
  const tricksterSlip = () => onPath('trickster') && d(1, capped('vanish') ? 5 : 8) === 1;
  /** A Trickster's ordinary blow that swung at the air leaves its maker open, as an answered trick does. */
  function tricksterOpening(m) { if (onPath('trickster')) opening(m); }
  /** A Trickster's eye and feet for a trap. */
  const tricksterTraps = () => (onPath('trickster') ? 4 : 0);
  /** A Trickster finds a quarter more in every pile of gold and every gem. */
  const tricksterPurse = q => (onPath('trickster') ? Math.round(q * 1.25) : q);


  return { onPath, pathOf, capped, capstoneOf, moreBy, knightShieldAC, knightGuard, knightSteadfast, berserkerRage, berserkerFrenzy, berserkerOpen, templarBlow, aTenthMore, templarSmite, healerHeal, healerSp, healerMercy, pyroFire, kindles, setBurning, FROST_SPELLS, spellHold, spellCost, buffAmount, buffDuration, SPAN_WORDS, saveLine, spellDesc, sneakMult, setWorn, dawnBlow, blessedSaves, heroSaves, assassinQuiet, tricksterSlip, tricksterOpening, tricksterTraps, tricksterPurse };
}
