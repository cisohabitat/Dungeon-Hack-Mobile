'use strict';
// Catch an ending or text edit that would ship a missing offline recording.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./harness');
async function main() {
  const { voiceCatalog } = await import('../tools/voice-catalog.mjs');
  const { endingSpeech, voiceId } = await import('../js/voicelines.js');
  const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../sound/narration/catalog.json')));
  assert.deepEqual(await voiceCatalog(), catalog, 'regenerate the voice catalogue when the story changes');
  const production = JSON.parse(fs.readFileSync(path.join(__dirname, '../sound/narration/production.json')));
  const opening = JSON.parse(fs.readFileSync(path.join(__dirname, '../sound/narration/provenance.json')));
  for (const [id, clip] of Object.entries(catalog.clips)) {
    assert.ok(clip.text.trim());
    assert.equal(id === 'prologue' ? opening.script.join(' ') : production[id]?.text, clip.text, `${id} recording script is stale`);
    for (const ext of ['ogg', 'm4a']) {
      assert.ok(fs.statSync(path.join(__dirname, '../sound/narration', `${id}.${ext}`)).size > 1000, `${id}.${ext} is missing`);
    }
    assert.ok(fs.statSync(path.join(__dirname, '../sound/masters/narration', `${id}.flac`)).size > 1000);
  }
  const { Game, BACKGROUNDS, JOURNAL } = await loadGame();
  for (const floors of [4, 8, 12]) {
    Game.newGame({ name: 'A hero; with unusual words', cls: 'fighter', seed: 'voice-coverage', opts: { levels: floors, size: 'small', permadeath: false } });
    const G = Game.state();
    for (let i = 0; i < 300; i++) {
      G.player.bg = Object.keys(BACKGROUNDS)[i % Object.keys(BACKGROUNDS).length];
      G.player.deepest = 1 + i % floors; G.depth = G.player.deepest;
      G.ending = ['take', 'quench', 'keep'][i % 3];
      G.journal = JOURNAL.map((_, i) => ({ i, depth: 1 })).filter(j => !JOURNAL[j.i].thread).slice(0, i % (Game.pagesInDungeon() + 1));
      G.companion = { kind: ['hound', 'renegade', 'sellsword', 'mender', 'goblin', 'wolf'][i % 6], name: 'A friend; called Henry', depth: i % 2 ? G.depth : 1, fallen: i % 3 ? 0 : G.depth, mode: i % 2 ? 'follow' : 'stay', avenged: i % 5 === 0 };
      G.threads = { captive: i % 2 === 0, lamp: i % 3 === 0, bargain: i % 4 === 0 };
      for (const won of [true, false]) for (const text of endingSpeech(Game.epilogue(won), G)) {
        assert.ok(catalog.clips[voiceId(text)], `unrecorded ending: ${text}`);
      }
    }
  }
  console.log(`voice catalogue checks complete: ${Object.keys(catalog.clips).length} offline readings, 0 failure(s)`);
}
main().catch(e => { console.error(e); process.exitCode = 1; });
