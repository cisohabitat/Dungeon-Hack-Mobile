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

**Reports (optional)**

Players can turn on **Send reports** in the Menu: a short note when a run ends and when
something breaks, with nothing that names them. The notes go to `api/telemetry.js`, a Vercel
function that counts them in an Upstash Redis database; `dashboard.html` shows real players'
win rates beside the bot's figures in the balance table below. To switch the store on, add the
**Upstash for Redis** integration to the project from Vercel's Marketplace (it sets
`KV_REST_API_URL` and `KV_REST_API_TOKEN`), or set `UPSTASH_REDIS_REST_URL` and
`UPSTASH_REDIS_REST_TOKEN` by hand, and redeploy. Without them the function answers and keeps
nothing, and the dashboard says no store is set up.

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
npm test              # typecheck, then generator, sprite, report-endpoint and rule checks
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
Easy and 400 on Normal and Hard (`SEEDN=40`), where 200 cannot tell the classes apart; the Long Delve rows are 200 runs a class (`LEVELS=12 SEEDN=20`, or `LEVELS=16` for sixteen floors). Normal and Hard are the mean of two seed sets (`SEEDPFX=alt` for the second), since one set alone swings a class by five points or more; so is the Long Delve on Hard; the Long Delve on Normal is too, since the deep floors came in. All four rows were measured again with capstones, oils, charms, traders' jobs and the Goblin Warlord at the end of the Warrens (the bot takes each capstone in turn, buys and uses oils and charms, takes every job, and goes down each road on half its seeds):

| Difficulty | Cleric | Fighter | Mage | Thief | Ranger | Druid | Overall |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Easy | 99% | 98% | 98% | 97% | 97% | 98% | about 98% |
| Normal | 78.5% | 80% | 80.5% | 83% | 78.5% | 80.5% | about 80% |
| Hard | 56.5% | 56.5% | 61.5% | 60.5% | 61% | 62% | about 59.5% |
| Long Delve (12 floors), Normal | 84% | 84.5% | 83.5% | 82% | 81% | 85% | about 83% |
| Long Delve (12 floors), Hard | 65.5% | 58% | 63% | 63% | 60% | 63% | about 62% |
| Long Delve (16 floors), Normal | 81% | 77.5% | 77.5% | 85% | 82% | 78% | about 80% |
| Long Delve (16 floors), Hard | 58% | 50% | 50% | 54% | 56.5% | 56% | about 54% |
| Quick delve (2 floors), Normal | 92% | 83% | 97% | 72.5% | 88% | 94.5% | about 88% |

Every row is played on Medium floors. Small and Large were measured on eight Normal floors, both
seed sets (`SIZE=small|large`), with the floors as they now are: a large floor holds about a third
more locks, traps and hidden rooms and half again as many encounters (three a floor at most), its corridors wander and turn
as often as a medium floor's, and a long straight one has a recess cut in its side; a small floor
has a lesser great hall, two loops at least, and fewer locks and traps. Medium floors come out
square for square as they were, so its row stands:

| Floor size, Normal | Cleric | Fighter | Mage | Thief | Ranger | Druid | Overall | Kills | Level at the end |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Small (28 squares a side) | 77.5% | 78% | 79% | 76% | 79.5% | 74% | about 77% | 34 | 7.5 |
| Medium (36) | 79% | 80% | 80.5% | 83% | 79% | 80% | about 80% | 50 | 8.1 |
| Large (44) | 76.5% | 83% | 80.5% | 82% | 81% | 78% | about 80% | 66 | 8.6 |

The fighter, then the lowest on Normal at every size (75.5% on Medium, measured again the same day,
70% on Small), now starts with three more hit points on Easy and Normal, as the thief, the ranger and
the druid do on every difficulty: 80% on Medium, 78% on Small, 83% on Large, 84.5% and 77.5% on twelve
and sixteen floors, and the quick delve as it was (83.5%, 84.5% before). Not on Hard, where it ran
level with the rest (58.5%) and the same three took it to 68.5%. It still dies more often than the
others with healing draughts unused: what kills it comes in one heavy blow more than a long fight.

