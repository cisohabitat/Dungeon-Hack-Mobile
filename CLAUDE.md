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
- `js/dungeon.js`: level generation, deterministic per `(seed, depth)`. Plans
  for a whole run (`namedPlan`, `twistPlan`) use their own `Rng` streams so they
  never shift the map's dice.
- `js/data.js`: classes, items, monsters, spells, talents, paths, names.
  `js/relics.js`, `js/encounters.js`: relics and encounter data.
- `js/ui.js`: every screen and overlay; the Hall, bestiary and relic codex are in
  `js/hall.js`, and small DOM helpers in `js/uikit.js`. `js/renderer.js`: the 3D view.
  `js/creatures.js`: procedural sprites (monsters and encounter props).
- `js/types.js`: JSDoc types, checked by `tsc` (`checkJs`).
- `sw.js`: offline cache. A new module must be added to `ASSETS` (test/run.js
  checks this); bump `CACHE` when the list changes.

## Checks (run all before every push)

- `npx tsc --noEmit -p .`
- `node test/run.js`: generator and level checks.
- `node test/rules.js`: rule checks, about 4 minutes; must end
  `rule checks complete, 0 failure(s)`. `ONLY="part of a test name"` runs a subset.
- `npx playwright test`: browser tests (phone viewport), about 5 minutes.
  Chromium is preinstalled; do not run `playwright install` locally.
- CI (`.github/workflows/test.yml`) runs `npm test` and the browser tests in
  three shards on every push to `main`.
- `.githooks/pre-push` runs `npm test` on the exact commit being pushed to
  `main` (in a scratch checkout) and refuses the push if it fails. Turn it on
  in each fresh clone: `git config core.hooksPath .githooks`.

## Balance bench

`FIT=1 DIFF=normal|hard SEEDN=40 node test/playtest.js <cls> 10` plays 400 runs
with a bot. Seed-to-seed noise is about ±5 points, so compare variants on two
seed sets (`SEEDPFX=alt` for the second). Other switches: `EARLY=1` (deaths
before level 5), `CAUSES=1`, `LICH=1`, `NAMED=1`, `NOFORGE=1`, `SHADE=4` (a fallen
hero's shade on floor 4). Run variants in
git worktrees under the scratchpad, not in the main checkout, and keep the
README balance table current.

## Conventions

- Comments explain why, in plain prose, in the game's voice; British spelling.
  Player-facing text is the same register: short, concrete, no jargon.
- Every new rule gets a rules test; every new screen or control a browser test.
- Help text lives in `index.html` (How to Play); keep it true when rules change.
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
