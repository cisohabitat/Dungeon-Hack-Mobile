# Enlarged combat layout

Baseline: v0.9.59, `c14f127be273d01b26649f8375a7e3c3a0890ee5`.
Prepared release: v0.9.60. This is the first AAA4 layout slice; listening and
reference-encounter animation/audio work remain open.

## Problem and resulting behavior

The native 320px Double-text/Calm Heartforged approach showed large condition
chips over most of the view. The view column could be shorter than the combined
HUD, minimum view, live intent and log, so the log extended into the controls.
Quick read/coat used the view's bottom as its anchor and covered a newly visible
intent line. Short landscape could also let a tall minimap extend below the view.

At Larger/Double text in portrait, name/class and Drink share one row, with
floor/gold/compass in their own row. Vital bars share space only when their full
labels fit; larger numbers wrap the bars without shrinking their text. The
hero's name uses its existing ellipsis with full text retained in the DOM and
Hero sheet. Condition buttons retain labels, countdowns, detail links and 44px
targets in one horizontally scrollable row. Keyboard focus scrolls to later
conditions and survives clock updates.

The portrait view can yield height before messages reach controls. On screens
650px high or shorter, a 64px view/excerpt minimum keeps the full condition target
below the keeper header; the normal-size message text remains unchanged. A separate
intent slot reserves one line while the renderer already shows a creature,
keeping the canvas steady between its wind-ups. It clears for unseen/off-screen
foes, during prelude and after play; empty intent text stays normally hidden.
Unchanged hidden attributes are not rewritten. Quick
read/coat, Take and Log now share the log anchor below live intent. Portrait
Take retains its old position inside the view using the intent-height offset;
landscape Take sits beside the log. Left-handed spacing mirrors the quick
button and Log together, including room for Take. Enlarged minimaps remain
square and fit within short views. Original item selection, effects, timings,
combat rules and paintings are unchanged.

Long messages retain the existing faded excerpt and complete Log history. This
slice does not guarantee a whole paragraph inline at Double text. At 320x568
the scene is necessarily small; keeping controls/messages separate is not a
physical-device playability approval or an independent AAA grade.

## Evidence types and scope

`before/` records the original running 320x667 Double-text/Calm approach. Its
measured log reaches roughly 64px into the controls in the final sampled frame.
`native/` retains the first compact candidate before steady warning space.
`release/` records the final running approaches: 320x667, 320x568, 390x844 and
740x360 at Double/Calm, plus 390x844 at Normal text. All 48 frames have no log/control
or quick-action/intent rectangle overlap, and no condition-strip spill below
the view. These captures include the receipt-clearance correction. The existing
short-landscape regression complements the five captured shapes on both
Chromium projects. Selected original PNGs are committed;
`capture-hashes.json` identifies their unchanged bytes. The complete 48-image
archive remains under `/workspace/aaa4-clarity/native-final-receipt/`.

These are generated final floors from a supplied legal entry, with testing HP
and matching keys supplied. Native forward inputs, boss introductions, foes,
conditions and frames keep running. There are no image substitutions, routed
game modules or frozen updates. The pictures have different live combat moments;
they are not matched pixel comparisons, unassisted wins or listening evidence.

`combat-layout.spec.js` supplies threats, conditions and resources to isolate
layout. It drives native frames, focus, history opening/return and condition
clocks across 320x667, 320x568, 390x844 and 740x360, for both hands. A separate Mage
fixture checks complete 9999/9999 HP/SP labels as bars wrap. Two Normal/Double-text
burst cases use an observer created after the application's fitting observer to
inspect the first layout before paint, then verify the full history. These controlled
states are distinct from the running keeper walkthrough. The seven-case spec is included in both Chromium projects and mobile WebKit.

## Diagnostics and release gates

The original broad exploratory run was stopped before completion to add the
missing regression; `focused.log.gz` is not full-suite clearance. Early candidate
failures are retained: a short portrait overlap, landscape map containment, and
the wider Double-text Log label conflicting with Take. The final focused run passed all seven new cases on both Chromium sizes, plus
the two existing short-landscape checks: 16 passes without retries
(`performance/layout-all-sizes.log`). Earlier six-case results in
`layout-final3.log` are intermediate evidence.
A baseline-only server can replay the original HTML/CSS and changed presentation
modules with unchanged game rules to confirm the new overlap regression detects the old layout.

Run `npm test`, both full Chromium projects, the serial offline checks, the
isolated unchanged seven-scene FPS budget, and fresh committed release checks.
CI still requires all ten groups and successful publication. Record any retries
as flaky; never change deadlines, assertions or budgets to obtain a release.
The phase's validation record is completed before pushing. Rule, data and generation modules byte-match the baseline. JavaScript changes
are `ui.js` presentation, full glyph-height warning clearance in `renderer.js`,
the returning-player News entry in `titlemenu.js`, and release metadata. The recorded balance review is reused; this presentation change is not a new balance estimate.

