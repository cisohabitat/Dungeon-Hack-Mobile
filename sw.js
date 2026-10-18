// Minimal offline cache so the game works without a connection once loaded.
const CACHE = 'deepdelve-v66';
const ASSETS = [
  './js/regionart.js',
  './js/puzzles.js', './js/puzzledata.js', './js/puzzleview.js',
  './replay.html', './js/recording.js', './js/replayview.js', './js/replaycontrols.js',
  './js/release.js', './js/savecheck.js',
  './js/bestiaryart.js',
  './img/bestiary/rat.webp', './img/bestiary/bat.webp', './img/bestiary/slime.webp', './img/bestiary/spider.webp',
  './img/bestiary/goblin.webp', './img/bestiary/skeleton.webp', './img/bestiary/zombie.webp', './img/bestiary/orc.webp',
  './img/bestiary/ghoul.webp', './img/bestiary/wraith.webp', './img/bestiary/ogre.webp', './img/bestiary/troll.webp',
  './img/bestiary/minotaur.webp', './img/bestiary/kobold.webp', './img/bestiary/archer.webp', './img/bestiary/basilisk.webp',
  './img/bestiary/rustmaw.webp', './img/bestiary/acolyte.webp', './img/bestiary/moth.webp', './img/bestiary/thornhog.webp',
  './img/bestiary/imp.webp', './img/bestiary/cutpurse.webp', './img/bestiary/lookout.webp', './img/bestiary/hexer.webp',
  './img/bestiary/pikeman.webp', './img/bestiary/hound.webp', './img/bestiary/quillback.webp', './img/bestiary/wyrm.webp',
  './img/bestiary/drowned.webp', './img/bestiary/eyeless.webp', './img/bestiary/drow_warrior.webp', './img/bestiary/drow_mage.webp',
  './img/bestiary/grey_dwarf.webp', './img/bestiary/dwarf_arbalest.webp', './img/bestiary/lizardfolk.webp', './img/bestiary/lizard_shaman.webp',
  './img/bestiary/emberling.webp', './img/bestiary/mimic.webp', './img/bestiary/puffcap.webp', './img/bestiary/shade.webp',
  './img/bestiary/grisk.webp', './img/bestiary/vessra.webp', './img/bestiary/ushgar.webp', './img/bestiary/morrow.webp',
  './img/bestiary/orla.webp', './img/bestiary/gorrum.webp', './img/bestiary/skarrow.webp', './img/bestiary/vaelith.webp',
  './img/bestiary/hissra.webp', './img/bestiary/durgrim.webp',
  './', './index.html', './css/style.css', './manifest.json', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './img/keyart-portrait.webp', './img/keyart-landscape.webp', './sound/index.json',
  './js/package.json', './js/portraits.js', './js/bossart.js', './js/meleeview.js', './js/elementfx.js',
  './img/bosses/lich.webp', './img/bosses/warlord.webp', './img/bosses/heartforged.webp',
  './img/portraits/fighter.webp', './img/portraits/thief.webp', './img/portraits/mage.webp', './img/portraits/cleric.webp', './img/portraits/ranger.webp', './img/portraits/druid.webp',
  './js/narration.js', './js/storyvoice.js', './js/voicelines.js', './sound/narration/catalog.json',
  './sound/narration/prologue.ogg', './sound/narration/prologue.m4a',
  './js/rng.js', './js/data.js', './js/parts.js', './js/painter.js', './js/creatures.js', './js/folk.js', './js/props.js', './js/champions.js', './js/itemart.js', './js/dressing.js', './js/heldart.js', './js/encounters.js', './js/relics.js', './js/rooms.js', './js/looks.js', './js/prelude.js', './js/progress.js', './js/daily.js', './js/walldecor.js', './js/assets.js', './js/dungeon.js', './js/spellfx.js', './js/overlay.js', './js/renderer.js', './js/samples.js', './js/sound.js', './js/music.js', './js/foes.js', './js/bosses.js', './js/trader.js', './js/companion.js', './js/bounty.js', './js/wild.js', './js/elements.js', './js/meet.js', './js/testing.js', './js/savecode.js', './js/saving.js', './js/chronicle.js', './js/powers.js', './js/pacing.js', './js/motion.js', './js/combat.js', './js/items.js', './js/scenes.js', './js/curses.js', './js/fallen.js', './js/paths.js', './js/legends.js', './js/combos.js', './js/lairs.js', './js/threads.js', './js/telemetry.js', './js/game.js', './js/uikit.js', './js/sharecard.js', './js/hall.js', './js/pagesview.js', './js/tips.js', './js/pad.js', './js/access.js', './js/weekly.js', './js/titlescene.js', './js/shopview.js', './js/choices.js', './js/pack.js', './js/mapview.js', './js/endscreen.js', './js/herosheet.js', './js/createextras.js', './js/titlemenu.js', './js/createview.js', './js/ui.js', './js/main.js',
];
async function cacheVoices(c) {
  const manifest = await c.match('./sound/narration/catalog.json');
  const { clips } = await manifest.json();
  const paths = Object.keys(clips).filter(id => id !== 'prologue').flatMap(id => ['ogg', 'm4a'].map(ext => `./sound/narration/${id}.${ext}`));
  // Keep only a few requests in flight on a phone's connection.
  for (let i = 0; i < paths.length; i += 8) await c.addAll(paths.slice(i, i + 8));
}
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(async c => { await c.addAll(ASSETS); await cacheVoices(c); }).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Phone media players ask for parts of a recording, even on their first play.
// Serve those parts from the installed copy instead of downloading it again.
async function recordedVoice(request) {
  const cache = await caches.open(CACHE), cached = await cache.match(request);
  if (!cached) {
    const response = await fetch(request);
    if (response.status === 200 && !response.redirected) cache.put(request, response.clone()).catch(() => {});
    return response;
  }
  const range = request.headers.get('Range');
  if (!range) return cached;
  const bytes = await cached.arrayBuffer(), size = bytes.byteLength;
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  const start = match && match[1] ? Number(match[1]) : match && match[2] ? Math.max(0, size - Number(match[2])) : size;
  const end = match && match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || start > end) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  }
  const headers = new Headers(cached.headers);
  headers.delete('Content-Encoding');
  headers.set('Accept-Ranges', 'bytes'); headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  headers.set('Content-Length', String(end - start + 1));
  return new Response(bytes.slice(start, end + 1), { status: 206, headers });
}
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // the sound pack's sounds are kept as they are heard, but never its masters,
  // nor what its listening page (sound/listen.html) fetches to be tried
  const url = new URL(e.request.url), path = url.pathname;
  // Reports and live statistics keep the server's own privacy/cache policy.
  if (url.origin !== self.location.origin || /^\/api(?:\/|$)/.test(path)) return;
  if (path.startsWith('/sound/masters/') || path.startsWith('/sound/listen') || /\/sound\/listen/.test(e.request.referrer || '')) return;
  if (/\/sound\/narration\/(?:line-[a-f0-9]{8}|prologue)\.(?:ogg|m4a)$/.test(path)) {
    e.respondWith(recordedVoice(e.request)); return;
  }
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
