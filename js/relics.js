// Relics: named pieces of gear with a history and a power.
//
// Each rides on an ordinary base item (a dagger, a coat of chain) and keeps
// its rules for who may use it, then adds an enchantment and one or two
// powers from RELIC_POWERS, which game.js honours. Every relic turns up at
// most once per run: a few lie on the floors, chosen for the hero's class so
// none of them is dead weight, and the rest are what the traders keep behind
// the counter for anyone with the coin.

import { Rng } from './rng.js';
import { ITEMS, CLASSES } from './data.js';

/** What each power does, in the words the pack shows. */
const RELIC_POWERS = {
  keen:   'Keen: critical hits land one number sooner on the die.',
  swift:  'Swift: strikes 15% faster.',
  undead: 'Bane of the dead: +1d6 damage against the undead.',
  giant:  'Giant-feller: +1d8 damage against ogres, trolls and minotaurs.',
  leech:  'Thirsting: a fifth of the damage it deals comes back to you as health.',
  quiet:  'Muffled: sleeping monsters notice you a square later.',
  mind:   'Well of power: +6 spell points for anyone who has spells to spend them on.',
  mend:   'Mending: heals a hit point every four seconds, even mid-fight.',
  ward:   'Warded: your life force cannot be drained.',
  pure:   'Purifying: poison cannot take hold of you.',
  thorns: 'Barbed: whatever strikes you in melee takes 1d4 damage back.',
  flame:  'Flaming: +1d4 fire damage, and its burns stop a troll regrowing.',
  // worn on a finger or at the throat (see the rings and amulets in data.js)
  protect: 'Protection: armour class +1, more if finely made.',
  might:  'Might: +1 to hit and to damage, more if finely made.',
  evasion: 'Evasion: +2 to every saving throw.',
  seer:   'The Seer: +6 to spot traps, and hidden doors show as you pass.',
  lifesave: 'Life Saving: the blow that would kill you leaves you at half your life instead, once.',
};

/** Ordinary gear found enchanted can carry one of these powers, named by it. */
const GEAR_POWERS = {
  weapon: ['keen', 'swift', 'undead', 'giant', 'leech', 'flame'],
  armor: ['ward', 'pure', 'thorns', 'mend', 'quiet'],
  shield: ['ward', 'pure', 'thorns', 'mend'],
};
/** How a power reads on the end of an ordinary item's name. */
const POWER_SUFFIX = {
  keen: 'of Keenness', swift: 'of Speed', undead: 'of the Dawn', giant: 'of Giant-felling', leech: 'of Thirst',
  flame: 'of Flame', ward: 'of Warding', pure: 'of Purity', thorns: 'of Thorns', mend: 'of Mending', quiet: 'of Silence',
  mind: 'of the Mind',
};

/** Monsters a giant-feller bites into. */
const GIANTS = ['ogre', 'troll', 'minotaur'];

