// The sound pack in sound/: rendered sounds and music played in place of the
// synthesis wherever one is ready (see sound/README.md and sound/SOURCES.md).
// This only fetches and decodes; sound.js and music.js decide what plays.
//
// Nothing here may hold the game up or break it. A sound not yet loaded is
// asked for and the synthesised one plays meanwhile; a file that will not
// load is let go, and its synthesis stands in for good. Loading waits for
// quiet moments, a few at a time, so it never costs a frame the player sees.
//
// Music and the ambience are decoded at half the usual rate: four stems of
// half a minute in stereo are a great deal of memory at full rate on a phone,
// and its speaker could not tell the difference. Only one floor's are kept.

const STORE = 'deepdelve.samples';
/**
 * The pack's music theme for each of the game's floor themes (data.js THEMES,
 * by index): the four upper halls share one, the Crypts road's two floors
 * another, and the lich's hall, the Warrens and the three peoples each their own.
 */
const THEME_GROUP = ['halls', 'halls', 'halls', 'halls', 'crypts', 'sanctum', 'crypts', 'warrens', 'darkelf', 'greyhold', 'marsh'];
const BASE = 'sound/';
/** The rate the music and the ambience are decoded at. */
const LOW_RATE = 24000;

/** @type {any} the slim list in sound/index.json, once read */
let index = null;
/** @type {Promise<any>|null} */
let reading = null;
/** @type {Map<string, AudioBuffer>} decoded, by path without its extension */
const buffers = new Map();
/** @type {Map<string, Promise<AudioBuffer|null>>} */
const pending = new Map();
/** paths that would not load: their synthesis stands in for good */
const failed = new Set();
/** what has been played, by id, for the tests */
const played = new Set();

/** @param {string} k @param {string} [v] */
const store = (k, v) => {
  try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { /* private browsing */ }
  return null;
};
// A browser driven by the tests starts without them unless asked (as the way in
// does): a few megabytes decoded in every test would only slow and shake them.
const on = () => store(STORE) === 'on' || (store(STORE) !== 'off' && !(typeof navigator !== 'undefined' && navigator.webdriver));

// AAC where the phone has it (every iPhone does; not every browser built
// without licensed codecs), Vorbis otherwise; an AAC file that will not
// decode sends everything after it to Vorbis.
let fmt = 'ogg';
try {
  const a = document.createElement('audio');
  if (a.canPlayType('audio/mp4; codecs="mp4a.40.2"')) fmt = 'm4a';
  else if (!a.canPlayType('audio/ogg; codecs="vorbis"')) fmt = '';
} catch (e) { fmt = ''; }

/** @type {Record<number, any>} a decoder for each rate: an offline context needs no tap to decode */
const decoders = {};
function decoder(rate) {
  if (!decoders[rate]) {
    const OAC = window.OfflineAudioContext || /** @type {any} */ (window).webkitOfflineAudioContext;
    decoders[rate] = OAC ? new OAC(2, 1, rate) : null;
  }
  return decoders[rate];
}
function decode(data, rate) {
  const d = decoder(rate);
  if (!d) return Promise.reject(new Error('no decoder'));
  // (old Safari's decodeAudioData takes callbacks only)
  return new Promise((ok, bad) => { const p = d.decodeAudioData(data, ok, bad); if (p && p.catch) p.catch(bad); });
}

function readIndex() {
  if (!reading) {
    reading = fetch(BASE + 'index.json').then(r => (r.ok ? r.json() : null)).then(j => { index = j; return j; }).catch(() => null);
  }
  return reading;
}

/**
 * One file, fetched and decoded once. Null if it will not load.
 * @param {string} path  without its extension @param {number} [rate]
 * @returns {Promise<AudioBuffer|null>}
 */
function load(path, rate = 48000) {
  if (buffers.has(path)) return Promise.resolve(buffers.get(path));
  if (failed.has(path) || !fmt) return Promise.resolve(null);
  if (!pending.has(path)) {
    const tryFmt = async f => {
      const res = await fetch(BASE + path + '.' + f);
      if (!res.ok) throw new Error(path + ' ' + res.status);
      return decode(await res.arrayBuffer(), rate);
    };
    pending.set(path, tryFmt(fmt).catch(e => {
      if (fmt !== 'm4a') throw e;
      fmt = 'ogg';
      return tryFmt('ogg');
    }).then(b => { buffers.set(path, b); pending.delete(path); return b; }, () => { failed.add(path); pending.delete(path); return null; }));
  }
  return pending.get(path);
}

/** The file for a sound's variation n (from 1). */
const sfxPath = (id, n) => `sfx/${id}-${n}`;

