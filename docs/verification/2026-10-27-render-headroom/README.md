# Rendering headroom review — v0.9.50

Baseline: `372a6485aa96b160bff76ac40ce9a8a7aa3aa9b9`, whose renderer is the
published v0.9.49 implementation. The preceding fixture-only phase passed all
required CI checks and publication in run40515439249 without changing the game
version. This phase prepares v0.9.50/build65/cache125. No paintings, game rules,
controls, collision, visibility distance, seeded outcomes or tick timing change.
No balance simulation is required for this drawing-only change.

## Selected implementation

The hero's own floor light is constant across a projected row. Calculate its
shade and floor/ceiling warmth steps once per row, then reuse those steps only
where torch light has not increased the glow. Torch interpolation, dither,
foot shadows, cave roofs, fog, texture sampling and all other per-pixel warmth
rounding retain the original calculations. No extra persistent cache or separate
unlit kernel ships. This is a small arithmetic reduction, not a universal FPS
or physical-device performance claim.

The initial interval-cache design below showed attractive frozen diagnostic
timings but failed the native budget. It was removed from the release candidate.
Full raw measurements, source variants and failures are retained rather than
selecting only favorable results.

## Isolated unchanged native budget

All runs used the original perf.spec.js, one worker and4×CPU throttle, with no
other browser/rules load. Thresholds remain30 FPS (wide27), start6000ms. No
assertion, retry setting or CI gate was relaxed.

| Source/run | Fight | Wide | Flooded | Painted | Rite | Start ms | Result |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Original, initial main checkout | 35 | 34.7 | 36.2 | 31 | 46.6 | 2261 | Pass |
| Interval, initial | 33.1 | 33.9 | 33.7 | 28.9 | 38.4 | 2583 | Fail |
| Original, fresh sequential main checkout | 33.7 | 37.9 | 31.7 | 30.2 | 37.3 | 2361 | Pass |
| Interval, following run | 29.4 | 30.4 | 28.1 | 28.1 | 46.8 | 2096 | Fail |
| Interval with early shade rejection | 30.2 | 33.9 | 32.7 | 28.8 | 43.6 | 2345 | Fail |
| Selected row constants | 39.8 | 34.3 | 35.2 | 28.7 | 43.7 | 2251 | Fail |
| Original renderer in candidate checkout | 29.2 | 33.6 | 33.4 | 28.6 | 43.9 | 2137 | Fail |

The last control replaced only renderer.js with the exact baseline source in
the candidate checkout. Its painted result28.6 FPS/script21.7ms matches the
selected candidate28.7/script21.9ms closely. This limits attribution: local
runs do not demonstrate a reliable whole-game FPS gain, and the selected source
did not pass the local crowd threshold. That failure remains explicit even if
CI passes on its separate runner. Required CI performance and all other checks
remain publication gates. The raw budgets and failure screenshots/traces are
retained alongside this report; large original trace ZIPs are archived outside
Git under `/workspace/headroom-budget-failure-artifacts/`, with hashes/paths in
each failure directory. Logs, screenshots and error contexts are committed.

## Rejected interval-cache experiment

CPU profiles identified floor/ceiling casting as the largest named JavaScript
cost. In the four-second fight sample, sampled self time was735ms, with another
136ms in warmth lookup. The painted profile also included deferred painting;
it is not steady-state FPS evidence. The profiled diagnostic missed painted at
23.6 FPS with profiler overhead. Eleven raw profiles are in `profiles/`.

A bilinear sample stays within its four corners. The experiment reused output
only if the entire bounded interval, including dither and a1e-9 margin, had the
same shade, warm/raw decision and both32-step warmth values. Bounds were local
per row/cell/frame. A separate unlit loop avoided that bookkeeping without light.
Its exact source is `measurements/interval-full.js`; the early-rejection variant
is `measurements/interval-early-reject.js`. Neither source ships.

`measurements/fastpath.json` recorded zero changed RGBA pixels in2,340 complete
views:13regions ×3buffer heights ×5floor variants ×3angles ×4Calm/flicker times.
Actual native Assets/materials were shared; geometry/time were supplied, updates
frozen and presentation-only particle randomness reset equally. Dice were not
changed. These are fitting views, not native gameplay or physical iOS evidence.

Short4×CPU timing batches were noisy: identical-source control differed up to
8.8%. Longer100-render batches, ten alternating rounds at1×CPU, reduced control
median variation to2.8%. The interval experiment's longer medians were:

