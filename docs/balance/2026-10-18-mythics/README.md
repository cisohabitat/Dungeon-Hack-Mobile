# Mythic class items: predeclared balance comparison

Baseline: 77c71598de045144b78b296c9f757a5d49a7eb34 (v1.4.0).
Six class-specific items, one equipped at a time, each with a drawback.
An optional trial at the existing final-floor Vigil Lamp in custom delves of
at least eight floors follows that encounter's ordinary aid at its ordinary cost. Daily/Weekly,
short delves, existing map placement and all unaccepted encounters stay unchanged.

Compare all six classes on Normal and Hard, with matching `FIT=1`, eight Medium
floors, normal monsters/treasure, traps/locks, fresh storage, ten trials per seed,
40 seeds in each of bench/alt/third: 400 runs per class/difficulty/set,
14,400 runs per standard variant. Default observer decisions are unchanged. `MYTHIC=trial`
explicitly chooses the offered trial and equips its earned reward; baseline
runs use the same observer and the same switch, which finds no trial there.
Record attempted/won trials and actual equipment use, not just win rates.
The report's `used` count means the correct class Mythic was worn for at least
one game update (`mythicTicks > 0`); it does not count individual power triggers.

Acceptance fixed before full-cell outcomes: no errors or timeouts; passive
fingerprints match; aggregate win-rate movement within 3 points and each class
within 5 points of matching baseline, with no more than 2 extra points of class
spread. Review depths, deaths below level 5, causes, remaining potions, rests,
casts and both paths (conditional rates are confounded by background rotation).
Use matching forced-path diagnostics if a path needs tuning. Compare two seed
sets during tuning and three sets for final acceptance. Add matched EXPLORE=0.8
runs plus long-delve and ladder sentinel checks. Small sentinels establish
regression coverage, not precise win-rate estimates. Retain exact inputs/results.

## Initial tuning (not final validation)

The two-set, two-seed/ten-trial preflight used 40 runs per class/difficulty
(480 per variant). It failed the declared bars, with Ranger at −12.5 points
on Normal and −17.5 on Hard; Fighter and Thief also fell on Normal.
Retained raw records are tuning-v1-{baseline,changed}.json.gz; tuning-v1.md
holds the full table. These small cells are noisy: Cleric's four additional
Hard wins are not enough evidence to weaken its item.

Before the final audit, Horizon gained +1 make and 4 flat arrow damage instead
of 2, keeping the 15% longer draw. Last Gate gained +1 make and blocks/stores
2 rather than 1 (still capped at 3 for five seconds, with AC −1). Nightglass
now gives 2 on ordinary close hits and 6 from the shadows, with AC −1. Repeat
the same tuning inputs, then validate final rules on all three 400-run sets.

## Trial preparation revision

The second two-set preflight is retained as tuning-v2-changed.json.gz and
tuning-v2.md. Horizon still lost 20 points on Hard. Paired lost runs arrived
on the final floor with identical resources: the changed policy then lost
the normal Vigil's AC/hit wards or healing, unlike the baseline. The trial
therefore now has a cancellable preview followed by the existing aid choices
at their existing prices. Only then does the guardian wake. No aid is granted
for free, and declining the trial still follows the old rules. Acceptance
bars remain unchanged. The observer handles this new paused preview without
advancing game time; ordinary baseline behaviour cannot enter this branch.

The third preflight, with normal preparation retained, is recorded in
`tuning-v3-changed.json.gz` and `tuning-v3.md`. Aggregate movement improved to
−0.42 points on Normal and +0.83 on Hard, with every class within five points.
The 40-run Normal cells still exceed the spread bar (+7.5 points), so this is
not release acceptance. Freeze this gameplay revision (`d403e87`) and use the
predeclared three-set, 1,200-run class/difficulty cells to assess that signal.
Do not select another tuning revision from these small samples alone.

## Observer equivalence

