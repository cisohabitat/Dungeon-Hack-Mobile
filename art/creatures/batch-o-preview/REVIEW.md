# Batch O baseline surface review — 24 October 2026

The baseline material pass is complete: thirteen themes × wall/floor/
ceiling =39 opaque native 64px texture tiles, plus detail 256px and 3×3 repeat panels.
These are material strips, not creature atlases. Architecture/secondary surface
variants remain procedural; see [format/architecture audit](FORMAT-AUDIT.md).
This publication contains source/review assets; runtime integration remains pending.

Generated with image_gen.imagegen (model not disclosed). The
[manifest](../generation-batch-o.json) records exact prompts, active procedural
references, generated paths, native dimensions, crop rectangles and selected
sources. Thirteen source strips and one full-strip marsh repeat repair are
preserved. Export scripts only crop, resample and assemble review panels;
there is no scripted painting, recolouring, seam blend or texture synthesis.

## Regional identities

- Grey/blue halls keep muted masonry and solid flagstones.
- Brown/crimson crypts keep warm stone and two long incised ledger slabs.
- Mossy Depths uses green damp stone with restrained moss.
- Obsidian Sanctum uses dark purple slabs and nested inlay; Dark Elf Halls uses
  purple-grey ashlar and diamond marks, without luminous runes or new openings.
- Ossuary wall has empty-eyed skull/bone niches, distinct from loose remains.
- Warrens uses timber-backed earth and trodden dirt, not regular brick.
- Grey Hold has granite, iron bands/rivets and restrained chevrons.
- Sunless Marsh has olive wattle/daub and matte mud, not water.
- Drowned Halls has old blue-grey damp masonry and solid silt-edged flags.
- Old Forges has cold soot-dark stone/iron, without painted fire or glowing lava.

All source/selected strips, active reference overview, native/detail contact,
repeat panels and both phone galleries were visually reviewed. Selected full-size
views check plain masonry, ossuary, granite/iron, obsidian and the repaired marsh
floor. Detail is deliberately reduced at64px to match the engine's texel density.
[Contact sheet](contact-sheet.png), [repeat overview](repeat-overview.png), and
[active references](reference-overview.png) show the complete sets.

## Repeat findings and limits

The original marsh floor made a conspicuous vertical join. A full-strip image-tool
repair removed edge reeds/exposure bands; its horizontal edge/interior mean-jump
ratio improved from 2.02 to 1.51, with vertical 1.00. The selected repeat was inspected.

The exporter records mean/p95 edge jumps and interior jumps in
measurements.json. These are diagnostics, not a seamlessness test: mortar, ledger
rims, timber and iron courses intentionally create strong transitions. Eleven
tiles retain a join/interior ratio above 2 in at least one direction; their
[diagnostic repeat sheet](edge-diagnostic-overview.png) was inspected:

| Tile | Horizontal ratio | Vertical ratio |
|---|---:|---:|
| brown_catacombs_floor | 1.31 | 2.00 |
| blue_vaults_wall | 1.09 | 2.47 |
| blue_vaults_ceiling | 2.13 | 1.16 |
| crimson_crypts_floor | 2.08 | 1.84 |
| ossuary_floor | 2.39 | 1.16 |
| warrens_wall | 3.02 | 1.95 |
| dark_elf_halls_floor | 1.19 | 2.25 |
| grey_hold_wall | 2.23 | 1.84 |
| sunless_marsh_wall | 2.44 | 0.76 |
| drowned_halls_ceiling | 2.00 | 0.97 |
| old_forges_wall | 1.16 | 3.30 |

The repeats retain coherent regional material fields at native review scale;
regular joints/bands and repeated mineral/cloud features remain visible. Opposite
edge pixels are not guaranteed identical and these are not certified mathematically
periodic maps. Integration must reassess repeat visibility in native room layouts
and adjacent variants, especially earth/iron band boundaries and close inspection.
Do not present the scalar measurements as proof of seamless feature alignment.

## Renderer evidence

[390px overview](dungeon/390-overview.png) and
[320px overview](dungeon/320-overview.png) show 52 captures: thirteen themes in a
controlled corridor/material booth and close-wall view at both widths. Eight
cached darkness levels per floor/ceiling use the exact existing encoding, with
all pixels asserted. Existing renderer perspective, fog and cached distance
softening render these native 64px sources. No page/console errors were recorded.

The review temporarily unifies baseline wall variants and hides decals in a
neutral-look booth to isolate the three commissioned surfaces. It preserves and
checks original door/stair/fountain/lock bindings and non-base floor/roof kinds,
then restores the original theme objects. This is a proxy review, not a loader,
normal dungeon generation, architecture-state or offline test. The minimap and
HUD remain from the original test run; the material booth is synthetic. See
[metrics](dungeon/review.json).

No runtime, service-worker, gameplay, save, collision or world-light changes were
made. Architecture matching, surface variants, secret-wall equivalence, native
offline/fallback and isolated performance validation remain integration work.
Balance simulations are unnecessary for source/review-only artwork.

## Reproduction

- node art/creatures/reference-batch-o.cjs
- python3 art/creatures/export-batch-o.py --check
- node art/creatures/preview-batch-o.cjs
- npm run check:art
- npm run check:agents

Pillow/NumPy are required by the exporter. Reproduction checks bytes and records;
printed edge inspection notices are diagnostics and remain documented above.
