'use strict';
// Where the game's opt-in reports land (js/telemetry.js sends them): one when a
// run ends, and one when something breaks. Nothing that names a player is kept:
// no address, no account, no free text but an error's own message. What is kept
// is counted by class, difficulty and length of delve, so the dashboard
// (dashboard.html, fed by api/stats.js) can set real players beside the bot.
const { ready, pipeline } = require('./_store');

const MAX_BODY = 6000;
const RUNS_KEPT = 50000, CRASHES_KEPT = 5000;
const word = (v, n = 24) => (typeof v === 'string' ? v.slice(0, n).replace(/[^\w .:'()-]/g, '') : '');
const num = (v, lo = 0, hi = 1e9) => (Number.isFinite(+v) ? Math.max(lo, Math.min(hi, Math.round(+v))) : 0);

/** Only the fields the game sends, each cut to its kind: anything else is dropped. */
function clean(b) {
  const base = { v: num(b.v, 0, 99), at: Date.now(), build: word(b.build, 32), seed: word(b.seed, 40), daily: !!b.daily };
  if (b.kind === 'run') {
    const fps = Array.isArray(b.fps) ? b.fps.slice(0, 4).map(x => num(x)) : [];
    const d = b.device || {};
    return {
      kind: 'run', ...base,
      cls: word(b.cls, 12), path: word(b.path, 16), diff: word(b.diff, 8), levels: num(b.levels, 1, 32), size: word(b.size, 8),
      outcome: ['win', 'death', 'quit'].includes(b.outcome) ? b.outcome : 'quit',
      depth: num(b.depth, 0, 32), level: num(b.level, 0, 40), cause: word(b.cause, 40), minutes: num(b.minutes, 0, 6000),
      fps, tips: num(b.tips, 0, 999),
      // the combinations a run made and the legend it found: was there a build to name
      combos: Array.isArray(b.combos) ? b.combos.slice(0, 40).map(x => word(x, 24)).filter(Boolean) : [], legend: word(b.legend, 24),
      device: { w: num(d.w, 0, 10000), h: num(d.h, 0, 10000), dpr: Math.min(8, +d.dpr || 0), cores: num(d.cores, 0, 256), mem: Math.min(64, +d.mem || 0), touch: !!d.touch, family: word(d.family, 20) },
    };
  }
  if (b.kind === 'crash') {
    return {
      kind: 'crash', ...base,
      msg: String(b.msg || '').slice(0, 300), where: String(b.where || '').slice(0, 200), stack: String(b.stack || '').slice(0, 2000),
      depth: num(b.depth, 0, 32), save: word(b.save, 16),
    };
  }
  return null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.statusCode = 405; res.setHeader('Allow', 'POST'); return res.end(); }
  let body = req.body;
  try {
    if (body == null) {
      // no parser ran: read it (a beacon sends plain text)
      body = await new Promise((ok, no) => {
        let s = '';
        req.on('data', c => { s += c; if (s.length > MAX_BODY) no(new Error('too long')); });
        req.on('end', () => ok(s));
        req.on('error', no);
      });
    }
    if (typeof body === 'string') { if (body.length > MAX_BODY) throw new Error('too long'); body = JSON.parse(body); }
  } catch { res.statusCode = 400; return res.end(); }
  const e = body && typeof body === 'object' ? clean(body) : null;
  if (!e) { res.statusCode = 400; return res.end(); }
  if (!ready()) { res.statusCode = 204; return res.end(); }
  try {
    if (e.kind === 'run') {
      const key = `${e.levels}|${e.diff}|${e.cls}`;
      const cmds = [
        ['LPUSH', 'dd:runs', JSON.stringify(e)], ['LTRIM', 'dd:runs', 0, RUNS_KEPT - 1],
      ];
      // only a run that ended counts towards a win rate: a quit says nothing either way
      if (e.outcome !== 'quit') cmds.push(['HINCRBY', 'dd:count:runs', key, 1]);
      if (e.outcome === 'win') cmds.push(['HINCRBY', 'dd:count:wins', key, 1]);
      // a win that made at least one combination, and how often each is made at all
      if (e.outcome === 'win' && e.combos.length) cmds.push(['HINCRBY', 'dd:count:combowins', key, 1]);
      for (const c of e.combos) cmds.push(['HINCRBY', 'dd:count:combos', c, 1]);
      // frame-rate buckets summed over every run, for the budget's real-world check
      e.fps.forEach((n, i) => { if (n) cmds.push(['HINCRBY', 'dd:count:fps', String(i), n]); });
      await pipeline(cmds);
    } else {
      await pipeline([
        ['LPUSH', 'dd:crashes', JSON.stringify(e)], ['LTRIM', 'dd:crashes', 0, CRASHES_KEPT - 1],
        ['HINCRBY', 'dd:count:crash', `${e.build} ${e.msg}`.slice(0, 200), 1],
      ]);
    }
  } catch {
    // the store is down or full: the game is not to be troubled with it
  }
  res.statusCode = 204;
  return res.end();
};

module.exports.clean = clean;
