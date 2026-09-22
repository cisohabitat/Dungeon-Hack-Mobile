'use strict';
// Headless playtest: loads the real game rules and plays full runs with a bot,
// so balance can be measured instead of guessed at.
const { loadGame } = require('./harness');

const BACKGROUND_ROTATION = ['oathbroken', 'tombwise', 'ashborn', 'cloistered', 'deepborn', 'debtor'];

const TICK = 300;   // ms of game time per bot action, roughly a brisk human pace
// DUAL=1 plays the fighter with a blade in each hand instead of a shield, so the
// two builds can be compared over the same seeds rather than argued about.
const DUAL = process.env.DUAL === '1';

function run(ctx, cls, seed, opts, bg) {
  const { Rng, Dice } = ctx;
  // Live events roll two ways: the shared Dice, seeded from the clock when the
  // module loads, and bare Math.random. Neither is reproducible, so two
  // benchmark passes never saw the same fight and comparing them measured
  // noise. Seed both from the run's own identity, and a tuning change becomes
  // the only thing that can differ between two passes.
  const key = `${seed}|${cls}|${bg}`;
  const loose = new Rng(key + '|loose');
  const realRandom = Math.random;
  Dice.s = new Rng(key).s;
  Math.random = () => loose.next();
  try {
    return play(ctx, cls, seed, opts, bg);
  } finally {
    Math.random = realRandom;
  }
}

