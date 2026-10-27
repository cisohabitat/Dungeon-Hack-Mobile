<!-- Generated from CLAUDE.md by npm run docs:agents; edit CLAUDE.md, then regenerate. -->

# Deepdelve: notes for working on this repo

A first-person, seed-generated dungeon crawler for mobile browsers. Vanilla ES
modules, no compilation, no framework. Vercel stamps main's commit into the page.

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
- Optional hero setup lives in `#c-customise`, closed on each new creation screen;
  folding it must preserve selected background, scores, seed and dungeon options.
  Mastery goals are a separate disclosure. Browser tests choosing seeds/builds use
  `customiseCreation`; do not force the panel open globally or bypass first-run tests.
  The Journal defaults to Quests; collections live under `#journal-collection`.
  Folding a selected collection returns to Quests, keeping a visible active tab.
  Tests use `selectJournalTab` to open the disclosure through its real control.
  Controller focus must exclude folded details content even when it retains layout
  boxes, while keeping the first direct summary reachable.
  The map key lives under `#map-key`; reserve its closed heading when sizing the map,
  and allow expanded keys to scroll. Attack's text follows the actual readiness
  boundary, not a rounded value; presentation must not change cooldowns or dice.
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
  `js/champions.js`; the six hero fallback faces now live in `js/heroart.js`.
  `js/paintedcreatures.js` maps existing monster poses and approved E–H
  class/companion/state variants to painted atlases, selected by the renderer. Each kind has its
  own lazy image and palette cache; one failed atlas cannot disable another.
  Bind Skarrow explicitly through `wyrm.elite.skarrow`, including every pose,
  and other named champions through their own `elite[id]` objects. Keep procedural
  objects, motion, warnings, elite identities and the renegade companion intact.
  Decode only on demand; build shade/flash canvases once between frames and
  switch a complete palette together, falling back during loading or failure.
  The 256px cells are registered to body centres and foot baselines by
  `python3 art/creatures/export.py` for the warrior;
  `python3 art/creatures/export-batch.py` handles the next twelve, requiring
  Pillow, NumPy, SciPy and ImageMagick. `--check` reproduces shipped bytes.
  Batch sources and replacements are listed in `generation-batch.json`.
  Do not invent game actions for unused atlas cells: creatures without a
  `special` pose keep their existing wind-up fallback.
  Sources stay under `art/creatures/`, exports under `img/creatures/`; review both
  before recording hashes. `painted-creatures.spec.js` covers cached poses,
  lighting, elite colours, dice, warnings, occlusion, failure and offline reload.
  Batch A generation is recorded in `art/creatures/generation-batch-a.json`.
  `python3 art/creatures/export-batch-a.py --check` reproduces its shipped atlases,
  review atlases and labelled contact sheets under `art/creatures/batch-a-preview/`.
  `node art/creatures/preview-batch-a.cjs` captures the integrated runtime loader
  and dungeon renderer at 390px and 320px; it needs the project Playwright
  dependency and system Chromium (`CHROMIUM_PATH` may override
  `/usr/bin/chromium`). Bat wingbeats use a fixed torso anchor rather than a
  foot baseline; Wraith registers its robe fringe. Keep step repairs, original
  sources and measured registration in the manifest.
  Correction sheets replace only the manifest's named cells, keeping other
  original poses. Preview corrected steps, hurt and blink as well as wind-ups.
  Batch B review follows `generation-batch-b.json`; `export-batch-b.py --check`
  reproduces its ten review and shipped atlases and neutral/walking/action contact sheets.
  `preview-batch-b.cjs` uses the real runtime loader at both phone widths.
  Keep shipped bytes identical to reviewed exports and cache every atlas offline.
  Batch C uses `generation-batch-c.json`, `export-batch-c.py --check` and
  `preview-batch-c.cjs` for ten further identities. Lich uses measured torso
  anchors; its selected source orders recover before windup. Only chest Mimics
  use the chest atlas: the render state's `procedural` flag retains barrel
  forms, keeper phases after the first (the initial phase is zero) and the Warlord's throne/spear handling.
  Concealed Mimics and submerged Drowned remain scenery, never revealed sprites.
  Keep Moth's measured torso anchor steady through wingbeats. Single-frame
  replacements reject opaque backgrounds and detached large parts, then retain
  only the connected figure plus its antialiased edge before registration.
  Batch D uses `generation-batch-d.json`, `export-batch-d.py --check` and
  `preview-batch-d.cjs` for the default Shade and nine named champions. Bind
  champions through their base kind's `elite[id]` pose objects, never a generic
  elite tint. Shade and Orla register measured torso anchors. Non-fighter fallen
  Shades remain procedural even before their class gear has finished painting;
  the default sword-and-shield atlas cannot represent those kits. Only supported
  pose objects are bound; reserve drift/special cells do not add actions.
  Approved E–T gameplay exports are now wired through paintedcatalog.js,
  paintedworld.js and the extended paintedcreatures.js loader. Reproduce all 184
  shipped bytes and the catalog with python3 tools/export-painted-runtime.py --check.
  runtime-delivery.json maps every shipped file to its reviewed source. Static
  pictures decode on display demand, not during background fallback preparation;
  sprites upgrade in place, retain per-image failure fallbacks and update existing
  DOM images. Material caches remain native64 with eight Uint32 darkness levels;
  R/S overrides apply only to Grey Halls. Material decode increments a presentation
  revision: renderer floor/ceiling caches must refresh without changing the level
  when a late image replaces its fallback (painted-cache.spec.js). Keep original exact stair-arch alpha,
  coloured locks and other regions' procedural details. Seeded amulet_tooth is a
  reserve, never an identity-revealing substitution. Held bindings require exact
  id/class/pose/two/lit; keep authored bounds, grips and live bow string/hand.
  Boss variants use live phase/throne/shot state. A WeakMap keeps a completed
  Warlord shot's spear during its 130ms lunge without adding saved combat state;
  interruptions and phase changes clear that presentation memory. Companion cell 6
  is sit; Mender heal is a separate 256px file. Unused poses do not add actions.
  Native phone/offline evidence is in runtime-preview/ and preview-runtime.cjs;
  frozen state fixtures are not full gameplay transition coverage. The following
  E–T preview notes describe historical source-review harnesses, not current
  runtime delivery. Their substitutions must not be used as integration evidence.
  Batch E class Shade sources and review atlases use `generation-batch-e.json`,
  `export-batch-e.py --check` and `preview-batch-e.cjs`. This is preview-only:
  the harness substitutes image requests and frozen draws, not runtime bindings.
  Keep exact class gear, measured floating torso anchors and original/repair
  provenance. Review assets are not offline-shipped or integration evidence.
  Batch F companion review tooling uses `generation-batch-f.json`,
  `export-batch-f.py --check` and `preview-batch-f.cjs`. Slot seven is `sit`,
  not `special`; Mender healing is a separate 256px export. Keep its measured
  body-span registration and the source repair provenance. The preview asserts
  real companion pose selection and scale 0.62, then substitutes review pictures;
  these are not runtime bindings or offline integration evidence.
  Batch G barrel Mimic review tooling uses `generation-batch-g.json`,
  `export-batch-g.py --check`, `reference-batch-g.cjs` and `preview-batch-g.cjs`.
  The active identity repair currently draws a chest even for procedural barrel
  variants; label legacy barrel design references separately. Special/blink
  cells are reserves. Keep concealment scenery and approved chest art intact.
  Batch H boss review tooling uses `generation-batch-h.json`,
  `export-batch-h.py --check` and `preview-batch-h.cjs`. The preview freezes game
  updates and substitutes pictures; it does not prove live state transitions.
  Warlord phase stats are not cumulative: only phase 1 has ranged attacks,
  including while standing after throne exit/no bearer spawn. Seated step slots
  are reserves. Keep projectiles and helpers separate; reuse current Lich casts
  and phase-2 cleaver/drum. Read `batch-h-preview/STATE-AUDIT.md` before integration.
  Batch I static trader review uses `generation-batch-i.json`,
  `reference-batch-i.cjs`, `export-batch-i.py --check` and `preview-batch-i.cjs`.
  One source has three figures; exports are 256px singles and a 768x256 strip,
  not a nine-pose atlas. The current creature loader cannot load this format.
  Trader paintings should match approved monster rendering: weathered anatomy,
  recessed eyes, muted colours and rough materials; avoid cute mascot faces.
  Merchant/Wick are grey Lampfolk; Pedlar is green. Market selection overrides
  the Wick flag. Preserve scale 0.95 and shop/collision rules; wait for the
  shop's closing fade before capturing dungeon previews.
  Batch J encounter review uses `generation-batch-j.json`,
  `reference-batch-j.cjs`, `export-batch-j.py --check` and `preview-batch-j.cjs`.
  Use explicit scene crop rectangles/anchors, retaining separate elements and
  low Hound framing; floating core/torso anchors apply to Wisp/Ghost. J3 reuses
  companion `sit` cells, not three new identities. Two encounter IDs share Wisp.
  Card URLs are procedural getters; the preview checks those bindings then
  substitutes the DOM image only for review, leaving all choices unanswered.
  Wait for both opening and closing overlay fades before scene/card captures.
  Batch K prop review uses `generation-batch-k.json`,
  `reference-batch-k.cjs`, `export-batch-k.py --check` and `preview-batch-k.cjs`.
  K's 25 keys plus J's 17 exactly cover the 42 current PROPS. The roadmap's
  additional `bone_heap` is already used by collapsed Skeletons, corpses and
  end cards; keep it low, distinct from seated gambler bones, with the existing
  rise ring. Preserve shared shrine/bones/barricade aliases and black pool water,
  object counts, closed mechanisms and authored low scene framing.
  Preview substitutions do not establish runtime/offline integration.
  Batch L room-dressing review uses `generation-batch-l.json`,
  `reference-batch-l.cjs`, `export-batch-l.py --check` and `preview-batch-l.cjs`.
  Eleven static keys use the dress_* namespace, not same-named encounter props.
  Keep ordinary SIZE/offsets/onFloor flags, low floor profiles, three candles,
  four teal mushrooms and red oil-cask warning. Five containers already smash
  or kick apart; preserve their loot/oil rules and shared concealed-Mimic and
  puzzle-chest bindings. Regional aliases belong to M; remains to N; effects to Q.
  Sixty frozen phone captures check actual selection before substitution;
  emissive masks, moving rubble callers and offline integration remain separate.
  Batch M regional dressing uses `generation-batch-m.json`,
  `reference-batch-m.cjs`, `export-batch-m.py --check` and `preview-batch-m.cjs`.
  Five dress_* aliases preserve saved rubble/mushrooms kinds and scales .55/.5,
  regional selector precedence and fell bypass. Low crypt lids/iron, complete
  root/reed tips and three dark elven shards retain authored scene framing.
  Forty-four frozen captures force eleven theme mappings on one fixed layout;
  they do not establish native region generation or runtime/offline integration.
  Batch N remains use `generation-batch-n.json`, `reference-batch-n.cjs`,
  `export-batch-n.py --check` and `preview-batch-n.cjs`. Four low dress_remains_*
  pictures keep actual SIZE, fractional world coordinates, onFloor/no dress flag,
  strict >450ms reveal and until>G.t expiry. Keep generic caller choices separate
  from L decor bones and K collapsed violet-eyed heap; pottery has four low major
  pieces, two decorated. Twenty-four frozen captures and 56 actual timing checks
  cover phone fitting and loot/foe floor order, not native death/smash outcomes
  or runtime/offline integration. See batch-n-preview/STATE-AUDIT.md.
  Batch O baseline materials use `generation-batch-o.json`,
  `reference-batch-o.cjs`, `export-batch-o.py --check` and `preview-batch-o.cjs`.
  Thirteen themes × wall/floor/ceiling export 39 opaque64px tiles; floor/ceiling
  retain eight Uint32 darkness levels. Review source/detail/repeats and preserve
  documented edge diagnostics; numeric jump ratios do not prove seamlessness.
  Fifty-two synthetic material-booth captures use a temporary baseline proxy;
  doors/locks/stair openings and non-base kinds remain original. Architecture
  matching, native layouts/offline/fallback and isolated performance remain
  integration gates. See batch-o-preview/FORMAT-AUDIT.md; no creature anchors.
  Batch P uses `generation-batch-p.json`, `reference-batch-p.cjs`,
  `export-batch-p.py --check` and `preview-batch-p.cjs`. Audit 95 ordinary icons;
  seven regional paintings include six direct base keys and reserved amulet_tooth.
  Keep seeded Tooth appearances and named Hissra art; do not force the base fang.
  Two grip-registered Rune shield rear sources cover Fighter/Cleric only. Current
  carriedParts returns null for runeshield; source review is not a runtime fix.
  Held object height 128px avoids short-view bash clipping; icons use centre fit,
  not creature feet. 56 captures, 36 held fits and 12 existing baseline tests pass;
  loader, class actions, rarity/emissive/offline integration remain separate.
  Batch Q uses generation-batch-q.json, reference-batch-q.cjs,
  export-batch-q.py --check and preview-batch-q.cjs. Eleven source cells cover
  three static world effects and four phases each for fire/frost. Impact families
  share target origins and uniform scales; fade externally. Preserve procedural
  Calm, poison/status, lightning, projectiles, telegraphs and triggered traps.
  88 frozen captures, 52 lifetime pixel gates and 14 baseline browser tests pass.
  Loader/cache/offline/native outcomes/performance remain integration gates;
  see batch-q-preview/STATE-AUDIT.md.
  Batch R uses generation-batch-r.json, reference-batch-r.cjs,
  export-batch-r.py --check and preview-batch-r.cjs. Eight native64 architecture
  cells form a Grey Halls baseline, not thirteen regional kits. Keep five-colour
  locks and regional overlays; the painted arch differs by 26 binary-alpha pixels,
  so retain original geometry. Pillars use full surface textures, no sprite feet.
  68 frozen captures and eight native browser tests cover stairs/doors/pillars;
  small needs a temporary art.spec.js selector. Exact masks, regional materials,
  loader/offline/fallback/performance remain integration gates.
  Batch S uses generation-batch-s.json, reference-batch-s.cjs,
  export-batch-s.py --check and preview-batch-s.cjs.20 opaque64 baseline cells
  cover six floors, three roofs, six wall/rock surfaces, two fountains and three
  torches; not260 regional paintings.144 shade levels and84 frozen captures
  verified, with six native region-art browser tests. Preserve original69 decor
  entries, locks and exact arches. Wall fixtures face x3,y4; x4,y4 selects decor.
  Track sampled sources through softWall caches; Calm retains the current torch
  frame, not forced frame0. Repeat ratios do not prove seamlessness; roots/joins,
  regional material matching, native/offline/fallback/performance remain gates.
  Batch T uses generation-batch-t.json, reference-batch-t.cjs,
  export-batch-t.py --check and preview-batch-t.cjs.16 held source frames cover
  Fighter longsword9, Mage staff4, Ranger longbow3. Exact raw id/class/pose/two
  and lit=false guards only; never strip named prefixes or replace other classes.
  Ranger retains Fighter hand-palette fallback. Bow art excludes string/arrow/
  drawing hand; authored nocks feed existing live drawing and .72 release.
  Mage casting/read/use release the lower staff hand. Shared family scales and
  authored grips/object bounds keep162 fixture cases within160/360/464 views;
  54 captures and12 native held tests pass. Through source sleeve has3px spacing
  but exports>=12px. Native transition/offline/fallback/performance remain gates.
  Batch Z starting-weapon source tooling is reference-batch-z.cjs,
  export-batch-z.py --check and preview-batch-z.cjs.23 frames cover Cleric mace9,
  Thief shortsword9, Ranger shortbow3 and Druid spear2. Spear uses one-hand
  rest/drive; only staff selects channel. Shortbow keeps Ranger's Fighter palette
  fallback and live string/arrow; nock top remains the lower source endpoint.
  Preserve original/repair provenance, rejected requests, raw spacing exceptions
  and authored row-specific shortsword crops in the manifest. Export only existing
  pixels by crop/uniform family resize/translation; no mask repair or pose rotation.
  Frozen source proxies are not native activation evidence; generic stress cases
  must not be described as new class abilities.92 captures/276 fitting cases are
  separate from future offline/failure/performance delivery gates. See
  batch-z-preview/REVIEW.md. The next roadmap priorities are AA–AG.
  Batch AA first wider-weapon tranche uses reference-batch-aa.cjs,
  export-batch-aa.py --check and preview-batch-aa.cjs:36 CUT frames for Thief
  dagger, Fighter battleaxe/greatsword and Cleric hammer. Greatsword two=true
  only while both hands grip: cast/read/drink request two=false and must keep
  procedural one-hand fallback. Preserve authored hammer row425/818, sword
  right-column row800 and dagger lower-column430 crop gaps; these retain complete
  sources without masking. Dagger64/axe128/hammer112/sword128 object-height caps
  keep silhouettes distinct. Source/repair/edge findings remain in the manifest;
  first sword original is selected over pose-flattening/edge-debris alternatives.
  120 frozen source captures/360 fitting cases and12 baseline checks are separate
  from native activation/offline/failure/performance gates. The Fighter HUD is
  a fixture, not proof of real class actions. AA's remaining library stays open;
  see batch-aa-preview/REVIEW.md. Their historical source-only scopes remain recorded.
  AA's second melee source pass uses reference-batch-aa-melee2.cjs,
  export-batch-aa-melee2.py --check and preview-batch-aa-melee2.cjs:36 one-hand
  CUT frames for Fighter hammer/flail, Cleric flail and Mage dagger. Preserve
  compact joined flail construction and class hands; Mage dagger stays short.
  Capture labels must include class AND item, including Calm/recovery, or two
  flail families overwrite evidence. The harness rejects duplicate names.
  Opaque diagnostics and pixel comparisons resolve uncertain transparent previews;
  do not claim a missing part from one ambiguous view or mask it with scripts.
  Authored crop gaps and residual edge findings remain in the manifest;120 frozen
  captures/360 fitting cases are not native activation/offline/performance proof.
  Existing Cleric hammer, Thief dagger and named Penitent art stay protected.
  See batch-aa-melee2-preview/REVIEW.md for historical source-only findings.
  AA's third melee source pass uses reference-batch-aa-melee3.cjs,
  export-batch-aa-melee3.py --check and preview-batch-aa-melee3.cjs:36 dagger
  class frames for Fighter/Ranger/Druid/Spellblade,27 unique painted poses.
  Ranger currently shares Fighter's native palette; reuse requires all9 native
  PNGs, grips and object bounds to match. Keep exact class keys and identical
  source crops/grips/bounds/shared family scale; exporter asserts equal outputs.
  Druid keeps brown/green cloth; Spellblade keeps charcoal/slate/dark cloth and
  muted silver/blue cuff seams, with no blade glow. Cleric dagger is ineligible.
  All6 legal dagger classes have source coverage with active Thief/pending Mage;
  this is not whole-AA completion.120 frozen captures/360 fits are source review,
  not native class actions/offline/performance. Preserve class-qualified names,
  compact-prop repair provenance and crop-gap/fringe notes. See
  batch-aa-melee3-preview/REVIEW.md for historical source-only findings.
  AA fourth melee source tooling is reference-batch-aa-melee4.cjs,
  export-batch-aa-melee4.py --check and preview-batch-aa-melee4.cjs:36 club CUT
  frames for Fighter/Cleric/Thief/Druid, the full legal club class set. Native
  canEquip rejects Mage/Ranger/Spellblade. Keep knotted wood/cord/flush iron heads
  and class costume; no mace head, giant spikes or scripted palette changes.
  Object bounds must include downward through tips and right-leaning windup heads.
  Authored crop gaps/rows and minor residual fringe remain recorded; registered
  alpha>32 clearance is>=19px under112px object-height cap.120 frozen source
  captures/360 fits are not native class/action/offline evidence; Fighter/Thief
  casts are stress fixtures only. Class-qualified names and protected published
  controls remain. See batch-aa-melee4-preview/REVIEW.md and coverage-audit.json
  for actual remaining class gaps; clubs remain local/unactivated after0.9.36.
  AA fifth melee source tooling is reference-batch-aa-melee5.cjs,
  export-batch-aa-melee5.py --check and preview-batch-aa-melee5.cjs:97 class/state
  frames across12 missing basic melee pairs,77 new unique poses/20 native-audited
  Ranger reuses. Staff rest/drive two-hand and rest/channel one-hand stay distinct;
  casting uses sin(progress*pi), so early .08 requests rest while .2 is channel.
  Keep authored tip metadata for existing glint in future common export/loader;
  older Mage T source lacks it. Spellblade swords have explicit reflected groups
  and shared plain/reflected scale. Native equality proofs permit Ranger short/
  spear reuse; Ranger longsword copies T registered pixels/grips/bounds exactly.
  Authored crops cross nominal grid gaps; inspect complete down-left sword tips
  and staff butts, no scripted masks.368 captures/1,104 fits are frozen source
  evidence, not native class/actions/offline/performance. All basic melee pairs
  now have source coverage; rare/named/ranged/released-hand gaps stay separate.
  See batch-aa-melee5-preview/REVIEW.md;97 plus36 clubs remain local/unactivated.
  AA ranged source tooling: reference-batch-aa-ranged.cjs,
  export-batch-aa-ranged.py --check and preview-batch-aa-ranged.cjs.17 frames
  cover sling loaded/empty for5 classes, knife rest for4 and handxbow rest for3.
  Keep procedural sling whirl/stone through.62 (stone releases.55), knife bare
  fist from.4, and crossbow's existing seated-bolt rest throughout recoil. Exact
  class/pose/two/lit proxy guards and native equality proofs protect Ranger reuse.
  Disable Game.recordRuns before fixture neutrality snapshots: renderState calls
  otherwise append events. Compare full state and Dice/Odds without exclusions.
  292 frozen captures/876 fits are source evidence; no native equip/offline/perf
  claim. These17 frames remain local/unactivated. Remaining bow class gaps are
  Fighter/Thief shortbow and Fighter longbow; do not call all AA complete.
  AA remaining bow source tools are reference-batch-aa-bows.cjs,
  export-batch-aa-bows.py --check and preview-batch-aa-bows.cjs.9 frames cover
  Fighter/Thief shortbow and Fighter longbow;6 Fighter states copy approved
  Ranger registered PNG bytes AND all measurements after native pixel/grip/
  bounds/dimension/nock equality audits. Never re-register shared art differently.
  Thief adds3 painted dark-glove/olive-sleeve bends. Keep source string/arrow/draw
  hands absent and live renderer nocks exact (top is lower image endpoint).
  Source checks distinguish198 fully visible weapon fits,54 intentional action
  lowering cases and30 fallback controls: cast/read/drink deliberately move bows
  below the viewport. Retain normal full bounds checks for non-action motion.
  94 captures/282 fixtures are frozen source evidence;12 baseline checks pass.
  These9 and17 earlier ranged frames remain local/unactivated. All ordinary bow
  legal class pairs now have source coverage; rare/named/released-hand work stays open.
  AA rare source tools: reference-batch-aa-rare.cjs,
  export-batch-aa-rare.py --check and preview-batch-aa-rare.cjs.63 frames cover
  all6 legal scimitar/dwarfhammer pairs, including9 explicit reflected Spellblade
  states;54 unique paintings/9 exact native-audited Ranger scimitar reuses. Keep
  shared Ranger crops/registration/bytes and shared plain/reflected family scale.
  Preserve curved blade/violet guard inset and compact dwarven banded head/pick.
  Authored crop boundaries cross nominal gaps: through/recover450, Thief middle
  strike/cut390 and right sweep/return row800, reflected top/middle row430. Keep
  complete source ends without masks; opaque diagnostics resolve transparent-view
  fringe artifacts before claiming missing or defective parts. Original/repair
  provenance and unsuccessful requests remain in the generation manifest.
  208 frozen captures/624 fits/17 exact guards per width, full state/dice neutrality
  and12 baseline checks pass; source review is not native actions/offline/perf.
  These63 plus26 ranged/bow frames remain local/unactivated (89 total). Next source
  gap is Fighter greatsword released-hand art, then named/legendary/Mythic equipment.
  AA released greatsword tools: reference-batch-aa-greatsword.cjs,
  export-batch-aa-greatsword.py --check and preview-batch-aa-greatsword.cjs.9
  two=false/lit=false CUT frames cover Fighter read/drink overlaps and generic
  cast stress fixtures; ordinary published two=true9 stay unchanged. Preserve
  the exposed long grip/pommel and primary right forearm, especially windup; the
  original image edit retained the wrong lower arm, selected repair fixes it.
  Authored crop gaps: bottom through/recover450, recover/return900, right-column
  rows430/800. Keep all source tips/forearms, no scripted masks/paint.
  Await lazy published greatsword readiness BEFORE mapping protected image IDs;
  otherwise provisional procedural frames swap during source decode. Cast0 uses
  sin0=0 and retains both hands; read/drink0 already release. Count action-hand
  requests and test reading precedence, active CUT poses and current two-hand
  return. Fighter reflection is a direct metadata guard only (renderer requires
  Spellblade lantern).130 captures/390 fixtures cover270 new bounds,96 protected
  two-hand draws and24 other fallbacks;22 guards per width and full state/dice
  neutrality pass. These9 plus89 prior frames remain local/unactivated (98 total);
  native actions/offline/performance remain activation gates for one18-state
  greatsword family. Next source work is named/legendary/Mythic equipment.
  AA named held pass1 tools: reference-batch-aa-penitent.cjs,
  export-batch-aa-penitent.py --check and preview-batch-aa-penitent.cjs.18 exact
  relic_penitent one-hand CUT states cover Fighter/Cleric; verify canEquip AND
  spriteFor from actual base flail/u:penitent items, never pass a named sprite ID
  as ITEMS type or strip its prefix to an ordinary binding. Keep3 prayer studs
  and gold cross, compact joined chain/one iron ball and class costume. Fighter
  original/first bead repair showed only2; selected image-tool class edit from
  the correct Cleric construction restores3 with grey/steel/brown costume. Keep
  all4 outputs and failed selection reasons; no scripted palette changes.
  Crop boundaries: bottom through/recover450, middle strike/cut400, lower middle/
  right rows800; inspect complete spikes/forearms and>=25px alpha32 clearance.
  audit-named-equipment.mjs [--check] reconciles47 named identities/31 held
  weapon/shield candidates using relicUsableBy (Mythic restrictions included),
  exact id/class/pose/two held source metadata and held/carried delivery separately.
  Worn/inventory/portrait art and carried source sheets are separate; pose families
  still require renderer audits.1 named family has source,30 remain,0 delivered.
  68 frozen captures/204 fixtures,17 guards per width/state and dice neutrality/
  12 baseline checks pass; no native actions/offline/performance claim. These18
  plus98 earlier frames total116 local/unactivated. Next source: Dawnbringer for
  Fighter/Cleric, then Ogre's Toll and remaining named held/carried equipment.
  AA ranged/bow/rare/greatsword/Penitent source stages above are historical.
  All116 are activated for0.9.38/build53/deepdelve-v113 through the existing
  family loader. Current common delivery:576 files,405 held frames,744 shipped
  paintings plus3 icons; all460 prior common files retain identical bytes.
  preview-batch-aa-runtime116.cjs records50 native sessions/25 legal variants,
  164 actual actions,742 captures/50 galleries and50 offline Continue reloads
  with405 held frames cached. No frozen updates/asset routes/render proxies;
  supplied equipment/resources and durable target are not unassisted gameplay.
  Greatsword uses one18-state family (two-hand + released); read/drink overlaps
  must release one hand during actual attack and restore current two-hand rest.
  Spellblade scimitar shares one18-state plain/reflected family; remove the
  actual lantern for plain native evidence. Penitent uses exact relic_penitent
  from real flail/u:penitent, never ordinary flail fallback as named coverage.
  Painted-world regressions cover7 new corrupt-family cases,375 three-height
  new/protected bindings, state/Dice/Odds neutrality and native greatsword
  attack/read/drink overlap. Prior642 fit checks remain. Named audit now has
  1 source-complete/delivered held family and30 candidates without held source.
  See batch-aa-runtime116/REVIEW.md for current activation/release evidence.
  AB named source completion supersedes the earlier 30-without-source count:
  all31 weapon/shield candidates now have source (20 held including active
  Penitent,11 carried); AB adds397 local/unactivated states:381 held+16 carried,
  73 class families,347 unique paintings+50 native-equal Ranger reuses. Tools:
  plan/reference/register/export/preview/gallery-batch-ab-named (reference and
  gallery also use Python); export supports --check. Keep carried source classes
  separate from held pose counts in audit-named-equipment.mjs. Native refs check
  actual canEquip/spriteFor/offhand eligibility; frozen proxies are fitting only.
  Crop complete connected figures across grid boundaries. Normalize source_density
  across small repair sheets before choosing one physical family scale. Alpha
  analysis measures landmarks only: never mask/repaint pixels. Include actual
  painted tips in bounds; derive bow nocks from the bow corridor beyond the grip,
  not full-figure forearm extrema. Compare native grip occlusion before declaring
  missing bands; inspect opaque composites before alleging an alpha background.
  AB selected Heartroot spacing repair and only two Dawnbringer windup cells;
  rejected mark-exposure/Heartseeker background repairs remain provenance.
  Review: batch-ab-named-preview/REVIEW.md,397 exact exports,1582 phone captures,
  4746 three-height fixtures,82 galleries. Activation still needs native legal
  actions, exact held/carried routing, whole-family loading/fallback, offline
  delivery and performance evidence. The other16 worn/inventory identities and
  47 existing named portraits are separate surfaces; do not call them held gaps.
  AB397 states are now activated for0.9.39/build54/deepdelve-v114. Common delivery
  is973 files,786 held+21 carried states,1141 shipped paintings+3 icons; all576
  prior common exports retain identical bytes. export-painted-runtime.py binds
  AB kind:held and kind:carried separately through existing exact family loaders.
  Named staffs require all5 states including drive-one for consumable overlaps;
  Spellblade daggers/shortsword include18 plain/reflected states in one family.
  Keep named Fighter offhand left/thrust frames with the matching main family.
  test/browser/named-equipment.cjs uses delivered Assets frames for2373 fitted
  fixtures per width, not source substitutions; painted-world.spec.js also checks
  corrupt named weapons, staff released pose, bow and carried images independently.
  preview-batch-ab-runtime.cjs records real class creation/equip/action/Calm/offline
  flows with native updates, no asset routes/proxies; AB_WIDTH splits phone widths.
  See batch-ab-runtime/REVIEW.md for final evidence and historical source limits.
  AC ordinary caster source tools: reference-batch-ac-casters.cjs/.py,
  register-batch-ac-casters.py, export-batch-ac-casters.py --check,
  preview-batch-ac-casters.cjs and gallery-batch-ac-casters.py. Seven exact
  carried pairs cover three Mage foci, three Cleric foci and the Spellblade
  lantern. Six open palms differ from its closed carry handle. Preserve the
  authored source_base and copy it to at.base during future runtime export;
  it fits the lantern cage in short views. Registration measures landmarks only,
  uses complete component crop rectangles and preserves raw pixels; one wooden
  sun crosses the nominal sheet cell boundary. No masks or scripted repaint.
  Source preview freezes updates and proxies exact carried pairs:98 captures,
  294 three-height fits,70 guards per width and full Game/Dice/Odds neutrality
  are not native actions, activation or offline proof. UI class labels remain
  the setup Fighter; only the presentation fixture selects the target class.
  See batch-ac-casters-preview/REVIEW.md. Current delivery stays0.9.39;
  roadmap labels now AC casters, AD shields, AE hands, AF small items, AG regional
  architecture, AH regional secondary materials, superseding prospective AB–AG.
  AD ordinary shield tools mirror AC with the batch-ad-shields suffix. The
  reference captures audit all35 ordinary shield/class combinations through
  actual canEquip and exact active catalog keys:12 legal pairs,5 delivered P/Y
  pairs and7 source gaps (three bucklers, two tower shields, two Quill Shields).
  Export uses one shared physical item scale across classes, authored shield-only
  bounds excluding sleeves, and complete component crops across nominal grid
  boundaries. Quill alpha can look coloured on transparent tool previews: inspect
  opaque composites before requesting a repair; do not mask source pixels.
  Source previews cover112 captures/336 fits and guard active21 carried pairs
  plus AC pending sources. Bash/cast are fitting stress fixtures, not granted
  abilities. See batch-ad-shields-preview/REVIEW.md. AC+AD remain14 local pending
  carried frames, not gameplay/offline activation; subsequent AE–AH source work is documented below.
  AA fourth/fifth melee passes integrate133 class/state frames for0.9.37,
  including clubs and all remaining basic mace/sword/staff/spear class pairs.
  That0.9.37 delivery had460 files,289 held frames and628 shipped paintings plus
  3 icons; prior327 common files retain identical bytes. The held loader must
  copy optional authored tip metadata, as well as nocks, into at for staff glints.
  Spellblade shortsword/longsword include both9-frame lit groups; staff families
  switch all4 hand/pose states together, including released-hand channel/rest.
  preview-batch-aa-melee45-runtime.cjs covers real legal class creation/equip,
  actions/Calm/offline at both widths, including actual lantern removal for plain
  Spellblade swords. No frozen source proxy substitutes for native evidence.
  Painted-world tests cover corrupt club/Ranger shortsword/reflected longsword/
  released-hand staff families,642 three-height bindings, staff tip glints/Calm,
  exact metadata guards and run/dice neutrality. Earlier source reports remain
  historical; see batch-aa-melee45-runtime/REVIEW.md for current release gates.
  AA second/third melee passes are integrated for release0.9.36 through the
  same exact family loader. tools/export-painted-runtime.py --check now covers
  327 files,156 held frames and495 shipped paintings plus3 icons. Include the
  aa-melee2/aa-melee3/aa-reflected manifests; preserve Ranger/Fighter shared source pixels
  with separate class keys and independent failure. Keep authored grips/bounds,
  named/hand-count guards and lazy whole-family readiness. Catalog lit flags are
  explicit: only the9 image-tool-painted Spellblade dagger reflection frames
  accept lit=true. Never discard its lantern reflection or claim unlit source
  bindings alone activate normal Spellblade play. export-batch-aa-reflected.py
  --check reproduces them; source/registration review retains complete sleeves.
  Native evidence
  uses preview-batch-aa-melee-runtime.cjs and batch-aa-melee-runtime/REVIEW.md;
  Spellblade is unlocked through the five real title taps before class creation.
  Source reference-batch-aa-melee2/3.cjs block painted held requests and service
  workers deliberately, retaining procedural geometry after activation. This
  source-reference setup is not runtime fallback or offline integration evidence.
  Do not describe the earlier frozen source proxies as native activation checks.
  Z/AA are integrated for release0.9.35 through the existing exact held-family
  loader. The common exporter reproduces246 files (187 previous plus59 Z/AA),
  with75 total held frames. Keep authored grips/bounds/nocks and whole-family
  lazy upgrades: one failed pose leaves that family procedural, other kits load.
  preview-batch-zaa-runtime.cjs captures real class creation/equip, attack, read,
  drink, Cleric healing, Calm and native offline continue at 390/320; its passive
  drawImage observer forwards native calls unchanged. No renderer/asset proxy
  or frozen update loop. Save source and native evidence separately; see
  batch-zaa-runtime/REVIEW.md. Sword released-hand actions remain procedural.
  Batch Y extends T with exact Fighter/shield, Cleric/shield and Thief/buckler
  carried rear frames. reference-batch-y.cjs captures original class palettes and
  grip geometry; export-batch-y.py --check only crops/scales/registers existing
  pixels at a common scale. preview-batch-y.cjs temporarily proxies exact raw
  class/id pairs and frozen rest/Bash/Calm/cast/read/drink states; this is source
  review, not runtime delivery. Drinking fixtures require useKind=drink and the
  actual seeded Game.spriteFor potion key. Rest/Bash/Calm bounds must fit; action
  lowering may leave the view and sleeves retain existing cropping. Record raw
  source spacing exceptions and keep named/off-class/P Rune-shield frames intact.
  Y is now integrated through paintedcatalog.js/paintedworld.js. Carried metadata
  includes exact id and cls for all five entries (two P Rune shields, three Y
  ordinary shields); build the lookup once and never strip named ids. The native
  preview-batch-y-runtime.cjs observes real equip/Bash/cast/read/drink/Calm/offline
  flows without asset routes, renderer replacements or frozen updates. Keep the
  older source-review evidence separate; see batch-y-runtime/REVIEW.md. The common
  delivery exporter covered187 files in0.9.34 (184 E–T plus3 Y); unchanged historical
  counts describe the original release scope.
  Batch W is a major-screen reuse audit: preview-batch-w.cjs captures actual
  title/prologue/death/three Heart endings and native share cards, phone/landscape/
  desktop/double-text views, delayed key-art recovery and native offline rotation.
  Export-batch-w.py only lays out existing source/export pictures and records
  hashes; no new painting or runtime change is commissioned. Use actual Heart
  pickup and encounter choices with isolated eligibility fixtures, never override
  win/death functions. A deliberately pending image keeps document load/font-ready
  promises open: its screenshot uses native CDP after asserting no web fonts;
  ordinary captures retain font readiness. Review notes double-text title-fact overlap and keeper-caption/generic
  Heart-accent follow-ups without inventing new ending backgrounds. See
  batch-w-preview/REVIEW.md. Batch X completes the optional-effects audit without
  new painting or runtime changes. preview-batch-x.cjs samples the native view
  after actual casts/scroll use with Game.update and Renderer.render untouched;
  preserve observed timestamps and distinguish immediate lightning onset from
  spells with a travelling phase. Fixtures provide resources, a durable target
  and an existing warning, not complete-run or full-HUD coverage. Record only
  available native animation frames; do not stretch lifetimes or replace asset
  routes. Retain Q contact families and procedural travel, swarm, lightning,
  traps/status/Calm. See batch-x-preview/REVIEW.md; future work requires a specific
  demonstrated visual gap rather than inventing another atlas batch.
  Batch V is an interface reuse audit: preview-batch-v.cjs captures actual pack,
  detail, collection, shop and labelled status UI at 390/320px with normal 16px
  and double 32px/safe palette. Fixtures reveal existing content without replacing
  images or renderer bindings. Keep small item sprites, larger approved paintings,
  shared CSS frames and SVG icons; labels stay text. Escape first closes a pack
  detail, so capture navigation closes the overlay with its actual Close button.
  No new painting or runtime change is commissioned; see batch-v-preview/REVIEW.md.
  Batch U is a reuse audit, not new painting: seven already shipped approved
  portraits remain unchanged. generation-batch-u.json records existing source/
  export hashes; export-batch-u.py --check builds review sheets, and
  preview-batch-u.cjs uses actual UI without image overrides. Six public classes
  remain six until the existing five-tap Wayfarer unlock; then seven.42 native
  captures/downloads and32 existing browser checks pass, including all seven
  portraits after browser offline reload. Wait for native fades and scroll the
  prologue portrait into view before captures. U requires audit publication only,
  not another portrait loader/offline integration; see runtime-delivery.json for the separate E–T integration.
  Offline engine checks cut the actual origin connection, as in `offline.spec.js`;
  keep native reloads and error assertions. WebKit's browser-offline emulation
  aborts controlled navigations before the service worker can answer.
  `js/creatureidentity.js` aligns older anatomy, equipment and colours to the
  painted portraits before deriving cached movement poses. Creature redraws belong
  there so named champions inherit the same anatomy. Combat creatures face the
  player; preserve frontal heads and eye contact when refining their silhouettes.
  Keep blink slicing on the
  64-unit grid, and inspect raised equipment plus head crests for clipped tips. `art/identity.json`
  records the identifying traits reviewed for every monster and class;
  `check:art` rejects missing entries. Preserve an empty Abbess face, a smooth
  blind Stalker head, the pale Puffcap, and each class's painted identity.
  In `js/painter.js`, polygon crossings are calculated once per scanline and
  material ramps once per part, preserving the `insidePoly` odd/even fill rule
  and its exact crossing arithmetic. Keep curved-sheet bounds outside the
  pixel loop. The deferred-art readiness deadline stays at 25 seconds; improve
  preparation work rather than extending it or weakening queue/pose checks.
  Generic elite colour variants keep pose links/metadata immediately, but
  their tint canvases and shade arrays are built once on first use and cached.
  Avoid forcing those getters while wiring pose links or warming unused art.
  Normal, relic and legendary item variants reuse their base raster while
  retaining separate outlines and finished canvases.
  `js/assets.js` turns them into sprites (a creature a piece at
  a time, in spare moments) and paints the walls, floors and doors; the wall
  decorations are in `js/walldecor.js`. `js/regionart.js` adds regional masonry,
  floor inlays and door materials before textures are shaded and cached. Keep this
  painter independent of level generation and the run's dice; its own seeded RNG
  must remain deterministic across reloads. Preserve coloured lock plates and
  keyholes, actual pool colours, lighting/fog distances and sprite occlusion.
  Add no per-frame surface painting or animations. `js/regionalprops.js` substitutes
  cached art for existing non-interactive scenery; keep its saved kind, position,
  scale and count, and never substitute barrels, oil casks or other rule-bearing props.
  Keep rubble marked `fell` in its original picture, matching the stones seen falling. `region-art.spec.js` checks
  stable textures, cached shades, unchanged lock colours and visible-foe geometry
  across every theme, including Calm view on both phone sizes and WebKit.
