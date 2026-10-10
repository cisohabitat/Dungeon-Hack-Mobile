// Shape declarations for the checker. This file defines no values and is never
// imported at runtime; `npm run typecheck` reads it to catch the kind of bug
// that used to reach the browser: a field renamed in one place, a palette key
// that does not exist, a function that returns null into a caller that assumed
// an object.

/**
 * @typedef {Object} Stats
 * @property {number} str @property {number} dex @property {number} con
 * @property {number} int @property {number} wis @property {number} cha
 */

/**
 * One thing in a pack, on the floor, or on a trader's shelf.
 * @typedef {Object} Item
 * @property {string} t          the key into ITEMS
 * @property {number} q          how many, or the value in coin for gold and gems
 * @property {number} [e]        enchantment, added to damage or armour
 * @property {string} [color]    which lock a key opens
 * @property {string} [name]     the gem's own name
 * @property {number} [page]     which journal entry a torn page carries
 * @property {string} [u]        the key into RELICS, when this is a named relic
 * @property {number} [h]        1 while a found piece of gear keeps its quality hidden
 * @property {number} [curse]    1 when it will not come off once worn
 * @property {number} [left]     1 when the hero put it down: walking over it does not pick it up again
 * @property {number} [studied]  the level at which judging this piece last failed
 * @property {string} [pw]       the one power an ordinary piece was made with (a RELIC_POWERS key)
 * @property {string} [px]       a quality of its make, named in front: heavy, true, sturdy or blessed (GEAR_PREFIXES)
 */

/**
 * The last hero to die on this device, until a later run lays their shade to rest (Progress.fallen).
 * @typedef {Object} Fallen
 * @property {string} name @property {string} cls @property {number} level
 * @property {number} depth   the floor they fell on
 * @property {string} run     which run it was (G.created), so that run never meets its own shade
 * @property {Item[]} gear    what the body still wears: no relics, quality hidden again
 * @property {string} [killer] what killed them
 */

/**
 * @typedef {Object} Equipment
 * @property {Item|null} weapon
 * @property {Item|null} armor
 * @property {Item|null} shield
 * @property {Item|null} offhand   a second light weapon, where the class allows it
 * @property {Item|null} [ring]
 * @property {Item|null} [ring2]
 * @property {Item|null} [amulet]
 * @property {Item|null} [cloak]   worn over everything, by anyone
 */

/**
 * @typedef {Object} Player
 * @property {string} name @property {string} cls @property {string} bg
 * @property {Stats} stats
 * @property {number} level @property {number} xp
 * @property {number} hp @property {number} maxHp
 * @property {number} sp @property {number} maxSp
 * @property {number} food @property {number} gold
 * @property {Item[]} inv
 * @property {Equipment} eq
 * @property {Object<string, {amount: number, until: number, src?: string}>} effects  src: the spell that cast it
 * @property {{until: number, next: number}|null} poison
 * @property {number} x @property {number} y @property {number} dir
 * @property {number} nextAttack @property {number} kills @property {number} steps
 * @property {number} deepest
 * @property {string[]} [boons]
 * @property {Record<string, number>} [taught]   points Self-Taught has put into each score this run (two at most)
 * @property {number} [volleyN]   arrows landed this run, for a Volley's every third
 * @property {{until: number, hide: number, full: number}} [shape]  a druid in Wild Shape: until when, and the bear's hide left of its full thickness
 * @property {number} [rendN]     claw blows landed in bear shape, for Rending Claws' every third
 * @property {number} [nextKin]   when Beast Bond next mends the companion
 * @property {number} [perkHit] @property {number} [perkSpeed] @property {number} [perkRegen]
 * @property {number} [renown]  ranks of renown earned past the top level (see RENOWN in data.js)
 * @property {string[]} [renownTaken]  the gains of renown chosen, by id, one entry a rank
 * @property {number} [perkSave]  renown's Unshaken: added to every saving throw of the hero's
 * @property {number} [perkQuick]  renown's Well Practised: the share taken off the class move's wait
 * @property {number} [regenCarry]  the part of a point of natural healing still owed (Slow to Bleed's half again)
 * @property {number} [bonusSp] @property {number} [lastHurt] @property {number} [nextRegen] @property {number} [nextMend]
 * @property {number} [webbed]  stuck in a spider's web until then
 * @property {number} [lastTear]  when the hero last tore at a web
 * @property {string[]} [talents]  class talents taken, by id
 * @property {number} [shadowUntil]  Shadow Step: a sidestep's shadow lasts until then
 * @property {number} [unseenUntil]  the Last Word: a foe slain from the shadows leaves the next blow there too, until then
 * @property {{hp: number, until: number}} [aegis]  the Lantern of Mercy's ward of light: what it will take of the next blows, and when it fades
 * @property {number} [noiseAt]  when the hero last made a sound (a step, a blow, a spell, a door), for the eyeless, which hunt by it
 * @property {number} [riposteUntil]  Riposte: the opening a missed blow left lasts until then
 * @property {number} [abilityReady]  when a fighter's Bash or a thief's Smoke can be used again
 * @property {number} [smokeUntil]  a thief's smoke hangs until then: nothing notices them by sight or sound
 * @property {'down'|'frozen'|'stone'|'ice'|'snare'} [heldBy]  what is holding the hero still while `held` lasts
 * @property {{uid: number, until: number}|null} [opening]  an answered trick left this monster open: the next blow at it is sure and telling
 * @property {boolean} [ritesUsed]  Last Rites has been spent this run
 * @property {number} [windReady]  Second Wind can come again from then
 * @property {number} [mirrors]  Mirror Image: images left to take a blow
 * @property {number} [nextWard]  Warding Light: the next hit point from then
 * @property {string} [path]  the class path taken at PATH_LEVEL (a PATHS id); absent until chosen, and in saves from before paths
 * @property {{t: string, left: number}|null} [coating]  what the weapon is coated with (fire, silver, venom), and how many more blows that land it lasts
 * @property {string} [capstone]  the path's capstone taken at CAPSTONE_LEVEL (an id from the path's capstones); absent until chosen
 * @property {number} [nextMercy]  a Healer's mending under Protection: the next hit point from then
 * @property {number} [held]    cannot act until then: frozen by a ghoul's touch, or knocked down by a charge
 * @property {{uid: number, until: number, nextTry: number}|null} [grabbed]  held by a zombie
 */

