// Identity repairs follow the painted bestiary while retaining the 64-unit
// parts painter and its cached poses. Nothing here reads game state or dice.
import { ball, both64, hair, limb, sheet, specks, recolour, grow, nudge, slats, dwarfKit, dwarfBody, dwarfHead, drowKit, drowHead, drowHair, drowHand } from './parts.js';

function slime(pose) {
  const up = pose === 'windup', y = up ? 31 : 39;
  return [ball(31, 59, 26, 3, '#25552b'),
    ...[[10, 56, 7, 4], [20, 59, 8, 3], [44, 58, 11, 4], [54, 55, 6, 3]].map(([x,y,rx,ry]) => ball(x,y,rx,ry,'#478b36')),
    sheet([[7, 55], [12, 45], [17, y], [22, y-10], [33, y-13], [41, y-8], [43, y+4], [49, 49], [57, 55], [43, 58], [27, 57]], '#438d32', { curve: 1 }),
    sheet([[18,y+1],[21,y-7],[27,y-11],[34,y-10],[37,y-5],[33,y-6],[26,y-5],[23,y+4]], '#599e3e', {curve:0.4}),
    hair(21,y-7,26,y-12,'#b2d679'), hair(27,y-12,34,y-12,'#c6e696'),
    ...[[18,49,2], [34,43,3], [39,52,2.5], [29,31,1.6], [47,55,1.6]].flatMap(([x,yy,r]) => [ball(x,yy-(up?5:0),r,r,'#41842e'),hair(x-r*0.6,yy-r-(up?5:0),x+r*0.3,yy-r-(up?5:0),'#b9da7c')]),
    ...[[11,36],[46,27],[51,41]].map(([x,yy]) => ball(x,yy-(up?4:0),1.2,1.6,'#9bd15a'))];
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
  const lid = pose === 'windup' ? 13 : 23;
  return [sheet([[7,43],[45,46],[45,62],[7,60]],'#81502b',{curve:0.25}),
    sheet([[45,46],[58,36],[58,59],[45,62]],'#4c321f'),
    sheet([[9,43],[20,34],[57,36],[45,46]],'#28141b'),
    sheet([[9,43],[10,lid],[21,lid-7],[21,34]],'#5c3926'),
    sheet([[10,lid],[45,lid+3],[57,lid-5],[21,lid-7]],'#a06a39',{curve:0.3}),
    sheet([[10,lid],[45,lid+3],[45,lid+8],[10,lid+5]],'#673d25'),
    ...[16,38].flatMap(x => [limb(x,47,x,58,1.3,1.3,'#85858a'),limb(x,lid+1,x+10,lid-6,1.2,1.2,'#85858a'),hair(x-0.4,49,x+0.4,49,'#d0be91'),hair(x-0.4,55,x+0.4,55,'#d0be91')]),
    ...[16,23,30,37,43].flatMap(x => [limb(x,lid+5,x+1,lid+12,1.1,0.1,'#d8cba9'),limb(x,44,x+1,39,0.9,0.1,'#c2b491')]),
    limb(28,40,32,49,2.8,2.5,'#b06068'),limb(32,49,42,52,2.5,0.8,'#b06068'),
    ...[23,30].map(x => hair(x,48,x,57,'#4b2e20')),hair(47,47,55,40,'#a38050'),
    sheet([[26,48],[31,48],[31,53],[26,53]],'#bb9c58'),ball(28.5,50,0.6,0.9,'#30271d')];
}

