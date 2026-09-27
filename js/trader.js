import { ITEMS, CLASSES } from './data.js';
import { Sound } from './sound.js';
import { GEAR_POWERS, POWER_SUFFIX, GEAR_PREFIXES, PREFIX_NAME, PREFIX_DESC } from './relics.js';

// The traders (the Lampfolk, and a goblin pedlar at a goblin market): what they charge and pay, their shelves, and the work
// they do for gold (appraising, curse-lifting, the forge, runes, a quality of
// make, a safe night, books and the tonic). Split out of game.js; everything
// it needs from the game comes through K.

/**
 * @param {any} K  what the game lends: its state and the rules the rest of it keeps
 */
export function makeTrader(K) {
  const { BELT, P, lvl, log, emit, the, cap, itemName, relicOf, mod, hasTalent, isJewel, isKnown, vouched, vowed, hiddenGear, cursedWorn, revealAll, breakCurses, healPlayer, spMax, beltRoom, giveItem, removeOne, discoverRelic, junkInPack } = K;
  // ---------- trading ----------
  // Prices key off the item's own value so the shelf stays sane at any depth.
  // Charisma is how the trader sees you: each point of modifier is six
  // percent off what you buy and on what you sell, within reason. It was
  // rolled for every hero and, until this, used for nothing at all.
  function charm() { return Math.max(-0.3, Math.min(0.3, mod(P().stats.cha) * 0.06)); }
  // a relic is priced by its legend, not by the iron it is made of
  function buyPrice(shop, it) {
    const r = relicOf(it);
    if (r) return Math.round(r.value * shop.markup * (1 - charm() - vouched()));
    const v = ITEMS[it.t].value || 5;
    const e = it.h ? 0 : (it.e || 0);
    const pw = (it.pw && !it.h ? 1.7 : 1) * (it.px && !it.h ? 1.25 : 1);
    return Math.max(2, Math.round(v * shop.markup * (1 + e * 0.9) * pw * (1 - charm() - vouched())));
  }
  // Never more than the trader in front of you would ask for it: at a goblin
  // market's lowest markup, a charming thief with Light Fingers and a
  // captive to vouch for them could buy a potion and sell it straight back
  // at a profit.
  function sellPrice(it) {
    const raw = sellValue(it);
    return shop ? Math.min(raw, Math.max(1, Math.floor(buyPrice(shop, it) * 0.9))) : raw;
  }
  function sellValue(it) {
    const r = relicOf(it);
    if (r) return Math.round(r.value * 0.45 * (1 + charm()) * (hasTalent('light_fingers') ? 1.25 : 1));
    // a ring you cannot name goes for a trinket's price: the trader will not tell you what it is
    if (isJewel(it) && !isKnown(it.t)) return Math.max(1, Math.round(15 * (1 + charm()) * (hasTalent('light_fingers') ? 1.25 : 1)));
    const v = ITEMS[it.t].value || 1;
    // unknown gear goes for the price of a plain one; the trader will not tell
    const e = it.h ? 0 : (it.e || 0);
    return Math.max(1, Math.round(v * 0.45 * Math.max(0.2, 1 + e * 0.8) * (it.pw && !it.h ? 1.7 : 1) * (it.px && !it.h ? 1.25 : 1) * (1 + charm()) * (hasTalent('light_fingers') ? 1.25 : 1)));
  }

  /** What the trader charges to look your gear over, and to break a curse. */
  function shopServices() {
    if (!shop) return [];
    const hidden = hiddenGear(), cursed = cursedWorn();
    const deep = K.G.depth;
    return [
      { id: 'appraise', label: 'Appraise your gear', detail: hidden.length ? `${hidden.length} piece${hidden.length > 1 ? 's' : ''} of unknown quality` : 'You know the quality of everything you carry',
        price: Math.round((8 + 4 * deep) * Math.max(1, hidden.length) * (1 - charm())), why: hidden.length ? null : 'Nothing you carry is unknown.' },
      { id: 'uncurse', label: 'Lift a curse', detail: cursed.length ? `Free you of ${cursed.map(it => the(it)).join(' and ')}` : 'Nothing you wear is cursed',
        price: Math.round((40 + 20 * deep) * Math.max(1, cursed.length) * (1 - charm())), why: cursed.length ? null : 'Nothing you wear is cursed.' },
      temper('hone', 'weapon', 'Hone your weapon', 'sharper'),
      temper('reinforce', 'armor', 'Reinforce your armour', 'stouter'),
      rune('rune_weapon', 'weapon'), rune('rune_armor', 'armor'),
      make('make_weapon', 'weapon'), make('make_armor', 'armor'),
      lodging(), books(), tonic(),
    ];
  }
  /** A caster reads the trader's books: three spell points more, for good. One reading a trader. */
  function books() {
    const p = P();
    const why = !CLASSES[p.cls].spells ? 'Only a caster can make anything of these books.' : shop.studied ? 'You have read all this trader has.' : null;
    return { id: 'study', label: 'Study the trader\'s books', detail: why || 'Three more spell points, for good.',
      price: Math.round((150 + 30 * K.G.depth) * (1 - charm())), why };
  }
  /**
   * The deep traders' tonic: bitter, and four more hit points for good. One
   * draught a trader, from the fourth floor down, where the gold piles up:
   * heroes were reaching the lich with two or three hundred they had no use for.
   */
  const TONIC_HP = 4;
  function tonic() {
    const why = vowed('unaided') ? 'You swore to go unaided: no draught passes your lips.'
      : K.G.depth < 4 ? 'The trader keeps the deep tonic for deeper floors than this.' : shop.tonic ? 'You have drunk all the tonic this trader will sell you.' : null;
    return { id: 'tonic', label: 'Drink the trader\'s bitter tonic', detail: why || `${TONIC_HP} more maximum hit points, for good.`,
      price: Math.round((60 + 20 * K.G.depth) * (1 - charm())), why };
  }
  /**
   * Each trader knows one rune for a weapon and one for armour, and will work
   * it into a piece that carries no power yet: the dearest thing gold buys.
   * @param {string} id @param {'weapon'|'armor'} slot
   */
  function rune(id, slot) {
    const it = P().eq[slot], pool = GEAR_POWERS[slot];
    const pw = pool[Math.abs(shop.x * 7 + shop.y * 13 + K.G.depth * 3) % pool.length];
    const what = slot === 'weapon' ? 'weapon' : 'armour';
    const why = !it ? `You have no ${what} on.`
      : it.u ? 'A relic carries its own powers; the trader will not touch it.'
      : it.pw ? `${cap(the(it))} carries a power already.`
      : it.h ? 'Have it appraised first: the trader will not work blind.'
      : it.curse ? 'The trader will not put a rune on cursed metal.' : null;
    return { id, pw, label: `Work a rune ${POWER_SUFFIX[pw]} into your ${what}`,
      detail: it && !why ? `${cap(the(it))} becomes ${itemName({ ...it, pw, q: 1 })}` : (why || ''),
      price: Math.round((120 + 25 * K.G.depth) * (1 - charm())), why };
  }
  /**
   * The deep traders' best work, and where late gold goes: a quality of make
   * (Heavy, True, Sturdy or Blessed) put into a piece that has none. Each
   * trader has one for weapons and one for armour, from the second floor down.
   * @param {string} id @param {'weapon'|'armor'} slot
   */
  function make(id, slot) {
    const it = P().eq[slot], pool = GEAR_PREFIXES[slot];
    const px = pool[Math.abs(shop.x * 11 + shop.y * 5 + K.G.depth * 7) % pool.length];
    const what = slot === 'weapon' ? 'weapon' : 'armour';
    const why = K.G.depth < 2 ? 'The trader\'s forge up here is not hot enough for that work.'
      : !it ? `You have no ${what} on.`
      : it.u ? 'A relic carries its own make; the trader will not touch it.'
      : it.px ? `${cap(the(it))} is ${PREFIX_NAME[it.px]} already.`
      : it.h ? 'Have it appraised first: the trader will not work blind.'
      : it.curse ? 'The trader will not work cursed metal.' : null;
    return { id, px, label: `Make your ${what} ${PREFIX_NAME[px]}`,
      detail: it && !why ? `${PREFIX_DESC[px].charAt(0).toUpperCase() + PREFIX_DESC[px].slice(1)}: ${itemName({ ...it, px, q: 1 })}` : (why || ''),
      price: Math.round((80 + 25 * K.G.depth) * (1 - charm())), why };
  }
  /** A night by the trader's lamp: whole again, nothing finds you, and the floor's own rests are not spent. */
  function lodging() {
    const L = lvl(), p = P();
    const why = vowed('iron') ? 'You swore the Iron Vow: no rest until the Heart is won.' : L.lodged ? 'You have slept by this lamp already.' : p.hp >= p.maxHp && p.sp >= p.maxSp ? 'You are already well rested.' : null;
    return { id: 'lodge', label: 'Sleep safe by the trader\'s lamp', detail: why || 'A whole night, and nothing finds you. Once a floor.',
      price: Math.round((30 + 15 * K.G.depth) * (1 - charm())), why };
  }
  // Gold's use down here: the trader's forge. Each step up costs more than the
  // last, and nothing goes past +3, or an unknown or cursed piece at all.
  const TEMPER_MOST = 3;
  /** @param {string} id @param {'weapon'|'armor'} slot @param {string} label @param {string} word */
  function temper(id, slot, label, word) {
    const it = P().eq[slot], e = it ? it.e || 0 : 0, step = Math.max(1, e + 1);
    const why = !it ? `You have no ${slot === 'weapon' ? 'weapon' : 'armour'} on.`
      : it.h ? 'Have it appraised first: the trader will not work blind.'
      : it.curse ? 'The trader will not put a hammer to cursed metal.'
      : e >= TEMPER_MOST ? `${cap(the(it))} is as ${word.replace(/er$/, '')} as it will ever be.` : null;
    // a piece that was cursed keeps its minus once the curse is off: said as a minus, not "+-1"
    const n = e + 1, becomes = n > 0 ? `becomes +${n}` : n < 0 ? `becomes −${-n}` : 'loses its −1';
    return { id, label, detail: it && !why ? `${cap(the(it))} ${becomes}` : (why || ''),
      price: Math.round((30 + 15 * K.G.depth) * step * step * (1 - charm())), why };
  }
  function buyService(id) {
    const s = shopServices().find(x => x.id === id);
    if (!s) return false;
    if (s.why) { log(s.why); return false; }
    const p = P();
    if (p.gold < s.price) { log('You cannot afford that.', 'bad'); Sound.play('error'); return false; }
    p.gold -= s.price;
    if (id === 'rune_weapon' || id === 'rune_armor') {
      const it = P().eq[id === 'rune_weapon' ? 'weapon' : 'armor'];
      it.pw = /** @type {any} */ (s).pw;
      log(`The trader cuts a rune into ${the(it)} and breathes on it: ${itemName(it)}.`, 'good');
    } else if (id === 'make_weapon' || id === 'make_armor') {
      const it = P().eq[id === 'make_weapon' ? 'weapon' : 'armor'];
      it.px = /** @type {any} */ (s).px;
      log(`The trader takes ${the(it)} to the forge for a long while, and brings it back ${PREFIX_NAME[it.px]}: ${itemName(it)}.`, 'good');
    } else if (id === 'study') {
      const p = P();
      p.bonusSp = (p.bonusSp || 0) + 3; p.maxSp = spMax(p); p.sp = Math.min(p.maxSp, p.sp + 3);
      shop.studied = true;
      log('You read late by the trader\'s lamp, and something in the margins stays with you (+3 spell points).', 'good');
    } else if (id === 'tonic') {
      const p = P();
      p.maxHp += TONIC_HP; healPlayer(TONIC_HP);
      shop.tonic = true;
      log(`The tonic is black and bitter, and it settles in you like iron (+${TONIC_HP} maximum hit points).`, 'good');
    } else if (id === 'lodge') {
      const p = P();
      healPlayer(p.maxHp - p.hp); p.sp = p.maxSp;
      lvl().lodged = true;
      log('You sleep by the trader\'s lamp, and nothing comes. You wake whole.', 'good');
    } else if (id === 'hone' || id === 'reinforce') {
      const it = P().eq[id === 'hone' ? 'weapon' : 'armor'];
      it.e = (it.e || 0) + 1;
      log(`The trader works ${the(it)} at the forge and hands it back ${id === 'hone' ? 'keener' : 'stouter'}: ${itemName(it)}.`, 'good');
    } else if (id === 'appraise') {
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

  // Who keeps the shop: at a goblin market, a goblin, and everywhere else one
  // of the Lampfolk, the small grey people who have traded in the deep since
  // before the Heart was lit. They deal with anything that pays, and nothing
  // down here will harm the ones it buys from; that is how they are still here.
  const traderKind = () => (lvl().twist === 'market' ? 'pedlar' : 'lampfolk');
  const TRADER_NAMES = { lampfolk: 'Lampfolk trader', pedlar: 'Goblin pedlar' };
  const traderName = () => TRADER_NAMES[traderKind()];
  function greet() {
    const G = K.G;
    if (traderKind() === 'pedlar') log('A goblin pedlar squats under a heap of pots, blades and trinkets, and grins with every tooth. "Cheap! Cheaper than lamp-eyes. Cheap!"', 'info');
    else if (!G.metLampfolk) log('One of the Lampfolk looks up from a pack taller than itself, its eyes round and pale as lanterns. They have always been down here: they trade with whatever pays, and nothing in the deep will harm the ones it buys from. "Coin for goods, sun-walker."', 'info');
    else log('A Lampfolk trader blinks its great pale eyes at you over its pack. "Coin for goods."', 'info');
    if (traderKind() === 'lampfolk') G.metLampfolk = true;
  }

  let shop = null;
  function openShop(n) {
    if (vowed('pauper')) { log('The trader sees the vow on you, and shakes their head. "Not to one sworn a pauper."', 'bad'); Sound.play('error'); return false; }
    shop = n;
    if (!n.greeted) {
      n.greeted = true;
      greet();
      if (vouched()) log('"You\'re the one who cut that fellow loose, aren\'t you? He said you\'d be by. A sixth off, for you."', 'good');
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
    if (beltRoom(it.t) <= 0) { log(`Your belt holds ${BELT} of those already.`, 'bad'); Sound.play('error'); return false; }
    if (p.gold < price) { log('You cannot afford that.', 'bad'); Sound.play('error'); return false; }
    const one = { t: it.t, q: 1, e: it.e || 0, ...(it.u ? { u: it.u } : {}), ...(it.h ? { h: 1 } : {}), ...(it.pw ? { pw: it.pw } : {}), ...(it.px ? { px: it.px } : {}) };
    if (!giveItem(one)) { log('Your pack is full: drop something first.', 'bad'); Sound.play('error'); return false; }
    p.gold -= price;
    it.q--;
    if (it.q <= 0) {
      const at = shop.stock.indexOf(it);
      if (at >= 0) shop.stock.splice(at, 1);
    }
    K.G.known[one.t] = 1;   // the trader tells you what it is, so name it plainly
    log(`You buy ${the(one)} for ${price} gold.`, 'good');
    if (one.u) discoverRelic(one.u);
    Sound.play('gold');
    emit('inv'); emit('stats');
    return true;
  }
  function sell(it, quiet = false) {
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
    const ex = !one.u && !one.h && !one.pw && !one.px && shop.stock.find(s => s.t === one.t && (s.e || 0) === (one.e || 0) && !s.u && !s.h && !s.pw && !s.px);
    if (junk) { /* gone */ } else if (ex) ex.q++; else shop.stock.push({ t: one.t, q: 1, e: one.e || 0, ...(one.u ? { u: one.u } : {}), ...(one.h ? { h: 1 } : {}), ...(one.pw ? { pw: one.pw } : {}), ...(one.px ? { px: one.px } : {}) });
    if (!quiet) { log(`You sell ${the(one)} for ${price} gold.`, 'good'); Sound.play('gold'); }
    emit('inv'); emit('stats');
    return true;
  }
  function sellJunk() {
    const junk = junkInPack();
    if (!shop || !junk.length) return 0;
    let gold = 0;
    for (const it of junk) { const price = sellPrice(it); if (sell(it, true)) gold += price; }
    log(`You sell ${junk.length === 1 ? the(junk[0]) : `${junk.length} pieces you had no use for`} for ${gold} gold.`, 'good');
    Sound.play('gold');
    return gold;
  }
  return { charm, buyPrice, sellPrice, shopServices, buyService, openShop, currentShop, closeShop, buy, sell, sellJunk, traderKind, traderName };
}
