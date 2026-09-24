import { Rng, Dice, d } from './rng.js';
import { BACKGROUNDS, JOURNAL, BOONS, XP_TABLE, MAX_LEVEL, CLASSES, ITEMS, TRAP_TYPES, MONSTERS, SPELLS, POTION_LOOKS, SCROLL_LOOKS, ELITES, THEMES, BESTIARY, TALENTS } from './data.js';
import { Assets } from './assets.js';
import { Dungeon } from './dungeon.js';
import { ENCOUNTERS, encounterDc } from './encounters.js';
import { RELICS, GIANTS, POWER_SUFFIX, relicPlan } from './relics.js';
import { Sound } from './sound.js';

// Core game state and rules.

const Game = (() => {
  const T = Dungeon.T;
  const DIRS = Dungeon.DIRS;
  const INV_MAX = 20;
  const SAVE_KEY = 'deepdelve.save';
  const HALL_KEY = 'deepdelve.hall';
  const MOVE_MS = 220;
  const TURN_MS = 200;

  /** @type {import('./types.js').GameState|null} */
  let G = null;
  let distField = null, distFieldAt = -1e9;
  let realNow = 0;
  const fx = { damageUntil: 0, healUntil: 0, swingUntil: 0, castUntil: 0, shakeUntil: 0,
               hurtFrom: -1, hurtFromUntil: 0, castColor: '#fff', texts: [], hpFrac: 1,
               /** @type {Array<{style: string, color: string, born: number, until: number, pts: Array<{x: number, y: number}>, ahead?: {x: number, y: number}}>} */ spells: [],
               swingAt: -1e9, swingMs: 300, offAt: -1e9, castAt: -1e9,
               /** the fallen, sinking and fading where they fell */
               /** @type {Array<{x: number, y: number, sprite: string, elite?: string, scale: number, born: number, dx: number, dy: number, fly: number}>} */ corpses: [],
               /** what blows throw: droplets, bone chips, sparks, flying and falling */
               /** @type {Array<{x: number, y: number, z: number, vx: number, vy: number, vz: number, g: number, c: string, born: number, life: number, size: number, glow?: boolean}>} */ bits: [],
               /** stains on the floor, by depth; for the look of a fight, not saved */
               /** @type {Record<number, Array<{x: number, y: number, r: number, c: string, seed: number}>>} */ stains: {},
               /** blood on the hero's own view, after a hard blow */
               /** @type {Array<{x: number, y: number, r: number, born: number, life: number}>} */ drops: [],
               shakeAmp: 4, shakeMs: 220, hurtAmt: 0.5,
               /** when the Heart was lifted, for the light that ends the run; -1 before */
               heartAt: -1,
               /** @type {any} */ status: null,
               /** @type {{name: string, hp: number, maxHp: number, phase: number, rite: boolean}|null} */ boss: null,
               /** @type {any} */ view: null };
  /** Forget the look of the last fight: a new run or a loaded save starts clean. */
  function clearFx() {
    fx.texts = []; fx.spells = []; fx.corpses = []; fx.bits = []; fx.stains = {}; fx.drops = []; fx.heartAt = -1;
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

  // ---------- the dice, in the open ----------
  // On unless turned off: the classic crawlers showed their arithmetic, and
  // it is how you learn that the thing in front of you is armoured, or that
  // your own armour has stopped keeping up with what hits you. Kept out of the
  // save file: it is a preference, not a run.
  let showRolls = true;
  try { showRolls = localStorage.getItem('deepdelve.rolls') !== 'off'; } catch (e) { /* ignore */ }
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
  function statCheck(stat, dc, bonus = 0) {
    const roll = d(1, 20), m = checkBonus(stat, bonus);
    const pass = roll === 20 || (roll !== 1 && roll + m >= dc);
    return { stat, dc, roll, mod: m, pass, note: checkNote(stat, roll, m, dc) };
  }

  // ---------- messages ----------
  // The log is capped, so once it is full its length stops changing. Anything
  // watching for new messages has to count them, not measure the array.
  function log(m, c) {
    G.log.push({ m, c: c || '' });
    G.logSeq = (G.logSeq || 0) + 1;
    if (G.log.length > 80) G.log.splice(0, G.log.length - 80);
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
  function spMax(p) {
    const c = CLASSES[p.cls];
    if (!c.spells) return 0;
    const stat = p.stats[c.primary];
    // the armoured cleric holds fewer prayers; the unarmoured mage runs deep
    const mul = c.spMul || 1;
    return Math.max(4, Math.round(p.level * (2.4 + mod(stat)) * mul)) + 3 + (p.bonusSp || 0)
      + (hasPower('mind', null, p) ? 6 : 0);
  }
  // Practice tells: a veteran swings faster and puts more behind it. Without this
  // the player's damage is flat for the whole game while monster hit points grow.
  function skillSpeed() {
    const p = P();
    const rate = p.cls === 'thief' ? 0.062 : 0.045;   // thieves gain speed fastest
    const cap = (p.cls === 'thief' ? 0.55 : 0.42) + (p.perkSpeed || 0);
    return 1 - Math.min(cap, (p.level - 1) * rate + (p.perkSpeed || 0));
  }
  /** Riposte: a blow that misses you readies your next swing at once. */
  function riposte() {
    const p = P();
    if (!hasTalent('riposte')) return;
    if (!(p.riposteUntil > G.t)) log('Riposte: you see an opening!', 'good');
    p.nextAttack = Math.min(p.nextAttack, G.t);
    p.riposteUntil = G.t + 2500;
  }
  /** Whether the hero has taken this class talent. */
  const hasTalent = id => !!(P().talents && P().talents.includes(id));
  // the roll at or above which an attack is a critical hit
  function critFloor() {
    const p = P();
    const base = p.cls !== 'thief' ? 20 : (p.level >= 9 ? 18 : 19);
    return base - (hasPower('keen', 'weapon') ? 1 : 0) - (hasTalent('lucky') ? 1 : 0);
  }
  function skillDamage() { return Math.floor((P().level - 1) / 3); }
  function weapon() {
    const p = P();
    const spd = skillSpeed() * (p.eq.offhand ? DUAL_SWING_COST : 1);
    if (!p.eq.weapon) return { name: 'fists', dmg: [1, 2, 0], speed: Math.round(450 * spd), e: 0, range: 0, blunt: true };
    const b = ITEMS[p.eq.weapon.t];
    const swift = hasPower('swift', 'weapon') ? 0.85 : 1;
    return { name: b.name, dmg: b.dmg, speed: Math.round(b.speed * spd * swift), e: p.eq.weapon.e || 0, twoHanded: !!b.twoHanded, range: b.range || 0, blunt: !!b.blunt };
  }
  // Two blades means neither hand swings clean, so the main hand loses rhythm.
  const DUAL_SWING_COST = 1.15;
  const DUAL_HIT_PENALTY = 3;
  const OFFHAND_MAX_SPEED = 550;   // dagger, club, short sword: nothing heavier
  /** Why this cannot ride in the off hand, or null if it can. */
  function offhandReason(it) {
    const p = P(), b = ITEMS[it.t];
    if (!b || b.kind !== 'weapon') return 'That is not a weapon.';
    if (!CLASSES[p.cls].dualWield) return `${CLASSES[p.cls].plural} fight with one blade.`;
    if (!b.cls.includes(p.cls)) return `${CLASSES[p.cls].plural} cannot wield a ${b.name.toLowerCase()}.`;
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
    return { name: b.name, dmg: b.dmg, e: p.eq.offhand.e || 0, blunt: !!b.blunt };
  }
  /** Whether an effect is on, and was put there by this spell (not a shrine's blessing). */
  function effectFrom(name, spell) { const e = P().effects[name]; return !!(e && e.until > G.t && e.src === spell); }
  function effect(name) {
    const e = P().effects[name];
    return e && e.until > G.t ? e.amount : 0;
  }

  // ---------- relics ----------
  // Named gear (see relics.js). A striking power belongs to the blade that
  // strikes, so it is asked of one slot; the rest work from anywhere worn.
  const relicOf = it => (it && it.u && RELICS[it.u]) || null;
  function hasPower(power, slot, p = P()) {
    const slots = slot ? [slot] : ['weapon', 'offhand', 'armor', 'shield'];
    // a relic's powers, or the one power an ordinary piece was made with
    return slots.some(s => { const it = p.eq[s], r = relicOf(it); return (!!r && r.powers.includes(power)) || (!!it && it.pw === power); });
  }
  /** Extra damage a bane deals to the monster it was made for. */
  function baneDamage(m, slot) {
    let n = 0;
    if (hasPower('undead', slot) && mstat(m).undead) n += d(1, 6);
    if (hasPower('giant', slot) && GIANTS.includes(m.id)) n += d(1, 8);
    if (hasPower('flame', slot)) n += d(1, 4);
    if (hasTalent('sanctified') && mstat(m).undead) n += d(1, 4);
    return n;
  }
  function leech(dmg, slot) {
    const p = P();
    if (!hasPower('leech', slot) || p.hp >= p.maxHp) return;
    p.hp = Math.min(p.maxHp, p.hp + Math.max(1, Math.floor(dmg / 5)));
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
    log(RELICS[id].lore, 'info');
  }
  // ---------- curses ----------
  // Found gear keeps its quality to itself (h) until it is worn, studied or
  // appraised, and a cursed piece will not come off once worn until the
  // curse is broken. A cursed thing in the pack does no harm: it only binds.
  const isGear = it => { const b = ITEMS[it.t]; return !!b && (b.kind === 'weapon' || b.kind === 'armor' || b.kind === 'shield'); };
  const bound = it => !!(it && it.curse);
  const cap = str => str[0].toUpperCase() + str.slice(1);
  /** Everything carried or worn whose quality is still hidden. */
  const hiddenGear = () => [...P().inv, ...Object.values(P().eq)].filter(it => it && it.h);
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
  /** What the trader charges to look your gear over, and to break a curse. */
  function shopServices() {
    if (!shop) return [];
    const hidden = hiddenGear(), cursed = cursedWorn();
    const deep = G.depth;
    return [
      { id: 'appraise', label: 'Appraise your gear', detail: hidden.length ? `${hidden.length} piece${hidden.length > 1 ? 's' : ''} of unknown quality` : 'You know the quality of everything you carry',
        price: Math.round((8 + 4 * deep) * Math.max(1, hidden.length) * (1 - charm())), why: hidden.length ? null : 'Nothing you carry is unknown.' },
      { id: 'uncurse', label: 'Lift a curse', detail: cursed.length ? `Free you of ${cursed.map(it => the(it)).join(' and ')}` : 'Nothing you wear is cursed',
        price: Math.round((40 + 20 * deep) * Math.max(1, cursed.length) * (1 - charm())), why: cursed.length ? null : 'Nothing you wear is cursed.' },
    ];
  }
  function buyService(id) {
    const s = shopServices().find(x => x.id === id);
    if (!s) return false;
    if (s.why) { log(s.why); return false; }
    const p = P();
    if (p.gold < s.price) { log('You cannot afford that.', 'bad'); Sound.play('error'); return false; }
    p.gold -= s.price;
    if (id === 'appraise') {
      const seen = revealAll();
      log(`The trader turns each piece to the lantern: ${seen.map(it => itemName(it) + (it.curse ? ' (cursed)' : '')).join(', ')}.`, 'info');
    } else {
      const n = breakCurses();
      log(`The trader mutters, spits, and pulls. ${n > 1 ? 'The cursed things come' : 'The cursed thing comes'} away in your hand.`, 'good');
    }
    Sound.play('gold');
    emit('inv'); emit('stats');
    return true;
  }
  /**
   * Lay this floor's relic on the pile furthest from the way in, which is
   * often a vault's reward, and let a trader here keep the next one behind
   * the counter. Runs once, when the floor is first generated.
   */
  function placeRelics(L, depth) {
    const R = G.relics;
    if (!R) return;
    const id = R.floor[depth];
    if (id) {
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
        if (dd > bd && !L.items[k].some(it => it.t === 'artifact')) { bd = dd; best = k; }
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
    const trader = (L.npcs || []).find(n => n.kind !== 'encounter' && n.stock);
    if (trader && depth >= 2 && R.offered < R.shop.length) trader.stock.push(relicItem(R.shop[R.offered++]));
  }
  function toHit() {
    const p = P();
    return Math.floor(p.level * cls().hitProg) + mod(p.stats.str) + effect('hit') + weapon().e
      + (p.perkHit || 0) + (effect('might') ? 2 : 0);
  }
  function playerAC() {
    const p = P();
    let ac = 10 + mod(p.stats.dex) + effect('ac');
    // thieves stay alive by not being where the blow lands
    if (p.cls === 'thief') ac += Math.floor((p.level + 2) / 3);
    if (p.eq.armor) ac += ITEMS[p.eq.armor.t].ac + (p.eq.armor.e || 0);
    if (p.eq.shield) ac += ITEMS[p.eq.shield.t].ac + (p.eq.shield.e || 0) + (hasTalent('bulwark') ? 2 : 0);
    return ac;
  }
  function knownSpells() {
    const c = cls();
    if (!c.spells) return [];
    return SPELLS[c.spells];
  }
  function spellAvailable(sp) { return P().level >= sp.lvl * 2 - 1; }

  // Effective monster stats, including any champion bonuses.
  /** A champion with no matching prefix behaves exactly like its plain kind. */
  const NO_ELITE = { prefix: '', hp: 1, ac: 0, hit: 0, dmg: 0, xp: 1, speed: 1, tint: '#fff' };
  function mstat(m) {
    const b = MONSTERS[m.id];
    // a boss changes as it weakens: each phase lends it new ways to fight
    if (b.phases && m.phase) return { ...b, ...b.phases[Math.min(m.phase, b.phases.length) - 1] };
    if (!m.elite) return b;
    const e = ELITES.find(x => x.prefix === m.elite) || NO_ELITE;
    return {
      name: `${m.elite} ${b.name}`, ac: b.ac + (e.ac || 0), hit: b.hit + (e.hit || 0),
      dmg: [b.dmg[0], b.dmg[1], b.dmg[2] + (e.dmg || 0)],
      speed: Math.round(b.speed * (e.speed || 1)), xp: Math.round(b.xp * (e.xp || 1)),
      sprite: b.sprite, scale: b.scale, undead: b.undead, poison: b.poison, fly: b.fly,
      regen: b.regen, boss: b.boss, drain: b.drain, ranged: b.ranged, move: b.move,
    };
  }

  // ---------- items ----------
  function itemName(it) {
    const r = relicOf(it);
    if (r) return r.name[0].toUpperCase() + r.name.slice(1);
    if (it.t === 'key') return `${it.color[0].toUpperCase() + it.color.slice(1)} Key`;
    if (it.t === 'gem') return it.name || 'Gem';
    const b = ITEMS[it.t];
    let n = b.name;
    if (!isKnown(it.t)) {
      const look = G.looks[it.t];
      n = b.kind === 'potion' ? `${look.adj[0].toUpperCase() + look.adj.slice(1)} Potion` : `${look.adj[0].toUpperCase() + look.adj.slice(1)} Scroll`;
    }
    if (it.e && !it.h) n += it.e > 0 ? ` +${it.e}` : ` −${-it.e}`;
    // a power is part of what studying or wearing a piece tells you
    if (it.pw && !it.h) n += ` ${POWER_SUFFIX[it.pw] || ''}`;
    if (it.q > 1) n += ` ×${it.q}`;
    return n;
  }
  function spriteFor(it) {
    if (it.t === 'key') return 'key_' + it.color;
    if (it.u && Assets.sprites['relic_' + ITEMS[it.t].sprite]) return 'relic_' + ITEMS[it.t].sprite;
    if (!isKnown(it.t)) return G.looks[it.t].sprite;
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
    if (b.stack) {
      const ex = p.inv.find(x => x.t === it.t);
      if (ex) { ex.q += it.q || 1; return true; }
    }
    if (p.inv.length >= INV_MAX) return false;
    p.inv.push({ t: it.t, q: it.q || 1, e: it.e || 0, color: it.color, name: it.name, ...(it.u ? { u: it.u } : {}), ...(it.pw ? { pw: it.pw } : {}),
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
    if (b.kind === 'weapon') return b.cls.includes(p.cls) ? null : `${c.plural} cannot wield a ${b.name.toLowerCase()}.`;
    if (b.kind === 'armor') {
      if (c.armor === 'none') return `${c.plural} cannot wear armor.`;
      if (c.armor === 'light' && b.weight !== 'light') return `${c.plural} can only wear light armor.`;
      return null;
    }
    if (b.kind === 'shield') {
      if (!c.shield) return `${c.plural} cannot use shields.`;
      if (p.eq.weapon && ITEMS[p.eq.weapon.t].twoHanded) return 'You need a free hand for a shield.';
      if (p.eq.offhand) return 'Your off hand is holding a weapon.';
      return null;
    }
    return 'That cannot be equipped.';
  }
  function equip(it, quiet, toSlot) {
    const p = P(), b = ITEMS[it.t];
    const slot = toSlot === 'offhand' ? 'offhand' : b.kind;
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
    // putting it on is how you find out what it is
    if (it.h) { delete it.h; tellQuality(it); }
    emit('inv');
    return true;
  }
  function unequip(slot) {
    const p = P();
    if (!p.eq[slot]) return;
    if (bound(p.eq[slot])) { log(`${cap(the(p.eq[slot]))} will not come off. It is cursed.`, 'bad'); Sound.play('error'); return; }
    if (p.inv.length >= INV_MAX) { log('Your pack is full.', 'bad'); return; }
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
      if (b.effect === 'map' && lvl().explored.every(v => v)) return 'You already know this level.';
      if (b.effect === 'uncurse' && !cursedWorn().length && !hiddenGear().length) return 'Nothing you wear is cursed, and you know all your gear.';
    }
    return null;
  }
  function useItem(it) {
    const p = P(), b = ITEMS[it.t];
    if (p.held > G.t) { blocked('You are frozen in place!'); return; }
    const consumable = b.kind === 'food' || b.kind === 'potion' || b.kind === 'scroll';
    if (consumable && p.inv.indexOf(it) < 0) { log('You are not carrying that.', 'bad'); return; }
    if (consumable) {
      const why = wasteReason(it);
      if (why) { log(why, 'bad'); Sound.play('error'); emit('waste'); return; }
      noteUsed(b.kind);
    }
    if (b.kind === 'food') {
      removeOne(it);
      p.food = Math.min(100, p.food + b.food);
      log(`You eat the ${b.name.toLowerCase()}. ${p.food >= 90 ? 'You are full.' : 'That was good.'}`, 'good');
      Sound.play('eat');
    } else if (b.kind === 'potion') {
      const wasNew = !isKnown(it.t);
      removeOne(it);
      if (wasNew) { G.known[it.t] = 1; log(`You drink the unknown potion... it is a ${b.name}.`, 'info'); }
      switch (b.effect) {
        case 'heal': { const n = d(...b.heal); healPlayer(n); log(`You drink the potion and heal ${n}.`, 'good'); break; }
        case 'cure': p.poison = null; log('The poison leaves your veins.', 'good'); Sound.play('heal'); break;
        case 'might': p.effects.might = { amount: 2, until: G.t + 120000 }; log('You feel mighty!', 'good'); Sound.play('spell'); break;
        case 'mana': if (p.maxSp) { p.sp = p.maxSp; log('Your mind clears. Spell points restored.', 'good'); } else log('Your thoughts feel unusually sharp, but nothing else happens.'); Sound.play('spell'); break;
      }
    } else if (b.kind === 'scroll') {
      const wasNewS = !isKnown(it.t);
      removeOne(it);
      if (wasNewS) { G.known[it.t] = 1; log(`You read the unknown scroll... it is a ${b.name}.`, 'info'); }
      fx.castUntil = realNow + 260; fx.castColor = '#fe8';
      switch (b.effect) {
        case 'fire': {
          Sound.play('spell');
          const targets = boltTargets(3, false);
          spellFx('fireball', '#ff7020', 750, targets, 3);
          if (!targets.length) { log('A ball of fire bursts harmlessly against the stones.'); break; }
          castingName = 'fireball';
          for (const m of targets) {
            if (packSize(m) > 1) log(`The fireball engulfs all ${packSize(m)} of the ${mstat(m).name}s!`, 'good');
            hitGroup(m, d(4, 6), 'burn');
          }
          castingName = '';
          break;
        }
        case 'heal': { const n = d(...b.heal); healPlayer(n); log(`Warmth flows through you. You heal ${n}.`, 'good'); break; }
        case 'map': { const L = lvl(); L.explored.fill(1); log('The layout of this level burns itself into your mind.', 'good'); Sound.play('spell'); break; }
        case 'uncurse': {
          const lifted = breakCurses(), seen = revealAll();
          if (lifted) log(`A cold weight lifts from you. ${lifted > 1 ? 'The curses are' : 'The curse is'} broken.`, 'good');
          if (seen.length) log(`You see your gear for what it is: ${seen.map(x => itemName(x) + (x.curse ? ' (cursed)' : '')).join(', ')}.`, 'info');
          Sound.play('spell');
          break;
        }
        case 'teleport': {
          const L = lvl(); const spots = [];
          for (let i = 0; i < L.w * L.h; i++) if (L.tiles[i] === T.FLOOR && !monsterAt(i % L.w, (i / L.w) | 0)) spots.push(i);
          const s = Dice.pick(spots);
          p.x = s % L.w; p.y = (s / L.w) | 0;
          snapCam(); distFieldAt = -1e9;
          log('The world lurches and you find yourself elsewhere.', 'info');
          Sound.play('spell');
          checkTile();
          break;
        }
      }
    } else if (b.kind === 'weapon' || b.kind === 'armor' || b.kind === 'shield') {
      equip(it);
      return;
    } else if (b.kind === 'key') {
      log('Use keys by walking into a locked door.');
      return;
    } else if (b.kind === 'artifact') {
      log('The Heart pulses warmly. The way out is up.', 'info');
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
      if (!it.h) return 'You already know its quality.';
      if (it.studied === P().level) return 'You cannot judge it yet. Perhaps with more experience.';
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
        delete it.h;
        log(`You look ${the(it)} over closely: ${itemName(it)}${it.curse ? ', and there is a curse worked into it' : ''}.${c.note}`, it.curse ? 'bad' : 'good');
      } else {
        it.studied = P().level;
        log(`You look ${the(it)} over, but cannot tell good work from bad.${c.note}`);
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
    (L.items[k] = L.items[k] || []).push(one);
    log(`You drop ${the(one)}.`);
    emit('inv');
  }
  function floorItems() { return lvl().items[key(P().x, P().y)] || []; }
  function takeItem(it) {
    const p = P(), L = lvl(), k = key(p.x, p.y);
    const list = L.items[k] || [];
    const i = list.indexOf(it);
    if (i < 0) return;
    if (it.t === 'gold' || it.t === 'gem') noteGold(it.q);
    if (it.t === 'gold') { p.gold += it.q; log(`You pick up ${it.q} gold.`, 'good'); Sound.play('gold'); list.splice(i, 1); }
    else if (it.t === 'gem') { p.gold += it.q; log(`You find a ${it.name} worth ${it.q} gold.`, 'good'); Sound.play('gold'); list.splice(i, 1); }
    else if (it.t === 'artifact') {
      // the lich's cold holds the Heart fast: the last fight cannot be walked round
      const keeper = L.monsters.find(m => MONSTERS[m.id].boss);
      if (keeper) { log(`The Heart will not come loose. The ${MONSTERS[keeper.id].name}'s cold holds it fast, and will while it stands.`, 'bad'); Sound.play('error'); return; }
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
    else if (giveItem(it)) { log(`You pick up ${the(it)}.`); Sound.play('pickup'); list.splice(i, 1); if (it.u) discoverRelic(it.u); }
    else { log('Your pack is full.', 'bad'); }
    if (!list.length) delete L.items[k];
    emit('inv');
  }
  function pickupAll() {
    for (const it of floorItems().slice()) takeItem(it);
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
    const pl = rng.shuffle(POTION_LOOKS.slice());
    const sl = rng.shuffle(SCROLL_LOOKS.slice());
    const looks = {};
    potions.forEach((id, i) => { looks[id] = { adj: pl[i % pl.length][0], sprite: pl[i % pl.length][1] }; });
    scrolls.forEach((id, i) => { looks[id] = { adj: sl[i % sl.length], sprite: 'scroll' }; });
    return looks;
  }
  function isKnown(t) {
    const b = ITEMS[t];
    return !!(!b || (b.kind !== 'potion' && b.kind !== 'scroll') || !G.looks[t] || G.known[t]);
  }
  function newGame(cfg) {
    const c = CLASSES[cfg.cls];
    const bg = BACKGROUNDS[cfg.bg] ? cfg.bg : 'oathbroken';
    const p = {
      name: (cfg.name || '').trim() || 'Adventurer', cls: cfg.cls, bg, stats: cfg.stats, level: 1, xp: 0,
      maxHp: 0, hp: 0, maxSp: 0, sp: 0, food: 100, gold: 0,
      inv: [], eq: { weapon: null, armor: null, shield: null, offhand: null }, effects: {}, poison: null,
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
    p.maxHp = Math.max(10, c.hitDie + 6 + mod(p.stats.con));
    p.hp = p.maxHp;
    p.maxSp = spMax(p); p.sp = p.maxSp;
    lastBlocked = -1e9; queuedAttack = false; queuedMove = null;   // nothing carries over from the last run's clock
    clearFx();
    G = { seed: cfg.seed, opts: cfg.opts, player: p, levels: {}, depth: 1, log: [], logSeq: 0, t: 0, status: 'playing', lastSpell: null, created: Date.now(), version: 4, looks: buildLooks(cfg.seed), known: {}, journal: [], pendingBoons: null };
    G.relics = { ...relicPlan(cfg.seed, cfg.cls, cfg.opts.levels), offered: 0, found: [] };
    G.stats = freshStats();
    if (bg === 'cloistered') for (const id in ITEMS) G.known[id] = 1;   // raised among the books
    // the starting kit is familiar to its owner
    for (const id of c.startKit) G.known[id] = 1;
    for (const id of c.startKit) giveItem({ t: id, q: 1, e: 0 });
    for (const it of p.inv.slice()) {
      const k = ITEMS[it.t].kind;
      if ((k === 'weapon' || k === 'armor' || k === 'shield') && !p.eq[k]) equip(it, true);
    }
    enterLevel(1, 'down');
    log(`Welcome, ${p.name} the ${c.name}. ${G.opts.levels} floors lie below. Find the Heart of the Mountain.`, 'good');

    return G;
  }

  function enterLevel(depth, from) {
    const p = P();
    queuedAttack = false; queuedMove = null;   // a swing or step waiting on the last floor stays there
    p.grabbed = null; p.webbed = 0; p.held = 0;
    if (!G.levels[depth]) { G.levels[depth] = Dungeon.generate(G.seed, depth, G.opts); placeRelics(G.levels[depth], depth); }
    G.depth = depth;
    const L = G.levels[depth];
    const s = from === 'down' ? L.start : (L.downStart || L.start);
    p.x = s.x; p.y = s.y; p.dir = s.dir;
    // you arrive beside the stair you came by; that one needs no announcing
    const came = stairsBeside();
    besideKey = came ? came.key : '';
    for (const m of L.monsters) { m.nextAct = G.t + 600 + Math.random() * 600; m.rx = m.x; m.ry = m.y; m.moveT1 = 0; m.windup = null; m.volley = null; }
    shop = null;
    snapCam();
    distFieldAt = -1e9;
    p.deepest = Math.max(p.deepest, depth);
    if (from === 'down') {
      if (depth > 1) log(`You descend to level ${depth}. ${THEMES[L.theme].flavor}`, 'info');
      else log(THEMES[L.theme].flavor, 'info');
      if (L.isFinal) log('A dreadful presence waits somewhere on this level.', 'bad');
    } else log(`You climb back up to level ${depth}.`, 'info');
    emit('level');
    checkTile();
  }
  /** Why the hero cannot leave by the stairs right now, if they cannot. */
  function pinnedReason() {
    const p = P();
    if (p.held > G.t) return 'You are frozen in place!';
    if (p.webbed > G.t) return 'You are stuck in the web. Push against it to tear free.';
    if (p.grabbed) return 'You are held fast. Pull free first.';
    return '';
  }
  function descend() {
    const pinned = pinnedReason();
    if (pinned) { blocked(pinned); return; }
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
    if (floorItems().length) return 'Take';
    const tx = p.x + DIRS[p.dir][0], ty = p.y + DIRS[p.dir][1], t = tile(tx, ty);
    if (t === T.DOOR) return 'Open';
    if (t === T.DOOR_LOCKED) return P().inv.some(it => it.t === 'key' && it.color === (lvl().locks[key(tx, ty)] || 'brass')) ? 'Unlock' : 'Force';
    if (t === T.STAIRS_DOWN) return 'Descend';
    if (t === T.STAIRS_UP) return G.depth > 1 ? 'Climb' : 'Use';
    if (t === T.FOUNTAIN) return 'Drink';
    if (npcAt(tx, ty)) return npcAt(tx, ty).kind === 'encounter' ? 'Examine' : 'Trade';
    // Use still strikes what is in front, but the button beside it already
    // says Attack; two buttons with one name read as a mistake
    if (monsterAt(tx, ty)) return 'Use';
    if (t === T.DOOR_OPEN) return 'Close';
    // a hidden door reads as wall until found, so it must not label differently
    if (t === T.WALL || t === T.TORCH || t === T.SECRET) return 'Search';
    return 'Use';
  }
  function tryMove(rel) {
    const p = P();
    if (p.held > G.t) { blocked('You are frozen in place!'); return false; }
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
        if (d(1, 20) + mod(p.stats.str) < 12) { p.grabbed.nextTry = G.t + 600; blocked(`The ${who}'s grip holds you fast.`); return false; }
        p.grabbed = null;
        log(`You tear free of the ${who}'s grip!`, 'good');
        learn(g.id, 'answer');
      }
    }
    const dir = (p.dir + rel) % 4;
    const nx = p.x + DIRS[dir][0], ny = p.y + DIRS[dir][1];
    const t = tile(nx, ny);
    if (t === T.WALL || t === T.TORCH) { blocked('A wall blocks your path.' + stairHint()); return false; }
    if (t === T.DOOR) { openDoor(nx, ny); return true; }
    if (t === T.DOOR_LOCKED) { tryUnlock(nx, ny); return true; }
    if (t === T.STAIRS_DOWN) { descend(); return true; }
    if (t === T.STAIRS_UP) { ascend(); return true; }
    if (t === T.SECRET) { revealSecret(nx, ny, false); return true; }
    if (t === T.FOUNTAIN) { drinkFountain(nx, ny); return true; }
    const trader = npcAt(nx, ny);
    if (trader) { if (trader.kind === 'encounter') openEncounter(trader); else openShop(trader); return true; }
    const m = monsterAt(nx, ny);
    if (m) { m.awake = true; log(`The ${MONSTERS[m.id].name} blocks your way.`); return false; }
    // anything the interactive cases above did not claim had better be walkable
    if (!passable(nx, ny)) { blocked('Something blocks your path.'); return false; }
    p.x = nx; p.y = ny; p.steps++;
    if (rel === 1 || rel === 3) p.shadowUntil = G.t + 2500;
    startCam(MOVE_MS);
    Sound.play('step');
    distFieldAt = -1e9;
    onStep();
    const eye = (p.cls === 'thief' ? 0.5 : 0) + (p.bg === 'tombwise' ? 0.35 : 0);
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
  function logMerged(message) {
    // the same line again counts up on its own line instead of pushing
    // everything that mattered off the top of the log
    const last = G.log[G.log.length - 1];
    if (last && (last.base || last.m) === message) {
      last.base = last.base || message; last.n = (last.n || 1) + 1;
      last.m = `${last.base} (\u00d7${last.n})`;
      G.logSeq++;
      return;
    }
    log(message);
  }
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
    if (p.food === 0 && p.steps % 6 === 0) hurtPlayer(1, 'You are starving!');
    if (p.maxSp && p.sp < p.maxSp && p.steps % (hasTalent('arcane_flow') ? 4 : 9) === 0) p.sp++;
  }
  function checkTile() {
    const L = lvl(), p = P(), k = key(p.x, p.y);
    if (L.traps[k]) triggerTrap(k);
    if (G.status !== 'playing') return;
    if (L.items[k] && L.items[k].length) pickupAll();
  }
  function triggerTrap(k) {
    const L = lvl(), p = P();
    const tr = TRAP_TYPES[L.traps[k]];
    delete L.traps[k];
    let spot = p.cls === 'thief' ? 0.5 + p.level * 0.04 : 0;
    if (p.bg === 'tombwise') spot += 0.35;
    // a wise hero notices the loose flagstone whatever their trade
    spot += Math.max(0, mod(p.stats.wis)) * 0.1;
    if (spot > 0 && Math.random() < spot) {
      log(`You spot and disarm a ${tr.name}.`, 'good');
      return;
    }
    Sound.play('trap');
    if (tr.dmg) {
      const n = Math.max(1, d(...tr.dmg));
      hurtPlayer(n, `${tr.msg} You take ${n} damage.`);
    } else log(tr.msg, 'bad');
    if (tr.poison && !p.poison && !hasPower('pure')) { p.poison = poisonFor(); log('You are poisoned!', 'bad'); }
    if (tr.alarm) for (const m of L.monsters) m.awake = true;
  }

  // ---------- interaction ----------
  function use() {
    const p = P();
    const [dx, dy] = DIRS[p.dir];
    const tx = p.x + dx, ty = p.y + dy, t = tile(tx, ty);
    if (floorItems().length) { pickupAll(); return; }
    if (t === T.DOOR) return openDoor(tx, ty);
    if (t === T.DOOR_LOCKED) return tryUnlock(tx, ty);
    if (t === T.STAIRS_DOWN) return descend();
    if (t === T.STAIRS_UP) return ascend();
    if (t === T.SECRET) return revealSecret(tx, ty, false);
    if (t === T.FOUNTAIN) return drinkFountain(tx, ty);
    const ahead = npcAt(tx, ty);
    if (ahead) return ahead.kind === 'encounter' ? openEncounter(ahead) : openShop(ahead);
    if (monsterAt(tx, ty)) return attack();
    if (t === T.WALL || t === T.TORCH) { log('You search the wall but find nothing.' + stairHint()); return; }
    if (t === T.DOOR_OPEN) {
      if (monsterAt(tx, ty) || (lvl().items[key(tx, ty)] || []).length) { log('Something is in the doorway.'); return; }
      setTile(tx, ty, T.DOOR); log('You pull the door shut.'); Sound.play('door'); return;
    }
    if ((lvl().items[key(tx, ty)] || []).length) { logMerged('Step forward onto it to pick it up.'); return; }
    logMerged('There is nothing to use here.');
  }

  // ---------- trading ----------
  // Prices key off the item's own value so the shelf stays sane at any depth.
  // Charisma is how the trader sees you: each point of modifier is six
  // percent off what you buy and on what you sell, within reason. It was
  // rolled for every hero and, until this, used for nothing at all.
  function charm() { return Math.max(-0.3, Math.min(0.3, mod(P().stats.cha) * 0.06)); }
  // a relic is priced by its legend, not by the iron it is made of
  function buyPrice(shop, it) {
    const r = relicOf(it);
    if (r) return Math.round(r.value * shop.markup * (1 - charm()));
    const v = ITEMS[it.t].value || 5;
    const e = it.h ? 0 : (it.e || 0);
    const pw = it.pw && !it.h ? 1.7 : 1;
    return Math.max(2, Math.round(v * shop.markup * (1 + e * 0.9) * pw * (1 - charm())));
  }
  function sellPrice(it) {
    const r = relicOf(it);
    if (r) return Math.round(r.value * 0.45 * (1 + charm()) * (hasTalent('light_fingers') ? 1.25 : 1));
    const v = ITEMS[it.t].value || 1;
    // unknown gear goes for the price of a plain one; the trader will not tell
    const e = it.h ? 0 : (it.e || 0);
    return Math.max(1, Math.round(v * 0.45 * Math.max(0.2, 1 + e * 0.8) * (it.pw && !it.h ? 1.7 : 1) * (1 + charm()) * (hasTalent('light_fingers') ? 1.25 : 1)));
  }
  // ---------- encounters ----------
  // A choice the dungeon puts to you (see encounters.js). While one is open
  // the game waits, as it does for the trader, and the prop that started it
  // is gone once it has been answered.
  let encounter = null;
  let queuedAttack = false;
  let queuedMove = null;       // one step tapped while the camera was still moving
  let castingName = '';        // the spell whose blast is landing, so the log can name it
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
    const pickUp = it => { (L.items[key(p.x, p.y)] = L.items[key(p.x, p.y)] || []).push(it); const name = itemName(it); pickupAll(); return name; };
    for (const e of effects) {
      if (e.map) { L.explored.fill(1); out.push('You know the layout of this floor.'); }
      if (e.xp) { p.xp += e.xp; out.push(`+${e.xp} experience`); }
      if (e.goldPerDepth) {
        const n = e.goldPerDepth * G.depth;
        if (n > 0) { p.gold += n; out.push(`+${n} gold`); }
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
        p.maxHp = Math.max(10, p.maxHp + e.maxHp);
        p.hp = Math.min(p.maxHp, p.hp + Math.max(0, e.maxHp));
        out.push(`${e.maxHp > 0 ? '+' : '−'}${Math.abs(e.maxHp)} maximum hit points`);
      }
      if (e.food) { p.food = Math.max(0, Math.min(100, p.food + e.food)); out.push(`${e.food > 0 ? '+' : '−'}${Math.abs(e.food)} nourishment`); }
      if (e.loot != null) out.push(`Found: ${pickUp(Dungeon.rollLoot(Dice, G.depth + e.loot))}`);
      if (e.item) out.push(`Found: ${pickUp({ t: e.item.t, q: e.item.q || 1, e: 0 })}`);
      if (e.buff) {
        for (const [stat, n] of e.buff.stats) p.effects[stat] = { amount: n, until: G.t + e.buff.dur };
        out.push(`Blessed: ${e.buff.stats.map(([s, n]) => `+${n} ${s === 'hit' ? 'to hit' : s === 'ac' ? 'armour' : s}`).join(', ')} for ${Math.round(e.buff.dur / 60000)} minutes`);
      }
      if (e.poison && !p.poison && !hasPower('pure')) { p.poison = poisonFor(); out.push('Poisoned'); }
      if (e.cure && p.poison) { p.poison = null; out.push('Poison cured'); }
      if (e.wake) { for (const m of L.monsters) m.awake = true; out.push('Everything on this floor is awake'); }
      if (e.identifyAll) { for (const id in ITEMS) G.known[id] = 1; revealAll(); out.push('Every potion, scroll and piece of gear identified'); }
      if (e.uncurse && breakCurses()) out.push('Curse broken');
      if (e.stat) { p.stats[e.stat[0]] += e.stat[1]; out.push(`${e.stat[1] > 0 ? '+' : '−'}${Math.abs(e.stat[1])} ${STAT_WORD[e.stat[0]]}`); }
      if (e.ambush) {
        let placed = 0;
        for (let r = 2; r <= 4 && placed < e.ambush.n; r++) {
          for (let dy = -r; dy <= r && placed < e.ambush.n; dy++) for (let dx = -r; dx <= r && placed < e.ambush.n; dx++) {
            if (Math.abs(dx) + Math.abs(dy) !== r) continue;
            const x = p.x + dx, y = p.y + dy;
            if (!passable(x, y) || monsterAt(x, y) || npcAt(x, y)) continue;
            const b = MONSTERS[e.ambush.id], hp = Dice.dice(b.hp[0], b.hp[1], b.hp[2]);
            L.monsters.push({ uid: 800000 + Math.floor(Dice.next() * 99999), id: e.ambush.id, x, y, hp, maxHp: hp, awake: true,
              nextAct: G.t + 800, rx: x, ry: y, fromX: x, fromY: y, moveT0: 0, moveT1: 0, flashUntil: 0 });
            placed++;
          }
        }
        if (placed) { distFieldAt = -1e9; out.push(`${placed > 1 ? placed + ' ' : 'A '}${MONSTERS[e.ambush.id].name.toLowerCase()}${placed > 1 ? 's' : ''} attack${placed > 1 ? '' : 's'}!`); }
      }
    }
    return out;
  }

  let shop = null;
  function openShop(n) {
    shop = n;
    if (!n.greeted) {
      n.greeted = true;
      log('A hooded trader looks up from a lantern-lit pack. "Coin for goods, friend."', 'info');
    }
    Sound.play('gold');
    emit('shop');
    return true;
  }
  function currentShop() { return shop; }
  function closeShop() { shop = null; }
  function buy(it) {
    const p = P();
    if (!shop) return false;
    const price = buyPrice(shop, it);
    if (p.gold < price) { log('You cannot afford that.', 'bad'); Sound.play('error'); return false; }
    const one = { t: it.t, q: 1, e: it.e || 0, ...(it.u ? { u: it.u } : {}), ...(it.h ? { h: 1 } : {}), ...(it.pw ? { pw: it.pw } : {}) };
    if (!giveItem(one)) { log('Your pack is full.', 'bad'); Sound.play('error'); return false; }
    p.gold -= price;
    it.q--;
    if (it.q <= 0) {
      const at = shop.stock.indexOf(it);
      if (at >= 0) shop.stock.splice(at, 1);
    }
    G.known[one.t] = 1;   // the trader tells you what it is, so name it plainly
    log(`You buy ${the(one)} for ${price} gold.`, 'good');
    if (one.u) discoverRelic(one.u);
    Sound.play('gold');
    emit('inv'); emit('stats');
    return true;
  }
  function sell(it) {
    const p = P();
    if (!shop) return false;
    if (it.t === 'artifact') { log('The trader pales and refuses to touch it.', 'bad'); return false; }
    if (it.t === 'key') { log('"Keys are no use to me."'); return false; }
    const price = sellPrice(it);
    const one = removeOne(it);
    if (!one) { log('You are not carrying that.', 'bad'); return false; }
    p.gold += price;
    // flawed and cursed pieces go on the junk heap, not back on the shelf
    const junk = one.curse || (one.e || 0) < 0;
    // a relic, or a piece whose quality is still unknown, sits on the shelf apart
    const ex = !one.u && !one.h && !one.pw && shop.stock.find(s => s.t === one.t && (s.e || 0) === (one.e || 0) && !s.u && !s.h && !s.pw);
    if (junk) { /* gone */ } else if (ex) ex.q++; else shop.stock.push({ t: one.t, q: 1, e: one.e || 0, ...(one.u ? { u: one.u } : {}), ...(one.h ? { h: 1 } : {}), ...(one.pw ? { pw: one.pw } : {}) });
    log(`You sell ${the(one)} for ${price} gold.`, 'good');
    Sound.play('gold');
    emit('inv'); emit('stats');
    return true;
  }

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
  };
  const GORE_OF = { slime: 'goo', spider: 'ichor', skeleton: 'bone', zombie: 'rot', ghoul: 'rot', wraith: 'ecto', troll: 'troll', lich: 'bone' };
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
        g: g.g, c: g.c[i % g.c.length], born: realNow, life: 380 + look() * 360,
        size: look() < 0.3 ? 0.024 : 0.015, glow: g.glow,
      });
    }
    if (fx.bits.length > BITS_MAX) fx.bits.splice(0, fx.bits.length - BITS_MAX);
    if (pool && g.stain) {
      const list = fx.stains[G.depth] || (fx.stains[G.depth] = []);
      // it lands a little beyond the monster, on the side away from the blow
      list.push({ x: cx + ux * (0.1 + look() * 0.25) + (look() - 0.5) * 0.3, y: cy + uy * (0.1 + look() * 0.25) + (look() - 0.5) * 0.3,
        r: 0.06 + Math.min(1, amount) * 0.1, c: g.c[2], seed: look() * 1000 });
      if (list.length > STAINS_PER_FLOOR) list.shift();
    }
  }
  /** Sparks where a blow was turned aside. */
  function sparks(m) { spray(m, 'spark', 0.05, false); }

  // ---------- combat ----------
  function floatText(m, text, color) {
    fx.texts.push({ x: m.rx + 0.5, y: m.ry + 0.5, text: String(text), color, born: realNow, until: realNow + 750 });
  }
  function attack() {
    const p = P();
    if (G.t < p.nextAttack) return;
    if (p.held > G.t) { blocked('You are frozen in place!'); return; }
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
    if (!m) { Sound.play('miss'); return; }
    if (atRange) Sound.play('arrow');
    const mb = mstat(m);
    if (m.collapsed) { learn(m.id, 'answer'); damageMonster(m, 1, null, ' You scatter the bones for good.'); return; }
    // Shadow Step: a sidestep a moment ago puts the next blow in the shadows
    const stepped = !atRange && hasTalent('shadow_step') && G.t < (p.shadowUntil || 0);
    const sneak = p.cls === 'thief' && !atRange && (!m.awake || m.fleeing || stepped);
    if (stepped) p.shadowUntil = 0;
    m.awake = true;
    const roll = d(1, 20);
    const crit = roll >= critFloor();
    // a riposte: the opening a missed blow left, taken
    const rip = !atRange && p.riposteUntil > G.t ? 4 : 0;
    if (rip) p.riposteUntil = 0;
    const note = rollNote(roll, toHit() + rip, mb.ac, crit);
    if (roll === 1 || (!crit && roll + toHit() + rip < mb.ac)) {
      log(`You miss the ${mb.name}.${note}`);
      Sound.play('miss');
      floatText(m, 'miss', '#e4e4ee');
      sparks(m);
      return;
    }
    // Thieves strike where it counts rather than swinging hard, so their bonus
    // comes from dexterity and does not scale with the weight of the weapon.
    const finesse = p.cls === 'thief';
    const flat = (finesse ? mod(p.stats.dex) : mod(p.stats.str)) + skillDamage() + (effect('might') ? 2 : 0);
    // talents promise a number, so it is added whole, not scaled by the weapon's weight
    const knack = (hasTalent('weapon_master') ? (w.twoHanded ? 2 : 1) : 0) + (hasTalent('zeal') && effectFrom('hit', 'bless') ? 1 : 0);
    const baseSpeed = p.eq.weapon ? ITEMS[p.eq.weapon.t].speed : 450;
    let dmg = d(...w.dmg) + w.e + Math.round(finesse ? flat : flat * (baseSpeed / 700)) + knack + (rip ? 2 : 0) + baneDamage(m, 'weapon');
    if (crit) dmg *= 2;
    if (sneak) dmg *= hasTalent('assassinate') ? 3 : 2;
    dmg = Math.max(1, dmg);
    leech(Math.min(dmg, m.hp), 'weapon');   // only what it actually drew
    // Cleave: the swing carries on into the one behind the front. Who that is
    // is settled before the blow, since a killing blow brings them forward.
    const behind = !atRange && !w.range && hasTalent('cleave') && m.pack && m.pack.length ? m.pack[0] : null;
    const packBefore = packSize(m);
    // a crit that only Lucky made one says so
    const lucky = crit && hasTalent('lucky') && roll === critFloor();
    damageMonster(m, dmg, crit ? (rip ? 'riposte-crit' : (lucky ? 'lucky' : 'crit')) : (sneak ? 'sneak' : (rip ? 'riposte' : null)), note);
    const struckSurvived = lvl().monsters.includes(m) && packSize(m) === packBefore && !m.collapsed;
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
      if (hasTalent('kindling')) m.dot = { kind: 'burning', until: G.t + 3000, next: G.t + 1000 };
    }
    // Venomed Blades: one hit in four poisons anything living, and only the one struck
    if (hasTalent('venom') && struckSurvived && !mb.undead && Math.random() < 0.25) {
      m.dot = { kind: 'venom', until: G.t + 4000, next: G.t + 1000 };
      log(`The ${mb.name} is poisoned.`, 'good');
    }
    if (m.hp > 0) offhandStrike(m, atRange);
  }
  /**
   * The second blade follows the first. It swings wilder and carries none of
   * your strength behind it, so two light weapons beat one heavy one only
   * against the sort of thing that is easy to hit in the first place.
   */
  function offhandStrike(m, atRange) {
    const o = offhandWeapon();
    if (!o || atRange) return;
    fx.offAt = realNow + 90;
    const mb = mstat(m);
    const roll = d(1, 20);
    const note = rollNote(roll, toHit() - DUAL_HIT_PENALTY, mb.ac, false);
    if (roll === 1 || roll + toHit() - DUAL_HIT_PENALTY < mb.ac) {
      log(`Your ${o.name.toLowerCase()} goes wide.${note}`);
      return;
    }
    const dmg = Math.max(1, d(...o.dmg) + o.e + baneDamage(m, 'offhand'));
    leech(Math.min(dmg, m.hp), 'offhand');
    damageMonster(m, dmg, 'offhand', note);
  }
  function damageMonster(m, dmg, tag, note) {
    noteDealt(m, dmg, tag);
    const mb = mstat(m);
    m.hp -= dmg;
    m.awake = true;
    m.flashUntil = realNow + 130;
    {
      // a spray scaled to the blow, and a stain when it was a heavy one or the last
      const hard = dmg / Math.max(1, m.maxHp);
      if (tag !== 'burning' && tag !== 'venom') spray(m, null, hard + (tag === 'crit' || tag === 'riposte-crit' ? 0.4 : 0), hard >= 0.3 || m.hp <= 0);
    }
    floatText(m, dmg, tag === 'crit' || tag === 'riposte-crit' || tag === 'lucky' ? '#ff4' : (tag === 'fire' || tag === 'burn' ? '#f84' : '#fff'));
    Sound.play('hit');
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
    else if (tag === 'burning') { log(`The ${mb.name} burns for ${dmg}.`); }
    else if (tag === 'cleave') { log(`Your swing carries into the next ${mb.name} as it steps up, for ${dmg}.`); }
    else if (tag === 'venom') { log(`The poison eats at the ${mb.name} for ${dmg}.`); }
    else {
      const pre = { crit: 'A mighty blow! ', lucky: 'A lucky blow! ', 'riposte-crit': 'Riposte! A mighty blow! ', sneak: 'You strike from the shadows! ', riposte: 'Riposte! ' }[tag] || '';
      log(castingName ? `Your ${castingName} hits the ${mb.name}${of} for ${dmg}.` : `${pre}You hit the ${mb.name}${of} for ${dmg}.${note || ''}`);
    }
    moveOnHurt(m, mb, tag);
    // Kindling: the hero's fire keeps burning
    if (tag === 'burn' && hasTalent('kindling')) m.dot = { kind: 'burning', until: G.t + 3000, next: G.t + 1000 };
    // wounded, non-boss monsters may break and run
    if (!mb.boss && !(m.pack && m.pack.length) && m.hp <= m.maxHp * 0.25 && !m.fleeing && Math.random() < 0.3) {
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
    memberDown(m, note);
    if (mb.boss) { bossFalls(m); log('The dread presence lifts. The Heart of the Mountain is unguarded.', 'good'); }
  }

  // ---------- groups ----------
  // Pack creatures can share a square: one monster that carries the others
  // (m.pack, each {hp, maxHp}). They move as one, the front one takes your
  // blows, each of them swings, and a blast that fills the square hits all.
  const packSize = m => 1 + (m.pack ? m.pack.length : 0);
  /** One of them falls: the reward, the log line and the chance of loot. */
  function memberDown(m, note) {
    const L = lvl(), p = P(), mb = mstat(m);
    fallen(m);
    p.kills++;
    noteKill(m);
    // the two halves of a split slime are worth one slime between them
    const xp = m.split ? Math.ceil(mb.xp / 2) : mb.xp;
    p.xp += xp;
    log(`The ${mb.name} is destroyed!${note || ''} (+${xp} xp)`, 'good');
    meet(m, 'kill');
    // champions and bosses always drop something worthwhile
    if (Math.random() < (m.split ? 0.2 : 0.4) * (hasTalent('light_fingers') ? 1.5 : 1) || mb.boss || m.elite) {
      const k = key(m.x, m.y);
      const loot = Dungeon.rollLoot(Dice, G.depth + (m.elite ? 2 : 0));
      (L.items[k] = L.items[k] || []).push(loot);
    }
    checkLevelUp();
    emit('stats');
  }
  /** A body sinking and fading where it fell, knocked back from the hero. */
  function fallen(m) {
    const p = P(), base = MONSTERS[m.id];
    const rx = m.rx == null ? m.x : m.rx, ry = m.ry == null ? m.y : m.ry;
    const vx = rx - p.x, vy = ry - p.y, len = Math.hypot(vx, vy) || 1;
    fx.corpses.push({ x: rx + 0.5, y: ry + 0.5, sprite: m.collapsed ? 'bone_heap' : base.sprite, elite: m.elite, scale: base.scale * (packSize(m) > 1 ? 0.88 : 1) * (m.collapsed ? 0.95 : 1),
      born: realNow, dx: vx / len, dy: vy / len, fly: base.fly || 0 });
  }
  /** The next of the group steps into the front. */
  function promote(m) {
    const next = m.pack.shift();
    m.hp = next.hp; m.maxHp = next.maxHp;
    if (!m.pack.length) delete m.pack;
    const left = packSize(m);
    log(left > 1 ? `Another ${mstat(m).name} steps up. ${left} are left.` : `The last ${mstat(m).name} steps up.`, 'bad');
  }
  /** A blast that fills the square: the ones behind take it too. */
  function hitGroup(m, dmg, tag) {
    if (m.pack && m.split) learn(m.id, 'answer');     // a blast that takes both halves of a split slime
    if (m.pack) {
      for (const b of m.pack.slice()) {
        noteDealt(m, dmg, tag);
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
      const unlocked = knownSpells().filter(s => s.lvl * 2 - 1 === p.level);
      for (const s of unlocked) log(`You have learned ${s.name}.`, 'good');
      G.levelNotes = G.levelNotes || {};
      G.levelNotes[p.level] = { hp: gain, spells: unlocked.map(s => s.name) };
      // a small lesson at every level, and every third a talent of the hero's class
      if (p.level % 3 === 0) offerTalents(); else offerBoons();
    }
  }
  // Three things experience could have taught you. You keep one.
  function offerBoons() {
    const p = P();
    const taken = p.boons || [];
    // a stat lesson twice at most: stacking one every level was the whole of a build
    const times = id => taken.filter(t => t === id).length;
    const pool = BOONS.filter(b => (!b.when || b.when(p)) && !(b.unique && taken.includes(b.id)) && !(b.max && times(b.id) >= b.max));
    const picked = Dice.shuffle(pool.slice()).slice(0, 3).map(b => b.id);
    G.pendingBoons = (G.pendingBoons || []).concat([picked]);
    G.pendingLevels = (G.pendingLevels || []).concat(p.level);
    emit('boons');
  }
  /** Three of the class's talents not yet taken; a lesson instead once all are. */
  function offerTalents() {
    const p = P();
    // a talent for a spell not yet learned would sit useless for levels: it waits
    const knows = id => knownSpells().some(s => s.id === id && spellAvailable(s));
    const pool = (TALENTS[p.cls] || []).filter(t => !(p.talents || []).includes(t.id) && (!t.needs || knows(t.needs)));
    if (!pool.length) { offerBoons(); return; }
    G.pendingBoons = (G.pendingBoons || []).concat([Dice.shuffle(pool.slice()).slice(0, 3).map(t => t.id)]);
    G.pendingLevels = (G.pendingLevels || []).concat(p.level);
    emit('boons');
  }
  /** The level the offer now showing was earned at. */
  function pendingLevel() { return G.pendingLevels && G.pendingLevels.length ? G.pendingLevels[0] : P().level; }
  /** What a level brought besides the choice: hit points, and any spell learned. */
  function levelNote(level) { return (G.levelNotes && G.levelNotes[level]) || null; }
  function pendingBoons() { return G.pendingBoons && G.pendingBoons.length ? G.pendingBoons[0] : null; }
  function chooseBoon(id) {
    const offer = pendingBoons();
    if (!offer || !offer.includes(id)) return false;
    const p = P();
    const talent = (TALENTS[p.cls] || []).find(t => t.id === id);
    if (talent) {
      p.talents = (p.talents || []).concat(id);
      G.pendingBoons.shift(); if (G.pendingLevels) G.pendingLevels.shift();
      log(`Talent: ${talent.name}. ${talent.desc}`, 'good');
      Sound.play('levelup');
      emit('stats');
      if (!pendingBoons()) emit('boonsDone');
      return true;
    }
    const boon = BOONS.find(b => b.id === id);
    if (!boon) return false;
    boon.apply(p);
    p.maxSp = spMax(p);
    p.sp = Math.min(p.maxSp, p.sp);
    p.boons = (p.boons || []).concat(id);
    G.pendingBoons.shift(); if (G.pendingLevels) G.pendingLevels.shift();
    log(`${boon.name}. ${boon.desc}`, 'good');
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
  function hurtPlayer(dmg, msg, from) {
    noteTaken(dmg, from);
    const p = P();
    p.hp -= dmg;
    p.lastHurt = G.t;
    if (from) {
      const bearing = relativeBearing(from);
      fx.hurtFrom = bearing ? bearing.rel : 0;
      fx.hurtFromUntil = realNow + 900;
      G.lastAttacker = { name: mstat(from).name, dmg, bearing: bearing ? bearing.word : 'from nearby' };
    }
    // the harder the blow against the hero's whole life, the harder the view
    // jolts and reddens; one that takes a tenth of it or more leaves blood on
    // the edges of the view
    const hard = Math.min(1, dmg / Math.max(1, p.maxHp * 0.3));
    fx.damageUntil = realNow + 260;
    fx.hurtAmt = 0.3 + 0.4 * hard;
    fx.shakeAmp = 2.5 + 7 * hard; fx.shakeMs = 220; fx.shakeUntil = realNow + 220;
    if (dmg >= p.maxHp / 10) bloodOnView(hard);
    Sound.play('hurt');
    buzz(40);
    if (msg) log(msg, 'bad');
    if (p.hp <= 0 && hasTalent('last_rites') && !p.ritesUsed) {
      p.hp = 1; p.ritesUsed = true; p.sp = 0;
      log('Last rites: a light holds you up when you should have fallen, and takes every prayer you had left. It will not come again.', 'good');
    }
    if (p.hp > 0 && p.hp < p.maxHp / 4 && hasTalent('second_wind') && G.t >= (p.windReady || 0)) {
      const n = Math.ceil(p.maxHp / 4);
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
    fx.healUntil = realNow + 260;
    Sound.play('heal');
    emit('stats');
  }
  function die() {
    const p = P();
    p.hp = 0;
    fx.hpFrac = 1;                         // no near-death pulse over the fallen
    G.status = 'dead';
    G.deathLog = G.log.slice(-6).map(e => e.m);
    log(`${p.name} has died on floor ${G.depth}.`, 'bad');
    Sound.play('die');
    if (G.opts.permadeath) { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } }
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
    win();
  }
  function win() {
    G.status = 'won';
    log('The light carries you up out of the mountain and into the day. The Heart is yours.', 'good');
    Sound.play('win');
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
    recordHero(true);
    emit('won');
  }
  /** How long the Heart's light has left to fill the view before the victory screen. */
  function finaleLeft() { return fx.heartAt >= 0 ? Math.max(0, fx.heartAt + FINALE_MS - realNow) : 0; }
  function score(p, depth, won) { return p.gold + p.xp * 2 + p.deepest * 100 + (won ? 2000 : 0); }
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
      const total = pagesInDungeon();
      lines.push(read >= total
        ? 'They also carried out every page the earlier crews left behind, so the valley will finally learn what became of them.'
        : `They left ${total - read} of the earlier crews' pages down there in the dark. Someone else will have to go back for those.`);
    } else {
      lines.push(p.deepest >= 4
        ? `${p.name} got as far as floor ${p.deepest} of the Deepdelve, which is further than the fourth crew managed.`
        : `${p.name} fell on floor ${p.deepest} of the Deepdelve, in the shallow halls where it takes most of those who try.`);
      lines.push(bg.epi);
      lines.push(read > 0
        ? `They were carrying ${read} of the earlier crews' pages when they fell. In time someone will find those too, along with a new name for the roster.`
        : 'They carried nothing out and left nothing behind but another name for the roster.');
    }
    return lines;
  }
  function recordHero(won) {
    const p = P();
    const entry = { name: p.name, cls: p.cls, level: p.level, depth: G.depth, gold: p.gold, xp: p.xp, kills: p.kills, won, seed: G.seed, date: Date.now(), score: score(p, G.depth, won) };
    try {
      const list = hall();
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
  function noteDealt(m, dmg, tag) {
    const s = runStats(), p = P();
    s.dealt += dmg;
    if (s.best && dmg <= s.best.dmg) return;
    // the first blow to reach a number keeps the record, so a tie does not rename it
    const how = castingName ? cap(castingName)
      : tag === 'offhand' ? (p.eq.offhand ? the(p.eq.offhand) : 'your off hand')
      : tag === 'thorns' ? 'your barbs' : tag === 'burning' ? 'fire' : tag === 'venom' ? 'poison'
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
  /** @returns {Record<string, {met: number, kills: number, deaths: number, trick?: number, answer?: number}>} */
  function bestiary() {
    let v = {};
    try { v = JSON.parse(localStorage.getItem(BESTIARY_KEY) || '{}'); } catch (e) { /* start afresh */ }
    if (!v || typeof v !== 'object' || Array.isArray(v)) v = {};
    // whatever was stored, each record comes back as numbers, never a crash
    const out = {};
    for (const id in v) {
      if (!MONSTERS[id]) continue;
      const r = v[id] && typeof v[id] === 'object' ? v[id] : {};
      const n = x => Math.max(0, Math.floor(Number(x) || 0));
      out[id] = { met: n(r.met), kills: n(r.kills), deaths: n(r.deaths), ...(r.trick ? { trick: 1 } : {}), ...(r.answer ? { answer: 1 } : {}) };
    }
    return out;
  }
  /** Note something learned about a kind of monster, and say so when it is new.
   * `met` also counts a first meeting, so a trick seen at first sight is one line. */
  function learn(id, what, met) {
    if (!MONSTERS[id]) return;
    const all = bestiary(), name = MONSTERS[id].name, lore = BESTIARY[id] || {};
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
    // a trick seen or beaten again is nothing new, and a troll regrows every second
    if ((what === 'trick' || what === 'answer') && !news.length && !met) return;
    try { localStorage.setItem(BESTIARY_KEY, JSON.stringify(all)); } catch (e) { /* ignore */ }
    if (news.length && G && G.status === 'playing') log(`Bestiary, ${name}: ${news.join(', ')}.`, 'info');
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
    if (sp.kind === 'bolt' && !boltTargets(spellRange(sp), sp.pierce).length) {
      return `Nothing within reach for ${sp.name} to strike.`;
    }
    if (sp.kind === 'buff' && effect(sp.stat) >= sp.amount) return `${sp.name} is already upon you.`;
    return null;
  }
  // A spell takes time, and shares the swing's timer. Casting used to cost
  // nothing: a cleric could bless, ward, heal and strike in the same instant,
  // and a mage could empty their points as fast as they could tap Cast. Now
  // each moment is a choice between them. A class may cast faster or slower
  // than this: a mage's words are quick, a cleric's prayers are not.
  const CAST_MS = 800;
  /** How each spell looks, and how long its effect plays. */
  const SPELL_FX = {
    magic_missile: ['missile', 650], burning_hands: ['hands', 450], shield: ['buff', 600], lightning: ['lightning', 380],
    cone_cold: ['cone', 520], cure_light: ['heal', 800], bless: ['buff', 600], smite: ['smite', 560],
    cure_serious: ['heal', 850], protection: ['buff', 600], flame_strike: ['pillar', 700],
  };
  /** Show a spell's effect: where it lands, or the square ahead if nowhere. */
  function spellFx(style, color, dur, targets, reach) {
    const p = P(), [dx, dy] = DIRS[p.dir];
    fx.spells.push({ style, color, born: realNow, until: realNow + dur,
      pts: targets.map(m => ({ x: m.rx + 0.5, y: m.ry + 0.5 })),
      ahead: { x: p.x + dx * (reach || 1) + 0.5, y: p.y + dy * (reach || 1) + 0.5 } });
  }
  function castSpell(sp) {
    const p = P();
    queuedAttack = false;
    if (p.held > G.t) { blocked('You are frozen in place!'); return false; }
    if (!spellAvailable(sp)) { log(`You are not experienced enough to cast ${sp.name}.`, 'bad'); return false; }
    // choosing a spell readies it on the Cast button, even if it cannot fly
    // yet: a mage picks Burning Hands before the fight, not during it
    G.lastSpell = sp.id;
    if (p.sp < sp.cost) { log('Not enough spell points.', 'bad'); Sound.play('error'); return false; }
    const waste = spellWasteReason(sp);
    if (waste) { log(waste, 'bad'); Sound.play('error'); emit('waste'); return false; }
    if (G.t < p.nextAttack) { blocked('You are still recovering from your last action.'); return false; }
    p.nextAttack = G.t + Math.round((cls().castMs || CAST_MS) * (hasTalent('quick_words') ? 0.75 : 1));
    p.sp -= sp.cost;
    noteSpell(sp);
    G.lastSpell = sp.id;
    fx.castUntil = realNow + 260; fx.castColor = sp.color; fx.castAt = realNow;
    Sound.play('spell');
    const look = SPELL_FX[sp.id] || ['buff', 500];
    if (sp.kind !== 'bolt') spellFx(look[0], sp.color, look[1], [], 1);
    switch (sp.kind) {
      case 'heal': { const n = Math.round(d(...sp.heal(p.level)) * (hasTalent('healing_hands') ? 4 / 3 : 1)); healPlayer(n); log(`You cast ${sp.name} and heal ${n}.${hasTalent('healing_hands') ? ' (Healing Hands)' : ''}`, 'good'); break; }
      case 'buff':
        p.effects[sp.stat] = { amount: sp.amount, until: G.t + sp.dur * (sp.id === 'bless' && hasTalent('zeal') ? 2 : 1), src: sp.id };
        log(`You cast ${sp.name}. ${sp.desc}`, 'good');
        if (sp.id === 'shield' && hasTalent('mirror_image')) { p.mirrors = 2; log('Two images of you shimmer into being at your side.', 'good'); }
        break;
      case 'bolt': {
        const targets = boltTargets(spellRange(sp), sp.pierce);
        spellFx(look[0], sp.color, look[1], targets, spellRange(sp));
        if (!targets.length) { log(`Your ${sp.name} strikes nothing.`); break; }
        // an Empowered or Radiant spell says so in every line it hits with
        castingName = (sp.holy && hasTalent('radiance') ? 'radiant ' : hasTalent('empower') ? 'empowered ' : '') + sp.name;
        for (const m of targets) {
          if ((sp.pierce || sp.area) && packSize(m) > 1) log(`${sp.name} engulfs all ${packSize(m)} of the ${mstat(m).name}s!`, 'good');
          let dmg = d(...sp.dmg(p.level));
          if (sp.holy && mstat(m).undead) dmg *= 2;
          if (sp.holy && hasTalent('radiance')) dmg = Math.round(dmg * 1.5);
          if (hasTalent('empower')) dmg = Math.round(dmg * 1.2);
          // Rime: the cold and the lightning hold back whatever they touch
          if (sp.pierce && hasTalent('rime')) { m.nextAct = Math.max(m.nextAct, G.t) + 700; if (m.windup) m.windup.until += 700; }
          // a bolt that tears through everything in its path, or a blast that
          // fills the square, takes a whole group; a dart only the front one
          const tag = sp.fire ? 'burn' : 'fire';
          if (sp.pierce || sp.area) hitGroup(m, dmg, tag); else damageMonster(m, dmg, tag);
        }
        castingName = '';
        break;
      }
    }
    emit('stats');
    return true;
  }
  function castLast() {
    const list = knownSpells();
    if (!list.length) return quaff();
    const sp = list.find(s => s.id === G.lastSpell) || list[0];
    return castSpell(sp);
  }

  /**
   * For a hero with no spells the Cast button is Quaff: drink the smallest
   * known healing draught that will not be wasted, the one a player reaches
   * for mid-fight without opening the pack.
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
  /** What the Cast button will do: the readied spell, or Quaff for the spell-less. */
  function castLabel() {
    const list = knownSpells();
    if (!list.length) return P().inv.some(i => (i.t === 'potion_heal' || i.t === 'potion_xheal') && isKnown(i.t)) ? 'Quaff' : 'Quaff (none)';
    return (list.find(s => s.id === G.lastSpell && spellAvailable(s)) || list[0]).name;
  }

  // ---------- resting ----------
  function rest() {
    const p = P(), L = lvl();
    ensureDist();
    const near = L.monsters.some(m => { const dd = distField[m.y * L.w + m.x]; return m.awake && dd >= 0 && dd <= 5; });
    if (near) { log("You can't rest with enemies nearby.", 'bad'); Sound.play('error'); return false; }
    if (p.hp >= p.maxHp && p.sp >= p.maxSp) { log('You are already well rested.'); return false; }
    if (p.food < 6) { log('You are too hungry to rest.', 'bad'); Sound.play('error'); return false; }
    p.food -= 6;
    p.hp = p.maxHp; p.sp = p.maxSp;
    G.t += 60000;
    for (const m of L.monsters) { for (let i = 0; i < 3; i++) if (!m.awake) wander(m); m.nextAct = G.t + 300; }
    log('You rest for a while and wake refreshed.', 'good');
    Sound.play('heal');
    emit('stats');
    return true;
  }

  // ---------- monsters ----------
  function computeDist() {
    const L = lvl(), p = P();
    const dist = new Int32Array(L.w * L.h).fill(-1);
    const q = [p.y * L.w + p.x];
    dist[q[0]] = 0;
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi], x = i % L.w, y = (i / L.w) | 0;
      if (dist[i] > 20) break;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= L.w || ny >= L.h) continue;
        const ni = ny * L.w + nx;
        if (dist[ni] >= 0) continue;
        const t = L.tiles[ni];
        if (t !== T.FLOOR && t !== T.DOOR_OPEN && t !== T.DOOR) continue;
        dist[ni] = dist[i] + 1;
        q.push(ni);
      }
    }
    return dist;
  }
  function ensureDist() {
    if (!distField || G.t - distFieldAt > 250) { distField = computeDist(); distFieldAt = G.t; }
  }
  function moveMonster(m, nx, ny) {
    m.fromX = m.x; m.fromY = m.y;
    m.x = nx; m.y = ny;
    m.moveT0 = realNow;
    m.moveT1 = realNow + Math.max(200, Math.round(MONSTERS[m.id].speed * 0.45));
  }
  function wander(m) {
    const p = P();
    const opts = [];
    for (const [dx, dy] of DIRS) {
      const nx = m.x + dx, ny = m.y + dy;
      if (passable(nx, ny) && !monsterAt(nx, ny) && !npcAt(nx, ny) && !(nx === p.x && ny === p.y)) opts.push([nx, ny]);
    }
    if (opts.length) { const o = Dice.pick(opts); moveMonster(m, o[0], o[1]); }
  }
  // A straight, unobstructed line from the monster to the player within range.
  // The lich throws over the heads of anything between, so only walls stop it.
  /** @param {{x: number, y: number}} m @param {number} range @param {boolean} [overHeads] */
  function hasLineToPlayer(m, range, overHeads) {
    const p = P();
    if (m.x !== p.x && m.y !== p.y) return null;
    const dx = Math.sign(p.x - m.x), dy = Math.sign(p.y - m.y);
    const dist = Math.abs(p.x - m.x) + Math.abs(p.y - m.y);
    if (dist > range || dist < 2) return null;
    for (let i = 1; i < dist; i++) {
      const x = m.x + dx * i, y = m.y + dy * i;
      if (!passable(x, y) || (!overHeads && (monsterAt(x, y) || npcAt(x, y)))) return null;
    }
    return dist;
  }
  function rangedAttack(m) {
    const mb = mstat(m), r = mb.ranged;
    m.lungeAt = realNow;
    meet(m);
    const roll = d(1, 20);
    const ac = playerAC();
    const note = rollNote(roll, mb.hit, ac, roll === 20);
    Sound.play('arrow');
    if (roll === 1 || (roll !== 20 && roll + mb.hit < ac)) { log(`The ${mb.name} ${r.verb} you and misses.${note}`); return; }
    if (hasTalent('evasion') && Math.random() < 1 / 3) { log(`You twist aside as the ${mb.name} ${r.verb} you.`, 'good'); return; }
    let dmg = Math.max(1, d(...r.dmg));
    if (roll === 20) dmg *= 2;
    const where = relativeBearing(m);
    const aside = where && where.rel !== 0 ? ` ${where.word}` : '';
    hurtPlayer(dmg, `The ${mb.name} ${r.verb} you${aside} for ${dmg}.${note}`, m);
  }
  /** @param {{hit?: number, mult?: number, extra?: number[], verb?: string}} [heavy]  a trick's blow: surer and harder */
  function monsterAttack(m, heavy) {
    const p = P(), mb = mstat(m), h = heavy || {};
    m.lungeAt = realNow;
    meet(m);
    const roll = d(1, 20);
    const ac = playerAC();
    const hit = mb.hit + (h.hit || 0);
    // Mirror Image: the blow falls on an image instead
    if (p.mirrors > 0) { p.mirrors--; log(`The ${mb.name} strikes one of your images, and it vanishes.`, 'good'); riposte(); return false; }
    const note = rollNote(roll, hit, ac, roll === 20);
    if (roll === 1 || (roll !== 20 && roll + hit < ac)) {
      riposte();
      const miss = relativeBearing(m);
      log(`The ${mb.name} misses you${miss && miss.rel !== 0 ? ` ${miss.word}` : ''}.${note}`, miss && miss.rel !== 0 ? 'bad' : '');
      if (miss && miss.rel !== 0) { fx.hurtFrom = miss.rel; fx.hurtFromUntil = realNow + 700; }
      return false;
    }
    let dmg = Math.max(1, d(...mb.dmg) + (h.extra ? d(h.extra[0], h.extra[1], h.extra[2]) : 0)) * (h.mult || 1);
    if (roll === 20 && !h.mult) dmg *= 2;          // a crushing blow is doubled already
    const firm = heavy && hasTalent('stand_firm');
    if (firm) dmg = Math.max(1, Math.ceil(dmg / 2));
    const where = relativeBearing(m);
    const aside = where && where.rel !== 0 ? ` ${where.word}` : '';
    hurtPlayer(dmg, `The ${mb.name} ${h.verb || 'hits'} you${aside} for ${dmg}.${firm ? ' (Stand Firm halves it)' : ''}${note}`, m);
    if (G.status !== 'playing') return true;
    if (mb.poison && !p.poison && !hasPower('pure') && Math.random() < mb.poison) { p.poison = poisonFor(); log('You are poisoned!', 'bad'); }
    // a strong will holds on to itself against the drain
    if (mb.drain && !hasPower('ward') && Math.random() < Math.max(0.05, 0.25 - 0.05 * mod(p.stats.wis))) { p.maxHp = Math.max(10, p.maxHp - 2); p.hp = Math.min(p.hp, p.maxHp); log('You feel your life force drain away!', 'bad'); }
    if (hasPower('thorns')) damageMonster(m, d(1, 4), 'thorns');
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
  const poisonFor = () => ({ until: G.t + Math.min(20000, 6000 + 3500 * G.depth), next: G.t + 2000 });
  /** How long a blow is drawn back: most of the gap between blows, up to WINDUP_MS. A
   * rat's used to be 405ms, and seeing it and moving a thumb to Step takes longer. */
  const windupFor = cycle => Math.round(Math.min(WINDUP_MS, cycle * 0.7));
  /** Draw a blow back: it lands in dur ms, if you are still there. */
  function beginWindup(m, kind, dur) {
    if (m.pressing) { dur = Math.max(350, Math.round(dur * 0.6)); m.pressing = false; }
    m.windup = { kind, at: G.t, until: G.t + dur };
    m.nextAct = m.windup.until;
    Sound.play('windup');
  }
  const WAKE_BEAT = 600;   // ms between a monster noticing you and doing anything about it

  // ---------- signature moves ----------
  // Most monsters have one trick of their own. Each is drawn back longer than
  // a plain blow, marked in violet and announced, and each has an answer:
  // step out of the ogre's smash, out of the orc's line, strike the chanting
  // acolyte, crush the skeleton's bones, burn the troll.
  const SPECIAL_MS = { crush: 900, charge: 700, web: 650, mend: 1800, nova: 1300, grab: 750, paralyse: 750, rite: 2400 };
  const RITE_MEND = 0.2;    // the share of its life the lich takes back if its rite is let finish
  const RISE_MS = 4500;     // a skeleton's bones lie still this long before it rises
  const HELD_MS = 1300;     // a ghoul's touch freezes you this long
  const NOVA_REACH = 2;     // the lich's cold fire reaches this far
  /** The cold fire spreads over open floor: two steps' walk, so a wall or a corner is cover. */
  function novaReaches(m) {
    ensureDist();
    const w = distField[m.y * lvl().w + m.x];
    return w >= 0 && w <= NOVA_REACH;
  }
  /** Crushing and magic keep a skeleton down; an edge only takes it apart. */
  function breaksBones(tag) {
    if (tag === 'fire' || tag === 'burn' || tag === 'burning') return true;
    if (tag === 'thorns') return false;
    const w = tag === 'offhand' ? offhandWeapon() : weapon();
    return !!(w && w.blunt);
  }
  /** The most badly hurt monster near the acolyte, itself included. */
  function mendTarget(m) {
    let best = null, frac = 0.5;
    for (const o of lvl().monsters) {
      if (o.collapsed || Math.abs(o.x - m.x) + Math.abs(o.y - m.y) > 5 || mstat(o).boss) continue;
      const f = o.hp / o.maxHp;
      if (f < frac) { frac = f; best = o; }
    }
    return best;
  }
  /** Try to begin this monster's trick; true if it did. */
  function startMove(m, mb, adjacent) {
    const p = P();
    // in the dark, a wounded lich turns to the Heart and drinks; strike it to break the rite
    const rite = mb.boss && (m.phase || 0) >= 2 && m.hp < m.maxHp && G.t >= (m.riteReady || 0);
    const mv = rite ? 'rite' : mb.move;
    if (!mv || (!rite && G.t < (m.moveReady || 0)) || packSize(m) > 1) return false;
    let say = '', extra = {};
    if (rite) say = `The ${mb.name} lifts its hands toward the Heart and begins to drink its light! Strike it to break the rite!`;
    if (mv === 'crush' && adjacent && (m.blows || 0) >= 2) say = `The ${mb.name} heaves its club high over its head!`;
    else if (mv === 'charge' && hasLineToPlayer(m, m.id === 'minotaur' ? 4 : 3) && Math.random() < 0.6) {
      say = `The ${mb.name} lowers its head and charges!`;
      extra = { dx: Math.sign(p.x - m.x), dy: Math.sign(p.y - m.y) };
    }
    else if (mv === 'web' && !adjacent && hasLineToPlayer(m, 3) && !(p.webbed > G.t)) say = `The ${mb.name} rears back to spit a web!`;
    else if (mv === 'mend') {
      const t = mendTarget(m);
      if (t) { say = t === m ? `The ${mb.name} begins a dark chant over its own wounds!` : `The ${mb.name} begins a dark chant over the wounded ${mstat(t).name}!`; extra = { target: t.uid }; }
    }
    else if (mv === 'grab' && adjacent && (m.blows || 0) >= 1 && !p.grabbed) say = `The ${mb.name} lurches forward to seize you!`;
    else if (mv === 'paralyse' && adjacent && (m.blows || 0) >= 2) say = `The ${mb.name} reaches out with a numbing claw!`;
    else if (mv === 'nova' && novaReaches(m) && (m.blows || 0) >= 2) say = `The ${mb.name} gathers a storm of cold fire around itself. Get away!`;
    if (!say) return false;
    m.blows = 0;
    m.windup = { kind: 'move', move: mv, at: G.t, until: G.t + SPECIAL_MS[mv], ...extra };
    m.nextAct = m.windup.until;
    log(say, 'bad');
    meet(m, 'trick');
    Sound.play('special');
    return true;
  }
  /** The trick comes off, or fails against a player who answered it. */
  function resolveMove(m, mb, w) {
    const p = P(), L = lvl();
    const dist = Math.abs(m.x - p.x) + Math.abs(m.y - p.y);
    m.windup = null;
    // tricks land on you whatever else is swinging, but not in the same frame
    if (G.t < (G.blowGate || 0)) { m.windup = w; m.nextAct = G.blowGate; return; }
    switch (w.move) {
      case 'crush':
        if (dist === 1) { monsterAttack(m, { hit: 2, mult: 2, verb: 'brings its club down on' }); G.blowGate = G.t + BLOW_GAP; m.nextAct = G.t + mb.speed; }
        else { log(`The ${mb.name}'s club smashes the floor where you stood. It staggers, wide open!`, 'good'); Sound.play('bump'); m.nextAct = G.t + 1600; learn(m.id, 'answer'); riposte(); }
        break;
      case 'charge': {
        const inLine = w.dx ? p.y === m.y && Math.sign(p.x - m.x) === w.dx : p.x === m.x && Math.sign(p.y - m.y) === w.dy;
        if (inLine && (dist === 1 || hasLineToPlayer(m, 6))) {
          const tx = p.x - (w.dx || 0), ty = p.y - (w.dy || 0);
          if (tx !== m.x || ty !== m.y) moveMonster(m, tx, ty);
          monsterAttack(m, { hit: 2, extra: m.id === 'minotaur' ? [2, 6, 0] : [1, 6, 0], verb: 'slams into' });
          G.blowGate = G.t + BLOW_GAP;
          m.nextAct = G.t + mb.speed;
        } else {
          // it thunders on down its line as far as it can, and stumbles
          let x = m.x, y = m.y;
          for (let i = 0; i < 3; i++) {
            const nx = x + (w.dx || 0), ny = y + (w.dy || 0);
            if (!passable(nx, ny) || monsterAt(nx, ny) || npcAt(nx, ny) || (nx === p.x && ny === p.y)) break;
            x = nx; y = ny;
          }
          if (x !== m.x || y !== m.y) moveMonster(m, x, y);
          log(`The ${mb.name} thunders past you and stumbles, wide open!`, 'good');
          learn(m.id, 'answer');
          Sound.play('bump');
          m.nextAct = G.t + 1600;
        }
        m.moveReady = G.t + 8000;
        break;
      }
      case 'grab':
        if (dist === 1) {
          if (monsterAttack(m, { verb: 'seizes' }) && G.status === 'playing' && !p.grabbed) {
            if (hasTalent('stand_firm')) log(`You tear out of the ${mb.name}'s grasp before it closes.`, 'good');
            else {
              p.grabbed = { uid: m.uid, until: G.t + 4000, nextTry: 0 };
              log(`The ${mb.name} has hold of you! Pull free: stepping away takes strength.`, 'bad');
            }
          }
          G.blowGate = G.t + BLOW_GAP;
        } else { log(`The ${mb.name} grabs at the air where you stood.`, 'good'); learn(m.id, 'answer'); }
        m.nextAct = G.t + mb.speed;
        break;
      case 'paralyse':
        if (dist === 1) {
          if (monsterAttack(m, { verb: 'claws' }) && G.status === 'playing') {
            if (d(1, 20) + mod(p.stats.con) >= 12) log(`The ${mb.name}'s claws numb you, but you shake it off.`);
            else { p.held = G.t + HELD_MS; log(`The ${mb.name}'s touch freezes you in place!`, 'bad'); }
          }
          G.blowGate = G.t + BLOW_GAP;
        } else { log(`The ${mb.name}'s claw closes on the air where you stood.`, 'good'); learn(m.id, 'answer'); }
        m.nextAct = G.t + mb.speed;
        break;
      case 'web':
        if ((dist === 1 || hasLineToPlayer(m, 4)) && hasTalent('evasion')) log('The web slides off you.', 'good');
        else if (dist === 1 || hasLineToPlayer(m, 4)) {
          p.webbed = G.t + 2500;
          log('Sticky web binds your legs! Keep pushing to tear free.', 'bad');
          Sound.play('hurt');
        } else { log(`The ${mb.name}'s web sails past you.`, 'good'); learn(m.id, 'answer'); }
        m.moveReady = G.t + 7000;
        m.nextAct = G.t + Math.round(mb.speed * 0.6);
        break;
      case 'mend': {
        const t = L.monsters.find(o => o.uid === w.target);
        if (t && !t.collapsed && t.hp < t.maxHp) {
          const n = Math.min(t.maxHp - t.hp, d(2, 6) + 2 + G.depth);
          t.hp += n;
          log(`Dark power knits the ${t === m ? mb.name : mstat(t).name}'s wounds (+${n}).`, 'bad');
          floatText(t, '+' + n, '#c080ff');
        }
        m.moveReady = G.t + 8000;
        m.nextAct = G.t + Math.round(mb.speed * 0.6);
        break;
      }
      case 'rite': {
        const n = Math.min(m.maxHp - m.hp, Math.ceil(m.maxHp * RITE_MEND));
        m.hp += n;
        log(`The Heart's light pours into the ${mb.name}. Its wounds close (+${n}).`, 'bad');
        floatText(m, '+' + n, '#c080ff');
        spray(m, 'ecto', 0.6, false);
        m.riteReady = G.t + 9000;
        m.nextAct = G.t + Math.round(mb.speed * 0.6);
        break;
      }
      case 'nova':
        if (novaReaches(m)) { const n = Math.max(1, Math.ceil(d(4, 6) / (hasTalent('stand_firm') ? 2 : 1))); hurtPlayer(n, `The storm of cold fire bursts over you for ${n}!`, m); G.blowGate = G.t + BLOW_GAP; }
        else { log('The storm of cold fire breaks short of you.', 'good'); learn(m.id, 'answer'); }
        m.nextAct = G.t + mb.speed;
        break;
    }
  }
  /** What a monster's trick does when it is hurt and still standing. */
  function moveOnHurt(m, mb, tag) {
    // a chant is broken by any wound
    if (m.windup && m.windup.move === 'mend') {
      m.windup = null; m.moveReady = G.t + 3000; m.nextAct = G.t + 700;
      log(`You break the ${mb.name}'s chant!`, 'good');
      learn(m.id, 'answer');
    }
    // and so is the lich's rite, though it will try again
    if (m.windup && m.windup.move === 'rite') {
      m.windup = null; m.riteReady = G.t + 6000; m.nextAct = G.t + 700;
      log(`You break the ${mb.name}'s rite! The Heart's light slips back out of its hands.`, 'good');
      learn(m.id, 'answer');
    }
    // fire sears a troll's wounds shut, so they cannot grow back for a while
    if ((tag === 'burn' || tag === 'burning') && mb.regen) {
      if (!(m.burnUntil > G.t)) { log(`The ${mb.name}'s burns do not close.`, 'good'); learn(m.id, 'answer'); }
      m.burnUntil = G.t + 6000;
    }
    // a slime struck hard enough splits into two smaller ones in its square
    if (mb.move === 'split' && !m.split && !m.pack && m.hp >= 4) {
      m.split = true;
      const half = Math.floor(m.hp / 2);
      m.hp -= half; m.maxHp = Math.max(m.hp, Math.ceil(m.maxHp / 2));
      m.pack = [{ hp: half, maxHp: m.maxHp }];
      m.windup = null;
      log(`The ${mb.name} splits in two!`, 'bad');
      learn(m.id, 'trick');
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
    raiseGuards(m);
    m.windup = null; m.volley = null;
    if (m.phase === 1) {
      const to = blinkSpot(m);
      if (to) {
        spray(m, 'ecto', 1, false);
        m.fromX = m.x = to[0]; m.fromY = m.y = to[1]; m.rx = m.x; m.ry = m.y; m.moveT1 = 0;
        spray(m, 'ecto', 1, false);
        log(`The ${mb.name} comes apart into shadow and gathers itself again across the hall. Grave-cold gathers in its hands.`, 'bad');
      }
      m.nextAct = G.t + 1200;
    } else if (m.phase === 2) {
      snuffTorches(m);
      m.riteReady = G.t + 2500;
      m.nextAct = G.t + 900;
      log(`The torches gutter and die. In the dark the ${mb.name} quickens, and turns toward the Heart.`, 'bad');
      fx.shakeAmp = 5; fx.shakeMs = 600; fx.shakeUntil = realNow + 600;
    }
    Sound.play('special');
  }
  /** Where the lich reappears: open floor three to five steps from the hero, in a straight line so it can throw at them, ahead of them where it can. */
  function blinkSpot(m) {
    const L = lvl();
    ensureDist();
    const out = [];
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
      const dd = distField[y * L.w + x];
      if (dd < 3 || dd > 5 || tile(x, y) !== T.FLOOR || monsterAt(x, y) || npcAt(x, y)) continue;
      if (hasLineToPlayer({ x, y }, 5, true)) out.push([x, y]);
    }
    // somewhere ahead of the hero if it can: vanishing behind them reads as a cheat
    const p = P(), [fx0, fy0] = DIRS[p.dir];
    const ahead = out.filter(([x, y]) => (x - p.x) * fx0 + (y - p.y) * fy0 > 0);
    return ahead.length ? Dice.pick(ahead) : out.length ? Dice.pick(out) : null;
  }
  /** The room a monster stands in, or a box round it where it stands in none. */
  function roomOf(m) {
    const L = lvl();
    return (L.rooms || []).find(r => m.x >= r.x && m.x < r.x + r.w && m.y >= r.y && m.y < r.y + r.h) || { x: m.x - 6, y: m.y - 6, w: 13, h: 13 };
  }
  /** Every torch in and round the lich's hall goes out, until the lich falls. */
  function snuffTorches(m) {
    const L = lvl(), r = roomOf(m);
    const near = (x, y) => x >= r.x - 1 && x <= r.x + r.w && y >= r.y - 1 && y <= r.y + r.h;
    m.snuffed = [];
    for (let y = r.y - 1; y <= r.y + r.h; y++) for (let x = r.x - 1; x <= r.x + r.w; x++) {
      if (tile(x, y) === T.TORCH) { setTile(x, y, T.WALL); m.snuffed.push([x, y]); }
    }
    m.lights = (L.lights || []).filter(l => near(l.x, l.y));
    L.lights = (L.lights || []).filter(l => !near(l.x, l.y));   // a new list, so the lighting is worked out afresh
  }
  function relightTorches(m) {
    const L = lvl();
    for (const [x, y] of m.snuffed || []) setTile(x, y, T.TORCH);
    if (m.lights && m.lights.length) L.lights = (L.lights || []).concat(m.lights);
    m.snuffed = []; m.lights = [];
  }
  /** The lich's end: its bones burst apart, its cold light goes up, and the torches catch again. */
  function bossFalls(m) {
    spray(m, 'bone', 1, false); spray(m, 'bone', 1, false); spray(m, 'ecto', 1, false);
    relightTorches(m);
    fx.shakeAmp = 7; fx.shakeMs = 900; fx.shakeUntil = realNow + 900;
    log('The torches catch again, one by one.', 'good');
  }
  /** Two skeletons sharing a square beside the lich. */
  function raiseGuards(m) {
    const p = P();
    // the nearest open squares the lich could walk to, never behind a wall
    const spots = [], seen = new Set([key(m.x, m.y)]);
    let ring = [[m.x, m.y]];
    for (let r = 1; r <= 3 && !spots.length; r++) {
      const next = [];
      for (const [cx, cy] of ring) for (const [dx, dy] of DIRS) {
        const x = cx + dx, y = cy + dy, k = key(x, y);
        if (seen.has(k) || !passable(x, y)) continue;
        seen.add(k); next.push([x, y]);
        if (tile(x, y) === T.FLOOR && !monsterAt(x, y) && !npcAt(x, y) && !(x === p.x && y === p.y)) spots.push([x, y]);
      }
      ring = next;
    }
    if (!spots.length) return;
    const [x, y] = Dice.pick(spots);
    const b = MONSTERS.skeleton, hp = () => Dice.dice(b.hp[0], b.hp[1], b.hp[2]);
    const g = newMonster('skeleton', x, y, hp());
    const h2 = hp(); g.pack = [{ hp: h2, maxHp: h2 }]; g.risen = true;
    log(`The ${mstat(m).name} raises its hands, and the dead climb out of the floor to guard it!`, 'bad');
    learn(m.id, 'trick');
    Sound.play('growl');
  }
  /** A monster that appears mid-fight, awake and already hunting. */
  function newMonster(id, x, y, hp) {
    const m = {
      uid: 900000 + (G.nextUid = (G.nextUid || 0) + 1), id, x, y,
      hp, maxHp: hp, awake: true, nextAct: G.t + WAKE_BEAT, rx: x, ry: y,
      fromX: x, fromY: y, moveT0: 0, moveT1: 0, flashUntil: 0,
    };
    lvl().monsters.push(m);
    return m;
  }
  const BLOW_GAP = 250;    // ms between any two blows landing on you
  function updateMonsters() {
    const L = lvl(), p = P();
    ensureDist();
    for (const m of L.monsters.slice()) {
      const mb = mstat(m);
      if (mb.boss && m.awake && !m.spoke) {
        m.spoke = true;
        log(`A cold voice fills the hall: "Another thief, come for my Heart. Stay, then. Stay for ever."`, 'bad');
        fx.shakeAmp = 4; fx.shakeMs = 500; fx.shakeUntil = realNow + 500;
      }
      if (m.collapsed) {
        if (G.t >= m.collapsed) {
          m.collapsed = 0; m.hp = Math.ceil(m.maxHp / 2); m.awake = true; m.nextAct = G.t + WAKE_BEAT;
          log(`The bones knit together: the ${mb.name} rises again!`, 'bad');
          Sound.play('growl');
        }
        continue;
      }
      if (m.dot && G.t >= m.dot.next) {
        const dot = m.dot;
        if (dot.next > dot.until) m.dot = null;
        else {
          dot.next += 1000;
          damageMonster(m, dot.kind === 'venom' ? d(1, 3) : d(1, 4), dot.kind);
          if (!L.monsters.includes(m) || m.collapsed) continue;
        }
      }
      if (mb.regen && m.hp < m.maxHp && !(m.burnUntil > G.t) && G.t >= (m.nextRegen || 0)) {
        m.hp = Math.min(m.maxHp, m.hp + mb.regen); m.nextRegen = G.t + 1000;
        if (G.met && G.met[m.uid]) learn(m.id, 'trick');   // you watched its wounds close
      }
      if (G.t < m.nextAct) continue;
      const di = distField[m.y * L.w + m.x];
      if (!m.awake) {
        // Thieves move quietly, so their double blow on a sleeping foe can
        // actually happen: at six squares almost nothing stayed asleep long
        // enough to be reached. Deep-born blood stacks with it.
        const notice = Math.max(2, 6 - (P().bg === 'deepborn' ? 2 : 0) - (P().cls === 'thief' ? 2 : 0) - (hasPower('quiet') ? 1 : 0));
        // Waking is not acting. The growl used to land in the same frame as the
        // first blow from anything that woke beside you, so the only warning was
        // the damage. Give the growl a beat to be heard and turned toward.
        if (di >= 0 && di <= notice) {
          m.awake = true; Sound.play('growl'); m.nextAct = G.t + WAKE_BEAT; meet(m);
          // woken right beside you, its first blow is already being drawn back
          if (Math.abs(m.x - p.x) + Math.abs(m.y - p.y) === 1) beginWindup(m, 'melee', WAKE_BEAT);
          continue;
        }
        else { if (Math.random() < 0.25) wander(m); m.nextAct = G.t + mb.speed * 1.5; continue; }
      }
      if (di < 0 || di > 12) {
        // it has lost you; after a while it stops hunting and settles again
        if (!m.lostAt) m.lostAt = G.t;
        else if (G.t - m.lostAt > 7000) { m.awake = false; m.lostAt = 0; }
        m.windup = null; m.volley = null;  // a blow drawn at you is dropped once it has lost you
        if (Math.random() < 0.3) wander(m);
        m.nextAct = G.t + mb.speed * 1.5;
        continue;
      }
      m.lostAt = 0;
      if (m.fleeing) {
        // run for the darkness; recover nerve once far enough away
        if (di > 8) { m.fleeing = false; m.nextAct = G.t + mb.speed; continue; }
        let away = null, ad = di;
        for (const [dx, dy] of DIRS) {
          const nx = m.x + dx, ny = m.y + dy;
          if (nx < 0 || ny < 0 || nx >= L.w || ny >= L.h) continue;
          const dd = distField[ny * L.w + nx];
          if (dd > ad && !monsterAt(nx, ny)) { ad = dd; away = [nx, ny]; }
        }
        if (away) { moveMonster(m, away[0], away[1]); m.nextAct = G.t + mb.speed; continue; }
        m.fleeing = false; // cornered: fight on
      }
      const adjacent = Math.abs(m.x - p.x) + Math.abs(m.y - p.y) === 1;
      const shot = !adjacent && mb.ranged && hasLineToPlayer(m, mb.ranged.range, !!mb.boss);
      // Blows from several attackers used to land in one frame, read as one
      // hit, and kill faster than anyone could turn. Space them so each one
      // is its own flash, sound and line of the log.
      if (m.volley) {
        // the rest of a group's volley, each blow a beat behind the last;
        // step out of reach and the ones still to come hit the air
        const inReach = m.volley.kind === 'melee' ? adjacent : shot;
        // the ones cut down mid-volley have no blow left to land
        m.volley.left = Math.min(m.volley.left, packSize(m) - 1);
        if (m.volley.left <= 0) { m.nextAct = Math.max(G.t + 120, m.volley.next); m.volley = null; continue; }
        if (inReach && G.t < (G.blowGate || 0)) { m.nextAct = G.blowGate; continue; }
        if (inReach) {
          monsterAttack(m); G.blowGate = G.t + BLOW_GAP;
          if (G.status !== 'playing') return;
        }
        m.volley.left--;
        if (!inReach || m.volley.left <= 0) {
          if (!inReach) { log(`The rest of the ${mb.name}s swing at the air where you stood.`, 'good'); m.pressing = true; }
          m.nextAct = Math.max(G.t + 120, m.volley.next);
          m.volley = null;
        } else m.nextAct = G.t + BLOW_GAP;
        continue;
      }
      if (m.windup && m.windup.move) { resolveMove(m, mb, m.windup); if (G.status !== 'playing') return; continue; }
      if (!m.windup && startMove(m, mb, adjacent)) continue;
      if (m.windup) {
        // the blow comes down: on you if you are still there, on the air if not
        const w = m.windup;
        const cycle = w.kind === 'shot' ? mb.speed * 1.3 : mb.speed;
        const inReach = w.kind === 'melee' ? adjacent : shot;
        if (inReach && G.t < (G.blowGate || 0)) { m.nextAct = G.blowGate; continue; }   // held a beat, still coming
        m.windup = null;
        if (w.kind === 'melee') m.blows = (m.blows || 0) + 1;
        if (inReach) {
          if (w.kind === 'melee') monsterAttack(m); else rangedAttack(m);
          G.blowGate = G.t + BLOW_GAP;
          if (G.status !== 'playing') return;
          // a group draws back together and swings as a volley: one warning,
          // every member's blow, the same blows a minute as swinging in turn
          if (w.kind === 'melee' && packSize(m) > 1) {
            m.volley = { kind: 'melee', left: packSize(m) - 1, next: w.at + cycle };
            m.nextAct = G.t + BLOW_GAP;
            continue;
          }
        } else {
          log(w.kind === 'melee' ? `The ${mb.name} swings at the air where you stood.` : `The ${mb.name}'s shot flies wide as you move.`, 'good');
          Sound.play('miss');
          // made to miss, it presses in: the next blow is drawn back faster, so
          // stepping away is a save, not a loop that keeps it from ever landing
          m.pressing = true;
          m.lungeAt = realNow;               // it still swings, at nothing
          if (w.kind === 'melee') riposte();
        }
        m.nextAct = G.t + Math.max(120, cycle - (w.until - w.at));
        continue;
      }
      if (adjacent || shot) {
        const cycle = shot && !adjacent ? mb.speed * 1.3 : mb.speed;
        beginWindup(m, adjacent ? 'melee' : 'shot', windupFor(cycle));
        continue;
      }
      let best = null, bd = di;
      for (const [dx, dy] of DIRS) {
        const nx = m.x + dx, ny = m.y + dy;
        if (nx < 0 || ny < 0 || nx >= L.w || ny >= L.h) continue;
        const dd = distField[ny * L.w + nx];
        if (dd >= 0 && dd < bd && !monsterAt(nx, ny) && !npcAt(nx, ny) && !(nx === p.x && ny === p.y)) { bd = dd; best = [nx, ny]; }
      }
      const moveSpeed = Math.max(300, Math.round(mb.speed * 0.45));
      if (best) {
        if (tile(best[0], best[1]) === T.DOOR) { setTile(best[0], best[1], T.DOOR_OPEN); log('Something opens a door nearby.', 'bad'); Sound.play('door'); }
        else moveMonster(m, best[0], best[1]);
        m.nextAct = G.t + moveSpeed;
        // Stepping up to you, it draws back as it comes, so its first blow
        // lands exactly when it always did: the warning costs a watchful
        // player nothing and gives an unwatchful one nothing either.
        // the first blow of a fight gets the full warning, even from something quick
        if (Math.abs(m.x - p.x) + Math.abs(m.y - p.y) === 1) beginWindup(m, 'melee', Math.max(moveSpeed, windupFor(mb.speed)));
        else if (mb.ranged && hasLineToPlayer(m, mb.ranged.range, !!mb.boss)) beginWindup(m, 'shot', Math.max(moveSpeed, windupFor(mb.speed * 1.3)));
      } else m.nextAct = G.t + mb.speed;
    }
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
    // out of combat and unpursued, wounds close slowly on their own
    if (p.hp < p.maxHp && p.food > 0 && G.t - (p.lastHurt || 0) > 5000 && G.t >= (p.nextRegen || 0)) {
      ensureDist();
      const L = lvl();
      const hunted = L.monsters.some(m => m.awake && distField[m.y * L.w + m.x] >= 0 && distField[m.y * L.w + m.x] <= 6);
      if (!hunted) {
        // scale with the pool so recovery takes about the same time at every level
        const hardy = (p.cls === 'fighter' ? 1.6 : 1) + (p.perkRegen || 0);
        p.hp = Math.min(p.maxHp, p.hp + Math.max(1, Math.round(p.maxHp / 35 * hardy)));
        p.nextRegen = G.t + (p.cls === 'fighter' ? 1900 : 2200);
        emit('stats');
      } else p.nextRegen = G.t + 1200;
    }
    if (p.hp < p.maxHp && effectFrom('ac', 'protection') && hasTalent('warding_light') && G.t >= (p.nextWard || 0)) {
      p.hp++; p.nextWard = G.t + 3000; emit('stats');
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
      else if (G.t >= p.poison.next) { p.poison.next = G.t + 2000; hurtPlayer(1, 'The poison burns in your veins.'); }
    }
    for (const k in p.effects) if (p.effects[k].until <= G.t) { delete p.effects[k]; if (k === 'ac' && p.mirrors) { p.mirrors = 0; log('Your images fade with the shield.'); } log(k === 'ac' ? 'Your magical protection fades.' : (k === 'hit' ? 'The blessing fades.' : 'You feel less mighty.')); }
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
        else if (act === 'left') turn(-1);
        else turn(1);
        break;
      case 'attack': case 'cast': case 'use': case 'rest':
        if (P().held > G.t) { blocked('You are frozen in place!'); return; }
        if (act !== 'attack') { if (act === 'use') use(); else if (act === 'cast') castLast(); else rest(); return; }
        // a tap a moment early is kept and spent the instant the blow is ready,
        // rather than dropped: a player cannot see the swing timer
        if (G.t < P().nextAttack) { if (P().nextAttack - G.t <= 350) queuedAttack = true; }
        else attack();
        break;
    }
  }

  // ---------- render state ----------
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
      out.push({ rel, near: dist === 1, tell: !!(m.windup || m.volley), special: !!(m.windup && m.windup.move) });
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
    const hu = (m.flashUntil - now) / 130;
    if (hu > 0) { push -= 0.1 * hu; sqx *= 1 + 0.12 * hu; sqy *= 1 - 0.1 * hu; }
    return { dx: tx * push, dy: ty * push, lift, sqx, sqy };
  }
  function renderState(now) {
    const L = lvl();
    const sprites = [];
    for (const m of L.monsters) {
      if (m.moveT1 > now) {
        const t = (now - m.moveT0) / (m.moveT1 - m.moveT0);
        m.rx = m.fromX + (m.x - m.fromX) * t; m.ry = m.fromY + (m.y - m.fromY) * t;
      } else { m.rx = m.x; m.ry = m.y; }
      const mb = MONSTERS[m.id];
      const bob = mb.fly ? Math.sin(now / 250 + m.uid) * 0.05 : 0;
      const base = Assets.sprites[mb.sprite];
      const img = (m.elite && base.elite && base.elite[m.elite]) ? base.elite[m.elite] : base;
      const n = packSize(m);
      // how far through its wind-up it is, for the tell drawn over it
      const tell = m.volley ? 1 : m.windup ? Math.min(1, Math.max(0.05, (G.t - m.windup.at) / Math.max(1, m.windup.until - m.windup.at))) : 0;
      // a monster's own trick is marked in violet, so it reads as more than a blow
      const special = !!(m.windup && m.windup.move);
      if (m.collapsed) {
        // a heap of bones on the floor, a ring round it filling as it pulls itself together
        const rising = Math.min(1, Math.max(0.02, 1 - (m.collapsed - G.t) / RISE_MS));
        sprites.push({ x: m.rx + 0.5, y: m.ry + 0.5, img: Assets.sprites.bone_heap || img, scale: mb.scale * 0.95, yOff: 0, flash: m.flashUntil, heap: rising });
        continue;
      }
      if (n === 1) {
        const mo = motion(m, now, 0, tell);
        sprites.push({ x: m.rx + 0.5 + mo.dx, y: m.ry + 0.5 + mo.dy, img, scale: mb.scale, yOff: (mb.fly || 0) + bob + mo.lift, sqx: mo.sqx, sqy: mo.sqy, flash: m.flashUntil, hp: m.hp, maxHp: m.maxHp, tell, special });
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
          flash: i === 0 ? m.flashUntil : 0, ...(i === 0 ? { hp: m.hp, maxHp: m.maxHp, tell } : {}) });
      });
    }
    for (const n of (L.npcs || [])) {
      const look = n.kind === 'encounter' ? ENCOUNTERS[n.id] : null;
      sprites.push({ x: n.x + 0.5, y: n.y + 0.5, img: Assets.sprites[look ? look.sprite : 'merchant'] || Assets.sprites.merchant, scale: look ? 0.85 : 0.95, yOff: 0 });
    }
    for (const k in L.items) {
      const list = L.items[k];
      if (!list.length) continue;
      const [x, y] = k.split(',').map(Number);
      const it = list[list.length - 1];
      // the Heart floats; a relic hovers a little, so it reads as more than iron
      const floats = it.t === 'artifact' || !!it.u;
      sprites.push({ x: x + 0.5, y: y + 0.5, img: Assets.sprites[spriteFor(it)], scale: it.t === 'artifact' ? 0.4 : (it.u ? 0.38 : 0.32), yOff: floats ? 0.04 + Math.sin(now / 300) * 0.03 : 0 });
    }
    // the fallen: knocked back, sinking into a heap and fading
    for (const c of fx.corpses) {
      const art = Assets.sprites[c.sprite];
      if (!art) continue;
      const u = Math.min(1, (now - c.born) / CORPSE_MS);
      const back = Math.sin(Math.min(1, u * 1.6) * Math.PI / 2) * 0.18;
      sprites.push({ x: c.x + c.dx * back, y: c.y + c.dy * back, img: (c.elite && art.elite && art.elite[c.elite]) || art, scale: c.scale, yOff: c.fly * (1 - u),
        sqx: 1 + 0.3 * u, sqy: Math.max(0.12, 1 - 0.85 * u * u), alpha: 1 - u * u, flash: u < 0.15 ? now + 1 : 0 });
    }
    // what the hero holds, for the view at the bottom of the screen
    const p = P(), wIt = p.eq.weapon;
    // the lich's life across the top of the view, once it has woken and spoken
    const boss = L.monsters.find(m => MONSTERS[m.id].boss && m.spoke && !m.collapsed);
    fx.boss = boss ? { name: MONSTERS[boss.id].name, hp: boss.hp, maxHp: boss.maxHp, phase: boss.phase || 0, rite: !!(boss.windup && boss.windup.move === 'rite') } : null;
    // what ails or aids the hero, tinted over the view
    fx.status = { poison: !!p.poison, held: (p.held || 0) > G.t, webbed: (p.webbed || 0) > G.t, grabbed: !!p.grabbed,
      ac: !!effect('ac'), hit: !!effect('hit'), might: !!effect('might'), starving: p.food === 0 };
    fx.view = {
      weapon: wIt ? spriteFor(wIt) : null, two: !!(wIt && ITEMS[wIt.t].twoHanded), drawn: !!(wIt && ITEMS[wIt.t].sprite === 'shortbow'),
      shield: p.eq.shield ? spriteFor(p.eq.shield) : null, offhand: p.eq.offhand ? spriteFor(p.eq.offhand) : null,
      cls: p.cls, walk: cam.moving ? camProgress() : 0, steps: p.steps,
    };
    fx.threats = threats();
    return { level: L, cam, sprites, fx };
  }

  // ---------- save / load ----------
  function save(auto) {
    if (!G || G.status !== 'playing') return false;
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
    try {
      const data = JSON.parse(s);
      if (!data || !data.player || !data.levels) return false;
      G = data;
      G.status = 'playing';
      for (const dpt in G.levels) {
        if (!G.levels[dpt].features) G.levels[dpt].features = {};
        if (!G.levels[dpt].lights) G.levels[dpt].lights = [];
        if (!G.levels[dpt].npcs) G.levels[dpt].npcs = [];
      }
      // a run saved on the climb out, from when the Heart had to be carried to
      // the surface, is won: the Heart was already in hand
      const wasEscaping = !!G.escaping;
      for (const k of ['escaping', 'escapeStart', 'nextHunt', 'hunts', 'escapeMs']) delete G[k];
      if (!G.journal) G.journal = [];
      if (G.logSeq == null) G.logSeq = G.log ? G.log.length : 0;
      if (G.player.eq.offhand === undefined) G.player.eq.offhand = null;
      if (!G.pendingBoons) G.pendingBoons = [];
      if (!G.player.bg) G.player.bg = 'oathbroken';
      if (!G.looks) G.looks = buildLooks(G.seed);
      // a run from before relics finds them on the floors it has yet to see
      if (!G.relics) G.relics = { ...relicPlan(G.seed, G.player.cls, G.opts.levels), offered: 0, found: [] };
      // a run from before the end screen kept its numbers counts from here on
      G.stats = { ...freshStats(), ...G.stats };
      if (!G.known) { G.known = {}; for (const id in ITEMS) G.known[id] = 1; }
      for (const dpt in G.levels) for (const m of G.levels[dpt].monsters) { m.nextAct = G.t + 800; m.rx = m.x; m.ry = m.y; m.moveT1 = 0; m.flashUntil = 0; m.windup = null; m.volley = null; }
      lastBlocked = -1e9; queuedAttack = false; queuedMove = null;
      snapCam();
      distFieldAt = -1e9;
      clearFx();
      log('Game loaded.', 'info');
      emit('level');
      if (wasEscaping) { fx.heartAt = realNow; win(); }
      return true;
    } catch (e) { return false; }
  }
  function saveSummary() {
    try {
      const s = localStorage.getItem(SAVE_KEY);
      if (!s) return null;
      const g = JSON.parse(s);
      return { name: g.player.name, cls: CLASSES[g.player.cls].name, level: g.player.level, depth: g.depth, seed: g.seed };
    } catch (e) { return null; }
  }

  return {
    newGame, load, save, hasSave, saveSummary, rollStats, hall,
    update, tick, input, renderState, takeEvents,
    state: () => G, player: P, level: lvl, log, mod,
    itemName, relicOf, hasPower, spriteFor, equip, unequip, useItem, dropItem, takeItem, floorItems, canEquip, isKnown, mstat,
    offhandReason, offhandWeapon, canDualWield, rollsShown, toggleRolls, useLabel, stairsBeside,
    statCheck, checkChance, checkBonus, charm, study, studyReason, STUDY_DC,
    currentEncounter: () => encounter, encounterOptions, chooseEncounter, closeEncounter,
    pendingLevel, levelNote, currentShop, closeShop, buy, sell, buyPrice, sellPrice, shopServices, buyService,
    pendingBoons, chooseBoon, epilogue, journal: () => (G && G.journal) || [], pagesInDungeon,
    bestiary, runStats, lastAttacker: () => (G && G.lastAttacker) || null, deathLog: () => (G && G.deathLog) || [],
    knownSpells, spellAvailable, castSpell, rest, toHit, playerAC, weapon, effect, skillDamage, critFloor,
    wasteReason, spellWasteReason, attackReady, castLabel, score, finaleLeft,
    /** The lich is awake and fighting: the drone under the dungeon tightens. */
    bossAwake: () => !!(G && G.status === 'playing' && lvl().monsters.some(m => MONSTERS[m.id].boss && m.spoke)),
    INV_MAX, T,
  };
})();

export { Game };
