// These hashes record a visual review, not an automated judgement of anatomy.
// Re-export and inspect changed paintings before updating art/review.json.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MONSTERS, CLASSES } from '../js/data.js';
import { RELICS } from '../js/relics.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const review = JSON.parse(readFileSync(resolve(root, 'art/review.json'), 'utf8'));
const identity = JSON.parse(readFileSync(resolve(root, 'art/identity.json'), 'utf8'));
const relics = JSON.parse(readFileSync(resolve(root, 'art/relics/generation.json'), 'utf8')).portraits;
if (JSON.stringify(Object.keys(relics).sort()) !== JSON.stringify(Object.keys(RELICS).sort())) {
  throw new Error('Relic portrait coverage is incomplete.');
}
for (const id of Object.keys(RELICS)) {
  if (!review.sha256[`img/relics/${id}.webp`]) throw new Error(`${id}: missing reviewed relic portrait.`);
}
for (const [label, table] of [['monsters', MONSTERS], ['heroes', CLASSES]]) {
  const expected = Object.keys(table).sort(), reviewed = Object.keys(identity[label]).sort();
  if (JSON.stringify(expected) !== JSON.stringify(reviewed)) throw new Error(`${label}: painted/sprite identity review is incomplete.`);
  if (reviewed.some(id => typeof identity[label][id] !== 'string' || identity[label][id].length < 20)) throw new Error(`${label}: missing visual identity notes.`);
}
const files = directory => readdirSync(resolve(root, directory), { withFileTypes: true })
  .flatMap(entry => entry.isDirectory() ? files(`${directory}/${entry.name}`)
    : /\.(png|webp|svg)$/.test(entry.name) ? [`${directory}/${entry.name}`] : []);
const current = [...files('art'), ...files('img'), ...files('icons')].sort();
const recorded = Object.keys(review.sha256).sort();
if (JSON.stringify(current) !== JSON.stringify(recorded)) throw new Error('Art inventory changed; review new or removed images.');
const worker = readFileSync(resolve(root, 'sw.js'), 'utf8');
for (const path of current) {
  const digest = createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex');
  if (digest !== review.sha256[path]) throw new Error(`${path} changed since its visual review; check source and export together.`);
  if (/^(img|icons)\//.test(path) && !worker.includes(`'./${path}'`)) throw new Error(`${path} is missing from the offline cache.`);
}
console.log(`Art review current: ${current.filter(p => p.startsWith('img/')).length} shipped paintings and ${current.filter(p => p.startsWith('icons/')).length} app icons, all cached offline.`);

console.log(`Identity coverage: ${Object.keys(identity.monsters).length} bestiary entries and ${Object.keys(identity.heroes).length} classes reviewed against their paintings.`);
