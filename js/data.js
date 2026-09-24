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
  { id: 'str', stat: 'str', max: 2, name: 'Hard Won Strength', desc: 'Your Strength bonus rises by one.', apply: p => { p.stats.str += p.stats.str % 2 ? 1 : 2; } },
  { id: 'dex', stat: 'dex', max: 2, name: 'Sure Footing', desc: 'Your Dexterity bonus rises by one.', apply: p => { p.stats.dex += p.stats.dex % 2 ? 1 : 2; } },
  { id: 'con', stat: 'con', max: 2, name: 'Deep Wind', desc: 'Your Constitution bonus rises by one.', apply: p => { p.stats.con += p.stats.con % 2 ? 1 : 2; } },
  { id: 'int', stat: 'int', max: 2, name: 'Sharpened Wits', desc: 'Your Intelligence bonus rises by one.', apply: p => { p.stats.int += p.stats.int % 2 ? 1 : 2; }, when: p => p.cls === 'mage' || p.cls === 'thief' },
  { id: 'wis', stat: 'wis', max: 2, name: 'Clear Sight', desc: 'Your Wisdom bonus rises by one.', apply: p => { p.stats.wis += p.stats.wis % 2 ? 1 : 2; }, when: p => p.cls === 'cleric' },
  { id: 'vigor', name: 'Old Scars', desc: '+6 maximum hit points, and healed by 6 now.', apply: p => { p.maxHp += 6; p.hp += 6; } },
  { id: 'focus', name: 'Quiet Mind', desc: '+4 maximum spell points.', apply: p => { p.bonusSp = (p.bonusSp || 0) + 4; }, when: p => !!CLASSES[p.cls].spells },
  { id: 'keen', name: 'Killing Eye', desc: '+1 to hit with every blow, for good.', unique: true, apply: p => { p.perkHit = (p.perkHit || 0) + 1; } },
  { id: 'swift', name: 'Practised Hands', desc: 'Every swing comes 8% sooner, for good.', unique: true, apply: p => { p.perkSpeed = (p.perkSpeed || 0) + 0.08; } },
  { id: 'hardy', name: 'Slow to Bleed', desc: 'Between fights, wounds close half again as fast.', unique: true, apply: p => { p.perkRegen = (p.perkRegen || 0) + 0.5; } },
];

// Class talents: on every third level the hero picks one of three from their
// class's six, each taken once. They change how a class plays rather than
// adding a point here and there; game.js honours each by id.
const TALENTS = {
  fighter: [
    { id: 'cleave', name: 'Cleave', desc: 'Strike a group and the one behind the front takes half the blow.' },
    { id: 'riposte', name: 'Riposte', desc: 'A blow that misses you, or swings at the air where you stood, opens a riposte: your next swing within two and a half seconds comes at once, with +4 to hit and +2 damage.' },
    { id: 'stand_firm', name: 'Stand Firm', desc: 'A monster\'s trick that lands does half damage to you: a crush, a charge, a claw, the lich\'s storm. Nothing can grab you.' },
    { id: 'second_wind', name: 'Second Wind', desc: 'Falling below a quarter of your health heals another quarter at once. Once every two minutes.' },
    { id: 'weapon_master', name: 'Weapon Master', desc: '+2 damage with every blow of a two-handed weapon, +1 with any other.' },
    { id: 'bulwark', name: 'Bulwark', desc: 'A shield gives you 2 more armour class.' },
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
  ],
};

const XP_TABLE = [0, 45, 120, 265, 540, 1020, 1800, 3000, 4800, 7400, 11000, 16200, 22800];
const MAX_LEVEL = 12;

