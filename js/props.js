// Props for encounters (see encounters.js): things you walk up to, drawn with
// the same painter so they sit in the same light as the creatures.
import { CREATURES } from './creatures.js';
import { ball, both64, hair, limb, line, oval, scragHead, sheet, specks } from './parts.js';

const PROPS = {
  // the dark elves' altar: a black block under a canopy of webs, a spider of
  // obsidian squatting on it with garnet eyes, bowls of dark wine before it
  spider_altar: () => {
    const stone = '#24202c', stoneLt = '#34303e', obs = '#141018', obsLt = '#3a3448', web = '#a8a0b8';
    return [
      // the web canopy behind, strung from the corners
      ...[[4, 4, 32, 20], [60, 4, 32, 20], [4, 30, 32, 20], [60, 30, 32, 20], [32, 2, 32, 20]].map(([a, b, c, d]) => hair(a, b, c, d, web)),
      ...[6, 10, 14].flatMap(r => oval(32, 20, r * 1.7, r, 10).map((pt, i, q) => hair(pt[0], pt[1], q[(i + 1) % q.length][0], q[(i + 1) % q.length][1], '#8a8298'))),
      // the altar: a black block with a silver line about its top
      sheet([[10, 44], [54, 44], [56, 62], [8, 62]], stone, { curve: 0.6 }), sheet([[12, 40], [52, 40], [54, 45], [10, 45]], stoneLt, { curve: 0.5 }),
      hair(12, 41, 52, 41, '#b8bccc'), hair(10, 50, 54, 50, '#1a1620'), specks([[11, 61], [53, 61], [14, 46], [50, 47]], '#0e0c12'),
      // the spider: abdomen, body, eight legs folded about it, garnet eyes
      ...[-1, 1].flatMap(sd => [[4, 30, 14, 22, 20, 38], [5, 33, 17, 30, 22, 40], [5, 35, 16, 38, 21, 41], [4, 37, 12, 44, 15, 41]].flatMap(([a, b, c, d, e, f]) => [
        limb(32 + sd * a, b, 32 + sd * c, d, 1.1, 0.9, obs), limb(32 + sd * c, d, 32 + sd * e, f, 0.9, 0.6, obs), hair(32 + sd * a, b - 0.7, 32 + sd * c, d - 0.7, obsLt)])),
      ball(32, 30, 8, 7, obs), ball(30, 27, 3, 2.4, obsLt), ball(32, 37.5, 5, 4, obs), ball(31, 36, 1.8, 1.2, obsLt),
      ball(30, 37.5, 1.2, 1, '#e8303a', { glows: true }), ball(34, 37.5, 1.2, 1, '#e8303a', { glows: true }), specks([[29.5, 37], [33.5, 37]], '#ffb0b0', { glows: true }),
      // the bowls of wine, a candle burning violet
      ...[[18, 46], [46, 46]].flatMap(([x, y]) => [ball(x, y, 4, 1.6, '#80868f'), ball(x, y - 0.4, 3, 0.9, '#4a0e24')]),
      limb(26, 47, 26, 42, 1, 0.9, '#d8d0e0'), sheet([[25.2, 41.6], [26, 37.6], [26.8, 41.6]], '#b070f0', { curve: 0.5, glows: true }),
    ];
  },
  // the Forge-Spirit: an anvil black with age on a stump of rock, and over it a fire
  // with no fuel, two eyes open in it, sparks rising
  forge_spirit: () => [
    // the stump of rock, cracked, soot up its sides
    ball(32, 57, 15, 5.6, '#4a3e38'), sheet([[19, 57.4], [21, 47], [43, 47], [45, 57.4]], '#5a4c44', { curve: 0.6 }),
    ball(26, 49, 5, 2, '#6a5a50'), hair(24, 49, 23, 56, '#3a302a'), hair(39, 48, 41, 56.5, '#3a302a'), hair(31, 50, 33, 55, '#3a302a'),
    specks([[22, 52], [27, 54], [36, 51], [42, 54], [33, 57]], '#2a2420'),
    // the anvil: waist, body, a face worn bright, the horn
    sheet([[27, 47.4], [37, 47.4], [35, 42], [29, 42]], '#2e3036', { curve: 0.3 }),
    sheet([[22, 42.4], [43, 42.4], [43.6, 37.2], [21, 37.2]], '#3a3c44', { curve: 0.5 }),
    limb(21.4, 38.8, 11, 39.6, 2.6, 0.5, '#3a3c44'), limb(43.4, 38.6, 47, 39.6, 1.6, 1, '#3a3c44'),
    limb(21, 37.2, 43.6, 37.2, 0.6, 0.6, '#8a8e98'), hair(23, 36.75, 42, 36.75, '#c8ccd4'),
    hair(25, 40, 30, 41, '#24262c'), specks([[34, 39], [38, 40.5], [27, 40.5]], '#5a5e66'),
    // the fire hanging over it: an outer flame, a hotter heart, eyes and a mouth in it
    sheet([[23, 35], [20.6, 26], [24.6, 20], [26, 12.4], [30, 17], [32.4, 6.8], [35.2, 16.4], [39, 11.6], [40, 20.8], [43.2, 26.4], [40.8, 35]], '#e8641c', { curve: 0.8, glows: true }),
    sheet([[26, 34.4], [25.2, 26.8], [28.4, 22], [32, 15.2], [35.2, 22], [38.4, 26.4], [38, 34.4]], '#ffa030', { curve: 0.8, glows: true }),
    sheet([[28.8, 34], [28.8, 28], [32, 23.2], [35.2, 28], [35.2, 34]], '#ffe080', { curve: 0.6, glows: true }),
    ball(28.4, 26.4, 1.8, 1.3, '#3a1006'), ball(35.6, 26.4, 1.8, 1.3, '#3a1006'), specks([[28, 26], [35.25, 26]], '#fff8d0'),
    sheet([[29.6, 30.4], [34.4, 30.4], [33.4, 32], [30.6, 32]], '#7a2a0a'),
    specks([[24, 9], [41, 7], [30, 3], [45, 14], [19, 16], [36, 1.5], [27, 5]], '#ffd060', { glows: true }),
    specks([[23, 38], [28, 38], [34, 38], [41, 38]], '#c8ccd4'),
  ],
  // a shaft in the floor, ringed with smooth stones, the Heart's red light welling up out of it
  heartwell: () => [
    ball(32, 52, 24, 9.2, '#4a3e38'), ball(32, 51.2, 20, 7.2, '#5e5048'),
    ...[[12, 50], [18, 45.2], [28, 43.6], [38, 43.6], [48, 45.2], [54, 50], [48, 56.8], [32, 59.2], [16, 56.8], [24, 58.4], [40, 58.4]].map(([x, y], i) => ball(x, y, 4.4 - (i % 3) * 0.4, 3.2, i % 2 ? '#6e6058' : '#7a6a60')),
    ...[[12, 50], [28, 43.6], [48, 45.2], [32, 59.2]].map(([x, y]) => hair(x - 2, y - 1.5, x + 1, y - 2.25, '#9a8a80')),
    // the mouth of the shaft, and the light in it, hotter as it goes down
    ball(32, 51.2, 15.2, 5.2, '#1a0806'), ball(32, 50.8, 11.2, 3.6, '#7a1c0c', { glows: true }), ball(32, 50.4, 6.8, 2.2, '#e05020', { glows: true }), ball(32, 50.2, 3.2, 1.2, '#ffc060', { glows: true }),
    // the warm light welling over the lip, and heat rising off it
    ball(32, 45.6, 14, 4.4, '#5a1c0e'), ball(32, 46.8, 8.8, 2.4, '#a83010', { glows: true }),
    hair(28, 42, 27, 34, '#7a2a14'), hair(36, 41, 37.5, 32, '#7a2a14'), hair(32, 40, 31.5, 30, '#6a2412'),
    // sparks drifting up out of it, thinning as they rise
    specks([[28, 40], [36, 38], [32, 34], [26, 30], [38, 28], [30, 24], [35, 20], [25, 21], [40, 17]], '#ffc060', { glows: true }),
    specks([[32, 12], [28, 9], [37, 8], [33, 4]], '#e8641c', { glows: true }),
    specks([[14, 49], [50, 49], [24, 44], [42, 44], [20, 57], [44, 57]], '#8a7a70'),
  ],
  // a wasted delver in the rags of a fine coat, hunched over a fire of bones
  lastdelver: () => {
    const coat = '#2a3a5a', coatDk = '#1e2a42', skin = '#c8a890', braid = '#c8a040';
    return [
      // the fire of bones, ash round it
      ball(43, 58.8, 10, 3.2, '#3a2a20'), ...[[37, 57.2], [43, 56], [49, 57.6], [40, 59], [46, 59.2]].map(([x, y]) => limb(x - 3, y, x + 3, y - 1.2, 1.1, 1, '#d8d0bc')),
      ball(46.4, 56, 1.6, 1.4, '#d8d0bc'), specks([[46, 56], [47, 56]], '#2a2420'),
      sheet([[37, 56.8], [39.2, 46], [42.4, 51], [44.4, 43], [47.2, 51.2], [49.2, 56.8]], '#e8641c', { curve: 0.6, glows: true }),
      sheet([[40.8, 56.4], [42.8, 50.4], [44.4, 47.6], [46, 51.2], [46.8, 56.4]], '#ffd060', { curve: 0.5, glows: true }),
      specks([[40, 41], [46, 39], [43, 36], [48, 34], [41, 32]], '#ffd060', { glows: true }),
      // the delver, hunched, knees up, a ragged coat that was blue once, its braid tarnished
      sheet([[11, 60], [14, 34], [20, 25], [29, 26], [33, 38], [32, 60]], coat, { curve: 1 }),
      sheet([[12, 60], [14, 42], [18, 60]], coatDk), sheet([[24, 44], [32, 40], [33, 60], [27, 60]], coatDk, { curve: 0.6 }),
      limb(18, 36, 28, 38, 0.6, 0.6, braid), limb(17.2, 43, 29.2, 44.8, 0.6, 0.6, braid), ...[[19, 36.5], [22, 37], [25, 37.5]].map(([x, y]) => specks([[x, y]], '#f0d070')),
      ...[[13, 58], [17, 59], [24, 59.5], [30, 59]].map(([x, y]) => hair(x, y, x + 0.5, y + 2.5, coatDk)),
      // knees drawn up under the coat, boots worn through
      ball(27, 47, 5, 4.6, coat), limb(29, 50, 31, 59, 2.6, 2.2, '#2a2420'), ball(32, 60.4, 3.4, 1.6, '#3a2e24'), specks([[33.5, 60]], '#c8a890'),
      // a thin hand held out to the fire, the fingers long
      limb(29, 40, 37.2, 45.2, 2, 1.6, coat), ball(38.4, 45.8, 2, 1.8, skin), ...[0, 1, 2].map(i => limb(39.5, 44.8 + i, 41.6, 44.4 + i * 1.3, 0.5, 0.4, skin)),
      hair(36, 44, 37, 45.5, '#e8d0b8'),
      // the head: matted grey hair, a gaunt face, eyes too bright
      ball(23.2, 21.6, 7.2, 7.6, '#9a9488'), ball(25.2, 23.2, 4.8, 5.6, skin), ball(26.6, 25.6, 2.6, 2, '#b89878'),
      ball(25.4, 21.6, 1.2, 0.9, '#ffe8a0', { glows: true }), ball(29, 21.6, 1, 0.8, '#ffe8a0', { glows: true }),
      hair(24, 20, 27, 20.25, '#5a4a40'), hair(28, 20.25, 30, 20, '#5a4a40'),
      limb(26.4, 27.6, 29, 27.4, 0.4, 0.4, '#5a3a30'), hair(23, 25, 24, 28, '#a88870'), hair(29, 24, 29.5, 27, '#a88870'),
      hair(18, 17, 16, 27, '#7a746a'), hair(21, 15.2, 19.2, 25, '#b8b2a6'), hair(25, 14.5, 27, 18, '#b8b2a6'), hair(19.5, 18, 18.5, 30, '#8a847a'),
      specks([[27, 29], [25, 29.5], [29, 28.75]], '#9a9488'),
    ];
  },
  // a wyrm's egg in a nest of ash and gnawed bones, scaled like a pine cone, warm through the shell
  wyrmegg: () => {
    const scaleOf = (x, y, s) => [sheet([[x - 3.2 * s, y + 2], [x, y - 2.4 * s], [x + 3.2 * s, y + 2]], '#3a5228', { curve: 0.4 }), hair(x - 2.4 * s, y + 1.6, x + 2.4 * s, y + 1.6, '#8aae68')];
    return [
      ball(32, 56, 22, 6.4, '#3e3632'), ball(32, 55.2, 18, 4.8, '#5a504a'),
      ...[[14, 55], [50, 54], [22, 59.6], [44, 59.2], [30, 60.4]].map(([x, y], i) => limb(x - 4, y, x + 4, y - 1.6, 1.1, 1, '#d8d0bc')),
      ...[[18, 55], [46, 54]].map(([x, y]) => ball(x, y - 0.6, 1.8, 1.6, '#e0d8c4')),
      specks([[12, 57], [20, 53], [44, 52], [52, 57], [36, 60]], '#8a8078'),
      ball(32, 37.2, 13.2, 18, '#4e6a3a'), ball(28.8, 32.8, 7.2, 10.8, '#6a8a4e'),
      ...[[26, 24, 0.8], [34, 24, 0.8], [23, 32, 1], [30, 32, 1], [37.2, 32, 1], [24, 40, 1], [32, 40.8, 1], [40, 40, 1], [28, 48, 0.9], [36, 48, 0.9], [32, 18, 0.6]].flatMap(([x, y, s]) => scaleOf(x, y, s)),
      // a crack across the crown, and the warmth inside showing through it
      line(29, 19.6, 34, 23, '#22301a'), line(34, 23, 32, 27, '#22301a'), line(32, 27, 35, 29, '#22301a'),
      hair(30, 20.25, 33.5, 22.75, '#e8a040', { glows: true }), hair(33.5, 23.5, 32.25, 26.5, '#e8a040', { glows: true }),
      specks([[25, 27], [27, 36], [38, 45], [35, 30]], '#8aae68'),
    ];
  },
  // a sellsword waiting to be hired: leaning on the sword, eyes narrowed, the price already in mind
  hireling: () => CREATURES.sellsword('sit'),
  // the grey dwarves' forge: a mouth in the rock full of red coals, an anvil as long as a coffin before it,
  // dark iron ingots stacked beside, and a cask of their ale
  dwarf_forge: () => {
    const rock = '#5a5856', rockDk = '#3a3836', rockLt = '#7a7874', iron = '#2e3034', ironLt = '#6e747c', coal = '#ff6a28', ember = '#ffb050', wood = '#6a4a2c', copper = '#c87a3a';
    return [
      // the forge, a hood of cut stone over its mouth, coals glowing within
      sheet([[10, 44], [10, 18], [16, 8], [48, 8], [54, 18], [54, 44]], rockDk, { curve: 0.4 }),
      ...[16, 24, 32].map(y => hair(11, y, 53, y, rock)), ...[[20, 8, 20, 16], [32, 16, 32, 24], [44, 8, 44, 16], [26, 24, 26, 32], [38, 24, 38, 32]].map(([a, b, c2, d2]) => hair(a, b, c2, d2, rock)),
      sheet([[18, 44], [18, 30], [22, 24], [42, 24], [46, 30], [46, 44]], '#1a0e0a', { curve: 0.6 }),
      ball(32, 40, 12, 4.4, coal, { glows: true }), ...[[24, 38], [29, 36.5], [35, 37], [40, 39], [32, 39]].map(([x, y]) => ball(x, y, 2, 1.4, ember, { glows: true })),
      specks([[27, 33], [36, 31], [31, 29]], ember, { glows: true }),
      // the anvil before it, its horn to one side, on a block of stone
      sheet([[24, 61], [40, 61], [38, 53], [26, 53]], rock, { curve: 0.5 }), hair(25, 54, 39, 54, rockLt),
      sheet([[27, 53], [37, 53], [36, 49], [28, 49]], iron),
      sheet([[16, 49], [48, 49], [50, 45], [22, 44.5], [14, 45.5]], iron, { curve: 0.7 }), hair(18, 45.4, 47, 45.4, ironLt), line(15, 49, 49, 49, '#16181a'),
      // the ingots, stacked crosswise, and the cask with its tap
      ...[[4, 60], [12, 60], [8, 57], [6, 54]].map(([x, y]) => sheet([[x - 3.5, y], [x + 3.5, y], [x + 2.6, y - 2.6], [x - 2.6, y - 2.6]], '#4a4c52')),
      ...[[4, 60], [12, 60], [8, 57], [6, 54]].map(([x, y]) => hair(x - 2.4, y - 2.4, x + 2.4, y - 2.4, ironLt)),
      ball(56, 54, 6, 7, wood), ...[49.5, 54, 58.5].map(y => hair(50.5, y, 61.5, y, copper)), ball(56, 54, 1.6, 1.6, '#2a1a10'), limb(56, 54, 56, 57, 0.6, 0.6, copper),
    ];
  },
  // the lizardfolk's eggs: a mound of black mud half out of the water, a dozen leathery eggs pressed into its top
  egg_clutch: () => {
    const mud = '#3a3424', mudLt = '#5a5038', egg = '#d8d0b0', eggDk = '#a8a080', water = '#1e3036';
    return [
      ball(32, 58, 28, 5, water), ...[[12, 58], [26, 60], [44, 59], [54, 57]].map(([x, y]) => hair(x - 4, y, x + 4, y, '#4a6a70')),
      sheet([[6, 58], [12, 46], [22, 38], [32, 35], [42, 38], [52, 46], [58, 58]], mud, { curve: 1 }),
      sheet([[14, 47], [24, 40], [32, 38], [40, 40], [50, 47], [40, 45], [24, 45]], mudLt, { curve: 1 }),
      ...[[22, 43], [29, 40], [36, 40], [43, 43], [26, 47], [33, 45], [40, 47], [18, 49], [47, 49], [32, 50]].flatMap(([x, y]) => [ball(x, y, 3.2, 3.8, egg), ball(x + 0.8, y + 1, 2, 2.4, eggDk), specks([[x - 1, y - 2]], '#ffffff')]),
      ...[[8, 50, 6, 36], [56, 50, 58, 34], [12, 54, 10, 42], [52, 54, 55, 40]].map(([a, b, c2, d2]) => limb(a, b, c2, d2, 0.6, 0.3, '#6a7040')),
    ];
  },
  // a dark elf cast out of the halls, waiting by a wall with its blades lowered
  exile: () => CREATURES.renegade('sit'),
  // a healer with nobody to mend: kneeling by a dead lamp, the satchel open, a bandage half wound
  stray_healer: () => CREATURES.mender('sit'),
  // a fall of stone, and a hand still moving under it
  rubble: () => {
    const rock = '#7a7268', dark = '#5a544c', lt = '#8a8278', skin = '#d4a47a';
    return [
      ball(18, 54, 11, 8, dark), ball(44, 55, 13, 7.6, dark),
      // the arm and the hand reaching up out of it, the sleeve torn
      limb(38, 45, 50, 37, 2.8, 2.4, skin), ball(51.6, 36, 3.2, 2.8, skin),
      ...[[54, 32], [55, 34], [55.5, 36.4], [53, 31]].map(([x, y]) => limb(51.6, 35.6, x, y, 0.8, 0.6, '#e0b48a')),
      hair(44, 41, 48, 38.5, '#a87a58'), specks([[53, 31], [54, 32], [55, 34], [55.5, 36.4]], '#f0c8a0'),
      sheet([[34, 44], [44, 42], [46, 50], [34, 52]], '#34507a', { curve: 0.6 }), limb(34, 44, 44, 42, 0.6, 0.6, '#c9a24a'),
      hair(36, 47, 43, 46, '#4a6a9a'),
      // the stones, cracked and dusty, piled over it
      ball(30, 50, 12, 10, rock), ball(17, 45, 6.4, 5.6, rock), ball(40, 49, 6, 5.2, lt),
      ball(26, 37, 6.8, 6, lt), ball(35, 40, 4.8, 4.4, rock), ball(10, 57, 4.8, 4, rock),
      ball(52, 58, 5.6, 4, rock), ball(22, 59, 6, 3.6, '#6a645a'), ball(36, 59.5, 4, 2.8, '#6a645a'),
      ball(24, 34, 3, 1.6, '#a8a096'), ball(28, 46, 4, 2, '#9a9288'),
      hair(22, 48, 27, 51, dark), hair(36, 50, 42, 49, dark), hair(24, 36, 28, 41, dark), hair(14, 44, 17, 48, dark),
      specks([[26, 40], [28, 42], [32, 52], [18, 46], [44, 51], [12, 57], [53, 57]], '#9a9288'),
      // dust and grit spilled round it
      specks([[6, 61], [14, 62], [24, 62.5], [38, 62], [48, 62.5], [58, 61.5], [30, 62.75]], '#8a8278'),
    ];
  },
  // a squat idol older than the delve, with fresh offerings at its feet
  shrine: () => {
    const stone = '#6e6a62', stoneLt = '#7e7a70', stoneDk = '#5a564e';
    return [
      // the plinth in two steps, chipped at the corners
      sheet([[10, 52], [54, 52], [56, 62], [8, 62]], stoneDk, { curve: 0.7 }), hair(10, 55, 54, 55, '#4a463e'),
      sheet([[16, 42], [48, 42], [50, 53], [14, 53]], stone, { curve: 0.8 }), hair(18, 45, 46, 45, '#8a867c'),
      specks([[11, 53], [53, 53], [15, 43], [49, 44]], '#3a3630'),
      // the idol: a squat body, arms folded, a round head worn smooth
      ball(32, 29, 12, 13, stoneLt), ball(28, 24, 6, 6, '#8a867c'),
      limb(22, 28, 27, 36, 2.8, 2.4, '#747068'), limb(42, 28, 37, 36, 2.8, 2.4, '#747068'), ball(32, 37, 5, 2.4, '#747068'),
      hair(26, 24, 28, 34, stoneDk), hair(38, 24, 36, 34, stoneDk),
      ball(32, 15, 8, 7.2, '#8a867c'), ball(30, 12, 4, 3, '#9a968c'),
      ball(28.4, 15, 1.8, 1.4, '#1c1a18'), ball(35.6, 15, 1.8, 1.4, '#1c1a18'), hair(27, 13, 30, 13.25, stoneDk), hair(34, 13.25, 37, 13, stoneDk),
      limb(28.6, 20, 35.4, 20, 0.5, 0.5, '#3a3630'), limb(32, 15.5, 32, 18, 0.8, 1.2, '#8a867c'),
      hair(36, 9, 38, 16, '#6a665e'), specks([[30, 9], [34, 9.5], [32, 11]], '#a8a498'),
      // candles either side, burning, wax run down them
      ...both64(limb(14, 48, 14, 40, 1.4, 1.2, '#e8e0c8')), ...both64(hair(13.5, 41, 13, 46, '#fff8e0')),
      ...both64(sheet([[13, 39.6], [14, 34], [15, 39.6]], '#ffc050', { curve: 0.5, glows: true })), ...both64(ball(14, 38.6, 0.8, 1.2, '#fff0a0', { glows: true })),
      // offerings: coins, a cup, a red cloth
      ...[[24, 48], [26, 48.6], [38, 47.6], [40, 46.8], [32, 50], [34, 50]].map(([x, y]) => ball(x, y, 1.2, 0.7, '#e8c040')),
      ball(30, 46.6, 2.6, 1.4, '#b03040'), sheet([[42, 49], [46, 49], [45.4, 45], [42.6, 45]], '#8a6a40', { curve: 0.5 }),
      specks([[29, 48.5], [33, 49.5], [37, 47]], '#fff0a0'),
    ];
  },
  // a slab cut deep with letters that will not keep still
  runestone: () => {
    const slab = '#3e3a48', slabDk = '#2a2632', slabLt = '#4e4a5a';
    /** a rune: three strokes cut at angles, lit from inside */
    const rune = (x, y, k) => [
      limb(x, y, x, y + 5, 0.55, 0.55, '#8a70ff', { glows: true }),
      limb(x, y + (k % 2 ? 1 : 3), x + 2.6, y + (k % 2 ? 3 : 0.6), 0.5, 0.5, '#8a70ff', { glows: true }),
      limb(x, y + 4, x + (k % 3) - 1 + 2, y + 5.6, 0.45, 0.45, '#8a70ff', { glows: true }),
    ];
    return [
      ball(32, 61, 18, 2.6, '#2a2830'),
      sheet([[16, 12], [24, 5], [42, 5], [48, 12], [50, 62], [14, 62]], slab, { curve: 0.8 }),
      sheet([[42, 5], [48, 12], [50, 62], [45, 62]], slabDk, { curve: 0.5 }), sheet([[18, 12], [24, 6], [30, 6], [24, 14]], slabLt, { curve: 0.5 }),
      ...[[21, 15], [29, 15], [37, 15], [24, 25], [33, 25], [21, 35], [29, 35], [38, 35], [25, 45], [35, 45]].flatMap(([x, y], i) => rune(x, y, i)),
      specks([[21.5, 15.5], [29.5, 25.5], [38.5, 35.5], [25.5, 45.5]], '#ffffff', { glows: true }),
      // the stone's cracks, lichen at its foot
      line(18, 52, 24, 58, slabDk), line(40, 8, 44, 14, slabDk), hair(18, 20, 21, 30, slabDk), hair(42, 52, 46, 58, slabDk), hair(26, 54, 28, 59, slabDk),
      specks([[22, 6], [28, 5], [38, 6], [45, 10]], '#5a5468'),
      ball(18, 60, 4, 1.6, '#4a8040'), ball(46, 60.4, 3.4, 1.4, '#4a8040'), specks([[16, 59], [20, 58.5], [44, 59], [48, 59.5]], '#6aa058'),
    ];
  },
  // slumped against the wall, clutching its side, knife held out
  goblin_hurt: () => {
    const skin = '#6aa84a', skinDk = '#3f6e2c', skinLt = '#8ac66a', tunic = '#7a5230', tunicDk = '#5a3a20';
    return [
      // legs stuck out in front, bare feet
      ...both64(limb(26, 54, 16, 58, 3.4, 2.8, skinDk)), ...both64(limb(16, 58, 10, 59.6, 2.8, 2.2, skinDk)), ...both64(ball(9, 60, 3.6, 2, '#4a3a2a')),
      ...both64(specks([[6.5, 61], [8, 61.5], [9.5, 61.5]], '#d8cfb0')),
      // the body slumped back, the tunic dark with blood at one side
      ball(32, 46, 10.6, 10, skin), ...[40, 43].map(y => both64(hair(25, y, 29, y - 0.5, skinDk))).flat(),
      sheet([[21, 44], [43, 44], [44, 56], [40, 54.5], [36, 57], [32, 55], [28, 57], [24, 54.5], [20, 56]], tunic, { curve: 1 }),
      sheet([[21, 44], [25, 44], [23.5, 55.5], [20, 56]], tunicDk, { curve: 0.4 }),
      ball(32, 50.4, 4, 3.6, '#7a1c1c'), specks([[33, 49], [35, 52], [32, 55], [30, 54]], '#801818'),
      // one hand pressed to the wound, blood through the fingers
      limb(22, 40, 28, 49, 2.8, 2.4, skin), ball(30, 50.6, 3.2, 2.8, skin), ...[0, 1, 2].map(i => limb(30.5, 49 + i * 1.2, 33.5, 49.6 + i * 1.2, 0.6, 0.5, skin)),
      specks([[33, 49.5], [34, 51], [33.5, 52.5], [31, 53.5]], '#c02828'),
      // the other holding the knife out, shaking
      limb(42, 40, 50, 37, 2.8, 2.4, skin), ball(51.6, 36.4, 2.8, 2.6, skin),
      limb(52.4, 35.6, 58.4, 29.6, 0.9, 0.5, '#b8bcc4', { smooth: 1 }), hair(53, 34.5, 57.5, 30, '#f0f2f6'), limb(51, 37, 53.6, 34.6, 0.8, 0.8, '#5a3a20'),
      specks([[55, 33], [56, 31]], '#8a5a30'),
      // ears drooping, a narrow head, eyes squeezed half shut in pain
      sheet([[24, 30], [6, 26], [9, 30], [7.5, 32], [24, 35]], skin, { tilt: [-0.5, 0] }), sheet([[40, 30], [58, 26], [55, 30], [56.5, 32], [40, 35]], skin, { tilt: [0.5, 0] }),
      sheet([[23, 31], [12, 28.5], [23, 33.5]], '#b06e56'), sheet([[41, 31], [52, 28.5], [41, 33.5]], '#b06e56'),
      limb(32, 37, 32, 40, 2, 2.3, skinDk),
      ball(32, 32, 9.2, 8.2, skin), ball(32, 36.4, 6, 3, skin), ball(29, 29, 4, 2.6, skinLt),
      limb(25, 29, 30, 30, 1, 0.8, skinDk), limb(39, 29, 34, 30, 1, 0.8, skinDk),
      ball(28, 31.6, 1.8, 0.8, '#ffe040'), ball(36, 31.6, 1.8, 0.8, '#ffe040'), specks([[28, 31.5], [36, 31.5]], '#1a1010'),
      limb(32, 30.5, 32.6, 35, 0.9, 1.4, skin), ball(33, 35.4, 1.4, 1, skinLt),
      sheet([[27, 37.6], [37, 37.6], [35.6, 39.6], [28.4, 39.6]], '#2a1010'), specks([[29, 38], [31, 38.5], [34, 38]], '#e8dcb8'),
      // sweat on its brow, a cut over the eye
      specks([[27, 26.5], [37, 27]], '#9ad0ff'), hair(34, 26, 36, 28.5, '#801818'),
    ];
  },
  // the fourth crew's box: rusted lock, chain that has not rusted
  strongbox: () => {
    const wood = '#6a4424', woodLt = '#7a5030', woodDk = '#4a2e18', iron = '#6a7078', ironLt = '#a8b0b8';
    return [
      ball(32, 61, 22, 2.4, '#2a2420'),
      // the box: planks under iron bands, the lid shut
      sheet([[12, 36], [52, 36], [54, 58], [10, 58]], wood, { curve: 0.8 }),
      sheet([[12, 26], [52, 26], [52, 37], [12, 37]], woodLt, { tilt: [0, -0.6] }),
      limb(12, 36, 52, 36, 0.6, 0.6, '#2a1a10'),
      ...[42, 50].map(y => hair(13, y, 53, y, woodDk)), hair(14, 31, 50, 31, '#8a5a36'),
      ...[[20, 44], [40, 52], [30, 30]].map(([x, y]) => hair(x, y, x + 4, y + 0.5, woodDk)),
      ...[18, 32, 46].flatMap(x => [limb(x, 26, x, 58, 1, 1, iron), hair(x - 0.5, 27, x - 0.5, 57, ironLt), specks([[x, 28], [x, 34], [x, 40], [x, 48], [x, 56]], ironLt)]),
      limb(10, 58, 54, 58, 1, 1, iron),
      // the lock, rusted, a keyhole in it
      sheet([[28, 34], [36, 34], [36, 44], [28, 44]], '#a07830', { curve: 0.5 }), specks([[29, 35], [35, 35], [29, 43], [35, 43]], '#e0c060'),
      ball(32, 38.4, 1, 1, '#1a1008'), limb(32, 39, 32, 41.4, 0.5, 0.4, '#1a1008'),
      specks([[30, 36], [31, 36.5], [34, 42], [35, 42.5]], '#7a4a20'),
      // the chain round it, bright: links face on and edge on, down to the floor
      ...[[8, 44], [7, 48], [8, 52], [7, 56], [8, 60], [56, 44], [57, 48], [56, 52], [57, 56], [56, 60]].map(([x, y], i) => i % 2 ? limb(x, y - 1.2, x, y + 1.2, 0.6, 0.6, '#8a929a') : ball(x, y, 1.5, 1.7, '#9aa2aa')),
      specks([[8, 44], [8, 52], [8, 60], [56, 44], [56, 52], [56, 60]], '#1a1a20'),
      limb(32, 62, 32, 56, 0.6, 0.6, '#8a929a'), specks([[30, 62.5], [34, 62.5]], ironLt),
    ];
  },
  // a squat stone door set in the rock, three iron levers beside it in a row,
  // each worn bright at the grip, and a line of old marks scratched over them
  lever_door: () => {
    const stone = '#6e6a66', dark = '#4a4744', iron = '#5a6068', grip = '#c9b07a';
    return [
      // the frame, blocks of dressed stone, and the door in it
      sheet([[8, 12], [40, 12], [40, 62], [8, 62]], stone, { curve: 0.4 }),
      ...[20, 30, 40, 50].map(y => hair(8, y, 13, y, dark)), ...[22, 34, 46].map(y => hair(35, y, 40, y, dark)),
      sheet([[13, 18], [35, 18], [35, 62], [13, 62]], '#3e3a36', { curve: 0.6 }),
      ...[24, 34, 44, 54].map(y => limb(13, y, 35, y, 0.5, 0.5, dark)), ...[19, 24, 29].map(x => hair(x, 19, x, 61, '#34302c')),
      ball(24, 40, 3.2, 3.2, iron), ball(24, 40, 1.4, 1.4, '#1a1a1e'), hair(22, 38, 25, 37.5, '#9aa0a8'),
      // the frame's keystone, cut with a mark like an eye
      sheet([[19, 10], [29, 10], [28, 16], [20, 16]], '#8a8680'), ball(24, 12.6, 2, 1.2, '#2a2622'), ball(24, 12.6, 0.8, 0.8, '#6a6660'),
      specks([[10, 15], [37, 26], [11, 44], [38, 56]], '#8a8680'),
      // three levers in their slots, set at different angles
      ...[[46, -0.4], [52, 0.6], [58, 0.2]].flatMap(([x, lean]) => [
        sheet([[x - 2.4, 44], [x + 2.4, 44], [x + 2.4, 50], [x - 2.4, 50]], dark), ball(x, 47, 1.2, 2, '#1a1a1e'),
        limb(x, 47, x + lean * 4, 31, 1.2, 1, iron), hair(x - 0.5, 46, x + lean * 4 - 0.5, 32, '#8a9098'),
        ball(x + lean * 4, 30, 2.2, 2, grip), specks([[x + lean * 4 - 1, 29]], '#f0e0b0'),
      ]),
      // scratched marks over the levers: someone else tried, and counted
      ...[[44, 22], [50, 20], [56, 22]].flatMap(([x, y]) => [line(x, y, x + 2, y + 4, '#b8b0a0'), hair(x + 2, y, x + 3, y + 4, '#b8b0a0')]),
      ball(50, 62, 14, 1.4, '#2a2826'),
    ];
  },
  // a mule, still laden, standing with its head low and its packs askew, a
  // frayed rope hanging from its halter where someone let go of it
  mule: () => {
    const coat = '#7a6250', dark = '#4e3e30', light = '#8c7462', muzzle = '#c8b8a0', pack = '#8a6a3a', packDk = '#6a4a24', strap = '#3a2a1a', hoof = '#2a2018';
    return [
      // legs, the far pair darker, knobbed at the knee
      .../** @type {[number, string][]} */ ([[20, dark], [42, dark], [25, coat], [47, coat]]).flatMap(([x, c]) => [limb(x, 44, x - 0.6, 52, 3.4, 2.4, c), ball(x - 0.6, 52, 2.2, 2, c), limb(x - 0.6, 52, x, 60.6, 2.2, 1.8, c)]),
      ...[20, 25, 42, 47].map(x => ball(x, 61.6, 2.6, 1.4, hoof)),
      // the body, ribs showing, the tail switching
      ball(34, 39, 17.6, 11.2, coat), ball(34, 45, 13, 4.8, light), ...[36, 39, 42].map(y => hair(36, y, 44, y + 1, dark)),
      limb(50, 34, 55, 48, 1.6, 1, dark), ball(55.2, 49.6, 1.8, 2.6, hoof), hair(55, 48, 55.5, 52, '#4a3a2a'),
      // the packs, one slipped low on its flank, a pot tied on top, a bedroll
      sheet([[22, 28], [40, 28], [42, 42], [20, 42]], pack, { curve: 1 }),
      limb(31, 28, 31, 42, 0.6, 0.6, strap), limb(21, 35, 41, 35, 0.6, 0.6, strap), ...[[25, 31], [36, 39]].map(([x, y]) => hair(x, y, x + 3, y + 0.5, packDk)),
      ball(36, 25.2, 4.8, 3.6, '#5a5e66'), ball(36, 22.4, 3.2, 1.2, '#3a3e44'), hair(33, 24, 35, 23, '#8a8e96'),
      limb(22, 26, 32, 25, 2.4, 2.4, '#8a4a3a'), hair(23, 25, 31, 24, '#a86050'),
      sheet([[38, 38], [48, 39], [47, 48], [39, 47]], '#7a5a30', { curve: 1 }), limb(38.4, 42, 47.6, 43.2, 0.5, 0.5, strap),
      // the head, held low, long ears, a pale muzzle, a halter with a trailing rope
      limb(20, 32, 13, 40, 5.6, 4.4, coat), hair(18, 31, 13, 37, dark),
      ball(11, 42, 6.4, 5.8, coat), ball(8, 46, 4.4, 3.4, muzzle),
      ball(6.6, 45.6, 0.8, 0.7, hoof), ball(11, 40, 1.2, 1, '#1a1008'), specks([[10.5, 39.5]], '#e8e0d0'),
      sheet([[12, 37], [14, 26], [16, 37]], coat, { tilt: [0.2, -0.6] }), sheet([[8, 37], [9, 27], [11.6, 37]], dark, { tilt: [-0.2, -0.6] }),
      sheet([[13, 35], [14, 29], [15, 35]], '#a88a7a'),
      limb(7, 43, 14, 43, 0.6, 0.6, strap), limb(9, 47, 8, 52, 0.4, 0.4, '#b0a080'), limb(8, 52, 7, 56, 0.4, 0.4, '#b0a080'), limb(7, 56, 10, 62, 0.4, 0.4, '#b0a080'),
      specks([[10, 62.5], [11, 62.75], [9.5, 63]], '#c8b890'),
    ];
  },
  // a voice with nothing behind it: a cold light, trailing
  wisp: () => [
    ball(32, 32, 11, 11, '#4a5a7a', { glows: true }), ball(32, 32, 7.6, 7.6, '#9ab8e8', { glows: true }), ball(30.4, 30.4, 4, 4, '#e8f4ff', { glows: true }),
    limb(32, 40, 26, 54, 3.2, 0.8, '#5a6a8a', { glows: true }), limb(32, 40, 39, 52, 2.4, 0.6, '#5a6a8a', { glows: true }), limb(30, 41, 31, 58, 1.6, 0.4, '#4a5a7a', { glows: true }),
    hair(26, 44, 24, 52, '#8a9aba'), hair(38, 44, 40, 50, '#8a9aba'),
    // a face, almost, in the light
    ball(28, 30, 1.6, 1.4, '#2a3450'), ball(36, 30, 1.6, 1.4, '#2a3450'), sheet([[29.6, 35.4], [34.4, 35.4], [33.4, 37], [30.6, 37]], '#2a3450'),
    specks([[28, 28], [29, 27], [30, 28]], '#ffffff', { glows: true }),
    specks([[18, 24], [46, 20], [16, 40], [48, 38], [24, 16], [42, 46], [20, 22], [44, 24], [19, 36], [46, 34], [22, 46], [43, 42]], '#e8f4ff', { glows: true }),
  ],
  // pale caps growing thick on something that was a person
  fungus: () => {
    const cap = '#e8e0cc', capDk = '#c8bca4', stem = '#c8bca4', gill = '#a8987e';
    const shroom = (x, y, r) => [
      limb(x, 62, x, y, r * 0.32, r * 0.26, stem), hair(x - r * 0.15, 61, x - r * 0.1, y + 2, '#e8dcc8'),
      ball(x, y + r * 0.3, r * 0.95, r * 0.2, gill), ball(x, y, r, r * 0.55, cap), ball(x - r * 0.35, y - r * 0.18, r * 0.4, r * 0.2, '#fffaf0'),
      specks([[x - r * 0.5, y], [x + r * 0.3, y - r * 0.25], [x + r * 0.6, y + r * 0.1]], '#b89078'),
    ];
    return [
      ball(32, 57, 20, 7, '#4a4038'),
      // what is under them: a skull, a hand, a scrap of cloth
      ball(18, 54, 6, 5, '#d8d0bc'), ball(16, 54, 1.6, 1.4, '#2a2420'), ball(20.4, 54, 1.6, 1.4, '#2a2420'), hair(17, 57, 20, 57, '#8a8070'),
      ...[0, 1, 2, 3].map(i => limb(44 + i * 1.6, 58, 45 + i * 2, 61.5, 0.5, 0.5, '#d8d0bc')),
      sheet([[26, 54], [36, 53], [38, 58], [27, 59]], '#5a4a38', { curve: 0.6 }),
      ...shroom(26, 40, 9), ...shroom(40, 34, 11), ...shroom(50, 48, 6.4), ...shroom(12, 46, 5.6), ...shroom(34, 50, 5), ...shroom(20, 52, 3.4),
      hair(20, 40, 32, 40, capDk), hair(32, 34, 48, 34, capDk),
      specks([[6, 60], [56, 61], [44, 62], [22, 62]], '#a0c890', { glows: true }),
    ];
  },
  // a man hanging in goblin chains, a fresh brand on his arm
  prisoner: () => {
    const skin = '#c89a78', skinDk = '#a07858', rag = '#b8ac90', ragDk = '#8a7e66', iron = '#7a7e88', ironLt = '#a8acb4';
    return [
      // the rings in the wall and the chains down to his wrists
      ball(14, 12, 2.8, 2.8, iron), ball(14, 12, 1.2, 1.2, '#2a2a30'), ball(50, 12, 2.8, 2.8, iron), ball(50, 12, 1.2, 1.2, '#2a2a30'),
      ...[[15, 15], [16.5, 17.5], [18, 20]].map(([x, y], i) => i % 2 ? limb(x, y - 1, x + 0.6, y + 1, 0.5, 0.5, iron) : ball(x, y, 1.2, 1.3, iron)),
      ...[[49, 15], [47.5, 17.5], [46, 20]].map(([x, y], i) => i % 2 ? limb(x, y - 1, x - 0.6, y + 1, 0.5, 0.5, iron) : ball(x, y, 1.2, 1.3, iron)),
      // the legs, sagging, bare feet scraping the floor
      limb(27, 48, 22, 58, 3.2, 2.6, '#5a4a3a'), limb(37, 48, 42, 58, 3.2, 2.6, '#5a4a3a'),
      ball(21, 60, 3.6, 1.8, skinDk), ball(43, 60, 3.6, 1.8, skinDk), specks([[18.5, 60.75], [20, 61], [44, 61], [45.5, 60.75]], '#e0c0a0'),
      // the shirt in tatters, the ribs showing through it
      sheet([[22, 27], [42, 27], [44, 50], [40, 48.5], [36, 51], [32, 49], [28, 51], [24, 48.5], [20, 50]], rag, { curve: 1 }),
      sheet([[28, 31], [36, 31], [35, 39], [29, 39]], skin, { curve: 1 }), ...[33, 35, 37].map(y => hair(29.5, y, 34.5, y, skinDk)),
      hair(24, 30, 26, 46, ragDk), hair(40, 30, 38, 46, ragDk), line(28, 42, 31, 48, ragDk), specks([[28, 49], [34, 49.5], [40, 49]], ragDk),
      // the arms up, the wrists in irons, the brand raw on one
      limb(23, 29, 20, 21, 2.4, 2, skin), limb(41, 29, 44, 21, 2.4, 2, skin),
      ball(19.6, 21.6, 3, 2.4, iron), ball(44.4, 21.6, 3, 2.4, iron), hair(17.5, 20, 21.5, 20, ironLt), hair(42.5, 20, 46.5, 20, ironLt),
      ...[0, 1, 2].map(i => limb(18 + i * 1.4, 19.6, 17.6 + i * 1.6, 17, 0.5, 0.4, skin)), ...[0, 1, 2].map(i => limb(46 - i * 1.4, 19.6, 46.4 - i * 1.6, 17, 0.5, 0.4, skin)),
      ball(43, 26, 1.6, 1.2, '#c03020'), specks([[42.5, 25.5], [43.5, 26.5]], '#ff6040'),
      // the head hanging forward: matted hair, a beard, eyes shut
      limb(32, 24, 32, 28, 2.2, 2.4, skinDk),
      ball(32, 19, 6.8, 7.2, skin), ball(32, 23.6, 5.2, 3.2, '#6a4a30'), ...[29, 31, 33, 35].map(x => hair(x, 24, x + 0.25, 27, '#4a3020')),
      sheet([[25, 18], [26, 12], [32, 10.4], [38, 12], [39, 18], [37, 14.6], [32, 13.4], [27, 14.6]], '#4a3020', { curve: 0.8 }),
      hair(26, 14, 25.5, 21, '#3a2418'), hair(38, 14, 38.5, 21, '#3a2418'),
      hair(27.5, 18.25, 30.5, 18.75, '#2a1a14'), hair(33.5, 18.75, 36.5, 18.25, '#2a1a14'), limb(32, 18, 32.4, 21, 0.7, 1, skin),
      hair(29, 21, 30, 22, '#8a6a50'), specks([[34, 15.5], [30, 16]], skinDk),
    ];
  },
  // a ring of worked stone older than the delve, a rope going down, coins on the lip
  well: () => {
    const stone = '#7a746a', stoneDk = '#5a544c', wood = '#6a4424', woodDk = '#4a2e18';
    return [
      // the posts and the little roof over it, shingled
      limb(12, 38, 12, 12, 2, 2, wood), limb(52, 38, 52, 12, 2, 2, wood), hair(11.5, 14, 11.5, 36, woodDk), hair(51.5, 14, 51.5, 36, woodDk),
      sheet([[6, 13], [58, 13], [48, 3], [16, 3]], '#5a3a20', { tilt: [0, -0.7] }), ...[6, 9.5].map(y => hair(10 + (13 - y), y, 54 - (13 - y), y, '#7a5030')),
      ...[18, 24, 30, 36, 42, 48].map(x => hair(x, 4, x - (x - 32) * 0.15, 12.5, woodDk)),
      // the windlass, the rope down, the bucket on it
      limb(12, 18, 52, 18, 1.6, 1.6, wood), hair(13, 17, 51, 17, '#8a6038'), limb(52, 18, 56, 22, 0.8, 0.8, wood),
      ...[0, 1, 2, 3].map(i => limb(30 + i * 1.3, 16.4, 30 + i * 1.3, 19.6, 0.5, 0.5, '#c8b088')),
      limb(32, 19, 32, 28, 0.4, 0.4, '#c8b088'), specks([[32, 21], [32, 23.5], [32, 26]], '#e8d8b0'),
      sheet([[28, 28], [36, 28], [35, 35], [29, 35]], '#7a5030', { curve: 0.6 }), limb(28, 30, 36, 30, 0.4, 0.4, '#3a2a18'), limb(28.6, 33, 35.4, 33, 0.4, 0.4, '#3a2a18'),
      // the ring of stone, blocks in courses, moss in the joints
      sheet([[10, 38], [54, 38], [54, 61.2], [10, 61.2]], stone, { curve: 1 }),
      ...[46, 53].map(y => hair(10, y, 54, y, stoneDk)),
      ...[[18, 38, 46], [30, 38, 46], [42, 38, 46], [24, 46, 53], [36, 46, 53], [48, 46, 53], [14, 53, 61], [28, 53, 61], [40, 53, 61]].map(([x, a, b]) => hair(x, a, x, b, stoneDk)),
      specks([[16, 42], [30, 43], [44, 42], [20, 50], [34, 50], [46, 51], [18, 57], [38, 58]], '#9a948a'),
      specks([[24, 46], [42, 53], [14, 54]], '#5a8040'),
      ball(32, 38, 22, 6, '#8a847a'), ball(32, 38, 17, 4, '#14202c'), ball(32, 38.6, 12, 2.4, '#0e1620'),
      hair(26, 38, 30, 37.5, '#6a8aaa'), specks([[38, 37], [36, 39]], '#aac8e8'),
      ...[[14, 36], [18, 34.4], [48, 34.4], [52, 36]].map(([x, y]) => ball(x, y, 1.2, 0.7, '#e8c040')),
    ];
  },
  // a tall case of books in the dark, one spine among them lit gold
  bookcase: () => {
    const cols = ['#7a2a2a', '#2a4a6a', '#4a6a2a', '#6a5a2a', '#5a2a5a', '#8a6a3a', '#3a5a5a'];
    const books = [];
    [[6, 17.2], [20, 33.2], [36, 49.2]].forEach(([top, bottom], row) => {
      let x = 14;
      for (let i = 0; x < 50; i++) {
        const w = 2.8 + ((i + row) % 3) * 1, h = (bottom - top) - ((i * 7 + row * 3) % 4) * 1.6;
        const gold = row === 1 && i === 3, c = gold ? '#c8a040' : cols[(i * 3 + row) % cols.length];
        if ((i + row * 2) % 7 === 5) { x += w + 0.8; continue; }
        if ((i + row) % 9 === 7) books.push(sheet([[x, bottom], [x + 2.4, bottom - h * 0.95], [x + 2.4 + w, bottom - h * 0.92], [x + w, bottom]], c, { curve: 0.6 }));
        else books.push(sheet([[x, bottom - h], [x + w, bottom - h], [x + w, bottom], [x, bottom]], c, { curve: 0.6 }),
          hair(x + 0.6, bottom - h + 1.5, x + w - 0.6, bottom - h + 1.5, gold ? '#fff0a0' : '#e8d8a8'), hair(x + 0.6, bottom - 2, x + w - 0.6, bottom - 2, '#e8d8a8'),
          ...(gold ? [hair(x + w / 2, bottom - h + 3, x + w / 2, bottom - 4, '#fff0a0', { glows: true })] : []));
        x += w + 0.8;
      }
    });
    return [
      ball(32, 62, 20, 1.6, '#2a2018'),
      sheet([[10, 4], [54, 4], [54, 62], [10, 62]], '#3a2618', { curve: 0.3 }), sheet([[12, 5], [52, 5], [52, 50], [12, 50]], '#22160e'),
      ...books,
      ...[18.4, 34.4, 50.4].map(y => limb(11, y, 53, y, 1.8, 1.8, '#6a4424')), ...[17.5, 33.5, 49.5].map(y => hair(12, y, 52, y, '#8a6038')),
      limb(11, 4, 11, 62, 1.4, 1.4, '#5a3a20'), limb(53, 4, 53, 62, 1.4, 1.4, '#4a2e18'),
      specks([[12, 10], [52, 10], [12, 26], [52, 26], [12, 42], [52, 42]], '#5a3e28'),
      // books fallen on the floor, one open
      sheet([[16, 53], [28, 52], [29, 58], [17, 59]], '#6a3a2a', { tilt: [-0.1, -0.8] }), sheet([[32, 55], [44, 54.4], [44.6, 58.6], [32.4, 59]], '#e8d8b0', { tilt: [0, -0.8] }),
      hair(38, 54.6, 38.2, 58.8, '#a89878'), hair(33.5, 56, 37, 55.75, '#8a7a5a'), hair(39, 55.75, 43, 55.5, '#8a7a5a'),
      specks([[14, 60], [50, 60], [24, 61]], '#4a3020'),
    ];
  },
  // an ogre asleep on a bed of stolen coin, snoring like a rockfall
  ogre_sleep: () => [
    ...CREATURES.ogre(),
    ball(18, 60, 8, 2.8, '#a87a20'), ball(32, 60.8, 9, 2.4, '#b8882a'), ball(46, 60, 8, 2.8, '#a87a20'),
    ...[[13, 59], [18, 58.4], [23, 59.4], [27, 60], [32, 59.2], [37, 60], [41, 59.4], [46, 58.4], [51, 59]].map(([x, y], i) => ball(x, y, 2.2, 0.8, i % 2 ? '#d8a830' : '#c89a28')),
    ...[[15, 58.75], [30, 59], [44, 58.25], [49, 58.75]].map(([x, y]) => hair(x - 1, y, x + 1, y, '#fff0a0')),
    ball(24, 57, 0.8, 2, '#c89a28'), ball(40, 57.4, 0.8, 1.8, '#d8a830'),
    specks([[16, 58.5], [30, 60.5], [44, 58.5], [36, 60.5]], '#fff0a0'),
    // the snore, drawn clear of the club over its other shoulder: a Z, then a smaller one
    ...[[8, 4.5, 16, 11.5, 1, '#dde8ff'], [18, 12.5, 23.5, 17.5, 0.8, '#b8c8f0']].flatMap(([x0, y0, x1, y1, r, c]) => [
      limb(x0, y0, x1, y0, r, r, c), limb(x1, y0, x0, y1, r, r, c), limb(x0, y1, x1, y1, r, r, c)]),
    specks([[24, 59], [38, 60], [52, 59], [13, 60]], '#fff8c0'),
    // eyes shut: lids over both, a dark line where they meet
    ball(28.4, 15, 2, 1.4, '#9a7648'), ball(35.6, 15, 2, 1.4, '#9a7648'),
    hair(26.75, 15.5, 30, 15.75, '#3a2410'), hair(34, 15.75, 37.25, 15.5, '#3a2410'),
  ],
  // a tall mirror in a gilt frame, where no mirror should be, and in it a
  // figure that is not yours
  mirror: () => [
    limb(22, 62, 26, 50, 1.6, 1.4, '#4a3020'), limb(42, 62, 38, 50, 1.6, 1.4, '#4a3020'), limb(32, 52, 32, 62, 1.2, 1.2, '#3a2418'),
    ball(32, 28, 18, 25, '#c8a040'), ball(32, 28, 16.4, 23.4, '#a07828'),
    ...[[32, 3], [16, 16], [48, 16], [14, 40], [50, 40], [32, 53]].map(([x, y]) => ball(x, y, 2.4, 2, '#e0b848')),
    ball(32, 28, 14, 21, '#7a90a8'), ball(27, 20, 6, 10, '#9ab0c8'),
    // the figure in the glass: a hooded shape, eyes lit red
    ball(32, 22, 4.6, 5, '#5a6a80'), sheet([[24, 31], [40, 31], [42, 46], [22, 46]], '#5a6a80', { curve: 0.8 }), ball(32, 28.6, 6, 2, '#4a5a70'),
    ball(30, 22, 0.9, 0.8, '#ff4040', { glows: true }), ball(34, 22, 0.9, 0.8, '#ff4040', { glows: true }),
    line(22, 16, 26, 10, '#e8f4ff'), line(24, 20, 28, 14, '#c8dcf0'), hair(36, 10, 40, 16, '#e8f4ff'), hair(38, 32, 42, 38, '#c8dcf0'),
    specks([[18, 14], [46, 14], [16, 28], [48, 28], [18, 42], [46, 42], [32, 51]], '#fff0a0'),
    ball(32, 3.6, 4, 2.8, '#e0b848'), hair(30, 2, 34, 2, '#fff0a0'),
    hair(22, 60, 25, 52, '#6a4a30'),
  ],
  // a painted chest alone in the open, a wire running from its lid into the wall
  chest: () => {
    const red = '#8a2a2a', redLt = '#a03838', gold = '#c8a040', goldLt = '#e0b848';
    return [
      ball(32, 61, 22, 2, '#2a1c18'),
      sheet([[12, 38], [52, 38], [54, 59], [10, 59]], red, { curve: 0.9 }),
      sheet([[12, 39], [52, 39], [50, 28], [42, 24], [22, 24], [14, 28]], redLt, { tilt: [0, -0.6] }),
      ...[[18, 44], [30, 50], [42, 45], [24, 32], [38, 30]].map(([x, y]) => hair(x, y, x + 5, y + 0.5, '#6a1a1a')),
      limb(10, 58, 54, 58, 0.8, 0.8, gold), limb(12, 38, 52, 38, 0.8, 0.8, gold), hair(13, 37.5, 51, 37.5, '#fff0a0'),
      limb(20, 26, 20, 58, 0.8, 0.8, gold), limb(44, 26, 44, 58, 0.8, 0.8, gold),
      ...[20, 44].map(x => specks([[x, 30], [x, 42], [x, 50], [x, 56]], '#a07820')),
      // the hasp and lock, and painted scrollwork either side
      sheet([[29, 36], [35, 36], [35, 44], [29, 44]], goldLt, { curve: 0.5 }), ball(32, 40, 0.9, 0.9, '#2a1a10'), limb(32, 40.5, 32, 42.4, 0.4, 0.4, '#2a1a10'),
      ...[[25, 47], [39, 47]].map(([x, y]) => [hair(x - 2, y, x + 2, y - 2, goldLt), hair(x + 2, y - 2, x + 3, y + 1, goldLt)]).flat(),
      // the wire from the lid into the wall, catching the light
      line(48, 26, 60, 16, '#d0d4dc'), ball(61, 15, 2.6, 2.6, '#1a1418'), specks([[54, 21], [58, 17.5]], '#ffffff'),
      specks([[60, 14], [62, 16]], '#ff4020'),
    ];
  },
  // a goblin on a crate beside a hand-painted sign, cup out for the toll
  goblin_toll: () => [
    limb(7, 62, 7, 26, 1.4, 1.4, '#6a4424'), hair(6.5, 30, 6.5, 60, '#8a6038'),
    ...CREATURES.goblin(),
    sheet([[1, 17], [19, 17], [19, 29], [1, 29]], '#b08a58', { tilt: [-0.1, -0.2] }), hair(2, 21, 18, 21, '#8a6a40'), hair(2, 25.5, 18, 25.5, '#8a6a40'),
    // the letters, daubed: a T and an O
    limb(4, 20.5, 10, 20.5, 0.75, 0.75, '#3a2410'), limb(7, 20.5, 7, 27.2, 0.75, 0.75, '#3a2410'),
    ...Array.from({ length: 10 }, (_, i) => { const a0 = i / 10 * Math.PI * 2, a1 = (i + 1) / 10 * Math.PI * 2; return limb(14.5 + Math.cos(a0) * 2.4, 23.8 + Math.sin(a0) * 3.4, 14.5 + Math.cos(a1) * 2.4, 23.8 + Math.sin(a1) * 3.4, 0.7, 0.7, '#3a2410'); }),
    // the sign's nails and its grain
    specks([[2, 18], [18, 18], [2, 28], [18, 28]], '#7a5a30'), hair(1, 23, 19, 23, '#9a7648'),
  ],
  // a wall of shields across the passage, and a banner still standing over them
  barricade: () => {
    const heater = (cx, c) => [sheet([[cx - 7.2, 38], [cx + 7.2, 38], [cx + 7.2, 49], [cx, 61], [cx - 7.2, 49]], c, { curve: 1 }),
      hair(cx - 6, 39.5, cx + 6, 39.5, '#c8ccd4'), ball(cx, 46, 2.2, 2.2, '#c8ccd4'), specks([[cx - 5, 41], [cx + 5, 41], [cx - 4, 52], [cx + 4, 52]], '#8a8e96')];
    return [
      limb(32, 62, 32, 5, 1.4, 1.4, '#6a4424'), hair(31.5, 8, 31.5, 60, '#8a6038'), ball(32, 4.4, 1.8, 1.8, '#c8a040'),
      sheet([[33, 6], [55, 6], [53, 22], [49, 19], [43, 24], [33, 22]], '#8a2a2a', { curve: 0.8 }),
      sheet([[40, 10], [46, 10], [46, 16], [40, 16]], '#e0b848', { curve: 0.5 }), hair(43, 11, 43, 15, '#8a2a2a'),
      hair(36, 8, 52, 9, '#a03838'), hair(38, 18, 44, 20, '#5a1a1a'),
      ...heater(12, '#2e4a7a'), ...heater(52, '#4a6a3a'), ...heater(25, '#7a2a2a'), ...heater(39, '#6e7480'),
      limb(25, 41, 25, 55, 0.6, 0.6, '#e0b848'), limb(20, 46, 30, 46, 0.6, 0.6, '#e0b848'),
      // a helm left on top, and a skull in front
      ball(19, 36, 6.4, 5.2, '#7a808c'), ball(19, 38, 6.4, 1.2, '#5a606c'), limb(15, 36, 23, 36, 0.6, 0.6, '#1a1418'), hair(15, 33, 19, 31.5, '#c8ccd4'),
      ball(47, 59.2, 4, 3.2, '#ddd5bd'), ball(45.6, 58.6, 1.1, 1, '#140e14'), ball(48.4, 58.6, 1.1, 1, '#140e14'), specks([[46, 61], [47, 61], [48, 61]], '#f6f0de'),
    ];
  },
  // a swordsman who died mid-duel: a pale coat over a trail of mist, a
  // feathered hat, the free hand raised behind him and a long blade held low
  duelist_ghost: () => {
    const coat = '#8aa6d6', coatDk = '#6a86b6', cloak = '#46587e', mist = '#5e7298', face = '#cfe2f8', hat = '#3c4c70';
    return [
      // the cloak behind, ragged, and the mist where his legs should be
      sheet([[22, 21], [42, 21], [48, 40], [44, 47], [39, 42], [32, 49], [25, 42], [20, 47], [16, 40]], cloak, { curve: 0.8 }),
      limb(32, 42, 32, 59, 8.4, 1.2, '#3a4868', { glows: true }), limb(32, 40, 31, 57, 6.4, 0.8, mist, { glows: true }),
      limb(28, 42, 21, 53, 2.8, 0.6, mist, { glows: true }), limb(36, 42, 43, 52, 2.6, 0.6, mist, { glows: true }),
      // the coat, buttoned, a sash, lace at the throat
      sheet([[25, 21], [39, 21], [41, 33], [39, 42], [25, 42], [23, 33]], coat, { curve: 1 }),
      sheet([[25, 21], [28, 21], [27, 42], [25, 42], [23, 33]], coatDk, { curve: 0.5 }),
      limb(24, 34, 40, 34, 0.8, 0.8, '#4e6490'), ...[25, 29, 33, 38].map(y => ball(32, y, 0.7, 0.7, '#e8f0ff')),
      ball(32, 21.6, 4.4, 2, '#e6eefa'), specks([[30, 23], [32, 23.5], [34, 23]], '#ffffff'),
      // the free hand raised behind, the sword arm low, the long blade
      limb(39, 23, 47, 23, 2.4, 2, coat), limb(47, 23, 49, 15, 2, 1.6, coat), ball(49.2, 14, 2.2, 2, face),
      limb(25, 23, 21, 32, 2.6, 2.2, coat), limb(21, 32, 18, 39, 2.2, 1.8, coat),
      line(18, 42, 4, 60, '#e4eeff', { lit: 1, glows: true }), hair(17, 42, 5, 58, '#ffffff', { glows: true }),
      limb(14, 38, 20, 44, 0.6, 0.6, '#8a9cc0'), ball(17.4, 40.4, 2.6, 2.4, face),
      // the face, thin, a moustache, eyes dark
      ball(32, 15.2, 5.4, 6, face), ball(30, 13, 2.4, 2.6, '#e8f4ff'),
      ball(29.6, 14.4, 1, 0.8, '#1a2440'), ball(34.4, 14.4, 1, 0.8, '#1a2440'), hair(29, 18, 32, 17.5, '#8aa0c0'), hair(32, 17.5, 35, 18, '#8aa0c0'),
      // the hat, broad-brimmed, a long feather off it
      ball(32, 7.8, 5.8, 3.8, hat), ball(32, 10.4, 10, 2.2, hat), hair(23, 10, 41, 10, '#5a6a90'),
      limb(28, 6, 19, 3, 2, 1, '#e8f4ff'), limb(19, 3, 15, 6, 1.2, 0.6, '#e8f4ff'), ...[0, 1, 2, 3].map(i => hair(27 - i * 3, 5.5 - i * 0.6, 26 - i * 3, 3 - i * 0.6, '#c8dcff')),
      specks([[12, 24], [52, 32], [10, 48], [48, 50], [18, 56], [54, 42], [14, 36]], '#c8dcff', { glows: true }),
    ];
  },
  // bundles of grey silk hung from the roof like fruit, one with a sword hilt
  // out of it and one at the back that moves, and what fell out of them below
  silk_larder: () => {
    const silk = '#c8c4bc', silkDk = '#a8a49c', bone = '#ddd5bd', worn = '#a89e84';
    /** each bundle a spindle: tied off at the top, drawn to a point below, wound round with thread */
    const cocoon = (x, y, rx, ry, c) => [limb(x, y - ry - 2, x, y - ry * 0.5, 0.8, rx * 0.5, c), ball(x, y, rx, ry, c), limb(x, y + ry * 0.5, x + 0.6, y + ry + 3.6, rx * 0.6, 0.5, c),
      ...[-0.5, -0.1, 0.3].map(f => hair(x - rx * 0.9, y + ry * f, x + rx * 0.9, y + ry * f + 1.5, silkDk)), ball(x - rx * 0.35, y - ry * 0.3, rx * 0.3, ry * 0.3, '#e0dcd4')];
    return [
      // the threads go up into the dark, not to the top of the picture
      ...[14, 26, 38, 49].map(x => hair(x, 0, x, 5, '#4a4a58')),
      hair(14, 6, 14, 9, '#9a9aa6'), hair(26, 6, 26, 17, '#9a9aa6'), hair(38, 6, 38, 11, '#8a8a96'), hair(49, 6, 49, 21, '#9a9aa6'), hair(14, 29, 12, 34, '#9a9aa6'),
      ...cocoon(38, 20, 4.4, 6.8, '#8e8a84'), ball(41.2, 21.6, 2, 2.6, '#8e8a84'), hair(41, 19, 42.5, 23, '#6e6a64'),
      ...cocoon(14, 19, 5.2, 8.4, silk),
      ...cocoon(12, 41, 3.4, 5.2, '#bcb8b0'),
      ...cocoon(49, 33, 6.4, 10, silk),
      limb(53.2, 25, 57.6, 15.6, 1.1, 1, '#6a4424'), line(50, 24, 56, 28, '#a8acb4', { lit: 1 }), ball(58, 14.4, 2, 2, '#c8a040'),
      ...cocoon(26, 31, 7.6, 11.6, silk),
      // what fell out of them: a skull, long bones, threads trailing on the floor
      ball(19, 58.8, 4.6, 3.8, bone), ball(20, 62, 3, 1.4, worn), ball(17, 58.4, 1.2, 1.1, '#140e14'), ball(21, 58.4, 1.2, 1.1, '#140e14'),
      limb(30, 60.6, 46, 58.6, 1.2, 1.1, bone), ball(29.6, 60.8, 2, 1.6, bone), ball(46.6, 58.4, 2, 1.6, bone),
      limb(50, 62, 56, 60, 1, 0.9, worn), hair(24, 61, 36, 62.5, '#9a9aa6'), hair(8, 60, 14, 62, '#9a9aa6'),
    ];
  },
  // a skeleton with a cup of dice, and a pot of gold in front of it
  bones: () => {
    const bone = '#ddd5bd', worn = '#a89e84', socket = '#140e14';
    return [
      // legs out in front, the feet fallen sideways
      limb(26, 50, 14, 58, 2, 1.8, worn), limb(38, 50, 50, 58, 2, 1.8, worn), ball(26, 50, 1.6, 1.6, bone), ball(38, 50, 1.6, 1.6, bone),
      ball(12, 59.6, 3.6, 2, bone), ball(52, 59.6, 3.6, 2, bone), specks([[9, 60], [10.5, 61], [53.5, 61], [55, 60]], worn),
      // the pelvis, the spine, the ribs
      ball(32, 49, 7.2, 3.6, bone), ball(29, 49, 1.6, 1.2, worn), ball(35, 49, 1.6, 1.2, worn),
      limb(32, 26, 32, 48, 1.2, 1.2, worn), ...[28, 30, 32, 34].map(y => hair(31, y, 33, y, '#8a8070')),
      ...[31, 35, 39].map(y => [limb(25, y, 32, y - 1, 1, 1, bone), limb(39, y, 32, y - 1, 1, 1, bone)]).flat(),
      ...[31, 35, 39].map(y => hair(26, y + 0.75, 31, y, '#8a8070')),
      // the arms: one hanging, one holding the dice cup
      limb(24, 30, 20, 42, 1.6, 1.4, bone), ball(20, 42, 1.4, 1.4, bone), limb(20, 42, 22, 50, 1.4, 1.2, bone),
      limb(40, 30, 42, 42, 1.6, 1.4, bone), ball(42, 42, 1.4, 1.4, bone),
      ball(42, 44, 4, 3.4, '#7a5030'), ball(42, 41.6, 3.4, 1, '#3a2010'), hair(39, 45, 45, 45, '#5a3a20'), ball(40, 40, 1, 1, '#f4ecd8'), ball(44, 40, 1, 1, '#f4ecd8'),
      // the skull, grinning
      ball(31, 20, 8.4, 8, bone), ball(31, 27.2, 5.2, 2.6, worn), ball(28, 16, 3, 2, '#ece4cc'),
      ball(27.6, 20, 2.4, 2.4, socket), ball(34.4, 20, 2.4, 2.4, socket), sheet([[30, 23], [32, 23], [31, 25]], socket),
      ...[27, 29, 31, 33, 35].map(x => limb(x, 26.4, x, 28, 0.6, 0.5, '#f6f0de')), hair(26, 27, 36, 27, '#8a8070'),
      hair(34, 14, 36, 18, '#a89e84'),
      // the pot of gold, and two dice thrown
      ball(20, 58, 6.8, 4, '#a07830'), ball(20, 56, 5.2, 2.8, '#e8c040'), specks([[18, 54], [22, 54], [20, 52], [17, 56], [23, 56]], '#fff0a0'),
      ...[[34, 59], [43, 61]].map(([x, y]) => [sheet([[x, y], [x + 3, y], [x + 3, y + 3], [x, y + 3]], '#f4ecd8', { curve: 0.4 }), specks([[x + 1, y + 1], [x + 2, y + 2]], '#1a1418')]).flat(),
    ];
  },
  // a thin brown hound curled in a corner, a frayed collar, one ear up
  stray: () => {
    const coat = '#7a5030', dark = '#523218', pale = '#b8905e', grain = '#5a3a1e';
    return [
      ball(32, 61, 22, 2, '#2a1c14'),
      // the body curled round, ribs showing, the tail tucked over its feet
      ball(30, 52, 20, 9, coat), ball(30, 49, 16, 4.8, dark), ball(28, 57, 14, 3.4, pale),
      ...[22, 27, 32, 37].map(x => hair(x, 49, x + 1.5, 55, grain)),
      limb(12, 55, 8, 50, 2.4, 1.4, dark), limb(8, 50, 10, 46, 1.4, 0.8, dark), hair(10, 53, 8, 49, '#3a2210'),
      // the forelegs folded under the chin, the paws
      limb(36, 58, 50, 59, 2.4, 2, coat), ball(51, 59.4, 2.8, 1.6, pale), specks([[52.5, 60], [53.5, 59.5]], '#e8dcc8'),
      // the head laid on its paws: one ear up, one flopped, the muzzle long
      ball(45, 50, 8, 6.8, coat), ball(42, 47, 4, 2.6, '#8a6040'),
      sheet([[40, 45], [37, 37], [43, 44]], dark, { curve: 0.6 }), sheet([[41, 45], [39, 39.6], [42.4, 44.4]], '#8a5a4a'),
      sheet([[49, 45], [52, 51], [50, 54]], dark, { curve: 0.6 }),
      limb(44, 54, 55, 55, 3.2, 2.4, '#96683e'), ball(55.6, 54.8, 2.2, 1.6, '#1a1210'), specks([[55, 54]], '#6a5a50'),
      hair(48, 56.5, 55, 56.5, '#3a2010'),
      // eyes half open, watching you
      ball(44, 48.6, 1.4, 0.8, '#2a1808'), ball(48, 48.6, 1.4, 0.8, '#2a1808'), specks([[43.5, 48.25], [47.5, 48.25]], '#f0d8a0'),
      hair(42.5, 47.5, 45.5, 47.75, dark), hair(46.5, 47.75, 49.5, 47.5, dark),
      // the frayed collar with its tag
      limb(39, 55, 48, 57, 1.8, 1.8, '#a02828'), hair(40, 54, 47, 56, '#c04040'), ball(44, 58.4, 1.6, 1.6, '#d8b848'), specks([[43.5, 58]], '#fff4c0'),
      hair(38, 56, 37, 58, '#a02828'),
    ];
  },
  // a squat iron cage, banded top and bottom and its door shut with a heavy
  // padlock, and a goblin crouched inside with its fingers round the bars,
  // peering out between them to see what you will do
  cage: () => {
    const iron = '#555a64', ironLt = '#8a909a', far = '#2e3038', skin = '#72ac4c', dark = '#4c7e34', foot = '#5a8c3c', rag = '#80705c', ragDk = '#5a4c3c';
    // the bars stand either side of the middle, with a wider gap at the door so the face shows whole through it
    const bars = [11, 18, 25, 39, 46, 53];
    return [
      // the cage's floor, dark and strewn with straw, and its far bars
      sheet([[9, 51], [55, 51], [55, 58], [9, 58]], '#3a3630', { tilt: [0, -0.9] }),
      ...[[12, 56, 16, 54], [44, 55, 49, 56.5], [28, 57, 34, 56], [20, 53, 24, 54]].map(([a, b, c, d]) => hair(a, b, c, d, '#a8904a')),
      ...[14.4, 21.6, 28.8, 35.2, 42.4, 49.6].map(x => limb(x, 20, x, 52, 0.9, 0.9, far)),
      // the goblin, squatting on its heels, knees out, reaching for the bars
      ...both64(limb(28.8, 52.8, 21, 50, 2.4, 2.2, dark)), ...both64(ball(21, 49.6, 2.8, 2.6, dark)),
      ...both64(limb(21, 50, 26, 55, 2, 1.7, dark)), ...both64(ball(26, 55.8, 3.6, 1.6, foot)), ...both64(specks([[23.5, 56.5], [25, 57], [26.5, 57]], '#e8e0c0')),
      ball(32, 49, 6.4, 6, skin), hair(29, 47, 30, 50, dark), hair(35, 47, 34, 50, dark),
      sheet([[24, 42.4], [40, 42.4], [44.8, 44.8], [46, 50], [43.2, 48.8], [41.2, 51.6], [38.4, 49.2], [35.2, 52], [32, 49.6], [28.8, 52], [25.6, 49.2],
        [22.8, 51.6], [20.8, 48.8], [18, 50], [19.2, 44.8]], rag, { curve: 1 }),
      ...[[22, 48], [28, 50], [36, 50], [42, 48]].map(([x, y]) => hair(x, y, x + 0.5, y + 2, ragDk)),
      // elbows out over its knees, hands up to the door bars under its chin, the manacle still on
      ...both64(limb(21, 48, 24.4, 43.6, 1.8, 1.7, skin)),
      limb(21.2, 44.8, 24.4, 46.8, 1.7, 1.7, iron), hair(21.5, 44, 24, 45.5, ironLt), ball(21.2, 48.8, 1.5, 1.6, iron),
      ...both64(ball(25, 42.4, 2.5, 2.3, skin)),
      ...scragHead(32, 34.8, { look: 0 }),
      // the near bars, in front of it all, and the fingers curled round them
      ...bars.flatMap(x => [limb(x, 18, x, 57.2, 1.2, 1.2, iron), hair(x - 0.5, 20, x - 0.5, 56, ironLt)]),
      ...both64(limb(23.2, 41.8, 26.8, 41.8, 1.1, 1.1, skin)), ...both64(specks([[24, 43], [26, 43]], '#e8e0c0')),
      // the door's rails and hinges
      limb(25, 24, 39, 24, 1.1, 1.1, iron), limb(25, 48, 39, 48, 1.1, 1.1, iron), hair(25.5, 23.25, 38.5, 23.25, ironLt),
      ball(25, 26, 1.8, 2.2, '#484c56'), ball(25, 46, 1.8, 2.2, '#484c56'),
      // the bands top and bottom, riveted, and a ring on top to hang it by
      limb(28.4, 15.2, 30, 10.8, 1.1, 1.1, iron), limb(35.6, 15.2, 34, 10.8, 1.1, 1.1, iron), limb(30, 10.4, 34, 10.4, 1.1, 1.1, iron),
      sheet([[7.6, 14.8], [56.4, 14.8], [56.4, 20], [7.6, 20]], iron, { curve: 0.8 }), hair(8, 15.25, 56, 15.25, ironLt),
      sheet([[7.6, 56.8], [56.4, 56.8], [56.8, 62], [7.2, 62]], iron, { curve: 0.8 }), hair(8, 57.25, 56, 57.25, ironLt),
      specks([11, 18, 25, 39, 46, 53].flatMap(x => [[x, 17], [x, 59]]), '#9aa0aa'),
      // rust run from the bands
      hair(11, 26, 11, 30, '#7a4a2a'), hair(53, 44, 53, 49, '#7a4a2a'), specks([[18, 51], [46, 24]], '#7a4a2a'),
      // the padlock, big as a fist, through a hasp on the door's edge
      limb(37.8, 49.2, 37.8, 45.2, 1, 1, '#8a8e96'), limb(42.2, 49.2, 42.2, 45.2, 1, 1, '#8a8e96'), limb(37.8, 44.4, 42.2, 44.4, 1, 1, '#8a8e96'),
      sheet([[35.6, 48.4], [44.4, 48.4], [45.2, 55.6], [34.8, 55.6]], '#6e6248', { curve: 0.9 }),
      ball(40, 51, 0.8, 0.8, '#140e10'), limb(40, 51.5, 40, 53.4, 0.4, 0.4, '#140e10'),
      hair(37, 49, 37, 54, '#b8a878'), specks([[41, 44], [42, 45]], '#c8ccd4'),
    ];
  },

  // one of the Lampfolk, hunched in the dark with its lamp gone cold in its
  // lap: the same grey skin and drooping ears as the traders, the eyes dim
  lampfolk_dark: () => {
    const skin = '#7e8694', skinDk = '#5a6270', skinLt = '#98a0ae', robe = '#5a4c3e', robeDk = '#3e3428', pack = '#4e3e2e';
    return [
      // the pack beside it, the blanket roll, the staff laid down
      ball(48, 40, 12, 14, pack), hair(38, 42, 58, 42, '#3a2c1e'), limb(39, 27, 57, 27, 3.6, 3.6, '#6e3e32'), ...[42, 48, 54].map(x => hair(x, 24, x + 0.5, 30, '#5a2e24')),
      line(8, 36, 26, 60, '#5a4630'), hair(9, 37, 25, 59, '#7a6648'),
      // feet out under the robe
      ...both64(ball(23, 60, 6, 2.6, skin)), ...both64(specks([[18, 60.5], [19.5, 61], [21, 61]], '#a8b0bc')),
      // the robe, hunched, patched
      sheet([[16, 40], [42, 40], [46, 60], [12, 60]], robe, { curve: 1 }), sheet([[16, 40], [20, 40], [16, 60], [12, 60]], robeDk, { curve: 0.4 }),
      sheet([[34, 48], [42, 48], [43, 56], [35, 56]], '#6a5a3e', { curve: 0.6 }), ...[[22, 52], [30, 46], [38, 58]].map(([x, y]) => hair(x, y, x + 0.5, y + 3, robeDk)),
      // the lamp in its lap, cold: dark glass, no flame
      ball(29, 51, 6, 4.8, '#4a4a50'), ball(29, 49, 3.2, 2.4, '#2a2a30'), ball(28, 48, 1.2, 1, '#5a5a62'),
      limb(29, 44, 29, 46, 0.6, 0.6, '#3a3a40'), hair(24, 51, 34, 51, '#3a3a40'),
      // hands cupped round it
      ...both64(limb(19, 42, 25, 51, 2.6, 2.2, robe)), ...both64(ball(25.6, 51.6, 2.6, 2.4, skin)),
      // broad ears that droop, a round head bowed, the great eyes dimmed
      sheet([[21, 27], [8, 35], [10, 38], [21, 33]], skin, { tilt: [-0.5, 0.2] }), sheet([[39, 27], [52, 35], [50, 38], [39, 33]], skin, { tilt: [0.5, 0.2] }),
      sheet([[20, 29], [11, 34.5], [20, 32]], '#8a6e76'), sheet([[40, 29], [49, 34.5], [40, 32]], '#8a6e76'),
      ball(30, 31, 10.8, 9.6, skin), ball(27, 27, 5.4, 3.6, skinLt),
      ...both64(ball(25.4, 31, 3.6, 3.2, '#8a8468')), ...both64(ball(25.4, 31.6, 3.6, 1.6, skinDk)),
      ball(25.6, 31.4, 1, 0.9, '#2a2630'), ball(34.4, 31.4, 1, 0.9, '#2a2630'),
      limb(30, 31, 30, 35, 0.9, 1.4, skin), ball(30, 36, 1.4, 1, skinDk),
      sheet([[27, 38], [33, 38], [32.4, 39], [27.6, 39]], '#4a4452'),
      hair(21, 33, 23, 36, skinDk), hair(39, 33, 37, 36, skinDk), specks([[26, 24], [34, 24.5]], skinDk),
    ];
  },
  // a dwarf-built anvil by a cold hearth, a half-made blade across it
  anvil: () => {
    const iron = '#5a5e66', hi = '#7a7e88', dark = '#4a4e56', stone = '#4a3e38';
    return [
      // the hearth: a column of stone, its mouth black, a last ember in the ash
      sheet([[4, 20], [22, 20], [24, 60], [2, 60]], stone, { curve: 0.5 }), ...[28, 38, 48].map(y => hair(3, y, 23, y, '#3a302a')), hair(12, 21, 12, 28, '#3a302a'), hair(8, 48, 8, 59, '#3a302a'),
      sheet([[7, 34], [19, 34], [20, 48], [6, 48]], '#1e1614', { curve: 0.6 }), ball(13, 47, 6, 1.6, '#3a302a'),
      ball(11, 46, 1, 0.8, '#c84a1a', { glows: true }), specks([[10, 44], [14, 45], [16, 46]], '#6a3a24'),
      // the anvil: foot, waist, body, the horn, its face worn bright
      sheet([[32, 50], [52, 50], [56, 61], [28, 61]], iron, { curve: 0.6 }),
      sheet([[36, 40], [48, 40], [47, 51], [37, 51]], dark, { curve: 0.5 }),
      sheet([[24, 32], [56, 32], [60, 36], [56, 41], [28, 41]], hi, { curve: 0.7 }),
      limb(24, 32, 56, 32, 0.6, 0.6, '#9a9ea8', { lit: 1 }), hair(26, 31.5, 54, 31.5, '#c8ccd4'),
      limb(25, 34, 17, 36, 2.4, 0.6, hi), hair(30, 38, 36, 39, '#4a4e56'), specks([[40, 37], [48, 38], [34, 35]], '#5a5e66'),
      // the half-made blade across it, and the tongs and hammer left by
      line(26, 30, 54, 28, '#b8bcc4', { lit: 1 }), hair(27, 29.5, 52, 27.75, '#e8ecf2'), line(26, 29, 53, 27, '#8a8e96'),
      limb(53, 28, 59, 26, 1, 1, '#6a4a2a'), limb(52, 25, 53.6, 31, 0.6, 0.6, '#8a7a4a'),
      limb(8, 60, 18, 54, 1.6, 1.2, '#6a4a2a'), ball(20, 53, 3.2, 2.8, '#6a6e76'), hair(18, 52, 22, 51.5, '#9a9ea8'),
      specks([[30, 62], [44, 62.5], [56, 62]], '#3a3e44'),
    ];
  },
  // black water in a stone basin, perfectly still, something pale on the bottom
  pool: () => [
    ball(32, 52, 26, 10, '#5a564e'), ball(32, 51, 24, 8.6, '#6a665e'),
    ...[[8, 50], [14, 45], [24, 43], [40, 43], [50, 45], [56, 50], [48, 58], [32, 60], [16, 58]].map(([x, y], i) => [ball(x, y, 4, 2.4, i % 2 ? '#7a766c' : '#6e6a62'), hair(x - 2.5, y - 1, x + 1.5, y - 1.75, '#8a867c')]).flat(),
    ball(32, 52, 21, 7.4, '#0e1218'), ball(26, 50, 10, 2.8, '#1c2430'),
    // the pale thing on the bottom: a face, or a hand
    ball(39, 54, 3.6, 1.6, '#3a3a38'), ball(39, 53.6, 2.4, 1, '#6a6858'), specks([[38, 53.5], [40, 53.5]], '#c8c4a8'),
    line(16, 50, 24, 49, '#3a4a5e'), line(36, 48, 46, 49, '#2a3444'), hair(20, 54, 28, 54, '#2a3444'),
    specks([[22, 49], [44, 50]], '#6a8aaa'),
    ball(12, 42, 4, 3.2, '#6a665e'), ball(53, 43, 4.8, 3.6, '#6a665e'), specks([[10, 41], [52, 42]], '#8a867c'), specks([[14, 61], [50, 62]], '#4a6a3a'),
  ],
  // a goblin cook-pot on its tripod over a low fire, bubbling, a ladle in it
  cookpot: () => [
    // the tripod, lashed at the top, the hook and chain
    limb(14, 61, 26, 14, 1.2, 1, '#5a4030'), limb(50, 61, 38, 14, 1.2, 1, '#5a4030'), limb(32, 62, 32, 14, 1, 0.9, '#4a3020'),
    limb(28, 15, 36, 15, 1.4, 1.4, '#8a7050'), hair(28, 14, 36, 16, '#6a5030'),
    ...[18, 21, 24].map(y => ball(32, y, 0.8, 1, '#3a3a40')),
    // the fire under it: logs, embers, low flame
    ...[[22, 60], [32, 62], [42, 60]].map(([x, y]) => [limb(x - 6, y, x + 6, y - 2, 1.6, 1.6, '#4a3020'), hair(x - 5, y - 1, x + 5, y - 2.5, '#6a4a30')]).flat(),
    ball(32, 57, 10, 4.4, '#c84a1a', { glows: true }), ball(32, 56, 6, 2.8, '#ffb040', { glows: true }), specks([[30, 54], [34, 56], [28, 57]], '#fff0a0', { glows: true }),
    // the pot, black iron, soot round its belly, a rim and two lugs
    ball(32, 40, 16, 13, '#3a3a42'), ball(26, 35, 6, 5, '#4a4a54'), ball(32, 49, 12, 3.4, '#2a2a30'),
    ...both64(ball(16.4, 34, 2, 2.6, '#3a3a42')),
    ball(32, 30, 15, 4, '#5a4a2a'), ball(32, 29.4, 13, 2.8, '#6a5a32'),
    // what is in it: lumps, a bone, bubbles
    ball(26, 29.6, 2.8, 1.6, '#7a6a3a'), ball(38, 29, 2.4, 1.4, '#7a6a3a'), limb(30, 30, 35, 28.6, 0.8, 0.8, '#d8d0bc'),
    ...[[24, 28.5], [33, 30.5], [41, 29.5]].map(([x, y]) => ball(x, y, 0.9, 0.6, '#9a8a50')),
    // the ladle, and steam curling up
    line(36, 30, 46, 12, '#8a6a3a'), ball(36, 30, 3.2, 1.6, '#6a5a3a'), hair(37, 28, 45, 13, '#a88a5a'),
    specks([[28, 22], [34, 18], [30, 14], [36, 24], [26, 17], [32, 9]], '#b8b4a8'), hair(30, 26, 28, 20, '#8a8880'), hair(34, 25, 36, 18, '#8a8880'),
    hair(22, 38, 26, 44, '#2a2a30'), specks([[40, 36], [44, 40], [20, 42]], '#5a5a62'),
  ],
  // a stone knight kneeling on its plinth, head bowed, a real sword on its knees
  statue: () => {
    const stone = '#8a867c', stoneLt = '#9a968c', dark = '#6a665e', moss = '#4a6a3a';
    return [
      // the plinth, its edge chipped, moss in the cracks
      sheet([[8, 50], [56, 50], [56, 62], [8, 62]], dark, { curve: 0.5 }), limb(8, 50, 56, 50, 0.6, 0.6, '#9a968c'),
      hair(16, 52, 18, 60, '#5a564e'), hair(44, 54, 47, 61, '#5a564e'), specks([[10, 52], [12, 53], [14, 55], [48, 52], [52, 54], [54, 56]], moss),
      // one knee down, one up, the cloak falling behind
      sheet([[18, 22], [46, 22], [50, 50], [14, 50]], dark, { curve: 0.8 }),
      limb(24, 44, 14, 49, 4, 3.2, stone), ball(13, 49, 4.4, 2, stone),
      limb(40, 40, 48, 49, 4, 3.6, stone), ball(48, 49, 3.6, 3.4, stoneLt),
      // the body in stone mail, a surcoat, the arms resting on the crossguard
      sheet([[20, 22], [44, 22], [46, 44], [18, 44]], stone, { curve: 0.8 }), sheet([[25, 26], [39, 26], [40, 44], [24, 44]], stoneLt, { curve: 0.8 }),
      ...[28, 32, 36].map(y => hair(21, y, 25, y, dark)), ...[28, 32, 36].map(y => hair(39, y, 43, y, dark)), hair(32, 27, 32, 43, dark),
      ...both64(limb(21, 24, 23, 38, 3, 2.6, stone)), ...both64(ball(23.4, 38.6, 3, 2.6, stoneLt)),
      // the head bowed in a great helm
      ball(32, 16, 7.6, 8, stoneLt), limb(26, 17, 38, 17, 0.6, 0.6, '#4a4640'), hair(32, 18, 32, 23, '#5a564e'), ball(30, 12, 3, 2.4, '#aaa69c'),
      // the real sword: steel, its grip bound, laid across the knees; and tears of water down the helm
      line(10, 39, 54, 39, '#c8ccd4', { lit: 1 }), line(10, 40.4, 54, 40.4, '#8e929a', { lit: 1 }), hair(12, 38.75, 52, 38.75, '#f0f4fa'),
      limb(15, 36, 15, 43, 0.8, 0.8, '#9a7a3a'), limb(11, 39.6, 15, 39.6, 1, 1, '#5a3a20'), ball(9.6, 39.6, 1.4, 1.4, '#c8a040'),
      hair(29, 20, 29, 28, '#8ab0d8'), hair(35, 20, 35, 30, '#8ab0d8'),
      specks([[22, 42], [42, 26], [20, 30], [30, 10], [38, 46]], moss), specks([[18, 56], [30, 58], [44, 56]], '#5a564e'),
    ];
  },
  // a grinning idol of green stone, ruby eyes, a scorched ring before it
  idol: () => {
    const jade = '#3e7a5a', jadeLt = '#4a8a68', dark = '#2a5a42', deep = '#1a3a2a';
    return [
      ball(32, 59, 22, 4, '#2a2220'), ball(32, 59, 16, 2.6, '#1a1412'), specks([[20, 56], [44, 58], [28, 61], [38, 56]], '#4a3a30'),
      // crossed legs, a fat belly, arms resting on the knees
      ...both64(limb(26, 52, 14, 55, 4.4, 3.6, dark)), ...both64(ball(13, 55.4, 3.6, 2.6, jade)),
      ball(32, 43, 12, 11, jade), ball(29, 40, 6, 5, jadeLt), ball(32, 48, 2, 1.6, deep),
      ...both64(limb(22, 36, 19, 48, 2.8, 2.4, dark)), ...both64(ball(19, 49.6, 2.8, 2.2, jade)),
      ...[[26, 38], [38, 38], [32, 52]].map(([x, y]) => hair(x - 2, y, x + 2, y, deep)),
      // the head: a peaked crown, a wide grin full of teeth, ruby eyes
      ball(32, 22, 12, 11, jadeLt), ball(28, 18, 5, 4, '#5a9a78'),
      sheet([[20, 16], [32, 5], [44, 16]], dark, { curve: 0.5 }), ...[26, 32, 38].map(x => ball(x, 13, 1.2, 1.2, '#c8a040')),
      ...both64(ball(27, 20, 3, 2.6, deep)), ...both64(ball(27, 20, 2, 1.8, '#d02030', { glows: true })), specks([[26, 19], [36, 19]], '#ff8090'),
      limb(32, 21, 32, 25, 1, 1.6, jade),
      sheet([[23, 27], [41, 27], [38, 32], [26, 32]], deep, { curve: 0.6 }), ...[25.5, 28.5, 31.5, 34.5, 37.5].map(x => limb(x, 27.4, x, 29.4, 0.7, 0.5, '#d8e0c0')),
      hair(22, 25, 24, 28, deep), hair(42, 25, 40, 28, deep),
      specks([[24, 34], [40, 33], [30, 46], [36, 47]], '#6ab08a'),
    ];
  },
  // a surveyor's bones against the wall, a satchel of maps, a finger pointing on
  mapmaker: () => {
    const bone = '#ddd5bd', worn = '#a89e84', coat = '#4a5a3a', coatDk = '#2e3a24', socket = '#140e14';
    return [
      limb(26, 50, 14, 58, 2, 1.8, worn), limb(38, 50, 50, 58, 2, 1.8, worn), ball(12, 59.6, 3.6, 2, bone), ball(52, 59.6, 3.6, 2, bone),
      // the coat still on the bones, buttoned wrong, gone green
      sheet([[20, 26], [44, 26], [46, 50], [18, 50]], coat, { curve: 0.9 }), sheet([[20, 26], [24, 26], [21, 50], [18, 50]], coatDk, { curve: 0.4 }),
      limb(32, 26, 32, 50, 0.6, 0.6, coatDk), ...[30, 36, 42].map(y => ball(33.6, y, 0.7, 0.7, '#c8a040')),
      ...[[24, 40], [40, 32]].map(([x, y]) => hair(x, y, x + 1, y + 4, coatDk)),
      // the skull, tipped to one side
      ball(31, 19, 8.4, 8, bone), ball(31, 26.2, 5.2, 2.6, worn), ball(28, 15, 3, 2, '#ece4cc'),
      ball(27.6, 19, 2.4, 2.4, socket), ball(34.4, 19, 2.4, 2.4, socket), sheet([[30, 22], [32, 22], [31, 24]], socket),
      ...[27, 29, 31, 33, 35].map(x => limb(x, 25.4, x, 27, 0.6, 0.5, '#f6f0de')),
      // the satchel in its lap, rolled maps standing out of it
      sheet([[20, 42], [38, 42], [39, 54], [19, 54]], '#7a5030', { curve: 0.6 }), limb(19, 44, 39, 44, 0.6, 0.6, '#5a3a20'), ball(29, 47, 1.4, 1.2, '#c8a040'),
      ...[[22, 40], [27, 39], [32, 40]].map(([x, y]) => [limb(x, y, x + 2, y - 8, 1.8, 1.8, '#e8dcb8'), ball(x + 2, y - 8, 1.8, 1, '#c8b890'), hair(x - 0.5, y - 1, x + 1.5, y - 7, '#a89878')]).flat(),
      // the arm out, one finger pointing on along the wall
      limb(42, 32, 54, 38, 1.6, 1.4, bone), ball(54, 38, 1.4, 1.4, bone), limb(54, 38, 60, 39, 0.6, 0.5, bone),
      ...[0, 1, 2].map(i => limb(54.6, 38.6 + i * 0.6, 56, 40 + i * 0.6, 0.4, 0.4, worn)),
      specks([[48, 34], [50, 36], [52, 37], [46, 33]], '#a8aeb4'),
    ];
  },
};

