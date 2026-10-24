# Batch Y native activation — release0.9.34

Fighter ordinary shield, Cleric ordinary shield and Thief buckler now use the
approved paintings in normal play. Three shipped PNGs are byte-identical to the
reviewed source exports. The shared delivery inventory covers187 files, including
184 E–T exports and these three additions. W/X audit and Y source-review evidence
accompanies this publication; previous source-only reports retain their scope.

## Bindings and delivery

`paintedcatalog.js` carries exact id/class metadata for all five carried frames:
two existing Rune shields plus three ordinary shield pairs. `paintedworld.js`
builds a lookup once and lazy-loads each frame only on demand. Unavailable,
incomplete or corrupt images retain that pair's procedural fallback. Other
classes, named shields, foci and the Wayfarer lantern keep their own bindings.
No named-prefix stripping, new gameplay state, dice, timing, light or action.

Reproduce all bytes and authored grips/bounds with
`python3 tools/export-painted-runtime.py --check`; reproduce Y's original source
exports with `python3 art/creatures/export-batch-y.py --check`.
Three new offline entries ship with the release cache. Source spacing exceptions,
class palettes and rear-view anatomy remain documented in the
[source review](../batch-y-preview/REVIEW.md).

## Native evidence

`node art/creatures/preview-batch-y-runtime.cjs` uses native loaders and the real
update/render loop. No asset routes, renderer proxy or frozen updates. Each class
starts through the actual creation UI, equips a legal shield via the game API,
uses a mapping scroll and healing drink, and toggles Calm through Menu. Fighter
uses actual shield Bash on a durable adjacent Orc; Cleric casts Cure Light Wounds.
Natural animation frames capture action progression and recovery. Setup supplies
resources/equipment, clears scenery and positions the Bash target; these are
controlled presentation checks, not complete unassisted dungeon runs.

Each class saves, reloads with the browser offline and continues the native run.
All three new shield files are cached in each context; the continued shield uses
its256px painted frame. Both390px and320px are covered without page/console errors.
See [capture metadata](captures.json), [390 gallery](390-overview.png) and
[320 gallery](320-overview.png). Native UI screenshots and canvas action samples
are labelled separately; canvas samples omit surrounding HUD. Observed timestamps
are retained rather than stretching action durations to atlas boundaries.

## Validation

- `npm test`:751 rule checks across74 files plus types, generator, security,
  release tooling, offline lifecycle, narration and art/documentation checks pass.
- Both complete Chromium projects ran797 cases:796 direct passes (47.3 minutes).
  One existing endgame fixture tried to open the Pack beneath the keeper intro;
  it now finishes the native introduction first, retaining all Heart/Pack assertions.
  The corrected case passes alone (6.9s). No application fix or relaxed assertion.
- Ten focused native-world cases passed before the full run. The finalized exact
  pair/offline and corrupt-shield cases also pass inside both complete projects.
  The new offline test cuts its actual origin connection; Chromium additionally
  uses browser offline mode, while Safari keeps native controlled navigation.
- Isolated4xCPU frame budget passes (57.9s): fight40.8, wide42.0, flooded39.9,
  painted35.2 and rite53.1 FPS; startup1601ms. Existing thresholds unchanged
  (30FPS, wide27FPS, startup6000ms). This is one Linux Chromium measurement,
  not a physical-device benchmark or claimed performance improvement.
- All187 delivery files match reviewed source bytes; all355 shipped paintings
  and3 app icons have current hashes and offline entries. Export reproduction,
  preview syntax, documentation currency and whitespace checks pass.
- The exact committed release must pass the pre-push checks and main CI,
  including Safari and version publication. Inspect the
  [main workflow](https://github.com/cisohabitat/Dungeon-Hack-Mobile/actions)
  for committed-run status; local WebKit/physical iOS results are not claimed.
No balance simulation is needed because artwork/loading and test readiness do
not change rules, timing, controls, target visibility or outcomes.

The previous main Safari failure came from the native-world test reading class
Shade gear before its deferred preparation completed. It now waits for the exact
class pose readiness before asserting the unchanged bindings. No assertion,
retry count, overall test budget or CI job is removed. The offline regression
also cuts its actual origin connection for Safari, matching the existing native
offline suite rather than relying on unsupported navigation emulation. Local WebKit remains unavailable;
the release requires the existing Safari CI job.

W's double-text title-fact overlap and share-card keeper/outcome follow-ups remain
open. This release activates shield art and publishes their audits; it does not
claim to fix those separate presentation issues.
