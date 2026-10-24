# Batch T first-person equipment review — 24 October 2026

Sixteen painted first-person frames are complete locally: nine Fighter longsword
poses, four Mage staff grip variants and three Ranger longbow bends. Source/review assets are published;
runtime integration remains pending. This is the selected baseline style pass;
the rest of the held library remains procedural. Batch S is published alongside this batch.

See [contact](contact-sheet.png), [registration review](registration-review.png),
[alpha composites](alpha-review.png) and [state/format audit](STATE-AUDIT.md).
The [manifest](../generation-batch-t.json) preserves exact prompts, original paths,
references, full-strip bow correction, failed request and authored registration.
[Measurements](measurements.json) record source/export hashes and common scales.
Generated with image_gen.imagegen; model not disclosed. Scripts only capture,
crop, uniformly resize/register and assemble diagnostic layouts.

## Visual review

All three originals and selected bow correction,140-reference inventory overview,
16 registered cells, contact/registration/alpha sheets and six phone galleries were
visually inspected. Weathered steel, plain guards/pommels, attached grey gloves,
brown sleeves, pale Mage hands/violet cloth, blue staff orb and dark yew/ivory
nocks match the gritty painted direction. Reference angles retain cut/recovery
order. Mage has two hands only in two-hand frames. Bow has one left hand; the
right hand, arrow and string stay procedural. No extra gear or world light.

The selected bow strip gives a clear intermediate bend once grips are aligned.
Original and corrected material/hand details differ slightly; this is a coherent
selected source strip, not a claim of pixel-identical unaffected panels. Small
shading/foreshortening changes remain between sword/staff poses; review native
animation continuity before enabling bindings. Through source sleeve has3px raw
clearance but is uncut; all exports have >=12px. Alpha over light/dark/brown keeps
open gaps without a rectangular matte. Source highlights remain local colour.

## Phone and motion review

54 frozen captures cover all16 frames, nine sword key times/recovery/Calm,
staff hand release for casting/read/use, bow rest/half/full/pre-release/release/
recoil/recovery/Calm, off-class and mythic bow fallbacks. See
[390 Fighter](dungeon/390-fighter-overview.png),
[390 Mage](dungeon/390-mage-overview.png),
[390 Ranger](dungeon/390-ranger-overview.png),
[320 Fighter](dungeon/320-fighter-overview.png),
[320 Mage](dungeon/320-mage-overview.png) and
[320 Ranger](dungeon/320-ranger-overview.png).

162 fitting/release fixture cases at160/360/464 heights pass; live string endpoints
attach within1px to authored painted nocks and arrow visibility follows .72 release.
All three selected class/weapon pairs remain legal. Six proxy fallback guards
retain original results for uncovered variants. No page/console errors. Twelve
existing native held-equipment browser tests also pass across phone/small.

These are review substitutions with frozen view data, not real equip/cast/attack
outcomes or a shipped asset loader. No procedural body, named weapon, inventory
picture, class palette, carried shield, light or gameplay rule is replaced in the
app. Runtime/offline/fallback/performance acceptance remains separate.

Reproduce with `python3 art/creatures/export-batch-t.py --check`,
`node art/creatures/reference-batch-t.cjs` and
`node art/creatures/preview-batch-t.cjs`.