// A cut-down skeleton: a low, scattered heap on the floor, not a figure, so it
// never reads as something still standing. The skull sits on top, eyes lit.
PROPS.bone_heap = () => {
  const bone = '#ddd5bd', worn = '#a89e84';
  return [
    limb(10, 58, 30, 53, 1.8, 1.6, worn), ball(9.2, 58.4, 2.6, 2, bone), ball(30.8, 52.8, 2.4, 2, bone),
    limb(34, 52, 54, 59, 1.8, 1.6, worn), ball(33.2, 51.8, 2.4, 2, bone), ball(54.8, 59.2, 2.6, 2, bone),
    limb(16, 51, 46, 60, 1.6, 1.4, bone), ball(15.2, 50.6, 2.2, 1.8, bone), ball(46.8, 60.4, 2.4, 1.8, bone),
    ...[53, 56, 59].map((y, i) => [limb(22 + i * 2, y, 40 - i * 2, y + 1, 1, 1, bone), hair(23 + i * 2, y + 0.75, 39 - i * 2, y + 1.5, '#8a8070')]).flat(),
    ball(32, 60, 8.4, 3.2, worn), ball(29, 60, 1.8, 1.2, '#8a8070'), ball(35, 60, 1.8, 1.2, '#8a8070'),
    // the skull on top, its eyes lit violet
    ball(26, 47.2, 7.2, 6.6, bone), ball(26.8, 52.8, 4.4, 2, worn), ball(23.6, 44, 2.6, 1.8, '#ece4cc'),
    ball(23, 47, 2, 1.8, '#140e14'), ball(29, 47, 2, 1.8, '#140e14'),
    ball(23, 47, 1, 0.9, '#b040ff', { glows: true }), ball(29, 47, 1, 0.9, '#b040ff', { glows: true }),
    ...[24, 26, 28, 30].map(x => limb(x, 52, x, 53.4, 0.5, 0.4, '#f6f0de')),
    hair(30, 43, 32, 46, '#a89e84'), specks([[12, 61], [50, 62], [20, 62.5], [42, 62.5]], '#a89e84'),
  ];
};

export { PROPS };
