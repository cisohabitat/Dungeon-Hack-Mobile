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

Standard cells use six classes, Normal/Hard, bench/alt/third, 12 seeds and ten
trials per seed: 120 per class/difficulty/set, 4,320 per variant. Three full
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
trials, using baseline, potion-first and gear-first. A separate exploration
pass uses `EXPLORE=0.8` on eight Medium floors, all six classes on Normal/Hard,
`bench` and `alt`, two seeds and two trials per setting: 288 simulations. This
exercises cache collection more thoroughly than the usual stair-seeking policy. They are not pooled into
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

### Runtime scope amendment, before inspecting full-cell results

The initial plan used the usual 400-run cells. Before inspecting any complete 400-run outcomes,
the observed runtime led to the 120-run cells above, with no changes to game
rules, observer decisions or acceptance bars. This is an optional, bounded
conversion using existing items, not a retuning of the standard game. Matching
inputs and 360 runs per class/difficulty over three sets provide a targeted
comparison; the small sentinel samples are only regression checks. It has less
power than the usual 1,200 per class/difficulty and cannot rule out small effects.
The published standard win-rate table remains tied to its 14,400-run audit.
`runtime-preflight.json.gz` retains the original inputs and all complete preliminary
cells; interrupted cells are excluded. Every final cell is run afresh in a new
output directory, including the preliminary passive/gold settings.

## Reproduce

From the repository root, create isolated worktrees and use Node 24 / Python 3:

```sh
git worktree add --detach /tmp/deepdelve-reward-baseline a1a4c43
git worktree add --detach /tmp/deepdelve-reward-changed cc08b0b
python3 docs/balance/2026-10-17-puzzle-rewards/run.py \
  --baseline /tmp/deepdelve-reward-baseline \
  --changed /tmp/deepdelve-reward-changed \
  --output /tmp/deepdelve-reward-results --seeds 12 --workers 4
python3 docs/balance/2026-10-17-puzzle-rewards/run.py \
  --baseline /tmp/deepdelve-reward-baseline \
  --changed /tmp/deepdelve-reward-changed \
  --output /tmp/deepdelve-reward-exploration --explore-only --workers 4
python3 docs/balance/2026-10-17-puzzle-rewards/analyse.py \
  /tmp/deepdelve-reward-results/runs.json.gz \
  /tmp/deepdelve-reward-exploration/runs.json.gz
```

Omit `--seeds 12` for the usual 400-run standard cells. The runner records exact
revisions, rule hashes, observer source/hash, Node version, environment settings,
seed lists and all individual results. It copies the same observer to the baseline.
Use a new output directory if sources/settings change. The analyser fails on
errors, timeouts, passive/gold regressions or any declared balance bar.

## Exploration coverage

The separate exploration pass completed **288 simulations in 72 cells**, with
zero errors and timeouts. It opened 1,408 caches across the three policies.
Alternative policies chose a healing draught 373 times and gear 470 times;
95 potion requests fell back to original coins when unaffordable. These count
choices placed on the floor, not guaranteed inventory acquisitions. A full
pack/belt leaves the chosen item on the floor. The fixed policies do not optimise
for existing gear or remaining belt room, and can make a costly choice a human
would decline. All ordinary bot decisions remain unchanged.

| Exploration setting | Baseline wins | Potion-first wins | Gear-first wins |
| --- | ---: | ---: | ---: |
| Normal, 48 runs per policy | 44 | 46 | 45 |
| Hard, 48 runs per policy | 40 | 37 | 42 |

Both gains and losses occur on matched inputs: the Hard potion policy converts
two baseline losses to wins and five wins to losses; gear converts four losses
to wins and two wins to losses. These tiny samples exercise the economy and
branching combat, not establish a win-rate estimate or prove improvement.
Do not pool them into the standard cells or tune a class to them. Raw individual
resources, deaths/causes and conditional path records are retained in
`exploration.json.gz` and the combined summary.

## Local verification

- `npm test`: 712 rule checks, plus types, generator, security/API, narration
  and voice catalogue checks, all passing.
