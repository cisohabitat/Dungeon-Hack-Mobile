// The same heroes as img/portraits: the painted face and its fallback
// must agree even while an image is loading or cannot be fetched.
import { ball, both64, hair, limb, sheet } from './parts.js';

export const HERO_LOOKS = {
  spellblade: { skin: '#bd9479', shadow: '#825e4b', light: '#dcb59a', hair: '#382c25', hairLight: '#71533d', cloth: '#292d38', trim: '#9cbad0', beard: true, hood: true, long: true },
  fighter: { skin: '#c39476', shadow: '#8e6048', light: '#e1b395', hair: '#493025', hairLight: '#77503a', cloth: '#652827', trim: '#8c929b', beard: true, helmet: true },
  cleric: { skin: '#825139', shadow: '#533322', light: '#aa7352', hair: '#241a16', hairLight: '#46362d', cloth: '#d3c8ae', trim: '#b59448', cropped: true },
  mage: { skin: '#86583f', shadow: '#553824', light: '#af7e5a', hair: '#77766f', hairLight: '#b6afa0', cloth: '#253449', trim: '#716044', beard: true, cropped: true },
  thief: { skin: '#c59a7a', shadow: '#8f6651', light: '#e3ba96', hair: '#34231e', hairLight: '#664634', cloth: '#302a2c', trim: '#71503b', hood: true },
  ranger: { skin: '#bd8a65', shadow: '#84573f', light: '#dda47a', hair: '#734327', hairLight: '#a46b3d', cloth: '#51452d', trim: '#7d6946', beard: true, long: true },
  druid: { skin: '#bd8c6c', shadow: '#825b43', light: '#dcae85', hair: '#493127', hairLight: '#795139', cloth: '#41432d', trim: '#756245', long: true, curls: true },
};

const head = k => [
  ...both64(ball(23.4, 28, 1.6, 2.5, k.skin)),
  ball(32, 26, 8.4, 10.2, k.skin), ball(29, 23, 3.5, 3, k.light),
  ...both64(ball(28.4, 26.1, 1.7, 0.9, '#d4c7ad')),
  ...both64(ball(28.6, 26.2, 0.8, 0.8, '#33291f')),
  ...both64(hair(26.3, 24, 30.4, 23.7, k.hair)),
  limb(32, 26, 32, 30, 0.7, 1, k.light), hair(31, 31, 33.5, 31, k.shadow),
  hair(29.5, 34, 34.5, 34, k.shadow),
];

