import { BUILD_NUMBER } from './release.js';

// One quiet title status, outside play. Only phase changes are announced;
// hundreds of completed recording requests must not chatter to a reader.
export function initOffline() {
  const el = document.getElementById('offline-status');
  if (!el) return;
  let voice = 'pending', core = false, polling = 0, failed = false, observed = null;
  const show = text => { el.hidden = false; if (el.textContent !== text) el.textContent = text; };
  const paint = () => {
    el.dataset.core = String(core); el.dataset.voice = voice;
    if (!core) { show('Preparing offline play'); return; }
    if (voice === 'ready') show('Game and voice ready offline');
    else if (!navigator.onLine || voice === 'paused') show('Game ready offline · Voice download paused');
    else show('Game ready offline · Voice downloading');
  };
  if (!('serviceWorker' in navigator)) { show('Offline play unavailable in this browser'); return; }
  const paused = () => { failed = true; show('Offline setup paused · Try again when connected'); };
  const install = () => {
    if (location.protocol !== 'https:' || observed?.installing) return;
    failed = false;
    navigator.serviceWorker.register('sw.js').then(reg => {
      if (reg === observed) return;
      observed = reg;
      const watch = () => {
        const worker = reg.installing;
        if (worker) worker.addEventListener('statechange', () => { if (worker.state === 'redundant' && !core) paused(); });
      };
      reg.addEventListener('updatefound', watch); watch();
    }).catch(paused);
  };
  const ask = () => {
    if (failed || !navigator.serviceWorker.controller) install();
    const worker = navigator.serviceWorker.controller;
    if (worker) worker.postMessage({ type: 'offline-prepare' });
  };
  const startPolling = () => {
    clearInterval(polling);
    polling = window.setInterval(() => { if (!document.hidden && navigator.onLine) ask(); }, 15000);
  };
  navigator.serviceWorker.addEventListener('message', e => {
    const state = e.data;
    if (e.source !== navigator.serviceWorker.controller || state?.type !== 'offline-state'
      || state.build !== BUILD_NUMBER || !['pending', 'downloading', 'paused', 'ready'].includes(state.voice)) return;
    core = true; voice = state.voice; paint();
    if (voice === 'ready') clearInterval(polling);
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    core = false; voice = 'pending'; paint(); startPolling(); ask();
  });
  window.addEventListener('online', () => { paint(); startPolling(); ask(); });
  window.addEventListener('offline', paint);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && voice !== 'ready') ask(); });
  if (navigator.serviceWorker.controller) { paint(); startPolling(); ask(); }
  if (location.protocol === 'https:') {
    paint(); startPolling(); install();
  }
}