The large baseline started with observer v1. Revision v2 explicitly collects the
earned Mythic and keeps an equipped Mythic amulet; v3 handles the paused aid
preview. Neither branch can act on the old game. This was checked empirically:
all **480 baseline state fingerprints match across v1, v2 and v3** on matching
two-set Normal/Hard inputs for all classes. The source and complete records are
retained as `observer-v{1,2,3}.js.gz` and `observer-v{1,2,3}-baseline.json.gz`.
The standard comparison therefore records different observer hashes honestly;
it does not claim their source bytes were identical. Passive/exploration and
sentinel pairs use the same final v3 observer on both game revisions.

## Exploration coverage

`EXPLORE=0.8` used 96 runs per variant (two sets, two seeds and two trials for
each class/difficulty). The changed policy began 86 trials, won 79 and wore a
reward during 77 runs; every class/difficulty exercised the reward. There were
no errors or timeouts. Normal gained one win out of 48; Hard lost two out of 48.
These eight-run class cells are coverage sentinels, not precise rate estimates:
the generic analyser's rate-bar flag is false for this small pass and is not
release acceptance. Exact outcomes and resources are in `explore.{md,json}` and
`explore-{baseline,changed}.json.gz`; the predeclared standard bars apply to the
three-set 1,200-run class/difficulty cells. Investigate any structural failure
in these sentinels rather than interpreting one result as a 12.5-point estimate.

## Low-life observer correction

Reviewing the first standard cells found that the bot's bolt-selection loops
could keep attempting an unavailable Bloodstar spell at two life or less.
Observer v4 filters that unavailable action only under `MYTHIC=trial`, only
for a Mage wearing the Bloodstar; it falls through to the bot's ordinary legal
attacks. It does not unequip the item or change its life cost, damage or any
game rule. Baseline heroes cannot enter this branch, and every other class's
policy is unchanged. Retain the original policy's complete records, prove
baseline equivalence, and repeat all six 400-run Mage cells plus affected
exploration and sentinel cells. Do not tune game numbers to compensate for
repeated invalid actions or erase the first policy's losses.

Observer v4 also matches all **480 baseline state fingerprints** from v1/v2/v3.
Its source and raw results are retained as `observer-v4.js.gz` and
`observer-v4-baseline.json.gz`. The final source additionally accepts finite,
bounded fractional Last Gate expiry times when loading a save: browser clocks
are fractional. That validation correction changes no combat rule or observer
decision and is covered by a real-blow/native-reload browser check and invalid
save-value rule checks; simulations do not import saves.

## Final acceptance

The unchanged game rules at `d403e87`, with the corrected Mage observer from
`93fe329`, pass every predeclared standard bar. Each variant has 14,400 runs:
1,200 per class/difficulty over bench, alt and third, with 40 seeds and ten
trials in each set. Normal moves **+0.07 percentage points** overall and Hard
**−0.03**. Every class stays within five points (largest movement: Mage Hard
−3.83); class spread changes by **0.00** on Normal and **+0.42** on Hard.
There are no errors or timeouts. Seed-cluster paired bootstrap intervals for
aggregate movement are approximately −0.64 to +0.83 points on Normal and
−1.04 to +0.96 on Hard; they describe simulation uncertainty, not player odds.

All 14,400 paired runs have identical floor-arrival resources and early-death
flags. Depth, deaths before choosing a path and early-death counts are also
unchanged. The changed policy starts 11,872 trials, wins 11,064 and wears the
reward during 10,717 runs. Mean ending potions move by at most 0.67 per run;
Mage Hard uses more of its stock (3.98 → 3.31 left), consistent with the life
price. Mean actual casts change by at most 1.38 per run, and mean ending cash
by at most 26.38 gold. Ending cash is not total gold found, and bot potion
attempts are not confirmed drinks. Full death causes, resources, paired win
losses, intervals and both paths are in `standard.json`.

Both paths are represented with matching identities before/after. Their
conditional rates must not be compared as intrinsic path strength: backgrounds
rotate with path assignment. In the paired observations, Grovewarden Hard gains
38 wins, while Frostweaver Hard loses 33; Sharpshooter Hard loses 25 while
Warden gains 16. These are different bargains for different builds, not automatic
upgrades. No path-specific numbers were tuned, so no forced-path claim is made.
The class and aggregate acceptance limits remain as declared before the audit.

