// Gather the recordings from the same text the screens use. Exercise the
// epilogue's branches here so no ending needs a service, or a new voice, live.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { BACKGROUNDS, ENDINGS, JOURNAL } from '../js/data.js';
import { fixedReadings, endingSpeech, voiceId } from '../js/voicelines.js';
const require = createRequire(import.meta.url);
const { loadGame } = require('../test/harness.js');
const target = new URL('../sound/narration/catalog.json', import.meta.url);

export async function voiceCatalog() {
  const entries = new Map();
  const add = e => {
    if (entries.has(e.id) && entries.get(e.id).text !== e.text) throw new Error('Voice id collision: ' + e.id);
    if (!entries.has(e.id)) entries.set(e.id, e);
  };
  fixedReadings().forEach(add);
  const { Game } = await loadGame();
  Game.newGame({ name: 'Voice hero', cls: 'fighter', stats: { str: 12, dex: 12, con: 12, int: 12, wis: 12, cha: 12 }, seed: 'voice-catalog', opts: { levels: 8, size: 'small', permadeath: false } });
  const G = Game.state();
  const flags = ['captive', 'guide', 'crew', 'lamp', 'robbed', 'spared', 'oathPaid', 'eggPaid', 'tollowedPaid', 'bargain'];
  G.threads = Object.fromEntries(flags.map(id => [id, true]));
  G.rested = 'An earlier hero';
  G.tested = false;
  for (const won of [false, true]) for (const ending of Object.keys(ENDINGS))
    for (const bg of Object.keys(BACKGROUNDS)) for (const route of [null, 'crypts', 'warrens']) {
      G.ending = ending; G.player.bg = bg; G.route = route;
      for (const pages of [0, 1, 8]) for (const deep of [false, true]) {
        G.journal = JOURNAL.map((_, i) => ({ i, depth: 1 })).filter(j => !JOURNAL[j.i].thread).slice(0, pages);
        G.depth = deep ? 5 : 1; G.player.deepest = G.depth;
        // Each companion's fate is one clause, apart from the other choices.
        for (const kind of [null, 'hound', 'goblin', 'wolf', 'mender', 'renegade', 'sellsword'])
          for (const fate of ['here', 'away', 'fallen', 'avenged-here', 'avenged-away', 'avenged-fallen', 'stay']) {
            G.companion = kind ? { kind, name: 'Voice friend', depth: fate.includes('away') ? G.depth + 1 : G.depth, fallen: fate.includes('fallen') ? 3 : 0, avenged: fate.includes('avenged'), mode: fate === 'stay' ? 'stay' : 'follow' } : null;
            for (const text of endingSpeech(Game.epilogue(won), G)) add({ id: voiceId(text), text, title: won ? ENDINGS[ending].title : 'The fallen hero', kind: 'ending' });
          }
      }
    }
  return { version: 1, voice: 'bm_george', speed: 0.92, clips: Object.fromEntries([...entries].sort(([a], [b]) => a.localeCompare(b))) };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const text = JSON.stringify(await voiceCatalog(), null, 2) + '\n';
  if (process.argv.includes('--check')) {
    if (readFileSync(target, 'utf8') !== text) throw new Error('Voice catalogue is stale: run node tools/voice-catalog.mjs');
    console.log('Voice catalogue matches the written story.');
  } else { writeFileSync(target, text); console.log('Wrote ' + fileURLToPath(target)); }
}
