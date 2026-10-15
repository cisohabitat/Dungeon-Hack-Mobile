// This page runs inside its own frame. Its rules, dice and storage are separate
// from the live game; nothing played here is a second win, save or Daily result.
import { replayStorage, verifyReplay } from './recording.js';

const status = document.getElementById('replay-status');
const pause = /** @type {HTMLButtonElement} */ (document.getElementById('replay-pause'));
const speed = /** @type {HTMLSelectElement} */ (document.getElementById('replay-speed'));
let started = false;
window.addEventListener('message', async event => {
  if (started || event.source !== parent || event.origin !== location.origin || event.data?.kind !== 'deepdelve-replay') return;
  started = true;
  try {
    const data = event.data.record;
    const presentation = event.data.presentation || {};
    document.documentElement.style.fontSize = Math.max(14, Math.min(32, Number(presentation.textSize) || 16)) + 'px';
    document.body.classList.toggle('calm', !!presentation.calm);
    Object.defineProperty(window, 'localStorage', { value: replayStorage(data), configurable: true });
    const [{ Game }, { Assets }, { Renderer }] = await Promise.all([import('./game.js'), import('./assets.js'), import('./renderer.js')]);
    Assets.init(); Renderer.init(document.getElementById('replay-view'));
    Renderer.setCalm(!!presentation.calm);
    Game.startReplay(data);
    let index = 0, last = 0, budget = 0, stopped = false, frame = null, previous = data.header.at;
    pause.disabled = false;
    pause.addEventListener('click', () => { stopped = !stopped; pause.textContent = stopped ? 'Resume' : 'Pause'; });
    const draw = () => {
      const G = Game.state(), p = Game.player();
      document.getElementById('replay-hero').textContent = `${p.name} · Floor ${G.depth} · HP ${Math.max(0, p.hp)}/${p.maxHp} · ${Math.floor(G.t / 1000)}s`;
      if (frame) Renderer.render(frame.level, frame.cam, frame.sprites, frame.fx, previous);
    };
    function loop(now) {
      if (!stopped) budget += Math.min(100, last ? now - last : 0) * Number(speed.value);
      last = now;
      try {
        let calls = 0;
        while (!stopped && index < data.events.length && calls++ < 1000) {
          const entry = data.events[index], isClock = entry[0] <= 2 && entry[0] >= 0;
          const wait = isClock ? Math.max(0, Math.min(100, entry[1] - previous)) : 0;
          if (budget < wait) break;
          budget -= wait;
          const state = Game.replayCall(entry);
          if (isClock) previous = entry[1];
          else if (entry[0] === -1) previous = entry[2];
          if (state?.cam) frame = state;
          Game.takeEvents(); index++;
        }
        draw();
        if (index === data.events.length) {
          const result = verifyReplay(Game, data);
          // The last action may itself have ended the run before another view.
          frame = Game.renderState(previous); draw();
          status.textContent = `Replay complete · ${result.status === 'won' ? 'Victory' : 'Fallen'} · Outcome verified`;
          pause.disabled = true; return;
        }
        status.textContent = stopped ? 'Replay paused' : 'Replaying your run';
        requestAnimationFrame(loop);
      } catch (error) { status.textContent = error.message; pause.disabled = true; }
    }
    requestAnimationFrame(loop);
  } catch (error) { status.textContent = error.message || 'This recording could not be played.'; }
});
parent.postMessage({ kind: 'deepdelve-replay-ready' }, location.origin);

document.addEventListener('keydown', event => { if (event.code === 'Escape') parent.postMessage({ kind: 'deepdelve-replay-close' }, location.origin); });