- Full Chromium phone/small suites: 530 pass and one crowded-scene timing
  failure at four concurrent workers (8.83 ms against an 8 ms limit). That
  unchanged check passes on both sizes in isolation; all 531 cases verified.
  The earlier art-loading timeout with simultaneous simulations also passes
  with simulations paused. No acceptance limit was weakened.
- Isolated 4× CPU-throttled budget: fight 58.3 fps, wide 53.4, flooded 58.6,
  rite 60.3; startup 1,671 ms. All scene/startup budgets pass.
- Reward-specific coverage includes original-gold parity, affordable/conserved
  offers for all classes and ladder prices, full pack, pending save/code,
  legacy caches, one-time claims, replay, touch/keyboard/controller, axe,
  double text, Calm view and reduced motion. WebKit runs in CI; local Chromium
  viewports do not establish a physical iOS device pass.

The measured game/observer revision is `cc08b0b`; later changes clarify a reward
label with a plus sign, clean up a test listener, add a controller regression and
update documentation/measurement scripts. They do not change game rules or
ordinary bot decisions, so the measured gameplay results remain applicable.

## Main matched results

The final comparison and exploration pass completed **18,216 simulations in 450 cells**. Standard cells contribute 12,960 runs, passive/gold regressions 4,320, length/size/ladder sentinels 648 and exploration 288. There were **zero errors, zero timeouts and zero passive/gold regressions**.

All 1,440 off-mode fingerprints and individual outcomes match build 6. All 1,440 original-gold trials preserve every recorded gameplay field apart from the observational puzzle counters. Alternative policies are allowed to change resources and subsequent combat. All declared aggregate/class/spread bars passed.

### Standard cells: 360 matched runs per class/difficulty

These are the smaller targeted samples described above, not a replacement for the README's larger standard-mode audit. Each difficulty/policy has 2,160 runs.

| Difficulty | Baseline wins | Potion-first wins | Gear-first wins | Potion delta | Gear delta |
| --- | ---: | ---: | ---: | ---: | ---: |
| Normal | 1766/2160 (81.76%) | 1778/2160 (82.31%) | 1766/2160 (81.76%) | +0.56 points | +0.00 points |
| Hard | 1340/2160 (62.04%) | 1329/2160 (61.53%) | 1318/2160 (61.02%) | -0.51 points | -1.02 points |

| Difficulty | Class | Baseline | Potion-first | Gear-first |
| --- | --- | ---: | ---: | ---: |
| Normal | Fighter | 310/360 (86.11%) | 310/360 (86.11%) | 313/360 (86.94%) |
| Normal | Cleric | 310/360 (86.11%) | 311/360 (86.39%) | 303/360 (84.17%) |
| Normal | Mage | 305/360 (84.72%) | 306/360 (85.00%) | 309/360 (85.83%) |
| Normal | Thief | 272/360 (75.56%) | 278/360 (77.22%) | 275/360 (76.39%) |
| Normal | Ranger | 283/360 (78.61%) | 284/360 (78.89%) | 285/360 (79.17%) |
| Normal | Druid | 286/360 (79.44%) | 289/360 (80.28%) | 281/360 (78.06%) |
| Hard | Fighter | 215/360 (59.72%) | 218/360 (60.56%) | 219/360 (60.83%) |
| Hard | Cleric | 234/360 (65.00%) | 236/360 (65.56%) | 223/360 (61.94%) |
| Hard | Mage | 240/360 (66.67%) | 239/360 (66.39%) | 235/360 (65.28%) |
| Hard | Thief | 225/360 (62.50%) | 218/360 (60.56%) | 222/360 (61.67%) |
| Hard | Ranger | 206/360 (57.22%) | 200/360 (55.56%) | 204/360 (56.67%) |
| Hard | Druid | 220/360 (61.11%) | 218/360 (60.56%) | 215/360 (59.72%) |

Observed class spreads (baseline / potion / gear) are 10.56 / 9.17 / 10.56 points on Normal and 9.44 / 10.83 / 8.61 on Hard. The smaller Normal baseline is wider than the prior full audit's 6.33 points; this is a different, noisier subset. The feature bar limits widening relative to the matched baseline; passing it does not establish that global class balance meets six points. No class was tuned to these samples.

