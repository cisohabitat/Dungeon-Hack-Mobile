import { Rng, Dice, d } from './rng.js';
import { BACKGROUNDS, JOURNAL, BOONS, XP_TABLE, MAX_LEVEL, CLASSES, ITEMS, TRAP_TYPES, MONSTERS, SPELLS, POTION_LOOKS, SCROLL_LOOKS, ELITES, THEMES } from './data.js';
import { Assets } from './assets.js';
import { Dungeon } from './dungeon.js';
import { Sound } from './sound.js';

// Core game state and rules.

const Game = (() => {
  const T = Dungeon.T;
  const DIRS = Dungeon.DIRS;
  const INV_MAX = 20;
  const SAVE_KEY = 'deepdelve.save';
  const HALL_KEY = 'deepdelve.hall';
  const MOVE_MS = 220;
  const TURN_MS = 200;

  /** @type {import('./types.js').GameState|null} */
  let G = null;
  let distField = null, distFieldAt = -1e9;
  let realNow = 0;
  const fx = { damageUntil: 0, healUntil: 0, swingUntil: 0, castUntil: 0, shakeUntil: 0, castColor: '#fff', texts: [] };
  const buzz = ms => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ } };
  const cam = { x: 0, y: 0, angle: 0, fromX: 0, fromY: 0, fromA: 0, toX: 0, toY: 0, toA: 0, t0: 0, t1: 0, moving: false };
  const events = []; // messages for the UI layer: 'dead', 'won', 'level', 'inv', 'stats'

  const mod = s => Math.floor((s - 10) / 2);
  const key = (x, y) => x + ',' + y;
  /** @returns {import('./types.js').Level} the floor the player is standing on */
  const lvl = () => G.levels[G.depth];
  /** @returns {import('./types.js').Player} */
  const P = () => G.player;
  const cls = () => CLASSES[G.player.cls];

  // ---------- messages ----------
  function log(m, c) {
    G.log.push({ m, c: c || '' });
    if (G.log.length > 80) G.log.splice(0, G.log.length - 80);
  }
  function emit(e) { events.push(e); }
  function takeEvents() { return events.splice(0); }

  // ---------- tiles ----------
  function tile(x, y) {
    const L = lvl();
    return (x < 0 || y < 0 || x >= L.w || y >= L.h) ? T.WALL : L.tiles[y * L.w + x];
  }
  function setTile(x, y, t) { const L = lvl(); L.tiles[y * L.w + x] = t; }
  function monsterAt(x, y) { return lvl().monsters.find(m => m.x === x && m.y === y) || null; }
  function npcAt(x, y) { const L = lvl(); return (L.npcs || []).find(n => n.x === x && n.y === y) || null; }
  function passable(x, y) { const t = tile(x, y); return t === T.FLOOR || t === T.DOOR_OPEN; }

  // ---------- character ----------
  function rollStats() {
    const roll = () => { const r = [d(1, 6), d(1, 6), d(1, 6), d(1, 6)].sort((a, b) => b - a); return r[0] + r[1] + r[2]; };
    return { str: roll(), dex: roll(), con: roll(), int: roll(), wis: roll(), cha: roll() };
  }
  function spMax(p) {
    const c = CLASSES[p.cls];
    if (!c.spells) return 0;
    const stat = p.stats[c.primary];
    return Math.max(4, Math.round(p.level * (2.4 + mod(stat)))) + 3 + (p.bonusSp || 0);
  }
  // Practice tells: a veteran swings faster and puts more behind it. Without this
  // the player's damage is flat for the whole game while monster hit points grow.
  function skillSpeed() {
    const p = P();
    const rate = p.cls === 'thief' ? 0.062 : 0.045;   // thieves gain speed fastest
    const cap = (p.cls === 'thief' ? 0.55 : 0.42) + (p.perkSpeed || 0);
    return 1 - Math.min(cap, (p.level - 1) * rate + (p.perkSpeed || 0));
  }
  // the roll at or above which an attack is a critical hit
  function critFloor() {
    const p = P();
    if (p.cls !== 'thief') return 20;
    return p.level >= 9 ? 18 : 19;
  }
  function skillDamage() { return Math.floor((P().level - 1) / 3); }
  function weapon() {
    const p = P();
    const spd = skillSpeed();
    if (!p.eq.weapon) return { name: 'fists', dmg: [1, 2, 0], speed: Math.round(450 * spd), e: 0, range: 0 };
    const b = ITEMS[p.eq.weapon.t];
    return { name: b.name, dmg: b.dmg, speed: Math.round(b.speed * spd), e: p.eq.weapon.e || 0, twoHanded: !!b.twoHanded, range: b.range || 0 };
  }
  function effect(name) {
    const e = P().effects[name];
    return e && e.until > G.t ? e.amount : 0;
  }
  function toHit() {
    const p = P();
    return Math.floor(p.level * cls().hitProg) + mod(p.stats.str) + effect('hit') + weapon().e
      + (p.perkHit || 0) + (effect('might') ? 2 : 0);
  }
  function playerAC() {
    const p = P();
    let ac = 10 + mod(p.stats.dex) + effect('ac');
    // thieves stay alive by not being where the blow lands
    if (p.cls === 'thief') ac += Math.floor((p.level + 2) / 3);
    if (p.eq.armor) ac += ITEMS[p.eq.armor.t].ac + (p.eq.armor.e || 0);
    if (p.eq.shield) ac += ITEMS[p.eq.shield.t].ac + (p.eq.shield.e || 0);
    return ac;
  }
  function knownSpells() {
    const c = cls();
    if (!c.spells) return [];
    return SPELLS[c.spells];
  }
  function spellAvailable(sp) { return P().level >= sp.lvl * 2 - 1; }

  // Effective monster stats, including any champion bonuses.
  /** A champion with no matching prefix behaves exactly like its plain kind. */
  const NO_ELITE = { prefix: '', hp: 1, ac: 0, hit: 0, dmg: 0, xp: 1, speed: 1, tint: '#fff' };
  function mstat(m) {
    const b = MONSTERS[m.id];
    if (!m.elite) return b;
    const e = ELITES.find(x => x.prefix === m.elite) || NO_ELITE;
    return {
      name: `${m.elite} ${b.name}`, ac: b.ac + (e.ac || 0), hit: b.hit + (e.hit || 0),
      dmg: [b.dmg[0], b.dmg[1], b.dmg[2] + (e.dmg || 0)],
      speed: Math.round(b.speed * (e.speed || 1)), xp: Math.round(b.xp * (e.xp || 1)),
      sprite: b.sprite, scale: b.scale, undead: b.undead, poison: b.poison, fly: b.fly,
      regen: b.regen, boss: b.boss, drain: b.drain, ranged: b.ranged,
    };
  }

  // ---------- items ----------
  function itemName(it) {
    if (it.t === 'key') return `${it.color[0].toUpperCase() + it.color.slice(1)} Key`;
    if (it.t === 'gem') return it.name || 'Gem';
    const b = ITEMS[it.t];
    let n = b.name;
    if (!isKnown(it.t)) {
      const look = G.looks[it.t];
      n = b.kind === 'potion' ? `${look.adj[0].toUpperCase() + look.adj.slice(1)} Potion` : `${look.adj[0].toUpperCase() + look.adj.slice(1)} Scroll`;
    }
    if (it.e) n += ` +${it.e}`;
    if (it.q > 1) n += ` ×${it.q}`;
    return n;
  }
  function spriteFor(it) {
    if (it.t === 'key') return 'key_' + it.color;
    if (!isKnown(it.t)) return G.looks[it.t].sprite;
    return ITEMS[it.t].sprite;
  }
  /**
   * Put an item in the pack, stacking it where the kind allows.
   * @param {import('./types.js').Item} it
   * @returns {boolean} false when the pack is full
   */
  function giveItem(it) {
    const p = P();
    const b = ITEMS[it.t];
    if (b.stack) {
      const ex = p.inv.find(x => x.t === it.t);
      if (ex) { ex.q += it.q || 1; return true; }
    }
    if (p.inv.length >= INV_MAX) return false;
    p.inv.push({ t: it.t, q: it.q || 1, e: it.e || 0, color: it.color, name: it.name });
    return true;
  }
  /**
   * Take a single unit out of the pack.
   * @param {import('./types.js').Item} it
   * @returns {import('./types.js').Item|null} null when it was not being carried
   */
  function removeOne(it) {
    const p = P();
    const i = p.inv.indexOf(it);
    if (i < 0) return null;                                  // not in the pack
    if (it.q > 1) { it.q--; return { t: it.t, q: 1, e: it.e, color: it.color, name: it.name }; }
    p.inv.splice(i, 1);
    return it;
  }
  function canEquip(it) {
    const p = P(), b = ITEMS[it.t], c = cls();
    if (b.kind === 'weapon') return b.cls.includes(p.cls) ? null : `${c.name}s cannot wield a ${b.name.toLowerCase()}.`;
    if (b.kind === 'armor') {
      if (c.armor === 'none') return `${c.name}s cannot wear armor.`;
      if (c.armor === 'light' && b.weight !== 'light') return `${c.name}s can only wear light armor.`;
      return null;
    }
    if (b.kind === 'shield') {
      if (!c.shield) return `${c.name}s cannot use shields.`;
      if (p.eq.weapon && ITEMS[p.eq.weapon.t].twoHanded) return 'You need a free hand for a shield.';
      return null;
    }
    return 'That cannot be equipped.';
  }
  function equip(it, quiet) {
    const p = P(), b = ITEMS[it.t];
    if (p.eq[b.kind] === it) return true;                    // already worn
    if (p.inv.indexOf(it) < 0) { log('You are not carrying that.', 'bad'); return false; }
    const why = canEquip(it);
    if (why) { if (!quiet) log(why, 'bad'); return false; }
    const slot = b.kind;
    if (slot === 'weapon' && b.twoHanded && p.eq.shield) {
      if (p.inv.length >= INV_MAX) { log('No room in your pack to stow the shield.', 'bad'); return false; }
      p.inv.push(p.eq.shield); p.eq.shield = null;
      if (!quiet) log('You sling your shield onto your back.');
    }
    const i = p.inv.indexOf(it);
    if (i >= 0) p.inv.splice(i, 1);
    if (p.eq[slot]) p.inv.push(p.eq[slot]);
    p.eq[slot] = it;
    if (!quiet) log(`You equip the ${itemName(it)}.`);
    emit('inv');
    return true;
  }
  function unequip(slot) {
    const p = P();
    if (!p.eq[slot]) return;
    if (p.inv.length >= INV_MAX) { log('Your pack is full.', 'bad'); return; }
    p.inv.push(p.eq[slot]);
    log(`You remove the ${itemName(p.eq[slot])}.`);
    p.eq[slot] = null;
    emit('inv');
  }
  function useItem(it) {
    const p = P(), b = ITEMS[it.t];
    const consumable = b.kind === 'food' || b.kind === 'potion' || b.kind === 'scroll';
    if (consumable && p.inv.indexOf(it) < 0) { log('You are not carrying that.', 'bad'); return; }
    if (b.kind === 'food') {
      removeOne(it);
      p.food = Math.min(100, p.food + b.food);
      log(`You eat the ${b.name.toLowerCase()}. ${p.food >= 90 ? 'You are full.' : 'That was good.'}`, 'good');
      Sound.play('eat');
    } else if (b.kind === 'potion') {
      const wasNew = !isKnown(it.t);
      removeOne(it);
      if (wasNew) { G.known[it.t] = 1; log(`You drink the unknown potion... it is a ${b.name}.`, 'info'); }
      switch (b.effect) {
        case 'heal': { const n = d(...b.heal); healPlayer(n); log(`You drink the potion and heal ${n}.`, 'good'); break; }
        case 'cure': p.poison = null; log('The poison leaves your veins.', 'good'); Sound.play('heal'); break;
        case 'might': p.effects.might = { amount: 2, until: G.t + 120000 }; log('You feel mighty!', 'good'); Sound.play('spell'); break;
        case 'mana': if (p.maxSp) { p.sp = p.maxSp; log('Your mind clears. Spell points restored.', 'good'); } else log('Your thoughts feel unusually sharp, but nothing else happens.'); Sound.play('spell'); break;
      }
    } else if (b.kind === 'scroll') {
      const wasNewS = !isKnown(it.t);
      removeOne(it);
      if (wasNewS) { G.known[it.t] = 1; log(`You read the unknown scroll... it is a ${b.name}.`, 'info'); }
      fx.castUntil = realNow + 260; fx.castColor = '#fe8';
      switch (b.effect) {
        case 'fire': {
          Sound.play('spell');
          const targets = boltTargets(3, false);
          if (!targets.length) { log('A ball of fire bursts harmlessly against the stones.'); break; }
          for (const m of targets) damageMonster(m, d(4, 6), 'fire');
          break;
        }
        case 'heal': { const n = d(...b.heal); healPlayer(n); log(`Warmth flows through you. You heal ${n}.`, 'good'); break; }
        case 'map': { const L = lvl(); L.explored.fill(1); log('The layout of this level burns itself into your mind.', 'good'); Sound.play('spell'); break; }
        case 'teleport': {
          const L = lvl(); const spots = [];
          for (let i = 0; i < L.w * L.h; i++) if (L.tiles[i] === T.FLOOR && !monsterAt(i % L.w, (i / L.w) | 0)) spots.push(i);
          const s = Dice.pick(spots);
          p.x = s % L.w; p.y = (s / L.w) | 0;
          snapCam(); distFieldAt = -1e9;
          log('The world lurches and you find yourself elsewhere.', 'info');
          Sound.play('spell');
          checkTile();
          break;
        }
      }
    } else if (b.kind === 'weapon' || b.kind === 'armor' || b.kind === 'shield') {
      equip(it);
      return;
    } else if (b.kind === 'key') {
      log('Use keys by walking into a locked door.');
      return;
    } else if (b.kind === 'artifact') {
      log('The Heart pulses warmly. The way out is up.', 'info');
      return;
    } else {
      log('You cannot use that.');
      return;
    }
    emit('inv');
  }
  function dropItem(it) {
    const p = P(), L = lvl();
    if (it.t === 'artifact') { log('You could not bear to part with it.', 'bad'); return; }
    const one = removeOne(it);
    if (!one) { log('You are not carrying that.', 'bad'); return; }
    const k = key(p.x, p.y);
    (L.items[k] = L.items[k] || []).push(one);
    log(`You drop the ${itemName(one)}.`);
    emit('inv');
  }
  function floorItems() { return lvl().items[key(P().x, P().y)] || []; }
  function takeItem(it) {
    const p = P(), L = lvl(), k = key(p.x, p.y);
    const list = L.items[k] || [];
    const i = list.indexOf(it);
    if (i < 0) return;
    if (it.t === 'gold') { p.gold += it.q; log(`You pick up ${it.q} gold.`, 'good'); Sound.play('gold'); list.splice(i, 1); }
    else if (it.t === 'gem') { p.gold += it.q; log(`You find a ${it.name} worth ${it.q} gold.`, 'good'); Sound.play('gold'); list.splice(i, 1); }
    else if (it.t === 'artifact') { list.splice(i, 1); startEscape(); }
    else if (it.t === 'page') {
      list.splice(i, 1);
      const entry = JOURNAL[it.page];
      if (entry && !G.journal.some(j => j.i === it.page)) {
        G.journal.push({ i: it.page, depth: G.depth });
        log(`You find ${entry.title.toLowerCase()}.`, 'info');
        Sound.play('pickup');
        emit('page');
      }
    }
    else if (giveItem(it)) { log(`You pick up the ${itemName(it)}.`); Sound.play('pickup'); list.splice(i, 1); }
    else { log('Your pack is full.', 'bad'); }
    if (!list.length) delete L.items[k];
    emit('inv');
  }
  function pickupAll() {
    for (const it of floorItems().slice()) takeItem(it);
  }

  // ---------- camera ----------
  function snapCam() {
    const p = P();
    cam.x = cam.toX = p.x + 0.5; cam.y = cam.toY = p.y + 0.5;
    cam.angle = cam.toA = p.dir * Math.PI / 2 - Math.PI / 2;
    cam.moving = false;
  }
  function startCam(ms) {
    const p = P();
    cam.fromX = cam.x; cam.fromY = cam.y; cam.fromA = cam.angle;
    cam.toX = p.x + 0.5; cam.toY = p.y + 0.5;
    let target = p.dir * Math.PI / 2 - Math.PI / 2;
    while (target - cam.angle > Math.PI) target -= Math.PI * 2;
    while (target - cam.angle < -Math.PI) target += Math.PI * 2;
    cam.toA = target;
    cam.t0 = realNow; cam.t1 = realNow + ms; cam.moving = true;
  }
  function camProgress() { return cam.moving ? Math.min(1, (realNow - cam.t0) / (cam.t1 - cam.t0)) : 1; }
  function updateCam() {
    if (!cam.moving) return;
    const t = camProgress();
    const e = t < 1 ? 1 - Math.pow(1 - t, 2) : 1;
    cam.x = cam.fromX + (cam.toX - cam.fromX) * e;
    cam.y = cam.fromY + (cam.toY - cam.fromY) * e;
    cam.angle = cam.fromA + (cam.toA - cam.fromA) * e;
    if (t >= 1) { cam.moving = false; cam.angle = cam.toA; }
  }

  // ---------- new game / levels ----------
  // Each dungeon shuffles which appearance belongs to which potion/scroll type.
  function buildLooks(seed) {
    const rng = new Rng('looks#' + seed);
    const potions = Object.keys(ITEMS).filter(id => ITEMS[id].kind === 'potion');
    const scrolls = Object.keys(ITEMS).filter(id => ITEMS[id].kind === 'scroll');
    const pl = rng.shuffle(POTION_LOOKS.slice());
    const sl = rng.shuffle(SCROLL_LOOKS.slice());
    const looks = {};
    potions.forEach((id, i) => { looks[id] = { adj: pl[i % pl.length][0], sprite: pl[i % pl.length][1] }; });
    scrolls.forEach((id, i) => { looks[id] = { adj: sl[i % sl.length], sprite: 'scroll' }; });
    return looks;
  }
  function isKnown(t) {
    const b = ITEMS[t];
    return !!(!b || (b.kind !== 'potion' && b.kind !== 'scroll') || !G.looks[t] || G.known[t]);
  }
  function newGame(cfg) {
    const c = CLASSES[cfg.cls];
    const bg = BACKGROUNDS[cfg.bg] ? cfg.bg : 'oathbroken';
    const p = {
      name: (cfg.name || '').trim() || 'Adventurer', cls: cfg.cls, bg, stats: cfg.stats, level: 1, xp: 0,
      maxHp: 0, hp: 0, maxSp: 0, sp: 0, food: 100, gold: 0,
      inv: [], eq: { weapon: null, armor: null, shield: null }, effects: {}, poison: null,
      x: 0, y: 0, dir: 0, nextAttack: 0, kills: 0, steps: 0, deepest: 1,
    };
    // the background is who you were before the first stair, and it shows
    if (bg === 'ashborn') p.stats.con++;
    if (bg === 'oathbroken') p.perkHit = 1;
    if (bg === 'debtor') p.gold = 150;
    p.maxHp = Math.max(6, c.hitDie + 3 + mod(p.stats.con));
    p.hp = p.maxHp;
    p.maxSp = spMax(p); p.sp = p.maxSp;
    G = { seed: cfg.seed, opts: cfg.opts, player: p, levels: {}, depth: 1, log: [], t: 0, status: 'playing', lastSpell: null, created: Date.now(), version: 4, looks: buildLooks(cfg.seed), known: {}, escaping: false, escapeStart: 0, nextHunt: 0, hunts: 0, journal: [], pendingBoons: null };
    if (bg === 'cloistered') for (const id in ITEMS) G.known[id] = 1;   // raised among the books
    // the starting kit is familiar to its owner
    for (const id of c.startKit) G.known[id] = 1;
    for (const id of c.startKit) giveItem({ t: id, q: 1, e: 0 });
    for (const it of p.inv.slice()) {
      const k = ITEMS[it.t].kind;
      if ((k === 'weapon' || k === 'armor' || k === 'shield') && !p.eq[k]) equip(it, true);
    }
    enterLevel(1, 'down');
    log(`Welcome, ${p.name} the ${c.name}. ${G.opts.levels} levels lie below. Find the Heart of the Mountain.`, 'good');
    return G;
  }

  function enterLevel(depth, from) {
    const p = P();
    if (!G.levels[depth]) G.levels[depth] = Dungeon.generate(G.seed, depth, G.opts);
    G.depth = depth;
    const L = G.levels[depth];
    const s = from === 'down' ? L.start : (L.downStart || L.start);
    p.x = s.x; p.y = s.y; p.dir = s.dir;
    for (const m of L.monsters) { m.nextAct = G.t + 600 + Math.random() * 600; m.rx = m.x; m.ry = m.y; m.moveT1 = 0; }
    shop = null;
    snapCam();
    distFieldAt = -1e9;
    p.deepest = Math.max(p.deepest, depth);
    if (from === 'down') {
      if (depth > 1) log(`You descend to level ${depth}. ${THEMES[L.theme].flavor}`, 'info');
      else log(THEMES[L.theme].flavor, 'info');
      if (L.isFinal) log('A dreadful presence waits somewhere on this level.', 'bad');
    } else log(`You climb back up to level ${depth}.`, 'info');
    emit('level');
    checkTile();
  }
  function descend() {
    Sound.play('stairs');
    enterLevel(G.depth + 1, 'down');
    save(true);
  }
  function ascend() {
    if (G.depth === 1) {
      if (G.escaping) { win(); return; }
      log('The way out is sealed behind you. Only the depths remain.', 'info');
      return;
    }
    Sound.play('stairs');
    enterLevel(G.depth - 1, 'up');
    save(true);
  }

  // ---------- movement ----------
  function tryMove(rel) {
    const p = P();
    const dir = (p.dir + rel) % 4;
    const nx = p.x + DIRS[dir][0], ny = p.y + DIRS[dir][1];
    const t = tile(nx, ny);
    if (t === T.WALL) { Sound.play('bump'); return false; }
    if (t === T.DOOR) { openDoor(nx, ny); return true; }
    if (t === T.DOOR_LOCKED) { tryUnlock(nx, ny); return true; }
    if (t === T.STAIRS_DOWN) { descend(); return true; }
    if (t === T.STAIRS_UP) { ascend(); return true; }
    if (t === T.SECRET) { revealSecret(nx, ny, false); return true; }
    if (t === T.FOUNTAIN) { drinkFountain(nx, ny); return true; }
    const trader = npcAt(nx, ny);
    if (trader) { openShop(trader); return true; }
    const m = monsterAt(nx, ny);
    if (m) { m.awake = true; log(`The ${MONSTERS[m.id].name} blocks your way.`); return false; }
    p.x = nx; p.y = ny; p.steps++;
    startCam(MOVE_MS);
    Sound.play('step');
    distFieldAt = -1e9;
    onStep();
    const eye = (p.cls === 'thief' ? 0.5 : 0) + (p.bg === 'tombwise' ? 0.35 : 0);
    if (eye > 0) for (const [dx, dy] of DIRS) if (tile(p.x + dx, p.y + dy) === T.SECRET && Math.random() < eye) revealSecret(p.x + dx, p.y + dy, true);
    checkTile();
    return true;
  }
  function turn(dd) {
    const p = P();
    p.dir = (p.dir + dd + 4) % 4;
    startCam(TURN_MS);
  }
  function openDoor(x, y) { setTile(x, y, T.DOOR_OPEN); log('You push the door open.'); Sound.play('door'); }
  function revealSecret(x, y, keenEyes) {
    setTile(x, y, T.DOOR_OPEN);
    log(keenEyes ? 'Your keen eyes spot a secret door!' : 'You find a secret door!', 'good');
    Sound.play('secret');
  }
  function drinkFountain(x, y) {
    const L = lvl(), p = P();
    const f = L.features && L.features[key(x, y)];
    if (!f || f.used) { log('The fountain is dry.'); return; }
    f.used = true;
    p.hp = p.maxHp; p.sp = p.maxSp; p.poison = null;
    fx.healUntil = realNow + 400;
    log('You drink deeply from the fountain. Your wounds close and your mind clears.', 'good');
    Sound.play('fountain');
    emit('stats');
  }
  function tryUnlock(x, y) {
    const L = lvl(), p = P();
    const color = L.locks[key(x, y)] || 'brass';
    const k = p.inv.find(it => it.t === 'key' && it.color === color);
    if (!k) {
      // a strong character can force a locked door, slowly and loudly
      const chance = 0.08 + mod(p.stats.str) * 0.05 + (p.cls === 'fighter' ? 0.1 : 0);
      if (Math.random() < Math.max(0.05, chance)) {
        setTile(x, y, T.DOOR_OPEN);
        delete L.locks[key(x, y)];
        log('You throw your shoulder against the door and it bursts open!', 'good');
        Sound.play('door');
        for (const m of L.monsters) if (Math.abs(m.x - x) + Math.abs(m.y - y) < 10) m.awake = true;
        return true;
      }
      log(`The door is locked. It needs a ${color} key. You fail to force it.`, 'bad');
      Sound.play('locked');
      p.nextAttack = G.t + 700; // forcing it costs you a moment
      return false;
    }
    removeOne(k);
    delete L.locks[key(x, y)];
    setTile(x, y, T.DOOR_OPEN);
    log(`You unlock the door with the ${color} key.`, 'good');
    Sound.play('door');
    emit('inv');
    return true;
  }
  function onStep() {
    const p = P();
    if (p.steps % 8 === 0) {
      p.food = Math.max(0, p.food - 1);
      if (p.food === 30) log('You are getting hungry.', 'bad');
      if (p.food === 10) log('You are very hungry!', 'bad');
    }
    if (p.food === 0 && p.steps % 6 === 0) hurtPlayer(1, 'You are starving!');
    if (p.maxSp && p.sp < p.maxSp && p.steps % 9 === 0) p.sp++;
  }
  function checkTile() {
    const L = lvl(), p = P(), k = key(p.x, p.y);
    if (L.traps[k]) triggerTrap(k);
    if (G.status !== 'playing') return;
    if (L.items[k] && L.items[k].length) pickupAll();
  }
  function triggerTrap(k) {
    const L = lvl(), p = P();
    const tr = TRAP_TYPES[L.traps[k]];
    delete L.traps[k];
    let spot = p.cls === 'thief' ? 0.5 + p.level * 0.04 : 0;
    if (p.bg === 'tombwise') spot += 0.35;
    if (spot > 0 && Math.random() < spot) {
      log(`You spot and disarm a ${tr.name}.`, 'good');
      return;
    }
    Sound.play('trap');
    if (tr.dmg) {
      const n = Math.max(1, d(...tr.dmg));
      hurtPlayer(n, `${tr.msg} You take ${n} damage.`);
    } else log(tr.msg, 'bad');
    if (tr.poison && !p.poison) { p.poison = { until: G.t + 20000, next: G.t + 2000 }; log('You are poisoned!', 'bad'); }
    if (tr.alarm) for (const m of L.monsters) m.awake = true;
  }

  // ---------- interaction ----------
  function use() {
    const p = P();
    const [dx, dy] = DIRS[p.dir];
    const tx = p.x + dx, ty = p.y + dy, t = tile(tx, ty);
    if (floorItems().length) { pickupAll(); return; }
    if (t === T.DOOR) return openDoor(tx, ty);
    if (t === T.DOOR_LOCKED) return tryUnlock(tx, ty);
    if (t === T.STAIRS_DOWN) return descend();
    if (t === T.STAIRS_UP) return ascend();
    if (t === T.SECRET) return revealSecret(tx, ty, false);
    if (t === T.FOUNTAIN) return drinkFountain(tx, ty);
    const ahead = npcAt(tx, ty);
    if (ahead) return openShop(ahead);
    if (monsterAt(tx, ty)) return attack();
    if (t === T.WALL) { log('You search the wall but find nothing.'); return; }
    if (t === T.DOOR_OPEN) {
      if (monsterAt(tx, ty) || (lvl().items[key(tx, ty)] || []).length) { log('Something is in the doorway.'); return; }
      setTile(tx, ty, T.DOOR); log('You pull the door shut.'); Sound.play('door'); return;
    }
    log('There is nothing to use here.');
  }

  // ---------- trading ----------
  // Prices key off the item's own value so the shelf stays sane at any depth.
  function buyPrice(shop, it) {
    const v = ITEMS[it.t].value || 5;
    return Math.max(2, Math.round(v * shop.markup * (1 + (it.e || 0) * 0.9)));
  }
  function sellPrice(it) {
    const v = ITEMS[it.t].value || 1;
    return Math.max(1, Math.round(v * 0.45 * (1 + (it.e || 0) * 0.8)));
  }
  let shop = null;
  function openShop(n) {
    shop = n;
    if (!n.greeted) {
      n.greeted = true;
      log('A hooded trader looks up from a lantern-lit pack. "Coin for goods, friend."', 'info');
    }
    Sound.play('gold');
    emit('shop');
    return true;
  }
  function currentShop() { return shop; }
  function closeShop() { shop = null; }
  function buy(it) {
    const p = P();
    if (!shop) return false;
    const price = buyPrice(shop, it);
    if (p.gold < price) { log('You cannot afford that.', 'bad'); Sound.play('error'); return false; }
    const one = { t: it.t, q: 1, e: it.e || 0 };
    if (!giveItem(one)) { log('Your pack is full.', 'bad'); Sound.play('error'); return false; }
    p.gold -= price;
    it.q--;
    if (it.q <= 0) {
      const at = shop.stock.indexOf(it);
      if (at >= 0) shop.stock.splice(at, 1);
    }
    G.known[one.t] = 1;   // the trader tells you what it is, so name it plainly
    log(`You buy the ${itemName(one)} for ${price} gold.`, 'good');
    Sound.play('gold');
    emit('inv'); emit('stats');
    return true;
  }
  function sell(it) {
    const p = P();
    if (!shop) return false;
    if (it.t === 'artifact') { log('The trader pales and refuses to touch it.', 'bad'); return false; }
    if (it.t === 'key') { log('"Keys are no use to me."'); return false; }
    const price = sellPrice(it);
    const one = removeOne(it);
    if (!one) { log('You are not carrying that.', 'bad'); return false; }
    p.gold += price;
    const ex = shop.stock.find(s => s.t === one.t && (s.e || 0) === (one.e || 0));
    if (ex) ex.q++; else shop.stock.push({ t: one.t, q: 1, e: one.e || 0 });
    log(`You sell the ${itemName(one)} for ${price} gold.`, 'good');
    Sound.play('gold');
    emit('inv'); emit('stats');
    return true;
  }

  // ---------- combat ----------
  function floatText(m, text, color) {
    fx.texts.push({ x: m.rx + 0.5, y: m.ry + 0.5, text: String(text), color, born: realNow, until: realNow + 750 });
  }
  function attack() {
    const p = P();
    if (G.t < p.nextAttack) return;
    const w = weapon();
    const [dx, dy] = DIRS[p.dir];
    let m = monsterAt(p.x + dx, p.y + dy);
    let atRange = false;
    // a missile weapon reaches the first foe down the corridor
    if (!m && w.range) {
      for (let i = 2; i <= w.range; i++) {
        const x = p.x + dx * i, y = p.y + dy * i;
        if (!passable(x, y)) break;
        const t = monsterAt(x, y);
        if (t) { m = t; atRange = true; break; }
      }
    }
    p.nextAttack = G.t + w.speed;
    fx.swingUntil = realNow + 160;
    if (!m) { Sound.play('miss'); return; }
    if (atRange) Sound.play('arrow');
    const mb = mstat(m);
    const sneak = p.cls === 'thief' && !atRange && (!m.awake || m.fleeing);
    m.awake = true;
    const roll = d(1, 20);
    const crit = roll >= critFloor();
    if (roll === 1 || (!crit && roll + toHit() < mb.ac)) {
      log(`You miss the ${mb.name}.`);
      Sound.play('miss');
      floatText(m, 'miss', '#bbb');
      return;
    }
    // Thieves strike where it counts rather than swinging hard, so their bonus
    // comes from dexterity and does not scale with the weight of the weapon.
    const finesse = p.cls === 'thief';
    const flat = (finesse ? mod(p.stats.dex) : mod(p.stats.str)) + skillDamage() + (effect('might') ? 2 : 0);
    const baseSpeed = p.eq.weapon ? ITEMS[p.eq.weapon.t].speed : 450;
    let dmg = d(...w.dmg) + w.e + Math.round(finesse ? flat : flat * (baseSpeed / 700));
    if (crit) dmg *= 2;
    if (sneak) dmg *= 2;
    dmg = Math.max(1, dmg);
    damageMonster(m, dmg, crit ? 'crit' : (sneak ? 'sneak' : null));
  }
  function damageMonster(m, dmg, tag) {
    const mb = mstat(m);
    m.hp -= dmg;
    m.awake = true;
    m.flashUntil = realNow + 130;
    floatText(m, dmg, tag === 'crit' ? '#ff4' : (tag === 'fire' ? '#f84' : '#fff'));
    Sound.play('hit');
    buzz(12);
    if (m.hp <= 0) { killMonster(m); return; }
    const pre = tag === 'crit' ? 'A mighty blow! ' : (tag === 'sneak' ? 'You strike from the shadows! ' : '');
    log(`${pre}You hit the ${mb.name} for ${dmg}.`);
    // wounded, non-boss monsters may break and run
    if (!mb.boss && m.hp <= m.maxHp * 0.25 && !m.fleeing && Math.random() < 0.3) {
      m.fleeing = true;
      log(`The ${mb.name} turns to flee!`, 'good');
    }
  }
  function killMonster(m) {
    const L = lvl(), p = P(), mb = mstat(m);
    const at = L.monsters.indexOf(m);
    if (at < 0) return;                    // already removed by something else
    L.monsters.splice(at, 1);
    p.kills++;
    p.xp += mb.xp;
    log(`The ${mb.name} is destroyed! (+${mb.xp} xp)`, 'good');
    if (mb.boss) log('The dread presence lifts. The Heart of the Mountain is unguarded.', 'good');
    // champions and bosses always drop something worthwhile
    if (Math.random() < 0.4 || mb.boss || m.elite) {
      const k = key(m.x, m.y);
      const loot = Dungeon.rollLoot(Dice, G.depth + (m.elite ? 2 : 0));
      (L.items[k] = L.items[k] || []).push(loot);
    }
    checkLevelUp();
    emit('stats');
  }
  function checkLevelUp() {
    const p = P();
    while (p.level < MAX_LEVEL && p.xp >= XP_TABLE[p.level]) {
      p.level++;
      const gain = Math.max(1, d(1, cls().hitDie) + mod(p.stats.con));
      p.maxHp += gain; p.hp += gain;
      p.maxSp = spMax(p); p.sp = p.maxSp;
      log(`You have reached level ${p.level}! (+${gain} hit points)`, 'good');
      Sound.play('levelup');
      const unlocked = knownSpells().filter(s => s.lvl * 2 - 1 === p.level);
      for (const s of unlocked) log(`You have learned ${s.name}.`, 'good');
      if (p.level % 3 === 0) offerBoons();   // a choice every third level
    }
  }
  // Three things experience could have taught you. You keep one.
  function offerBoons() {
    const p = P();
    const taken = p.boons || [];
    const pool = BOONS.filter(b => (!b.when || b.when(p)) && !(b.unique && taken.includes(b.id)));
    const picked = Dice.shuffle(pool.slice()).slice(0, 3).map(b => b.id);
    G.pendingBoons = (G.pendingBoons || []).concat([picked]);
    emit('boons');
  }
  function pendingBoons() { return G.pendingBoons && G.pendingBoons.length ? G.pendingBoons[0] : null; }
  function chooseBoon(id) {
    const offer = pendingBoons();
    if (!offer || !offer.includes(id)) return false;
    const boon = BOONS.find(b => b.id === id);
    if (!boon) return false;
    const p = P();
    boon.apply(p);
    p.maxSp = spMax(p);
    p.sp = Math.min(p.maxSp, p.sp);
    p.boons = (p.boons || []).concat(id);
    G.pendingBoons.shift();
    log(`${boon.name}. ${boon.desc}`, 'good');
    Sound.play('levelup');
    emit('stats');
    if (!pendingBoons()) emit('boonsDone');
    return true;
  }
  function hurtPlayer(dmg, msg) {
    const p = P();
    p.hp -= dmg;
    p.lastHurt = G.t;
    fx.damageUntil = realNow + 260;
    fx.shakeUntil = realNow + 220;
    Sound.play('hurt');
    buzz(40);
    if (msg) log(msg, 'bad');
    emit('stats');
    if (p.hp <= 0) die();
  }
  function healPlayer(n) {
    const p = P();
    p.hp = Math.min(p.maxHp, p.hp + n);
    fx.healUntil = realNow + 260;
    Sound.play('heal');
    emit('stats');
  }
  function die() {
    const p = P();
    p.hp = 0;
    G.status = 'dead';
    log(`${p.name} has died on level ${G.depth}.`, 'bad');
    Sound.play('die');
    if (G.opts.permadeath) { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } }
    recordHero(false);
    emit('dead');
  }
  // Lifting the Heart wakes the whole mountain. Now carry it back to the surface.
  function startEscape() {
    const p = P();
    p.inv.push({ t: 'artifact', q: 1, e: 0 });   // unique: never blocked by the pack limit
    G.escaping = true;
    G.escapeStart = G.t;
    G.nextHunt = G.t + 16000;
    G.hunts = 0;
    for (const dpt in G.levels) for (const m of G.levels[dpt].monsters) m.awake = true;
    log('You lift the Heart of the Mountain. Its light is warm in your hands.', 'good');
    log('The walls groan. Every dead thing in the mountain now knows where you are.', 'bad');
    log(`Climb back to level 1 and take the stairs out. You are ${G.depth} levels down.`, 'info');
    Sound.play('win');
    fx.shakeUntil = realNow + 900;
    emit('stats');
    emit('escape');
  }
  // While escaping, the dark keeps producing pursuers.
  function spawnHunter() {
    const L = lvl();
    if (L.monsters.length > 40) return;
    ensureDist();
    const cands = [];
    for (let i = 0; i < L.w * L.h; i++) {
      if (L.tiles[i] !== T.FLOOR) continue;
      const dd = distField[i];
      if (dd < 6 || dd > 15) continue;
      if (monsterAt(i % L.w, (i / L.w) | 0) || npcAt(i % L.w, (i / L.w) | 0)) continue;
      cands.push(i);
    }
    if (!cands.length) return;
    const i = Dice.pick(cands);
    const pool = ['skeleton', 'ghoul', 'zombie', 'wraith'];
    const id = pool[Math.min(pool.length - 1, Math.floor(G.hunts / 2))];
    const b = MONSTERS[id];
    const hp = Dice.dice(b.hp[0], b.hp[1], b.hp[2]);
    L.monsters.push({
      uid: 900000 + G.hunts * 17 + Math.floor(Math.random() * 1000), id, x: i % L.w, y: (i / L.w) | 0,
      hp, maxHp: hp, awake: true, nextAct: G.t + 500, rx: i % L.w, ry: (i / L.w) | 0,
      fromX: i % L.w, fromY: (i / L.w) | 0, moveT0: 0, moveT1: 0, flashUntil: 0,
    });
    G.hunts++;
    log(Dice.pick([
      'Something claws its way out of the dark behind you.',
      'Bone scrapes on stone. It is closer than before.',
      'The air turns cold. You are not alone in this corridor.',
    ]), 'bad');
    Sound.play('growl');
  }

  function win() {
    G.status = 'won';
    G.escapeMs = G.escaping ? G.t - G.escapeStart : 0;
    log('You climb into daylight with the Heart of the Mountain. You have escaped!', 'good');
    Sound.play('win');
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
    recordHero(true);
    emit('won');
  }
  function score(p, depth, won) { return p.gold + p.xp * 2 + p.deepest * 100 + (won ? 2000 : 0); }
  // How the story closes, in the voice of the life that brought you here.
  function epilogue(won) {
    const p = P();
    const bg = BACKGROUNDS[p.bg] || BACKGROUNDS.oathbroken;
    const read = G.journal ? G.journal.length : 0;
    const lines = [];
    if (won) {
      lines.push(`${p.name} came up out of the Deepdelve carrying the Heart of the Mountain, which is a sentence nobody in the valley has been able to write for three winters.`);
      lines.push(bg.epi);
      lines.push(read >= JOURNAL.length
        ? 'They also carried out every page the earlier crews left behind, so the valley will finally learn what became of them.'
        : `They left ${JOURNAL.length - read} of the earlier crews' pages down there in the dark. Someone else will have to go back for those.`);
    } else {
      lines.push(`${p.name} got as far as level ${p.deepest} of the Deepdelve, which is further than the fourth crew managed.`);
      lines.push(bg.epi);
      lines.push(read > 0
        ? `They were carrying ${read} of the earlier crews' pages when they fell. In time someone will find those too, along with a new name for the roster.`
        : 'They carried nothing out and left nothing behind but another name for the roster.');
    }
    return lines;
  }
  function recordHero(won) {
    const p = P();
    const entry = { name: p.name, cls: p.cls, level: p.level, depth: G.depth, gold: p.gold, xp: p.xp, kills: p.kills, won, seed: G.seed, date: Date.now(), score: score(p, G.depth, won) };
    try {
      const list = hall();
      list.push(entry);
      list.sort((a, b) => b.score - a.score);
      localStorage.setItem(HALL_KEY, JSON.stringify(list.slice(0, 20)));
    } catch (e) { /* ignore */ }
  }
  function hall() {
    try { return JSON.parse(localStorage.getItem(HALL_KEY) || '[]'); } catch (e) { return []; }
  }
  function boltTargets(range, pierce) {
    const p = P();
    const [dx, dy] = DIRS[p.dir];
    const out = [];
    for (let i = 1; i <= range; i++) {
      const x = p.x + dx * i, y = p.y + dy * i;
      if (!passable(x, y)) break;
      const m = monsterAt(x, y);
      if (m) { out.push(m); if (!pierce) break; }
    }
    return out;
  }
  function castSpell(sp) {
    const p = P();
    if (!spellAvailable(sp)) { log(`You are not experienced enough to cast ${sp.name}.`, 'bad'); return false; }
    if (p.sp < sp.cost) { log('Not enough spell points.', 'bad'); Sound.play('error'); return false; }
    p.sp -= sp.cost;
    G.lastSpell = sp.id;
    fx.castUntil = realNow + 260; fx.castColor = sp.color;
    Sound.play('spell');
    switch (sp.kind) {
      case 'heal': { const n = d(...sp.heal(p.level)); healPlayer(n); log(`You cast ${sp.name} and heal ${n}.`, 'good'); break; }
      case 'buff': p.effects[sp.stat] = { amount: sp.amount, until: G.t + sp.dur }; log(`You cast ${sp.name}. ${sp.desc}`, 'good'); break;
      case 'bolt': {
        const targets = boltTargets(sp.range, sp.pierce);
        if (!targets.length) { log(`Your ${sp.name} strikes nothing.`); break; }
        for (const m of targets) {
          let dmg = d(...sp.dmg(p.level));
          if (sp.holy && mstat(m).undead) dmg *= 2;
          damageMonster(m, dmg, 'fire');
        }
        break;
      }
    }
    emit('stats');
    return true;
  }
  function castLast() {
    const list = knownSpells();
    if (!list.length) { log('You know no spells. Scrolls can be read from your pack.'); return false; }
    const sp = list.find(s => s.id === G.lastSpell) || list[0];
    return castSpell(sp);
  }

  // ---------- resting ----------
  function rest() {
    const p = P(), L = lvl();
    ensureDist();
    const near = L.monsters.some(m => { const dd = distField[m.y * L.w + m.x]; return m.awake && dd >= 0 && dd <= 5; });
    if (near) { log("You can't rest with enemies nearby.", 'bad'); Sound.play('error'); return false; }
    if (p.hp >= p.maxHp && p.sp >= p.maxSp) { log('You are already well rested.'); return false; }
    if (p.food < 6) { log('You are too hungry to rest.', 'bad'); Sound.play('error'); return false; }
    p.food -= 6;
    p.hp = p.maxHp; p.sp = p.maxSp;
    G.t += 60000;
    for (const m of L.monsters) { for (let i = 0; i < 3; i++) if (!m.awake) wander(m); m.nextAct = G.t + 300; }
    log('You rest for a while and wake refreshed.', 'good');
    Sound.play('heal');
    emit('stats');
    return true;
  }

  // ---------- monsters ----------
  function computeDist() {
    const L = lvl(), p = P();
    const dist = new Int32Array(L.w * L.h).fill(-1);
    const q = [p.y * L.w + p.x];
    dist[q[0]] = 0;
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi], x = i % L.w, y = (i / L.w) | 0;
      if (dist[i] > 20) break;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= L.w || ny >= L.h) continue;
        const ni = ny * L.w + nx;
        if (dist[ni] >= 0) continue;
        const t = L.tiles[ni];
        if (t !== T.FLOOR && t !== T.DOOR_OPEN && t !== T.DOOR) continue;
        dist[ni] = dist[i] + 1;
        q.push(ni);
      }
    }
    return dist;
  }
  function ensureDist() {
    if (!distField || G.t - distFieldAt > 250) { distField = computeDist(); distFieldAt = G.t; }
  }
  function moveMonster(m, nx, ny) {
    m.fromX = m.x; m.fromY = m.y;
    m.x = nx; m.y = ny;
    m.moveT0 = realNow;
    m.moveT1 = realNow + Math.max(200, Math.round(MONSTERS[m.id].speed * 0.45));
  }
  function wander(m) {
    const p = P();
    const opts = [];
    for (const [dx, dy] of DIRS) {
      const nx = m.x + dx, ny = m.y + dy;
      if (passable(nx, ny) && !monsterAt(nx, ny) && !npcAt(nx, ny) && !(nx === p.x && ny === p.y)) opts.push([nx, ny]);
    }
    if (opts.length) { const o = Dice.pick(opts); moveMonster(m, o[0], o[1]); }
  }
  // A straight, unobstructed line from the monster to the player within range.
  function hasLineToPlayer(m, range) {
    const p = P();
    if (m.x !== p.x && m.y !== p.y) return null;
    const dx = Math.sign(p.x - m.x), dy = Math.sign(p.y - m.y);
    const dist = Math.abs(p.x - m.x) + Math.abs(p.y - m.y);
    if (dist > range || dist < 2) return null;
    for (let i = 1; i < dist; i++) {
      const x = m.x + dx * i, y = m.y + dy * i;
      if (!passable(x, y) || monsterAt(x, y)) return null;
    }
    return dist;
  }
  function rangedAttack(m) {
    const mb = mstat(m), r = mb.ranged;
    const roll = d(1, 20);
    Sound.play('arrow');
    if (roll === 1 || (roll !== 20 && roll + mb.hit < playerAC())) { log(`The ${mb.name} ${r.verb} you and misses.`); return; }
    let dmg = Math.max(1, d(...r.dmg));
    if (roll === 20) dmg *= 2;
    hurtPlayer(dmg, `The ${mb.name} ${r.verb} you for ${dmg}.`);
  }
  function monsterAttack(m) {
    const p = P(), mb = mstat(m);
    const roll = d(1, 20);
    if (roll === 1 || (roll !== 20 && roll + mb.hit < playerAC())) { log(`The ${mb.name} misses you.`); return; }
    let dmg = Math.max(1, d(...mb.dmg));
    if (roll === 20) dmg *= 2;
    hurtPlayer(dmg, `The ${mb.name} hits you for ${dmg}.`);
    if (G.status !== 'playing') return;
    if (mb.poison && !p.poison && Math.random() < mb.poison) { p.poison = { until: G.t + 20000, next: G.t + 2000 }; log('You are poisoned!', 'bad'); }
    if (mb.drain && Math.random() < 0.25) { p.maxHp = Math.max(10, p.maxHp - 2); p.hp = Math.min(p.hp, p.maxHp); log('You feel your life force drain away!', 'bad'); }
  }
  function updateMonsters() {
    const L = lvl(), p = P();
    ensureDist();
    for (const m of L.monsters.slice()) {
      const mb = mstat(m);
      if (mb.regen && m.hp < m.maxHp && G.t >= (m.nextRegen || 0)) { m.hp = Math.min(m.maxHp, m.hp + mb.regen); m.nextRegen = G.t + 1000; }
      if (G.t < m.nextAct) continue;
      const di = distField[m.y * L.w + m.x];
      if (!m.awake) {
        const notice = P().bg === 'deepborn' ? 4 : 6;
        if (di >= 0 && di <= notice) { m.awake = true; Sound.play('growl'); }
        else { if (Math.random() < 0.25) wander(m); m.nextAct = G.t + mb.speed * 1.5; continue; }
      }
      if (di < 0 || di > 12) {
        // it has lost you; after a while it stops hunting and settles again
        if (!m.lostAt) m.lostAt = G.t;
        else if (G.t - m.lostAt > 7000 && !G.escaping) { m.awake = false; m.lostAt = 0; }
        if (Math.random() < 0.3) wander(m);
        m.nextAct = G.t + mb.speed * 1.5;
        continue;
      }
      m.lostAt = 0;
      if (m.fleeing) {
        // run for the darkness; recover nerve once far enough away
        if (di > 8) { m.fleeing = false; m.nextAct = G.t + mb.speed; continue; }
        let away = null, ad = di;
        for (const [dx, dy] of DIRS) {
          const nx = m.x + dx, ny = m.y + dy;
          if (nx < 0 || ny < 0 || nx >= L.w || ny >= L.h) continue;
          const dd = distField[ny * L.w + nx];
          if (dd > ad && !monsterAt(nx, ny)) { ad = dd; away = [nx, ny]; }
        }
        if (away) { moveMonster(m, away[0], away[1]); m.nextAct = G.t + mb.speed; continue; }
        m.fleeing = false; // cornered: fight on
      }
      if (Math.abs(m.x - p.x) + Math.abs(m.y - p.y) === 1) { monsterAttack(m); m.nextAct = G.t + mb.speed; if (G.status !== 'playing') return; continue; }
      if (mb.ranged && hasLineToPlayer(m, mb.ranged.range)) { rangedAttack(m); m.nextAct = G.t + mb.speed * 1.3; if (G.status !== 'playing') return; continue; }
      let best = null, bd = di;
      for (const [dx, dy] of DIRS) {
        const nx = m.x + dx, ny = m.y + dy;
        if (nx < 0 || ny < 0 || nx >= L.w || ny >= L.h) continue;
        const dd = distField[ny * L.w + nx];
        if (dd >= 0 && dd < bd && !monsterAt(nx, ny) && !npcAt(nx, ny) && !(nx === p.x && ny === p.y)) { bd = dd; best = [nx, ny]; }
      }
      const moveSpeed = Math.max(300, Math.round(mb.speed * 0.45));
      if (best) {
        if (tile(best[0], best[1]) === T.DOOR) { setTile(best[0], best[1], T.DOOR_OPEN); log('Something opens a door nearby.', 'bad'); Sound.play('door'); }
        else moveMonster(m, best[0], best[1]);
        m.nextAct = G.t + moveSpeed;
      } else m.nextAct = G.t + mb.speed;
    }
  }

  // ---------- main update ----------
  function update(now, dt) {
    realNow = now;
    if (!G || G.status !== 'playing') return;
    G.t += dt;
    const p = P();
    updateCam();
    updateMonsters();
    if (G.status !== 'playing') return;
    // out of combat and unpursued, wounds close slowly on their own
    if (p.hp < p.maxHp && p.food > 0 && G.t - (p.lastHurt || 0) > 5000 && G.t >= (p.nextRegen || 0)) {
      ensureDist();
      const L = lvl();
      const hunted = L.monsters.some(m => m.awake && distField[m.y * L.w + m.x] >= 0 && distField[m.y * L.w + m.x] <= 6);
      if (!hunted) {
        // scale with the pool so recovery takes about the same time at every level
        const hardy = (p.cls === 'fighter' ? 1.6 : 1) + (p.perkRegen || 0);
        p.hp = Math.min(p.maxHp, p.hp + Math.max(1, Math.round(p.maxHp / 35 * hardy)));
        p.nextRegen = G.t + (p.cls === 'fighter' ? 1900 : 2200);
        emit('stats');
      } else p.nextRegen = G.t + 1200;
    }
    if (p.poison) {
      if (G.t >= p.poison.until) { p.poison = null; log('The poison wears off.', 'good'); }
      else if (G.t >= p.poison.next) { p.poison.next = G.t + 2000; hurtPlayer(1, 'The poison burns in your veins.'); }
    }
    if (G.escaping && G.t >= G.nextHunt) {
      spawnHunter();
      G.nextHunt = G.t + Math.max(9000, 22000 - G.hunts * 900);
    }
    for (const k in p.effects) if (p.effects[k].until <= G.t) { delete p.effects[k]; log(k === 'ac' ? 'Your magical protection fades.' : (k === 'hit' ? 'The blessing fades.' : 'You feel less mighty.')); }
    fx.texts = fx.texts.filter(t => t.until > now);
  }
  function tick(now) { realNow = now; }

  function input(act) {
    if (!G || G.status !== 'playing') return;
    switch (act) {
      case 'forward': case 'back': case 'strafeL': case 'strafeR': case 'left': case 'right':
        if (cam.moving && camProgress() < 0.7) return;
        if (act === 'forward') tryMove(0);
        else if (act === 'back') tryMove(2);
        else if (act === 'strafeR') tryMove(1);
        else if (act === 'strafeL') tryMove(3);
        else if (act === 'left') turn(-1);
        else turn(1);
        break;
      case 'attack': attack(); break;
      case 'use': use(); break;
      case 'cast': castLast(); break;
      case 'rest': rest(); break;
    }
  }

  // ---------- render state ----------
  function renderState(now) {
    const L = lvl();
    const sprites = [];
    for (const m of L.monsters) {
      if (m.moveT1 > now) {
        const t = (now - m.moveT0) / (m.moveT1 - m.moveT0);
        m.rx = m.fromX + (m.x - m.fromX) * t; m.ry = m.fromY + (m.y - m.fromY) * t;
      } else { m.rx = m.x; m.ry = m.y; }
      const mb = MONSTERS[m.id];
      const bob = mb.fly ? Math.sin(now / 250 + m.uid) * 0.05 : 0;
      const base = Assets.sprites[mb.sprite];
      const img = (m.elite && base.elite && base.elite[m.elite]) ? base.elite[m.elite] : base;
      sprites.push({ x: m.rx + 0.5, y: m.ry + 0.5, img, scale: mb.scale, yOff: (mb.fly || 0) + bob, flash: m.flashUntil, hp: m.hp, maxHp: m.maxHp });
    }
    for (const n of (L.npcs || [])) {
      sprites.push({ x: n.x + 0.5, y: n.y + 0.5, img: Assets.sprites.merchant, scale: 0.95, yOff: 0 });
    }
    for (const k in L.items) {
      const list = L.items[k];
      if (!list.length) continue;
      const [x, y] = k.split(',').map(Number);
      const it = list[list.length - 1];
      sprites.push({ x: x + 0.5, y: y + 0.5, img: Assets.sprites[spriteFor(it)], scale: it.t === 'artifact' ? 0.5 : 0.32, yOff: it.t === 'artifact' ? 0.1 + Math.sin(now / 300) * 0.03 : 0 });
    }
    return { level: L, cam, sprites, fx };
  }

  // ---------- save / load ----------
  function save(auto) {
    if (!G || G.status !== 'playing') return false;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(G));
      if (!auto) log('Game saved.', 'info');
      return true;
    } catch (e) {
      log('Could not save: ' + e.message, 'bad');
      return false;
    }
  }
  function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
  function load() {
    let s = null;
    try { s = localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
    if (!s) return false;
    try {
      const data = JSON.parse(s);
      if (!data || !data.player || !data.levels) return false;
      G = data;
      G.status = 'playing';
      for (const dpt in G.levels) {
        if (!G.levels[dpt].features) G.levels[dpt].features = {};
        if (!G.levels[dpt].lights) G.levels[dpt].lights = [];
        if (!G.levels[dpt].npcs) G.levels[dpt].npcs = [];
      }
      if (!G.escaping) { G.escaping = false; G.escapeStart = 0; G.nextHunt = G.t + 16000; G.hunts = G.hunts || 0; }
      if (!G.journal) G.journal = [];
      if (!G.pendingBoons) G.pendingBoons = [];
      if (!G.player.bg) G.player.bg = 'oathbroken';
      if (!G.looks) G.looks = buildLooks(G.seed);
      if (!G.known) { G.known = {}; for (const id in ITEMS) G.known[id] = 1; }
      for (const dpt in G.levels) for (const m of G.levels[dpt].monsters) { m.nextAct = G.t + 800; m.rx = m.x; m.ry = m.y; m.moveT1 = 0; m.flashUntil = 0; }
      snapCam();
      distFieldAt = -1e9;
      fx.texts = [];
      log('Game loaded.', 'info');
      emit('level');
      return true;
    } catch (e) { return false; }
  }
  function saveSummary() {
    try {
      const s = localStorage.getItem(SAVE_KEY);
      if (!s) return null;
      const g = JSON.parse(s);
      return { name: g.player.name, cls: CLASSES[g.player.cls].name, level: g.player.level, depth: g.depth, seed: g.seed };
    } catch (e) { return null; }
  }

  return {
    newGame, load, save, hasSave, saveSummary, rollStats, hall,
    update, tick, input, renderState, takeEvents,
    state: () => G, player: P, level: lvl, log, mod,
    itemName, spriteFor, equip, unequip, useItem, dropItem, takeItem, floorItems, canEquip, isKnown, mstat,
    currentShop, closeShop, buy, sell, buyPrice, sellPrice,
    pendingBoons, chooseBoon, epilogue, journal: () => (G && G.journal) || [],
    knownSpells, spellAvailable, castSpell, rest, toHit, playerAC, weapon, effect, skillDamage, isEscaping: () => !!(G && G.escaping),
    INV_MAX, T,
  };
})();

export { Game };
