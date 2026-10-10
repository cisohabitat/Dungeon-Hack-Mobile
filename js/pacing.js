// How hard the delve is, and how it paces itself: resting, what each difficulty
// and length of run does to the creatures, and how the deep floors answer a
// hero's strength. What it borrows from the game comes through K, read live.
import { ELITES, MONSTERS, THEMES } from './data.js';
import { Dungeon } from './dungeon.js';
import { twistRelic } from './relics.js';
import { Dice, Rng } from './rng.js';
import { Sound } from './sound.js';

/** @param {any} K */
export function makePacing(K) {
  const DIRS = K.DIRS;
  const T = K.T;
  const companion = K.companion;
  const P = (/** @type {any[]} */ ...a) => K.P(...a);
  const WAKE_BEAT = K.WAKE_BEAT;
  const bargained = (/** @type {any[]} */ ...a) => K.bargained(...a);
  const emit = (/** @type {any[]} */ ...a) => K.emit(...a);
  const enemiesNear = (/** @type {any[]} */ ...a) => K.enemiesNear(...a);
  const ensureDist = (/** @type {any[]} */ ...a) => K.ensureDist(...a);
  const hasTalent = (/** @type {any[]} */ ...a) => K.hasTalent(...a);
  const key = (/** @type {any[]} */ ...a) => K.key(...a);
  const layRelic = (/** @type {any[]} */ ...a) => K.layRelic(...a);
  const log = (/** @type {any[]} */ ...a) => K.log(...a);
  const lvl = (/** @type {any[]} */ ...a) => K.lvl(...a);
  const monsterAt = (/** @type {any[]} */ ...a) => K.monsterAt(...a);
  const noteHealed = (/** @type {any[]} */ ...a) => K.noteHealed(...a);
  const npcAt = (/** @type {any[]} */ ...a) => K.npcAt(...a);
  const passable = (/** @type {any[]} */ ...a) => K.passable(...a);
  const vowed = (/** @type {any[]} */ ...a) => K.vowed(...a);
  const climbed = (/** @type {any[]} */ ...a) => K.climbed(...a);
  const wander = (/** @type {any[]} */ ...a) => K.wander(...a);

  // ---------- resting ----------
  // A rest is not free. The first on a floor restores everything; each after
  // it on the same floor does half as much as the one before, and the dark
  // grows restless: a later rest may be cut short by something that has found
  // you, and after three there is no more sleep to be had on that floor. Out of a fight, wounds close by themselves only up to half the hero's
  // life; the rest of the way is a rest, a draught or a prayer. Life becomes a
  // thing to spend, so a floor's fights add up instead of each starting fresh.
  const REST_FOOD = 6;
  const AMBUSH_STEP = 0.3, AMBUSH_MOST = 0.75;
  const REGEN_CAP = 0.5;
  const HEARTSWORN_CAP = 0.6;   // the Heartsworn mend a little further on their own
  /**
   * What the next rest on this floor gives back: each restores less than the
   * last, all, then half, then a quarter (on Hard, two only). Field Craft, a
   * ranger's: the second rest on a floor is as good and as quiet as the first,
   * and the thinning comes a rest later. (It used to add a third to a rest, but the first on a floor
   * already heals everything, and most heroes rest about once a floor.)
   */
  function restShare() { const n = Math.max(0, (lvl().rests || 0) - (hasTalent('field_craft') ? 1 : 0)), r = climbed(1) ? [1] : diff().rests; return n >= r.length ? 0 : r[n]; }
  /** Something of this floor finds the sleeper: awake, a few steps off. */
  function ambush() {
    const L = lvl();
    ensureDist();
    const cands = [];
    for (let i = 0; i < L.w * L.h; i++) {
      const dd = K.distField[i];
      if (L.tiles[i] !== T.FLOOR || dd < 3 || dd > 7) continue;
      const x = i % L.w, y = (i / L.w) | 0;
      if (!monsterAt(x, y) && !npcAt(x, y) && !companion.at(x, y)) cands.push([x, y]);
    }
    if (!cands.length) return false;
    // what finds the sleeper is what lives on this floor: the same stretched tiers
    const td = Dungeon.tierAt(K.G.depth, K.G.opts.levels || 8);
    // (on a people's floor, one of them)
    const pool = THEMES[lvl().theme] && THEMES[lvl().theme].people ? Dungeon.PEOPLES[THEMES[lvl().theme].people].kin.map(([k]) => k)
      : Object.keys(MONSTERS).filter(id => !MONSTERS[id].boss && !MONSTERS[id].named && !MONSTERS[id].shade && td >= MONSTERS[id].tier[0] && td <= MONSTERS[id].tier[1]);
    const id = pool.length ? Dice.pick(pool) : 'goblin', b = MONSTERS[id];
    const [x, y] = Dice.pick(cands);
    newMonster(id, x, y, Dice.dice(b.hp[0], b.hp[1], b.hp[2])).nextAct = K.G.t + 1500;
    return true;
  }
  function rest() {
    const p = P(), L = lvl();
    if (vowed('iron')) { log('You swore the Iron Vow: no rest until the Heart is won.', 'bad'); Sound.play('error'); return false; }
    ensureDist();
    if (enemiesNear()) { log('You cannot rest with enemies close by.', 'bad'); Sound.play('error'); return false; }
    // a hurt hound is reason enough to stop: it heals by the same rest
    const hound = companion.here();
    if (p.hp >= p.maxHp && p.sp >= p.maxSp && !(hound && hound.hp < hound.maxHp)) { log('You are already well rested.'); return false; }
    // the Returned sleep their first rest on a floor on nothing
    const food = p.bg === 'returned' && !(L.rests || 0) ? 0 : REST_FOOD;
    if (p.food < food) { log('You are too hungry to rest.', 'bad'); Sound.play('error'); return false; }
    if (!restShare()) { log(`The dark is too close here to sleep again. ${lvl().isFinal ? 'Finish what you came for.' : 'Find the stairs.'}`, 'bad'); Sound.play('error'); return false; }
    p.food -= food;
    const before = L.rests || 0;
    let share = restShare();
    L.rests = before + 1;
    // the first rest on a floor is quiet (the first two, with Field Craft); after it, each is more likely to be found
    const quiet = hasTalent('field_craft') ? 1 : 0;
    const found = before > quiet && Math.random() < Math.min(AMBUSH_MOST, (before - quiet) * AMBUSH_STEP);
    if (found) share /= 2;
    const hp = Math.min(p.maxHp - p.hp, Math.ceil(p.maxHp * share)), sp = Math.min(p.maxSp - p.sp, Math.ceil(p.maxSp * share));
    noteHealed(hp);
    p.hp += hp; p.sp += sp;
    companion.rested(share);
    K.G.t += found ? 20000 : 60000;
    for (const m of L.monsters) { for (let i = 0; i < 3; i++) if (!m.awake) wander(m); m.nextAct = K.G.t + 300; }
    const woke = found && ambush();
    // (a hero already whole, resting for the hound's sake, gained nothing to count)
    const gained = hp ? ` (+${hp})` : '';
    if (woke) log(`You wake to something moving in the dark!${gained}`, 'bad');
    else if (share >= 1) log('You rest for a while and wake refreshed.', 'good');
    else log(`You rest, but sleep comes thinly here${gained}. The dark is stirring.`, 'info');
    Sound.play(woke ? 'ambush' : 'rest');
    emit('stats');
    return true;
  }

  // ---------- how hard the delve is ----------
  // Chosen when the hero is made. Normal is the delve as meant: its creatures
  // are sturdier and hit a little surer and harder than they are drawn. Easy
  // is the delve as drawn, with more lying about, and never grows the deep to
  // meet a strong hero. Hard makes everything sturdier and surer still, the
  // lich at full strength, and allows only two rests on a floor.
  // The lich is the delve's last fight and should feel it: it killed fewer
  // than one hero in thirty who reached it, the last floor's deaths coming
  // from its ordinary creatures on the way. So on Normal and Hard it hits
  // surer and harder than the floor's edge alone (lichEdge), and its floor
  // holds a quarter fewer of the rest (dungeon.js).
  const DIFFICULTY = {
    easy:   { hp: 1,    edge: 0, lich: 1,    lichEdge: 0, rests: [1, 0.5, 0.25], press: false },
    normal: { hp: 1.5,  edge: 1, lich: 2,    lichEdge: 4, rests: [1, 0.5, 0.25], press: true },
    hard:   { hp: 1.9,  edge: 2, lich: 2.3,  lichEdge: 3, rests: [1, 0.5],       press: true },
  };
  /** The run's difficulty settings; a run from before there was a choice is Normal. */
  const diff = () => DIFFICULTY[(K.G && K.G.opts && K.G.opts.difficulty) || 'normal'] || DIFFICULTY.normal;
  // the first floor is where a hero learns: its creatures hit a step softer. On Hard
  // the second and third keep that step too: a quarter of Hard's fighters and clerics
  // died there before they had a path, so it comes from the fourth floor, paid for
  // with sturdier creatures (1.8, not 1.7) all the way down. (1.9 since oils, charms,
  // capstones and traders' jobs lifted Hard to about three in five: back to the high fifties.)
  const diffEdge = () => Math.max(0, diff().edge - (K.G.depth <= 1 || (diff().edge > 1 && K.G.depth <= 3) ? 1 : 0)) + longEdge() + (climbed(3) ? 1 : 0);
  // The Long Delve's back half: its creatures a step surer from the seventh
  // floor, and a little sturdier with every floor past the sixth. Without it
  // twelve floors were easier than eight (82% on Normal, 60% on Hard): the
  // extra floors gave more levels and gear than the deep took back.
  const isLong = () => (K.G.opts.levels || 8) >= 12;
  // A quick delve: two floors, over in a quarter of an hour (see tierAt in
  // dungeon.js). Two floors at the pace of eight brought the hero to the lich
  // at the second or third level, and half of them died there: so the hero
  // learns three times as fast, reaching a path in a good delve, and the lich,
  // not yet come into its strength, has three tenths of its life and strikes
  // four steps less surely (and calls no wraith: see riteGuard in foes.js).
  // About nine in ten won on Normal, the thief three in four; twice as fast
  // left the thief at 58% and the mage at 92%.
  const isQuick = () => (K.G.opts.levels || 8) <= 2;
  const QUICK = { keeperHp: 0.3, keeperEdge: -4, xp: 3 };
  const longEdge = () => (isLong() && K.G.depth >= 7 ? 1 : 0);
  const longSturdier = depth => (isLong() ? 1 + 0.04 * Math.max(0, depth - 6) : 1);
  // The deep floors' own monsters answer so well to a player who reads the
  // bestiary that an ordinary Normal delve grew kinder (78% wins, tuned to
  // about three in four): its creatures are a touch sturdier to make up for
  // it. Not the Long Delve's, whose figure did not move.
  // (1.11 since the thief, the ranger and the druid were lifted on the shorter delves and Normal
  // there came to 82%, Hard to 60%: back toward 79% and 57.5%, and Hard 1.05 for the same reason)
  const NORMAL_SHORT = 1.11, HARD_SHORT = 1.05;
  const shortNormal = () => (isLong() ? 1 : (K.G.opts.difficulty || 'normal') === 'normal' ? NORMAL_SHORT : K.G.opts.difficulty === 'hard' ? HARD_SHORT : 1);
  // On Hard the Long Delve's deep floors hold creatures nearly twice as sturdy,
  // and a spell's dice do not grow with gear as a blow does: the casters fell
  // to them half again as often as anyone (28% and 34% wins, the rest 47% to
  // 57%). So there, from the seventh floor, spells strike and heal 6% harder a
  // floor, and a cleric's blows with them, the god's answer as deep as the prayer.
  // (The mage's 4% on twelve floors: once the bot stopped casting at shut mimics
  // it led there by three points at 6%, 68% over two seed sets, and 4% gave 63%.
  // Sixteen floors keep 6%, for the dark elves and the grey dwarves ride spells out.)
  // A sixteen-floor delve goes four floors deeper than any other, on every
  // difficulty, and there the casters fell where nobody else did: on Normal the
  // mage and the druid won 66% and 63%, the thief 86%, nearly all of the
  // difference lost on the thirteenth floor and below. So past the twelfth,
  // spells strike and heal 6% harder a floor there too (the mage 73%, the cleric
  // 74% to 81%).
  const deepMagic = () => {
    if (!isLong()) return 1;
    if (K.G.opts.difficulty === 'hard') return K.G.depth >= 7 ? 1 + (P().cls === 'mage' && K.G.opts.levels < 16 ? 0.04 : 0.06) * (K.G.depth - 6) : 1;
    const from = deepFrom();
    return (K.G.opts.levels || 8) >= 16 && K.G.depth > from ? 1 + 0.06 * (K.G.depth - from) : 1;
  };
  // Below which floor of sixteen, on Normal or Easy, the deep lifts a hero's spells and blows: the
  // twelfth, and for the three left last there (the fighter, the mage and the druid, 70% to 73% where
  // the rest won 81% and more) the tenth
  const LIFTED_EARLY = ['fighter', 'mage', 'druid'];
  const deepFrom = () => (LIFTED_EARLY.includes(P().cls) ? 10 : 12);
  // And the fighter, whose one answer is the blow, fell behind there once the
  // casters were lifted (37% wins, the rest 40% to 59%): a fighter's blows grow
  // with the deep floors of a Hard Long Delve too, a little less than a spell.
  // The ranger then trailed the rest there by about six points over two seed
  // sets (54%, the others 57% to 65%): its shots and blows grow half as much.
  // The druid, whose spells grew with the deep but whose bear's claws did not,
  // then trailed there (50%, falling most on the ninth to eleventh floors): its
  // blows grow as a fighter's do (58% over two seed sets; half as much gave 53%).
  // On an eight-floor Hard delve the fighter was lowest too (53% over two seed
  // sets, the rest 56% to 60%), dying most on the sixth floor and to the lord
  // of the last: its blows grow there from the sixth floor on, as in the deep
  // of a Long Delve (57.5%; 7% a floor gave 62%).
  const DEEP_STEEL = 0.04, DEEP_AIM = 0.02, DEEP_CLAW = 0.04, HARD_STEEL = 0.04;
  const deepSteel = () => {
    if (!isLong()) return P().cls === 'fighter' && K.G.opts.difficulty === 'hard' && K.G.depth >= 6 ? 1 + HARD_STEEL * (K.G.depth - 5) : 1;
    const rate = P().cls === 'fighter' ? DEEP_STEEL : P().cls === 'ranger' ? DEEP_AIM : P().cls === 'druid' ? DEEP_CLAW : 0;
    // and below a sixteen-floor delve's twelfth floor, on any difficulty, a fighter's
    // blows and the bear's claws grow as they do on Hard: with the spells lifted
    // there they were left last (70% and 66%), and came to 73% and 70.5%
    if (K.G.opts.difficulty !== 'hard') return (P().cls === 'fighter' || P().cls === 'druid') && (K.G.opts.levels || 8) >= 16 && K.G.depth > deepFrom() ? 1 + rate * (K.G.depth - deepFrom()) : 1;
    return rate && K.G.depth >= 7 ? 1 + rate * (K.G.depth - 6) : 1;
  };
  /** A new floor's creatures, as sturdy as the difficulty makes them. @param {import('./types.js').Level} L */
  /**
   * What a floor's twist changes when it is first made (dungeon.js deals the
   * twists, and does the torches and the market itself): on a floor of the
   * restless dead, over half its ordinary creatures have risen as undead of
   * the depth, rolled afresh. Three others each have a creature of their own
   * grown in place of some of the floor's (each worth what it replaced, so the
   * floor pays as it would): puffcaps in the moss, the drowned sunk in the
   * black water, and on a dark floor the eyeless that hunt by sound.
   * @param {import('./types.js').Level} L
   */
  function twistLevel(L, depth) {
    if (L.twist === 'smouldering') ventLevel(L, depth);
    // a twisted floor's own relic lies on the floor furthest from the way in, where the fire has been
    { const r = twistRelic(L.twist || ''); if (r && K.G.relics && !K.G.relics.found.includes(r)) layRelic(L, r); }
    const kin = TWIST_KIN[L.twist || ''];
    if (kin) {
      const rng = new Rng(`${K.G.seed}|${kin.dice}|${depth}`), nb = MONSTERS[kin.id];
      for (const m of L.monsters) {
        const b = MONSTERS[m.id];
        if (b.boss || b.named || m.elite || m.pack || rng.next() >= kin.share) continue;
        m.worth = b.xp;
        m.id = kin.id;
        // a die more of life for every two floors down, from its own at the top
        m.maxHp = m.hp = rng.dice(nb.hp[0] + Math.floor(depth / 2), nb.hp[1], nb.hp[2]);
        // the drowned lie under the water until something comes near
        if (nb.sinks) { m.sunk = true; m.awake = false; }
      }
      return;
    }
    if (L.twist !== 'restless') return;
    const rng = new Rng(`${K.G.seed}|restless|${depth}`);
    const t = Dungeon.tierAt(depth, K.G.opts.levels || 8);
    // (not the drowned: they belong to the black water, and are never dealt by depth)
    const undead = Object.keys(MONSTERS).filter(id => MONSTERS[id].undead && !MONSTERS[id].boss && !MONSTERS[id].named && !MONSTERS[id].shade && MONSTERS[id].tier[0] < 99);
    const off = id => Math.max(0, MONSTERS[id].tier[0] - t, t - MONSTERS[id].tier[1]);
    const fit = undead.filter(id => off(id) === 0);
    const pool = fit.length ? fit : [undead.sort((a, b) => off(a) - off(b))[0]];
    for (const m of L.monsters) {
      const b = MONSTERS[m.id];
      if (b.undead || b.boss || b.named || m.pack || rng.next() >= 0.55) continue;
      m.id = rng.pick(pool);
      const nb = MONSTERS[m.id];
      m.maxHp = m.hp = rng.dice(nb.hp[0], nb.hp[1], nb.hp[2]) + Math.floor((depth - 1) / 2);
      // a champion risen keeps what made it one: its life was multiplied once
      // already, and rolling it again as a plain one left a weak champion that
      // still paid out as a strong one
      const el = m.elite && ELITES.find(x => x.prefix === m.elite);
      if (el) m.maxHp = m.hp = Math.round(m.hp * el.hp);
    }
  }
  /** Each twist's own creature, how many of a floor's it takes the place of, and the name of its dice. */
  /**
   * A smouldering floor's glowing cracks, in its rooms, from dice of their own:
   * not in the room the hero arrives in, not by a stair or a door, and not
   * where something lies or stands.
   * @param {import('./types.js').Level} L
   */
  function ventLevel(L, depth) {
    const rng = new Rng(`${K.G.seed}|vents|${depth}`);
    const ends = [L.start, L.stairsUp, L.stairsDown, L.downStart].filter(Boolean);
    const roomOf = (x, y) => (L.roomId ? L.roomId[y * L.w + x] : -1);
    const startRooms = new Set(ends.map(e => roomOf(e.x, e.y)).filter(r => r >= 0));
    const at = (x, y) => L.tiles[y * L.w + x];
    const spots = [];
    for (let i = 0; i < L.w * L.h; i++) {
      const x = i % L.w, y = (i / L.w) | 0, r = roomOf(x, y);
      if (r < 0 || startRooms.has(r) || at(x, y) !== T.FLOOR) continue;
      if (DIRS.some(([dx, dy]) => [T.DOOR, T.DOOR_OPEN, T.DOOR_LOCKED, T.SECRET, T.STAIRS_DOWN, T.STAIRS_UP, T.FOUNTAIN].includes(at(x + dx, y + dy)))) continue;
      if (ends.some(e => Math.abs(e.x - x) + Math.abs(e.y - y) <= 3) || (L.npcs || []).some(n => Math.abs(n.x - x) + Math.abs(n.y - y) <= 1) || (L.items[key(x, y)] || []).length || (L.traps || {})[key(x, y)]) continue;
      spots.push({ x, y });
    }
    const want = Math.max(5, Math.min(10, Math.round((L.rooms || []).length * 0.8)));
    L.vents = [];
    while (L.vents.length < want && spots.length) {
      const s = spots.splice(rng.int(0, spots.length - 1), 1)[0];
      // (two cracks never side by side: each flare is its own to step out of)
      if (L.vents.some(v => Math.abs(v.x - s.x) + Math.abs(v.y - s.y) <= 2)) continue;
      L.vents.push({ x: s.x, y: s.y, next: 0, heat: 0, sealedUntil: 0 });
    }
  }
  const TWIST_KIN = { smouldering: { id: 'emberling', share: 0.3, dice: 'emberlings' }, overgrown: { id: 'puffcap', share: 0.35, dice: 'puffcaps' }, flooded: { id: 'drowned', share: 0.3, dice: 'drowned' }, dark: { id: 'eyeless', share: 0.25, dice: 'eyeless' } };
  const LORD_HP = 1.25;
  function hardenLevel(L, depth) {
    const k = diff();
    for (const m of L.monsters) {
      // the first floor is where a hero learns: half the extra life there
      // the lich grows with the hero who comes for it: a tenth more life for every level past sixth
      // and the Pale One's bargain comes due on it: a third more
      // (and on the ladder's fourth rung, a champion and the last foe a quarter more again)
      const lord = (MONSTERS[m.id].boss || MONSTERS[m.id].named) && climbed(4) ? LORD_HP : 1;
      const f = (MONSTERS[m.id].boss ? k.lich * (1 + 0.1 * Math.max(0, P().level - 6)) * (bargained() ? 1.3 : 1) * (isQuick() ? QUICK.keeperHp : 1) : (depth <= 1 ? 1 + (k.hp - 1) / 2 : k.hp) * longSturdier(depth) * shortNormal());
      m.maxHp = Math.max(1, Math.round(m.maxHp * f * lord)); m.hp = m.maxHp;
      // a quick delve's keeper is a lesser lich, for a hero of a few levels: less life, and blows less sure and less heavy
      if (isQuick() && MONSTERS[m.id].boss) m.edge = QUICK.keeperEdge;
      for (const b of m.pack || []) { b.maxHp = Math.max(1, Math.round(b.maxHp * f)); b.hp = b.maxHp; }
    }
  }

  // ---------- the deep answers strength ----------
  // A hero who has out-grown a floor finds it waiting for them. For every
  // level above what a hero usually has on arriving there (past half a level
  // of grace), its creatures are sturdier, hit surer and harder, and more of
  // them are champions, the lich among them. Nothing is made easier for a hero
  // who is behind, and the pressure is set once, when the floor is first
  // entered, so it cannot be dodged by levelling on it.
  const PRESS_HP = 0.15, PRESS_CHAMPION = 0.12, PRESS_MOST = 3, PRESS_GRACE = 0.5;
  /** How much sturdier a floor's creatures are for a hero ahead of the depth, in percent. */
  const pressSturdier = L => Math.round(PRESS_HP * (L.press || 0) * 100);
  /** The level a hero usually has on arriving at a floor, measured over many runs by the bot. */
  const expectedLevel = depth => 1 + 0.8 * (depth - 1);
  /** @param {import('./types.js').Level} L @param {number} depth */
  function pressLevel(L, depth) {
    // not before the third floor: a quick start on the first two is no reason for the deep to stir
    const over = diff().press && depth >= 3 ? Math.max(0, Math.min(PRESS_MOST, P().level - expectedLevel(depth) - PRESS_GRACE)) : 0;
    L.press = Math.round(over * 10) / 10;
    if (!L.press) return;
    const tougher = n => Math.round(n * (1 + PRESS_HP * L.press));
    for (const m of L.monsters) {
      // (never a pack, as the floor's own champions never are: every member would carry the prefix and its spoils)
      if (!m.elite && !m.shade && !m.pack && !MONSTERS[m.id].boss && !MONSTERS[m.id].named && Math.random() < PRESS_CHAMPION * L.press) {
        const e = Dice.pick(ELITES);
        m.elite = e.prefix; m.maxHp = Math.round(m.maxHp * e.hp);
      }
      m.maxHp = tougher(m.maxHp); m.hp = m.maxHp;
      m.edge = Math.round(L.press);
      for (const b of m.pack || []) { b.maxHp = tougher(b.maxHp); b.hp = b.maxHp; }
    }
    // said on arrival, and shown while you are here, so it is never a hidden tax
    // said in what it means, not as a bare number
    const pct = pressSturdier(L);
    if (L.press >= 1) { log(`The deep has heard of you. What waits on this floor is ${pct}% sturdier, and more often a champion.`, 'bad'); Sound.play('dread'); }
    else if (L.press > 0) log(`You are ahead of most who come this far. The floor stirs to meet you: its creatures are ${pct}% sturdier.`, 'bad');
  }
  /** A monster that appears mid-fight, awake and already hunting. */
  function newMonster(id, x, y, hp) {
    // what comes later on a floor is as ready for the hero as what was there
    const press = lvl().press || 0;
    hp = Math.max(1, Math.round(hp * diff().hp * shortNormal() * (1 + PRESS_HP * press)));
    const m = {
      uid: 900000 + (K.G.nextUid = (K.G.nextUid || 0) + 1), id, x, y,
      hp, maxHp: hp, awake: true, nextAct: K.G.t + WAKE_BEAT, rx: x, ry: y,
      fromX: x, fromY: y, moveT0: 0, moveT1: 0, flashUntil: 0,
    };
    if (Math.round(press)) m.edge = Math.round(press);
    lvl().monsters.push(m);
    return m;
  }
  const KNOCKDOWN_MS = 900;   // how long a charge that lands leaves you on the floor
  const BLOW_GAP = 250;    // ms between any two blows landing on you

  /**
   * Whether a blow drawn at the hero still lands after they stepped away.
   * A lunger (a rat, a ghoul, a wraith) follows one step straight back into
   * the square you left; a step to the side leaves it biting air. The lich's
   * touch reaches two squares down a clear straight line.
   * @returns {{lunge?: boolean, x?: number, y?: number, verb: string, miss: string}|null}
   */
  function followBlow(m, mb, w) {
    const p = P();
    if (mb.lunge && w.px != null) {
      const dx = w.px - m.x, dy = w.py - m.y;
      const back = Math.abs(dx) + Math.abs(dy) === 1 && p.x === w.px + dx && p.y === w.py + dy;
      if (back && passable(w.px, w.py) && !monsterAt(w.px, w.py) && !npcAt(w.px, w.py) && !companion.at(w.px, w.py)) return { lunge: true, x: w.px, y: w.py, verb: 'lunges after', miss: 'lunges after you and misses' };
    }
    if ((mb.reach || 1) >= 2 && (p.x === m.x || p.y === m.y) && Math.abs(p.x - m.x) + Math.abs(p.y - m.y) === 2) {
      const mx = (p.x + m.x) / 2, my = (p.y + m.y) / 2;
      if (passable(mx, my) && !monsterAt(mx, my)) return { verb: 'reaches across and touches', miss: 'reaches across for you and misses' };
    }
    return null;
  }


  return { BLOW_GAP, HEARTSWORN_CAP, KNOCKDOWN_MS, PRESS_HP, QUICK, REGEN_CAP, deepMagic, deepSteel, diff, diffEdge, followBlow, hardenLevel, isLong, isQuick, newMonster, pressLevel, pressSturdier, rest, restShare, shortNormal, twistLevel };
}
