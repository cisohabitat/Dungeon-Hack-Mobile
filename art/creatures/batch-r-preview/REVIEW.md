# Batch R baseline architecture review — 24 October 2026

Eight architecture paintings are reviewed locally: plank door, eight-bar cell gate,
pillar surface, flat up/down stair faces, recessed up/down stair backs and an
open arch candidate. This completes the baseline source pass selected by the R
audit; regional material matching and exact arch geometry remain follow-ups.
Source/review assets are published; runtime integration remains pending.

See [contact](contact-sheet.png), [native64 review](native-review.png),
[arch alpha comparison](alpha-review.png) and [state/format audit](STATE-AUDIT.md).
Sources use image_gen.imagegen (model not disclosed); exact prompts, active
references, untouched generated paths, rejected gate repairs, selected crops and
hashes are in [manifest](../generation-batch-r.json) and [measurements](measurements.json).
Originals and repairs are preserved. Scripts only capture, crop, resample and lay
out reviews. No synthetic painting, recolouring or mask repair is used.

## Visual findings

Gritty grey stone, dark mortar, worn oak, riveted iron and restrained rust match
the approved dungeon direction. Six planks/two straps/right ring stay connected;
selected gate has eight rods, two crossbars and neutral right lock. Pillar is a
full-width rounded material face with capital/plinth, not an isolated sprite.
Stair up climbs toward faint grey light; down descends into black with a subtle
existing warm hint. Flat down preserves the reference's schematic receding tread
silhouette. No new lights, paths, obstacles or gameplay states are introduced.
All six source originals/repairs, eight exported cells, native/detail/alpha sheets,
reference inventory overview and four phone galleries were visually inspected.

The first seven-bar gate, full-sheet bar repair and first standalone gate remain
rejected provenance; the final four-pair reference repaint supplies eight bars.
The painted arch has transparent space and opaque masonry, but differs from the
live binary opening by 26 native pixels. It remains a source candidate; world
previews retain the original exact arch. The gate's stronger rust/rougher stones
and the original surrounding textures require coordinated material matching at
integration; this pass is not a guarantee of seamless regional architecture.

## Phone review

68 captures: 34 each at 390px and 320px. See
[390 structures](dungeon/390-structures-overview.png),
[390 states](dungeon/390-states-overview.png),
[320 structures](dungeon/320-structures-overview.png) and
[320 states](dungeon/320-states-overview.png).
Near/far stairs remain distinct; joined pillars become wall, side stairs show
wall and buried stairs retain rubble. Original five-colour locks in both gate
families, sliding fractions, three cracks, three burn stages, Calm fire and safe
palette are preserved. No page/console errors; bindings restored afterwards.
These are frozen renderer fixtures. Eight existing native architecture browser
tests separately pass at both widths, including real door opening.

Reproduce exports with `python3 art/creatures/export-batch-r.py --check`, references
with `node art/creatures/reference-batch-r.cjs` and previews with
`node art/creatures/preview-batch-r.cjs`. No loader, service worker or gameplay
changes. Native regional/offline/fallback and performance validation remains a
runtime integration gate. R does not close S’s secondary-material work.
