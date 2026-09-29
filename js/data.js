// Static game data: classes, items, monsters, spells, level themes and pixel art.
// All art and content here is original.

// ---------- Story, backgrounds and progression ----------

// The frame the whole run hangs on, shown before the first step.
const PROLOGUE = [
  'For nine hundred years the Heart of the Mountain burned in the dark beneath Karrathal, and the valley above it never knew a killing frost.',
  'Three winters ago it went out. The wells came up black. The orchards died standing. The old road filled with people walking the other way.',
  'The delving guilds sent crews down the Deepdelve to find out why. None of the crews came back, and after the fourth the guilds stopped sending them.',
  'What is down there now wears their faces.',
];

// Who you are before the first stair. Each gives a line of the prologue, a
// motive that colours the ending, and one plain mechanical advantage.
const BACKGROUNDS = {
  oathbroken: {
    name: 'The Oathbroken',
    blurb: 'You ran. The line held without you, and it cost them.',
    perk: 'Every blow lands truer: +1 to hit.',
    story: 'You were sworn to the valley guard, and at Cairn Ford you ran. Forty held the ford without you and none of them walked home. No one in the valley has said the word coward to your face. They do not have to.',
    motive: 'You came down here to spend what is left of yourself well.',
    epi: 'They went down to spend what was left of themselves well.',
  },
  tombwise: {
    name: 'The Tombwise',
    blurb: 'You have opened graves for a living. You know their tricks.',
    perk: 'A thief’s eye for traps and hidden doors.',
    story: 'You have been opening other people’s graves since you were eleven, and you are still alive, which puts you ahead of most in the trade. You know what a false flagstone sounds like. You know which walls are lying.',
    motive: 'You came down here because it is the largest grave anyone has ever offered you.',
    epi: 'They went down because it was the largest grave anyone had ever offered them.',
  },
  ashborn: {
    name: 'The Ashborn',
    blurb: 'Your village burned the night the mountain stirred.',
    perk: 'Hard to put down: +1 Constitution.',
    story: 'When the mountain first shifted, the fires came up through the floor of your village and took it in a night. You carried two children out and went back for a third. You are told you should not have survived the third trip.',
    motive: 'You came down here to make certain it never does that again.',
    epi: 'They went down to make certain the mountain never did that again.',
  },
  cloistered: {
    name: 'The Cloistered',
    blurb: 'Raised among books. You know every draught by sight.',
    perk: 'You recognise every potion and scroll on sight.',
    story: 'You were left at the door of the Hollow Library as an infant and raised among its shelves. You can name any draught by the cast of its light and any scroll by the hand that wrote it. You have also never held a weapon in anger.',
    motive: 'You came down here because the last four chapters of the story are missing.',
    epi: 'They went down because the last four chapters of the story were missing.',
  },
  deepborn: {
    name: 'The Deep-born',
    blurb: 'Born under stone. The dark does not notice you.',
    perk: 'Things in the dark are slower to notice you.',
    story: 'You were born in the lower galleries and did not see open sky until you were nineteen. You still find it too large. Down here you move the way the people down here move, and the dark takes longer to work out that you are not part of it.',
    motive: 'You came down here because it is the only place that has ever felt like a ceiling and not a lid.',
    epi: 'They went down because it was the only place that had ever felt like a ceiling and not a lid.',
  },
  debtor: {
    name: 'The Debtor',
    blurb: 'Sold down the delve to clear a debt. Paid in advance.',
    perk: 'You start with 150 gold in hand.',
    story: 'Your father’s debt outlived him and came looking for you. The house that bought it offered a choice: the delve, or the work gangs on the coast. They paid you in advance, which told you what they expect to get back.',
    motive: 'You came down here owing a debt you intend to close in person.',
    epi: 'They went down owing a debt they meant to close in person.',
  },
  // These two are earned, not given: each stays locked until a run is won at
  // its unlock difficulty or harder (see js/progress.js). The Daily Delve
  // never picks them.
  returned: {
    name: 'The Returned',
    blurb: 'You have been down before, and you came back up.',
    perk: 'A Potion of Extra Healing to start, and the first rest on each floor costs no food.',
    story: 'You have been to the bottom of the Deepdelve and walked out again, which nobody else in the valley can say. You do not talk about what you saw on the last floor or who you left on the way. You keep one good draught back for the bad hour, and you sleep the first chance you get.',
    motive: 'You came down here again because the mountain is not finished with you.',
    epi: 'They went down again because the mountain was not finished with them.',
    unlock: 'normal',
    how: 'Win a run on Normal or Hard to unlock.',
  },
  heartsworn: {
    name: 'The Heartsworn',
    blurb: 'You held the Heart once. It has not let go of you.',
    perk: 'Wounds close on their own up to 60% of your life, not half.',
    story: 'You carried the Heart of the Mountain up out of the dark once, on the hardest road there is, and felt it beat against your ribs the whole way. Since then a second pulse has kept time under your own, slow and warm, and your wounds close faster than they should. Lately it has begun to pull downward.',
    motive: 'You came down here because the Heart is calling you back, and you mean to learn why.',
    epi: 'They went down because the Heart was calling them back, and they meant to learn why.',
    unlock: 'hard',
    how: 'Win a run on Hard to unlock.',
  },
};

// Pages left behind by the crews who went first. One per level, in order, so the
// story of what happened down here unfolds as you descend.
const JOURNAL = [
  { title: 'A guild roster, water-stained', text: 'Fourth crew. Fourteen names, eleven struck through in a different hand. At the bottom someone has written: "the struck ones still answer to their names. do not use their names."' },
  { title: 'A surveyor’s note', text: 'The gallery plans are wrong below the second floor. Not old-wrong. Someone has been cutting new passages and they are cutting them from the inside out.' },
  { title: 'A letter, never sent', text: 'Mira — the Heart is not out. I have stood in the vault and felt it beating through the rock. It has been taken down, not extinguished. Something carried it deeper and it is still warm. Tell the guild. Tell them it is still warm.' },
  { title: 'A page torn from a ledger', text: 'He was the delve’s own archivist. Nine hundred years of it in his head and no one thought that strange. He asked for the Heart to study. The guild said no. The guild has been saying no for four hundred years.' },
  { title: 'A prayer, scratched into the wall', text: 'Not to any god of the valley. The letters run the wrong way and the last line reads: he says the mountain will keep us warm forever. he says we only have to stop.' },
  { title: 'A child’s drawing', text: 'A crooked figure with a crown, holding something round and red, standing over small figures lying down. On the back, in an adult hand: "she has never been below the third floor. she has never seen him. ask how she knows."' },
  { title: 'The last crew’s log', text: 'Day nineteen. We are not lost. We have mapped it twice and both maps are right. The delve is longer on the way out than it was on the way in. Whatever he did to the Heart, he did it to the distance as well.' },
  { title: 'A single line, cut deep', text: 'IT WILL LET YOU TAKE IT. THAT IS THE PART NOBODY WRITES DOWN.' },
];

// On every level gained, three of these are offered and one is kept.
const BOONS = [
  // A stat lesson lifts the score to the next even number, so its bonus always
  // rises by one: +1 to an even score used to change nothing at all.
  // (not for a ranger, who hits and wounds with Dexterity: Strength would buy nothing in a fight)
  { id: 'str', stat: 'str', max: 2, name: 'Hard-Won Strength', desc: 'Your Strength bonus rises by one.', apply: p => { p.stats.str += p.stats.str % 2 ? 1 : 2; }, when: p => p.cls !== 'ranger' },
  { id: 'dex', stat: 'dex', max: 2, name: 'Sure Footing', desc: 'Your Dexterity bonus rises by one.', apply: p => { p.stats.dex += p.stats.dex % 2 ? 1 : 2; } },
  { id: 'con', stat: 'con', max: 2, name: 'Deep Wind', desc: 'Your Constitution bonus rises by one.', apply: p => { p.stats.con += p.stats.con % 2 ? 1 : 2; } },
  { id: 'int', stat: 'int', max: 2, name: 'Sharpened Wits', desc: 'Your Intelligence bonus rises by one.', apply: p => { p.stats.int += p.stats.int % 2 ? 1 : 2; }, when: p => p.cls === 'mage' || p.cls === 'thief' },
  { id: 'wis', stat: 'wis', max: 2, name: 'Clear Sight', desc: 'Your Wisdom bonus rises by one.', apply: p => { p.stats.wis += p.stats.wis % 2 ? 1 : 2; }, when: p => p.cls === 'cleric' || p.cls === 'druid' },
  // two points placed where the player likes, both in one score if they want: a build planned, not dealt
  { id: 'spread', name: 'Self-Taught', desc: 'Two points to add to any scores you choose, both to one if it has room.', spread: 2, max: 2, apply: () => {} },
  { id: 'vigor', name: 'Old Scars', desc: '+6 maximum hit points, and healed by 6 now.', apply: p => { p.maxHp += 6; p.hp += 6; } },
  { id: 'focus', name: 'Quiet Mind', desc: '+4 maximum spell points.', apply: p => { p.bonusSp = (p.bonusSp || 0) + 4; }, when: p => !!CLASSES[p.cls].spells },
  { id: 'keen', name: 'Killing Eye', desc: '+1 to hit with every blow, for good.', unique: true, apply: p => { p.perkHit = (p.perkHit || 0) + 1; } },
  { id: 'swift', name: 'Practised Hands', desc: 'Every swing comes 8% sooner, for good.', unique: true, apply: p => { p.perkSpeed = (p.perkSpeed || 0) + 0.08; } },
  { id: 'hardy', name: 'Slow to Bleed', desc: 'Between fights, wounds close half again as fast.', unique: true, apply: p => { p.perkRegen = (p.perkRegen || 0) + 0.5; } },
];

