import { MONSTERS } from './data.js';
import { RELICS } from './relics.js';
import { COMPANIONS, companionBook } from './companionbook.js';
import { Game } from './game.js';
import { Progress } from './progress.js';

const KEY = 'deepdelve.collections';
const CATALOGUES = { beasts: MONSTERS, companions: COMPANIONS, relics: RELICS };
const sessions = new Map();
let memory = null, lastRaw, storageBlocked = false;
const own = (table, id) => typeof id === 'string' && Object.hasOwn(table, id);
const discovered = () => ({
  beasts: Object.keys(MONSTERS).filter(id => Game.bestiary()[id]?.met > 0),
  companions: companionBook(), relics: Progress.load().relics,
});

/** Seed older discoveries as viewed on upgrade, before a new delve can find more. */
export function initCollectionMemory() {
  if (storageBlocked && memory) return memory;
  let raw;
  try { raw = localStorage.getItem(KEY); } catch { storageBlocked = true; return memory ||= { layout: 'notes', viewed: discovered() }; }
  if (memory && raw === lastRaw) return memory;
  let value;
  try { if (raw && raw.length <= 16000) value = JSON.parse(raw); } catch { /* damaged UI memory */ }
  const viewed = value?.viewed;
  const valid = value?.version === 1 && viewed && typeof viewed === 'object' && !Array.isArray(viewed)
    && Object.keys(CATALOGUES).every(kind => Object.hasOwn(viewed, kind) && Array.isArray(viewed[kind])
      && viewed[kind].length <= Object.keys(CATALOGUES[kind]).length && viewed[kind].every(id => own(CATALOGUES[kind], id)));
  memory = { layout: value?.layout === 'gallery' ? 'gallery' : 'notes', viewed: valid
    ? Object.fromEntries(Object.keys(CATALOGUES).map(kind => [kind, [...new Set(viewed[kind])]])) : discovered() };
  saveMemory();
  return memory;
}
function saveMemory() {
  lastRaw = JSON.stringify({ version: 1, ...memory });
  try { localStorage.setItem(KEY, lastRaw); } catch { storageBlocked = true; /* private browsing keeps session memory */ }
}

/**
 * Browse only already revealed text and facets. UI memory never enters a save.
 * @param {HTMLElement} root
 * @param {string} selector
 * @param {'beasts'|'companions'|'relics'} kind
 * @param {Array<{id: string, regions?: string[], types?: string[]}>} [facets]
 */
