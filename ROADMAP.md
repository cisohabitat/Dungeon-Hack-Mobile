# Deepdelve: roadmap, the second year

The first roadmap (October 2026) took Deepdelve from a deep, well-tested browser roguelike
to one finished to one standard in every corner: its Phases 0 to 4 are built, and the store
builds, cloud save and localisation were dropped by choice. This one was set by the fresh
review of 11 October 2026 (`docs/REVIEW.md`: a phone playtest, a code review and a design
review; its findings are cited here as P, C and D with their number). Tick items off as they
land, and update the table when a phase closes.

## What is settled

- **A free web game.** No stores, no accounts, no microtransactions, no translations. Save
  codes carry a hero between devices. (Steam through Electron is an open question, decision 5.)
- **The software renderer is the game.** No engine rewrite, no 3D, no multiplayer.
- **The checks stay the gate.** Every rule a rules test, every control a browser test, every
  balance change benched on three seed sets, every file under 2,000 lines.
- **Meta-progression adds options, not power.**

## Where we are (11 October 2026)

| Area | Today | The review's finding |
|---|---|---|
| Grades (out of 10, from play) | First impression 8, feel 7.5, polish 7, clarity 7.5, depth 8.5 (the first roadmap began at 9 / 8 / 7.5) | The key art went in and the first impression fell: the first-time card covers it (P9). Feel wants weight (P1, P16, P12); polish wants the modal choices' empty half and Double text (P2, P3) |
| Systems | 6 classes, 12 paths with capstones and legends, 32 combinations, Hard to Hard+5, 46 monsters, 3 peoples, 2 regions, 3 endings, Wick, the Daily and the Weekly | The build arrives on floor 5 or 6 of 8 and the capstone on the last floor or never (D1); the fork comes before it (D2); rests wipe a floor's wear (D3); three rungs are taxes (D6) |
| Code | About 32,600 lines in 72 modules, none over 2,000 | Four files within 300 lines of the limit; `test/rules.js` 15,300 lines in one process (C7); the K objects untyped (C8); every fight roll unseeded (C4) |
| Testing | About 600 rules checks, 301 phone and 60 small-phone browser tests, the frame-rate budget, the balance bot, CI in shards | A flake on unseeded dice (C2); 125 fixed sleeps and CI retries (C9); four rules and two overlays unchecked (C11, C12) |
| Art | Procedural pixel art, key art behind the title | The prologue has nothing to look at (P10); no boss portraits |
| Audio | A sound pack and four-stem music, rendered in code, replaceable file for file | Still the one thing between the game and a 9 (P12) |
| Platform | PWA; controller, screen reader, safe palette, text to Double, one-handed, the wide layout | A held stick walks the next hero (C1); Double text clips (P3) |
| Analytics | Telemetry and the dashboard built | Counting starts only once an Upstash store is attached in Vercel (decision 1); the API takes free text unthrottled (C3) |
| Live | Daily, Weekly, run cards, the Hall | No shared number, no season; the meta runs dry in about a month (D13); the score has no clock (D12) |

## Decisions needed

1. **The telemetry store.** Is Upstash attached in Vercel? It cannot be seen from the
   repository, and the first roadmap's seven unjudged exit criteria and Phase 9's balance work
   wait on it. If not, it is a few minutes in Vercel's Marketplace (the README says how).
2. **Leaderboards.** (a) a trusted board, the score sent as the phone reports it, with sanity
   checks: one batch, cheatable, publishes names; (b) honest dice first (Phase 7), then a
   friends' board by pasted line verified by replay, no server beyond `api/`, and a public board
   only if wanted after; (c) none. This roadmap assumes (b).
3. **Audio.** Commission or license recordings and stems to `sound/REQUEST.md`, or leave the
   code-rendered pack. Nothing here waits on it, and nothing here can do it.
4. **The device round.** Someone with a Pixel 3-class phone and an iPhone SE runs
   `docs/DEVICES.md` once; a tablet covers its own rows.