- `js/arcanefx.js`: force, thorn, root, holy, healing, ward and swarm shapes,
  delegated by `spellfx.js` alongside `elementfx.js`. Read existing effect style,
  colour and impact metadata; never change a spell's cost or impact time to fit
  its art. Keep target marks below faces and warnings, with fixed, fading shapes
  and no travel in Calm view. Creature `strike` and `recover` poses are cached
  with their other art; `motion.js` exposes them only after an existing lunge or
  hit, and the renderer omits them in Calm view and gives wind-ups priority.
  Treasure inspection reads `Game.grade`, never hidden quality. Clip glints to
  visible wall columns. `visual-polish.spec.js` covers poses, scenery invariants,
  hidden grades, reduced motion and actual spell cost/timing on both phone sizes.
- `js/mythics.js` and `js/mythicdata.js`: six class Mythics and their tradeoffs.
  Only the final Vigil Lamp in custom delves of at least eight floors offers a
  trial, after choosing its normal aid at its normal cost; Daily/Weekly and short delves keep their rules.
  The trial preview can be cancelled before aid is chosen. It reuses the encounter
  control/recording path and never changes map placement. Record both choices,
  and do not advance the balance bot's clock while the preview is paused.
  `Level.mythicTrial` and one marked ogre persist; death leaves exactly one class
  reward on the floor, including with a full pack. No ordinary loot or XP from
  the guardian. Never deal Mythics through ordinary relic plans, shops, Collector
  or mastery starts. Validate new save fields, wrong-class and multiple equipment.
  Bloodstar pays life after cast validation, bypasses wards, and snapshots its
  bonus with that payment. Last Gate stores at most three for five seconds and
  clears on removal. Its expiry follows fractional `G.t`: validate a finite,
  bounded number, not an integer. `MYTHIC=trial` explicitly accepts/uses the reward in the
  balance observer; ordinary policy remains unchanged. At two life or less, its
  Bloodstar caster must fall through to legal attacks instead of retrying a
  blocked bolt. Benchmark both policies,
  actual trial/reward use, exploration, long delves and ladder rungs.