// Broad silhouettes and connected equipment are resolved before cached poses.
function hound(pose) {
  const bite = pose === 'windup', y = bite ? 31 : 26;
  const dark = '#252331', coat = '#494452', light = '#706878';
  /** @type {any[]} */
  const out = [limb(40, 32, 49, 24, 2, 1.3, dark), limb(49, 24, 48, 15, 1.3, 0.3, coat),
    ...both64(limb(22, 35, 14, 45, 3, 2, dark)), ...both64(limb(14, 45, 13, 56, 2, 1.4, dark)), ...both64(ball(13, 57, 3.3, 1.5, coat)),
    ball(32, 33, 12, 12, dark), ball(32, 27, 15, 9, coat),
    sheet([[20,25],[17,32],[23,43],[28,46],[32,40],[36,46],[41,43],[46,32],[43,25]],coat,{curve:0.8}),
    ...both64(limb(22, 35, bite ? 18 : 23, 46, 3.2, 2.2, coat)),
    ...both64(limb(bite ? 18 : 23, 46, bite ? 17 : 22, 60, 2.2, 1.6, coat)),
    ...both64(ball(bite ? 16 : 21, 61, 4, 1.6, coat)),
    ...both64(hair(21, 38, 22, 46, light)),
    ...[0,1,2].flatMap(i=>both64(hair((bite?14:19)+i*1.5,60,(bite?14:19)+i*1.5,62,dark))),
    sheet([[21,y-2],[20,y-14],[28,y-7],[35,y-7],[43,y-14],[42,y-2]],dark,{curve:0.3}),
    ...both64(sheet([[22,y-10],[24,y-4],[27,y-6]],'#776576')),
    ball(32,y,10,8,coat),
    ...both64(sheet([[23,y-3],[19,y+3],[24,y+2],[21,y+8],[28,y+5]],coat)),
    ...both64(limb(24,y-2,28,y-1,1.2,0.7,dark)),
    ...both64(ball(27,y,1.4,0.9,'#bd8af0',{glows:true})),
    sheet([[29,y+1],[35,y+1],[38,y+7],[34,y+10],[29,y+10],[25,y+7]],light,{curve:0.8}),
    ...(bite ? [ball(32,y+11,5.4,4,'#17121d'),...[-3,3].map(d=>limb(32+d,y+8,32+d,y+12,1,0.1,'#ddd1c2')),limb(28,y+15,36,y+15,1,1,coat)] : [hair(27,y+9,32,y+10,dark),hair(32,y+10,37,y+9,dark)]),
    ball(32,y+6,3.2,1.9,'#15151c'),hair(30,y+5,33,y+5,'#827788'),
    ...both64(hair(24,y+3,27,y+5,dark)),
    ...[0,1,2].flatMap(i=>[hair(10+i*2,30+i*5,7+i*2,34+i*5,'#74569d'),hair(7+i*2,34+i*5,10+i*2,37+i*5,'#a182c3')])];
  return pose === 'special' ? out.flatMap(p => p.glows || p.k === 'specks' || p.k === 'hair' ? [p] : slats(p, row => row % 4 < 2, row => row % 8 < 4 ? -1 : 1, 64)) : out;
}

function rustmaw(pose) {
  const y = pose === 'windup' ? 34 : 38, out = [];
  for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
    const x = 32 + side * (11 + i), ky = 26 + i * 9;
    out.push(limb(x, 29 + i * 7, 32 + side * 24, ky, 2, 1.4, '#633920'), limb(32 + side * 24, ky, 32 + side * (27 - i * 3), 44 + i * 8, 1.4, 0.5, '#9c582c'));
  }
  out.push(ball(32, 30, 19, 18, '#91441f'), ball(29, 25, 14, 12, '#b86631'), hair(32, 13, 32, 41, '#492a1c'));
  for (const side of [-1, 1]) out.push(hair(32 + side * 3, 16, 32 + side * 14, 24, '#d29b50'), hair(32 + side * 3, 27, 32 + side * 17, 32, '#5e301c'));
  out.push(ball(32, y, 13, 8, '#8c4a24'), ball(23, y - 2, 3.3, 3.4, '#261e16'), ball(41, y - 2, 3.3, 3.4, '#261e16'), ball(23, y - 3, 1.7, 1.3, '#d7a65a'), ball(41, y - 3, 1.7, 1.3, '#d7a65a'));
  for (const side of [-1, 1]) {
    const jaw = [[32 + side * 9, y + 2], [32 + side * 17, y + 8], [32 + side * 17, 55], [32 + side * 8, 61], [32 + side * 12, 53], [32 + side * 10, y + 9], [32 + side * 5, y + 6]];
    out.push(sheet(jaw, '#b56832', { curve: 0.5 }), hair(32 + side * 16, y + 10, 32 + side * 15, 54, '#e2a85f'));
    for (let i = 0; i < 3; i++) out.push(sheet([[32 + side * 12, y + 9 + i * 4], [32 + side * 8, y + 11 + i * 4], [32 + side * 13, y + 12 + i * 4]], '#c98b43'));
    out.push(limb(32 + side * 6, y - 6, 32 + side * 14, 6, 0.6, 0.3, '#a87736'));
    for (let i = 0; i < 8; i++) out.push(hair(32 + side * (14 - i * 0.7), 7 + i * 3, 32 + side * (18 - i * 0.7), 5 + i * 3, '#c99b59'));
  }
  return out;
}

