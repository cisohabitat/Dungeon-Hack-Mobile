// The hero's companion: a hound won over on the way down (the Starving Hound,
// in encounters.js). It follows, bites whatever awake thing stands beside it
// (the one at the hero's side first), draws the blows of anything that
// reaches it first, heals when the hero rests, and grows with the hero. If it
// falls it is gone for the run. It lives outside the monster list, so nothing
// that counts monsters counts it; what it borrows from the game comes through
// the getters in K, as the monsters' and the traders' do.
import { d, Rng } from './rng.js';
import { Sound } from './sound.js';

const HOUND = { sprite: 'dog', ac: 13, speed: 900, stepMs: 330 };
const NAMES = ['Brindle', 'Soot', 'Bramble', 'Pip', 'Ash', 'Moss', 'Tansy', 'Grip', 'Wick', 'Nettle', 'Rook', 'Hob'];

/** @param {any} K */
export function makeCompanion(K) {
  /** The companion, if it is on this floor and still standing. */
  const here = () => { const c = K.G && K.G.companion; return c && !c.fallen && c.depth === K.G.depth ? c : null; };
  const maxHpFor = level => 10 + 4 * level;
  const hitFor = level => 3 + Math.floor(level / 3);
  const biteFor = level => [1, 6, Math.floor(level / 3)];
  /** A hound at heel pants, and its claws click on the stone: sleepers hear the hero a square sooner. */
  const noisy = () => { const c = here(); return !!c && c.mode === 'follow'; };
  const at = (x, y) => { const c = here(); return !!c && c.x === x && c.y === y; };
  const free = (x, y) => K.passable(x, y) && !K.monsterAt(x, y) && !K.npcAt(x, y) && !(x === K.P().x && y === K.P().y);
  /** An open square beside the hero, the one behind them first. */
  function besideHero() {
    const p = K.P();
    for (const turn of [2, 1, 3, 0]) {
      const [dx, dy] = K.DIRS[(p.dir + turn) % 4], x = p.x + dx, y = p.y + dy;
      if (free(x, y)) return { x, y };
    }
    return null;
  }
  /** A hound joins the hero. */
  function join() {
    const G = K.G, p = K.P();
    if (G.companion && !G.companion.fallen) return '';
    const name = new Rng(`${G.seed}|hound`).pick(NAMES);
    const spot = besideHero() || { x: p.x, y: p.y };
    G.companion = { kind: 'hound', name, x: spot.x, y: spot.y, depth: G.depth, hp: maxHpFor(p.level), maxHp: maxHpFor(p.level), mode: 'follow', nextAct: G.t + 600, kills: 0, joined: G.depth };
    return `${name} follows you now.`;
  }
  /** It takes a blow, or the quills, or anything else: it may fall. */
  function hurt(n, what) {
    const c = here(), G = K.G;
    if (!c || n <= 0) return;
    c.hp -= n;
    c.flashUntil = K.realNow + 130;
    if (c.hp > 0) { K.log(`${what} ${c.name} (${n}).`, 'bad'); return; }
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
    hurt(Math.max(1, d(...mb.dmg)), `The ${mb.name} savages`);
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
      K.damageMonster(m, Math.max(1, d(...biteFor(p.level))), 'companion');
      if (!L.monsters.includes(m)) c.kills++;
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
    if (bite(c)) { c.nextAct = G.t + HOUND.speed; return; }
    if (c.mode === 'stay') { c.nextAct = G.t + 300; return; }
    K.ensureDist();
    const di = K.distField[c.y * L.w + c.x];
    c.nextAct = G.t + HOUND.stepMs;
    if (di >= 0 && di <= 1) return;
    let best = null, bd = di < 0 ? Infinity : di;
    for (const [dx, dy] of K.DIRS) {
      const x = c.x + dx, y = c.y + dy;
      if (x < 0 || y < 0 || x >= L.w || y >= L.h) continue;
      const dd = K.distField[y * L.w + x];
      if (dd >= 0 && dd < bd && free(x, y)) { bd = dd; best = [x, y]; }
    }
    if (best) moveTo(c, best[0], best[1]);
  }
  function moveTo(c, x, y) {
    c.fromX = c.x; c.fromY = c.y; c.x = x; c.y = y;
    c.moveT0 = K.realNow; c.moveT1 = K.realNow + HOUND.stepMs;
  }
  /** Stay where you are, or come: the hero's word, facing it. */
  function toggle() {
    const c = here();
    if (!c) return false;
    c.mode = c.mode === 'stay' ? 'follow' : 'stay';
    K.log(c.mode === 'stay' ? `You tell ${c.name} to stay. ${c.name} sits.` : `You call ${c.name} to heel.`, 'info');
    Sound.play('step');
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
    c.moveT1 = 0; c.nextAct = K.G.t + 700;
  }
  /** After a load: its clock starts again with the game's. */
  function loaded() {
    const c = K.G.companion;
    if (c) { c.nextAct = K.G.t + 800; c.moveT1 = 0; c.flashUntil = 0; }
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
