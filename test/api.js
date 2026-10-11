'use strict';
// Checks for the telemetry functions in api/: what they keep, what they refuse,
// and that with no store set up they answer at once and keep nothing.
const path = require('path');
let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.error('FAIL', msg); } };

function call(handler, method, body) {
  return new Promise(resolve => {
    const res = { statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(b) { resolve({ status: this.statusCode, body: b, headers: this.headers }); } };
    handler({ method, body }, res);
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
    cause: '', minutes: 41, fps: [900, 30, 2, 0], tips: 3, combos: ['conduction', 'shield_wall', '<b>x</b>'], legend: 'bastion', pages: 8, pagesOf: 8, seed: 'abc', build: 'deepdelve-v26', device: { w: 393, h: 851, dpr: 2.75, cores: 8, mem: 4, touch: true, family: 'chrome' },
    name: 'Sir Somebody', email: 'x@y.z' };

  // what is kept: the fields the game sends, cut to size; anything else dropped
  const { tel, stats } = fresh({});
  const c = tel.clean(run);
  check(c && c.kind === 'run' && c.cls === 'fighter' && c.outcome === 'win' && c.levels === 8, 'a run report is kept');
  check(!('name' in c) && !('email' in c) && !JSON.stringify(c).includes('Somebody'), 'a field the game does not send is dropped');
  check(tel.clean({ ...run, outcome: 'cheated' }).outcome === 'quit', 'an outcome it does not know is read as a quit');
  check(tel.clean({ ...run, levels: 9999 }).levels === 32, 'numbers are held to their range');
  check(tel.clean({ ...run, cls: '<script>' }).cls === 'script', 'words lose markup');
  check(c.combos.length === 3 && c.combos[0] === 'conduction' && c.combos[2] === 'bxb' && c.legend === 'bastion', 'the combinations and the legend are kept, as words');
  check(c.pages === 8 && c.pagesOf === 8 && tel.clean({ ...run, pages: 99, pagesOf: 6 }).pages === 6 && tel.clean({ ...run, pages: 'x' }).pages === 0, 'pages found: a number, never more than the delve held');
  check(tel.clean({ ...run, combos: 'conduction' }).combos.length === 0 && tel.clean({ ...run, combos: Array(99).fill('a') }).combos.length === 40, 'combinations: a list, cut to size');
  const cr = tel.clean({ kind: 'crash', msg: 'x'.repeat(900), stack: 'y'.repeat(9000), seed: 's', depth: 3, save: 'abcd1234' });
  check(cr.msg.length === 300 && cr.stack.length === 2000 && cr.save === 'abcd1234', 'a crash report is kept, cut to size');
  check(tel.clean({ kind: 'other' }) === null, 'an unknown kind is refused');

  // with no store: answered at once, nothing sent anywhere
  let fetched = 0;
  global.fetch = async () => { fetched++; return { ok: true, json: async () => [] }; };
  check((await call(tel, 'POST', JSON.stringify(run))).status === 204, 'no store: 204');
  check((await call(tel, 'GET')).status === 405, 'only POST');
  check((await call(tel, 'POST', '{not json')).status === 400, 'bad JSON: 400');
  check((await call(tel, 'POST', 'x'.repeat(7000))).status === 400, 'too long: 400');
  check((await call(tel, 'POST', { kind: 'nope' })).status === 400, 'unknown kind: 400');
  check(fetched === 0, 'no store: nothing fetched');
  check(JSON.parse((await call(stats, 'GET')).body).ready === false, 'no store: stats says so');

  // with a store: one pipeline, counted by delve, difficulty and class
  const sent = [];
  const live = fresh({ KV_REST_API_URL: 'https://store.example/', KV_REST_API_TOKEN: 't' });
  global.fetch = async (url, o) => { sent.push({ url, body: JSON.parse(o.body), auth: o.headers.Authorization }); return { ok: true, json: async () => JSON.parse(o.body).map(() => ({ result: ['8|normal|fighter', '3'] })) }; };
  check((await call(live.tel, 'POST', JSON.stringify(run))).status === 204, 'store: 204');
  const cmds = sent[0] && sent[0].body;
  check(sent.length === 1 && sent[0].url === 'https://store.example/pipeline' && sent[0].auth === 'Bearer t', 'store: one pipeline request, with the token');
  check(cmds && cmds.some(x => x[0] === 'HINCRBY' && x[1] === 'dd:count:runs' && x[2] === '8|normal|fighter'), 'store: the run is counted');
  check(cmds && cmds.some(x => x[1] === 'dd:count:wins'), 'store: the win is counted');
  check(cmds && cmds.some(x => x[1] === 'dd:count:combowins' && x[2] === '8|normal|fighter') && cmds.some(x => x[1] === 'dd:count:combos' && x[2] === 'conduction'), 'store: a win with a combination, and each combination, are counted');
  check(cmds && cmds.some(x => x[1] === 'dd:count:pagewins' && x[2] === '8|normal|fighter'), 'store: a win that carried out every page is counted');
  check(cmds && !JSON.stringify(cmds).includes('Somebody'), 'store: nothing dropped reaches it');
  // a rung of the ladder past Hard is counted apart from Hard; a rung off Hard, or out of range, is not one
  check(tel.clean({ ...run, diff: 'hard', rung: 9 }).rung === 5 && tel.clean({ ...run, diff: 'normal', rung: 3 }).rung === 0, 'a rung: on Hard only, held to its range');
  sent.length = 0;
  await call(live.tel, 'POST', JSON.stringify({ ...run, diff: 'hard', rung: 3 }));
  check(sent[0] && sent[0].body.some(x => x[1] === 'dd:count:runs' && x[2] === '8|hard+3|fighter'), 'store: a Hard+3 run is counted as Hard+3, not Hard');
  global.fetch = async () => { throw new Error('down'); };
  check((await call(live.tel, 'POST', JSON.stringify(run))).status === 204, 'store down: the game still hears 204');
  global.fetch = async (u, o) => ({ ok: true, json: async () => JSON.parse(o.body).map(() => ({ result: ['8|normal|fighter', '3'] })) });
  const st = JSON.parse((await call(live.stats, 'GET')).body);
  check(st.ready && st.runs['8|normal|fighter'] === 3, 'stats: counts come back as numbers');

  console.log(`telemetry checks complete, ${failures} failure(s)`);
  process.exit(failures ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
