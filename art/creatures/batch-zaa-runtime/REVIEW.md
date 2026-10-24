# Z/AA native weapon activation — release0.9.35

59 reviewed source frames now bind in normal play: Cleric mace9, Thief
shortsword9, Ranger shortbow3, Druid spear2, Thief dagger9, Fighter battleaxe9,
Cleric hammer9 and Fighter greatsword9. They extend16 existing T frames to75
held frames, and187 prior common delivery files to246. All59 shipped PNGs are
byte-identical to the selected reviewed exports; total shipped paintings414,
plus3 app icons. Source findings remain in the separate
[Z review](../batch-z-preview/REVIEW.md) and [AA review](../batch-aa-preview/REVIEW.md).
The wider AA library remains open; this activates only its approved first tranche.

## Bindings

The common exporter carries exact raw id, class, pose, hand count and authored
grips/object bounds/nocks into paintedcatalog.js. The existing family loader
lazily requests a complete weapon family on its first supported use and switches
only after every frame is ready. An unfinished or failed pose keeps its entire
family procedural; other weapons remain independent. Unsupported classes, named
identities, lit/reflected frames, poses and hand counts retain their original art.
No named-prefix stripping or invented actions. All59 files enter the offline cache.

Druid spear remains one-handed rest/drive, without a new staff channel. Ranger
shortbow keeps Fighter glove colours and live string, arrow and drawing hand.
Its authored nocks feed the existing fitted string and .72 arrow release; the
painting does not add a second string or arrow. Greatsword paintings require
both hands. Read/drink/cast free its lower hand, so the native one-handed frame
remains procedural during these actions and painting resumes afterwards. No
new state, damage, dice, combat timing, lights or class powers.

## Native evidence

`node art/creatures/preview-batch-zaa-runtime.cjs` starts each of the eight pairs
through actual class creation, supplies legal equipment/resources, clears scenery
and places a durable adjacent Orc. The game API equips the weapon and starts real
attacks, mapping-scroll use and healing drinks; both Cleric pairs also cast Cure
Light Wounds. Native Game.update and Renderer.render remain unchanged, without
asset routes or renderer proxies. A passive drawImage observer forwards every
native call unchanged and records which native painted frames actually drew.
Observed timestamps are kept, without slowing animations to atlas boundaries.
Setup is a controlled presentation fixture, not a complete unassisted run.

Each pair uses the actual Calm menu control, saves and reloads offline, then
continues its saved native class/equipment. Both390px and320px are covered.
All75 held files are checked in each offline cache. UI screenshots and canvas
action samples are labelled separately; canvas frames omit HUD. Native samples
cover attack progress/recovery, bow release/recoil and released-hand actions;
the earlier frozen source reviews separately cover every pose and buffer height.
No local WebKit or physical-device validation is implied.

[Capture metadata](captures.json) records exact equipment, consumed items,
action clocks, advancing game time, observed frame draws and console errors.
Native galleries are linked in that inventory by their width/class/item filenames.
All236 captures and16 family galleries were visually reviewed and their252
raster hashes registered. All16 contexts cached75 held frames, continued the
correct saved weapon and reported no page/console errors. Native attacks under
load do not expose every brief CUT boundary in each run; source review separately
covers every pose. Early white hit flashes and ordinary hit/miss overlays remain
visible. This pass does not establish exhaustive warning/occlusion coverage.

## Validation

Publication requires both full Chromium projects, native grip/offline/failure
checks, npm test, byte reproduction, art/docs checks and an isolated frame budget.
The exact committed release must pass its pre-push hook and every main CI job,
including Safari and version publication. Results are recorded below as completed;
source-only previews are not counted as runtime delivery checks.

An existing Shade-state test reached its Mage gear assertion before deferred
preparation completed. Its fixture now waits for that exact class pose, as the
other native-world test already does; the binding assertion and budgets remain.
Balance simulations are unnecessary: artwork/catalog/offline entries and test
readiness do not change rules or gameplay outcomes. W's earlier title/share-card
follow-ups and other unpainted held variants remain separate work.

Completed local checks:

- `npm test` passes:751 rule checks across74 files, plus types, release tooling,
  generator, security/telemetry, narration, offline lifecycle and voice catalogue.
  This run used one low-priority rule process alongside browser validation;
  elapsed20m34s is not a benchmark or a claimed speed improvement.
- All246 delivery files reproduce byte-for-byte from reviewed source exports.
  Art checks confirm414 shipped paintings plus3 icons, all cached offline.
  Source Z/AA reproduction, script syntax, current agent guidance, documentation
  links and whitespace checks pass.
- Native16-context evidence passes with236 reviewed captures and16 galleries,
  75 held frames cached per context and no page/console errors. Greatsword middle
  read/drink samples contain no two-hand painting; recovery resumes native paint.
- Both complete Chromium projects ran801 cases:800 direct passes in54.0 minutes.
  One deferred-art queue case exceeded its unchanged25s gate while native capture
  was also running. With all competing workers stopped, that exact case passed
  alone in7.9s (8.9s total). No deadline, assertion, retry count or application
  preparation logic changed. All new weapon/offline/failure cases and the exact
  Shade readiness fixture passed inside both complete projects.
- The isolated4xCPU frame budget passes in57.6s: fight39.7, wide42.2,
  flooded38.4, painted33.5 and rite58.1 FPS; startup2017ms. Thresholds remain
  30FPS, wide27FPS and startup6000ms. This is one Linux Chromium measurement,
  not physical iOS validation or a performance-improvement claim.
- Final commit identity is rechecked in fresh release-test workers after commit;
  exact-commit pre-push checks and every main CI job still govern publication.
