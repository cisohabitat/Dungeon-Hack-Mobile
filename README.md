# Deepdelve

A first-person, real-time dungeon crawler for mobile browsers, built in the spirit of the
1993 seed-generated dungeon classics. Pick a class, roll your stats, type a seed, and descend.

**Play it:** deploy to Vercel (see below) or run locally with any static file server.

## Features

- **Seeded dungeons.** Every level is generated from your seed string, so the same seed always
  gives the same dungeon. Share seeds with friends.
- **Customisable descent.** Choose the number of levels (4 to 16), map size, monster density,
  treasure density, locked doors and keys, traps, and permadeath, just like the original's
  dungeon-customisation screen.
- **Four classes** with AD&D-flavoured rules: Fighter, Cleric, Mage, Thief. Six ability scores
  (4d6 drop lowest), hit dice, armour class, to-hit progression, class weapon and armour limits,
  experience levels up to 12.
- **Real-time combat.** Monsters wake, path toward you, open doors, and attack on their own
  clocks. Fourteen monster types including undead, poisoners, a regenerating troll and a
  life-draining boss guarding the artifact on the deepest level.
- **Magic.** Mage and Cleric spell lists (bolts, buffs, heals) with spell points, plus scrolls
  anyone can read.
- **Items.** Weapons, armour and shields with enchantments, potions, scrolls, food, gems, gold,
  and colour-coded keys for locked doors.
- **Survival.** Hunger, poison, traps in corridors, resting that costs food and is blocked by
  nearby enemies.
- **Automap** of explored areas, four-line message log, save/load to local storage with
  autosave on every level change.
- **Mobile first.** Big touch d-pad with hold-to-walk, portrait and landscape layouts, safe-area
  aware, installable as a PWA with offline support. Keyboard controls on desktop.

Everything is original: the raycast renderer, procedural wall textures, pixel-art sprites and
sound effects are all generated in code. No external assets or dependencies.

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
npm test
```

Runs the headless generator checks: every level for a set of seeds and sizes must be solvable
(keys before the doors they open, stairs or artifact reachable), deterministic, and internally
consistent. The sprite sheets are validated too.

## Controls

| Action | Touch | Keyboard |
| --- | --- | --- |
| Step forward / back | ▲ / ▼ (hold to keep walking) | W / S or arrows |
| Turn left / right | ↶ / ↷ | A / D |
| Sidestep | ◀ / ▶ | Q / E |
| Attack the square ahead | Attack | Space or F |
| Use (doors, stairs, pick up, close door) | Use | U |
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
