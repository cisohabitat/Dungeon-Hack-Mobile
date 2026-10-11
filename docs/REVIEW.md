# Deepdelve: the October 2026 review

Three fresh reviews taken on 11 October 2026, at the end of the first roadmap, to set the
second. One played the game on a phone as a new player would (iPhone 14 size, tips on, the
pack on, every tap a real tap; also iPhone SE, landscape and a tablet; 300 screenshots);
one read the code adversarially and ran the checks; one read the rules and the data as a
designer and ran a short bench. `ROADMAP.md` cites these findings by number.

## The grades (out of 10, from play)

| | Before the first roadmap | After its in-repo half | Now |
|---|---|---|---|
| First impression (60 seconds) | 9 | 8.5 | 8 |
| Feel | 8 | 8 | 7.5 |
| Polish | 7.5 | 7 | 7 |
| Clarity | | | 7.5 |
| Depth seen in 20 minutes | | | 8.5 |

The key art went in and the first impression went down: the first-time card covers it, and
the title now shows a first visitor "Load from code", the Daily's hero switch and two vows by
name. What the graders still miss is the same as before: audio with weight, and nothing on a
phone that cannot buzz.

## From play (P)

Ranked. Each rests on a screenshot in the playtest's folder (`review/play/shots/` in the
session's scratchpad, named below), and on the steps given.

1. **The goblin archer kills new heroes and nothing teaches the answer.** A level-3 fighter
   with 37 hit points, and a mage with every spell point unspent, both shot dead from four
   squares down a corridor on floors 2 and 3. The coached fight teaches "step back at the
   mark, every time"; the archer draws before it looses, so the mark shows, and stepping back
   from an archer is staying in its line. No tip covers an ordinary arrow (`aimed` and
   `firearrow` only). Design gap. *p3-36-hp-low, p3-39-status-dead, p7-12-hp-low.*
2. **The modal choices leave the top half of the phone black**: the level-up, the path and
   the divided stair put their heading at the top and their cards at the bottom with 350 to
   450 px of nothing between. *p2-31-ov-boons, p7b-09-levelup-3, p7b-02-fork.*
3. **Double text clips.** "≡ Log" covers the end of the newest line; the pack's slot labels
   overflow their cells; the hero sheet cuts "Constitution" at the edge and wraps "Hit
   points" to three lines. `access.spec.js` was meant to catch this and does not look at the
   pack or the hero sheet. Bug. *p5-28-textsize-2, p5b-03-double-pack, p5b-04-double-hero.*
4. **How to Play's Basics starts with the ending** (the smith's quench, the Pale One) before a
   word about moving, and runs seven screens with Send reports and Testing tools in it.
   *p5-01-help-top.*
5. **Vows are named and never explained in place**: the title's Weekly line and the Weekly
   prologue say "Glass Vow and Unaided Vow"; only Help > Modes says what they are.
   *01-title-cold, p5-11-weekly.*
6. **No way back from the prologue**: its one button starts the run, and the Daily goes there
   straight, so looking at today's delve spends the day's one try. *12-prologue, p5-14-daily.*
7. **The hero's name changes under the player**: tapping a background redraws the suggested
   name with no sign it was a suggestion. *11-create-bg-picked.*
8. **"Search" flickers on the Use button** at every wall, unexplained. *p2-19-use-search.*
9. **The title's hierarchy for a first visit**: "Load from code" as large as the Weekly; the
   Daily's switch before it matters; the Weekly's line wrapping to four. *01-title-cold.*
10. **The prologue is the one screen with nothing to look at**: text on a dim wash, the
    portrait unused. *12-prologue.*
11. **The end screen buries what to do next**: four paragraphs, three insights, nine numbers,
    then Share and New Game a scroll and a half down; no goal named, though the Hall knows
    them. *p4-13-end-screen, p4-14-end-full, p4-20-hall-entry.*
12. **The audio is still rendered in code** (`sound/SOURCES.md`: no live recording; `music.js`
    composes by mood at play time). Not heard; judged from the documents.
13. **The pack fills with duplicates**: four bucklers and two unknown daggers by floor 2.
    *p3-05-overlay-inv.*
14. **A section header reads as a status**: "In a fight" beside a trader with nothing awake;
    "on no path" on a level-1 end screen. *p3-09-overlay-char, p4-13.*