5. **Steam.** The controller work "opens a later Steam release through Electron". A store by
   another door: in or out?

## Order and dependencies

```
Phase 6 (the review's fixes) ──► Phase 7 (honest dice) ──► Phase 8 (the build by floor 3)
                                                      └──► Phase 9 (the live game)
Phase 10 (content cadence) runs alongside from Phase 8
Phase 11 (authored audio) whenever the recordings arrive; nothing waits on it
```

Honest dice before the build: the dice are three to five days, the build is six to eight
weeks of benching every README row, and seeded rolls make each of those benches reproducible
and let the `FP=1` fingerprint cover the fight. (The bench already seeds `Dice` and
`Math.random` per run; the browser does not, so the work is to give the game what the bench
has.) The live game needs the dice too, and the build's timing before anyone is ranked on it.

About eight months in all, plus whatever audio and the device round take outside the repository.

---

## Equipment and companion follow-up (19 October 2026)

- [x] Three pinned consumables, protected favourites, both-hand comparisons,
  relic set progress, live companion cards and a per-floor pickup summary.

## Delve guidance follow-up (20 October 2026)

- [x] Quest tracker, known map landmarks, status explanations, portrait companion
  orders, run recap and inventory search, with existing rules and hidden information preserved.

## Focused polish follow-up (20 October 2026)

- [x] Optional hero setup and mastery disclosures, objectives-first Journal,
  labelled attack readiness, legible warning marks and misses, larger Pack names,
  expandable map key and explicit rest recovery.
- [ ] Physical older-Android and iPhone Safari round: no devices are attached to
  the development environment. Automated viewport checks are recorded separately.

## Remembering the delve (20 October 2026)

- [x] Name entered set pieces in place cards, explored map landmarks and recap.
- [x] Add optional field notes for existing enemy formations and mixed fights.
- [x] Show contextual companion reactions and existing learned/upcoming milestones.
- [x] Preserve target material responses with recorded impacts; give all later
  regions distinct synthesised ambience and quiet forge/hammer details.
- [x] Frame the existing next-run suggestion as one optional, readable goal.
- [x] Clear the unchanged 4× CPU performance gate on GitHub Actions before
  publication; the CI result and local baseline comparison are in
  [the local performance report](docs/PERFORMANCE-2026-10-20.md).
- Dungeon generation and enemy composition retain their existing rules. New room
  layouts and authored enemy combinations remain future gameplay work, requiring
  matched balance simulations before release.

## Phase 6: The review's fixes (2–3 weeks)

Everything the review found that is a bug, a rough edge or a one-batch gap, before anything
is built on top. Each is small; together they are the grade.

- [x] **A held stick stops at the end screen** (C1): release every held act when the pad
  leaves play, clear `held` on a new run; the probe becomes a `pad.spec.js` test.
- [x] **The collar test and its kind** (C2): seed what it measures or widen its bar, then sweep
  `rules.js` for other statistical bars on unseeded paths.
- [x] **Harden `api/telemetry.js`** (C3, C6): whitelists from `data.js` for class, difficulty, size,
  path, legend and combinations; a hashed crash field; a per-IP throttle; a cap on the parsed
  body; a weekly flag on crashes (C6); tests in `test/api.js`.
- [x] **Teach the arrow** (P1): the coached fight or a first-shot tip says what beats an archer
  (close in, or leave its line), a bowstring on the draw, and the dodge tip stops saying "every
  time". The end screen's "what killed you" names the bestiary's answer (P11).
- [x] **Fill the modal choices' empty half** (P2): the level-up, the path and the divided stair
  show the hero's portrait and numbers, or the floor, above their cards.
- [x] **Double text in the pack, the hero sheet and the log** (P3): slot labels, the scores'
  columns, padding under "≡ Log"; `access.spec.js` gains the pack and the hero sheet.
- [x] **How to Play in order** (P4): Basics starts with moving and ends with the ending, on
  one screen; Send reports and Testing tools move under Modes; the "behind the counter"
  line made true (D17); README's counts (D17).
