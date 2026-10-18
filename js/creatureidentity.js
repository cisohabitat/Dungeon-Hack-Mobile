// Identity repairs follow the painted bestiary while retaining the 64-unit
// parts painter and its cached poses. Nothing here reads game state or dice.
import { ball, both64, hair, limb, sheet, specks, recolour, grow, turn } from './parts.js';

function slime(pose) {
  const up = pose === 'windup', y = up ? 32 : 39;
  return [ball(32, 59, 27, 4, '#193b13'), ball(32, y + 5, 24, up ? 25 : 19, '#397c20'),
    ball(25, y, 15, 15, '#65a632'), ball(21, y - 7, 8, 6, '#83bd48'),
    ...[[15, 49], [22, 57], [35, 54], [44, 44], [30, 35], [41, 57]].map(([x, yy]) => ball(x, yy, 2, 2, '#a0ca69')),
    ...[12, 19, 27, 37, 45, 51].map((x, i) => hair(x, 51 - i % 3 * 3, x + 2, 54 - i % 3 * 3, '#a7cd72')),
    ...[[9, 40], [52, 33], [45, 20], [18, 24]].flatMap(([x, yy], i) => [ball(x, yy - (up ? 6 : 0), 1.5, 2, '#6eaa3a'), specks([[x - 0.5, yy - 1 - (up ? 6 : 0)]], '#d4e3ae')])];
}

function eyeless(pose) {
  const up = pose === 'windup', skin = '#c0a9a7', dark = '#80676b';
  const out = [ball(32, 42, 16, 12, dark), ball(31, 35, 12, 13, skin),
    ...both64(limb(22, 40, 13, 50, 4, 2.5, skin)), ...both64(limb(13, 50, 18, 61, 2.5, 1.4, skin)),
    ...both64(limb(23, 32, 11, up ? 42 : 40, 3.4, 2.5, skin)), ...both64(limb(11, up ? 42 : 40, 8, 59, 2.5, 1.6, skin)),
    ...both64(ball(8, 59, 3, 1.8, skin)), ...both64(limb(18, 61, 22, 62, 1.5, 0.6, skin)),
    ball(32, up ? 20 : 24, 10, 15, skin), hair(29, up ? 12 : 16, 27, up ? 19 : 23, '#dcc8bd'),
    sheet([[25, up ? 24 : 28], [39, up ? 24 : 28], [36, up ? 38 : 36], [29, up ? 38 : 36]], '#42252b', { curve: 1 }),
    ...[27, 29, 31, 33, 35, 37].map((x, i) => limb(x, up ? 25 : 29, x + 0.3, (up ? 30 : 32) + i % 2, 0.4, 0.1, '#e1d7c5')),
    ...[29, 31, 33, 35].map(x => limb(x, up ? 37 : 35, x, up ? 33 : 33, 0.4, 0.1, '#e1d7c5'))];
  for (const side of [-1, 1]) for (let i = 0; i < 4; i++) out.push(limb(32 + side * 24, 59, 32 + side * (26 + i * 1.1), 62.5, 0.7, 0.2, skin), hair(32 + side * (7 + i), 34 + i * 3, 32 + side * (9 + i), 37 + i * 3, dark));
  return out;
}

function puffcap(pose) {
  const up = pose === 'windup';
  return [
    ...both64(limb(26, 51, 18, 62, 2.5, 1.2, '#aa9c78')), ...both64(limb(28, 55, 26, 63, 1.8, 0.8, '#b9aa84')),
    ball(32, 40, up ? 26 : 24, up ? 23 : 21, '#cbbc94'), ball(27, 32, 18, 16, '#ded1ae'),
    ...Array.from({ length: 19 }, (_, i) => { const a = i * 2.4; return ball(32 + Math.cos(a) * (8 + i % 4 * 4), 36 + Math.sin(a) * 16, 1.3 + i % 2, 1.1, '#a89166'); }),
    ...Array.from({ length: 12 }, (_, i) => hair(12 + i * 2, 47, 15 + i * 1.7, 53, '#918262')),
    ...[7, 14, 22, 41, 50, 58].flatMap((x, i) => [hair(x, 27 + i % 3 * 5, x + (up ? 4 : 2), 24 + i % 3 * 5, '#e9dba9'), specks([[x, 24 - (up ? 5 : 0)], [x + 1, 20 - (up ? 6 : 0)]], '#e9dfa9')])];
}

