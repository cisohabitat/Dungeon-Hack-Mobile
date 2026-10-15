// Rule checks for the narrator's voice (docs/VOICE.md): what a machine can hold
// it to, over every line the narrator says as tools/narrative.mjs gathers them
// into docs/NARRATIVE.md. Run from rules.js with its helpers lent in.
module.exports = async function voiceChecks(h) {
  const { test, newContext } = h;
  const { narrative } = await import('../tools/narrative.mjs');
  /** The story's lines, each with the section it sits in; headings and the keys before a line left out. */
  const story = async () => {
    let section = '';
    const out = [];
    for (const raw of (await narrative()).split('\n')) {
      if (raw.startsWith('## ')) section = raw.slice(3);
      if (!raw.trim() || raw.startsWith('#')) continue;
      const key = (/^\s*- \*([^*]+)\*: /.exec(raw) || [])[1] || '';
      out.push({ section, key, text: raw.replace(/^\s*- (\*[^*]+\*: )?/, '') });
    }
    return out.slice(1);                        // (the document's own note on how it is made)
  };

  await test('the narrator spells the British way, with straight quotes, and calls things by their one name', async () => {
    const out = [];
    const AMERICAN = /\b(colors?|colored|armors?|armored|gray|grays|centers?|centered|honors?|honored|favors?|favored|favorite|defense|offense|behaviors?|neighbors?|odors?|rumors?|vapors?|harbors?|valor|splendor|theaters?|jewelry|traveled|traveler|canceled|toward|afterward|pry|pried|prying|gotten up|realiz\w*|recogniz\w*|organiz\w*|apologiz\w*|\w+yzed?)\b/i;
    const NAMES = [
      [/[‘’“”]/, 'a curly quote'],
      [/\blampfolk\b|\blamp-folk\b/, 'Lampfolk, not lampfolk'],
      [/\bsun ?walker/i, 'sun-walker'],
      [/\bdeep delve\b/i, 'the Deepdelve'],
      [/\bunderdark\b/i, 'the deep'],
      [/\bDrow\b/, 'dark elves'],
      [/heart of the mountain/i, 'the Heart of the Mountain', s => /Heart of the Mountain/.test(s) && !/heart of the mountain/i.test(s.replace(/Heart of the Mountain/g, ''))],
      [/\bold Smiths\b|\bOld smiths\b|\bOld Smiths\b/, 'the old smiths'],
    ];
    for (const { section, key, text } of await story()) {
      const where = `${section}${key ? ' / ' + key : ''}`;
      const us = AMERICAN.exec(text);
      if (us) out.push(`${where}: "${us[0]}"`);
      for (const [re, want, ok] of NAMES) if (re.test(text) && !(ok && ok(text))) out.push(`${where}: ${want}, in "${text.slice(0, 60)}"`);
    }
    return out.length ? out.slice(0, 12).join('; ') : true;
  });

  await test('the narrator keeps exclamation marks for a champion\'s fall: the people of the deep shout in their own words, and a tip a warning', async () => {
    const out = [];
    for (const { section, key, text } of await story()) {
      if (/tips/.test(section) || key === 'falling') continue;
      const said = text.replace(/"[^"]*"/g, '');
      if (said.includes('!')) out.push(`${section}${key ? ' / ' + key : ''}: "${text.slice(0, 70)}"`);
    }
    return out.length ? out.join('; ') : true;
  });

  await test('the story after a run is told of the hero by name, as they, never you, and never guesses whether a hero is a he or a she', async () => {
    const out = [];
    const { BACKGROUNDS, ROUTES, ENDINGS } = await newContext();
    const after = [
      ...Object.entries(BACKGROUNDS).map(([k, b]) => [`BACKGROUNDS.${k}.epi`, b.epi]),
      ...Object.entries(ROUTES).map(([k, r]) => [`ROUTES.${k}.epi`, r.epi]),
      ...Object.entries(ROUTES).map(([k, r]) => [`ROUTES.${k}.tells`, r.tells]),
      ...Object.entries(ENDINGS).flatMap(([k, e]) => [[`ENDINGS.${k}.did`, e.did], ...e.epi.map((s, i) => [`ENDINGS.${k}.epi[${i}]`, s])]),
    ];
    for (const [where, s] of after) {
      const plain = String(s).replace(/"[^"]*"/g, '');
      const bad = /\b(you|your|yours|yourself|he|she|him|his|her|hers|himself|herself)\b/i.exec(plain);
      if (bad) out.push(`${where}: "${bad[0]}"`);
    }
    // and the hero is named in each ending's story after
    for (const [k, e] of Object.entries(ENDINGS)) if (!e.epi[0].includes('{name}')) out.push(`ENDINGS.${k}: the story after does not name the hero`);
    return out.length ? out.join('; ') : true;
  });

  await test('the narrator never says game words in the story: those are for the tips', async () => {
    const out = [];
    const GAME = /\b(HP|hit points?|buffs?|debuffs?|proc|DPS|aggro|spawns?|spawned|loot drops?|NPC|XP|mobs?|cooldown|stats?)\b/;
    for (const { section, key, text } of await story()) {
      // the Bestiary's last sentence and the tips teach the rules, in plain words that may name one
      if (/tips|Bestiary/.test(section)) continue;
      const bad = GAME.exec(text);
      if (bad) out.push(`${section}${key ? ' / ' + key : ''}: "${bad[0]}" in "${text.slice(0, 60)}"`);
    }
    return out.length ? out.join('; ') : true;
  });

  await test('the narrator\'s whole document is current, and every table it reads has a line in it', async () => {
    const doc = await narrative();
    const want = ['## The prologue (PROLOGUE)', '(CLASSES)', '(BACKGROUNDS)', '(JOURNAL)', '(ROUTES)', '(THEMES)', '(TWISTS)', '(PIECE_VARIANTS)', '(WICK)', 'MONSTERS, speech', 'MONSTERS, named', '(ENCOUNTERS)', '(ENDINGS)', '(BESTIARY)', '(tips.js)'];
    const missing = want.filter(w => !doc.includes(w));
    const fs = require('fs'), path = require('path');
    const have = fs.readFileSync(path.join(__dirname, '..', 'docs', 'NARRATIVE.md'), 'utf8');
    if (have !== doc) missing.push('docs/NARRATIVE.md is stale: run node tools/narrative.mjs');
    if (/undefined|\[object Object\]/.test(doc)) missing.push('a line read as nothing');
    return missing.length ? missing.join('; ') : true;
  });
};