| Frozen scene | Original ms | Interval ms | Change |
| --- | ---: | ---: | ---: |
| Lit ordinary | 2.892 | 2.571 | 11.1% less time |
| Unlit ordinary | 2.137 | 2.220 | 3.9% more time |
| Flooded | 2.818 | 2.630 | 6.7% less time |
| Dark | 1.828 | 1.862 | 1.9% more time |
| Overgrown | 2.980 | 2.730 | 8.4% less time |

These readback-canvas diagnostic gains did not justify publishing it after
native budget failures. Compact byte warmth tables, a simple row cache and a
zero-light-cell shortcut were also explored; all measurements and available
patches remain in `measurements/`. Early exploratory files do not all have source
hashes. Complete final-source comparisons do record hashes.

Historical interval-source captures are in `interval-native/` (18sessions,
90actions,1,080frames) and `interval-offline/` (four fresh-install sessions,
20actions,240frames). They are not final-source verification.

## Reproduction and native scope

```sh
node docs/verification/2026-10-27-render-headroom/compare.cjs
RENDER_CONTROL=1 RENDER_OUTPUT=/tmp/control.json node docs/verification/2026-10-27-render-headroom/compare.cjs
RENDER_TIMING_ONLY=1 RENDER_RATE=1 RENDER_BATCH=100 RENDER_ROUNDS=10 RENDER_OUTPUT=/tmp/timing.json node docs/verification/2026-10-27-render-headroom/compare.cjs
LIGHTING_REGIONS=0 LIGHTING_OUTPUT=docs/verification/2026-10-27-render-headroom/native node docs/verification/2026-10-27-render-headroom/native.cjs
LIGHTING_OFFLINE=1 LIGHTING_OUTPUT=docs/verification/2026-10-27-render-headroom/offline node docs/verification/2026-10-27-render-headroom/native.cjs
```

RENDER_BASE selects the immutable baseline; its default is the fixture commit
above. Timing-only runs do not count as new pixel comparisons. Both renderer
modules use real Assets and reviewed image bytes through one diagnostic server.

native.cjs is the existing movement/lighting harness with one selected PNG per
action. It supplies nearby terrain/torch, level10 Mage resources and a stationary
target, then uses native movement, casts, updates and rendering. Fire/ice lifetime
is shortened after creation to observe native expiry; fire spread/damage is then
suppressed. These scope details are recorded in each manifest. It substitutes no
image, renderer, native update or game clock. Fresh-install disconnected reloads
are separate from prior-version upgrade proof. Linux Chromium/WebKit do not
establish physical iOS Safari coverage. Captures run before native performance
and browser/rules workers to avoid CPU contention.

## Final-source verification

The selected row-constant source matches the original RGBA pixels in all2,340
views, with zero changed pixels (`measurements/final-row.json`). Its recorded
SHA256 matches the release candidate. Frozen timing medians are small/noisy;
they are distinct from native FPS. Further required checks follow below.

Final longer diagnostic batches (100renders, ten alternating rounds,1×CPU)
measured these median ms: ordinary2.754→2.655 (3.6% less), unlit1.951→1.957
(0.3% more), flooded2.927→2.921 (0.2% less), dark1.589→1.505 (5.3% less),
overgrown2.964→2.997 (1.1% more). All samples and source hashes are retained
in `measurements/final-row-long.json`. Small changes near identical-source
control variance do not support broad speedup claims.

Final-source native captures passed18sessions at320/390/740px (six scene
kinds,90movement actions,1,080frames), with no console errors. Final-source
offline captures passed four fresh-install/disconnected reload sessions at
320/390px (20movement actions,240frames). Exact source hashes are in each
capture directory; manifests retain the supplied-state scope above.

`npm test` passed all release-tooling, generated-guidance, art, types, generator,
API/security, narration, offline and voice checks, plus751rule checks in74files
(1m40s rule phase;206.2s overall). Full browser projects are checked separately.

Both full Chromium projects passed937regular cases in4148.4s, followed by
six serial full-cache offline cases in173.5s:943total, no failures/retries.
The two named staff overlaps passed on both projects (17.0/15.9s phone,
15.2/14.3s small), retaining their unchanged drive/restoration windows.

At commit creation, fresh committed release-identity checks, the exact-commit
pre-push hook, all seven required CI jobs/publisher and public delivery checks
remain pending publication gates. Their authoritative results attach to the
published commit; no status-only follow-up commit is needed.