// Class talents: on every even level the hero picks one of three from their
// class's own, each taken once. They change how a class plays rather than
// adding a point here and there; game.js honours each by id.
const TALENTS = {
  fighter: [
    { id: 'cleave', name: 'Cleave', desc: 'Strike a group and the one behind the front takes half the blow.' },
    { id: 'riposte', name: 'Riposte', desc: 'A blow that misses you, or swings at the air where you stood, opens a riposte: your next swing within two and a half seconds comes at once, with +4 to hit and +2 damage.' },
    { id: 'stand_firm', name: 'Stand Firm', desc: 'A monster\'s trick that lands does half damage to you: a crush, a charge, a claw, the lich\'s storm. Nothing can grab you.' },
    { id: 'second_wind', name: 'Second Wind', desc: 'Falling below a quarter of your health heals another quarter at once. Once every two minutes.' },
    { id: 'weapon_master', name: 'Weapon Master', desc: '+2 damage with every blow of a two-handed weapon, +1 with any other.' },
    { id: 'bulwark', name: 'Bulwark', desc: 'A shield gives you 2 more armour class.' },
    { id: 'shield_slam', name: 'Shield Slam', desc: 'Bash comes back in ten seconds, not fifteen, and knocks what it strikes a square back, dazed a second longer, when there is room.' },
  ],
  cleric: [
    { id: 'healing_hands', name: 'Healing Hands', desc: 'Your healing spells heal a third as much again.' },
    { id: 'sanctified', name: 'Sanctified', desc: 'Your blows deal +1d4 to the undead.' },
    { id: 'zeal', name: 'Zeal', desc: 'Bless lasts twice as long, and while it holds every blow deals +1 damage.' },
    { id: 'warding_light', needs: 'protection', name: 'Warding Light', desc: 'While Protection is upon you, you heal a hit point every three seconds, even mid-fight.' },
    { id: 'last_rites', name: 'Last Rites', desc: 'Once a run, a blow that would kill you leaves you standing on 1 hit point, at the cost of every spell point you hold.' },
    { id: 'radiance', name: 'Radiance', desc: 'Holy Smite deals half as much again and reaches two squares further.' },
  ],
  mage: [
    { id: 'empower', name: 'Empower', desc: 'Your bolts and blasts deal a fifth more damage.' },
    { id: 'arcane_flow', name: 'Arcane Flow', desc: 'Spell points come back twice as fast as you walk.' },
    { id: 'mirror_image', name: 'Mirror Image', desc: 'Casting Shield also conjures two images of you: the next two blows aimed at you strike them instead.' },
    { id: 'quick_words', name: 'Quick Words', desc: 'Casting takes a quarter less time.' },
    { id: 'rime', needs: 'lightning', name: 'Rime', desc: 'Lightning and Cone of Cold jolt everything they hit, holding back its next move by most of a second.' },
    { id: 'kindling', name: 'Kindling', desc: 'Your fire leaves what it hits burning, 1d4 a second for three seconds. Burns stop a troll regrowing.' },
  ],
  thief: [
    { id: 'assassinate', name: 'Assassinate', desc: 'A strike from the shadows deals triple damage, not double.' },
    { id: 'evasion', name: 'Evasion', desc: 'One arrow or bolt in three misses you outright, and webs slide off you.' },
    { id: 'venom', name: 'Venomed Blades', desc: 'One hit in four poisons the living: 1d3 a second for four seconds.' },
    { id: 'lucky', name: 'Lucky', desc: 'Your critical hits land one number sooner on the die.' },
    { id: 'shadow_step', name: 'Shadow Step', desc: 'Sidestep, and your next blow within two and a half seconds strikes from the shadows.' },
    { id: 'light_fingers', name: 'Light Fingers', desc: 'Monsters drop loot half as often again, and traders pay you a quarter more.' },
    { id: 'choking_cloud', name: 'Choking Cloud', desc: 'What loses you in your Smoke comes out of it coughing: its first move a second and a half late.' },
  ],
  ranger: [
    { id: 'eagle_eye', name: 'Eagle Eye', desc: 'Your bows, slings and throwing knives reach two squares further, and hit one more often.' },
    { id: 'volley', name: 'Volley', desc: 'Every third arrow that lands looses a second after it, for half the damage.' },
    { id: 'hunters_mark', name: 'Hunter\'s Mark', desc: 'An arrow at a foe that has not yet seen you does double damage.' },
    { id: 'swift_quiver', name: 'Swift Quiver', desc: 'Your bow shots come a sixth sooner.' },
    { id: 'long_snare', name: 'Long Snare', desc: 'Snare holds a second and a half longer, and comes back in twelve seconds, not sixteen.' },
    { id: 'camouflage', name: 'Camouflage', desc: 'Sleeping monsters notice you a square later.' },
    { id: 'field_craft', name: 'Field Craft', desc: 'You make a good camp: the second rest on a floor is as good and as quiet as the first, and rests thin out one later.' },
  ],
  druid: [
    { id: 'thick_hide', name: 'Thick Hide', desc: 'Your bear\'s hide is half as thick again.' },
    { id: 'rending_claws', name: 'Rending Claws', desc: 'In bear shape, one blow in three that lands leaves the living bleeding: 1d4 a second for three seconds.' },
    { id: 'barkskin', name: 'Barkskin', desc: 'Your armour class is 1 better, in bear shape or out of it.' },
    { id: 'long_thorns', name: 'Long Thorns', desc: 'Thorn Lash reaches two squares further and deals 2 more.' },
    { id: 'green_hands', name: 'Green Hands', desc: 'Mending Moss heals a third as much again.' },
    { id: 'stormborn', name: 'Stormborn', desc: 'Call Lightning deals a quarter more, and holds back what it strikes a moment.' },
    { id: 'beast_bond', name: 'Beast Bond', desc: 'Your companion heals a hit point every three seconds at your side, even mid-fight.' },
  ],
};

// Paths: at PATH_LEVEL each class chooses one of its two, once and for good,
// in place of that level's lesson. A path is a way of fighting, not a bonus:
// each gives up something, or asks for something, in return. game.js honours
// each by id (see its paths block); effects are what the player is told.
const PATH_LEVEL = 5;
/** At this level a hero on a path masters it: one of the path's two capstones, in place of that level's lesson. */
const CAPSTONE_LEVEL = 9;

// Vows: a harder run chosen at the start, open once any hero has won on Hard.
// Each one kept to a win (on Normal or Hard, on one life) is a trophy of its own.
const VOWS = {
  iron:    { name: 'Iron Vow',     desc: 'No rest until the Heart is won: the Rest button and the trader\'s lamp are closed to you.' },
  pauper:  { name: 'Pauper\'s Vow', desc: 'No trader will deal with you: no buying, selling or forge work.' },
  unaided: { name: 'Unaided Vow',  desc: 'No draught passes your lips: healing comes from rest, prayer, scrolls and the fountains alone.' },
};
// The fork: a third of the way down the stair divides, and the floors
// between there and the last two lean one way or the other. Each keeps its
// own colours, its own creatures (kin come three times as often, the other
// road's a third as often), the champions that suit it, an encounter met
// nowhere else, and a relic on its last floor (see routeRelic in relics.js).
const ROUTES = {
  crypts: { name: 'the Crypts', choice: 'Down into the Crypts', desc: 'Old burial halls, cold and quiet: the dead, and what feeds on them. The traders here keep more for curses and poison, and its last floor holds a relic found nowhere else.',
    theme: 6, kin: ['skeleton', 'zombie', 'ghoul', 'wraith', 'spider', 'bat', 'slime', 'acolyte'], champions: ['vessra', 'morrow', 'orla', 'skarrow'], encounter: 'ossuary',
    epi: 'They went down by the Crypts, among the old dead, and for a long while after they could not sleep without a lamp lit.' },
  warrens: { name: 'the Warrens', choice: 'Down into the Warrens', desc: 'Goblin tunnels and orc halls, loud and crowded, and bigger things further down. The traders here deal in arms, and its last floor holds a relic found nowhere else.',
    theme: 7, kin: ['goblin', 'rat', 'orc', 'archer', 'ogre', 'troll', 'minotaur'], champions: ['grisk', 'ushgar', 'gorrum', 'skarrow'], encounter: 'warcamp',
    epi: 'They went down through the Warrens, and were still picking goblin arrowheads out of their pack a month later.' },
};

// Feats: wins of a particular kind, each a trophy of its own in the Hall.
const FEATS = {
  long: { name: 'The Long Delve', desc: 'Win a delve of twelve floors or more, on Normal or Hard.' },
  crypts: { name: 'By the Crypts', desc: 'Win a delve that went down through the Crypts, on Normal or Hard.' },
  warrens: { name: 'By the Warrens', desc: 'Win a delve that went down through the Warrens, past the Goblin Warlord, on Normal or Hard.' },
  collector: { name: 'The Collector', desc: 'Find every relic at least once, over as many runs as it takes.' },
  friend: { name: 'Friend of the Lampfolk', desc: 'Win having done three traders\' jobs in the one run, on Normal or Hard.' },
  veteran: { name: 'Old Campaigners', desc: 'Win with a companion at your side that is a veteran, on Normal or Hard.' },
  wildheart: { name: 'Wildheart', desc: 'Win as a Druid, on Normal or Hard, having taken the bear\'s shape thirty times in the run.' },
};
const PATHS = {
  fighter: [
    { id: 'knight', name: 'Knight', flavour: 'Shield up and feet set: the wall the dark breaks on.', wants: 'shield', effects: [
      'A shield gives you 1 more armour class.',
      'With a shield up, one ordinary blow in eight that lands is caught on it for half damage.',
      'A warned trick that lands does a quarter less to you.',
      'Your Bash sets a foe back most of a second longer.',
    ], capstones: [
      { id: 'unbreakable', name: 'Unbreakable', flavour: 'The shield is not held any more. It is where you are.', effects: ['With a shield up, one ordinary blow in four that lands is caught on it for half, not one in eight.'] },
      { id: 'rally', name: 'Rallying Bash', flavour: 'Every blow you turn aside puts heart back into you.', effects: ['Your Bash comes back twice as fast, and each one that lands heals you 1d6.'] },
    ] },
    { id: 'berserker', name: 'Berserker', flavour: 'Every wound is fuel. You fight open, and you fight hard.', effects: [
      '+1 damage with every blow for each sixth of your life you have lost, up to +4.',
      'Below half your life, your swing comes a tenth sooner.',
      'You fight open: 2 less armour class, whatever you wear.',
      'Your Bash is a blow of its own, rage and all.',
    ], capstones: [
      { id: 'undying', name: 'Undying', flavour: 'Not yet. Not while there is anything left to hit.', effects: ['Once on each floor, a blow that would kill you leaves you standing on 1 hit point.'] },
      { id: 'bloodlust', name: 'Bloodlust', flavour: 'It is not the wounds that feed you now. It is the kills.', effects: ['Your rage grows to +6, not +4, and every foe you fell heals you 1d4.'] },
    ] },
  ],
  cleric: [
    { id: 'templar', name: 'Templar', flavour: 'Faith with an edge on it, carried into the front line.', effects: [
      'Your blows deal +1d3 to the undead (more with Sanctified).',
      'Bless lasts twice as long (four times with Zeal).',
      'Holy Smite deals a tenth more.',
    ], capstones: [
      { id: 'dawnbringer', name: 'Dawnbringer', flavour: 'Where you walk, the dead remember they are dead.', effects: ['Your blows deal +1d6 to the undead, not +1d3.'] },
      { id: 'crusade', name: 'Crusader\'s Smite', flavour: 'The Smite is not a prayer any more. It is a verdict.', effects: ['Holy Smite deals a quarter more, not a tenth, and costs a spell point less.'] },
    ] },
    { id: 'healer', name: 'Healer', flavour: 'You came down to bring people back up. That includes you.', effects: [
      'Your healing spells heal a quarter more.',
      'While Protection is upon you, you heal a hit point every four seconds, even mid-fight.',
      '+1 spell point for every three hero levels.',
    ], capstones: [
      { id: 'wellspring', name: 'Wellspring', flavour: 'The well does not run dry. You have stopped asking it to.', effects: ['Your healing spells cost a spell point less.'] },
      { id: 'miracle', name: 'Miracle', flavour: 'Something answers when you fall, and it has always answered.', effects: ['Once on each floor, a blow that would kill you heals you to half your life instead.'] },
    ] },
  ],
  mage: [
    { id: 'pyromancer', name: 'Pyromancer', flavour: 'Everything burns, given long enough. You are impatient.', effects: [
      'Burning Hands and the Scroll of Fire deal a fifth more.',
      'Your fire leaves what it hits burning, 1d4 a second for three seconds (six with Kindling).',
      'You have given up the cold for the fire: Lightning Bolt costs a spell point more, Cone of Cold two.',
    ], capstones: [
      { id: 'inferno', name: 'Inferno', flavour: 'It was never enough to burn. It has to consume.', effects: ['Your fire spells and the Scroll of Fire deal a third more, not a fifth.'] },
      { id: 'wildfire', name: 'Wildfire', flavour: 'What you set alight stays alight.', effects: ['What your fire leaves burning takes 1d6 a second, not 1d4, for twice as long.'] },
    ] },
    { id: 'frostweaver', name: 'Frostweaver', flavour: 'Cold is patience made into a weapon. Let them come to you slowly.', effects: [
      'Lightning and Cone of Cold hold back everything they hit by most of a second (twice that with Rime).',
      'Shield gives +5 armour class, not +4, and lasts a minute and a half.',
      'Lightning Bolt costs 4 spell points, not 5, and Cone of Cold 8, not 10.',
    ], capstones: [
      { id: 'deep_winter', name: 'Deep Winter', flavour: 'The cold settles in the joints, and stays.', effects: ['Your lightning and cold hold back what they hit twice as long.'] },
      { id: 'ice_armour', name: 'Ice Armour', flavour: 'The shield grows thick with rime, and does not melt.', effects: ['Shield gives +7 armour class, not +5.'] },
    ] },
  ],
  thief: [
    { id: 'assassin', name: 'Assassin', flavour: 'One blow, from the dark, where it counts. There should not need to be a second.', effects: [
      'A strike from the shadows deals triple damage (four times with Assassinate).',
      'Your critical hits land one number sooner on the die.',
      'Sleeping monsters notice you a square later.',
      'Your Smoke hangs half as long again.',
    ], capstones: [
      { id: 'death_mark', name: 'Death Mark', flavour: 'They were dead the moment you chose them.', effects: ['A strike from the shadows deals one more time its damage: four times (five with Assassinate).'] },
      { id: 'shadows_edge', name: 'Shadow\'s Edge', flavour: 'You no longer look for the gap. You make it.', effects: ['Your critical hits land two numbers sooner on the die, not one.'] },
    ] },
    { id: 'trickster', name: 'Trickster', flavour: 'Never where the blow lands, and always leaving with more than you brought.', effects: [
      'One ordinary blow in eight that would land, you slip aside from.',
      'A blow that swings at the air where you stood leaves its maker open, as an answered trick does.',
      '+4 to spot and to dodge a trap, and gold and gems you find are worth a quarter more.',
      'Your Smoke comes back in 16 seconds, not 24.',
    ], capstones: [
      { id: 'vanish', name: 'Vanish', flavour: 'Where you were is a trick of the light.', effects: ['One ordinary blow in five that would land, you slip aside from, not one in eight.'] },
      { id: 'quick_smoke', name: 'Quick Smoke', flavour: 'There is always another pellet, somehow.', effects: ['Your Smoke comes back in 10 seconds, not 16.'] },
    ] },
  ],
  ranger: [
    { id: 'sharpshooter', name: 'Sharpshooter', flavour: 'The arrow was on its way before the thing knew it was seen.', effects: [
      'An arrow at a foe three squares off or more deals 3 more damage.',
      'With a bow, a sling or throwing knives, your critical hits land one number sooner on the die.',
      'Your first arrow at a foe that has not seen you never misses.',
      'Snare reaches two squares further.',
    ], capstones: [
      { id: 'deadeye', name: 'Deadeye', flavour: 'Farther is easier. You have stopped explaining it.', effects: ['An arrow at a foe three squares off or more deals 5 more damage, not 3.'] },
      { id: 'swift_draw', name: 'Swift Draw', flavour: 'Nock, draw, loose: one movement, and then another.', effects: ['A bow or a sling draws a fifth faster.'] },
    ] },
    { id: 'warden', name: 'Warden', flavour: 'Holds the line where the dark comes through, and lets nothing past.', effects: [
      'Your armour class is 1 better.',
      'Snare\'s cord bites (1d6 and your Dexterity) and holds a second longer.',
      'A snared foe takes 2 more damage from every blow and arrow of yours.',
      'Snare comes back three seconds sooner.',
    ], capstones: [
      { id: 'iron_snare', name: 'Iron Snare', flavour: 'What you catch does not get free to fight you whole.', effects: ['A snared foe takes 4 more damage from every blow and arrow of yours, not 2.'] },
      { id: 'wild_bulwark', name: 'Wild Bulwark', flavour: 'The line holds because you are the line.', effects: ['Your armour class is 3 better, not 1.'] },
    ] },
  ],
  druid: [
    { id: 'shapeshifter', name: 'Shapeshifter', flavour: 'The bear is not a shape you take any more. It is one you remember.', effects: [
      'Wild Shape costs a spell point less, and lasts 45 seconds.',
      'Your claws deal 2 more damage.',
      'Your other spells cost a spell point more.',
    ], capstones: [
      { id: 'dire_bear', name: 'Dire Bear', flavour: 'The thing you become has forgotten it was ever small.', effects: ['Your claws deal 5 more damage, not 2.'] },
      { id: 'old_hide', name: 'Old Hide', flavour: 'Scars on scars. Nothing gets through the first time.', effects: ['Your bear\'s hide is 8 thicker.'] },
    ] },
    { id: 'grovewarden', name: 'Grovewarden', flavour: 'The wood keeps its own, and so do you.', effects: [
      'Your armour class is 2 better.',
      'Your companion has twice the hit points it would at another\'s side, not half again, and strikes 2 harder.',
      'Mending Moss heals a quarter more.',
      'Thorn Lash holds back what it strikes a moment.',
      'Entangle holds a second and a half longer.',
    ], capstones: [
      { id: 'heartwood', name: 'Heartwood', flavour: 'Green things grow where you have bled.', effects: ['Mending Moss costs a spell point less.'] },
      { id: 'old_growth', name: 'Old Growth', flavour: 'The roots were here first. They have been waiting.', effects: ['Entangle holds every foe in its reach down the corridor, not only the first.'] },
    ] },
  ],
};

