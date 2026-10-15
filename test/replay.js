'use strict';
// Verify a local recording through the same rules as the balance bot.
const fs = require('node:fs');
const { loadGame } = require('./harness');
(async () => {
  const file = process.argv[2];
  if (!file) throw new Error('Usage: node test/replay.js recording.json');
  if (fs.statSync(file).size > 6 * 1024 * 1024) throw new Error('The recording is too large.');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const { replayStorage, replayHeadless } = await import('../js/recording.js');
  const ctx = await loadGame();
  globalThis.localStorage = replayStorage(data);
  console.log(JSON.stringify(replayHeadless(ctx.Game, data)));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
