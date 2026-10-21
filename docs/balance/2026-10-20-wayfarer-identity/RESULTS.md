# Final Wayfarer progression results

Selected gameplay: exclusive talents, lantern lessons, five life/two spell reserve
per learned talent and Sever the Veil’s active-rune accuracy. Baseline is v0.9.14
`64d7949971f2f06a04e36ba0747dfdf8a9953087`. Exact source hashes and commands are retained.

| Floors | Difficulty | Before wins | After wins | Before rate | After rate |
| --- | --- | ---: | ---: | ---: | ---: |
| 8 | normal | 1033/1200 | 1087/1200 | 86.08% | 90.58% |
| 8 | hard | 755/1200 | 837/1200 | 62.92% | 69.75% |
| 16 | normal | 965/1200 | 970/1200 | 80.42% | 80.83% |
| 16 | hard | 425/1200 | 492/1200 | 35.42% | 41.00% |

Each row combines three seed sets and 1,200 executions per revision. A repeated
seed/background identity is not independent; these are descriptive bot outcomes,
not human win-rate forecasts or a claim of equal class strength. The sixteen-floor
Hard policy still wins only 41%; it does not deliberately exploit every movement
or elemental combination. No bot policy or preferential talent order was changed.

| Floors | Difficulty | Mean depth before → after | Mean level before → after | Floor-one deaths before → after | Mean potions before → after | Mean rests before → after |
| --- | --- | --- | --- | --- | --- | --- |
| 8 | normal | 7.81 → 7.86 | 8.4 → 8.49 | 0 → 0 | 3.21 → 2.83 | 8.37 → 7.72 |
| 8 | hard | 7.5 → 7.54 | 7.85 → 7.97 | 1 → 1 | 4.73 → 4.4 | 8.28 → 8.13 |
| 16 | normal | 15.2 → 15.47 | 11.37 → 11.55 | 0 → 0 | 7.06 → 6.85 | 18.2 → 17.45 |
| 16 | hard | 12.94 → 13.49 | 9.96 → 10.31 | 2 → 0 | 9.95 → 10.43 | 15.69 → 16.03 |

## Verification and retained evidence

- 5,508 final-build/comparison executions; 3,568 retained first-build executions; 490 candidate/repeat executions: **9,566 fresh outcomes** total.
- Zero simulation ERROR causes or timeouts across the retained outcomes.
- 144 matched public-class state/log fingerprint pairs are identical (all six ordinary classes, Normal/Hard, three prefixes, four background indices).
- 120 freshly executed baseline pilots match the corresponding retained v0.9.14 outcome records field for field, supporting reuse of its 4,800 large baseline outcomes.
- 160 selected-candidate outcomes exactly match their corresponding final larger-cell outcomes.
- The first candidate’s repeated ten-run smoke cell matches its recorded tuning cell exactly.
- Settings, seeds and trial counts match the reused 400-outcome baselines. Hash checks reject source drift.

Per-cell counts, death causes, levels, resources, spell totals and learned talent/
lesson IDs are in `summary.json` and the raw JSON files. Spell totals and learning
counts do not establish that the bot used every conditional talent; direct rule
checks exercise those mechanics. Public samples do not replace the larger
historical six-class balance table.

The first implementation’s regressions are retained in `prototype/RESULTS.md`.
It was not published. All three tuning candidates, source patches, commands and
outcomes remain under their `tuning-*` directories. The `third` prefix was reserved
for final validation. No outcomes were discarded to improve a reported rate.

See [the reproduction notes](README.md) and run `python3 summarize.py` here to
verify source hashes, cell completeness, baseline agreement and fingerprints.
