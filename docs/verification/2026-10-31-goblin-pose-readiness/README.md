# Goblin companion pose readiness — 31 October 2026

The goblin rescue/locked-door check sampled a live picture and accepted only
standing or attack art. A correct goblin blink fails that predicate. The fixture
now waits for its cached poses, then requires the exact standing and blink
pictures at known presentation phases. Cage interaction, recruitment, the Use
button's Pick label, the actual click, open-door outcome and empty-error checks
remain unchanged. Game code, clocks, dice, pictures and saves are untouched.

## Original failure

[Run 41157746441](https://github.com/cisohabitat/Dungeon-Hack-Mobile/actions/runs/41157746441)
passed all 11 jobs, with one configured retry in the goblin case. The first
attempt passed the rescue/door checks and failed `features.spec.js:1985`'s final
picture assertion. The retry passed. [Failure details](ci-failure.json), the
[original trace](ci-failed-trace.zip) and [screenshot](ci-failed.png) are retained.
The trace SHA-256 is
`34e33bad9a3d4613785038faf7ecade2b3ba15a4e506852243c7c763ab5367ed`.

The failed attempt did not record the selected companion image. Therefore the
probe below demonstrates a defect in the old predicate, not the exact original
CI-selected pose or timestamp. This assertion failure is separate from the
native Chromium context crashes and WebKit offline resource/status failures.
Those engine issues remain open; this phase adds no speculative launch flags,
browser upgrade, extra retry or navigation workaround.

## Deterministic comparison and controls

`node docs/verification/2026-10-31-goblin-pose-readiness/probe.cjs` uses native
`Game.renderState` at both phone sizes, with supplied goblin, hound and absent
companion fixtures. Game updates, renderer, asset functions, dice and clocks
are not replaced. The optional opening cinematic is off in this diagnostic.

[Probe results](probe.json) reproduce the companion's native 3,700ms cycle and
311ms offset. A 200ms sample requires the exact base goblin picture; a 64ms
sample requires its exact blink. The original predicate passes standing and
fails the valid blink. Both exact checks reject hound and absent-companion
controls at both phases. Runtime source hashes match before/after the probe.
These supplied rendering samples are distinct from the real encounter/UI test.

The corrected end of the real encounter test first awaits `scrag.windup` and
`scrag.blink` through the existing `artReady` helper. Its future presentation
cycle starts after any current movement, lunge or hurt picture ends, then checks
both exact objects. It does not wait for a lucky live idle instant, accept
arbitrary poses, clear the companion's animation state, freeze updates or alter
the game's clock. Missing/wrong art still fails. The original 60-second total
case budget, assertion deadlines, CI retry count, workers, shard selectors,
browser versions, all cases and every release gate remain unchanged.

## Verification and limits

Ten repetitions of the actual goblin rescue/locked-door case passed with zero
retries in 42.8 seconds on the phone project. The deterministic probe separately
covers both phone widths and the hound/absence controls. Existing `features`
project membership stays unchanged; no case is added, removed or skipped.
See [validation.json](validation.json) for local checks and byte-preservation
controls. This fixture-only change needs no gameplay balance simulation.

The game remains v0.9.68/build 83. Publication still requires committed release
screens, exact-commit pre-push `npm test`, the full fresh Chromium/WebKit matrix,
unchanged isolated performance budget and publisher. Final CI evidence is
retained outside this immutable review snapshot. Passing one new run does not
prove all intermittent browser failures eliminated; physical-device review and
independent AAA regrade remain separate.
