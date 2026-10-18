# Mythic class items: predeclared balance comparison

Baseline: 77c71598de045144b78b296c9f757a5d49a7eb34 (v1.4.0).
Six class-specific items, one equipped at a time, each with a drawback.
An optional trial at the existing final-floor Vigil Lamp in custom delves of
at least eight floors replaces that encounter's ordinary aid. Daily/Weekly,
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
