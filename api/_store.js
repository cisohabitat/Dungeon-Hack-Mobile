'use strict';
// The one place the telemetry store is reached: an Upstash Redis database over
// its REST interface, so the functions need no packages. Vercel's Upstash
// integration names the variables KV_REST_API_*, a database made at Upstash
// itself UPSTASH_REDIS_REST_*; either will do. With neither set, nothing is
// stored and the game is told all is well: the game never waits on this.

const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';

const ready = () => !!(URL_ && TOKEN);

/** Run several commands in one request; each is an array such as ['HINCRBY', 'k', 'f', 1]. */
async function pipeline(commands) {
  if (!URL_.startsWith('https://')) throw new Error('store requires HTTPS');
  const r = await fetch(`${URL_.replace(/\/$/, '')}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
    signal: AbortSignal.timeout(5000),
    redirect: 'error',
  });
  if (!r.ok) throw new Error(`store answered ${r.status}`);
  const results = await r.json();
  if (!Array.isArray(results) || results.length !== commands.length || results.some(x => !x || typeof x !== 'object'
    || !Object.prototype.hasOwnProperty.call(x, 'result') || Object.prototype.hasOwnProperty.call(x, 'error'))) throw new Error('store command failed');
  return results.map(x => x.result);
}

module.exports = { ready, pipeline };
