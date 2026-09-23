'use strict';
// Headless playtest: loads the real game rules and plays full runs with a bot,
// so balance can be measured instead of guessed at.
const { loadGame } = require('./harness');

const BACKGROUND_ROTATION = ['oathbroken', 'tombwise', 'ashborn', 'cloistered', 'deepborn', 'debtor'];

const TICK = 300;   // ms of game time per bot action, roughly a brisk human pace
// DUAL=1 plays the fighter with a blade in each hand instead of a shield, so the
// two builds can be compared over the same seeds rather than argued about.
const DUAL = process.env.DUAL === '1';
const SMART = process.env.SMART !== '0';
const ENC = process.env.ENC !== '0';

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
  // Measuring the build, not the drop rate: without this only about a third of
  // runs happen to find a light blade, and the comparison mostly reports how
  // often loot obliged.
  if (DUAL && Game.canDualWield()) Game.player().inv.push({ t: 'shortsword', q: 1, e: 0 });
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
  // Advance to the next moment worth acting in: a whole tick normally, but no
  // further than the instant the hero can swing or cast again, the way a
  // player holding Attack strikes the moment the blow is ready. Rounding
  // every action up to a whole 300ms tick made a 400ms dagger take 600ms,
  // favoured slow weapons over fast ones, and hid the dual-wield swing cost
  // entirely: a 700ms and an 805ms swing both came out at 900ms.
  const step = () => {
    const wait = p.nextAttack - G.t;
    const dt = wait > 0 && wait < TICK ? Math.max(16, Math.ceil(wait)) : TICK;
    Game.update(now, dt);
  };
  while (rec.ticks < 80000 && G.status === 'playing') {
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

    // --- use the class's own kit before its consumables. The bot used to cast
    // only attack spells, so a cleric never healed and a mage never raised
    // Shield, and the class comparison measured a player who ignored half of
    // what each class is for. SMART=0 plays the old way, to compare.
    if (SMART) {
      // casting shares the swing timer, so only try when ready
      const castable = G.t < p.nextAttack ? [] : Game.knownSpells().filter(sp => Game.spellAvailable(sp) && p.sp >= sp.cost && !Game.spellWasteReason(sp));
      const healSp = castable.filter(sp => sp.kind === 'heal').pop();
      if (hpFrac < 0.5 && healSp && !process.env.NOHEAL) { Game.castSpell(healSp); rec.healsCast = (rec.healsCast || 0) + 1; step(); continue; }
      // a fight is about to start: raise defences first, keeping points in hand
      const closing = L.monsters.some(m => m.awake && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) <= 3);
      const buff = closing && !process.env.NOBUFF && castable.find(sp => sp.kind === 'buff' && p.sp >= sp.cost + 2);
      if (buff) { Game.castSpell(buff); rec.buffsCast = (rec.buffsCast || 0) + 1; step(); continue; }
    }
    // --- emergency: drink a healing potion
    const heal = p.inv.find(i => i.t === 'potion_heal' || i.t === 'potion_xheal');
    if (hpFrac < 0.35 && heal) { Game.useItem(heal); rec.potionsDrunk++; step(); continue; }
    // --- eat when hungry
    if (p.food < 25) {
      const food = p.inv.find(i => ITEMS[i.t].kind === 'food');
      if (food) { Game.useItem(food); step(); continue; }
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
    const bolts = process.env.NOBOLT || G.t < p.nextAttack ? [] : Game.knownSpells().filter(sp => Game.spellAvailable(sp) && p.sp >= sp.cost && sp.kind === 'bolt');
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
      if (shot) { p.dir = shot.dir; Game.castSpell(shot.sp); step(); continue; }
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
      if (shot !== null) { p.dir = shot; Game.input('attack'); step(); continue; }
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
        if (best !== null) { p.dir = best; Game.input('forward'); rec.retreats = (rec.retreats || 0) + 1; step(); continue; }
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
      const spells = process.env.NOBOLT ? [] : Game.knownSpells().filter(s => Game.spellAvailable(s) && p.sp >= s.cost && s.kind === 'bolt');
      if (spells.length && p.sp > p.maxSp * 0.4) Game.castSpell(spells[spells.length - 1]);
      else Game.input('attack');
      step();
      continue;
    }

    // --- rest when safe and hurt
    if ((hpFrac < 0.75 || (p.maxSp && p.sp < p.maxSp * 0.4)) && p.food > 10) {
      const before = p.hp;
      if (Game.rest()) { rec.rests++; step(); continue; }
    }

    // --- answer an encounter the way a thoughtful player would: read what
    // success and failure would each do, weigh them by the odds and by how
    // much this hero can afford to lose, and walk away unless it is worth it.
    // (The first version took any check better than even and ignored the
    // stakes, which made fragile heroes take gambles a person would refuse.)
    if (Game.currentEncounter()) {
      const cur = Game.currentEncounter();
      if (!cur.result) {
        const frail = 30 / Math.max(10, p.maxHp);            // how much a blow matters to this hero
        const worth = effects => effects.reduce((v, e) => {
          if (e.map) v += 2;
          if (e.xp) v += e.xp / 25;
          if (e.goldPerDepth) v += e.goldPerDepth / 12;
          if (e.hurt) v -= (e.hurt[0] * (e.hurt[1] + 1) / 2 + e.hurt[2]) / Math.max(1, p.hp) * 12;
          if (e.hurtFrac) v -= e.hurtFrac * p.maxHp / Math.max(1, p.hp) * 12;
          if (e.heal) v += (e.heal === 'full' ? (p.maxHp - p.hp) : e.heal) / p.maxHp * 5;
          if (e.maxHp) v += e.maxHp > 0 ? e.maxHp * 0.6 : e.maxHp * 0.9;
          if (e.food) v += e.food / 30;
          if (e.loot != null) v += 2 + e.loot;
          if (e.item) v += 1;
          if (e.buff) v += 2;
          if (e.poison) v -= 2 * frail;
          if (e.cure) v += p.poison ? 2 : 0;
          if (e.wake) v -= p.cls === 'thief' ? 5 : 3;
          if (e.identifyAll) v += 2;
          if (e.ambush) v -= (e.ambush.id === 'wraith' ? 5 : 3) * e.ambush.n * frail;
          return v;
        }, 0);
        let best = null, bestValue = 0;
        cur.def.choices.forEach((ch, i) => {
          const o = Game.encounterOptions()[i];
          if (o.blocked) return;
          let v = ch.check ? o.chance * worth(ch.pass.effects) + (1 - o.chance) * worth(ch.fail.effects) : worth(ch.outcome.effects);
          if (ch.cost && ch.cost.goldPerDepth) v -= ch.cost.goldPerDepth / 12;
          if (ch.cost && ch.cost.hurtFrac) v -= ch.cost.hurtFrac * 12;
          if (v > bestValue) { bestValue = v; best = o; }
        });
        // nothing worth the risk: take the way out, which is always last
        // (ENCLEAVE=1 always walks away: the detour without the rewards)
        if (!best || process.env.ENCLEAVE) best = Game.encounterOptions()[cur.def.choices.length - 1];
        const r = Game.chooseEncounter(best.i);
        rec.encounters = (rec.encounters || 0) + 1;
        // tally what the encounter actually handed over, for ENCLOG=1
        rec.encGot = rec.encGot || {};
        rec.encChose = rec.encChose || {};
        rec.encChose[`${cur.def.title} / ${best.label}`] = (rec.encChose[`${cur.def.title} / ${best.label}`] || 0) + 1;
        for (const l of (r ? r.lines : [])) {
          let m;
          if ((m = l.match(/^\+(\d+) experience/))) rec.encGot.xp = (rec.encGot.xp || 0) + Number(m[1]);
          else if ((m = l.match(/^([+−])(\d+) maximum hit points/))) rec.encGot.maxHp = (rec.encGot.maxHp || 0) + (m[1] === '+' ? 1 : -1) * Number(m[2]);
          else if ((m = l.match(/^\+(\d+) gold/))) rec.encGot.gold = (rec.encGot.gold || 0) + Number(m[1]);
          else if ((m = l.match(/^−(\d+) hit points/))) rec.encGot.hurt = (rec.encGot.hurt || 0) + Number(m[1]);
          else if (/^Blessed/.test(l)) rec.encGot.blessed = (rec.encGot.blessed || 0) + 1;
          else if (/^Found/.test(l)) rec.encGot.found = (rec.encGot.found || 0) + 1;
          else if (/attack/.test(l)) rec.encGot.ambush = (rec.encGot.ambush || 0) + 1;
          else if (/awake/.test(l)) rec.encGot.woke = (rec.encGot.woke || 0) + 1;
          else if (/Fully healed/.test(l)) rec.encGot.healed = (rec.encGot.healed || 0) + 1;
        }
        if (r && r.check) rec[r.check.pass ? 'encPass' : 'encFail'] = (rec[r.check.pass ? 'encPass' : 'encFail'] || 0) + 1;
      }
      Game.closeEncounter();
      step();
      continue;
    }

    // --- visit the trader while we still have coin and room to carry
    // (encounter props stand in the same list, so find the trader by kind)
    const npc = (L.npcs || []).find(n => n.kind !== 'encounter');
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
        step();
        continue;
      }
      if (beside) {
        p.dir = Dungeon.DIRS.findIndex(([dx, dy]) => p.x + dx === npc.x && p.y + dy === npc.y);
        Game.input('forward');
        step();
        continue;
      }
      stepToward(npc.x, npc.y);
      step();
      continue;
    }
    if (npc && rec.shopTries >= 140) rec.shopped = true;   // stop trying, get on with it

    // --- walk up to an encounter on this floor (ENC=0 ignores them, to compare)
    const enc = ENC && (L.npcs || []).find(n => n.kind === 'encounter');
    if (enc) {
      const k = `${G.depth}:${enc.x},${enc.y}`;
      rec.encTries = rec.encTries || {};
      rec.encTries[k] = (rec.encTries[k] || 0) + 1;
      if (rec.encTries[k] < 140) {
        if (Math.abs(enc.x - p.x) + Math.abs(enc.y - p.y) === 1) {
          p.dir = Dungeon.DIRS.findIndex(([dx, dy]) => p.x + dx === enc.x && p.y + dy === enc.y);
          Game.input('forward');
        } else stepToward(enc.x, enc.y);
        step();
        continue;
      }
    }

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
    step();

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
  if (rec.died && !rec.cause) rec.cause = (G.lastAttacker && G.lastAttacker.name) || (p.food <= 0 ? 'starvation' : 'poison or a trap');
  rec.won = G.status === 'won';
  rec.level = p.level;
  rec.timedOut = G.status === 'playing';
  rec.dual = !!p.eq.offhand;
  rec.gear = `${p.eq.weapon ? p.eq.weapon.t : 'fists'}${p.eq.shield ? '+' + p.eq.shield.t : ''}${p.eq.armor ? ' in ' + p.eq.armor.t : ''}`;      // did this bot actually end up fighting two-handed
  return rec;
}

