// The creatures that came later: the traders, the companions, the peoples below
// (dark elves, dwarves, lizardfolk) and the deep beasts, drawn from the same parts
// as the rest (see creatures.js, which keeps them all in one list).

import { CREATURES } from './creatures.js';
import { RENEGADE, ball, both64, canine, dots, dwarfBody, dwarfHead, dwarfKit, hair, limb, line, lizardBody, lizardHead, lizardKit, oval, recolour, scragHead, sheet, slats, specks, warPick } from './parts.js';

const FOLK = {
  // One of the Lampfolk, who trade in the dark: short and grey, broad ears
  // that droop, great pale eyes for seeing by a little light; a long patched
  // robe, a pack piled high with a blanket roll and a pan swinging off it,
  // the lamp on its staff held out, and a coin held up between long fingers.
  merchant: () => {
    const skin = '#98a0ae', skinDk = '#6c7482', skinLt = '#b4bcc8', robe = '#6a5a48', robeDk = '#4a3e30', patch = '#7c6a3e', pack = '#5e4a36', packDk = '#40321e', wood = '#6a5238';
    return [
      // the pack behind: a rolled blanket on top, a pan and a cup hung off it
      ball(32, 22, 18, 19, pack), ball(26, 16, 8, 8, '#6e583e'), hair(18, 26, 46, 26, packDk), hair(17, 14, 47, 14, packDk),
      limb(18, 5, 46, 5, 4.6, 4.6, '#8a4a3a'), ...[22, 28, 34, 40].map(x => hair(x, 1.5, x + 0.5, 8.5, '#6a3428')),
      limb(47, 20, 51, 22, 0.5, 0.5, '#4a4a50'), ball(52, 27, 4.4, 4, '#6a6e76'), ball(51, 26, 2, 1.6, '#8a8e96'),
      ball(12, 24, 2.4, 2.4, '#7a7e86'), line(13, 19, 12.5, 21.5, '#4a4a50'),
      // short legs under the robe, and bare grey feet
      ...both64(limb(28, 50, 27, 59, 2.8, 2.4, skinDk)), ...both64(ball(25.6, 61, 4.4, 2, skin)),
      ...both64(specks([[22, 61.5], [23.5, 62], [25, 62]], '#d4d8e0')),
      // the long robe, patched and frayed at the hem
      sheet([[21, 34], [43, 34], [47, 59], [41, 57.5], [36, 59.5], [32, 58], [28, 59.5], [23, 57.5], [17, 59]], robe, { curve: 1 }),
      sheet([[21, 34], [25, 34], [22, 58.5], [17, 59]], robeDk, { curve: 0.4 }),
      sheet([[33, 42], [42, 42], [43.5, 53], [34, 53]], patch, { curve: 0.6 }), ...[[33.5, 42.5], [42.5, 43], [43.5, 52.5], [34, 52.5]].map(([x, y]) => specks([[x, y]], '#c8b890')),
      line(21, 36, 43, 36, '#4a3e30'), limb(30, 37, 29, 42, 0.5, 0.4, '#8a7050'), ball(29, 43, 1.2, 1.2, '#c9a24a'),
      ...[[27, 46], [38, 39], [30, 54], [40, 56]].map(([x, y]) => hair(x, y, x + 0.5, y + 3, robeDk)),
      // the staff and its lamp, held out on the left, the light warm on the glass
      line(11, 10, 11, 62, wood), limb(11, 10, 17, 10, 0.7, 0.7, wood), line(17, 10, 17, 13, '#4a4040'),
      ball(17, 18, 4, 4.8, '#3a3634'), ball(17, 18, 3, 3.8, '#ffd060', { glows: true }), ball(16.6, 17, 1.6, 1.8, '#fff6d0', { glows: true }),
      line(14, 14, 20, 14, '#2a2624'), line(14, 22.5, 20, 22.5, '#2a2624'),
      limb(21, 36, 14, 42, 2.6, 2.2, robe), ball(12.6, 43, 2.6, 2.4, skin), ...[[10, 41.5], [10, 43.5]].map(([x, y]) => limb(11.5, y, x, y + 0.5, 0.6, 0.5, skin)),
      // the other hand held up, the coin between long fingers
      limb(43, 36, 48, 42, 2.6, 2.2, robe), ball(49, 42, 2.4, 2.2, skin),
      limb(49, 40.5, 50.5, 37, 0.6, 0.5, skin), limb(50, 41, 52, 38, 0.6, 0.5, skin),
      ball(51.4, 36, 1.8, 1.8, '#e8c050', { glows: true }), specks([[51, 35.5]], '#fff4c0'),
      // broad ears that droop, a round head, and the great pale eyes
      sheet([[23, 24], [8, 28], [6, 32], [10, 33.5], [23, 30]], skin, { tilt: [-0.5, 0.2] }), sheet([[41, 24], [56, 28], [58, 32], [54, 33.5], [41, 30]], skin, { tilt: [0.5, 0.2] }),
      sheet([[22, 26], [11, 29.5], [22, 29]], '#a87e86'), sheet([[42, 26], [53, 29.5], [42, 29]], '#a87e86'),
      ball(32, 27, 11, 10, skin), ball(29, 23, 6, 4, skinLt),
      hair(25, 22, 29.5, 22.5, skinDk), hair(39, 22, 34.5, 22.5, skinDk),
      ...both64(ball(27.4, 26.4, 3.8, 3.8, '#f4e6a8')), ...both64(ball(27.8, 26.6, 2, 2.2, '#3a3020')),
      dots([[28, 27], [36, 27]], '#0e0c10'), dots([[27, 25], [35, 25]], '#ffffff'),
      limb(32, 27, 32, 31, 0.9, 1.4, skin), ball(32, 31.4, 1.4, 1, skinDk),
      sheet([[28.5, 33.5], [35.5, 33.5], [34.5, 34.8], [29.5, 34.8]], '#4a4250'),
      // the grey skin's creases, a scrap of beard, wrinkles at the eyes
      hair(23, 29, 25, 31, skinDk), hair(41, 29, 39, 31, skinDk), hair(22.5, 27, 23.5, 28.5, skinDk), hair(41.5, 27, 40.5, 28.5, skinDk),
      ...[30, 32, 34].map(x => hair(x, 35.5, x + 0.25, 37.5, '#c8ccd4')),
      specks([[26, 20], [37, 19.5], [31, 18.5]], skinDk),
    ];
  },

  // A goblin who would rather sell you a blade than stick you with one: no
  // weapon in its hands, a floppy cap, and a heap of other people's things on
  // its back, pots and a pan and a sword hilt and a string of trinkets; one
  // hand holds charms out to you and the other beckons, grinning.
  pedlar: () => {
    const skin = '#6aa84a', skinDk = '#3f6e2c', skinLt = '#8ac66a', tunic = '#8a6a3a', tunicDk = '#5a4224', heap = '#6e5236', heapDk = '#4a3620', cap = '#a03a30', capDk = '#702620';
    return [
      // the heap on its back: a sack, a pot, a pan, a hilt standing out of it, a lantern
      ball(32, 26, 19, 15, heap), ball(26, 21, 9, 6, '#7e6244'), hair(16, 30, 48, 30, heapDk), hair(22, 16, 30, 26, heapDk),
      ball(16, 18, 5.6, 4.8, '#7a7e86'), ball(15, 16.6, 3, 1.6, '#9a9ea6'), ball(16, 14, 4, 1, '#5a5e66'),
      ball(49, 17, 5.2, 4.4, '#9a6a3a'), ball(49, 15, 3.6, 1.2, '#4a2e18'), limb(53, 19, 58, 23, 0.6, 0.6, '#7a4a20'),
      line(42, 4, 46, 16, '#b8bcc4', { lit: 1 }), hair(42.5, 5, 45.5, 15, '#f0f2f6'), limb(39, 9, 45.5, 7, 0.8, 0.8, '#c9a24a'), ball(41.6, 3.4, 1.2, 1.2, '#c9a24a'),
      limb(20, 10, 26, 12, 0.8, 0.8, '#5a3a20'), ball(19, 9.5, 1.6, 2, '#8a8070'), specks([[19, 9]], '#ffe0a0'),
      ...[[22, 34], [26, 35.5], [30, 36], [34, 36], [38, 35.5], [42, 34]].map(([x, y], i) => ball(x, y, 0.9, 0.9, ['#e8c050', '#60c0e0', '#e05040'][i % 3])),
      // bandy legs, long bare feet
      ...both64(limb(28, 46, 26, 53, 2.2, 1.9, skin)), ...both64(ball(26, 53, 2, 1.8, skinDk)), ...both64(limb(26, 53, 26.5, 60, 1.9, 1.6, skin)),
      ...both64(limb(26.5, 61, 21.5, 62, 1.7, 1.3, skinDk)), ...both64(specks([[20, 62.5], [21.5, 62.75]], '#d8cfb0')),
      // the pot-belly in a stained tunic, a belt with a fat purse on it
      ball(32, 40, 8.4, 8.6, skin),
      sheet([[23, 35], [41, 35], [43, 48], [40, 46.5], [36, 49], [32, 47], [28, 49], [24, 46.5], [21, 48]], tunic, { curve: 1 }),
      sheet([[23, 35], [27, 35], [25, 47.5], [21, 48]], tunicDk, { curve: 0.4 }),
      line(22.5, 42, 41.5, 42, '#4a2e18'), ball(36, 44.4, 2.6, 2.2, '#8a5a30'), specks([[35.5, 43.5]], '#e8c050'),
      ...[[28, 38], [37, 39], [30, 46]].map(([x, y]) => specks([[x, y], [x + 0.5, y + 0.5]], '#c8a878')),
      // one hand holds out a string of charms, the other beckons
      limb(23, 36, 16, 42, 2, 1.7, skin), limb(16, 42, 13, 45, 1.7, 1.5, skin), ball(12.6, 46, 2.2, 2, skin),
      line(12, 48, 12, 57, '#8a7050'), ball(12, 50, 1, 1, '#e8c050'), ball(12, 53, 1.1, 1.1, '#60c0e0', { glows: true }), ball(12, 56, 1, 1, '#c8c8d0'), ball(12, 58, 1.4, 1.6, '#e05040'),
      limb(41, 36, 47, 33, 2, 1.7, skin), limb(47, 33, 50, 27, 1.7, 1.5, skin), ball(50.4, 26, 2.2, 2, skin),
      limb(50, 24, 48.5, 22.5, 0.6, 0.5, skin), limb(51.5, 24.5, 50.5, 22, 0.6, 0.5, skin),
      // the great ears swept out, a narrow head, the floppy cap
      sheet([[25, 22], [5, 15], [8, 20], [6, 22], [11, 24], [25, 27]], skin, { tilt: [-0.5, -0.2] }), sheet([[39, 22], [59, 15], [56, 20], [58, 22], [53, 24], [39, 27]], skin, { tilt: [0.5, -0.2] }),
      sheet([[23.5, 22.5], [11, 18], [23.5, 25.5]], '#b06e56'), sheet([[40.5, 22.5], [53, 18], [40.5, 25.5]], '#b06e56'),
      limb(32, 30, 32, 34, 2, 2.3, skinDk),
      ball(32, 23, 7.4, 7, skin), ball(32, 27.6, 5.4, 2.8, skin),
      sheet([[23.5, 20], [26, 12], [32, 9.5], [39, 11], [44, 14], [46, 20], [42, 17], [39.5, 19.5]], cap, { curve: 0.8 }),
      sheet([[39, 11], [44, 14], [46, 20], [42, 17]], capDk, { curve: 0.6 }), ball(46, 21, 1.8, 1.8, '#e8d8b0'),
      line(24, 19.5, 40, 19.5, capDk),
      // an open, hopeful look, raised brows, a nose, and a grin that wants your coin
      limb(26, 19.8, 30, 20.8, 1, 0.8, skinDk), limb(38, 19.8, 34, 20.8, 1, 0.8, skinDk),
      ...both64(ball(28.4, 23, 2.2, 1.8, '#f0e8c0')), dots([[28, 23], [36, 23]], '#1a1010'), specks([[28.5, 22.5], [36.5, 22.5]], '#ffffff'),
      limb(32, 22, 32.6, 27, 1, 1.6, skin), ball(33, 27.4, 1.6, 1.2, skinLt),
      sheet([[25.5, 28.4], [32, 30.6], [38.5, 28.4], [36.5, 31.8], [32, 32.8], [27.5, 31.8]], '#2a1010'),
      dots([[28, 29], [30, 30], [34, 30], [36, 29]], '#f0e6c8'), ball(32, 32, 1.8, 0.6, '#6a2424'),
      specks([[27, 17], [37, 17.5], [30.5, 25.5]], skinDk),
    ];
  },

  // Low and heavy on six splayed legs, turned a little so its length shows:
  // keeled scales in rows down a long muscled body, a crest of horn plates
  // down its back, a serpent's tail coiled up behind, and eyes that are what
  // you see first. Winding up a bite it drops its jaw; to look at you it rears
  // its head up high, the crown spreads into a frill and the eyes blaze.
  basilisk: (pose = 'idle') => {
    const hide = '#62703f', hideLt = '#7a8a50', skin = '#77834e', flank = '#4a5436', belly = '#b0aa78', horn = '#a08e5e', hornDk = '#7a6844', jaw = '#8e8c5e', scaleC = '#3e4826', claw = '#e0d8b8';
    const gaze = pose === 'special', bite = pose === 'windup';
    const up = gaze ? 2.4 : bite ? -0.8 : 0;    // how far the body is raised
    // plates standing up off the spine: [x, y at the spine, height, lean]
    const plates = [[52, 28, 5, 1.6], [47, 25, 7, 1.4], [42, 23.6, 8.4, 1.2], [37, 24, 9.2, 1], [32, 25.4, 9, 0.8], [27.4, 28, 8, 0.5], [23.6, 31, 6.4, 0.3]]
      .map(([x, y, h, l]) => gaze ? [x, y - up, h * 1.25, l * 0.6] : [x, y, h, l]);
    /** a leg: hip, elbow or knee, foot, with three clawed toes */
    const legOf = (x1, y1, x2, y2, x3, y3, r, c) => [
      limb(x1, y1, x2, y2, r, r * 0.8, c), ball(x2, y2, r * 0.8, r * 0.75, c), limb(x2, y2, x3, y3, r * 0.8, r * 0.6, c),
      ball(x3, y3 + 1, r * 1.1, r * 0.5, flank),
      ...[-1, 0, 1].map(d => limb(x3 + d * r * 0.8, y3 + 1.4, x3 + d * r * 1.3, y3 + 2.6, 0.7, 0.3, claw)),
    ];
    /** the head, square on to you: a crown of plates, a wedge of a snout, eyes on top */
    const head = (cx, cy) => {
      // the crown stands up off the skull; rearing, it spreads into a frill
      const crown = (gaze ? [-180, -158, -136, -114, -90, -66, -44, -22, 0].map((a, i) => [a, [12, 15, 17, 18, 19, 18, 17, 15, 12][i]]) : [[-160, 4.4], [-134, 5.6], [-112, 6], [-68, 6], [-46, 5.6], [-20, 4.4]])
        .map(([a, r]) => {
          const t = a * Math.PI / 180, dx = Math.cos(t), dy = Math.sin(t), w = gaze ? 3 : 2.6;
          const bx = cx + dx * 8, by = cy - 1 + dy * 4.8;
          return [sheet([[bx - dy * w, by + dx * w], [bx + dx * r, by + dy * r], [bx + dy * w, by - dx * w]], horn, { tilt: [dx * 0.5, dy * 0.5] }),
            hair(bx, by, bx + dx * r * 0.8, by + dy * r * 0.8, hornDk)];
        }).flat();
      if (gaze) crown.unshift(sheet(oval(cx, cy - 2, 17, 13, 20), '#5a6a38', { tilt: [0, -0.4] }));
      /** @type {object[]} */
      const p = [...crown, ball(cx, cy, 11.2, 6.8, skin), ball(cx - 3, cy - 3, 5, 2.4, hideLt)];
      // scales over the skull, a ridge down the snout
      p.push(...[[-4, -5], [0, -6], [4, -5], [-2, -4], [2, -4]].flatMap(([d, y]) => [hair(cx + d - 1, cy + y, cx + d, cy + y + 0.75, scaleC), hair(cx + d, cy + y + 0.75, cx + d + 1, cy + y, scaleC)]),
        hair(cx, cy - 2, cx, cy + 5, '#8e9a62'));
      if (bite) {
        p.push(
          sheet([[cx - 9, cy + 1], [cx + 9, cy + 1], [cx + 6, cy + 14], [cx - 6, cy + 14]], '#5a1c1e', { curve: 0.6 }),
          ball(cx, cy + 14.6, 6.8, 2.6, jaw), limb(cx, cy + 1, cx, cy + 6, 7.2, 5.2, skin), ball(cx, cy + 11.2, 4, 2, '#a04a40'),
          ...[-5, -2, 2, 5].map(d => limb(cx + d, cy + 6.6, cx + d, cy + 8.4, 0.55, 0.2, '#f0e8cc')),
          ...[-4, -1.3, 1.3, 4].map(d => limb(cx + d, cy + 13, cx + d, cy + 11.4, 0.5, 0.2, '#e0d8b8')),
          hair(cx + 4, cy + 15, cx + 4, cy + 18, '#c8d0a0'), specks([[cx - 5, cy + 16]], '#c8d0a0'),
        );
      } else {
        p.push(
          ball(cx, cy + 11.2, 5.2, 2.6, jaw), limb(cx, cy + 2, cx, cy + 8.8, 7.2, 4.8, skin),
          hair(cx - 5, cy + 10, cx + 6, cy + 10, '#2a1a14'), hair(cx - 6, cy + 8, cx - 5, cy + 10, '#2a1a14'), hair(cx + 7, cy + 8, cx + 6, cy + 10, '#2a1a14'),
          ...[-4, -1.3, 1.3, 4].map(d => limb(cx + d, cy + 10.2, cx + d, cy + 11.6, 0.45, 0.2, '#f0e8cc')),
        );
      }
      p.push(ball(cx - 1.6, cy + 6.4, 0.7, 0.6, '#1e2414'), ball(cx + 1.6, cy + 6.4, 0.7, 0.6, '#1e2414'));
      // the eyes sit in dark rims under a heavy brow
      const ey = cy - 1;
      p.push(ball(cx - 5, ey, 3.8, gaze ? 4 : 3, '#262a18'), ball(cx + 5, ey, 3.8, gaze ? 4 : 3, '#262a18'));
      for (const x of [cx - 5, cx + 5]) {
        if (gaze) p.push(ball(x, ey, 2.8, 2.6, '#e8ff70', { glows: true }), ball(x, ey, 1.6, 1.6, '#fcffd0', { glows: true }), limb(x, ey - 1.6, x, ey + 1.6, 0.3, 0.3, '#2a3008'));
        else if (bite) p.push(ball(x, ey + 0.6, 2.6, 0.8, '#d8f040', { glows: true }), limb(x, ey, x, ey + 1.2, 0.35, 0.35, '#1a2008'));
        else p.push(ball(x, ey, 2.6, 1.8, '#d8f040', { glows: true }), limb(x, ey - 1.4, x, ey + 1.4, 0.45, 0.4, '#1a2008'), specks([[x - 1.25, ey - 1]], '#f4ffc0'));
      }
      if (gaze) {
        // light spilling out of them, over the frill and down the snout
        for (const [ex, dir] of [[cx - 5, -1], [cx + 5, 1]]) {
          p.push(hair(ex + dir * 5, ey, ex + dir * 10, ey, '#d8ff60', { glows: true }), hair(ex + dir * 4, ey - 3, ex + dir * 8, ey - 7, '#c0f050', { glows: true }),
            hair(ex + dir * 4, ey + 3, ex + dir * 8, ey + 7, '#c0f050', { glows: true }), hair(ex, ey - 4, ex, ey - 8, '#c0f050', { glows: true }));
          p.push(specks([[ex + dir * 8, ey - 2], [ex - dir * 2, ey + 6]], '#f0ffa0', { glows: true }));
        }
      }
      const b = gaze ? -2.4 : bite ? 0.8 : 0;    // the brow, raised or drawn down
      p.push(limb(cx - 10, ey - 2.6 + b, cx - 3, ey - 0.6 + b, 1.6, 1, horn), limb(cx + 10, ey - 2.6 + b, cx + 3, ey - 0.6 + b, 1.6, 1, horn));
      return p;
    };
    /** @type {object[]} */
    const out = [
      // the tail, up behind it in a serpent's coil, ringed and spiked
      limb(52, 30, 59, 24, 5.2, 4.2, hide), limb(59, 24, 60, 14, 4.2, 3.2, hide),
      limb(60, 14, 55, 7, 3.2, 2.2, hide), limb(55, 7, 50, 9, 2.2, 1.4, hide), limb(50, 9, 50, 13, 1.4, 1, hide),
      limb(58.6, 25, 59.6, 15, 2, 1.6, belly),
      ...[[62, 20, 1], [61, 10, 0.6], [55, 4, 0]].map(([x, y, l]) => sheet([[x - 3 * l - 1.6, y + 2.4 - l * 2], [x + 2.4 * l, y - 2.6 + l * 0.6], [x + 1.2, y + 2.8]], horn, { tilt: [0.4, -0.4] })),
      ...[[56, 27], [59.5, 20], [60, 15], [57.5, 9.5], [53, 7]].map(([x, y]) => hair(x - 2, y - 1, x + 2, y + 1, '#46502e')),
      // the far legs, splayed out behind
      ...legOf(32, 30 - up, 23, 27 - up, 22, 39, 3, flank),
      ...legOf(24, 39 - up, 13, 37 - up, 10, 51, 3.8, flank),
      // the crest
      ...plates.map(([x, y, h, l]) => sheet([[x - 3.6, y + 2], [x + l * 3, y - h], [x + 3.6, y + 2]], horn, { curve: 0.6 })),
      ...plates.map(([x, y, h, l]) => hair(x, y + 1, x + l * 3, y - h + 2, hornDk)),
      // the body, from the haunch forward to the shoulders, the muscle of each
      ball(49, 33 - up * 0.5, 9.6, 7.6, hide), ball(39, 35 - up, 13, 10, hide), ball(29, 39 - up, 13, 10.4, flank),
      ball(38, 31 - up, 8, 4, hideLt), ball(48, 30 - up * 0.5, 5, 3, hideLt),
      ball(39, 42 - up, 11, 3.6, belly),
      // the near legs: hind, middle, front
      ...legOf(49, 37 - up * 0.5, 54, 43, 54, 54, 3.6, hide),
      ...legOf(41, 41 - up, 45, 49 - up * 0.5, 43, 59, 4, hide),
      ...legOf(30, 44 - up, 35, 50 - up * 0.5, 33, 59.6, 4.6, hide),
    ];
    // keeled scales in staggered rows over the back and shoulders, each a small arc
    const onBack = (x, y) => y < 39 - up && (((x - 39) / 12) ** 2 + ((y - 35 + up) / 8.8) ** 2 < 1 || ((x - 49) / 8.6) ** 2 + ((y - 33 + up * 0.5) / 6.6) ** 2 < 1
      || ((x - 29) / 11.6) ** 2 + ((y - 39 + up) / 9.2) ** 2 < 1);
    for (let r = 0; r < 8; r++) for (let x = 18 + (r % 2) * 1.5; x < 58; x += 3) {
      const y = 27 + r * 1.8;
      if (onBack(x - 1, y) && onBack(x + 1, y + 1)) out.push(hair(x - 1.25, y, x, y + 0.75, scaleC), hair(x, y + 0.75, x + 1.25, y, scaleC));
    }
    out.push(
      // a pale scaled belly along the near side, and the folds of skin at each leg
      ...[33, 37, 41, 45].map(x => hair(x, 42.5 - up, x + 1.5, 43 - up, '#8a8660')),
      hair(36, 45 - up, 38, 48 - up, flank), hair(46, 42 - up, 48, 45 - up, flank), hair(52, 38, 55, 41, flank),
    );
    if (gaze) {
      // reared up high on its neck, pale throat toward you
      out.push(limb(30, 41, 25, 27, 8, 6.6, hide), limb(25, 27, 23, 20, 6.6, 6, hide), ball(25, 31, 3.6, 7, belly),
        ...[26, 29, 32, 35, 38].map((y, i) => hair(21 + i, y, 28 + i * 1.2, y - 1, '#8e9a62')), ...head(22, 17));
    } else out.push(...head(22, bite ? 43.6 : 45));
    // the hide is smooth between its scales: the painter's grain on top of the
    // rows of scales only read as dirt
    for (const q of out) Object.assign(q, { smooth: 1 });
    return out;
  },

  // A rustmaw: a beetle the size of a pony, square on. Its wing cases are a
  // dome of rust split down the middle, ridged and pitted in rows and crusted
  // green where the copper has gone over; a plated shield stands behind the
  // head. The head is all mouth: a round wet maw ringed with small teeth,
  // mandibles either side, compound eyes, and two feathered feelers that taste
  // the air for iron. Six jointed legs, spined. Rearing for the bite, the front
  // of it lifts, the spade feet come up and the mandibles spread.
  rustmaw: (pose = 'idle') => {
    const rust = '#a4461a', rustDk = '#7a3010', rustLt = '#c0602c', shield = '#8a3a16', verd = '#5a9a80', verdLt = '#9ad0b8', bronze = '#5e3020', jaw = '#7a3620',
      leg = '#4e2e1c', knee = '#8a5430', gold = '#d8a860';
    const rear = pose === 'windup' || pose === 'special';
    const up = rear ? 7 : 0;      // how far the front of it is raised
    const hy = 49 - up;           // the head
    const sy = up * 0.7;          // and the shell
    /** a jointed leg: hip, knee and foot, with spines down the shin */
    const legOf = (hx, hY, kx, ky, fx, fy, r) => [
      ...both64(limb(hx, hY, kx, ky, r, r * 0.8, leg)), ...both64(ball(kx, ky, r * 0.85, r * 0.8, knee)), ...both64(limb(kx, ky, fx, fy, r * 0.8, r * 0.55, leg)),
      ...[0.3, 0.55, 0.8].flatMap(f => both64(hair(kx + (fx - kx) * f, ky + (fy - ky) * f, kx + (fx - kx) * f - 1.75, ky + (fy - ky) * f - 0.75, gold))),
    ];
    /** @type {object[]} */
    const out = [
      // hind legs, far back: out, up at the knee and down to the floor
      ...legOf(21, 32 - up * 0.4, 10, 19 - up * 0.5, 6, 41, 2.6),
      // the wing cases: a dome split down the middle, a rim to each
      ball(32, 31 - sy, 21.6, 16.8, rust), ball(32, 39 - sy, 20, 8, rustDk),
      ball(24, 24 - sy, 8, 6, rustLt), ball(40, 24 - sy, 8, 6, rustLt),
      limb(32, 15 - sy, 32, 46 - sy, 0.9, 0.9, '#4a1c0c'),
      // the copper gone green in crusts over it
      sheet([[12, 26], [16, 21], [21, 20], [22, 24], [19, 26], [20, 31], [15, 34], [11, 32]].map(([x, y]) => [x, y - sy]), verd, { tilt: [-0.4, -0.3] }),
      sheet([[40, 17], [45, 16], [48, 20], [45, 21], [42, 20]].map(([x, y]) => [x, y - sy]), verd, { tilt: [0.2, -0.6] }),
      sheet([[46, 28], [51, 26], [53.6, 32], [52, 38], [48, 36], [49, 32]].map(([x, y]) => [x, y - sy]), verd, { tilt: [0.6, 0] }),
      sheet([[25, 35], [29, 33], [30, 38], [26, 39]].map(([x, y]) => [x, y - sy]), verd, { tilt: [-0.2, 0] }),
      // middle legs, braced wide, the feet clawed
      ...legOf(16, 42 - up * 0.6, 5, 31 - up * 0.8, 2.4, 55, 3.2),
      ...both64(ball(3, 56, 2.8, 1.6, leg)), ...both64(limb(3, 56.4, 1, 59, 1, 0.6, knee)), ...both64(limb(4, 56.8, 6.8, 59.2, 1, 0.6, knee)),
      // the shield behind the head, with a rolled front edge and a row of rivet-like bosses
      ball(32, 41 - up, 17.2, 8.8, shield), ball(32, 38 - up, 14, 4, '#9a4a22'),
      limb(17, 44.6 - up, 47, 44.6 - up, 1.4, 1.4, '#b8602c'), hair(18, 43.5 - up, 46, 43.5 - up, '#e08850'),
      ...[20, 26, 32, 38, 44].map(x => ball(x, 40.5 - up, 1.1, 1, '#6a2a10')),
    ];
    if (rear) {
      // forelegs raised high, the spade feet up and out
      out.push(...legOf(22, 45 - up, 8, 31 - up, 11, 14, 3.2),
        ...both64(limb(11, 14, 17.6, 10.6, 1.8, 0.9, gold)), ...both64(limb(11, 15, 17.6, 17.6, 1.6, 0.8, gold)), ...both64(limb(10.6, 14, 10.6, 7, 1.4, 0.8, gold)));
    } else {
      out.push(...legOf(22, 48, 14, 42, 9, 56, 3.2),
        ...both64(ball(8.6, 58.6, 4.4, 3.6, leg)),
        ...both64(limb(8, 59, 3.6, 62, 1.2, 0.7, knee)), ...both64(limb(9, 59.6, 9, 62.4, 1.2, 0.7, knee)), ...both64(limb(10, 59, 13.6, 62, 1.2, 0.7, knee)));
    }
    const mr = rear ? [7.6, 6.8] : [6.4, 5.6];    // how wide the maw gapes
    out.push(
      ball(32, hy, 12.4, 8.8, bronze), ball(28, hy - 4, 5, 2.6, '#7a4030'),
      // the maw, round and wet, lipped in raw red. The hole itself is laid
      // flat and turned from the light: painted as a ball, the painter lit
      // its crown, and the dark of the throat came out a grey dome
      ball(32, hy + 2, mr[0] + 1.2, mr[1] + 1, '#8a3424'),
      sheet(oval(32, hy + 2, mr[0], mr[1]), '#3a0a0a', { tilt: [0.55, 0.6] }),
      sheet(oval(32, hy + 2.8, mr[0] * 0.6, mr[1] * 0.6), '#0a0204', { tilt: [0.7, 0.7] }),
      specks([[30, hy + 1], [31, hy + 1]], '#d07a60'),
    );
    if (rear) {
      // mandibles spread wide, ready to close, their inner edges toothed
      out.push(...both64(limb(22, hy - 2, 12, hy - 5, 4, 3.2, jaw)), ...both64(limb(12, hy - 5, 7, hy + 2, 3.2, 2.2, jaw)),
        ...both64(limb(7, hy + 2, 9.6, hy + 8.4, 2.2, 1, gold)), ...both64(specks([[10, hy - 2], [9, hy], [8.5, hy + 2]], '#f0d090')));
    } else {
      out.push(...both64(limb(22, hy + 1, 15, hy + 6, 4, 3.2, jaw)), ...both64(limb(15, hy + 6, 18, hy + 11.6, 3.2, 2.2, jaw)),
        ...both64(limb(18, hy + 11.6, 24.6, hy + 12.6, 2.2, 1, gold)), ...both64(specks([[17.5, hy + 8], [19.5, hy + 10.5], [22, hy + 11.5]], '#f0d090')));
    }
    out.push(
      // compound eyes, dull and faceted, and the feathered feelers
      ball(22.6, hy - 4.4, 2.6, 2.2, '#3a1408'), ball(41.4, hy - 4.4, 2.6, 2.2, '#3a1408'),
      ball(22.6, hy - 4.4, 1.7, 1.4, '#d05a28', { glows: true }), ball(41.4, hy - 4.4, 1.7, 1.4, '#d05a28', { glows: true }),
      specks([[22, hy - 5], [23.5, hy - 4], [22.5, hy - 3.5], [40.75, hy - 5], [42, hy - 4], [41, hy - 3.5]], '#601e0a'),
      ...both64(limb(26, hy - 6, 21, hy - 13, 1, 0.8, leg)), ...both64(limb(21, hy - 13, 17, hy - 15, 0.8, 0.7, leg)),
      ...both64(ball(16.4, hy - 15.4, 2.6, 2, knee)),
      ...[0, 1, 2, 3].flatMap(i => both64(hair(23 - i * 1.5, hy - 10 - i * 1.5, 20.5 - i * 1.5, hy - 11 - i * 1.5, '#a87040'))),
    );
    // the fine detail: a ring of small teeth, the drool, pits in rows down each
    // wing case, flakes of rust coming away
    const teeth = [];
    // along the top and bottom of the rim only: a full ring of pale points
    // read as a gun-sight, not a mouth
    for (let a = 0; a < 24; a++) { if (a % 12 < 2 || a % 12 > 10) continue; const t = a / 24 * Math.PI * 2; teeth.push([32 + Math.cos(t) * (mr[0] - 1), hy + 2 + Math.sin(t) * (mr[1] - 1)]); }
    const pits = [];
    for (const f of [0.22, 0.42, 0.64, 0.84]) for (let y = 18; y <= 34; y += 2) {
      const w = 21.6 * Math.sqrt(Math.max(0, 1 - ((y - 31) / 16.8) ** 2)) * f;
      pits.push([32 - w, y], [32 + w, y]);
    }
    out.push(
      specks(teeth, '#d8c8a4'),
      // ridges down each wing case, following its curve
      ...[0.32, 0.53, 0.74].flatMap(f => [hair(32 - 21.6 * f * 0.55, 17 - sy, 32 - 21.6 * f, 36 - sy, '#6a2810'), hair(32 + 21.6 * f * 0.55, 17 - sy, 32 + 21.6 * f, 36 - sy, '#6a2810')]),
      ...pits.map(([x, y]) => specks([[x, y - sy]], '#5a2008')),
      specks([[17, 22], [44, 17], [50, 27], [27, 34]].map(([x, y]) => [x, y - sy]), verdLt),
      // drool hanging from the lip, not a rope down to the floor
      hair(30, hy + 3 + mr[1], 29, hy + 8 + mr[1], '#c89048'), hair(35, hy + 3 + mr[1], 36, hy + 6 + mr[1], '#c89048'), specks([[29, hy + 10 + mr[1]], [36, hy + 8 + mr[1]]], '#e0b060'),
      specks([[16, 63], [46, 63], [24, 62.5], [40, 62.75]], '#c06a30'),
    );
    // the shell is worn smooth: the painter's grain on it read as a second,
    // noisier coat of rust over the pits
    for (const q of out) Object.assign(q, { smooth: 1 });
    return out;
  },

  // The hero's hound: brown and scruffy, ears that flop, a frayed red collar
  // with a tag, and a tail that will not keep still. Nothing like the grey
  // things of the deep: shorter in the leg, warmer, and on your side.
  dog: (pose = 'idle') => canine(pose, {
    coat: '#8a5a32', dark: '#5e3a1e', pale: '#c8a070', muzzle: '#a8784a', nose: '#1a1210', eye: '#3a2410', eyeLt: '#f0d8a0', grain: '#6e4424',
    brow: '#9a6a3e', ears: 'flop', collar: true,
  }),

  // The druid's wolf: grey and lean where the hound is brown and scruffy, its
  // ears pricked, its eyes amber, a ruff at its throat and no collar on it, and
  // its tail carried low. It comes to a druid in the delves that have no hound.
  wolf: (pose = 'idle') => canine(pose, {
    coat: '#7c7e86', dark: '#4c4e58', pale: '#d4d2c8', muzzle: '#a2a2a6', nose: '#141216', eye: '#c07818', eyeLt: '#f0b030', grain: '#34363e',
    brow: '#8a8c94', ears: 'prick', ruff: true, tail: 'low', tailTip: '#d4d2c8', leggy: true,
  }),

  // A renegade dark elf, hired: the warrior's figure, but cast out of the
  // halls and dressed for it, in worn brown leather where the house wore
  // black mail, a weathered grey-green cloak, dull iron for its silver, and
  // eyes gone amber rather than red, so the hero knows it from its kin across
  // a dark room. Its hood is up, ears through it; it keeps its blades crossed
  // before it, watching the dark, and swings them up together to strike; told
  // to stay, it lets them fall to its sides.
  renegade: (pose = 'idle') => {
    const atk = pose === 'windup', hx = 32, hy = 10 + (atk ? 1 : 0), hood = '#4a5240', hoodDk = '#2a3024';
    const back = [sheet([[hx - 6.5, hy + 3], [hx - 7.5, hy - 4], [hx - 3, hy - 9.5], [hx + 3, hy - 9.5], [hx + 7.5, hy - 4], [hx + 6.5, hy + 3], [hx + 10, hy + 8], [hx - 10, hy + 8]], hoodDk, { curve: 1 })];
    // the hood's rim over the brow, framing the face
    const rim = [sheet([[hx - 5, hy + 1.5], [hx - 5.2, hy - 4], [hx - 2, hy - 7.5], [hx + 2, hy - 7.5], [hx + 5.2, hy - 4], [hx + 5, hy + 1.5], [hx + 3.8, hy - 2.4], [hx, hy - 4.4], [hx - 3.8, hy - 2.4]], hood, { curve: 0.8 }),
      hair(hx - 4.6, hy - 3.6, hx - 1.6, hy - 6.8, '#626a56')];
    const body = recolour(CREATURES.drow_warrior(atk ? 'windup' : pose === 'sit' ? 'idle' : 'special'), RENEGADE).map(p => (p.glows && p.c === '#ff3a34' ? { ...p, c: '#ffb648' } : p));
    return [...back, ...body, ...rim];
  },

  // A grey dwarf: short and very broad, bald, grey as the rock, an iron beard
  // in braids bound with copper, black mail to the knee and plate over it, and
  // a war hammer, a spike behind its head. Striking, it goes up over its head; working its spell of
  // growing, it flings its arms wide and the runes on its plate kindle.
  grey_dwarf: (pose = 'idle') => {
    const atk = pose === 'windup', swell = pose === 'special';
    const k = dwarfKit(), dy = atk ? 1 : 0;
    const fist = (x, y) => [ball(x, y, 3.2, 3, k.skin), hair(x - 1.6, y - 0.6, x + 1.6, y - 0.6, k.skinDk)];
    let arms;
    if (atk) arms = [limb(16, 27, 24, 14, 3.8, 3.2, k.mail), limb(48, 27, 40, 14, 3.8, 3.2, k.mail), ...warPick(32, 10, 0.55, -0.83, 13, k), ...fist(28, 12), ...fist(35, 9.5)];
    else if (swell) arms = [limb(16, 27, 7, 20, 3.8, 3.2, k.mail), ...fist(5.5, 18.5), limb(48, 27, 57, 20, 3.8, 3.2, k.mail), ...fist(58.5, 18.5), ...warPick(58.5, 18.5, 0.1, 1, 30, k)];
    else arms = [limb(16, 27, 13, 38, 3.8, 3.4, k.mail), ...fist(12.5, 41), limb(48, 27, 51, 37, 3.8, 3.4, k.mail), ...fist(51.5, 39.5), ...warPick(51.5, 39.5, 0.04, -1, 26, k)];
    // the runes cut in its plate, kindling as the working takes it
    const runes = swell ? [[24, 30, 27, 34], [27, 34, 24, 37], [40, 30, 37, 34], [37, 34, 40, 37], [32, 29, 32, 36]].map(([a, b, c2, d2]) => hair(a, b, c2, d2, '#ffb050', { glows: true })) : [];
    return [...dwarfBody(k, { dy }), ...runes, ...arms, ...dwarfHead(32, 12 + dy, k, { grim: atk || swell })];
  },
  // A grey dwarf arbalest: the same people under an iron helm, in leather over
  // mail, with a crossbow as long as itself, held across the body; loosing, it
  // comes up to the chest; taking careful aim, it comes up to the eye and its
  // bow points straight at you.
  dwarf_arbalest: (pose = 'idle') => {
    const atk = pose === 'windup', aim = pose === 'special';
    const k = dwarfKit(), wood = '#6a4a2c', woodDk = '#46301c', string = '#d8d0c0';
    const fist = (x, y) => [ball(x, y, 3, 2.8, k.skin), hair(x - 1.4, y - 0.6, x + 1.4, y - 0.6, k.skinDk)];
    let bow;
    if (aim) {
      // end on: the prod a wide arc across the face, the bolt's head at its heart, glinting
      bow = [limb(16, 27, 25, 24, 3.8, 3.2, k.mail), limb(48, 27, 39, 24, 3.8, 3.2, k.mail), ...fist(26, 23.5), ...fist(38, 23.5),
        ball(32, 21, 3.4, 3, woodDk), limb(14, 17, 32, 21, 1.4, 1.1, wood), limb(50, 17, 32, 21, 1.4, 1.1, wood), hair(14.5, 17.5, 49.5, 17.5, string),
        ball(32, 20.4, 1.4, 1.4, k.ironLt), specks([[31.5, 20]], '#ffffff')];
    } else if (atk) {
      // loosing: brought up to the chest, across the body
      bow = [limb(20, 27, 20, 31, 3.6, 3.2, k.mail), ...fist(21, 31), limb(44, 27, 44, 26, 3.6, 3.2, k.mail), ...fist(43, 26),
        limb(18, 34, 48, 23, 1.8, 1.5, wood), hair(19, 33, 47, 22.5, woodDk),
        limb(44, 16, 52, 30, 1.3, 1.3, wood), hair(44.5, 16.5, 51.5, 29.5, string), ball(48.4, 23, 1, 1, k.ironLt)];
    } else {
      // at rest: the crossbow upright on its left shoulder, the prod above its head
      bow = [limb(20, 27, 15, 36, 3.6, 3.2, k.mail), ...fist(14, 38), limb(44, 27, 47, 38, 3.6, 3.2, k.mail), ...fist(47.5, 40),
        limb(14, 40, 12, 6, 1.8, 1.5, wood), hair(13.4, 39, 11.4, 7, woodDk),
        limb(2, 9, 12, 5, 1.3, 1.1, wood), limb(22, 9, 12, 5, 1.3, 1.1, wood), hair(2.5, 9.5, 21.5, 9.5, string)];
    }
    // a quiver of bolts at the right hip
    const quiver = [sheet([[50, 34], [56, 34], [55, 52], [51, 52]], k.leather, { curve: 0.5 }), ...[51.5, 53, 54.5].map(x => limb(x, 34, x, 30, 0.5, 0.4, '#c8c0b0')), hair(50.5, 40, 55.5, 40, k.copper)];
    return [...quiver, ...dwarfBody(k, { narrow: true }), ...bow.slice(0, aim ? 4 : 6), ...dwarfHead(32, 12, k, { grim: atk || aim, helm: true }), ...bow.slice(aim ? 4 : 6)];
  },

  // A lizardfolk warrior: on its hind legs and as tall as a man, green-scaled
  // and crested, a spear in one hand and a turtle-shell shield on the other
  // arm, its tail out behind. Striking, the spear comes up; coiling to sweep,
  // the body turns and the tail swings round low in front, across its feet.
  lizardfolk: (pose = 'idle') => {
    const atk = pose === 'windup', sweep = pose === 'special';
    const k = lizardKit();
    const hand = (x, y) => [ball(x, y, 2.4, 2.2, k.scale), hair(x - 1.2, y + 1, x + 1.2, y + 1, k.scaleDk)];
    const spear = (x0, y0, x1, y1) => [limb(x0, y0, x1, y1, 0.9, 0.9, k.wood), sheet([[x1 - 1.6, y1 + 0.5], [x1, y1 - 5], [x1 + 1.6, y1 + 0.5]], k.boneDk), hair(x1 - 0.4, y1, x1, y1 - 4, k.bone)];
    const shield = (x, y) => [ball(x, y, 7, 8, k.shellDk), ball(x, y - 0.5, 6, 7, k.shell), ...[[0, -3], [-3, 1], [3, 1], [0, 4]].map(([dx, dy]) => ball(x + dx, y + dy, 2, 1.7, k.shellLt)), hair(x - 5, y - 4, x - 2, y - 6.5, '#c8c890')];
    let arms;
    if (atk) arms = [limb(43, 23, 48, 14, 3, 2.6, k.scale), ...hand(48.5, 12.5), ...spear(48.5, 30, 49, 0.5), limb(21, 23, 16, 30, 3, 2.6, k.scale), ...shield(14, 31)];
    else if (sweep) arms = [limb(21, 23, 13, 26, 3, 2.6, k.scale), ...shield(10, 26), limb(43, 23, 51, 28, 3, 2.6, k.scale), ...hand(52, 29), ...spear(52, 44, 56, 14)];
    else arms = [limb(43, 23, 47, 33, 3, 2.6, k.scale), ...hand(47.5, 35), ...spear(47.5, 56, 47.5, 9), limb(21, 23, 17, 32, 3, 2.6, k.scale), ...shield(15, 34)];
    // coiled to sweep: the tail swung round low across the front of its feet, the body leaning into it
    const tail = sweep ? [limb(44, 48, 50, 56, 4.4, 3.6, k.scale), limb(50, 56, 34, 60, 3.6, 2.6, k.scale), limb(34, 60, 14, 57, 2.6, 1.2, k.scale), hair(48, 55, 16, 57, k.scaleDk), specks([[40, 59], [28, 59], [20, 57.5]], k.scaleLt)] : [];
    return [...lizardBody(k, { tail: sweep ? 'none' : 'rest' }), ...arms, ...lizardHead(32, 11, k, { open: atk || sweep }), ...tail];
  },
  // A lizardfolk shaman: slighter, in a cloak of hanging reeds and a headdress
  // of bones, a staff hung with charms. Spitting fire, the staff comes forward;
  // chanting over its kin, both arms go up and green light gathers between them.
  lizard_shaman: (pose = 'idle') => {
    const atk = pose === 'windup', chant = pose === 'special';
    const k = lizardKit(), reed = '#6a7040', reedDk = '#4a5028';
    const hand = (x, y) => [ball(x, y, 2.1, 2, k.scale), hair(x - 1, y + 0.9, x + 1, y + 0.9, k.scaleDk)];
    const staff = (x0, y0, x1, y1) => [limb(x0, y0, x1, y1, 0.9, 0.8, k.wood), ball(x1, y1, 2.6, 2.4, k.bone), ball(x1 - 0.9, y1 - 0.3, 0.6, 0.6, '#1a1a10'), ball(x1 + 0.9, y1 - 0.3, 0.6, 0.6, '#1a1a10'), ...[-2.5, 2.5].map(d => limb(x1 + d, y1 + 2, x1 + d * 1.2, y1 + 6, 0.3, 0.3, k.boneDk))];
    let arms;
    if (atk) arms = [limb(43, 23, 47, 20, 2.8, 2.4, k.scale), ...hand(47.5, 19.5), ...staff(42, 34, 52, 6), limb(21, 23, 18, 32, 2.8, 2.4, k.scale), ...hand(17.5, 33.5)];
    else if (chant) arms = [limb(21, 23, 14, 12, 2.8, 2.4, k.scale), ...hand(13.5, 10.5), limb(43, 23, 50, 12, 2.8, 2.4, k.scale), ...hand(50.5, 10.5), ...staff(51, 30, 51, 4),
      ball(32, 4, 4.5, 3, '#a0e060', { glows: true }), ...[[24, 6], [40, 6], [32, 0.5]].map(([x, y]) => ball(x, y, 1, 1, '#d0ff90', { glows: true }))];
    else arms = [limb(43, 23, 46, 33, 2.8, 2.4, k.scale), ...hand(46.5, 34.5), ...staff(46.5, 58, 46.5, 6), limb(21, 23, 18, 33, 2.8, 2.4, k.scale), ...hand(17.5, 34.5)];
    // the reed cloak over the shoulders and down the back, and the headdress: a beast's skull worn over its own
    const cloak = [sheet([[17, 17], [47, 17], [55, 59], [46, 61], [32, 59], [18, 61], [9, 59]], reedDk, { curve: 0.8 }), ...[12, 16, 20, 24, 28, 36, 40, 44, 48, 52].map(x => hair(x + (x < 32 ? 3 : -3) * 0.5, 18, x + (x - 32) * 0.2, 60, reed))];
    const headdress = [sheet([[25, 3], [39, 3], [41, 8], [32, 10], [23, 8]], k.bone, { curve: 0.6 }), ball(28.5, 6, 1.2, 1, '#1a1a10'), ball(35.5, 6, 1.2, 1, '#1a1a10'),
      ...[-1, 1].map(sd => limb(32 + sd * 6, 4, 32 + sd * 11, -0.5, 0.8, 0.3, k.boneDk))];
    return [...cloak, ...lizardBody(k, { tail: 'rest' }).filter(p => p.c !== k.hide && p.c !== k.hideDk), ...arms, ...lizardHead(32, 12, k, { open: atk }), ...headdress];
  },

  // The sellsword: a hired blade, as tall as the hero. A kettle hat with a wide
  // iron brim, a brigandine of blue-grey cloth studded with brass over a mail
  // shirt, a red sash from shoulder to hip, a steel pauldron, a scar down the
  // cheek, and a greatsword: carried on the shoulder, swung up over the head
  // for the cut, and planted point-down to lean on while it waits for its pay.
  sellsword: (pose = 'idle') => {
    const skin = '#e6b694', shade = '#a87458', coat = '#4a566c', coatDk = '#323c4e', mail = '#7c8290', sash = '#a8322a', leather = '#6a4a30', boot = '#3a2c22',
      trouser = '#5a4a3a', steel = '#aeb4be', steelLt = '#e4e8ee', iron = '#6e747e', brass = '#c9a24a', grip = '#5a3a22', blade = '#d4d8e0';
    const cut = pose === 'windup', sit = pose === 'sit';
    // the body leans into the cut, or settles onto the sword
    const lean = cut ? 1.5 : sit ? -1 : 0, drop = cut ? 2 : sit ? 1 : 0;
    const hx = 32 + lean, hy = 9.5 + drop;
    // a greatsword from the grip at (x, y) along (u, v): pommel, grip, guard, blade, fuller
    const sword = (x, y, u, v, len) => [
      limb(x - u * 3.2, y - v * 3.2, x + u * 1.2, y + v * 1.2, 0.9, 0.9, grip),
      ball(x - u * 4, y - v * 4, 1.3, 1.3, brass),
      limb(x + u * 2 - v * 4.4, y + v * 2 + u * 4.4, x + u * 2 + v * 4.4, y + v * 2 - u * 4.4, 0.8, 0.8, iron),
      limb(x + u * 2.8, y + v * 2.8, x + u * len, y + v * len, 1.8, 0.7, blade, { smooth: 1 }),
      hair(x + u * 4, y + v * 4, x + u * (len - 3), y + v * (len - 3), '#8a909c'),
      hair(x + u * 4 - v, y + v * 4 + u, x + u * (len - 4) - v * 0.8, y + v * (len - 4) + u * 0.8, '#f6f8fc'),
    ];
    const hand = (x, y) => [ball(x, y, 2, 1.8, leather), specks([[x - 0.75, y - 0.75]], '#8a6a48')];
    const ty = drop, tl = lean * 0.6;
    const body = [
      // the mail below the brigandine, the coat, its brass rivets, the sash, the belt and its purse
      sheet([[22 + tl, 39 + ty], [42 + tl, 39 + ty], [43.5, 47.5 + ty], [20.5, 47.5 + ty]], mail, { curve: 0.6 }),
      ...[41.5, 43.5, 45.5].map(y => hair(21.5, y + ty, 42.5, y + ty, '#5a6068')),
      sheet([[21 + lean, 16 + ty], [43 + lean, 16 + ty], [43.5 + tl, 40 + ty], [20.5 + tl, 40 + ty]], coat, { curve: 1 }),
      sheet([[21 + lean, 16 + ty], [26 + lean, 16 + ty], [24.5 + tl, 40 + ty], [20.5 + tl, 40 + ty]], coatDk, { curve: 0.4 }),
      ...[20, 24, 28, 32, 36].flatMap(y => [23, 27.5, 36.5, 41].map(x => specks([[x + lean * (1 - y / 40), y + ty]], brass))),
      limb(41 + lean, 17 + ty, 23 + tl, 38 + ty, 1.4, 1.4, sash), hair(40 + lean, 16.5 + ty, 22.5 + tl, 37 + ty, '#d0584a'),
      line(20.5 + tl, 39.5 + ty, 43.5 + tl, 39.5 + ty, leather), ball(32 + tl, 39.5 + ty, 1.3, 1.1, brass),
      ball(39 + tl, 42.5 + ty, 2.2, 2.6, leather), dots([[39, Math.floor(41 + ty)]], brass),
      // the steel pauldron on the left shoulder
      ball(21.5 + lean, 17.5 + ty, 5, 3.6, steel), hair(17.5 + lean, 16.5 + ty, 25 + lean, 15.5 + ty, steelLt),
      ...[19.5, 23.5].map(x => ball(x + lean, 19.5 + ty, 0.6, 0.6, iron)),
      limb(32 + lean, 13 + ty, 32 + lean, 16.5 + ty, 2, 2.2, skin),
    ];
    let legs, arms;
    if (cut) {
      // a wide stance, the front foot forward, the sword swung up over the head and back
      legs = [
        limb(28, 46 + ty, 22, 54, 2.6, 2.3, trouser), limb(22, 54, 20.5, 60, 2.3, 2.1, boot), ball(19.5, 61.4, 3.6, 1.6, boot),
        limb(36, 46 + ty, 42, 53, 2.6, 2.3, trouser), limb(42, 53, 44, 60, 2.3, 2.1, boot), ball(45, 61.4, 3.6, 1.6, boot),
      ];
      arms = [
        limb(22 + lean, 18 + ty, 30, 6.5, 2.4, 2, coat), limb(42 + lean, 18 + ty, 38.5, 6, 2.4, 2, coat),
        ...sword(35, 4.6, -0.98, 0.2, 27),
        ...hand(32, 5.4), ...hand(37.5, 4.6),
      ];
    } else if (sit) {
      // the weight on one hip, the sword planted before it, both hands on the pommel
      legs = [
        limb(28, 47 + ty, 25.5, 55, 2.6, 2.3, trouser), limb(25.5, 55, 26, 60, 2.3, 2.1, boot), ball(25.5, 61.4, 3.4, 1.6, boot),
        limb(35, 47 + ty, 38.5, 54.5, 2.6, 2.3, trouser), limb(38.5, 54.5, 35.5, 60, 2.3, 2.1, boot), ball(35, 61.4, 3.4, 1.6, boot),
      ];
      arms = [
        ...sword(42, 33.5, 0, 1, 28),
        limb(21 + lean, 19 + ty, 24.5, 28.5, 2.4, 2, coat), limb(24.5, 28.5, 39, 31.5, 2, 1.8, coat),
        limb(42 + lean, 19 + ty, 44, 30, 2.4, 2, coat),
        ...hand(40, 31.4), ...hand(43.5, 31.8),
      ];
    } else {
      // standing easy, the sword carried back over the right shoulder
      legs = [
        ...both64(limb(28, 46, 27, 55, 2.6, 2.3, trouser)), ...both64(limb(27, 55, 26.8, 60, 2.3, 2.1, boot)), ...both64(ball(26.2, 61.4, 3.4, 1.6, boot)),
      ];
      arms = [
        limb(21, 19, 19.5, 30, 2.4, 2, coat), limb(19.5, 30, 20, 37, 2, 1.8, leather), ...hand(20, 38.4),
        ...sword(41, 31, 0.5, -0.86, 29),
        limb(43, 19, 46, 29, 2.4, 2, coat), limb(46, 29, 41.5, 31.5, 2, 1.8, coat), ...hand(41, 31.2),
      ];
    }
    // the head: a hard, weathered face under the kettle hat's brim; eyes narrowed when it leans and waits
    const head = [
      ball(hx, hy, 3.6, 4.3, skin), ball(hx, hy + 3.6, 2.8, 1.5, skin),
      ball(hx, hy - 3.6, 4.4, 3, steel), hair(hx - 3, hy - 5, hx, hy - 6.2, steelLt),
      sheet(oval(hx, hy - 1.6, 8, 1.6), iron, { curve: 0.4 }), hair(hx - 7, hy - 2, hx + 2, hy - 2.75, '#9aa0aa'),
      ball(hx - 3.8, hy + 1, 0.6, 1.1, shade), ball(hx + 3.8, hy + 1, 0.6, 1.1, shade),
      hair(hx - 2.5, hy - 0.25, hx - 0.75, hy, '#3a2a20'), hair(hx + 0.75, hy, hx + 2.5, hy - 0.25, '#3a2a20'),
      dots(sit ? [[Math.floor(hx - 2), Math.floor(hy + 1)], [Math.floor(hx + 1), Math.floor(hy + 1)]] : [[Math.floor(hx - 2), Math.floor(hy + 0.5)], [Math.floor(hx + 1), Math.floor(hy + 0.5)]], '#1e1a1a'),
      limb(hx, hy + 0.6, hx + 0.2, hy + 2.6, 0.5, 0.75, shade),
      hair(hx - 1.25, hy + 3.75, hx + 1.25, hy + 3.75, cut ? '#3a1a14' : '#7a4434'),
      // the scar, the stubble
      hair(hx + 2, hy - 0.5, hx + 2.75, hy + 3, '#e8c0a8'),
      specks([[hx - 2, hy + 4], [hx - 1, hy + 4.75], [hx, hy + 5], [hx + 1, hy + 4.75], [hx + 2, hy + 4]], '#7a5a44'),
    ];
    return [...legs, ...body, ...arms, ...head];
  },
  // The healer: a hooded robe of grey-green wool belted with a cord, a satchel
  // on a strap across the chest with sprigs of herb sticking out of it, a leaf
  // stitched in pale thread over the heart, and a staff of ash with a bundle of
  // dried herbs and a little bell tied below its head. A kind, tired face in the
  // hood's shadow. Rapping, it swings the staff up in both hands to bring it
  // down; told to wait, it kneels with the staff laid by and its hands in the
  // open satchel, a roll of bandage between them.
  mender: (pose = 'idle') => {
    const robe = '#6a7a62', robeDk = '#4e5c48', robeLt = '#8a9a80', hood = '#56664e', cord = '#c8b48a', strap = '#6a4a30',
      bag = '#8a6440', leaf = '#5e9a48', ash = '#a8865a', herb = '#b8a058', bell = '#c9a24a', linen = '#e8e2d2', skin = '#ecc0a0', skinDk = '#b0806a', hairc = '#6a4630';
    const rap = pose === 'windup', sit = pose === 'sit', heal = pose === 'heal';
    // kneeling, the whole of it sits lower and the robe pools on the floor
    const dy = sit ? 9 : 0, lean = rap ? 1.5 : 0;
    const hx = 32 + lean, hy = 9.5 + dy + (rap ? 1 : 0);
    // the staff from (x1, y1) to its head at (x2, y2): the wood, the herbs and the bell tied below the head
    const staff = (x1, y1, x2, y2) => {
      const l = Math.hypot(x2 - x1, y2 - y1), u = (x2 - x1) / l, v = (y2 - y1) / l, bx = x2 - u * 5, by = y2 - v * 5;
      return [
        limb(x1, y1, x2, y2, 0.9, 1.1, ash), hair(x1 - v * 0.5, y1 + u * 0.5, x2 - v * 0.5, y2 + u * 0.5, '#7a5e3a'),
        ball(x2, y2, 1.6, 1.6, ash),
        limb(bx - v * 0.4, by + u * 0.4, bx - v * 3.4 + u * 2.4, by + u * 3.4 + v * 2.4, 1.3, 0.6, herb),
        hair(bx, by, bx - v * 2.8 + u * 3, by + u * 2.8 + v * 3, '#7a8a3a'),
        line(bx - v * 0.4, by + u * 0.4, bx + v * 1.6, by - u * 1.6, cord),
        ball(bx + v * 2.4, by - u * 2.4 + 1.2, 1, 1.2, bell), specks([[bx + v * 2.4, by - u * 2.4 + 2.5]], '#5a4420'),
      ];
    };
    const hand = (x, y) => [ball(x, y, 1.8, 1.7, skin), specks([[x - 0.75, y - 0.75]], '#e8c0a0')];
    // the robe: wide at the hem, pooled on the floor when it kneels
    const body = sit ? [
      sheet([[22, 16 + dy], [42, 16 + dy], [47, 50], [52, 61], [12, 61], [17, 50]], robe, { curve: 1 }),
      sheet([[12, 58], [52, 58], [54, 63], [10, 63]], robeDk, { curve: 0.6 }),
    ] : [
      sheet([[22, 16], [42, 16], [45, 38], [47, 62], [42, 63], [37, 61.6], [32, 63], [27, 61.6], [22, 63], [17, 62], [19, 38]], robe, { curve: 1 }),
      ...[[25, 40, 21.5, 62], [31.2, 40, 31, 63], [37.5, 40, 41.5, 62]].map(([x0, y0, x1, y1]) => sheet([[x0, y0], [x0 + 1.3, y0], [x1 + 1.1, y1], [x1 - 0.9, y1]], robeDk, { curve: 0.3 })),
      ...[[28, 40, 26, 62], [34.5, 40, 36.5, 62]].map(([x0, y0, x1, y1]) => sheet([[x0, y0], [x0 + 1, y0], [x1 + 1, y1], [x1 - 0.6, y1]], robeLt, { curve: 0.3 })),
      ...both64(ball(27, 62.2, 2.4, 1, '#4a3a2a')),
    ];
    body.push(
      // the cord at the waist, its knotted ends hanging
      line(19.5 + lean * 0.5, 37 + dy, 44.5 + lean * 0.5, 37 + dy, cord),
      limb(27 + lean * 0.5, 37.5 + dy, 26 + lean * 0.5, 45 + dy, 0.5, 0.4, cord), ball(26 + lean * 0.5, 45.6 + dy, 0.8, 0.9, cord),
      // the strap from the left shoulder to the right hip, and the satchel on it
      limb(23.5 + lean, 17 + dy, 39.5 + lean * 0.5, 38 + dy, 0.8, 0.8, strap),
      sheet([[36, 36 + dy], [45, 36 + dy], [45.6, 44.5 + dy], [35.4, 44.5 + dy]], bag, { curve: 0.5 }),
      sheet([[35.6, 35.6 + dy], [45.4, 35.6 + dy], [45, 39 + dy], [36, 39 + dy]], '#76522e', { curve: 0.3 }),
      dots([[40, Math.floor(39.8 + dy)]], bell),
      ...[[37, 33.5], [39, 32.6], [41.5, 33], [43.5, 34]].map(([x, y]) => line(x, 35.6 + dy, x + (x - 40) * 0.25, y + dy, leaf)),
      specks([[36.5, 33.5 + dy], [39, 32.5 + dy], [42, 33 + dy], [44, 34 + dy]], '#8ac864'),
      // the leaf stitched over the heart
      sheet([[25.2 + lean, 26 + dy], [27.2 + lean, 23 + dy], [29.2 + lean, 26 + dy], [27.2 + lean, 28 + dy]], '#c8d8b0', { curve: 0.3 }),
      hair(27.2 + lean, 23.25 + dy, 27.2 + lean, 27.75 + dy, '#8aa070'),
    );
    let arms;
    if (rap) {
      // the staff swung up over the head in both hands, to come down on the foe
      arms = [
        ...staff(46, 7.6, 11, 2.6),
        limb(22 + lean, 18, 25.5, 6.5, 2, 1.6, robe), limb(42 + lean, 18, 39.5, 7, 2, 1.6, robe),
        ...hand(26, 5.6), ...hand(39.5, 6.4),
      ];
    } else if (sit) {
      // the staff laid on the floor beside it, both hands in the satchel with a roll of bandage
      arms = [
        ...staff(50, 61.6, 13, 60.6),
        limb(22, 19 + dy, 27, 32 + dy, 2, 1.8, robe), limb(27, 32 + dy, 36, 37 + dy, 1.8, 1.6, robe),
        limb(42, 19 + dy, 44.5, 31 + dy, 2, 1.8, robe),
        ball(39, 37.6 + dy, 2.4, 1.9, linen), hair(37, 37 + dy, 41, 38.5 + dy, '#b8b0a0'),
        ...hand(36.6, 37.8 + dy), ...hand(42.4, 36.6 + dy),
      ];
    } else if (heal) {
      // tending: the staff leant in the crook of the left arm, both hands held out
      // and cupped, a warm green light gathering over them as the wound knits
      arms = [
        ...staff(23, 62, 13, 6),
        limb(22, 19, 23.5, 30, 2, 1.8, robe), limb(23.5, 30, 28.6, 33, 1.8, 1.6, robe),
        limb(42, 19, 40.5, 30, 2, 1.8, robe), limb(40.5, 30, 35.4, 33, 1.8, 1.6, robe),
        ...hand(29.2, 32.6), ...hand(34.8, 32.6),
        ball(32, 28.6, 4.4, 4.2, '#b8e890', { glows: true }), ball(32, 28.6, 2.1, 2, '#fffbe0', { glows: true }),
        specks([[27.5, 24], [36.5, 23.4], [30, 20.6], [34.6, 19.2], [26.4, 28], [37.6, 28.4], [32, 17]], '#d8ffb0', { glows: true }),
      ];
    } else {
      // the staff planted upright in the right hand, the left hand on the satchel
      arms = [
        ...staff(16, 62, 16, 6),
        limb(22, 19, 18.5, 34, 2, 1.8, robe), ...hand(17.5, 35),
        limb(42, 19, 44, 33.5, 2, 1.8, robe), ...hand(43.5, 35.5),
      ];
    }
    // the head in its hood: a round, kind face, a lock of hair, a small tired smile
    const head = [
      sheet([[hx - 8, hy + 7.5], [hx - 7.6, hy - 2.5], [hx - 4.4, hy - 8.4], [hx + 4.4, hy - 8.4], [hx + 7.6, hy - 2.5], [hx + 8, hy + 7.5], [hx, hy + 9.4]], hood, { curve: 1 }),
      sheet([[hx - 5.5, hy + 6], [hx - 5.4, hy - 3], [hx - 3, hy - 6.4], [hx + 3, hy - 6.4], [hx + 5.4, hy - 3], [hx + 5.5, hy + 6]], '#2e3628', { curve: 0.6 }),
      ball(hx, hy + 0.6, 3.6, 4.2, skin), ball(hx, hy + 3.8, 2.6, 1.4, skin),
      limb(hx - 3.6, hy - 3, hx + 1.2, hy - 4, 1.4, 0.9, hairc),
      ball(hx - 3.6, hy + 1.5, 0.5, 1, skinDk), ball(hx + 3.6, hy + 1.5, 0.5, 1, skinDk),
      hair(hx - 2.5, hy - 0.25, hx - 1, hy, '#5a3a28'), hair(hx + 1, hy, hx + 2.5, hy - 0.25, '#5a3a28'),
      ...(heal ? [hair(hx - 2.75, hy + 1.25, hx - 1.25, hy + 1.25, '#2a2020'), hair(hx + 1.25, hy + 1.25, hx + 2.75, hy + 1.25, '#2a2020')] : [dots([[Math.floor(hx - 2), Math.floor(hy + 1)], [Math.floor(hx + 1), Math.floor(hy + 1)]], '#2a2020')]),
      limb(hx, hy + 1.2, hx + 0.2, hy + 3, 0.5, 0.7, skinDk),
      hair(hx - 1.5, hy + 4, hx - 0.5, hy + 4.5, rap ? '#5a2a20' : '#8a4a3a'), hair(hx - 0.5, hy + 4.5, hx + 1.5, hy + 4, rap ? '#5a2a20' : '#8a4a3a'),
      specks([[hx - 2.25, hy + 2.75], [hx + 2.25, hy + 2.75]], '#e0a088'),
      hair(hx - 3.5, hy - 6.5, hx - 6.5, hy + 4, '#465640'),
    ];
    return [...body, ...arms, ...head];
  },
  // The freed goblin at your heel: wiry and ribby under a hooded rag of a
  // mantle chewed ragged at the hem, a loincloth and a cord belt with its ring
  // of picks and a key, the manacle it came in with still on one wrist and a
  // stub of chain, and a short knife with a kink in the blade. Standing, the
  // knife held low; lunging, it drives the knife up at you, the chained arm flung
  // back; told to stay, it squats on its heels, the knife pushed through the belt.
  scrag: (pose = 'idle') => {
    const skin = '#72ac4c', skinLt = '#8cc466', dark = '#4c7e34', foot = '#5a8c3c', rag = '#80705c', ragDk = '#5a4c3c', cloth = '#6a5c4a', cord = '#4a3a28';
    const iron = '#6e727c', ironLt = '#a8acb4', brass = '#c9a24a', steel = '#c0c4cc', grip = '#6a4a2a';
    const stab = pose === 'windup', sit = pose === 'sit';
    const hx = stab ? 33 : 32, hy = stab ? 34 : sit ? 34.4 : 29.6;
    // how far the body has dropped: a long way for the lunge, a little to squat
    const D = stab ? 4.4 : sit ? 4.8 : 0, B = 47.2 + D;
    // the rag: a hooded mantle over the shoulders, short enough to show the ribs, chewed ragged at the hem
    const mantle = [
      sheet([[24, 36 + D], [40, 36 + D], [44.8, 38.4 + D], [46.4, 42.4 + D], [43.6, 41 + D], [41.6, 42.4 + D], [38.8, 40.2 + D], [36, 41.6 + D],
        [32.8, 39.8 + D], [29.6, 41.6 + D], [26.4, 40.2 + D], [23.2, 42.4 + D], [20.4, 41 + D], [17.6, 42.4 + D], [19.2, 38.4 + D]], rag, { curve: 1 }),
      ...[[22, 39], [27, 38.4], [37, 38.4], [42, 39]].map(([x, y]) => hair(x, y + D, x + 0.5, y + 2 + D, ragDk)),
      ...[[23, 42.2], [29.5, 41.4], [36, 41.4], [41.5, 42.2]].map(([x, y]) => hair(x, y + D, x + 0.25, y + 1.75 + D, rag)),
      specks([[26, 39 + D], [27, 40 + D], [28, 39 + D], [29, 40 + D]], '#a89a82'),
    ];
    // the ring of picks and a key, hung at the belt
    const kx = sit ? 31 : 37, ky = B + 3;
    const picks = [
      hair(kx - 1.6, ky + 1.2, kx - 3.2, ky + 6, '#9aa0aa'), hair(kx - 0.4, ky + 1.6, kx - 0.8, ky + 6.8, '#9aa0aa'),
      limb(kx + 2, ky + 2, kx + 2.8, ky + 6, 0.5, 0.5, brass), specks([[kx + 3, ky + 5], [kx + 4, ky + 5], [kx + 4, ky + 6]], brass),
      ball(kx, ky, 2.4, 2.4, brass), ball(kx, ky, 1.2, 1.2, '#2a1e14'),
    ];
    // an iron cuff across the wrist at (x, y), its band running along (u, v),
    // and what is left of its chain: links face on and edge on, the last sprung open
    const cuff = (x, y, u, v, links) => [
      ...links.map(([lx, ly], i) => (i % 2 ? limb(lx, ly - 1.2, lx, ly + 1.2, 0.8, 0.8, '#585c66') : ball(lx, ly, 1.6, 1.7, iron))),
      ...links.map(([lx, ly], i) => (i % 2 ? hair(lx, ly - 1, lx, ly, ironLt) : specks([[lx, ly]], '#1c1a22'))),
      hair(links[links.length - 1][0] - 1, links[links.length - 1][1] + 1, links[links.length - 1][0] - 2, links[links.length - 1][1] + 2, iron),
      limb(x - u, y - v, x + u, y + v, 1.8, 1.8, iron), hair(x - u, y - v - 1, x + u * 0.6, y + v * 0.6 - 1, '#c8ccd4'),
    ];
    // a short knife with a kink in the blade, from the fist at (x, y) along (u, v)
    const knife = (x, y, u, v) => [
      limb(x + u * 1.8, y + v * 1.8, x + u * 6.4, y + v * 6.4, 1.3, 1.1, steel, { smooth: 1 }),
      limb(x + u * 6.4, y + v * 6.4, x + u * 8.8 + v * 1.2, y + v * 8.8 - u * 1.2, 1.1, 0.5, steel, { smooth: 1 }),
      hair(x + u * 2.4 - v * 0.6, y + v * 2.4 + u * 0.6, x + u * 6.4 - v * 0.6, y + v * 6.4 + u * 0.6, '#f4f6fa'),
      limb(x - u * 0.6, y - v * 0.6, x + u * 1.6, y + v * 1.6, 0.9, 0.9, grip),
    ];
    /** a hand: the fist, the knuckles, fingers curled */
    const hand = (x, y, open) => [ball(x, y, 2.6, 2.4, skin), ...(open ? [-1, 0, 1].map(d => limb(x + d * 1.3, y + 1.6, x + d * 1.6, y + 3.8, 0.55, 0.4, skin)) : [hair(x - 1.5, y - 0.5, x + 1.5, y - 0.5, dark)]),
      specks([[x - 1, y - 1.5], [x + 1, y - 1.5]], skinLt)];
    /** a leg from the hip, through a knobbly knee, to a long bare foot with its toes */
    const leg = (hx2, hy2, kx2, ky2, fx, fy, toe) => [
      limb(hx2, hy2, kx2, ky2, 2.2, 1.8, dark), ball(kx2, ky2, 2.2, 2, dark), limb(kx2, ky2, fx, fy, 1.8, 1.5, dark),
      limb(fx, fy + 0.6, fx + toe * 4.6, fy + 1.6, 1.7, 1.2, foot), specks([[fx + toe * 4.6, fy + 2.25], [fx + toe * 3.4, fy + 2.5], [fx + toe * 2.2, fy + 2.5]], '#e8e0c0'),
    ];
    // the wiry body: ribs showing, a pot of a belly, the loincloth and belt
    const body = [
      limb(32, 33 + D, 32, 38 + D, 2.2, 2.6, dark),
      ball(32, 45.2 + D, 6.4, 7.2, skin), ball(32, 48 + D, 4.6, 3.2, skinLt),
      ...[41.5, 43.6, 45.7].flatMap(y => [hair(26.5, y + D, 30.5, y - 0.5 + D, dark), hair(37.5, y + D, 33.5, y - 0.5 + D, dark)]),
      sheet([[25.6, B], [38.4, B], [37.6, B + 6], [35.2, B + 4.4], [32.8, B + 6.8], [30, B + 4.4], [26.8, B + 5.6]], cloth, { curve: 0.8 }),
      hair(28, B + 1, 28.5, B + 4.5, '#4a3e30'), hair(35, B + 1, 34.5, B + 4.5, '#4a3e30'),
      limb(24, B, 40, B, 0.8, 0.8, cord), hair(25, B - 0.75, 39, B - 0.75, '#6a5a44'),
      ...picks,
    ];
    let parts;
    if (stab) {
      parts = [
        ...leg(29.2, 52.8, 21.2, 55.6, 19.6, 60.4, -1), ...leg(35.2, 52.8, 43.2, 55.2, 44.8, 60.4, 1),
        ...body,
        // the chained arm flung back for balance, the knife driven up at you
        limb(24.4, 42.8, 19, 45.6, 1.9, 1.7, skin), ball(19, 45.6, 1.7, 1.6, skin), limb(19, 45.6, 14, 47.6, 1.7, 1.5, skin),
        limb(39.6, 42.8, 45, 41, 1.9, 1.7, skin), ball(45, 41, 1.7, 1.6, skin), limb(45, 41, 50.4, 38.8, 1.7, 1.5, skin),
        ...mantle,
        ...cuff(16, 46.6, 0.9, 2.1, [[13.6, 50.4], [12, 53], [10.4, 55.6]]),
        ...hand(12.6, 48.4, true),
        ...knife(52, 37.6, 0.6, -0.8),
        ...hand(52, 37.6, false),
      ];
    } else if (sit) {
      parts = [
        // on its heels, knees out wide and feet together under it
        ...both64(limb(18, 52.4, 25.2, 60, 2, 1.7, dark)), ...both64(ball(25.6, 60.8, 3.8, 1.8, foot)), ...both64(specks([[23, 61.5], [24.5, 62], [26, 62]], '#e8e0c0')),
        ...body,
        ...both64(limb(28, 55.2, 18.4, 52, 2.4, 2.2, dark)), ...both64(ball(18, 51.6, 2.8, 2.6, dark)),
        // the knife pushed through the belt, only the grip showing
        limb(36.4, B - 3.2, 38, B + 1.2, 1.1, 1.1, grip), ball(36, B - 4, 1, 1, brass),
        ...both64(limb(24, 42.8, 20.6, 46.4, 1.9, 1.7, skin)), ...both64(ball(20.6, 46.4, 1.7, 1.6, skin)), ...both64(limb(20.6, 46.4, 18.4, 49.2, 1.7, 1.5, skin)),
        ...mantle,
        ...cuff(19.6, 47.8, 1.8, 1.4, [[15.2, 49.6], [14.2, 52.4], [13.6, 55.2]]),
        ...hand(18, 49.8, false), ...hand(46, 49.8, false),
      ];
    } else {
      parts = [
        ...leg(28.8, 50, 24.4, 55.2, 25.6, 60.4, -1), ...leg(35.2, 50, 39.6, 55.2, 38.4, 60.4, 1),
        ...body,
        limb(24.4, 39.6, 22.4, 43.6, 1.9, 1.7, skin), ball(22.4, 43.6, 1.7, 1.6, skin), limb(22.4, 43.6, 21.2, 46.8, 1.7, 1.5, skin),
        limb(39.6, 39.6, 41.6, 43.6, 1.9, 1.7, skin), ball(41.6, 43.6, 1.7, 1.6, skin), limb(41.6, 43.6, 43.2, 47, 1.7, 1.5, skin),
        ...mantle,
        ...cuff(21.6, 45.2, 2.1, -0.3, [[17.2, 47.6], [16.8, 50.4], [16.6, 53.2]]),
        ...hand(20.8, 48.4, true),
        // the knife held low, point down and out
        ...knife(43.2, 48.4, 0.45, 0.9),
        ...hand(43.2, 48.4, false),
      ];
    }
    return [
      ...parts,
      ...scragHead(hx, hy, { look: stab ? 0 : sit ? -1 : 1, mouth: stab ? 'teeth' : 'grin' }),
      // grime on the knees and the belly, a scar down the ribs
      specks([[27, 38 + D], [36, 38.5 + D], [30, 50 + D], [34.5, 50.5 + D]], '#a89a82'), hair(35.5, 42 + D, 37, 46.5 + D, '#a8d080'),
    ];
  },

  // A long grey hound of the deep, all rib and sinew on legs too long for it,
  // with pale eyes that stay lit in the dark. It steps out of the world and
  // back in somewhere else, and its edges never quite settle. Going, it thins
  // to slats of itself and only the eyes stay whole; about to bite, its
  // hackles stand and its head drops, jaws open.
  hound: (pose = 'idle') => {
    const coat = '#767a86', dark = '#4c505c', pale = '#94989f', muzzle = '#8c909a', nose = '#16161e', sinew = '#5e626e', socket = '#24262e', eyeC = '#c8ecff';
    const fade = pose === 'special', bite = pose === 'windup';
    const hy = bite ? 30 : 23;    // the head
    const sh = bite ? 2 : 0;      // the shoulders, hunched for the spring
    /** @type {any[]} its own parts are read back below, to cut into slats */
    const out = [
      // the tail, a thin whip up behind it
      limb(40, 30, 48, 22, 1.8, 1.2, dark), limb(48, 22, 51, 12, 1.2, 0.8, dark), hair(44, 27, 49, 19, sinew),
      // the hind legs, well back behind the ribs: a high hock, a thin shank, long toes
      ...both64(limb(21, 35, 16.6, 48, 3.6, 1.8, dark)), ...both64(ball(16.6, 48, 1.8, 1.7, dark)), ...both64(limb(16.6, 48, 18, 60, 1.8, 1.3, dark)),
      ...both64(ball(17.6, 61, 2.8, 1.4, dark)), ...both64(hair(19.5, 38, 17.5, 46, sinew)),
      // the barrel of the ribs, and the shoulder blades standing up out of it
      ball(31.5, 33 + sh, 12.8, 8.4, coat), ball(31.5, 40 + sh, 9, 3.2, dark),
      ...both64(ball(22.4, 28 + sh, 4.6, 4, '#686c78')),
      ...[29.5, 32.5, 35.5].flatMap(y => both64(hair(21, y + sh, 26.5, y + 1.25 + sh, dark))),
      hair(31.5, 25 + sh, 31.5, 29 + sh, sinew),
    ];
    if (bite) {
      // hackles up along the neck and shoulders, a ragged ruff behind the head
      for (const a of [-170, -150, -130, -110, -90, -70, -50, -30, -10]) {
        const t = a * Math.PI / 180, dx = Math.cos(t), dy = Math.sin(t), h = 5.2 + (a % 20 ? 2 : 0);
        const bx = 31.5 + dx * 12, by = 29 + dy * 6.4;
        out.push(sheet([[bx - dy * 2.2, by + dx * 2.2], [bx + dx * h, by + dy * h], [bx + dy * 2.2, by - dx * 2.2]], dark, { tilt: [dx * 0.5, dy * 0.5] }),
          hair(bx, by, bx + dx * h * 0.7, by + dy * h * 0.7, '#3a3e48'));
      }
      // forelegs braced wide and bent, for the spring
      out.push(...both64(limb(24, 37, 20, 49, 3.2, 1.8, coat)), ...both64(ball(20, 49, 1.8, 1.7, coat)), ...both64(limb(20, 49, 21.6, 60, 1.8, 1.5, coat)),
        ...both64(ball(21.2, 61, 3.2, 1.5, coat)));
    } else {
      out.push(...both64(limb(24.4, 35, 23.8, 50, 3, 1.6, coat)), ...both64(ball(23.8, 50, 1.7, 1.6, coat)), ...both64(limb(23.8, 50, 24.6, 60, 1.6, 1.4, coat)),
        ...both64(ball(24.4, 61, 3, 1.5, coat)));
    }
    out.push(
      // the sinews down the forelegs, and the long claws
      ...both64(hair(bite ? 22 : 24.5, 40, bite ? 20.5 : 24, 48, sinew)),
      ...both64(specks(bite ? [[18.5, 62.5], [20.5, 62.75], [22.5, 62.75], [24, 62.5]] : [[22, 62.5], [24, 62.75], [26, 62.5]], '#d8d4c8')),
      // a narrow keel of a chest under the head
      ball(31.5, 38.4, 4.8, 6.4, pale), hair(31.5, 34, 31.5, 43, '#a8acb4'),
      // tall ears, pricked, or laid back flat for the bite
      ...both64(sheet(bite ? [[26, hy - 3], [17, hy - 9], [28.4, hy - 6]] : [[26, hy - 3], [22.6, hy - 17], [29.6, hy - 6]], coat, { tilt: [-0.4, -0.3] })),
      ...both64(sheet(bite ? [[26, hy - 4], [20, hy - 8], [27.6, hy - 6]] : [[26.4, hy - 4.4], [24, hy - 14], [28.6, hy - 6.4]], '#3a2e3e', { tilt: [-0.2, -0.2] })),
      ...both64(hair(bite ? 22 : 24.5, bite ? hy - 6.5 : hy - 11, bite ? 25 : 26, bite ? hy - 5 : hy - 6, '#9a8a9e')),
      // a wedge of a head: broad at the skull, down to a long muzzle
      ball(31.5, hy, 7.6, 6, coat), ...both64(ball(26.8, hy + 3.6, 3.4, 3, coat)), ball(31.5, hy - 3.6, 4.4, 1.8, '#848894'),
      // a heavy brow over deep sockets
      ...both64(ball(27.8, hy - 0.8, 3, 2.2, socket)), ...both64(limb(24, hy - 3.4, 29.6, hy - 2, 1.2, 0.8, dark)),
    );
    // the eyes stay whole when the rest of it goes, so they are kept apart
    const eyes = fade
      ? [...both64(ball(27.4, hy - 0.8, 3, 1.6, eyeC, { glows: true })), ...both64(ball(27.8, hy - 0.8, 1.2, 0.9, '#f8feff', { glows: true }))]
      : [...both64(ball(27.8, hy - 0.8, 1.8, 1.1, eyeC, { glows: true })), specks([[27.5, hy - 1.25], [35.5, hy - 1.25]], '#f8feff')];
    if (bite) {
      // the jaws open: a dark mouth, fangs top and bottom, the lower jaw dropped
      out.push(
        sheet([[25.6, hy + 3], [37.4, hy + 3], [36, hy + 14], [27, hy + 14]], '#3a1418', { curve: 0.5 }), ball(31.5, hy + 10.6, 3, 1.8, '#b04a50'),
        ball(31.5, hy + 14, 4.6, 2.2, muzzle), limb(31.5, hy + 1, 31.5, hy + 5.2, 4.6, 3.8, muzzle), ball(31.5, hy + 4.4, 2, 1.2, nose),
        ...both64(limb(27.4, hy + 5.4, 27.6, hy + 8.4, 0.6, 0.2, '#f0ead8')), ...both64(limb(29.4, hy + 5.8, 29.5, hy + 7.2, 0.45, 0.2, '#f0ead8')),
        ...both64(limb(28, hy + 12.6, 28.2, hy + 10, 0.55, 0.2, '#f0ead8')), ...both64(limb(30, hy + 12.8, 30.1, hy + 11.4, 0.4, 0.2, '#f0ead8')),
        hair(29, hy + 14, 28.5, hy + 17, '#c8c4d0'),
      );
    } else {
      out.push(
        limb(31.5, hy + 2, 31.5, hy + 8.8, 4.2, 3, muzzle), ball(31.5, hy + 8.6, 2.8, 1.8, nose), specks([[30.5, hy + 8], [32.5, hy + 8]], '#3a3a44'),
        hair(31.5, hy + 3, 31.5, hy + 7, '#9a9ca8'), hair(28, hy + 10, 35, hy + 10, '#2a2a34'),
        ...both64(limb(28.5, hy + 9.6, 28.6, hy + 11.2, 0.45, 0.2, '#e0dccc')),
      );
    }
    // the flanks tear where it slips half out of the world: stray flecks of it
    // left a step off its outline
    out.push(dots(bite ? [[10, 34], [11, 34], [52, 38], [53, 38], [12, 50], [12, 51]] : [[14, 30], [15, 30], [48, 38], [49, 38], [12, 46], [12, 47]], '#6a6e7a'));
    if (!fade) return [...out, ...eyes];
    // going: all of it but the eyes cut into slats, each pair of rows slid a
    // little off the next, and a violet light where the world closes over it
    const gaps = [2, 5, 8, 11, 13, 16, 19, 21, 24, 27];
    const keep = r => !gaps.includes(r >> 1);
    const tear = r => [0, 1, -1, 2, 0, -2, 1, 0, -1][(r >> 1) % 9];
    /** @type {object[]} */
    const gone = [];
    for (const p of out) {
      if (p.k === 'dots' || p.k === 'hair' || p.k === 'specks') continue;
      const c = p.c === dark ? '#5a5a78' : p.c === pale ? '#b8b0d4' : p.c === socket ? socket : '#8a88a4';
      // some rows catch the light of the tear more than others
      gone.push(...slats({ ...p, c }, keep, tear, 64).map(q => ((q.y1 >> 1) % 7 === 3 && c !== socket ? { ...q, c: '#c4b8f0' } : q)));
    }
    gone.push(...eyes, ...both64(ball(21.5, hy - 0.8, 1.2, 0.9, '#a890ff', { glows: true })), ball(31.5, hy - 3.5, 1.6, 0.9, '#d8ccff', { glows: true }));
    return gone;
  },

  // A squat, heavy beast like a boar, under a mantle of long quills banded
  // dark and pale. Coarse bristled hide on a deep chest, small mean eyes sunk
  // under the brow, a snout like a stopper, tusks, legs hardly longer than
  // hooves. Roused, the quills stand straight out all round it in a bristling
  // crown; about to gore, its head goes down and the tusks come up and forward.
  quillback: (pose = 'idle') => {
    const hide = '#5e4a3a', hideLt = '#76604c', dark = '#3a2c24', quill = '#2c2630', quill2 = '#3e3440', mantle = '#2e2830', tip = '#e2d8ba', band = '#8a7e6a',
      snout = '#9a7466', tusk = '#f0e8d0', hoof = '#221a18';
    const bristle = pose === 'special', gore = pose === 'windup';
    const hy = gore ? 48 : 43;    // the head
    const my = gore ? 33 : 36;    // the crown of the mantle
    // the quills, from the mantle outward: [angle, length]. At rest they lie
    // back along it and show short; raised, they stand out their full length
    const n = bristle ? 36 : gore ? 20 : 26, a0 = bristle ? -204 : gore ? -162 : -174, a1 = bristle ? 24 : gore ? -18 : -6;
    const rake = Array.from({ length: n }, (_, i) => {
      const a = a0 + (a1 - a0) * i / (n - 1), mid = 1 - Math.abs(i / (n - 1) - 0.5) * 1.2;
      return [a, (bristle ? 22 : gore ? 12 : 11) * (0.75 + 0.25 * mid) + ((i * 7) % 5 - 2) * (bristle ? 1.2 : 0.6)];
    });
    /** @param {number[]} q  [angle, length] @param {number} i @param {boolean} back */
    const quillAt = (q, i, back) => {
      const [a, len] = q, t = a * Math.PI / 180, dx = Math.cos(t), dy = Math.sin(t);
      const bx = 32 + dx * 17, by = my + 2 + dy * 9;
      const l = back ? len : len * 0.72, sway = back ? 0 : (i % 2 ? 0.08 : -0.08);
      const ex = bx + (dx + sway) * l, ey = by + dy * l, f = 0.8, mx = bx + (dx + sway) * l * f, mY = by + dy * l * f;
      const bnd = 0.45, bX = bx + (dx + sway) * l * bnd, bY = by + dy * l * bnd;
      return [limb(bx, by, mx, mY, back ? 1.2 : 1, 0.6, back ? quill : quill2), limb(mx, mY, ex, ey, 0.6, 0.3, tip),
        hair(bX, bY, bX + (dx + sway) * 1.5, bY + dy * 1.5, band)];
    };
    /** @type {object[]} */
    const out = [
      // the long quills behind, the shorter row in front of them
      ...rake.flatMap((q, i) => quillAt(q, i, true)),
      ...rake.filter((_, i) => i % 2).map(([a, l]) => [a + (bristle ? 4 : 5), l]).flatMap((q, i) => quillAt(q, i, false)),
      // the hind legs, stubby and set wide, split hooves
      ...both64(limb(16, 48, 14, 59, 4.2, 3.8, dark)), ...both64(ball(14, 60.6, 4.6, 2, hoof)), ...both64(hair(14, 59, 14, 62.5, '#5a4838')),
      // the body under its mantle: a deep chest, coarse bristled hide
      ball(32, 44, 21, 13.6, hide), ball(32, 50, 14, 6, hideLt),
      ball(32, my + 3, 21.6, 11.2, mantle),
      // quills laid over the mantle in rows, pointing back and up, banded
      ...[0, 1, 2, 3].flatMap(row => Array.from({ length: 15 - row * 2 }, (_, i) => {
        const x = 14 + i * 2.5 + row * 2.5 + ((i * 7 + row * 3) % 5 - 2) * 0.3, y = my + 11 - row * 3.2 + (i % 3) * 0.6, lean = (x - 32) * 0.3;
        const up = (bristle ? 9 : 6.4) + (i + row) % 3 * 1.2;
        return [limb(x, y, x + lean, y - up, 0.8, 0.4, (i + row) % 2 ? '#241e28' : quill2), hair(x + lean * 0.5, y - up * 0.5, x + lean * 0.55, y - up * 0.5 - 1, band)];
      })).flat(),
      // forelegs, short and thick, braced out when it lowers its head
      ...(gore
        ? [...both64(limb(23, 50, 20, 59.6, 4.6, 4, hide)), ...both64(ball(19.6, 60.8, 4.8, 2, hoof)), ...both64(hair(19.6, 59.5, 19.6, 62.75, '#5a4838'))]
        : [...both64(limb(24, 50, 23, 59.6, 4.4, 4, hide)), ...both64(ball(22.6, 60.8, 4.6, 2, hoof)), ...both64(hair(22.6, 59.5, 22.6, 62.75, '#5a4838'))]),
      // coarse bristles over the chest and shoulders
      ...[[16, 46], [19, 49], [22, 51], [42, 51], [45, 49], [48, 46], [27, 53], [37, 53], [32, 55]].map(([x, y]) => hair(x, y, x + (x < 32 ? -0.75 : 0.75), y + 3, '#2a201a')),
      // small ears poking out of the quills
      ...both64(sheet([[23, hy - 5], [18, hy - 11], [27, hy - 7.6]], hide, { tilt: [-0.4, -0.2] })), ...both64(sheet([[23.4, hy - 5.6], [20, hy - 9.6], [26, hy - 7.2]], '#8a6a5a')),
      // the head, square on: a broad skull, jowls, a snout like a stopper
      ball(32, hy, 10.8, 8, hide), ...both64(ball(25, hy + 4, 4.4, 4, hide)), ball(32, hy - 4, 9.6, 2.8, '#4a3a2e'),
      ball(32, hy + 6.4, 6, 4.2, snout), ball(32, hy + 6, 4.4, 2.8, '#b08878'),
      ball(30, hy + 6.6, 1, 0.9, '#2a1614'), ball(34, hy + 6.6, 1, 0.9, '#2a1614'), specks([[29.5, hy + 5.25], [33.5, hy + 5.25]], '#d0a898'),
      // small, mean, red, sunk under the brow
      ball(26.6, hy - 1.4, 2.4, 1.6, '#1c1010'), ball(37.4, hy - 1.4, 2.4, 1.6, '#1c1010'),
      ball(27, hy - 1.4, 1.1, 0.9, '#ff3a1c', { glows: true }), ball(37, hy - 1.4, 1.1, 0.9, '#ff3a1c', { glows: true }), specks([[26.5, hy - 2], [36.5, hy - 2]], '#ffb0a0'),
      limb(22.6, hy - 4.6, 29.6, hy - 2.6, 1.2, 0.8, dark), limb(41.4, hy - 4.6, 34.4, hy - 2.6, 1.2, 0.8, dark),
      // the mouth, a scar across the brow, bristles on the snout, spit at the tusks
      hair(25, hy + 9, 39, hy + 9, '#2a1614'), hair(27, hy - 5, 31, hy - 2.5, '#7a6250'),
      specks([[29, hy + 3.5], [35, hy + 3.5], [32, hy + 3], [26, hy + 6], [38, hy + 6]], '#6a5040'),
      specks([[25, hy + 11], [39, hy + 10]], '#c8d0d8'),
    ];
    // tusks up out of the corners of the mouth; brought forward to gore, they
    // curve out wide and long
    const tk = gore ? [25, hy + 9, 17, hy + 3, 15, hy - 5] : [25.6, hy + 8.4, 21.6, hy + 5, 21, hy + 0.4];
    const [x1, y1, x2, y2, x3, y3] = tk;
    out.push(...both64(limb(x1, y1, x2, y2, gore ? 2.2 : 1.8, gore ? 1.6 : 1.4, tusk)), ...both64(limb(x2, y2, x3, y3, gore ? 1.6 : 1.4, 0.6, tusk)),
      ...both64(hair(x1 - 0.5, y1 - 1, x2 - 0.5, y2 - 1, '#c8bca0')));
    return out;
  },

  // A cave wyrm, square on: a long low body heavy with muscle, scaled in rows
  // of dark red with a pale plated belly, legs bowed out at the elbow like a
  // crocodile's, a ridge of spines over the shoulders, and the neck up out of
  // them to a long head, horns swept back and smoke curling from the nostrils.
  // Winding up, the neck coils back to strike and the jaws part; rearing, it
  // lifts its forelegs, claws out, and the throat glows like a furnace.
  wyrm: (pose = 'idle') => {
    const hide = '#8a3622', dark = '#5a2016', deep = '#3e140c', scale = '#a44428', belly = '#c8966a', bellyDk = '#a87a52', horn = '#dccaa0', hornDk = '#a8987a', claw = '#efe4c8';
    const rear = pose === 'special', coil = pose === 'windup';
    const hx = coil ? 29 : 32, hy = rear ? 12 : coil ? 25 : 21;    // the head
    const cy = rear ? -3 : coil ? -1.5 : 0;                         // how high the shoulders ride
    const arc = (x, y, c = deep) => [hair(x - 1.25, y, x, y + 0.75, c), hair(x, y + 0.75, x + 1.25, y, c)];
    /** @type {object[]} */
    const out = [
      // the tail, round the front of it on the floor, its tip curled up
      limb(44, 51, 54, 57, 5, 4, dark), limb(54, 57, 60, 52, 4, 2.6, dark), limb(60, 52, 59.5, 45, 2.6, 1.2, dark), limb(59.5, 45, 57, 42, 1.2, 0.5, dark),
      ...[[48, 54], [52, 56], [56, 56], [59, 50], [59.5, 46.5]].flatMap(([x, y]) => arc(x, y)),
      ...[[51, 53], [56, 53.5], [58, 48]].map(([x, y]) => sheet([[x - 1, y], [x + 0.5, y - 2.4], [x + 1.2, y]], horn)),
      // the hind feet, planted behind, toes splayed
      ...both64(limb(19, 47, 17, 58, 4.8, 4, dark)), ...both64(ball(16.6, 60, 5.4, 2.2, dark)),
      ...both64(specks([[12.5, 62], [15, 62.5], [18, 62.5], [20.5, 62]], claw)),
      // a ridge of spines down the back, over the shoulders behind the neck
      ...[[-160, 4.4], [-142, 6.4], [-124, 8], [-112, 7], [-68, 7], [-56, 8], [-38, 6.4], [-20, 4.4]].map(([a, h]) => {
        const t = a * Math.PI / 180, dx = Math.cos(t), dy = Math.sin(t), bx = 32 + dx * 18, by = 39 + cy + dy * 9;
        return sheet([[bx - dy * 2, by + dx * 2], [bx + dx * h, by + dy * h], [bx + dy * 2, by - dx * 2]], horn, { tilt: [dx * 0.5, dy * 0.5] });
      }),
      // the long barrel of the body, low to the floor, the flanks heavy with muscle
      ball(32, 44 + cy * 0.5, 22, 12.6, hide), ball(22, 41 + cy * 0.6, 8, 6, scale), ball(42, 41 + cy * 0.6, 8, 6, scale),
      ball(32, 51 + cy * 0.5, 16, 4, dark),
    ];
    // the forelegs, bowed out at the elbow like a crocodile's, or lifted, claws out, as it rears
    if (rear) {
      out.push(
        ...both64(ball(14, 39 + cy, 7.4, 6.6, scale)), ...both64(ball(12, 37 + cy, 3.6, 2.6, '#b85438')),
        ...both64(limb(14, 39 + cy, 5, 31, 5.4, 4.2, scale)), ...both64(ball(5, 31, 3.4, 3.2, hide)), ...both64(limb(5, 31, 8.6, 21.4, 4, 3.2, scale)),
        ...both64(ball(8.6, 20.4, 4.2, 3.4, dark)),
        ...both64(limb(6.4, 18.6, 4.6, 15, 1.2, 0.4, claw)), ...both64(limb(8.6, 17.8, 8.8, 14, 1.2, 0.4, claw)), ...both64(limb(10.8, 18.6, 12.8, 15.4, 1.2, 0.4, claw)),
        ...both64(hair(7, 28, 8, 23, deep)), ...both64(hair(11, 35, 7, 32, deep)),
      );
    } else {
      const w = coil ? 1.6 : 0;    // braced wider for the bite
      out.push(
        ...both64(ball(14 - w * 0.5, 41 + cy, 7.6, 6.8, scale)), ...both64(ball(12 - w * 0.5, 39 + cy, 3.6, 2.6, '#b85438')),
        ...both64(limb(14 - w * 0.5, 41 + cy, 6 - w, 49, 5.6, 4.6, scale)), ...both64(ball(6 - w, 49, 3.6, 3.4, hide)),
        ...both64(limb(6 - w, 49, 9.6 - w, 58, 4.6, 3.8, scale)),
        ...both64(ball(9.6 - w, 59.6, 5.8, 2.8, dark)),
        ...both64(limb(6.6 - w, 60, 3.6 - w, 62.4, 1.2, 0.5, claw)), ...both64(limb(9.6 - w, 60.6, 9.6 - w, 63, 1.2, 0.5, claw)), ...both64(limb(12.6 - w, 60, 15.2 - w, 62.4, 1.2, 0.5, claw)),
        ...both64(hair(8.5 - w, 47, 12 - w, 44, deep)), ...both64(hair(7 - w, 52, 8.5 - w, 56, deep)),
      );
    }
    // the pale plated chest, and the neck up out of it: coiled back on itself to strike
    out.push(ball(32, 49 + cy * 0.5, 11.2, 8, belly), ...[46, 49, 52, 55].map(y => hair(23.5 + (y - 46) * 0.4, y + cy * 0.5, 40.5 - (y - 46) * 0.4, y + cy * 0.5, bellyDk)));
    if (coil) {
      out.push(limb(32, 42, 37.5, 35, 9.2, 8, hide), limb(37.5, 35, hx, hy + 4, 8, 7, hide),
        ...[[36, 39], [37.5, 35.5], [35, 31.5]].map(([x, y]) => hair(x - 4.5, y, x + 4.5, y - 0.5, bellyDk)));
    } else {
      out.push(limb(32, 42 + cy, hx, hy + 4, 9.2, 7.2, hide), ball(hx, hy + 13, 4.4, 9, belly));
      out.push(...[34, 31, 28].map(y => hair(hx - 3.5, y + cy * 0.3 - (rear ? 8 : 0), hx + 3.5, y + cy * 0.3 - (rear ? 8 : 0), bellyDk)));
      if (rear) out.push(limb(32, 41 + cy, hx, hy + 9, 3.2, 2.6, '#f09050', { glows: true }));
    }
    // scales in rows over the shoulders, flanks and neck
    for (let r = 0; r < 3; r++) for (let x = 16 + (r % 2) * 2.5; x <= 48; x += 5) {
      const y = 36 + r * 3 + cy * 0.5;
      if (Math.abs(x - 32) < 12 && y > 38) continue;
      out.push(...arc(x, y, '#6a2618'));
    }
    // the horns, swept back and up, ringed, and a spur at each hinge of the jaw
    out.push(
      ...[1, -1].flatMap(s => [
        limb(hx - s * 7.4, hy - 3.4, hx - s * 14.6, hy - 9.4, 2.6, 1.8, horn), limb(hx - s * 14.6, hy - 9.4, hx - s * 19.6, hy - 11.4, 1.8, 0.7, horn),
        hair(hx - s * 10, hy - 6.5, hx - s * 11, hy - 4.75, hornDk), hair(hx - s * 13.5, hy - 9.5, hx - s * 14.5, hy - 7.75, hornDk),
        limb(hx - s * 3.6, hy - 5, hx - s * 6, hy - 12, 1.6, 0.6, horn),
        limb(hx - s * 8.6, hy + 2.4, hx - s * 15, hy + (rear ? -1 : 2), 1.6, 0.6, horn),
      ]),
      // a long head: a broad skull narrowing to the snout, the cheeks plated
      ball(hx, hy, 9.4, 6.4, hide), ...[-1, 1].map(s => ball(hx + s * 6, hy + 2, 3.6, 3.4, scale)), ball(hx, hy - 3.6, 5.4, 2, '#9a3e26'),
    );
    const ey = hy - 1;
    if (rear) {
      // the jaws wide, the throat a furnace: the fire is not lit by anything, it is the light
      out.push(
        ball(hx, hy + 10, 8, 7.4, '#5a1a10'), sheet(oval(hx, hy + 10, 6.4, 6), '#e8641a', { tilt: [-0.4, -0.6], glows: true }),
        ball(hx, hy + 10.6, 4.6, 4.2, '#ffb030', { glows: true }), ball(hx, hy + 10.6, 2.8, 2.6, '#ffe070', { glows: true }), ball(hx, hy + 10.4, 1.2, 1.4, '#fff8d8', { glows: true }),
        limb(hx, hy + 1, hx, hy + 3.6, 7.4, 6.6, scale), ...[-1, 1].map(s => ball(hx + s * 3.2, hy + 3.6, 2.2, 1.8, scale)),
        ball(hx, hy + 18.4, 6.8, 2.4, scale),
        ...[[-6, 5.6], [6, 5.6], [-4, 5.2], [4, 5.2]].map(([d, y]) => limb(hx + d, hy + y, hx + d * 0.9, hy + y + 2, 0.7, 0.2, '#f4ecd4')),
        ...[[-5.5, 17], [5.5, 17], [-3, 17.4], [3, 17.4]].map(([d, y]) => limb(hx + d, hy + y, hx + d * 0.9, hy + y - 2, 0.7, 0.2, '#f4ecd4')),
        ...[hx - 5, hx + 5].flatMap(x => [ball(x, ey, 2.2, 1.3, '#ffd040', { glows: true }), ball(x, ey, 0.9, 0.8, '#fff8c0', { glows: true })]),
        specks([[hx - 8, hy - 2], [hx + 9, hy - 4], [hx - 4, hy - 8], [hx + 5, hy - 10], [hx - 11, hy + 6], [hx + 12, hy + 5], [hx - 2, hy - 13], [hx + 7, hy - 16]], '#ffd060', { glows: true }),
      );
    } else {
      const o = coil ? 2.8 : 0;    // how far the jaws part
      out.push(
        ball(hx, hy + 10.8 + o, 7, 2.6, dark),
        ...(coil ? [sheet([[hx - 6.4, hy + 8], [hx + 6.4, hy + 8], [hx + 5.2, hy + 12.8], [hx - 5.2, hy + 12.8]], '#3a0e0a'), ball(hx, hy + 11.6, 3, 1.2, '#a03028')] : []),
        limb(hx, hy + 1, hx, hy + 8.8, 7.6, 5.2, scale), ...[-1, 1].map(s => ball(hx + s * 2.6, hy + 8.8, 2, 1.6, scale)),
        ball(hx - 2, hy + 9.4, 0.8, 0.7, '#1a0806'), ball(hx + 2, hy + 9.4, 0.8, 0.7, '#1a0806'),
        ...(coil ? [[-5.5, 9.6, 1], [5.5, 9.6, 1], [-3.5, 13, -1], [3.5, 13, -1]] : [[-5.5, 10.4, 1], [5.5, 10.4, 1], [-3.6, 11.6, 0.6], [3.6, 11.6, 0.6]])
          .map(([d, y, s]) => limb(hx + d, hy + y, hx + d * 0.92, hy + y + s * 2, 0.7, 0.2, '#f4ecd4')),
        ...[hx - 5, hx + 5].flatMap(x => [ball(x, ey, 2.2, 1.2, '#ffb020', { glows: true }), limb(x, ey - 1, x, ey + 1, 0.4, 0.4, '#2a0c04'), specks([[x - 1, ey - 0.75]], '#fff0b0')]),
        // a curl of smoke from each nostril, and an old claw scar across the snout
        specks([[hx - 3, hy + 7.5], [hx - 4, hy + 6], [hx - 3.5, hy + 4.5], [hx + 3, hy + 7.5], [hx + 4, hy + 6], [hx + 4.5, hy + 4.5]], '#8a8078'),
        hair(hx + 1.5, hy + 1, hx + 4.5, hy + 6, '#c86a44'),
      );
    }
    // the brow ridges over the eyes, drawn down in anger, and the scales of the skull
    out.push(limb(hx - 9, ey - 2.6, hx - 2.4, ey - 0.6 + (coil ? 1 : 0), 1.6, 1.1, dark), limb(hx + 9, ey - 2.6, hx + 2.4, ey - 0.6 + (coil ? 1 : 0), 1.6, 1.1, dark),
      ...[[-3, -4.5], [0, -5.25], [3, -4.5], [-1.5, -3], [1.5, -3]].flatMap(([d, y]) => arc(hx + d, hy + y, '#6a2618')),
      specks([[hx - 6, hy + 3], [hx + 6.5, hy + 3.5], [hx - 7, hy + 1], [hx + 7.5, hy + 0.5]], '#c05a36'));
    for (const q of /** @type {any[]} */ (out)) if (q.k !== 'hair' && q.k !== 'specks') Object.assign(q, { smooth: 1 });
    return out;
  },
};

export { FOLK };