function mimic(pose) {
  const up = pose === 'windup', lid = up ? 7 : 16;
  return [sheet([[9, 35], [55, 35], [56, 62], [8, 62]], '#714424', { curve: 0.3 }),
    ...[13, 21, 29, 37, 45, 53].map(x => hair(x, 39, x, 61, '#392619')),
    sheet([[9, 35], [55, 35], [54, lid + 4], [48, lid], [16, lid], [10, lid + 4]], '#80502c', { curve: 0.5 }),
    sheet([[11, 35], [53, 35], [51, lid + 11], [13, lid + 11]], '#2d1015', { curve: 0.6 }),
    ...[14, 20, 26, 32, 38, 44, 50].flatMap(x => [limb(x, lid + 12, x + 1, lid + 21, 1.3, 0.2, '#ddd0a9'), limb(x, 42, x + 1, 35, 1.2, 0.2, '#d0c29e')]),
    limb(32, 39, 37, 49, 3, 2.6, '#ad6266'), limb(37, 49, 44, up ? 58 : 53, 2.6, 1.2, '#ad6266'),
    ...[13, 50].flatMap(x => [limb(x, 44, x, 61, 1.2, 1.2, '#64616a'), hair(x - 1, 46, x - 1, 59, '#a2a0a2'), ...[46, 53, 60].map(y => ball(x, y, 0.7, 0.7, '#b3aa91'))]),
    limb(8, 62, 56, 62, 1, 1, '#666168'), sheet([[29, 45], [35, 45], [35, 51], [29, 51]], '#a18d53'), ball(32, 48, 0.7, 1, '#2d2420')];
}

const DRAWERS = { slime, eyeless, puffcap, mimic };

// A long reptilian jaw and curled horns, rather than a short goblin-like
// muzzle. The head anchors match the named elder's scar and clouded eye.
export function wyrmHead(hx, hy, pose) {
  const fire = pose === 'special', bite = pose === 'windup';
  const out = [...[-1, 1].flatMap(s => [
    limb(hx + s * 7, hy - 3, hx + s * 12, hy - 9, 2.3, 1.7, '#5a2016'),
    limb(hx + s * 12, hy - 9, hx + s * 9, hy - 12, 1.7, 1.1, '#8a3622'),
    limb(hx + s * 9, hy - 12, hx + s * 7, hy - 9, 1.1, 0.3, '#a44428'),
    hair(hx + s * 11, hy - 9, hx + s * 9, hy - 11, '#c05a36')]),
    ball(hx, hy, 9, 7, '#8a3622'), ball(hx + 4, hy + 4, 9, 5, '#a44428'),
    ball(hx + 8, hy + (fire ? 12 : bite ? 12 : 9), 9, 2.6, '#5a2016'),
    ...(fire || bite ? [sheet([[hx, hy + 5], [hx + 17, hy + 5], [hx + 16, hy + 12], [hx + 3, hy + 12]], '#3e140c'), ...[2, 6, 10, 14].map(d => limb(hx + d, hy + 5.5, hx + d, hy + 8.5, 0.7, 0.2, '#dccaa0'))] : []),
    ball(hx + 9, hy + 5, 10, 3, '#a44428'),
    ball(hx + 15, hy + 4.5, 1, 0.8, '#3e140c'), ball(hx + 10, hy + 3.5, 0.9, 0.7, '#3e140c'),
    ...[-5, 5].flatMap(d => [ball(hx + d, hy - 1, 1.9, 1.1, '#ffb020', { glows: true }), hair(hx + d, hy - 2, hx + d, hy, '#2a0c04')]),
    limb(hx - 8, hy - 4, hx - 3, hy - 2.5, 1.3, 0.8, '#5a2016'), limb(hx + 2, hy - 3, hx + 7, hy - 4, 1.3, 0.8, '#5a2016'),
    ...[0, 3, 6, 9, 12].map(d => hair(hx + d, hy + 2, hx + d + 1, hy + 4, '#6a2618')),
    hair(hx + 1, hy - 5, hx + 4, hy - 3, '#c05a36')];
  if (fire) out.push(ball(hx + 7, hy + 9, 4, 2.6, '#f09050', { glows: true }), ball(hx + 7, hy + 9, 2, 1.6, '#ffd060', { glows: true }));
  return out;
}
const PALETTES = {
  zombie: { '#4e5a78': '#68523d', '#323c54': '#403529', '#8fa27a': '#a1957c', '#5f6e4e': '#716451' },
  bat: { '#4a3c5c': '#74472e', '#6a5a7e': '#a66c40', '#2e2440': '#38231c', '#5a4c70': '#644632', '#3a2e4a': '#39281f' },
  acolyte: { '#5a1416': '#24202b', '#842a26': '#39303e', '#2e0a0c': '#13121a', '#3e0c10': '#1b1823' },
  moth: { '#d8ccb0': '#e5c875', '#b0a284': '#a88846', '#a89a7c': '#b99249', '#c8bca0': '#cead61', '#8a7e66': '#877044' },
  basilisk: { '#62703f': '#806947', '#7a8a50': '#a28a5d', '#77834e': '#927b53', '#4a5436': '#564731', '#3e4826': '#423723' },
  lich: { '#6a1218': '#28212d', '#3a080c': '#14121c', '#9a2a2a': '#48404c', '#c89a3a': '#a18443' },
};

