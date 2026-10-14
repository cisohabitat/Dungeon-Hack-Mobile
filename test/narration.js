'use strict';
const assert = require('node:assert/strict');
const { installGlobals } = require('./harness');

async function main() {
  const { makeNarration } = await import('../js/narration.js');
  installGlobals();
  let enabled = true;
  const sounds = [], states = [];
  function makeAudio() {
    const a = {
      src: '', volume: 1, paused: true, plays: 0,
      canPlayType: () => 'probably',
      play() { this.plays++; this.paused = false; return Promise.resolve(); },
      pause() { this.paused = true; }, removeAttribute() { this.src = ''; }, load() {},
      onplaying: null, onended: null, onerror: null,
    };
    sounds.push(a); return a;
  }
  const n = makeNarration({ enabled: () => enabled, onState: s => states.push(s), makeAudio });
  assert.equal(n.volume(), 0.85, 'a fresh installation starts with audible narration volume');
  enabled = false; n.start(); assert.equal(sounds.length, 0, 'sound off must not fetch or play narration');
  enabled = true; n.start(); const first = sounds[0];
  assert.equal(first.src, 'sound/narration/prologue.m4a');
  first.onplaying(); assert.equal(states.at(-1), 'playing');
  n.setVolume(0.3); assert.equal(first.volume, 0.3);
  assert.equal(localStorage.getItem('deepdelve.voiceVolume'), '0.3');
  n.pause(); assert.equal(first.paused, true); assert.equal(states.at(-1), 'paused');
  n.toggle(); assert.equal(first.plays, 2);
  first.onended(); n.toggle(); const replay = sounds[0];
  assert.equal(replay.volume, 0.3, 'replay keeps voice volume');
  replay.onerror(); assert.equal(replay.src, 'sound/narration/prologue.ogg', 'try the other codec');
  replay.onerror(); assert.equal(states.at(-1), 'unavailable');
  assert.equal(replay.paused, true); assert.equal(replay.src, '');
  n.start(); const stale = sounds.at(-1).onplaying;
  n.stop(); stale(); assert.equal(states.at(-1), 'idle', 'a late event cannot restart narration after leaving');
  enabled = false; n.toggle(); assert.equal(states.at(-1), 'idle');
  const remembered = makeNarration({ enabled: () => true, onState() {}, makeAudio });
  assert.equal(remembered.volume(), 0.3);
  remembered.setVolume(NaN); assert.equal(remembered.volume(), 0.3);
  remembered.setVolume(99); assert.equal(remembered.volume(), 1);
  // A deferred autoplay rejection must not change the next narration's controls.
  let reject;
  const late = makeAudio(); late.play = () => new Promise((_, no) => { reject = no; });
  const deferred = makeNarration({ enabled: () => true, onState: s => states.push(s), makeAudio: () => late });
  deferred.start(); deferred.stop(); reject({ name: 'NotAllowedError' });
  await Promise.resolve(); assert.equal(states.at(-1), 'idle');
  const channel = { gain: { value: 1 }, connect() {}, disconnect() {} };
  let bindings = 0;
  const wired = makeNarration({ enabled: () => true, onState() {}, makeAudio,
    output: () => ({ ctx: { createMediaElementSource: () => { bindings++; return { connect() {}, disconnect() {} }; }, createGain: () => channel }, master: {} }) });
  wired.start(); wired.setVolume(0.25);
  assert.equal(channel.gain.value, 0.25, 'voice volume uses a gain node for iPhones');
  assert.equal(sounds.at(-1).volume, 1, 'volume is not attenuated twice'); wired.stop(); wired.start(['next-reading']);
  assert.equal(bindings, 1, 'the unlocked element is bound to Web Audio only once'); wired.stop();
  const tracks = [];
  const playlist = makeNarration({ enabled: () => true, onState: s => states.push(s), onTrack: id => tracks.push(id), makeAudio });
  playlist.start(['first', 'second']); const voice = sounds.at(-1), count = sounds.length;
  voice.onplaying(); const staleEnd = voice.onended; voice.onended();
  assert.equal(voice.src, 'sound/narration/second.m4a');
  assert.equal(sounds.length, count, 'a playlist keeps one unlocked media element');
  staleEnd(); assert.equal(voice.src, 'sound/narration/second.m4a');
  voice.onplaying(); voice.onended(); assert.equal(playlist.state(), 'finished');
  playlist.toggle(); assert.equal(sounds.at(-1).src, 'sound/narration/first.m4a');
  assert.equal(sounds.length, count, 'later readings reuse the element a phone unlocked');
  playlist.stop(); playlist.start(['missing', 'present']); const fallback = sounds.at(-1);
  fallback.onerror(); fallback.onerror();
  assert.equal(fallback.src, 'sound/narration/present.m4a', 'a missing clip does not cancel later readings');
  fallback.onplaying(); fallback.onended(); assert.equal(playlist.state(), 'finished');
  playlist.start(['../secret']); assert.equal(playlist.state(), 'idle');
  assert.deepEqual(tracks.slice(0, 2), ['first', 'second']);
  console.log('narration checks complete, 0 failure(s)');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
