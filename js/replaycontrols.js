// Local playback opens over the finished run and leaves it in place on close.
export function bindReplay(Game, stopVoice) {
  const dialog = /** @type {HTMLDialogElement} */ (document.getElementById('run-replay'));
  const frame = /** @type {HTMLIFrameElement} */ (document.getElementById('run-replay-frame'));
  const button = /** @type {HTMLButtonElement} */ (document.getElementById('end-replay'));
  let record = null;
  button.addEventListener('click', () => {
    record = Game.recording();
    if (!record) return;
    stopVoice();
    frame.src = 'replay.html';
    dialog.showModal();
    document.getElementById('run-replay-close').focus();
  });
  document.getElementById('run-replay-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { frame.src = 'about:blank'; record = null; button.focus(); });
  window.addEventListener('message', event => {
    if (event.origin === location.origin && event.source === frame.contentWindow && dialog.open && event.data?.kind === 'deepdelve-replay-close') dialog.close();
    if (event.origin === location.origin && event.source === frame.contentWindow && dialog.open && event.data?.kind === 'deepdelve-replay-ready') {
      frame.contentWindow.postMessage({ kind: 'deepdelve-replay', record, presentation: { textSize: parseFloat(getComputedStyle(document.documentElement).fontSize), calm: document.body.classList.contains('calm') } }, location.origin);
    }
  });
}
