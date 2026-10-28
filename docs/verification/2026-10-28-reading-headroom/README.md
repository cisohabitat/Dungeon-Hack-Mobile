# Reading-scene performance headroom

Baseline: v0.9.52, `3fe0efd14e6eefed94ce65377a27271d357bed4b`.
This phase changes picture preparation and DOM measurement only. Spell/read
colours, draw commands, durations, damage, visibility, input and seeded dice
remain unchanged. No new painting or balance simulation is needed.

## Findings and change

The original native reading profile still had procedural close-up painting in
progress: `makeSprite`, `paintParts` and related raster work ran during its
four-second sample; `Assets.painting()` was1 at the end. The profiler also found
layout measurements in log fitting and tip protection. Raw profiles remain
outside Git; the committed summaries retain sampled self time, and all budget
logs are retained. Profiling adds overhead and is separate from ordinary FPS.

A requested, bound creature atlas now gets at most500ms to decode before the
renderer requests its expensive procedural close-up. Its ordinary native
fallback remains immediately visible. A slow request resumes the original
refinement after that bound; failure resumes it immediately. Explicit
procedural forms and unbound pictures retain the original path. Ready paintings
are unchanged. This intentionally delays only placeholder refinement during
that short loading window; it never delays a creature, spell or player action.
The candidate profile ended with no fallback jobs queued and no sampled
`makeSprite`/`paintParts` work in the reading window.

Log fitting measures all candidate lines before dropping the old prefix. The
flex-end stack keeps retained lines at the same bottom. `layout.cjs` compares
both source functions on the same real DOM/CSS:180 cases across320/390/740px,
five text sizes, quiet/ordinary logs and empty/short/wrapped/oversized messages.
All retained HTML, classes and line rectangles match. Read-after-removal
opportunities fell from212 to0. Those are instrumentation counts, not measured
browser Layout events. Empty tip/status-chip frames also avoid reading view
geometry; visible chips still reserve warning space.

## Measurements and limits

All native budgets keep every original scene, threshold, sample and deadline:
4x CPU,30 FPS (wide27), start6000ms, one isolated worker, no retries.

| Run | Reading FPS | Script ms/frame | Result |
| --- | ---: | ---: | --- |
| Original, profiled | 27.5 | 22.3 | Failed |
| UI batching only | 28.4 | 20.7 | Failed |
| Combined candidate, native | 42.3 | 8.9 | Passed all seven scenes |
| Exact published three-file control, following candidate | 27.3 | 19.0 | Failed |
| Combined candidate, profiled | 31.7 | 15.9 | Passed all seven scenes |
| Prepared candidate via documented command | 29.7 | 16.5 | Failed reading |

The control serves baseline `ui.js`, `renderer.js` and `paintedcreatures.js`
under their normal URLs; other inputs are the same. Candidate budgets use the
native current source. The original/candidate profiled scene heights were304/
324: battle/log state evolves during real play, so these are observations, not
a pixel-matched speed ratio or a universal device gain. Frozen DOM equivalence
and loading/failure controls provide separate correctness evidence. The prepared repeat misses the local reading gate: work reduction is
demonstrated, but reliable minimum FPS on this host is not. The unchanged
required CI budget remains a hard publication gate on its separate runner.

```sh
node docs/verification/2026-10-28-reading-headroom/layout.cjs
LAYOUT_CONTROL=1 LAYOUT_OUTPUT=/tmp/log-control.json node docs/verification/2026-10-28-reading-headroom/layout.cjs
READING_OUTPUT=/tmp/read-budget node docs/verification/2026-10-28-reading-headroom/budget.cjs
READING_BASE=3fe0efd14e6eefed94ce65377a27271d357bed4b READING_OUTPUT=/tmp/read-control node docs/verification/2026-10-28-reading-headroom/budget.cjs
READING_PROFILE=1 READING_OUTPUT=/tmp/read-profile node docs/verification/2026-10-28-reading-headroom/budget.cjs
```

Twelve focused checks passed at both phone sizes, including bounded grace,
immediate failed/procedural refinement, empty/occupied warning space and native
log wrapping/quiet restoration. Six existing checks also passed: point-blank
Lich quality and every delayed/corrupt fallback pose. Native captures record42 real reads and84 writing/burning frames at320/390/740px
in normal/Calm view, with supplied inventory, unknown status and safety and
cleared enemies; updates, actions and rendering run natively. These are not
physical Safari, upgrade or balance evidence.

`npm test` passed, including751 rules in74 files (rule phase1m21s). Both full
Chromium projects passed953 ordinary cases (two workers,61.6m) and six serial
installation cases (one worker,2.7m):959 distinct cases, zero skips, retries or
unexpected results. Exact stats are in `validation.json`; full raw reports
remain at `/workspace/reading-headroom-full-{ordinary,offline}.{json,log}`.

Committed release-stamp checks and required CI/publication follow. Successful
statuses on the final commit are authoritative; the latest local FPS miss stays
explicit alongside them.
