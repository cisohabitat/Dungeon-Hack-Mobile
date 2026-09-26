// Progress that outlasts a run: which classes have won at which difficulty,
// every relic any hero has found, and the backgrounds those wins open up.
// Kept on this device under one key, like the Hall of Heroes and the
// bestiary, and read afresh each time so there is no state to go stale.

import { BACKGROUNDS, CLASSES, PATHS, VOWS, FEATS } from './data.js';
import { RELICS } from './relics.js';

const PROGRESS_KEY = 'deepdelve.progress';
const HALL_KEY = 'deepdelve.hall';
/** Easiest first, so a later one is harder. */
const DIFFS = ['easy', 'normal', 'hard'];

/** @typedef {{won: Record<string, Record<string, number>>, relics: string[], paths: Record<string, number>, vows: Record<string, number>, feats: Record<string, number>}} ProgressData */

/** Every path of every class, by id. */
const PATH_IDS = Object.values(PATHS).flat().map(x => x.id);

/** Whatever was stored, it comes back as this shape, never a crash. @returns {ProgressData} */
function clean(v) {
  const out = { won: {}, relics: [], paths: {}, vows: {}, feats: {} };
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  // wins with each path, and with each vow kept: counts, nothing else
  /** @type {[('paths'|'vows'|'feats'), string[]][]} */
  const counted = [['paths', PATH_IDS], ['vows', Object.keys(VOWS)], ['feats', Object.keys(FEATS)]];
  for (const [key, ids] of counted) {
    const src = v[key] && typeof v[key] === 'object' ? v[key] : {};
    for (const id of ids) { const n = Math.max(0, Math.floor(Number(src[id]) || 0)); if (n) out[key][id] = n; }
  }
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
  return { won, relics: [], paths: {}, vows: {}, feats: {} };
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
/** Trophies won: one for every class at every difficulty, every path won with, every vow kept to a win, and every feat. */
function trophyCount(v = load()) {
  let n = 0;
  for (const cls in CLASSES) for (const d of DIFFS) if (hasWon(cls, d, v)) n++;
  n += PATH_IDS.filter(id => v.paths[id]).length + Object.keys(VOWS).filter(id => v.vows[id]).length + Object.keys(FEATS).filter(id => v.feats[id]).length;
  return { won: n, total: Object.keys(CLASSES).length * DIFFS.length + PATH_IDS.length + Object.keys(VOWS).length + Object.keys(FEATS).length };
}
/** A class with a lock (the Ranger) opens once every class without one has won, at any difficulty. */
function classOpen(cls, v = load()) {
  const c = CLASSES[cls];
  if (!c) return false;
  return !c.locked || Object.keys(CLASSES).filter(k => !CLASSES[k].locked).every(k => highest(k, v));
}
/** Vows are open once any hero has won on Hard. */
function vowsOpen(v = load()) { return wonAtLeast('hard', v); }

/** A background with no unlock is always open; one with an unlock needs a win at that difficulty or harder. */
function bgOpen(id, v = load()) {
  const b = BACKGROUNDS[id];
  if (!b) return false;
  return !b.unlock || wonAtLeast(b.unlock, v);
}

/**
 * A run won: count it, and say what is new. Daily runs count like any other.
 * A path won with counts at any difficulty; a vow kept, or a feat, on Normal or Hard.
 * @param {{path?: string, vows?: string[], levels?: number, route?: string}} [how]
 * @returns {{first: boolean, cls: string, difficulty: string, unlocked: string[], classesOpened: string[], firstPath: string, firstVows: string[], firstFeats: string[], vowsOpened: boolean}}
 */
function recordWin(cls, difficulty, how = {}) {
  const d = DIFFS.includes(difficulty) ? difficulty : 'normal';
  const v = load();
  const wasOpen = Object.keys(BACKGROUNDS).filter(id => bgOpen(id, v)), vowsWere = vowsOpen(v), classesWere = Object.keys(CLASSES).filter(k => classOpen(k, v));
  const first = !hasWon(cls, d, v);
  if (CLASSES[cls]) {
    v.won[cls] = v.won[cls] || {};
    v.won[cls][d] = (v.won[cls][d] || 0) + 1;
  }
  const path = how.path && PATH_IDS.includes(how.path) ? how.path : '';
  const firstPath = path && !v.paths[path] ? path : '';
  if (path) v.paths[path] = (v.paths[path] || 0) + 1;
  const kept = d === 'easy' ? [] : (how.vows || []).filter(id => VOWS[id]);
  const firstVows = kept.filter(id => !v.vows[id]);
  for (const id of kept) v.vows[id] = (v.vows[id] || 0) + 1;
  // feats: what kind of win this was
  const feats = d === 'easy' ? [] : [...((how.levels || 0) >= 12 ? ['long'] : []), ...(how.route && FEATS[how.route] ? [how.route] : [])];
  const firstFeats = feats.filter(id => !v.feats[id]);
  for (const id of feats) v.feats[id] = (v.feats[id] || 0) + 1;
  store(v);
  const unlocked = Object.keys(BACKGROUNDS).filter(id => bgOpen(id, v) && !wasOpen.includes(id));
  const classesOpened = Object.keys(CLASSES).filter(k => classOpen(k, v) && !classesWere.includes(k));
  return { first: first && !!CLASSES[cls], cls, difficulty: d, unlocked, classesOpened, firstPath, firstVows, firstFeats, vowsOpened: !vowsWere && vowsOpen(v) };
}
/** A relic picked up or bought goes in the codex; true the first time. */
function noteRelic(id) {
  if (!RELICS[id]) return false;
  const v = load();
  const fresh = !v.relics.includes(id);
  if (fresh) v.relics.push(id);
  // every relic found: the Collector's feat, once (asked even of one already
  // known, so a codex filled before the feat existed still earns it)
  const done = !v.feats.collector && Object.keys(RELICS).every(r => v.relics.includes(r));
  if (done) v.feats.collector = 1;
  if (fresh || done) store(v);
  return fresh;
}

const Progress = { load, hasWon, highest, trophyCount, bgOpen, classOpen, vowsOpen, recordWin, noteRelic, DIFFS, PATH_IDS, KEY: PROGRESS_KEY };
export { Progress };