const CLASSES = {
  fighter: {
    name: 'Fighter', plural: 'Fighters', hitDie: 10, hitProg: 1, armor: 'heavy', shield: true, dualWield: true, spells: null, primary: 'str',
    desc: 'Master of arms. Most hit points, any weapon or armor, and the only one trained to fight with a blade in each hand.',
    startKit: ['longsword', 'scale', 'shield', 'ration', 'ration', 'potion_heal'],
  },
  cleric: {
    name: 'Cleric', plural: 'Clerics', hitDie: 8, hitProg: 2 / 3, armor: 'heavy', shield: true, castMs: 1000, spMul: 0.8, spells: 'cleric', primary: 'wis',
    desc: 'Armoured priest. Heals, blesses and smites the undead.',
    startKit: ['mace', 'studded', 'buckler', 'ration', 'ration', 'potion_heal'],
  },
  mage: {
    name: 'Mage', plural: 'Mages', hitDie: 5, hitProg: 1 / 3, armor: 'none', shield: false, castMs: 500, spMul: 1.6, spells: 'mage', primary: 'int',
    desc: 'Fragile scholar with deep reserves of power and quick words to spend them.',
    startKit: ['staff', 'dagger', 'ration', 'ration', 'potion_heal', 'potion_heal', 'scroll_fire'],
  },
  thief: {
    name: 'Thief', plural: 'Thieves', hitDie: 8, hitProg: 2 / 3, armor: 'light', shield: false, spells: null, primary: 'dex',
    desc: 'Quick and quiet. Monsters notice a thief late, and a sleeping foe takes a double blow.',
    startKit: ['shortsword', 'throwknife', 'leather', 'ration', 'ration', 'potion_heal', 'scroll_map'],
  },
};

const STAT_NAMES = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };

const ITEMS = {
  // weapons: dmg = [dice, sides, bonus]; speed = attack cooldown in ms
  dagger:     { kind: 'weapon', name: 'Dagger',           dmg: [1, 4, 0],  speed: 400,  cls: ['fighter', 'mage', 'thief'], value: 2,  sprite: 'dagger', tier: 1 },
  club:       { kind: 'weapon', name: 'Club',             dmg: [1, 4, 0],  speed: 500,  cls: ['fighter', 'cleric', 'thief'], value: 1, sprite: 'club', tier: 1, blunt: true },
  staff:      { kind: 'weapon', name: 'Quarterstaff',     dmg: [1, 6, 0],  speed: 600,  cls: ['fighter', 'mage', 'cleric'], twoHanded: true, value: 2, sprite: 'staff', tier: 1, blunt: true },
  shortsword: { kind: 'weapon', name: 'Short Sword',      dmg: [1, 6, 0],  speed: 550,  cls: ['fighter', 'thief'], value: 8, sprite: 'shortsword', tier: 1 },
  mace:       { kind: 'weapon', name: 'Mace',             dmg: [1, 6, 1],  speed: 700,  cls: ['fighter', 'cleric'], value: 8, sprite: 'mace', tier: 1, blunt: true },
  hammer:     { kind: 'weapon', name: 'War Hammer',       dmg: [1, 4, 2],  speed: 650,  cls: ['fighter', 'cleric'], value: 9, sprite: 'hammer', tier: 2, blunt: true },
  spear:      { kind: 'weapon', name: 'Spear',            dmg: [1, 8, 0],  speed: 700,  cls: ['fighter'], value: 6, sprite: 'spear', tier: 2 },
  longsword:  { kind: 'weapon', name: 'Long Sword',       dmg: [1, 8, 0],  speed: 700,  cls: ['fighter', 'thief'], value: 15, sprite: 'longsword', tier: 2 },
  flail:      { kind: 'weapon', name: 'Flail',            dmg: [2, 4, 0],  speed: 800,  cls: ['fighter', 'cleric'], value: 15, sprite: 'flail', tier: 3, blunt: true },
  battleaxe:  { kind: 'weapon', name: 'Battle Axe',       dmg: [1, 8, 1],  speed: 850,  cls: ['fighter'], value: 18, sprite: 'battleaxe', tier: 3 },
  greatsword: { kind: 'weapon', name: 'Two-handed Sword', dmg: [1, 10, 2], speed: 1000, cls: ['fighter'], twoHanded: true, value: 40, sprite: 'greatsword', tier: 4 },
  // thrown and missile arms. Attack reaches down the corridor when one is in hand.
  throwknife: { kind: 'weapon', name: 'Throwing Knives', dmg: [1, 4, 0], speed: 520, range: 4, cls: ['fighter', 'thief', 'mage'], value: 12, sprite: 'throwknife', tier: 1 },
  sling:      { kind: 'weapon', name: 'Sling',           dmg: [1, 4, 1], speed: 800, range: 5, cls: ['fighter', 'thief', 'cleric'], value: 10, sprite: 'sling', tier: 2 },
  shortbow:   { kind: 'weapon', name: 'Short Bow',       dmg: [1, 6, 0], speed: 850, range: 6, cls: ['fighter', 'thief'], twoHanded: true, value: 30, sprite: 'shortbow', tier: 3 },
  // armor
  leather: { kind: 'armor', name: 'Leather Armor',   ac: 2, weight: 'light', value: 10,  sprite: 'leather', tier: 1 },
  studded: { kind: 'armor', name: 'Studded Leather', ac: 3, weight: 'light', value: 20,  sprite: 'studded', tier: 2 },
  scale:   { kind: 'armor', name: 'Scale Mail',      ac: 4, weight: 'heavy', value: 45,  sprite: 'scale', tier: 2 },
  chain:   { kind: 'armor', name: 'Chain Mail',      ac: 5, weight: 'heavy', value: 75,  sprite: 'chain', tier: 3 },
  splint:  { kind: 'armor', name: 'Splint Mail',     ac: 6, weight: 'heavy', value: 120, sprite: 'splint', tier: 4 },
  plate:   { kind: 'armor', name: 'Plate Mail',      ac: 7, weight: 'heavy', value: 300, sprite: 'plate', tier: 5 },
  // shields
  buckler:     { kind: 'shield', name: 'Buckler',      ac: 1, value: 5,  sprite: 'buckler', tier: 1 },
  shield:      { kind: 'shield', name: 'Shield',       ac: 2, value: 12, sprite: 'shield', tier: 2 },
  towershield: { kind: 'shield', name: 'Tower Shield', ac: 3, value: 40, sprite: 'towershield', tier: 4 },
  // potions
  potion_heal:  { kind: 'potion', name: 'Potion of Healing',       stack: true, value: 25, sprite: 'potion_red',    effect: 'heal', heal: [2, 8, 2], desc: 'Restores 2d8+2 hit points.' },
  potion_xheal: { kind: 'potion', name: 'Potion of Extra Healing', stack: true, value: 60, sprite: 'potion_pink',   effect: 'heal', heal: [4, 8, 4], desc: 'Restores 4d8+4 hit points.' },
  potion_cure:  { kind: 'potion', name: 'Antidote',                stack: true, value: 20, sprite: 'potion_green',  effect: 'cure', desc: 'Neutralises poison.' },
  potion_might: { kind: 'potion', name: 'Potion of Might',         stack: true, value: 40, sprite: 'potion_orange', effect: 'might', desc: '+2 to hit and damage for two minutes.' },
  potion_mana:  { kind: 'potion', name: 'Potion of Clarity',       stack: true, value: 40, sprite: 'potion_blue',   effect: 'mana', desc: 'Restores all spell points.' },
  // scrolls (usable by anyone)
  scroll_fire:     { kind: 'scroll', name: 'Scroll of Fire',        stack: true, value: 30, sprite: 'scroll', effect: 'fire', desc: 'Hurls a ball of fire (4d6) at the foe ahead.' },
  scroll_heal:     { kind: 'scroll', name: 'Scroll of Restoration', stack: true, value: 35, sprite: 'scroll', effect: 'heal', heal: [3, 8, 3], desc: 'Restores 3d8+3 hit points.' },
  scroll_map:      { kind: 'scroll', name: 'Scroll of Mapping',     stack: true, value: 30, sprite: 'scroll', effect: 'map', desc: 'Reveals the layout of this level.' },
  scroll_teleport: { kind: 'scroll', name: 'Scroll of Teleport',    stack: true, value: 30, sprite: 'scroll', effect: 'teleport', desc: 'Whisks you to a random spot on this level.' },
  scroll_uncurse:  { kind: 'scroll', name: 'Scroll of Remove Curse', stack: true, value: 40, sprite: 'scroll', effect: 'uncurse', desc: 'Breaks any curse on what you wear, and shows the true quality of all your gear.' },
  // food
  ration: { kind: 'food', name: 'Iron Ration', stack: true, value: 3, sprite: 'ration', food: 45 },
  meat:   { kind: 'food', name: 'Dried Meat',  stack: true, value: 2, sprite: 'meat',   food: 30 },
  bread:  { kind: 'food', name: 'Stale Bread', stack: true, value: 1, sprite: 'bread',  food: 18 },
  // special
  key:      { kind: 'key', name: 'Key', sprite: 'key', value: 0, desc: 'Opens one locked door of matching colour on this level.' },
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
  rat:      { name: 'Giant Rat',   hp: [1, 6, 1],    ac: 11, hit: 1,  dmg: [1, 3, 0], speed: 900,  xp: 8,    tier: [1, 3],   sprite: 'rat',      scale: 0.6 },
  bat:      { name: 'Cave Bat',    hp: [1, 4, 1],    ac: 13, hit: 1,  dmg: [1, 2, 0], speed: 600,  xp: 6,    tier: [1, 3],   sprite: 'bat',      scale: 0.5, fly: 0.45 },
  slime:    { name: 'Green Slime', hp: [2, 6, 2],    ac: 9,  hit: 0,  dmg: [1, 4, 1], speed: 1500, xp: 12,   tier: [1, 4],   sprite: 'slime',    scale: 0.7, move: 'split' },
  spider:   { name: 'Cave Spider', hp: [2, 6, 0],    ac: 13, hit: 2,  dmg: [1, 4, 0], speed: 800,  xp: 18,   tier: [1, 5],   sprite: 'spider',   scale: 0.7, poison: 0.3, move: 'web' },
  goblin:   { name: 'Goblin',      hp: [2, 8, 0],    ac: 13, hit: 2,  dmg: [1, 6, 0], speed: 1000, xp: 20,   tier: [1, 5],   sprite: 'goblin',   scale: 0.75 },
  skeleton: { name: 'Skeleton',    hp: [3, 8, 0],    ac: 14, hit: 3,  dmg: [1, 6, 1], speed: 1100, xp: 35,   tier: [2, 7],   sprite: 'skeleton', scale: 0.9, undead: true, move: 'rise' },
  zombie:   { name: 'Zombie',      hp: [4, 8, 2],    ac: 11, hit: 3,  dmg: [1, 8, 0], speed: 1600, xp: 40,   tier: [2, 7],   sprite: 'zombie',   scale: 0.9, undead: true, move: 'grab' },
  orc:      { name: 'Orc',         hp: [4, 8, 0],    ac: 14, hit: 4,  dmg: [1, 8, 1], speed: 1000, xp: 55,   tier: [3, 8],   sprite: 'orc',      scale: 0.95, move: 'charge' },
  ghoul:    { name: 'Ghoul',       hp: [5, 8, 0],    ac: 14, hit: 5,  dmg: [1, 6, 2], speed: 900,  xp: 80,   tier: [4, 10],  sprite: 'ghoul',    scale: 0.9, undead: true, move: 'paralyse' },
  wraith:   { name: 'Wraith',      hp: [6, 8, 0],    ac: 16, hit: 6,  dmg: [1, 8, 2], speed: 900,  xp: 130,  tier: [6, 12],  sprite: 'wraith',   scale: 0.95, undead: true, fly: 0.2 },
  ogre:     { name: 'Ogre',        hp: [7, 10, 4],   ac: 15, hit: 7,  dmg: [2, 6, 2], speed: 1400, xp: 180,  tier: [6, 13],  sprite: 'ogre',     scale: 1.3, move: 'crush' },
  troll:    { name: 'Troll',       hp: [8, 10, 6],   ac: 16, hit: 8,  dmg: [2, 8, 2], speed: 1200, xp: 260,  tier: [8, 30],  sprite: 'troll',    scale: 1.3, regen: 1 },
  minotaur: { name: 'Minotaur',    hp: [10, 10, 10], ac: 17, hit: 10, dmg: [3, 6, 3], speed: 1000, xp: 400,  tier: [10, 30], sprite: 'minotaur', scale: 1.35, move: 'charge' },
  archer:   { name: 'Goblin Archer', hp: [2, 8, 0],  ac: 13, hit: 3,  dmg: [1, 4, 0], speed: 1100, xp: 30,   tier: [2, 6],   sprite: 'archer',   scale: 0.75, ranged: { range: 4, dmg: [1, 6, 0], verb: 'shoots an arrow at' } },
  acolyte:  { name: 'Dark Acolyte',  hp: [5, 8, 0],  ac: 14, hit: 6,  dmg: [1, 6, 0], speed: 1200, xp: 110,  tier: [5, 11],  sprite: 'acolyte',  scale: 0.95, move: 'mend', ranged: { range: 5, dmg: [2, 6, 0], verb: 'hurls a bolt of shadow at' } },
  lich:     { name: 'Dread Lich',  hp: [12, 10, 20], ac: 16, hit: 9,  dmg: [2, 6, 1], speed: 1100, xp: 1500, tier: [99, 99], sprite: 'lich',     scale: 1.2, undead: true, boss: true, drain: true, move: 'nova',
    // the fight turns as it weakens: at two thirds it steps back behind its
    // guards and throws grave-cold from afar; at one third it puts out the
    // torches, quickens, and tries to drink the Heart's light to mend itself
    phases: [
      { ranged: { range: 5, dmg: [2, 6, 2], verb: 'hurls a bolt of grave-cold at' } },
      { ranged: { range: 5, dmg: [2, 6, 2], verb: 'hurls a bolt of grave-cold at' }, speed: 850 },
    ] },
};

