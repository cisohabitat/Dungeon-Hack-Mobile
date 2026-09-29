import { Rng } from './rng.js';
import { CLASSES, BACKGROUNDS } from './data.js';

// The Daily Delve: one dungeon a day, the same for everyone. The date is the
// seed for everything, the hero included, so two phones on the same day get
// the same class, the same past and the same scores. One try: once the day's
// run has ended the title shows how it went instead. Kept on this device
// only, like the Hall of Heroes; nothing is sent anywhere.

const DAILY_KEY = 'deepdelve.daily';
// A second daily for the classes that are earned, kept apart from the first:
// its own seed, its own record and its own streak, so the Daily Delve every
// player shares is dealt exactly as it always was. (kind 'earned'; 'main' is the first)
const EARNED_KEY = 'deepdelve.daily.earned';
/** The earned classes it deals, fixed in this order so a later one does not change who a date's hero is. */
const EARNED_CLASSES = ['ranger', 'druid'];
const storeKey = kind => (kind === 'earned' ? EARNED_KEY : DAILY_KEY);
/**
 * The pasts the day's hero is drawn from: the six there have always been, in
 * the order they were first written. Not Object.keys(BACKGROUNDS): the
 * backgrounds earned by winning (The Returned, The Heartsworn) must never be
 * dealt to anyone, and a new one added to the table must not change who a
 * given date's hero is.
 */
const DAILY_BACKGROUNDS = ['oathbroken', 'tombwise', 'ashborn', 'cloistered', 'deepborn', 'debtor'];
/** Names for a hero nobody named. */
const HERO_NAMES = ['Wren', 'Tamsin', 'Oren', 'Brannoc', 'Idris', 'Maelis', 'Corvin', 'Hesk', 'Aldra', 'Fenn', 'Rook', 'Sabine'];

const pad = n => String(n).padStart(2, '0');
/** Today by the phone's own calendar, as YYYY-MM-DD. */
function today(d = new Date()) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
/** Whole days since 1970 for a YYYY-MM-DD date, so two can be compared. */
function dayNumber(key) { const [y, m, d] = key.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); }
function seedFor(key, kind = 'main') { return kind === 'earned' ? 'daily-earned-' + key : 'daily-' + key; }
/** "24 September", for saying which day it is. */
function longDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
}

const DAILY_CLASSES = ['fighter', 'cleric', 'mage', 'thief'];
/** The day's hero and dungeon: the same for everyone who plays on that date. */
function heroFor(key, kind = 'main') {
  const rng = new Rng(seedFor(key, kind));
  // the four classes every player has from the start: a later one (the Ranger) is earned, and the days already dealt stay as they were;
  // the earned daily deals only the earned ones
  const cls = rng.pick(kind === 'earned' ? EARNED_CLASSES : DAILY_CLASSES);
  const bg = rng.pick(DAILY_BACKGROUNDS.filter(id => BACKGROUNDS[id]));
  const name = rng.pick(HERO_NAMES);
  const keyStat = CLASSES[cls].primary;
  // rolled the way the game rolls, four dice keeping three, with the best
  // score in the class's key stat; and like Quick Start, rolled again until
  // the hero can hold their own, so nobody's day is spoiled by the dice
  const roll = () => { const r = [rng.int(1, 6), rng.int(1, 6), rng.int(1, 6), rng.int(1, 6)].sort((a, b) => b - a); return r[0] + r[1] + r[2]; };
  let stats = null;
  for (let i = 0; i < 40; i++) {
    const st = { str: roll(), dex: roll(), con: roll(), int: roll(), wis: roll(), cha: roll() };
    const best = Object.keys(st).reduce((a, b) => (st[b] > st[a] ? b : a), keyStat);
    [st[keyStat], st[best]] = [st[best], st[keyStat]];
    stats = st;
    const fight = cls === 'thief' || cls === 'ranger' || cls === 'druid' ? st.dex : st.str;
    if (st[keyStat] >= 14 && fight >= 12 && st.con >= 10) break;
  }
  return {
    name, cls, bg, stats, seed: seedFor(key, kind),
    opts: { levels: 8, size: 'medium', monsters: 'normal', treasure: 'normal', lockedDoors: true, traps: true, permadeath: true, difficulty: /** @type {'normal'} */ ('normal'), daily: key, ...(kind === 'earned' ? { dailyKind: 'earned' } : {}) },
  };
}

/** @returns {{streak: number, last: string, days: Object<string, {started?: boolean, done?: {won: boolean, depth: number, kills: number, cls: string, score: number}}>}} */
function load(kind = 'main') {
  let v = null;
  try { v = JSON.parse(localStorage.getItem(storeKey(kind)) || 'null'); } catch (e) { /* start afresh */ }
  if (!v || typeof v !== 'object') v = {};
  return { streak: Number(v.streak) || 0, last: typeof v.last === 'string' ? v.last : '', days: v.days && typeof v.days === 'object' ? v.days : {} };
}
function store(v, kind = 'main') {
  // a fortnight is plenty to remember
  const keys = Object.keys(v.days).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - 14))) delete v.days[k];
  try { localStorage.setItem(storeKey(kind), JSON.stringify(v)); } catch (e) { /* private browsing */ }
}
/** The day's run has begun: that is the day's one try, and it counts toward the streak. */
function start(key, kind = 'main') {
  const v = load(kind);
  if (v.days[key] && v.days[key].started) return;
  v.streak = v.last && dayNumber(key) - dayNumber(v.last) === 1 ? v.streak + 1 : (v.last === key ? v.streak : 1);
  v.last = key;
  v.days[key] = { started: true };
  store(v, kind);
}
/** The day's run is over, won or lost. */
function finish(key, done, kind = 'main') {
  const v = load(kind);
  v.days[key] = { ...(v.days[key] || {}), started: true, done };
  store(v, kind);
}
/** How today stands: not yet tried, begun, or over (with how it went). */
function status(key, kind = 'main') {
  const day = load(kind).days[key];
  if (day && day.done) return { state: 'done', done: day.done };
  return { state: day && day.started ? 'started' : 'fresh', done: null };
}
/** Consecutive days played, still alive if the last one was today or yesterday. */
function streak(key, kind = 'main') {
  const v = load(kind);
  if (!v.last) return 0;
  const gap = dayNumber(key) - dayNumber(v.last);
  return gap === 0 || gap === 1 ? v.streak : 0;
}
/** How the day went, in a few words: "fell on floor 5", "claimed the Heart". */
function outcome(done) { return done.won ? 'claimed the Heart' : `fell on floor ${done.depth}`; }
/** One line to paste anywhere. */
function shareLine(key, done, kind = 'main') {
  const who = CLASSES[done.cls] ? CLASSES[done.cls].name : done.cls;
  return `Deepdelve ${kind === 'earned' ? 'earned daily' : 'daily'} ${key}: ${who}, ${outcome(done)}, ${done.kills} kill${done.kills === 1 ? '' : 's'}, streak ${Math.max(1, streak(key, kind))}`;
}

const Daily = { today, seedFor, longDate, heroFor, start, finish, status, streak, outcome, shareLine, HERO_NAMES, DAILY_BACKGROUNDS, EARNED_CLASSES };
export { Daily };
