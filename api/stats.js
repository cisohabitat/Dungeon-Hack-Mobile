'use strict';
// The counts behind the dashboard: runs and wins by length of delve, difficulty
// and class, the frame-rate buckets, and the commonest crashes. Only counts:
// no run's own record leaves the store from here.
const { ready, pipeline } = require('./_store');
const { createHash } = require('node:crypto');

const pairs = a => { const o = Object.create(null); for (let i = 0; a && i < a.length; i += 2) o[a[i]] = +a[i + 1]; return o; };

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') { res.statusCode = 405; res.setHeader('Allow', 'GET'); return res.end(); }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
  if (!ready()) { res.statusCode = 200; return res.end(JSON.stringify({ ready: false })); }
  try {
    const [runs, wins, fps, crash, comboWins, combos, pageWins, endings] = await pipeline([
      ['HGETALL', 'dd:count:runs'], ['HGETALL', 'dd:count:wins'], ['HGETALL', 'dd:count:fps'], ['HGETALL', 'dd:count:crash'],
      ['HGETALL', 'dd:count:combowins'], ['HGETALL', 'dd:count:combos'], ['HGETALL', 'dd:count:pagewins'], ['HGETALL', 'dd:count:endings'],
    ]);
    // Older counters contained message text. Do not publish those either:
    // error messages can contain a user's input, even after HTML is stripped.
    const crashes = Object.entries(pairs(crash)).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([field, n]) => {
      const build = /^(\d+\.\d+\.\d+ \(build \d+\)|deepdelve-v\d+) /.exec(field)?.[1];
      return [`${build ? build + ' · ' : ''}Crash ${createHash('sha256').update(field).digest('hex').slice(0, 24)}`, n];
    });
    res.statusCode = 200;
    return res.end(JSON.stringify({ ready: true, runs: pairs(runs), wins: pairs(wins), fps: pairs(fps), crashes, comboWins: pairs(comboWins), combos: pairs(combos), pageWins: pairs(pageWins), endings: pairs(endings) }));
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    res.statusCode = 502;
    return res.end(JSON.stringify({ ready: true, error: 'store unreachable' }));
  }
};