function wyrm(pose) {
  const fire = pose === 'special', bite = pose === 'windup';
  const hx = 32, hy = fire ? 16 : bite ? 28 : 24;
  /** @type {object[]} */
  const out = [limb(42,40,54,35,5,3,'#8a3622'),limb(54,35,56,23,3,1.7,'#8a3622'),limb(56,23,51,16,1.7,0.2,'#a44428'),
    ...both64(limb(19,39,10,47,4,2.8,'#5a2016')), ...both64(limb(10,47,8,57,2.8,1.6,'#5a2016')),
    ball(32,39,18,13,'#8a3622'),ball(32,30,14,10,'#a44428'),
    ...both64(sheet([[18,31],[15,23],[23,29]],'#c8966a')),
    limb(32,42,32,hy+7,9,8,'#8a3622'),
    sheet([[25,hy+9],[39,hy+9],[40,47],[36,52],[28,52],[24,47]],'#a87a52',{curve:0.7}),
    ...[38,42,46].map(y=>hair(26,y,38,y,'#6a2618')),
    ...both64(limb(20,39,bite?13:16,49,4.5,3,'#8a3622')),
    ...both64(limb(bite?13:16,49,bite?13:18,60,3,2,'#a44428')),
    ...both64(ball(bite?13:18,60,4,2,'#a44428'))];
  for (const x of [8,bite?13:18,bite?50:45,55]) for(let i=0;i<3;i++) out.push(limb(x-2+i*2,59,x-3+i*2,62,0.65,0.1,'#dccaa0'));
  for(const side of [-1,1]) for(let i=0;i<5;i++) out.push(hair(32+side*(13+i%2*2),34+i*3,32+side*(15+i%2*2),35+i*3,'#6a2618'));
  out.push(...wyrmHead(hx,hy,pose));
  return out;
}

function arbalest(pose) {
  const k = dwarfKit(), aim = pose === 'special', raised = pose === 'windup';
  const dy = aim ? -5 : raised ? -2 : 0;
  const bow = [
    limb(13, 39, 49, 30, 2.2, 2, '#795332'), hair(14, 37, 48, 28, '#b39566'),
    limb(40, 19, 47, 30, 1.3, 1.5, '#8a909a'), limb(47, 30, 51, 43, 1.5, 1.1, '#8a909a'),
    hair(40, 19, 23, 35, '#d7cba7'), hair(23, 35, 51, 43, '#d7cba7'),
    limb(23, 34, 53, 26.5, 0.6, 0.5, '#c6ae7b'), sheet([[51, 25], [57, 25.5], [52, 28]], '#d2d7df'),
    hair(26, 33, 29, 30, '#eee2c2'), hair(27, 34, 31, 34, '#eee2c2'),
    ball(19, 39, 2.6, 2.4, k.skin), ball(39, 37, 2.6, 2.4, k.skin),
    hair(17, 39, 21, 39, k.skinDk), hair(37, 37, 41, 37, k.skinDk)];
  return [...dwarfBody(k, { narrow: true }), limb(20, 27, 15, 34, 3.5, 3, k.mail), limb(15, 34, 19, 39 + dy, 3, 2.5, k.mail),
    limb(44, 27, 47, 37, 3.5, 3, k.mail), limb(47, 37, 39, 37 + dy, 3, 2.5, k.mail), ...dwarfHead(32, 12, k, { grim: raised || aim, helm: true }),
    ...nudge(bow, 0, dy)];
}

