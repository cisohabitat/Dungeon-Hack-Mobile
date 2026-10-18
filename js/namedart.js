// Named treasure keeps its history in its shape, not just its rarity edge.
// All coordinates share itemart's grid and grips; nothing here draws run dice.
import { ITEM_ART } from './itemart.js';
import { ITEMS } from './data.js';
import { RELICS } from './relics.js';
import { ball, limb, sheet, hair } from './creatures.js';

const at = (s, o = 0) => [4 + (s + o) * Math.SQRT1_2, 28 + (o - s) * Math.SQRT1_2];
const rod = (a, b, w, c, o = 0) => limb(...at(a, o), ...at(b, o), w, w, c);
const cross = (s, w, c) => limb(...at(s, -w), ...at(s, w), 0.7, 0.7, c);
const gem = (s, c, r = 1.3) => ball(...at(s), r, r, c);
const ring = (x, y, r, c, w = 0.65) => Array.from({ length: 16 }, (_, i) => {
  const a = i * Math.PI / 8, b = (i + 1) * Math.PI / 8;
  return limb(x + Math.cos(a) * r, y + Math.sin(a) * r, x + Math.cos(b) * r, y + Math.sin(b) * r, w, w, c);
});
const ray = (x, y, r, c, n = 8) => Array.from({ length: n }, (_, i) => {
  const a = i * Math.PI * 2 / n;
  return limb(x + Math.cos(a) * r, y + Math.sin(a) * r, x + Math.cos(a) * (r + 2.4), y + Math.sin(a) * (r + 2.4), 0.7, 0.25, c);
});
const leaf = (x, y, c) => sheet([[x, y + 2.4], [x - 2, y], [x - 0.6, y - 2.7], [x + 2, y - 1]], c);
const crack = (c, points) => points.slice(1).map((p, i) => hair(...points[i], ...p, c));
const blade = (end, width, c, guard = '#777d88') => [rod(2, 10, 1.3, '#40363a'), cross(10, 3, guard),
  sheet([at(11, -width), at(end - 3, -width), at(end), at(end - 3, width), at(11, width)], c),
  hair(...at(12, -width * 0.5), ...at(end - 3, -width * 0.5), '#d8dce4')];
const staff = (c, head) => [rod(0.5, 29, 1.05, c), rod(2, 9, 1.4, '#4e3628'), ...head];
const bow = (c, horn, long = true) => {
  const x = long ? 7 : 9, belly = long ? 18 : 22;
  return [limb(x, 2, belly, 16, 1, 1.5, c), limb(belly, 16, x, 30, 1.5, 1, c),
    limb(x, 2, x + 1.6, 5, 0.8, 0.7, horn), limb(x + 1.6, 27, x, 30, 0.7, 0.8, horn),
    hair(x, 2, x, 30, '#d6c9b2'), limb(belly, 13, belly, 19, 1.5, 1.5, '#40302a'),
    hair(3, 16, 28, 16, '#b49c72'), sheet([[27, 14], [31, 16], [27, 18]], '#d4dce4')];
};
const axe = (c, banners = false) => [rod(0.6, 29, 1.1, '#6b4130'),
  sheet([at(21, -2), at(19, -9), at(24, -13), at(29, -11), at(27, -5), at(25, -2)], c),
  sheet([at(21, 2), at(19, 7), at(24, 10), at(28, 8), at(25, 2)], c), cross(24, 2.3, '#c6a56a'),
  ...(banners ? ['#aa3042', '#c7a451', '#557a99'].map((c, i) => sheet([at(4 + i * 3, 1), at(5 + i * 3, 1), at(3 + i * 3, 5 + i), at(2 + i * 3, 3)], c)) : [])];
const hammer = () => [rod(0.5, 23, 1.2, '#8a5732'), cross(6, 1.6, '#d8b359'),
  sheet([at(20, -6), at(26, -6), at(27, 5), at(21, 5)], '#d3a246'),
  ...ray(...at(23, -0.5), 2, '#ffe5a0'), gem(23, '#fff2bd', 1.8)];
const torc = () => [...ring(16, 17, 10, '#ccd7de', 1.3).slice(0, 13),
  ball(26, 17, 2, 2, '#f0eee0'), ball(20, 8, 2, 2, '#f0eee0'),
  ...[0, 1, 2, 3, 4].map(i => hair(7 + i * 2.4, 22 + Math.sin(i) * 2, 8 + i * 2.4, 25 + Math.sin(i) * 2, '#8294aa'))];
const base = id => ITEM_ART[ITEMS[RELICS[id].t].sprite]();

