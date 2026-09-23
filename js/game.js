import { Rng, Dice, d } from './rng.js';
import { BACKGROUNDS, JOURNAL, BOONS, XP_TABLE, MAX_LEVEL, CLASSES, ITEMS, TRAP_TYPES, MONSTERS, SPELLS, POTION_LOOKS, SCROLL_LOOKS, ELITES, THEMES } from './data.js';
import { Assets } from './assets.js';
import { Dungeon } from './dungeon.js';
import { ENCOUNTERS, encounterDc } from './encounters.js';
import { RELICS, GIANTS, relicPlan } from './relics.js';
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
               hurtFrom: -1, hurtFromUntil: 0, castColor: '#fff', texts: [] };
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
  // the roll at or above which an attack is a critical hit
  function critFloor() {
    const p = P();
    const base = p.cls !== 'thief' ? 20 : (p.level >= 9 ? 18 : 19);
    return base - (hasPower('keen', 'weapon') ? 1 : 0);
  }
  function skillDamage() { return Math.floor((P().level - 1) / 3); }
  function weapon() {
    const p = P();
    const spd = skillSpeed() * (p.eq.offhand ? DUAL_SWING_COST : 1);
    if (!p.eq.weapon) return { name: 'fists', dmg: [1, 2, 0], speed: Math.round(450 * spd), e: 0, range: 0 };
    const b = ITEMS[p.eq.weapon.t];
    const swift = hasPower('swift', 'weapon') ? 0.85 : 1;
    return { name: b.name, dmg: b.dmg, speed: Math.round(b.speed * spd * swift), e: p.eq.weapon.e || 0, twoHanded: !!b.twoHanded, range: b.range || 0 };
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
    return { name: b.name, dmg: b.dmg, e: p.eq.offhand.e || 0 };
  }
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
    return slots.some(s => { const r = relicOf(p.eq[s]); return !!r && r.powers.includes(power); });
  }
  /** Extra damage a bane deals to the monster it was made for. */
  function baneDamage(m, slot) {
    let n = 0;
    if (hasPower('undead', slot) && mstat(m).undead) n += d(1, 6);
    if (hasPower('giant', slot) && GIANTS.includes(m.id)) n += d(1, 8);
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
          if (dist[ni] >= 0 || t === T.WALL || t === T.SECRET || t === T.TORCH || t === T.FOUNTAIN) continue;
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
    if (p.eq.shield) ac += ITEMS[p.eq.shield.t].ac + (p.eq.shield.e || 0);
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
    if (!m.elite) return b;
    const e = ELITES.find(x => x.prefix === m.elite) || NO_ELITE;
    return {
      name: `${m.elite} ${b.name}`, ac: b.ac + (e.ac || 0), hit: b.hit + (e.hit || 0),
      dmg: [b.dmg[0], b.dmg[1], b.dmg[2] + (e.dmg || 0)],
      speed: Math.round(b.speed * (e.speed || 1)), xp: Math.round(b.xp * (e.xp || 1)),
      sprite: b.sprite, scale: b.scale, undead: b.undead, poison: b.poison, fly: b.fly,
      regen: b.regen, boss: b.boss, drain: b.drain, ranged: b.ranged,
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
    p.inv.push({ t: it.t, q: it.q || 1, e: it.e || 0, color: it.color, name: it.name, ...(it.u ? { u: it.u } : {}),
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
      if (b.effect === 'uncurse' && !cursedWorn().length && !hiddenGear().length) return 'Nothing you carry is cursed or unknown.';
    }
    return null;
  }
  function useItem(it) {
    const p = P(), b = ITEMS[it.t];
    const consumable = b.kind === 'food' || b.kind === 'potion' || b.kind === 'scroll';
    if (consumable && p.inv.indexOf(it) < 0) { log('You are not carrying that.', 'bad'); return; }
    if (consumable) {
      const why = wasteReason(it);
      if (why) { log(why, 'bad'); Sound.play('error'); emit('waste'); return; }
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
          if (!targets.length) { log('A ball of fire bursts harmlessly against the stones.'); break; }
          for (const m of targets) damageMonster(m, d(4, 6), 'fire');
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
    if (it.t === 'gold') { p.gold += it.q; log(`You pick up ${it.q} gold.`, 'good'); Sound.play('gold'); list.splice(i, 1); }
    else if (it.t === 'gem') { p.gold += it.q; log(`You find a ${it.name} worth ${it.q} gold.`, 'good'); Sound.play('gold'); list.splice(i, 1); }
    else if (it.t === 'artifact') { list.splice(i, 1); startEscape(); }
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
    G = { seed: cfg.seed, opts: cfg.opts, player: p, levels: {}, depth: 1, log: [], logSeq: 0, t: 0, status: 'playing', lastSpell: null, created: Date.now(), version: 4, looks: buildLooks(cfg.seed), known: {}, escaping: false, escapeStart: 0, nextHunt: 0, hunts: 0, journal: [], pendingBoons: null };
    G.relics = { ...relicPlan(cfg.seed, cfg.cls, cfg.opts.levels), offered: 0, found: [] };
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
    if (!G.levels[depth]) { G.levels[depth] = Dungeon.generate(G.seed, depth, G.opts); placeRelics(G.levels[depth], depth); }
    G.depth = depth;
    const L = G.levels[depth];
    const s = from === 'down' ? L.start : (L.downStart || L.start);
    p.x = s.x; p.y = s.y; p.dir = s.dir;
    // you arrive beside the stair you came by; that one needs no announcing
    const came = stairsBeside();
    besideKey = came ? came.key : '';
    for (const m of L.monsters) { m.nextAct = G.t + 600 + Math.random() * 600; m.rx = m.x; m.ry = m.y; m.moveT1 = 0; }
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
  function descend() {
    Sound.play('stairs');
    enterLevel(G.depth + 1, 'down');
    save(true);
  }
  function ascend() {
    if (G.depth === 1) {
      if (G.escaping) { win(); return; }
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
      // the entrance stays sealed until you carry the Heart, so it is no way on
      if (t === T.STAIRS_UP && G.depth === 1 && !G.escaping) continue;
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
    if (t === T.DOOR_LOCKED) return 'Unlock';
    if (t === T.STAIRS_DOWN) return 'Descend';
    if (t === T.STAIRS_UP) return G.depth > 1 ? 'Climb' : (G.escaping ? 'Escape' : 'Use');
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
    if (G.t - lastBlocked > 700) { log(message); lastBlocked = G.t; }
  }
  function openDoor(x, y) { setTile(x, y, T.DOOR_OPEN); log('You push the door open.'); Sound.play('door'); }
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
    if (p.maxSp && p.sp < p.maxSp && p.steps % 9 === 0) p.sp++;
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
    if (tr.poison && !p.poison && !hasPower('pure')) { p.poison = { until: G.t + 20000, next: G.t + 2000 }; log('You are poisoned!', 'bad'); }
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
    log('There is nothing to use here.');
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
    return Math.max(2, Math.round(v * shop.markup * (1 + (it.e || 0) * 0.9) * (1 - charm())));
  }
  function sellPrice(it) {
    const r = relicOf(it);
    if (r) return Math.round(r.value * 0.45 * (1 + charm()));
    const v = ITEMS[it.t].value || 1;
    // unknown gear goes for the price of a plain one; the trader will not tell
    const e = it.h ? 0 : (it.e || 0);
    return Math.max(1, Math.round(v * 0.45 * Math.max(0.2, 1 + e * 0.8) * (1 + charm())));
  }
  // ---------- encounters ----------
  // A choice the dungeon puts to you (see encounters.js). While one is open
  // the game waits, as it does for the trader, and the prop that started it
  // is gone once it has been answered.
  let encounter = null;
  let queuedAttack = false;
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
      if (e.poison && !p.poison && !hasPower('pure')) { p.poison = { until: G.t + 20000, next: G.t + 2000 }; out.push('Poisoned'); }
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
    const one = { t: it.t, q: 1, e: it.e || 0, ...(it.u ? { u: it.u } : {}) };
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
    const ex = !one.u && shop.stock.find(s => s.t === one.t && (s.e || 0) === (one.e || 0) && !s.u);
    if (junk) { /* gone */ } else if (ex) ex.q++; else shop.stock.push({ t: one.t, q: 1, e: one.e || 0, ...(one.u ? { u: one.u } : {}) });
    log(`You sell ${the(one)} for ${price} gold.`, 'good');
    Sound.play('gold');
    emit('inv'); emit('stats');
    return true;
  }

  // ---------- combat ----------
  function floatText(m, text, color) {
    fx.texts.push({ x: m.rx + 0.5, y: m.ry + 0.5, text: String(text), color, born: realNow, until: realNow + 750 });
  }
  function attack() {
    const p = P();
    if (G.t < p.nextAttack) return;
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
    if (!m) { Sound.play('miss'); return; }
    if (atRange) Sound.play('arrow');
    const mb = mstat(m);
    const sneak = p.cls === 'thief' && !atRange && (!m.awake || m.fleeing);
    m.awake = true;
    const roll = d(1, 20);
    const crit = roll >= critFloor();
    const note = rollNote(roll, toHit(), mb.ac, crit);
    if (roll === 1 || (!crit && roll + toHit() < mb.ac)) {
      log(`You miss the ${mb.name}.${note}`);
      Sound.play('miss');
      floatText(m, 'miss', '#e4e4ee');
      return;
    }
    // Thieves strike where it counts rather than swinging hard, so their bonus
    // comes from dexterity and does not scale with the weight of the weapon.
    const finesse = p.cls === 'thief';
    const flat = (finesse ? mod(p.stats.dex) : mod(p.stats.str)) + skillDamage() + (effect('might') ? 2 : 0);
    const baseSpeed = p.eq.weapon ? ITEMS[p.eq.weapon.t].speed : 450;
    let dmg = d(...w.dmg) + w.e + Math.round(finesse ? flat : flat * (baseSpeed / 700)) + baneDamage(m, 'weapon');
    if (crit) dmg *= 2;
    if (sneak) dmg *= 2;
    dmg = Math.max(1, dmg);
    leech(Math.min(dmg, m.hp), 'weapon');   // only what it actually drew
    damageMonster(m, dmg, crit ? 'crit' : (sneak ? 'sneak' : null), note);
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
    const mb = mstat(m);
    m.hp -= dmg;
    m.awake = true;
    m.flashUntil = realNow + 130;
    floatText(m, dmg, tag === 'crit' ? '#ff4' : (tag === 'fire' ? '#f84' : '#fff'));
    Sound.play('hit');
    buzz(12);
    if (m.hp <= 0) { killMonster(m, note); return; }
    if (tag === 'offhand') { log(`Your off hand finds the ${mb.name} for ${dmg}.${note || ''}`); }
    else if (tag === 'thorns') { log(`Your barbs bite the ${mb.name} for ${dmg}.`); }
    else {
      const pre = tag === 'crit' ? 'A mighty blow! ' : (tag === 'sneak' ? 'You strike from the shadows! ' : '');
      log(`${pre}You hit the ${mb.name} for ${dmg}.${note || ''}`);
    }
    // wounded, non-boss monsters may break and run
    if (!mb.boss && m.hp <= m.maxHp * 0.25 && !m.fleeing && Math.random() < 0.3) {
      m.fleeing = true;
      log(`The ${mb.name} turns to flee!`, 'good');
    }
  }
  function killMonster(m, note) {
    const L = lvl(), p = P(), mb = mstat(m);
    const at = L.monsters.indexOf(m);
    if (at < 0) return;                    // already removed by something else
    L.monsters.splice(at, 1);
    p.kills++;
    p.xp += mb.xp;
    log(`The ${mb.name} is destroyed!${note || ''} (+${mb.xp} xp)`, 'good');
    if (mb.boss) log('The dread presence lifts. The Heart of the Mountain is unguarded.', 'good');
    // champions and bosses always drop something worthwhile
    if (Math.random() < 0.4 || mb.boss || m.elite) {
      const k = key(m.x, m.y);
      const loot = Dungeon.rollLoot(Dice, G.depth + (m.elite ? 2 : 0));
      (L.items[k] = L.items[k] || []).push(loot);
    }
    checkLevelUp();
    emit('stats');
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
      if (p.level % 3 === 0) offerBoons();   // a choice every third level
    }
  }
  // Three things experience could have taught you. You keep one.
  function offerBoons() {
    const p = P();
    const taken = p.boons || [];
    const pool = BOONS.filter(b => (!b.when || b.when(p)) && !(b.unique && taken.includes(b.id)));
    const picked = Dice.shuffle(pool.slice()).slice(0, 3).map(b => b.id);
    G.pendingBoons = (G.pendingBoons || []).concat([picked]);
    emit('boons');
  }
  function pendingBoons() { return G.pendingBoons && G.pendingBoons.length ? G.pendingBoons[0] : null; }
  function chooseBoon(id) {
    const offer = pendingBoons();
    if (!offer || !offer.includes(id)) return false;
    const boon = BOONS.find(b => b.id === id);
    if (!boon) return false;
    const p = P();
    boon.apply(p);
    p.maxSp = spMax(p);
    p.sp = Math.min(p.maxSp, p.sp);
    p.boons = (p.boons || []).concat(id);
    G.pendingBoons.shift();
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
    const p = P();
    p.hp -= dmg;
    p.lastHurt = G.t;
    if (from) {
      const bearing = relativeBearing(from);
      fx.hurtFrom = bearing ? bearing.rel : 0;
      fx.hurtFromUntil = realNow + 900;
      G.lastAttacker = { name: mstat(from).name, dmg, bearing: bearing ? bearing.word : 'from nearby' };
    }
    fx.damageUntil = realNow + 260;
    fx.shakeUntil = realNow + 220;
    Sound.play('hurt');
    buzz(40);
    if (msg) log(msg, 'bad');
    emit('stats');
    if (p.hp <= 0) die();
  }
  function healPlayer(n) {
    const p = P();
    p.hp = Math.min(p.maxHp, p.hp + n);
    fx.healUntil = realNow + 260;
    Sound.play('heal');
    emit('stats');
  }
  function die() {
    const p = P();
    p.hp = 0;
    G.status = 'dead';
    G.deathLog = G.log.slice(-6).map(e => e.m);
    log(`${p.name} has died on level ${G.depth}.`, 'bad');
    Sound.play('die');
    if (G.opts.permadeath) { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } }
    recordHero(false);
    emit('dead');
  }
  // Lifting the Heart wakes the whole mountain. Now carry it back to the surface.
  function startEscape() {
    const p = P();
    p.inv.push({ t: 'artifact', q: 1, e: 0 });   // unique: never blocked by the pack limit
    G.escaping = true;
    G.escapeStart = G.t;
    G.nextHunt = G.t + 16000;
    G.hunts = 0;
    for (const dpt in G.levels) for (const m of G.levels[dpt].monsters) m.awake = true;
    log('You lift the Heart of the Mountain. Its light is warm in your hands.', 'good');
    log('The walls groan. Every dead thing in the mountain now knows where you are.', 'bad');
    log(`Climb back to level 1 and take the stairs out. You are ${G.depth} levels down.`, 'info');
    Sound.play('win');
    fx.shakeUntil = realNow + 900;
    emit('stats');
    emit('escape');
  }
  // While escaping, the dark keeps producing pursuers.
  function spawnHunter() {
    const L = lvl();
    if (L.monsters.length > 40) return;
    ensureDist();
    const cands = [];
    for (let i = 0; i < L.w * L.h; i++) {
      if (L.tiles[i] !== T.FLOOR) continue;
      const dd = distField[i];
      if (dd < 6 || dd > 15) continue;
      if (monsterAt(i % L.w, (i / L.w) | 0) || npcAt(i % L.w, (i / L.w) | 0)) continue;
      cands.push(i);
    }
    if (!cands.length) return;
    const i = Dice.pick(cands);
    const pool = ['skeleton', 'ghoul', 'zombie', 'wraith'];
    const id = pool[Math.min(pool.length - 1, Math.floor(G.hunts / 2))];
    const b = MONSTERS[id];
    const hp = Dice.dice(b.hp[0], b.hp[1], b.hp[2]);
    L.monsters.push({
      uid: 900000 + G.hunts * 17 + Math.floor(Math.random() * 1000), id, x: i % L.w, y: (i / L.w) | 0,
      hp, maxHp: hp, awake: true, nextAct: G.t + 500, rx: i % L.w, ry: (i / L.w) | 0,
      fromX: i % L.w, fromY: (i / L.w) | 0, moveT0: 0, moveT1: 0, flashUntil: 0,
    });
    G.hunts++;
    log(Dice.pick([
      'Something claws its way out of the dark behind you.',
      'Bone scrapes on stone. It is closer than before.',
      'The air turns cold. You are not alone in this corridor.',
    ]), 'bad');
    Sound.play('growl');
  }

  function win() {
    G.status = 'won';
    G.escapeMs = G.escaping ? G.t - G.escapeStart : 0;
    log('You climb into daylight with the Heart of the Mountain. You have escaped!', 'good');
    Sound.play('win');
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
    recordHero(true);
    emit('won');
  }
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
      lines.push(`${p.name} got as far as level ${p.deepest} of the Deepdelve, which is further than the fourth crew managed.`);
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
  /** Why casting this now would waste the points, or null if it would not. */
  function spellWasteReason(sp) {
    const p = P();
    if (sp.kind === 'heal' && p.hp >= p.maxHp) return `You are unhurt. ${sp.name} would be wasted.`;
    if (sp.kind === 'bolt' && !boltTargets(sp.range, sp.pierce).length) {
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
  function castSpell(sp) {
    const p = P();
    if (!spellAvailable(sp)) { log(`You are not experienced enough to cast ${sp.name}.`, 'bad'); return false; }
    if (p.sp < sp.cost) { log('Not enough spell points.', 'bad'); Sound.play('error'); return false; }
    const waste = spellWasteReason(sp);
    if (waste) { log(waste, 'bad'); Sound.play('error'); emit('waste'); return false; }
    if (G.t < p.nextAttack) { blocked('You are still recovering from your last action.'); return false; }
    p.nextAttack = G.t + (cls().castMs || CAST_MS);
    p.sp -= sp.cost;
    G.lastSpell = sp.id;
    fx.castUntil = realNow + 260; fx.castColor = sp.color;
    Sound.play('spell');
    switch (sp.kind) {
      case 'heal': { const n = d(...sp.heal(p.level)); healPlayer(n); log(`You cast ${sp.name} and heal ${n}.`, 'good'); break; }
      case 'buff': p.effects[sp.stat] = { amount: sp.amount, until: G.t + sp.dur }; log(`You cast ${sp.name}. ${sp.desc}`, 'good'); break;
      case 'bolt': {
        const targets = boltTargets(sp.range, sp.pierce);
        if (!targets.length) { log(`Your ${sp.name} strikes nothing.`); break; }
        for (const m of targets) {
          let dmg = d(...sp.dmg(p.level));
          if (sp.holy && mstat(m).undead) dmg *= 2;
          damageMonster(m, dmg, 'fire');
        }
        break;
      }
    }
    emit('stats');
    return true;
  }
  function castLast() {
    const list = knownSpells();
    if (!list.length) { log('You know no spells. Scrolls can be read from your pack.'); return false; }
    const sp = list.find(s => s.id === G.lastSpell) || list[0];
    return castSpell(sp);
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
  function hasLineToPlayer(m, range) {
    const p = P();
    if (m.x !== p.x && m.y !== p.y) return null;
    const dx = Math.sign(p.x - m.x), dy = Math.sign(p.y - m.y);
    const dist = Math.abs(p.x - m.x) + Math.abs(p.y - m.y);
    if (dist > range || dist < 2) return null;
    for (let i = 1; i < dist; i++) {
      const x = m.x + dx * i, y = m.y + dy * i;
      if (!passable(x, y) || monsterAt(x, y)) return null;
    }
    return dist;
  }
  function rangedAttack(m) {
    const mb = mstat(m), r = mb.ranged;
    const roll = d(1, 20);
    const ac = playerAC();
    const note = rollNote(roll, mb.hit, ac, roll === 20);
    Sound.play('arrow');
    if (roll === 1 || (roll !== 20 && roll + mb.hit < ac)) { log(`The ${mb.name} ${r.verb} you and misses.${note}`); return; }
    let dmg = Math.max(1, d(...r.dmg));
    if (roll === 20) dmg *= 2;
    const where = relativeBearing(m);
    const aside = where && where.rel !== 0 ? ` ${where.word}` : '';
    hurtPlayer(dmg, `The ${mb.name} ${r.verb} you${aside} for ${dmg}.${note}`, m);
  }
  function monsterAttack(m) {
    const p = P(), mb = mstat(m);
    const roll = d(1, 20);
    const ac = playerAC();
    const note = rollNote(roll, mb.hit, ac, roll === 20);
    if (roll === 1 || (roll !== 20 && roll + mb.hit < ac)) {
      const miss = relativeBearing(m);
      log(`The ${mb.name} misses you${miss && miss.rel !== 0 ? ` ${miss.word}` : ''}.${note}`, miss && miss.rel !== 0 ? 'bad' : '');
      if (miss && miss.rel !== 0) { fx.hurtFrom = miss.rel; fx.hurtFromUntil = realNow + 700; }
      return;
    }
    let dmg = Math.max(1, d(...mb.dmg));
    if (roll === 20) dmg *= 2;
    const where = relativeBearing(m);
    const aside = where && where.rel !== 0 ? ` ${where.word}` : '';
    hurtPlayer(dmg, `The ${mb.name} hits you${aside} for ${dmg}.${note}`, m);
    if (G.status !== 'playing') return;
    if (mb.poison && !p.poison && !hasPower('pure') && Math.random() < mb.poison) { p.poison = { until: G.t + 20000, next: G.t + 2000 }; log('You are poisoned!', 'bad'); }
    // a strong will holds on to itself against the drain
    if (mb.drain && !hasPower('ward') && Math.random() < Math.max(0.05, 0.25 - 0.05 * mod(p.stats.wis))) { p.maxHp = Math.max(10, p.maxHp - 2); p.hp = Math.min(p.hp, p.maxHp); log('You feel your life force drain away!', 'bad'); }
    if (hasPower('thorns')) damageMonster(m, d(1, 4), 'thorns');
  }
  const WAKE_BEAT = 600;   // ms between a monster noticing you and doing anything about it
  const BLOW_GAP = 250;    // ms between any two blows landing on you
  function updateMonsters() {
    const L = lvl(), p = P();
    ensureDist();
    for (const m of L.monsters.slice()) {
      const mb = mstat(m);
      if (mb.regen && m.hp < m.maxHp && G.t >= (m.nextRegen || 0)) { m.hp = Math.min(m.maxHp, m.hp + mb.regen); m.nextRegen = G.t + 1000; }
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
        if (di >= 0 && di <= notice) { m.awake = true; Sound.play('growl'); m.nextAct = G.t + WAKE_BEAT; continue; }
        else { if (Math.random() < 0.25) wander(m); m.nextAct = G.t + mb.speed * 1.5; continue; }
      }
      if (di < 0 || di > 12) {
        // it has lost you; after a while it stops hunting and settles again
        if (!m.lostAt) m.lostAt = G.t;
        else if (G.t - m.lostAt > 7000 && !G.escaping) { m.awake = false; m.lostAt = 0; }
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
      const shot = !adjacent && mb.ranged && hasLineToPlayer(m, mb.ranged.range);
      // Blows from several attackers used to land in one frame, read as one
      // hit, and kill faster than anyone could turn. Space them so each one
      // is its own flash, sound and line of the log.
      if ((adjacent || shot) && G.t < (G.blowGate || 0)) { m.nextAct = G.blowGate; continue; }
      if (adjacent) { monsterAttack(m); G.blowGate = G.t + BLOW_GAP; m.nextAct = G.t + mb.speed; if (G.status !== 'playing') return; continue; }
      if (shot) { rangedAttack(m); G.blowGate = G.t + BLOW_GAP; m.nextAct = G.t + mb.speed * 1.3; if (G.status !== 'playing') return; continue; }
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
    updateCam();
    if (queuedAttack && G.t >= p.nextAttack) { queuedAttack = false; attack(); }
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
    if (p.hp < p.maxHp && G.t >= (p.nextMend || 0) && hasPower('mend')) {
      p.hp++; p.nextMend = G.t + 4000; emit('stats');
    }
    if (p.poison) {
      if (G.t >= p.poison.until) { p.poison = null; log('The poison wears off.', 'good'); }
      else if (G.t >= p.poison.next) { p.poison.next = G.t + 2000; hurtPlayer(1, 'The poison burns in your veins.'); }
    }
    if (G.escaping && G.t >= G.nextHunt) {
      spawnHunter();
      G.nextHunt = G.t + Math.max(9000, 22000 - G.hunts * 900);
    }
    for (const k in p.effects) if (p.effects[k].until <= G.t) { delete p.effects[k]; log(k === 'ac' ? 'Your magical protection fades.' : (k === 'hit' ? 'The blessing fades.' : 'You feel less mighty.')); }
    fx.texts = fx.texts.filter(t => t.until > now);
  }
  function tick(now) { realNow = now; }

  function input(act) {
    if (!G || G.status !== 'playing') return;
    switch (act) {
      case 'forward': case 'back': case 'strafeL': case 'strafeR': case 'left': case 'right':
        if (cam.moving && camProgress() < 0.7) return;
        if (act === 'forward') tryMove(0);
        else if (act === 'back') tryMove(2);
        else if (act === 'strafeR') tryMove(1);
        else if (act === 'strafeL') tryMove(3);
        else if (act === 'left') turn(-1);
        else turn(1);
        break;
      case 'attack':
        // a tap a moment early is kept and spent the instant the blow is ready,
        // rather than dropped: a player cannot see the swing timer
        if (G.t < P().nextAttack) { if (P().nextAttack - G.t <= 350) queuedAttack = true; }
        else attack();
        break;
      case 'use': use(); break;
      case 'cast': castLast(); break;
      case 'rest': rest(); break;
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
      if (!m.awake || m.fleeing) continue;
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
      out.push({ rel, near: dist === 1 });
    }
    return out.sort((a, b) => Number(b.near) - Number(a.near));
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
      sprites.push({ x: m.rx + 0.5, y: m.ry + 0.5, img, scale: mb.scale, yOff: (mb.fly || 0) + bob, flash: m.flashUntil, hp: m.hp, maxHp: m.maxHp });
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
      sprites.push({ x: x + 0.5, y: y + 0.5, img: Assets.sprites[spriteFor(it)], scale: it.t === 'artifact' ? 0.5 : (it.u ? 0.38 : 0.32), yOff: floats ? (it.u ? 0.04 : 0.1) + Math.sin(now / 300) * 0.03 : 0 });
    }
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
      if (!G.escaping) { G.escaping = false; G.escapeStart = 0; G.nextHunt = G.t + 16000; G.hunts = G.hunts || 0; }
      if (!G.journal) G.journal = [];
      if (G.logSeq == null) G.logSeq = G.log ? G.log.length : 0;
      if (G.player.eq.offhand === undefined) G.player.eq.offhand = null;
      if (!G.pendingBoons) G.pendingBoons = [];
      if (!G.player.bg) G.player.bg = 'oathbroken';
      if (!G.looks) G.looks = buildLooks(G.seed);
      // a run from before relics finds them on the floors it has yet to see
      if (!G.relics) G.relics = { ...relicPlan(G.seed, G.player.cls, G.opts.levels), offered: 0, found: [] };
      if (!G.known) { G.known = {}; for (const id in ITEMS) G.known[id] = 1; }
      for (const dpt in G.levels) for (const m of G.levels[dpt].monsters) { m.nextAct = G.t + 800; m.rx = m.x; m.ry = m.y; m.moveT1 = 0; m.flashUntil = 0; }
      snapCam();
      distFieldAt = -1e9;
      fx.texts = [];
      log('Game loaded.', 'info');
      emit('level');
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
    currentShop, closeShop, buy, sell, buyPrice, sellPrice, shopServices, buyService,
    pendingBoons, chooseBoon, epilogue, journal: () => (G && G.journal) || [], pagesInDungeon,
    lastAttacker: () => (G && G.lastAttacker) || null, deathLog: () => (G && G.deathLog) || [],
    knownSpells, spellAvailable, castSpell, rest, toHit, playerAC, weapon, effect, skillDamage, critFloor,
    wasteReason, spellWasteReason, attackReady, isEscaping: () => !!(G && G.escaping),
    INV_MAX, T,
  };
})();

export { Game };
