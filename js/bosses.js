import { ITEMS, MONSTERS, armorFits, shieldFits } from './data.js';
import { Dice } from './rng.js';
import { Sound } from './sound.js';

// The monsters that fight as no other does: the lich's three acts, the Heartforged's, the
// Goblin Warlord's throne and drum, and the named champions. Split out of foes.js; what they
// need of the game, and of the ordinary monsters' rules (a line to the hero, a blow), comes
// through K.

/**
 * @param {import('./types.js').Kit} K  what the game lends: its state and the rules the rest of it keeps
 */
export function makeBosses(K) {
  const ensureDist = (/** @type {any[]} */ ...a) => K.ensureDist(...a);
  const hasLineToPlayer = (/** @type {any[]} */ ...a) => K.hasLineToPlayer(...a);
  const monsterAttack = (/** @type {any[]} */ ...a) => K.monsterAttack(...a);
  const WARD_MS = 4000;     // how long the lich stays wrapped in shadow when its fight turns
  const THRONE_MS = 15000;  // the longest the Warlord sits his throne, shield-bearers or none
  const WARBAND = ['goblin', 'orc', 'archer'];   // who comes running to the Warlord's drum
  // ---------- the lich ----------
  // Three fights in one. At first it stands and drains, and gathers its storm
  // of cold fire. At two thirds it calls up guards, comes apart into shadow
  // and gathers itself again a few steps off, throwing grave-cold at you over
  // their heads. At one third it calls up more, and a wraith with them, puts
  // out every torch in its hall, quickens, and tries to drink the Heart's light to mend itself.
  function bossTurns(m) {
    if (m.id === 'warlord') { warlordTurns(m); return; }
    if (m.id === 'heartforged') { forgeTurns(m); return; }
    const mb = MONSTERS[m.id];
    // its own hall, remembered before it moves: the torches it puts out are these
    if (!m.hall) m.hall = roomOf(m);
    raiseGuards(m);
    // the last act calls the rite's own guard at once: a wraith, cold as its master
    if (m.phase === 2) raiseGuards(m, riteGuard(), true);
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
  // ---------- the Heartforged ----------
  // The Long Delve's last fight. It stamps fire down its four lines; at two
  // thirds it tears open the furnace in its chest and two emberlings climb out
  // of it; at one third it glows white: quicker, its lines longer, and it
  // stamps as often as it can (each one that misses leaves it open longer).
  function forgeTurns(m) {
    const mb = MONSTERS[m.id];
    m.windup = null; m.volley = null;
    if (m.phase === 1) {
      let n = 0;
      for (let i = 0; i < 2; i++) {
        const spot = spotNear(m);
        if (!spot) break;
        const b = MONSTERS.emberling;
        const e = K.newMonster('emberling', spot[0], spot[1], Dice.dice(b.hp[0], b.hp[1], b.hp[2]) + Math.floor(K.G.depth / 2));
        e.awake = true; e.ember = m.uid;
        K.flame(spot[0], spot[1]);
        n++;
      }
      K.log(`The ${mb.name} tears open the furnace in its chest. ${n > 1 ? 'Two embers climb' : n ? 'An ember climbs' : 'Embers spill'} out of it${n ? ' and stand up burning' : ' and gutter on the stone'}!`, 'bad');
      K.learn(m.id, 'trick');
      // and its hall's floor splits, the cracks flaring as a smouldering floor's do (lairs.js)
      K.lairs.forgeCracks(m);
      m.nextAct = K.G.t + 800;
    } else if (m.phase === 2) {
      m.moveReady = 0;
      K.log(`The ${mb.name}'s iron glows white with the Heart's own fire. It comes on quicker now, and its fire runs further.`, 'bad');
      m.nextAct = K.G.t + 700;
    }
    K.fx.shakeAmp = 5; K.fx.shakeMs = 500; K.fx.shakeUntil = K.realNow + 500;
    Sound.play('roar', K.heard(m));
  }
  /** The Heartforged's fire goes out: it falls apart into slag, and the embers it let out gutter with it. */
  function forgeFalls(m) {
    K.fx.shakeAmp = 8; K.fx.shakeMs = 1000; K.fx.shakeUntil = K.realNow + 1000;
    Sound.play('namedfall', K.heard(m));
    const L = K.lvl();
    // the cracks it split in the floor cool with it
    if (L.forgeVents) { L.forgeVents = false; L.vents = []; }
    const embers = L.monsters.filter(o => o.ember === m.uid);
    for (const e of embers) { K.spray(e, 'spark', 1, false); L.monsters.splice(L.monsters.indexOf(e), 1); }
    K.log(`The fire in the ${MONSTERS[m.id].name}'s chest gutters and goes out. The great iron shape groans, and falls apart into cooling slag${embers.length ? ', and the embers it let out gutter with it' : ''}.`, 'good');
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
    const f = K.diff().hp * K.shortNormal() * (1 + K.PRESS_HP * (K.lvl().press || 0));
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
    for (const o of L.monsters) if (WARBAND.includes(o.id)) { o.fleeing = true; o.awake = true; o.windup = null; o.volley = null; ran++; }
    const k = K.key(m.x, m.y);
    (L.items[k] = L.items[k] || []).push({ t: 'gold', q: Dice.int(20, 30) * K.G.depth });
    K.log(`The ${MONSTERS[m.id].name} crashes down among his plunder${ran ? ', and his warband breaks and scatters into the Warrens' : ''}.`, 'good');
  }
  /** The lich's end: its bones burst apart, its cold light goes up, and the torches catch again. */
  function bossFalls(m) {
    if (m.id === 'warlord') { warlordFalls(m); return; }
    if (m.id === 'heartforged') { forgeFalls(m); return; }
    K.spray(m, 'bone', 1, false); K.spray(m, 'bone', 1, false); K.spray(m, 'ecto', 1, false);
    relightTorches(m);
    K.fx.shakeAmp = 7; K.fx.shakeMs = 900; K.fx.shakeUntil = K.realNow + 900;
    Sound.play('lichfall', K.heard(m));
    K.log('The torches catch again, one by one.', 'good');
  }
  /** A wraith the lich's rite called is still standing. */
  const L0guard = m => K.lvl().monsters.some(o => o.riteCalled);
  // a lesser lich, keeping the Heart at the foot of a quick delve, has not the
  // strength to call a wraith: one of the dead stands for its rite (a wraith,
  // hard to hit and quick to follow, killed a thief of the fourth level in
  // three of the quick delves it lost)
  const riteGuard = () => (K.quick() ? 'skeleton' : 'wraith');
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
  function raiseGuards(m, kind = 'skeleton', called = false) {
    const spot = spotNear(m);
    if (!spot) return;
    const [x, y] = spot;
    const b = MONSTERS[kind], hp = () => Dice.dice(b.hp[0], b.hp[1], b.hp[2]);
    const g = K.newMonster(kind, x, y, hp());
    if (called) g.riteCalled = true;
    // (a lesser lich, at the foot of a quick delve, has the strength for one of the dead, not two:
    // two at a time killed more of the fighters and thieves who reached it than it did itself)
    else { if (!K.quick()) { const h2 = hp(); g.pack = [{ hp: h2, maxHp: h2 }]; } g.risen = true; }
    K.log(!called ? `The ${K.mstat(m).name} raises its hands, and the dead climb out of the floor to guard it!`
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
    // it leads with its trick, the trick's own warning saying so when it comes (lairs.js)
    K.lairs.opener(m, mb);
    K.meet(m);
    Sound.play('dread');
    K.fx.shakeAmp = 3; K.fx.shakeMs = 400; K.fx.shakeUntil = K.realNow + 400;
  }
  /** The two tricks no plain kind has: the Goblin King's horn and the Abbess's thirst. Returns the warning, or '' when it is not the moment. */
  function namedTrick(m, mb, mv, adjacent) {
    // hurt past half, he calls his kin; twice at most, and a call cut short is spent
    // (or at once, as he wakes: his horn is how he leads, see lairs.js)
    if (mv === 'rally' && (m.hp < m.maxHp / 2 || K.lairs.leads(m)) && (m.rallies || 0) < 2) {
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
        const f = K.diff().hp * K.shortNormal() * (1 + K.PRESS_HP * (K.lvl().press || 0));
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
    const jewels = Object.keys(ITEMS).filter(id => K.isJewel({ t: id }) && ITEMS[id].tier <= most && !ITEMS[id].cursed);
    const jewel = () => {
      if (!jewels.length) return;
      const id = Dice.pick(jewels), it = drop({ t: id, q: 1, e: ITEMS[id].bonus ? 1 : 0 });
      const name = K.itemName(it);
      K.log(`${/^[AEIOU]/.test(name) ? 'An' : 'A'} ${name} glints among its things.`, 'good');
    };
    if (R && K.shelfHolds(K.G.depth)) {
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
  return { L0guard, bossFalls, bossTurns, leaveThrone, namedArrives, namedBar, namedFalls, namedMends, namedResolve, namedTitle, namedTrick, namedWakes, raiseGuards, riteGuard, warband, warbandThin };
}
