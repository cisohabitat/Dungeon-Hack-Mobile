import { matchesItem } from './delveguide.js';
import { GearTools } from './geartools.js';
import { fillRelicPortraits } from './relicart.js';
import { itemHeader, itemComparison, handComparison, slotReason } from './itemdisplay.js';
import { makePackMemory } from './packmemory.js';
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

  let filter = 'all', slotTarget = '', compact = false, search = '';
  const recent = makePackMemory((key, value) => K.store(key, value));
  const wornKinds = ['armor', 'shield', 'ring', 'amulet', 'cloak'];
  const inCategory = (it, category) => category === 'all' || (category === 'weapon' ? ITEMS[it.t].kind === 'weapon' : category === 'armour' ? wornKinds.includes(ITEMS[it.t].kind) : !['weapon', ...wornKinds].includes(ITEMS[it.t].kind));
  const slotName = slot => ({ weapon: 'weapon', armor: 'armour', left: 'left hand', ring: 'first ring', ring2: 'second ring', amulet: 'amulet', cloak: 'cloak' }[slot] || slot);
  function clearFilter() {
    slotTarget = ''; filter = 'all'; K.selectedItem = null; K.selectedSlot = null;
    renderInv();
  }
  function chooseSlot(slot, it = null) {
    slotTarget = slot; filter = 'all'; K.selectedItem = it;
    K.selectedSlot = it ? (slot === 'left' ? Game.player().eq.offhand === it ? 'offhand' : 'shield' : slot) : null;
    if (it) recent.inspect(it);
    renderInv();
    $(it ? '#item-detail-title' : '#inv-slot-title').focus({ preventScroll: !!it });
    $('#inv-slot-filter').scrollIntoView({ block: 'start' });
  }
  /** Round only the displayed cells; the pack's capacity always belongs to the rules. */
  function bagCells(count) {
    const columns = Number(getComputedStyle($('#inv-grid')).getPropertyValue('--bag-columns')) || 5;
    return !slotTarget && filter === 'all' && !compact && !search ? Game.INV_MAX
      : Math.min(Game.INV_MAX, Math.max(columns, Math.ceil(count / columns) * columns));
  }
  /** Rotation changes the blank cells only, keeping item buttons and focus intact. */
  function fitBagRows() {
    if (!$('#ov-inv').classList.contains('open')) return;
    const grid = $('#inv-grid'), cells = bagCells(grid.querySelectorAll('[data-index]').length);
    while (grid.childElementCount > cells) grid.lastElementChild.remove();
    while (grid.childElementCount < cells) grid.appendChild(slotEl(null, null));
  }
  function bindPack() {
    window.addEventListener('resize', fitBagRows);
    compact = K.store('deepdelve.packCompact') === '1';
    for (const button of $('#ov-inv').querySelectorAll('[data-bag-filter]')) button.addEventListener('click', () => {
      slotTarget = ''; filter = button.dataset.bagFilter; K.selectedItem = null; K.selectedSlot = null; renderInv();
    });
    $('#inv-search').addEventListener('input', () => { search = $('#inv-search').value.slice(0, 80); K.selectedItem = null; K.selectedSlot = null; renderInv(); });
    $('#inv-search-clear').addEventListener('click', () => { search = ''; $('#inv-search').value = ''; renderInv(); $('#inv-search').focus(); });
    $('#inv-compact').addEventListener('click', () => { compact = !compact; K.store('deepdelve.packCompact', compact ? '1' : '0'); renderInv(); });
    $('#inv-clear-slot').addEventListener('click', clearFilter);
    $('#inv-sort').addEventListener('click', () => { Game.sortPack(); renderInv(); });
  }

  // Presentation memory only: taking up a save does not replay old discoveries.
  // Nothing opens the pack or holds the dungeon still on the player's behalf.
  const presented = new Set();
  const treasures = () => [...Game.player().inv, ...Object.values(Game.player().eq)].filter(it => it && ['legend', 'mythic'].includes(Game.grade(it)));
  function resetTreasure() {
    presented.clear(); filter = 'all'; slotTarget = ''; search = ''; $('#inv-search').value = ''; recent.reset();
    for (const it of treasures()) presented.add(it.u);
  }
  function prepareTreasure() {
    filter = 'all'; slotTarget = ''; search = ''; $('#inv-search').value = '';
    const it = treasures().find(it => !presented.has(it.u));
    if (it) { recent.inspect(it); K.selectedItem = it; K.selectedSlot = Object.keys(Game.player().eq).find(s => Game.player().eq[s] === it) || null; }
  }

  // Find the item again after sorting, equipping or a redraw has replaced its button.
  function focusItem(it) {
    const p = Game.player(), worn = Object.keys(p.eq).find(slot => p.eq[slot] === it);
    const el = worn ? $(`#equip [data-slot="${worn}"], #equip-jewels [data-slot="${worn}"]`)
      : p.inv.includes(it) ? $(`#inv-grid [data-index="${p.inv.indexOf(it)}"]`) : $('#inv-sort');
    if (el && el.focus) el.focus();
  }
  function closeDetail() {
    const it = K.selectedItem;
    if (!it) {
      if (!slotTarget && filter === 'all') return false;
      const slot = slotTarget; clearFilter();
      const button = slot === 'left' ? $('[data-hand="left"]') : $(`.equipment-figure [data-slot="${slot}"]`);
      (button || $('[data-bag-filter="all"]')).focus();
      return true;
    }
    K.selectedItem = null; K.selectedSlot = null;
    renderInv();
    focusItem(it);
    return true;
  }
  function selectItem(it, slot) {
    recent.inspect(it);
    K.selectedItem = it; K.selectedSlot = slot;
    renderInv();
    $('#item-detail-title').focus({ preventScroll: true });
  }
  function destinations() {
    const it = K.selectedItem;
    if (!it) return [];
    if (K.selectedSlot) return [K.selectedSlot];
    const kind = ITEMS[it.t].kind;
    if (kind === 'weapon') return [!Game.canEquip(it) && 'weapon', !Game.offhandReason(it) && 'offhand'].filter(Boolean);
    if (!['armor', 'shield', 'ring', 'amulet', 'cloak'].includes(kind) || Game.canEquip(it)) return [];
    if (kind === 'ring') {
      const eq = Game.player().eq;
      return ['ring', 'ring2'].filter(slot => !eq[slot] || !eq[slot].curse);
    }
    return [kind];
  }
  function markDestinations(slots = destinations()) {
    for (const el of $('#ov-inv').querySelectorAll('.equipment-figure .slot')) {
      const fits = slots.includes(el.dataset.slot) || (el.dataset.hand === 'left' && slots.includes('offhand'));
      el.classList.toggle('destination', fits);
      if (fits) el.dataset.hint = K.selectedSlot ? 'Selected' : 'Fits here';
      else delete el.dataset.hint;
    }
  }

  function slotEl(it, label) {
    const div = document.createElement(it || label ? 'button' : 'div');
    if (it || label) div.setAttribute('type', 'button');
    if (it) {
      div.setAttribute('aria-label',
        `${label ? label + ': ' : ''}${Game.itemName(it)}`);
    } else if (label) {
      div.setAttribute('aria-label', `${label}: empty`);
    }
    // its grade, at a glance: fine, rare, a relic or a legend each wear their own colour
    const gr = it ? Game.grade(it) : 'plain';
    div.className = 'slot' + (it ? ' filled' : '') + (gr !== 'plain' ? ` g-${gr}` : '') + (gr === 'relic' || gr === 'legend' || gr === 'mythic' ? ' relic' : '') + (it && it.curse && !it.h ? ' cursed' : '');
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
    recent.sync(); GearTools.sync();
    const eq = $('#equip');
    eq.innerHTML = '';
    // Shield, focus and second blade occupy one left hand in the rules too.
    const leftSlot = p.eq.offhand ? 'offhand' : 'shield';
    const slots = ['weapon', 'armor', leftSlot];
    const jewels = $('#equip-jewels');
    jewels.innerHTML = '';
    for (const slot of [...slots, 'ring', 'ring2', 'amulet', 'cloak']) {
      const it = p.eq[slot];
      // a mage's shield hand holds a focus; a cleric's, a shield or a holy symbol
      const shieldLabel = p.cls === 'spellblade' ? 'lantern' : p.cls === 'mage' ? 'focus' : it && ITEMS[it.t].focus ? 'symbol' : 'shield';
      const left = slot === leftSlot;
      const el = slotEl(it, left ? 'left hand' : slot === 'ring2' ? 'ring' : slot === 'armor' ? 'armour' : slot);
      el.dataset.slot = slot;
      if (left) {
        el.dataset.hand = 'left';
        const grip = !it && p.eq.weapon && ITEMS[p.eq.weapon.t].twoHanded;
        const use = grip ? 'Both hands' : slot === 'offhand' ? 'Off hand' : it ? upFirst(shieldLabel) : Game.canDualWield() ? 'Shield / off hand' : p.cls === 'spellblade' ? 'Lantern' : p.cls === 'mage' ? 'Focus' : p.cls === 'cleric' ? 'Shield / symbol' : 'Shield';
        if (!it || Game.itemName({ ...it, q: 1 }).toLowerCase() !== use.toLowerCase()) el.insertAdjacentHTML('beforeend', `<small class="slot-use">${use}</small>`);
        el.setAttribute('aria-label', `Left hand: ${it ? Game.itemName(it) + ', ' + use : grip ? 'occupied by two-handed weapon' : 'empty, ' + use}`);
        el.classList.toggle('occupied', !!grip);
      }
      el.setAttribute('aria-controls', 'inv-grid item-detail');
      el.classList.toggle('slot-target', slotTarget === (left ? 'left' : slot));
      el.addEventListener('click', () => chooseSlot(left ? 'left' : slot, it || null));
      if (K.selectedItem === it && it) { el.classList.add('sel'); el.setAttribute('aria-pressed', 'true'); }
      else if (it) el.setAttribute('aria-pressed', 'false');
      (slots.includes(slot) ? eq : jewels).appendChild(el);
    }
    const grid = $('#inv-grid');
    grid.innerHTML = '';
    $('#inv-count').textContent = `${p.inv.length} of ${Game.INV_MAX} squares`;
    // what the gear worn comes to, so a change of it is seen to count
    $('#inv-sum').innerHTML = `<div class="inv-stats"><span>Armour class <b>${escapeHtml(Game.playerAC())}</b></span><span><b>${escapeHtml((Game.toHit() >= 0 ? '+' : '') + Game.toHit())}</b> to hit</span><span><b>${escapeHtml(p.gold)}</b> gold</span></div><div class="inv-weapon">${escapeHtml(weaponLine())}</div>`;
    /** @type {HTMLButtonElement} */ ($('#inv-sort')).disabled = p.inv.length < 2;
    for (const button of $('#ov-inv').querySelectorAll('[data-bag-filter]')) {
      button.setAttribute('aria-pressed', String(!slotTarget && filter === button.dataset.bagFilter));
      button.querySelector('span').textContent = `(${p.inv.filter(it => inCategory(it, button.dataset.bagFilter)).length})`;
    }
    $('#inv-compact').setAttribute('aria-pressed', String(compact));
    $('#inv-slot-filter').hidden = !slotTarget;
    const shown = p.inv.map((it, index) => ({ it, index })).filter(({ it }) => (slotTarget ? !slotReason(it, slotTarget) : inCategory(it, filter)) && matchesItem(it, search));
    $('#inv-slot-title').textContent = slotTarget ? `Choose ${slotName(slotTarget)} · ${shown.length} compatible ${shown.length === 1 ? 'item' : 'items'}` : '';
    $('#inv-search-clear').disabled = !search;
    $('#inv-search-count').textContent = search ? `${shown.length} matching ${shown.length === 1 ? 'item' : 'items'}` : '';
    $('#inv-empty').hidden = shown.length > 0;
    $('#inv-empty').textContent = search && !shown.length ? 'No matching items. Try another name or known power, or clear the search.' : slotTarget ? `No compatible items for ${slotName(slotTarget)}. Use Show all to browse the rest of your bag.` : filter === 'all' ? 'Your bag is empty.' : 'No items in this category.';
    const cells = bagCells(shown.length);
    for (let i = 0; i < cells; i++) {
      const entry = shown[i], it = entry?.it;
      const el = slotEl(it, null);
      if (it) {
        el.dataset.index = String(entry.index);
        el.setAttribute('aria-controls', 'item-detail');
        el.addEventListener('click', () => selectItem(it, null));
        el.setAttribute('aria-pressed', String(K.selectedItem === it));
        if (K.selectedItem === it) el.classList.add('sel');
        if (GearTools.isFavourite(it)) { el.insertAdjacentHTML('beforeend', '<span class="favourite-mark" aria-hidden="true">★</span>'); el.setAttribute('aria-label', `${Game.itemName(it)}, protected favourite`); }
        if (recent.isNew(it)) {
          el.insertAdjacentHTML('beforeend', '<span class="new-find">New</span>');
          el.setAttribute('aria-label', `${el.getAttribute('aria-label')}, new find`);
        }
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
        row.innerHTML = `<img src="${Assets.sprites[Game.spriteFor(it)].url}" alt=""><span class="g-${Game.grade(it)}${it.u ? ' relic' : ''}">${escapeHtml(Game.itemName(it))}</span>`;
        // the Heart, held fast while the lich stands, says so here: its Take did nothing to see
        if (it.t === 'artifact' && Game.heartHeldFast()) {
          row.insertAdjacentHTML('beforeend', `<small class="dim">held fast while the ${Game.heartKeeper() === 'warlord' ? 'Warlord' : Game.heartKeeper() === 'heartforged' ? 'Heartforged' : 'lich'} stands</small>`);
          fb.appendChild(row);
          continue;
        }
        const b = document.createElement('button');
        b.className = 'small'; b.textContent = 'Take';
        // The inventory event redraws once, so the reveal gets its whole animation.
        b.addEventListener('click', () => { Game.takeItem(it); prepareTreasure(); });
        row.appendChild(b);
        fb.appendChild(row);
      }
    }
    markDestinations();
    renderDetail();
  }
  function renderDetail() {
    const box = $('#item-detail');
    const it = K.selectedItem;
    if (!it) { box.classList.remove('open'); box.innerHTML = ''; return; }
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
    const previewSlot = slotTarget === 'left' ? b.kind === 'weapon' ? 'offhand' : 'shield' : slotTarget;
    const compare = K.selectedSlot ? '' : itemComparison(it, previewSlot) + handComparison(it, previewSlot) + compareText(it, b) + offhandText(it, b);
    // a relic spells out each power in full, then tells its story
    const r = !it.h && Game.isKnown(it.t) ? Game.relicOf(it) : null;
    // one of a pair: name the other, and say whether both are on
    const set = r && setOf(it.u) ? RELIC_SETS[setOf(it.u)] : null, mate = set ? set.pieces.find(u => u !== it.u) : '';
    const setLine = set ? `<p class="relic-set"><b>${escapeHtml(upFirst(set.name))}</b>, with ${escapeHtml(RELICS[mate].name)}. ${escapeHtml(set.text)}${Object.values(Game.player().eq).some(x => x && x.u === mate) && Object.values(Game.player().eq).some(x => x === it) ? ' (both worn)' : ''}</p>` : '';
    const legend = r ? `<ul class="relic-powers">${r.powers.map(k => `<li>${escapeHtml(RELIC_POWERS[k])}</li>`).join('')}</ul>${setLine}<p class="relic-lore">${escapeHtml(r.lore)}</p>`
      : (it.pw && !it.h && RELIC_POWERS[it.pw] ? `<ul class="relic-powers"><li>${escapeHtml(RELIC_POWERS[it.pw])}</li></ul>` : '');
    const gr = Game.grade(it);
    const reveal = (gr === 'legend' || gr === 'mythic') && !presented.has(it.u);
    if (reveal) presented.add(it.u);
    box.classList.toggle('treasure-reveal', reveal);
    box.dataset.grade = gr;
    box.innerHTML = `<div class="item-detail-body" tabindex="0" role="region" aria-label="Item description">${itemHeader(it, { titleId: 'item-detail-title', newFind: reveal })}<p class="dim small">${escapeHtml(info)}${why ? ' <span style="color:#f88">' + escapeHtml(why) + '</span>' : ''}</p>${legend}${compare}</div><div class="buttons" aria-label="Item actions"></div>`;
    fillRelicPortraits(box);
    const btns = box.querySelector('.buttons');
    const add = (label, fn, cls, target) => {
      const bt = document.createElement('button'); bt.textContent = label;
      if (cls) bt.className = cls;
      if (target) {
        bt.addEventListener('pointerenter', () => markDestinations([target]));
        bt.addEventListener('focus', () => markDestinations([target]));
        bt.addEventListener('pointerleave', () => markDestinations());
        bt.addEventListener('blur', () => markDestinations());
      }
      bt.addEventListener('click', () => {
        fn(); K.selectedItem = null; K.selectedSlot = null;
        if (target || label === 'Unequip') { slotTarget = ''; filter = 'all'; }
        renderInv();
        if (K.overlay === 'inv') focusItem(it);
      });
      btns.appendChild(bt);
    };
    // a worn piece offers only taking it off, and a cursed one not even that
    if (K.selectedSlot) {
      add('Choose replacement', () => queueMicrotask(() => $('#inv-slot-title').focus()), 'primary');
      if (!it.curse) add('Unequip', () => Game.unequip(K.selectedSlot));
    }
    else {
      if (b.kind === 'weapon' || b.kind === 'armor' || b.kind === 'shield') {
        if (!why && (slotTarget !== 'left' || b.kind !== 'weapon')) add(it.curse && !it.h ? 'Equip (cursed!)' : 'Equip', () => Game.equip(it), it.curse && !it.h ? 'danger' : 'primary', b.kind);
        // a light blade can go in either hand, so offer the second one
        if (b.kind === 'weapon' && slotTarget !== 'weapon' && !Game.offhandReason(it)) add('Off hand', () => Game.equip(it, false, 'offhand'), slotTarget === 'left' ? 'primary' : '', 'offhand');
      }
      else if ((b.kind === 'ring' || b.kind === 'amulet') && !why) {
        const eq = Game.player().eq, warn = it.curse && !it.h, cls = warn ? 'danger' : 'primary';
        // both fingers taken, and neither held by a curse: you say which ring comes off
        if (b.kind === 'ring' && (slotTarget === 'ring' || slotTarget === 'ring2')) add(warn ? 'Put on (cursed!)' : 'Put on', () => Game.equip(it, false, slotTarget), cls, slotTarget);
        else if (b.kind === 'ring' && eq.ring && eq.ring2 && !eq.ring.curse && !eq.ring2.curse) {
          for (const s of ['ring', 'ring2']) add(`Replace ${Game.itemName(eq[s]).replace(/^Ring of /, '')}${warn ? ' (cursed!)' : ''}`, () => Game.equip(it, false, s), cls, s);
        } else add(warn ? 'Put on (cursed!)' : 'Put on', () => Game.equip(it), cls, b.kind === 'ring' ? (!eq.ring ? 'ring' : !eq.ring2 ? 'ring2' : eq.ring.curse ? 'ring2' : 'ring') : b.kind);
      }
      else if (b.kind === 'cloak') add('Put on', () => Game.equip(it), 'primary', 'cloak');
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
    const protectedItem = GearTools.isFavourite(it);
    const tools = document.createElement('details'); tools.className = 'item-tools';
    tools.innerHTML = '<summary>Favourites and quick-use belt</summary><div class="preference-buttons"></div>';
    const preference = (label, pressed, fn) => {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
      button.setAttribute('aria-pressed', String(pressed));
      button.addEventListener('click', () => {
        fn(); renderInv();
        const next = box.querySelector('.item-tools'); next.open = true;
        [...next.querySelectorAll('button')].find(b => b.textContent === label)?.focus();
      });
      tools.querySelector('.preference-buttons').appendChild(button);
    };
    preference('Protect favourite', protectedItem, () => GearTools.toggleFavourite(it));
    if (GearTools.usable(it.t)) for (let slot = 0; slot < 3; slot++) preference(`Belt ${slot + 1}`, GearTools.pinned(slot) === it.t, () => GearTools.pin(it, slot));
    box.querySelector('.item-detail-body').appendChild(tools);
    if (protectedItem) for (const button of btns.querySelectorAll('button')) if (button.textContent === 'Drop') { button.disabled = true; button.textContent = 'Protected'; }
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
    if (it.h || !Game.isKnown(it.t) || b.kind !== 'weapon' || Game.offhandReason(it) || p.eq.offhand === it) return '';
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
    if (it.h || !Game.isKnown(it.t)) return '';
    const p = Game.player();
    if (b.kind !== 'weapon' && b.kind !== 'armor' && b.kind !== 'shield') return '';
    const cur = p.eq[b.kind];
    if (cur === it || (cur && (cur.h || !Game.isKnown(cur.t))) || Game.canEquip(it)) return '';
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

  return { compareText, renderInv, resetTreasure, prepareTreasure, closeDetail, bindPack, noteInventory: recent.sync };
}
