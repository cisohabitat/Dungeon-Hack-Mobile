// Progress that outlasts a run: which classes have won at which difficulty,
// every relic any hero has found, and the backgrounds those wins open up.
// Kept on this device under one key, like the Hall of Heroes and the
// bestiary, and read afresh each time so there is no state to go stale.

import { BACKGROUNDS, CLASSES } from './data.js';
import { RELICS } from './relics.js';

const PROGRESS_KEY = 'deepdelve.progress';
const HALL_KEY = 'deepdelve.hall';
/** Easiest first, so a later one is harder. */
const DIFFS = ['easy', 'normal', 'hard'];

/** @typedef {{won: Record<string, Record<string, number>>, relics: string[]}} ProgressData */

/** Whatever was stored, it comes back as this shape, never a crash. @returns {ProgressData} */
function clean(v) {
  const out = { won: {}, relics: [] };
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  const won = v.won && typeof v.won === 'object' ? v.won : {};
  for (const cls in CLASSES) {
    const r = won[cls] && typeof won[cls] === 'object' ? won[cls] : {};
    for (const d of DIFFS) {
      const n = Math.max(0, Math.floor(Number(r[d]) || 0));
      if (n) (out.won[cls] = out.won[cls] || {})[d] = n;
    }
  }
  if (Array.isArray(v.relics)) out.relics = [...new Set(v.relics.filter(id => typeof id === 'string' && RELICS[id]))];
  return out;
}
/** A Hall from before progress was kept still counts its wins: those on one
 * life. An entry from before the Hall said so counts; one that says it could
 * be reloaded does not, as recordWin would not have counted it either. */
function fromHall() {
  let list = [];
  try { list = JSON.parse(localStorage.getItem(HALL_KEY) || '[]'); } catch (e) { /* nothing to count */ }
  const won = {};
  if (Array.isArray(list)) for (const h of list) {
    if (!h || !h.won || !CLASSES[h.cls] || h.permadeath === false) continue;
    const d = DIFFS.includes(h.difficulty) ? h.difficulty : 'normal';
    won[h.cls] = won[h.cls] || {};
    won[h.cls][d] = (won[h.cls][d] || 0) + 1;
  }
  return { won, relics: [] };
}
/** @returns {ProgressData} */
function load() {
  let raw = null;
  try { raw = localStorage.getItem(PROGRESS_KEY); } catch (e) { return clean(null); }
  if (raw === null) return clean(fromHall());
  let v = null;
  try { v = JSON.parse(raw); } catch (e) { /* start afresh */ }
  return clean(v);
}
function store(v) {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(v)); } catch (e) { /* private browsing */ }
}

/** Whether this class has won at this difficulty. */
function hasWon(cls, d, v = load()) { return !!(v.won[cls] && v.won[cls][d]); }
/** Whether any class has won at this difficulty or a harder one. */
function wonAtLeast(d, v = load()) {
  const from = Math.max(0, DIFFS.indexOf(d));
  return Object.keys(v.won).some(cls => DIFFS.slice(from).some(x => hasWon(cls, x, v)));
}
/** The hardest difficulty this class has won, or '' for none yet. */
function highest(cls, v = load()) { return DIFFS.slice().reverse().find(d => hasWon(cls, d, v)) || ''; }
/** Trophies won, out of one for every class at every difficulty. */
function trophyCount(v = load()) {
  let n = 0;
  for (const cls in CLASSES) for (const d of DIFFS) if (hasWon(cls, d, v)) n++;
  return { won: n, total: Object.keys(CLASSES).length * DIFFS.length };
}

/** A background with no unlock is always open; one with an unlock needs a win at that difficulty or harder. */
function bgOpen(id, v = load()) {
  const b = BACKGROUNDS[id];
  if (!b) return false;
  return !b.unlock || wonAtLeast(b.unlock, v);
}

/**
 * A run won: count it, and say what is new. Daily runs count like any other.
 * @returns {{first: boolean, cls: string, difficulty: string, unlocked: string[]}}
 */
function recordWin(cls, difficulty) {
  const d = DIFFS.includes(difficulty) ? difficulty : 'normal';
  const v = load();
  const wasOpen = Object.keys(BACKGROUNDS).filter(id => bgOpen(id, v));
  const first = !hasWon(cls, d, v);
  if (CLASSES[cls]) {
    v.won[cls] = v.won[cls] || {};
    v.won[cls][d] = (v.won[cls][d] || 0) + 1;
  }
  store(v);
  const unlocked = Object.keys(BACKGROUNDS).filter(id => bgOpen(id, v) && !wasOpen.includes(id));
  return { first: first && !!CLASSES[cls], cls, difficulty: d, unlocked };
}
/** A relic picked up or bought goes in the codex; true the first time. */
function noteRelic(id) {
  if (!RELICS[id]) return false;
  const v = load();
  if (v.relics.includes(id)) return false;
  v.relics.push(id);
  store(v);
  return true;
}

const Progress = { load, hasWon, highest, trophyCount, bgOpen, recordWin, noteRelic, DIFFS, KEY: PROGRESS_KEY };
export { Progress };
