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
// poison, cure, uncurse, wake, identifyAll, ambush {id, n}, stat [stat, n].

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
        pass: { text: 'Warmth from nowhere. Your wounds close and your head clears.', effects: [{ heal: 'full' }, { cure: 1 }, { uncurse: 1 }] },
        fail: { text: 'When you open your eyes your purse is lighter. The idol has not moved.', effects: [{ goldPerDepth: -12 }] } },
      { label: 'Leave it be', outcome: { text: 'You leave the old stone to whoever still tends it.', effects: [] } },
    ],
  },

  // Not in the deck: every delve's last floor holds one, a little way in from
  // the stairs, so the gold carried down past the last trader buys something.
  vigil: {
    title: 'A Vigil Lamp', sprite: 'shrine', depth: [99, 99], final: true,
    text: 'Someone kept a lamp burning here, at the edge of the lich\'s halls, and left a bowl beneath it. Coins shine in the bowl. Whatever keeps the lamp lit still answers what is left there.',
    choices: [
      { label: 'Leave gold for a ward against the cold', cost: { goldPerDepth: 45 },
        outcome: { text: 'The flame leans toward you, and the chill of the halls ahead eases off your skin.', effects: [{ buff: { stats: [['ac', 3]], dur: 300000 } }] } },
      { label: 'Leave gold for a sure hand', cost: { goldPerDepth: 35 },
        outcome: { text: 'The flame steadies, and so does your grip.', effects: [{ buff: { stats: [['hit', 3]], dur: 300000 } }] } },
      { label: 'Empty your purse into the bowl', cost: { goldPerDepth: 75 },
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

  prisoner: {
    title: 'The Captive', sprite: 'prisoner', depth: [2, 6],
    text: 'A man hangs in chains from rings in the wall, stripped to his shirt, a goblin brand fresh on his arm. His eyes open when your light reaches him. "They will be back," he whispers. "Please."',
    choices: [
      { label: 'Break the chains', check: { stat: 'str', dc: 13 },
        pass: { text: 'The rings tear out of the stone. He is weak, but he knows this floor, and where they stack their plunder.', effects: [{ map: 1 }, { loot: 1 }] },
        fail: { text: 'The chains hold, and the rattle carries. Something is coming to see what the noise was.', effects: [{ wake: 1 }] } },
      { label: 'Pick the shackles', check: { stat: 'dex', dc: 13, knack: [['thief', null, 3]] },
        pass: { text: 'Cheap goblin locks. He presses a healing draught into your hand, the one thing they did not find on him.', effects: [{ item: { t: 'potion_heal', q: 1 } }, { xp: 30 }] },
        fail: { text: 'A pin snaps in the lock. The tripwire his captors left does not.', effects: [{ hurtFrac: 0.15 }] } },
      { label: 'Ask what he knows first', check: { stat: 'cha', dc: 12 },
        pass: { text: 'He talks fast: which corridors are trapped, where the stairs lie, who took his sword. You free him when he is done.', effects: [{ map: 1 }, { xp: 40 }] },
        fail: { text: 'He is too far gone to make sense. You free him anyway, and he stumbles off into the dark.', effects: [{ xp: 10 }] } },
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
    title: 'A Sleeping Ogre', sprite: 'ogre_sleep', depth: [4, 99],
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
        pass: { text: 'It answers, in your own voice, and tells you where the dangers on this floor are waiting.', effects: [{ map: 1 }, { xp: 30 }] },
        fail: { text: 'It answers with something that is not a word, and something steps out of the frame after you.', effects: [{ ambush: { id: 'wraith', n: 1 } }] } },
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
        pass: { text: 'You open it from the side with your blade tip. The darts rattle off the far wall.', effects: [{ loot: 1 }] },
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

  laststand: {
    title: 'The Third Crew\'s Last Stand', sprite: 'barricade', depth: [3, 99],
    text: 'A wall of shields across the passage, and behind it the third crew, where they fell holding it. Their banner is still up. Whatever they held this line against, it did not come through.',
    choices: [
      { label: 'Search the fallen', check: { stat: 'wis', dc: 12 },
        pass: { text: 'You go carefully, and find what they carried: a purse, and something better.', effects: [{ loot: 1 }, { goldPerDepth: 12 }] },
        fail: { text: 'One of them was not quite finished dying. A cold hand closes on your wrist.', effects: [{ maxHp: -2 }] } },
      { label: 'Read their captain\'s last orders', check: { stat: 'int', dc: 11 },
        pass: { text: 'A map of the floor, marked with every place they lost someone. You will not make their mistakes.', effects: [{ map: 1 }, { xp: 30 }] },
        fail: { text: 'The ink has run too far to read.', effects: [] } },
      { label: 'Raise their banner and take heart', check: { stat: 'cha', dc: 12 },
        pass: { text: 'You set the banner straight. For a while it feels as if they march with you.', effects: [{ buff: { stats: [['hit', 2]], dur: 240000 } }, { xp: 20 }] },
        fail: { text: 'The pole snaps in your hands. It feels like a bad sign.', effects: [] } },
      { label: 'Bury them', outcome: { text: 'It takes a long time, and you go hungry for it. It was the right thing to do.', effects: [{ food: -15 }, { xp: 50 }] } },
      { label: 'Leave them to their watch', outcome: { text: 'You step over the shields and go on. They have held their line long enough.', effects: [] } },
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
 * @returns {string[][]} plan[depth] = encounter ids
 */
function encounterPlan(seed, levels) {
  const rng = new Rng(String(seed) + '|encounters');
  // the last floor's own is kept out of the deck, so the deck deals as it always has
  const deck = rng.shuffle(Object.keys(ENCOUNTERS).filter(k => !ENCOUNTERS[k].final));
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
    const open = deck.filter(e => !used.has(e) && d >= ENCOUNTERS[e].depth[0] && d <= ENCOUNTERS[e].depth[1]);
    for (const id of open.slice(0, n)) { used.add(id); plan[d].push(id); }
  }
  return plan;
}

export { ENCOUNTERS, encounterDc, encounterPlan };