- [x] **Words explained where they stand** (P5, P8, P14): a vow's one line under its name on
  the title and in the prologue; "Search" only where a hidden door is plausible, or a first
  tip; "In a fight" and "on no path" reworded.
- [x] **The prologue** (P6, P10): a Back button, and the portrait or the key art behind it.
- [x] **The title for a first visit** (P9, P18): "Load from code" with Continue; the Daily's
  switch once earned; the Weekly's line to two; "You already have a hero below" says which
  was being started.
- [x] **New Game keeps the name shown** (P7) unless the player asks for another.
- [x] **A near goal** (P11): one line on the title and the end screen from the Hall's closest
  unlock or trophy; the Hall shows the three nearest first.
- [x] **A few seconds' grace on the start square** (P17), and the difficulty named on the
  first floor; on Easy the marks a fifth slower, said on its card (D15).
- [x] **Finds and duplicates** (P16, P13): a chime and a rising number for a find; the floor
  does not hand out a fourth buckler.
- [x] **The first tip off the hero's hands** (P15): tried on the roof of the view, and put back: there it covered the map and the fight, which round five's rule keeps clear. The band above the log stands.
- [x] **Test gaps** (C11, C12): rules tests for Iron Snare, Tightening Cord, Red Feast and Pyre;
  `pack_and_root` and `jest` asserted; axe on the Log overlay and the confirm screen.

- [x] **The second grader's findings** (`docs/REVIEW.md`, the second pass): "+1 hit points", "a Throwing
  Knives", the Hall's lowercased goal; the first arrow waits as the first blow does; the dungeon shows
  through the level-up, the stair and an encounter; the title tappable inside a second and a half; the
  prologue names the hero and their class; a floor to reach as the goal before any win; the share line
  says where to play; the logo and the daily switch whole at Double text.