// Names are written as they read mid-sentence ("the Ogre's Toll"); the pack
// capitalises them. value drives the price: a trader asks about twice this, less for charm
const RELICS = {
  grimtooth: { t: 'dagger', e: 2, name: 'Grimtooth', powers: ['keen', 'swift'], value: 300,
    lore: 'A goblin chieftain\'s knife, notched once for every rival it outlived. There is no room left for more notches.' },
  whisper: { t: 'shortsword', e: 2, name: 'Whisper', powers: ['quiet'], value: 240,
    lore: 'Wrapped in grey felt from pommel to guard. Its last owner was never seen, only missed.' },
  thirst: { t: 'longsword', e: 1, name: 'Thirst', powers: ['leech'], value: 380,
    lore: 'The blade is dark where the fuller runs, as if it were never quite cleaned. It feels warmer after a fight.' },
  dawnbringer: { t: 'mace', e: 1, name: 'Dawnbringer', powers: ['undead'], value: 280,
    lore: 'A temple mace with a sunburst head. The dead of the lower halls turn their faces from it.' },
  penitent: { t: 'flail', e: 1, name: 'the Penitent\'s Flail', powers: ['mind'], value: 360,
    lore: 'Carried by a priest who walked down here to atone, and prayed with every step. The prayers are still in it.' },
  ogres_toll: { t: 'battleaxe', e: 1, name: 'the Ogre\'s Toll', powers: ['giant'], value: 420,
    lore: 'Forged by a smith whose village paid one toll too many. The haft is scored with tally marks, all of them ogres.' },
  ninth_circle: { t: 'staff', e: 1, name: 'Staff of the Ninth Circle', powers: ['mind'], value: 340,
    lore: 'Nine rings of black iron are sunk in the wood. Each one hums a different note when a spell is spoken near it.' },
  emberwood: { t: 'staff', e: 2, name: 'Emberwood', powers: ['mend', 'flame'], value: 360,
    lore: 'Cut from a tree that grew around a forge. It is warm to hold, wounds close faster in its warmth, and what it strikes smoulders.' },
  vashti: { t: 'throwknife', e: 2, name: 'Vashti\'s Needles', powers: ['keen'], value: 280,
    lore: 'A juggler\'s knives, balanced so fine they seem to find the gap on their own. Vashti never missed. Once was enough.' },
  heartseeker: { t: 'shortbow', e: 2, name: 'Heartseeker', powers: ['keen'], value: 360,
    lore: 'Yew and horn, strung with something that is not gut. Arrows loosed from it curve, very slightly, toward the heart.' },
  rustwarden: { t: 'chain', e: 1, name: 'Rustwarden Mail', powers: ['ward'], value: 420,
    lore: 'Each ring is stamped with a tiny sigil against the grave. Wraiths touch it and draw back as if burned.' },
  shadowskin: { t: 'leather', e: 2, name: 'Shadowskin', powers: ['quiet'], value: 260,
    lore: 'Black hide that drinks the lantern light. You can hear your own heartbeat louder than your footsteps.' },
  briarcoat: { t: 'studded', e: 1, name: 'Briarcoat', powers: ['thorns'], value: 300,
    lore: 'The studs have been filed to hooks. Anything that grapples with its wearer lets go bleeding.' },
  kests_bulwark: { t: 'shield', e: 2, name: 'Kest\'s Bulwark', powers: ['mend'], value: 380,
    lore: 'Sergeant Kest held a stair with it for a night and a day. The shield remembers standing, and lends it to you.' },
  sisters_buckler: { t: 'buckler', e: 2, name: 'the Sisters\' Buckler', powers: ['pure'], value: 260,
    lore: 'Silvered by a convent of healers. Venom beads on its face like water on wax.' },
};

/** Whether this class could ever wear or wield the relic. */
function relicUsableBy(id, cls) {
  const r = RELICS[id], b = ITEMS[r.t], c = CLASSES[cls];
  if (b.kind === 'weapon') return b.cls.includes(cls);
  if (b.kind === 'armor') return c.armor === 'heavy' || (c.armor === 'light' && b.weight === 'light');
  if (b.kind === 'shield') return !!c.shield;
  return false;
}

/**
 * Which relics this run holds, decided by the seed and the class: a few lie
 * on the floors, spread out and weakest first so the early ones are a treat
 * rather than a whole run's power at once, and the rest wait with the
 * traders. The same seed and class always find the same ones.
 * @returns {{floor: Record<number, string>, shop: string[]}}
 */
function relicPlan(seed, cls, levels) {
  const rng = new Rng(`${seed}|relics|${cls}`);
  const pool = rng.shuffle(Object.keys(RELICS).filter(id => relicUsableBy(id, cls)));
  // keep at least one back for the traders, whenever there are two to share
  const n = Math.min(Math.max(1, Math.round((levels - 1) * 0.4)), Math.max(1, pool.length - 1));
  const chosen = pool.slice(0, n).sort((a, b) => RELICS[a].value - RELICS[b].value);
  // the first floor is for finding your feet, and the last already holds the Heart
  const lo = levels > 2 ? 2 : 1, hi = levels > 2 ? levels - 1 : levels;
  const span = hi - lo + 1;
  const floor = {};
  chosen.forEach((id, i) => {
    let d = lo + Math.floor((i + rng.next()) * span / n);
    while (floor[d] && d < hi) d++;       // two relics never share a floor
    while (floor[d] && d > lo) d--;
    if (!floor[d]) floor[d] = id;
  });
  return { floor, shop: pool.slice(n) };
}

export { RELICS, RELIC_POWERS, GIANTS, GEAR_POWERS, POWER_SUFFIX, relicUsableBy, relicPlan };
