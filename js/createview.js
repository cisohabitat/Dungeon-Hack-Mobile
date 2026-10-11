// The New Game screen: the hero made by hand. Its classes, backgrounds and vows as
// cards, the scores rolled or bought, the name drawn to suit the background, the
// difficulty and the delve's length; and Quick Start, a ready hero straight in. A
// factory in the K pattern, wired at the end of ui.js, which keeps the prologue
// and the run's start.
import { randomSeedWord } from './rng.js';
import { heroName, BACKGROUNDS, CLASSES, STAT_NAMES, PATHS, VOWS, DIFFICULTY_NOTES } from './data.js';
import { Assets } from './assets.js';
import { Dungeon } from './dungeon.js';
import { Game } from './game.js';
import { Progress } from './progress.js';
import { $, $$, escapeHtml, diffLabel } from './uikit.js';
import { renderStart, renderRung } from './createextras.js';

/**
 * @param {{
 *   showScreen: (id: string) => void,
 *   showPrologue: (cfg: any) => void,
 *   startNow: (cfg: any) => void,
 * }} K
 */
export function makeCreateView(K) {
  /** @type {{cls: string, bg: string, stats: any, rolled: any, difficulty: string, vows: string[], kit: string, hound: boolean, rung: number, mode: string, buy: Record<string, number>|null, buyTouched: boolean}} */
  let create = { cls: 'fighter', bg: 'oathbroken', stats: null, rolled: null, difficulty: 'normal', vows: [], kit: '', hound: false, rung: 0, mode: 'roll', buy: null, buyTouched: false };
  // Point buy: every score starts at 8 and 27 points raise them, dearer near
  // the top, to 17 at most (a background's bonus goes on after). About what
  // an average roll gives, but placed where the player wants it; 16 and 17
  // cost dearly, so a planned hero can match a lucky roll's best score.
  const BUY_COST = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9, 16: 12, 17: 15 }, BUY_POINTS = 27, BUY_TOP = 17;
  const buyLeft = b => BUY_POINTS - Object.values(b).reduce((n, v) => n + BUY_COST[v], 0);
  /** A sensible start for a class: its key score 15, then hardiness, then its fighting score. */
  function buyStart(cls) {
    // (a druid's Wisdom lands the blows, so Dexterity for light armour comes next)
    const key = CLASSES[cls].primary, fight = cls === 'thief' || cls === 'mage' || cls === 'ranger' || cls === 'druid' ? 'dex' : 'str';
    const b = { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 8 };
    b[key] = 15; if (fight !== key) b[fight] = 13;
    return b;
  }
  /** What a delve of this many floors holds, under the options. */
  function levelsNote() {
    const n = parseInt($('#c-levels').value, 10);
    $('#c-levels-note').textContent = n <= 2
      ? 'A quick delve: two floors, a lesser lich keeping the Heart at the bottom of the second. Over in a quarter of an hour; trophies wait for four floors or more.'
      : n >= 12
      ? `The Long Delve: ${n} floors. From the seventh the dark bites harder and its creatures are sturdier, three champions hold it, and a third of the way down the stair divides. A win is a feat of its own.`
      : Dungeon.routeSpan(n) ? 'A third of the way down, the stair divides: the Crypts or the Warrens, your choice.'
      : 'A short delve: the stair runs straight down, with no road to choose.';
  }
  /** A run's difficulty; a save from before there was a choice is normal. */
  function setDifficulty(d) {
    create.difficulty = DIFFICULTY_NOTES[d] ? d : 'normal';
    for (const b of $$('#c-difficulty [data-diff]')) { const on = b.dataset.diff === create.difficulty; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); }
    $('#c-diff-note').textContent = DIFFICULTY_NOTES[create.difficulty];
    renderRung(/** @type {HTMLElement} */ ($('#c-rung')), create, () => setDifficulty(create.difficulty));
    createSummary();
  }

  // ---------- character creation ----------
  // ---------- character creation ----------
  /** What a class card says of its paths, won and still to win. @param {{name: string}[]} won @param {{name: string}[]} left */
  const pathGoal = (won, left) => `${won.length ? `Won as ${won.map(x => escapeHtml(x.name)).join(' and ')}; to` : 'To'} master: win as ${left.map(x => escapeHtml(x.name)).join(' and ')}`;
  /** The classes that forgive a new player's mistakes: marked on the cards, and a first Quick Start's. */
  const FIRST_HEROES = ['fighter', 'cleric'];
  /** A class's hero, head and shoulders (see PORTRAITS in creatures.js), as an image's source. */
  const faceOf = cls => { const s = Assets.sprites['portrait_' + cls]; return s && s.url ? s.url : ''; };
  /** The hero chosen so far, beside Descend: the cards that say it can be scrolled far out of sight. */
  function createSummary() {
    const el = $('#c-summary');
    if (el) el.textContent = `${CLASSES[create.cls] ? CLASSES[create.cls].name : create.cls} \u00b7 ${BACKGROUNDS[create.bg] ? BACKGROUNDS[create.bg].name : create.bg} \u00b7 ${diffLabel(create)}`;
  }
  function buildCreate() {
    createSummary();
    const grid = $('#c-classes');
    grid.innerHTML = '';
    const known = Progress.load();
    for (const id in CLASSES) {
      const c = CLASSES[id];
      const b = document.createElement('button');
      b.className = 'class-card' + (id === create.cls ? ' sel' : '');
      b.type = 'button';
      b.dataset.cls = id;
      b.setAttribute('aria-pressed', String(id === create.cls));
      // a Hard win earns the class's title, shown on its card from then on
      const titled = Progress.hasWon(id, 'hard', known) ? `<em class="class-title">${escapeHtml(c.title)}</em>` : '';
      // someone new to the delve is pointed at the classes that forgive mistakes
      const first = FIRST_HEROES.includes(id) && Game.hall().length < 3 ? '<em class="first-hero">Good first hero</em>' : '';
      // and once a class has a win, the next thing to aim for with it: both its paths
      const paths = PATHS[id] || [];
      const goal = !Progress.highest(id, known) || !paths.length ? ''
        : Progress.mastered(id, known) ? '<em class="key mastery">Mastered: both paths won</em>'
          : `<em class="key goal">${pathGoal(paths.filter(x => known.paths[x.id]), paths.filter(x => !known.paths[x.id]))}</em>`;
      // a card says only enough to choose by: who, and in a line how they play;
      // the whole of it is told beneath for the one chosen, at the full width
      b.innerHTML = `<span class="cc-head"><img class="class-face" src="${faceOf(id)}" alt=""><span class="cc-name"><b>${c.name}</b>${first}${titled}</span></span><em class="ease">${escapeHtml(c.ease || '')}</em>${goal}`;
      b.addEventListener('click', () => { create.cls = id; fitStats(); if (create.mode === 'buy' && !create.buyTouched) create.buy = buyStart(id); buildCreate(); });
      grid.appendChild(b);
    }
    {
      const c = CLASSES[create.cls];
      $('#c-class-more').innerHTML = `<b>${c.name}</b> ${c.desc} <em class="key">Key stat: ${STAT_NAMES[c.primary]}</em>`;
    }
    const bgGrid = $('#c-backgrounds');
    bgGrid.innerHTML = '';
    // a past still to be earned cannot stay chosen
    const progress = Progress.load();
    // vows, once a hero has won on Hard: each one a harder run and a trophy of its own
    const vowsOpen = Progress.vowsOpen(progress);
    /** @type {HTMLElement} */ ($('#c-vows')).hidden = !vowsOpen;
    if (!vowsOpen) create.vows = [];
    $('#c-vow-list').innerHTML = Object.keys(VOWS).map(id => `<label class="check"><input type="checkbox" data-vow="${id}"${create.vows.includes(id) ? ' checked' : ''}> <span><b>${escapeHtml(VOWS[id].name)}</b> <em class="vow-score">+${Math.round(VOWS[id].score * 100)}% score</em>: ${escapeHtml(VOWS[id].desc)}</span></label>`).join('');
    for (const box of $$('#c-vow-list [data-vow]')) box.addEventListener('change', () => {
      const id = /** @type {HTMLInputElement} */ (box).dataset.vow || '';
      create.vows = /** @type {HTMLInputElement} */ (box).checked ? [...new Set([...create.vows, id])] : create.vows.filter(v => v !== id);
    });
    if (!Progress.bgOpen(create.bg, progress)) create.bg = 'oathbroken';
    for (const id in BACKGROUNDS) {
      const b = BACKGROUNDS[id], open = Progress.bgOpen(id, progress);
      const el = document.createElement('button');
      el.className = 'bg-card' + (id === create.bg ? ' sel' : '') + (open ? '' : ' locked');
      el.type = 'button';
      el.dataset.bg = id;
      el.setAttribute('aria-pressed', String(id === create.bg));
      // a locked card says what it is and how to earn it, and cannot be chosen
      el.innerHTML = open ? `<b>${escapeHtml(b.name)}</b><small>${escapeHtml(b.blurb)}</small><em class="key">${escapeHtml(b.perk)}</em>`
        : `<b>${escapeHtml(b.name)}</b><small>${escapeHtml(b.blurb)}</small><em class="key lock">Locked. ${escapeHtml(b.how)}</em>`;
      el.disabled = !open;
      // (the name shown stays: a name that changed under the player read as a fault; the dice beside it draw another)
      if (open) el.addEventListener('click', () => { create.bg = id; buildCreate(); });
      bgGrid.appendChild(el);
    }
    $('#c-bg-perk').textContent = BACKGROUNDS[create.bg].perk;
    renderStart(/** @type {HTMLElement} */ ($('#c-start')), create, buildCreate);
    renderRung(/** @type {HTMLElement} */ ($('#c-rung')), create, () => setDifficulty(create.difficulty));
    createSummary();
    if (!create.stats) fitStats();
    const buying = create.mode === 'buy';
    if (buying) { if (!create.buy) create.buy = buyStart(create.cls); create.stats = create.buy; }
    for (const b of $$('#c-statmode [data-mode]')) { const on = b.dataset.mode === create.mode; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); }
    /** @type {HTMLElement} */ ($('#c-reroll')).hidden = buying;
    const pts = /** @type {HTMLElement} */ ($('#c-points'));
    pts.hidden = !buying;
    if (buying) pts.textContent = `${buyLeft(create.buy)} of ${BUY_POINTS} points left. Scores run from 8 to ${BUY_TOP}, dearer near the top.`;
    const st = $('#c-stats');
    st.innerHTML = '';
    st.classList.toggle('buying', buying);
    for (const k in STAT_NAMES) {
      // shown as the hero will have it, background bonus included
      const boost = create.bg === 'ashborn' && k === 'con' ? 1 : 0;
      const v = create.stats[k] + boost;
      const m = Game.mod(v);
      const div = document.createElement('div');
      const key = CLASSES[create.cls].primary === k;
      div.innerHTML = `${STAT_NAMES[k].slice(0, 3).toUpperCase()}${key ? ' \u2605' : ''} <span>${v} (${m >= 0 ? '+' : ''}${m})</span>`;
      if (key) { div.className = 'key-stat'; div.title = `Key stat for a ${CLASSES[create.cls].name}`; }
      if (boost) { div.classList.add('bg-boost'); div.title = `Includes +${boost} from your background, ${BACKGROUNDS[create.bg].name}`; }
      if (buying) {
        const b = create.buy, step = (dv) => { b[k] += dv; create.stats = b; create.buyTouched = true; buildCreate(); };
        const less = document.createElement('button'), more = document.createElement('button');
        less.type = more.type = 'button'; less.className = more.className = 'buy-step';
        less.textContent = '\u2212'; more.textContent = '+';
        less.dataset.stat = more.dataset.stat = k; less.dataset.step = '-1'; more.dataset.step = '1';
        less.setAttribute('aria-label', `Lower ${STAT_NAMES[k]}`); more.setAttribute('aria-label', `Raise ${STAT_NAMES[k]}`);
        less.disabled = b[k] <= 8;
        more.disabled = b[k] >= BUY_TOP || BUY_COST[b[k] + 1] - BUY_COST[b[k]] > buyLeft(b);
        less.addEventListener('click', () => step(-1)); more.addEventListener('click', () => step(1));
        const row = document.createElement('span'); row.className = 'buy-row';
        row.append(less, more);
        div.appendChild(row);
      }
      st.appendChild(div);
    }
  }
  /** The best roll belongs in the class's key stat: a thief with 7 dexterity was a
   * trap. Worked out afresh from the roll each time, so trying Mage and going back to
   * Fighter gives back the Fighter's numbers rather than keeping the Mage's swap. */
  function fitStats() {
    if (!create.rolled) create.rolled = Game.rollStats();
    const st = { ...create.rolled }, keyStat = CLASSES[create.cls].primary;
    const best = Object.keys(st).reduce((a, b) => (st[b] > st[a] ? b : a), keyStat);
    [st[keyStat], st[best]] = [st[best], st[keyStat]];
    create.stats = st;
  }
  /** The name the game last put in the box: a background chosen after it may redraw it, a typed one it leaves alone. */
  let autoName = '';
  /** A name that often sounds like the hero's background, never the one given just before. */
  function drawHeroName() { autoName = heroName(create.bg, $('#c-name').value); $('#c-name').value = autoName; }
  function openCreation() {
    // every new hero arrives with a name of their own, to keep or type over
    if (!Progress.bgOpen(create.bg, Progress.load())) create.bg = 'oathbroken';
    drawHeroName();
    create.buy = null; create.buyTouched = false;   // a new hero's points are its own, not the last one's
    create.rolled = Game.rollStats();
    fitStats();
    buildCreate();
    K.showScreen('screen-create');
  }
  /** A random hero with sensible numbers, straight to the prologue. */
  function quickStart() {
    const progress = Progress.load(), classes = Object.keys(CLASSES), pasts = Object.keys(BACKGROUNDS).filter(id => Progress.bgOpen(id, progress));
    // someone's very first run gets a class that forgives mistakes
    const firstRun = !Game.hall().length;
    const pool = firstRun ? FIRST_HEROES : classes;
    create.cls = pool[Math.floor(Math.random() * pool.length)];
    create.bg = pasts[Math.floor(Math.random() * pasts.length)];
    // "straight in" should not mean a hero who cannot hit a rat: roll again
    // until the key stat and the fighting stat both pull their weight
    for (let i = 0; i < 40; i++) {
      create.rolled = Game.rollStats();
      fitStats();
      // (a druid's blows answer Strength or Wisdom, whichever is higher)
      const s = create.stats, fight = create.cls === 'druid' ? Math.max(s.str, s.wis) : create.cls === 'thief' || create.cls === 'ranger' ? s.dex : s.str;
      if (s[CLASSES[create.cls].primary] >= 14 && fight >= 12 && s.con >= 10) break;
    }
    const cfg = { name: heroName(create.bg), cls: create.cls, bg: create.bg, stats: create.stats, seed: randomSeedWord(),
      opts: { levels: 8, size: 'medium', monsters: 'normal', treasure: 'normal', lockedDoors: true, traps: true, permadeath: true, difficulty: /** @type {'normal'} */ ('normal') } };
    // "straight in" means it for anyone who has been down before; a first
    // hero still hears why the Heart matters
    if (firstRun) K.showPrologue(cfg);
    else K.startNow(cfg);
  }
  function beginGame() {
    const cfg = {
      name: $('#c-name').value,
      cls: create.cls,
      bg: create.bg,
      stats: create.stats,
      // a custom seed cannot borrow a Daily Delve's or the week's, or the day's one try could be practised first
      seed: ((($('#c-seed').value || '').trim() || randomSeedWord())).replace(/^daily-/i, 'my-daily-').replace(/^weekly-/i, 'my-weekly-'),
      opts: {
        levels: parseInt($('#c-levels').value, 10),
        size: $('#c-size').value,
        monsters: $('#c-monsters').value,
        treasure: $('#c-treasure').value,
        lockedDoors: $('#c-locked').checked,
        traps: $('#c-traps').checked,
        permadeath: $('#c-permadeath').checked,
        difficulty: /** @type {'easy'|'normal'|'hard'} */ (create.difficulty),
        ...(create.vows.length ? { vows: create.vows.slice() } : {}),
        ...(create.kit ? { kit: create.kit } : {}),
        ...(create.hound ? { companion: 'hound' } : {}),
        ...(create.difficulty === 'hard' && create.rung ? { rung: create.rung } : {}),
      },
    };
    K.showPrologue(cfg);
  }

  /** The screen's own controls, wired once. */
  function bindCreate() {
    $('#c-reroll').addEventListener('click', () => { create.rolled = Game.rollStats(); fitStats(); buildCreate(); });
    for (const b of $$('#c-statmode [data-mode]')) b.addEventListener('click', () => {
      create.mode = b.dataset.mode || 'roll';
      // points the player placed are kept across a look at the rolled scores
      if (create.mode === 'roll') fitStats(); else if (!create.buy || !create.buyTouched) create.buy = buyStart(create.cls);
      buildCreate();
      // the scores (and the points left) are what just changed: keep them clear of the sticky footer
      const el = create.mode === 'buy' ? $('#c-points') : $('#c-stats');
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    $('#c-seed-rand').addEventListener('click', () => { $('#c-seed').value = randomSeedWord(); });
    $('#c-levels').addEventListener('change', levelsNote);
    levelsNote();
    // anything typed in the name box is the player's own, even a name the game might have drawn
    $('#c-name').addEventListener('input', () => { autoName = ''; });
    // a name for a hero who would rather not choose; never the same one twice running
    $('#c-name-rand').addEventListener('click', e => {
      e.preventDefault();
      drawHeroName();
    });
    $('#c-back').addEventListener('click', () => K.showScreen('screen-title'));
    $('#c-begin').addEventListener('click', beginGame);
    for (const b of $$('#c-difficulty [data-diff]')) b.addEventListener('click', () => setDifficulty(b.dataset.diff));
    setDifficulty('normal');
  }

  return { faceOf, FIRST_HEROES, buildCreate, openCreation, quickStart, bindCreate, setDifficulty };
}
