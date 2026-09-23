// Encounters: the dungeon asks you to decide, and your stats decide how it goes.
//
// Each is met at most once per run. A choice may have a cost, paid up front
// and shown before you commit, and a check: a d20 plus one stat's modifier
// (and any class or background knack) against a difficulty that rises a
// little every three floors. Outcomes are lists of effects that game.js knows
// how to apply, and every effect is described back to the player, so nothing
// the dungeon does to you happens silently.
//
// Effect vocabulary: map, xp, goldPerDepth (negative takes, never below
// nothing), hurtFrac (a share of maximum hit points, so a failure costs a
// fighter as much as a mage: flat damage let the sturdy gamble for free),
// hurt [dice], heal ('full' or n), maxHp, food, loot
// (bonus to the loot roll), item {t, q}, buff {stats: [[stat, n]], dur},
// poison, cure, wake, identifyAll, ambush {id, n}, stat [stat, n].

import { Rng } from './rng.js';

const ENCOUNTERS = {
  buried: {
    title: 'Under the Rubble', sprite: 'rubble', depth: [1, 5],
    text: 'A fall of stone has half buried a man in a guild tabard. One hand still moves. "Please," he says. "I know this floor. I can show you the way down."',
    choices: [
      { label: 'Heave the stones off him', check: { stat: 'str', dc: 12 },
        pass: { text: 'The stones grind aside. He sits up coughing, presses a chalk map of the floor into your hands, and limps off toward the stairs.', effects: [{ map: 1 }, { xp: 25 }] },
        fail: { text: 'The pile shifts the wrong way and comes down on both of you. He does not move again.', effects: [{ hurtFrac: 0.2 }] } },
      { label: 'Keep him talking while you dig', check: { stat: 'cha', dc: 12 },
        pass: { text: 'He talks you through where each stone will slide. When he is free he tells you where the last crew hid their stores, and draws you the floor.', effects: [{ map: 1 }, { loot: 1 }] },
        fail: { text: 'He panics and thrashes and the pile settles on him for good. Getting clear of it takes a long time.', effects: [{ food: -15 }] } },
      { label: 'Work out how the pile will fall', check: { stat: 'int', dc: 12 },
        pass: { text: 'You read the stones, pull the one that matters, and the rest slide away from him instead of onto him. He draws you the floor in chalk before he goes.', effects: [{ map: 1 }, { xp: 25 }] },
        fail: { text: 'You pull the wrong stone. It is not only him the pile lands on.', effects: [{ hurtFrac: 0.15 }] } },
      { label: 'Leave him', outcome: { text: 'You step past. After a while he stops asking.', effects: [] } },
    ],
  },

  shrine: {
    title: 'A Shrine to the Old Stone', sprite: 'shrine', depth: [1, 99],
    text: 'A squat idol, older than the delve, sits in a niche worn smooth by hands. The offerings at its feet are fresh. Someone still comes down here to pray.',
    choices: [
      { label: 'Leave an offering of gold', cost: { goldPerDepth: 18 },
        outcome: { text: 'The coins are gone when you look again. For a while you feel watched over.', effects: [{ buff: { stats: [['hit', 2], ['ac', 2]], dur: 180000 } }] } },
      { label: 'Offer your blood', cost: { hurtFrac: 0.25 }, check: { stat: 'con', dc: 12 },
        pass: { text: 'The stone drinks, and gives something back. You feel harder to kill.', effects: [{ maxHp: 4 }] },
        fail: { text: 'The stone drinks. Nothing comes back but a chill.', effects: [] } },
      { label: 'Pray with empty hands', check: { stat: 'wis', dc: 14, knack: [['cleric', null, 3]] },
        pass: { text: 'Warmth from nowhere. Your wounds close and your head clears.', effects: [{ heal: 'full' }, { cure: 1 }] },
        fail: { text: 'When you open your eyes your purse is lighter. The idol has not moved.', effects: [{ goldPerDepth: -12 }] } },
      { label: 'Leave it be', outcome: { text: 'You leave the old stone to whoever still tends it.', effects: [] } },
    ],
  },

  runes: {
    title: 'Words Cut in the Wall', sprite: 'runestone', depth: [2, 99],
    text: 'A slab of dark stone stands out from the wall, cut deep with the archivist\'s cramped hand. The letters seem to crawl when you are not looking at them straight.',
    choices: [
      { label: 'Read them', check: { stat: 'int', dc: 13, knack: [['mage', null, 2], [null, 'tombwise', 2]] },
        pass: { text: 'A catalogue: every draught and scroll the guild ever stored, and what each one looked like. You will know them now.', effects: [{ identifyAll: 1 }, { xp: 30 }] },
        fail: { text: 'The letters bite. You come to on the floor with blood in your mouth.', effects: [{ hurtFrac: 0.25 }] } },
      { label: 'Trace them with a fingertip', check: { stat: 'wis', dc: 12 },
        pass: { text: 'Under your finger they settle into a plan of this floor, and stay settled in your head.', effects: [{ map: 1 }] },
        fail: { text: 'The stone hums. Somewhere far off, things that were sleeping stir.', effects: [{ wake: 1 }] } },
      { label: 'Leave them', outcome: { text: 'Some words are better left unread.', effects: [] } },
    ],
  },

  mercy: {
    title: 'A Wounded Goblin', sprite: 'goblin_hurt', depth: [1, 5],
    text: 'A goblin sits against the wall clutching a wound, a knife held out in a shaking hand. It does not want to fight. "Mercy," it croaks, in something like your tongue.',
    choices: [
      { label: 'Spare it, and ask what it knows', check: { stat: 'cha', dc: 11 },
        pass: { text: 'Between gasps it tells you where its tribe keeps its shinies and which way the stairs lie. Then it is gone into the dark.', effects: [{ map: 1 }, { goldPerDepth: 10 }] },
        fail: { text: 'It spits at you and scrambles away. You are not sure it understood a word.', effects: [] } },
      { label: 'Lift its purse while it pleads', check: { stat: 'dex', dc: 12, knack: [['thief', null, 3]] },
        pass: { text: 'It never feels a thing. Its purse is heavier than a goblin\'s has any right to be.', effects: [{ goldPerDepth: 14 }] },
        fail: { text: 'It is not as weak as it looks. The knife finds you before it runs.', effects: [{ hurtFrac: 0.1 }] } },
      { label: 'Finish it', outcome: { text: 'It is quick. It is not something you will tell anyone about.', effects: [{ xp: 15 }] } },
      { label: 'Leave it', outcome: { text: 'You leave it to its wound and whatever finds it next.', effects: [] } },
    ],
  },

  cache: {
    title: 'The Fourth Crew\'s Strongbox', sprite: 'strongbox', depth: [3, 99],
    text: 'An iron-bound box bearing the fourth crew\'s mark, chained to a ring in the floor. The lock has rusted. The chain has not.',
    choices: [
      { label: 'Force the lid', check: { stat: 'str', dc: 14 },
        pass: { text: 'The hasp tears free. Whatever the fourth crew died protecting, it is yours now.', effects: [{ loot: 2 }, { goldPerDepth: 14 }] },
        fail: { text: 'The lid holds, and the clang rolls away down every corridor. Everything on this floor heard that.', effects: [{ wake: 1 }, { hurtFrac: 0.15 }] } },
      { label: 'Pick the lock', check: { stat: 'dex', dc: 15, knack: [['thief', null, 5]] },
        pass: { text: 'A patient minute, and a soft click.', effects: [{ loot: 2 }, { goldPerDepth: 14 }] },
        fail: { text: 'A needle in the keyhole. Your fingers go numb.', effects: [{ poison: 1 }] } },
      { label: 'Leave it', outcome: { text: 'Whatever is in there, the fourth crew did not live to spend it either.', effects: [] } },
    ],
  },

  voice: {
    title: 'Someone Calls Your Name', sprite: 'wisp', depth: [3, 99],
    text: 'From the dark ahead a voice, warm and familiar, says your name. It knows it. You have not told anyone down here your name.',
    choices: [
      { label: 'Answer it', check: { stat: 'wis', dc: 15 },
        pass: { text: 'You answer, and hold on to yourself while you do. The voice falters, and something that was only pretending to be a person flees from you.', effects: [{ xp: 60 }] },
        fail: { text: 'You answer. Something is taken, and you do not get it back.', effects: [{ maxHp: -3 }] } },
      { label: 'Give it a false name', check: { stat: 'cha', dc: 13 },
        pass: { text: 'It repeats the name you gave it, pleased, and follows the wrong scent into the dark.', effects: [{ xp: 80 }, { maxHp: 2 }] },
        fail: { text: 'It knows. Something cold comes out of the dark for you.', effects: [{ ambush: { id: 'wraith', n: 1 } }] } },
      { label: 'Name the thing that is calling', check: { stat: 'int', dc: 14, knack: [['mage', null, 2], [null, 'tombwise', 2]] },
        pass: { text: 'You know these from the crews\' pages. You say what it is, plainly, and it comes apart like smoke.', effects: [{ xp: 100 }] },
        fail: { text: 'You name the wrong thing. It laughs, in your voice, and something cold brushes past you in the dark.', effects: [{ hurtFrac: 0.2 }] } },
      { label: 'Say nothing', outcome: { text: 'It calls three more times, each time closer, and then gives up.', effects: [] } },
    ],
  },

  fungus: {
    title: 'A Garden of Pale Caps', sprite: 'fungus', depth: [2, 99],
    text: 'Pale mushrooms grow thick on something that was once a person. They smell of warm bread.',
    choices: [
      { label: 'Eat your fill', check: { stat: 'con', dc: 12 },
        pass: { text: 'They taste as good as they smell. You feel full and whole.', effects: [{ food: 60 }, { heal: 'full' }] },
        fail: { text: 'They taste as good as they smell, and then they do not.', effects: [{ food: 20 }, { poison: 1 }] } },
      { label: 'Pick the safe ones for later', check: { stat: 'int', dc: 13 },
        pass: { text: 'You know which caps are which. You wrap two good handfuls for the road.', effects: [{ item: { t: 'ration', q: 2 } }] },
        fail: { text: 'You cannot tell the good ones from the bad, and leave them all.', effects: [] } },
      { label: 'Leave them', outcome: { text: 'Whatever it was, it has fed enough already.', effects: [] } },
    ],
  },

  gambler: {
    title: 'The Gambler\'s Bones', sprite: 'bones', depth: [1, 99],
    text: 'A skeleton sits against the wall, grinning, a cup of dice in its lap and a note pinned through its ribs: BEAT ME AND TAKE THE POT. There is a pot, and a good deal of gold in it.',
    choices: [
      { label: 'Roll against him', cost: { goldPerDepth: 10 }, check: { stat: 'cha', dc: 11 },
        pass: { text: 'Your dice come up higher. The skeleton does not seem to mind.', effects: [{ goldPerDepth: 30 }] },
        fail: { text: 'His dice come up higher. You could swear the grin widens.', effects: [] } },
      { label: 'Just take the pot', check: { stat: 'dex', dc: 14 },
        pass: { text: 'Quick hands. The gold is in your purse before the bones can object.', effects: [{ goldPerDepth: 20 }] },
        fail: { text: 'The bones object. They get up.', effects: [{ ambush: { id: 'skeleton', n: 1 } }] } },
      { label: 'Watch his dice for the trick', check: { stat: 'int', dc: 13 },
        pass: { text: 'His dice are loaded. You swap in your own before the throw, and the pot is yours.', effects: [{ goldPerDepth: 22 }] },
        fail: { text: 'You watch a long while and see nothing. Whatever the trick is, it is better than you.', effects: [] } },
      { label: 'Leave him to his game', outcome: { text: 'He will find another player. He has time.', effects: [] } },
    ],
  },
};

