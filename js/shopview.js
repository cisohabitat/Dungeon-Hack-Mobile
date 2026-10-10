// A trader's overlay: what is for sale and what they will buy, each row with its
// price in plain words, and the trader's services. ui.js opens it, and lends what
// it needs through K.
import { Assets } from './assets.js';
import { ITEMS } from './data.js';
import { Game } from './game.js';
import { PREFIX_DESC, PREFIX_NAME, RELIC_POWERS } from './relics.js';
import { $, $$, escapeHtml } from './uikit.js';

/** @param {any} K */
export function makeShopView(K) {
  const compareText = K.compareText;
  const closeOverlay = (/** @type {any[]} */ ...a) => K.closeOverlay(...a);

  // What an item does, in one line. Unknown potions and scrolls stay a mystery.
  // A relic says what it is underneath and names its powers after.
  function itemBlurb(it) {
    const r = Game.relicOf(it);
    // an ordinary piece with a power names it after the numbers
    if (!r) return plainBlurb(it) + (it.px && !it.h && PREFIX_NAME[it.px] ? `. ${PREFIX_NAME[it.px]}: ${PREFIX_DESC[it.px]}` : '') + (it.pw && !it.h && RELIC_POWERS[it.pw] ? `. ${RELIC_POWERS[it.pw].split(':')[0]}` : '');
    return `${ITEMS[it.t].name}. ${plainBlurb(it)}. ${r.powers.map(k => RELIC_POWERS[k].split(':')[0]).join(', ')}`;
  }
  // How fast a weapon swings, in words: "0.34s" between blows read as a
  // stopwatch, not a weapon. A dagger is quick, a greatsword very slow.
  /** @param {number} ms */
  const paceOf = ms => ms <= 450 ? 'quick' : ms <= 600 ? 'brisk' : ms <= 750 ? 'steady' : ms <= 900 ? 'slow' : 'very slow';
  // One weapon's damage over a fight beside another's, as a share anyone can
  // weigh: "a third more", "half as much". It was "+14.9 damage per second".
  /** @param {number} r  the new weapon's damage over time, to the old one's */
  function damageShare(r) {
    if (!(r > 0) || !isFinite(r)) return 'no damage to speak of';
    if (Math.abs(r - 1) < 0.05) return 'about the same damage';
    if (r >= 1.75) { const h = Math.round(r * 2) / 2; return `about ${h % 1 ? Math.floor(h) + '\u00bd' : h} times the damage`; }
    const near = (/** @type {[number, string][]} */ list, x) => list.reduce((a, b) => Math.abs(b[0] - x) < Math.abs(a[0] - x) ? b : a)[1];
    if (r > 1) return near([[0.1, 'a tenth more damage'], [0.2, 'a fifth more damage'], [0.25, 'a quarter more damage'], [1 / 3, 'a third more damage'], [0.5, 'half as much damage again'], [2 / 3, 'two thirds more damage']], r - 1);
    return near([[0.9, 'a tenth less damage'], [0.8, 'a fifth less damage'], [0.75, 'a quarter less damage'], [2 / 3, 'a third less damage'], [0.5, 'half the damage'], [1 / 3, 'a third of the damage'], [0.25, 'a quarter of the damage'], [0.1, 'a fraction of the damage']], r);
  }
  function plainBlurb(it) {
    const b = ITEMS[it.t];
    if (!Game.isKnown(it.t)) return 'You do not know what this does';
    if (b.kind === 'weapon') {
      const d = b.dmg;
      const sp = b.speed * (swiftOf(it) ? 0.85 : 1);
      // one figure, enchantment folded in: "1d6+1 +1" read as a typo
      const add = d[2] + knownE(it);
      return `Damage ${d[0]}d${d[1]}${add > 0 ? '+' + add : add < 0 ? '\u2212' + -add : ''}${it.h ? ' ?' : ''}, ${paceOf(sp)} blows${b.range ? `, reaches ${b.range}` : ''}${b.twoHanded ? ', two-handed' : ''}`;
    }
    // a piece made with a power of its own (a wyrm's scales, a quillback's quills) says so
    const own = b.power && (b.kind === 'armor' || b.kind === 'shield') && RELIC_POWERS[b.power] ? `. ${RELIC_POWERS[b.power]}` : '';
    if (b.kind === 'armor') return `Armour class +${b.ac + knownE(it)}${it.h ? '?' : ''} (${b.weight === 'cloth' ? 'a robe, for mages' : b.weight})${b.sp ? `, +${b.sp} spell points` : ''}${b.cheap ? ', spells of 5 points or more cost 1 less' : ''}${own}`;
    if (b.kind === 'shield' && b.focus) return `${b.desc.replace(/\.$/, '')}; held in the free hand${b.ac ? `, armour class +${b.ac}` : ''}`;
    if (b.kind === 'shield') return `Armour class +${b.ac + knownE(it)}${it.h ? '?' : ''}, needs a free hand${own}`;
    // (the food bar runs to 100: "45 nourishment" gave no sense of how much a meal was)
    if (b.kind === 'food') return `Fills ${b.food} of your food bar's 100`;
    // a ring that comes in amounts says how much, enchantment and all
    if (b.bonus) return amountWords([].concat(b.power)[0], b.bonus + knownE(it), it.h ? '?' : '') || b.desc || '';
    return b.desc || '';
  }

  /** A ring that comes in amounts, said with its amount: "Armour class +2", "−1 to every saving throw". */
  function amountWords(power, n, q = '') {
    const sign = n < 0 ? '\u2212' + -n : '+' + n;
    return { protect: `Armour class ${sign}${q}`, might: `${sign}${q} to hit and to damage`, evasion: `${sign}${q} to every saving throw`,
      seer: `${sign}${q} to spot traps, and hidden doors show as you pass` }[power] || '';
  }
  // what the player knows of an enchantment: nothing, while it is hidden
  const knownE = it => (it.h ? 0 : (it.e || 0));
  const swiftOf = it => { const r = Game.relicOf(it); return (!!r && r.powers.includes('swift')) || (it.pw === 'swift' && !it.h); };

  /** @param {{one?: boolean}} [o]  one: named as a single piece (the price is for one; the note says how many are in stock) */
  function shopRow(it, price, label, enabled, onClick, note, o = {}) {
    const row = document.createElement('div');
    row.className = 'shop-row';
    const img = document.createElement('img');
    img.src = Assets.sprites[Game.spriteFor(it)].url;
    img.alt = '';
    row.appendChild(img);
    const what = document.createElement('div');
    what.className = 'what';
    what.innerHTML = `<b class="g-${Game.grade(it)}">${escapeHtml(Game.itemName(o.one ? { ...it, q: 1 } : it))}</b><small>${escapeHtml(note || '')}</small>`;
    row.appendChild(what);
    const btn = document.createElement('button');
    btn.textContent = `${label} ${price}g`;
    btn.disabled = !enabled;
    if (enabled) btn.className = 'afford';
    payButton(btn, row, price, label, onClick, !!it.u);
    row.appendChild(btn);
    return row;
  }
  // A dear thing asks twice. A mis-tap while scrolling the trader's list
  // should not spend a fortune: anything from 100 gold, or a quarter of the
  // purse, arms on the first tap and pays on the second, within a few seconds.
  // Selling asks only for a relic or anything fetching 100 gold: the trader
  // wants several times as much to sell it back. The whole row answers a tap,
  // not only its button.
  function payButton(btn, row, price, label, onClick, relic = false) {
    const selling = label === 'Sell' || label === 'Sell one';
    const dear = selling ? relic || price >= 100 : price >= Math.min(100, Math.max(1, Game.player().gold * 0.25));
    const plain = btn.textContent;
    let armedUntil = 0;
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (performance.now() < shopTapsFrom) return;
      if (dear && performance.now() > armedUntil) {
        armedUntil = performance.now() + 3000;
        for (const b of $$('#ov-shop .shop-row button.armed')) if (b !== btn) b.dispatchEvent(new Event('disarm'));
        btn.classList.add('armed'); btn.textContent = selling ? `Tap again to sell: ${price}g` : `Tap again: ${price}g`;
        setTimeout(() => { if (btn.isConnected && performance.now() >= armedUntil) btn.dispatchEvent(new Event('disarm')); }, 3050);
        return;
      }
      onClick(); renderShop();
    });
    btn.addEventListener('disarm', () => { armedUntil = 0; btn.classList.remove('armed'); btn.textContent = plain; });
    row.addEventListener('click', () => { if (!btn.disabled) btn.click(); });
  }
  // The step that walked into the trader opens the shop, and a second tap
  // on it landed on whatever row lay under the thumb and bought it; a row
  // sold slides the next one up under the finger the same way. So for a
  // moment after the shop opens, and after each change to its rows, a tap
  // does nothing.
  const SHOP_GUARD_MS = 400;
  let shopTapsFrom = 0;
  function renderShop() {
    const s = Game.currentShop();
    if (!s) { closeOverlay(); return; }
    shopTapsFrom = performance.now() + SHOP_GUARD_MS;
    $('#shop-title').textContent = Game.traderName();
    const p = Game.player();
    // say what charisma is doing to the prices, or it is invisible
    const charm = Math.round(Game.charm() * 100);
    $('#shop-gold').innerHTML = `${p.gold} gold` + (charm > 0 ? `<br><small>your Charisma: <span class="nowrap">prices ${charm}% lower</span></small>` : charm < 0 ? `<br><small>your low Charisma: <span class="nowrap">prices ${-charm}% higher</span></small>` : '')
      + Game.priceNotes().map(n => `<br><small>${escapeHtml(n)}</small>`).join('');
    const stock = $('#shop-stock');
    stock.innerHTML = '';
    if (!s.stock.length) stock.innerHTML = '<div class="shop-empty">The trader has nothing left to sell.</div>';
    for (const it of s.stock.slice()) {
      const price = Game.buyPrice(s, it);
      // the same gear the hero already wears says so, and whether it is better or worse
      const bk = ITEMS[it.t].kind, worn = (bk === 'weapon' || bk === 'armor' || bk === 'shield') ? p.eq[bk] : null;
      // a known quality of make counts as much as a step of enchantment
      const worth = x => knownE(x) + (x.px && !x.h ? 1 : 0);
      const same = worn && worn.t === it.t ? (worth(it) > worth(worn) ? ' · better than the one you wear' : worth(it) < worth(worn) ? ' · worse than the one you wear' : ' · the same as you wear') : '';
      // other gear of the same kind is measured against what is worn, by the Pack's own sums
      const vs = worn && worn.t === it.t ? '' : bk === 'weapon' || bk === 'armor' || bk === 'shield' ? compareText(it, ITEMS[it.t]).replace(/<[^>]+>/g, '') : '';
      // gear the hero's class can never use says so, where the comparison would be
      const cant = bk === 'weapon' || bk === 'armor' || bk === 'shield' ? Game.canEquip(it) : '';
      const note = (Game.isKnown(it.t) ? itemBlurb(it) : 'Unknown until bought: the trader names it when you pay') + same + (vs ? ` · ${vs}` : '') + (cant ? ` · ${cant}` : '') + (it.q > 1 ? ` · ${it.q} in stock` : '');
      stock.appendChild(shopRow(it, price, 'Buy', p.gold >= price, () => Game.buy(it), note, { one: true }));
    }
    // what the trader will do for coin besides trade
    const svc = $('#shop-services');
    svc.innerHTML = '';
    // what cannot be had just now folds away at the foot, so what can is not two screens from the selling
    const services = Game.shopServices(), notNow = services.filter(sv => sv.why);
    let fold = null;
    if (notNow.length && notNow.length < services.length) {
      fold = document.createElement('details');
      fold.className = 'svc-fold';
      fold.innerHTML = `<summary>Services out of reach for now (${notNow.length})</summary>`;
    }
    for (const sv of [...services.filter(sv => !sv.why), ...notNow]) {
      const row = document.createElement('div');
      row.className = 'shop-row service';
      row.innerHTML = `<div class="what"><b>${escapeHtml(sv.label)}</b><small>${escapeHtml(sv.detail)}</small></div>`;
      const btn = document.createElement('button');
      btn.textContent = sv.why ? '—' : sv.price ? `Pay ${sv.price}g` : 'Take it';
      btn.disabled = !!sv.why || p.gold < sv.price;
      if (!btn.disabled) btn.className = 'afford';
      btn.setAttribute('aria-label', `${sv.label}${sv.why || !sv.price ? '' : ` for ${sv.price} gold`}`);
      // (a job costs nothing, so it is never dear enough to ask twice)
      if (!sv.why) payButton(btn, row, sv.price, 'Pay', () => Game.buyService(sv.id));
      row.appendChild(btn);
      (sv.why && fold ? fold : svc).appendChild(row);
    }
    if (fold) svc.appendChild(fold);
    const sellBox = $('#shop-sell');
    sellBox.innerHTML = '';
    const sellable = p.inv.filter(it => it.t !== 'artifact' && it.t !== 'key' && it.t !== 'satchel');
    if (!sellable.length) sellBox.innerHTML = '<div class="shop-empty">Nothing in your pack the trader wants.</div>';
    // everything the class can never use, in one go: the pack was a chore to empty a row at a time
    const junk = Game.junkInPack();
    if (junk.length > 1) {
      const total = junk.reduce((n, it) => n + Game.sellPrice(it), 0);
      const row = document.createElement('div');
      row.className = 'shop-row junk-row';
      row.innerHTML = `<div class="what"><b>Everything you cannot use</b><small>${escapeHtml(junk.map(it => Game.itemName(it)).join(', '))}</small></div>`;
      const btn = document.createElement('button');
      btn.textContent = `Sell all ${total}g`; btn.className = 'afford';
      payButton(btn, row, total, 'Sell', () => Game.sellJunk(), junk.some(it => it.u));
      row.appendChild(btn);
      sellBox.appendChild(row);
    }
    for (const it of sellable) {
      const price = Game.sellPrice(it);
      // a stack sells one at a time: say so, and that the price is each
      sellBox.appendChild(shopRow(it, price, it.q > 1 ? 'Sell one' : 'Sell', true, () => Game.sell(it), it.q > 1 ? `You carry ${it.q}; ${price}g each` : itemBlurb(it)));
    }
  }

  return { SHOP_GUARD_MS, amountWords, damageShare, itemBlurb, knownE, renderShop };
}
