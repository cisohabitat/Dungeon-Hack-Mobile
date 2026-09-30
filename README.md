# Deepdelve

A first-person, real-time dungeon crawler for mobile browsers, built in the spirit of the
1993 seed-generated dungeon classics. Pick a class, roll your stats, type a seed, and descend.

**Play it now:** https://dungeon-hack-mobile.vercel.app

Open it on your phone and choose "Add to Home Screen" to install it as an app. It works offline after the first load.

## Features

- **Seeded dungeons.** Every level is generated from your seed string, so the same seed always
  gives the same dungeon. Share seeds with friends.
- **Customisable descent.** Choose the number of levels (4 to 16), map size, monster density,
  treasure density, locked doors and keys, traps, and permadeath, just like the original's
  dungeon-customisation screen. A difficulty picker at the top sets Easy, Normal or Hard.
- **One life by default.** Permadeath is on unless you untick it. The run is still saved when
  you change levels or put the game away, so Continue picks it up, but Load stays shut and a
  death erases the save.
- **The Daily Delve.** One dungeon a day, the same for everyone: the seed, the class, the
  background and the scores all come from the date. Eight floors, normal difficulty, one life,
  one try. The title then shows how it went, the Hall marks the run, a streak counts the days in
  a row, and Share copies a one-line result. Nothing leaves the device.
  A second, the Ranger & Druid Daily, deals one of those two classes, with its own record and streak.
- **A story you descend into.** An opening sets up the valley above Karrathal and what went wrong
  beneath it. Each of the eight levels holds one page left by the guild crews who went first, and
  the Journal collects them as the account of what actually happened down there assembles itself.
- **Eight backgrounds.** The Oathbroken, Tombwise, Ashborn, Cloistered, Deep-born and Debtor. Each
  gives a lasting advantage, a paragraph of the opening, and the line your run closes on. Two more
  are earned: The Returned opens after any win on Normal or Hard, The Heartsworn after a win on
  Hard. The Daily Delve only ever deals the first six.
- **Trophies and a relic codex.** Progress that outlasts a run, kept on the device under one key.
  Each class earns a trophy for each difficulty it wins (fifteen in all, daily runs included),
  shown as a grid at the top of the Hall of Heroes, and the victory screen says when one is new.
  Every relic any hero picks up or buys goes in the codex, readable from the Hall or the
  Journal's Relics tab; the rest show only whether they are a weapon, armour or a shield.
- **A choice at every level.** A small lesson at most levels, three offered at a time; on every even level a class talent instead, one of three from the class's own six or seven, each changing how the class fights.
  Ability gains can be taken repeatedly; the permanent perks only once.
- **A path at level 5.** Each class chooses one of two paths, for good, in place of that level's
  lesson: Knight or Berserker, Templar or Healer, Pyromancer or Frostweaver, Assassin or Trickster.
  Each changes two or three rules (a shield that catches blows, rage that grows with your wounds,
  fire that keeps burning, a slip aside from a blow) and some give something up for it. The path
  is on the Hero sheet, the end screen and the Hall of Heroes.
- **Mastery at level 9.** A hero on a path masters it, again in place of the lesson: one of the
  path's two capstones (a Knight's shield that catches one blow in four, a Berserker who will not
  fall once a floor, a Pyromancer's fire that burns hotter and longer, a Sharpshooter's quicker draw).
- **Six classes** with AD&D-flavoured rules: Fighter, Cleric, Mage, Thief, Ranger, Druid. Six ability scores
  (4d6 drop lowest), hit dice, armour class, to-hit progression, class weapon and armour limits,
  experience levels up to 12. Each has its own way to stay alive: fighters are hardy and recover
  faster, clerics heal, mages kill at range, thieves dodge, crit often and backstab, rangers keep
  their distance, and druids take a bear's shape, whose hide takes the blows first (any other
  spell lets it go). All six can be chosen from the start.
- **Melee and missile arms.** Throwing knives, slings and bows reach down a corridor, so archers
  and casters are not the only ones with an answer at range. Monsters move faster than they
  swing, so a missile weapon buys you a few shots rather than an endless retreat.