function play(ctx, cls, seed, opts, bg) {
  const { Game, Dungeon, ITEMS } = ctx;
  const T = Dungeon.T;
  Game.newGame({ name: 'Bot', cls, bg, stats: Game.rollStats(), seed, opts });
  let now = 0;
  const G = Game.state();
  const p = Game.player();
  const rec = { cls, bg, seed, depth: 1, deepest: 1, died: false, won: false, cause: '', ticks: 0, kills: 0, potionsDrunk: 0, rests: 0, starved: 0, packFull: 0, goldFound: 0, hpLow: 0 };

  // BFS from the player over passable tiles, returning a distance field
  const field = (L, tx, ty, treatDoorsOpen) => {
    const dist = new Int32Array(L.w * L.h).fill(-1);
    const solidNpc = new Set((L.npcs || []).map(n => n.y * L.w + n.x).filter(i => i !== ty * L.w + tx));
    const q = [ty * L.w + tx];
    dist[q[0]] = 0;
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi], x = i % L.w, y = (i / L.w) | 0;
      for (const [dx, dy] of Dungeon.DIRS) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= L.w || ny >= L.h) continue;
        const ni = ny * L.w + nx;
        if (dist[ni] >= 0) continue;
        const t = L.tiles[ni];
        if (solidNpc.has(ni)) continue;
        if (t === T.FLOOR || t === T.DOOR_OPEN || t === T.DOOR || (treatDoorsOpen && t === T.DOOR_LOCKED)) { dist[ni] = dist[i] + 1; q.push(ni); }
      }
    }
    return dist;
  };

  const snap = () => {
    const L = Game.level();
    let adj = 0, near = 0;
    for (const m of L.monsters) {
      const d = Math.abs(m.x - p.x) + Math.abs(m.y - p.y);
      if (d <= 1) adj++;
      if (m.awake && d <= 4) near++;
    }
    return { adj, near, awake: L.monsters.filter(m => m.awake).length, total: L.monsters.length };
  };
  while (rec.ticks < 40000 && G.status === 'playing') {
    rec.ticks++;
    if (p.hp <= p.maxHp * 0.5) { const s2 = snap(); rec.lastAdj = s2.adj; rec.lastNear = s2.near; rec.lastAwake = s2.awake; rec.lastTotal = s2.total; }
    now += TICK;
    // experience offers a choice on every level; take the most useful one
    while (Game.pendingBoons()) {
      const offer = Game.pendingBoons();
      const order = ['con', 'vigor', 'keen', 'swift', 'str', 'dex', 'hardy', 'focus', 'int', 'wis'];
      const pick = order.find(id => offer.includes(id)) || offer[0];
      Game.chooseBoon(pick);
      rec.boons = (rec.boons || 0) + 1;
    }
    const L = Game.level();
    const hpFrac = p.hp / p.maxHp;
    if (hpFrac < 0.3) rec.hpLow++;

    // --- emergency: drink a healing potion
    const heal = p.inv.find(i => i.t === 'potion_heal' || i.t === 'potion_xheal');
    if (hpFrac < 0.35 && heal) { Game.useItem(heal); rec.potionsDrunk++; Game.update(now, TICK); continue; }
    // --- eat when hungry
    if (p.food < 25) {
      const food = p.inv.find(i => ITEMS[i.t].kind === 'food');
      if (food) { Game.useItem(food); Game.update(now, TICK); continue; }
      else rec.starved++;
    }
    // --- equip anything better that we can use
    for (const it of p.inv.slice()) {
      const b = ITEMS[it.t];
      if (b.kind !== 'weapon' && b.kind !== 'armor' && b.kind !== 'shield') continue;
      if (Game.canEquip(it)) continue;
      const cur = p.eq[b.kind];
      const val = x => {
        if (!x) return 0;
        const bx = ITEMS[x.t];
        if (b.kind !== 'weapon') return bx.ac + (x.e || 0);
        const dps = (bx.dmg[0] * (bx.dmg[1] + 1) / 2 + bx.dmg[2] + (x.e || 0)) / (bx.speed / 1000);
        return dps * (bx.range ? 1.5 : 1);   // reach is worth paying for
      };
      if (val(it) > val(cur)) Game.equip(it, true);
    }
    // --- a second blade, when this bot is playing that build
    if (DUAL && Game.canDualWield()) {
      let best = null, bestDps = 0;
      for (const it of p.inv.slice()) {
        if (Game.offhandReason(it)) continue;
        const bx = ITEMS[it.t];
        const dps = (bx.dmg[0] * (bx.dmg[1] + 1) / 2 + bx.dmg[2] + (it.e || 0)) / (bx.speed / 1000);
        if (dps > bestDps) { bestDps = dps; best = it; }
      }
      const cur = p.eq.offhand;
      const curDps = cur ? (ITEMS[cur.t].dmg[0] * (ITEMS[cur.t].dmg[1] + 1) / 2 + ITEMS[cur.t].dmg[2] + (cur.e || 0)) / (ITEMS[cur.t].speed / 1000) : 0;
      if (best && bestDps > curDps) Game.equip(best, true, 'offhand');
    }

    // --- shoot down the corridor before anything closes the distance
    const bolts = Game.knownSpells().filter(sp => Game.spellAvailable(sp) && p.sp >= sp.cost && sp.kind === 'bolt');
    if (bolts.length) {
      let shot = null;
      for (let k = 0; k < 4 && !shot; k++) {
        const [dx, dy] = Dungeon.DIRS[k];
        for (let i = 1; i <= 5; i++) {
          const x = p.x + dx * i, y = p.y + dy * i;
          const t = L.tiles[y * L.w + x];
          if (t !== T.FLOOR && t !== T.DOOR_OPEN) break;
          const m = L.monsters.find(mm => mm.x === x && mm.y === y);
          if (m) {
            const sp = bolts.filter(b => b.range >= i).pop();
            if (sp && (i > 1 || p.sp > sp.cost * 2)) shot = { dir: k, sp };
            break;
          }
        }
      }
      if (shot) { p.dir = shot.dir; Game.castSpell(shot.sp); Game.update(now, TICK); continue; }
    }

    // --- loose a missile if the weapon in hand reaches
    const wep = Game.weapon();
    if (wep.range) {
      let shot = null;
      for (let k = 0; k < 4 && !shot; k++) {
        const [dx, dy] = Dungeon.DIRS[k];
        for (let i = 2; i <= wep.range; i++) {
          const x = p.x + dx * i, y = p.y + dy * i;
          const t = L.tiles[y * L.w + x];
          if (t !== T.FLOOR && t !== T.DOOR_OPEN) break;
          if (L.monsters.some(mm => mm.x === x && mm.y === y)) { shot = k; break; }
        }
      }
      if (shot !== null) { p.dir = shot; Game.input('attack'); Game.update(now, TICK); continue; }
    }

    // --- break off when badly hurt and out of remedies
    if (hpFrac < 0.32 && !heal) {
      const threats = L.monsters.filter(m => m.awake && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) <= 7);
      if (threats.length && !threats.some(m => Math.abs(m.x - p.x) + Math.abs(m.y - p.y) <= 1)) {
        const away = field(L, threats[0].x, threats[0].y, true);
        const here = away[p.y * L.w + p.x];
        let best = null, bd = here;
        for (let k = 0; k < 4; k++) {
          const [dx, dy] = Dungeon.DIRS[k];
          const nx = p.x + dx, ny = p.y + dy;
          if (nx < 0 || ny < 0 || nx >= L.w || ny >= L.h) continue;
          const dd = away[ny * L.w + nx];
          if (dd > bd) { bd = dd; best = k; }
        }
        if (best !== null) { p.dir = best; Game.input('forward'); rec.retreats = (rec.retreats || 0) + 1; Game.update(now, TICK); continue; }
      }
    }

    // --- fight what is adjacent, in front if possible
    let adj = null;
    for (let k = 0; k < 4; k++) {
      const [dx, dy] = Dungeon.DIRS[k];
      const m = L.monsters.find(mm => mm.x === p.x + dx && mm.y === p.y + dy);
      if (m) { adj = { m, dir: k }; break; }
    }
    if (adj) {
      if (p.dir !== adj.dir) { p.dir = adj.dir; }
      // cast when it is clearly better than swinging
      const spells = Game.knownSpells().filter(s => Game.spellAvailable(s) && p.sp >= s.cost && s.kind === 'bolt');
      if (spells.length && p.sp > p.maxSp * 0.4) Game.castSpell(spells[spells.length - 1]);
      else Game.input('attack');
      Game.update(now, TICK);
      continue;
    }

    // --- rest when safe and hurt
    if ((hpFrac < 0.75 || (p.maxSp && p.sp < p.maxSp * 0.4)) && p.food > 10) {
      const before = p.hp;
      if (Game.rest()) { rec.rests++; Game.update(now, TICK); continue; }
    }

    // --- visit the trader while we still have coin and room to carry
    const npc = (L.npcs || [])[0];
    // give up after a while: the trader may sit behind a door we have no key for
    if (npc && !rec.shopped && p.gold >= 50 && p.inv.length < 16 && (rec.shopTries = (rec.shopTries || 0) + 1) < 140) {
      const beside = Math.abs(npc.x - p.x) + Math.abs(npc.y - p.y) === 1;
      if (Game.currentShop()) {
        // stock up on what keeps us alive, cheapest first
        const s = Game.currentShop();
        const want = s.stock
          .filter(i => ['potion_heal', 'potion_xheal', 'ration', 'meat', 'potion_cure'].includes(i.t))
          .sort((a, b) => Game.buyPrice(s, a) - Game.buyPrice(s, b));
        let bought = 0;
        for (const i of want) {
          while (i.q > 0 && p.gold >= Game.buyPrice(s, i) * 2 && p.inv.length < 18 && Game.buy(i)) bought++;
        }
        rec.bought = bought;
        rec.shopped = true;
        Game.closeShop();
        Game.update(now, TICK);
        continue;
      }
      if (beside) {
        p.dir = Dungeon.DIRS.findIndex(([dx, dy]) => p.x + dx === npc.x && p.y + dy === npc.y);
        Game.input('forward');
        Game.update(now, TICK);
        continue;
      }
      stepToward(npc.x, npc.y);
      Game.update(now, TICK);
      continue;
    }
    if (npc && rec.shopTries >= 140) rec.shopped = true;   // stop trying, get on with it

    // --- otherwise head for the down stairs, picking up what we pass
    const target = L.stairsDown;
    if (!target) {
      // final level: head for the artifact, then climb back out
      let goal = null;
      for (const k in L.items) if (L.items[k].some(i => i.t === 'artifact')) goal = k.split(',').map(Number);
      if (!goal) goal = [L.stairsUp.x, L.stairsUp.y];
      stepToward(goal[0], goal[1]);
    } else if (G.escaping) {
      stepToward(L.stairsUp.x, L.stairsUp.y);
    } else {
      stepToward(target.x, target.y);
    }
    Game.update(now, TICK);

    function stepToward(tx, ty) {
      const L2 = Game.level();
      const dist = field(L2, tx, ty, true);
      const here = dist[p.y * L2.w + p.x];
      let best = null, bd = here < 0 ? Infinity : here;
      for (let k = 0; k < 4; k++) {
        const [dx, dy] = Dungeon.DIRS[k];
        const nx = p.x + dx, ny = p.y + dy;
        if (nx < 0 || ny < 0 || nx >= L2.w || ny >= L2.h) continue;
        const t = L2.tiles[ny * L2.w + nx];
        if (t === T.STAIRS_DOWN && nx === tx && ny === ty) { best = k; bd = -1; break; }
        if (t === T.STAIRS_UP && nx === tx && ny === ty) { best = k; bd = -1; break; }
        const dd = dist[ny * L2.w + nx];
        if (dd >= 0 && dd < bd) { bd = dd; best = k; }
      }
      if (best === null) { p.dir = (p.dir + 1) % 4; return; }
      p.dir = best;
      Game.input('forward');
    }
  }
  const fin = snap();
  rec.adjAtEnd = fin.adj; rec.nearAtEnd = fin.near; rec.awakeAtEnd = fin.awake; rec.totalAtEnd = fin.total;
  rec.killerLog = G.log.slice(-6).map(l => l.m).filter(m => /hits you|shoots|poison|starv|trap|dart|needle|pit/i.test(m)).slice(-3);
  rec.goldSpent = rec.goldSpent || 0;
  rec.depth = G.depth;
  rec.deepest = p.deepest;
  rec.kills = p.kills;
  rec.goldFound = p.gold;
  rec.died = G.status === 'dead';
  rec.won = G.status === 'won';
  rec.level = p.level;
  rec.timedOut = G.status === 'playing';
  return rec;
}

