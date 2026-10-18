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