The 144-run-per-variant length/rung pass has no errors/timeouts and exercises
12-floor Normal, 16-floor Hard, and Hard+1/+3/+5 at eight floors. Its 24 short
four-floor records match all individual outcome/resource fields, with no trials.
The eligible settings start 81 trials, win 73 and wear 73 rewards. These are
coverage checks with four runs per class/setting, not fresh ladder win rates.
`sentinel.json` keeps each length/rung separate instead of pooling them.

Final reports retain actual per-measurement provenance. `standard-changed.json.gz`
is a composite of unchanged non-Mage observer-v3 cells and all six repeated
400-run Mage observer-v4 cells; `combine.py` asserts the same game source hash,
case keys, seeds, backgrounds and trial counts before combining. Every original
policy result remains in `standard-v3*`, alongside the repeated
`standard-mage-v4.json.gz`. Exploration and sentinel records follow the same
pattern. The final observer correction cannot enter a non-Mage run; all four
observer revisions also match the 480 baseline fingerprints. Passive off-mode
uses v3 on both sides and cannot enter the v4 branch: all 1,440 full-state
fingerprints match. None of these data replace the README's historical
default-policy table with optional-trial outcomes.

## Reproduction

Use Node 24 and Python 3. Prepare detached worktrees at `77c7159` (baseline),
`d403e87` (trial rules/observer v3) and `93fe329` (same rules, observer v4).
For the original standard baseline, unpack `observer-v1.js.gz` into its
`test/playtest.js`; use the archived v3 observer for auxiliary baseline pairs.
The v4 baseline equivalence pass uses `observer-v4.js.gz` at `77c7159`.
The runner clears inherited gameplay flags and records exact commands/settings,
source/observer hashes, seeds and runtime versions in every retained corpus.
For example, with those worktrees at the following paths and fresh output dirs:

```sh
python docs/balance/2026-10-18-mythics/run.py --repo /tmp/mythics-before --output /tmp/mythics-base-standard --suite standard --workers 4
python docs/balance/2026-10-18-mythics/run.py --repo /tmp/mythics-v3 --output /tmp/mythics-v3-standard --suite standard --workers 4
python docs/balance/2026-10-18-mythics/run.py --repo /tmp/mythics-v4 --output /tmp/mythics-mage-standard --suite standard --classes mage --workers 4
python docs/balance/2026-10-18-mythics/combine.py --original /tmp/mythics-v3-standard --mages /tmp/mythics-mage-standard --output /tmp/mythics-final-standard
python docs/balance/2026-10-18-mythics/analyse.py --baseline /tmp/mythics-base-standard --changed /tmp/mythics-final-standard --output /tmp/mythics-summary
```

Repeat auxiliary pairs with `--suite passive` (1,440 runs), `explore` (96) and
`sentinel` (144); repeat only Mage cells for v4 exploration/sentinels before
combining. `--suite observer` is the 480-run fingerprint proof, and `tuning`
the two-set 480-run preflight. Standard/auxiliary final pairs total **32,160
simulations**, with additional original-policy, tuning and observer diagnostics
retained separately. Raw JSON is compressed deterministically with gzip; no
master audio, source art or benchmark records are part of the Vercel deployment.

A final wording correction makes Horizon's existing at-least-two-square bonus
explicit in the tooltip and README. Its combat behaviour and audited numbers
are unchanged; the final diff from the measured game contains only that text
and the fractional save-timer validation fix described above.

## Local release validation

Both full Chromium projects pass: **573 checks** across phone and iPhone SE
viewports. A fresh Ranger phone check also passes after the final range-wording
clarification. The isolated 4× CPU budget passes its 30 fps minimum: fight
59.3 fps, wide 51.3, flooded 51.0 and rite 60.4; startup is 1.55 seconds in
that recorded run. No simulation workers ran beside these checks. Fractional
Last Gate timers have a real incoming-blow/save/native-reload regression, and
preview/cancellation/victory/equipment replay reaches the same final state.
`AGENTS.md` is regenerated from `CLAUDE.md`. The exact publication commit is
checked again by the mandatory `npm test` pre-push hook, and all seven CI jobs
(including WebKit and isolated performance) gate the GitHub release. Local
Chromium phone viewports do not establish a physical iPhone/iPad Safari pass.