const opts = { levels: 8, size: 'medium', monsters: 'normal', treasure: 'normal', lockedDoors: true, traps: true, permadeath: false };
// A fixed seed set so results are comparable between tuning passes. The dice are
// seeded per run too, so the same command twice gives the same answer.
const SEEDS = Array.from({ length: 20 }, (_, i) => 'bench' + i);
const TRIALS = parseInt(process.argv[3] || '2', 10);
const classes = process.argv[2] ? [process.argv[2]] : ['fighter', 'cleric', 'mage', 'thief'];
async function main() {
const results = {};
for (const cls of classes) {
  const rows = [];
  for (const seed of SEEDS) {
    for (let t = 0; t < TRIALS; t++) {
      const ctx = await loadGame();
      // rotate backgrounds so the benchmark is not one perk repeated 60 times
      const bg = BACKGROUND_ROTATION[(SEEDS.indexOf(seed) * TRIALS + t) % BACKGROUND_ROTATION.length];
      try { rows.push(run(ctx, cls, seed, opts, bg)); }
      catch (e) { rows.push({ cls, died: true, cause: 'ERROR ' + e.message, deepest: 0, level: 0 }); }
    }
  }
  results[cls] = rows;
}

let totalWin = 0, totalRuns = 0, totalDeep = 0;
for (const cls in results) {
  const rows = results[cls];
  const won = rows.filter(r => r.won).length;
  const stuck = rows.filter(r => r.timedOut).length;
  const errs = rows.filter(r => (r.cause || '').startsWith('ERROR'));
  const avg = k => rows.reduce((a, r) => a + (r[k] || 0), 0) / rows.length;
  totalWin += won; totalRuns += rows.length; totalDeep += avg('deepest') * rows.length;
  console.log(`${cls.padEnd(8)} win ${(won / rows.length * 100).toFixed(0).padStart(3)}%  avgDeepest ${avg('deepest').toFixed(2)}  avgLevel ${avg('level').toFixed(1)}  kills ${avg('kills').toFixed(0)}  rests ${avg('rests').toFixed(1)}  potions ${avg('potionsDrunk').toFixed(1)}  boons ${avg('boons').toFixed(1)}  bought ${avg('bought').toFixed(1)}  goldLeft ${avg('goldFound').toFixed(0)}  stuck ${stuck}`);
  if (errs.length) console.log('   errors:', errs.slice(0, 2).map(e => e.cause).join(' | '));
}
console.log(`OVERALL win ${(totalWin / totalRuns * 100).toFixed(1)}%  avgDeepest ${(totalDeep / totalRuns).toFixed(2)}  (${totalRuns} runs)`);
}

main().catch(e => { console.error(e); process.exit(1); });