/** Whether a class can carry this in the shield hand: a thief takes a buckler and nothing bigger, and a caster's focus is for that caster's class alone. */
const shieldFits = (c, b) => (b.focus ? c.focus === b.focus : c.shield === true || (c.shield === 'light' && !!b.light));
/** Whether a class can wear a body armour: robes are a mage's alone, and a mage wears nothing else. */
const armorFits = (c, b) => (b.weight === 'cloth' ? c.armor === 'cloth' : c.armor === 'heavy' || (c.armor === 'light' && b.weight === 'light'));

const XP_TABLE = [0, 45, 120, 265, 540, 1020, 1800, 3000, 4800, 7400, 11000, 16200, 22800];
const MAX_LEVEL = 12;

const CLASSES = {
  fighter: {
    name: 'Fighter', plural: 'Fighters', title: 'Blademaster', hitDie: 10, hitProg: 1, armor: 'heavy', shield: true, dualWield: true, spells: null, primary: 'str',
    desc: 'Master of arms. Most hit points, any weapon or armour, the only one trained to fight with a blade in each hand, and a Bash that breaks off a foe\'s blow.',
    startKit: ['longsword', 'scale', 'shield', 'ration', 'ration', 'potion_heal'],
  },
  cleric: {
    name: 'Cleric', plural: 'Clerics', title: 'High Priest', hitDie: 9, hitProg: 3 / 4, armor: 'heavy', shield: true, focus: 'cleric', castMs: 1000, spells: 'cleric', primary: 'wis',
    desc: 'Armoured priest. Heals, blesses and smites the undead, and faith guides the mace: Wisdom lands its blows.',
    // a cleric fights in the front line as a fighter does, and dresses for it
    startKit: ['mace', 'scale', 'shield', 'ration', 'ration', 'potion_heal'],
  },
  mage: {
    name: 'Mage', plural: 'Mages', title: 'Archmage', hitDie: 5, startHp: 7, hitProg: 1 / 3, armor: 'cloth', shield: false, focus: 'mage', castMs: 500, spMul: 1.75, spells: 'mage', primary: 'int',
    desc: 'Fragile scholar with deep reserves of power and quick words to spend them. Each foe a spell destroys gives back a spell point.',
    startKit: ['staff', 'dagger', 'robe_apprentice', 'ration', 'ration', 'potion_heal', 'potion_heal', 'scroll_fire'],
  },
  thief: {
    name: 'Thief', plural: 'Thieves', title: 'Shadowmaster', hitDie: 8, hitProg: 2 / 3, armor: 'light', shield: 'light', spells: null, primary: 'dex',
    desc: 'Quick and quiet. Monsters notice a thief late, a sleeping foe takes a double blow, and Smoke makes everything close lose them. Light armour, and a buckler at most.',
    startKit: ['shortsword', 'throwknife', 'leather', 'ration', 'ration', 'potion_heal', 'scroll_map'],
  },
  ranger: {
    name: 'Ranger', plural: 'Rangers', title: 'Deepstalker', locked: 'Win once on one life with each of the other four classes, at any difficulty, and a Ranger will come to your fire.', hitDie: 9, hitProg: 3 / 4, armor: 'light', shield: false, spells: null, primary: 'dex',
    desc: 'A hunter of the deep, bow in hand. Dexterity looses every arrow and lands every blow, a bow or sling shot at a foe two squares off or more bites harder, light feet make a ranger harder to hit as they grow, and Snare catches the first foe down the corridor.',
    startKit: ['shortbow', 'dagger', 'leather', 'ration', 'ration', 'potion_heal', 'potion_heal'],
  },
  // opened by a win with a companion still at the hero's side (opens: 'kin'), not by the other classes' wins
  druid: {
    name: 'Druid', plural: 'Druids', title: 'Archdruid', opens: 'kin', locked: 'Win once on one life with a companion still at your side, at any difficulty, and a Druid will come to your fire.', hitDie: 8, hitProg: 2 / 3, armor: 'light', shield: 'light', castMs: 800, spMul: 0.85, spells: 'druid', primary: 'wis',
    desc: 'Keeper of the old ways, at home in the dark as the beasts are. Wild Shape makes a bear of you, all claws and hide; thorns, moss and storm answer Wisdom, and so does the spear; and a companion at a druid\'s side grows tougher and sooner wise.',
    startKit: ['spear', 'leather', 'ration', 'ration', 'potion_heal', 'potion_heal'],
  },
};

// Names for a hero who would rather not choose: valley names, short enough
// for the HUD, none of them famous.
const HERO_NAMES = [
  'Wren', 'Tamsin', 'Oren', 'Brannoc', 'Idris', 'Maelis', 'Corvin', 'Hesk', 'Aldra', 'Fenn', 'Rook', 'Sabine',
  'Ysolde', 'Garrow', 'Emeric', 'Nell', 'Doran', 'Ilse', 'Cadoc', 'Mirren', 'Tobin', 'Ashe', 'Veyra', 'Holt',
  'Brisa', 'Anselm', 'Quill', 'Marta', 'Evander', 'Lark', 'Osric', 'Juniper', 'Talan', 'Petra', 'Caspian', 'Rhiannon',
  'Halvard', 'Senna', 'Bram', 'Odile', 'Kestrel', 'Morwen', 'Ulric', 'Tessaly', 'Garnet', 'Faelan', 'Isolde', 'Dunstan',
  'Elowen', 'Cormac', 'Linnet', 'Ragna', 'Silas', 'Thessaly', 'Aric', 'Bryony', 'Gideon', 'Maud', 'Torvin', 'Ottilie',
  'Arden', 'Blythe', 'Calla', 'Darrow', 'Eira', 'Fitch', 'Greer', 'Harlow', 'Ione', 'Jarrah', 'Kit', 'Leofric',
  'Mabyn', 'Nesta', 'Perrin', 'Rosalind', 'Stellan', 'Tamsyn', 'Ulla', 'Wystan', 'Yarrow', 'Zillah', 'Hawise', 'Emrys',
];