function drowMage(pose) {
  const k = drowKit(), cast = pose === 'special', bolt = pose === 'windup';
  const handX = cast ? 53 : bolt ? 42 : 49, handY = cast ? 17 : bolt ? 25 : 29;
  const leftX = cast ? 12 : bolt ? 24 : 15, leftY = cast ? 20 : bolt ? 28 : 40;
  return [...drowHair(32, 10, k),
    sheet([[24, 18], [40, 18], [39, 35], [48, 60], [39, 62], [31, 59], [21, 62], [17, 58], [25, 35]], '#2c1a3c', { curve: 0.8 }),
    sheet([[29, 29], [34, 28], [38, 59], [28, 60]], '#46285e', { curve: 0.6 }),
    ...[21, 25, 39, 44].map(x => hair(32 + (x - 32) * 0.5, 37, x, 59, '#1a0e26')),
    hair(20, 59, 27, 61, k.silver), hair(38, 61, 46, 59, k.silver),
    sheet([[23, 18], [28, 20], [24, 35], [leftX-1, leftY+2], [leftX+2, leftY-10]], '#46285e', { curve: 0.6 }),
    limb(23, 22, 18, 31, 2.4, 2, '#2c1a3c'), limb(18, 31, leftX, leftY-1, 2, 1.4, k.skin), ...drowHand(leftX, leftY, k),
    limb(40, 22, 43, 32, 2.5, 2, '#46285e'), limb(43, 32, handX, handY, 2, 1.4, k.skin), ...drowHand(handX, handY, k),
    ...[-1, 0, 1].map(d => limb(handX + d, handY, handX + d * 2, handY - 3, 0.45, 0.25, k.skin)),
    ball(handX, handY - 7, cast ? 4.5 : 3, cast ? 5 : 3.5, '#7c3dc1', { glows: true }), ball(handX - 0.5, handY - 8, 1.5, 2, '#e1b8ff', { glows: true }),
    ...(cast ? [hair(12,18,23,8,'#a880ce'),hair(23,8,45,8,'#a880ce'),hair(45,8,53,12,'#a880ce'),hair(12,18,32,26,'#a880ce'),hair(32,26,53,12,'#a880ce')] : []),
    ...grow(drowHead(32, 10, k), 32, 10, 1.2, 1.1),
    sheet([[26, 8], [25, 19], [21, 29], [23, 15]], k.hairDk, { curve: 0.5 }), hair(25, 10, 22, 27, k.hair),
    sheet([[37, 8], [39, 16], [41, 26], [37, 21]], k.hairDk, { curve: 0.5 }), hair(38, 12, 40, 25, k.hair),
    hair(26, 32, 38, 32, k.silver), ball(32, 32, 1.2, 1, '#ad89bd')];
}

