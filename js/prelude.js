import { Dungeon } from './dungeon.js';
import { Assets } from './assets.js';
import { Sound } from './sound.js';

// The way in. A new run opens on the hero walking down a short passage cut
// into the mountain, by themselves, the player only watching. At its end a
// rumble behind turns them round, and they see the roof come down over the
// way they came, the far end first and the last of it at their feet; the dust
// is still settling when the first floor begins, with fallen rock where the
// stair back up would have been. A tap on the view, or any control, skips it.
//
// It is played on a stage of its own, a passage built in the first floor's
// stone, rather than cut into the floor itself: the stair up stands at the
// edge of the map as often as not, with no rock behind it to cut a passage in.

const T = Dungeon.T;
const W = 7, LEN = 5, H = LEN + 9;               // and a chamber beyond its end, dark at the back
const MID = 3, FROM = H - 2, TO = FROM - LEN;   // the passage runs north, from FROM to TO
// how long each part takes, in milliseconds
const STEP_MS = 620, WALK_MS = LEN * STEP_MS, WAIT_MS = 450, TURN_MS = 720;
const FALL_AT = WALK_MS + WAIT_MS + TURN_MS;     // the first rock leaves the roof
const FALL_GAP = 260, DROP_MS = 380;             // square after square, each rock's drop
const BURY = 4;                                  // squares of passage that come down
const DUST_AT = FALL_AT + (BURY - 1) * FALL_GAP + 150, DUST_MS = 1200;
const END_MS = DUST_AT + DUST_MS + 200;
const ease = u => u * u * (3 - 2 * u);

/** @param {any} K */
export function makePrelude(K) {
  /** @type {{t0: number, level: any, fired: Set<string>, told: boolean}|null} */
  let on = null;

  // the passage, in the first floor's own stone: dark ahead where it opens
  // out, one torch on its wall, and solid rock behind where the walk began
  function stage(L) {
    const tiles = new Uint8Array(W * H).fill(T.WALL);
    for (let y = TO; y <= FROM; y++) tiles[y * W + MID] = T.FLOOR;
    for (let y = 1; y < TO; y++) for (let x = 1; x < W - 1; x++) tiles[y * W + x] = T.FLOOR;
    tiles[TO * W + MID - 1] = T.TORCH;
    return {
      w: W, h: H, tiles, theme: L.theme, depth: L.depth, twist: null, route: null,
      rooms: [], roomId: new Int16Array(W * H).fill(-1), piece: null, caved: [],
      lights: [{ x: MID, y: TO }], dressing: [], items: {}, monsters: [], npcs: [], traps: {},
      locks: {}, features: {}, fields: {}, doorBlows: {}, explored: new Uint8Array(W * H),
      start: null, downStart: null, stairsUp: null, stairsDown: null,
    };
  }

  /** The way in begins (from the UI, on a new run only). @param {number} now */
  function begin(now) { on = { t0: now, level: stage(K.lvl()), fired: new Set(), told: false }; }
  const active = () => !!on;
  // the once-only moments of it: a sound, a line in the log
  const once = (k, f) => { if (on && !on.fired.has(k)) { on.fired.add(k); f(); } };
  function tell() {
    if (!on || on.told) return;
    on.told = true;
    K.log('A rumble behind you, and the roof of the passage comes down. When the dust settles there is no way back: only down.', 'info');
  }
  /** Over: by its own end, or a tap. The first floor comes up out of the dust. @param {number} now */
  function finish(now) {
    if (!on) return;
    tell();
    on = null;
    K.fx.arriveAt = now;
  }

  /**
   * The view while it plays: the stage, the camera walking and turning, rock
   * falling and the dust rising, over what the floor would have shown.
   * @param {{level: any, cam: any, sprites: any[], fx: any}} rs @param {number} now
   */
  function frame(rs, now) {
    if (!on) return rs;
    const t = now - on.t0;
    if (t >= END_MS) { finish(now); return rs; }
    const L = on.level;
    // walking north, a square at a time, then a wait, then round to face the way back
    let y = FROM + 0.5, angle = -Math.PI / 2, walk = 0, steps = 0, moving = false;
    if (t < WALK_MS) {
      const n = Math.floor(t / STEP_MS), u = (t - n * STEP_MS) / STEP_MS;
      y = FROM + 0.5 - n - ease(u); walk = u; steps = n; moving = true;
      once('step' + n, () => Sound.play('step'));
    } else {
      y = TO + 0.5; steps = LEN;
      const u = Math.max(0, Math.min(1, (t - WALK_MS - WAIT_MS) / TURN_MS));
      angle = -Math.PI / 2 + Math.PI * ease(u);
      moving = u > 0 && u < 1;
    }
    if (t >= WALK_MS) once('rumble', () => Sound.play('rumble'));
    // the rock: each buried square, far end first, takes three stones from the
    // roof and is filled; the last of it comes down right in front of the hero
    const sprites = [];
    for (let k = 0; k < BURY; k++) {
      const sy = TO + BURY - k, at = FALL_AT + k * FALL_GAP, i = sy * W + MID;
      if (t >= at + DROP_MS) { if (!L.caved.includes(i)) { L.tiles[i] = T.WALL; L.caved.push(i); } continue; }
      if (t < at || !Assets.sprites.dress_rubble) continue;
      for (let s = 0; s < 3; s++) {
        const u = Math.max(0, Math.min(1, (t - at - s * 70) / (DROP_MS - 140)));
        if (u <= 0) continue;
        sprites.push({ x: MID + 0.3 + 0.2 * s, y: sy + 0.35 + 0.15 * ((s * 2) % 3), img: Assets.sprites.dress_rubble, scale: 0.34 + 0.06 * s, yOff: 1.15 * (1 - u * u), dress: true });
      }
    }
    if (t >= FALL_AT) once('fall', () => { Sound.play('rumble'); tell(); });
    // the shake: a shudder at the first rumble, then the roof coming in
    const shake = t >= FALL_AT ? { shakeUntil: on.t0 + DUST_AT + 400, shakeMs: DUST_AT + 400 - FALL_AT, shakeAmp: 6 }
      : t >= WALK_MS ? { shakeUntil: on.t0 + WALK_MS + 500, shakeMs: 500, shakeAmp: 2 } : { shakeUntil: 0 };
    const dust = t < DUST_AT ? 0 : Math.min(1, (t - DUST_AT) / DUST_MS);
    const fx = { ...rs.fx, ...shake, dust, arriveAt: on.t0, threats: [], rocks: [], vents: [], frost: [], stains: {}, doorShut: null, boss: null,
      view: { ...(rs.fx.view || {}), walk, steps, lantern: false } };
    return { level: L, cam: { ...rs.cam, x: MID + 0.5, y, angle, moving }, sprites, fx };
  }

  return { begin, active, finish, frame, END_MS };
}
