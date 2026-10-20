// Device-local choices and pickup receipts. No flags are written onto game items.
import { Game } from './game.js';
import { ITEMS } from './data.js';
import { Assets } from './assets.js';
import { escapeHtml } from './uikit.js';

const KEY = 'deepdelve.gearTools';
export const itemKey = it => JSON.stringify([it.t, it.u || '', it.e || 0, it.px || '', it.pw || '', it.color || '', it.name || '']);
const usable = t => Object.hasOwn(ITEMS, t) && ['potion', 'scroll', 'food'].includes(ITEMS[t].kind);
let run = '', favourites = new Set(), belt = [null, null, null], receipts = [], previous = new WeakMap();
const runId = () => JSON.stringify([Game.state()?.created, Game.state()?.seed, Game.player()?.name]);
function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ run, favourites: [...favourites], belt, receipts })); } catch { /* Optional preferences may be unavailable. */ }
}
function ensure() {
  if (!Game.state() || run === runId()) return;
  run = runId(); favourites = new Set(); belt = [null, null, null]; receipts = []; previous = new WeakMap();
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw && raw.length <= 250000 ? JSON.parse(raw) : null;
    if (v?.run !== run) return;
    if (Array.isArray(v.favourites)) favourites = new Set(v.favourites.filter(k => typeof k === 'string' && k.length <= 1024).slice(0, 28));
    if (Array.isArray(v.belt)) belt = [0, 1, 2].map(i => typeof v.belt[i] === 'string' && usable(v.belt[i]) ? v.belt[i] : null);
    if (Array.isArray(v.receipts)) receipts = v.receipts.filter(validReceipt).slice(-1024);
  } catch { /* A damaged preference never blocks the run. */ }
}
function validReceipt(r) {
  return r && Number.isInteger(r.depth) && r.depth >= 1 && r.depth <= 16 && Number.isFinite(r.q) && r.q > 0 && r.q <= 1000000
    && typeof r.t === 'string' && (r.t === 'gold' || Object.hasOwn(ITEMS, r.t))
    && typeof r.label === 'string' && r.label.length <= 200 && typeof r.key === 'string' && r.key.length <= 1024;
}
function sync() {
  ensure();
  if (!Game.state()) return;
  const carried = [...Game.player().inv, ...Object.values(Game.player().eq)].filter(Boolean), keys = new Set();
  let changed = false;
  for (const it of carried) {
    const key = itemKey(it), old = previous.get(it);
    if (old && old !== key && favourites.delete(old)) { favourites.add(key); changed = true; }
    previous.set(it, key); keys.add(key);
  }
  for (const key of favourites) if (!keys.has(key)) { favourites.delete(key); changed = true; }
  if (changed) save();
}
function isFavourite(it) { ensure(); return favourites.has(itemKey(it)); }
function toggleFavourite(it) { sync(); const key = itemKey(it); if (!favourites.delete(key)) favourites.add(key); save(); }
function pin(it, slot) { ensure(); if (!usable(it.t) || slot < 0 || slot > 2) return; belt[slot] = belt[slot] === it.t ? null : it.t; save(); }
function pinned(slot) { ensure(); return belt[slot]; }
function notePickup(event) {
  ensure();
  try {
    const r = JSON.parse(event.slice(5));
    if (!validReceipt(r)) return;
    const row = receipts.find(x => x.depth === r.depth && x.key === r.key);
    if (row) row.q = Math.min(1000000, row.q + r.q);
    else if (receipts.length < 1024) receipts.push(r);
    save();
  } catch { /* Only bounded receipts are retained. */ }
}
function renderLoot(root) {
  ensure();
  const depth = Game.state().depth, rows = receipts.filter(r => r.depth === depth), gold = rows.filter(r => r.t === 'gold').reduce((n, r) => n + r.q, 0), items = rows.filter(r => r.t !== 'gold');
  root.innerHTML = `<h3>Floor ${depth} haul</h3><p>${gold} gold collected · ${items.reduce((n, r) => n + r.q, 0)} item${items.reduce((n, r) => n + r.q, 0) === 1 ? '' : 's'}</p>`
    + (items.length ? `<ul>${items.map(r => `<li>${escapeHtml(r.label)} <span class="dim">×${r.q}</span></li>`).join('')}</ul>` : '<p class="dim small">No items collected here yet.</p>')
    + '<p class="dim small">Floor pickups recorded on this device. Purchases, gifts and things you put down are excluded. Earlier pickups from an older save are not reconstructed.</p>';
}
let beltSig = '';
function renderBelt(root) {
  ensure();
  const p = Game.player(), entries = belt.map(t => ({ t, it: t && p.inv.find(it => it.t === t), n: t ? p.inv.filter(it => it.t === t).reduce((n, it) => n + (it.q || 1), 0) : 0 }));
  const sig = JSON.stringify(entries.map(x => [x.t, x.n, x.it && Game.itemName({ ...x.it, q: 1 })]));
  root.hidden = !belt.some(Boolean);
  if (sig === beltSig) return; beltSig = sig;
  root.innerHTML = entries.map(({ t, it, n }, i) => {
    const name = t ? Game.itemName(it ? { ...it, q: 1 } : { t, q: 1, e: 0 }) : 'Empty';
    const sprite = it && Assets.sprites[Game.spriteFor(it)];
    return `<button type="button" data-belt="${i}" ${!it ? 'disabled' : ''} aria-label="Belt ${i + 1}: ${escapeHtml(name)}, ${n} carried">${sprite ? `<img src="${escapeHtml(sprite.url)}" alt="">` : ''}<small><span class="belt-name">${escapeHtml(name)}</span>${t ? ` <span class="belt-count">×${n}</span>` : ''}</small></button>`;
  }).join('');
}
export const GearTools = { sync, isFavourite, toggleFavourite, pin, pinned, notePickup, renderLoot, renderBelt, usable };
