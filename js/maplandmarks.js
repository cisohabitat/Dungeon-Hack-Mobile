// Known landmarks only. Resolved encounters are remembered on this device.
import { Game } from './game.js';
import { Dungeon } from './dungeon.js';
import { ENCOUNTERS } from './encounters.js';
import { escapeHtml } from './uikit.js';
import { visitedPlace } from './rooms.js';
const KEY = 'deepdelve.landmarks', SHRINES = new Set(['shrine', 'spider_altar', 'vigil', 'vigil_dark']);
let run = '', memory = [];
const idOf = n => `${n.depth}:${n.x},${n.y}:${n.id}`;
function context() {
  const G = Game.state(); if (!G) return;
  const id = JSON.stringify([G.created, G.seed, G.player.name]);
  if (id === run) return;
  run = id; memory = [];
  try {
    const raw = localStorage.getItem(KEY), v = raw && raw.length < 100000 ? JSON.parse(raw) : null;
    if (v?.run === run && Array.isArray(v.memory)) memory = v.memory.filter(n => n && Number.isInteger(n.depth) && n.depth >= 1 && n.depth <= 16 && Number.isInteger(n.x) && n.x >= 0 && n.x < 256 && Number.isInteger(n.y) && n.y >= 0 && n.y < 256 && typeof n.id === 'string' && Object.hasOwn(ENCOUNTERS, n.id)).slice(0, 512).map(n => ({ depth: n.depth, x: n.x, y: n.y, id: n.id }));
  } catch { /* Map memory is optional; the known floor still works. */ }
}
export function rememberLandmarks() {
  context(); const G = Game.state(); if (!G) return;
  const L = Game.level(); let changed = false;
  for (const n of L.npcs || []) {
    if (n.kind !== 'encounter' || !Object.hasOwn(ENCOUNTERS, n.id) || !L.explored[n.y * L.w + n.x]) continue;
    const row = { depth: G.depth, x: n.x, y: n.y, id: n.id };
    if (memory.length < 512 && !memory.some(m => idOf(m) === idOf(row))) { memory.push(row); changed = true; }
  }
  if (changed) try { localStorage.setItem(KEY, JSON.stringify({ run, memory })); } catch { /* private browsing */ }
}
export function knownLandmarks() {
  rememberLandmarks(); const G = Game.state(), L = Game.level(), T = Dungeon.T, rows = [];
  const add = (x, y, type, name, status, id = type) => {
    if (x < 0 || y < 0 || x >= L.w || y >= L.h || !L.explored[y * L.w + x]) return;
    rows.push({ x, y, type, name, status, key: `${x},${y}:${id}` });
  };
  for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
    const tile = L.tiles[y * L.w + x];
    if (tile === T.DOOR_LOCKED) add(x, y, 'locked', 'Locked door', `${L.locks[x + ',' + y] || 'brass'} key needed`);
    if (tile === T.FOUNTAIN) add(x, y, 'fountain', 'Fountain', 'Known');
    if (tile === T.STAIRS_UP || tile === T.STAIRS_DOWN) add(x, y, 'stairs', tile === T.STAIRS_UP ? 'Stairs up' : 'Stairs down', 'Known');
  }
  for (const n of L.npcs || []) if (n.kind !== 'encounter') add(n.x, n.y, 'trader', 'Trader', n.greeted ? 'Visited' : 'Not yet visited');
  for (const n of memory.filter(n => n.depth === G.depth)) {
    const present = (L.npcs || []).some(p => p.x === n.x && p.y === n.y && p.id === n.id);
    add(n.x, n.y, SHRINES.has(n.id) ? 'shrine' : 'encounter', ENCOUNTERS[n.id].title, present ? 'Unresolved' : 'Visited · resolved', n.id);
  }
  const place = visitedPlace(L);
  if (place) {
    // Anchor to ground actually explored inside the room, never its hidden centre.
    const i = L.roomId.findIndex((r, i) => r === place.room && L.explored[i] && L.tiles[i] === T.FLOOR);
    if (i >= 0) add(i % L.w, Math.floor(i / L.w), 'place', place.name, 'Visited room');
  }
  return rows.sort((a, b) => Math.abs(a.x - G.player.x) + Math.abs(a.y - G.player.y) - Math.abs(b.x - G.player.x) - Math.abs(b.y - G.player.y));
}
export function landmarkList(root, rows, selected = '') {
  const open = root.open;
  root.innerHTML = `<summary>Known landmarks (${rows.length})</summary><p class="dim small">Select a place to centre the map. Shrines are + and encounters are ?; a selected place has a gold outline. Only explored ground is listed.</p><div class="landmark-list">`
    + (rows.length ? rows.map(r => `<button type="button" data-landmark="${escapeHtml(r.key)}" aria-pressed="${selected === r.key}"><b>${escapeHtml(r.name)}</b><small>${escapeHtml(r.status)} · ${r.x}, ${r.y}</small></button>`).join('') : '<p>No landmarks found yet.</p>') + '</div>';
  root.open = open;
}