- **Real-time combat.** Monsters wake, path toward you and attack on their own clocks. A door
  pulled shut matters: whatever has hands opens it, but beasts must batter it down over several
  seconds (you hear every blow), and ogres, trolls and minotaurs smash it to splinters, for good. Twenty-one monster types, and seven named champions, including undead, poisoners, a regenerating troll, a
  basilisk whose gaze turns whoever meets it to stone, a rustmaw that eats your armour's
  enchantment, a hound that steps out of the air at your back, a quillback whose raised quills
  punish the blow struck into them, a wyrm whose fire runs down the passage but not under its
  jaws, and a life-draining boss guarding the artifact on the deepest level. Which of
  them a floor holds goes by how far through the delve it is, so a short delve meets them all.
  Every trick is warned of, armour does not turn a warned blow, and answering one leaves an opening.
- **A boss fight in three acts.** The Dread Lich speaks when it wakes, and its life runs across
  the top of the view. At two thirds it raises skeleton guards and steps back behind them to
  throw grave-cold over their heads; at one third it puts out every torch in its hall,
  quickens, and tries to drink the Heart's light to mend itself, a rite any wound breaks.
  A mage has answers of their own: a spell pulls the lich's shadow ward apart and gives back a
  third of their spell points, and grave-cold breaks on a mage's Shield.
- **Blows that leave a mark.** Every monster bleeds its own colour, from red to a slime's
  green to a wraith's cold light; heavy blows and kills stain the floor, misses strike sparks,
  and a hard hit on you jolts the view and leaves blood on its edges. Poison, frost, webs and
  blessings each tint the view their own way, and timed effects count down.
- **Magic.** Mage and Cleric spell lists (bolts, buffs, heals) with spell points, plus scrolls
  anyone can read.
- **Items.** Weapons, armour and shields with enchantments, potions, scrolls, food, gems, gold,
  and colour-coded keys for locked doors.
- **Oils.** Fire Oil, Silver Wash and Blade Venom coat the weapon for its next 20 blows that land:
  more fire damage (and no troll mending), more against the undead, or poison for the living.
- **A trader in the dark.** One of the Lampfolk (on a goblin market floor, a goblin pedlar) sets up shop on about two floors in five, selling
  potions, scrolls, food and the odd weapon, and buying whatever you do not want for about a quarter
  of what they would ask. Buying something identifies it. Gold you never spend is just a number on your
  gravestone.
- **Two last fights.** The Crypts end at the Dread Lich; the Warrens at the Goblin Warlord, who
  beats a war-drum for his warband, takes to his throne behind two shield-bearers at two thirds,
  and fights in a frenzy at one third.
- **Jobs from the traders.** A trader may offer a job for the floor below: slay its champion,
  cull its creatures, or find a lost satchel. Free to take, for that floor only, and paid in gold
  and a flask or scroll by the next trader you meet.
- **A hound at your heel.** On floor 2 of most delves a starving hound watches from the dark.
  Share your food, or win it over with a word, and it follows you down: it bites whatever
  stands beside it (the thing at your side first), draws the blows of anything that reaches it
  before you, heals when you rest and grows with you, and leaves a fight to follow you if you
  walk on. It finds its own way round doors and crowds, shows on both maps, and stands beside
  you on the picture of a won run. Walk into it to swap places; face it and
  press Use to tell it to stay or call it to heel. It is no help to a quiet step: sleepers hear a hero
  with a hound at heel a square sooner. A hound told to stay is left behind on the
  stair. If it falls it is gone for the run, and the epilogue remembers it.
- **Or a goblin with clever fingers.** A delve with no hound keeps a caged goblin about halfway
  down. Let it out and it follows as the hound does, but it is a poor fighter and a quiet one:
  it picks the locks you have no key for, makes safe the traps it passes, and lends its fingers
  to an encounter's Dexterity test (+2). One companion a run.
- **Companions that grow.** Every new floor a companion comes down at your side counts: blooded
  after two, a veteran after four, tougher each time and with a trick of its kind (a hound's
  hamstring and pack hunting; a goblin's backstab and scrounging). A charm from a trader (a studded
  collar, a fang, a rowan knot) makes it tougher, fiercer or slowly self-mending.
- **Survival.** Hunger, poison (fought off with a Constitution save), traps in corridors (dodged
  with a Dexterity save; a pit is only halved). Wounds close on their own only up to half
  your life; past that it takes a potion, a prayer or a rest. Resting costs food, is blocked by
  nearby enemies (the Rest button dims and says so; it never drinks for you), and thins out: the first rest on a floor restores everything, the next half,
  the third a quarter, and then the dark is too close to sleep. Potions are found rarely enough
  that the gold you carry has something to buy.
