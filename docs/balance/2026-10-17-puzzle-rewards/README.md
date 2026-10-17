# Puzzle reward choices: matched comparison, 17 October 2026

## Design and acceptance criteria (set before results)

Build 7 lets an optional puzzle's original purse pay for one alternative: a
healing draught or unidentified class-usable gear, with remaining coins. Gold
keeps the original items. The fixed conversion is 1.6 times base item value,
including 0.9 per enchantment point; round up, double on Hard ladder rungs.
Gear tiers are capped at min(4, 1 + floor(depth / 3)); make is 0 or +1, with
30% +1, using independent reward dice. No relics, curses or additional purse.
An unaffordable alternative is absent. Legacy puzzles retain their coin release.

The comparison uses build 6 as baseline with the same explicit puzzle-solving
observer on both snapshots. Its navigation, combat, ordinary loot selection and
spending stay unchanged. Only PUZZLE_REWARD selects the requested cache share;
unaffordable options fall back to gold. The observer collects original guarded
coins or newly created conversion objects, leaving co-located ignored loot alone.

Standard cells use six classes, Normal/Hard, bench/alt/third, 40 seeds and ten
trials per seed: 400 per class/difficulty/set, 14,400 per variant. Three full
variants compare baseline solved caches, changed potion-first and changed
gear-first. These fixed policies exercise the two alternatives separately rather
than selecting rewards with knowledge of future outcomes. Both path/background
rotations are preserved; conditional path rates remain confounded as documented
in the main README. Trials sharing a seed are not independent samples.

Additional paired regression cells use four seeds/set and ten trials for baseline
puzzles off, changed puzzles off and changed gold choice. Passive fingerprints
must match exactly; changed gold must preserve every recorded gameplay field,
excluding puzzle counters. Short/long delves, Small/Large floors and Hard+1–5
are separate sentinel settings across six classes, two bench seeds and two
trials, using baseline, potion-first and gear-first. They are not pooled into
standard win rates.

Acceptance: zero errors/timeouts; no passive regression; original-gold gameplay
parity; for each optional policy, aggregate win-rate movement within 3 percentage
points and each class within 5 points of matching baseline. Class spread may
increase by no more than 2 points relative to baseline (the previous Normal spread
already slightly exceeded six). Review depth, deaths below level 5, causes,
resources and conditional path outcomes, including the sentinel settings. A
failed bar requires investigation/tuning and a fresh final comparison, not hiding
runs or changing the observer's ordinary decisions. These simulations model a bot,
not real-player win rates. Exact resource differences are expected for conversion.

Results and reproduction commands will be recorded after the final comparison.
