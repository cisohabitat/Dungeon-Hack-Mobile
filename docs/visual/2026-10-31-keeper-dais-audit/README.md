# Keeper dais follow-up: placement remains unapproved

Baseline: published v0.9.74, `10247658291babf7520975a0edbf707552e05b86`.
This is a documentation and evidence phase; runtime code and release numbers
remain unchanged. Human listening remains skipped; physical devices and a
complete AAA regrade remain open.

## Decision

Keep the generated encounters. At the selected close poses, the living Lich
and Heartforged obscure their own objectives; the Heart is visible beside the
Warlord. These views do not establish that moving incidental monsters would
improve play enough to justify changing fights. The existing painted keeper
badge already identifies the active boss when a guard occupies the foreground.

The isolated narrower prototype protects elites, group leaders/followers and
the intentional nave guard. Its raw-generator survey covers540 final floors:
8/12/16 levels, both routes, three sizes and30 `bench` seeds. It relocates96
ordinary creatures within their original halls;180 nonfinal comparisons are
identical. After normalizing those creatures' six position fields, raw generated
objects compare equal. This is a generator check, **not full initialized-floor,
reachability or balance clearance**. No new simulation win rates were measured.

A source audit found an additional reason to stop: generation precedes relics,
equipment, twists, scenery and puzzles in `Game.enterFloor`. Destinations cannot
be cleared against that later setup using only `Dungeon.generate`. A future
experiment must stage only fresh completed floors, exclude hazards and special
actors, prove reachable destinations, preserve existing saves, and complete the
required matched400-run cells across all seven classes, Normal/Hard, three seed
sets and8/12/16-floor runs. Moving a creature can change outcomes despite equal
counts, stats and random streams. The earlier rejected pilots remain separately
recorded in the [original review](../2026-10-29-keeper-identity/README.md).

## Native inspection and scope

`capture.cjs` runs the actual renderer, assets, clock, updates and forward inputs
on generated final floors. It supplies safety HP, matching door keys and legal
inspection poses through save/load. It records each requested step and observed
position change; blocked inputs are not successful walks. Close-dais poses are
separate supplied inspections. These are not unassisted runs or physical-device
observations. Twelve sessions cover each keeper at320×667,390×844,740×360 and
320×667 Double text/Calm. No source modules are routed in the accepted evidence.

An initial entrance assumption selected a locked door instead of walkable floor
and failed before valid captures; the corrected harness searches legal nearby
floor poses. An earlier complete capture had an unused extra fixture property
on the player; it was excluded in favor of a clean capture using explicit x/y/dir.
The initial sandboxed clean-capture launch could not start Chromium; the allowed
browser launch uses the same unchanged capture code. These setup attempts are
not release or performance clearance. No assertion or runtime budget changed.

## Reproduce

Use existing dependencies and system Chromium from the repository root:

```sh
KEEPER_OUT=/tmp/keeper-native node docs/visual/2026-10-31-keeper-dais-audit/capture.cjs
```

`native-evidence.json.gz` contains per-frame state, source hashes and actions;
selected screenshots keep their original pixels. Representative views:
[Lich at390px](lich-390-dais.png),
[Warlord in landscape](warlord-740-dais.png), and
[Heartforged at320px Double/Calm](heartforged-320-double-calm-dais.png). The rejected patch and raw
survey are retained independently. To repeat the generation survey, create two
detached worktrees at the baseline, apply `rejected-generation.patch.gz` only to
the candidate, and run:

```sh
KEEPER_BASELINE_ROOT=/path/to/baseline KEEPER_CANDIDATE_ROOT=/path/to/candidate KEEPER_SURVEY_OUT=/tmp/survey.json node docs/visual/2026-10-31-keeper-dais-audit/survey.mjs
```

Do not apply that patch to the game. Optional `KEEPER_CANDIDATE_ROOT` capture
routing is explicitly labelled prototype evidence and is not used here.

The roadmap now moves to a bounded regional treasure-room readability review.
Broader AAA3 layout work remains open; this audit does not complete it.

Local verification passed17 release fixtures and all six release browser cases
across both Chromium projects, without browser failures, skips or retries. The
restricted fixture launch initially failed; the allowed local-server run passed.
Both logs are retained. The exact-commit pre-push hook runs the full `npm test`;
all unchanged required CI jobs remain gates after pushing.
