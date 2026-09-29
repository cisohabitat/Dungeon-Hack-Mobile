// Synthesized sound via WebAudio. No audio files needed.
//
// Everything goes through one master gain and a compressor, so a pile of
// blows landing at once does not clip. A sound can be placed: left or right
// of the way the hero faces, near or far, ahead or behind, so a blow being
// drawn back at your shoulder can be heard there. Variety comes from a little
// generator of its own, never Math.random: the game's dice must not be moved
// by a sound, and the balance bot needs every run to come out the same.

import { ITEMS, MONSTERS } from './data.js';

const Sound = (() => {
  /** @type {AudioContext} */
  let ctx = null;
  /** @type {GainNode} */
  let master = null;
  /** @type {AudioBuffer} two seconds of noise, made once: every hiss, thud and gust is cut from it */
  let noiseBuf = null;
  let enabled = true;
  try { enabled = localStorage.getItem('deepdelve.sound') !== 'off'; } catch (e) { /* ignore */ }
  /** @type {((name: string, v: Record<string, any>) => void)|null} told of every sound played, for tests */
  let listener = null;
  // a sound that throws is a bug, never a reason to stop the game: say so once
  let faulted = false;
  function fault(name, e) {
    if (faulted) return;
    faulted = true;
    try { console.warn(`sound "${name}" failed:`, e && e.message); } catch (err) { /* ignore */ }
  }

  // ---- its own dice, for variety only ----
  let seed = 0x5eed1e55;
  const rnd = () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  /** A value give or take a share of itself. */
  const vary = (x, amt) => x * (1 + (rnd() * 2 - 1) * amt);

  let away = false;         // the page is hidden: stay quiet until it is back
  function ensure() {
    if (!enabled || away || typeof window === 'undefined') return null;
    try { return open(); } catch (e) { fault('audio', e); return null; }
  }
  function open() {
    if (!ctx) {
      // Safari shipped this prefixed for years and still answers to it
      const AC = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 4;
      comp.attack.value = 0.003; comp.release.value = 0.25;
      master = ctx.createGain();
      master.gain.value = 0.85;
      // two calls: old Safari's connect() returned nothing to chain on
      master.connect(comp); comp.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = rnd() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  // ---- where a sound is heard from ----
  const HEAR = 14;          // squares: past this a sound is not played at all
  /**
   * Turn a place (dist in squares, pan -1 left to 1 right, behind) into a
   * loudness, a muffle and a side. Null when it is too far off to hear.
   * @param {Record<string, any>} [o]
   */
  function place(o) {
    const v = Object.assign({ pan: 0, gain: 1, cut: 20000 }, o);
    if (o && o.dist != null) {
      if (o.dist > HEAR) return null;
      const d = Math.max(1, o.dist);
      v.gain = Math.min(1, 2 / (1 + d * 0.5)) * (1 - (d / HEAR) ** 2);
      // far things lose their edge, and what is behind you a little more
      v.cut = (d <= 1.5 ? 20000 : 900 + 16000 / (1 + (d - 1.5) * 0.6)) * (o.behind ? 0.5 : 1);
      v.pan = Math.max(-1, Math.min(1, o.pan || 0)) * 0.8;
    }
    return v;
  }
  /** The node a placed sound plays into: its loudness, its muffle, its side. */
  function bus(v) {
    /** @type {AudioNode} */
    let node = master;
    if (v.pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = v.pan; p.connect(node); node = p; }
    if (v.cut < 16000) node = lp(node, v.cut);
    const g = ctx.createGain();
    g.gain.value = v.gain;
    g.connect(node);
    return g;
  }

  // ---- the pieces every sound is made of ----
  /** A filter in front of a node. */
  function lp(out, f, type = 'lowpass', q = 0.7) {
    const n = ctx.createBiquadFilter();
    n.type = /** @type {BiquadFilterType} */ (type);
    n.frequency.value = f; n.Q.value = q;
    n.connect(out);
    return n;
  }
  /** A pitched note with a quick attack and a falling tail, sliding by `slide` Hz. */
  function tone(out, freq, dur, type = 'sine', vol = 0.15, slide = 0, delay = 0, attack = 0.005) {
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = /** @type {OscillatorType} */ (type);
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
    g.gain.value = 0.0001;             // silent before it starts, or its first sample clicks
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(Math.max(0.001, vol), t0 + Math.min(attack, dur * 0.8));
    g.gain.exponentialRampToValueAtTime(0.0005, t0 + dur);
    o.connect(g).connect(out);
    o.start(t0);
    o.stop(t0 + dur + 0.03);
  }
  /**
   * A burst of filtered noise cut from the shared buffer at a random place.
   * @param {AudioNode} out @param {number} dur @param {number} vol
   * @param {{type?: string, f?: number, to?: number, q?: number, rate?: number, delay?: number, attack?: number}} [o]
   */
  function noise(out, dur, vol, o = {}) {
    const t0 = ctx.currentTime + (o.delay || 0);
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    s.loop = dur > 1.5;
    s.playbackRate.value = o.rate || 1;
    const f = ctx.createBiquadFilter();
    f.type = /** @type {BiquadFilterType} */ (o.type || 'lowpass');
    f.Q.value = o.q == null ? 0.7 : o.q;
    f.frequency.value = o.f || 3000;
    f.frequency.setValueAtTime(o.f || 3000, t0);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    const g = ctx.createGain();
    g.gain.value = 0.0001;             // silent before it starts, or its first sample clicks
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + Math.min(o.attack || 0.003, dur * 0.8));
    g.gain.exponentialRampToValueAtTime(0.0005, t0 + dur);
    s.connect(f).connect(g).connect(out);
    s.start(t0, rnd() * Math.max(0, noiseBuf.duration - dur - 0.1), dur + 0.05);
  }
  /** Little dry clicks scattered over a span: bones, claws, a handle rattled. */
  function clicks(out, n, span, f, vol) {
    for (let i = 0; i < n; i++) noise(out, 0.018 + rnd() * 0.02, vol * (0.6 + rnd() * 0.4), { type: 'bandpass', f: vary(f, 0.35), q: 3, delay: rnd() * span });
  }
  /** Struck metal: a few partials that do not agree, dying away. */
  function ring(out, base, dur, vol, delay = 0) {
    [1, 1.47, 2.09, 2.76].forEach((k, i) => tone(out, base * k, dur * (1 - i * 0.18), 'sine', vol / (1 + i * 0.6), 0, delay, 0.002));
  }

  // ---- held sounds: a hum or a rising tone that lasts until told to stop ----
  /** @type {Record<string, {g: GainNode, srcs: AudioScheduledSourceNode[]}>} */
  const held = {};
  /** An oscillator running into a node, for a held sound. */
  function osc(out, type, freq) {
    const o = ctx.createOscillator();
    o.type = /** @type {OscillatorType} */ (type);
    o.frequency.value = freq;
    o.connect(out); o.start();
    return o;
  }
  /** Start a held sound; `build` fills the gain it is given and returns its sources. */
  function hold(name, out, dur, build) {
    release(name, 0.02);
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(out);
    const srcs = build(g, ctx.currentTime);
    for (const s of srcs) s.stop(ctx.currentTime + dur + 0.1);
    held[name] = { g, srcs };
  }
  /** Stop a held sound early, with a short fade so it does not click. */
  function release(name, fade = 0.06) {
    const h = held[name];
    delete held[name];
    if (!h || !ctx) return;
    try {
      const t = ctx.currentTime;
      h.g.gain.cancelScheduledValues(t);
      h.g.gain.setValueAtTime(h.g.gain.value, t);
      h.g.gain.linearRampToValueAtTime(0, t + fade);
      for (const s of h.srcs) s.stop(t + fade + 0.02);
    } catch (e) { /* ignore */ }
  }
  const releaseAll = () => { for (const k of Object.keys(held)) release(k); };

  // ---- what a blow sounds like, by what struck ----
  /** What kind of blow: by the tag the game gave it and the weapon behind it. */
  function strikeOf(o) {
    const t = o.tag;
    if (t === 'fire') return 'force';
    if (t === 'burn' || t === 'burning' || t === 'venom') return t === 'burn' ? 'fire' : t;
    if (t === 'thorns') return 'pierce';
    if (o.w === 'fists') return 'fist';
    if (!o.w) return 'blade';
    const b = ITEMS[o.w];
    if (!b) return 'blade';
    if (b.blunt) return 'blunt';
    if (b.range || o.w === 'dagger' || o.w === 'spear') return 'pierce';
    return 'blade';
  }
  const STRIKE = {
    blade(out) { noise(out, 0.09, 0.22, { type: 'bandpass', f: vary(2600, 0.1), q: 1.1, to: 1200 }); tone(lp(out, 900), vary(220, 0.08), 0.1, 'triangle', 0.12, -110); },
    blunt(out) { noise(out, 0.13, 0.3, { f: 700, to: 180 }); tone(out, vary(110, 0.08), 0.17, 'sine', 0.28, -55); },
    pierce(out) { noise(out, 0.05, 0.2, { type: 'bandpass', f: vary(3200, 0.1), q: 2 }); tone(out, vary(520, 0.08), 0.06, 'triangle', 0.08, -260); },
    fist(out) { noise(out, 0.07, 0.24, { f: 450 }); tone(out, vary(95, 0.08), 0.1, 'sine', 0.22, -35); },
    force(out) { tone(out, 820, 0.14, 'sine', 0.12, -420); noise(out, 0.1, 0.12, { type: 'bandpass', f: 1500, q: 1.5 }); },
    fire(out) { noise(out, 0.28, 0.2, { type: 'bandpass', f: 900, q: 0.8, to: 350 }); tone(lp(out, 500), 90, 0.2, 'sawtooth', 0.06, -40); },
    burning(out) { noise(out, 0.06, 0.06, { type: 'highpass', f: 3000 }); noise(out, 0.05, 0.05, { type: 'highpass', f: 2600, delay: 0.07 }); },
    venom(out) { noise(out, 0.12, 0.05, { type: 'highpass', f: 2500, attack: 0.03 }); },
  };
  const CRIT = { crit: 1, 'riposte-crit': 1, lucky: 1, sneak: 1, opening: 1 };

  // ---- how each kind of creature dies, matching what it bleeds ----
  const DEATH = {
    blood(out, s) { noise(out, 0.28, 0.24, { f: 600, to: 150 }); tone(lp(out, 450), 150 / s, 0.45, 'sawtooth', 0.1, -80 / s, 0.03, 0.02); },
    rot(out, s) { tone(lp(out, 380), 100 / s, 0.7, 'sawtooth', 0.12, -45 / s, 0, 0.06); noise(out, 0.4, 0.12, { f: 420, attack: 0.04 }); tone(lp(out, 600), 180, 0.15, 'sine', 0.12, -90, 0.25); },
    bone(out) { clicks(out, 12, 0.5, 2000, 0.12); tone(out, 80, 0.15, 'sine', 0.15, -30); },
    goo(out) { const l = lp(out, 650); tone(l, 220, 0.22, 'sine', 0.22, -150); tone(l, 140, 0.25, 'sine', 0.2, 140, 0.15); noise(out, 0.3, 0.1, { f: 400, delay: 0.1 }); },
    ichor(out) { noise(out, 0.12, 0.16, { type: 'bandpass', f: 2200, q: 1.5 }); clicks(out, 5, 0.3, 3000, 0.07); tone(lp(out, 500), 180, 0.12, 'sine', 0.1, -90, 0.05); },
    troll(out, s) { DEATH.blood(out, s); },
    // a basilisk's thick dark blood, and the dry crackle of a rustmaw's shell giving way
    bile(out, s) { noise(out, 0.32, 0.22, { f: 500, to: 120 }); tone(lp(out, 380), 110 / s, 0.55, 'sawtooth', 0.1, -50 / s, 0.03, 0.03); },
    rust(out) { clicks(out, 14, 0.45, 1500, 0.1); noise(out, 0.35, 0.12, { type: 'bandpass', f: 900, q: 1.2, to: 300 }); tone(lp(out, 500), 160, 0.15, 'sine', 0.1, -80, 0.1); },
    ecto(out) { tone(out, 880, 1.1, 'sine', 0.07, -600, 0, 0.02); tone(out, 1320, 0.9, 'sine', 0.03, -900, 0.05); noise(out, 1, 0.04, { type: 'highpass', f: 2500, to: 800 }); },
  };

  // ---- monster voices, by family; bigger is lower ----
  const VOICE_OF = { rat: 'growl', bat: 'shriek', slime: 'squelch', spider: 'hiss', goblin: 'grunt', archer: 'grunt',
    skeleton: 'rattle', zombie: 'moan', ghoul: 'moan', wraith: 'wail', orc: 'roar', ogre: 'roar', troll: 'roar', minotaur: 'roar',
    acolyte: 'chant', lich: 'lich', basilisk: 'rasp', rustmaw: 'chitter', shade: 'lament', dog: 'bark', wolf: 'howl' };
  const VOICE = {
    growl(out, s) { const f = 95 / s, l = lp(out, 520); tone(l, f, 0.4, 'sawtooth', 0.14, -f * 0.3, 0, 0.04); tone(l, f * 1.03, 0.4, 'sawtooth', 0.08, -f * 0.3, 0, 0.04); noise(out, 0.35, 0.05, { f: 400, attack: 0.05 }); },
    shriek(out) { for (let i = 0; i < 3; i++) tone(out, vary(2600, 0.08), 0.07, 'sine', 0.05, 700, i * 0.09); },
    // the druid's wolf: one low howl that rises and falls away
    howl(out) { const l = lp(out, 1200); tone(l, 330, 0.9, 'triangle', 0.08, 140, 0, 0.18); tone(l, 470, 0.5, 'sine', 0.03, -120, 0.35, 0.1); noise(out, 0.7, 0.03, { type: 'bandpass', f: 900, q: 2, attack: 0.2 }); },
    // the hero's hound: two short, glad barks, nothing like the deep's growls
    bark(out) { const l = lp(out, 1500); for (let i = 0; i < 2; i++) { tone(l, vary(360, 0.06), 0.1, 'sawtooth', 0.11, -150, i * 0.17, 0.008); noise(out, 0.08, 0.07, { type: 'bandpass', f: 1100, q: 1.3, delay: i * 0.17 }); } },
    hiss(out) { noise(out, 0.4, 0.09, { type: 'highpass', f: 3500, attack: 0.06 }); clicks(out, 4, 0.3, 2500, 0.06); },
    squelch(out) { const l = lp(out, 700); tone(l, 160, 0.18, 'sine', 0.22, -80); tone(l, 110, 0.16, 'sine', 0.18, 150, 0.12); noise(out, 0.2, 0.08, { f: 500, delay: 0.05 }); },
    rattle(out) { clicks(out, 9, 0.45, 2200, 0.09); tone(lp(out, 300), 90, 0.1, 'triangle', 0.08, -30); },
    // a low hiss with a rattle of scales in it
    rasp(out, s) { noise(out, 0.7, 0.1, { type: 'bandpass', f: 1300 / s, q: 0.9, to: 700 / s, attack: 0.15 }); clicks(out, 10, 0.55, 800, 0.06); tone(lp(out, 300), 70 / s, 0.6, 'sawtooth', 0.05, -12, 0, 0.12); },
    // mouthparts clicking against each other, quick and dry
    chitter(out) { clicks(out, 16, 0.5, 3200, 0.07); for (let i = 0; i < 3; i++) noise(out, 0.05, 0.05, { type: 'bandpass', f: vary(1800, 0.2), q: 4, delay: 0.1 + i * 0.13 }); },
    moan(out, s) { const f = 120 / s, l = lp(out, 520); tone(l, f, 1, 'sawtooth', 0.09, -f * 0.25, 0, 0.25); tone(l, f * 1.06, 1, 'sawtooth', 0.06, -f * 0.28, 0.05, 0.25); },
    // a shade still has a voice like a person's: a long low sigh falling away, and a whisper under it
    lament(out) { const l = lp(out, 900); tone(l, 220, 1.3, 'triangle', 0.08, -70, 0, 0.35); tone(l, 330, 1.1, 'sine', 0.04, -110, 0.12, 0.35); noise(out, 1.2, 0.03, { type: 'bandpass', f: 1800, q: 3, to: 900, attack: 0.4 }); },
    wail(out) { tone(out, 460, 0.55, 'sine', 0.06, 320, 0, 0.15); tone(out, 780, 0.7, 'sine', 0.06, -400, 0.45, 0.05); noise(out, 1, 0.03, { type: 'bandpass', f: 1200, q: 2, to: 700, attack: 0.3 }); },
    grunt(out, s) { const f = 170 / s, l = lp(out, 750); tone(l, f, 0.16, 'sawtooth', 0.13, -f * 0.35, 0, 0.015); tone(l, f * 0.9, 0.14, 'sawtooth', 0.1, -f * 0.3, 0.2, 0.015); noise(out, 0.12, 0.05, { f: 700 }); },
    roar(out, s) { const f = 120 / s, l = lp(out, 600); tone(l, f, 0.7, 'sawtooth', 0.16, -f * 0.4, 0, 0.06); tone(l, f * 1.5, 0.6, 'sawtooth', 0.07, -f * 0.6, 0, 0.06); noise(out, 0.6, 0.12, { type: 'bandpass', f: 380 / s, q: 1.2, attack: 0.08 }); },
    chant(out) { tone(out, 196, 0.8, 'sine', 0.06, 0, 0, 0.2); tone(out, 294, 0.8, 'sine', 0.04, 0, 0.05, 0.2); tone(lp(out, 400), 98, 0.8, 'sawtooth', 0.04, 0, 0, 0.2); },
    lich(out) {
      const l = lp(out, 420);
      tone(l, 62, 2.2, 'sawtooth', 0.16, -8, 0, 0.4); tone(l, 93, 2.2, 'sawtooth', 0.08, -12, 0.1, 0.4);
      noise(out, 2, 0.06, { type: 'bandpass', f: 700, q: 1.5, to: 300, attack: 0.6 });
      tone(out, 1400, 1.6, 'sine', 0.015, -700, 0.3, 0.5);
    },
  };
  // a room waking at once is a few voices, not a wall of them
  const VOICE_GAP = 0.18, VOICE_WINDOW = 2, VOICE_MOST = 3;
  /** @type {number[]} */
  let voicesAt = [];
  function voiceFree() {
    const now = Date.now() / 1000;
    voicesAt = voicesAt.filter(t => now - t < VOICE_WINDOW);
    if (voicesAt.length >= VOICE_MOST || (voicesAt.length && now - voicesAt[voicesAt.length - 1] < VOICE_GAP)) return false;
    voicesAt.push(now);
    return true;
  }
  const sizeOf = o => (o.who && MONSTERS[o.who] ? MONSTERS[o.who].scale : 1);

  // ---- the spells, each its own ----
  const SPELL = {
    magic_missile(out) { for (let i = 0; i < 3; i++) tone(out, vary(1200, 0.05), 0.09, 'sine', 0.09, -600, i * 0.07); noise(out, 0.2, 0.04, { type: 'bandpass', f: 2000, q: 2 }); },
    burning_hands(out) { noise(out, 0.4, 0.24, { type: 'bandpass', f: 600, to: 1600, q: 0.8, attack: 0.04 }); noise(out, 0.4, 0.12, { f: 300 }); },
    shield(out) { tone(out, 880, 0.6, 'sine', 0.05, 0, 0, 0.1); tone(out, 1324, 0.6, 'sine', 0.04, 0, 0.05, 0.1); tone(out, 440, 0.4, 'triangle', 0.05, 440); },
    lightning(out) { noise(out, 0.07, 0.22, { type: 'highpass', f: 2000 }); noise(out, 0.6, 0.2, { f: 600, to: 120, delay: 0.03 }); tone(lp(out, 900), 90, 0.25, 'sawtooth', 0.08, -20); },
    cone_cold(out) { noise(out, 0.55, 0.12, { type: 'highpass', f: 4000, to: 2000, attack: 0.05 }); for (let i = 0; i < 4; i++) tone(out, vary(2100, 0.15), 0.3, 'sine', 0.025, 0, 0.1 + i * 0.08); },
    cure_light(out) { tone(out, 523, 0.3, 'sine', 0.1); tone(out, 659, 0.4, 'sine', 0.09, 0, 0.12); },
    cure_serious(out) { tone(out, 523, 0.4, 'sine', 0.1); tone(out, 659, 0.45, 'sine', 0.09, 0, 0.12); tone(out, 784, 0.6, 'sine', 0.08, 0, 0.24); },
    bless(out) { ring(out, 784, 0.9, 0.08); tone(out, 392, 0.8, 'sine', 0.05, 0, 0, 0.1); },
    smite(out) { tone(out, 1046, 0.22, 'sine', 0.1, -523); noise(out, 0.12, 0.12, { type: 'bandpass', f: 2000, q: 1.5 }); tone(out, 80, 0.25, 'sine', 0.2, -30, 0.05); },
    protection(out) { tone(out, 262, 0.7, 'sine', 0.08, 0, 0, 0.2); tone(out, 392, 0.7, 'sine', 0.06, 0, 0.05, 0.2); },
    flame_strike(out) { noise(out, 0.6, 0.3, { f: 300, to: 2400, attack: 0.1 }); tone(out, 80, 0.6, 'sine', 0.25, -40, 0.1); },
    // a druid's: the lash's crack, a bear's roar, water over moss, creaking roots, the storm, a swarm
    thorn_lash(out) { noise(out, 0.18, 0.2, { type: 'bandpass', f: 900, to: 2600, q: 1.4, attack: 0.08 }); noise(out, 0.04, 0.2, { type: 'highpass', f: 2500, delay: 0.16 }); },
    wild_shape(out) { const l = lp(out, 700); tone(l, 90, 0.8, 'sawtooth', 0.16, 60, 0, 0.1); tone(l, 135, 0.7, 'sawtooth', 0.08, 40, 0.05, 0.1); noise(out, 0.6, 0.12, { f: 400, attack: 0.1 }); },
    mending_moss(out) { tone(out, 440, 0.4, 'sine', 0.08); tone(out, 587, 0.5, 'sine', 0.07, 0, 0.1); noise(out, 0.5, 0.05, { type: 'bandpass', f: 1600, q: 1, attack: 0.1 }); },
    entangle(out) { const l = lp(out, 900); for (let i = 0; i < 4; i++) tone(l, vary(160, 0.2), 0.18, 'sawtooth', 0.06, -40, i * 0.09); noise(out, 0.4, 0.1, { f: 500, to: 200, attack: 0.05 }); },
    call_lightning(out) { noise(out, 0.06, 0.24, { type: 'highpass', f: 2200 }); noise(out, 0.9, 0.24, { f: 500, to: 80, delay: 0.05 }); tone(lp(out, 600), 60, 0.6, 'sawtooth', 0.1, -20, 0.05); },
    insect_plague(out) { for (let i = 0; i < 3; i++) tone(lp(out, 1400), vary(220, 0.1), 0.7, 'sawtooth', 0.03, vary(40, 0.5), i * 0.05, 0.2); noise(out, 0.7, 0.08, { type: 'bandpass', f: 900, q: 3, attack: 0.2 }); },
  };

  const FX = {
    hit: (out, o) => {
      (STRIKE[strikeOf(o)] || STRIKE.blade)(out);
      // what was struck answers back: a clack of bone, a wet give of jelly
      if (o.gore === 'bone') tone(out, vary(1300, 0.1), 0.04, 'triangle', 0.06, 0, 0.01);
      if (o.gore === 'goo') tone(lp(out, 600), 200, 0.1, 'sine', 0.1, -100, 0.01);
      if (CRIT[o.tag]) { tone(out, 75, 0.28, 'sine', 0.3, -35, 0.02); noise(out, 0.22, 0.2, { f: 350, delay: 0.02 }); }
    },
    // a swing at nothing: the heavier the weapon, the lower and longer the whoosh
    swing: (out, o) => {
      const heavy = o.w && ITEMS[o.w] && ITEMS[o.w].speed >= 800;
      noise(out, heavy ? 0.24 : 0.17, 0.3, { type: 'bandpass', f: heavy ? 320 : 500, to: heavy ? 1100 : 1600, q: 1.3, attack: 0.05 });
    },
    miss: out => FX.swing(out, {}),
    // turned aside by hide or armour, where the sparks fly
    glance: out => { noise(out, 0.1, 0.1, { type: 'bandpass', f: 500, to: 1400, q: 1.3, attack: 0.03 }); ring(out, vary(1200, 0.1), 0.3, 0.06, 0.06); noise(out, 0.03, 0.12, { type: 'highpass', f: 3000, delay: 0.06 }); },
    block: out => { noise(out, 0.09, 0.26, { f: 1400, to: 400 }); tone(out, 170, 0.14, 'sine', 0.22, -60); ring(out, 700, 0.22, 0.035); },
    whiff: out => noise(out, 0.2, 0.25, { type: 'bandpass', f: 350, to: 1000, q: 1.2, attack: 0.06 }),
    hurt: out => {
      noise(out, 0.12, 0.22, { f: 900, to: 200 }); tone(out, 105, 0.2, 'sine', 0.22, -50);
      tone(lp(master, 500), 140, 0.2, 'sawtooth', 0.08, -50, 0.02, 0.01);   // your own grunt, wherever the blow came from
    },
    shoot: (out, o) => {
      if (o.w === 'sling') { noise(out, 0.1, 0.08, { type: 'bandpass', f: 700, q: 2 }); noise(out, 0.1, 0.1, { type: 'bandpass', f: 800, q: 2, delay: 0.1 }); tone(out, 600, 0.03, 'triangle', 0.08, 0, 0.2); }
      else if (o.w === 'throwknife') { noise(out, 0.09, 0.2, { type: 'bandpass', f: 1800, q: 1.5, to: 3000, attack: 0.02 }); }
      else { tone(lp(out, 1500), 190, 0.22, 'triangle', 0.14, -8); tone(out, 380, 0.1, 'sine', 0.05, -10); noise(out, 0.12, 0.06, { type: 'bandpass', f: 2600, q: 3, delay: 0.04 }); }
    },
    arrow: out => { tone(lp(out, 1200), 180, 0.15, 'triangle', 0.1, -10); noise(out, 0.16, 0.1, { type: 'bandpass', f: 2800, q: 4, to: 1800, delay: 0.03 }); },
    darkbolt: out => { noise(out, 0.3, 0.12, { type: 'bandpass', f: 500, q: 1, to: 1400, attack: 0.05 }); tone(lp(out, 900), 260, 0.3, 'sawtooth', 0.06, -140); tone(out, 1800, 0.25, 'sine', 0.02, -900); },
    // a blow being drawn back: short, rising, easy to learn to react to; a bow creaks instead
    windup: (out, o) => {
      if (o.kind === 'shot') { tone(lp(out, 1500), 300, 0.2, 'sawtooth', 0.05, 180, 0, 0.12); return; }
      tone(lp(out, 2200), 240, 0.17, 'sawtooth', 0.09, 260, 0, 0.02);
      noise(out, 0.16, 0.05, { type: 'bandpass', f: 500, to: 1500, q: 1.5, attack: 0.1 });
    },
    // a monster's own trick being readied: lower, longer, unlike any plain blow
    special: out => { const l = lp(out, 1600); tone(l, 110, 0.5, 'sawtooth', 0.13, 220, 0, 0.03); tone(l, 165, 0.5, 'triangle', 0.07, 330, 0.05); },
    smash: out => { noise(out, 0.3, 0.3, { f: 500, to: 120 }); tone(out, 60, 0.35, 'sine', 0.3, -25); clicks(out, 5, 0.3, 1500, 0.05); },
    web: out => { noise(out, 0.25, 0.12, { type: 'bandpass', f: 1800, q: 2, to: 900 }); tone(lp(out, 800), 300, 0.2, 'sine', 0.06, -150); },
    nova: out => { noise(out, 0.6, 0.2, { type: 'bandpass', f: 400, to: 2500, q: 0.8, attack: 0.1 }); tone(out, 1500, 0.5, 'sine', 0.04, -900, 0.1); tone(out, 60, 0.5, 'sine', 0.2, -20, 0.1); },
    // a named champion speaks with its kind's voice, deepened by its size
    voice: (out, o) => (VOICE[VOICE_OF[o.who] || VOICE_OF[MONSTERS[o.who] && MONSTERS[o.who].named ? MONSTERS[o.who].named.kin : '']] || VOICE.growl)(out, sizeOf(o)),
    growl: out => VOICE.growl(out, 1),
    death: (out, o) => (DEATH[o.gore] || DEATH.blood)(out, sizeOf(o)),
    raise: out => { noise(out, 0.9, 0.14, { f: 250, attack: 0.3 }); clicks(out, 10, 0.8, 1800, 0.07); tone(lp(out, 300), 50, 0.9, 'sawtooth', 0.08, 0, 0, 0.3); },
    cast: (out, o) => (SPELL[o.spell] || FX.spell)(out),

    // ---- the lich ----
    // a blow into its shadow: swallowed, not struck
    wardhit: out => { tone(lp(out, 600), 300, 0.18, 'sine', 0.1, -150); tone(out, 1100, 0.3, 'sine', 0.025, 200); },
    ward: (out, o) => {
      const dur = (o.ms || 4000) / 1000;
      hold('ward', out, dur, (g, t) => {
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.09, t + 0.3);
        g.gain.setValueAtTime(0.09, t + dur - 0.4);
        g.gain.linearRampToValueAtTime(0.0001, t + dur);
        return [osc(g, 'sine', 110), osc(g, 'sine', 111.3), osc(lp(g, 500), 'triangle', 220)];
      });
    },
    blink: out => { noise(out, 0.25, 0.14, { type: 'bandpass', f: 300, to: 3000, q: 1.5, attack: 0.2 }); tone(out, 900, 0.07, 'sine', 0.14, -600, 0.25); },
    snuff: out => {
      for (let i = 0; i < 5; i++) noise(out, 0.16, 0.1, { f: 1400, to: 250, delay: i * 0.14 + rnd() * 0.05, attack: 0.01 });
      tone(out, 55, 0.6, 'sine', 0.15, -15, 0.7, 0.05);
    },
    // the rite: a tone that climbs for as long as it lasts, cut off if it is broken
    rite: (out, o) => {
      const dur = (o.ms || 2400) / 1000;
      hold('rite', out, dur, (g, t) => {
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.14, t + dur);
        const f = lp(g, 300);
        f.frequency.setValueAtTime(300, t); f.frequency.linearRampToValueAtTime(1400, t + dur);
        const a = osc(f, 'sawtooth', 80), b = osc(g, 'sine', 160);
        a.frequency.setValueAtTime(80, t); a.frequency.exponentialRampToValueAtTime(240, t + dur);
        b.frequency.setValueAtTime(160, t); b.frequency.exponentialRampToValueAtTime(480, t + dur);
        return [a, b];
      });
    },
    riteBroken: out => {
      release('rite', 0.04);
      noise(out, 0.08, 0.22, { type: 'highpass', f: 1500 }); tone(out, 1200, 0.1, 'triangle', 0.1, -1000); tone(out, 70, 0.3, 'sine', 0.25, -30, 0.02);
    },
    riteDone: out => {
      release('rite', 0.3);
      [220, 330, 440, 660].forEach((f, i) => tone(out, f, 1.2, 'sine', 0.06, 0, i * 0.04, 0.5));
      noise(out, 1, 0.05, { type: 'highpass', f: 3000, attack: 0.5 });
    },
    lichfall: out => {
      releaseAll();
      DEATH.bone(out); DEATH.bone(out); DEATH.ecto(out);
      tone(out, 55, 1.8, 'sine', 0.3, -30, 0, 0.02);
      noise(out, 1.5, 0.15, { f: 300, to: 60 });
      // the torches catching again, one by one
      for (let i = 0; i < 4; i++) noise(out, 0.3, 0.08, { type: 'bandpass', f: 800, q: 0.8, to: 400, delay: 1 + i * 0.3, attack: 0.05 });
    },
    heart: out => {
      [523, 784, 1046, 1568].forEach((f, i) => tone(out, f, 2.6, 'sine', 0.06, 0, i * 0.08, 0.01));
      tone(out, 131, 2.5, 'sine', 0.12, 0, 0, 0.8);
      noise(out, 2, 0.04, { type: 'highpass', f: 4000, attack: 0.8 });
    },

    // ---- stings ----
    // the deep has heard of you: something low and wrong under the floor
    dread: out => {
      const l = lp(out, 300);
      tone(l, 55, 2, 'sawtooth', 0.14, -5, 0, 0.6); tone(l, 58.3, 2, 'sawtooth', 0.12, -5, 0, 0.6);
      tone(out, 41, 2, 'sine', 0.15, 0, 0, 0.8); noise(out, 1.6, 0.06, { f: 200, attack: 0.6 });
    },
    // a war-horn sounded in the dark: two long brassy blasts
    horn: out => {
      const l = lp(out, 900);
      tone(l, 147, 0.7, 'sawtooth', 0.12, 8, 0, 0.12); tone(l, 220, 0.7, 'sawtooth', 0.06, 12, 0.02, 0.12);
      tone(l, 147, 1.1, 'sawtooth', 0.13, -10, 0.85, 0.15); tone(l, 196, 1.1, 'sawtooth', 0.07, -12, 0.87, 0.15);
    },
    // the Warlord's war-drum: BOOM. BOOM. and two quicker, a hide drum's skin rattling under each
    drum: out => {
      [0, 0.55, 1.0, 1.25].forEach((at, i) => {
        tone(out, vary(62, 0.05), 0.45, 'sine', i < 2 ? 0.34 : 0.26, -24, at, 0.004);
        noise(out, 0.12, i < 2 ? 0.2 : 0.15, { f: 260, to: 90, delay: at });
        noise(out, 0.2, 0.04, { type: 'bandpass', f: 1400, q: 2, delay: at + 0.02 });
      });
    },
    // a named champion falls: a low blow, then a rising brass figure
    namedfall: out => {
      tone(out, 55, 1.2, 'sine', 0.25, -20, 0, 0.02);
      noise(out, 0.8, 0.12, { f: 400, to: 80 });
      [262, 330, 392, 523].forEach((f, i) => tone(lp(out, 1600), f, 0.5, 'sawtooth', 0.05, 0, 0.5 + i * 0.14, 0.04));
    },
    ambush: out => {
      noise(out, 0.08, 0.3, { f: 2500 });
      const l = lp(out, 1400); tone(l, 220, 0.5, 'sawtooth', 0.12, -40); tone(l, 233, 0.5, 'sawtooth', 0.1, -40);
      tone(out, 70, 0.4, 'sine', 0.25, -30, 0.05);
    },
    // settling down to sleep: cloth, a breath, two soft notes
    rest: out => { noise(out, 1.4, 0.06, { f: 500, to: 200, attack: 0.5 }); tone(out, 262, 1.2, 'sine', 0.05, 0, 0.2, 0.3); tone(out, 196, 1.4, 'sine', 0.05, 0, 0.6, 0.3); },

    // ---- everything else ----
    pickup: out => { tone(out, 660, 0.08, 'triangle', 0.1); tone(out, 990, 0.1, 'triangle', 0.1, 0, 0.08); },
    gold: out => { tone(out, 1200, 0.06, 'triangle', 0.1); tone(out, 1600, 0.08, 'triangle', 0.1, 0, 0.06); },
    door: out => { tone(lp(out, 900), vary(180, 0.1), 0.28, 'sawtooth', 0.05, 90, 0, 0.05); noise(out, 0.12, 0.12, { f: 500, delay: 0.22 }); tone(out, 80, 0.14, 'sine', 0.12, -30, 0.22); },
    // a shut door taking a blow from the far side: a dull thud and a creak of planks
    batter: out => { tone(out, 70, 0.2, 'sine', 0.28, -25); noise(out, 0.16, 0.2, { f: 380, to: 140 }); tone(lp(out, 600), vary(110, 0.15), 0.3, 'sawtooth', 0.04, -30, 0.08); },
    // and giving way: the thud, then planks cracking apart
    splinter: out => { tone(out, 60, 0.35, 'sine', 0.3, -25); noise(out, 0.3, 0.3, { f: 600, to: 120 }); clicks(out, 12, 0.45, 2400, 0.09); noise(out, 0.25, 0.14, { type: 'highpass', f: 1800, delay: 0.06 }); },
    locked: out => { tone(out, 200, 0.07, 'triangle', 0.1); tone(out, 160, 0.1, 'triangle', 0.1, 0, 0.09); clicks(out, 3, 0.15, 1800, 0.05); },
    stairs: out => { for (let i = 0; i < 4; i++) { tone(out, 500 - i * 90, 0.12, 'triangle', 0.08, 0, i * 0.1); noise(out, 0.05, 0.05, { f: 800, delay: i * 0.1 }); } },
    spell: out => tone(out, 300, 0.3, 'sine', 0.15, 700),
    heal: out => { tone(out, 520, 0.12, 'sine', 0.12); tone(out, 780, 0.2, 'sine', 0.12, 0, 0.1); },
    levelup: out => { [523, 659, 784, 1046].forEach((f, i) => tone(out, f, 0.2, 'triangle', 0.1, 0, i * 0.12)); },
    die: out => { releaseAll(); tone(lp(out, 600), 300, 1.4, 'sawtooth', 0.16, -240); tone(out, 60, 1.5, 'sine', 0.2, -25); },
    win: out => { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(out, f, 0.35, 'triangle', 0.1, 0, 0.3 + i * 0.15)); },
    trap: out => { noise(out, 0.15, 0.2, { f: 2000 }); tone(out, 700, 0.1, 'triangle', 0.1, -500); },
    // a scroll read: the page unrolled, a hum rising as its writing kindles
    // (pitched by what it does), then the crackle and whoosh of it burning
    read: (out, v) => {
      const base = { fire: 196, heal: 330, map: 262, teleport: 220, uncurse: 392 }[v.kind] || 262;
      noise(out, 0.22, 0.09, { type: 'bandpass', f: 2600, q: 0.8, attack: 0.04 });
      noise(out, 0.12, 0.06, { type: 'bandpass', f: 1800, q: 1, delay: 0.14 });
      tone(out, base, 0.45, 'sine', 0.07, base, 0.18, 0.2);
      tone(out, base * 1.5, 0.4, 'triangle', 0.03, base * 1.5, 0.25, 0.2);
      for (let i = 0; i < 18; i++) noise(out, 0.02 + rnd() * 0.02, 0.05 * (0.6 + rnd() * 0.4), { type: 'bandpass', f: vary(2600, 0.4), q: 3, delay: 0.62 + rnd() * 0.36 });
      noise(out, 0.35, 0.1, { f: 900, to: 300, delay: 0.6, attack: 0.05 });
    },
    // a draught: the cork, then three swallows
    drink: out => {
      noise(out, 0.03, 0.14, { type: 'bandpass', f: 1800, q: 2, delay: 0.12 });
      tone(out, 900, 0.06, 'sine', 0.08, -500, 0.12);
      for (let i = 0; i < 3; i++) {
        const t = 0.3 + i * 0.11;
        tone(lp(out, 600), vary(170, 0.1), 0.09, 'sine', 0.14, -60, t);
        noise(out, 0.05, 0.04, { type: 'bandpass', f: 400, q: 2, delay: t });
      }
    },
    // two bites, timed to the bread reaching the mouth in the view
    eat: out => { noise(out, 0.06, 0.08, { type: 'bandpass', f: 1500, q: 1, delay: 0.36 }); noise(out, 0.06, 0.08, { type: 'bandpass', f: 1300, q: 1, delay: 0.52 }); tone(out, 200, 0.1, 'triangle', 0.06, 0, 0.46); },
    bump: out => { tone(out, 80, 0.08, 'sine', 0.12); noise(out, 0.06, 0.08, { f: 300 }); },
    step: out => noise(out, 0.05, vary(0.09, 0.25), { f: vary(900, 0.2) }),
    fountain: out => { tone(out, 500, 0.1, 'sine', 0.1); tone(out, 700, 0.12, 'sine', 0.1, 0, 0.1); tone(out, 900, 0.15, 'sine', 0.1, 0, 0.2); },
    secret: out => { tone(out, 300, 0.12, 'triangle', 0.1); tone(out, 450, 0.12, 'triangle', 0.1, 0, 0.12); tone(out, 600, 0.2, 'triangle', 0.1, 0, 0.24); },
    error: out => tone(lp(out, 800), 150, 0.15, 'sawtooth', 0.08, -50),
    // one of the distant sounds, by name: the ambience plays these on its own
    far: (out, o) => (FAR[o.what] || FAR.drip)(out),
  };

  // ---- ambience: a drone under each floor, its own for each theme ----
  // hz and sub: the drone's two notes; cut: how dark it is; bed: a wash of
  // noise (moving like wind where wind is set); hum: a note the black glass
  // sings; far: what is heard now and then in the distance, every `gap` seconds.
  const THEME_AMB = [
    { hz: 42, sub: 27, cut: 220, bed: 0.03, bedF: 300, wind: 0, hum: 0, far: ['drip', 'rumble', 'creak'], gap: [7, 16] },          // Grey Halls
    { hz: 38, sub: 25, cut: 190, bed: 0.035, bedF: 250, wind: 0, hum: 0, far: ['bones', 'rumble', 'drip'], gap: [8, 18] },          // Brown Catacombs
    { hz: 45, sub: 30, cut: 240, bed: 0.04, bedF: 1100, wind: 0, hum: 0, far: ['drip', 'drip', 'drip', 'trickle'], gap: [3, 8] },    // Mossy Depths
    { hz: 48, sub: 32, cut: 260, bed: 0.12, bedF: 500, wind: 1, hum: 0, far: ['wind', 'wind', 'chain'], gap: [6, 14] },            // Blue Vaults
    { hz: 40, sub: 26.5, cut: 210, bed: 0.03, bedF: 300, wind: 0, hum: 0, far: ['chain', 'moan', 'drip'], gap: [7, 16] },         // Crimson Crypts
    { hz: 55, sub: 27.5, cut: 300, bed: 0.02, bedF: 200, wind: 0, hum: 0.012, far: ['pulse', 'rumble'], gap: [6, 14] },          // Obsidian Sanctum
    // the roads at the divided stair (THEMES 6 and 7)
    { hz: 37, sub: 24.5, cut: 180, bed: 0.03, bedF: 260, wind: 0, hum: 0, far: ['bones', 'moan', 'bones', 'drip'], gap: [7, 15] },  // The Ossuary
    { hz: 44, sub: 29, cut: 230, bed: 0.035, bedF: 420, wind: 0, hum: 0, far: ['clatter', 'drip', 'creak', 'clatter'], gap: [5, 12] }, // The Warrens
  ];
  const FAR = {
    drip(out) { const f = vary(1500, 0.25); tone(out, f, 0.06, 'sine', 0.05, -f * 0.5); tone(out, f * 0.9, 0.05, 'sine', 0.016, -f * 0.45, 0.14); },
    trickle(out) { for (let i = 0; i < 5; i++) { const f = vary(1800, 0.3); tone(out, f, 0.04, 'sine', 0.03, -f * 0.4, i * 0.07 + rnd() * 0.05); } },
    rumble(out) { noise(out, 2.2, 0.12, { f: 140, attack: 0.8, rate: 0.5 }); },
    wind(out) { noise(out, 3, 0.15, { type: 'bandpass', f: 380, to: 900, q: 4, attack: 1.2 }); },
    chain(out) { for (let i = 0; i < 4; i++) ring(out, vary(1900, 0.15), 0.25, 0.012, i * 0.13 + rnd() * 0.05); },
    creak(out) { tone(lp(out, 500), vary(95, 0.2), 0.8, 'sawtooth', 0.03, 30, 0, 0.3); },
    bones(out) { clicks(out, 6, 0.6, 1600, 0.1); },
    moan(out) { tone(lp(out, 450), vary(150, 0.15), 1.6, 'sawtooth', 0.03, -30, 0, 0.5); },
    pulse(out) { tone(out, 55, 1.2, 'sine', 0.1, 0, 0, 0.3); tone(out, 55, 1.2, 'sine', 0.07, 0, 1.4, 0.3); },
    // goblins somewhere down the tunnels: a clatter of pots and a thrown stone
    clatter(out) { clicks(out, 8, 0.7, 900, 0.1); noise(out, 0.15, 0.05, { f: 700, delay: 0.35 }); },
  };
  /** @type {any} the running drone's nodes */
  let amb = null;
  let ambLevel = 0;        // 0 quiet exploration, 1 the lich's fight
  let ambTheme = -1;
  let farAt = 0;           // when the next distant sound comes, in the audio clock
  let beatAt = 0, beatRate = 0;

  function startAmbience() {
    const c = ensure();
    if (!c || amb) return;
    try {
      const out = c.createGain();
      out.gain.value = 0;
      out.connect(master);
      const drone = c.createGain();
      drone.gain.value = 0.035;
      drone.connect(out);
      const filter = lp(drone, 220);
      const o = osc(filter, 'sawtooth', 42);
      const sub = osc(filter, 'sine', 27);
      const humGain = c.createGain();
      humGain.gain.value = 0;
      humGain.connect(out);
      const hum = osc(humGain, 'sine', 110);
      // a slow wobble keeps the drone from sounding like a dial tone
      const lfoGain = c.createGain();
      lfoGain.gain.value = 5;
      lfoGain.connect(o.frequency);
      const lfo = osc(lfoGain, 'sine', 0.07);
      // the bed: noise on a loop, through a band that wind can sweep
      const bedGain = c.createGain();
      bedGain.gain.value = 0;
      bedGain.connect(out);
      const bedFilter = lp(bedGain, 300, 'bandpass', 0.8);
      const bed = c.createBufferSource();
      bed.buffer = noiseBuf; bed.loop = true;
      bed.connect(bedFilter); bed.start();
      const windGain = c.createGain();
      windGain.gain.value = 0;
      windGain.connect(bedFilter.frequency);
      const wind = osc(windGain, 'sine', 0.11);
      amb = { out, drone, filter, osc: o, sub, humGain, hum, lfo, bedGain, bedFilter, bed, windGain, wind };
      out.gain.linearRampToValueAtTime(1, c.currentTime + 3);
      ambTheme = -1;
    } catch (e) { amb = null; }
  }
  function stopAmbience() {
    farAt = 0;
    if (!amb || !ctx) { amb = null; return; }
    try {
      const t = ctx.currentTime, dead = amb;
      dead.out.gain.cancelScheduledValues(t);
      dead.out.gain.setValueAtTime(dead.out.gain.value, t);
      dead.out.gain.linearRampToValueAtTime(0, t + 0.4);
      for (const k of ['osc', 'sub', 'hum', 'lfo', 'bed', 'wind']) dead[k].stop(t + 0.5);
    } catch (e) { /* ignore */ }
    amb = null;
  }
  /** Bring the drone to a floor's theme and the fight's pitch, over a second and a half. */
  function tune(level, theme) {
    const a = THEME_AMB[theme] || THEME_AMB[0], t = ctx.currentTime, at = t + 1.5;
    const ramp = (p, v) => { p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); p.linearRampToValueAtTime(v, at); };
    ramp(amb.drone.gain, level ? 0.075 : 0.035);
    ramp(amb.filter.frequency, a.cut * (level ? 1.9 : 1));
    ramp(amb.osc.frequency, a.hz * (level ? 1.28 : 1));
    ramp(amb.sub.frequency, a.sub);
    ramp(amb.humGain.gain, a.hum * (level ? 1.6 : 1));
    ramp(amb.bedGain.gain, a.bed);
    ramp(amb.bedFilter.frequency, a.bedF);
    ramp(amb.windGain.gain, a.wind ? a.bedF * 0.5 : 0);
  }
  /** Now and then, something far off: a drip, a chain, a gust. */
  function distant(theme) {
    const a = THEME_AMB[theme] || THEME_AMB[0], t = ctx.currentTime;
    if (farAt && t >= farAt) {
      const name = a.far[Math.floor(rnd() * a.far.length)];
      FAR[name](bus({ gain: 0.5 + rnd() * 0.5, pan: (rnd() * 2 - 1) * 0.8, cut: 1400 + rnd() * 1400 }));
    }
    if (!farAt || t >= farAt) farAt = t + a.gap[0] + rnd() * (a.gap[1] - a.gap[0]);
  }
  /** Called every frame: the drone follows the fight and the floor's theme. */
  function setAmbience(level, theme = 0) {
    if (!enabled) return;
    if (!amb) startAmbience();
    if (!amb || !ctx) { ambLevel = level; return; }
    try {
      if (level !== ambLevel || theme !== ambTheme) { ambLevel = level; ambTheme = theme; tune(level, theme); }
      distant(theme);
    } catch (e) { fault('ambience', e); }
  }
  // hpFraction 0..1; below a quarter the player hears their own pulse
  function heartbeat(hpFraction, now) {
    if (!enabled || hpFraction > 0.25 || hpFraction <= 0) { beatRate = 0; return; }
    beatRate = 1100 - (0.25 - hpFraction) * 2400;
    if (now < beatAt) return;
    beatAt = now + Math.max(420, beatRate);
    if (!ensure()) return;
    try {
      tone(master, 58, 0.11, 'sine', 0.22);
      tone(master, 46, 0.13, 'sine', 0.16, 0, 0.16);
    } catch (e) { /* ignore */ }
  }

  return {
    /**
     * Play a sound. `o` may place it ({dist, pan, behind}, from the hero) and
     * carry what shapes it: the weapon and tag of a blow, a creature's id, a
     * spell's id, how long a held sound lasts. Too far off, it is not played.
     * @param {string} name @param {Record<string, any>} [o]
     */
    play(name, o) {
      const v = place(o);
      if (!v) return;
      if (name === 'voice' && v.who !== 'lich' && !voiceFree()) return;
      if (listener) { try { listener(name, v); } catch (e) { /* ignore */ } }
      if (!enabled) return;
      try { const f = FX[name]; if (f && ensure()) f(bus(v), v); } catch (e) { fault(name, e); }
    },
    /** Every sound it knows by name, and every distant one: for tests. */
    names() { return { fx: Object.keys(FX), far: Object.keys(FAR) }; },
    /** Stop a held sound (the lich's rite, its ward) early. */
    stop(name) { release(name); },
    /** @param {((name: string, v: Record<string, any>) => void)|null} fn  told of every sound played, even with no audio: for tests */
    listen(fn) { listener = fn; },
    toggle() {
      enabled = !enabled;
      try { localStorage.setItem('deepdelve.sound', enabled ? 'on' : 'off'); } catch (e) { /* ignore */ }
      if (enabled) ensure(); else { stopAmbience(); releaseAll(); ambLevel = 0; }
      return enabled;
    },
    isEnabled() { return enabled; },
    /** The audio clock and the master the music plays into, or null while sound is off or cannot be had. */
    audio() { const c = ensure(); return c && master ? { ctx: c, master } : null; },
    unlock() { ensure(); },
    /** The page was hidden or shown: a hidden page makes no sound at all. */
    away(hidden) {
      away = hidden;
      if (!ctx) return;
      try { if (hidden) ctx.suspend().catch(() => {}); else if (enabled) ctx.resume().catch(() => {}); } catch (e) { /* ignore */ }
    },
    setAmbience, stopAmbience, heartbeat,
  };
})();

export { Sound };
