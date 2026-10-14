// Recorded readings share one player, from the opening to the end of a delve.
// A missing file leaves the written story and the way onward available.

/** @param {{enabled: () => boolean, onState: (state: string) => void, onTrack?: (id: string) => void, makeAudio?: () => HTMLAudioElement, output?: () => {ctx: AudioContext, master: AudioNode}|null}} o */
export function makeNarration(o) {
  const KEY = 'deepdelve.voiceVolume';
  let volume = 0.85;
  try {
    const saved = localStorage.getItem(KEY);
    if (saved !== null && Number.isFinite(Number(saved))) volume = Math.max(0, Math.min(1, Number(saved)));
  } catch { /* private browsing */ }
  /** @type {HTMLAudioElement|null} */
  let audio = null;
  /** @type {MediaElementAudioSourceNode|null} */
  let source = null;
  /** @type {GainNode|null} */
  let gain = null;
  let state = 'idle', generation = 0;
  let tracks = ['prologue'], index = 0, heard = false;
  const say = s => { state = s; o.onState(s); };
  function stop() {
    generation++;
    if (audio) {
      audio.onplaying = audio.onended = audio.onerror = null;
      audio.pause(); audio.removeAttribute('src'); audio.load();
    }
    // Keep this element and its source: Safari unlocks a particular element,
    // and a later discovery must inherit the first reading's permission.
    say('idle');
  }
  function play(a, turn, track = index) {
    const p = a.play();
    if (p && p.catch) p.catch(e => {
      if (turn !== generation || audio !== a || track !== index) return;
      // A browser may need a second tap before speaking. A missing recording
      // is dealt with by the media error, which also tries the other format.
      if (e.name === 'NotAllowedError') say('paused');
    });
  }
  /** @param {string[]} [ids] */
  function start(ids = ['prologue']) {
    stop();
    tracks = ids.filter(id => /^[a-z0-9-]+$/.test(id)); index = 0; heard = false;
    if (!tracks.length) return;
    if (!o.enabled()) return;
    const a = audio || (o.makeAudio ? o.makeAudio() : new Audio());
    audio = a;
    const turn = generation;
    const formats = a.canPlayType('audio/mp4; codecs="mp4a.40.2"') ? ['m4a', 'ogg'] : ['ogg', 'm4a'];
    a.volume = gain ? 1 : volume; a.preload = 'auto';
    // iPhones leave an element's volume to the hardware buttons. Give the
    // voice its own gain on the game's master so its slider works there too.
    const out = o.output && o.output();
    if (out && !source) {
      source = out.ctx.createMediaElementSource(a); gain = out.ctx.createGain();
      gain.gain.value = volume; a.volume = 1;
      source.connect(gain); gain.connect(out.master);
    }
    // One element stays unlocked across every reading, including on iPhones.
    function next() {
      if (audio !== a || turn !== generation) return;
      if (index >= tracks.length) { if (heard) say('finished'); else { stop(); say('unavailable'); } return; }
      const which = index;
      let attempt = 0;
      const live = () => audio === a && turn === generation && index === which;
      a.onplaying = () => { if (live()) { heard = true; say('playing'); } };
      a.onended = () => { if (live()) { index++; next(); } };
      a.onerror = () => {
        if (!live()) return;
        if (++attempt < formats.length) { a.src = `sound/narration/${tracks[index]}.${formats[attempt]}`; play(a, turn); }
        else { index++; next(); }
      };
      if (o.onTrack) o.onTrack(tracks[index]);
      a.src = `sound/narration/${tracks[index]}.${formats[0]}`;
      say('loading'); play(a, turn);
    }
    next();
  }
  function pause() {
    if (!audio || (state !== 'playing' && state !== 'loading')) return;
    audio.pause(); say('paused');
  }
  function toggle() {
    if (!o.enabled()) { stop(); return; }
    if (state === 'playing' || state === 'loading') pause();
    else if (state === 'paused' && audio) play(audio, generation);
    else start(tracks);
  }
  function setVolume(n) {
    if (!Number.isFinite(n)) return;
    volume = Math.max(0, Math.min(1, n));
    if (gain) gain.gain.value = volume;
    else if (audio) audio.volume = volume;
    try { localStorage.setItem(KEY, String(volume)); } catch { /* private browsing */ }
  }
  return { start, stop, pause, toggle, setVolume, volume: () => volume,
    active: () => state === 'playing' || state === 'loading', current: () => tracks[index] || '', state: () => state };
}
