import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { MONSTERS } from '../../../js/data.js';
const folder = new URL('.', import.meta.url);
const source = fs.readFileSync(new URL('../../../js/sound.js', import.meta.url), 'utf8');
const literal = source.match(/const READY_OF = (\{[\s\S]*?\n  \});/)[1];
const profiles = vm.runInNewContext('(' + literal + ')');
const rows = Object.entries(MONSTERS).map(([id, m]) => {
  if (typeof profiles[m.sprite] !== 'string') throw new Error('Missing material: ' + id);
  return { id, name: m.named?.called || m.name, sprite: m.sprite, material: profiles[m.sprite], champion: !!m.named, keeper: !!m.boss };
});
const result = { identities: rows.length, profiles: [...new Set(rows.map(r => r.material))].sort(), rows };
fs.writeFileSync(new URL('inventory.json', folder), JSON.stringify(result, null, 2) + '\n');
console.log(`${rows.length} identities, ${result.profiles.length} material profiles: ${fileURLToPath(folder)}`);