// MONSTERS=many (or few) measures a density other than the default
const opts = { levels: 8, size: 'medium', monsters: process.env.MONSTERS || 'normal', treasure: 'normal', lockedDoors: true, traps: true, permadeath: false };
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
  console.log(`${cls.padEnd(8)} win ${(won / rows.length * 100).toFixed(0).padStart(3)}%  avgDeepest ${avg('deepest').toFixed(2)}  avgLevel ${avg('level').toFixed(1)}  kills ${avg('kills').toFixed(0)}  rests ${avg('rests').toFixed(1)}  potions ${avg('potionsDrunk').toFixed(1)}  boons ${avg('boons').toFixed(1)}  bought ${avg('bought').toFixed(1)}  goldLeft ${avg('goldFound').toFixed(0)}  stuck ${stuck}  dual ${(rows.filter(r => r.dual).length / rows.length * 100).toFixed(0)}%  heals ${avg('healsCast').toFixed(1)}  buffs ${avg('buffsCast').toFixed(1)}  enc ${avg('encounters').toFixed(1)} (${(rows.reduce((a, r) => a + (r.encPass || 0), 0) / Math.max(1, rows.reduce((a, r) => a + (r.encPass || 0) + (r.encFail || 0), 0)) * 100).toFixed(0)}% pass)  diedOnFloor1 ${(rows.filter(r => r.died && r.deepest === 1).length / rows.length * 100).toFixed(0)}%`);
  if (errs.length) console.log('   errors:', errs.slice(0, 2).map(e => e.cause).join(' | '));
}
// GEAR=1 shows what each class ended its runs holding
if (process.env.GEAR) {
  for (const cls in results) {
    const t = {};
    for (const r of results[cls]) t[r.gear] = (t[r.gear] || 0) + 1;
    console.log(`   ${cls.padEnd(8)} ${Object.entries(t).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, n]) => `${k} ×${n}`).join(' | ')}`);
  }
}
// DEATHS=1 shows, per class, which floor runs died on and what killed them
if (process.env.DEATHS) {
  for (const cls in results) {
    const dead = results[cls].filter(r => r.died);
    const byFloor = {};
    for (const r of dead) byFloor[r.deepest] = (byFloor[r.deepest] || 0) + 1;
    const killers = {};
    for (const r of dead) killers[r.cause] = (killers[r.cause] || 0) + 1;
    const top = Object.entries(killers).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, n]) => `${k} ${n}`).join(', ');
    console.log(`   ${cls.padEnd(8)} died on floor: ${Object.entries(byFloor).map(([f, n]) => `${f}:${n}`).join(' ')}  | killers: ${top}`);
  }
}
// ENCLOG=1: what encounters handed each class per run, and its commonest choices
if (process.env.ENCLOG) {
  for (const cls in results) {
    const rows = results[cls], tot = {}, chose = {};
    for (const r of rows) {
      for (const k in (r.encGot || {})) tot[k] = (tot[k] || 0) + r.encGot[k];
      for (const k in (r.encChose || {})) chose[k] = (chose[k] || 0) + r.encChose[k];
    }
    console.log(`   ${cls.padEnd(8)} per run: ${Object.entries(tot).map(([k, v]) => `${k} ${(v / rows.length).toFixed(1)}`).join('  ')}`);
    console.log(`            choices: ${Object.entries(chose).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ${(v / rows.length).toFixed(2)}`).join(' | ')}`);
  }
}
// CAUSES=1 lists what ended the runs that never left the first floor
if (process.env.CAUSES) {
  const tally = {};
  for (const cls in results) for (const r of results[cls]) {
    if (!(r.died && r.deepest === 1)) continue;
    const k = `${cls.padEnd(7)} ${r.cause || '?'} (level ${r.level || '?'})`;
    tally[k] = (tally[k] || 0) + 1;
  }
  Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 14).forEach(([k, n]) => console.log(`   ${String(n).padStart(3)}  ${k}`));
}
console.log(`OVERALL win ${(totalWin / totalRuns * 100).toFixed(1)}%  avgDeepest ${(totalDeep / totalRuns).toFixed(2)}  (${totalRuns} runs)`);
}

main().catch(e => { console.error(e); process.exit(1); });
