import { ITEMS, MONSTERS, TRAP_TYPES } from './data.js';
import { Dice, d, rnd } from './rng.js';
import { Sound } from './sound.js';

// Monsters: how they wake, move and strike, their signature moves, the lich's
// three-act fight and the named champions. Split out of game.js; everything it
// needs from the game comes through K.

/**
 * @param {import('./types.js').Kit} K  what the game lends: its state and the rules the rest of it keeps
 */
export function makeFoes(K) {
  // the bosses and the named champions (bosses.js), read through K at the moment of use
  const L0guard = (/** @type {any[]} */ ...a) => K.L0guard(...a);
  const bossTurns = (/** @type {any[]} */ ...a) => K.bossTurns(...a);
  const leaveThrone = (/** @type {any[]} */ ...a) => K.leaveThrone(...a);
  const namedMends = (/** @type {any[]} */ ...a) => K.namedMends(...a);
  const namedResolve = (/** @type {any[]} */ ...a) => K.namedResolve(...a);
  const namedTrick = (/** @type {any[]} */ ...a) => K.namedTrick(...a);
  const namedWakes = (/** @type {any[]} */ ...a) => K.namedWakes(...a);
  const raiseGuards = (/** @type {any[]} */ ...a) => K.raiseGuards(...a);
  const riteGuard = (/** @type {any[]} */ ...a) => K.riteGuard(...a);
  const warband = (/** @type {any[]} */ ...a) => K.warband(...a);
  const warbandThin = (/** @type {any[]} */ ...a) => K.warbandThin(...a);
  // ---------- monsters ----------
  function computeDist() {
    const L = K.lvl(), p = K.P();
    const dist = new Int32Array(L.w * L.h).fill(-1);
    const q = [p.y * L.w + p.x];
    dist[q[0]] = 0;
    // (twenty steps is as far as anything hunts, unless something roused by a rest on the
    // ladder's third rung is on the trail from farther off: then the whole floor is walked)
    const whole = L.monsters.some(m => m.hunting);
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi], x = i % L.w, y = (i / L.w) | 0;
      if (!whole && dist[i] > 20) break;
      for (const [dx, dy] of K.DIRS) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= L.w || ny >= L.h) continue;
        const ni = ny * L.w + nx;
        if (dist[ni] >= 0) continue;
        const t = L.tiles[ni];
        if (t !== K.T.FLOOR && t !== K.T.DOOR_OPEN && t !== K.T.DOOR) continue;
        dist[ni] = dist[i] + 1;
        q.push(ni);
      }
    }
    return dist;
  }
  function ensureDist() {
    if (!K.distField || K.G.t - K.distFieldAt > 250) { K.distField = computeDist(); K.distFieldAt = K.G.t; }
  }
  function moveMonster(m, nx, ny) {
    m.fromX = m.x; m.fromY = m.y;
    m.x = nx; m.y = ny;
    m.moveT0 = K.realNow;
    m.moveT1 = K.realNow + Math.max(200, Math.round(MONSTERS[m.id].speed * 0.45));
    springs(m, nx, ny);
  }
  /**
   * A trap that a creature walks onto goes off under it, as under the hero: so a
   * hero who knows where one lies can lead a chase across it. What flies goes over,
   * and a kobold's wire is set where its own kind knows to step round it.
   */
  function springs(m, x, y) {
    const L = K.lvl(), k = K.key(x, y);
    if (!L.traps || !L.traps[k] || (L.snares && L.snares[k])) return;
    const mb = K.mstat(m);
    if (mb.fly || mb.boss) return;
    const tr = TRAP_TYPES[L.traps[k]];
    delete L.traps[k];
    const p = K.P(), seen = Math.abs(x - p.x) + Math.abs(y - p.y) <= 8;
    if (seen) Sound.play('trap', K.heard(m));
    // a pit holds what falls in a moment; a gong wakes the floor about it
    if (tr === TRAP_TYPES.pit) m.snaredUntil = Math.max(m.snaredUntil || 0, K.G.t + MONSTER_PIT_MS);
    if (tr.alarm) { for (const o of L.monsters) if (Math.abs(o.x - x) + Math.abs(o.y - y) <= 10) o.awake = true; if (seen) K.log(`The ${mb.name} treads on an alarm: a gong sounds, and things stir.`, 'bad'); return; }
    if (tr.dmg) { const n = Math.max(1, d(...tr.dmg)); if (seen) K.log(`The ${mb.name} springs a ${tr.name} for ${n}!`, 'good'); K.damageMonster(m, n, 'trap'); }
  }
  // The living will not walk into fire, and one caught in it gets out: a line
  // of burning moss across a passage holds back whatever breathes. The dead,
  // and the lich and the Warlord, come on through it as if it were not there.
  const burning = (x, y) => { const f = K.fieldAt(x, y); return !!f && f.k === 'fire'; };
  // spilt oil beside a fire is as good as alight: it will be in a breath
  const fiery = (x, y) => { if (burning(x, y)) return true; const f = K.fieldAt(x, y); return !!f && f.k === 'oil' && K.DIRS.some(([dx, dy]) => burning(x + dx, y + dy)); };
  // (a creature of fire, an emberling, walks through it)
  const fearsFire = mb => !mb.undead && !mb.boss && !mb.fiery;
  function wander(m) {
    const p = K.P(), shy = fearsFire(K.mstat(m));
    const opts = [];
    for (const [dx, dy] of K.DIRS) {
      const nx = m.x + dx, ny = m.y + dy;
      if (shy && fiery(nx, ny)) continue;
      if (K.passable(nx, ny) && !K.monsterAt(nx, ny) && !K.npcAt(nx, ny) && !K.companionAt(nx, ny) && !(nx === p.x && ny === p.y)) opts.push([nx, ny]);
    }
    if (opts.length) { const o = Dice.pick(opts); moveMonster(m, o[0], o[1]); }
  }
  // A straight, unobstructed line from the monster to the player within range.
  // The lich throws over the heads of anything between, so only walls stop it.
  /** @param {{x: number, y: number}} m @param {number} range @param {boolean} [overHeads] */
  function hasLineToPlayer(m, range, overHeads) {
    const p = K.P();
    if (m.x !== p.x && m.y !== p.y) return null;
    const dx = Math.sign(p.x - m.x), dy = Math.sign(p.y - m.y);
    const dist = Math.abs(p.x - m.x) + Math.abs(p.y - m.y);
    if (dist > range || dist < 2) return null;
    for (let i = 1; i < dist; i++) {
      const x = m.x + dx * i, y = m.y + dy * i;
      if (!K.passable(x, y) || (!overHeads && (K.monsterAt(x, y) || K.npcAt(x, y) || K.companionAt(x, y)))) return null;
    }
    return dist;
  }
  /**
   * How far the Heartforged's stamp runs down each of its four lines: three
   * squares, four once it glows white.
   */
  const stampReach = m => ((m.phase || 0) >= 2 ? 4 : 3);
  // The stamp's fire runs down the lines and is gone: it burnt as long as a
  // vent's, longer than the opening it leaves, and a hero who stepped in to
  // take the opening stood in the fire on every square beside it
  const STAMP_FIRE_MS = 600;
  /** The hero on one of its four lines, near enough, with nothing solid between: how far off, or null. (Fire runs over heads.) */
  function onLines(m, reach) {
    const p = K.P();
    if (m.x !== p.x && m.y !== p.y) return null;
    const dx = Math.sign(p.x - m.x), dy = Math.sign(p.y - m.y), dist = Math.abs(p.x - m.x) + Math.abs(p.y - m.y);
    if (dist < 1 || dist > reach) return null;
    for (let i = 1; i < dist; i++) if (!K.passable(m.x + dx * i, m.y + dy * i)) return null;
    return dist;
  }
  // An avoided blow is feedback, never damage: keep it out of the red rim.
  function defence(m, kind) {
    const bearing = K.relativeBearing(m);
    K.fx.defence = { kind, rel: bearing ? bearing.rel : 0, at: K.realNow, until: K.realNow + 700 };
  }
  function rangedAttack(m) {
    const mb = K.mstat(m), r = mb.ranged;
    m.lungeAt = K.realNow;
    m.struck = true;   // (a shot is a strike at the hero too: see monsterAttack)
    K.meet(m);
    const roll = d(1, 20);
    const ac = K.playerAC();
    const note = K.rollNote(roll, mb.hit, ac, roll === 20);
    Sound.play(m.id === 'archer' ? 'arrow' : 'darkbolt', K.heard(m));
    if (roll === 1 || (roll !== 20 && roll + mb.hit < ac)) { defence(m, 'miss'); K.log(`The ${mb.name} ${r.verb} you and misses.${note}`); return; }
    if (K.hasTalent('evasion') && rnd() < 1 / 3) { defence(m, 'dodge'); K.log(`You twist aside as the ${mb.name} ${r.verb} you.`, 'good'); return; }
    // a mage's Shield is woven against exactly this: bolts of magic break on it
    if (m.id !== 'archer' && K.effectFrom('ac', 'shield')) {
      K.log(`The ${mb.name} ${r.verb} you, and it breaks on your Shield.`, 'good');
      Sound.play('block', K.heard(m));
      defence(m, 'block');
      return;
    }
    let dmg = Math.max(1, d(...r.dmg));
    if (roll === 20) dmg *= 2;
    const warm = r.element === 'cold' && K.hasPower('warmth');
    if (warm) dmg = Math.max(1, Math.ceil(dmg / 2));
    const where = K.relativeBearing(m);
    const aside = where && where.rel !== 0 ? ` ${where.word}` : '';
    K.hurtPlayer(dmg, `The ${mb.name} ${r.verb} you${aside} for ${dmg}.${warm ? ` (${K.warmthFrom()} keeps out the cold)` : ''}${note}`, m);
  }
  /** @param {{hit?: number, mult?: number, extra?: number[], verb?: string, sure?: boolean}} [heavy]  a trick's blow: surer and harder; a sure one was warned of, and armour does not turn it
   * @param {string} [verb]  how a plain blow lands, when it is not a plain hit (a lunge, a reach)
   * @param {string} [missed]  and how it misses: a lunge that misses is still a lunge */
  function monsterAttack(m, heavy, verb, missed) {
    const p = K.P(), mb = K.mstat(m), h = heavy || {};
    m.lungeAt = K.realNow;
    m.struck = true;   // (it has struck at the hero now, hit or miss: an Opening Blow was its chance)
    K.meet(m);
    const roll = d(1, 20);
    const ac = K.playerAC();
    const hit = mb.hit + (h.hit || 0);
    // Mirror Image: the blow falls on an image instead
    if (p.mirrors > 0) { p.mirrors--; K.log(`The ${mb.name} strikes one of your images, and it vanishes.`, 'good'); K.riposte(); return false; }
    const note = h.sure ? (K.showRolls ? ` (d20 ${roll}, warned of: armour does not turn it)` : '') : K.rollNote(roll, hit, ac, roll === 20);
    if (roll === 1 || (!h.sure && roll !== 20 && roll + hit < ac)) {
      K.riposte();
      // a blow the shield turned (it would have landed without one) rings on it
      // (a bear's shield stays behind, and turns nothing)
      const onShield = p.eq.shield && !K.shaped() && roll !== 1 && roll + hit >= ac - ITEMS[p.eq.shield.t].ac - (ITEMS[p.eq.shield.t].focus ? 0 : p.eq.shield.e || 0);
      Sound.play(onShield ? 'block' : 'whiff', K.heard(m));
      defence(m, onShield ? 'block' : 'miss');
      const miss = K.relativeBearing(m);
      K.log(`The ${mb.name} ${missed || 'misses you'}${miss && miss.rel !== 0 ? ` ${miss.word}` : ''}.${note}`, miss && miss.rel !== 0 ? 'bad' : '');
      return false;
    }
    // a Trickster slips an ordinary blow now and then; a warned trick is not so easily slipped
    if (!heavy && K.tricksterSlip()) { defence(m, 'dodge'); K.log(`You slip aside from the ${mb.name}'s blow.`, 'good'); Sound.play('whiff', K.heard(m)); K.legends.mocked(m); return false; }
    // Vanish: the first blow from each foe finds the hero gone (the mirror of Opening Blow)
    if (!heavy && !m.vanishedOn && K.capped('vanish')) { m.vanishedOn = true; defence(m, 'dodge'); K.log(`The ${mb.name} strikes at where you were, and you are not there.`, 'good'); Sound.play('whiff', K.heard(m)); K.legends.mocked(m); return false; }
    // Wild Bulwark: a snared foe's blows at the Warden swing at the air
    if (!heavy && m.snaredUntil > K.G.t && K.capped('wild_bulwark')) { defence(m, 'dodge'); K.log(`The ${mb.name} tears at the cord and its blow swings wide.`, 'good'); Sound.play('whiff', K.heard(m)); return false; }
    // a sellsword at your side may step into an ordinary blow and take it
    if (!heavy && K.companionGuards(m, mb)) return false;
    // rounded, since a blow and a half (the tail's sweep) would otherwise leave half a point of hurt
    let dmg = Math.round(Math.max(1, d(...mb.dmg) + (h.extra ? d(h.extra[0], h.extra[1], h.extra[2]) : 0)) * (h.mult || 1));
    // a crushing blow is doubled already; and on the first two floors a lucky
    // blow is not doubled at all: a level-one hero's whole life was a goblin's
    // one roll of 20, and those deaths taught nothing
    if (roll === 20 && !h.mult && K.G.depth >= 3) dmg *= 2;
    // a grey dwarf grown to twice its height hits half as hard again
    if (m.bigUntil > K.G.t) dmg = Math.round(dmg * ENLARGE_HIT);
    const firm = heavy && K.hasTalent('stand_firm');
    if (firm) dmg = Math.max(1, Math.ceil(dmg / 2));
    // a Knight takes a trick on set feet, and an ordinary blow now and then on the shield
    const was = dmg;
    dmg = heavy ? K.knightSteadfast(dmg) : K.knightGuard(dmg, m);
    // the Bastion catches a blow on the shield whole
    if (!heavy && dmg < was && K.legends.caught(m)) return false;
    const knight = dmg < was ? (heavy ? ' (your footing takes a quarter off)' : ' (caught on your shield: half)') : '';
    if (!heavy) dmg = K.mythics.guard(dmg);
    // a cold touch: a Ring of Warmth takes half of it
    const warm = mb.element === 'cold' && K.hasPower('warmth');
    if (warm) dmg = Math.max(1, Math.ceil(dmg / 2));
    const where = K.relativeBearing(m);
    const aside = where && where.rel !== 0 ? ` ${where.word}` : '';
    K.hurtPlayer(dmg, `The ${mb.name} ${h.verb || verb || 'hits'} you${aside} for ${dmg}.${firm ? ' (Stand Firm halves it)' : ''}${knight}${warm ? ` (${K.warmthFrom()} keeps out the cold)` : ''}${note}`, m);
    if (K.G.status !== 'playing') return true;
    // every venomous bite that lands is fought off with Constitution
    if (mb.poison) K.venomSave('bite', `the ${mb.name}'s`);
    // a strong will holds on to itself against the drain
    if (mb.drain && !K.hasPower('ward')) {
      const c = K.trickSave('wis', 'drain');
      if (c.pass) K.log(`Your will holds against the ${mb.name}'s cold touch.${c.note}`, 'good');
      else { p.maxHp = Math.max(10, p.maxHp - 2); p.hp = Math.min(p.hp, p.maxHp); K.log(`You feel your life force drain away!${c.note}`, 'bad'); }
    }
    if (K.hasPower('thorns')) K.damageMonster(m, d(1, 4), 'thorns');
    return true;
  }
  // Every blow is telegraphed: a monster winds up, and the blow lands only if
  // you are still in reach when it comes down. Step away, or kill it first.
  // The wind-up is taken out of the gap between blows, not added to it, so a
  // monster strikes as often as it always did; it is capped at most of that
  // gap so fast things and groups keep their pace.
  const WINDUP_MS = 600;
  /** Poison lasts longer the deeper the venom: a first-floor needle burns
   * for about ten seconds, the deep ones for the full twenty. */
  const poisonFor = () => ({ until: K.G.t + Math.min(20000, 6000 + 3500 * K.G.depth), next: K.G.t + 2000 });
  /** How long a blow is drawn back: most of the gap between blows, up to WINDUP_MS. A
   * rat's used to be 405ms, and seeing it and moving a thumb to Step takes longer. */
  // (on Easy a fifth longer again, past the cap: the mark is the one thing a new player must learn to see)
  const windupFor = cycle => Math.round(Math.min(WINDUP_MS, cycle * 0.7) * (K.diff().windup || 1));
  /** Draw a blow back: it lands in dur ms, if you are still there. */
  function beginWindup(m, kind, dur) {
    if (m.pressing) { dur = Math.max(350, Math.round(dur * 0.6)); m.pressing = false; }
    // a cunning fighter never draws back the same way twice: the beat cannot be learned, only the blow watched
    if (K.mstat(m).cunning) dur = Math.max(300, Math.round(dur * (0.7 + rnd() * 0.6)));
    // where you stood when it drew back: a lunge follows you from there
    const p = K.P();
    m.windup = { kind, at: K.G.t, until: K.G.t + dur, px: p.x, py: p.y };
    m.nextAct = m.windup.until;
    Sound.play('windup', K.heard(m, { kind }));
  }
  const WAKE_BEAT = 600;   // ms between a monster noticing you and doing anything about it

  // ---------- signature moves ----------
  // Most monsters have one trick of their own. Each is drawn back longer than
  // a plain blow, marked in violet and announced, and each has an answer:
  // step out of the ogre's smash, out of the orc's line, strike the chanting
  // acolyte, crush the skeleton's bones, burn the troll.
  const SPECIAL_MS = { crush: 900, charge: 700, web: 650, mend: 1800, nova: 1300, grab: 750, paralyse: 750, rite: 2400, drum: 1600, gaze: 1100, dazzle: 1100, thrust: 900, snatch: 700, hex: 1600, rust: 800, rally: 1500, drink: 800, blink: 900, bristle: 1400, parry: 1400, breath: 1000, firepot: 1100, firearrow: 1000, chill: 1000, storm: 1200, snare: 900, flare: 1300, stamp: 1400, enlarge: 1300, aim: 1200, sweep: 1100 };
  // how long a grey dwarf stays grown, and how much harder its blows fall while it is
  const ENLARGE_MS = 8000, ENLARGE_HIT = 1.5;
  const GAZE_MS = 1500;     // how long a basilisk's gaze leaves you stone
  const DAZZLE_MS = 4000;
  const MONSTER_PIT_MS = 1500;
  // a cutpurse takes a quarter of the purse, ten at least and no more than so many a floor deep,
  // and is gone for good once it is this many steps off with it
  // how far off a lookout will run for help, in steps, and how far its whistle wakes
  const FETCH_REACH = 16, FETCH_WAKE = 6;
  // how long a goblin hexer's hex lies on the hero (half, on a Wisdom save), and how long before it
  // chants another
  const HEX_MS = 6000, HEX_AGAIN = 9000;
  const SNATCH_LEAST = 10, SNATCH_SHARE = 0.25, SNATCH_MOST = 25, SNATCH_GONE = 14;   // how long a creature that walks into a pit is caught in it   // how long a glimmer moth's wings leave your blows going wide
  // what a rustmaw's bite can find to eat: metal armour, any shield, a blade or a mace
  const RUSTS = { armor: ['studded', 'scale', 'chain', 'splint', 'plate', 'dwarfplate'], weapon: id => !['staff', 'club', 'sling', 'shortbow', 'longbow'].includes(id) };
  const RITE_MEND = 0.2;    // the share of its life the lich takes back if its rite is let finish
  const RISE_MS = 4500;     // a skeleton's bones lie still this long before it rises
  const HELD_MS = 1300;     // a ghoul's touch freezes you this long
  const CHILL_HOLD = 1500;  // and a wraith's grave-cold, this long
  const NOVA_REACH = 2;     // the lich's cold fire reaches this far
  /** The cold fire spreads over open floor: two steps' walk, so a wall or a corner is cover. */
  function novaReaches(m) {
    ensureDist();
    const w = K.distField[m.y * K.lvl().w + m.x];
    return w >= 0 && w <= NOVA_REACH;
  }
  /** Crushing and magic keep a skeleton down; an edge only takes it apart. */
  function breaksBones(tag) {
    // (falling rock crushes as surely as a hammer)
    if (tag === 'fire' || tag === 'burn' || tag === 'burning' || tag === 'blaze' || tag === 'shock' || tag === 'rockfall') return true;
    if (tag === 'thorns' || tag === 'companion') return false;
    const w = tag === 'offhand' ? K.offhandWeapon() : K.weapon();
    return !!(w && w.blunt);
  }
  /** The most badly hurt monster near the acolyte, itself included. */
  function mendTarget(m) {
    let best = null, frac = 0.5;
    for (const o of K.lvl().monsters) {
      if (o.collapsed || Math.abs(o.x - m.x) + Math.abs(o.y - m.y) > 5 || K.mstat(o).boss) continue;
      const f = o.hp / o.maxHp;
      if (f < frac) { frac = f; best = o; }
    }
    return best;
  }
  /** Try to begin this monster's trick; true if it did. */
  function startMove(m, mb, adjacent) {
    const p = K.P();
    // in the dark, a wounded lich turns to the Heart and drinks; strike it to break the rite
    const rite = mb.boss && m.id === 'lich' && (m.phase || 0) >= 2 && m.hp < m.maxHp && K.G.t >= (m.riteReady || 0);
    // an acolyte at a hero wading in water calls lightning into it, in place of its chant
    const storm = !rite && mb.storm && mb.ranged && K.wet(p.x, p.y) && K.G.t >= (m.moveReady || 0) && hasLineToPlayer(m, mb.ranged.range) && rnd() < 0.4;
    // a Feral champion lowers its head and charges as an orc does, whatever its kind
    // (one that shoots keeps its distance, and a charger has its own charge already)
    const feral = !rite && !storm && m.elite === 'Feral' && mb.move !== 'charge' && !mb.ranged;
    let mv = rite ? 'rite' : storm ? 'storm' : mb.move;
    if ((!mv && !feral) || (!rite && K.G.t < (m.moveReady || 0)) || K.packSize(m) > 1) return false;
    let say = '', extra = {};
    if (rite) say = `The ${mb.name} lifts its hands towards the Heart and begins to drink its light! Strike it to break the rite!`;
    // and the light it draws calls a guard to stand between you, once a rite
    if (rite && !L0guard(m)) raiseGuards(m, riteGuard(), true);
    if (mv === 'crush' && adjacent && (m.blows || 0) >= 2) say = `The ${mb.name} heaves its club high over its head!`;
    else if (mv === 'charge' && hasLineToPlayer(m, m.id === 'minotaur' || mb.named ? 4 : 3) && rnd() < 0.6) {
      say = `The ${mb.name} lowers its head and charges!`;
      extra = { dx: Math.sign(p.x - m.x), dy: Math.sign(p.y - m.y) };
    }
    // the Web-Mother spits from beside you as readily as down a corridor
    else if (mv === 'web' && (adjacent ? !!mb.named : hasLineToPlayer(m, 3)) && !(p.webbed > K.G.t)) say = mb.spell ? `The ${mb.name} weaves ${(mb.named && mb.named.pron) || 'its'} hands, and a web of shadow spins out toward you!` : `The ${mb.name} rears back to spit a web!`;
    else if (mv === 'mend') {
      const t = mendTarget(m);
      if (t) { say = t === m ? `The ${mb.name} begins a dark chant over ${(mb.named && mb.named.pron) || 'its'} own wounds!` : `The ${mb.name} begins a dark chant over the wounded ${K.mstat(t).name}!`; extra = { target: t.uid }; }
    }
    else if (mv === 'grab' && adjacent && (m.blows || 0) >= 1 && !p.grabbed) say = `The ${mb.name} lurches forward to seize you!`;
    else if (mv === 'paralyse' && adjacent && (m.blows || 0) >= (mb.named && mb.named.often ? 1 : 2)) say = `The ${mb.name} reaches out with a numbing claw!`;
    // the storm comes every third blow at first, and later whenever you close on it
    else if (mv === 'nova' && novaReaches(m) && ((m.blows || 0) >= 2 || ((m.phase || 0) >= 1 && rnd() < 0.35))) say = `The ${mb.name} gathers a storm of cold fire around itself. Get away!`;
    else if (mv === 'gaze' && (adjacent || hasLineToPlayer(m, 4)) && ((m.blows || 0) >= 1 || !adjacent) && rnd() < 0.5) say = `The ${mb.name} rears its head, and its eyes begin to blaze! Look away!`;
    // a glimmer moth's wings flare from a few squares off, or close by after a bite
    else if (mv === 'dazzle' && (adjacent || hasLineToPlayer(m, 3)) && ((m.blows || 0) >= 1 || !adjacent) && rnd() < 0.5) say = `The ${mb.name} spreads its wings, and they begin to shine! Look away!`;
    else if (mv === 'rust' && adjacent && (m.blows || 0) >= 2) say = `The ${mb.name} rears back, mandibles spread wide!`;
    // a blink hound steps out of the world and back in at your back
    // (only to a hero it could reach in a few steps: it does not pass through walls)
    else if (mv === 'blink' && K.distField && K.distField[m.y * K.lvl().w + m.x] > 0 && K.distField[m.y * K.lvl().w + m.x] <= 4 && ((m.blows || 0) >= 1 || !adjacent) && rnd() < 0.5) {
      const spot = hindSpot(m);
      if (spot) {
        moveMonster(m, spot.x, spot.y);
        m.fromX = spot.x; m.fromY = spot.y; m.moveT1 = 0;   // gone and back, not a walk
        say = spot.side ? `The ${mb.name} flickers out of the air, and steps back into it at your side! Turn and face it!`
          : `The ${mb.name} flickers out of the air, and steps back into it at your back! Turn and face it!`;
        extra = { behind: spot.side ? 0 : 1 };
      }
    }
    else if (mv === 'bristle' && adjacent && (m.blows || 0) >= 1 && rnd() < 0.6) say = `The ${mb.name}'s quills rattle up on end! Hold your blow!`;
    // a dark elf warrior crosses its blades in a guard that answers a blow with a cut
    else if (mv === 'parry' && adjacent && (m.blows || 0) >= 1 && rnd() < 0.5) say = `The ${mb.name} crosses its blades in a guard! Hold your blow!`;
    // a lizardfolk warrior beside the hero, after a blow, coils its tail to sweep their legs
    else if (mv === 'sweep' && adjacent && (m.blows || 0) >= 1 && rnd() < 0.55) {
      const pr = mb.named && mb.named.pron;
      say = `The ${mb.name} coils ${pr || 'its'} tail to sweep your legs! Step back!`;
    }
    // a grey dwarf mutters a working that swells it to twice its height, after a blow or from a little way off
    else if (mv === 'enlarge' && !(m.bigUntil > K.G.t) && (adjacent ? (m.blows || 0) >= 1 : hasLineToPlayer(m, 3)) && rnd() < 0.5) {
      const pr = mb.named && mb.named.pron, obj = pr === 'his' ? 'him' : pr === 'her' ? 'her' : 'it';
      say = `The ${mb.name} mutters a working, and begins to swell! Strike ${obj} before ${pr === 'his' ? 'he grows' : pr === 'her' ? 'she grows' : 'it grows'}!`;
    }
    // a grey dwarf arbalest sets its crossbow to its shoulder and takes careful aim down its line
    else if (mv === 'aim' && !adjacent && mb.ranged && hasLineToPlayer(m, mb.ranged.range) && rnd() < 0.4) {
      say = `The ${mb.name} sets its crossbow to its shoulder and takes careful aim! Step out of its line!`;
      extra = { dx: Math.sign(p.x - m.x), dy: Math.sign(p.y - m.y) };
    }
    // a wyrm breathes down a passage at one who keeps their distance; under its jaws it only bites
    else if (mv === 'breath' && !adjacent && hasLineToPlayer(m, 4) && rnd() < 0.6) {
      const its = (mb.named && mb.named.pron) || 'its';
      say = `The ${mb.name} rears back, and fire kindles in ${its} throat! Get in under ${its} jaws, or out of ${its} line!`;
      extra = { dx: Math.sign(p.x - m.x), dy: Math.sign(p.y - m.y) };
    }
    // a goblin hexer chants at a hero it can see down its line a few squares off, or beside it after a
    // blow, while none of its hexes is on them
    else if (mv === 'hex' && !(p.hexed && p.hexed.until > K.G.t) && (adjacent ? (m.blows || 0) >= 1 : hasLineToPlayer(m, 4)) && rnd() < 0.5)
      say = `The ${mb.name} shakes its bundle of bones at you and begins to chant a hex! Strike it, or get out of its sight!`;
    // a cutpurse's hand darts for the purse of a hero beside it, who has one worth the taking
    else if (mv === 'snatch' && adjacent && K.P().gold >= SNATCH_LEAST && !m.loot && rnd() < 0.5) say = `The ${mb.name}'s hand darts for your purse! Step back!`;
    // a goblin pikeman levels its pike at a hero two or three squares off down its line
    else if (mv === 'thrust' && !adjacent && hasLineToPlayer(m, 3) && rnd() < 0.6) {
      say = `The ${mb.name} levels its pike at you! Get in under the point, or out of its line!`;
      extra = { dx: Math.sign(p.x - m.x), dy: Math.sign(p.y - m.y) };
    }
    // a goblin on its own, from the third floor down, lights a pot of lamp oil
    // and throws it at where the hero stands, a few squares off down a line
    else if (mv === 'firepot' && K.G.depth >= 3 && hasLineToPlayer(m, 4) && rnd() < 0.5) {
      say = `The ${mb.name} lights a clay pot of oil and draws back to throw it! Step aside!`;
      extra = { tx: p.x, ty: p.y, dx: Math.sign(p.x - m.x), dy: Math.sign(p.y - m.y) };
    }
    // an archer with a hero standing on something that will burn looses a lit arrow at their feet
    else if (mv === 'firearrow' && mb.ranged && hasLineToPlayer(m, mb.ranged.range) && K.fuelAt(p.x, p.y) && rnd() < 0.5) {
      say = `The ${mb.name} touches a burning arrow to its bow, aimed at your feet! Step aside!`;
      extra = { tx: p.x, ty: p.y };
    }
    // a wraith breathes a grave-cold across the stones at the feet of a hero a few squares off
    else if (mv === 'chill' && hasLineToPlayer(m, 3) && rnd() < 0.5) {
      say = `The ${mb.name} breathes out a grave-cold that creeps across the stones toward you! Step aside!`;
      extra = { tx: p.x, ty: p.y };
    }
    else if (mv === 'storm') {
      // (on a flooded floor there is no getting out of the water: a step aside takes the worst of it off)
      say = `The ${mb.name} raises a hand, and the air crackles over the water round you! ${K.lvl().twist === 'flooded' ? 'Step aside!' : 'Get out of the water!'}`;
      extra = { tx: p.x, ty: p.y };
    }
    // a kobold sets a snare on the square before the hero, toward itself, where they would step to reach it
    // (three of its own lying set at most)
    else if (mv === 'snare' && !adjacent && hasLineToPlayer(m, 4) && K.snaresBy(m.uid) < 3 && rnd() < 0.45) {
      const tx = p.x + Math.sign(m.x - p.x), ty = p.y + Math.sign(m.y - p.y);
      if (K.snareable(tx, ty)) { say = `The ${mb.name} crouches and sets something that glints on the stones between you!`; extra = { tx, ty }; }
    }
    else if (mv === 'rally' || mv === 'drink') say = namedTrick(m, mb, mv, adjacent);
    // an emberling close to the hero blazes up, after a blow or two
    else if (mv === 'flare' && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) <= 2 && (m.blows || 0) >= 1) say = `The ${mb.name}'s cracks blaze white-hot! Get clear of it, or quench it with cold!`;
    // the Heartforged stamps when the hero stands on one of its lines, after a blow (at once, once it glows white)
    else if (mv === 'stamp' && onLines(m, stampReach(m)) && ((m.blows || 0) >= 1 || (m.phase || 0) >= 2)) say = `The ${mb.name} raises its hammer high, and fire runs down its arm! Step off its lines!`;
    // the Warlord's drum: every third blow, or at once in his frenzy, while his warband is thin
    else if (mv === 'drum' && ((m.blows || 0) >= 2 || (m.phase || 0) >= 2) && warbandThin(m)) say = `The ${mb.name} raises his drumstick over the war-drum! Strike him before the beat!`;
    if (!say && feral && hasLineToPlayer(m, 3) && rnd() < 0.4) {
      mv = 'charge';
      say = `The ${mb.name} lowers its head and charges!`;
      extra = { dx: Math.sign(p.x - m.x), dy: Math.sign(p.y - m.y) };
    }
    if (!say) return false;
    if (m.opener) K.lairs.led(m);
    m.blows = 0;
    m.windup = { kind: 'move', move: mv, at: K.G.t, until: K.G.t + SPECIAL_MS[mv], ...extra };
    m.nextAct = m.windup.until;
    K.log(say, 'bad');
    K.meet(m, 'trick');
    Sound.play(mv === 'rite' ? 'rite' : 'special', K.heard(m, { ms: SPECIAL_MS[mv] }));
    return true;
  }
  /** The trick comes off, or fails against a player who answered it. */
  function resolveMove(m, mb, w) {
    const p = K.P(), L = K.lvl();
    const dist = Math.abs(m.x - p.x) + Math.abs(m.y - p.y);
    m.windup = null;
    // tricks land on you whatever else is swinging, but not in the same frame
    if (K.G.t < (K.G.blowGate || 0)) { m.windup = w; m.nextAct = K.G.blowGate; return; }
    switch (w.move) {
      case 'crush':
        if (dist === 1) { monsterAttack(m, { hit: 2, mult: 3, verb: 'brings its club down on', sure: true }); K.G.blowGate = K.G.t + K.BLOW_GAP; m.nextAct = K.G.t + mb.speed; }
        else { K.log(`The ${mb.name}'s club smashes the floor where you stood. It staggers, wide open!`, 'good'); Sound.play('smash', K.heard(m)); m.nextAct = K.G.t + 1600; K.learn(m.id, 'answer'); K.riposte(); K.opening(m); }
        break;
      case 'charge': {
        const inLine = w.dx ? p.y === m.y && Math.sign(p.x - m.x) === w.dx : p.x === m.x && Math.sign(p.y - m.y) === w.dy;
        // a living thing charging pulls up short of fire in its line
        const flames = (x, y) => fearsFire(mb) && fiery(x, y);
        let short = null;
        if (inLine) for (let i = 1, x = m.x, y = m.y; i <= 6; i++) {
          x += w.dx || 0; y += w.dy || 0;
          if (x === p.x && y === p.y) break;
          // (something standing in the way stops the line before the fire does)
          if (!K.passable(x, y) || K.monsterAt(x, y) || K.npcAt(x, y) || K.companionAt(x, y)) break;
          if (flames(x, y)) { short = { x: x - (w.dx || 0), y: y - (w.dy || 0) }; break; }
        }
        // a door shut across its line stops it cold: it hits the door, not you
        let door = inLine ? doorInCharge(m, w) : null, x = m.x, y = m.y;
        if (door) {
          // it thunders up to the door, but not through anything standing in
          // the way: stopped short of the door, it never hits it at all
          while (Math.abs(door.x - x) + Math.abs(door.y - y) > 1) {
            const nx = x + (w.dx || 0), ny = y + (w.dy || 0);
            if (K.monsterAt(nx, ny) || K.npcAt(nx, ny) || K.companionAt(nx, ny)) break;
            x = nx; y = ny;
          }
          if (Math.abs(door.x - x) + Math.abs(door.y - y) > 1) door = null;
        }
        if (short && !(door && Math.abs(door.x - m.x) + Math.abs(door.y - m.y) < Math.abs(short.x - m.x) + Math.abs(short.y - m.y))) {
          if (short.x !== m.x || short.y !== m.y) moveMonster(m, short.x, short.y);
          K.log(`The ${mb.name} pulls up short of the flames, and is left open!`, 'good');
          if (mb.move === 'charge') K.learn(m.id, 'answer');
          K.opening(m);
          m.nextAct = K.G.t + 1600;
        } else if (door) {
          if (x !== m.x || y !== m.y) moveMonster(m, x, y);
          K.log(`The ${mb.name} slams into the shut door and reels back, wide open!`, 'good');
          Sound.play('smash', K.heard(m));
          if (mb.move === 'charge') K.learn(m.id, 'answer');
          K.opening(m);
          m.nextAct = K.G.t + 1800;
        } else if (inLine && (dist === 1 || hasLineToPlayer(m, 6))) {
          const tx = p.x - (w.dx || 0), ty = p.y - (w.dy || 0);
          if (tx !== m.x || ty !== m.y) moveMonster(m, tx, ty);
          const struck = monsterAttack(m, { hit: 2, extra: m.id === 'minotaur' ? [2, 6, 0] : [1, 6, 0], verb: 'slams into', sure: true });
          // and it leaves you sprawled, a moment from getting up
          if (struck && K.G.status === 'playing' && !K.hasTalent('stand_firm')) {
            const c = K.trickSave('str', 'charge');
            if (c.pass) K.log(`You stagger, but keep your feet!${c.note}`, 'good');
            else { p.held = Math.max(p.held || 0, K.G.t + K.KNOCKDOWN_MS); p.heldBy = 'down'; K.log(`You are knocked off your feet!${c.note}`, 'bad'); }
          }
          K.G.blowGate = K.G.t + K.BLOW_GAP;
          m.nextAct = K.G.t + mb.speed;
        } else {
          // it thunders on down its line as far as it can, and stumbles
          let x = m.x, y = m.y;
          for (let i = 0; i < 3; i++) {
            const nx = x + (w.dx || 0), ny = y + (w.dy || 0);
            if (!K.passable(nx, ny) || K.monsterAt(nx, ny) || K.npcAt(nx, ny) || K.companionAt(nx, ny) || (nx === p.x && ny === p.y) || flames(nx, ny)) break;
            x = nx; y = ny;
          }
          if (x !== m.x || y !== m.y) moveMonster(m, x, y);
          K.log(`The ${mb.name} thunders past you and stumbles, wide open!`, 'good');
          if (mb.move === 'charge') K.learn(m.id, 'answer');
          K.opening(m);
          Sound.play('bump', K.heard(m));
          m.nextAct = K.G.t + 1600;
        }
        m.moveReady = K.G.t + 8000;
        break;
      }
      case 'grab':
        if (dist === 1) {
          seize(m, mb);
          K.G.blowGate = K.G.t + K.BLOW_GAP;
        } else { K.log(`The ${mb.name} grabs at the air where you stood, wide open.`, 'good'); K.learn(m.id, 'answer'); K.opening(m); }
        m.nextAct = K.G.t + mb.speed;
        break;
      case 'paralyse':
        if (dist === 1) {
          if (monsterAttack(m, { verb: 'claws', sure: true }) && K.G.status === 'playing') {
            const c = K.trickSave('con', 'claw');
            if (c.pass) K.log(`The ${mb.name}'s claw numbs you, but you shake it off.${c.note}`, 'good');
            else { p.held = K.G.t + HELD_MS; p.heldBy = 'frozen'; K.log(`The ${mb.name}'s touch freezes you in place!${c.note}`, 'bad'); }
          }
          K.G.blowGate = K.G.t + K.BLOW_GAP;
        } else { K.log(`The ${mb.name}'s claw closes on the air where you stood, and leaves it wide open.`, 'good'); K.learn(m.id, 'answer'); K.opening(m); }
        m.nextAct = K.G.t + mb.speed;
        break;
      case 'web':
        if ((dist === 1 || hasLineToPlayer(m, 4)) && (K.hasTalent('evasion') || K.hasPower('webwalk'))) K.log(K.hasTalent('evasion') ? 'The web slides off you.' : 'The web parts around you like a curtain.', 'good');
        else if (dist === 1 || hasLineToPlayer(m, 4)) {
          const c = K.trickSave('dex', 'web');
          p.webbed = K.G.t + (c.pass ? 1600 : 3200);
          K.log(c.pass ? `The web catches one leg, not both: tear free!${c.note}` : `Sticky web binds your legs! Keep pushing to tear free.${c.note}`, 'bad');
          Sound.play('web', K.heard(m));
        } else { K.log(`The ${mb.name}'s web sails past you. It is open while it spins another.`, 'good'); K.learn(m.id, 'answer'); K.opening(m); }
        m.moveReady = K.G.t + 7000;
        m.nextAct = K.G.t + Math.round(mb.speed * 0.6);
        break;
      case 'sweep': {
        const pr = mb.named && mb.named.pron, its = pr || 'its', it = pr === 'her' ? 'her' : 'it';
        if (dist === 1) {
          const struck = monsterAttack(m, { hit: 2, mult: 1.5, verb: `sweeps ${its} tail into`, sure: true });
          // and it takes the hero's legs from under them
          if (struck && K.G.status === 'playing' && !K.hasTalent('stand_firm')) {
            const c = K.trickSave('dex', 'sweep');
            if (c.pass) K.log(`You stumble, but keep your feet!${c.note}`, 'good');
            else { p.held = Math.max(p.held || 0, K.G.t + K.KNOCKDOWN_MS); p.heldBy = 'down'; K.log(`The tail takes your legs from under you: you go down${K.wet(p.x, p.y) ? ' in the water' : ''}!${c.note}`, 'bad'); }
          }
          K.G.blowGate = K.G.t + K.BLOW_GAP;
          m.nextAct = K.G.t + mb.speed;
        } else { K.log(`The ${mb.name}'s tail lashes the empty air where you stood, and leaves ${it} wide open!`, 'good'); m.nextAct = K.G.t + 1500; K.learn(m.id, 'answer'); K.riposte(); K.opening(m); }
        m.moveReady = K.G.t + 5000;
        break;
      }
      case 'enlarge': {
        const pr = mb.named && mb.named.pron, its = pr || 'its', obj = pr === 'his' ? 'him' : pr === 'her' ? 'her' : 'it';
        m.bigUntil = K.G.t + ENLARGE_MS;
        K.log(`The ${mb.name} has grown to twice ${its} height, and ${its} blows will fall the harder! Give ${obj} room until ${pr === 'his' ? 'he shrinks' : pr === 'her' ? 'she shrinks' : 'it shrinks'}.`, 'bad');
        K.floatText(m, 'grown', '#e8a060');
        Sound.play('special', K.heard(m, { ms: 300 }));
        m.moveReady = K.G.t + ENLARGE_MS + 6000;
        m.nextAct = K.G.t + Math.round(mb.speed * 0.5);
        break;
      }
      case 'aim': {
        // the bolt flies down the line it was aimed along: one who has stepped out of it is missed
        const inLine = w.dx ? p.y === m.y && Math.sign(p.x - m.x) === w.dx : p.x === m.x && Math.sign(p.y - m.y) === w.dy;
        Sound.play('arrow', K.heard(m));
        if (inLine && hasLineToPlayer(m, mb.ranged.range)) {
          const n = K.knightSteadfast(Math.max(1, Math.ceil(d(...mb.ranged.dmg) * 2 / (K.hasTalent('stand_firm') ? 2 : 1))));
          K.hurtPlayer(n, `The ${mb.name}'s bolt takes you square for ${n}!`, m, 'a grey dwarf\'s bolt');
          K.G.blowGate = K.G.t + K.BLOW_GAP;
          m.nextAct = K.G.t + mb.speed;
        } else { K.log(`The ${mb.name}'s bolt cracks off the stone where you stood. It is open while it winds again.`, 'good'); K.learn(m.id, 'answer'); K.opening(m); m.nextAct = K.G.t + 1400; }
        m.moveReady = K.G.t + 7000;
        break;
      }
      case 'mend': {
        const t = L.monsters.find(o => o.uid === w.target);
        if (t && !t.collapsed && t.hp < t.maxHp) {
          const n = Math.min(t.maxHp - t.hp, d(2, 6) + 2 + K.G.depth);
          t.hp += n;
          K.log(`Dark power knits the ${t === m ? mb.name : K.mstat(t).name}'s wounds (+${n}).`, 'bad');
          K.floatText(t, '+' + n, '#c080ff');
        }
        m.moveReady = K.G.t + 8000;
        m.nextAct = K.G.t + Math.round(mb.speed * 0.6);
        break;
      }
      case 'rite': {
        const n = Math.min(m.maxHp - m.hp, Math.ceil(m.maxHp * RITE_MEND));
        m.hp += n;
        K.log(`The Heart's light pours into the ${mb.name}. Its wounds close (+${n}).`, 'bad');
        K.floatText(m, '+' + n, '#c080ff');
        K.spray(m, 'ecto', 0.6, false);
        Sound.play('riteDone', K.heard(m));
        m.riteReady = K.G.t + 9000;
        m.nextAct = K.G.t + Math.round(mb.speed * 0.6);
        break;
      }
      case 'gaze': {
        // only a hero looking at it is caught: turning away is the answer
        // stepping up to it does not help: close by, it is looking straight at you
        if ((dist === 1 || hasLineToPlayer(m, 5)) && facing(m)) {
          const c = K.trickSave('con', 'gaze');
          const n = K.knightSteadfast(c.pass ? Math.ceil(d(1, 6) / 2) : d(1, 6));   // a warned trick, as any other
          p.held = Math.max(p.held || 0, K.G.t + GAZE_MS * (K.hasTalent('stand_firm') ? 0.5 : 1) * (c.pass ? 0.5 : 1)); p.heldBy = 'stone';
          K.hurtPlayer(n, `The ${mb.name}'s gaze meets yours, and your limbs ${c.pass ? 'stiffen, but fight the stone' : 'turn to stone'}! (${n})${c.note}`, m, 'a basilisk\'s gaze');
          K.G.blowGate = K.G.t + K.BLOW_GAP;
        } else { K.log(`You turn from the ${mb.name}'s gaze. It washes over your back and leaves the beast open.`, 'good'); K.learn(m.id, 'answer'); K.opening(m); }
        m.moveReady = K.G.t + 8000;
        m.nextAct = K.G.t + mb.speed;
        break;
      }
      case 'dazzle': {
        // as a basilisk's gaze, but only light: a hero looking at it is dazzled, one turned away is not
        if ((dist === 1 || hasLineToPlayer(m, 4)) && facing(m)) {
          const c = K.trickSave('con', 'dazzle');
          p.dazzled = Math.max(p.dazzled || 0, K.G.t + DAZZLE_MS * (K.hasTalent('stand_firm') ? 0.5 : 1) * (c.pass ? 0.5 : 1));
          K.log(`The ${mb.name}'s wings flare white in your eyes, and you ${c.pass ? 'blink most of it away' : 'are dazzled'}: your blows will go wide a while.${c.note}`, 'bad');
        } else { K.log(`You turn from the ${mb.name}'s wings. The light washes over your back, and the moth is left open.`, 'good'); K.learn(m.id, 'answer'); K.opening(m); }
        m.moveReady = K.G.t + 7000;
        m.nextAct = K.G.t + mb.speed;
        break;
      }
      case 'hex': {
        // a hex must see where it is going: beside it, or down its line still, it lands; out of its
        // sight, it falls on the stones. On one who has cast a spell it binds the tongue; on anyone
        // else it drags at the limbs
        if (dist === 1 || hasLineToPlayer(m, 5)) {
          const kind = p.maxSp > 0 && K.G.lastSpell ? 'silence' : 'slow';
          const c = K.trickSave('wis', 'hex');
          p.hexed = { kind, until: K.G.t + HEX_MS * (c.pass ? 0.5 : 1) };
          K.log(kind === 'silence' ? `The hex lands, and your tongue goes thick and dumb: no spells until it lifts.${c.note}`
            : `The hex lands, and your limbs go heavy: your steps and blows come slow until it lifts.${c.note}`, 'bad');
        } else { K.log(`The ${mb.name}'s hex falls on the stones where you stood.`, 'good'); K.learn(m.id, 'answer'); }
        m.moveReady = K.G.t + HEX_AGAIN;
        m.nextAct = K.G.t + mb.speed;
        break;
      }
      case 'snatch': {
        // beside the hero still, it has the purse: a share of the gold, and it runs
        if (dist === 1) {
          const take = Math.min(p.gold, Math.max(SNATCH_LEAST, Math.round(p.gold * SNATCH_SHARE)), SNATCH_MOST * K.G.depth);
          p.gold -= take; m.loot = (m.loot || 0) + take;
          m.fleeing = true; m.awake = true;
          K.log(`The ${mb.name} snatches ${take} gold from your purse, and runs for it! Bring it down before it gets away.`, 'bad');
          Sound.play('pickup', K.heard(m));
          m.nextAct = K.G.t + 300;
        } else { K.log(`The ${mb.name}'s hand closes on air, and it is left open.`, 'good'); K.learn(m.id, 'answer'); K.opening(m); m.nextAct = K.G.t + 1400; }
        m.moveReady = K.G.t + 6000;
        break;
      }
      case 'thrust': {
        // the pike reaches two and three squares down its line, and passes by one in under the point
        const inLine = w.dx ? p.y === m.y && Math.sign(p.x - m.x) === w.dx : p.x === m.x && Math.sign(p.y - m.y) === w.dy;
        if (inLine && dist >= 2 && dist <= 3 && hasLineToPlayer(m, 3)) {
          monsterAttack(m, { hit: 2, extra: [1, 6, 0], verb: 'drives its pike into', sure: true });
          K.G.blowGate = K.G.t + K.BLOW_GAP;
          m.nextAct = K.G.t + mb.speed;
        } else if (dist === 1) { K.log(`You are in under the point: the ${mb.name}'s pike drives past you, and it is left open!`, 'good'); K.learn(m.id, 'answer'); K.opening(m); m.nextAct = K.G.t + 1400; }
        else { K.log(`The ${mb.name}'s pike drives into empty air, and leaves it open.`, 'good'); K.learn(m.id, 'answer'); K.opening(m); m.nextAct = K.G.t + 1400; }
        m.moveReady = K.G.t + 6000;
        break;
      }
      case 'rust':
        if (dist === 1) {
          if (monsterAttack(m, { hit: 1, verb: 'bites', sure: true }) && K.G.status === 'playing') corrode();
          K.G.blowGate = K.G.t + K.BLOW_GAP;
          m.nextAct = K.G.t + mb.speed;
        } else { K.log(`The ${mb.name}'s jaws snap shut on the air where you stood. It is left open.`, 'good'); K.learn(m.id, 'answer'); K.opening(m); m.nextAct = K.G.t + 1400; }
        break;
      case 'rally':
      case 'drink':
        namedResolve(m, mb, w.move, dist);
        break;
      case 'drum':
        warband(m, mb);
        m.moveReady = K.G.t + 9000;
        m.nextAct = K.G.t + mb.speed;
        break;
      case 'blink':
        // faced, it steps out of the air onto a raised blade; at your back, it bites deep
        if (dist === 1 && facing(m)) { K.log(`You turn to meet the ${mb.name} as it steps out of the air. It is caught off balance!`, 'good'); K.learn(m.id, 'answer'); K.opening(m); m.nextAct = K.G.t + 1400; }
        else if (dist === 1) {
          monsterAttack(m, { hit: 3, extra: mb.bite || [1, 6, 0], verb: 'sinks its teeth into', sure: true });
          K.G.blowGate = K.G.t + K.BLOW_GAP;
          m.nextAct = K.G.t + mb.speed;
        } else { K.log(`The ${mb.name} snaps at the air where you stood.`, 'good'); m.nextAct = K.G.t + mb.speed; }
        m.moveReady = K.G.t + 7000;
        break;
      case 'bristle':
        // the quills lie down again; one who held their blow finds it open
        if (w.struck) K.log(`The ${mb.name}'s quills settle, red with your blood.`);
        else { K.log(`The ${mb.name}'s quills sink flat, and it is left open!`, 'good'); K.learn(m.id, 'answer'); K.opening(m); }
        m.moveReady = K.G.t + 6000;
        m.nextAct = K.G.t + (w.struck ? Math.round(mb.speed * 0.6) : 1400);
        break;
      case 'parry':
        // the guard comes down; one who held their blow finds it open
        if (w.struck) K.log(`The ${mb.name} lowers its blades, your blood on one of them.`);
        else { K.log(`The ${mb.name} lowers its blades, and is left open!`, 'good'); K.learn(m.id, 'answer'); K.opening(m); }
        m.moveReady = K.G.t + 6000;
        m.nextAct = K.G.t + (w.struck ? Math.round(mb.speed * 0.6) : 1400);
        break;
      case 'breath': {
        Sound.play('nova', K.heard(m));
        // the fire runs down its line from two squares out, and passes over one under its jaws
        const inLine = w.dx ? p.y === m.y && Math.sign(p.x - m.x) === w.dx : p.x === m.x && Math.sign(p.y - m.y) === w.dy;
        if (inLine && dist >= 2 && dist <= 5 && hasLineToPlayer(m, 5, true)) {
          const c = K.trickSave('dex', 'breath');
          // wyrm's scale turns wyrm's fire
          const warded = K.hasPower('fireward');
          const n = K.knightSteadfast(Math.max(1, Math.ceil((d(3, 6) + Math.floor(K.G.depth / 2)) / (K.hasTalent('stand_firm') ? 2 : 1) / (c.pass ? 2 : 1) / (warded ? 2 : 1))));
          K.hurtPlayer(n, `A gout of fire roars down the passage over you for ${n}!${c.pass ? ' You throw yourself flat under the worst of it.' : ''}${warded ? ' Your wyrm-scale takes the worst of it.' : ''}${c.note}`, m, 'a cave wyrm\'s fire');
          K.G.blowGate = K.G.t + K.BLOW_GAP;
          m.nextAct = K.G.t + mb.speed;
        } else if (dist === 1) { K.log(`You are in under the ${mb.name}'s jaws: ${(mb.named && mb.named.pron) || 'its'} fire roars out over your head, and ${mb.named && mb.named.pron ? 'she is' : 'it is'} left open!`, 'good'); K.learn(m.id, 'answer'); K.opening(m); m.nextAct = K.G.t + 1400; }
        else { K.log(`The ${mb.name}'s fire roars down an empty passage, and leaves ${mb.named && mb.named.pron ? 'her' : 'it'} spent and open.`, 'good'); K.learn(m.id, 'answer'); K.opening(m); m.nextAct = K.G.t + 1400; }
        m.moveReady = K.G.t + 7000;
        // and whatever will burn along its line catches, from two squares out as the fire runs
        K.burnLine(m.x, m.y, w.dx, w.dy, 5, 2);
        break;
      }
      case 'firepot': {
        // it bursts where the hero stood when it was lit, and on the square behind, down its line;
        // a door shut or a wall in its flight takes it, and it bursts short of that (six squares at most)
        let spots = [[w.tx, w.ty], [w.tx + w.dx, w.ty + w.dy]], short = false;
        for (let i = 1, x = m.x, y = m.y; i <= 6; i++) {
          x += w.dx; y += w.dy;
          if (!K.passable(x, y)) { spots = [[x - w.dx, y - w.dy]]; short = true; break; }
          if (x === w.tx && y === w.ty) break;
          if (i === 6) { spots = [[x, y]]; short = true; }
        }
        Sound.play('smash', K.heard({ x: spots[0][0], y: spots[0][1] }));
        const hit = spots.some(([x, y]) => p.x === x && p.y === y);
        K.firepot(spots);
        if (hit) {
          const c = K.trickSave('dex', 'firepot');
          const n = K.knightSteadfast(Math.max(1, Math.ceil((d(1, 6) + Math.floor(K.G.depth / 2)) / (c.pass ? 2 : 1) / (K.hasTalent('stand_firm') ? 2 : 1))));
          K.hurtPlayer(n, `The pot bursts over you in a sheet of flame for ${n}!${c.pass ? ' You turn from the worst of it.' : ''}${c.note}`, m, 'a goblin\'s firepot');
          K.G.blowGate = K.G.t + K.BLOW_GAP;
        } else if (short) K.log('The pot bursts in flames short of you.', 'good');
        else { K.log(`The pot bursts in flames where you stood.`, 'good'); K.learn(m.id, 'answer'); }
        m.moveReady = K.G.t + 9000;
        m.nextAct = K.G.t + mb.speed;
        break;
      }
      case 'firearrow': {
        // the arrow flies at the feet it was aimed at, if nothing stands or shuts in its way
        let clear = true;
        for (let x = m.x, y = m.y, i = 0; i < 12; i++) {
          x += Math.sign(w.tx - m.x); y += Math.sign(w.ty - m.y);
          if (x === w.tx && y === w.ty) break;
          if (!K.passable(x, y) || K.monsterAt(x, y) || K.npcAt(x, y) || K.companionAt(x, y)) { clear = false; break; }
        }
        Sound.play('arrow', K.heard(m));
        if (!clear) K.log(`The ${mb.name}'s burning arrow strikes something in its way.`);
        else if (p.x === w.tx && p.y === w.ty) { rangedAttack(m); K.G.blowGate = K.G.t + K.BLOW_GAP; }
        else { K.log(`The burning arrow thuds into the ground where you stood.`, 'good'); K.learn(m.id, 'answer'); }
        if (clear) K.igniteWild(w.tx, w.ty);
        m.moveReady = K.G.t + 8000;
        m.nextAct = K.G.t + mb.speed;
        break;
      }
      case 'snare': {
        if (K.setSnare(w.tx, w.ty, m.uid)) K.log('A wire snare lies set on the stones between you. Go round it, or stand before it and Use to spring it.', 'info');
        m.moveReady = K.G.t + 8000;
        m.nextAct = K.G.t + mb.speed;
        break;
      }
      case 'chill': {
        // the frost takes the square it was breathed at; a hero still on it is frozen fast
        // (on a burning square it puts the fire out and leaves no ice, but the hero is caught all the same)
        K.rime(w.tx, w.ty);
        Sound.play('cast', K.heard(m, { spell: 'cone_cold' }));
        if (p.x === w.tx && p.y === w.ty) {
          const warm = K.hasPower('warmth');
          const n = K.knightSteadfast(Math.max(1, Math.ceil((d(1, 6) + Math.floor(K.G.depth / 3)) / (warm ? 2 : 1) / (K.hasTalent('stand_firm') ? 2 : 1))));
          // (a hardy hero, saving by their constitution, is held half as long)
          const c = K.trickSave('con', 'chill'), hold = CHILL_HOLD / (c.pass ? 2 : 1);
          K.hurtPlayer(n, `The grave-cold closes round your feet, and you are frozen fast! (${n})${warm ? ` ${K.warmthFrom(true)} keeps out the worst of it.` : ''}${c.pass ? ' You stamp, and the ice is already cracking.' : ''}${c.note}`, m, 'a wraith\'s grave-cold');
          // (Old Hide: the bear's feet are not held by it)
          if (K.G.status === 'playing' && !((p.held || 0) > K.G.t + hold) && !(K.capped('old_hide') && K.shaped())) { p.held = K.G.t + hold; p.heldBy = 'ice'; }
          K.G.blowGate = K.G.t + K.BLOW_GAP;
        } else { K.log(`Frost glazes the stones where you stood.`, 'good'); K.learn(m.id, 'answer'); }
        m.moveReady = K.G.t + 7000;
        m.nextAct = K.G.t + mb.speed;
        break;
      }
      case 'storm': {
        // it comes down where the hero stood; the water carries half of it a square further
        const n = K.knightSteadfast(Math.max(1, Math.ceil((d(2, 6) + Math.floor(K.G.depth / 2)) / (K.hasTalent('stand_firm') ? 2 : 1))));
        const got = K.stormAt(w.tx, w.ty, n);
        Sound.play('cast', K.heard({ x: w.tx, y: w.ty }, { spell: 'lightning' }));
        if (got.comp) K.companionHurt(got.comp, 'The lightning runs through the water into');
        if (got.hero) {
          // (a quick hero, saving by their dexterity, takes half)
          const c = K.trickSave('dex', 'storm'), hit = c.pass ? Math.max(1, Math.ceil(got.hero / 2)) : got.hero;
          K.hurtPlayer(hit, `${got.hero === n ? 'Lightning comes down into the water on you!' : 'The lightning strikes the water beside you, and runs through it into you!'} (${hit})${c.pass ? ' You leap clear of the worst of it.' : ''}${c.note}`, m, 'an acolyte\'s lightning');
          K.G.blowGate = K.G.t + K.BLOW_GAP;
          // a step aside took the worst of it: on a flooded floor that is the whole of the answer
          if (got.hero < n && K.lvl().twist === 'flooded') K.learn(m.id, 'answer');
        } else if (K.wet(w.tx, w.ty)) { K.log(`Lightning comes down into the water where you stood.`, 'good'); K.learn(m.id, 'answer'); }
        else K.log('Lightning comes down, but finds no water to run through.', 'good');
        m.moveReady = K.G.t + 8000;
        m.nextAct = K.G.t + mb.speed;
        break;
      }
      case 'stamp': {
        // fire runs out from it along the floor, down all four lines, as far as its reach or the first wall
        const reach = stampReach(m);
        for (const [dx, dy] of K.DIRS) for (let i = 1; i <= reach; i++) { const x = m.x + dx * i, y = m.y + dy * i; if (!K.passable(x, y)) break; K.flame(x, y, STAMP_FIRE_MS); }
        Sound.play('smash', K.heard(m));
        K.fx.shakeAmp = 4; K.fx.shakeMs = 350; K.fx.shakeUntil = K.realNow + 350;
        if (onLines(m, reach)) {
          const c = K.trickSave('dex', 'stamp');
          const n = K.knightSteadfast(Math.max(1, Math.ceil((d(4, 6) + Math.floor(K.G.depth / 2)) / (K.hasTalent('stand_firm') ? 2 : 1) / (c.pass ? 2 : 1) / (K.hasPower('fireward') || K.hasPower('emberwalk') ? 2 : 1))));
          K.hurtPlayer(n, `The ${mb.name}'s hammer comes down, and fire runs down the floor over you for ${n}!${c.pass ? ' You leap the worst of it.' : ''}${c.note}`, m, 'the Heartforged\'s fire');
          K.G.blowGate = K.G.t + K.BLOW_GAP;
          m.nextAct = K.G.t + mb.speed;
        } else {
          // off its lines: the fire runs past, and the hammer sticks fast in the stone (longer once it glows white, burning itself out)
          K.log(`The ${mb.name}'s hammer comes down, and fire runs out along its lines, past you. The hammer sticks fast in the stone: it is open!`, 'good');
          K.learn(m.id, 'answer'); K.opening(m);
          m.nextAct = K.G.t + ((m.phase || 0) >= 2 ? 2000 : 1500);
        }
        m.moveReady = K.G.t + ((m.phase || 0) >= 2 ? 4000 : 6500);
        break;
      }
      case 'flare': {
        // the stones round it catch: its own square and the four beside it; a hero beside it is scorched
        for (const [dx, dy] of [[0, 0], ...K.DIRS]) K.flame(m.x + dx, m.y + dy);
        Sound.play('cast', K.heard(m, { spell: 'burning_hands' }));
        if (dist <= 1) {
          // (a quick hero, saving by their dexterity, takes half)
          const c = K.trickSave('dex', 'flare');
          const n = K.knightSteadfast(Math.max(1, Math.ceil((d(2, 6) + Math.floor(K.G.depth / 2)) / (K.hasTalent('stand_firm') ? 2 : 1) / (K.hasPower('emberwalk') ? 2 : 1) / (c.pass ? 2 : 1))));
          K.hurtPlayer(n, `The ${mb.name} flares, and the heat of it scorches you! (${n})${c.pass ? ' You throw up an arm against the worst of it.' : ''}${c.note}`, m, 'an emberling\'s flare');
          K.G.blowGate = K.G.t + K.BLOW_GAP;
        } else { K.log(`The ${mb.name} flares, and the stones round it catch, but you are clear of it.`, 'good'); K.learn(m.id, 'answer'); K.opening(m); }
        m.moveReady = K.G.t + 7000;
        m.nextAct = K.G.t + mb.speed;
        break;
      }
      case 'nova':
        Sound.play('nova', K.heard(m));
        if (novaReaches(m)) {
          const shielded = K.effectFrom('ac', 'shield');
          const c = K.trickSave('dex', 'nova');
          const warm = K.hasPower('warmth');
          const n = K.knightSteadfast(Math.max(1, Math.ceil(d(5, 6) / (K.hasTalent('stand_firm') ? 2 : 1) / (shielded ? 2 : 1) / (c.pass ? 2 : 1) / (warm ? 2 : 1))));
          K.hurtPlayer(n, `The storm of cold fire bursts over you for ${n}!${c.pass ? ' You turn a shoulder to the worst of it.' : ''}${shielded ? ' Your Shield takes the worst of it.' : ''}${warm ? ` ${K.warmthFrom(true)} keeps out the cold.` : ''}${c.note}`, m); K.G.blowGate = K.G.t + K.BLOW_GAP;
        }
        else { K.log('The storm of cold fire breaks short of you, and leaves the lich spent and open.', 'good'); K.learn(m.id, 'answer'); K.opening(m); }
        m.nextAct = K.G.t + mb.speed;
        break;
    }
    // a named champion's trick comes round again sooner than its kind's
    if (mb.named && mb.named.often && m.moveReady > K.G.t) m.moveReady = K.G.t + Math.round((m.moveReady - K.G.t) / mb.named.often);
  }
  /** Fire loosed while webbed burns the web away. */
  function burnWeb() {
    const p = K.P();
    if (!(p.webbed > K.G.t)) return;
    p.webbed = 0;
    K.log('The fire runs along the web and it shrivels away. You are free!', 'good');
    K.combos.note('web_burn');
  }
  /** A closed door stands between a charger and the hero, down its line. */
  function doorInCharge(m, w) {
    const p = K.P();
    for (let i = 1; i <= 7; i++) {
      const x = m.x + (w.dx || 0) * i, y = m.y + (w.dy || 0) * i;
      if (x === p.x && y === p.y) return null;
      const t = K.tile(x, y);
      if (t === K.T.DOOR || t === K.T.DOOR_LOCKED) return { x, y };
      if (!K.passable(x, y)) return null;
    }
    return null;
  }
  // A shut door is a choice now. What has hands opens it; a brute smashes it
  // to splinters in one blow, and it cannot be shut again; a beast batters at
  // it, each blow a full action, until on the fourth it gives way. A door
  // pulled shut on a pack of rats buys a few seconds, never a hiding place.
  const DOOR_BLOWS = 4;
  /** A creature meets a shut door. Returns true when the try cost it a full action. */
  function meetDoor(m, mb, x, y) {
    const how = mb.door || 'open', at = K.heard({ x, y });
    const who = at.dist <= 4 ? `The ${mb.name}` : 'Something';
    if (how === 'open') { K.setTile(x, y, K.T.DOOR_OPEN); K.log(at.dist <= 4 ? `The ${mb.name} pushes the door open.` : 'Something opens a door nearby.', 'bad'); Sound.play('door', at); return false; }
    const L = K.lvl(), k = K.key(x, y);
    if (how === 'batter') {
      L.doorBlows = L.doorBlows || {};
      const n = L.doorBlows[k] = (L.doorBlows[k] || 0) + 1;
      if (n < DOOR_BLOWS) {
        if (n === 1) K.log(`${who} batters at a shut door${who === 'Something' ? ' nearby' : ''}.`, 'bad');
        // each blow is seen on the door, and the last but one says so
        if (n === DOOR_BLOWS - 1) K.log(`The door buckles${who === 'Something' ? ' somewhere near' : ''}: one more blow will break it.`, 'bad');
        K.fx.texts.push({ x: x + 0.5, y: y + 0.5, text: n === DOOR_BLOWS - 1 ? 'CRACK' : 'thud', color: n === DOOR_BLOWS - 1 ? '#f0a060' : '#c8a070', born: K.realNow, until: K.realNow + 650 });
        Sound.play('batter', at);
        return true;
      }
      delete L.doorBlows[k];
    }
    K.setTile(x, y, K.T.FLOOR);
    K.log(how === 'smash' ? `${who} smashes a door to splinters${who === 'Something' ? ' nearby' : ''}!` : `${who} bursts through a door${who === 'Something' ? ' nearby' : ''}!`, 'bad');
    Sound.play('splinter', at);
    return how === 'smash';
  }
  /** Whether the hero is looking at a monster: it is ahead, within the view's width. */
  function facing(m) {
    const p = K.P(), [ax, ay] = K.DIRS[p.dir], [bx, by] = K.DIRS[(p.dir + 1) % 4];
    const dx = m.x - p.x, dy = m.y - p.y, ahead = dx * ax + dy * ay;
    return ahead > 0 && Math.abs(dx * bx + dy * by) <= ahead;
  }
  /** A rustmaw's bite eats a point from the first metal it finds: armour, then shield, then blade. */
  function corrode() {
    const p = K.P();
    // a book, an orb or a holy symbol is no metal for it to eat
    // (nor is a quillback's quills on their frame)
    // (and a druid in a bear's shape holds neither shield nor blade for it to reach)
    const bear = K.shaped();
    const shield = !bear && p.eq.shield && !ITEMS[p.eq.shield.t].focus && p.eq.shield.t !== 'quillshield' ? p.eq.shield : null;
    const metal = [p.eq.armor && RUSTS.armor.includes(p.eq.armor.t) ? p.eq.armor : null, shield, !bear && p.eq.weapon && RUSTS.weapon(p.eq.weapon.t) ? p.eq.weapon : null].filter(Boolean);
    if (!metal.length) { K.log('Its jaws find no metal on you to eat.'); return; }
    // what is rusted through already, it passes over for the next
    const it = metal.find(x => (x.e || 0) > -3);
    if (!it) { K.log('There is nothing left on you for the rust to take.'); return; }
    it.e = (it.e || 0) - 1;
    // the forge hones blades and reinforces armour; a shield it cannot mend
    const mend = ITEMS[it.t].kind === 'shield' ? '' : ' A trader\'s forge can mend it.';
    K.log(it.h ? `Rust blooms where it bit: ${K.the(it)} is the worse for it.` : `Rust blooms where it bit: your ${ITEMS[it.t].name} rusts (now ${it.e >= 0 ? '+' : '\u2212'}${Math.abs(it.e)}).${mend}`, 'bad');
    K.emit('inv'); K.emit('stats');
  }
  /** Where a blink hound comes back into the world: the square at the hero's back, or else at a side. */
  function hindSpot(m) {
    const p = K.P();
    for (const turn of [2, 1, 3]) {
      const [dx, dy] = K.DIRS[(p.dir + turn) % 4], x = p.x + dx, y = p.y + dy;
      if ((x === m.x && y === m.y) || (K.passable(x, y) && !K.monsterAt(x, y) && !K.npcAt(x, y) && !K.companionAt(x, y))) return { x, y, side: turn !== 2 };
    }
    return null;
  }
  // a blow struck from beside it; not a spell, an arrow loosed from further off, or fire and poison already at work
  const HAND_BLOW = new Set([null, undefined, '', 'opening', 'crit', 'riposte', 'riposte-crit', 'lucky', 'sneak', 'offhand', 'cleave', 'bash']);
  /**
   * A puffcap struck by a hand from beside it bursts in spores, standing or
   * falling: a Constitution save, or poisoned. Fire on the blade sears them
   * first (a flaming weapon, or fire oil), and a druid breathes them as the
   * moss does. A second blade in the same breath looses no second cloud.
   */
  function sporesOn(m, mb, tag) {
    const p = K.P(), G = K.G;
    if (!mb.spores || !HAND_BLOW.has(tag) || K.castingName || G.status !== 'playing') return;
    if (Math.abs(m.x - p.x) + Math.abs(m.y - p.y) !== 1 || (m.sporedAt || 0) > G.t - 600) return;
    m.sporedAt = G.t;
    const seared = !K.shaped() && (K.hasPower('flame', 'weapon') || (p.coating && p.coating.t === 'fire' && tag !== 'offhand'));
    if (seared) { K.log(`Fire on your blade sears the ${mb.name}'s spores before they can fly.`, 'good'); K.learn(m.id, 'answer'); return; }
    K.spray(m, 'spore', 1.2, false);
    Sound.play('death', K.heard(m, { gore: 'spore' }));
    K.meet(m, 'trick');
    if (p.cls === 'druid') { K.log(`The ${mb.name} bursts in a cloud of spores. You breathe them as the moss does, and take no harm.`, 'good'); return; }
    const c = K.venomSave('spores', `the ${mb.name}'s`, true);
    K.log(!c ? `The ${mb.name} bursts in a cloud of spores${p.poison ? ', but you are poisoned already' : ', and they do you no harm'}.`
      : c.pass ? `The ${mb.name} bursts in a cloud of spores. You hold your breath through it.${c.note}` : `The ${mb.name} bursts in a cloud of spores, and you breathe them: you are poisoned!${c.note}`, c && !c.pass ? 'bad' : '');
  }
  /** What a monster's trick does when it is hurt and still standing. */
  function moveOnHurt(m, mb, tag) {
    // the quills bite a hound's bite as well as a hand
    if (m.windup && m.windup.move === 'bristle' && tag === 'companion') K.companionHurt(d(1, mb.quills || 6) + Math.floor(K.G.depth / 2), 'The raised quills stab');
    // a quillback's raised quills bite back at a hand that strikes it
    if (m.windup && m.windup.move === 'bristle' && HAND_BLOW.has(tag) && !K.castingName && K.G.status === 'playing') {
      const p = K.P();
      if (Math.abs(m.x - p.x) + Math.abs(m.y - p.y) === 1) {
        m.windup.struck = true;
        const n = K.knightSteadfast(d(1, mb.quills || 6) + Math.floor(K.G.depth / 2));
        K.hurtPlayer(n, `You strike into its raised quills, and they bite deep! (${n})`, m, `a ${mb.name.toLowerCase()}'s quills`);
      }
    }
    // a dark elf's crossed blades turn a blow struck into them, and cut back
    if (m.windup && m.windup.move === 'parry' && (HAND_BLOW.has(tag) || tag === 'companion') && !K.castingName && K.G.status === 'playing') {
      if (tag === 'companion') K.companionHurt(d(1, 6) + Math.floor(K.G.depth / 2), 'The crossed blades turn the blow, and cut');
      else {
        const p = K.P();
        if (Math.abs(m.x - p.x) + Math.abs(m.y - p.y) === 1) {
          m.windup.struck = true;
          const n = K.knightSteadfast(d(1, 8) + Math.floor(K.G.depth / 2));
          K.hurtPlayer(n, `Your blow meets its crossed blades, and it answers with a cut! (${n})`, m, 'a dark elf\'s riposte');
        }
      }
    }
    // a numbing claw is struck aside by a blow that lands first, and leaves it
    // open: a blow or a spell, not poison or fire already eating at it
    if (m.windup && m.windup.move === 'paralyse' && !['burning', 'blaze', 'venom', 'thorns', 'companion', 'shock', 'rockfall'].includes(tag)) {
      m.windup = null; m.moveReady = K.G.t + 3000; m.nextAct = K.G.t + 900;
      K.log(`Your blow knocks the ${mb.name}'s claw aside before it can close!`, 'good');
      K.learn(m.id, 'answer');
      K.opening(m);
    }
    // a chant, a war-horn call and the lich's rite are the hero's to break:
    // the hound's teeth do not count, or it quietly won the lich fight for them;
    // nor does a fire some monster lit (a wyrm's breath), nor rock the roof let fall
    const byHero = tag !== 'companion' && tag !== 'blaze' && tag !== 'rockfall';
    // a grey dwarf's working is broken by any wound the hero gives it as it swells
    if (byHero && m.windup && m.windup.move === 'enlarge') {
      m.windup = null; m.moveReady = K.G.t + 5000; m.nextAct = K.G.t + 700;
      K.log(`Your blow breaks the ${mb.name}'s working, and ${mb.named && mb.named.pron === 'his' ? 'he shrinks' : 'it shrinks'} back!`, 'good');
      K.learn(m.id, 'answer');
    }
    // a chant is broken by any wound, a hexer's as an acolyte's
    if (byHero && m.windup && (m.windup.move === 'mend' || m.windup.move === 'hex')) {
      m.windup = null; m.moveReady = K.G.t + 3000; m.nextAct = K.G.t + 700;
      K.log(`You break the ${mb.name}'s chant!`, 'good');
      K.learn(m.id, 'answer');
    }
    // and so is a war-horn call, and a call cut short is spent
    if (byHero && m.windup && m.windup.move === 'rally') {
      m.windup = null; m.moveReady = K.G.t + 3000; m.nextAct = K.G.t + 700;
      K.log(`You cut the ${mb.name}'s call short! The horn falls from his lips.`, 'good');
      K.learn(m.id, 'answer');
    }
    // (but a sellsword is paid to stand in the way: once in a fight, their cut
    // breaks the drumbeat or the rite as the hero's blow would)
    const cut = tag === 'companion' && m.windup && (m.windup.move === 'drum' || m.windup.move === 'rite') && K.companionBreaks ? K.companionBreaks(m) : null;
    // and the Warlord's drum: a blow while the stick is raised and the beat dies
    if ((byHero || cut) && m.windup && m.windup.move === 'drum') {
      m.windup = null; m.moveReady = K.G.t + 4000; m.nextAct = K.G.t + 700;
      K.log(cut ? `${cut} cuts the drumstick from the ${mb.name}'s fist! The beat dies before it starts.` : `You strike the drumstick from the ${mb.name}'s fist! The beat dies before it starts.`, 'good');
      K.learn(m.id, 'answer');
    }
    // and so is the lich's rite, though it will try again
    if ((byHero || cut) && m.windup && m.windup.move === 'rite') {
      m.windup = null; m.riteReady = K.G.t + 6000; m.nextAct = K.G.t + 700;
      K.log(cut ? `${cut}'s cut catches the ${mb.name}'s hands, and the rite breaks! The Heart's light slips back out of them.` : `You break the ${mb.name}'s rite! The Heart's light slips back out of its hands.`, 'good');
      Sound.play('riteBroken', K.heard(m));
      K.learn(m.id, 'answer');
    }
    // fire sears a troll's wounds shut, so they cannot grow back for a while
    if ((tag === 'burn' || tag === 'burning' || tag === 'blaze') && mb.regen) {
      if (!(m.burnUntil > K.G.t)) { K.log(`The ${mb.name}'s burns do not close.`, 'good'); K.learn(m.id, 'answer'); }
      m.burnUntil = K.G.t + 6000;
    }
    // a slime struck hard enough splits into two smaller ones in its square
    if (mb.move === 'split' && !m.split && !m.pack && m.hp >= 4) {
      m.split = true;
      const half = Math.floor(m.hp / 2);
      m.hp -= half; m.maxHp = Math.max(m.hp, Math.ceil(m.maxHp / 2));
      m.pack = [{ hp: half, maxHp: m.maxHp }];
      m.windup = null;
      K.log(`The ${mb.name} splits in two!`, 'bad');
      K.learn(m.id, 'trick');
    }
    // the lich's fight turns as it weakens: once at two thirds, again at one third
    if (mb.boss) {
      const phase = m.hp < m.maxHp / 3 ? 2 : (m.hp < m.maxHp * 2 / 3 ? 1 : 0);
      while ((m.phase || 0) < phase) { m.phase = (m.phase || 0) + 1; bossTurns(m); }
    }
    // a champion's fight turns too: its ground at two thirds, its last stand at one third (lairs.js)
    if (mb.named) K.lairs.hurt(m, mb);
  }
  // ---------- a monster's turn ----------
  // Every creature on the floor, every tick, in the order its turn goes: it
  // speaks as it wakes, rises again if its bones knit, burns or mends, and
  // then, when its moment comes, stirs or sleeps on, loses you, flees, finishes
  // a volley or a warned blow, draws a new one back, or steps closer. Each step
  // settles the creature for this tick; STOP means the hero has fallen and the
  // rest wait. (Split out of one long loop in game.js; the order is the rules.)
  const STOP = 'stop';
  function updateMonsters() {
    const L = K.lvl(), p = K.P();
    ensureDist();
    for (const m of L.monsters.slice()) if (monsterTurn(m, L, p) === STOP) return;
  }
  /** @returns {undefined|'stop'} */
  function monsterTurn(m, L, p) {
    const G = K.G, mb = K.mstat(m);
    if (m.sunk) { lurks(m, L, p); return; }
    // a grey dwarf's working wears off, and it shrinks back to its own size
    // (told only of one close enough to be seen)
    if (m.bigUntil && G.t >= m.bigUntil) {
      delete m.bigUntil;
      if (Math.abs(m.x - p.x) + Math.abs(m.y - p.y) <= 6) K.log(`The ${mb.name} shrinks back to ${(mb.named && mb.named.pron) || 'its'} own size.`, 'good');
    }
    // (a mimic still shut sleeps as a barrel does, whatever woke the floor: nothing that counts the awake counts it)
    if (m.disguised) { m.awake = false; waits(m, L, p); return; }
    speaks(m, mb);
    if (m.collapsed) { rises(m, mb); return; }
    if (!burnsAndMends(m, mb, L)) return;
    // the Warlord comes down from his throne once no one holds it for him
    if (m.throne && (G.t >= m.wardUntil || !L.monsters.some(o => o.bearer === m.uid))) leaveThrone(m);
    if (G.t < m.nextAct) return;
    // the toll-goblins' kin keep the truce a fair payer earned (threads.js): they watch the
    // hero by and do nothing, until one of them is struck
    if (m.truce) { m.awake = false; m.windup = null; m.nextAct = G.t + mb.speed; return; }
    // caught in fire, the living get out of it before anything else (a blow already drawn back still falls)
    if (!m.windup && !m.volley && fiery(m.x, m.y) && fearsFire(mb) && escapesFire(m, mb, L, p)) return;
    // wrapped in shadow, the lich gathers itself and leaves the fighting to its guards
    // (the Warlord on his throne fights on from it, but does not leave it)
    if (m.wardUntil > G.t && mb.boss && !m.throne) { m.nextAct = m.wardUntil; return; }
    const di = K.distField[m.y * L.w + m.x];
    // a warband wakes as its leader does (dungeon.js)
    if (!m.awake && m.follows && L.monsters.some(o => o.uid === m.follows && o.awake)) { m.awake = true; m.nextAct = G.t + WAKE_BEAT; return; }
    if (!m.awake) { stirs(m, mb, L, p, di); return; }
    // the first floor's grace (game.js): what is awake waits for the hero's first step or blow
    if (G.graceUntil > G.t) return;
    // a lookout runs for help before it fights (fetchHelp below)
    if (mb.fetches && !m.fetched && fetchHelp(m, mb, L, p)) return;
    // a cutpurse far enough off with the gold is gone with it, for good
    if (m.fleeing && m.loot && (di < 0 || di > SNATCH_GONE)) {
      L.monsters.splice(L.monsters.indexOf(m), 1);
      K.log(`The ${mb.name} is gone into the dark, and ${m.loot} of your gold with it.`, 'bad');
      return;
    }
    // (roused by a rest on the ladder's third rung, it hunts from any distance until it is near)
    if (m.hunting && di >= 0) { if (di <= 12) m.hunting = false; }
    else if (di < 0 || di > 12) { losesYou(m, mb); return; }
    m.lostAt = 0;
    if (m.fleeing && flees(m, mb, L, p, di)) return;
    const adjacent = Math.abs(m.x - p.x) + Math.abs(m.y - p.y) === 1;
    // the eyeless hunt by ear: a hero standing still, not beside it, is lost to it
    if (mb.hears && !adjacent && !hearsHero(p)) { gropes(m, mb); return; }
    if (mb.hears && m.groping) { m.groping = false; K.floatText(m, 'hears you', '#e0d0ff'); }
    const shot = !adjacent && mb.ranged && hasLineToPlayer(m, mb.ranged.range, !!mb.boss);
    // Blows from several attackers used to land in one frame, read as one
    // hit, and kill faster than anyone could turn. Space them so each one
    // is its own flash, sound and line of the log.
    if (m.volley) return volleys(m, mb, adjacent, shot);
    if (m.windup && m.windup.move) {
      resolveMove(m, mb, m.windup);
      // an Ancient champion is ready to try it again in half the time
      if (m.elite === 'Ancient' && m.moveReady > G.t) m.moveReady = G.t + Math.round((m.moveReady - G.t) / 2);
      return G.status !== 'playing' ? STOP : undefined;
    }
    // on his throne the Warlord only throws: his shield-bearers do the close work
    if (m.throne && adjacent) { m.windup = null; m.nextAct = G.t + 400; return; }
    // a skirmisher (a kobold) steps back out of reach to throw, now and then, if it has room
    if (!m.windup && adjacent && mb.skirmish && backsOff(m, mb, L, p)) return;
    if (!m.windup && startMove(m, mb, adjacent)) return;
    if (m.windup) return strikes(m, mb, adjacent, shot);
    if (adjacent || shot) {
      // (the Warlord throws from his throne only now and then: he cannot be hurt up there, and a
      // spear every blow's worth of time from where no blade reaches was most of the fight)
      const cycle = shot && !adjacent ? mb.speed * (m.throne ? 2.6 : 1.3) : mb.speed;
      // the goblin the hero spared, about on this floor, drops onto the first foe that draws back a blow
      if (adjacent && K.sparedAid(m)) return;
      beginWindup(m, adjacent ? 'melee' : 'shot', windupFor(cycle));
      return;
    }
    // the hero's hound in its way: it goes through the hound
    if (besideHound(m)) { beginWindup(m, 'pet', windupFor(mb.speed)); return; }
    if (m.throne) { m.nextAct = G.t + 400; return; }
    closesIn(m, mb, L, p, di);
  }
  /** Its first words on waking: the lich's, a champion's, a shade's. */
  function speaks(m, mb) {
    if (mb.boss && m.awake && !m.spoke) {
      m.spoke = true;
      // its first words (MONSTERS in data.js, with the rest of the narrator's)
      K.log(mb.speech, 'bad');
      K.emit('boss:' + m.id);
      Sound.play('voice', K.heard(m, { who: m.id === 'warlord' ? 'orc' : m.id }));
      K.fx.shakeAmp = 4; K.fx.shakeMs = 500; K.fx.shakeUntil = K.realNow + 500;
    } else if (mb.named && m.awake && !m.spoke) namedWakes(m, mb);
    else if (m.shade && m.awake && !m.spoke) K.shadeWakes(m);
  }
  /** Collapsed bones knit together when their time comes. */
  function rises(m, mb) {
    if (K.G.t < m.collapsed) return;
    m.collapsed = 0; m.hp = Math.ceil(m.maxHp / 2); m.awake = true; m.nextAct = K.G.t + WAKE_BEAT;
    K.log(`The bones knit together: the ${mb.name} rises again!`, 'bad');
    Sound.play('voice', K.heard(m, { who: m.id }));
  }
  /** Burning, venom and a bear's rending tick; a regenerating creature mends. @returns {boolean} whether it is still up to act */
  function burnsAndMends(m, mb, L) {
    const G = K.G;
    if (m.dot && G.t >= m.dot.next) {
      const dot = m.dot;
      if (dot.next > dot.until) m.dot = null;
      else {
        dot.next += 1000;
        // (marked as a carried burn's tick, told whole even while it stands in flames)
        m.dotTick = true;
        K.damageMonster(m, dot.kind === 'venom' ? d(1, 3) : dot.kind === 'bleed' ? d(1, dot.die || 4) : K.elemental(m, d(1, dot.die || 4), 'fire'), dot.kind);
        m.dotTick = false;
        if (!L.monsters.includes(m) || m.collapsed) return false;
      }
    }
    if (mb.regen && m.hp < m.maxHp && !(m.burnUntil > G.t) && G.t >= (m.nextRegen || 0)) {
      m.hp = Math.min(m.maxHp, m.hp + mb.regen); m.nextRegen = G.t + 1000;
      if (G.met && G.met[m.uid]) K.learn(m.id, 'trick');   // you watched its wounds close
      if (mb.named) namedMends(m, mb);
    }
    return true;
  }
  /** Asleep: it wakes if the hero comes close enough to be noticed, else dozes or drifts. */
  function stirs(m, mb, L, p, di) {
    const G = K.G;
    // the eyeless wake to a sound, and only a sound (or a touch): a hero who stands still is passed by
    if (mb.hears) {
      const touch = Math.abs(m.x - p.x) + Math.abs(m.y - p.y) === 1;
      if (touch || (di >= 0 && di <= (p.cls === 'thief' ? 4 : 7) && hearsHero(p))) {
        m.awake = true; m.groping = false; Sound.play('voice', K.heard(m, { who: m.id })); m.nextAct = G.t + WAKE_BEAT;
        K.meet(m);
        if (touch) beginWindup(m, 'melee', WAKE_BEAT);
        return;
      }
      if (rnd() < 0.3) wander(m);
      m.nextAct = G.t + mb.speed * 1.5;
      return;
    }
    // Thieves move quietly, so their double blow on a sleeping foe can
    // actually happen: at six squares almost nothing stayed asleep long
    // enough to be reached. Deep-born blood stacks with it, and so do a
    // Ring of Stealth and an Assassin's step, down to the square beside you:
    // a floor of two left the Assassin's step doing nothing for a Deep-born thief.
    const notice = Math.max(1, 6 - (p.bg === 'deepborn' ? 2 : 0) - (p.cls === 'thief' ? 2 : 0) - (K.hasPower('quiet') ? 1 : 0) - K.assassinQuiet() - (L.twist === 'dark' ? 1 : 0) - (K.hasTalent('camouflage') ? 1 : 0) + (K.houndNoisy() ? 1 : 0));
    // Waking is not acting. The growl used to land in the same frame as the
    // first blow from anything that woke beside you, so the only warning was
    // the damage. Give the growl a beat to be heard and turned toward.
    // in a thief's smoke nothing finds them by sight or sound; a blow still wakes it
    // the keeper of the Heart knows the moment a hero sets foot in its hall, however
    // quietly: its hall is long, and a lich asleep at the far end of it was walked up
    // to and struck before it had said a word (the lich sees through smoke besides)
    const here = L.roomId ? L.roomId[p.y * L.w + p.x] : -1;
    const inHall = !!mb.boss && here >= 0 && here === L.roomId[m.y * L.w + m.x];
    if (inHall || (di >= 0 && di <= notice && !(p.smokeUntil > G.t))) {
      const coughing = (m.smoked || 0) > G.t && K.hasTalent('choking_cloud');
      m.awake = true; m.smoked = 0; Sound.play('voice', K.heard(m, { who: m.id })); m.nextAct = G.t + WAKE_BEAT + (coughing ? 1500 : 0);
      if (coughing) K.floatText(m, 'coughing', '#eef0ff');
      if (mb.named && !m.spoke) namedWakes(m, mb);   // its line before the bestiary's
      if (m.shade && !m.spoke) K.shadeWakes(m);
      K.meet(m);
      // woken right beside you, its first blow is already being drawn back
      // (unless it comes out of the smoke coughing: then its first move waits)
      if (!coughing && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) === 1) beginWindup(m, 'melee', WAKE_BEAT);
      return;
    }
    // lost in a thief's smoke, it stands and peers about rather than wandering off
    if (!(p.smokeUntil > G.t) && rnd() < 0.25) wander(m);
    m.nextAct = G.t + mb.speed * 1.5;
  }
  // How long a sound hangs about for an eyeless to follow: a thief's steps fade sooner
  const HEAR_MS = 1500, HEAR_MS_THIEF = 800;
  /** Whether the hero has made a sound lately: a step, a blow, a spell, a door. */
  const hearsHero = p => K.G.t - (p.noiseAt == null ? -1e9 : p.noiseAt) < (p.cls === 'thief' ? HEAR_MS_THIEF : HEAR_MS);
  /** An eyeless that has lost the sound: it stops, listens, and gropes about. */
  function gropes(m, mb) {
    const G = K.G;
    m.windup = null; m.volley = null;
    if (!m.groping) {
      m.groping = true;
      K.floatText(m, 'listening', '#c8c0e0');
      if (!m.gropeSaid) { m.gropeSaid = true; K.log(`The ${mb.name} stops dead, its blind head turning, listening for you.`, 'good'); K.learn(m.id, 'answer'); }
    }
    if (rnd() < 0.5) wander(m);
    m.nextAct = G.t + mb.speed;
  }
  /** A drowned one lies sunk until something comes within two squares of it. */
  function lurks(m, L, p) {
    const G = K.G;
    if (G.t < m.nextAct) return;
    // it cannot come up through ice
    const f = K.fieldAt(m.x, m.y);
    if (f && f.k === 'ice') { m.nextAct = G.t + 400; return; }
    const di = K.distField[m.y * L.w + m.x];
    if (di >= 0 && di <= 2) surface(m, 'near');
    else m.nextAct = G.t + 400;
  }
  /**
   * A drowned one comes up out of the water: come near, stepped into, or
   * struck in its ripple. It rises reaching for whoever is beside it.
   * @param {'near'|'step'|'struck'|'shock'} why
   */
  function surface(m, why) {
    const G = K.G, p = K.P(), mb = K.mstat(m);
    if (!m.sunk) return;
    // ice over the water holds it down until it melts
    const f = K.fieldAt(m.x, m.y);
    if (f && f.k === 'ice') {
      if (why === 'step') K.log('Something moves under the ice there, and cannot come up through it.');
      else if (why === 'struck') K.log('Your blow finds something under the ice, and it cannot come up through it.');
      return;
    }
    delete m.sunk;
    m.awake = true; m.blows = 1;
    K.spray(m, 'rot', 0.6, false);
    Sound.play('voice', K.heard(m, { who: m.id }));
    K.log(why === 'shock' ? `The lightning finds something under the water, and a ${mb.name} heaves up out of it!`
      : why === 'struck' ? `Your blow finds something under the water, and a ${mb.name} heaves up out of it!`
      : why === 'step' ? `You tread on something under the water. A ${mb.name} rises, reaching for you!`
        : `The black water heaves, and a ${mb.name} rises out of it!`, 'bad');
    K.meet(m, 'trick');
    m.nextAct = G.t + WAKE_BEAT;
    // beside the hero, its first move is to seize them
    if (Math.abs(m.x - p.x) + Math.abs(m.y - p.y) === 1) startMove(m, mb, true);
  }
  /** A sure blow that takes hold of the hero (a zombie's lurch, a mimic's jaws), unless Stand Firm tears free. */
  function seize(m, mb) {
    const p = K.P();
    if (monsterAttack(m, { verb: 'seizes', sure: true }) && K.G.status === 'playing' && !p.grabbed) {
      if (K.hasTalent('stand_firm')) K.log(`You tear out of the ${mb.name}'s grasp before it closes.`, 'good');
      else if (K.hasBoon('unheld')) K.log(`The ${mb.name}'s grip closes on you and breaks: nothing holds you.`, 'good');
      else {
        p.grabbed = { uid: m.uid, until: K.G.t + 4000, nextTry: 0 };
        K.log(`The ${mb.name} has hold of you! Pull free: stepping away takes strength.`, 'bad');
      }
    }
  }
  /** One step further from the hero, onto open ground (not fire, nor its own snares); once in a while, so a cornered one fights. @returns {boolean} whether it stepped */
  function backsOff(m, mb, L, p) {
    const G = K.G;
    if ((m.backAt || 0) > G.t) return false;
    const d0 = Math.abs(m.x - p.x) + Math.abs(m.y - p.y);
    for (const [dx, dy] of K.DIRS) {
      const nx = m.x + dx, ny = m.y + dy;
      if (Math.abs(nx - p.x) + Math.abs(ny - p.y) <= d0) continue;
      if (!K.passable(nx, ny) || K.monsterAt(nx, ny) || K.npcAt(nx, ny) || K.companionAt(nx, ny) || fiery(nx, ny) || (L.traps || {})[K.key(nx, ny)]) continue;
      moveMonster(m, nx, ny);
      m.backAt = G.t + 2500;
      m.nextAct = G.t + Math.round(mb.speed * 0.8);
      return true;
    }
    return false;
  }
  // ---------- a mimic ----------
  // As a barrel it creaks once as the hero comes within three squares (its
  // tell), and springs on a hero who touches it or stays beside it a moment.
  // Struck first, from where the hero stands, it is caught shut (see game.js).
  const MIMIC_CREAK = 3, MIMIC_BEAT = 600;
  function waits(m, L, p) {
    const G = K.G;
    if (G.t < m.nextAct) return;
    m.nextAct = G.t + 150;
    const di = K.distField[m.y * L.w + m.x], beside = Math.abs(m.x - p.x) + Math.abs(m.y - p.y) === 1;
    if (!m.creaked && di >= 0 && di <= MIMIC_CREAK) {
      m.creaked = true;
      K.log(`A${m.disguise === 'chest' ? ' chest' : ' barrel'} nearby creaks, though nothing touched it.`);
      Sound.play('creak', K.heard(m));
    }
    if (!beside) { m.springAt = 0; return; }
    if (!m.springAt) m.springAt = G.t + MIMIC_BEAT;
    else if (G.t >= m.springAt) spring(m, 'near');
  }
  /**
   * The barrel opens: touched (it seizes at once), struck (caught shut: the
   * blow was the answer), or stood beside (it lunges, and a step away is time enough).
   * @param {'touch'|'struck'|'near'} why
   */
  function spring(m, why) {
    const G = K.G, p = K.P(), mb = K.mstat(m);
    if (!m.disguised) return;
    delete m.disguised; m.springAt = 0;
    m.awake = true; m.blows = 1;
    Sound.play('voice', K.heard(m, { who: m.id }));
    const it = m.disguise === 'chest' ? 'chest' : 'barrel';
    K.log(why === 'touch' ? `The ${it} ${it === 'chest' ? 'lid gapes' : 'splits open'} into a mouth full of teeth: a ${mb.name}, and it lunges for you!`
      : why === 'struck' ? `The ${it} shrieks and heaves open: a ${mb.name}, caught shut by your blow!`
        : `The ${it} yawns open: a ${mb.name}, and it lunges for you!`, why === 'struck' ? 'good' : 'bad');
    K.meet(m, 'trick');
    if (why === 'struck') K.learn(m.id, 'answer');
    m.nextAct = G.t + WAKE_BEAT;
    const beside = Math.abs(m.x - p.x) + Math.abs(m.y - p.y) === 1;
    if (why === 'touch' && beside) { seize(m, mb); G.blowGate = G.t + K.BLOW_GAP; m.nextAct = G.t + mb.speed; }
    else if (why === 'near' && beside) startMove(m, mb, true);
  }
  /** Out of the flames, to the square beside that is nearest the hero and not burning (furthest, for one fleeing). @returns {boolean} whether it moved */
  function escapesFire(m, mb, L, p) {
    let best = null, bd = Infinity;
    for (const [dx, dy] of K.DIRS) {
      const nx = m.x + dx, ny = m.y + dy;
      if (!K.passable(nx, ny) || fiery(nx, ny) || K.monsterAt(nx, ny) || K.npcAt(nx, ny) || K.companionAt(nx, ny) || (nx === p.x && ny === p.y)) continue;
      const dd = K.distField[ny * L.w + nx];
      const score = m.fleeing ? -(dd >= 0 ? dd : 0) : dd >= 0 ? dd : 99;
      if (score < bd) { bd = score; best = [nx, ny]; }
    }
    if (!best) return false;
    moveMonster(m, best[0], best[1]);
    m.nextAct = K.G.t + Math.max(300, Math.round(mb.speed * 0.45));
    return true;
  }
  /** Out of reach of the trail: after a while it stops hunting and settles again. */
  function losesYou(m, mb) {
    const G = K.G;
    if (!m.lostAt) m.lostAt = G.t;
    else if (G.t - m.lostAt > 7000) { m.awake = false; m.lostAt = 0; }
    m.windup = null; m.volley = null;  // a blow drawn at you is dropped once it has lost you
    if (rnd() < 0.3) wander(m);
    m.nextAct = G.t + mb.speed * 1.5;
  }
  /**
   * A lookout that has seen the hero runs for the nearest of the floor's sleepers,
   * a step a turn by the shortest way, and once within two squares of them blows
   * its whistle: everything within six wakes. It fights only once that is done, or
   * once there is no one left asleep near enough to fetch.
   * @returns {boolean} whether it spent its turn on it
   */
  function fetchHelp(m, mb, L, p) {
    const G = K.G;
    const asleep = o => o !== m && !o.awake && !o.disguised && !o.truce && !o.sunk && !MONSTERS[o.id].boss;
    // the way to every square within reach of it, by steps
    const prev = new Map([[m.y * L.w + m.x, -1]]), q = [m.y * L.w + m.x];
    let goal = -1;
    for (let qi = 0; qi < q.length && goal < 0; qi++) {
      const i = q[qi], x = i % L.w, y = (i / L.w) | 0;
      if (L.monsters.some(o => asleep(o) && Math.abs(o.x - x) + Math.abs(o.y - y) <= 1)) { goal = i; break; }
      for (const [dx, dy] of K.DIRS) {
        const nx = x + dx, ny = y + dy, j = ny * L.w + nx;
        if (prev.has(j) || !K.passable(nx, ny) || (nx === p.x && ny === p.y)) continue;
        if (prev.size > 900) break;
        prev.set(j, i); q.push(j);
      }
    }
    if (goal < 0 || (() => { let n = 0; for (let i = goal; prev.get(i) >= 0; i = prev.get(i)) n++; return n > FETCH_REACH; })()) { m.fetched = true; return false; }
    if (!m.fetching) {
      m.fetching = true;
      K.log(`The ${mb.name} turns and runs, shrieking, for the others! Bring it down before it reaches them.`, 'bad');
      K.meet(m, 'trick');
      Sound.play('voice', K.heard(m, { who: m.id }));
    }
    // there: the whistle
    const near = L.monsters.filter(o => asleep(o) && Math.abs(o.x - m.x) + Math.abs(o.y - m.y) <= 2);
    if (near.length || goal === m.y * L.w + m.x) {
      for (const o of L.monsters) if (o !== m && !o.disguised && !o.truce && Math.abs(o.x - m.x) + Math.abs(o.y - m.y) <= FETCH_WAKE) o.awake = true;
      m.fetched = true; m.fetching = false;
      K.log(`The ${mb.name} blows a shrill whistle, and all about it things stir and get up!`, 'bad');
      Sound.play('special', K.heard(m));
      m.nextAct = G.t + mb.speed;
      return true;
    }
    // a step along the way
    let step = goal;
    while (prev.get(step) >= 0 && prev.get(step) !== m.y * L.w + m.x) step = prev.get(step);
    const sx = step % L.w, sy = (step / L.w) | 0;
    if (K.monsterAt(sx, sy) || K.npcAt(sx, sy) || K.companionAt(sx, sy)) { m.nextAct = G.t + 300; return true; }
    moveMonster(m, sx, sy);
    m.nextAct = G.t + Math.round(mb.speed * 0.75);
    return true;
  }
  /** Run for the darkness; recover nerve once far enough away. @returns {boolean} whether it fled (false: cornered, it fights on) */
  function flees(m, mb, L, p, di) {
    const G = K.G;

    if (di > 8) { m.fleeing = false; m.nextAct = G.t + mb.speed; return true; }
    let away = null, ad = di;
    for (const [dx, dy] of K.DIRS) {
      const nx = m.x + dx, ny = m.y + dy;
      if (nx < 0 || ny < 0 || nx >= L.w || ny >= L.h) continue;
      const dd = K.distField[ny * L.w + nx];
      // never onto the hero: a chase or a wander would not, and a stale map must not tempt one
      // (and never into fire, for a living thing running for its life)
      if (fearsFire(mb) && fiery(nx, ny)) continue;
      if (dd > ad && !(nx === p.x && ny === p.y) && !K.monsterAt(nx, ny) && !K.npcAt(nx, ny) && !K.companionAt(nx, ny)) { ad = dd; away = [nx, ny]; }
    }
    // a shut door in the way is met as in a chase: opened, battered or smashed, never walked through
    if (away && K.tile(away[0], away[1]) === K.T.DOOR) { const slow = meetDoor(m, mb, away[0], away[1]); m.nextAct = G.t + (slow ? mb.speed : Math.max(300, Math.round(mb.speed * 0.45))); return true; }
    if (away) { moveMonster(m, away[0], away[1]); m.nextAct = G.t + mb.speed; return true; }
    m.fleeing = false; // cornered: fight on
    return false;
  }
  /** The rest of a group's volley, each blow a beat behind the last. @returns {undefined|'stop'} */
  function volleys(m, mb, adjacent, shot) {
    const G = K.G;
    // step out of reach and the ones still to come hit the air
    const inReach = m.volley.kind === 'melee' ? adjacent : shot;
    // the ones cut down mid-volley have no blow left to land
    m.volley.left = Math.min(m.volley.left, K.packSize(m) - 1);
    if (m.volley.left <= 0) { m.nextAct = Math.max(G.t + 120, m.volley.next); m.volley = null; return; }
    if (inReach && G.t < (G.blowGate || 0)) { m.nextAct = G.blowGate; return; }
    if (inReach) {
      monsterAttack(m); G.blowGate = G.t + K.BLOW_GAP;
      if (G.status !== 'playing') return STOP;
    }
    m.volley.left--;
    if (!inReach || m.volley.left <= 0) {
      if (!inReach) { defence(m, 'dodge'); K.log(`The rest of the ${mb.name}s swing at the air where you stood.`, 'good'); m.pressing = true; }
      m.nextAct = Math.max(G.t + 120, m.volley.next);
      m.volley = null;
    } else m.nextAct = G.t + K.BLOW_GAP;
  }
  /** A warned blow comes down: on you if you are still there, on the air if not. @returns {undefined|'stop'} */
  function strikes(m, mb, adjacent, shot) {
    const G = K.G, w = m.windup;
    // a blow at the hound, not the hero: it lands if the hound is still there
    if (w.kind === 'pet') { m.windup = null; K.companionStruck(m, mb); m.nextAct = G.t + Math.max(120, mb.speed - (w.until - w.at)); return; }
    const cycle = w.kind === 'shot' ? mb.speed * 1.3 : mb.speed;
    // a step back is not always out of reach: a lunger follows you, and the lich's touch reaches
    let follow = w.kind === 'melee' && !adjacent ? K.followBlow(m, mb, w) : null;
    // (a living lunger does not follow you into fire: the blow falls on the air)
    if (follow && follow.lunge && fearsFire(mb) && fiery(follow.x, follow.y)) follow = null;
    const inReach = w.kind === 'melee' ? adjacent || !!follow : shot;
    if (inReach && G.t < (G.blowGate || 0)) { m.nextAct = G.blowGate; return; }   // held a beat, still coming
    m.windup = null;
    // (an Ancient champion's every-third-blow trick comes every other blow or so: each counts twice)
    if (w.kind === 'melee') m.blows = (m.blows || 0) + (m.elite === 'Ancient' ? 2 : 1);
    if (inReach) {
      if (follow && follow.lunge) { moveMonster(m, follow.x, follow.y); G.lunges = (G.lunges || 0) + 1; }
      if (w.kind === 'melee') monsterAttack(m, undefined, follow ? follow.verb : undefined, follow ? follow.miss : undefined); else rangedAttack(m);
      G.blowGate = G.t + K.BLOW_GAP;
      if (G.status !== 'playing') return STOP;
      // a group draws back together and swings as a volley: one warning,
      // every member's blow, the same blows a minute as swinging in turn
      if (w.kind === 'melee' && K.packSize(m) > 1) {
        m.volley = { kind: 'melee', left: K.packSize(m) - 1, next: w.at + cycle };
        m.nextAct = Math.max(G.t + K.BLOW_GAP, m.staggerUntil || 0); m.staggerUntil = 0;
        return;
      }
    } else {
      defence(m, 'dodge');
      K.log(w.kind === 'melee' ? `The ${mb.name} swings at the air where you stood.` : `The ${mb.name}'s shot flies wide as you move.`, 'good');
      Sound.play('whiff', K.heard(m));
      // made to miss, it presses in: the next blow is drawn back faster, so
      // stepping away is a save, not a loop that keeps it from ever landing
      m.pressing = true;
      m.lungeAt = K.realNow;               // it still swings, at nothing
      if (w.kind === 'melee') { K.riposte(); K.tricksterOpening(m); }
    }
    // (a Knight's Shield Wall or a Frostweaver's Ice Armour may have staggered it as its blow landed: it is held that long)
    m.nextAct = Math.max(G.t + Math.max(120, cycle - (w.until - w.at)), m.staggerUntil || 0); m.staggerUntil = 0;
  }
  /** The hero's hound is beside it (on this floor, standing). */
  const besideHound = m => K.DIRS.some(([dx, dy]) => K.companionAt(m.x + dx, m.y + dy));
  /** One step nearer along the trail, drawing back as it arrives. */
  function closesIn(m, mb, L, p, di) {
    const G = K.G, shy = fearsFire(mb);
    let best = null, bd = di, balked = false;
    for (const [dx, dy] of K.DIRS) {
      const nx = m.x + dx, ny = m.y + dy;
      if (nx < 0 || ny < 0 || nx >= L.w || ny >= L.h) continue;
      const dd = K.distField[ny * L.w + nx];
      if (dd >= 0 && dd < bd && !K.monsterAt(nx, ny) && !K.npcAt(nx, ny) && !K.companionAt(nx, ny) && !(nx === p.x && ny === p.y)) {
        if (shy && fiery(nx, ny)) { balked = true; continue; }
        bd = dd; best = [nx, ny];
      }
    }
    const moveSpeed = Math.max(300, Math.round(mb.speed * 0.45));
    if (!best) {
      // held back by the flames: it says so, once
      if (balked && !(m.balkSaid > K.G.t)) { m.balkSaid = K.G.t + 12000; K.floatText(m, 'shies', '#ffb060'); if (K.heard(m).dist <= 6) K.log(`The ${mb.name} shies back from the flames.`, 'good'); }
      m.nextAct = G.t + mb.speed; return;
    }
    const slow = K.tile(best[0], best[1]) === K.T.DOOR ? meetDoor(m, mb, best[0], best[1]) : (moveMonster(m, best[0], best[1]), false);
    m.nextAct = G.t + (slow ? mb.speed : moveSpeed);
    // Stepping up to you, it draws back as it comes, so its first blow
    // lands exactly when it always did: the warning costs a watchful
    // player nothing and gives an unwatchful one nothing either.
    // the first blow of a fight gets the full warning, even from something quick
    if (Math.abs(m.x - p.x) + Math.abs(m.y - p.y) === 1) beginWindup(m, 'melee', Math.max(moveSpeed, windupFor(mb.speed)));
    else if (mb.ranged && hasLineToPlayer(m, mb.ranged.range, !!mb.boss)) beginWindup(m, 'shot', Math.max(moveSpeed, windupFor(mb.speed * 1.3)));
  }

  return { RISE_MS, WAKE_BEAT, updateMonsters, beginWindup, breaksBones, burnWeb, ensureDist, hasLineToPlayer, meetDoor, monsterAttack, moveMonster, moveOnHurt, sporesOn, surface, spring, poisonFor, rangedAttack, resolveMove, startMove, wander, windupFor };
}
