// The crews' pages, as the Journal shows them for this delve and the Hall keeps
// them for every delve: the story in its three acts (JOURNAL in data.js, laid on
// the floors by pagePlan in dungeon.js). A page found is shown whole; one still
// to find says which floor it waits on, so a hero who wants the whole story
// knows where to look. Split out of ui.js.
import { JOURNAL, ROUTES } from './data.js';
import { Dungeon } from './dungeon.js';
import { Game } from './game.js';
import { Progress } from './progress.js';
import { escapeHtml } from './uikit.js';

/** What each act is called: the second by the road taken, or by its keeper where no stair divides. */
function actName(act, levels, route) {
  if (act === 1) return 'I. Those who came before';
  if (act === 3) return 'III. The Heart';
  if (!Dungeon.routeSpan(levels)) return 'II. The keeper';
  return route && ROUTES[route] ? `II. Down ${ROUTES[route].name}` : 'II. The road below';
}
const pageHtml = (i, where) => `<div class="journal-entry"><h3>${escapeHtml(JOURNAL[i].title)}</h3><p>${escapeHtml(JOURNAL[i].text)}</p>${where ? `<p class="where">${where}</p>` : ''}</div>`;

/**
 * Fill el with this delve's pages, act by act, found and still to find.
 * @param {HTMLElement} el
 * @returns {string} the count line
 */
function renderPages(el) {
  const G = Game.state(), levels = (G.opts && G.opts.levels) || 8, got = Game.journal();
  const plan = Dungeon.pagePlan(levels, G.route), found = new Map(got.map(j => [j.i, j.depth]));
  const acts = [1, 2, 3].map(act => {
    const rows = plan.map((f, k) => ({ ...f, depth: k + 1 })).filter(f => f.act === act).map(f => (f.page !== null && found.has(f.page)
      ? pageHtml(f.page, `Found on floor ${found.get(f.page)}`)
      : `<div class="journal-entry missing" data-floor="${f.depth}"><p>Floor ${f.depth}: ${f.page === null ? 'a page down whichever road you take' : 'a page not yet found'}.</p></div>`));
    return rows.length ? `<section class="pages-act"><h3 class="act-head">${actName(act, levels, G.route)}</h3>${rows.join('')}</section>` : '';
  });
  // (a page this delve's plan does not hold: one found in a delve saved before the acts)
  const stray = got.filter(j => !plan.some(f => f.page === j.i) && JOURNAL[j.i]);
  el.innerHTML = (got.length ? '' : '<p class="dim">The crews who came before you left pages behind, one on every floor. You have not found any yet.</p>')
    + acts.join('') + (stray.length ? `<section class="pages-act"><h3 class="act-head">Found besides</h3>${stray.map(j => pageHtml(j.i, `Found on floor ${j.depth}`)).join('')}</section>` : '');
  return `${got.length} of ${Game.pagesInDungeon()}`;
}

/**
 * The Hall's archive: every page any hero has found, in the order of the story,
 * with how many there are in all. Hidden until the first is found.
 * @returns {string}
 */
function pageArchive() {
  const seen = Progress.load().pages;
  if (!seen.length) return '';
  // the acts in order, the roads' halves apart, the peoples' pages last
  const group = e => (e.people ? 9 : e.act === 2 ? (e.road === 'warrens' ? 3 : 2) : e.act === 3 ? 4 : 1);
  const order = JOURNAL.map((e, i) => i).filter(i => seen.includes(i)).sort((a, b) => group(JOURNAL[a]) - group(JOURNAL[b]) || (JOURNAL[a].step || 0) - (JOURNAL[b].step || 0));
  return `<details class="hall-wick hall-pages"><summary><b>The crews' pages</b> <small>${seen.length} of ${JOURNAL.length} found over all your delves</small></summary>`
    + `<ol>${order.map(i => `<li><b>${escapeHtml(JOURNAL[i].title)}.</b> ${escapeHtml(JOURNAL[i].text)}</li>`).join('')}</ol></details>`;
}

export { renderPages, pageArchive };