A small floor first had fewer hidden rooms and encounters too, by its floor space: it came to 71.5%,
its heroes a third of a level lower again, so it keeps the middle size's (with fewer encounters only
75%, with fewer hidden rooms only 73%). Before any of this, Small was about 77% and Large about 80%,
Large with the classes spread from 70% (the fighter) to 87.5% (the ranger); now 76.5% to 82%. That
spread was not the long straight corridors it looked to be: a large floor has no more long
sightlines for its floor space than a medium one (about three lines of nine squares or more to a
hundred squares of floor, on both), and its longest corridors were no longer than a medium floor's.

With the bot mended, two levers were moved, each measured on both seed sets. The mage's spells on
a Hard Long Delve of twelve floors grow 4% a floor past the sixth, not 6% (the mage 68% before,
63% after; sixteen floors keep 6%, where two peoples ride spells out). And a sixteen-floor delve,
which goes four floors deeper than any other, now lifts its heroes below the twelfth floor on every
difficulty, as Hard already did from the seventh: spells and a cleric's blows 6% a floor, a
fighter's blows and a druid's 4%. On Normal the casters had died there where the thief did not
(the mage 66%, the druid 63%, the thief 86%); after it the cleric won 81% (74% before), the mage
73% (66%), the fighter 73% (70%) and the druid 70.5% (63%).

The Cleric, Mage and Druid columns were measured again, both seed sets, after a fault in the bot
was found: a caster with a bolt to spend would aim it at a mimic still shut, which the game will
not take as a mark, and stood casting at it until the run ran out of time. A run that times out
counts as a loss, and it had happened in one mage run in eight on a Long Delve (24 of 200), a few
on eight floors and on sixteen, and now and then to the druid and the cleric. With the mimic left
alone the mage on the Long Delve is among the strongest classes there, not one of the weakest: 68%
on Hard and 83.5% on Normal where the table had 62% and 72%. Part of each move is also drift since those
rows were last taken; the fighter, thief and ranger, who never cast a bolt, were not played again.

The sixteen-floor rows are new, both seed sets, measured once the delve passed three peoples: the
lizardfolk's Sunless Marsh on the fifth floor (warriors whose tail sweep knocks a hero flat, shamans
who mend them and call lightning into the water that stands in every room, and Hissra, the
Marsh-Mother), the grey dwarves' Grey Hold on the eleventh (stout now: poison never takes on them,
and they ride out a spell more often), and the dark elves on the fourteenth. On Hard the fighter
went from 53.5% (before the marsh, on the first set) to 49.5%. On Hard the spread across the classes is eight. The bot now steps back from a grey dwarf grown to twice its
height whenever a square is open (`NOROOM=1` stands its ground): it made no difference worth the
name, the fighter 50.25% with it and 51.25% without, the mage (before the mimic was mended) 47.25%
and 46.25%.

Renown (a rank every 1500 experience past level 12, each a small gain) left the rows as they
were. The top level comes late: in a sixteen-floor delve on Normal the bot's heroes reach it on the
fifteenth floor or so (two in three fighters, eight in ten mages), with some 5,000 experience over by
the end, so a hero takes about three ranks, nearly all on the last floors. On the second seed set, 50
runs each, the fighter won 68% before and after and the mage 86% before and after. On twelve floors no
hero reaches the top level (the fighter ends at 9.8 on average), so renown is a sixteen-floor thing.
`DETAIL=1` prints, for each class, how many runs reached the top level, on which floor, the experience
over, and the ranks taken.

The thief on sixteen floors on Normal was the outlier, 88% and 87% on the two seed sets (87.5%) where the
classes together won 77.5%, and the Assassin five to eight points over the Trickster. Past the sixth
floor of sixteen, on Normal or Easy, a sneak blow is now one less: 84% and 85.5% (84.75%), the two paths
within a few points of each other. From the thirteenth floor only, the same trim was worth one point. A thief
with no talent, path or relic to add to it strikes there as any blow does, and the log no longer
calls it a sneak blow; holding the sneak blow at a double there undid the trim (87.75%), so it stays.