- Landmark carvings live in `js/regionart.js`: stair art stays on the solid
  jambs and keystone, with the original transparent arch opening preserved.
  Shrine and final-sanctum inlays are baked before shading, never new lights.
  `js/pack.js` reveals newly acquired Legendary/Mythic art only when the player
  opens the pack or takes it there; its memory resets from the carried gear on
  start/load. Never open a modal or pause combat for a find, expose hidden grades,
  or replay the reveal when sorting/equipping. Keep the normal pack actions and
  disable reveal movement in Calm view and reduced motion. Floor Take uses the
  inventory event to redraw once, so a second render cannot cut the reveal short.
- The Pack equipment figure is decorative inline SVG in `index.html`. Slot positions
  use `data-slot` and a CSS grid; the hero's right hand is on the viewer's left.
  Render one `data-hand="left"` slot for shield/focus or offhand, keeping its real
  rules slot as `data-slot`. Two-handed grips occupy its empty state. The item
  detail sheet is a sibling of the scrolling bag, with lore and actions scrolling
  separately. Escape/controller Back dismiss details first and restore item focus.
  Preserve class-specific focus/off-hand labels, hidden quality and existing actions.
  Keep the mannequin SVG at a uniform scale. Its separately measured connector SVG
  joins actual card edges to authored body anchors on resize, outside the game loop.
  Armour sits below the torso so the figure stays visible; selection regions follow
  existing equip destinations, with both hands highlighted for two-handed weapons.
  Class accents use a fixed CSS palette, never item grades or hidden quality.
  Large text hides both decorative SVGs and returns equipment to a two-column list.
  Slot-first browsing filters by existing equip restrictions; the chosen ring slot
  must be passed explicitly when putting it on. New devices default to Compact; an explicit full-grid preference keeps 20
  cells in All. Compact/filter views hide unused rows without changing inventory capacity.
  Compact rows read the CSS `--bag-columns` once per render so narrow phones and
  large text keep complete rows; resize only adds or removes blank cells, preserving
  focused item buttons. Never infer or change capacity from that column count.
  `js/packmemory.js` stores bounded, run-specific UI counts and unread item keys
  in `deepdelve.packFinds`, never on items or in saves. Inspecting clears a marker;
  increasing a stack marks it again. Sorts and loads preserve inspection state.