/**
 * A ready buffer for a sound effect: one of its variations, at random among
 * those loaded. Asks for any not yet loaded, so the next time it is there.
 * @param {string} id @param {() => number} rnd
 * @returns {AudioBuffer|null}
 */
function pick(id, rnd) {
  if (!on()) return null;
  if (!index) { readIndex(); return null; }       // sound turned on later: the list is read now
  if (!index.sfx[id]) return null;
  const n = index.sfx[id], ready = [];
  for (let i = 1; i <= n; i++) {
    const b = buffers.get(sfxPath(id, i));
    if (b) ready.push(b); else load(sfxPath(id, i));
  }
  if (!ready.length) return null;
  played.add(id);
  return ready[Math.floor(rnd() * ready.length)];
}
/** A stinger's buffer, if ready (asking for it if not). @param {string} id */
function stinger(id) {
  if (!on()) return null;
  if (!index) { readIndex(); return null; }
  if (!index.stingers.includes(id)) return null;
  const b = buffers.get('stingers/' + id);
  if (!b) { load('stingers/' + id); return null; }
  played.add('stinger:' + id);
  return b;
}

// ---- loading in quiet moments ----
/** @type {string[]} what is waiting to be loaded, in order */
const queue = [];
let pumping = false;
function pump() {
  if (pumping) return;
  pumping = true;
  const next = () => {
    const path = queue.shift();
    if (!path) { pumping = false; return; }
    load(path).then(() => {
      const idle = /** @type {any} */ (window).requestIdleCallback;
      if (idle) idle(next, { timeout: 400 }); else setTimeout(next, 30);
    });
  };
  next();
}
/** Ask for these to be loaded, one after another, in quiet moments. @param {string[]} paths */
function enqueue(paths) {
  for (const p of paths) if (!buffers.has(p) && !failed.has(p) && !queue.includes(p)) queue.push(p);
  pump();
}

/**
 * Begin: read the list, then load the title's cue and the everyday sounds
 * (the blows, the doors, the steps, the stingers) behind it. Called once
 * the title is up.
 */
let begun = false;
async function begin() {
  if (begun || !on() || !fmt) return;
  begun = true;
  const j = await readIndex();
  if (!j) return;
  load('music/title', LOW_RATE);
  const everyday = [];
  for (const id of j.tier1) for (let i = 1; i <= j.sfx[id]; i++) everyday.push(sfxPath(id, i));
  for (const id of j.stingers) everyday.push('stingers/' + id);
  enqueue(everyday);
}

/** @type {string} the music theme whose stems are kept */
let keptTheme = '';
/**
 * A theme's four stems, its end-of-fight phrase and its ambience, loaded (and
 * any other theme's let go). Resolves to null if they cannot be had.
 * @param {string} theme
 */
async function theme(theme) {
  if (!on() || !fmt) return null;
  const j = await readIndex();
  if (!j || !j.music[theme]) return null;
  if (keptTheme && keptTheme !== theme) {
    for (const k of [...buffers.keys()]) if (k.startsWith(`music/${keptTheme}/`) || k === 'ambience/' + keptTheme) buffers.delete(k);
  }
  keptTheme = theme;
  const stems = ['explore', 'tension', 'fight', 'boss'];
  const got = await Promise.all(stems.map(s => load(`music/${theme}/${s}`, LOW_RATE)));
  if (keptTheme !== theme || got.some(b => !b)) return null;
  load(`music/${theme}/resolve`, LOW_RATE);
  if (j.ambience[theme]) load('ambience/' + theme, LOW_RATE);
  return { stems: Object.fromEntries(stems.map((s, i) => [s, got[i]])), info: j.music[theme] };
}
/** A ready buffer by path (the title's cue, a theme's resolve, an ambience), or null. @param {string} path */
const ready = path => (on() ? buffers.get(path) || null : null);
/**
 * A floor's ambience, if ready, asking for it if not (it comes with the
 * theme's music too, but the music may be turned off). @param {string} theme
 */
function ambience(theme) {
  if (!on() || !index || !index.ambience[theme]) return null;
  const b = buffers.get('ambience/' + theme);
  if (!b) load('ambience/' + theme, LOW_RATE);
  return b || null;
}

const Samples = {
  on, begin, pick, stinger, theme, ready, ambience,
  /** The pack's music theme for a floor theme. @param {number} t */
  groupOf: t => THEME_GROUP[t] || 'halls',
  /** Has the list arrived (and so, could a sound be played)? */
  listed: () => !!index,
  /** How it stands, for the tests. */
  state: () => ({ on: on(), fmt, listed: !!index, loaded: buffers.size, waiting: queue.length + pending.size, failed: failed.size, played: [...played], theme: keptTheme }),
  /** @param {boolean} v */
  setOn(v) { store(STORE, v ? 'on' : 'off'); },
  LOW_RATE,
};

export { Samples };
