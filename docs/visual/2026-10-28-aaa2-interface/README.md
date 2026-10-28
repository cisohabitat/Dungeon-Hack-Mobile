# AAA2: equipment stand and interface cohesion

Baseline: v0.9.54, main `9f886e83fb201111602ad36599e2c70b386657ed`.
Prepared release: v0.9.55, build70, cache `deepdelve-v130`.

## Presentation change

A faceless charcoal-wood mannequin with aged brass joints replaces the Pack's
visible line-drawn stand. It is an inanimate display shared by all classes,
not a living hero or a depiction of equipped armour. The generator's source,
pose reference and exact prompt are in `art/ui/aaa2-equipment/generation.json`.
`export.py --check` reproduces its lossless720x600 WebP through alpha-bounds
cropping and uniform scaling only, registered into the existing360x300 SVG.
No hand-painted source is warped or recoloured; earlier paintings are unchanged.

The image's href is set on first Pack rendering. Its own load event hides only
the original body/detail paint. Until then, and on independent image failure,
the original SVG remains visible. Existing region paths, active fills/strokes,
slot connectors, labels, buttons and equipment logic remain intact. Double text
continues to use the equipment list with the decorative figure hidden. The new
image is in the worker's offline inventory and the reviewed art hash list.

Shared panel/background/muted-text/pressed-state tokens use warm iron,
parchment and brass tones across title, creation, Pack, Hero and Journal; generic
lesson/path panels use those same tokens. Semantic rarity, curse, danger,
selection and mastery colours remain distinct. Icon meanings, type sizes,
control geometry and44px targets are preserved. The narrow enlarged-text item
header stacks its portrait above its title to avoid splitting a word into the
remaining sliver beside an image. Zoom, description scrolling and the separate
item-action footer remain available.

The first full local run caught a dialog-focus regression: the decorative SVG
image's href matched the former generic link selector. Overlay and controller
selectors now select actual `a[href]` links; the stand cannot receive initial
focus or enter the controller stops. That interrupted run is retained as a
failed diagnostic attempt, not counted as full verification. Focus regressions
and the entire final suite are rerun with the correction.

No game rules, seeded rolls, equipment restrictions, capacity, inventory data,
prices, combat timing, dungeon geometry or sound change. No balance simulation
is claimed or needed for this presentation-only phase. This is a bounded
interface pass, not an automatic AAA grade or physical-device certification.

## Evidence and controls

- `native-*.png` and the native entry in `evidence.json` use fresh actual UI
  actions and shipped assets/recordings, without inventory, enemy, game-clock,
  image or renderer substitutions. They cover title, creation, Pack, Hero and
  Journal, with five axe scans of those screens.
- Six full-Pack fixtures cover320/390/740px in Normal and Double text/Calm.
  They supply twenty valid long-named relics and their type knowledge; the UI
  and renderer remain native. Automatic New find, the unobstructed Pack, last
  row and selected details are captured separately. Equipment/inventory/gold
  snapshots remain equal through inspection; slot bounds and horizontal
  overflow are checked. These are fitting/interaction fixtures, not played
  loot distributions or balance evidence. The320px Double Pack has an additional
  axe scan. Serious/critical violations must be zero in all six scans.
- `before-*.png` are historical fresh UI captures at `9d37bdc`; the three
  interface source files were unchanged at the v0.9.54 baseline. Hero names and
  rolled numbers differ, so these are visual comparisons, not matched runs.
  `before.json` records that scope. `before-enlarged-item-title.png` retains the
  initial candidate review that exposed the split word before its correction.
- Three new interface regressions verify first-open loading, corrupt-image and
  stalled-image fallbacks, retained slot sizes and selection, and unchanged
  equipment. The six existing standard-class equipment-action cases remain.
  A fourth new case measures the actual DOM range of “Rimebound” at320/390px
  Double text: one line fragment, no clipping, and Close in view. Temporarily
  removing the responsive correction reproduces two word fragments; this
  negative control is distinct from the passing candidate checks.
- The existing serial installed-offline painted-creature case now opens the
  Pack and requires the painting before continuing its original creature
  assertions. Chromium and WebKit retain actual disconnected-origin reloads.
  It remains in the original full-cache serial group, with unchanged deadlines.

Reproduce from the repository root with the existing dependencies:

```sh
python3 art/ui/aaa2-equipment/export.py --check
node docs/visual/2026-10-28-aaa2-interface/capture.cjs
```

`validation.json` records final repository, full Chromium and isolated performance
results before publication. The complete CI matrix and publisher must finish
successfully before the release is reported as verified. Any retries remain
explicit. Physical-device, listening and independent-player checks remain open
in ROADMAP.md; existing native Chromium SIGSEGV and historical WebKit offline
status causes are separate investigations.

### Local performance limits retained

The candidate's first isolated4× budget missed painted crowd27.9FPS and
reading29.7FPS against the unchanged30FPS threshold; startup2528ms passed.
An isolated checkout of the exact published baseline also missed: flooded28.4,
painted27.2, amber29.4, reading23.8 and rite29.5FPS; startup2451ms passed.
All seven scene measurements and both failures are retained. The first attempt
to create that historical checkout left it unpopulated and ran no benchmark;
the corrected checkout produced the reported baseline sample and was removed.
These observational runs do not prove equivalence or a universal improvement.
After the confirmed focus correction, the required fresh final-source sample
also failed: fight28.4, flooded24.9, painted27.0, amber26.3 and reading24.9FPS;
wide32.2 and rite41.3FPS passed their original bars, as did startup2380ms.
This third sample is retained separately; no passing sample was selected to
replace any miss. The focus change affects overlay/controller targets and is
not presented as a renderer optimisation.
The candidate does not have local FPS clearance; the unchanged required CI
performance gate must pass before verified publication. No scene, threshold,
sample length, test deadline or retry policy is changed.