/** Difficulty grows a little every three floors. */
function encounterDc(check, depth) { return check.dc + Math.floor((depth - 1) / 3); }

/**
 * Which encounters sit on which floor, for a whole run, decided by the seed:
 * the same seed always meets the same ones in the same places, none repeats,
 * and they are spread across the run rather than front-loaded. The deepest
 * floor, where the Heart is kept, has none.
 * @returns {string[][]} plan[depth] = encounter ids
 */
function encounterPlan(seed, levels) {
  const rng = new Rng(String(seed) + '|encounters');
  const deck = rng.shuffle(Object.keys(ENCOUNTERS));
  const used = new Set();
  const plan = [];
  const floors = Math.max(1, levels - 1);
  for (let d = 1; d <= levels; d++) {
    plan[d] = [];
    if (d === levels) continue;
    const left = deck.length - used.size, floorsLeft = floors - d + 1;
    const share = left / floorsLeft;
    let n = Math.min(2, Math.floor(share) + (rng.next() < share % 1 ? 1 : 0));
    // Soonest-closing first: an encounter that only belongs on the upper
    // floors must be placed before its window shuts, or a long run spread
    // thin never meets it at all.
    const open = deck.filter(e => !used.has(e) && d >= ENCOUNTERS[e].depth[0] && d <= ENCOUNTERS[e].depth[1])
      .sort((a, b) => Math.min(ENCOUNTERS[a].depth[1], floors) - Math.min(ENCOUNTERS[b].depth[1], floors));
    const lastChance = open.filter(e => Math.min(ENCOUNTERS[e].depth[1], floors) === d).length;
    n = Math.min(2, Math.max(n, lastChance));
    for (const id of open.slice(0, n)) { used.add(id); plan[d].push(id); }
  }
  return plan;
}

export { ENCOUNTERS, encounterDc, encounterPlan };