- `js/delveguide.js`: read-only Quests, Conditions and Recap views, also shared
  with the end screen. Use current bounty, threads, stored finds and kill records;
  never advance objectives or run a discovery scan to render them. Inventory
  search combines category/slot filters and matches only public item kinds and
  known names, descriptions and powers. Its query is transient and resets when
  the Pack opens; typing never drives dungeon keys, and Escape still closes it.
  HUD condition buttons open the matching Journal section; preserve keyboard
  focus as their countdowns update and return to the stable Journal control.
- `visitedPlace` in `rooms.js` reads only a set piece already marked `seen`.
  Place cards, recap and map share its names. Map anchors must also be explored
  floor squares inside that room, never an unexplored centre. Field notes describe
  existing group rules; never inspect hidden monsters to choose advice.
  Companion reactions live in `COMPANION_REACTIONS` and the narrative document;
  they are contextual portrait text, not saved events or run-log entries.
  `companionMilestones` reads the rules' existing rank/trick tables. Views must
  not advance floors, teach skills or change dice. Waiting/fallen companions do
  not react to the hero's current room. Target material sound layers play once
  for both synthesis and loaded samples, beneath the existing warning mix.
- `js/maplandmarks.js`: map landmarks must be on explored ground. Device-local
  `deepdelve.landmarks` remembers encountered NPC coordinates so resolved shrines
  remain marked; never reconstruct undiscovered encounters from generation data.
  Bound and validate that memory and exclude it from recording starting data.
  Selecting a landmark pans the map, never the hero. Use the current map palette.