15. **The first tip covers the hero's hands** it describes. *p2-07-floor1-start.*
16. **Finds have no fanfare**: a 288-gold diamond is one log line. *p2-19.*
17. **The first floor can open with a monster on you**: on Easy, a goblin through the door
    and striking from the left within eight seconds, before a tap; and nothing on screen says
    Easy once the run starts. *p8-11-fight-first.*
18. **Quick Start, the Daily and the Weekly stop at "You already have a hero below"** without
    saying which was being started. *p5-11-weekly.*

What held: the coached first fight, the encounter card's odds, "unknown until bought", the
bestiary's "trick not yet seen / answer not yet learned", the share card, the one-handed
layouts, all four screen shapes, and no console error in any run.

## From the code (C)

1. **Bug: a controller stick held through a death keeps the next hero walking.** `pad.js`
   presses and releases the held acts only in the `play` branch; on the end screen the stick is
   let go and no release is sent, so `held` still carries `forward` into the next run. Proved by
   a browser probe (the hero walked eight squares with no input). Fix: release every held act
   when `where` leaves `play`, and clear `held` on `startPlaying`.
2. **Flake: the collar test in `rules.js` is statistical on unseeded dice.** It seeds `Dice`
   for both halves but the orc's wandering rolls `Math.random`, and the bar (collared under
   0.85 of bare) sits inside that noise; it failed once in a full run and passed three times
   alone. The pre-push hook and CI run without retries.
3. **Risk: `api/telemetry.js` takes free text as Redis hash fields, unbounded,
   unauthenticated, unthrottled.** Class, difficulty, path, legend, up to 40 combinations and
   a crash's message become fields of the counting hashes with no list to check against; a
   loop of posts grows them and poisons the dashboard. The body cap guards only the beacon
   fallback. Fix: whitelists from `data.js`, a hashed crash field, a per-IP throttle, a cap on
   the parsed body.
4. **Debt: every fight roll is unseeded.** `Dice` is made from the clock; some seventy `d()`
   calls and about forty direct `Math.random` calls in gameplay (combat, foes, elements, game,
   lairs, pacing) go through neither the seed nor anything saved. The bench seeds both per run
   and is reproducible; the browser is not. This blocks verified scores and the `FP=1`
   fingerprint's reach. Fix: a per-run `Rng` on `G`, its state saved, `d()` and a `chance()`
   on it, the gameplay `Math.random`s swapped; three to five days.
