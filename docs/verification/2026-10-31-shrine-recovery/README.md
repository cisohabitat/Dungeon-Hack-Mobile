# Shrine staging release recovery

v0.9.73/main `8132d46897805bb449fe732c343cb07415930c99` delivers the
reviewed shrine staging, but [CI run41218018153](https://github.com/cisohabitat/Dungeon-Hack-Mobile/actions/runs/41218018153)
blocked its GitHub release. Wet surfaces measured26.6FPS against30; the other
eight scenes passed. A companion offline check failed both attempts because
it expected a rejected origin request after a fully cached core reload. All
other1,286 browser cases passed, with no flaky successes. The publisher was
skipped and v0.9.73 remains untagged. The actual main deployment is separately
verified: its identity and22 resources match, with the native altar visible.
Nine artifact ZIPs and14 reports were checked by digest, size, run and SHA.
The two companion traces are retained unchanged here; the raw FPS trace/ZIPs
and full reports remain in the workspace. This failed run is not clearance.

## Rendering change

The native workload profile points mainly to floor shading math. Equivalent
finite-value comparisons retain the existing shade/warmth clamping. A live
per-row conservative ray bound avoids redundant coordinate-bound checks only
when the complete row is safely inside the map; an extra tile keeps the proof
away from numeric/map-edge boundaries. Edges and invalid directions use the
original per-sample checks. No pixel, light sample or floor/roof draw is skipped,
and no temporal floor projection/coverage cache is introduced.

Each stain's existing projection cache now retains its pure1-distance/fog
term, invalidated with the same camera, height, radius, seed and fog inputs.
The live light sample is still read each frame. Rounded RGB channels already
computed for the tint key also build the identical rgba string; duplicate
parsing, rounding and alpha formatting are removed. Equivalent explicit corner
bounds replace the light sampler's per-call closure. Paths, separate overlapping
fills, material opacity, glints, live light and alpha/composition remain unchanged.
The prior rejected floor caches, opacity changes and guard layouts stay rejected.

The frozen comparison preserves all2,340 final views against the failed commit:
13 themes, three heights, five environments, three angles and four Calm/flicker
snapshots. The selected pre-cleanup diagnostic improved the five groups by roughly3–19%.
The exact final source preserved every view again: four groups improved6.5–16.7%
and unlit regressed1.5%. Both samples are retained. These readback fitting
timings are not native-play FPS or a universal speed claim. Two earlier candidates had mixed/regressed timings and
remain in `rejected/`; no failed unchanged gate was rerun for a pass.

## Offline proof

Installed core cache reads intentionally need not contact the origin. Three
existing counter-based fixtures now verify a connected404 control, then a
failed APIRequestContext request after the actual origin cutoff. This request
reaches the real fixture server outside its worker. Their original positive
rejection counters, native reloads, portrait/creature decoding, voice resume,
movement and empty-error assertions remain. Chromium still additionally uses
browser offline mode; WebKit keeps its native server cutoff. No retry, timeout,
case, image, navigation or assertion is removed or weakened.

## Verification

Ten focused cases passed across both Chromium sizes. The new bounds fixture
compares48 isolated views per project against its guarded sampling path at
map edges, three heights and live torch times. Its synchronous reference forces
`Number.isFinite` false only during the reference render; native captures keep
all builtins intact. The first extra floor-kind assertion used a nonexistent
property; exact pixel checks were valid. It now compares the actual positive
`Renderer.looks.floors` mask, and both tightened cases passed.
Final native source hashes, full local coverage, the original nine-scene FPS
sample and fresh CI/publication are recorded in `validation.json`. Every
ordinary release gate remains. Human listening stays skipped; physical devices,
unassisted play and a complete AAA grade remain separate.

Typecheck first caught two unused declarations after simplifying stain math.
The initial capture process was stopped; partial files remain in the workspace.
After removing the unused helper/binding, typecheck passed and all36 final
native views and the complete pixel comparison were repeated on clean source.
The native source hashes match. Actual population/updates remain in the captures;
legal inspection poses and safety HP are supplied and labelled. Representative
[320px](native-320/09-treasure.png), [390px](native-390/09-treasure.png),
[landscape](native-740/09-treasure.png) and [Calm](native-calm320/09-treasure.png)
views retain the shrine composition. These are not physical/unassisted reviews.

Reproduce the fitting comparison with existing dependencies/system Chromium:

```sh
RENDER_BASE=8132d46897805bb449fe732c343cb07415930c99 RENDER_RATE=4 RENDER_BATCH=10 RENDER_ROUNDS=8 RENDER_OUTPUT=/tmp/shrine-recovery-comparison.json node docs/verification/2026-10-31-shrine-recovery/compare.cjs
```

Final local verification passed all1,041 distinct Chromium cases:663 phone
and378 small-phone, including10 serial offline cases, with zero failures,
skips or retries. The original core/voice and creature cases keep their new
real-origin proof. The companion case and48-view bounds regression passed on
both widths. Source hashes match all final native views and the fitting matrix.
The original isolated nine-scene sample passed eight scenes but missed wet
surfaces at27FPS against30; decals measured32.3 and the rite57.2, startup1,997ms.
The [failure log](performance-local.log) is retained. This local miss is not
rerun unchanged or presented as FPS clearance. Fresh main CI must pass every
original gate before GitHub publication.
