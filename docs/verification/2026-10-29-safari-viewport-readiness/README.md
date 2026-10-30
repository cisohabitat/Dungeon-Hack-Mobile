# Safari viewport readiness recovery

v0.9.60 commit `9b355202bb4588c14ff6c553daaa7125bb6d7e15` remains an untagged,
CI-blocked build. Nine required groups passed, but Safari shard 1 failed three
new combat-layout cases on both attempts. Publication correctly skipped.
[Failed run](https://github.com/cisohabitat/Dungeon-Hack-Mobile/actions/runs/40947871003).

All four viewport overlap, font-size, minimap and touch-target checks passed.
The failures were the unchanged warning-height comparison after rotating back
from landscape to 320×667. Every failed trace proves the cached baseline was
already stale before the test cleared the wind-up: Larger text cached 194.625px,
but its canvas was already 192.328125px before the clear; Double text cached
139.75px, but was already 136.671875px. These same later heights persisted after
the clear. `failed-attempt-geometry.json` records all six attempts, exact trace
hashes, snapshot timestamps and the subsequent clear-action timestamp.

The recovery waits for three matching viewport-geometry samples
before taking the warning baseline. Native frames keep running. It does not
force canvas fitting, change game state to stabilize layout, freeze updates or
add a fixed sleep. The 0.5px equality guard, scene-expansion check, overlap
assertions, ten-second expectation deadline and retry settings remain unchanged.
A diagnostic that deliberately removes reserved warning space must still fail
at the original equality assertion; it is not part of normal fixtures.

Runtime UI, CSS, HTML, renderer, rules, data and paintings remain byte-identical
to the blocked build. Only test readiness, release/cache counters and documentation
change for the v0.9.61 recovery. The 1,005-case local Chromium clearance, 48 native
frames and isolated seven-scene FPS result in the [layout review](../../visual/2026-10-29-combat-layout/README.md)
are reused for that unchanged implementation; they are not new measurements.
Fresh focused combat checks, rule/release gates and committed release checks
are required. Full CI still runs all 1,236 browser cases and the isolated budget;
no group or assertion is skipped to publish.

All nine v0.9.60 CI ZIPs are retained at `/workspace/aaa4-v60-artifacts/` with
GitHub digests. Three final failures and three automatic retries are preserved, including all
failed-attempt traces. Two Chromium crashes emitted SIGSEGV before game
navigation and passed on retry. A Safari offline-readiness attempt saw an empty
status after reload and passed on retry; it is retained as a flaky result.
`blocked-ci-summary.json` accounts for all 14 reports and nine verified ZIPs.

Recovery validation is recorded before pushing; successful CI/publication and
exact main/tag/live-commit verification are recorded externally after the push.
AAA4 listening/reference encounters and physical-device/independent regrade
remain open.

Both deliberately collapsed warning-row controls failed at the original height
equality assertion, as required (`negative-control.json`). The normal focused
run passed all 28 cases with zero retries. The first external-control launch
had an unresolved dependency path and ran no tests; it was corrected before
these negative-control results. No bootstrap failure is counted as detection.

To reproduce the six trace measurements from the retained Safari artifact:

```sh
python3 docs/verification/2026-10-29-safari-viewport-readiness/analyze-traces.py /path/to/aaa4-ci-safari-1.zip --output /tmp/safari-measurements.json
```
