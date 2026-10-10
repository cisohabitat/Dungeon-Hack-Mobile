'use strict';
// The counts behind the dashboard: runs and wins by length of delve, difficulty
// and class, the frame-rate buckets, and the commonest crashes. Only counts:
// no run's own record leaves the store from here.
const { ready, pipeline } = require('./_store');

const pairs = a => { const o = {}; for (let i = 0; a && i < a.length; i += 2) o[a[i]] = +a[i + 1]; return o; };

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  if (!ready()) { res.statusCode = 200; return res.end(JSON.stringify({ ready: false })); }
  try {
    const [runs, wins, fps, crash, comboWins, combos] = await pipeline([
      ['HGETALL', 'dd:count:runs'], ['HGETALL', 'dd:count:wins'], ['HGETALL', 'dd:count:fps'], ['HGETALL', 'dd:count:crash'],
      ['HGETALL', 'dd:count:combowins'], ['HGETALL', 'dd:count:combos'],
    ]);
    const crashes = Object.entries(pairs(crash)).sort((a, b) => b[1] - a[1]).slice(0, 20);
    res.statusCode = 200;
    return res.end(JSON.stringify({ ready: true, runs: pairs(runs), wins: pairs(wins), fps: pairs(fps), crashes, comboWins: pairs(comboWins), combos: pairs(combos) }));
  } catch {
    res.statusCode = 502;
    return res.end(JSON.stringify({ ready: true, error: 'store unreachable' }));
  }
};
