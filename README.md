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
- **A story you descend into.** An opening sets up the valley above Karrathal and what went wrong
  beneath it. Each of the eight levels holds one page left by the guild crews who went first, and
  the Journal collects them as the account of what actually happened down there assembles itself.
- **Eight backgrounds.** The Oathbroken, Tombwise, Ashborn, Cloistered, Deep-born and Debtor. Each
  gives a lasting advantage, a paragraph of the opening, and the line your run closes on. Two more
  are earned: The Returned opens after any win on Normal or Hard, The Heartsworn after a win on
  Hard. The Daily Delve only ever deals the first six.
- **Trophies and a relic codex.** Progress that outlasts a run, kept on the device under one key.
  Each class earns a trophy for each difficulty it wins (twelve in all, daily runs included),
  shown as a grid at the top of the Hall of Heroes, and the victory screen says when one is new.
  Every relic any hero picks up or buys goes in the codex, readable from the Hall or the
  Journal's Relics tab; the rest show only whether they are a weapon, armour or a shield.
- **A choice at every level.** A small lesson at most levels, three offered at a time; on every even level a class talent instead, one of three from the class's six, each changing how the class fights.
  Ability gains can be taken repeatedly; the permanent perks only once.
- **A path at level 5.** Each class chooses one of two paths, for good, in place of that level's
  lesson: Knight or Berserker, Templar or Healer, Pyromancer or Frostweaver, Assassin or Trickster.
  Each changes two or three rules (a shield that catches blows, rage that grows with your wounds,
  fire that keeps burning, a slip aside from a blow) and some give something up for it. The path
  is on the Hero sheet, the end screen and the Hall of Heroes.
- **Five classes** with AD&D-flavoured rules: Fighter, Cleric, Mage, Thief, Ranger. Six ability scores
  (4d6 drop lowest), hit dice, armour class, to-hit progression, class weapon and armour limits,
  experience levels up to 12. Each has its own way to stay alive: fighters are hardy and recover
  faster, clerics heal, mages kill at range, thieves dodge, crit often and backstab.
- **Melee and missile arms.** Throwing knives, slings and bows reach down a corridor, so archers
  and casters are not the only ones with an answer at range. Monsters move faster than they
  swing, so a missile weapon buys you a few shots rather than an endless retreat.
- **Real-time combat.** Monsters wake, path toward you and attack on their own clocks. A door
  pulled shut matters: whatever has hands opens it, but beasts must batter it down over several
  seconds (you hear every blow), and ogres, trolls and minotaurs smash it to splinters, for good. Eighteen monster types, and six named champions, including undead, poisoners, a regenerating troll, a
  basilisk whose gaze turns whoever meets it to stone, a rustmaw that eats your armour's
  enchantment, and a life-draining boss guarding the artifact on the deepest level. Which of
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
- **A trader in the dark.** A hooded merchant sets up shop on about two levels in five, selling
  potions, scrolls, food and the odd weapon, and buying whatever you do not want at about half
  its worth. Buying something identifies it. Gold you never spend is just a number on your
  gravestone.
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
  spiders, zombies and trolls burn well; the dead barely feel the cold; rustmaws and bats draw the
  lightning). The first hit that finds out says so and the bestiary keeps it. The wraith's touch
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
npm run test:browser  # 101 Playwright tests against a real browser
npm run test:all      # both
npm run playtest      # 160 simulated runs, reports win rate by class
```

The browser suite drives the real game in headless Chromium: the core loop, dungeon features,
the trader, the story layer, the endgame, and an interface pass that asserts every
control clears the 44px touch guideline, that readable text clears 4.5:1 contrast, and that a
crowded level renders inside a 60fps budget. It runs in about three minutes, and in CI on every
push. `npm start` serves the game locally on port 4173 with no dependencies.

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
Easy and 400 on Normal and Hard (`SEEDN=40`), where 200 cannot tell the classes apart; the Long Delve rows are 200 runs a class (`LEVELS=12 SEEDN=20`):

| Difficulty | Cleric | Fighter | Mage | Thief | Ranger | Overall |
| --- | --- | --- | --- | --- | --- | --- |
| Easy | 98% | 96% | 96% | 96% | 97% | about 97% |
| Normal | 78% | 76% | 72% | 73% | 71% | about 74% |
| Hard | 50% | 51% | 48% | 52% | 52% | about 51% |
| Long Delve (12 floors), Normal | 66% | 69% | 63% | 75% | 71% | about 69% |
| Long Delve (12 floors), Hard | 33% | 47% | 34% | 57% | 48% | about 44% |

On a second seed set (`SEEDPFX=alt`) Hard reads 43%, 49%, 45%, 59% and 50%: about 50% over both.
The Long Delve on Hard is the one place the classes spread wide. The casters die on its deep
floors (8 to 12) to trolls, ogres, wraiths and minotaurs; the thief keeps its lead there
however the back half is made harder (tried: the lich's growth, when the deep floors turn
surer, how much sturdier they get, capping the thief's dodge).

Answering monster tricks decides runs: a warned blow lands whatever your armour, so a bot that
ignores every warning (`NOREACT=1`) wins roughly twenty to thirty points less on Normal.
Clearing each floor first (`EXPLORE=0.8`) is the slower, safer road: on Normal it wins about
84% as a cleric, 90% as a fighter, 86% as a thief, and 70% as a mage. About one hero in twelve
who reaches the last floor on Normal dies there (`LICH=1` breaks it down). Gold carried past the last trader, and found on the
last floor, buys a ward or a blessing at the vigil lamp beside the lich's hall. Backgrounds are
rotated across runs so the figures are not one perk repeated. `DODGE=1` has the bot step back from
every ordinary blow, as a twitchy player does, and `DODGE=2` steps aside from the monsters that lunge;
stepping back still pays, but no longer beats everything. The bot is a steady player, not a
great one: it does not step back from ordinary blows, so a careful human does better.

The bot is a mediocre player, so a human should do considerably better; the mage and thief lag
mostly because the bot kites and sneaks badly, which is exactly what those classes live on. The
test suite guards the arithmetic that matters: the boss fight must be winnable by a level 8
fighter in chain mail with a plain long sword, with a 25% margin, and every class must have a
weapon that reaches at range.

Flat damage bonuses from strength and experience scale with how long a weapon takes to swing, so
melee arms land within a couple of points of each other on damage per second rather than the
fastest weapon always winning. Missile weapons sit deliberately below them, paying for reach.
Thieves are the exception: their bonus comes from dexterity and ignores swing weight, which is
what finesse means.

## Controls

| Action | Touch | Keyboard |
| --- | --- | --- |
| Step forward / back | ▲ / ▼ (hold to keep walking) | W / S or arrows |
| Turn left / right | ↶ / ↷ | A / D |
| Sidestep | ◀ / ▶ | Q / E |
| Attack the square ahead | Attack | Space or F |
| Use (doors, stairs, pick up, search wall, drink) | Use or tap the view | U |
| Turn or step by gesture | swipe the view | |
| Cast last spell | Cast | C |
| Rest | Rest | R |
| Drink a healing potion | Cast (fighter, thief) or the bottle by the life bar (mage, cleric) | X |
| Map, Pack, Spells, Hero, Journal | bottom bar | M, I, P, H, J |
| Menu / close | Menu | Esc |

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
