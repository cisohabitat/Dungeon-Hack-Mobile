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
  const r = await fetch(`${URL_.replace(/\/$/, '')}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!r.ok) throw new Error(`store answered ${r.status}`);
  return (await r.json()).map(x => x.result);
}

module.exports = { ready, pipeline };
