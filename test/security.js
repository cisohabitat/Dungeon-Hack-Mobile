'use strict';
// Adversarial inputs at the boundaries, without touching the deployed store.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const { gzipSync } = require('node:zlib');
const { loadGame } = require('./harness');
const { start } = require('./server');

async function main() {
  const { encodeSave, decodeSave, SAVE_BYTES, CODE_BYTES } = await import('../js/savecode.js');
  const { escapeHtml, logHtml } = await import('../js/uikit.js');
  const { checkSave, parseSave } = await import('../js/savecheck.js');
  assert.equal(escapeHtml('<&>"\''), '&lt;&amp;&gt;&quot;&#39;');
  assert.equal(logHtml('Hit (d20 12 + 2) after <b>x</b>'), 'Hit <span class="roll">(d20 12 + 2)</span> after &lt;b&gt;x&lt;/b&gt;');
  const unfinished = ' (d20 '.repeat(200000);
  assert.equal(logHtml(unfinished), unfinished, 'unclosed dice prefixes need only a linear scan');
  const unicode = JSON.stringify({ name: 'A hero’s 雪' });
  assert.equal(await decodeSave(await encodeSave(unicode)), unicode);
  assert.equal(await decodeSave('DD0.' + Buffer.from(unicode).toString('base64')), unicode);
  await assert.rejects(decodeSave(' '.repeat(CODE_BYTES + 1)), /too large/);
  // Construct a hostile gzip directly: the normal exporter also refuses oversize data.
  const expanded = Buffer.alloc(SAVE_BYTES + 1, 120);
  const bomb = 'DD1.' + gzipSync(expanded).toString('base64');
  assert(bomb.length < 30000);
  await assert.rejects(decodeSave(bomb), /too large/);
  await assert.rejects(decodeSave('DD0.' + expanded.toString('base64')), /too large/);

  const { Game, store } = await loadGame();
  Game.newGame({ name: 'A "quoted" hero', cls: 'fighter', seed: 'security-roundtrip', stats: Game.rollStats(),
    opts: { levels: 16, size: 'large', monsters: 'few', treasure: 'normal', traps: false, lockedDoors: false, permadeath: false } });
  // The largest supported floor count/size must fit comfortably, including recording headroom.
  for (let depth = 1; depth < 16; depth++) { Game.level().monsters.length = 0; Game.descend(); }
  const state = JSON.parse(JSON.stringify(Game.state()));
  const json = JSON.stringify(state);
  assert(Buffer.byteLength(json) < SAVE_BYTES / 2, 'maximum dungeon leaves room for a recording');
  assert.equal(checkSave(state), state);
  assert.deepEqual(parseSave(json), state);
  assert.throws(() => parseSave('['.repeat(100000) + ']'.repeat(100000)), /valid dungeon/);
  const escaped = JSON.parse(json); escaped.player.name = '"\\' + '['.repeat(80) + '{,}'.repeat(20);
  assert.equal(parseSave(JSON.stringify(escaped)).player.name, escaped.player.name, 'quoted braces and escaped quotes do not count as nesting');
  const privateRecord = { format: 1, size: 0, events: [], header: { store: { 'deepdelve.hall': 'unrelated-local-history' } } };
  Game.state().recording = privateRecord;
  const code = await Game.saveCode();
  assert.equal(JSON.parse(await decodeSave(code)).recording, undefined, 'exported codes omit local recording memories');
  assert.equal(Game.state().recording, privateRecord, 'exporting preserves the local recording');
  assert.equal(JSON.parse(store.get('deepdelve.save')).recording.header.store['deepdelve.hall'], 'unrelated-local-history');
  assert((await Game.loadCode(code)).ok);
  const recorded = JSON.parse(JSON.stringify(Game.state()));
  recorded.recording = { format: 1, events: [], header: { store: { 'deepdelve.reports': '1' } } };
  assert((await Game.loadCode(await encodeSave(JSON.stringify(recorded)))).ok);
  assert.equal(JSON.parse(store.get('deepdelve.save')).recording, undefined, 'an imported replay context is never persisted');
  Game.save(true);
  const before = store.get('deepdelve.save'), live = Game.state();
  const bad = [
    s => { s.player.steps = '<img src=x>'; },
    s => { s.seed = 'x'.repeat(1025); },
    s => { s.log.push({ m: ' (d20 '.repeat(3000), c: '' }); },
    s => { s.player.stats.dex = '<b>20</b>'; },
    s => { s.player.xp = 1e300; },
    s => { s.levels[s.depth].w = 1e9; },
    s => { s.levels[s.depth].tiles.pop(); },
    s => { s.levels[s.depth].rooms[0].w = 1e9; },
    s => { s.player.cls = '__proto__'; },
    s => { s.player.inv.push({ t: '__proto__', q: 1 }); },
    s => { s.extra = JSON.parse('{"__proto__":{"polluted":true}}'); },
    s => { s.extra = JSON.parse('{"constructor":{"prototype":{"polluted":true}}}'); },
    s => { s.stats.dealt = { toString: 1, valueOf: 1 }; },
    s => { let v = {}; s.extra = v; for (let i = 0; i < 70; i++) { v.next = {}; v = v.next; } },
  ];
  for (const mutate of bad) {
    const altered = JSON.parse(json); mutate(altered);
    const result = await Game.loadCode(await encodeSave(JSON.stringify(altered)));
    assert.equal(result.ok, false, 'malformed saves are refused');
    assert.equal(store.get('deepdelve.save'), before, 'a failed import preserves the saved hero');
    assert.equal(Game.state(), live, 'a failed import preserves the live hero');
  }
  assert.equal({}.polluted, undefined);
  // A malformed local save takes the same validation route, before state is swapped.
  const altered = JSON.parse(json); altered.levels[altered.depth].h = 1e9;
  store.set('deepdelve.save', JSON.stringify(altered));
  assert.equal(Game.load(), false); assert.equal(Game.state(), live);

  const root = path.resolve(__dirname, '..');
  const deployment = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  const headers = deployment.headers.find(h => h.source === '/(.*)').headers;
  const policy = headers.find(h => h.key === 'Content-Security-Policy').value;
  const directives = new Map(policy.split(';').map(s => s.trim().split(/\s+/)).map(([name, ...sources]) => [name, sources]));
  for (const name of ['script-src', 'connect-src', 'base-uri', 'frame-ancestors', 'form-action']) {
    assert.deepEqual(directives.get(name), ["'self'"], `${name} stays restricted to this origin`);
  }
  assert.deepEqual(directives.get('object-src'), ["'none'"]);
  const handlers = {};
  vm.runInNewContext(fs.readFileSync(path.join(root, 'sw.js'), 'utf8'), {
    URL, self: { location: { origin: 'https://game.example' }, addEventListener: (kind, handler) => { handlers[kind] = handler; } },
  });
  for (const url of ['https://game.example/api/stats', 'https://game.example/api/telemetry', 'https://foreign.example/image.png']) {
    handlers.fetch({ request: { method: 'GET', url }, respondWith: () => assert.fail('API or cross-origin request reached the cache handler') });
  }
  const outside = fs.mkdtempSync(path.join(path.dirname(root), path.basename(root) + '-security-'));
  const inside = fs.mkdtempSync(path.join(root, 'security-test-'));
  const link = path.join(inside, 'outside');
  const server = await start(0), port = server.address().port;
  const request = (url, method = 'GET', headers = {}) => new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: url, method, headers }, res => {
      let body = ''; res.on('data', b => { body += b; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject); req.end();
  });
  try {
    fs.writeFileSync(path.join(outside, 'secret.txt'), 'outside-project-fixture');
    fs.symlinkSync(outside, link, 'dir');
    assert.equal((await request('/%E0%A4%A')).status, 400);
    assert.equal((await request('/%00')).status, 403);
    assert.equal((await request('/%2e%2e/' + path.basename(outside) + '/secret.txt')).status, 403);
    assert.equal((await request('/' + path.relative(root, link).split(path.sep).join('/') + '/secret.txt')).status, 403);
    assert.equal((await request('/.git/config')).status, 403);
    assert.equal((await request('/node_modules/typescript/package.json')).status, 403);
    assert.equal((await request('/', 'POST')).status, 405);
    assert.equal((await request('/')).status, 200, 'bad paths do not crash the server');
    assert.equal((await request('/', 'HEAD')).body, '');
    const range = await request('/sound/narration/prologue.ogg', 'GET', { Range: 'bytes=0-3' });
    assert.equal(range.status, 206); assert.equal(Buffer.byteLength(range.body), 4);
  } finally {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(inside, { recursive: true }); fs.rmSync(outside, { recursive: true });
  }
  console.log('security checks complete, 0 failure(s): imports, decompression, markup and local file boundaries');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
