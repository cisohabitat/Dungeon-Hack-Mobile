'use strict';
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');
const source = fs.readFileSync('sw.js', 'utf8');
const current = source.match(/const CACHE = '([^']+)'/)[1];
const build = Number(fs.readFileSync('js/release.js', 'utf8').match(/BUILD_NUMBER = (\d+)/)[1]);
const origin = 'https://offline.example/';
const absolute = value => new URL(typeof value === 'string' ? value : value.url, origin).href;
const clips = { prologue: {}, 'line-00000001': {}, 'line-00000002': {} };
const voices = Object.keys(clips).flatMap(id => ['ogg', 'm4a'].map(ext => absolute(`sound/narration/${id}.${ext}`)));
function harness(storage = new Map()) {
  const handlers = {}, messages = [], requested = [], matched = [];
  let held = null, heldWrites = null, failing = '', skipped = 0, claimed = 0;
  const response = url => new Response(url.endsWith('/catalog.json') ? JSON.stringify({clips}) : url.endsWith('/js/release.js') ? `export const BUILD_NUMBER = ${build};` : url.endsWith('/prologue.m4a') ? '0123456789' : url);
  const fetcher = async input => {
    const url = absolute(input); requested.push(url);
    if (url === failing) throw new Error('Deliberate connection failure');
    if (held && voices.includes(url)) await held;
    return response(url);
  };
  const caches = {
    keys: async () => [...storage.keys()], delete: async name => storage.delete(name),
    open: async name => {
      if (!storage.has(name)) storage.set(name, new Map());
      const map = storage.get(name);
      return {
        match: async input => {matched.push(absolute(input));return map.get(absolute(input))?.clone();},
        keys: async () => [...map.keys()].map(url => ({url})),
        put: async (input, res) => {if (heldWrites) await heldWrites; map.set(absolute(input), res.clone());},
        addAll: async paths => {for (const p of paths) map.set(absolute(p), await fetcher(p));},
      };
    },
  };
  vm.runInNewContext(source, {URL, Response, Headers, AbortController, setTimeout, clearTimeout, fetch: fetcher, caches,
    self: { location: {origin: new URL(origin).origin, href: origin+'sw.js'}, addEventListener: (name, fn) => {handlers[name] = fn;},
      skipWaiting: async () => {skipped++;}, clients: {claim: async () => {claimed++;}, matchAll: async () => [{postMessage: s => messages.push(s)}]} },
  });
  const event = async name => {let job; handlers[name]({waitUntil: promise => {job = promise;}}); await job;};
  const prepare = () => {let job; handlers.message({data:{type:'offline-prepare'},source:{id:'own-client'},waitUntil:p=>{job=p;}}); return job;};
  const resource = (path, mode) => {
    let response; const jobs = [];
    handlers.fetch({ request: { url: absolute(path), method: 'GET', mode, headers: new Headers() },
      respondWith: p => {response=p;}, waitUntil: p => jobs.push(p) });
    return { response, finished: Promise.all(jobs) };
  };
  return {storage,caches,messages,requested,matched,event,prepare,handlers,
    resource,
    hold() {let release; held=new Promise(resolve=>{release=resolve;});return()=>{held=null;release();};},
    holdWrites() {let release; heldWrites=new Promise(resolve=>{release=resolve;});return()=>{heldWrites=null;release();};},
    fail(url) {failing=url;}, get skipped(){return skipped;},get claimed(){return claimed;},
  };
}
async function main() {
  const h = harness(), release = h.hold();
  await h.event('install'); await h.event('activate');
  assert.equal(h.skipped,1);assert.equal(h.claimed,1);
  assert.equal(h.requested.some(url=>voices.includes(url)),false,'core activation must never wait for audio');
  const job = h.prepare();
  await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(h.messages.at(-1).voice,'downloading');assert.equal(h.messages.at(-1).build,build);
  assert.equal(h.matched.some(url=>voices.includes(url)),false,'voice discovery reads one index rather than scanning the painted cache per clip');
  assert.equal(await (await h.caches.open(current)).match('./sound/narration/offline-ready'),undefined);
  release();await job;
  assert.equal(h.messages.at(-1).voice,'ready');assert.equal(h.messages.at(-1).done,voices.length);
  const restart = harness(h.storage);await restart.prepare();
  assert.equal(restart.messages.at(-1).voice,'ready');assert.equal(restart.requested.length,0,'a restarted worker reuses complete recordings');
  const partial=harness();await partial.event('install');partial.fail(voices[2]);await partial.prepare();
  assert.equal(partial.messages.at(-1).voice,'paused');
  const firstRequests=partial.requested.filter(url=>voices.includes(url)).length;
  partial.fail('');await partial.prepare();
  assert.equal(partial.messages.at(-1).voice,'ready');
  const secondRequests=partial.requested.filter(url=>voices.includes(url)).length-firstRequests;
  assert.ok(secondRequests>0&&secondRequests<voices.length,'retry downloads only missing files');
  const old='deepdelve-v1';const fresh=harness();
  await (await fresh.caches.open(old)).put('/sound/narration/prologue.m4a',new Response('0123456789'));
  await (await fresh.caches.open('another-app')).put('/keep',new Response('keep'));
  await fresh.event('install');await fresh.event('activate');
  assert.ok(fresh.storage.has(old),'activation keeps prior recordings until new voice is ready');
  let answer;fresh.handlers.fetch({request:{url:absolute('/sound/narration/prologue.m4a'),method:'GET',headers:new Headers({Range:'bytes=2-4'})},respondWith:p=>{answer=p;}});
  const range=await answer;assert.equal(range.status,206);assert.equal(await range.text(),'234');
  await fresh.prepare();assert.equal(fresh.storage.has(old),false);assert.equal(fresh.storage.has('another-app'),true);
  let accepted=false;fresh.handlers.message({data:{type:'offline-prepare',url:'https://foreign.example'},source:null,waitUntil:()=>{accepted=true;}});
  assert.equal(accepted,false,'non-client messages cannot schedule downloads');
  const broken=harness();await (await broken.caches.open(old)).put('/keep',new Response('keep'));
  broken.fail(absolute('./js/game.js'));await assert.rejects(broken.event('install'));
  assert.equal(broken.skipped,0);assert.equal(broken.storage.has(old),true,'failed core installation preserves the previous cache');
  const installed=harness();await installed.event('install');
  for (const path of ['/js/main.js','/css/style.css','/manifest.json']) {
    installed.fail(absolute(path)); const count=installed.requested.length;
    const event=installed.resource(path);assert.equal(await (await event.response).text(),absolute(path));await event.finished;
    assert.equal(installed.requested.length,count,'installed core must not probe or mix in another server build');
  }
  for (const path of ['/?resume=1','/index.html?resume=1']) {
    installed.fail(absolute(path));const event=installed.resource(path,'navigate');
    assert.equal(await (await event.response).text(),origin,'root aliases use the installed shell');await event.finished;
  }
  const cold=harness();await (await cold.caches.open(old)).put('/js/main.js',new Response('old build'));
  cold.fail(absolute('/js/main.js'));
  const missing=cold.resource('/js/main.js');await assert.rejects(missing.response);await missing.finished;
  const denied=harness();denied.caches.open=async()=>{throw Error('Storage unavailable');};
  const online=denied.resource('/js/main.js');assert.equal(await(await online.response).text(),absolute('/js/main.js'));await online.finished;
  const streaming=harness(), finishWrite=streaming.holdWrites();
  const download=streaming.resource('/sound/new-effect.ogg');
  assert.equal(await (await download.response).text(),absolute('/sound/new-effect.ogg'),'optional delivery does not wait for cache storage');
  let finished=false;download.finished.then(()=>{finished=true;});
  await new Promise(resolve=>setTimeout(resolve,0));assert.equal(finished,false,'fetch lifetime includes the pending cache write');
  finishWrite();await download.finished;
  assert.equal(await (await(await streaming.caches.open(current)).match('/sound/new-effect.ogg')).text(),absolute('/sound/new-effect.ogg'));
  console.log('offline lifecycle checks complete, 0 failure(s): early activation, resumable voice, cache isolation and ranges');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