- **An ending that is a fight.** The Heart of the Mountain will not come loose while the Dread
  Lich stands. Bring it down, lift the Heart, and its light floods the view and carries you out:
  the run is won there and then, with no long walk back.
- **Unknown potions and scrolls.** Every dungeon shuffles appearances, so a "cloudy potion" is
  a different draught in each seed. Drink or read it to learn what it is.
- **Champions.** Feral, Armoured, Ancient and Rabid monsters appear more often as you descend.
  They hit harder, take more killing, and always drop something worth having.
- **Fire, cold and lightning.** Spells, a Scroll of Fire, a flaming blade and burns each carry an
  element, and some kinds take half as much again from one and only half from another (slimes,
  spiders, zombies, trolls and quillbacks burn well; the dead barely feel the cold; rustmaws and
  bats draw the lightning; a cave wyrm shrugs off fire and fears the cold). The first hit that finds out says so and the bestiary keeps it. The wraith's touch
  and the lich's grave-cold are cold, and a Ring of Warmth halves them.
- **Named champions.** About a third and two thirds of the way down, one floor each is held by
  a named foe, chosen by the seed from those that suit the depth: Grisk the Goblin King, Vessra
  the Web-Mother, Ushgar the Orc Warchief, Morrow the Ghoul Lord, Orla the Hollow Abbess and
  Gorrum the Troll-Father. Each is its kind grown great and washed in its own colour, asleep in
  a lair away from the stairs with some of its kin, named in the log when you arrive, and given
  a life bar across the top of the view once awake. Each sharpens its kind's trick (a horn that
  calls kin at half health, webs or a claw twice as often, a hand that drinks your life), warned
  of and answered like every other. It falls for a relic the traders were keeping for your
  class, or a +2 piece and gold once they have none left, and the bestiary, end screen and Hall
  of Heroes remember it.
- **Your dead come back.** The last hero lost on a device (outside the Daily Delve) is
  remembered there. A later run (never a daily one) finds their bones on the floor where they fell, still wearing their gear,
  with their shade risen over them: made to that floor, fighting as its class did, and warned of
  in the log on arrival. Laying it to rest wins the gear (quality hidden again, curses and all,
  relics left behind) and forgets them; the Hall records who was laid to rest. The map is the
  seed's own either way: the bones are placed afterwards, from a stream of their own.
- **The deep answers strength.** A hero who arrives on a floor well ahead of the usual level
  finds it readier for them: its creatures take more killing, hit surer and harder, and more of
  them are champions. A hero on pace or behind finds each floor as it was made.
- **Torchlit halls.** Wall brackets cast real pools of light across floors, walls and monsters,
  each flame flickering on its own rhythm. Every depth decorates its walls its own way: iron
  rings and candle niches, skulls and ossuaries in the catacombs, moss and roots in the damp,
  frost and grates in the vaults, chains in the crypts, glowing runes in the sanctum.
- **Secrets.** Hidden doors lead to treasure vaults. Search suspicious walls, or play a Thief and
  spot them in passing. Wall fountains restore you fully, once per fountain.
- **Ranged foes.** Goblin archers and dark acolytes attack down corridors, so cover matters.
  Wounded monsters break and flee, and a strong character can shoulder a locked door open.
- **A map you can read.** Explored ground is cropped and scaled to fill the screen, the player
  is a ringed square with a facing arrow, stairs, doors, locked doors, fountains and traders each
  have their own colour and symbol, and a legend names them all. A live corner minimap too.
- **You are told what is happening.** Attacks name the direction they came from, the edge of the
  view flashes on that side, walking into a wall says so, and the death screen names your killer
  and replays your last moments. Win or lose, the end screen sums up the run: your best blow,
  the hardest hit you took, what you killed and how many, the talents and relics you carried.
- **Nothing is spent for nothing.** Food, potions, scrolls and spells refuse to be used when they
  could not help, and say why. Unidentified draughts are always usable, since refusing one would
  tell you what it is.
- **Automap** of explored areas plus a live corner minimap, message log with full history,
  monster health bars, save/load to local storage with autosave on every level change, and a
  Hall of Heroes that remembers your best runs. The pack compares any weapon or armour against
  what you are already wearing, in damage per second or armour class.
