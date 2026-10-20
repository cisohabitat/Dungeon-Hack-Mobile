// Gathers every word the narrator says out of the tables that hold them (data.js,
// encounters.js, rooms.js, tips.js) into one document, docs/NARRATIVE.md, so the
// story can be read through and edited as one thing, in one register
// (docs/VOICE.md). The tables stay the source: fix a line there and run
//   node tools/narrative.mjs
// to write the document again. test/run.js fails while the document is stale.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = new URL('../', import.meta.url);
const OUT = new URL('docs/NARRATIVE.md', root);

/** Every line, in the order a hero meets them: the document as a string. */
export async function narrative() {
  const D = await import(new URL('js/data.js', root).href);
  const { ENCOUNTERS } = await import(new URL('js/encounters.js', root).href);
  const { PIECE_VARIANTS, PLACE_NAMES } = await import(new URL('js/rooms.js', root).href);
  const { makeTips } = await import(new URL('js/tips.js', root).href);
  // the few tips that name a way to step are read as they are said with both sides open
  const TIPS = makeTips({ asideWay: () => '(← or →)', canStep: () => true });

  const out = [];
  const md = s => String(s).replace(/<\/?b>/g, '**').replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const h = (n, t) => out.push('', `${'#'.repeat(n)} ${t}`, '');
  const p = s => out.push(md(s), '');
  const li = (key, s) => out.push(`- ${key ? `*${key}*: ` : ''}${md(s)}`);
  const end = () => out.push('');

  out.push('# Deepdelve: everything the narrator says',
    '',
    'Made by `node tools/narrative.mjs` from the tables in `js/`; do not edit it here. Fix a line',
    'in its table, write this again, and read it against `docs/VOICE.md`. Each heading names the',
    'table its lines come from.');

  h(2, 'Title facts (FUN_FACTS)');
  D.FUN_FACTS.forEach(p);

  const { PUZZLE_WORDS } = await import(new URL('js/puzzledata.js', root).href);
  h(2, 'The old caches (PUZZLE_WORDS)');
  for (const [id, words] of Object.entries(PUZZLE_WORDS)) {
    if (typeof words === 'string') li(id, words);
    else { h(3, id); for (const [key, value] of Object.entries(words)) li(key, value); }
  }
  end();

  const { MYTHICS, MYTHIC_POWERS, MYTHIC_CHOICE, MYTHIC_OFFER, MYTHIC_PREPARE, MYTHIC_STARTED, MYTHIC_CANCEL } = await import(new URL('js/mythicdata.js', root).href);
  h(2, 'Mythic bargains (MYTHICS)');
  p(MYTHIC_OFFER); p(MYTHIC_CHOICE.label); p(MYTHIC_CHOICE.outcome.text); p(MYTHIC_PREPARE); p(MYTHIC_STARTED); p(MYTHIC_CANCEL.label); p(MYTHIC_CANCEL.outcome.text);
  for (const [id, item] of Object.entries(MYTHICS)) { h(3, `${item.name} (${id})`); p(item.lore); item.powers.forEach(power => p(MYTHIC_POWERS[power])); }

  h(2, 'The prologue (PROLOGUE)');
  D.PROLOGUE.forEach(p);

  h(2, 'The six heroes (CLASSES)');
  for (const [id, c] of Object.entries(D.CLASSES)) {
    h(3, `${c.name} (${id})`);
    p(c.story);
  }

  h(2, 'Who the hero was (BACKGROUNDS)');
  for (const [id, b] of Object.entries(D.BACKGROUNDS)) {
    h(3, `${b.name} (${id})`);
    li('blurb', b.blurb); li('story', b.story); li('motive', b.motive); li('after', b.epi); end();
  }

  h(2, 'The crews\' pages (JOURNAL)');
  const group = e => (e.people ? 9 : e.act === 2 ? (e.road === 'warrens' ? 3 : 2) : e.act === 3 ? 4 : 1);
  const heads = { 1: 'Act I: those who came before', 2: 'Act II: down the Crypts', 3: 'Act II: down the Warrens', 4: 'Act III: the Heart', 9: 'The peoples\' own pages' };
  const order = D.JOURNAL.map((e, i) => i).sort((a, b) => group(D.JOURNAL[a]) - group(D.JOURNAL[b]) || (D.JOURNAL[a].step || 0) - (D.JOURNAL[b].step || 0));
  let at = 0;
  for (const i of order) {
    const e = D.JOURNAL[i];
    if (group(e) !== at) { at = group(e); h(3, heads[at]); }
    out.push(`**${md(e.title)}** (page ${i}${e.people ? `, the ${e.people}` : ''})`, '', md(e.text), '');
  }

  h(2, 'The roads (ROUTES)');
  for (const [id, r] of Object.entries(D.ROUTES)) {
    h(3, `${r.name} (${id})`);
    li('choice', r.choice); li('desc', r.desc); li('tells', r.tells); li('after', r.epi); end();
  }

  h(2, 'The places');
  h(3, 'Walls (THEMES)');
  for (const t of D.THEMES) li(t.name, t.flavor);
  end();
  h(3, 'Floor twists (TWISTS)');
  for (const [id, t] of Object.entries(D.TWISTS)) { li(`${t.name}, on arriving`, t.arrive); li(`${t.name}, while there`, t.chip); }
  end();
  h(3, 'Entered place names (PLACE_NAMES)');
  for (const [kind, names] of Object.entries(PLACE_NAMES)) for (const [variant, name] of Object.entries(names)) li(`${kind}, ${variant}`, name);
  end();
  h(3, 'Set pieces (PIECE_VARIANTS)');
  for (const [piece, vs] of Object.entries(PIECE_VARIANTS)) for (const [v, def] of Object.entries(vs)) if (def.say) li(`${piece}, ${v}`, def.say);
  end();

  h(2, 'Companions at your side (COMPANION_REACTIONS)');
  for (const [kind, reactions] of Object.entries(D.COMPANION_REACTIONS)) {
    h(3, kind); for (const [mood, words] of Object.entries(reactions)) li(mood, `{name} ${words}`);
  }

  h(2, 'Voices in the deep');
  h(3, 'Wick, of the Lampfolk (WICK)');
  for (const [k, s] of Object.entries(D.WICK.says)) li(k, s);
  D.WICK.tales.forEach((t, i) => li(`tale ${i + 1}`, t));
  li('done', D.WICK.done); end();
  h(3, 'The keepers of the Heart (MONSTERS, speech)');
  for (const m of Object.values(D.MONSTERS)) if (m.speech) li(m.name, m.speech);
  end();
  h(3, 'The champions (MONSTERS, named)');
  for (const m of Object.values(D.MONSTERS)) if (m.named) {
    const n = m.named;
    out.push(`**${n.called} the ${m.name}**`, '');
    li('on arriving', n.arrive); li('waking', n.wake); li('falling', n.fall); end();
  }

  h(2, 'Encounters (ENCOUNTERS)');
  for (const [id, e] of Object.entries(ENCOUNTERS)) {
    h(3, `${e.title} (${id})`);
    p(e.text);
    for (const c of e.choices) {
      out.push(`- **${md(c.label)}**`);
      if (c.outcome && c.outcome.text) out.push(`  - ${md(c.outcome.text)}`);
      if (c.pass && c.pass.text) out.push(`  - *passed*: ${md(c.pass.text)}`);
      if (c.fail && c.fail.text) out.push(`  - *failed*: ${md(c.fail.text)}`);
    }
    end();
  }

  h(2, 'The endings (ENDINGS)');
  for (const [id, e] of Object.entries(D.ENDINGS)) {
    h(3, `${e.title} (${id})`);
    li('in the Hall', e.hall); li('what they did', e.did);
    e.lift.forEach((s, i) => li(`lifting it, ${i + 1}`, s));
    li('the last line', e.out);
    e.epi.forEach((s, i) => li(`the story after, ${i + 1}`, s));
    end();
  }

  h(2, 'What the Bestiary knows (BESTIARY)');
  for (const [id, b] of Object.entries(D.BESTIARY)) li((D.MONSTERS[id] && D.MONSTERS[id].name) || id, b.lore);
  end();

  h(2, 'First-moment tips (tips.js)');
  for (const [id, t] of Object.entries(TIPS)) li(id, typeof t === 'function' ? t(false) : t);
  end();

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

/** Whether docs/NARRATIVE.md says what the tables say now. */
export async function narrativeCurrent() {
  let have = '';
  try { have = readFileSync(OUT, 'utf8'); } catch (e) { /* not written yet */ }
  return have === await narrative();
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  writeFileSync(OUT, await narrative());
  console.log(`wrote ${fileURLToPath(OUT)}`);
}
