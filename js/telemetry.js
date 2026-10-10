// Reports, sent only for a player who has turned them on in the Menu: a short
// note when a run ends, and one when something breaks. They are how the game
// learns what real players meet, beside what the balance bot meets, and how a
// crash on a phone nobody here owns can be found again from its seed.
//
// Nothing that names the player is sent: no hero's name, no account, no
// address of any kind. What a run's note holds is listed in the Menu's own
// words, and the server (api/telemetry.js) drops anything else it is sent.

import { RELICS } from './relics.js';

/** The paths' legendary pieces, by id: a run's note says which one it found. */
const LEGENDS = Object.keys(RELICS).filter(id => RELICS[id].legend);

const KEY = 'deepdelve.reports';
const ENDPOINT = '/api/telemetry';
// A page that breaks every frame would send a note every frame: a handful a
// visit is enough to find it, and the same message is sent once.
const CRASHES_A_VISIT = 5;
// The frame rate in play, counted in four buckets of a frame's length:
// 50 fps or more, 30 to 50, 20 to 30, under 20 (see the dashboard).
const BUCKETS = [20, 33.4, 50];

/** @param {string} k @param {string} [v] */
const store = (k, v) => {
  try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { /* private browsing */ }
  return null;
};

let build = '';
let crashes = 0;
const sentCrash = new Set();
/** the run being watched (its G.created), and what has been counted of it */
let runId = -1, sentEnd = false, fps = [0, 0, 0, 0], tips = 0, lastFrame = 0;
/** @type {() => any} */
let state = () => null;

const on = () => store(KEY) === '1';

/** Send one note, never waiting on it and never troubled if it fails. */
function send(/** @type {object} */ body) {
  if (!on()) return false;
  const text = JSON.stringify({ v: 1, build, ...body });
  try {
    if (typeof fetch === 'function') fetch(ENDPOINT, { method: 'POST', body: text, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => {});
    else if (navigator.sendBeacon) navigator.sendBeacon(ENDPOINT, text);
  } catch (e) { /* offline, or the browser will not: the note is lost, which is fine */ }
  return true;
}

/** The device in coarse terms: enough to know a slow phone from a fast one, never which phone. */
function device() {
  const ua = navigator.userAgent || '';
  const os = /iPhone|iPad|iPod/.test(ua) ? 'ios' : /Android/.test(ua) ? 'android' : /Mac/.test(ua) ? 'mac' : /Win/.test(ua) ? 'windows' : 'other';
  const br = /SamsungBrowser/.test(ua) ? 'samsung' : /Firefox|FxiOS/.test(ua) ? 'firefox' : /Edg/.test(ua) ? 'edge' : /Chrome|CriOS/.test(ua) ? 'chrome' : /Safari/.test(ua) ? 'safari' : 'other';
  const nav = /** @type {any} */ (navigator);
  return {
    w: screen.width, h: screen.height, dpr: Math.round((window.devicePixelRatio || 1) * 100) / 100,
    cores: nav.hardwareConcurrency || 0, mem: nav.deviceMemory || 0,
    touch: (nav.maxTouchPoints || 0) > 0, family: `${os}-${br}`,
  };
}

/** A short fingerprint of the run as it stands, so a crash can be matched with a save. */
function saveHash(G) {
  try {
    const s = JSON.stringify(G);
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(16).padStart(8, '0');
  } catch (e) { return ''; }
}

function runEnded(G) {
  const p = G.player || {}, k = G.lastAttacker;
  send({
    kind: 'run', seed: String(G.seed || ''), daily: !!(G.opts && G.opts.daily),
    cls: p.cls || '', path: p.path || '', diff: (G.opts && G.opts.difficulty) || 'normal', rung: (G.opts && G.opts.difficulty === 'hard' && G.opts.rung) || 0,
    levels: (G.opts && G.opts.levels) || 8, size: (G.opts && G.opts.size) || 'medium',
    outcome: G.status === 'won' ? 'win' : 'death', depth: G.depth || 0, level: p.level || 0,
    cause: G.status === 'won' || !k ? '' : String(k.cause || k.name || ''),
    minutes: Math.round((G.t || 0) / 60000), fps, tips, device: device(),
    // the combinations the run made, and the legend it found, if any: how much a build was there to name
    combos: Object.keys(G.combos || {}), legend: ((G.relics && G.relics.found) || []).find(id => LEGENDS.includes(id)) || '',
  });
}

/**
 * Called every frame by the main loop. It counts the frame's length while a run
 * is being played, and sends the run's note once, the moment it ends. A run
 * played with the testing tools on is not sent: it says nothing of the game.
 * @param {any} G  the game's state
 * @param {number} now
 * @param {boolean} playing  the dungeon is on screen and nothing holds it still
 */
function frame(G, now, playing) {
  if (!G) return;
  if (G.created !== runId) { runId = G.created; sentEnd = G.status !== 'playing'; fps = [0, 0, 0, 0]; tips = 0; lastFrame = 0; }
  if (playing && G.status === 'playing') {
    if (lastFrame) {
      const ms = now - lastFrame;
      // a gap of more than a fifth of a second is the page put away, not a frame
      if (ms < 200) { const i = BUCKETS.findIndex(b => ms < b); fps[i < 0 ? 3 : i]++; }
    }
    lastFrame = now;
  } else lastFrame = 0;
  if (!sentEnd && (G.status === 'won' || G.status === 'dead')) {
    sentEnd = true;
    if (!G.tested) runEnded(G);
  }
}

/** A tip the player closed by hand. */
function tipClosed() { tips++; }

function crash(/** @type {string} */ msg, /** @type {string} */ where, /** @type {string} */ stack) {
  if (!on() || crashes >= CRASHES_A_VISIT || sentCrash.has(msg)) return;
  crashes++; sentCrash.add(msg);
  const G = state();
  // the page's own address is no use in a report and might carry a query: kept to the file
  const tidy = (/** @type {string} */ s) => String(s || '').split(location.origin).join('');
  send({ kind: 'crash', msg: tidy(msg), where: tidy(where), stack: tidy(stack), seed: G ? String(G.seed || '') : '', daily: !!(G && G.opts && G.opts.daily), depth: G ? G.depth || 0 : 0, save: G ? saveHash(G) : '' });
}

/**
 * Listen for what breaks. `getState` gives the game's state at the moment, for
 * the seed and floor; `version` names the build (the latest news line's id).
 * @param {{ getState: () => any, version: string }} o
 */
function install(o) {
  state = o.getState; build = o.version || '';
  window.addEventListener('error', e => crash(e.message || 'error', `${e.filename || ''}:${e.lineno || 0}:${e.colno || 0}`, e.error && e.error.stack ? e.error.stack : ''));
  window.addEventListener('unhandledrejection', e => {
    const r = e.reason;
    crash(r && r.message ? r.message : String(r), 'promise', r && r.stack ? r.stack : '');
  });
}

const Telemetry = {
  install, frame, tipClosed,
  enabled: on,
  /** @param {boolean} v */
  setEnabled(v) { store(KEY, v ? '1' : '0'); },
};

export { Telemetry };