// And names that sound like where a hero comes from: a random name is drawn
// from these half the time, so a Tombwise delver is often called like one.
const BG_NAMES = {
  oathbroken: ['Garrick', 'Hollis', 'Brand', 'Aldous', 'Merrick', 'Tamar', 'Roslyn', 'Edda', 'Corwin', 'Sigrun', 'Hale', 'Brennan'],
  tombwise: ['Vesper', 'Sexton', 'Ambrose', 'Crane', 'Ebon', 'Thistle', 'Wick', 'Nightjar', 'Barrow', 'Maudlin', 'Obed', 'Sable'],
  ashborn: ['Cinder', 'Emberly', 'Flint', 'Kindra', 'Brenna', 'Scoria', 'Pyrrha', 'Tarn', 'Sorrel', 'Hearth', 'Branwen', 'Coalby'],
  cloistered: ['Benedikt', 'Clement', 'Hildegard', 'Anselma', 'Jerome', 'Vellum', 'Placid', 'Scholastica', 'Tobias', 'Agnes', 'Ansgar', 'Lucia'],
  deepborn: ['Nym', 'Grue', 'Moss', 'Umber', 'Drift', 'Sil', 'Hollow', 'Echo', 'Murk', 'Vane', 'Gloam', 'Pell'],
  debtor: ['Penny', 'Marlow', 'Tuck', 'Jory', 'Nettle', 'Dunning', 'Hob', 'Farthing', 'Bess', 'Ludo', 'Grisel', 'Owain'],
  returned: ['Lazar', 'Wendell', 'Hesper', 'Galen', 'Sorrow', 'Mercer', 'Oriel', 'Rue', 'Absalom', 'Winter', 'Tristan', 'Ysolt'],
  heartsworn: ['Aurelian', 'Solenne', 'Oriane', 'Lucan', 'Cordelia', 'Radegund', 'Evangeline', 'Tiberius', 'Heloise', 'Castor', 'Liora', 'Ignatius'],
};
/** Every name a hero may be given. */
const ALL_HERO_NAMES = [...new Set([...HERO_NAMES, ...Object.values(BG_NAMES).flat()])];
/**
 * A name for a hero who would rather not choose, often one that sounds like
 * their background, and never the one given just before.
 * @param {string} [bg] @param {string} [avoid] @param {() => number} [rnd]
 */
function heroName(bg, avoid = '', rnd = Math.random) {
  const own = (bg && BG_NAMES[bg]) || [];
  let name = avoid;
  for (let i = 0; i < 20 && name === avoid; i++) {
    const pool = own.length && rnd() < 0.5 ? own : HERO_NAMES;
    name = pool[Math.floor(rnd() * pool.length)];
  }
  return name;
}

// What sets a middle floor apart now and then (dungeon.js deals them out):
// the line on arriving, and the chip that stays up while you are there.
const TWISTS = {
  dark: { name: 'Dark', arrive: 'The torches on this floor have burnt out. It is hard to see, and hard to be seen.', chip: 'Most torches here are out: less to see by, but sleeping things notice you a square later' },
  flooded: { name: 'Flooded', arrive: 'Black water stands ankle-deep on this floor. Everything here wades, you too.', chip: 'Black water: you and everything here move a quarter slower' },
  restless: { name: 'Restless dead', arrive: 'The dead do not lie still on this floor. You can hear them walking.', chip: 'Many of this floor\'s creatures have risen from the dead' },
  market: { name: 'Goblin market', arrive: 'Goblin voices haggle somewhere on this floor: a market, and a trader who undersells.', chip: 'A trader here, selling cheaper than most' },
  overgrown: { name: 'Overgrown', arrive: 'Roots have broken up through the stone here, and moss lies thick over everything. Pale caps grow in the corners.', chip: 'Moss hides the traps: harder to spot. Pale caps to eat grow here. A druid is at home: their spells cost a point less' },
};

const STAT_NAMES = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };

const ITEMS = {
  // weapons: dmg = [dice, sides, bonus]; speed = attack cooldown in ms
  dagger:     { kind: 'weapon', name: 'Dagger',           dmg: [1, 4, 0],  speed: 400,  cls: ['fighter', 'mage', 'thief', 'ranger', 'druid'], value: 2,  sprite: 'dagger', tier: 1 },
  club:       { kind: 'weapon', name: 'Club',             dmg: [1, 4, 0],  speed: 500,  cls: ['fighter', 'cleric', 'thief', 'druid'], value: 1, sprite: 'club', tier: 1, blunt: true },
  staff:      { kind: 'weapon', name: 'Quarterstaff',     dmg: [1, 6, 0],  speed: 600,  cls: ['fighter', 'mage', 'cleric', 'druid'], twoHanded: true, value: 2, sprite: 'staff', tier: 1, blunt: true },
  shortsword: { kind: 'weapon', name: 'Short Sword',      dmg: [1, 6, 0],  speed: 550,  cls: ['fighter', 'thief', 'ranger'], value: 8, sprite: 'shortsword', tier: 1 },
  mace:       { kind: 'weapon', name: 'Mace',             dmg: [1, 6, 1],  speed: 700,  cls: ['fighter', 'cleric'], value: 8, sprite: 'mace', tier: 1, blunt: true },
  hammer:     { kind: 'weapon', name: 'War Hammer',       dmg: [1, 4, 2],  speed: 650,  cls: ['fighter', 'cleric'], value: 9, sprite: 'hammer', tier: 2, blunt: true },
  spear:      { kind: 'weapon', name: 'Spear',            dmg: [1, 8, 0],  speed: 700,  cls: ['fighter', 'ranger', 'druid'], value: 6, sprite: 'spear', tier: 2 },
  longsword:  { kind: 'weapon', name: 'Long Sword',       dmg: [1, 8, 0],  speed: 700,  cls: ['fighter', 'thief', 'ranger'], value: 15, sprite: 'longsword', tier: 2 },
  flail:      { kind: 'weapon', name: 'Flail',            dmg: [2, 4, 0],  speed: 800,  cls: ['fighter', 'cleric'], value: 15, sprite: 'flail', tier: 3, blunt: true },
  battleaxe:  { kind: 'weapon', name: 'Battle Axe',       dmg: [1, 8, 1],  speed: 850,  cls: ['fighter'], value: 18, sprite: 'battleaxe', tier: 3 },
  greatsword: { kind: 'weapon', name: 'Two-handed Sword', dmg: [1, 10, 2], speed: 1000, cls: ['fighter'], twoHanded: true, value: 40, sprite: 'greatsword', tier: 4 },
  // thrown and missile arms. Attack reaches down the corridor when one is in hand.
  throwknife: { kind: 'weapon', name: 'Throwing Knives', dmg: [1, 4, 0], speed: 520, range: 4, cls: ['fighter', 'thief', 'mage', 'ranger'], value: 12, sprite: 'throwknife', tier: 1 },
  sling:      { kind: 'weapon', name: 'Sling',           dmg: [1, 4, 1], speed: 800, range: 5, cls: ['fighter', 'thief', 'cleric', 'ranger', 'druid'], value: 10, sprite: 'sling', tier: 2, aimed: true },
  shortbow:   { kind: 'weapon', name: 'Short Bow',       dmg: [1, 6, 0], speed: 850, range: 6, cls: ['fighter', 'thief', 'ranger'], twoHanded: true, value: 30, sprite: 'shortbow', tier: 3, aimed: true },
  longbow:    { kind: 'weapon', name: 'Long Bow',        dmg: [1, 8, 0],  speed: 950, range: 7, cls: ['fighter', 'ranger'], twoHanded: true, value: 70, sprite: 'longbow', tier: 5, aimed: true },
  // armor
  leather: { kind: 'armor', name: 'Leather Armour',  ac: 2, weight: 'light', value: 10,  sprite: 'leather', tier: 1 },
  studded: { kind: 'armor', name: 'Studded Leather', ac: 3, weight: 'light', value: 20,  sprite: 'studded', tier: 2 },
  scale:   { kind: 'armor', name: 'Scale Mail',      ac: 4, weight: 'heavy', value: 45,  sprite: 'scale', tier: 2 },
  chain:   { kind: 'armor', name: 'Chain Mail',      ac: 5, weight: 'heavy', value: 75,  sprite: 'chain', tier: 3 },
  splint:  { kind: 'armor', name: 'Splint Mail',     ac: 6, weight: 'heavy', value: 120, sprite: 'splint', tier: 4 },
  plate:   { kind: 'armor', name: 'Plate Mail',      ac: 7, weight: 'heavy', value: 300, sprite: 'plate', tier: 5 },
  // a mage's cloth: little armour, woven for spellwork (see armorFits)
  robe_apprentice: { kind: 'armor', name: "Apprentice's Robe", ac: 1, weight: 'cloth', value: 8,   sprite: 'robe_apprentice', tier: 1 },
  robe_silk:       { kind: 'armor', name: 'Silk Robe',         ac: 1, weight: 'cloth', value: 60,  sprite: 'robe_silk', tier: 2, sp: 4 },
  robe_warded:     { kind: 'armor', name: 'Warded Robe',       ac: 2, weight: 'cloth', value: 90,  sprite: 'robe_warded', tier: 3 },
  robe_magi:       { kind: 'armor', name: 'Robe of the Magi',  ac: 2, weight: 'cloth', value: 250, sprite: 'robe_magi', tier: 5, sp: 6, cheap: 1 },
  // shields
  buckler:     { kind: 'shield', name: 'Buckler',      ac: 1, value: 5,  sprite: 'buckler', tier: 1, light: true },
  shield:      { kind: 'shield', name: 'Shield',       ac: 2, value: 12, sprite: 'shield', tier: 2 },
  towershield: { kind: 'shield', name: 'Tower Shield', ac: 3, value: 40, sprite: 'towershield', tier: 4 },
  // What the deep's own beasts leave: never found lying about or on a
  // shelf (tier 99), only taken from a cave wyrm or a quillback that falls.
  wyrmscale:   { kind: 'armor', name: 'Wyrm-Scale Mail', ac: 4, weight: 'light', power: 'fireward', value: 260, sprite: 'wyrmscale', tier: 99 },
  quillshield: { kind: 'shield', name: 'Quill Shield', ac: 2, power: 'thorns', value: 110, sprite: 'quillshield', tier: 99 },
  // a cloak over whatever else is worn, for anyone: known at a glance, as a ring is not
  cloak_protect: { kind: 'cloak', name: 'Cloak of Protection', ac: 1, value: 80,  sprite: 'cloak_protect', tier: 2,
    desc: 'Armour class +1, over whatever else you wear.' },
  cloak_elven:   { kind: 'cloak', name: 'Elven Cloak',          power: 'quiet',  value: 90,  sprite: 'cloak_elven', tier: 2,
    desc: 'Sleeping things notice you a square later.' },
  cloak_warmth:  { kind: 'cloak', name: 'Cloak of Warmth',      power: 'warmth', value: 70,  sprite: 'cloak_warmth', tier: 2,
    desc: 'Cold does half as much to you: a wraith\'s touch, the lich\'s grave-cold and its storm.' },
  // what a caster holds in the free hand instead of a shield (see shieldFits)
  spellbook:     { kind: 'shield', name: 'Spellbook',       ac: 0, value: 40,  sprite: 'spellbook', tier: 2, focus: 'mage', regen: 1,
    desc: 'Spell points come back a quarter faster as you walk.' },
  crystal_orb:   { kind: 'shield', name: 'Crystal Orb',     ac: 0, value: 90,  sprite: 'crystal_orb', tier: 3, focus: 'mage', die: 1,
    desc: 'One more damage on each of a spell\'s dice, up to two.' },
  orb_storms:    { kind: 'shield', name: 'Orb of Storms',   ac: 0, value: 260, sprite: 'orb_storms', tier: 5, focus: 'mage', storm: 1,
    desc: 'Lightning Bolt and Cone of Cold strike a fifth harder and hold what they hit back a moment longer.' },
  holy_symbol:   { kind: 'shield', name: 'Holy Symbol',     ac: 1, value: 40,  sprite: 'holy_symbol', tier: 2, focus: 'cleric', mercy: 1,
    desc: 'Your healing spells heal a quarter more.' },
  silver_symbol: { kind: 'shield', name: 'Silver Sunburst', ac: 1, value: 90,  sprite: 'silver_symbol', tier: 3, focus: 'cleric', wrath: 1,
    desc: 'Holy Smite and Flame Strike strike a quarter harder.' },
  reliquary:     { kind: 'shield', name: 'Reliquary',       ac: 1, value: 260, sprite: 'reliquary', tier: 5, focus: 'cleric', mercy: 1, wrath: 1,
    desc: 'Your healing spells heal a quarter more, and Holy Smite and Flame Strike strike a quarter harder.' },
  // potions
  potion_heal:  { kind: 'potion', name: 'Potion of Healing',       stack: true, value: 25, sprite: 'potion_red',    effect: 'heal', heal: [2, 8, 2], desc: 'Restores 2d8+2 hit points.' },
  potion_xheal: { kind: 'potion', name: 'Potion of Extra Healing', stack: true, value: 60, sprite: 'potion_pink',   effect: 'heal', heal: [4, 8, 4], desc: 'Restores 4d8+4 hit points.' },
  potion_cure:  { kind: 'potion', name: 'Antidote',                stack: true, value: 20, sprite: 'potion_green',  effect: 'cure', desc: 'Neutralises poison.' },
  potion_might: { kind: 'potion', name: 'Potion of Might',         stack: true, value: 40, sprite: 'potion_orange', effect: 'might', desc: '+2 to hit and damage for two minutes.' },
  potion_mana:  { kind: 'potion', name: 'Potion of Clarity',       stack: true, value: 40, sprite: 'potion_blue',   effect: 'mana', desc: 'Restores all spell points.' },
  // scrolls (usable by anyone)
  scroll_fire:     { kind: 'scroll', name: 'Scroll of Fire',        stack: true, value: 30, sprite: 'scroll', effect: 'fire', desc: 'Hurls a ball of fire (4d6) at the foe ahead.' },
  scroll_heal:     { kind: 'scroll', name: 'Scroll of Restoration', stack: true, value: 35, sprite: 'scroll', effect: 'heal', heal: [3, 8, 3], desc: 'Restores 3d8+3 hit points.' },
  scroll_map:      { kind: 'scroll', name: 'Scroll of Mapping',     stack: true, value: 30, sprite: 'scroll', effect: 'map', desc: 'Reveals the layout of this floor.' },
  scroll_teleport: { kind: 'scroll', name: 'Scroll of Teleport',    stack: true, value: 30, sprite: 'scroll', effect: 'teleport', desc: 'Whisks you to a random spot on this floor.' },
  // a job's satchel, lost by one of the Lampfolk: carried back to be paid for, never sold
  satchel: { kind: 'quest', name: 'Lampfolk Satchel', value: 0, sprite: 'satchel', desc: 'Lost by one of the Lampfolk. The next trader you meet will pay for its return.' },
  // Charms for a companion to wear, one at a time: given from the pack, they go with it.
  charm_collar: { kind: 'charm', name: 'Iron-Studded Collar', value: 40, sprite: 'charm_collar', charm: 'collar', desc: 'For your companion to wear: blows find it harder to land (+3 armour).' },
  charm_fang:   { kind: 'charm', name: 'Fang Charm',          value: 40, sprite: 'charm_fang',   charm: 'fang',   desc: 'For your companion to wear: its every blow deals 2 more.' },
  charm_rowan:  { kind: 'charm', name: 'Rowan Knot',          value: 40, sprite: 'charm_rowan',  charm: 'rowan',  desc: 'For your companion to wear: its wounds close by themselves, a hit point every four seconds.' },
  // Oils and coatings: worked into the weapon, they ride on its next blows that land.
  oil_fire:   { kind: 'oil', name: 'Fire Oil',     stack: true, value: 30, sprite: 'oil_fire',   coat: 'fire',   desc: 'Coats your weapon: its next 20 blows that land burn for 1d4 more, and no troll mends the wound.' },
  oil_silver: { kind: 'oil', name: 'Silver Wash',  stack: true, value: 30, sprite: 'oil_silver', coat: 'silver', desc: 'Coats your weapon: its next 20 blows that land deal 1d6 more to the undead.' },
  oil_venom:  { kind: 'oil', name: 'Blade Venom',  stack: true, value: 30, sprite: 'oil_venom',  coat: 'venom',  desc: 'Coats your weapon: for its next 20 blows that land, one in three poisons the living.' },
  scroll_uncurse:  { kind: 'scroll', name: 'Scroll of Remove Curse', stack: true, value: 40, sprite: 'scroll', effect: 'uncurse', desc: 'Breaks any curse on what you wear, and shows the true quality of all your gear.' },
  // Rings and amulets: anyone may wear two rings and an amulet. Found ones
  // are known only by their look until worn or studied (see RING_LOOKS), and
  // keep their quality to themselves like any found gear. power is the
  // RELIC_POWERS entry each one gives; bonus, where it has one, is how much
  // (the piece's enchantment adds to it, and a cursed one takes from it).
  ring_protect: { kind: 'ring', name: 'Ring of Protection',   value: 90,  sprite: 'ring_silver', power: 'protect', bonus: 1, tier: 2, desc: 'Armour class +1, more if finely made.' },
  ring_might:   { kind: 'ring', name: 'Ring of Might',        value: 110, sprite: 'ring_gold',   power: 'might', bonus: 1, tier: 3, desc: '+1 to hit and to damage with every blow, more if finely made.' },
  ring_evasion: { kind: 'ring', name: 'Ring of Evasion',      value: 90,  sprite: 'ring_jade',   power: 'evasion', bonus: 2, tier: 2, desc: '+2 to every saving throw: venom, traps, and the tricks that land.' },
  ring_seer:    { kind: 'ring', name: 'Ring of the Seer',     value: 60,  sprite: 'ring_bone',   power: 'seer', bonus: 6, tier: 2, desc: '+6 to spot a trap before it springs, and the Seer sees hidden doors as you pass.' },
  ring_mend:    { kind: 'ring', name: 'Ring of Regeneration', value: 140, sprite: 'ring_garnet', power: 'mend', tier: 3, desc: 'Heals a hit point every four seconds, even mid-fight.' },
  ring_quiet:   { kind: 'ring', name: 'Ring of Stealth',      value: 70,  sprite: 'ring_iron',   power: 'quiet', tier: 2, desc: 'Sleeping monsters notice you a square later.' },
  ring_warmth:  { kind: 'ring', name: 'Ring of Warmth',       value: 90,  sprite: 'ring_copper', power: 'warmth', tier: 3, desc: 'Cold does half as much to you: a wraith\'s touch, the lich\'s grave-cold and its storm.' },
  amulet_life:  { kind: 'amulet', name: 'Amulet of Life Saving', value: 260, sprite: 'amulet_amber', power: 'lifesave', tier: 4, desc: 'The blow that would kill you does not: you are left standing at half your life, and the amulet crumbles to dust.' },
  amulet_ward:  { kind: 'amulet', name: 'Amulet of Warding',  value: 150, sprite: 'amulet_silver', power: ['ward', 'pure'], tier: 3, desc: 'Your life force cannot be drained, and poison cannot take hold of you.' },
  amulet_mind:  { kind: 'amulet', name: 'Amulet of Wizardry', value: 150, sprite: 'amulet_obsidian', power: 'mind', tier: 3, desc: '+6 spell points for anyone who has spells to spend them on.' },
  // food
  ration: { kind: 'food', name: 'Iron Ration', stack: true, value: 3, sprite: 'ration', food: 45 },
  meat:   { kind: 'food', name: 'Dried Meat',  stack: true, value: 2, sprite: 'meat',   food: 30 },
  bread:  { kind: 'food', name: 'Stale Bread', stack: true, value: 1, sprite: 'bread',  food: 18 },
  // grown only on an overgrown floor, never dealt as loot
  caps:   { kind: 'food', name: 'Pale Caps',   stack: true, value: 1, sprite: 'caps',   food: 22 },
  // special
  key:      { kind: 'key', name: 'Key', sprite: 'key', value: 0, desc: 'Opens one locked door of matching colour on this floor.' },
  page:     { kind: 'page', name: 'Torn Page', sprite: 'page', value: 0, desc: 'Something one of the earlier crews left behind.' },
  gold:     { kind: 'gold', name: 'Gold', sprite: 'gold' },
  gem:      { kind: 'gem', name: 'Gem', sprite: 'gem' },
  artifact: { kind: 'artifact', name: 'The Heart of the Mountain', sprite: 'artifact', desc: 'The treasure you came for. Its light is warm in your hands.' },
};