### Resources and early deaths

Means use all standard runs of the stated difficulty/policy. Early deaths mean death below hero level 5. Cash is end-of-run cash, not cumulative earnings; potion drinking counts bot attempts, and the legacy goldSpent field is not populated. The combined summary retains actual spell casts, purchases, path timing, causes and every individual record.

| Difficulty | Policy | Early deaths | Mean deepest floor | Mean cash left | Healing potions left | Drink attempts | Purchases |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Normal | baseline | 78 | 7.69 | 350.8 | 4.42 | 2.63 | 5.55 |
| Normal | potion | 77 | 7.70 | 344.7 | 4.46 | 2.69 | 5.49 |
| Normal | gear | 82 | 7.68 | 351.1 | 4.30 | 2.68 | 5.45 |
| Hard | baseline | 206 | 7.23 | 304.9 | 3.08 | 3.92 | 5.31 |
| Hard | potion | 208 | 7.22 | 302.6 | 3.09 | 4.07 | 5.25 |
| Hard | gear | 200 | 7.23 | 303.7 | 3.02 | 3.95 | 5.26 |

### Length, size and ladder coverage

Each row has 24 runs per policy (all six classes, two seeds and two trials). These small samples check the systems and expose changed outcomes; they are not new win-rate or ladder-curve estimates. Both new alternatives retain normal collection limits and double their conversion cost on every Hard ladder rung.

| Setting | Baseline wins | Potion-first wins | Gear-first wins |
| --- | ---: | ---: | ---: |
| 2 Small floors, Normal | 22/24 | 22/24 | 22/24 |
| 4 Large floors, Hard | 8/24 | 9/24 | 7/24 |
| 8 Medium floors, Hard+1 | 13/24 | 13/24 | 13/24 |
| 8 Medium floors, Hard+2 | 15/24 | 15/24 | 15/24 |
| 8 Medium floors, Hard+3 | 13/24 | 13/24 | 13/24 |
| 8 Medium floors, Hard+4 | 11/24 | 11/24 | 11/24 |
| 8 Medium floors, Hard+5 | 11/24 | 11/24 | 11/24 |
| 12 Medium floors, Normal | 21/24 | 21/24 | 21/24 |
| 16 Medium floors, Hard | 17/24 | 15/24 | 15/24 |

`summary.json` retains the matched per-path/background-mix review and death-cause distributions as well as each acceptance bar. The ordinary bot couples path rotation and background rotation; these conditional figures do not isolate a path's effect. No class/path tuning or ordinary bot policy changes were made to fit the samples.


The largest conditional path drop is the Hard Templar with gear-first: 124/175
to 115/175 wins (−5.14 points); the full Cleric class moves from 234/360 to
223/360 (−3.06 points), within the declared class bar. The largest conditional
gain is Normal Trickster with potion-first (+2.91 points). Path groups also
condition on reaching a path and can change membership after a reward changes
a run, so these are not isolated path effects. Fixed gear-first can select
duplicates and incur appraisal costs; it is not a claim that gear is always the
best share. Gold retains exact previous outcomes. Future path tuning would need
forced-path passes on matching backgrounds, as the standing rules require.

The leading standard death causes remain the Goblin Warlord and Dread Lich.
Hard gear-first has 49 Wraith deaths against 41 in the baseline; early deaths
are 200 against 206. Resource, cause and path differences were reviewed rather
than treating an aggregate win-rate pass as proof that every choice improves
every run. No ordinary bot decision or acceptance limit was changed to conceal
a loss.


The first CI pass verified the game in all six other jobs, but the two new
Safari reward reload tests began reload after the fade without waiting for
the same-document history traversal. Their navigation readiness now matches
the existing save-transfer guard, and they assert the restored pending state
and Puzzle control before reopening. Narration remains enabled; neither game
rules, assets nor the balance observer changed for this test-only follow-up.
The strengthened puzzle checks pass all 20 phone/small Chromium cases.