## Reproduce captures

From the repository root with existing dependencies and system Chromium:

```sh
CLARITY_OUT=/tmp/combat-layout node docs/visual/2026-10-29-combat-layout/capture.cjs
```

Set `CLARITY_CASE=320x568` to inspect one shape. `CHROMIUM_PATH` can override the
system browser. For the baseline regression diagnostic, use a temporary
Playwright configuration pointing its baseURL/webServer to the diagnostic origin:

```sh
CLARITY_ORIGINAL=c14f127be273d01b26649f8375a7e3c3a0890ee5 node docs/visual/2026-10-29-combat-layout/baseline-server.cjs 4195
```

Run only the right-handed combat-layout case on that origin. Its failure is an
expected negative control, not a passing product check. No source routing from
this diagnostic server belongs in the published game or normal test fixture.

## Retained performance investigation

The first canonical local budget failed reading at 28.7FPS; after steady intent
space it still failed at 28.8. Both failures keep the original 30FPS gate, all
seven scenes, 4xCPU and zero retries. Neither source was published. Raw logs and
the first failed report are retained in `performance/`; complete traces remain
in `/workspace/Dungeon-Hack-Mobile/test-results/`.

Paired profiled runs also missed: original layout reading 24.3FPS, initial
candidate 29.3. Their native scene heights differed (304/324 buffer rows) with
live wind-up timing. These observations do not establish a new-layout regression,
a universal improvement or a single cause. Profiles showed floor rendering and
log-fitting layout work, with no pending fallback painting. The initial staged
layout patch is archived losslessly with hashes for historical reproduction.

Layout/paint/style containment preserved 180 controlled log fixtures but its
synchronous median timing was effectively unchanged (0.680/0.675ms). It was
rejected. The selected scheduling change observes a new last line, then fits
recent messages after layout and before paint. It retains the fitting algorithm,
classes, text size and full history, with no added frame delay or new loop that
resizes the observed target. Final native/FPS/full-suite results are recorded in
`validation.json`; diagnostic gains never replace the canonical
budget or CI gates.

The observer-based fitting source cleared the unchanged canonical budget:
fight 37.0, wide 35.3, flooded 43.1, painted 40.2, amber 40.4, reading 38.4 and
rite 43.1FPS; startup 2382ms. After the final short-only spacing correction, a
fresh canonical run also passed. The final source (including full glyph-height
warning clearance, the short-landscape correction and News update) passed at
39.0/39.0/43.4/46.5/43.3/36.2/43.6 FPS, startup 2250ms. The difference between these samples illustrates variability;
neither erases the earlier misses or proves a universal speedup. The full
browser and CI gates still apply.

The first full browser attempt found a real short-landscape regression: the
view was 291.64px high against the existing 300px minimum. Its report, log and
failure image are retained under `performance/first-full*`. The implementation
was corrected while preserving the existing view-height and three-message-row
assertions. Interrupted tests from that diagnostic run are not passing results.

The second full attempt was interrupted by an environment restart after 466
passes and no recorded failures. Its resumed run exposed an omitted MISS receipt
on the smallest phone (234 passes, one failure, two interrupted). The receipt
path used 80% of the label height while the final safety check used its full
height, so a clamped ascent chose an invalid path and the label was omitted.
The renderer now uses the full height for both checks. Original three-label
assertions remain unchanged; reports and failure images are retained as
`performance/second-full*`. A fresh full run supersedes these diagnostic runs.

A three-worker full run was stopped after 53 passes, two failures and three
interrupted tests: six background sprites remained at the existing 25-second
deadline, and a timed leaning counter was zero. These reports and images are
retained under `performance/third-full*`. Concurrency was restored to the
repository standard of two workers for the final full run; no timeout, geometry
assertion, frame-rate budget or retry setting was relaxed. This change in
concurrency does not establish a single cause for either diagnostic failure.

The final standard-concurrency run was interrupted by another environment
restart after 541 passes and no recorded failures. The remaining 458 cases
resumed from the exact completed-test list with the same source hashes, followed
by six serial offline cases. The original partial log and explicit lists are
retained; no complete JSON report is claimed for the interrupted process.

Final local clearance: all 1,005 Chromium cases passed (541 preserved regular
results + 458 resumed regular cases + six serial offline cases), zero retries
in those runs; all 751 rule checks and the unchanged seven-scene FPS budget
passed. The focused combat/receipt run passed 28 cases. Source hashes, exact
coverage lists, raw logs and reports are recorded in `validation.json` and
its referenced files. Earlier diagnostic failures remain retained above.
Committed release checks, the pre-push gate and all required CI jobs/publication
remain required before reporting the pushed release verified.
