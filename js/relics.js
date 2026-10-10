// Relics: named pieces of gear with a history and a power.
//
// Each rides on an ordinary base item (a dagger, a coat of chain) and keeps
// its rules for who may use it, then adds an enchantment and one or two
// powers from RELIC_POWERS, which game.js honours. Every relic turns up at
// most once per run: a few lie on the floors, chosen for the hero's class so
// none of them is dead weight, and the rest are what the traders keep behind
// the counter for anyone with the coin.

import { Rng } from './rng.js';
import { ITEMS, CLASSES, armorFits, shieldFits } from './data.js';

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
  thorns: 'Barbed: whatever strikes you in close combat takes 1d4 damage back.',
  flame:  'Flaming: +1d4 fire damage, and its burns stop a troll regrowing.',
  // worn on a finger or at the throat (see the rings and amulets in data.js)
  protect: 'Protection: armour class +1, more if finely made.',
  might:  'Might: +1 to hit and to damage, more if finely made.',
  evasion: 'Evasion: +2 to every saving throw.',
  seer:   'The Seer: +6 to spot traps, and hidden doors show as you pass.',
  warmth: 'Warmth: cold does half as much to you.',
  fireward: 'Fire-warded: a wyrm\'s fire does half as much to you.',
  emberwalk: 'Ember-walker: fire on the floor does not burn you, and an emberling\'s flare or the Heartforged\'s stamp does half as much.',
  lifesave: 'Life Saving: the blow that would kill you leaves you at half your life instead, once.',
  // a druid's: carried into the shape as it is taken, though the bear holds nothing
  wild: 'Wild: your Wild Shape lasts ten seconds longer, and its hide is 4 thicker.',
  webwalk: 'Spider-blessed: no web holds you, spat or woven.',
  // the legendary pieces' own, one to a path (see LEGEND below): each turns the way that path fights
  bastion: 'Bastion: a blow caught on your shield is caught whole, and your Bash is ready again at once.',
  harvest: 'Harvest: below half your life, every foe you fell heals you 1d8.',
  sunfire: 'Sunfire: your blows set the undead burning with holy fire, 1d4 a second for three seconds.',
  overflow: 'Overflow: healing past your full life is kept as a ward of light that takes blows for you, up to a quarter of your life, for a minute.',
  pyre: 'Pyre: a foe that dies burning bursts, scorching everything beside it for 2d6 and setting any oil or moss there alight.',
  shatter: 'Shatter: a foe held back by your cold takes a third more from everything you deal, and one that dies so shatters, holding back those beside it.',
  unseen: 'Unseen: a foe you slay with a strike from the shadows lets you melt back into them, and your next blow within four seconds strikes from the shadows too.',
  mock: 'Mocking: a blow you slip aside from leaves its maker open, as an answered trick does.',
  pierce: 'Piercing: an arrow that fells its mark flies on into the next foe behind it.',
  bind: 'Binding: each of your blows and arrows that lands on a snared foe holds it a second longer.',
  feast: 'Feast: in Wild Shape, every foe you fell heals you 1d6 and keeps the shape five seconds longer.',
  rootbond: 'Rootbond: a foe held by your roots takes 2 more from every blow, yours and your companion\'s, and every foe your companion fells heals you 1d4.',
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

/**
 * A well-made piece can carry a quality of its make as well, named in front:
 * a Heavy Mace, a Sturdy Chain Mail of Warding. Found hidden, like the rest
 * of its make, until worn, studied or appraised.
 */
const GEAR_PREFIXES = { weapon: ['heavy', 'true'], armor: ['sturdy', 'blessed'], shield: ['sturdy', 'blessed'] };
const PREFIX_NAME = { heavy: 'Heavy', true: 'True', sturdy: 'Sturdy', blessed: 'Blessed' };
const PREFIX_DESC = { heavy: '+1 damage with every blow', true: '+1 to hit', sturdy: '+1 armour class', blessed: '+1 to every saving throw' };

/**
 * Three pairs of relics were made to go together. Each pair does more worn
 * at once, over what either does alone.
 */
