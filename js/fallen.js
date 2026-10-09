// The fallen: a hero who died in an earlier run is remembered, and on a later
// run their bones lie on a floor and their shade waits beside them, in their
// class's gear. Also how a run is known again (its key). Borrows through K, read live.
import { CLASSES, MONSTERS } from './data.js';
import { Dungeon } from './dungeon.js';
import { Progress } from './progress.js';
import { Rng } from './rng.js';
import { Sound } from './sound.js';

/** @param {any} K */
export function makeFallen(K) {
  const fx = K.fx;
  const heard = K.heard;
  const learn = K.learn;
  const meet = K.meet;
  const key = (/** @type {any[]} */ ...a) => K.key(...a);
  const log = (/** @type {any[]} */ ...a) => K.log(...a);

  // ---------- the fallen ----------
  // The last hero this device lost lies where they fell, in a later run that
  // is not a daily one: their bones, the gear they died in, and their shade
  // risen over them, made to that floor and fighting as its class did. Laying
  // it to rest forgets them (Progress.layToRest), so each loss is met once.
  // Placed after the floor is made, from a stream of its own, so the map is
  // the seed's own whether anyone is remembered or not.
  const SHADE_FAR = 8;       // steps from the way in its bones lie, at least, where the floor allows
  const SHADE_HP = { fighter: 1.25, mage: 0.8, thief: 0.9, druid: 1.1 };
  // how each class's shade fights: as it did in life
  /** @type {Record<string, {move?: string, ac?: number, dmg?: number, speed?: number, lunge?: number, ranged?: string, element?: string}>} */
  const SHADE_WAYS = {
    fighter: { move: 'charge', ac: 1, dmg: 10 },
    cleric: { move: 'mend' },
    mage: { ac: -1, dmg: 4, ranged: 'hurls cold fire at', element: 'cold' },
    thief: { speed: 750, lunge: 1, dmg: 6 },
    ranger: { dmg: 6, ranged: 'looses a pale arrow at' },
    // a druid's comes back with the bear still in it: harder to hurt, heavier blows
    druid: { ac: 1, dmg: 8 },
  };
  // A run is known by when it began, to the millisecond, and never shares it
  // with the run before: a death and a new run in the same instant (as the
  // tests go) must not look like one run meeting its own shade.
  let lastStamp = 0;
  const newRunStamp = () => (lastStamp = Math.max(Date.now(), lastStamp + 1));
  /** Which run this is, as the Hall and the fallen know it. */
  const runKeyOf = g => (g.created ? String(g.created) : `${g.seed}|${g.player.name}|${g.player.cls}`);
  const runKey = () => runKeyOf(K.G);
  /** The floor a shade keeps in this delve: where its hero fell, but never the first floor, nor the lich's. */
  const shadeFloor = f => Math.max(2, Math.min(f.depth, (K.G.opts.levels || 8) - 1));
  /** A hero's name with their class: "Brand the Fighter". */
  const heroTitle = (name, c) => `${name} the ${CLASSES[c] ? CLASSES[c].name : c}`;
  /**
   * Made to the floor it keeps, by where that floor stands on the monster
   * ladder (as the rest of its creatures are), not by its bare number: a
   * shade fifteen floors down a long delve was out-hitting the minotaur.
   * @param {any} b  its kind, from MONSTERS @param {{name: string, cls: string, depth: number, tier?: number}} sh
   */
  function shadeStats(b, sh) {
    const d = Math.max(1, Math.min(12, sh.tier || sh.depth || 1)), w = SHADE_WAYS[sh.cls] || {};
    return {
      ...b, name: `Shade of ${sh.name}`, ac: Math.min(19, 12 + Math.floor(d / 2) + (w.ac || 0)), hit: 1 + Math.round(d),
      dmg: [1, w.dmg || 8, 1 + Math.floor(d / 2)], speed: w.speed || b.speed, xp: Math.round(40 + 30 * d),
      ...(w.move ? { move: w.move } : {}), ...(w.lunge ? { lunge: w.lunge } : {}),
      ...(w.ranged ? { ranged: { range: 5, dmg: [2, 6, Math.floor(d / 2)], verb: w.ranged, ...(w.element ? { element: w.element } : {}) } } : {}),
    };
  }
  /** @param {import('./types.js').Level} L @param {number} depth */
  function placeFallen(L, depth) {
    if (K.G.opts.daily || L.isFinal) return;
    const f = Progress.fallen();
    if (!f || f.run === runKey() || shadeFloor(f) !== depth) return;
    const T = Dungeon.T, w = L.w, at = (x, y) => (x < 0 || y < 0 || x >= w || y >= L.h ? T.WALL : L.tiles[y * w + x]);
    // how far each square is from the way in, walking
    const dist = new Int16Array(w * L.h).fill(-1), walk = [T.FLOOR, T.DOOR, T.DOOR_OPEN, T.STAIRS_DOWN, T.STAIRS_UP];
    const queue = [L.start.y * w + L.start.x];
    dist[queue[0]] = 0;
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q], x = i % w, y = (i / w) | 0;
      for (const [dx, dy] of Dungeon.DIRS) {
        const j = (y + dy) * w + x + dx;
        if (walk.includes(at(x + dx, y + dy)) && dist[j] < 0) { dist[j] = dist[i] + 1; queue.push(j); }
      }
    }
    // a square in a room, clear of everything else and of doorways, with nobody keeping it
    // (nor within a few steps of the floor's champion: its lair is its own, and a shade must never clear it away)
    const keeper = m => MONSTERS[m.id].named || MONSTERS[m.id].boss;
    const busy = (x, y) => (L.items[key(x, y)] || []).length || L.traps[key(x, y)] || L.monsters.some(m => (m.x === x && m.y === y) || (keeper(m) && Math.abs(m.x - x) + Math.abs(m.y - y) <= 3))
      || (L.npcs || []).some(n => Math.abs(n.x - x) + Math.abs(n.y - y) <= 2)
      || Dungeon.DIRS.some(([dx, dy]) => [T.DOOR, T.DOOR_OPEN, T.DOOR_LOCKED, T.STAIRS_DOWN, T.STAIRS_UP].includes(at(x + dx, y + dy)));
    const spots = [];
    for (let i = 0; i < w * L.h; i++) {
      const x = i % w, y = (i / w) | 0;
      if (L.tiles[i] === T.FLOOR && L.roomId[i] >= 0 && dist[i] > 0 && !busy(x, y)) spots.push(i);
    }
    if (!spots.length) return;
    const far = spots.filter(i => dist[i] >= SHADE_FAR);
    const pool = far.length ? far : spots.sort((a, b) => dist[b] - dist[a]).slice(0, 10);
    const i = new Rng(`${K.G.seed}|fallen|${depth}`).pick(pool), x = i % w, y = (i / w) | 0;
    // whatever stood beside it gives way
    L.monsters = L.monsters.filter(m => MONSTERS[m.id].named || MONSTERS[m.id].boss || Math.abs(m.x - x) + Math.abs(m.y - y) > 1);
    L.dressing = [...(L.dressing || []).filter(d => d.x !== x || d.y !== y), { x, y, k: 'remains_bones', ox: 0, oy: 0.12 }];
    if (f.gear.length) L.items[key(x, y)] = f.gear.map(it => ({ ...it }));
    const tier = Dungeon.tierAt(depth, K.G.opts.levels || 8), d = Math.min(12, tier), hp = Math.round((6 + 6 * d) * (SHADE_HP[f.cls] || 1));
    const uid = L.monsters.reduce((u, m) => Math.max(u, m.uid), depth * 1000) + 1;
    L.monsters.push({ uid, id: 'shade', x, y, hp, maxHp: hp, awake: false, nextAct: 0, rx: x, ry: y, fromX: x, fromY: y, moveT0: 0, moveT1: 0, flashUntil: 0,
      shade: { name: f.name, cls: f.cls, level: f.level, run: f.run, depth, tier } });
    L.bones = { name: f.name, cls: f.cls, x, y, fell: f.depth, ...(f.killer ? { killer: f.killer } : {}) };
  }
  /** Coming down onto the floor: one line, the first time, so the fight is chosen. @param {import('./types.js').Level} L */
  function bonesArrive(L) {
    if (!L.bones || L.bonesSaid || !L.monsters.some(m => m.shade)) return;
    L.bonesSaid = true;
    const b = L.bones;
    // a death on the first floor waits on the second, and one deeper than this delve goes on its last floor before the lich's: say so
    const where = !b.fell || b.fell === L.depth ? 'fell on this floor' : `fell on floor ${b.fell} of another delve, and their bones have found their way here`;
    log(`A cold you know settles on you. ${heroTitle(b.name, b.cls)} ${where}${b.killer ? `, killed by ${b.killer},` : ''} and did not stay down: somewhere on this floor their shade keeps watch over their bones.`, 'bad');
  }
  function shadeWakes(m) {
    m.spoke = true;
    log(`The Shade of ${m.shade.name} rises from its bones in the gear it died in, and knows you: another who came down here for the Heart.`, 'bad');
    meet(m);
    Sound.play('dread');
    fx.shakeAmp = 3; fx.shakeMs = 400; fx.shakeUntil = K.realNow + 400;
  }
  function shadeFalls(m) {
    fx.shakeAmp = 5; fx.shakeMs = 600; fx.shakeUntil = K.realNow + 600;
    Sound.play('namedfall', heard(m));
    learn(m.id, 'answer');
    if (!K.G.tested) Progress.layToRest(m.shade.run);
    K.G.rested = heroTitle(m.shade.name, m.shade.cls);
  }
  /** What killed the hero, as the one who finds their bones will be told it: "a goblin", "Grisk, the Goblin King". */
  function killerPhrase() {
    const k = K.G.lastAttacker;
    if (!k || k.encounter || k.cause) return '';
    return k.name.includes(',') || /^the /i.test(k.name) ? k.name : `${/^[aeiou]/i.test(k.name) ? 'an' : 'a'} ${k.name.toLowerCase()}`;
  }

  return { bonesArrive, heroTitle, killerPhrase, newRunStamp, placeFallen, runKey, runKeyOf, shadeFalls, shadeStats, shadeWakes };
}
