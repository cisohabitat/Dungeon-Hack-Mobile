// Seeded pseudo-random number generator (mulberry32) plus helpers.
// Dungeons are generated from a seed string so the same seed always
// produces the same dungeon, just like the classic seed-based crawlers.

function hashSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

class Rng {
  constructor(seed) {
    this.s = (typeof seed === 'string' ? hashSeed(seed) : (seed >>> 0)) || 1;
  }
  next() {
    this.s = (this.s + 0x6D2B79F5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  chance(p) { return this.next() < p; }
  dice(n, s, m = 0) { let t = m; for (let i = 0; i < n; i++) t += this.int(1, s); return t; }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  weighted(entries) {
    let total = 0;
    for (const e of entries) total += e[1];
    let r = this.next() * total;
    for (const e of entries) { r -= e[1]; if (r < 0) return e[0]; }
    return entries[entries.length - 1][0];
  }
}

// The run's own dice: every roll play makes (a blow, a trick's odds, a wander,
// a fire's spread) comes from this one stream, seeded from the run as it begins
// (game.js, newGame) and carried in its save, so the same run with the same
// presses rolls the same dice, in the browser and under the bench. Until a run
// begins it is seeded from the clock, for the title's hero names.
const Dice = new Rng((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0);
function d(n, s, m = 0) { return Dice.dice(n, s, m); }
// The run's odds: the second stream, for what play once asked Math.random for
// (a trick's chance, a wander, a fire's spread, a drop). Apart from the dice so
// that a test may pin one without the other, as the two were apart before.
const Odds = new Rng((Date.now() ^ (Math.random() * 0xffffffff) ^ 0x5bd1e995) >>> 0);
/** A roll of the run's odds from 0 to 1. */
const rnd = () => Odds.next();
/** Whether the run's odds fall under p. */
const chance = p => Odds.next() < p;

const SEED_SYLLABLES = ['kar', 'mor', 'thal', 'dun', 'gor', 'vel', 'ash', 'ur', 'nak', 'ith', 'bal', 'zor', 'em', 'ryn', 'ok', 'sha', 'dre', 'lum', 'vor', 'tek'];
function randomSeedWord() {
  const n = 2 + Math.floor(Math.random() * 2);
  let s = '';
  for (let i = 0; i < n; i++) s += Dice.pick(SEED_SYLLABLES);
  return s + Dice.int(10, 99);
}

export { hashSeed, Rng, Dice, Odds, d, rnd, chance, randomSeedWord };
