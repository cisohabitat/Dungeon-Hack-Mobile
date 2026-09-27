import { Rng, Dice, d } from './rng.js';
import { ROUTES, TWISTS, heroName, BACKGROUNDS, JOURNAL, BOONS, XP_TABLE, MAX_LEVEL, CLASSES, ITEMS, TRAP_TYPES, MONSTERS, SPELLS, POTION_LOOKS, SCROLL_LOOKS, RING_LOOKS, AMULET_LOOKS, ELEMENTS_TAKEN, ELITES, THEMES, BESTIARY, TALENTS, PATHS, PATH_LEVEL, VOWS, armorFits, shieldFits } from './data.js';
import { Assets } from './assets.js';
import { Dungeon } from './dungeon.js';
import { ENCOUNTERS, encounterDc } from './encounters.js';
import { RELICS, GIANTS, POWER_SUFFIX, PREFIX_NAME, RELIC_SETS, relicPlan, routeRelic } from './relics.js';
import { makeTrader } from './trader.js';
import { Sound } from './sound.js';
import { Progress } from './progress.js';
import { makeFoes } from './foes.js';
import { SIZE as DRESS_SIZE } from './dressing.js';
import { encodeSave, decodeSave } from './savecode.js';
import { makeCompanion } from './companion.js';

// Core game state and rules.