function portrait(id) {
  const k = HERO_LOOKS[id], out = [];
  // Equipment remains behind the face and joins a visible shaft or grip.
  if (id === 'fighter' || id === 'thief' || id === 'spellblade') out.push(limb(12, 60, 14, 25, 1.4, 1.4, '#513323'), limb(10, 33, 19, 33, 0.8, 0.8, '#a08756'), ball(14, 23, 1.8, 1.8, '#9a8054'));
  if (id === 'cleric') out.push(limb(12, 58, 12, 26, 1.3, 1.3, '#533723'), ball(12, 23, 3.4, 4, '#8e8070'), ...[-3, 0, 3].map(d => limb(12 + d, 20, 12 + d, 26, 0.7, 0.7, '#bb9d62')));
  if (id === 'mage') out.push(limb(12, 64, 12, 21, 1.1, 1.1, '#4d3425'), sheet([[8, 21], [10, 14], [15, 15], [17, 22], [12, 26]], '#b66c27'), ball(12, 20, 1.6, 2.2, '#eeab48', { glows: true }));
  if (id === 'ranger') out.push(limb(52, 61, 53, 21, 1, 1, '#604028'), limb(53, 21, 49, 9, 1, 0.7, '#805434'), hair(49, 9, 52, 60, '#c6b58d'), ...[45, 48, 51].flatMap(x => [limb(x, 44, x + 1, 25, 0.4, 0.4, '#8b6944'), sheet([[x - 1, 25], [x + 1, 20], [x + 3, 26]], '#b1a389')]));
  if (k.long) out.push(sheet([[20, 16], [26, 10], [38, 10], [44, 17], [47, 48], [17, 48]], k.hair, { curve: 1 }));
  out.push(limb(32, 34, 32, 46, 3.4, 4.8, k.shadow));
  out.push(sheet([[4, 64], [8, 51], [20, 43], [32, 41], [44, 43], [56, 51], [60, 64]], k.cloth, { curve: 1 }), ...[15, 24, 40, 49].map(x => hair(x, 49, x - 2, 64, k.trim)));
  if (k.helmet) out.push(...both64(ball(13, 51, 8, 6, '#737a82')), sheet([[22, 21], [42, 21], [45, 43], [32, 46], [19, 43]], '#5b6169'));
  if (k.hood) out.push(sheet([[14, 49], [18, 25], [23, 12], [32, 9], [42, 16], [48, 49], [40, 43], [24, 43]], k.cloth, { curve: 1 }));
  out.push(...head(k));
  if (id !== 'fighter') out.push(sheet([[22, 40], [27, 38], [32, 41], [39, 38], [43, 44], [35, 48], [26, 46]], k.cloth, { curve: 0.7 }));
  if (k.beard) out.push(sheet([[25, 31], [28, 33], [32, 32], [36, 33], [39, 30], [38, 37], [33, 40], [27, 37]], k.hair, { curve: 0.8 }), hair(29, 34, 35, 34, k.shadow), hair(28, 36, 31, 38, k.hairLight));
  // Short hair, a hood's exposed forelock, or long loose hair; no invented
  // circlets, masks, antlers or ranger's braids absent from the painting.
  if (!k.helmet) out.push(sheet([[23.5, 24], [24, 16], [28, 12], [37, 12], [41, 17], [41, 24], [37, 18], [31, 17], [26, 20]], k.hair, { curve: 1 }));
  if (k.long && !k.curls) for (const side of [-1, 1]) out.push(sheet([[32 + side * 8, 16], [32 + side * 12, 19], [32 + side * 10, 24], [32 + side * 13, 29], [32 + side * 11, 34], [32 + side * 14, 40], [32 + side * 9, 42], [32 + side * 7, 32]], k.hair, { curve: 1 }), hair(32 + side * 10, 21, 32 + side * 11, 36, k.hairLight));
  if (k.long && k.curls) for (const side of [-1, 1]) for (let j = 0; j < 5; j++) {
    const x = 32 + side * (9 + j * 0.8), y = 19 + j * 4;
    out.push(ball(x, y, k.curls ? 3.1 : 2, 4, k.hair), hair(x - 0.5, y - 1, x + side, y + 4, k.hairLight));
  }
  if (k.cropped) out.push(...[[26, 17], [30, 15], [35, 15], [39, 18], [24, 23], [40, 23]].map(([x, y]) => ball(x, y, 1.1, 1, k.hairLight)));
  if (k.helmet) out.push(sheet([[22, 22], [23, 16], [27, 11], [32, 9], [38, 12], [41, 17], [42, 22], [36, 20], [27, 20]], '#777e86', { curve: 1 }), hair(26, 15, 31, 12, '#c2c4bc'), limb(32, 20, 32, 29, 0.9, 0.8, '#93989d'), hair(36, 30, 38, 32, '#ad7460'));
  out.push(limb(21, 45, 45, 60, 1.1, 1.1, k.trim));
  if (id === 'cleric' || id === 'mage') out.push(ball(39, 50, 2, 2, '#a48a52'), ball(39, 50, 1, 1, '#655538'));
  if (id === 'druid') out.push(...[16, 21, 43, 48].flatMap((x, i) => [sheet([[x, 45], [x + 4, 44], [x + 6, 52], [x + 1, 50]], '#5a6139'), ball(x + 2, 48, 0.7, 0.7, '#8d7a4f')]));
  if (id === 'spellblade') out.push(
    limb(54, 46, 54, 42, 0.7, 0.7, '#9cbad0'),
    sheet([[49, 47], [59, 47], [60, 59], [48, 59]], '#61798c'),
    sheet([[51, 49], [57, 49], [58, 57], [50, 57]], '#24445f'),
    ball(54, 53, 1.7, 3.5, '#8bdcff', { glows: true }),
    ...[49, 54, 59].map(x => limb(x, 47, x, 59, 0.5, 0.5, '#b8cbd8')),
    limb(48, 59, 60, 59, 0.8, 0.8, '#b8cbd8'));
  return out;
}

export const PORTRAITS = Object.fromEntries(Object.keys(HERO_LOOKS).map(id => [id, () => portrait(id)]));
