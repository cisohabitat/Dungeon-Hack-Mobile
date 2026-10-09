// The map overlay: the explored floor drawn to fill the room it has, its key, and
// zooming in about the hero by button or pinch. ui.js opens it, and lends what it
// needs through K.
import { KEY_COLORS, THEMES } from './data.js';
import { Dungeon } from './dungeon.js';
import { Game } from './game.js';
import { $, escapeHtml } from './uikit.js';

/** @param {any} K */
export function makeMapView(K) {
  const testingSet = (/** @type {any[]} */ ...a) => K.testingSet(...a);

  // Colours and shapes the legend below the map also uses, so the two cannot
  // drift apart.
  const MAP_KEY = [
    { id: 'player', colour: '#ff6a50', label: 'You' },
    // shown only while a hound is with you on the floor
    { id: 'hound', colour: '#f2ecdc', label: 'Your companion' },
    // shown only with Show every monster on (Menu, for testing)
    { id: 'monster', colour: '#ff3a30', label: 'Monster (! awake, z asleep)' },
    { id: 'down', colour: '#ffd24a', label: 'Stairs down' },
    { id: 'up', colour: '#86d870', label: 'Stairs up' },
    { id: 'door', colour: '#c08a3e', label: 'Door' },
    { id: 'locked', colour: '#d0409a', label: 'Locked door (\u25cf its key\'s colour)' },
    { id: 'fountain', colour: '#49a6f0', label: 'Fountain' },
    { id: 'trader', colour: '#b57ae0', label: 'Trader' },
    { id: 'loot', colour: '#5ad0c0', label: 'Something here' },
    { id: 'trap', colour: '#e05050', label: 'Trap you know of (\u00d7)' },
    // the ground walked is the lighter, as paths are on any map: walls picked out
    // brighter than the floor read as the corridors at a glance
    { id: 'floor', colour: '#6c6688', label: 'Explored' },
    { id: 'wall', colour: '#2e2a3a', label: 'Wall' },
    { id: 'torch', colour: '#ffb45a', label: 'Torch (*)' },
  ];
  const MAP_COLOUR = Object.fromEntries(MAP_KEY.map(k => [k.id, k.colour]));

  const MAP_TILE_MAX = 28;
  // how far the map is zoomed in (1, the whole of what is known) and how far
  // its frame has been dragged from the hero, in squares
  const mapView = { zoom: 1, panX: 0, panY: 0 };
  /** Zoom the map by a factor, about the hero. @param {number} k */
  function zoomMap(k) {
    mapView.zoom = Math.max(1, Math.min(6, mapView.zoom * k));
    if (mapView.zoom === 1) { mapView.panX = 0; mapView.panY = 0; }
    renderMap();
  }
  /** Two fingers pinch the map in and out; one drags it about once it is zoomed in. */
  function wireMapPinch() {
    const c = /** @type {HTMLCanvasElement} */ ($('#map-canvas'));
    /** @type {Map<number, {x: number, y: number}>} */
    const down = new Map();
    let pinch = null, drag = null;
    const spread = () => { const [a, b] = [...down.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
    c.addEventListener('pointerdown', e => {
      down.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { c.setPointerCapture(e.pointerId); } catch (err) { /* a synthetic pointer */ }
      if (down.size === 2) { pinch = { d: spread(), zoom: mapView.zoom }; drag = null; }
      else if (down.size === 1) drag = { x: e.clientX, y: e.clientY, panX: mapView.panX, panY: mapView.panY };
    });
    c.addEventListener('pointermove', e => {
      if (!down.has(e.pointerId)) return;
      down.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && down.size === 2) {
        const z = Math.max(1, Math.min(6, pinch.zoom * spread() / Math.max(1, pinch.d)));
        if (Math.abs(z - mapView.zoom) > 0.04) { mapView.zoom = z; if (z === 1) { mapView.panX = 0; mapView.panY = 0; } renderMap(); }
      } else if (drag && mapView.zoom > 1) {
        const t = Number(c.dataset.tile) || 16;
        mapView.panX = drag.panX - (e.clientX - drag.x) / t; mapView.panY = drag.panY - (e.clientY - drag.y) / t;
        renderMap();
      }
    });
    const up = e => { down.delete(e.pointerId); if (down.size < 2) pinch = null; if (!down.size) drag = null; };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
  }
  let mapRedrawn = false;
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
    // every monster shown, the map reaches to the farthest of them
    const eye = testingSet().eye;
    if (eye) for (const m of L.monsters) { minX = Math.min(minX, m.x); maxX = Math.max(maxX, m.x); minY = Math.min(minY, m.y); maxY = Math.max(maxY, m.y); }
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
    const availW = Math.min(window.innerWidth, body.clientWidth || window.innerWidth) - 24, availH = room > 0 ? room - keyH - 8 : window.innerHeight - 230;
    // ...but not so large that the first few squares of a floor read as a close-up
    // rather than the start of a map, unless the hero has zoomed in on it
    const fit = Math.max(8, Math.min(MAP_TILE_MAX, Math.floor(Math.min(availW / cols, availH / rows))));
    const size = Math.max(8, Math.min(64, Math.round(fit * mapView.zoom)));
    // The frame fills the room it has, whatever has been walked: what lies
    // outside the known ground is dark, as it should be. Zoomed in, the frame
    // is centred on the hero, and a drag moves it about.
    const fitCols = Math.max(1, Math.floor(availW / size)), fitRows = Math.max(1, Math.floor(availH / size));
    const focusX = mapView.zoom > 1 ? p.x + 0.5 + mapView.panX : (minX + maxX + 1) / 2;
    const focusY = mapView.zoom > 1 ? p.y + 0.5 + mapView.panY : (minY + maxY + 1) / 2;
    minX = Math.round(focusX - fitCols / 2); minY = Math.round(focusY - fitRows / 2);
    c.width = fitCols * size; c.height = fitRows * size;
    c.style.width = c.width + 'px';
    const ox = minX * size, oy = minY * size;
    c.dataset.tile = String(size);
    c.dataset.originX = String(minX);
    c.dataset.originY = String(minY);
    $('#map-in').disabled = size >= 64;
    $('#map-out').disabled = mapView.zoom <= 1;
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
        const t = L.caved && L.caved.includes(i) ? T.WALL : L.tiles[i];
        let col = MAP_COLOUR.floor, mark = null, markColour = '#000';
        switch (t) {
          case T.WALL: case T.SECRET: col = MAP_COLOUR.wall; break;
          case T.TORCH: col = MAP_COLOUR.wall; mark = '*'; markColour = MAP_COLOUR.torch; break;
          case T.FLOOR: col = MAP_COLOUR.floor; break;
          case T.DOOR: col = MAP_COLOUR.door; mark = '+'; break;
          case T.DOOR_OPEN: col = '#7a5a34'; mark = "'"; break;
          case T.DOOR_LOCKED:
            col = MAP_COLOUR.locked;
            // a dot in its key's colour: a cross here read as the trap's mark
            mark = '\u25cf';
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
    // traps an encounter told of, and a kobold's snares (seen where they lie), so the hero can go round them
    for (const k in (L.trapsKnown ? L.traps : (L.snares || {}))) {
      const [x, y] = k.split(',').map(Number);
      edged(x * size - ox + size * 0.15, y * size - oy + size * 0.15, size * 0.7, size * 0.7, MAP_COLOUR.trap);
      glyph('\u00d7', x, y, '#fff4ec');
    }
    for (const n of (L.npcs || [])) {
      if (!L.explored[n.y * L.w + n.x]) continue;
      edged(n.x * size - ox, n.y * size - oy, size, size, MAP_COLOUR.trader);
      glyph('\u00a4', n.x, n.y, '#2a1a38');
    }

    // every monster, awake or asleep, seen or not, for whoever is testing
    if (eye) for (const m of L.monsters) {
      edged(m.x * size - ox + size * 0.1, m.y * size - oy + size * 0.1, size * 0.8, size * 0.8, MAP_COLOUR.monster);
      glyph(m.awake ? '!' : 'z', m.x, m.y, '#fff4ec');
    }
    const mk = /** @type {HTMLElement|null} */ ($('#map-legend [data-key="monster"]'));
    if (mk) mk.hidden = !eye;
    $('#map-note').textContent = eye ? 'Explored ground, and every monster (a testing aid). You are the ringed square.' : 'Explored ground only. You are the ringed square.';

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
    // The key under the map wraps to the width the map had before this drawing:
    // on a narrow phone it took a line more the first time the map opened, and
    // the map came out smaller than after any zoom. Measured again, once.
    const keyNow = outer($('#map-legend')) + outer(/** @type {HTMLElement} */ ($('#map-legend').nextElementSibling));
    if (!mapRedrawn && Math.abs(keyNow - keyH) > 1) { mapRedrawn = true; renderMap(); mapRedrawn = false; }
  }

  /** 'oil' or 'water' (a puddle; a flooded floor has its own chip) when the hero stands in it, else ''. */
  function underfoot() {
    const p = Game.player(), L = Game.level(), f = Game.fieldAt(p.x, p.y);
    if (f && f.k === 'oil') return 'oil';
    return L.twist !== 'flooded' && Game.wet(p.x, p.y) ? 'water' : '';
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

  return { MAP_COLOUR, houndHere, mapView, renderMap, underfoot, wireMapPinch, zoomMap };
}
