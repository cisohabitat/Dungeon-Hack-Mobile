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
 * @property {number} [studied]  the level at which judging this piece last failed
 */

/**
 * @typedef {Object} Equipment
 * @property {Item|null} weapon
 * @property {Item|null} armor
 * @property {Item|null} shield
 * @property {Item|null} offhand   a second light weapon, where the class allows it
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
 * @property {Object<string, {amount: number, until: number}>} effects
 * @property {{until: number, next: number}|null} poison
 * @property {number} x @property {number} y @property {number} dir
 * @property {number} nextAttack @property {number} kills @property {number} steps
 * @property {number} deepest
 * @property {string[]} [boons]
 * @property {number} [perkHit] @property {number} [perkSpeed] @property {number} [perkRegen]
 * @property {number} [bonusSp] @property {number} [lastHurt] @property {number} [nextRegen] @property {number} [nextMend]
 * @property {number} [webbed]  stuck in a spider's web until then
 * @property {number} [lastTear]  when the hero last tore at a web
 * @property {string[]} [talents]  class talents taken, by id
 * @property {number} [shadowUntil]  Shadow Step: a sidestep's shadow lasts until then
 * @property {boolean} [ritesUsed]  Last Rites has been spent this run
 * @property {number} [windReady]  Second Wind can come again from then
 * @property {number} [mirrors]  Mirror Image: images left to take a blow
 * @property {number} [nextWard]  Warding Light: the next hit point from then
 * @property {number} [held]    frozen by a ghoul's touch until then
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
 * @property {string} [elite]     the champion prefix, if it is one
 * @property {{kind: string, at: number, until: number, move?: string, dx?: number, dy?: number, target?: number}|null} [windup]  a blow or trick being drawn back, and when it lands
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
 */

/**
 * Everything a save file holds.
 * @typedef {Object} GameState
 * @property {string} seed
 * @property {DungeonOptions} opts
 * @property {Player} player
 * @property {Object<number, Level>} levels
 * @property {number} depth
 * @property {Array<{m: string, c: string, base?: string, n?: number}>} log
 * @property {number} logSeq  messages ever written; the log array itself is capped
 * @property {number} t                      elapsed game time in milliseconds
 * @property {'playing'|'dead'|'won'} status
 * @property {string|null} lastSpell
 * @property {number} created @property {number} version
 * @property {Object<string, {adj: string, sprite: string}>} looks
 * @property {Object<string, number>} known
 * @property {boolean} escaping
 * @property {number} escapeStart @property {number} nextHunt @property {number} hunts
 * @property {number} [escapeMs]
 * @property {Array<{i: number, depth: number}>} journal
 * @property {string[][]} pendingBoons
 * @property {{name: string, dmg: number, bearing: string, encounter?: boolean}} [lastAttacker]
 * @property {number} [nextUid]  counter for monsters that appear mid-run
 * @property {Record<number, number>} [met]  monsters met this run, by uid, so each counts once in the bestiary
 * @property {string[]} [deathLog]
 * @property {number} [blowGate]   no monster blow may land on you before this time
 * @property {Object<string, number>} [studied]  item kind -> the level at which studying it last failed
 * @property {string[]} [metEncounters]  encounters already met this run, so none repeats
 * @property {{floor: Object<number, string>, shop: string[], offered: number, found: string[]}} [relics]  where this run's relics lie, how many traders have shown theirs, and which have been found
 */

export {};
