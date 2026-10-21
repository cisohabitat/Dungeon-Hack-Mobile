# Wayfarer identity and progression audit

This update gives the hidden Spellblade its own gatekeeper origin in creation
and in the run-opening screen, a carried silver-and-blue lantern, six exclusive
class talents at even levels and six lantern lessons at odd levels. Each talent
recalls a soul: five maximum life and two maximum spell points, restoring those
amounts. Sever the Veil also gives +1 to hit while a rune burns on a held blade. Ordinary
classes retain their original filtered lesson pool and talent choices. Older
Wayfarer saves keep their existing generic lessons; future offers use the new pool.
Renown beyond hero level twelve is unchanged.

## Comparison and reproduction

Baseline: `64d7949971f2f06a04e36ba0747dfdf8a9953087` (v0.9.14).
The final gameplay and observer files are identified in `source-hashes.json`.
`commands.json` retains every command, working directory and environment override.
Use a clean checkout of the baseline and apply only the observer's final
`wayfarerLearned` reporting line from `test/playtest.js`; it records learned IDs
without changing decisions, clocks or dice. All public class policies and the
Spellblade's existing Fire/guard/occasional-step policy are unchanged. Exclusive
choices use the bot's existing fallback to the first offered card. No bot-only
power or preferential talent order was added.

Primary measurements use FIT=1, medium maps, normal monsters/treasure, locks and
traps, no puzzles and permadeath off. Each new eight- and sixteen-floor cell
runs forty seeds with ten trials each (400 outcomes), on Normal and Hard,
for `bench`, `alt` and `third`: 4,800 new outcomes. Backgrounds rotate through the
same six identities by global trial index. A repeated trial identity is not an
independent dungeon seed; these are bot outcomes, not predicted human win rates.

Matched 400-outcome baseline cells are retained in the previous
[Wayfarer audit](../2026-10-20-wayfarer/). Fresh ten-outcome production pilots
for each length/difficulty/prefix must match the retained first seed's ten
outcomes field for field before those larger measurements are reused. This
adds 120 freshly executed baseline outcomes and reuses 4,800 retained outcomes.
`summary.json` and `summarize.py` verify settings and baseline agreement.

Supplementary new-build cells cover two and twelve floors on Normal and Hard,
and eight-floor Hard+3: twenty outcomes per prefix/cell, 300 total. Six matched
public-class cells run all six ordinary classes on Normal/Hard and three
prefixes, two seeds and two trials per seed (four background indices): 144
before/after pairs, 288 executions. Their whole-state/log fingerprints must
match exactly. These are regression samples; they do not replace the larger
historical public-class balance table.

Run `python3 docs/balance/2026-10-20-wayfarer-identity/summarize.py` after all
cells complete. It rejects missing/incomplete cells, errors/timeouts, baseline
mismatches and public-class fingerprint changes. JSONs retain individual
outcomes, deaths, depth, levels, resources, spell counts and learned talent/lesson
IDs; logs retain the command summaries and public fingerprints.

No treasure/exploration reward, dungeon placement, ladder rule or Deepward
formula changed. The three-square step retains exploration, occupancy, trap
and movement restrictions. Threshold Ward cannot refresh an existing guard;
poison and hunger retain their bypass. Rule checks cover learned rune/ward
bounds, real casts, every normal level, old-save loading and rejected invented,
duplicated or wrong-class memories. Focused browser checks cover creation,
personal opening text, actual level-up cards, carried art on ordinary/dark
floors and removal, keyboard/save preservation and casting/save/resume.

The earlier full browser invocation was deliberately stopped after the personal
opening-story fix was added, so the final full invocation uses one settled
source revision. No partial invocation is counted as a passing full suite.

## Retained tuning

The first implementation replaced general lessons without making up their life,
spell reserve and accuracy gains. Its larger samples showed a regression, so it
was not published. `prototype/` retains all 3,568 completed outcomes, its source
patch against the baseline, commands, hashes and scheduling record. Scheduling
was paused; every in-flight cell completed before the coordinator was stopped
and before source changed. Unstarted cells were cancelled, not discarded losses.

Three isolated candidates were tested on matching `bench` and `alt` inputs,
eight/sixteen floors and Normal/Hard, twenty outcomes per cell (160 per candidate):
`tuning-memory` (three life/one reserve per talent), `tuning-memory-aim` (adds
Sever the Veil's active-rune accuracy), and `tuning-memory-final` (five life/two
reserve plus that accuracy). Each retains exact source hashes, a patch from the
prototype, commands, raw outcomes and summaries. The final larger matrix uses
the selected five/two version; small tuning samples are not final balance claims.
The original policy and talent fallback order were retained for every candidate.

`tuning-memory/determinism-bench0-repeat.json` retains another ten executions:
the first candidate's smoke run repeated its first ten-run cell. The two records
must match exactly. These repetitions describe execution counts, not independent
identities. No memory bonus is added again on load or granted to ordinary classes.
The selected source also reproduces its 160 tuning outcomes within the larger
final cells; the summary verifier checks those full outcome records exactly.