And from the other end: the fighter, the mage and the druid on sixteen floors on Normal, measured again
on both seed sets at 200 runs each, won 72.25%, 74.5% and 71%. The deep's lift (spells 6% a floor, a
fighter's blows and a druid's 4%) now begins for those three past the tenth floor rather than the
twelfth: 75%, 77.5% and 75%. The spread across the classes there went from fourteen points to ten.

The bot dies now and then with healing draughts still in its pack, four or six or ten of them, and it
looked as if it drank too late: it drinks below 35% of its life. Two rules that drank sooner were
tried on the same seeds, 200 runs each on eight Normal floors. Drinking at half its life whenever it
carried three, and while the worst blow taken on the floor could kill it: the cleric fell from 80% to
77%, the fighter from 80% to 73%. Only the second: 77% and 76.5%. A draught drunk with a foe beside it
is a turn not spent finishing it, and the deaths with full packs are mostly a hero held (flat on the
floor, stone, frozen) or taken from a third of their life in one blow. The old rule stands, and the
rows above with it.

Measured again with the old rule, the thief, the ranger and the druid were left behind on eight Normal
floors (77.25%, 73% and 73.75%, both seed sets, 200 runs each), and the thief on two floors most of all
(62.25%, where every other class won 87% or more; the Dread Lich killed nearly all of them, at hero
levels two to six, often with draughts in the pack). Now the thief sets out with a second healing
draught (as a ranger does) and three more hit points, and its smoke holds the lich and the Goblin
Warlord, who see through it, for most of two seconds rather than a moment; the ranger sets out with
three more hit points; the druid with three more, and its spell points at the full measure (0.85 of it
before). Eight Normal floors: thief 83.5%, ranger 76%, druid 82.25%; eight Hard floors: 60.75% (from
57.75%), 64.5% (from 60.5%), 57.5% (from 54.25%); two floors, the thief 71.75%. The druid's Long Delve
rows are one seed set (86%, 67.5%, 78%, 56%). The thief's and the ranger's few more hit points at the
start barely touch a long delve (the thief on sixteen Normal floors, 84%, as it was), so their Long
Delve rows stand. Six more hit points for the thief put it at 86.5% on eight Normal floors: too much.
The ranger stays the lowest on Normal: more hit points lifted Hard more than Normal.

Then, both seed sets throughout: the druid on twelve floors, measured again, 85.25% on Normal and 63.25%
on Hard, near the top but not over it. The ranger's Steady Aim is +2 from three squares off on a delve
of eight floors or fewer on Normal or Easy (+2 from two squares took it to 85.75%, the pack then rating
bows the higher and the bot holding them). The thief's smoke now breaks off what the lich or the
Warlord was drawing back (not the rite): worth a point on two floors, 72.75%, within the noise; the
lich at the end of a short delve is simply more than a thief of level three or four can outlast.
With the three lifts Normal on eight floors had come to 82% and Hard to 60%, so the shorter delves'
creatures are sturdier again, a ninth on Normal (1.04 before) and a twentieth on Hard; the Long Delve,
whose rows had not moved, keeps its own. All six classes measured again with all of it: the eight-floor
and two-floor rows above, Normal about 79% and Hard about 59.5%. The fighter is now the lowest on
Normal, at 74.25%.

The Normal, Hard and Long Delve rows were measured again, both seed sets, with the commit before
played on the same seeds, after saving throws went both ways: a foe can ride out a spell that fills
its square or its corridor (three quarters of it) or tear free of Entangle sooner, and the hero
saves against a wraith's grave-cold, an emberling's flare and lightning through the water. Plain,
the saves cost the bot's mage ten points on Hard (a goblin pack lived through Burning Hands at the
first level; the lich and the Warlord saved nearly half the time) and the druid eight (held half as
long, a foe under Entangle was loose before the druid had mended). So the blasts hit two or three
harder than before, Call Lightning (at one foe only) is never saved against, and a foe that saves
against Entangle is held two thirds as long, never less than a boss. Overall, eight floors on Hard
went from 56.9% to 55.9%, on Normal from 76.9% to 79.1%; the Long Delve on Hard from 60.6% to 60.2%,
on Normal from 78.8% to 79.2%. The druid on the Long Delve on Hard came down from 61% to 54%, but its
61% was one seed set at 65% (the commit before that played it at 57%), and 54% is where that row
has sat before.

