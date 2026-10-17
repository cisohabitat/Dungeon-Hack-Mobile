# Optional treasure puzzles: regression comparison, 17 October 2026

The feature adds a per-hero puzzle choice, initially off. It puts three kinds of
catch on existing gold/gem piles, never on keys, relics, quest objects or travel.
It uses an independent seeded stream and does not add loot. Wrong guesses and
reading time cost no gameplay resources. The bot's explicit `PUZZLES=solve` mode
answers a cache only when standing on it, collecting only the guarded coins.
All navigation, combat, ordinary loot selection and spending choices stay as before.

## Scope chosen before comparing results

This is an exact regression comparison, not a fresh win-rate estimate or tuning
pass. Standard cells use all six classes on Normal and Hard, three seed sets
(`bench`, `alt`, `third`), four dungeon seeds per set and ten trials per seed:
40 runs per class/difficulty/set, 1,440 per variant. Each trial keeps the same
background and path rotation. The three variants are the previous revision
`98813a3`, feature revision `779f4a4` with puzzles off, and that revision with caches
solved. This is deliberately smaller than the usual 400-run statistical cells:
the acceptance criterion is identical individual results/resources and identical
off-mode state fingerprints, rather than a win-rate difference within noise.
Generator checks separately cover 1,080 floors across all sizes, three seed sets
and 2/4/8/16-floor runs. The published 14,400-run balance audit remains the source
of the README's win-rate table.

Sentinel cells separately compare all six classes on two Small floors (Normal),
four Large floors (Hard), twelve Medium floors (Normal), sixteen Medium floors
(Hard), and every Hard+1 through Hard+5 rung on eight Medium floors. Each uses
two `bench` seeds and two trials per seed. These check travel lengths, floor sizes
and ladder economy; they are not pooled into the standard win-rate sample.

A preliminary run also completed four unmodified 400-run cells (Fighter, Cleric,
Mage and Thief on Normal, `bench0`–`bench39`, ten trials each). Its raw results are
kept as `preliminary.json.gz`. The matching first forty results are checked against
the passive observer so the benchmark extension cannot change the baseline.
The rest of that larger preliminary job was stopped before outcome comparison;
its partial cells are neither counted nor presented as completed measurements.

## A benchmark pickup error caught before the final pass

`preflight.json.gz` retains the first observer's complete cells and its exact
source/hash. Its cache solver used `Game.input('take')`, which collects every item
on the square, including equipment the ordinary walking rules had left behind.
That changed the benchmark's loot policy. In `bench0` Mage trials 3 and 9, for
example, it took a spare shield and later paid 72 gold to appraise Shield and
Dagger, against 36 for Dagger alone. The extra 36 gold was spent, not lost by the
puzzle. Survival, combat and all other recorded fields matched in those cases.

`diagnostic.json.gz` keeps the ten-trial paired transaction traces;
`diagnostic-observer.patch` adds those passive ledgers to the preflight observer.
To reproduce the trace, restore `observerSource` from `preflight.json.gz` into
`test/playtest.js` in an isolated copy of the changed game, apply the diagnostic
patch, then run `FIT=1 DIFF=normal SEEDN=1 SEEDPFX=bench node test/playtest.js mage 10`
with and without `PUZZLES=solve` (and separate `JSON_OUT` files).

The final observer snapshots the guarded currency before solving and calls
`Game.takeItem` on those items alone. It leaves ignored gear alone, preserving
the original pickup policy. All three variants are rerun from scratch in the
final comparison; preflight cells are not mixed into the final results. No game
rule, bot navigation/combat decision or acceptance check was relaxed to conceal
the difference.

## Reproduce

Run from the repository root with Python 3 and Node 24. The baseline checkout is
isolated: the runner copies the changed `test/playtest.js` observer into it.

```sh
mkdir -p /tmp/deepdelve-puzzle-baseline
git archive 98813a3 | tar -x -C /tmp/deepdelve-puzzle-baseline
python3 docs/balance/2026-10-17-puzzles/run.py \
  --baseline /tmp/deepdelve-puzzle-baseline --changed "$PWD" \
  --output /tmp/deepdelve-puzzle-results --workers 4
python3 docs/balance/2026-10-17-puzzles/analyse.py \
  /tmp/deepdelve-puzzle-results/runs.json.gz
```

Add `--seeds 40` to use the usual 400 trials per standard cell. The saved archive
records settings, individual results, passive fingerprints, the prior revision,
rule-source hashes and observer hash. `analyse.py` fails on errors/timeouts,
passive fingerprint differences or any changed individual outcome/resource field
apart from the new observational `puzzlesSolved` counter. It compares casts,
arrivals, depth, deaths and causes, equipment, potion counts, resting, purchases, gold and all
other fields the bot actually records. `goldFound` is end-of-run cash;
`potionsDrunk` counts bot attempts and `goldSpent` is an unpopulated legacy field.

## Results

The final comparison passed **4,968 simulations in 270 cells** (90 paired
settings): 4,320 standard runs and 648 sentinel runs. Each variant has 1,656 runs.
There were **zero errors and zero timeouts**.

| Comparison | Baseline | Puzzles off | Puzzles solved |
| --- | ---: | ---: | ---: |
| Standard runs, all six classes, Normal/Hard, three seed sets | 1,440 | 1,440 | 1,440 |
| Length/size/ladder sentinel runs | 216 | 216 | 216 |
| Standard Normal wins (of 720) | 587 | 587 | 587 |
| Standard Hard wins (of 720) | 432 | 432 | 432 |

All **1,656 passive/off state fingerprints** matched the previous revision.
All recorded individual outcomes and resource fields matched for the solved
variant too; only the new observational `puzzlesSolved` counter is excluded.
That includes floor-arrival times/resources, casts, rests, purchases, cash,
equipment summaries, deaths/causes and progression. No class or economy tuning
was needed. These small-cell win counts are regression evidence, not replacements
for the larger balance table or estimates of human success rates.

The on variant solved **664 caches**: Cleric 121, Druid 102, Fighter 108,
Mage 123, Ranger 110 and Thief 100. The bot does not seek every cache or solve one
it has not reached; human route choices and willingness to solve puzzles can
therefore change the treasure collected. The separate rules tests prove unchanged
floor geometry and loot totals, one solvable answer per generated catch, unlimited
retries without cost, and save/code/replay behaviour. Optional treasure never
blocks progression.

`runs.json.gz` retains every final row, its settings and fingerprints;
`summary.json` is the strict analysis output. The stored source hashes were
checked against Git revisions `98813a3` (baseline) and `779f4a4` (feature), including
the exact corrected observer committed with the feature. The provenance also
records the actual Node version and start/finish times. Earlier preliminary and
preflight results remain separate as described above.

Additional feature verification: 708 rule checks; the complete Chromium sweep
passed 523 checks and caught the returning-prologue footer issue, whose fix then
passed 18 targeted story, accessibility, large-text, controller and start-option
checks. The isolated 4× CPU frame-rate test passed at 58–60 FPS across all four
scenes (30 FPS required). Fresh CI tests the final published revision separately.


Build 6 follows with puzzle-dialog Tab containment and browser-test readiness
checks after save transfer. It changes no game rule, bot choice or resource
calculation, so these paired balance results remain applicable.
