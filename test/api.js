'use strict';
// Checks for the telemetry functions in api/: what they keep, what they refuse,
// and that with no store set up they answer at once and keep nothing.
const path = require('path');
let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.error('FAIL', msg); } };

function call(handler, method, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const res = { statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(b) { resolve({ status: this.statusCode, body: b, headers: this.headers }); } };
    Promise.resolve(handler({ method, body, headers }, res)).catch(reject);
  });
}
const fresh = env => {
  for (const k of ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN']) delete process.env[k];
  Object.assign(process.env, env);
  for (const f of ['_store', 'telemetry', 'stats']) delete require.cache[require.resolve(path.join(__dirname, '../api', f))];
  return { tel: require('../api/telemetry'), stats: require('../api/stats') };
};

async function main() {
  const run = { v: 1, kind: 'run', cls: 'fighter', path: 'knight', diff: 'normal', levels: 8, size: 'medium', outcome: 'win', depth: 8, level: 9,
    cause: '', minutes: 41, fps: [900, 30, 2, 0], tips: 3, combos: ['conduction', 'shield_wall', '<b>x</b>'], legend: 'bastion', pages: 8, pagesOf: 8, ending: 'quench', seed: 'abc', build: 'deepdelve-v26', device: { w: 393, h: 851, dpr: 2.75, cores: 8, mem: 4, touch: true, family: 'chrome' },
    name: 'Sir Somebody', email: 'x@y.z' };

  // what is kept: the fields the game sends, cut to size; anything else dropped
  const { tel, stats } = fresh({});
  const c = tel.clean(run);
  check(c && c.kind === 'run' && c.cls === 'fighter' && c.outcome === 'win' && c.levels === 8, 'a run report is kept');
  check(!('name' in c) && !('email' in c) && !JSON.stringify(c).includes('Somebody'), 'a field the game does not send is dropped');
  check(tel.clean({ ...run, outcome: 'cheated' }).outcome === 'quit', 'an outcome it does not know is read as a quit');
  check(tel.clean({ ...run, levels: 9999 }).levels === 32, 'numbers are held to their range');
  // the counts are keyed by these, so only the game's own ids will do: anything else is nothing
  check(tel.clean({ ...run, cls: '<script>' }).cls === '' && tel.clean({ ...run, cls: 'orc' }).cls === '' && tel.clean({ ...run, path: 'godking' }).path === '' && tel.clean({ ...run, diff: 'brutal' }).diff === 'normal' && tel.clean({ ...run, size: 'vast' }).size === 'medium', 'a class, path, difficulty or size the game does not have is not kept');
  check(c.combos.length === 2 && c.combos[0] === 'conduction' && c.combos[1] === 'shield_wall' && c.legend === 'bastion' && tel.clean({ ...run, legend: 'excalibur' }).legend === '', 'the combinations and the legend are kept only as the game names them');
  check(tel.clean({ ...run, combos: ['conduction', 'conduction', 'conduction'] }).combos.length === 1, 'a combination is counted once a run');
  check(c.ending === 'quench' && tel.clean({ ...run, ending: 'bribe' }).ending === '' && tel.clean({ ...run, outcome: 'death' }).ending === '', 'an ending: one of the three, and only for a win');
  check(c.pages === 8 && c.pagesOf === 8 && tel.clean({ ...run, pages: 99, pagesOf: 6 }).pages === 6 && tel.clean({ ...run, pages: 'x' }).pages === 0, 'pages found: a number, never more than the delve held');
  const known = require('../api/_ids').combos;
  check(tel.clean({ ...run, combos: 'conduction' }).combos.length === 0 && tel.clean({ ...run, combos: Array(99).fill('a') }).combos.length === 0 && tel.clean({ ...run, combos: known }).combos.length === Math.min(40, known.length), 'combinations: a list of the game\'s own, cut to size');
  const cr = tel.clean({ kind: 'crash', msg: 'x'.repeat(900), stack: 'y'.repeat(9000), seed: 's', depth: 3, save: 'abcd1234' });
  check(cr.msg.length === 300 && cr.stack.length === 2000 && cr.save === 'abcd1234', 'a crash report is kept, cut to size');
  check(tel.clean({ kind: 'other' }) === null, 'an unknown kind is refused');
  for (const value of [null, [], {}, { valueOf: 1, toString: 1 }, 'not a number']) {
    const bad = tel.clean({ ...run, v: value, minutes: value, device: { dpr: value, mem: value } });
    check(bad.v === 0 && bad.minutes === 0 && bad.device.dpr === 0 && bad.device.mem === 0, 'objects and invalid numeric fields cannot throw during cleaning');
  }
  const badCrash = tel.clean({ kind: 'crash', msg: { toString: 1 }, where: [], stack: { valueOf: 1 } });
  check(badCrash.msg === '' && badCrash.where === '' && badCrash.stack === '', 'crash text is accepted only as strings');
  check(tel.clean({ ...run, device: { dpr: -3, mem: -4 } }).device.dpr === 0, 'negative device values are clamped');

  // with no store: answered at once, nothing sent anywhere
  let fetched = 0;
  global.fetch = async () => { fetched++; return { ok: true, json: async () => [] }; };
  check((await call(tel, 'POST', JSON.stringify(run))).status === 204, 'no store: 204');
  check((await call(tel, 'GET')).status === 405, 'only POST');
  check((await call(tel, 'POST', '{not json')).status === 400, 'bad JSON: 400');
  check((await call(tel, 'POST', 'x'.repeat(7000))).status === 400, 'too long: 400');
  check((await call(tel, 'POST', { kind: 'nope' })).status === 400, 'unknown kind: 400');
  check((await call(tel, 'POST', { ...run, cls: 'orc' })).status === 400, 'a run with no class of the game\'s: 400');
  check((await call(tel, 'POST', { ...run, cause: 'x'.repeat(7000) })).status === 400, 'a parsed body too long: 400');
  check((await call(tel, 'POST', { ...run, cause: '界'.repeat(2100) })).status === 400, 'the body limit counts UTF-8 bytes, not characters');
  check((await call(tel, 'POST', run, { origin: 'https://attacker.invalid', host: 'game.example' })).status === 403, 'a cross-origin beacon is rejected');
  check((await call(tel, 'POST', run, { 'sec-fetch-site': 'cross-site' })).status === 403, 'cross-site fetch metadata is rejected');
  check((await call(tel, 'POST', run, { origin: 'https://game.example', host: 'game.example', 'sec-fetch-site': 'same-origin' })).status === 204, 'a normal same-origin report is accepted');
  const streamed = async chunks => {
    const { EventEmitter } = require('node:events');
    const req = new EventEmitter(); req.method = 'POST'; req.headers = {};
    let done;
    const answer = new Promise(resolve => { done = resolve; });
    const res = { statusCode: 0, setHeader() {}, end() { done(this.statusCode); } };
    const handled = tel(req, res);
    for (const chunk of chunks) req.emit('data', chunk);
    req.emit('end'); await handled; return answer;
  };
  const utf8 = Buffer.from(JSON.stringify({ ...run, cause: '雪' }));
  const split = utf8.indexOf(Buffer.from('雪')) + 1;
  check(await streamed([utf8.subarray(0, split), utf8.subarray(split)]) === 204, 'streamed JSON preserves a UTF-8 character split across chunks');
  check(await streamed([Buffer.alloc(6001, 120), Buffer.alloc(6001, 120)]) === 400, 'oversize streamed data is refused and later chunks are discarded');
  check(fetched === 0, 'no store: nothing fetched');
  check(JSON.parse((await call(stats, 'GET')).body).ready === false, 'no store: stats says so');
  check((await call(stats, 'POST')).status === 405, 'stats accepts GET only');

  // with a store: one pipeline, counted by delve, difficulty and class
  const sent = [];
  const live = fresh({ KV_REST_API_URL: 'https://store.example/', KV_REST_API_TOKEN: 't' });
  global.fetch = async (url, o) => { sent.push({ url, body: JSON.parse(o.body), auth: o.headers.Authorization, redirect: o.redirect, signal: o.signal }); return { ok: true, json: async () => JSON.parse(o.body).map(c => ({ result: c[0] === 'INCR' || c[0] === 'EXPIRE' ? 1 : ['8|normal|fighter', '3'] })) }; };
  check((await call(live.tel, 'POST', JSON.stringify(run))).status === 204, 'store: 204');
  // the first request asks how many this address has sent this minute; the second writes
  check(sent.length === 2 && sent[0].body[0][0] === 'INCR' && /^dd:rate:/.test(sent[0].body[0][1]) && sent[0].body[1][0] === 'EXPIRE', 'store: the address\'s minute is counted first');
  const cmds = sent[1] && sent[1].body;
  check(sent[1].url === 'https://store.example/pipeline' && sent[1].auth === 'Bearer t', 'store: one pipeline request for the report, with the token');
  check(sent[1].redirect === 'error' && sent[1].signal instanceof AbortSignal, 'store requests refuse redirects and have a deadline');
  check(cmds && cmds.some(x => x[0] === 'HINCRBY' && x[1] === 'dd:count:runs' && x[2] === '8|normal|fighter'), 'store: the run is counted');
  check(cmds && cmds.some(x => x[1] === 'dd:count:wins'), 'store: the win is counted');
  check(cmds && cmds.some(x => x[1] === 'dd:count:combowins' && x[2] === '8|normal|fighter') && cmds.some(x => x[1] === 'dd:count:combos' && x[2] === 'conduction'), 'store: a win with a combination, and each combination, are counted');
  check(cmds && cmds.some(x => x[1] === 'dd:count:pagewins' && x[2] === '8|normal|fighter'), 'store: a win that carried out every page is counted');
  check(cmds && cmds.some(x => x[1] === 'dd:count:endings' && x[2] === 'quench'), 'store: the ending is counted');
  check(cmds && !JSON.stringify(cmds).includes('Somebody'), 'store: nothing dropped reaches it');
  // a rung of the ladder past Hard is counted apart from Hard; a rung off Hard, or out of range, is not one
  check(tel.clean({ ...run, diff: 'hard', rung: 9 }).rung === 5 && tel.clean({ ...run, diff: 'normal', rung: 3 }).rung === 0, 'a rung: on Hard only, held to its range');
  sent.length = 0;
  await call(live.tel, 'POST', JSON.stringify({ ...run, diff: 'hard', rung: 3 }));
  check(sent[1] && sent[1].body.some(x => x[1] === 'dd:count:runs' && x[2] === '8|hard+3|fighter'), 'store: a Hard+3 run is counted as Hard+3, not Hard');
  // the sixty-first note in a minute from one address is dropped unread
  global.fetch = async (url, o) => { const c = JSON.parse(o.body); sent.push({ body: c }); return { ok: true, json: async () => c.map(x => ({ result: x[0] === 'INCR' ? 61 : 1 })) }; };
  sent.length = 0;
  const flood = await new Promise(resolve => { const res = { statusCode: 0, setHeader() {}, end() { resolve(this.statusCode); } }; live.tel({ method: 'POST', body: run, headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' } }, res); });
  check(flood === 429 && sent.length === 1 && /^dd:rate:\d+:[a-f0-9]{64}$/.test(sent[0].body[0][1]) && !JSON.stringify(sent).includes('203.0.113.9'), 'store: a flood is refused, and its address is not retained');
  // a crash is counted by build and message, in plain words; a new kind only while there is room
  const crashes = async () => {
    sent.length = 0;
    global.fetch = async (url, o) => { const c = JSON.parse(o.body); sent.push({ body: c }); return { ok: true, json: async () => c.map(() => ({ result: 1 })) }; };
    await call(live.tel, 'POST', JSON.stringify({ kind: 'crash', build: 'deepdelve-v41', msg: 'TypeError: <b>x</b> is not a function '.repeat(9), stack: 's' }));
    return sent[1] ? sent[1].body.find(x => x[0] === 'EVAL') : null;
  };
  const counted = await crashes();
  check(counted && counted[2] === 1 && counted[3] === 'dd:count:crash' && /^deepdelve-v41 crash-[a-f0-9]{24}$/.test(counted[4]), 'store: the crash counter contains a build and digest, not message text');
  check(counted && counted[5] === 500 && counted[1].includes("redis.call('HEXISTS'") && counted[1].includes("redis.call('HLEN'") && counted[1].includes("redis.call('HINCRBY'"), 'store: the distinct-crash cap and increment are submitted atomically');
  check((await crashes())[4] === counted[4], 'the same crash keeps the same opaque counter');
  global.fetch = async () => { throw new Error('down'); };
  check((await call(live.tel, 'POST', JSON.stringify(run))).status === 204, 'store down: the game still hears 204');
  global.fetch = async (u, o) => ({ ok: true, json: async () => JSON.parse(o.body).map(() => ({ result: ['8|normal|fighter', '3'] })) });
  const st = JSON.parse((await call(live.stats, 'GET')).body);
  check(st.ready && st.runs['8|normal|fighter'] === 3, 'stats: counts come back as numbers');
  global.fetch = async (u, o) => ({ ok: true, json: async () => JSON.parse(o.body).map(c => ({ result: c[1] === 'dd:count:crash' ? ['deepdelve-v3 error for alice@example.com', '2'] : [] })) });
  const legacy = await call(live.stats, 'GET');
  check(!legacy.body.includes('alice') && !legacy.body.includes('example.com') && JSON.parse(legacy.body).crashes[0][1] === 2, 'legacy crash messages are never exposed by the public stats endpoint');
  global.fetch = async (u, o) => ({ ok: true, json: async () => JSON.parse(o.body).map(() => ({ error: 'ERR rejected' })) });
  const failed = await call(live.stats, 'GET');
  check(failed.status === 502 && failed.headers['Cache-Control'] === 'no-store', 'store command errors fail closed and are not cached');
  const insecure = fresh({ KV_REST_API_URL: 'http://store.example', KV_REST_API_TOKEN: 't' });
  let insecureFetch = false;
  global.fetch = async () => { insecureFetch = true; throw new Error('must not send credentials'); };
  check((await call(insecure.stats, 'GET')).status === 502 && !insecureFetch, 'store credentials are never sent over HTTP');

  console.log(`telemetry checks complete, ${failures} failure(s)`);
  process.exit(failures ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