Fresh seeds bore the druid's drop out (57% before, 55.5% after, on two sets it had never played),
so Entangle now holds for three and a half seconds rather than three, and Insect Plague bites five
over its dice rather than three. The Druid column is that build, two seed sets of 200 a row, with
the delve before the saves played on the same seeds: eight floors on Hard 54% (53% before), on
Normal 73% (74%); the Long Delve on Normal 76% (79%, its two sets ten points apart), and on Hard,
over four sets, 60% (61.5%).

The Long Delve on Hard was measured again, both seed sets, with the commit before played on the
same seeds, after spells came to slide off the dark elves (a warrior one time in five, a mage one in
four, Vaelith one in three) and a renegade dark elf could be hired two floors above their halls:
the mage 58% before and 57% after, the cleric 65% and 68%, the fighter 56% and 62% (the renegade
at its side, where no hound was). The druid lost three or four points on both sets while
Entangle's roots slid off as well; with the roots exempt, over four seed sets, it won 56.1% before
and 56.5% after. A sixteen-floor delve, which now passes through the grey dwarves' hold on its
eleventh floor, was played on one set before and after: the fighter 49% and 53.5%, the mage 39.5%
and 43.5%, a few more of them falling in the hold and fewer two floors below it.

Both Long Delve rows were measured again, both seed sets, with the commit before them played on
the same seeds, after the tenth floor of twelve became the dark elves' country (their warriors and
mages, and Vaelith, their High Priestess). On Hard the delve won 60.9% before and 60.6% after, every
class within four points of where it was; on Normal 77.0% before and 78.8% after. The first warriors
were quicker, surer and harder-hitting, and killed one thief in six who reached their floor on one
seed set; at Wraith-like numbers (and a guard that answers a blow struck into it) the floor kills
about as many as the floor it replaced.

The Normal and Hard rows were measured again, both seed sets, after the two roads came to build
their own floors (the Crypts cut in niches and galleries, the Warrens dug in burrows) and the last
floor its own hall. A lich asleep at the far end of a long hall was walked up to and struck before
it woke, and almost no one died on the last floor; now it wakes as a hero sets foot in its hall,
and one of the floor's creatures stands guard in the nave (two killed one druid in six who reached
the hall). The last floor now takes about one hero in ten who reach it, as it did before. The new
floors are a little harder on the way down, more creatures reaching the hero at once in the bigger
rooms, and a floor holds about a tenth fewer for it. Normal sits at about 77% (back in the band it
was tuned to before it drifted up to 82%), Hard at about 57%; the ranger and the druid trail on
Normal, at 73% and 74%.

The Normal and Hard rows were measured again after the floors were built anew (rooms of many
shapes, corridors that loop, a set piece on every floor), 200 runs a class on each of the two
seed sets (`SEEDN=20`, then `SEEDPFX=alt`). A floor holds about as many creatures and finds as
before, counted by the floor its rooms cover rather than by how many there are. Normal moved by
about a point and Hard by about two. On the same seeds the old floors gave the cleric 85%, the
thief 78.5% and the druid 81%, so the cleric and the thief are within noise. The druid's drop of
about four points is not certain at 400 runs, and its wolf falls more often in the bigger rooms.
The Long Delve and quick delve rows were not measured again.

