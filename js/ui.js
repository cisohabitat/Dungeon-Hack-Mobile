'use strict';
// DOM, touch controls, overlays and screens.

const UI = (() => {
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const held = new Set();
  let overlay = null;
  let create = { cls: 'fighter', stats: null };
  let selectedItem = null, selectedSlot = null;
  let logCount = -1, hudSig = '', miniAt = 0, miniSig = '';

  function showScreen(id) {
    $$('.screen').forEach(s => s.classList.toggle('active', s.id === id));
    // the raycaster draws into whichever canvas is on screen
    if (id === 'screen-title') { Renderer.init($('#title-art')); title.t0 = 0; title.last = 0; refreshTitle(); }
    else if (id === 'screen-game') Renderer.init($('#view'));
  }
  function refreshTitle() {
    const s = Game.saveSummary();
    $('#btn-continue').disabled = !s;
    $('#save-summary').textContent = s ? `${s.name} the ${s.cls} · level ${s.level} · dungeon level ${s.depth}` : 'No saved game';
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
      b.innerHTML = `<b>${c.name}</b><small>${c.desc}</small>`;
      b.addEventListener('click', () => { create.cls = id; buildCreate(); });
      grid.appendChild(b);
    }
    if (!create.stats) create.stats = Game.rollStats();
    const st = $('#c-stats');
    st.innerHTML = '';
    for (const k in STAT_NAMES) {
      const v = create.stats[k];
      const m = Game.mod(v);
      const div = document.createElement('div');
      div.innerHTML = `${STAT_NAMES[k].slice(0, 3).toUpperCase()} <span>${v} (${m >= 0 ? '+' : ''}${m})</span>`;
      if (CLASSES[create.cls].primary === k) div.style.color = '#f2e2b8';
      st.appendChild(div);
    }
  }
  function beginGame() {
    const cfg = {
      name: $('#c-name').value,
      cls: create.cls,
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
    Game.newGame(cfg);
    Game.save(true);
    startPlaying();
  }
  function startPlaying() {
    logCount = -1; hudSig = '';
    closeOverlay();
    showScreen('screen-game');
    refreshLog(); refreshHud();
  }

  // ---------- HUD ----------
  function refreshHud() {
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
    $('#hud-depth').textContent = G.escaping ? (G.depth === 1 ? 'Find the stairs up' : `Climb: ${G.depth} to go`) : `Level ${G.depth}/${G.opts.levels}`;
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
  function refreshLog() {
    const G = Game.state();
    if (!G || G.log.length === logCount) return;
    logCount = G.log.length;
    const el = $('#log');
    el.innerHTML = G.log.slice(-4).map(e => `<div class="${e.c}">${escapeHtml(e.m)}</div>`).join('');
  }
  function escapeHtml(s) { return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

  // Small live automap in the corner of the view, 15x15 tiles around the player.
  function refreshMinimap(now) {
    if (now - miniAt < 120) return;
    miniAt = now;
    const L = Game.level(), p = Game.player();
    const R = 7, size = 6;
    const sig = [p.x, p.y, p.dir, L.depth].join(',');
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
      if (t === T.WALL || t === T.SECRET) col = '#5a5670';
      else if (t === T.TORCH) col = '#c08030';
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
  function renderLogHistory() {
    const G = Game.state();
    $('#log-history').innerHTML = '<div class="log-history">' + G.log.slice().reverse().map(e => `<div class="${e.c}">${escapeHtml(e.m)}</div>`).join('') + '</div>';
  }
  function renderHall() {
    const list = Game.hall();
    const el = $('#hall-list');
    if (!list.length) { el.innerHTML = '<p class="dim">No heroes have entered the deep yet. Their deeds will be recorded here.</p>'; return; }
    el.innerHTML = '<div class="hall">' + list.map((h, i) => `<div class="hall-row${h.won ? ' won' : ''}"><span class="rank">${i + 1}</span><span class="who">${escapeHtml(h.name)} the ${CLASSES[h.cls] ? CLASSES[h.cls].name : h.cls} ${h.level}<small>${h.won ? 'Claimed the Heart' : 'Fell on level ' + h.depth} · ${h.kills} kills · ${h.gold} gold · seed ${escapeHtml(h.seed)}</small></span><span class="score">${h.score}</span></div>`).join('') + '</div>';
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
  }
  function closeOverlay() {
    if (!overlay) return;
    $('#ov-' + overlay).classList.remove('open');
    overlay = null;
    selectedItem = null; selectedSlot = null;
  }
  function paused() { return !!overlay; }

  function slotEl(it, label) {
    const div = document.createElement('div');
    div.className = 'slot' + (it ? ' filled' : '');
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
    } else if (label) {
      const n = document.createElement('div'); n.textContent = '—'; div.appendChild(n);
    }
    return div;
  }
  function renderInv() {
    const p = Game.player();
    const eq = $('#equip');
    eq.innerHTML = '';
    for (const slot of ['weapon', 'armor', 'shield']) {
      const it = p.eq[slot];
      const el = slotEl(it, slot);
      if (it) el.addEventListener('click', () => { selectedItem = it; selectedSlot = slot; renderInv(); });
      if (selectedItem === it && it) el.classList.add('sel');
      eq.appendChild(el);
    }
    const grid = $('#inv-grid');
    grid.innerHTML = '';
    for (let i = 0; i < Game.INV_MAX; i++) {
      const it = p.inv[i];
      const el = slotEl(it, null);
      if (it) {
        el.addEventListener('click', () => { selectedItem = it; selectedSlot = null; renderInv(); });
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
        row.innerHTML = `<img src="${Assets.sprites[Game.spriteFor(it)].url}" alt=""><span>${escapeHtml(Game.itemName(it))}</span>`;
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
    let info = b.desc || '';
    if (b.kind === 'weapon') info = `Damage ${b.dmg[0]}d${b.dmg[1]}${b.dmg[2] ? '+' + b.dmg[2] : ''}${it.e ? ' +' + it.e : ''}, speed ${(b.speed / 1000).toFixed(1)}s${b.twoHanded ? ', two-handed' : ''}. Usable by ${b.cls.map(c => CLASSES[c].name + 's').join(', ')}.`;
    if (b.kind === 'armor') info = `Armor class +${b.ac + (it.e || 0)} (${b.weight}).`;
    if (b.kind === 'shield') info = `Armor class +${b.ac + (it.e || 0)}. Needs a free hand.`;
    if (b.kind === 'food') info = `Restores ${b.food} nourishment.`;
    if (!Game.isKnown(it.t)) info = 'You do not know what this does. Using it will reveal its nature.';
    const why = (b.kind === 'weapon' || b.kind === 'armor' || b.kind === 'shield') ? Game.canEquip(it) : null;
    const compare = selectedSlot ? '' : compareText(it, b);
    box.innerHTML = `<h3>${escapeHtml(Game.itemName(it))}</h3><p class="dim small">${escapeHtml(info)}${why ? ' <span style="color:#f88">' + escapeHtml(why) + '</span>' : ''}</p>${compare}<div class="buttons"></div>`;
    const btns = box.querySelector('.buttons');
    const add = (label, fn, cls) => { const bt = document.createElement('button'); bt.textContent = label; if (cls) bt.className = cls; bt.addEventListener('click', () => { fn(); selectedItem = null; selectedSlot = null; renderInv(); }); btns.appendChild(bt); };
    if (selectedSlot) add('Unequip', () => Game.unequip(selectedSlot));
    else {
      if (b.kind === 'weapon' || b.kind === 'armor' || b.kind === 'shield') { if (!why) add('Equip', () => Game.equip(it), 'primary'); }
      else if (b.kind === 'food') add('Eat', () => Game.useItem(it), 'primary');
      else if (b.kind === 'potion') add('Drink', () => Game.useItem(it), 'primary');
      else if (b.kind === 'scroll') add('Read', () => Game.useItem(it), 'primary');
      add('Drop', () => Game.dropItem(it), 'danger');
    }
    add('Close', () => {});
  }

  // How an unequipped piece of gear stacks up against the one in its slot.
  function compareText(it, b) {
    const p = Game.player();
    if (b.kind !== 'weapon' && b.kind !== 'armor' && b.kind !== 'shield') return '';
    const cur = p.eq[b.kind];
    if (cur === it) return '';
    const fmt = n => (n > 0 ? '+' : '') + (Math.round(n * 10) / 10);
    let label, delta;
    if (b.kind === 'weapon') {
      const dps = item => {
        if (!item) return 0;
        const d = ITEMS[item.t].dmg, sp = ITEMS[item.t].speed;
        return ((d[0] * (d[1] + 1) / 2) + d[2] + (item.e || 0) + Game.mod(p.stats.str)) / (sp / 1000);
      };
      const now = dps(cur), next = dps(it);
      label = cur ? `vs ${Game.itemName({ ...cur, q: 1 })}` : 'vs bare hands';
      delta = next - now;
      return `<p class="compare ${delta >= 0 ? 'up' : 'down'}">${escapeHtml(label)}: ${fmt(delta)} damage per second</p>`;
    }
    const acOf = item => (item ? ITEMS[item.t].ac + (item.e || 0) : 0);
    delta = acOf(it) - acOf(cur);
    label = cur ? `vs ${Game.itemName({ ...cur, q: 1 })}` : 'vs nothing worn';
    return `<p class="compare ${delta >= 0 ? 'up' : 'down'}">${escapeHtml(label)}: ${fmt(delta)} armor class</p>`;
  }

  function renderMap() {
    const L = Game.level(), p = Game.player();
    const c = $('#map-canvas');
    const avail = Math.min(window.innerWidth - 32, window.innerHeight - 140);
    const size = Math.max(4, Math.floor(avail / L.w));
    c.width = L.w * size; c.height = L.h * size;
    c.style.width = c.width + 'px';
    $('#map-title').textContent = `Level ${L.depth}: ${THEMES[L.theme].name}`;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#05050a'; ctx.fillRect(0, 0, c.width, c.height);
    const T = Dungeon.T;
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
      const i = y * L.w + x;
      if (!L.explored[i]) continue;
      const t = L.tiles[i];
      let col = null;
      switch (t) {
        case T.WALL: col = '#4a4660'; break;
        case T.FLOOR: col = '#1c1a26'; break;
        case T.DOOR: col = '#a0783c'; break;
        case T.DOOR_OPEN: col = '#6a5030'; break;
        case T.DOOR_LOCKED: col = KEY_COLORS[L.locks[x + ',' + y]] || '#c0a040'; break;
        case T.STAIRS_DOWN: col = '#e0c060'; break;
        case T.STAIRS_UP: col = '#80c0e0'; break;
        case T.SECRET: col = '#4a4660'; break;
        case T.TORCH: col = '#c08030'; break;
        case T.FOUNTAIN: col = '#4090e0'; break;
      }
      ctx.fillStyle = col; ctx.fillRect(x * size, y * size, size, size);
      if (t === T.STAIRS_DOWN || t === T.STAIRS_UP) {
        ctx.fillStyle = '#000'; ctx.font = `${size}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(t === T.STAIRS_DOWN ? '▼' : '▲', x * size + size / 2, y * size + size / 2 + 1);
      }
    }
    // items seen on explored tiles
    for (const k in L.items) {
      const [x, y] = k.split(',').map(Number);
      if (!L.explored[y * L.w + x] || !L.items[k].length) continue;
      ctx.fillStyle = '#e0d060'; ctx.fillRect(x * size + size * 0.3, y * size + size * 0.3, size * 0.4, size * 0.4);
    }
    // player arrow
    ctx.save();
    ctx.translate(p.x * size + size / 2, p.y * size + size / 2);
    ctx.rotate(p.dir * Math.PI / 2);
    ctx.fillStyle = '#ff6a50';
    ctx.beginPath(); ctx.moveTo(0, -size * 0.45); ctx.lineTo(size * 0.38, size * 0.4); ctx.lineTo(-size * 0.38, size * 0.4); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function renderSpells() {
    const list = $('#spell-list');
    const p = Game.player();
    const spells = Game.knownSpells();
    list.innerHTML = '';
    if (!spells.length) { list.innerHTML = `<p class="dim">${CLASSES[p.cls].name}s cannot cast spells, but anyone can read scrolls from their pack.</p>`; return; }
    list.innerHTML = `<p class="dim small">Spell points: <b>${p.sp}/${p.maxSp}</b>. They return slowly as you walk and fully when you rest.</p>`;
    for (const sp of spells) {
      const ok = Game.spellAvailable(sp);
      const b = document.createElement('button');
      b.className = 'spell' + (ok ? '' : ' locked');
      b.innerHTML = `<div class="cost">${sp.cost} sp</div><div><b>${sp.name}</b><small>${sp.desc}${ok ? '' : ` Requires level ${sp.lvl * 2 - 1}.`}</small></div>`;
      b.disabled = !ok;
      b.addEventListener('click', () => { if (Game.castSpell(sp)) closeOverlay(); else renderSpells(); });
      list.appendChild(b);
    }
  }

  function renderChar() {
    const p = Game.player(), c = CLASSES[p.cls], G = Game.state();
    const w = Game.weapon();
    const rows = [];
    const r = (k, v, full) => rows.push(`<div class="${full ? 'full' : ''}">${k}<span>${v}</span></div>`);
    r('Name', escapeHtml(p.name)); r('Class', c.name);
    r('Level', p.level); r('Experience', `${p.xp} / ${p.level < MAX_LEVEL ? XP_TABLE[p.level] : '—'}`);
    r('Hit points', `${p.hp} / ${p.maxHp}`); r('Spell points', p.maxSp ? `${p.sp} / ${p.maxSp}` : '—');
    r('Armor class', Game.playerAC()); r('To hit', (Game.toHit() >= 0 ? '+' : '') + Game.toHit());
    r('Weapon', `${w.name} ${w.dmg[0]}d${w.dmg[1]}${w.dmg[2] ? '+' + w.dmg[2] : ''}${w.e ? ' +' + w.e : ''}`);
    r('Gold', p.gold);
    for (const k in STAT_NAMES) { const m = Game.mod(p.stats[k]); r(STAT_NAMES[k], `${p.stats[k]} (${m >= 0 ? '+' : ''}${m})`); }
    r('Kills', p.kills); r('Steps', p.steps);
    r('Deepest level', p.deepest); r('Seed', escapeHtml(G.seed));
    $('#char-sheet').innerHTML = `<div class="sheet">${rows.join('')}</div>`;
  }

  function renderMenu() {
    const G = Game.state();
    $('#m-load').disabled = !Game.hasSave();
    $('#m-sound').textContent = 'Sound: ' + (Sound.isEnabled() ? 'On' : 'Off');
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
    const rows = [['Level', p.level], ['Experience', p.xp], ['Gold', p.gold], ['Kills', p.kills], ['Steps', p.steps], ['Deepest', p.deepest]];
    if (won && G.escapeMs) rows.push(['Escape', `${Math.round(G.escapeMs / 1000)}s`]);
    rows.push(['Seed', G.seed]);
    $('#end-stats').innerHTML = rows.map(([k, v]) => `<div>${k}<span>${escapeHtml(String(v))}</span></div>`).join('');
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
    $('#m-help').addEventListener('click', () => { closeOverlay(); showScreen('screen-help'); });
    $('#m-quit').addEventListener('click', () => { Game.save(true); closeOverlay(); showScreen('screen-title'); });

    const KEYS = { ArrowUp: 'forward', KeyW: 'forward', ArrowDown: 'back', KeyS: 'back', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', KeyQ: 'strafeL', KeyE: 'strafeR', Space: 'attack', KeyF: 'attack' };
    const TAPS = { KeyU: 'use', KeyC: 'cast', KeyR: 'rest' };
    const OPENS = { KeyM: 'map', KeyI: 'inv', KeyP: 'spells', KeyH: 'char' };
    window.addEventListener('keydown', e => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
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
  function pumpHeld() {
    if (overlay) return;
    for (const act of held) Game.input(act);
  }

  function handleEvents() {
    for (const e of Game.takeEvents()) {
      if (e === 'escape') { hudSig = ''; refreshHud(); }
      else if (e === 'dead') showEnd(false);
      else if (e === 'won') showEnd(true);
      else if (e === 'inv' && overlay === 'inv') renderInv();
    }
  }

  function init() {
    buildCreate();
    $('#c-seed').value = randomSeedWord();
    $('#btn-new').addEventListener('click', () => { Sound.unlock(); create.stats = Game.rollStats(); buildCreate(); showScreen('screen-create'); });
    $('#btn-continue').addEventListener('click', () => { Sound.unlock(); if (Game.load()) startPlaying(); });
    $('#btn-help').addEventListener('click', () => showScreen('screen-help'));
    $('#btn-hall').addEventListener('click', () => { renderHall(); showScreen('screen-hall'); });
    $('#hall-back').addEventListener('click', () => showScreen('screen-title'));
    $('#help-back').addEventListener('click', () => showScreen(Game.state() && Game.state().status === 'playing' ? 'screen-game' : 'screen-title'));
    $('#c-reroll').addEventListener('click', () => { create.stats = Game.rollStats(); buildCreate(); });
    $('#c-seed-rand').addEventListener('click', () => { $('#c-seed').value = randomSeedWord(); });
    $('#c-back').addEventListener('click', () => showScreen('screen-title'));
    $('#c-begin').addEventListener('click', beginGame);
    $('#end-load').addEventListener('click', () => { if (Game.load()) startPlaying(); });
    $('#end-new').addEventListener('click', () => { create.stats = Game.rollStats(); buildCreate(); showScreen('screen-create'); });
    $('#end-title-btn').addEventListener('click', () => showScreen('screen-title'));
    bindControls();
    refreshTitle();
    window.addEventListener('resize', () => { if (overlay === 'map') renderMap(); });
  }

  return { init, paused, pumpHeld, refreshHud, refreshLog, refreshMinimap, renderTitle, handleEvents, showScreen,
    isPlaying: () => $('#screen-game').classList.contains('active'),
    isTitle: () => $('#screen-title').classList.contains('active') };
})();
