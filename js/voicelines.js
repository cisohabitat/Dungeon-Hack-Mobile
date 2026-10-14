// The written story is also the recording script. Names chosen by a player
// remain on the page; in a recording the hero and their companion go unnamed.
import { BACKGROUNDS, JOURNAL, THEMES, PROLOGUE } from './data.js';
import { RELICS } from './relics.js';
import { hashSeed } from './rng.js';

export const voiceId = text => 'line-' + hashSeed(text).toString(16).padStart(8, '0');
export const backgroundText = id => BACKGROUNDS[id] ? `${BACKGROUNDS[id].story} ${BACKGROUNDS[id].motive}` : '';
export const pageText = i => JOURNAL[i] ? `${JOURNAL[i].title}. ${JOURNAL[i].text}` : '';
export const relicText = id => RELICS[id] ? `${RELICS[id].name}. ${RELICS[id].lore}` : '';

/** The clauses of an epilogue, with personal names and exact counts kept on the page. */
export function endingSpeech(lines, G) {
  return lines.flatMap(raw => {
    let text = raw;
    const name = G.player.name;
    if (name && [' came up', ' never came up', ' got as far', ' fell on floor', ' will not lie quiet'].some(s => text.startsWith(name + s))) text = 'The hero' + text.slice(name.length);
    if (G.companion && G.companion.name) text = text.split(' called ' + G.companion.name).join('');
    if (G.rested) text = text.split('they found ' + G.rested + ',').join('they found an earlier delver,');
    text = text.replace(/as far as floor \d+/g, 'as far as the deep floors')
      .replace(/on floor \d+/g, 'in the depths')
      .replace(/left \d+ of/g, 'left some of').replace(/carrying \d+ of/g, 'carrying some of');
    return text.split('; ').map(t => {
      const clean = t.trim().replace(/[.;]$/, '');
      return clean.charAt(0).toUpperCase() + clean.slice(1) + '.';
    });
  });
}

/** The fixed readings; the production tool adds every ending's possible clauses. */
export function fixedReadings() {
  const out = [{ id: 'prologue', text: PROLOGUE.join(' '), title: 'Karrathal', kind: 'prologue' }];
  const add = (text, title, kind) => out.push({ id: voiceId(text), text, title, kind });
  for (const [id, b] of Object.entries(BACKGROUNDS)) add(backgroundText(id), b.name, 'background');
  JOURNAL.forEach((p, i) => add(pageText(i), p.title, 'page'));
  THEMES.forEach(t => add(t.flavor, t.name, 'region'));
  for (const [id, r] of Object.entries(RELICS)) add(relicText(id), r.name, 'relic');
  return out;
}