// Spells: available at character level (lvl * 2 - 1). dmg/heal are functions of caster level.
const SPELLS = {
  mage: [
    { id: 'magic_missile', name: 'Magic Missile',  lvl: 1, cost: 2,  kind: 'bolt', range: 5, dmg: L => [1 + Math.floor((L - 1) / 3), 4, 1], color: '#8cf', desc: 'Unerring darts of force strike the first foe ahead.' },
    { id: 'burning_hands', name: 'Burning Hands',  lvl: 1, cost: 3,  kind: 'bolt', range: 1, dmg: L => [2, 4, L], area: true, fire: true, color: '#f84', desc: 'A fan of flame scorches everything in the square in front of you.' },
    { id: 'shield',        name: 'Shield',         lvl: 1, cost: 3,  kind: 'buff', stat: 'ac', amount: 4, dur: 60000, color: '#adf', desc: '+4 armour class for a minute.' },
    { id: 'lightning',     name: 'Lightning Bolt', lvl: 3, cost: 6,  kind: 'bolt', range: 6, dmg: L => [3, 6, L], pierce: true, color: '#ff8', desc: 'A bolt that tears through every foe in its path.' },
    { id: 'cone_cold',     name: 'Cone of Cold',   lvl: 5, cost: 10, kind: 'bolt', range: 3, dmg: L => [5, 6, L], pierce: true, color: '#8ef', desc: 'A freezing blast down the corridor ahead, catching every foe in it.' },
  ],
  cleric: [
    { id: 'cure_light',   name: 'Cure Light Wounds',   lvl: 1, cost: 2,  kind: 'heal', heal: L => [1, 8, Math.floor(L / 2)], color: '#8f8', desc: 'Heals 1d8 + half your level in hit points.' },
    { id: 'bless',        name: 'Bless',               lvl: 1, cost: 2,  kind: 'buff', stat: 'hit', amount: 2, dur: 30000, color: '#ff8', desc: '+2 to hit for thirty seconds.' },
    { id: 'smite',        name: 'Holy Smite',          lvl: 2, cost: 4,  kind: 'bolt', range: 3, dmg: L => [1, 6, Math.floor(L / 2)], holy: true, color: '#ffd', desc: 'Radiant strike. Double damage to the undead.' },
    { id: 'cure_serious', name: 'Cure Serious Wounds', lvl: 3, cost: 5,  kind: 'heal', heal: L => [2, 8, Math.floor(L / 2)], color: '#8f8', desc: 'Heals 2d8 + half your level in hit points.' },
    { id: 'protection',   name: 'Protection',          lvl: 3, cost: 5,  kind: 'buff', stat: 'ac', amount: 2, dur: 45000, color: '#adf', desc: '+2 armour class for forty-five seconds.' },
    { id: 'flame_strike', name: 'Flame Strike',        lvl: 5, cost: 10, kind: 'bolt', range: 4, dmg: L => [6, 6, L], area: true, fire: true, color: '#f84', desc: 'A pillar of holy fire consumes everything in the square ahead.' },
  ],
};