const KEY_COLORS = { brass: '#c9a24a', silver: '#cfd8e0', gold: '#ffd34a', iron: '#7a7f88', bone: '#e8e0c8' };
const GEMS = [['Garnet', 20], ['Amethyst', 35], ['Topaz', 50], ['Emerald', 90], ['Sapphire', 120], ['Ruby', 150], ['Diamond', 250]];

const TRAP_TYPES = {
  dart:   { name: 'dart trap',    msg: 'A dart shoots from the wall!',          dmg: [1, 6, 0] },
  needle: { name: 'poison needle', msg: 'A poisoned needle pricks your foot!',   dmg: [1, 3, 0], poison: true },
  pit:    { name: 'pit trap',     msg: 'The floor gives way and you tumble into a pit!', dmg: [2, 6, 0] },
  alarm:  { name: 'alarm',        msg: 'A gong sounds! Something stirs in the dark.', dmg: null, alarm: true },
};

// Monsters: hp = [dice, sides, bonus]; tier = [minDepth, maxDepth]; speed = ms per action
const MONSTERS = {
  rat:      { name: 'Giant Rat',   hp: [1, 6, 1],    ac: 11, hit: 1,  dmg: [1, 3, 0], speed: 900,  xp: 8,    tier: [1, 3],   sprite: 'rat', lunge: 1,      scale: 0.6, door: 'batter' },
  bat:      { name: 'Cave Bat',    hp: [1, 4, 1],    ac: 13, hit: 1,  dmg: [1, 2, 0], speed: 600,  xp: 6,    tier: [1, 3],   sprite: 'bat',      scale: 0.5, fly: 0.45, door: 'batter' },
  slime:    { name: 'Green Slime', hp: [2, 6, 2],    ac: 9,  hit: 0,  dmg: [1, 4, 1], speed: 1500, xp: 12,   tier: [1, 4],   sprite: 'slime',    scale: 0.7, move: 'split', door: 'batter' },
  spider:   { name: 'Cave Spider', hp: [2, 6, 0],    ac: 13, hit: 2,  dmg: [1, 4, 0], speed: 800,  xp: 18,   tier: [1, 5],   sprite: 'spider',   scale: 0.7, poison: 0.3, move: 'web', door: 'batter' },
  goblin:   { name: 'Goblin',      hp: [2, 8, 0],    ac: 13, hit: 2,  dmg: [1, 6, 0], speed: 1000, xp: 20,   tier: [1, 5],   sprite: 'goblin', cunning: 1,   scale: 0.75 },
  skeleton: { name: 'Skeleton',    hp: [3, 8, 0],    ac: 14, hit: 3,  dmg: [1, 6, 1], speed: 1100, xp: 35,   tier: [3, 7],   sprite: 'skeleton', scale: 0.9, undead: true, move: 'rise' },
  zombie:   { name: 'Zombie',      hp: [4, 8, 2],    ac: 11, hit: 3,  dmg: [1, 8, 0], speed: 1600, xp: 40,   tier: [2, 7],   sprite: 'zombie',   scale: 0.9, undead: true, move: 'grab', door: 'batter' },
  orc:      { name: 'Orc',         hp: [4, 8, 0],    ac: 14, hit: 4,  dmg: [1, 8, 1], speed: 1000, xp: 55,   tier: [4, 8],   sprite: 'orc', cunning: 1,      scale: 0.95, move: 'charge' },
  ghoul:    { name: 'Ghoul',       hp: [5, 8, 0],    ac: 14, hit: 5,  dmg: [1, 6, 2], speed: 900,  xp: 80,   tier: [4, 10],  sprite: 'ghoul', lunge: 1,    scale: 0.9, undead: true, move: 'paralyse' },
  wraith:   { name: 'Wraith',      hp: [6, 8, 0],    ac: 16, hit: 6,  dmg: [1, 8, 2], speed: 900,  xp: 130,  tier: [6, 12],  sprite: 'wraith', lunge: 1,   scale: 0.95, undead: true, fly: 0.2, element: 'cold' },
  ogre:     { name: 'Ogre',        hp: [7, 10, 4],   ac: 15, hit: 7,  dmg: [2, 6, 2], speed: 1400, xp: 180,  tier: [8, 13],  sprite: 'ogre',     scale: 1.3, move: 'crush', door: 'smash' },
  troll:    { name: 'Troll',       hp: [8, 10, 6],   ac: 16, hit: 8,  dmg: [2, 8, 2], speed: 1200, xp: 260,  tier: [8, 30],  sprite: 'troll',    scale: 1.3, regen: 1, door: 'smash' },
  minotaur: { name: 'Minotaur',    hp: [10, 10, 10], ac: 17, hit: 10, dmg: [3, 6, 3], speed: 1000, xp: 400,  tier: [10, 30], sprite: 'minotaur', scale: 1.35, move: 'charge', door: 'smash' },
  archer:   { name: 'Goblin Archer', hp: [2, 8, 0],  ac: 13, hit: 3,  dmg: [1, 4, 0], speed: 1100, xp: 30,   tier: [2, 6],   sprite: 'archer',   scale: 0.75, ranged: { range: 4, dmg: [1, 6, 0], verb: 'shoots an arrow at' } },
  basilisk: { name: 'Basilisk',    hp: [6, 10, 0],   ac: 15, hit: 5,  dmg: [1, 6, 2], speed: 1100, xp: 150,  tier: [5, 12],  sprite: 'basilisk', scale: 1.15, move: 'gaze', door: 'batter' },
  rustmaw:  { name: 'Rustmaw',     hp: [4, 10, 2],   ac: 15, hit: 5,  dmg: [1, 6, 2], speed: 1000, xp: 120,  tier: [4, 11],  sprite: 'rustmaw',  scale: 1.08, move: 'rust', door: 'batter' },
  acolyte:  { name: 'Dark Acolyte',  hp: [5, 8, 0],  ac: 14, hit: 6,  dmg: [1, 6, 0], speed: 1200, xp: 110,  tier: [5, 11],  sprite: 'acolyte',  scale: 0.95, move: 'mend', ranged: { range: 5, dmg: [2, 6, 0], verb: 'hurls a bolt of shadow at' } },
  // The deep floors' own: each asks for something other than a step back.
  // A hound that comes back into the world behind you (turn and face it), a
  // beast whose quills punish the blow struck while they stand (hold it), and
  // a wyrm whose fire runs down a passage but not under its jaws (close in).
  hound:    { name: 'Blink Hound', hp: [5, 8, 2],    ac: 15, hit: 6,  dmg: [1, 8, 1], speed: 850,  xp: 140,  tier: [6, 12],  sprite: 'hound',    scale: 0.9, move: 'blink', door: 'batter' },
  quillback: { name: 'Quillback',  hp: [7, 10, 2],   ac: 16, hit: 6,  dmg: [1, 8, 2], speed: 1200, xp: 170,  tier: [7, 13],  sprite: 'quillback', scale: 1.05, move: 'bristle', door: 'batter' },
  // (its tier starts just short of an eight-floor delve's seventh floor, 8.47 on
  // the ladder, so that floor now and then holds one: `shy` thins it to a third
  // of its weight above the ladder's ninth rung, where the Long Delve meets it)
  wyrm:     { name: 'Cave Wyrm',   hp: [9, 10, 6],   ac: 16, hit: 8,  dmg: [2, 6, 3], speed: 1150, xp: 300,  tier: [8.4, 30],  sprite: 'wyrm',     scale: 1.3, move: 'breath', door: 'smash', shy: 9 },
  lich:     { name: 'Dread Lich',  hp: [12, 10, 20], ac: 16, hit: 9,  dmg: [2, 6, 1], speed: 1100, xp: 1500, tier: [99, 99], sprite: 'lich', reach: 2,     scale: 1.2, undead: true, boss: true, drain: true, move: 'nova',
    // the fight turns as it weakens: at two thirds it steps back behind its
    // guards and throws grave-cold from afar; at one third it puts out the
    // torches, quickens, and tries to drink the Heart's light to mend itself
    phases: [
      { ranged: { range: 5, dmg: [2, 6, 2], verb: 'hurls a bolt of grave-cold at', element: 'cold' } },
      { ranged: { range: 5, dmg: [2, 6, 2], verb: 'hurls a bolt of grave-cold at', element: 'cold' }, speed: 850 },
    ] },
  // The Warrens' own last fight, down that road in place of the lich: the
  // warlord of every goblin in the deep, who has dragged the Heart into his
  // hall. He beats a war-drum for his warband; at two thirds he takes to his
  // throne of plunder behind two shield-bearers and throws spears from it; at
  // one third he kicks open his war-chest and fights in a frenzy. (The same
  // count of hit dice as the lich: the floor's other dice fall as they did.)
  warlord:  { name: 'Goblin Warlord', hp: [12, 9, 12], ac: 16, hit: 9, dmg: [2, 6, 1], speed: 1100, xp: 1500, tier: [99, 99], sprite: 'warlord', scale: 1.3, boss: true, move: 'drum', cunning: 1,
    phases: [
      { ranged: { range: 5, dmg: [2, 6, 0], verb: 'hurls a spear from his throne at' } },
      { speed: 900 },
    ] },
  // A hero who died on this device in an earlier run, risen over their bones
  // (Progress.fallen). Its numbers here are only a floor: each one is made to
  // the floor it haunts and fights as its class did (mstat in game.js).
  shade:    { name: 'Shade',       hp: [1, 1, 0],    ac: 13, hit: 2,  dmg: [1, 6, 1], speed: 1000, xp: 60,   tier: [99, 99], sprite: 'shade', scale: 1.0, undead: true, fly: 0.12, shade: true },
  // Named champions: one holds a floor about a third of the way down, another
  // two thirds (Dungeon.namedPlan). Each is one of the kinds above grown
  // great, wearing that kind's picture washed in its own colour, with that
  // kind's trick sharpened. `name` is what the log calls it ("the Goblin
  // King swings"); `named.called` is who it is. tier is the stretch of the
  // monster ladder where it can hold a floor; it is never met at random.
  grisk:    { name: 'Goblin King',   hp: [4, 8, 4],    ac: 14, hit: 3,  dmg: [1, 6, 2], speed: 1000, xp: 90,   tier: [2, 5],   sprite: 'goblin', cunning: 1,   scale: 1.0,  move: 'rally',
    named: { called: 'Grisk', kin: 'goblin', tint: '#ffc030', guard: ['goblin', 1], call: ['goblin', 2],
      arrive: 'Somewhere on this floor, Grisk the Goblin King holds court.',
      wake: 'A goblin in a crown of bent spoons climbs off his heap of plunder. "Who comes before Grisk?"',
      fall: 'Grisk the Goblin King is dead, and his crown rolls away across the floor!' } },
  vessra:   { name: 'Web-Mother',    hp: [4, 8, 2],    ac: 14, hit: 3,  dmg: [1, 6, 1], speed: 850,  xp: 90,   tier: [2, 6],   sprite: 'spider',   scale: 1.0,  poison: 0.3, move: 'web', door: 'batter',
    named: { called: 'Vessra', kin: 'spider', tint: '#40e0c0', often: 2,
      arrive: 'Somewhere on this floor, Vessra the Web-Mother waits at the heart of her web.',
      wake: 'Something vast unfolds its legs in the dark. The Web-Mother has felt you on her threads.',
      fall: 'Vessra the Web-Mother is dead! She curls up, and her threads go slack all through the floor.' } },
  ushgar:   { name: 'Orc Warchief',  hp: [5, 8, 4],    ac: 15, hit: 4,  dmg: [1, 8, 1], speed: 1000, xp: 130,  tier: [3, 7],   sprite: 'orc', cunning: 1,      scale: 1.2,  move: 'charge',
    named: { called: 'Ushgar', kin: 'orc', tint: '#ff4838', guard: ['goblin', 1], often: 2,
      arrive: 'War drums, somewhere on this floor: Ushgar the Orc Warchief is mustering.',
      wake: 'Ushgar the Orc Warchief bellows a challenge and paws the ground.',
      fall: 'Ushgar the Orc Warchief is dead, and the war drums fall silent!' } },
  morrow:   { name: 'Ghoul Lord',    hp: [10, 8, 8],   ac: 15, hit: 7,  dmg: [1, 8, 3], speed: 900,  xp: 240,  tier: [5, 11],  sprite: 'ghoul', lunge: 1,    scale: 1.15, undead: true, move: 'paralyse',
    named: { called: 'Morrow', kin: 'ghoul', tint: '#a0ff50', guard: ['zombie', 1], often: 2,
      arrive: 'The stink of an old feast drifts up the stair. Morrow the Ghoul Lord is at table somewhere on this floor.',
      wake: 'Morrow the Ghoul Lord lifts its head from its meal and smiles, with far too many teeth.',
      fall: 'Morrow the Ghoul Lord is destroyed, and its long feast is over!' } },
  orla:     { name: 'Hollow Abbess', hp: [10, 8, 10],  ac: 16, hit: 8,  dmg: [1, 8, 3], speed: 900,  xp: 280,  tier: [6, 12],  sprite: 'wraith', lunge: 1,   scale: 1.2,  undead: true, fly: 0.2, element: 'cold', move: 'drink',
    named: { called: 'Orla', kin: 'wraith', tint: '#8fb0ff', guard: ['skeleton', 2],
      arrive: 'A cold hymn carries through the stone. Orla the Hollow Abbess keeps her vigil somewhere on this floor.',
      wake: 'The hymn stops. Orla the Hollow Abbess turns her empty hood toward you.',
      fall: 'Orla the Hollow Abbess is destroyed! She comes apart like mist in the sun, and the hymn ends.' } },
  gorrum:   { name: 'Troll-Father',  hp: [10, 10, 10], ac: 16, hit: 9,  dmg: [2, 8, 2], speed: 1200, xp: 500,  tier: [8, 30],  sprite: 'troll',    scale: 1.6,  regen: 2, door: 'smash',
    named: { called: 'Gorrum', kin: 'troll', tint: '#d0a060',
      arrive: 'The floor shakes with slow footsteps. Gorrum the Troll-Father walks this floor.',
      wake: 'Gorrum the Troll-Father smells you, and lumbers toward the scent.',
      fall: 'Gorrum the Troll-Father is dead! He topples like a felled oak, and this time nothing grows back.' } },
  skarrow:  { name: 'Elder Wyrm',    hp: [12, 10, 12], ac: 17, hit: 9,  dmg: [2, 8, 3], speed: 1100, xp: 600,  tier: [9, 30],  sprite: 'wyrm',     scale: 1.55, move: 'breath', door: 'smash',
    // (the Elder Wyrm lairs beneath both roads: each lists her among its champions)
    named: { called: 'Skarrow', kin: 'wyrm', tint: '#ffb040', guard: ['hound', 1], often: 2, pron: 'her',
      arrive: 'The air on the stair is hot and smells of cinders. Skarrow the Elder Wyrm lairs somewhere on this floor.',
      wake: 'Coals stir in the dark, and open, and are eyes. Skarrow the Elder Wyrm uncoils from her hoard.',
      fall: 'Skarrow the Elder Wyrm is dead! The fire in her throat gutters out, and her hoard goes dark.' } },
};

