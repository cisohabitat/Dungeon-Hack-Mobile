<!-- Generated from CLAUDE.md by npm run docs:agents; edit CLAUDE.md, then regenerate. -->

# Deepdelve: notes for working on this repo

A first-person, seed-generated dungeon crawler for mobile browsers. Vanilla ES
modules, no build step, no framework. `main` deploys to Vercel as it is.

## Keep these instructions current

- Update this file in the same change whenever repository layout, commands,
  conventions, required checks or known pitfalls change. Review the guidance
  before finishing each task; add durable findings, not a log of routine work.
- Review `README.md` before finishing every task. Update it in the same change
  whenever features, controls, setup, commands, tests, project layout or balance
  change. Keep examples runnable and remove stale counts or timing claims.
  Balance figures must come from recorded simulations: include settings and
  seed sets, and distinguish previous measurements from a fresh benchmark.
- `CLAUDE.md` is the source for `AGENTS.md`. After editing it, run
  `npm run docs:agents` and commit both files. Do not edit `AGENTS.md` directly.
- `npm run check:agents` rejects a missing or stale `AGENTS.md`. It also runs
  through `npm test`, CI and the pre-push hook, so the two files cannot drift
  in a passing change. Keep this maintenance section in both documents.

## Layout

- `js/game.js`: the rules, one IIFE (`Game`). Monster AI lives in `js/foes.js` (the lich,
  the Heartforged, the Warlord and the named champions in `js/bosses.js`, `makeBosses(K)`)
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
  state and motion (`js/motion.js`), saving (`js/saving.js`), the paths and
  their capstones (`js/paths.js`), and the grades of what is found with the
  paths' legendary pieces (`js/legends.js`, their data in `js/relics.js`), and
  the combinations (`js/combos.js`): each rule that makes one calls
  `combos.note(id)` where it acts, and the Journal and the end of a run read them. A factory
  reads `game.js`'s changing state live through `K` (`K.G`, never a copy of
  `G`), and a constant two factories share stays in `game.js`. `K` is one object
  for every factory `game.js` wires (`const K = {...}` before the first of them),
  typed by name as `Kit` in `js/types.js`: a new thing lent goes in both. A factory
  may copy a value from `K` when it is made only if that value is already settled
  by then: one made later, or one living in a factory wired after it, must be
  read through `K` at the moment of use.
