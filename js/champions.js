// The named champions, each drawn as itself: its kind's picture, recoloured
// where age or office would change it, with what the stories give it laid
// behind and over. Each moves through its kind's poses, flinch and all, and is
// painted into the slot a colour wash used to fill (see creaturePieces in assets.js).
import { PORTRAITS } from './heroart.js';
import { CREATURES, STEPS, eyesShut, flinch, followThrough, stride } from './creatures.js';
import { ball, both64, dots, hair, limb, line, oval, recolour, sheet, specks, turn } from './parts.js';

const CHAMPION_OF = { vaelith: 'drow_mage', durgrim: 'grey_dwarf', hissra: 'lizardfolk', grisk: 'goblin', vessra: 'spider', ushgar: 'orc', morrow: 'ghoul', orla: 'wraith', gorrum: 'troll', skarrow: 'wyrm' };
/** @param {string} kind @param {(pose: string) => {back?: object[], front?: object[], map?: Record<string, string>}} extra */
const champion = (kind, extra) => {
  const draw = pose => { const e = extra(pose); return [...(e.back || []), ...recolour(CREATURES[kind](pose), e.map || {}), ...(e.front || [])]; };
  return (pose = 'idle') => (pose === 'strike' ? followThrough(draw('idle'), kind) : pose === 'recover' ? flinch(draw('idle'), kind, 0.3) : pose === 'hurt' ? flinch(draw('idle'), kind) : pose === 'blink' ? eyesShut(draw('idle')) || draw('blink') : STEPS.includes(pose) ? stride(draw('idle'), kind, pose) : draw(pose));
};
const CHAMPIONS = {
  // Vaelith, High Priestess of the dark elves: robed in black and wine-red, a
  // crown of silver spiders, a great fan of a collar behind her head, and a
  // silver spider at her breast; her fire burns a deeper violet
  vaelith: champion('drow_mage', () => ({
    map: { '#2c1a3c': '#1c1018', '#1a0e26': '#0e080c', '#46285e': '#5a1a3e' },
    back: [
      sheet([[18, 20], [17, 6], [22, 9], [25, 1], [29, 6], [32, -1], [35, 6], [39, 1], [42, 9], [47, 6], [46, 20]], '#1e1222', { curve: 0.8 }),
      ...[[18, 19, 17.5, 7], [25, 16, 25, 2], [32, 15, 32, 0], [39, 16, 39, 2], [46, 19, 46.5, 7]].map(([a, b, c, d]) => hair(a, b, c, d, '#b8bccc')),
      hair(17.5, 7, 22, 9, '#b8bccc'), hair(22, 9, 25, 2, '#b8bccc'), hair(25, 2, 29, 6, '#b8bccc'), hair(29, 6, 32, 0, '#b8bccc'),
      hair(32, 0, 35, 6, '#b8bccc'), hair(35, 6, 39, 2, '#b8bccc'), hair(39, 2, 42, 9, '#b8bccc'), hair(42, 9, 46.5, 7, '#b8bccc'),
    ],
    front: [
      // the crown: a band of silver, a spider at its brow, legs arched up from it
      line(27.6, 6.2, 36.4, 6.2, '#b8bccc'), hair(28, 5.75, 36, 5.75, '#eef0f8'),
      ball(32, 5, 1.4, 1.1, '#2a2030'), ball(32, 3.6, 0.9, 0.8, '#2a2030'), specks([[31.5, 3.25], [32.5, 3.25]], '#ff5a50', { glows: true }),
      ...[-1, 1].flatMap(sd => [[1.4, -2.6, 3.4, -4.2], [1.6, -1.4, 4.4, -2.2], [1.5, 0.2, 4.2, 0.8]].map(([a, b, c, d]) => limb(32 + sd * a, 5 + b * 0.6, 32 + sd * c, 5 + d, 0.35, 0.25, '#c8ccd8'))),
      // the spider at her breast, on a silver chain
      hair(28, 17.5, 32, 22, '#b8bccc'), hair(36, 17.5, 32, 22, '#b8bccc'),
      ball(32, 23.6, 1.6, 1.3, '#c8ccd8'), ball(32, 25.6, 2, 1.7, '#9aa0b0'), specks([[31.5, 23], [32.5, 23]], '#ff5a50', { glows: true }),
      ...[-1, 1].flatMap(sd => [[1.4, 24, 4, 22.4], [1.8, 25, 4.6, 25.2], [1.6, 26.4, 4, 28.4]].map(([a, b, c, d]) => limb(32 + sd * a, b, 32 + sd * c, d, 0.3, 0.2, '#c8ccd8'))),
    ],
  })),
  // Durgrim, the grey dwarves' Forge-Thane: his beard gone white and bound in
  // more copper, a crown of dark iron set with copper studs, and a short cloak
  // of forge-scorched red behind his shoulders.
  durgrim: champion('grey_dwarf', () => ({
    map: { '#382b24': '#b8b8b4', '#211b18': '#8a8a86', '#5d4836': '#dcdcd6' },
    back: [sheet([[14, 24], [50, 24], [54, 50], [46, 54], [32, 50], [18, 54], [10, 50]], '#6a2a1a', { curve: 1 }), hair(12, 48, 52, 48, '#3a1610')],
    front: [
      sheet([[24.6, 6.6], [24, 1], [27.5, 3.6], [30, -0.4], [32, 3], [34, -0.4], [36.5, 3.6], [40, 1], [39.4, 6.6]], '#3a3c40', { curve: 0.3 }),
      line(24.6, 6.4, 39.4, 6.4, '#c87a3a'), ...[27, 32, 37].map(x => ball(x, 5, 0.9, 0.9, '#e09a50')),
      // a smith's leather apron, scorched, under the beard and over the mail to the knee
      sheet([[23, 40], [41, 40], [43, 55], [21, 55]], '#5a3a22', { curve: 0.6 }), hair(22, 54, 42, 54, '#3a2414'), specks([[26, 47], [37, 50], [31, 52]], '#2a1a10'),
    ],
  })),
  // Hissra, the Marsh-Mother: her scales gone dark with age and her crest white,
  // a collar of teeth about her neck, and a mantle of reeds on her shoulders.
  hissra: champion('lizardfolk', () => ({
    map: { '#5a7a3a': '#3e5a30', '#7e9e52': '#5e7e46', '#b0602a': '#e8e0c8' },
    back: [sheet([[16, 18], [48, 18], [52, 44], [12, 44]], '#4a5028', { curve: 0.8 }), ...[16, 22, 28, 36, 42, 48].map(x => hair(x, 19, x + (x - 32) * 0.15, 44, '#6a7040'))],
    front: [
      ...[-8, -5.5, -3, -0.5, 2, 4.5, 7].map((dx, i) => limb(32 + dx, 19 + Math.abs(dx) * -0.2 + 1, 32 + dx * 1.05, 23 - Math.abs(dx) * 0.15, 0.7, 0.25, i % 2 ? '#e8dcc0' : '#d0c4a0')),
      hair(23, 19.5, 41, 19.5, '#6a5232'),
    ],
  })),
  // Grisk, the Goblin King: a dented bucket for a crown, bent spoons stuck round
  // its rim for points, a red rag of blanket for a royal cloak, junk on his belt
  grisk: champion('goblin', pose => ({
    back: [
      // (it swings out behind him as he lunges)
      pose === 'windup' ? sheet([[22, 26], [42, 26], [53, 47], [48, 47], [45, 51], [39, 49], [33, 52], [27, 49], [21, 52], [15, 47], [9, 47]], '#8a2a22', { curve: 1 })
        : sheet([[22, 26], [42, 26], [47, 51], [43, 49], [40, 53], [36, 50], [32, 53], [28, 50], [24, 53], [21, 49], [17, 51]], '#8a2a22', { curve: 1 }),
      hair(24, 30, 19.5, 48, '#5a1814'), hair(40, 30, 44.5, 48, '#5a1814'), hair(32, 30, 32, 50, '#6a1e18'),
    ],
    front: [
      // a spoon, a key and a bell hung on the cord at his waist
      limb(28.6, 35, 28.2, 38.6, 0.3, 0.3, '#a8acb4'), ball(28.1, 39.2, 0.8, 1, '#c8ccd4'),
      limb(37.4, 35, 37.8, 38, 0.3, 0.3, '#c9a24a'), sheet([[37.2, 38], [38.6, 38], [38.6, 39], [37.2, 39]], '#c9a24a'),
      dots([[25, 35]], '#e0c060'),
      // the bucket, dented tin gone dull, its handle hanging by his ear
      limb(25.2, 13, 22.4, 19.4, 0.35, 0.35, '#5a6068'), limb(22.4, 19.4, 23.8, 21, 0.35, 0.35, '#5a6068'),
      sheet([[24.4, 15.6], [39.6, 15.6], [37.8, 7.6], [26.2, 7.6]], '#8a9098', { curve: 0.3 }),
      sheet([[24.4, 15.6], [28, 15.6], [27.8, 7.6], [26.2, 7.6]], '#b8c0c8'), line(24, 15.8, 40, 15.8, '#c8ced6'),
      ball(35.2, 11, 1.5, 1.2, '#6a7078'), hair(26.5, 8.25, 37.5, 8.25, '#5a6068'),
      specks([[30, 10], [36.5, 13.5], [27, 12.5], [33, 14]], '#8a5a30'),
      // the spoons, bowls up, bent every which way
      ...[[26.6, -1.2], [29.4, 0.8], [32, -0.6], [34.6, 1], [37.4, 1.4]].flatMap(([x, b]) => [
        limb(x, 8, x + b, 3.6, 0.35, 0.3, '#c8ccd4'), ball(x + b * 1.15, 2.8, 0.9, 1.2, '#dfe3ea'), specks([[x + b * 1.15 - 0.25, 2.25]], '#ffffff'),
      ]),
    ],
  })),
  // Vessra, the Web-Mother: dusky and old, an ivory mark where her children
  // wear red, egg sacs bound to her back, her web trailing from her to the floor
  vessra: champion('spider', () => ({
    map: { '#3e3454': '#4a3c2e', '#5e5278': '#6e5a44', '#241e34': '#2a2018', '#4a3e64': '#54442e', '#2e2642': '#30261a', '#c02828': '#e8e0c8', '#ff6060': '#fff8e8', '#7a6a96': '#9a8462', '#6e5c8a': '#8a7656' },
    back: [line(17, 34, 12, 63, '#bfb9aa'), line(47, 34, 52, 63, '#bfb9aa'), line(22, 26, 20, 63, '#a8a294'), line(42, 26, 44, 63, '#a8a294')],
    front: [
      ball(23.4, 27, 3.8, 3.3, '#e4dccb'), ball(27.4, 23.2, 3.1, 2.8, '#f2ecdf'), ball(40.6, 27.6, 3.5, 3.1, '#ddd4c2'),
      hair(20.5, 26, 26, 28.5, '#b8b0a0'), hair(25, 22, 30, 24.5, '#c8c0b0'), hair(38, 26.5, 43, 29, '#b8b0a0'),
      specks([[22, 25.5], [27, 22], [40, 26.5], [24.5, 28.5]], '#ffffff'),
    ],
  })),
  // Ushgar, the Orc Warchief: a horned iron helm, red war paint, a bearskin at
  // his back, and the skulls of those who argued hung from his belt
  ushgar: champion('orc', pose => ({
    back: [
      // (it swings out behind him as he comes on)
      pose === 'windup' ? sheet([[16, 24], [48, 24], [58, 47], [52, 47], [47, 52], [40, 50], [33, 54], [26, 50], [19, 53], [11, 47], [5, 46]], '#4a3a2a', { curve: 1 })
        : sheet([[16, 24], [48, 24], [51, 52], [46, 50], [42, 55], [36, 52], [32, 56], [28, 52], [22, 55], [18, 50], [13, 52]], '#4a3a2a', { curve: 1 }),
      ...[[18, 30, 15.5, 49], [24, 32, 22.5, 53], [40, 32, 41.5, 53], [46, 30, 48.5, 49]].map(([a, b, c, d]) => hair(a, b, c, d, '#2e2418')),
    ],
    front: [
      ...both64(limb(24.6, 7.4, 18.4, 4.4, 1.9, 1.3, '#e8dcc0')), ...both64(limb(18.4, 4.4, 15.6, 0.8, 1.3, 0.4, '#f2ead6')),
      ...both64(hair(21.5, 5, 21.75, 7.25, '#a89a7a')), ...both64(hair(18.75, 3, 19.25, 5.25, '#a89a7a')),
      sheet([[23.4, 12.4], [24.4, 6.4], [28, 3.4], [36, 3.4], [39.6, 6.4], [40.6, 12.4], [32, 10.6]], '#5a606c', { curve: 0.8 }),
      line(23.2, 12, 40.8, 12, '#8a909c'), hair(26, 6, 31, 4.25, '#b8bec8'), specks([[25.5, 11], [29, 11.5], [35, 11.5], [38.5, 11]], '#c8ced8'),
      line(32, 4, 32, 10, '#3e434c'),
      limb(24.6, 17.2, 29.2, 17.8, 0.5, 0.5, '#b02020'), limb(25, 18.8, 28.6, 19.2, 0.4, 0.4, '#b02020'),
      limb(39.4, 17.2, 34.8, 17.8, 0.5, 0.5, '#b02020'), limb(39, 18.8, 35.4, 19.2, 0.4, 0.4, '#b02020'),
      ...[[22.4, 49.4], [41.6, 49.4]].flatMap(([x, y]) => [ball(x, y, 1.9, 1.8, '#e0d8c0'), dots([[Math.floor(x - 1), Math.floor(y)], [Math.floor(x + 1), Math.floor(y)]], '#2a1a10')]),
    ],
  })),
  // Morrow, the Ghoul Lord: the oldest and fattest, gone yellow with age, a
  // crown of finger bones on its skull and somebody's thighbone in its jaws
  morrow: champion('ghoul', () => ({
    map: { '#8f9a84': '#a49a7a', '#5c6656': '#6e6650', '#b0b8a4': '#c4bc9a' },
    front: [
      ball(32, 38.6, 10.4, 8, '#b0a684'), ball(29, 36, 5, 3.6, '#c4bc9a'), ball(32, 41, 1, 0.8, '#6e6650'),
      hair(24, 38, 26.5, 42, '#8a8266'), hair(40, 38, 37.5, 42, '#8a8266'), hair(28, 44, 36, 44, '#8a8266'),
      ...[28, 30, 32, 34, 36].map((x, i) => limb(x, 12, x + (x - 32) * 0.15, 8.4 - (i % 2) * 0.8, 0.5, 0.4, '#f2eee0')),
      hair(27.5, 12, 36.5, 12, '#8a7a5a'),
      limb(21, 25.4, 43, 24.8, 1, 1, '#ece4d0'), ball(21, 25.4, 1.7, 1.5, '#f2eee0'), ball(43, 24.8, 1.7, 1.5, '#f2eee0'),
      hair(36, 24, 38, 26, '#8a2424'), specks([[24, 26.5], [40, 26]], '#8a2424'),
    ],
  })),
  // Orla, the Hollow Abbess: her habit gone grey, a white wimple about the dark
  // where her face was, her beads still in her hands, a cracked halo behind her
  orla: champion('wraith', pose => ({
    map: { '#5b4483': '#8a8698', '#3a2a58': '#5a5668', '#22183a': '#2e2c38', '#7a64a4': '#b4b0c0', '#8a7ab4': '#a8a4b8' },
    back: oval(32, 6, 11, 2.6, 18).filter((_, i) => i !== 4 && i !== 5).map(([x, y]) => ball(x, y, 0.8, 0.7, pose === 'blink' ? '#b8ac7a' : '#f0e0a0', { glows: true })),
    front: [
      sheet([[25.5, 21], [26, 11], [29, 7], [35, 7], [38, 11], [38.5, 21]], '#100e16'),
      sheet([[23.4, 22], [24.4, 10.6], [28.4, 5.6], [29.2, 6.6], [25.8, 11.2], [24.8, 22]], '#e8e4dc'),
      sheet([[40.6, 22], [39.6, 10.6], [35.6, 5.6], [34.8, 6.6], [38.2, 11.2], [39.2, 22]], '#e8e4dc'),
      sheet([[25, 20.6], [39, 20.6], [37.4, 26.6], [32, 28.4], [26.6, 26.6]], '#e8e4dc', { curve: 0.8 }), hair(27, 22, 37, 22, '#b8b4ac'),
      ...[[28, 27.5], [28.6, 30], [29.6, 32.5], [31, 34.6], [33, 34.6], [34.4, 32.5], [35.4, 30], [36, 27.5]].map(([x, y]) => ball(x, y, 0.6, 0.6, '#c8b080')),
      line(32, 35, 32, 40.4, '#c9a24a'), line(30.4, 36.6, 33.6, 36.6, '#c9a24a'), specks([[31.75, 35.5]], '#f0d880'),
    ],
  })),
  // Gorrum, the Troll-Father: grey with years, the moss of his head gone white
  // into a long beard, the skulls of his own get strung round his neck
  gorrum: champion('troll', () => ({
    map: { '#58985c': '#5e7e6a', '#356a3c': '#3c5444', '#78b47a': '#7e9a86', '#2e4a26': '#c8c8bc', '#4a6e36': '#e8e8e0', '#5a4630': '#3e3a36', '#4c8a50': '#5a7262', '#3e7a44': '#4a6454' },
    // the mane, wild and white, spilling over his shoulders and down his back
    back: [
      ...both64(sheet([[20, 8], [24, 4], [22, 14], [17, 22], [14, 31], [12.5, 27], [14, 18]], '#bcbcb0', { curve: 0.8 })),
      ...both64(hair(18, 12, 14, 26, '#e8e8e0')), ...both64(hair(21, 10, 16.5, 24, '#9a9a90')),
    ],
    front: [
      ...[[23, 28.4], [26.6, 30.4], [37.4, 30.4], [41, 28.4]].flatMap(([x, y]) => [ball(x, y, 1.9, 1.7, '#e0d8c0'), dots([[Math.floor(x - 1), Math.floor(y)], [Math.floor(x + 1), Math.floor(y)]], '#2a2418')]),
      hair(21, 27, 43, 27, '#6a5a40'),
      sheet([[27, 23.6], [37, 23.6], [38.4, 30], [35.4, 36], [32, 40.4], [28.6, 36], [25.6, 30]], '#d8d8cc', { curve: 1 }),
      ...[[29, 25, 28.4, 35], [32, 25, 32, 39], [35, 25, 35.6, 35], [27, 26, 26.4, 31], [37, 26, 37.6, 31]].map(([a, b, c, d]) => hair(a, b, c, d, '#a8a89c')),
      specks([[30, 28], [34, 30], [31, 33]], '#f4f4ec'),
    ],
  })),
  // Skarrow, the Elder Wyrm: gone ash-brown with age, a third horn, a scar and
  // a clouded eye, and the fourth crew's steel heaped under her forefeet
  skarrow: champion('wyrm', pose => {
    const rear = pose === 'special', coil = pose === 'windup';
    const hx = 32, hy = rear ? 16 : coil ? 28 : 24, ey = hy - 1;
    return {
      map: { '#8a3622': '#5a4a3e', '#5a2016': '#3a2e26', '#3e140c': '#241a14', '#a44428': '#6e5e4e', '#c8966a': '#a89a86', '#a87a52': '#857866', '#dccaa0': '#e8e0d0', '#9a3e26': '#4e4034', '#b85438': '#7a6a58', '#6a2618': '#463a30', '#c05a36': '#8a7a68', '#c86a44': '#9a8a76' },
      front: [
        limb(hx, hy - 5.6, hx, hy - 13, 1.8, 0.5, '#e8e0d0'), hair(hx - 0.5, hy - 9, hx + 0.5, hy - 8.5, '#a8987a'),
        hair(hx - 8, hy - 5, hx - 3.5, hy + 1.5, '#c8b8a0'), ball(hx - 5, ey, 2.2, 1.2, '#d0d4c8'), specks([[hx - 5.5, ey - 0.5]], '#ffffff'),
        // the hoard: coin heaped and spilled, a gold-rimmed shield, a dented helm, a blade across it all
        ball(32, 61.4, 9, 2.2, '#a8842c'), ball(32, 60.8, 6.4, 1.6, '#d8b048'), specks([[27, 60.25], [31, 59.75], [35.5, 60.25], [29, 61.5], [34, 61.75], [38, 61.5], [22, 62.5], [42, 62.75]], '#ffe490'),
        ball(38.6, 59.4, 3.6, 2.4, '#7a5a30'), ball(38.6, 59.4, 2.6, 1.6, '#9a7444'), ball(38.6, 59.4, 0.9, 0.7, '#e8c060'), hair(35.4, 58.5, 41.8, 58.5, '#e8c060'),
        ball(25.4, 59.6, 2.8, 2, '#8a909c'), hair(23, 59, 27.8, 59, '#c8ced8'), sheet([[24, 59.8], [26.8, 59.8], [26.4, 61.4], [24.4, 61.4]], '#3a3e46'),
        limb(19, 62.2, 37, 58.4, 0.7, 0.45, '#c8ced8', { smooth: 1 }), hair(19.5, 61.75, 36, 58.25, '#ffffff'), line(21.4, 60.4, 22.2, 63, '#8a6a30'),
      ],
    };
  }),
};

