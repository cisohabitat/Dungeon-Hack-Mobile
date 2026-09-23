import { randomSeedWord } from './rng.js';
import { PROLOGUE, BACKGROUNDS, JOURNAL, BOONS, XP_TABLE, MAX_LEVEL, CLASSES, STAT_NAMES, ITEMS, KEY_COLORS, MONSTERS, THEMES } from './data.js';
import { Assets } from './assets.js';
import { Dungeon } from './dungeon.js';
import { Renderer } from './renderer.js';
import { Sound } from './sound.js';
import { Game } from './game.js';
import { RELIC_POWERS } from './relics.js';

// DOM, touch controls, overlays and screens.

const UI = (() => {
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const held = new Set();
  let overlay = null;
  let create = { cls: 'fighter', bg: 'oathbroken', stats: null };
  let pendingCfg = null;
  let selectedItem = null, selectedSlot = null;
  let logCount = -1, hudSig = '', miniAt = 0, miniSig = '';

  function showScreen(id) {
    $$('.screen').forEach(s => s.classList.toggle('active', s.id === id));
    // the raycaster draws into whichever canvas is on screen
    if (id === 'screen-title') { Renderer.init($('#title-art')); title.t0 = 0; title.last = 0; refreshTitle(); }
    else if (id === 'screen-game') { Renderer.init($('#view')); fitView(); }
  }
  function refreshTitle() {
    const s = Game.saveSummary();
    $('#btn-continue').disabled = !s;
    $('#save-summary').textContent = s
      ? `${s.name} the ${s.cls}, level ${s.level}, on floor ${s.depth}`
      : 'No saved game';
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
    for (const id in BACKGROUNDS) {
      const b = BACKGROUNDS[id];
      const el = document.createElement('button');
      el.className = 'bg-card' + (id === create.bg ? ' sel' : '');
      el.type = 'button';
      el.setAttribute('aria-pressed', String(id === create.bg));
      el.innerHTML = `<b>${escapeHtml(b.name)}</b><small>${escapeHtml(b.blurb)}</small><em class="key">${escapeHtml(b.perk)}</em>`;
      el.addEventListener('click', () => { create.bg = id; buildCreate(); });
      bgGrid.appendChild(el);
    }
    $('#c-bg-perk').textContent = BACKGROUNDS[create.bg].perk;
    if (!create.stats) create.stats = Game.rollStats();
    const st = $('#c-stats');
    st.innerHTML = '';
    for (const k in STAT_NAMES) {
      const v = create.stats[k];
      const m = Game.mod(v);
      const div = document.createElement('div');
      const key = CLASSES[create.cls].primary === k;
      div.innerHTML = `${STAT_NAMES[k].slice(0, 3).toUpperCase()}${key ? ' \u2605' : ''} <span>${v} (${m >= 0 ? '+' : ''}${m})</span>`;
      if (key) { div.className = 'key-stat'; div.title = `Key stat for a ${CLASSES[create.cls].name}`; }
      st.appendChild(div);
    }
  }
  /** The best roll belongs in the class's key stat: a thief with 7 dexterity was a trap. */
  function fitStats() {
    const st = create.stats, keyStat = CLASSES[create.cls].primary;
    const best = Object.keys(st).reduce((a, b) => (st[b] > st[a] ? b : a), keyStat);
    [st[keyStat], st[best]] = [st[best], st[keyStat]];
  }
  function openCreation() {
    create.stats = Game.rollStats();
    fitStats();
    buildCreate();
    showScreen('screen-create');
  }
  /** A random hero with sensible numbers, straight to the prologue. */
  function quickStart() {
    const classes = Object.keys(CLASSES), pasts = Object.keys(BACKGROUNDS);
    // someone's very first run gets a class that forgives mistakes
    const firstRun = !Game.hall().length;
    const pool = firstRun ? ['fighter', 'cleric'] : classes;
    create.cls = pool[Math.floor(Math.random() * pool.length)];
    create.bg = pasts[Math.floor(Math.random() * pasts.length)];
    create.stats = Game.rollStats();
    fitStats();
    const NAMES = ['Wren', 'Tamsin', 'Oren', 'Brannoc', 'Idris', 'Maelis', 'Corvin', 'Hesk', 'Aldra', 'Fenn', 'Rook', 'Sabine'];
    showPrologue({ name: NAMES[Math.floor(Math.random() * NAMES.length)], cls: create.cls, bg: create.bg, stats: create.stats, seed: randomSeedWord(),
      opts: { levels: 8, size: 'medium', monsters: 'normal', treasure: 'normal', lockedDoors: true, traps: true, permadeath: false } });
  }
  let quickPending = false;
  /** A run in progress is a real investment, so never discard one silently. */
  function startNewGameFlow(quick) {
    quickPending = !!quick;
    const saved = Game.saveSummary();
    if (!saved) { if (quick) quickStart(); else openCreation(); return; }
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
    showScreen('screen-prologue');
  }
  function beginGame() {
    const cfg = {
      name: $('#c-name').value,
      cls: create.cls,
      bg: create.bg,
      stats: create.stats,
      seed: ($('#c-seed').value || '').trim() || randomSeedWord(),
      opts: {
        levels: parseInt($('#c-levels').value, 10),
        size: $('#c-size').value,
        monsters: $('#c-monsters').value,
        treasure: $('#c-treasure').value,
        lockedDoors: $('#c-locked').checked,
        traps: $('#c-traps').checked,
        permadeath: $('#c-permadeath').checked,
      },
    };
    showPrologue(cfg);
  }
  function commitGame() {
    if (!pendingCfg) return;
    Game.newGame(pendingCfg);
    pendingCfg = null;
    Game.save(true);
    startPlaying();
  }
  function startPlaying() {
    logCount = -1; hudSig = '';
    closeOverlay();
    showScreen('screen-game');
    refreshLog(); refreshHud();
  }

  // ---------- first-moment tips ----------
  // One short tip the first time each thing happens, on this device: shown
  // over the view where the eye already is, never catching a tap, and gone
  // after a few seconds. The menu turns them off, or back on from the start.
  const TIPS_SEEN = 'deepdelve.tipsSeen', TIPS_OFF = 'deepdelve.tipsOff';
  const TIPS = {
    controls: 'Move with the arrows, or swipe the view. <b>⚔ Attack</b> strikes what is in front of you; <b>✋ Use</b> does whatever it says.',
    monster: 'Something is coming. Face it and tap <b>⚔ Attack</b>. When a <b>warning mark</b> appears over it, step back and the blow misses.',
    take: 'Something lies here. Tap <b>✋ Take</b> to pick it up.',
    stairs: 'Stairs down. Tap <b>Descend</b> when you are ready. The Heart waits at the bottom.',
    examine: 'Something to deal with. Tap <b>Examine</b>: every choice shows its odds before you commit.',
    trade: 'A trader. Tap <b>Trade</b> to buy, sell and ask about services.',
    unknown: 'A <b>?</b> in your pack means you do not know how good that gear is. <b>Study</b> it, or have a trader appraise it: cursed gear will not come off once worn.',
    hurt: 'You are badly hurt. Drink a healing potion from the <b>Pack</b>, or <b>Rest</b> when nothing is near.',
  };
  let tipsSeen = null, tipAt = 0, tipUntil = 0, tipCheckAt = 0;
  const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* private browsing */ } return null; };
  function tipsOn() { return store(TIPS_OFF) !== '1'; }
  function showTip(id) {
    if (!tipsOn()) return false;
    if (!tipsSeen) { try { tipsSeen = JSON.parse(store(TIPS_SEEN) || '[]'); } catch (e) { tipsSeen = []; } }
    if (tipsSeen.includes(id)) return false;
    const el = $('#tip');
    if (!el || performance.now() < tipUntil) return false;      // one at a time
    tipsSeen.push(id);
    store(TIPS_SEEN, JSON.stringify(tipsSeen));
    el.innerHTML = TIPS[id];
    el.dataset.tip = id;
    el.classList.add('show');
    tipAt = performance.now();
    tipUntil = tipAt + 7000;
    return true;
  }
  function checkTips() {
    const now = performance.now();
    const el = $('#tip');
    if (el && el.classList.contains('show') && now > tipUntil) el.classList.remove('show');
    if (now < tipCheckAt || overlay || !Game.state() || Game.state().status !== 'playing') return;
    tipCheckAt = now + 250;
    const p = Game.player(), L = Game.level();
    if (showTip('controls')) return;
    if (L.monsters.some(m => m.awake && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) <= 3) && showTip('monster')) return;
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
    const sig = [p.hp, p.maxHp, p.sp, p.maxSp, p.food, p.gold, G.depth, p.dir, p.level, !!p.poison, Game.effect('ac'), Game.effect('hit'), Game.effect('might'), p.x, p.y, champ ? champ.uid : 0, !!G.escaping].join('|');
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
    $('#hud-depth').textContent = G.escaping ? (G.depth === 1 ? 'Find the stairs up' : `Climb: ${G.depth} to go`) : `Floor ${G.depth}/${G.opts.levels}`;
    $('#hud-depth').classList.toggle('escaping', !!G.escaping);
    $('#hud-gold').textContent = `${p.gold} gold`;
    $('#hud-compass').textContent = ['N', 'E', 'S', 'W'][p.dir];
    const st = [];
    if (p.poison) st.push('<span class="bad">Poisoned</span>');
    if (Game.effect('ac')) st.push('<span class="good">Shielded</span>');
    if (Game.effect('hit')) st.push('<span class="good">Blessed</span>');
    if (Game.effect('might')) st.push('<span class="good">Mighty</span>');
    if (G.escaping) st.push('<span class="escape">Carrying the Heart</span>');
    if (p.food === 0) st.push('<span class="bad">Starving</span>');
    if (champ) st.push(`<span class="bad">${escapeHtml(Game.mstat(champ).name)} near</span>`);
    $('#hud-status').innerHTML = st.join('');
  }
  // The Use button names what it will do: a staircase you are facing should
  // say Descend, not leave you to guess that Use means it.
  let useSig = '';
  function refreshUse() {
    refreshCast();
    const label = Game.useLabel();
    if (label === useSig) return;
    useSig = label;
    const btn = document.querySelector('[data-tap="use"]');
    if (!btn) return;
    btn.querySelector('small').textContent = label;
    btn.setAttribute('aria-label', label);
    btn.classList.toggle('ctx', label !== 'Use' && label !== 'Search');
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
    el.innerHTML = G.log.slice(-4).map(e => `<div class="${e.c}">${logLine(e.m)}</div>`).join('');
    // Lines wrap on a narrow phone, so four of them can overflow the panel.
    // Drop whole old lines rather than leave half of one clipped at the top;
    // the full history is a tap away. The panel stacks from the bottom, so
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
  function refreshMinimap(now) {
    if (now - miniAt < 120) return;
    miniAt = now;
    const L = Game.level(), p = Game.player();
    const R = 7, size = 6;
    const sig = [p.x, p.y, p.dir, L.depth, L.monsters.length].join(',');
    if (sig === miniSig) return;
    const c = $('#minimap');
    const ctx = c.getContext('2d');
    const T = Dungeon.T;
    ctx.fillStyle = 'rgba(5,5,10,0.6)';
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
    if (!r) return plainBlurb(it);
    return `${ITEMS[it.t].name}. ${plainBlurb(it)}. ${r.powers.map(k => RELIC_POWERS[k].split(':')[0]).join(', ')}`;
  }
  function plainBlurb(it) {
    const b = ITEMS[it.t];
    if (!Game.isKnown(it.t)) return 'You do not know what this does';
    if (b.kind === 'weapon') {
      const d = b.dmg;
      const sp = b.speed * (swiftOf(it) ? 0.85 : 1);
      return `Damage ${d[0]}d${d[1]}${d[2] ? '+' + d[2] : ''}${enchText(it)}, ${(sp / 1000).toFixed(sp % 100 ? 2 : 1)}s${b.range ? `, reaches ${b.range}` : ''}${b.twoHanded ? ', two-handed' : ''}`;
    }
    if (b.kind === 'armor') return `Armor class +${b.ac + knownE(it)}${it.h ? '?' : ''} (${b.weight})`;
    if (b.kind === 'shield') return `Armor class +${b.ac + knownE(it)}${it.h ? '?' : ''}, needs a free hand`;
    if (b.kind === 'food') return `Restores ${b.food} nourishment`;
    return b.desc || '';
  }

  // what the player knows of an enchantment: nothing, while it is hidden
  const knownE = it => (it.h ? 0 : (it.e || 0));
  const enchText = it => (it.h ? ' ?' : it.e > 0 ? ` +${it.e}` : it.e < 0 ? ` −${-it.e}` : '');
  const swiftOf = it => { const r = Game.relicOf(it); return !!r && r.powers.includes('swift'); };

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
    btn.addEventListener('click', () => { onClick(); renderShop(); });
    row.appendChild(btn);
    return row;
  }
  function renderShop() {
    const s = Game.currentShop();
    if (!s) { closeOverlay(); return; }
    const p = Game.player();
    // say what charisma is doing to the prices, or it is invisible
    const charm = Math.round(Game.charm() * 100);
    $('#shop-gold').textContent = `${p.gold} gold` + (charm > 0 ? ` · your charm: ${charm}% off` : charm < 0 ? ` · your manner: ${-charm}% dearer` : '');
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
      btn.textContent = sv.why ? '—' : `${sv.price}g`;
      btn.disabled = !!sv.why || p.gold < sv.price;
      if (!btn.disabled) btn.className = 'afford';
      btn.setAttribute('aria-label', `${sv.label}${sv.why ? '' : ` for ${sv.price} gold`}`);
      btn.addEventListener('click', () => { Game.buyService(sv.id); renderShop(); });
      row.appendChild(btn);
      svc.appendChild(row);
    }
    const sellBox = $('#shop-sell');
    sellBox.innerHTML = '';
    const sellable = p.inv.filter(it => it.t !== 'artifact' && it.t !== 'key');
    if (!sellable.length) sellBox.innerHTML = '<div class="shop-empty">Nothing in your pack the trader wants.</div>';
    for (const it of sellable) {
      const price = Game.sellPrice(it);
      sellBox.appendChild(shopRow(it, price, 'Sell', true, () => Game.sell(it), it.q > 1 ? `You carry ${it.q}` : itemBlurb(it)));
    }
  }

  function renderJournal() {
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
  function renderBoons() {
    const offer = Game.pendingBoons();
    if (!offer) { closeOverlay(); return; }
    const p = Game.player();
    $('#boon-title').textContent = `Hero level ${p.level}: what the delve taught you`;
    const el = $('#boon-list');
    el.innerHTML = '';
    for (const id of offer) {
      const b = BOONS.find(x => x.id === id);
      if (!b) continue;
      const btn = document.createElement('button');
      btn.className = 'boon';
      btn.innerHTML = `<b>${escapeHtml(b.name)}</b><small>${escapeHtml(b.desc)}</small>`;
      btn.addEventListener('click', () => {
        Game.chooseBoon(id);
        if (Game.pendingBoons()) renderBoons(); else closeOverlay();
      });
      el.appendChild(btn);
    }
  }

  function renderLogHistory() {
    const G = Game.state();
    $('#log-history').innerHTML = '<div class="log-history">' + G.log.slice().reverse().map(e => `<div class="${e.c}">${logLine(e.m)}</div>`).join('') + '</div>';
  }
  function renderHall() {
    const list = Game.hall();
    const el = $('#hall-list');
    if (!list.length) { el.innerHTML = '<p class="dim">No heroes have entered the deep yet. Their deeds will be recorded here.</p>'; return; }
    el.innerHTML = '<div class="hall">' + list.map((h, i) => `<div class="hall-row${h.won ? ' won' : ''}"><span class="rank">${i + 1}</span><span class="who">${escapeHtml(h.name)} the ${CLASSES[h.cls] ? CLASSES[h.cls].name : h.cls} ${h.level}<small>${h.won ? 'Claimed the Heart' : 'Fell on level ' + h.depth} · ${h.kills} kills · ${h.gold} gold · seed ${escapeHtml(h.seed)}</small></span><span class="score">${h.score}<small>SCORE</small></span></div>`).join('') + '</div>';
  }

  // ---------- overlays ----------
  function openOverlay(name) {
    closeOverlay();
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
  function closeOverlay() {
    if (!overlay) return;
    if (overlay === 'boons' && Game.pendingBoons()) return;   // a choice must be made
    // an encounter must be answered: every one offers a way to leave, so
    // backing out would only be a free look at the odds
    if (overlay === 'encounter') { const e = Game.currentEncounter(); if (e && !e.result) return; Game.closeEncounter(); }
    if (overlay === 'shop') Game.closeShop();
    $('#ov-' + overlay).classList.remove('open');
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
    const why = (b.kind === 'weapon' || b.kind === 'armor' || b.kind === 'shield') ? Game.canEquip(it) : null;
    const compare = selectedSlot ? '' : compareText(it, b);
    // a relic spells out each power in full, then tells its story
    const r = Game.relicOf(it);
    const legend = r ? `<ul class="relic-powers">${r.powers.map(k => `<li>${escapeHtml(RELIC_POWERS[k])}</li>`).join('')}</ul><p class="relic-lore">${escapeHtml(r.lore)}</p>` : '';
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
      else if (b.kind === 'food') add('Eat', () => Game.useItem(it), 'primary');
      else if (b.kind === 'potion') add('Drink', () => Game.useItem(it), 'primary');
      else if (b.kind === 'scroll') add('Read', () => Game.useItem(it), 'primary');
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
        const base = Game.mod(finesse ? p.stats.dex : p.stats.str) + Game.skillDamage();
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
      b.innerHTML = `<div class="cost">${sp.cost} sp</div><div><b>${sp.name}</b>${ready ? '<em class="on-cast">On the Cast button</em>' : ''}<small>${sp.desc}${ok ? '' : ` Requires level ${sp.lvl * 2 - 1}.`}</small></div>`;
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
    if (p.boons && p.boons.length) {
      const names = p.boons.map(id => { const b = BOONS.find(x => x.id === id); return b ? b.name : id; });
      r('Learned', escapeHtml(names.join(', ')), true);
    }
    $('#char-sheet').innerHTML = `<div class="sheet">${rows.join('')}</div>`;
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
    $('#m-sound').textContent = 'Sound: ' + (Sound.isEnabled() ? 'On' : 'Off');
    $('#m-rolls').textContent = 'Combat rolls: ' + (Game.rollsShown() ? 'On' : 'Off');
    $('#m-text').textContent = 'Text size: ' + TEXT_SIZES[textSize()].label;
    $('#m-tips').textContent = 'Tips: ' + (tipsOn() ? 'On' : 'Off');
    $('#m-seed').textContent = `Seed "${G.seed}" · ${G.opts.levels} levels · ${G.opts.size} · ${G.opts.permadeath ? 'permadeath' : 'reload allowed'}`;
  }

  // ---------- end screens ----------
  function showEnd(won) {
    const G = Game.state(), p = G.player;
    closeOverlay();
    $('#end-title').textContent = won ? 'VICTORY' : 'YOU HAVE DIED';
    $('#end-text').textContent = won
      ? `${p.name} the ${CLASSES[p.cls].name} climbed out of the deep with the Heart of the Mountain.`
      : (G.escaping
        ? `${p.name} the ${CLASSES[p.cls].name} died on level ${G.depth} with the Heart still in hand. ${G.opts.permadeath ? 'The save has been erased.' : ''}`
        : `${p.name} the ${CLASSES[p.cls].name} fell on level ${G.depth}. ${G.opts.permadeath ? 'The save has been erased.' : ''}`);
    const rows = [['Hero level', p.level], ['Experience', p.xp], ['Gold', p.gold], ['Kills', p.kills], ['Steps', p.steps], ['Deepest floor', p.deepest]];
    if (won && G.escapeMs) rows.push(['Escape', `${Math.round(G.escapeMs / 1000)}s`]);
    rows.unshift(['Score', Game.score(p, G.depth, won)]);
    rows.push(['Seed', G.seed]);
    $('#end-stats').innerHTML = rows.map(([k, v]) => `<div>${k}<span>${escapeHtml(String(v))}</span></div>`).join('');
    const cause = $('#end-cause');
    const killer = Game.lastAttacker();
    if (!won && killer && killer.encounter) {
      cause.innerHTML = `Died at <b>${escapeHtml(killer.name)}</b>, when a choice went wrong (${killer.dmg} damage).`;
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
    showScreen('screen-end');
  }

  // ---------- input ----------
  function bindControls() {
    for (const b of $$('.ctl[data-act]')) {
      const act = b.dataset.act;
      const down = e => { e.preventDefault(); Sound.unlock(); try { b.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } held.add(act); b.classList.add('held'); Game.input(act); };
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
    $('#log').addEventListener('click', () => openOverlay('log'));

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
    $('#m-load').addEventListener('click', () => { if (Game.load()) startPlaying(); });
    $('#m-sound').addEventListener('click', () => { Sound.toggle(); renderMenu(); });
    $('#m-rolls').addEventListener('click', () => { Game.toggleRolls(); renderMenu(); });
    $('#m-text').addEventListener('click', () => { setTextSize((textSize() + 1) % TEXT_SIZES.length); renderMenu(); });
    // turning tips back on starts them over, for a player who wants the tour again
    $('#m-tips').addEventListener('click', () => { if (tipsOn()) store(TIPS_OFF, '1'); else { store(TIPS_OFF, null); store(TIPS_SEEN, null); tipsSeen = null; } renderMenu(); });
    $('#m-help').addEventListener('click', () => { closeOverlay(); showScreen('screen-help'); });
    $('#m-quit').addEventListener('click', () => { Game.save(true); closeOverlay(); showScreen('screen-title'); });

    const KEYS = { ArrowUp: 'forward', KeyW: 'forward', ArrowDown: 'back', KeyS: 'back', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', KeyQ: 'strafeL', KeyE: 'strafeR', Space: 'attack', KeyF: 'attack' };
    const TAPS = { KeyU: 'use', KeyC: 'cast', KeyR: 'rest' };
    const OPENS = { KeyM: 'map', KeyI: 'inv', KeyP: 'spells', KeyH: 'char', KeyJ: 'journal' };
    window.addEventListener('keydown', e => {
      const target = /** @type {HTMLElement} */ (e.target);
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT')) return;
      if (!$('#screen-game').classList.contains('active')) return;
      if (e.code === 'Escape') { if (overlay) closeOverlay(); else openOverlay('menu'); e.preventDefault(); return; }
      if (overlay) { if (OPENS[e.code] === overlay) closeOverlay(); return; }
      if (KEYS[e.code]) { e.preventDefault(); if (!e.repeat) { held.add(KEYS[e.code]); Game.input(KEYS[e.code]); } }
      else if (TAPS[e.code]) { e.preventDefault(); Game.input(TAPS[e.code]); }
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
    for (const act of held) Game.input(act);
  }

  function handleEvents() {
    for (const e of Game.takeEvents()) {
      if (e === 'boons') { if (overlay === 'boons') renderBoons(); else openOverlay('boons'); }
      else if (e === 'boonsDone') { if (overlay === 'boons') closeOverlay(); }
      else if (e === 'page' && overlay === 'journal') renderJournal();
      else if (e === 'shop') openOverlay('shop');
      else if (e === 'encounter') { if (overlay === 'encounter') renderEncounter(); else if (Game.currentEncounter()) openOverlay('encounter'); }
      else if (e === 'escape') { hudSig = ''; refreshHud(); }
      else if (e === 'dead') showEnd(false);
      else if (e === 'won') showEnd(true);
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
    $('#hall-back').addEventListener('click', () => showScreen('screen-title'));
    $('#help-back').addEventListener('click', () => showScreen(Game.state() && Game.state().status === 'playing' ? 'screen-game' : 'screen-title'));
    $('#c-reroll').addEventListener('click', () => { create.stats = Game.rollStats(); fitStats(); buildCreate(); });
    $('#c-seed-rand').addEventListener('click', () => { $('#c-seed').value = randomSeedWord(); });
    $('#c-back').addEventListener('click', () => showScreen('screen-title'));
    $('#c-begin').addEventListener('click', beginGame);
    $('#pro-begin').addEventListener('click', commitGame);
    $('#end-load').addEventListener('click', () => { if (Game.load()) startPlaying(); });
    $('#end-new').addEventListener('click', () => startNewGameFlow());
    $('#confirm-keep').addEventListener('click', () => { if (Game.load()) startPlaying(); });
    $('#confirm-replace').addEventListener('click', () => { if (quickPending) quickStart(); else openCreation(); });
    $('#btn-quick').addEventListener('click', () => { Sound.unlock(); startNewGameFlow(true); });
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