/**
 * A monster as it exists on a level, as opposed to its entry in MONSTERS.
 * @typedef {Object} Monster
 * @property {number} uid @property {string} id
 * @property {number} x @property {number} y
 * @property {number} hp @property {number} maxHp
 * @property {boolean} awake @property {number} nextAct
 * @property {number} rx @property {number} ry
 * @property {number} fromX @property {number} fromY
 * @property {number} moveT0 @property {number} moveT1 @property {number} flashUntil
 * @property {number} [flashAt]  when its hit flash starts: later than the blow for a fireball still in the air
 * @property {number} [hpShown]  the life its bar shows until then
 * @property {string} [elite]     the champion prefix, if it is one
 * @property {number} [worth]     what it pays in experience, when not its kind's own: a puffcap is worth the creature it grew over
 * @property {number} [sporedAt]  when a puffcap last burst in spores (a second blade in the same breath looses no second cloud)
 * @property {number} [backAt]    a skirmisher (a kobold) may not step back from the hero again before this time
 * @property {boolean} [sunk]     a drowned one lying unseen under the black water, until something comes near
 * @property {number} [brittleUntil]  held back by the hero's cold: brittle to the Rimebound Grimoire until then
 * @property {boolean} [groping]  an eyeless that has lost the sound of the hero, listening for it
 * @property {boolean} [gropeSaid]  its first groping told in the log
 * @property {boolean} [disguised]  a mimic still shut, drawn and taken as the barrel it seems (foes.js springs it)
 * @property {boolean} [creaked]  a shut mimic that has creaked as the hero came near: heard, it can be aimed at
 * @property {number} [springAt]  when a shut mimic beside the hero springs, if the hero stays
 * @property {number} [dox]  where in its square the barrel it seems to be stood, across
 * @property {number} [doy]  and along
 * @property {boolean} [dotTick]  while a carried burn or poison deals its tick (told whole, in flames or not)
 * @property {number} [burnSaid]  until when its burning has been told (the first tick of a burning, not every one)
 * @property {number} [balkSaid]  until when its shying back from a fire has been told (once a fire, not every step)
 * @property {{kind: string, at: number, until: number, move?: string, dx?: number, dy?: number, target?: number, px?: number, py?: number, tx?: number, ty?: number}|null} [windup]  a blow or trick being drawn back, and when it lands
 * @property {boolean} [pressing]  made to miss, so its next wind-up is quicker
 * @property {{kind: string, left: number, next: number}|null} [volley]  a group's blows still to land after the first
 * @property {boolean} [fleeing]
 * @property {number} [lostAt]    when it last lost your trail
 * @property {number} [nextRegen]
 * @property {Array<{hp: number, maxHp: number}>} [pack]  the others sharing its square, behind it
 * @property {number} [blows]      plain blows since its last trick
 * @property {number} [moveReady]  when its trick can next be tried
 * @property {number} [collapsed]  a skeleton in a heap of bones: when it rises again
 * @property {boolean} [risen]     it has already risen once
 * @property {boolean} [split]     a slime that has already split
 * @property {number} [burnUntil]  a troll's burns: no regrowth until then
 * @property {number} [phase]      how many times a boss has called for help
 * @property {number} [lungeAt]    when it last swung, for the lunge drawn with it
 * @property {number} [smoked]   lost in a thief's smoke until this time: asleep to them, but still near
 * @property {number} [snaredUntil]   caught in a ranger's Snare until this time (or Entangle's roots, or frozen into ice)
 * @property {string} [heldBy]   what holds it while snaredUntil lasts: 'snare', 'roots' or 'ice', for the picture of it
 * @property {boolean} [spoke]     the lich, or a named champion, has spoken, and its fight has begun
 * @property {number} [rallies]    how many times a named champion has tried to call its kin
 * @property {boolean} [mendSaid]  the log has said once that a named troll's wounds close
 * @property {{name: string, cls: string, level: number, run: string, depth: number, tier?: number}} [shade]  the shade of a hero who died in an earlier run: who they were, and the floor (and its place on the monster ladder) it was made for
 * @property {number} [wardUntil]  the lich is wrapped in shadow, and cannot be hurt, until then
 * @property {boolean} [stoutSaid]  the log has said once that poison does nothing to this stout grey dwarf
 * @property {number} [bigUntil]  a grey dwarf grown to twice its height by its working, until then (its blows fall half as hard again)
 * @property {boolean} [wardSaid]  the log has said so once this time
 * @property {boolean} [riteCalled]  a wraith the lich's rite called to guard it
 * @property {number} [edge]  how much surer and harder it hits, on a floor readier for a strong hero
 * @property {number} [riteReady]  when the lich can next try its rite
 * @property {boolean} [cutBroke]  a boss whose rite or drumbeat a sellsword's cut has broken this fight (once only)
 * @property {boolean} [throne]  the Goblin Warlord sits his throne: his shield-bearers turn every blow but a spell, and he only throws
 * @property {number} [bearer]  this orc is one of the Warlord's shield-bearers (the Warlord's uid)
 * @property {number} [ember]  this emberling climbed out of the Heartforged's furnace (its uid): it goes out when the Heartforged falls
 * @property {number} [drums]  how many times the Warlord has beaten his war-drum
 * @property {boolean} [frenzy]  the Warlord has kicked open his war-chest and fights in a frenzy
 * @property {boolean} [overSaid]  a spell over the shield-bearers' heads has been told once
 * @property {number[][]} [snuffed]  the torches the lich put out, to light again when it falls
 * @property {Array<{x: number, y: number}>} [lights]  their light, likewise
 * @property {{x: number, y: number, w: number, h: number}} [hall]  the lich's own hall, whose torches it puts out
 * @property {{kind: string, until: number, next: number}|null} [dot]  burning or poisoned by the hero
 */