- **Sound.** Placed by ear: a blow drawn back on your left is heard on your left, and a far one
  is quieter and duller. Blades, clubs, arrows, fists and spells each strike differently, armour
  and shields ring, each kind of creature has its own voice and its own death, and every spell
  its own sound. Each floor has its own drone and distant noises (drips, chains, wind), which
  tighten while the lich is fighting, and you hear your own heartbeat once badly wounded.
- **Music that follows the fight.** Written as it plays, in each floor's own scale: a few bell
  notes and long silences while nothing is near, a low pulse when something awake is close, a
  quicker beat and a repeating figure once it comes to blows, and a horn beneath for a named
  champion, a shade or the lich. When the fight ends it comes home to the floor's own note and
  then hushes a while. It has its own switch in the Menu.
- **A living title screen.** The menu sits over a real generated dungeon with a ghost camera
  walking it, drawn by the same raycaster as the game, with drifting embers and torch flicker.
- **Mobile first.** Big touch d-pad with hold-to-walk, swipe on the view to turn or step, tap
  it to act, haptic feedback, portrait and landscape layouts, safe-area aware, installable as a
  PWA with offline support. Keyboard controls on desktop.

The code is plain ES modules with no build step: the page loads `js/main.js` and the browser
resolves the rest, so what you edit is what ships. Types are written as JSDoc and checked by
TypeScript in `--noEmit` mode, which catches renamed fields and bad shapes without putting a
compiler between the source and the browser. Everything is original: the raycast renderer
with textured floors and ceilings, procedural
wall textures, pixel-art sprites and sound effects are all generated in code. No external
assets or dependencies. Creatures are drawn as 24x24 tone art; the outline, contact shadow and
overhead light are applied at load time so every sprite reads the same way against a dark wall.

## Deploy on Vercel

The game is a static site with no build step, so Vercel needs no special configuration beyond
the included `vercel.json` (cache headers for the service worker and basic security headers).

**From the dashboard**

1. Push this repository to GitHub.
2. In Vercel, click **Add New → Project** and import the repository.
3. Leave **Framework Preset** as **Other**, keep the build command empty, and leave the output
   directory as the repository root.
4. Click **Deploy**. Every push to the default branch redeploys automatically.

**From the CLI**

```bash
npm i -g vercel
vercel          # preview deployment
vercel --prod   # production deployment
```

The app must be served over HTTPS for the service worker (offline mode) and "Add to Home
Screen" to work. Vercel does this by default.

## Run locally

Any static server works. For example:

```bash
npx serve .
# or
python3 -m http.server 8000
```

Then open the printed URL on your phone (same Wi-Fi) or in a desktop browser.

## Tests

```bash
npm run typecheck     # JSDoc types, via tsc; nothing is compiled
npm test              # typecheck, then generator, sprite, balance and rule checks
npm run test:browser  # 192 Playwright tests against a real browser, at phone size
npm run test:all      # both
npm run playtest      # 40 simulated runs for each of the five classes, reports win rate
```

The browser suite drives the real game in headless Chromium: the core loop, dungeon features,
the trader, the story layer, the endgame, and an interface pass that asserts every
control clears the 44px touch guideline, that readable text clears 4.5:1 contrast, and that a
crowded level renders inside a 60fps budget. It runs in about six minutes on one machine, and in
CI on every push, split three ways. `npm start` serves the game locally on port 4173 with no dependencies.

`npm run playtest` loads the real rules headlessly and plays complete runs with a bot that
fights, casts at range, retreats when hurt and rests when safe. It reports win rate and average
depth per class, which is how the balance below was tuned rather than guessed at. Runs take
each class's two paths in turn and report how each did; `HEROPATH=knight` (or any path) forces
one. `npm test` runs the headless generator checks, plus a rule suite that loads the real game logic and
exercises the edge cases that are easy to break quietly: enchanted duplicates not merging in the
pack, two-handed weapons stowing the shield, save surviving a JSON round trip with buffs intact,
dropping from a full pack, poison and buffs expiring, the Heart resisting sale, and a trader
charging the right price. The generator checks: every level for a set of seeds and sizes must be solvable
(keys before the doors they open, stairs or artifact reachable), deterministic, and internally
consistent. The sprite sheets are validated too. The same suite runs in GitHub Actions on every
push and pull request.

