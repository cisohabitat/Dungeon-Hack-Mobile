import { randomSeedWord } from './rng.js';
import { ROUTES, FEATS, TWISTS, heroName, PROLOGUE, BACKGROUNDS, JOURNAL, BOONS, XP_TABLE, MAX_LEVEL, CLASSES, STAT_NAMES, ITEMS, KEY_COLORS, MONSTERS, THEMES, TALENTS, SPELLS, PATHS, PATH_LEVEL, VOWS } from './data.js';
import { Assets } from './assets.js';
import { Dungeon } from './dungeon.js';
import { Renderer } from './renderer.js';
import { Sound } from './sound.js';
import { Music } from './music.js';
import { Game } from './game.js';
import { RELIC_POWERS, RELICS, PREFIX_NAME, PREFIX_DESC, RELIC_SETS, setOf } from './relics.js';
import { Daily } from './daily.js';
import { Progress } from './progress.js';
import { $, $$, escapeHtml, upFirst, diffOf, diffName } from './uikit.js';
import { renderBestiary, renderCodex, renderHall } from './hall.js';
import { drawShareCard } from './sharecard.js';

// DOM, touch controls, overlays and screens.

const UI = (() => {
  /** Buttons and keys held down, and when each was pressed. */
  const held = new Map();
  // A held button repeats only after this long, like a keyboard: an ordinary
  // tap lasts 100-200ms, and repeating sooner turned one tap into two turns.
  const HOLD_DELAY = 320;
  let overlay = null;
  /** @type {string[]} overlays the game asked for while a choice or a result was on screen */
  let waiting = [];
  /** @type {{cls: string, bg: string, stats: any, rolled: any, difficulty: string, vows: string[], mode: string, buy: Record<string, number>|null, buyTouched: boolean}} */
  let create = { cls: 'fighter', bg: 'oathbroken', stats: null, rolled: null, difficulty: 'normal', vows: [], mode: 'roll', buy: null, buyTouched: false };
  // Point buy: every score starts at 8 and 27 points raise them, dearer near
  // the top, to 17 at most (a background's bonus goes on after). About what
  // an average roll gives, but placed where the player wants it; 16 and 17
  // cost dearly, so a planned hero can match a lucky roll's best score.
  const BUY_COST = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9, 16: 12, 17: 15 }, BUY_POINTS = 27, BUY_TOP = 17;
  const buyLeft = b => BUY_POINTS - Object.values(b).reduce((n, v) => n + BUY_COST[v], 0);
  /** For a locked class's card: which of the open classes have yet to win. */
  function stillToWin(known) {
    const left = Object.keys(CLASSES).filter(k => !CLASSES[k].locked && !Progress.highest(k, known)).map(k => CLASSES[k].name);
    return left.length ? ` Still to win: ${left.join(', ')}.` : '';
  }
  /** A sensible start for a class: its key score 15, then hardiness, then its fighting score. */
  function buyStart(cls) {
    const key = CLASSES[cls].primary, fight = cls === 'thief' || cls === 'mage' || cls === 'ranger' ? 'dex' : 'str';
    const b = { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 8 };
    b[key] = 15; if (fight !== key) b[fight] = 13;
    return b;
  }
  let pendingCfg = null;
  let selectedItem = null, selectedSlot = null;
  let logDue = 0;              // when the next line held back for its moment is due
  let logCount = -1, hudSig = '', miniAt = 0, miniSig = '';
  /** What of the hound the status row shows, so the row redraws when it changes. */
  const houndSig = () => { const h = Game.companion(); return h ? `${h.hp}/${h.maxHp}/${h.mode}/${h.depth}/${h.fallen || 0}` : ''; };

  let finaleTimer = 0;
  function showScreen(id) {
    if (id !== 'screen-game') clearTimeout(finaleTimer);   // leaving the run: its victory screen goes with it
    $$('.screen').forEach(s => s.classList.toggle('active', s.id === id));
    // the raycaster draws into whichever canvas is on screen
    if (id === 'screen-title') { Renderer.init($('#title-art')); title.t0 = 0; title.last = 0; refreshTitle(); }
    else if (id === 'screen-game') { Renderer.init($('#view')); fitView(); }
    syncHistory();
  }

  // ---------- the phone's back gesture ----------
  // Back (Android's gesture, or the browser's button) closes what is open
  // rather than leaving the game: an overlay closes, and in the dungeon it
  // opens the Menu, pausing, instead of shutting the page mid-fight. Two
  // entries of the page's own history stand for this: 'game' while in the
  // dungeon, and 'overlay' above it while something is open. They are put
  // right a moment after each change, once any switching (one overlay
  // closing as the next opens) has settled.
  // Only entries pushed since the page loaded are ever taken back: a page
  // reloaded keeps its history state, and going back by that would have
  // left the site. A state left over from before a reload is cleared instead.
  let popsToSkip = 0, histQueued = false, pushed = 0;
  const histState = () => (history.state && history.state.dd) || null;
  function syncHistory() {
    if (histQueued || typeof history === 'undefined' || !history.pushState) return;
    histQueued = true;
    Promise.resolve().then(() => {
      histQueued = false;
      try {
        const inGame = $('#screen-game').classList.contains('active');
        if (inGame) {
          if (!histState()) { history.pushState({ dd: 'game' }, ''); pushed++; }
          if (overlay && histState() !== 'overlay') { history.pushState({ dd: 'overlay' }, ''); pushed++; }
          else if (!overlay && histState() === 'overlay') {
            if (pushed > 0) { popsToSkip++; pushed--; history.back(); } else history.replaceState({ dd: 'game' }, '');
          }
        } else if (histState()) {
          if (pushed > 0) { popsToSkip++; history.go(-pushed); pushed = 0; } else history.replaceState(null, '');
        }
      } catch (e) { /* a browser without history: back does what it always did */ }
    });
  }
  /**
   * The page is put away mid-fight (a call, a notification): the world stops
   * with it, but would start again the instant it came back, before the player
   * has found the buttons. Come back to the Menu instead.
   */
  function pauseIfThreatened() {
    if (overlay || !$('#screen-game').classList.contains('active') || Game.mood() === 'quiet') return;
    openOverlay('menu');
  }
  function onBack() {
    if (popsToSkip > 0) { popsToSkip--; syncHistory(); return; }
    if (pushed > 0) pushed--;
    if ($('#screen-game').classList.contains('active')) {
      // (a choice the game is waiting on stays open: closeOverlay knows which)
      if (overlay) closeOverlay(); else openOverlay('menu');
    }
    syncHistory();
  }

  function refreshTitle() {
    const s = Game.saveSummary();
    $('#btn-continue').disabled = !s;
    // a run waiting to be picked up is the likelier wish
    $('#btn-continue').classList.toggle('primary', !!s);
    $('#btn-new').classList.toggle('primary', !s);
    $('#save-summary').textContent = s
      ? `${s.name} the ${s.cls}, level ${s.level}, on floor ${s.depth}`
      : 'No saved game';
    refreshDaily();
    refreshNews();
  }
  // ---------- what's new ----------
  // A returning player hears once, on the title, what has changed since they
  // last played; it goes when dismissed or when a run starts. A new player,
  // with nothing to compare it with, is not told. Change `id` with the text.
  const NEWS = { id: '2026-09-27c', text: 'the hound now keeps up and finds its own way, sits when told to stay, shows on your map, barks, and stands beside you on the picture of a won run.' };
  const NEWS_SEEN = 'deepdelve.news';
  const returning = () => ['deepdelve.save', 'deepdelve.hall', 'deepdelve.bestiary', 'deepdelve.progress'].some(k => store(k));
  function refreshNews() {
    if (store(NEWS_SEEN) !== NEWS.id && !returning()) store(NEWS_SEEN, NEWS.id);
    $('#news-text').textContent = NEWS.text;
    $('#news').hidden = store(NEWS_SEEN) === NEWS.id;
  }
  function newsSeen() { store(NEWS_SEEN, NEWS.id); $('#news').hidden = true; }
  /** The Daily Delve button says how today stands: fresh, waiting below, or done. */
  function refreshDaily() {
    const key = Daily.today(), st = Daily.status(key), s = Game.saveSummary();
    // the day's own run, not a custom one that borrowed its seed
    const waiting = !!s && s.daily === key;
    const note = $('#daily-summary'), run = Daily.streak(key);
    $('#btn-daily').classList.toggle('done', st.state !== 'fresh' && !waiting);
    if (waiting) note.textContent = `Today's delve waits on floor ${s.depth}`;
    else if (st.state === 'done') note.textContent = `Today: ${Daily.outcome(st.done)} \u00b7 Share`;
    else if (st.state === 'started') note.textContent = 'Today: left unfinished';
    else note.textContent = run ? `One try today \u00b7 streak ${run}` : "Today's dungeon, one try";
  }
  /** Copy a line to the clipboard, the old way if the new one is refused. */
  async function copyText(text) {
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; } } catch (e) { /* try the old way */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (e) { return false; }
  }
  /**
   * Pass a line on: through the phone's own share sheet where there is one
   * (a message, a chat, a note), else onto the clipboard. Closing the sheet
   * without choosing is not a failure, and copies nothing behind the player's back.
   * @returns {Promise<'shared'|'closed'|'copied'|'failed'>}
   */
  async function shareText(text) {
    if (navigator.share) {
      try { await navigator.share({ text }); return 'shared'; } catch (e) { if (e && e.name === 'AbortError') return 'closed'; }
    }
    return (await copyText(text)) ? 'copied' : 'failed';
  }
  const SHARED = { shared: 'Shared', copied: 'Copied: paste it anywhere' };
  /** The title's Daily Delve button: start today's, go back to it, or share how it went. */
  function dailyTap() {
    const key = Daily.today(), st = Daily.status(key), s = Game.saveSummary();
    if (s && s.daily === key) { if (Game.load()) startPlaying(); return; }
    if (st.state === 'done') {
      const line = Daily.shareLine(key, st.done);
      shareText(line).then(how => { $('#daily-summary').textContent = SHARED[how] || line; });
      return;
    }
    // one try a day: a run begun and then given up is still the day's try
    if (st.state === 'started') { $('#daily-summary').textContent = 'One try a day. Back tomorrow'; return; }
    startNewGameFlow('daily');
  }
  /** Today's hero, the same for everyone, into the prologue. */
  function dailyStart() { showPrologue(Daily.heroFor(Daily.today())); }
  const DIFFICULTY = {
    easy: 'Easy: more to find, monsters never grow with you',
    normal: 'Normal: the intended delve',
    hard: 'Hard: sturdier monsters, thinner rests, a lich at full strength',
  };
  /** What a delve of this many floors holds, under the options. */
  function levelsNote() {
    const n = parseInt($('#c-levels').value, 10);
    $('#c-levels-note').textContent = n >= 12
      ? `The Long Delve: ${n} floors. From the seventh the dark bites harder and its creatures are sturdier, three champions hold it, and a third of the way down the stair divides. A win is a feat of its own.`
      : Dungeon.routeSpan(n) ? 'A third of the way down, the stair divides: the Crypts or the Warrens, your choice.'
      : 'A short delve: the stair runs straight down, with no road to choose.';
  }
  /** A run's difficulty; a save from before there was a choice is normal. */
  function setDifficulty(d) {
    create.difficulty = DIFFICULTY[d] ? d : 'normal';
    for (const b of $$('#c-difficulty [data-diff]')) { const on = b.dataset.diff === create.difficulty; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); }
    $('#c-diff-note').textContent = DIFFICULTY[create.difficulty];
  }

  // ---------- animated title scene ----------
  // A ghost camera drifts through a real generated dungeon behind the menu.
  const title = { level: null, lit: new Set(), cell: null, dir: 0, mode: 'step', t0: 0, dur: 0, next: null, embers: [], sprites: [], last: 0 };
  const TITLE_FX = { damageUntil: 0, healUntil: 0, swingUntil: 0, castUntil: 0, shakeUntil: 0, castColor: '#fff', texts: [] };
  const STEP_MS = 1150, TURN_MS = 800;

  function titlePassable(L, x, y) {
    if (x < 0 || y < 0 || x >= L.w || y >= L.h) return false;
    const t = L.tiles[y * L.w + x];
    return t === Dungeon.T.FLOOR || t === Dungeon.T.DOOR_OPEN;
  }
  function buildTitleScene() {
    const T = Dungeon.T;
    const seeds = ['hallsofdust', 'emberdeep', 'thornvault', 'greyhollow'];
    const seed = seeds[Math.floor(Math.random() * seeds.length)];
    const L = Dungeon.generate(seed, 2 + Math.floor(Math.random() * 3), { levels: 8, size: 'medium', monsters: 'normal', treasure: 'rich', lockedDoors: false, traps: false });
    // the camera is a ghost: every door stands open to it, and nothing is hidden
    for (let i = 0; i < L.tiles.length; i++) {
      if (L.tiles[i] === T.DOOR || L.tiles[i] === T.DOOR_LOCKED) L.tiles[i] = T.DOOR_OPEN;
      if (L.tiles[i] === T.SECRET) L.tiles[i] = T.WALL;
    }
    L.explored.fill(1);
    title.level = L;
    title.lit = new Set((L.lights || []).map(l => l.y * L.w + l.x));
    // open on the best shot in the level: a long corridor with torches down it
    let best = { x: L.start.x, y: L.start.y, dir: L.start.dir, score: -1 };
    for (let i = 0; i < L.tiles.length; i++) {
      if (L.tiles[i] !== T.FLOOR) continue;
      const x = i % L.w, y = (i / L.w) | 0;
      for (let k = 0; k < 4; k++) {
        const run = titleRun(L, x, y, k);
        if (run < 3) continue;
        const score = run + titleLitAhead(L, x, y, k, run) * 6;
        if (score > best.score) best = { x, y, dir: k, score };
      }
    }
    title.cell = { x: best.x, y: best.y };
    title.dir = best.dir;
    title.mode = 'step';
    title.t0 = 0; title.dur = STEP_MS;
    title.next = null;
    // still sprites: sleeping monsters and glinting loot
    title.sprites = [];
    for (const m of L.monsters) {
      const mb = MONSTERS[m.id];
      const base = Assets.sprites[mb.sprite];
      title.sprites.push({ x: m.x + 0.5, y: m.y + 0.5, img: (m.elite && base.elite && base.elite[m.elite]) ? base.elite[m.elite] : base, scale: mb.scale, yOff: mb.fly || 0, _fly: !!mb.fly, _uid: m.uid });
    }
    for (const k in L.items) {
      const list = L.items[k];
      if (!list.length) continue;
      const [x, y] = k.split(',').map(Number);
      const it = list[list.length - 1];
      const base = ITEMS[it.t];
      const sp = it.t === 'key' ? 'key_' + it.color : (base && base.sprite) || 'gold';
      title.sprites.push({ x: x + 0.5, y: y + 0.5, img: Assets.sprites[sp] || Assets.sprites.gold, scale: it.t === 'artifact' ? 0.5 : 0.3 });
    }
    title.embers = [];
    for (let i = 0; i < 26; i++) {
      title.embers.push({ x: Math.random() * 320, y: Math.random() * 200, vy: -(4 + Math.random() * 10), vx: (Math.random() - 0.5) * 6, r: Math.random() < 0.25 ? 2 : 1, life: Math.random() });
    }
  }
  // How many open tiles stretch away from a cell in one direction, and how many
  // of them are torchlit. The ghost is drawn toward the light.
  function titleRun(L, x, y, dir, cap) {
    const [dx, dy] = Dungeon.DIRS[dir];
    let n = 0;
    while (n < (cap || 12) && titlePassable(L, x + dx * (n + 1), y + dy * (n + 1))) n++;
    return n;
  }
  function titleLitAhead(L, x, y, dir, run) {
    const [dx, dy] = Dungeon.DIRS[dir];
    let lit = 0;
    for (let i = 1; i <= run; i++) if (title.lit.has((y + dy * i) * L.w + (x + dx * i))) lit++;
    return lit;
  }
  // Pick where the ghost goes next. It favours the longest view so the menu
  // always sits over receding corridor rather than a wall pressed to the lens.
  function titleChooseNext() {
    const L = title.level, c = title.cell;
    const back = (title.dir + 2) % 4;
    const scored = [];
    for (let k = 0; k < 4; k++) {
      const run = titleRun(L, c.x, c.y, k);
      if (run < 2) continue;                  // never turn toward a near wall
      let weight = run * run + titleLitAhead(L, c.x, c.y, k, run) * 14;
      if (k === title.dir) weight *= 3;       // keep walking where we can
      if (k === back) weight *= 0.05;         // doubling back is a last resort
      scored.push({ k, weight });
    }
    if (!scored.length) return back;
    const total = scored.reduce((a, s) => a + s.weight, 0);
    let r = Math.random() * total;
    for (const s of scored) { r -= s.weight; if (r <= 0) return s.k; }
    return scored[0].k;
  }
  function updateTitleCamera(now) {
    if (!title.t0) title.t0 = now;
    let t = (now - title.t0) / title.dur;
    let guard = 0;
    while (t >= 1 && guard++ < 16) {
      const elapsed = title.dur;              // the phase that just finished
      const wasStep = title.mode === 'step';
      if (wasStep) {
        const d = Dungeon.DIRS[title.dir];
        title.cell = { x: title.cell.x + d[0], y: title.cell.y + d[1] };
      } else {
        title.dir = title.next;
      }
      const want = titleChooseNext();
      if (want !== title.dir) {
        title.mode = 'turn'; title.next = want; title.dur = TURN_MS;
      } else {
        title.mode = 'step'; title.dur = STEP_MS;
      }
      title.t0 += elapsed;
      t = (now - title.t0) / title.dur;
    }
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    const ang = d => d * Math.PI / 2 - Math.PI / 2;
    if (title.mode === 'step') {
      const d = Dungeon.DIRS[title.dir];
      const e = t * t * (3 - 2 * t); // ease in and out of each stride
      return { x: title.cell.x + 0.5 + d[0] * e, y: title.cell.y + 0.5 + d[1] * e, angle: ang(title.dir) };
    }
    let from = ang(title.dir), to = ang(title.next);
    while (to - from > Math.PI) to -= Math.PI * 2;
    while (to - from < -Math.PI) to += Math.PI * 2;
    const e = t * t * (3 - 2 * t);
    return { x: title.cell.x + 0.5, y: title.cell.y + 0.5, angle: from + (to - from) * e };
  }
  function renderTitle(now) {
    if (!title.level) buildTitleScene();
    const cam = updateTitleCamera(now);
    for (const s of title.sprites) if (s._fly) s.yOff = 0.3 + Math.sin(now / 260 + s._uid) * 0.05;
    // anything right under the lens fills the whole frame, so keep it back
    const visible = title.sprites.filter(s => Math.hypot(s.x - cam.x, s.y - cam.y) > 1.8);
    Renderer.render(title.level, cam, visible, TITLE_FX, now);
    // embers and a slow torch flicker over the top
    const c = $('#title-art');
    const ctx = c.getContext('2d');
    const dt = title.last ? Math.min(0.05, (now - title.last) / 1000) : 0;
    title.last = now;
    for (const e of title.embers) {
      e.x += e.vx * dt; e.y += e.vy * dt;
      e.life += dt * 0.35;
      if (e.y < -4 || e.life > 1) { e.x = Math.random() * 320; e.y = 204; e.life = 0; e.vy = -(4 + Math.random() * 10); }
      const a = Math.sin(Math.min(1, e.life) * Math.PI) * 0.75;
      ctx.fillStyle = `rgba(255,${150 + Math.floor(e.life * 80)},60,${a.toFixed(2)})`;
      ctx.fillRect(e.x | 0, e.y | 0, e.r, e.r);
    }
    const flick = 0.06 + Math.sin(now / 420) * 0.02 + Math.sin(now / 130) * 0.012;
    ctx.fillStyle = `rgba(255,170,70,${Math.max(0, flick).toFixed(3)})`;
    ctx.fillRect(0, 0, 320, 200);
  }

  // ---------- character creation ----------
  function buildCreate() {
    const grid = $('#c-classes');
    grid.innerHTML = '';
    const known = Progress.load();
    // a class still to be earned cannot stay chosen
    if (!Progress.classOpen(create.cls, known)) create.cls = 'fighter';
    for (const id in CLASSES) {
      const c = CLASSES[id], open = Progress.classOpen(id, known);
      const b = document.createElement('button');
      b.className = 'class-card' + (id === create.cls ? ' sel' : '') + (open ? '' : ' locked');
      b.type = 'button';
      b.dataset.cls = id;
      b.setAttribute('aria-pressed', String(id === create.cls));
      // a Hard win earns the class's title, shown on its card from then on
      const titled = open && Progress.hasWon(id, 'hard', known) ? `<em class="class-title">${escapeHtml(c.title)}</em>` : '';
      b.innerHTML = open ? `<b>${c.name}</b>${titled}<small>${c.desc}</small><em class="key">Key stat: ${STAT_NAMES[c.primary]}</em>`
        : `<b>${c.name}</b><small>${c.desc}</small><em class="key lock">Locked. ${escapeHtml(c.locked || '')}${stillToWin(known)}</em>`;
      b.disabled = !open;
      if (open) b.addEventListener('click', () => { create.cls = id; fitStats(); if (create.mode === 'buy' && !create.buyTouched) create.buy = buyStart(id); buildCreate(); });
      grid.appendChild(b);
    }
    const bgGrid = $('#c-backgrounds');
    bgGrid.innerHTML = '';
    // a past still to be earned cannot stay chosen
    const progress = Progress.load();
    // vows, once a hero has won on Hard: each one a harder run and a trophy of its own
    const vowsOpen = Progress.vowsOpen(progress);
    /** @type {HTMLElement} */ ($('#c-vows')).hidden = !vowsOpen;
    if (!vowsOpen) create.vows = [];
    $('#c-vow-list').innerHTML = Object.keys(VOWS).map(id => `<label class="check"><input type="checkbox" data-vow="${id}"${create.vows.includes(id) ? ' checked' : ''}> <span><b>${escapeHtml(VOWS[id].name)}</b>: ${escapeHtml(VOWS[id].desc)}</span></label>`).join('');
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
      if (open) el.addEventListener('click', () => { const was = create.bg; create.bg = id; if (id !== was && $('#c-name').value === autoName) drawHeroName(); buildCreate(); });
      bgGrid.appendChild(el);
    }
    $('#c-bg-perk').textContent = BACKGROUNDS[create.bg].perk;
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
    showScreen('screen-create');
  }
  /** A random hero with sensible numbers, straight to the prologue. */
  function quickStart() {
    const progress = Progress.load(), classes = Object.keys(CLASSES).filter(k => Progress.classOpen(k, progress)), pasts = Object.keys(BACKGROUNDS).filter(id => Progress.bgOpen(id, progress));
    // someone's very first run gets a class that forgives mistakes
    const firstRun = !Game.hall().length;
    const pool = firstRun ? ['fighter', 'cleric'] : classes;
    create.cls = pool[Math.floor(Math.random() * pool.length)];
    create.bg = pasts[Math.floor(Math.random() * pasts.length)];
    // "straight in" should not mean a hero who cannot hit a rat: roll again
    // until the key stat and the fighting stat both pull their weight
    for (let i = 0; i < 40; i++) {
      create.rolled = Game.rollStats();
      fitStats();
      const s = create.stats, fight = create.cls === 'thief' || create.cls === 'ranger' ? s.dex : s.str;
      if (s[CLASSES[create.cls].primary] >= 14 && fight >= 12 && s.con >= 10) break;
    }
    const cfg = { name: heroName(create.bg), cls: create.cls, bg: create.bg, stats: create.stats, seed: randomSeedWord(),
      opts: { levels: 8, size: 'medium', monsters: 'normal', treasure: 'normal', lockedDoors: true, traps: true, permadeath: true, difficulty: /** @type {'normal'} */ ('normal') } };
    // "straight in" means it for anyone who has been down before; a first
    // hero still hears why the Heart matters
    if (firstRun) showPrologue(cfg);
    else { pendingCfg = cfg; Game.newGame(pendingCfg); pendingCfg = null; Game.save(true); startPlaying(); }
  }
  /** @type {'new'|'quick'|'daily'} what the player asked for, waiting on the replace question */
  let pendingKind = 'new';
  function startPending() { if (pendingKind === 'quick') quickStart(); else if (pendingKind === 'daily') dailyStart(); else openCreation(); }
  /** A run in progress is a real investment, so never discard one silently. @param {'new'|'quick'|'daily'} [kind] */
  function startNewGameFlow(kind = 'new') {
    pendingKind = kind;
    const saved = Game.saveSummary();
    if (!saved) { startPending(); return; }
    $('#confirm-who').textContent =
      `${saved.name} the ${saved.cls}, level ${saved.level}, waiting on floor ${saved.depth}.`;
    showScreen('screen-confirm');
  }
  function showPrologue(cfg) {
    pendingCfg = cfg;
    const b = BACKGROUNDS[cfg.bg];
    // the valley's story in full the first time; after that it waits folded
    // away, so the hero's own paragraph and the stair fit on the screen
    const world = PROLOGUE.map(t => `<p>${escapeHtml(t)}</p>`).join('');
    $('#pro-world').innerHTML = store(STORY_READ) === '1' ? `<details class="pro-again"><summary>The story so far</summary>${world}</details>` : world;
    $('#pro-who').textContent = b.name;
    $('#pro-story').textContent = b.story;
    $('#pro-motive').textContent = b.motive;
    // how this run is kept, said plainly before it starts
    const o = cfg.opts, d = diffOf(o);
    $('#pro-rules').textContent = o.daily
      ? `The Daily Delve for ${Daily.longDate(o.daily)}: the same dungeon and the same hero for everyone today. One life and one try; if you put the game away, Continue brings you back.`
      : (o.permadeath
        ? 'One life: permadeath is on. The run is saved whenever you put the game away, so you can come back to it, but if you die the save is gone.'
        : 'Permadeath is off: save from the menu, and load it again if you die.') + (d !== 'normal' ? ` Difficulty: ${diffName(d)}.` : '');
    showScreen('screen-prologue');
  }
  function beginGame() {
    const cfg = {
      name: $('#c-name').value,
      cls: create.cls,
      bg: create.bg,
      stats: create.stats,
      // a custom seed cannot borrow a Daily Delve's, or the day's one try could be practised first
      seed: ((($('#c-seed').value || '').trim() || randomSeedWord())).replace(/^daily-/i, 'my-daily-'),
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
      },
    };
    showPrologue(cfg);
  }
  const STORY_READ = 'deepdelve.storyRead';
  function commitGame() {
    store(STORY_READ, '1');
    if (!pendingCfg) return;
    // the day's one try begins here, at the first stair
    if (pendingCfg.opts.daily) Daily.start(pendingCfg.opts.daily);
    Game.newGame(pendingCfg);
    pendingCfg = null;
    Game.save(true);
    startPlaying();
  }
  function startPlaying() {
    newsSeen();
    logCount = -1; hudSig = '';
    // a tip, and a lesson half given, belong to the run they were given in
    resetTips();
    clearOverlays();
    showScreen('screen-game');
    // no spells, no Spells button
    const sb = /** @type {HTMLElement|null} */ (document.querySelector('[data-open="spells"]'));
    if (sb) sb.style.display = CLASSES[Game.player().cls].spells ? '' : 'none';
    refreshLog(); refreshHud();
    // a choice left waiting when the game was put away is waiting still
    if (Game.pendingBoons()) openOverlay('boons');
  }

  // ---------- first-moment tips ----------
  // One short tip the first time each thing happens, on this device: shown
  // over the view where the eye already is, never catching a tap, and gone
  // after a few seconds. The menu turns them off, or back on from the start.
  const TIPS_SEEN = 'deepdelve.tipsSeen', TIPS_OFF = 'deepdelve.tipsOff';
  const TIPS = {
    controls: 'Move with the arrows, or swipe the view. <b>⚔ Attack</b> strikes what is in front of you; <b>✋ Use</b> does whatever it says.',
    // the first fight is walked through a step at a time: face it, strike it,
    // step back from its blow (with time slowed while that is learnt)
    face: 'Something is coming, and not from in front. <b>Turn to face it</b>: the red chevron at the edge of the view points the way.',
    monster: 'Something is coming. When it is in front of you, tap <b>⚔ Attack</b> to strike it.',
    dodge: '<b>A warning mark!</b> Its blow is coming: <b>step back ▼</b> now and it hits empty air.',
    dodgeside: '<b>A warning mark!</b> Its blow is coming, and there is a wall behind you: <b>step aside</b> (◀ or ▶) now and it hits empty air.',
    dodgelunge: '<b>A warning mark!</b> Its blow is coming, and this one lunges after a step back: <b>step aside</b> (◀ or ▶) now and it hits empty air.',
    dodgelungeflank: '<b>A warning mark!</b> Its blow is coming from your side, and this one lunges after a step away: step <b>forward or back</b> (▲ or ▼), out of its line, and it hits empty air.',
    lunged: 'It <b>lunged after you</b>: a rat, a ghoul or a wraith follows a step straight away from it. Step <b>out of its line</b> instead, to the side of it, and it hits empty air.',
    dodged: 'It hit empty air. <b>Step in</b> and strike before it draws back again. Do this every time a mark appears.',
    late: 'Too slow: that one landed. Step back <b>the moment</b> a warning mark appears, and the blow misses.',
    trick: 'A <b>violet spiked mark</b> means a trick <b>armour will not turn</b>: get out of the way. The log says what is coming, and the <b>Bestiary</b> (Journal) records each trick.',
    gaze: 'Its eyes blaze: <b>turn away!</b> A basilisk\'s gaze turns to stone only whoever is looking at it.',
    rust: 'It means to bite your armour. <b>Step back!</b> A rustmaw\'s bite rusts metal for good, though a trader\'s forge can mend it.',
    claw: 'A numbing claw reaches for you. <b>Step back</b> out of reach, or <b>strike</b>: a blow that lands knocks the claw aside.',
    crush: 'It heaves up a crushing blow, too heavy for armour. <b>Step back</b> and it smashes the floor, wide open.',
    webspit: 'It rears back to spit a web. <b>Step out of its line</b>, to one side.',
    charge: 'It lowers its head to charge down the line. <b>Step aside</b>, or pull a <b>door</b> shut across its path: it slams into the door, wide open.',
    horn: 'He means to sound a horn and call his kin. <b>Strike him</b> before he does: any wound cuts the call short.',
    blink: 'It has stepped back into the world <b>at your back</b>. <b>Turn round</b> to face it before it bites, and it is caught open.',
    quills: 'Its quills are up. <b>Hold your blow</b> until they sink: every blow struck into them bites you back. An arrow or a spell from further off is safe.',
    breath: 'Fire kindles in its throat. <b>Step in close</b>, under its jaws, or <b>out of its line</b>. Stepping back keeps you in the fire.',
    drink: 'Her cold hand reaches in to drink your life. <b>Step back!</b> What she takes from your maximum hit points is gone for good.',
    web: 'You are caught in a web. <b>Fire burns it away</b>: cast a fire spell to be free at once, or push against it to tear free.',
    webtear: 'You are caught in a web. <b>Push against it</b>: tap any arrow, again and again, to tear free.',
    opening: '<b>An opening!</b> You answered its trick: your next blow at it cannot miss and lands hard. Strike now.',
    take: 'Something lies here. Tap <b>✋ Take</b> to pick it up.',
    stairs: 'Stairs down. Tap <b>Descend</b> when you are ready. The Heart waits at the bottom.',
    examine: 'Something to deal with. Tap <b>Examine</b>: every choice shows its odds before you commit.',
    trade: 'A trader. Tap <b>Trade</b> to buy, sell, and use the forge: it sharpens a weapon or strengthens armour, and mends rust.',
    unknown: 'A <b>?</b> in your pack means you do not know how good that gear is. <b>Study</b> it, or have a trader appraise it: cursed gear will not come off once worn.',
    quickscroll: 'A scroll worth reading <b>now</b> waits at the left end of the log, under the view: <b>one tap</b> reads it.',
    hurt: 'You are badly hurt. Tap the <b>bottle</b> beside your life bar to drink a healing potion, or <b>Rest</b> when nothing is near.',
    shade: 'A <b>shade</b>: one of your own heroes, risen where they fell, and it fights as they did. Lay it to rest and what they wore is yours.',
    dice: 'Every blow is a roll of the dice. To see the numbers behind each one in the log, turn on <b>Combat rolls</b> in the <b>Menu</b>.',
  };
  /** The tips that each tell the answer to one trick. */
  const ANSWER_TIPS = ['gaze', 'rust', 'claw', 'crush', 'webspit', 'charge', 'horn', 'drink', 'blink', 'quills', 'breath', 'web', 'webtear', 'opening'];
  let tipFrom = '';                // where the hero stood and faced when the tip came up
  let tipSwing = 0;                // the hero's next swing when the tip came up: it moves when they attack
  let tipHurt = 0;                 // when the hero was last hurt, as the tip came up
  let tipLunges = 0;               // how many lunges had followed the hero, as the tip came up
  let dodgeSettled = false;        // the first blow's outcome is known
  // The first fight on this device is coached. It starts with the first foe's
  // tip and ends once a warning mark has been stepped back from, or not.
  let coaching = false, coachNext = '';
  /** Tips that stay up until what they ask for is done, not for a set time. */
  const HOLD_TIPS = ['face', 'monster', 'dodge', 'dodgeside', 'dodgelunge', 'dodgelungeflank'];
  /** The first fight's steps and their verdicts: no other tip cuts in on them. */
  const COACH_TIPS = [...HOLD_TIPS, 'dodged', 'late', 'lunged'];
  const isDodge = id => id === 'dodge' || id === 'dodgeside' || id === 'dodgelunge' || id === 'dodgelungeflank';
  const HOLD_MAX = 15000;
  let tipsSeen = null, tipAt = 0, tipUntil = 0, tipCheckAt = 0;
  const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* private browsing */ } return null; };
  function tipsOn() { return store(TIPS_OFF) !== '1'; }
  // Movement under the left thumb and blows under the right suits most; a
  // left-handed player can swap the halves (and, sideways, the whole panel)
  const HAND = 'deepdelve.hand';
  const lefty = () => store(HAND) === 'left';
  const setHand = () => document.body.classList.toggle('lefty', lefty());
  // Calm view: no shake, no drifting dust, torches that burn steady. Chosen
  // in the menu; until it is, it follows the phone's own ask for less motion.
  const CALM = 'deepdelve.calm';
  function calmOn() {
    const v = store(CALM);
    if (v === '1' || v === '0') return v === '1';
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }
  /** @param {string} id @param {boolean} [urgent]  a warning that cannot wait: it replaces a tip already showing */
  function showTip(id, urgent) {
    if (!tipsOn()) return false;
    if (!tipsSeen) { try { tipsSeen = JSON.parse(store(TIPS_SEEN) || '[]'); } catch (e) { tipsSeen = []; } }
    if (tipsSeen.includes(id)) return false;
    const el = $('#tip');
    if (!el || (!urgent && performance.now() < tipUntil)) return false;      // one at a time
    tipsSeen.push(id);
    store(TIPS_SEEN, JSON.stringify(tipsSeen));
    el.innerHTML = TIPS[id];
    el.dataset.tip = id;
    el.classList.add('show');
    el.setAttribute('aria-label', 'Tip; tap to dismiss');
    tipAt = performance.now();
    { const p0 = Game.player(); tipFrom = `${p0.x},${p0.y},${p0.dir}`; tipSwing = p0.nextAttack; tipHurt = p0.lastHurt || 0; tipLunges = Game.state().lunges || 0; dodgeSettled = false; }
    // in a fight a tip keeps out of the way sooner
    const L = Game.level(), p = Game.player();
    const fighting = L.monsters.some(m => m.awake && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) <= 3);
    tipUntil = tipAt + (fighting ? 4000 : 7000);
    return true;
  }
  function resetTips() {
    const el = $('#tip');
    if (el) el.classList.remove('show');
    tipUntil = 0; coaching = false; coachNext = ''; tipFrom = ''; tipSwing = 0;
  }
  function markSeen(id) {
    if (seenTip(id)) return;
    tipsSeen.push(id);
    store(TIPS_SEEN, JSON.stringify(tipsSeen));
  }
  /** Whether the hero could step that way (0 ahead, 1 right, 2 behind, 3 left): open floor, nothing standing on it. */
  function canStep(turn) {
    const p = Game.player(), L = Game.level(), T = Dungeon.T, [dx, dy] = Dungeon.DIRS[(p.dir + turn) % 4];
    const x = p.x + dx, y = p.y + dy;
    if (x < 0 || y < 0 || x >= L.w || y >= L.h) return false;
    const t = L.tiles[y * L.w + x];
    return (t === T.FLOOR || t === T.DOOR_OPEN) && !L.monsters.some(m => m.x === x && m.y === y);
  }
  function seenTip(id) {
    if (!tipsSeen) { try { tipsSeen = JSON.parse(store(TIPS_SEEN) || '[]'); } catch (e) { tipsSeen = []; } }
    return tipsSeen.includes(id);
  }
  /** The first foe awake and close, or null. */
  function firstFoe() {
    const p = Game.player(), L = Game.level();
    let best = null, bd = 4;
    for (const m of L.monsters) {
      const dd = Math.abs(m.x - p.x) + Math.abs(m.y - p.y);
      if (m.awake && dd < bd) { best = m; bd = dd; }
    }
    return best;
  }
  /** Whether a monster is ahead of the hero, in the view: turning cannot do better for one on a diagonal. */
  function inFront(m) {
    const p = Game.player(), [ax, ay] = Dungeon.DIRS[p.dir], [bx, by] = Dungeon.DIRS[(p.dir + 1) % 4];
    const dx = m.x - p.x, dy = m.y - p.y, ahead = dx * ax + dy * ay;
    return ahead > 0 && Math.abs(dx * bx + dy * by) <= ahead;
  }
  /** A plain blow (not a trick) being drawn back right beside the hero. */
  const blowComing = () => {
    const p = Game.player();
    return Game.level().monsters.some(m => m.windup && !m.windup.move && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) === 1);
  };
  // a blow still to come down, even at a step's remove: a lunger follows, so
  // the lesson waits for the blow itself before it says how the step went
  const blowPending = () => {
    const p = Game.player();
    return Game.level().monsters.some(m => m.windup && !m.windup.move && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) <= 2);
  };
  // The first time each trick comes, time slows while its answer is read,
  // as it does for the first plain blow: the tip names the trick's own move.
  const TRICK_TIPS = { gaze: 'gaze', rust: 'rust', claw: 'paralyse', crush: 'crush', webspit: 'web', charge: 'charge', horn: 'rally', drink: 'drink', blink: 'blink', quills: 'bristle', breath: 'breath' };
  /** How fast the dungeon runs: slowed while the first warning mark, or a trick's first coming, is being answered. */
  function timeScale() {
    const el = $('#tip');
    if (!el || !el.classList.contains('show') || !Game.state() || Game.state().status !== 'playing') return 1;
    const tip = el.dataset.tip || '';
    if (coaching && isDodge(tip) && !dodgeSettled && blowComing()) return 0.3;
    const mv = TRICK_TIPS[tip];
    if (mv) {
      const p = Game.player();
      if (Game.level().monsters.some(m => m.windup && m.windup.move === mv && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) <= 6)) return 0.3;
    }
    return 1;
  }
  function checkTips() {
    checkTipsNow();
    // what a tip covers of the view, in the picture's own rows, so the
    // renderer keeps bars and warning marks out from under it
    const el = $('#tip'), view = $('#view'), chips = $('#hud-status');
    let rows = 0;
    const v = view ? view.getBoundingClientRect() : null;
    if (el && v && v.height > 0 && el.classList.contains('show')) rows = (el.getBoundingClientRect().bottom - v.top + 3) / v.height * Renderer.H;
    // the status chips along the top of the view hide a mark as surely as a tip does
    if (chips && v && v.height > 0 && chips.children.length) {
      const c = chips.getBoundingClientRect();
      if (c.bottom > v.top && c.top < v.top + v.height * 0.5) rows = Math.max(rows, (c.bottom - v.top + 2) / v.height * Renderer.H);
    }
    Renderer.keepTopClear(rows);
  }
  function checkTipsNow() {
    const now = performance.now();
    const el = $('#tip');
    // what a tip asks for, while it is still to be done
    const G0 = Game.state();
    const wants = el && G0 && G0.status === 'playing' ? {
      face: () => { const m = firstFoe(); return !!m && !inFront(m); },
      monster: () => Game.player().nextAttack === tipSwing && !!firstFoe(),
      dodge: blowPending,
      dodgeside: blowPending,
      dodgelunge: blowPending,
      dodgelungeflank: blowPending,
    }[el.dataset.tip || ''] : null;
    // How the step back went is settled the moment that first blow is done
    // with: stung by it, or moved out from under it. A foe killed, fled or
    // turned by armour mid-swing teaches neither. (Waiting until the tip goes
    // would let the next blow, a second later, answer for the first.)
    if (el && el.classList.contains('show') && isDodge(el.dataset.tip || '') && coaching && !dodgeSettled && wants && !wants()) {
      const p2 = Game.player();
      // a lunge that followed the step is no dodge, even when its roll missed
      coachNext = (Game.state().lunges || 0) > tipLunges ? 'lunged' : (p2.lastHurt || 0) > tipHurt ? 'late' : `${p2.x},${p2.y}` !== tipFrom.split(',').slice(0, 2).join(',') ? 'dodged' : '';
      if (!coachNext) coaching = false;
      dodgeSettled = true;
    }
    // a coached step done goes at once (once read), and the next can come
    // (a warning over a foe that has just died goes at once: there is nothing left to read it about)
    if (el && el.classList.contains('show') && wants && (!wants() || (isDodge(el.dataset.tip || '') && dodgeSettled)) && (now - tipAt > 900 || (isDodge(el.dataset.tip || '') && !firstFoe()))) {
      el.classList.remove('show'); tipUntil = now;
    }
    // (a step done is seen to first: the timer below must not take the tip
    // before the lesson has said how it went)
    const held = wants && HOLD_TIPS.includes(el.dataset.tip || '') && now - tipAt < HOLD_MAX && wants() && !(isDodge(el.dataset.tip || '') && dodgeSettled);
    if (el && el.classList.contains('show') && now > tipUntil && !held) el.classList.remove('show');
    // a tip about the thing in front of you goes when that thing does
    const USE_TIPS = { take: 'Take', stairs: 'Descend', examine: 'Examine', trade: 'Trade' };
    if (el && el.classList.contains('show') && USE_TIPS[el.dataset.tip || ''] && Game.state() && Game.useLabel() !== USE_TIPS[el.dataset.tip || '']) { el.classList.remove('show'); tipUntil = now; }
    // a warning goes when what it warned of does: a wind-up come down, an
    // opening taken or gone. It stays long enough to be read first.
    if (el && el.classList.contains('show') && G0 && G0.status === 'playing') {
      const p0 = Game.player(), L0 = Game.level();
      const near = mv => L0.monsters.some(m => m.windup && m.windup.move && (!mv || m.windup.move === mv) && Math.abs(m.x - p0.x) + Math.abs(m.y - p0.y) <= 6);
      const still = { gaze: () => near('gaze'), rust: () => near('rust'), claw: () => near('paralyse'), crush: () => near('crush'), webspit: () => near('web'), charge: () => near('charge'), horn: () => near('rally'), drink: () => near('drink'), blink: () => near('blink'), quills: () => near('bristle'), breath: () => near('breath'), web: () => (p0.webbed || 0) > G0.t, webtear: () => (p0.webbed || 0) > G0.t, quickscroll: () => !/** @type {HTMLButtonElement} */ ($('#quick-scroll')).hidden, trick: () => near(''), opening: () => !!(p0.opening && p0.opening.until > G0.t) }[el.dataset.tip || ''];
      const read = el.dataset.tip === 'trick' ? 2500 : 1200;
      if (still && !still() && now - tipAt > read) { el.classList.remove('show'); tipUntil = now; }
    }
    // a tip never outlives the run: not over the fall, nor over the Heart's light
    if (el && Game.state() && Game.state().status !== 'playing') { el.classList.remove('show'); tipUntil = now; coaching = false; coachNext = ''; }
    // the controls tip has done its work once the hero has moved or turned
    if (el && el.classList.contains('show') && el.dataset.tip === 'controls' && G0 && now - tipAt > 1500) {
      const p2 = Game.player();
      if (`${p2.x},${p2.y},${p2.dir}` !== tipFrom) { el.classList.remove('show'); tipUntil = now; }
    }
    if (now < tipCheckAt || overlay || !Game.state() || Game.state().status !== 'playing') return;
    tipCheckAt = now + 250;
    const p = Game.player(), L = Game.level();
    if (showTip('controls')) return;
    // the first time each new trick comes, say how to answer it: these cannot wait
    const readying = mv => L.monsters.some(m => m.windup && m.windup.move === mv && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) <= 6);
    if (readying('gaze') && showTip('gaze', true)) return;
    if (readying('rust') && showTip('rust', true)) return;
    if (readying('paralyse') && showTip('claw', true)) return;
    if (readying('crush') && showTip('crush', true)) return;
    if (readying('web') && showTip('webspit', true)) return;
    if (readying('charge') && showTip('charge', true)) return;
    if (readying('rally') && showTip('horn', true)) return;
    if (readying('drink') && showTip('drink', true)) return;
    if (readying('blink') && showTip('blink', true)) return;
    if (readying('bristle') && showTip('quills', true)) return;
    if (readying('breath') && showTip('breath', true)) return;
    // only a hero with fire to hand is told to burn a web
    if ((p.webbed || 0) > Game.state().t && showTip(Game.knownSpells().some(sp => sp.fire && Game.spellAvailable(sp)) ? 'web' : 'webtear', true)) return;
    if (p.opening && p.opening.until > Game.state().t && showTip('opening', true)) return;
    // the general word on tricks, the first foe's lesson and the scroll
    // button's tip all wait while a trick's own answer is being read:
    // replacing it a quarter second later would teach nothing at all
    const answering = $('#tip') && $('#tip').classList.contains('show') && ANSWER_TIPS.includes($('#tip').dataset.tip || '');
    // nor do they cut into a coached step of the first fight
    const coachUp = !!$('#tip') && $('#tip').classList.contains('show') && COACH_TIPS.includes($('#tip').dataset.tip || '');
    // the first time a scroll is worth reading, say where its button is
    if (!answering && !coachUp && !/** @type {HTMLButtonElement} */ ($('#quick-scroll')).hidden && showTip('quickscroll', true)) return;
    if (!answering && !coachUp && L.monsters.some(m => ((m.windup && m.windup.move) || m.collapsed) && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) <= 5) && showTip('trick', true)) return;
    // the first shade met: who it is, and what laying it to rest is worth
    if (!answering && !coachUp && L.monsters.some(m => m.shade && m.awake && m.spoke && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) <= 6) && showTip('shade', true)) return;
    const close = L.monsters.some(m => m.awake && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) <= 3);
    // the first foe is taught at once, over the controls tip if it is still up:
    // a first goblin used to die before its lesson got a turn. It is walked
    // through: turn to it if it is not ahead, strike it, then step back from
    // its first blow, and say how that went.
    if (close && !answering && !seenTip('monster')) {
      const m = firstFoe();
      // the chevron the tip points to shows only within two squares
      // once begun, the step-back lesson is owed until it is given: a first
      // rat killed before it ever swung leaves it for the next blow to come
      if (m && !inFront(m) && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) <= 2 && showTip('face', true)) { markSeen('lesson:dodge'); return; }
      if (m && inFront(m) && showTip('monster', true)) { markSeen('lesson:dodge'); return; }
    }
    if (!answering) {
      if (coachNext) { const next = coachNext; coachNext = ''; coaching = false; if (showTip(next, true)) return; }
      else if (seenTip('lesson:dodge') && !seenTip('dodge') && !seenTip('dodgeside') && blowComing()) {
        // a wall behind, or a rat that pounces after a step back: say to step
        // aside, if there is room to either side
        const lunger = Game.level().monsters.find(m => m.windup && !m.windup.move && Game.mstat(m).lunge && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) === 1);
        const aside = canStep(1) || canStep(3);
        // out of a lunger's line is sideways to it: a strafe if it is ahead, a step forward or back if it is at your side
        const [fx, fy] = Dungeon.DIRS[p.dir];
        const flank = !!lunger && (lunger.x - p.x) * fx + (lunger.y - p.y) * fy === 0;
        const id = lunger && flank && (canStep(0) || canStep(2)) ? 'dodgelungeflank' : lunger && !flank && aside ? 'dodgelunge' : !canStep(2) && aside ? 'dodgeside' : 'dodge';
        if (showTip(id, true)) {
          coaching = true;
          // a fast foe's first blow can come before the strike was taught:
          // the lesson goes on from here rather than back to it
          markSeen('dodge'); markSeen('dodgeside'); markSeen('dodgelunge'); markSeen('dodgelungeflank'); markSeen('monster'); markSeen('face');
          return;
        }
      }
    }
    // the rest can wait for a quiet moment: a tip about your pack, mid-fight,
    // covers the view just when it matters most. Quiet means nothing awake in
    // throwing distance, no lich about, and no blow taken for five seconds
    const G = Game.state();
    if (close || Game.bossAwake() || G.t - (p.lastHurt || -1e9) < 5000 || L.monsters.some(m => m.awake && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) <= 6)) return;
    const label = Game.useLabel();
    const byLabel = { Take: 'take', Descend: 'stairs', Examine: 'examine', Trade: 'trade' };
    if (byLabel[label] && showTip(byLabel[label])) return;
    if ([...p.inv, ...Object.values(p.eq)].some(it => Game.qualityHidden(it)) && showTip('unknown')) return;
    if (p.hp < p.maxHp * 0.4 && showTip('hurt')) return;
    // the rolls start hidden: once a few fights have been won, say they can be had
    if (!Game.rollsShown() && p.kills >= 3 && showTip('dice')) return;
  }

  // ---------- HUD ----------
  // What lies under the hero, at the foot of the view: standing on a square
  // hides it, and a dropped handful was nowhere to be seen until you stepped off.
  let feetSig = '';
  function refreshFeet() {
    const here = Game.state() ? Game.floorItems() : [];
    const sig = here.map(it => `${Game.spriteFor(it)}|${Game.itemName(it)}`).join(',');
    if (sig === feetSig) return;
    feetSig = sig;
    const btn = /** @type {HTMLButtonElement} */ ($('#feet'));
    btn.hidden = !here.length;
    if (!here.length) return;
    const shown = here.slice(-5);
    btn.querySelector('.feet-icons').innerHTML = shown.map(it => { const a = Assets.sprites[Game.spriteFor(it)]; return a ? `<img src="${a.url}" alt="">` : ''; }).join('')
      + (here.length > shown.length ? `<em>+${here.length - shown.length}</em>` : '');
    btn.setAttribute('aria-label', `Take what lies here: ${here.map(it => Game.itemName(it)).join(', ')}`);
  }
  function refreshHud() {
    refreshUse();
    refreshFeet();
    checkTips();
    const G = Game.state();
    if (!G) return;
    const p = G.player;
    const L = Game.level();
    const champ = L.monsters.find(m => m.elite && m.awake && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) <= 6);
    // how long a timed effect has left, in whole seconds, so the row counts down
    const left = until => Math.max(0, Math.ceil((until - G.t) / 1000));
    // a spell's own slot, or a bought blessing's ('boon_ac'), never the two summed
    const secs = k => (p.effects[k] && p.effects[k].until > G.t ? left(p.effects[k].until) : 0);
    // life and spell points as they should show this moment: what a draught
    // gave is on the bars once it is down
    const vit = Game.vitals();
    const sig = [vit.hp, p.maxHp, vit.sp, p.maxSp, p.food, p.gold, G.depth, p.dir, p.level, p.poison ? left(p.poison.until) : 0, secs('ac'), secs('hit'), secs('might'), secs('boon_ac'), secs('boon_hit'), p.x, p.y, champ ? champ.uid : 0, p.webbed > G.t, p.held > G.t, !!p.grabbed, p.mirrors || 0, p.riposteUntil > G.t, p.shadowUntil > G.t, secs('crew_hit'), L.press || 0, L.twist || '', p.smokeUntil > G.t ? left(p.smokeUntil) : 0, houndSig()].join('|');
    if (sig === hudSig) return;
    hudSig = sig;
    $('#hud-name').textContent = p.name;
    $('#hud-cls').textContent = `${CLASSES[p.cls].name} ${p.level}`;
    $('#bar-hp').style.width = Math.max(0, vit.hp / p.maxHp * 100) + '%';
    $('#txt-hp').textContent = `HP ${vit.hp}/${p.maxHp}`;
    const spBar = $('.bar.sp');
    spBar.style.display = p.maxSp ? '' : 'none';
    $('#bar-sp').style.width = (p.maxSp ? vit.sp / p.maxSp * 100 : 0) + '%';
    $('#txt-sp').textContent = `SP ${vit.sp}/${p.maxSp}`;
    $('#bar-food').style.width = p.food + '%';
    $('#txt-food').textContent = p.food > 30 ? 'Fed' : (p.food > 0 ? 'Hungry' : 'Starving');
    $('#hud-depth').textContent = `Floor ${G.depth}/${G.opts.levels}`;
    $('#hud-gold').textContent = `${p.gold} gold`;
    $('#hud-compass').textContent = ['N', 'E', 'S', 'W'][p.dir];
    const st = [];
    if (p.poison) st.push(`<span class="bad">Poisoned ${left(p.poison.until)}s</span>`);
    // a floor readier for a strong hero says so while you are on it
    if (L.twist && TWISTS[L.twist]) st.push(`<span class="${L.twist === 'market' ? 'good' : 'bad'}" title="${escapeHtml(TWISTS[L.twist].chip)}">${escapeHtml(TWISTS[L.twist].name)}</span>`);
    if ((L.press || 0) > 0) st.push(`<span class="bad" title="You are ahead of most who come this far, and this floor's creatures are readier for it">Foes +${Game.pressSturdier(L)}%</span>`);
    if (p.held > G.t) st.push(`<span class="bad">${p.heldBy === 'down' ? 'Knocked down' : p.heldBy === 'stone' ? 'Stone' : 'Frozen'}</span>`);
    if (p.webbed > G.t) st.push('<span class="bad">Webbed</span>');
    if (p.grabbed) st.push('<span class="bad">Grabbed</span>');
    if (secs('ac')) st.push(`<span class="good">Shielded ${secs('ac')}s</span>`);
    // a blessing lasts minutes: counted in minutes, so the row does not tick every second
    // a ward (armour) or a blessing (to hit) bought or prayed for; both at once are Warded
    const boon = Math.max(secs('boon_ac'), secs('boon_hit'));
    // (a prayer, not "Blessed": that is the spell's own chip, and both at once read as one twice)
    if (boon) st.push(`<span class="good">${secs('boon_ac') ? 'Warded' : 'Prayer'} ${Math.ceil(boon / 60)}m</span>`);
    if (p.smokeUntil > G.t) st.push(`<span class="good" title="Lost in your smoke: what was near has lost you">In smoke ${left(p.smokeUntil)}s</span>`);
    if (secs('crew_hit')) st.push(`<span class="good" title="The crew you buried march with you: +2 to hit">Crew's song ${Math.ceil(secs('crew_hit') / 60)}m</span>`);
    if (p.mirrors > 0) st.push(`<span class="good">Images \u00d7${Number(p.mirrors)}</span>`);
    if (p.riposteUntil > G.t) st.push('<span class="good">Riposte ready</span>');
    if (p.shadowUntil > G.t && (p.talents || []).includes('shadow_step')) st.push('<span class="good">In shadow</span>');
    // a Berserker's rage is worth seeing grow
    if (Game.berserkerRage() > 0) st.push(`<span class="good" title="Berserker: +${Game.berserkerRage()} damage on every blow${p.hp < p.maxHp / 2 ? ', and a quicker swing' : ''}">Rage +${Game.berserkerRage()}${p.hp < p.maxHp / 2 ? ', frenzied' : ''}</span>`);
    if (secs('hit')) st.push(`<span class="good">Blessed ${secs('hit')}s</span>`);
    if (secs('might')) st.push(`<span class="good">Mighty ${secs('might')}s</span>`);
    if (p.food === 0) st.push('<span class="bad">Starving</span>');
    if (champ) st.push(`<span class="bad">${escapeHtml(Game.mstat(champ).name)} near</span>`);
    // the companion, when there is something to say: hurt, told to stay, or waiting on another floor
    const hound = Game.companion(), kindWord = hound && hound.kind === 'goblin' ? 'goblin' : 'hound';
    if (hound && !hound.fallen) {
      const who = escapeHtml(hound.name);
      if (hound.depth !== G.depth) st.push(`<span title="Your ${kindWord} waits where you told it to stay">${who} on floor ${Number(hound.depth)}</span>`);
      else if (hound.hp < hound.maxHp || hound.mode === 'stay') st.push(`<span class="${hound.hp < hound.maxHp / 3 ? 'bad' : 'good'}" title="Your ${kindWord}">${who} ${Number(hound.hp)}/${Number(hound.maxHp)}${hound.mode === 'stay' ? ', staying' : ''}</span>`);
    }
    $('#hud-status').innerHTML = st.join('');
  }
  // The Use button names what it will do: a staircase you are facing should
  // say Descend, not leave you to guess that Use means it.
  let useSig = '';
  function refreshUse() {
    refreshCast();
    refreshRest();
    const label = Game.useLabel();
    if (label === useSig) return;
    useSig = label;
    const btn = document.querySelector('[data-tap="use"]');
    if (!btn) return;
    btn.querySelector('small').textContent = label;
    btn.setAttribute('aria-label', label);
    btn.classList.toggle('ctx', label !== 'Use' && label !== 'Search');
  }
  // Rest only ever rests: with something close it dims and says why, and a
  // tap says so in the log. It used to turn into Quaff in a fight, and a
  // player reaching for a rest drank a potion instead.
  let restSig = '';
  function refreshRest() {
    refreshQuaff();
    refreshQuickScroll();
    const label = Game.restLabel();
    if (label === restSig) return;
    restSig = label;
    const btn = document.querySelector('[data-tap="rest"]');
    if (!btn) return;
    const foes = label === 'Foes near';
    if (foes) btn.innerHTML = 'Rest<small>foes near</small>';
    else btn.textContent = label;
    btn.classList.toggle('unavail', foes || label === 'No rest');
    btn.setAttribute('aria-label', foes ? 'Rest: not with foes near' : label);
  }
  // A caster's Cast button casts, so their quick drink is a bottle of its own
  // beside the life bar: always in the same place, there whenever they carry
  // a healing draught they know, and never standing in for anything else.
  // The scroll worth reading this moment, one tap away, low in the view's left
  // corner: Fire when a foe is ahead for it, Restoration when badly hurt,
  // Teleport when cornered and failing. It is not there the rest of the time.
  const QUICK_SCROLL = { scroll_fire: ['Fire', '#ff7020'], scroll_heal: ['Heal', '#60e080'], scroll_teleport: ['Flee', '#c080ff'] };
  let quickSig = '';
  // The boss's bar takes the top rows of the picture (see drawBossBar): while
  // it shows, the status chips and any tip sit just below it rather than on
  // its name. How far down that is depends on the picture's height on screen.
  let barUp = null, barPx = -1;
  const BAR_ROWS = 24;
  function bossBar(on) {
    const wrap = $('.view-wrap'), view = $('#view');
    if (!wrap || !view) return;
    const px = on ? Math.ceil(BAR_ROWS / Renderer.H * view.clientHeight) : 0;
    if (on === barUp && px === barPx) return;
    barUp = on; barPx = px;
    wrap.classList.toggle('boss-up', on);
    wrap.style.setProperty('--bar-bottom', px + 'px');
  }
  function helpTab(which) {
    for (const t of $$('[data-htab]')) { const on = t.dataset.htab === which; t.classList.toggle('on', on); t.setAttribute('aria-selected', String(on)); }
    for (const pg of $$('[data-hpage]')) pg.hidden = pg.dataset.hpage !== which;
    $('#screen-help').scrollTop = 0;
  }
  function refreshQuickScroll() {
    const it = Game.quickScroll();
    const sig = it ? `${it.t}|${it.q}` : '';
    if (sig === quickSig) return;
    quickSig = sig;
    const btn = /** @type {HTMLButtonElement} */ ($('#quick-scroll'));
    btn.hidden = !it;
    if (!it) return;
    const [label, color] = QUICK_SCROLL[it.t] || ['Read', '#e0b84a'];
    const art = Assets.sprites[Game.spriteFor(it)];
    /** @type {HTMLImageElement} */ (btn.querySelector('img')).src = art ? art.url : '';
    btn.querySelector('small').textContent = label;
    btn.style.setProperty('--qs', color);
    btn.setAttribute('aria-label', `Read the ${Game.itemName({ ...it, q: 1 })}`);
  }
  let quaffSig = '';
  function refreshQuaff() {
    const p = Game.player();
    // a caster's Cast button casts and a fighter's or thief's is their own move, so the bottle is here for everyone
    const drinks = (!!CLASSES[p.cls].spells || !!Game.abilityOf()) && !Game.vowed('unaided');
    const n = drinks ? p.inv.filter(i => (i.t === 'potion_heal' || i.t === 'potion_xheal') && Game.isKnown(i.t)).reduce((k, i) => k + i.q, 0) : 0;
    const sig = `${drinks}|${n}`;
    if (sig === quaffSig) return;
    quaffSig = sig;
    const btn = $('#hud-quaff');
    btn.style.display = drinks ? '' : 'none';
    btn.style.visibility = n ? '' : 'hidden';
    $('#hud-quaff-n').textContent = n > 1 ? String(n) : '';
    btn.setAttribute('aria-label', `Quaff a healing draught (${n} carried)`);
  }
  let castSig = '';
  function refreshCast() {
    const label = Game.castLabel();
    if (label === castSig) return;
    castSig = label;
    const btn = document.querySelector('[data-tap="cast"]');
    if (!btn) return;
    // a fighter's Bash, a thief's Smoke or a ranger's Snare, dim while it comes back, with the seconds left
    const a = Game.abilityOf();
    if (a) {
      const cooling = label !== a.name;
      btn.firstChild.nodeValue = a.id === 'bash' ? '\u26E8' : a.id === 'snare' ? '\u27B0' : '\u2601';
      btn.classList.toggle('empty', cooling);
      btn.querySelector('small').textContent = label;
      btn.setAttribute('aria-label', cooling ? `${a.name}: ready in ${label.split(' ')[1]}` : a.id === 'bash' ? 'Bash: break the blow in front of you and set it reeling' : a.id === 'snare' ? 'Snare: catch the first foe down the corridor ahead' : 'Smoke: everything close loses you for a few seconds');
      return;
    }
    // the spell-less quaff instead, and the button dims with nothing known to drink
    const quaffs = label.startsWith('Quaff');
    btn.firstChild.nodeValue = quaffs ? '\u2697' : '\u2726';
    btn.classList.toggle('empty', label === 'Quaff (none)');
    btn.querySelector('small').textContent = quaffs ? 'Quaff' : label;
    btn.setAttribute('aria-label', label === 'Quaff' ? 'Quaff a healing draught' : quaffs ? 'Quaff: no known healing draught' : `Cast ${label}`);
  }
  function refreshLog() {
    const G = Game.state();
    // count messages ever written, not the length of a capped array
    // a line held back for its moment (a fireball still in the air) shows when it lands
    const now = performance.now();
    if (!G || (G.logSeq === logCount && !(logDue && now >= logDue))) return;
    logCount = G.logSeq;
    const held = G.log.filter(e => e.at > now);
    logDue = held.length ? Math.min(...held.map(e => e.at)) : 0;
    const el = $('#log');
    // a Bestiary note shows while it is the newest line, then gives way to the
    // fight: in the short box it was pushing the blows out (it stays in the history)
    const live = G.log.filter(e => !e.gone && !(e.at > now));
    el.innerHTML = live.filter((e, i) => e.c !== 'note' || i === live.length - 1).slice(-4).map(e => `<div class="${e.c}">${logLine(e.m)}</div>`).join('');
    // Lines wrap on a narrow phone, so four of them can overflow the panel.
    // Drop whole old lines rather than leave half of one clipped at the top;
    // the full history is a tap on Log away. The panel stacks from the bottom, so
    // overflow spills off the top where scrollHeight does not count it: ask
    // where the oldest line starts instead.
    const top = el.getBoundingClientRect().top + parseFloat(getComputedStyle(el).paddingTop) - 0.5;
    while (el.children.length > 1 && el.firstElementChild.getBoundingClientRect().top < top) el.removeChild(el.firstElementChild);
  }
  // Render exactly as many rows as the box the view was given has room for,
  // so its pixels stay square however tall the phone is.
  function fitView() {
    if (!$('#screen-game').classList.contains('active')) return;
    const box = $('#view').parentElement.getBoundingClientRect();
    if (box.width < 10 || box.height < 10) return;
    const want = Renderer.W * box.height / box.width;
    if (Math.abs(want - Renderer.H) >= 2) Renderer.setHeight(want);
  }
  // The dice come in one fixed shape, so set them apart as a footnote that
  // stays in one piece and drops to its own line when the phone is narrow.
  // It was the tail of the line, which is exactly what an ellipsis cuts.
  function logLine(m) {
    return escapeHtml(m).replace(/ \((d20 [^)]*)\)/, ' <span class="roll">($1)</span>');
  }

  // Small live automap in the corner of the view, 15x15 tiles around the player.
  let miniFaded = false;
  let miniBelow = 0;
  function refreshMinimap(now) {
    if (now - miniAt < 120) return;
    miniAt = now;
    const c = $('#minimap');
    // a tip across the top of the view would cover it: it steps down below the
    // tip while one is up, and back when it goes; so do the status chips, which
    // share the top edge (the hound's among them)
    const tip = $('#tip'), below = tip && tip.classList.contains('show') ? tip.offsetTop + tip.offsetHeight + 4 : 0;
    if (below !== miniBelow) { miniBelow = below; c.style.top = below ? below + 'px' : ''; $('#hud-status').style.top = below ? below + 'px' : ''; }
    // it steps back, nearly out of sight, while a creature stands under it:
    // a health bar or a warning mark matters more than the map
    const vr = $('#view').getBoundingClientRect(), mr = c.getBoundingClientRect();
    if (vr.width > 0) {
      const sx = Renderer.W / vr.width, sy = Renderer.H / vr.height;
      const fade = Renderer.busy((mr.left - vr.left) * sx - 4, (mr.top - vr.top) * sy - 4, (mr.right - vr.left) * sx + 4, (mr.bottom - vr.top) * sy + 4);
      if (fade !== miniFaded) { miniFaded = fade; c.classList.toggle('faded', fade); }
    }
    const L = Game.level(), p = Game.player();
    const R = 7, size = 6;
    const hound = houndHere();
    const sig = [p.x, p.y, p.dir, L.depth, L.monsters.length, hound ? `${hound.x},${hound.y}` : ''].join(',');
    if (sig === miniSig) return;
    const ctx = c.getContext('2d');
    const T = Dungeon.T;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = 'rgba(5,5,10,0.3)';
    ctx.fillRect(0, 0, c.width, c.height);
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const x = p.x + dx, y = p.y + dy;
      if (x < 0 || y < 0 || x >= L.w || y >= L.h || !L.explored[y * L.w + x]) continue;
      const t = L.tiles[y * L.w + x];
      let col = '#46425a';
      // a torch is a bracket set into a wall, so it reads as wall here: picking
      // it out in its own colour made the corner map busy and told you nothing
      // you could act on
      if (t === T.WALL || t === T.SECRET || t === T.TORCH) col = '#2a2736';
      else if (t === T.DOOR) col = '#a0783c';
      else if (t === T.DOOR_OPEN) col = '#6a5030';
      else if (t === T.DOOR_LOCKED) col = KEY_COLORS[L.locks[x + ',' + y]] || '#c0a040';
      else if (t === T.STAIRS_DOWN) col = '#e0c060';
      else if (t === T.STAIRS_UP) col = '#80c0e0';
      else if (t === T.FOUNTAIN) col = '#4090e0';
      ctx.fillStyle = col;
      ctx.fillRect((dx + R) * size, (dy + R) * size, size, size);
    }
    for (const m of L.monsters) {
      const dx = m.x - p.x, dy = m.y - p.y;
      if (Math.abs(dx) > R || Math.abs(dy) > R || !L.explored[m.y * L.w + m.x] || !m.awake) continue;
      ctx.fillStyle = '#e04030';
      ctx.fillRect((dx + R) * size + 1, (dy + R) * size + 1, size - 2, size - 2);
    }
    // a pale round mark, nothing like a door or a torch
    if (hound && Math.abs(hound.x - p.x) <= R && Math.abs(hound.y - p.y) <= R) {
      ctx.fillStyle = MAP_COLOUR.hound;
      ctx.beginPath(); ctx.arc((hound.x - p.x + R) * size + size / 2, (hound.y - p.y + R) * size + size / 2, size / 2 - 0.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.save();
    ctx.translate(R * size + size / 2, R * size + size / 2);
    ctx.rotate(p.dir * Math.PI / 2);
    ctx.fillStyle = '#ff6a50';
    ctx.beginPath(); ctx.moveTo(0, -3.5); ctx.lineTo(3, 3); ctx.lineTo(-3, 3); ctx.closePath(); ctx.fill();
    ctx.restore();
    miniSig = sig;
  }
  // What an item does, in one line. Unknown potions and scrolls stay a mystery.
  // A relic says what it is underneath and names its powers after.
  function itemBlurb(it) {
    const r = Game.relicOf(it);
    // an ordinary piece with a power names it after the numbers
    if (!r) return plainBlurb(it) + (it.px && !it.h && PREFIX_NAME[it.px] ? `. ${PREFIX_NAME[it.px]}: ${PREFIX_DESC[it.px]}` : '') + (it.pw && !it.h && RELIC_POWERS[it.pw] ? `. ${RELIC_POWERS[it.pw].split(':')[0]}` : '');
    return `${ITEMS[it.t].name}. ${plainBlurb(it)}. ${r.powers.map(k => RELIC_POWERS[k].split(':')[0]).join(', ')}`;
  }
  function plainBlurb(it) {
    const b = ITEMS[it.t];
    if (!Game.isKnown(it.t)) return 'You do not know what this does';
    if (b.kind === 'weapon') {
      const d = b.dmg;
      const sp = b.speed * (swiftOf(it) ? 0.85 : 1);
      // one figure, enchantment folded in: "1d6+1 +1" read as a typo
      const add = d[2] + knownE(it);
      return `Damage ${d[0]}d${d[1]}${add > 0 ? '+' + add : add < 0 ? '\u2212' + -add : ''}${it.h ? ' ?' : ''}, ${(sp / 1000).toFixed(sp % 100 ? 2 : 1)}s${b.range ? `, reaches ${b.range}` : ''}${b.twoHanded ? ', two-handed' : ''}`;
    }
    // a piece made with a power of its own (a wyrm's scales, a quillback's quills) says so
    const own = b.power && (b.kind === 'armor' || b.kind === 'shield') && RELIC_POWERS[b.power] ? `. ${RELIC_POWERS[b.power]}` : '';
    if (b.kind === 'armor') return `Armour class +${b.ac + knownE(it)}${it.h ? '?' : ''} (${b.weight === 'cloth' ? 'a robe, for mages' : b.weight})${b.sp ? `, +${b.sp} spell points` : ''}${b.cheap ? ', spells of 5 points or more cost 1 less' : ''}${own}`;
    if (b.kind === 'shield' && b.focus) return `${b.desc.replace(/\.$/, '')}; held in the free hand${b.ac ? `, armour class +${b.ac}` : ''}`;
    if (b.kind === 'shield') return `Armour class +${b.ac + knownE(it)}${it.h ? '?' : ''}, needs a free hand${own}`;
    if (b.kind === 'food') return `Restores ${b.food} nourishment`;
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
    what.innerHTML = `<b${it.u ? ' class="relic"' : ''}>${escapeHtml(Game.itemName(o.one ? { ...it, q: 1 } : it))}</b><small>${escapeHtml(note || '')}</small>`;
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
    $('#shop-gold').innerHTML = `${p.gold} gold` + (charm > 0 ? `<br><small>your charm: ${charm}% off</small>` : charm < 0 ? `<br><small>your manner: ${-charm}% dearer</small>` : '')
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
      const note = (Game.isKnown(it.t) ? itemBlurb(it) : 'Unknown until bought: the trader names it when you pay') + same + (vs ? ` · ${vs}` : '') + (it.q > 1 ? ` · ${it.q} in stock` : '');
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
      btn.textContent = sv.why ? '—' : `Pay ${sv.price}g`;
      btn.disabled = !!sv.why || p.gold < sv.price;
      if (!btn.disabled) btn.className = 'afford';
      btn.setAttribute('aria-label', `${sv.label}${sv.why ? '' : ` for ${sv.price} gold`}`);
      if (!sv.why) payButton(btn, row, sv.price, 'Pay', () => Game.buyService(sv.id));
      row.appendChild(btn);
      (sv.why && fold ? fold : svc).appendChild(row);
    }
    if (fold) svc.appendChild(fold);
    const sellBox = $('#shop-sell');
    sellBox.innerHTML = '';
    const sellable = p.inv.filter(it => it.t !== 'artifact' && it.t !== 'key');
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

  let journalTab = 'pages';
  function renderJournal() {
    for (const t of $$('[data-jtab]')) { const on = t.dataset.jtab === journalTab; t.classList.toggle('on', on); t.setAttribute('aria-selected', String(on)); }
    if (journalTab === 'beasts') { $('#journal-count').textContent = renderBestiary($('#journal-list')); return; }
    if (journalTab === 'relics') { $('#journal-count').textContent = renderCodex($('#journal-list')); return; }
    const got = Game.journal();
    $('#journal-count').textContent = `${got.length} of ${Game.pagesInDungeon()}`;
    const el = $('#journal-list');
    if (!got.length) {
      el.innerHTML = '<p class="dim">The crews who came before you left pages behind. You have not found any yet.</p>';
      return;
    }
    el.innerHTML = got.slice().sort((a, b) => a.i - b.i).map(j => {
      const e = JOURNAL[j.i];
      return `<div class="journal-entry"><h3>${escapeHtml(e.title)}</h3><p>${escapeHtml(e.text)}</p><p class="where">Found on floor ${j.depth}</p></div>`;
    }).join('');
  }
  // ---------- the Hall, the bestiary and the relic codex: see hall.js ----------

  // An encounter: the prose, then each choice with what it tests and how
  // likely it is to go well; once chosen, what happened and what it did.
  function renderEncounter() {
    const e = Game.currentEncounter();
    if (!e) { closeOverlay(); return; }
    $('#enc-title').textContent = e.def.title;
    const art = Assets.sprites[e.def.sprite];
    $('#enc-art').src = art ? art.url : '';
    const el = $('#enc-choices');
    el.innerHTML = '';
    if (!e.result) {
      $('#enc-text').textContent = e.def.text;
      // the tap that opened it (twice on the view, twice on Use) must not
      // answer it unread: the choices arm a moment later, as the level-up offers do
      const armedAt = performance.now() + BOON_GUARD_MS;
      for (const o of Game.encounterOptions()) {
        const btn = document.createElement('button');
        btn.className = 'boon enc-choice';
        const bits = [];
        // the odds always; the dice behind them only for a player who has asked to see the rolls
        if (o.stat) bits.push(`${o.statName}: ${Game.rollsShown() ? `d20${o.bonus < 0 ? '' : '+'}${o.bonus} vs ${o.dc}, ` : ''}${Math.round(o.chance * 100)}% chance${o.knack ? ' (your training helps)' : ''}`);
        if (o.cost) bits.push(`costs ${o.cost}`);
        if (o.blocked) bits.push(o.blocked);
        btn.innerHTML = `<b>${escapeHtml(o.label)}</b>${bits.length ? `<small>${escapeHtml(bits.join(' · '))}</small>` : ''}`;
        btn.disabled = !!o.blocked;
        if (!o.blocked) { btn.classList.add('arming'); setTimeout(() => btn.classList.remove('arming'), BOON_GUARD_MS); }
        btn.addEventListener('click', () => { if (performance.now() < armedAt) return; Game.chooseEncounter(o.i); renderEncounter(); });
        el.appendChild(btn);
      }
      return;
    }
    const r = e.result;
    const verdict = r.check ? (r.check.pass ? '<b class="enc-pass">It goes well.</b> ' : '<b class="enc-fail">It goes badly.</b> ') : '';
    $('#enc-text').innerHTML = verdict + escapeHtml(r.text) + (r.check && r.check.note ? ` <span class="roll">${escapeHtml(r.check.note.trim())}</span>` : '');
    if (r.lines.length) {
      const ul = document.createElement('ul');
      ul.className = 'enc-lines';
      ul.innerHTML = r.lines.map(l => `<li>${escapeHtml(l)}</li>`).join('');
      el.appendChild(ul);
    }
    const done = document.createElement('button');
    done.className = 'primary';
    done.textContent = 'Continue';
    // the second tap of a double tap on a choice lands here: the outcome is read first
    const readFrom = performance.now() + SHOP_GUARD_MS;
    done.addEventListener('click', () => { if (performance.now() >= readFrom) closeOverlay(); });
    el.appendChild(done);
  }
  const BOON_GUARD_MS = 700, SPREAD_GUARD_MS = 350;
  /** A lesson's card: for a stat, what it will be and what it buys this hero. */
  function lessonText(b, p) {
    if (!b.stat) return b.desc;
    const s = p.stats[b.stat], next = s + (s % 2 ? 1 : 2);
    const what = {
      str: p.cls === 'thief' ? 'to hit' : 'to hit and to damage',
      // a ranger lands and weights every blow with Dexterity, as a fighter does with Strength
      dex: p.cls === 'thief' ? 'to armour class and to damage' : p.cls === 'ranger' ? 'to hit, to damage and to armour class' : 'to armour class',
      con: 'hit point with every level from now on',
      int: p.cls === 'mage' ? 'spell point for every hero level' : 'to Study and to every Intelligence check',
      wis: p.cls === 'cleric' ? 'spell point for every hero level, to hit and to damage, and a surer will against draining' : 'against draining',
    }[b.stat];
    return `${STAT_NAMES[b.stat]} ${s} \u2192 ${next}: +1 ${what}.`;
  }
  /** Self-Taught: tap a score for each point; both on one is fine. */
  function renderSpread(b) {
    const p = Game.player(), el = $('#boon-list'), picks = [];
    // the tap that chose Self-Taught must not land on a score as well: the scores wait a moment
    const armedAt = performance.now() + SPREAD_GUARD_MS;
    const draw = () => {
      el.innerHTML = `<p class="boon-head">${escapeHtml(b.name)}: ${b.spread - picks.length} point${b.spread - picks.length === 1 ? '' : 's'} to place</p>`
        + '<p class="dim small spread-hint">A point on a score shown in green raises its bonus. ★ marks your class\'s key score.</p>';
      const grid = document.createElement('div');
      grid.className = 'spread-grid';
      for (const k in STAT_NAMES) {
        const v = p.stats[k] + picks.filter(x => x === k).length, m = Game.mod(v);
        // Self-Taught gives a score two points over the whole run, no more
        const full = ((p.taught || {})[k] || 0) + picks.filter(x => x === k).length >= 2;
        const btn = document.createElement('button');
        btn.className = 'boon spread-stat' + (CLASSES[p.cls].primary === k ? ' key' : '');
        btn.dataset.stat = k;
        // which taps move a bonus: a point onto an odd score raises it
        const up = Game.mod(v + 1) > m;
        const put = picks.filter(x => x === k).length, key = CLASSES[p.cls].primary === k;
        btn.innerHTML = `<b>${key ? '\u2605 ' : ''}${escapeHtml(STAT_NAMES[k])}</b><small>${v} (${m >= 0 ? '+' : ''}${m})${up ? ` \u2192 ${m + 1 >= 0 ? '+' : ''}${m + 1}` : ''}</small>${put ? `<em class="picked">+${put}</em>` : ''}`;
        if (put) btn.classList.add('picked');
        if (up) btn.classList.add('raises');
        const wait = armedAt - performance.now();
        if (full) { btn.disabled = true; btn.classList.add('full'); btn.title = 'Self-Taught has given this score its two points'; }
        else if (wait > 0) { btn.disabled = true; setTimeout(() => { btn.disabled = false; }, wait); }
        btn.addEventListener('click', () => {
          if (performance.now() < armedAt) return;
          picks.push(k);
          if (picks.length < b.spread) { draw(); return; }
          // refused (the offer changed under it): start the placing again rather than piling up taps
          if (!Game.chooseBoon(b.id, picks)) { picks.length = 0; draw(); return; }
          if (Game.pendingBoons()) renderBoons(); else closeOverlay();
        });
        grid.appendChild(btn);
      }
      el.appendChild(grid);
      const back = document.createElement('button');
      back.className = 'ghost small';
      back.textContent = picks.length ? 'Start again' : 'Choose a different lesson';
      back.addEventListener('click', () => { if (picks.length) { picks.length = 0; draw(); } else renderBoons(); });
      el.appendChild(back);
    };
    draw();
  }
  function renderBoons() {
    const offer = Game.pendingBoons();
    if (!offer) { closeOverlay(); return; }
    if (Game.isPathOffer(offer)) { renderPaths(offer); return; }
    const p = Game.player();
    const talents = TALENTS[p.cls] || [];
    const isTalent = offer.some(id => talents.some(t => t.id === id));
    $('#boon-title').textContent = isTalent
      ? `Hero level ${Game.pendingLevel()}: a ${CLASSES[p.cls].name}'s talent`
      : `Hero level ${Game.pendingLevel()}: what the delve taught you`;
    const el = $('#boon-list');
    el.innerHTML = '';
    // what the level brought, and what comes next
    const level = Game.pendingLevel(), got = Game.levelNote(level);
    const bits = [];
    if (got) { bits.push(`+${got.hp} hit points`); for (const sp of got.spells) bits.push(`learned ${sp}`); }
    const nextTalent = level + (level % 2 === 0 ? 2 : 1);   // talents come at the even levels
    if (nextTalent <= MAX_LEVEL) bits.push(isTalent ? `next talent at level ${nextTalent}` : (nextTalent === level + 1 ? 'a talent at the next level' : `next talent at level ${nextTalent}`));
    if (!p.path && level < PATH_LEVEL && PATHS[p.cls]) bits.push(`your path at level ${PATH_LEVEL}`);
    const head = document.createElement('p');
    head.className = 'boon-head';
    head.textContent = bits.join(' \u00b7 ');
    el.appendChild(head);
    const note = document.createElement('p');
    note.className = 'dim small';
    note.textContent = isTalent ? 'A talent is for good, and each can be taken once. Choose the one that suits how you fight.'
      : 'A small lesson. Choose one.';
    el.appendChild(note);
    // a tap already on its way when the screen opened must not choose for you
    const openedAt = performance.now();
    for (const id of offer) {
      const b = BOONS.find(x => x.id === id) || talents.find(x => x.id === id);
      if (!b) continue;
      const btn = document.createElement('button');
      btn.className = 'boon' + (isTalent ? ' talent' : '');
      btn.innerHTML = `<b>${escapeHtml(b.name)}</b><small>${escapeHtml(isTalent ? b.desc : lessonText(b, p))}</small>`;
      btn.disabled = true; btn.classList.add('arming');
      setTimeout(() => { btn.disabled = false; btn.classList.remove('arming'); }, BOON_GUARD_MS);
      btn.addEventListener('click', () => {
        if (performance.now() - openedAt < BOON_GUARD_MS) return;
        if (/** @type {any} */ (b).spread) { renderSpread(/** @type {any} */ (b)); return; }
        Game.chooseBoon(id);
        if (Game.pendingBoons()) renderBoons(); else closeOverlay();
      });
      el.appendChild(btn);
    }
  }

  /** A path's card: its name, a line of flavour, and what it does, as a list. */
  const pathCard = x => `<b>${escapeHtml(x.name)}</b><small class="path-flavour">${escapeHtml(x.flavour)}</small><ul class="path-effects">${x.effects.map(e => `<li>${escapeHtml(e)}</li>`).join('')}</ul>${pathWarning(x)}`;
  // a Knight's first two powers are a shield's: one fighting with two blades,
  // or a two-handed sword, is told so before choosing, not after
  function pathWarning(x) {
    const eq = Game.player().eq;
    if (x.wants !== 'shield' || eq.shield) return '';
    const why = eq.offhand ? 'Your off hand holds a blade' : eq.weapon && ITEMS[eq.weapon.t].twoHanded ? 'Your weapon takes both hands' : 'You carry no shield';
    return `<small class="path-warn">${why}: the first two need a shield.</small>`;
  }
  // The class's two paths, once a run: set apart from lessons and talents
  // because it is the bigger choice, and it cannot be undone.
  function renderPaths(offer) {
    const p = Game.player(), paths = PATHS[p.cls] || [];
    const level = Game.pendingLevel(), got = Game.levelNote(level);
    $('#boon-title').textContent = `Hero level ${level}: choose your path`;
    const el = $('#boon-list');
    el.innerHTML = '';
    const bits = [];
    if (got) { bits.push(`+${got.hp} hit points`); for (const sp of got.spells) bits.push(`learned ${sp}`); }
    const head = document.createElement('p');
    head.className = 'boon-head';
    head.textContent = bits.join(' \u00b7 ');
    if (bits.length) el.appendChild(head);
    const note = document.createElement('p');
    note.className = 'dim small';
    // at the path's own level it is instead of the lesson; a hero who came past
    // that level before there were paths gets it on top of what the level gives
    const inPlace = Game.pendingLevel() === PATH_LEVEL;
    note.textContent = `Every ${CLASSES[p.cls].name.toLowerCase()} chooses a path here. Choose one: it is yours for the rest of the run${inPlace ? ', and it takes the place of this level\'s lesson' : ', and it comes on top of what this level gives you'}.`;
    el.appendChild(note);
    const openedAt = performance.now();
    for (const id of offer) {
      const x = paths.find(q => q.id === id);
      if (!x) continue;
      const btn = document.createElement('button');
      btn.className = 'boon path';
      btn.dataset.path = x.id;
      btn.innerHTML = pathCard(x);
      btn.disabled = true; btn.classList.add('arming');
      setTimeout(() => { btn.disabled = false; btn.classList.remove('arming'); }, BOON_GUARD_MS);
      // it cannot be undone, so it asks twice, as a dear buy at the trader does:
      // the first tap marks the card, a second on the same card takes the path
      btn.addEventListener('click', () => {
        if (performance.now() - openedAt < BOON_GUARD_MS) return;
        if (!btn.classList.contains('armed')) {
          for (const b of $$('#boon-list .boon.path.armed')) b.dispatchEvent(new Event('disarm'));
          btn.classList.add('armed');
          btn.insertAdjacentHTML('beforeend', `<span class="path-confirm">Tap again to take the ${escapeHtml(x.name)}'s path</span>`);
          return;
        }
        Game.chooseBoon(id);
        if (Game.pendingBoons()) renderBoons(); else closeOverlay();
      });
      btn.addEventListener('disarm', () => { btn.classList.remove('armed'); btn.querySelector('.path-confirm')?.remove(); });
      el.appendChild(btn);
    }
  }

  function renderLogHistory() {
    const G = Game.state();
    $('#log-history').innerHTML = '<div class="log-history">' + G.log.filter(e => !e.gone).reverse().map(e => `<div class="${e.c}">${logLine(e.m)}</div>`).join('') + '</div>';
  }
  // ---------- overlays ----------
  // A level-up choice or an encounter holds the screen until it is dealt
  // with: what the game asks for meanwhile (another choice, a shop) waits its
  // turn rather than covering it, and what the player taps for is ignored.
  const GAME_ASKS = ['boons', 'encounter', 'shop', 'fork'];
  function openOverlay(name) {
    if (overlay === 'boons' || overlay === 'encounter') {
      if (name !== overlay && GAME_ASKS.includes(name) && !waiting.includes(name)) waiting.push(name);
      return;
    }
    closeOverlay(false);
    overlay = name;
    held.clear();
    $$('.ctl').forEach(b => b.classList.remove('held'));
    $('#ov-' + name).classList.add('open');
    setBehind(true);
    syncHistory();
    if (name === 'inv') renderInv();
    if (name === 'map') renderMap();
    if (name === 'spells') renderSpells();
    if (name === 'char') renderChar();
    if (name === 'menu') renderMenu();
    if (name === 'log') renderLogHistory();
    if (name === 'shop') renderShop();
    if (name === 'journal') renderJournal();
    if (name === 'boons') renderBoons();
    if (name === 'encounter') renderEncounter();
    if (name === 'fork') renderFork();
    if (name === 'code') renderCode();
  }
  /** The hero as a save code, written fresh each time it is asked for. */
  let codeAsk = 0;
  function renderCode() {
    const out = /** @type {HTMLTextAreaElement} */ ($('#code-out'));
    out.value = '';
    $('#code-note').textContent = 'Writing the code…';
    // only the latest asking fills the box, if the menu is opened twice quickly
    const ask = ++codeAsk;
    Game.saveCode().then(code => {
      if (overlay !== 'code' || ask !== codeAsk) return;
      out.value = code || '';
      $('#code-note').textContent = code ? `${Math.round(code.length / 1000)} thousand letters long: copy all of it.` : 'This hero cannot be saved just now.';
    }).catch(() => { if (ask === codeAsk) $('#code-note').textContent = 'The code could not be written on this browser.'; });
  }
  /** The divided stair: each road, what it holds, and a way to stay put. */
  function renderFork() {
    const el = $('#fork-choices');
    el.innerHTML = '';
    // held off a moment: held sideways, Descend lies over a road's card, and a second tap took that road unread
    const armedAt = performance.now() + BOON_GUARD_MS;
    for (const id of Object.keys(ROUTES)) {
      const r = ROUTES[id], btn = document.createElement('button');
      btn.className = 'boon fork-choice';
      btn.dataset.route = id;
      btn.innerHTML = `<b>${escapeHtml(r.choice)}</b><small>${escapeHtml(r.desc)}</small>`;
      btn.classList.add('arming'); setTimeout(() => btn.classList.remove('arming'), BOON_GUARD_MS);
      btn.addEventListener('click', () => { if (performance.now() < armedAt) return; closeOverlay(false); Game.chooseRoute(id); });
      el.appendChild(btn);
    }
    const stay = document.createElement('button');
    stay.className = 'ghost small';
    stay.textContent = 'Not yet: stay on this floor';
    stay.addEventListener('click', () => closeOverlay());
    el.appendChild(stay);
  }
  function closeOverlay(next = true) {
    if (!overlay) return;
    if (overlay === 'boons' && Game.pendingBoons()) return;   // a choice must be made
    // an encounter must be answered: every one offers a way to leave, so
    // backing out would only be a free look at the odds
    if (overlay === 'encounter') { const e = Game.currentEncounter(); if (e && !e.result) return; Game.closeEncounter(); }
    if (overlay === 'shop') Game.closeShop();
    if (overlay === 'fork') Game.leaveFork();
    $('#ov-' + overlay).classList.remove('open');
    overlay = null;
    setBehind(false);
    syncHistory();
    const focused = /** @type {HTMLElement|null} */ (document.activeElement);
    if (focused && focused.blur) focused.blur();
    selectedItem = null; selectedSlot = null;
    // then whatever was waiting; each one closes itself if it is no longer wanted
    if (next && waiting.length) openOverlay(/** @type {string} */ (waiting.shift()));
  }
  /** Leaving the game: every overlay comes down, whatever it was holding. */
  function clearOverlays() {
    waiting = [];
    if (overlay === 'encounter') Game.closeEncounter();
    if (overlay === 'shop') Game.closeShop();
    $$('.overlay.open').forEach(el => el.classList.remove('open'));
    overlay = null;
    setBehind(false);
    selectedItem = null; selectedSlot = null;
  }
  function paused() { return !!overlay; }
  /** While an overlay is open the game behind it is inert: a screen reader or a Tab reaches only the overlay. */
  function setBehind(on) { const g = /** @type {HTMLElement|null} */ (document.querySelector('#screen-game .game-layout')); if (g) g.inert = on; }
  let helpFromMenu = false;   // the help was opened from the Menu mid-run: Back returns to it

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
      if (it) el.addEventListener('click', () => { selectedItem = it; selectedSlot = slot; renderInv(); });
      if (selectedItem === it && it) { el.classList.add('sel'); el.setAttribute('aria-pressed', 'true'); }
      else if (it) el.setAttribute('aria-pressed', 'false');
      (slots.includes(slot) ? eq : jewels).appendChild(el);
    }
    const grid = $('#inv-grid');
    grid.innerHTML = '';
    for (let i = 0; i < Game.INV_MAX; i++) {
      const it = p.inv[i];
      const el = slotEl(it, null);
      if (it) {
        el.addEventListener('click', () => { selectedItem = it; selectedSlot = null; renderInv(); });
        el.setAttribute('aria-pressed', String(selectedItem === it));
        if (selectedItem === it) el.classList.add('sel');
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
    const it = selectedItem;
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
    else if (it.curse) info += selectedSlot
      ? ' Cursed: it will not come off. Read a Scroll of Remove Curse, pray at a shrine, or pay a trader to lift it.'
      : ' Cursed: once worn, it will not come off until the curse is broken.';
    // rusted, or simply poorly made: the forge can put it right
    else if ((it.e || 0) < 0 && (b.kind === 'weapon' || b.kind === 'armor')) info += ' Worn or rusted: a trader\'s forge can mend it.';
    const why = (b.kind === 'weapon' || b.kind === 'armor' || b.kind === 'shield') ? Game.canEquip(it) : null;
    const compare = selectedSlot ? '' : compareText(it, b) + offhandText(it, b);
    // a relic spells out each power in full, then tells its story
    const r = Game.relicOf(it);
    // one of a pair: name the other, and say whether both are on
    const set = r && setOf(it.u) ? RELIC_SETS[setOf(it.u)] : null, mate = set ? set.pieces.find(u => u !== it.u) : '';
    const setLine = set ? `<p class="relic-set"><b>${escapeHtml(upFirst(set.name))}</b>, with ${escapeHtml(RELICS[mate].name)}. ${escapeHtml(set.text)}${Object.values(Game.player().eq).some(x => x && x.u === mate) && Object.values(Game.player().eq).some(x => x === it) ? ' (both worn)' : ''}</p>` : '';
    const legend = r ? `<ul class="relic-powers">${r.powers.map(k => `<li>${escapeHtml(RELIC_POWERS[k])}</li>`).join('')}</ul>${setLine}<p class="relic-lore">${escapeHtml(r.lore)}</p>`
      : (it.pw && !it.h && RELIC_POWERS[it.pw] ? `<ul class="relic-powers"><li>${escapeHtml(RELIC_POWERS[it.pw])}</li></ul>` : '');
    box.innerHTML = `<h3${r ? ' class="relic"' : ''}>${escapeHtml(Game.itemName(it))}</h3><p class="dim small">${escapeHtml(info)}${why ? ' <span style="color:#f88">' + escapeHtml(why) + '</span>' : ''}</p>${legend}${compare}<div class="buttons"></div>`;
    const btns = box.querySelector('.buttons');
    const add = (label, fn, cls) => { const bt = document.createElement('button'); bt.textContent = label; if (cls) bt.className = cls; bt.addEventListener('click', () => { fn(); selectedItem = null; selectedSlot = null; renderInv(); }); btns.appendChild(bt); };
    // a worn piece offers only taking it off, and a cursed one not even that
    if (selectedSlot) { if (!it.curse) add('Unequip', () => Game.unequip(selectedSlot)); }
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
    if (count() < before && overlay === 'inv') setTimeout(() => { if (overlay === 'inv') closeOverlay(); }, 0);
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
    const fmt = n => (n > 0 ? '+' : '') + (Math.round(n * 10) / 10);
    let label, delta;
    if (b.kind === 'weapon') {
      // the game's own damage rule, Ring of Might, path and all
      const now = Game.blowRate(cur), next = Game.blowRate(it);
      label = cur ? `vs ${Game.itemName({ ...cur, q: 1 })}` : 'vs bare hands';
      delta = next - now;
      return `<p class="compare ${delta >= 0 ? 'up' : 'down'}">${escapeHtml(label)}: ${fmt(delta)} damage per second</p>`;
    }
    // a focus is not measured in armour: its own words say what it does
    if (b.focus || (cur && ITEMS[cur.t].focus)) return '';
    const acOf = item => (item ? ITEMS[item.t].ac + knownE(item) + (item.px === 'sturdy' && !item.h ? 1 : 0) : 0);
    delta = acOf(it) - acOf(cur);
    label = cur ? `vs ${Game.itemName({ ...cur, q: 1 })}` : 'vs nothing worn';
    return `<p class="compare ${delta >= 0 ? 'up' : 'down'}">${escapeHtml(label)}: ${fmt(delta)} armour class</p>`;
  }

  // Colours and shapes the legend below the map also uses, so the two cannot
  // drift apart.
  const MAP_KEY = [
    { id: 'player', colour: '#ff6a50', label: 'You' },
    // shown only while a hound is with you on the floor
    { id: 'hound', colour: '#f2ecdc', label: 'Your companion' },
    { id: 'down', colour: '#ffd24a', label: 'Stairs down' },
    { id: 'up', colour: '#86d870', label: 'Stairs up' },
    { id: 'door', colour: '#c08a3e', label: 'Door' },
    { id: 'locked', colour: '#d0409a', label: 'Locked door' },
    { id: 'fountain', colour: '#49a6f0', label: 'Fountain' },
    { id: 'trader', colour: '#b57ae0', label: 'Trader' },
    { id: 'loot', colour: '#5ad0c0', label: 'Something here' },
    // the ground walked is the lighter, as paths are on any map: walls picked out
    // brighter than the floor read as the corridors at a glance
    { id: 'floor', colour: '#4a465e', label: 'Walked' },
    { id: 'wall', colour: '#2e2a3a', label: 'Wall' },
    { id: 'torch', colour: '#ffb45a', label: 'Torch (*)' },
  ];
  const MAP_COLOUR = Object.fromEntries(MAP_KEY.map(k => [k.id, k.colour]));

  const MAP_TILE_MAX = 28;
  function renderMap() {
    const L = Game.level(), p = Game.player();
    const c = $('#map-canvas');
    const T = Dungeon.T;
    // Fill the space available rather than assuming a tiny tile: a marker that
    // shifts only a few pixels per step reads as though nothing happened.
    let minX = L.w, minY = L.h, maxX = 0, maxY = 0, seen = 0;
    for (let y = 0; y < L.h; y++) {
      for (let x = 0; x < L.w; x++) {
        if (!L.explored[y * L.w + x]) continue;
        seen++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (!seen) { minX = p.x - 1; maxX = p.x + 1; minY = p.y - 1; maxY = p.y + 1; }
    const pad = 2;
    minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
    maxX = Math.min(L.w - 1, maxX + pad); maxY = Math.min(L.h - 1, maxY + pad);
    const cols = maxX - minX + 1, rows = maxY - minY + 1;
    // the height left once the heading, key and note have taken theirs; a short
    // landscape screen has little to spare, so it is measured, not guessed
    // (the body already stands clear of the heading and a phone's notch; its own
    // padding keeps it clear of the home bar)
    renderMapLegend();
    const body = /** @type {HTMLElement} */ ($('#ov-map .ov-body'));
    const outer = e => { if (!e) return 0; const st = getComputedStyle(e); return e.offsetHeight + parseFloat(st.marginTop) + parseFloat(st.marginBottom); };
    const bs = getComputedStyle(body), room = body.clientHeight - parseFloat(bs.paddingTop) - parseFloat(bs.paddingBottom);
    const keyH = outer($('#map-legend')) + outer(/** @type {HTMLElement} */ ($('#map-legend').nextElementSibling));
    // (less the canvas's border, and the gap a canvas leaves under itself as a line of text would)
    const availW = window.innerWidth - 24, availH = room > 0 ? room - keyH - 8 : window.innerHeight - 230;
    // ...but not so large that the first few squares of a floor read as a close-up
    // rather than the start of a map
    const size = Math.max(8, Math.min(MAP_TILE_MAX, Math.floor(Math.min(availW / cols, availH / rows))));
    c.width = cols * size; c.height = rows * size;
    c.style.width = c.width + 'px';
    const ox = minX * size, oy = minY * size;
    c.dataset.tile = String(size);
    c.dataset.originX = String(minX);
    c.dataset.originY = String(minY);
    $('#map-title').textContent = `Floor ${L.depth}: ${THEMES[L.theme].name}`;

    const ctx = c.getContext('2d');
    ctx.fillStyle = '#05050a';
    ctx.fillRect(0, 0, c.width, c.height);

    // a mark is set in a dark edge, so it stands out from walked ground and
    // wall alike however alike their tones (a third of the contrast it needs, otherwise)
    const edge = Math.max(1, Math.round(size / 10));
    const edged = (x, y, w, h, colour) => {
      ctx.fillStyle = '#0b0a10'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = colour; ctx.fillRect(x + edge, y + edge, w - edge * 2, h - edge * 2);
    };
    const glyph = (ch, x, y, colour) => {
      ctx.fillStyle = colour;
      ctx.font = `bold ${Math.round(size * 0.82)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ch, x * size - ox + size / 2, y * size - oy + size / 2 + 1);
    };

    for (let y = 0; y < L.h; y++) {
      for (let x = 0; x < L.w; x++) {
        const i = y * L.w + x;
        if (!L.explored[i]) continue;
        const t = L.tiles[i];
        let col = MAP_COLOUR.floor, mark = null, markColour = '#000';
        switch (t) {
          case T.WALL: case T.SECRET: col = MAP_COLOUR.wall; break;
          case T.TORCH: col = MAP_COLOUR.wall; mark = '*'; markColour = MAP_COLOUR.torch; break;
          case T.FLOOR: col = MAP_COLOUR.floor; break;
          case T.DOOR: col = MAP_COLOUR.door; mark = '+'; break;
          case T.DOOR_OPEN: col = '#7a5a34'; mark = "'"; break;
          case T.DOOR_LOCKED:
            col = MAP_COLOUR.locked;
            mark = '\u2716';
            markColour = KEY_COLORS[L.locks[x + ',' + y]] || '#fff';
            break;
          case T.STAIRS_DOWN: col = MAP_COLOUR.down; mark = '\u25bc'; break;
          case T.STAIRS_UP: col = MAP_COLOUR.up; mark = '\u25b2'; break;
          case T.FOUNTAIN: col = MAP_COLOUR.fountain; mark = '\u2248'; break;
        }
        if (col === MAP_COLOUR.floor || col === MAP_COLOUR.wall) { ctx.fillStyle = col; ctx.fillRect(x * size - ox, y * size - oy, size, size); }
        else edged(x * size - ox, y * size - oy, size, size, col);
        if (mark) glyph(mark, x, y, markColour);
      }
    }

    // anything worth walking back for
    for (const k in L.items) {
      const [x, y] = k.split(',').map(Number);
      if (!L.explored[y * L.w + x] || !L.items[k].length) continue;
      edged(x * size - ox + size * 0.25, y * size - oy + size * 0.25, size * 0.5, size * 0.5, MAP_COLOUR.loot);
    }
    for (const n of (L.npcs || [])) {
      if (!L.explored[n.y * L.w + n.x]) continue;
      edged(n.x * size - ox, n.y * size - oy, size, size, MAP_COLOUR.trader);
      glyph('\u00a4', n.x, n.y, '#2a1a38');
    }

    // the hound, where it waits or walks at your heel
    const hound = houndHere();
    if (hound) {
      const hx = hound.x * size - ox + size / 2, hy = hound.y * size - oy + size / 2;
      ctx.fillStyle = '#0b0a10'; ctx.beginPath(); ctx.arc(hx, hy, size * 0.42, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = MAP_COLOUR.hound; ctx.beginPath(); ctx.arc(hx, hy, size * 0.42 - edge, 0, Math.PI * 2); ctx.fill();
    }
    const hk = /** @type {HTMLElement|null} */ ($('#map-legend [data-key="hound"]'));
    if (hk) hk.hidden = !hound;

    // The player owns one whole square, ringed so the eye finds it at a glance,
    // with the arrow inside it showing which way they face.
    const cx = p.x * size - ox + size / 2, cy = p.y * size - oy + size / 2;
    ctx.fillStyle = '#ff6a50';
    ctx.fillRect(p.x * size - ox, p.y * size - oy, size, size);
    ctx.strokeStyle = '#fff3e0';
    ctx.lineWidth = Math.max(1, size * 0.12);
    ctx.strokeRect(p.x * size - ox + 0.5, p.y * size - oy + 0.5, size - 1, size - 1);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(p.dir * Math.PI / 2);
    ctx.fillStyle = '#2a0f08';
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.3);
    ctx.lineTo(size * 0.26, size * 0.26);
    ctx.lineTo(-size * 0.26, size * 0.26);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** The hound, if it is on this floor and standing. */
  function houndHere() {
    const c = Game.companion(), L = Game.level();
    return c && !c.fallen && c.depth === L.depth ? c : null;
  }
  function renderMapLegend() {
    const el = $('#map-legend');
    if (!el || el.childElementCount) return;      // built once
    el.innerHTML = MAP_KEY.map(k =>
      `<span class="key" data-key="${k.id}"><i style="background:${k.colour}"></i>${escapeHtml(k.label)}</span>`).join('');
  }

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

  function renderChar() {
    const p = Game.player(), c = CLASSES[p.cls], G = Game.state();
    const w = Game.weapon();
    const rows = [];
    const r = (k, v, full) => rows.push(`<div class="${full ? 'full' : ''}">${k}<span>${v}</span></div>`);
    const path = Game.pathOf();
    r('Name', escapeHtml(p.name)); r('Class', path ? `${c.name}, ${escapeHtml(path.name)}` : c.name);
    r('Hero level', p.level); r('Experience', `${p.xp} / ${p.level < MAX_LEVEL ? XP_TABLE[p.level] : '—'}`);
    r('Hit points', `${p.hp} / ${p.maxHp}`); r('Spell points', p.maxSp ? `${p.sp} / ${p.maxSp}` : '—');
    r('Armour class', Game.playerAC()); r('To hit', (Game.toHit() >= 0 ? '+' : '') + Game.toHit());
    // named as the pack names it, and the damage one figure with the make folded in, as the pack shows it
    const wAdd = w.dmg[2] + w.e + (w.px === 'heavy' ? 1 : 0), wIt = Game.player().eq.weapon;
    r('Weapon', `${wIt ? Game.itemName(wIt).replace(/ [+\u2212−]\d+$/, '') : 'Fists'} ${w.dmg[0]}d${w.dmg[1]}${wAdd > 0 ? '+' + wAdd : wAdd < 0 ? '\u2212' + -wAdd : ''}`, true);
    r('Gold', p.gold);
    for (const k in STAT_NAMES) { const m = Game.mod(p.stats[k]); r(STAT_NAMES[k], `${p.stats[k]} (${m >= 0 ? '+' : ''}${m})`); }
    r('Kills', p.kills); r('Steps', p.steps);
    r('Deepest floor', p.deepest); r('Seed', escapeHtml(G.seed));
    r('Background', BACKGROUNDS[p.bg] ? `${BACKGROUNDS[p.bg].name}: ${BACKGROUNDS[p.bg].perk}` : '—', true);
    r('Pages found', `${Game.journal().length} of ${Game.pagesInDungeon()}`, true);
    let extra = '';
    // the path taken, or the two still ahead
    const paths = PATHS[p.cls] || [];
    if (path) extra += `<h3 class="sheet-h">Path</h3><div class="path-sheet" data-path="${path.id}">${pathCard(path)}</div>`;
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
    $('#char-sheet').innerHTML = `<div class="sheet">${rows.join('')}</div>${extra}`;
  }

  // Text size scales the whole interface from the root, so every rem follows.
  const TEXT_SIZES = [{ label: 'Small', px: 14 }, { label: 'Normal', px: 16 }, { label: 'Large', px: 20 }];
  function textSize() { const raw = store('deepdelve.textSize'), v = Number(raw); return raw !== null && Number.isInteger(v) && v >= 0 && v < TEXT_SIZES.length ? v : 1; }
  function setTextSize(i) {
    store('deepdelve.textSize', String(i));
    document.documentElement.style.fontSize = TEXT_SIZES[i].px + 'px';
    fitView();
  }
  function renderMenu() {
    const G = Game.state();
    // under permadeath there is no going back, and a save made when the app
    // was put away must not become a checkpoint to reload before a gamble
    $('#m-load').disabled = !Game.hasSave() || !!G.opts.permadeath;
    // so under permadeath there is no Load to grey out beside Save: Save only
    // keeps the run for Continue, and says so
    $('#m-load').hidden = !!G.opts.permadeath;
    $('#m-save').textContent = G.opts.permadeath ? 'Save for Continue' : 'Save Game';
    $('#m-sound').textContent = 'Sound: ' + (Sound.isEnabled() ? 'On' : 'Off');
    // the music plays through the sound: with the sound off it is silent whatever it says
    $('#m-music').textContent = 'Music: ' + (Music.isEnabled() ? (Sound.isEnabled() ? 'On' : 'On (sound is off)') : 'Off');
    $('#m-rolls').textContent = 'Combat rolls: ' + (Game.rollsShown() ? 'On' : 'Off');
    $('#m-text').textContent = 'Text size: ' + TEXT_SIZES[textSize()].label;
    $('#m-tips').textContent = 'Tips: ' + (tipsOn() ? 'On' : 'Off');
    $('#m-calm').textContent = 'Calm view: ' + (calmOn() ? 'On' : 'Off');
    $('#m-hand').textContent = 'Controls: ' + (lefty() ? 'left-handed' : 'right-handed');
    $('#m-seed').textContent = `${G.opts.daily ? `Daily Delve ${G.opts.daily} · ` : ''}Seed "${G.seed}" · ${diffName(diffOf(G.opts))} · ${G.opts.levels} floors${G.route && ROUTES[G.route] ? ` · by ${ROUTES[G.route].name}` : ''} · ${G.opts.size} · ${G.opts.permadeath ? 'permadeath' : 'reload allowed'}`;
  }

  // ---------- end screens ----------
  // The run told back: a few lines in the log's voice, then pictures and names, numbers last.
  const aName = (id, name) => MONSTERS[id] && (MONSTERS[id].boss || MONSTERS[id].named) ? `the ${name}` : `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`;
  /** "Grisk, the Goblin King": a named champion by its own name. */
  const namedTitle = id => `${MONSTERS[id].named.called}, the ${MONSTERS[id].name}`;
  /** A few lines about the run, the notable parts only, in the log's voice. */
  function runHighlights(G, won) {
    const s = Game.runStats(), p = G.player, out = [];
    const b = s.best;
    if (b) out.push(`Your best blow: <b>${b.dmg}</b> to ${escapeHtml(aName(b.id, b.to))}, with ${escapeHtml(b.how)}.`);
    else out.push('You never landed a blow.');
    const w = s.worst;
    if (w) out.push(w.from ? `The hardest hit you took: <b>${w.dmg}</b>, from ${escapeHtml(aName(w.id, w.from))}.` : `The hardest hit you took: <b>${w.dmg}</b>, and no monster dealt it.`);
    else out.push('Nothing so much as scratched you.');
    // the named champions cut down are told by name
    const named = Object.keys(s.kills).filter(id => MONSTERS[id] && MONSTERS[id].named);
    if (named.length) out.push(`You cut down <b>${named.map(id => escapeHtml(namedTitle(id))).join('</b> and <b>')}</b>.`);
    // the pictures below carry no names, so the kind that fell most often gets one here
    const kills = Object.entries(s.kills).filter(([id]) => MONSTERS[id]).sort((x, y) => y[1] - x[1]);
    if (kills.length && kills[0][1] >= 3) out.push(`The ${escapeHtml(MONSTERS[kills[0][0]].name)}s came off worst: <b>${kills[0][1]}</b> never got up.`);
    // the floor that cost the most, when there was more than one to compare
    const floors = Object.keys(s.hurtOn).map(Number).filter(f => s.hurtOn[f] > 0);
    if (floors.length > 1) {
      const worst = floors.reduce((a, f) => (s.hurtOn[f] > s.hurtOn[a] ? f : a));
      out.push(`Floor ${worst} took the most out of you: <b>${s.hurtOn[worst]}</b> of the ${s.taken} hit points you lost.`);
    }
    const casts = Object.entries(s.spells).sort((x, y) => y[1] - x[1]);
    if (casts.length) {
      const own = SPELLS[p.cls] || [];
      const nameOf = id => { const sp = own.find(x => x && x.id === id); return sp ? sp.name : id; };
      const total = casts.reduce((n, [, k]) => n + k, 0);
      const [topId, topN] = casts[0];
      out.push(casts.length === 1
        ? `You cast ${escapeHtml(nameOf(topId))} ${topN === 1 ? 'once' : `<b>${topN}</b> times`}, and nothing else.`
        : (topN * 2 > total
          ? `You cast <b>${total}</b> spells, most of them ${escapeHtml(nameOf(topId))}.`
          : `You cast <b>${total}</b> spells, ${escapeHtml(nameOf(topId))} more than any other.`));
    }
    // dying with the cure in your pack is worth a word
    const heals = !won ? p.inv.filter(it => ITEMS[it.t] && ITEMS[it.t].kind === 'potion' && ITEMS[it.t].effect === 'heal') : [];
    const healing = heals.reduce((n, it) => n + it.q, 0), unknown = heals.filter(it => !Game.isKnown(it.t)).reduce((n, it) => n + it.q, 0);
    // and the ones it never knew for healing get that said, now it no longer matters
    if (healing) out.push(`You died with ${healing === 1 ? 'a healing potion' : `<b>${healing}</b> healing potions`} still in your pack${unknown ? (unknown === healing ? `, not knowing ${healing === 1 ? 'it' : 'them'} for what ${healing === 1 ? 'it was' : 'they were'}` : `, ${unknown} of them never known for what they were`) : ''}.`);
    else if (s.potions) out.push(`You drank ${s.potions === 1 ? 'one potion' : `<b>${s.potions}</b> potions`}${s.scrolls ? ` and read ${s.scrolls === 1 ? 'one scroll' : `<b>${s.scrolls}</b> scrolls`}` : ''}.`);
    return out;
  }
  /** The summary block: highlights, the kills as pictures, talents, relics, totals. */
  function renderSummary(G, won) {
    const s = Game.runStats(), p = G.player, parts = [];
    parts.push('<div class="end-h"><span>The run</span></div><ul class="end-lines">' + runHighlights(G, won).map(l => `<li>${l}</li>`).join('') + '</ul>');
    // most killed first; a tie goes to the tougher kind
    const kills = Object.entries(s.kills).filter(([id]) => MONSTERS[id]).sort((a, b) => b[1] - a[1] || MONSTERS[b[0]].xp - MONSTERS[a[0]].xp);
    if (kills.length) {
      parts.push('<div class="end-h"><span>Slain</span></div><div class="end-kills">' + kills.map(([id, n]) => {
        const mb = MONSTERS[id], base = Assets.sprites[mb.sprite], art = (mb.named && base && base.elite && base.elite[id]) || base;
        const label = `${mb.named ? namedTitle(id) : mb.name} \u00d7${n}`;
        return `<div class="kill" data-kill="${id}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}"><img src="${art ? art.url : ''}" alt=""><span>\u00d7${n}</span></div>`;
      }).join('') + '</div>');
    } else parts.push('<p class="end-none">Nothing died by your hand.</p>');
    const own = TALENTS[p.cls] || [];
    const path = Game.pathOf(p);
    if (path) parts.push(`<div class="end-h"><span>Path</span></div><div class="end-tags"><span class="tag path">${escapeHtml(path.name)}</span></div>`);
    const talents = (p.talents || []).map(id => own.find(t => t.id === id)).filter(Boolean);
    if (talents.length) parts.push('<div class="end-h"><span>Talents</span></div><div class="end-tags">' + talents.map(t => `<span class="tag">${escapeHtml(t.name)}</span>`).join('') + '</div>');
    // and the smaller lessons of each level, a count where one was learnt more than once
    const learnt = new Map();
    for (const id of p.boons || []) { const b = BOONS.find(x => x.id === id); if (b) learnt.set(b.name, (learnt.get(b.name) || 0) + 1); }
    if (learnt.size) parts.push('<div class="end-h"><span>Lessons</span></div><div class="end-tags">' + [...learnt].map(([name, n]) => `<span class="tag">${escapeHtml(name)}${n > 1 ? ` \u00d7${n}` : ''}</span>`).join('') + '</div>');
    const relics = ((G.relics && G.relics.found) || []).filter(id => RELICS[id]);
    if (relics.length) parts.push('<div class="end-h"><span>Relics found</span></div><div class="end-tags">' + relics.map(id => `<span class="tag relic">${escapeHtml(upFirst(RELICS[id].name))}</span>`).join('') + '</div>');
    parts.push(`<div class="end-totals"><div><b>${s.dealt}</b><small>damage dealt</small></div><div><b>${s.taken}</b><small>damage taken</small></div><div><b>${s.healed}</b><small>healed</small></div></div>`);
    $('#end-summary').innerHTML = parts.join('');
  }

  /**
   * One line to paste anywhere: the seed and every choice left off its usual
   * setting, since the same seed with other choices is another dungeon, and any vow sworn.
   */
  function runShareLine(won) {
    const G = Game.state(), p = G.player, o = G.opts;
    const ways = [diffName(diffOf(o))];
    if (o.levels && o.levels !== 8) ways.push(`${o.levels} floors`);
    if (o.size && o.size !== 'medium') ways.push(`${o.size} halls`);
    if (o.monsters && o.monsters !== 'normal') ways.push(`${o.monsters} monsters`);
    if (o.treasure && o.treasure !== 'normal') ways.push(`${o.treasure} treasure`);
    if (o.lockedDoors === false) ways.push('no locked doors');
    if (o.traps === false) ways.push('no traps');
    // a vow leaves the dungeon as it is, but it is half of what the run was
    for (const v of o.vows || []) if (VOWS[v]) ways.push(VOWS[v].name);
    const cls = CLASSES[p.cls] ? CLASSES[p.cls].name : p.cls;
    // and where to play it, when it is being played somewhere a friend can reach
    const where = location.protocol === 'https:' ? ` ${location.origin}${location.pathname}` : '';
    return `Deepdelve seed ${G.seed} (${ways.join(', ')}): ${cls}, ${won ? 'claimed the Heart' : `fell on floor ${G.depth}`}, ${p.kills} kill${p.kills === 1 ? '' : 's'}, score ${Game.score(p, G.depth, won)}${where}`;
  }
  /** What the share card says of this run, and the picture it shows. */
  function cardInfo(won) {
    const G = Game.state(), p = G.player, o = G.opts;
    const k = Game.lastAttacker(), mb = k && k.id ? MONSTERS[k.id] : null;
    const pic = s => (s && s.levels ? s.levels[0] : s) || null;
    let art = null, killer = '';
    if (won) { art = pic(Assets.sprites.artifact); killer = 'and brought down the Dread Lich'; }
    else if (mb) {
      const s = Assets.sprites[mb.sprite];
      art = pic(mb.named && s && s.elite && s.elite[k.id] ? s.elite[k.id] : s);
      killer = `to ${mb.named || /^the /i.test(k.name) ? k.name : `${/^[aeiou]/i.test(k.name) ? 'an' : 'a'} ${k.name.toLowerCase()}`}`;
    } else {
      art = pic(Assets.sprites.bone_heap);
      if (k) killer = `to ${k.name.replace(/^[A-Z](?=[a-z])/, c => (k.encounter ? c : c.toLowerCase()))}`;
    }
    // a hound still at the hero's side at the end stands in the picture with them
    // (not one told to stay floors above). Beside a killer it read as the killer's
    // dog, so on a death it is named, not drawn
    const c = G.companion, hound = c && !c.fallen && c.depth === G.depth ? { name: c.name, word: c.kind === 'goblin' ? 'goblin' : 'hound', art: won ? pic(Assets.sprites[c.kind === 'goblin' ? 'scrag' : 'dog'] || Assets.sprites.dog) : null } : null;
    const mode = [diffName(diffOf(o)), `${o.levels || 8} floors`, ...(o.vows || []).filter(v => VOWS[v]).map(v => VOWS[v].name)];
    return {
      won, art, killer, hound,
      hero: `${p.name} the ${(Game.pathOf(p) || CLASSES[p.cls]).name}`,
      outcome: won ? 'Claimed the Heart' : `Fell on floor ${G.depth}`,
      stats: `Level ${p.level} \u00b7 ${p.kills} kill${p.kills === 1 ? '' : 's'} \u00b7 score ${Game.score(p, G.depth, won)}`,
      mode: mode.join(' \u00b7 '),
      seed: String(G.seed),
      date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    };
  }
  function showEnd(won) {
    const G = Game.state(), p = G.player;
    clearOverlays();
    $('#end-title').textContent = won ? 'VICTORY' : 'YOU HAVE DIED';
    $('#end-text').textContent = won
      ? `${p.name} the ${(Game.pathOf(p) || CLASSES[p.cls]).name} brought down the Dread Lich and lifted the Heart of the Mountain.`
      : `${G.opts.permadeath ? 'The save has been erased.' : ''}`;   // where they fell, the epilogue below says
    // a first win for this class at this difficulty, and any past it opened
    const earned = won ? Game.earned() : null, news = [];
    if (earned && earned.first && CLASSES[earned.cls]) news.push(`First win as a ${CLASSES[earned.cls].name} on ${diffName(earned.difficulty)}!${earned.difficulty === 'hard' ? ` The ${CLASSES[earned.cls].plural} will call you ${CLASSES[earned.cls].title}.` : ''}`);
    for (const k of (earned && earned.classesOpened) || []) if (CLASSES[k]) news.push(`A ${CLASSES[k].name} will come to your fire now: a new class on the New Game screen.`);
    for (const id of (earned && earned.unlocked) || []) if (BACKGROUNDS[id]) news.push(`${BACKGROUNDS[id].name} can now be chosen for a new hero.`);
    if (earned && earned.firstPath) { const x = Object.values(PATHS).flat().find(q => q.id === earned.firstPath); if (x) news.push(`First win on the ${x.name}'s path!`); }
    for (const id of (earned && earned.firstVows) || []) if (VOWS[id]) news.push(`The ${VOWS[id].name} kept to the end: a trophy of its own.`);
    for (const id of (earned && earned.firstFeats) || []) if (FEATS[id]) news.push(`${FEATS[id].name}: a feat, and a trophy of its own.`);
    if (earned && earned.vowsOpened) news.push('Vows are open: a new hero can swear one for a harder run.');
    if (earned && earned.reloadable) news.push('Trophies are for a win on one life: tick Permadeath to earn one.');
    // and the next thing to aim for, while a past is still locked
    else if (won) {
      const next = Object.keys(BACKGROUNDS).find(id => BACKGROUNDS[id].unlock && !Progress.bgOpen(id));
      if (next) news.push(`Win on ${BACKGROUNDS[next].unlock === 'hard' ? 'Hard' : 'Normal or Hard'} to open ${BACKGROUNDS[next].name}.`);
    }
    $('#end-trophy').textContent = news.join(' ');
    $('#end-trophy').style.display = news.length ? '' : 'none';
    const rows = [['Hero level', p.level], ['Experience', p.xp], ['Gold', p.gold], ['Kills', p.kills], ['Steps', p.steps], ['Deepest floor', p.deepest]];
    // time spent underground, by the game's own clock
    const secs = Math.round(G.t / 1000);
    rows.push(['Time', `${Math.floor(secs / 60)}m ${String(secs % 60).padStart(2, '0')}s`]);
    rows.unshift(['Score', Game.score(p, G.depth, won)]);
    rows.push(['Seed', G.seed]);
    $('#end-stats').innerHTML = rows.map(([k, v]) => `<div>${k}<span>${escapeHtml(String(v))}</span></div>`).join('');
    renderSummary(G, won);
    const cause = $('#end-cause');
    const killer = Game.lastAttacker();
    if (!won && killer && killer.encounter) {
      cause.innerHTML = `Died at <b>${escapeHtml(killer.name)}</b>, when a choice went wrong (${killer.dmg} damage).`;
    } else if (!won && killer && killer.cause) {
      cause.innerHTML = `Killed by <b>${escapeHtml(killer.name)}</b> (${killer.dmg} damage).`;
    } else if (!won && killer) {
      // "an ogre", as the lines below it say; a champion keeps its own name
      const who = killer.name.includes(',') || /^the /i.test(killer.name) ? killer.name : `${/^[aeiou]/i.test(killer.name) ? 'an' : 'a'} ${killer.name.toLowerCase()}`;
      cause.innerHTML = `Killed by <b>${escapeHtml(who)}</b>, striking ${escapeHtml(killer.bearing)} for ${killer.dmg}.`;
    } else if (!won) {
      cause.textContent = 'Killed by the dungeon itself.';
    } else cause.textContent = '';
    const moments = Game.deathLog();
    $('#end-final').style.display = (!won && moments.length) ? '' : 'none';
    $('#end-final-log').innerHTML = moments.map(m => `<p>${escapeHtml(m)}</p>`).join('');
    $('#end-epilogue').innerHTML = Game.epilogue(won).map(t => `<p>${escapeHtml(t)}</p>`).join('');
    $('#end-load').style.display = (!won && !G.opts.permadeath && Game.hasSave()) ? '' : 'none';
    // any run can be told in one line: a daily one with its streak, another with
    // its seed, so a friend can walk the same halls
    $('#end-share').style.display = '';
    $('#end-card').style.display = '';
    $('#end-card').textContent = 'Share a picture';
    $('#end-share').textContent = G.opts.daily ? 'Share today\'s result' : 'Share this run';
    $('#end-share-line').style.display = 'none';
    showScreen('screen-end');
    $('#screen-end').scrollTop = 0;   // a second death, or the win, opens at its title, not where the last was left
  }

  // ---------- input ----------
  function bindControls() {
    for (const b of $$('.ctl[data-act]')) {
      const act = b.dataset.act;
      const down = e => { e.preventDefault(); Sound.unlock(); try { b.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } held.set(act, performance.now()); b.classList.add('held'); Game.input(act); };
      const up = e => { if (e) e.preventDefault(); held.delete(act); b.classList.remove('held'); };
      b.addEventListener('pointerdown', down);
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', up);
      b.addEventListener('contextmenu', e => e.preventDefault());
    }
    for (const b of $$('[data-tap]')) {
      b.addEventListener('click', () => { Sound.unlock(); Game.input(b.dataset.tap); });
    }
    for (const b of $$('[data-open]')) b.addEventListener('click', () => { Sound.unlock(); openOverlay(b.dataset.open); });
    $('#minimap').addEventListener('click', () => openOverlay('map'));
    // a tip goes at a tap on it, and the tap goes no further
    $('#tip').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); $('#tip').classList.remove('show'); tipUntil = performance.now(); });
    $('#log-more').addEventListener('click', () => openOverlay('log'));

    // Tap the view to act, swipe to turn or step.
    const view = $('#view');
    let swipe = null;
    view.addEventListener('pointerdown', e => { e.preventDefault(); Sound.unlock(); swipe = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    view.addEventListener('pointerup', e => {
      if (!swipe) return;
      const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
      const dist = Math.hypot(dx, dy);
      swipe = null;
      if (dist < 24) { Game.input('use'); return; }
      if (Math.abs(dx) > Math.abs(dy)) Game.input(dx > 0 ? 'right' : 'left');
      else Game.input(dy < 0 ? 'forward' : 'back');
    });
    view.addEventListener('pointercancel', () => { swipe = null; });
    for (const b of $$('[data-close]')) b.addEventListener('click', () => closeOverlay());
    $('#m-save').addEventListener('click', () => { Game.save(); closeOverlay(); });
    // a save code: the hero as text, to carry to another phone or browser
    $('#m-code').addEventListener('click', () => openOverlay('code'));
    $('#code-copy').addEventListener('click', async () => {
      const code = /** @type {HTMLTextAreaElement} */ ($('#code-out')).value;
      if (!code) return;
      $('#code-note').textContent = (await copyText(code)) ? 'Copied: paste it on the other phone or browser.' : 'Could not copy it: select the code and copy it by hand.';
    });
    $('#code-file').addEventListener('click', () => {
      const code = /** @type {HTMLTextAreaElement} */ ($('#code-out')).value;
      if (!code) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([code], { type: 'text/plain' }));
      const plain = Game.player().name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/æ/gi, 'ae').replace(/ø/gi, 'o').toLowerCase();
      a.download = `deepdelve-${plain.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'hero'}-floor-${Game.state().depth}.txt`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      $('#code-note').textContent = 'Saved as a file: open it on the other phone or browser.';
    });
    // Load sits under Save, and one slip rewinds the run: the first tap asks
    let loadArmed = 0;
    $('#m-load').addEventListener('click', () => {
      const b = $('#m-load');
      if (performance.now() > loadArmed) {
        loadArmed = performance.now() + 3000;
        b.textContent = 'Tap again to go back to your save';
        setTimeout(() => { if (performance.now() >= loadArmed) b.textContent = 'Load Game'; }, 3050);
        return;
      }
      loadArmed = 0; b.textContent = 'Load Game';
      if (Game.load()) startPlaying();
    });
    $('#m-sound').addEventListener('click', () => { Sound.toggle(); renderMenu(); });
    $('#m-music').addEventListener('click', () => { Music.toggle(); renderMenu(); });
    $('#m-rolls').addEventListener('click', () => { Game.toggleRolls(); renderMenu(); });
    $('#m-text').addEventListener('click', () => { setTextSize((textSize() + 1) % TEXT_SIZES.length); renderMenu(); });
    // turning tips back on starts them over, for a player who wants the tour again
    $('#m-calm').addEventListener('click', () => { store(CALM, calmOn() ? '0' : '1'); Renderer.setCalm(calmOn()); renderMenu(); });
    $('#m-hand').addEventListener('click', () => { store(HAND, lefty() ? 'right' : 'left'); setHand(); renderMenu(); fitView(); });
    $('#m-tips').addEventListener('click', () => { if (tipsOn()) store(TIPS_OFF, '1'); else { store(TIPS_OFF, null); store(TIPS_SEEN, null); tipsSeen = null; } resetTips(); renderMenu(); });
    // How to Play in the middle of a run: the run is kept first (a phone may
    // close a page it cannot see), and Back returns to the Menu, still paused,
    // rather than straight into a blow that was already falling
    $('#m-help').addEventListener('click', () => {
      if (Game.state() && Game.state().status === 'playing') Game.save(true);
      closeOverlay(); helpFromMenu = true; showScreen('screen-help');
    });
    $('#m-quit').addEventListener('click', () => { Game.save(true); closeOverlay(); showScreen('screen-title'); });

    const KEYS = { ArrowUp: 'forward', KeyW: 'forward', ArrowDown: 'back', KeyS: 'back', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', KeyQ: 'strafeL', KeyE: 'strafeR', Space: 'attack', KeyF: 'attack' };
    const TAPS = { KeyU: 'use', KeyC: 'cast', KeyR: 'rest', KeyX: 'quaff', KeyZ: 'read' };
    const OPENS = { KeyM: 'map', KeyI: 'inv', KeyP: 'spells', KeyH: 'char', KeyJ: 'journal' };
    window.addEventListener('keydown', e => {
      const target = /** @type {HTMLElement} */ (e.target);
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT')) return;
      // Escape leaves the help as Back does
      if (e.code === 'Escape' && $('#screen-help').classList.contains('active')) { $('#help-back').click(); e.preventDefault(); return; }
      if (!$('#screen-game').classList.contains('active')) return;
      if (e.code === 'Escape') { if (overlay) closeOverlay(); else openOverlay('menu'); e.preventDefault(); return; }
      if (overlay) { if (OPENS[e.code] === overlay) closeOverlay(); return; }
      if (KEYS[e.code]) { e.preventDefault(); if (!e.repeat) { held.set(KEYS[e.code], performance.now()); Game.input(KEYS[e.code]); } }
      else if (TAPS[e.code]) { e.preventDefault(); if (!e.repeat) Game.input(TAPS[e.code]); }   // held R is one rest, not three
      else if (OPENS[e.code]) { e.preventDefault(); openOverlay(OPENS[e.code]); }
    });
    window.addEventListener('keyup', e => { if (KEYS[e.code]) held.delete(KEYS[e.code]); });
    window.addEventListener('blur', () => held.clear());
  }
  let attackBtn = null, atkShown = -1;
  function pumpHeld() {
    if (overlay) return;
    const atk = attackBtn || (attackBtn = document.querySelector('.ctl.attack'));
    if (atk) { const r = Math.round(Game.attackReady() * 20) / 20; if (r !== atkShown) { atkShown = r; atk.style.setProperty('--ready', String(r)); atk.classList.toggle('cooling', r < 1); } }
    const now = performance.now();
    // turning is one quarter per press, never repeated: a held turn used to
    // carry on round into an about-face nobody asked for
    for (const [act, at] of held) if (act !== 'left' && act !== 'right' && now - at >= HOLD_DELAY) Game.input(act, true);
  }

  /** A daily run's end is kept at once, before any finale, in case the phone is put away. */
  function noteDaily(run, won) {
    if (!run.opts.daily) return;
    const p = run.player;
    Daily.finish(run.opts.daily, { won, depth: run.depth, kills: p.kills, cls: p.cls, score: Game.score(p, run.depth, won) });
  }
  function handleEvents() {
    for (const e of Game.takeEvents()) {
      if (e === 'boons') { if (overlay === 'boons') renderBoons(); else openOverlay('boons'); }
      else if (e === 'boonsDone') { if (overlay === 'boons') closeOverlay(); }
      else if (e === 'page' && overlay === 'journal') renderJournal();
      else if (e === 'shop') openOverlay('shop');
      else if (e === 'fork') { if (Game.forkPending() && Game.state().status === 'playing') openOverlay('fork'); }
      else if (e === 'encounter') { if (overlay === 'encounter') renderEncounter(); else if (Game.currentEncounter()) openOverlay('encounter'); }
      // the view goes dark a moment first, then the end screen, for this run only
      else if (e === 'dead') {
        const run = Game.state();
        noteDaily(run, false);
        clearTimeout(finaleTimer);
        finaleTimer = setTimeout(() => { if (Game.state() === run && run.status === 'dead' && $('#screen-game').classList.contains('active')) showEnd(false); }, 1200);
      }
      // the Heart's light fills the view first, then the victory screen; only
      // for this run, and only if it is still on screen when the light is done
      else if (e === 'won') {
        const run = Game.state();
        noteDaily(run, true);
        clearTimeout(finaleTimer);
        finaleTimer = setTimeout(() => { if (Game.state() === run && run.status === 'won' && $('#screen-game').classList.contains('active')) showEnd(true); }, Game.finaleLeft());
      }
      else if (e === 'inv') { if (overlay === 'inv') renderInv(); else if (overlay === 'shop') renderShop(); }
      else if (e === 'stats' && overlay === 'shop') renderShop();
    }
  }

  function init() {
    // a state left from before a reload stands for nothing now
    try { if (histState()) history.replaceState(null, ''); } catch (e) { /* ignore */ }
    window.addEventListener('popstate', onBack);
    // each overlay is a dialog, named by its heading, for a screen reader
    for (const ov of $$('.overlay')) {
      ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
      const h = ov.querySelector('h2');
      if (h) { if (!h.id) h.id = ov.id + '-title'; ov.setAttribute('aria-labelledby', h.id); }
    }
    Renderer.setCalm(calmOn());
    setHand();
    // until Calm view is chosen in the menu, it follows the phone's setting as that changes
    try { const mq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)'); if (mq && mq.addEventListener) mq.addEventListener('change', () => Renderer.setCalm(calmOn())); } catch (e) { /* older browsers */ }
    buildCreate();
    $('#c-seed').value = randomSeedWord();
    $('#btn-new').addEventListener('click', () => { Sound.unlock(); startNewGameFlow(); });
    $('#btn-continue').addEventListener('click', () => { Sound.unlock(); if (Game.load()) startPlaying(); });
    $('#btn-help').addEventListener('click', () => { helpFromMenu = false; showScreen('screen-help'); });
    $('#news-close').addEventListener('click', newsSeen);
    // a hero carried over from another device, in place of any waiting here
    $('#btn-code').addEventListener('click', () => {
      /** @type {HTMLTextAreaElement} */ ($('#code-in')).value = '';
      $('#code-why').textContent = '';
      const s = Game.saveSummary();
      $('#code-warn').textContent = s ? `This replaces ${s.name} the ${s.cls}, waiting for you on floor ${s.depth}.` : '';
      showScreen('screen-code');
    });
    $('#code-back').addEventListener('click', () => showScreen('screen-title'));
    $('#code-open').addEventListener('click', () => $('#code-pick').click());
    $('#code-pick').addEventListener('change', async () => {
      const pick = /** @type {HTMLInputElement} */ ($('#code-pick')), f = pick.files && pick.files[0];
      if (f) /** @type {HTMLTextAreaElement} */ ($('#code-in')).value = await f.text();
      pick.value = '';
    });
    $('#code-load').addEventListener('click', async () => {
      Sound.unlock();
      const b = /** @type {HTMLButtonElement} */ ($('#code-load'));
      b.disabled = true;
      const r = await Game.loadCode(/** @type {HTMLTextAreaElement} */ ($('#code-in')).value);
      b.disabled = false;
      if (r.ok) startPlaying(); else $('#code-why').textContent = r.why || 'That code would not load.';
    });
    $('#btn-hall').addEventListener('click', () => { renderHall(); showScreen('screen-hall'); });
    $('#btn-beasts').addEventListener('click', () => { $('#beasts-count').textContent = renderBestiary($('#beasts-list')); showScreen('screen-beasts'); });
    $('#beasts-back').addEventListener('click', () => showScreen('screen-title'));
    for (const t of $$('[data-jtab]')) t.addEventListener('click', () => { journalTab = t.dataset.jtab; renderJournal(); });
    $('#hall-back').addEventListener('click', () => showScreen('screen-title'));
    $('#hall-relics').addEventListener('click', () => { $('#relics-count').textContent = renderCodex($('#relics-list')); showScreen('screen-relics'); });
    $('#relics-back').addEventListener('click', () => { renderHall(); showScreen('screen-hall'); });
    // the help is split into pages, so a first look is a page, not a wall
    for (const t of $$('[data-htab]')) t.addEventListener('click', () => helpTab(t.dataset.htab));
    $('#help-back').addEventListener('click', () => {
      const playing = !!(Game.state() && Game.state().status === 'playing');
      showScreen(playing ? 'screen-game' : 'screen-title');
      if (playing && helpFromMenu) openOverlay('menu');
      helpFromMenu = false;
    });
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
    $('#c-back').addEventListener('click', () => showScreen('screen-title'));
    $('#c-begin').addEventListener('click', beginGame);
    $('#pro-begin').addEventListener('click', commitGame);
    $('#end-load').addEventListener('click', () => { if (Game.load()) startPlaying(); });
    $('#end-new').addEventListener('click', () => startNewGameFlow());
    $('#confirm-keep').addEventListener('click', () => { if (Game.load()) startPlaying(); });
    $('#confirm-replace').addEventListener('click', startPending);
    $('#btn-quick').addEventListener('click', () => { Sound.unlock(); startNewGameFlow('quick'); });
    $('#btn-daily').addEventListener('click', () => { Sound.unlock(); dailyTap(); });
    // the run as a picture: to the phone's share sheet where it takes files, else saved
    $('#end-card').addEventListener('click', async () => {
      const b = $('#end-card'), G = Game.state();
      if (!G) return;
      const won = G.status === 'won';
      const blob = await new Promise(r => drawShareCard(cardInfo(won)).toBlob(r, 'image/png'));
      if (!blob) { b.textContent = 'Could not draw the picture'; return; }
      const file = new File([blob], `deepdelve-${String(G.seed).toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`, { type: 'image/png' });
      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text: runShareLine(won) }); b.textContent = 'Shared'; return; }
      } catch (e) { if (e && e.name === 'AbortError') return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = file.name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      b.textContent = 'Picture saved';
    });
    $('#end-share').addEventListener('click', () => {
      const G = Game.state(), key = G && G.opts.daily, st = key ? Daily.status(key) : null;
      if (!G || (key && (!st || !st.done))) return;
      const line = key ? Daily.shareLine(key, st.done) : runShareLine(G.status === 'won'), out = $('#end-share-line');
      // the line is shown as well, to copy by hand if the clipboard says no
      out.textContent = line; out.style.display = '';
      shareText(line).then(how => { $('#end-share').textContent = SHARED[how] || (how === 'closed' ? $('#end-share').textContent : 'Copy the line below'); });
    });
    for (const b of $$('#c-difficulty [data-diff]')) b.addEventListener('click', () => setDifficulty(b.dataset.diff));
    setDifficulty('normal');
    $('#end-title-btn').addEventListener('click', () => showScreen('screen-title'));
    bindControls();
    setTextSize(textSize());
    refreshTitle();
    window.addEventListener('resize', () => { fitView(); if (overlay === 'map') renderMap(); });
  }

  return { init, paused, fitView, pumpHeld, refreshHud, refreshLog, refreshMinimap, renderTitle, handleEvents, showScreen,
    isPlaying: () => $('#screen-game').classList.contains('active'), pauseIfThreatened,
    isTitle: () => $('#screen-title').classList.contains('active'),
    /** Every tip's words, so a test can check each fits where it is shown. */
    tips: () => ({ ...TIPS }), timeScale, bossBar };
})();

export { UI };
