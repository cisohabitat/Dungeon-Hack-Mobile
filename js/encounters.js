// Encounters: the dungeon asks you to decide, and your stats decide how it goes.
//
// Each is met at most once per run. A choice may have a cost (goldPerDepth,
// hurtFrac or food), paid up front and shown before you commit, and a check: a d20 plus one stat's modifier
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
// poison, cure, uncurse, wake, identifyAll, ambush {id, n, early?}, stat [stat, n], traps (where they lie),
// thread (a choice that follows the hero down: see threads in game.js).

import { Rng } from './rng.js';

const ENCOUNTERS = {
  buried: {
    title: 'Under the Rubble', sprite: 'rubble', depth: [1, 5],
    text: 'A fall of stone has half buried a man in a guild tabard. One hand still moves. "Please," he says. "I know this floor. I can show you the way down."',
    choices: [
      { label: 'Heave the stones off him', check: { stat: 'str', dc: 12 },
        pass: { text: 'The stones grind aside. He sits up coughing, presses a chalk map of the floor into your hands, and limps off toward the stairs.', effects: [{ map: 1 }, { xp: 25 }, { thread: 'guide' }] },
        fail: { text: 'The pile shifts the wrong way and comes down on both of you. He does not move again.', effects: [{ hurtFrac: 0.2 }] } },
      { label: 'Keep him talking while you dig', check: { stat: 'cha', dc: 12 },
        pass: { text: 'He talks you through where each stone will slide. When he is free he tells you where the last crew hid their stores, and draws you the floor.', effects: [{ map: 1 }, { loot: 1 }, { thread: 'guide' }] },
        fail: { text: 'He panics and thrashes and the pile settles on him for good. Getting clear of it takes a long time.', effects: [{ food: -15 }] } },
      { label: 'Work out how the pile will fall', check: { stat: 'int', dc: 12 },
        pass: { text: 'You read the stones, pull the one that matters, and the rest slide away from him instead of onto him. He draws you the floor in chalk before he goes.', effects: [{ map: 1 }, { xp: 25 }, { thread: 'guide' }] },
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
      { label: 'Pray with empty hands', check: { stat: 'wis', dc: 14, knack: [['cleric', null, 3], ['druid', null, 2]] },
        pass: { text: 'Warmth from nowhere. Your wounds close and your head clears.', effects: [{ heal: 'full' }, { cure: 1 }, { uncurse: 1 }] },
        fail: { text: 'When you open your eyes your purse is lighter. The idol has not moved.', effects: [{ goldPerDepth: -12 }] } },
      { label: 'Leave it be', outcome: { text: 'You leave the old stone to whoever still tends it.', effects: [] } },
    ],
  },

  // Not in the deck: every delve's last floor holds one, in the room nearest
  // the lich's hall, so the gold carried down and found on the way buys something.
  vigil: {
    title: 'A Vigil Lamp', sprite: 'shrine', depth: [99, 99], final: true,
    text: 'Someone kept a lamp burning here, at the edge of the last halls, and left a bowl beneath it. Coins shine in the bowl. Whatever keeps the lamp lit still answers what is left there.',
    choices: [
      { label: 'Leave gold for a ward against the cold', cost: { goldPerDepth: 25 },
        outcome: { text: 'The flame leans toward you, and the chill of the halls ahead eases off your skin.', effects: [{ buff: { stats: [['ac', 3]], dur: 300000 } }] } },
      { label: 'Leave gold for a sure hand', cost: { goldPerDepth: 20 },
        outcome: { text: 'The flame steadies, and so does your grip.', effects: [{ buff: { stats: [['hit', 3]], dur: 300000 } }] } },
      { label: 'Leave a fortune for both, and the flame\'s warmth', cost: { goldPerDepth: 45 },
        outcome: { text: 'The lamp flares white. You go on warded and sure, and lighter by a fortune.', effects: [{ buff: { stats: [['ac', 3], ['hit', 3]], dur: 300000 } }, { heal: 'full' }] } },
      { label: 'Pray by the light with empty hands', check: { stat: 'wis', dc: 13, knack: [['cleric', null, 3]] },
        pass: { text: 'The light settles on you like a hand. Your wounds close.', effects: [{ heal: 'full' }] },
        fail: { text: 'The lamp gutters and says nothing.', effects: [] } },
      { label: 'Go on without it', outcome: { text: 'You leave the lamp to whoever still tends it.', effects: [] } },
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
        fail: { text: 'It knows. Something cold comes out of the dark for you.', effects: [{ ambush: { id: 'wraith', n: 1, early: ['ghoul', 'skeleton'] } }] } },
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
      { label: 'Pick the safe ones for later', check: { stat: 'int', dc: 13, knack: [['druid', null, 4]] },
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

  prisoner: {
    title: 'The Captive', sprite: 'prisoner', depth: [2, 6],
    text: 'A man hangs in chains from rings in the wall, stripped to his shirt, a goblin brand fresh on his arm. His eyes open when your light reaches him. "They will be back," he whispers. "Please."',
    choices: [
      { label: 'Break the chains', check: { stat: 'str', dc: 13 },
        pass: { text: 'The rings tear out of the stone. He is weak, but he knows this floor, and where they stack their plunder.', effects: [{ map: 1 }, { loot: 1 }, { thread: 'captive' }] },
        fail: { text: 'The chains hold, and the rattle carries. Something is coming to see what the noise was.', effects: [{ wake: 1 }] } },
      { label: 'Pick the shackles', check: { stat: 'dex', dc: 13, knack: [['thief', null, 3]] },
        pass: { text: 'Cheap goblin locks. He presses a healing draught into your hand, the one thing they did not find on him.', effects: [{ item: { t: 'potion_heal', q: 1 } }, { xp: 30 }, { thread: 'captive' }] },
        fail: { text: 'A pin snaps in the lock. The tripwire his captors left does not.', effects: [{ hurtFrac: 0.15 }] } },
      { label: 'Ask what he knows first', check: { stat: 'cha', dc: 12 },
        pass: { text: 'He talks fast: which corridors are trapped, where the stairs lie, who took his sword. You free him when he is done.', effects: [{ map: 1 }, { traps: 1 }, { xp: 40 }, { thread: 'captive' }] },
        fail: { text: 'He is too far gone to make sense. You free him anyway, and he stumbles off into the dark.', effects: [{ xp: 10 }, { thread: 'captive' }] } },
      { label: 'Leave him', outcome: { text: 'You leave him to his chains. His voice follows you a long way.', effects: [] } },
    ],
  },

  well: {
    title: 'An Old Well', sprite: 'well', depth: [1, 99],
    text: 'A ring of worked stone, older than the delve, with a rope going down into a darkness that echoes. Coins glint on the lip, left by others who passed this way.',
    choices: [
      { label: 'Toss in a coin and make a wish', cost: { goldPerDepth: 4 }, check: { stat: 'wis', dc: 13 },
        pass: { text: 'The coin rings off the stone a long way down. Something down there listens, and luck settles on your shoulders.', effects: [{ buff: { stats: [['hit', 2], ['ac', 2]], dur: 180000 } }] },
        fail: { text: 'The coin falls without a sound. You are not sure anything is listening.', effects: [] } },
      { label: 'Climb down the rope', check: { stat: 'dex', dc: 14 },
        pass: { text: 'At the bottom, in a hand-span of water, a hundred years of offerings. You fill your pockets and climb back up.', effects: [{ goldPerDepth: 22 }, { loot: 0 }] },
        fail: { text: 'The rope parts halfway down. The water breaks your fall, mostly.', effects: [{ hurtFrac: 0.2 }] } },
      { label: 'Draw a bucket and drink', check: { stat: 'con', dc: 12 },
        pass: { text: 'The water is cold enough to hurt, and clean. Your wounds ache, then ease.', effects: [{ heal: 'full' }] },
        fail: { text: 'Something lives in the water, and now it lives in you.', effects: [{ poison: 1 }] } },
      { label: 'Leave it', outcome: { text: 'You leave the coins where they lie.', effects: [] } },
    ],
  },

  shelves: {
    title: 'The Archivist\'s Shelves', sprite: 'bookcase', depth: [2, 99],
    text: 'Shelves cut into the rock, still bowed under the archivist\'s books. Most have rotted to pulp. A few have not, and one spine is lettered in gold leaf.',
    choices: [
      { label: 'Search for anything still useful', check: { stat: 'int', dc: 12, knack: [['mage', null, 2], [null, 'tombwise', 2]] },
        pass: { text: 'Behind a rotted ledger, a scroll case sealed with the archive\'s wax. The scroll inside is whole.', effects: [{ item: { t: 'scroll_uncurse', q: 1 } }, { xp: 25 }] },
        fail: { text: 'The shelf you lean on gives way. Books, and then the shelf, come down on you.', effects: [{ hurtFrac: 0.12 }] } },
      { label: 'Read the archivist\'s own journal', check: { stat: 'wis', dc: 12 },
        pass: { text: 'Page after page on this floor: where the damp gets in, where the old crews dug, where the stairs are. You read it twice.', effects: [{ map: 1 }, { xp: 30 }] },
        fail: { text: 'The last pages are not in the archivist\'s hand, and reading them makes your skin crawl. You put it down too late.', effects: [{ maxHp: -2 }] } },
      { label: 'Take the gilt book to sell', outcome: { text: 'It is heavier than it looks. A trader will pay for gold leaf, and you pocket the loose leaves now.', effects: [{ goldPerDepth: 8 }] } },
      { label: 'Leave them', outcome: { text: 'You leave the archive to its slow rot.', effects: [] } },
    ],
  },

  sleeper: {
    title: 'A Sleeping Ogre', sprite: 'ogre_sleep', depth: [4, 99], tier: 7.5,
    text: 'An ogre sleeps across the passage on a bed of stolen coin, snoring like a rockfall. One hand is still wrapped around its club.',
    choices: [
      { label: 'Creep past and fill your purse', check: { stat: 'dex', dc: 14, knack: [['thief', null, 4]] },
        pass: { text: 'You go through its hoard a coin at a time, between snores. It never stirs.', effects: [{ goldPerDepth: 28 }, { loot: 1 }] },
        fail: { text: 'A coin slides. The snoring stops.', effects: [{ ambush: { id: 'ogre', n: 1 } }] } },
      { label: 'Crack its skull while it sleeps', check: { stat: 'str', dc: 15 },
        pass: { text: 'One blow, with everything you have behind it. It never wakes.', effects: [{ xp: 180 }, { goldPerDepth: 14 }] },
        fail: { text: 'Its skull is thicker than your arm. It wakes up angry.', effects: [{ ambush: { id: 'ogre', n: 1 } }, { hurtFrac: 0.1 }] } },
      { label: 'Let it sleep', outcome: { text: 'You find another way round, very quietly.', effects: [] } },
    ],
  },

  mirror: {
    title: 'A Mirror in the Dark', sprite: 'mirror', depth: [3, 99],
    text: 'A tall mirror in a gilt frame stands where no mirror should be. Your reflection lowers its lantern a moment after you lower yours.',
    choices: [
      { label: 'Look deep into it', check: { stat: 'wis', dc: 14 },
        pass: { text: 'It shows you as you could be, and for a moment you are. Something of it stays with you.', effects: [{ stat: ['wis', 1] }, { xp: 40 }] },
        fail: { text: 'The reflection smiles, and you do not. You feel thinner, somehow, when you look away.', effects: [{ maxHp: -3 }] } },
      { label: 'Talk to your reflection', check: { stat: 'cha', dc: 13 },
        pass: { text: 'It answers, in your own voice, and tells you where the dangers on this floor are waiting.', effects: [{ map: 1 }, { traps: 1 }, { xp: 30 }] },
        fail: { text: 'It answers with something that is not a word, and something steps out of the frame after you.', effects: [{ ambush: { id: 'wraith', n: 1, early: ['ghoul', 'skeleton'] } }] } },
      { label: 'Smash it', check: { stat: 'str', dc: 11 },
        pass: { text: 'It shatters, and something like a sigh goes out of the room. The gilt frame is worth a little.', effects: [{ goldPerDepth: 10 }, { xp: 20 }] },
        fail: { text: 'The glass does not break. Your hand does, a little.', effects: [{ hurtFrac: 0.1 }] } },
      { label: 'Turn it to the wall', outcome: { text: 'You turn it round without looking and walk on.', effects: [] } },
    ],
  },

  wired: {
    title: 'A Wired Chest', sprite: 'chest', depth: [1, 99],
    text: 'A painted chest sits alone in the open, which is the first warning. The second is the wire running from its lid into a hole in the wall.',
    choices: [
      { label: 'Disarm the trap', check: { stat: 'dex', dc: 13, knack: [['thief', null, 4]] },
        pass: { text: 'You find the spring, wedge it, and lift the lid on a trap that will never fire.', effects: [{ loot: 1 }, { goldPerDepth: 10 }] },
        fail: { text: 'The wire goes taut under your fingers. The darts are quicker than you.', effects: [{ hurtFrac: 0.15 }, { poison: 1 }] } },
      { label: 'Work out where the darts will fly', check: { stat: 'int', dc: 12 },
        pass: { text: 'You open it from the side, at arm\'s length. The darts rattle off the far wall.', effects: [{ loot: 1 }] },
        fail: { text: 'You were wrong about the side.', effects: [{ hurtFrac: 0.15 }] } },
      { label: 'Wrench it open and take the darts', check: { stat: 'con', dc: 14 },
        pass: { text: 'The darts hurt, and you do not care. Everything inside is yours.', effects: [{ loot: 2 }, { hurtFrac: 0.1 }] },
        fail: { text: 'The darts hurt a great deal. You get the lid open, eventually.', effects: [{ loot: 1 }, { hurtFrac: 0.25 }] } },
      { label: 'Leave it', outcome: { text: 'Whoever set that trap can keep what is in it.', effects: [] } },
    ],
  },

  toll: {
    title: 'The Goblin Toll', sprite: 'goblin_toll', depth: [2, 6],
    text: 'A goblin in a dented helmet stands beside a hand-painted sign and holds out a cup. "Toll!" it says, very pleased with itself. Behind it, others watch from the dark.',
    choices: [
      { label: 'Pay the toll', cost: { goldPerDepth: 6 },
        outcome: { text: 'It bites the coin, nods and whistles. The ones in the dark melt away, and it points you the quick way down.', effects: [{ map: 1 }] } },
      { label: 'Scare it off', check: { stat: 'str', dc: 12 },
        pass: { text: 'You loom. It squeaks, drops the cup and runs, and so do the ones in the dark.', effects: [{ goldPerDepth: 10 }, { xp: 20 }] },
        fail: { text: 'It is braver than it looks, and so are its friends.', effects: [{ ambush: { id: 'goblin', n: 2 } }] } },
      { label: 'Tell it you are the new toll-collector', check: { stat: 'cha', dc: 13 },
        pass: { text: 'It hands you the cup, salutes, and marches off to tell the others. The cup is half full.', effects: [{ goldPerDepth: 16 }] },
        fail: { text: 'It does not believe you. It whistles.', effects: [{ ambush: { id: 'goblin', n: 2 } }] } },
      { label: 'Back away and find another road', outcome: { text: 'You back off. Its jeering follows you down the passage.', effects: [] } },
    ],
  },

  // a vault behind a stone door with three levers, and only one order opens it;
  // or it can be heaved open, and the whole floor hears it give
  levers: {
    title: 'The Lever Door', sprite: 'lever_door', depth: [3, 6],
    text: 'A squat stone door is set in the rock, and beside it three iron levers stand in a row, each worn bright at the grip. Someone has scratched marks over them, and crossed most of the marks out.',
    choices: [
      { label: 'Work out the order from the marks', check: { stat: 'int', dc: 12, knack: [['mage', null, 2], ['thief', null, 1]] },
        pass: { text: 'Left, right, middle. Something heavy rolls aside in the wall and the door swings in on a small vault, dry and untouched.', effects: [{ loot: 2 }, { goldPerDepth: 12 }, { xp: 30 }] },
        fail: { text: 'Wrong. Darts spit from holes in the frame before you can step back.', effects: [{ hurtFrac: 0.12 }] } },
      { label: 'Put your shoulder to the door', check: { stat: 'str', dc: 13, knack: [['fighter', null, 2]] },
        pass: { text: 'Stone grinds on stone, and gives. The vault is yours, but the noise of it rolls away down every passage on the floor.', effects: [{ loot: 1 }, { goldPerDepth: 8 }, { wake: 1 }] },
        fail: { text: 'It will not move, and you have wrenched something trying.', effects: [{ hurtFrac: 0.08 }] } },
      { label: 'Leave the levers alone', outcome: { text: 'Whoever made the marks did not get in either. You leave the door to the next one.', effects: [] } },
    ],
  },

  // someone's mule, still laden, wandering where it should not be: lead it on
  // and the next trader knows whose it is (see trader.js), or rob it now
  mule: {
    title: 'A Lost Mule', sprite: 'mule', depth: [3, 6],
    text: 'A mule stands in the passage with its head low and its packs askew, a frayed rope hanging from its halter where someone let go of it. It looks at you, and then at the dark, as if it would rather you.',
    choices: [
      { label: 'Take its rope and lead it on', outcome: { text: 'It falls in behind you, nosing at your pack. You tie it where the traders pass; the next of them below will know whose it is.', effects: [{ thread: 'mule' }] } },
      { label: 'Strip its packs and send it off', outcome: { text: 'Rope, a pot, a lamp, some coin and one thing worth having. The mule trots off lighter, and does not look back.', effects: [{ loot: 0 }, { goldPerDepth: 5 }] } },
      { label: 'Let it lead you, as it knows the way', check: { stat: 'wis', dc: 12, knack: [['druid', null, 3], ['ranger', null, 2]] },
        pass: { text: 'You give it its head. It picks its way through the passages without a wrong turn, and you learn the floor as it goes.', effects: [{ map: 1 }, { xp: 25 }] },
        fail: { text: 'It bolts the moment the rope is slack, and you lose an hour chasing it.', effects: [{ food: -10 }] } },
      { label: 'Leave it be', outcome: { text: 'You leave it to find its own way. It watches you go.', effects: [] } },
    ],
  },

  // a bargain that follows you all the way down: strength now, and the lich
  // the stronger for it when you meet
  bargain: {
    title: 'The Pale One', sprite: 'wisp', depth: [3, 12],
    text: 'Something made of candle-smoke waits where the passage narrows. It has no face, but you know it is smiling. "Strength," it says, "for a little of what you will owe the one below. Everyone who goes down owes it something."',
    choices: [
      { label: 'Take its strength', outcome: { text: 'Cold runs down your arms and settles in your hands. Far below, something stirs, and is pleased.', effects: [{ thread: 'bargain' }] } },
      { label: 'Tell it no, and mean it', check: { stat: 'wis', dc: 13, knack: [['cleric', null, 2]] },
        pass: { text: 'It comes apart like smoke in a draught, and you feel clearer for having refused it.', effects: [{ xp: 40 }] },
        fail: { text: 'It laughs, and the cold of it gets into you anyway.', effects: [{ hurtFrac: 0.1 }] } },
      { label: 'Walk past it', outcome: { text: 'It watches you go. It has all the time in the world.', effects: [] } },
    ],
  },

  laststand: {
    title: 'The Third Crew\'s Last Stand', sprite: 'barricade', depth: [3, 99],
    text: 'A wall of shields across the passage, and behind it the third crew, where they fell holding it. Their banner is still up. Whatever they held this line against, it did not come through.',
    choices: [
      { label: 'Search the fallen', check: { stat: 'wis', dc: 12 },
        pass: { text: 'You go carefully, and find what they carried: a purse, and something better.', effects: [{ loot: 1 }, { goldPerDepth: 12 }] },
        fail: { text: 'One of them was not quite finished dying. A cold hand closes on your wrist.', effects: [{ maxHp: -2 }] } },
      { label: 'Read their captain\'s last orders', check: { stat: 'int', dc: 11 },
        pass: { text: 'A map of the floor, marked with every place they lost someone. You will not make their mistakes.', effects: [{ map: 1 }, { traps: 1 }, { xp: 30 }] },
        fail: { text: 'The ink has run too far to read.', effects: [] } },
      { label: 'Raise their banner and take heart', check: { stat: 'cha', dc: 12 },
        pass: { text: 'You set the banner straight. For a while it feels as if they march with you.', effects: [{ buff: { stats: [['hit', 2]], dur: 240000 } }, { xp: 20 }] },
        fail: { text: 'The pole snaps in your hands. It feels like a bad sign.', effects: [] } },
      { label: 'Bury them', outcome: { text: 'It takes a long time, and you go hungry for it. It was the right thing to do.', effects: [{ food: -15 }, { xp: 50 }, { thread: 'crew' }] } },
      { label: 'Leave them to their watch', outcome: { text: 'You step over the shields and go on. They have held their line long enough.', effects: [] } },
    ],
  },

  // Met only down one road past the fork, on its first floor (dungeon.js
  // places them): kept out of the deck the rest are dealt from.
  ossuary: {
    title: 'The Ossuary', sprite: 'bones', depth: [99, 99], route: 'crypts',
    text: 'The walls of this chamber are built of skulls, thousands of them, set in patient rows. In the middle stands a reliquary of green bronze, and every empty eye in the room seems turned toward it.',
    choices: [
      { label: 'Pray for the dead', check: { stat: 'wis', dc: 12, knack: [['cleric', null, 3]] },
        pass: { text: 'You say the old words for them, and the room grows easier to stand in. Something of their long quiet goes with you.', effects: [{ xp: 40 }, { buff: { stats: [['ac', 2]], dur: 240000 } }] },
        fail: { text: 'The words come out wrong. Two of the walls\' builders climb down to correct you.', effects: [{ ambush: { id: 'skeleton', n: 2 } }] } },
      { label: 'Open the reliquary', check: { stat: 'dex', dc: 13 },
        pass: { text: 'The catch gives without a sound. Inside, on rotten velvet, the saint\'s things, and the offerings of those who came to them.', effects: [{ loot: 1 }, { goldPerDepth: 10 }] },
        fail: { text: 'A needle in the catch, and something green on it.', effects: [{ hurtFrac: 0.1 }, { poison: 1 }] } },
      { label: 'Read the names on the wall', check: { stat: 'int', dc: 12 },
        pass: { text: 'Under the skulls, the names, and under the names, where each was found. It reads like a map of the floor, and it is one.', effects: [{ map: 1 }, { xp: 40 }] },
        fail: { text: 'The script is older than any you know.', effects: [] } },
      { label: 'Walk softly through', outcome: { text: 'You keep your eyes down and your steps quiet, and the dead let you go.', effects: [] } },
    ],
  },

  warcamp: {
    title: 'The War-Camp', sprite: 'barricade', depth: [99, 99], route: 'warrens',
    text: 'Cookfires, a rack of spears, a spit with something turning on it. The Warrens\' war-camp is almost empty: only an orc sentry, dozing on an upturned drum with a cleaver across his knees.',
    choices: [
      { label: 'Rob the weapon rack', check: { stat: 'dex', dc: 13, knack: [['thief', null, 3]] },
        pass: { text: 'You take the best of the rack and are gone before the sentry stops snoring.', effects: [{ loot: 1 }] },
        fail: { text: 'A spear topples, and the whole rack goes with it. The sentry wakes up furious.', effects: [{ ambush: { id: 'orc', n: 1 } }] } },
      { label: 'Kick the drum out from under him', check: { stat: 'str', dc: 13 },
        pass: { text: 'He goes down hard and does not get up, and the camp\'s stew is yours. You feel equal to anything down here.', effects: [{ xp: 60 }, { food: 40 }, { buff: { stats: [['hit', 2]], dur: 240000 } }] },
        fail: { text: 'He is quicker than he looked. The cleaver finds you on its way past.', effects: [{ hurtFrac: 0.15 }] } },
      { label: 'Wake him, and say you bring orders', check: { stat: 'cha', dc: 13 },
        pass: { text: 'He is too sleepy to argue. He tells you which tunnels the patrols use, and pays the messenger\'s fee.', effects: [{ map: 1 }, { goldPerDepth: 12 }] },
        fail: { text: 'He does not believe a word. He beats on his drum instead.', effects: [{ ambush: { id: 'goblin', n: 2 } }] } },
      { label: 'Slip past the camp', outcome: { text: 'You go round by the back tunnels. The stew smelled good.', effects: [] } },
    ],
  },

  // The middle floors, where a run sees most of its encounters, had the fewest
  // of their own: these two belong there and nowhere else.
  duelist: {
    title: 'The Duellist\'s Ghost', sprite: 'duelist_ghost', depth: [3, 7],
    text: 'A pale swordsman stands in the middle of the passage, a blade of mist held low. He salutes you with it. "One pass," he says, in a voice like wind through a keyhole. "Only one. It has been so long."',
    choices: [
      { label: 'Cross blades with him', check: { stat: 'str', dc: 13 },
        pass: { text: 'Mist rings on steel. He gives ground, laughing without a sound, and you come away knowing something about your own arm.', effects: [{ xp: 50 }, { buff: { stats: [['hit', 2]], dur: 240000 } }] },
        fail: { text: 'His blade passes through your guard and through you. It is cold for a long time after.', effects: [{ hurtFrac: 0.15 }] } },
      { label: 'Match his footwork', check: { stat: 'dex', dc: 13 },
        pass: { text: 'Step for step, and his blade never finds you. He lowers it and bows, and you find your feet are lighter.', effects: [{ xp: 50 }, { buff: { stats: [['ac', 2]], dur: 240000 } }] },
        fail: { text: 'You step where he wanted you to. The flat of the mist-blade takes you across the ribs.', effects: [{ hurtFrac: 0.1 }] } },
      { label: 'Bow, and ask his name', check: { stat: 'cha', dc: 12 },
        pass: { text: 'He tells you, and how he died, and what he was carrying. It is still where he fell, a little further on.', effects: [{ xp: 30 }, { loot: 1 }] },
        fail: { text: 'He has forgotten it. He fades, looking puzzled, before you can say you are sorry.', effects: [] } },
      { label: 'Walk around him', outcome: { text: 'He lets you pass, blade still raised, waiting for someone else.', effects: [] } },
    ],
  },

  larder: {
    title: 'The Spider\'s Larder', sprite: 'silk_larder', depth: [3, 7],
    text: 'Bundles of grey silk hang from the ceiling like fruit, turning slowly. Most are still. One has a sword hilt poking out of it. One, near the back, is moving.',
    choices: [
      { label: 'Cut down the one with the sword', check: { stat: 'dex', dc: 13 },
        pass: { text: 'One clean stroke and it drops into your arms. The owner has no more use for their things.', effects: [{ loot: 1 }] },
        fail: { text: 'The whole web shivers when you cut. Its keepers come down to see.', effects: [{ ambush: { id: 'spider', n: 2 } }] } },
      { label: 'Free the one that moves', check: { stat: 'str', dc: 12 },
        pass: { text: 'You tear the silk apart and a half-smothered delver of the fourth crew falls out, gasping. She presses her last draught on you and runs for the stairs.', effects: [{ item: { t: 'potion_heal', q: 1 } }, { xp: 60 }] },
        fail: { text: 'The silk will not tear. Something large comes down its thread to find out why the larder is shaking.', effects: [{ ambush: { id: 'spider', n: 1 } }] } },
      { label: 'Burn the webs down', check: { stat: 'int', dc: 12, knack: [['mage', null, 3]] },
        pass: { text: 'The silk goes up like paper. When the smoke clears, what the spiders kept is lying on the floor.', effects: [{ xp: 40 }, { goldPerDepth: 12 }, { loot: 0 }] },
        fail: { text: 'The fire takes, and so does the smoke. You stagger out coughing, singed.', effects: [{ hurtFrac: 0.1 }] } },
      { label: 'Back away quietly', outcome: { text: 'You leave the larder to its keepers. Something up there turns to watch you go.', effects: [] } },
    ],
  },

  // One of the Lampfolk with its lamp gone out: they do not see without it.
  // What you do here, the Lampfolk traders below will have heard.
  lampfolk: {
    title: 'A Lamp Gone Out', sprite: 'lampfolk_dark', depth: [2, 99],
    text: 'One of the Lampfolk sits hunched against the wall, its lamp cold in its lap and its great eyes dim as ash. "Sun-walker?" it says, turning the wrong way. "The flame went out. We do not see without it."',
    choices: [
      { label: 'Coax the wick alight', check: { stat: 'dex', dc: 12 },
        pass: { text: 'A spark, a breath, and the flame stands up. Its eyes brighten with it. It touches your hand, very lightly, and says it will tell the others.', effects: [{ xp: 30 }, { thread: 'lamp' }] },
        fail: { text: 'The oil catches all at once and flares across your hands. It goes out again, and the Lampfolk sighs.', effects: [{ hurtFrac: 0.1 }] } },
      { label: 'Talk it back to the light', check: { stat: 'cha', dc: 12, knack: [[null, 'deepborn', 3]] },
        pass: { text: 'You talk it along the wall, step by step, to a torch still burning. It lights the lamp from it, and draws you the way it came in the dust.', effects: [{ map: 1 }, { thread: 'lamp' }] },
        fail: { text: 'It does not trust a voice in the dark. It gathers up its pack and shuffles away from you, and you spend a long while getting your bearings again.', effects: [{ food: -10 }] } },
      { label: 'Give it oil from your own flask', cost: { goldPerDepth: 6 },
        outcome: { text: 'It fills the lamp from your flask, lights it, and bows until its pack nearly tips it over.', effects: [{ xp: 20 }, { thread: 'lamp' }] } },
      { label: 'Take its pack while it cannot see', check: { stat: 'dex', dc: 11, knack: [['thief', null, 3]] },
        pass: { text: 'You lift the pack and go. Behind you it calls out, again and again, and then goes quiet.', effects: [{ loot: 1 }, { goldPerDepth: 10 }, { thread: 'robbed' }] },
        fail: { text: 'It knows the weight of its own pack. The lamp-staff cracks across your knuckles, and it runs, shrieking, into the dark.', effects: [{ hurtFrac: 0.1 }, { thread: 'robbed' }] } },
      { label: 'Leave it in the dark', outcome: { text: 'You go on. Its dim eyes follow the sound of your feet.', effects: [] } },
    ],
  },

  forge: {
    title: 'The Cold Forge', sprite: 'anvil', depth: [2, 99],
    text: 'A dwarf-built forge, long cold, with a half-made blade still lying on the anvil. The bellows are cracked but whole. Someone meant to come back and finish it.',
    choices: [
      { label: 'Work the bellows and finish the blade', check: { stat: 'str', dc: 13, knack: [['fighter', null, 2], [null, 'ashborn', 3]] },
        pass: { text: 'The coals take, the iron glows, and the old work comes true under your hammer. It is a better blade than you had any right to make.', effects: [{ loot: 2 }, { xp: 30 }] },
        fail: { text: 'The bellows give out in a gout of sparks. You beat out the burning in your sleeve, and the blade cracks as it cools.', effects: [{ hurtFrac: 0.12 }] } },
      { label: 'Read the maker\'s marks', check: { stat: 'int', dc: 12 },
        pass: { text: 'A ward-rune, cut in the anvil\'s face to draw bad magic out of the iron. It still works: you feel something let go of you as you trace it.', effects: [{ xp: 40 }, { uncurse: 1 }] },
        fail: { text: 'The marks are in a smith\'s cant you do not know. You learn only that the maker was proud of them.', effects: [] } },
      { label: 'Pry the gold wire off the hilt', outcome: { text: 'It comes away in a bright tangle. Whoever made the blade would not thank you.', effects: [{ goldPerDepth: 8 }] } },
      { label: 'Leave it for its maker', outcome: { text: 'You leave the blade where it lies, in case they do come back.', effects: [] } },
    ],
  },

  pool: {
    title: 'A Still Black Pool', sprite: 'pool', depth: [1, 99],
    text: 'Water has found its way down here and stopped, black and perfectly still, in a basin of worn stone. Something pale glints on the bottom. Your reflection looks back at you a moment longer than it should.',
    choices: [
      { label: 'Drink', check: { stat: 'con', dc: 12 },
        pass: { text: 'It is cold enough to hurt, and clean. You feel it all the way down, and your wounds close behind it.', effects: [{ heal: 'full' }, { cure: 1 }] },
        fail: { text: 'It tastes of iron and old things. Your stomach turns over.', effects: [{ poison: 1 }] } },
      { label: 'Dive for what glints', check: { stat: 'str', dc: 13 },
        pass: { text: 'It is deeper than it looks. You come up gasping with something in your fist that the water kept for a long time.', effects: [{ loot: 1 }] },
        fail: { text: 'The cold takes the breath out of you. You come up empty-handed, half drowned and shaking.', effects: [{ hurtFrac: 0.15 }] } },
      { label: 'Hold your reflection\'s gaze', check: { stat: 'wis', dc: 13, knack: [['cleric', null, 2]] },
        pass: { text: 'It blinks first. You come away steadier, as if you had been shown where you are weakest.', effects: [{ xp: 40 }, { buff: { stats: [['ac', 2]], dur: 240000 } }] },
        fail: { text: 'You look away first. For a long while after, you feel that something is still looking.', effects: [{ food: -10 }] } },
      { label: 'Leave the water be', outcome: { text: 'You leave the pool as you found it. Its surface does not so much as tremble.', effects: [] } },
    ],
  },

  cookpot: {
    title: 'An Unwatched Pot', sprite: 'cookpot', depth: [1, 6],
    text: 'A goblin cook-pot hangs over a low fire, bubbling, and there is no goblin anywhere. A ladle sticks out of it. Something in the stew has a lot of legs.',
    choices: [
      { label: 'Eat your fill', check: { stat: 'con', dc: 12 },
        pass: { text: 'It is better than it looks, which is not saying much. You feel you could walk for a day.', effects: [{ food: 60 }, { heal: 8 }] },
        fail: { text: 'The legs were a warning. You bring most of it back up.', effects: [{ poison: 1 }, { food: 15 }] } },
      { label: 'Wait for the cook, out of sight', check: { stat: 'dex', dc: 13, knack: [['thief', null, 3], ['ranger', null, 2]] },
        pass: { text: 'The cook comes back humming, and never sees you. Its purse is heavier than its stew.', effects: [{ xp: 40 }, { goldPerDepth: 10 }] },
        fail: { text: 'The cook comes back with friends, and they smell you before they see you.', effects: [{ ambush: { id: 'goblin', n: 2 } }] } },
      { label: 'Tip it over and search the dregs', outcome: { text: 'The fire hisses out in a cloud of stinking steam. At the bottom, among the bones, something that was not food. The noise carries.', effects: [{ loot: 0 }, { wake: 1 }] } },
      { label: 'Leave the goblins their supper', outcome: { text: 'You leave the pot bubbling. Somebody will be glad of it.', effects: [] } },
    ],
  },

  statue: {
    title: 'The Weeping Knight', sprite: 'statue', depth: [3, 99],
    text: 'A stone knight kneels on a plinth, head bowed, water running from its eyes in two thin lines down the moss. The sword across its knees is not stone. It is real steel, and bright.',
    choices: [
      { label: 'Pry the sword out of its hands', check: { stat: 'str', dc: 14 },
        pass: { text: 'Stone fingers crack, one by one, and the sword is yours. The weeping stops.', effects: [{ loot: 2 }] },
        fail: { text: 'The grip does not give, and your hands slip down the edge.', effects: [{ hurtFrac: 0.12 }] } },
      { label: 'Kneel beside it and swear to finish its task', check: { stat: 'wis', dc: 12, knack: [['cleric', null, 3]] },
        pass: { text: 'You do not know what the task was. It seems not to matter. You rise feeling that someone old and patient is at your back.', effects: [{ buff: { stats: [['hit', 2], ['ac', 2]], dur: 300000 } }] },
        fail: { text: 'You kneel a long time. The stone does not answer.', effects: [] } },
      { label: 'Read the plinth', check: { stat: 'int', dc: 11 },
        pass: { text: 'A name, a vow, and a plan of this floor cut underneath, from the days when the knights still kept it.', effects: [{ xp: 30 }, { map: 1 }] },
        fail: { text: 'The moss has eaten most of it. You make out the word "never", and nothing else.', effects: [] } },
      { label: 'Leave it to its grief', outcome: { text: 'You walk on. Behind you, the water keeps running.', effects: [] } },
    ],
  },

  idol: {
    title: 'The Idol\'s Eyes', sprite: 'idol', depth: [2, 99],
    text: 'A grinning idol of green stone sits cross-legged in an alcove, its eyes two cut rubies as big as your thumb. The floor in front of it is scorched in a neat circle.',
    choices: [
      { label: 'Pry out the rubies', check: { stat: 'dex', dc: 14, knack: [['thief', null, 4]] },
        pass: { text: 'One, then the other, and nothing happens. You do not wait around to find out why.', effects: [{ goldPerDepth: 22 }] },
        fail: { text: 'The scorched circle was a warning. Fire leaps from the idol\'s mouth.', effects: [{ hurtFrac: 0.2 }] } },
      { label: 'Find the trap before you touch it', check: { stat: 'int', dc: 13, knack: [['mage', null, 2]] },
        pass: { text: 'A pressure plate under the idol\'s knee. You wedge it with a dagger and take the rubies at your leisure.', effects: [{ goldPerDepth: 16 }, { xp: 30 }] },
        fail: { text: 'You find it by leaning on it. The fire only catches the edge of you.', effects: [{ hurtFrac: 0.1 }] } },
      { label: 'Smash it open', check: { stat: 'str', dc: 12 },
        pass: { text: 'The idol splits down the middle with a crack that carries a long way. Coins spill out of its belly.', effects: [{ goldPerDepth: 12 }, { wake: 1 }] },
        fail: { text: 'Your blow glances off, and the idol breathes fire at you for the insult.', effects: [{ hurtFrac: 0.15 }] } },
      { label: 'Leave it grinning', outcome: { text: 'You leave the idol its eyes. They follow you down the passage.', effects: [] } },
    ],
  },

  // Not in the deck: two runs in three find it on the second floor (see
  // encounterPlan), where a hound that follows you does the most good.
  stray: {
    title: 'A Starving Hound', sprite: 'stray', depth: [2, 2], early: true,
    text: 'A brown hound lies curled in a corner, all ribs, a frayed collar round its neck and a name scratched on the tag. It lifts its head as you come near, and its tail moves once against the stone.',
    choices: [
      // a cost, not an effect: a hero with nothing to share cannot share it
      { label: 'Share your food with it', cost: { food: 25 }, outcome: { text: 'It eats from your hand, slowly, as if it cannot believe it. When you move on, it gets up and follows.', effects: [{ companion: 'hound' }] } },
      { label: 'Call it to you', check: { stat: 'cha', dc: 11, knack: [['ranger', null, 3], ['druid', null, 3], [null, 'deepborn', 2]] },
        pass: { text: 'It comes, low and wary, and pushes its nose into your hand. It is yours now, or you are its.', effects: [{ companion: 'hound' }] },
        fail: { text: 'It shies from your hand and slinks off into the dark, and does not come back.', effects: [] } },
      { label: 'Leave it be', outcome: { text: 'You leave it curled in its corner. It watches you go.', effects: [] } },
    ],
  },

  // in the delves with no hound, a companion of another kind, further down
  caged: {
    title: 'A Caged Goblin', sprite: 'cage', depth: [3, 12], early: true,
    text: 'An iron cage stands against the wall, and a scrawny goblin with a broken chain on one wrist is pressed to its bars. "Let me out," it hisses, "and I open every lock down here for you. Every one. I find the traps too. Nobody finds traps like me."',
    choices: [
      { label: 'Wrench the bars apart', check: { stat: 'str', dc: 12 },
        pass: { text: 'The bars bend with a shriek of iron. The goblin squeezes out, bows far too low, and falls in behind you.', effects: [{ companion: 'goblin' }] },
        fail: { text: 'The bars hold, and your shoulder does not thank you for trying. The goblin sighs at you.', effects: [{ hurtFrac: 0.1 }] } },
      { label: 'Pick the padlock', check: { stat: 'dex', dc: 12, knack: [['thief', null, 3]] },
        pass: { text: 'The padlock falls open. "Not bad," says the goblin, stepping out, "for a big one." It falls in behind you.', effects: [{ companion: 'goblin' }] },
        fail: { text: 'The lock beats you. The goblin tuts, loudly, and turns its back.', effects: [] } },
      { label: 'Leave it caged', outcome: { text: 'It curses you in three languages as you go, one of them its own.', effects: [] } },
    ],
  },

  // a blade for hire on the middle floors: a companion bought, not won over.
  // Only one stands with you at a time, so with one already at your side
  // the hiring is not on offer, though the sellsword will still talk.
  hire: {
    title: 'A Sellsword for Hire', sprite: 'hireling', depth: [3, 6],
    text: 'Someone leans against the wall with both hands on the pommel of a greatsword planted point-down before them, a kettle hat pushed back. "Going down? So am I, for pay. I am slow, I am hard to kill, and anything that comes for you comes through me."',
    choices: [
      { label: 'Pay their price', cost: { goldPerDepth: 20 }, alone: true,
        outcome: { text: 'They weigh the purse, nod once, and get to their feet. "Lead on, then."', effects: [{ companion: 'sellsword' }] } },
      { label: 'Haggle them down to half', cost: { goldPerDepth: 10 }, alone: true, check: { stat: 'cha', dc: 13, knack: [['fighter', null, 2]] },
        pass: { text: 'They laugh, and spit, and shake on it. "Half, and you buy the drinks when we come up."', effects: [{ companion: 'sellsword' }] },
        fail: { text: 'They push your coin back across the crate. "Not for that. Not for anyone." And they will not hear another word.', effects: [{ goldBack: 10 }] } },
      { label: 'Ask what they have seen down here', outcome: { text: '"Mind the floor," they say, and tell you where they have seen others step wrong.', effects: [{ traps: 1 }] } },
      { label: 'Leave them to their wait', outcome: { text: 'They shrug, and go back to watching the dark.', effects: [] } },
    ],
  },

  mapmaker: {
    title: 'The Mapmaker', sprite: 'mapmaker', depth: [1, 99],
    text: 'A skeleton in a surveyor\'s coat sits against the wall, a satchel of rolled maps in its lap and a measuring chain wound round its arm. One bony finger still points down the passage.',
    choices: [
      { label: 'Take the map of this floor', outcome: { text: 'It is the right floor, and most of it is true.', effects: [{ map: 1 }] } },
      { label: 'Follow where the finger points', check: { stat: 'wis', dc: 12, knack: [['ranger', null, 3], ['druid', null, 2]] },
        pass: { text: 'Scratched marks on the wall, then a loose stone, and behind it the mapmaker\'s own cache.', effects: [{ loot: 1 }, { xp: 20 }] },
        fail: { text: 'Wherever it was pointing, you do not find it. The walk costs you.', effects: [{ food: -10 }] } },
      { label: 'Bury the mapmaker with its maps', check: { stat: 'con', dc: 11 },
        pass: { text: 'It is hard work in this rock, but you do it. You feel lighter for it.', effects: [{ xp: 50 }] },
        fail: { text: 'The ground is stone. You give up with raw hands, and leave the mapmaker as you found it.', effects: [{ food: -10 }] } },
      { label: 'Leave it pointing', outcome: { text: 'You leave the mapmaker to watch the passage for the next one.', effects: [] } },
    ],
  },

};

/** Difficulty grows a little every three floors. */
function encounterDc(check, depth) { return check.dc + Math.floor((depth - 1) / 3); }

/**
 * Which encounters sit on which floor, for a whole run, decided by the seed:
 * the same seed always meets the same ones in the same places, none repeats,
 * they are spread across the run rather than front-loaded, and a run meets
 * about one a floor from a deck twice that size. The deepest floor, where
 * the Heart is kept, has none.
 * @param {string} seed @param {number} levels
 * @param {(depth: number, levels: number) => number} [tierAt] where a floor sits on the ladder of monster tiers
 * @returns {string[][]} plan[depth] = encounter ids
 */
function encounterPlan(seed, levels, tierAt = d => d) {
  const rng = new Rng(String(seed) + '|encounters');
  // the last floor's own is kept out of the deck, so the deck deals as it always has
  const deck = rng.shuffle(Object.keys(ENCOUNTERS).filter(k => !ENCOUNTERS[k].final && !ENCOUNTERS[k].route && !ENCOUNTERS[k].early));
  const used = new Set();
  const plan = [];
  const floors = Math.max(1, levels - 1);
  // About one a floor, as a run always met: a bigger deck means each run
  // draws a different handful from it, not that it meets more of them.
  const budget = Math.min(deck.length, Math.round(floors * 1.15));
  for (let d = 1; d <= levels; d++) {
    plan[d] = [];
    if (d === levels) { if (levels > 1) plan[d].push('vigil'); continue; }
    const left = budget - used.size, floorsLeft = floors - d + 1;
    const share = left / floorsLeft;
    const n = Math.min(2, Math.floor(share) + (rng.next() < share % 1 ? 1 : 0));
    // the deck's own shuffled order decides, among those that belong this deep
    // and never one whose creature belongs deeper than this floor's monsters:
    // a sleeping ogre two floors before any ogre walks was a death with no warning
    const open = deck.filter(e => !used.has(e) && d >= ENCOUNTERS[e].depth[0] && d <= ENCOUNTERS[e].depth[1] && tierAt(d, levels) >= (ENCOUNTERS[e].tier || 0));
    for (const id of open.slice(0, n)) { used.add(id); plan[d].push(id); }
  }
  // the starving hound, on the second floor of two runs in three, on dice of its own;
  // the runs without it keep a caged goblin halfway down instead (one companion a run)
  if (levels >= 3 && new Rng(String(seed) + '|stray').next() < 2 / 3) plan[2].push('stray');
  else if (levels >= 5) plan[Math.min(levels - 1, Math.max(3, Math.round(levels / 2)))].push('caged');
  return plan;
}

export { ENCOUNTERS, encounterDc, encounterPlan };
