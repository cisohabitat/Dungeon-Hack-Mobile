// Minimal offline cache so the game works without a connection once loaded.
const CACHE = 'deepdelve-v25';
const ASSETS = [
  './', './index.html', './css/style.css', './manifest.json', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
  './js/package.json',
  './js/rng.js', './js/data.js', './js/creatures.js', './js/itemart.js', './js/dressing.js', './js/heldart.js', './js/encounters.js', './js/relics.js', './js/rooms.js', './js/looks.js', './js/prelude.js', './js/progress.js', './js/daily.js', './js/assets.js', './js/dungeon.js', './js/renderer.js', './js/sound.js', './js/music.js', './js/foes.js', './js/trader.js', './js/companion.js', './js/bounty.js', './js/wild.js', './js/elements.js', './js/meet.js', './js/testing.js', './js/savecode.js', './js/saving.js', './js/chronicle.js', './js/powers.js', './js/pacing.js', './js/motion.js', './js/combat.js', './js/items.js', './js/scenes.js', './js/game.js', './js/uikit.js', './js/sharecard.js', './js/hall.js', './js/ui.js', './js/main.js',
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
      // only a good answer is kept: a server's error page saved over the game
      // would be all there was offline, and a redirected one (the host sends
      // /index.html on to /) is refused by the browser as a page
      if (res.ok && !res.redirected) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {}); }
      return res;
    // offline, a page asked for by any address (a query, /index.html) is the game's own root
    }).catch(() => caches.match(e.request).then(r => (r && !r.redirected ? r : e.request.mode === 'navigate' ? caches.match('./') : r)))
  );
});