## Balance

Tuned against the simulator rather than by feel. The bot plays whole runs heading straight
down, with stats placed as the creation screen places them (`FIT=1`), 200 runs per class on
Easy and 400 on Normal and Hard (`SEEDN=40`), where 200 cannot tell the classes apart; the Long Delve rows are 200 runs a class (`LEVELS=12 SEEDN=20`). Normal and Hard are the mean of two seed sets (`SEEDPFX=alt` for the second), since one set alone swings a class by five points or more; the Long Delve rows, measured after the lich's change, are one set, so read them loosely. All four rows were measured again with capstones, oils, charms, traders' jobs and the Goblin Warlord at the end of the Warrens (the bot takes each capstone in turn, buys and uses oils and charms, takes every job, and goes down each road on half its seeds):

| Difficulty | Cleric | Fighter | Mage | Thief | Ranger | Druid | Overall |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Easy | 98% | 96% | 96% | 96% | 97% | 98% | about 97% |
| Normal | 81% | 80% | 79% | 79% | 84% | 81% | about 81% |
| Hard | 53% | 56% | 59% | 57% | 61% | 59% | about 57% |
| Long Delve (12 floors), Normal | 83% | 85% | 81% | 85% | 78% | 83% | about 82% |
| Long Delve (12 floors), Hard | 57% | 62% | 58% | 55% | 62% | 53% | about 58% |

The Druid's Normal and Hard rows are 400 runs each, two seed sets of 200 (`SEEDN=20`); its Easy
and Long Delve rows are one set of 200. The overall figures are the first five classes'. Its bear
was far too strong at first (96% on Normal, 85% on Hard): a thinner hide, a dearer spell and fewer
spell points brought it into line. The Grovewarden once leaned on a companion that a third of
runs do not keep, and trailed the Shapeshifter on Hard by over twenty points; its skin now takes
the bark's grain (2 better armour class, companion or none). Once the bot also roots foes with
Entangle, the two paths are within a few points of each other on Normal and Hard (on Hard about
72% and 76%). The wolf that meets a druid in a delve with no hound was measured after: it
leaves the Druid where it was (Normal about 82%, Hard about 64%).

Hard's aim is the high fifties, and every class lands within about six points of it: the
cleric lowest, the ranger highest. (The Hard row was measured again, both seed sets, after the
dungeon began to answer the elements and goblins took to throwing fire: since it was last
measured the cleric has slipped about four points, and the druid and ranger a few; the mage,
whose Pyromancer now reaches three squares with Burning Hands, is where it was.) Oils, charms, capstones and traders' jobs lifted it to about
61%, and its creatures were made a little sturdier (1.9 times as drawn, not 1.8) to bring it
back; the bot uses every one of those tools, which a player will not always, so it was brought
back to where it stood before them rather than to half. (It was once tuned to 42%, and later to
about half.)

