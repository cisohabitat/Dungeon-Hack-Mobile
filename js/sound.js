'use strict';
// Tiny synthesized sound effects via WebAudio. No audio files needed.

const Sound = (() => {
  let ctx = null;
  let enabled = true;
  try { enabled = localStorage.getItem('deepdelve.sound') !== 'off'; } catch (e) { /* ignore */ }

  function ensure() {
    if (!enabled) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
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
    error: () => tone(150, 0.15, 'square', 0.08, -50),
  };

  return {
    play(name) { if (!enabled) return; try { (FX[name] || (() => {}))(); } catch (e) { /* ignore */ } },
    toggle() { enabled = !enabled; try { localStorage.setItem('deepdelve.sound', enabled ? 'on' : 'off'); } catch (e) { /* ignore */ } if (enabled) ensure(); return enabled; },
    isEnabled() { return enabled; },
    unlock() { ensure(); },
  };
})();
