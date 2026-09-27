// The hero's companion: a hound won over on the way down (the Starving Hound,
// in encounters.js). It follows, bites whatever awake thing stands beside it
// (the one at the hero's side first), draws the blows of anything that
// reaches it first, heals when the hero rests, and grows with the hero. If it
// falls it is gone for the run. It lives outside the monster list, so nothing
// that counts monsters counts it; what it borrows from the game comes through
// the getters in K, as the monsters' and the traders' do.
import { d, Rng } from './rng.js';
import { Sound } from './sound.js';

// it trots when it has fallen behind, and walks once it is back at heel
const HOUND = { sprite: 'dog', ac: 13, speed: 900, stepMs: 330, trotMs: 140, lostMs: 3000 };
const NAMES = ['Brindle', 'Soot', 'Bramble', 'Pip', 'Ash', 'Moss', 'Tansy', 'Grip', 'Wick', 'Nettle', 'Rook', 'Hob'];

/** @param {any} K */
export function makeCompanion(K) {
  /** The companion, if it is on this floor and still standing. */
  const here = () => { const c = K.G && K.G.companion; return c && !c.fallen && c.depth === K.G.depth ? c : null; };
  const maxHpFor = level => 10 + 4 * level;
  const hitFor = level => 3 + Math.floor(level / 3);
  const biteFor = level => [1, 6, Math.floor(level / 3)];
  /** A hound at heel pants, and its claws click on the stone: sleepers hear the hero a square sooner. */
  const noisy = () => { const c = here(), p = K.P(); return !!c && c.mode === 'follow' && Math.abs(c.x - p.x) + Math.abs(c.y - p.y) <= 3; };
  const at = (x, y) => { const c = here(); return !!c && c.x === x && c.y === y; };
  /** Ground it can stand on: open floor, no trader, stone or barrel in the way. */
  const ground = (x, y) => K.passable(x, y) && !K.npcAt(x, y) && !K.propAt(x, y);
  const free = (x, y) => ground(x, y) && !K.monsterAt(x, y) && !(x === K.P().x && y === K.P().y);
  /**
   * Its own way to the hero, walked out from them over ground it can stand on.
   * The monsters' map stops at a score of squares and treats a shut door as
   * open, and a hound that trusted it sat down in front of a door, or lost the
   * hero in a long corridor, and never moved again.
   */
  function trail() {
    const L = K.lvl(), p = K.P(), n = L.w * L.h;
    const dist = new Int16Array(n).fill(-1), q = new Int32Array(n);
    let head = 0, tail = 0;
    dist[p.y * L.w + p.x] = 0; q[tail++] = p.y * L.w + p.x;
    while (head < tail) {
      const i = q[head++], x = i % L.w, y = (i / L.w) | 0;
      for (const [dx, dy] of K.DIRS) {
        const nx = x + dx, ny = y + dy, j = ny * L.w + nx;
        if (nx < 0 || ny < 0 || nx >= L.w || ny >= L.h || dist[j] >= 0 || !ground(nx, ny)) continue;
        dist[j] = dist[i] + 1; q[tail++] = j;
      }
    }
    return dist;
  }
  /** An open square beside the hero, the one behind them first; failing that, the nearest open one. */
  function besideHero() {
    const p = K.P();
    for (const turn of [2, 1, 3, 0]) {
      const [dx, dy] = K.DIRS[(p.dir + turn) % 4], x = p.x + dx, y = p.y + dy;
      if (free(x, y)) return { x, y };
    }
    const L = K.lvl(), dist = trail();
    let best = null, bd = Infinity;
    for (let i = 0; i < dist.length; i++) {
      if (dist[i] < 2 || dist[i] >= bd) continue;
      const x = i % L.w, y = (i / L.w) | 0;
      if (free(x, y)) { bd = dist[i]; best = { x, y }; }
    }
    return best;
  }
  /** A hound joins the hero. */
  function join() {
    const G = K.G, p = K.P();
    if (G.companion && !G.companion.fallen) return '';
    const name = new Rng(`${G.seed}|hound`).pick(NAMES);
    const spot = besideHero() || { x: p.x, y: p.y };
    G.companion = { kind: 'hound', name, x: spot.x, y: spot.y, depth: G.depth, hp: maxHpFor(p.level), maxHp: maxHpFor(p.level), mode: 'follow', nextAct: G.t + 600, kills: 0, joined: G.depth };
    Sound.play('voice', K.heard({ x: spot.x, y: spot.y }, { who: 'dog' }));
    return `${name} follows you now.`;
  }
  /** It takes a blow, or the quills, or anything else: it may fall. */
  function hurt(n, what) {
    const c = here(), G = K.G;
    if (!c || n <= 0) return;
    c.hp -= n;
    c.flashUntil = K.realNow + 130;
    if (c.hp > 0) { K.log(`${what} ${c.name} for ${n}.`, 'bad'); return; }
    c.hp = 0; c.fallen = G.depth;
    K.log(`${what} ${c.name}, and ${c.name} falls, and does not get up.`, 'bad');
    Sound.play('death', K.heard({ x: c.x, y: c.y }, { gore: 'blood' }));
  }
  /** A monster beside it and not beside the hero swings at it instead. */
  function struck(m, mb) {
    const c = here(), p = K.P();
    if (!c || Math.abs(m.x - c.x) + Math.abs(m.y - c.y) !== 1) return;
    const roll = d(1, 20);
    if (roll === 1 || (roll !== 20 && roll + mb.hit < HOUND.ac + Math.floor(p.level / 3))) return;
    hurt(Math.max(1, d(...mb.dmg)), `The ${mb.name} hits`);
  }
  /** Its bite: an awake thing beside it, the one at the hero's side first. */
  function bite(c) {
    const L = K.lvl(), p = K.P();
    const foes = L.monsters.filter(m => m.awake && !m.collapsed && !m.fleeing && Math.abs(m.x - c.x) + Math.abs(m.y - c.y) === 1);
    if (!foes.length) return false;
    const m = foes.find(o => Math.abs(o.x - p.x) + Math.abs(o.y - p.y) === 1) || foes[0];
    c.lungeAt = K.realNow;
    const roll = d(1, 20), mb = K.mstat(m);
    if (roll !== 1 && (roll === 20 || roll + hitFor(p.level) >= mb.ac)) {
      // in a group the front one falls and the next steps up into the same place
      const many = m.pack ? m.pack.length : 0;
      K.damageMonster(m, Math.max(1, d(...biteFor(p.level))), 'companion');
      if (!L.monsters.includes(m) || (m.pack ? m.pack.length : 0) < many) c.kills++;
    }
    return true;
  }
  /** Its turn: bite, or keep up with the hero, or wait where it was told. */
  function turn() {
    const c = here(), G = K.G;
    if (!c || G.status !== 'playing' || G.t < c.nextAct) return;
    const p = K.P(), L = K.lvl();
    // it grows with the hero
    const want = maxHpFor(p.level);
    if (c.maxHp < want) { c.hp += want - c.maxHp; c.maxHp = want; }
    // something came to stand where it stands (a lunge, a summoning): it gives way first
    if (K.monsterAt(c.x, c.y)) {
      const out = K.DIRS.map(([dx, dy]) => [c.x + dx, c.y + dy]).find(([x, y]) => free(x, y));
      if (out) moveTo(c, out[0], out[1], HOUND.stepMs);
      c.nextAct = G.t + HOUND.stepMs; return;
    }
    // it fights beside the hero, not alone: once they have gone on, it goes after them
    const away = Math.abs(c.x - p.x) + Math.abs(c.y - p.y);
    if ((c.mode === 'stay' || away <= 3) && bite(c)) { c.nextAct = G.t + HOUND.speed; c.stuckSince = 0; return; }
    if (c.mode === 'stay') { c.nextAct = G.t + 300; c.stuckSince = 0; return; }
    const dist = trail(), di = dist[c.y * L.w + c.x];
    const step = di > 2 || di < 0 ? HOUND.trotMs : HOUND.stepMs;
    c.nextAct = G.t + step;
    if (di >= 0 && di <= 1) { c.stuckSince = 0; return; }
    // close by, it is not lost, only waiting for a way through
    if (di >= 0 && di <= 3) c.stuckSince = 0;
    // the square that brings it nearest; failing that, one as near that it did
    // not just come from, to get round whatever stands in the way
    let best = null, bd = di < 0 ? Infinity : di, side = null;
    for (const [dx, dy] of K.DIRS) {
      const x = c.x + dx, y = c.y + dy;
      if (x < 0 || y < 0 || x >= L.w || y >= L.h || !free(x, y)) continue;
      const dd = dist[y * L.w + x];
      if (dd < 0) continue;
      if (dd < bd) { bd = dd; best = [x, y]; } else if (dd === di && !side && !(x === c.fromX && y === c.fromY)) side = [x, y];
    }
    const to = best || side;
    if (to) { moveTo(c, to[0], to[1], step); if (best) { c.stuckSince = 0; return; } }
    // no way through for a while, or none at all (a door pulled shut behind the
    // hero): it finds its own way round and turns up at their back or side. Never
    // where the hero is looking: a hound that blinked out of sight and into the
    // square in front of them read as magic
    if (di >= 0 && di <= 3) return;
    if (!c.stuckSince) c.stuckSince = G.t;
    else if (G.t - c.stuckSince >= HOUND.lostMs && !inView(c.x, c.y)) {
      const spot = [2, 1, 3].map(t => K.DIRS[(p.dir + t) % 4]).map(([dx, dy]) => ({ x: p.x + dx, y: p.y + dy })).find(q => free(q.x, q.y));
      if (spot) { Object.assign(c, spot); c.moveT1 = 0; c.stuckSince = 0; }
    }
  }
  /**
   * Whether the hero can see a square: ahead of them, near enough to be lit,
   * and nothing solid on the straight line between.
   */
  function inView(x, y) {
    const p = K.P(), [fx, fy] = K.DIRS[p.dir];
    const rx = x - p.x, ry = y - p.y;
    if (rx * fx + ry * fy <= 0 || Math.abs(rx) + Math.abs(ry) > 12) return false;
    const n = Math.ceil(Math.max(Math.abs(rx), Math.abs(ry)) * 4);
    for (let i = 1; i < n; i++) {
      const tx = Math.floor(p.x + 0.5 + rx * i / n), ty = Math.floor(p.y + 0.5 + ry * i / n);
      if ((tx !== p.x || ty !== p.y) && (tx !== x || ty !== y) && !K.passable(tx, ty)) return false;
    }
    return true;
  }
  function moveTo(c, x, y, ms = HOUND.stepMs) {
    c.fromX = c.x; c.fromY = c.y; c.x = x; c.y = y;
    c.moveT0 = K.realNow; c.moveT1 = K.realNow + ms;
  }
  /** Stay where you are, or come: the hero's word, facing it. */
  function toggle() {
    const c = here();
    if (!c) return false;
    c.mode = c.mode === 'stay' ? 'follow' : 'stay';
    K.log(c.mode === 'stay' ? `You tell ${c.name} to stay. ${c.name} waits.` : `You call ${c.name} to heel.`, 'info');
    if (c.mode === 'stay') Sound.play('step'); else Sound.play('voice', K.heard({ x: c.x, y: c.y }, { who: 'dog' }));
    return true;
  }
  /** The hero steps into its square: it steps into theirs, and nobody is stuck in a corridor. */
  function swap(fromX, fromY) {
    const c = here();
    if (!c) return;
    moveTo(c, fromX, fromY);
  }
  /** Rest heals it with the hero, by the same share. */
  function rested(share) {
    const c = here();
    if (c) c.hp = Math.min(c.maxHp, c.hp + Math.ceil(c.maxHp * share));
  }
  /** Down or up the stair: a hound at heel comes too; one told to stay, stays. */
  function arrive(fromDepth) {
    const c = K.G.companion;
    if (!c || c.fallen || c.depth !== fromDepth || c.mode === 'stay') return;
    const spot = besideHero(), p = K.P();
    c.depth = K.G.depth;
    Object.assign(c, spot || { x: p.x, y: p.y });
    c.moveT1 = 0; c.nextAct = K.G.t + 700; c.stuckSince = 0;
  }
  /** After a load: its clock starts again with the game's. */
  function loaded() {
    const c = K.G.companion;
    // (its picture's clocks run on the page's time, which starts again from nothing)
    if (c) { c.nextAct = K.G.t + 800; c.moveT1 = 0; c.flashUntil = 0; c.lungeAt = 0; c.stuckSince = 0; }
  }
  /** Where to draw it, smoothly between squares. */
  function sprite(Assets, now) {
    const c = here();
    if (!c) return null;
    let x = c.x, y = c.y;
    if (c.moveT1 > now && c.fromX != null) {
      const t = Math.max(0, Math.min(1, (now - c.moveT0) / (c.moveT1 - c.moveT0)));
      x = c.fromX + (c.x - c.fromX) * t; y = c.fromY + (c.y - c.fromY) * t;
    }
    const s = Assets.sprites[HOUND.sprite];
    const lunging = now - (c.lungeAt || 0) < 220;
    return { x: x + 0.5, y: y + 0.5, img: lunging && s.windup ? s.windup : s, scale: 0.62, yOff: 0, flash: now < (c.flashUntil || 0) ? c.flashUntil : 0 };
  }
  /** For the hero sheet and the epilogue. */
  function note() {
    const c = K.G && K.G.companion;
    if (!c) return '';
    if (c.fallen) return `${c.name}, the hound who followed you from floor ${c.joined}, fell on floor ${c.fallen}.`;
    return `${c.name}, your hound: ${c.hp} of ${c.maxHp} hit points, ${c.mode === 'stay' ? `told to stay on floor ${c.depth}` : 'at your heel'}${c.kills ? `, ${c.kills} kill${c.kills > 1 ? 's' : ''}` : ''}.`;
  }
  return { here, noisy, at, join, hurt, struck, turn, toggle, swap, rested, arrive, loaded, sprite, note };
}
