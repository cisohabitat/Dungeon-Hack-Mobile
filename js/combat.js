// Combat: the hero's blows and a monster's on the hero, and the rules for groups
// sharing a square, packs and how a fight's damage is counted. What it borrows
// from the game comes through K, read live.
import { BOONS, CAPSTONE_LEVEL, ITEMS, MAX_LEVEL, MONSTERS, PATHS, PATH_LEVEL, RENOWN, RENOWN_XP, TALENTS, XP_TABLE } from './data.js';
import { Dungeon } from './dungeon.js';
import { Progress } from './progress.js';
import { RELICS } from './relics.js';
import { Dice, d } from './rng.js';
import { Sound } from './sound.js';

/** @param {any} K */
export function makeCombat(K) {
  // (GORE, GORE_OF and BITS_MAX are read from K where used: scenes.js, wired after this, holds them)
  const CORPSE_MS = K.CORPSE_MS;
  const DIRS = K.DIRS;
  const DUAL_HIT_PENALTY = K.DUAL_HIT_PENALTY;
  const JEWEL_SLOTS = K.JEWEL_SLOTS;
  const OFF_BALANCE = K.OFF_BALANCE;
  const QUICK = K.QUICK;
  const RISE_MS = K.RISE_MS;
  const SAVE_KEY = K.SAVE_KEY;
  const SELF_TAUGHT_MOST = K.SELF_TAUGHT_MOST;
  const STAT_WORD = K.STAT_WORD;
  const aids = K.aids;
  const bossFalls = K.bossFalls;
  const bounty = K.bounty;
  const breaksBones = K.breaksBones;
  const companion = K.companion;
  const deepMagic = K.deepMagic;
  const deepSteel = K.deepSteel;
  const elements = K.elements;
  const fx = K.fx;
  const isQuick = K.isQuick;
  const learn = K.learn;
  const meet = K.meet;
  const moveOnHurt = K.moveOnHurt;
  const namedFalls = K.namedFalls;
  const noteDealt = K.noteDealt;
  const noteHealed = K.noteHealed;
  const noteKill = K.noteKill;
  const noteRun = K.noteRun;
  const noteTaken = K.noteTaken;
  const pathOf = K.pathOf;
  const rangerAim = K.rangerAim;
  const recordHero = K.recordHero;
  const spellFx = K.spellFx;
  const sporesOn = K.sporesOn;
  const spring = K.spring;
  const surface = K.surface;
  const wardenHold = K.wardenHold;
  const wild = K.wild;
  const P = (/** @type {any[]} */ ...a) => K.P(...a);
  const armStat = (/** @type {any[]} */ ...a) => K.armStat(...a);
  const baneDamage = (/** @type {any[]} */ ...a) => K.baneDamage(...a);
  const bargained = (/** @type {any[]} */ ...a) => K.bargained(...a);
  const berserkerRage = (/** @type {any[]} */ ...a) => K.berserkerRage(...a);
  const blocked = (/** @type {any[]} */ ...a) => K.blocked(...a);
  const buzz = (/** @type {any[]} */ ...a) => K.buzz(...a);
  const cap = (/** @type {any[]} */ ...a) => K.cap(...a);
  const capped = (/** @type {any[]} */ ...a) => K.capped(...a);
  const cls = (/** @type {any[]} */ ...a) => K.cls(...a);
  const coatDamage = (/** @type {any[]} */ ...a) => K.coatDamage(...a);
  const coatLanded = (/** @type {any[]} */ ...a) => K.coatLanded(...a);
  const critFloor = (/** @type {any[]} */ ...a) => K.critFloor(...a);
  const dawnBlow = (/** @type {any[]} */ ...a) => K.dawnBlow(...a);
  const effect = (/** @type {any[]} */ ...a) => K.effect(...a);
  const effectFrom = (/** @type {any[]} */ ...a) => K.effectFrom(...a);
  const emit = (/** @type {any[]} */ ...a) => K.emit(...a);
  const hasPower = (/** @type {any[]} */ ...a) => K.hasPower(...a);
  const hasTalent = (/** @type {any[]} */ ...a) => K.hasTalent(...a);
  const heldWhy = (/** @type {any[]} */ ...a) => K.heldWhy(...a);
  const heroTitle = (/** @type {any[]} */ ...a) => K.heroTitle(...a);
  const jewelBonus = (/** @type {any[]} */ ...a) => K.jewelBonus(...a);
  const jewelPowers = (/** @type {any[]} */ ...a) => K.jewelPowers(...a);
  const key = (/** @type {any[]} */ ...a) => K.key(...a);
  const killerPhrase = (/** @type {any[]} */ ...a) => K.killerPhrase(...a);
  const kindles = (/** @type {any[]} */ ...a) => K.kindles(...a);
  const knownSpells = (/** @type {any[]} */ ...a) => K.knownSpells(...a);
  const leech = (/** @type {any[]} */ ...a) => K.leech(...a);
  const log = (/** @type {any[]} */ ...a) => K.log(...a);
  const look = (/** @type {any[]} */ ...a) => K.look(...a);
  const lvl = (/** @type {any[]} */ ...a) => K.lvl(...a);
  const mod = (/** @type {any[]} */ ...a) => K.mod(...a);
  const monsterAt = (/** @type {any[]} */ ...a) => K.monsterAt(...a);
  const mstat = (/** @type {any[]} */ ...a) => K.mstat(...a);
  const offhandWeapon = (/** @type {any[]} */ ...a) => K.offhandWeapon(...a);
  const onPath = (/** @type {any[]} */ ...a) => K.onPath(...a);
  const passable = (/** @type {any[]} */ ...a) => K.passable(...a);
  const propAt = (/** @type {any[]} */ ...a) => K.propAt(...a);
  const refreshSp = (/** @type {any[]} */ ...a) => K.refreshSp(...a);
  const relicItem = (/** @type {any[]} */ ...a) => K.relicItem(...a);
  const rollNote = (/** @type {any[]} */ ...a) => K.rollNote(...a);
  const runKey = (/** @type {any[]} */ ...a) => K.runKey(...a);
  const setBurning = (/** @type {any[]} */ ...a) => K.setBurning(...a);
  const shadeFalls = (/** @type {any[]} */ ...a) => K.shadeFalls(...a);
  const skillDamage = (/** @type {any[]} */ ...a) => K.skillDamage(...a);
  const smash = (/** @type {any[]} */ ...a) => K.smash(...a);
  const snaresSlack = (/** @type {any[]} */ ...a) => K.snaresSlack(...a);
  const sneakMult = (/** @type {any[]} */ ...a) => K.sneakMult(...a);
  const soon = (/** @type {any[]} */ ...a) => K.soon(...a);
  const spMax = (/** @type {any[]} */ ...a) => K.spMax(...a);
  const sparks = (/** @type {any[]} */ ...a) => K.sparks(...a);
  const spellAvailable = (/** @type {any[]} */ ...a) => K.spellAvailable(...a);
  const spellLevel = (/** @type {any[]} */ ...a) => K.spellLevel(...a);
  const spray = (/** @type {any[]} */ ...a) => K.spray(...a);
  const templarBlow = (/** @type {any[]} */ ...a) => K.templarBlow(...a);
  const the = (/** @type {any[]} */ ...a) => K.the(...a);
  const toHit = (/** @type {any[]} */ ...a) => K.toHit(...a);
  const venomTakes = (/** @type {any[]} */ ...a) => K.venomTakes(...a);
  const weapon = (/** @type {any[]} */ ...a) => K.weapon(...a);

  // ---------- combat ----------
  function floatText(m, text, color) {
    // words over the same creature at nearly the same moment stack a line apart
    // ('weak!' over its number, an off-hand blow over the main one), not on top
    const x = m.rx + 0.5, y = m.ry + 0.5, born = K.realNow + K.fxDelay;
    const lift = fx.texts.filter(t => t.x === x && t.y === y && Math.abs(t.born - born) < 300).length;
    fx.texts.push({ x, y, text: String(text), color, born, until: born + 750, lift });
  }
  // A missile is seen to fly: a knife spun, a stone slung, an arrow loosed,
  // leaving the hand at its moment in the throw (a fraction of the swing) and
  // crossing a square in so many milliseconds. What it does is shown when it
  // arrives. Where it leaves from is a point on the view, as fractions.
  const MISSILE = {
    throwknife: { style: 'knife', release: 0.4, perSquare: 75, from: { x: 0.6, y: 0.74 }, color: '#dfe5ee' },
    // let go at the top of the second turn of an overhead whirl
    sling: { style: 'stone', release: 0.55, perSquare: 70, from: { x: 0.76, y: 0.17 }, color: '#9a948c' },
    shortbow: { style: 'arrow', release: 0.72, perSquare: 45, from: { x: 0.5, y: 0.66 }, color: '#b08858' },
    // the long bow's heavier draw sends its arrow a little quicker down the hall
    longbow: { style: 'arrow', release: 0.72, perSquare: 38, from: { x: 0.5, y: 0.66 }, color: '#a88050' },
    // a short black bolt, let go as the crossbow kicks, and quick off the prod
    handxbow: { style: 'arrow', release: 0.32, perSquare: 36, from: { x: 0.56, y: 0.6 }, color: '#3a3040' },
  };
  function attack() {
    try { strike(); } finally { K.fxDelay = 0; }
  }
  function strike() {
    const p = P();
    if (K.G.t < p.nextAttack) return;
    if (p.held > K.G.t) { blocked(heldWhy()); return; }
    p.noiseAt = K.G.t;
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
        // (a mimic still shut is a barrel down the corridor, until it has creaked and been heard)
        if (t && !(t.disguised && !t.creaked)) { m = t; atRange = true; break; }
      }
    }
    p.nextAttack = K.G.t + w.speed;
    fx.swingUntil = K.realNow + 160;
    fx.swingAt = K.realNow; fx.swingMs = Math.max(200, Math.min(380, Math.round(w.speed * 0.55)));
    if (w.range) Sound.play('shoot', { w: p.eq.weapon.t });
    const mis = w.range && MISSILE[p.eq.weapon.t];
    if (mis) {
      const squares = m ? Math.max(1, Math.abs(m.x - p.x) + Math.abs(m.y - p.y)) : w.range;
      const release = Math.round(fx.swingMs * mis.release), flight = mis.perSquare * squares;
      spellFx(mis.style, mis.color, flight, m ? [m] : [], squares, release, mis.from);
      if (m) K.fxDelay = release + flight;
    }
    if (!m) {
      if (!w.range) Sound.play('swing', { w: w.claws ? null : p.eq.weapon && p.eq.weapon.t });
      // nothing to fight in front: a barrel, crate or urn there takes the blow
      const d = propAt(p.x + dx, p.y + dy);
      if (d) smash(lvl(), d);
      return;
    }
    const mb = mstat(m);
    const struckX = m.x, struckY = m.y;
    if (m.collapsed) { learn(m.id, 'answer'); damageMonster(m, 1, null, ' You scatter the bones for good.'); return; }
    // Shadow Step: a sidestep a moment ago puts the next blow in the shadows
    const stepped = !atRange && hasTalent('shadow_step') && K.G.t < (p.shadowUntil || 0);
    const sneak = p.cls === 'thief' && !atRange && (!m.awake || m.fleeing || stepped) && sneakMult() > 1;
    if (stepped) p.shadowUntil = 0;
    // an arrow at a foe that has not yet seen who loosed it
    const unseen = atRange && !m.awake;
    const marked = unseen && hasTalent('hunters_mark');
    // a Sharpshooter's first arrow at it never misses; nor does any blow at a mimic still shut, which is a barrel standing still
    const sure = (unseen && onPath('sharpshooter')) || !!m.disguised;
    m.awake = true;
    const roll = d(1, 20);
    // an answered trick's opening, taken in time, on the one that left it
    const open = !!(p.opening && p.opening.uid === m.uid && p.opening.until > K.G.t);
    if (open) p.opening = null;
    const crit = open || roll >= critFloor();
    // a riposte: the opening a missed blow left, taken
    const rip = !atRange && p.riposteUntil > K.G.t ? 4 : 0;
    if (rip) p.riposteUntil = 0;
    // a hound that hunts as a pack, beside the same foe, makes it easier to hit
    const edge = rip + (companion.flanks(m) ? 2 : 0);
    const note = rollNote(roll, toHit() + edge, mb.ac, crit);
    if (!open && !sure && (roll === 1 || (!crit && roll + toHit() + edge < mb.ac))) {
      log(`You miss the ${mb.name}.${note}`);
      { const o = heard(m); soon(() => Sound.play('glance', o)); }
      floatText(m, 'miss', '#e4e4ee');
      sparks(m);
      // a miss with one blade is no reason the other stays still
      offhandStrike(m, atRange, true);
      return;
    }
    // Thieves strike where it counts rather than swinging hard, so their bonus
    // comes from dexterity and does not scale with the weight of the weapon.
    const finesse = p.cls === 'thief' || p.cls === 'ranger';
    const flat = (finesse ? mod(p.stats.dex) : mod(armStat(p))) + skillDamage();
    // talents promise a number, so it is added whole, not scaled by the weapon's weight
    const knack = (hasTalent('weapon_master') ? (w.twoHanded ? 2 : 1) : 0) + (hasTalent('zeal') && effectFrom('hit', 'bless') ? 1 : 0)
      + berserkerRage() + templarBlow(m)   // a path's number, likewise
      + jewelBonus('might')                // and a Ring of Might's: on a dagger, scaled, it rounded away to nothing
      + (effect('might') ? 2 : 0);         // and a Potion of Might's, which says +2 and means it
    const baseSpeed = w.base || (p.eq.weapon ? ITEMS[p.eq.weapon.t].speed : 450);
    let dmg = d(...w.dmg) + w.e + (w.px === 'heavy' ? 1 : 0) + Math.round(finesse ? flat : flat * (baseSpeed / 700)) + knack + (rip ? 2 : 0) + baneDamage(m, 'weapon') + coatDamage(m) + dawnBlow(m) + bargained() + rangerAim(m, atRange) + wardenHold(m);
    if (crit) dmg *= 2;
    if (sneak) dmg *= sneakMult();
    if (marked) dmg *= 2;
    dmg = Math.max(1, dmg);
    if (p.cls === 'cleric') dmg = Math.round(dmg * deepMagic());
    dmg = Math.round(dmg * deepSteel());
    leech(Math.min(dmg, m.hp), 'weapon');   // only what it actually drew
    // Cleave: the swing carries on into the one behind the front. Who that is
    // is settled before the blow, since a killing blow brings them forward.
    const behind = !atRange && !w.range && hasTalent('cleave') && m.pack && m.pack.length ? m.pack[0] : null;
    const packBefore = packSize(m);
    // a crit that only Lucky made one says so
    const lucky = crit && hasTalent('lucky') && roll === critFloor();
    const hpWas = m.hp;
    damageMonster(m, dmg, open ? 'opening' : crit ? (rip ? 'riposte-crit' : (lucky ? 'lucky' : 'crit')) : (sneak ? 'sneak' : (rip ? 'riposte' : null)), open ? '' : note);
    // (a blow turned aside by a shadow or a shield-bearer did not land, for what rides on the blade)
    const bladeLanded = !lvl().monsters.includes(m) || m.hp < hpWas || !!(m.pack && m.pack.length);
    // fire on the blade sets alight whatever will burn where the blow lands
    if (bladeLanded && !wild.shaped() && (hasPower('flame', 'weapon') || (p.coating && p.coating.t === 'fire' && p.coating.left > 0))) elements.strike(m, 'fire', 0, 'blade');
    // a critical blow in close is felt: the view jolts a little, less than a blow taken
    if (crit && !atRange && K.realNow >= fx.shakeUntil) { fx.shakeAmp = Math.min(3.5, 1.5 + dmg / 12); fx.shakeMs = 140; fx.shakeUntil = K.realNow + K.fxDelay + 140; }
    const struckSurvived = lvl().monsters.includes(m) && packSize(m) === packBefore && !m.collapsed;
    // Volley: every third arrow that lands looses a second after it
    if (hasTalent('volley') && atRange && w.range) {
      p.volleyN = (p.volleyN || 0) + 1;
      if (p.volleyN % 3 === 0 && lvl().monsters.includes(m) && !m.collapsed) damageMonster(m, Math.max(1, Math.floor(dmg / 2)), 'volley');
    }
    if (behind && lvl().monsters.includes(m)) {
      const n = Math.max(1, Math.floor(dmg / 2));
      if (m.pack && m.pack.includes(behind)) {
        behind.hp -= n;
        if (behind.hp <= 0) { m.pack.splice(m.pack.indexOf(behind), 1); if (!m.pack.length) delete m.pack; memberDown(m); }
        else log(`Your swing carries into the ${mb.name} behind for ${n}.`);
      } else if (!m.collapsed) damageMonster(m, n, 'cleave');   // it has stepped up into the swing
    }
    // a flaming weapon burns what it strikes: no troll regrows the wound, and
    // Kindling keeps the fire going
    if (hasPower('flame', 'weapon') && struckSurvived) {
      if (mb.regen) { if (!(m.burnUntil > K.G.t)) log(`The ${mb.name}'s burns do not close.`, 'good'); m.burnUntil = K.G.t + 6000; }
      if (kindles()) setBurning(m);
    }
    if (bladeLanded && !w.claws) coatLanded(m, struckSurvived);
    // a dark elf's hand crossbow: its bolts carry their sleeping poison, and one in four that lands
    // leaves a living foe drowsy, its next move a second late (not the dead, a stout grey dwarf, a boss or a champion)
    if (!w.claws && P().eq.weapon && ITEMS[P().eq.weapon.t].drowse && atRange && struckSurvived && !mb.undead && !mb.stout && !mb.boss && !mb.named && !(m.windup && m.windup.move === 'rite') && Dice.chance(1 / 4)) {
      m.nextAct = Math.max(m.nextAct, K.G.t) + 1000;
      floatText(m, 'drowsy', '#b8a8f0');
    }
    if (bladeLanded) wild.rend(m, struckSurvived);
    // Venomed Blades: one hit in four poisons anything living, and only the one struck
    if (hasTalent('venom') && struckSurvived && Math.random() < 0.25 && venomTakes(m, mb)) {
      m.dot = { kind: 'venom', until: K.G.t + 4000, next: K.G.t + 1000 };
      log(`The ${mb.name} is poisoned.`, 'good');
    }
    // the second blade follows, hit or miss, but only if the foe is still where the first struck it:
    // a lich that has come apart into shadow is no longer there to hit
    if (K.G.status === 'playing' && m.hp > 0 && m.x === struckX && m.y === struckY && lvl().monsters.includes(m)) offhandStrike(m, atRange);
  }
  /**
   * The second blade follows the first. It swings wilder and carries none of
   * your strength behind it, so two light weapons beat one heavy one only
   * against the sort of thing that is easy to hit in the first place.
   */
  function offhandStrike(m, atRange, afterMiss = false) {
    const o = offhandWeapon();
    if (!o || atRange) return;
    const penalty = DUAL_HIT_PENALTY + (afterMiss ? OFF_BALANCE : 0);
    // the second blade comes in once the first cut has landed: a one-two, not both at once
    fx.offAt = K.realNow + Math.round((fx.swingMs || 300) * 0.4);
    const mb = mstat(m);
    const roll = d(1, 20);
    const hit = toHit() - penalty + (o.px === 'true' ? 1 : 0);
    const note = rollNote(roll, hit, mb.ac, false);
    if (roll === 1 || roll + hit < mb.ac) {
      log(`Your ${o.name.toLowerCase()} goes wide.${note}`);
      return;
    }
    // a Ring of Might, a Berserker's rage and Weapon Master's +1 promise every blow, and this is one
    const dmg = Math.max(1, Math.round((d(...o.dmg) + o.e + (o.px === 'heavy' ? 1 : 0) + jewelBonus('might') + berserkerRage() + (hasTalent('weapon_master') ? 1 : 0) + baneDamage(m, 'offhand') + bargained()) * deepSteel()));
    leech(Math.min(dmg, m.hp), 'offhand');
    damageMonster(m, dmg, 'offhand', note);
  }
  function damageMonster(m, dmg, tag, note) {
    // the lich, wrapped in shadow while its fight turns, cannot be hurt: each
    // act gets its moment instead of three going by in as many blows
    // a spell flies over the Warlord's shield-bearers: on his throne it is the one thing that reaches him
    const overShields = m.throne && !!K.castingName && tag !== 'shock';
    if (overShields && !m.overSaid) { m.overSaid = true; log(`Your ${K.castingName} flies over the shield-bearers' heads and finds the ${MONSTERS[m.id].name} on his throne!`, 'good'); learn(m.id, 'answer'); }
    if (m.wardUntil > K.G.t && MONSTERS[m.id].boss && !overShields) {
      // the Warlord on his throne: his shield-bearers take what was meant for him
      if (m.throne) {
        floatText(m, 'shielded', '#d8a830');
        if (!m.wardSaid && tag !== 'companion') { m.wardSaid = true; log(`His shield-bearers turn the blow aside. Cut them down, and the ${MONSTERS[m.id].name} must come down from his throne.`, 'bad'); }
        sparks(m);
        Sound.play('block', heard(m));
        return;
      }
      // a mage knows how the shadow is woven: a spell pulls it apart instead
      if (K.castingName && K.castingName !== 'fireball' && tag !== 'shock' && P().cls === 'mage') {
        // it was waiting out its shadow; now it has a moment to gather itself
        m.wardUntil = K.G.t; m.nextAct = K.G.t + 400;
        Sound.stop('ward');
        floatText(m, 'unravelled', '#b090ff');
        spray(m, 'ecto', 0.8, false);
        // and drinks what the shadow was made of
        const p = P(), back = Math.min(p.maxSp - p.sp, Math.ceil(p.maxSp / 3));
        p.sp += back;
        log(`Your ${K.castingName} catches the shadow round the ${MONSTERS[m.id].name} and pulls it apart. It stands bare!${back ? ` You drink what it was made of (+${back} spell points).` : ''}`, 'good');
        Sound.play('riteBroken', heard(m));
        learn(m.id, 'answer');
        return;
      }
      floatText(m, 'shadow', '#b090ff');
      if (!m.wardSaid && tag !== 'companion') { m.wardSaid = true; log(`Your blow passes through the shadow wrapped round the ${MONSTERS[m.id].name}. Deal with its guards while it lasts${P().cls === 'mage' ? ', or unpick it with a spell' : ''}.`, 'bad'); }
      sparks(m);
      Sound.play('wardhit', heard(m));
      return;
    }
    // a blow into the ripple brings up what lies under it
    if (m.sunk) surface(m, 'struck');
    // a mimic struck while it is still a barrel is caught shut: the blow lands twice over
    if (m.disguised) { dmg *= 2; spring(m, 'struck'); }
    noteDealt(m, dmg, tag);
    const mb = mstat(m);
    m.hp -= dmg;
    m.awake = true;
    const pending = K.realNow < (m.flashAt || 0);
    m.flashAt = K.realNow + K.fxDelay; m.flashUntil = m.flashAt + 130;
    // and its life bar keeps what it had until then
    if (K.fxDelay > 0) m.hpShown = pending && m.hpShown > 0 ? m.hpShown : m.hp + dmg;
    {
      // a spray scaled to the blow, and a stain when it was a heavy one or the last
      const hard = dmg / Math.max(1, m.maxHp);
      if (tag !== 'burning' && tag !== 'blaze' && tag !== 'venom') spray(m, null, hard + (tag === 'crit' || tag === 'riposte-crit' || tag === 'opening' ? 0.4 : 0), hard >= 0.3 || m.hp <= 0);
    }
    floatText(m, dmg, tag === 'crit' || tag === 'riposte-crit' || tag === 'lucky' || tag === 'opening' ? '#ff4' : (tag === 'fire' || tag === 'burn' ? '#f84' : '#fff'));
    { const o = heard(m, { tag, gore: K.GORE_OF[m.id], w: tag === 'companion' || wild.shaped() ? 'fists' : tag === 'offhand' ? P().eq.offhand.t : P().eq.weapon ? P().eq.weapon.t : 'fists' }); soon(() => Sound.play('hit', o)); }
    buzz(12);
    if (m.hp <= 0) {
      // Bloodlust: every foe the hero fells gives a little back
      if (capped('bloodlust') && tag !== 'companion' && tag !== 'blaze' && tag !== 'rockfall') healPlayer(d(1, 4));
      // in a group the front one falls and the next steps up; the square
      // empties only when the last of them is down
      if (m.pack && m.pack.length) { m.dot = null; memberDown(m, note); promote(m); return; }
      // a skeleton cut down by an edge falls apart and pulls itself back
      // together; crushed bones, and bones struck by magic, stay down
      const crushed = mb.move === 'rise' && !m.risen && !m.collapsed && breaksBones(tag) && !(m.pack && m.pack.length);
      if (mb.move === 'rise' && !m.risen && !m.collapsed && !breaksBones(tag)) {
        m.risen = true; m.collapsed = K.G.t + RISE_MS; m.hp = 0;
        m.windup = null; m.volley = null; m.fleeing = false;
        // (it clatters down into the heap as bones that stay down would: the heap is drawn under it)
        body(m, 'clatter');
        log(`The ${mb.name} clatters into a heap of bones... and the bones begin to twitch. Smash them before it rises!`, 'bad');
        Sound.play('death', heard(m, { gore: 'bone', who: m.id }));
        meet(m, 'trick');
        return;
      }
      // a puffcap bursts at the last blow as at any other
      sporesOn(m, mb, tag);
      killMonster(m, note);
      if (crushed) learn(m.id, 'answer');    // told after its death, not before
      return;
    }
    meet(m);                               // still standing: met now, not before its death is told
    const of = packSize(m) > 1 ? ` (one of ${packSize(m)})` : '';
    if (tag === 'offhand') { log(`Your off hand finds the ${mb.name}${of} for ${dmg}.${note || ''}`); }
    else if (tag === 'thorns') { log(`Your barbs bite the ${mb.name} for ${dmg}.`); }
    else if (tag === 'companion') { log(`${K.G.companion ? K.G.companion.name : 'Your companion'} ${companion.verb()} the ${mb.name}${of} for ${dmg}.`); }
    else if (tag === 'burning' || tag === 'blaze') {
      // standing in flames, the first tick is told and the rest show on the creature, so the
      // log keeps room for warnings (a burn it carries, Kindling's, is short and told whole)
      const inFire = !m.dotTick && (elements.fieldAt(m.x, m.y) || {}).k === 'fire';
      if (!inFire || !(m.burnSaid > K.G.t)) log(`The ${mb.name} burns for ${dmg}.`);
      if (inFire) m.burnSaid = K.G.t + 2500;
    }
    else if (tag === 'cleave') { log(`Your swing carries into the next ${mb.name} as it steps up, for ${dmg}.`); }
    else if (tag === 'venom') { log(`The poison eats at the ${mb.name} for ${dmg}.`); }
    else if (tag === 'bleed') { log(`The ${mb.name} bleeds for ${dmg}.`); }
    else if (tag === 'volley') { log(`A second arrow follows the first into the ${mb.name}, for ${dmg}.`); }
    else if (tag === 'snare') { log(`The cord bites the ${mb.name} for ${dmg}.`); }
    else if (tag === 'rockfall') { log(`Rock crashes down on the ${mb.name}${of} for ${dmg}!`, 'good'); }
    else if (tag === 'shock') { log(`The lightning runs through the water into the ${mb.name}${of} for ${dmg}.`); }
    else {
      const pre = { crit: 'A mighty blow! ', opening: 'You take the opening! ', lucky: 'A lucky blow! ', 'riposte-crit': 'Riposte! A mighty blow! ', sneak: 'You strike from the shadows! ', riposte: 'Riposte! ' }[tag] || '';
      log(K.castingName ? `Your ${K.castingName} hits the ${mb.name}${of} for ${dmg}.` : `${pre}You hit the ${mb.name}${of} for ${dmg}.${note || ''}`);
    }
    moveOnHurt(m, mb, tag);
    sporesOn(m, mb, tag);
    // Kindling, or a Pyromancer: the hero's fire keeps burning
    if (tag === 'burn' && kindles()) setBurning(m);
    // wounded, non-boss monsters may break and run (a fungus has nowhere it would rather be)
    if (!mb.boss && !mb.named && !mb.spores && !(m.pack && m.pack.length) && m.hp <= m.maxHp * 0.25 && !m.fleeing && Math.random() < 0.3) {
      m.fleeing = true;
      m.windup = null; m.volley = null;
      log(`The ${mb.name} turns to flee!`, 'good');
    }
  }
  function killMonster(m, note) {
    const L = lvl(), mb = mstat(m);
    const at = L.monsters.indexOf(m);
    if (at < 0) return;                    // already removed by something else
    L.monsters.splice(at, 1);
    if (mb.boss) K.G.bossDown = true;
    memberDown(m, note);
    if (mb.boss) { bossFalls(m); log(m.id === 'warlord' ? 'The Warrens fall quiet. The Heart of the Mountain lies unguarded among the plunder.' : m.id === 'heartforged' ? 'The Heart of the Mountain rolls out of the slag, still burning, and lies unguarded where it was made.' : 'The dread presence lifts. The Heart of the Mountain is unguarded.', 'good'); }
    if (mb.named) namedFalls(m, mb);
    if (m.shade) shadeFalls(m);
    snaresSlack(m);
    // an emberling bursts as it dies, and its square burns a moment
    if (m.id === 'emberling') { elements.flame(m.x, m.y, 3000); log(`The ${mb.name} bursts in a gout of flame as it dies.`, 'bad'); }
  }

  // ---------- groups ----------
  // Pack creatures can share a square: one monster that carries the others
  // (m.pack, each {hp, maxHp}). They move as one, the front one takes your
  // blows, each of them swings, and a blast that fills the square hits all.
  const packSize = m => 1 + (m.pack ? m.pack.length : 0);
  // what a wyrm's scales and a quillback's quills are made into, and how often one is whole enough (Skarrow always)
  // (each a list of what may be taken, and how often: a dark elf warrior's blade more often than its mail)
  const TROPHIES = { wyrm: [['wyrmscale', 0.25]], skarrow: [['wyrmscale', 1]], quillback: [['quillshield', 0.2]],
    drow_warrior: [['scimitar', 0.12], ['elvenchain', 0.08]], drow_mage: [['cloak_shadow', 0.15], ['handxbow', 0.1]],
    grey_dwarf: [['dwarfhammer', 0.12], ['dwarfplate', 0.06]], dwarf_arbalest: [['runeshield', 0.15]],
    lizardfolk: [['marshhide', 0.1]], lizard_shaman: [['charm_fang', 0.15]] };
  /** One of them falls: the reward, the log line and the chance of loot. */
  function memberDown(m, note) {
    const L = lvl(), p = P(), mb = mstat(m);
    fallen(m);
    bounty.killed(m);                      // each one of a group counts toward a trader's cull
    { const o = heard(m, { gore: K.GORE_OF[m.id] || 'blood', who: m.id }); soon(() => Sound.play('death', o)); }
    p.kills++;
    noteKill(m);
    // the two halves of a split slime are worth one slime between them
    // (whole numbers: a shade's tier can be a fraction on a short delve, and its
    // experience once ran to fourteen places, and the score after it)
    // (a puffcap is worth what it grew over)
    // (a quick delve's hero learns twice as fast: see QUICK)
    const worth = (m.worth || mb.xp) * (isQuick() ? QUICK.xp : 1), xp = Math.round(m.split ? Math.ceil(worth / 2) : worth);
    p.xp = Math.round(p.xp + xp);
    // a mage draws back a little of the power their spell has unmade: fire in
    // the deep floors, where a mage's points ran dry before the fighting did
    // (a spell, cast: the fire scroll's blast names itself 'fireball' but is no spell)
    // (it was twice as much on Hard and in the Long Delve, where the mage
    // trailed the rest; but the bot that measured it was casting cold at the
    // lich and fire at the Heartforged, and once it chose as a player does,
    // the mage led on Hard by ten points)
    const drawn = K.castingName && K.castingName !== 'fireball' && p.cls === 'mage' && p.sp < p.maxSp ? 1 : 0;
    p.sp += drawn;
    // the dead are destroyed; the living are slain
    const reward = `${note || ''} (+${xp} xp${drawn ? `, +${drawn} spell point${drawn > 1 ? 's' : ''}` : ''})`;
    // a champion's fall is its own line, said once, with what it was worth
    if (mb.named) log(`${mb.named.fall}${reward}`, 'good');
    else if (m.shade) log(`${heroTitle(m.shade.name, m.shade.cls)} is laid to rest at last, and the cold goes out of the air. What they wore is yours to take.${reward}`, 'good');
    else log(`The ${mb.name} is ${mb.undead || m.id === 'slime' || mb.boss ? 'destroyed' : 'slain'}!${reward}`, 'good');
    meet(m, 'kill');
    // champions and bosses always drop something worthwhile
    // (a shade leaves only what its hero wore)
    if (!m.shade && (Math.random() < (m.split ? 0.2 : 0.4) * (hasTalent('light_fingers') ? 1.5 : 1) || mb.boss || m.elite)) {
      const k = key(m.x, m.y);
      const loot = Dungeon.rollLoot(Dice, K.G.depth + (m.elite ? 2 : 0));
      (L.items[k] = L.items[k] || []).push(loot);
    }
    // and the deep's own beasts leave something of themselves now and then
    for (const [t, chance] of TROPHIES[m.id] || []) {
      if (Math.random() >= chance) continue;
      const k = key(m.x, m.y);
      (L.items[k] = L.items[k] || []).push({ t, q: 1, e: 0 });
      // (armour takes no article: 'Elven Chain', not 'a Elven Chain')
      const nm = ITEMS[t].name, a = ITEMS[t].kind === 'armor' ? '' : /^[aeiou]/i.test(nm) ? 'an ' : 'a ';
      log(`Something of the ${mb.name} is worth taking: ${a}${nm}.`, 'good');
      break;
    }
    // a champion with a relic of its own drops it as it falls, once a run
    const own = Object.keys(RELICS).find(id => RELICS[id].champion === m.id);
    if (own && K.G.relics && !K.G.relics.found.includes(own) && !Object.values(L.items).some(pile => pile.some(it => it.u === own))) {
      const k = key(m.x, m.y);
      (L.items[k] = L.items[k] || []).push(relicItem(own));
      log(`As ${RELICS[own].fell || 'it falls'}, ${RELICS[own].name} drops to the stones.`, 'good');
    }
    // a renegade at the hero's side when the High Priestess falls has what they came down for
    // (near enough to see it: one told to stay at the far end of the floor only hears of it)
    const rc = companion.here();
    if (m.id === 'vaelith' && rc && rc.kind === 'renegade' && !rc.avenged && Math.abs(rc.x - m.x) + Math.abs(rc.y - m.y) <= 8) {
      rc.avenged = K.G.depth; rc.hp = rc.maxHp;
      log(`${rc.name} stands over the High Priestess a long moment, and says something in their own tongue. When they turn back to you the amber eyes are dry. "That was all I wanted. The rest of the way down, I go for you."`, 'good');
    }
    checkLevelUp();
    emit('stats');
  }
  // How each kind dies, where it does not simply topple: a skeleton clatters
  // down into its bones, a slime bursts flat across the stones, a wraith or a
  // shade comes apart into mist, a bat drops out of the air turning over, a
  // puffcap swells and bursts in a last cloud, an emberling gutters out in sparks.
  // (the lich and the Heartforged have deaths of their own)
  const DEATHS = { skeleton: 'clatter', slime: 'splat', wraith: 'mist', shade: 'mist', bat: 'tumble', puffcap: 'burst', emberling: 'gutter' };
  /** What flies from a body as it dies its own way: bones, ooze, mist, spores, sparks. */
  function deathBurst(c, how) {
    const kind = { clatter: 'bone', splat: 'goo', mist: 'ecto', burst: 'spore', gutter: 'spark' }[how];
    if (!kind) return;
    const g = K.GORE[kind], n = how === 'burst' ? 34 : how === 'mist' ? 22 : 18;
    // (a puffcap's cloud comes as it bursts, a moment after it is struck down)
    const at = c.born + (how === 'burst' ? CORPSE_MS * 0.2 : 0), z0 = c.fly + c.scale * (how === 'clatter' ? 0.5 : how === 'splat' ? 0.15 : 0.45);
    for (let i = 0; i < n; i++) {
      const a = look() * Math.PI * 2, sp = how === 'mist' ? 0.25 + look() * 0.4 : how === 'burst' ? 0.5 + look() * 1.1 : 0.4 + look() * 1.4;
      fx.bits.push({ x: c.x, y: c.y, z: z0 + (look() - 0.5) * c.scale * (how === 'mist' ? 0.7 : 0.3), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        vz: how === 'mist' ? 0.1 + look() * 0.3 : how === 'splat' ? 0.3 + look() * 0.9 : 0.5 + look() * 1.5,
        g: how === 'burst' ? 0.25 : g.g, c: g.c[i % g.c.length], born: at, life: (how === 'mist' || how === 'burst' ? 900 : 520) + look() * 400,
        size: how === 'clatter' ? (look() < 0.4 ? 0.04 : 0.026) : look() < 0.3 ? 0.03 : 0.018, glow: g.glow });
    }
    if (fx.bits.length > K.BITS_MAX) fx.bits.splice(0, fx.bits.length - K.BITS_MAX);
  }
  /** A body sinking and fading where it fell, knocked back from the hero, or dying its own way (DEATHS). */
  /** Its body going down the way it goes (DEATHS), with what flies from it. */
  function body(m, how) {
    const p = P(), base = MONSTERS[m.id];
    const rx = m.rx == null ? m.x : m.rx, ry = m.ry == null ? m.y : m.ry;
    const vx = rx - p.x, vy = ry - p.y, len = Math.hypot(vx, vy) || 1;
    const heap = m.collapsed && how !== 'clatter';
    const c = { x: rx + 0.5, y: ry + 0.5, sprite: heap ? 'bone_heap' : base.sprite, elite: m.elite || (base.named ? m.id : m.shade ? 'shade_' + m.shade.cls : undefined), scale: base.scale * (packSize(m) > 1 ? 0.88 : 1) * (heap ? 0.95 : 1),
      born: K.realNow + K.fxDelay, dx: vx / len, dy: vy / len, fly: base.fly || 0, how };
    fx.corpses.push(c);
    deathBurst(c, how);
  }
  function fallen(m) {
    const base = MONSTERS[m.id];
    const rx = m.rx == null ? m.x : m.rx, ry = m.ry == null ? m.y : m.ry;
    body(m, m.collapsed ? 'fall' : DEATHS[base.sprite] || 'fall');
    // once the body has sunk away something stays a while: bones from the dead
    // and the bony, a husk from the rest; a wraith, a slime, a burst puffcap or the lich leave nothing
    if (!['wraith', 'slime', 'lich', 'shade', 'puffcap'].includes(base.sprite)) {
      const L = lvl(), k = base.undead || base.sprite === 'skeleton' || base.sprite === 'bat' ? 'remains_bones' : 'remains_husk';
      L.remains = (L.remains || []).filter(r => r.until > K.G.t).slice(-(REMAINS_MAX - 1));
      L.remains.push({ x: Math.round((rx + 0.5) * 100) / 100, y: Math.round((ry + 0.5) * 100) / 100, k, at: K.G.t, until: K.G.t + REMAINS_MS });
    }
  }
  // how long the fallen's remains lie (game time), and how many a floor keeps at once
  const REMAINS_MS = 240000, REMAINS_MAX = 16;
  /** Let go of remains that have had their time, so a floor left behind does not carry them in the save. @param {import('./types.js').Level} L */
  function pruneRemains(L) {
    if (!L.remains) return;
    L.remains = L.remains.filter(r => r.until > K.G.t);
    if (!L.remains.length) delete L.remains;
  }
  /** The next of the group steps into the front. */
  function promote(m) {
    const next = m.pack.shift();
    m.hp = next.hp; m.maxHp = next.maxHp;
    // a fireball still in the air: the one stepping up shows its own life, not the fallen one's
    if (m.hpShown > 0) m.hpShown = next.hp;
    if (!m.pack.length) delete m.pack;
    const left = packSize(m);
    log(left > 1 ? `Another ${mstat(m).name} steps up. ${left} are left.` : `The last ${mstat(m).name} steps up.`, 'bad');
  }
  /** A blast that fills the square: the ones behind take it too. */
  function hitGroup(m, dmg, tag) {
    if (m.pack && m.split) learn(m.id, 'answer');     // a blast that takes both halves of a split slime
    if (m.pack) {
      for (const b of m.pack.slice()) {
        noteDealt(m, dmg, tag, b.hp);
        b.hp -= dmg;
        if (b.hp <= 0) { m.pack.splice(m.pack.indexOf(b), 1); memberDown(m); }
      }
      if (!m.pack.length) delete m.pack;
    }
    damageMonster(m, dmg, tag);
  }
  function checkLevelUp() {
    const p = P();
    while (p.level < MAX_LEVEL && p.xp >= XP_TABLE[p.level]) {
      p.level++;
      // and golden light rises through the view (see drawLevelUp in the renderer)
      fx.levelAt = K.realNow;
      const gain = Math.max(1, d(1, cls().hitDie) + mod(p.stats.con));
      p.maxHp += gain; p.hp += gain;
      p.maxSp = spMax(p); p.sp = p.maxSp;
      log(`You have reached level ${p.level}! (+${gain} hit points)`, 'good');
      Sound.play('levelup'); buzz([30, 50, 30, 50, 90]);
      const unlocked = knownSpells().filter(s => spellLevel(s) === p.level);
      for (const s of unlocked) log(`You have learned ${s.name}.`, 'good');
      K.G.levelNotes = K.G.levelNotes || {};
      K.G.levelNotes[p.level] = { hp: gain, spells: unlocked.map(s => s.name) };
      // a small lesson at every odd level, and at every even one a talent of
      // the hero's class; at PATH_LEVEL the path instead of the lesson. A hero
      // past it without one (a save from before paths) is offered it as well
      const path = p.level >= PATH_LEVEL && offerPath();
      if (path && p.level === PATH_LEVEL) continue;
      // and at CAPSTONE_LEVEL, a hero on a path masters it, again in place of the lesson
      const capstone = p.level >= CAPSTONE_LEVEL && offerCapstone();
      if (capstone && p.level === CAPSTONE_LEVEL) continue;
      if (p.level % 2 === 0) offerTalents(); else offerBoons();
    }
    // past the top level, renown: a rank for every RENOWN_XP more, with the same golden light
    // and a choice of its own (see RENOWN in data.js). A save from before renown, at the top
    // with experience over, comes into its ranks with the next experience it earns.
    while (p.level >= MAX_LEVEL && p.xp >= renownAt((p.renown || 0) + 1)) {
      p.renown = (p.renown || 0) + 1;
      fx.levelAt = K.realNow;
      log(`Renown: word of your deeds runs ahead of you. Rank ${p.renown}.`, 'good');
      Sound.play('levelup');
      offerRenown();
    }
  }
  /** The experience a rank of renown is reached at: the top level's, and RENOWN_XP for each rank. */
  const renownAt = n => XP_TABLE[MAX_LEVEL - 1] + n * RENOWN_XP;
  /** The gains of renown a hero can still be offered. */
  function renownPool() {
    const p = P(), taken = p.renownTaken || [];
    return RENOWN.filter(r => (!r.when || r.when(p)) && !(r.max && taken.filter(t => t === r.id).length >= r.max));
  }
  /** An offer of renown's gains, rather than a lesson or a talent. */
  const isRenownOffer = offer => !!offer && offer.some(id => RENOWN.some(r => r.id === id));
  /** Three of renown's gains. In the queue the offer stands as the level past the top that its rank would be. */
  function offerRenown() {
    const p = P();
    // with the lich down the run is all but over: the rank is still the hero's, the choice is not
    if (K.G.bossDown) return;
    K.G.pendingBoons = (K.G.pendingBoons || []).concat([Dice.shuffle(renownPool().slice()).slice(0, 3).map(r => r.id)]);
    K.G.pendingLevels = (K.G.pendingLevels || []).concat(MAX_LEVEL + p.renown);
    emit('boons');
  }
  /** The lessons a hero can still be offered. */
  function boonPool() {
    const p = P();
    const taken = p.boons || [];
    // a stat lesson twice at most: stacking one every level was the whole of a build
    const times = id => taken.filter(t => t === id).length;
    return BOONS.filter(b => (!b.when || b.when(p)) && !(b.unique && taken.includes(b.id)) && !(b.max && times(b.id) >= b.max));
  }
  /** The class talents a hero can still be offered. */
  function talentPool() {
    const p = P();
    // a talent for a spell not yet learned would sit useless for levels: it waits
    const knows = id => knownSpells().some(s => s.id === id && spellAvailable(s));
    return (TALENTS[p.cls] || []).filter(t => !(p.talents || []).includes(t.id) && (!t.needs || knows(t.needs)));
  }
  /**
   * Offers wait in a queue when several levels come at once, and each was
   * drawn before the others were chosen: without a second look, the talent
   * taken from the first could be offered again by the next. After every
   * choice the waiting offers are drawn over from what is still to be had.
   */
  function redrawOffers() {
    const rest = K.G.pendingBoons || [];
    for (let i = 0; i < rest.length; i++) {
      if (isPathOffer(rest[i]) || isCapstoneOffer(rest[i])) continue;      // the two paths, or capstones, stand as they are
      const talentOffer = rest[i].some(id => (TALENTS[P().cls] || []).some(t => t.id === id));
      const pool = (isRenownOffer(rest[i]) ? renownPool() : talentOffer ? talentPool() : boonPool()).map(b => b.id);
      const keep = rest[i].filter(id => pool.includes(id));
      const more = Dice.shuffle(pool.filter(id => !keep.includes(id))).slice(0, Math.max(0, 3 - keep.length));
      rest[i] = keep.concat(more);
      // every talent taken: the offer becomes a lesson
      if (!rest[i].length && talentOffer) rest[i] = Dice.shuffle(boonPool().map(b => b.id)).slice(0, 3);
    }
  }
  // Three things experience could have taught you. You keep one.
  function offerBoons() {
    const p = P();
    // with the lich down the run is all but over: a choice would only stand
    // between the hero and the Heart. The levels still come, and their hit points
    if (K.G.bossDown) return;
    const picked = Dice.shuffle(boonPool().slice()).slice(0, 3).map(b => b.id);
    K.G.pendingBoons = (K.G.pendingBoons || []).concat([picked]);
    K.G.pendingLevels = (K.G.pendingLevels || []).concat(p.level);
    emit('boons');
  }
  /** Three of the class's talents not yet taken; a lesson instead once all are. */
  function offerTalents() {
    const p = P();
    if (K.G.bossDown) return;
    const pool = talentPool();
    if (!pool.length) { offerBoons(); return; }
    K.G.pendingBoons = (K.G.pendingBoons || []).concat([Dice.shuffle(pool.slice()).slice(0, 3).map(t => t.id)]);
    K.G.pendingLevels = (K.G.pendingLevels || []).concat(p.level);
    emit('boons');
  }
  /** An offer of the class's two paths, rather than lessons or talents. */
  function isPathOffer(offer) { return !!offer && offer.some(id => (PATHS[P().cls] || []).some(x => x.id === id)); }
  /** The class's two paths, once, if the hero has none and is not already being offered them. */
  function offerPath() {
    const p = P(), paths = PATHS[p.cls] || [];
    if (K.G.bossDown || p.path || !paths.length || (K.G.pendingBoons || []).some(isPathOffer)) return false;
    K.G.pendingBoons = (K.G.pendingBoons || []).concat([paths.map(x => x.id)]);
    K.G.pendingLevels = (K.G.pendingLevels || []).concat(p.level);
    emit('boons');
    return true;
  }
  /** An offer of the path's two capstones. */
  function isCapstoneOffer(offer) { const x = pathOf(); return !!offer && !!x && offer.some(id => (x.capstones || []).some(c => c.id === id)); }
  /** The path's two capstones, once, for a hero on a path without one and not already being offered them. */
  function offerCapstone() {
    const p = P(), x = pathOf(p);
    if (K.G.bossDown || !x || !(x.capstones || []).length || p.capstone || (K.G.pendingBoons || []).some(isCapstoneOffer)) return false;
    K.G.pendingBoons = (K.G.pendingBoons || []).concat([x.capstones.map(c => c.id)]);
    K.G.pendingLevels = (K.G.pendingLevels || []).concat(p.level);
    emit('boons');
    return true;
  }
  /** The level the offer now showing was earned at. */
  function pendingLevel() { return K.G.pendingLevels && K.G.pendingLevels.length ? K.G.pendingLevels[0] : P().level; }
  /** What a level brought besides the choice: hit points, and any spell learned. */
  function levelNote(level) { return (K.G.levelNotes && K.G.levelNotes[level]) || null; }
  function pendingBoons() { return K.G.pendingBoons && K.G.pendingBoons.length ? K.G.pendingBoons[0] : null; }
  /** @param {string[]} [picks]  for Self-Taught, the scores its points go to */
  function chooseBoon(id, picks) {
    const offer = pendingBoons();
    if (!offer || !offer.includes(id)) return false;
    const p = P();
    const path = (PATHS[p.cls] || []).find(x => x.id === id);
    if (path) {
      // for good: nothing offers it again, and nothing takes it back
      p.path = id;
      const was = p.maxSp;
      refreshSp(p);
      p.sp += p.maxSp - was;                 // a Healer's deeper well is there at once, and full
      K.G.pendingBoons.shift(); if (K.G.pendingLevels) K.G.pendingLevels.shift();
      redrawOffers();
      log(`You walk the path of the ${path.name}. ${path.effects.join(' ')}`, 'good');
      // a hero who came to the path past the capstone's level (an old save) has it offered next
      if (p.level >= CAPSTONE_LEVEL) offerCapstone();
      Sound.play('levelup');
      emit('stats');
      if (!pendingBoons()) emit('boonsDone');
      return true;
    }
    const capstone = isCapstoneOffer(offer) && (pathOf(p).capstones || []).find(c => c.id === id);
    if (capstone) {
      p.capstone = id;
      K.G.pendingBoons.shift(); if (K.G.pendingLevels) K.G.pendingLevels.shift();
      redrawOffers();
      log(`You master the ${pathOf(p).name}'s path: ${capstone.name}. ${capstone.effects.join(' ')}`, 'good');
      Sound.play('levelup');
      emit('stats');
      if (!pendingBoons()) emit('boonsDone');
      return true;
    }
    const talent = (TALENTS[p.cls] || []).find(t => t.id === id);
    if (talent) {
      p.talents = (p.talents || []).concat(id);
      K.G.pendingBoons.shift(); if (K.G.pendingLevels) K.G.pendingLevels.shift();
      redrawOffers();
      log(`Talent: ${talent.name}. ${talent.desc}`, 'good');
      Sound.play('levelup');
      emit('stats');
      if (!pendingBoons()) emit('boonsDone');
      return true;
    }
    const fame = RENOWN.find(r => r.id === id);
    if (fame) {
      fame.apply(p);
      p.maxSp = spMax(p);
      p.sp = Math.min(p.maxSp, p.sp);
      p.renownTaken = (p.renownTaken || []).concat(id);
      K.G.pendingBoons.shift(); if (K.G.pendingLevels) K.G.pendingLevels.shift();
      redrawOffers();
      log(`${fame.name}. ${fame.desc}`, 'good');
      Sound.play('levelup');
      emit('stats');
      if (!pendingBoons()) emit('boonsDone');
      return true;
    }
    const boon = BOONS.find(b => b.id === id);
    if (!boon) return false;
    let told = boon.desc;
    if (boon.spread) {
      // the points go where the player puts them, and nowhere until they do
      if (!Array.isArray(picks) || picks.length !== boon.spread || !picks.every(k => Object.prototype.hasOwnProperty.call(STAT_WORD, k))) return false;
      const counts = {};
      for (const k of picks) counts[k] = (counts[k] || 0) + 1;
      // two points to a score over the whole run, as a score's own lesson comes twice at most:
      // Self-Taught twice into one score was the stat lesson's cap walked round
      const taught = p.taught || (p.taught = {});
      if (Object.keys(counts).some(k => (taught[k] || 0) + counts[k] > SELF_TAUGHT_MOST)) return false;
      for (const k of picks) { p.stats[k]++; taught[k] = (taught[k] || 0) + 1; }
      told = Object.entries(counts).map(([k, n]) => `+${n} ${STAT_WORD[k]}`).join(', ') + '.';
    }
    boon.apply(p);
    p.maxSp = spMax(p);
    p.sp = Math.min(p.maxSp, p.sp);
    p.boons = (p.boons || []).concat(id);
    K.G.pendingBoons.shift(); if (K.G.pendingLevels) K.G.pendingLevels.shift();
    redrawOffers();
    log(`${boon.name}. ${told}`, 'good');
    Sound.play('levelup');
    emit('stats');
    if (!pendingBoons()) emit('boonsDone');
    return true;
  }
  /** Which way an attacker lies relative to the way the player is facing. */
  function relativeBearing(m) {
    const p = P();
    const dx = m.x - p.x, dy = m.y - p.y;
    let dir = -1;
    for (let k = 0; k < 4; k++) if (DIRS[k][0] === Math.sign(dx) && DIRS[k][1] === Math.sign(dy)) dir = k;
    if (dir < 0) return null;
    const rel = (dir - p.dir + 4) % 4;
    return { rel, word: ['from ahead', 'from your right', 'from behind', 'from your left'][rel] };
  }
  /**
   * Where a sound comes from, for the ear: how many squares off, how far to
   * the left (-1) or right (1) of the way the hero faces, and whether behind.
   * @param {{x: number, y: number}} at  a monster or a square
   * @param {Record<string, any>} [extra]  what else shapes the sound
   */
  function heard(at, extra) {
    const p = P(), [ax, ay] = DIRS[p.dir], [bx, by] = DIRS[(p.dir + 1) % 4];
    const dx = at.x - p.x, dy = at.y - p.y, dist = Math.hypot(dx, dy);
    return { dist, pan: dist ? (dx * bx + dy * by) / dist : 0, behind: dx * ax + dy * ay < 0, ...extra };
  }
  /**
   * @param {number} dmg @param {string|null} msg
   * @param {import('./types.js').Monster|null} [from]  the monster that struck, if one did
   * @param {string} [cause]  what hurt, when no monster did: a trap, poison, hunger
   */
  function hurtPlayer(dmg, msg, from, cause) {
    // the dead are past hurting: a second blow in the same swing (quills bite
    // the off hand's blow too) would tell the death twice
    if (K.G.status !== 'playing') return;
    const p = P();
    // a bear's hide takes the blow before the druid inside it does (and what
    // it takes is not counted as taken)
    // (hunger and poison work from inside, where no hide reaches)
    const inside = cause === 'hunger' || cause === 'poison';
    const hide = wild.shaped(p) && !inside ? p.shape.hide : 0;
    const through = inside ? dmg : wild.soak(dmg);
    if (hide && through < dmg) { const took = dmg - through; if (msg) msg += ` (Your hide takes ${took}.)`; else log(`Your hide takes ${took}.`, 'bad'); dmg = through; }
    noteTaken(dmg, from, cause);
    p.hp -= dmg;
    // (with endless life on for testing, no blow is the last)
    if (aids.on('hp') && p.hp < 1) { p.hp = p.maxHp; K.G.tested = true; }
    p.lastHurt = K.G.t;
    if (from) {
      const bearing = relativeBearing(from);
      fx.hurtFrom = bearing ? bearing.rel : 0;
      // a blow from out of sight is held on its edge longer: a player watching
      // the view ahead lost most of a life to an archer on the left, unnoticed
      fx.hurtFromUntil = K.realNow + (fx.hurtFrom ? 1500 : 900);
      // a champion is remembered by its name: "Grisk, the Goblin King", not "Goblin King"
      const fb = mstat(from);
      K.G.lastAttacker = { name: fb.named ? `${fb.named.called}, the ${fb.name}` : from.shade ? `the ${fb.name}` : fb.name, id: from.id, dmg, bearing: bearing ? bearing.word : 'from nearby' };
    } else if (cause) K.G.lastAttacker = { name: cause, dmg, bearing: '', cause: true };
    // the harder the blow against the hero's whole life, the harder the view
    // jolts and reddens; one that takes a tenth of it or more leaves blood on
    // the edges of the view
    const hard = Math.min(1, dmg / Math.max(1, p.maxHp * 0.3));
    fx.damageUntil = K.realNow + 260;
    fx.hurtAmt = 0.3 + 0.4 * hard;
    fx.shakeAmp = 2.5 + 7 * hard; fx.shakeMs = 220; fx.shakeUntil = K.realNow + 220;
    if (dmg >= p.maxHp / 10) bloodOnView(hard);
    Sound.play('hurt', from ? heard(from) : undefined);
    // and it is felt differently in the hand: twice, not once
    buzz(from && fx.hurtFrom ? [40, 70, 40] : 40);
    if (msg) log(msg, 'bad');
    wild.torn(dmg);
    // an Amulet of Life Saving takes the killing blow, once, and is spent
    const saver = p.hp <= 0 && JEWEL_SLOTS.find(s => jewelPowers(p.eq[s]).includes('lifesave'));
    if (saver) {
      const it = p.eq[saver];
      p.eq[saver] = null; K.G.known[it.t] = 1;
      noteHealed(Math.ceil(p.maxHp / 2) - Math.max(0, p.hp));   // from nothing, not from the overkill
      p.hp = Math.ceil(p.maxHp / 2);
      log(`That should have killed you. ${cap(the(it))} flares white at your throat, and crumbles to dust.`, 'good');
      fx.healAt = K.realNow;
      Sound.play('heal');
      emit('inv');
    }
    // a capstone's stand, once on each floor: Undying stays up on 1, a Miracle mends half
    const L = lvl();
    if (p.hp <= 0 && (capped('undying') || capped('miracle')) && L.stoodFast !== true) {
      L.stoodFast = true;
      if (capped('undying')) { p.hp = 1; log('Not yet. You should have fallen, and you are still standing. It will not hold twice on this floor.', 'good'); }
      else { noteHealed(Math.ceil(p.maxHp / 2)); p.hp = Math.ceil(p.maxHp / 2); fx.healAt = K.realNow; Sound.play('heal'); log('A miracle: something answers as you fall, and you rise half mended. It will not come twice on this floor.', 'good'); }
    }
    if (p.hp <= 0 && hasTalent('last_rites') && !p.ritesUsed) {
      p.hp = 1; p.ritesUsed = true; p.sp = 0;
      log('Last rites: a light holds you up when you should have fallen, and takes every prayer you had left. It will not come again.', 'good');
    }
    if (p.hp > 0 && p.hp < p.maxHp / 4 && hasTalent('second_wind') && K.G.t >= (p.windReady || 0)) {
      const n = Math.ceil(p.maxHp / 4);
      noteHealed(Math.min(n, p.maxHp - p.hp));
      p.hp = Math.min(p.maxHp, p.hp + n); p.windReady = K.G.t + 120000;
      log(`Second wind! (+${n})`, 'good');
      Sound.play('heal');
    }
    // a healer who has learned it is at the hero's side with a dressing, once a floor
    const dressed = companion.dresses();
    if (dressed) {
      noteHealed(dressed); p.hp += dressed;
      fx.healAt = K.realNow; Sound.play('heal');
      log(`${K.G.companion.name} is at your side at once, and binds the wound tight. (+${dressed})`, 'good');
    }
    emit('stats');
    if (p.hp <= 0 && from) learn(from.id, 'death');
    if (p.hp <= 0) die();
  }
  /** Drops of blood on the view's edges, more of them for a harder blow; they run a little and fade. */
  function bloodOnView(hard) {
    const n = Math.round(2 + hard * 6);
    for (let i = 0; i < n; i++) {
      // along the edges, never over the middle where the enemy is
      const edge = Math.floor(look() * 4), t = look();
      const x = edge === 0 ? 0.03 + look() * 0.12 : edge === 1 ? 0.85 + look() * 0.12 : t;
      const y = edge >= 2 ? (edge === 2 ? 0.02 + look() * 0.12 : 0.86 + look() * 0.1) : t;
      fx.drops.push({ x, y, r: 0.008 + look() * 0.012 * (0.5 + hard), born: K.realNow + look(), life: 1300 + look() * 700 });
    }
    if (fx.drops.length > 24) fx.drops.splice(0, fx.drops.length - 24);
  }
  function healPlayer(n) {
    const p = P();
    noteHealed(Math.max(0, Math.min(n, p.maxHp - p.hp)));
    p.hp = Math.min(p.maxHp, p.hp + n);
    // (a draught's or a scroll's is seen and heard once it has been taken)
    fx.healAt = K.realNow + K.fxDelay; fx.healUntil = fx.healAt + 260;
    soon(() => Sound.play('heal'));
    emit('stats');
  }
  function die() {
    const p = P();
    p.hp = 0;
    K.fxGen++;                               // no blow still in the air is heard over the fall
    fx.hpFrac = 1;                         // no near-death pulse over the fallen
    fx.deadAt = K.realNow;                    // the view darkens a moment before the end screen
    K.G.status = 'dead';
    K.G.deathLog = K.G.log.filter(e => !e.gone).slice(-6).map(e => e.m);
    log(`${p.name} has died on floor ${K.G.depth}.`, 'bad');
    Sound.play('die'); buzz([150, 80, 300]);
    if (K.G.opts.permadeath) { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } noteRun(runKey(), 'ended'); }
    // remembered, for a later run to find where they fell
    if (!K.G.opts.daily && !K.G.tested) Progress.recordFallen({ name: p.name, cls: p.cls, level: p.level, depth: K.G.depth, run: runKey(), eq: p.eq, killer: killerPhrase() });
    recordHero(false);
    emit('dead');
  }

  return { REMAINS_MAX, REMAINS_MS, attack, checkLevelUp, chooseBoon, damageMonster, floatText, healPlayer, heard, hitGroup, hurtPlayer, isCapstoneOffer, isPathOffer, isRenownOffer, levelNote, offerCapstone, offerPath, packSize, pendingBoons, pendingLevel, pruneRemains, relativeBearing, renownAt };
}
