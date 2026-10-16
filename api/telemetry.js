'use strict';
// Where the game's opt-in reports land (js/telemetry.js sends them): one when a
// run ends, and one when something breaks. Nothing that names a player is kept:
// no account or hero's name; error details stay in the private store. What is kept
// is counted by class, difficulty and length of delve, so the dashboard
// (dashboard.html, fed by api/stats.js) can set real players beside the bot.
const { ready, pipeline } = require('./_store');
const IDS = require('./_ids');   // the game's own ids (tools/ids.mjs): what a report may name
const { createHash, createHmac } = require('node:crypto');

const MAX_BODY = 6000;
const RUNS_KEPT = 50000, CRASHES_KEPT = 5000;
// one address may send this many notes a minute: a run ends once, a crash is sent five times a visit at most
const RATE_A_MINUTE = 60;
// how many different crash messages are counted (the list of crashes keeps the rest): a flood of
// made-up messages would otherwise grow the count without end
const CRASH_KINDS = 500;
const word = (v, n = 24) => (typeof v === 'string' ? v.slice(0, n).replace(/[^\w .:'()-]/g, '') : '');
/** A word the game could have sent, or nothing: the counts are keyed by these, so nothing else may be one. */
const oneOf = (v, list) => (typeof v === 'string' && list.includes(v) ? v : '');
const numeric = v => (typeof v === 'number' || typeof v === 'string') && Number.isFinite(Number(v)) ? Number(v) : 0;
const num = (v, lo = 0, hi = 1e9) => Math.max(lo, Math.min(hi, Math.round(numeric(v))));
const text = (v, n) => typeof v === 'string' ? v.slice(0, n) : '';
const CRASH_COUNT = "if redis.call('HEXISTS', KEYS[1], ARGV[1]) == 1 or redis.call('HLEN', KEYS[1]) < tonumber(ARGV[2]) then return redis.call('HINCRBY', KEYS[1], ARGV[1], 1) end return 0";

/** Only the fields the game sends, each cut to its kind: anything else is dropped. */
function clean(b) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return null;
  const base = { v: num(b.v, 0, 99), at: Date.now(), build: word(b.build, 32), seed: word(b.seed, 40), daily: !!b.daily, weekly: !!b.weekly };
  if (b.kind === 'run') {
    const fps = Array.isArray(b.fps) ? b.fps.slice(0, 4).map(x => num(x)) : [];
    const d = b.device || {};
    return {
      kind: 'run', ...base,
      cls: oneOf(b.cls, IDS.classes), path: oneOf(b.path, IDS.paths), diff: oneOf(b.diff, IDS.diffs) || 'normal', rung: b.diff === 'hard' ? num(b.rung, 0, 5) : 0, levels: num(b.levels, 1, 32), size: oneOf(b.size, IDS.sizes) || 'medium',
      outcome: ['win', 'death', 'quit'].includes(b.outcome) ? b.outcome : 'quit',
      depth: num(b.depth, 0, 32), level: num(b.level, 0, 40), cause: word(b.cause, 40), minutes: num(b.minutes, 0, 6000),
      fps, tips: num(b.tips, 0, 999),
      // the combinations a run made and the legend it found: was there a build to name
      combos: Array.isArray(b.combos) ? [...new Set(b.combos.slice(0, 40).map(x => oneOf(x, IDS.combos)).filter(Boolean))] : [], legend: oneOf(b.legend, IDS.legends),
      // the crews' pages found, of the delve's (one a floor)
      pagesOf: num(b.pagesOf, 0, 32), pages: Math.min(num(b.pages, 0, 32), num(b.pagesOf, 0, 32)),
      // how a won delve ended, one of the three
      ending: b.outcome === 'win' && ['take', 'quench', 'keep'].includes(b.ending) ? b.ending : '',
      device: { w: num(d.w, 0, 10000), h: num(d.h, 0, 10000), dpr: Math.max(0, Math.min(8, numeric(d.dpr))), cores: num(d.cores, 0, 256), mem: Math.max(0, Math.min(64, numeric(d.mem))), touch: !!d.touch, family: word(d.family, 20) },
    };
  }
  if (b.kind === 'crash') {
    return {
      kind: 'crash', ...base,
      msg: text(b.msg, 300), where: text(b.where, 200), stack: text(b.stack, 2000),
      depth: num(b.depth, 0, 32), save: word(b.save, 16),
    };
  }
  return null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.statusCode = 405; res.setHeader('Allow', 'POST'); return res.end(); }
  res.setHeader('Cache-Control', 'no-store');
  // A beacon can be sent cross-site without a CORS preflight. Browser reports
  // must come from this origin; non-browser callers remain untrusted public input.
  const headers = req.headers || {};
  if (headers['sec-fetch-site'] === 'cross-site' || (headers.origin && headers.origin !== `https://${headers.host}` && headers.origin !== `http://${headers.host}`)) {
    res.statusCode = 403; return res.end();
  }
  let body = req.body;
  try {
    if (Number(headers['content-length']) > MAX_BODY) throw new Error('too long');
    if (body == null) {
      // no parser ran: read it (a beacon sends plain text)
      body = await new Promise((ok, no) => {
        let chunks = [], bytes = 0, rejected = false;
        req.on('data', c => {
          if (rejected) return;
          const chunk = Buffer.isBuffer(c) ? c : Buffer.from(c);
          bytes += chunk.length;
          if (bytes > MAX_BODY) { rejected = true; chunks = []; no(new Error('too long')); return; }
          chunks.push(chunk);
        });
        req.on('end', () => ok(Buffer.concat(chunks).toString('utf8')));
        req.on('aborted', () => no(new Error('aborted')));
        req.on('error', no);
      });
    }
    if (typeof body === 'string') { if (Buffer.byteLength(body) > MAX_BODY) throw new Error('too long'); body = JSON.parse(body); }
    // (a body the platform parsed before this ran is measured again: the cap above never saw it)
    if (body && typeof body === 'object' && Buffer.byteLength(JSON.stringify(body)) > MAX_BODY) throw new Error('too long');
  } catch { res.statusCode = 400; return res.end(); }
  const e = body && typeof body === 'object' ? clean(body) : null;
  if (!e || (e.kind === 'run' && !e.cls)) { res.statusCode = 400; return res.end(); }
  if (!ready()) { res.statusCode = 204; return res.end(); }
  try {
    // so many a minute from one address, and no more: the rest are dropped unread
    const ip = String(headers['x-forwarded-for'] || headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim().slice(0, 64);
    // Never retain the address itself. Vercel supplies x-forwarded-for; a different
    // host must overwrite it at its trusted proxy, rather than trusting callers.
    const secret = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
    const address = createHmac('sha256', secret).update(ip).digest('hex');
    const key = `dd:rate:${Math.floor(Date.now() / 60000)}:${address}`;
    const [n] = await pipeline([['INCR', key], ['EXPIRE', key, 120]]);
    if (!Number.isSafeInteger(Number(n)) || Number(n) < 1) throw new Error('invalid rate count');
    if (Number(n) > RATE_A_MINUTE) { res.statusCode = 429; return res.end(); }
    if (e.kind === 'run') {
      // a rung of the ladder past Hard is counted apart, so it does not pull Hard's own rate down
      const key = `${e.levels}|${e.diff}${e.rung ? `+${e.rung}` : ''}|${e.cls}`;
      const cmds = [
        ['LPUSH', 'dd:runs', JSON.stringify(e)], ['LTRIM', 'dd:runs', 0, RUNS_KEPT - 1],
      ];
      // only a run that ended counts towards a win rate: a quit says nothing either way
      if (e.outcome !== 'quit') cmds.push(['HINCRBY', 'dd:count:runs', key, 1]);
      if (e.outcome === 'win') cmds.push(['HINCRBY', 'dd:count:wins', key, 1]);
      // a win that made at least one combination, and how often each is made at all
      if (e.outcome === 'win' && e.combos.length) cmds.push(['HINCRBY', 'dd:count:combowins', key, 1]);
      for (const c of e.combos) cmds.push(['HINCRBY', 'dd:count:combos', c, 1]);
      // a win that carried out every page of its delve: the aim is two in five or more
      if (e.outcome === 'win' && e.pagesOf && e.pages >= e.pagesOf) cmds.push(['HINCRBY', 'dd:count:pagewins', key, 1]);
      // the split between the endings
      if (e.ending) cmds.push(['HINCRBY', 'dd:count:endings', e.ending, 1]);
      // frame-rate buckets summed over every run, for the budget's real-world check
      e.fps.forEach((n, i) => { if (n) cmds.push(['HINCRBY', 'dd:count:fps', String(i), n]); });
      await pipeline(cmds);
    } else {
      const field = `${e.build} crash-${createHash('sha256').update(e.msg).digest('hex').slice(0, 24)}`;
      await pipeline([
        ['LPUSH', 'dd:crashes', JSON.stringify(e)], ['LTRIM', 'dd:crashes', 0, CRASHES_KEPT - 1],
        // Check and count together: concurrent requests must share the same cap.
        ['EVAL', CRASH_COUNT, 1, 'dd:count:crash', field, CRASH_KINDS],
      ]);
    }
  } catch {
    // the store is down or full: the game is not to be troubled with it
  }
  res.statusCode = 204;
  return res.end();
};

module.exports.clean = clean;
