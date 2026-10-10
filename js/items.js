// Items: what each thing in the pack is called and worth, what it does when
// used, worn or taken off, and how the pack is kept. What it borrows from the
// game comes through K, read live.
import { Assets } from './assets.js';
import { CLASSES, ITEMS, JOURNAL, MONSTERS, armorFits, shieldFits } from './data.js';
import { POWER_SUFFIX, PREFIX_NAME } from './relics.js';
import { Dice, d } from './rng.js';
import { Sound } from './sound.js';

/** @param {any} K */
export function makeItems(K) {
  const COATINGS = K.COATINGS;
  const COAT_BLOWS = K.COAT_BLOWS;
  const COAT_GLOW = K.COAT_GLOW;
  const DIRS = K.DIRS;
  const INV_MAX = K.INV_MAX;
  const READ_MS = K.READ_MS;
  const SCROLL_GLOW = K.SCROLL_GLOW;
  const T = K.T;
  const boltEnd = K.boltEnd;
  const boltTargets = K.boltTargets;
  const bounty = K.bounty;
  const burnWeb = K.burnWeb;
  const claimHeart = K.claimHeart;
  const companion = K.companion;
  const elements = K.elements;
  const fireCatches = K.fireCatches;
  const fx = K.fx;
  const healPlayer = K.healPlayer;
  const heard = K.heard;
  const hitGroup = K.hitGroup;
  const noteGold = K.noteGold;
  const noteUsed = K.noteUsed;
  const packSize = K.packSize;
  const spellFx = K.spellFx;
  const spring = K.spring;
  const P = (/** @type {any[]} */ ...a) => K.P(...a);
  const blocked = (/** @type {any[]} */ ...a) => K.blocked(...a);
  const bound = (/** @type {any[]} */ ...a) => K.bound(...a);
  const breakCurses = (/** @type {any[]} */ ...a) => K.breakCurses(...a);
  const cap = (/** @type {any[]} */ ...a) => K.cap(...a);
  const checkTile = (/** @type {any[]} */ ...a) => K.checkTile(...a);
  const cls = (/** @type {any[]} */ ...a) => K.cls(...a);
  const cursedWorn = (/** @type {any[]} */ ...a) => K.cursedWorn(...a);
  const discoverRelic = (/** @type {any[]} */ ...a) => K.discoverRelic(...a);
  const elemental = (/** @type {any[]} */ ...a) => K.elemental(...a);
  const emit = (/** @type {any[]} */ ...a) => K.emit(...a);
  const heldWhy = (/** @type {any[]} */ ...a) => K.heldWhy(...a);
  const hiddenGear = (/** @type {any[]} */ ...a) => K.hiddenGear(...a);
  const isGear = (/** @type {any[]} */ ...a) => K.isGear(...a);
  const isJewel = (/** @type {any[]} */ ...a) => K.isJewel(...a);
  const isKnown = (/** @type {any[]} */ ...a) => K.isKnown(...a);
  const key = (/** @type {any[]} */ ...a) => K.key(...a);
  const log = (/** @type {any[]} */ ...a) => K.log(...a);
  const lvl = (/** @type {any[]} */ ...a) => K.lvl(...a);
  const monsterAt = (/** @type {any[]} */ ...a) => K.monsterAt(...a);
  const mstat = (/** @type {any[]} */ ...a) => K.mstat(...a);
  const npcAt = (/** @type {any[]} */ ...a) => K.npcAt(...a);
  const offhandReason = (/** @type {any[]} */ ...a) => K.offhandReason(...a);
  const passable = (/** @type {any[]} */ ...a) => K.passable(...a);
  const propAt = (/** @type {any[]} */ ...a) => K.propAt(...a);
  const pyroFire = (/** @type {any[]} */ ...a) => K.pyroFire(...a);
  const refreshSp = (/** @type {any[]} */ ...a) => K.refreshSp(...a);
  const relicOf = (/** @type {any[]} */ ...a) => K.relicOf(...a);
  const revealAll = (/** @type {any[]} */ ...a) => K.revealAll(...a);
  const snapCam = (/** @type {any[]} */ ...a) => K.snapCam(...a);
  const soon = (/** @type {any[]} */ ...a) => K.soon(...a);
  const statCheck = (/** @type {any[]} */ ...a) => K.statCheck(...a);
  const tellQuality = (/** @type {any[]} */ ...a) => K.tellQuality(...a);
  const the = (/** @type {any[]} */ ...a) => K.the(...a);
  const tricksterPurse = (/** @type {any[]} */ ...a) => K.tricksterPurse(...a);
  const vowed = (/** @type {any[]} */ ...a) => K.vowed(...a);

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
      const look = K.G.looks[it.t];
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
    if (relicOf(it) && relicOf(it).legend && Assets.sprites['legend_' + ITEMS[it.t].sprite]) return 'legend_' + ITEMS[it.t].sprite;
    if (it.u && Assets.sprites['relic_' + ITEMS[it.t].sprite]) return 'relic_' + ITEMS[it.t].sprite;
    // a potion keeps its bottle once it is known: the same draught, now named
    // (and a ring its stone)
    if (!isKnown(it.t) || (['potion', 'ring', 'amulet'].includes(ITEMS[it.t].kind) && K.G.looks[it.t])) return K.G.looks[it.t].sprite;
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
    if (K.G.status === 'dead' || K.G.status === 'won') return false;
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
    if (slot === 'weapon') coatingGoes(p);
    p.eq[slot] = it;
    refreshSp(p);
    if (!quiet) log(`You equip ${the(it)}.`);
    // putting it on is how you find out what it is: a ring or an amulet says
    // what it was made for as it goes on, then how well
    if (isJewel(it) && !isKnown(it.t)) { K.G.known[it.t] = 1; log(`It is ${ITEMS[it.t].kind === 'amulet' ? 'an' : 'a'} ${ITEMS[it.t].name}.`, 'info'); }
    if (it.h) { delete it.h; tellQuality(it); }
    emit('inv');
    return true;
  }
  /** An oil is worked into the blade it was put on: another weapon in hand does not have it. */
  function coatingGoes(p) {
    if (!p.coating) return;
    log(`The ${COATINGS[p.coating.t].name} stays on the weapon you put away.`, 'info');
    p.coating = null;
  }
  function unequip(slot) {
    if (K.G.status === 'dead' || K.G.status === 'won') return;
    const p = P();
    if (!p.eq[slot]) return;
    if (bound(p.eq[slot])) { log(`${cap(the(p.eq[slot]))} will not come off. It is cursed.`, 'bad'); Sound.play('error'); return; }
    if (p.inv.length >= INV_MAX) { log('Your pack is full: drop something first.', 'bad'); return; }
    p.inv.push(p.eq[slot]);
    log(`You remove ${the(p.eq[slot])}.`);
    if (slot === 'weapon') coatingGoes(p);
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
    if (b.kind === 'flask' && !throwSpot()) return 'There is no room ahead to throw it.';
    if (!isKnown(it.t)) return null;
    if (b.kind === 'food' && p.food >= 100) return 'You are too full to eat another bite.';
    if (b.kind === 'oil' && !p.eq.weapon) return 'You have no weapon to coat.';
    if (b.kind === 'oil' && p.coating && p.coating.t === b.coat && p.coating.left >= COAT_BLOWS) return 'Your weapon is freshly coated with it already.';
    if (b.kind === 'potion') {
      if (b.effect === 'heal' && p.hp >= p.maxHp) return 'You are unhurt. The draught would be wasted.';
      if (b.effect === 'cure' && !p.poison) return 'You are not poisoned.';
      if (b.effect === 'mana' && (!p.maxSp || p.sp >= p.maxSp)) return 'Your mind is already clear.';
    }
    if (b.kind === 'scroll') {
      if (b.effect === 'heal' && p.hp >= p.maxHp) return 'You are unhurt. The scroll would be wasted.';
      if (b.effect === 'fire' && !boltTargets(3, false).length && !fireCatches(3)) return 'There is nothing ahead to burn.';
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
    fx.hold = { dhp: Math.max(0, p.hp - was.hp), dsp: Math.max(0, p.sp - was.sp), until: K.realNow + ms };
  }
  /** Life and spell points as the bars should show them this moment. */
  function vitals() {
    const p = P(), h = fx.hold;
    if (!h || K.realNow >= h.until) return { hp: p.hp, sp: p.sp };
    return { hp: Math.max(1, p.hp - h.dhp), sp: Math.max(0, p.sp - h.dsp) };
  }
  /** Where a thrown flask lands: up to three squares ahead, on the first creature in the way, or short of a wall. */
  function throwSpot() {
    const p = P(), [dx, dy] = DIRS[p.dir];
    let spot = null;
    for (let i = 1; i <= 3; i++) {
      const x = p.x + dx * i, y = p.y + dy * i;
      // (it is not thrown at the companion: it comes down short of them)
      if (!passable(x, y) || npcAt(x, y) || companion.at(x, y)) break;
      spot = { x, y };
      // the first thing in the way takes it: a creature (not one sunk out of sight), or a barrel or crate
      const m = monsterAt(x, y);
      if ((m && !m.sunk) || propAt(x, y)) break;   // (a mimic, still a barrel, stops it as one)
    }
    return spot;
  }
  /** A flask of lamp oil thrown: it smashes and spills where it lands. @returns {boolean} whether it was thrown */
  function throwFlask() {
    const spot = throwSpot();
    if (!spot) { log('There is no room ahead to throw it.', 'bad'); return false; }
    const p = P();
    p.noiseAt = K.G.t;
    p.nextAttack = Math.max(p.nextAttack, K.G.t + 500);
    const m = monsterAt(spot.x, spot.y), prop = propAt(spot.x, spot.y);
    // the arm goes back and over, and the flask tumbles through the air to where it smashes
    const squares = Math.abs(spot.x - p.x) + Math.abs(spot.y - p.y);
    const land = throwArm('flask', 'flask', '#c89040', FLASK_SQUARE * squares, m && !m.sunk ? [m] : [], squares, () => Sound.play('swing', { w: null }));
    // (what already lay there, oil or fire, stays to be seen while the flask is in the air; each
    // flask in the air keeps its own landing)
    // (a spill runs onto the four squares round where it lands as well: each keeps what lay there)
    const was = {};
    for (const [ox, oy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const f = elements.fieldAt(spot.x + ox, spot.y + oy); was[`${spot.x + ox},${spot.y + oy}`] = f ? f.k : ''; }
    fx.landings = fx.landings.filter(l => l.at > K.realNow).concat({ x: spot.x, y: spot.y, at: K.realNow + land, was });
    // a mimic still shut takes it as the barrel it seems, and that is a blow to it
    if (m && m.disguised) { log('The flask smashes on the barrel.', 'info'); spring(m, 'struck'); }
    else log(m && !m.sunk ? `The flask smashes on the ${mstat(m).name}!` : prop ? `The flask smashes on the ${prop.k === 'oilcask' ? 'oil cask' : prop.k}.` : elements.wet(spot.x, spot.y) ? 'The flask smashes into the water.' : 'The flask smashes on the stones.', 'info');
    { const o = heard(spot); K.fxDelay = land; soon(() => Sound.play('smash', o)); K.fxDelay = 0; }
    elements.spill(spot.x, spot.y);
    return true;
  }
  // A throw from the hand: the weapon hand lets go of what it holds, comes up
  // empty, and snaps forward; what it threw leaves it partway through (see
  // THROW_MS in the renderer, which this must keep step with).
  const THROW_MS = 460, THROW_LET_GO = 0.42, FLASK_SQUARE = 85;
  /** Throw something: the arm, the sound of it leaving the hand, and it in flight. @returns {number} ms until it gets there */
  function throwArm(kind, style, color, flight, targets, squares, sound) {
    fx.throwAt = K.realNow; fx.throwKind = kind;
    const release = Math.round(THROW_MS * THROW_LET_GO);
    if (sound) { const was = K.fxDelay; K.fxDelay = release; soon(sound); K.fxDelay = was; }
    // (a flask lands, then smashes: its splash is the last part of its look)
    spellFx(style, color, style === 'flask' ? Math.round(flight / 0.7) : flight, targets, squares, release, { x: 0.68, y: 0.72 });
    return release + flight;
  }
  function showUse(kind, it, color) { fx.useAt = K.realNow; fx.useKind = kind; fx.useSprite = spriteFor(it); fx.useColor = color; }
  function useItem(it) {
    if (K.G.status !== 'playing') return;
    const p = P(), b = ITEMS[it.t];
    if (p.held > K.G.t) { blocked(heldWhy()); return; }
    const consumable = b.kind === 'food' || b.kind === 'potion' || b.kind === 'scroll' || b.kind === 'oil' || b.kind === 'flask';
    if (consumable && p.inv.indexOf(it) < 0) { log('You are not carrying that.', 'bad'); return; }
    if (b.kind === 'potion' && vowed('unaided')) { log('You swore to go unaided: no draught passes your lips.', 'bad'); Sound.play('error'); return; }
    if (consumable) {
      const why = wasteReason(it);
      if (why) { log(why, 'bad'); Sound.play('error'); emit('waste'); return; }
      noteUsed(b.kind);
    }
    if (b.kind === 'flask') {
      if (!throwFlask()) return;
      removeOne(it);
    } else if (b.kind === 'food') {
      showUse('eat', it, '#e0c080');
      removeOne(it);
      p.food = Math.min(100, p.food + b.food);
      log(`You eat the ${b.name.toLowerCase()}. ${p.food >= 90 ? 'You are full.' : 'That was good.'}`, 'good');
      Sound.play('eat');
    } else if (b.kind === 'potion') {
      const wasNew = !isKnown(it.t);
      showUse('drink', it, POTION_GLOW[b.effect] || '#e0e0ff');
      removeOne(it);
      if (wasNew) { K.G.known[it.t] = 1; log(`You drink the unknown potion... it is ${aThing(b.name)}.`, 'info'); }
      // the cork and the swallows now; what it does is heard once it is down
      Sound.play('drink');
      K.fxDelay = 420;
      const was = { hp: p.hp, sp: p.sp };
      try {
        switch (b.effect) {
          // (a third less on the ladder's fourth rung: the same dice, a bitter draught)
          case 'heal': { const r = d(...b.heal), n = K.climbed(4) ? Math.max(1, Math.round(r * 2 / 3)) : r; healPlayer(n); log(`You drink the potion and heal ${n}.`, 'good'); break; }
          case 'cure': p.poison = null; log('The poison leaves your veins.', 'good'); soon(() => Sound.play('heal')); break;
          case 'might': p.effects.might = { amount: 2, until: K.G.t + 120000 }; log('You feel mighty!', 'good'); soon(() => Sound.play('spell')); break;
          case 'mana': if (p.maxSp) { p.sp = p.maxSp; log('Your mind clears. Spell points restored.', 'good'); } else log('Your thoughts feel unusually sharp, but nothing else happens.'); soon(() => Sound.play('spell')); break;
        }
        holdVitals(was, K.fxDelay);
      } finally { K.fxDelay = 0; }
    } else if (b.kind === 'oil') {
      removeOne(it);
      const was = p.coating;
      p.coating = { t: b.coat, left: COAT_BLOWS };
      // the flask is brought up and tipped over the blade (or the arrows), and drips from it
      showUse('coat', it, COAT_GLOW[b.coat] || '#c89040');
      const wb = ITEMS[p.eq.weapon.t], what = p.eq.weapon.t === 'sling' ? 'your sling stones' : p.eq.weapon.t === 'handxbow' ? 'your bolts' : wb.aimed ? 'your arrows' : `your ${wb.name.toLowerCase()}`;
      log(`${was && was.t !== b.coat ? `You wipe off the ${COATINGS[was.t].name} and work` : 'You work'} the ${b.name.toLowerCase()} into ${what}. ${COATINGS[b.coat].says}`, 'good');
      Sound.play('pickup');
      emit('stats');
    } else if (b.kind === 'scroll') {
      const wasNewS = !isKnown(it.t);
      removeOne(it);
      if (wasNewS) { K.G.known[it.t] = 1; log(`You read the unknown scroll... it is ${aThing(b.name)}.`, 'info'); }
      // the scroll rises in the off hand, its writing kindles in the colour of
      // what it does, and it burns away (see the renderer); what it does is
      // settled now, and shown as the page goes up
      fx.readAt = K.realNow; fx.readKind = b.effect; fx.readColor = SCROLL_GLOW[b.effect] || '#fe8';
      // one sound for the reading, pitched by what it does; anything else it
      // makes a sound of (a heal) is heard as the page goes up
      Sound.play('read', { kind: b.effect });
      K.fxDelay = Math.round(READ_MS * 0.62);
      const wasS = { hp: p.hp, sp: p.sp };
      try {
        switch (b.effect) {
          case 'fire': {
            burnWeb();
            const targets = boltTargets(3, false);
            // the fireball leaves the burning page, not the hand
            spellFx('fireball', '#ff7020', 750, targets, 3, READ_MS * 0.6, { x: 0.3, y: 0.58 });
            if (!targets.length) {
              log('A ball of fire bursts against the stones.');
              const end = boltEnd(3); if (end) elements.scorch(end.x, end.y);
              break;
            }
            K.castingName = 'fireball';
            // what it looks like waits for the fireball to burst: it leaves the
            // page six tenths into the reading and flies for a third of its 750ms
            K.fxDelay = Math.round(READ_MS * 0.6 + 750 * 0.35);
            try {
              for (const m of targets) {
                if (packSize(m) > 1) log(`The fireball engulfs all ${packSize(m)} of the ${mstat(m).name}s!`, 'good');
                hitGroup(m, elemental(m, pyroFire(d(4, 6)), 'fire'), 'burn');
                elements.strike(m, 'fire', 0, 'spell');
              }
            } finally { K.castingName = ''; }
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
            snapCam(); K.distFieldAt = -1e9;
            log('The world lurches and you find yourself elsewhere.', 'info');
            checkTile();
            break;
          }
        }
        holdVitals(wasS, K.fxDelay);
      } finally { K.fxDelay = 0; }
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
      if (isJewel(it) && !isKnown(it.t) && K.G.studied && K.G.studied[it.t] === P().level) return 'It still means nothing to you. Perhaps with more experience.';
      return null;
    }
    if (!b || (b.kind !== 'potion' && b.kind !== 'scroll')) return 'There is nothing to puzzle out about that.';
    if (isKnown(it.t)) return 'You already know what that is.';
    if (K.G.studied && K.G.studied[it.t] === P().level) return 'It still means nothing to you. Perhaps with more experience.';
    return null;
  }
  function study(it) {
    const why = studyReason(it);
    if (why) { log(why); return null; }
    const c = statCheck('int', STUDY_DC, P().cls === 'mage' ? 2 : 0);
    if (isGear(it)) {
      if (c.pass) {
        const was = itemName(it);
        delete it.h; K.G.known[it.t] = 1;
        if (isJewel(it) && was !== ITEMS[it.t].name) log(`You turn the ${was} to the light and know it: ${ITEMS[it.t].name}.`, 'info');
        log(`You look ${the(it)} over closely: ${itemName(it)}${it.curse ? ', and there is a curse worked into it' : ''}.${c.note}`, it.curse ? 'bad' : 'good');
      } else {
        it.studied = P().level;
        if (isJewel(it) && !isKnown(it.t)) {
          (K.G.studied = K.G.studied || {})[it.t] = P().level;
          log(`You turn ${the(it)} to the light, but cannot tell what it was made for.${c.note}`);
        } else log(`You look ${the(it)} over, but cannot tell good work from bad.${c.note}`);
      }
      emit('inv');
      return c;
    }
    if (c.pass) {
      const was = itemName(it);
      K.G.known[it.t] = 1;
      log(`You study the ${was} and recognise it: ${ITEMS[it.t].name}.${c.note}`, 'good');
    } else {
      (K.G.studied = K.G.studied || {})[it.t] = P().level;
      log(`You turn the ${itemName(it)} over and over, but it means nothing to you yet.${c.note}`);
    }
    emit('inv');
    return c;
  }
  function dropItem(it) {
    if (K.G.status !== 'playing') return;
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
  /**
   * Said the first time the hero steps onto the Heart while the lich still
   * holds it; after that only when they try to take it. The Heart lies by
   * the lich, so every sidestep in the fight repeated it and filled the log.
   * @param {boolean} [trying] the hero reached for it: always said
   */
  /** What holds the Heart while its keeper stands: the lich's cold, the chain the Warlord has it on, or the Heartforged's furnace. */
  const heldBy = k => (k.id === 'warlord' ? `The ${MONSTERS[k.id].name} has it chained to his hoard, and the chain will hold while he stands`
    : k.id === 'heartforged' ? `It burns in the furnace in the ${MONSTERS[k.id].name}'s chest, and will while it stands`
    : `The ${MONSTERS[k.id].name}'s cold holds it fast, and will while it stands`);
  function heartHeld(trying = false) {
    const k = keeper(), L = lvl();
    if (L.heartSaid && !trying) return;
    if (!k || !floorItems().some(it => it.t === 'artifact')) return;
    L.heartSaid = true;
    log(`The Heart will not come loose. ${heldBy(k)}.`, 'bad');
  }
  function takeItem(it) {
    // nothing is picked up by the dead (the Heart once was, from the pack, during the fall)
    if (K.G.status !== 'playing') return false;
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
      if (keeper()) { heartHeld(true); Sound.play('error'); return; }
      list.splice(i, 1);
      claimHeart();
    }
    else if (it.t === 'page') {
      list.splice(i, 1);
      const entry = JOURNAL[it.page];
      if (entry && !K.G.journal.some(j => j.i === it.page)) {
        K.G.journal.push({ i: it.page, depth: K.G.depth });
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
    else if (giveItem(it)) { log(`You pick up ${the(it)}.`); Sound.play('pickup'); list.splice(i, 1); if (it.u) discoverRelic(it.u); if (it.t === 'satchel') bounty.found(); }
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
    if (k && floorItems().some(it => it.t === 'artifact')) log(`The Heart will not come loose. ${heldBy(k)}.`, 'bad');
    else if (floorItems().length) log('Your belt holds five of any one draught: there is no room for these.', 'bad');
  }
  /** Everything here that can be taken; walking on, not what the hero put down nor gear the class cannot use. */
  function pickupAll(walking = false) {
    for (const it of takeable().filter(it => !(walking && (it.left || uselessToClass(it))))) {
      takeItem(it);
      if (K.G.status !== 'playing') break;   // lifting the Heart ends the run: nothing more is picked up after
    }
  }


  return { BELT, STUDY_DC, aThing, beltRoom, canEquip, dropItem, equip, floorItems, giveItem, heartHeld, itemName, keeper, pickupAll, removeOne, spriteFor, study, studyReason, takeHere, takeItem, takeable, throwArm, unequip, useItem, uselessToClass, vitals, wasteReason };
}