const RELIC_SETS = {
  stair: { name: 'the Stairwarden\'s Arms', pieces: ['kests_bulwark', 'rustwarden'], text: 'Worn together: +2 armour class.' },
  night: { name: 'the Nightwalk', pieces: ['whisper', 'shadowskin'], text: 'Worn together: a strike from the shadows hits a step harder, double damage becoming triple.' },
  dawn: { name: 'the Order of the Dawn', pieces: ['dawnbringer', 'sisters_buckler'], text: 'Worn together: healing spells heal a quarter more, and your blows deal +1d4 to the undead.' },
};
/** The set a relic belongs to, if any. */
const setOf = id => Object.keys(RELIC_SETS).find(k => RELIC_SETS[k].pieces.includes(id)) || '';

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
  // one for each road at the fork, lying on its last floor and nowhere else:
  // worn at the throat or on a finger, so whoever takes the road can use it
  sextons_locket: { t: 'amulet_ward', e: 1, name: 'the Sexton\'s Locket', powers: ['warmth'], value: 320, route: 'crypts',
    lore: 'The gravedigger who kept these halls wore it to his last shift. Inside, a lock of hair gone white, and the cold cannot find you through it.' },
  // two made for druids, and for no one else, so every other class's relics are dealt as they always were
  oakheart: { t: 'staff', e: 1, name: 'Oakheart', powers: ['wild'], value: 320, cls: 'druid',
    lore: 'Cut from the heart of an oak that was old when the mountain was young. Hold it, and something in you remembers having claws.' },
  mossmantle: { t: 'leather', e: 1, name: 'the Mossmantle', powers: ['mend', 'pure'], value: 340, cls: 'druid',
    lore: 'A cloak of living moss over soft hide, green even this far from the sun. It closes its wearer\'s wounds, and nothing foul takes root in them.' },
  // found only on a smouldering floor, lying where the fire has been (see game.js twistLevel)
  cinder_ring: { t: 'ring_protect', e: 1, name: 'the Cinder Ring', powers: ['emberwalk'], value: 340, twist: 'smouldering',
    lore: 'A plain iron band, still warm, found in the ash where the floor burns. Whoever wore it last walked through fire for a living, and the fire let them.' },
  // Vaelith's own, from her breast as she falls (see game.js), never lying about or on a shelf
  spider_pendant: { t: 'amulet_spider', e: 1, name: 'the Spider Pendant', powers: ['webwalk'], value: 420, champion: 'vaelith', fell: 'the High Priestess falls',
    lore: 'A silver spider with garnet eyes, worn by every High Priestess of the dark elves in turn. Their goddess\'s webs part for whoever wears it, and the blows she sends aside go wide.' },
  // Durgrim's own, from his hand as he falls, as the Pendant is Vaelith's; found only in a
  // sixteen-floor delve, so it is a find beyond the set the Collector's feat asks for (`beyond`)
  thane_ring: { t: 'ring_forge', e: 1, name: 'Durgrim\'s Ring', powers: ['fireward'], value: 420, champion: 'durgrim', fell: 'the Forge-Thane falls', beyond: true,
    lore: 'A heavy band of dark iron with a vein of copper through it, forged in the first fire of the grey dwarves\' hold. Every Thane has worn it at the anvil, and none of them has been burnt.' },
  // Hissra's own, from about her neck as she falls; found only in a sixteen-floor delve, beyond the set
  hissra_tooth: { t: 'amulet_tooth', e: 1, name: 'Hissra\'s Tooth', powers: ['pure'], value: 400, champion: 'hissra', fell: 'the Marsh-Mother falls', beyond: true,
    lore: 'A yellow fang as long as a finger, on a thong of hide, from something that lived in the marsh before the lizardfolk did. Wounds close under it, and nothing foul takes root in them.' },
  warchiefs_knuckle: { t: 'ring_protect', e: 1, name: 'the Warchief\'s Knuckle', powers: ['thorns'], value: 320, route: 'warrens',
    lore: 'An iron ring worn over the knuckle, stolen from one warchief by the next, and the next. Its spikes are brown to the root.' },
  // The legendary pieces: one made for each path, and found only as a champion
  // (or now and then a marked one) falls before a hero already on that path
  // (see legendFor), once a run. Each
  // carries a power that bends the path's own way of fighting, so a run that
  // finds one has a shape to it. Never on a floor or a shelf, and beyond the
  // Collector's count: the codex keeps them apart, as the legends they are.
  bastion: { t: 'towershield', e: 1, name: 'the Bastion', powers: ['bastion'], value: 520, legend: 'knight',
    lore: 'A door from a dwarven gatehouse, cut down and strapped for an arm. It held the gate for a hundred years, and does not mean to start giving way now.' },
  red_harvest: { t: 'battleaxe', e: 2, name: 'Red Harvest', powers: ['harvest'], value: 520, legend: 'berserker',
    lore: 'The haft is wrapped in strips of every banner it has cut down. The worse its bearer bleeds, the lighter it swings.' },
  sunhammer: { t: 'hammer', e: 2, name: 'the Sunhammer', powers: ['sunfire'], value: 520, legend: 'templar',
    lore: 'Forged at dawn on a temple roof, and quenched in the first light. The dead it strikes remember the sun, and burn with the memory.' },
  lantern_mercy: { t: 'holy_symbol', e: 1, name: 'the Lantern of Mercy', powers: ['overflow'], value: 520, legend: 'healer',
    lore: 'A healer\'s sunburst, its rays worn smooth by a lifetime of hands. What it mends beyond the wound it keeps, and spends on the next.' },
  cinderheart: { t: 'crystal_orb', e: 1, name: 'Cinderheart', powers: ['pyre'], value: 520, legend: 'pyromancer',
    lore: 'An orb gone black and red inside, like a coal that will not go out. Whatever it burns, it burns until there is nothing left to hold the fire in.' },
  rimebound: { t: 'spellbook', e: 1, name: 'the Rimebound Grimoire', powers: ['shatter'], value: 520, legend: 'frostweaver',
    lore: 'Its pages are frost, and the words on them are cut, not written. A thing held in its cold grows brittle, and breaks like ice in spring.' },
  last_word: { t: 'dagger', e: 2, name: 'the Last Word', powers: ['unseen'], value: 520, legend: 'assassin',
    lore: 'A plain grey knife with no maker\'s mark. The guild that owned it never spoke its name aloud, and the people it was used on never spoke again.' },
  motley: { t: 'leather', e: 2, name: 'Motley', powers: ['mock'], value: 520, legend: 'trickster',
    lore: 'A jester\'s coat of patched leather, every patch a different colour. Whoever swings at its wearer finds only the laughter, and a gap in their guard.' },
  farstrider: { t: 'longbow', e: 1, name: 'Farstrider', powers: ['pierce'], value: 520, legend: 'sharpshooter',
    lore: 'A bow of black yew, longer than its owner was tall. Its arrows do not stop for the first thing they meet.' },
  thornbinder: { t: 'spear', e: 2, name: 'Thornbinder', powers: ['bind'], value: 520, legend: 'warden',
    lore: 'Its shaft is wound with briar that never dries. Every blow it lands on a thing already caught pulls the knot a little tighter.' },
  moonbound: { t: 'amulet_mind', e: 1, name: 'the Moonbound Torc', powers: ['feast'], value: 520, legend: 'shapeshifter',
    lore: 'A twisted band of pale silver that fits a throat or a bear\'s neck alike. The beast it wakes is always hungry, and never for long.' },
  heartroot: { t: 'staff', e: 2, name: 'Heartroot', powers: ['rootbond'], value: 520, legend: 'grovewarden',
    lore: 'A staff that is still, quietly, a living root. The ground knows it, and holds whatever its bearer and their friends are fighting.' },
};

