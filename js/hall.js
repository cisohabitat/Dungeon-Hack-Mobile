import { CLASSES, ITEMS, MONSTERS, BESTIARY, PATHS, VOWS, FEATS, ROUTES, WICK } from './data.js';
import { Assets } from './assets.js';
import { Dungeon } from './dungeon.js';
import { Game } from './game.js';
import { RELIC_POWERS, RELICS, RELIC_SETS, setOf, toCollect } from './relics.js';
import { Progress } from './progress.js';
import { COMBOS } from './combos.js';
import { pageArchive } from './pagesview.js';
import { $, escapeHtml, upFirst, diffName, diffLabel } from './uikit.js';

/** Each path's name, by its id, for a legend's codex line. */
const PATH_NAME = Object.fromEntries(Object.values(PATHS).flat().map(x => [x.id, x.name]));

// The pages that outlast a run: the Hall of Heroes and its trophies, the
// bestiary, and the codex of relics. Split out of ui.js.

// ---------- bestiary ----------
const avg = ([n, s, b]) => Math.round(n * (s + 1) / 2 + b);
const dice = ([n, s, b]) => `${n}d${s}${b ? '+' + b : ''}`;
const times = n => n === 1 ? 'once' : (n === 2 ? 'twice' : `${n} times`);
/** What kind of thing it is, once one has been killed. */
function beastTraits(id, mb) {
  const t = [];
  if (mb.undead) t.push('undead');
  if (Dungeon.PACK_KINDS.includes(id)) t.push('goes about in groups');
  if (mb.fly) t.push('flies');
  if (mb.ranged) t.push(`shoots from ${mb.ranged.range} squares (${dice(mb.ranged.dmg)})`);
  if (mb.poison) t.push('venomous');
  if (mb.drain) t.push('drains life');
  if (mb.regen) t.push('regrows its wounds');
  if (mb.spellRes) t.push(`shrugs off one spell in ${Math.round(1 / mb.spellRes)}`);
  if (mb.stout) t.push('stout: poison does not take, and spells are ridden out more often');
  return t;
}
/** Fill el with the bestiary; returns the count line. */
function renderBestiary(el) {
  const known = Game.bestiary();
  // what has been met comes first, then what has not, each shallowest first
  const seen = id => known[id] && known[id].met ? 0 : 1;
  // the named champions come after the common kinds, then your own shades, and the lich last of all
  const rank = id => (MONSTERS[id].boss ? 3 : MONSTERS[id].shade ? 2 : MONSTERS[id].named ? 1 : 0);
  const ids = Object.keys(MONSTERS).sort((a, b) => seen(a) - seen(b) || rank(a) - rank(b) || MONSTERS[a].tier[0] - MONSTERS[b].tier[0] || MONSTERS[a].xp - MONSTERS[b].xp);
  const met = ids.filter(id => known[id] && known[id].met).length;
  el.innerHTML = '<div class="beasts">' + ids.map(id => {
    const mb = MONSTERS[id], r = known[id] || { met: 0, kills: 0, deaths: 0 }, lore = BESTIARY[id] || {};
    const art = Assets.sprites[mb.sprite], own = mb.named && art && art.elite && art.elite[id];
    const img = `<img src="${own ? own.url : art ? art.url : ''}" alt="">`;
    // met, its picture can be looked at close: a tap enlarges it
    const bigImg = `<img class="beast-art" src="${own ? own.url : art ? art.url : ''}" alt="${escapeHtml(mb.name)}" role="button" tabindex="0" aria-pressed="false" aria-label="Look closer at the ${escapeHtml(mb.name)}">`;
    // the first floor of this delve (or an eight-floor one, from the title) it can be met on
    const levels = (Game.state() && Game.state().opts.levels) || 8;
    let first = 1;
    while (first <= levels && Dungeon.tierAt(first, levels) < mb.tier[0]) first++;
    // a people keeps one floor of a long enough delve, and nowhere else
    const people = Object.keys(Dungeon.PEOPLES).find(k => Dungeon.PEOPLES[k].kin.some(([c]) => c === id) || (mb.named && mb.named.home === k));
    const homeFloor = people ? Dungeon.peopleDepth(people, levels) : undefined, homeWord = people ? Dungeon.PEOPLES[people].word : '';
    const where = mb.boss ? 'Guards the Heart of the Mountain' : mb.shade ? 'Keeps the floor where a hero of yours fell'
      : people ? (homeFloor ? `Only on floor ${homeFloor}, ${homeWord}` : `Only in ${homeWord}, ${(Dungeon.PEOPLES[people].from - Dungeon.PEOPLES[people].back) * 2 > Dungeon.PEOPLES[people].from ? 'deep in' : 'partway down'} a ${Dungeon.PEOPLES[people].from >= 16 ? 'sixteen-floor ' : ''}Long Delve`)
      : mb.named ? 'Holds one floor partway down some delves' : first > levels ? 'Deeper than this delve goes' : `From floor ${first} down`;
    if (!r.met) return `<div class="beast unmet" data-beast="${id}">${img}<div><h3>???</h3><p class="locked">Not yet met. ${where}.</p></div></div>`;
    const bits = [`<h3${mb.named ? ' class="named"' : ''}>${escapeHtml(mb.named ? `${mb.named.called}, the ${mb.name}` : mb.name)}</h3>`, `<p>${escapeHtml(lore.lore || '')}</p>`];
    // each shade is made to the floor it keeps: there is no one measure of them
    if (mb.shade) bits.push('<p class="beast-stats">As strong as the floor it keeps, and it fights as its hero did.</p>');
    else if (r.kills) {
      const traits = beastTraits(id, mb);
      bits.push(`<p class="beast-stats">About ${avg(mb.hp)} HP · AC ${mb.ac} · hits for ${dice(mb.dmg)} · a blow every ${(mb.speed / 1000).toFixed(1)}s · ${mb.xp} xp${traits.length ? ' · ' + traits.join(', ') : ''}</p>`);
    } else bits.push('<p class="locked">Kill one to take its measure.</p>');
    // what fire, cold and lightning were found to do to it (a champion takes after its kin)
    const els = (known[mb.named ? mb.named.kin : id] || {}).el || {};
    const elBits = Object.entries(els).map(([k, how]) => how === 'weak' ? `weak to ${k}` : `resists ${k}`);
    if (elBits.length) bits.push(`<p class="beast-el">${escapeHtml(elBits.join(' · ').replace(/^./, c => c.toUpperCase()))}.</p>`);
    if (lore.trick) {
      bits.push(r.trick ? `<p class="trick"><b>Trick:</b> ${escapeHtml(lore.trick)}</p>` : '<p class="locked">Trick: not yet seen.</p>');
      bits.push(r.answer ? `<p class="answer"><b>Answer:</b> ${escapeHtml(lore.answer)}</p>` : '<p class="locked">Answer: not yet learned.</p>');
    }
    const rec = [`${where}`, mb.shade ? (r.kills ? `laid to rest ${times(r.kills)}` : 'none laid to rest yet') : mb.named ? (r.kills ? `beaten ${times(r.kills)}` : 'not yet beaten') : r.kills ? `killed ${r.kills}` : 'none killed yet'];
    if (r.deaths) rec.push(`killed you ${times(r.deaths)}`);
    bits.push(`<p class="where">${rec.join(' · ')}</p>`);
    return `<div class="beast" data-beast="${id}">${bigImg}<div>${bits.join('')}</div></div>`;
  }).join('') + '</div>';
  // a tap (or Enter) on a met creature's picture looks at it close
  const zoom = /** @param {Event} e */ e => {
    const t = /** @type {HTMLElement} */ (e.target);
    const key = /** @type {KeyboardEvent} */ (e).key;
    if (!t || t.tagName !== 'IMG' || t.getAttribute('role') !== 'button' || (e.type !== 'click' && key !== 'Enter' && key !== ' ')) return;
    if (key === ' ') e.preventDefault();
    t.setAttribute('aria-pressed', String(t.classList.toggle('zoom')));
  };
  el.onclick = zoom; el.onkeydown = zoom;
  return `${met} of ${ids.length} met`;
}

