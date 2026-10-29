# AAA3: room hierarchy and forge scenery, first slice

Baseline: v0.9.56/main `7001bbe343a51e045c6100edccbb5b2935d5c946`.
This is the first bounded AAA3 presentation pass. Keeper/guard composition and
selected landmark approaches remain open in ROADMAP.md; it does not complete
all architectural staging or certify an AAA grade.

## Review and chosen changes

`before/evidence.json` records39 views across all13 themes on their own generated
floors: entrances, landmarks and treasure. Ordinary regions, both roads, the
three peoples, drowned halls, old forges and the final sanctum use their actual
run lengths/depths/route choices. Geometry and population are generated normally.
Entrances are native; later inspections supply legal player poses through
save/load. Testing HP provides safety. Updates and shipped artwork remain live.
These are composition samples, not unassisted exploration or balance evidence.

Patterned ceilings competed with room silhouettes and floor-level landmarks in
tall views. The renderer now selects an existing roof shade one step deeper at
floor shades0–5. Shades6/7 retain their original fog boundary; `CEIL.CAVE`
retains its exact old sequence. This also covers root-roof materials in the
Warrens; the unchanged-cave claim refers specifically to `CEIL.CAVE`. The two
fixed eight-byte tables avoid new per-frame painting or persistent image caches.
Floor/wall/actor light, warmth, fog reach, visibility, geometry, warning positions
and source art remain unchanged.

The Old Forges described cold anvils but its ordinary rubble reused gear scrap.
Existing non-fallen decorative rubble now uses the already approved
`img/world/dress_anvil.webp`, at its original rubble scale, offset and position.
Saved kinds, counts, footprints and collision stay unchanged. Grey Hold scrap,
fallen rocks, barrels, oil casks, crates and NPC/encounter art retain their
original mapping. No new prop, texture, artwork, light or room is generated.

Compare the same generated forge inspection pose in
[the original source](forge-before/12-landmark.png) and
[the candidate](matched/12-landmark.png). These are separate native walkthroughs:
clock and population motion can differ, so they are not pixel-matched gameplay.

## Matched and native evidence

- `roof-matrix.json`:2,808 supplied-material views over13themes, three buffer
  heights, six floor/roof conditions, three angles and four Calm/flicker times.
  All lower-view RGBA pixels are identical. The432 views using original cave-roof
  material are entirely identical. The other2,376 views intentionally change
  upper-view roof pixels. This is a renderer comparison, not native play.
- `matched/evidence.json`:39 frozen render-state pairs from generated rooms,
  using shared current decoration mapping and shipped assets. All lower-view
  pixels, visible-actor geometry, game state and both dice streams remain equal.
  These isolate the roof change; both sides share the new forge decoration
  mapping. One paired roof image per theme and all39 native inspection screens
  are committed. Additional original pair PNGs remain in the indexed raw archive.
- `native-320/evidence.json` and `native-740/evidence.json`:12 selected room/keeper
  cases,44 actual turn/walk actions and352 consecutive frames. Native updates,
  controls and shipped assets run at small-phone and landscape sizes. Starting
  poses and testing HP are supplied; safe walking skips occupied, trapped or
  interactive squares. These remain distinct from the frozen comparisons.
- Lich, Warlord and Heartforged are all included. A crowded Heartforged view was
  checked against its actual selected sprite (`heartforged:blink`), with the
  selected painted frame retained under `keeper-identity/`. Nearby enemies can
  obscure its body; no artwork-routing defect was confirmed. Altering guard
  placement is the next AAA3 composition slice and needs balance comparisons.
- `focused.log` and `roof-cave.log`:12 focused cases plus two extended cave-policy
  checks pass across both Chromium projects. Existing regional-prop checks now
  also protect barrels/oil casks/crates and run as `@mobile` for WebKit coverage.
- `negative-control.json`: routing the exact original renderer into the roof
  regression fails its focal-plane assertion (difference0, required greater
  than10). This intentional diagnostic failure is separate from candidate checks.

All source image bytes remain approved originals. `source-scope.json` records
hashes and the corrected external preview-script setup error. The committed
PNGs are unchanged copies; `capture-archive.json` inventories additional original
PNGs retained outside Git, bounding repository size without deleting provenance.
No balance simulation is needed or claimed for these renderer-only changes.

The original isolated seven-scene budget passed on the prepared v0.9.57 code:
fight38.2, wide37.9, flooded35.4, painted36.3, amber33.6, reading39.9 and
rite49.1FPS at4xCPU; startup2209ms. This is a single required-budget sample,
not physical-device performance or a universal speedup claim. See `performance.log`.

The screenshots preceded the metadata bump and show v0.9.56 player metadata;
`source-scope.json` records the renderer/prop hashes shared with the candidate.
Final correctness/performance tests use v0.9.57 metadata.

## Reproduce

Use existing dependencies from the repository root:

```sh
RENDER_RATE=1 RENDER_OUTPUT=/tmp/roof-matrix.json node docs/visual/2026-10-28-aaa3-staging/roof-matrix.cjs
AAA3_KEYS=0,1,2,3,4,5,6,7,8,9,10,11,12 AAA3_OUT=/tmp/staging-roofs node docs/visual/2026-10-28-aaa3-staging/capture.cjs
AAA3_KEYS=0,5,8,12,05-warlord,05-heartforged AAA3_WIDTH=320 AAA3_ACTIONS=1 AAA3_OUT=/tmp/staging-native node docs/visual/2026-10-28-aaa3-staging/capture.cjs
```

Use `AAA3_WIDTH=740` for landscape, or `AAA3_BEFORE=1 AAA3_KEYS=12` for the
original forge-source walkthrough. Before/after module routing is explicit
review machinery; production never substitutes these source modules.

The first full local browser run was interrupted by an environment restart
after129 passing cases, with no recorded test failure or final report. Its
original log is retained outside Git. An orphan test server then caused a
startup-only error before any test ran; it was identified and stopped. The
complete unchanged suite subsequently passed all975 ordinary cases with zero
retries. `validation.json` separates these interruptions from completed checks.

`validation.json` records final local verification:751 rule checks,981 distinct
Chromium cases (975 ordinary plus6 serial offline), zero failures/skips/retries,
and the original isolated seven-scene FPS budget. Full Chromium, the original
isolated seven-scene FPS budget and every required CI job, including publication,
remain release gates. No thresholds, scene lengths, deadlines or retry policies
are weakened. Physical devices, listening, independent player observations and
the historical native Chromium crash/offline-timeout investigations remain open.
