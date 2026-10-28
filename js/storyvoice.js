// One storyteller, whichever screen is open. Discoveries wait for quiet;
// reading a page never lends its voice to a fight when the Journal closes.
import { makeNarration } from './narration.js';
import { BACKGROUNDS, JOURNAL, THEMES, PROLOGUE } from './data.js';
import { RELICS } from './relics.js';
import { voiceId, backgroundText, pageText, relicText, endingSpeech } from './voicelines.js';

/** @param {any} K */
export function makeStoryVoice(K) {
  const KEY = 'deepdelve.narration';
  let enabled = true, context = '', title = '', labels = new Map();
  try { enabled = localStorage.getItem(KEY) !== 'off'; } catch { /* private browsing */ }
  const $ = s => /** @type {any} */ (document.querySelector(s));
  const $$ = s => Array.from(document.querySelectorAll(s)).map(e => /** @type {any} */ (e));
  const core = makeNarration({ enabled: () => enabled && K.soundOn(), output: () => K.output(),
    onTrack(id) { const caption = $('#discovery-voice-caption'); if (caption) caption.textContent = labels.get(id) || title; },
    onState(state) {
      for (const box of $$('[data-voice-context]')) {
        const here = box.dataset.voiceContext === context;
        box.hidden = !here || state === 'idle' || state === 'unavailable' || (context === 'discovery' && state === 'finished');
      }
      for (const b of $$('[data-voice-toggle]')) {
        const action = state === 'loading' || state === 'playing' ? 'Pause' : state === 'paused' ? 'Resume' : 'Replay';
        b.textContent = b.hasAttribute('data-voice-compact') ? action : action + ' narration';
        b.setAttribute('aria-label', action + ' narration');
      }
      for (const b of $$('[data-voice-page]')) {
        const i = Number(b.dataset.voicePage), id = voiceId(pageText(i));
        b.textContent = id === core.current() && core.active() ? 'Pause' : id === core.current() && state === 'paused' ? 'Resume' : 'Listen';
        if (JOURNAL[i]) b.setAttribute('aria-label', b.textContent + ': ' + JOURNAL[i].title);
      }
      if ((state === 'playing' || state === 'loading') && context !== 'discovery') K.quietTitle();
      else if (state !== 'idle' && !core.active()) K.titleMusic();
    },
  });
  function play(ctx, readings, label = '') {
    core.stop(); context = ctx; title = label;
    if (ctx !== 'discovery') discovery = null;
    labels = new Map(readings.map(r => [r.id, r.text]));
    core.start(readings.map(r => r.id));
    for (const input of $$('[data-voice-volume]')) input.value = String(Math.round(core.volume() * 100));
  }
  const reading = text => ({ id: voiceId(text), text });
  function prologue(bg) {
    const readings = [{ id: 'prologue', text: PROLOGUE.join(' ') }];
    if (BACKGROUNDS[bg]) readings.push(reading(backgroundText(bg)));
    play('prologue', readings, 'Karrathal');
  }
  function page(i) {
    if (!Number.isInteger(i) || !JOURNAL[i]) return;
    const track = reading(pageText(i));
    if (core.current() === track.id && (context === 'journal' || context === 'hall')) core.toggle();
    else play(K.screen() === 'screen-hall' ? 'hall' : 'journal', [track], JOURNAL[i].title);
  }
  function journal() {
    const got = K.game.state() && K.game.journal();
    if (got && got.length) page(Number(got[got.length - 1].i));
  }
  function ending(G, lines) { play('end', endingSpeech(lines, G).map(reading), 'The end of the delve'); }
  function stop() { core.stop(); context = ''; discovery = null; }
  function setEnabled(on) {
    enabled = !!on;
    try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch { /* private browsing */ }
    if (!enabled) stop();
    return enabled;
  }
  function bind() {
    document.addEventListener('click', e => {
      const target = /** @type {Element} */ (e.target);
      const button = /** @type {HTMLElement|null} */ (target.closest('[data-voice-page], [data-voice-toggle], [data-voice-stop], [data-voice-background]'));
      if (!button) return;
      K.unlock();
      if (button.hasAttribute('data-voice-page')) page(Number(button.dataset.voicePage));
      else if (button.hasAttribute('data-voice-stop')) { pending = []; discovery = null; stop(); K.titleMusic(); }
      else if (button.hasAttribute('data-voice-background')) {
        const bg = K.background(); if (BACKGROUNDS[bg]) play('prologue', [reading(backgroundText(bg))], BACKGROUNDS[bg].name);
      } else core.toggle();
    });
    for (const input of $$('[data-voice-volume]')) {
      input.value = String(Math.round(core.volume() * 100));
      input.addEventListener('input', () => {
        core.setVolume(Number(input.value) / 100);
        for (const other of $$('[data-voice-volume]')) other.value = input.value;
      });
    }
    document.addEventListener('visibilitychange', () => { if (document.hidden) core.pause(); });
    window.addEventListener('pagehide', stop);
  }
  let run = null, themes = new Set(), relics = new Set(), pending = [], discovery = null, checkAt = 0;
  function scan() {
    const G = K.game.state();
    if (!G || G.status !== 'playing') return;
    if (G !== run) {
      run = G; pending = []; discovery = null;
      themes = new Set(G.t > 0 ? Object.values(G.levels).map(l => l.theme) : []);
      relics = new Set(G.relics ? G.relics.found : []);
    }
    const theme = K.game.level().theme;
    if (!themes.has(theme) && THEMES[theme]) { themes.add(theme); pending.push({ ...reading(THEMES[theme].flavor), title: THEMES[theme].name }); }
    for (const id of (G.relics && G.relics.found) || []) if (!relics.has(id) && RELICS[id]) {
      relics.add(id); pending.push({ ...reading(relicText(id)), title: RELICS[id].name });
    }
    // A bag of old finds imported from elsewhere is never a long reading at once.
    pending = pending.slice(-6);
  }
  function tick(now) {
    if (!enabled || !K.soundOn() || document.hidden) return;
    const G = K.game.state();
    if (!G || G.status !== 'playing' || K.screen() !== 'screen-game') return;
    if (now < checkAt || (!pending.length && !discovery)) return;
    checkAt = now + 150;
    // A tutorial gets the first word too: discovery controls otherwise cover
    // the tip where it rises above the log on an upright phone.
    if (K.overlay() || K.game.preludeOn() || $('#tip')?.classList.contains('show')) {
      if (context === 'discovery') { if (core.active() && discovery) pending.unshift(discovery); stop(); discovery = null; }
      return;
    }
    // A warning anywhere on the floor gets the first word, including an arrow
    // still beyond the five-step check used for resting.
    const unsafe = K.game.enemiesNear() || K.game.level().monsters.some(m => m.windup || m.volley);
    if (unsafe) {
      if (context === 'discovery') { if (core.active() && discovery) pending.unshift(discovery); stop(); discovery = null; }
      return;
    }
    if (context === 'discovery' && (core.state() === 'finished' || core.state() === 'unavailable')) { discovery = null; context = ''; }
    if (!core.active() && core.state() !== 'paused' && pending.length) {
      discovery = pending.shift(); play('discovery', [discovery], discovery.title);
    }
  }
  return { prologue, page, journal, ending, stop, bind, scan, tick, setEnabled,
    enabled: () => enabled, active: () => core.active(), pause: () => core.pause(),
    leaveJournal: () => { if (context === 'journal') stop(); },
  };
}