- `Game.commandCompanion(mode)` reuses the existing facing-adjacent Use action.
  Its observer `companionCommandReason()` blocks ended delves, pending choices,
  held heroes, absent/fallen/wrong-floor companions and different Use priorities.
  Never turn, move or summon a companion to make a portrait order succeed. Append
  the mutator to `RECORD_METHODS` so older method indices stay stable. Rule checks
  compare both controls across all classes, Normal/Hard and three seed sets;
  preserve save/load and replay equivalence. `delve-guide.spec.js` covers the new
  Journal sections, map, condition links, commands and search on both phone sizes.
- `js/geartools.js`: bounded device-local, run-specific favourites, three consumable
  belt assignments and floor pickup receipts in `deepdelve.gearTools`. Protection
  applies to Pack Drop, individual shop sales and bulk sales; never write UI flags
  onto items. Exclude these UI preferences from recording starting memories.
  Belt controls call the existing recorded `Game.useItem`, preserving
  held, vow and waste guards. Large text shows belt icons and counts, keeping
  full names in accessible labels. Do not consume through overlays or the way-in.
  `items.js` emits `loot:` receipts only after actual floor transfers, with actual
  partial quantities and trickster gold. Gifts, purchases, failed pickups and
  things marked `left` are excluded. Receipts are observations outside game saves;
  old saves cannot reconstruct past pickups. Cover both full and partial belts.
  `gear-tools.spec.js` runs on both Chromium sizes and in the mobile WebKit set.
- `js/settracker.js`: distinguish device discoveries, carried pieces and known
  worn pieces; active bonuses must agree with `Game.setWorn`. Keep undiscovered
  piece names hidden. Companion collection status cards use `Game.companionNote`
  for learned abilities rather than duplicating their rules.
- `js/itemdisplay.js`: shared read-only headers, item stats and comparisons for
  the Pack, shop inspection and discovered relic codex. Numbers are labelled as
  item contributions; both-hand previews name displaced gear and restrictions
  without equipping. Weapon-rate estimates use `Game.blowRate`. Never temporarily
  equip gear, mutate the hero or consume dice to generate a comparison. Hide
  unknown quality, unrevealed powers and unidentified paintings. Shop Inspect
  controls must stop payment-row clicks; their detail panels sit outside that row.
- `js/relicart.js`: approved paintings for discovered relic codex entries and
  known selected pack items, with keyboard/touch zoom and named-sprite fallback.
  The 47 exports in `img/relics/` come from four approved sheets in `art/relics/`;
  `python3 art/relics/export.py --check` verifies their manifest crops. Keep
  inventory/floor/held surfaces on their separate small painted routes, and unidentified portraits hidden.
- `js/namedart.js`: one deterministic parts drawer per `RELICS` id, shared by
  floor sprites, pack inspection, discovered codex and held weapons/foci.
  Resolve identity with `namedSprite` and base weapon type with `namedBase`;
  never strip a named id and assume it is an ordinary sprite. Bow and shield
  backs keep their real grips and bow string anchors, with matching materials
  and construction marks. Preserve legacy base-rarity sprite aliases for callers,
  and leave unknown codex entries hidden. Art must not mutate item data or dice.
- `js/companionbook.js`: six companion kinds and device-local discoveries under
  `deepdelve.companions`. Opening a recruitment encounter counts as meeting it,
  even if the offer is declined. Successful recruitment also records starting
  companions and wolves. Loading an older save recovers its companion and
  completed recruitment encounters, never merely generated NPCs.
  `js/companionsview.js` renders the same collection from the title and Journal,
  with hidden unmet entries, keyboard/touch zoom and sprite fallbacks. Portraits
  live in `img/companions/`; sources/crops are in `art/companions/` and use the
  shared portrait exporter. Keep all six exports and both modules cached offline.
- `js/collectionview.js`: the shared Field notes/Gallery switch for bestiary,
  companions and relics, on the title and in the Journal. Gallery notes use native
  disclosures; switching back to Field notes restores all notes. The shared
  layout and bounded viewed-ID lists live in `deepdelve.collections`, excluded
  from recording starting memories and saves. `UI.init` seeds existing device
  discoveries as viewed before a new delve starts. Later discoveries stay New
  until a portrait, closed notes or their marker is activated; layout switches
  and filtering never mark them viewed. Keep an inspected New-filter card in
  place until the next filter action, preserving its notes and keyboard focus.
  Queries and filters are session-only, per collection, shared by title and
  Journal. Filter existing nodes, never rebuild them on input. Folded filters
  retain their selections. Search only rendered discovered text; region/type
  options come only from revealed entries, with numeric traits gated by kills.
  Unknown entries never match text or facets. Storage failures keep session
  preferences working, and Escape from collection inputs uses normal Back.
  `collection-browser.spec.js` covers discovery boundaries, persistence, state
  and dice invariants, inaccessible storage and large-text accessibility.
  Never discover entries, reveal hidden traits or alter game state to browse.
- `js/bestiaryart.js`: painted bestiary and Journal portraits, with creature
  sprites as fallbacks. The exports are in `img/bestiary/`, their source sheets,
  prompts and export tool in `art/bestiary/`; bosses reuse `img/bosses/`.
  Individual repairs live in `art/bestiary/overrides/`, selected by `generation.json`;
  export them after the sheet tiles. `python3 art/bestiary/export.py --check`
  rejects stale exports. `npm run check:art` (also in `npm test`) verifies the
  reviewed source/export hashes in `art/review.json` and every painting's offline
  entry. Re-export and visually inspect changed art before updating those hashes;
  the check records review currency, not an automated judgement of anatomy.
  The class and keeper paintings also select current `overrides/`
  from their generation manifests; `python3 art/portraits/export.py --check`
  reproduces all nine WebPs. Keep original PNGs as provenance when refreshing
  paintings; retain the hero identities already used by the pixel fallbacks.
  Lich, Warlord and Heartforged are bestiary creatures: use the existing
  bestiary paintings as their style/composition references, with characteristic
  bodies, equipment and dungeon habitats. Share those paintings between the
  bestiary and keeper introductions; keep hero portrait framing separate.
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
- `js/release.js`: release version and an internal counter for offline readiness.
  The main-page footer, telemetry identity and GitHub release show the short
  commit ID instead of a build number. `stamp-commit.cjs` stamps the deployed
  full Git SHA into index.html's commit meta tag using Vercel's commit variable
  (or checkout HEAD), never a parent SHA committed into its own source. The local
  server stamps responses in memory. Keep this identity in the cached HTML so
  offline reloads identify the same deployment. Do not hand-edit release numbers.
  `VERSION_ID` is the public identity; keep `BUILD_ID` internal for recordings
  so browser saves and the headless replay harness agree without a DOM.
  For every publication, stage intended changes, then run
  `npm run release:prepare -- --message "<commit subject>"`.
  It detects player files since the current version tag (or last metadata commit),
  defaults to patch even for `feat:` or breaking-change labels, and increments
  the build and offline cache. Group small changes into release batches. A minor
  release needs a substantial gameplay feature or sizeable content batch and an
  explicit `--bump minor`; a major overhaul needs the owner's decision and
  `--bump major`. Docs/tests/CI-only changes leave both numbers unchanged. Stage
  its four updated files before committing. Keep all three package/lock versions
  consistent. Do not infer version milestones from commit labels or file names.
  The owner reset 1.6.0 to 0.9.0 at build 15; subsequent small updates use 0.9.x.
  For an explicitly authorised numbering reset only, use `--reset-version VERSION
  --reason TEXT`. Its new record in `tools/version-resets.json` must match the
  exact old/new versions and builds, with one newer cache and no gameplay changes.
  Never reset build numbers, reuse version tags or move published history. The
  publication job explicitly marks the tested current version as latest, even
  when its number is lower than archived releases.
  CI rejects unversioned player changes and creates the version tag and GitHub
  release only after all seven required checks pass on main. Publication reruns
  are idempotent, skip stale main runs and never move an existing tag.
  The release job alone has `contents: write`; test jobs retain read-only tokens.
  Vercel still deploys main on push; the CI gate governs the GitHub release.