// Each entry is deliberately authored: shared bases remain recognisable, while
// the sunburst, gatehouse, banners, briars and other marks belong to their lore.
const NAMED_ART = {
  grimtooth: () => [...blade(29, 1.7, '#a4aa8d'), ...[15, 18, 21, 24].map(s => cross(s, 1.8, '#433a30')), gem(3, '#7a943f')],
  whisper: () => [...blade(32, 1.4, '#727984'), ...[3, 5, 7, 9].map(s => cross(s, 1.7, '#a5a3a6')), cross(10, 3.5, '#99979c')],
  thirst: () => [...blade(35, 1.7, '#62606c', '#863b47'), rod(14, 30, 0.45, '#742b3c'), gem(3, '#b83c4c')],
  dawnbringer: () => [rod(1, 22, 1.3, '#775031'), ...ray(...at(25), 3.4, '#d4b056'), gem(25, '#f3dca0', 3.2)],
  penitent: () => [...base('penitent'), ...[12, 15, 18].map(s => gem(s, '#c4ac7b', 0.9)), cross(7, 3, '#d7c294'), rod(5, 9, 0.5, '#d7c294')],
  ogres_toll: () => [...axe('#a4adb6'), ...[8, 10, 12, 14, 16].map(s => cross(s, 1.2, '#e0c99e'))],
  ninth_circle: () => staff('#43343a', Array.from({ length: 9 }, (_, i) => cross(11 + i * 2, 1.6, '#181c29'))),
  emberwood: () => staff('#744027', [...crack('#f5a14c', [at(17), at(21, 0.5), at(24, -0.7), at(28)]), gem(29, '#ec9944', 1.6)]),
  vashti: () => [rod(9, 15, 0.9, '#45414c'), cross(15, 1.5, '#c4ac7b'), sheet([at(15, -0.9), at(26, -0.9), at(30), at(26, 0.9), at(15, 0.9)], '#e3e7ec'), ...[0, 1].flatMap(i => [hair(10 + i * 4, 25, 24 + i * 3, 9, '#b8c1cc'), ball(10 + i * 4, 25, 0.8, 0.8, '#c49d62')])],
  heartseeker: () => [...bow('#87503b', '#eee0bd', false), sheet([[21, 11], [23, 13], [21, 16], [19, 13]], '#b54a51')],
  rustwarden: () => [...base('rustwarden'), ...[[12, 13], [20, 13], [16, 20]].flatMap(([x, y]) => [hair(x - 1, y, x + 1, y, '#d6d3a7'), hair(x, y - 1, x, y + 2, '#d6d3a7')])],
  shadowskin: () => [...base('shadowskin').map(p => ({ ...p, c: '#282d3b' })), sheet([[9, 7], [5, 11], [3, 18], [7, 16], [11, 9]], '#393e4c'), hair(16, 12, 16, 25, '#606979')],
  briarcoat: () => [...base('briarcoat'), ...[[8, 10], [24, 10], [9, 19], [23, 19]].map(([x, y]) => sheet([[x - 1, y], [x + 1, y], [x + (x < 16 ? -3 : 3), y - 3]], '#aeb1a1'))],
  kests_bulwark: () => [...base('kests_bulwark'), sheet([[12, 11], [20, 11], [20, 20], [16, 25], [12, 20]], '#8b3c36'), ...crack('#ded3ac', [[13, 19], [16, 19], [16, 16], [19, 16], [19, 13]])],
  sisters_buckler: () => [...base('sisters_buckler'), ...ring(16, 16, 7.5, '#dfe4e1'), ...[12, 20].map(x => leaf(x, 16, '#ceded9'))],
  hearthwool: () => [...base('hearthwool'), limb(9, 9, 23, 9, 1.7, 1.7, '#e1d7bd'), ...[8, 12, 16, 20, 24].map(x => ball(x, 28, 1.4, 1.2, '#d8ccb0'))],
  archivist: () => [...base('archivist'), ...[[10, 15], [20, 15], [9, 23], [21, 23]].map(([x, y]) => sheet([[x, y], [x + 3, y], [x + 3, y + 3], [x, y + 3]], '#8b7057')), hair(9, 17, 11, 18, '#242535')],
  midnight_folio: () => [...base('midnight_folio').map(p => ({ ...p, c: '#282a40' })), ...ring(17, 15, 4.5, '#bfc6e2'), hair(13, 22, 23, 18, '#bfc6e2')],
  sparkglass: () => [...base('sparkglass'), ...crack('#f5e1a4', [[15, 6], [13, 11], [18, 15], [15, 22]]), ball(15, 12, 1, 1, '#fff5cb')],
  boarspear: () => [...base('boarspear'), cross(24, 4.6, '#b6bcc4'), ...[12, 15, 18].map(s => cross(s, 1.2, '#dbbf8c'))],
  galewind: () => [...bow('#ac895c', '#e5e6cd'), ...[8, 23].map(y => leaf(14, y, '#ddd8ac'))],
  sextons_locket: () => [...base('sextons_locket'), ball(16, 22, 4, 5, '#a79874'), ...ring(16, 22, 3, '#dfcda5'), hair(16, 20, 16, 24, '#d8d8d1')],
  oakheart: () => staff('#735334', [limb(...at(23), ...at(30, -3), 1, 0.5, '#735334'), limb(...at(24), ...at(31, 2), 1, 0.4, '#735334'), leaf(...at(28, -3), '#7c9751')]),
  mossmantle: () => [...base('mossmantle'), ...[[7, 10], [11, 8], [22, 9], [25, 12], [8, 24], [22, 25]].map(([x, y]) => leaf(x, y, '#6d8747'))],
  cinder_ring: () => [...ring(16, 19, 8, '#45414a', 1.6), ...crack('#eaae66', [[10, 13], [13, 11], [16, 12], [20, 11], [22, 15]])],
  spider_pendant: () => [...base('spider_pendant'), ball(14.5, 21, 0.7, 0.7, '#c64b68'), ball(17.5, 21, 0.7, 0.7, '#c64b68')],
  thane_ring: () => [...base('thane_ring'), ...crack('#d3935c', [[9, 15], [13, 17], [16, 15], [20, 18], [23, 16]])],
  hissra_tooth: () => [...base('hissra_tooth'), hair(14, 18, 18, 19, '#715a34'), hair(14, 20, 17.5, 21, '#715a34')],
  warchiefs_knuckle: () => [...ring(16, 19, 7, '#777780', 1.6), ...[10, 16, 22].map(x => sheet([[x - 1.7, 13], [x + 1.7, 13], [x, 7]], '#978677'))],
  bastion: () => [sheet([[5, 4], [27, 4], [27, 29], [5, 29]], '#626a73'), sheet([[8, 7], [24, 7], [24, 27], [8, 27]], '#453b34'),
    ...[9, 16, 24].map(y => limb(6, y, 26, y, 0.9, 0.9, '#b69b69')), ...[10, 22].map(x => limb(x, 5, x, 28, 0.6, 0.6, '#9d8d72')), ball(21, 19, 1.2, 1.2, '#d0b67f')],
  red_harvest: () => axe('#944350', true),
  sunhammer: hammer,
  lantern_mercy: () => [...ray(16, 16, 6.5, '#dbc28c'), ...ring(16, 16, 5.8, '#e1d5af'), ball(16, 16, 3.4, 4.4, '#fff0c3'), limb(13, 25, 19, 25, 0.8, 0.8, '#b99859')],
  cinderheart: () => [ball(16, 15, 10, 10, '#33303c'), ...crack('#eb7947', [[11, 7], [15, 12], [12, 17], [19, 20], [20, 24]]),
    ...crack('#d84b3d', [[24, 12], [19, 13], [18, 17], [12, 17], [8, 20]]), ball(15, 15, 2, 2, '#ffc68b'), sheet([[7, 29], [11, 24], [21, 24], [25, 29]], '#977650')],
  rimebound: () => [...base('rimebound').map(p => ({ ...p, c: '#698aaf' })), sheet([[7, 10], [11, 3], [12, 11]], '#c5e4eb'), sheet([[23, 23], [28, 18], [26, 29]], '#b3d9e6'),
    ...crack('#e0f4ef', [[14, 10], [21, 18], [16, 19], [23, 23]]), ...crack('#e0f4ef', [[21, 9], [13, 22]])],
  last_word: () => blade(28, 1.15, '#828996', '#656b77'),
  motley: () => [...base('motley'), ...[[8, 11], [18, 11], [11, 18], [20, 21]].map(([x, y], i) => sheet([[x, y], [x + 4, y - 1], [x + 5, y + 4], [x + 1, y + 5]], ['#aa5861', '#748eab', '#b89c61', '#718366'][i])),
    sheet([[6, 8], [3, 15], [9, 12]], '#aa5861'), sheet([[25, 8], [29, 15], [23, 12]], '#748eab')],
  farstrider: () => [...bow('#302c38', '#bdc6cf'), ...[7, 25].map(y => sheet([[11, y], [15, y - 2], [15, y + 1]], '#8c969e'))],
  thornbinder: () => [...base('thornbinder'), ...[5, 11, 17, 23].flatMap(s => [rod(s, s + 3, 0.65, '#73824c', 1.4), sheet([at(s, 1), at(s + 2, 1), at(s + 1, 4)], '#8d9c61')])],
  moonbound: torc,
  heartroot: () => staff('#744d35', [limb(...at(23), ...at(31, -4), 1.5, 0.4, '#744d35'), limb(...at(24), ...at(32, 3), 1.3, 0.3, '#744d35'),
    gem(27, '#c68167', 2), leaf(...at(30, -3), '#83a05e'), leaf(...at(31, 3), '#628947')]),
};
const namedSprite = id => Object.hasOwn(RELICS, id) ? (RELICS[id].legend ? 'legend_' : 'relic_') + id : null;
const NAMED_IDS = Object.fromEntries(Object.keys(NAMED_ART).map(id => [namedSprite(id), id]));
const namedId = sprite => Object.hasOwn(NAMED_IDS, sprite) ? NAMED_IDS[sprite] : null;
const namedBase = sprite => { const id = namedId(sprite); return id ? ITEMS[RELICS[id].t].sprite : sprite && sprite.replace(/^(relic|legend)_/, ''); };
export { NAMED_ART, namedSprite, namedId, namedBase };
