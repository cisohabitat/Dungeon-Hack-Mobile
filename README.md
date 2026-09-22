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
  dungeon-customisation screen.
- **Four classes** with AD&D-flavoured rules: Fighter, Cleric, Mage, Thief. Six ability scores
  (4d6 drop lowest), hit dice, armour class, to-hit progression, class weapon and armour limits,
  experience levels up to 12. Each has its own way to stay alive: fighters are hardy and recover
  faster, clerics heal, mages kill at range, thieves dodge, crit often and backstab.
- **Melee and missile arms.** Throwing knives, slings and bows reach down a corridor, so archers
  and casters are not the only ones with an answer at range. Monsters move faster than they
  swing, so a missile weapon buys you a few shots rather than an endless retreat.
- **Real-time combat.** Monsters wake, path toward you, open doors, and attack on their own
  clocks. Fourteen monster types including undead, poisoners, a regenerating troll and a
  life-draining boss guarding the artifact on the deepest level.
- **Magic.** Mage and Cleric spell lists (bolts, buffs, heals) with spell points, plus scrolls
  anyone can read.
- **Items.** Weapons, armour and shields with enchantments, potions, scrolls, food, gems, gold,
  and colour-coded keys for locked doors.
- **Survival.** Hunger, poison, traps in corridors, resting that costs food and is blocked by
  nearby enemies.
- **A real endgame.** Taking the Heart of the Mountain does not end the run. Every dead thing in
  the mountain wakes, the dark starts producing pursuers, and you must climb all the way back to
  level 1 and out. Your escape time is recorded.
- **Unknown potions and scrolls.** Every dungeon shuffles appearances, so a "cloudy potion" is
  a different draught in each seed. Drink or read it to learn what it is.
- **Champions.** Feral, Armoured, Ancient and Rabid monsters appear more often as you descend.
  They hit harder, take more killing, and always drop something worth having.
- **Torchlit halls.** Wall brackets cast real pools of light across floors, walls and monsters.
- **Secrets.** Hidden doors lead to treasure vaults. Search suspicious walls, or play a Thief and
  spot them in passing. Wall fountains restore you fully, once per fountain.
- **Ranged foes.** Goblin archers and dark acolytes attack down corridors, so cover matters.
  Wounded monsters break and flee, and a strong character can shoulder a locked door open.
- **Automap** of explored areas plus a live corner minimap, message log with full history,
  monster health bars, save/load to local storage with autosave on every level change, and a
  Hall of Heroes that remembers your best runs. The pack compares any weapon or armour against
  what you are already wearing, in damage per second or armour class.
- **Sound.** A low drone under the dungeon that tightens during the escape, and your own
  heartbeat once you are badly wounded.
- **A living title screen.** The menu sits over a real generated dungeon with a ghost camera
  walking it, drawn by the same raycaster as the game, with drifting embers and torch flicker.
- **Mobile first.** Big touch d-pad with hold-to-walk, swipe on the view to turn or step, tap
  it to act, haptic feedback, portrait and landscape layouts, safe-area aware, installable as a
  PWA with offline support. Keyboard controls on desktop.

Everything is original: the raycast renderer with textured floors and ceilings, procedural
wall textures, pixel-art sprites and sound effects are all generated in code. No external
assets or dependencies.

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
npm test          # generator, sprite and balance checks
npm run playtest  # 240 simulated runs, reports win rate by class
```

`npm run playtest` loads the real rules headlessly and plays complete runs with a bot that
fights, casts at range, retreats when hurt and rests when safe. It reports win rate and average
depth per class, which is how the balance below was tuned rather than guessed at. `npm test`
runs the headless generator checks: every level for a set of seeds and sizes must be solvable
(keys before the doors they open, stairs or artifact reachable), deterministic, and internally
consistent. The sprite sheets are validated too. The same suite runs in GitHub Actions on every
push and pull request.

## Balance

Tuned against the simulator rather than by feel. Over 240 bot runs on a fixed seed set:

| Class | Win rate | Average depth reached |
| --- | --- | --- |
| Fighter | 27% | 5.5 |
| Cleric | 43% | 4.8 |
| Mage | 20% | 4.4 |
| Thief | 22% | 4.8 |
| **Overall** | **28%** | **4.9** |

The bot is a mediocre player, so a human should do considerably better. The test suite guards the
arithmetic that matters: the boss fight must be winnable by a level 8 fighter in chain mail with a
plain long sword, with a 25% margin, and every class must have a weapon that reaches at range.

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
| Map, Pack, Spells, Hero | bottom bar | M, I, P, H |
| Menu / close | Menu | Esc |

Walking into doors opens them, walking into locked doors uses a matching key, and walking into
a staircase takes it.

## Project layout

```
index.html        app shell
css/style.css     mobile-first styles
js/rng.js         seeded PRNG
js/data.js        classes, items, monsters, spells, themes, pixel art
js/assets.js      procedural textures and sprite rasterisation
js/dungeon.js     level generator
js/renderer.js    canvas raycaster
js/sound.js       WebAudio sound effects
js/game.js        rules, state, AI, save/load
js/ui.js          screens, overlays, touch and keyboard input
js/main.js        bootstrap and game loop
sw.js             offline cache
manifest.json     PWA manifest
vercel.json       Vercel headers
test/run.js       headless generator tests
```

## License

MIT