- `js/rng.js`: the seeded `Rng`, and `Dice`, the run's own dice: seeded from the run as it begins
  (`newGame`), their state carried in the save and taken up again on load, so the same run pressed
  the same way rolls the same, in the browser as under the bench. A roll play makes goes through
  `d()`, `rnd()` or `chance()`, never `Math.random`, which is for what changes nothing (pictures,
  sound, the title's names).
- `js/dungeon.js`: level generation, deterministic per `(seed, depth)`. Plans
  for a whole run (`namedPlan`, `twistPlan`, `piecePlan`) use their own `Rng`
  streams so they never shift the map's dice. Room shapes and the set pieces
  (cells, shrine, cistern, rubble) are drawn in `js/rooms.js`; corridors join
  the rooms as a tree plus a few loops, dug by a cheapest-path search.
- `js/data.js`: classes, items, monsters, spells, talents, paths, names.
  `js/relics.js`, `js/encounters.js`: relics and encounter data.
  Title greetings live in `FUN_FACTS`; `js/titlemenu.js` shows one when there
  is no unread News. Keep their random choice outside the run's seeded dice.
- `js/ui.js`: every screen and overlay; the Hall, bestiary and relic codex are in
  `js/hall.js`, the New Game screen's earned starts (second kit, hound) in
  `js/createextras.js`, and small DOM helpers in `js/uikit.js`. Some overlays are factories
  wired at the end of `ui.js` in the same `K` pattern: the title's key art
  (`js/titlescene.js`, drawing `img/keyart-*.webp`, made from `art/keyart/`), the trader (`js/shopview.js`), an encounter's and a level's
  choices (`js/choices.js`), the pack (`js/pack.js`), the map (`js/mapview.js`),
  the spell list and hero sheet (`js/herosheet.js`), the end of a run (`js/endscreen.js`), the title's menu with the
  Daily, the Weekly and the replace question (`js/titlemenu.js`) and the New Game screen with Quick Start (`js/createview.js`).
  The first-moment tips' words are in `js/tips.js` (`makeTips`, lent two of the view's helpers).
  A controller is read in `js/pad.js` (`makePad`, polled once a frame from `main.js`): in play it
  presses what the keys press; elsewhere it moves a focus ring by where the buttons sit. A new
  screen or overlay needs nothing more than real `<button>`s (the browser tests drive a stub pad:
  `usePad`, `padPress` in `helpers.js`).
  What the game does for access is in `js/access.js` (`makeAccess`): the log read aloud from `#sr-log`,
  the view in words, the bars named, the colour-blind palette and which hand plays (one-handed too).
  The two largest text sizes set `body.big-text`, which lays the dungeon's bars and buttons out afresh.
  The Daily Delve is `js/daily.js` and the Weekly Challenge `js/weekly.js` (which deals its hero with the
  daily's `dealHero`); a run either one starts is shared by everyone, so each guard that keeps a daily the
  same for all (no bones, hound, second kit, rung, Wick's tenth) checks `opts.weekly` as well.
- `js/renderer.js`: the 3D view; the spells', scrolls', drinks' and traps' effects
  over it are in `js/spellfx.js`, and what lies over the whole view (the hero's state at the rim,
  a boss's bar, arriving, a level gained, blood, the Heart lifted) in `js/overlay.js`.
- `js/creatures.js`: the creatures drawn from parts, their poses, and the one list
  of them all; the later creatures are in `js/folk.js`, the parts and shared kits
  in `js/parts.js`, the painter in `js/painter.js`, the encounters' props in
  `js/props.js`, and the champions, a shade's gear and the portraits in
  `js/champions.js`. `js/assets.js` turns them into sprites (a creature a piece at
  a time, in spare moments) and paints the walls, floors and doors; the wall
  decorations are in `js/walldecor.js`.
- `js/bestiaryart.js`: painted bestiary and Journal portraits, with creature
  sprites as fallbacks. The exports are in `img/bestiary/`, their source sheets,
  prompts and export tool in `art/bestiary/`; bosses reuse `img/bosses/`.
- `js/recording.js`: bounded local input/timing records attached to browser saves;
  headless benchmarks leave capture off. Add every new player-facing mutator to
  `RECORD_METHODS`, preserve exact call order and clocks, and verify recorded and
  unrecorded outcomes match. Exclude the observational `recording` metadata from
  gameplay-state fingerprints; its own timestamps and starting memories can vary. `replay.html` / `js/replayview.js` run in an isolated
  frame with memory storage; never replay through the live Game instance or
  persistent storage. On a failed save, discard the optional recording and retry
  the ordinary save before reporting failure. `js/replaycontrols.js` wires the end-screen dialog.
  `docs/REPLAY.md` documents limits; `node test/replay.js recording.json` verifies
  a record through the bot harness. Add replay coverage when changing save/load,
  inventory choices or input timing. Keep the browser's end-screen action
  secondary so controller focus still starts on New Game.
- `js/release.js`: release version and build number, shared by the main-page
  footer and telemetry. Keep the version in step with `package.json` and
  increment the build for each published build.
- `js/puzzles.js`: optional catches on existing gold/gems, placed after the floor's
  other rules with a separate seeded stream. `js/puzzledata.js` holds the clues and
  `js/puzzleview.js` their accessible overlay. Every fresh custom/Quick Start hero
  chooses `opts.puzzles` at the prologue; it resets off, and Daily/Weekly keep it off.
  Never gate keys, relics, quest objects or travel, change loot totals, or shift the
  map/combat dice. `Item.puzzle` guards collection through both walking and the pack;
  puzzle progress lives on `Level.puzzle`, but the open overlay is transient and
  cleared on load/new game. Validate imported controls in `savecheck.js`, record all
  puzzle mutators, and include clues in the narrative document. Keep the prologue's
  puzzle choice and stair reachable in `.pro-start`; short screens scroll normally.
  Recheck the returning-story and large-text flows when changing that footer.
  `PUZZLES=solve` in
  the balance bot explicitly answers caches at the current square and collects
  only their guarded currency, preserving the walking pickup policy for other
  loot. Default runs keep their decisions. Browser and rules checks are `puzzles.spec.js` and
  `rules-puzzles.js`; the overlay also has axe coverage.
- `js/savecheck.js`: validate local saves and imported codes before assigning game
  state. `js/savecode.js` bounds encoded input and streamed gzip output; the file
  picker checks size before reading. Preserve valid saves and legacy migrations.
  Exported codes omit local recordings and their starting memories; discard
  imported recording context before persistence, not just from live state.
- No file in `js/` is over 2,000 lines; split one that grows past it.
- `js/types.js`: JSDoc types, checked by `tsc` (`checkJs`).
- `js/telemetry.js`: opt-in reports (a run's end, a crash), off unless turned on
  in the Menu. `api/telemetry.js` and `api/stats.js` are the Vercel functions
  that keep and count them (checked by `test/api.js`); `dashboard.html` shows
  them beside the README balance table, which it reads as it stands. A report
  may name only the game's own ids: `api/_ids.js` lists them, written by
  `node tools/ids.mjs` from the tables (`test/run.js` fails while it is stale).
- `art/keyart/`: the title's key art. `REQUEST.md` is the brief for whoever makes it
  (an artist or an image tool); the finished images and their `SOURCES.md` land there.
- `sound/`: the sound pack (a first cut rendered in code; see its `SOURCES.md`) and
  `REQUEST.md`, the brief it was made to. `js/samples.js` loads it from the slim
  `sound/index.json` (made from `manifest.json`; `test/run.js` checks every file it
  names), and `sound.js` / `music.js` play it in place of their synthesis once a
  sound is loaded, the synthesis standing in until then and for magic. The browser
  tests start with the pack off (`deepdelve.samples` = `on` turns it on), as with
  the way in; `sound/listen.html` is a page for listening to all of it. It, `sound/masters/`,
  the pack's tools and notes, and `art/` stay in the repository and out of the
  deployment (`.vercelignore`): players get `sound/index.json` and the ogg and m4a files.
  `js/storyvoice.js` chooses narration and `js/narration.js` reuses one unlocked
  audio element across readings. Test both the browser's preferred format and
  Ogg fallback. `test/server.js` must serve byte ranges and media types so
  Chromium can read Ogg duration accurately, as it does on the deployment.
- `ROADMAP.md`: the phased plan towards an AAA feel; check it before starting
  a large piece of work, and tick items off as they land.
- `sw.js`: offline cache. A new module must be added to `ASSETS` (test/run.js
  checks this); bump `CACHE` when the list changes.

## Checks

Before every push, run `npm test`, both Chromium projects and the isolated
frame-rate budget below. CI additionally runs the focused WebKit project,
which is not installed in this local container. Wait for all CI jobs to pass
before reporting a pushed change as verified.

- `npm run check:agents`: verify `AGENTS.md` matches these source notes.
- `npm run test:security`: adversarial save/zip/markup, local file-boundary and
  telemetry checks; also part of `npm test`. Browser injection and API-cache
  regressions live in `test/browser/security.spec.js` (phone and small).
- `npx tsc --noEmit -p .`
- `node test/run.js`: generator and level checks.
- `node test/rules.js`: rule checks, about 3 minutes; the last line must begin
  `rule checks complete, 0 failure(s)`. The checks are in `test/rules-<subject>.js`, one file a
  subject, each lent the shared helpers (`test/rules-lib.js`); `rules.js` shares the files out over
  four processes. `ONLY="part of a test name"` runs a subset; `WORKERS=1` runs every file in one
  process, for debugging; `TIMES=1` says how long each file took. A new file of checks needs
  nothing more than the name: it is found and run.
- `npx playwright test --project=phone`: browser tests (phone viewport), about 5 minutes.
  Chromium is preinstalled; do not run `playwright install` locally.
- `PERF=1 npx playwright test --project=perf --workers=1`: the frame-rate
  budget (`test/browser/perf.spec.js`), 4x CPU throttle, about 40 seconds. It
  skips without `PERF=1`, since beside other tests it measures the load.
- `npx playwright test --project=small`: the interface, play and accessibility
  specs again at iPhone SE size (the device matrix, `docs/DEVICES.md`).
- `npx playwright test --project=safari`: focused `@mobile` tests in Playwright
  WebKit, installed in a separate CI job. Keep tags on the audio unlock/mute,
  portrait, fog and touch/save regressions. `npm run test:browser` runs the two
  Chromium projects locally; do not install WebKit in the local container.
  Linux WebKit and an iPhone-sized Chromium viewport do not establish a real
  iOS Safari pass; record physical checks separately in `docs/DEVICES.md`.
- `test/browser/a11y.spec.js` runs axe (WCAG 2.2 AA) over every screen and overlay: no fault
  rated serious or critical. A new overlay goes into it. `test/browser/access.spec.js` checks what
  axe cannot: text at twice its size on three phone shapes, the reader's log, the palette, Calm view, one-handed reach.
- CI (`.github/workflows/test.yml`) runs `npm test`, the browser tests in
  three shards, the small phone, the focused WebKit checks, and the frame-rate budget alone on every push
  to `main`.
- `.githooks/pre-push` runs `npm test` on the exact commit being pushed to
  `main` (in a scratch checkout) and refuses the push if it fails. Turn it on
  in each fresh clone: `git config core.hooksPath .githooks`.

## Balance bench

### When balance testing is required

- Before implementing each feature, decide whether it can change gameplay
  outcomes. Changes to classes, enemies, abilities, combat, loot, economy,
  progression or dungeon generation require balance simulations before merging
  or pushing the feature. Rule tests alone do not replace this benchmark.
- Record a baseline on the previous revision and compare the changed revision
  with matching settings, seeds and trial counts. Test affected classes and
  paths on Normal and Hard; shared systems require all six classes. Also test
  affected run lengths and ladder rungs when those systems change.
- Compare at least two seed sets during tuning. Validate final gameplay or
  balance changes on three sets (`bench`, `alt`, `third`), normally 400 runs per
  class, difficulty and set, using the command below. Check win rates, depth,
  early deaths, death causes and resource use; do not tune to a single seed set
  or hide a regression by changing the bot or weakening checks.
- Record the compared revisions, commands, settings, seed sets, run counts and
  results in the change description or a committed balance report. Update the
  README's affected measured rows only from those results. Explain any accepted
  regression or tradeoff; if the benchmark cannot run, report the blocker and
  leave the gameplay change unpushed until it has been validated.
- Before each release, review balance across all six classes on Normal and
  Hard, plus affected run lengths and rungs. Reuse recorded results only when
  gameplay has not changed since their measured revision.
- Art, audio, presentation-only UI and documentation changes need appropriate
  regression checks, not balance simulations. UI or performance work that
  changes targeting, controls, timing, visibility or other gameplay outcomes
  follows the gameplay rule above. State why balance testing was or was not
  needed when reporting a completed feature.

`FIT=1 DIFF=normal|hard SEEDN=40 node test/playtest.js <cls> 10` plays 400 runs
with a bot (`DIFF=hard+3` for a rung of the ladder past Hard). Seed-to-seed noise is about ±5 points, so compare variants on two
seed sets (`SEEDPFX=alt` for the second), and take a final table over three (`SEEDPFX=third`: a class on one set of 400 still swings by five or more). Other switches: `EARLY=1` (deaths
before level 5), `CAUSES=1`, `LICH=1`, `NAMED=1`, `NOFORGE=1`, `SHADE=4` (a fallen
hero's shade on floor 4), `WICK=2` (Wick has met two heroes before: a regular's tenth off), `SIZE=small|large` (Medium floors otherwise). `FP=1`
(a fingerprint of each run's final state and log: moving code without
changing behaviour must leave every one as it was; `FP=keys` hashes each part
of the state, `FPTRACE=1` prints each line logged, to find where two passes part).
Run variants in git worktrees under the scratchpad, not in the main checkout,
and keep the README balance table current.

`JSON_OUT=/tmp/balance.json` also writes the exact individual results, options,
seed list, trials per seed and `FIT` setting after the usual summary. Keep these
records when publishing a balance audit: the console percentages are rounded.
`EARLY=1` means deaths below level 5, not deaths before choosing a path; use
`died && !path` in the JSON records for the latter. Paths are offered at level 3
or at the divided stair.

The default bot ties path alternation and background rotation to the same run
index, so its conditional path rates use different background mixes. Before
tuning a path, compare forced `HEROPATH` passes on matching seeds, trials,
backgrounds and settings. Trials also share a dungeon seed and can repeat an
identity: group uncertainty estimates by dungeon seed rather than treating all
trials as independent. Resource fields also need care: `potionsDrunk` counts bot
attempts (which can be blocked), `goldFound` is end-of-run cash, and `goldSpent`
is an unpopulated legacy field. Use the game's recorded `casts` for actual
spell casts and the final inventory for potions remaining. A reproducible audit
and its raw records live in `docs/balance/2026-10-16/`.

## Conventions

- Treat imported saves, local storage and telemetry as untrusted. Escape quotes
  as well as HTML delimiters in markup; numeric-looking saved fields are still
  input. Keep prototype keys out of imported structures, bound decompression
  while reading, and validate before touching the saved or live hero.
- Telemetry accepts bounded fields, rejects cross-origin browser submissions and
  throttles using short-lived keyed address digests. The public stats API must
  never return individual reports or error messages, including old counters.
  Keep Redis credentials server-side. API responses bypass the service worker.
- `SECURITY.md` documents security boundaries; record reviews under `docs/`.
  CI uses Node 24, read-only permissions and no persisted checkout credentials.

- Comments explain why, in plain prose, in the game's voice; British spelling.
  Player-facing text is the same register: short, concrete, no jargon.
- Every new rule gets a rules test; every new screen or control a browser test.
- Help text lives in `index.html` (How to Play); keep it true when rules change.
- The story has one narrator (`docs/VOICE.md`). A line of it goes in its table (`data.js`,
  `encounters.js`, `rooms.js`, `tips.js`), not in code; then `node tools/narrative.mjs`
  writes `docs/NARRATIVE.md` again (`test/run.js` fails while it is stale), and
  `test/rules-voice.js` checks spelling, names and who is speaking.
- Styles are built from the tokens at the top of `css/style.css`: the colour sheet,
  the type scale (`--t-*`) and the spacing scale (`--s-*`, a 2px grid to 16, then 4px).
  A new rule picks from them; a value outside them is a picture, not the interface.
- A batch of player-visible changes updates `NEWS` in `js/titlemenu.js` (a new `id` and a
  one-line `text`): returning players see it once on the title screen.
- New state on the player, a monster or a level is saved automatically (the
  whole of `G` is written as JSON), but give it a JSDoc property in `types.js`.

## Pitfalls seen before

- A controller initially focuses the first visible `.primary` button. An
  optional title greeting must not take that class from New Game or Continue;
  run the controller tests when adding title controls.
- The narration audio element changes its `src` as readings advance. Playback
  tests must associate captured evidence with the intended recording, and
  exercise Ogg as well as the browser default (local Chrome may prefer AAC).
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
