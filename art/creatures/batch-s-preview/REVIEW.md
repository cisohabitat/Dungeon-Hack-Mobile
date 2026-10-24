# Batch S secondary materials review — 24 October 2026

Twenty baseline material/detail cells are reviewed locally, in six source groups:
six floors, three roofs, six wall/rock surfaces, two fountain states and three
torch frames. Source/review assets are published; runtime integration remains pending. This completes
the selected baseline painting pass; regional matching and repeat-join refinement
remain follow-ups rather than thirteen finished regional kits.

See [contact](contact-sheet.png), [native64 review](native-review.png),
[repeat overview](repeat-overview.png) and [state/format audit](STATE-AUDIT.md).
The [manifest](../generation-batch-s.json) preserves exact prompts, references,
generated original paths, full-sheet mosaic correction and authored source crops.
The [measurements](measurements.json) retain source/export hashes and edge diagnostics.
Generated with image_gen.imagegen; model not disclosed. Scripts only capture,
crop, uniformly resize and assemble reviews, never paint or repair pixels.

## Visual review

Six originals and the selected S1 correction,20 native/detail cells,15 repeat
panels,260-reference overview and four phone galleries were visually inspected.
Gritty grey stone/dark mortar, brown-grey setts, subdued mosaic, worn altar slab,
black-blue shallow water, small rubble chips, old muted straw, coarse roof stone,
sparse roots and weathered beam retain distinct identities. Fallen masonry stays
opaque rubble obstruction; rock pillar uses a complete cylinder-shaded material
surface. No newly painted route, sky, open pit, creature, glyph power or light.

The first mosaic lacked its diamond. The preserved full-sheet edit restores a
dark tessera diamond while retaining path/altar compositions. Wet/dry fountains
share niche, square spout and rectangular trough: wet has a narrow blue stream
and blue water, dry has empty dark sediment with no stream. Torch0 is upright,
torch1 leans left/taller, torch2 right/shorter; iron bracket/handle stay aligned.
Minor generated stone/soot differences remain between frames; inspect flicker in
native integration before shipment. This pass does not claim pixel-identical walls.

Source tiling is reviewed, not certified seamless. Roots have visible branch
termination differences at joins; repeated shrine/moss details are conspicuous.
Some wall/rock/cave edge diagnostics exceed2x interior differences. Preserve
these findings and refine with the image tool if native views require it; do not
use scripted blending to conceal them. Regional material matching remains open.

## Browser evidence

84 frozen captures at390/320px cover20 cells near/far plus Calm torch and safe dry
fountain controls. See [390 surfaces](dungeon/390-surfaces-overview.png),
[390 details](dungeon/390-details-overview.png),
[320 surfaces](dungeon/320-surfaces-overview.png) and
[320 details](dungeon/320-details-overview.png).
Floor/roof kinds use actual look metadata; native image draws and existing
far-distance softening are checked. Doors, locks, exact arch and existing decor
retain original bindings.144 shade levels are numerically verified. No console
or page errors. Six existing regional browser tests also pass at both widths.

These are controlled renderer fixtures, not gameplay interactions or native
regional/offline/performance acceptance. O/R/S integration and remaining regional
matching stay separate. Reproduce references with
`node art/creatures/reference-batch-s.cjs`, exports with
`python3 art/creatures/export-batch-s.py --check` and previews with
`node art/creatures/preview-batch-s.cjs`.