// Spells: circles 1-3 come at hero levels 1, 3 and 5, the fifth circle at 7 (spellLevel in game.js). dmg/heal are functions of caster level.
const SPELLS = {
  mage: [
    { id: 'magic_missile', name: 'Magic Missile',  lvl: 1, cost: 2,  kind: 'bolt', range: 5, dmg: L => [1 + Math.floor((L - 1) / 3), 4, 1], color: '#8cf', desc: 'Unerring darts of force strike the first foe ahead.' },
    { id: 'burning_hands', name: 'Burning Hands',  lvl: 1, cost: 3,  kind: 'bolt', range: 1, dmg: L => [2, 4, L], area: true, fire: true, color: '#f84', desc: 'A fan of flame scorches everything in the square in front of you.' },
    { id: 'shield',        name: 'Shield',         lvl: 1, cost: 3,  kind: 'buff', stat: 'ac', amount: 4, dur: 60000, color: '#adf', desc: '+4 armour class for a minute. Bolts of magic break on it, and it takes half of any storm.' },
    { id: 'lightning',     name: 'Lightning Bolt', lvl: 3, cost: 5,  kind: 'bolt', range: 6, dmg: L => [3, 6, L], pierce: true, element: 'lightning', color: '#ff8', desc: 'A bolt that tears through every foe in its path.' },
    { id: 'cone_cold',     name: 'Cone of Cold',   lvl: 5, cost: 10, kind: 'bolt', range: 3, dmg: L => [5, 6, L], pierce: true, element: 'cold', color: '#8ef', desc: 'A freezing blast down the corridor ahead, catching every foe in it.' },
  ],
  cleric: [
    { id: 'cure_light',   name: 'Cure Light Wounds',   lvl: 1, cost: 2,  kind: 'heal', heal: L => [1, 8, L], color: '#8f8', desc: 'Heals 1d8 + your level in hit points.' },
    { id: 'bless',        name: 'Bless',               lvl: 1, cost: 2,  kind: 'buff', stat: 'hit', amount: 2, dur: 60000, color: '#ff8', desc: '+2 to hit for a minute.' },
    { id: 'smite',        name: 'Holy Smite',          lvl: 2, cost: 4,  kind: 'bolt', range: 3, dmg: L => [1, 6, Math.floor(L / 2)], holy: true, color: '#ffd', desc: 'Radiant strike. Double damage to the undead.' },
    { id: 'cure_serious', name: 'Cure Serious Wounds', lvl: 3, cost: 5,  kind: 'heal', heal: L => [2, 8, L], color: '#8f8', desc: 'Heals 2d8 + your level in hit points.' },
    { id: 'protection',   name: 'Protection',          lvl: 3, cost: 5,  kind: 'buff', stat: 'ac', amount: 2, dur: 90000, color: '#adf', desc: '+2 armour class for a minute and a half.' },
    { id: 'flame_strike', name: 'Flame Strike',        lvl: 5, cost: 10, kind: 'bolt', range: 4, dmg: L => [6, 6, L], area: true, fire: true, color: '#f84', desc: 'A pillar of holy fire consumes everything in the square ahead.' },
  ],
  // a druid's: the bear is a spell like the others, and any other spell lets it go
  druid: [
    { id: 'thorn_lash',     name: 'Thorn Lash',     lvl: 1, cost: 2, kind: 'bolt', range: 4, dmg: L => [1, 6, 1 + Math.floor(L / 3)], color: '#8c4', desc: 'A whip of thorns lashes the first foe within four squares.' },
    { id: 'wild_shape',     name: 'Wild Shape',     lvl: 1, cost: 5, kind: 'shape', color: '#c95', desc: 'Become a bear for forty seconds: claws for your blows, 2 better armour class, and a hide that takes the blows before you do. Casting any other spell lets the bear go.' },
    { id: 'mending_moss',   name: 'Mending Moss',   lvl: 2, cost: 3, kind: 'heal', heal: L => [1, 8, L], color: '#8f8', desc: 'Heals 1d8 + your level in hit points, and your companion as much.' },
    { id: 'entangle',       name: 'Entangle',       lvl: 3, cost: 3, kind: 'root', range: 4, color: '#6b3', desc: 'Roots burst from the stone and hold the first foe within four squares for three seconds, the blow it was drawing back broken off.' },
    { id: 'call_lightning', name: 'Call Lightning', lvl: 3, cost: 5, kind: 'bolt', range: 5, dmg: L => [3, 8, Math.floor(L / 2)], element: 'lightning', color: '#ff8', desc: 'Lightning falls on the first foe within five squares.' },
    { id: 'insect_plague',  name: 'Insect Plague',  lvl: 5, cost: 9, kind: 'bolt', range: 3, dmg: L => [4, 6, L], pierce: true, color: '#cb6', desc: 'A stinging swarm fills the corridor ahead, and every foe in it within three squares.' },
  ],
};