The quick delve row is one seed set, 200 runs a class (`LEVELS=2 SEEDN=20`). Two floors at the
pace of eight brought heroes to the lich at the second or third level, and half of them died
there. So on a quick delve the hero learns three times as fast. The lich has three tenths of its
life and strikes four steps less surely, and one skeleton guards its rite in place of a wraith.
That makes it kinder than eight floors, as a short game should be. The thief trails: at the
fourth or fifth level its daggers are short against the lich. With heroes learning only twice as
fast and the wraith still called, it won 58.5% and the mage 92.5%. On Hard the thief wins 68%.

Every row but Easy was measured again, both seed sets, after the Long Delve got a keeper of its
own (the Heartforged), three more things to meet on the deep floors, the Cinder Ring and a healer
to meet on the middle floors. Eight floors came up a point or two, the healer most of it. On the
Long Delve the Heartforged first cost the casters five or six points against the old keepers, and
two things were wrong, neither of them its numbers. Its stamp left its lines burning for longer
than the opening it gave, so taking the opening meant standing in fire; the fire now goes out in
a moment. And the bot's Pyromancer cast Burning Hands at it and its embers, which shrug off fire,
where a player turns to the cold. Taught to reach for what hurts a thing most, the bot's mage
jumped on Hard by about eight points: on eight floors too, its Frostweaver had been casting cold
at the lich, which shrugs that off. The mage's second spell point drawn back from each kill on
Hard and in the Long Delve had been added to make up for a mage that was only being played badly,
and has gone: a mage draws back one everywhere. On eight floors of Hard it still leads, at 64%
(59.5% and 68.8% on the two sets), five points over the rest; the druid's 55.5% on the Long Delve
on Hard is 64% and 47% on the two sets, as it was before this batch.

The Normal and Hard rows were measured again, both seed sets, after the middle floors grew
stranger (mimics, kobold trappers and their snares, floors of tremors, the Lever Door and the Lost
Mule) and the sellsword came to be hired there. Normal barely moved; Hard came down about two
points, the cleric most (61% to 55%), and every class is still within six points of the high
fifties. The Long Delve rows were measured again after it too (Hard on both seed sets, Normal on
one): both came down a few points, the Long Delve on Hard from about 63% to 58%, level with the
eight floors. The druid was lowest there, at 53.5%.

Both Hard rows were measured again, both seed sets, after the deep floors came alive (smouldering
floors and their emberlings, the Forge-Spirit), the druid's bear's claws came to grow with the deep
floors of a Long Delve on Hard as a fighter's blows do, and the sellsword took a whetstone, a wage
below the eighth floor and a cut that breaks a boss's rite. On the Long Delve the druid came up
from about 50% (with the deep floors in, before its claws grew) to 58%, and every class there is
within 56% to 62%. On eight floors Hard barely moved, but for the fighter, down from 56% to 53%
(47.5% and 59% on the two seed sets): lowest, and still inside the six points. Played again on the
commit before these changes it won 54.8% (50.5% and 59%), so the deep floors are not what
took it down: it had drifted there before. Its blows now grow on an eight-floor Hard delve from
the sixth floor, 4% a floor past the fifth, as they do in the deep of a Long Delve: 57.5% over both
seed sets (53.5% and 61.5%; 7% a floor gave 62%), level with the rest.

The Normal row (both seed sets) and the Long Delve on Normal (one set) were measured after it too:
Normal about 80%, every class within 78.5% to 83%; the Long Delve on Normal about 81%, on both seed
sets now, every class within 79% to 84%. (One set alone had the ranger at 75.5% and the druid at
86.5%; the second set put them at 82.5% and 82%.)

The ranger's two paths were far apart on Hard, the Sharpshooter winning about 60% to the Warden's
74% over two seed sets. More damage at range did not close it (61% either way); staying out of
reach did: a Sharpshooter's snare now holds a second and a half longer, and it wins about 67% (a
point of armour instead gave 68%, both 67%), the ranger 63% on Hard, 80% on Normal and 64% on the
Long Delve on Hard (62% and 66.5%; it was 58%), measured again after.

