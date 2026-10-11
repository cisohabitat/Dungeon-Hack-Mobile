import { Rng } from './rng.js';
import { CLASSES, VOWS } from './data.js';
import { Daily } from './daily.js';

// The Weekly Challenge: one dungeon a week, the same for everyone, with a hero
// and a fixed set of modifiers dealt from the week itself: two vows sworn for
// you, and the dungeon's size, its monsters and its treasure. Unlike the daily
// it may be tried as often as you like; your best stands. Kept on this device
// only, like the Hall of Heroes; nothing is sent anywhere.

const WEEKLY_KEY = 'deepdelve.weekly';
/** The six classes, in a fixed order, so a later class does not change who a week's hero is. */
const WEEKLY_CLASSES = ['fighter', 'cleric', 'mage', 'thief', 'ranger', 'druid'];
/** The vows a week may swear for you, in a fixed order for the same reason. */
const WEEKLY_VOWS = ['iron', 'pauper', 'unaided', 'glass', 'hunted', 'alone'];
const KEEP_WEEKS = 8;

const pad = n => String(n).padStart(2, '0');
/**
 * The week a date falls in, as an ISO week: YYYY-Www, Monday to Sunday, the
 * first week of a year the one holding its first Thursday (so the last days of
 * December can belong to the next year's first week, and early January to the
 * last year's 53rd). By the phone's own calendar, as the daily is.
 */
function weekKey(d = new Date()) {
  const day = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dow = day.getUTCDay() || 7;                     // Monday 1 .. Sunday 7
  day.setUTCDate(day.getUTCDate() + 4 - dow);           // the Thursday of this week
  const year = day.getUTCFullYear();
  const week = Math.ceil(((day.getTime() - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
  return `${year}-W${pad(week)}`;
}
/** The Monday a week key begins on, as a UTC date. */
function monday(key) {
  const [y, w] = key.split('-W').map(Number);
  const jan4 = new Date(Date.UTC(y, 0, 4)), dow = jan4.getUTCDay() || 7;
  return new Date(Date.UTC(y, 0, 4 - dow + 1 + (w - 1) * 7));
}
/** "the week of 12 October", for saying which week it is. */
function longWeek(key) {
  const m = monday(key);
  return `the week of ${new Date(m.getUTCFullYear(), m.getUTCMonth(), m.getUTCDate()).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}`;
}
const seedFor = key => 'weekly-' + key;

/** The week's hero, dungeon and vows: the same for everyone who plays that week. */
function heroFor(key) {
  const rng = new Rng(seedFor(key));
  const hero = Daily.dealHero(rng, WEEKLY_CLASSES);
  // two vows, never the same one twice
  const first = rng.pick(WEEKLY_VOWS);
  const vows = [first, rng.pick(WEEKLY_VOWS.filter(v => v !== first))].filter(v => VOWS[v]);
  return {
    ...hero, seed: seedFor(key),
    opts: {
      levels: 8, size: rng.pick(['medium', 'large']), monsters: rng.pick(['normal', 'many']), treasure: rng.pick(['scarce', 'normal']),
      lockedDoors: true, traps: true, permadeath: true, difficulty: /** @type {'normal'} */ ('normal'), vows, weekly: key,
    },
  };
}
/** The week's modifiers in a few words: "Glass Vow and Hunted Vow, a large delve, many monsters". */
function modifiers(key) {
  const o = heroFor(key).opts, bits = [o.vows.map(v => VOWS[v].name).join(' and ')];
  if (o.size === 'large') bits.push('a large delve');
  if (o.monsters === 'many') bits.push('many monsters');
  if (o.treasure === 'scarce') bits.push('scarce treasure');
  return bits.join(', ');
}

/** @typedef {{won: boolean, depth: number, kills: number, cls: string, score: number}} WeeklyDone */
/** @returns {{weeks: Object<string, {tries: number, best: WeeklyDone|null, last: WeeklyDone|null}>}} */
function load() {
  let v = null;
  try { v = JSON.parse(localStorage.getItem(WEEKLY_KEY) || 'null'); } catch (e) { /* start afresh */ }
  const weeks = {};
  const done = d => (d && typeof d === 'object' && Number.isFinite(d.score) ? { won: !!d.won, depth: Math.max(1, Math.min(16, Math.floor(Number(d.depth) || 1))), kills: Math.max(0, Math.floor(Number(d.kills) || 0)), cls: CLASSES[d.cls] ? d.cls : 'fighter', score: Math.max(0, Math.floor(d.score)) } : null);
  if (v && typeof v === 'object' && v.weeks && typeof v.weeks === 'object') {
    for (const [k, w] of Object.entries(v.weeks)) {
      if (!/^\d{4}-W\d{2}$/.test(k) || !w || typeof w !== 'object') continue;
      weeks[k] = { tries: Math.max(0, Math.floor(Number(w.tries) || 0)), best: done(w.best), last: done(w.last) };
    }
  }
  return { weeks };
}
function store(v) {
  const keys = Object.keys(v.weeks).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - KEEP_WEEKS))) delete v.weeks[k];
  try { localStorage.setItem(WEEKLY_KEY, JSON.stringify(v)); } catch (e) { /* private browsing */ }
}
/** A try at the week's challenge has begun. */
function start(key) {
  const v = load();
  const w = v.weeks[key] || { tries: 0, best: null, last: null };
  w.tries++;
  v.weeks[key] = w;
  store(v);
}
/** A try is over, won or lost: it is the last, and the best if it beat the best. */
function finish(key, done) {
  const v = load();
  const w = v.weeks[key] || { tries: 1, best: null, last: null };
  w.last = done;
  if (!w.best || done.score > w.best.score) w.best = done;
  v.weeks[key] = w;
  store(v);
}
/** How the week stands for this player. */
function status(key) { return load().weeks[key] || { tries: 0, best: null, last: null }; }
/** How a try went, in a few words. */
const outcome = done => (done.won ? 'claimed the Heart' : `fell on floor ${done.depth}`);
/** The title's line under the button: what this week asks, or how the best try went. */
function summary(key) {
  const w = status(key);
  if (!w.best) return `This week: ${modifiers(key)}`;
  return `Best: ${outcome(w.best)}, score ${w.best.score} (${w.tries} ${w.tries === 1 ? 'try' : 'tries'})`;
}
/** One line to paste anywhere. */
function shareLine(key) {
  const w = status(key), b = w.best;
  if (!b) return '';
  return `Deepdelve weekly ${key} (${modifiers(key)}): ${CLASSES[b.cls].name}, ${outcome(b)}, score ${b.score}, best of ${w.tries} ${w.tries === 1 ? 'try' : 'tries'}`;
}

const Weekly = { weekKey, monday, longWeek, seedFor, heroFor, modifiers, start, finish, status, outcome, summary, shareLine, WEEKLY_CLASSES, WEEKLY_VOWS };
export { Weekly };