The Long Delve on Hard is where the classes spread widest. The casters used to die on its deep
floors (8 to 12), winning 33% and 34%; since spells strike and heal harder there, floor by floor,
and a cleric's blows with them, they sit with the rest. The thief keeps its lead however the
back half is made harder (tried: the lich's growth, when the deep floors turn surer, how much
sturdier they get, capping the thief's dodge). The ranger's figure is the noisiest: seed sets
have given it anything from 37% to 62%. It trailed at about 43% until the deep floors got
monsters of their own (the blink hound, the quillback and the cave wyrm), whose tricks a bow
answers well; over three seed sets it now wins about 49% with no help, and giving its blows
the fighter's growth as well (2% or 4% a floor) put it near 55%, past the rest, so it has none. The fighter trailed there at 37%, with no spell to grow with the floors, until a fighter's blows grew 4% a floor from the seventh, as a spell does 6%. Measured again with capstones, oils, charms, jobs, the Warlord and Hard's sturdier creatures, the fighter and the ranger lead there and the thief trails, all within about seven points.

The hound (floor 2, on about two seeds in three; the bot always takes it) is worth three or four
points everywhere: without it the same build wins about 74% on Normal, 51% on Hard, 74% and 53%
on the Long Delve. Most of that is the early floors, where it takes blows meant for the hero; a
thinner hound that fell in most runs gave nearly as much, so it is kept worth having rather than
worn down to nothing.

Answering monster tricks decides runs: a warned blow lands whatever your armour, so a bot that
ignores every warning (`NOREACT=1`) wins roughly twenty to thirty points less on Normal.
Clearing each floor first (`EXPLORE=0.8`) is the slower, safer road: on Normal it wins about
84% as a cleric, 90% as a fighter, 86% as a thief, and 70% as a mage. About one hero in twelve
who reaches the last floor on Normal dies there, about half of them to the lich itself (`LICH=1`
breaks it down). It used to be fewer than one in thirty to the lich, the rest to the floor's
ordinary creatures on the way; now the lich hits surer and harder than its floor, and its floor
holds a quarter fewer of the rest, so the last fight is the lich and the win rates held. A fallen hero's shade
(`SHADE=4` plants one on floor 4) kills about one in a hundred of the heroes who meet it, and win
rates barely move: it is a hard fight for gear worth having, not a trap. Gold carried past the last trader, and found on the
last floor, buys a ward or a blessing at the vigil lamp beside the lich's hall. Backgrounds are
rotated across runs so the figures are not one perk repeated. `DODGE=1` has the bot step back from
every ordinary blow, as a twitchy player does, and `DODGE=2` steps aside from the monsters that lunge;
stepping back still pays, but no longer beats everything. The bot is a steady player, not a
great one: it does not step back from ordinary blows, so a careful human does better.

The bot is a mediocre player, so a human should do considerably better; the mage trails on Hard
mostly because the bot kites badly, which is exactly what a mage lives on. The
test suite guards the arithmetic that matters: the boss fight must be winnable by a level 8
fighter in chain mail with a plain long sword, with a 25% margin, and every class must have a
weapon that reaches at range.

Flat damage bonuses from strength and experience scale with how long a weapon takes to swing, so
melee arms land within a couple of points of each other on damage per second rather than the
fastest weapon always winning. Missile weapons sit deliberately below them, paying for reach.
Thieves are the exception: their bonus comes from dexterity and ignores swing weight, which is
what finesse means. A ranger's Steady Aim (+1 two squares off) is for bows and slings only, and
the pack's figure counts it: it used to come with throwing knives too, so the bot (and the pack's
comparison) chose knives, and a ranger that really held a bow on its long reach with the old +2
won about 64% on Hard against the others' 57 to 59.

## Controls

| Action | Touch | Keyboard |
| --- | --- | --- |
| Step forward / back | ▲ / ▼ (hold to keep walking) | W / S or arrows |
| Turn left / right | ↶ / ↷ | A / D |
| Sidestep | ◀ / ▶ | Q / E |
| Attack the square ahead | Attack | Space or F |
| Use (doors, stairs, pick up, search wall, drink, break a barrel) | Use or tap the view | U |
| Turn or step by gesture | swipe the view | |
| Cast the last spell, or the class's own move (Bash, Smoke, Snare) | the button under Use | C |
| Rest | Rest | R |
| Drink a healing potion | the bottle by the life bar | X |
| Read a scroll worth reading now | the scroll at the end of the log | Z |
| Map, Pack, Spells, Hero, Journal | bottom bar | M, I, P, H, J |
| Menu / close | Menu, or the phone's back gesture | Esc |

Walking into doors opens them, walking into locked doors uses a matching key, and walking into
a staircase takes it.

## Project layout

```
index.html        app shell, loads one module
css/style.css     mobile-first styles
js/rng.js         seeded PRNG
js/data.js        classes, items, monsters, spells, themes, pixel art
js/assets.js      procedural textures and sprite rasterisation
js/dungeon.js     level generator
js/renderer.js    canvas raycaster
js/sound.js       WebAudio sound effects
js/music.js       music composed as it plays, following the fight
js/game.js        rules, state, save/load
js/foes.js        monsters: waking, moving, striking, signature moves, the lich, champions
js/ui.js          screens, overlays, touch and keyboard input
js/daily.js       the Daily Delve: the day's hero, the one try, the streak
js/main.js        entry point, game loop, debug surface
js/types.js       JSDoc shapes for the type checker
sw.js             offline cache
manifest.json     PWA manifest
vercel.json       Vercel headers
test/harness.js   loads the game's modules into Node
test/run.js       generator, sprite and balance checks
test/rules.js     rule-level regression checks
test/browser/     Playwright suites
test/server.js    dependency-free static server
```

## License

MIT. See [LICENSE](LICENSE).