// Unidentified item appearances. A seeded shuffle maps each potion/scroll type to
// one of these, so "a cloudy potion" means something different in every dungeon.
const POTION_LOOKS = [
  ['cloudy', 'potion_red'], ['fizzy', 'potion_pink'], ['murky', 'potion_green'],
  ['golden', 'potion_orange'], ['silvery', 'potion_blue'], ['oily', 'potion_red'],
  ['glowing', 'potion_pink'], ['dark', 'potion_green'],
];
// What an unknown ring or amulet looks like: [adjective, sprite]. Each run
// deals them out afresh, so a jade ring is not always the same ring.
const RING_LOOKS = [
  ['silver', 'ring_silver'], ['gold', 'ring_gold'], ['jade', 'ring_jade'], ['bone', 'ring_bone'],
  ['garnet', 'ring_garnet'], ['iron', 'ring_iron'], ['onyx', 'ring_onyx'], ['copper', 'ring_copper'],
];
const AMULET_LOOKS = [['amber', 'amulet_amber'], ['silver', 'amulet_silver'], ['obsidian', 'amulet_obsidian'], ['bone', 'amulet_bone']];
const SCROLL_LOOKS = [
  'crumbling', 'crisp', 'singed', 'blood-stained', 'gilt-edged', 'water-damaged', 'tightly rolled',
];

// What each kind takes from fire, cold and lightning: more than a blow's worth
// where it is weak, half where it resists. A named champion takes after its
// kin (MONSTERS[id].named.kin). The undead take holy fire double already
// (see the spells), so holy is not here. Things of rot and web burn; things
// already dead feel no cold; metal in the belly draws the lightning.
const ELEMENTS_TAKEN = {
  slime:    { fire: 1.5, lightning: 0.5 },
  spider:   { fire: 1.5 },
  zombie:   { fire: 1.5 },
  troll:    { fire: 1.5 },
  basilisk: { cold: 1.5, fire: 0.5 },
  rustmaw:  { lightning: 1.5 },
  quillback: { fire: 1.5 },
  wyrm:     { fire: 0.5, cold: 1.5 },
  bat:      { lightning: 1.5 },
  skeleton: { cold: 0.5 },
  ghoul:    { cold: 0.5 },
  wraith:   { cold: 0.5 },
  lich:     { cold: 0.5 },
};

