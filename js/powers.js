// The hero's powers beyond a blow: spells (where a bolt flies, what a cast costs
// and does, and how it looks as it lands) and each class's own move on the Cast
// button. What it borrows from the game comes through K, read live.
import { ITEMS } from './data.js';
import { d } from './rng.js';
import { Sound } from './sound.js';

/** @param {any} K */
export function makePowers(K) {
  const CORD_SQUARE = K.CORD_SQUARE;
  const DIRS = K.DIRS;
  const FROST_SPELLS = K.FROST_SPELLS;
  const SAVED_SHARE = K.SAVED_SHARE;
  const companion = K.companion;
  const elements = K.elements;
  const focusHas = K.focusHas;
  const fx = K.fx;
  const setWorn = K.setWorn;
  const wild = K.wild;
  const P = (/** @type {any[]} */ ...a) => K.P(...a);
  const armStat = (/** @type {any[]} */ ...a) => K.armStat(...a);
  const berserkerRage = (/** @type {any[]} */ ...a) => K.berserkerRage(...a);
  const blocked = (/** @type {any[]} */ ...a) => K.blocked(...a);
  const buffAmount = (/** @type {any[]} */ ...a) => K.buffAmount(...a);
  const buffDuration = (/** @type {any[]} */ ...a) => K.buffDuration(...a);
  const burnWeb = (/** @type {any[]} */ ...a) => K.burnWeb(...a);
  const capped = (/** @type {any[]} */ ...a) => K.capped(...a);
  const cls = (/** @type {any[]} */ ...a) => K.cls(...a);
  const damageMonster = (/** @type {any[]} */ ...a) => K.damageMonster(...a);
  const deepMagic = (/** @type {any[]} */ ...a) => K.deepMagic(...a);
  const elemental = (/** @type {any[]} */ ...a) => K.elemental(...a);
  const emit = (/** @type {any[]} */ ...a) => K.emit(...a);
  const ensureDist = (/** @type {any[]} */ ...a) => K.ensureDist(...a);
  const floatText = (/** @type {any[]} */ ...a) => K.floatText(...a);
  const hasTalent = (/** @type {any[]} */ ...a) => K.hasTalent(...a);
  const healPlayer = (/** @type {any[]} */ ...a) => K.healPlayer(...a);
  const healerHeal = (/** @type {any[]} */ ...a) => K.healerHeal(...a);
  const heard = (/** @type {any[]} */ ...a) => K.heard(...a);
  const heldWhy = (/** @type {any[]} */ ...a) => K.heldWhy(...a);
  const hitGroup = (/** @type {any[]} */ ...a) => K.hitGroup(...a);
  const isKnown = (/** @type {any[]} */ ...a) => K.isKnown(...a);
  const knownSpells = (/** @type {any[]} */ ...a) => K.knownSpells(...a);
  const log = (/** @type {any[]} */ ...a) => K.log(...a);
  const lvl = (/** @type {any[]} */ ...a) => K.lvl(...a);
  const meet = (/** @type {any[]} */ ...a) => K.meet(...a);
  const mod = (/** @type {any[]} */ ...a) => K.mod(...a);
  const monsterAt = (/** @type {any[]} */ ...a) => K.monsterAt(...a);
  const moveMonster = (/** @type {any[]} */ ...a) => K.moveMonster(...a);
  const mstat = (/** @type {any[]} */ ...a) => K.mstat(...a);
  const noteSpell = (/** @type {any[]} */ ...a) => K.noteSpell(...a);
  const npcAt = (/** @type {any[]} */ ...a) => K.npcAt(...a);
  const onPath = (/** @type {any[]} */ ...a) => K.onPath(...a);
  const ownEffect = (/** @type {any[]} */ ...a) => K.ownEffect(...a);
  const packSize = (/** @type {any[]} */ ...a) => K.packSize(...a);
  const passable = (/** @type {any[]} */ ...a) => K.passable(...a);
  const pyroFire = (/** @type {any[]} */ ...a) => K.pyroFire(...a);
  const restShare = (/** @type {any[]} */ ...a) => K.restShare(...a);
  const soon = (/** @type {any[]} */ ...a) => K.soon(...a);
  const spellAvailable = (/** @type {any[]} */ ...a) => K.spellAvailable(...a);
  const spellCost = (/** @type {any[]} */ ...a) => K.spellCost(...a);
  const spellDesc = (/** @type {any[]} */ ...a) => K.spellDesc(...a);
  const spellElement = (/** @type {any[]} */ ...a) => K.spellElement(...a);
  const spellHold = (/** @type {any[]} */ ...a) => K.spellHold(...a);
  const spellSave = (/** @type {any[]} */ ...a) => K.spellSave(...a);
  const spellShrug = (/** @type {any[]} */ ...a) => K.spellShrug(...a);
  const spring = (/** @type {any[]} */ ...a) => K.spring(...a);
  const steadyAim = (/** @type {any[]} */ ...a) => K.steadyAim(...a);
  const templarSmite = (/** @type {any[]} */ ...a) => K.templarSmite(...a);
  const throwArm = (/** @type {any[]} */ ...a) => K.throwArm(...a);
  const useItem = (/** @type {any[]} */ ...a) => K.useItem(...a);
  const vowed = (/** @type {any[]} */ ...a) => K.vowed(...a);

  function boltTargets(range, pierce) {
    const p = P();
    const [dx, dy] = DIRS[p.dir];
    const out = [];
    for (let i = 1; i <= range; i++) {
      const x = p.x + dx * i, y = p.y + dy * i;
      if (!passable(x, y)) break;
      const m = monsterAt(x, y);
      if (m && m.disguised && !m.creaked) continue;   // a barrel to a spell, until it has given itself away
      if (m) { out.push(m); if (!pierce) break; }
    }
    return out;
  }
  /**
   * Where fire that strikes nothing comes down: on the first spilt oil in its
   * flight (it is aimed there), or else the last open square it reaches.
   */
  function boltEnd(range) {
    const p = P(), [dx, dy] = DIRS[p.dir];
    let end = null;
    for (let i = 1; i <= range; i++) {
      const x = p.x + dx * i, y = p.y + dy * i;
      if (!passable(x, y)) break;
      end = { x, y };
      const f = elements.fieldAt(x, y);
      if (f && f.k === 'oil') break;
    }
    return end;
  }
  /** Whether fire that strikes nothing would set something alight where it comes down. */
  const fireCatches = range => { const end = boltEnd(range); return !!end && !!elements.fuel(end.x, end.y); };
  /** How far a bolt reaches, Radiance included. */
  // (a Pyromancer's Burning Hands fans down the passage, so they can light oil from a safe distance)
  const spellRange = sp => sp.range + (sp.holy && hasTalent('radiance') ? 2 : 0) + (sp.id === 'thorn_lash' && hasTalent('long_thorns') ? 2 : 0) + (sp.id === 'burning_hands' && onPath('pyromancer') ? 2 : 0);
  /** Why casting this now would waste the points, or null if it would not. */
  /** Whether cold cast down the corridor would come down by a smouldering floor's crack not yet sealed, and seal it. */
  function coldSeals(range) {
    const end = boltEnd(range);
    return !!end && elements.vents().some(v => !v.sealed && Math.abs(v.x - end.x) + Math.abs(v.y - end.y) <= 1);
  }
  function spellWasteReason(sp) {
    const p = P();
    // (a druid's healing mends a hurt companion too, so it is not wasted on them)
    const kinHurt = p.cls === 'druid' && !!companion.here() && companion.here().hp < companion.here().maxHp;
    if (sp.kind === 'heal' && p.hp >= p.maxHp && !kinHurt) return `You are unhurt. ${sp.name} would be wasted.`;
    // fire burns a web away, so a webbed caster's flame is never wasted
    // (nor where it comes down on spilt oil or moss, which it sets alight)
    if (sp.kind === 'bolt' && !(sp.fire && p.webbed > K.G.t) && !boltTargets(spellRange(sp), sp.pierce).length && !(spellElement(sp) === 'fire' && fireCatches(spellRange(sp))) && !(spellElement(sp) === 'cold' && coldSeals(spellRange(sp)))) {
      return `Nothing within reach for ${sp.name} to strike.`;
    }
    if (sp.kind === 'buff' && ownEffect(sp.stat) >= buffAmount(sp)) return `${sp.name} is already upon you.`;
    if (sp.kind === 'shape' && wild.shaped(p)) return 'You are a bear already.';
    if (sp.kind === 'root' && !wild.rootTargets(spellRange(sp)).length) return `Nothing within reach for ${sp.name} to hold.`;
    return null;
  }
  // A spell takes time, and shares the swing's timer. Casting used to cost
  // nothing: a cleric could bless, ward, heal and strike in the same instant,
  // and a mage could empty their points as fast as they could tap Cast. Now
  // each moment is a choice between them. A class may cast faster or slower
  // than this: a mage's words are quick, a cleric's prayers are not.
  const CAST_MS = 800;
  /** How each spell looks, and how long its effect plays. */
  // How far into each picture the spell reaches its target: the darts fly for
  // half of theirs, the fan of flame a little less; lightning and a shaft of
  // light are there at once. What the blow looks like waits for that moment.
  const SPELL_IMPACT = { missile: 0.5, hands: 0.45, cone: 0.3, pillar: 0.15, smite: 0.08, lightning: 0 };
  const SPELL_FX = {
    magic_missile: ['missile', 650], burning_hands: ['hands', 450], shield: ['buff', 600], lightning: ['lightning', 380],
    cone_cold: ['cone', 520], cure_light: ['heal', 800], bless: ['buff', 600], smite: ['smite', 560],
    cure_serious: ['heal', 850], protection: ['buff', 600], flame_strike: ['pillar', 700],
    thorn_lash: ['missile', 600], wild_shape: ['buff', 700], mending_moss: ['heal', 800], entangle: ['smite', 560],
    call_lightning: ['lightning', 380], insect_plague: ['cone', 560],
  };
  /** Show a spell's effect: where it lands, or the square ahead if nowhere. */
  /** How long a scroll takes to read and burn away, and the colour its writing kindles. */
  const READ_MS = 1000;
  const SCROLL_GLOW = { fire: '#ff7020', heal: '#60e080', map: '#70b0ff', teleport: '#c080ff', uncurse: '#ffe8a0' };
  /** A spell's picture; delay puts it off (a scroll's fire waits for the page to burn), from moves where it starts, as fractions of the view. */
  function spellFx(style, color, dur, targets, reach, delay = 0, from = null) {
    const p = P(), [dx, dy] = DIRS[p.dir];
    fx.spells.push({ style, color, born: K.realNow + delay, until: K.realNow + delay + dur, from,
      pts: targets.map(m => ({ x: m.rx + 0.5, y: m.ry + 0.5 })),
      ahead: { x: p.x + dx * (reach || 1) + 0.5, y: p.y + dy * (reach || 1) + 0.5 } });
  }
  function castSpell(sp) {
    if (K.G.status !== 'playing') return false;
    const p = P();
    K.queuedAttack = false;
    if (p.held > K.G.t) { blocked(heldWhy()); return false; }
    if (!spellAvailable(sp)) { log(`You are not experienced enough to cast ${sp.name}.`, 'bad'); return false; }
    // choosing a spell readies it on the Cast button, even if it cannot fly
    // yet: a mage picks Burning Hands before the fight, not during it
    K.G.lastSpell = sp.id;
    if (p.sp < spellCost(sp)) { log('Not enough spell points.', 'bad'); Sound.play('error'); return false; }
    const waste = spellWasteReason(sp);
    if (waste) { log(waste, 'bad'); Sound.play('error'); emit('waste'); return false; }
    if (K.G.t < p.nextAttack) { blocked('You are still recovering from your last action.'); return false; }
    // the words are heard
    p.noiseAt = K.G.t;
    p.nextAttack = K.G.t + Math.round((cls().castMs || CAST_MS) * (hasTalent('quick_words') ? 0.75 : 1));
    // a bear cannot say the words: the druid lets it go to speak any other spell
    if (sp.kind !== 'shape' && wild.shaped(p)) wild.end('cast');
    p.sp -= spellCost(sp);
    noteSpell(sp);
    K.G.lastSpell = sp.id;
    fx.castUntil = K.realNow + 260; fx.castColor = sp.color; fx.castAt = K.realNow;
    Sound.play('cast', { spell: sp.id });
    const look = SPELL_FX[sp.id] || ['buff', 500];
    if (sp.kind !== 'bolt' && sp.kind !== 'root') spellFx(look[0], sp.color, look[1], [], 1);
    switch (sp.kind) {
      case 'heal': { const n = healerHeal(Math.round(d(...sp.heal(p.level)) * (hasTalent('healing_hands') || hasTalent('green_hands') ? 4 / 3 : 1) * (sp.id === 'mending_moss' && onPath('grovewarden') ? 1.25 : 1) * (focusHas('mercy') ? 1.25 : 1) * (setWorn('dawn') ? 1.25 : 1) * deepMagic())); const hpWas = p.hp; healPlayer(n); const kin = p.cls === 'druid' ? companion.mend(n) : 0; log(`You cast ${sp.name} and heal ${p.hp - hpWas}.${hasTalent('healing_hands') ? ' (Healing Hands)' : ''}${focusHas('mercy') ? ` (${ITEMS[p.eq.shield.t].name})` : ''}`, 'good'); if (kin) log(`${K.G.companion.name} is mended ${kin} with you.`, 'good'); break; }
      case 'buff':
        p.effects[sp.stat] = { amount: buffAmount(sp), until: K.G.t + buffDuration(sp), src: sp.id };
        log(`You cast ${sp.name}. ${spellDesc(sp)}`, 'good');
        if (sp.id === 'shield' && hasTalent('mirror_image')) { p.mirrors = 2; log('Two images of you shimmer into being at your side.', 'good'); }
        break;
      case 'shape': wild.begin(); break;
      case 'root': {
        spellFx(look[0], sp.color, look[1], wild.rootTargets(spellRange(sp)), spellRange(sp));
        wild.entangle(spellRange(sp));
        break;
      }
      case 'bolt': {
        if (sp.fire) burnWeb();
        const targets = boltTargets(spellRange(sp), sp.pierce);
        spellFx(look[0], sp.color, look[1], targets, spellRange(sp));
        if (!targets.length) {
          // fire that strikes nothing still lands somewhere: on spilt oil, or moss, it catches
          // (and says so, not that it struck nothing, with the fire's own line kept back)
          const end = spellElement(sp) === 'fire' ? boltEnd(spellRange(sp)) : null, kind = end ? elements.fuel(end.x, end.y) : '';
          if (end && kind) {
            log(`Your ${sp.name} sets the ${kind === 'oil' ? 'oil' : 'moss'} alight!`, 'good');
            lvl().fireSaid = K.G.t + 4000;
            elements.scorch(end.x, end.y);
          } else {
            // (cold that strikes nothing still lands somewhere: by a smouldering floor's crack, it seals it)
            const coldEnd = spellElement(sp) === 'cold' ? boltEnd(spellRange(sp)) : null;
            if (!(coldEnd && elements.seal(coldEnd.x, coldEnd.y))) log(`Your ${sp.name} strikes nothing.`);
            if (end) elements.scorch(end.x, end.y);
          }
          break;
        }
        // an Empowered or Radiant spell says so in every line it hits with
        K.castingName = (sp.holy && hasTalent('radiance') ? 'radiant ' : hasTalent('empower') ? 'empowered ' : '') + sp.name;
        K.fxDelay = Math.round(look[1] * (SPELL_IMPACT[look[0]] || 0));
        const struck = new Set();
        try {
          for (const m of targets) {
            // (a spell that slides off a dark elf does nothing to it at all, nor to the place it stands)
            if (spellShrug(m, sp, (sp.pierce || sp.area) && packSize(m) > 1)) { m.awake = true; meet(m); continue; }
            if ((sp.pierce || sp.area) && packSize(m) > 1) log(`${sp.name} engulfs all ${packSize(m)} of the ${mstat(m).name}s!`, 'good');
            // a Crystal Orb adds one to each of the spell's dice, up to two
            const dice = sp.dmg(p.level);
            let dmg = elemental(m, d(...dice) + (focusHas('die') ? Math.min(2, dice[0]) : 0), spellElement(sp));
            if (sp.holy && mstat(m).undead) dmg *= 2;
            // an Orb of Storms drives the cold and the lightning harder; a Sunburst, the Smite
            if (focusHas('storm') && FROST_SPELLS.includes(sp.id)) dmg = Math.round(dmg * 1.2);
            if (focusHas('wrath') && (sp.holy || sp.id === 'flame_strike')) dmg = Math.round(dmg * 1.25);
            if (sp.holy && hasTalent('radiance')) dmg = Math.round(dmg * 1.5);
            if (hasTalent('empower')) dmg = Math.round(dmg * 1.2);
            if (sp.id === 'thorn_lash' && hasTalent('long_thorns')) dmg += 2;
            if (sp.id === 'call_lightning' && hasTalent('stormborn')) dmg = Math.round(dmg * 1.25);
            dmg = Math.round(dmg * deepMagic());
            if (sp.fire) dmg = pyroFire(dmg);
            dmg = templarSmite(sp, dmg);
            // a blast can be ridden out: a foe that saves takes three quarters of it (a group rides it out
            // together, as it takes one roll of the dice; a heap of bones does not, nor a boss the blast cannot reach)
            const unreached = m.wardUntil > K.G.t && mstat(m).boss && !m.throne;
            if (sp.save && !m.collapsed && !unreached) {
              const sv = spellSave(m, sp.save);
              if (sv.pass) {
                dmg = Math.max(1, Math.round(dmg * SAVED_SHARE));
                floatText(m, 'saves', '#c8c8d8');
                const many = (sp.pierce || sp.area) && packSize(m) > 1;
                log(`The ${mstat(m).name}${many ? 's' : ''} ${sp.save === 'con' ? (many ? 'brace' : 'braces') + ' against' : (many ? 'twist' : 'twists') + ' from'} the worst of your ${sp.name}.${sv.note}`);
              }
            }
            // Rime, or a Frostweaver: the cold and the lightning hold back whatever they touch
            const hold = spellHold(sp);
            if (hold) { m.nextAct = Math.max(m.nextAct, K.G.t) + hold; if (m.windup) m.windup.until += hold; if (FROST_SPELLS.includes(sp.id)) K.legends.chill(m, hold); }
            // a bolt that tears through everything in its path, or a blast that
            // fills the square, takes a whole group; a dart only the front one
            const tag = sp.fire ? 'burn' : 'fire';
            if (sp.pierce || sp.area) hitGroup(m, dmg, tag); else damageMonster(m, dmg, tag);
            // and the place answers it: water carries the lightning, freezes in the cold; moss and oil burn
            elements.strike(m, spellElement(sp), dmg, 'spell', struck);
          }
        } finally { K.castingName = ''; K.fxDelay = 0; }
        break;
      }
    }
    emit('stats');
    return true;
  }
  // ---------- class abilities ----------
  // A fighter and a thief have no spells, so each has a move of their own on
  // the Cast button. The fighter's Bash breaks the blow or trick being drawn
  // back in front of them and sets the foe reeling back. (It once left the foe
  // open as well, and was worth fourteen wins in a hundred: too much.) The thief's Smoke
  // makes everything close by lose them, as good as asleep to them for a few
  // seconds: time to slip away, or to land the double blow on a sleeping foe.
  // Each path gives its class's move a twist.
  const ABILITIES = { fighter: { id: 'bash', name: 'Bash', cool: 15000 }, thief: { id: 'smoke', name: 'Smoke', cool: 24000 }, ranger: { id: 'snare', name: 'Snare', cool: 16000 } };
  const SNARE_REACH = 5, SNARE_MS = 2500;
  const SMOKE_MS = 3000, SMOKE_REACH = 3;
  // how long smoke stalls the lich or the Warlord, who see through it
  const SMOKE_BOSS_MS = 1800;
  // how long a foe that lost you in smoke stays near and wary after it clears: no resting beside it
  const SMOKE_ALERT_MS = 5000;
  /** This hero's move, if their class has one. */
  const abilityOf = (p = P()) => ABILITIES[p.cls] || null;
  // (renown's Well Practised takes a tenth off, twice at most)
  const abilityCool = a => (1 - (P().perkQuick || 0)) * (a.id === 'bash' && capped('rally') ? 0.5 : 1) * (a.id === 'smoke' && onPath('trickster') ? (capped('quick_smoke') ? 10000 : 16000) : a.id === 'bash' && hasTalent('shield_slam') ? 10000 : a.id === 'snare' ? (hasTalent('long_snare') ? 12000 : 16000) - (onPath('warden') ? 3000 : 0) : a.cool);
  /** Seconds until the move is ready again, 0 when it is. */
  const abilityLeft = () => Math.max(0, Math.ceil(((P().abilityReady || 0) - K.G.t) / 1000));
  function useAbility() {
    const p = P(), a = abilityOf();
    if (!a) return false;
    if (abilityLeft()) { log(`${a.name} is not ready yet: ${abilityLeft()}s.`, 'bad'); Sound.play('error'); return false; }
    return a.id === 'bash' ? bash(a, p) : a.id === 'snare' ? snare(a, p) : smoke(a, p);
  }
  /**
   * A ranger's Snare: a weighted cord thrown at the first foe down the
   * corridor ahead, five squares at most. It stands caught a moment, the blow
   * it was drawing back broken off (the lich's rite goes on, and the lich
   * shrugs free in half the time). A Warden's bites and holds longer.
   */
  function snare(a, p) {
    const [dx, dy] = DIRS[p.dir];
    const reach = SNARE_REACH + (onPath('sharpshooter') ? 2 : 0);
    let m = null;
    for (let i = 1; i <= reach && !m; i++) {
      const x = p.x + dx * i, y = p.y + dy * i;
      if (i > 1 && !passable(x, y)) break;
      const t = monsterAt(x, y);
      if (t && !t.collapsed) m = t;
      else if (!passable(x, y)) break;
    }
    if (!m) { log('There is nothing down the corridor ahead to snare.', 'bad'); Sound.play('error'); return false; }
    const mb = mstat(m);
    const rite = !!(m.windup && m.windup.move === 'rite');
    const broke = !rite && !!(m.windup || m.volley);
    if (!rite) { m.windup = null; m.volley = null; }
    m.pressing = false;
    // (a Sharpshooter's snare holds longest: kept at range, a foe held is a foe shot, and on
    // Hard it trailed the Warden by some thirteen points with no better way to stay out of reach)
    const hold = (SNARE_MS + (hasTalent('long_snare') ? 1500 : 0) + (onPath('warden') ? 1000 : 0) + (onPath('sharpshooter') ? 1500 : 0)) / (mb.boss ? 2 : 1);
    if (!rite) m.nextAct = Math.max(m.nextAct, K.G.t + hold);
    m.snaredUntil = K.G.t + hold; m.heldBy = 'snare';
    m.awake = true;
    p.abilityReady = K.G.t + abilityCool(a);
    meet(m);
    // the cord is whirled and let fly, its two weights turning about each other down the corridor,
    // heard as it leaves the hand
    const far = Math.abs(m.x - p.x) + Math.abs(m.y - p.y);
    K.fxDelay = throwArm('cord', 'cord', '#c8a868', CORD_SQUARE * far, [m], far, () => Sound.play('shoot', { w: 'sling' }));
    try {
      floatText(m, 'snared', '#e8d8a0');
      log(`Your cord wraps the ${mb.name}${broke ? ' and breaks off its blow' : ''}. ${rite ? 'Its rite goes on.' : 'It stands caught!'}`, 'good');
      if (onPath('warden')) damageMonster(m, Math.max(1, d(1, 6) + mod(p.stats.dex)), 'snare');
    } finally { K.fxDelay = 0; }
    return true;
  }
  /**
   * Steady Aim, a ranger's: a shot from a bow or sling (drawn and aimed, not
   * thrown) at a foe two squares off or more, +1; a Sharpshooter's at three
   * or more, +3 more. It was +2 and came with throwing knives too, so the
   * knives, cheap and quick, were what a ranger held, never the Long Bow;
   * once rangers held their bows the +2 on its long reach was too much.
   */
  function rangerAim(m, atRange) {
    const p = P();
    if (!atRange || p.cls !== 'ranger' || !(p.eq.weapon && ITEMS[p.eq.weapon.t].aimed)) return 0;
    const far = Math.abs(m.x - p.x) + Math.abs(m.y - p.y);
    return steadyAim(far) + (onPath('sharpshooter') && far >= 3 ? (capped('deadeye') ? 5 : 3) : 0);
  }
  /** A Warden's snared foe takes 2 more from every blow and arrow. */
  const wardenHold = m => (onPath('warden') && m.snaredUntil > K.G.t ? (capped('iron_snare') ? 4 : 2) : 0);
  // how long after the Bash button the shove lands (a third of the renderer's BASH_MS)
  const BASH_LANDS = 150;
  function bash(a, p) {
    const [dx, dy] = DIRS[p.dir], m = monsterAt(p.x + dx, p.y + dy);
    if (!m || m.collapsed) { log('There is nothing in front of you to bash.', 'bad'); Sound.play('error'); return false; }
    const mb = mstat(m), shield = !!(p.eq.shield && !ITEMS[p.eq.shield.t].focus), what = shield ? 'shield' : p.eq.weapon ? 'pommel' : 'fist';
    // a barrel bashed that was a mimic springs open before it is named
    if (m.disguised) spring(m, 'struck');
    // any blow or trick it was drawing back is broken off; the lich's rite goes on through it
    const rite = !!(m.windup && m.windup.move === 'rite');
    const broke = !rite && !!(m.windup || m.volley);
    if (!rite) { m.windup = null; m.volley = null; }
    m.pressing = false;
    // a shield rings a foe harder than a pommel; a Knight's sets it back further still
    const stagger = (shield ? 800 : 500) + (onPath('knight') ? 700 : 0);
    if (!rite) m.nextAct = Math.max(m.nextAct, K.G.t + (mb.boss ? stagger / 2 : stagger));
    p.abilityReady = K.G.t + abilityCool(a);
    meet(m);
    // the shove: the shield (or the pommel, or a fist) driven into it, and it reels from the blow
    // when the blow lands (see BASH_MS in the renderer), the white of a hit and a jolt with it
    fx.bashAt = K.realNow; fx.bashKind = what;
    K.fxDelay = BASH_LANDS;
    try {
      m.flashAt = K.realNow + K.fxDelay; m.flashUntil = m.flashAt + 130;
      if (K.realNow >= fx.shakeUntil) { fx.shakeAmp = shield ? 3 : 2; fx.shakeMs = 180; fx.shakeUntil = K.realNow + K.fxDelay + 180; }
      { const o = heard(m); soon(() => Sound.play('block', o)); }
      if (!rite) floatText(m, broke ? 'broken off' : 'reels', '#e8d8a0');
      log(`You bash the ${mb.name} with your ${what}${broke ? ' and break off its blow' : ''}. ${rite ? 'Its rite goes on.' : 'It reels back!'}`, 'good');
      // a Rallying Bash puts heart back into the one who swings it
      if (capped('rally')) healPlayer(d(1, 6));
      // a Berserker puts weight behind it: the bash is a blow of its own
      if (onPath('berserker')) damageMonster(m, Math.max(1, d(1, 6) + mod(armStat(p)) + berserkerRage()), 'bash');
    } finally { K.fxDelay = 0; }
    // Shield Slam: it goes back a square, if the square behind it is open, and is dazed a second
    // longer: without that it walked straight back in with the first move, and the slam cost tempo
    if (hasTalent('shield_slam') && lvl().monsters.includes(m) && !m.collapsed && !mb.boss) {
      const bx = m.x + dx, by = m.y + dy;
      // (it starts to slide back when the shield lands, not as the arm begins to move)
      if (passable(bx, by) && !monsterAt(bx, by) && !npcAt(bx, by) && !companion.at(bx, by)) { moveMonster(m, bx, by); m.moveT0 += BASH_LANDS; m.moveT1 += BASH_LANDS; m.nextAct = Math.max(m.nextAct, K.G.t + stagger + 1000); log(`The ${mb.name} is knocked back a square, dazed.`, 'good'); }
    }
    return true;
  }
  function smoke(a, p) {
    const L = lvl();
    ensureDist();
    let lost = 0, committed = 0, stalled = '';
    for (const m of L.monsters) {
      const di = K.distField[m.y * L.w + m.x];
      // a blow already on its way still comes: smoke is for getting clear, not for being saved
      if (!(di >= 0 && di <= SMOKE_REACH) || m.collapsed) continue;
      // (one drawn back at the hound is the hound's to take: the smoke still hides the hero,
      // and the blow is lost with it, or it waited frozen and fell on the hound unwarned)
      // the lich and the Warlord, the ends of the shorter delves, see through smoke, but it holds them
      // back most of two seconds and what they were drawing back falls apart in it (the lich's rite
      // goes on): a thief met them at the end of a short run with little else, and won 62% of
      // two-floor delves where every other class won 87% or more
      if (m.id === 'lich' || m.id === 'warlord') {
        // (the rite goes on, and on time: holding the lich back would hold its rite back with it)
        if (m.windup && m.windup.move === 'rite') continue;
        if (m.windup || m.volley) { m.windup = null; m.volley = null; floatText(m, 'lost its aim', '#eef0ff'); }
        m.pressing = false;
        m.nextAct = Math.max(m.nextAct, K.G.t + SMOKE_BOSS_MS);
        stalled = mstat(m).name;
        continue;
      }
      if ((m.windup && m.windup.kind !== 'pet') || m.volley) { committed++; continue; }
      if (m.windup) m.windup = null;
      m.pressing = false;
      // another boss sees through smoke, though it spoils its aim for a moment
      if (mstat(m).boss) { m.nextAct = Math.max(m.nextAct, K.G.t + 600); continue; }
      // a foe that had you is hunting for you in the grey, and stays near for a while after:
      // no resting beside it. A sleeper never knew you were there, and stays as it was.
      if (m.awake) { lost++; floatText(m, 'lost you', '#eef0ff'); m.smoked = K.G.t + SMOKE_ALERT_MS + (onPath('assassin') ? 4500 : SMOKE_MS); }
      m.awake = false; m.fleeing = false; m.nextAct = K.G.t + 400;
      // and a zombie's grip loosens as it loses you
      if (p.grabbed && p.grabbed.uid === m.uid) p.grabbed = null;
    }
    p.smokeUntil = K.G.t + (onPath('assassin') ? 4500 : SMOKE_MS);
    p.abilityReady = K.G.t + abilityCool(a);
    fx.smokeUntil = K.realNow + (p.smokeUntil - K.G.t);
    Sound.play('snuff');
    const coming = committed ? ` ${committed === 1 ? 'A blow already drawn back is' : 'Blows already drawn back are'} still coming.` : '';
    log(lost ? `You crush a smoke pellet underfoot. In the choking grey, ${lost === 1 ? 'your foe loses' : `${lost} foes lose`} you.${coming}`
      : committed ? `You crush a smoke pellet underfoot, but it is too late to hide from a blow already drawn back.`
      : stalled ? `You crush a smoke pellet underfoot. The ${stalled} sees through it, but the grey spoils its aim.`
      : 'You crush a smoke pellet underfoot. Nothing awake is close enough to lose you in it.', lost || stalled ? 'good' : '');
    return true;
  }

  function castLast() {
    const list = knownSpells();
    if (!list.length) return abilityOf() ? useAbility() : quaff();
    return castSpell(readiedSpell(list));
  }

  /**
   * For a hero with no spells the Cast button is Quaff: drink the smallest
   * known healing draught that will not be wasted, the one a player reaches
   * for mid-fight without opening the pack. A caster's bottle beside the
   * life bar does the same.
   */
  function quaff() {
    const p = P();
    K.queuedAttack = false;
    const draughts = p.inv.filter(i => (i.t === 'potion_heal' || i.t === 'potion_xheal') && isKnown(i.t));
    if (!draughts.length) { log('You have no healing draught you know by sight.', 'bad'); Sound.play('error'); return false; }
    const missing = p.maxHp - p.hp;
    const pick = draughts.find(i => i.t === 'potion_heal' && missing < 20) || draughts.find(i => i.t === 'potion_xheal') || draughts[0];
    useItem(pick);
    return true;
  }
  // A scroll worth reading this moment, read in one tap: fire when a foe is
  // ahead for it, restoration when badly hurt, teleport when cornered and
  // failing. Only a scroll known by sight: an unknown one is a gamble to take
  // from the pack. Nothing worth reading, and the button is not there.
  function quickScroll() {
    if (!K.G || K.G.status !== 'playing') return null;
    const p = P(), has = t => p.inv.find(i => i.t === t && isKnown(i.t));
    const fire = has('scroll_fire');
    if (fire && boltTargets(3, false).length) return fire;
    const heal = has('scroll_heal');
    if (heal && p.hp <= p.maxHp * 0.5) return heal;
    const away = has('scroll_teleport');
    if (away && p.hp <= p.maxHp * 0.3 && lvl().monsters.some(m => m.awake && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) <= 1)) return away;
    // a fight coming on and a bare blade: the oil for it (silver when the dead are coming)
    if (!p.coating && p.eq.weapon) {
      const near = lvl().monsters.filter(m => m.awake && !m.collapsed && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) <= 3);
      const oils = p.inv.filter(i => ITEMS[i.t].kind === 'oil');
      if (near.length && oils.length) {
        const undead = near.some(m => mstat(m).undead);
        return oils.find(i => ITEMS[i.t].coat === 'silver' && undead) || oils.find(i => ITEMS[i.t].coat !== 'silver') || oils[0];
      }
    }
    return null;
  }
  function readQuick() {
    K.queuedAttack = false;
    const s = quickScroll();
    if (!s) { log('Nothing you carry would help just now.', 'bad'); Sound.play('error'); return false; }
    useItem(s);
    return true;
  }
  /** Something awake within five steps: no resting. */
  function enemiesNear() {
    const L = lvl();
    ensureDist();
    // one lost in a thief's smoke is still there, and no one sleeps beside it
    // (a mimic still a barrel is a barrel, whatever woke the floor)
    return L.monsters.some(m => { const dd = K.distField[m.y * L.w + m.x]; return !m.disguised && (m.awake || (m.smoked || 0) > K.G.t) && dd >= 0 && dd <= 5; });
  }
  /**
   * What the Rest button will do: rest, saying how well once rests here grow
   * thin, or with something close, nothing (Foes near). It never drinks: a
   * button that turned into Quaff in a fight spent potions nobody meant to.
   */
  function restLabel() {
    if (!K.G || K.G.status !== 'playing') return 'Rest';
    if (vowed('iron')) return 'Vowed';
    if (enemiesNear()) return 'Foes near';
    const share = restShare();
    return share >= 1 ? 'Rest' : share >= 0.5 ? 'Rest \u00bd' : share > 0 ? 'Rest \u00bc' : 'No rest';
  }
  /** What the Cast button will do: the readied spell, or Quaff for the spell-less. */
  function castLabel() {
    const list = knownSpells();
    const a = abilityOf();
    if (!list.length && a) return abilityLeft() ? `${a.name} ${abilityLeft()}s` : a.name;
    if (!list.length) return P().inv.some(i => (i.t === 'potion_heal' || i.t === 'potion_xheal') && isKnown(i.t)) ? 'Quaff' : 'Quaff (none)';
    return readiedSpell(list).name;
  }
  /**
   * The spell on the Cast button: the last one cast, while it can be. Unhurt,
   * a healing spell there only said it would be wasted (a new cleric facing
   * a skeleton at full health met Cure Light Wounds), so the button offers
   * the next spell that would do something instead.
   * @param {ReturnType<typeof knownSpells>} list
   */
  function readiedSpell(list) {
    const p = P(), sp = list.find(s => s.id === K.G.lastSpell && spellAvailable(s)) || list[0];
    // (a heal that would help a hurt companion is not passed over)
    if (sp.kind === 'heal' && spellWasteReason(sp)) return list.find(s => s.kind !== 'heal' && spellAvailable(s)) || sp;
    // a bear already: the button offers what the druid would let it go for
    if (sp.kind === 'shape' && wild.shaped(p)) return list.find(s => s.kind !== 'shape' && spellAvailable(s)) || sp;
    return sp;
  }


  return { READ_MS, SCROLL_GLOW, abilityLeft, abilityOf, boltEnd, boltTargets, castLabel, castLast, castSpell, enemiesNear, fireCatches, quaff, quickScroll, rangerAim, readQuick, restLabel, spellFx, spellRange, spellWasteReason, useAbility, wardenHold };
}