/**
 * Someone or something standing on a square: a trader, or an encounter's prop
 * (kind 'encounter', whose id names the encounter and which has no stock).
 * @typedef {Object} Trader
 * @property {string} id @property {number} x @property {number} y
 * @property {string} [kind]
 * @property {Item[]} [stock]
 * @property {number} [markup]    multiplier over an item's own value
 * @property {boolean} [greeted]
 * @property {boolean} [whet]  whether this trader has brought out a whetstone for a sellsword
 */

/**
 * One generated floor of the dungeon.
 * @typedef {Object} Level
 * @property {number} depth @property {number} w @property {number} h
 * @property {number[]} tiles     one of Dungeon.T per square
 * @property {number[]} roomId    which room a square belongs to, or -1
 * @property {number[]} explored
 * @property {Object<string, Item[]>} items    keyed "x,y"
 * @property {Monster[]} monsters
 * @property {Trader[]} npcs
 * @property {Object<string, string>} traps    keyed "x,y"
 * @property {Object<string, string>} locks    keyed "x,y", valued by key colour
 * @property {Object<string, {type: string, used: boolean}>} features
 * @property {Array<{x: number, y: number}>} lights
 * @property {{x: number, y: number, dir: number}} start
 * @property {{x: number, y: number, dir: number}|null} downStart
 * @property {{x: number, y: number}} stairsUp
 * @property {number[]} [caved] squares the roof has come down on (by index): the first floor's stair up, and the way in as it falls (prelude.js)
 * @property {{x: number, y: number}|null} stairsDown
 * @property {number} theme
 * @property {boolean} isFinal
 * @property {string|null} [route]   the road this floor follows past the fork, if it is one of its floors
 * @property {{kind: string, room: number, props: {x: number, y: number, k: string}[], seen?: boolean}} [piece]  the floor's set piece (rooms.js): which, its room, what lies in it, and whether the hero has stepped in yet
 * @property {string|null} [twist]   what sets this floor apart, if anything: dark, flooded, restless, market, overgrown, tremors or (deep down) smouldering
 * @property {Array<{x: number, y: number, next: number, heat: number, sealedUntil: number}>} [vents]  a smouldering floor's glowing cracks: when each next heats up, when it began to (0 when quiet), and how long cold has sealed it (elements.js)
 * @property {number} [ventSaid]  when a crack's flare was last told, so the log keeps room
 * @property {{next: number, falls: Array<{x: number, y: number, at: number, lands: number}>}} [quake]  a floor of tremors: when the ground next shudders, and the squares rock is coming down on (elements.js)
 * @property {Record<string, {k: 'fire'|'ash'|'oil'|'ice', until?: number, fuel?: string, spread?: number, burn?: number, gen?: number, wild?: boolean, door?: boolean}>} [fields]  what lies on a square, keyed "x,y": fire, ash, spilt oil or ice (see elements.js); a fire's wild is set when a monster lit it, not the hero; an ash's door, where a door burnt through
 * @property {number} [fireSaid]  until when a fire catching is not told again
 * @property {Object<string, boolean>} [burntDoors]  doorways whose doors have burnt through, keyed "x,y": nothing left to shut
 * @property {boolean} [lampOil]  its traders have been given their flasks of lamp oil (once, so one bought out stays so)
 * @property {Array<{k: 'cache'|'slick'|'barricade', x: number, y: number, who?: string, uids?: number[], casks?: number[][], line?: number[][], said?: boolean, named?: boolean}>} [pieces]  a scene laid out for fire on this floor (its sleepers, casks or oil), whether the hero has come within sight of it, and whether it was named then
 * @property {number} [rests]  rests taken on this floor: each gives back less than the last
 * @property {boolean} [lodged]  the hero has slept by this floor's trader's lamp
 * @property {boolean} [heartSaid]  the hero has been told the lich holds the Heart fast
 * @property {Object<string, number>} [snares]  a kobold's snares set on this floor, keyed "x,y", by whose uid set it (each is in traps too)
 * @property {boolean} [trapsKnown]  an encounter told the hero where this floor's traps are
 * @property {boolean} [stoodFast]  Undying or Miracle has already turned a killing blow on this floor
 * @property {Object<string, number>} [doorBlows]  blows a beast has landed on each shut door, by square
 * @property {number} [press]  levels the hero was ahead of the usual on first entering: its creatures are readier
 * @property {Array<{x: number, y: number, w: number, h: number, shape?: string}>} rooms  each room's bounds and its shape (rooms.js: a box, colonnade, cavern, the set piece's kind...)
 * @property {Dressing[]} [dressing]  what lies about the rooms for looks alone (see Dungeon.dress)
 * @property {Array<{x: number, y: number, k: string, at: number, until: number}>} [remains]  what the fallen left behind, when it fell, and until when (game time)
 * @property {{name: string, cls: string, x: number, y: number, fell?: number, killer?: string}} [bones]  where an earlier hero's bones lie on this floor, if they do, and the floor they fell on
 * @property {boolean} [bonesSaid]  the log has told of them, on the first time down
 */

