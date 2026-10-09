// The pack: its slots, what an item does and how it compares with what is worn,
// and using a thing from it. ui.js opens it, and lends what it needs through K.
import { Assets } from './assets.js';
import { CLASSES, ITEMS } from './data.js';
import { Game } from './game.js';
import { RELICS, RELIC_POWERS, RELIC_SETS, setOf } from './relics.js';
import { $, escapeHtml, upFirst } from './uikit.js';

/** @param {any} K */
export function makePack(K) {
  const closeOverlay = (/** @type {any[]} */ ...a) => K.closeOverlay(...a);
  const damageShare = (/** @type {any[]} */ ...a) => K.damageShare(...a);
  const itemBlurb = (/** @type {any[]} */ ...a) => K.itemBlurb(...a);
  const knownE = (/** @type {any[]} */ ...a) => K.knownE(...a);
  const weaponLine = (/** @type {any[]} */ ...a) => K.weaponLine(...a);

  function slotEl(it, label) {
    const div = document.createElement(it ? 'button' : 'div');
    if (it) {
      div.setAttribute('type', 'button');
      div.setAttribute('aria-label',
        `${label ? label + ': ' : ''}${Game.itemName(it)}`);
    } else if (label) {
      div.setAttribute('aria-label', `${label}: empty`);
    }
    div.className = 'slot' + (it ? ' filled' : '') + (it && it.u ? ' relic' : '') + (it && it.curse && !it.h ? ' cursed' : '');
    if (label) div.innerHTML = `<span class="lbl">${label}</span>`;
    if (it) {
      const img = document.createElement('img');
      img.src = Assets.sprites[Game.spriteFor(it)].url;
      img.alt = '';
      div.appendChild(img);
      const n = document.createElement('div');
      n.textContent = Game.itemName({ ...it, q: 1 });
      div.appendChild(n);
      if (it.q > 1) { const q = document.createElement('span'); q.className = 'qty'; q.textContent = '×' + it.q; div.appendChild(q); }
      // gear whose quality you have yet to learn
      if (Game.qualityHidden(it)) { const u = document.createElement('span'); u.className = 'unk'; u.textContent = '?'; u.title = 'Quality unknown'; div.appendChild(u); }
    } else if (label) {
      const n = document.createElement('div'); n.textContent = '—'; div.appendChild(n);
    }
    return div;
  }
  function renderInv() {
    const p = Game.player();
    const eq = $('#equip');
    eq.innerHTML = '';
    // the off hand only earns a slot for a class that can use it
    const slots = Game.canDualWield() || p.eq.offhand
      ? ['weapon', 'offhand', 'armor', 'shield'] : ['weapon', 'armor', 'shield'];
    const jewels = $('#equip-jewels');
    jewels.innerHTML = '';
    for (const slot of [...slots, 'ring', 'ring2', 'amulet', 'cloak']) {
      const it = p.eq[slot];
      // a mage's shield hand holds a focus; a cleric's, a shield or a holy symbol
      const shieldLabel = p.cls === 'mage' ? 'focus' : it && ITEMS[it.t].focus ? 'symbol' : 'shield';
      const el = slotEl(it, slot === 'offhand' ? 'off hand' : slot === 'ring2' ? 'ring' : slot === 'shield' ? shieldLabel : slot === 'armor' ? 'armour' : slot);
      if (it) el.addEventListener('click', () => { K.selectedItem = it; K.selectedSlot = slot; renderInv(); });
      if (K.selectedItem === it && it) { el.classList.add('sel'); el.setAttribute('aria-pressed', 'true'); }
      else if (it) el.setAttribute('aria-pressed', 'false');
      (slots.includes(slot) ? eq : jewels).appendChild(el);
    }
    const grid = $('#inv-grid');
    grid.innerHTML = '';
    $('#inv-count').textContent = `${p.inv.length} of ${Game.INV_MAX} squares`;
    // what the gear worn comes to, so a change of it is seen to count
    $('#inv-sum').innerHTML = `<span>Armour class <b>${Game.playerAC()}</b></span><span>${escapeHtml(weaponLine())}, <b>${(Game.toHit() >= 0 ? '+' : '') + Game.toHit()}</b> to hit</span><span><b>${p.gold}</b> gold</span>`;
    /** @type {HTMLButtonElement} */ ($('#inv-sort')).disabled = p.inv.length < 2;
    for (let i = 0; i < Game.INV_MAX; i++) {
      const it = p.inv[i];
      const el = slotEl(it, null);
      if (it) {
        el.addEventListener('click', () => { K.selectedItem = it; K.selectedSlot = null; renderInv(); });
        el.setAttribute('aria-pressed', String(K.selectedItem === it));
        if (K.selectedItem === it) el.classList.add('sel');
      }
      grid.appendChild(el);
    }
    const fb = $('#floor-box');
    const floor = Game.floorItems();
    fb.innerHTML = '';
    if (floor.length) {
      fb.innerHTML = '<h3>On the floor</h3>';
      for (const it of floor) {
        const row = document.createElement('div');
        row.className = 'floor-item';
        row.innerHTML = `<img src="${Assets.sprites[Game.spriteFor(it)].url}" alt=""><span${it.u ? ' class="relic"' : ''}>${escapeHtml(Game.itemName(it))}</span>`;
        // the Heart, held fast while the lich stands, says so here: its Take did nothing to see
        if (it.t === 'artifact' && Game.heartHeldFast()) {
          row.insertAdjacentHTML('beforeend', `<small class="dim">held fast while the ${Game.heartKeeper() === 'warlord' ? 'Warlord' : Game.heartKeeper() === 'heartforged' ? 'Heartforged' : 'lich'} stands</small>`);
          fb.appendChild(row);
          continue;
        }
        const b = document.createElement('button');
        b.className = 'small'; b.textContent = 'Take';
        b.addEventListener('click', () => { Game.takeItem(it); renderInv(); });
        row.appendChild(b);
        fb.appendChild(row);
      }
    }
    renderDetail();
  }
  function renderDetail() {
    const box = $('#item-detail');
    const it = K.selectedItem;
    if (!it) { box.classList.remove('open'); return; }
    const b = ITEMS[it.t];
    box.classList.add('open');
    let info = itemBlurb(it);
    if (b.kind === 'weapon') info += `. Usable by ${b.cls.map(c => CLASSES[c].plural).join(', ')}.`;
    else if (info && !/[.!?]$/.test(info)) info += '.';   // what follows starts a sentence of its own
    if (!Game.isKnown(it.t)) info = b.kind === 'ring' || b.kind === 'amulet'
      ? 'You do not know what it was made for, nor whether it is cursed. Putting it on will tell you, and so will studying it.'
      : 'You do not know what this does. Using it will reveal its nature.';
    if (Game.qualityHidden(it)) info += ' Its quality is unknown: it could be finely made, or cursed. Wearing it will tell you, and so will studying it or a trader\'s eye.';
    else if (it.curse) info += K.selectedSlot
      ? ' Cursed: it will not come off. Read a Scroll of Remove Curse, pray at a shrine, or pay a trader to lift it.'
      : ' Cursed: once worn, it will not come off until the curse is broken.';
    // rusted, or simply poorly made: the forge can put it right
    else if ((it.e || 0) < 0 && (b.kind === 'weapon' || b.kind === 'armor')) info += ' Worn or rusted: a trader\'s forge can mend it.';
    const why = (b.kind === 'weapon' || b.kind === 'armor' || b.kind === 'shield') ? Game.canEquip(it) : null;
    const compare = K.selectedSlot ? '' : compareText(it, b) + offhandText(it, b);
    // a relic spells out each power in full, then tells its story
    const r = Game.relicOf(it);
    // one of a pair: name the other, and say whether both are on
    const set = r && setOf(it.u) ? RELIC_SETS[setOf(it.u)] : null, mate = set ? set.pieces.find(u => u !== it.u) : '';
    const setLine = set ? `<p class="relic-set"><b>${escapeHtml(upFirst(set.name))}</b>, with ${escapeHtml(RELICS[mate].name)}. ${escapeHtml(set.text)}${Object.values(Game.player().eq).some(x => x && x.u === mate) && Object.values(Game.player().eq).some(x => x === it) ? ' (both worn)' : ''}</p>` : '';
    const legend = r ? `<ul class="relic-powers">${r.powers.map(k => `<li>${escapeHtml(RELIC_POWERS[k])}</li>`).join('')}</ul>${setLine}<p class="relic-lore">${escapeHtml(r.lore)}</p>`
      : (it.pw && !it.h && RELIC_POWERS[it.pw] ? `<ul class="relic-powers"><li>${escapeHtml(RELIC_POWERS[it.pw])}</li></ul>` : '');
    box.innerHTML = `<h3${r ? ' class="relic"' : ''}>${escapeHtml(Game.itemName(it))}</h3><p class="dim small">${escapeHtml(info)}${why ? ' <span style="color:#f88">' + escapeHtml(why) + '</span>' : ''}</p>${legend}${compare}<div class="buttons"></div>`;
    const btns = box.querySelector('.buttons');
    const add = (label, fn, cls) => { const bt = document.createElement('button'); bt.textContent = label; if (cls) bt.className = cls; bt.addEventListener('click', () => { fn(); K.selectedItem = null; K.selectedSlot = null; renderInv(); }); btns.appendChild(bt); };
    // a worn piece offers only taking it off, and a cursed one not even that
    if (K.selectedSlot) { if (!it.curse) add('Unequip', () => Game.unequip(K.selectedSlot)); }
    else {
      if (b.kind === 'weapon' || b.kind === 'armor' || b.kind === 'shield') {
        if (!why) add(it.curse && !it.h ? 'Equip (cursed!)' : 'Equip', () => Game.equip(it), it.curse && !it.h ? 'danger' : 'primary');
        // a light blade can go in either hand, so offer the second one
        if (b.kind === 'weapon' && !Game.offhandReason(it)) add('Off hand', () => Game.equip(it, false, 'offhand'));
      }
      else if (b.kind === 'ring' || b.kind === 'amulet') {
        const eq = Game.player().eq, warn = it.curse && !it.h, cls = warn ? 'danger' : 'primary';
        // both fingers taken, and neither held by a curse: you say which ring comes off
        if (b.kind === 'ring' && eq.ring && eq.ring2 && !eq.ring.curse && !eq.ring2.curse) {
          for (const s of ['ring', 'ring2']) add(`Replace ${Game.itemName(eq[s]).replace(/^Ring of /, '')}${warn ? ' (cursed!)' : ''}`, () => Game.equip(it, false, s), cls);
        } else add(warn ? 'Put on (cursed!)' : 'Put on', () => Game.equip(it), cls);
      }
      else if (b.kind === 'cloak') add('Put on', () => Game.equip(it), 'primary');
      else if (b.kind === 'food') add('Eat', () => useFromPack(it), 'primary');
      else if (b.kind === 'potion') add('Drink', () => useFromPack(it), 'primary');
      else if (b.kind === 'scroll') add('Read', () => useFromPack(it), 'primary');
      else if (b.kind === 'oil') add('Coat weapon', () => useFromPack(it), 'primary');
      else if (b.kind === 'flask') add('Throw', () => useFromPack(it), 'primary');
      else if (b.kind === 'charm' && Game.companionHere()) add(`Give to ${Game.companion().name}`, () => { Game.giveCharm(it); if (K.overlay === 'inv') closeOverlay(); }, 'primary');
      // an unknown potion or scroll can be puzzled out instead of risked
      if ((['potion', 'scroll', 'ring', 'amulet'].includes(b.kind) && !Game.isKnown(it.t)) || it.h) {
        const block = Game.studyReason(it);
        const odds = Math.round(Game.checkChance('int', Game.STUDY_DC, Game.player().cls === 'mage' ? 2 : 0) * 100);
        if (!block) add(`Study (${odds}%)`, () => Game.study(it));
      }
      add('Drop', () => Game.dropItem(it), 'danger');
    }
    add('Close', () => {});
  }

  // A draught, a meal or a scroll used from the pack closes it, so the bottle
  // is seen to tip back, the bread bitten, the page burn and do its work; and
  // in a fight, so the controls are back at once.
  function useFromPack(it) {
    const p = Game.player(), count = () => p.inv.reduce((a, i) => a + (i.q || 1), 0), before = count();
    Game.useItem(it);
    if (count() < before && K.overlay === 'inv') setTimeout(() => { if (K.overlay === 'inv') closeOverlay(); }, 0);
  }

  // A light blade that could go in the off hand says what that would mean:
  // a second, wilder blow after each swing, a main hand a fifth slower, and
  // (if one is carried) no shield.
  function offhandText(it, b) {
    const p = Game.player();
    if (b.kind !== 'weapon' || Game.offhandReason(it) || p.eq.offhand === it) return '';
    const d = b.dmg, e = knownE(it);
    const blow = `${d[0]}d${d[1]}${d[2] + e > 0 ? '+' + (d[2] + e) : d[2] + e < 0 ? '\u2212' + -(d[2] + e) : ''}`;
    // the blade parries for a point, so a shield costs what it gave (Bulwark
    // and all) less that; a blade already there parried the same
    const sh = p.eq.shield ? ITEMS[p.eq.shield.t].ac + knownE(p.eq.shield) + ((p.talents || []).includes('bulwark') ? 2 : 0) + (p.path === 'knight' ? 1 : 0) - 1 : 0;
    const ac = p.eq.offhand ? '' : sh > 0 ? `; the shield comes off (\u2212${sh} armour class, the blade parrying for one)` : sh < 0 ? `; it parries better than the shield it replaces (+${-sh} armour class)` : p.eq.shield ? '; it parries as well as the shield it replaces' : '; it parries, for +1 armour class';
    // with a blade there already, the swing is as slow as it was
    return `<p class="compare">In the off hand: a second blow of ${blow} after each swing${p.eq.offhand ? ' in place of the one you hold there' : ', and the main hand a fifth slower'}${ac}.</p>`;
  }
  // How an unequipped piece of gear stacks up against the one in its slot.
  function compareText(it, b) {
    const p = Game.player();
    if (b.kind !== 'weapon' && b.kind !== 'armor' && b.kind !== 'shield') return '';
    const cur = p.eq[b.kind];
    if (cur === it || Game.canEquip(it)) return '';
    // (a difference that rounds away is "no change", not a bare 0)
    const fmt = n => (Math.round(n * 10) / 10 === 0 ? 'no change in' : (n > 0 ? '+' : '') + (Math.round(n * 10) / 10));
    let label, delta;
    if (b.kind === 'weapon') {
      // the game's own damage rule, Ring of Might, path and all
      const now = Game.blowRate(cur), next = Game.blowRate(it);
      label = cur ? `vs ${Game.itemName({ ...cur, q: 1 })}` : 'vs bare hands';
      delta = next - now;
      // Reach is worth blows the figure cannot count: a bow's shots as a foe
      // closes. Without saying so, the pack steered every ranger to a dagger.
      const reach = x => (x && ITEMS[x.t].range) || 1, r0 = reach(cur), r1 = reach(it);
      const far = r1 > r0 ? `, and it reaches ${r1} squares: more blows before a foe arrives`
        : r1 < r0 ? `, but ${r1 > 1 ? `it reaches only ${r1} squares` : 'only at arm\'s length'}, not ${r0}` : '';
      // coloured by the whole of it: when reach and damage pull opposite ways, neither green nor red
      const mixed = (r1 > r0 && delta < 0) || (r1 < r0 && delta > 0);
      return `<p class="compare ${mixed ? 'mixed' : delta >= 0 ? 'up' : 'down'}">${escapeHtml(label)}: ${damageShare(next / now)} over a fight${far}</p>`;
    }
    // a focus is not measured in armour: its own words say what it does
    if (b.focus || (cur && ITEMS[cur.t].focus)) return '';
    const acOf = item => (item ? ITEMS[item.t].ac + knownE(item) + (item.px === 'sturdy' && !item.h ? 1 : 0) : 0);
    delta = acOf(it) - acOf(cur);
    label = cur ? `vs ${Game.itemName({ ...cur, q: 1 })}` : 'vs nothing worn';
    return `<p class="compare ${delta >= 0 ? 'up' : 'down'}">${escapeHtml(label)}: ${fmt(delta)} armour class</p>`;
  }

  return { compareText, renderInv };
}
