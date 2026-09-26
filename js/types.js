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
 * @property {number} [perkHit] @property {number} [perkSpeed] @property {number} [perkRegen]
 * @property {number} [bonusSp] @property {number} [lastHurt] @property {number} [nextRegen] @property {number} [nextMend]
 * @property {number} [webbed]  stuck in a spider's web until then
 * @property {number} [lastTear]  when the hero last tore at a web
 * @property {string[]} [talents]  class talents taken, by id
 * @property {number} [shadowUntil]  Shadow Step: a sidestep's shadow lasts until then
 * @property {number} [riposteUntil]  Riposte: the opening a missed blow left lasts until then
 * @property {number} [abilityReady]  when a fighter's Bash or a thief's Smoke can be used again
 * @property {number} [smokeUntil]  a thief's smoke hangs until then: nothing notices them by sight or sound
 * @property {'down'|'frozen'|'stone'} [heldBy]  what is holding the hero still while `held` lasts
 * @property {{uid: number, until: number}|null} [opening]  an answered trick left this monster open: the next blow at it is sure and telling
 * @property {boolean} [ritesUsed]  Last Rites has been spent this run
 * @property {number} [windReady]  Second Wind can come again from then
 * @property {number} [mirrors]  Mirror Image: images left to take a blow
 * @property {number} [nextWard]  Warding Light: the next hit point from then
 * @property {string} [path]  the class path taken at PATH_LEVEL (a PATHS id); absent until chosen, and in saves from before paths
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
 * @property {{kind: string, at: number, until: number, move?: string, dx?: number, dy?: number, target?: number, px?: number, py?: number}|null} [windup]  a blow or trick being drawn back, and when it lands
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
 * @property {boolean} [spoke]     the lich, or a named champion, has spoken, and its fight has begun
 * @property {number} [rallies]    how many times a named champion has tried to call its kin
 * @property {boolean} [mendSaid]  the log has said once that a named troll's wounds close
 * @property {number} [wardUntil]  the lich is wrapped in shadow, and cannot be hurt, until then
 * @property {boolean} [wardSaid]  the log has said so once this time
 * @property {boolean} [riteCalled]  a wraith the lich's rite called to guard it
 * @property {number} [edge]  how much surer and harder it hits, on a floor readier for a strong hero
 * @property {number} [riteReady]  when the lich can next try its rite
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
 * @property {{x: number, y: number}|null} stairsDown
 * @property {number} theme
 * @property {boolean} isFinal
 * @property {string|null} [route]   the road this floor follows past the fork, if it is one of its floors
 * @property {string|null} [twist]   what sets this floor apart, if anything: dark, flooded, restless or market
 * @property {number} [rests]  rests taken on this floor: each gives back less than the last
 * @property {boolean} [lodged]  the hero has slept by this floor's trader's lamp
 * @property {Object<string, number>} [doorBlows]  blows a beast has landed on each shut door, by square
 * @property {number} [press]  levels the hero was ahead of the usual on first entering: its creatures are readier
 * @property {Array<{x: number, y: number, w: number, h: number}>} rooms
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
 * @property {{dmg: number, from: string, id: string, depth: number}|null} worst  the hardest blow taken; from and id are '' when no monster struck it
 * @property {Object<string, number>} kills   by MONSTERS key
 * @property {Object<string, number>} spells  casts, by spell id
 * @property {Object<number, number>} hurtOn  damage taken, by floor
 * @property {number} potions @property {number} scrolls @property {number} meals
 * @property {number} gold     picked up off the floor, gems included
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
 * @property {boolean} [forkPending]  the hero stands at the divided stair and has not yet chosen
 * @property {number} [lunges]  how many lunges have followed the hero this run: the first-fight lesson reads it
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
 * @property {{name: string, dmg: number, bearing: string, encounter?: boolean, cause?: boolean}} [lastAttacker]
 * @property {number} [nextUid]  counter for monsters that appear mid-run
 * @property {Record<number, number>} [met]  monsters met this run, by uid, so each counts once in the bestiary
 * @property {string[]} [deathLog]
 * @property {number} [blowGate]   no monster blow may land on you before this time
 * @property {Object<string, number>} [studied]  item kind -> the level at which studying it last failed
 * @property {string[]} [metEncounters]  encounters already met this run, so none repeats
 * @property {{floor: Object<number, string>, shop: string[], offered: number, found: string[]}} [relics]  where this run's relics lie, how many traders have shown theirs, and which have been found
 * @property {RunStats} [stats]  this run in numbers, for the end screen; missing from saves made before it was kept
 * @property {{first?: boolean, cls?: string, difficulty?: string, unlocked?: string[], reloadable?: boolean, firstPath?: string, firstVows?: string[], firstFeats?: string[], vowsOpened?: boolean}} [earned]  what a win added to the progress kept between runs: a first trophy, backgrounds opened; or that it could not count, being reloadable
 */

export {};