// A fallen hero's shade rises in the gear of their trade: the dead knight's
// shape, and over it the same hood, robe, tabard, bow, leaf mantle and staff
// that identify the painted classes, all cold and pale. A fighter's is the
// knight; no invented masks, mitres, pointed hats or antlers return here.
/** What hangs from the shield arm, turned with it as the blade swings (see the shade's windup). */
const shieldSide = (pose, parts) => (pose === 'windup' ? turn(parts, 20.5, 25, 25) : parts);
const SHADE_GEAR = {
  thief: champion('shade', pose => ({ front: [
    ...shieldSide(pose, [sheet([[17, 24], [23, 24], [20, 44], [14, 52], [5, 48], [7, 34]], '#3a4a62', { curve: 0.8 }), hair(16, 30, 9, 46, '#5a6a84'), hair(20, 30, 15, 49, '#2e3a50')]),
    sheet([[23.4, 22], [24, 11], [28, 6.4], [36, 6.4], [40, 11], [40.6, 22], [38, 17], [32, 13.6], [26, 17]], '#4a5c78', { curve: 0.9 }),
    hair(24.5, 12, 28.5, 7, '#7a8ca8'), hair(39.5, 12, 35.5, 7, '#2e3a50'),
  ] })),
  mage: champion('shade', pose => ({ front: [
    sheet([[19, 23], [45, 23], [48, 44], [44, 58], [38, 52], [32, 60], [26, 52], [20, 58], [16, 44]], '#4e5a8a', { curve: 1 }),
    ...[[24, 28, 21, 54], [32, 30, 32, 58], [40, 28, 43, 54]].map(([a, b, c, d]) => hair(a, b, c, d, '#3a4470')), hair(26, 23.5, 38, 23.5, '#9aa8d0'),
    ...shieldSide(pose, [sheet([[17, 24], [23, 24], [20, 44], [14, 50], [7, 46], [8, 34]], '#4e5a8a', { curve: 0.8 }), limb(9, 58, 11, 9, 0.9, 0.8, '#8a9ab0'),
      ball(11, 7, 2.4, 2.6, '#b4e0ff', { glows: true }), specks([[8, 4], [14, 5], [12, 2]], '#e0f4ff', { glows: true })]),
  ] })),
  cleric: champion('shade', () => ({ front: [
    sheet([[25, 23], [39, 23], [40, 41], [32, 43], [24, 41]], '#c8d4e8', { curve: 0.8 }), hair(25.5, 24, 25.5, 40, '#e8e0a0'), hair(38.5, 24, 38.5, 40, '#e8e0a0'),
    ball(32, 30, 2.6, 2.6, '#f0e8b0', { glows: true }),
    ...Array.from({ length: 8 }, (_, i) => i / 8 * Math.PI * 2).map(t => limb(32 + Math.cos(t) * 2.8, 30 + Math.sin(t) * 2.8, 32 + Math.cos(t) * 4.4, 30 + Math.sin(t) * 4.4, 0.45, 0.25, '#f4ecc0')),
  ] })),
  ranger: champion('shade', pose => ({ front: [
    limb(44, 25, 50, 11, 1.8, 1.6, '#5a6e6e'), ...[[48.6, 9.4], [50.6, 8.6], [52.4, 10]].map(([x, y]) => sheet([[x - 0.9, y + 3], [x, y], [x + 0.9, y + 3]], '#d8e8e8')),
    ...shieldSide(pose, [sheet([[17, 24], [23, 24], [20, 44], [14, 50], [6, 46], [8, 34]], '#4e6a6a', { curve: 0.8 }),
      ...Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI, b = ((i + 1) / 8) * Math.PI; return hair(8 - Math.sin(a) * 5, 17 + i * 4.4, 8 - Math.sin(b) * 5, 17 + (i + 1) * 4.4, '#9ab0b0'); }),
      line(8, 17, 8, 52, '#d8e8e8')]),
    sheet([[23.4, 22], [24, 11], [28, 6.4], [36, 6.4], [40, 11], [40.6, 22], [38, 17], [32, 13.6], [26, 17]], '#4e6a6a', { curve: 0.9 }), hair(24.5, 12, 28.5, 7, '#7a9898'),
  ] })),
  druid: champion('shade', pose => ({ front: [
    sheet([[14, 24], [50, 24], [47, 31], [40, 29], [32, 33], [24, 29], [17, 31]], '#5a7a6a', { curve: 0.9 }),
    ...[[18, 26], [24, 28], [30, 29], [36, 29], [42, 28], [47, 26]].map(([x, y]) => hair(x, y, x + (x < 32 ? -0.6 : 0.6), y + 3, '#8ab09a')),
    ...shieldSide(pose, [sheet([[17, 24], [23, 24], [20, 44], [14, 50], [7, 46], [8, 34]], '#5a7a6a', { curve: 0.8 }), limb(9, 58, 10, 9, 1, 0.9, '#7a8a80'),
      ...[[7, 10], [13, 8], [9, 6.5]].map(([x, y]) => sheet([[x - 1.6, y], [x, y - 2.2], [x + 1.6, y], [x, y + 1.2]], '#8ac0a0'))]),
    hair(25.5, 9.75, 38.5, 9.75, '#6a8a7a'), ...[[27, 9.4], [32, 8.8], [37, 9.4]].map(([x, y]) => sheet([[x - 1.4, y], [x, y - 2], [x + 1.4, y], [x, y + 1.1]], '#8ac0a0')),
  ] })),
};

export { CHAMPIONS, CHAMPION_OF, PORTRAITS, SHADE_GEAR };