// ---------- relic codex ----------
const KIND_NAMES = { weapon: 'Weapon', armor: 'Armour', shield: 'Shield', ring: 'Ring', amulet: 'Amulet' };
/** "A", "A and B", "A, B and C". */
const andList = xs => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs.join(''));
/** Fill el with every relic, found or not; returns the count line. */
function renderCodex(el) {
  // found ones first; one still to find says what sort of thing to look for
  const found = Progress.load().relics, ids = Object.keys(RELICS).sort((a, b) => Number(!found.includes(a)) - Number(!found.includes(b)));
  el.innerHTML = '<div class="codex">' + ids.map(id => {
    const r = RELICS[id], b = ITEMS[r.t], kind = KIND_NAMES[b.kind] || b.kind;
    // one not yet found shows only what sort of thing it is ("a Mace"; armour
    // takes no article: "Chain Mail")
    // (a ring's or an amulet's make would give it away, so those say only where to look)
    const jewel = b.kind === 'ring' || b.kind === 'amulet';
    const where = r.route && ROUTES[r.route] ? ` · found only down ${escapeHtml(ROUTES[r.route].name)}` : r.beyond ? ' · found only in a sixteen-floor delve, beyond the Collector\'s count'
      : r.legend ? ` · legendary: a ${escapeHtml(PATH_NAME[r.legend] || r.legend)}'s, dropped by a champion` : '';
    if (!found.includes(id)) return `<div class="relic-row unfound" data-relic="${id}"><span class="relic-q">?</span><div><h3>Not yet found</h3><p class="codex-kind">${kind}${jewel ? '' : ` · ${b.kind === 'armor' ? '' : /^[aeiou]/i.test(b.name) ? 'an ' : 'a '}${escapeHtml(b.name)}`}${where}</p></div></div>`;
    const art = Assets.sprites[(r.legend ? 'legend_' : 'relic_') + b.sprite] || Assets.sprites[b.sprite];
    return `<div class="relic-row" data-relic="${id}"><img src="${art ? art.url : ''}" alt=""><div><h3 class="${r.legend ? 'g-legend' : 'relic'}">${escapeHtml(upFirst(r.name))}</h3>`
      + `<p class="codex-kind">${kind} · ${escapeHtml(b.name)} +${r.e}${where}</p>`
      + `<ul class="relic-powers">${jewel ? `<li>${escapeHtml(b.desc)}</li>` : ''}${r.powers.map(k => `<li>${escapeHtml(RELIC_POWERS[k])}</li>`).join('')}</ul>`
      + (setOf(id) ? `<p class="relic-set"><b>${escapeHtml(upFirst(RELIC_SETS[setOf(id)].name))}</b>, with ${escapeHtml(RELICS[RELIC_SETS[setOf(id)].pieces.find(u => u !== id)].name)}. ${escapeHtml(RELIC_SETS[setOf(id)].text)}</p>` : '')
      + `<p class="relic-lore">${escapeHtml(r.lore)}</p></div></div>`;
  }).join('') + '</div>';
  const set = toCollect(), legends = Object.keys(RELICS).filter(id => RELICS[id].legend);
  return `${set.filter(id => found.includes(id)).length} of ${set.length} found · legends ${legends.filter(id => found.includes(id)).length} of ${legends.length}`;
}