5. **Risk: no Content-Security-Policy.** Every sink that renders imported text escapes
   today; this is depth. Inline `style=` attributes (eight, plus the map legend's swatches)
   need moving or allowing.
6. **Nit: a weekly run's crash report is not flagged weekly.**
7. **Debt: four files within 300 lines of the limit** (`ui.js` 1,946, `renderer.js` 1,895,
   `game.js` 1,868, `foes.js` 1,755) and `test/rules.js` at 15,349 lines, 545 checks, one
   process, four and a half minutes.
8. **Debt: the K objects are untyped in 32 of 34 factories**, and eighty-odd values copied
   from `K` at a factory's birth depend on the wiring order (all correct today; checked).
9. **Debt: 125 fixed sleeps in the browser tests**, and CI retries once, which hides the flakes.
10. **CI wall time** about seven minutes for `npm test`; fine, halved by 7.
11. **Gap: four rules with no rules test** (Iron Snare, Tightening Cord, Red Feast, Pyre) and
    two combinations never asserted (`pack_and_root`, `jest`).
12. **Gap: axe never visits the Log overlay or the replace-run confirm screen.**
13. **Perf: `refreshHud` builds a forty-part signature every frame**, paused or not.
14. **Perf: four or five `querySelector`s a frame** in the main loop.
15. **Perf: the floor stains allocate per frame** (an object a stain, a split a field).
16. **`perf.spec.js` does not measure** the first minute, time to first frame, the docked map,
    a large floor's map, big text, the title or pad polling.

Checked and clean: values copied from `K` against the wiring order; `sw.js` against the files;
every `localStorage` read guarded; no URL parameter read; timers and listeners; old saves
back-filled; the ISO week at both turns of the year; every daily guard checks `opts.weekly`.

## From the design (D)

Read from the rules and data, with a 100-run bench a class on Normal where a number was needed.

1. **The build arrives too late on the delve most people play.** On eight floors the path
   (level 5) lands on floor 5 or 6, the capstone (level 9) on floor 8 or never (37 of 100
   fighter and 55 of 100 mage runs took one, nearly all on the last floor, none after the
   keeper), and the legend, dropped by the first champion after the path, is worn for one or
   two floors (found in 53% of fighter runs, worn in 45%). Capstones and legends are Long Delve
   content sold on the default delve's card.
2. **The fork comes before the build.** The stair divides on floor 3; the path arrives on 5 or
   6; the one route choice that favours a build (undead and cold down the Crypts, charging
   things down the Warrens) is made blind, and the cards name only a trader's leaning.
3. **Rest resets a floor's wear.** The first rest on a floor restores everything for six
   food; the bot rests 9.9 times in eight floors and ends with five to seven draughts unused.
4. **Seventeen of twenty-four capstones raise a number the path already has.** Seven have
   a shape (Undying, Miracle, Rallying Bash, Bloodlust, Wildfire, Death Mark, Old Growth).
5. **Lessons are chores**: five of eleven are the same +1, two the same hit points, none
   changes a rule; the talent pool is drawn at random, so a build's talent may never come.
6. **Three of the ladder's five rungs are taxes.** Dear traders (+1) and one rest (+2) change
   a decision; sturdier champions, weaker draughts and surer creatures do not, and land
   unevenly (the fighter 64% on Hard+1 against 62.5 on Hard; the cleric 47 on +4 against 43 on
   +3).
7. **Combinations that cannot be made, or make themselves.** `icebound_prey` is impossible
   (freezing needs a cold spell; the Warden has none and no cold item exists); thirteen of
   thirty-two fire by owning a legend; the bot's "100% of wins made one" is mostly Bash.
8. **Elemental play is caster-gated**: no cold or lightning in any item; a fighter's whole
   kit is fire oil, lamp oil and one scroll.
9. **Fourteen of twenty-one common kinds answer to one step at one mark.** The creatures
   with another answer (troll, basilisk, hound, quillback, wyrm, eyeless, mimic, skeleton,
   the peoples) are deep or gated. The first four floors hold almost none.
10. **Gold has nowhere to go at the end**: 320 to 370 unspent at a win; the traders no
    longer sell relics (the help says they do); two of three jobs taken are never paid.
11. **The mage's relic pool is four** (fighter 15): every mage run sees the same relics.
12. **Score and determinism block the live game**: no time term, no tiebreak, unseeded
    rolls, local storage only. (C4 is the same finding from the code.)
13. **The meta runs dry in a month**: every goal is "win with X"; six wins open the kits;
    Wick has eight tales; the Collector is a grind.
14. **Threads mostly pay in parcels**: four of eight payoffs are a bundle at the stair; the
    ogre, the wyrm, the wraith and the unbarred door are the ones that land.
15. **Easy is invisible**: it changes numbers a new player cannot see and leaves the marks
    at full speed. (P17 saw the same from play.)
16. **The Long Delve's dead stretches**: floors 2 and 3 of 16, the first road floor of each,
    the smith's floor after the elves.
17. **Doc truth**: the help's "behind the counter"; README's monster and background counts.

Expected real-player figures, against the bot's: first-week Normal wins in the 30s to 40s and
Easy in the 60s, since the bot never misses a mark; telemetry will say, once it counts.

## The second pass (after Phase 6's first push)

A second grader with the same brief, after the fixes above: first impression 7, feel 7, polish 6,
clarity 7, depth 8. Harsher than the first, and for new reasons: the title's menu not tappable for
2.4 seconds; "+1 hit points", "a Throwing Knives", the Hall's goal in lower case; the logo clipped to
"DEEPDELV" at Double text; the void still between the hero and the cards on a level-up; the archer's
first arrow landing as its tip appeared; a dealt hero's prologue never naming the class; "Win as a
Mage on Normal or Hard" as the goal for someone dead on floor 1; the share line with no way in. All
fixed in the second pass. Still open, for later phases: the cave bat as the first foe met (its
wind-up too short for the coached tip, D9's shallow end); the fight log's density; the tablet's
docked map mostly black on arrival; "Thirsting" and other power names in the shop with no gloss; a
rat on Easy stepped back from two hundred times; the Create screen's eight dungeon options before a
first run; How to Play's Combat tab without pictures of the marks.