// Elite monster prefixes: a champion is stronger, worth more, and always drops loot.
// The bestiary: what the hero learns about each kind of monster by meeting
// it. The lore is there from the first meeting; the trick once it has been
// seen (or after a few kills), and the answer once the hero has beaten it.
const BESTIARY = {
  rat:      { lore: 'Big as a dog and never alone for long. From the second floor down they come in twos and threes, and the square is clear only when the last one drops. A rat pounces after whoever backs away from its bite: step aside, not back.' },
  bat:      { lore: 'Quick, weak and hard to hit, it flutters above your blade. It bites fast, so its warning is short: watch for the mark and step back early.' },
  slime:    { lore: 'A slow heap of green that eats whatever it rolls over, bones included.',
    trick: 'Struck hard, it splits into two smaller slimes sharing its square.',
    answer: 'Fire, or anything that fills the square, burns both halves at once. Split slimes do not split again.' },
  spider:   { lore: 'Its bite is venomous. It prefers to hang back in a corridor and let its web do the work.',
    trick: 'Spits a web down a straight line from a few squares off. Webbed, you cannot step away, though you can still fight and turn.',
    answer: 'Step out of its line while it rears back. Caught, keep pushing: every push tears at the web, and fire burns it away at once.' },
  goblin:   { lore: 'Small, mean and brave in numbers. Goblins go about in groups and swing together in a quick volley, and never draw back the same way twice: one blow comes quick, the next slow.' },
  skeleton: { lore: 'Bones held together by something that will not let them rest. Undead: holy magic burns it twice as badly.',
    trick: 'Cut down by an edge, it falls into a heap of bones and pulls itself back together a few seconds later.',
    answer: 'Smash the heap before it rises: any blow shatters it. A mace, hammer, flail, club, staff or spell breaks the bones for good the first time.' },
  zombie:   { lore: 'Slow and stupid, and stronger than it looks. Undead: holy magic burns it twice as badly.',
    trick: 'Every other blow it lurches forward to seize you. Held, you cannot step away from it.',
    answer: 'Step back while it lurches and it grabs the air. Caught, keep stepping away: strength tears you free, and killing it lets go at once.' },
  orc:      { lore: 'A trained soldier, heavier and surer than a goblin. It likes a long straight corridor, and it varies its swing: watch the blow, not the beat.',
    trick: 'Lowers its head and charges down a straight line, slamming into you harder than any blow.',
    answer: 'Sidestep out of the line while it lowers its head: it thunders past and stumbles, wide open. Or shut a door across its line, and it slams into the door instead.' },
  ghoul:    { lore: 'It eats the dead and would like you to be one. Its plain blows lunge after a hero who backs away; a step to the side leaves it biting air. Undead: holy magic burns it twice as badly.',
    trick: 'Every third blow it reaches out with a numbing claw. If it lands, you are frozen for a moment: no step, swing or spell.',
    answer: 'Step back while it reaches and the claw closes on air, or land a blow first and knock the claw aside. If it catches you, a hardy constitution may shake the numbness off.' },
  wraith:   { lore: 'A cold shape that drifts above the floor, hard to land a blow on. Its touch is the grave\'s own cold, and a Ring of Warmth takes half of it. It drifts after a hero who backs away and strikes anyway: slip aside instead. Undead: holy magic burns it twice as badly.' },
  ogre:     { lore: 'Huge, slow and very strong. Its club hits like a falling wall.',
    trick: 'Every third swing it heaves its club high for a crushing blow at three times the damage, and armour will not turn it.',
    answer: 'Step back while it heaves. The club smashes the floor and it staggers, wide open.' },
  troll:    { lore: 'Long-armed and hungry, and very hard to kill: its wounds close as you watch.',
    trick: 'No trick to see: its nature. It grows back a hit point every second, so a slow fight goes nowhere.',
    answer: 'Fire. Burns do not close: Burning Hands, Flame Strike or a Scroll of Fire stops it regrowing for a while.' },
  minotaur: { lore: 'The master of the deep halls, bull-headed and tireless. It hits harder than anything but the lich.',
    trick: 'Charges down a straight line from four squares off and slams into you.',
    answer: 'Sidestep out of the line: it thunders past and stumbles, wide open. A door shut across its line stops it cold.' },
  archer:   { lore: 'A goblin with a bow, shooting from four squares away down a straight line. It draws before it looses.' },
  basilisk: { lore: 'A heavy, many-legged lizard of the lower halls. Whatever meets its eyes when they flare is stone for a while.',
    trick: 'It rears its head and its eyes blaze: a gaze that turns whoever is looking at it to stone for a moment, and cracks the skin as it goes.',
    answer: 'Turn away while its eyes blaze. The gaze washes over your back, and the beast is left open.' },
  rustmaw:  { lore: 'A burrowing beetle the size of a dog. It eats metal, and leaves rust in its tracks.',
    trick: 'Every third bite it rears back to lunge. If the bite lands it rusts your armour, or your shield or blade, a point for good.',
    answer: 'Step back while it rears: its jaws snap on air and it is left open. The trader\'s forge can mend what it has eaten.' },
  acolyte:  { lore: 'A servant of the dark who hurls bolts of shadow from five squares off.',
    trick: 'Chants for nearly two seconds to mend a badly wounded monster nearby, itself included.',
    answer: 'Any blow, arrow or spell that hurts it breaks the chant: close in fast, or shoot. Kill the acolyte first.' },
  hound:    { lore: 'A lean grey hound of the deep, all ribs and pale eyes. It hunts by stepping out of the world and back into it wherever its prey is not looking.',
    trick: 'It flickers out of the air and steps back in at your back, and bites deep from behind.',
    answer: 'Turn round to face it as it comes back: it steps out onto your blade, caught off balance and open.' },
  quillback: { lore: 'A squat, heavy beast with a mantle of long dark quills and a temper to match. Its quills burn.',
    trick: 'Its quills rattle up on end, and any blow struck at it from beside it drives into them and bites back.',
    answer: 'Hold your blow while the quills stand. When they sink flat it is left open. An arrow or a spell from further off does not touch them.' },
  wyrm:     { lore: 'A young drake of the deepest halls, wingless and heavy, scaled like rusted iron. Fire does little to it; cold bites.',
    trick: 'It rears back and breathes a gout of fire down the passage, from two squares out to five.',
    answer: 'Close in under its jaws: the fire roars out over your head. Or step out of its line. Stepping back only keeps you in it.' },
  shade:    { lore: 'One of your own, who fell in an earlier delve and did not stay down. It keeps the floor where it died, over the bones and the gear it died in, and it fights the way it did in life: a fighter\'s shade charges, a mage\'s throws cold fire, a cleric\'s mends itself, a thief\'s is quick and follows a step back, a ranger\'s shoots. Undead: holy magic burns it twice as badly. Lay it to rest and its gear is yours.' },
  warlord:  { lore: 'Grisk was only his sister\'s boy. The Warlord of the Warrens wears a crown of hammered gold, beats a war-drum that every goblin in the deep comes running to, and has dragged the Heart into his own hall. Break the beat by striking him; cut down his shield-bearers and he must leave his throne; and when he kicks open his war-chest, keep your head.',
    trick: 'He raises his war-drum to call a warband; strike him before the beat. At two thirds he takes to his throne behind two shield-bearers, who turn every blow meant for him, and throws spears; at one third he fights in a frenzy.',
    answer: 'Strike him while the drumstick is raised and the call dies. Kill the shield-bearers and he must come down from his throne; a spell flies over their heads and finds him there, and his spears break on a mage\'s Shield.' },
  lich:     { lore: 'The dread thing that keeps the Heart of the Mountain. Its touch drains life and reaches two squares down a straight line, so one step back is not enough: step aside. It does not flee.',
    trick: 'Gathers a storm of cold fire that bursts two squares around it. At two thirds it raises guards and steps back behind them to throw grave-cold; at one third it puts out its torches and tries to drink the Heart\'s light to mend itself.',
    answer: 'When it gathers the storm, get three squares away. Close on it through its guards, and when it begins its rite, strike it: any wound breaks the rite. A mage\'s spell pulls its shadow apart, and its grave-cold breaks on a mage\'s Shield.' },
  // the named champions: each is met once a run at most, so its trick is
  // written down when seen and its answer when it is beaten or dies
  grisk:    { lore: 'Grisk crowned himself with bent spoons and a bucket, and no goblin on his floor has dared to laugh. He fights like one of them, only bigger, and he never fights alone for long.',
    trick: 'Hurt past half, he puts a war-horn to his lips to call his kin. He tries twice.',
    answer: 'Strike him while he fills his lungs: any wound cuts the call short, and a call cut short is spent.' },
  vessra:   { lore: 'The mother of every spider in the upper halls, as broad as a cart. Her whole floor is her web, and she feels every step taken on it.',
    trick: 'Spits her web twice as often as her brood, and from right beside you as well as down a corridor.',
    answer: 'Step out of her line while she rears back, every time. Caught, keep pushing, or burn the web away.' },
  ushgar:   { lore: 'Ushgar holds the middle floors by the simple rule of running over anyone who argues. Goblin runners carry his drums.',
    trick: 'Charges twice as often as any orc, and from four squares off.',
    answer: 'Step out of his line while he lowers his head, and he thunders past, wide open. A door shut across his line stops him cold.' },
  morrow:   { lore: 'The oldest ghoul in the delve, and the fattest. It has been eating the fourth crew for three winters. Undead: holy magic burns it twice as badly.',
    trick: 'Reaches out with its numbing claw every other blow, not every third.',
    answer: 'Step back while it reaches, or land a blow first and knock the claw aside. Mind it closely: the next reach comes quickly.' },
  orla:     { lore: 'She led the valley\'s prayers in the Hollow Chapel before the Heart went out, and she is praying still. Undead: holy magic burns it twice as badly.',
    trick: 'Every third blow she reaches into your chest to drink. If her hand closes, a weak will loses 3 maximum hit points for good, and she is mended by what she takes.',
    answer: 'Step back while she reaches and her hand closes on air, leaving her open. A strong will, or a ward against the grave, keeps what she would take.' },
  skarrow:  { lore: 'The oldest of the deep\'s wyrms, grown too big for the passages she made, sleeping on a hoard of the fourth crew\'s steel. Fire does little to her; cold bites.',
    trick: 'Breathes fire down the passage twice as often as her young, from two squares out to five.',
    answer: 'Close in under her jaws, or step out of her line, every time. Stay close: at a distance she has the better of you.' },
  gorrum:   { lore: 'Father, grandfather and great-grandfather to every troll on the lower floors, and hungrier than all of them together.',
    trick: 'His wounds close twice as fast as any troll\'s: two hit points a second.',
    answer: 'Fire. His burns do not close either: Burning Hands, Flame Strike or a Scroll of Fire stops him regrowing for a while.' },
};

const ELITES = [
  { prefix: 'Feral',    hp: 1.5, hit: 2, dmg: 2, xp: 2.0, speed: 0.8, tint: '#ff6040' },
  { prefix: 'Armoured', hp: 1.6, ac: 3,  hit: 1, xp: 2.0, speed: 1.2, tint: '#80a0ff' },
  { prefix: 'Ancient',  hp: 2.0, hit: 3, dmg: 3, xp: 2.6, speed: 1.0, tint: '#c060ff' },
  { prefix: 'Rabid',    hp: 1.2, hit: 2, dmg: 1, xp: 1.6, speed: 0.6, tint: '#ffd040' },
];

// decor: what a few of each theme's walls are dressed with, drawn in
// assets.js and placed by the renderer. Each suits the flavour line: bones in
// the catacombs, moss in the damp, frost where the wind is cold. A name given
// twice is drawn twice, differently, and turns up twice as often.
const THEMES = [
  { name: 'Grey Halls',       wall: '#6e6e78', mortar: '#34343e', floor: '#3a3630', ceil: '#24222a', accent: '#8a8a70', flavor: 'Cold stone halls stretch into darkness.', decor: ['ring', 'niche', 'lichen', 'seep', 'banner', 'cobweb', 'sconce', 'cobweb'], props: ['barrel', 'crate', 'rubble', 'bones', 'candles'], fog: '#0e0e14' },
  { name: 'Brown Catacombs',  wall: '#7a5a3a', mortar: '#3a2a1a', floor: '#3a2e22', ceil: '#241c14', accent: '#a08050', flavor: 'The air is thick with dust and old bones.', decor: ['skulls', 'ossuary', 'burial', 'roots', 'cobweb', 'sconce', 'cobweb'], props: ['bones', 'urn', 'candles', 'rubble'], fog: '#140e0a' },
  { name: 'Mossy Depths',     wall: '#5a7050', mortar: '#26321f', floor: '#2c3a28', ceil: '#182218', accent: '#7fbf5f', flavor: 'Water drips and moss clings to every stone.', decor: ['moss', 'roots', 'seep', 'moss', 'banner', 'cobweb'], props: ['mushrooms', 'rubble', 'barrel', 'puddle', 'puddle'], fog: '#0a120c' },
  { name: 'Blue Vaults',      wall: '#55627a', mortar: '#242a3a', floor: '#262c36', ceil: '#141824', accent: '#7fa0d0', flavor: 'A chill wind moans through these vaults.', decor: ['rime', 'grate', 'ring', 'banner', 'cobweb', 'sconce'], props: ['crate', 'barrel', 'puddle', 'rubble'], fog: '#0a0e18' },
  { name: 'Crimson Crypts',   wall: '#7a4a4a', mortar: '#3a1e1e', floor: '#36262a', ceil: '#221416', accent: '#c05050', flavor: 'The walls here are stained a rusty red.', decor: ['stain', 'skulls', 'chains', 'banner', 'cobweb', 'sconce'], props: ['bones', 'candles', 'urn'], fog: '#150a0c' },
  // face: how its walls are built, where they are not brick (see makeGlass)
  { name: 'Obsidian Sanctum', final: true, face: 'glass', wall: '#3c3448', mortar: '#12101a', floor: '#1e1a26', ceil: '#0c0a12', accent: '#8060c0', flavor: 'Black glass walls hum with a terrible power.', decor: ['runes', 'vein', 'shrine'], props: ['candles', 'bones'], fog: '#0e0a18' },
  // the roads at the divided stair each have walls of their own (see ROUTES)
  { name: 'The Ossuary', road: 'crypts', face: 'bones', wall: '#8a8272', mortar: '#16120e', floor: '#302c26', ceil: '#14110e', accent: '#7ac0b0', flavor: 'The dead are stacked to the roof here, skull upon skull.', decor: ['niche', 'cobweb', 'sconce', 'cobweb'], props: ['bones', 'candles', 'urn', 'candles'], fog: '#0a1614' },
  { name: 'The Warrens', road: 'warrens', face: 'earth', wall: '#6a5238', mortar: '#2a2016', floor: '#382c20', ceil: '#1c1610', accent: '#d08a40', flavor: 'Rough tunnels, dug by many small hands and propped with timber.', decor: ['roots', 'cobweb', 'sconce', 'banner'], props: ['crate', 'barrel', 'rubble', 'mushrooms', 'bones'], fog: '#161008' },
];

// Pixel art. '.' is transparent; other characters map to palette colours.
const SPRITES = {
  fountain_hint: { pal: { '#': '#8a8a94', 'w': '#4090e0', 's': '#a0c8ff' }, rows: [
    '................',
    '................',
    '.......ss.......',
    '......ssss......',
    '.....swwwws.....',
    '......ssss......',
    '.......ss.......',
    '.......ss.......',
    '...##########...',
    '..#wwwwwwwwww#..',
    '..#wwwwwwwwww#..',
    '..############..',
    '...##########...',
    '....########....',
    '..############..',
    '................',
  ] },
  // items
};

// Items are painted from parts in itemart.js; only the fountain's hint is a grid.

/** Floor dressing that stands against a wall rather than out in a room (see dressing.js). */
const WALL_PROPS = ['barrel', 'crate', 'urn'];

export { WALL_PROPS, ROUTES, FEATS, TWISTS, HERO_NAMES, BG_NAMES, ALL_HERO_NAMES, heroName, PROLOGUE, BACKGROUNDS, JOURNAL, BOONS, armorFits, shieldFits, XP_TABLE, MAX_LEVEL, CLASSES, STAT_NAMES, ITEMS, KEY_COLORS, GEMS, TRAP_TYPES, MONSTERS, SPELLS, THEMES, SPRITES, POTION_LOOKS, SCROLL_LOOKS, RING_LOOKS, AMULET_LOOKS, ELEMENTS_TAKEN, ELITES, BESTIARY, TALENTS, PATHS, PATH_LEVEL, CAPSTONE_LEVEL, VOWS };
