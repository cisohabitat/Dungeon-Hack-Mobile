// The spell list and the hero sheet: what can be cast and what it costs, and who
// the hero is, what they carry and what it gives them. ui.js opens them, and lends
// what it needs through K.
import { BACKGROUNDS, BOONS, CAPSTONE_LEVEL, CLASSES, ITEMS, MAX_LEVEL, PATHS, PATH_LEVEL, RENOWN, STAT_NAMES, TALENTS, XP_TABLE } from './data.js';
import { Game } from './game.js';
import { PREFIX_DESC, PREFIX_NAME, RELIC_POWERS, RELIC_SETS } from './relics.js';
import { $, escapeHtml, upFirst } from './uikit.js';

/** @param {any} K */
export function makeHeroSheet(K) {
  const amountWords = K.amountWords;
  const pathCard = K.pathCard;
  const closeOverlay = (/** @type {any[]} */ ...a) => K.closeOverlay(...a);
  const faceOf = (/** @type {any[]} */ ...a) => K.faceOf(...a);



  function renderSpells() {
    const list = $('#spell-list');
    const p = Game.player();
    const spells = Game.knownSpells();
    list.innerHTML = '';
    if (!spells.length) { list.innerHTML = `<p class="dim">${CLASSES[p.cls].plural} cannot cast spells, but anyone can read scrolls from their pack.</p>`; return; }
    list.innerHTML = `<p class="dim small">Spell points: <b>${p.sp}/${p.maxSp}</b>. They return slowly as you walk and fully when you rest.</p>`;
    for (const sp of spells) {
      const ok = Game.spellAvailable(sp);
      const b = document.createElement('button');
      const ready = ok && Game.castLabel() === sp.name;
      b.className = 'spell' + (ok ? '' : ' locked') + (ready ? ' ready' : '');
      b.innerHTML = `<div class="cost">${Game.spellCost(sp)} sp</div><div><b>${sp.name}</b>${ready ? '<em class="on-cast">On the Cast button</em>' : ''}<small>${Game.spellDesc(sp)}${ok ? '' : ` Requires level ${Game.spellLevel(sp)}.`}</small></div>`;
      b.disabled = !ok;
      b.addEventListener('click', () => {
        const seq = Game.state().logSeq;
        if (Game.castSpell(sp)) { closeOverlay(); return; }
        // the reason goes to the log, hidden behind this list: show it here
        // too, but only if this cast wrote one (an older line is not the reason)
        const last = Game.state().log.slice(-1)[0];
        let why = Game.state().logSeq > seq ? (last.base || last.m) : 'You are still recovering from your last action.';
        if (Game.castLabel() === sp.name) why += ` ${sp.name} is ready on the Cast button.`;
        renderSpells();
        const n = document.createElement('p'); n.className = 'spell-why'; n.textContent = why; $('#spell-list').prepend(n);
      });
      list.appendChild(b);
    }
  }

  /** The weapon in hand as the pack and the sheet name it: its name, and its damage one figure with the make folded in. */
  function weaponLine() {
    const w = Game.weapon(), wIt = Game.player().eq.weapon;
    const wAdd = w.dmg[2] + w.e + (w.px === 'heavy' ? 1 : 0);
    return `${Game.shaped() ? 'A bear\'s claws' : wIt ? Game.itemName(wIt).replace(/ [+\u2212−]\d+$/, '') : 'Fists'} ${w.dmg[0]}d${w.dmg[1]}${wAdd > 0 ? '+' + wAdd : wAdd < 0 ? '\u2212' + -wAdd : ''}`;
  }
  function renderChar() {
    const p = Game.player(), c = CLASSES[p.cls], G = Game.state();
    const path = Game.pathOf();
    // In groups: who the hero is at the top, then what counts in a fight, the
    // six scores, and the run so far. One long list read as a ledger.
    const row = (k, v, full) => `<div class="${full ? 'full' : ''}">${k}<span>${v}</span></div>`;
    // at the top level the bar fills toward the next rank of renown
    const top12 = p.level >= MAX_LEVEL, rank = p.renown || 0;
    const next = top12 ? Game.renownAt(rank + 1) : XP_TABLE[p.level], prev = top12 ? Game.renownAt(rank) : p.level > 1 ? XP_TABLE[p.level - 1] || 0 : 0;
    const toNext = next ? Math.max(0, Math.min(100, Math.round((p.xp - prev) / Math.max(1, next - prev) * 100))) : 100;
    const top = `<div class="sheet-top"><img class="sheet-face" src="${faceOf(p.cls)}" alt="${escapeHtml(p.name)}, the ${escapeHtml(c.name)}">`
      + `<div class="sheet-who"><b>${escapeHtml(p.name)}</b><span>${path ? `${c.name}, ${escapeHtml(path.name)}` : c.name}, hero level ${p.level}${rank ? `, renown\u00a0\u2605${rank}` : ''}</span>`
      + `<div class="xp-bar" role="img" aria-label="Experience ${p.xp} of ${next || p.xp}"><i style="width:${toNext}%"></i></div>`
      + `<small>Experience ${p.xp} / ${next || '\u2014'}${top12 ? ` to renown \u2605${rank + 1}` : ''}</small></div></div>`;
    const fight = [
      row('Hit points', `${p.hp} / ${p.maxHp}`), row('Spell points', p.maxSp ? `${p.sp} / ${p.maxSp}` : '\u2014'),
      row('Armour class', Game.playerAC()), row('To hit', (Game.toHit() >= 0 ? '+' : '') + Game.toHit()),
      row('Weapon', weaponLine(), true),
    ];
    const scores = Object.keys(STAT_NAMES).map(k => { const m = Game.mod(p.stats[k]); return `<div${k === c.primary ? ' class="key-stat"' : ''}>${STAT_NAMES[k]}<span>${p.stats[k]} (${m >= 0 ? '+' : ''}${m})</span></div>`; });
    const run = [
      row('Gold', p.gold), row('Kills', p.kills), row('Steps', p.steps), row('Deepest floor', p.deepest),
      row('Pages found', `${Game.journal().length} of ${Game.pagesInDungeon()}`), row('Seed', escapeHtml(G.seed)),
      row('Background', BACKGROUNDS[p.bg] ? `${BACKGROUNDS[p.bg].name}: ${BACKGROUNDS[p.bg].perk}` : '\u2014', true),
    ];
    const groups = `<h3 class="sheet-h">In a fight</h3><div class="sheet">${fight.join('')}</div>`
      + `<h3 class="sheet-h">Scores</h3><div class="sheet scores">${scores.join('')}</div>`
      + `<h3 class="sheet-h">The run</h3><div class="sheet">${run.join('')}</div>`;
    let extra = '';
    // the path taken, or the two still ahead
    const paths = PATHS[p.cls] || [];
    if (path) {
      const cap = Game.capstoneOf();
      extra += `<h3 class="sheet-h">Path</h3><div class="path-sheet" data-path="${path.id}">${pathCard(path)}</div>`;
      if (cap) extra += `<div class="path-sheet capstone" data-capstone="${cap.id}">${pathCard(cap)}</div>`;
      else if (path.capstones) extra += `<p class="dim small">${p.level < CAPSTONE_LEVEL ? `At hero level ${CAPSTONE_LEVEL}` : 'At your next level'} you master your path: ${path.capstones.map(x => `<b>${escapeHtml(x.name)}</b>`).join(' or ')}.</p>`;
    }
    else if (paths.length) extra += `<h3 class="sheet-h">Path</h3><p class="dim small">${p.level < PATH_LEVEL ? `At hero level ${PATH_LEVEL}` : 'At your next level'} you choose your path: ${paths.map(x => `<b>${escapeHtml(x.name)}</b>`).join(' or ')}.</p>`;
    // every power the hero's gear gives, relic or plain, with the slot it is in
    const worn = [];
    // a ring that comes in amounts says its own amount, a curse's minus and
    // all, and two of one kind show once: only the better of them counts
    const amounts = new Map();
    for (const slot of ['ring', 'ring2', 'amulet']) {
      const it = p.eq[slot], b = it && ITEMS[it.t];
      if (!b || !b.bonus) continue;
      const k = [].concat(b.power)[0], v = b.bonus + (it.e || 0), had = amounts.get(k);
      amounts.set(k, { v: had ? Math.max(had.v, v) : v, n: had ? had.n + 1 : 1 });
    }
    for (const [k, { v, n }] of amounts) {
      const name = RELIC_POWERS[k] ? RELIC_POWERS[k].split(': ')[0] : k;
      worn.push(`<li><b>${escapeHtml(name)}</b><span>${escapeHtml(amountWords(k, v))} (${n > 1 ? 'the better of your two rings' : 'ring'})</span></li>`);
    }
    for (const [slot, label] of [['weapon', 'weapon'], ['offhand', 'off hand'], ['armor', 'armour'], ['shield', 'shield'], ['ring', 'ring'], ['ring2', 'ring'], ['amulet', 'amulet']]) {
      const it = p.eq[slot];
      if (!it) continue;
      if ((slot === 'ring' || slot === 'ring2' || slot === 'amulet') && ITEMS[it.t].bonus) continue;   // said above, with its amount
      const rel = Game.relicOf(it), made = ITEMS[it.t].power;
      const powers = rel ? rel.powers : made ? [].concat(made) : (it.pw && !it.h ? [it.pw] : []);
      for (const k of powers) {
        if (!RELIC_POWERS[k]) continue;
        const [name, ...rest] = RELIC_POWERS[k].split(': ');
        const what = rest.join(': ');
        worn.push(`<li><b>${escapeHtml(name)}</b><span>${escapeHtml(what.charAt(0).toUpperCase() + what.slice(1))} (${label})</span></li>`);
      }
      // a quality of its make, once known
      if (it.px && !it.h && PREFIX_NAME[it.px]) worn.push(`<li><b>${PREFIX_NAME[it.px]}</b><span>${escapeHtml(upFirst(PREFIX_DESC[it.px]))} (${label})</span></li>`);
    }
    // a relic set worn whole
    for (const id in RELIC_SETS) {
      const set = RELIC_SETS[id];
      if (set.pieces.every(u => Object.values(p.eq).some(it => it && it.u === u))) worn.push(`<li><b>${escapeHtml(upFirst(set.name))}</b><span>${escapeHtml(set.text)}</span></li>`);
    }
    // what the hand, the robe and the cloak do, in their own words
    const line = (b, what, where) => worn.push(`<li><b>${escapeHtml(b.name)}</b><span>${escapeHtml(what)} (${where})</span></li>`);
    const held = p.eq.shield && ITEMS[p.eq.shield.t];
    if (held && held.focus) line(held, held.desc, p.cls === 'mage' ? 'focus' : 'symbol');
    const robe = p.eq.armor && ITEMS[p.eq.armor.t];
    if (robe && (robe.sp || robe.cheap)) line(robe, [robe.sp ? `+${robe.sp} spell points` : '', robe.cheap ? 'spells of 5 points or more cost 1 less' : ''].filter(Boolean).join('; '), 'robe');
    const cloak = p.eq.cloak && ITEMS[p.eq.cloak.t];
    if (cloak) line(cloak, cloak.desc, 'cloak');
    if (worn.length) extra += '<h3 class="sheet-h">Powers of your gear</h3><ul class="talent-list">' + worn.join('') + '</ul>';
    // choices made on the way down that are still following the hero
    const notes = Game.threadNotes();
    if (notes.length) extra += '<h3 class="sheet-h">What follows you</h3><ul class="talent-list">' + notes.map(n => `<li><span>${escapeHtml(n)}</span></li>`).join('') + '</ul>';
    if (p.talents && p.talents.length) {
      const own = TALENTS[p.cls] || [];
      extra += '<h3 class="sheet-h">Talents</h3><ul class="talent-list">' + p.talents.map(id => {
        const t = own.find(x => x.id === id);
        return t ? `<li><b>${escapeHtml(t.name)}</b><span>${escapeHtml(t.desc)}</span></li>` : '';
      }).join('') + '</ul>';
    }
    if (p.boons && p.boons.length) {
      // the same lesson taken twice reads as "Deep Wind ×2", not twice over
      const counts = new Map();
      for (const id of p.boons) counts.set(id, (counts.get(id) || 0) + 1);
      extra += '<h3 class="sheet-h">Lessons</h3><ul class="talent-list">' + [...counts].map(([id, n]) => {
        const b = BOONS.find(x => x.id === id);
        return b ? `<li><b>${escapeHtml(b.name)}${n > 1 ? ` \u00d7${n}` : ''}</b><span>${escapeHtml(b.desc)}</span></li>` : '';
      }).join('') + '</ul>';
    }
    if (p.renownTaken && p.renownTaken.length) {
      const counts = new Map();
      for (const id of p.renownTaken) counts.set(id, (counts.get(id) || 0) + 1);
      extra += '<h3 class="sheet-h">Renown</h3><ul class="talent-list">' + [...counts].map(([id, n]) => {
        const b = RENOWN.find(x => x.id === id);
        return b ? `<li><b>${escapeHtml(b.name)}${n > 1 ? ` \u00d7${n}` : ''}</b><span>${escapeHtml(b.desc)}</span></li>` : '';
      }).join('') + '</ul>';
    }
    $('#char-sheet').innerHTML = top + groups + extra;
  }


  return { renderChar, renderSpells, weaponLine };
}
