// A druid's ways: Wild Shape, Entangle, and the bond with a companion.
//
// Wild Shape makes a bear of the hero for a while. The bear strikes with its
// claws in place of whatever the hero held (so nothing that rides on a blade,
// a relic's power or an oil, goes with it), turns blows a little better, and
// wears a hide that takes the blows before the hero does. It ends when its
// time runs out, when the hide is torn through, or when the druid speaks any
// other spell: a bear cannot say the words, so the druid lets it go to cast.
// That is the choice the class is built on, claws or words, never both at once.
//
// The bond is smaller and always on: a companion at a druid's side is tougher,
// a floor further on in what it knows, and mended by the druid's healing.
// What it borrows from the game comes through K, as the traders' and the
// monsters' do.
const SHAPE_MS = 40000;
const CLAWS = [1, 8];
const CLAW_MS = 650;
// the bear's hide turns blows as well as taking them
const SHAPE_AC = 2;
const ENTANGLE_MS = 3000;

/** @param {any} K */
export function makeWild(K) {
  /** Whether the hero is a bear just now. */
  const shaped = (p = K.P()) => !!(p && p.shape && p.shape.until > K.G.t);
  /** How long the bear lasts: a Shapeshifter's longer. */
  const duration = () => (K.onPath('shapeshifter') ? 45000 : SHAPE_MS) + (K.hasPower('wild') ? 10000 : 0);
  /** How thick the hide is: 3 and 1 a level, 8 more with Old Hide, and half again with Thick Hide. */
  function hideFor(p) {
    const base = 3 + p.level + (K.capped('old_hide') ? 8 : 0) + (K.hasPower('wild') ? 4 : 0);
    return Math.round(base * (K.hasTalent('thick_hide') ? 1.5 : 1));
  }
  /** What the claws add, beyond the die: a Shapeshifter's, more for a Dire Bear. */
  const clawBonus = () => (K.onPath('shapeshifter') ? (K.capped('dire_bear') ? 5 : 2) : 0);
  /** The bear's claws, in the shape the swing reads a weapon in. */
  function claws() {
    return { name: 'claws', dmg: [CLAWS[0], CLAWS[1], clawBonus()], speed: Math.round(CLAW_MS * K.skillSpeed()), e: 0, px: '', twoHanded: false, range: 0, blunt: false, claws: true, base: 700 };
  }
  /** Take the bear's shape. */
  function begin() {
    const p = K.P(), G = K.G;
    const hide = hideFor(p);
    p.shape = { until: G.t + duration(), hide, full: hide };
    if (G.stats) G.stats.shapes = (G.stats.shapes || 0) + 1;
    K.log(`You drop to all fours, and rise a bear: claws, a thick hide (${hide}), and ${Math.round(duration() / 1000)} seconds before the shape slips.`, 'good');
  }
  /** Let the bear go: its time is up, its hide is torn through, or the druid would speak. */
  function end(why) {
    const p = K.P();
    if (!p.shape) return;
    delete p.shape;
    K.log(why === 'torn' ? 'The blow tears through the bear\'s hide, and you are yourself again, and hurt.'
      : why === 'worn' ? 'The bear\'s hide takes the last of it and is worn through, and the shape falls away from you.'
      : why === 'cast' ? 'You let the bear go, and find the words again.'
        : 'The bear\'s shape slips from you, and you stand up on two feet.', why === 'torn' ? 'bad' : 'info');
    K.emit('stats');
  }
  /**
   * A blow reaches a bear: the hide takes what it can, and what is left goes
   * on to the hero. A hide torn through is let go by torn(), once the blow
   * itself has been told.
   */
  function soak(dmg) {
    const p = K.P();
    if (!shaped(p) || dmg <= 0) return dmg;
    const took = Math.min(p.shape.hide, dmg);
    p.shape.hide -= took;
    return dmg - took;
  }
  /** The hide is used up: the bear is gone, torn through if the blow went on into the druid. */
  function torn(through = 0) {
    const p = K.P();
    if (p.shape && p.shape.hide <= 0) end(through > 0 ? 'torn' : 'worn');
  }
  /** Time runs out on the shape (or a hide torn through was not yet let go). */
  function tick() {
    const p = K.P();
    if (p.shape && p.shape.until <= K.G.t) end('time');
    else torn();
  }
  /** Rending Claws: one blow in three that lands leaves the living bleeding. */
  function rend(m, survived) {
    const p = K.P();
    if (!shaped(p) || !K.hasTalent('rending_claws') || !survived || K.mstat(m).undead) return;
    p.rendN = (p.rendN || 0) + 1;
    if (p.rendN % 3) return;
    m.dot = { kind: 'bleed', until: K.G.t + 3000, next: K.G.t + 1000, die: 4 };
    K.log(`Your claws open the ${K.mstat(m).name}: it bleeds.`, 'good');
  }
  /** For the status line. */
  function chip() {
    const p = K.P();
    if (!shaped(p)) return '';
    return `Bear: ${Math.max(0, Math.ceil((p.shape.until - K.G.t) / 1000))}s, hide ${p.shape.hide}`;
  }

  /** What Entangle would hold: the first foe standing ahead (past fallen bones), or every one in reach with Old Growth. */
  function rootTargets(range) {
    const p = K.P(), [dx, dy] = K.DIRS[p.dir];
    const all = K.capped('old_growth');
    const held = [];
    for (let i = 1; i <= range; i++) {
      const x = p.x + dx * i, y = p.y + dy * i;
      if (!K.passable(x, y)) break;
      const m = K.monsterAt(x, y);
      // (a mimic still shut stops the roots as the barrel it seems)
      if (m && m.disguised) break;
      if (m && !m.collapsed) { held.push(m); if (!all) break; }
    }
    return held;
  }
  /** Entangle: roots hold what rootTargets finds. @returns {number} how many are held */
  function entangle(range) {
    const G = K.G;
    const held = rootTargets(range);
    for (const m of held) {
      const mb = K.mstat(m);
      // the lich's rite is not broken by roots, and a boss tears free in half the time
      const rite = !!(m.windup && m.windup.move === 'rite');
      const broke = !rite && !!(m.windup || m.volley);
      if (!rite) { m.windup = null; m.volley = null; }
      m.pressing = false;
      const hold = (ENTANGLE_MS + (K.onPath('grovewarden') ? 1500 : 0)) / (mb.boss ? 2 : 1);
      if (!rite) m.nextAct = Math.max(m.nextAct, G.t + hold);
      m.snaredUntil = G.t + hold;
      m.awake = true;
      K.meet(m);
      K.floatText(m, 'rooted', '#a8e070');
      K.log(`Roots burst from the stone and wrap the ${mb.name}${broke ? ', breaking off its blow' : ''}. ${rite ? 'Its rite goes on.' : 'It is held fast!'}`, 'good');
    }
    return held.length;
  }

  // ---------- the bond ----------
  /** A druid's companion has half again the hit points; a Grovewarden's twice. */
  const kinHp = () => (K.P() && K.P().cls === 'druid' ? (K.onPath('grovewarden') ? 2 : 1.5) : 1);
  /** And a Grovewarden's strikes 2 harder. */
  const kinBite = () => (K.onPath('grovewarden') ? 2 : 0);
  /** It comes to a druid already a floor further on in what it knows. */
  const kinFloors = () => (K.P() && K.P().cls === 'druid' ? 1 : 0);

  return { shaped, begin, end, soak, torn, tick, claws, rend, chip, hideFor, duration, rootTargets, entangle, kinHp, kinBite, kinFloors, SHAPE_AC };
}