/** The legendary piece made for this path, if it has one. */
const legendFor = path => Object.keys(RELICS).find(id => RELICS[id].legend === path) || '';

/** Whether this class could ever wear or wield the relic. */
function relicUsableBy(id, cls) {
  const r = RELICS[id], b = ITEMS[r.t], c = CLASSES[cls];
  if (r.cls && r.cls !== cls) return false;
  if (b.kind === 'ring' || b.kind === 'amulet') return true;
  if (b.kind === 'weapon') return b.cls.includes(cls);
  if (b.kind === 'armor') return armorFits(c, b);
  if (b.kind === 'shield') return shieldFits(c, b);
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
  // a road's own relic waits down that road (see routeRelic), never on a trader's shelf
  // (and a twisted floor's own lies on that floor, if the run has one; a champion's own falls with it)
  const pool = rng.shuffle(Object.keys(RELICS).filter(id => !RELICS[id].route && !RELICS[id].twist && !RELICS[id].champion && !RELICS[id].legend && relicUsableBy(id, cls)));
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

/** The relic found only down this road, on its last floor. */
const routeRelic = route => Object.keys(RELICS).find(id => RELICS[id].route === route) || '';
/** The relic found only on a floor of this twist. */
const twistRelic = twist => Object.keys(RELICS).find(id => RELICS[id].twist === twist) || '';

/** The relics the Collector's feat asks for: every one but a find beyond the set. */
const toCollect = () => Object.keys(RELICS).filter(id => !RELICS[id].beyond && !RELICS[id].legend);

export { legendFor, toCollect, routeRelic, twistRelic, RELICS, RELIC_POWERS, GIANTS, GEAR_POWERS, POWER_SUFFIX, GEAR_PREFIXES, PREFIX_NAME, PREFIX_DESC, RELIC_SETS, setOf, relicUsableBy, relicPlan };
