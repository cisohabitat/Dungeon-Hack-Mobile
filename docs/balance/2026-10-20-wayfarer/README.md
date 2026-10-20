# Hidden Wayfarer balance audit

The Spellblade is a new hidden class; it has no historical win-rate baseline.
The six public classes are compared against production with matching seeds,
backgrounds and complete-state fingerprints. The ordinary class balance table
in the main README remains historical and is not replaced by these smaller
regression samples.

## Revisions and observer

- Production baseline: `41bf3aaf4568e4ccbbb2b5df104b767f1ff043b4` (v0.9.13).
- Initial Spellblade: `4c455f5`, without Deepward. The large eight-floor pass
  predates its final presentation, catalogue-validation and stronger-rune renewal
  fixes. The bot renews expired runes only; these fixes do not change its decisions.
- Final gameplay: `0aa55321a68c8a584b93f15ee5178908b7062198`, with Deepward.
  The ward is derived from held gear and depth: zero through floor eight,
  then +1 at floor 9, +2 at 11, +3 at 13, and a maximum +4 at 15.
- `deepward-pilot-*` used the same armour formula in a scratch copy of `4c455f5`;
  the later Conditions label and read-only observer have no gameplay effect.
- `test/playtest.js` observer SHA-256:
  `d56e17dfb735809d1f4f38a81e056a17316c580ad09ec3e9dd0a2dd5a1f69a97`.
  `observer.patch` retains its difference from the production observer. Apply it
  to the baseline when comparing the same hidden-class observation policy.

The Spellblade bot raises Fire Runic Edge when an awake enemy is nearby,
uses Spellguard against a nearby wind-up, and occasionally tries Lantern Step
while badly hurt. It favours Intelligence in point-buy and rotates the same six
backgrounds. The decisions for the six public classes are unchanged. No bot-only
bonuses, adjusted damage, weaker monsters or alternate economy are used.

## Settings and reproduction

All cells use FIT=1, fresh local storage, Medium floors, normal monsters and
treasure, locked doors and traps, and permadeath off. Puzzles are off. The
Spellblade has no paths or Mythic trial. Public classes retain their normal bot
policy and path/background rotation. Seed prefixes are `bench`, `alt`, `third`;
indices start at zero. Each JSON includes the exact options, seeds, trial count,
backgrounds and individual outcomes. A trial can repeat an identity, so 400 runs
are not 400 independent dungeon seeds. These figures describe this bot, not a
prediction of human win rates.

Primary eight-floor cells (`spellblade-*`): 40 seeds × 10 trials, 400 per
Normal/Hard/prefix, 2,400 runs total:

```sh
FIT=1 DIFF=normal SEEDN=40 SEEDPFX=bench JSON_OUT=/tmp/normal.json node test/playtest.js spellblade 10
FIT=1 DIFF=hard SEEDN=40 SEEDPFX=bench JSON_OUT=/tmp/hard.json node test/playtest.js spellblade 10
```

Repeat with `SEEDPFX=alt` and `third`. Final sixteen-floor cells (`final-16-*`)
add `LEVELS=16` to the same commands: another 2,400 runs. Twelve-floor smoke
cells (`final-12-*`) use `LEVELS=12 SEEDN=4` and 5 trials: 20 per cell.

The final sixteen-floor `bench` and `alt` cells ran as complete 400-run
processes. To keep four CPU cores busy for the remaining set, `third` was split
into forty ten-run processes per difficulty with `SEEDONLY=third0` through
`third39`, always retaining `SEEDN=40`, `SEEDPFX=third` and ten trials. Keeping
the full seed list preserves the global background and trial index. Raw shards
are retained losslessly in `shards.tar.gz` (under `shards/` inside the archive); the root `final-16-*-third.json` concatenates them in seed
order, with all 400 outcomes and the same options. `scheduling.json` records
commands/settings. The original four bench/alt measurements were retained unchanged. The old
coordinator was paused; two just-started monolithic third-set processes were
stopped before producing measurements, and replaced by the seed shards. The
remaining bench/alt processes were allowed to finish before coordinator cleanup.
After a short transition overlap, four Node workers ran the remaining jobs.
No game or observer source changed during this scheduling adjustment.

`verify-shards.py` independently repeated the twenty-run Normal bench pilot
as four per-seed processes. All twenty complete outcome records match the
unsharded pilot exactly, including backgrounds, resources, deaths and casts.
The retained check is `sharding-check.txt`, with its raw records alongside the
main shards. These twenty verification executions are additional to the root
cell totals; the 800 third-set shard outcomes are counted once through their
combined cells, not again as separate measurements.

The archive contains 168 raw JSON/log files, including the scheduling check.
`shards.sha256` verifies the archive. Extract into this report directory to
inspect the per-seed records; the unpacked `shards/` is ignored by Git. Root
combined cells remain plain JSON and can be summarised without extraction.

For example, one third-set shard is:

```sh
FIT=1 LEVELS=16 DIFF=normal SEEDN=40 SEEDPFX=third SEEDONLY=third17 JSON_OUT=/tmp/third17.json node test/playtest.js spellblade 10
```

Matched eight-floor compatibility (`prototype-8-*`, `final-8-*`) uses
`FP=1 SEEDN=2` and 10 trials, 20 per cell/revision. Public comparisons
(`baseline-public-*`, `working-public-*`) use `FP=1 SEEDN=3`, no class argument
and the default 2 trials: 36 runs per cell/revision, all six public classes and
all six backgrounds. No differences in complete final-state/log fingerprints
are accepted as harmless merely because headline win rates agree.

Supplementary prototype cells (`supplement-*`) use `SEEDN=4` and 5 trials with
`LEVELS=2`, `LEVELS=16`, or `LEVELS=8 DIFF=hard+3`, on all three prefixes.
`explore-*` uses `EXPLORE=0.8 SEEDN=2` and 5 trials at eight floors.
Deepward pilots are 20 runs per cell at sixteen floors on `bench` and `alt`;
the third prefix was held out from tuning. These small cells are diagnostics,
not 400-run balance estimates. Frost and Lightning have rule/UI coverage but
this bot casts Fire only, and seldom uses Step; no claim of optimal elemental
or human movement play follows from these results.

## Reading the records

Run `python3 docs/balance/2026-10-20-wayfarer/summarize.py` to regenerate the
cell summaries and assert complete fingerprint equality. The script rejects
ERROR causes, timed-out runs and truncated result counts.

Use `casts` for successful spells. The older `runes` observer field also counts
Spellblade rune decisions, so it must not be treated as a forge-use statistic.
`potionsDrunk` is bot attempts, not verified drinks; `goldFound` is remaining
cash, and `goldSpent` is an unpopulated legacy field. `potsAtEnd` is actual
remaining healing potions. Early deaths mean deaths below hero level five.

Final measured outcomes are recorded in `RESULTS.md` and the raw JSON/log pairs.