On one seed set the Long Delve on Hard looked wide (the fighter 69%, the ranger 53%); the second
set brought the fighter back to the others, but the ranger was the lowest on both (53% and 56%),
a few points short of the rest on the deep floors. Its shots and blows now grow 2% a floor there
from the seventh, half the fighter's: 57% and 60% on the two sets (3% gave 56% and 65%, noisier
and no surer). The Sharpshooter still trails the Warden there, about 58% to 72%.

The Druid's Normal and Hard rows are 400 runs each, two seed sets of 200 (`SEEDN=20`); its Easy
and Long Delve Normal rows are one set of 200, its Long Delve Hard row two. The overall figures are the first five classes'. Its bear
was far too strong at first (96% on Normal, 85% on Hard): a thinner hide, a dearer spell and fewer
spell points brought it into line. The Grovewarden once leaned on a companion that a third of
runs do not keep, and trailed the Shapeshifter on Hard by over twenty points; its skin now takes
the bark's grain (2 better armour class, companion or none). Once the bot also roots foes with
Entangle, the two paths are within a few points of each other on Normal and Hard (on Hard about
72% and 76%). The wolf that meets a druid in a delve with no hound was measured after: it
leaves the Druid where it was (Normal about 82%, Hard about 64%).

Hard's aim is the high fifties, and every class lands within about six points of it: the
fighter lowest, the cleric and the thief highest. (The Normal and Hard rows were measured again, both seed
sets, after the dungeon began to answer the elements and goblins took to throwing fire. The
cleric had slipped to 53% on Hard; its prayers now take 0.85 seconds, not a second, which brings
it back to 58% (a d10 hit die, tried instead, overshot to 63%). The mage, whose Pyromancer now
reaches three squares with Burning Hands for a point more, is where it was. Every row was
measured again after that; the Hard and Long Delve Hard rows last, with the scenes laid out
for fire, the wraith's grave-cold and the acolyte's lightning, which moved no class beyond
the noise.) Oils, charms, capstones and traders' jobs lifted it to about
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
the fighter's growth as well (2% or 4% a floor) put it near 55%, past the rest then, so it had none (once the rest rose past it, it was given half the fighter's; see above). The fighter trailed there at 37%, with no spell to grow with the floors, until a fighter's blows grew 4% a floor from the seventh, as a spell does 6%. Measured again with capstones, oils, charms, jobs, the Warlord and Hard's sturdier creatures, the fighter and the ranger lead there and the thief trails, all within about seven points.

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
js/assets.js      procedural textures and sprite rasterisation (a creature a piece at a time)
js/walldecor.js   moss, roots, skulls and rings on a theme's walls
js/creatures.js   the creatures built from lit parts, their poses, the one list of them
js/folk.js        the later creatures: traders, companions, the peoples below, deep beasts
js/parts.js       the parts and the kits creatures share
js/painter.js     parts to lit pixels
js/props.js       the encounters' props
js/champions.js   named champions, a shade's gear, the heroes' portraits
js/dungeon.js     level generator
js/renderer.js    canvas raycaster
js/spellfx.js     spells, scrolls, drinks and traps over the view
js/sound.js       WebAudio sound effects
js/music.js       music composed as it plays, following the fight
js/game.js        rules and state; combat, items, powers, pacing, saving and more in their own modules
js/foes.js        monsters: waking, moving, striking, signature moves, the lich, champions
js/ui.js          screens, overlays, touch and keyboard input
js/titlescene.js, shopview.js, choices.js, pack.js, mapview.js, endscreen.js   overlays split from ui.js
js/telemetry.js   opt-in reports
api/              the reports' Vercel functions
dashboard.html    real players' win rates beside the bot's
js/daily.js       the Daily Delve: the day's hero, the one try, the streak
js/main.js        entry point, game loop, debug surface
js/types.js       JSDoc shapes for the type checker
sw.js             offline cache
manifest.json     PWA manifest
vercel.json       Vercel headers
test/harness.js   loads the game's modules into Node
test/run.js       generator, sprite and balance checks
test/api.js       the report functions' checks
test/rules.js     rule-level regression checks
test/browser/     Playwright suites
test/server.js    dependency-free static server
```

## License

MIT. See [LICENSE](LICENSE).
