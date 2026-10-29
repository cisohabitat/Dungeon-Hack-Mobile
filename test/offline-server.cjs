'use strict';
// Keep fixture serving out of Playwright's trace-recording event loop. Pre-read
// exact responses through the normal server, like a warm static origin; the
// browser and service worker still fetch/cache every asset over actual HTTP.
const { fork } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const vm = require('node:vm');
const { serve } = require('./server');

function startOfflineServer(options = {}) {
  const child = fork(__filename, [JSON.stringify(options)], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  let sequence = 0, closed = false, closing = false, stderr = '';
  const pending = new Map();
  child.stderr.on('data', data => { stderr = (stderr + data).slice(-16384); });
  const request = (method, value) => new Promise((resolve, reject) => {
    if (closed) { reject(Error('Offline fixture is closed')); return; }
    const id = ++sequence; pending.set(id, { resolve, reject });
    child.send({ id, method, value }, error => {
      if (error) { pending.delete(id); reject(error); }
    });
  });
  return new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      closed = true;
      const error = Error(`Offline fixture exited ${code ?? signal}${stderr ? ': ' + stderr : ''}`);
      for (const p of pending.values()) p.reject(error);
      pending.clear();
      if (!closing) reject(error);
    });
    child.on('message', message => {
      if (message.type === 'fatal') { child.kill(); reject(Error(message.error)); return; }
      if (message.type === 'ready') {
        resolve({
          url: message.url, pid: child.pid,
          stats: () => request('stats'),
          setConnected: value => request('connected', !!value),
          setVoicesBlocked: value => request('voices', !!value),
          async close() {
            if (closed || closing) return;
            closing = true;
            const exited = new Promise((done, failed) => {
              const timer = setTimeout(() => { child.kill('SIGKILL'); failed(Error('Offline fixture did not close')); }, 5000);
              child.once('exit', code => { clearTimeout(timer); code === 0 ? done() : failed(Error(`Offline fixture closed with ${code}`)); });
            });
            await Promise.all([request('close'), exited]);
          },
        });
        return;
      }
      const p = pending.get(message.id);
      if (p) { pending.delete(message.id); message.error ? p.reject(Error(message.error)) : p.resolve(message.result); }
    });
  });
}

async function run(options) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
  const assets = vm.runInNewContext(source + '\nASSETS.slice()', { self: { addEventListener() {} } }, { timeout: 1000 });
  const prepared = new Map(), voiceCounts = new Map(), held = new Set();
  const read = url => new Promise((resolve, reject) => {
    let status, headers;
    const response = {
      writeHead(value, values) { status = value; headers = values; return this; },
      end(body) {
        if (status !== 200) { reject(Error(`Offline fixture asset ${url}: ${status}`)); return; }
        prepared.set(url, { headers, body }); resolve();
      },
    };
    serve({ url, method: 'GET', headers: {} }, response);
  });
  const started = Date.now(); let next = 0;
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (next < assets.length) {
      const url = new URL(assets[next++], 'http://fixture.local/');
      if (url.origin !== 'http://fixture.local') throw Error('Offline fixture requires local assets');
      await read(decodeURIComponent(url.pathname));
    }
  }));
  const prepareMs = Date.now() - started;
  let connected = true, blocked = options.holdVoices === true, rejected = 0;
  const release = () => {
    for (const entry of held) if (!entry.res.destroyed) serve(entry.req, entry.res);
    held.clear();
  };
  const disconnect = () => { for (const entry of held) entry.res.destroy(); held.clear(); };
  const server = http.createServer((req, res) => {
    if (!connected) { rejected++; req.socket.destroy(); return; }
    if (options.failPath && req.url === options.failPath) { res.writeHead(503).end('Deliberate fixture failure'); return; }
    if (/^\/sound\/narration\/.*\.(?:ogg|m4a)$/.test(req.url)) {
      voiceCounts.set(req.url, (voiceCounts.get(req.url) || 0) + 1);
      if (blocked) { const entry = { req, res }; held.add(entry); res.on('close', () => held.delete(entry)); return; }
    }
    let url; try { url = decodeURIComponent(req.url.split('?')[0]); } catch { serve(req, res); return; }
    const cached = prepared.get(url);
    if (cached && ['GET', 'HEAD'].includes(req.method) && !req.headers.range) {
      res.writeHead(200, cached.headers); res.end(req.method === 'HEAD' ? undefined : cached.body);
    } else serve(req, res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  process.on('message', message => {
    try {
      let result;
      if (message.method === 'stats') result = { held: held.size, rejected, voiceCounts: [...voiceCounts], assets: assets.length, prepared: prepared.size, prepareMs };
      else if (message.method === 'connected') { connected = message.value === true; if (!connected) disconnect(); }
      else if (message.method === 'voices') { blocked = message.value === true; if (!blocked) release(); }
      else if (message.method === 'close') {
        disconnect(); server.closeAllConnections();
        server.close(() => process.send({ id: message.id, result: null }, () => process.disconnect())); return;
      } else throw Error('Unknown offline fixture command');
      process.send({ id: message.id, result });
    } catch (error) { process.send({ id: message.id, error: error.message }); }
  });
  process.send({ type: 'ready', url: `http://127.0.0.1:${server.address().port}` });
}

if (require.main === module && process.send) run(JSON.parse(process.argv[2] || '{}')).catch(error => {
  process.send({ type: 'fatal', error: error.stack }, () => process.disconnect()); process.exitCode = 1;
});
module.exports = { startOfflineServer };
