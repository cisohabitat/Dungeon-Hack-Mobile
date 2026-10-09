// What the view is handed each frame: the render state, and the motion in it
// (steps easing, blows landing, creatures swaying and falling, the camera's
// shake). What it borrows from the game comes through K, read live.
import { Assets } from './assets.js';
import { ITEMS, MONSTERS } from './data.js';
import { SIZE as DRESS_SIZE } from './dressing.js';
import { ENCOUNTERS } from './encounters.js';

/** @param {any} K */
export function makeMotion(K) {
  const DIRS = K.DIRS;
  const RISE_MS = K.RISE_MS;
  const T = K.T;
  const cam = K.cam;
  const companion = K.companion;
  const elements = K.elements;
  const fx = K.fx;
  const namedBar = K.namedBar;
  const namedTitle = K.namedTitle;
  const prelude = K.prelude;
  const traderKind = K.traderKind;
  const wild = K.wild;
  const P = (/** @type {any[]} */ ...a) => K.P(...a);
  const camProgress = (/** @type {any[]} */ ...a) => K.camProgress(...a);
  const effect = (/** @type {any[]} */ ...a) => K.effect(...a);
  const heroTitle = (/** @type {any[]} */ ...a) => K.heroTitle(...a);
  const lvl = (/** @type {any[]} */ ...a) => K.lvl(...a);
  const packSize = (/** @type {any[]} */ ...a) => K.packSize(...a);
  const passable = (/** @type {any[]} */ ...a) => K.passable(...a);
  const spriteFor = (/** @type {any[]} */ ...a) => K.spriteFor(...a);
  const tile = (/** @type {any[]} */ ...a) => K.tile(...a);

  // ---------- render state ----------
  // Where each of up to five things on one square lies, in fractions of the
  // square from its middle. No two share a row or a column, so from whichever
  // side the square is seen they stand apart across the view: turned at an
  // angle, one could stand straight behind another and be hidden by it. Each
  // square gets its own quarter turn, which keeps that true.
  const SCATTER = [
    [[0, 0]],
    [[-0.18, -0.18], [0.18, 0.18]],
    [[-0.2, 0.05], [0.02, -0.2], [0.2, 0.2]],
    [[-0.22, -0.07], [-0.07, 0.22], [0.07, -0.22], [0.22, 0.07]],
    [[-0.24, 0], [-0.12, 0.24], [0, -0.24], [0.12, 0.12], [0.24, -0.12]],
  ];
  /**
   * What is about to hit you from somewhere you are not looking. The damage
   * flash only says where a blow came from after it lands; this says where
   * the next one is coming from before it does. Anything in front is already
   * on screen, so only flanks and rear are reported, nearest first.
   * @returns {Array<{rel: number, near: boolean}>}
   */
  function threats() {
    if (!K.G || K.G.status !== 'playing') return [];
    const p = P(), out = [];
    for (const m of lvl().monsters) {
      if (!m.awake || m.fleeing || m.collapsed || m.disguised) continue;
      const dx = m.x - p.x, dy = m.y - p.y, dist = Math.abs(dx) + Math.abs(dy);
      if (dist > 2) continue;
      // the side it is on: the longer axis, and a diagonal counts as the flank
      const ax = Math.abs(dx) >= Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
      let k = DIRS.findIndex(([x, y]) => x === ax[0] && y === ax[1]);
      let rel = (k - p.dir + 4) % 4;
      if (Math.abs(dx) === Math.abs(dy)) {
        // equal both ways: report whichever of the two sides is not straight ahead or behind
        const k2 = DIRS.findIndex(([x, y]) => x === 0 && y === Math.sign(dy));
        const r2 = (k2 - p.dir + 4) % 4;
        if (rel === 0 || rel === 2) rel = r2;
      }
      if (rel === 0) continue;
      // a blow drawn back at the hound is no warning of one at the hero
      const w = m.windup && m.windup.kind !== 'pet' ? m.windup : null;
      out.push({ rel, near: dist === 1, tell: !!(w || m.volley), special: !!(w && w.move) });
    }
    return out.sort((a, b) => Number(b.tell) - Number(a.tell) || Number(b.near) - Number(a.near));
  }
  // ---------- motion ----------
  // Monsters are still pictures; these give them a body. They breathe, hop a
  // little as they step, lean back as a blow is drawn and lunge as it lands,
  // recoil and squash when struck, and sink and fade when they fall. Only the
  // drawing moves: where a monster stands, and every rule, is unchanged.
  // The lean sways the head across the view while the feet stay planted (the
  // renderer shears the picture): a slow sway at rest, a waddle as it walks
  // and a lean into a step across the view, a cock to one side as a blow is
  // drawn back and a swing through as it lands, and a jolt when struck. A big
  // thing sways less: it is heavier.
  // a body falls, lies a moment, then sinks away into what it leaves (see the fallen in renderState)
  const CORPSE_MS = 1100;
  // how long a door takes to slide open or shut
  const DOOR_MS = 520;
  // how long a creature reels after the white of a hit has gone (see flinch in creatures.js)
  const REEL_MS = 260;
  // how much taller a grey dwarf stands when its working has grown it
  const GROWN_SCALE = 1.45;
  // how far a burning thing (the Heartforged, an emberling) throws its light onto what stands near it, in squares
  const FIERY_GLOW = 2.2;
  // a breath at rest: [how slow, how deep], by size
  const BREATH = { small: [300, 0.03], mid: [560, 0.04], big: [700, 0.05] };
  // things that move but do not breathe: rock, ooze, iron and spores
  const BREATHLESS = new Set(['slime', 'emberling', 'mimic', 'puffcap', 'rustmaw', 'heartforged']);
  function motion(m, now, i, tell) {
    const p = P(), mb = MONSTERS[m.id];
    const vx = p.x + 0.5 - (m.rx + 0.5), vy = p.y + 0.5 - (m.ry + 0.5), len = Math.hypot(vx, vy) || 1;
    const tx = vx / len, ty = vy / len;          // toward the hero
    // the view's right, in the dungeon: a step along it is a step across the view
    const rx = -Math.sin(cam.angle), ry = Math.cos(cam.angle);
    const hand = m.uid % 2 ? 1 : -1, heavy = mb.scale > 1.2 ? 0.6 : 1;
    let push = 0, lift = 0, sqx = 1, sqy = 1, lean = 0, jx = 0;
    // it breathes: the chest fills and empties, enough to see across a room; a
    // big thing breathes slower and deeper, a small one quick and shallow
    // (BREATH), and the dead and the bloodless do not breathe at all
    if (!mb.fly && !mb.undead && !BREATHLESS.has(mb.sprite)) {
      const [ms, depth] = mb.scale > 1.2 ? BREATH.big : mb.scale < 0.8 ? BREATH.small : BREATH.mid;
      const ph = Math.sin(now / (ms * Math.max(1, mb.scale)) + m.uid * 1.7 + i * 2.1);
      // the breath in is quicker than the breath out
      const b = (ph > 0 ? ph : ph * 0.7) * depth;
      sqy += b; sqx -= b * 0.5;
    }
    lean += Math.sin(now / (1500 + 500 * mb.scale) + m.uid * 2.3 + i * 1.3) * (mb.fly ? 0.04 : 0.025);
    if (m.moveT1 > now) {
      const t = Math.max(0, (now - m.moveT0) / Math.max(1, m.moveT1 - m.moveT0)), arc = Math.sin(t * Math.PI);
      lift += Math.abs(arc) * 0.07;
      const across = (m.x - m.fromX) * rx + (m.y - m.fromY) * ry;
      lean += arc * (0.09 * across + 0.06 * ((m.fromX + m.fromY) % 2 ? 1 : -1));
    }
    if (tell > 0 && tell < 1) { push -= 0.07 * tell; lean -= 0.06 * tell * hand; }          // drawing back
    const lu = (now - (m.lungeAt || -1e9)) / 220;
    if (lu >= 0 && lu < 1) { push += Math.sin(lu * Math.PI) * 0.28; sqy *= 1 + 0.06 * Math.sin(lu * Math.PI); lean += Math.sin(lu * Math.PI) * 0.08 * hand; }
    const hu = now >= (m.flashAt || 0) ? (m.flashUntil - now) / 130 : 0;
    if (hu > 0) {
      push -= 0.1 * hu; sqx *= 1 + 0.12 * hu; sqy *= 1 - 0.1 * hu;
      lean += 0.16 * hu * ((m.flashUntil | 0) % 2 ? 1 : -1);
      jx = Math.sin(now / 18) * 0.025 * hu;
    }
    return { dx: tx * push + rx * jx, dy: ty * push + ry * jx, lift, sqx, sqy, lean: lean * heavy };
  }
  /**
   * How a body is drawn u of the way through its dying (0 to 1), by the way it dies
   * (DEATHS): its squash, its lean, how high it hangs, how far it is knocked back, how much of it is left.
   */
  function corpsePose(how, u, side, fly) {
    const gone = (from) => (u > from ? Math.min(1, (u - from) / (1 - from)) : 0);
    if (how === 'clatter') {
      // the bones give way all at once and drop straight down into a heap
      const f = Math.min(1, u / 0.22), d = f * f;
      return { back: 0.05 * f, yOff: 0, sqx: 1 + 0.5 * d, sqy: Math.max(0.12, 1 - 0.86 * d), lean: side * 0.15 * Math.sin(u * 40) * (1 - f), alpha: 1 - gone(0.6) };
    }
    if (how === 'splat') {
      // it bursts out flat across the stones, quivers, and soaks away
      const f = Math.min(1, u / 0.14), q = u > 0.14 ? Math.sin((u - 0.14) * 50) * 0.06 * (1 - u) : 0;
      return { back: 0, yOff: 0, sqx: 1 + 0.95 * f + q, sqy: Math.max(0.1, 1 - 0.82 * f - q), lean: 0, alpha: 1 - gone(0.55) };
    }
    if (how === 'mist') {
      // it rises a little, drawn out thin, and comes apart into the air
      const f = Math.min(1, u / 0.85);
      return { back: 0, yOff: fly + 0.3 * f, sqx: Math.max(0.2, 1 - 0.6 * f), sqy: 1 + 0.45 * f, lean: Math.sin(u * 18) * 0.12 * f, alpha: Math.max(0, 1 - f * 1.1) };
    }
    if (how === 'tumble') {
      // it drops out of the air, turning over as it falls, and lies where it lands
      const f = Math.min(1, u / 0.35), d = f * f;
      return { back: 0.1 * f, yOff: fly * (1 - d), sqx: 1, sqy: u < 0.35 ? 1 - 0.3 * Math.abs(Math.sin(u * 30)) : 0.45, lean: u < 0.35 ? Math.sin(u * 26) * 0.9 : side * 0.6, alpha: 1 - gone(0.7) };
    }
    if (how === 'burst') {
      // it swells tight, then bursts and is gone in its cloud
      const sw = Math.min(1, u / 0.2);
      return { back: 0, yOff: 0, sqx: 1 + 0.35 * sw, sqy: 1 + 0.3 * sw, lean: 0, alpha: u < 0.2 ? 1 : Math.max(0, 1 - (u - 0.2) / 0.08) };
    }
    if (how === 'gutter') {
      // it sinks down into itself, its fire going out
      const f = Math.min(1, u / 0.6);
      return { back: 0, yOff: 0, sqx: 1 + 0.2 * f, sqy: Math.max(0.15, 1 - 0.7 * f), lean: 0, alpha: 1 - gone(0.3) };
    }
    // knocked back by the blow, it falls as a body falls, slow then fast,
    // tipping over to one side and down onto the floor, with a jolt as it lands;
    // it lies there a moment, then sinks away into what it leaves behind
    const f = Math.min(1, u / 0.4), drop = f * f, back = Math.sin(Math.min(1, u / 0.3) * Math.PI / 2) * 0.18;
    const land = u > 0.4 && u < 0.5 ? Math.sin((u - 0.4) / 0.1 * Math.PI) * 0.08 : 0;
    const g = gone(0.72);
    return { back, yOff: fly * (1 - drop), sqx: 1 + 0.35 * drop, sqy: Math.max(0.1, (1 - 0.72 * drop) * (1 - land) * (1 - 0.4 * g)), lean: side * 0.9 * drop, alpha: 1 - g };
  }
  /** What is upon a monster, for drawing on it: burning, venom or bleeding, and held fast by ice, roots or a snare. @returns {{dot: string, held: string}|null} */
  function afflictions(m) {
    const dot = m.dot && m.dot.until > K.G.t ? m.dot.kind : '', held = m.snaredUntil > K.G.t ? m.heldBy || 'snare' : '';
    return dot || held ? { dot, held } : null;
  }
  function renderState(now) {
    const L = lvl();
    // a door on the move: how much of it is still across the doorway, eased in and out
    fx.doorShut = null;
    for (const k in fx.doors) {
      const d = fx.doors[k];
      if (d.depth !== K.G.depth) continue;
      const u = Math.max(0, Math.min(1, (now - d.at) / DOOR_MS)), e = u * u * (3 - 2 * u);
      (fx.doorShut = fx.doorShut || {})[d.y * L.w + d.x] = { shut: d.open ? 1 - e : e, lock: d.lock };
    }
    const sprites = [];
    // a named champion awake and close carries its life along the top of the view, as the lich does
    const topNamed = namedBar(L);
    for (const m of L.monsters) {
      if (m.moveT1 > now) {
        // (a slide that starts a moment from now, a Shield Slam's, holds where it was until then)
        const t = Math.max(0, (now - m.moveT0) / (m.moveT1 - m.moveT0));
        m.rx = m.fromX + (m.x - m.fromX) * t; m.ry = m.fromY + (m.y - m.fromY) * t;
      } else { m.rx = m.x; m.ry = m.y; }
      // a mimic still shut is drawn as the barrel it seems, where the barrel stood
      if (m.disguised) {
        if (Assets.sprites.dress_barrel) sprites.push({ x: m.x + 0.5 + (m.dox || 0), y: m.y + 0.5 + (m.doy || 0), img: Assets.sprites.dress_barrel, scale: DRESS_SIZE.barrel || 0.66, yOff: 0, onFloor: true, dress: true });
        continue;
      }
      // a drowned one under the water shows only as a ripple that does not settle
      if (m.sunk) {
        if (Assets.sprites.dress_ripple) sprites.push({ x: m.x + 0.5, y: m.y + 0.5, img: Assets.sprites.dress_ripple, scale: 0.86 + 0.06 * Math.sin(now / 420 + m.uid), yOff: 0, onFloor: true, dress: true });
        continue;
      }
      const mb = MONSTERS[m.id];
      const bob = mb.fly ? Math.sin(now / 250 + m.uid) * 0.05 : 0;
      const base = Assets.sprites[mb.sprite];
      // a champion wears its colour, or is drawn as itself; a hero's shade wears the gear of their trade
      const tint = m.elite || (mb.named ? m.id : '') || (m.shade && base && base.elite && base.elite['shade_' + m.shade.cls] ? 'shade_' + m.shade.cls : '');
      const img = (tint && base && base.elite && base.elite[tint]) ? base.elite[tint] : base;
      const n = packSize(m);
      // how far through its wind-up it is, for the tell drawn over it
      const tell = m.volley ? 1 : m.windup ? Math.min(1, Math.max(0.05, (K.G.t - m.windup.at) / Math.max(1, m.windup.until - m.windup.at))) : 0;
      // a monster's own trick is marked in violet, so it reads as more than a blow
      const special = !!(m.windup && m.windup.move);
      // just struck, it reels: its flinching picture, through the white of the hit and a
      // moment after, unless it is winding up, whose warning must never be hidden
      const reeling = !tell && now >= (m.flashAt || 0) && now < (m.flashUntil || 0) + REEL_MS;
      // walking, it strides, a step to each half of a square and the other foot first on the next;
      // a bat beats its wings all the while it is aloft (see stride in creatures.js)
      const step = tell || !img || !img.stepA ? '' : mb.fly ? ['', 'stepA', '', 'stepB'][Math.floor(now / 90 + m.uid) % 4]
        : m.moveT1 > now ? (Math.max(0, (now - m.moveT0) / Math.max(1, m.moveT1 - m.moveT0)) < 0.5) === ((m.x + m.y) % 2 === 0) ? 'stepA' : 'stepB' : '';
      // asleep, its eyes are shut; awake, it blinks now and then (see eyesShut in creatures.js)
      const shut = !tell && !step && img && img.blink && (!m.awake || (now + m.uid * 977) % (3200 + (m.uid % 5) * 450) < 130);
      const walking = step ? img[step] : shut ? img.blink : img;
      const shown = reeling && img && img.hurt ? img.hurt : walking;
      // what is upon it, drawn on its body: fire, venom, a bleeding wound, and what holds it fast
      const aff = afflictions(m);
      if (m.collapsed) {
        // a heap of bones on the floor, a ring round it filling as it pulls itself together
        const rising = Math.min(1, Math.max(0.02, 1 - (m.collapsed - K.G.t) / RISE_MS));
        sprites.push({ x: m.rx + 0.5, y: m.ry + 0.5, img: Assets.sprites.bone_heap || img, scale: mb.scale * 0.95, yOff: 0, flash: now >= (m.flashAt || 0) ? m.flashUntil : 0, heap: rising });
        continue;
      }
      // a grey dwarf swelling, or grown to twice its height, is drawn so
      const big = m.bigUntil > K.G.t ? GROWN_SCALE : m.windup && m.windup.move === 'enlarge' ? 1 + (GROWN_SCALE - 1) * 0.6 * tell : 1;
      if (n === 1) {
        const mo = motion(m, now, 0, tell);
        // the lich's life runs along the top of the view, so it carries no bar of its own
        sprites.push({ x: m.rx + 0.5 + mo.dx, y: m.ry + 0.5 + mo.dy, img: shown, reeling, aff, step, scale: mb.scale * big, yOff: (mb.fly || 0) + bob + mo.lift, sqx: mo.sqx, sqy: mo.sqy, lean: mo.lean, emit: mb.fiery ? FIERY_GLOW : 0, flash: now >= (m.flashAt || 0) ? m.flashUntil : 0, hp: mb.boss || m === topNamed ? null : (now < (m.flashAt || 0) && m.hpShown > 0 ? m.hpShown : m.hp), maxHp: m.maxHp, tell, special, boss: !!mb.boss || m === topNamed,
          // wrapped in shadow, it shows faint and flickering; a shade is never quite there
          ...(m.wardUntil > K.G.t ? { alpha: 0.45 + 0.2 * Math.sin(now / 70) } : m.shade ? { alpha: 0.8 + 0.08 * Math.sin(now / 400 + m.uid) } : {}) });
        continue;
      }
      // a group stands abreast across your view: the front one a little
      // nearer and carrying the health bar, the rest at its shoulders
      const ax = Math.cos(cam.angle), ay = Math.sin(cam.angle), sx = -ay, sy = ax;
      const spots = n === 2 ? [[0.17, -0.06], [-0.2, 0.06]] : [[0, -0.1], [0.27, 0.05], [-0.27, 0.07]];
      spots.slice(0, n).forEach(([side, back], i) => {
        const b2 = mb.fly ? Math.sin(now / 250 + m.uid + i * 1.7) * 0.05 : 0;
        const mo = motion(m, now, i, i === 0 ? tell : 0);
        sprites.push({ x: m.rx + 0.5 + sx * side + ax * back + mo.dx, y: m.ry + 0.5 + sy * side + ay * back + mo.dy, img: i === 0 ? shown : walking, ...(i === 0 ? { reeling, aff, step } : {}), scale: mb.scale * 0.88 * big, yOff: (mb.fly || 0) + b2 + mo.lift, sqx: mo.sqx, sqy: mo.sqy, lean: mo.lean, emit: mb.fiery && i === 0 ? FIERY_GLOW : 0,
          flash: i === 0 && now >= (m.flashAt || 0) ? m.flashUntil : 0, ...(i === 0 ? { hp: now < (m.flashAt || 0) && m.hpShown > 0 ? m.hpShown : m.hp, maxHp: m.maxHp, tell } : {}) });
      });
    }
    // flames standing on a burning square (its glow on the floor is drawn by the renderer),
    // and a shut door on fire, how far through it the fire is (the renderer chars it as it goes)
    fx.doorFire = null;
    for (const f of elements.view()) {
      if (f.k === 'fire' && f.fuel === 'door') (fx.doorFire = fx.doorFire || {})[`${f.x},${f.y}`] = f.burnt;
      if (f.k !== 'fire' || !Assets.sprites.dress_flames) continue;
      // a shut door on fire burns on the face turned to the hero, not hidden inside its own square
      let ox = 0, oy = 0;
      const t = tile(f.x, f.y);
      if (t === T.DOOR || t === T.DOOR_LOCKED) {
        // (a door opens onto the floor on two sides: the face is on whichever of those the hero is)
        const hero = P(), alongX = passable(f.x - 1, f.y) || passable(f.x + 1, f.y);
        if (alongX) ox = (hero.x >= f.x ? 1 : -1) * 0.56; else oy = (hero.y >= f.y ? 1 : -1) * 0.56;
      }
      sprites.push({ x: f.x + 0.5 + ox, y: f.y + 0.5 + oy, img: Assets.sprites.dress_flames, scale: (f.fuel === 'door' ? 0.75 : 0.5) + 0.07 * Math.sin(now / 110 + f.x * 7 + f.y * 3), yOff: 0, onFloor: true, glow: true });
    }
    // a kobold's snares, set where they can be seen, the wire catching the light now and then
    for (const k in (L.snares || {})) {
      const [sx, sy] = k.split(',').map(Number);
      if (Assets.sprites.dress_snare) sprites.push({ x: sx + 0.5, y: sy + 0.5, img: Assets.sprites.dress_snare, scale: (DRESS_SIZE.snare || 0.42) * (1 + 0.06 * Math.sin(now / 160 + sx * 3 + sy)), yOff: 0, onFloor: true, dress: true });
    }
    // what lies about the room for looks, and what the fallen left (puddles are drawn flat by the renderer)
    for (const d of (L.dressing || [])) {
      if (d.k !== 'puddle' && Assets.sprites['dress_' + d.k]) sprites.push({ x: d.x + 0.5 + d.ox, y: d.y + 0.5 + d.oy, img: Assets.sprites['dress_' + d.k], scale: DRESS_SIZE[d.k] || 0.34, yOff: 0, onFloor: true, dress: true });
    }
    for (const r of (L.remains || [])) {
      // shown once the body has sunk out of sight over it
      if (r.until > K.G.t && K.G.t - (r.at || 0) > 450 && Assets.sprites['dress_' + r.k]) sprites.push({ x: r.x, y: r.y, img: Assets.sprites['dress_' + r.k], scale: DRESS_SIZE[r.k] || 0.3, yOff: 0, onFloor: true });
    }
    { const hs = companion.sprite(Assets, now); if (hs) sprites.push(hs); }
    for (const n of (L.npcs || [])) {
      const look = n.kind === 'encounter' ? ENCOUNTERS[n.id] : null;
      // the trader is one of the Lampfolk, or at a goblin market a goblin pedlar
      const who = look ? look.sprite : traderKind() === 'pedlar' ? 'pedlar' : 'merchant';
      sprites.push({ x: n.x + 0.5, y: n.y + 0.5, img: Assets.sprites[who] || Assets.sprites.merchant, scale: look ? 0.85 : 0.95, yOff: 0 });
    }
    for (const k in L.items) {
      const list = L.items[k];
      if (!list.length) continue;
      const [x, y] = k.split(',').map(Number);
      // what lies on a square is scattered across it, each thing where it fell,
      // rather than one picture standing for the lot: the newest five show
      const shown = list.slice(-SCATTER.length), spots = SCATTER[shown.length - 1];
      const turn = (((x * 73856093) ^ (y * 19349663)) >>> 0) % 4 * Math.PI / 2, c = Math.round(Math.cos(turn)), sn = Math.round(Math.sin(turn));
      shown.forEach((it, i) => {
        const [ox, oy] = spots[i];
        // the Heart floats; a relic hovers a little, so it reads as more than iron
        const floats = it.t === 'artifact' || !!it.u;
        const size = it.t === 'artifact' ? 0.4 : (it.u ? 0.38 : 0.32) * (shown.length > 1 ? 0.85 : 1);
        // what is worth stooping for catches the light now and then: a relic, the Heart, a ring or amulet, gear with an edge to it
        const glint = !!(it.u || it.t === 'artifact' || it.e > 0 || ['ring', 'amulet'].includes((ITEMS[it.t] || {}).kind));
        sprites.push({ x: x + 0.5 + ox * c - oy * sn, y: y + 0.5 + ox * sn + oy * c, img: Assets.sprites[spriteFor(it)], scale: size, yOff: floats ? 0.04 + Math.sin(now / 300 + i) * 0.03 : 0, onFloor: true, glint });
      });
    }
    // the fallen: knocked back, sinking into a heap and fading
    for (const c of fx.corpses) {
      const art = Assets.sprites[c.sprite];
      if (!art) continue;
      // one killed by a fireball still in the air stands until it lands
      const u = Math.max(0, Math.min(1, (now - c.born) / CORPSE_MS));
      // (how it falls, by the way its kind dies: see corpsePose)
      const img = (c.elite && art.elite && art.elite[c.elite]) || art, flash = now >= c.born && u < 0.08 ? now + 1 : 0, side = (c.born | 0) % 2 ? 1 : -1;
      const pose = corpsePose(c.how, u, side, c.fly);
      sprites.push({ x: c.x + c.dx * pose.back, y: c.y + c.dy * pose.back, img, scale: c.scale, yOff: pose.yOff, sqx: pose.sqx, sqy: pose.sqy, lean: pose.lean, alpha: pose.alpha, flash, death: c.how });
    }
    // what the hero holds, for the view at the bottom of the screen
    const p = P(), wIt = p.eq.weapon;
    // the lich's life across the top of the view, once it has woken and spoken
    const boss = L.monsters.find(m => MONSTERS[m.id].boss && m.spoke && m.awake && !m.collapsed);
    const rite = boss && boss.windup && boss.windup.move === 'rite' ? boss.windup : null;
    // (the Warlord on his throne says so on his bar: nothing marks it otherwise but a blow turned aside)
    fx.boss = boss ? { name: MONSTERS[boss.id].name + (boss.throne ? ', on his throne' : ''), hp: boss.hp, maxHp: boss.maxHp, phase: boss.phase || 0, rite: !!rite,
      riteDone: rite ? Math.min(1, Math.max(0, (K.G.t - rite.at) / Math.max(1, rite.until - rite.at))) : 0 } : null;
    // else a named champion's, its name in full and marked where its fight turns, if it does
    if (!boss && topNamed) {
      const nb = MONSTERS[topNamed.id], sh = topNamed.shade;
      fx.boss = { name: sh ? `Shade of ${heroTitle(sh.name, sh.cls)}` : namedTitle(nb), hp: now < (topNamed.flashAt || 0) && topNamed.hpShown > 0 ? topNamed.hpShown : topNamed.hp, maxHp: topNamed.maxHp,
        phase: 0, rite: false, riteDone: 0, named: true, notches: nb.move === 'rally' ? [1 / 2] : [] };
    }
    // what ails or aids the hero, tinted over the view
    fx.status = { poison: !!p.poison, held: (p.held || 0) > K.G.t, webbed: (p.webbed || 0) > K.G.t, grabbed: !!p.grabbed,
      ac: !!effect('ac'), hit: !!effect('hit'), might: !!effect('might'), starving: p.food === 0,
      // (the fire under your own feet is not in the view: this says it is there)
      burning: !!elements.fieldAt(p.x, p.y) && elements.fieldAt(p.x, p.y).k === 'fire' };
    const bear = wild.shaped(p);
    fx.view = bear ? { weapon: null, two: false, drawn: false, shield: null, offhand: null, cls: 'bear', walk: cam.moving ? camProgress() : 0, steps: p.steps } : {
      weapon: wIt ? spriteFor(wIt) : null, two: !!(wIt && ITEMS[wIt.t].twoHanded), drawn: !!(wIt && ['shortbow', 'longbow'].includes(ITEMS[wIt.t].sprite)),
      shield: p.eq.shield ? spriteFor(p.eq.shield) : null, offhand: p.eq.offhand ? spriteFor(p.eq.offhand) : null,
      cls: p.cls, walk: cam.moving ? camProgress() : 0, steps: p.steps,
      // on a dark floor, a lantern in hand: the light the hero sees by
      lantern: L.twist === 'dark',
    };
    fx.threats = threats();
    // a wraith's grave-cold creeping over the stones toward its mark while it breathes
    // on a smouldering floor, the cracks: quiet, sealed, or glowing toward a flare over the squares it will cover
    fx.vents = elements.vents();
    // on a floor of tremors, where rock is about to land: marked on the floor, and the rock itself as it drops
    fx.rocks = elements.falling();
    for (const r of fx.rocks) if (r.u > 0.72 && Assets.sprites.dress_rubble) sprites.push({ x: r.x + 0.5, y: r.y + 0.5, img: Assets.sprites.dress_rubble, scale: 0.36, yOff: 1.1 * (1 - r.u) / 0.28, dress: true });
    fx.frost = [];
    for (const m of L.monsters) {
      const w = m.windup;
      // (breathed only down a straight line: off one, there is no trail to draw)
      if (!w || w.move !== 'chill' || w.tx == null || (m.x !== w.tx && m.y !== w.ty)) continue;
      const n = Math.max(1, Math.abs(w.tx - m.x) + Math.abs(w.ty - m.y)), u = Math.max(0, Math.min(1, (K.G.t - w.at) / Math.max(1, w.until - w.at)));
      const dx = Math.sign(w.tx - m.x), dy = Math.sign(w.ty - m.y);
      for (let i = 1; i <= n; i++) { const a = Math.min(1, u * n - i + 1.5); if (a > 0) fx.frost.push({ x: m.x + dx * i, y: m.y + dy * i, a }); }
    }
    return prelude.frame({ level: L, cam, sprites, fx }, now);
  }


  return { CORPSE_MS, DOOR_MS, renderState };
}