- `js/puzzles.js`: optional catches on existing gold/gems, placed after the floor's
  other rules with a separate seeded stream. `js/puzzledata.js` holds the clues and
  `js/puzzleview.js` their accessible overlay. Every fresh custom/Quick Start hero
  chooses `opts.puzzles` at the prologue; it resets off, and Daily/Weekly keep it off.
  Never gate keys, relics, quest objects or travel, or shift the map/combat dice.
  New caches use `Puzzle.reward`: pending through solving until one share is chosen.
  Alternatives spend the guarded currency at fixed 1.6× base value (enchantment
  included), doubled on Hard ladder rungs, leaving change on the floor. Gear must
  fit the class and depth; no relics or bonus purse. Legacy caches without this
  field release their original coins on solving. Leaving, loading or a full pack
  must never reroll, duplicate or destroy a share. `Item.puzzle` guards collection through both walking and the pack;
  puzzle progress lives on `Level.puzzle`, but the open overlay is transient and
  cleared on load/new game. Validate imported controls in `savecheck.js`, record all
  puzzle mutators, and include clues in the narrative document. Keep the prologue's
  puzzle choice and stair reachable in `.pro-start`; short screens scroll normally.
  Recheck the returning-story and large-text flows when changing that footer.
  Release the unlock animation on completion/cancellation and when the dialog
  closes; its final pose belongs to the base style, not a retained fill effect.
  Keep Tab inside the puzzle dialog even during its input guard; disabled
  controls must not strand focus. Save-transfer browser checks wait for the
  closing animation and history entry before interacting with the restored run.
  Before reloading after leaving a cache, wait for `history.state.dd === 'game'`:
  the fade finishing does not prove Safari's `history.back()` has settled.
  `PUZZLES=solve` in
  the balance bot explicitly answers caches at the current square and collects
  only their guarded currency or chosen conversion, preserving the walking pickup
  policy for other loot. `PUZZLE_REWARD=gold|potion|gear` requests a choice, falling
  back to coins when unaffordable; gold is the default. Default runs keep their decisions. Browser and rules checks are `puzzles.spec.js` and
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
- `js/offline.js` reports core and voice readiness on the title without touching
  gameplay state. Only the current controller's matching build can report ready.
  `sw.js` installs core assets first and activates before downloading narration;
  the page starts resumable downloads through a message event, never install or
  activate `waitUntil` (which would hold functional fetch events). Keep four
  recording requests in flight, preserve completed files on interruption and
  resume on reconnect, visibility or a quiet poll. Both formats, including the
  prologue, belong to the background voice set. Mark all voice ready only after
  every required recording is cached. Keep previous recordings available until
  then; delete only owned old caches on completion. Offline core fetches must
  use the current cache, while voice ranges may use previous recordings.
  `test/offline.js` covers worker lifecycle/recovery; `offline.spec.js` serves
  the real worker with recordings held back on an isolated test server, including
  offline play and recovery in both Chromium sizes and CI WebKit. Unheard-voice
  tests wait for voice readiness before taking the connection away.
  WebKit's Playwright offline emulation aborts controlled navigations with an
  internal engine error. The isolated offline fixture cuts the origin's actual
  sockets in both engines, asserts rejected requests, and retains native reload,
  play, recovery and range checks; Chromium also uses browser offline mode.
  Companion portrait offline checks use the same actual-origin cutoff. Wait for
  the title opening to finish before auditing contrast on any title visit;
  worker readiness and keyboard unlocks can arrive while the menu is still fading in.
- `sw.js`: offline cache. A new module must be added to `ASSETS` (test/run.js
  checks this); bump `CACHE` when the list changes.

## Hidden hero

- `js/hiddenhero.js` keeps the five-activation title unlock in bounded device-local
  `deepdelve.wayfarer`. It is an Easter egg, never authentication. Keep the real
  version button reachable by touch, keyboard and controller, without replacing
  a save or automatically starting a run. Exclude its memory from recordings.
- `js/spellblade.js` owns the Wayfarer's runes, explored-ground step and timed
  guard. All times use `G.t`; cast through the existing recorded `castSpell`.
  Step cannot cross walls or occupants, and landing uses ordinary tile effects.
  Only landed close blade hits spend the guarded return; poison/hunger pass through.
  Validate rune sources, finite clocks and bounded magnitudes on save import.
  Deepward derives only from a held silver lantern beyond floor eight, capped
  at +4 armour; the ordinary eight-floor delve and all public classes gain none.
- Keep the six public class identities, challenge pools and Quick Start unchanged.
  Spellblade has exclusive `TALENTS.spellblade` at even levels and `wf_` lantern
  lessons at odd levels rather than paths or a Mythic; guard offers without a
  matching Mythic. Keep it out of public trophy requirements and unopened cards.
  `wayfarerMagic` shares learned rune/ward limits with save validation and spell
  descriptions. Each learned talent grants the life/spell reserve in
  `CLASSES.spellblade.memory` exactly once; apply and restore it in talent selection.
  Sever the Veil's accuracy requires an active rune and a held blade. Preserve older saves' generic lessons; future offers are exclusive.
  `heldart.js` carries the Silver Lantern by a handle inside a closed left fist,
  with its existing silver cage and blue flame below the grip. Keep its bespoke
  held frame separate from open-palm caster foci; omit the duplicate amber dark-floor lamp.
  Its cached base mark reserves room for the cage and walking bob in short views;
  the forearm may leave the view, but the resting lantern's bottom rim must fit.
  Wayfarer hands use charcoal leather, silver cuff trim and a blue rune. The optional
  fifth `Assets.held` argument caches lantern reflections separately; pass it only
  with the lantern equipped. Paint reflections into the held frame, never into
  world lighting, fog or visibility. Renderer-only lantern settling resets in Calm
  view and on equipment/time resets; move the entire grip and cage together.
  Held throwing knives and Vashti use one blade; keep their pack fans unchanged.
  Carry the Quill Shield from behind with a closed grip and forearm strap, not as a focus.
  `heldview.js` owns presentation-only melee paths and fitting from cached object
  bounds, excluding sleeves. Resting left-hand gear fits within the left 42% of
  the view so full shield rims cannot cover the square ahead. Off-hand strikes
  may reach inward. Use the fitted placement for bow nocks, string and
  drawing hand together. Lower carried bows during left-hand actions and omit the
  spare fist. Resolve named handling through `namedBase`, not suffix matching;
  bow release is 0.72 and knife release 0.4 of the existing swing, as in combat.js.
  The arrow shaft passes through the rest above the bow grip; its point extends
  beyond that rest. Release the string before returning the drawing hand; keep
  its position continuous at release and the end of recovery. The right hand rests
  low on the right, catches the string at 0.16, then draws towards the right cheek.
  The bow rises left of centre during aiming; omit this extra lift in Calm view.
  Cache intermediate poses and draw-flex frames; never paint item parts per frame.
  Surface glints follow existing named sprite materials, never read hidden powers
  or enchantments, never add world lights,
  and are omitted in Calm view. `held-equipment.spec.js` covers fitting, contact,
  release and non-duplicated hands in both Chromium sizes and mobile WebKit.
  Portrait sources/exports and its lantern sprite retain the hood, sword and blue
  silver-lantern identity. The class unlock is not a save dependency.
  Locked class-picker fixtures enumerate the six public heroes; dedicated unlock
  fixtures cover the seventh, including its portrait and biography.

## Visual presentation

- Combat warning glyphs come from the actual wind-up kind and base creature
  sprite, including named variants. Group leaders retain special/boss metadata;
  followers never duplicate the mark. Special tricks keep their burst and
  exclamation; ordinary shots use an arrow and ranged magic a diamond.
  `meleeview.js` draws transient defence receipts from `fx.defence`, never saved
  state. Only genuine shield deflections say BLOCK. Avoided blows must not set
  the damage rim or consume dice; new/load clears receipts and damage takes
  priority. Calm flank chevrons retain urgency through size/brightness without
  pulsing. `melee-feedback.spec.js` covers outcomes, expiry, dice and glyphs.
  `meleeview.js` also names current wind-ups. `motion.js` attaches intent only to
  a creature or pack leader; the renderer selects the nearest one only after its
  normal fog, projection and wall-column checks. `Renderer.intent` feeds a text
  strip outside the canvas, updated only when its words change. Never identify
  off-screen or occluded foes there. Damage text carries presentation-only outcome
  metadata so CRIT also covers Lucky and critical opening blows without changing
  their existing combat tags. Keep the original numeric `Renderer.numbers.text`
  for observers and its drawn `label` separately. Bound wider labels to the
  viewport and keep the full rise clear of every warning; crowded warnings take
  priority when a receipt cannot fit. A continuing volley retains its shot/magic
  glyph even after its initial wind-up has ended. Short HUD condition clocks
  participate in the redraw signature and retain focus across ticks; the chip
  row scrolls within two rows (one in short landscape) with 44px touch targets.
  `deathLesson` reads the existing killing source and active conditions, never
  invents a damage history or assumes a supply could have been used while held.
  `combat-clarity.spec.js` covers intent visibility, actual hit outcomes, warning
  legibility, clocks/focus, death advice and crowded mobile/accessibility views.