/**
 * Fill el with every combination, found or not, bestiary-style: a found one
 * in full, with how often this run has made it; one still to find by a hint
 * of what goes into it. Returns the count line.
 */
function renderCombos(el) {
  const found = Progress.load().combos, G = Game.state(), now = (G && G.combos) || {};
  const ids = Object.keys(COMBOS).sort((a, b) => Number(!found.includes(a)) - Number(!found.includes(b)));
  el.innerHTML = '<p class="dim small combos-about">Where two things meet and make more than either: an element and the place, an oil and a foe, a relic and a talent, a legend and its path. Each is named the first time it happens, and kept here.</p><div class="codex combos">' + ids.map(id => {
    const c = COMBOS[id];
    if (!found.includes(id)) return `<div class="relic-row unfound" data-combo="${id}"><span class="relic-q">?</span><div><h3>Not yet found</h3><p class="codex-kind">${escapeHtml(c.hint)}</p></div></div>`;
    return `<div class="relic-row" data-combo="${id}"><span class="relic-q combo-mark">✦</span><div><h3 class="relic">${escapeHtml(c.name)}</h3><p class="codex-kind">${escapeHtml(c.text)}</p>`
      + (now[id] ? `<p class="combo-now">${now[id] > 1 ? `${now[id]} times` : 'Once'} this run</p>` : '') + '</div></div>';
  }).join('') + '</div>';
  return `${found.filter(id => COMBOS[id]).length} of ${Object.keys(COMBOS).length} found`;
}

