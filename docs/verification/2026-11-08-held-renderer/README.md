# Held renderer extraction

The owner requested a code refactor before further staging. Baseline is published
v0.9.76/main `3e822369e3923c2a0254f69eaab6245a956aeb46`.

## Change and boundaries

Move the held-item presentation block into `makeHeldRenderer(K)` in
`js/heldrenderer.js`. `renderer.js` falls from 2,033 to 1,753 lines; the new module
has 297 lines. Existing weapon poses, fitting, timings, bow strings, glints, hand
boxes, lantern settling and draw order retain their original formulas. The
renderer still owns world drawing, canvas sizing, ordinary amber-lantern painting
and the shared effects. `heldview.js` retains fitting and melee paths.

Only width and easing are read at construction. Canvas, height and Calm are live
inputs; spell helpers and durations bind later. `put` remains the shared callback
for scroll and drink placement. Each held renderer keeps independent hand boxes
and lantern memory. The new module joins the versioned offline snapshot.

No gameplay rules, AI, balance, save schema, assets or public renderer API change.
The release metadata prepares v0.9.77/build 92/cache 152. This does not add an art
batch, complete AAA3, clear engine reliability or provide physical-device review.

## Exact comparisons

`compare.cjs` loads the baseline renderer through one explicit source route and
the current renderer normally, sharing unchanged current dependencies and art.
It compares 1,698 full frames and hand-box arrays across three render heights
(160/304/464), Normal and Calm, fifteen gear sets, seventeen action snapshots and
four extra actions for each of seven classes. All frame bytes and hand bounds
match. All 186 selected held/carried picture URLs load; game state and both
gameplay random streams remain unchanged. `comparison.json.gz` retains each row
and the source hashes.

This is a controlled supplied-action comparison on one generated floor with no
actors, not an untouched historical deployment or unassisted gameplay. Each
renderer receives an identical seeded presentation-only dust stream during its
synchronous draw; `Math.random` is immediately restored. Normal dust originally
initialized independently, causing a 60-byte first-frame difference with equal
hand boxes. The initial failed comparison log is retained; no production random
source or dust behavior changes.

The added `held-equipment.spec.js` case checks late helper wiring, independent
instances, replaced canvas, changed height, live Calm switching, shared read/use
callbacks and clearing a missing view. It passed on both Chromium sizes. Its
first fixture used fitted gear whose clamped coordinates hid the expected bob;
the corrected fixture observes an unfitted bare hand instead. Both initial
failures are retained rather than labelled runtime regressions.

Reproduce with existing dependencies and system Chromium:

```sh
CHROMIUM_PATH=/usr/bin/chromium node docs/verification/2026-11-08-held-renderer/compare.cjs
```

## Publication gates

An environment reconnection terminated the original regular-suite runner after
529 reported passes. Its final aggregate JSON was not produced; its original
1,039-case inventory, completed-case events and raw log are retained instead.
The remaining 510 uncompleted cases were selected with Playwright's test list
after verifying their IDs exactly complement those 529 passes. Validation must
prove the combined completed IDs cover the original inventory without overlap,
then include the ten serial offline cases. The source hashes remain fixed and
the already-passed isolated FPS run is retained without a rerun.

Local verification covers 1,049 unique completed Chromium cases: 667 phone and
382 small-phone, including ten serial offline cases. The retained and resumed
IDs cover the original inventory exactly, without completed-case overlap, skips,
reported test failures or automatic retries. The interrupted original runner is
explicitly recorded as interrupted, not successful. All prepared source hashes
still match. Typechecking and the original isolated nine-scene frame budget pass;
wet surfaces measure 30.9 FPS and startup is 2,106ms, with unchanged thresholds.

Exact-commit `npm test`, all original CI shards and the publisher remain required.
Completed local evidence is recorded in `validation.json`; later CI and production records
are kept separately to avoid changing a verified commit merely to record it.
Retain any FPS misses, automatic retries and failed-attempt traces. No unchanged
performance rerun or reduced threshold clears a miss. Browser-engine investigation
remains deferred; human listening remains skipped at the owner's request.
