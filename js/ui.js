import { randomSeedWord } from './rng.js';
import { HERO_NAMES, PROLOGUE, BACKGROUNDS, JOURNAL, BOONS, XP_TABLE, MAX_LEVEL, CLASSES, STAT_NAMES, ITEMS, KEY_COLORS, MONSTERS, THEMES, BESTIARY, TALENTS, SPELLS } from './data.js';
import { Assets } from './assets.js';
import { Dungeon } from './dungeon.js';
import { Renderer } from './renderer.js';
import { Sound } from './sound.js';
import { Game } from './game.js';
import { RELIC_POWERS, RELICS } from './relics.js';
import { Daily } from './daily.js';
import { Progress } from './progress.js';

// DOM, touch controls, overlays and screens.

const UI = (() => {
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  /** Buttons and keys held down, and when each was pressed. */
  const held = new Map();
  // A held button repeats only after this long, like a keyboard: an ordinary
  // tap lasts 100-200ms, and repeating sooner turned one tap into two turns.
  const HOLD_DELAY = 320;
  let overlay = null;
  /** @type {string[]} overlays the game asked for while a choice or a result was on screen */
  let waiting = [];
  let create = { cls: 'fighter', bg: 'oathbroken', stats: null, rolled: null, difficulty: 'normal' };
  let pendingCfg = null;
  let selectedItem = null, selectedSlot = null;
  let logCount = -1, hudSig = '', miniAt = 0, miniSig = '';

  let finaleTimer = 0;
  function showScreen(id) {
    if (id !== 'screen-game') clearTimeout(finaleTimer);   // leaving the run: its victory screen goes with it
    $$('.screen').forEach(s => s.classList.toggle('active', s.id === id));
    // the raycaster draws into whichever canvas is on screen
    if (id === 'screen-title') { Renderer.init($('#title-art')); title.t0 = 0; title.last = 0; refreshTitle(); }
    else if (id === 'screen-game') { Renderer.init($('#view')); fitView(); }
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
  }
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
  /** The title's Daily Delve button: start today's, go back to it, or share how it went. */
  function dailyTap() {
    const key = Daily.today(), st = Daily.status(key), s = Game.saveSummary();
    if (s && s.daily === key) { if (Game.load()) startPlaying(); return; }
    if (st.state === 'done') {
      const line = Daily.shareLine(key, st.done);
      copyText(line).then(ok => { $('#daily-summary').textContent = ok ? 'Copied: paste it anywhere' : line; });
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
  /** A run's difficulty; a save from before there was a choice is normal. */
  const diffOf = o => (o && (o.difficulty === 'easy' || o.difficulty === 'hard') ? o.difficulty : 'normal');
  const diffName = d => d.charAt(0).toUpperCase() + d.slice(1);
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
    for (const id in CLASSES) {
      const c = CLASSES[id];
      const b = document.createElement('button');
      b.className = 'class-card' + (id === create.cls ? ' sel' : '');
      b.type = 'button';
      b.setAttribute('aria-pressed', String(id === create.cls));
      b.innerHTML = `<b>${c.name}</b><small>${c.desc}</small><em class="key">Key stat: ${STAT_NAMES[c.primary]}</em>`;
      b.addEventListener('click', () => { create.cls = id; fitStats(); buildCreate(); });
      grid.appendChild(b);
    }
    const bgGrid = $('#c-backgrounds');
    bgGrid.innerHTML = '';
    // a past still to be earned cannot stay chosen
    const progress = Progress.load();
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
      if (open) el.addEventListener('click', () => { create.bg = id; buildCreate(); });
      bgGrid.appendChild(el);
    }
    $('#c-bg-perk').textContent = BACKGROUNDS[create.bg].perk;
    if (!create.stats) fitStats();
    const st = $('#c-stats');
    st.innerHTML = '';
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
  function openCreation() {
    create.rolled = Game.rollStats();
    fitStats();
    buildCreate();
    showScreen('screen-create');
  }
  /** A random hero with sensible numbers, straight to the prologue. */
  function quickStart() {
    const classes = Object.keys(CLASSES), progress = Progress.load(), pasts = Object.keys(BACKGROUNDS).filter(id => Progress.bgOpen(id, progress));
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
      const s = create.stats, fight = create.cls === 'thief' ? s.dex : s.str;
      if (s[CLASSES[create.cls].primary] >= 14 && fight >= 12 && s.con >= 10) break;
    }
    const NAMES = Daily.HERO_NAMES;
    const cfg = { name: NAMES[Math.floor(Math.random() * NAMES.length)], cls: create.cls, bg: create.bg, stats: create.stats, seed: randomSeedWord(),
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
    $('#pro-world').innerHTML = PROLOGUE.map(t => `<p>${escapeHtml(t)}</p>`).join('');
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
      },
    };
    showPrologue(cfg);
  }
  function commitGame() {
    if (!pendingCfg) return;
    // the day's one try begins here, at the first stair
    if (pendingCfg.opts.daily) Daily.start(pendingCfg.opts.daily);
    Game.newGame(pendingCfg);
    pendingCfg = null;
    Game.save(true);
    startPlaying();
  }
  function startPlaying() {
    logCount = -1; hudSig = '';
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
    monster: 'Something is coming. Face it and tap <b>⚔ Attack</b>. When a <b>warning mark</b> appears over it, step back and the blow misses.',
    trick: 'A <b>violet mark</b> means a trick, and <b>armour will not turn it</b>: get out of the way. Read the log for what is coming; your <b>Bestiary</b>, in the Journal, writes down each trick you see.',
    gaze: 'Its eyes blaze: <b>turn away!</b> A basilisk\'s gaze turns to stone only whoever is looking at it.',
    rust: 'It means to bite your armour. <b>Step back!</b> A rustmaw\'s bite rusts metal for good, though a trader\'s forge can mend it.',
    claw: 'It reaches for you with a numbing claw. <b>Strike it now!</b> A blow that lands first knocks the claw aside, or step back out of reach.',
    charge: 'It lowers its head to charge down the line. <b>Step aside</b>, or pull a <b>door</b> shut across its path: it slams into the door, wide open.',
    web: 'You are caught in a web. <b>Fire burns it away</b>: cast a fire spell to be free at once, or push against it to tear free.',
    webtear: 'You are caught in a web. <b>Push against it</b>: tap any arrow, again and again, to tear free.',
    opening: '<b>An opening!</b> You answered its trick: your next blow at it cannot miss and lands hard. Strike now.',
    take: 'Something lies here. Tap <b>✋ Take</b> to pick it up.',
    stairs: 'Stairs down. Tap <b>Descend</b> when you are ready. The Heart waits at the bottom.',
    examine: 'Something to deal with. Tap <b>Examine</b>: every choice shows its odds before you commit.',
    trade: 'A trader. Tap <b>Trade</b> to buy, sell, and use the forge: it sharpens a weapon or strengthens armour, and mends rust.',
    unknown: 'A <b>?</b> in your pack means you do not know how good that gear is. <b>Study</b> it, or have a trader appraise it: cursed gear will not come off once worn.',
    hurt: 'You are badly hurt. Drink a healing potion from the <b>Pack</b>, or <b>Rest</b> when nothing is near.',
  };
  /** The tips that each tell the answer to one trick. */
  const ANSWER_TIPS = ['gaze', 'rust', 'claw', 'charge', 'web', 'webtear', 'opening'];
  let tipsSeen = null, tipAt = 0, tipUntil = 0, tipCheckAt = 0;
  const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* private browsing */ } return null; };
  function tipsOn() { return store(TIPS_OFF) !== '1'; }
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
    // in a fight a tip keeps out of the way sooner
    const L = Game.level(), p = Game.player();
    const fighting = L.monsters.some(m => m.awake && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) <= 3);
    tipUntil = tipAt + (fighting ? 4000 : 7000);
    return true;
  }
  function checkTips() {
    const now = performance.now();
    const el = $('#tip');
    if (el && el.classList.contains('show') && now > tipUntil) el.classList.remove('show');
    // a tip about the thing in front of you goes when that thing does
    const USE_TIPS = { take: 'Take', stairs: 'Descend', examine: 'Examine', trade: 'Trade' };
    if (el && el.classList.contains('show') && USE_TIPS[el.dataset.tip || ''] && Game.state() && Game.useLabel() !== USE_TIPS[el.dataset.tip || '']) { el.classList.remove('show'); tipUntil = now; }
    // a warning goes when what it warned of does: a wind-up come down, an
    // opening taken or gone. It stays long enough to be read first.
    const G0 = Game.state();
    if (el && el.classList.contains('show') && G0 && G0.status === 'playing') {
      const p0 = Game.player(), L0 = Game.level();
      const near = mv => L0.monsters.some(m => m.windup && m.windup.move && (!mv || m.windup.move === mv) && Math.abs(m.x - p0.x) + Math.abs(m.y - p0.y) <= 6);
      const still = { gaze: () => near('gaze'), rust: () => near('rust'), claw: () => near('paralyse'), charge: () => near('charge'), web: () => (p0.webbed || 0) > G0.t, webtear: () => (p0.webbed || 0) > G0.t, trick: () => near(''), opening: () => !!(p0.opening && p0.opening.until > G0.t) }[el.dataset.tip || ''];
      const read = el.dataset.tip === 'trick' ? 2500 : 1200;
      if (still && !still() && now - tipAt > read) { el.classList.remove('show'); tipUntil = now; }
    }
    // a tip that is not itself the warning grows faint while a blow is being drawn back close by
    if (el && el.classList.contains('show') && G0 && G0.status === 'playing') {
      const p1 = Game.player();
      const striking = Game.level().monsters.some(m => m.windup && Math.abs(m.x - p1.x) + Math.abs(m.y - p1.y) <= 3);
      el.classList.toggle('faint', striking && ![...ANSWER_TIPS, 'trick', 'monster'].includes(el.dataset.tip || ''));
    }
    // a tip never outlives the run: not over the fall, nor over the Heart's light
    if (el && Game.state() && Game.state().status !== 'playing') { el.classList.remove('show'); tipUntil = now; }
    if (now < tipCheckAt || overlay || !Game.state() || Game.state().status !== 'playing') return;
    tipCheckAt = now + 250;
    const p = Game.player(), L = Game.level();
    if (showTip('controls')) return;
    // the first time each new trick comes, say how to answer it: these cannot wait
    const readying = mv => L.monsters.some(m => m.windup && m.windup.move === mv && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) <= 6);
    if (readying('gaze') && showTip('gaze', true)) return;
    if (readying('rust') && showTip('rust', true)) return;
    if (readying('paralyse') && showTip('claw', true)) return;
    if (readying('charge') && showTip('charge', true)) return;
    // only a hero with fire to hand is told to burn a web
    if ((p.webbed || 0) > Game.state().t && showTip(Game.knownSpells().some(sp => sp.fire && Game.spellAvailable(sp)) ? 'web' : 'webtear', true)) return;
    if (p.opening && p.opening.until > Game.state().t && showTip('opening', true)) return;
    // the general word on tricks waits while a trick's own answer is being read:
    // replacing it a quarter second later would teach nothing at all
    const answering = $('#tip') && $('#tip').classList.contains('show') && ANSWER_TIPS.includes($('#tip').dataset.tip || '');
    if (!answering && L.monsters.some(m => ((m.windup && m.windup.move) || m.collapsed) && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) <= 5) && showTip('trick', true)) return;
    const close = L.monsters.some(m => m.awake && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) <= 3);
    if (close && showTip('monster')) return;
    // the rest can wait for a quiet moment: a tip about your pack, mid-fight,
    // covers the view just when it matters most. Quiet means nothing awake in
    // throwing distance, no lich about, and no blow taken for five seconds
    const G = Game.state();
    if (close || Game.bossAwake() || G.t - (p.lastHurt || -1e9) < 5000 || L.monsters.some(m => m.awake && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) <= 6)) return;
    const label = Game.useLabel();
    const byLabel = { Take: 'take', Descend: 'stairs', Examine: 'examine', Trade: 'trade' };
    if (byLabel[label] && showTip(byLabel[label])) return;
    if ([...p.inv, ...Object.values(p.eq)].some(it => it && it.h) && showTip('unknown')) return;
    if (p.hp < p.maxHp * 0.4 && showTip('hurt')) return;
  }

  // ---------- HUD ----------
  function refreshHud() {
    refreshUse();
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
    const sig = [p.hp, p.maxHp, p.sp, p.maxSp, p.food, p.gold, G.depth, p.dir, p.level, p.poison ? left(p.poison.until) : 0, secs('ac'), secs('hit'), secs('might'), secs('boon_ac'), secs('boon_hit'), p.x, p.y, champ ? champ.uid : 0, p.webbed > G.t, p.held > G.t, !!p.grabbed, p.mirrors || 0, p.riposteUntil > G.t, p.shadowUntil > G.t].join('|');
    if (sig === hudSig) return;
    hudSig = sig;
    $('#hud-name').textContent = p.name;
    $('#hud-cls').textContent = `${CLASSES[p.cls].name} ${p.level}`;
    $('#bar-hp').style.width = Math.max(0, p.hp / p.maxHp * 100) + '%';
    $('#txt-hp').textContent = `HP ${p.hp}/${p.maxHp}`;
    const spBar = $('.bar.sp');
    spBar.style.display = p.maxSp ? '' : 'none';
    $('#bar-sp').style.width = (p.maxSp ? p.sp / p.maxSp * 100 : 0) + '%';
    $('#txt-sp').textContent = `SP ${p.sp}/${p.maxSp}`;
    $('#bar-food').style.width = p.food + '%';
    $('#txt-food').textContent = p.food > 30 ? 'Fed' : (p.food > 0 ? 'Hungry' : 'Starving');
    $('#hud-depth').textContent = `Floor ${G.depth}/${G.opts.levels}`;
    $('#hud-gold').textContent = `${p.gold} gold`;
    $('#hud-compass').textContent = ['N', 'E', 'S', 'W'][p.dir];
    const st = [];
    if (p.poison) st.push(`<span class="bad">Poisoned ${left(p.poison.until)}s</span>`);
    // a floor readier for a strong hero says so while you are on it
    if ((L.press || 0) > 0) st.push(`<span class="bad" title="You are ahead of most who come this far, and this floor's creatures are readier for it">Deep +${L.press}</span>`);
    if (p.held > G.t) st.push(`<span class="bad">${p.heldBy === 'down' ? 'Knocked down' : p.heldBy === 'stone' ? 'Stone' : 'Frozen'}</span>`);
    if (p.webbed > G.t) st.push('<span class="bad">Webbed</span>');
    if (p.grabbed) st.push('<span class="bad">Grabbed</span>');
    if (secs('ac')) st.push(`<span class="good">Shielded ${secs('ac')}s</span>`);
    // a blessing lasts minutes: counted in minutes, so the row does not tick every second
    const boon = Math.max(secs('boon_ac'), secs('boon_hit'));
    if (boon) st.push(`<span class="good">Warded ${Math.ceil(boon / 60)}m</span>`);
    if (p.mirrors > 0) st.push(`<span class="good">Images \u00d7${Number(p.mirrors)}</span>`);
    if (p.riposteUntil > G.t) st.push('<span class="good">Riposte ready</span>');
    if (p.shadowUntil > G.t && (p.talents || []).includes('shadow_step')) st.push('<span class="good">In shadow</span>');
    if (secs('hit')) st.push(`<span class="good">Blessed ${secs('hit')}s</span>`);
    if (secs('might')) st.push(`<span class="good">Mighty ${secs('might')}s</span>`);
    if (p.food === 0) st.push('<span class="bad">Starving</span>');
    if (champ) st.push(`<span class="bad">${escapeHtml(Game.mstat(champ).name)} near</span>`);
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
  let quaffSig = '';
  function refreshQuaff() {
    const p = Game.player();
    const caster = !!CLASSES[p.cls].spells;
    const n = caster ? p.inv.filter(i => (i.t === 'potion_heal' || i.t === 'potion_xheal') && Game.isKnown(i.t)).reduce((k, i) => k + i.q, 0) : 0;
    const sig = `${caster}|${n}`;
    if (sig === quaffSig) return;
    quaffSig = sig;
    const btn = $('#hud-quaff');
    btn.style.display = caster ? '' : 'none';
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
    if (!G || G.logSeq === logCount) return;
    logCount = G.logSeq;
    const el = $('#log');
    el.innerHTML = G.log.filter(e => !e.gone).slice(-4).map(e => `<div class="${e.c}">${logLine(e.m)}</div>`).join('');
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
  function escapeHtml(s) { return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
  // The dice come in one fixed shape, so set them apart as a footnote that
  // stays in one piece and drops to its own line when the phone is narrow.
  // It was the tail of the line, which is exactly what an ellipsis cuts.
  function logLine(m) {
    return escapeHtml(m).replace(/ \((d20 [^)]*)\)/, ' <span class="roll">($1)</span>');
  }

  // Small live automap in the corner of the view, 15x15 tiles around the player.
  let miniFaded = false;
  function refreshMinimap(now) {
    if (now - miniAt < 120) return;
    miniAt = now;
    const c = $('#minimap');
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
    const sig = [p.x, p.y, p.dir, L.depth, L.monsters.length].join(',');
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
      let col = '#1c1a26';
      // a torch is a bracket set into a wall, so it reads as wall here: picking
      // it out in its own colour made the corner map busy and told you nothing
      // you could act on
      if (t === T.WALL || t === T.SECRET || t === T.TORCH) col = '#5a5670';
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
    if (!r) return plainBlurb(it) + (it.pw && !it.h && RELIC_POWERS[it.pw] ? `. ${RELIC_POWERS[it.pw].split(':')[0]}` : '');
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
    if (b.kind === 'armor') return `Armor class +${b.ac + knownE(it)}${it.h ? '?' : ''} (${b.weight})`;
    if (b.kind === 'shield') return `Armor class +${b.ac + knownE(it)}${it.h ? '?' : ''}, needs a free hand`;
    if (b.kind === 'food') return `Restores ${b.food} nourishment`;
    return b.desc || '';
  }

  // what the player knows of an enchantment: nothing, while it is hidden
  const knownE = it => (it.h ? 0 : (it.e || 0));
  const swiftOf = it => { const r = Game.relicOf(it); return (!!r && r.powers.includes('swift')) || (it.pw === 'swift' && !it.h); };

  function shopRow(it, price, label, enabled, onClick, note) {
    const row = document.createElement('div');
    row.className = 'shop-row';
    const img = document.createElement('img');
    img.src = Assets.sprites[Game.spriteFor(it)].url;
    img.alt = '';
    row.appendChild(img);
    const what = document.createElement('div');
    what.className = 'what';
    what.innerHTML = `<b${it.u ? ' class="relic"' : ''}>${escapeHtml(Game.itemName(it))}</b><small>${escapeHtml(note || '')}</small>`;
    row.appendChild(what);
    const btn = document.createElement('button');
    btn.textContent = `${label} ${price}g`;
    btn.disabled = !enabled;
    if (enabled) btn.className = 'afford';
    payButton(btn, row, price, label, onClick);
    row.appendChild(btn);
    return row;
  }
  // A dear thing asks twice. A mis-tap while scrolling the trader's list
  // should not spend a fortune: anything from 100 gold, or a quarter of the
  // purse, arms on the first tap and pays on the second, within a few seconds.
  // Selling never asks: it gives gold, it does not take it. The whole row
  // answers a tap, not only its button.
  function payButton(btn, row, price, label, onClick) {
    const dear = label !== 'Sell' && label !== 'Sell one' && price >= Math.min(100, Math.max(1, Game.player().gold * 0.25));
    const plain = btn.textContent;
    let armedUntil = 0;
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (dear && performance.now() > armedUntil) {
        armedUntil = performance.now() + 3000;
        for (const b of $$('#ov-shop .shop-row button.armed')) if (b !== btn) b.dispatchEvent(new Event('disarm'));
        btn.classList.add('armed'); btn.textContent = `Tap again: ${price}g`;
        setTimeout(() => { if (btn.isConnected && performance.now() >= armedUntil) btn.dispatchEvent(new Event('disarm')); }, 3050);
        return;
      }
      onClick(); renderShop();
    });
    btn.addEventListener('disarm', () => { armedUntil = 0; btn.classList.remove('armed'); btn.textContent = plain; });
    row.addEventListener('click', () => { if (!btn.disabled) btn.click(); });
  }
  function renderShop() {
    const s = Game.currentShop();
    if (!s) { closeOverlay(); return; }
    const p = Game.player();
    // say what charisma is doing to the prices, or it is invisible
    const charm = Math.round(Game.charm() * 100);
    $('#shop-gold').innerHTML = `${p.gold} gold` + (charm > 0 ? `<br><small>your charm: ${charm}% off</small>` : charm < 0 ? `<br><small>your manner: ${-charm}% dearer</small>` : '');
    const stock = $('#shop-stock');
    stock.innerHTML = '';
    if (!s.stock.length) stock.innerHTML = '<div class="shop-empty">The trader has nothing left to sell.</div>';
    for (const it of s.stock.slice()) {
      const price = Game.buyPrice(s, it);
      const note = (Game.isKnown(it.t) ? itemBlurb(it) : 'Unknown until bought: the trader names it when you pay') + (it.q > 1 ? ` · ${it.q} in stock` : '');
      stock.appendChild(shopRow(it, price, 'Buy', p.gold >= price, () => Game.buy(it), note));
    }
    // what the trader will do for coin besides trade
    const svc = $('#shop-services');
    svc.innerHTML = '';
    for (const sv of Game.shopServices()) {
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
      svc.appendChild(row);
    }
    const sellBox = $('#shop-sell');
    sellBox.innerHTML = '';
    const sellable = p.inv.filter(it => it.t !== 'artifact' && it.t !== 'key');
    if (!sellable.length) sellBox.innerHTML = '<div class="shop-empty">Nothing in your pack the trader wants.</div>';
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
      return `<div class="journal-entry"><h3>${escapeHtml(e.title)}</h3><p>${escapeHtml(e.text)}</p><p class="where">Found on level ${j.depth}</p></div>`;
    }).join('');
  }
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
    const ids = Object.keys(MONSTERS).sort((a, b) => seen(a) - seen(b) || MONSTERS[a].tier[0] - MONSTERS[b].tier[0] || MONSTERS[a].xp - MONSTERS[b].xp);
    const met = ids.filter(id => known[id] && known[id].met).length;
    el.innerHTML = '<div class="beasts">' + ids.map(id => {
      const mb = MONSTERS[id], r = known[id] || { met: 0, kills: 0, deaths: 0 }, lore = BESTIARY[id] || {};
      const art = Assets.sprites[mb.sprite];
      const img = `<img src="${art ? art.url : ''}" alt="">`;
      // the first floor of this delve (or an eight-floor one, from the title) it can be met on
      const levels = (Game.state() && Game.state().opts.levels) || 8;
      let first = 1;
      while (first <= levels && Dungeon.tierAt(first, levels) < mb.tier[0]) first++;
      const where = mb.boss ? 'Guards the Heart of the Mountain' : first > levels ? 'Deeper than this delve goes' : `From floor ${first} down`;
      if (!r.met) return `<div class="beast unmet" data-beast="${id}">${img}<div><h3>???</h3><p class="locked">Not yet met. ${where}.</p></div></div>`;
      const bits = [`<h3>${escapeHtml(mb.name)}</h3>`, `<p>${escapeHtml(lore.lore || '')}</p>`];
      if (r.kills) {
        const traits = beastTraits(id, mb);
        bits.push(`<p class="beast-stats">About ${avg(mb.hp)} HP · AC ${mb.ac} · hits for ${dice(mb.dmg)} · a blow every ${(mb.speed / 1000).toFixed(1)}s · ${mb.xp} xp${traits.length ? ' · ' + traits.join(', ') : ''}</p>`);
      } else bits.push('<p class="locked">Kill one to take its measure.</p>');
      if (lore.trick) {
        bits.push(r.trick ? `<p class="trick"><b>Trick:</b> ${escapeHtml(lore.trick)}</p>` : '<p class="locked">Trick: not yet seen.</p>');
        bits.push(r.answer ? `<p class="answer"><b>Answer:</b> ${escapeHtml(lore.answer)}</p>` : '<p class="locked">Answer: not yet learned.</p>');
      }
      const rec = [`${where}`, r.kills ? `killed ${r.kills}` : 'none killed yet'];
      if (r.deaths) rec.push(`killed you ${times(r.deaths)}`);
      bits.push(`<p class="where">${rec.join(' · ')}</p>`);
      return `<div class="beast" data-beast="${id}">${img}<div>${bits.join('')}</div></div>`;
    }).join('') + '</div>';
    return `${met} of ${ids.length} met`;
  }

  // ---------- relic codex ----------
  const KIND_NAMES = { weapon: 'Weapon', armor: 'Armour', shield: 'Shield' };
  /** Fill el with every relic, found or not; returns the count line. */
  function renderCodex(el) {
    // found ones first; one still to find says what sort of thing to look for
    const found = Progress.load().relics, ids = Object.keys(RELICS).sort((a, b) => Number(!found.includes(a)) - Number(!found.includes(b)));
    el.innerHTML = '<div class="codex">' + ids.map(id => {
      const r = RELICS[id], b = ITEMS[r.t], kind = KIND_NAMES[b.kind] || b.kind;
      // one not yet found shows only what sort of thing it is
      if (!found.includes(id)) return `<div class="relic-row unfound" data-relic="${id}"><span class="relic-q">?</span><div><h3>Not yet found</h3><p class="codex-kind">${kind} · a ${escapeHtml(b.name)}</p></div></div>`;
      const art = Assets.sprites['relic_' + b.sprite] || Assets.sprites[b.sprite];
      return `<div class="relic-row" data-relic="${id}"><img src="${art ? art.url : ''}" alt=""><div><h3 class="relic">${escapeHtml(upFirst(r.name))}</h3>`
        + `<p class="codex-kind">${kind} · ${escapeHtml(b.name)} +${r.e}</p>`
        + `<ul class="relic-powers">${r.powers.map(k => `<li>${escapeHtml(RELIC_POWERS[k])}</li>`).join('')}</ul><p class="relic-lore">${escapeHtml(r.lore)}</p></div></div>`;
    }).join('') + '</div>';
    return `${ids.filter(id => found.includes(id)).length} of ${ids.length} found`;
  }

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
      for (const o of Game.encounterOptions()) {
        const btn = document.createElement('button');
        btn.className = 'boon enc-choice';
        const bits = [];
        if (o.stat) bits.push(`${o.statName}: d20${o.bonus < 0 ? '' : '+'}${o.bonus} vs ${o.dc}, ${Math.round(o.chance * 100)}% chance${o.knack ? ' (your training helps)' : ''}`);
        if (o.cost) bits.push(`costs ${o.cost}`);
        if (o.blocked) bits.push(o.blocked);
        btn.innerHTML = `<b>${escapeHtml(o.label)}</b>${bits.length ? `<small>${escapeHtml(bits.join(' · '))}</small>` : ''}`;
        btn.disabled = !!o.blocked;
        btn.addEventListener('click', () => { Game.chooseEncounter(o.i); renderEncounter(); });
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
    done.addEventListener('click', () => closeOverlay());
    el.appendChild(done);
  }
  const BOON_GUARD_MS = 700;
  /** A lesson's card: for a stat, what it will be and what it buys this hero. */
  function lessonText(b, p) {
    if (!b.stat) return b.desc;
    const s = p.stats[b.stat], next = s + (s % 2 ? 1 : 2);
    const what = {
      str: p.cls === 'thief' ? 'to hit' : 'to hit and to damage',
      dex: p.cls === 'thief' ? 'to armour class and to damage' : 'to armour class',
      con: 'hit point with every level from now on',
      int: p.cls === 'mage' ? 'spell point for every hero level' : 'on every reckoning and reading in the dark',
      wis: p.cls === 'cleric' ? 'spell point for every hero level, to hit and to damage, and a surer will against draining' : 'against draining',
    }[b.stat];
    return `${STAT_NAMES[b.stat]} ${s} \u2192 ${next}: +1 ${what}.`;
  }
  function renderBoons() {
    const offer = Game.pendingBoons();
    if (!offer) { closeOverlay(); return; }
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
        Game.chooseBoon(id);
        if (Game.pendingBoons()) renderBoons(); else closeOverlay();
      });
      el.appendChild(btn);
    }
  }

  function renderLogHistory() {
    const G = Game.state();
    $('#log-history').innerHTML = '<div class="log-history">' + G.log.filter(e => !e.gone).reverse().map(e => `<div class="${e.c}">${logLine(e.m)}</div>`).join('') + '</div>';
  }
  /** Four classes by three difficulties, each lit once that class has won there. */
  function renderTrophies() {
    const v = Progress.load(), { won, total } = Progress.trophyCount(v);
    const head = ['<span></span>', ...Progress.DIFFS.map(d => `<span class="th">${diffName(d)}</span>`)];
    const rows = Object.keys(CLASSES).map(cls => [`<span class="tcls">${CLASSES[cls].name}</span>`, ...Progress.DIFFS.map(d => {
      const n = (v.won[cls] && v.won[cls][d]) || 0, what = `${CLASSES[cls].name} on ${diffName(d)}: ${n ? (n === 1 ? 'won once' : `won ${n} times`) : 'not yet won'}`;
      return `<span class="cell${n ? ' won' : ''}" data-trophy="${cls}-${d}" role="img" aria-label="${what}" title="${what}">${n ? '✦' : ''}</span>`;
    })].join(''));
    $('#hall-trophies').innerHTML = `<div class="trophy-head"><span>Trophies</span><span id="trophy-count">${won} of ${total} won</span></div>`
      + `<div class="trophy-grid">${head.join('')}${rows.join('')}</div>`;
    $('#hall-relics-count').textContent = `${v.relics.length} of ${Object.keys(RELICS).length} found`;
  }
  function renderHall() {
    renderTrophies();
    const list = Game.hall();
    const el = $('#hall-list');
    if (!list.length) { el.innerHTML = '<p class="dim">No heroes have entered the deep yet. Their deeds will be recorded here.</p>'; return; }
    // a daily run is marked with its day; every run says how hard it was, and one from before the choice was normal
    el.innerHTML = '<div class="hall">' + list.map((h, i) => `<div class="hall-row${h.won ? ' won' : ''}${h.daily ? ' daily' : ''}"><span class="rank">${i + 1}</span><span class="who">${escapeHtml(h.name)}${h.daily ? ` <em class="daily-mark">Daily ${escapeHtml(String(h.daily))}</em>` : ''}<small>Level ${Number(h.level) || 1} ${CLASSES[h.cls] ? CLASSES[h.cls].name : escapeHtml(String(h.cls))} · ${h.won ? 'Claimed the Heart' : 'Fell on floor ' + h.depth} · ${h.kills} kills · ${h.gold} gold · ${diffName(diffOf(h))} · seed ${escapeHtml(h.seed)}</small></span><span class="score">${h.score}<small>SCORE</small></span></div>`).join('') + '</div>';
  }

  // ---------- overlays ----------
  // A level-up choice or an encounter holds the screen until it is dealt
  // with: what the game asks for meanwhile (another choice, a shop) waits its
  // turn rather than covering it, and what the player taps for is ignored.
  const GAME_ASKS = ['boons', 'encounter', 'shop'];
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
  }
  function closeOverlay(next = true) {
    if (!overlay) return;
    if (overlay === 'boons' && Game.pendingBoons()) return;   // a choice must be made
    // an encounter must be answered: every one offers a way to leave, so
    // backing out would only be a free look at the odds
    if (overlay === 'encounter') { const e = Game.currentEncounter(); if (e && !e.result) return; Game.closeEncounter(); }
    if (overlay === 'shop') Game.closeShop();
    $('#ov-' + overlay).classList.remove('open');
    overlay = null;
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
    selectedItem = null; selectedSlot = null;
  }
  function paused() { return !!overlay; }

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
      if (it.h) { const u = document.createElement('span'); u.className = 'unk'; u.textContent = '?'; u.title = 'Quality unknown'; div.appendChild(u); }
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
    for (const slot of slots) {
      const it = p.eq[slot];
      const el = slotEl(it, slot === 'offhand' ? 'off hand' : slot);
      if (it) el.addEventListener('click', () => { selectedItem = it; selectedSlot = slot; renderInv(); });
      if (selectedItem === it && it) { el.classList.add('sel'); el.setAttribute('aria-pressed', 'true'); }
      else if (it) el.setAttribute('aria-pressed', 'false');
      eq.appendChild(el);
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
    if (!Game.isKnown(it.t)) info = 'You do not know what this does. Using it will reveal its nature.';
    if (it.h) info += ' Its quality is unknown: it could be finely made, or cursed. Wearing it will tell you, and so will studying it or a trader\'s eye.';
    else if (it.curse) info += selectedSlot
      ? ' Cursed: it will not come off. Read a Scroll of Remove Curse, pray at a shrine, or pay a trader to lift it.'
      : ' Cursed: once worn, it will not come off until the curse is broken.';
    // rusted, or simply poorly made: the forge can put it right
    else if ((it.e || 0) < 0 && (b.kind === 'weapon' || b.kind === 'armor')) info += ' Worn or rusted: a trader\'s forge can mend it.';
    const why = (b.kind === 'weapon' || b.kind === 'armor' || b.kind === 'shield') ? Game.canEquip(it) : null;
    const compare = selectedSlot ? '' : compareText(it, b);
    // a relic spells out each power in full, then tells its story
    const r = Game.relicOf(it);
    const legend = r ? `<ul class="relic-powers">${r.powers.map(k => `<li>${escapeHtml(RELIC_POWERS[k])}</li>`).join('')}</ul><p class="relic-lore">${escapeHtml(r.lore)}</p>`
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
      else if (b.kind === 'food') add('Eat', () => useFromPack(it), 'primary');
      else if (b.kind === 'potion') add('Drink', () => useFromPack(it), 'primary');
      else if (b.kind === 'scroll') add('Read', () => useFromPack(it), 'primary');
      // an unknown potion or scroll can be puzzled out instead of risked
      if (((b.kind === 'potion' || b.kind === 'scroll') && !Game.isKnown(it.t)) || it.h) {
        const block = Game.studyReason(it);
        const odds = Math.round(Game.checkChance('int', Game.STUDY_DC, Game.player().cls === 'mage' ? 2 : 0) * 100);
        if (!block) add(`Study (${odds}%)`, () => Game.study(it));
      }
      add('Drop', () => Game.dropItem(it), 'danger');
    }
    add('Close', () => {});
  }

  // Used from the pack in a fight, a draught closes the pack: the point of
  // drinking mid-fight is to be back at the controls. A scroll always closes
  // it, so the page is seen to rise and burn and do its work. Out of a fight
  // the pack stays open after a draught or a meal for the next thing.
  function useFromPack(it) {
    const p = Game.player(), count = () => p.inv.reduce((a, i) => a + (i.q || 1), 0), before = count();
    const scroll = ITEMS[it.t].kind === 'scroll';
    Game.useItem(it);
    const L = Game.level();
    const fighting = Game.bossAwake() || L.monsters.some(m => m.awake && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) <= 6);
    if ((fighting || scroll) && count() < before && overlay === 'inv') setTimeout(() => { if (overlay === 'inv') closeOverlay(); }, 0);
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
      const dps = item => {
        if (!item) return 0;
        const d = ITEMS[item.t].dmg, sp = ITEMS[item.t].speed * (swiftOf(item) ? 0.85 : 1);
        // mirrors the damage rule: flat bonuses scale with swing time, except
        // for a thief's finesse, which does not
        const finesse = p.cls === 'thief';
        // a cleric's faith guides the mace: the stronger of strength and wisdom
        const arm = p.cls === 'cleric' ? Math.max(p.stats.str, p.stats.wis) : p.stats.str;
        const base = Game.mod(finesse ? p.stats.dex : arm) + Game.skillDamage();
        const flat = finesse ? base : base * (sp / 700);
        return ((d[0] * (d[1] + 1) / 2) + d[2] + knownE(item) + flat) / (sp / 1000);
      };
      const now = dps(cur), next = dps(it);
      label = cur ? `vs ${Game.itemName({ ...cur, q: 1 })}` : 'vs bare hands';
      delta = next - now;
      return `<p class="compare ${delta >= 0 ? 'up' : 'down'}">${escapeHtml(label)}: ${fmt(delta)} damage per second</p>`;
    }
    const acOf = item => (item ? ITEMS[item.t].ac + knownE(item) : 0);
    delta = acOf(it) - acOf(cur);
    label = cur ? `vs ${Game.itemName({ ...cur, q: 1 })}` : 'vs nothing worn';
    return `<p class="compare ${delta >= 0 ? 'up' : 'down'}">${escapeHtml(label)}: ${fmt(delta)} armor class</p>`;
  }

  // Colours and shapes the legend below the map also uses, so the two cannot
  // drift apart.
  const MAP_KEY = [
    { id: 'player', colour: '#ff6a50', label: 'You' },
    { id: 'down', colour: '#ffd24a', label: 'Stairs down' },
    { id: 'up', colour: '#86d870', label: 'Stairs up' },
    { id: 'door', colour: '#c08a3e', label: 'Door' },
    { id: 'locked', colour: '#d0409a', label: 'Locked door' },
    { id: 'fountain', colour: '#49a6f0', label: 'Fountain' },
    { id: 'trader', colour: '#b57ae0', label: 'Trader' },
    { id: 'loot', colour: '#5ad0c0', label: 'Something here' },
    { id: 'floor', colour: '#2c2a3a', label: 'Walked' },
    { id: 'wall', colour: '#5a5670', label: 'Wall' },
    { id: 'torch', colour: '#ffb45a', label: 'Torch (*)' },
  ];
  const MAP_COLOUR = Object.fromEntries(MAP_KEY.map(k => [k.id, k.colour]));

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
    const availW = window.innerWidth - 24, availH = window.innerHeight - 230;
    const size = Math.max(8, Math.floor(Math.min(availW / cols, availH / rows)));
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
        let col = '#2c2a3a', mark = null, markColour = '#000';
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
        ctx.fillStyle = col;
        ctx.fillRect(x * size - ox, y * size - oy, size, size);
        if (mark) glyph(mark, x, y, markColour);
      }
    }

    // anything worth walking back for
    for (const k in L.items) {
      const [x, y] = k.split(',').map(Number);
      if (!L.explored[y * L.w + x] || !L.items[k].length) continue;
      ctx.fillStyle = MAP_COLOUR.loot;
      ctx.fillRect(x * size - ox + size * 0.28, y * size - oy + size * 0.28, size * 0.44, size * 0.44);
    }
    for (const n of (L.npcs || [])) {
      if (!L.explored[n.y * L.w + n.x]) continue;
      ctx.fillStyle = MAP_COLOUR.trader;
      ctx.fillRect(n.x * size - ox, n.y * size - oy, size, size);
      glyph('\u00a4', n.x, n.y, '#2a1a38');
    }

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

    renderMapLegend();
  }

  function renderMapLegend() {
    const el = $('#map-legend');
    if (!el || el.childElementCount) return;      // built once
    el.innerHTML = MAP_KEY.map(k =>
      `<span class="key"><i style="background:${k.colour}"></i>${escapeHtml(k.label)}</span>`).join('');
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
      b.innerHTML = `<div class="cost">${sp.cost} sp</div><div><b>${sp.name}</b>${ready ? '<em class="on-cast">On the Cast button</em>' : ''}<small>${sp.desc}${ok ? '' : ` Requires level ${Game.spellLevel(sp)}.`}</small></div>`;
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
    r('Name', escapeHtml(p.name)); r('Class', c.name);
    r('Hero level', p.level); r('Experience', `${p.xp} / ${p.level < MAX_LEVEL ? XP_TABLE[p.level] : '—'}`);
    r('Hit points', `${p.hp} / ${p.maxHp}`); r('Spell points', p.maxSp ? `${p.sp} / ${p.maxSp}` : '—');
    r('Armor class', Game.playerAC()); r('To hit', (Game.toHit() >= 0 ? '+' : '') + Game.toHit());
    r('Weapon', `${w.name} ${w.dmg[0]}d${w.dmg[1]}${w.dmg[2] ? '+' + w.dmg[2] : ''}${w.e > 0 ? ' +' + w.e : w.e < 0 ? ' \u2212' + -w.e : ''}`, true);
    r('Gold', p.gold);
    for (const k in STAT_NAMES) { const m = Game.mod(p.stats[k]); r(STAT_NAMES[k], `${p.stats[k]} (${m >= 0 ? '+' : ''}${m})`); }
    r('Kills', p.kills); r('Steps', p.steps);
    r('Deepest floor', p.deepest); r('Seed', escapeHtml(G.seed));
    r('Background', BACKGROUNDS[p.bg] ? `${BACKGROUNDS[p.bg].name}: ${BACKGROUNDS[p.bg].perk}` : '—', true);
    r('Pages found', `${Game.journal().length} of ${Game.pagesInDungeon()}`, true);
    let extra = '';
    // every power the hero's gear gives, relic or plain, with the slot it is in
    const worn = [];
    for (const [slot, label] of [['weapon', 'weapon'], ['offhand', 'off hand'], ['armor', 'armour'], ['shield', 'shield']]) {
      const it = p.eq[slot];
      if (!it) continue;
      const rel = Game.relicOf(it);
      const powers = rel ? rel.powers : (it.pw && !it.h ? [it.pw] : []);
      for (const k of powers) {
        if (!RELIC_POWERS[k]) continue;
        const [name, ...rest] = RELIC_POWERS[k].split(': ');
        const what = rest.join(': ');
        worn.push(`<li><b>${escapeHtml(name)}</b><span>${escapeHtml(what.charAt(0).toUpperCase() + what.slice(1))} (${label})</span></li>`);
      }
    }
    if (worn.length) extra += '<h3 class="sheet-h">Powers of your gear</h3><ul class="talent-list">' + worn.join('') + '</ul>';
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
    $('#m-rolls').textContent = 'Combat rolls: ' + (Game.rollsShown() ? 'On' : 'Off');
    $('#m-text').textContent = 'Text size: ' + TEXT_SIZES[textSize()].label;
    $('#m-tips').textContent = 'Tips: ' + (tipsOn() ? 'On' : 'Off');
    $('#m-seed').textContent = `${G.opts.daily ? `Daily Delve ${G.opts.daily} · ` : ''}Seed "${G.seed}" · ${diffName(diffOf(G.opts))} · ${G.opts.levels} levels · ${G.opts.size} · ${G.opts.permadeath ? 'permadeath' : 'reload allowed'}`;
  }

  // ---------- end screens ----------
  // The run told back: a few lines in the log's voice, then pictures and names, numbers last.
  const aName = (id, name) => MONSTERS[id] && MONSTERS[id].boss ? `the ${name}` : `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`;
  const upFirst = s => s.charAt(0).toUpperCase() + s.slice(1);
  /** A few lines about the run, the notable parts only, in the log's voice. */
  function runHighlights(G, won) {
    const s = Game.runStats(), p = G.player, out = [];
    const b = s.best;
    if (b) out.push(`Your best blow: <b>${b.dmg}</b> to ${escapeHtml(aName(b.id, b.to))}, with ${escapeHtml(b.how)}.`);
    else out.push('You never landed a blow.');
    const w = s.worst;
    if (w) out.push(w.from ? `The hardest hit you took: <b>${w.dmg}</b>, from ${escapeHtml(aName(w.id, w.from))}.` : `The hardest hit you took: <b>${w.dmg}</b>, and no monster dealt it.`);
    else out.push('Nothing so much as scratched you.');
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
    const healing = !won ? p.inv.filter(it => ITEMS[it.t] && ITEMS[it.t].kind === 'potion' && ITEMS[it.t].effect === 'heal').reduce((n, it) => n + it.q, 0) : 0;
    if (healing) out.push(`You died with ${healing === 1 ? 'a healing potion' : `<b>${healing}</b> healing potions`} still in your pack.`);
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
        const mb = MONSTERS[id], art = Assets.sprites[mb.sprite];
        const label = `${mb.name} \u00d7${n}`;
        return `<div class="kill" data-kill="${id}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}"><img src="${art ? art.url : ''}" alt=""><span>\u00d7${n}</span></div>`;
      }).join('') + '</div>');
    } else parts.push('<p class="end-none">Nothing died by your hand.</p>');
    const own = TALENTS[p.cls] || [];
    const talents = (p.talents || []).map(id => own.find(t => t.id === id)).filter(Boolean);
    if (talents.length) parts.push('<div class="end-h"><span>Talents</span></div><div class="end-tags">' + talents.map(t => `<span class="tag">${escapeHtml(t.name)}</span>`).join('') + '</div>');
    const relics = ((G.relics && G.relics.found) || []).filter(id => RELICS[id]);
    if (relics.length) parts.push('<div class="end-h"><span>Relics found</span></div><div class="end-tags">' + relics.map(id => `<span class="tag relic">${escapeHtml(upFirst(RELICS[id].name))}</span>`).join('') + '</div>');
    parts.push(`<div class="end-totals"><div><b>${s.dealt}</b><small>damage dealt</small></div><div><b>${s.taken}</b><small>damage taken</small></div><div><b>${s.healed}</b><small>healed</small></div></div>`);
    $('#end-summary').innerHTML = parts.join('');
  }

  function showEnd(won) {
    const G = Game.state(), p = G.player;
    clearOverlays();
    $('#end-title').textContent = won ? 'VICTORY' : 'YOU HAVE DIED';
    $('#end-text').textContent = won
      ? `${p.name} the ${CLASSES[p.cls].name} brought down the Dread Lich and lifted the Heart of the Mountain.`
      : `${G.opts.permadeath ? 'The save has been erased.' : ''}`;   // where they fell, the epilogue below says
    // a first win for this class at this difficulty, and any past it opened
    const earned = won ? Game.earned() : null, news = [];
    if (earned && earned.first && CLASSES[earned.cls]) news.push(`First win as a ${CLASSES[earned.cls].name} on ${diffName(earned.difficulty)}!`);
    for (const id of (earned && earned.unlocked) || []) if (BACKGROUNDS[id]) news.push(`${BACKGROUNDS[id].name} can now be chosen for a new hero.`);
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
      cause.innerHTML = `Killed by <b>${escapeHtml(killer.name)}</b>, striking ${escapeHtml(killer.bearing)} for ${killer.dmg}.`;
    } else if (!won) {
      cause.textContent = 'Killed by the dungeon itself.';
    } else cause.textContent = '';
    const moments = Game.deathLog();
    $('#end-final').style.display = (!won && moments.length) ? '' : 'none';
    $('#end-final-log').innerHTML = moments.map(m => `<p>${escapeHtml(m)}</p>`).join('');
    $('#end-epilogue').innerHTML = Game.epilogue(won).map(t => `<p>${escapeHtml(t)}</p>`).join('');
    $('#end-load').style.display = (!won && !G.opts.permadeath && Game.hasSave()) ? '' : 'none';
    // a daily run can be told in one line
    $('#end-share').style.display = G.opts.daily ? '' : 'none';
    $('#end-share').textContent = 'Share today\'s result';
    $('#end-share-line').style.display = 'none';
    showScreen('screen-end');
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
    $('#m-rolls').addEventListener('click', () => { Game.toggleRolls(); renderMenu(); });
    $('#m-text').addEventListener('click', () => { setTextSize((textSize() + 1) % TEXT_SIZES.length); renderMenu(); });
    // turning tips back on starts them over, for a player who wants the tour again
    $('#m-tips').addEventListener('click', () => { if (tipsOn()) store(TIPS_OFF, '1'); else { store(TIPS_OFF, null); store(TIPS_SEEN, null); tipsSeen = null; } renderMenu(); });
    $('#m-help').addEventListener('click', () => { closeOverlay(); showScreen('screen-help'); });
    $('#m-quit').addEventListener('click', () => { Game.save(true); closeOverlay(); showScreen('screen-title'); });

    const KEYS = { ArrowUp: 'forward', KeyW: 'forward', ArrowDown: 'back', KeyS: 'back', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', KeyQ: 'strafeL', KeyE: 'strafeR', Space: 'attack', KeyF: 'attack' };
    const TAPS = { KeyU: 'use', KeyC: 'cast', KeyR: 'rest', KeyX: 'quaff' };
    const OPENS = { KeyM: 'map', KeyI: 'inv', KeyP: 'spells', KeyH: 'char', KeyJ: 'journal' };
    window.addEventListener('keydown', e => {
      const target = /** @type {HTMLElement} */ (e.target);
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT')) return;
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
    buildCreate();
    $('#c-seed').value = randomSeedWord();
    $('#btn-new').addEventListener('click', () => { Sound.unlock(); startNewGameFlow(); });
    $('#btn-continue').addEventListener('click', () => { Sound.unlock(); if (Game.load()) startPlaying(); });
    $('#btn-help').addEventListener('click', () => showScreen('screen-help'));
    $('#btn-hall').addEventListener('click', () => { renderHall(); showScreen('screen-hall'); });
    $('#btn-beasts').addEventListener('click', () => { $('#beasts-count').textContent = renderBestiary($('#beasts-list')); showScreen('screen-beasts'); });
    $('#beasts-back').addEventListener('click', () => showScreen('screen-title'));
    for (const t of $$('[data-jtab]')) t.addEventListener('click', () => { journalTab = t.dataset.jtab; renderJournal(); });
    $('#hall-back').addEventListener('click', () => showScreen('screen-title'));
    $('#hall-relics').addEventListener('click', () => { $('#relics-count').textContent = renderCodex($('#relics-list')); showScreen('screen-relics'); });
    $('#relics-back').addEventListener('click', () => { renderHall(); showScreen('screen-hall'); });
    $('#help-back').addEventListener('click', () => showScreen(Game.state() && Game.state().status === 'playing' ? 'screen-game' : 'screen-title'));
    $('#c-reroll').addEventListener('click', () => { create.rolled = Game.rollStats(); fitStats(); buildCreate(); });
    $('#c-seed-rand').addEventListener('click', () => { $('#c-seed').value = randomSeedWord(); });
    // a name for a hero who would rather not choose; never the same one twice running
    $('#c-name-rand').addEventListener('click', e => {
      e.preventDefault();
      const was = $('#c-name').value;
      let name = was;
      while (name === was) name = HERO_NAMES[Math.floor(Math.random() * HERO_NAMES.length)];
      $('#c-name').value = name;
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
    $('#end-share').addEventListener('click', () => {
      const G = Game.state(), key = G && G.opts.daily, st = key ? Daily.status(key) : null;
      if (!st || !st.done) return;
      const line = Daily.shareLine(key, st.done), out = $('#end-share-line');
      // the line is shown as well, to copy by hand if the clipboard says no
      out.textContent = line; out.style.display = '';
      copyText(line).then(ok => { $('#end-share').textContent = ok ? 'Copied: paste it anywhere' : 'Copy the line below'; });
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
    isPlaying: () => $('#screen-game').classList.contains('active'),
    isTitle: () => $('#screen-title').classList.contains('active') };
})();

export { UI };
