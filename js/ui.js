'use strict';
// DOM, touch controls, overlays and screens.

const UI = (() => {
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const held = new Set();
  let overlay = null;
  let create = { cls: 'fighter', stats: null };
  let selectedItem = null, selectedSlot = null;
  let logCount = -1, hudSig = '';

  function showScreen(id) {
    $$('.screen').forEach(s => s.classList.toggle('active', s.id === id));
    if (id === 'screen-title') refreshTitle();
  }
  function refreshTitle() {
    const s = Game.saveSummary();
    $('#btn-continue').disabled = !s;
    $('#save-summary').textContent = s ? `Saved: ${s.name} the ${s.cls}, level ${s.level}, dungeon level ${s.depth} (seed "${s.seed}")` : 'No saved game.';
  }

  // ---------- title art ----------
  function drawTitleArt() {
    const c = $('#title-art');
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const L = Dungeon.generate('title', 3, { levels: 8, size: 'small', monsters: 'few', treasure: 'normal', lockedDoors: true, traps: false });
    const s = L.start;
    const tmp = document.createElement('canvas');
    Renderer.init(tmp);
    const sprites = [];
    let placed = 0;
    const [dx, dy] = Dungeon.DIRS[s.dir];
    for (let i = 2; i <= 4 && placed < 2; i++) {
      const x = s.x + dx * i, y = s.y + dy * i;
      if (L.tiles[y * L.w + x] === Dungeon.T.FLOOR) { sprites.push({ x: x + 0.5, y: y + 0.5, img: Assets.sprites[placed ? 'goblin' : 'skeleton'], scale: 0.9 }); placed++; }
    }
    Renderer.render(L, { x: s.x + 0.5, y: s.y + 0.5, angle: s.dir * Math.PI / 2 - Math.PI / 2 }, sprites, { texts: [] }, 0);
    ctx.drawImage(tmp, 0, 0);
    Renderer.init($('#view'));
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
    const sig = [p.hp, p.maxHp, p.sp, p.maxSp, p.food, p.gold, G.depth, p.dir, p.level, !!p.poison, Game.effect('ac'), Game.effect('hit'), Game.effect('might')].join('|');
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
    $('#hud-depth').textContent = `Level ${G.depth}/${G.opts.levels}`;
    $('#hud-gold').textContent = `${p.gold} gold`;
    $('#hud-compass').textContent = ['N', 'E', 'S', 'W'][p.dir];
    const st = [];
    if (p.poison) st.push('<span class="bad">Poisoned</span>');
    if (Game.effect('ac')) st.push('<span class="good">Shielded</span>');
    if (Game.effect('hit')) st.push('<span class="good">Blessed</span>');
    if (Game.effect('might')) st.push('<span class="good">Mighty</span>');
    if (p.food === 0) st.push('<span class="bad">Starving</span>');
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
    const why = (b.kind === 'weapon' || b.kind === 'armor' || b.kind === 'shield') ? Game.canEquip(it) : null;
    box.innerHTML = `<h3>${escapeHtml(Game.itemName(it))}</h3><p class="dim small">${escapeHtml(info)}${why ? ' <span style="color:#f88">' + escapeHtml(why) + '</span>' : ''}</p><div class="buttons"></div>`;
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
      ? `${p.name} the ${CLASSES[p.cls].name} carried the Heart of the Mountain out of the deep.`
      : `${p.name} the ${CLASSES[p.cls].name} fell on level ${G.depth}. ${G.opts.permadeath ? 'The save has been erased.' : ''}`;
    const rows = [['Level', p.level], ['Experience', p.xp], ['Gold', p.gold], ['Kills', p.kills], ['Steps', p.steps], ['Deepest', p.deepest], ['Seed', G.seed]];
    $('#end-stats').innerHTML = rows.map(([k, v]) => `<div>${k}<span>${escapeHtml(String(v))}</span></div>`).join('');
    $('#end-load').style.display = (!won && !G.opts.permadeath && Game.hasSave()) ? '' : 'none';
    showScreen('screen-end');
  }

  // ---------- input ----------
  function bindControls() {
    for (const b of $$('.ctl[data-act]')) {
      const act = b.dataset.act;
      const down = e => { e.preventDefault(); Sound.unlock(); held.add(act); b.classList.add('held'); Game.input(act); };
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
      if (e === 'dead') showEnd(false);
      else if (e === 'won') showEnd(true);
      else if (e === 'inv' && overlay === 'inv') renderInv();
    }
  }

  function init() {
    drawTitleArt();
    buildCreate();
    $('#c-seed').value = randomSeedWord();
    $('#btn-new').addEventListener('click', () => { Sound.unlock(); create.stats = Game.rollStats(); buildCreate(); showScreen('screen-create'); });
    $('#btn-continue').addEventListener('click', () => { Sound.unlock(); if (Game.load()) startPlaying(); });
    $('#btn-help').addEventListener('click', () => showScreen('screen-help'));
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

  return { init, paused, pumpHeld, refreshHud, refreshLog, handleEvents, showScreen, isPlaying: () => $('#screen-game').classList.contains('active') };
})();
