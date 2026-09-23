// Tiny synthesized sound effects via WebAudio. No audio files needed.

const Sound = (() => {
  let ctx = null;
  let enabled = true;
  try { enabled = localStorage.getItem('deepdelve.sound') !== 'off'; } catch (e) { /* ignore */ }

  function ensure() {
    if (!enabled) return null;
    if (!ctx) {
      // Safari shipped this prefixed for years and still answers to it
      const AC = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function tone(freq, dur, type = 'square', vol = 0.15, slide = 0, delay = 0) {
    const c = ensure();
    if (!c) return;
    const t0 = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol = 0.12, delay = 0) {
    const c = ensure();
    if (!c) return;
    const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const s = c.createBufferSource();
    s.buffer = buf;
    const g = c.createGain();
    g.gain.value = vol;
    s.connect(g).connect(c.destination);
    s.start(c.currentTime + delay);
  }

  const FX = {
    hit: () => { noise(0.08, 0.2); tone(180, 0.12, 'square', 0.12, -100); },
    miss: () => tone(400, 0.12, 'sawtooth', 0.06, -250),
    hurt: () => { tone(120, 0.25, 'sawtooth', 0.18, -60); noise(0.12, 0.1); },
    pickup: () => { tone(660, 0.08, 'square', 0.08); tone(990, 0.1, 'square', 0.08, 0, 0.08); },
    gold: () => { tone(1200, 0.06, 'triangle', 0.1); tone(1600, 0.08, 'triangle', 0.1, 0, 0.06); },
    door: () => { tone(90, 0.2, 'square', 0.12, -40); noise(0.1, 0.05); },
    locked: () => { tone(200, 0.08, 'square', 0.1); tone(160, 0.12, 'square', 0.1, 0, 0.1); },
    stairs: () => { for (let i = 0; i < 4; i++) tone(500 - i * 90, 0.12, 'triangle', 0.1, 0, i * 0.1); },
    spell: () => tone(300, 0.3, 'sine', 0.15, 700),
    heal: () => { tone(520, 0.12, 'sine', 0.12); tone(780, 0.2, 'sine', 0.12, 0, 0.1); },
    levelup: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'square', 0.1, 0, i * 0.12)); },
    die: () => { tone(300, 1.2, 'sawtooth', 0.2, -260); },
    win: () => { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.3, 'triangle', 0.12, 0, i * 0.15)); },
    trap: () => { noise(0.15, 0.2); tone(700, 0.1, 'square', 0.1, -500); },
    eat: () => { tone(220, 0.08, 'triangle', 0.1); tone(180, 0.1, 'triangle', 0.1, 0, 0.1); },
    bump: () => tone(80, 0.06, 'square', 0.06),
    step: () => noise(0.04, 0.035),
    growl: () => tone(70, 0.35, 'sawtooth', 0.12, -30),
    // a blow being drawn back: short, rising, easy to learn to react to
    windup: () => tone(240, 0.16, 'sawtooth', 0.07, 260),
    // a monster's own trick being readied: lower, longer, unlike any plain blow
    special: () => { tone(110, 0.5, 'sawtooth', 0.12, 220); tone(165, 0.5, 'square', 0.05, 330, 0.05); },
    arrow: () => { noise(0.06, 0.12); tone(900, 0.08, 'triangle', 0.08, -500); },
    fountain: () => { tone(500, 0.1, 'sine', 0.1); tone(700, 0.12, 'sine', 0.1, 0, 0.1); tone(900, 0.15, 'sine', 0.1, 0, 0.2); },
    secret: () => { tone(300, 0.12, 'square', 0.08); tone(450, 0.12, 'square', 0.08, 0, 0.12); tone(600, 0.2, 'square', 0.08, 0, 0.24); },
    error: () => tone(150, 0.15, 'square', 0.08, -50),
  };

  // ---- ambience: a low drone under the dungeon, and a heartbeat when hurt ----
  let amb = null;          // { osc, sub, gain, filter }
  let ambLevel = 0;        // 0 quiet exploration, 1 the escape
  let beatAt = 0, beatRate = 0;

  function startAmbience() {
    const c = ensure();
    if (!c || amb) return;
    try {
      const gain = c.createGain();
      gain.gain.value = 0.0;
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 220;
      const osc = c.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 42;
      const sub = c.createOscillator();
      sub.type = 'sine';
      sub.frequency.value = 27;
      // a slow wobble keeps the drone from sounding like a dial tone
      const lfo = c.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.07;
      const lfoGain = c.createGain();
      lfoGain.gain.value = 5;
      lfo.connect(lfoGain).connect(osc.frequency);
      osc.connect(filter);
      sub.connect(filter);
      filter.connect(gain).connect(c.destination);
      osc.start(); sub.start(); lfo.start();
      amb = { osc, sub, lfo, gain, filter };
      gain.gain.linearRampToValueAtTime(0.035, c.currentTime + 3);
    } catch (e) { amb = null; }
  }
  function stopAmbience() {
    if (!amb || !ctx) { amb = null; return; }
    try {
      amb.gain.gain.cancelScheduledValues(ctx.currentTime);
      amb.gain.gain.setValueAtTime(amb.gain.gain.value, ctx.currentTime);
      amb.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
      const dead = amb;
      setTimeout(() => { try { dead.osc.stop(); dead.sub.stop(); dead.lfo.stop(); } catch (e) { /* ignore */ } }, 600);
    } catch (e) { /* ignore */ }
    amb = null;
  }
  function setAmbience(level) {
    if (!enabled) return;
    if (!amb) startAmbience();
    if (!amb || !ctx || level === ambLevel) { ambLevel = level; return; }
    ambLevel = level;
    try {
      const t = ctx.currentTime;
      amb.gain.gain.linearRampToValueAtTime(level ? 0.075 : 0.035, t + 1.5);
      amb.filter.frequency.linearRampToValueAtTime(level ? 420 : 220, t + 1.5);
      amb.osc.frequency.linearRampToValueAtTime(level ? 54 : 42, t + 1.5);
    } catch (e) { /* ignore */ }
  }
  // hpFraction 0..1; below a quarter the player hears their own pulse
  function heartbeat(hpFraction, now) {
    if (!enabled || hpFraction > 0.25 || hpFraction <= 0) { beatRate = 0; return; }
    beatRate = 1100 - (0.25 - hpFraction) * 2400;
    if (now < beatAt) return;
    beatAt = now + Math.max(420, beatRate);
    tone(58, 0.11, 'sine', 0.22);
    tone(46, 0.13, 'sine', 0.16, 0, 0.16);
  }

  return {
    play(name) { if (!enabled) return; try { (FX[name] || (() => {}))(); } catch (e) { /* ignore */ } },
    toggle() {
      enabled = !enabled;
      try { localStorage.setItem('deepdelve.sound', enabled ? 'on' : 'off'); } catch (e) { /* ignore */ }
      if (enabled) ensure(); else { stopAmbience(); ambLevel = 0; }
      return enabled;
    },
    isEnabled() { return enabled; },
    unlock() { ensure(); },
    setAmbience, stopAmbience, heartbeat,
  };
})();

export { Sound };
