// Music that follows the fight, made as it plays: no recordings.
//
// Each kind of floor has a scale of its own and a note it comes home to. While
// nothing is near, a few bell notes now and then, walking up and down that
// scale, echoing off the stone, with long silences between. Something awake
// and close brings in a low pulse, like a held breath; once it comes to blows
// the pulse quickens into a beat and the bells into a figure that repeats; a
// named champion, a shade or the lich adds a horn underneath (and the Goblin
// Warlord his war-drum's beat). When the last
// foe falls the music comes home: two notes down to the floor's own note, and
// then quiet for a while before the bells come back.
//
// The composer (plan, step) only decides which notes; the player turns them
// into sound through the same master as everything else (Sound.audio), so the
// compressor and the sound switch govern both. The composer keeps its own
// dice, never Math.random: the game's dice must not be moved by the music.

import { Sound } from './sound.js';

const Music = (() => {
  let enabled = true;
  try { enabled = localStorage.getItem('deepdelve.music') !== 'off'; } catch (e) { /* ignore */ }

  // ---- the floors' scales: a home note (MIDI) and the steps above it ----
  const SCALES = [
    { root: 50, steps: [0, 2, 3, 5, 7, 9, 10] },     // Grey Halls: D, dorian, plain and cold
    { root: 45, steps: [0, 2, 3, 5, 7, 8, 10] },     // Brown Catacombs: A, the old minor
    { root: 52, steps: [0, 2, 3, 5, 7, 9, 10] },     // Mossy Depths: E, dorian, damp and open
    { root: 47, steps: [0, 2, 3, 5, 7, 8, 10] },     // Blue Vaults: B, minor, wind in the halls
    { root: 52, steps: [0, 1, 3, 5, 7, 8, 10] },     // Crimson Crypts: E, phrygian, the flat second's dread
    { root: 48, steps: [0, 1, 4, 5, 7, 8, 11] },     // Obsidian Sanctum: C, the lich's strange major
    { root: 47, steps: [0, 1, 3, 5, 7, 8, 10] },     // The Ossuary: B, phrygian, bone on bone
    { root: 43, steps: [0, 3, 5, 7, 10] },           // The Warrens: G, five notes, goblin-plain
    // The Dark Elf Halls: C#, the Hungarian minor, its raised fourth strange and cold; and far
    // off, temple chimes, two high notes falling, while nothing is close
    { root: 49, steps: [0, 2, 3, 6, 7, 8, 11], chime: true },
    // The Grey Hold: F, the old minor, low and heavy; and far off, a hammer on an anvil,
    // two short rings every other bar, while nothing is close
    { root: 41, steps: [0, 2, 3, 5, 7, 8, 10], anvil: true },
    // The Sunless Marsh: A, the old minor, slow; and while all is still, frogs: two low croaks every third bar
    { root: 45, steps: [0, 2, 3, 5, 7, 8, 10], frogs: true },
  ];
  // how fast a step goes (eighth notes, in seconds) for each mood
  const STEP_S = { quiet: 0.5, wary: 0.42, fight: 0.31, champion: 0.29, boss: 0.27, warlord: 0.27 };
  const MOODS = Object.keys(STEP_S);
  const LEVEL = { quiet: 0, wary: 1, fight: 2, champion: 3, boss: 4, warlord: 4 };
  /** How loud the music sits under the game's own sounds and the floor's drone. */
  const LEVEL_ALL = 0.6;
  /** How far the music draws back while the game is paused (the Pack, the Map, the Menu). */
  const DUCK = 0.4;
  /** How long the quiet after a fight lasts, in seconds, before the bells come back. */
  const HUSH_S = 9;

  const scaleOf = theme => SCALES[theme] || SCALES[0];
  /** The note a scale degree names: degree 0 is home, 7 (or 5 on a five-note scale) home an octave up. */
  function note(sc, degree, octave = 0) {
    const n = sc.steps.length, d = ((degree % n) + n) % n, o = Math.floor(degree / n);
    return sc.root + sc.steps[d] + 12 * (o + octave);
  }

  // ---- the composer ----
  /** A fresh composer: where the melody is, what figure the fight repeats, and its own dice. */
  function composer(seedText = 'deepdelve') {
    let s = 0x9e3779b9;
    for (let i = 0; i < seedText.length; i++) s = Math.imul(s ^ seedText.charCodeAt(i), 0x85ebca6b);
    return { s, step: 0, degree: 2, phrase: 0, rest: 8, motif: null, motifTheme: -1, last: 'quiet', hush: 0, pendingHome: false };
  }
  const rnd = c => {
    c.s = (c.s + 0x6D2B79F5) | 0;
    let t = Math.imul(c.s ^ (c.s >>> 15), 1 | c.s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  /** A figure of four notes for a fight on this floor, kept until the floor changes. */
  function motifFor(c, theme) {
    if (c.motifTheme === theme && c.motif) return c.motif;
    const n = scaleOf(theme).steps.length;
    const m = [0];
    for (let i = 1; i < 4; i++) m.push(Math.max(-2, Math.min(n + 2, m[i - 1] + [-2, -1, 1, 2, 3][Math.floor(rnd(c) * 5)])));
    c.motif = m; c.motifTheme = theme;
    return m;
  }
  /**
   * What sounds on the next step, and how long the step is.
   * @param {any} c  a composer @param {string} mood @param {number} theme @param {number} [t]  seconds, for the quiet after a fight
   * @returns {{dur: number, notes: Array<{k: string, midi: number, vel: number, len: number}>}}
   */
  function step(c, mood, theme, t = 0) {
    if (!STEP_S[mood]) mood = 'quiet';
    const sc = scaleOf(theme), n = sc.steps.length, i = c.step++, beat = i % 8, bar = Math.floor(i / 8);
    const out = [];
    const lvl = LEVEL[mood], was = LEVEL[c.last];
    // the fight is over: come home, then hush
    if (was >= 2 && lvl < 2) {
      out.push({ k: 'bell', midi: note(sc, 4, 1), vel: 0.5, len: 1.2 });
      c.pendingHome = true;
      c.hush = t + HUSH_S;
      c.rest = 6;
    } else if (c.pendingHome) {
      out.push({ k: 'bell', midi: note(sc, 0, 1), vel: 0.55, len: 3 });
      out.push({ k: 'bell', midi: note(sc, 0, 0), vel: 0.3, len: 3 });
      c.pendingHome = false;
    }
    c.last = mood;
    const quietNow = lvl < 2 && t < c.hush;
    // the bells: a walk up and down the scale in short phrases, with rests
    if (!quietNow && !out.length) {
      if (lvl >= 2) {
        // in a fight: the floor's figure, twice a bar, the second time a step higher now and then
        const m = motifFor(c, theme);
        if (beat % 2 === 0) {
          const lift = bar % 4 === 3 ? 1 : 0;
          out.push({ k: 'bell', midi: note(sc, m[(beat / 2) % 4] + lift, 1), vel: 0.34, len: 0.5 });
        }
      } else if (c.rest > 0) c.rest--;
      else if (rnd(c) < (beat % 4 === 0 ? 0.7 : 0.35)) {
        c.degree = Math.max(0, Math.min(n + 4, c.degree + [-2, -1, -1, 1, 1, 2][Math.floor(rnd(c) * 6)]));
        out.push({ k: 'bell', midi: note(sc, c.degree, 1), vel: 0.26 + rnd(c) * 0.14, len: 2.4 });
        // now and then a second voice a third below
        if (rnd(c) < 0.18) out.push({ k: 'bell', midi: note(sc, c.degree - 2, 1), vel: 0.16, len: 2.4 });
        if (++c.phrase >= 3 + Math.floor(rnd(c) * 4)) { c.phrase = 0; c.rest = (lvl ? 6 : 12) + Math.floor(rnd(c) * 12); c.degree = 2 + Math.floor(rnd(c) * 3); }
      }
    }
    // the elves' temple chimes, high and far off, every fourth bar while all is still
    if (sc.chime && lvl === 0 && !quietNow && bar % 4 === 2) {
      if (beat === 0) out.push({ k: 'bell', midi: note(sc, 4, 2), vel: 0.11, len: 3 });
      if (beat === 3) out.push({ k: 'bell', midi: note(sc, 3, 2), vel: 0.09, len: 3 });
    }
    // the dwarves' hammers, ringing on an anvil somewhere in the hold
    if (sc.anvil && lvl === 0 && !quietNow && bar % 2 === 1 && (beat === 0 || beat === 2)) out.push({ k: 'bell', midi: note(sc, 0, 3), vel: beat === 0 ? 0.08 : 0.06, len: 0.15 });
    // the marsh's frogs, low and close, two croaks together
    if (sc.frogs && lvl === 0 && !quietNow && bar % 3 === 1 && (beat === 1 || beat === 2)) out.push({ k: 'pulse', midi: note(sc, beat === 1 ? 0 : 1, -1), vel: 0.12, len: 0.1 });
    // a quiet pad under the bells once in a long while, home and its fifth
    if (lvl === 0 && !quietNow && beat === 0 && bar % 8 === 0) out.push({ k: 'pad', midi: note(sc, 0, -1), vel: 0.18, len: 7 });
    // something awake and close: a low held-breath pulse
    if (lvl === 1 && (beat === 0 || beat === 3)) out.push({ k: 'pulse', midi: note(sc, 0, -1), vel: beat === 0 ? 0.5 : 0.32, len: 0.3 });
    // blows: the pulse on every step, home and the fifth, and a beat under it
    if (lvl >= 2) {
      const d = [0, 0, 4, 0, 0, 0, n > 5 ? 5 : 3, 0][beat];
      out.push({ k: 'pulse', midi: note(sc, d, -1), vel: beat % 2 ? 0.3 : 0.45, len: 0.22 });
      // the Warlord's hall beats his war-drum under it: BOOM, BOOM, and two quicker
      if (mood === 'warlord') { if ([0, 2, 5, 6].includes(beat)) out.push({ k: 'thud', midi: 0, vel: beat < 4 ? 0.85 : 0.6, len: 0.24 }); }
      else if (beat === 0 || beat === 4 || (lvl >= 4 && beat === 6)) out.push({ k: 'thud', midi: 0, vel: beat === 0 ? 0.7 : 0.5, len: 0.2 });
    }
    // a champion, a shade or the lich: a horn beneath, home then the sixth, a bar each
    if (lvl >= 3 && beat === 0) out.push({ k: 'horn', midi: note(sc, bar % 2 ? (n > 5 ? 5 : 4) : 0, -1), vel: lvl >= 4 ? 0.4 : 0.32, len: STEP_S[mood] * 7.5 });
    return { dur: STEP_S[mood], notes: out };
  }
  /** Every note of `steps` steps in one mood, from a fresh composer: for the tests. */
  function plan(mood, theme, steps, seedText) {
    const c = composer(seedText);
    const all = [];
    for (let i = 0; i < steps; i++) all.push(step(c, mood, theme, i * STEP_S[mood]));
    return all;
  }

  // ---- the player ----
  let comp = composer();
  let nextAt = 0;            // when the next step falls, in seconds on the clock it is played by
  let playing = false;
  let onAudio = false;       // which clock nextAt is on: the audio's, or (with no audio, as in the tests) the page's
  let busUp = false;         // the bus has been faded up for this stretch of play
  let ducked = false;        // drawn back while the game is paused
  /** @type {GainNode|null} */ let bus = null;
  /** @type {any} */ let busCtx = null;
  /** @type {((n: {k: string, midi: number, vel: number, len: number}, mood: string) => void)|null} told of every note, even with no audio: for tests */
  let listener = null;
  let heard = { mood: 'quiet', notes: 0 };
  const hz = midi => 440 * Math.pow(2, (midi - 69) / 12);
  // a note that throws is a bug, never a reason to stop the game: say so once
  let faulted = false;
  function fault(k, e) {
    if (faulted) return;
    faulted = true;
    try { console.warn(`music "${k}" failed:`, e && e.message); } catch (err) { /* ignore */ }
  }

  /** The music's own gain and a cave's echo, on the sound's music bus (which ducks under a level gained or the lich's words). */
  function ensureBus() {
    const a = Sound.audio();
    if (!a) return null;
    if (bus && busCtx === a.ctx) return a;
    const c = a.ctx;
    busUp = false;
    bus = c.createGain();
    bus.gain.value = 0;
    bus.connect(a.music);
    // the echo: what goes in comes back a dotted beat later, fainter each time
    const echo = c.createDelay(1.5), back = c.createGain(), wet = c.createGain(), dull = c.createBiquadFilter();
    echo.delayTime.value = 0.42; back.gain.value = 0.38; wet.gain.value = 0.32;
    dull.type = 'lowpass'; dull.frequency.value = 2200;
    bus.connect(echo); echo.connect(dull); dull.connect(back); back.connect(echo); dull.connect(wet); wet.connect(a.music);
    busCtx = c;
    return a;
  }
  function fadeTo(v, secs) {
    if (!bus || !busCtx) return;
    const t = busCtx.currentTime;
    bus.gain.cancelScheduledValues(t);
    bus.gain.setValueAtTime(bus.gain.value, t);
    bus.gain.linearRampToValueAtTime(v, t + secs);
  }
  /** One note, at `at` on the audio clock. */
  function sound(c, n, at) {
    const f = hz(n.midi), end = at + n.len;
    const env = c.createGain();
    env.connect(bus);
    const voice = (type, freq, o = {}) => {
      const x = c.createOscillator();
      x.type = type; x.frequency.setValueAtTime(freq, at);
      if (o.to) x.frequency.exponentialRampToValueAtTime(o.to, at + (o.slide || 0.15));
      if (o.detune) x.detune.value = o.detune;
      x.connect(o.into || env);
      x.start(at); x.stop(end + 0.1);
    };
    const shape = (peak, attack, hold = 0) => {
      env.gain.setValueAtTime(0.0001, at);
      env.gain.linearRampToValueAtTime(peak, at + attack);
      if (hold) env.gain.setValueAtTime(peak, at + attack + hold);
      env.gain.exponentialRampToValueAtTime(0.0001, end);
    };
    if (n.k === 'bell') {
      // a struck bar: the note and a faint clang above it, dying away
      shape(n.vel * 0.5, 0.006);
      voice('sine', f);
      const clang = c.createGain(); clang.gain.value = 0.18; clang.connect(env);
      voice('sine', f * 2.76, { into: clang });
    } else if (n.k === 'pulse') {
      const low = c.createBiquadFilter(); low.type = 'lowpass'; low.frequency.value = 520; low.connect(env);
      shape(n.vel * 0.55, 0.01);
      voice('triangle', f, { into: low });
    } else if (n.k === 'thud') {
      shape(n.vel * 0.9, 0.004);
      voice('sine', 95, { to: 38, slide: 0.16 });
    } else if (n.k === 'pad') {
      const low = c.createBiquadFilter(); low.type = 'lowpass'; low.frequency.value = 480; low.connect(env);
      shape(n.vel * 0.3, 2, n.len - 4);
      voice('sawtooth', f, { into: low, detune: -6 }); voice('sawtooth', f * 1.5, { into: low, detune: 5 });
    } else if (n.k === 'horn') {
      const low = c.createBiquadFilter(); low.type = 'lowpass'; low.frequency.value = 640; low.connect(env);
      shape(n.vel * 0.34, 0.18, Math.max(0, n.len - 0.6));
      voice('sawtooth', f, { into: low }); voice('sawtooth', f / 2, { into: low, detune: 4 });
    }
  }

  /**
   * Called every frame while a floor is being played: keep the next steps
   * written a moment ahead.
   * @param {string} mood  quiet, wary, fight, champion, boss or warlord @param {number} theme  the floor's @param {number} nowMs  the page's clock
   */
  function update(mood, theme, nowMs) {
    if (!enabled || !Sound.isEnabled()) { if (playing) stop(); return; }
    let a = null;
    // (a failure here must not throw into the game's frame: the loop would stop)
    try { a = ensureBus(); } catch (e) { fault('bus', e); a = null; }
    // Notes are placed on the audio clock itself, which on a phone moves in
    // steps of its own. While it is stopped (the page put away, a phone
    // waiting for a tap) nothing is written, so nothing piles up to sound
    // all at once when it starts again.
    if (a && a.ctx.state !== 'running') return;
    const now = a ? a.ctx.currentTime : nowMs / 1000;
    if (!playing || onAudio !== !!a) { nextAt = now + 0.3; onAudio = !!a; }
    if (!playing) { playing = true; comp = composer(String(theme)); }
    if (a && !busUp) { fadeTo(LEVEL_ALL * (ducked ? DUCK : 1), 1.5); busUp = true; }
    heard.mood = mood;
    // behind (a slow frame, a new floor being made): what was missed is let go, not played in a heap
    if (nextAt < now) nextAt = now + 0.02;
    // write up to a fifth of a second ahead
    let guard = 0;
    while (nextAt < now + 0.2 && guard++ < 8) {
      const s = step(comp, mood, theme, onAudio ? nowMs / 1000 + (nextAt - now) : nextAt);
      for (const n of s.notes) {
        heard.notes++;
        if (listener) { try { listener(n, mood); } catch (e) { /* ignore */ } }
        if (a) { try { sound(a.ctx, n, nextAt); } catch (e) { fault(n.k, e); } }
      }
      nextAt += s.dur;
    }
  }
  /** The game paused, or not: a fight's beat carries on over a frozen scene, so it draws back while paused. */
  function duck(on) {
    on = !!on;
    if (on === ducked) return;
    ducked = on;
    if (playing && busUp) { try { fadeTo(LEVEL_ALL * (on ? DUCK : 1), 0.4); } catch (e) { fault('duck', e); } }
  }
  /** The floor is left behind (the end screen, the title, the Hall): fade out. */
  function stop() {
    if (!playing) return;
    playing = false;
    busUp = false;
    try { fadeTo(0, 0.8); } catch (e) { fault('fade', e); }
  }
  function toggle() {
    enabled = !enabled;
    try { localStorage.setItem('deepdelve.music', enabled ? 'on' : 'off'); } catch (e) { /* ignore */ }
    if (!enabled) stop();
    return enabled;
  }

  return {
    update, stop, toggle, duck, plan, note, SCALES, MOODS, HUSH_S,
    isEnabled: () => enabled,
    /** @param {((n: {k: string, midi: number, vel: number, len: number}, mood: string) => void)|null} fn */
    listen(fn) { listener = fn; },
    /** Sound one note of every instrument now, through the real audio: for the tests. Returns how many played. */
    tryEach() {
      let a = null;
      try { a = ensureBus(); } catch (e) { fault('bus', e); }
      if (!a) return 0;
      let n = 0;
      for (const k of ['bell', 'pulse', 'thud', 'pad', 'horn']) {
        try { sound(a.ctx, { k, midi: 57, vel: 0.2, len: k === 'pad' ? 5 : 0.6 }, a.ctx.currentTime + 0.05); n++; } catch (e) { fault(k, e); }
      }
      return n;
    },
    /** What it last heard of the fight, and how many notes it has written: for the tests. */
    state: () => ({ ...heard, playing, ducked }),
  };
})();

export { Music };
