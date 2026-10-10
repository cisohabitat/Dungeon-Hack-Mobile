# Deepdelve: notes for working on this repo

A first-person, seed-generated dungeon crawler for mobile browsers. Vanilla ES
modules, no build step, no framework. `main` deploys to Vercel as it is.

## Layout

- `js/game.js`: the rules, one IIFE (`Game`). Monster AI lives in `js/foes.js`
  and the traders in `js/trader.js`; both are factories (`makeFoes(K)`,
  `makeTrader(K)`) that borrow from the game through an object of getters `K`,
  wired near the end of `game.js`. The same pattern holds the companion
  (`js/companion.js`), traders' jobs (`js/bounty.js`), the druid's Wild Shape
  and Entangle (`js/wild.js`), the encounters' engine (`js/meet.js`) and the
  elements acting on the place: fire, ice, oil, water (`js/elements.js`).
  The rest of the rules sit in the same kind of factory, wired just before
  `game.js` returns its API: combat and groups (`js/combat.js`), items and the
  pack (`js/items.js`), spells and class moves (`js/powers.js`), curses and
  hidden quality (`js/curses.js`), difficulty, resting and the deep floors'
  scaling (`js/pacing.js`), the end, run numbers and bestiary
  (`js/chronicle.js`), the fallen hero's bones and shade (`js/fallen.js`),
  what a fight leaves behind and fire scenes (`js/scenes.js`), the render
  state and motion (`js/motion.js`), and saving (`js/saving.js`). A factory
  reads `game.js`'s changing state live through `K` (`K.G`, never a copy of
  `G`), and a constant two factories share stays in `game.js`. A factory may
  copy a value from `K` when it is made only if that value is already settled
  by then: one made later, or one living in a factory wired after it, must be
  read through `K` at the moment of use.
- `js/dungeon.js`: level generation, deterministic per `(seed, depth)`. Plans
  for a whole run (`namedPlan`, `twistPlan`, `piecePlan`) use their own `Rng`
  streams so they never shift the map's dice. Room shapes and the set pieces
  (cells, shrine, cistern, rubble) are drawn in `js/rooms.js`; corridors join
  the rooms as a tree plus a few loops, dug by a cheapest-path search.
- `js/data.js`: classes, items, monsters, spells, talents, paths, names.
  `js/relics.js`, `js/encounters.js`: relics and encounter data.
- `js/ui.js`: every screen and overlay; the Hall, bestiary and relic codex are in
  `js/hall.js`, and small DOM helpers in `js/uikit.js`. Some overlays are factories
  wired at the end of `ui.js` in the same `K` pattern: the title's scene
  (`js/titlescene.js`), the trader (`js/shopview.js`), an encounter's and a level's
  choices (`js/choices.js`), the pack (`js/pack.js`), the map (`js/mapview.js`),
  the spell list and hero sheet (`js/herosheet.js`) and the end of a run (`js/endscreen.js`).
- `js/renderer.js`: the 3D view; the spells', scrolls', drinks' and traps' effects
  over it are in `js/spellfx.js`.
- `js/creatures.js`: the creatures drawn from parts, their poses, and the one list
  of them all; the later creatures are in `js/folk.js`, the parts and shared kits
  in `js/parts.js`, the painter in `js/painter.js`, the encounters' props in
  `js/props.js`, and the champions, a shade's gear and the portraits in
  `js/champions.js`. `js/assets.js` turns them into sprites (a creature a piece at
  a time, in spare moments) and paints the walls, floors and doors; the wall
  decorations are in `js/walldecor.js`.
