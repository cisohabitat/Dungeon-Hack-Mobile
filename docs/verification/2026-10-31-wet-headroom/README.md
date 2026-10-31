# Wet-surface rendering headroom — 31 October 2026

The goblin fixture publication's CI run hit the unchanged wet-scene speed gate
at 29.6 FPS against 30. All 1,263 browser cases passed on their first attempt,
including the corrected goblin rescue/lock test. The performance job failed
and the publisher was skipped. No unchanged green rerun or reduced workload is
used to clear that failure.

Baseline: `6fd81ea5443caea2729daeed428f290b392eb766`, v0.9.68/build 83.
[Failed run 41161380033](https://github.com/cisohabitat/Dungeon-Hack-Mobile/actions/runs/41161380033)
and its exact performance report remain retained outside this checkout in
`/workspace/goblin-pose-ci-perf.zip`; its SHA-256 is
`42f3ce5a1474c446b0aa6c1b31ac1a1992bb9d7cd14e31fd36b873eb077ba559`.
The manifest and complete 14 reports are recorded in
`/workspace/goblin-pose-artifact-manifest.json` and
`/workspace/goblin-pose-artifact-verification.json`.

## Bounded implementation

The candidate keeps the same pictures, stain geometry, independent overlapping
fills, live light samples, fog boundaries, material opacity, glints, landing and
expiry. It adds no image, cache, raster preparation, light, saved state or rule.

- Constant fog and horizon rows use typed-array fills for exactly their old
  pixel ranges, replacing scalar copies of the same colour.
- A light cell whose four samples are all zero has zero interpolated light.
  Skip only that zero arithmetic. Lit cells retain the original formula and
  each frame still reads the live field; the hero's own light is unchanged.
- Each stain pass tracks its current fill style so consecutive same-shade
  splashes retain separate draws without redundant Canvas colour assignments.
  Water glints update that local style too. Nothing carries across passes.
- Save the pass's incoming alpha once. An image already using that alpha needs
  no redundant setter/restore; other images retain their original opacity and
  restore the incoming value after every draw.

The diagnostic profiler observed 24,955 ellipse fills over its measured wet
sequence, none outside the viewport. Offscreen culling was therefore not
selected. The profile also showed floor casting and image/state work. Its
forwarding draw counters and CPU profiler add overhead; diagnostic FPS is not
release clearance or a causal speedup measurement.

A CPU-readable material-canvas experiment also produced identical compared
pixels but did not clear the local speed gate. It was rejected: the final
material loader remains byte-identical to baseline. No warmed texture cache,
changed alpha mask, merged path, removed splash or static-light workaround is
introduced.

## Pixel and action evidence

`compare.cjs` compares original and candidate renderer modules against the
same approved assets. The baseline material loader is served independently,
so loader experiments cannot silently change both sides. Sixty mixed marks
are retained in 2,340 frozen views: 13 regions, five environment/light setups,
three heights, three camera angles and four Normal/Calm/flicker times.
Every checked view must have zero changed pixels. The capture resets only
presentation particle RNG for matched fitting; it is not native gameplay.
Its one-sample frozen timings are noisy diagnostics and are not FPS evidence.

`capture.cjs` separately records running native oil/sheen, Normal/Calm, real
movement, a consumed oil flask and its landing, real fire-scroll ignition and
burn expiry into ash at both phone widths. It supplies a cleared scene, safety
and a passive target; it does not replace renderer, updates, assets or clocks.
Source hashes in `native/evidence.json` must match the final candidate. These
are controlled actions, not an unassisted run or physical-device approval.

## Ground pixel fixture readiness

The first local focused run passed 23 cases but failed the small-phone
unsupported-field comparison with 90,173 changed pixels. The retained
[pixel-fixture trace](pixel-fixture-failed-trace.zip) and
[extracted dimensions](pixel-fixture-failure.json) show its baseline at 242
buffer rows and later comparison at 282. The quiet log had just shortened on
its real UI clock; freezing `Game.update` did not freeze that clock or the
ResizeObserver-driven canvas fit.

The fixture now waits for the native quiet-log state and three matching
DOM/buffer geometry samples before any pixel baseline. It neither forces
layout nor freezes the UI. An explicit array-size guard reports a future resize
directly. All original zero-changed-pixel, footprint, failure, opacity, allocation
and state/dice assertions remain, with the same case/assertion deadlines.

## Full-suite local scheduling

The initial four-worker run exceeded the existing 25-second background-art
queue deadline at the title. Its trace and report remain in the separate
`/workspace/wet-headroom-full-regular-results/` and
`/workspace/wet-headroom-full-regular.json` outputs. That run was interrupted;
interrupted cases are not product failures. The subsequent run uses the same
two-worker setting as CI, without changing assertions, deadlines, workload or
source. Its result is recorded in `validation.json`. Full-cache offline cases
remain a separate one-worker step, as required by the existing CI policy.

Execution transport interruptions ended the two-worker process after 209, then
317, then 134 passing cases. All passed test IDs were matched against the
original inventory before each resume. The final 355 cases ran detached from
the interactive transport. Their disjoint union is exactly all 1,015 regular
cases (650 phone, 365 small), with no failures or retries. Incremental result
records and the inventory proof remain under `/workspace/wet-headroom-*`; the
serial offline step passed the remaining eight installation cases in 3.0 minutes,
with no retries. All 1,023 local Chromium cases passed.

## Separate browser-engine follow-up

The upstream [Chromium stopped-worker DevTools report](https://github.com/microsoft/playwright/issues/43374)
contains a similar 0x1b0 fault during context teardown. Its [Playwright guard](https://github.com/microsoft/playwright/pull/43384)
was unmerged when checked on 31 October. That report concerns Chromium 149;
this repo's retained fault used Chromium 147/revision 1217. The similar address
is a lead, not exact attribution of our older binary. No browser upgrade,
service-worker blocking, private-library patch or reduced trace coverage is
justified by this fixture/rendering phase; native engine causes remain open.

## Retained measurements and release gates

The original nine speed scenes, 60-mark counts, 4× CPU throttle, 30 FPS default,
27 FPS wide bar, 6-second startup bar and zero-retry speed policy remain.
No benchmark code or CI selector changes in this performance phase.

- The first local state/fog candidate passed wet at 30.9 FPS but missed decals at 29.9 FPS.
  `/workspace/goblin-wet-candidate-perf.log` and copied failure results retain it.
- The additional zero-light fast path passed decals at 30.7 FPS but missed wet at 26.8 FPS.
  `/workspace/goblin-wet-zero-light-perf.log` and its unique results retain it.
- The rejected readable-source experiment passed decals at 30.9 FPS but missed wet
  at 27.6 FPS. `/workspace/goblin-wet-cpu-source-perf.log` and its unique results remain.

Between-run variation is not presented as a causal gain. The final source is
frozen for native actions, focused material/lighting regressions, both full local
Chromium projects and mandatory repository checks. Fresh CI at the unchanged
nine-scene thresholds controls release verification. `validation.json` records
local evidence; final CI records remain outside this immutable snapshot.

This is a presentation-only recovery with zero changed compared pixels. Game
rules and RNG are untouched, so no balance simulation is needed. Native browser
context crashes and WebKit offline errors remain separate open issues. Human
listening review remains skipped at the owner's request.