/**
 * A thing lying about a room for looks: a barrel, bones, a puddle.
 * @typedef {Object} Dressing
 * @property {number} x @property {number} y
 * @property {string} k    its kind, a key into DRESSING (dressing.js), or 'puddle'
 * @property {number} ox @property {number} oy   where on its square, from the middle
 * @property {number} [r]  a puddle's size
 * @property {boolean} [fell]  rubble that came down from the roof on a floor of tremors
 */

/**
 * An entry in the ITEMS table: what a kind of thing is, as opposed to one you
 * are carrying. Most fields only apply to some kinds.
 * @typedef {Object} ItemDef
 * @property {string} kind @property {string} name
 * @property {number} [value] @property {string} [sprite] @property {string} [desc]
 * @property {boolean} [stack]
 * @property {[number, number, number]} [dmg] @property {number} [speed]
 * @property {number} [range] @property {boolean} [twoHanded] @property {string[]} [cls]
 * @property {boolean} [aimed] a bow or sling: drawn and aimed, so a ranger's Steady Aim applies
 * @property {number} [ac] @property {string} [weight] @property {number} [tier]
 * @property {string} [effect] @property {[number, number, number]} [heal]
 * @property {number} [food]
 */

/**
 * How the player chose to play, fixed when the run begins.
 * @typedef {Object} DungeonOptions
 * @property {number} levels @property {string} size
 * @property {string} monsters @property {string} treasure
 * @property {boolean} lockedDoors @property {boolean} traps
 * @property {boolean} [permadeath]
 * @property {'easy'|'normal'|'hard'} [difficulty]  how hard the delve is; a run from before the choice is Normal
 * @property {string} [daily]  the date of a Daily Delve, as YYYY-MM-DD; absent on any other run
 * @property {'earned'} [dailyKind]  'earned' for the Ranger & Druid Daily (once the earned classes'); absent on the first
 * @property {string[]} [vows]  the vows sworn at the start (see VOWS in data.js)
 * @property {string} [route]  the road taken at the fork (see ROUTES in data.js), passed to the generator; absent before it
 */