- No file in `js/` is over 2,000 lines; split one that grows past it.
- `js/types.js`: JSDoc types, checked by `tsc` (`checkJs`).
- `js/telemetry.js`: opt-in reports (a run's end, a crash), off unless turned on
  in the Menu. `api/telemetry.js` and `api/stats.js` are the Vercel functions
  that keep and count them (checked by `test/api.js`); `dashboard.html` shows
  them beside the README balance table, which it reads as it stands.
- `art/keyart/`: the title's key art. `REQUEST.md` is the brief for whoever makes it
  (an artist or an image tool); the finished images and their `SOURCES.md` land there.
- `ROADMAP.md`: the phased plan towards an AAA feel; check it before starting
  a large piece of work, and tick items off as they land.
- `sw.js`: offline cache. A new module must be added to `ASSETS` (test/run.js
  checks this); bump `CACHE` when the list changes.

## Checks (run all before every push)

- `npx tsc --noEmit -p .`
- `node test/run.js`: generator and level checks.
- `node test/rules.js`: rule checks, about 4 minutes; must end
  `rule checks complete, 0 failure(s)`. `ONLY="part of a test name"` runs a subset.
- `npx playwright test --project=phone`: browser tests (phone viewport), about 5 minutes.
  Chromium is preinstalled; do not run `playwright install` locally.
- `PERF=1 npx playwright test --project=perf --workers=1`: the frame-rate
  budget (`test/browser/perf.spec.js`), 4x CPU throttle, about 40 seconds. It
  skips without `PERF=1`, since beside other tests it measures the load.
- `npx playwright test --project=small`: the interface, play and accessibility
  specs again at iPhone SE size (the device matrix, `docs/DEVICES.md`).
- `test/browser/a11y.spec.js` runs axe over every screen and overlay: no fault
  rated serious or critical. A new overlay goes into it.
- CI (`.github/workflows/test.yml`) runs `npm test`, the browser tests in
  three shards, the small phone, and the frame-rate budget alone on every push
  to `main`.
- `.githooks/pre-push` runs `npm test` on the exact commit being pushed to
  `main` (in a scratch checkout) and refuses the push if it fails. Turn it on
  in each fresh clone: `git config core.hooksPath .githooks`.

## Balance bench

`FIT=1 DIFF=normal|hard SEEDN=40 node test/playtest.js <cls> 10` plays 400 runs
with a bot. Seed-to-seed noise is about ±5 points, so compare variants on two
seed sets (`SEEDPFX=alt` for the second). Other switches: `EARLY=1` (deaths
before level 5), `CAUSES=1`, `LICH=1`, `NAMED=1`, `NOFORGE=1`, `SHADE=4` (a fallen
hero's shade on floor 4), `SIZE=small|large` (Medium floors otherwise). `FP=1`
(a fingerprint of each run's final state and log: moving code without
changing behaviour must leave every one as it was; `FP=keys` hashes each part
of the state, `FPTRACE=1` prints each line logged, to find where two passes part).
Run variants in git worktrees under the scratchpad, not in the main checkout,
and keep the README balance table current.

## Conventions

- Comments explain why, in plain prose, in the game's voice; British spelling.
  Player-facing text is the same register: short, concrete, no jargon.
- Every new rule gets a rules test; every new screen or control a browser test.
- Help text lives in `index.html` (How to Play); keep it true when rules change.
- Styles are built from the tokens at the top of `css/style.css`: the colour sheet,
  the type scale (`--t-*`) and the spacing scale (`--s-*`, a 2px grid to 16, then 4px).
  A new rule picks from them; a value outside them is a picture, not the interface.
- A batch of player-visible changes updates `NEWS` in `js/ui.js` (a new `id` and a
  one-line `text`): returning players see it once on the title screen.
- New state on the player, a monster or a level is saved automatically (the
  whole of `G` is written as JSON), but give it a JSDoc property in `types.js`.

## Pitfalls seen before

- A d20 check always fails on a natural 1: a test that relies on one check
  passing must retry, or it flakes about one time in twenty.
- Self-Taught (`spread`) needs picks, and gives a score at most two points a
  run: tests and the bot choose it through `spreadPicks` / a score with room.
- Level-up offers are shuffled: a test that clicks the first card must handle
  Self-Taught's score picker (`.spread-stat:not(.full)`).
- The stair divides about a third of the way down (`Dungeon.routeSpan`): a
  test or bot that walks onto the stairs must answer `Game.forkPending()` with
  `Game.chooseRoute(...)`; `Game.descend()` on its own takes the seed's road.
- `pkill -f <pattern>` inside a shell command matches that shell itself and
  kills it; find the PID another way.
- Timing-sensitive browser tests flake under heavy CPU load (a bench running):
  rerun alone before calling a failure real, then fix the test if it is.
- The first tip (about the controls) holds the dungeon still while it is up.
  Browser tests therefore start with tips off; `startGame(page, { tips: true })`
  turns them on for a test that is about tips.
- A browser test that waits for a monster's blow to land must allow for
  misses: take the hero's armour off, or give it several seconds.
- A creature's poses, champions and close-up are painted after its plain
  picture, in spare moments: a test about how one is drawn calls `artReady(page)`
  (helpers.js) first.
