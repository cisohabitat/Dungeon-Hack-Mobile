// The title's own little dungeon: a floor built from the seed of the day, walked
// by a camera that turns at corners and looks at what lives there. ui.js draws it
// behind the title, and lends what it needs through K.
import { Assets } from './assets.js';
import { ITEMS, MONSTERS } from './data.js';
import { Dungeon } from './dungeon.js';
import { Renderer } from './renderer.js';
import { $ } from './uikit.js';

/** @param {any} K */
export function makeTitleScene(K) {
  // ---------- animated title scene ----------
  // A ghost camera drifts through a real generated dungeon behind the menu.
  const title = { level: null, lit: new Set(), cell: null, dir: 0, mode: 'step', t0: 0, dur: 0, next: null, embers: [], sprites: [], last: 0 };
  const TITLE_FX = { damageUntil: 0, healUntil: 0, swingUntil: 0, castUntil: 0, shakeUntil: 0, castColor: '#fff', texts: [] };
  const STEP_MS = 1150, TURN_MS = 800;

  function titlePassable(L, x, y) {
    if (x < 0 || y < 0 || x >= L.w || y >= L.h) return false;
    const t = L.tiles[y * L.w + x];
    return t === Dungeon.T.FLOOR || t === Dungeon.T.DOOR_OPEN;
  }
  function buildTitleScene() {
    const T = Dungeon.T;
    const seeds = ['hallsofdust', 'emberdeep', 'thornvault', 'greyhollow'];
    const seed = seeds[Math.floor(Math.random() * seeds.length)];
    const L = Dungeon.generate(seed, 2 + Math.floor(Math.random() * 3), { levels: 8, size: 'medium', monsters: 'normal', treasure: 'rich', lockedDoors: false, traps: false });
    // the camera is a ghost: every door stands open to it, and nothing is hidden
    for (let i = 0; i < L.tiles.length; i++) {
      if (L.tiles[i] === T.DOOR || L.tiles[i] === T.DOOR_LOCKED) L.tiles[i] = T.DOOR_OPEN;
      if (L.tiles[i] === T.SECRET) L.tiles[i] = T.WALL;
    }
    L.explored.fill(1);
    title.level = L;
    title.lit = new Set((L.lights || []).map(l => l.y * L.w + l.x));
    // open on the best shot in the level: a long corridor with torches down it
    let best = { x: L.start.x, y: L.start.y, dir: L.start.dir, score: -1 };
    for (let i = 0; i < L.tiles.length; i++) {
      if (L.tiles[i] !== T.FLOOR) continue;
      const x = i % L.w, y = (i / L.w) | 0;
      for (let k = 0; k < 4; k++) {
        const run = titleRun(L, x, y, k);
        if (run < 3) continue;
        const score = run + titleLitAhead(L, x, y, k, run) * 6;
        if (score > best.score) best = { x, y, dir: k, score };
      }
    }
    title.cell = { x: best.x, y: best.y };
    title.dir = best.dir;
    title.mode = 'step';
    title.t0 = 0; title.dur = STEP_MS;
    title.next = null;
    // still sprites: sleeping monsters and glinting loot
    title.sprites = [];
    for (const m of L.monsters) {
      const mb = MONSTERS[m.id];
      const base = Assets.sprites[mb.sprite];
      const tint = m.elite || (mb.named ? m.id : '');
      title.sprites.push({ x: m.x + 0.5, y: m.y + 0.5, img: (tint && base.elite && base.elite[tint]) ? base.elite[tint] : base, scale: mb.scale, yOff: mb.fly || 0, _fly: !!mb.fly, _uid: m.uid });
    }
    for (const k in L.items) {
      const list = L.items[k];
      if (!list.length) continue;
      const [x, y] = k.split(',').map(Number);
      const it = list[list.length - 1];
      const base = ITEMS[it.t];
      const sp = it.t === 'key' ? 'key_' + it.color : (base && base.sprite) || 'gold';
      title.sprites.push({ x: x + 0.5, y: y + 0.5, img: Assets.sprites[sp] || Assets.sprites.gold, scale: it.t === 'artifact' ? 0.5 : 0.3 });
    }
    title.embers = [];
    for (let i = 0; i < 26; i++) {
      title.embers.push({ x: Math.random() * 320, y: Math.random() * 200, vy: -(4 + Math.random() * 10), vx: (Math.random() - 0.5) * 6, r: Math.random() < 0.25 ? 2 : 1, life: Math.random() });
    }
  }
  // How many open tiles stretch away from a cell in one direction, and how many
  // of them are torchlit. The ghost is drawn toward the light.
  function titleRun(L, x, y, dir, cap) {
    const [dx, dy] = Dungeon.DIRS[dir];
    let n = 0;
    while (n < (cap || 12) && titlePassable(L, x + dx * (n + 1), y + dy * (n + 1))) n++;
    return n;
  }
  function titleLitAhead(L, x, y, dir, run) {
    const [dx, dy] = Dungeon.DIRS[dir];
    let lit = 0;
    for (let i = 1; i <= run; i++) if (title.lit.has((y + dy * i) * L.w + (x + dx * i))) lit++;
    return lit;
  }
  // Pick where the ghost goes next. It favours the longest view so the menu
  // always sits over receding corridor rather than a wall pressed to the lens.
  function titleChooseNext() {
    const L = title.level, c = title.cell;
    const back = (title.dir + 2) % 4;
    const scored = [];
    for (let k = 0; k < 4; k++) {
      const run = titleRun(L, c.x, c.y, k);
      if (run < 2) continue;                  // never turn toward a near wall
      let weight = run * run + titleLitAhead(L, c.x, c.y, k, run) * 14;
      if (k === title.dir) weight *= 3;       // keep walking where we can
      if (k === back) weight *= 0.05;         // doubling back is a last resort
      scored.push({ k, weight });
    }
    if (!scored.length) return back;
    const total = scored.reduce((a, s) => a + s.weight, 0);
    let r = Math.random() * total;
    for (const s of scored) { r -= s.weight; if (r <= 0) return s.k; }
    return scored[0].k;
  }
  function updateTitleCamera(now) {
    if (!title.t0) title.t0 = now;
    let t = (now - title.t0) / title.dur;
    let guard = 0;
    while (t >= 1 && guard++ < 16) {
      const elapsed = title.dur;              // the phase that just finished
      const wasStep = title.mode === 'step';
      if (wasStep) {
        const d = Dungeon.DIRS[title.dir];
        title.cell = { x: title.cell.x + d[0], y: title.cell.y + d[1] };
      } else {
        title.dir = title.next;
      }
      const want = titleChooseNext();
      if (want !== title.dir) {
        title.mode = 'turn'; title.next = want; title.dur = TURN_MS;
      } else {
        title.mode = 'step'; title.dur = STEP_MS;
      }
      title.t0 += elapsed;
      t = (now - title.t0) / title.dur;
    }
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    const ang = d => d * Math.PI / 2 - Math.PI / 2;
    if (title.mode === 'step') {
      const d = Dungeon.DIRS[title.dir];
      const e = t * t * (3 - 2 * t); // ease in and out of each stride
      return { x: title.cell.x + 0.5 + d[0] * e, y: title.cell.y + 0.5 + d[1] * e, angle: ang(title.dir) };
    }
    let from = ang(title.dir), to = ang(title.next);
    while (to - from > Math.PI) to -= Math.PI * 2;
    while (to - from < -Math.PI) to += Math.PI * 2;
    const e = t * t * (3 - 2 * t);
    return { x: title.cell.x + 0.5, y: title.cell.y + 0.5, angle: from + (to - from) * e };
  }
  function renderTitle(now) {
    if (!title.level) buildTitleScene();
    const cam = updateTitleCamera(now);
    for (const s of title.sprites) if (s._fly) s.yOff = 0.3 + Math.sin(now / 260 + s._uid) * 0.05;
    // anything right under the lens fills the whole frame, so keep it back
    const visible = title.sprites.filter(s => Math.hypot(s.x - cam.x, s.y - cam.y) > 1.8);
    Renderer.render(title.level, cam, visible, TITLE_FX, now);
    // embers and a slow torch flicker over the top
    const c = $('#title-art');
    const ctx = c.getContext('2d');
    const dt = title.last ? Math.min(0.05, (now - title.last) / 1000) : 0;
    title.last = now;
    for (const e of title.embers) {
      e.x += e.vx * dt; e.y += e.vy * dt;
      e.life += dt * 0.35;
      if (e.y < -4 || e.life > 1) { e.x = Math.random() * 320; e.y = 204; e.life = 0; e.vy = -(4 + Math.random() * 10); }
      const a = Math.sin(Math.min(1, e.life) * Math.PI) * 0.75;
      ctx.fillStyle = `rgba(255,${150 + Math.floor(e.life * 80)},60,${a.toFixed(2)})`;
      ctx.fillRect(e.x | 0, e.y | 0, e.r, e.r);
    }
    const flick = 0.06 + Math.sin(now / 420) * 0.02 + Math.sin(now / 130) * 0.012;
    ctx.fillStyle = `rgba(255,170,70,${Math.max(0, flick).toFixed(3)})`;
    ctx.fillRect(0, 0, 320, 200);
  }

  return { renderTitle, title };
}
