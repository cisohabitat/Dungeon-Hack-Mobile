// Read-only coverage inventory; run from the repository root. Not a visual sign-off.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { PAINTED } from '../../../js/paintedcatalog.js';
import { CREATURES, CHAMPION_OF, SHADE_GEAR, POSES } from '../../../js/creatures.js';
import { ITEM_ART } from '../../../js/itemart.js';
import { DRESSING } from '../../../js/dressing.js';
import { REGIONAL_PROPS } from '../../../js/regionalprops.js';
import { PROPS } from '../../../js/props.js';
import { CLASSES, MONSTERS, THEMES, SPRITES } from '../../../js/data.js';
import { RELICS } from '../../../js/relics.js';
import { COMPANIONS } from '../../../js/companionbook.js';
import { NAMED_ART, namedSprite } from '../../../js/namedart.js';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const read = path => fs.readFileSync(root + path);
const sw = read('sw.js').toString(), issues = [];
const verifyPath = path => {
  if (!fs.existsSync(root + path)) issues.push('Missing file: ' + path);
  if (!sw.includes(`'./${path}'`)) issues.push('Missing offline entry: ' + path);
};
const delivery = JSON.parse(read('art/creatures/runtime-delivery.json')).files;
for (const row of delivery) {
  verifyPath(row.runtime);
  if (createHash('sha256').update(read(row.runtime)).digest('hex') !== row.sha256) issues.push('Delivery hash: ' + row.runtime);
}
const buckets = { items: Object.keys(ITEM_ART), encounters: Object.keys(PROPS), dressing: Object.keys({ ...DRESSING, ...REGIONAL_PROPS }).map(k => 'dress_' + k), namedItems: Object.keys(NAMED_ART).map(namedSprite) };
const staticCoverage = Object.fromEntries(Object.entries(buckets).map(([k, keys]) => [k, { total: keys.length, painted: keys.filter(key => PAINTED.static[key]).length, exceptions: keys.filter(key => !PAINTED.static[key]) }]));
const expectedReserves = ['amulet_tooth', 'key'];
if (JSON.stringify(staticCoverage.items.exceptions.slice().sort()) !== JSON.stringify(expectedReserves)) issues.push('Unreviewed item exception');
for (const k of ['encounters', 'dressing', 'namedItems']) if (staticCoverage[k].exceptions.length) issues.push('Unpainted ' + k);
const traders = ['merchant', 'wick', 'pedlar'];
const identities = Object.keys(CREATURES).filter(k => !traders.includes(k));
const routes = identities.map(id => ({ id, base: id, poses: ['idle', ...(POSES[id] || [])] }));
for (const [id, base] of Object.entries(CHAMPION_OF)) routes.push({ id, base, elite: id, poses: ['idle', ...(POSES[base] || [])] });
for (const cls of Object.keys(SHADE_GEAR)) routes.push({ id: 'shade_' + cls, base: 'shade', elite: 'shade_' + cls, poses: ['idle', ...POSES.shade] });
for (const row of routes) verifyPath(`img/creatures/${row.id}.webp`);
const variants = Object.keys(PAINTED.atlases).filter(id => !routes.some(r => r.id === id) && id !== 'mender-heal');
for (const id of variants) verifyPath(PAINTED.atlases[id]);
const portraits = {
  living: Object.keys(CLASSES).map(k => `img/portraits/${k}.webp`),
  fallen: Object.keys(CLASSES).map(k => `img/portraits/fallen/${k}.webp`),
  bestiary: Object.keys(MONSTERS).map(k => ['lich', 'heartforged', 'warlord'].includes(k) ? `img/bosses/${k}.webp` : `img/bestiary/${k}.webp`),
  companions: Object.keys(COMPANIONS).map(k => `img/companions/${k}.webp`),
  relics: Object.keys(RELICS).map(k => `img/relics/${k}.webp`),
};
for (const paths of Object.values(portraits)) for (const path of paths) verifyPath(path);
const themes = THEMES.map((t, i) => {
  const keys = ['wall', 'wallB', 'wallDamp', 'wallCracked', 'floor', 'ceiling', 'door', 'cellDoor', 'pillar', 'stairsUp', 'stairsDown', 'stairsUpBack', 'stairsDownBack', 'rock', 'fallen', 'rockPillar', 'fountain', 'fountainDry', ...Array.from({length: 6}, (_, n) => 'floor' + (n + 1)), ...Array.from({length: 3}, (_, n) => 'ceil' + (n + 1)), ...Array.from({length: 3}, (_, n) => 'torch' + n), ...t.decor.map((_, n) => 'decor' + n)];
  const missing = keys.filter(k => !PAINTED.themes[i][k]);
  if (missing.length) issues.push('Theme coverage ' + i + ': ' + missing.join(','));
  return { index: i, name: t.name, painted: Object.keys(PAINTED.themes[i]).length, missing, arch: i === 0 ? 'native exact-alpha arch retained' : 'painted surface composed within native alpha' };
});
const result = {
  revision: (await promisify(execFile)('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' })).stdout.trim(),
  scope: 'Declared source-to-runtime coverage, file hashes and offline declarations; native selection, decode and visual review are separate evidence.',
  catalog: Object.fromEntries(Object.entries(PAINTED).map(([k, v]) => [k, Object.keys(v).length])),
  deliveryFiles: delivery.length, staticCoverage, traders, creatureRoutes: routes, variants, themes, portraits,
  legacyOnly: Object.keys(SPRITES).filter(k => !CREATURES[k] && !ITEM_ART[k] && !PROPS[k]),
  issues,
};
fs.writeFileSync(new URL('inventory.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ revision: result.revision, catalog: result.catalog, deliveryFiles: delivery.length, staticCoverage, creatureIdentities: routes.length, creaturePoseRoutes: routes.reduce((n, r) => n + r.poses.length, 0), variants, portraits: Object.fromEntries(Object.entries(portraits).map(([k,v]) => [k,v.length])), issues }, null, 2));
if (issues.length) process.exitCode = 1;
