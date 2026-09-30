import { ITEMS, MONSTERS, armorFits, shieldFits } from './data.js';
import { Dice, d } from './rng.js';
import { Sound } from './sound.js';

// Monsters: how they wake, move and strike, their signature moves, the lich's
// three-act fight and the named champions. Split out of game.js; everything it
// needs from the game comes through K.

/**
 * @param {any} K  what the game lends: its state and the rules the rest of it keeps
 */
export function makeFoes(K) {
  // ---------- monsters ----------
  function computeDist() {
    const L = K.lvl(), p = K.P();
    const dist = new Int32Array(L.w * L.h).fill(-1);
    const q = [p.y * L.w + p.x];
    dist[q[0]] = 0;
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi], x = i % L.w, y = (i / L.w) | 0;
      if (dist[i] > 20) break;
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
  }
  // The living will not walk into fire, and one caught in it gets out: a line
  // of burning moss across a passage holds back whatever breathes. The dead,
  // and the lich and the Warlord, come on through it as if it were not there.
  const burning = (x, y) => { const f = K.fieldAt(x, y); return !!f && f.k === 'fire'; };
  // spilt oil beside a fire is as good as alight: it will be in a breath
  const fiery = (x, y) => { if (burning(x, y)) return true; const f = K.fieldAt(x, y); return !!f && f.k === 'oil' && K.DIRS.some(([dx, dy]) => burning(x + dx, y + dy)); };
  const fearsFire = mb => !mb.undead && !mb.boss;
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
  function rangedAttack(m) {
    const mb = K.mstat(m), r = mb.ranged;
    m.lungeAt = K.realNow;
    K.meet(m);
    const roll = d(1, 20);
    const ac = K.playerAC();
    const note = K.rollNote(roll, mb.hit, ac, roll === 20);
    Sound.play(m.id === 'archer' ? 'arrow' : 'darkbolt', K.heard(m));
    if (roll === 1 || (roll !== 20 && roll + mb.hit < ac)) { K.log(`The ${mb.name} ${r.verb} you and misses.${note}`); return; }
    if (K.hasTalent('evasion') && Math.random() < 1 / 3) { K.log(`You twist aside as the ${mb.name} ${r.verb} you.`, 'good'); return; }
    // a mage's Shield is woven against exactly this: bolts of magic break on it
    if (m.id !== 'archer' && K.effectFrom('ac', 'shield')) {
      K.log(`The ${mb.name} ${r.verb} you, and it breaks on your Shield.`, 'good');
      Sound.play('block', K.heard(m));
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
      const miss = K.relativeBearing(m);
      K.log(`The ${mb.name} ${missed || 'misses you'}${miss && miss.rel !== 0 ? ` ${miss.word}` : ''}.${note}`, miss && miss.rel !== 0 ? 'bad' : '');
      if (miss && miss.rel !== 0) { K.fx.hurtFrom = miss.rel; K.fx.hurtFromUntil = K.realNow + 700; }
      return false;
    }
    // a Trickster slips an ordinary blow now and then; a warned trick is not so easily slipped
    if (!heavy && K.tricksterSlip()) { K.log(`You slip aside from the ${mb.name}'s blow.`, 'good'); Sound.play('whiff', K.heard(m)); return false; }
    let dmg = Math.max(1, d(...mb.dmg) + (h.extra ? d(h.extra[0], h.extra[1], h.extra[2]) : 0)) * (h.mult || 1);
    // a crushing blow is doubled already; and on the first two floors a lucky
    // blow is not doubled at all: a level-one hero's whole life was a goblin's
    // one roll of 20, and those deaths taught nothing
    if (roll === 20 && !h.mult && K.G.depth >= 3) dmg *= 2;
    const firm = heavy && K.hasTalent('stand_firm');
    if (firm) dmg = Math.max(1, Math.ceil(dmg / 2));
    // a Knight takes a trick on set feet, and an ordinary blow now and then on the shield
    const was = dmg;
    dmg = heavy ? K.knightSteadfast(dmg) : K.knightGuard(dmg);
    const knight = dmg < was ? (heavy ? ' (your footing takes a quarter off)' : ' (caught on your shield: half)') : '';
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
  const windupFor = cycle => Math.round(Math.min(WINDUP_MS, cycle * 0.7));
  /** Draw a blow back: it lands in dur ms, if you are still there. */
  function beginWindup(m, kind, dur) {
    if (m.pressing) { dur = Math.max(350, Math.round(dur * 0.6)); m.pressing = false; }
    // a cunning fighter never draws back the same way twice: the beat cannot be learned, only the blow watched
    if (K.mstat(m).cunning) dur = Math.max(300, Math.round(dur * (0.7 + Math.random() * 0.6)));
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
  const SPECIAL_MS = { crush: 900, charge: 700, web: 650, mend: 1800, nova: 1300, grab: 750, paralyse: 750, rite: 2400, drum: 1600, gaze: 1100, rust: 800, rally: 1500, drink: 800, blink: 900, bristle: 1400, breath: 1000, firepot: 1100, firearrow: 1000 };
  const GAZE_MS = 1500;     // how long a basilisk's gaze leaves you stone
  // what a rustmaw's bite can find to eat: metal armour, any shield, a blade or a mace
  const RUSTS = { armor: ['studded', 'scale', 'chain', 'splint', 'plate'], weapon: id => !['staff', 'club', 'sling', 'shortbow', 'longbow'].includes(id) };
  const RITE_MEND = 0.2;    // the share of its life the lich takes back if its rite is let finish
  const WARD_MS = 4000;     // how long the lich stays wrapped in shadow when its fight turns
  const RISE_MS = 4500;     // a skeleton's bones lie still this long before it rises
  const HELD_MS = 1300;     // a ghoul's touch freezes you this long
  const NOVA_REACH = 2;     // the lich's cold fire reaches this far
  const THRONE_MS = 15000;  // the longest the Warlord sits his throne, shield-bearers or none
  const WARBAND = ['goblin', 'orc', 'archer'];   // who comes running to the Warlord's drum
  /** The cold fire spreads over open floor: two steps' walk, so a wall or a corner is cover. */
  function novaReaches(m) {
    ensureDist();
    const w = K.distField[m.y * K.lvl().w + m.x];
    return w >= 0 && w <= NOVA_REACH;
  }
  /** Crushing and magic keep a skeleton down; an edge only takes it apart. */
  function breaksBones(tag) {
    if (tag === 'fire' || tag === 'burn' || tag === 'burning' || tag === 'blaze' || tag === 'shock') return true;
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
    const mv = rite ? 'rite' : mb.move;
    if (!mv || (!rite && K.G.t < (m.moveReady || 0)) || K.packSize(m) > 1) return false;
    let say = '', extra = {};
    if (rite) say = `The ${mb.name} lifts its hands toward the Heart and begins to drink its light! Strike it to break the rite!`;
    // and the light it draws calls a guard to stand between you, once a rite
    if (rite && !L0guard(m)) raiseGuards(m, 'wraith');
    if (mv === 'crush' && adjacent && (m.blows || 0) >= 2) say = `The ${mb.name} heaves its club high over its head!`;
    else if (mv === 'charge' && hasLineToPlayer(m, m.id === 'minotaur' || mb.named ? 4 : 3) && Math.random() < 0.6) {
      say = `The ${mb.name} lowers its head and charges!`;
      extra = { dx: Math.sign(p.x - m.x), dy: Math.sign(p.y - m.y) };
    }
    // the Web-Mother spits from beside you as readily as down a corridor
    else if (mv === 'web' && (adjacent ? !!mb.named : hasLineToPlayer(m, 3)) && !(p.webbed > K.G.t)) say = `The ${mb.name} rears back to spit a web!`;
    else if (mv === 'mend') {
      const t = mendTarget(m);
      if (t) { say = t === m ? `The ${mb.name} begins a dark chant over its own wounds!` : `The ${mb.name} begins a dark chant over the wounded ${K.mstat(t).name}!`; extra = { target: t.uid }; }
    }
    else if (mv === 'grab' && adjacent && (m.blows || 0) >= 1 && !p.grabbed) say = `The ${mb.name} lurches forward to seize you!`;
    else if (mv === 'paralyse' && adjacent && (m.blows || 0) >= (mb.named && mb.named.often ? 1 : 2)) say = `The ${mb.name} reaches out with a numbing claw!`;
    // the storm comes every third blow at first, and later whenever you close on it
    else if (mv === 'nova' && novaReaches(m) && ((m.blows || 0) >= 2 || ((m.phase || 0) >= 1 && Math.random() < 0.35))) say = `The ${mb.name} gathers a storm of cold fire around itself. Get away!`;
    else if (mv === 'gaze' && (adjacent || hasLineToPlayer(m, 4)) && ((m.blows || 0) >= 1 || !adjacent) && Math.random() < 0.5) say = `The ${mb.name} rears its head, and its eyes begin to blaze! Look away!`;
    else if (mv === 'rust' && adjacent && (m.blows || 0) >= 2) say = `The ${mb.name} rears back, mandibles spread wide!`;
    // a blink hound steps out of the world and back in at your back
    // (only to a hero it could reach in a few steps: it does not pass through walls)
    else if (mv === 'blink' && K.distField && K.distField[m.y * K.lvl().w + m.x] > 0 && K.distField[m.y * K.lvl().w + m.x] <= 4 && ((m.blows || 0) >= 1 || !adjacent) && Math.random() < 0.5) {
      const spot = hindSpot(m);
      if (spot) {
        moveMonster(m, spot.x, spot.y);
        m.fromX = spot.x; m.fromY = spot.y; m.moveT1 = 0;   // gone and back, not a walk
        say = spot.side ? `The ${mb.name} flickers out of the air, and steps back into it at your side! Turn and face it!`
          : `The ${mb.name} flickers out of the air, and steps back into it at your back! Turn and face it!`;
        extra = { behind: spot.side ? 0 : 1 };
      }
    }
    else if (mv === 'bristle' && adjacent && (m.blows || 0) >= 1 && Math.random() < 0.6) say = `The ${mb.name}'s quills rattle up on end! Hold your blow!`;
    // a wyrm breathes down a passage at one who keeps their distance; under its jaws it only bites
    else if (mv === 'breath' && !adjacent && hasLineToPlayer(m, 4) && Math.random() < 0.6) {
      const its = (mb.named && mb.named.pron) || 'its';
      say = `The ${mb.name} rears back, and fire kindles in ${its} throat! Get in under ${its} jaws, or out of ${its} line!`;
      extra = { dx: Math.sign(p.x - m.x), dy: Math.sign(p.y - m.y) };
    }
    // a goblin on its own, from the third floor down, lights a pot of lamp oil
    // and throws it at where the hero stands, a few squares off down a line
    else if (mv === 'firepot' && K.G.depth >= 3 && hasLineToPlayer(m, 4) && Math.random() < 0.5) {
      say = `The ${mb.name} lights a clay pot of oil and draws back to throw it! Step aside!`;
      extra = { tx: p.x, ty: p.y, dx: Math.sign(p.x - m.x), dy: Math.sign(p.y - m.y) };
    }
    // an archer with a hero standing on something that will burn looses a lit arrow at their feet
    else if (mv === 'firearrow' && mb.ranged && hasLineToPlayer(m, mb.ranged.range) && K.fuelAt(p.x, p.y) && Math.random() < 0.5) {
      say = `The ${mb.name} touches a burning arrow to its bow, aimed at your feet! Step aside!`;
      extra = { tx: p.x, ty: p.y };
    }
    else if (mv === 'rally' || mv === 'drink') say = namedTrick(m, mb, mv, adjacent);
    // the Warlord's drum: every third blow, or at once in his frenzy, while his warband is thin
    else if (mv === 'drum' && ((m.blows || 0) >= 2 || (m.phase || 0) >= 2) && warbandThin(m)) say = `The ${mb.name} raises his drumstick over the war-drum! Strike him before the beat!`;
    if (!say) return false;
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
          K.learn(m.id, 'answer');
          K.opening(m);
          m.nextAct = K.G.t + 1600;
        } else if (door) {
          if (x !== m.x || y !== m.y) moveMonster(m, x, y);
          K.log(`The ${mb.name} slams into the shut door and reels back, wide open!`, 'good');
          Sound.play('smash', K.heard(m));
          K.learn(m.id, 'answer');
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
          K.learn(m.id, 'answer');
          K.opening(m);
          Sound.play('bump', K.heard(m));
          m.nextAct = K.G.t + 1600;
        }
        m.moveReady = K.G.t + 8000;
        break;
      }
      case 'grab':
        if (dist === 1) {
          if (monsterAttack(m, { verb: 'seizes', sure: true }) && K.G.status === 'playing' && !p.grabbed) {
            if (K.hasTalent('stand_firm')) K.log(`You tear out of the ${mb.name}'s grasp before it closes.`, 'good');
            else {
              p.grabbed = { uid: m.uid, until: K.G.t + 4000, nextTry: 0 };
              K.log(`The ${mb.name} has hold of you! Pull free: stepping away takes strength.`, 'bad');
            }
          }
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
        if ((dist === 1 || hasLineToPlayer(m, 4)) && K.hasTalent('evasion')) K.log('The web slides off you.', 'good');
        else if (dist === 1 || hasLineToPlayer(m, 4)) {
          const c = K.trickSave('dex', 'web');
          p.webbed = K.G.t + (c.pass ? 1600 : 3200);
          K.log(c.pass ? `The web catches one leg, not both: tear free!${c.note}` : `Sticky web binds your legs! Keep pushing to tear free.${c.note}`, 'bad');
          Sound.play('web', K.heard(m));
        } else { K.log(`The ${mb.name}'s web sails past you. It is open while it spins another.`, 'good'); K.learn(m.id, 'answer'); K.opening(m); }
        m.moveReady = K.G.t + 7000;
        m.nextAct = K.G.t + Math.round(mb.speed * 0.6);
        break;
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
          monsterAttack(m, { hit: 3, extra: [1, 6, 0], verb: 'sinks its teeth into', sure: true });
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
        // it bursts where the hero stood when it was lit, and on the square behind, down its line
        const spots = [[w.tx, w.ty], [w.tx + w.dx, w.ty + w.dy]];
        Sound.play('smash', K.heard({ x: w.tx, y: w.ty }));
        const hit = spots.some(([x, y]) => p.x === x && p.y === y);
        K.firepot(spots);
        if (hit) {
          const c = K.trickSave('dex', 'firepot');
          const n = Math.max(1, Math.ceil((d(1, 6) + Math.floor(K.G.depth / 2)) / (c.pass ? 2 : 1)));
          K.hurtPlayer(n, `The pot bursts over you in a sheet of flame for ${n}!${c.pass ? ' You turn from the worst of it.' : ''}${c.note}`, m, 'a goblin\'s firepot');
          K.G.blowGate = K.G.t + K.BLOW_GAP;
        } else { K.log(`The pot bursts in flames where you stood.`, 'good'); K.learn(m.id, 'answer'); }
        m.moveReady = K.G.t + 9000;
        m.nextAct = K.G.t + mb.speed;
        break;
      }
      case 'firearrow': {
        // the arrow comes at the feet it was aimed at: if they are still there, it is a shot at the hero as any other
        const still = p.x === w.tx && p.y === w.ty && hasLineToPlayer(m, mb.ranged.range);
        if (still) rangedAttack(m);
        else { K.log(`The burning arrow thuds into the ground where you stood.`, 'good'); K.learn(m.id, 'answer'); Sound.play('arrow', K.heard(m)); }
        K.igniteWild(w.tx, w.ty);
        m.moveReady = K.G.t + 8000;
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
    if (m.windup && m.windup.move === 'bristle' && tag === 'companion') K.companionHurt(d(1, 6) + Math.floor(K.G.depth / 2), 'The raised quills stab');
    // a quillback's raised quills bite back at a hand that strikes it
    if (m.windup && m.windup.move === 'bristle' && HAND_BLOW.has(tag) && !K.castingName && K.G.status === 'playing') {
      const p = K.P();
      if (Math.abs(m.x - p.x) + Math.abs(m.y - p.y) === 1) {
        m.windup.struck = true;
        const n = K.knightSteadfast(d(1, 6) + Math.floor(K.G.depth / 2));
        K.hurtPlayer(n, `You strike into its raised quills, and they bite deep! (${n})`, m, 'a quillback\'s quills');
      }
    }
    // a numbing claw is struck aside by a blow that lands first, and leaves it
    // open: a blow or a spell, not poison or fire already eating at it
    if (m.windup && m.windup.move === 'paralyse' && !['burning', 'blaze', 'venom', 'thorns', 'companion', 'shock'].includes(tag)) {
      m.windup = null; m.moveReady = K.G.t + 3000; m.nextAct = K.G.t + 900;
      K.log(`Your blow knocks the ${mb.name}'s claw aside before it can close!`, 'good');
      K.learn(m.id, 'answer');
      K.opening(m);
    }
    // a chant, a war-horn call and the lich's rite are the hero's to break:
    // the hound's teeth do not count, or it quietly won the lich fight for them;
    // nor does a fire some monster lit (a wyrm's breath)
    const byHero = tag !== 'companion' && tag !== 'blaze';
    // a chant is broken by any wound
    if (byHero && m.windup && m.windup.move === 'mend') {
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
    // and the Warlord's drum: a blow while the stick is raised and the beat dies
    if (byHero && m.windup && m.windup.move === 'drum') {
      m.windup = null; m.moveReady = K.G.t + 4000; m.nextAct = K.G.t + 700;
      K.log(`You strike the drumstick from the ${mb.name}'s fist! The beat dies before it starts.`, 'good');
      K.learn(m.id, 'answer');
    }
    // and so is the lich's rite, though it will try again
    if (byHero && m.windup && m.windup.move === 'rite') {
      m.windup = null; m.riteReady = K.G.t + 6000; m.nextAct = K.G.t + 700;
      K.log(`You break the ${mb.name}'s rite! The Heart's light slips back out of its hands.`, 'good');
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
  }
  // ---------- the lich ----------
  // Three fights in one. At first it stands and drains, and gathers its storm
  // of cold fire. At two thirds it calls up guards, comes apart into shadow
  // and gathers itself again a few steps off, throwing grave-cold at you over
  // their heads. At one third it calls up more, and a wraith with them, puts
  // out every torch in its hall, quickens, and tries to drink the Heart's light to mend itself.
  function bossTurns(m) {
    if (m.id === 'warlord') { warlordTurns(m); return; }
    const mb = MONSTERS[m.id];
    // its own hall, remembered before it moves: the torches it puts out are these
    if (!m.hall) m.hall = roomOf(m);
    raiseGuards(m);
    // the last act calls the rite's own guard at once: a wraith, cold as its master
    if (m.phase === 2) raiseGuards(m, 'wraith');
    m.windup = null; m.volley = null;
    m.wardUntil = K.G.t + WARD_MS; m.wardSaid = false;
    // a blow that goes straight through two thirds and one third does not
    // wait for it to step back: the torches go out where it stands
    if (m.phase === 1 && m.hp >= m.maxHp / 3) {
      const to = blinkSpot(m);
      if (to) {
        K.spray(m, 'ecto', 1, false);
        m.fromX = m.x = to[0]; m.fromY = m.y = to[1]; m.rx = m.x; m.ry = m.y; m.moveT1 = 0;
        K.spray(m, 'ecto', 1, false);
        Sound.play('blink', K.heard(m));
        K.log(`The ${mb.name} comes apart into shadow and gathers itself again across the hall. Grave-cold gathers in its hands.`, 'bad');
      }
      m.nextAct = K.G.t + 1200;
    } else if (m.phase === 2) {
      snuffTorches(m);
      Sound.play('snuff', K.heard(m));
      m.riteReady = m.wardUntil;             // the rite begins the moment the shadow lifts
      m.nextAct = K.G.t + 900;
      K.log(`The torches gutter and die. In the dark the ${mb.name} quickens, and turns toward the Heart.`, 'bad');
      K.fx.shakeAmp = 5; K.fx.shakeMs = 600; K.fx.shakeUntil = K.realNow + 600;
    }
    Sound.play('ward', K.heard(m, { ms: WARD_MS }));
  }
  /** Where the lich reappears: open floor three to five steps from the hero, in a straight line so it can throw at them, ahead of them where it can. */
  function blinkSpot(m) {
    const L = K.lvl();
    ensureDist();
    const out = [];
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
      const dd = K.distField[y * L.w + x];
      if (dd < 3 || dd > 5 || K.tile(x, y) !== K.T.FLOOR || K.monsterAt(x, y) || K.npcAt(x, y) || K.companionAt(x, y)) continue;
      if (hasLineToPlayer({ x, y }, 5, true)) out.push([x, y]);
    }
    // somewhere ahead of the hero if it can: vanishing behind them reads as a cheat
    const p = K.P(), [fx0, fy0] = K.DIRS[p.dir];
    const ahead = out.filter(([x, y]) => (x - p.x) * fx0 + (y - p.y) * fy0 > 0);
    return ahead.length ? Dice.pick(ahead) : out.length ? Dice.pick(out) : null;
  }
  /** The room a monster stands in, or a box round it where it stands in none. */
  function roomOf(m) {
    const L = K.lvl();
    return (L.rooms || []).find(r => m.x >= r.x && m.x < r.x + r.w && m.y >= r.y && m.y < r.y + r.h) || { x: m.x - 6, y: m.y - 6, w: 13, h: 13 };
  }
  /** Every torch in and round the lich's hall goes out, until the lich falls. */
  function snuffTorches(m) {
    const L = K.lvl(), r = m.hall || roomOf(m);
    m.snuffed = [];
    const out = new Set();
    for (let y = r.y - 1; y <= r.y + r.h; y++) for (let x = r.x - 1; x <= r.x + r.w; x++) {
      if (K.tile(x, y) === K.T.TORCH) { K.setTile(x, y, K.T.WALL); m.snuffed.push([x, y]); out.add(K.key(x, y)); }
    }
    // each torch's light lies on the floor in front of it: those, and only those, go dark
    const lit = l => !K.DIRS.some(([dx, dy]) => out.has(K.key(l.x + dx, l.y + dy)));
    m.lights = (L.lights || []).filter(l => !lit(l));
    L.lights = (L.lights || []).filter(lit);   // a new list, so the lighting is worked out afresh
  }
  function relightTorches(m) {
    const L = K.lvl();
    for (const [x, y] of m.snuffed || []) K.setTile(x, y, K.T.TORCH);
    if (m.lights && m.lights.length) L.lights = (L.lights || []).concat(m.lights);
    m.snuffed = []; m.lights = [];
  }
  // ---------- the Warlord ----------
  // The Warrens' last fight, in place of the lich. At first he fights with his
  // cleaver and beats his war-drum for a warband. At two thirds he leaps onto
  // his throne of plunder behind two shield-bearers, who turn every blow meant
  // for him, and throws spears from it; cut them down (or outlast him) and he
  // comes down. At one third he kicks open his war-chest and fights in a frenzy.
  function warlordTurns(m) {
    const mb = MONSTERS[m.id];
    m.windup = null; m.volley = null;
    if (m.phase === 1) {
      // the throne stands across the hall: he leaps to it, a few strides from the hero, as the lich steps away into shadow
      const to = blinkSpot(m);
      if (to) { m.fromX = m.x = to[0]; m.fromY = m.y = to[1]; m.rx = m.x; m.ry = m.y; m.moveT1 = 0; }
      const n = raiseBearers(m);
      if (n) {
        m.wardUntil = K.G.t + THRONE_MS; m.throne = true; m.wardSaid = false;
        K.log(`The ${mb.name} bellows and leaps up onto his throne of plunder. ${n > 1 ? 'Two shield-bearers close' : 'A shield-bearer closes'} ranks before him: while they stand, no blow reaches him.`, 'bad');
        K.learn(m.id, 'trick');
      }
      m.nextAct = K.G.t + 900;
    } else if (m.phase === 2) {
      if (m.throne) leaveThrone(m, false);
      spillChest(m);
      m.frenzy = true; m.blows = 2; m.moveReady = 0;
      K.log(`The ${mb.name} kicks open his war-chest. Gold spills across the floor, and he comes at you in a frenzy!`, 'bad');
      K.fx.shakeAmp = 5; K.fx.shakeMs = 500; K.fx.shakeUntil = K.realNow + 500;
      m.nextAct = K.G.t + 700;
    }
    Sound.play('roar', K.heard(m));
  }
  /** Few of his warband awake about him: room for the drum to call more. */
  function warbandThin(m) {
    if ((m.drums || 0) >= 2) return false;
    return K.lvl().monsters.filter(o => o !== m && o.awake && WARBAND.includes(o.id) && Math.abs(o.x - m.x) + Math.abs(o.y - m.y) <= 7).length < 3;
  }
  /** The beat: two goblins come running, sharing a square beside him. */
  function warband(m, mb) {
    m.drums = (m.drums || 0) + 1;
    Sound.play('drum', K.heard(m));
    const spot = spotNear(m);
    if (!spot) { K.log('The drum booms through the Warrens, but there is no room for anyone to come.', 'bad'); return; }
    const b = MONSTERS.goblin, hp = () => Dice.dice(b.hp[0], b.hp[1], b.hp[2]) + Math.floor((K.G.depth - 1) / 2);
    const g = K.newMonster('goblin', spot[0], spot[1], hp());
    const f = K.diff().hp * (1 + K.PRESS_HP * (K.lvl().press || 0));
    g.pack = [0].map(() => { const h = Math.max(1, Math.round(hp() * f)); return { hp: h, maxHp: h }; });
    g.awake = true;
    K.log(`BOOM. BOOM. The ${mb.name}'s drum rolls through the Warrens, and a warband comes running!`, 'bad');
    K.learn(m.id, 'trick');
  }
  /** Two orcs with great shields, beside the throne: the blows meant for him fall on them. */
  function raiseBearers(m) {
    let n = 0;
    for (let i = 0; i < 2; i++) {
      const spot = spotNear(m);
      if (!spot) break;
      const b = MONSTERS.orc;
      const g = K.newMonster('orc', spot[0], spot[1], Dice.dice(b.hp[0], b.hp[1], b.hp[2]));
      g.bearer = m.uid; g.awake = true;
      n++;
    }
    return n;
  }
  /** He comes down from the throne, his shield-bearers dead (or his patience gone). */
  function leaveThrone(m, say = true) {
    m.throne = false; m.wardUntil = K.G.t; m.nextAct = Math.max(m.nextAct, K.G.t + 600);
    if (say) {
      const alone = !K.lvl().monsters.some(o => o.bearer === m.uid);
      K.log(alone ? `With no one left to hold his throne, the ${MONSTERS[m.id].name} leaps down to fight you himself!` : `The ${MONSTERS[m.id].name} tires of his throne and leaps down, roaring.`, 'bad');
      if (alone) K.learn(m.id, 'answer');
      Sound.play('roar', K.heard(m));
    }
  }
  /** The war-chest spills: a few piles of gold about him, for whoever is left to pick them up. */
  function spillChest(m) {
    const L = K.lvl();
    for (let i = 0; i < 3; i++) {
      const spot = spotNear(m);
      if (!spot) break;
      const k = K.key(spot[0], spot[1]);
      (L.items[k] = L.items[k] || []).push({ t: 'gold', q: Dice.int(8, 16) * K.G.depth });
    }
  }
  /** The Warlord falls among his plunder, and his warband breaks and runs. */
  function warlordFalls(m) {
    K.spray(m, 'blood', 1, true); K.spray(m, 'blood', 1, false);
    K.fx.shakeAmp = 7; K.fx.shakeMs = 900; K.fx.shakeUntil = K.realNow + 900;
    Sound.play('namedfall', K.heard(m));
    const L = K.lvl();
    let ran = 0;
    for (const o of L.monsters) if (WARBAND.includes(o.id)) { o.fleeing = true; o.awake = true; ran++; }
    const k = K.key(m.x, m.y);
    (L.items[k] = L.items[k] || []).push({ t: 'gold', q: Dice.int(20, 30) * K.G.depth });
    K.log(`The ${MONSTERS[m.id].name} crashes down among his plunder${ran ? ', and his warband breaks and scatters into the Warrens' : ''}.`, 'good');
  }
  /** The lich's end: its bones burst apart, its cold light goes up, and the torches catch again. */
  function bossFalls(m) {
    if (m.id === 'warlord') { warlordFalls(m); return; }
    K.spray(m, 'bone', 1, false); K.spray(m, 'bone', 1, false); K.spray(m, 'ecto', 1, false);
    relightTorches(m);
    K.fx.shakeAmp = 7; K.fx.shakeMs = 900; K.fx.shakeUntil = K.realNow + 900;
    Sound.play('lichfall', K.heard(m));
    K.log('The torches catch again, one by one.', 'good');
  }
  /** A wraith the lich's rite called is still standing. */
  const L0guard = m => K.lvl().monsters.some(o => o.id === 'wraith' && o.riteCalled);
  /** An open square near a monster (the lich, or a champion calling its kin), never behind a wall; null if none is within three steps. */
  function spotNear(m) {
    const p = K.P();
    // the nearest open squares it could walk to, never behind a wall
    const spots = [], seen = new Set([K.key(m.x, m.y)]);
    let ring = [[m.x, m.y]];
    for (let r = 1; r <= 3 && !spots.length; r++) {
      const next = [];
      for (const [cx, cy] of ring) for (const [dx, dy] of K.DIRS) {
        const x = cx + dx, y = cy + dy, k = K.key(x, y);
        if (seen.has(k) || !K.passable(x, y)) continue;
        seen.add(k); next.push([x, y]);
        if (K.tile(x, y) === K.T.FLOOR && !K.monsterAt(x, y) && !K.npcAt(x, y) && !K.companionAt(x, y) && !(x === p.x && y === p.y)) spots.push([x, y]);
      }
      ring = next;
    }
    return spots.length ? Dice.pick(spots) : null;
  }
  /** Two skeletons sharing a square beside the lich; or, for its rite, a wraith. */
  function raiseGuards(m, kind = 'skeleton') {
    const spot = spotNear(m);
    if (!spot) return;
    const [x, y] = spot;
    const b = MONSTERS[kind], hp = () => Dice.dice(b.hp[0], b.hp[1], b.hp[2]);
    const g = K.newMonster(kind, x, y, hp());
    if (kind !== 'skeleton') g.riteCalled = true;
    if (kind === 'skeleton') { const h2 = hp(); g.pack = [{ hp: h2, maxHp: h2 }]; g.risen = true; }
    K.log(kind === 'skeleton' ? `The ${K.mstat(m).name} raises its hands, and the dead climb out of the floor to guard it!`
      : `A ${b.name.toLowerCase()} rises out of the Heart's light to guard the ${K.mstat(m).name}'s rite!`, 'bad');
    K.learn(m.id, 'trick');
    Sound.play('raise', K.heard({ x, y }));
  }
  // ---------- named champions ----------
  // One holds a floor about a third of the way down, another two thirds
  // (Dungeon.namedPlan says which, and lays each asleep in its lair). Each is
  // a kind grown great with that kind's trick sharpened, warned of and
  // answered like any other, and it pays for the fight when it falls.
  /** Who it is: "Grisk, the Goblin King". */
  const namedTitle = mb => `${mb.named.called}, the ${mb.name}`;
  /** The named champion still standing on a floor, if one is. @param {import('./types.js').Level} L */
  const namedOn = L => L.monsters.find(m => MONSTERS[m.id].named) || null;
  /** Coming down onto its floor: one line, so the fight is chosen, not sprung. */
  function namedArrives(L) {
    const m = namedOn(L);
    // said the first time down to its floor, not on every trip back
    if (m && !L.namedSaid) { L.namedSaid = true; K.log(MONSTERS[m.id].named.arrive, 'bad'); }
  }
  /** It wakes: its line, and the low sting the deep gives when it takes notice. */
  function namedWakes(m, mb) {
    m.spoke = true;
    K.log(mb.named.wake, 'bad');
    K.meet(m);
    Sound.play('dread');
    K.fx.shakeAmp = 3; K.fx.shakeMs = 400; K.fx.shakeUntil = K.realNow + 400;
  }
  /** The two tricks no plain kind has: the Goblin King's horn and the Abbess's thirst. Returns the warning, or '' when it is not the moment. */
  function namedTrick(m, mb, mv, adjacent) {
    // hurt past half, he calls his kin; twice at most, and a call cut short is spent
    if (mv === 'rally' && m.hp < m.maxHp / 2 && (m.rallies || 0) < 2) {
      m.rallies = (m.rallies || 0) + 1;
      return `The ${mb.name} puts a war-horn to his lips to call his kin! Strike him before he sounds it!`;
    }
    if (mv === 'drink' && adjacent && (m.blows || 0) >= 2) return `The ${mb.name} reaches into your chest with a cold hand, to drink! Step back!`;
    return '';
  }
  /** The horn sounds, or the hand closes. @param {number} dist  steps between it and the hero */
  function namedResolve(m, mb, mv, dist) {
    const p = K.P();
    if (mv === 'rally') {
      Sound.play('horn', K.heard(m));
      const spot = spotNear(m), [kind, n] = mb.named.call;
      if (spot) {
        const b = MONSTERS[kind], hp = () => Dice.dice(b.hp[0], b.hp[1], b.hp[2]) + Math.floor((K.G.depth - 1) / 2);
        const g = K.newMonster(kind, spot[0], spot[1], hp());
        // the ones behind it as sturdy as newMonster made the one in front
        const f = K.diff().hp * (1 + K.PRESS_HP * (K.lvl().press || 0));
        if (n > 1) g.pack = Array.from({ length: n - 1 }, () => { const h = Math.max(1, Math.round(hp() * f)); return { hp: h, maxHp: h }; });
        K.log(`The horn blares! ${n > 1 ? `${K.cap(b.name.toLowerCase())}s come` : `A ${b.name.toLowerCase()} comes`} running to their king.`, 'bad');
      } else K.log('The horn blares, but there is no room for anyone to come.', 'bad');
      K.learn(m.id, 'trick');
      m.moveReady = K.G.t + 5000;
      m.nextAct = K.G.t + Math.round(mb.speed * 0.6);
      return;
    }
    // her thirst: a sure blow, and what it takes she keeps
    if (dist === 1) {
      if (monsterAttack(m, { verb: 'drinks from', sure: true }) && K.G.status === 'playing') {
        const c = K.hasPower('ward') ? null : K.trickSave('wis', 'drink');
        if (!c) K.log(`Your ward holds: the ${mb.name}'s hand comes away empty.`, 'good');
        else if (c.pass) K.log(`Your will holds against the ${mb.name}'s thirst.${c.note}`, 'good');
        else {
          const n = Math.min(3, Math.max(0, p.maxHp - 10)), back = Math.min(m.maxHp - m.hp, 3 * n);
          p.maxHp -= n; p.hp = Math.min(p.hp, p.maxHp); m.hp += back;
          if (back) K.floatText(m, '+' + back, '#c080ff');
          K.log(`The ${mb.name} drinks deep: ${n} of your maximum hit points ${n === 1 ? 'is' : 'are'} gone for good${back ? `, and her wounds close (+${back})` : ''}.${c.note}`, 'bad');
          K.emit('stats');
        }
      }
      K.G.blowGate = K.G.t + K.BLOW_GAP;
    } else { K.log(`The ${mb.name}'s hand closes on the air where you stood, and leaves her open.`, 'good'); K.learn(m.id, 'answer'); K.opening(m); }
    m.nextAct = K.G.t + mb.speed;
  }
  /** A named troll's wounds close where you can see them, and the log says what stops them, once. */
  function namedMends(m, mb) {
    K.floatText(m, '+' + mb.regen, '#80e060');
    if (!m.mendSaid && K.G.met && K.G.met[m.uid]) { m.mendSaid = true; K.log(`The ${mb.name}'s wounds close as you watch. Fire would stop them.`, 'bad'); }
  }
  /** It falls: its line, a shake and a fanfare, and the spoils. */
  function namedFalls(m, mb) {
    // its fall was said with the kill (memberDown)
    K.fx.shakeAmp = 5; K.fx.shakeMs = 600; K.fx.shakeUntil = K.realNow + 600;
    Sound.play('namedfall', K.heard(m));
    K.learn(m.id, 'answer');     // beaten: its trick and the answer go in the bestiary
    namedSpoils(m);
  }
  /**
   * What a named champion leaves where it falls: the next relic the traders
   * were keeping for this hero (so no trader shows it later), or, once they
   * have none left, a +2 piece the hero can use and a purse of gold.
   */
  function namedSpoils(m) {
    const L = K.lvl(), k = K.key(m.x, m.y), R = K.G.relics;
    const drop = it => { (L.items[k] = L.items[k] || []).push(it); return it; };
    const most = 2 + Math.floor(K.G.depth / 2);
    // and a champion wears something worth taking off it: a ring or an amulet,
    // never cursed, and finely made where that counts (what it is, you find out)
    const jewels = Object.keys(ITEMS).filter(id => K.isJewel({ t: id }) && ITEMS[id].tier <= most);
    const jewel = () => {
      if (!jewels.length) return;
      const id = Dice.pick(jewels), it = drop({ t: id, q: 1, e: ITEMS[id].bonus ? 1 : 0 });
      const name = K.itemName(it);
      K.log(`${/^[AEIOU]/.test(name) ? 'An' : 'A'} ${name} glints among its things.`, 'good');
    };
    if (R && R.offered < R.shop.length) {
      const it = drop(K.relicItem(R.shop[R.offered++]));
      K.log(`Something fine lies where it fell: ${K.the(it)}.`, 'good');
      jewel();
      return;
    }
    const p = K.P(), c = K.cls();
    const fits = id => {
      const b = ITEMS[id];
      if (b.kind === 'weapon') return b.cls.includes(p.cls);
      if (b.kind === 'armor') return armorFits(c, b);
      return b.kind === 'shield' && shieldFits(c, b);
    };
    // the rarest robe and focus stay a find of the deepest floors, not a champion's gift
    const rare = id => ITEMS[id].tier >= 5 && (!!ITEMS[id].focus || ITEMS[id].weight === 'cloth');
    const best = Object.keys(ITEMS).filter(id => ITEMS[id].tier && ITEMS[id].tier <= most && fits(id) && !rare(id)).sort((a, b) => ITEMS[b].tier - ITEMS[a].tier).slice(0, 4);
    const pick = Dice.pick(best);
    const it = drop({ t: pick, q: 1, e: ITEMS[pick].focus ? 0 : 2 });   // a focus's make is in what it does, not a number
    drop({ t: 'gold', q: 40 * K.G.depth });
    K.log(`Where it fell lie ${K.the(it)} and a heavy purse.`, 'good');
    jewel();
  }
  /** The named champion whose life runs along the top of the view: awake, and close. */
  function namedBar(L) {
    const p = K.P();
    let best = null, bd = 9;
    for (const m of L.monsters) {
      const dd = Math.abs(m.x - p.x) + Math.abs(m.y - p.y);
      if ((MONSTERS[m.id].named || m.shade) && m.awake && m.spoke && dd < bd) { best = m; bd = dd; }
    }
    return best;
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
    speaks(m, mb);
    if (m.collapsed) { rises(m, mb); return; }
    if (!burnsAndMends(m, mb, L)) return;
    // the Warlord comes down from his throne once no one holds it for him
    if (m.throne && (G.t >= m.wardUntil || !L.monsters.some(o => o.bearer === m.uid))) leaveThrone(m);
    if (G.t < m.nextAct) return;
    // caught in fire, the living get out of it before anything else (a blow already drawn back still falls)
    if (!m.windup && !m.volley && fiery(m.x, m.y) && fearsFire(mb) && escapesFire(m, mb, L, p)) return;
    // wrapped in shadow, the lich gathers itself and leaves the fighting to its guards
    // (the Warlord on his throne fights on from it, but does not leave it)
    if (m.wardUntil > G.t && mb.boss && !m.throne) { m.nextAct = m.wardUntil; return; }
    const di = K.distField[m.y * L.w + m.x];
    if (!m.awake) { stirs(m, mb, L, p, di); return; }
    if (di < 0 || di > 12) { losesYou(m, mb); return; }
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
    if (m.windup && m.windup.move) { resolveMove(m, mb, m.windup); return G.status !== 'playing' ? STOP : undefined; }
    // on his throne the Warlord only throws: his shield-bearers do the close work
    if (m.throne && adjacent) { m.windup = null; m.nextAct = G.t + 400; return; }
    if (!m.windup && startMove(m, mb, adjacent)) return;
    if (m.windup) return strikes(m, mb, adjacent, shot);
    if (adjacent || shot) {
      // (the Warlord throws from his throne only now and then: he cannot be hurt up there, and a
      // spear every blow's worth of time from where no blade reaches was most of the fight)
      const cycle = shot && !adjacent ? mb.speed * (m.throne ? 2.6 : 1.3) : mb.speed;
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
      if (m.id === 'warlord') K.log('A great goblin in a crown of hammered gold heaves himself up from a heap of plunder, the Heart glowing among it. "Grisk was my sister\'s boy. You will make me a fine footstool."', 'bad');
      else K.log(`A cold voice fills the hall: "Another thief, come for my Heart. Stay, then. Stay for ever."`, 'bad');
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
        K.damageMonster(m, dot.kind === 'venom' ? d(1, 3) : dot.kind === 'bleed' ? d(1, dot.die || 4) : K.elemental(m, d(1, dot.die || 4), 'fire'), dot.kind);
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
      if (Math.random() < 0.3) wander(m);
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
    if (di >= 0 && di <= notice && !(p.smokeUntil > G.t)) {
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
    if (!(p.smokeUntil > G.t) && Math.random() < 0.25) wander(m);
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
    if (Math.random() < 0.5) wander(m);
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
    if (Math.random() < 0.3) wander(m);
    m.nextAct = G.t + mb.speed * 1.5;
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
      if (!inReach) { K.log(`The rest of the ${mb.name}s swing at the air where you stood.`, 'good'); m.pressing = true; }
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
    if (w.kind === 'melee') m.blows = (m.blows || 0) + 1;
    if (inReach) {
      if (follow && follow.lunge) { moveMonster(m, follow.x, follow.y); G.lunges = (G.lunges || 0) + 1; }
      if (w.kind === 'melee') monsterAttack(m, undefined, follow ? follow.verb : undefined, follow ? follow.miss : undefined); else rangedAttack(m);
      G.blowGate = G.t + K.BLOW_GAP;
      if (G.status !== 'playing') return STOP;
      // a group draws back together and swings as a volley: one warning,
      // every member's blow, the same blows a minute as swinging in turn
      if (w.kind === 'melee' && K.packSize(m) > 1) {
        m.volley = { kind: 'melee', left: K.packSize(m) - 1, next: w.at + cycle };
        m.nextAct = G.t + K.BLOW_GAP;
        return;
      }
    } else {
      K.log(w.kind === 'melee' ? `The ${mb.name} swings at the air where you stood.` : `The ${mb.name}'s shot flies wide as you move.`, 'good');
      Sound.play('whiff', K.heard(m));
      // made to miss, it presses in: the next blow is drawn back faster, so
      // stepping away is a save, not a loop that keeps it from ever landing
      m.pressing = true;
      m.lungeAt = K.realNow;               // it still swings, at nothing
      if (w.kind === 'melee') { K.riposte(); K.tricksterOpening(m); }
    }
    m.nextAct = G.t + Math.max(120, cycle - (w.until - w.at));
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

  return { RISE_MS, WAKE_BEAT, updateMonsters, beginWindup, bossFalls, breaksBones, burnWeb, ensureDist, hasLineToPlayer, meetDoor, monsterAttack, moveMonster, moveOnHurt, sporesOn, surface, namedArrives, namedBar, namedFalls, namedMends, namedTitle, namedWakes, poisonFor, rangedAttack, resolveMove, startMove, wander, windupFor };
}
