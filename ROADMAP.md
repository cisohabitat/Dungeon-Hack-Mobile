# Deepdelve: roadmap towards an AAA feel

A phased plan for taking Deepdelve from a deep, well-tested browser roguelike to
one that feels finished in every corner. Written October 2026; tick items off
as they land, and update the "Where we are" table when a phase closes.

## What "AAA" means here

Not the studio sense (hundreds of people, orchestral score, cinematics): that
is not the target for a vanilla-JS phone game. The target is an **AAA feel**:
nothing rough anywhere, every system finished to the same standard, a first ten
minutes that sells the game, and a presence on stores and devices that does not
betray its origins. Hades, Slay the Spire and Dead Cells are small-team games
that read as AAA to players; that is the bar.

## Where we are (October 2026)

| Area | Today | AAA-feel bar |
|---|---|---|
| Systems | 6 classes, 12 paths, capstones, renown, relics, encounters, companions, elements, 46 monsters, 3 peoples, Long Delve | Comparable in breadth; depth per system is uneven |
| Code | About 28,500 lines, no build step; `game.js` 5,400 lines | Fine for shipping; `game.js` size slows every change |
| Testing | 543 rules tests, 249 browser tests, balance bot, CI | Strong. Missing: performance budget, device matrix |
| Art | All procedural pixel art, generated at load | Consistent and distinctive; lacks authored "hero" moments (key art, boss reveals, title) |
| Audio | Fully synthesised in Web Audio, no samples | Coherent but thin; no mixed music, no weight to impacts |
| Onboarding | Prologue, coached first fight, tips | Good; each grade still finds gaps (lessons unexplained, jargon) |
| Narrative | Prologue, journal pages, encounter text | No arc, no ending variants, few recurring characters |
| Platform | PWA on Vercel, offline cache | Not on any store, no cloud save, English only, no controller |
| Balance | Benched to about ±5 points across seven modes | Best in class for the size; some noisy classes remain |
| Analytics | None | No view of real players at all |

## Order and dependencies

```
Phase 0 (foundation) ──► Phase 1 (first ten minutes) ──► Phase 2 (depth)
                     └──► Phase 4 (platform), once Phase 1's design system exists
Phase 3 (story) after Phase 2's synergy and boss work, so endings have mechanics behind them
Phase 5 (live game) needs Phase 0's telemetry and Phase 4's accounts
```

About seven to eight months of focused work, plus commissioned art (one key
piece, boss portraits), composed or licensed music, and translators.

---

## Phase 0: Foundation (3–4 weeks)

Everything later needs to be measurable. Without this, every later phase is guesswork.

- [ ] **Opt-in telemetry**: run start and end, floor reached, cause of death, class and path, device, frame-rate buckets, tips dismissed. A static JSON POST to a small endpoint (a Vercel function and KV store). Off by default, one tap on in the Menu, with a plain privacy note.
- [ ] **Crash reporting**: `window.onerror` and unhandled rejections to the same endpoint, carrying the seed and a save hash, so any crash can be replayed from its seed.
- [ ] **Performance budget in CI**: a Playwright test that throttles the CPU 4× and asserts at least 30 FPS on floor 7 during a fight, on a flooded floor, and during the lich's rite. A push that drops below fails.
- [ ] **First-minute hitches on slow phones**: the pictures painted in spare time after the title (every creature with its poses and champions, the items, the props) take about 8 seconds on a desktop processor and 90 seconds slowed four times, and each creature is one piece of 50 to 440 ms. While that queue runs, a fight slowed four times holds about 12 fps; once it is done, 45 to 56. Paint each creature's poses and champions as their own pieces, the first floor's kinds first.
- [ ] **Device matrix**: monthly runs on an old Android (Pixel 3 class) and an iPhone SE, real devices or a device farm, against a written checklist.
- [x] **Split `game.js`** (October 2026: 5,400 lines to 1,982, eleven new factories, every bench fingerprint unchanged; `creatures.js`, `ui.js`, `renderer.js` and `assets.js` are still over 2,000): move combat, items and inventory, levelling, and save/load into factories in the pattern `foes.js` already uses. No file over 2,000 lines. Prove behaviour byte-identical with a fingerprint test, as done for the floor-size work.
- [ ] **Accessibility baseline**: run axe on every overlay; fix contrast and focus order; label every icon button.

**Exit criteria**
- A dashboard shows real players' win rates by class beside the bot's.
- No source file over 2,000 lines.
- CI enforces the frame-rate budget.
- No axe violations rated "serious" or above.

## Phase 1: The first ten minutes (5–6 weeks)

This is where a player decides whether a game feels AAA. Deepdelve is good from the first fight; it needs to be good from the first pixel.

- [ ] **Title sequence**: one authored piece of key art, slow parallax, a music swell, and room for the "last run" line already there. Skippable at a tap.
- [ ] **Design system pass**: one type scale, one spacing scale, one set of button states, one sheet of colour tokens, and every overlay rebuilt on them. Each screen was tuned on its own, which is where the graders' "small overlaps" come from.
- [ ] **Transitions**: screen changes, overlay openings, descents and level-ups each get a 150–250 ms movement with a sound. No hard cuts anywhere.
- [ ] **Sound design pass**: mixed samples (CC0 libraries, lightly processed) for blows, doors, footsteps and the interface; keep synthesis for magic. A limiter and a proper mix bus, ducking under the lich's lines and level-ups.
- [ ] **Adaptive music**: layered stems (exploring, tension, fight, boss) crossfading on the states `music.js` already tracks. Four themes (plain, Crypts, Warrens, the lich) plus the peoples' floors, composed or licensed.
- [ ] **Haptics**: `navigator.vibrate` patterns for blows taken, level-ups, death and forcing doors, with an off switch in the Menu.
- [ ] **Onboarding fixes from the grades**: explain "lesson" on the level-2 card; show the chosen background beside the Descend bar; a 60-second "first time here?" card.