const Game = (() => {
  const T = Dungeon.T;
  const DIRS = Dungeon.DIRS;
  const INV_MAX = 20;
  const SAVE_KEY = 'deepdelve.save';
  const HALL_KEY = 'deepdelve.hall';
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
               /** a trap going off, or disarmed: which, when, and for a dart the wall it came from */
               trapAt: -1e9, trapKind: '', trapSide: 1, trapDodged: false,
               /** the fallen, sinking and fading where they fell */
               /** @type {Array<{x: number, y: number, sprite: string, elite?: string, scale: number, born: number, dx: number, dy: number, fly: number}>} */ corpses: [],
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
               /** @type {{name: string, hp: number, maxHp: number, phase: number, rite: boolean, riteDone: number, named?: boolean, notches?: number[]}|null} */ boss: null,
               /** @type {any} */ view: null };
  /** Forget the look of the last fight: a new run or a loaded save starts clean. */
  function clearFx() {
    fxGen++;
    fx.texts = []; fx.spells = []; fx.corpses = []; fx.bits = []; fx.stains = {}; fx.drops = []; fx.heartAt = -1; fx.deadAt = -1; fx.smokeUntil = 0;
  }
  const buzz = ms => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ } };
  const cam = { x: 0, y: 0, angle: 0, fromX: 0, fromY: 0, fromA: 0, toX: 0, toY: 0, toA: 0, t0: 0, t1: 0, moving: false };
  const events = []; // messages for the UI layer: 'dead', 'won', 'level', 'inv', 'stats'

  const mod = s => Math.floor((s - 10) / 2);
  const key = (x, y) => x + ',' + y;
  /** @returns {import('./types.js').Level} the floor the player is standing on */
  const lvl = () => G.levels[G.depth];
  /** @returns {import('./types.js').Player} */
  const P = () => G.player;
  const cls = () => CLASSES[G.player.cls];
  // ---------- threads ----------
  // A few choices follow the hero down. Each is kept with the floor it was
  // made on, pays off (or comes due) further down, and the epilogue remembers it.
  /** @returns {Record<string, number>} */
  const threads = () => (G.threads = G.threads || {});
  const THREAD_SAID = {
    guide: 'He means to go on ahead and mark the way for you.',
    captive: 'He swears he will put in a word with the traders below.',
    crew: 'The third crew is at rest.',
    bargain: '+1 to hit and damage for the rest of the delve. Something far below will be the stronger for it.',
    lamp: 'The Lampfolk will hear of it.',
    robbed: 'The Lampfolk will hear of this.',
  };
  /** The Pale One's strength, for the rest of the run. */
  const bargained = () => (G && G.threads && G.threads.bargain ? 1 : 0);
  /** A trader below the captive you freed has heard of you: a sixth off. */
  const vouched = () => (G && G.threads && G.threads.captive && G.depth > G.threads.captive ? 1 / 6 : 0);
  /** Arriving on a floor for the first time: whatever a thread has waiting here. */
  function threadArrivals(L, depth, fresh = true) {
    const t = threads();
    if (t.guide && depth > t.guide && !t.guided) {
      t.guided = depth; L.explored.fill(1);
      log('Chalk arrows on the stair wall: the guildsman you dug out came this way, and marked the whole floor for you.', 'good');
    }
    if (L.isFinal && t.crew && !t.sung) {
      t.sung = 1;
      const p = P(); p.effects.crew_hit = { amount: 2, until: G.t + 600000 };
      log('On the last stair you hear, faint as breath, a crew\'s marching song. The dead you buried have not forgotten you (+2 to hit).', 'good');
    }
    if (L.isFinal && t.bargain && fresh) log('Cold settles in your hands, and something ahead drinks it in. The Pale One\'s price has come due: the lich is the stronger for your bargain.', 'bad');
  }
  /** What the hero carries from their choices, for the hero sheet. */
  function threadNotes() {
    const t = G.threads || {}, out = [];
    if (t.guide) out.push(t.guided ? `The guildsman you dug out marked floor ${t.guided} for you.` : 'The guildsman you dug out has gone ahead to mark the way.');
    if (t.captive) out.push('The captive you freed has put in a word: traders below him ask a sixth less for their wares.');
    if (t.crew) out.push('You buried the third crew. They will be with you at the end.');
    if (t.bargain) out.push('You took the Pale One\'s strength: +1 to hit and damage. The lich will be the stronger for it.');
    if (t.lamp) out.push(t.lampGift ? 'A Lampfolk trader thanked you for its kin\'s lamp with a gift of healing.' : 'You relit a Lampfolk\'s lamp: the next Lampfolk trader below will thank you for it.');
    if (t.robbed) out.push('You robbed one of the Lampfolk in the dark: their traders below ask a sixth more.');
    { const n = companion.note(); if (n) out.push(n); }
    return out;
  }
  /** Whether the hero swore this vow at the start of the run. */
  const vowed = v => !!(G && G.opts && Array.isArray(G.opts.vows) && G.opts.vows.includes(v));

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
  function emit(e) { events.push(e); }
  function takeEvents() { return events.splice(0); }

  // ---------- tiles ----------
  function tile(x, y) {
    const L = lvl();
    return (x < 0 || y < 0 || x >= L.w || y >= L.h) ? T.WALL : L.tiles[y * L.w + x];
  }
  function setTile(x, y, t) { const L = lvl(); L.tiles[y * L.w + x] = t; }
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
  const heldWhy = () => ({ down: 'You are still getting to your feet!', stone: 'Your limbs are stone!' }[P().heldBy || ''] || 'You are frozen in place!');
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

  // ---------- paths ----------
  // At PATH_LEVEL each class takes one of two paths for the rest of the run
  // (PATHS in data.js says what each does). Every effect lives in one small
  // function here, and the rule it changes asks it once, so a path touches
  // the rest of the rules at a single point each.
  /** Whether the hero has taken this path. */
  const onPath = id => P().path === id;
  /** The hero's path as PATHS describes it, or null before one is chosen. */
  const pathOf = (p = P()) => (PATHS[p.cls] || []).find(x => x.id === p.path) || null;
  // Knight: the shield is the point. A guard needs one up; the footing does not.
  /** More armour from a Knight's shield. */
  const knightShieldAC = () => (onPath('knight') ? 1 : 0);
  /** An ordinary blow that lands on a Knight with a shield up: one in eight is caught on it, for half. */
  function knightGuard(dmg) {
    if (!onPath('knight') || !P().eq.shield || d(1, 8) !== 1) return dmg;
    return Math.max(1, Math.ceil(dmg / 2));
  }
  /** A warned trick that lands on a Knight does a quarter less (after Stand Firm, if taken). */
  const knightSteadfast = dmg => (onPath('knight') ? Math.max(1, Math.ceil(dmg * 0.75)) : dmg);
  // Berserker: harder the worse it goes, and nothing held back for guarding.
  /** A Berserker's rage: +1 on every blow for each sixth of life lost, up to +4. */
  function berserkerRage() {
    const p = P();
    if (!onPath('berserker')) return 0;
    return Math.max(0, Math.min(4, Math.floor(6 * (1 - p.hp / p.maxHp))));
  }
  /** Below half their life a Berserker's swing comes a tenth sooner. */
  const berserkerFrenzy = () => (onPath('berserker') && P().hp < P().maxHp / 2 ? 0.9 : 1);
  /** A Berserker fights open. */
  const berserkerOpen = () => (onPath('berserker') ? -2 : 0);
  // Templar: the front-line priest.
  /** A Templar's blow on the undead: 1d3 more (Sanctified's die adds to it). */
  const templarBlow = m => (onPath('templar') && mstat(m).undead ? d(1, 3) : 0);
  /** Holy Smite in a Templar's hands deals a tenth more. */
  /**
   * A tenth more, true on every cast rather than only on big numbers: what
   * rounding would lose is a chance of one more. Rounded, a Smite of 4
   * stayed 4, and most early Smites and heals were that small.
   */
  const aTenthMore = n => { const x = n * 1.1, whole = Math.floor(x); return whole + (Dice.chance(x - whole) ? 1 : 0); };
  const templarSmite = (sp, dmg) => (sp.id === 'smite' && onPath('templar') ? aTenthMore(dmg) : dmg);
  // Healer: mending, and the points to spend on it.
  /** A Healer's healing spell heals a tenth more (after Healing Hands, if taken). */
  const healerHeal = n => (onPath('healer') ? aTenthMore(n) : n);
  /** A Healer's deeper well: a spell point for every three hero levels. */
  const healerSp = p => (p.path === 'healer' ? Math.floor(p.level / 3) : 0);
  /** While Protection is up a Healer mends a hit point every six seconds, on a clock of its own beside Warding Light's. */
  function healerMercy() {
    const p = P();
    if (!onPath('healer') || p.hp >= p.maxHp || !effectFrom('ac', 'protection') || G.t < (p.nextMercy || 0)) return;
    p.hp++; p.nextMercy = G.t + 6000; noteHealed(1); emit('stats');
  }
  // Pyromancer: hotter fire that keeps burning, and the cold given up for it.
  /** The fire spells and the fire scroll in a Pyromancer's hands deal a fifth more. */
  const pyroFire = dmg => (onPath('pyromancer') ? Math.round(dmg * 1.2) : dmg);
  /** Whether the hero's fire leaves things burning: Kindling, or a Pyromancer's own. */
  const kindles = () => hasTalent('kindling') || onPath('pyromancer');
  /** Set what the hero's fire struck burning: three seconds, six when Kindling and the path both feed it. */
  function setBurning(m) {
    const ms = hasTalent('kindling') && onPath('pyromancer') ? 6000 : 3000;
    m.dot = { kind: 'burning', until: G.t + ms, next: G.t + 1000 };
  }
  // Frostweaver: the cold holds things back, and the Shield holds longer.
  const FROST_SPELLS = ['lightning', 'cone_cold'];
  /** How long a spell holds back what it hits: Rime's jolt, a Frostweaver's, or both. */
  const spellHold = sp => (sp.pierce && hasTalent('rime') ? 700 : 0) + (onPath('frostweaver') && FROST_SPELLS.includes(sp.id) ? 700 : 0)
    + (FROST_SPELLS.includes(sp.id) && focusHas('storm') ? 400 : 0);
  // What a spell costs, and what a buff gives and for how long, with the paths in.
  /** Spell points a spell costs this hero. */
  function spellCost(sp) {
    let cost = sp.cost;
    if (sp.id === 'lightning' && onPath('frostweaver')) cost -= 1;
    else if (sp.id === 'cone_cold' && onPath('frostweaver')) cost -= 2;
    // a Pyromancer has given the cold up for the fire, and it comes harder to them
    else if (FROST_SPELLS.includes(sp.id) && onPath('pyromancer')) cost += sp.id === 'cone_cold' ? 2 : 1;
    // the Robe of the Magi eases the great workings: five points or more cost one less
    const robe = P().eq.armor;
    if (robe && ITEMS[robe.t].cheap && cost >= 5) cost -= 1;
    return cost;
  }
  /** How much a buff gives: a Frostweaver's Shield gives one more. */
  const buffAmount = sp => sp.amount + (sp.id === 'shield' && onPath('frostweaver') ? 1 : 0);
  /** How long a buff lasts: Zeal and a Templar each double Bless, and a Frostweaver's Shield lasts half as long again. */
  const buffDuration = sp => sp.dur * (sp.id === 'bless' && hasTalent('zeal') ? 2 : 1) * (sp.id === 'bless' && onPath('templar') ? 2 : 1) * (sp.id === 'shield' && onPath('frostweaver') ? 1.5 : 1);
  const SPAN_WORDS = { 60000: 'a minute', 90000: 'a minute and a half', 120000: 'two minutes', 180000: 'three minutes', 240000: 'four minutes' };
  /** A spell's description as it works for this hero: a buff's amount and time with the paths and talents in. */
  function spellDesc(sp) {
    if (sp.kind !== 'buff') return sp.desc;
    const dur = buffDuration(sp);
    return sp.desc.replace(/^\+\d+/, '+' + buffAmount(sp))
      .replace(/for (a minute and a half|a minute)/, 'for ' + (SPAN_WORDS[dur] || `${Math.round(dur / 1000)} seconds`));
  }
  // Assassin: the blow from the dark.
  /** What a strike from the shadows multiplies by: two, one more for Assassinate, one more for the path. */
  const sneakMult = () => 2 + (hasTalent('assassinate') ? 1 : 0) + (onPath('assassin') ? 1 : 0) + (setWorn('night') ? 1 : 0);
  /** Whether every piece of a relic set is worn at once. */
  const setWorn = (id, p = P()) => RELIC_SETS[id].pieces.every(u => Object.values(p.eq).some(it => it && it.u === u));
  /** The Order of the Dawn's pair: +1d4 on the undead. */
  const dawnBlow = m => (setWorn('dawn') && mstat(m).undead ? d(1, 4) : 0);
  /** A Blessed make on armour or shield: +1 to every save, each. */
  const blessedSaves = (p = P()) => ['armor', 'shield'].filter(s => p.eq[s] && p.eq[s].px === 'blessed').length;
  /** Squares closer a sleeping monster lets an Assassin come. */
  const assassinQuiet = () => (onPath('assassin') ? 1 : 0);
  // Trickster: never where the blow lands.
  /** One ordinary blow in eight that would land on a Trickster, they slip aside from. */
  const tricksterSlip = () => onPath('trickster') && d(1, 8) === 1;
  /** A Trickster's ordinary blow that swung at the air leaves its maker open, as an answered trick does. */
  function tricksterOpening(m) { if (onPath('trickster')) opening(m); }
  /** A Trickster's eye and feet for a trap. */
  const tricksterTraps = () => (onPath('trickster') ? 4 : 0);
  /** A Trickster finds a quarter more in every pile of gold and every gem. */
  const tricksterPurse = q => (onPath('trickster') ? Math.round(q * 1.25) : q);

  // the roll at or above which an attack is a critical hit
  function critFloor() {
    const p = P();
    const base = p.cls !== 'thief' ? 20 : (p.level >= 9 ? 18 : 19);
    return base - (hasPower('keen', 'weapon') ? 1 : 0) - (hasTalent('lucky') ? 1 : 0) - (onPath('assassin') ? 1 : 0) - (onPath('sharpshooter') && weapon().range ? 1 : 0);
  }
  function skillDamage() { return Math.floor((P().level - 1) / 3); }
  function weapon() {
    const p = P();
    const spd = skillSpeed() * (p.eq.offhand ? DUAL_SWING_COST : 1) * berserkerFrenzy();
    if (!p.eq.weapon) return { name: 'fists', dmg: [1, 2, 0], speed: Math.round(450 * spd), e: 0, px: '', range: 0, blunt: true };
    const b = ITEMS[p.eq.weapon.t];
    // a ranger's talents for the bow: a sixth quicker, and two squares further
    const swift = (hasPower('swift', 'weapon') ? 0.85 : 1) * (b.range && hasTalent('swift_quiver') ? 5 / 6 : 1);
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
    const speed = base * skillSpeed() * (dual ? DUAL_SWING_COST : 1) * berserkerFrenzy() * (swift ? 0.85 : 1);
    const avg = dmg => dmg[0] * (dmg[1] + 1) / 2 + dmg[2];
    const finesse = p.cls === 'thief' || p.cls === 'ranger';
    const flat = (finesse ? mod(p.stats.dex) : mod(armStat(p))) + skillDamage();
    const knack = (hasTalent('weapon_master') ? (b && b.twoHanded ? 2 : 1) : 0) + (hasTalent('zeal') && effectFrom('hit', 'bless') ? 1 : 0)
      + berserkerRage() + jewelBonus('might') + (effect('might') ? 2 : 0);
    let blow = Math.max(1, avg(b ? b.dmg : [1, 2, 0]) + known(it) + (it && it.px === 'heavy' && !it.h ? 1 : 0) + bargained() + (finesse ? flat : flat * (base / 700)) + knack);
    if (dual) blow += Math.max(1, avg(ITEMS[p.eq.offhand.t].dmg) + known(p.eq.offhand) + (p.eq.offhand.px === 'heavy' && !p.eq.offhand.h ? 1 : 0) + jewelBonus('might') + berserkerRage() + bargained() + (hasTalent('weapon_master') ? 1 : 0));
    return blow / (speed / 1000);
  }
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
  function hasPower(power, slot, p = P()) {
    const slots = slot ? [slot] : ['weapon', 'offhand', 'armor', 'shield', ...JEWEL_SLOTS, 'cloak'];
    // a relic's powers, the one power an ordinary piece was made with, or a ring's
    return slots.some(s => { const it = p.eq[s], r = relicOf(it); return (!!r && r.powers.includes(power)) || (!!it && (it.pw === power || jewelPowers(it).includes(power))); });
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
    Progress.noteRelic(id);   // the codex remembers it after the run
    log(RELICS[id].lore, 'info');
    if (!had && Progress.load().feats.collector) log('That is every relic in the deep found, over all your runs: the Collector\'s feat, a trophy of its own.', 'good');
  }
  // ---------- curses ----------
  // Found gear keeps its quality to itself (h) until it is worn, studied or
  // appraised, and a cursed piece will not come off once worn until the
  // curse is broken. A cursed thing in the pack does no harm: it only binds.
  const isGear = it => { const b = ITEMS[it.t]; return !!b && (b.kind === 'weapon' || b.kind === 'armor' || b.kind === 'shield' || b.kind === 'ring' || b.kind === 'amulet'); };
  const bound = it => !!(it && it.curse);
  const cap = str => str[0].toUpperCase() + str.slice(1);
  /**
   * Whether a piece's quality is hidden, as far as the player can tell. Only
   * rings that come in amounts can be finely made or cursed, so while a ring
   * or amulet's kind is unknown its quality is part of that mystery: a "?"
   * on one Jade Ring and not another would say which kind each is.
   */
  const qualityHidden = it => !!(it && it.h) && !(isJewel(it) && !isKnown(it.t));
  /** Everything carried or worn whose quality is still hidden. */
  const hiddenGear = () => [...P().inv, ...Object.values(P().eq)].filter(qualityHidden);
  const cursedWorn = () => Object.values(P().eq).filter(bound);
  /** Show the true quality of every piece carried; returns what was revealed. */
  function revealAll() {
    const seen = hiddenGear();
    for (const it of seen) delete it.h;
    return seen;
  }
  /** Break the curse on everything worn; returns how many let go. */
  function breakCurses() {
    const held = cursedWorn();
    for (const it of held) { delete it.curse; delete it.h; }
    return held.length;
  }
  /** A newly revealed piece, as you find it out by putting it on. */
  function tellQuality(it) {
    if (it.curse) log(`${cap(the(it))} tightens around you like a living thing. It is cursed, and will not come off.`, 'bad');
    else if (it.e > 0) log(`It is finely made: ${itemName(it)}.`, 'good');
    else log('It is ordinary work, neither better nor worse.');
  }
  /**
   * Lay this floor's relic on the pile furthest from the way in, which is
   * often a vault's reward, and let a trader here keep the next one behind
   * the counter. The last floor down a road at the fork holds that road's
   * own relic as well, on the next furthest pile. Runs once, when the floor
   * is first generated.
   */
  function placeRelics(L, depth) {
    const R = G.relics;
    if (!R) return;
    const span = G.route && Dungeon.routeSpan(G.opts.levels || 8);
    const road = span && depth === span.to ? routeRelic(G.route) : '';
    for (const id of [R.floor[depth], road]) if (id) layRelic(L, id);
    const trader = (L.npcs || []).find(n => n.kind !== 'encounter' && n.stock);
    if (trader && depth >= 2 && R.offered < R.shop.length) trader.stock.push(relicItem(R.shop[R.offered++]));
  }
  /** Lay a relic on the pile furthest from the way in that holds none yet, or on bare floor if there is no such pile. */
  function layRelic(L, id) {
    const dist = new Int32Array(L.w * L.h).fill(-1);
    const q = [L.start.y * L.w + L.start.x];
    dist[q[0]] = 0;
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi], x = i % L.w, y = (i / L.w) | 0;
      for (const [dx, dy] of DIRS) {
        if (x + dx < 0 || y + dy < 0 || x + dx >= L.w || y + dy >= L.h) continue;
        const ni = (y + dy) * L.w + x + dx, t = L.tiles[ni];
        // a secret door counts as a way through, so a vault's reward can be chosen
        if (dist[ni] >= 0 || t === T.WALL || t === T.TORCH || t === T.FOUNTAIN) continue;
        dist[ni] = dist[i] + 1; q.push(ni);
      }
    }
    let best = null, bd = -1;
    for (const k in L.items) {
      const [x, y] = k.split(',').map(Number), dd = dist[y * L.w + x];
      if (dd > bd && !L.items[k].some(it => it.t === 'artifact' || it.u)) { bd = dd; best = k; }
    }
    if (!best) {
      const held = new Set((L.npcs || []).map(n => key(n.x, n.y)));
      for (let i = 0; i < dist.length; i++) {
        const k = key(i % L.w, (i / L.w) | 0);
        if (dist[i] > bd && L.tiles[i] === T.FLOOR && !L.traps[k] && !held.has(k)) { bd = dist[i]; best = k; }
      }
    }
    if (best) (L.items[best] = L.items[best] || []).push(relicItem(id));
  }
  /**
   * Rings and amulets, from the second floor down: now and then one lies on
   * a pile, and a trader may keep one. They come from a stream of their own,
   * so a seed's floors hold everything they held before there were rings.
   * A ring that comes in amounts may be finely made, or cursed; the kind is
   * known only by its look until it is worn or studied.
   */
  const JEWEL_FIND = 0.45, JEWEL_SHOP = 0.4;
  function placeJewellery(L, depth) {
    if (depth < 2) return;
    const rng = new Rng(`${G.seed}|jewels|${depth}`);
    const maxTier = 1 + Math.floor(depth / 2);
    const pool = Object.keys(ITEMS).filter(id => isJewel({ t: id }) && ITEMS[id].tier <= maxTier);
    if (!pool.length) return;
    const piles = Object.keys(L.items).filter(k => !L.items[k].some(it => it.t === 'artifact'));
    if (piles.length && rng.chance(JEWEL_FIND)) {
      const id = rng.pick(pool), b = ITEMS[id], it = { t: id, q: 1, e: 0 };
      if (b.bonus) {
        const r = rng.next();
        if (r < 0.2) { it.e = r < 0.07 ? -2 : -1; it.curse = 1; }
        else if (r > 0.65) it.e = r > 0.92 ? 2 : 1;
        it.h = 1;
      }
      L.items[rng.pick(piles)].push(it);
    }
    const trader = (L.npcs || []).find(n => n.kind !== 'encounter' && n.stock);
    if (trader && rng.chance(JEWEL_SHOP)) {
      const id = rng.pick(pool);
      trader.stock.push({ t: id, q: 1, e: ITEMS[id].bonus && rng.chance(0.3) ? 1 : 0 });
    }
  }
  /**
   * Robes turn up only in a mage's dungeon: a pile now and then, or on a
   * trader's shelf. A stream of their own, so no other hero's floors change.
   * Found ones keep their make to themselves, as any found armour does.
   */
  const ROBE_FIND = 0.3, ROBE_SHOP = 0.35;
  function placeRobes(L, depth) {
    if (depth < 2 || P().cls !== 'mage') return;
    const rng = new Rng(`${G.seed}|robes|${depth}`);
    const maxTier = 1 + Math.floor(depth / 2);
    const pool = Object.keys(ITEMS).filter(id => ITEMS[id].weight === 'cloth' && ITEMS[id].tier > 1 && ITEMS[id].tier <= maxTier);
    if (!pool.length) return;
    // a trader's shelf reaches a tier deeper than the piles, as it does for other gear
    const shelf = Object.keys(ITEMS).filter(id => ITEMS[id].weight === 'cloth' && ITEMS[id].tier > 1 && ITEMS[id].tier <= maxTier + 1);
    const piles = Object.keys(L.items).filter(k => !L.items[k].some(it => it.t === 'artifact'));
    if (piles.length && rng.chance(ROBE_FIND)) {
      const it = { t: rng.weighted(pool.map(id => [id, ITEMS[id].tier])), q: 1, e: 0, h: 1 };
      const r = rng.next();
      if (r < 0.15) { it.e = -1; it.curse = 1; }
      else if (r > 0.7) it.e = r > 0.93 ? 2 : 1;
      L.items[rng.pick(piles)].push(it);
    }
    const trader = (L.npcs || []).find(n => n.kind !== 'encounter' && n.stock);
    if (trader && rng.chance(ROBE_SHOP)) trader.stock.push({ t: rng.pick(shelf), q: 1, e: rng.chance(0.3) ? 1 : 0 });
  }
  /** A cloak, for anyone: now and then on a pile or a trader's shelf, on a stream of its own. */
  const CLOAK_FIND = 0.2, CLOAK_SHOP = 0.25;
  function placeCloaks(L, depth) {
    if (depth < 2) return;
    const rng = new Rng(`${G.seed}|cloaks|${depth}`);
    const pool = Object.keys(ITEMS).filter(id => ITEMS[id].kind === 'cloak');
    const piles = Object.keys(L.items).filter(k => !L.items[k].some(it => it.t === 'artifact'));
    if (piles.length && rng.chance(CLOAK_FIND)) L.items[rng.pick(piles)].push({ t: rng.pick(pool), q: 1, e: 0 });
    const trader = (L.npcs || []).find(n => n.kind !== 'encounter' && n.stock);
    if (trader && rng.chance(CLOAK_SHOP)) trader.stock.push({ t: rng.pick(pool), q: 1, e: 0 });
  }
  // ---------- the fallen ----------
  // The last hero this device lost lies where they fell, in a later run that
  // is not a daily one: their bones, the gear they died in, and their shade
  // risen over them, made to that floor and fighting as its class did. Laying
  // it to rest forgets them (Progress.layToRest), so each loss is met once.
  // Placed after the floor is made, from a stream of its own, so the map is
  // the seed's own whether anyone is remembered or not.
  const SHADE_FAR = 8;       // steps from the way in its bones lie, at least, where the floor allows
  const SHADE_HP = { fighter: 1.25, mage: 0.8, thief: 0.9 };
  // how each class's shade fights: as it did in life
  /** @type {Record<string, {move?: string, ac?: number, dmg?: number, speed?: number, lunge?: number, ranged?: string, element?: string}>} */
  const SHADE_WAYS = {
    fighter: { move: 'charge', ac: 1, dmg: 10 },
    cleric: { move: 'mend' },
    mage: { ac: -1, dmg: 4, ranged: 'hurls cold fire at', element: 'cold' },
    thief: { speed: 750, lunge: 1, dmg: 6 },
    ranger: { dmg: 6, ranged: 'looses a pale arrow at' },
  };
  // A run is known by when it began, to the millisecond, and never shares it
  // with the run before: a death and a new run in the same instant (as the
  // tests go) must not look like one run meeting its own shade.
  let lastStamp = 0;
  const newRunStamp = () => (lastStamp = Math.max(Date.now(), lastStamp + 1));
  /** Which run this is, as the Hall and the fallen know it. */
  const runKeyOf = g => (g.created ? String(g.created) : `${g.seed}|${g.player.name}|${g.player.cls}`);
  const runKey = () => runKeyOf(G);
  /** The floor a shade keeps in this delve: where its hero fell, but never the first floor, nor the lich's. */
  const shadeFloor = f => Math.max(2, Math.min(f.depth, (G.opts.levels || 8) - 1));
  /** A hero's name with their class: "Brand the Fighter". */
  const heroTitle = (name, c) => `${name} the ${CLASSES[c] ? CLASSES[c].name : c}`;
  /**
   * Made to the floor it keeps, by where that floor stands on the monster
   * ladder (as the rest of its creatures are), not by its bare number: a
   * shade fifteen floors down a long delve was out-hitting the minotaur.
   * @param {any} b  its kind, from MONSTERS @param {{name: string, cls: string, depth: number, tier?: number}} sh
   */
  function shadeStats(b, sh) {
    const d = Math.max(1, Math.min(12, sh.tier || sh.depth || 1)), w = SHADE_WAYS[sh.cls] || {};
    return {
      ...b, name: `Shade of ${sh.name}`, ac: Math.min(19, 12 + Math.floor(d / 2) + (w.ac || 0)), hit: 1 + d,
      dmg: [1, w.dmg || 8, 1 + Math.floor(d / 2)], speed: w.speed || b.speed, xp: 40 + 30 * d,
      ...(w.move ? { move: w.move } : {}), ...(w.lunge ? { lunge: w.lunge } : {}),
      ...(w.ranged ? { ranged: { range: 5, dmg: [2, 6, Math.floor(d / 2)], verb: w.ranged, ...(w.element ? { element: w.element } : {}) } } : {}),
    };
  }
  /** @param {import('./types.js').Level} L @param {number} depth */
  function placeFallen(L, depth) {
    if (G.opts.daily || L.isFinal) return;
    const f = Progress.fallen();
    if (!f || f.run === runKey() || shadeFloor(f) !== depth) return;
    const T = Dungeon.T, w = L.w, at = (x, y) => (x < 0 || y < 0 || x >= w || y >= L.h ? T.WALL : L.tiles[y * w + x]);
    // how far each square is from the way in, walking
    const dist = new Int16Array(w * L.h).fill(-1), walk = [T.FLOOR, T.DOOR, T.DOOR_OPEN, T.STAIRS_DOWN, T.STAIRS_UP];
    const queue = [L.start.y * w + L.start.x];
    dist[queue[0]] = 0;
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q], x = i % w, y = (i / w) | 0;
      for (const [dx, dy] of Dungeon.DIRS) {
        const j = (y + dy) * w + x + dx;
        if (walk.includes(at(x + dx, y + dy)) && dist[j] < 0) { dist[j] = dist[i] + 1; queue.push(j); }
      }
    }
    // a square in a room, clear of everything else and of doorways, with nobody keeping it
    // (nor within a few steps of the floor's champion: its lair is its own, and a shade must never clear it away)
    const keeper = m => MONSTERS[m.id].named || MONSTERS[m.id].boss;
    const busy = (x, y) => (L.items[key(x, y)] || []).length || L.traps[key(x, y)] || L.monsters.some(m => (m.x === x && m.y === y) || (keeper(m) && Math.abs(m.x - x) + Math.abs(m.y - y) <= 3))
      || (L.npcs || []).some(n => Math.abs(n.x - x) + Math.abs(n.y - y) <= 2)
      || Dungeon.DIRS.some(([dx, dy]) => [T.DOOR, T.DOOR_OPEN, T.DOOR_LOCKED, T.STAIRS_DOWN, T.STAIRS_UP].includes(at(x + dx, y + dy)));
    const spots = [];
    for (let i = 0; i < w * L.h; i++) {
      const x = i % w, y = (i / w) | 0;
      if (L.tiles[i] === T.FLOOR && L.roomId[i] >= 0 && dist[i] > 0 && !busy(x, y)) spots.push(i);
    }
    if (!spots.length) return;
    const far = spots.filter(i => dist[i] >= SHADE_FAR);
    const pool = far.length ? far : spots.sort((a, b) => dist[b] - dist[a]).slice(0, 10);
    const i = new Rng(`${G.seed}|fallen|${depth}`).pick(pool), x = i % w, y = (i / w) | 0;
    // whatever stood beside it gives way
    L.monsters = L.monsters.filter(m => MONSTERS[m.id].named || MONSTERS[m.id].boss || Math.abs(m.x - x) + Math.abs(m.y - y) > 1);
    L.dressing = [...(L.dressing || []).filter(d => d.x !== x || d.y !== y), { x, y, k: 'remains_bones', ox: 0, oy: 0.12 }];
    if (f.gear.length) L.items[key(x, y)] = f.gear.map(it => ({ ...it }));
    const tier = Dungeon.tierAt(depth, G.opts.levels || 8), d = Math.min(12, tier), hp = Math.round((6 + 6 * d) * (SHADE_HP[f.cls] || 1));
    const uid = L.monsters.reduce((u, m) => Math.max(u, m.uid), depth * 1000) + 1;
    L.monsters.push({ uid, id: 'shade', x, y, hp, maxHp: hp, awake: false, nextAct: 0, rx: x, ry: y, fromX: x, fromY: y, moveT0: 0, moveT1: 0, flashUntil: 0,
      shade: { name: f.name, cls: f.cls, level: f.level, run: f.run, depth, tier } });
    L.bones = { name: f.name, cls: f.cls, x, y, fell: f.depth, ...(f.killer ? { killer: f.killer } : {}) };
  }
  // ---------- the music's cue ----------
  /**
   * How the fight stands, for the music: the lich awake; a named champion or
   * a shade awake and close; something awake close enough to come to blows;
   * something awake further off; or nothing at all.
   * @returns {'quiet'|'wary'|'fight'|'champion'|'boss'}
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
      if (b.boss && m.spoke) return 'boss';
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
  /** Coming down onto the floor: one line, the first time, so the fight is chosen. @param {import('./types.js').Level} L */
  function bonesArrive(L) {
    if (!L.bones || L.bonesSaid || !L.monsters.some(m => m.shade)) return;
    L.bonesSaid = true;
    const b = L.bones;
    // a death on the first floor waits on the second, and one deeper than this delve goes on its last floor before the lich's: say so
    const where = !b.fell || b.fell === L.depth ? 'fell on this floor' : `fell on floor ${b.fell} of another delve, and their bones have found their way here`;
    log(`A cold you know settles on you. ${heroTitle(b.name, b.cls)} ${where}${b.killer ? `, killed by ${b.killer},` : ''} and did not stay down: somewhere on this floor their shade keeps watch over their bones.`, 'bad');
  }
  function shadeWakes(m) {
    m.spoke = true;
    log(`The Shade of ${m.shade.name} rises from its bones in the gear it died in, and knows you: another who came down here for the Heart.`, 'bad');
    meet(m);
    Sound.play('dread');
    fx.shakeAmp = 3; fx.shakeMs = 400; fx.shakeUntil = realNow + 400;
  }
  function shadeFalls(m) {
    fx.shakeAmp = 5; fx.shakeMs = 600; fx.shakeUntil = realNow + 600;
    Sound.play('namedfall', heard(m));
    learn(m.id, 'answer');
    Progress.layToRest(m.shade.run);
    G.rested = heroTitle(m.shade.name, m.shade.cls);
  }
  /** What killed the hero, as the one who finds their bones will be told it: "a goblin", "Grisk, the Goblin King". */
  function killerPhrase() {
    const k = G.lastAttacker;
    if (!k || k.encounter || k.cause) return '';
    return k.name.includes(',') || /^the /i.test(k.name) ? k.name : `${/^[aeiou]/i.test(k.name) ? 'an' : 'a'} ${k.name.toLowerCase()}`;
  }
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
  const armStat = p => p.cls === 'cleric' ? Math.max(p.stats.str, p.stats.wis) : p.cls === 'ranger' ? p.stats.dex : p.stats.str;
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
    if (onPath('warden')) ac += 1;
    if (p.eq.armor) ac += ITEMS[p.eq.armor.t].ac + (p.eq.armor.e || 0) + (p.eq.armor.px === 'sturdy' ? 1 : 0);
    // a focus turns no more blows for being well made: its make is in what it does
    if (p.eq.shield) ac += ITEMS[p.eq.shield.t].focus ? ITEMS[p.eq.shield.t].ac : ITEMS[p.eq.shield.t].ac + (p.eq.shield.e || 0) + (p.eq.shield.px === 'sturdy' ? 1 : 0) + (hasTalent('bulwark') ? 2 : 0) + knightShieldAC();
    // the Stairwarden's Arms, both worn
    if (setWorn('stair', p)) ac += 2;
    // a second blade is no shield, but it turns aside a blow now and then
    if (p.eq.offhand) ac += OFFHAND_PARRY;
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
    const s = mstatBase(m);
    // a floor readier for a strong hero, or a harder delve: its creatures hit surer and harder
    const edge = (m.edge || 0) + diffEdge();
    // on a flooded floor everything wades: a quarter slower, the lich aside
    const wade = !s.boss && G && G.levels && lvl() && lvl().twist === 'flooded';
    if (!edge && !wade) return s;
    return { ...s, ...(edge ? { hit: s.hit + edge, dmg: [s.dmg[0], s.dmg[1], s.dmg[2] + edge] } : {}), ...(wade ? { speed: Math.round(s.speed * FLOOD_SLOW) } : {}) };
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

  // ---------- items ----------
  /** "a sling", "an antidote", and a thing that comes as several ("throwing knives") with no article at all. */
  const aThing = n => (/s$/i.test(n) ? n : `${/^[aeiou]/i.test(n) ? 'an' : 'a'} ${n}`);
  function itemName(it) {
    const r = relicOf(it);
    if (r) return r.name[0].toUpperCase() + r.name.slice(1);
    if (it.t === 'key') return `${it.color[0].toUpperCase() + it.color.slice(1)} Key`;
    if (it.t === 'gem') return it.name || 'Gem';
    const b = ITEMS[it.t];
    let n = b.name;
    // a quality of its make goes in front, once its make is known
    if (it.px && !it.h && PREFIX_NAME[it.px]) n = `${PREFIX_NAME[it.px]} ${n}`;
    if (!isKnown(it.t)) {
      const look = G.looks[it.t];
      n = `${look.adj[0].toUpperCase() + look.adj.slice(1)} ${{ potion: 'Potion', scroll: 'Scroll', ring: 'Ring', amulet: 'Amulet' }[b.kind]}`;
    }
    // a ring you cannot name keeps its make to itself too: '+2' would say it is
    // one of the kinds that come in amounts, and not cursed
    if (it.e && !it.h && !(isJewel(it) && !isKnown(it.t))) n += it.e > 0 ? ` +${it.e}` : ` −${-it.e}`;
    // a power is part of what studying or wearing a piece tells you
    if (it.pw && !it.h) n += ` ${POWER_SUFFIX[it.pw] || ''}`;
    if (it.q > 1) n += ` ×${it.q}`;
    return n;
  }
  function spriteFor(it) {
    if (it.t === 'key') return 'key_' + it.color;
    if (it.u && Assets.sprites['relic_' + ITEMS[it.t].sprite]) return 'relic_' + ITEMS[it.t].sprite;
    // a potion keeps its bottle once it is known: the same draught, now named
    // (and a ring its stone)
    if (!isKnown(it.t) || (['potion', 'ring', 'amulet'].includes(ITEMS[it.t].kind) && G.looks[it.t])) return G.looks[it.t].sprite;
    return ITEMS[it.t].sprite;
  }
  /**
   * Put an item in the pack, stacking it where the kind allows.
   * @param {import('./types.js').Item} it
   * @returns {boolean} false when the pack is full
   */
  function giveItem(it) {
    const p = P();
    const b = ITEMS[it.t];
    // keys of one colour share a slot: a door forced open leaves its key
    // spare, and three spare silver keys took three of the pack's squares
    if (b.stack || it.t === 'key') {
      const ex = p.inv.find(x => x.t === it.t && (it.t !== 'key' || x.color === it.color));
      if (ex) { ex.q = (ex.q || 1) + (it.q || 1); return true; }
    }
    if (p.inv.length >= INV_MAX) return false;
    p.inv.push({ t: it.t, q: it.q || 1, e: it.e || 0, color: it.color, name: it.name, ...(it.u ? { u: it.u } : {}), ...(it.pw ? { pw: it.pw } : {}), ...(it.px ? { px: it.px } : {}),
      ...(it.h ? { h: 1 } : {}), ...(it.curse ? { curse: 1 } : {}), ...(it.studied ? { studied: it.studied } : {}) });
    return true;
  }
  /**
   * Take a single unit out of the pack.
   * @param {import('./types.js').Item} it
   * @returns {import('./types.js').Item|null} null when it was not being carried
   */
  function removeOne(it) {
    const p = P();
    const i = p.inv.indexOf(it);
    if (i < 0) return null;                                  // not in the pack
    if (it.q > 1) { it.q--; return { t: it.t, q: 1, e: it.e, color: it.color, name: it.name }; }
    p.inv.splice(i, 1);
    return it;
  }
  function canEquip(it) {
    const p = P(), b = ITEMS[it.t], c = cls();
    if (b.kind === 'ring' || b.kind === 'amulet' || b.kind === 'cloak') return null;     // anyone can wear one
    if (b.kind === 'weapon') return b.cls.includes(p.cls) ? null : `${c.plural} cannot wield ${aThing(b.name.toLowerCase())}.`;
    if (b.kind === 'armor') {
      if (armorFits(c, b)) return null;
      if (b.weight === 'cloth') return 'Only a mage wears robes: they are woven for spellwork, not for blows.';
      if (c.armor === 'cloth') return `${c.plural} wear robes, not armour: it would bind a caster's hands.`;
      return `${c.plural} can only wear light armour.`;
    }
    if (b.kind === 'shield') {
      if (!shieldFits(c, b)) {
        if (b.focus) return b.focus === 'mage' ? 'Only a mage can draw on that.' : 'Only a cleric can call on that.';
        if (!c.shield) return `${c.plural} cannot use shields.`;
        return `${c.plural} carry only a buckler: anything bigger slows the hands.`;
      }
      if (p.eq.weapon && ITEMS[p.eq.weapon.t].twoHanded) return b.focus ? 'You need a free hand for that: take up a one-handed weapon first.' : 'You need a free hand for a shield.';
      if (p.eq.offhand) return 'Your off hand is holding a weapon.';
      return null;
    }
    return 'That cannot be equipped.';
  }
  function equip(it, quiet, toSlot) {
    const p = P(), b = ITEMS[it.t];
    let slot = toSlot === 'offhand' ? 'offhand' : b.kind;
    // two fingers to choose from: an empty one first, then whichever is not held by a curse
    if (b.kind === 'ring') slot = toSlot === 'ring' || toSlot === 'ring2' ? toSlot : !p.eq.ring ? 'ring' : !p.eq.ring2 ? 'ring2' : bound(p.eq.ring) ? 'ring2' : 'ring';
    if (p.eq[slot] === it) return true;                      // already worn
    if (p.inv.indexOf(it) < 0) { log('You are not carrying that.', 'bad'); return false; }
    const why = slot === 'offhand' ? offhandReason(it) : canEquip(it);
    if (why) { if (!quiet) log(why, 'bad'); return false; }
    // nothing takes the place of a cursed piece, or the hand it holds
    const inTheWay = [p.eq[slot]];
    if (slot === 'offhand') inTheWay.push(p.eq.shield);
    if (slot === 'weapon' && b.twoHanded) inTheWay.push(p.eq.shield, p.eq.offhand);
    const stuck = inTheWay.find(bound);
    if (stuck) { log(`${cap(the(stuck))} will not let go. It is cursed.`, 'bad'); Sound.play('error'); return false; }
    // the off hand, a shield and a two-handed grip all want the same hand
    const freeHand = held => {
      if (!held) return true;
      if (p.inv.length >= INV_MAX) { log(`No room in your pack to stow ${the(held)}.`, 'bad'); return false; }
      p.inv.push(held);
      if (!quiet) log(`You stow ${the(held)}.`);
      return true;
    };
    if (slot === 'offhand') {
      if (p.eq.weapon && ITEMS[p.eq.weapon.t].twoHanded) { if (!quiet) log('A two-handed weapon needs both hands.', 'bad'); return false; }
      if (!freeHand(p.eq.shield)) return false;
      p.eq.shield = null;
    }
    if (slot === 'weapon' && b.twoHanded) {
      if (!freeHand(p.eq.shield)) return false;
      p.eq.shield = null;
      if (!freeHand(p.eq.offhand)) return false;
      p.eq.offhand = null;
    }
    const i = p.inv.indexOf(it);
    if (i >= 0) p.inv.splice(i, 1);
    if (p.eq[slot]) p.inv.push(p.eq[slot]);
    p.eq[slot] = it;
    refreshSp(p);
    if (!quiet) log(`You equip ${the(it)}.`);
    // putting it on is how you find out what it is: a ring or an amulet says
    // what it was made for as it goes on, then how well
    if (isJewel(it) && !isKnown(it.t)) { G.known[it.t] = 1; log(`It is ${ITEMS[it.t].kind === 'amulet' ? 'an' : 'a'} ${ITEMS[it.t].name}.`, 'info'); }
    if (it.h) { delete it.h; tellQuality(it); }
    emit('inv');
    return true;
  }
  function unequip(slot) {
    const p = P();
    if (!p.eq[slot]) return;
    if (bound(p.eq[slot])) { log(`${cap(the(p.eq[slot]))} will not come off. It is cursed.`, 'bad'); Sound.play('error'); return; }
    if (p.inv.length >= INV_MAX) { log('Your pack is full: drop something first.', 'bad'); return; }
    p.inv.push(p.eq[slot]);
    log(`You remove ${the(p.eq[slot])}.`);
    p.eq[slot] = null;
    refreshSp(p);
    emit('inv');
  }
  /**
   * Why using this right now would achieve nothing, or null if it would.
   * @param {import('./types.js').Item} it
   * @returns {string|null}
   */
  function wasteReason(it) {
    const p = P(), b = ITEMS[it.t];
    if (!b) return null;
    if (!isKnown(it.t)) return null;
    if (b.kind === 'food' && p.food >= 100) return 'You are too full to eat another bite.';
    if (b.kind === 'potion') {
      if (b.effect === 'heal' && p.hp >= p.maxHp) return 'You are unhurt. The draught would be wasted.';
      if (b.effect === 'cure' && !p.poison) return 'You are not poisoned.';
      if (b.effect === 'mana' && (!p.maxSp || p.sp >= p.maxSp)) return 'Your mind is already clear.';
    }
    if (b.kind === 'scroll') {
      if (b.effect === 'heal' && p.hp >= p.maxHp) return 'You are unhurt. The scroll would be wasted.';
      if (b.effect === 'fire' && !boltTargets(3, false).length) return 'There is nothing ahead to burn.';
      if (b.effect === 'map' && lvl().explored.every(v => v)) return 'You already know this floor.';
      if (b.effect === 'uncurse' && !cursedWorn().length && !hiddenGear().length) return 'Nothing you wear is cursed, and you know all your gear.';
    }
    return null;
  }
  // A draught or a meal is seen: the bottle comes up and tips back, the bread
  // is bitten (see the renderer), in the colour of what the draught does.
  const POTION_GLOW = { heal: '#60e080', cure: '#c8f0a0', might: '#ff6040', mana: '#6090ff' };
  // What a draught or a scroll gave (life, spell points) shows on the bars
  // only once it is taken; a blow landing meanwhile still shows at once.
  function holdVitals(was, ms) {
    const p = P();
    fx.hold = { dhp: Math.max(0, p.hp - was.hp), dsp: Math.max(0, p.sp - was.sp), until: realNow + ms };
  }
  /** Life and spell points as the bars should show them this moment. */
  function vitals() {
    const p = P(), h = fx.hold;
    if (!h || realNow >= h.until) return { hp: p.hp, sp: p.sp };
    return { hp: Math.max(1, p.hp - h.dhp), sp: Math.max(0, p.sp - h.dsp) };
  }
  function showUse(kind, it, color) { fx.useAt = realNow; fx.useKind = kind; fx.useSprite = spriteFor(it); fx.useColor = color; }
  function useItem(it) {
    const p = P(), b = ITEMS[it.t];
    if (p.held > G.t) { blocked(heldWhy()); return; }
    const consumable = b.kind === 'food' || b.kind === 'potion' || b.kind === 'scroll';
    if (consumable && p.inv.indexOf(it) < 0) { log('You are not carrying that.', 'bad'); return; }
    if (b.kind === 'potion' && vowed('unaided')) { log('You swore to go unaided: no draught passes your lips.', 'bad'); Sound.play('error'); return; }
    if (consumable) {
      const why = wasteReason(it);
      if (why) { log(why, 'bad'); Sound.play('error'); emit('waste'); return; }
      noteUsed(b.kind);
    }
    if (b.kind === 'food') {
      showUse('eat', it, '#e0c080');
      removeOne(it);
      p.food = Math.min(100, p.food + b.food);
      log(`You eat the ${b.name.toLowerCase()}. ${p.food >= 90 ? 'You are full.' : 'That was good.'}`, 'good');
      Sound.play('eat');
    } else if (b.kind === 'potion') {
      const wasNew = !isKnown(it.t);
      showUse('drink', it, POTION_GLOW[b.effect] || '#e0e0ff');
      removeOne(it);
      if (wasNew) { G.known[it.t] = 1; log(`You drink the unknown potion... it is ${aThing(b.name)}.`, 'info'); }
      // the cork and the swallows now; what it does is heard once it is down
      Sound.play('drink');
      fxDelay = 420;
      const was = { hp: p.hp, sp: p.sp };
      try {
        switch (b.effect) {
          case 'heal': { const n = d(...b.heal); healPlayer(n); log(`You drink the potion and heal ${n}.`, 'good'); break; }
          case 'cure': p.poison = null; log('The poison leaves your veins.', 'good'); soon(() => Sound.play('heal')); break;
          case 'might': p.effects.might = { amount: 2, until: G.t + 120000 }; log('You feel mighty!', 'good'); soon(() => Sound.play('spell')); break;
          case 'mana': if (p.maxSp) { p.sp = p.maxSp; log('Your mind clears. Spell points restored.', 'good'); } else log('Your thoughts feel unusually sharp, but nothing else happens.'); soon(() => Sound.play('spell')); break;
        }
        holdVitals(was, fxDelay);
      } finally { fxDelay = 0; }
    } else if (b.kind === 'scroll') {
      const wasNewS = !isKnown(it.t);
      removeOne(it);
      if (wasNewS) { G.known[it.t] = 1; log(`You read the unknown scroll... it is ${aThing(b.name)}.`, 'info'); }
      // the scroll rises in the off hand, its writing kindles in the colour of
      // what it does, and it burns away (see the renderer); what it does is
      // settled now, and shown as the page goes up
      fx.readAt = realNow; fx.readKind = b.effect; fx.readColor = SCROLL_GLOW[b.effect] || '#fe8';
      // one sound for the reading, pitched by what it does; anything else it
      // makes a sound of (a heal) is heard as the page goes up
      Sound.play('read', { kind: b.effect });
      fxDelay = Math.round(READ_MS * 0.62);
      const wasS = { hp: p.hp, sp: p.sp };
      try {
        switch (b.effect) {
          case 'fire': {
            burnWeb();
            const targets = boltTargets(3, false);
            // the fireball leaves the burning page, not the hand
            spellFx('fireball', '#ff7020', 750, targets, 3, READ_MS * 0.6, { x: 0.3, y: 0.58 });
            if (!targets.length) { log('A ball of fire bursts harmlessly against the stones.'); break; }
            castingName = 'fireball';
            // what it looks like waits for the fireball to burst: it leaves the
            // page six tenths into the reading and flies for a third of its 750ms
            fxDelay = Math.round(READ_MS * 0.6 + 750 * 0.35);
            try {
              for (const m of targets) {
                if (packSize(m) > 1) log(`The fireball engulfs all ${packSize(m)} of the ${mstat(m).name}s!`, 'good');
                hitGroup(m, elemental(m, pyroFire(d(4, 6)), 'fire'), 'burn');
              }
            } finally { castingName = ''; }
            break;
          }
          case 'heal': { const n = d(...b.heal); healPlayer(n); log(`Warmth flows through you. You heal ${n}.`, 'good'); break; }
          case 'map': { const L = lvl(); L.explored.fill(1); log('The layout of this floor burns itself into your mind.', 'good'); break; }
          case 'uncurse': {
            const lifted = breakCurses(), seen = revealAll();
            if (lifted) log(`A cold weight lifts from you. ${lifted > 1 ? 'The curses are' : 'The curse is'} broken.`, 'good');
            if (seen.length) log(`You see your gear for what it is: ${seen.map(x => itemName(x) + (x.curse ? ' (cursed)' : '')).join(', ')}.`, 'info');
            break;
          }
          case 'teleport': {
            const L = lvl(); const spots = [];
            // somewhere clear: not on a creature, nor a trader or an encounter's stone, nor a barrel
            for (let i = 0; i < L.w * L.h; i++) { const x = i % L.w, y = (i / L.w) | 0; if (L.tiles[i] === T.FLOOR && !monsterAt(x, y) && !npcAt(x, y) && !propAt(x, y) && !companion.at(x, y)) spots.push(i); }
            const s = Dice.pick(spots);
            p.x = s % L.w; p.y = (s / L.w) | 0;
            snapCam(); distFieldAt = -1e9;
            log('The world lurches and you find yourself elsewhere.', 'info');
            checkTile();
            break;
          }
        }
        holdVitals(wasS, fxDelay);
      } finally { fxDelay = 0; }
    } else if (b.kind === 'weapon' || b.kind === 'armor' || b.kind === 'shield' || b.kind === 'ring' || b.kind === 'amulet' || b.kind === 'cloak') {
      equip(it);
      return;
    } else if (b.kind === 'key') {
      log('Use keys by walking into a locked door.');
      return;
    } else if (b.kind === 'artifact') {
      log('The Heart pulses warmly in your hands.', 'info');
      return;
    } else {
      log('You cannot use that.');
      return;
    }
    emit('inv');
  }
  // Intelligence lets you work out what an unknown potion or scroll is by
  // looking at it, rather than finding out by drinking it. A failed attempt
  // cannot be retried on the same kind until you have learned something
  // more, which is to say gained a level.
  const STUDY_DC = 12;
  function studyReason(it) {
    const b = ITEMS[it.t];
    // a piece of gear can be judged by eye, if you know what to look for
    if (b && isGear(it)) {
      if (!it.h && isKnown(it.t)) return 'You already know its quality.';
      if (it.studied === P().level) return 'You cannot judge it yet. Perhaps with more experience.';
      // what a ring was made for is one question for every ring of that look,
      // as a potion's colour is: a second Jade Ring is no fresh try
      if (isJewel(it) && !isKnown(it.t) && G.studied && G.studied[it.t] === P().level) return 'It still means nothing to you. Perhaps with more experience.';
      return null;
    }
    if (!b || (b.kind !== 'potion' && b.kind !== 'scroll')) return 'There is nothing to puzzle out about that.';
    if (isKnown(it.t)) return 'You already know what that is.';
    if (G.studied && G.studied[it.t] === P().level) return 'It still means nothing to you. Perhaps with more experience.';
    return null;
  }
  function study(it) {
    const why = studyReason(it);
    if (why) { log(why); return null; }
    const c = statCheck('int', STUDY_DC, P().cls === 'mage' ? 2 : 0);
    if (isGear(it)) {
      if (c.pass) {
        const was = itemName(it);
        delete it.h; G.known[it.t] = 1;
        if (isJewel(it) && was !== ITEMS[it.t].name) log(`You turn the ${was} to the light and know it: ${ITEMS[it.t].name}.`, 'info');
        log(`You look ${the(it)} over closely: ${itemName(it)}${it.curse ? ', and there is a curse worked into it' : ''}.${c.note}`, it.curse ? 'bad' : 'good');
      } else {
        it.studied = P().level;
        if (isJewel(it) && !isKnown(it.t)) {
          (G.studied = G.studied || {})[it.t] = P().level;
          log(`You turn ${the(it)} to the light, but cannot tell what it was made for.${c.note}`);
        } else log(`You look ${the(it)} over, but cannot tell good work from bad.${c.note}`);
      }
      emit('inv');
      return c;
    }
    if (c.pass) {
      const was = itemName(it);
      G.known[it.t] = 1;
      log(`You study the ${was} and recognise it: ${ITEMS[it.t].name}.${c.note}`, 'good');
    } else {
      (G.studied = G.studied || {})[it.t] = P().level;
      log(`You turn the ${itemName(it)} over and over, but it means nothing to you yet.${c.note}`);
    }
    emit('inv');
    return c;
  }
  function dropItem(it) {
    const p = P(), L = lvl();
    if (it.t === 'artifact') { log('You could not bear to part with it.', 'bad'); return; }
    const one = removeOne(it);
    if (!one) { log('You are not carrying that.', 'bad'); return; }
    const k = key(p.x, p.y);
    // what you put down stays down when you walk back over it: the Take row lifts it again
    one.left = 1;
    (L.items[k] = L.items[k] || []).push(one);
    log(`You drop ${the(one)}.`);
    emit('inv');
  }
  function floorItems() { return lvl().items[key(P().x, P().y)] || []; }
  /** Gear this hero's class can never use: walking over it leaves it where it lies, for the Take row. */
  function uselessToClass(it, p = P()) {
    const b = ITEMS[it.t], c = CLASSES[p.cls];
    if (!b || !c) return false;
    if (b.kind === 'weapon') return !b.cls.includes(p.cls);
    if (b.kind === 'armor') return !armorFits(c, b);
    if (b.kind === 'shield') return !shieldFits(c, b);
    return false;
  }
  /** The lich, while it stands: the Heart will not come loose until it falls. */
  function keeper() { return lvl().monsters.find(m => MONSTERS[m.id].boss) || null; }
  /** What can be picked up here: not the Heart while its keeper stands. */
  // A belt holds five of any one draught; the rest stays where it lay. Down
  // here a hero used to wade out of every floor with a score of potions and
  // never feel the want of one.
  const BELT = 5;
  /** How many more of this a hero can carry: five of each draught, any number of the rest. */
  function beltRoom(t) {
    if (ITEMS[t].kind !== 'potion') return Infinity;
    const ex = P().inv.find(x => x.t === t);
    return BELT - (ex ? ex.q : 0);
  }
  function takeable() { const k = keeper(); return floorItems().filter(it => !(k && it.t === 'artifact') && !(it.t in ITEMS && beltRoom(it.t) <= 0)); }
  /** Said once each time the hero steps onto the Heart while the lich still holds it. */
  function heartHeld() {
    const k = keeper();
    if (k && floorItems().some(it => it.t === 'artifact')) log(`The Heart will not come loose. The ${MONSTERS[k.id].name}'s cold holds it fast, and will while it stands.`, 'bad');
  }
  function takeItem(it) {
    const p = P(), L = lvl(), k = key(p.x, p.y);
    const list = L.items[k] || [];
    const i = list.indexOf(it);
    if (i < 0) return;
    const was = it.left;
    delete it.left;
    if (it.t === 'gold' || it.t === 'gem') { it.q = tricksterPurse(it.q); noteGold(it.q); }
    if (it.t === 'gold') { p.gold += it.q; log(`You pick up ${it.q} gold.`, 'good'); Sound.play('gold'); list.splice(i, 1); }
    else if (it.t === 'gem') { p.gold += it.q; log(`You find ${/^[aeiou]/i.test(it.name) ? 'an' : 'a'} ${it.name} worth ${it.q} gold.`, 'good'); Sound.play('gold'); list.splice(i, 1); }
    else if (it.t === 'artifact') {
      // the lich's cold holds the Heart fast: the last fight cannot be walked round
      if (keeper()) { heartHeld(); Sound.play('error'); return; }
      list.splice(i, 1);
      claimHeart();
    }
    else if (it.t === 'page') {
      list.splice(i, 1);
      const entry = JOURNAL[it.page];
      if (entry && !G.journal.some(j => j.i === it.page)) {
        G.journal.push({ i: it.page, depth: G.depth });
        log(`You find ${entry.title.toLowerCase()}.`, 'info');
        Sound.play('pickup');
        emit('page');
      }
    }
    else if (beltRoom(it.t) <= 0) { log(`Your belt holds ${BELT} of those already.`); }
    else if (beltRoom(it.t) < (it.q || 1)) {
      const room = beltRoom(it.t);
      if (giveItem({ ...it, q: room })) { it.q -= room; log(`You take ${room} of them. Your belt holds no more.`); Sound.play('pickup'); }
      else log('Your pack is full: drop something first.', 'bad');
    }
    else if (giveItem(it)) { log(`You pick up ${the(it)}.`); Sound.play('pickup'); list.splice(i, 1); if (it.u) discoverRelic(it.u); }
    else { log('Your pack is full: drop something first.', 'bad'); }
    // still lying there (a full pack, a full belt): still the hero's own, left where it was put
    if (was && list.includes(it)) it.left = was;
    if (!list.length) delete L.items[k];
    emit('inv');
  }
  /** What lies under the hero, picked up from the row at the foot of the view. */
  function takeHere() {
    if (takeable().length) { pickupAll(); return; }
    // only the Heart, held by its keeper, or draughts the belt has no room for
    const k = keeper();
    if (k && floorItems().some(it => it.t === 'artifact')) log(`The Heart will not come loose. The ${MONSTERS[k.id].name}'s cold holds it fast, and will while it stands.`, 'bad');
    else if (floorItems().length) log('Your belt holds five of any one draught: there is no room for these.', 'bad');
  }
  /** Everything here that can be taken; walking on, not what the hero put down nor gear the class cannot use. */
  function pickupAll(walking = false) {
    for (const it of takeable().filter(it => !(walking && (it.left || uselessToClass(it))))) {
      takeItem(it);
      if (G.status !== 'playing') break;   // lifting the Heart ends the run: nothing more is picked up after
    }
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
    p.maxHp = Math.max(10, c.hitDie + 6 + (c.startHp || 0) + mod(p.stats.con));
    p.hp = p.maxHp;
    p.maxSp = spMax(p); p.sp = p.maxSp;
    lastBlocked = -1e9; queuedAttack = false; queuedMove = null;   // nothing carries over from the last run's clock
    clearFx();
    encounter = null;   // nor does one carry over into a new run
    G = { seed: cfg.seed, opts: cfg.opts, player: p, levels: {}, depth: 1, log: [], logSeq: 0, t: 0, status: 'playing', lastSpell: null, created: newRunStamp(), version: 4, looks: buildLooks(cfg.seed), known: {}, journal: [], pendingBoons: null };
    // only vows that exist, once each; the Daily Delve is the same run for everyone, so it takes none
    if (G.opts.vows) G.opts.vows = G.opts.daily ? [] : [...new Set(G.opts.vows)].filter(v => VOWS[v]);
    G.relics = { ...relicPlan(cfg.seed, cfg.cls, cfg.opts.levels), offered: 0, found: [] };
    G.stats = freshStats();
    if (bg === 'cloistered') for (const id in ITEMS) G.known[id] = 1;   // raised among the books
    // the starting kit is familiar to its owner
    for (const id of c.startKit) G.known[id] = 1;
    for (const id of c.startKit) giveItem({ t: id, q: 1, e: 0 });
    if (bg === 'returned') { G.known.potion_xheal = 1; giveItem({ t: 'potion_xheal', q: 1, e: 0 }); }   // one good draught kept back
    for (const it of p.inv.slice()) {
      const k = ITEMS[it.t].kind;
      if ((k === 'weapon' || k === 'armor' || k === 'shield') && !p.eq[k]) equip(it, true);
    }
    enterLevel(1, 'down');
    log(`Welcome, ${p.name} the ${c.name}. ${G.opts.levels} floors lie below. Find the Heart of the Mountain.`, 'good');

    return G;
  }

  function enterLevel(depth, from) {
    const p = P(), cameFrom = G.depth;
    queuedAttack = false; queuedMove = null;   // a swing or step waiting on the last floor stays there
    p.grabbed = null; p.webbed = 0; p.held = 0;
    const fresh = !G.levels[depth];
    if (!fresh) { stepAside(G.levels[depth]); pruneRemains(G.levels[depth]); }
    if (!G.levels[depth]) { G.levels[depth] = Dungeon.generate(G.seed, depth, G.route ? { ...G.opts, route: G.route } : G.opts); placeRelics(G.levels[depth], depth); placeJewellery(G.levels[depth], depth); placeRobes(G.levels[depth], depth); placeFoci(G.levels[depth], depth); placeCloaks(G.levels[depth], depth); twistLevel(G.levels[depth], depth); placeFallen(G.levels[depth], depth); hardenLevel(G.levels[depth], depth); pressLevel(G.levels[depth], depth); }
    G.depth = depth;
    const L = G.levels[depth];
    const s = from === 'down' ? L.start : (L.downStart || L.start);
    p.x = s.x; p.y = s.y; p.dir = s.dir;
    // you arrive beside the stair you came by; that one needs no announcing
    const came = stairsBeside();
    besideKey = came ? came.key : '';
    for (const m of L.monsters) { m.nextAct = G.t + 600 + Math.random() * 600; m.rx = m.x; m.ry = m.y; m.moveT1 = 0; m.windup = null; m.volley = null; }
    closeShop();
    snapCam();
    distFieldAt = -1e9;
    p.deepest = Math.max(p.deepest, depth);
    companion.arrive(cameFrom);
    if (from === 'down') {
      if (depth > 1) log(`You descend to floor ${depth}. ${THEMES[L.theme].flavor}`, 'info');
      else log(THEMES[L.theme].flavor, 'info');
      if (L.isFinal) log('A dreadful presence waits somewhere on this floor.', 'bad');
      if (L.twist && TWISTS[L.twist]) log(TWISTS[L.twist].arrive, L.twist === 'market' ? 'good' : 'info');
      namedArrives(L);
      bonesArrive(L);
      threadArrivals(L, depth, fresh);
    } else log(`You climb back up to floor ${depth}.`, 'info');
    emit('level');
    checkTile();
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
      log('The way out is sealed behind you. Only the depths remain.', 'info');
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
    if (t === T.DOOR_LOCKED) return P().inv.some(it => it.t === 'key' && it.color === (lvl().locks[key(tx, ty)] || 'brass')) ? 'Unlock' : 'Force';
    if (t === T.STAIRS_DOWN) return 'Descend';
    if (t === T.STAIRS_UP) return G.depth > 1 ? 'Climb' : 'Use';
    if (t === T.FOUNTAIN) return 'Drink';
    if (npcAt(tx, ty)) return npcAt(tx, ty).kind === 'encounter' ? 'Examine' : 'Trade';
    if (companion.at(tx, ty) && !monsterAt(tx, ty)) return companion.here().mode === 'stay' ? 'Come' : 'Stay';
    // Use still strikes what is in front, but the button beside it already
    // says Attack; two buttons with one name read as a mistake
    if (monsterAt(tx, ty)) return 'Use';
    if (propAt(tx, ty)) return 'Break';
    if (t === T.DOOR_OPEN) return 'Close';
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
    if (t === T.DOOR_LOCKED) { tryUnlock(nx, ny); return true; }
    if (t === T.STAIRS_DOWN) { takeStairsDown(); return true; }
    if (t === T.STAIRS_UP) { ascend(); return true; }
    if (t === T.SECRET) { revealSecret(nx, ny, false); return true; }
    if (t === T.FOUNTAIN) { drinkFountain(nx, ny); return true; }
    const trader = npcAt(nx, ny);
    if (trader) { if (trader.kind === 'encounter') openEncounter(trader); else openShop(trader); return true; }
    // walking into a barrel, crate or urn kicks it over: it is not walked through
    // like air, nor left in the way (the step is spent on it)
    const prop = propAt(nx, ny);
    if (prop && !monsterAt(nx, ny)) { smash(lvl(), prop, true); return true; }
    const m = monsterAt(nx, ny);
    if (m) { m.awake = true; log(`The ${MONSTERS[m.id].name} blocks your way.`); return false; }
    // anything the interactive cases above did not claim had better be walkable
    if (!passable(nx, ny)) { blocked('Something blocks your path.'); return false; }
    // the hound steps into your square as you step into its own
    if (companion.at(nx, ny)) companion.swap(p.x, p.y);
    p.x = nx; p.y = ny; p.steps++;
    if (rel === 1 || rel === 3) p.shadowUntil = G.t + 2500;
    startCam(lvl().twist === 'flooded' ? Math.round(MOVE_MS * FLOOD_SLOW) : MOVE_MS);
    Sound.play('step');
    distFieldAt = -1e9;
    onStep();
    const eye = (p.cls === 'thief' ? 0.5 : 0) + (p.bg === 'tombwise' ? 0.35 : 0) + (hasPower('seer') ? 0.35 : 0);
    if (eye > 0) for (const [dx, dy] of DIRS) if (tile(p.x + dx, p.y + dy) === T.SECRET && Math.random() < eye) revealSecret(p.x + dx, p.y + dy, true);
    checkTile();
    if (G.status === 'playing') noticeStairs();
    return true;
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
    logMerged(message);
  }
  /** Log a line, or count it up if it just said the same thing. */
  // the same line again counts up on its own line: log() folds any repeat now
  function logMerged(message) { log(message); }
  function openDoor(x, y) { setTile(x, y, T.DOOR_OPEN); logMerged('You push the door open.'); Sound.play('door'); }
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
  function tryUnlock(x, y) {
    const L = lvl(), p = P();
    const color = L.locks[key(x, y)] || 'brass';
    const k = p.inv.find(it => it.t === 'key' && it.color === color);
    if (!k) {
      // a strong character can force a locked door, slowly and loudly
      const chance = 0.08 + mod(p.stats.str) * 0.05 + (p.cls === 'fighter' ? 0.1 : 0);
      if (Math.random() < Math.max(0.05, chance)) {
        setTile(x, y, T.DOOR_OPEN);
        delete L.locks[key(x, y)];
        log('You throw your shoulder against the door and it bursts open!', 'good');
        Sound.play('door');
        for (const m of L.monsters) if (Math.abs(m.x - x) + Math.abs(m.y - y) < 10) m.awake = true;
        return true;
      }
      log(`The door is locked. It needs a ${color} key. You fail to force it.`, 'bad');
      Sound.play('locked');
      p.nextAttack = G.t + 700; // forcing it costs you a moment
      return false;
    }
    removeOne(k);
    delete L.locks[key(x, y)];
    setTile(x, y, T.DOOR_OPEN);
    log(`You unlock the door with the ${color} key.`, 'good');
    Sound.play('door');
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
  const VENOM_DC = { bite: 7, needle: 10, draught: 11 };
  // A trick that lands can still be weathered: a save halves what it does
  // (stone or web for half as long, half a storm's fire) or, for a charge,
  // keeps the hero on their feet. The trick's own answer (step aside, turn
  // away) still escapes it whole: the save is for when that fails. All grow
  // harder with depth, as venom does.
  const SAVE_DC = { claw: 10, grip: 10, drain: 4, drink: 8, gaze: 11, web: 11, charge: 12, nova: 11, spot: 18, breath: 11 };
  const saveDC = kind => SAVE_DC[kind] + Math.ceil(G.depth / 2);
  /** A saving throw against a monster's trick. */
  // a Ring of Evasion counts toward every save: the tricks, venom and traps
  const trickSave = (stat, kind, bonus = 0) => statCheck(stat, saveDC(kind), bonus + jewelBonus('evasion') + blessedSaves());
  function venomSave(kind, whose, quiet = false) {
    const p = P();
    if (p.poison || hasPower('pure')) return null;
    const c = statCheck('con', VENOM_DC[kind] + Math.ceil(G.depth / 2), jewelBonus('evasion') + blessedSaves());
    if (!c.pass) p.poison = poisonFor();
    if (!quiet) log(c.pass ? `You shake off ${whose} venom.${c.note}` : `${cap(whose)} venom takes hold: you are poisoned!${c.note}`, c.pass ? 'good' : 'bad');
    return c;
  }
  /** Which picture a trap going off gets. */
  const trapKindOf = tr => Object.keys(TRAP_TYPES).find(id => TRAP_TYPES[id] === tr) || '';
  function triggerTrap(k) {
    const L = lvl(), p = P();
    const tr = TRAP_TYPES[L.traps[k]];
    delete L.traps[k];
    // a Wisdom check to notice the loose flagstone, whatever the hero's trade;
    // a thief knows what to look for (more with each level), and so do the
    // tombwise. No eye for it, no lucky twenty: it is noticed or not
    const eye = (p.cls === 'thief' ? 8 + Math.floor(p.level / 2) : 0) + (p.bg === 'tombwise' ? 7 : 0) + jewelBonus('seer') + tricksterTraps();
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
    const dodge = tr.dmg ? statCheck('dex', TRAP_DC + Math.ceil(G.depth / 2), jewelBonus('evasion') + blessedSaves() + tricksterTraps()) : null;
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
    if (ahead) return ahead.kind === 'encounter' ? openEncounter(ahead) : openShop(ahead);
    if (monsterAt(tx, ty)) return attack();
    if (companion.at(tx, ty)) return companion.toggle();
    if (propAt(tx, ty)) return attack();   // a barrel, crate or urn ahead: break it
    if (t === T.WALL || t === T.TORCH) { log('You search the wall but find nothing.' + stairHint()); return; }
    if (t === T.DOOR_OPEN) {
      if (monsterAt(tx, ty) || (lvl().items[key(tx, ty)] || []).length) { log('Something is in the doorway.'); return; }
      setTile(tx, ty, T.DOOR); log('You pull the door shut.'); Sound.play('door'); return;
    }
    if ((lvl().items[key(tx, ty)] || []).length) { logMerged('Step forward onto it to pick it up.'); return; }
    if (beltFull()) { logMerged(`Your belt holds ${BELT} of each draught. Drink one to make room, or leave these.`); return; }
    logMerged('There is nothing to use here.');
  }

  // ---------- trading ---------- see trader.js ----------
  // ---------- encounters ----------
  // A choice the dungeon puts to you (see encounters.js). While one is open
  // the game waits, as it does for the trader, and the prop that started it
  // is gone once it has been answered.
  let encounter = null;
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
  function openEncounter(n) {
    const def = ENCOUNTERS[n.id];
    if (!def) return false;
    encounter = { npc: n, def, result: null };
    Sound.play('door');
    emit('encounter');
    return true;
  }
  function knack(check) {
    const p = P();
    let n = 0;
    for (const [c, bg, v] of (check.knack || [])) if ((c && p.cls === c) || (bg && p.bg === bg)) n += v;
    return n;
  }
  function costOf(choice) {
    const c = choice.cost;
    if (!c) return null;
    if (c.goldPerDepth) return { gold: c.goldPerDepth * G.depth, text: `${c.goldPerDepth * G.depth} gold` };
    if (c.hurtFrac) { const n = Math.ceil(P().maxHp * c.hurtFrac); return { hp: n, text: `${n} hit points` }; }
    if (c.food) return { food: c.food, text: `${c.food} nourishment` };
    return null;
  }
  /** What each choice will ask of you, and how likely it is to go well. */
  function encounterOptions() {
    if (!encounter) return [];
    const p = P();
    return encounter.def.choices.map((ch, i) => {
      const cost = costOf(ch);
      let blocked = null;
      if (cost && cost.gold && p.gold < cost.gold) blocked = `You need ${cost.gold} gold.`;
      if (cost && cost.hp && p.hp <= cost.hp) blocked = 'You are too weak to spare the blood.';
      // (and not the last of it: sharing it all left the hero starving)
      if (cost && cost.food && p.food <= cost.food) blocked = 'You have too little food to share.';
      const o = { i, label: ch.label, cost: cost ? cost.text : null, blocked };
      if (ch.check) {
        const dc = encounterDc(ch.check, G.depth), bonus = knack(ch.check);
        Object.assign(o, { stat: ch.check.stat, statName: STAT_WORD[ch.check.stat], dc, bonus: checkBonus(ch.check.stat, bonus),
          chance: checkChance(ch.check.stat, dc, bonus), knack: bonus });
      }
      return o;
    });
  }
  function chooseEncounter(i) {
    if (!encounter || encounter.result) return null;
    const { def, npc } = encounter, p = P(), L = lvl();
    const ch = def.choices[i];
    if (!ch) return null;
    const opt = encounterOptions()[i];
    if (opt.blocked) { log(opt.blocked, 'bad'); return null; }
    const cost = costOf(ch);
    const lines = [];
    if (cost && cost.gold) { p.gold -= cost.gold; lines.push(`−${cost.gold} gold`); }
    if (cost && cost.hp) { p.hp -= cost.hp; fx.damageUntil = realNow + 260; lines.push(`−${cost.hp} hit points`); }
    if (cost && cost.food) { p.food -= cost.food; lines.push(`−${cost.food} nourishment`); }
    let c = null, outcome = ch.outcome;
    if (ch.check) {
      c = statCheck(ch.check.stat, encounterDc(ch.check, G.depth), knack(ch.check));
      outcome = c.pass ? ch.pass : ch.fail;
    }
    // answered: the prop goes, and this encounter will not come again
    L.npcs = (L.npcs || []).filter(n => n !== npc);
    (G.metEncounters = G.metEncounters || []).push(npc.id);
    log(`${def.title}: ${outcome.text}${c ? c.note : ''}`, c ? (c.pass ? 'good' : 'bad') : 'info');
    lines.push(...applyEffects(outcome.effects, def));
    encounter.result = { label: ch.label, text: outcome.text, check: c, lines };
    checkLevelUp();
    emit('encounter'); emit('inv'); emit('stats');
    return encounter.result;
  }
  function closeEncounter() { encounter = null; }
  // Carry out what an outcome says, and say back what happened, line by line.
  function applyEffects(effects, def) {
    const p = P(), L = lvl(), out = [];
    // named after it is taken, so gold says what the purse really gained (a trickster's is a quarter more)
    const pickUp = it => { (L.items[key(p.x, p.y)] = L.items[key(p.x, p.y)] || []).push(it); pickupAll(); return itemName(it); };
    for (const e of effects) {
      if (e.map) { L.explored.fill(1); out.push('You know the layout of this floor.'); }
      if (e.xp) { p.xp += e.xp; out.push(`+${e.xp} experience`); }
      if (e.companion) { const said = companion.join(); if (said) out.push(said); }
      if (e.thread && !threads()[e.thread]) {
        threads()[e.thread] = G.depth;
        if (THREAD_SAID[e.thread]) out.push(THREAD_SAID[e.thread]);
        // a bargain struck after the last floor was already seen still comes due there
        if (e.thread === 'bargain') for (const lv of Object.values(G.levels)) if (lv.isFinal) for (const m of lv.monsters) if (MONSTERS[m.id].boss) { m.maxHp = Math.round(m.maxHp * 1.3); m.hp = Math.round(m.hp * 1.3); }
      }
      if (e.goldPerDepth) {
        const n = e.goldPerDepth * G.depth;
        // gold an encounter gives is gold found: a trickster's is a quarter more, as any is
        if (n > 0) { const got = tricksterPurse(n); p.gold += got; out.push(`+${got} gold`); }
        else { const took = Math.min(p.gold, -n); p.gold -= took; if (took) out.push(`−${took} gold`); }
      }
      if (e.hurt || e.hurtFrac) {
        const n = e.hurtFrac ? Math.max(1, Math.ceil(p.maxHp * e.hurtFrac)) : Math.max(1, d(...e.hurt));
        G.lastAttacker = { name: def.title, dmg: n, bearing: '', encounter: true };
        out.push(`−${n} hit points`);
        hurtPlayer(n, null);
      }
      if (e.heal) { const n = e.heal === 'full' ? p.maxHp - p.hp : e.heal; healPlayer(n); out.push(e.heal === 'full' ? 'Fully healed' : `+${n} hit points`); }
      if (e.maxHp) {
        const was = p.maxHp;
        p.maxHp = Math.max(10, p.maxHp + e.maxHp);
        p.hp = Math.min(p.maxHp, p.hp + Math.max(0, e.maxHp));
        // said as it came out: a loss that stops at the floor of ten is not the whole loss
        const got = p.maxHp - was;
        if (got) out.push(`${got > 0 ? '+' : '−'}${Math.abs(got)} maximum hit points`);
      }
      if (e.food) { p.food = Math.max(0, Math.min(100, p.food + e.food)); out.push(`${e.food > 0 ? '+' : '−'}${Math.abs(e.food)} nourishment`); }
      if (e.loot != null) out.push(`Found: ${pickUp(Dungeon.rollLoot(Dice, G.depth + e.loot))}`);
      if (e.item) out.push(`Found: ${pickUp({ t: e.item.t, q: e.item.q || 1, e: 0 })}`);
      if (e.buff) {
        for (const [stat, n] of e.buff.stats) p.effects['boon_' + stat] = { amount: n, until: G.t + e.buff.dur };
        out.push(`Blessed: ${e.buff.stats.map(([s, n]) => `+${n} ${s === 'hit' ? 'to hit' : s === 'ac' ? 'armour' : s}`).join(', ')} for ${Math.round(e.buff.dur / 60000)} minutes`);
      }
      if (e.poison) { const c = venomSave('draught', 'the', true); if (c) out.push(c.pass ? `Poison fought off${c.note}` : `Poisoned${c.note}`); }
      if (e.cure && p.poison) { p.poison = null; out.push('Poison cured'); }
      if (e.wake) { for (const m of L.monsters) m.awake = true; out.push('Everything on this floor is awake'); }
      if (e.identifyAll) { for (const id in ITEMS) G.known[id] = 1; revealAll(); out.push('Every potion, scroll and piece of gear identified'); }
      if (e.uncurse && breakCurses()) out.push('Curse broken');
      // (a caster's spell points follow the score at once, not only at the next load)
      if (e.stat) { p.stats[e.stat[0]] += e.stat[1]; refreshSp(p); out.push(`${e.stat[1] > 0 ? '+' : '−'}${Math.abs(e.stat[1])} ${STAT_WORD[e.stat[0]]}`); }
      if (e.ambush) {
        let placed = 0;
        for (let r = 2; r <= 4 && placed < e.ambush.n; r++) {
          for (let dy = -r; dy <= r && placed < e.ambush.n; dy++) for (let dx = -r; dx <= r && placed < e.ambush.n; dx++) {
            if (Math.abs(dx) + Math.abs(dy) !== r) continue;
            const x = p.x + dx, y = p.y + dy;
            if (!passable(x, y) || monsterAt(x, y) || npcAt(x, y) || companion.at(x, y)) continue;
            const b = MONSTERS[e.ambush.id];
            // as sturdy as the rest of the floor: the difficulty and the deep's pressure apply
            newMonster(e.ambush.id, x, y, Dice.dice(b.hp[0], b.hp[1], b.hp[2])).nextAct = G.t + 800;
            placed++;
          }
        }
        if (placed) { distFieldAt = -1e9; out.push(`${placed > 1 ? placed + ' ' : 'A '}${MONSTERS[e.ambush.id].name.toLowerCase()}${placed > 1 ? 's' : ''} attack${placed > 1 ? '' : 's'}!`); }
      }
    }
    return out;
  }

  /** What in the pack this hero's class can never use: the trader takes it all in one go. */
  const junkInPack = () => P().inv.filter(it => uselessToClass(it));

  // ---------- what a blow leaves behind ----------
  // Each kind of monster bleeds its own colour: red, the green of a troll or
  // a slime, the dust of old bones, the cold light a wraith is made of. A
  // blow throws a spray away from the hero, a heavy blow or a kill leaves a
  // stain on the floor, and a blow turned aside strikes sparks.
  const GORE = {
    blood: { c: ['#8a0e12', '#b8161c', '#5a0608'], g: 6, stain: true },
    goo: { c: ['#4a9a2e', '#7ed052', '#2a5a1a'], g: 5, stain: true },
    ichor: { c: ['#8aa01a', '#c0d040', '#4e5e0e'], g: 6, stain: true },
    rot: { c: ['#4a2a1a', '#6e3e24', '#2a1a10'], g: 6, stain: true },
    troll: { c: ['#2e5a22', '#4e7e34', '#1a3610'], g: 6, stain: true },
    bone: { c: ['#e8e0cc', '#b8ae98', '#8a8070'], g: 7, stain: false },
    ecto: { c: ['#a8d8ff', '#e0f4ff', '#6aa0d8'], g: -0.5, stain: false, glow: true },
    spark: { c: ['#fff4c0', '#ffd060', '#ff9030'], g: 2.5, stain: false, glow: true },
    bile: { c: ['#3e4832', '#5c6848', '#262c1e'], g: 6, stain: true },
    rust: { c: ['#8a4a1e', '#b86a2e', '#5a2c12'], g: 6, stain: true },
  };
  const GORE_OF = { slime: 'goo', spider: 'ichor', skeleton: 'bone', zombie: 'rot', ghoul: 'rot', wraith: 'ecto', troll: 'troll', lich: 'bone',
    basilisk: 'bile', rustmaw: 'rust', shade: 'ecto' };
  // a named champion bleeds as its kind does
  for (const id in MONSTERS) if (MONSTERS[id].named && GORE_OF[MONSTERS[id].named.kin]) GORE_OF[id] = GORE_OF[MONSTERS[id].named.kin];
  const STAINS_PER_FLOOR = 60, BITS_MAX = 160;
  // What is only for the eye draws on its own numbers, never the dice's:
  // a spray of blood must not change what the next blow rolls.
  let lookSeed = 0x2f6b1d3;
  const look = () => {
    lookSeed = (lookSeed + 0x6D2B79F5) | 0;
    let t = Math.imul(lookSeed ^ (lookSeed >>> 15), 1 | lookSeed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  /**
   * Throw a spray from a monster, away from the hero.
   * @param {import('./types.js').Monster} m
   * @param {string} kind  a GORE key, or null for what this monster bleeds
   * @param {number} amount  0 to 1: how hard the blow was, against its whole life
   * @param {boolean} [pool]  leave a stain on the floor too
   */
  function spray(m, kind, amount, pool) {
    const g = GORE[kind || GORE_OF[m.id] || 'blood'];
    const p = P(), mb = MONSTERS[m.id];
    const cx = (m.rx == null ? m.x : m.rx) + 0.5, cy = (m.ry == null ? m.y : m.ry) + 0.5;
    const ax = cx - (p.x + 0.5), ay = cy - (p.y + 0.5), len = Math.hypot(ax, ay) || 1, ux = ax / len, uy = ay / len;
    const z0 = (mb.fly || 0) + mb.scale * 0.55;
    const n = Math.round(5 + Math.min(1, amount) * 16);
    for (let i = 0; i < n; i++) {
      const sp = 0.6 + look() * 1.6, side = (look() * 2 - 1) * 1.1;
      fx.bits.push({
        x: cx - ux * 0.3, y: cy - uy * 0.3, z: z0 + (look() - 0.5) * 0.2,
        vx: ux * sp - uy * side, vy: uy * sp + ux * side, vz: 0.6 + look() * 1.8,
        g: g.g, c: g.c[i % g.c.length], born: realNow + fxDelay, life: 380 + look() * 360,
        size: look() < 0.3 ? 0.024 : 0.015, glow: g.glow,
      });
    }
    if (fx.bits.length > BITS_MAX) fx.bits.splice(0, fx.bits.length - BITS_MAX);
    if (pool && g.stain) {
      const list = fx.stains[G.depth] || (fx.stains[G.depth] = []);
      // it lands a little beyond the monster, on the side away from the blow
      list.push({ x: cx + ux * (0.1 + look() * 0.25) + (look() - 0.5) * 0.3, y: cy + uy * (0.1 + look() * 0.25) + (look() - 0.5) * 0.3,
        r: 0.06 + Math.min(1, amount) * 0.1, c: g.c[2], seed: look() * 1000, at: realNow + fxDelay });
      if (list.length > STAINS_PER_FLOOR) list.shift();
    }
  }
  // Barrels, crates and urns (see dressing.js) break to a blow. What each
  // holds is its own, dealt from the seed and where it stands, so breaking
  // it after a reload finds the same: a little gold, a meal now and then, a
  // draught very rarely, most often nothing at all.
  const SMASHABLE = ['barrel', 'crate', 'urn'];
  const SMASH_WORDS = { barrel: 'The barrel\'s staves give way', crate: 'The crate splinters apart', urn: 'The urn shatters' };
  const KICK_WORDS = { barrel: 'You kick the barrel over and its staves give way', crate: 'You kick the crate over and it splinters', urn: 'You knock the urn over and it shatters' };
  /** A barrel, crate or urn on this square, if one stands there. */
  const propAt = (x, y) => (tile(x, y) === T.FLOOR && (lvl().dressing || []).find(q => q.x === x && q.y === y && SMASHABLE.includes(q.k))) || null;
  /** @param {import('./types.js').Level} L @param {import('./types.js').Dressing} d @param {boolean} [kicked] */
  function smash(L, d, kicked) {
    L.dressing.splice(L.dressing.indexOf(d), 1);
    const cx = d.x + 0.5 + d.ox, cy = d.y + 0.5 + d.oy;
    const cols = d.k === 'urn' ? ['#9a5a3a', '#6a3a24', '#c9a24a'] : ['#7a5230', '#4e3320', '#a8844e'];
    // a burst of staves or shards, big enough to see past the swing
    for (let i = 0; i < 28; i++) {
      fx.bits.push({ x: cx, y: cy, z: 0.1 + look() * 0.35, vx: (look() - 0.5) * 2.6, vy: (look() - 0.5) * 2.6, vz: 0.9 + look() * 1.8,
        g: 7, c: cols[i % cols.length], born: realNow + fxDelay, life: 480 + look() * 380, size: look() < 0.5 ? 0.045 : 0.025 });
    }
    // and what is left of it lies there a good while
    L.remains = (L.remains || []).filter(r => r.until > G.t).slice(-(REMAINS_MAX - 1));
    L.remains.push({ x: Math.round(cx * 100) / 100, y: Math.round(cy * 100) / 100, k: d.k === 'urn' ? 'remains_shards' : 'remains_staves', at: G.t - 1000, until: G.t + REMAINS_MS * 2 });
    if (realNow >= fx.shakeUntil) { fx.shakeAmp = 2; fx.shakeMs = 120; fx.shakeUntil = realNow + fxDelay + 120; }
    if (fx.bits.length > BITS_MAX) fx.bits.splice(0, fx.bits.length - BITS_MAX);
    Sound.play('blunt', heard(d));
    const rng = new Rng(`${G.seed}|smash|${G.depth}|${d.x},${d.y}`), r = rng.next();
    /** @type {import('./types.js').Item|null} */
    let found = null;
    if (r < 0.26) found = { t: 'gold', q: rng.int(3, 8) * G.depth + rng.int(0, 5) };
    else if (r < 0.36) found = { t: rng.chance(0.5) ? 'bread' : 'ration', q: 1 };
    else if (r < 0.4) found = { t: 'potion_heal', q: 1 };
    if (found) (L.items[key(d.x, d.y)] = L.items[key(d.x, d.y)] || []).push(found);
    if (found && found.t === 'gold') floatText({ rx: cx - 0.5, ry: cy - 0.5 }, `+${found.q}`, '#ffd24a');
    log(`${(kicked ? KICK_WORDS : SMASH_WORDS)[d.k]}${!found ? ': nothing inside.' : found.t === 'gold' ? `, and ${found.q} gold spills out.` : ', and something rolls out.'}`, found ? 'good' : '');
  }
  /** Sparks where a blow was turned aside. */
  function sparks(m) { spray(m, 'spark', 0.05, false); }

  // ---------- combat ----------
  function floatText(m, text, color) {
    // words over the same creature at nearly the same moment stack a line apart
    // ('weak!' over its number, an off-hand blow over the main one), not on top
    const x = m.rx + 0.5, y = m.ry + 0.5, born = realNow + fxDelay;
    const lift = fx.texts.filter(t => t.x === x && t.y === y && Math.abs(t.born - born) < 300).length;
    fx.texts.push({ x, y, text: String(text), color, born, until: born + 750, lift });
  }
  // A missile is seen to fly: a knife spun, a stone slung, an arrow loosed,
  // leaving the hand at its moment in the throw (a fraction of the swing) and
  // crossing a square in so many milliseconds. What it does is shown when it
  // arrives. Where it leaves from is a point on the view, as fractions.
  const MISSILE = {
    throwknife: { style: 'knife', release: 0.4, perSquare: 75, from: { x: 0.6, y: 0.74 }, color: '#dfe5ee' },
    // let go at the top of the second turn of an overhead whirl
    sling: { style: 'stone', release: 0.55, perSquare: 70, from: { x: 0.76, y: 0.17 }, color: '#9a948c' },
    shortbow: { style: 'arrow', release: 0.72, perSquare: 45, from: { x: 0.5, y: 0.66 }, color: '#b08858' },
    // the long bow's heavier draw sends its arrow a little quicker down the hall
    longbow: { style: 'arrow', release: 0.72, perSquare: 38, from: { x: 0.5, y: 0.66 }, color: '#a88050' },
  };
  function attack() {
    try { strike(); } finally { fxDelay = 0; }
  }
  function strike() {
    const p = P();
    if (G.t < p.nextAttack) return;
    if (p.held > G.t) { blocked(heldWhy()); return; }
    const w = weapon();
    const [dx, dy] = DIRS[p.dir];
    let m = monsterAt(p.x + dx, p.y + dy);
    let atRange = false;
    // a missile weapon reaches the first foe down the corridor
    if (!m && w.range) {
      for (let i = 2; i <= w.range; i++) {
        const x = p.x + dx * i, y = p.y + dy * i;
        if (!passable(x, y)) break;
        const t = monsterAt(x, y);
        if (t) { m = t; atRange = true; break; }
      }
    }
    p.nextAttack = G.t + w.speed;
    fx.swingUntil = realNow + 160;
    fx.swingAt = realNow; fx.swingMs = Math.max(200, Math.min(380, Math.round(w.speed * 0.55)));
    if (w.range) Sound.play('shoot', { w: p.eq.weapon.t });
    const mis = w.range && MISSILE[p.eq.weapon.t];
    if (mis) {
      const squares = m ? Math.max(1, Math.abs(m.x - p.x) + Math.abs(m.y - p.y)) : w.range;
      const release = Math.round(fx.swingMs * mis.release), flight = mis.perSquare * squares;
      spellFx(mis.style, mis.color, flight, m ? [m] : [], squares, release, mis.from);
      if (m) fxDelay = release + flight;
    }
    if (!m) {
      if (!w.range) Sound.play('swing', { w: p.eq.weapon && p.eq.weapon.t });
      // nothing to fight in front: a barrel, crate or urn there takes the blow
      const d = propAt(p.x + dx, p.y + dy);
      if (d) smash(lvl(), d);
      return;
    }
    const mb = mstat(m);
    const struckX = m.x, struckY = m.y;
    if (m.collapsed) { learn(m.id, 'answer'); damageMonster(m, 1, null, ' You scatter the bones for good.'); return; }
    // Shadow Step: a sidestep a moment ago puts the next blow in the shadows
    const stepped = !atRange && hasTalent('shadow_step') && G.t < (p.shadowUntil || 0);
    const sneak = p.cls === 'thief' && !atRange && (!m.awake || m.fleeing || stepped);
    if (stepped) p.shadowUntil = 0;
    // an arrow at a foe that has not yet seen who loosed it
    const unseen = atRange && !m.awake;
    const marked = unseen && hasTalent('hunters_mark');
    const sure = unseen && onPath('sharpshooter');   // a Sharpshooter's first arrow at it never misses
    m.awake = true;
    const roll = d(1, 20);
    // an answered trick's opening, taken in time, on the one that left it
    const open = !!(p.opening && p.opening.uid === m.uid && p.opening.until > G.t);
    if (open) p.opening = null;
    const crit = open || roll >= critFloor();
    // a riposte: the opening a missed blow left, taken
    const rip = !atRange && p.riposteUntil > G.t ? 4 : 0;
    if (rip) p.riposteUntil = 0;
    const note = rollNote(roll, toHit() + rip, mb.ac, crit);
    if (!open && !sure && (roll === 1 || (!crit && roll + toHit() + rip < mb.ac))) {
      log(`You miss the ${mb.name}.${note}`);
      { const o = heard(m); soon(() => Sound.play('glance', o)); }
      floatText(m, 'miss', '#e4e4ee');
      sparks(m);
      // a miss with one blade is no reason the other stays still
      offhandStrike(m, atRange, true);
      return;
    }
    // Thieves strike where it counts rather than swinging hard, so their bonus
    // comes from dexterity and does not scale with the weight of the weapon.
    const finesse = p.cls === 'thief' || p.cls === 'ranger';
    const flat = (finesse ? mod(p.stats.dex) : mod(armStat(p))) + skillDamage();
    // talents promise a number, so it is added whole, not scaled by the weapon's weight
    const knack = (hasTalent('weapon_master') ? (w.twoHanded ? 2 : 1) : 0) + (hasTalent('zeal') && effectFrom('hit', 'bless') ? 1 : 0)
      + berserkerRage() + templarBlow(m)   // a path's number, likewise
      + jewelBonus('might')                // and a Ring of Might's: on a dagger, scaled, it rounded away to nothing
      + (effect('might') ? 2 : 0);         // and a Potion of Might's, which says +2 and means it
    const baseSpeed = p.eq.weapon ? ITEMS[p.eq.weapon.t].speed : 450;
    let dmg = d(...w.dmg) + w.e + (w.px === 'heavy' ? 1 : 0) + Math.round(finesse ? flat : flat * (baseSpeed / 700)) + knack + (rip ? 2 : 0) + baneDamage(m, 'weapon') + dawnBlow(m) + bargained() + rangerAim(m, atRange) + wardenHold(m);
    if (crit) dmg *= 2;
    if (sneak) dmg *= sneakMult();
    if (marked) dmg *= 2;
    dmg = Math.max(1, dmg);
    if (p.cls === 'cleric') dmg = Math.round(dmg * deepMagic());
    dmg = Math.round(dmg * deepSteel());
    leech(Math.min(dmg, m.hp), 'weapon');   // only what it actually drew
    // Cleave: the swing carries on into the one behind the front. Who that is
    // is settled before the blow, since a killing blow brings them forward.
    const behind = !atRange && !w.range && hasTalent('cleave') && m.pack && m.pack.length ? m.pack[0] : null;
    const packBefore = packSize(m);
    // a crit that only Lucky made one says so
    const lucky = crit && hasTalent('lucky') && roll === critFloor();
    damageMonster(m, dmg, open ? 'opening' : crit ? (rip ? 'riposte-crit' : (lucky ? 'lucky' : 'crit')) : (sneak ? 'sneak' : (rip ? 'riposte' : null)), open ? '' : note);
    // a critical blow in close is felt: the view jolts a little, less than a blow taken
    if (crit && !atRange && realNow >= fx.shakeUntil) { fx.shakeAmp = Math.min(3.5, 1.5 + dmg / 12); fx.shakeMs = 140; fx.shakeUntil = realNow + fxDelay + 140; }
    const struckSurvived = lvl().monsters.includes(m) && packSize(m) === packBefore && !m.collapsed;
    // Volley: every third arrow that lands looses a second after it
    if (hasTalent('volley') && atRange && w.range) {
      p.volleyN = (p.volleyN || 0) + 1;
      if (p.volleyN % 3 === 0 && lvl().monsters.includes(m) && !m.collapsed) damageMonster(m, Math.max(1, Math.floor(dmg / 2)), 'volley');
    }
    if (behind && lvl().monsters.includes(m)) {
      const n = Math.max(1, Math.floor(dmg / 2));
      if (m.pack && m.pack.includes(behind)) {
        behind.hp -= n;
        if (behind.hp <= 0) { m.pack.splice(m.pack.indexOf(behind), 1); if (!m.pack.length) delete m.pack; memberDown(m); }
        else log(`Your swing carries into the ${mb.name} behind for ${n}.`);
      } else if (!m.collapsed) damageMonster(m, n, 'cleave');   // it has stepped up into the swing
    }
    // a flaming weapon burns what it strikes: no troll regrows the wound, and
    // Kindling keeps the fire going
    if (hasPower('flame', 'weapon') && struckSurvived) {
      if (mb.regen) { if (!(m.burnUntil > G.t)) log(`The ${mb.name}'s burns do not close.`, 'good'); m.burnUntil = G.t + 6000; }
      if (kindles()) setBurning(m);
    }
    // Venomed Blades: one hit in four poisons anything living, and only the one struck
    if (hasTalent('venom') && struckSurvived && !mb.undead && Math.random() < 0.25) {
      m.dot = { kind: 'venom', until: G.t + 4000, next: G.t + 1000 };
      log(`The ${mb.name} is poisoned.`, 'good');
    }
    // the second blade follows, hit or miss, but only if the foe is still where the first struck it:
    // a lich that has come apart into shadow is no longer there to hit
    if (G.status === 'playing' && m.hp > 0 && m.x === struckX && m.y === struckY && lvl().monsters.includes(m)) offhandStrike(m, atRange);
  }
  /**
   * The second blade follows the first. It swings wilder and carries none of
   * your strength behind it, so two light weapons beat one heavy one only
   * against the sort of thing that is easy to hit in the first place.
   */
  function offhandStrike(m, atRange, afterMiss = false) {
    const o = offhandWeapon();
    if (!o || atRange) return;
    const penalty = DUAL_HIT_PENALTY + (afterMiss ? OFF_BALANCE : 0);
    // the second blade comes in once the first cut has landed: a one-two, not both at once
    fx.offAt = realNow + Math.round((fx.swingMs || 300) * 0.4);
    const mb = mstat(m);
    const roll = d(1, 20);
    const hit = toHit() - penalty + (o.px === 'true' ? 1 : 0);
    const note = rollNote(roll, hit, mb.ac, false);
    if (roll === 1 || roll + hit < mb.ac) {
      log(`Your ${o.name.toLowerCase()} goes wide.${note}`);
      return;
    }
    // a Ring of Might, a Berserker's rage and Weapon Master's +1 promise every blow, and this is one
    const dmg = Math.max(1, Math.round((d(...o.dmg) + o.e + (o.px === 'heavy' ? 1 : 0) + jewelBonus('might') + berserkerRage() + (hasTalent('weapon_master') ? 1 : 0) + baneDamage(m, 'offhand') + bargained()) * deepSteel()));
    leech(Math.min(dmg, m.hp), 'offhand');
    damageMonster(m, dmg, 'offhand', note);
  }
  function damageMonster(m, dmg, tag, note) {
    // the lich, wrapped in shadow while its fight turns, cannot be hurt: each
    // act gets its moment instead of three going by in as many blows
    if (m.wardUntil > G.t && MONSTERS[m.id].boss) {
      // a mage knows how the shadow is woven: a spell pulls it apart instead
      if (castingName && castingName !== 'fireball' && P().cls === 'mage') {
        // it was waiting out its shadow; now it has a moment to gather itself
        m.wardUntil = G.t; m.nextAct = G.t + 400;
        Sound.stop('ward');
        floatText(m, 'unravelled', '#b090ff');
        spray(m, 'ecto', 0.8, false);
        // and drinks what the shadow was made of
        const p = P(), back = Math.min(p.maxSp - p.sp, Math.ceil(p.maxSp / 3));
        p.sp += back;
        log(`Your ${castingName} catches the shadow round the ${MONSTERS[m.id].name} and pulls it apart. It stands bare!${back ? ` You drink what it was made of (+${back} spell points).` : ''}`, 'good');
        Sound.play('riteBroken', heard(m));
        learn(m.id, 'answer');
        return;
      }
      floatText(m, 'shadow', '#b090ff');
      if (!m.wardSaid && tag !== 'companion') { m.wardSaid = true; log(`Your blow passes through the shadow wrapped round the ${MONSTERS[m.id].name}. Deal with its guards while it lasts${P().cls === 'mage' ? ', or unpick it with a spell' : ''}.`, 'bad'); }
      sparks(m);
      Sound.play('wardhit', heard(m));
      return;
    }
    noteDealt(m, dmg, tag);
    const mb = mstat(m);
    m.hp -= dmg;
    m.awake = true;
    const pending = realNow < (m.flashAt || 0);
    m.flashAt = realNow + fxDelay; m.flashUntil = m.flashAt + 130;
    // and its life bar keeps what it had until then
    if (fxDelay > 0) m.hpShown = pending && m.hpShown > 0 ? m.hpShown : m.hp + dmg;
    {
      // a spray scaled to the blow, and a stain when it was a heavy one or the last
      const hard = dmg / Math.max(1, m.maxHp);
      if (tag !== 'burning' && tag !== 'venom') spray(m, null, hard + (tag === 'crit' || tag === 'riposte-crit' || tag === 'opening' ? 0.4 : 0), hard >= 0.3 || m.hp <= 0);
    }
    floatText(m, dmg, tag === 'crit' || tag === 'riposte-crit' || tag === 'lucky' || tag === 'opening' ? '#ff4' : (tag === 'fire' || tag === 'burn' ? '#f84' : '#fff'));
    { const o = heard(m, { tag, gore: GORE_OF[m.id], w: tag === 'companion' ? 'fists' : tag === 'offhand' ? P().eq.offhand.t : P().eq.weapon ? P().eq.weapon.t : 'fists' }); soon(() => Sound.play('hit', o)); }
    buzz(12);
    if (m.hp <= 0) {
      // in a group the front one falls and the next steps up; the square
      // empties only when the last of them is down
      if (m.pack && m.pack.length) { m.dot = null; memberDown(m, note); promote(m); return; }
      // a skeleton cut down by an edge falls apart and pulls itself back
      // together; crushed bones, and bones struck by magic, stay down
      const crushed = mb.move === 'rise' && !m.risen && !m.collapsed && breaksBones(tag) && !(m.pack && m.pack.length);
      if (mb.move === 'rise' && !m.risen && !m.collapsed && !breaksBones(tag)) {
        m.risen = true; m.collapsed = G.t + RISE_MS; m.hp = 0;
        m.windup = null; m.volley = null; m.fleeing = false;
        log(`The ${mb.name} clatters into a heap of bones... and the bones begin to twitch. Smash them before it rises!`, 'bad');
        Sound.play('death', heard(m, { gore: 'bone', who: m.id }));
        meet(m, 'trick');
        return;
      }
      killMonster(m, note);
      if (crushed) learn(m.id, 'answer');    // told after its death, not before
      return;
    }
    meet(m);                               // still standing: met now, not before its death is told
    const of = packSize(m) > 1 ? ` (one of ${packSize(m)})` : '';
    if (tag === 'offhand') { log(`Your off hand finds the ${mb.name}${of} for ${dmg}.${note || ''}`); }
    else if (tag === 'thorns') { log(`Your barbs bite the ${mb.name} for ${dmg}.`); }
    else if (tag === 'companion') { log(`${G.companion ? G.companion.name : 'Your hound'} bites the ${mb.name}${of} for ${dmg}.`); }
    else if (tag === 'burning') { log(`The ${mb.name} burns for ${dmg}.`); }
    else if (tag === 'cleave') { log(`Your swing carries into the next ${mb.name} as it steps up, for ${dmg}.`); }
    else if (tag === 'venom') { log(`The poison eats at the ${mb.name} for ${dmg}.`); }
    else if (tag === 'volley') { log(`A second arrow follows the first into the ${mb.name}, for ${dmg}.`); }
    else if (tag === 'snare') { log(`The cord bites the ${mb.name} for ${dmg}.`); }
    else {
      const pre = { crit: 'A mighty blow! ', opening: 'You take the opening! ', lucky: 'A lucky blow! ', 'riposte-crit': 'Riposte! A mighty blow! ', sneak: 'You strike from the shadows! ', riposte: 'Riposte! ' }[tag] || '';
      log(castingName ? `Your ${castingName} hits the ${mb.name}${of} for ${dmg}.` : `${pre}You hit the ${mb.name}${of} for ${dmg}.${note || ''}`);
    }
    moveOnHurt(m, mb, tag);
    // Kindling, or a Pyromancer: the hero's fire keeps burning
    if (tag === 'burn' && kindles()) setBurning(m);
    // wounded, non-boss monsters may break and run
    if (!mb.boss && !mb.named && !(m.pack && m.pack.length) && m.hp <= m.maxHp * 0.25 && !m.fleeing && Math.random() < 0.3) {
      m.fleeing = true;
      m.windup = null; m.volley = null;
      log(`The ${mb.name} turns to flee!`, 'good');
    }
  }
  function killMonster(m, note) {
    const L = lvl(), mb = mstat(m);
    const at = L.monsters.indexOf(m);
    if (at < 0) return;                    // already removed by something else
    L.monsters.splice(at, 1);
    if (mb.boss) G.bossDown = true;
    memberDown(m, note);
    if (mb.boss) { bossFalls(m); log('The dread presence lifts. The Heart of the Mountain is unguarded.', 'good'); }
    if (mb.named) namedFalls(m, mb);
    if (m.shade) shadeFalls(m);
  }

  // ---------- groups ----------
  // Pack creatures can share a square: one monster that carries the others
  // (m.pack, each {hp, maxHp}). They move as one, the front one takes your
  // blows, each of them swings, and a blast that fills the square hits all.
  const packSize = m => 1 + (m.pack ? m.pack.length : 0);
  // what a wyrm's scales and a quillback's quills are made into, and how often one is whole enough (Skarrow always)
  const TROPHIES = { wyrm: ['wyrmscale', 0.25], skarrow: ['wyrmscale', 1], quillback: ['quillshield', 0.2] };
  /** One of them falls: the reward, the log line and the chance of loot. */
  function memberDown(m, note) {
    const L = lvl(), p = P(), mb = mstat(m);
    fallen(m);
    { const o = heard(m, { gore: GORE_OF[m.id] || 'blood', who: m.id }); soon(() => Sound.play('death', o)); }
    p.kills++;
    noteKill(m);
    // the two halves of a split slime are worth one slime between them
    const xp = m.split ? Math.ceil(mb.xp / 2) : mb.xp;
    p.xp += xp;
    // a mage draws back a little of the power their spell has unmade: fire in
    // the deep floors, where a mage's points ran dry before the fighting did
    // (a spell, cast: the fire scroll's blast names itself 'fireball' but is no spell)
    // (twice as much on Hard and in the Long Delve, where the mage trailed the rest)
    const drawn = castingName && castingName !== 'fireball' && p.cls === 'mage' && p.sp < p.maxSp ? Math.min(p.maxSp - p.sp, mageDraw()) : 0;
    p.sp += drawn;
    // the dead are destroyed; the living are slain
    const reward = `${note || ''} (+${xp} xp${drawn ? `, +${drawn} spell point${drawn > 1 ? 's' : ''}` : ''})`;
    // a champion's fall is its own line, said once, with what it was worth
    if (mb.named) log(`${mb.named.fall}${reward}`, 'good');
    else if (m.shade) log(`${heroTitle(m.shade.name, m.shade.cls)} is laid to rest at last, and the cold goes out of the air. What they wore is yours to take.${reward}`, 'good');
    else log(`The ${mb.name} is ${mb.undead || m.id === 'slime' || mb.boss ? 'destroyed' : 'slain'}!${reward}`, 'good');
    meet(m, 'kill');
    // champions and bosses always drop something worthwhile
    // (a shade leaves only what its hero wore)
    if (!m.shade && (Math.random() < (m.split ? 0.2 : 0.4) * (hasTalent('light_fingers') ? 1.5 : 1) || mb.boss || m.elite)) {
      const k = key(m.x, m.y);
      const loot = Dungeon.rollLoot(Dice, G.depth + (m.elite ? 2 : 0));
      (L.items[k] = L.items[k] || []).push(loot);
    }
    // and the deep's own beasts leave something of themselves now and then
    const trophy = TROPHIES[m.id];
    if (trophy && Math.random() < trophy[1]) {
      const k = key(m.x, m.y);
      (L.items[k] = L.items[k] || []).push({ t: trophy[0], q: 1, e: 0 });
      log(`Something of the ${mb.name} is worth taking: a ${ITEMS[trophy[0]].name}.`, 'good');
    }
    checkLevelUp();
    emit('stats');
  }
  /** A body sinking and fading where it fell, knocked back from the hero. */
  function fallen(m) {
    const p = P(), base = MONSTERS[m.id];
    const rx = m.rx == null ? m.x : m.rx, ry = m.ry == null ? m.y : m.ry;
    const vx = rx - p.x, vy = ry - p.y, len = Math.hypot(vx, vy) || 1;
    fx.corpses.push({ x: rx + 0.5, y: ry + 0.5, sprite: m.collapsed ? 'bone_heap' : base.sprite, elite: m.elite || (base.named ? m.id : undefined), scale: base.scale * (packSize(m) > 1 ? 0.88 : 1) * (m.collapsed ? 0.95 : 1),
      born: realNow + fxDelay, dx: vx / len, dy: vy / len, fly: base.fly || 0 });
    // once the body has sunk away something stays a while: bones from the dead
    // and the bony, a husk from the rest; a wraith, a slime or the lich leave nothing
    if (!['wraith', 'slime', 'lich', 'shade'].includes(base.sprite)) {
      const L = lvl(), k = base.undead || base.sprite === 'skeleton' || base.sprite === 'bat' ? 'remains_bones' : 'remains_husk';
      L.remains = (L.remains || []).filter(r => r.until > G.t).slice(-(REMAINS_MAX - 1));
      L.remains.push({ x: Math.round((rx + 0.5) * 100) / 100, y: Math.round((ry + 0.5) * 100) / 100, k, at: G.t, until: G.t + REMAINS_MS });
    }
  }
  // how long the fallen's remains lie (game time), and how many a floor keeps at once
  const REMAINS_MS = 240000, REMAINS_MAX = 16;
  /** Let go of remains that have had their time, so a floor left behind does not carry them in the save. @param {import('./types.js').Level} L */
  function pruneRemains(L) {
    if (!L.remains) return;
    L.remains = L.remains.filter(r => r.until > G.t);
    if (!L.remains.length) delete L.remains;
  }
  /** The next of the group steps into the front. */
  function promote(m) {
    const next = m.pack.shift();
    m.hp = next.hp; m.maxHp = next.maxHp;
    // a fireball still in the air: the one stepping up shows its own life, not the fallen one's
    if (m.hpShown > 0) m.hpShown = next.hp;
    if (!m.pack.length) delete m.pack;
    const left = packSize(m);
    log(left > 1 ? `Another ${mstat(m).name} steps up. ${left} are left.` : `The last ${mstat(m).name} steps up.`, 'bad');
  }
  /** A blast that fills the square: the ones behind take it too. */
  function hitGroup(m, dmg, tag) {
    if (m.pack && m.split) learn(m.id, 'answer');     // a blast that takes both halves of a split slime
    if (m.pack) {
      for (const b of m.pack.slice()) {
        noteDealt(m, dmg, tag, b.hp);
        b.hp -= dmg;
        if (b.hp <= 0) { m.pack.splice(m.pack.indexOf(b), 1); memberDown(m); }
      }
      if (!m.pack.length) delete m.pack;
    }
    damageMonster(m, dmg, tag);
  }
  function checkLevelUp() {
    const p = P();
    while (p.level < MAX_LEVEL && p.xp >= XP_TABLE[p.level]) {
      p.level++;
      const gain = Math.max(1, d(1, cls().hitDie) + mod(p.stats.con));
      p.maxHp += gain; p.hp += gain;
      p.maxSp = spMax(p); p.sp = p.maxSp;
      log(`You have reached level ${p.level}! (+${gain} hit points)`, 'good');
      Sound.play('levelup');
      const unlocked = knownSpells().filter(s => spellLevel(s) === p.level);
      for (const s of unlocked) log(`You have learned ${s.name}.`, 'good');
      G.levelNotes = G.levelNotes || {};
      G.levelNotes[p.level] = { hp: gain, spells: unlocked.map(s => s.name) };
      // a small lesson at every odd level, and at every even one a talent of
      // the hero's class; at PATH_LEVEL the path instead of the lesson. A hero
      // past it without one (a save from before paths) is offered it as well
      const path = p.level >= PATH_LEVEL && offerPath();
      if (path && p.level === PATH_LEVEL) continue;
      if (p.level % 2 === 0) offerTalents(); else offerBoons();
    }
  }
  /** The lessons a hero can still be offered. */
  function boonPool() {
    const p = P();
    const taken = p.boons || [];
    // a stat lesson twice at most: stacking one every level was the whole of a build
    const times = id => taken.filter(t => t === id).length;
    return BOONS.filter(b => (!b.when || b.when(p)) && !(b.unique && taken.includes(b.id)) && !(b.max && times(b.id) >= b.max));
  }
  /** The class talents a hero can still be offered. */
  function talentPool() {
    const p = P();
    // a talent for a spell not yet learned would sit useless for levels: it waits
    const knows = id => knownSpells().some(s => s.id === id && spellAvailable(s));
    return (TALENTS[p.cls] || []).filter(t => !(p.talents || []).includes(t.id) && (!t.needs || knows(t.needs)));
  }
  /**
   * Offers wait in a queue when several levels come at once, and each was
   * drawn before the others were chosen: without a second look, the talent
   * taken from the first could be offered again by the next. After every
   * choice the waiting offers are drawn over from what is still to be had.
   */
  function redrawOffers() {
    const rest = G.pendingBoons || [];
    for (let i = 0; i < rest.length; i++) {
      if (isPathOffer(rest[i])) continue;      // the two paths stand as they are
      const talentOffer = rest[i].some(id => (TALENTS[P().cls] || []).some(t => t.id === id));
      const pool = (talentOffer ? talentPool() : boonPool()).map(b => b.id);
      const keep = rest[i].filter(id => pool.includes(id));
      const more = Dice.shuffle(pool.filter(id => !keep.includes(id))).slice(0, Math.max(0, 3 - keep.length));
      rest[i] = keep.concat(more);
      // every talent taken: the offer becomes a lesson
      if (!rest[i].length && talentOffer) rest[i] = Dice.shuffle(boonPool().map(b => b.id)).slice(0, 3);
    }
  }
  // Three things experience could have taught you. You keep one.
  function offerBoons() {
    const p = P();
    // with the lich down the run is all but over: a choice would only stand
    // between the hero and the Heart. The levels still come, and their hit points
    if (G.bossDown) return;
    const picked = Dice.shuffle(boonPool().slice()).slice(0, 3).map(b => b.id);
    G.pendingBoons = (G.pendingBoons || []).concat([picked]);
    G.pendingLevels = (G.pendingLevels || []).concat(p.level);
    emit('boons');
  }
  /** Three of the class's talents not yet taken; a lesson instead once all are. */
  function offerTalents() {
    const p = P();
    if (G.bossDown) return;
    const pool = talentPool();
    if (!pool.length) { offerBoons(); return; }
    G.pendingBoons = (G.pendingBoons || []).concat([Dice.shuffle(pool.slice()).slice(0, 3).map(t => t.id)]);
    G.pendingLevels = (G.pendingLevels || []).concat(p.level);
    emit('boons');
  }
  /** An offer of the class's two paths, rather than lessons or talents. */
  function isPathOffer(offer) { return !!offer && offer.some(id => (PATHS[P().cls] || []).some(x => x.id === id)); }
  /** The class's two paths, once, if the hero has none and is not already being offered them. */
  function offerPath() {
    const p = P(), paths = PATHS[p.cls] || [];
    if (G.bossDown || p.path || !paths.length || (G.pendingBoons || []).some(isPathOffer)) return false;
    G.pendingBoons = (G.pendingBoons || []).concat([paths.map(x => x.id)]);
    G.pendingLevels = (G.pendingLevels || []).concat(p.level);
    emit('boons');
    return true;
  }
  /** The level the offer now showing was earned at. */
  function pendingLevel() { return G.pendingLevels && G.pendingLevels.length ? G.pendingLevels[0] : P().level; }
  /** What a level brought besides the choice: hit points, and any spell learned. */
  function levelNote(level) { return (G.levelNotes && G.levelNotes[level]) || null; }
  function pendingBoons() { return G.pendingBoons && G.pendingBoons.length ? G.pendingBoons[0] : null; }
  /** @param {string[]} [picks]  for Self-Taught, the scores its points go to */
  function chooseBoon(id, picks) {
    const offer = pendingBoons();
    if (!offer || !offer.includes(id)) return false;
    const p = P();
    const path = (PATHS[p.cls] || []).find(x => x.id === id);
    if (path) {
      // for good: nothing offers it again, and nothing takes it back
      p.path = id;
      const was = p.maxSp;
      refreshSp(p);
      p.sp += p.maxSp - was;                 // a Healer's deeper well is there at once, and full
      G.pendingBoons.shift(); if (G.pendingLevels) G.pendingLevels.shift();
      redrawOffers();
      log(`You walk the path of the ${path.name}. ${path.effects.join(' ')}`, 'good');
      Sound.play('levelup');
      emit('stats');
      if (!pendingBoons()) emit('boonsDone');
      return true;
    }
    const talent = (TALENTS[p.cls] || []).find(t => t.id === id);
    if (talent) {
      p.talents = (p.talents || []).concat(id);
      G.pendingBoons.shift(); if (G.pendingLevels) G.pendingLevels.shift();
      redrawOffers();
      log(`Talent: ${talent.name}. ${talent.desc}`, 'good');
      Sound.play('levelup');
      emit('stats');
      if (!pendingBoons()) emit('boonsDone');
      return true;
    }
    const boon = BOONS.find(b => b.id === id);
    if (!boon) return false;
    let told = boon.desc;
    if (boon.spread) {
      // the points go where the player puts them, and nowhere until they do
      if (!Array.isArray(picks) || picks.length !== boon.spread || !picks.every(k => Object.prototype.hasOwnProperty.call(STAT_WORD, k))) return false;
      const counts = {};
      for (const k of picks) counts[k] = (counts[k] || 0) + 1;
      // two points to a score over the whole run, as a score's own lesson comes twice at most:
      // Self-Taught twice into one score was the stat lesson's cap walked round
      const taught = p.taught || (p.taught = {});
      if (Object.keys(counts).some(k => (taught[k] || 0) + counts[k] > SELF_TAUGHT_MOST)) return false;
      for (const k of picks) { p.stats[k]++; taught[k] = (taught[k] || 0) + 1; }
      told = Object.entries(counts).map(([k, n]) => `+${n} ${STAT_WORD[k]}`).join(', ') + '.';
    }
    boon.apply(p);
    p.maxSp = spMax(p);
    p.sp = Math.min(p.maxSp, p.sp);
    p.boons = (p.boons || []).concat(id);
    G.pendingBoons.shift(); if (G.pendingLevels) G.pendingLevels.shift();
    redrawOffers();
    log(`${boon.name}. ${told}`, 'good');
    Sound.play('levelup');
    emit('stats');
    if (!pendingBoons()) emit('boonsDone');
    return true;
  }
  /** Which way an attacker lies relative to the way the player is facing. */
  function relativeBearing(m) {
    const p = P();
    const dx = m.x - p.x, dy = m.y - p.y;
    let dir = -1;
    for (let k = 0; k < 4; k++) if (DIRS[k][0] === Math.sign(dx) && DIRS[k][1] === Math.sign(dy)) dir = k;
    if (dir < 0) return null;
    const rel = (dir - p.dir + 4) % 4;
    return { rel, word: ['from ahead', 'from your right', 'from behind', 'from your left'][rel] };
  }
  /**
   * Where a sound comes from, for the ear: how many squares off, how far to
   * the left (-1) or right (1) of the way the hero faces, and whether behind.
   * @param {{x: number, y: number}} at  a monster or a square
   * @param {Record<string, any>} [extra]  what else shapes the sound
   */
  function heard(at, extra) {
    const p = P(), [ax, ay] = DIRS[p.dir], [bx, by] = DIRS[(p.dir + 1) % 4];
    const dx = at.x - p.x, dy = at.y - p.y, dist = Math.hypot(dx, dy);
    return { dist, pan: dist ? (dx * bx + dy * by) / dist : 0, behind: dx * ax + dy * ay < 0, ...extra };
  }
  /**
   * @param {number} dmg @param {string|null} msg
   * @param {import('./types.js').Monster|null} [from]  the monster that struck, if one did
   * @param {string} [cause]  what hurt, when no monster did: a trap, poison, hunger
   */
  function hurtPlayer(dmg, msg, from, cause) {
    // the dead are past hurting: a second blow in the same swing (quills bite
    // the off hand's blow too) would tell the death twice
    if (G.status !== 'playing') return;
    noteTaken(dmg, from);
    const p = P();
    p.hp -= dmg;
    p.lastHurt = G.t;
    if (from) {
      const bearing = relativeBearing(from);
      fx.hurtFrom = bearing ? bearing.rel : 0;
      // a blow from out of sight is held on its edge longer: a player watching
      // the view ahead lost most of a life to an archer on the left, unnoticed
      fx.hurtFromUntil = realNow + (fx.hurtFrom ? 1500 : 900);
      // a champion is remembered by its name: "Grisk, the Goblin King", not "Goblin King"
      const fb = mstat(from);
      G.lastAttacker = { name: fb.named ? `${fb.named.called}, the ${fb.name}` : from.shade ? `the ${fb.name}` : fb.name, id: from.id, dmg, bearing: bearing ? bearing.word : 'from nearby' };
    } else if (cause) G.lastAttacker = { name: cause, dmg, bearing: '', cause: true };
    // the harder the blow against the hero's whole life, the harder the view
    // jolts and reddens; one that takes a tenth of it or more leaves blood on
    // the edges of the view
    const hard = Math.min(1, dmg / Math.max(1, p.maxHp * 0.3));
    fx.damageUntil = realNow + 260;
    fx.hurtAmt = 0.3 + 0.4 * hard;
    fx.shakeAmp = 2.5 + 7 * hard; fx.shakeMs = 220; fx.shakeUntil = realNow + 220;
    if (dmg >= p.maxHp / 10) bloodOnView(hard);
    Sound.play('hurt', from ? heard(from) : undefined);
    // and it is felt differently in the hand: twice, not once
    buzz(from && fx.hurtFrom ? [40, 70, 40] : 40);
    if (msg) log(msg, 'bad');
    // an Amulet of Life Saving takes the killing blow, once, and is spent
    const saver = p.hp <= 0 && JEWEL_SLOTS.find(s => jewelPowers(p.eq[s]).includes('lifesave'));
    if (saver) {
      const it = p.eq[saver];
      p.eq[saver] = null; G.known[it.t] = 1;
      noteHealed(Math.ceil(p.maxHp / 2) - Math.max(0, p.hp));   // from nothing, not from the overkill
      p.hp = Math.ceil(p.maxHp / 2);
      log(`That should have killed you. ${cap(the(it))} flares white at your throat, and crumbles to dust.`, 'good');
      fx.healAt = realNow;
      Sound.play('heal');
      emit('inv');
    }
    if (p.hp <= 0 && hasTalent('last_rites') && !p.ritesUsed) {
      p.hp = 1; p.ritesUsed = true; p.sp = 0;
      log('Last rites: a light holds you up when you should have fallen, and takes every prayer you had left. It will not come again.', 'good');
    }
    if (p.hp > 0 && p.hp < p.maxHp / 4 && hasTalent('second_wind') && G.t >= (p.windReady || 0)) {
      const n = Math.ceil(p.maxHp / 4);
      noteHealed(Math.min(n, p.maxHp - p.hp));
      p.hp = Math.min(p.maxHp, p.hp + n); p.windReady = G.t + 120000;
      log(`Second wind! (+${n})`, 'good');
      Sound.play('heal');
    }
    emit('stats');
    if (p.hp <= 0 && from) learn(from.id, 'death');
    if (p.hp <= 0) die();
  }
  /** Drops of blood on the view's edges, more of them for a harder blow; they run a little and fade. */
  function bloodOnView(hard) {
    const n = Math.round(2 + hard * 6);
    for (let i = 0; i < n; i++) {
      // along the edges, never over the middle where the enemy is
      const edge = Math.floor(look() * 4), t = look();
      const x = edge === 0 ? 0.03 + look() * 0.12 : edge === 1 ? 0.85 + look() * 0.12 : t;
      const y = edge >= 2 ? (edge === 2 ? 0.02 + look() * 0.12 : 0.86 + look() * 0.1) : t;
      fx.drops.push({ x, y, r: 0.008 + look() * 0.012 * (0.5 + hard), born: realNow + look(), life: 1300 + look() * 700 });
    }
    if (fx.drops.length > 24) fx.drops.splice(0, fx.drops.length - 24);
  }
  function healPlayer(n) {
    const p = P();
    noteHealed(Math.max(0, Math.min(n, p.maxHp - p.hp)));
    p.hp = Math.min(p.maxHp, p.hp + n);
    // (a draught's or a scroll's is seen and heard once it has been taken)
    fx.healAt = realNow + fxDelay; fx.healUntil = fx.healAt + 260;
    soon(() => Sound.play('heal'));
    emit('stats');
  }
  function die() {
    const p = P();
    p.hp = 0;
    fxGen++;                               // no blow still in the air is heard over the fall
    fx.hpFrac = 1;                         // no near-death pulse over the fallen
    fx.deadAt = realNow;                    // the view darkens a moment before the end screen
    G.status = 'dead';
    G.deathLog = G.log.filter(e => !e.gone).slice(-6).map(e => e.m);
    log(`${p.name} has died on floor ${G.depth}.`, 'bad');
    Sound.play('die');
    if (G.opts.permadeath) { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } noteRun(runKey(), 'ended'); }
    // remembered, for a later run to find where they fell
    if (!G.opts.daily) Progress.recordFallen({ name: p.name, cls: p.cls, level: p.level, depth: G.depth, run: runKey(), eq: p.eq, killer: killerPhrase() });
    recordHero(false);
    emit('dead');
  }
  // ---------- the end ----------
  // Lifting the Heart ends the run. Its light pours out over the walls, runs up
  // through the stone and carries the hero out with it: the view floods gold
  // for a moment before the victory screen, so the ending is seen, not just read.
  const FINALE_MS = 2600;
  function claimHeart() {
    P().inv.push({ t: 'artifact', q: 1, e: 0 });   // unique: never blocked by the pack limit
    log('You lift the Heart of the Mountain. Its light pours out between your fingers, over the walls, up through the stone.', 'good');
    fx.heartAt = realNow;
    fx.shakeAmp = 3; fx.shakeMs = 1600; fx.shakeUntil = realNow + 1600;
    Sound.play('heart');
    win();
  }
  function win() {
    G.status = 'won';
    log('The light carries you up out of the mountain and into the day. The Heart is yours.', 'good');
    Sound.play('win');
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
    if (G.opts.permadeath) noteRun(runKey(), 'ended');
    recordHero(true);
    emit('won');
  }
  /** How long the Heart's light has left to fill the view before the victory screen. */
  function finaleLeft() { return fx.heartAt >= 0 ? Math.max(0, fx.heartAt + FINALE_MS - realNow) : 0; }
  // Gold spent well shows in everything else; gold hoarded counts for nothing.
  // claiming the Heart is worth half the run again: a flat bonus alone left a
  // win barely ahead of a death on the last floor (22,146 against 20,562)
  function score(p, depth, won) { const run = p.xp * 2 + p.deepest * 100; return won ? Math.round(run * 1.5) + 2000 : run; }
  // Only one page is buried per floor, so a short dungeon holds fewer than the
  // archive knows about. Count what this delve can actually yield, not the lot.
  function pagesInDungeon() { return Math.min(G && G.opts ? G.opts.levels : JOURNAL.length, JOURNAL.length); }
  // How the story closes, in the voice of the life that brought you here.
  function epilogue(won) {
    const p = P();
    const bg = BACKGROUNDS[p.bg] || BACKGROUNDS.oathbroken;
    const read = G.journal ? G.journal.length : 0;
    const lines = [];
    if (won) {
      lines.push(`${p.name} came up out of the Deepdelve carrying the Heart of the Mountain, which is a sentence nobody in the valley has been able to write for three winters.`);
      lines.push(bg.epi);
      if (G.route && ROUTES[G.route]) lines.push(ROUTES[G.route].epi);   // the road taken at the divided stair
      const total = pagesInDungeon();
      lines.push(read >= total
        ? 'They also carried out every page the earlier crews left behind, so the valley will finally learn what became of them.'
        : `They left ${total - read} of the earlier crews' pages down there in the dark. Someone else will have to go back for those.`);
    }
    // the choices that followed them down
    const t = G.threads || {};
    const told = [];
    if (t.captive) told.push('a man they cut out of goblin chains tells the story in the valley taverns, and gets the details wrong in their favour');
    if (t.guide) told.push('a guildsman they dug out of the rubble keeps their chalk map on his wall');
    if (t.crew) told.push('the third crew lies buried where they fell, because someone stopped to do it');
    if (t.lamp) told.push('the Lampfolk still tell of a sun-walker who stopped in the dark to light a lamp');
    if (t.robbed) told.push('the Lampfolk have a name for them, and do not say it kindly');
    if (G.companion) told.push(G.companion.fallen ? `a hound called ${G.companion.name} lies buried on floor ${G.companion.fallen} of the Deepdelve, and they do not talk about it` : won && G.companion.depth !== G.depth ? `a brown hound called ${G.companion.name} came up out of the Deepdelve a week after them, thin as a rake, and will not be parted from them again` : won ? `a brown hound called ${G.companion.name} sleeps by their fire, and will not be parted from them` : G.companion.depth === G.depth && G.companion.mode === 'follow' ? `a brown hound called ${G.companion.name} stood over them to the last, and came up out of the dark alone` : `a brown hound called ${G.companion.name} was found at the foot of the stair, waiting`);
    if (t.bargain) told.push(won ? 'they never speak of the pale thing in the narrow passage, or what it cost them at the end' : 'whatever they bargained with in the narrow passage was paid in full');
    if (!won) {
      lines.push(p.deepest >= 4
        ? `${p.name} got as far as floor ${p.deepest} of the Deepdelve, which is further than the fourth crew managed.`
        : `${p.name} fell on floor ${G.depth} of the Deepdelve, in the shallow halls where it takes most of those who try.`);
      lines.push(bg.epi);
      lines.push(read > 0
        ? `They were carrying ${read} of the earlier crews' pages when they fell. In time someone will find those too, along with a new name for the roster.`
        : 'They carried nothing out and left nothing behind but another name for the roster.');
    }
    if (told.length) lines.push(cap(told.join('; ')) + '.');
    // a shade laid to rest on the way down
    if (G.rested) lines.push(`On the way down they found ${G.rested}, who had gone before them, and laid them to rest.`);
    // the fallen are remembered (Progress.fallen), and the next delve will say so
    if (!won && !G.opts.daily) lines.push(`${p.name} will not lie quiet. A later delve will find their bones where they fell, and something keeping watch over them.`);
    return lines;
  }
  function recordHero(won) {
    const p = P();
    // trophies first, so a first win is told on the victory screen
    // only a win on one life counts: a run that could be reloaded proves less
    if (won && G.opts.permadeath) G.earned = Progress.recordWin(p.cls, G.opts.difficulty || 'normal', { path: p.path, vows: G.opts.vows, levels: G.opts.levels, route: G.route });
    else if (won) G.earned = { reloadable: true };
    /** @type {Record<string, any>} */
    const entry = { name: p.name, cls: p.cls, level: p.level, depth: G.depth, gold: p.gold, xp: p.xp, kills: p.kills, won, seed: G.seed, date: Date.now(), score: score(p, G.depth, won),
      difficulty: G.opts.difficulty || 'normal', permadeath: !!G.opts.permadeath, levels: G.opts.levels || 8, ...(G.route ? { route: G.route } : {}), ...(G.opts.daily ? { daily: G.opts.daily } : {}) };
    // the named champions it cut down, by name, for the Hall's line
    const slain = Object.keys(runStats().kills).filter(id => MONSTERS[id] && MONSTERS[id].named).map(id => MONSTERS[id].named.called);
    if (slain.length) entry.named = slain;
    if (p.path) entry.path = p.path;       // "Level 9 Fighter, Knight"
    if (Array.isArray(G.opts.vows) && G.opts.vows.length) entry.vows = G.opts.vows.slice();
    // One run, one line: a hero who falls, loads the last save and falls again
    // was written in once per death. The run is known by when it began (a save
    // from before that was kept goes by its seed and hero), and its last end
    // replaces the one before.
    entry.run = runKey();
    if (G.rested) entry.rested = G.rested;   // an earlier hero's shade laid to rest
    try {
      const list = hall().filter(h => h.run !== entry.run);
      list.push(entry);
      list.sort((a, b) => b.score - a.score);
      localStorage.setItem(HALL_KEY, JSON.stringify(list.slice(0, 20)));
    } catch (e) { /* ignore */ }
  }
  // ---------- the run in numbers ----------
  // What the end screen tells about the run: who was killed, the best blow,
  // where it hurt. Only ever written to, never read by the rules, so nothing
  // here can change how a fight goes. The hooks elsewhere are one line each.
  /** @returns {import('./types.js').RunStats} */
  function freshStats() {
    return { dealt: 0, taken: 0, healed: 0, best: null, worst: null, kills: {}, spells: {}, hurtOn: {}, potions: 0, scrolls: 0, meals: 0, gold: 0 };
  }
  /** This run's stats; a save from before they were kept starts them at nothing. */
  function runStats() {
    if (!G.stats) G.stats = freshStats();
    return G.stats;
  }
  /** A blow the hero landed, and what it was struck with. */
  /** @param {number} [hpBefore]  what the one struck had left, so a blow past death counts only what it took */
  function noteDealt(m, dmg, tag, hpBefore = m.hp) {
    const s = runStats(), p = P();
    // a blow counts for what it took: a crushing roll on a one-point rat is one point
    dmg = Math.min(dmg, Math.max(0, hpBefore));
    s.dealt += dmg;
    if (s.best && dmg <= s.best.dmg) return;
    // the first blow to reach a number keeps the record, so a tie does not rename it
    const how = castingName ? cap(castingName)
      : tag === 'offhand' ? (p.eq.offhand ? the(p.eq.offhand) : 'your off hand')
      : tag === 'thorns' ? 'your barbs' : tag === 'burning' ? 'fire' : tag === 'venom' ? 'poison' : tag === 'snare' ? 'your snare'
      : p.eq.weapon ? the(p.eq.weapon) : 'your bare hands';
    s.best = { dmg, to: mstat(m).name, id: m.id, how, depth: G.depth };
  }
  /** Damage the hero took, from a monster or from anything else. */
  function noteTaken(dmg, from) {
    const s = runStats();
    s.taken += dmg;
    s.hurtOn[G.depth] = (s.hurtOn[G.depth] || 0) + dmg;
    if (!s.worst || dmg > s.worst.dmg) s.worst = { dmg, from: from ? mstat(from).name : '', id: from ? from.id : '', depth: G.depth };
  }
  function noteKill(m) { const k = runStats().kills; k[m.id] = (k[m.id] || 0) + 1; }
  function noteSpell(sp) { const c = runStats().spells; c[sp.id] = (c[sp.id] || 0) + 1; }
  function noteHealed(n) { runStats().healed += n; }
  function noteGold(n) { runStats().gold += n; }
  /** Something eaten, drunk or read. */
  function noteUsed(kind) {
    const s = runStats();
    if (kind === 'potion') s.potions++; else if (kind === 'scroll') s.scrolls++; else if (kind === 'food') s.meals++;
  }

  // ---------- bestiary ----------
  // What the hero has learned about each kind of monster, kept across runs
  // like the Hall of Heroes. Meeting one shows its picture and nature; the
  // first kill shows its numbers; its trick is written down once seen (or
  // after a few kills), and the answer once the hero has beaten the trick.
  const BESTIARY_KEY = 'deepdelve.bestiary';
  const TRICK_KILLS = 3, ANSWER_KILLS = 5;
  /** @returns {Record<string, {met: number, kills: number, deaths: number, trick?: number, answer?: number, el?: Record<string, string>}>} */
  // read back only when what is stored has changed: a regrowing troll notes
  // itself every second, and parsing and checking the whole book each time
  // was work for nothing
  let beastRaw = null, beastBook = null;
  function bestiary() {
    let raw = null;
    try { raw = localStorage.getItem(BESTIARY_KEY); } catch (e) { /* private browsing */ }
    if (beastBook && raw === beastRaw) return beastBook;
    let v = {};
    try { v = JSON.parse(raw || '{}'); } catch (e) { /* start afresh */ }
    if (!v || typeof v !== 'object' || Array.isArray(v)) v = {};
    // whatever was stored, each record comes back as numbers, never a crash
    const out = {};
    for (const id in v) {
      if (!MONSTERS[id]) continue;
      const r = v[id] && typeof v[id] === 'object' ? v[id] : {};
      const n = x => Math.max(0, Math.floor(Number(x) || 0));
      // what fire, cold and lightning were found to do to it, and nothing else
      const el = {};
      if (r.el && typeof r.el === 'object') for (const k of ['fire', 'cold', 'lightning']) if (r.el[k] === 'weak' || r.el[k] === 'resist') el[k] = r.el[k];
      out[id] = { met: n(r.met), kills: n(r.kills), deaths: n(r.deaths), ...(r.trick ? { trick: 1 } : {}), ...(r.answer ? { answer: 1 } : {}), ...(Object.keys(el).length ? { el } : {}) };
    }
    beastRaw = raw; beastBook = out;
    return out;
  }
  /** Note something learned about a kind of monster, and say so when it is new.
   * `met` also counts a first meeting, so a trick seen at first sight is one line. */
  function learn(id, what, met) {
    if (!MONSTERS[id]) return;
    const all = bestiary(), mb = MONSTERS[id], name = mb.named ? `${mb.named.called}, the ${mb.name}` : mb.name, lore = BESTIARY[id] || {};
    const r = all[id] || (all[id] = { met: 0, kills: 0, deaths: 0 });
    const news = [];
    if (met && what !== 'met') { if (!r.met) news.push('new entry'); r.met++; }
    if (what === 'met') { if (!r.met) news.push('new entry'); r.met++; }
    else if (what === 'kill') {
      if (!r.met) news.push('new entry');
      r.met = Math.max(1, r.met);
      r.kills++;
      if (r.kills === 1) news.push('its strength');
      if (r.kills >= TRICK_KILLS && lore.trick && !r.trick) { r.trick = 1; news.push('its trick'); }
      if (r.kills >= ANSWER_KILLS && lore.answer && !r.answer) { r.answer = 1; news.push('how to beat it'); }
    }
    else if (what === 'trick') { if (lore.trick && !r.trick) { r.trick = 1; news.push('its trick'); } }
    else if (what === 'answer') {
      if (lore.answer && !r.answer) { if (!r.trick) news.push('its trick'); r.answer = 1; r.trick = 1; news.push('how to beat it'); }
    }
    else if (what === 'death') r.deaths++;
    else if (what.startsWith('element:')) {
      const [, el, how] = what.split(':');
      r.el = r.el || {};
      if (!r.el[el]) { r.el[el] = how; news.push(how === 'weak' ? `weak to ${el}` : `resists ${el}`); }
    }
    // a trick seen or beaten again is nothing new, and a troll regrows every second
    if ((what === 'trick' || what === 'answer') && !news.length && !met) return;
    try { const raw = JSON.stringify(all); localStorage.setItem(BESTIARY_KEY, raw); beastRaw = raw; beastBook = all; } catch (e) { /* ignore */ }
    if (news.length && G && G.status === 'playing') {
      // notes that follow one another share one quiet line instead of three loud ones
      const last = liveLine();
      const notes = last && last.notes ? { ...last.notes } : {};
      notes[name] = [...new Set([...(notes[name] || []), ...news])];
      if (last && last.notes) { last.gone = true; last.m = ''; }
      G.log.push({ m: 'Bestiary, ' + Object.entries(notes).map(([n, l]) => `${n}: ${l.join(', ')}`).join('; ') + '.', c: 'note', notes });
      G.logSeq = (G.logSeq || 0) + 1;
    }
  }
  /** The first meeting with this particular monster, this run. */
  function meet(m, also) {
    if (!G.met) G.met = {};
    const fresh = !G.met[m.uid];
    G.met[m.uid] = 1;
    if (also) learn(m.id, also, fresh);
    else if (fresh) learn(m.id, 'met');
  }
  function hall() {
    try { return JSON.parse(localStorage.getItem(HALL_KEY) || '[]'); } catch (e) { return []; }
  }
  function boltTargets(range, pierce) {
    const p = P();
    const [dx, dy] = DIRS[p.dir];
    const out = [];
    for (let i = 1; i <= range; i++) {
      const x = p.x + dx * i, y = p.y + dy * i;
      if (!passable(x, y)) break;
      const m = monsterAt(x, y);
      if (m) { out.push(m); if (!pierce) break; }
    }
    return out;
  }
  /** How far a bolt reaches, Radiance included. */
  const spellRange = sp => sp.range + (sp.holy && hasTalent('radiance') ? 2 : 0);
  /** Why casting this now would waste the points, or null if it would not. */
  function spellWasteReason(sp) {
    const p = P();
    if (sp.kind === 'heal' && p.hp >= p.maxHp) return `You are unhurt. ${sp.name} would be wasted.`;
    // fire burns a web away, so a webbed caster's flame is never wasted
    if (sp.kind === 'bolt' && !(sp.fire && p.webbed > G.t) && !boltTargets(spellRange(sp), sp.pierce).length) {
      return `Nothing within reach for ${sp.name} to strike.`;
    }
    if (sp.kind === 'buff' && ownEffect(sp.stat) >= buffAmount(sp)) return `${sp.name} is already upon you.`;
    return null;
  }
  // A spell takes time, and shares the swing's timer. Casting used to cost
  // nothing: a cleric could bless, ward, heal and strike in the same instant,
  // and a mage could empty their points as fast as they could tap Cast. Now
  // each moment is a choice between them. A class may cast faster or slower
  // than this: a mage's words are quick, a cleric's prayers are not.
  const CAST_MS = 800;
  /** How each spell looks, and how long its effect plays. */
  // How far into each picture the spell reaches its target: the darts fly for
  // half of theirs, the fan of flame a little less; lightning and a shaft of
  // light are there at once. What the blow looks like waits for that moment.
  const SPELL_IMPACT = { missile: 0.5, hands: 0.45, cone: 0.3, pillar: 0.15, smite: 0.08, lightning: 0 };
  const SPELL_FX = {
    magic_missile: ['missile', 650], burning_hands: ['hands', 450], shield: ['buff', 600], lightning: ['lightning', 380],
    cone_cold: ['cone', 520], cure_light: ['heal', 800], bless: ['buff', 600], smite: ['smite', 560],
    cure_serious: ['heal', 850], protection: ['buff', 600], flame_strike: ['pillar', 700],
  };
  /** Show a spell's effect: where it lands, or the square ahead if nowhere. */
  /** How long a scroll takes to read and burn away, and the colour its writing kindles. */
  const READ_MS = 1000;
  const SCROLL_GLOW = { fire: '#ff7020', heal: '#60e080', map: '#70b0ff', teleport: '#c080ff', uncurse: '#ffe8a0' };
  /** A spell's picture; delay puts it off (a scroll's fire waits for the page to burn), from moves where it starts, as fractions of the view. */
  function spellFx(style, color, dur, targets, reach, delay = 0, from = null) {
    const p = P(), [dx, dy] = DIRS[p.dir];
    fx.spells.push({ style, color, born: realNow + delay, until: realNow + delay + dur, from,
      pts: targets.map(m => ({ x: m.rx + 0.5, y: m.ry + 0.5 })),
      ahead: { x: p.x + dx * (reach || 1) + 0.5, y: p.y + dy * (reach || 1) + 0.5 } });
  }
  function castSpell(sp) {
    const p = P();
    queuedAttack = false;
    if (p.held > G.t) { blocked(heldWhy()); return false; }
    if (!spellAvailable(sp)) { log(`You are not experienced enough to cast ${sp.name}.`, 'bad'); return false; }
    // choosing a spell readies it on the Cast button, even if it cannot fly
    // yet: a mage picks Burning Hands before the fight, not during it
    G.lastSpell = sp.id;
    if (p.sp < spellCost(sp)) { log('Not enough spell points.', 'bad'); Sound.play('error'); return false; }
    const waste = spellWasteReason(sp);
    if (waste) { log(waste, 'bad'); Sound.play('error'); emit('waste'); return false; }
    if (G.t < p.nextAttack) { blocked('You are still recovering from your last action.'); return false; }
    p.nextAttack = G.t + Math.round((cls().castMs || CAST_MS) * (hasTalent('quick_words') ? 0.75 : 1));
    p.sp -= spellCost(sp);
    noteSpell(sp);
    G.lastSpell = sp.id;
    fx.castUntil = realNow + 260; fx.castColor = sp.color; fx.castAt = realNow;
    Sound.play('cast', { spell: sp.id });
    const look = SPELL_FX[sp.id] || ['buff', 500];
    if (sp.kind !== 'bolt') spellFx(look[0], sp.color, look[1], [], 1);
    switch (sp.kind) {
      case 'heal': { const n = healerHeal(Math.round(d(...sp.heal(p.level)) * (hasTalent('healing_hands') ? 4 / 3 : 1) * (focusHas('mercy') ? 1.25 : 1) * (setWorn('dawn') ? 1.25 : 1) * deepMagic())); healPlayer(n); log(`You cast ${sp.name} and heal ${n}.${hasTalent('healing_hands') ? ' (Healing Hands)' : ''}${focusHas('mercy') ? ` (${ITEMS[p.eq.shield.t].name})` : ''}`, 'good'); break; }
      case 'buff':
        p.effects[sp.stat] = { amount: buffAmount(sp), until: G.t + buffDuration(sp), src: sp.id };
        log(`You cast ${sp.name}. ${spellDesc(sp)}`, 'good');
        if (sp.id === 'shield' && hasTalent('mirror_image')) { p.mirrors = 2; log('Two images of you shimmer into being at your side.', 'good'); }
        break;
      case 'bolt': {
        if (sp.fire) burnWeb();
        const targets = boltTargets(spellRange(sp), sp.pierce);
        spellFx(look[0], sp.color, look[1], targets, spellRange(sp));
        if (!targets.length) { log(`Your ${sp.name} strikes nothing.`); break; }
        // an Empowered or Radiant spell says so in every line it hits with
        castingName = (sp.holy && hasTalent('radiance') ? 'radiant ' : hasTalent('empower') ? 'empowered ' : '') + sp.name;
        fxDelay = Math.round(look[1] * (SPELL_IMPACT[look[0]] || 0));
        try {
          for (const m of targets) {
            if ((sp.pierce || sp.area) && packSize(m) > 1) log(`${sp.name} engulfs all ${packSize(m)} of the ${mstat(m).name}s!`, 'good');
            // a Crystal Orb adds one to each of the spell's dice, up to two
            const dice = sp.dmg(p.level);
            let dmg = elemental(m, d(...dice) + (focusHas('die') ? Math.min(2, dice[0]) : 0), spellElement(sp));
            if (sp.holy && mstat(m).undead) dmg *= 2;
            // an Orb of Storms drives the cold and the lightning harder; a Sunburst, the Smite
            if (focusHas('storm') && FROST_SPELLS.includes(sp.id)) dmg = Math.round(dmg * 1.2);
            if (focusHas('wrath') && (sp.holy || sp.id === 'flame_strike')) dmg = Math.round(dmg * 1.25);
            if (sp.holy && hasTalent('radiance')) dmg = Math.round(dmg * 1.5);
            if (hasTalent('empower')) dmg = Math.round(dmg * 1.2);
            dmg = Math.round(dmg * deepMagic());
            if (sp.fire) dmg = pyroFire(dmg);
            dmg = templarSmite(sp, dmg);
            // Rime, or a Frostweaver: the cold and the lightning hold back whatever they touch
            const hold = spellHold(sp);
            if (hold) { m.nextAct = Math.max(m.nextAct, G.t) + hold; if (m.windup) m.windup.until += hold; }
            // a bolt that tears through everything in its path, or a blast that
            // fills the square, takes a whole group; a dart only the front one
            const tag = sp.fire ? 'burn' : 'fire';
            if (sp.pierce || sp.area) hitGroup(m, dmg, tag); else damageMonster(m, dmg, tag);
          }
        } finally { castingName = ''; fxDelay = 0; }
        break;
      }
    }
    emit('stats');
    return true;
  }
  // ---------- class abilities ----------
  // A fighter and a thief have no spells, so each has a move of their own on
  // the Cast button. The fighter's Bash breaks the blow or trick being drawn
  // back in front of them and sets the foe reeling back. (It once left the foe
  // open as well, and was worth fourteen wins in a hundred: too much.) The thief's Smoke
  // makes everything close by lose them, as good as asleep to them for a few
  // seconds: time to slip away, or to land the double blow on a sleeping foe.
  // Each path gives its class's move a twist.
  const ABILITIES = { fighter: { id: 'bash', name: 'Bash', cool: 15000 }, thief: { id: 'smoke', name: 'Smoke', cool: 24000 }, ranger: { id: 'snare', name: 'Snare', cool: 16000 } };
  const SNARE_REACH = 5, SNARE_MS = 2500;
  const SMOKE_MS = 3000, SMOKE_REACH = 3;
  // how long a foe that lost you in smoke stays near and wary after it clears: no resting beside it
  const SMOKE_ALERT_MS = 5000;
  /** This hero's move, if their class has one. */
  const abilityOf = (p = P()) => ABILITIES[p.cls] || null;
  const abilityCool = a => (a.id === 'smoke' && onPath('trickster') ? 16000 : a.id === 'bash' && hasTalent('shield_slam') ? 10000 : a.id === 'snare' ? (hasTalent('long_snare') ? 12000 : 16000) - (onPath('warden') ? 3000 : 0) : a.cool);
  /** Seconds until the move is ready again, 0 when it is. */
  const abilityLeft = () => Math.max(0, Math.ceil(((P().abilityReady || 0) - G.t) / 1000));
  function useAbility() {
    const p = P(), a = abilityOf();
    if (!a) return false;
    if (abilityLeft()) { log(`${a.name} is not ready yet: ${abilityLeft()}s.`, 'bad'); Sound.play('error'); return false; }
    return a.id === 'bash' ? bash(a, p) : a.id === 'snare' ? snare(a, p) : smoke(a, p);
  }
  /**
   * A ranger's Snare: a weighted cord thrown at the first foe down the
   * corridor ahead, five squares at most. It stands caught a moment, the blow
   * it was drawing back broken off (the lich's rite goes on, and the lich
   * shrugs free in half the time). A Warden's bites and holds longer.
   */
  function snare(a, p) {
    const [dx, dy] = DIRS[p.dir];
    const reach = SNARE_REACH + (onPath('sharpshooter') ? 2 : 0);
    let m = null;
    for (let i = 1; i <= reach && !m; i++) {
      const x = p.x + dx * i, y = p.y + dy * i;
      if (i > 1 && !passable(x, y)) break;
      const t = monsterAt(x, y);
      if (t && !t.collapsed) m = t;
      else if (!passable(x, y)) break;
    }
    if (!m) { log('There is nothing down the corridor ahead to snare.', 'bad'); Sound.play('error'); return false; }
    const mb = mstat(m);
    const rite = !!(m.windup && m.windup.move === 'rite');
    const broke = !rite && !!(m.windup || m.volley);
    if (!rite) { m.windup = null; m.volley = null; }
    m.pressing = false;
    const hold = (SNARE_MS + (hasTalent('long_snare') ? 1500 : 0) + (onPath('warden') ? 1000 : 0)) / (mb.boss ? 2 : 1);
    if (!rite) m.nextAct = Math.max(m.nextAct, G.t + hold);
    m.snaredUntil = G.t + hold;
    m.awake = true;
    p.abilityReady = G.t + abilityCool(a);
    meet(m);
    Sound.play('shoot', { w: 'sling' });
    floatText(m, 'snared', '#e8d8a0');
    log(`Your cord wraps the ${mb.name}${broke ? ' and breaks off its blow' : ''}. ${rite ? 'Its rite goes on.' : 'It stands caught!'}`, 'good');
    if (onPath('warden')) damageMonster(m, Math.max(1, d(1, 6) + mod(p.stats.dex)), 'snare');
    return true;
  }
  /** Steady Aim, a ranger's: a bow shot at a foe two squares off or more, +2; a Sharpshooter's at three or more, +3 more. */
  function rangerAim(m, atRange) {
    const p = P();
    if (!atRange || p.cls !== 'ranger') return 0;
    const far = Math.abs(m.x - p.x) + Math.abs(m.y - p.y);
    return 2 + (onPath('sharpshooter') && far >= 3 ? 3 : 0);
  }
  /** A Warden's snared foe takes 2 more from every blow and arrow. */
  const wardenHold = m => (onPath('warden') && m.snaredUntil > G.t ? 2 : 0);
  function bash(a, p) {
    const [dx, dy] = DIRS[p.dir], m = monsterAt(p.x + dx, p.y + dy);
    if (!m || m.collapsed) { log('There is nothing in front of you to bash.', 'bad'); Sound.play('error'); return false; }
    const mb = mstat(m), shield = !!(p.eq.shield && !ITEMS[p.eq.shield.t].focus), what = shield ? 'shield' : p.eq.weapon ? 'pommel' : 'fist';
    // any blow or trick it was drawing back is broken off; the lich's rite goes on through it
    const rite = !!(m.windup && m.windup.move === 'rite');
    const broke = !rite && !!(m.windup || m.volley);
    if (!rite) { m.windup = null; m.volley = null; }
    m.pressing = false;
    // a shield rings a foe harder than a pommel; a Knight's sets it back further still
    const stagger = (shield ? 800 : 500) + (onPath('knight') ? 700 : 0);
    if (!rite) m.nextAct = Math.max(m.nextAct, G.t + (mb.boss ? stagger / 2 : stagger));
    p.abilityReady = G.t + abilityCool(a);
    meet(m);
    Sound.play('block', heard(m));
    log(`You bash the ${mb.name} with your ${what}${broke ? ' and break off its blow' : ''}. ${rite ? 'Its rite goes on.' : 'It reels back!'}`, 'good');
    // a Berserker puts weight behind it: the bash is a blow of its own
    if (onPath('berserker')) damageMonster(m, Math.max(1, d(1, 6) + mod(armStat(p)) + berserkerRage()), 'bash');
    // Shield Slam: it goes back a square, if the square behind it is open, and is dazed a second
    // longer: without that it walked straight back in with the first move, and the slam cost tempo
    if (hasTalent('shield_slam') && lvl().monsters.includes(m) && !m.collapsed && !mb.boss) {
      const bx = m.x + dx, by = m.y + dy;
      if (passable(bx, by) && !monsterAt(bx, by) && !npcAt(bx, by) && !companion.at(bx, by)) { moveMonster(m, bx, by); m.nextAct = Math.max(m.nextAct, G.t + stagger + 1000); log(`The ${mb.name} is knocked back a square, dazed.`, 'good'); }
    }
    return true;
  }
  function smoke(a, p) {
    const L = lvl();
    ensureDist();
    let lost = 0, committed = 0;
    for (const m of L.monsters) {
      const di = distField[m.y * L.w + m.x];
      // a blow already on its way still comes: smoke is for getting clear, not for being saved
      if (!(di >= 0 && di <= SMOKE_REACH) || m.collapsed) continue;
      if (m.windup || m.volley) { committed++; continue; }
      m.pressing = false;
      // the lich sees through smoke, though it spoils its aim for a moment
      if (mstat(m).boss) { m.nextAct = Math.max(m.nextAct, G.t + 600); continue; }
      // a foe that had you is hunting for you in the grey, and stays near for a while after:
      // no resting beside it. A sleeper never knew you were there, and stays as it was.
      if (m.awake) { lost++; floatText(m, 'lost you', '#eef0ff'); m.smoked = G.t + SMOKE_ALERT_MS + (onPath('assassin') ? 4500 : SMOKE_MS); }
      m.awake = false; m.fleeing = false; m.nextAct = G.t + 400;
      // and a zombie's grip loosens as it loses you
      if (p.grabbed && p.grabbed.uid === m.uid) p.grabbed = null;
    }
    p.smokeUntil = G.t + (onPath('assassin') ? 4500 : SMOKE_MS);
    p.abilityReady = G.t + abilityCool(a);
    fx.smokeUntil = realNow + (p.smokeUntil - G.t);
    Sound.play('snuff');
    const coming = committed ? ` ${committed === 1 ? 'A blow already drawn back is' : 'Blows already drawn back are'} still coming.` : '';
    log(lost ? `You crush a smoke pellet underfoot. In the choking grey, ${lost === 1 ? 'your foe loses' : `${lost} foes lose`} you.${coming}`
      : committed ? `You crush a smoke pellet underfoot, but it is too late to hide from a blow already drawn back.`
      : 'You crush a smoke pellet underfoot. Nothing awake is close enough to lose you in it.', lost ? 'good' : '');
    return true;
  }

  function castLast() {
    const list = knownSpells();
    if (!list.length) return abilityOf() ? useAbility() : quaff();
    const sp = list.find(s => s.id === G.lastSpell) || list[0];
    return castSpell(sp);
  }

  /**
   * For a hero with no spells the Cast button is Quaff: drink the smallest
   * known healing draught that will not be wasted, the one a player reaches
   * for mid-fight without opening the pack. A caster's bottle beside the
   * life bar does the same.
   */
  function quaff() {
    const p = P();
    queuedAttack = false;
    const draughts = p.inv.filter(i => (i.t === 'potion_heal' || i.t === 'potion_xheal') && isKnown(i.t));
    if (!draughts.length) { log('You have no healing draught you know by sight.', 'bad'); Sound.play('error'); return false; }
    const missing = p.maxHp - p.hp;
    const pick = draughts.find(i => i.t === 'potion_heal' && missing < 20) || draughts.find(i => i.t === 'potion_xheal') || draughts[0];
    useItem(pick);
    return true;
  }
  // A scroll worth reading this moment, read in one tap: fire when a foe is
  // ahead for it, restoration when badly hurt, teleport when cornered and
  // failing. Only a scroll known by sight: an unknown one is a gamble to take
  // from the pack. Nothing worth reading, and the button is not there.
  function quickScroll() {
    if (!G || G.status !== 'playing') return null;
    const p = P(), has = t => p.inv.find(i => i.t === t && isKnown(i.t));
    const fire = has('scroll_fire');
    if (fire && boltTargets(3, false).length) return fire;
    const heal = has('scroll_heal');
    if (heal && p.hp <= p.maxHp * 0.5) return heal;
    const away = has('scroll_teleport');
    if (away && p.hp <= p.maxHp * 0.3 && lvl().monsters.some(m => m.awake && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) <= 1)) return away;
    return null;
  }
  function readQuick() {
    queuedAttack = false;
    const s = quickScroll();
    if (!s) { log('No scroll you carry would help just now.', 'bad'); Sound.play('error'); return false; }
    useItem(s);
    return true;
  }
  /** Something awake within five steps: no resting. */
  function enemiesNear() {
    const L = lvl();
    ensureDist();
    // one lost in a thief's smoke is still there, and no one sleeps beside it
    return L.monsters.some(m => { const dd = distField[m.y * L.w + m.x]; return (m.awake || (m.smoked || 0) > G.t) && dd >= 0 && dd <= 5; });
  }
  /**
   * What the Rest button will do: rest, saying how well once rests here grow
   * thin, or with something close, nothing (Foes near). It never drinks: a
   * button that turned into Quaff in a fight spent potions nobody meant to.
   */
  function restLabel() {
    if (!G || G.status !== 'playing') return 'Rest';
    if (vowed('iron')) return 'Vowed';
    if (enemiesNear()) return 'Foes near';
    const share = restShare();
    return share >= 1 ? 'Rest' : share >= 0.5 ? 'Rest \u00bd' : share > 0 ? 'Rest \u00bc' : 'No rest';
  }
  /** What the Cast button will do: the readied spell, or Quaff for the spell-less. */
  function castLabel() {
    const list = knownSpells();
    const a = abilityOf();
    if (!list.length && a) return abilityLeft() ? `${a.name} ${abilityLeft()}s` : a.name;
    if (!list.length) return P().inv.some(i => (i.t === 'potion_heal' || i.t === 'potion_xheal') && isKnown(i.t)) ? 'Quaff' : 'Quaff (none)';
    return (list.find(s => s.id === G.lastSpell && spellAvailable(s)) || list[0]).name;
  }

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
  /** How much of the hero's life the next rest on this floor gives back. */
  // each rest on a floor restores less than the last: all, then half, then a quarter (on Hard, two only)
  function restShare() { const n = lvl().rests || 0, r = diff().rests; return n >= r.length ? 0 : r[n]; }
  /** Something of this floor finds the sleeper: awake, a few steps off. */
  function ambush() {
    const L = lvl();
    ensureDist();
    const cands = [];
    for (let i = 0; i < L.w * L.h; i++) {
      const dd = distField[i];
      if (L.tiles[i] !== T.FLOOR || dd < 3 || dd > 7) continue;
      const x = i % L.w, y = (i / L.w) | 0;
      if (!monsterAt(x, y) && !npcAt(x, y) && !companion.at(x, y)) cands.push([x, y]);
    }
    if (!cands.length) return false;
    // what finds the sleeper is what lives on this floor: the same stretched tiers
    const td = Dungeon.tierAt(G.depth, G.opts.levels || 8);
    const pool = Object.keys(MONSTERS).filter(id => !MONSTERS[id].boss && !MONSTERS[id].named && !MONSTERS[id].shade && td >= MONSTERS[id].tier[0] && td <= MONSTERS[id].tier[1]);
    const id = pool.length ? Dice.pick(pool) : 'goblin', b = MONSTERS[id];
    const [x, y] = Dice.pick(cands);
    newMonster(id, x, y, Dice.dice(b.hp[0], b.hp[1], b.hp[2])).nextAct = G.t + 1500;
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
    if (!restShare()) { log('The dark is too close here to sleep again. Find the stairs.', 'bad'); Sound.play('error'); return false; }
    p.food -= food;
    const before = L.rests || 0;
    let share = restShare();
    L.rests = before + 1;
    // the first rest on a floor is quiet; after it, each is more likely to be found
    const found = before > 0 && Math.random() < Math.min(AMBUSH_MOST, before * AMBUSH_STEP);
    if (found) share /= 2;
    // Field Craft: a ranger makes a better camp, and wakes a third more whole
    const hp = Math.min(p.maxHp - p.hp, Math.ceil(p.maxHp * share * (hasTalent('field_craft') ? 4 / 3 : 1))), sp = Math.min(p.maxSp - p.sp, Math.ceil(p.maxSp * share));
    noteHealed(hp);
    p.hp += hp; p.sp += sp;
    companion.rested(share);
    G.t += found ? 20000 : 60000;
    for (const m of L.monsters) { for (let i = 0; i < 3; i++) if (!m.awake) wander(m); m.nextAct = G.t + 300; }
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
  const DIFFICULTY = {
    easy:   { hp: 1,    edge: 0, lich: 1,    rests: [1, 0.5, 0.25], press: false },
    normal: { hp: 1.5,  edge: 1, lich: 1.45, rests: [1, 0.5, 0.25], press: true },
    hard:   { hp: 1.8,  edge: 2, lich: 2.3,    rests: [1, 0.5],       press: true },
  };
  /** The run's difficulty settings; a run from before there was a choice is Normal. */
  const diff = () => DIFFICULTY[(G && G.opts && G.opts.difficulty) || 'normal'] || DIFFICULTY.normal;
  // the first floor is where a hero learns: its creatures hit a step softer. On Hard
  // the second and third keep that step too: a quarter of Hard's fighters and clerics
  // died there before they had a path, so it comes from the fourth floor, paid for
  // with sturdier creatures (1.8, not 1.7) all the way down.
  const diffEdge = () => Math.max(0, diff().edge - (G.depth <= 1 || (diff().edge > 1 && G.depth <= 3) ? 1 : 0)) + longEdge();
  // The Long Delve's back half: its creatures a step surer from the seventh
  // floor, and a little sturdier with every floor past the sixth. Without it
  // twelve floors were easier than eight (82% on Normal, 60% on Hard): the
  // extra floors gave more levels and gear than the deep took back.
  const isLong = () => (G.opts.levels || 8) >= 12;
  const longEdge = () => (isLong() && G.depth >= 7 ? 1 : 0);
  const longSturdier = depth => (isLong() ? 1 + 0.04 * Math.max(0, depth - 6) : 1);
  // The deep floors' own monsters answer so well to a player who reads the
  // bestiary that an ordinary Normal delve grew kinder (78% wins, tuned to
  // about three in four): its creatures are a touch sturdier to make up for
  // it. Not the Long Delve's, whose figure did not move.
  const NORMAL_SHORT = 1.04;
  const MAGE_DRAW = 2;
  const mageDraw = () => (G.opts.difficulty === 'hard' || isLong() ? MAGE_DRAW : 1);
  const shortNormal = () => ((G.opts.difficulty || 'normal') === 'normal' && !isLong() ? NORMAL_SHORT : 1);
  // On Hard the Long Delve's deep floors hold creatures nearly twice as sturdy,
  // and a spell's dice do not grow with gear as a blow does: the casters fell
  // to them half again as often as anyone (28% and 34% wins, the rest 47% to
  // 57%). So there, from the seventh floor, spells strike and heal 6% harder a
  // floor, and a cleric's blows with them, the god's answer as deep as the prayer.
  const deepMagic = () => (isLong() && G.depth >= 7 && G.opts.difficulty === 'hard' ? 1 + 0.06 * (G.depth - 6) : 1);
  // And the fighter, whose one answer is the blow, fell behind there once the
  // casters were lifted (37% wins, the rest 40% to 59%): a fighter's blows grow
  // with the deep floors of a Hard Long Delve too, a little less than a spell.
  const DEEP_STEEL = 0.04;
  const deepSteel = () => (P().cls === 'fighter' && isLong() && G.depth >= 7 && G.opts.difficulty === 'hard' ? 1 + DEEP_STEEL * (G.depth - 6) : 1);
  /** A new floor's creatures, as sturdy as the difficulty makes them. @param {import('./types.js').Level} L */
  /**
   * What a floor's twist changes when it is first made (dungeon.js deals the
   * twists, and does the torches and the market itself): on a floor of the
   * restless dead, over half its ordinary creatures have risen as undead of
   * the depth, rolled afresh.
   * @param {import('./types.js').Level} L
   */
  function twistLevel(L, depth) {
    if (L.twist !== 'restless') return;
    const rng = new Rng(`${G.seed}|restless|${depth}`);
    const t = Dungeon.tierAt(depth, G.opts.levels || 8);
    const undead = Object.keys(MONSTERS).filter(id => MONSTERS[id].undead && !MONSTERS[id].boss && !MONSTERS[id].named && !MONSTERS[id].shade);
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
  function hardenLevel(L, depth) {
    const k = diff();
    for (const m of L.monsters) {
      // the first floor is where a hero learns: half the extra life there
      // the lich grows with the hero who comes for it: a tenth more life for every level past sixth
      // and the Pale One's bargain comes due on it: a third more
      const f = MONSTERS[m.id].boss ? k.lich * (1 + 0.1 * Math.max(0, P().level - 6)) * (bargained() ? 1.3 : 1) : (depth <= 1 ? 1 + (k.hp - 1) / 2 : k.hp) * longSturdier(depth) * shortNormal();
      m.maxHp = Math.max(1, Math.round(m.maxHp * f)); m.hp = m.maxHp;
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
      uid: 900000 + (G.nextUid = (G.nextUid || 0) + 1), id, x, y,
      hp, maxHp: hp, awake: true, nextAct: G.t + WAKE_BEAT, rx: x, ry: y,
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

  // ---------- main update ----------
  /** How ready the next blow is, from 0 just swung to 1 ready: the Attack button shows it. */
  function attackReady() {
    if (!G) return 1;
    const p = P(), left = p.nextAttack - G.t;
    return left <= 0 ? 1 : Math.max(0, 1 - left / weapon().speed);
  }
  function update(now, dt) {
    realNow = now;
    if (!G || G.status !== 'playing') return;
    G.t += dt;
    const p = P();
    fx.hpFrac = p.hp / p.maxHp;
    updateCam();
    if (queuedAttack && G.t >= p.nextAttack) { queuedAttack = false; attack(); }
    if (queuedMove && !(cam.moving && camProgress() < 0.7)) { const q = queuedMove; queuedMove = null; if (q.at <= G.t && G.t - q.at < 400) input(q.act); }
    updateMonsters();
    if (G.status !== 'playing') return;
    companion.turn();
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
    if (fx.bits.length) fx.bits = fx.bits.filter(b => now - b.born < b.life);
    if (fx.drops.length) fx.drops = fx.drops.filter(d => now - d.born < d.life);
  }
  function tick(now) { realNow = now; }

  /** @param {string} act @param {boolean} [repeat]  sent again because a button is still held, not a fresh press */
  function input(act, repeat) {
    if (!G || G.status !== 'playing') return;
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

  // ---------- render state ----------
  // Where each of up to five things on one square lies, in fractions of the
  // square from its middle. No two share a row or a column, so from whichever
  // side the square is seen they stand apart across the view: turned at an
  // angle, one could stand straight behind another and be hidden by it. Each
  // square gets its own quarter turn, which keeps that true.
  const SCATTER = [
    [[0, 0]],
    [[-0.18, -0.18], [0.18, 0.18]],
    [[-0.2, 0.05], [0.02, -0.2], [0.2, 0.2]],
    [[-0.22, -0.07], [-0.07, 0.22], [0.07, -0.22], [0.22, 0.07]],
    [[-0.24, 0], [-0.12, 0.24], [0, -0.24], [0.12, 0.12], [0.24, -0.12]],
  ];
  /**
   * What is about to hit you from somewhere you are not looking. The damage
   * flash only says where a blow came from after it lands; this says where
   * the next one is coming from before it does. Anything in front is already
   * on screen, so only flanks and rear are reported, nearest first.
   * @returns {Array<{rel: number, near: boolean}>}
   */
  function threats() {
    if (!G || G.status !== 'playing') return [];
    const p = P(), out = [];
    for (const m of lvl().monsters) {
      if (!m.awake || m.fleeing || m.collapsed) continue;
      const dx = m.x - p.x, dy = m.y - p.y, dist = Math.abs(dx) + Math.abs(dy);
      if (dist > 2) continue;
      // the side it is on: the longer axis, and a diagonal counts as the flank
      const ax = Math.abs(dx) >= Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
      let k = DIRS.findIndex(([x, y]) => x === ax[0] && y === ax[1]);
      let rel = (k - p.dir + 4) % 4;
      if (Math.abs(dx) === Math.abs(dy)) {
        // equal both ways: report whichever of the two sides is not straight ahead or behind
        const k2 = DIRS.findIndex(([x, y]) => x === 0 && y === Math.sign(dy));
        const r2 = (k2 - p.dir + 4) % 4;
        if (rel === 0 || rel === 2) rel = r2;
      }
      if (rel === 0) continue;
      // a blow drawn back at the hound is no warning of one at the hero
      const w = m.windup && m.windup.kind !== 'pet' ? m.windup : null;
      out.push({ rel, near: dist === 1, tell: !!(w || m.volley), special: !!(w && w.move) });
    }
    return out.sort((a, b) => Number(b.tell) - Number(a.tell) || Number(b.near) - Number(a.near));
  }
  // ---------- motion ----------
  // Monsters are still pictures; these give them a body. They breathe, hop a
  // little as they step, lean back as a blow is drawn and lunge as it lands,
  // recoil and squash when struck, and sink and fade when they fall. Only the
  // drawing moves: where a monster stands, and every rule, is unchanged.
  const CORPSE_MS = 520;
  function motion(m, now, i, tell) {
    const p = P(), mb = MONSTERS[m.id];
    const vx = p.x + 0.5 - (m.rx + 0.5), vy = p.y + 0.5 - (m.ry + 0.5), len = Math.hypot(vx, vy) || 1;
    const tx = vx / len, ty = vy / len;          // toward the hero
    let push = 0, lift = 0, sqx = 1, sqy = 1;
    if (!mb.fly) {
      const b = Math.sin(now / 520 + m.uid * 1.7 + i * 2.1) * 0.022;
      sqy += b; sqx -= b * 0.6;
    }
    if (m.moveT1 > now) {
      const t = (now - m.moveT0) / Math.max(1, m.moveT1 - m.moveT0);
      lift += Math.abs(Math.sin(t * Math.PI)) * 0.07;
    }
    if (tell > 0 && tell < 1) push -= 0.07 * tell;          // drawing back
    const lu = (now - (m.lungeAt || -1e9)) / 220;
    if (lu >= 0 && lu < 1) { push += Math.sin(lu * Math.PI) * 0.28; sqy *= 1 + 0.06 * Math.sin(lu * Math.PI); }
    const hu = now >= (m.flashAt || 0) ? (m.flashUntil - now) / 130 : 0;
    if (hu > 0) { push -= 0.1 * hu; sqx *= 1 + 0.12 * hu; sqy *= 1 - 0.1 * hu; }
    return { dx: tx * push, dy: ty * push, lift, sqx, sqy };
  }
  function renderState(now) {
    const L = lvl();
    const sprites = [];
    // a named champion awake and close carries its life along the top of the view, as the lich does
    const topNamed = namedBar(L);
    for (const m of L.monsters) {
      if (m.moveT1 > now) {
        const t = (now - m.moveT0) / (m.moveT1 - m.moveT0);
        m.rx = m.fromX + (m.x - m.fromX) * t; m.ry = m.fromY + (m.y - m.fromY) * t;
      } else { m.rx = m.x; m.ry = m.y; }
      const mb = MONSTERS[m.id];
      const bob = mb.fly ? Math.sin(now / 250 + m.uid) * 0.05 : 0;
      const base = Assets.sprites[mb.sprite];
      // a champion wears its colour: a prefix's, or a named one's own
      const tint = m.elite || (mb.named ? m.id : '');
      const img = (tint && base && base.elite && base.elite[tint]) ? base.elite[tint] : base;
      const n = packSize(m);
      // how far through its wind-up it is, for the tell drawn over it
      const tell = m.volley ? 1 : m.windup ? Math.min(1, Math.max(0.05, (G.t - m.windup.at) / Math.max(1, m.windup.until - m.windup.at))) : 0;
      // a monster's own trick is marked in violet, so it reads as more than a blow
      const special = !!(m.windup && m.windup.move);
      if (m.collapsed) {
        // a heap of bones on the floor, a ring round it filling as it pulls itself together
        const rising = Math.min(1, Math.max(0.02, 1 - (m.collapsed - G.t) / RISE_MS));
        sprites.push({ x: m.rx + 0.5, y: m.ry + 0.5, img: Assets.sprites.bone_heap || img, scale: mb.scale * 0.95, yOff: 0, flash: now >= (m.flashAt || 0) ? m.flashUntil : 0, heap: rising });
        continue;
      }
      if (n === 1) {
        const mo = motion(m, now, 0, tell);
        // the lich's life runs along the top of the view, so it carries no bar of its own
        sprites.push({ x: m.rx + 0.5 + mo.dx, y: m.ry + 0.5 + mo.dy, img, scale: mb.scale, yOff: (mb.fly || 0) + bob + mo.lift, sqx: mo.sqx, sqy: mo.sqy, flash: now >= (m.flashAt || 0) ? m.flashUntil : 0, hp: mb.boss || m === topNamed ? null : (now < (m.flashAt || 0) && m.hpShown > 0 ? m.hpShown : m.hp), maxHp: m.maxHp, tell, special, boss: !!mb.boss || m === topNamed,
          // wrapped in shadow, it shows faint and flickering; a shade is never quite there
          ...(m.wardUntil > G.t ? { alpha: 0.45 + 0.2 * Math.sin(now / 70) } : m.shade ? { alpha: 0.8 + 0.08 * Math.sin(now / 400 + m.uid) } : {}) });
        continue;
      }
      // a group stands abreast across your view: the front one a little
      // nearer and carrying the health bar, the rest at its shoulders
      const ax = Math.cos(cam.angle), ay = Math.sin(cam.angle), sx = -ay, sy = ax;
      const spots = n === 2 ? [[0.17, -0.06], [-0.2, 0.06]] : [[0, -0.1], [0.27, 0.05], [-0.27, 0.07]];
      spots.slice(0, n).forEach(([side, back], i) => {
        const b2 = mb.fly ? Math.sin(now / 250 + m.uid + i * 1.7) * 0.05 : 0;
        const mo = motion(m, now, i, i === 0 ? tell : 0);
        sprites.push({ x: m.rx + 0.5 + sx * side + ax * back + mo.dx, y: m.ry + 0.5 + sy * side + ay * back + mo.dy, img, scale: mb.scale * 0.88, yOff: (mb.fly || 0) + b2 + mo.lift, sqx: mo.sqx, sqy: mo.sqy,
          flash: i === 0 && now >= (m.flashAt || 0) ? m.flashUntil : 0, ...(i === 0 ? { hp: now < (m.flashAt || 0) && m.hpShown > 0 ? m.hpShown : m.hp, maxHp: m.maxHp, tell } : {}) });
      });
    }
    // what lies about the room for looks, and what the fallen left (puddles are drawn flat by the renderer)
    for (const d of (L.dressing || [])) {
      if (d.k !== 'puddle' && Assets.sprites['dress_' + d.k]) sprites.push({ x: d.x + 0.5 + d.ox, y: d.y + 0.5 + d.oy, img: Assets.sprites['dress_' + d.k], scale: DRESS_SIZE[d.k] || 0.34, yOff: 0, onFloor: true, dress: true });
    }
    for (const r of (L.remains || [])) {
      // shown once the body has sunk out of sight over it
      if (r.until > G.t && G.t - (r.at || 0) > 450 && Assets.sprites['dress_' + r.k]) sprites.push({ x: r.x, y: r.y, img: Assets.sprites['dress_' + r.k], scale: DRESS_SIZE[r.k] || 0.3, yOff: 0, onFloor: true });
    }
    { const hs = companion.sprite(Assets, now); if (hs) sprites.push(hs); }
    for (const n of (L.npcs || [])) {
      const look = n.kind === 'encounter' ? ENCOUNTERS[n.id] : null;
      // the trader is one of the Lampfolk, or at a goblin market a goblin pedlar
      const who = look ? look.sprite : traderKind() === 'pedlar' ? 'pedlar' : 'merchant';
      sprites.push({ x: n.x + 0.5, y: n.y + 0.5, img: Assets.sprites[who] || Assets.sprites.merchant, scale: look ? 0.85 : 0.95, yOff: 0 });
    }
    for (const k in L.items) {
      const list = L.items[k];
      if (!list.length) continue;
      const [x, y] = k.split(',').map(Number);
      // what lies on a square is scattered across it, each thing where it fell,
      // rather than one picture standing for the lot: the newest five show
      const shown = list.slice(-SCATTER.length), spots = SCATTER[shown.length - 1];
      const turn = (((x * 73856093) ^ (y * 19349663)) >>> 0) % 4 * Math.PI / 2, c = Math.round(Math.cos(turn)), sn = Math.round(Math.sin(turn));
      shown.forEach((it, i) => {
        const [ox, oy] = spots[i];
        // the Heart floats; a relic hovers a little, so it reads as more than iron
        const floats = it.t === 'artifact' || !!it.u;
        const size = it.t === 'artifact' ? 0.4 : (it.u ? 0.38 : 0.32) * (shown.length > 1 ? 0.85 : 1);
        sprites.push({ x: x + 0.5 + ox * c - oy * sn, y: y + 0.5 + ox * sn + oy * c, img: Assets.sprites[spriteFor(it)], scale: size, yOff: floats ? 0.04 + Math.sin(now / 300 + i) * 0.03 : 0, onFloor: true });
      });
    }
    // the fallen: knocked back, sinking into a heap and fading
    for (const c of fx.corpses) {
      const art = Assets.sprites[c.sprite];
      if (!art) continue;
      // one killed by a fireball still in the air stands until it lands
      const u = Math.max(0, Math.min(1, (now - c.born) / CORPSE_MS));
      const back = Math.sin(Math.min(1, u * 1.6) * Math.PI / 2) * 0.18;
      sprites.push({ x: c.x + c.dx * back, y: c.y + c.dy * back, img: (c.elite && art.elite && art.elite[c.elite]) || art, scale: c.scale, yOff: c.fly * (1 - u),
        sqx: 1 + 0.3 * u, sqy: Math.max(0.12, 1 - 0.85 * u * u), alpha: 1 - u * u, flash: now >= c.born && u < 0.15 ? now + 1 : 0 });
    }
    // what the hero holds, for the view at the bottom of the screen
    const p = P(), wIt = p.eq.weapon;
    // the lich's life across the top of the view, once it has woken and spoken
    const boss = L.monsters.find(m => MONSTERS[m.id].boss && m.spoke && m.awake && !m.collapsed);
    const rite = boss && boss.windup && boss.windup.move === 'rite' ? boss.windup : null;
    fx.boss = boss ? { name: MONSTERS[boss.id].name, hp: boss.hp, maxHp: boss.maxHp, phase: boss.phase || 0, rite: !!rite,
      riteDone: rite ? Math.min(1, Math.max(0, (G.t - rite.at) / Math.max(1, rite.until - rite.at))) : 0 } : null;
    // else a named champion's, its name in full and marked where its fight turns, if it does
    if (!boss && topNamed) {
      const nb = MONSTERS[topNamed.id], sh = topNamed.shade;
      fx.boss = { name: sh ? `Shade of ${heroTitle(sh.name, sh.cls)}` : namedTitle(nb), hp: now < (topNamed.flashAt || 0) && topNamed.hpShown > 0 ? topNamed.hpShown : topNamed.hp, maxHp: topNamed.maxHp,
        phase: 0, rite: false, riteDone: 0, named: true, notches: nb.move === 'rally' ? [1 / 2] : [] };
    }
    // what ails or aids the hero, tinted over the view
    fx.status = { poison: !!p.poison, held: (p.held || 0) > G.t, webbed: (p.webbed || 0) > G.t, grabbed: !!p.grabbed,
      ac: !!effect('ac'), hit: !!effect('hit'), might: !!effect('might'), starving: p.food === 0 };
    fx.view = {
      weapon: wIt ? spriteFor(wIt) : null, two: !!(wIt && ITEMS[wIt.t].twoHanded), drawn: !!(wIt && ['shortbow', 'longbow'].includes(ITEMS[wIt.t].sprite)),
      shield: p.eq.shield ? spriteFor(p.eq.shield) : null, offhand: p.eq.offhand ? spriteFor(p.eq.offhand) : null,
      cls: p.cls, walk: cam.moving ? camProgress() : 0, steps: p.steps,
    };
    fx.threats = threats();
    return { level: L, cam, sprites, fx };
  }

  // ---------- save / load ----------
  function save(auto) {
    if (!G || G.status !== 'playing') return false;
    for (const d in G.levels) pruneRemains(G.levels[d]);
    // how far along its run this is, by the game's own clock, which stands
    // still while the page is put away: a save made switching apps is no further
    if (G.opts.permadeath) noteRun(runKey(), G.t);
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(G));
      if (!auto) log('Game saved.', 'info');
      return true;
    } catch (e) {
      log('Could not save: ' + e.message, 'bad');
      return false;
    }
  }
  function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
  function load() {
    queuedAttack = false;
    let s = null;
    try { s = localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
    if (!s) return false;
    // a save that cannot be read leaves the game that was running as it was
    const before = G;
    try {
      const data = JSON.parse(s);
      if (!data || !data.player || !data.levels) return false;
      G = data;
      // an encounter left open belonged to the game that was running, not the one loaded
      encounter = null;
      G.status = 'playing';
      G.forkPending = false;   // saved with the divided stair's question open: it is asked again at the stair
      for (const dpt in G.levels) {
        if (!G.levels[dpt].features) G.levels[dpt].features = {};
        if (!G.levels[dpt].lights) G.levels[dpt].lights = [];
        if (!G.levels[dpt].npcs) G.levels[dpt].npcs = [];
        // a floor saved before there was dressing gets some now (what was already
        // taken or dropped there is kept clear, so it may differ from a new floor's)
        // (and never under the hero's feet, wherever they stood when it was saved)
        if (!G.levels[dpt].dressing) {
          const hereNow = Number(dpt) === G.depth ? G.player : null;
          G.levels[dpt].dressing = Dungeon.dress(G.levels[dpt], G.seed).filter(d => !(hereNow && d.x === hereNow.x && d.y === hereNow.y));
        }
        stepAside(G.levels[dpt]);
      }
      // a run saved on the climb out, from when the Heart had to be carried to
      // the surface, is won: the Heart was already in hand
      const wasEscaping = !!G.escaping;
      for (const k of ['escaping', 'escapeStart', 'nextHunt', 'hunts', 'escapeMs']) delete G[k];
      if (!G.journal) G.journal = [];
      if (G.logSeq == null) G.logSeq = G.log ? G.log.length : 0;
      if (G.player.eq.offhand === undefined) G.player.eq.offhand = null;
      // a run from before rings and amulets: the slots, and a look for each
      for (const s of [...JEWEL_SLOTS, 'cloak']) if (G.player.eq[s] === undefined) G.player.eq[s] = null;
      // A focus's make never counted for armour; older saves may still carry one.
      for (const it of [...G.player.inv, G.player.eq.shield]) if (it && ITEMS[it.t]?.focus) it.e = 0;
      refreshSp(G.player);   // spell points by today's rules, robes and all, not the rules it was saved under
      // a hero from before paths is offered one at their next level; one who
      // has no next level to reach is offered it now
      if (G.player.level >= MAX_LEVEL && G.player.level >= PATH_LEVEL && !G.player.path) offerPath();
      if (G.looks) { const all = buildLooks(G.seed); for (const id in all) if (!G.looks[id]) G.looks[id] = all[id]; }
      if (!G.pendingBoons) G.pendingBoons = [];
      // a save without the counter for monsters that arrive mid-run would start it
      // again and hand a newcomer the number of one already here: grips, openings
      // and mends find a monster by its number, so two alike take each other's
      if (G.nextUid == null) {
        let most = 0;
        for (const dpt in G.levels) for (const m of G.levels[dpt].monsters || []) if (m.uid >= 900000) most = Math.max(most, m.uid - 900000);
        G.nextUid = most;
      }
      if (!G.player.bg) G.player.bg = 'oathbroken';
      if (!G.looks) G.looks = buildLooks(G.seed);
      // a run from before relics finds them on the floors it has yet to see
      if (!G.relics) G.relics = { ...relicPlan(G.seed, G.player.cls, G.opts.levels), offered: 0, found: [] };
      for (const id of G.relics.found) Progress.noteRelic(id);   // a run from before the codex adds what it found
      // a run from before the end screen kept its numbers counts from here on
      G.stats = { ...freshStats(), ...G.stats };
      if (!G.known) { G.known = {}; for (const id in ITEMS) G.known[id] = 1; }
      // a line held for its moment by the old page's clock would never show on this one
      for (const e of G.log || []) delete e.at;
      for (const dpt in G.levels) for (const m of G.levels[dpt].monsters) {
        // a moment's grace for anything about to act, but a foe held longer (snared,
        // staggered by a bash, frozen, coughing) stays held as long as it was
        m.nextAct = Math.max(m.nextAct || 0, G.t + 800); m.rx = m.x; m.ry = m.y; m.moveT1 = 0; m.flashUntil = 0; m.volley = null;
        // the page's clock starts again at nothing: a flash or a held life bar timed by the old one would hang on for good
        m.flashAt = 0; delete m.hpShown;
        // a blow being drawn back is still coming after a reload, or quitting to the
        // title would be a way out of every warned crush: it keeps its warning, and
        // the same moment's grace as everything else
        if (m.windup) { m.windup.at += 800; m.windup.until += 800; m.nextAct = m.windup.until; }
      }
      lastBlocked = -1e9; queuedAttack = false; queuedMove = null;
      companion.loaded();
      snapCam();
      distFieldAt = -1e9;
      clearFx();
      log('Game loaded.', 'info');
      // a hero who died and was loaded again lives: they are no longer below to be
      // met (a second death remembers them afresh)
      const fell = Progress.fallen();
      if (fell && fell.run === runKey()) Progress.layToRest(fell.run);
      emit('level');
      // the clock only runs on the game screen, and a load can come before it has
      if (wasEscaping) { realNow = performance.now(); fx.heartAt = realNow; win(); }
      return true;
    } catch (e) { G = before; return false; }
  }
  // ---------- save codes ----------
  // A permadeath run cannot be taken back with a code: this device remembers
  // how far along each such run it has saved, and which have ended, and will
  // not load a code for one that is over or older than what it has played.
  // (Another device knows nothing of it: the guard is this device's own.)
  const RUNS_KEY = 'deepdelve.runs';
  /** @returns {Record<string, number|'ended'>} */
  function runsSeen() { try { return JSON.parse(localStorage.getItem(RUNS_KEY) || '{}') || {}; } catch (e) { return {}; } }
  function noteRun(key, v) {
    try {
      const all = runsSeen();
      if (all[key] === 'ended' || (typeof all[key] === 'number' && typeof v === 'number' && v < all[key])) return;
      delete all[key]; all[key] = v;
      // the oldest runs are let go: only the last few dozen can still be in anyone's hands
      const keys = Object.keys(all);
      for (const k of keys.slice(0, Math.max(0, keys.length - 60))) delete all[k];
      localStorage.setItem(RUNS_KEY, JSON.stringify(all));
    } catch (e) { /* private browsing */ }
  }
  /** The running hero as a code to carry to another device (saved first, so it is now). */
  async function saveCode() {
    if (!save(true)) return null;
    return encodeSave(JSON.stringify(G));
  }
  /** Take up the hero a code holds, in place of any saved here. @returns {Promise<{ok: boolean, why?: string}>} */
  async function loadCode(text) {
    let data;
    try { data = JSON.parse(await decodeSave(text)); } catch (e) { return { ok: false, why: e instanceof SyntaxError ? 'That code is not whole: it may have been cut short when it was copied.' : e.message }; }
    if (!data || !data.player || !data.levels || !CLASSES[data.player.cls]) return { ok: false, why: 'That code does not hold a hero.' };
    // a code comes from somewhere else: what the page writes out as markup is
    // made safe first (a log line's class, the numbers the Hall shows)
    for (const e of Array.isArray(data.log) ? data.log : []) if (e && !['good', 'bad', 'info'].includes(e.c)) e.c = '';
    for (const k of ['hp', 'maxHp', 'sp', 'maxSp', 'level', 'xp', 'gold', 'kills', 'deepest']) if (k in data.player) data.player[k] = Number(data.player[k]) || 0;
    data.depth = Number(data.depth) || 1; data.t = Number(data.t) || 0;
    const key = runKeyOf(data), seen = runsSeen()[key];
    if (data.opts && data.opts.permadeath) {
      if (seen === 'ended') return { ok: false, why: `${data.player.name}'s delve has already ended on this device, and a permadeath run cannot be taken back.` };
      if (typeof seen === 'number' && (Number(data.t) || 0) < seen) return { ok: false, why: `This device has already played ${data.player.name} further than this code, and a permadeath run cannot be taken back.` };
    }
    let before = null;
    try { before = localStorage.getItem(SAVE_KEY); localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { return { ok: false, why: 'This browser will not keep a saved game.' }; }
    if (!load()) {
      try { if (before) localStorage.setItem(SAVE_KEY, before); else localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
      return { ok: false, why: 'That code would not load.' };
    }
    if (G.opts.permadeath) noteRun(key, G.t);
    return { ok: true };
  }
  function saveSummary() {
    try {
      const s = localStorage.getItem(SAVE_KEY);
      if (!s) return null;
      const g = JSON.parse(s);
      return { name: g.player.name, cls: CLASSES[g.player.cls].name, level: g.player.level, depth: g.depth, seed: g.seed, daily: (g.opts && g.opts.daily) || '' };
    } catch (e) { return null; }
  }

  // ---------- monsters ---------- to how hard the delve is: see foes.js ----------
  // What that module borrows from here goes through these getters (and setters
  // for the state it changes), so it always sees the game as it is now.
  const foesK = {
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
    get castingName() { return castingName; },
    get assassinQuiet() { return assassinQuiet; },
    get elemental() { return elemental; },
    get followBlow() { return followBlow; },
    get shadeWakes() { return shadeWakes; },
    get tricksterOpening() { return tricksterOpening; },
    get diff() { return diff; },
    get distField() { return distField; }, set distField(v) { distField = v; },
    // the hero's hound: where it stands, and what a blow at it or the quills do
    get companionAt() { return companion.at; }, get companionStruck() { return companion.struck; }, get companionHurt() { return companion.hurt; }, get houndNoisy() { return companion.noisy; },
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
    get knightSteadfast() { return knightSteadfast; },
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
    get BELT() { return BELT; },
    get G() { return G; },
    P, lvl, log, emit, the, cap, itemName, relicOf, mod, hasTalent, isJewel, isKnown, vouched, vowed, hiddenGear, cursedWorn,
    revealAll, breakCurses, healPlayer, spMax, beltRoom, giveItem, removeOne, discoverRelic, junkInPack,
  };
  const { charm, buyPrice, sellPrice, shopServices, buyService, openShop, currentShop, closeShop, buy, sell, sellJunk, traderKind, traderName, priceNotes } = makeTrader(traderK);
  const { RISE_MS, WAKE_BEAT, updateMonsters, bossFalls, breaksBones, burnWeb, ensureDist, moveMonster, moveOnHurt, namedArrives, namedBar, namedFalls, namedTitle, poisonFor, wander } = makeFoes(foesK);
  // ---------- the hero's hound: see companion.js ----------
  const companion = makeCompanion({
    get G() { return G; }, get P() { return P; }, get DIRS() { return DIRS; }, get lvl() { return lvl; }, get log() { return log; },
    get passable() { return passable; }, get monsterAt() { return monsterAt; }, get npcAt() { return npcAt; }, get propAt() { return propAt; }, get mstat() { return mstat; },
    get damageMonster() { return damageMonster; }, get ensureDist() { return ensureDist; }, get distField() { return distField; },
    get heard() { return heard; }, get realNow() { return realNow; },
  });

  return {
    newGame, load, save, hasSave, saveSummary, saveCode, loadCode, rollStats, hall, earned: () => (G && G.earned) || null,
    companion: () => (G && G.companion) || null, companionNote: () => companion.note(),
    update, tick, input, renderState, takeEvents, quickScroll, vitals,
    state: () => G, player: P, level: lvl, log, mod,
    descend, chooseRoute, leaveFork, forkPending: () => !!(G && G.forkPending), route: () => (G && G.route) || null, routeSpan: () => (G ? Dungeon.routeSpan(G.opts.levels || 8) : null), giveItem, sneakMult, setWorn, threadNotes, uselessToClass, junkInPack, sellJunk, pressSturdier, qualityHidden, focusOf, itemName, relicOf, hasPower, spriteFor, equip, unequip, useItem, dropItem, takeItem, floorItems, canEquip, isKnown, mstat,
    offhandReason, offhandWeapon, canDualWield, rollsShown, toggleRolls, useLabel, stairsBeside,
    statCheck, checkChance, checkBonus, charm, study, studyReason, STUDY_DC,
    currentEncounter: () => encounter, encounterOptions, chooseEncounter, closeEncounter,
    pendingLevel, levelNote, currentShop, closeShop, buy, sell, buyPrice, sellPrice, shopServices, buyService, traderName, priceNotes,
    pendingBoons, chooseBoon, isPathOffer, pathOf, spellCost, spellDesc, berserkerRage, blowRate, epilogue, journal: () => (G && G.journal) || [], pagesInDungeon,
    bestiary, runStats, lastAttacker: () => (G && G.lastAttacker) || null, deathLog: () => (G && G.deathLog) || [],
    knownSpells, spellAvailable, spellLevel, castSpell, rest, toHit, playerAC, weapon, effect, skillDamage, critFloor,
    wasteReason, spellWasteReason, attackReady, castLabel, vowed, abilityOf, abilityLeft, useAbility, score, finaleLeft, restLabel,
    /** The lich is awake and fighting: the drone under the dungeon tightens. */
    bossAwake: () => !!(G && G.status === 'playing' && lvl().monsters.some(m => MONSTERS[m.id].boss && m.spoke && m.awake)),
    mood,
    INV_MAX, T,
  };
})();

export { Game };
