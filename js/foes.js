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
  function wander(m) {
    const p = K.P();
    const opts = [];
    for (const [dx, dy] of K.DIRS) {
      const nx = m.x + dx, ny = m.y + dy;
      if (K.passable(nx, ny) && !K.monsterAt(nx, ny) && !K.npcAt(nx, ny) && !(nx === p.x && ny === p.y)) opts.push([nx, ny]);
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
      if (!K.passable(x, y) || (!overHeads && (K.monsterAt(x, y) || K.npcAt(x, y)))) return null;
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
    K.hurtPlayer(dmg, `The ${mb.name} ${r.verb} you${aside} for ${dmg}.${warm ? ' (your ring keeps out the cold)' : ''}${note}`, m);
  }
  /** @param {{hit?: number, mult?: number, extra?: number[], verb?: string, sure?: boolean}} [heavy]  a trick's blow: surer and harder; a sure one was warned of, and armour does not turn it */
  function monsterAttack(m, heavy) {
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
      const onShield = p.eq.shield && roll !== 1 && roll + hit >= ac - ITEMS[p.eq.shield.t].ac - (p.eq.shield.e || 0);
      Sound.play(onShield ? 'block' : 'whiff', K.heard(m));
      const miss = K.relativeBearing(m);
      K.log(`The ${mb.name} misses you${miss && miss.rel !== 0 ? ` ${miss.word}` : ''}.${note}`, miss && miss.rel !== 0 ? 'bad' : '');
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
    K.hurtPlayer(dmg, `The ${mb.name} ${h.verb || 'hits'} you${aside} for ${dmg}.${firm ? ' (Stand Firm halves it)' : ''}${knight}${warm ? ' (your ring keeps out the cold)' : ''}${note}`, m);
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
    m.windup = { kind, at: K.G.t, until: K.G.t + dur };
    m.nextAct = m.windup.until;
    Sound.play('windup', K.heard(m, { kind }));
  }
  const WAKE_BEAT = 600;   // ms between a monster noticing you and doing anything about it

  // ---------- signature moves ----------
  // Most monsters have one trick of their own. Each is drawn back longer than
  // a plain blow, marked in violet and announced, and each has an answer:
  // step out of the ogre's smash, out of the orc's line, strike the chanting
  // acolyte, crush the skeleton's bones, burn the troll.
  const SPECIAL_MS = { crush: 900, charge: 700, web: 650, mend: 1800, nova: 1300, grab: 750, paralyse: 750, rite: 2400, gaze: 1100, rust: 800, rally: 1500, drink: 800 };
  const GAZE_MS = 1500;     // how long a basilisk's gaze leaves you stone
  // what a rustmaw's bite can find to eat: metal armour, any shield, a blade or a mace
  const RUSTS = { armor: ['studded', 'scale', 'chain', 'splint', 'plate'], weapon: id => !['staff', 'club', 'sling', 'shortbow'].includes(id) };
  const RITE_MEND = 0.2;    // the share of its life the lich takes back if its rite is let finish
  const WARD_MS = 4000;     // how long the lich stays wrapped in shadow when its fight turns
  const RISE_MS = 4500;     // a skeleton's bones lie still this long before it rises
  const HELD_MS = 1300;     // a ghoul's touch freezes you this long
  const NOVA_REACH = 2;     // the lich's cold fire reaches this far
  /** The cold fire spreads over open floor: two steps' walk, so a wall or a corner is cover. */
  function novaReaches(m) {
    ensureDist();
    const w = K.distField[m.y * K.lvl().w + m.x];
    return w >= 0 && w <= NOVA_REACH;
  }
  /** Crushing and magic keep a skeleton down; an edge only takes it apart. */
  function breaksBones(tag) {
    if (tag === 'fire' || tag === 'burn' || tag === 'burning') return true;
    if (tag === 'thorns') return false;
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
    const rite = mb.boss && (m.phase || 0) >= 2 && m.hp < m.maxHp && K.G.t >= (m.riteReady || 0);
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
    else if (mv === 'rally' || mv === 'drink') say = namedTrick(m, mb, mv, adjacent);
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
        // a door shut across its line stops it cold: it hits the door, not you
        let door = inLine ? doorInCharge(m, w) : null, x = m.x, y = m.y;
        if (door) {
          // it thunders up to the door, but not through anything standing in
          // the way: stopped short of the door, it never hits it at all
          while (Math.abs(door.x - x) + Math.abs(door.y - y) > 1) {
            const nx = x + (w.dx || 0), ny = y + (w.dy || 0);
            if (K.monsterAt(nx, ny) || K.npcAt(nx, ny)) break;
            x = nx; y = ny;
          }
          if (Math.abs(door.x - x) + Math.abs(door.y - y) > 1) door = null;
        }
        if (door) {
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
            if (!K.passable(nx, ny) || K.monsterAt(nx, ny) || K.npcAt(nx, ny) || (nx === p.x && ny === p.y)) break;
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
            if (c.pass) K.log(`The ${mb.name}'s claws numb you, but you shake it off.${c.note}`, 'good');
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
      case 'nova':
        Sound.play('nova', K.heard(m));
        if (novaReaches(m)) {
          const shielded = K.effectFrom('ac', 'shield');
          const c = K.trickSave('dex', 'nova');
          const warm = K.hasPower('warmth');
          const n = K.knightSteadfast(Math.max(1, Math.ceil(d(5, 6) / (K.hasTalent('stand_firm') ? 2 : 1) / (shielded ? 2 : 1) / (c.pass ? 2 : 1) / (warm ? 2 : 1))));
          K.hurtPlayer(n, `The storm of cold fire bursts over you for ${n}!${c.pass ? ' You turn a shoulder to the worst of it.' : ''}${shielded ? ' Your Shield takes the worst of it.' : ''}${warm ? ' Your ring keeps out the cold.' : ''}${c.note}`, m); K.G.blowGate = K.G.t + K.BLOW_GAP;
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
    const shield = p.eq.shield && !ITEMS[p.eq.shield.t].focus ? p.eq.shield : null;
    const metal = [p.eq.armor && RUSTS.armor.includes(p.eq.armor.t) ? p.eq.armor : null, shield, p.eq.weapon && RUSTS.weapon(p.eq.weapon.t) ? p.eq.weapon : null].filter(Boolean);
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
  /** What a monster's trick does when it is hurt and still standing. */
  function moveOnHurt(m, mb, tag) {
    // a numbing claw is struck aside by a blow that lands first, and leaves it
    // open: a blow or a spell, not poison or fire already eating at it
    if (m.windup && m.windup.move === 'paralyse' && !['burning', 'venom', 'thorns'].includes(tag)) {
      m.windup = null; m.moveReady = K.G.t + 3000; m.nextAct = K.G.t + 900;
      K.log(`Your blow knocks the ${mb.name}'s claw aside before it can close!`, 'good');
      K.learn(m.id, 'answer');
      K.opening(m);
    }
    // a chant is broken by any wound
    if (m.windup && m.windup.move === 'mend') {
      m.windup = null; m.moveReady = K.G.t + 3000; m.nextAct = K.G.t + 700;
      K.log(`You break the ${mb.name}'s chant!`, 'good');
      K.learn(m.id, 'answer');
    }
    // and so is a war-horn call, and a call cut short is spent
    if (m.windup && m.windup.move === 'rally') {
      m.windup = null; m.moveReady = K.G.t + 3000; m.nextAct = K.G.t + 700;
      K.log(`You cut the ${mb.name}'s call short! The horn falls from his lips.`, 'good');
      K.learn(m.id, 'answer');
    }
    // and so is the lich's rite, though it will try again
    if (m.windup && m.windup.move === 'rite') {
      m.windup = null; m.riteReady = K.G.t + 6000; m.nextAct = K.G.t + 700;
      K.log(`You break the ${mb.name}'s rite! The Heart's light slips back out of its hands.`, 'good');
      Sound.play('riteBroken', K.heard(m));
      K.learn(m.id, 'answer');
    }
    // fire sears a troll's wounds shut, so they cannot grow back for a while
    if ((tag === 'burn' || tag === 'burning') && mb.regen) {
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
  // their heads. At one third it calls up more, puts out every torch in its
  // hall, quickens, and tries to drink the Heart's light to mend itself.
  function bossTurns(m) {
    const mb = MONSTERS[m.id];
    // its own hall, remembered before it moves: the torches it puts out are these
    if (!m.hall) m.hall = roomOf(m);
    raiseGuards(m);
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
      if (dd < 3 || dd > 5 || K.tile(x, y) !== K.T.FLOOR || K.monsterAt(x, y) || K.npcAt(x, y)) continue;
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
  /** The lich's end: its bones burst apart, its cold light goes up, and the torches catch again. */
  function bossFalls(m) {
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
        if (K.tile(x, y) === K.T.FLOOR && !K.monsterAt(x, y) && !K.npcAt(x, y) && !(x === p.x && y === p.y)) spots.push([x, y]);
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
          K.log(`The ${mb.name} drinks deep: ${n} of your most health is gone for good${back ? `, and her wounds close (+${back})` : ''}.${c.note}`, 'bad');
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
      if (MONSTERS[m.id].named && m.awake && m.spoke && dd < bd) { best = m; bd = dd; }
    }
    return best;
  }



  return { RISE_MS, WAKE_BEAT, beginWindup, bossFalls, breaksBones, burnWeb, ensureDist, hasLineToPlayer, meetDoor, monsterAttack, moveMonster, moveOnHurt, namedArrives, namedBar, namedFalls, namedMends, namedTitle, namedWakes, poisonFor, rangedAttack, resolveMove, startMove, wander, windupFor };
}
