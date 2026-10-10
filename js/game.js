import { Rng, Dice, d } from './rng.js';
import { ROUTES, TWISTS, heroName, BACKGROUNDS, CLASSES, ITEMS, TRAP_TYPES, MONSTERS, SPELLS, POTION_LOOKS, SCROLL_LOOKS, RING_LOOKS, AMULET_LOOKS, ELEMENTS_TAKEN, ELITES, THEMES, VOWS, LADDER } from './data.js';
import { Dungeon } from './dungeon.js';
import { PIECE_SAY } from './rooms.js';
import { encounterPlan } from './encounters.js';
import { RELICS, GIANTS, relicPlan } from './relics.js';
import { makeTrader } from './trader.js';
import { Sound } from './sound.js';
import { Progress } from './progress.js';
import { makeFoes } from './foes.js';
import { makeCompanion } from './companion.js';
import { makeBounty } from './bounty.js';
import { makeWild } from './wild.js';
import { makeElements } from './elements.js';
import { makeEncounters } from './meet.js';
import { makeTesting } from './testing.js';
import { makePrelude } from './prelude.js';
import { makeSaving } from './saving.js';
import { makeChronicle } from './chronicle.js';
import { makePowers } from './powers.js';
import { makePacing } from './pacing.js';
import { makeMotion } from './motion.js';
import { makeCombat } from './combat.js';
import { makeItems } from './items.js';
import { makeScenes } from './scenes.js';
import { makeCurses } from './curses.js';
import { makeFallen } from './fallen.js';
import { makePaths } from './paths.js';
import { makeLegends } from './legends.js';
import { makeCombos, COMBOS } from './combos.js';
import { makeLairs } from './lairs.js';
import { makeThreads } from './threads.js';

// Core game state and rules.

