# Blood and cold ash material detail — batch AK

Baseline: `0f6b308b40a02f8c5fcdc4e123b693d359714823`, v0.9.63.
Implemented for v0.9.64. The owner requested another procedural-to-painted
surface pass; this extends material detail rather than filling a missing
monster, class, item or regional binding.

## Scope and visual review

Native phone references showed flat red ellipses for blood and nearly uniform
cold-ash patches. Two image-tool cutouts add dark clot and char-grit detail,
matching the existing muted monster paintings. The initial hazy source is
retained as rejected provenance; the selected repair has transparent space
around the materials. Both source prompts/hashes and cell registration live in
`art/creatures/generation-batch-ak.json` and `batch-ak-preview/measurements.json`.
The exporter only crops, uniformly scales and translates the supplied pixels.

The renderer retains its original fill and four satellite splashes. A
half-opacity material layer clips inside the original main ellipse; it does
not add an outer halo, extra puddle, shadow, fire or light. Original projection,
fog range, visibility/landing gates and floor-before-wall ordering remain.
Other blood colours, oil/ice/water, live sheen, glow warnings and subpixel/far
patches retain the native path. This is not a blanket conversion of dynamic
effects; AL–AN remain separate audit candidates in the atlas roadmap.

Both128px files demand-load independently. A circular alpha mask and eight cached shade canvases per
image are prepared on load; no decal raster preparation happens in the frame
loop. Their combined shade storage is1MiB before browser/image overhead.
Loading, failed or invalid-sized images retain the complete original fill.
The catalog/delivery hashes, art review and worker include both files.

## Native evidence

`capture.cjs` uses the shipped Game/Renderer/Assets with updates and rendering
running normally. Run from the repository root:

```sh
DECAL_OUTPUT=after DECAL_ACTIONS=1 node docs/visual/2026-10-30-ground-decals/capture.cjs
```

`before/` contains the old supplied blood/ash comparison at320/390px in Normal
and Calm. `after/` contains the same supplied positions plus actual attacks,
scroll use, fire expiry, cold-ash approach and source hashes. Comparison scenes
clear monsters and supply stain positions/radii/colours and hero safety.
Action scenes supply a passive1HP Orc, safety HP, one oil field and a fire
scroll. An actual attack leaves blood; the earned talent is selected through
its real control; a consumed scroll lights the oil, which expires on the
unchanged game clock into ash. Native forward/turn inputs exercise placement.
These are bounded action fixtures, not generated/unassisted wins or balance,
listening or physical iPhone/Android approval.

The first action capture waited for ash while the earned level-up choice was
open. `diagnostics/paused-boon.json` records the paused clock/overlay; the
capture now completes that choice through the existing control. No fire clock
or game rule changed to produce a successful capture.

## Automated verification and retained failures

`ground-decals.spec.js` covers demand loading, exact changed-pixel containment,
future/offscreen gating, both Normal/Calm modes, untouched other field colours,
unchanged state/dice, stable cached canvases and independent corrupt images.
Both Chromium sizes passed all six focused cases after the fixture correction.
The installed all-art native reload includes both new files and both shade
loaders; both Chromium sizes passed with no retries.

The initial matched-render test compared frames across an asynchronous load
while the automatic renderer continued moving ambient motes. Both attempts
showed changed pixels in every untouched control too. The correction isolates
automatic rendering as well as game updates for that deterministic comparison,
and compares state/dice immediately around each render. It retains exact zero
outside/untouched assertions. Raw failed traces are retained outside the repo
under `/workspace/ground-decals-initial-failure/` and
`/workspace/ground-decals-second-fixture-failure/`, with logs. Native captures
above deliberately keep motion running and do not use this test substitution.

A local four-worker full run was stopped after84 passes, four existing
art/deferred-painting deadline failures and four interrupted cases;915 cases
had not run. Its complete JSON, logs and traces remain outside the repo under
`/workspace/ground-decals-browser-regular*`. A following usual two-worker run
passed all four previously failed checks unchanged, and was stopped after78
passes to include the repository-required returning-player News item. The final
complete-selection run uses two regular workers and serial offline installs;
these interrupted selections are not reported as full passes or CI skips.
The timing cause is not inferred solely from lower-concurrency passes, and no
assertion, deadline or CI worker count was relaxed.

The isolated4×CPU budget adds sixty stain records (the existing combat cap)
beside the painted crowd, retaining every original scene and threshold.
The initial per-frame clip implementation missed at22.8FPS; its trace/log are
retained under `/workspace/ground-decals-perf-initial-failure/` and
`/workspace/ground-decals-perf-initial.log`. The final implementation prepares
the circular mask once at image load and draws the cached result. Its fresh
unchanged budget passed all eight scenes, including34.5FPS for the stain crowd
and2015ms startup. Other scene readings also varied between runs; this is
clearance on this runner, not a universal or isolated causal speedup claim.
The final complete-source local run passed all1,015 Chromium cases (1,007
regular on two workers plus eight serial offline cases), with zero failures,
retries or skips. Final `npm test` passed, including751 rules in74 files.
Required fresh CI and the release publisher remain publication gates; see
`validation.json` for local results and preserved earlier attempts.
No combat rules, saved state or balance settings changed; balance simulation
is not required for this presentation-only pass. Human listening remains
skipped at the owner's request.
