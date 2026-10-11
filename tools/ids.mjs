// The ids the telemetry functions will count (api/_ids.js): the classes, the
// paths, the legends and the combinations, taken from the game's own tables so a
// report can be checked against them. api/ runs as plain Node on Vercel and
// cannot import the game's modules cheaply, so the list is written out, and
// test/run.js fails while it is stale: `node tools/ids.mjs` writes it again.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CLASSES, PATHS } from '../js/data.js';
import { RELICS } from '../js/relics.js';
import { COMBOS } from '../js/combos.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, '..', 'api', '_ids.js');

/** The file's text as it should be now. */
export function ids() {
  const list = (name, arr) => `  ${name}: ${JSON.stringify(arr)},`;
  return [
    "'use strict';",
    '// Written by tools/ids.mjs from the game\'s tables: do not edit by hand.',
    'module.exports = {',
    list('classes', Object.keys(CLASSES)),
    list('diffs', ['easy', 'normal', 'hard']),
    list('sizes', ['small', 'medium', 'large']),
    list('paths', Object.values(PATHS).flat().map(x => x.id)),
    list('legends', Object.keys(RELICS).filter(id => RELICS[id].legend)),
    list('combos', Object.keys(COMBOS)),
    '};',
    '',
  ].join('\n');
}
/** Whether api/_ids.js is what the tables say now. */
export function idsCurrent() {
  try { return fs.readFileSync(OUT, 'utf8') === ids(); } catch (e) { return false; }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  fs.writeFileSync(OUT, ids());
  console.log('wrote', OUT);
}