/** Every class by three difficulties, each lit once that class has won there. */
function renderTrophies() {
  const v = Progress.load(), { won, total } = Progress.trophyCount(v);
  const hasHard = cls => !!(v.won[cls] && v.won[cls].hard);
  const head = ['<span></span>', ...Progress.DIFFS.map(d => `<span class="th">${diffName(d)}</span>`)];
  // a class won on Hard is named by its title
  const rows = Object.keys(CLASSES).map(cls => [`<span class="tcls">${CLASSES[cls].name}${hasHard(cls) ? ` <em class="class-title">${escapeHtml(CLASSES[cls].title)}</em>` : ''}</span>`, ...Progress.DIFFS.map(d => {
    // (and on Hard, the highest rung of the ladder past it won)
    const n = (v.won[cls] && v.won[cls][d]) || 0, top = d === 'hard' ? v.rungs[cls] || 0 : 0;
    const what = `${CLASSES[cls].name} on ${diffName(d)}: ${n ? (n === 1 ? 'won once' : `won ${n} times`) : 'not yet won'}${top ? `, up to Hard+${top}` : ''}`;
    return `<span class="cell${n ? ' won' : ''}" data-trophy="${cls}-${d}" role="button" tabindex="0" aria-label="${what}" title="${what}">${n ? '✦' : ''}${top ? `<small class="rung-won">+${top}</small>` : ''}</span>`;
  })].join(''));
  // a win with each path, two to a class, and the class mastered once both are won
  const pathRows = Object.keys(CLASSES).map(cls => [`<span class="tcls">${CLASSES[cls].name}</span>`, ...(PATHS[cls] || []).map(x => {
    const n = v.paths[x.id] || 0, what = `${x.name}: ${n ? (n === 1 ? 'won once' : `won ${n} times`) : 'not yet won'}`;
    return `<span class="cell named${n ? ' won' : ''}" data-trophy="path-${x.id}" role="button" tabindex="0" aria-label="${what}" title="${what}">${escapeHtml(x.name)}</span>`;
  }), (() => {
    const done = Progress.mastered(cls, v), what = `${CLASSES[cls].name} mastered: ${done ? 'won with both its paths' : `win with both its paths (${Progress.pathsWon(cls, v)} of 2 so far)`}`;
    return `<span class="cell mastery${done ? ' won' : ''}" data-trophy="mastery-${cls}" role="button" tabindex="0" aria-label="${what}" title="${what}">✦</span>`;
  })()].join(''));
  // and each vow kept, dim until a Hard win opens them
  const open = Progress.vowsOpen(v);
  const vowCells = Object.keys(VOWS).map(id => {
    const n = v.vows[id] || 0, what = `${VOWS[id].name}: ${n ? (n === 1 ? 'kept once' : `kept ${n} times`) : open ? 'not yet kept' : 'opens after a win on Hard'}`;
    return `<span class="cell named${n ? ' won' : ''}${open ? '' : ' shut'}" data-trophy="vow-${id}" role="button" tabindex="0" aria-label="${what}" title="${what}">${escapeHtml(VOWS[id].name)}</span>`;
  });
  // and the feats: wins of a particular kind
  const featCells = Object.keys(FEATS).map(id => {
    const n = v.feats[id] || 0, what = `${FEATS[id].name}: ${FEATS[id].desc} ${n ? (n === 1 ? 'Done once.' : `Done ${n} times.`) : 'Not yet done.'}`;
    return `<span class="cell named${n ? ' won' : ''}" data-trophy="feat-${id}" role="button" tabindex="0" aria-label="${what}" title="${what}">${escapeHtml(FEATS[id].name)}</span>`;
  });
  // and what the wins have opened: new ways to start a run, each saying how it is earned
  const opened = Progress.unlocks(v);
  const unlockCells = opened.map(u => {
    const what = `${u.name}: ${u.open ? 'open.' : 'locked. ' + u.how}`;
    return `<span class="unlock${u.open ? ' open' : ''}" data-trophy="unlock-${escapeHtml(u.id)}" role="button" tabindex="0" aria-label="${escapeHtml(what)}" title="${escapeHtml(what)}">${escapeHtml(u.name)}</span>`;
  });
  $('#hall-trophies').innerHTML = `<div class="trophy-head"><span>Trophies</span><span id="trophy-count">${won} of ${total} won</span></div>`
    + `<div class="trophy-grid">${head.join('')}${rows.join('')}</div>`
    + `<div class="trophy-sub">Paths <small>(both won: the class mastered, ✦)</small></div><div class="trophy-grid paths">${pathRows.join('')}</div>`
    + `<div class="trophy-sub">Vows${open ? '' : ' <small>(open after a win on Hard)</small>'}</div><div class="trophy-grid vows">${vowCells.join('')}</div>`
    + `<div class="trophy-sub">Feats</div><div class="trophy-grid vows">${featCells.join('')}</div>`
    + `<div class="trophy-sub">Unlocked <small>(${opened.filter(u => u.open).length} of ${opened.length}: new ways to begin)</small></div><div class="trophy-grid vows unlocks">${unlockCells.join('')}</div>`
    + '<p id="trophy-note" class="trophy-note" aria-live="polite">Tap a trophy to see what it asks and how often it is won.</p>';
  // a phone has no hover: a tap on a trophy says what its title would
  const box = $('#hall-trophies');
  box.onclick = e => { const c = /** @type {HTMLElement} */ (e.target).closest('[data-trophy]'); if (c) { $('#trophy-note').textContent = c.getAttribute('title') || ''; box.querySelectorAll('.picked').forEach(x => x.classList.remove('picked')); c.classList.add('picked'); } };
  box.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { const c = /** @type {HTMLElement} */ ((/** @type {HTMLElement} */ (e.target)).closest('[data-trophy]')); if (c) { e.preventDefault(); c.click(); } } };
  $('#hall-relics-count').textContent = `${toCollect().filter(id => v.relics.includes(id)).length} of ${toCollect().length} found`;
}
/** ", Knight": the path a hero in the Hall took, if they lived to take one. */
const hallPath = h => { const x = (PATHS[h.cls] || []).find(q => q.id === h.path); return x ? `, ${escapeHtml(x.name)}` : ''; };
function renderHall() {
  renderTrophies();
  const list = Game.hall();
  const el = $('#hall-list');
  // the dead who have not been laid to rest are still down there, and a later run will meet them
  const f = Progress.fallen();
  const still = f ? `<p class="hall-fallen">Still below: <b>${escapeHtml(f.name)} the ${escapeHtml(CLASSES[f.cls] ? CLASSES[f.cls].name : f.cls)}</b>, ${f.killer ? `killed by ${escapeHtml(f.killer)}${f.killer.includes(',') ? ',' : ''} ` : ''}on floor ${Number(f.depth) || 1}. Their shade keeps watch over their bones until a later delve lays it to rest.</p>` : '';
  // and what Wick has told, once it has met one of them: the tales in the order it told them
  const w = Progress.wick();
  const tales = w.met ? `<details class="hall-wick"><summary><b>${WICK.name}'s tales</b> <small>${w.told} of ${WICK.tales.length} heard · met ${w.met === 1 ? 'one hero' : `${w.met} heroes`}${w.won ? `, ${w.won} of whom came up with the Heart` : ''}</small></summary>`
    + `<ol>${WICK.tales.slice(0, w.told).map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ol></details>` : '';
  // and every page of the crews' any hero has found (pagesview.js)
  const kept = tales + pageArchive();
  if (!list.length) { el.innerHTML = still + kept + '<p class="dim">No heroes have entered the deep yet. Their deeds will be recorded here.</p>'; return; }
  // a daily run is marked with its day; every run says how hard it was, and one from before the choice was normal
  el.innerHTML = still + kept + '<div class="hall">' + list.map((h, i) => `<div class="hall-row${h.won ? ' won' : ''}${h.daily ? ' daily' : ''}"><span class="rank">${i + 1}</span><span class="who">${escapeHtml(h.name)}${h.daily ? ` <em class="daily-mark">${h.dailyKind === 'earned' ? 'Ranger &amp; Druid Daily' : 'Daily'} ${escapeHtml(String(h.daily))}</em>` : ''}<small>Level ${Number(h.level) || 1}${Number(h.renown) > 0 ? ` \u2605${Number(h.renown)}` : ''} ${CLASSES[h.cls] ? CLASSES[h.cls].name : escapeHtml(String(h.cls))}${hallPath(h)} · ${h.won ? 'Claimed the Heart' : 'Fell on floor ' + (Number(h.depth) || 1)}${ROUTES[h.route] ? ` · by ${ROUTES[h.route].name}` : ''}${Number(h.levels) >= 12 ? ` · the Long Delve (${Number(h.levels)} floors)` : Number(h.levels) && Number(h.levels) <= 2 ? ' · a quick delve' : Number(h.levels) && Number(h.levels) !== 8 ? ` · ${Number(h.levels)} floors` : ''} · ${Number(h.kills) || 0} ${Number(h.kills) === 1 ? 'kill' : 'kills'}${Array.isArray(h.named) && h.named.length ? ` · slew ${andList(h.named.map(n => escapeHtml(String(n))))}` : ''}${typeof h.rested === 'string' && h.rested ? ` · laid ${escapeHtml(h.rested)} to rest` : ''} · ${Number(h.gold) || 0} gold · ${diffLabel(h)}${Array.isArray(h.vows) && h.vows.length ? ` · ${h.vows.filter(v => VOWS[v]).map(v => escapeHtml(VOWS[v].name)).join(', ')}` : ''} · seed ${escapeHtml(h.seed)}</small></span><span class="score">${Number(h.score) || 0}<small>SCORE</small></span></div>`).join('') + '</div>';
}

export { renderBestiary, renderCodex, renderCombos, renderTrophies, renderHall };
