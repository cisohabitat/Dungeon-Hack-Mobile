'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { startOfflineServer } = require('./offline-server.cjs');
const root = path.resolve(__dirname, '..');
async function until(check) {
  const end = Date.now() + 2000;
  while (!(await check())) { if (Date.now() > end) throw Error('Fixture state did not settle'); await new Promise(r => setTimeout(r, 10)); }
}
(async () => {
  const server = await startOfflineServer({ holdVoices: true });
  try {
    assert.notEqual(server.pid, process.pid, 'HTTP serving must be outside the tracing worker');
    const stats = await server.stats();
    assert.ok(stats.assets > 1800); assert.equal(stats.prepared, stats.assets, 'prepare every declared asset');
    const csp = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'))).headers.find(h => h.source === '/(.*)').headers.find(h => h.key === 'Content-Security-Policy').value;
    for (const file of ['js/release.js', 'img/bosses/heartforged.webp', 'sound/narration/catalog.json']) {
      const r = await fetch(server.url + '/' + file);
      assert.equal(r.status, 200); assert.equal(r.headers.get('content-security-policy'), csp);
      assert.equal(r.headers.get('cache-control'), 'no-store');
      assert.deepEqual(Buffer.from(await r.arrayBuffer()), fs.readFileSync(path.join(root, file)), file + ' must retain exact bytes');
    }
    const head = await fetch(server.url + '/img/bosses/heartforged.webp', { method: 'HEAD' });
    assert.equal(head.status, 200); assert.equal((await head.arrayBuffer()).byteLength, 0);
    assert.equal(Number(head.headers.get('content-length')), fs.statSync(path.join(root, 'img/bosses/heartforged.webp')).size);
    assert.equal((await fetch(server.url + '/..%2foutside')).status, 403);
    assert.equal((await fetch(server.url + '/js/release.js', { method: 'POST' })).status, 405);
    assert.equal((await fetch(server.url + '/missing-offline-fixture')).status, 404);
    const url = '/sound/narration/prologue.m4a';
    const held = fetch(server.url + url); await until(async () => (await server.stats()).held === 1);
    await server.setVoicesBlocked(false); const voice = await held;
    assert.equal(voice.status, 200); assert.deepEqual(Buffer.from(await voice.arrayBuffer()), fs.readFileSync(path.join(root, url)));
    const range = await fetch(server.url + url, { headers: { Range: 'bytes=0-9' } });
    assert.equal(range.status, 206); assert.equal((await range.arrayBuffer()).byteLength, 10);
    await server.setVoicesBlocked(true);
    const interrupted = fetch(server.url + url).then(() => false, () => true);
    await until(async () => (await server.stats()).held === 1);
    await server.setConnected(false); assert.equal(await interrupted, true);
    await assert.rejects(fetch(server.url + '/'));
    assert.ok((await server.stats()).rejected > 0, 'disconnect the actual origin, not a browser route');
    await server.setConnected(true); assert.equal((await fetch(server.url + '/')).status, 200);
  } finally { await server.close(); }
  await server.close(); await assert.rejects(fetch(server.url + '/'));
  const broken = await startOfflineServer({ failPath: '/img/bosses/lich.webp' });
  try { assert.equal((await fetch(broken.url + '/img/bosses/lich.webp')).status, 503); }
  finally { await broken.close(); }
  console.log('offline fixture checks complete: exact bytes/headers, full asset snapshot, separate process, voice hold/resume, real disconnect, range, path/method guards and cleanup');
})().catch(error => { console.error(error); process.exitCode = 1; });