- Portrait views can use up to 464 buffer rows; keep the CSS view cap at 1.45
  times its width so pixels stay square. Held-equipment checks include this
  tallest buffer. A ResizeObserver fits the buffer when log, belt or HUD layout
  changes, as well as rotation. The observer only marks fitting pending; the game
  animation frame flushes it before drawing. This avoids Safari resize-loop errors
  and clearing a freshly drawn frame. Preserve projection, fog, lighting and visibility distances.
- The quiet log keeps a 48px strip after six seconds without new messages and
  no awake foe within six squares. Tips, quick scrolls and floor pickups retain
  the roomy log. Fresh messages restore it; full history remains under Log.
  Large text and landscape retain their existing log/control layouts.
- Distant surface detail uses cached softened variants beyond three squares,
  never creature art, doors or lock plates. Hidden secret walls must use the
  same distant filter as ordinary stone; pixel comparisons cover both distances. No surface painting repeats per
  frame, and original near textures and light/shade levels remain unchanged.
  Soft wall canvases use `willReadFrequently: true`, matching the CPU-backed
  source textures so column draws do not repeatedly read GPU textures back.
- Floor and ceiling torchlight interpolate the same square-centred field as
  wall faces. Cache the four light samples per scanline cell and skip this work
  entirely when there are no lights. Preserve source shade/texture caches, wall
  foot shadows, warm colours, Calm flicker, fog and visibility distances. Weak
  torches must never dim the hero's brighter foot light. The
  synthetic uniform-material regression in `region-art.spec.js` isolates tile
  boundary brightness without substituting diagnostic materials into art reviews.
- The first-time title card takes priority over a random greeting for that
  visit. Hero biographies are native disclosures below the selected portrait;
  class changes reset both the portrait zoom and biography.

## Checks

Before every push, run `npm test`. Player-facing implementation changes also
require both full Chromium projects and the isolated frame-rate budget below.
For release tooling, documentation and version-metadata-only changes, run
`npm run test:release` and `release.spec.js` on both Chromium projects locally;
CI still runs the full Chromium, WebKit and performance suites and blocks GitHub
publication until all seven required checks pass. Do not weaken assertions or
skip any CI job for this exception. WebKit is not installed in this container.
Wait for every CI job, including publication when applicable, before reporting
a pushed change as verified.

- `npm run test:release`: isolated Git fixtures check release selection, metadata,
  CI rejection and publication retries/API failures; included in `npm test`.
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
- `npx playwright test --project=phone`: the full phone-viewport browser suite;
  runtime depends on hardware and deferred art preparation.
  Chromium is preinstalled; do not run `playwright install` locally.
- `PERF=1 npx playwright test --project=perf --workers=1`: the frame-rate
  budget (`test/browser/perf.spec.js`), 4x CPU throttle, about 40 seconds. It
  skips without `PERF=1`, since beside other tests it measures the load.
- `npx playwright test --project=small`: the interface, play and accessibility
  specs again at iPhone SE size (the device matrix, `docs/DEVICES.md`).