**Exit criteria**
- A fresh phone grade with polish and clarity at 8.5 or more. (After the first pass a second grader, with
  the same brief, gave 7 / 7 / 6 / 7 / 8: harsher than the first on the title's dead seconds, four text
  faults and the choices' void, all since fixed; not yet measured again.)
- Every review finding above "wish" closed or scheduled by name below.

## Phase 7: Honest dice (1–2 weeks)

- [x] **A run's own dice** (C4, D12): two streams in `rng.js`, the dice (`d()`) and the odds
  (`rnd()`, `chance(p)`), seeded from the run (seed, class, background and name) and saved
  with it, taken up again on a load and a save code; the gameplay `Math.random` calls (combat,
  foes, game, pacing, elements, lairs) swapped; the renderer, the title, sound and music keep
  `Math.random`. Proved by `test/rules-dice.js` (one seed pressed the same way twice to one
  print, a save taken up twice the same), by `test/browser/dice.spec.js` (the same in the
  browser, the page's frames held) and by the bench's `FP=1`.
- [x] **A score with a clock** (D12): a win inside the hour earns up to 600 more, ten fewer a
  minute; the Hall and the Weekly's best set the quicker of two equal scores first, and a
  companion at the end before none; the time said on the end screen and in every share line.
- [x] **The run recorded** (D12): bounded public actions and exact frame/simulation times
  travel with browser saves, including load continuation. The bot harness verifies
  the same terminal state; the end screen has an isolated first-person replay with
  pause and speed controls. Same-build, current-run playback; older/imported saves,
  testing-aid runs and over-limit records are unavailable. See `docs/REPLAY.md`.
- [x] **Split `test/rules.js`** (C7) along its headings into `rules-*.js`, one runner, three
  or four processes; the slow suite under two minutes. *55 files, four processes, 2m13s here
  (the one check that swings a sword 180,000 times sets the floor).*

**Exit criteria**
- [x] The same seed and inputs give the same run in the browser and under the bot, every time.
  (A loaded run is not the run never put down: a load gives every creature a moment's grace.)
- [x] The frame-rate budget unchanged.

## Phase 8: The build by floor 3 (6–8 weeks)

The design review's heart: on the delve most people play, the path, the capstone and the
legend are a last-act event. The numbers below are the change to bench, not the answer; the
exit criteria are the answer.

- [x] **Move the build forward** (D1): the path at level 3, talents on the even levels
  between, the capstone at level 7, the legend from the first champion after the path. Benched:
  the bot has its path by floor 3 in 98% to 100% of runs (every class), every win takes a
  capstone, the legend is worn at the end in 52% to 60% of runs (it was 45%). Normal and Hard
  benched on three seed sets at the path commit (Normal 82.5%, Hard 62%, the README stood at
  80.5 and 61.5); the other rows wait for the end of the phase.
- [x] **The fork where the path is** (D2): the stair divides after the path; a hero who reaches
  it first is asked the path there, in place of level 3's lesson, and the roads the moment it is
  chosen. Each road's card names the champions the run plans on its floors, its keeper and its
  relic, from the same plans the floors are made from, and one line on its weapon (cold, weight).
- [x] **A floor's wear carries** (D3): on Normal and Hard the first rest restores two thirds,
  the next a third (then a sixth on Normal), Easy keeps the whole night, the ladder's one rest
  gives a first rest's share, only the trader's lamp makes a hero whole, and the Returned's gift
  is a free lamp. Benched: a winning run ends with 3.8 to 5.5 draughts (it was five to
  seven; two or fewer is the bar, and potion supply, D10's lever, is what is left to pull).
  Normal 82.5% to 81.5%, Hard 62% to 60.5%; the classes 7.0 points apart on Normal and 10.0 on
  Hard (7.0 before this batch): over the six-point rule, to be evened at the end of the phase, once the
  ladder, the new items and the new relics have each moved the classes.
- [x] **Capstones with a shape** (D4): the seventeen that were a number are one rule each
  (Shield Wall staggers what it catches a blow from, a Crusader's Smite that fells costs nothing,
  Shadow's Edge ends a foe at a third of its life, Vanish makes each foe's first blow miss, Old
  Hide keeps poison and the grave-cold off the bear, and so on: `test/rules-capstones.js`); the
  paths' numbers are the paths' own again. Wellspring is a ward, not free healing out of a
  fight, so that it does not undo the wear that carries.
- [x] **Lessons that change a rule** (D5): the five stat lessons folded into Self-Taught; five
  rule lessons in their place (Opening Blow, Nose for Draughts, Trap Sense, Iron Grip,
  Wayfinder, `test/rules-lessons.js`); the first talent passed over is held for the next talent
  offer, first among its three and marked as held. (When several levels come at once the second
  offer is drawn before the first is answered, so the held card is not in it: the common case
  is one level at a time.)
- [x] **The ladder as five sentences** (D6): dear traders and one rest kept; the three taxes
  replaced by rules a player plans around (and the first made to bite: traders ask twice):
  Hard+3 a rest wakes whatever is near enough to hear it, about twenty steps (what it wakes
  hunts from wherever it lies; the whole floor woke at first, and the rung was a cliff), Hard+4 a draught drunk beside a foe gives it a blow (step out of reach
  first; the draught heals as its dice say again), Hard+5 no lamp makes you whole (no trader
  sells a night by theirs, the Returned keep their gift, and the vigil lamp by the last halls is
  out). The share line says the rung in words. Benched at the batch: Normal 80.5%, Hard 59.5%
  (3 sets); the ladder's curve is measured again in the closing pass with the bot resting by the
  stairs on the third rung as a player would (it rested mid-floor and the roused floor came for
  it: the fighter 25% on Hard+3, 44% once it learned).
- [x] **Elements for every class, combinations pruned** (D7, D8): Frost Oil (chills, holds the
  foe back a moment, freezes the water round it), a Scroll of Frost and a Scroll of Lightning,
  in the floors' draw and on the shelves; the blade's cold works on the place as a spell's does,
  so Flash Freeze, Sealed Crack, Quenched and Conduction are a fighter's or a thief's to plan,
  with Sheet of Flame, Troll's Bane and Silver and Bone: seven two-system combinations on items
  any class can carry (`test/rules-kit.js`). `icebound_prey` is possible: a Warden with Frost
  Oil beside water, or a Scroll of Frost. Of the fifteen combinations a legend or a set makes,
  two fired on the legend alone and now count on the player's act: The Wall Holds on the Bash
  that answers the Bastion's catch, the Fool's Opening on the blow into Motley's opening; the
  other thirteen already turn on a blow, a kill, a spell or an oil the player chose (Pack and
  Root on the companion's kill is left as the friend's doing, as its hint says). That reading
  is a judgment: the review counted thirteen as "by owning a legend".
- [x] **The mage's relics** (D11): four on robes and foci (the Hearthwool Robe, the Archivist's
  Robe, the Midnight Folio, Sparkglass with the new power Echo) and two more a ranger can carry
  (the Boarspear, Galewind): the mage's pool four to eight, the ranger's seven to nine.
- [x] **The economy's holes** (D10): a trader is sure on floor 2 (and the floor before last, as
  before; a longer delve keeps its two-fifths one too), and the traders keep one relic back for
  the floor before last, where the gold hauled up has nowhere else to go (a champion's gift
  leaves it too). A job paid by any trader after its floor was already the rule; the bench says
  where the rest go: of the bot's jobs a quarter are paid, two thirds are left undone on their
  floor (the bot moves on, as a player may), and one in thirty is done and never paid for want
  of a trader after. The bot prints that split, and the draughts it bought, with every bench.

**Exit criteria** (measured at the end of the phase, October 2026, every README row benched
again: `README.md`'s table)
- [x] The bot walks a path by floor 3 in nine runs of ten, and takes a capstone in four wins of
  five on eight floors: the path on floor 1 to 3 in 96% to 100% of runs, every class; a capstone
  in 99% to 100% of wins.
- [ ] A winning run ends with two draughts or fewer on average: 2.7 to 5.7 (the cleric lowest, the
  mage highest), from five to seven before the phase. The lever left is potion supply, a cut of
  about two fifths to the draughts found and sold: a difficulty change for every player, so it is
  not made here but put to the owner.
- [x] Every README row within six points across the classes, the ladder a smooth curve: every
  row within five but the sixteen-floor Normal one at nine (the thief about 85% to the cleric's 77
  and the ranger's 78 over three seed sets; two levers tried moved neither past the bench's
  noise, so it stands as measured); the ladder 62, 58, 52.5, 45.5, 41.5, 37.5 from Hard to
  Hard+5, four to seven points a rung.
- [x] The end screen's build line names a path chosen before the fork (`test/browser/paths.spec.js`).

## Phase 9: The live game (6–8 weeks, then ongoing)

- [ ] **A friends' board** (decision 2): the run recorded first (each frame's length and each
  press kept with the save, bounded; the bot harness plays one back headless to the same end,
  from Phase 7); then a pasted share line, verified by headless replay in `api/`, shown under the Daily's and the Weekly's own result; a name typed on the phone,
  nothing else sent, the telemetry's privacy note. A public top fifty only if wanted after.
- [x] **A mastery track** (D13): five named stages a class, each opening an option (a third
  kit, a frame, a starting relic from the codex at a price); Wick's tales to twenty; the Hall
  to fifty with filters. *Landed: the stages are worked out from the wins already kept
  (a win, Normal, Hard, both paths, Hard+3), so a returning player starts where they stand;
  the frame is bronze from the first, silver from the third, gold at the last; the third
  kit opens at the fourth, and the fifth lets a run begin with a codex relic (no legends)
  for three quarters of the score. None of it in a Daily or a Weekly.*
- ~~**The first season** (D13): six weeks of a vow set, a frequent twist, one new champion
  and one new legend, dealt from the season's number as the Weekly is, on its own Hall page
  with its own card; its rules fixed when it opens.~~ *Dropped (14 October 2026, the owner's call).*
- [ ] **Balance from telemetry** (decision 1): real players' win rates by class and rung beside
  the bot's on the dashboard, reviewed monthly; a class ten points off the bot for two months
  gets a bench and a change. The README's table links to it.
- [ ] **A replay link** on the run card (local end-screen playback has landed): the seed and the recording, played back in the view,
  skippable.
- [ ] **A data-only mod format**: JSON encounters, relics on existing powers, journal pages,
  and monsters as kind + existing move + palette, read from a link on New Game, checked
  against the types, never into the Hall or a board.

**Exit criteria**
- A friend's line verifies and ranks within a minute of a run's end.
- ~~A season runs its whole length without a change pushed mid-season.~~ (No seasons: dropped.)
- One monthly review reads real win rates and benches a change from them.

## Phase 10: Content cadence (ongoing, from Phase 8)

Each item its own small batch with its art, Bestiary line, tip if it needs one, and its row
in the bench. Pointed first at the shallow end, where a new player's first ten runs are.

- [x] **Another answer on floors 1 to 4** (D9): one creature a floor whose answer is not a
  step at the mark: the glimmer moth's flare (turn away), the thornhog's quills (hold your
  blow), the gutter imp at your back (turn and face it), the goblin pikeman's reach (close in).
  Benched over three seed sets: Normal 81–84.5%, Hard 62–64%, quick delve 92.5–98.5%.
- [x] **The marks do something** (D9): Feral charges, Armoured turns the first blow, Ancient
  uses its trick twice as often, Rabid never flees.
- [x] **Threads that land** (D14): the spared goblin fights beside you once; the paid toll's
  guide; the offering's fountain; the shared meal's page.
- [x] **The Long Delve's dead stretches** (D16): a marked pack leader on floor 2 or 3 of 16;
  the smith a floor up; the floor before the keeper with a set piece of its own.
- [x] **What the genre expects**: a pack with a leader whose fall scatters it; a thief that
  steals; a creature that fetches help; a mimic of a chest; blind, slow and silence; a cursed
  thing worth wearing; a caster above floor 5; a trap a monster can spring. (The warband, the
  Goblin Cutpurse, the Goblin Lookout, the vault chest's mimic, the Goblin Hexer's slow and
  silence beside the glimmer moth's flare, the Gallows Ring, and traps under any walker.)
- [x] **The sixteen-floor delve evened out**: 82% to 87% on Normal and 61% to 65% on Hard, from
  13 and 9.5 points apart.
- [ ] On a schedule: a monster or encounter every two weeks, a named champion a month, a road
  or a people a quarter; the device round (decision 4) once a quarter when it is done at all.

**Exit criteria**
- Twelve months of `NEWS` entries, none a month apart.
- Every README row within six points after each addition.

## Phase 11: Authored audio (when the recordings arrive)

- [x] George synthetic narration: opening and backgrounds, found pages, first region and relic discoveries, and death/victory epilogues; default on, separate voice control, combat priority, offline recordings.

- [ ] **Recorded sound** (P12): the pack's files replaced one for one from `sound/REQUEST.md`,
  names and lengths kept so `samples.js` and the tests need no change; a hit stop of a few
  frames and a heavier shake under a real impact (P1's "weight").
- [ ] **Composed music**: the seven themes' four stems each, faded by the mood `music.js`
  already tracks, and the title's cue.
- [x] **Class portraits**: six painted faces matched to the title art, carried through character creation, prologue, choices, hero sheet, endings and share cards, with mastery frames and an offline cache.
- [x] **Collection browsing**: remembered Field notes/Gallery layout, search of discovered text, folded discovery/region/type filters, and New markers cleared through inspection. Title and Journal share browsing selections without revealing unknown entries or changing game state.
- [x] **Boss portraits**: painted Dread Lich, Goblin Warlord and Heartforged introductions, held until dismissed; portraits unlock in the bestiary on meeting them, with a closer look and offline support.
- [x] **Melee feedback preview**: short marks where close blows land, distinct blunt and blade shapes, a metallic ring when an Armoured foe turns a blade, and a pale rim for the final quarter of an enemy wind-up. Calm view uses a smaller, still mark; combat timing stays the same.
- [x] **Combat clarity**: visible foe intent text, explicit critical/damage labels, short-condition countdowns, bounded touchable status rows, and death advice with conditions at the fall; preserve combat rules, timing and visibility.
- [x] **Painted creature pilot**: Dark Elf Warrior with nine frontal combat poses, alternating steps, connected sword grips, cached lighting and elite colours, on-demand loading, procedural fallbacks and offline support. Preserve combat timing and warning priority.
- [x] **Burning Hands preview**: a compact flare at impact and a few fading embers; Calm view keeps a small, still target glow. Damage, cost and timing stay the same.
- [x] **Elemental feedback**: the fire scroll and Flame Strike share the fire impacts; cold spells and scrolls fracture into frost, with a brittle crack; lightning uses steady branching arcs. Calm view keeps only small, still impacts. Scrolls keep their existing impact delays, and Insect Plague keeps its separate swarm.

**Exit criteria**
- A fresh phone grade of 9 or more for first impression, feel and polish.

## Debts, scheduled, not left

- [x] `test/rules.js` split: Phase 7.
- [ ] `ui.js`, `renderer.js`, `game.js`, `foes.js` within 300 lines of the limit (C7): the
  next slice out of each before the phase that touches it (the title and create screens out of
  `ui.js` in Phase 6, done; the K wiring out of `game.js` in Phase 7, done: the twenty-four
  objects lent became one `K`, 1,908 lines to 1,730; `renderer.js` 1,895 and `foes.js` 1,758
  before the phases that touch them; `foes.js` to 1,549 with the bosses in `bosses.js`, and
  `renderer.js` to 1,698 with what lies over the whole view in `overlay.js`, both October 2026).
- [x] The K objects typed (C8): one `Kit` typedef in `types.js` for the one `K` every game
  factory takes (by name, the state and the floor in full), in place of a typedef a factory;
  copies at birth checked: constants and functions only, none of the state that changes.
- [x] A Content-Security-Policy (C5), inline styles allowed (the page sets a few by attribute; it is the scripts the policy guards): Phase 6.
- [ ] Fixed sleeps swapped for state waits, CI retries off (C9): spread over Phases 6 to 8.
- [x] The per-frame tidy-up (C13 to C15) and a startup and wide-layout scene in `perf.spec.js`
  (C16): Phase 7. (The HUD's signature ten times a second or on an event, the elements read
  every frame looked up once, the elements' stains kept from frame to frame. The wide scene
  measured a tenth under the phone's fight at every commit tried, so its bar is 27 fps to the
  phone's 30; a run opens in about 3.2 s at 4x slow, against a bar of 6 s.)

---

## What not to do

- **No engine rewrite, no 3D, no multiplayer**, as before.
- **No accounts.** A board takes a name, not a sign-in; the Hall stays on the phone.
- **No mid-season changes.** A season's rules are fixed when it opens, so every board on it
  is one board.
- **No content without its bench row.** A monster that is not benched is not shipped.
- **No board before the build moves.** A leaderboard on today's timing ranks builds that
  arrive on floor 6.

## Optional dungeon puzzles (17 October 2026)

- [x] Per-run choice at the first stair, including returning Quick Start heroes;
  fixed Daily and Weekly rules preserved.
- [x] Three seeded catches on existing gold/gem caches: rune sequences, watchfires
  and keeper-seal deductions. Clues remain visible; retries cost nothing, and the
  player can leave and return. No progression gates or added loot.
- [x] Save/code validation, replay, touch/keyboard/controller controls and automated
  rules/browser/accessibility coverage.

- [x] Budgeted cache reward choices: original coins, healing draught or class-usable
  unidentified gear, with change, a persistent one-time choice and a short
  unlocking effect that respects Calm view and reduced motion.

## Regional architecture (18 October 2026)

- [x] Cached masonry, floor patterns and door materials across the existing themes,
  including crypt ledger stones, dwarf ironwork and rope-bound marsh wood.
- [x] Preserve lighting/fog ranges, map generation, lock colours, water cues and
  foe visibility; cover deterministic textures and Calm view in browser checks.

## Visual finishing pass (18 October 2026)

- [x] Cached attack follow-through and hit recovery, slower sleeping breaths;
  existing wind-ups retain priority and Calm view omits the new poses.
- [x] Grade-coloured treasure glints and framed inventory inspection, with hidden
  quality preserved and no extra pickup delay or modal.
- [x] Broken burial lids, iron scrap, crystal shards, roots and bundled reeds
  replace existing scenery pictures without changing maps, counts or obstacles.
- [x] Force, thorns, roots, holy seals, restorative motes, ward outlines, blessings
  and a bear's paw; bounded effects and still, fading marks in Calm view.
- [x] Shared frame radii, subtle panel edges and selection marks across character
  creation, bestiary and inventory; mastery and treasure colours retained.

## Named treasure artwork (18 October 2026)

- [x] Individual lore-led pictures for every legendary piece and named relic,
  shared by floor treasure, inventory inspection and discovered codex entries.
- [x] Matching weapon and focus pictures in the hands, and recognisable bow and
  shield backs with existing grip positions and string anchors preserved.

## Mythic class bargains (18 October 2026)

- [x] Six class items, each with a unique power, drawback, lore and matching art;
  one equipped at a time, available to both paths.
- [x] Optional final Vigil Lamp trial in custom delves of eight floors or more,
  after its ordinary aid at its ordinary cost. Daily/Weekly and shorter runs preserve their rules.
- [x] Persistent guardian and one-time floor reward, save validation and accessible
  encounter/pack controls; no ordinary deals or mastery starts.
- [x] Matched six-class Normal/Hard balance comparison, exploration and long/rung
  checks, plus full browser and isolated performance validation.

## Landmark and treasure finishing (18 October 2026)

- [x] Regional carved stair jambs and keystones, shrine compass inlays and
  dark-glass sanctum floorwork, cached with existing lighting and openings.
- [x] Larger Legendary/Mythic artwork reveals in the player-opened pack,
  with powers and lore, no pickup popup or combat pause, and Calm/reduced motion.

## Faster offline preparation (18 October 2026)

- [x] Activate the core game before optional narration downloads; show separate
  core/voice readiness, resume missing recordings and preserve text-only play.
- [x] Exercise delayed downloads, real offline controls, reconnect, cached voice
  ranges and reload on the mobile browser matrix.

## Hidden Wayfarer

- [x] Five title-version activations reveal a device-local Spellblade card.
- [x] Painted portrait, biography, pixel fallback and silver-lantern kit.
- [x] Runic Edge, explored-ground Lantern Step and timed Spellguard.
- [x] Complete local rules, mobile and recorded balance validation.
- [x] Published the original hero in v0.9.14 after all seven CI jobs passed.
- [x] Personal gatekeeper opening, carried silver lantern and exclusive talents/lessons.
- [x] Record the final three-set progression comparison and require full Chromium,
  Safari mobile and performance checks for v0.9.15 publication.

## Held equipment review (21 October 2026)

- [x] Cached intermediate cuts and attached recovery; staff/spear drive and staff casting.
- [x] Fitted bow nocks, string contact and draw flex; visual release uses combat timing.
- [x] Named bow markings and shield rim identity; restrained surface glints.
- [x] Object bounds for short views, with forearms allowed beyond the edge.

- [x] **Painted creature expansion**: twelve further approved atlases with species-specific lazy loading, Skarrow identity, cached lighting, procedural fallback and offline support.