/**
 * What happened over one run, kept for the end screen. The rules never read it.
 * @typedef {Object} RunStats
 * @property {number} dealt    damage the hero's blows, spells and burns did
 * @property {number} taken    damage the hero took, from anything
 * @property {number} healed   hit points actually restored, not counting what overflowed
 * @property {{dmg: number, to: string, id: string, how: string, depth: number}|null} best  the hardest blow landed: on whom (to, a name; id, a MONSTERS key) and with what
 * @property {{dmg: number, from: string, id: string, cause?: string, depth: number}|null} worst  the hardest blow taken; from and id are '' when no monster struck it, and cause says what did (a trap, poison, hunger)
 * @property {Object<string, number>} kills   by MONSTERS key
 * @property {Object<string, number>} spells  casts, by spell id
 * @property {Object<number, number>} hurtOn  damage taken, by floor
 * @property {number} potions @property {number} scrolls @property {number} meals
 * @property {number} gold     picked up off the floor, gems included
 * @property {number} [bounties]  traders' jobs done and paid for
 * @property {number} [shapes]    a druid's Wild Shapes taken this run, for the Wildheart feat
 * @property {{key: string, name: string, grade: string, depth: number}[]} [finds]  this run's finds: each piece of rare gear, relic or legend, once known, by the name it had then
 */

/**
 * A trader's job for the floor below (see bounty.js).
 * @typedef {Object} Bounty
 * @property {'slay'|'cull'|'fetch'} kind  slay the floor's champion, kill a number of its creatures, or find a lost satchel
 * @property {number} depth  the floor it is for
 * @property {number} from   the floor whose trader gave it: only a trader deeper pays
 * @property {number} need   how many to kill (1 for the rest)
 * @property {number} got    how many so far
 * @property {{gold: number, t: string}} reward
 * @property {boolean} [started]  the hero has reached its floor
 * @property {boolean} [done]
 * @property {string} [target]  the champion's MONSTERS key, once met with
 * @property {string} [name]    and its name
 */