export function alignCreature(id, parts, pose) {
  if (DRAWERS[id]) { const parts = DRAWERS[id](pose); return id === 'mimic' ? turn(grow(parts, 32, 63, 1.15, 0.95), 32, 62, 4) : parts; }
  let out = PALETTES[id] ? recolour(parts, PALETTES[id]) : parts;
  if (id === 'skeleton') {
    const x = pose === 'windup' ? 12.4 : 22.7, y = pose === 'windup' ? 27.8 : 35.6;
    out = [...out, sheet([[28, 5], [28, 2], [31, 0.5], [34, 0.5], [36, 2], [36, 5]], '#6e5b3b', { curve: 0.6 }),
      ...[29, 32, 35].map(px => hair(px, 2, px, 4, '#aa9161')),
      limb(x - 7, y, x, y, 0.8, 0.8, '#8c7350'),
      sheet([[x - 12, y - 5], [x - 4, y - 8], [x - 2, y + 10], [x - 7, y + 15], [x - 13, y + 8]], '#57432a'),
      ...[x - 10, x - 7, x - 4].map(px => hair(px, y - 4, px + 1, y + 8, '#8c7350'))];
  }
  if (id === 'lookout') out = [sheet([[18, 27], [46, 27], [59, 47], [50, 45], [48, 53], [39, 45], [25, 45], [16, 53], [14, 45], [5, 47]], '#4e4933', { curve: 0.7 }), ...out];
  if (id === 'rustmaw') { const dy = pose === 'windup' ? -5 : 0; out = [...out, ...[-1, 1].flatMap(side => [limb(32 + side * 5, 43 + dy, 32 + side * 14, 8, 0.6, 0.3, '#a87736'), ...Array.from({ length: 10 }, (_, i) => { const y = 10 + i * 2.6, x = 32 + side * (14 - i * 0.7); return hair(x, y, x + side * (3 + i % 3), y - 3, '#c18d44'); })])]; }
  if (id === 'imp') out = [...both64(sheet([[27, 34], [15, 17], [5, 13], [8, 37], [17, 32], [20, 41]], '#87442f', { curve: 0.6 })), ...both64(hair(6, 15, 23, 35, '#c48254')), ...out];
  if (id === 'lich') out = [sheet([[21, 23], [24, 8], [30, 1], [36, 1], [41, 8], [44, 23]], '#211c28', { curve: 1 }), ...out];
  if (id === 'wraith') out = [...out, ball(32, 13, 5.2, 6.2, '#a49aaf'), ball(32, 18.5, 3.6, 2.2, '#756b84'), ...[28.8, 35.2].flatMap(x => [ball(x, 12.8, 1.7, 1.6, '#21162d'), ball(x, 12.8, 0.6, 0.6, '#b4f0ff', { glows: true })]), sheet([[31, 15], [33, 15], [32, 13.5]], '#35283e'), ...[29, 30.5, 32, 33.5, 35].map(x => hair(x, 18, x, 20, '#43334e'))];
  if (id === 'acolyte') {
    const x = pose === 'special' ? 50.4 : pose === 'windup' ? 37.5 : 36.2;
    const y = pose === 'special' ? 5.4 : 28;
    const sx = pose === 'special' ? x : x + 10, sy = pose === 'special' ? 3.5 : y - 22;
    out = [limb(x - (sx - x), Math.min(62, y + 28), sx, sy, 0.9, 0.9, '#605044'), ball(sx, sy, 2.5, 2.6, '#c4b393'), ...[sx - 0.9, sx + 0.9].map(ex => ball(ex, sy, 0.5, 0.7, '#29212d')), ...out];
  }
  return out;
}