function drowned(pose) {
  const up = pose === 'windup', skin = '#8b9d99', shadow = '#526c69';
  return [ball(32, 61, 23, 2, '#344b50'), limb(27, 43, 23, 52, 4, 2.7, '#3b464a'), limb(23, 52, 20, 60, 2.7, 2, skin), ball(19, 61, 4, 1.2, shadow),
    limb(38, 44, 42, 53, 4, 2.5, '#3b464a'), limb(42, 53, 44, 60, 2.5, 2, skin), ball(45, 61, 4, 1.2, shadow),
    ball(32, 35, 10, 13, skin), sheet([[23, 25], [29, 23], [27, 37], [33, 42], [29, 47], [24, 43], [20, 46]], '#4b5048', { curve: 0.5 }),
    sheet([[38, 24], [43, 29], [45, 45], [40, 42], [36, 47], [35, 40]], '#4b5048', { curve: 0.5 }),
    limb(23, 28, 15, up ? 30 : 38, 3, 2.4, skin), limb(15, up ? 30 : 38, 10, up ? 22 : 48, 2.4, 1.6, skin),
    limb(41, 29, 48, up ? 29 : 35, 3, 2.4, skin), limb(48, up ? 29 : 35, 54, up ? 20 : 31, 2.4, 1.6, skin),
    ...[0, 1, 2].flatMap(i => [limb(9 + i, up ? 22 : 48, 8 + i * 1.5, up ? 18 : 52, 0.65, 0.3, skin), limb(53 + i, up ? 20 : 31, 52 + i * 2, up ? 16 : 27, 0.65, 0.3, skin)]),
    ball(30, 19, 8, 9, skin), ball(29, 25, 5, 4, shadow), ball(27, 18, 2, 1.6, '#253b3b'), ball(34, 19, 2, 1.6, '#253b3b'), specks([[27, 18]], '#cbdcd6'),
    ball(30, 25, 2.8, 2, '#253331'), hair(28, 23, 32, 24, '#c7c5aa'),
    sheet([[22, 19], [22, 12], [28, 9], [36, 12], [39, 26], [36, 25], [33, 14], [25, 14]], '#293c39', { curve: 0.5 }),
    ...[[23, 22, 18, 43], [38, 25, 43, 47], [29, 11, 25, 28]].map(([a,b,c,d]) => limb(a,b,c,d,0.9,0.3,'#536448')),
    ...[[18, 44], [42, 49], [10, 54], [52, 35]].map(([x,y]) => hair(x,y,x,y+2,'#b1c9c9')),
    ...[31, 34, 37].map(y => hair(29,y,34,y+1,shadow))];
}

const DRAWERS = { slime, eyeless, puffcap, mimic, hound, rustmaw, wyrm, dwarf_arbalest: arbalest, drow_mage: drowMage, drowned };

// Frontal reptilian jaws and curled horns; the same face anchors carry
// the named elder's scar and clouded eye.
export function wyrmHead(hx, hy, pose) {
  const fire = pose === 'special', bite = pose === 'windup', open = fire || bite;
  const out = [...[-1,1].flatMap(s=>[
    limb(hx+s*8,hy-5,hx+s*13,hy-12,2.5,1.7,'#5a2016'),
    limb(hx+s*13,hy-12,hx+s*10,hy-14,1.7,0.3,'#c8966a'),
    hair(hx+s*11,hy-10,hx+s*12,hy-12,'#dccaa0')]),
    ball(hx,hy,11,9,'#8a3622'),
    ...[-1,1].flatMap(s=>[sheet([[hx+s*8,hy-5],[hx+s*15,hy-4],[hx+s*11,hy+3],[hx+s*8,hy+5]],'#a44428',{curve:0.5}),
      ball(hx+s*5,hy-1,2,1.2,'#ffb020',{glows:true}),limb(hx+s*8,hy-4,hx+s*3,hy-3,1.3,0.9,'#5a2016')]),
    sheet([[hx-2,hy-3],[hx+2,hy-3],[hx+8,hy+5],[hx+6,hy+9],[hx-6,hy+9],[hx-8,hy+5]],'#a44428',{curve:0.9}),
    ...(open ? [ball(hx,hy+11,7,fire?6:4,'#3e140c'),...[-5,-2,2,5].map(d=>limb(hx+d,hy+7,hx+d,hy+11,0.9,0.1,'#dccaa0')),
      limb(hx-6,hy+(fire?17:15),hx+6,hy+(fire?17:15),1.4,1.4,'#8a3622')]
      : [limb(hx-6,hy+10,hx+6,hy+10,1.4,1.4,'#8a3622'),hair(hx-6,hy+8,hx+6,hy+8,'#3e140c')]),
    ...[-3.5,3.5].map(d=>ball(hx+d,hy+4,1,0.7,'#3e140c')),
    hair(hx-3,hy-1,hx-2,hy+3,'#c05a36'),hair(hx+2,hy-1,hx+3,hy+3,'#c05a36')];
  if(fire)out.push(ball(hx,hy+12,4,4,'#f09050',{glows:true}),ball(hx,hy+12,2,2.5,'#ffd060',{glows:true}));
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
  if (DRAWERS[id]) return DRAWERS[id](pose);
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
