# Measured Wayfarer outcomes

Settings, revisions, observer limits and commands are in [README.md](README.md).

## Standard eight-floor delve

| Difficulty | bench (400) | alt (400) | third (400) | Combined |
| --- | ---: | ---: | ---: | ---: |
| normal | 344/400 (86.00%) | 342/400 (85.50%) | 347/400 (86.75%) | 1033/1200 (86.08%) |
| hard | 251/400 (62.75%) | 242/400 (60.50%) | 262/400 (65.50%) | 755/1200 (62.92%) |

This large pass measured the prototype. The final ward is zero on all eight
floors, and the matched prototype/final compatibility samples retain identical
complete state and log fingerprints: 120 matched runs across the three sets.
These samples support reuse; the large pass is not mislabelled as a fresh run
at the final revision.

## Final sixteen-floor delve

| Difficulty | bench (400) | alt (400) | third (400) | Combined |
| --- | ---: | ---: | ---: | ---: |
| normal | 338/400 (84.50%) | 329/400 (82.25%) | 298/400 (74.50%) | 965/1200 (80.42%) |
| hard | 139/400 (34.75%) | 157/400 (39.25%) | 129/400 (32.25%) | 425/1200 (35.42%) |

The final sixteen-floor cells were run after adopting the capped Deepward.
They validate all three sets at the final gameplay revision. No settings or bot
decisions changed to obtain these results.

Sixteen-floor Hard remains substantially more demanding for this Fire/guard bot
than the historical public-class table suggests. Deepward is a bounded aid,
not a claim of identical class strength. No public class was weakened, and the
standard eight-floor policy is unchanged. Human elemental and movement choices
are not measured here; no human win-rate claim follows.

## Resources, deaths and ability use

| Floors / difficulty | Mean deepest floor | Deaths below hero 5 | Potion attempts/run | Potions left/run | Cash left/run |
| --- | ---: | ---: | ---: | ---: | ---: |
| 8 / normal | 7.81 | 28 | 3.21 | 4.04 | 338.80 |
| 8 / hard | 7.50 | 55 | 4.73 | 2.55 | 317.26 |
| 16 / normal | 15.20 | 22 | 7.06 | 5.02 | 478.02 |
| 16 / hard | 12.94 | 46 | 9.95 | 1.93 | 536.33 |

Actual successful casts and every death cause are retained in `summary.json`;
the raw JSON is the source of truth. Potion attempts and remaining cash have
the observer limitations described in README. The bot predominantly measures
Fire Runic Edge and Spellguard, with very few Lantern Steps.

## Supplementary diagnostics

| Case | bench | alt | third |
| --- | ---: | ---: | ---: |
| Prototype: 2 floors Normal (20/cell) | 20/20 (100.00%) | 20/20 (100.00%) | 20/20 (100.00%) |
| Prototype: 2 floors Hard (20/cell) | 19/20 (95.00%) | 20/20 (100.00%) | 20/20 (100.00%) |
| Prototype: 16 floors Normal (20/cell) | 17/20 (85.00%) | 12/20 (60.00%) | 7/20 (35.00%) |
| Prototype: 16 floors Hard (20/cell) | 3/20 (15.00%) | 5/20 (25.00%) | 2/20 (10.00%) |
| Prototype: 8 floors Hard+3 (20/cell) | 4/20 (20.00%) | 7/20 (35.00%) | 9/20 (45.00%) |
| Prototype: 8 floors Normal, explore 0.8 (10/cell) | 10/10 (100.00%) | 10/10 (100.00%) | 10/10 (100.00%) |
| Prototype: 8 floors Hard, explore 0.8 (10/cell) | 9/10 (90.00%) | 9/10 (90.00%) | 8/10 (80.00%) |
| Final: 12 floors Normal (20/cell) | 18/20 (90.00%) | 17/20 (85.00%) | 14/20 (70.00%) |
| Final: 12 floors Hard (20/cell) | 11/20 (55.00%) | 5/20 (25.00%) | 10/20 (50.00%) |

The small prototype sixteen-floor cells exposed late-run fragility. Matched
20-run pilots on bench/alt changed Normal wins from 17 to 18 and 12 to 16;
Hard changed from 3 to 10 and 5 to 5. The third set was held out from tuning.
These pilot deltas are small-sample observations; the larger final table uses
different trial coverage and must not be interpreted as a matched causal delta.

## Existing-class regression check

216 paired complete runs (432 executions) cover all six public classes, both
difficulties, three seed sets and all six backgrounds. Every final-state/log
fingerprint matches production exactly. This is a focused compatibility sample,
not a fresh 400-per-class balance table. The historical six-class measurements
remain applicable to the unchanged behavior within the tested scope.

All retained runs have zero ERROR causes and zero timeouts. Regenerate the
summary with `python3 docs/balance/2026-10-20-wayfarer/summarize.py`.

Human skill, Frost/Lightning decisions, aggressive movement, optional puzzles,
and physical-device performance are outside these measurements. Hard+3 and
exploration diagnostics are small prototype samples; Deepward is inactive
there because they use eight floors.
