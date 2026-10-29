// Regional versions of existing scenery. Only the picture changes: the saved
// dressing, its footprint and its height remain the same, and nothing blocks play.
import { ball, hair, limb, sheet, specks } from './parts.js';

const stone = '#8a8070', shade = '#494640', iron = '#54565a', edge = '#929084';
export const REGIONAL_PROPS = {
  crypt_lid: () => [
    sheet([[8, 49], [40, 40], [56, 49], [25, 61]], shade),
    sheet([[8, 46], [39, 37], [56, 46], [25, 57]], stone),
    limb(11, 46, 38, 39, 0.6, 0.6, '#b0a48c'),
    hair(28, 42, 33, 46, shade), hair(33, 46, 27, 51, shade),
    hair(27, 51, 31, 55, shade), hair(21, 46, 40, 41, '#605b50'),
    ...[0, 1, 2].map(i => hair(24 + i * 3, 48 + i * 1.5, 40 + i * 3, 43 + i * 1.5, '#605b50')),
    ball(14, 59, 5, 2, shade), ball(48, 57, 7, 3, stone),
    specks([[11, 61], [40, 61], [53, 59], [19, 58]], '#a3977e'),
  ],
  iron_scrap: () => [
    ball(31, 56, 20, 6, '#303236'), ball(31, 54, 17, 5, iron),
    ...Array.from({ length: 10 }, (_, i) => {
      const a = i * Math.PI / 5, x = 31 + Math.cos(a) * 20, y = 54 + Math.sin(a) * 6;
      return limb(x - 2, y, x + 2, y, 2, 2, i < 5 ? iron : edge);
    }),
    ball(31, 54, 10, 3.5, '#24262a'), ball(31, 54, 5, 2, edge),
    limb(10, 60, 49, 42, 1.4, 1.4, '#4c4e52'), hair(11, 59, 48, 41, '#85888c'),
    ball(48, 44, 6, 3, iron), ball(48, 44, 3, 1.4, '#24262a'),
    specks([[20, 54], [38, 58], [43, 48], [13, 60]], '#a46a3c'),
  ],
  roots: () => [
    ball(32, 61, 23, 2.5, '#333424'),
    ...[[12, 60, 30, 44], [30, 44, 45, 60], [30, 44, 49, 48], [21, 52, 9, 50], [37, 51, 53, 55]].flatMap(([x, y, xx, yy]) => [
      limb(x, y, xx, yy, 1.8, 0.8, '#62583a'), hair(x, y - 0.7, xx, yy - 0.7, '#85805a'),
    ]),
    limb(30, 45, 29, 32, 3, 2, '#4a482e'),
    sheet([[25, 34], [28, 25], [30, 33], [33, 29], [33, 39]], '#62583a'),
    ...[[13, 47], [46, 45], [39, 53]].map(([x, y]) => sheet([[x, y + 6], [x - 4, y], [x + 3, y + 1]], '#667446')),
    specks([[20, 60], [37, 61], [48, 59]], '#82905c'),
  ],
  reed_bundle: () => [
    ball(32, 61, 19, 2, '#343c26'),
    ...[18, 23, 28, 33, 38, 43, 48].flatMap((x, i) => [
      limb(31 + (x - 32) * 0.6, 62, x, 32 + i % 3 * 6, 0.7, 0.4, i % 2 ? '#89805a' : '#687044'),
      sheet([[x, 46], [x - 5, 35], [x - 1, 38]], '#5c6a3c'),
    ]),
    limb(24, 54, 40, 54, 0.7, 0.7, '#a08c5c'), hair(25, 53, 39, 53, '#c0aa70'),
    specks([[15, 60], [43, 62], [51, 61]], '#6a7044'),
  ],
  elf_shards: () => [
    ...[[10, 61, 22, 44, 30, 59], [29, 62, 41, 38, 49, 57], [44, 62, 52, 51, 58, 61]].flatMap(([x, y, a, b, c, d]) => [
      sheet([[x, y], [a, b], [c, d]], '#3f384e'), hair(x + 2, y - 1, a, b + 1, '#9a82b4'), hair(a, b + 2, c - 2, d, '#645674'),
    ]),
    specks([[16, 62], [35, 61], [54, 62]], '#807092'),
  ],
};

export function regionalProp(theme, kind, fallen = false) {
  // A cave-in's new stones must still match the rocks seen falling.
  if (fallen) return kind;
  if (kind === 'rubble') {
    if (theme.road === 'crypts' || /Catacombs|Crypts/.test(theme.name)) return 'crypt_lid';
    if (theme.region === 'forge') return 'anvil';
    if (theme.people === 'dwarves') return 'iron_scrap';
    if (theme.people === 'elves' || theme.face === 'glass' || theme.name === 'Blue Vaults') return 'elf_shards';
    if (theme.name === 'Mossy Depths' || theme.road === 'warrens') return 'roots';
  }
  if (kind === 'mushrooms' && theme.people === 'marsh') return 'reed_bundle';
  return kind;
}
