// A recorded reading of the valley's story, before the first stair. The
// recording is optional: a missing file leaves the written story and the
// way into the dungeon just as they were.

/** @param {{enabled: () => boolean, onState: (state: string) => void, makeAudio?: () => HTMLAudioElement, output?: () => {ctx: AudioContext, master: AudioNode}|null}} o */
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
  const say = s => { state = s; o.onState(s); };
  function stop() {
    generation++;
    if (audio) {
      audio.onplaying = audio.onended = audio.onerror = null;
      audio.pause(); audio.removeAttribute('src'); audio.load(); audio = null;
    }
    if (source) { source.disconnect(); source = null; }
    if (gain) { gain.disconnect(); gain = null; }
    say('idle');
  }
  function play(a, turn) {
    const p = a.play();
    if (p && p.catch) p.catch(e => {
      if (turn !== generation || audio !== a) return;
      // A browser may need a second tap before speaking. A missing recording
      // is dealt with by the media error, which also tries the other format.
      if (e.name === 'NotAllowedError') say('paused');
    });
  }
  function start() {
    stop();
    if (!o.enabled()) return;
    const a = o.makeAudio ? o.makeAudio() : new Audio();
    audio = a;
    const turn = generation;
    const formats = a.canPlayType('audio/mp4; codecs="mp4a.40.2"') ? ['m4a', 'ogg'] : ['ogg', 'm4a'];
    let attempt = 0;
    a.volume = volume; a.preload = 'auto';
    // iPhones leave an element's volume to the hardware buttons. Give the
    // voice its own gain on the game's master so its slider works there too.
    const out = o.output && o.output();
    if (out) {
      source = out.ctx.createMediaElementSource(a); gain = out.ctx.createGain();
      gain.gain.value = volume; a.volume = 1;
      source.connect(gain); gain.connect(out.master);
    }
    a.onplaying = () => { if (audio === a && turn === generation) say('playing'); };
    a.onended = () => { if (audio === a && turn === generation) say('finished'); };
    a.onerror = () => {
      if (audio !== a || turn !== generation) return;
      if (++attempt < formats.length) {
        a.src = `sound/narration/prologue.${formats[attempt]}`;
        play(a, turn);
      } else { stop(); say('unavailable'); }
    };
    a.src = `sound/narration/prologue.${formats[0]}`;
    say('loading'); play(a, turn);
  }
  function pause() {
    if (!audio || (state !== 'playing' && state !== 'loading')) return;
    audio.pause(); say('paused');
  }
  function toggle() {
    if (!o.enabled()) { stop(); return; }
    if (state === 'playing' || state === 'loading') pause();
    else if (state === 'paused' && audio) play(audio, generation);
    else start();
  }
  function setVolume(n) {
    if (!Number.isFinite(n)) return;
    volume = Math.max(0, Math.min(1, n));
    if (gain) gain.gain.value = volume;
    else if (audio) audio.volume = volume;
    try { localStorage.setItem(KEY, String(volume)); } catch { /* private browsing */ }
  }
  return { start, stop, pause, toggle, setVolume, volume: () => volume };
}
