import { CLASSES, ITEMS, MONSTERS, BESTIARY, PATHS, VOWS, FEATS, ROUTES } from './data.js';
import { Assets } from './assets.js';
import { Dungeon } from './dungeon.js';
import { Game } from './game.js';
import { RELIC_POWERS, RELICS, RELIC_SETS, setOf } from './relics.js';
import { Progress } from './progress.js';
import { $, escapeHtml, upFirst, diffOf, diffName } from './uikit.js';

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
  return t;
}
/** Fill el with the bestiary; returns the count line. */
function renderBestiary(el) {
  const known = Game.bestiary();
  // what has been met comes first, then what has not, each shallowest first
  const seen = id => known[id] && known[id].met ? 0 : 1;
  // the named champions come after the common kinds, and the lich last of all
  const rank = id => (MONSTERS[id].boss ? 2 : MONSTERS[id].named ? 1 : 0);
  const ids = Object.keys(MONSTERS).sort((a, b) => seen(a) - seen(b) || rank(a) - rank(b) || MONSTERS[a].tier[0] - MONSTERS[b].tier[0] || MONSTERS[a].xp - MONSTERS[b].xp);
  const met = ids.filter(id => known[id] && known[id].met).length;
  el.innerHTML = '<div class="beasts">' + ids.map(id => {
    const mb = MONSTERS[id], r = known[id] || { met: 0, kills: 0, deaths: 0 }, lore = BESTIARY[id] || {};
    const art = Assets.sprites[mb.sprite], own = mb.named && art && art.elite && art.elite[id];
    const img = `<img src="${own ? own.url : art ? art.url : ''}" alt="">`;
    // the first floor of this delve (or an eight-floor one, from the title) it can be met on
    const levels = (Game.state() && Game.state().opts.levels) || 8;
    let first = 1;
    while (first <= levels && Dungeon.tierAt(first, levels) < mb.tier[0]) first++;
    const where = mb.boss ? 'Guards the Heart of the Mountain' : mb.named ? 'Holds one floor partway down some delves' : first > levels ? 'Deeper than this delve goes' : `From floor ${first} down`;
    if (!r.met) return `<div class="beast unmet" data-beast="${id}">${img}<div><h3>???</h3><p class="locked">Not yet met. ${where}.</p></div></div>`;
    const bits = [`<h3${mb.named ? ' class="named"' : ''}>${escapeHtml(mb.named ? `${mb.named.called}, the ${mb.name}` : mb.name)}</h3>`, `<p>${escapeHtml(lore.lore || '')}</p>`];
    if (r.kills) {
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
    const rec = [`${where}`, mb.named ? (r.kills ? `beaten ${times(r.kills)}` : 'not yet beaten') : r.kills ? `killed ${r.kills}` : 'none killed yet'];
    if (r.deaths) rec.push(`killed you ${times(r.deaths)}`);
    bits.push(`<p class="where">${rec.join(' · ')}</p>`);
    return `<div class="beast" data-beast="${id}">${img}<div>${bits.join('')}</div></div>`;
  }).join('') + '</div>';
  return `${met} of ${ids.length} met`;
}

// ---------- relic codex ----------
const KIND_NAMES = { weapon: 'Weapon', armor: 'Armour', shield: 'Shield', ring: 'Ring', amulet: 'Amulet' };
/** Fill el with every relic, found or not; returns the count line. */
function renderCodex(el) {
  // found ones first; one still to find says what sort of thing to look for
  const found = Progress.load().relics, ids = Object.keys(RELICS).sort((a, b) => Number(!found.includes(a)) - Number(!found.includes(b)));
  el.innerHTML = '<div class="codex">' + ids.map(id => {
    const r = RELICS[id], b = ITEMS[r.t], kind = KIND_NAMES[b.kind] || b.kind;
    // one not yet found shows only what sort of thing it is
    // (a ring's or an amulet's make would give it away, so those say only where to look)
    const jewel = b.kind === 'ring' || b.kind === 'amulet';
    const where = r.route && ROUTES[r.route] ? ` · found only down ${escapeHtml(ROUTES[r.route].name)}` : '';
    if (!found.includes(id)) return `<div class="relic-row unfound" data-relic="${id}"><span class="relic-q">?</span><div><h3>Not yet found</h3><p class="codex-kind">${kind}${jewel ? '' : ` · a ${escapeHtml(b.name)}`}${where}</p></div></div>`;
    const art = Assets.sprites['relic_' + b.sprite] || Assets.sprites[b.sprite];
    return `<div class="relic-row" data-relic="${id}"><img src="${art ? art.url : ''}" alt=""><div><h3 class="relic">${escapeHtml(upFirst(r.name))}</h3>`
      + `<p class="codex-kind">${kind} · ${escapeHtml(b.name)} +${r.e}${where}</p>`
      + `<ul class="relic-powers">${jewel ? `<li>${escapeHtml(b.desc)}</li>` : ''}${r.powers.map(k => `<li>${escapeHtml(RELIC_POWERS[k])}</li>`).join('')}</ul>`
      + (setOf(id) ? `<p class="relic-set"><b>${escapeHtml(upFirst(RELIC_SETS[setOf(id)].name))}</b>, with ${escapeHtml(RELICS[RELIC_SETS[setOf(id)].pieces.find(u => u !== id)].name)}. ${escapeHtml(RELIC_SETS[setOf(id)].text)}</p>` : '')
      + `<p class="relic-lore">${escapeHtml(r.lore)}</p></div></div>`;
  }).join('') + '</div>';
  return `${ids.filter(id => found.includes(id)).length} of ${ids.length} found`;
}

/** Every class by three difficulties, each lit once that class has won there. */
function renderTrophies() {
  const v = Progress.load(), { won, total } = Progress.trophyCount(v);
  const hasHard = cls => !!(v.won[cls] && v.won[cls].hard);
  const head = ['<span></span>', ...Progress.DIFFS.map(d => `<span class="th">${diffName(d)}</span>`)];
  // a class won on Hard is named by its title
  const rows = Object.keys(CLASSES).map(cls => [`<span class="tcls">${CLASSES[cls].name}${hasHard(cls) ? ` <em class="class-title">${escapeHtml(CLASSES[cls].title)}</em>` : ''}</span>`, ...Progress.DIFFS.map(d => {
    const n = (v.won[cls] && v.won[cls][d]) || 0, what = `${CLASSES[cls].name} on ${diffName(d)}: ${n ? (n === 1 ? 'won once' : `won ${n} times`) : 'not yet won'}`;
    return `<span class="cell${n ? ' won' : ''}" data-trophy="${cls}-${d}" role="img" aria-label="${what}" title="${what}">${n ? '✦' : ''}</span>`;
  })].join(''));
  // a win with each path, two to a class
  const pathRows = Object.keys(CLASSES).map(cls => [`<span class="tcls">${CLASSES[cls].name}</span>`, ...(PATHS[cls] || []).map(x => {
    const n = v.paths[x.id] || 0, what = `${x.name}: ${n ? (n === 1 ? 'won once' : `won ${n} times`) : 'not yet won'}`;
    return `<span class="cell named${n ? ' won' : ''}" data-trophy="path-${x.id}" role="img" aria-label="${what}" title="${what}">${escapeHtml(x.name)}</span>`;
  })].join(''));
  // and each vow kept, dim until a Hard win opens them
  const open = Progress.vowsOpen(v);
  const vowCells = Object.keys(VOWS).map(id => {
    const n = v.vows[id] || 0, what = `${VOWS[id].name}: ${n ? (n === 1 ? 'kept once' : `kept ${n} times`) : open ? 'not yet kept' : 'opens after a win on Hard'}`;
    return `<span class="cell named${n ? ' won' : ''}${open ? '' : ' shut'}" data-trophy="vow-${id}" role="img" aria-label="${what}" title="${what}">${escapeHtml(VOWS[id].name)}</span>`;
  });
  // and the feats: wins of a particular kind
  const featCells = Object.keys(FEATS).map(id => {
    const n = v.feats[id] || 0, what = `${FEATS[id].name}: ${FEATS[id].desc} ${n ? (n === 1 ? 'Done once.' : `Done ${n} times.`) : 'Not yet done.'}`;
    return `<span class="cell named${n ? ' won' : ''}" data-trophy="feat-${id}" role="img" aria-label="${what}" title="${what}">${escapeHtml(FEATS[id].name)}</span>`;
  });
  $('#hall-trophies').innerHTML = `<div class="trophy-head"><span>Trophies</span><span id="trophy-count">${won} of ${total} won</span></div>`
    + `<div class="trophy-grid">${head.join('')}${rows.join('')}</div>`
    + `<div class="trophy-sub">Paths</div><div class="trophy-grid paths">${pathRows.join('')}</div>`
    + `<div class="trophy-sub">Vows${open ? '' : ' <small>(open after a win on Hard)</small>'}</div><div class="trophy-grid vows">${vowCells.join('')}</div>`
    + `<div class="trophy-sub">Feats</div><div class="trophy-grid vows">${featCells.join('')}</div>`;
  $('#hall-relics-count').textContent = `${v.relics.length} of ${Object.keys(RELICS).length} found`;
}
/** ", Knight": the path a hero in the Hall took, if they lived to take one. */
const hallPath = h => { const x = (PATHS[h.cls] || []).find(q => q.id === h.path); return x ? `, ${escapeHtml(x.name)}` : ''; };
function renderHall() {
  renderTrophies();
  const list = Game.hall();
  const el = $('#hall-list');
  if (!list.length) { el.innerHTML = '<p class="dim">No heroes have entered the deep yet. Their deeds will be recorded here.</p>'; return; }
  // a daily run is marked with its day; every run says how hard it was, and one from before the choice was normal
  el.innerHTML = '<div class="hall">' + list.map((h, i) => `<div class="hall-row${h.won ? ' won' : ''}${h.daily ? ' daily' : ''}"><span class="rank">${i + 1}</span><span class="who">${escapeHtml(h.name)}${h.daily ? ` <em class="daily-mark">Daily ${escapeHtml(String(h.daily))}</em>` : ''}<small>Level ${Number(h.level) || 1} ${CLASSES[h.cls] ? CLASSES[h.cls].name : escapeHtml(String(h.cls))}${hallPath(h)} · ${h.won ? 'Claimed the Heart' : 'Fell on floor ' + h.depth}${ROUTES[h.route] ? ` · by ${ROUTES[h.route].name}` : ''}${Number(h.levels) >= 12 ? ` · the Long Delve (${Number(h.levels)} floors)` : Number(h.levels) && Number(h.levels) !== 8 ? ` · ${Number(h.levels)} floors` : ''} · ${h.kills} kills${Array.isArray(h.named) && h.named.length ? ` · slew ${h.named.map(n => escapeHtml(String(n))).join(' and ')}` : ''} · ${h.gold} gold · ${diffName(diffOf(h))}${Array.isArray(h.vows) && h.vows.length ? ` · ${h.vows.filter(v => VOWS[v]).map(v => escapeHtml(VOWS[v].name)).join(', ')}` : ''} · seed ${escapeHtml(h.seed)}</small></span><span class="score">${h.score}<small>SCORE</small></span></div>`).join('') + '</div>';
}

export { renderBestiary, renderCodex, renderTrophies, renderHall };
