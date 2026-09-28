// Minimal offline cache so the game works without a connection once loaded.
const CACHE = 'deepdelve-v16';
const ASSETS = [
  './', './index.html', './css/style.css', './manifest.json', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
  './js/package.json',
  './js/rng.js', './js/data.js', './js/creatures.js', './js/itemart.js', './js/dressing.js', './js/heldart.js', './js/encounters.js', './js/relics.js', './js/progress.js', './js/daily.js', './js/assets.js', './js/dungeon.js', './js/renderer.js', './js/sound.js', './js/music.js', './js/foes.js', './js/trader.js', './js/companion.js', './js/savecode.js', './js/game.js', './js/uikit.js', './js/sharecard.js', './js/hall.js', './js/ui.js', './js/main.js',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(res => {
      // only a good answer is kept: a server's error page saved over the game would be all there was offline
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {}); }
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