/**
 * Everything a save file holds.
 * @typedef {Object} GameState
 * @property {string} seed
 * @property {DungeonOptions} opts
 * @property {Player} player
 * @property {Object<number, Level>} levels
 * @property {number} depth
 * @property {string} [route]  the road taken at the fork: crypts or warrens; absent until chosen
 * @property {boolean} [tested]  a testing aid (endless life, spell points or gold) was on at some point: the run is written nowhere
 * @property {boolean} [forkPending]  the hero stands at the divided stair and has not yet chosen
 * @property {number} [lunges]  how many lunges have followed the hero this run: the first-fight lesson reads it
 * @property {Bounty|null} [bounty]  the trader's job the hero has taken, if any (see bounty.js)
 * @property {Record<number, number>} [bountyTaken]  floors whose trader's job has been taken, so it is not offered twice
 * @property {Record<string, number>} [threads]  choices that follow the hero down: each kept with the floor it was made on (see threads in game.js)
 * @property {Array<{m: string, c: string, base?: string, n?: number, notes?: Record<string, string[]>, gone?: boolean, at?: number}>} log
 * @property {number} logSeq  messages ever written; the log array itself is capped
 * @property {number} t                      elapsed game time in milliseconds
 * @property {'playing'|'dead'|'won'} status
 * @property {string|null} lastSpell
 * @property {number} created @property {number} version
 * @property {Object<string, {adj: string, sprite: string}>} looks
 * @property {Object<string, number>} known
 * @property {boolean} [escaping]  a save from when the Heart had to be carried out: loaded, it is won
 * @property {number} [escapeStart] @property {number} [nextHunt] @property {number} [hunts] @property {number} [escapeMs]
 * @property {Array<{i: number, depth: number}>} journal
 * @property {string[][]} pendingBoons
 * @property {boolean} [bossDown]  the lich has fallen: no more choices stand between the hero and the Heart
 * @property {number[]} [pendingLevels]  the level each queued offer was earned at
 * @property {Record<number, {hp: number, spells: string[]}>} [levelNotes]  what each level-up brought
 * @property {{name: string, id?: string, dmg: number, bearing: string, encounter?: boolean, cause?: boolean}} [lastAttacker]  who struck last, and what kind it was (for the share card's picture)
 * @property {string} [rested]  the earlier hero whose shade this run laid to rest: "Brand the Fighter"
 * @property {number} [nextUid]  counter for monsters that appear mid-run
 * @property {{kind: string, name: string, x: number, y: number, depth: number, hp: number, maxHp: number, mode: 'follow'|'stay', nextAct: number, kills: number, joined: number, fallen?: number, fromX?: number, fromY?: number, moveT0?: number, moveT1?: number, flashUntil?: number, lungeAt?: number, stuckSince?: number, locks?: number, traps?: number, floors?: number, deepest?: number, charm?: string, mendAt?: number, guarded?: number, windOn?: number, wages?: number, unpaid?: number, tendAt?: number, tending?: boolean, dressAt?: number, flareAt?: number, herbs?: number, herbsOn?: number, mended?: number, dressedOn?: number, avenged?: number}} [companion]  the hero's companion (a hound, a goblin, a wolf, a sellsword, a healer or a renegade dark elf), if one follows them (see companion.js); floors counts the new floors it went down at their side, deepest the deepest of them; charm the item it wears (a charm_ id), and mendAt when a rowan knot next mends it; a sellsword's guarded counts the blows it took for the hero, windOn the floor its second wind was spent on, wages how many floors' pay it has asked past the eighth of a Long Delve, and unpaid the gold it is owed (it will not guard until paid); a healer's tendAt is when it next tends the hero, tending whether it is at it now (drawn holding its hands out over the hero, as it is for a moment after a dressing, from dressAt), herbs what its satchel still holds for the floor herbsOn (the deepest it has filled it on), mended all it has mended of the hero, and dressedOn the floor its Field Dressing was spent on; a renegade's avenged the floor it saw the High Priestess fall on; flareAt is when it last learned a trick, for the golden motes drawn round it
 * @property {boolean} [metLampfolk]  a Lampfolk trader has been met this run (the first says who they are)
 * @property {Record<number, number>} [met]  monsters met this run, by uid, so each counts once in the bestiary
 * @property {string[]} [deathLog]
 * @property {number} [blowGate]   no monster blow may land on you before this time
 * @property {Object<string, number>} [studied]  item kind -> the level at which studying it last failed
 * @property {string[]} [metEncounters]  encounters already met this run, so none repeats
 * @property {{floor: Object<number, string>, shop: string[], offered: number, found: string[]}} [relics]  where this run's relics lie, how many traders have shown theirs, and which have been found
 * @property {RunStats} [stats]  this run in numbers, for the end screen; missing from saves made before it was kept
 * @property {{first?: boolean, cls?: string, difficulty?: string, unlocked?: string[], reloadable?: boolean, firstPath?: string, mastered?: boolean, firstVows?: string[], firstFeats?: string[], vowsOpened?: boolean, tested?: boolean}} [earned]  what a win added to the progress kept between runs: a first trophy, backgrounds opened; or that it could not count, being reloadable
 */

export {};