export function bindCollectionGallery(root, selector, kind, facets = []) {
  const grid = root.querySelector(selector);
  if (!grid) return;
  const prefs = initCollectionMemory();
  const state = sessions.get(kind) || { query: '', discovery: 'all', region: '', type: '', filtersOpen: false };
  sessions.set(kind, state);
  const browser = document.createElement('section');
  browser.className = 'collection-browser';
  browser.setAttribute('aria-label', 'Browse collection');
  browser.innerHTML = '<div class="collection-layout" role="group" aria-label="Collection layout"><button type="button" data-collection-layout="notes">Field notes</button><button type="button" data-collection-layout="gallery">Gallery</button></div>'
    + '<label class="collection-search">Search discovered entries<input type="search" maxlength="80" autocomplete="off" data-collection-search></label>'
    + '<details class="collection-filter-options"><summary>Filters</summary><div class="collection-filters"><label>Discovery<select data-collection-discovery><option value="all">All entries</option><option value="known">Discovered</option><option value="new">New discoveries</option><option value="unknown">Undiscovered</option></select></label></div></details>'
    + '<div class="collection-results"><p class="dim small" role="status" aria-live="polite" data-collection-count></p><button type="button" data-collection-clear>Clear filters</button></div>';
  grid.before(browser);
  const empty = document.createElement('p');
  empty.className = 'collection-empty dim'; empty.textContent = 'No entries match. Try another search or clear the filters.';
  grid.after(empty);
  const rows = [...grid.children].map(card => {
    const id = card.getAttribute(kind === 'beasts' ? 'data-beast' : kind === 'relics' ? 'data-relic' : 'data-companion');
    const known = !card.classList.contains('unmet') && !card.classList.contains('unfound');
    const text = card.querySelector(':scope > div'), heading = text?.querySelector('h3');
    const meta = known ? facets.find(x => x.id === id) : null;
    const row = { card, id, known, search: known ? (text?.textContent || '').toLocaleLowerCase() : '',
      regions: meta?.regions || [], types: meta?.types || [], fresh: known && !prefs.viewed[kind].includes(id), badge: null };
    if (!known || !text || !heading) return row;
    const name = heading.textContent;
    const notes = document.createElement('details'); notes.className = 'collection-notes';
    const summary = document.createElement('summary'); summary.textContent = 'Lore & statistics';
    summary.setAttribute('aria-label', `Lore and statistics for ${name}`); notes.append(summary);
    for (const node of [...text.childNodes]) if (node !== heading) notes.append(node);
    text.append(notes);
    const inspect = () => {
      if (!row.fresh) return;
      row.fresh = false; card.removeAttribute('data-collection-new'); row.badge?.remove();
      // Read the latest memory so another collection/tab's inspections survive.
      const current = initCollectionMemory();
      if (!current.viewed[kind].includes(id)) current.viewed[kind].push(id);
      saveMemory(); updateCount();
      // A New filter keeps the inspected card until the next filter action,
      // so its open notes and keyboard focus do not disappear under the reader.
    };
    if (row.fresh) {
      card.setAttribute('data-collection-new', 'true');
      const badge = document.createElement('button'); row.badge = badge;
      badge.type = 'button'; badge.className = 'collection-new'; badge.textContent = 'New';
      badge.setAttribute('aria-label', `View ${name} and clear its new marker`);
      badge.addEventListener('click', () => {
        notes.open = true; inspect();
        if (grid.classList.contains('collection-gallery')) summary.focus();
        else { heading.tabIndex = -1; heading.focus(); }
      });
      heading.append(badge);
    }
    summary.addEventListener('click', () => { if (!notes.open) inspect(); });
    const portrait = card.querySelector('img[role="button"]');
    portrait?.addEventListener('click', inspect);
    portrait?.addEventListener('keydown', event => { if (['Enter', ' '].includes(/** @type {KeyboardEvent} */ (event).key)) inspect(); });
    return row;
  });
  const filters = /** @type {HTMLDetailsElement} */ (browser.querySelector('.collection-filter-options'));
  filters.open = state.filtersOpen;
  filters.addEventListener('toggle', () => { state.filtersOpen = filters.open; });
  const search = /** @type {HTMLInputElement} */ (browser.querySelector('[data-collection-search]'));
  const discovery = /** @type {HTMLSelectElement} */ (browser.querySelector('[data-collection-discovery]'));
  search.value = state.query; discovery.value = state.discovery;
  const facet = (field, title, data) => {
    const options = [...new Set(rows.filter(r => r.known).flatMap(r => r[field]))].sort();
    if (!options.includes(state[data])) state[data] = '';
    if (!options.length) return;
    const label = document.createElement('label'); label.textContent = title;
    const select = document.createElement('select'); select.setAttribute(`data-collection-${data}`, '');
    for (const option of ['', ...options]) {
      const el = document.createElement('option'); el.value = option; el.textContent = option || `All ${title.toLowerCase()}s`; select.append(el);
    }
    select.value = state[data];
    select.addEventListener('change', () => { state[data] = select.value; apply(); });
    label.append(select); browser.querySelector('.collection-filters').append(label);
  };
  facet('regions', 'Region', 'region'); facet('types', 'Type', 'type');
  const count = browser.querySelector('[data-collection-count]');
  function updateCount() {
    const visible = rows.filter(r => !/** @type {HTMLElement} */ (r.card).hidden).length;
    const fresh = rows.filter(r => r.fresh).length;
    const label = `${visible} of ${rows.length} entries${fresh ? ` · ${fresh} new` : ''}`;
    // Do not repeat an unchanged live announcement with every keystroke.
    if (count.textContent !== label) count.textContent = label;
  }
  function apply() {
    const words = state.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    for (const row of rows) {
      const matches = (!words.length || row.known && words.every(word => row.search.includes(word)))
        && (!state.region || row.known && row.regions.includes(state.region))
        && (!state.type || row.known && row.types.includes(state.type))
        && (state.discovery === 'all' || state.discovery === 'known' && row.known || state.discovery === 'new' && row.fresh || state.discovery === 'unknown' && !row.known);
      /** @type {HTMLElement} */ (row.card).hidden = !matches;
    }
    empty.hidden = rows.some(r => !/** @type {HTMLElement} */ (r.card).hidden);
    browser.querySelector('[data-collection-clear]').toggleAttribute('disabled', !state.query && state.discovery === 'all' && !state.region && !state.type);
    const active = Number(state.discovery !== 'all') + Number(!!state.region) + Number(!!state.type);
    filters.querySelector('summary').textContent = `Filters${active ? ` · ${active} active` : ''}`;
    updateCount();
  }
  function layout(mode) {
    grid.classList.toggle('collection-gallery', mode === 'gallery');
    for (const button of browser.querySelectorAll('[data-collection-layout]')) button.setAttribute('aria-pressed', String(button.getAttribute('data-collection-layout') === mode));
    for (const notes of grid.querySelectorAll('details.collection-notes')) /** @type {HTMLDetailsElement} */ (notes).open = mode !== 'gallery';
  }
  for (const button of browser.querySelectorAll('[data-collection-layout]')) button.addEventListener('click', () => {
    const mode = button.getAttribute('data-collection-layout');
    initCollectionMemory().layout = mode; saveMemory(); layout(mode);
  });
  search.addEventListener('input', () => { state.query = search.value.slice(0, 80); apply(); });
  discovery.addEventListener('change', () => { state.discovery = discovery.value; apply(); });
  browser.querySelector('[data-collection-clear]').addEventListener('click', () => {
    Object.assign(state, { query: '', discovery: 'all', region: '', type: '' });
    search.value = ''; discovery.value = 'all';
    for (const select of browser.querySelectorAll('[data-collection-region], [data-collection-type]')) /** @type {HTMLSelectElement} */ (select).value = '';
    apply(); search.focus();
  });
  layout(prefs.layout); apply();
}