// Unidentified item appearances. A seeded shuffle maps each potion/scroll type to
// one of these, so "a cloudy potion" means something different in every dungeon.
const POTION_LOOKS = [
  ['cloudy', 'potion_red'], ['fizzy', 'potion_pink'], ['murky', 'potion_green'],
  ['golden', 'potion_orange'], ['silvery', 'potion_blue'], ['oily', 'potion_red'],
  ['glowing', 'potion_pink'], ['dark', 'potion_green'],
];
const SCROLL_LOOKS = [
  'crumbling', 'crisp', 'singed', 'blood-stained', 'gilt-edged', 'water-damaged', 'tightly rolled',
];

// Elite monster prefixes: a champion is stronger, worth more, and always drops loot.
// The bestiary: what the hero learns about each kind of monster by meeting
// it. The lore is there from the first meeting; the trick once it has been
// seen (or after a few kills), and the answer once the hero has beaten it.
const BESTIARY = {
  rat:      { lore: 'Big as a dog and never alone for long. They come in twos and threes from the second floor down, and the square is clear only when the last one drops.' },
  bat:      { lore: 'Quick, weak and hard to hit, it flutters above your blade. It bites fast, so its warning is short: watch for the mark and step back early.' },
  slime:    { lore: 'A slow heap of green that eats whatever it rolls over, bones included.',
    trick: 'Struck hard, it splits into two smaller slimes sharing its square.',
    answer: 'Fire, or anything that fills the square, burns both halves at once. Split slimes do not split again.' },
  spider:   { lore: 'Its bite is venomous. It prefers to hang back in a corridor and let its web do the work.',
    trick: 'Spits a web down a straight line from a few squares off. Webbed, you cannot step away, though you can still fight and turn.',
    answer: 'Step out of its line while it rears back. Caught, keep pushing: every push tears at the web.' },
  goblin:   { lore: 'Small, mean and brave in numbers. Goblins go about in groups and swing together in a quick volley.' },
  skeleton: { lore: 'Bones held together by something that will not let them rest. Undead: holy magic burns it twice as badly.',
    trick: 'Cut down by an edge, it falls into a heap of bones and pulls itself back together a few seconds later.',
    answer: 'Smash the heap before it rises: any blow shatters it. A mace, hammer, flail, club, staff or spell breaks the bones for good the first time.' },
  zombie:   { lore: 'Slow and stupid, and stronger than it looks. Undead: holy magic burns it twice as badly.',
    trick: 'Every other blow it lurches forward to seize you. Held, you cannot step away from it.',
    answer: 'Step back while it lurches and it grabs the air. Caught, keep stepping away: strength tears you free, and killing it lets go at once.' },
  orc:      { lore: 'A trained soldier, heavier and surer than a goblin. It likes a long straight corridor.',
    trick: 'Lowers its head and charges down a straight line, slamming into you harder than any blow.',
    answer: 'Sidestep out of the line while it lowers its head. It thunders past and stumbles, wide open.' },
  ghoul:    { lore: 'It eats the dead and would like you to be one. Undead: holy magic burns it twice as badly.',
    trick: 'Every third blow it reaches out with a numbing claw. If it lands, you are frozen for a moment: no step, swing or spell.',
    answer: 'Step back while it reaches and the claw closes on air. If it catches you, a hardy constitution may shake the numbness off.' },
  wraith:   { lore: 'A cold shape that drifts above the floor. Its touch drains your life force, lowering your maximum health for good. Undead: holy magic burns it twice as badly; a strong will resists the drain.' },
  ogre:     { lore: 'Huge, slow and very strong. Its club hits like a falling wall.',
    trick: 'Every third swing it heaves its club high for a crushing blow at twice the damage.',
    answer: 'Step back while it heaves. The club smashes the floor and it staggers, wide open.' },
  troll:    { lore: 'Long-armed and hungry, and very hard to kill: its wounds close as you watch.',
    trick: 'No trick to see: its nature. It grows back a hit point every second, so a slow fight goes nowhere.',
    answer: 'Fire. Burns do not close: Burning Hands, Flame Strike or a Scroll of Fire stops it regrowing for a while.' },
  minotaur: { lore: 'The master of the deep halls, bull-headed and tireless. It hits harder than anything but the lich.',
    trick: 'Charges down a straight line from four squares off and slams into you.',
    answer: 'Sidestep out of the line. It thunders past and stumbles, wide open.' },
  archer:   { lore: 'A goblin with a bow, shooting from four squares away down a straight line. It draws before it looses.' },
  acolyte:  { lore: 'A servant of the dark who hurls bolts of shadow from five squares off.',
    trick: 'Chants for nearly two seconds to mend a badly wounded monster nearby, itself included.',
    answer: 'Any blow, arrow or spell that hurts it breaks the chant: close in fast, or shoot. Kill the acolyte first.' },
  lich:     { lore: 'The dread thing that keeps the Heart of the Mountain. Its touch drains life, and it does not flee.',
    trick: 'Gathers a storm of cold fire that bursts two squares around it. At two thirds it raises guards and steps back behind them to throw grave-cold; at one third it puts out its torches and tries to drink the Heart\'s light to mend itself.',
    answer: 'When it gathers the storm, get three squares away. Close on it through its guards, and when it begins its rite, strike it: any wound breaks the rite.' },
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
  { name: 'Grey Halls',       wall: '#6e6e78', mortar: '#34343e', floor: '#3a3630', ceil: '#24222a', accent: '#8a8a70', flavor: 'Cold stone halls stretch into darkness.', decor: ['ring', 'niche', 'lichen', 'seep'] },
  { name: 'Brown Catacombs',  wall: '#7a5a3a', mortar: '#3a2a1a', floor: '#3a2e22', ceil: '#241c14', accent: '#a08050', flavor: 'The air is thick with dust and old bones.', decor: ['skulls', 'ossuary', 'burial', 'roots'] },
  { name: 'Mossy Depths',     wall: '#5a7050', mortar: '#26321f', floor: '#2c3a28', ceil: '#182218', accent: '#7fbf5f', flavor: 'Water drips and moss clings to every stone.', decor: ['moss', 'roots', 'seep', 'moss'] },
  { name: 'Blue Vaults',      wall: '#55627a', mortar: '#242a3a', floor: '#262c36', ceil: '#141824', accent: '#7fa0d0', flavor: 'A chill wind moans through these vaults.', decor: ['rime', 'grate', 'ring'] },
  { name: 'Crimson Crypts',   wall: '#7a4a4a', mortar: '#3a1e1e', floor: '#36262a', ceil: '#221416', accent: '#c05050', flavor: 'The walls here are stained a rusty red.', decor: ['stain', 'skulls', 'chains'] },
  { name: 'Obsidian Sanctum', wall: '#3c3448', mortar: '#12101a', floor: '#1e1a26', ceil: '#0c0a12', accent: '#8060c0', flavor: 'Black glass walls hum with a terrible power.', decor: ['runes', 'vein', 'shrine'] },
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

export { PROLOGUE, BACKGROUNDS, JOURNAL, BOONS, XP_TABLE, MAX_LEVEL, CLASSES, STAT_NAMES, ITEMS, KEY_COLORS, GEMS, TRAP_TYPES, MONSTERS, SPELLS, THEMES, SPRITES, POTION_LOOKS, SCROLL_LOOKS, ELITES, BESTIARY, TALENTS };