- `npm run test:webkit`: focused `@mobile` tests in Playwright WebKit, installed
  in a separate CI job and run on one worker. Keep full navigation, narration
  and error assertions, and tags on the audio unlock/mute, portrait, fog and
  touch/save regressions. Playwright is pinned to 1.59.1: version 1.56's WebKit
  crashes on reload (microsoft/playwright#37766, fixed in 1.57). Verify native
  reloads when upgrading. `npm run test:browser` runs the two Chromium projects
  locally; do not install WebKit in the local container. Linux WebKit and an
  iPhone-sized Chromium viewport do not establish a real iOS Safari pass;
  record physical checks separately in `docs/DEVICES.md`.
- `test/browser/a11y.spec.js` runs axe (WCAG 2.2 AA) over every screen and overlay: no fault
  rated serious or critical. A new overlay goes into it. `test/browser/access.spec.js` checks what
  axe cannot: text at twice its size on three phone shapes, the reader's log, the palette, Calm view, one-handed reach.
- CI (`.github/workflows/test.yml`) runs `npm test`, the browser tests in
  three shards, the small phone, the focused WebKit checks, and the frame-rate budget alone on every push
  Full-cache offline installation checks run in a separate serial step in each
  Chromium job; competing workers exceed the unchanged ten-second installation
  deadline with the full painted catalog. Both steps retain the same shard filter,
  so every test runs once; an empty offline shard is expected.
  These checks await the existing deferred art queue before starting their
  unchanged installation deadline. Voice resume discovers missing recordings
  from one cache-key snapshot; avoid per-clip scans of the painted catalog.
  WebKit keeps its native offline setup without draining the entire unrelated
  raster queue first; that queue can consume the whole test budget in this engine.
  Held animation capture waits for every referenced painted pose before storing
  image identities, since a completed rest pose does not imply a decoded drive.
  to `main`.
  `tools/install-browser.sh` retries the same browser/dependency install up to
  three times for transient package-mirror failures. Exhaustion fails the job;
  it never skips a browser project or changes test retries and assertions.
  On GitHub runners it replaces the stalled Azure Ubuntu mirror with Ubuntu's
  canonical HTTPS archive; package signature verification stays enabled.
- `.githooks/pre-push` checks the version against the remote main commit, then
  runs `npm test` on the exact commit being pushed to
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
  paths on Normal and Hard; shared systems require all six public classes and the hidden Spellblade when affected. Also test
  affected run lengths and ladder rungs when those systems change.
- For treasure or exploration rewards, include a matched `EXPLORE=0.8` pass
  and record how often the new feature was used. The default stair-seeking bot
  can miss caches; unvisited rewards do not establish their balance.
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
  Validate items in floor loot and NPC stock with the same checks as carried
  equipment; those items can enter the inventory after loading. Escape belt
  counts in both text and attributes even after validation.
  Legacy Hall migration, bestiary reads and progress writes must require own
  table IDs, not inherited properties. Stored counters accept finite numeric primitives and
  legacy numeric strings; never coerce stored objects through `Number`.
- Telemetry accepts bounded fields, rejects cross-origin browser submissions and
  throttles using short-lived keyed address digests. The public stats API must
  never return individual reports or error messages, including old counters.
  Keep Redis credentials server-side. API responses bypass the service worker.
- `SECURITY.md` documents security boundaries; record reviews under `docs/`.
  CI uses Node 24 and no persisted checkout credentials. Tests use read-only
  permissions; only the successful main release job may write GitHub releases.

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

- Prepare release metadata before starting browser workers. `release.spec.js`
  reads the package version when its worker loads; changing the version during
  a run leaves that assertion comparing a cached version with the current page.
  If this happens, finish the run and recheck the release spec in fresh workers.
  The local server also captures the commit at startup: restart it after a commit
  before running release identity checks, or it will serve the previous SHA.

- Switching from touch/keyboard to a controller must show the ring even when
  focus already sits on a valid stop; the first A rings, the next A selects.
- A controller initially focuses the first visible `.primary` button. An
  optional title greeting must not take that class from New Game or Continue;
  run the controller tests when adding title controls.
- The narration audio element changes its `src` as readings advance. Playback
  tests must associate captured evidence with the intended recording, and
  exercise Ogg as well as the browser default (local Chrome may prefer AAC).
- A test with the sound pack enabled waits for `Samples.state().listed` and
  `Samples.state().waiting === 0`, and asserts no failed loads, before a deliberate
  native reload. WebKit can report cancelled old-document sample fetches as
  access-control page errors. Keep the reload, autoplay and error assertions;
  do not hide those errors in the global watcher.
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
  Finish multi-context native art captures before the full browser projects:
  concurrent capture can starve the fixed25-second deferred-art queue gate.
  Keep its deadline and assertions; recheck contention failures alone.
- The first tip (about the controls) holds the dungeon still while it is up.
  Browser tests therefore start with tips off; `startGame(page, { tips: true })`
  turns them on for a test that is about tips.
  A test about dismissing a tip enables them through the Menu after startup,
  so the seven-second reading timer cannot expire during initial art work.
- A browser test that waits for a monster's blow to land must allow for
  misses: take the hero's armour off, or give it several seconds.
- Playwright 1.59's `waitForFunction` treats an async predicate's Promise as
  truthy rather than polling its eventual boolean. Import a module once through
  `page.evaluate`, then poll a synchronous predicate using that captured function.
  Do not relax assertions or deadlines to compensate for unfinished atlas work.
- A creature's poses, champions and close-up are painted after its plain
  picture, in spare moments: a test about how one is drawn calls `artReady(page)`
  (helpers.js) first. When asserting specific poses, pass their names, for
  example `artReady(page, { grey_dwarf: ['windup', 'special'] })`: this waits
  for those pictures without waiting for unrelated art. Base Shade readiness does
  not include its deferred class gear: wait for each required shade.elite class
  pose before asserting its native binding, particularly in WebKit. The whole cache can
  take over a minute at 4x CPU slowdown; keep the existing timeout and await
  the relevant readiness signal instead of adding a fixed sleep.

### AE/AF source tools and integration cautions
AE/AF source tooling preceded native activation for0.9.40. Use `python3 art/creatures/export-batch-ae-af.py --check` for reproducibility; reference/register/export/preview/gallery tools live alongside generation manifests. `plan-batch-ae-af.mjs` is initial planning only: do not rerun over completed generation manifests. AE null-id class/pose/two/lit routing is exact; Ranger reuses verified Fighter geometry. Native quiet hands crop lower wrist at viewport bottom. AF has 140 live keys and two reserves (`key`, `amulet_tooth`); preserve seeded appearances through identification, 47 separate large relic portraits, native rarity outlines, cached shades/flashes and floor scale/hover behavior during future activation. Frozen source previews do not prove native actions, runtime loading, offline or performance. Source reviews document selected repairs and honest visual coverage.

### AG/AH regional source tooling
`reference-batch-ag-ah.cjs` captures native regional geometry/material/decor slots; `reference-batch-ag-ah.py` composes guides without overwriting production manifests. `generation-batch-ag-ah.json` records selected/rejected provenance. `export-batch-ag-ah.py --check` reproduces 405 native singles/detail exports and 25 source atlases plus diagnostics; opaque RGB material encoding omits incidental near-opaque source alpha and rejects holes; one-pixel crop insets exclude sheet seams. No scripted source painting or arch mask correction. `preview-batch-ag.cjs` and `preview-batch-ah.cjs` capture frozen source booths at 390/320; `gallery-batch-ag-ah.py` composes review galleries. These are not activation tools. AG uses 84 new candidates plus 12 shared approved R eight-bar gates; AH has 240 regional materials plus 69 decoration slots. Exact native arches remain authoritative (new alpha differs 15–17 pixels); shared gate masonry needs native regional edge/lock composition. Review adjoining wall/decor/door courses, repeat seams and torch bracket stability before activation; retain procedural variants when unresolved. AH decoration fixtures force each candidate into native slots so central native ornaments cannot cover the selected picture; they do not prove seeded slot generation. AH previews eagerly allocate all regional shade levels for audit; production must remain lazy and bounded. See `batch-ag-ah-preview/REVIEW.md` for honest coverage and integration limits.

### AC–AH native delivery for 0.9.40
`tools/export-painted-runtime.py --check` now reproduces 1,550 catalogued files (577 additions;973 prior files unchanged), including 810 held frames,35 carried frames and regional materials. Preserve optional carried `base` landmarks through catalog and heldFrame; the Wayfarer lantern renderer requires `at.base`. Family lookup must also compare strict metadata id/class: null and the literal string `null` otherwise collide in a concatenated cache key. AF keeps reserved `key`/`amulet_tooth` excluded, seeded identification and 47 independent large relic portraits. Cached rarity outlines use variant-specific image entries and cached Pack data URLs; base and rarity aliases must not share an unoutlined completed frame.
`paintTheme` starts image/level work on property demand, increments material revision on late floor/ceiling decode and caches composition independently: original exact arch alpha, native regional gate edges, unchanged coloured lock patches, and a stable lower torch wall/bracket below y 30. Source alpha/crop files are never silently changed. Failed decoration/torch families retain their native family until complete; other images remain independent. Production must not eagerly warm all regional shade caches as review fixtures do.
Native capture scripts are `preview-runtime-{casters,shields,hands,items,regions}.cjs`, under `batch-ac-ah-runtime/`; they use shipped Assets/Pack pictures without source substitutions, with frozen scene fitting clearly labelled. `gallery-runtime-{casters,shields,hands-items}.py` composes diagnostic captures. Browser tests in painted-world cover all new native equip pairs, exact hand guards, mask/edge/lock byte equivalence, torch stability, rarity/seeded appearances, corrupt-image independence and all-export offline reload. When testing demand-loaded region snapshots, warm the same requested fields before awaiting readiness on each reload. Full Chromium and isolated performance checks remain required for publication.

### Item review capture readiness
`preview-runtime-items.cjs` uses `deepdelve.calm=1` (the string `on` is not a valid preference), decodes selected large portraits as well as small images, and waits for their CSS animations before saving evidence. A screenshot during the 240ms item fade can make a bright approved portrait appear almost black. Preserve historical captures; use settled native captures to judge brightness. The first follow-up review and repeatable running-game capture are in `docs/visual/2026-10-25-art-polish/`.

### Enlarged text in title and overlays
At enlarged text sizes, title news/facts take normal document space before the logo; keep the landscape logo aligned to the top of the menu column. Trader/Journal headers reserve Close in the first row and wrap balances/counts below. Journal tab columns respond to the enlarged font, and trader item/service actions flow beneath their descriptions. Keep these rules scoped to `body.big-text`; never shrink text to make labels fit. `access.spec.js` checks real longest greetings, returning News, shop inspection without payment, header text bounds and unsplit tab/item words at320/390/740px. These paused-menu layouts do not alter combat controls or game rules.


### Fallen hero portraits
`fallenPortrait(cls)` in `js/portraits.js` demand-loads independent class death paintings from `img/portraits/fallen/`, with an immediate skull fallback in the class cloth color. Keep living/class-picker portraits untouched. Late loads update both the visible death image and the same canvas used by share cards. `cardInfo` supplies a bounded portrait readiness promise before export; do not block sharing indefinitely on a stalled image or export a different run after navigation. Death portraits keep earned mastery borders and their painted colors, without the old grayscale/dimming filter. Sources, exact prompts and Cleric/Mage ear repairs live in `art/portraits/fallen/`; `python3 art/portraits/fallen/export.py --check` reproduces seven 512px WebPs. Keep class coverage, reviewed hashes and offline entries complete. Native death/export/save-load checks and failure/slow/offline regressions live in `portraits.spec.js`; victory coverage stays in `endgame.spec.js`.


### Share-card selection and loading
`endscreen.js` derives keeper captions from `Dungeon.keeperOf` and both picture/line outcomes from `ENDINGS`. Take uses `artifact`, quench uses `quench` with a cool backdrop, and keep uses `heart_dais`; these reuse existing approved world images. Killer and companion cutouts use canonical idle frames through `paintedCreature`, retaining named champions and known class Shade gear. Read a Shade’s class from the current floor’s bones; unknown legacy Shades use remains rather than invented Fighter equipment. A companion on a death card is named only; fallen, off-floor and unknown kinds are omitted. `prepareArt()` warms only the card’s own pictures and waits at most1.5s alongside the hero portrait, then draws current cached frames or independent fallbacks. Never drain all assets to export or let a late request share a different run. `paintedCreatureSettled` treats failed and unbound images as settled. `sharecard.spec.js` covers native ending choices for all three keepers, all six companions, exact export pixels, named/class killers, failure/late upgrade and offline export. Include it in the small-phone project filter. Full-cache offline ending checks run serially with the existing two offline-install test titles in CI; preserve their deadlines and coverage. No new painting or game-rule change is implied.


### Epic Heart delivery
The approved molten core and matching two-step dais live in `art/creatures/heart-polish/`, with exact generation prompts, source PNGs and registration measurements. `python3 art/creatures/heart-polish/export.py --check` (Pillow) reproduces their256px exports with uniform scaling, an alpha>=8 crop plus a four-source-pixel fringe, and baseline238. `runtime-overrides.json` selects these two files inside `tools/export-painted-runtime.py`; the common exporter rejects unused override keys and records selected sources in runtime-delivery.json. Run its `--check` too. Preserve the historical AF/K source reviews and all1548 other delivery images. Runtime URLs remain `img/world/artifact.png` and `img/world/heart_dais.webp`, shared by floor/Pack/encounter and Take/Keep cards. `itemart.js` and `props.js` retain matching stone/iron/fire procedural fallbacks. The rendering registration changes no item scale, quest gate, inventory semantics or ending rules. `docs/visual/2026-10-26-epic-heart/capture.cjs` records native390/320 final-floor, Pack, encounter and Take/Keep exports with supplied enemy defeat/resources and no image/renderer substitutions. Run captures before performance/full browser checks to avoid CPU contention.

### Crowd damage receipts
`renderer.js` separates intersecting projected floating labels vertically across enemies, after existing warning avoidance. Keep horizontal target registration, font sizes and warning protection; preserve costs, impact timing and seeded outcomes. `combat-clarity.spec.js` covers aligned depths in ordinary/large numbers. Native running captures and bounded review are in `docs/visual/2026-10-26-phase1-combat/`.

### Keeper/victory review fixtures
`docs/visual/2026-10-26-boss-audit/` records keeper intros, controlled phase/tell/spell frames and native ending flows. `combat.cjs` freezes simulation after the actual intro and supplies the spell midpoint; these are fitting views, not native phase-transition or balance evidence. `endings.cjs` reaches generated final floors and uses real Heart choices/downloads with enemy defeat/resources supplied. Preserve these scope labels and keep capture manifests separate.

### Rare equipment motion audit
`docs/visual/2026-10-26-equipment-audit/capture.cjs` runs native actions for28 named carried/bow/Heartroot class pairs at320/390/740px, with exact draw-key/timestamp traces. It does not freeze updates, substitute Assets or reload offline. Its inherited null offline-cache fields mean not checked. The accompanying report separates native action coverage from the broader deterministic fitting matrix and historical Safari evidence.

### Installed-art upgrade audit
`docs/visual/2026-10-26-installed-art-audit/upgrade.cjs` serves a historical checkout and current source on one origin, then runs real worker update, failed-core install/retry and offline Continue checks. Create its separate baseline worktree at the exact documented commit; remove it after the audit. Default v0.9.43 checks actual changed Heart bytes; v0.9.44 has the same paintings as current and cannot alone prove changed-art replacement. Preserve these baseline/scope distinctions and run full-cache profiles serially before other browser workers.

### Sliding door surfaces
`Assets.doorLeaf` caches the inner48×60 leaf (x8,y4) of each64px door/gate source in a WeakMap. The renderer uses that leaf for both closed and moving slabs, before crack/fire effects. Masonry comes from the fixed world walls/jambs; never translate the complete framed painting. Source textures/lock patches remain unchanged; a late painted source has a new cache identity. Preserve door ray intersections, texture scrolling, collision and timing. The painted-world regressions check surround exclusion, independent cache identity and104 region/cell/opening-state routes per project with unchanged run/dice.

Apply cracks to a ray-hit leaf (`shutAt`), including when its tile is already open.
The moving remnant of a burned door uses its final charred stage from `burntDoors`
after its fire field becomes ash; never apply this texture to adjacent jambs.
Keyed unlocks must call `setTile` before deleting the saved lock, so `doorMoves`
can retain the actual colour. The final saved tile, key consumption and lock
removal remain unchanged. Native opening/closing and fire-expiry regressions
live in `painted-world.spec.js`.

### Combat effect layering
Painted fire/frost impacts in `elementfx.js` use the same bounded target radius
as procedural impacts; full projection height must never set their size.
`renderer.js` draws spells before floating receipts and clips each warning
rectangle separately, preserving overlapping warnings as well as Calm view.
Keep spell duration/impact phase, costs, hit flashes, corpse timing and dice
unchanged. The native action review in `docs/visual/2026-10-27-combat-effects/`
is distinct from deterministic synthetic pixel regressions in elemental-feedback.

### Native staff overlap timing fixtures
The named staff read/drink test prepares its first visible enemy and waits for
art work before measuring the short swing. Start attack and consumable on a
fresh animation frame, whose game loop has refreshed the presentation clock.
A guessed timer can resume after the entire 330ms swing while raster work runs;
waiting longer for the missed frame cannot recover it. Keep native actions,
released `drive-one`, restored `rest-two`, both 5s polls and the 120s test limit.
The diagnostic comparison lives in `docs/verification/2026-10-27-staff-timing/`.

### Floor row lighting constants
The hero's own floor light is constant across each projected row. Compute its
shade and floor/ceiling warmth steps once per row, retaining original torch
interpolation and exact per-pixel rounding wherever torch light dominates.
Preserve foot shadows, cave roofs, fog, source levels and texture sampling.
The verification record is `docs/verification/2026-10-27-render-headroom/`.
It retains controls and rejected interval-cache variants: favorable frozen
render timings did not carry through to the unchanged native FPS budget.
Never weaken that budget or publish a diagnostic gain as universal speedup.

### Settled accessibility audits
Use `uiReady` from the browser helpers before auditing a newly opened screen or
overlay. It waits for finite animations in the active panel and for outgoing
overlays to close, with a bounded 10s wait; infinite decoration does not block it.
It does not disable motion, advance the game, drain deferred artwork or omit
axe rules. A fixed 250ms sleep is not a reliable readiness condition across
engines. Keep the guide's complete navigation, overflow, keyboard and
serious/critical assertions. The regression stretches the native Pack fade and
checks that a visible low-contrast label still fails. The original exact-
background-color negative control did not produce an axe violation; use visible
low-contrast text for this guard. The diagnostic comparison is in
`docs/verification/2026-10-27-ci-refactor/phase1/`.