const Game = (() => {
  const T = Dungeon.T;
  const DIRS = Dungeon.DIRS;
  const INV_MAX = 20;
  const SAVE_KEY = 'deepdelve.save';
  // how long a ranger's snare cord takes to fly a square (items.js throws it, powers.js casts it)
  const CORD_SQUARE = 55;
  const HALL_KEY = 'deepdelve.hall';
  // the run before this one, for a line on the title (the Hall keeps only the best twenty)
  const LAST_KEY = 'deepdelve.lastrun';
  const MOVE_MS = 220;
  const FLOOD_SLOW = 1.25;   // how much slower everything goes through a flooded floor's water
  const TURN_MS = 200;

  /** @type {import('./types.js').GameState|null} */
  let G = null;
  let distField = null, distFieldAt = -1e9;
  let realNow = 0;
  const fx = { damageUntil: 0, healUntil: 0, healAt: 0, smokeUntil: 0, /** @type {{dhp: number, dsp: number, until: number}|null} */ hold: null, swingUntil: 0, castUntil: 0, shakeUntil: 0,
               hurtFrom: -1, hurtFromUntil: 0, castColor: '#fff', texts: [], hpFrac: 1,
               /** @type {Array<{style: string, color: string, born: number, until: number, pts: Array<{x: number, y: number}>, ahead?: {x: number, y: number}, from?: {x: number, y: number}|null}>} */ spells: [],
               swingAt: -1e9, swingMs: 300, offAt: -1e9, castAt: -1e9, readAt: -1e9, readColor: '#fe8', readKind: '',
               useAt: -1e9, useKind: '', useSprite: '', useColor: '#fff',
               /** a Bash: when, and with what (shield, pommel or fist); a throw (a snare's cord, a flask): when, and which */
               bashAt: -1e9, bashKind: '', throwAt: -1e9, throwKind: '',
               /** where thrown flasks come down, when, and what lay there before, so their spill is not drawn before they land */
               /** @type {Array<{x: number, y: number, at: number, was: Object<string, string>}>} */ landings: [],
               /** a trap going off, or disarmed: which, when, and for a dart the wall it came from */
               trapAt: -1e9, trapKind: '', trapSide: 1, trapDodged: false,
               /** the fallen, sinking and fading where they fell */
               /** @type {Array<{x: number, y: number, sprite: string, elite?: string, scale: number, born: number, dx: number, dy: number, fly: number, how: string}>} */ corpses: [],
               /** @type {Object<string, {x: number, y: number, at: number, open: boolean, lock: string|null, depth: number}>} doors sliding open or shut, by square */ doors: {},
               /** @type {Object<number, {shut: number, lock: string|null}>|null} how far each moving door on this floor is shut, by tile index, for the renderer */ doorShut: null,
               /** what blows throw: droplets, bone chips, sparks, flying and falling */
               /** @type {Array<{x: number, y: number, z: number, vx: number, vy: number, vz: number, g: number, c: string, born: number, life: number, size: number, glow?: boolean}>} */ bits: [],
               /** stains on the floor, by depth; for the look of a fight, not saved */
               /** @type {Record<number, Array<{x: number, y: number, r: number, c: string, seed: number, at?: number}>>} */ stains: {},
               /** blood on the hero's own view, after a hard blow */
               /** @type {Array<{x: number, y: number, r: number, born: number, life: number}>} */ drops: [],
               shakeAmp: 4, shakeMs: 220, hurtAmt: 0.5,
               /** when the Heart was lifted, for the light that ends the run; -1 before */
               heartAt: -1,
               /** when the hero fell, for the view going dark before the end screen; -1 before */
               deadAt: -1,
               /** @type {any} */ status: null,
               /** when the hero last came onto a floor, and last rose a level, for the view */ arriveAt: -1e9, levelAt: -1e9,
               /** @type {{name: string, hp: number, maxHp: number, phase: number, rite: boolean, riteDone: number, named?: boolean, notches?: number[]}|null} */ boss: null,
               /** @type {any} */ view: null };
  /** Forget the look of the last fight: a new run or a loaded save starts clean. */
  function clearFx() {
    fxGen++;
    fx.texts = []; fx.spells = []; fx.corpses = []; fx.doors = {}; fx.bits = []; fx.stains = {}; fx.drops = []; fx.heartAt = -1; fx.deadAt = -1; fx.smokeUntil = 0; fx.landings = [];
  }
  // the phone in the hand feels the blows, a level, a death and a door forced; Vibration in the Menu turns it off
  const buzz = ms => { try { if (navigator.vibrate && localStorage.getItem('deepdelve.hapticsOff') !== '1') navigator.vibrate(ms); } catch (e) { /* ignore */ } };
  const cam = { x: 0, y: 0, angle: 0, fromX: 0, fromY: 0, fromA: 0, toX: 0, toY: 0, toA: 0, t0: 0, t1: 0, moving: false };
  const events = []; // messages for the UI layer: 'dead', 'won', 'level', 'inv', 'stats'

  const mod = s => Math.floor((s - 10) / 2);
  const key = (x, y) => x + ',' + y;
  /** @returns {import('./types.js').Level} the floor the player is standing on */
  const lvl = () => G.levels[G.depth];
  /** @returns {import('./types.js').Player} */
  const P = () => G.player;
  const cls = () => CLASSES[G.player.cls];
  /** Whether the hero swore this vow at the start of the run. */
  const vowed = v => !!(G && G.opts && Array.isArray(G.opts.vows) && G.opts.vows.includes(v));
  // the rung of the ladder past Hard this run stands on (LADDER in data.js), 0 for any other
  const rung = () => (G && G.opts && G.opts.difficulty === 'hard' && G.opts.rung) || 0;
  /** Whether this run's rung keeps the ladder's rule n: every rung keeps those below it. */
  const climbed = n => rung() >= n;

  // ---------- the dice, in the open ----------
  // Off until asked for: the classic crawlers showed their arithmetic, and
  // it is how you learn that the thing in front of you is armoured, or that
  // your own armour has stopped keeping up with what hits you. But on a first
  // run "(d20 14+5 vs AC 13)" after every blow is noise in a language nobody
  // has been taught yet, so it waits in the Menu. Kept out of the save file:
  // it is a preference, not a run.
  let showRolls = false;
  try { showRolls = localStorage.getItem('deepdelve.rolls') === 'on'; } catch (e) { /* ignore */ }
  function rollsShown() { return showRolls; }
  function toggleRolls() {
    showRolls = !showRolls;
    try { localStorage.setItem('deepdelve.rolls', showRolls ? 'on' : 'off'); } catch (e) { /* ignore */ }
    return showRolls;
  }
  /**
   * How a swing was decided, in the shorthand the old crawlers used. A fumble
   * and a telling blow ignore the arithmetic, so those say so rather than
   * printing a sum that did not decide anything.
   */
  function rollNote(roll, bonus, ac, crit) {
    if (!showRolls) return '';
    if (roll === 1) return ' (d20 1, a fumble)';
    if (crit) return ` (d20 ${roll}, a telling blow)`;
    return ` (d20 ${roll}${bonus < 0 ? '' : '+'}${bonus} vs AC ${ac})`;
  }

  // ---------- checks ----------
  // Everything outside a fight that your character is good or bad at comes
  // down to one roll: a d20 plus the stat's modifier against a difficulty. As
  // in combat a natural twenty always succeeds and a natural one always
  // fails, and the log shows the working the same way.
  const SELF_TAUGHT_MOST = 2;
  const STAT_WORD = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
  function checkNote(stat, roll, m, dc) {
    if (!showRolls) return '';
    const w = STAT_WORD[stat];
    if (roll === 1) return ` (${w} d20 1, a fumble)`;
    if (roll === 20) return ` (${w} d20 20, a triumph)`;
    return ` (${w} d20 ${roll}${m < 0 ? '' : '+'}${m} vs ${dc})`;
  }
  /** The bonus a check gets: the stat's modifier plus anything situational. */
  function checkBonus(stat, bonus = 0) { return mod(P().stats[stat]) + bonus; }
  /** How likely a check is to succeed, for showing odds before committing. */
  function checkChance(stat, dc, bonus = 0) {
    const m = checkBonus(stat, bonus);
    let n = 0;
    for (let r = 1; r <= 20; r++) if (r === 20 || (r !== 1 && r + m >= dc)) n++;
    return n / 20;
  }
  /** @param {{natural?: boolean}} [o]  natural: false, and a twenty is only a twenty (noticing what you have no eye for) */
  function statCheck(stat, dc, bonus = 0, o = {}) {
    const roll = d(1, 20), m = checkBonus(stat, bonus);
    const pass = (roll === 20 && o.natural !== false) || (roll !== 1 && roll + m >= dc);
    return { stat, dc, roll, mod: m, pass, note: checkNote(stat, roll, m, dc) };
  }
  // A foe's saving throw against a spell that fills its square or its
  // corridor. The hero's number to beat is 10, half their level and their
  // casting score's bonus; the foe's roll is a d20 and half its skill at arms
  // (the surer its blows, the quicker it is to get out of the way), two more
  // for a named champion or the Heart's keeper. A 1 always fails, a 20 always holds.
  const SAVED_SHARE = 0.75;
  const spellDC = (p = P()) => 10 + Math.floor(p.level / 2) + mod(p.stats[CLASSES[p.cls].primary] || 10);
  const saveBonus = m => { const mb = mstat(m); return Math.floor((mb.hit || 0) / 2) + (mb.named || mb.boss ? 2 : 0) + (mb.stout ? 2 : 0); };
  /** @param {import('./types.js').Monster} m @param {string} stat */
  function spellSave(m, stat) {
    const roll = d(1, 20), b = saveBonus(m), dc = spellDC();
    const pass = roll === 20 || (roll !== 1 && roll + b >= dc);
    const w = STAT_WORD[stat];
    const note = !showRolls ? '' : roll === 1 ? ` (its ${w} d20 1, a fumble)` : roll === 20 ? ` (its ${w} d20 20)` : ` (its ${w} d20 ${roll}+${b} vs ${dc})`;
    return { pass, note };
  }
  // Some deep folk were raised among spells, and a spell can slide off one of
  // them as if it had found no one there: off a dark elf warrior one time in
  // five, a mage one in four, their High Priestess one in three. It is rolled
  // before any save, a group rolling once as it saves once, and only against
  // what a spell does to a foe; it does not stop a heal, a blessing or the bear,
  // nor Entangle, whose roots are the stone's own and hold an elf as they hold
  // anyone (sliding off, they cost the bot's druid three or four points).
  /** @param {import('./types.js').Monster} m @param {{ name: string }} sp @param {boolean} [many] */
  function spellShrug(m, sp, many = false) {
    const mb = mstat(m), r = mb.spellRes || 0;
    // (on the game's own dice, so a seed's fight goes the same way twice)
    if (!r || m.collapsed || d(1, 1000) > Math.round(r * 1000)) return false;
    floatText(m, 'unharmed', '#b8a8f0');
    log(`Your ${sp.name} slides off the ${mb.name}${many ? 's' : ''} as if ${many ? 'they were' : 'it was'} not there.`);
    // (a champion's own entry: the High Priestess shrugs off more than her mages)
    learn(m.id, 'spellres');
    return true;
  }

  // ---------- messages ----------
  // The log is capped, so once it is full its length stops changing. Anything
  // watching for new messages has to count them, not measure the array.
  // A named champion goes by its title in every line written for its kind
  // ('The Orc Warchief swings at you'); the log calls it by its name instead,
  // except where the name is already given ('Grisk, the Goblin King').
  let namings = null;
  function byName(m) {
    if (!namings) namings = Object.values(MONSTERS).filter(b => b.named).map(b => {
      const who = b.named.called.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), title = b.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // the name before it, if given, is matched and kept, rather than looked
      // behind for: Safari before 16.4 cannot read a lookbehind at all
      return [new RegExp(`(${who},? )?\\b[Tt]he ${title}\\b`, 'g'), b.named.called];
    });
    for (const [re, name] of namings) if (re.test(m)) { re.lastIndex = 0; m = m.replace(re, (all, named) => (named ? all : name)); }
    return m;
  }
  function log(m, c) {
    m = byName(m);
    // the same line again straight after itself (poison, every two seconds) is
    // counted on the one line rather than filling the box. The old line is left
    // as an empty place-holder and the count written as a new line, so the log
    // still grows by one line for every line said, as anything counting it expects
    const last = liveLine();
    if (last && (last.base || last.m) === m) {
      const n = (last.n || 1) + 1;
      last.gone = true; last.m = '';
      G.log.push({ m: `${m} (\u00d7${n})`, c: c || '', base: m, n, ...(fxDelay > 0 ? { at: realNow + fxDelay } : {}) });
    } else G.log.push({ m, c: c || '', ...(fxDelay > 0 ? { at: realNow + fxDelay } : {}) });
    G.logSeq = (G.logSeq || 0) + 1;
    if (G.log.length > 80) {
      // place-holders are dropped first, all but the newest few, which anything
      // counting back from the end may still be counting
      if (G.log.some(e => e.gone)) G.log = G.log.filter((e, i, all) => !e.gone || i >= all.length - 20);
      if (G.log.length > 80) G.log.splice(0, G.log.length - 80);
    }
  }
  /** The newest line still showing: folded lines leave empty place-holders behind. */
  function liveLine() {
    for (let i = G.log.length - 1; i >= 0; i--) if (!G.log[i].gone) return G.log[i];
    return null;
  }
  // (what the pack holds has changed: anything rare or better now known is one of this run's finds)
  function emit(e) { if (e === 'inv' && G && G.status === 'playing') legends.noteFinds(); events.push(e); }
  function takeEvents() { return events.splice(0); }

  // ---------- tiles ----------
  function tile(x, y) {
    const L = lvl();
    return (x < 0 || y < 0 || x >= L.w || y >= L.h) ? T.WALL : L.tiles[y * L.w + x];
  }
  function setTile(x, y, t) {
    const L = lvl(), i = y * L.w + x, was = L.tiles[i];
    L.tiles[i] = t;
    // a door pushed open or pulled shut slides into the wall or out of it (see the doors in renderState)
    if ((was === T.DOOR || was === T.DOOR_LOCKED) && t === T.DOOR_OPEN) doorMoves(x, y, true, was === T.DOOR_LOCKED ? (L.locks || {})[key(x, y)] || 'any' : null);
    else if (was === T.DOOR_OPEN && t === T.DOOR) doorMoves(x, y, false, null);
  }
  /** A door on the move, for the picture, and the dust it shakes down. @param {string|null} lock its lock's colour, if it had one */
  function doorMoves(x, y, open, lock) {
    fx.doors[key(x, y)] = { x, y, at: realNow, open, lock, depth: G.depth };
    for (let i = 0; i < 10; i++) {
      fx.bits.push({ x: x + 0.3 + look() * 0.4, y: y + 0.3 + look() * 0.4, z: 0.6 + look() * 0.4, vx: (look() - 0.5) * 0.4, vy: (look() - 0.5) * 0.4, vz: 0,
        g: 1.2, c: ['#8a7a64', '#a89a84', '#6a5e4e'][i % 3], born: realNow, life: 600 + look() * 400, size: 0.012 });
    }
    if (fx.bits.length > BITS_MAX) fx.bits.splice(0, fx.bits.length - BITS_MAX);
  }
  function monsterAt(x, y) { return lvl().monsters.find(m => m.x === x && m.y === y) || null; }
  function npcAt(x, y) { const L = lvl(); return (L.npcs || []).find(n => n.x === x && n.y === y) || null; }
  function passable(x, y) { const t = tile(x, y); return t === T.FLOOR || t === T.DOOR_OPEN; }

  // ---------- character ----------
  function rollStats() {
    const roll = () => { const r = [d(1, 6), d(1, 6), d(1, 6), d(1, 6)].sort((a, b) => b - a); return r[0] + r[1] + r[2]; };
    return { str: roll(), dex: roll(), con: roll(), int: roll(), wis: roll(), cha: roll() };
  }
  /** What the caster holds in the shield hand, if it is a focus: its flags (regen, die, storm, mercy, wrath). */
  const focusOf = (p = P()) => { const it = p.eq.shield, b = it && ITEMS[it.t]; return b && b.focus ? b : null; };
  const focusHas = (flag, p = P()) => { const f = focusOf(p); return !!(f && f[flag]); };
  /** What a robe worn adds to spell points: a Silk Robe two, the Robe of the Magi four. */
  const robeSp = p => (p.eq.armor && ITEMS[p.eq.armor.t].sp) || 0;
  function spMax(p) {
    const c = CLASSES[p.cls];
    if (!c.spells) return 0;
    const stat = p.stats[c.primary];
    // the unarmoured mage runs deep
    const mul = c.spMul || 1;
    return Math.max(4, Math.round(p.level * (2.4 + mod(stat)) * mul)) + 3 + (p.bonusSp || 0)
      + (hasPower('mind', null, p) ? 6 : 0) + healerSp(p) + robeSp(p);
  }
  // Practice tells: a veteran swings faster and puts more behind it. Without this
  // the player's damage is flat for the whole game while monster hit points grow.
  function skillSpeed() {
    const p = P();
    const rate = p.cls === 'thief' ? 0.062 : 0.045;   // thieves gain speed fastest
    const cap = p.cls === 'thief' ? 0.55 : 0.42;
    // Practised Hands takes its 8% off the swing as it is at every level: taken
    // off the part a level had already shortened, it grew to a seventh by the tenth
    return (1 - Math.min(cap, (p.level - 1) * rate)) * (1 - (p.perkSpeed || 0));
  }
  /** Riposte: a blow that misses you readies your next swing at once. */
  function riposte() {
    const p = P();
    if (!hasTalent('riposte')) return;
    if (!(p.riposteUntil > G.t)) log('Riposte: you see an opening!', 'good');
    p.nextAttack = Math.min(p.nextAttack, G.t);
    p.riposteUntil = G.t + 2500;
  }
  // A trick answered leaves whatever made it wide open: the next blow at it,
  // if it comes soon, cannot miss and lands as a telling blow. This is what
  // reading the violet mark buys, beyond the blow it spared you.
  /** Why the hero cannot act: knocked down by a charge, or frozen by a touch. */
  const heldWhy = () => ({ down: 'You are still getting to your feet!', stone: 'Your limbs are stone!', ice: 'Your feet are frozen into the ice!', snare: 'The snare has your ankle!' }[P().heldBy || ''] || 'You are frozen in place!');
  const OPENING_MS = 2500;
  /** @param {import('./types.js').Monster} m */
  function opening(m) {
    const p = P();
    p.opening = { uid: m.uid, until: G.t + OPENING_MS };
    p.nextAttack = Math.min(p.nextAttack, G.t);
    floatText(m, 'opening!', '#ffd84a');
  }
  /** Whether the hero has taken this class talent. */
  const hasTalent = id => !!(P().talents && P().talents.includes(id));

  // the roll at or above which an attack is a critical hit
  function critFloor() {
    const p = P();
    const base = p.cls !== 'thief' ? 20 : (p.level >= 9 ? 18 : 19);
    return base - (hasPower('keen', 'weapon') ? 1 : 0) - (hasTalent('lucky') ? 1 : 0) - (onPath('assassin') ? (capped('shadows_edge') ? 2 : 1) : 0) - (onPath('sharpshooter') && weapon().range ? 1 : 0);
  }
  function skillDamage() { return Math.floor((P().level - 1) / 3); }
  function weapon() {
    const p = P();
    // a bear strikes with its claws, whatever the druid was holding
    if (wild.shaped(p)) return wild.claws();
    const spd = skillSpeed() * (p.eq.offhand ? DUAL_SWING_COST : 1) * berserkerFrenzy();
    if (!p.eq.weapon) return { name: 'fists', dmg: [1, 2, 0], speed: Math.round(450 * spd), e: 0, px: '', range: 0, blunt: true };
    const b = ITEMS[p.eq.weapon.t];
    // a ranger's talents for the bow: a sixth quicker, and two squares further
    const swift = (hasPower('swift', 'weapon') ? 0.85 : 1) * (b.range && hasTalent('swift_quiver') ? 5 / 6 : 1) * (b.aimed && capped('swift_draw') ? 0.8 : 1);
    const reach = (b.range || 0) + (b.range && hasTalent('eagle_eye') ? 2 : 0);
    return { name: b.name, dmg: b.dmg, speed: Math.round(b.speed * spd * swift), e: p.eq.weapon.e || 0, px: p.eq.weapon.px || '', twoHanded: !!b.twoHanded, range: reach, blunt: !!b.blunt };
  }
  /**
   * Damage per second a main-hand weapon would give you, as far as you know
   * it: the melee rule's own numbers (strength or finesse, practice, talents,
   * a path, a Ring of Might, a blade kept in the other hand) against a foe with
   * nothing special about it. A hidden enchantment counts as nothing. The
   * trader and the pack compare weapons with this, so they cannot drift from
   * the rule the way a copy of it did.
   */
  function blowRate(it) {
    const p = P(), b = it ? ITEMS[it.t] : null;
    const known = x => (x && !x.h ? x.e || 0 : 0);
    const r = relicOf(it), swift = !!it && ((!!r && r.powers.includes('swift')) || (it.pw === 'swift' && !it.h));
    // a two-hander stows the second blade, and a blade moved to the main hand leaves it empty
    const dual = !!p.eq.offhand && p.eq.offhand !== it && !(b && b.twoHanded);
    const base = b ? b.speed : 450;
    const speed = base * skillSpeed() * (dual ? DUAL_SWING_COST : 1) * berserkerFrenzy() * (swift ? 0.85 : 1) * (b && b.aimed && capped('swift_draw') ? 0.8 : 1);
    const avg = dmg => dmg[0] * (dmg[1] + 1) / 2 + dmg[2];
    const finesse = p.cls === 'thief' || p.cls === 'ranger';
    const flat = (finesse ? mod(p.stats.dex) : mod(armStat(p))) + skillDamage();
    const knack = (hasTalent('weapon_master') ? (b && b.twoHanded ? 2 : 1) : 0) + (hasTalent('zeal') && effectFrom('hit', 'bless') ? 1 : 0)
      + berserkerRage() + jewelBonus('might') + (effect('might') ? 2 : 0);
    // (a ranger's bow is reckoned as it is used, from a distance, with Steady Aim)
    const steady = b && b.aimed && p.cls === 'ranger' ? steadyAim() : 0;
    let blow = Math.max(1, avg(b ? b.dmg : [1, 2, 0]) + known(it) + (it && it.px === 'heavy' && !it.h ? 1 : 0) + bargained() + (finesse ? flat : flat * (base / 700)) + knack + steady);
    if (dual) blow += Math.max(1, avg(ITEMS[p.eq.offhand.t].dmg) + known(p.eq.offhand) + (p.eq.offhand.px === 'heavy' && !p.eq.offhand.h ? 1 : 0) + jewelBonus('might') + berserkerRage() + bargained() + (hasTalent('weapon_master') ? 1 : 0));
    return blow / (speed / 1000);
  }
  const STEADY_AIM = 1;
  // and on a delve of eight floors or fewer, on Normal or Easy, one more from three squares off:
  // the ranger won 76% there where the rest won 80% to 84%, while on Hard it led (one more from
  // two squares took it to 85.75%). Hard and the Long Delve keep the one. The pack weighs a bow
  // at two squares, the shot it is most often loosed at.
  const steadyAim = (far = 2) => STEADY_AIM + (far >= 3 && G && (G.opts.levels || 8) <= 8 && G.opts.difficulty !== 'hard' ? 1 : 0);
  // Two blades means neither hand swings clean, so the main hand loses rhythm.
  const DUAL_SWING_COST = 1.2;
  const DUAL_HIT_PENALTY = 2;
  // a missed first blow leaves you off balance, and the second swings wilder still
  const OFF_BALANCE = 1;
  const OFFHAND_PARRY = 1;
  const OFFHAND_MAX_SPEED = 550;   // dagger, club, short sword: nothing heavier
  /** Why this cannot ride in the off hand, or null if it can. */
  function offhandReason(it) {
    const p = P(), b = ITEMS[it.t];
    if (!b || b.kind !== 'weapon') return 'That is not a weapon.';
    if (!CLASSES[p.cls].dualWield) return `${CLASSES[p.cls].plural} fight with one blade.`;
    if (!b.cls.includes(p.cls)) return `${CLASSES[p.cls].plural} cannot wield ${aThing(b.name.toLowerCase())}.`;
    if (b.twoHanded) return 'A two-handed weapon needs both hands.';
    if (b.range) return 'You cannot fence with a missile weapon.';
    if (b.speed > OFFHAND_MAX_SPEED) return `A ${b.name.toLowerCase()} is too heavy for the off hand.`;
    // (the pack offered "Off hand" beside a bow, and the swap then refused)
    if (p.eq.weapon && ITEMS[p.eq.weapon.t].twoHanded && p.eq.weapon !== it) return `${cap(the(p.eq.weapon))} needs both hands.`;
    return null;
  }
  function canDualWield() { return !!(G && CLASSES[P().cls].dualWield); }
  function offhandWeapon() {
    const p = P();
    if (!p.eq.offhand) return null;
    const b = ITEMS[p.eq.offhand.t];
    return { name: b.name, dmg: b.dmg, e: p.eq.offhand.e || 0, px: p.eq.offhand.px || '', blunt: !!b.blunt };
  }
  /** Whether an effect is on, and was put there by this spell (not a shrine's blessing). */
  function effectFrom(name, spell) { const e = P().effects[name]; return !!(e && e.until > G.t && e.src === spell); }
  // A blessing bought or prayed for (the vigil lamp, a shrine) keeps its own
  // slot beside a spell's, and the two add: casting Shield must not wipe out
  // minutes of a ward paid for in gold, nor the ward Shield's own powers.
  // the buried crew's song is its own blessing, and a lamp's or a shrine's does not drown it
  function effect(name) { return ownEffect(name) + ownEffect('boon_' + name) + ownEffect('crew_' + name); }
  function ownEffect(name) {
    const e = P().effects[name];
    return e && e.until > G.t ? e.amount : 0;
  }

  // ---------- relics ----------
  // Named gear (see relics.js). A striking power belongs to the blade that
  // strikes, so it is asked of one slot; the rest work from anywhere worn.
  const relicOf = it => (it && it.u && RELICS[it.u]) || null;
  // two rings and an amulet, worn by anyone, each with the power it was made for
  const JEWEL_SLOTS = ['ring', 'ring2', 'amulet'];
  const isJewel = it => { const b = it && ITEMS[it.t]; return !!b && (b.kind === 'ring' || b.kind === 'amulet'); };
  /** @returns {string[]} */
  const jewelPowers = it => { const b = it && ITEMS[it.t]; return b && b.power ? [].concat(b.power) : []; };
  const BLADE_POWERS = ['keen', 'swift', 'undead', 'giant', 'leech', 'flame'];
  function hasPower(power, slot, p = P()) {
    const slots = slot ? [slot] : ['weapon', 'offhand', 'armor', 'shield', ...JEWEL_SLOTS, 'cloak'];
    // a relic's powers, the one power an ordinary piece was made with, or a ring's
    // a bear holds nothing: what a blade does in a fight stays behind with it (a
    // staff's well of power does not: taking it away shrank the druid's points for good),
    // and a shield left on the floor keeps its powers to itself
    const shaped = !!(G && wild.shaped(p)), bear = shaped && BLADE_POWERS.includes(power);
    return slots.some(s => { if ((bear && (s === 'weapon' || s === 'offhand')) || (shaped && s === 'shield')) return false; const it = p.eq[s], r = relicOf(it); return (!!r && r.powers.includes(power)) || (!!it && (it.pw === power || jewelPowers(it).includes(power))); });
  }
  /** What keeps out the cold, for the log: "your cloak", or "Your ring" to open a sentence. */
  function warmthFrom(cap = false) {
    const WORD = { weapon: 'weapon', offhand: 'blade', armor: 'armour', shield: 'shield', ring: 'ring', ring2: 'ring', amulet: 'amulet', cloak: 'cloak' };
    const s = Object.keys(WORD).find(k => hasPower('warmth', k)) || 'cloak';
    return `${cap ? 'Your' : 'your'} ${WORD[s]}`;
  }
  /**
   * How much the rings and amulet worn add to a power that comes in amounts:
   * its bonus, with the piece's enchantment (a curse takes from it). Two of
   * one kind do not add up: the better counts, and a cursed one only if it is
   * all there is. Two +2 Rings of Protection were six points of armour.
   */
  function jewelBonus(power, p = P()) {
    let n = null;
    for (const s of JEWEL_SLOTS) {
      const it = p.eq[s];
      if (it && jewelPowers(it).includes(power)) { const v = (ITEMS[it.t].bonus || 0) + (it.e || 0); if (n === null || v > n) n = v; }
    }
    return n || 0;
  }
  // ---------- fire, cold and lightning ----------
  // Some things burn well and some shrug off the cold (ELEMENTS_TAKEN). The
  // first time a hero's fire, cold or lightning finds out which, it shows over
  // the creature and in the log, and the bestiary keeps it.
  const ELEMENT_WORDS = {
    fire: ['burns well!', 'shrugs off much of the fire.'],
    cold: ['stiffens in the cold!', 'barely feels the cold.'],
    lightning: ['jerks and smokes as the lightning finds it!', 'lets the lightning run off it.'],
  };
  /** How much of this element a monster takes: 1.5 where it is weak, 0.5 where it resists. */
  function elementFactor(m, el) {
    if (!el) return 1;
    const mb = MONSTERS[m.id], kind = mb.named ? mb.named.kin : m.id;
    return (ELEMENTS_TAKEN[kind] && ELEMENTS_TAKEN[kind][el]) || 1;
  }
  /** Damage of an element against a monster, weakness and resistance counted in. */
  function elemental(m, dmg, el) {
    const f = elementFactor(m, el);
    if (f === 1) return dmg;
    m.elSeen = m.elSeen || {};
    if (!m.elSeen[el]) {
      m.elSeen[el] = 1;
      const mb = MONSTERS[m.id], weak = f > 1;
      floatText(m, weak ? 'weak!' : 'resists', weak ? '#ffb040' : '#8aa0b8');
      log(`The ${mb.name} ${ELEMENT_WORDS[el][weak ? 0 : 1]}`, weak ? 'good' : '');
      learn(mb.named ? mb.named.kin : m.id, `element:${el}:${weak ? 'weak' : 'resist'}`);
    }
    return Math.max(1, Math.round(dmg * f));
  }
  const spellElement = sp => sp.element || (sp.fire ? 'fire' : '');
  /** Extra damage a bane deals to the monster it was made for. */
  function baneDamage(m, slot) {
    let n = 0;
    if (hasPower('undead', slot) && mstat(m).undead) n += d(1, 6);
    if (hasPower('giant', slot) && GIANTS.includes(m.id)) n += d(1, 8);
    if (hasPower('flame', slot)) n += elemental(m, d(1, 4), 'fire');
    if (hasTalent('sanctified') && mstat(m).undead) n += d(1, 4);
    return n;
  }
  // A coating rides on the next COAT_BLOWS blows that land, then it is worn away.
  const COAT_BLOWS = 20;
  // the colour of each coating as it runs off the flask
  const COAT_GLOW = { fire: '#ff8a30', silver: '#dfe6f0', venom: '#7ad040' };
  const COATINGS = {
    fire: { name: 'fire oil', says: 'It will burn for the next 20 blows that land.' },
    silver: { name: 'silver wash', says: 'The dead will feel the next 20 blows that land.' },
    venom: { name: 'blade venom', says: 'One in three of the next 20 blows that land will poison.' },
  };
  /** What the coating on the weapon adds to a blow on this foe. */
  function coatDamage(m) {
    const c = P().coating;
    if (!c || !(c.left > 0) || !P().eq.weapon || wild.shaped()) return 0;
    if (c.t === 'fire') return elemental(m, d(1, 4), 'fire');
    if (c.t === 'silver' && mstat(m).undead) { combos.note('silver_dead', m); return d(1, 6); }
    return 0;
  }
  // The grey dwarves are stout: poison does not take on them, as it does not on the dead,
  // and they ride out a spell a little more often than their skill at arms alone would say
  /** Whether venom can take on this foe; a stout one says so the first time it shrugs it off. */
  function venomTakes(m, mb) {
    if (mb.undead) return false;
    if (!mb.stout) return true;
    if (!m.stoutSaid) { m.stoutSaid = true; floatText(m, 'stout', '#c8b890'); log(`The poison does nothing to the ${mb.name}: grey dwarves are stout.`); learn(mb.named ? mb.named.kin : m.id, 'stout'); }
    return false;
  }
  /** A blow with a coated weapon has landed: fire stops the mending, venom may take, and the coat wears. */
  function coatLanded(m, survived) {
    const p = P(), c = p.coating;
    if (!c || !(c.left > 0) || !p.eq.weapon) return;
    const mb = mstat(m);
    if (survived && c.t === 'fire' && mb.regen) { if (!(m.burnUntil > G.t)) log(`The ${mb.name}'s burns do not close.`, 'good'); m.burnUntil = G.t + 6000; combos.note('trolls_bane', m); }
    if (survived && c.t === 'venom' && venomTakes(m, mb) && Dice.chance(1 / 3)) {
      m.dot = { kind: 'venom', until: G.t + 4000, next: G.t + 1000 };
      log(`The ${mb.name} is poisoned.`, 'good');
    }
    if (--c.left <= 0) { p.coating = null; log(`The ${COATINGS[c.t].name} has worn off your weapon.`); }
    emit('stats');
  }
  function leech(dmg, slot) {
    const p = P();
    if (!hasPower('leech', slot) || p.hp >= p.maxHp) return;
    const was = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + Math.max(1, Math.floor(dmg / 5)));
    noteHealed(p.hp - was);
    emit('stats');
  }
  /** Spell points follow what is worn: a well of power takes its six with it. */
  function refreshSp(p) {
    p.maxSp = spMax(p);
    p.sp = Math.min(p.sp, p.maxSp);
  }
  const relicItem = id => ({ t: RELICS[id].t, q: 1, e: RELICS[id].e, u: id });
  /** "the Long Sword", but a relic goes by its own name, article and all. */
  function the(it) { const r = relicOf(it); return r ? r.name : `the ${itemName(it)}`; }
  function discoverRelic(id) {
    if (!G.relics || G.relics.found.includes(id)) return;
    G.relics.found.push(id);
    G.known[RELICS[id].t] = 1;   // a named ring or amulet says what it was made for
    const had = Progress.load().feats.collector;
    if (!G.tested) Progress.noteRelic(id);   // the codex remembers it after the run
    log(RELICS[id].lore, 'info');
    if (!had && Progress.load().feats.collector) log('That is every relic in the deep found, over all your runs: the Collector\'s feat, a trophy of its own.', 'good');
  }
  // ---------- the music's cue ----------
  /**
   * How the fight stands, for the music: the lich awake; a named champion or
   * a shade awake and close; something awake close enough to come to blows;
   * something awake further off; or nothing at all.
   * @returns {'quiet'|'wary'|'fight'|'champion'|'boss'|'warlord'}
   */
  function mood() {
    if (!G || G.status !== 'playing') return 'quiet';
    const L = lvl();
    // steps it would take to reach you, not a line through the wall: a goblin
    // awake in the next corridor over is no fight yet (unreachable, no fight at all)
    ensureDist();
    const steps = m => { const d = distField ? distField[m.y * L.w + m.x] : -1; return d >= 0 ? d : Infinity; };
    /** @type {'quiet'|'wary'|'fight'|'champion'} */
    let best = 'quiet';
    for (const m of L.monsters) {
      if (!m.awake || m.collapsed) continue;
      const b = MONSTERS[m.id], d = steps(m);
      if (b.boss && m.spoke) return m.id === 'warlord' ? 'warlord' : 'boss';
      if ((b.named || m.shade) && m.spoke && d <= MOOD_WARY) best = 'champion';
      else if (d <= MOOD_FIGHT && best !== 'champion') best = 'fight';
      else if (d <= MOOD_WARY && best === 'quiet') best = 'wary';
    }
    // a fight holds a moment after the last foe steps out of reach: one
    // stepping in and out of it used to end the music's fight and begin it again
    if (best === 'fight' || best === 'champion') moodFightAt = G.t;
    else if (G.t >= moodFightAt && G.t - moodFightAt < MOOD_HOLD) return 'fight';
    return best;
  }
  const MOOD_FIGHT = 5, MOOD_WARY = 10, MOOD_HOLD = 2500;
  let moodFightAt = -1e9;
  /**
   * A caster's focus (a mage's book or orb, a cleric's holy symbol) turns up
   * only in that caster's dungeon, on a stream of its own. A found one may be
   * cursed, which binds it to the hand until the curse is lifted.
   */
  const FOCUS_FIND = 0.25, FOCUS_SHOP = 0.3;
  function placeFoci(L, depth) {
    const c = cls();
    if (depth < 2 || !c.focus) return;
    const rng = new Rng(`${G.seed}|focus|${depth}`);
    const maxTier = 1 + Math.floor(depth / 2);
    const pool = Object.keys(ITEMS).filter(id => ITEMS[id].focus === c.focus && ITEMS[id].tier <= maxTier);
    if (!pool.length) return;
    const shelf = Object.keys(ITEMS).filter(id => ITEMS[id].focus === c.focus && ITEMS[id].tier <= maxTier + 1);
    const piles = Object.keys(L.items).filter(k => !L.items[k].some(it => it.t === 'artifact'));
    if (piles.length && rng.chance(FOCUS_FIND)) {
      const it = { t: rng.weighted(pool.map(id => [id, ITEMS[id].tier])), q: 1, e: 0, h: 1 };
      if (rng.chance(0.15)) it.curse = 1;     // it binds to the hand: the staff and the shield wait until it is lifted
      L.items[rng.pick(piles)].push(it);
    }
    const trader = (L.npcs || []).find(n => n.kind !== 'encounter' && n.stock);
    if (trader && rng.chance(FOCUS_SHOP)) trader.stock.push({ t: rng.pick(shelf), q: 1, e: 0 });
  }
  // A cleric's faith guides the mace as much as the arm does: whichever is the
  // stronger, strength or wisdom, lands the blow. Everyone else swings with strength.
  // a ranger looses every arrow and lands every blow by Dexterity
  // (and a druid's, whose staff and claws answer the same wisdom)
  const armStat = p => p.cls === 'cleric' || p.cls === 'druid' ? Math.max(p.stats.str, p.stats.wis) : p.cls === 'ranger' ? p.stats.dex : p.stats.str;
  function toHit() {
    const p = P();
    return Math.floor(p.level * cls().hitProg) + mod(armStat(p)) + effect('hit') + weapon().e + (weapon().px === 'true' ? 1 : 0) + bargained()
      + (p.perkHit || 0) + (effect('might') ? 2 : 0) + jewelBonus('might') + (hasTalent('eagle_eye') && weapon().range ? 1 : 0);
  }
  function playerAC() {
    const p = P();
    let ac = 10 + mod(p.stats.dex) + effect('ac');
    // thieves and rangers stay alive by not being where the blow lands (a ranger
    // without it won 59% on Normal and 33% on Hard, well below the others)
    if (p.cls === 'thief' || p.cls === 'ranger') ac += Math.floor((p.level + 2) / 3);
    if (onPath('warden')) ac += capped('wild_bulwark') ? 3 : 1;
    if (wild.shaped(p)) ac += wild.SHAPE_AC;
    if (hasTalent('barkskin')) ac += 1;
    // a Grovewarden's skin has taken the bark's grain, companion or none
    if (onPath('grovewarden')) ac += 2;
    if (p.eq.armor) ac += ITEMS[p.eq.armor.t].ac + (p.eq.armor.e || 0) + (p.eq.armor.px === 'sturdy' ? 1 : 0);
    // a focus turns no more blows for being well made: its make is in what it does
    // a bear carries no shield and no second blade: its hide is its guard
    const bear = wild.shaped(p);
    if (p.eq.shield && !bear) ac += ITEMS[p.eq.shield.t].focus ? ITEMS[p.eq.shield.t].ac : ITEMS[p.eq.shield.t].ac + (p.eq.shield.e || 0) + (p.eq.shield.px === 'sturdy' ? 1 : 0) + (hasTalent('bulwark') ? 2 : 0) + knightShieldAC();
    // the Stairwarden's Arms, both worn
    if (setWorn('stair', p)) ac += 2;
    // a second blade is no shield, but it turns aside a blow now and then
    if (p.eq.offhand && !bear) ac += OFFHAND_PARRY;
    // a cloak goes over everything, and adds to a ring rather than vying with it
    if (p.eq.cloak) ac += (ITEMS[p.eq.cloak.t].ac || 0) + (p.eq.cloak.e || 0);
    return ac + jewelBonus('protect', p) + berserkerOpen();
  }
  function knownSpells() {
    const c = cls();
    if (!c.spells) return [];
    return SPELLS[c.spells];
  }
  /** The hero level a spell comes at: first, third and fifth for the first three circles, the fifth circle at seventh. */
  const spellLevel = sp => sp.lvl <= 3 ? sp.lvl * 2 - 1 : sp.lvl + 2;
  function spellAvailable(sp) { return P().level >= spellLevel(sp); }

  // Effective monster stats, including any champion bonuses.
  /** A champion with no matching prefix behaves exactly like its plain kind. */
  const NO_ELITE = { prefix: '', hp: 1, ac: 0, hit: 0, dmg: 0, xp: 1, speed: 1, tint: '#fff' };
  function mstat(m) {
    // (a champion's last stand: quicker and harder, see lairs.js)
    const s = m.fury ? lairs.furyOf(mstatBase(m)) : mstatBase(m);
    // a floor readier for a strong hero, or a harder delve: its creatures hit surer and harder
    // (and the lich, the last fight, more than the floor: see DIFFICULTY)
    const edge = (m.edge || 0) + diffEdge() + (s.boss ? diff().lichEdge || 0 : 0);
    // on a flooded floor everything wades: a quarter slower, the lich aside
    const wade = !s.boss && G && G.levels && lvl() && lvl().twist === 'flooded';
    // and for one sworn to the Hunted Vow, everything is a tenth quicker
    const hunted = vowed('hunted') ? 0.9 : 1;
    if (!edge && !wade && hunted === 1) return s;
    return { ...s, ...(edge ? { hit: s.hit + edge, dmg: [s.dmg[0], s.dmg[1], s.dmg[2] + edge] } : {}), speed: Math.round(s.speed * (wade ? FLOOD_SLOW : 1) * hunted) };
  }
  function mstatBase(m) {
    const b = MONSTERS[m.id];
    // a boss changes as it weakens: each phase lends it new ways to fight
    if (b.phases && m.phase) return { ...b, ...b.phases[Math.min(m.phase, b.phases.length) - 1] };
    if (m.shade) return shadeStats(b, m.shade);
    if (!m.elite) return b;
    const e = ELITES.find(x => x.prefix === m.elite) || NO_ELITE;
    // everything its kind has, with only what the prefix changes changed: a
    // list of fields to copy lost each new one (a wraith's cold, a beast's way
    // with doors) until someone remembered to add it
    return {
      ...b,
      name: `${m.elite} ${b.name}`, ac: b.ac + (e.ac || 0), hit: b.hit + (e.hit || 0),
      dmg: [b.dmg[0], b.dmg[1], b.dmg[2] + (e.dmg || 0)],
      speed: Math.round(b.speed * (e.speed || 1)), xp: Math.round(b.xp * (e.xp || 1)),
    };
  }

  // ---------- camera ----------
  function snapCam() {
    const p = P();
    cam.x = cam.toX = p.x + 0.5; cam.y = cam.toY = p.y + 0.5;
    cam.angle = cam.toA = p.dir * Math.PI / 2 - Math.PI / 2;
    cam.moving = false;
  }
  function startCam(ms) {
    const p = P();
    cam.fromX = cam.x; cam.fromY = cam.y; cam.fromA = cam.angle;
    cam.toX = p.x + 0.5; cam.toY = p.y + 0.5;
    let target = p.dir * Math.PI / 2 - Math.PI / 2;
    while (target - cam.angle > Math.PI) target -= Math.PI * 2;
    while (target - cam.angle < -Math.PI) target += Math.PI * 2;
    cam.toA = target;
    cam.t0 = realNow; cam.t1 = realNow + ms; cam.moving = true;
  }
  function camProgress() { return cam.moving ? Math.min(1, (realNow - cam.t0) / (cam.t1 - cam.t0)) : 1; }
  function updateCam() {
    if (!cam.moving) return;
    const t = camProgress();
    const e = t < 1 ? 1 - Math.pow(1 - t, 2) : 1;
    cam.x = cam.fromX + (cam.toX - cam.fromX) * e;
    cam.y = cam.fromY + (cam.toY - cam.fromY) * e;
    cam.angle = cam.fromA + (cam.toA - cam.fromA) * e;
    if (t >= 1) { cam.moving = false; cam.angle = cam.toA; }
  }

  // ---------- new game / levels ----------
  // Each dungeon shuffles which appearance belongs to which potion/scroll type.
  function buildLooks(seed) {
    const rng = new Rng('looks#' + seed);
    const potions = Object.keys(ITEMS).filter(id => ITEMS[id].kind === 'potion');
    const scrolls = Object.keys(ITEMS).filter(id => ITEMS[id].kind === 'scroll');
    // every kind of potion in a run gets a bottle of its own colour, so two
    // unknown draughts are never the same picture in the pack
    const shuffled = rng.shuffle(POTION_LOOKS.slice()), seen = new Set(), pl = [];
    for (const look of shuffled) if (!seen.has(look[1])) { seen.add(look[1]); pl.push(look); }
    for (const look of shuffled) if (!pl.includes(look)) pl.push(look);
    const sl = rng.shuffle(SCROLL_LOOKS.slice());
    const looks = {};
    potions.forEach((id, i) => { looks[id] = { adj: pl[i % pl.length][0], sprite: pl[i % pl.length][1] }; });
    scrolls.forEach((id, i) => { looks[id] = { adj: sl[i % sl.length], sprite: 'scroll' }; });
    // rings and amulets after, so the potions and scrolls of a seed look as they always did
    for (const [kind, all] of [['ring', RING_LOOKS], ['amulet', AMULET_LOOKS]]) {
      const pool = rng.shuffle(all.slice());
      Object.keys(ITEMS).filter(id => ITEMS[id].kind === kind).forEach((id, i) => { looks[id] = { adj: pool[i % pool.length][0], sprite: pool[i % pool.length][1] }; });
    }
    return looks;
  }
  function isKnown(t) {
    const b = ITEMS[t];
    return !!(!b || !['potion', 'scroll', 'ring', 'amulet'].includes(b.kind) || !G.looks[t] || G.known[t]);
  }
  function newGame(cfg) {
    // a way in still playing from a run left at the title is not this run's
    prelude.cancel();
    const c = CLASSES[cfg.cls];
    // a background still locked (or a stale choice) falls back to the first
    const bg = BACKGROUNDS[cfg.bg] && Progress.bgOpen(cfg.bg) ? cfg.bg : 'oathbroken';
    const p = {
      name: (cfg.name || '').trim() || heroName(bg), cls: cfg.cls, bg, stats: { ...cfg.stats }, level: 1, xp: 0,
      maxHp: 0, hp: 0, maxSp: 0, sp: 0, food: 100, gold: 0,
      inv: [], eq: { weapon: null, armor: null, shield: null, offhand: null, ring: null, ring2: null, amulet: null, cloak: null }, effects: {}, poison: null,
      x: 0, y: 0, dir: 0, nextAttack: 0, kills: 0, steps: 0, deepest: 1,
    };
    // the background is who you were before the first stair, and it shows
    if (bg === 'ashborn') p.stats.con++;
    if (bg === 'oathbroken') p.perkHit = 1;
    if (bg === 'debtor') p.gold = 150;
    // A level-one mage used to start on six to eight hit points, which two
    // goblin blows could take, and a fifth of runs never left the first floor.
    // Starting a little sturdier costs nothing by the fourth floor, where
    // levels have added far more than this.
    // (the fighter's few more are for Easy and Normal only: it trailed the rest there,
    // and on Hard, where it ran level with them, the same three took it ten points past.
    // On Hard it has two of its own, `hardHp`: once the boss pass made the champions
    // fight harder it fell to five points behind there, a sixth of its heroes dying
    // before they had a path; the ranger has its few on Easy and Normal, where it trailed.)
    const mild = (cfg.opts || {}).difficulty !== 'hard' ? c.mildHp || 0 : c.hardHp || 0;
    // A quick delve of two floors brings a hero to the lich at the third or fourth
    // level: a thief, all strike and no staying power, won three in four there while
    // the casters won nineteen in twenty. Its few more (`quickHp`) are for that delve alone.
    const quickHp = ((cfg.opts || {}).levels || 8) <= 2 ? c.quickHp || 0 : 0;
    p.maxHp = Math.max(10, c.hitDie + 6 + (c.startHp || 0) + mild + quickHp + mod(p.stats.con));
    p.hp = p.maxHp;
    p.maxSp = spMax(p); p.sp = p.maxSp;
    lastBlocked = -1e9; queuedAttack = false; queuedMove = null;   // nothing carries over from the last run's clock
    clearFx();
    encs.clear();   // nor does one carry over into a new run
    G = { seed: cfg.seed, opts: cfg.opts, player: p, levels: {}, depth: 1, log: [], logSeq: 0, t: 0, status: 'playing', lastSpell: null, created: newRunStamp(), version: 4, looks: buildLooks(cfg.seed), known: {}, journal: [], pendingBoons: null };
    // only vows that exist, once each; the Daily Delve is the same run for everyone, so it takes none
    if (G.opts.vows) G.opts.vows = G.opts.daily ? [] : [...new Set(G.opts.vows)].filter(v => VOWS[v]);
    // a rung of the ladder, on Hard only, never in a Daily (it only makes the delve harder, so the
    // New Game screen alone keeps it to the rungs a class has opened; see rungOpen in progress.js)
    if (G.opts.rung !== undefined) { const n = Math.floor(Number(G.opts.rung)); if (G.opts.difficulty === 'hard' && !G.opts.daily && n >= 1 && n < LADDER.length) G.opts.rung = n; else delete G.opts.rung; }
    G.relics = { ...relicPlan(cfg.seed, cfg.cls, cfg.opts.levels), offered: 0, found: [] };
    G.stats = freshStats();
    if (bg === 'cloistered') for (const id in ITEMS) G.known[id] = 1;   // raised among the books
    // the starting kit is familiar to its owner (the second kit, once a win has earned it; never in a Daily)
    const alt = G.opts.kit === 'alt' && !G.opts.daily && Progress.kitOpen(cfg.cls);
    if (!alt) delete G.opts.kit;
    const kit = alt ? c.altKit.items : c.startKit;
    for (const id of kit) G.known[id] = 1;
    for (const id of kit) giveItem({ t: id, q: 1, e: 0 });
    if (bg === 'returned') { G.known.potion_xheal = 1; giveItem({ t: 'potion_xheal', q: 1, e: 0 }); }   // one good draught kept back
    if (bg === 'lorekeeper') { for (const id in ITEMS) if (ITEMS[id].kind === 'scroll') G.known[id] = 1; giveItem({ t: 'scroll_map', q: 1, e: 0 }); giveItem({ t: 'scroll_heal', q: 1, e: 0 }); }
    // the Glass Vow: a quarter less life from the start (and from every level, see checkLevelUp)
    if (vowed('glass')) { p.maxHp = Math.max(6, Math.round(p.maxHp * 0.75)); p.hp = p.maxHp; }
    for (const it of p.inv.slice()) {
      const k = ITEMS[it.t].kind;
      if ((k === 'weapon' || k === 'armor' || k === 'shield') && !p.eq[k]) equip(it, true);
    }
    enterLevel(1, 'down');
    log(`Welcome, ${p.name} the ${c.name}. ${G.opts.levels} floors lie below. Find the Heart of the Mountain.`, 'good');
    // a hound from the first stair, for one who has earned it (not sworn to go alone, nor in a Daily)
    if (G.opts.companion === 'hound' && !G.opts.daily && !vowed('alone') && Progress.houndOpen()) {
      companion.join('hound');
      log(`A rangy hound is waiting at the foot of the stair, as one did for you before. ${G.companion.name} follows you now.`, 'good');
    } else if (G.opts.companion) delete G.opts.companion;
    // a delve with no hound in it sends a druid a wolf instead, at the first stair
    if (cfg.cls === 'druid' && !G.companion && !vowed('alone') && !Object.values(encounterPlan(cfg.seed, G.opts.levels || 8, Dungeon.tierAt, Math.max(1, Dungeon.areaOf(G.opts.size)))).some(ids => ids.includes('stray'))) {
      companion.join('wolf');
      log(`A grey wolf pads out of the dark at the foot of the stair and falls in beside you, as if it had always meant to. ${G.companion.name} follows you now.`, 'good');
    }

    return G;
  }

  function enterLevel(depth, from) {
    const p = P(), cameFrom = G.depth;
    queuedAttack = false; queuedMove = null;   // a swing or step waiting on the last floor stays there
    p.grabbed = null; p.webbed = 0; p.held = 0;
    const fresh = !G.levels[depth];
    if (!fresh) { stepAside(G.levels[depth]); pruneRemains(G.levels[depth]); }
    if (!G.levels[depth]) { G.levels[depth] = Dungeon.generate(G.seed, depth, G.route ? { ...G.opts, route: G.route } : G.opts); placeRelics(G.levels[depth], depth); placeJewellery(G.levels[depth], depth); placeRobes(G.levels[depth], depth); placeFoci(G.levels[depth], depth); placeCloaks(G.levels[depth], depth); twistLevel(G.levels[depth], depth); caskLevel(G.levels[depth], depth); mimicLevel(G.levels[depth], depth); pieceLevel(G.levels[depth], depth); placeFallen(G.levels[depth], depth); hardenLevel(G.levels[depth], depth); pressLevel(G.levels[depth], depth); }
    G.depth = depth;
    // the view comes up out of the dark of the stair (see drawArrival in the renderer)
    fx.arriveAt = realNow;
    const L = G.levels[depth];
    // the first floor's stair up is under fallen rock: the way in came down behind the hero
    if (depth === 1 && L.stairsUp && !L.caved) L.caved = [L.stairsUp.y * L.w + L.stairsUp.x];
    const s = from === 'down' ? L.start : (L.downStart || L.start);
    p.x = s.x; p.y = s.y; p.dir = s.dir;
    clearLanding(L);
    // a floor of tremors starts its count again on arrival: rock left in the air when the hero went
    // never lands on them unmarked as they come back
    if (L.quake) L.quake = null;
    // you arrive beside the stair you came by; that one needs no announcing
    const came = stairsBeside();
    besideKey = came ? came.key : '';
    for (const m of L.monsters) { m.nextAct = G.t + 600 + Math.random() * 600; m.rx = m.x; m.ry = m.y; m.moveT1 = 0; m.windup = null; m.volley = null; }
    closeShop();
    snapCam();
    distFieldAt = -1e9;
    p.deepest = Math.max(p.deepest, depth);
    if (from === 'down') {
      if (depth > 1) log(`You descend to floor ${depth}. ${THEMES[L.theme].flavor}`, 'info');
      else log(THEMES[L.theme].flavor, 'info');
      if (L.isFinal) log(L.monsters.some(m => m.id === 'warlord') ? 'Somewhere ahead a war-drum booms, slow and heavy. The Warlord of the Warrens has taken the Heart\'s own hall.'
        : L.monsters.some(m => m.id === 'heartforged') ? 'The stone is warm underfoot, and somewhere ahead a great hammer rings on iron, slow as a heartbeat. This deep, the Heart rests where it was made, and something made to keep it keeps it still.'
        : 'A dreadful presence waits somewhere on this floor.', 'bad');
      if (L.twist && TWISTS[L.twist]) log(TWISTS[L.twist].arrive, L.twist === 'market' ? 'good' : 'info');
      namedArrives(L);
      bonesArrive(L);
      threadArrivals(L, depth, fresh);
    } else log(`You climb back up to floor ${depth}.`, 'info');
    // the companion comes down after the floor is told, so what it has to say
    // (a trick learned, a find, a wage asked) is not pushed out of sight by it
    companion.arrive(cameFrom);
    bounty.arrive(L);
    emit('level');
    checkTile();
  }
  /**
   * Whatever wandered onto the square the hero arrives on steps aside: coming
   * back up a stair put a hero on top of a monster that could then neither be
   * struck nor strike, and was drawn nowhere. A companion left there too.
   */
  function clearLanding(L) {
    const p = P();
    const open = (x, y) => passable(x, y) && !monsterAt(x, y) && !npcAt(x, y) && !propAt(x, y) && !companion.at(x, y) && !(x === p.x && y === p.y);
    const spot = () => {
      for (let r = 1; r <= 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) + Math.abs(dy) !== r) continue;
        if (open(p.x + dx, p.y + dy)) return [p.x + dx, p.y + dy];
      }
      return null;
    };
    for (const m of L.monsters) if (m.x === p.x && m.y === p.y) { const q = spot(); if (q) moveMonster(m, q[0], q[1]); }
    const c = G.companion;
    if (c && !c.fallen && c.depth === G.depth && c.x === p.x && c.y === p.y) { const q = spot(); if (q) { c.x = q[0]; c.y = q[1]; c.moveT1 = 0; } }
  }
  /** Why the hero cannot leave by the stairs right now, if they cannot. */
  function pinnedReason() {
    const p = P();
    if (p.held > G.t) return heldWhy();
    if (p.webbed > G.t) return 'You are stuck in the web. Push against it to tear free.';
    if (p.grabbed) return 'You are held fast. Pull free first.';
    return '';
  }
  /**
   * The stair divides a third of the way down: the first time down it from
   * that floor, the hero chooses a road (see ROUTES). Stepping onto it asks;
   * descend() on its own (the bot, the tests) takes the road the seed leans to.
   */
  function forkHere() {
    const span = Dungeon.routeSpan(G.opts.levels || 8);
    return !!span && G.depth === span.fork && !G.route;
  }
  function takeStairsDown() {
    if (!forkHere()) return descend();
    const pinned = pinnedReason();
    if (pinned) { blocked(pinned); return false; }
    G.forkPending = true;
    emit('fork');
    return true;
  }
  /** @param {string} id */
  function chooseRoute(id) {
    // the overlay can open in the same moment a blow kills: the dead take no road
    if (!ROUTES[id] || !forkHere() || G.status !== 'playing') return false;
    G.route = id; G.forkPending = false;
    log(`The stair divides. You take the way down into ${ROUTES[id].name}.`, 'info');
    descend();
    return true;
  }
  /** Standing back from the divided stair, undecided. */
  function leaveFork() { G.forkPending = false; }
  /**
   * A floor made before traders and encounters kept out of the way (see
   * inTheWay in dungeon.js) may have one standing in a doorway or before a
   * stair: it steps aside to an open square of the same room, one with room
   * floor on all four sides, so it can stand in nobody's way.
   * @param {import('./types.js').Level} L
   */
  function stepAside(L) {
    if (!L.roomId || !L.npcs) return;
    const at = (x, y) => (x < 0 || y < 0 || x >= L.w || y >= L.h ? T.WALL : L.tiles[y * L.w + x]);
    const USED = [T.DOOR, T.DOOR_OPEN, T.DOOR_LOCKED, T.SECRET, T.STAIRS_DOWN, T.STAIRS_UP, T.FOUNTAIN];
    const blocks = (x, y, room) => DIRS.some(([dx, dy]) => USED.includes(at(x + dx, y + dy)) || (at(x + dx, y + dy) === T.FLOOR && L.roomId[(y + dy) * L.w + x + dx] !== room));
    const open = (x, y, room) => DIRS.every(([dx, dy]) => at(x + dx, y + dy) === T.FLOOR && L.roomId[(y + dy) * L.w + x + dx] === room);
    for (const n of L.npcs) {
      const room = L.roomId[n.y * L.w + n.x];
      if (room < 0 || !blocks(n.x, n.y, room)) continue;
      let best = null, bd = Infinity;
      for (let i = 0; i < L.w * L.h; i++) {
        if (L.roomId[i] !== room || L.tiles[i] !== T.FLOOR) continue;
        const x = i % L.w, y = (i / L.w) | 0, dd = Math.abs(x - n.x) + Math.abs(y - n.y);
        if (dd >= bd || !open(x, y, room) || (L.items[x + ',' + y] || []).length || (L.traps && L.traps[x + ',' + y])) continue;
        if (L.npcs.some(o => o !== n && o.x === x && o.y === y) || L.monsters.some(m => m.x === x && m.y === y)) continue;
        if (L === G.levels[G.depth] && G.player && G.player.x === x && G.player.y === y) continue;   // not onto the hero
        best = [x, y]; bd = dd;
      }
      if (best) { n.x = best[0]; n.y = best[1]; }
    }
  }
  function descend() {
    if (G.status !== 'playing') return;
    const pinned = pinnedReason();
    if (pinned) { blocked(pinned); return; }
    if (forkHere()) { G.route = new Rng(`${G.seed}|road`).next() < 0.5 ? 'crypts' : 'warrens'; G.forkPending = false; }
    Sound.play('stairs');
    enterLevel(G.depth + 1, 'down');
    save(true);
  }
  function ascend() {
    const pinned = pinnedReason();
    if (pinned) { blocked(pinned); return; }
    if (G.depth === 1) {
      log('The way you came in lies under fallen rock. Only the depths remain.', 'info');
      return;
    }
    Sound.play('stairs');
    enterLevel(G.depth - 1, 'up');
    save(true);
  }

  // ---------- movement ----------
  // ---------- finding the way on ----------
  // A staircase is a block set into the wall, so you can stand right beside
  // one and be facing stone. The two moments a player does that and then asks
  // the game for help, bumping the wall and searching it, used to answer with
  // nothing useful. Point at the stairs instead.
  const SIDE_WORDS = ['ahead', 'on your right', 'behind you', 'on your left'];
  let besideKey = '';
  function stairsBeside() {
    const p = P();
    for (let k = 0; k < 4; k++) {
      const sx = p.x + DIRS[k][0], sy = p.y + DIRS[k][1], t = tile(sx, sy);
      if (t !== T.STAIRS_DOWN && t !== T.STAIRS_UP) continue;
      // the entrance is sealed behind you, so it is no way on
      if (t === T.STAIRS_UP && G.depth === 1) continue;
      const rel = (k - p.dir + 4) % 4;
      if (rel === 0) continue;
      return { down: t === T.STAIRS_DOWN, rel, word: SIDE_WORDS[rel], key: `${G.depth}:${sx},${sy}` };
    }
    return null;
  }
  function stairHint() {
    const s = stairsBeside();
    return s ? ` The stairs ${s.down ? 'down' : 'up'} are ${s.word}.` : '';
  }
  // Say so once when a step brings a staircase alongside, not on every step.
  function noticeStairs() {
    const s = stairsBeside();
    const k = s ? s.key : '';
    if (s && k !== besideKey) log(`Stairs lead ${s.down ? 'down' : 'up'}, ${s.word}.`, 'info');
    besideKey = k;
  }
  /** What Use will do right now, so the button can say it. Mirrors use(). */
  function useLabel() {
    if (!G || G.status !== 'playing') return 'Use';
    const p = P();
    if (takeable().length) return 'Take';
    const tx = p.x + DIRS[p.dir][0], ty = p.y + DIRS[p.dir][1], t = tile(tx, ty);
    if (t === T.DOOR) return 'Open';
    if (t === T.DOOR_LOCKED) return P().inv.some(it => it.t === 'key' && it.color === (lvl().locks[key(tx, ty)] || 'brass')) ? 'Unlock' : companion.picker(tx, ty) ? 'Pick' : 'Force';
    if (t === T.STAIRS_DOWN) return 'Descend';
    if (t === T.STAIRS_UP) return G.depth > 1 ? 'Climb' : 'Use';
    if (t === T.FOUNTAIN) return 'Drink';
    if (npcAt(tx, ty)) return npcAt(tx, ty).kind === 'encounter' ? 'Examine' : 'Trade';
    if (companion.at(tx, ty) && !monsterAt(tx, ty)) return companion.here().mode === 'stay' ? 'Come' : 'Stay';
    if (lvl().snares && lvl().snares[key(tx, ty)] && !monsterAt(tx, ty)) return 'Disarm';
    // Use still strikes what is in front, but the button beside it already
    // says Attack; two buttons with one name read as a mistake
    // (a mimic still shut is a barrel to the eye, and to the button)
    if (monsterAt(tx, ty)) return monsterAt(tx, ty).disguised ? 'Break' : 'Use';
    if (propAt(tx, ty)) return 'Break';
    if (t === T.DOOR_OPEN && !(lvl().burntDoors || {})[key(tx, ty)]) return 'Close';
    // a hidden door reads as wall until found, so it must not label differently
    if (t === T.WALL || t === T.TORCH || t === T.SECRET) return 'Search';
    // draughts underfoot the belt has no room for: say why they stay there
    if (beltFull()) return 'Belt full';
    return 'Use';
  }
  /** Potions lie underfoot, and the belt holds all it can of every one of them. */
  const beltFull = () => floorItems().some(it => it.t in ITEMS && ITEMS[it.t].kind === 'potion' && beltRoom(it.t) <= 0);
  function tryMove(rel) {
    const p = P();
    if (p.held > G.t) { blocked(heldWhy()); return false; }
    if (p.webbed > G.t) {
      // every push tears at it, though no faster than a push a quarter second:
      // a held button resends every frame and used to shred it in a moment
      if (G.t - (p.lastTear || -1e9) >= 250) { p.webbed -= 400; p.lastTear = G.t; }
      if (p.webbed > G.t) { blocked('You struggle against the web.'); return false; }
      log('You tear free of the web.', 'good');
      learn('spider', 'answer');
    }
    if (p.grabbed) {
      const g = lvl().monsters.find(o => o.uid === p.grabbed.uid);
      if (!g || g.collapsed || G.t >= p.grabbed.until || Math.abs(g.x - p.x) + Math.abs(g.y - p.y) !== 1) p.grabbed = null;
      else {
        const who = mstat(g).name;
        if (G.t < p.grabbed.nextTry) { blocked(`The ${who} holds you fast.`); return false; }
        // strength tears free, or quickness slips out: whichever the hero has more of
        const how = mod(p.stats.dex) > mod(p.stats.str) ? 'dex' : 'str', c = trickSave(how, 'grip');
        if (!c.pass) { p.grabbed.nextTry = G.t + 600; blocked(`The ${who}'s grip holds you fast.${c.note}`); return false; }
        p.grabbed = null;
        log(`You ${how === 'dex' ? 'slip' : 'tear'} free of the ${who}'s grip!${c.note}`, 'good');
        learn(g.id, 'answer');
      }
    }
    const dir = (p.dir + rel) % 4;
    const nx = p.x + DIRS[dir][0], ny = p.y + DIRS[dir][1];
    const t = tile(nx, ny);
    if (t === T.WALL || t === T.TORCH) { blocked('A wall blocks your path.' + stairHint()); return false; }
    if (t === T.DOOR) { openDoor(nx, ny); return true; }
    // only a door faced is forced: a strafe or a step back out of a blow, against
    // a locked door, used to throw a shoulder at it and lose the moment to the lock
    if (t === T.DOOR_LOCKED) { tryUnlock(nx, ny, rel === 0); return true; }
    if (t === T.STAIRS_DOWN) { takeStairsDown(); return true; }
    if (t === T.STAIRS_UP) { ascend(); return true; }
    if (t === T.SECRET) { revealSecret(nx, ny, false); return true; }
    if (t === T.FOUNTAIN) { drinkFountain(nx, ny); return true; }
    const trader = npcAt(nx, ny);
    if (trader) { if (trader.kind === 'encounter') encs.openEncounter(trader); else openShop(trader); return true; }
    // walking into a barrel, crate or urn kicks it over: it is not walked through
    // like air, nor left in the way (the step is spent on it)
    const prop = propAt(nx, ny);
    if (prop && !monsterAt(nx, ny)) { smash(lvl(), prop, true); return true; }
    const m = monsterAt(nx, ny);
    if (m && m.sunk) { surface(m, 'step'); return false; }
    // walking into a barrel kicks it: a mimic so touched has the hero (the step is spent)
    if (m && m.disguised) { spring(m, 'touch'); return true; }
    if (m) { m.awake = true; log(`The ${MONSTERS[m.id].name} blocks your way.`); return false; }
    // anything the interactive cases above did not claim had better be walkable
    if (!passable(nx, ny)) { blocked('Something blocks your path.'); return false; }
    // the hound steps into your square as you step into its own
    if (companion.at(nx, ny)) companion.swap(p.x, p.y);
    p.x = nx; p.y = ny; p.steps++;
    // a step is heard (by the eyeless, which hunt by it); a turn on the spot is not
    p.noiseAt = G.t;
    if (rel === 1 || rel === 3) p.shadowUntil = G.t + 2500;
    startCam(lvl().twist === 'flooded' ? Math.round(MOVE_MS * FLOOD_SLOW) : MOVE_MS);
    // (wading, where the floor is flooded or a pool lies, sounds like it)
    Sound.play('step', { water: elements.wet(p.x, p.y) });
    distFieldAt = -1e9;
    onStep();
    const eye = (p.cls === 'thief' ? 0.5 : 0) + (p.bg === 'tombwise' ? 0.35 : 0) + (hasPower('seer') ? 0.35 : 0);
    if (eye > 0) for (const [dx, dy] of DIRS) if (tile(p.x + dx, p.y + dy) === T.SECRET && Math.random() < eye) revealSecret(p.x + dx, p.y + dy, true);
    checkTile();
    if (G.status === 'playing') { noticeStairs(); noticePiece(); }
    return true;
  }
  /** The first step into a floor's set piece: a line on what it is, once. */
  function noticePiece() {
    const L = lvl(), pc = L.piece;
    if (!pc || pc.seen || !L.roomId || L.roomId[P().y * L.w + P().x] !== pc.room) return;
    pc.seen = true;
    if (PIECE_SAY[pc.kind]) log(PIECE_SAY[pc.kind], 'info');
  }
  function turn(dd) {
    const p = P();
    p.dir = (p.dir + dd + 4) % 4;
    startCam(TURN_MS);
  }
  // Bumping something should be legible, not just audible, but repeating the
  // same line while a key is held would bury the log.
  let lastBlocked = -1e9;
  function blocked(message) {
    Sound.play('bump');
    if (G.t - lastBlocked <= 700) return;
    lastBlocked = G.t;
    log(message);
  }
  function openDoor(x, y) {
    const f = elements.fieldAt(x, y);
    if (f && f.k === 'fire') { log('The door is burning: it is too hot to touch.', 'bad'); return; }
    setTile(x, y, T.DOOR_OPEN); P().noiseAt = G.t; log('You push the door open.'); Sound.play('door');
  }
  function revealSecret(x, y, keenEyes) {
    setTile(x, y, T.DOOR_OPEN);
    log(keenEyes ? 'Your keen eyes spot a secret door!' : 'You find a secret door!', 'good');
    Sound.play('secret');
  }
  function drinkFountain(x, y) {
    const L = lvl(), p = P();
    const f = L.features && L.features[key(x, y)];
    if (!f || f.used) { log('The fountain is dry.'); return; }
    f.used = true;
    noteHealed(p.maxHp - p.hp);
    p.hp = p.maxHp; p.sp = p.maxSp; p.poison = null;
    fx.healUntil = realNow + 400;
    log('You drink deeply from the fountain. Your wounds close and your mind clears.', 'good');
    Sound.play('fountain');
    emit('stats');
  }
  function tryUnlock(x, y, force = true) {
    const L = lvl(), p = P();
    // a door on fire is no more to be handled locked than unlocked
    const fire = elements.fieldAt(x, y);
    if (fire && fire.k === 'fire') { log('The door is burning: it is too hot to touch.', 'bad'); return false; }
    const color = L.locks[key(x, y)] || 'brass';
    const k = p.inv.find(it => it.t === 'key' && it.color === color);
    // the goblin opens it with a bent wire, quietly, where there is no key
    const pick = !k && companion.picker(x, y);
    if (pick) {
      setTile(x, y, T.DOOR_OPEN);
      delete L.locks[key(x, y)];
      pick.locks = (pick.locks || 0) + 1;
      log(`${pick.name} kneels at the lock, fiddles a bent wire about in it, and it clicks open.`, 'good');
      Sound.play('door', { how: 'unlock' });
      p.nextAttack = G.t + 1200;
      return true;
    }
    if (!k && !force) { blocked(`The door is locked. It needs a ${color} key; face it to force it.`); return false; }
    if (!k) {
      // a strong character can force a locked door, slowly and loudly
      const chance = 0.08 + mod(p.stats.str) * 0.05 + (p.cls === 'fighter' ? 0.1 : 0);
      if (Math.random() < Math.max(0.05, chance)) {
        setTile(x, y, T.DOOR_OPEN);
        delete L.locks[key(x, y)];
        log('You throw your shoulder against the door and it bursts open!', 'good');
        Sound.play('door', { how: 'forced' }); buzz([60, 40, 120]);
        for (const m of L.monsters) if (Math.abs(m.x - x) + Math.abs(m.y - y) < 10) m.awake = true;
        return true;
      }
      log(`The door is locked. It needs a ${color} key. You fail to force it.`, 'bad');
      Sound.play('locked'); buzz(35);
      p.nextAttack = G.t + 700; // forcing it costs you a moment
      return false;
    }
    removeOne(k);
    delete L.locks[key(x, y)];
    setTile(x, y, T.DOOR_OPEN);
    log(`You unlock the door with the ${color} key.`, 'good');
    Sound.play('door', { how: 'unlock' });
    emit('inv');
    return true;
  }
  function onStep() {
    const p = P();
    if (p.steps % 8 === 0) {
      p.food = Math.max(0, p.food - 1);
      if (p.food === 30) log('You are getting hungry.', 'bad');
      if (p.food === 10) log('You are very hungry!', 'bad');
    }
    if (p.food === 0 && p.steps % 6 === 0) hurtPlayer(1, 'You are starving!', null, 'hunger');
    // a Spellbook in hand brings them back a quarter faster
    if (p.maxSp && p.sp < p.maxSp && p.steps % (hasTalent('arcane_flow') ? (focusHas('regen') ? 3 : 4) : (focusHas('regen') ? 7 : 9)) === 0) p.sp++;
  }
  function checkTile() {
    const L = lvl(), p = P(), k = key(p.x, p.y);
    if (L.traps[k]) triggerTrap(k);
    if (G.status !== 'playing') return;
    if (L.items[k] && L.items[k].length) {
      pickupAll(true); heartHeld();
      const left = (L.items[k] || []).filter(it => !it.left && uselessToClass(it));
      for (const it of left) it.left = 1;   // said once: after this it is simply lying there
      if (left.length) log(`You leave ${left.length === 1 ? the(left[0]) : left.map(it => the(it)).join(', ').replace(/, ([^,]*)$/, ' and $1')} ${left.length === 1 ? 'where it lies' : 'where they lie'}: no use to a ${CLASSES[p.cls].name.toLowerCase()}. Take lifts ${left.length === 1 ? 'it' : 'them'}, for the trader.`);
    }
  }
  /** How well a trap is set, before the depth adds to it: what a Dexterity save must beat. */
  const TRAP_DC = 12;
  const TRAP_DODGED = {
    dart: 'A dart shoots from the wall, but you twist aside and it clatters past!',
    needle: 'A needle springs from the floor, but you snatch your foot back in time!',
  };
  // Venom is fought off with Constitution: one d20 against how strong it is
  // and how deep the hero has come. A spider's bite is the mildest, a trap's
  // needle and a tainted draught stronger. Returns the check, or null when
  // nothing needs saving against (poisoned already, or proof against it).
  const VENOM_DC = { bite: 7, needle: 10, draught: 11, spores: 9 };
  // A trick that lands can still be weathered: a save halves what it does
  // (stone or web for half as long, half a storm's fire) or, for a charge,
  // keeps the hero on their feet. The trick's own answer (step aside, turn
  // away) still escapes it whole: the save is for when that fails. All grow
  // harder with depth, as venom does.
  const MOSS_HIDES = 4;
  /** What the hero adds to the Wisdom check that spots a trap underfoot. */
  function trapEye() {
    const p = P();
    // (moss over an overgrown floor hides the flagstone, from all but a druid, who reads it)
    const moss = lvl().twist === 'overgrown' && p.cls !== 'druid' ? MOSS_HIDES : 0;
    return (p.cls === 'thief' ? 8 + Math.floor(p.level / 2) : 0) + (p.bg === 'tombwise' ? 7 : 0) + jewelBonus('seer') + tricksterTraps() - moss;
  }
  const SAVE_DC = { claw: 10, grip: 10, drain: 4, drink: 8, gaze: 11, web: 11, charge: 12, nova: 11, spot: 18, breath: 11, firepot: 11, stamp: 11, chill: 11, storm: 11, flare: 11, sweep: 11 };
  const saveDC = kind => SAVE_DC[kind] + Math.ceil(G.depth / 2);
  /** A saving throw against a monster's trick. */
  // a Ring of Evasion counts toward every save: the tricks, venom and traps
  const trickSave = (stat, kind, bonus = 0) => statCheck(stat, saveDC(kind), bonus + jewelBonus('evasion') + heroSaves());
  function venomSave(kind, whose, quiet = false) {
    const p = P();
    if (p.poison || hasPower('pure')) return null;
    const c = statCheck('con', VENOM_DC[kind] + Math.ceil(G.depth / 2), jewelBonus('evasion') + heroSaves());
    if (!c.pass) p.poison = poisonFor();
    if (!quiet) log(c.pass ? `You shake off ${whose} venom.${c.note}` : `${cap(whose)} venom takes hold: you are poisoned!${c.note}`, c.pass ? 'good' : 'bad');
    return c;
  }
  /** Which picture a trap going off gets. */
  const trapKindOf = tr => Object.keys(TRAP_TYPES).find(id => TRAP_TYPES[id] === tr) || '';
  function triggerTrap(k) {
    const L = lvl();
    const tr = TRAP_TYPES[L.traps[k]];
    delete L.traps[k];
    // a kobold's snare lies in plain sight: walked into, it springs (there is no spotting
    // what was seen), but a quick foot may still pull clear as it snaps
    if (L.snares && L.snares[k]) { delete L.snares[k]; return snareSprung(tr); }
    if (L.trapsKnown) { log(`You step round the ${tr.name} you were told of.`, 'good'); return; }
    // a Wisdom check to notice the loose flagstone, whatever the hero's trade;
    // a thief knows what to look for (more with each level), and so do the
    // tombwise. No eye for it, no lucky twenty: it is noticed or not
    const eye = trapEye();
    const seen = statCheck('wis', saveDC('spot'), eye, { natural: false });
    // each is seen as it goes off (see the renderer); a dart comes from one wall or the other
    const [tx, ty] = k.split(',').map(Number);
    fx.trapAt = realNow; fx.trapSide = (tx + ty) % 2 ? 1 : -1;
    if (seen.pass) {
      fx.trapKind = 'disarm';
      log(`You spot and disarm ${/^[aeiou]/i.test(tr.name) ? 'an' : 'a'} ${tr.name}.${seen.note}`, 'good');
      Sound.play('locked');
      return;
    }
    fx.trapKind = trapKindOf(tr);
    // a sprung trap can still be dodged: Dexterity, against how well it was
    // set, and deeper ones are set better. A dart or a needle then misses
    // outright; a pit is only half a fall, caught at its edge. A gong cannot
    // be dodged: its harm is the noise.
    const dodge = tr.dmg ? statCheck('dex', TRAP_DC + Math.ceil(G.depth / 2), jewelBonus('evasion') + heroSaves() + tricksterTraps()) : null;
    const pit = tr === TRAP_TYPES.pit;
    fx.trapDodged = !!(dodge && dodge.pass && !pit);
    // a fall shakes the view longer than a blow: set once the harm (which
    // shakes it for a blow) has been done
    const fallShake = () => { if (pit) { fx.shakeAmp = dodge && dodge.pass ? 3 : 6; fx.shakeMs = 700; fx.shakeUntil = realNow + 700; } };
    fallShake();
    Sound.play('trap');
    if (tr.dmg && dodge.pass && !pit) {
      log(`${TRAP_DODGED[trapKindOf(tr)] || 'You spring clear of a trap!'}${dodge.note}`, 'good');
    } else if (tr.dmg) {
      let n = Math.max(1, d(...tr.dmg));
      if (dodge.pass) n = Math.max(1, Math.ceil(n / 2));
      hurtPlayer(n, `${tr.msg}${dodge.pass ? ' You catch the edge as you fall.' : ''} You take ${n} damage.${dodge.note}`, null, `a ${tr.name}`);
      fallShake();
      // a needle that finds you: its venom is fought off, or not
      if (tr.poison && G.status === 'playing') venomSave('needle', 'the needle\'s');
    } else log(tr.msg, 'bad');
    if (tr.alarm) for (const m of L.monsters) m.awake = true;
  }

  /** A kobold's snare closing on the hero: a Dexterity save pulls the foot clear; else it holds, and bites. */
  function snareSprung(tr) {
    const p = P();
    fx.trapAt = realNow; fx.trapKind = 'snare'; fx.trapSide = 1;
    Sound.play('trap');
    const dodge = statCheck('dex', TRAP_DC + Math.ceil(G.depth / 2), jewelBonus('evasion') + heroSaves() + tricksterTraps());
    fx.trapDodged = dodge.pass;
    if (dodge.pass) { log(`The wire snare snaps, and you snatch your foot clear!${dodge.note}`, 'good'); return; }
    const n = Math.max(1, d(...tr.dmg));
    hurtPlayer(n, `${tr.msg} (${n})${dodge.note}`, null, 'a kobold\'s snare');
    if (G.status === 'playing' && !((p.held || 0) > G.t + tr.hold)) { p.held = G.t + tr.hold; p.heldBy = 'snare'; }
  }
  /** Sprung from where the hero stands, with a foot well back: the snare ahead is harmless now. */
  function disarmSnare(k) {
    const L = lvl(), by = L.snares[k];
    delete L.snares[k]; delete L.traps[k];
    log('You spring the wire snare with your boot well back. It snaps shut on nothing.', 'good');
    Sound.play('locked');
    const m = L.monsters.find(o => o.uid === by);
    learn(m ? m.id : 'kobold', 'answer');
  }
  /** Whether a kobold could set a snare here: open floor, nothing on it, no trap already. */
  function snareable(x, y) {
    const L = lvl(), p = P();
    return tile(x, y) === T.FLOOR && !L.traps[key(x, y)] && !monsterAt(x, y) && !npcAt(x, y) && !propAt(x, y) && !(p.x === x && p.y === y);
  }
  const snaresBy = uid => Object.values(lvl().snares || {}).filter(u => u === uid).length;
  /** A snare set: seen where it lies (and sprung at once on a hero who stepped onto the square). @returns {boolean} whether it was set */
  function setSnare(x, y, uid) {
    const L = lvl(), p = P(), k = key(x, y);
    if (tile(x, y) !== T.FLOOR || L.traps[k] || monsterAt(x, y) || npcAt(x, y) || propAt(x, y)) return false;
    L.traps[k] = 'snare';
    (L.snares = L.snares || {})[k] = uid;
    if (p.x === x && p.y === y) triggerTrap(k);
    return true;
  }
  /** A kobold dead: what it set goes slack with it. */
  function snaresSlack(m) {
    const L = lvl();
    if (!L.snares) return;
    const keys = Object.keys(L.snares).filter(k => L.snares[k] === m.uid);
    for (const k of keys) { delete L.snares[k]; delete L.traps[k]; }
    if (keys.length) log(keys.length === 1 ? 'Its snare goes slack.' : 'Its snares go slack.', 'good');
  }

  // ---------- interaction ----------
  function use() {
    const p = P();
    const [dx, dy] = DIRS[p.dir];
    const tx = p.x + dx, ty = p.y + dy, t = tile(tx, ty);
    if (takeable().length) { pickupAll(); return; }
    if (t === T.DOOR) return openDoor(tx, ty);
    if (t === T.DOOR_LOCKED) return tryUnlock(tx, ty);
    if (t === T.STAIRS_DOWN) return takeStairsDown();
    if (t === T.STAIRS_UP) return ascend();
    if (t === T.SECRET) return revealSecret(tx, ty, false);
    if (t === T.FOUNTAIN) return drinkFountain(tx, ty);
    const ahead = npcAt(tx, ty);
    if (ahead) return ahead.kind === 'encounter' ? encs.openEncounter(ahead) : openShop(ahead);
    if (lvl().snares && lvl().snares[key(tx, ty)] && !monsterAt(tx, ty)) return disarmSnare(key(tx, ty));
    if (monsterAt(tx, ty)) return attack();
    if (companion.at(tx, ty)) return companion.toggle();
    if (propAt(tx, ty)) return attack();   // a barrel, crate or urn ahead: break it
    if (t === T.WALL || t === T.TORCH) { log('You search the wall but find nothing.' + stairHint()); return; }
    if (t === T.DOOR_OPEN) {
      if (monsterAt(tx, ty) || (lvl().items[key(tx, ty)] || []).length) { log('Something is in the doorway.'); return; }
      const f = elements.fieldAt(tx, ty);
      if ((lvl().burntDoors || {})[key(tx, ty)]) { log('The door lies burnt in the doorway. There is nothing left to shut.'); return; }
      if (f && f.k === 'fire') { log('Fire burns in the doorway.', 'bad'); return; }
      setTile(tx, ty, T.DOOR); log('You pull the door shut.'); Sound.play('door', { how: 'shut' }); return;
    }
    if ((lvl().items[key(tx, ty)] || []).length) { log('Step forward onto it to pick it up.'); return; }
    if (beltFull()) { log(`Your belt holds ${BELT} of each draught. Drink one to make room, or leave these.`); return; }
    log('There is nothing to use here.');
  }

  // ---------- trading ---------- see trader.js ----------
  // ---------- the way in, played as a new run opens: see prelude.js ----------
  const { FROST_SPELLS, assassinQuiet, berserkerFrenzy, berserkerOpen, berserkerRage, buffAmount, buffDuration, capped, capstoneOf, dawnBlow, healerHeal, healerMercy, healerSp, heroSaves, kindles, knightGuard, knightShieldAC, knightSteadfast, onPath, pathOf, pyroFire, setBurning, setWorn, sneakMult, spellCost, spellDesc, spellHold, templarBlow, templarSmite, tricksterOpening, tricksterPurse, tricksterSlip, tricksterTraps } = makePaths({
    get G() { return G; }, get STAT_WORD() { return STAT_WORD; }, get wild() { return wild; }, get P() { return P; }, get mstat() { return mstat; }, get effectFrom() { return effectFrom; },
    get emit() { return emit; }, get focusHas() { return focusHas; }, get hasTalent() { return hasTalent; }, get lvl() { return lvl; }, get noteHealed() { return noteHealed; },
    get opening() { return opening; }, get spellDC() { return spellDC; },
  });
  const combos = makeCombos({
    get G() { return G; }, get P() { return P; }, get log() { return log; }, get floatText() { return floatText; }, get pathOf() { return pathOf; },
    noteCombo: id => Progress.noteCombo(id), className: cls => CLASSES[cls].name,
    legendCarried: () => { const it = Object.values(P().eq).find(x => x && x.u && RELICS[x.u] && RELICS[x.u].legend); return it ? RELICS[it.u].name : ''; },
  });
  const { threads, THREAD_SAID, bargained, vouched, threadArrivals, threadNotes } = makeThreads({
    get G() { return G; }, get P() { return P; }, get log() { return log; }, get key() { return key; }, get passable() { return passable; }, get tile() { return tile; },
    get T() { return T; }, get monsterAt() { return monsterAt; }, get newMonster() { return newMonster; }, get setTile() { return setTile; }, get healPlayer() { return healPlayer; },
    get farthestFloor() { return farthestFloor; }, get bounty() { return bounty; }, get companion() { return companion; },
  });
  const lairs = makeLairs({
    get G() { return G; }, get P() { return P; }, get lvl() { return lvl; }, get passable() { return passable; }, get tile() { return tile; }, get T() { return T; },
    get monsterAt() { return monsterAt; }, get npcAt() { return npcAt; }, companionAt: (x, y) => companion.at(x, y), get log() { return log; }, get floatText() { return floatText; },
    get fx() { return fx; }, get realNow() { return realNow; }, get learn() { return learn; }, get elements() { return elements; }, get heard() { return heard; }, get newMonster() { return newMonster; },
  });
  const legends = makeLegends({
    get combos() { return combos; }, get capped() { return capped; },
    get G() { return G; }, get P() { return P; }, get lvl() { return lvl; }, get hasPower() { return hasPower; }, get log() { return log; }, get pathOf() { return pathOf; },
    get key() { return key; }, get relicItem() { return relicItem; }, get floatText() { return floatText; }, get shaped() { return () => wild.shaped(); }, get heard() { return heard; },
    get opening() { return opening; }, get mstat() { return mstat; }, get healPlayer() { return healPlayer; }, get monsterAt() { return monsterAt; },
    get damageMonster() { return damageMonster; }, get elements() { return elements; }, get passable() { return passable; },
    get runStats() { return runStats; }, get itemName() { return itemName; },
  });
  const prelude = makePrelude({ lvl: () => lvl(), get fx() { return fx; }, log: (msg, cls) => log(msg, cls) });
  // ---------- encounters: see meet.js ----------
  let queuedAttack = false;
  let queuedMove = null;       // one step tapped while the camera was still moving
  let castingName = '';        // the spell whose blast is landing, so the log can name it
  // How long what a blow looks and sounds like waits behind the blow itself: a
  // scroll's fireball is settled the moment the scroll is read, but its number,
  // flash, blood and any death wait until the fireball bursts on screen.
  let fxDelay = 0;
  /** Play a sound now, or when the picture it goes with lands. */
  // (a new run, a load or a death puts paid to any still waiting: fxGen moves on)
  let fxGen = 0;
  const soon = fn => { if (fxDelay > 0) { const d = fxDelay, gen = fxGen; setTimeout(() => { if (gen === fxGen) fn(); }, d); } else fn(); };
  /** What in the pack this hero's class can never use: the trader takes it all in one go. */
  const junkInPack = () => P().inv.filter(it => uselessToClass(it));

  // ---------- main update ----------
  /** How ready the next blow is, from 0 just swung to 1 ready: the Attack button shows it. */
  function attackReady() {
    if (!G) return 1;
    const p = P(), left = p.nextAttack - G.t;
    return left <= 0 ? 1 : Math.max(0, 1 - left / weapon().speed);
  }
  // ---------- testing aids: see testing.js ----------
  const aids = makeTesting({
    get G() { return G; }, P: () => P(), lvl: () => lvl(), log: (m, c) => log(m, c), emit: k => emit(k),
    enterLevel: (d, f) => enterLevel(d, f), save: q => save(q), checkLevelUp: () => checkLevelUp(), renownAt: n => renownAt(n),
    giveItem: it => giveItem(it), relicItem: id => relicItem(id), discoverRelic: id => discoverRelic(id),
  });
  const { setTesting, testingOn, testFloor, testReveal, testLevel, testGifts, testGive, applyTesting } = aids;
  function update(now, dt) {
    realNow = now;
    if (!G || G.status !== 'playing') return;
    // the dungeon holds still while the way in plays
    if (prelude.active()) return;
    G.t += dt;
    applyTesting();
    const p = P();
    fx.hpFrac = p.hp / p.maxHp;
    updateCam();
    if (queuedAttack && G.t >= p.nextAttack) { queuedAttack = false; attack(); }
    if (queuedMove && !(cam.moving && camProgress() < 0.7)) { const q = queuedMove; queuedMove = null; if (q.at <= G.t && G.t - q.at < 400) input(q.act); }
    updateMonsters();
    if (G.status !== 'playing') return;
    companion.turn();
    // fire spreads and burns, ice melts
    elements.tick();
    notePieces();
    if (G.status !== 'playing') return;
    // out of combat and unpursued, wounds close slowly on their own
    // (only up to half the hero's life: past that it takes a rest, a draught or a prayer)
    const regenTo = Math.ceil(p.maxHp * (p.bg === 'heartsworn' ? HEARTSWORN_CAP : REGEN_CAP));
    if (p.hp < regenTo && p.food > 0 && G.t - (p.lastHurt || 0) > 5000 && G.t >= (p.nextRegen || 0)) {
      ensureDist();
      const L = lvl();
      const hunted = L.monsters.some(m => m.awake && distField[m.y * L.w + m.x] >= 0 && distField[m.y * L.w + m.x] <= 6);
      if (!hunted) {
        // scale with the pool so recovery takes about the same time at every level
        const hardy = p.cls === 'fighter' ? 1.6 : 1;
        const was = p.hp;
        // Slow to Bleed is half again what this hero heals, carried over in parts
        // so that it still counts on a small pool, where one point a beat is all
        const step = Math.max(1, Math.round(p.maxHp / 35 * hardy)) * (1 + (p.perkRegen || 0)) + (p.regenCarry || 0);
        const heal = Math.floor(step);
        p.regenCarry = step - heal;
        p.hp = Math.min(regenTo, p.hp + heal);
        noteHealed(p.hp - was);
        p.nextRegen = G.t + (p.cls === 'fighter' ? 1900 : 2200);
        emit('stats');
      } else p.nextRegen = G.t + 1200;
    }
    if (p.hp < p.maxHp && effectFrom('ac', 'protection') && hasTalent('warding_light') && G.t >= (p.nextWard || 0)) {
      p.hp++; p.nextWard = G.t + 3000; emit('stats');
    }
    healerMercy();
    wild.tick();
    // Beast Bond: a companion close at a druid's side mends a little, even mid-fight
    if (hasTalent('beast_bond') && G.t >= (p.nextKin || 0)) {
      const c = companion.here();
      p.nextKin = G.t + 3000;
      if (c && Math.abs(c.x - p.x) + Math.abs(c.y - p.y) <= 3) companion.mend(1);
    }
    if (p.hp < p.maxHp && G.t >= (p.nextMend || 0) && hasPower('mend')) {
      p.hp++; p.nextMend = G.t + 4000; emit('stats');
    }
    // a grip ends when the thing holding you is gone, down or out of reach
    if (p.grabbed) {
      const g = lvl().monsters.find(o => o.uid === p.grabbed.uid);
      if (!g || g.collapsed || G.t >= p.grabbed.until || Math.abs(g.x - p.x) + Math.abs(g.y - p.y) !== 1) p.grabbed = null;
    }
    if (p.poison) {
      if (G.t >= p.poison.until) { p.poison = null; log('The poison wears off.', 'good'); }
      else if (G.t >= p.poison.next) { p.poison.next = G.t + 2000; hurtPlayer(1, 'The poison burns in your veins.', null, 'poison'); }
    }
    for (const k in p.effects) if (p.effects[k].until <= G.t) { delete p.effects[k]; if (k === 'ac' && p.mirrors) { p.mirrors = 0; log('Your images fade with the shield.'); } log(k.startsWith('boon_') ? 'A blessing you were given fades.' : k.startsWith('crew_') ? 'The crew\'s song fades.' : k === 'ac' ? 'Your magical protection fades.' : (k === 'hit' ? 'The blessing fades.' : 'You feel less mighty.')); }
    fx.texts = fx.texts.filter(t => t.until > now);
    if (fx.spells.length) fx.spells = fx.spells.filter(s => s.until > now);
    if (fx.corpses.length) fx.corpses = fx.corpses.filter(c => now - c.born < CORPSE_MS);
    for (const k in fx.doors) if (now - fx.doors[k].at > DOOR_MS) delete fx.doors[k];
    if (fx.bits.length) fx.bits = fx.bits.filter(b => now - b.born < b.life);
    if (fx.drops.length) fx.drops = fx.drops.filter(d => now - d.born < d.life);
  }
  function tick(now) { realNow = now; }

  /** @param {string} act @param {boolean} [repeat]  sent again because a button is still held, not a fresh press */
  function input(act, repeat) {
    if (!G || G.status !== 'playing') return;
    // any control during the way in skips it, and does nothing else
    if (prelude.active()) { prelude.finish(realNow); return; }
    switch (act) {
      case 'forward': case 'back': case 'strafeL': case 'strafeR': case 'left': case 'right':
        // a step tapped while the last one is still easing in is kept, not
        // dropped: the tap that turns you to face a flanker must not be lost
        // A held button is resent every frame; only a fresh press is kept, or
        // a single tap on Turn would queue a second turn and spin you round.
        if (cam.moving && camProgress() < 0.7) { if (!repeat) queuedMove = { act, at: G.t }; return; }
        queuedMove = null;
        queuedAttack = false;              // a step or turn cancels a waiting swing
        if (act === 'forward') tryMove(0);
        else if (act === 'back') tryMove(2);
        else if (act === 'strafeR') tryMove(1);
        else if (act === 'strafeL') tryMove(3);
        else if (P().held > G.t) blocked(heldWhy());   // stone or sprawled, you cannot turn either
        else if (act === 'left') turn(-1);
        else turn(1);
        break;
      case 'attack': case 'cast': case 'use': case 'rest': case 'quaff': case 'read': case 'take':
        if (P().held > G.t) { blocked(heldWhy()); return; }
        if (act !== 'attack') { if (act === 'use') use(); else if (act === 'take') takeHere(); else if (act === 'cast') castLast(); else if (act === 'quaff') quaff(); else if (act === 'read') readQuick(); else rest(); return; }
        // a tap a moment early is kept and spent the instant the blow is ready,
        // rather than dropped: a player cannot see the swing timer
        if (G.t < P().nextAttack) { if (P().nextAttack - G.t <= 350) queuedAttack = true; }
        else attack();
        break;
    }
  }

  // ---------- monsters ---------- to how hard the delve is: see foes.js ----------
  // What that module borrows from here goes through these getters (and setters
  // for the state it changes), so it always sees the game as it is now.
  const foesK = {
    get legends() { return legends; }, get combos() { return combos; }, get lairs() { return lairs; },
    shaped: () => wild.shaped(),
    quick: () => isQuick(),
    warmthFrom,
    get BLOW_GAP() { return BLOW_GAP; },
    get DIRS() { return DIRS; },
    get G() { return G; },
    get KNOCKDOWN_MS() { return KNOCKDOWN_MS; },
    get P() { return P; },
    get PRESS_HP() { return PRESS_HP; },
    get T() { return T; },
    get cap() { return cap; },
    get cls() { return cls; },
    get damageMonster() { return damageMonster; },
    get fieldAt() { return elements.fieldAt; }, get burnLine() { return elements.burnLine; },
    snareable, snaresBy, setSnare,
    firepot: spots => elements.firepot(spots), fuelAt: (x, y) => elements.fuel(x, y), igniteWild: (x, y) => elements.ignite(x, y, 0, true),
    rime: (x, y) => elements.rime(x, y), stormAt: (x, y, n) => elements.stormAt(x, y, n), wet: (x, y) => elements.wet(x, y),
    get castingName() { return castingName; },
    get assassinQuiet() { return assassinQuiet; },
    get elemental() { return elemental; },
    get followBlow() { return followBlow; },
    get shadeWakes() { return shadeWakes; },
    get tricksterOpening() { return tricksterOpening; },
    get diff() { return diff; }, get shortNormal() { return shortNormal; },
    get distField() { return distField; }, set distField(v) { distField = v; },
    // the hero's hound: where it stands, and what a blow at it or the quills do
    get companionAt() { return companion.at; }, get companionStruck() { return companion.struck; }, get companionGuards() { return companion.guards; }, get companionBreaks() { return companion.breaks; }, get companionHurt() { return companion.hurt; }, get houndNoisy() { return companion.noisy; },
    get distFieldAt() { return distFieldAt; }, set distFieldAt(v) { distFieldAt = v; },
    get effectFrom() { return effectFrom; },
    get emit() { return emit; },
    get floatText() { return floatText; },
    get fx() { return fx; },
    get hasPower() { return hasPower; },
    get hasTalent() { return hasTalent; },
    get heard() { return heard; },
    get hurtPlayer() { return hurtPlayer; },
    get isJewel() { return isJewel; },
    get itemName() { return itemName; },
    get key() { return key; },
    get knightGuard() { return knightGuard; },
    get knightSteadfast() { return knightSteadfast; }, flame: (x, y, ms) => elements.flame(x, y, ms),
    get learn() { return learn; },
    get log() { return log; },
    get lvl() { return lvl; },
    get meet() { return meet; },
    get monsterAt() { return monsterAt; },
    get mstat() { return mstat; },
    get newMonster() { return newMonster; },
    get npcAt() { return npcAt; },
    get offhandWeapon() { return offhandWeapon; },
    get opening() { return opening; },
    get packSize() { return packSize; },
    get passable() { return passable; },
    get playerAC() { return playerAC; },
    get realNow() { return realNow; },
    get relativeBearing() { return relativeBearing; },
    get relicItem() { return relicItem; },
    get riposte() { return riposte; },
    get rollNote() { return rollNote; },
    get setTile() { return setTile; },
    get showRolls() { return showRolls; },
    get spray() { return spray; },
    get the() { return the; },
    get tile() { return tile; },
    get trickSave() { return trickSave; },
    get tricksterSlip() { return tricksterSlip; },
    get venomSave() { return venomSave; },
    get weapon() { return weapon; },
  };
  // The traders (trader.js) borrow the same way.
  const traderK = {
    get climbed() { return climbed; },
    get BELT() { return BELT; }, get bounty() { return bounty; },
    get G() { return G; },
    get P() { return P; }, get lvl() { return lvl; }, get log() { return log; }, get emit() { return emit; }, get the() { return the; },
    get cap() { return cap; }, get itemName() { return itemName; }, get relicOf() { return relicOf; }, get mod() { return mod; },
    get hasTalent() { return hasTalent; }, get isJewel() { return isJewel; }, get isKnown() { return isKnown; }, get vouched() { return vouched; },
    get vowed() { return vowed; }, get hiddenGear() { return hiddenGear; }, get cursedWorn() { return cursedWorn; },
    get revealAll() { return revealAll; }, get breakCurses() { return breakCurses; }, get healPlayer() { return healPlayer; },
    get spMax() { return spMax; }, get beltRoom() { return beltRoom; }, get giveItem() { return giveItem; }, get removeOne() { return removeOne; },
    get discoverRelic() { return discoverRelic; }, get junkInPack() { return junkInPack; },
    // the hound sleeps by the lamp too, and a hurt one is reason enough to stop there
    houndHurt: () => { const c = companion.here(); return !!c && c.hp < c.maxHp; },
    houndRests: () => companion.rested(1),
    companionHere: () => companion.here(),
  };
  const { charm, buyPrice, sellPrice, shopServices, buyService, openShop, currentShop, closeShop, buy, sell, sellJunk, traderKind, traderName, priceNotes } = makeTrader(traderK);
  const { RISE_MS, WAKE_BEAT, updateMonsters, bossFalls, breaksBones, burnWeb, ensureDist, moveMonster, moveOnHurt, sporesOn, surface, spring, namedArrives, namedBar, namedFalls, namedTitle, namedWakes, poisonFor, wander } = makeFoes(foesK);
  // ---------- the hero's hound: see companion.js ----------
  const companion = makeCompanion({
    get vowed() { return vowed; },
    get G() { return G; }, get P() { return P; }, get DIRS() { return DIRS; }, get lvl() { return lvl; }, get log() { return log; },
    get passable() { return passable; }, get monsterAt() { return monsterAt; }, get npcAt() { return npcAt; }, get propAt() { return propAt; }, get mstat() { return mstat; },
    fieldAt: (x, y) => elements.fieldAt(x, y),
    get damageMonster() { return damageMonster; },
    get heard() { return heard; }, get realNow() { return realNow; }, get floatText() { return floatText; },
    get giveItem() { return giveItem; }, get itemName() { return itemName; }, get aThing() { return aThing; },
    kinHp: () => wild.kinHp(), kinBite: () => wild.kinBite(), kinFloors: () => wild.kinFloors(), isLong: () => isLong(),
    // a healer's tending: quiet, a little at a time, not a draught's flash and sound
    mendHero: n => { const p = P(); noteHealed(Math.max(0, Math.min(n, p.maxHp - p.hp))); p.hp = Math.min(p.maxHp, p.hp + n); emit('stats'); },
  });
  // ---------- a druid's Wild Shape, Entangle and bond: see wild.js ----------
  const wild = makeWild({
    get G() { return G; }, get P() { return P; }, get DIRS() { return DIRS; }, get log() { return log; }, get emit() { return emit; }, get spellSave() { return spellSave; }, get spellShrug() { return spellShrug; },
    get passable() { return passable; }, get monsterAt() { return monsterAt; }, get mstat() { return mstat; }, get meet() { return meet; }, get floatText() { return floatText; },
    get onPath() { return onPath; }, get capped() { return capped; }, get hasTalent() { return hasTalent; }, get skillSpeed() { return skillSpeed; }, get hasPower() { return hasPower; },
  });
  // ---------- the dungeon answers the elements: see elements.js ----------
  const elements = makeElements({
    get combos() { return combos; },
    get G() { return G; }, get P() { return P; }, get lvl() { return lvl; }, get tile() { return tile; }, get T() { return T; }, get key() { return key; },
    get log() { return log; }, get floatText() { return floatText; }, get spray() { return spray; }, get heard() { return heard; }, get mstat() { return mstat; },
    get damageMonster() { return damageMonster; }, get elemental() { return elemental; }, get hurtPlayer() { return hurtPlayer; }, get smash() { return smash; },
    get setTile() { return setTile; }, burnWeb: () => burnWeb(),
    surface: (m, why) => surface(m, why), companionHere: () => companion.here(), companionHurt: (n, what) => companion.hurt(n, what),
    shake: (amp, ms) => { fx.shakeAmp = amp; fx.shakeMs = ms; fx.shakeUntil = realNow + ms; },
    learn: (id, what) => learn(id, what), hasPower: k => hasPower(k),
  });
  // ---------- encounters: see meet.js ----------
  const encs = makeEncounters({
    get vowed() { return vowed; }, get G() { return G; }, get P() { return P; }, get lvl() { return lvl; }, get log() { return log; }, get emit() { return emit; },
    get fx() { return fx; }, get realNow() { return realNow; }, get companion() { return companion; },
    get STAT_WORD() { return STAT_WORD; }, get THREAD_SAID() { return THREAD_SAID; }, get threads() { return threads; },
    get checkBonus() { return checkBonus; }, get checkChance() { return checkChance; }, get statCheck() { return statCheck; },
    get removeOne() { return removeOne; }, get checkLevelUp() { return checkLevelUp; }, get pickupAll() { return pickupAll; }, get itemName() { return itemName; }, get key() { return key; },
    get tricksterPurse() { return tricksterPurse; }, get hurtPlayer() { return hurtPlayer; }, get healPlayer() { return healPlayer; }, get venomSave() { return venomSave; },
    get revealAll() { return revealAll; }, get breakCurses() { return breakCurses; }, get refreshSp() { return refreshSp; },
    get passable() { return passable; }, get monsterAt() { return monsterAt; }, get npcAt() { return npcAt; }, get newMonster() { return newMonster; },
    resetDist: () => { distFieldAt = -1e9; },
  });
  // ---------- jobs from the traders: see bounty.js ----------
  const bounty = makeBounty({
    get G() { return G; }, get P() { return P; }, get lvl() { return lvl; }, get log() { return log; }, get emit() { return emit; },
    get giveItem() { return giveItem; }, get itemName() { return itemName; }, get aThing() { return aThing; }, get key() { return key; },
    get farthestFloor() { return farthestFloor; }, namedPlan: Dungeon.namedPlan,
  });

  // ---------- saving: see saving.js ----------
  const { hasSave, load, loadCode, noteRun, save, saveCode, saveSummary } = makeSaving({
    get G() { return G; }, set G(v) { G = v; }, get JEWEL_SLOTS() { return JEWEL_SLOTS; }, get SAVE_KEY() { return SAVE_KEY; },
    get buildLooks() { return buildLooks; }, get caskLevel() { return caskLevel; }, get clearFx() { return clearFx; },
    get companion() { return companion; }, get distFieldAt() { return distFieldAt; }, set distFieldAt(v) { distFieldAt = v; },
    get emit() { return emit; }, get encs() { return encs; }, get freshStats() { return freshStats; }, get fx() { return fx; },
    get lastBlocked() { return lastBlocked; }, set lastBlocked(v) { lastBlocked = v; }, get log() { return log; },
    get offerCapstone() { return offerCapstone; }, get offerPath() { return offerPath; }, get prelude() { return prelude; },
    get pruneRemains() { return pruneRemains; }, get queuedAttack() { return queuedAttack; }, set queuedAttack(v) { queuedAttack = v; },
    get queuedMove() { return queuedMove; }, set queuedMove(v) { queuedMove = v; }, get realNow() { return realNow; }, set realNow(v) { realNow = v; },
    get refreshSp() { return refreshSp; }, get runKey() { return runKey; }, get runKeyOf() { return runKeyOf; }, get snapCam() { return snapCam; },
    get stepAside() { return stepAside; }, get stockLampOil() { return stockLampOil; }, get win() { return win; },
  });

  // ---------- chronicle: see chronicle.js ----------
  const { bestiary, claimHeart, epilogue, finaleLeft, freshStats, hall, lastRun, learn, meet, noteDealt, noteGold, noteHealed, noteKill, noteSpell, noteTaken, noteUsed, pagesInDungeon, recordHero, runStats, score, sortPack, win } = makeChronicle({
    get rung() { return rung; },
    get G() { return G; }, get HALL_KEY() { return HALL_KEY; }, get LAST_KEY() { return LAST_KEY; }, get P() { return P; },
    get SAVE_KEY() { return SAVE_KEY; }, get cap() { return cap; }, get castingName() { return castingName; }, get companion() { return companion; },
    get emit() { return emit; }, get fx() { return fx; }, get isQuick() { return isQuick; }, get itemName() { return itemName; },
    get killerPhrase() { return killerPhrase; }, get liveLine() { return liveLine; }, get log() { return log; }, get mstat() { return mstat; },
    get noteRun() { return noteRun; }, get realNow() { return realNow; }, get runKey() { return runKey; }, get the() { return the; },
    get wild() { return wild; },
  });

  // ---------- powers: see powers.js ----------
  const { READ_MS, SCROLL_GLOW, abilityLeft, abilityOf, boltEnd, boltTargets, castLabel, castLast, castSpell, enemiesNear, fireCatches, quaff, quickScroll, rangerAim, readQuick, restLabel, spellFx, spellRange, spellWasteReason, useAbility, wardenHold } = makePowers({
    get legends() { return legends; }, get combos() { return combos; },
    get CORD_SQUARE() { return CORD_SQUARE; }, get DIRS() { return DIRS; }, get FROST_SPELLS() { return FROST_SPELLS; }, get G() { return G; },
    get P() { return P; }, get SAVED_SHARE() { return SAVED_SHARE; }, get armStat() { return armStat; }, get berserkerRage() { return berserkerRage; },
    get blocked() { return blocked; }, get buffAmount() { return buffAmount; }, get buffDuration() { return buffDuration; },
    get burnWeb() { return burnWeb; }, get capped() { return capped; }, get castingName() { return castingName; },
    set castingName(v) { castingName = v; }, get cls() { return cls; }, get companion() { return companion; },
    get damageMonster() { return damageMonster; }, get deepMagic() { return deepMagic; }, get distField() { return distField; },
    get elemental() { return elemental; }, get elements() { return elements; }, get emit() { return emit; }, get ensureDist() { return ensureDist; },
    get floatText() { return floatText; }, get focusHas() { return focusHas; }, get fx() { return fx; }, get fxDelay() { return fxDelay; },
    set fxDelay(v) { fxDelay = v; }, get hasTalent() { return hasTalent; }, get healPlayer() { return healPlayer; },
    get healerHeal() { return healerHeal; }, get heard() { return heard; }, get heldWhy() { return heldWhy; }, get hitGroup() { return hitGroup; },
    get isKnown() { return isKnown; }, get knownSpells() { return knownSpells; }, get log() { return log; }, get lvl() { return lvl; },
    get meet() { return meet; }, get mod() { return mod; }, get monsterAt() { return monsterAt; }, get moveMonster() { return moveMonster; },
    get mstat() { return mstat; }, get noteSpell() { return noteSpell; }, get npcAt() { return npcAt; }, get onPath() { return onPath; },
    get ownEffect() { return ownEffect; }, get packSize() { return packSize; }, get passable() { return passable; },
    get pyroFire() { return pyroFire; }, get queuedAttack() { return queuedAttack; }, set queuedAttack(v) { queuedAttack = v; },
    get realNow() { return realNow; }, get restShare() { return restShare; }, get setWorn() { return setWorn; }, get soon() { return soon; },
    get spellAvailable() { return spellAvailable; }, get spellCost() { return spellCost; }, get spellDesc() { return spellDesc; },
    get spellElement() { return spellElement; }, get spellHold() { return spellHold; }, get spellSave() { return spellSave; },
    get spellShrug() { return spellShrug; }, get spring() { return spring; }, get steadyAim() { return steadyAim; },
    get templarSmite() { return templarSmite; }, get throwArm() { return throwArm; }, get useItem() { return useItem; }, get vowed() { return vowed; },
    get wild() { return wild; },
  });

  // ---------- pacing: see pacing.js ----------
  const { BLOW_GAP, HEARTSWORN_CAP, KNOCKDOWN_MS, PRESS_HP, QUICK, REGEN_CAP, deepMagic, deepSteel, diff, diffEdge, followBlow, hardenLevel, isLong, isQuick, newMonster, pressLevel, pressSturdier, rest, restShare, shortNormal, twistLevel } = makePacing({
    get climbed() { return climbed; },
    get DIRS() { return DIRS; }, get G() { return G; }, get P() { return P; }, get T() { return T; }, get WAKE_BEAT() { return WAKE_BEAT; },
    get bargained() { return bargained; }, get companion() { return companion; }, get distField() { return distField; }, get emit() { return emit; },
    get enemiesNear() { return enemiesNear; }, get ensureDist() { return ensureDist; }, get hasTalent() { return hasTalent; },
    get key() { return key; }, get layRelic() { return layRelic; }, get log() { return log; }, get lvl() { return lvl; },
    get monsterAt() { return monsterAt; }, get noteHealed() { return noteHealed; }, get npcAt() { return npcAt; }, get passable() { return passable; },
    get vowed() { return vowed; }, get wander() { return wander; },
  });

  // ---------- motion: see motion.js ----------
  const { CORPSE_MS, DOOR_MS, renderState } = makeMotion({
    get DIRS() { return DIRS; }, get G() { return G; }, get P() { return P; }, get RISE_MS() { return RISE_MS; }, get T() { return T; },
    get cam() { return cam; }, get camProgress() { return camProgress; }, get companion() { return companion; }, get effect() { return effect; },
    get elements() { return elements; }, get fx() { return fx; }, get heroTitle() { return heroTitle; }, get lvl() { return lvl; },
    get namedBar() { return namedBar; }, get namedTitle() { return namedTitle; }, get packSize() { return packSize; },
    get passable() { return passable; }, get prelude() { return prelude; }, get spriteFor() { return spriteFor; }, get tile() { return tile; },
    get traderKind() { return traderKind; }, get wild() { return wild; },
  });

  // ---------- combat: see combat.js ----------
  const { REMAINS_MAX, REMAINS_MS, attack, checkLevelUp, chooseBoon, damageMonster, floatText, healPlayer, heard, hitGroup, hurtPlayer, isCapstoneOffer, isPathOffer, isRenownOffer, levelNote, offerCapstone, offerPath, packSize, pendingBoons, pendingLevel, pruneRemains, relativeBearing, renownAt } = makeCombat({
    get legends() { return legends; }, get combos() { return combos; }, get setWorn() { return setWorn; },
    get vowed() { return vowed; }, get BITS_MAX() { return BITS_MAX; }, get CORPSE_MS() { return CORPSE_MS; }, get DIRS() { return DIRS; },
    get DUAL_HIT_PENALTY() { return DUAL_HIT_PENALTY; }, get G() { return G; }, get GORE() { return GORE; }, get GORE_OF() { return GORE_OF; },
    get JEWEL_SLOTS() { return JEWEL_SLOTS; }, get OFF_BALANCE() { return OFF_BALANCE; }, get P() { return P; }, get QUICK() { return QUICK; },
    get RISE_MS() { return RISE_MS; }, get SAVE_KEY() { return SAVE_KEY; }, get SELF_TAUGHT_MOST() { return SELF_TAUGHT_MOST; },
    get STAT_WORD() { return STAT_WORD; }, get aids() { return aids; }, get armStat() { return armStat; }, get baneDamage() { return baneDamage; },
    get bargained() { return bargained; }, get berserkerRage() { return berserkerRage; }, get blocked() { return blocked; },
    get bossFalls() { return bossFalls; }, get bounty() { return bounty; }, get breaksBones() { return breaksBones; }, get buzz() { return buzz; },
    get cap() { return cap; }, get capped() { return capped; }, get castingName() { return castingName; }, get cls() { return cls; },
    get coatDamage() { return coatDamage; }, get coatLanded() { return coatLanded; }, get companion() { return companion; },
    get critFloor() { return critFloor; }, get dawnBlow() { return dawnBlow; }, get deepMagic() { return deepMagic; },
    get deepSteel() { return deepSteel; }, get effect() { return effect; }, get effectFrom() { return effectFrom; },
    get elements() { return elements; }, get emit() { return emit; }, get fx() { return fx; }, get fxDelay() { return fxDelay; },
    set fxDelay(v) { fxDelay = v; }, get fxGen() { return fxGen; }, set fxGen(v) { fxGen = v; }, get hasPower() { return hasPower; },
    get hasTalent() { return hasTalent; }, get heldWhy() { return heldWhy; }, get heroTitle() { return heroTitle; }, get isQuick() { return isQuick; },
    get jewelBonus() { return jewelBonus; }, get jewelPowers() { return jewelPowers; }, get key() { return key; },
    get killerPhrase() { return killerPhrase; }, get kindles() { return kindles; }, get knownSpells() { return knownSpells; },
    get learn() { return learn; }, get leech() { return leech; }, get log() { return log; }, get look() { return look; }, get lvl() { return lvl; },
    get meet() { return meet; }, get mod() { return mod; }, get monsterAt() { return monsterAt; }, get moveOnHurt() { return moveOnHurt; },
    get mstat() { return mstat; }, get namedFalls() { return namedFalls; }, get noteDealt() { return noteDealt; },
    get noteHealed() { return noteHealed; }, get noteKill() { return noteKill; }, get noteRun() { return noteRun; },
    get noteTaken() { return noteTaken; }, get offhandWeapon() { return offhandWeapon; }, get onPath() { return onPath; },
    get passable() { return passable; }, get pathOf() { return pathOf; }, get propAt() { return propAt; }, get rangerAim() { return rangerAim; },
    get realNow() { return realNow; }, get recordHero() { return recordHero; }, get refreshSp() { return refreshSp; },
    get relicItem() { return relicItem; }, get rollNote() { return rollNote; }, get runKey() { return runKey; },
    get setBurning() { return setBurning; }, get shadeFalls() { return shadeFalls; }, get skillDamage() { return skillDamage; },
    get smash() { return smash; }, get snaresSlack() { return snaresSlack; }, get sneakMult() { return sneakMult; }, get soon() { return soon; },
    get spMax() { return spMax; }, get sparks() { return sparks; }, get spellAvailable() { return spellAvailable; }, get spellFx() { return spellFx; },
    get spellLevel() { return spellLevel; }, get sporesOn() { return sporesOn; }, get spray() { return spray; }, get spring() { return spring; },
    get surface() { return surface; }, get templarBlow() { return templarBlow; }, get the() { return the; }, get toHit() { return toHit; },
    get venomTakes() { return venomTakes; }, get wardenHold() { return wardenHold; }, get weapon() { return weapon; }, get wild() { return wild; },
  });

  // ---------- items: see items.js ----------
  const { BELT, STUDY_DC, aThing, beltRoom, canEquip, dropItem, equip, floorItems, giveItem, heartHeld, itemName, keeper, pickupAll, removeOne, spriteFor, study, studyReason, takeHere, takeItem, takeable, throwArm, unequip, useItem, uselessToClass, vitals, wasteReason } = makeItems({
    get climbed() { return climbed; },
    get COATINGS() { return COATINGS; }, get COAT_BLOWS() { return COAT_BLOWS; }, get COAT_GLOW() { return COAT_GLOW; }, get DIRS() { return DIRS; },
    get G() { return G; }, get INV_MAX() { return INV_MAX; }, get P() { return P; }, get READ_MS() { return READ_MS; },
    get SCROLL_GLOW() { return SCROLL_GLOW; }, get T() { return T; }, get blocked() { return blocked; }, get boltEnd() { return boltEnd; },
    get boltTargets() { return boltTargets; }, get bound() { return bound; }, get bounty() { return bounty; },
    get breakCurses() { return breakCurses; }, get burnWeb() { return burnWeb; }, get cap() { return cap; }, get castingName() { return castingName; },
    set castingName(v) { castingName = v; }, get checkTile() { return checkTile; }, get claimHeart() { return claimHeart; }, get cls() { return cls; },
    get companion() { return companion; }, get cursedWorn() { return cursedWorn; }, get discoverRelic() { return discoverRelic; },
    get distFieldAt() { return distFieldAt; }, set distFieldAt(v) { distFieldAt = v; }, get elemental() { return elemental; },
    get elements() { return elements; }, get emit() { return emit; }, get fireCatches() { return fireCatches; }, get fx() { return fx; },
    get fxDelay() { return fxDelay; }, set fxDelay(v) { fxDelay = v; }, get healPlayer() { return healPlayer; }, get heard() { return heard; },
    get heldWhy() { return heldWhy; }, get hiddenGear() { return hiddenGear; }, get hitGroup() { return hitGroup; }, get isGear() { return isGear; },
    get isJewel() { return isJewel; }, get isKnown() { return isKnown; }, get key() { return key; }, get log() { return log; },
    get lvl() { return lvl; }, get monsterAt() { return monsterAt; }, get mstat() { return mstat; }, get noteGold() { return noteGold; },
    get noteUsed() { return noteUsed; }, get npcAt() { return npcAt; }, get offhandReason() { return offhandReason; },
    get packSize() { return packSize; }, get passable() { return passable; }, get propAt() { return propAt; }, get pyroFire() { return pyroFire; },
    get realNow() { return realNow; }, get refreshSp() { return refreshSp; }, get relicOf() { return relicOf; }, get revealAll() { return revealAll; },
    get snapCam() { return snapCam; }, get soon() { return soon; }, get spellFx() { return spellFx; }, get spring() { return spring; },
    get statCheck() { return statCheck; }, get tellQuality() { return tellQuality; }, get the() { return the; },
    get tricksterPurse() { return tricksterPurse; }, get vowed() { return vowed; },
  });

  // ---------- scenes: see scenes.js ----------
  const { BITS_MAX, GORE, GORE_OF, caskLevel, look, mimicLevel, notePieces, pieceLevel, propAt, smash, sparks, spray, stockLampOil } = makeScenes({
    get DIRS() { return DIRS; }, get G() { return G; }, get P() { return P; }, get REMAINS_MAX() { return REMAINS_MAX; },
    get REMAINS_MS() { return REMAINS_MS; }, get T() { return T; }, get elements() { return elements; }, get floatText() { return floatText; },
    get fx() { return fx; }, get fxDelay() { return fxDelay; }, get heard() { return heard; }, get key() { return key; }, get log() { return log; },
    get lvl() { return lvl; }, get realNow() { return realNow; }, get tile() { return tile; },
  });

  // ---------- curses: see curses.js ----------
  const { bound, breakCurses, cap, cursedWorn, farthestFloor, hiddenGear, isGear, layRelic, placeCloaks, placeJewellery, placeRelics, placeRobes, qualityHidden, revealAll, tellQuality } = makeCurses({
    get DIRS() { return DIRS; }, get G() { return G; }, get P() { return P; }, get T() { return T; }, get isJewel() { return isJewel; },
    get isKnown() { return isKnown; }, get itemName() { return itemName; }, get key() { return key; }, get log() { return log; },
    get relicItem() { return relicItem; }, get the() { return the; },
  });

  // ---------- fallen: see fallen.js ----------
  const { bonesArrive, heroTitle, killerPhrase, newRunStamp, placeFallen, runKey, runKeyOf, shadeFalls, shadeStats, shadeWakes } = makeFallen({
    get G() { return G; }, get fx() { return fx; }, get heard() { return heard; }, get key() { return key; }, get learn() { return learn; },
    get log() { return log; }, get meet() { return meet; }, get realNow() { return realNow; },
  });

  return {
    newGame, load, save, hasSave, saveSummary, saveCode, loadCode, rollStats, hall, earned: () => (G && G.earned) || null,
    companion: () => (G && G.companion) || null, companionSprite: (/** @type {any} */ Assets, /** @type {number} */ now) => companion.sprite(Assets, now), companionNote: () => companion.note(), companionWord: () => companion.word(), companionRank: () => companion.rank(),
    /** Give a charm from the pack to the companion: why not, or null when it is worn. */
    bounty: () => (G && G.bounty) || null, bountyChip: () => bounty.chip(),
    /** A druid in Wild Shape: whether, and the status line's words for it. */
    shaped: () => !!(G && wild.shaped()), shapeChip: () => (G && G.status === 'playing' ? wild.chip() : ''),
    hurtPlayer, spMax, trapEye,
    giveCharm: it => { const why = G && G.status === 'playing' ? companion.wear(it) : 'Not now.'; if (why) { log(why, 'bad'); Sound.play('error'); } else emit('inv'); return why; },
    companionHere: () => !!companion.here(), companionNoisy: () => companion.noisy(),
    update, tick, input, renderState, takeEvents, quickScroll, vitals,
    beginPrelude: (now = performance.now()) => prelude.begin(now), preludeOn: () => prelude.active(), skipPrelude: () => prelude.finish(realNow || performance.now()),
    state: () => G, player: P, level: lvl, log, mod,
    lastRun, sortPack, descend, chooseRoute, leaveFork, forkPending: () => !!(G && G.forkPending), route: () => (G && G.route) || null, routeSpan: () => (G ? Dungeon.routeSpan(G.opts.levels || 8) : null), giveItem, sneakMult, setWorn, threadNotes, uselessToClass, junkInPack, sellJunk, pressSturdier, qualityHidden, focusOf, itemName, relicOf, grade: (/** @type {any} */ it) => legends.grade(it), GRADES: legends.GRADES,
    /** The run's build in a line, and its combinations, most used first. */
    buildLine: () => (G ? combos.buildLine() : ''), noteCombo: (/** @type {string} */ id, /** @type {any} */ at) => combos.note(id, at),
    /** For the tests: a champion wakes, and a wound as a blow of the hero's would give it. */
    namedWake: (/** @type {any} */ m) => namedWakes(m, mstat(m)), hurtMonster: (/** @type {any} */ m, /** @type {number} */ n) => damageMonster(m, n, null), combosUsed: () => (G ? combos.used().map(([id, n]) => ({ id, n, name: COMBOS[id].name })) : []),
    /** This run's finds, best first: the rare gear known, the relics and legends (a save from before finds were kept lists its relics). */
    runFinds: () => { if (!G || !G.stats) return []; if (G.status === 'playing') legends.noteFinds(); const f = [...(G.stats.finds || [])]; for (const id of (G.relics && G.relics.found) || []) if (RELICS[id] && !f.some(x => x.key.endsWith('|' + id))) f.push({ key: '|' + id, name: RELICS[id].name, grade: RELICS[id].legend ? 'legend' : 'relic', depth: 0 }); const rank = { legend: 0, relic: 1, rare: 2 }; return f.sort((a, b) => rank[a.grade] - rank[b.grade]); }, hasPower, spriteFor, equip, unequip, useItem, dropItem, takeItem, floorItems, canEquip, isKnown, mstat,
    offhandReason, offhandWeapon, canDualWield, heartHeldFast: () => !!keeper(), heartKeeper: () => { const k = keeper(); return k ? k.id : ''; }, rollsShown, toggleRolls, useLabel, stairsBeside,
    statCheck, checkChance, checkBonus, charm, study, studyReason, STUDY_DC,
    currentEncounter: () => encs.current(), encounterOptions: () => encs.encounterOptions(), chooseEncounter: i => encs.chooseEncounter(i), closeEncounter: () => encs.closeEncounter(),
    pendingLevel, levelNote, currentShop, closeShop, buy, sell, buyPrice, sellPrice, shopServices, buyService, traderName, priceNotes,
    COAT_BLOWS, coatingName: t => (COATINGS[t] ? COATINGS[t].name : ''),
    fieldAt: (x, y) => elements.fieldAt(x, y), wet: (x, y) => !!(G && elements.wet(x, y)), vents: () => (G ? elements.vents() : []),
    pendingBoons, chooseBoon, isPathOffer, isCapstoneOffer, isRenownOffer, renownAt, heroSaves: () => heroSaves(), sturdiness: () => diff().hp * shortNormal(), capstoneOf, pathOf, spellCost, spellDesc, berserkerRage, blowRate, epilogue, journal: () => (G && G.journal) || [], pagesInDungeon,
    bestiary, runStats, lastAttacker: () => (G && G.lastAttacker) || null, deathLog: () => (G && G.deathLog) || [],
    knownSpells, spellAvailable, spellLevel, castSpell, rest, toHit, playerAC, weapon, effect, skillDamage, critFloor,
    wasteReason, spellWasteReason, spellRange, setTesting, testingOn, tested: () => !!(G && G.tested), testFloor, testReveal, testLevel, testGifts, testGive, attackReady, castLabel, vowed, rung, restShare, abilityOf, abilityLeft, useAbility, score, finaleLeft, restLabel,
    /** The lich is awake and fighting: the drone under the dungeon tightens. */
    bossAwake: () => !!(G && G.status === 'playing' && lvl().monsters.some(m => MONSTERS[m.id].boss && m.spoke && m.awake)),
    mood,
    INV_MAX, T,
  };
})();

export { Game };
