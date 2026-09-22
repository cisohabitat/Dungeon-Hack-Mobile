'use strict';
// Core game state and rules.

const Game = (() => {
  const T = Dungeon.T;
  const DIRS = Dungeon.DIRS;
  const INV_MAX = 20;
  const SAVE_KEY = 'deepdelve.save';
  const MOVE_MS = 220;
  const TURN_MS = 200;

  let G = null;
  let distField = null, distFieldAt = -1e9;
  let realNow = 0;
  const fx = { damageUntil: 0, healUntil: 0, swingUntil: 0, castUntil: 0, castColor: '#fff', texts: [] };
  const cam = { x: 0, y: 0, angle: 0, fromX: 0, fromY: 0, fromA: 0, toX: 0, toY: 0, toA: 0, t0: 0, t1: 0, moving: false };
  const events = []; // messages for the UI layer: 'dead', 'won', 'level', 'inv', 'stats'

  const mod = s => Math.floor((s - 10) / 2);
  const key = (x, y) => x + ',' + y;
  const lvl = () => G.levels[G.depth];
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
    return Math.max(2, p.level * (2 + mod(stat))) + 2;
  }
  function weapon() {
    const p = P();
    if (!p.eq.weapon) return { name: 'fists', dmg: [1, 2, 0], speed: 450, e: 0 };
    const b = ITEMS[p.eq.weapon.t];
    return { name: b.name, dmg: b.dmg, speed: b.speed, e: p.eq.weapon.e || 0, twoHanded: !!b.twoHanded };
  }
  function effect(name) {
    const e = P().effects[name];
    return e && e.until > G.t ? e.amount : 0;
  }
  function toHit() {
    const p = P();
    return Math.floor(p.level * cls().hitProg) + mod(p.stats.str) + effect('hit') + weapon().e + (effect('might') ? 2 : 0);
  }
  function playerAC() {
    const p = P();
    let ac = 10 + mod(p.stats.dex) + effect('ac');
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

  // ---------- items ----------
  function itemName(it) {
    if (it.t === 'key') return `${it.color[0].toUpperCase() + it.color.slice(1)} Key`;
    if (it.t === 'gem') return it.name || 'Gem';
    const b = ITEMS[it.t];
    let n = b.name;
    if (it.e) n += ` +${it.e}`;
    if (it.q > 1) n += ` ×${it.q}`;
    return n;
  }
  function spriteFor(it) {
    if (it.t === 'key') return 'key_' + it.color;
    return ITEMS[it.t].sprite;
  }
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
  function removeOne(it) {
    const p = P();
    if (it.q > 1) { it.q--; return { t: it.t, q: 1, e: it.e, color: it.color, name: it.name }; }
    const i = p.inv.indexOf(it);
    if (i >= 0) p.inv.splice(i, 1);
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
    if (b.kind === 'food') {
      removeOne(it);
      p.food = Math.min(100, p.food + b.food);
      log(`You eat the ${b.name.toLowerCase()}. ${p.food >= 90 ? 'You are full.' : 'That was good.'}`, 'good');
      Sound.play('eat');
    } else if (b.kind === 'potion') {
      removeOne(it);
      switch (b.effect) {
        case 'heal': { const n = d(...b.heal); healPlayer(n); log(`You drink the potion and heal ${n}.`, 'good'); break; }
        case 'cure': p.poison = null; log('The poison leaves your veins.', 'good'); Sound.play('heal'); break;
        case 'might': p.effects.might = { amount: 2, until: G.t + 120000 }; log('You feel mighty!', 'good'); Sound.play('spell'); break;
        case 'mana': if (p.maxSp) { p.sp = p.maxSp; log('Your mind clears. Spell points restored.', 'good'); } else log('Your thoughts feel unusually sharp, but nothing else happens.'); Sound.play('spell'); break;
      }
    } else if (b.kind === 'scroll') {
      removeOne(it);
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
    } else {
      log('You cannot use that.');
      return;
    }
    emit('inv');
  }
  function dropItem(it) {
    const p = P(), L = lvl();
    const one = removeOne(it);
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
    else if (it.t === 'artifact') { list.splice(i, 1); win(); }
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
  function newGame(cfg) {
    const c = CLASSES[cfg.cls];
    const p = {
      name: (cfg.name || '').trim() || 'Adventurer', cls: cfg.cls, stats: cfg.stats, level: 1, xp: 0,
      maxHp: 0, hp: 0, maxSp: 0, sp: 0, food: 100, gold: 0,
      inv: [], eq: { weapon: null, armor: null, shield: null }, effects: {}, poison: null,
      x: 0, y: 0, dir: 0, nextAttack: 0, kills: 0, steps: 0, deepest: 1,
    };
    p.maxHp = Math.max(4, c.hitDie + mod(p.stats.con));
    p.hp = p.maxHp;
    p.maxSp = spMax(p); p.sp = p.maxSp;
    G = { seed: cfg.seed, opts: cfg.opts, player: p, levels: {}, depth: 1, log: [], t: 0, status: 'playing', lastSpell: null, created: Date.now(), version: 1 };
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
    if (G.depth === 1) { log('The way out is sealed behind you. Only the depths remain.', 'info'); return; }
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
    const m = monsterAt(nx, ny);
    if (m) { m.awake = true; log(`The ${MONSTERS[m.id].name} blocks your way.`); return false; }
    p.x = nx; p.y = ny; p.steps++;
    startCam(MOVE_MS);
    distFieldAt = -1e9;
    onStep();
    checkTile();
    return true;
  }
  function turn(dd) {
    const p = P();
    p.dir = (p.dir + dd + 4) % 4;
    startCam(TURN_MS);
  }
  function openDoor(x, y) { setTile(x, y, T.DOOR_OPEN); log('You push the door open.'); Sound.play('door'); }
  function tryUnlock(x, y) {
    const L = lvl(), p = P();
    const color = L.locks[key(x, y)] || 'brass';
    const k = p.inv.find(it => it.t === 'key' && it.color === color);
    if (!k) { log(`The door is locked. It needs a ${color} key.`, 'bad'); Sound.play('locked'); return false; }
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
    if (p.maxSp && p.sp < p.maxSp && p.steps % 15 === 0) p.sp++;
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
    if (p.cls === 'thief' && Math.random() < 0.5 + p.level * 0.04) {
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
    if (monsterAt(tx, ty)) return attack();
    if (t === T.DOOR_OPEN) {
      if (monsterAt(tx, ty) || (lvl().items[key(tx, ty)] || []).length) { log('Something is in the doorway.'); return; }
      setTile(tx, ty, T.DOOR); log('You pull the door shut.'); Sound.play('door'); return;
    }
    log('There is nothing to use here.');
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
    const m = monsterAt(p.x + dx, p.y + dy);
    p.nextAttack = G.t + w.speed;
    fx.swingUntil = realNow + 160;
    if (!m) { Sound.play('miss'); return; }
    const mb = MONSTERS[m.id];
    const sneak = p.cls === 'thief' && !m.awake;
    m.awake = true;
    const roll = d(1, 20);
    if (roll === 1 || (roll !== 20 && roll + toHit() < mb.ac)) {
      log(`You miss the ${mb.name}.`);
      Sound.play('miss');
      floatText(m, 'miss', '#bbb');
      return;
    }
    let dmg = d(...w.dmg) + w.e + mod(p.stats.str) + (effect('might') ? 2 : 0);
    if (roll === 20) dmg *= 2;
    if (sneak) dmg *= 2;
    dmg = Math.max(1, dmg);
    damageMonster(m, dmg, roll === 20 ? 'crit' : (sneak ? 'sneak' : null));
  }
  function damageMonster(m, dmg, tag) {
    const mb = MONSTERS[m.id];
    m.hp -= dmg;
    m.awake = true;
    m.flashUntil = realNow + 130;
    floatText(m, dmg, tag === 'crit' ? '#ff4' : (tag === 'fire' ? '#f84' : '#fff'));
    Sound.play('hit');
    if (m.hp <= 0) { killMonster(m); return; }
    const pre = tag === 'crit' ? 'A mighty blow! ' : (tag === 'sneak' ? 'You strike from the shadows! ' : '');
    log(`${pre}You hit the ${mb.name} for ${dmg}.`);
  }
  function killMonster(m) {
    const L = lvl(), p = P(), mb = MONSTERS[m.id];
    L.monsters.splice(L.monsters.indexOf(m), 1);
    p.kills++;
    p.xp += mb.xp;
    log(`The ${mb.name} is destroyed! (+${mb.xp} xp)`, 'good');
    if (mb.boss) log('The dread presence lifts. The Heart of the Mountain is unguarded.', 'good');
    if (Math.random() < 0.4 || mb.boss) {
      const k = key(m.x, m.y);
      const loot = Dungeon.rollLoot(Dice, G.depth);
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
    }
  }
  function hurtPlayer(dmg, msg) {
    const p = P();
    p.hp -= dmg;
    fx.damageUntil = realNow + 260;
    Sound.play('hurt');
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
    emit('dead');
  }
  function win() {
    G.status = 'won';
    log('You lift the Heart of the Mountain. Its light fills the halls. You have won!', 'good');
    Sound.play('win');
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
    emit('won');
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
          if (sp.holy && MONSTERS[m.id].undead) dmg *= 2;
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
    const near = L.monsters.some(m => { const dd = distField[m.y * L.w + m.x]; return m.awake && dd >= 0 && dd <= 8; });
    if (near) { log("You can't rest with enemies nearby.", 'bad'); Sound.play('error'); return false; }
    if (p.hp >= p.maxHp && p.sp >= p.maxSp) { log('You are already well rested.'); return false; }
    if (p.food < 10) { log('You are too hungry to rest.', 'bad'); Sound.play('error'); return false; }
    p.food -= 10;
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
    m.moveT0 = realNow; m.moveT1 = realNow + 260;
  }
  function wander(m) {
    const p = P();
    const opts = [];
    for (const [dx, dy] of DIRS) {
      const nx = m.x + dx, ny = m.y + dy;
      if (passable(nx, ny) && !monsterAt(nx, ny) && !(nx === p.x && ny === p.y)) opts.push([nx, ny]);
    }
    if (opts.length) { const o = Dice.pick(opts); moveMonster(m, o[0], o[1]); }
  }
  function monsterAttack(m) {
    const p = P(), mb = MONSTERS[m.id];
    const roll = d(1, 20);
    if (roll === 1 || (roll !== 20 && roll + mb.hit < playerAC())) { log(`The ${mb.name} misses you.`); return; }
    let dmg = Math.max(1, d(...mb.dmg));
    if (roll === 20) dmg *= 2;
    hurtPlayer(dmg, `The ${mb.name} hits you for ${dmg}.`);
    if (G.status !== 'playing') return;
    if (mb.poison && !p.poison && Math.random() < mb.poison) { p.poison = { until: G.t + 20000, next: G.t + 2000 }; log('You are poisoned!', 'bad'); }
    if (mb.drain) { p.maxHp = Math.max(5, p.maxHp - 2); p.hp = Math.min(p.hp, p.maxHp); log('You feel your life force drain away!', 'bad'); }
  }
  function updateMonsters() {
    const L = lvl(), p = P();
    ensureDist();
    for (const m of L.monsters.slice()) {
      const mb = MONSTERS[m.id];
      if (mb.regen && m.hp < m.maxHp && G.t >= (m.nextRegen || 0)) { m.hp = Math.min(m.maxHp, m.hp + mb.regen); m.nextRegen = G.t + 1000; }
      if (G.t < m.nextAct) continue;
      const di = distField[m.y * L.w + m.x];
      if (!m.awake) {
        if (di >= 0 && di <= 6) { m.awake = true; }
        else { if (Math.random() < 0.25) wander(m); m.nextAct = G.t + mb.speed * 1.5; continue; }
      }
      if (di < 0 || di > 16) { if (Math.random() < 0.3) wander(m); m.nextAct = G.t + mb.speed * 1.5; continue; }
      if (Math.abs(m.x - p.x) + Math.abs(m.y - p.y) === 1) { monsterAttack(m); m.nextAct = G.t + mb.speed; if (G.status !== 'playing') return; continue; }
      let best = null, bd = di;
      for (const [dx, dy] of DIRS) {
        const nx = m.x + dx, ny = m.y + dy;
        if (nx < 0 || ny < 0 || nx >= L.w || ny >= L.h) continue;
        const dd = distField[ny * L.w + nx];
        if (dd >= 0 && dd < bd && !monsterAt(nx, ny) && !(nx === p.x && ny === p.y)) { bd = dd; best = [nx, ny]; }
      }
      if (best) {
        if (tile(best[0], best[1]) === T.DOOR) { setTile(best[0], best[1], T.DOOR_OPEN); log('Something opens a door nearby.', 'bad'); Sound.play('door'); }
        else moveMonster(m, best[0], best[1]);
      }
      m.nextAct = G.t + mb.speed;
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
    if (p.poison) {
      if (G.t >= p.poison.until) { p.poison = null; log('The poison wears off.', 'good'); }
      else if (G.t >= p.poison.next) { p.poison.next = G.t + 2000; hurtPlayer(1, 'The poison burns in your veins.'); }
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
      sprites.push({ x: m.rx + 0.5, y: m.ry + 0.5, img: Assets.sprites[mb.sprite], scale: mb.scale, yOff: (mb.fly || 0) + bob, flash: m.flashUntil });
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
    newGame, load, save, hasSave, saveSummary, rollStats,
    update, tick, input, renderState, takeEvents,
    state: () => G, player: P, level: lvl, log, mod,
    itemName, spriteFor, equip, unequip, useItem, dropItem, takeItem, floorItems, canEquip,
    knownSpells, spellAvailable, castSpell, rest, toHit, playerAC, weapon, effect,
    INV_MAX, T,
  };
})();