**Exit criteria**
- A fresh-eyes phone grade of 9 or more for first impression, feel and polish (October 2026: 9, 8 and 7.5).
- Median session length rises (telemetry).
- Day-one return rate measured and a target set.

## Phase 2: Depth and build identity (6–8 weeks)

The systems are broad. The bar for an AAA roguelike is that by floor 4 a player can name their build.

- [ ] **Synergy layer**: 20–30 explicit interactions between talents, relics, oils and elements that the game names when they happen (for example, a Frostweaver with ice oil shattering frozen foes). Each gets a codex entry, bestiary-style, once discovered.
- [ ] **Item tiers**: affixes exist; add rarity colours, a legendary tier with build-defining effects (one per class per path), and a "this run's finds" row on the hero sheet.
- [ ] **Boss design pass**: give the named champions and the Long Delve's final boss what the lich and the Warlord have: a telegraphed opener, a change to the arena mid-fight (the elements system can do this), and a last-stand behaviour.
- [ ] **Encounter consequences**: make 6–8 encounter choices pay off visibly two floors later (a freed prisoner opens a door; a refused toll means the ogre waits by the stair).
- [ ] **Meta-progression that adds options, not power**: renown exists; add 10–12 unlocks such as new backgrounds, a fourth companion, alternative starting kits, and a menu of self-imposed pacts with score multipliers.
- [ ] **Difficulty ladder**: Hard is a single step. Add Hard+1 to Hard+5, each one clear rule in the manner of Slay the Spire's ascension, benched to a smooth win-rate curve.

**Exit criteria**
- Bench spread between classes of 6 points or less on every mode.
- Telemetry shows at least 60% of wins use one or more named synergies.
- The end screen names the run's build in a line.

## Phase 3: World and story (5–6 weeks)

- [ ] **A spine**: who the lich was, why the Heart matters, what the peoples below fear. Restructure the journal pages into a three-act arc delivered floor by floor, the two roads (Crypts and Warrens) telling different halves.
- [ ] **Recurring characters**: one named Lampfolk trader who remembers you between runs (the progress store already has the hooks). The fallen hero's shade already does this well; extend the pattern.
- [ ] **Three endings**: take the Heart, destroy it, or bargain with it. Each turns on a choice made mid-run and has its own end card and Hall entry.
- [ ] **Environmental storytelling**: the set pieces (shrine, cells, cistern, rubble) each get two or three variants with their own props and log line, so a shrine is not always the same shrine.
- [ ] **Two more roads or regions** for 12- and 16-floor delves, built on the `BUILDS` table: a drowned level and a forge level are cheapest, since water and fire are already systems.
- [ ] **One narrator's voice**: prologue, tips, encounters and endings edited together as one document in one register.

**Exit criteria**
- A player who wins can say what the Heart is.
- The split between endings shows in telemetry.
- More than 40% of winners complete the journal.

## Phase 4: Reach and platform (5–6 weeks)

- [ ] **Store builds**: a Trusted Web Activity for Google Play and a Capacitor shell for the App Store, from the same codebase, with listings built on Phase 1's key art and screenshots per language.
- [ ] **Cloud save**: save codes exist; add optional sign-in (Apple, Google) with conflict resolution, so a phone and a tablet share a hero.
- [ ] **Localisation**: extract every player-facing string. These are written in the game's voice, so they need translators who write, not a service. Launch languages: German, French, Spanish, Brazilian Portuguese, Japanese, Simplified Chinese. The name tables need per-language versions.
- [ ] **Controller and keyboard**: Gamepad API mapping, focus rings on every overlay, a Steam Deck layout. This opens a later Steam release through Electron.
- [ ] **Tablet and desktop layout**: generalise the landscape layout; add a wide layout with the map docked beside the view.
- [ ] **Full accessibility**: a screen reader can use every menu and the log; colour-blind palettes for warning marks and the map; a reduced-motion mode; text scaling to 200% without breakage; a one-handed mode (the left-handed layout already exists).

**Exit criteria**
- Live on both stores with an average of 4.5 or better.
- Six languages shipped.
- WCAG AA on every menu.
- A run completed from start to finish on a controller alone.

## Phase 5: Live game (ongoing, from month 7)

- [ ] **Daily and weekly challenges with leaderboards**: dailies exist; add server-verified scores (the seed and the run's log replayed headlessly by the bot harness that already exists) and a weekly challenge with a fixed set of modifiers.
- [ ] **Content cadence**: a new monster or encounter every two weeks, a named champion every month, a road or people every quarter. The generator makes this cheap; the bench keeps it honest.
- [ ] **Balance from telemetry**: the bot's figures beside real players', by class and difficulty, reviewed monthly; the README balance table becomes a live dashboard.
- [ ] **Community hooks**: run cards exist; add seed-of-the-day sharing with a replay link, and a data-only mod format (JSON monsters, items and encounters) loaded from a URL.
- [ ] **Seasonal pacts**: a themed set of modifiers for six to eight weeks, with its own Hall page.

---

## What not to do

- **No engine rewrite, no 3D.** The software renderer is the game's identity, and it runs on old phones. Polish it (Phase 1); do not replace it.
- **No multiplayer.** The cost is enormous and the genre does not need it; leaderboards and seeded races give the social side.
- **No microtransactions.** A premium price on the stores and a free web version is the model that suits the game.

## Where to start

Phase 0's telemetry and the `game.js` split. Telemetry because every later argument stops being a guess; the split because nearly every change in Phases 1–3 touches that file, and at 5,400 lines it already slows work down.
